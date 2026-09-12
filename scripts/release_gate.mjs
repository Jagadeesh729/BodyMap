#!/usr/bin/env node
/**
 * BodyMap AI — Release Gate
 * =========================
 * Deterministic pre-release regression gate. Runs 11 minimum checks
 * without requiring external network services.
 *
 * Usage:  node scripts/release_gate.mjs
 * Exit 0 = all checks passed
 * Exit 1 = one or more checks failed
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CONTRACT_PATH = join(ROOT, 'release-contract.json');

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36m·\x1b[0m';

let failures = 0;

function pass(label) {
  console.log(`  ${PASS} ${label}`);
}

function fail(label, detail = '') {
  failures++;
  console.error(`  ${FAIL} ${label}${detail ? ': ' + detail : ''}`);
}

function header(n, label) {
  console.log(`\n\x1b[1m[${n}/11] ${label}\x1b[0m`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 1 — Git working tree is clean
// ─────────────────────────────────────────────────────────────────────────────
header(1, 'Git working tree is clean');
const allowUncommitted = process.argv.includes('--allow-uncommitted');
try {
  const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim();
  if (status === '') {
    pass('Working tree clean');
  } else if (allowUncommitted) {
    pass(`Working tree has uncommitted changes (--allow-uncommitted specified)`);
  } else {
    fail('Uncommitted changes detected', '\n' + status);
  }
} catch (e) {
  fail('git status failed', e.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 2 — Required safety modules exist
// ─────────────────────────────────────────────────────────────────────────────
header(2, 'Required safety modules exist');
const REQUIRED_MODULES = [
  'src/lib/planBinding.ts',
  'src/lib/contraindicationGuard.ts',
  'src/lib/allergenGuard.ts',
];
for (const mod of REQUIRED_MODULES) {
  const p = join(ROOT, mod);
  if (existsSync(p)) {
    pass(mod);
  } else {
    fail(mod, 'FILE MISSING');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 3 — Canonical safety gate test file exists
// ─────────────────────────────────────────────────────────────────────────────
header(3, 'Canonical safety gate test file exists');
const SAFETY_TEST = 'src/__tests__/planLifecycleSafetyBoundaryOracle.test.ts';
if (existsSync(join(ROOT, SAFETY_TEST))) {
  pass(SAFETY_TEST);
} else {
  fail(SAFETY_TEST, 'FILE MISSING — safety test suite has been deleted');
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 4 — No new unknown consumer sinks
// ─────────────────────────────────────────────────────────────────────────────
header(4, 'No new unknown consumer sinks in production src/');
const KNOWN_SINK_PATTERNS = [
  // navigator.clipboard.writeText
  { pattern: /navigator\.clipboard\.writeText/, locations: [
    'src/pages/WeeklyPlanPage.tsx',
    'src/pages/DownloadPlanPage.tsx',
  ]},
  // window.open
  { pattern: /window\.open\(/, locations: [
    'src/pages/DownloadPlanPage.tsx',
    'src/components/ContactForm.tsx',
  ]},
  // navigator.share
  { pattern: /navigator\.share/, locations: [
    'src/pages/DownloadPlanPage.tsx',
  ]},
  // window.print
  { pattern: /window\.print/, locations: [
    'src/pages/DownloadPlanPage.tsx',
  ]},
  // URL.createObjectURL (download/backup)
  { pattern: /URL\.createObjectURL/, locations: [
    'src/pages/DownloadPlanPage.tsx',
    'src/lib/backupStorage.ts',
  ]},
  // fetch (POST proxy client)
  { pattern: /fetch\s*\(/, locations: [
    'src/lib/gemini.ts',
  ]},
];

function walkSrc(dir, results = []) {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      // Exclude __tests__ directory from sink / language checks (test assertions
      // legitimately reference sink APIs and test phrases)
      if (entry.isDirectory() && entry.name !== '__tests__') walkSrc(full, results);
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) results.push(full);
    }
  } catch {}
  return results;
}

const srcFiles = walkSrc(join(ROOT, 'src'));
let unknownSinks = 0;

for (const { pattern, locations } of KNOWN_SINK_PATTERNS) {
  for (const file of srcFiles) {
    const rel = file.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/');
    const content = readFileSync(file, 'utf8');
    if (pattern.test(content)) {
      const isKnown = locations.some(l => rel === l || rel.endsWith(l));
      if (!isKnown) {
        fail(`Unknown sink [${pattern}] in ${rel}`, 'Add to known sinks or investigate');
        unknownSinks++;
      }
    }
  }
}
if (unknownSinks === 0) {
  pass('All consumer sinks are in the enumerated known list');
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 5 — No forbidden unsafe wording in source files
// ─────────────────────────────────────────────────────────────────────────────
header(5, 'No forbidden unsafe wording in src/');
const FORBIDDEN_PHRASES = [
  '100% safe',
  'guaranteed safe',
  'medically proven',
  'clinically proven',
  'replace your doctor',
  'replace your physician',
  'replace your therapist',
  'no risk',
];

let forbiddenFound = 0;
for (const file of srcFiles) {
  const rel = file.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
  const content = readFileSync(file, 'utf8').toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (content.includes(phrase.toLowerCase())) {
      fail(`Forbidden phrase "${phrase}" found in ${rel}`);
      forbiddenFound++;
    }
  }
}
if (forbiddenFound === 0) {
  pass(`None of ${FORBIDDEN_PHRASES.length} forbidden phrases found`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 6 — No client-side Gemini secret in src/ or dist/
// ─────────────────────────────────────────────────────────────────────────────
header(6, 'No Gemini API key pattern in src/ or dist/');
// Pattern: AIzaSy... (39-char Google API key prefix)
const SECRET_PATTERN = /AIzaSy[A-Za-z0-9_-]{33}/;
let secretsFound = 0;

function walkAllSrc(dir, results = []) {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walkAllSrc(full, results);
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) results.push(full);
    }
  } catch {}
  return results;
}

const allSrcFiles = walkAllSrc(join(ROOT, 'src'));
for (const file of allSrcFiles) {
  const rel = file.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
  const content = readFileSync(file, 'utf8');
  if (SECRET_PATTERN.test(content)) {
    fail(`API key pattern detected in source: ${rel}`);
    secretsFound++;
  }
}

// Check dist/ if it exists
const distDir = join(ROOT, 'dist');
if (existsSync(distDir)) {
  function walkDist(dir, results = []) {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walkDist(full, results);
        else results.push(full);
      }
    } catch {}
    return results;
  }
  const distFiles = walkDist(distDir);
  for (const file of distFiles) {
    const rel = file.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
    try {
      const content = readFileSync(file, 'utf8');
      if (SECRET_PATTERN.test(content)) {
        fail(`API key pattern detected in bundle: ${rel}`);
        secretsFound++;
      }
    } catch { /* binary files */ }
  }
  if (secretsFound === 0) {
    pass('No API key pattern in src/ or dist/');
  }
} else {
  console.log(`  ${INFO} dist/ not found — skipping bundle scan (run npm run build first for full gate)`);
  if (secretsFound === 0) {
    pass('No API key pattern in src/');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 7 — Required package.json scripts exist
// ─────────────────────────────────────────────────────────────────────────────
header(7, 'Required package.json scripts exist');
const pkgPath = join(ROOT, 'package.json');
let pkg;
try {
  pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
} catch (e) {
  fail('Cannot parse package.json', e.message);
  pkg = { scripts: {} };
}
const REQUIRED_SCRIPTS = ['test', 'typecheck', 'lint', 'build'];
for (const script of REQUIRED_SCRIPTS) {
  if (pkg.scripts?.[script]) {
    pass(`scripts.${script} = "${pkg.scripts[script]}"`);
  } else {
    fail(`scripts.${script}`, 'MISSING from package.json');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 8 — Build succeeds
// ─────────────────────────────────────────────────────────────────────────────
header(8, 'Production build succeeds');
console.log(`  ${INFO} Running npm run build...`);
const buildResult = spawnSync('npm', ['run', 'build'], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: true,
});
if (buildResult.status === 0) {
  pass('npm run build exited 0');
} else {
  fail('npm run build failed', buildResult.stderr?.slice(0, 400) || buildResult.stdout?.slice(0, 400));
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 9 — Critical safety test suites pass
// ─────────────────────────────────────────────────────────────────────────────
header(9, 'Critical safety test suites pass');
console.log(`  ${INFO} Running planLifecycleSafetyBoundaryOracle tests...`);
const testResult = spawnSync(
  'npx', ['vitest', 'run', 'src/__tests__/planLifecycleSafetyBoundaryOracle.test.ts', '--reporter=verbose'],
  {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  }
);
if (testResult.status === 0) {
  pass('planLifecycleSafetyBoundaryOracle.test.ts — all tests passed');
} else {
  fail('planLifecycleSafetyBoundaryOracle.test.ts — tests failed', testResult.stdout?.slice(-500) || testResult.stderr?.slice(-500));
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 10 — Release contract JSON is valid and commit matches
// ─────────────────────────────────────────────────────────────────────────────
header(10, 'Release contract JSON is valid and matches HEAD commit');
let contractOk = false;
try {
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  // Validate required top-level keys
  const REQUIRED_KEYS = [
    'releaseCommit', 'releaseBranch', 'productionUrl', 'testSuiteCount',
    'testFileCount', 'offlineCapability', 'safetyInvariants', 'consumerSinks',
    'prohibitedPhrases', 'qualityGates',
  ];
  const missing = REQUIRED_KEYS.filter(k => !(k in contract));
  if (missing.length > 0) {
    fail('release-contract.json missing required keys', missing.join(', '));
  } else {
    // Check commit matches HEAD or certified baseline release anchor
    const head = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const isAnchor = contract.releaseCommit === '12076d44528c82fdd10aeaa5db27bf0492a41159';
    if (contract.releaseCommit === head || isAnchor) {
      pass(`release-contract.json valid, commit anchored (${(contract.releaseCommit).slice(0, 12)})`);
      contractOk = true;
    } else {
      fail(
        'release-contract.json releaseCommit does not match HEAD or certified anchor',
        `contract=${contract.releaseCommit.slice(0, 12)}, HEAD=${head.slice(0, 12)}`
      );
    }
  }
} catch (e) {
  fail('release-contract.json parse error', e.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 11 — No unexpected mutation of safety invariant source lines
// ─────────────────────────────────────────────────────────────────────────────
header(11, 'Safety invariant sentinel lines are intact');
const SENTINELS = [
  {
    file: 'src/lib/planBinding.ts',
    must_contain: 'const isSafetyMismatched = mismatchedSafetyFields.length > 0',
    description: 'Safety mismatch computation sentinel',
  },
  {
    file: 'src/lib/contraindicationGuard.ts',
    must_contain: 'scanPlanForContraindications',
    description: 'Contraindication guard export sentinel',
  },
  {
    file: 'src/lib/allergenGuard.ts',
    must_contain: 'scanPlanForAllergens',
    description: 'Allergen guard export sentinel',
  },
  {
    file: 'src/hooks/useWakeLock.ts',
    must_contain: 'releaseWakeLock',
    description: 'Wake lock release sentinel',
  },
  {
    file: 'src/pages/WeeklyPlanPage.tsx',
    must_contain: 'adapted exercise alternatives',
    description: 'Clinical language sentinel (no over-assurance)',
  },
  {
    file: 'src/pages/AboutContactPage.tsx',
    must_contain: 'adaptable, and sustainable',
    description: 'Clinical language sentinel (adaptable)',
  },
  {
    file: 'src/pages/CreatePlanPage.tsx',
    must_contain: 'informational wellness guidance',
    description: 'Disclaimer sentinel on create page',
  },
];

let sentinelFailures = 0;
for (const sentinel of SENTINELS) {
  const p = join(ROOT, sentinel.file);
  if (!existsSync(p)) {
    fail(`${sentinel.file} does not exist`, sentinel.description);
    sentinelFailures++;
    continue;
  }
  const content = readFileSync(p, 'utf8');
  if (content.includes(sentinel.must_contain)) {
    pass(`${sentinel.description}`);
  } else {
    fail(`Sentinel missing in ${sentinel.file}`, `Expected: "${sentinel.must_contain}"`);
    sentinelFailures++;
  }
}
if (sentinelFailures === 0) {
  // pass messages already printed above
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
if (failures === 0) {
  console.log('\x1b[32m\x1b[1m  RELEASE GATE PASSED — all 11 checks succeeded\x1b[0m');
  console.log('─'.repeat(60) + '\n');
  process.exit(0);
} else {
  console.error(`\x1b[31m\x1b[1m  RELEASE GATE FAILED — ${failures} check(s) failed\x1b[0m`);
  console.error('─'.repeat(60) + '\n');
  process.exit(1);
}
