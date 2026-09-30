#!/usr/bin/env node
/**
 * BodyMap AI — Release Artifact Verification & Provenance Engine
 * =============================================================
 * Verifies that the local build matches the hashes recorded in
 * release-contract.json, enforces HTML asset graph provenance,
 * checks total chunk count against build inventory, generates a complete
 * deterministic artifact manifest, and performs post-build secret scanning.
 *
 * Usage:  node scripts/verify_artifact_integrity.mjs
 *
 * Prerequisites: run `npm run build` before executing this script.
 *
 * Exit 0 = all critical chunks, manifest, and provenance invariants verified
 * Exit 1 = one or more mismatches, missing files, or security failures
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateReleaseContractSchema } from './release_contract_schema.mjs';
import { scanFileContent, isBinaryAsset } from './security_scanner.mjs';

function getDefaultRoot() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url && typeof import.meta.url === 'string' && import.meta.url.startsWith('file:')) {
      return resolve(fileURLToPath(new URL('..', import.meta.url)));
    }
  } catch {}
  return process.cwd();
}

const ROOT = getDefaultRoot();
const CONTRACT_PATH = join(ROOT, 'release-contract.json');

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';

/**
 * Truly fail-closed directory walker.
 * Collects all regular files and captures structured errors without swallowing exceptions.
 */
export function safeWalkDir(dir, options = {}) {
  const files = [];
  const errors = [];

  if (!existsSync(dir)) {
    errors.push({
      type: 'MISSING_DIRECTORY',
      path: dir,
      message: `Directory does not exist: ${dir}`
    });
    return { success: false, files, errors };
  }

  function recurse(currentDir) {
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch (err) {
      errors.push({
        type: err.code === 'EACCES' || err.code === 'EPERM' ? 'PERMISSION_DENIED' : 'TRAVERSAL_FAILURE',
        path: currentDir,
        message: `Failed to enumerate directory ${currentDir}: ${err.message}`,
        error: err
      });
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      try {
        let lstat;
        try {
          lstat = lstatSync(fullPath);
        } catch (lstatErr) {
          errors.push({
            type: lstatErr.code === 'EACCES' || lstatErr.code === 'EPERM' ? 'PERMISSION_DENIED' : 'UNREADABLE_ENTRY',
            path: fullPath,
            message: `Failed to lstat entry ${fullPath}: ${lstatErr.message}`
          });
          continue;
        }

        if (lstat.isSymbolicLink()) {
          try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              recurse(fullPath);
            } else if (stat.isFile()) {
              files.push(fullPath);
            } else {
              errors.push({
                type: 'SPECIAL_DEVICE_ENTRY',
                path: fullPath,
                message: `Special file type behind symlink unsupported: ${fullPath}`
              });
            }
          } catch (symErr) {
            errors.push({
              type: 'BROKEN_SYMLINK',
              path: fullPath,
              message: `Broken or unresolvable symlink: ${fullPath} (${symErr.message})`
            });
          }
        } else if (entry.isDirectory()) {
          recurse(fullPath);
        } else if (entry.isFile()) {
          files.push(fullPath);
        } else {
          errors.push({
            type: 'SPECIAL_DEVICE_ENTRY',
            path: fullPath,
            message: `Non-regular file entry: ${fullPath}`
          });
        }
      } catch (entryErr) {
        errors.push({
          type: entryErr.code === 'EACCES' || entryErr.code === 'EPERM' ? 'PERMISSION_DENIED' : 'UNREADABLE_FILE',
          path: fullPath,
          message: `Failed to inspect entry ${fullPath}: ${entryErr.message}`,
          error: entryErr
        });
      }
    }
  }

  recurse(dir);
  return {
    success: errors.length === 0,
    files,
    errors
  };
}

/**
 * Extracts asset reference strings from HTML source.
 */
export function extractHtmlAssetReferences(html) {
  const matches = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m => m[1]);
  return [...new Set(matches.filter(url => url.startsWith('/assets/') || url.includes('/assets/')))];
}

