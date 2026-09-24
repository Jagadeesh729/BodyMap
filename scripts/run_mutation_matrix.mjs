#!/usr/bin/env node

/**
 * BodyMap AI — Governed Mutation Quality Gate Runner (M1–M10)
 *
 * Hardened under E44:
 * - Deterministic, non-destructive restoration from in-memory buffers + crash-recovery backups.
 * - Zero destructive git commands (no destructive git restoration).
 * - Cryptographic SHA-256 pre-mutation, post-mutation, and post-restoration verification.
 * - Strict failure classification: only `EXPECTED_ASSERTION_FAILURE` qualifies as KILLED.
 * - Syntax errors, crashes, missing tests, and timeouts are classified as errors, NOT mutant kills.
 * - Full forensic JSON ledger generation.
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, join } from 'path'
import { createHash } from 'crypto'

const ROOT = process.cwd()

export function sha256(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

export function classifyFailure(error, stdout = '', stderr = '') {
  const combined = (stdout || '') + '\n' + (stderr || '') + '\n' + (error?.message || '')
  
  if (error?.code === 'ETIMEDOUT') {
    return 'TIMEOUT'
  }
  if (/No test files found|does not match any test files/i.test(combined)) {
    return 'MISSING_TEST'
  }
  if (/Cannot find module|failed to resolve|ERR_MODULE_NOT_FOUND/i.test(combined)) {
    return 'MISSING_DEPENDENCY'
  }
  if (/\[vite\]\s+Internal server error|Transform failed with \d+ error|Failed to parse source for/i.test(combined)) {
    return 'SYNTAX_ERROR'
  }
  if (/^\s*SyntaxError:\s+/m.test(combined) && !/AssertionError/i.test(combined)) {
    return 'SYNTAX_ERROR'
  }
  if (/AssertionError|FAIL\s+.*|expected.*to|toBe|toEqual|toHaveProperty/i.test(combined)) {
    return 'EXPECTED_ASSERTION_FAILURE'
  }
  return 'TEST_PROCESS_CRASH'
}

export const MUTATIONS = [
  {
    id: 'M1',
    description: 'CORS allowlist accepts attacker origin in resolveCorsOrigin',
    file: 'api/generate-plan.ts',
    test: 'src/__tests__/corsSecurityBoundaryOracle.test.ts',
    expectedSnippet: 'corsSecurityBoundaryOracle',
    mutate(content) {
      if (!content.includes('return null')) throw new Error('M1 target not found')
      return content.replace('if (allowed.has(origin)) {\n    return origin\n  }\n\n  return null', 'return origin')
    }
  },
  {
    id: 'M2',
    description: 'CORS wildcard is restored on API handler',
    file: 'api/generate-plan.ts',
    test: 'src/__tests__/corsSecurityBoundaryOracle.test.ts',
    expectedSnippet: 'corsSecurityBoundaryOracle',
    mutate(content) {
      if (!content.includes("res.setHeader('Access-Control-Allow-Origin', matchedOrigin)")) {
        throw new Error('M2 target not found')
      }
      return content.replace(
        "res.setHeader('Access-Control-Allow-Origin', matchedOrigin)",
        "res.setHeader('Access-Control-Allow-Origin', '*')"
      )
    }
  },
  {
    id: 'M3',
    description: 'API schema validation bypassed / inverted before upstream call',
    file: 'api/generate-plan.ts',
    test: 'src/__tests__/apiHandler.test.ts',
    expectedSnippet: 'Invalid form data fields provided',
    mutate(content) {
      const target = 'const formValidation = FullFormDataSchema.safeParse(parsed.formData)'
      if (!content.includes(target)) {
        throw new Error('M3 target not found')
      }
      return content.replace(
        target,
        'const formValidation = { success: true, data: parsed.formData as any, error: { issues: [] } }'
      )
    }
  },
  {
    id: 'M4',
    description: 'API error response leaks internal exception stack trace',
    file: 'api/generate-plan.ts',
    test: 'src/__tests__/dataConfidentialityBoundaryOracle.test.ts',
    expectedSnippet: 'dataConfidentialityBoundaryOracle',
    mutate(content) {
      const target = "res.end(JSON.stringify({ error: 'Malformed request body', requestId }))"
      if (!content.includes(target)) {
        throw new Error('M4 target not found')
      }
      return content.replace(
        target,
        "res.end(JSON.stringify({ error: 'Malformed request body', requestId, stack: 'Error: internal stack trace' }))"
      )
    }
  },
  {
    id: 'M5',
    description: 'purgeAllUserData fails to remove bodymap_plan_v2 namespace',
    file: 'src/lib/dataPurge.ts',
    test: 'src/__tests__/dataConfidentialityBoundaryOracle.test.ts',
    expectedSnippet: 'dataConfidentialityBoundaryOracle',
    mutate(content) {
      const target = 'window.localStorage.removeItem(key)'
      if (!content.includes(target)) {
        throw new Error('M5 target not found')
      }
      return content.replace(
        target,
        "if (key !== 'bodymap_plan_v2') window.localStorage.removeItem(key)"
      )
    }
  },
  {
    id: 'M6',
    description: 'Storage parser sanitizeFormData pollutes Object prototype',
    file: 'src/context/planStorage.ts',
    test: 'src/__tests__/stateProvenanceConsistencyOracle.test.ts -t A11',
    expectedSnippet: 'stateProvenanceConsistencyOracle',
    mutate(content) {
      const target = 'export function sanitizeFormData(raw: unknown): FormData {'
      if (!content.includes(target)) {
        throw new Error('M6 target not found')
      }
      return content.replace(
        target,
        "export function sanitizeFormData(raw: unknown): FormData {\n  if (raw && typeof raw === 'object' && (raw as any).__proto__) Object.assign(Object.prototype, (raw as any).__proto__);"
      )
    }
  },
  {
    id: 'M7',
    description: 'Unsafe navigation javascript: URI inserted into page anchor',
    file: 'src/pages/AboutContactPage.tsx',
    test: 'src/__tests__/browserSecurityBoundaryOracle.test.ts',
    expectedSnippet: 'browserSecurityBoundaryOracle',
    mutate(content) {
      if (!content.includes('href="mailto:support@bodymap.ai"')) {
        throw new Error('M7 target not found')
      }
      return content.replace(
        'href="mailto:support@bodymap.ai"',
        'href="javascript:alert(1)"'
      )
    }
  },
  {
    id: 'M8',
    description: 'CSP configuration in vercel.json weakened to allow unsafe-inline scripts',
    file: 'vercel.json',
    test: 'src/__tests__/securityHeadersConfig.test.ts',
    expectedSnippet: 'securityHeadersConfig',
    mutate(content) {
      if (!content.includes("script-src 'self'")) {
        throw new Error('M8 target not found')
      }
      return content.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
    }
  },
  {
    id: 'M9',
    description: 'API Cache-Control response loses no-store / made public',
    file: 'api/generate-plan.ts',
    test: 'src/__tests__/browserSecurityBoundaryOracle.test.ts -t H01',
    expectedSnippet: 'browserSecurityBoundaryOracle',
    mutate(content) {
      const target = "res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')"
      if (!content.includes(target)) {
        throw new Error('M9 target not found')
      }
      return content.replace(target, "res.setHeader('Cache-Control', 'public, max-age=3600')")
    }
  },
  {
    id: 'M10',
    description: 'Regression test assertion weakened to accept cross-origin CORP',
    file: 'src/__tests__/securityHeadersConfig.test.ts',
    test: 'src/__tests__/securityHeadersConfig.test.ts',
    expectedSnippet: 'securityHeadersConfig',
    mutate(content) {
      const target = "expect(corp?.value).toBe('same-origin')"
      if (!content.includes(target)) {
        throw new Error('M10 target not found')
      }
      return content.replace(target, "expect(corp?.value).toBe('cross-origin')")
    }
  }
]

export function runMutationRunner(mutations = MUTATIONS) {
  console.log('='.repeat(75))
  console.log('BodyMap AI — Governed Mutation Quality Gate Runner (Hardened E44)')
  console.log('='.repeat(75))

  const results = []
  let allPassed = true

  for (const m of mutations) {
    const filePath = resolve(ROOT, m.file)
    const backupPath = `${filePath}.e44_bak`
    const originalContent = readFileSync(filePath, 'utf8')
    const originalSha = sha256(originalContent)
    
    // Save crash-recovery backup
    writeFileSync(backupPath, originalContent, 'utf8')

    let mutatedContent = ''
    let mutatedSha = ''
    let status = 'UNKNOWN'
    let failureClassification = 'NONE'
    let exitCode = 0
    let evidenceSnippet = ''
    let restoredSha = ''
    let restorationStatus = 'PENDING'

    console.log(`\n[${m.id}] Testing mutant: ${m.description}`)
    console.log(`     Target: ${m.file} (SHA: ${originalSha.slice(0, 10)}...)`)
    console.log(`     Test:   ${m.test}`)

    try {
      mutatedContent = m.mutate(originalContent)
      mutatedSha = sha256(mutatedContent)

      if (mutatedSha === originalSha) {
        throw new Error('Mutant content is identical to original content (no mutation applied)')
      }

      writeFileSync(filePath, mutatedContent, 'utf8')

      // Execute targeted test
      try {
        const stdout = execSync(`npx vitest run ${m.test}`, {
          cwd: ROOT,
          stdio: 'pipe',
          encoding: 'utf8',
          timeout: 60000
        })
        // If execution succeeded without throwing, mutant survived!
        status = 'SURVIVED'
        allPassed = false
        failureClassification = 'SURVIVED_TEST_PASSED'
        evidenceSnippet = stdout.slice(0, 100).replace(/\r?\n/g, ' ')
        console.error(`     \x1b[31mFAIL: Mutant ${m.id} SURVIVED! Test passed unexpectedly.\x1b[0m`)
      } catch (testError) {
        exitCode = testError.status || 1
        const stdout = testError.stdout || ''
        const stderr = testError.stderr || ''
        failureClassification = classifyFailure(testError, stdout, stderr)

        if (failureClassification === 'EXPECTED_ASSERTION_FAILURE') {
          status = 'KILLED'
          const combined = stdout + '\n' + stderr
          const failMatch = combined.match(/FAIL\s+.*|AssertionError:.*|expected.*to/i)
          evidenceSnippet = failMatch ? failMatch[0].trim().replace(/\r?\n/g, ' ') : 'Assertion failed as expected'
          console.log(`     \x1b[32mPASS: Mutant ${m.id} KILLED by expected assertion failure.\x1b[0m`)
          console.log(`     Evidence: ${evidenceSnippet.slice(0, 75)}`)
        } else {
          status = 'MUTATION_ERROR'
          allPassed = false
          evidenceSnippet = `Misclassified failure: ${failureClassification}`
          console.error(`     \x1b[31mFAIL: Mutant ${m.id} caused infrastructure error: ${failureClassification}\x1b[0m`)
        }
      }
    } catch (mutationErr) {
      status = 'MUTATION_APPLICATION_ERROR'
      failureClassification = 'MUTATION_APPLICATION_ERROR'
      allPassed = false
      evidenceSnippet = mutationErr.message
      console.error(`     \x1b[31mERROR applying mutation ${m.id}: ${mutationErr.message}\x1b[0m`)
    } finally {
      // Deterministic non-destructive byte restoration
      try {
        writeFileSync(filePath, originalContent, 'utf8')
        const currentContent = readFileSync(filePath, 'utf8')
        restoredSha = sha256(currentContent)

        if (restoredSha === originalSha) {
          restorationStatus = 'RESTORED_VERIFIED'
          if (existsSync(backupPath)) {
            unlinkSync(backupPath)
          }
        } else {
          // Fallback to crash recovery backup
          const bakContent = readFileSync(backupPath, 'utf8')
          writeFileSync(filePath, bakContent, 'utf8')
          restoredSha = sha256(readFileSync(filePath, 'utf8'))
          restorationStatus = (restoredSha === originalSha) ? 'RESTORED_VIA_BACKUP' : 'RESTORATION_FATAL'
        }
      } catch (restorationErr) {
        restorationStatus = `RESTORATION_EXCEPTION: ${restorationErr.message}`
        allPassed = false
      }

      // In-process prototype pollution cleanup
      try {
        delete Object.prototype.polluted
        delete Object.prototype.admin
        delete Object.prototype.isAdmin
      } catch {}
    }

    results.push({
      id: m.id,
      description: m.description,
      file: m.file,
      test: m.test,
      originalSha,
      mutatedSha,
      exitCode,
      failureClassification,
      status,
      restoredSha,
      restorationStatus,
      evidence: evidenceSnippet
    })
  }

  console.log('\n' + '='.repeat(75))
  console.log('MUTATION MATRIX FORENSIC SUMMARY')
  console.log('='.repeat(75))

  let killedCount = 0
  for (const r of results) {
    const isKilled = r.status === 'KILLED'
    const icon = isKilled ? '✓' : '✗'
    const color = isKilled ? '\x1b[32m' : '\x1b[31m'
    console.log(`  ${color}${icon} ${r.id}\x1b[0m: ${r.status} (${r.failureClassification}) — ${r.description}`)
    if (isKilled) killedCount++
  }

  console.log('-'.repeat(75))
  console.log(`Total Mutants: ${mutations.length} | Killed: ${killedCount} | Survived: ${mutations.length - killedCount}`)
  console.log(`Kill Rate: ${((killedCount / mutations.length) * 100).toFixed(1)}%`)
  console.log('='.repeat(75))

  const ledger = {
    timestamp: new Date().toISOString(),
    totalMutants: mutations.length,
    killedCount,
    killRate: `${((killedCount / mutations.length) * 100).toFixed(1)}%`,
    allPassed: allPassed && (killedCount === mutations.length),
    results
  }

  // Save to scratch
  const ledgerPath = join(ROOT, 'scratch/mutation_matrix_results.json')
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), 'utf8')
  console.log(`Saved detailed forensic mutation ledger to: ${ledgerPath}\n`)

  return ledger
}

// If invoked as CLI script
if (process.argv[1] && process.argv[1].endsWith('run_mutation_matrix.mjs')) {
  const ledger = runMutationRunner()
  if (!ledger.allPassed) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}
