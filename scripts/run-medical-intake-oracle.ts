/**
 * scripts/run-medical-intake-oracle.ts
 *
 * Fast, lightweight standalone runner for the 135-scenario medical intake oracle.
 * Avoids Vitest framework overhead to execute in <100ms.
 */

import { classifyMedicalIntake } from '../src/lib/medicalIntakeParser'
import { ORACLE_SCENARIOS } from '../src/lib/medicalIntakeOracleCases'

const startTime = performance.now()
let passed = 0
let failed = 0
const failures: Array<{ id: number; input: string; reasons: string[] }> = []

for (const s of ORACLE_SCENARIOS) {
  const res = classifyMedicalIntake(s.input)
  const reasons: string[] = []

  // Check active categories
  const actualActive = [...res.activeCategories].sort()
  const expectedActive = [...s.expectedActiveCategories].sort()
  if (JSON.stringify(actualActive) !== JSON.stringify(expectedActive)) {
    reasons.push(`ActiveCategories: expected [${expectedActive.join(', ')}], got [${actualActive.join(', ')}]`)
  }

  // Check safety sensitivity
  if (res.isSafetySensitive !== s.expectedSafetySensitive) {
    reasons.push(`isSafetySensitive: expected ${s.expectedSafetySensitive}, got ${res.isSafetySensitive}`)
  }

  // Check negated categories if expected
  if (s.expectedNegatedCategories) {
    for (const expNeg of s.expectedNegatedCategories) {
      if (!res.negatedCategories.includes(expNeg)) {
        reasons.push(`negatedCategories missing expected '${expNeg}' (got [${res.negatedCategories.join(', ')}])`)
      }
    }
  }

  // Check historical categories if expected
  if (s.expectedHistoricalCategories) {
    for (const expHist of s.expectedHistoricalCategories) {
      if (!res.historicalCategories.includes(expHist)) {
        reasons.push(`historicalCategories missing expected '${expHist}' (got [${res.historicalCategories.join(', ')}])`)
      }
    }
  }

  // Check family history categories if expected
  if (s.expectedFamilyHistoryCategories) {
    for (const expFam of s.expectedFamilyHistoryCategories) {
      if (!res.familyHistoryCategories.includes(expFam)) {
        reasons.push(`familyHistoryCategories missing expected '${expFam}' (got [${res.familyHistoryCategories.join(', ')}])`)
      }
    }
  }

  if (reasons.length === 0) {
    passed++
  } else {
    failed++
    failures.push({ id: s.id, input: s.input, reasons })
  }
}

const elapsedMs = (performance.now() - startTime).toFixed(2)

console.log('====================================================')
console.log(`Medical Intake Oracle Runner — Results in ${elapsedMs} ms`)
console.log(`Total Scenarios: ${ORACLE_SCENARIOS.length}`)
console.log(`Passed:          ${passed} / ${ORACLE_SCENARIOS.length} (${((passed / ORACLE_SCENARIOS.length) * 100).toFixed(1)}%)`)
console.log(`Failed:          ${failed}`)
console.log('====================================================')

if (failures.length > 0) {
  console.log('\n--- FAILURES ---')
  for (const f of failures) {
    console.log(`\nScenario #${f.id}: "${f.input}"`)
    for (const r of f.reasons) {
      console.log(`  - ${r}`)
    }
  }
  process.exit(1)
} else {
  console.log('ALL ORACLE SCENARIOS PASSED PERFECTLY!')
  process.exit(0)
}