/**
 * Validates an asset reference extracted from HTML and resolves it safely.
 * Rejects path traversal, encoded traversal, backslashes, external URLs,
 * and references escaping the dist directory.
 */
export function resolveAndValidateAssetPath(distDir, assetRef) {
  if (typeof assetRef !== 'string' || assetRef.trim() === '') {
    return { valid: false, reason: 'Empty or invalid asset reference' };
  }

  // Reject protocol-relative or absolute URLs
  if (assetRef.startsWith('//') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(assetRef)) {
    return { valid: false, reason: `External or protocol-relative URL rejected: ${assetRef}` };
  }

  // Reject query parameters or fragments that contain path traversal
  const rawPath = assetRef.split(/[?#]/)[0];
  if (/[?#]/.test(assetRef)) {
    const extra = assetRef.slice(rawPath.length);
    if (extra.includes('..') || /%2e/i.test(extra) || extra.includes('\\')) {
      return { valid: false, reason: `Path traversal pattern in URL query/fragment: ${assetRef}` };
    }
  }

  // Reject URL-encoded traversal forms (%2e, %2f, %5c)
  if (/%2e/i.test(rawPath) || /%2f/i.test(rawPath) || /%5c/i.test(rawPath)) {
    return { valid: false, reason: `URL-encoded traversal sequence rejected: ${assetRef}` };
  }

  // Reject backslashes
  if (rawPath.includes('\\')) {
    return { valid: false, reason: `Backslash path traversal rejected: ${assetRef}` };
  }

  // Reject redundant slashes '//' or './'
  if (/\/\//.test(rawPath) || /\/\.\//.test(rawPath) || /\/\.$/.test(rawPath)) {
    return { valid: false, reason: `Redundant or ambiguous slash/dot pattern rejected: ${assetRef}` };
  }

  // Reject explicit '..' or '.' segments
  const segments = rawPath.split('/');
  if (segments.includes('..') || segments.includes('.')) {
    return { valid: false, reason: `Directory traversal segment rejected: ${assetRef}` };
  }

  // Path must start with /assets/
  if (!rawPath.startsWith('/assets/')) {
    return { valid: false, reason: `Asset reference must begin with /assets/: ${assetRef}` };
  }

  const rel = rawPath.slice('/assets/'.length);
  const resolved = resolve(distDir, 'assets', rel);
  const expectedPrefix = resolve(distDir, 'assets');

  // Verify the canonical path remains strictly inside dist/assets
  if (!resolved.startsWith(expectedPrefix + (process.platform === 'win32' ? '\\' : '/')) && resolved !== expectedPrefix) {
    return { valid: false, reason: `Resolved path escapes dist/assets directory: ${assetRef}` };
  }

  return {
    valid: true,
    resolvedPath: resolved,
    relPath: `assets/${rel}`,
    filename: rel,
  };
}

/**
 * Determines file category for manifest classification.
 */
function classifyFileType(relPath) {
  if (relPath.endsWith('.html')) return 'html';
  if (relPath.endsWith('.js') || relPath.endsWith('.mjs')) return 'javascript';
  if (relPath.endsWith('.css')) return 'css';
  if (relPath.endsWith('.map')) return 'source_map';
  return 'static_asset';
}

/**
 * Generates a complete, deterministic build manifest for every emitted file in dist/.
 */
export function generateArtifactManifest(distDir, referencedAssetRelPaths = new Set()) {
  const walkResult = safeWalkDir(distDir);
  if (!walkResult.success) {
    return {
      success: false,
      manifest: [],
      manifestDigest: null,
      errors: walkResult.errors,
    };
  }

  const manifest = [];
  const normalizedDist = resolve(distDir);

  for (const absPath of walkResult.files) {
    const rel = absPath.replace(normalizedDist, '').replace(/\\/g, '/').replace(/^\//, '');
    try {
      const buf = readFileSync(absPath);
      const sha256 = createHash('sha256').update(buf).digest('hex');
      const bytes = buf.length;
      const category = classifyFileType(rel);

      manifest.push({
        rel,
        bytes,
        sha256,
        category,
        isReferencedByHtml: referencedAssetRelPaths.has(rel) || rel === 'index.html',
        isExecutable: category === 'javascript' || category === 'html',
        isSourceMap: category === 'source_map',
      });
    } catch (readErr) {
      return {
        success: false,
        manifest: [],
        manifestDigest: null,
        errors: [{
          type: 'READ_FAILURE',
          path: absPath,
          message: `Failed to read file for manifest: ${readErr.message}`
        }],
      };
    }
  }

  manifest.sort((a, b) => a.rel.localeCompare(b.rel));
  const canonicalJson = JSON.stringify(manifest);
  const manifestDigest = createHash('sha256').update(canonicalJson).digest('hex');

  return {
    success: true,
    manifest,
    manifestDigest,
    errors: [],
  };
}

/**
 * Verifies release artifact integrity against contract and fail-closed security invariants.
 */
export function verifyArtifactIntegrity({ root = ROOT, contractPath = CONTRACT_PATH } = {}) {
  const failures = [];
  const details = [];

  // 1. Strict Schema Validation of release-contract.json
  let contract;
  try {
    if (!contractPath || !existsSync(contractPath)) {
      return {
        valid: false,
        failures: [`Release contract file does not exist: ${contractPath}`],
        details: [],
      };
    }
    contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  } catch (e) {
    return {
      valid: false,
      failures: [`Cannot parse release contract: ${e.message}`],
      details: [],
    };
  }

  const schemaValidation = validateReleaseContractSchema(contract);
  if (!schemaValidation.valid) {
    const failures = schemaValidation.errors.map(err => `Contract schema error: ${err}`);
    if (!contract || !contract.criticalChunkHashes || typeof contract.criticalChunkHashes !== 'object') {
      failures.push('No criticalChunkHashes found in release contract');
    }
    return {
      valid: false,
      failures,
      details: [],
    };
  }

  const distDir = join(root, 'dist');
  const distAssetsDir = join(distDir, 'assets');

  if (!existsSync(distDir)) {
    return {
      valid: false,
      failures: ['dist/ directory does not exist — run npm run build before verification'],
      details: [],
    };
  }

  if (!existsSync(distAssetsDir)) {
    return {
      valid: false,
      failures: ['dist/assets directory does not exist'],
      details: [],
    };
  }

  // 2. Critical Chunk Hash & Byte Verification
  const expectedHashes = contract.criticalChunkHashes || {};
  for (const [filename, expected] of Object.entries(expectedHashes)) {
    const chunkPath = join(distAssetsDir, filename);
    if (!existsSync(chunkPath)) {
      failures.push(`MISSING: ${filename}`);
      continue;
    }

    try {
      const buf = readFileSync(chunkPath);
      const actualHash = createHash('sha256').update(buf).digest('hex');
      const actualBytes = buf.length;

      const hashMatch = actualHash === expected.sha256;
      const bytesMatch = actualBytes === expected.bytes;

      if (hashMatch && bytesMatch) {
        details.push(`${filename} — SHA-256 match (${actualBytes} bytes)`);
      } else {
        if (!hashMatch) {
          failures.push(`${filename} — SHA-256 MISMATCH (expected ${expected.sha256}, got ${actualHash})`);
        }
        if (!bytesMatch) {
          failures.push(`${filename} — BYTE SIZE MISMATCH (expected ${expected.bytes}, got ${actualBytes})`);
        }
      }
    } catch (err) {
      failures.push(`READ ERROR for ${filename}: ${err.message}`);
    }
  }

  // 3. HTML Asset Graph Provenance & Path-Traversal Check
  const referencedAssetRels = new Set();
  const indexHtmlPath = join(distDir, 'index.html');
  if (!existsSync(indexHtmlPath)) {
    failures.push('MISSING: dist/index.html');
  } else {
    try {
      const htmlContent = readFileSync(indexHtmlPath, 'utf8');
      const rawRefs = extractHtmlAssetReferences(htmlContent);
      for (const rawRef of rawRefs) {
        const val = resolveAndValidateAssetPath(distDir, rawRef);
        if (!val.valid) {
          failures.push(`Invalid HTML asset reference rejected: ${rawRef} (${val.reason})`);
        } else {
          referencedAssetRels.add(val.relPath);
          if (!existsSync(val.resolvedPath)) {
            failures.push(`HTML references missing asset: ${rawRef}`);
          }
        }
      }
    } catch (htmlErr) {
      failures.push(`Failed to read or parse dist/index.html: ${htmlErr.message}`);
    }
  }

  // 4. Asset Inventory & Unexpected Executable Asset Detection
  try {
    const emittedAssets = readdirSync(distAssetsDir);
    if (typeof contract.buildChunkCount === 'number') {
      if (emittedAssets.length !== contract.buildChunkCount) {
        failures.push(`Chunk count mismatch: expected ${contract.buildChunkCount} chunks, got ${emittedAssets.length}`);
      }
    }
  } catch (e) {
    failures.push(`Could not read dist/assets: ${e.message}`);
  }

  // 5. Complete Artifact Manifest Generation (Fail-Closed)
  const manifestResult = generateArtifactManifest(distDir, referencedAssetRels);
  if (!manifestResult.success) {
    for (const walkErr of manifestResult.errors) {
      failures.push(`Artifact manifest generation failure [${walkErr.type}]: ${walkErr.message}`);
    }
  } else {
    details.push(`Complete build manifest generated: ${manifestResult.manifest.length} files (digest: ${manifestResult.manifestDigest.slice(0, 16)})`);
  }

  // 6. Post-Build Secret & Sensitive Data Scan
  if (manifestResult.success) {
    for (const item of manifestResult.manifest) {
      const fullPath = join(distDir, item.rel);
      try {
        const buf = readFileSync(fullPath);
        const scan = scanFileContent(buf, item.rel);
        if (!scan.valid) {
          for (const finding of scan.findings) {
            failures.push(`Secret pattern detected [${finding.name}] in build output: ${item.rel}`);
          }
        }
      } catch (scanReadErr) {
        failures.push(`Fail-closed scan error: unable to read ${item.rel} for secret scan: ${scanReadErr.message}`);
      }
    }
  }

  return {
    valid: failures.length === 0,
    failures,
    details,
    manifest: manifestResult.manifest,
    manifestDigest: manifestResult.manifestDigest,
  };
}

function isMainModule() {
  try {
    if (!process.argv[1] || typeof import.meta === 'undefined' || !import.meta.url || !import.meta.url.startsWith('file:')) {
      return false;
    }
    return import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  console.log('\x1b[1mBodyMap AI — Release Artifact Integrity Verification\x1b[0m');
  console.log('─'.repeat(60));

  const result = verifyArtifactIntegrity();

  if (result.details.length > 0) {
    console.log(`\nVerifying critical chunks against contract...\n`);
    for (const detail of result.details) {
      console.log(`  ${PASS} ${detail}`);
    }
  }

  console.log('\n' + '─'.repeat(60));

  if (result.valid) {
    console.log(`\x1b[32m\x1b[1m  ARTIFACT INTEGRITY VERIFIED — all chunks and provenance invariants match\x1b[0m`);
    console.log('─'.repeat(60) + '\n');
    process.exit(0);
  } else {
    console.error(`\x1b[31m\x1b[1m  ARTIFACT INTEGRITY FAILED — ${result.failures.length} check(s) failed\x1b[0m\n`);
    for (const failure of result.failures) {
      console.error(`  ${FAIL} ${failure}`);
    }
    console.log('\n' + '─'.repeat(60) + '\n');
    process.exit(1);
  }
}
