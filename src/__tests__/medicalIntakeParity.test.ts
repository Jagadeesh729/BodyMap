/**
 * medicalIntakeParity.test.ts
 *
 * Symmetrical Client-Server Parity Suite for Medical Intake Classification.
 * Verifies that the client-side medical intake engine and the server-side API engine
 * maintain 100% behavioral, categorical, and semantic parity across all 135 oracle scenarios.
 */

import { describe, it, expect } from 'vitest'
import { classifyMedicalIntake as clientClassify } from '../lib/medicalIntakeParser'
import { getActiveContraindicationCategories as clientGetActive } from '../lib/contraindicationGuard'
import { ORACLE_SCENARIOS } from '../lib/medicalIntakeOracleCases'

describe('Client-Server Medical Intake Classification Parity (135 Scenarios)', () => {
  it('guarantees identical classification between client and server across all 135 scenarios', async () => {
    const serverModule = await import('../../api/generate-plan')
    expect(serverModule.classifyMedicalIntake).toBeDefined()
    expect(serverModule.getActiveContraindicationCategories).toBeDefined()

    for (const s of ORACLE_SCENARIOS) {
      // 1. Classification Parity
      const clientRes = clientClassify(s.input)
      const serverRes = serverModule.classifyMedicalIntake(s.input)

      expect(clientRes.activeCategories.sort()).toEqual(serverRes.activeCategories.sort())
      expect(clientRes.isSafetySensitive).toBe(serverRes.isSafetySensitive)
      expect(clientRes.negatedCategories.sort()).toEqual(serverRes.negatedCategories.sort())
      expect(clientRes.historicalCategories.sort()).toEqual(serverRes.historicalCategories.sort())
      expect(clientRes.familyHistoryCategories.sort()).toEqual(serverRes.familyHistoryCategories.sort())
      expect(clientRes.structuredPromptContext).toBe(serverRes.structuredPromptContext)

      // 2. Active Contraindication Categories Configuration Parity
      const clientActiveCats = clientGetActive(s.input).map(c => c.key).sort()
      const serverActiveCats = serverModule.getActiveContraindicationCategories(s.input).map((c: { key: string }) => c.key).sort()

      expect(clientActiveCats).toEqual(serverActiveCats)
      expect(clientActiveCats).toEqual(s.expectedActiveCategories.sort())
    }
  })
})
