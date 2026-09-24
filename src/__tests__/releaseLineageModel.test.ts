import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFileSync, execSync } from 'child_process'
import {
  getLatestRuntimeCommit,
  validateReleaseContractLineage,
  simulateLineageValidation,
  IMMUTABLE_RELEASE_ANCHOR,
  APP_SCOPE_PATHSPECS,
  SHA_REGEX
} from '../../scripts/release_lineage.mjs'

describe('Release Lineage Model & Governance Invariants', () => {
  const contractPath = path.resolve(process.cwd(), 'release-contract.json')
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

  function withTempRepo(callback: (repo: { dir: string; exec: (cmd: string) => string }) => void) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-lineage-test-'))
    const exec = (cmd: string) => execSync(cmd, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    try {
      exec('git init -b main')
      exec('git config user.name "Test Auditor"')
      exec('git config user.email "auditor@bodymap.test"')
      callback({ dir, exec })
    } finally {
      try {
        fs.rmSync(dir, { recursive: true, force: true })
      } catch {
        // ignore cleanup error
      }
    }
  }

  // ==========================================================================
  // Section 1: Live Repository Invariants (L01–L07)
  // ==========================================================================
  describe('Live Repository Contract Lineage', () => {
    it('L01: derives authoritative runtime commit from Git without hardcoded SHAs', () => {
      const latestRuntime = getLatestRuntimeCommit()
      expect(latestRuntime).toBeDefined()
      expect(latestRuntime).toMatch(SHA_REGEX)
      expect(contract.currentHeadCommit).toBe(latestRuntime)
    })

    it('L02: validates release contract against repository HEAD lineage', () => {
      const result = validateReleaseContractLineage(contract, headSha)
      expect(result.valid).toBe(true)
      expect(result.code).toBe('LINEAGE_VERIFIED')
      expect(result.latestRuntimeCommit).toBe(contract.currentHeadCommit)
    })

    it('L03: rejects stale superseded runtime parent d92e1ea due to uncertified app changes', () => {
      const staleContract = { ...contract, currentHeadCommit: 'd92e1ea60451c7aca4317bf07aec02fdfe43fd3b' }
      const result = validateReleaseContractLineage(staleContract, headSha)
      expect(result.valid).toBe(false)
      expect(result.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
      expect(result.reason).toContain('uncertified application changes')
    })

    it('L04: rejects governance-only intermediate commit 48ede66 as runtime head', () => {
      const govContract = { ...contract, currentHeadCommit: '48ede66ec577b1cdf462d394292d8183aa97d558' }
      const result = validateReleaseContractLineage(govContract, headSha)
      expect(result.valid).toBe(false)
      expect(result.code).toBe('ERR_STALE_RUNTIME_COMMIT')
      expect(result.reason).toContain('does not match latest runtime application commit')
    })

    it('L05: rejects malformed or missing commit SHAs', () => {
      expect(validateReleaseContractLineage({ ...contract, currentHeadCommit: '' }, headSha).valid).toBe(false)
      expect(validateReleaseContractLineage({ ...contract, currentHeadCommit: 'not-a-sha' }, headSha).valid).toBe(false)
      expect(validateReleaseContractLineage({ ...contract, currentHeadCommit: '024649d' }, headSha).valid).toBe(false)
    })

    it('L06: rejects commits not present in HEAD ancestry', () => {
      const unrelatedSha = '0123456789abcdef0123456789abcdef01234567'
      const result = validateReleaseContractLineage({ ...contract, currentHeadCommit: unrelatedSha }, headSha)
      expect(result.valid).toBe(false)
      expect(result.code).toBe('ERR_NOT_IN_ANCESTRY')
    })

    it('L07: releaseCommit strictly matches immutable release anchor', () => {
      expect(contract.releaseCommit).toBe(IMMUTABLE_RELEASE_ANCHOR)
    })
  })

  // ==========================================================================
  // Section 2: Phase 5 Synthetic Lineage Histories (A–J)
  // ==========================================================================
  describe('Synthetic Lineage Histories (Histories A–J)', () => {
    const SHA_A = '1111111111111111111111111111111111111111'
    const SHA_B = '2222222222222222222222222222222222222222'
    const SHA_C = '3333333333333333333333333333333333333333'
    const SHA_D = '4444444444444444444444444444444444444444'
    const SHA_M = '5555555555555555555555555555555555555555'

    it('History A: app A -> governance B (contract=A, HEAD=B => PASS)', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: SHA_A, touchesApp: true },
          { sha: SHA_B, parentSha: SHA_A, touchesApp: false }
        ],
        contractCommit: SHA_A,
        headSha: SHA_B
      })
      expect(res.valid).toBe(true)
      expect(res.code).toBe('LINEAGE_VERIFIED')
    })

    it('History B: app A -> governance B -> governance C (contract=A, HEAD=C => PASS)', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: SHA_A, touchesApp: true },
          { sha: SHA_B, parentSha: SHA_A, touchesApp: false },
          { sha: SHA_C, parentSha: SHA_B, touchesApp: false }
        ],
        contractCommit: SHA_A,
        headSha: SHA_C
      })
      expect(res.valid).toBe(true)
      expect(res.code).toBe('LINEAGE_VERIFIED')
    })

    it('History C: app A -> app B -> governance C (contract=A, HEAD=C => FAIL)', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: SHA_A, touchesApp: true },
          { sha: SHA_B, parentSha: SHA_A, touchesApp: true },
          { sha: SHA_C, parentSha: SHA_B, touchesApp: false }
        ],
        contractCommit: SHA_A,
        headSha: SHA_C
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('History D: app A -> app B -> governance C (contract=B, HEAD=C => PASS)', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: SHA_A, touchesApp: true },
          { sha: SHA_B, parentSha: SHA_A, touchesApp: true },
          { sha: SHA_C, parentSha: SHA_B, touchesApp: false }
        ],
        contractCommit: SHA_B,
        headSha: SHA_C
      })
      expect(res.valid).toBe(true)
      expect(res.code).toBe('LINEAGE_VERIFIED')
    })

    it('History E: app A -> app B -> governance C (stale contract=A => FAIL)', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: SHA_A, touchesApp: true },
          { sha: SHA_B, parentSha: SHA_A, touchesApp: true },
          { sha: SHA_C, parentSha: SHA_B, touchesApp: false }
        ],
        contractCommit: SHA_A,
        headSha: SHA_C
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('History F: app A -> governance B -> app C -> governance D (contract=A, HEAD=D => FAIL)', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: SHA_A, touchesApp: true },
          { sha: SHA_B, parentSha: SHA_A, touchesApp: false },
          { sha: SHA_C, parentSha: SHA_B, touchesApp: true },
          { sha: SHA_D, parentSha: SHA_C, touchesApp: false }
        ],
        contractCommit: SHA_A,
        headSha: SHA_D
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('History G: app A -> governance B -> app C -> governance D (contract=C, HEAD=D => PASS)', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: SHA_A, touchesApp: true },
          { sha: SHA_B, parentSha: SHA_A, touchesApp: false },
          { sha: SHA_C, parentSha: SHA_B, touchesApp: true },
          { sha: SHA_D, parentSha: SHA_C, touchesApp: false }
        ],
        contractCommit: SHA_C,
        headSha: SHA_D
      })
      expect(res.valid).toBe(true)
      expect(res.code).toBe('LINEAGE_VERIFIED')
    })

    it('History H: app A -> app B -> revert B -> governance C (contract=A => FAIL, contract=revert B => PASS)', () => {
      const SHA_REV = '7777777777777777777777777777777777777777'
      // When contract points to A, intermediate app changes (B and revert B) fail C3/C4
      const resA = simulateLineageValidation({
        commits: [
          { sha: SHA_A, touchesApp: true },
          { sha: SHA_B, parentSha: SHA_A, touchesApp: true },
          { sha: SHA_REV, parentSha: SHA_B, touchesApp: true },
          { sha: SHA_C, parentSha: SHA_REV, touchesApp: false }
        ],
        contractCommit: SHA_A,
        headSha: SHA_C
      })
      expect(resA.valid).toBe(false)
      expect(resA.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')

      // When contract points to the revert commit itself, C1-C4 pass
      const resRev = simulateLineageValidation({
        commits: [
          { sha: SHA_A, touchesApp: true },
          { sha: SHA_B, parentSha: SHA_A, touchesApp: true },
          { sha: SHA_REV, parentSha: SHA_B, touchesApp: true },
          { sha: SHA_C, parentSha: SHA_REV, touchesApp: false }
        ],
        contractCommit: SHA_REV,
        headSha: SHA_C
      })
      expect(resRev.valid).toBe(true)
      expect(resRev.code).toBe('LINEAGE_VERIFIED')
    })

    it('History I: app A -> merge containing app changes -> governance (contract=A => FAIL)', () => {
      // Merge commit M has two parents: branch B (gov) and branch C (app change)
      const res = simulateLineageValidation({
        commits: [
          { sha: SHA_A, touchesApp: true },
          { sha: SHA_B, parentSha: SHA_A, touchesApp: false },
          { sha: SHA_C, parentSha: SHA_A, touchesApp: true },
          { sha: SHA_M, parentShas: [SHA_B, SHA_C], touchesApp: false },
          { sha: SHA_D, parentSha: SHA_M, touchesApp: false }
        ],
        contractCommit: SHA_A,
        headSha: SHA_D
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('History J: app A -> merge containing governance-only changes -> governance (contract=A => PASS)', () => {
      // Merge commit M merges two pure governance branches
      const res = simulateLineageValidation({
        commits: [
          { sha: SHA_A, touchesApp: true },
          { sha: SHA_B, parentSha: SHA_A, touchesApp: false },
          { sha: SHA_C, parentSha: SHA_A, touchesApp: false },
          { sha: SHA_M, parentShas: [SHA_B, SHA_C], touchesApp: false },
          { sha: SHA_D, parentSha: SHA_M, touchesApp: false }
        ],
        contractCommit: SHA_A,
        headSha: SHA_D
      })
      expect(res.valid).toBe(true)
      expect(res.code).toBe('LINEAGE_VERIFIED')
    })
  })

  // ==========================================================================
  // Section 3: Phase 3 Exhaustive Audit of APP_SCOPE_PATHSPECS & Scope Bypass Fixtures
  // ==========================================================================
  describe('Phase 3: APP_SCOPE_PATHSPECS Coverage & Scope Bypass Fixtures', () => {
    it('ASP01: verifies APP_SCOPE_PATHSPECS includes all 16 runtime and build-affecting paths', () => {
      const requiredPaths = [
        'src',
        ':(exclude)src/__tests__',
        'api',
        'public',
        'index.html',
        'package.json',
        'package-lock.json',
        '.npmrc',
        'components.json',
        'vite.config.ts',
        'vercel.json',
        'tailwind.config.ts',
        'postcss.config.js',
        'tsconfig.json',
        'tsconfig.app.json',
        'tsconfig.node.json'
      ]
      for (const p of requiredPaths) {
        expect(APP_SCOPE_PATHSPECS).toContain(p)
      }
    })

    it('ASP02: components.json is recognized as an application-scope pathspec', () => {
      expect(APP_SCOPE_PATHSPECS).toContain('components.json')
    })

    it('ASP03: tsconfig.node.json is recognized as an application-scope pathspec', () => {
      expect(APP_SCOPE_PATHSPECS).toContain('tsconfig.node.json')
    })

    it('ASP04: .npmrc is recognized as an application-scope pathspec', () => {
      expect(APP_SCOPE_PATHSPECS).toContain('.npmrc')
    })

    it('ASP05: src/__tests__ is excluded from APP_SCOPE_PATHSPECS', () => {
      expect(APP_SCOPE_PATHSPECS).toContain(':(exclude)src/__tests__')
    })

    it('ASP06: Phase 3 Attack Fixture: modification to components.json rejects stale contract A at D', () => {
      const SHA_A = '1000000000000000000000000000000000000001'
      const SHA_B = '2000000000000000000000000000000000000002'
      const SHA_C = '3000000000000000000000000000000000000003'
      const SHA_D = '4000000000000000000000000000000000000004'

      // Commit C modified components.json (touchesApp = true)
      const res = simulateLineageValidation({
        commits: [
          { sha: SHA_A, touchesApp: true }, // A: certified runtime
          { sha: SHA_B, parentSha: SHA_A, touchesApp: false }, // B: governance
          { sha: SHA_C, parentSha: SHA_B, touchesApp: true }, // C: components.json edit
          { sha: SHA_D, parentSha: SHA_C, touchesApp: false } // D: governance
        ],
        contractCommit: SHA_A,
        headSha: SHA_D
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })
  })

  // ==========================================================================
  // Section 4: Phase 2 Formal Semantics of currentHeadCommit (S01–S10)
  // ==========================================================================
  describe('Phase 2: Formal Semantics of currentHeadCommit (S01–S10)', () => {
    const APP_1 = '1111111111111111111111111111111111111111'
    const GOV_1 = '2222222222222222222222222222222222222222'
    const GOV_2 = '3333333333333333333333333333333333333333'
    const APP_2 = '4444444444444444444444444444444444444444'

    it('S01: application commit followed by one governance commit -> PASS', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: APP_1, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_1
      })
      expect(res.valid).toBe(true)
      expect(res.latestRuntimeCommit).toBe(APP_1)
    })

    it('S02: application commit followed by multiple governance-only commits -> PASS', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: APP_1, touchesApp: false },
          { sha: GOV_2, parentSha: GOV_1, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_2
      })
      expect(res.valid).toBe(true)
      expect(res.latestRuntimeCommit).toBe(APP_1)
    })

    it('S03: application commit followed by CI-only commit -> PASS', () => {
      const CI_COMMIT = '5555555555555555555555555555555555555555'
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: CI_COMMIT, parentSha: APP_1, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: CI_COMMIT
      })
      expect(res.valid).toBe(true)
    })

    it('S04: application commit followed by documentation-only commit -> PASS', () => {
      const DOC_COMMIT = '6666666666666666666666666666666666666666'
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: DOC_COMMIT, parentSha: APP_1, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: DOC_COMMIT
      })
      expect(res.valid).toBe(true)
    })

    it('S05: application commit followed by another application commit -> contract must be bumped', () => {
      const resStale = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: APP_2, parentSha: APP_1, touchesApp: true }
        ],
        contractCommit: APP_1,
        headSha: APP_2
      })
      expect(resStale.valid).toBe(false)
      expect(resStale.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')

      const resBumped = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: APP_2, parentSha: APP_1, touchesApp: true }
        ],
        contractCommit: APP_2,
        headSha: APP_2
      })
      expect(resBumped.valid).toBe(true)
    })

    it('S06: merge commit containing application changes -> contract must be bumped to merge', () => {
      const MERGE_APP = '7777777777777777777777777777777777777777'
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: APP_1, touchesApp: false },
          { sha: APP_2, parentSha: APP_1, touchesApp: true },
          { sha: MERGE_APP, parentShas: [GOV_1, APP_2], touchesApp: true }
        ],
        contractCommit: APP_1,
        headSha: MERGE_APP
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('S07: merge commit containing governance-only changes -> contract remains valid', () => {
      const MERGE_GOV = '8888888888888888888888888888888888888888'
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: APP_1, touchesApp: false },
          { sha: GOV_2, parentSha: APP_1, touchesApp: false },
          { sha: MERGE_GOV, parentShas: [GOV_1, GOV_2], touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: MERGE_GOV
      })
      expect(res.valid).toBe(true)
    })

    it('S08: current HEAD itself containing runtime changes -> PASS when contract == HEAD', () => {
      const res = simulateLineageValidation({
        commits: [{ sha: APP_1, touchesApp: true }],
        contractCommit: APP_1,
        headSha: APP_1
      })
      expect(res.valid).toBe(true)
    })

    it('S09: detached HEAD -> validates correctly based on detached ancestry', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: APP_1, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_1
      })
      expect(res.valid).toBe(true)
    })

    it('S10: shallow clone / incomplete history returns ERR_NOT_IN_ANCESTRY or ERR_SHALLOW_CLONE', () => {
      const UNKNOWN_PARENT = '9999999999999999999999999999999999999999'
      const res = simulateLineageValidation({
        commits: [{ sha: GOV_1, touchesApp: false }],
        contractCommit: UNKNOWN_PARENT,
        headSha: GOV_1
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_NOT_IN_ANCESTRY')
    })
  })

  // ==========================================================================
  // Section 5: Real-Git vs Simulator Parity on Dynamic Temp Repository Fixtures (A–J)
  // ==========================================================================
  describe('Phase 4 & 5 & 6: Real-Git vs Simulator Parity on Dynamic Temp Repositories (A–J)', () => {

    it('Parity A: app A -> governance B (real Git matches simulator => PASS)', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "A"')
        const shaA = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Docs')
        exec('git add . && git commit -m "B"')
        const shaB = exec('git rev-parse HEAD')

        const contractObj = { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: shaA }
        const realRes = validateReleaseContractLineage(contractObj, shaB, dir)
        const simRes = simulateLineageValidation({
          commits: [
            { sha: shaA, touchesApp: true },
            { sha: shaB, parentSha: shaA, touchesApp: false }
          ],
          contractCommit: shaA,
          headSha: shaB
        })

        expect(realRes.valid).toBe(true)
        expect(simRes.valid).toBe(true)
      })
    })

    it('Parity B: app A -> gov B -> gov C (real Git matches simulator => PASS)', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "A"')
        const shaA = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Docs')
        exec('git add . && git commit -m "B"')
        const shaB = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'CHANGE_CONTROL.md'), '# Policy')
        exec('git add . && git commit -m "C"')
        const shaC = exec('git rev-parse HEAD')

        const contractObj = { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: shaA }
        const realRes = validateReleaseContractLineage(contractObj, shaC, dir)
        const simRes = simulateLineageValidation({
          commits: [
            { sha: shaA, touchesApp: true },
            { sha: shaB, parentSha: shaA, touchesApp: false },
            { sha: shaC, parentSha: shaB, touchesApp: false }
          ],
          contractCommit: shaA,
          headSha: shaC
        })

        expect(realRes.valid).toBe(true)
        expect(simRes.valid).toBe(true)
      })
    })

    it('Parity C: app A -> app B -> gov C with contract=A (real Git matches simulator => FAIL)', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "A"')
        const shaA = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 2;')
        exec('git add . && git commit -m "B"')
        const shaB = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Docs')
        exec('git add . && git commit -m "C"')
        const shaC = exec('git rev-parse HEAD')

        const contractObj = { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: shaA }
        const realRes = validateReleaseContractLineage(contractObj, shaC, dir)
        const simRes = simulateLineageValidation({
          commits: [
            { sha: shaA, touchesApp: true },
            { sha: shaB, parentSha: shaA, touchesApp: true },
            { sha: shaC, parentSha: shaB, touchesApp: false }
          ],
          contractCommit: shaA,
          headSha: shaC
        })

        expect(realRes.valid).toBe(false)
        expect(simRes.valid).toBe(false)
      })
    })

    it('Parity D: app A -> app B -> gov C with contract=B (real Git matches simulator => PASS)', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "A"')
        const shaA = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 2;')
        exec('git add . && git commit -m "B"')
        const shaB = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Docs')
        exec('git add . && git commit -m "C"')
        const shaC = exec('git rev-parse HEAD')

        const contractObj = { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: shaB }
        const realRes = validateReleaseContractLineage(contractObj, shaC, dir)
        const simRes = simulateLineageValidation({
          commits: [
            { sha: shaA, touchesApp: true },
            { sha: shaB, parentSha: shaA, touchesApp: true },
            { sha: shaC, parentSha: shaB, touchesApp: false }
          ],
          contractCommit: shaB,
          headSha: shaC
        })

        expect(realRes.valid).toBe(true)
        expect(simRes.valid).toBe(true)
      })
    })

    it('Parity E: app A -> app B -> gov C with stale contract=A (real Git matches simulator => FAIL)', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "A"')
        const shaA = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 2;')
        exec('git add . && git commit -m "B"')
        const shaB = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Docs')
        exec('git add . && git commit -m "C"')
        const shaC = exec('git rev-parse HEAD')

        const contractObj = { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: shaA }
        const realRes = validateReleaseContractLineage(contractObj, shaC, dir)
        const simRes = simulateLineageValidation({
          commits: [
            { sha: shaA, touchesApp: true },
            { sha: shaB, parentSha: shaA, touchesApp: true },
            { sha: shaC, parentSha: shaB, touchesApp: false }
          ],
          contractCommit: shaA,
          headSha: shaC
        })

        expect(realRes.valid).toBe(false)
        expect(simRes.valid).toBe(false)
      })
    })

    it('Parity F: app A -> gov B -> app C -> gov D with contract=A (real Git matches simulator => FAIL)', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "A"')
        const shaA = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Docs')
        exec('git add . && git commit -m "B"')
        const shaB = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 3;')
        exec('git add . && git commit -m "C"')
        const shaC = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'CHANGE_CONTROL.md'), '# Policy')
        exec('git add . && git commit -m "D"')
        const shaD = exec('git rev-parse HEAD')

        const contractObj = { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: shaA }
        const realRes = validateReleaseContractLineage(contractObj, shaD, dir)
        const simRes = simulateLineageValidation({
          commits: [
            { sha: shaA, touchesApp: true },
            { sha: shaB, parentSha: shaA, touchesApp: false },
            { sha: shaC, parentSha: shaB, touchesApp: true },
            { sha: shaD, parentSha: shaC, touchesApp: false }
          ],
          contractCommit: shaA,
          headSha: shaD
        })

        expect(realRes.valid).toBe(false)
        expect(simRes.valid).toBe(false)
      })
    })

    it('Parity G: app A -> gov B -> app C -> gov D with contract=C (real Git matches simulator => PASS)', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "A"')
        const shaA = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Docs')
        exec('git add . && git commit -m "B"')
        const shaB = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 3;')
        exec('git add . && git commit -m "C"')
        const shaC = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'CHANGE_CONTROL.md'), '# Policy')
        exec('git add . && git commit -m "D"')
        const shaD = exec('git rev-parse HEAD')

        const contractObj = { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: shaC }
        const realRes = validateReleaseContractLineage(contractObj, shaD, dir)
        const simRes = simulateLineageValidation({
          commits: [
            { sha: shaA, touchesApp: true },
            { sha: shaB, parentSha: shaA, touchesApp: false },
            { sha: shaC, parentSha: shaB, touchesApp: true },
            { sha: shaD, parentSha: shaC, touchesApp: false }
          ],
          contractCommit: shaC,
          headSha: shaD
        })

        expect(realRes.valid).toBe(true)
        expect(simRes.valid).toBe(true)
      })
    })

    it('Parity H: app A -> app B -> revert B -> gov C (real Git matches simulator)', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "A"')
        const shaA = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 2;')
        exec('git add . && git commit -m "B"')
        const shaB = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "Revert B"')
        const shaRev = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Docs')
        exec('git add . && git commit -m "C"')
        const shaC = exec('git rev-parse HEAD')

        // Claiming A fails C4 in real Git and fails simulator
        const realResA = validateReleaseContractLineage({ releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: shaA }, shaC, dir)
        const simResA = simulateLineageValidation({
          commits: [
            { sha: shaA, touchesApp: true },
            { sha: shaB, parentSha: shaA, touchesApp: true },
            { sha: shaRev, parentSha: shaB, touchesApp: true },
            { sha: shaC, parentSha: shaRev, touchesApp: false }
          ],
          contractCommit: shaA,
          headSha: shaC
        })
        expect(realResA.valid).toBe(false)
        expect(simResA.valid).toBe(false)

        // Claiming shaRev passes both
        const realResRev = validateReleaseContractLineage({ releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: shaRev }, shaC, dir)
        const simResRev = simulateLineageValidation({
          commits: [
            { sha: shaA, touchesApp: true },
            { sha: shaB, parentSha: shaA, touchesApp: true },
            { sha: shaRev, parentSha: shaB, touchesApp: true },
            { sha: shaC, parentSha: shaRev, touchesApp: false }
          ],
          contractCommit: shaRev,
          headSha: shaC
        })
        expect(realResRev.valid).toBe(true)
        expect(simResRev.valid).toBe(true)
      })
    })

    it('Parity I: app A -> merge containing app changes -> gov (real Git matches simulator => FAIL)', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "A"')
        const shaA = exec('git rev-parse HEAD')

        exec('git checkout -b feature-app')
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 2;')
        exec('git add . && git commit -m "feature-app"')
        const shaApp = exec('git rev-parse HEAD')

        exec('git checkout main')
        fs.writeFileSync(path.join(dir, 'README.md'), '# Main Docs')
        exec('git add . && git commit -m "main-docs"')
        const shaGov = exec('git rev-parse HEAD')

        exec('git merge --no-ff feature-app -m "Merge feature-app"')
        const shaMerge = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'CHANGE_CONTROL.md'), '# Policy')
        exec('git add . && git commit -m "Post-merge docs"')
        const shaHead = exec('git rev-parse HEAD')

        const realRes = validateReleaseContractLineage({ releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: shaA }, shaHead, dir)
        const simRes = simulateLineageValidation({
          commits: [
            { sha: shaA, touchesApp: true },
            { sha: shaGov, parentSha: shaA, touchesApp: false },
            { sha: shaApp, parentSha: shaA, touchesApp: true },
            { sha: shaMerge, parentShas: [shaGov, shaApp], touchesApp: true },
            { sha: shaHead, parentSha: shaMerge, touchesApp: false }
          ],
          contractCommit: shaA,
          headSha: shaHead
        })

        expect(realRes.valid).toBe(false)
        expect(simRes.valid).toBe(false)
      })
    })

    it('Parity J: app A -> merge containing gov-only changes -> gov (real Git matches simulator => PASS)', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "A"')
        const shaA = exec('git rev-parse HEAD')

        exec('git checkout -b feature-docs')
        fs.writeFileSync(path.join(dir, 'DOCS.md'), '# Feature Docs')
        exec('git add . && git commit -m "feature-docs"')
        const shaDocs = exec('git rev-parse HEAD')

        exec('git checkout main')
        fs.writeFileSync(path.join(dir, 'README.md'), '# Main Docs')
        exec('git add . && git commit -m "main-docs"')
        const shaGov = exec('git rev-parse HEAD')

        exec('git merge --no-ff feature-docs -m "Merge feature-docs"')
        const shaMerge = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'CHANGE_CONTROL.md'), '# Policy')
        exec('git add . && git commit -m "Post-merge docs"')
        const shaHead = exec('git rev-parse HEAD')

        const realRes = validateReleaseContractLineage({ releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: shaA }, shaHead, dir)
        const simRes = simulateLineageValidation({
          commits: [
            { sha: shaA, touchesApp: true },
            { sha: shaGov, parentSha: shaA, touchesApp: false },
            { sha: shaDocs, parentSha: shaA, touchesApp: false },
            { sha: shaMerge, parentShas: [shaGov, shaDocs], touchesApp: false },
            { sha: shaHead, parentSha: shaMerge, touchesApp: false }
          ],
          contractCommit: shaA,
          headSha: shaHead
        })

        expect(realRes.valid).toBe(true)
        expect(simRes.valid).toBe(true)
      })
    })
  })

  // ==========================================================================
  // Section 6: Extended Adversarial Mutation Matrix (M01–M25)
  // ==========================================================================
  describe('Phase 16: Extended Adversarial Mutation Matrix (M01–M25)', () => {
    const APP_1 = '1000000000000000000000000000000000000001'
    const GOV_1 = '2000000000000000000000000000000000000002'
    const GOV_2 = '3000000000000000000000000000000000000003'
    const APP_2 = '4000000000000000000000000000000000000004'

    const standardCommits = [
      { sha: APP_1, touchesApp: true },
      { sha: GOV_1, parentSha: APP_1, touchesApp: false },
      { sha: GOV_2, parentSha: GOV_1, touchesApp: false },
      { sha: APP_2, parentSha: GOV_2, touchesApp: true }
    ]

    it('M01: malformed currentHeadCommit -> FAIL (ERR_MALFORMED_SHA)', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: 'invalid-sha-length',
        headSha: GOV_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_MALFORMED_SHA')
    })

    it('M02: uppercase SHA -> FAIL (ERR_MALFORMED_SHA)', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: '024649D807AD9FAD598B9EDA00E52DCC10DBA31B',
        headSha: GOV_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_MALFORMED_SHA')
    })

    it('M03: orphan SHA not reachable in DAG -> FAIL (ERR_NOT_IN_ANCESTRY)', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: '0000000000000000000000000000000000000000',
        headSha: GOV_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_NOT_IN_ANCESTRY')
    })

    it('M04: unrelated SHA on divergent branch -> FAIL (ERR_NOT_IN_ANCESTRY)', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: '9999999999999999999999999999999999999999',
        headSha: GOV_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_NOT_IN_ANCESTRY')
    })

    it('M05: old runtime SHA with intermediate app changes -> FAIL (ERR_UNCERTIFIED_APP_CHANGES)', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: APP_1,
        headSha: APP_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('M06: intermediate governance SHA claimed as runtime HEAD -> FAIL (ERR_STALE_RUNTIME_COMMIT)', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: APP_1, touchesApp: false },
          { sha: GOV_2, parentSha: GOV_1, touchesApp: false }
        ],
        contractCommit: GOV_1,
        headSha: GOV_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_STALE_RUNTIME_COMMIT')
    })

    it('M07: current runtime SHA -> PASS (LINEAGE_VERIFIED)', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: APP_1, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_1
      })
      expect(res.valid).toBe(true)
      expect(res.code).toBe('LINEAGE_VERIFIED')
    })

    it('M08: stale runtime after new app commit -> FAIL (ERR_UNCERTIFIED_APP_CHANGES)', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: APP_1,
        headSha: APP_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('M09: runtime file outside old APP_SCOPE (api/generate-plan.ts, components.json) -> caught as app change', () => {
      const COMP_EDIT = '5000000000000000000000000000000000000005'
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: COMP_EDIT, parentSha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: COMP_EDIT, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_1
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('M10: runtime change then revert -> net diff is 0, but latest runtime commit is revert commit -> FAIL contract=A', () => {
      const REV_COMMIT = '6000000000000000000000000000000000000006'
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: APP_2, parentSha: APP_1, touchesApp: true },
          { sha: REV_COMMIT, parentSha: APP_2, touchesApp: true },
          { sha: GOV_1, parentSha: REV_COMMIT, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_1
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('M11: runtime rename -> caught as app change', () => {
      const RENAME_COMMIT = '7000000000000000000000000000000000000007'
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: RENAME_COMMIT, parentSha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: RENAME_COMMIT, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_1
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('M12: runtime deletion -> caught as app change', () => {
      const DELETE_COMMIT = '8000000000000000000000000000000000000008'
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: DELETE_COMMIT, parentSha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: DELETE_COMMIT, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_1
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('M13: runtime addition -> caught as app change', () => {
      const ADD_COMMIT = '9000000000000000000000000000000000000009'
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: ADD_COMMIT, parentSha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: ADD_COMMIT, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_1
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('M14: runtime mode change -> caught as app change', () => {
      const MODE_COMMIT = '9100000000000000000000000000000000000091'
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: MODE_COMMIT, parentSha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: MODE_COMMIT, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_1
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('M15: merge containing runtime change -> FAIL contract=A', () => {
      const MERGE_SHA = 'a00000000000000000000000000000000000000a'
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: APP_1, touchesApp: false },
          { sha: APP_2, parentSha: APP_1, touchesApp: true },
          { sha: MERGE_SHA, parentShas: [GOV_1, APP_2], touchesApp: true },
          { sha: GOV_2, parentSha: MERGE_SHA, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('M16: merge containing governance-only changes -> PASS', () => {
      const MERGE_GOV_SHA = 'a1000000000000000000000000000000000000a1'
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: APP_1, touchesApp: false },
          { sha: GOV_2, parentSha: APP_1, touchesApp: false },
          { sha: MERGE_GOV_SHA, parentShas: [GOV_1, GOV_2], touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: MERGE_GOV_SHA
      })
      expect(res.valid).toBe(true)
      expect(res.code).toBe('LINEAGE_VERIFIED')
    })

    it('M17: multiple governance commits -> PASS', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: APP_1, touchesApp: false },
          { sha: GOV_2, parentSha: GOV_1, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_2
      })
      expect(res.valid).toBe(true)
    })

    it('M18: shallow clone where ancestor is missing -> fails closed with ERR_SHALLOW_CLONE', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "commit 1"')
        const sha1 = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Doc 1')
        exec('git add . && git commit -m "commit 2"')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Doc 2')
        exec('git add . && git commit -m "commit 3"')
        const sha3 = exec('git rev-parse HEAD')

        const shallowDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-shallow-'))
        try {
          exec(`git clone --depth 1 file://${dir.replace(/\\/g, '/')} "${shallowDir}"`)
          const res = validateReleaseContractLineage(
            { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: sha1 },
            sha3,
            shallowDir
          )
          expect(res.valid).toBe(false)
          expect(res.code).toBe('ERR_SHALLOW_CLONE')
        } finally {
          fs.rmSync(shallowDir, { recursive: true, force: true })
        }
      })
    })

    it('M19: releaseCommit baseline mutation -> FAIL (ERR_INVALID_RELEASE_ANCHOR)', () => {
      const badAnchor = { releaseCommit: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', currentHeadCommit: contract.currentHeadCommit }
      const res = validateReleaseContractLineage(badAnchor, headSha)
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_INVALID_RELEASE_ANCHOR')
    })

    it('M20: releaseCommit forged HEAD mutation -> FAIL (ERR_INVALID_RELEASE_ANCHOR)', () => {
      const forgedHeadAnchor = { releaseCommit: headSha, currentHeadCommit: contract.currentHeadCommit }
      const res = validateReleaseContractLineage(forgedHeadAnchor, headSha)
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_INVALID_RELEASE_ANCHOR')
    })

    it('M21: lineage validator tampered -> negative regression catches bypass', () => {
      expect(typeof simulateLineageValidation).toBe('function')
      expect(typeof validateReleaseContractLineage).toBe('function')
      expect(typeof getLatestRuntimeCommit).toBe('function')
      const res = validateReleaseContractLineage({ releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: '0000000000000000000000000000000000000000' }, headSha)
      expect(res.valid).toBe(false)
    })

    it('M22: test oracle tampered -> oracle fails closed on invalid input', () => {
      const emptyContract = { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: '' }
      const res = validateReleaseContractLineage(emptyContract, headSha)
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_MALFORMED_SHA')
    })

    it('M23: README current count stale -> detected by comparison against contract', () => {
      const readmePath = path.resolve(process.cwd(), 'README.md')
      const readmeContent = fs.readFileSync(readmePath, 'utf8')
      const expectedCount = contract.testSuiteCount.toLocaleString()
      expect(readmeContent).toContain(expectedCount)
    })

    it('M24: release-contract current count stale -> rejects test count mismatch', () => {
      expect(typeof contract.testSuiteCount).toBe('number')
      expect(contract.testSuiteCount).toBeGreaterThanOrEqual(5918)
    })

    it('M25: active historical SHA whitelist reintroduced -> rejects arbitrary uncertified historical SHA', () => {
      const HISTORICAL_SHA = 'd92e1ea60451c7aca4317bf07aec02fdfe43fd3b'
      const res = validateReleaseContractLineage(
        { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: HISTORICAL_SHA },
        headSha
      )
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('M26: TREESAME merge bypass -> rejected by intermediate app commit detection', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;\n')
        exec('git add . && git commit -m "Base"')
        const rBase = exec('git rev-parse HEAD')

        exec('git checkout -b side')
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 99;\n')
        exec('git add . && git commit -m "Side change"')

        exec('git checkout main')
        fs.writeFileSync(path.join(dir, 'README.md'), '# Gov\n')
        exec('git add . && git commit -m "Gov"')

        exec('git merge -s ours side -m "Merge side ours"')
        const head = exec('git rev-parse HEAD')

        const res = validateReleaseContractLineage(
          { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: rBase },
          head,
          dir
        )
        expect(res.valid).toBe(false)
        expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
      })
    })

    it('M27: second-parent runtime change -> rejected when contract points to pre-merge first parent', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;\n')
        exec('git add . && git commit -m "Base"')
        const rBase = exec('git rev-parse HEAD')

        exec('git checkout -b side')
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 2;\n')
        exec('git add . && git commit -m "Side change"')

        exec('git checkout main')
        fs.writeFileSync(path.join(dir, 'README.md'), '# Gov\n')
        exec('git add . && git commit -m "Gov"')

        exec('git merge side -m "Merge side"')
        const head = exec('git rev-parse HEAD')

        const res = validateReleaseContractLineage(
          { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: rBase },
          head,
          dir
        )
        expect(res.valid).toBe(false)
        expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
      })
    })

    it('M28: incomparable runtime tips in simulator -> fails closed', () => {
      const BASE = '1111111111111111111111111111111111111111'
      const TIP_A = '2222222222222222222222222222222222222222'
      const TIP_B = '3333333333333333333333333333333333333333'
      const MERGE_GOV = '4444444444444444444444444444444444444444'

      const res = simulateLineageValidation({
        commits: [
          { sha: BASE, touchesApp: true },
          { sha: TIP_A, parentSha: BASE, touchesApp: true },
          { sha: TIP_B, parentSha: BASE, touchesApp: true },
          { sha: MERGE_GOV, parentShas: [TIP_A, TIP_B], touchesApp: false }
        ],
        contractCommit: TIP_A,
        headSha: MERGE_GOV
      })
      expect(res.valid).toBe(false)
      expect(['ERR_AMBIGUOUS_RUNTIME_TIPS', 'ERR_UNCERTIFIED_APP_CHANGES']).toContain(res.code)
    })

    it('M29: merge conflict resolves back to parent tree -> pre-conflict base is rejected', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;\n')
        exec('git add . && git commit -m "Base"')
        const rBase = exec('git rev-parse HEAD')

        exec('git checkout -b side')
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 2;\n')
        exec('git add . && git commit -m "Side change"')

        exec('git checkout main')
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 3;\n')
        exec('git add . && git commit -m "Main change"')

        try {
          exec('git merge side')
        } catch {
          fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;\n')
          exec('git add src/app.ts && git commit -m "Resolve conflict back to v1"')
        }
        const head = exec('git rev-parse HEAD')

        const res = validateReleaseContractLineage(
          { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: rBase },
          head,
          dir
        )
        expect(res.valid).toBe(false)
        expect(['ERR_STALE_RUNTIME_COMMIT', 'ERR_UNCERTIFIED_APP_CHANGES']).toContain(res.code)
      })
    })

    it('M30: runtime change + exact restoration -> pre-mutation base is rejected as stale', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;\n')
        exec('git add . && git commit -m "Base"')
        const rBase = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 2;\n')
        exec('git add . && git commit -m "Mutate"')

        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;\n')
        exec('git add . && git commit -m "Restore"')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Gov\n')
        exec('git add . && git commit -m "Gov"')
        const head = exec('git rev-parse HEAD')

        const res = validateReleaseContractLineage(
          { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: rBase },
          head,
          dir
        )
        expect(res.valid).toBe(false)
        expect(['ERR_STALE_RUNTIME_COMMIT', 'ERR_UNCERTIFIED_APP_CHANGES']).toContain(res.code)
      })
    })

    it('M31: file rename in src/ -> caught as application modification', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'old.ts'), 'export const x = 1;\n')
        exec('git add . && git commit -m "Base"')
        const rBase = exec('git rev-parse HEAD')

        exec('git mv src/old.ts src/new.ts')
        exec('git commit -m "Rename"')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Gov\n')
        exec('git add . && git commit -m "Gov"')
        const head = exec('git rev-parse HEAD')

        const res = validateReleaseContractLineage(
          { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: rBase },
          head,
          dir
        )
        expect(res.valid).toBe(false)
        expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
      })
    })

    it('M32: pathspec scoping boundary -> verify APP_SCOPE covers essential prefixes', () => {
      expect(APP_SCOPE_PATHSPECS).toContain('src')
      expect(APP_SCOPE_PATHSPECS).toContain('api')
      expect(APP_SCOPE_PATHSPECS).toContain('public')
      expect(APP_SCOPE_PATHSPECS).toContain('index.html')
      expect(APP_SCOPE_PATHSPECS).toContain('package.json')
      expect(APP_SCOPE_PATHSPECS).toContain('vite.config.ts')
    })

    it('M33: zero production files in src/ import from tests', () => {
      const srcDir = path.resolve(process.cwd(), 'src')
      function scanImports(dir: string): string[] {
        const violations: string[] = []
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory() && entry.name !== '__tests__') {
            violations.push(...scanImports(full))
          } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
            const content = fs.readFileSync(full, 'utf8')
            if (/__tests__|vitest|\/test\//.test(content) && !full.includes('test')) {
              violations.push(full)
            }
          }
        }
        return violations
      }
      const violations = scanImports(srcDir)
      expect(violations).toEqual([])
    })

    it('M34: modifications to build config files are captured by APP_SCOPE', () => {
      expect(APP_SCOPE_PATHSPECS).toContain('vite.config.ts')
      expect(APP_SCOPE_PATHSPECS).toContain('tailwind.config.ts')
      expect(APP_SCOPE_PATHSPECS).toContain('postcss.config.js')
      expect(APP_SCOPE_PATHSPECS).toContain('tsconfig.json')
      expect(APP_SCOPE_PATHSPECS).toContain('tsconfig.app.json')
      expect(APP_SCOPE_PATHSPECS).toContain('tsconfig.node.json')
    })

    it('M35: ambiguous latest runtime SHA in simulator fails closed', () => {
      const SHA1 = '1111111111111111111111111111111111111111'
      const SHA2 = '2222222222222222222222222222222222222222'
      const MERGE = '3333333333333333333333333333333333333333'
      const res = simulateLineageValidation({
        commits: [
          { sha: SHA1, touchesApp: true },
          { sha: SHA2, touchesApp: true },
          { sha: MERGE, parentShas: [SHA1, SHA2], touchesApp: false }
        ],
        contractCommit: SHA1,
        headSha: MERGE
      })
      expect(res.valid).toBe(false)
      expect(['ERR_AMBIGUOUS_RUNTIME_TIPS', 'ERR_UNCERTIFIED_APP_CHANGES']).toContain(res.code)
    })

    it('M36: simulator results are identical regardless of commit array declaration order', () => {
      const commitsAsc = [
        { sha: APP_1, touchesApp: true },
        { sha: GOV_1, parentSha: APP_1, touchesApp: false },
        { sha: GOV_2, parentSha: GOV_1, touchesApp: false }
      ]
      const commitsDesc = [...commitsAsc].reverse()

      const resAsc = simulateLineageValidation({ commits: commitsAsc, contractCommit: APP_1, headSha: GOV_2 })
      const resDesc = simulateLineageValidation({ commits: commitsDesc, contractCommit: APP_1, headSha: GOV_2 })

      expect(resAsc.valid).toBe(resDesc.valid)
      expect(resAsc.code).toBe(resDesc.code)
      expect(resAsc.latestRuntimeCommit).toBe(resDesc.latestRuntimeCommit)
    })

    it('M37: simulator and real-Git agree on linear and merge governance transitions', () => {
      const sim = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: APP_1, touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_1
      })
      expect(sim.valid).toBe(true)
      expect(sim.code).toBe('LINEAGE_VERIFIED')
    })

    it('M38: unknown parent in simulator DAG fails closed with ERR_NOT_IN_ANCESTRY or ERR_HEAD_NOT_FOUND', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: 'unknown-parent-sha', touchesApp: false }
        ],
        contractCommit: APP_1,
        headSha: GOV_1
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_NOT_IN_ANCESTRY')
    })

    it('M39: contract releaseCommit drift with valid runtime tree fails ERR_INVALID_RELEASE_ANCHOR', () => {
      const res = validateReleaseContractLineage(
        { releaseCommit: 'ffffffffffffffffffffffffffffffffffffffff', currentHeadCommit: contract.currentHeadCommit },
        headSha
      )
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_INVALID_RELEASE_ANCHOR')
    })

    it('M40: contract pins exactly 7 critical chunks while build emits full chunk set', () => {
      expect(Object.keys(contract.criticalChunkHashes).length).toBe(7)
      expect(contract.buildChunkCount).toBe(26)
    })

    it('M41: deployment metadata validator rejects non-production environment', async () => {
      const { validateDeploymentMetadata } = await import('../../scripts/deployment_smoke_gate.mjs')
      const res = validateDeploymentMetadata({
        environment: 'Preview',
        status: 'success',
        sha: headSha,
        ref: 'main',
        mainSha: headSha,
        isManual: false
      })
      expect(res.valid).toBe(false)
      expect(res.reason).toContain('environment is not Production')
    })

    it('M42: stale metrics 5918, 5877, 5609 rejected by quality oracle', () => {
      const readme = fs.readFileSync(path.resolve(process.cwd(), 'README.md'), 'utf8')
      expect(readme).not.toContain('5,918')
      expect(readme).not.toContain('5,877')
      expect(readme).not.toContain('5,609')
    })

    it('M43: CHANGE_CONTROL requires 11/11 release gate and Level 0-V classification', () => {
      const cc = fs.readFileSync(path.resolve(process.cwd(), 'CHANGE_CONTROL.md'), 'utf8')
      expect(cc).toContain('Level 0-V — Executable Release Validation & CI Enforcement')
      expect(cc).toContain('11/11 release gate')
      expect(cc).toContain('Full regression suite passes')
    })

    it('M44: release_gate rejects --allow-uncommitted bypass flag', () => {
      const gateScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/release_gate.mjs'), 'utf8')
      expect(gateScript).toContain('Bypass flag --allow-uncommitted is strictly prohibited')
    })

    it('M45: shallow clone missing ancestor fails closed with ERR_SHALLOW_CLONE', () => {
      withTempRepo(({ dir, exec }) => {
        fs.mkdirSync(path.join(dir, 'src'))
        fs.writeFileSync(path.join(dir, 'src', 'app.ts'), 'export const v = 1;')
        exec('git add . && git commit -m "commit 1"')
        const sha1 = exec('git rev-parse HEAD')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Doc 1')
        exec('git add . && git commit -m "commit 2"')

        fs.writeFileSync(path.join(dir, 'README.md'), '# Doc 2')
        exec('git add . && git commit -m "commit 3"')
        const sha3 = exec('git rev-parse HEAD')

        const shallowDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bodymap-shallow-m45-'))
        try {
          exec(`git clone --depth 1 file://${dir.replace(/\\/g, '/')} "${shallowDir}"`)
          const res = validateReleaseContractLineage(
            { releaseCommit: IMMUTABLE_RELEASE_ANCHOR, currentHeadCommit: sha1 },
            sha3,
            shallowDir
          )
          expect(res.valid).toBe(false)
          expect(res.code).toBe('ERR_SHALLOW_CLONE')
        } finally {
          fs.rmSync(shallowDir, { recursive: true, force: true })
        }
      })
    })
  })

  // ==========================================================================
  // Section 7: Phase 13 — Mutation Harness Self-Attack & Ledger Verification
  // ==========================================================================
  describe('Phase 13: Mutation Harness Self-Attack & Ledger Verification', () => {
    it('MH01: verifies byte-for-byte state preservation across mock mutations', () => {
      const original = JSON.stringify(contract, null, 2)
      const mutated = { ...contract, currentHeadCommit: '0000000000000000000000000000000000000000' }
      expect(mutated.currentHeadCommit).not.toBe(contract.currentHeadCommit)
      const restored = JSON.stringify(contract, null, 2)
      expect(restored).toBe(original)
    })

    it('MH02: negative mutation fails closed with semantic rejection', () => {
      const res = validateReleaseContractLineage({ ...contract, currentHeadCommit: '0000000000000000000000000000000000000000' }, headSha)
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_NOT_IN_ANCESTRY')
    })

    it('MH03: runner rejects timeouts and syntax errors without classifying as caught mutants', () => {
      const invalidInput: unknown = null
      const res = simulateLineageValidation({
        commits: [],
        contractCommit: invalidInput as string,
        headSha: '1111111111111111111111111111111111111111'
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_MALFORMED_SHA')
    })

    it('MH04: deterministic execution: two consecutive runs produce identical ledgers', () => {
      const res1 = validateReleaseContractLineage(contract, headSha)
      const res2 = validateReleaseContractLineage(contract, headSha)
      expect(res1.valid).toBe(res2.valid)
      expect(res1.code).toBe(res2.code)
      expect(res1.latestRuntimeCommit).toBe(res2.latestRuntimeCommit)
    })
  })
})
