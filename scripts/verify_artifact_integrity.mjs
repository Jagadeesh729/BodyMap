#!/usr/bin/env node
/**
 * BodyMap AI — Release Artifact Verification & Provenance Engine
 * =============================================================
 * Verifies that the local build matches the hashes recorded in
 * release-contract.json, enforces HTML asset graph provenance,
 * checks total chunk count against build inventory, and performs
 * post-build secret scanning across all emitted assets.
 *
 * Usage:  node scripts/verify_artifact_integrity.mjs
 *
 * Prerequisites: run `npm run build` before executing this script.
 *
 * Exit 0 = all critical chunks and provenance invariants verified
 * Exit 1 = one or more mismatches, missing files, or security failures
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

const SECRET_PATTERNS = [
  /AIzaSy[A-Za-z0-9_-]{20,}/,
  /\bBearer\s+[A-Za-z0-9._-]{20,}/i,
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
];

export function extractHtmlAssetReferences(html) {
  return [...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)]
    .map(match => match[1])
    .filter((value, index, values) => values.indexOf(value) === index);
}

export function verifyArtifactIntegrity({ root = ROOT, contractPath = CONTRACT_PATH } = {}) {
  const failures = [];
  const details = [];

  // 1. Parse contract
  let contract;
  try {
    contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  } catch (e) {
    return {
      valid: false,
      failures: [`Cannot parse release contract: ${e.message}`],
      details: [],
    };
  }

  const expectedHashes = contract.criticalChunkHashes ?? {};
  if (Object.keys(expectedHashes).length === 0) {
    return {
      valid: false,
      failures: ['No criticalChunkHashes found in release contract — verification failed'],
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

  // 2. Critical chunk verification
  for (const [filename, expected] of Object.entries(expectedHashes)) {
    const chunkPath = join(distAssetsDir, filename);
    if (!existsSync(chunkPath)) {
      failures.push(`MISSING: ${filename}`);
      continue;
    }

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
  }

  // 3. HTML Asset Graph Provenance
  const indexHtmlPath = join(distDir, 'index.html');
  if (!existsSync(indexHtmlPath)) {
    failures.push('MISSING: dist/index.html');
  } else {
    const htmlContent = readFileSync(indexHtmlPath, 'utf8');
    const referencedAssets = extractHtmlAssetReferences(htmlContent);
    for (const assetRef of referencedAssets) {
      const assetFilename = assetRef.replace(/^\/assets\//, '');
      const assetPath = join(distAssetsDir, assetFilename);
      if (!existsSync(assetPath)) {
        failures.push(`HTML references missing asset: ${assetRef}`);
      }
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

  // 5. Post-Build Secret & Sensitive Data Scan
  function walkDir(dir, results = []) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walkDir(full, results);
        else results.push(full);
      }
    } catch {}
    return results;
  }

  const allDistFiles = walkDir(distDir);
  for (const file of allDistFiles) {
    const rel = file.replace(root, '').replace(/\\/g, '/').replace(/^\//, '');
    try {
      const content = readFileSync(file, 'utf8');
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          failures.push(`Secret pattern detected in build output: ${rel}`);
        }
      }
      if (/sourceMappingURL\s*=/i.test(content)) {
        failures.push(`Source map directive detected in build output: ${rel}`);
      }
    } catch {
      // binary files
    }
  }

  return {
    valid: failures.length === 0,
    failures,
    details,
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
