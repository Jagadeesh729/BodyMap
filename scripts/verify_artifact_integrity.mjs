#!/usr/bin/env node
/**
 * BodyMap AI — Release Artifact Verification
 * ==========================================
 * Verifies that the current local build matches the hashes recorded in
 * release-contract.json. Fails if any critical chunk is missing or
 * has a different SHA-256 hash.
 *
 * Usage:  node scripts/verify_artifact_integrity.mjs
 *
 * Prerequisites: run `npm run build` before executing this script.
 *
 * Exit 0 = all critical chunks verified
 * Exit 1 = one or more mismatches or missing files
 */

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CONTRACT_PATH = join(ROOT, 'release-contract.json');
const DIST_PATH = join(ROOT, 'dist', 'assets');

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const WARN = '\x1b[33m!\x1b[0m';

let failures = 0;

console.log('\x1b[1mBodyMap AI — Release Artifact Integrity Verification\x1b[0m');
console.log('─'.repeat(60));

// Load contract
let contract;
try {
  contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
} catch (e) {
  console.error(`  ${FAIL} Cannot parse release-contract.json: ${e.message}`);
  process.exit(1);
}

const expectedHashes = contract.criticalChunkHashes ?? {};

if (Object.keys(expectedHashes).length === 0) {
  console.warn(`  ${WARN} No criticalChunkHashes found in release-contract.json`);
  process.exit(0);
}

console.log(`\nVerifying ${Object.keys(expectedHashes).length} critical chunk(s) against contract...\n`);

for (const [filename, expected] of Object.entries(expectedHashes)) {
  const chunkPath = join(DIST_PATH, filename);

  if (!existsSync(chunkPath)) {
    console.error(`  ${FAIL} MISSING: ${filename}`);
    failures++;
    continue;
  }

  const buf = readFileSync(chunkPath);
  const actualHash = createHash('sha256').update(buf).digest('hex');
  const actualBytes = buf.length;

  const hashMatch = actualHash === expected.sha256;
  const bytesMatch = actualBytes === expected.bytes;

  if (hashMatch && bytesMatch) {
    console.log(`  ${PASS} ${filename} — SHA-256 match (${actualBytes} bytes)`);
  } else {
    failures++;
    if (!hashMatch) {
      console.error(`  ${FAIL} ${filename} — SHA-256 MISMATCH`);
      console.error(`       expected: ${expected.sha256}`);
      console.error(`       actual:   ${actualHash}`);
    }
    if (!bytesMatch) {
      console.error(`  ${FAIL} ${filename} — BYTE SIZE MISMATCH (expected ${expected.bytes}, got ${actualBytes})`);
    }
  }
}

console.log('\n' + '─'.repeat(60));

if (failures === 0) {
  console.log(`\x1b[32m\x1b[1m  ARTIFACT INTEGRITY VERIFIED — all chunks match contract\x1b[0m`);
  console.log('─'.repeat(60) + '\n');
  process.exit(0);
} else {
  console.error(`\x1b[31m\x1b[1m  ARTIFACT INTEGRITY FAILED — ${failures} chunk(s) mismatched or missing\x1b[0m`);
  console.error('\n  This means either:');
  console.error('    a) The build was run from a different commit than the frozen release');
  console.error('    b) release-contract.json needs to be updated after an approved release');
  console.error('    c) The build output was tampered with');
  console.error('\n  Resolution: run `npm run build` from the release commit and re-verify.\n');
  console.log('─'.repeat(60) + '\n');
  process.exit(1);
}
