/**
 * clinicalPolicyOracle.test.ts
 *
 * Independent Clinical-Policy Ground Truth Oracle & Parity Suite for BodyMap AI.
 * Validates all 170 clinical cases across all 8 contraindication categories:
 * - Shoulder / Rotator Cuff / Impingement / Labrum (25 cases)
 * - Lumbar Spine / Disc Herniation / Sciatica (25 cases)
 * - Knee / ACL / Meniscus Pathology (25 cases)
 * - Cervical Spine / Neck Pathology (20 cases)
 * - Cardiac / Symptomatic Cardiovascular Pathology (25 cases)
 * - Pregnancy (Trimester-Aware / 2nd & 3rd Trimester) (20 cases)
 * - Severe Osteoporosis / Bone Fragility (15 cases)
 * - Severe Osteoarthritis / Degenerative Joint Disease (15 cases)
 *
 * Enforces:
 * 1. 100% agreement with the clinical policy oracle (BLOCK vs ALLOW/GUIDANCE/AMBIGUOUS/OUTSIDE).
 * 2. 100% client-server parity between src/lib/contraindicationGuard.ts and api/generate-plan.ts.
 * 3. Clinical invariants (no handstand push-up exemption, no leg extension exemption for knee, trimester awareness).
 */

import { describe, it, expect } from 'vitest'
import { CLINICAL_POLICY_CASES } from '../lib/clinicalPolicyOracleCases'
import {
  scanPlanForContraindications as clientScanPlan,
  CONTRAINDICATION_TAXONOMY as clientTaxonomy,
} from '../lib/contraindicationGuard'
import { classifyMedicalIntake as clientClassify } from '../lib/medicalIntakeParser'

describe('Clinical Policy Oracle (170 Scenarios)', () => {
  it('contains exactly 170 validated clinical test cases', () => {
    expect(CLINICAL_POLICY_CASES.length).toBe(170)
  })

  it('correctly evaluates all 170 cases with 100% accuracy on client scanner', () => {
    for (const c of CLINICAL_POLICY_CASES) {
      const planMarkdown = `## Day 1: Conditioning & Strength\n### Main Workout\n- ${c.exerciseName}: 3 sets x 10 reps\n`
      const scan = clientScanPlan(planMarkdown, c.conditionDescription)

      const expectedBlock = c.expectedDecision === 'BLOCK'
      const actualBlock = scan.violations.some(v => v.category === c.categoryKey)

      expect(
        actualBlock,
        `Case #${c.id} [${c.categoryKey}] "${c.exerciseName}" for "${c.conditionDescription}" expected ${c.expectedDecision} (block=${expectedBlock}) but got block=${actualBlock}. Rationale: ${c.clinicalRationale}`
      ).toBe(expectedBlock)
    }
  })

  it('guarantees 100% client-server parity across all 170 clinical cases', async () => {
    const serverModule = await import('../../api/generate-plan')
    expect(serverModule.scanPlanForContraindications).toBeDefined()
    expect(serverModule.CONTRAINDICATION_TAXONOMY).toBeDefined()

    for (const c of CLINICAL_POLICY_CASES) {
      const planMarkdown = `## Day 1: Conditioning & Strength\n### Main Workout\n- ${c.exerciseName}: 3 sets x 10 reps\n`
      const clientScan = clientScanPlan(planMarkdown, c.conditionDescription)
      const serverScan = serverModule.scanPlanForContraindications(planMarkdown, c.conditionDescription)

      // Both must agree on overall violation state
      const clientBlock = clientScan.violations.some(v => v.category === c.categoryKey)
      const serverBlock = serverScan.violations.some((v: { category: string }) => v.category === c.categoryKey)

      expect(clientBlock).toBe(serverBlock)
      expect(clientScan.hasViolation).toBe(serverScan.hasViolation)

      const expectedBlock = c.expectedDecision === 'BLOCK'
      expect(serverBlock).toBe(expectedBlock)
    }
  })

  it('verifies clinical invariant: Handstand Push-ups are never exempted as standard push-ups in shoulder injuries', () => {
    const plan = '## Day 1\n- Handstand Push-ups: 3 sets x 5 reps\n'
    const res = clientScanPlan(plan, 'Rotator cuff tear')
    expect(res.hasViolation).toBe(true)
    expect(res.violations[0].category).toBe('shoulder_impingement_cuff')
  })

  it('verifies clinical invariant: Seated leg extensions are not exempt for Knee / ACL pathology', () => {
    // Open-kinetic chain quad leg extensions place anterior tibial shear on ACL grafts
    const kneeExemptions = clientTaxonomy.knee_high_impact.safeExemptions
    const allowsLegExtension = kneeExemptions.some(r => r.source.includes('leg\\s+extensions?'))
    expect(allowsLegExtension).toBe(false)
  })

  it('verifies clinical invariant: First-trimester pregnancy is not categorized as pregnancy_late_stage', () => {
    const firstTrimesterInput = 'First trimester (8 weeks pregnant)'
    const intake = clientClassify(firstTrimesterInput)
    expect(intake.activeCategories).not.toContain('pregnancy_late_stage')

    // Flat bench press is not contraindicated in 1st trimester
    const plan = '## Day 1\n- Flat Dumbbell Bench Press: 3 sets x 10 reps\n'
    const scan = clientScanPlan(plan, firstTrimesterInput)
    expect(scan.hasViolation).toBe(false)
  })

  it('verifies all 8 categories define explicit machine-readable contextualCautions', () => {
    const categories = Object.keys(clientTaxonomy) as Array<keyof typeof clientTaxonomy>
    expect(categories.length).toBe(8)

    for (const cat of categories) {
      const config = clientTaxonomy[cat]
      expect(config.contextualCautions).toBeDefined()
      expect(Array.isArray(config.contextualCautions)).toBe(true)
      expect(config.contextualCautions!.length).toBeGreaterThanOrEqual(3)
    }
  })
})
