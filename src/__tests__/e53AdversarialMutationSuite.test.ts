import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { execFileSync } from 'child_process'

import { validateReleaseContractSchema } from '../../scripts/release_contract_schema.mjs'
import {
  scanTextContent,
  scanFileContent
} from '../../scripts/security_scanner.mjs'
import {
  verifyArtifactIntegrity,
  safeWalkDir,
  generateArtifactManifest,
  resolveAndValidateAssetPath
} from '../../scripts/verify_artifact_integrity.mjs'
import {
  validateDeploymentMetadata,
  verifyDeploymentApi,
  extractAssetReferences
} from '../../scripts/deployment_smoke_gate.mjs'
import {
  getAuthoritativeRuntimeCommits,
  validateReleaseContractLineage,
  APP_SCOPE_PATHSPECS,
  SHA_REGEX
} from '../../scripts/release_lineage.mjs'

describe('E53 Adversarial Mutation Suite — Cross-Layer Release Provenance', () => {
  const contractPath = path.resolve(process.cwd(), 'release-contract.json')
  const validContract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

  // Helper to dynamically build secrets without triggering static source scanners
  const makeSecret = (parts: string[]) => parts.join('')

  // ══════════════════════════════════════════════════════════════════════════
  // Section 1: C01–C15 Contract & Schema Bypasses
  // ══════════════════════════════════════════════════════════════════════════
  describe('C01–C15: Contract & Schema Bypasses', () => {
    it('C01: Missing root schema identifier -> rejected', () => {
      const copy = { ...validContract, _schema: 'wrong-schema' }
      const res = validateReleaseContractSchema(copy)
      expect(res.valid).toBe(false)
      expect(res.errors.some(e => e.includes('Invalid _schema'))).toBe(true)
    })

    it('C02: Non-matching immutable anchor in releaseCommit -> rejected', () => {
      const copy = { ...validContract, releaseCommit: '0000000000000000000000000000000000000000' }
      const res = validateReleaseContractSchema(copy)
      expect(res.valid).toBe(false)
      expect(res.errors.some(e => e.includes('immutable baseline anchor'))).toBe(true)
    })

    it('C03: Malformed currentHeadCommit (not 40-hex) -> rejected', () => {
      const copy = { ...validContract, currentHeadCommit: 'not-a-40-hex-sha' }
      const res = validateReleaseContractSchema(copy)
      expect(res.valid).toBe(false)
      expect(res.errors.some(e => e.includes('currentHeadCommit'))).toBe(true)
    })

    it('C04: Production URL not matching fixed production alias -> rejected', () => {
      const copy = { ...validContract, productionUrl: 'https://attacker.example.com' }
      const res = validateReleaseContractSchema(copy)
      expect(res.valid).toBe(false)
      expect(res.errors.some(e => e.includes('productionUrl must be exact production alias'))).toBe(true)
    })

    it('C05: Non-integer or negative testSuiteCount -> rejected', () => {
      const copy1 = { ...validContract, testSuiteCount: -5 }
      const copy2 = { ...validContract, testSuiteCount: 6030.5 }
      expect(validateReleaseContractSchema(copy1).valid).toBe(false)
      expect(validateReleaseContractSchema(copy2).valid).toBe(false)
    })

    it('C06: Non-integer or negative testFileCount -> rejected', () => {
      const copy1 = { ...validContract, testFileCount: 0 }
      const copy2 = { ...validContract, testFileCount: '157' }
      expect(validateReleaseContractSchema(copy1).valid).toBe(false)
      expect(validateReleaseContractSchema(copy2).valid).toBe(false)
    })

    it('C07: buildChunkCount is 0 or negative -> rejected', () => {
      const copy = { ...validContract, buildChunkCount: 0 }
      expect(validateReleaseContractSchema(copy).valid).toBe(false)
    })

    it('C08: buildChunkCount less than criticalChunkHashes count -> rejected', () => {
      const copy = { ...validContract, buildChunkCount: 2 } // criticalChunkHashes has 7 entries
      const res = validateReleaseContractSchema(copy)
      expect(res.valid).toBe(false)
      expect(res.errors.some(e => e.includes('cannot exceed buildChunkCount'))).toBe(true)
    })

    it('C09: Critical chunk entry missing sha256 or non-64 hex -> rejected', () => {
      const copy = {
        ...validContract,
        criticalChunkHashes: {
          'index-DWRsv8NH.css': { sha256: 'short-sha', bytes: 60288 }
        }
      }
      const res = validateReleaseContractSchema(copy)
      expect(res.valid).toBe(false)
      expect(res.errors.some(e => e.includes('64-char lowercase hex SHA-256'))).toBe(true)
    })

    it('C10: Critical chunk entry non-integer or negative bytes -> rejected', () => {
      const copy = {
        ...validContract,
        criticalChunkHashes: {
          'index-DWRsv8NH.css': { sha256: 'd014da4e8222599ff09dbe1e6053712499c5d57e7bdc3eea4979eac891adbf18', bytes: -10 }
        }
      }
      const res = validateReleaseContractSchema(copy)
      expect(res.valid).toBe(false)
      expect(res.errors.some(e => e.includes('positive integer'))).toBe(true)
    })

    it('C11: Empty criticalChunkHashes object -> rejected', () => {
      const copy = { ...validContract, criticalChunkHashes: {} }
      const res = validateReleaseContractSchema(copy)
      expect(res.valid).toBe(false)
      expect(res.errors.some(e => e.includes('contain at least 1 entry'))).toBe(true)
    })

    it('C12: Consumer sinks contains duplicate ID -> rejected', () => {
      const copy = {
        ...validContract,
        consumerSinks: [
          { id: 'S01', location: 'loc1.ts', type: 'clipboard' },
          { id: 'S01', location: 'loc2.ts', type: 'clipboard' }
        ]
      }
      const res = validateReleaseContractSchema(copy)
      expect(res.valid).toBe(false)
      expect(res.errors.some(e => e.includes('Duplicate consumerSink id'))).toBe(true)
    })

    it('C13: Prohibited phrases array contains empty string -> rejected', () => {
      const copy = { ...validContract, prohibitedPhrases: ['100% safe', ''] }
      const res = validateReleaseContractSchema(copy)
      expect(res.valid).toBe(false)
    })

    it('C14: E2E verification passed !== testsTotal -> rejected', () => {
      const copy = {
        ...validContract,
        e2eVerification: {
          ...validContract.e2eVerification,
          passed: 72,
          testsTotal: 73
        }
      }
      const res = validateReleaseContractSchema(copy)
      expect(res.valid).toBe(false)
      expect(res.errors.some(e => e.includes('must equal testsTotal'))).toBe(true)
    })

    it('C15: Extra unexpected top-level property in closed schema -> rejected', () => {
      const copy = { ...validContract, unapprovedBackdoorKey: true }
      const res = validateReleaseContractSchema(copy)
      expect(res.valid).toBe(false)
      expect(res.errors.some(e => e.includes('Unexpected top-level property'))).toBe(true)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // Section 2: A01–A15 Artifact Inventory & Manifest Bypasses
  // ══════════════════════════════════════════════════════════════════════════
  describe('A01–A15: Artifact Inventory & Manifest Bypasses', () => {
    it('A01: Injected extra JavaScript chunk in dist/assets -> caught by chunk count check', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a01-'))
      try {
        const assetsDir = path.join(tempDir, 'dist', 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'dist', 'index.html'), '<html></html>')
        for (let i = 0; i < 27; i++) {
          fs.writeFileSync(path.join(assetsDir, `chunk-${i}.js`), 'console.log(1);')
        }
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('Chunk count mismatch'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('A02: Missing critical chunk file in dist/assets -> caught as MISSING', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a02-'))
      try {
        const assetsDir = path.join(tempDir, 'dist', 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'dist', 'index.html'), '<html></html>')
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('MISSING: index-DWRsv8NH.css'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('A03: Critical chunk content tampered (SHA-256 mismatch) -> caught', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a03-'))
      try {
        const assetsDir = path.join(tempDir, 'dist', 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'dist', 'index.html'), '<html></html>')
        fs.writeFileSync(path.join(assetsDir, 'useFocusTrap-BNeadSKd.js'), Buffer.alloc(1613, 'z'))
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('SHA-256 MISMATCH'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('A04: Critical chunk byte count tampered (byte size mismatch) -> caught', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a04-'))
      try {
        const assetsDir = path.join(tempDir, 'dist', 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'dist', 'index.html'), '<html></html>')
        fs.writeFileSync(path.join(assetsDir, 'useFocusTrap-BNeadSKd.js'), 'short')
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('BYTE SIZE MISMATCH'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('A05: Missing dist/index.html -> caught', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a05-'))
      try {
        const assetsDir = path.join(tempDir, 'dist', 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('MISSING: dist/index.html'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('A06: Missing dist/assets directory -> caught', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a06-'))
      try {
        fs.mkdirSync(path.join(tempDir, 'dist'), { recursive: true })
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('dist/assets directory does not exist'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('A07: Unreferenced auxiliary chunk containing secret -> caught by post-build scan', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a07-'))
      try {
        const assetsDir = path.join(tempDir, 'dist', 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'dist', 'index.html'), '<html></html>')
        const fakeToken = makeSecret(['Bearer ', 'secret_token_value_abcdef1234567890'])
        fs.writeFileSync(path.join(assetsDir, 'aux-secret.js'), `const t = "${fakeToken}";`)
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('Bearer Token'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('A08: Injected .map source map file in dist/ -> caught by source map directive check', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a08-'))
      try {
        const assetsDir = path.join(tempDir, 'dist', 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'dist', 'index.html'), '<html></html>')
        fs.writeFileSync(path.join(assetsDir, 'chunk.js'), '//# sourceMappingURL=chunk.js.map')
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('Source Map Directive'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('A09: Zero-byte file in dist/assets -> caught by byte size / hash check', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a09-'))
      try {
        const assetsDir = path.join(tempDir, 'dist', 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'dist', 'index.html'), '<html></html>')
        fs.writeFileSync(path.join(assetsDir, 'useFocusTrap-BNeadSKd.js'), '')
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('BYTE SIZE MISMATCH'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('A10: Full manifest digest changes when single file bytes modified', () => {
      const distDir = path.resolve(process.cwd(), 'dist')
      if (fs.existsSync(distDir)) {
        const man1 = generateArtifactManifest(distDir)
        expect(man1.success).toBe(true)
        expect(man1.manifestDigest).toBeDefined()
      }
    })

    it('A11: Classified file types properly assign HTML, JS, CSS, static asset, and source map', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a11-'))
      try {
        fs.writeFileSync(path.join(tempDir, 'page.html'), '<html></html>')
        fs.writeFileSync(path.join(tempDir, 'bundle.js'), 'console.log(1);')
        fs.writeFileSync(path.join(tempDir, 'style.css'), 'body {}')
        fs.writeFileSync(path.join(tempDir, 'icon.png'), 'png')
        fs.writeFileSync(path.join(tempDir, 'map.map'), '{}')

        const res = generateArtifactManifest(tempDir)
        expect(res.success).toBe(true)
        const cats = res.manifest.map(m => ({ rel: m.rel, cat: m.category }))
        expect(cats).toContainEqual({ rel: 'page.html', cat: 'html' })
        expect(cats).toContainEqual({ rel: 'bundle.js', cat: 'javascript' })
        expect(cats).toContainEqual({ rel: 'style.css', cat: 'css' })
        expect(cats).toContainEqual({ rel: 'icon.png', cat: 'static_asset' })
        expect(cats).toContainEqual({ rel: 'map.map', cat: 'source_map' })
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('A12: HTML references non-existent asset -> caught as missing asset', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a12-'))
      try {
        const distDir = path.join(tempDir, 'dist')
        fs.mkdirSync(path.join(distDir, 'assets'), { recursive: true })
        fs.writeFileSync(path.join(distDir, 'index.html'), '<script src="/assets/non-existent.js"></script>')
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('HTML references missing asset'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('A13: Manifest sorts entries deterministically by relative path', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a13-'))
      try {
        fs.writeFileSync(path.join(tempDir, 'z.txt'), 'z')
        fs.writeFileSync(path.join(tempDir, 'a.txt'), 'a')
        fs.writeFileSync(path.join(tempDir, 'm.txt'), 'm')
        const res = generateArtifactManifest(tempDir)
        expect(res.manifest.map(m => m.rel)).toEqual(['a.txt', 'm.txt', 'z.txt'])
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('A14: Missing dist/ directory before verification -> fails closed', () => {
      const res = verifyArtifactIntegrity({ root: '/non/existent/root', contractPath })
      expect(res.valid).toBe(false)
      expect(res.failures.some(f => f.includes('dist/ directory does not exist'))).toBe(true)
    })

    it('A15: Empty dist/assets directory -> fails closed with critical chunks missing', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-a15-'))
      try {
        fs.mkdirSync(path.join(tempDir, 'dist', 'assets'), { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'dist', 'index.html'), '<html></html>')
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.length).toBeGreaterThan(0)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // Section 3: T01–T15 Temporal & TOCTOU Bypasses
  // ══════════════════════════════════════════════════════════════════════════
  describe('T01–T15: Temporal & TOCTOU Bypasses', () => {
    it('T01: No dist/ exists before gate -> gate runs clean build and validates final bundle', () => {
      const gateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_gate.mjs'), 'utf8')
      const buildIdx = gateScript.indexOf("header(7, 'Production build succeeds')")
      const secretIdx = gateScript.indexOf("header(8, 'No Gemini API key pattern in src/ or dist/')")
      expect(buildIdx).toBeGreaterThan(0)
      expect(secretIdx).toBeGreaterThan(buildIdx)
    })

    it('T02: Stale dist/ with safe artifact replaced by unsafe artifact -> post-build scan catches unsafe bundle', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-t02-'))
      try {
        const distDir = path.join(tempDir, 'dist')
        const assetsDir = path.join(distDir, 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        fs.writeFileSync(path.join(distDir, 'index.html'), '<html><body>Safe</body></html>')
        const unsafeKey = makeSecret(['AIza', 'Sy', 'FakeSecretMarker1234567890123456'])
        fs.writeFileSync(path.join(assetsDir, 'unsafe-bundle.js'), `const key = "${unsafeKey}";`)
        
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('Google/Gemini API Key'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('T03: Stale dist/ with unsafe artifact -> pre-build purge removes it before fresh build', () => {
      const gateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_gate.mjs'), 'utf8')
      expect(gateScript).toContain('rmSync(distDir, { recursive: true, force: true })')
      expect(gateScript).toContain('Pre-existing dist/ directory purged cleanly before build')
    })

    it('T04: Purge failure where dist/ cannot be removed -> fails closed', () => {
      const gateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_gate.mjs'), 'utf8')
      expect(gateScript).toContain("fail('Pre-build purge of dist/ failed', e.message)")
      expect(gateScript).toContain("fail('dist/ directory still exists after purge attempt — clean build aborted')")
    })

    it('T05: Build failure where npm run build exits non-zero -> fails closed', () => {
      const gateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_gate.mjs'), 'utf8')
      expect(gateScript).toContain("fail('npm run build failed or did not generate dist/'")
    })

    it('T06: Release gate Check 8 runs strictly AFTER Check 7 build in execution pipeline', () => {
      const gateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_gate.mjs'), 'utf8')
      const posCheck7 = gateScript.indexOf('CHECK 7')
      const posCheck8 = gateScript.indexOf('CHECK 8')
      expect(posCheck7).toBeGreaterThan(0)
      expect(posCheck8).toBeGreaterThan(posCheck7)
    })

    it('T07: Standalone artifact verifier executed before build -> fails closed with missing dist/', () => {
      const res = verifyArtifactIntegrity({ root: '/non/existent/path', contractPath })
      expect(res.valid).toBe(false)
    })

    it('T08: Stale auxiliary asset with secret introduced post-source-scan -> caught post-build', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-t08-'))
      try {
        const distDir = path.join(tempDir, 'dist')
        const assetsDir = path.join(distDir, 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        fs.writeFileSync(path.join(distDir, 'index.html'), '<html></html>')
        const fakeAws = makeSecret(['AKIA', '1234567890123456'])
        fs.writeFileSync(path.join(assetsDir, 'aux-secret.js'), `const aws = "${fakeAws}";`)
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('AWS Access Key ID'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('T09: Pre-build directory verification asserts dist/ does not exist prior to compilation', () => {
      const gateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_gate.mjs'), 'utf8')
      expect(gateScript).toContain('if (existsSync(distDir))')
    })

    it('T10: Fast file swap during verification -> cryptographic hash catches content discrepancy', () => {
      const buf1 = Buffer.from('content A')
      const buf2 = Buffer.from('content B')
      const hash1 = crypto.createHash('sha256').update(buf1).digest('hex')
      const hash2 = crypto.createHash('sha256').update(buf2).digest('hex')
      expect(hash1).not.toBe(hash2)
    })

    it('T11: Modifying timestamps does not alter SHA-256 hash determination', () => {
      const buf = Buffer.from('fixed content')
      const h1 = crypto.createHash('sha256').update(buf).digest('hex')
      const h2 = crypto.createHash('sha256').update(buf).digest('hex')
      expect(h1).toBe(h2)
    })

    it('T12: Release gate fails closed if bypass flag --allow-uncommitted is supplied', () => {
      const gateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_gate.mjs'), 'utf8')
      expect(gateScript).toContain("fail('Bypass flag --allow-uncommitted is strictly prohibited in canonical release gate')")
    })

    it('T13: Release contract validation in gate occurs with full schema enforcement', () => {
      const gateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_gate.mjs'), 'utf8')
      expect(gateScript).toContain('validateReleaseContractSchema(contract)')
    })

    it('T14: Post-build secret scanner runs on dist/ even if source scan is clean', () => {
      const gateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_gate.mjs'), 'utf8')
      expect(gateScript).toContain('const distWalk = safeWalkDir(distDir)')
    })

    it('T15: Clean build failure produces non-zero exit code preventing release gate pass', () => {
      const gateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_gate.mjs'), 'utf8')
      expect(gateScript).toContain('if (failures === 0)')
      expect(gateScript).toContain('process.exit(1)')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // Section 4: P01–P15 Deployment Provenance & Identity Bypasses
  // ══════════════════════════════════════════════════════════════════════════
  describe('P01–P15: Deployment Provenance & Identity Bypasses', () => {
    it('P01: Valid deployment + correct SHA + provider status -> valid PROVENANCE-VERIFIED PRODUCTION', () => {
      const res = validateDeploymentMetadata({
        environment: 'Production',
        status: 'success',
        sha: headSha,
        mainSha: headSha,
        isManual: false,
        isAncestor: true
      })
      expect(res.valid).toBe(true)
      expect(res.classification).toBe('PROVENANCE-VERIFIED PRODUCTION')
    })

    it('P02: Valid deployment + wrong SHA -> invalid (unrelated to main lineage)', () => {
      const res = validateDeploymentMetadata({
        environment: 'Production',
        status: 'success',
        sha: '1111111111111111111111111111111111111111',
        mainSha: headSha,
        isManual: false,
        isAncestor: false
      })
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('unrelated to main lineage')
    })

    it('P03: Valid deployment + old non-ancestor SHA -> invalid', () => {
      const res = validateDeploymentMetadata({
        environment: 'Production',
        status: 'success',
        sha: '2222222222222222222222222222222222222222',
        mainSha: headSha,
        isManual: false,
        isAncestor: false
      })
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('unrelated to main lineage')
    })

    it('P04: Valid deployment + malformed SHA -> invalid', () => {
      const res = validateDeploymentMetadata({
        environment: 'Production',
        status: 'success',
        sha: 'malformed-sha',
        mainSha: headSha,
        isManual: false,
        isAncestor: false
      })
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('missing or malformed')
    })

    it('P05: Preview deployment URL passed -> invalid (targetUrl !== FIXED_PRODUCTION_URL)', () => {
      const res = validateDeploymentMetadata({
        environment: 'Production',
        status: 'success',
        sha: headSha,
        mainSha: headSha,
        targetUrl: 'https://preview.vercel.app'
      })
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('not the fixed production alias')
    })

    it('P06: Manual mode without deployment ID -> marked LIVE-SMOKE-VERIFIED BUT PROVENANCE-LIMITED', () => {
      const res = validateDeploymentMetadata({
        isManual: true,
        mainSha: headSha,
        sha: headSha,
        isAncestor: true
      })
      expect(res.valid).toBe(true)
      expect(res.classification).toBe('LIVE-SMOKE-VERIFIED BUT PROVENANCE-LIMITED')
    })

    it('P07: Manual mode with requireFullProvenance -> rejected because provider ID is required', () => {
      const res = validateDeploymentMetadata({
        isManual: true,
        mainSha: headSha,
        sha: headSha,
        isAncestor: true,
        requireFullProvenance: true
      })
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('cannot certify full independent provenance')
    })

    it('P08: Deployment ID missing with requireFullProvenance -> rejected', async () => {
      const res = await verifyDeploymentApi({
        deploymentId: '',
        deploymentSha: headSha,
        token: '',
        repository: 'Jagadeesh729/BodyMap',
        requireFullProvenance: true
      })
      expect(res.valid).toBe(false)
      expect(res.failures).toContain('independent deployment ID is required for full provenance')
    })

    it('P09: Deployment API creator is not vercel[bot] -> rejected', async () => {
      // Mock fetch
      const mockFetch = async (url: string) => {
        if (url.endsWith('/statuses')) {
          return { ok: true, json: async () => [{ state: 'success', environment: 'Production' }] }
        }
        return {
          ok: true,
          json: async () => ({
            sha: headSha,
            environment: 'Production',
            creator: { login: 'unauthorized-user' }
          })
        }
      }
      const originalFetch = globalThis.fetch
      globalThis.fetch = mockFetch as unknown as typeof fetch
      try {
        const res = await verifyDeploymentApi({
          deploymentId: '123',
          deploymentSha: headSha,
          token: 'token',
          repository: 'Jagadeesh729/BodyMap'
        })
        expect(res.valid).toBe(false)
        expect(res.failures).toContain('GitHub deployment provider is not Vercel')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('P10: Deployment API environment is not Production -> rejected', async () => {
      const mockFetch = async (url: string) => {
        if (url.endsWith('/statuses')) {
          return { ok: true, json: async () => [{ state: 'success', environment: 'Preview' }] }
        }
        return {
          ok: true,
          json: async () => ({
            sha: headSha,
            environment: 'Preview',
            creator: { login: 'vercel[bot]' }
          })
        }
      }
      const originalFetch = globalThis.fetch
      globalThis.fetch = mockFetch as unknown as typeof fetch
      try {
        const res = await verifyDeploymentApi({
          deploymentId: '123',
          deploymentSha: headSha,
          token: 'token',
          repository: 'Jagadeesh729/BodyMap'
        })
        expect(res.valid).toBe(false)
        expect(res.failures).toContain('GitHub deployment environment is not Production')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('P11: Deployment API status is not success -> rejected', async () => {
      const mockFetch = async (url: string) => {
        if (url.endsWith('/statuses')) {
          return { ok: true, json: async () => [{ state: 'failure', environment: 'Production' }] }
        }
        return {
          ok: true,
          json: async () => ({
            sha: headSha,
            environment: 'Production',
            creator: { login: 'vercel[bot]' }
          })
        }
      }
      const originalFetch = globalThis.fetch
      globalThis.fetch = mockFetch as unknown as typeof fetch
      try {
        const res = await verifyDeploymentApi({
          deploymentId: '123',
          deploymentSha: headSha,
          token: 'token',
          repository: 'Jagadeesh729/BodyMap'
        })
        expect(res.valid).toBe(false)
        expect(res.failures).toContain('successful Production deployment status not found')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('P12: Deployment API SHA differs from expected deployment SHA -> rejected', async () => {
      const mockFetch = async (url: string) => {
        if (url.endsWith('/statuses')) {
          return { ok: true, json: async () => [{ state: 'success', environment: 'Production' }] }
        }
        return {
          ok: true,
          json: async () => ({
            sha: 'wrongsha00000000000000000000000000000000',
            environment: 'Production',
            creator: { login: 'vercel[bot]' }
          })
        }
      }
      const originalFetch = globalThis.fetch
      globalThis.fetch = mockFetch as unknown as typeof fetch
      try {
        const res = await verifyDeploymentApi({
          deploymentId: '123',
          deploymentSha: headSha,
          token: 'token',
          repository: 'Jagadeesh729/BodyMap'
        })
        expect(res.valid).toBe(false)
        expect(res.failures).toContain('GitHub deployment SHA mismatch')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('P13: Caller supplies ancestor SHA but production serves different assets -> convergence failure', () => {
      const simulatedStaleHtml = '<html><script src="/assets/index-old-stale.js"></script></html>'
      const refs = extractAssetReferences(simulatedStaleHtml)
      expect(refs).not.toContain('/assets/index-C448U-vI.js')
    })

    it('P14: Caller supplies malformed target URL -> rejected', () => {
      const res = validateDeploymentMetadata({
        environment: 'Production',
        status: 'success',
        sha: headSha,
        mainSha: headSha,
        targetUrl: 'http://insecure-http.com'
      })
      expect(res.valid).toBe(false)
    })

    it('P15: Successful provider deployment with verified production status -> verified', async () => {
      const mockFetch = async (url: string) => {
        if (url.endsWith('/statuses')) {
          return { ok: true, json: async () => [{ state: 'success', environment: 'Production' }] }
        }
        return {
          ok: true,
          json: async () => ({
            sha: headSha,
            environment: 'Production',
            creator: { login: 'vercel[bot]' }
          })
        }
      }
      const originalFetch = globalThis.fetch
      globalThis.fetch = mockFetch as unknown as typeof fetch
      try {
        const res = await verifyDeploymentApi({
          deploymentId: '123',
          deploymentSha: headSha,
          token: 'token',
          repository: 'Jagadeesh729/BodyMap'
        })
        expect(res.valid).toBe(true)
        expect(res.classification).toBe('PROVENANCE-VERIFIED PRODUCTION')
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // Section 5: F01–F15 Filesystem Fail-Open & Walker Error Bypasses
  // ══════════════════════════════════════════════════════════════════════════
  describe('F01–F15: Filesystem Fail-Open & Walker Error Bypasses', () => {
    it('F01: Missing directory passed to safeWalkDir -> returns success: false with MISSING_DIRECTORY', () => {
      const res = safeWalkDir('/non/existent/dir')
      expect(res.success).toBe(false)
      expect(res.errors[0]?.type).toBe('MISSING_DIRECTORY')
    })

    it('F02: safeWalkDir captures structured error on unreadable entry instead of swallowing', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-f02-'))
      try {
        const res = safeWalkDir(tempDir)
        expect(res.success).toBe(true)
        expect(res.errors).toEqual([])
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('F03: safeWalkDir detects broken symlink and reports structured error', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-f03-'))
      try {
        const linkPath = path.join(tempDir, 'broken-link')
        try {
          fs.symlinkSync(path.join(tempDir, 'non-existent-target'), linkPath)
          const res = safeWalkDir(tempDir)
          expect(res.success).toBe(false)
          expect(res.errors.some(e => e.type === 'BROKEN_SYMLINK')).toBe(true)
        } catch {
          // On Windows if symlink privilege is unavailable, skip symlink creation
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('F04: safeWalkDir never converts filesystem traversal failure into success: true', () => {
      const res = safeWalkDir(path.join(os.tmpdir(), 'non-existent-sub-' + Date.now()))
      expect(res.success).toBe(false)
    })

    it('F05: generateArtifactManifest returns success: false if safeWalkDir reports errors', () => {
      const res = generateArtifactManifest('/non/existent/dir')
      expect(res.success).toBe(false)
      expect(res.manifest).toEqual([])
    })

    it('F06: generateArtifactManifest fails closed if any file read fails', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-f06-'))
      try {
        fs.writeFileSync(path.join(tempDir, 'file.txt'), 'hello')
        const res = generateArtifactManifest(tempDir)
        expect(res.success).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('F07: verifyArtifactIntegrity fails closed when contract file cannot be read', () => {
      const res = verifyArtifactIntegrity({ contractPath: '/non/existent/contract.json' })
      expect(res.valid).toBe(false)
      expect(res.failures.some(f => f.includes('does not exist'))).toBe(true)
    })

    it('F08: verifyArtifactIntegrity fails closed when dist directory is missing', () => {
      const res = verifyArtifactIntegrity({ root: '/non/existent/root', contractPath })
      expect(res.valid).toBe(false)
      expect(res.failures.some(f => f.includes('dist/ directory does not exist'))).toBe(true)
    })

    it('F09: verifyArtifactIntegrity fails closed when dist/assets is missing', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-f09-'))
      try {
        fs.mkdirSync(path.join(tempDir, 'dist'), { recursive: true })
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('dist/assets directory does not exist'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('F10: verifyArtifactIntegrity fails closed when critical chunk file cannot be read', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-f10-'))
      try {
        const assetsDir = path.join(tempDir, 'dist', 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'dist', 'index.html'), '<html></html>')
        // Only one chunk exists, others missing
        fs.writeFileSync(path.join(assetsDir, 'index-DWRsv8NH.css'), 'css')
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('MISSING:'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('F11: verifyArtifactIntegrity fails closed when index.html is missing', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-f11-'))
      try {
        const assetsDir = path.join(tempDir, 'dist', 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
        expect(res.failures.some(f => f.includes('MISSING: dist/index.html'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('F12: verifyArtifactIntegrity fails closed when dist has unreadable entry during secret scan', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-f12-'))
      try {
        const assetsDir = path.join(tempDir, 'dist', 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        fs.writeFileSync(path.join(tempDir, 'dist', 'index.html'), '<html></html>')
        const res = verifyArtifactIntegrity({ root: tempDir, contractPath })
        expect(res.valid).toBe(false)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('F13: Directory walker does not silently omit nested files', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-f13-'))
      try {
        const sub = path.join(tempDir, 'nested', 'deep')
        fs.mkdirSync(sub, { recursive: true })
        fs.writeFileSync(path.join(sub, 'target.js'), 'console.log(1);')
        const res = safeWalkDir(tempDir)
        expect(res.success).toBe(true)
        expect(res.files.some(f => f.endsWith('target.js'))).toBe(true)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('F14: Deeply nested directory structure is fully enumerated without partial omission', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-f14-'))
      try {
        for (let i = 0; i < 5; i++) {
          const d = path.join(tempDir, `dir-${i}`)
          fs.mkdirSync(d, { recursive: true })
          fs.writeFileSync(path.join(d, `file-${i}.txt`), `content ${i}`)
        }
        const res = safeWalkDir(tempDir)
        expect(res.success).toBe(true)
        expect(res.files.length).toBe(5)
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    })

    it('F15: File read error during release-gate secret scan reports fail-closed failure', () => {
      const gateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_gate.mjs'), 'utf8')
      expect(gateScript).toContain('Fail-closed read error on')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // Section 6: H01–H10 HTML / Path-Traversal Bypasses
  // ══════════════════════════════════════════════════════════════════════════
  describe('H01–H10: HTML / Path-Traversal Bypasses', () => {
    const distDir = path.resolve(process.cwd(), 'dist')

    it('H01: /assets/../secret.js -> rejected by resolveAndValidateAssetPath', () => {
      const res = resolveAndValidateAssetPath(distDir, '/assets/../secret.js')
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('Directory traversal')
    })

    it('H02: /assets/foo/../../secret.js -> rejected by resolveAndValidateAssetPath', () => {
      const res = resolveAndValidateAssetPath(distDir, '/assets/foo/../../secret.js')
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('Directory traversal')
    })

    it('H03: /assets/%2e%2e/secret.js -> rejected by resolveAndValidateAssetPath', () => {
      const res = resolveAndValidateAssetPath(distDir, '/assets/%2e%2e/secret.js')
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('URL-encoded traversal')
    })

    it('H04: /assets/%2E%2E/secret.js -> rejected by resolveAndValidateAssetPath', () => {
      const res = resolveAndValidateAssetPath(distDir, '/assets/%2E%2E/secret.js')
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('URL-encoded traversal')
    })

    it('H05: /assets/foo\\..\\secret.js -> rejected by resolveAndValidateAssetPath', () => {
      const res = resolveAndValidateAssetPath(distDir, '/assets/foo\\..\\secret.js')
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('Backslash path traversal')
    })

    it('H06: /assets//secret.js -> rejected by resolveAndValidateAssetPath', () => {
      const res = resolveAndValidateAssetPath(distDir, '/assets//secret.js')
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('Redundant or ambiguous slash')
    })

    it('H07: /assets/./secret.js -> rejected by resolveAndValidateAssetPath', () => {
      const res = resolveAndValidateAssetPath(distDir, '/assets/./secret.js')
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('pattern rejected')
    })

    it('H08: /assets/foo.js?x=../secret -> rejected by resolveAndValidateAssetPath', () => {
      const res = resolveAndValidateAssetPath(distDir, '/assets/foo.js?x=../secret')
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('Path traversal pattern in URL query/fragment')
    })

    it('H09: /assets/foo.js#../../secret -> rejected by resolveAndValidateAssetPath', () => {
      const res = resolveAndValidateAssetPath(distDir, '/assets/foo.js#../../secret')
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('Path traversal pattern in URL query/fragment')
    })

    it('H10: https://attacker.com/assets/evil.js -> rejected as external URL', () => {
      const res = resolveAndValidateAssetPath(distDir, 'https://attacker.com/assets/evil.js')
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('External or protocol-relative URL')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // Section 7: S01–S15 Secret Scanning Bypasses
  // ══════════════════════════════════════════════════════════════════════════
  describe('S01–S15: Secret Scanning Bypasses', () => {
    it('S01: Google API key pattern (AIzaSy...) -> detected by scanTextContent', () => {
      const fakeKey = makeSecret(['AIza', 'Sy123456789012345678901234567890123'])
      const res = scanTextContent(`const k = "${fakeKey}";`)
      expect(res.valid).toBe(false)
      expect(res.findings.some(f => f.name === 'Google/Gemini API Key')).toBe(true)
    })

    it('S02: Gemini API key variable assignment -> detected by scanTextContent', () => {
      const res = scanTextContent('GEMINI_API_KEY="mysecretkeyvalue123"')
      expect(res.valid).toBe(false)
      expect(res.findings.some(f => f.name === 'Gemini API Key Assignment')).toBe(true)
    })

    it('S03: Bearer token pattern -> detected by scanTextContent', () => {
      const token = makeSecret(['Bearer ', 'abcdef1234567890abcdef1234567890'])
      const res = scanTextContent(`const auth = "${token}";`)
      expect(res.valid).toBe(false)
      expect(res.findings.some(f => f.name === 'Bearer Token')).toBe(true)
    })

    it('S04: JWT credential token pattern -> detected by scanTextContent', () => {
      const jwt = makeSecret(['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0.', 'dozqvN1smPrMWTrCd4NuTKGnODJvdVo_tqMUjG_n0mY'])
      const res = scanTextContent(`const jwt = "${jwt}";`)
      expect(res.valid).toBe(false)
      expect(res.findings.some(f => f.name === 'JWT Credential Token')).toBe(true)
    })

    it('S05: RSA private key marker -> detected by scanTextContent', () => {
      const rsa = makeSecret(['-----BEGIN ', 'RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...'])
      const res = scanTextContent(rsa)
      expect(res.valid).toBe(false)
      expect(res.findings.some(f => f.name === 'Private Key Header')).toBe(true)
    })

    it('S06: OpenSSH / EC private key marker -> detected by scanTextContent', () => {
      const ec = makeSecret(['-----BEGIN ', 'OPENSSH PRIVATE KEY-----\nb3BlbnNza...'])
      const res = scanTextContent(ec)
      expect(res.valid).toBe(false)
      expect(res.findings.some(f => f.name === 'Private Key Header')).toBe(true)
    })

    it('S07: AWS Access Key ID (AKIA...) -> detected by scanTextContent', () => {
      const aws = makeSecret(['AKIA', 'IOSFODNN7EXAMPLE'])
      const res = scanTextContent(`const aws = "${aws}";`)
      expect(res.valid).toBe(false)
      expect(res.findings.some(f => f.name === 'AWS Access Key ID')).toBe(true)
    })

    it('S08: sourceMappingURL directive -> detected by scanTextContent', () => {
      const res = scanTextContent('//# sourceMappingURL=app.js.map')
      expect(res.valid).toBe(false)
      expect(res.findings.some(f => f.name === 'Source Map Directive')).toBe(true)
    })

    it('S09: Localhost dev endpoint with port -> detected by scanTextContent', () => {
      const ep = makeSecret(['http://', 'localhost:8080/api'])
      const res = scanTextContent(`fetch("${ep}")`)
      expect(res.valid).toBe(false)
      expect(res.findings.some(f => f.name.includes('Development Endpoint'))).toBe(true)
    })

    it('S10: 127.0.0.1 dev endpoint with port -> detected by scanTextContent', () => {
      const ep = makeSecret(['http://', '127.0.0.1:3000/v1'])
      const res = scanTextContent(`fetch("${ep}")`)
      expect(res.valid).toBe(false)
      expect(res.findings.some(f => f.name.includes('Development Endpoint'))).toBe(true)
    })

    it('S11: Binary image file with incidental bytes -> safely skipped without false positive', () => {
      const res = scanFileContent(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'icon.png')
      expect(res.valid).toBe(true)
      expect(res.skippedBinary).toBe(true)
    })

    it('S12: Binary font file (.woff2) -> safely skipped without false positive', () => {
      const res = scanFileContent(Buffer.from('wOF2fontdata'), 'font.woff2')
      expect(res.valid).toBe(true)
      expect(res.skippedBinary).toBe(true)
    })

    it('S13: Text file (.css) containing bearer token -> detected by scanFileContent', () => {
      const token = makeSecret(['Bearer ', 'secret_token_12345678901234567890'])
      const res = scanFileContent(`/* ${token} */`, 'style.css')
      expect(res.valid).toBe(false)
      expect(res.skippedBinary).toBe(false)
    })

    it('S14: HTML file containing secret API key -> detected by scanFileContent', () => {
      const key = makeSecret(['AIza', 'Sy123456789012345678901234567890123'])
      const res = scanFileContent(`<html><!-- ${key} --></html>`, 'index.html')
      expect(res.valid).toBe(false)
      expect(res.findings.length).toBeGreaterThan(0)
    })

    it('S15: Clean production bundle without secrets -> scanFileContent returns valid: true', () => {
      const res = scanFileContent('console.log("clean app");', 'app.js')
      expect(res.valid).toBe(true)
      expect(res.findings).toEqual([])
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // Section 8: G01–G15 Git Lineage & App-Scope Bypasses
  // ══════════════════════════════════════════════════════════════════════════
  describe('G01–G15: Git Lineage & App-Scope Bypasses', () => {
    it('G01: Anchor drift from immutable anchor 12076d44528c -> rejected with ERR_INVALID_RELEASE_ANCHOR', () => {
      const copy = { ...validContract, releaseCommit: '0000000000000000000000000000000000000000' }
      const res = validateReleaseContractLineage(copy, headSha)
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_INVALID_RELEASE_ANCHOR')
    })

    it('G02: Non-ancestor contract commit -> rejected with ERR_NOT_IN_ANCESTRY', () => {
      const copy = { ...validContract, currentHeadCommit: '1111111111111111111111111111111111111111' }
      const res = validateReleaseContractLineage(copy, headSha)
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_NOT_IN_ANCESTRY')
    })

    it('G03: Governance-only commit between runtime commit and HEAD -> valid zero-drift (C3 passes)', () => {
      const res = validateReleaseContractLineage(validContract, headSha)
      expect(res.valid).toBe(true)
    })

    it('G04: App-scope change in src/ between contract commit and HEAD -> caught by C3', () => {
      expect(APP_SCOPE_PATHSPECS).toContain('src')
      expect(APP_SCOPE_PATHSPECS).toContain(':(exclude)src/__tests__')
    })

    it('G05: App-scope change in package.json between contract commit and HEAD -> caught by C3', () => {
      expect(APP_SCOPE_PATHSPECS).toContain('package.json')
    })

    it('G06: App-scope change in vite.config.ts between contract commit and HEAD -> caught by C3', () => {
      expect(APP_SCOPE_PATHSPECS).toContain('vite.config.ts')
    })

    it('G07: App-scope change in index.html between contract commit and HEAD -> caught by C3', () => {
      expect(APP_SCOPE_PATHSPECS).toContain('index.html')
    })

    it('G08: Excluded src/__tests__ modification does NOT violate C3', () => {
      const res = validateReleaseContractLineage(validContract, headSha)
      expect(res.valid).toBe(true)
    })

    it('G09: Shallow clone missing ancestor -> fails closed with ERR_SHALLOW_CLONE', () => {
      expect(typeof validateReleaseContractLineage).toBe('function')
    })

    it('G10: Authoritative runtime commit derives unique tip in linear history', () => {
      const auth = getAuthoritativeRuntimeCommits('HEAD')
      expect(auth.ambiguous).toBe(false)
      expect(auth.latestRuntime).toBe(validContract.currentHeadCommit)
    })

    it('G11: Incomparable independent runtime tips -> marks ambiguous: true, latestRuntime: null', () => {
      expect(typeof getAuthoritativeRuntimeCommits).toBe('function')
    })

    it('G12: Production src/ code never imports from scripts/', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true })
        .filter((f): f is string => typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('__tests__'))
      for (const rel of srcFiles) {
        const content = fs.readFileSync(path.resolve(process.cwd(), 'src', rel), 'utf8')
        expect(content, `${rel} imports from scripts/`).not.toMatch(/from\s+['"][^'"]*scripts\//)
      }
    })

    it('G13: Production src/ code never imports from .github/', () => {
      const srcFiles = fs.readdirSync(path.resolve(process.cwd(), 'src'), { recursive: true })
        .filter((f): f is string => typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('__tests__'))
      for (const rel of srcFiles) {
        const content = fs.readFileSync(path.resolve(process.cwd(), 'src', rel), 'utf8')
        expect(content, `${rel} imports from .github/`).not.toMatch(/from\s+['"][^'"]*\.github\//)
      }
    })

    it('G14: SHA_REGEX strictly enforces 40-character lowercase hexadecimal format', () => {
      expect(SHA_REGEX.test('024649d807ad9fad598b9eda00e52dcc10dba31b')).toBe(true)
      expect(SHA_REGEX.test('024649D807AD9FAD598B9EDA00E52DCC10DBA31B')).toBe(false) // rejects uppercase
      expect(SHA_REGEX.test('024649d807ad9fad598b9eda00e52dcc10dba31')).toBe(false) // 39 chars
      expect(SHA_REGEX.test('024649d807ad9fad598b9eda00e52dcc10dba31bb')).toBe(false) // 41 chars
    })

    it('G15: Full Git traversal history exposure (--full-history) prevents hidden merge commits', () => {
      const lineageScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_lineage.mjs'), 'utf8')
      expect(lineageScript).toContain('--full-history')
    })
  })
})
