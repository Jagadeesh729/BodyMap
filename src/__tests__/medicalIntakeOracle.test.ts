import { describe, it, expect } from 'vitest'
import { classifyMedicalIntake } from '../lib/medicalIntakeParser'
import { ORACLE_SCENARIOS } from '../lib/medicalIntakeOracleCases'

describe('Expanded Independent Medical Intake Oracle Suite (150 Scenarios)', () => {
  for (const s of ORACLE_SCENARIOS) {
    it(`Scenario #${s.id} [${s.group}]: "${s.input}"`, () => {
      const res = classifyMedicalIntake(s.input)

      // 1. Assert active contraindication categories match expected
      expect(res.activeCategories.sort()).toEqual(s.expectedActiveCategories.sort())

      // 2. Assert safety sensitivity matches expected
      expect(res.isSafetySensitive).toBe(s.expectedSafetySensitive)

      // 3. If expected negated categories specified, assert presence
      if (s.expectedNegatedCategories) {
        for (const nc of s.expectedNegatedCategories) {
          expect(res.negatedCategories).toContain(nc)
        }
      }

      // 4. If expected historical categories specified, assert presence
      if (s.expectedHistoricalCategories) {
        for (const hc of s.expectedHistoricalCategories) {
          expect(res.historicalCategories).toContain(hc)
        }
      }

      // 5. If expected family history categories specified, assert presence
      if (s.expectedFamilyHistoryCategories) {
        for (const fc of s.expectedFamilyHistoryCategories) {
          expect(res.familyHistoryCategories).toContain(fc)
        }
      }

      // 6. Invariant: structuredPromptContext is always populated
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
  }

  describe('Core Security & Safety Invariants', () => {
    it('Invariant A: Explicit negation cannot manufacture an active condition', () => {
      const negations = [
        'No knee injury',
        'No ACL tear',
        'Denies shoulder impingement',
        'Ruled out disc herniation',
        'No heart disease',
        'Not pregnant',
        'No osteoporosis',
        'No osteoarthritis',
      ]
      for (const neg of negations) {
        const res = classifyMedicalIntake(neg)
        expect(res.activeCategories).toHaveLength(0)
        expect(res.isSafetySensitive).toBe(false)
      }
    })

    it('Invariant B: Family history cannot manufacture an active condition for user', () => {
      const familyInputs = [
        'Family history of heart attack',
        'Mother had an ACL tear',
        'Father had lumbar disc surgery',
        'Family history of osteoporosis',
        'Family history of cardiac disease',
      ]
      for (const fi of familyInputs) {
        const res = classifyMedicalIntake(fi)
        expect(res.activeCategories).toHaveLength(0)
        expect(res.isSafetySensitive).toBe(false)
      }
    })

    it('Invariant C: Formal clinical terminology maps to the correct safety category', () => {
      const formalInputs = [
        { input: 'Anterior cruciate ligament tear', category: 'knee_high_impact' },
        { input: 'Supraspinatus tendon tear', category: 'shoulder_impingement_cuff' },
        { input: 'Lumbar disc herniation', category: 'lumbar_disc_herniation' },
        { input: 'Cervical radiculopathy', category: 'cervical_spine_pathology' },
        { input: 'Aortic stenosis', category: 'cardiac_symptomatic_condition' },
        { input: 'Knee replacement', category: 'knee_high_impact' },
        { input: 'Third trimester pregnancy', category: 'pregnancy_late_stage' },
        { input: 'Severe osteoporosis with vertebral compression fracture', category: 'severe_osteoporosis' },
        { input: 'Severe osteoarthritis', category: 'severe_osteoarthritis' },
      ]
      for (const fi of formalInputs) {
        const res = classifyMedicalIntake(fi.input)
        expect(res.activeCategories).toContain(fi.category)
        expect(res.isSafetySensitive).toBe(true)
      }
    })

    it('Invariant D: Active diagnosis is never neutralized by unrelated safe text elsewhere', () => {
      const mixed = 'No shoulder problems, but severe L4-L5 disc herniation'
      const res = classifyMedicalIntake(mixed)
      expect(res.activeCategories).toContain('lumbar_disc_herniation')
      expect(res.isSafetySensitive).toBe(true)
    })

    it('Invariant E: Mixed statements are interpreted per diagnosis', () => {
      const mixed = 'No ACL tear but current meniscus tear'
      const res = classifyMedicalIntake(mixed)
      expect(res.activeCategories).toContain('knee_high_impact')
      expect(res.isSafetySensitive).toBe(true)
    })

    it('Invariant F: Ambiguous safety-critical declarations fail closed', () => {
      const ambiguous = [
        'Possible heart condition, awaiting evaluation',
        'Knee issue, awaiting MRI',
        'Shoulder problem, hurts to lift',
        'Back problem since last month',
      ]
      for (const amb of ambiguous) {
        const res = classifyMedicalIntake(amb)
        expect(res.activeCategories.length).toBeGreaterThan(0)
        expect(res.isSafetySensitive).toBe(true)
      }
    })
  })
})
