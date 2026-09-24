import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import {
  getLatestRuntimeCommit,
  validateReleaseContractLineage,
  simulateLineageValidation,
  IMMUTABLE_RELEASE_ANCHOR
} from '../../scripts/release_lineage.mjs'

describe('Release Lineage Model & Governance Invariants', () => {
  const contractPath = path.resolve(process.cwd(), 'release-contract.json')
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'))
  const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()

  // ==========================================================================
  // Section 1: Live Repository Invariants
  // ==========================================================================
  describe('Live Repository Contract Lineage', () => {
    it('L01: derives authoritative runtime commit from Git without hardcoded SHAs', () => {
      const latestRuntime = getLatestRuntimeCommit()
      expect(latestRuntime).toBeDefined()
      expect(latestRuntime).toMatch(/^[0-9a-f]{40}$/)
      // Must match the contract's claimed runtime commit
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
  // Section 2: Phase 5 Synthetic Lineage Histories (A–E)
  // ==========================================================================
  describe('Synthetic Lineage Histories (Phase 5 Protocols)', () => {
    const SHA_APP_A = '1111111111111111111111111111111111111111'
    const SHA_GOV_B = '2222222222222222222222222222222222222222'
    const SHA_GOV_C = '3333333333333333333333333333333333333333'
    const SHA_APP_C = '4444444444444444444444444444444444444444'
    const SHA_APP_D = '5555555555555555555555555555555555555555'
    const SHA_GOV_D = '6666666666666666666666666666666666666666'

    it('History A: application commit A -> governance seal B (PASS)', () => {
      // In B, contract certifies A. Zero app changes in B.
      const result = simulateLineageValidation({
        commits: [
          { sha: SHA_APP_A, touchesApp: true },
          { sha: SHA_GOV_B, parentSha: SHA_APP_A, touchesApp: false }
        ],
        contractCommit: SHA_APP_A,
        headSha: SHA_GOV_B
      })
      expect(result.valid).toBe(true)
      expect(result.code).toBe('LINEAGE_VERIFIED')
    })

    it('History B: application commit A -> governance seal B -> doc/governance commit C (PASS)', () => {
      // Multi-step governance sealing sequence certifying A.
      const result = simulateLineageValidation({
        commits: [
          { sha: SHA_APP_A, touchesApp: true },
          { sha: SHA_GOV_B, parentSha: SHA_APP_A, touchesApp: false },
          { sha: SHA_GOV_C, parentSha: SHA_GOV_B, touchesApp: false }
        ],
        contractCommit: SHA_APP_A,
        headSha: SHA_GOV_C
      })
      expect(result.valid).toBe(true)
      expect(result.code).toBe('LINEAGE_VERIFIED')
    })

    it('History C: application commit A -> governance seal B -> unrelated app commit C (FAIL)', () => {
      // Commit C modified application code, but contract still points to A.
      const result = simulateLineageValidation({
        commits: [
          { sha: SHA_APP_A, touchesApp: true },
          { sha: SHA_GOV_B, parentSha: SHA_APP_A, touchesApp: false },
          { sha: SHA_APP_C, parentSha: SHA_GOV_B, touchesApp: true }
        ],
        contractCommit: SHA_APP_A,
        headSha: SHA_APP_C
      })
      expect(result.valid).toBe(false)
      expect(result.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('History D: application commit A -> governance seal B -> application release D (FAIL)', () => {
      // New application release D created, but contract was not bumped.
      const result = simulateLineageValidation({
        commits: [
          { sha: SHA_APP_A, touchesApp: true },
          { sha: SHA_GOV_B, parentSha: SHA_APP_A, touchesApp: false },
          { sha: SHA_APP_D, parentSha: SHA_GOV_B, touchesApp: true }
        ],
        contractCommit: SHA_APP_A,
        headSha: SHA_APP_D
      })
      expect(result.valid).toBe(false)
      expect(result.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('History E: application commit A -> gov B -> gov C -> gov D (PASS)', () => {
      // Deep chain of 3 consecutive governance commits after runtime release A.
      const result = simulateLineageValidation({
        commits: [
          { sha: SHA_APP_A, touchesApp: true },
          { sha: SHA_GOV_B, parentSha: SHA_APP_A, touchesApp: false },
          { sha: SHA_GOV_C, parentSha: SHA_GOV_B, touchesApp: false },
          { sha: SHA_GOV_D, parentSha: SHA_GOV_C, touchesApp: false }
        ],
        contractCommit: SHA_APP_A,
        headSha: SHA_GOV_D
      })
      expect(result.valid).toBe(true)
      expect(result.code).toBe('LINEAGE_VERIFIED')
    })
  })

  // ==========================================================================
  // Section 3: Phase 3 Adversarial Mutation Matrix (M1–M16)
  // ==========================================================================
  describe('Adversarial Mutation Matrix (Phase 3 Protocols)', () => {
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

    it('M1: currentHeadCommit == HEAD when HEAD is application commit -> PASS', () => {
      const res = simulateLineageValidation({
        commits: [{ sha: APP_1, touchesApp: true }],
        contractCommit: APP_1,
        headSha: APP_1
      })
      expect(res.valid).toBe(true)
    })

    it('M2: currentHeadCommit == HEAD~1 when HEAD is 1st governance commit -> PASS', () => {
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

    it('M3: currentHeadCommit == HEAD~2 when HEAD is 2nd governance commit -> PASS', () => {
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

    it('M4: currentHeadCommit == arbitrary old valid commit with intermediate app change -> FAIL', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: APP_1,
        headSha: APP_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('M5: currentHeadCommit == unrelated valid SHA not in DAG -> FAIL', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: '9999999999999999999999999999999999999999',
        headSha: GOV_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_NOT_IN_ANCESTRY')
    })

    it('M6: currentHeadCommit == malformed SHA -> FAIL', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: 'invalid-sha',
        headSha: GOV_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_MALFORMED_SHA')
    })

    it('M7: currentHeadCommit == current runtime commit -> PASS', () => {
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

    it('M8: currentHeadCommit == governance-only commit -> FAIL', () => {
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

    it('M9: new application release followed by multiple governance commits -> PASS', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: APP_2, parentSha: APP_1, touchesApp: true },
          { sha: GOV_1, parentSha: APP_2, touchesApp: false },
          { sha: GOV_2, parentSha: GOV_1, touchesApp: false }
        ],
        contractCommit: APP_2,
        headSha: GOV_2
      })
      expect(res.valid).toBe(true)
    })

    it('M10: stale 024649d contract after a later legitimate application release -> FAIL', () => {
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true }, // represents 024649d
          { sha: APP_2, parentSha: APP_1, touchesApp: true } // represents next app release
        ],
        contractCommit: APP_1,
        headSha: APP_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })

    it('M11: later app commit with different code while contract claims old commit -> FAIL', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: APP_1,
        headSha: APP_2
      })
      expect(res.valid).toBe(false)
    })

    it('M12: multiple governance-only commits after valid app commit -> PASS', () => {
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

    it('M13: HEAD is a later unrelated commit that modified app code -> FAIL', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: APP_1,
        headSha: APP_2
      })
      expect(res.valid).toBe(false)
    })

    it('M14: contract references reachable commit several generations behind where app changed -> FAIL', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: APP_1,
        headSha: APP_2
      })
      expect(res.valid).toBe(false)
    })

    it('M15: contract references non-existent commit in history -> FAIL', () => {
      const res = simulateLineageValidation({
        commits: standardCommits,
        contractCommit: '0000000000000000000000000000000000000000',
        headSha: GOV_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_NOT_IN_ANCESTRY')
    })

    it('M16: older runtime commit remains permanently whitelisted without dynamic currency -> FAIL', () => {
      // Proves that when APP_2 is the latest runtime commit, claiming APP_1 is strictly rejected
      const res = simulateLineageValidation({
        commits: [
          { sha: APP_1, touchesApp: true },
          { sha: APP_2, parentSha: APP_1, touchesApp: true }
        ],
        contractCommit: APP_1,
        headSha: APP_2
      })
      expect(res.valid).toBe(false)
      expect(res.code).toBe('ERR_UNCERTIFIED_APP_CHANGES')
    })
  })
})
