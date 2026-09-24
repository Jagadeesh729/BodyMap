import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { sha256, classifyFailure, MUTATIONS } from '../../scripts/run_mutation_matrix.mjs'

describe('Governance Mutation Harness Oracle (G1–G8)', () => {
  const runnerSource = readFileSync(resolve(process.cwd(), 'scripts/run_mutation_matrix.mjs'), 'utf8')

  it('G1: Infrastructure process crashes are NOT classified as EXPECTED_ASSERTION_FAILURE', () => {
    const error = new Error('Process exited with code 139')
    const classification = classifyFailure(error, '', 'Segmentation fault (core dumped)')
    expect(classification).toBe('TEST_PROCESS_CRASH')
    expect(classification).not.toBe('EXPECTED_ASSERTION_FAILURE')
  })

  it('G2: Destructive "git checkout" is strictly prohibited in runner implementation', () => {
    expect(runnerSource).not.toMatch(/git\s+checkout\s+--/i)
    expect(runnerSource).not.toMatch(/git\s+reset\s+--hard/i)
  })

  it('G3: Post-mutation cryptographic hash verification is enforced', () => {
    expect(runnerSource).toContain('restoredSha === originalSha')
    expect(runnerSource).toContain('RESTORED_VERIFIED')
    const testContent = 'console.log("deterministic-test")'
    const hash = sha256(testContent)
    expect(hash).toHaveLength(64)
    expect(sha256(testContent)).toBe(hash)
  })

  it('G4: Restoration occurs inside a deterministic finally block', () => {
    expect(runnerSource).toContain('finally {')
    expect(runnerSource).toContain('writeFileSync(filePath, originalContent')
  })

  it('G5: Nonexistent test path is classified as MISSING_TEST, not KILLED', () => {
    const error = new Error('Vitest failed')
    const classification = classifyFailure(error, 'No test files found, exiting with code 1', '')
    expect(classification).toBe('MISSING_TEST')
    expect(classification).not.toBe('EXPECTED_ASSERTION_FAILURE')
  })

  it('G6: Syntax error in mutant is classified as SYNTAX_ERROR, not KILLED', () => {
    const error = new Error('Command failed')
    const classification = classifyFailure(error, '', 'SyntaxError: Unexpected token')
    expect(classification).toBe('SYNTAX_ERROR')
    expect(classification).not.toBe('EXPECTED_ASSERTION_FAILURE')
  })

  it('G7: True assertion failures are accurately classified as EXPECTED_ASSERTION_FAILURE', () => {
    const error = new Error('Command failed')
    const stdout = 'FAIL  src/__tests__/corsSecurityBoundaryOracle.test.ts\nAssertionError: expected undefined to be "https://attacker.site"'
    const classification = classifyFailure(error, stdout, '')
    expect(classification).toBe('EXPECTED_ASSERTION_FAILURE')
  })

  it('G8: All 10 defined mutations (M1–M10) have non-empty description, file, and test targets', () => {
    expect(MUTATIONS).toHaveLength(10)
    for (const m of MUTATIONS) {
      expect(m.id).toMatch(/^M(10|[1-9])$/)
      expect(m.description.length).toBeGreaterThan(10)
      expect(m.file.length).toBeGreaterThan(3)
      expect(m.test.length).toBeGreaterThan(3)
      expect(typeof m.mutate).toBe('function')
    }
  })
})
