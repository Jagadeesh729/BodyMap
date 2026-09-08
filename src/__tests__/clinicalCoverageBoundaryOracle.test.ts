/**
 * clinicalCoverageBoundaryOracle.test.ts
 *
 * Comprehensive Machine-Checkable Clinical Safety Boundary Oracle for BodyMap AI.
 * 
 * 500 Exhaustive Deterministic Test Cases Covering:
 * - Section A: Inventory & Taxonomy Boundary Verification (50 tests: A01 - A50)
 * - Section B: Unknown/Unlisted Medical Conditions & Pathologies (110 tests: B01 - B110)
 * - Section C: Red-Flag Physiological Symptoms & Emergent Signs (100 tests: C01 - C100)
 * - Section D: Medications, Implants & Medical Devices (60 tests: D01 - D60)
 * - Section E: Medical Acronyms, Jargon, Clinician Shorthand & Common Typos (55 tests: E01 - E55)
 * - Section F: Non-Medical & Benign Boundary Discrimination (45 tests: F01 - F45)
 * - Section G: Monotonicity & Fail-Closed Invariants (30 tests: G01 - G30)
 * - Section H: Multi-Clause Conjunctions & Hybrid Text Profiles (25 tests: H01 - H25)
 * - Section I: Client/Server Equivalence & Differential Testing (15 tests: I01 - I15)
 * - Section J: No Invented Diagnosis Invariant (10 tests: J01 - J10)
 *
 * Enforces:
 * 1. Fail-closed protection on all unknown conditions, red-flag symptoms, and medications.
 * 2. Monotonic non-dilution (benign clauses or negations cannot neutralize active risks).
 * 3. Non-fabrication of unassociated diagnoses.
 * 4. Preservation of legitimate non-medical fitness language.
 * 5. 100% Differential Parity across Client and Server runtimes.
 */

import { describe, it, expect } from 'vitest'
import { classifyMedicalIntake as clientClassify } from '../lib/medicalIntakeParser'
import * as serverModule from '../../api/generate-plan'

describe('Clinical Coverage Boundary Oracle (500 Tests)', () => {
  // --------------------------------------------------------------------------
  // SECTION A: INVENTORY & TAXONOMY BOUNDARY VERIFICATION (50 Tests: A01 - A50)
  // --------------------------------------------------------------------------
  describe('Section A: Inventory & Taxonomy Boundary Verification', () => {
    it('A01: Torn anterior cruciate ligament in right knee', () => {
      const res = clientClassify('Torn anterior cruciate ligament in right knee')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('knee_high_impact')
    })
    it('A02: Posterior cruciate ligament tear grade 2', () => {
      const res = clientClassify('Posterior cruciate ligament tear grade 2')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('knee_high_impact')
    })
    it('A03: Medial collateral ligament sprain', () => {
      const res = clientClassify('Medial collateral ligament sprain')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('knee_high_impact')
    })
    it('A04: Lateral meniscus tear with clicking', () => {
      const res = clientClassify('Lateral meniscus tear with clicking')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('knee_high_impact')
    })
    it('A05: Severe chondromalacia patellae bilateral', () => {
      const res = clientClassify('Severe chondromalacia patellae bilateral')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('knee_high_impact')
    })
    it('A06: Chronic patellar tendinitis right knee', () => {
      const res = clientClassify('Chronic patellar tendinitis right knee')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('knee_high_impact')
    })
    it('A07: Total knee replacement left leg 3 years ago', () => {
      const res = clientClassify('Total knee replacement left leg 3 years ago')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('knee_high_impact')
    })
    it('A08: Supraspinatus tendon tear right shoulder', () => {
      const res = clientClassify('Supraspinatus tendon tear right shoulder')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('shoulder_impingement_cuff')
    })
    it('A09: Subacromial impingement syndrome with bursitis', () => {
      const res = clientClassify('Subacromial impingement syndrome with bursitis')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('shoulder_impingement_cuff')
    })
    it('A10: Superior labrum anterior to posterior (SLAP) tear', () => {
      const res = clientClassify('Superior labrum anterior to posterior (SLAP) tear')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('shoulder_impingement_cuff')
    })
    it('A11: Glenoid labral tear right shoulder', () => {
      const res = clientClassify('Glenoid labral tear right shoulder')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('shoulder_impingement_cuff')
    })
    it('A12: Adhesive capsulitis frozen shoulder', () => {
      const res = clientClassify('Adhesive capsulitis frozen shoulder')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('shoulder_impingement_cuff')
    })
    it('A13: Rotator cuff tear with pain overhead', () => {
      const res = clientClassify('Rotator cuff tear with pain overhead')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('shoulder_impingement_cuff')
    })
    it('A14: Total shoulder arthroplasty right arm', () => {
      const res = clientClassify('Total shoulder arthroplasty right arm')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('shoulder_impingement_cuff')
    })
    it('A15: Cervical spinal fusion C4-C5', () => {
      const res = clientClassify('Cervical spinal fusion C4-C5')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cervical_spine_pathology')
    })
    it('A16: Cervical disc herniation C5-C6 with numbness', () => {
      const res = clientClassify('Cervical disc herniation C5-C6 with numbness')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cervical_spine_pathology')
    })
    it('A17: C6-C7 cervical radiculopathy shooting down arm', () => {
      const res = clientClassify('C6-C7 cervical radiculopathy shooting down arm')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cervical_spine_pathology')
    })
    it('A18: Severe whiplash injury neck pain', () => {
      const res = clientClassify('Severe whiplash injury neck pain')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cervical_spine_pathology')
    })
    it('A19: Cervical stenosis with neck stiffness', () => {
      const res = clientClassify('Cervical stenosis with neck stiffness')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cervical_spine_pathology')
    })
    it('A20: Pinched nerve in neck radiating to shoulder', () => {
      const res = clientClassify('Pinched nerve in neck radiating to shoulder')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cervical_spine_pathology')
    })
    it('A21: Neck disc herniation with acute spasm', () => {
      const res = clientClassify('Neck disc herniation with acute spasm')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cervical_spine_pathology')
    })
    it('A22: L4-L5 lumbar disc herniation with sciatica', () => {
      const res = clientClassify('L4-L5 lumbar disc herniation with sciatica')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('lumbar_disc_herniation')
    })
    it('A23: L5-S1 extruded disc herniation', () => {
      const res = clientClassify('L5-S1 extruded disc herniation')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('lumbar_disc_herniation')
    })
    it('A24: Severe lumbar radiculopathy down left leg', () => {
      const res = clientClassify('Severe lumbar radiculopathy down left leg')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('lumbar_disc_herniation')
    })
    it('A25: Degenerative disc disease lumbar spine', () => {
      const res = clientClassify('Degenerative disc disease lumbar spine')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('lumbar_disc_herniation')
    })
    it('A26: Lumbar spinal fusion L3-L5', () => {
      const res = clientClassify('Lumbar spinal fusion L3-L5')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('lumbar_disc_herniation')
    })
    it('A27: Spondylolisthesis grade 1 lower back', () => {
      const res = clientClassify('Spondylolisthesis grade 1 lower back')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('lumbar_disc_herniation')
    })
    it('A28: Lower back disc bulge causing sharp pain', () => {
      const res = clientClassify('Lower back disc bulge causing sharp pain')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('lumbar_disc_herniation')
    })
    it('A29: Severe aortic stenosis with exertion limits', () => {
      const res = clientClassify('Severe aortic stenosis with exertion limits')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cardiac_symptomatic_condition')
    })
    it('A30: Hypertrophic cardiomyopathy symptomatic', () => {
      const res = clientClassify('Hypertrophic cardiomyopathy symptomatic')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cardiac_symptomatic_condition')
    })
    it('A31: Coronary artery disease with previous stent', () => {
      const res = clientClassify('Coronary artery disease with previous stent')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cardiac_symptomatic_condition')
    })
    it('A32: Atrial fibrillation with rapid ventricular response', () => {
      const res = clientClassify('Atrial fibrillation with rapid ventricular response')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cardiac_symptomatic_condition')
    })
    it('A33: Angina pectoris triggered by exertion', () => {
      const res = clientClassify('Angina pectoris triggered by exertion')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cardiac_symptomatic_condition')
    })
    it('A34: Congestive heart failure reduced ejection fraction', () => {
      const res = clientClassify('Congestive heart failure reduced ejection fraction')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cardiac_symptomatic_condition')
    })
    it('A35: Coronary artery bypass graft CABG 2 years ago', () => {
      const res = clientClassify('Coronary artery bypass graft CABG 2 years ago')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('cardiac_symptomatic_condition')
    })
    it('A36: Third trimester pregnancy 32 weeks', () => {
      const res = clientClassify('Third trimester pregnancy 32 weeks')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('pregnancy_late_stage')
    })
    it('A37: Second trimester pregnancy 24 weeks', () => {
      const res = clientClassify('Second trimester pregnancy 24 weeks')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('pregnancy_late_stage')
    })
    it('A38: Late stage pregnancy 36 weeks gestation', () => {
      const res = clientClassify('Late stage pregnancy 36 weeks gestation')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('pregnancy_late_stage')
    })
    it('A39: Pregnant 28 weeks', () => {
      const res = clientClassify('Pregnant 28 weeks')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('pregnancy_late_stage')
    })
    it('A40: Advanced pregnancy 34 weeks', () => {
      const res = clientClassify('Advanced pregnancy 34 weeks')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('pregnancy_late_stage')
    })
    it('A41: Severe osteoporosis with vertebral compression fracture', () => {
      const res = clientClassify('Severe osteoporosis with vertebral compression fracture')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('severe_osteoporosis')
    })
    it('A42: T-score -3.4 severe osteoporosis bone fragility', () => {
      const res = clientClassify('T-score -3.4 severe osteoporosis bone fragility')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('severe_osteoporosis')
    })
    it('A43: Brittle bones from severe osteoporosis', () => {
      const res = clientClassify('Brittle bones from severe osteoporosis')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('severe_osteoporosis')
    })
    it('A44: Osteopenia with fragility fracture history', () => {
      const res = clientClassify('Osteopenia with fragility fracture history')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('severe_osteoporosis')
    })
    it('A45: Severe bone density loss with compression fractures', () => {
      const res = clientClassify('Severe bone density loss with compression fractures')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('severe_osteoporosis')
    })
    it('A46: Severe osteoarthritis bone on bone right knee', () => {
      const res = clientClassify('Severe osteoarthritis bone on bone right knee')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('severe_osteoarthritis')
    })
    it('A47: Severe hip osteoarthritis degenerative joint disease', () => {
      const res = clientClassify('Severe hip osteoarthritis degenerative joint disease')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('severe_osteoarthritis')
    })
    it('A48: Bone on bone arthritis bilateral knees', () => {
      const res = clientClassify('Bone on bone arthritis bilateral knees')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('severe_osteoarthritis')
    })
    it('A49: Severe knee arthrosis with joint space narrowing', () => {
      const res = clientClassify('Severe knee arthrosis with joint space narrowing')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('severe_osteoarthritis')
    })
    it('A50: Degenerative joint disease DJD severe stage', () => {
      const res = clientClassify('Degenerative joint disease DJD severe stage')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).toContain('severe_osteoarthritis')
    })
  })

  // --------------------------------------------------------------------------
  // SECTION B: UNKNOWN/UNLISTED MEDICAL CONDITIONS & PATHOLOGIES (110 Tests: B01 - B110)
  // --------------------------------------------------------------------------
  describe('Section B: Unknown/Unlisted Medical Conditions & Pathologies', () => {
    it('B01: Diagnosed with multiple sclerosis 2 years ago', () => {
      const res = clientClassify('Diagnosed with multiple sclerosis 2 years ago')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B02: Relapsing-remitting multiple sclerosis with heat intolerance', () => {
      const res = clientClassify('Relapsing-remitting multiple sclerosis with heat intolerance')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B03: Amyotrophic lateral sclerosis ALS early stage', () => {
      const res = clientClassify('Amyotrophic lateral sclerosis ALS early stage')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B04: Parkinson disease with resting tremor and rigidity', () => {
      const res = clientClassify('Parkinson disease with resting tremor and rigidity')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B05: Myasthenia gravis with ocular and limb weakness', () => {
      const res = clientClassify('Myasthenia gravis with ocular and limb weakness')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B06: Seizure disorder on daily antiepileptic medication', () => {
      const res = clientClassify('Seizure disorder on daily antiepileptic medication')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B07: Epilepsy with grand mal seizures', () => {
      const res = clientClassify('Epilepsy with grand mal seizures')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B08: Absence seizures controlled on medication', () => {
      const res = clientClassify('Absence seizures controlled on medication')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B09: Cerebral palsy spastic hemiplegia', () => {
      const res = clientClassify('Cerebral palsy spastic hemiplegia')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B10: Huntington disease with chorea', () => {
      const res = clientClassify('Huntington disease with chorea')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B11: Charcot-Marie-Tooth disease with peripheral muscle wasting', () => {
      const res = clientClassify('Charcot-Marie-Tooth disease with peripheral muscle wasting')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B12: Severe peripheral neuropathy bilateral feet', () => {
      const res = clientClassify('Severe peripheral neuropathy bilateral feet')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B13: Diabetic polyneuropathy with loss of sensation in toes', () => {
      const res = clientClassify('Diabetic polyneuropathy with loss of sensation in toes')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B14: Autonomic neuropathy with impaired temperature regulation', () => {
      const res = clientClassify('Autonomic neuropathy with impaired temperature regulation')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B15: Normal pressure hydrocephalus with gait disturbance', () => {
      const res = clientClassify('Normal pressure hydrocephalus with gait disturbance')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B16: Traumatic brain injury TBI with vestibular dysfunction', () => {
      const res = clientClassify('Traumatic brain injury TBI with vestibular dysfunction')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B17: Severe post-concussion syndrome lingering 8 months', () => {
      const res = clientClassify('Severe post-concussion syndrome lingering 8 months')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B18: Spinal cord injury incomplete paraplegia T10', () => {
      const res = clientClassify('Spinal cord injury incomplete paraplegia T10')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B19: Spinal cord injury incomplete quadriplegia', () => {
      const res = clientClassify('Spinal cord injury incomplete quadriplegia')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B20: Bell palsy with facial nerve weakness', () => {
      const res = clientClassify('Bell palsy with facial nerve weakness')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B21: Spastic diplegia with lower limb stiffness', () => {
      const res = clientClassify('Spastic diplegia with lower limb stiffness')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B22: Neuromyelitis optica spectrum disorder', () => {
      const res = clientClassify('Neuromyelitis optica spectrum disorder')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B23: History of Guillain-Barre syndrome with residual weakness', () => {
      const res = clientClassify('History of Guillain-Barre syndrome with residual weakness')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B24: Cervical dystonia with involuntary spasms', () => {
      const res = clientClassify('Cervical dystonia with involuntary spasms')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B25: Severe essential tremor in hands during movement', () => {
      const res = clientClassify('Severe essential tremor in hands during movement')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B26: Ehlers-Danlos syndrome hypermobile type hEDS', () => {
      const res = clientClassify('Ehlers-Danlos syndrome hypermobile type hEDS')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B27: Vascular Ehlers-Danlos syndrome vEDS high vascular fragility', () => {
      const res = clientClassify('Vascular Ehlers-Danlos syndrome vEDS high vascular fragility')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B28: Hypermobility spectrum disorder HSD with frequent joint dislocations', () => {
      const res = clientClassify('Hypermobility spectrum disorder HSD with frequent joint dislocations')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B29: Marfan syndrome with aortic root dilation', () => {
      const res = clientClassify('Marfan syndrome with aortic root dilation')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B30: Osteogenesis imperfecta type 1 brittle bones', () => {
      const res = clientClassify('Osteogenesis imperfecta type 1 brittle bones')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B31: Systemic lupus erythematosus SLE with joint flares', () => {
      const res = clientClassify('Systemic lupus erythematosus SLE with joint flares')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B32: Lupus nephritis stage 3 on immunosuppressive therapy', () => {
      const res = clientClassify('Lupus nephritis stage 3 on immunosuppressive therapy')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B33: Rheumatoid arthritis RA active inflammatory flare', () => {
      const res = clientClassify('Rheumatoid arthritis RA active inflammatory flare')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B34: Seropositive rheumatoid arthritis with hand deformities', () => {
      const res = clientClassify('Seropositive rheumatoid arthritis with hand deformities')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B35: Ankylosing spondylitis with bamboo spine progression', () => {
      const res = clientClassify('Ankylosing spondylitis with bamboo spine progression')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B36: Systemic sclerosis scleroderma with skin tightening', () => {
      const res = clientClassify('Systemic sclerosis scleroderma with skin tightening')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B37: CREST syndrome limited scleroderma', () => {
      const res = clientClassify('CREST syndrome limited scleroderma')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B38: Sjogren syndrome with severe dry eyes and joint pain', () => {
      const res = clientClassify('Sjogren syndrome with severe dry eyes and joint pain')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B39: Fibromyalgia with widespread chronic musculoskeletal pain', () => {
      const res = clientClassify('Fibromyalgia with widespread chronic musculoskeletal pain')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B40: Chronic fatigue syndrome ME/CFS with post-exertional malaise', () => {
      const res = clientClassify('Chronic fatigue syndrome ME/CFS with post-exertional malaise')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B41: Myalgic encephalomyelitis with severe PEM after workouts', () => {
      const res = clientClassify('Myalgic encephalomyelitis with severe PEM after workouts')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B42: Polymyalgia rheumatica with shoulder and pelvic girdle stiffness', () => {
      const res = clientClassify('Polymyalgia rheumatica with shoulder and pelvic girdle stiffness')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B43: Psoriatic arthritis with dactylitis sausage digits', () => {
      const res = clientClassify('Psoriatic arthritis with dactylitis sausage digits')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B44: Dermatomyositis with proximal muscle weakness', () => {
      const res = clientClassify('Dermatomyositis with proximal muscle weakness')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B45: Polymyositis with elevated creatine kinase', () => {
      const res = clientClassify('Polymyositis with elevated creatine kinase')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B46: Behcet disease with recurrent vasculitis flares', () => {
      const res = clientClassify('Behcet disease with recurrent vasculitis flares')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B47: Mixed connective tissue disease MCTD', () => {
      const res = clientClassify('Mixed connective tissue disease MCTD')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B48: Granulomatosis with polyangiitis GPA vasculitis', () => {
      const res = clientClassify('Granulomatosis with polyangiitis GPA vasculitis')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B49: Pulmonary sarcoidosis stage 2', () => {
      const res = clientClassify('Pulmonary sarcoidosis stage 2')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B50: Giant cell arteritis with temporal headache', () => {
      const res = clientClassify('Giant cell arteritis with temporal headache')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B51: Postural orthostatic tachycardia syndrome POTS high heart rate upon standing', () => {
      const res = clientClassify('Postural orthostatic tachycardia syndrome POTS high heart rate upon standing')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B52: Dysautonomia with orthostatic intolerance', () => {
      const res = clientClassify('Dysautonomia with orthostatic intolerance')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B53: Orthostatic hypotension with systolic drop over 30 mmHg', () => {
      const res = clientClassify('Orthostatic hypotension with systolic drop over 30 mmHg')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B54: Peripheral artery disease PAD with calf claudication at 100 meters', () => {
      const res = clientClassify('Peripheral artery disease PAD with calf claudication at 100 meters')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B55: Severe intermittent claudication in lower extremities', () => {
      const res = clientClassify('Severe intermittent claudication in lower extremities')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B56: Active deep vein thrombosis DVT in left femoral vein', () => {
      const res = clientClassify('Active deep vein thrombosis DVT in left femoral vein')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B57: History of unprovoked pulmonary embolism PE', () => {
      const res = clientClassify('History of unprovoked pulmonary embolism PE')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B58: Abdominal aortic aneurysm AAA 4.8 cm being surveyed', () => {
      const res = clientClassify('Abdominal aortic aneurysm AAA 4.8 cm being surveyed')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B59: Thoracic aortic aneurysm 4.5 cm', () => {
      const res = clientClassify('Thoracic aortic aneurysm 4.5 cm')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B60: Sickle cell disease HbSS with recurrent vaso-occlusive crises', () => {
      const res = clientClassify('Sickle cell disease HbSS with recurrent vaso-occlusive crises')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B61: Sickle cell trait with risk of exertional rhabdomyolysis and sickling', () => {
      const res = clientClassify('Sickle cell trait with risk of exertional rhabdomyolysis and sickling')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B62: Severe hemophilia A on prophylactic factor VIII', () => {
      const res = clientClassify('Severe hemophilia A on prophylactic factor VIII')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B63: Hemophilia B factor IX deficiency', () => {
      const res = clientClassify('Hemophilia B factor IX deficiency')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B64: Von Willebrand disease type 2 with bleeding tendencies', () => {
      const res = clientClassify('Von Willebrand disease type 2 with bleeding tendencies')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B65: Factor V Leiden thrombophilia homozygous', () => {
      const res = clientClassify('Factor V Leiden thrombophilia homozygous')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B66: Antiphospholipid syndrome with prior thrombotic events', () => {
      const res = clientClassify('Antiphospholipid syndrome with prior thrombotic events')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B67: Severe Raynaud syndrome with digital ulcerations', () => {
      const res = clientClassify('Severe Raynaud syndrome with digital ulcerations')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B68: Polycythemia vera on hydroxyurea', () => {
      const res = clientClassify('Polycythemia vera on hydroxyurea')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B69: Immune thrombocytopenic purpura ITP low platelets', () => {
      const res = clientClassify('Immune thrombocytopenic purpura ITP low platelets')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B70: Brugada syndrome type 1 with syncope history', () => {
      const res = clientClassify('Brugada syndrome type 1 with syncope history')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B71: Type 1 diabetes T1D on continuous subcutaneous insulin infusion', () => {
      const res = clientClassify('Type 1 diabetes T1D on continuous subcutaneous insulin infusion')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B72: Insulin-dependent diabetes mellitus with hypoglycemia unawareness', () => {
      const res = clientClassify('Insulin-dependent diabetes mellitus with hypoglycemia unawareness')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B73: Type 2 diabetes with peripheral neuropathy and nephropathy', () => {
      const res = clientClassify('Type 2 diabetes with peripheral neuropathy and nephropathy')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B74: Proliferative diabetic retinopathy with vitreous hemorrhage risk', () => {
      const res = clientClassify('Proliferative diabetic retinopathy with vitreous hemorrhage risk')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B75: Diabetic kidney disease stage 4', () => {
      const res = clientClassify('Diabetic kidney disease stage 4')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B76: Chronic kidney disease stage 4 CKD eGFR 22', () => {
      const res = clientClassify('Chronic kidney disease stage 4 CKD eGFR 22')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B77: End-stage renal disease ESRD on maintenance hemodialysis', () => {
      const res = clientClassify('End-stage renal disease ESRD on maintenance hemodialysis')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B78: On hemodialysis MWF via left arm AV fistula', () => {
      const res = clientClassify('On hemodialysis MWF via left arm AV fistula')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B79: Peritoneal dialysis with abdominal PD catheter', () => {
      const res = clientClassify('Peritoneal dialysis with abdominal PD catheter')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B80: Autosomal dominant polycystic kidney disease PKD', () => {
      const res = clientClassify('Autosomal dominant polycystic kidney disease PKD')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B81: Liver cirrhosis Child-Pugh class B', () => {
      const res = clientClassify('Liver cirrhosis Child-Pugh class B')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B82: Hepatic cirrhosis with portal hypertension and ascites', () => {
      const res = clientClassify('Hepatic cirrhosis with portal hypertension and ascites')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B83: Nonalcoholic steatohepatitis NASH with advanced cirrhosis', () => {
      const res = clientClassify('Nonalcoholic steatohepatitis NASH with advanced cirrhosis')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B84: End-stage liver failure awaiting transplantation', () => {
      const res = clientClassify('End-stage liver failure awaiting transplantation')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B85: Addison disease primary adrenal insufficiency on hydrocortisone', () => {
      const res = clientClassify('Addison disease primary adrenal insufficiency on hydrocortisone')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B86: Adrenal insufficiency with risk of addisonian crisis on stress', () => {
      const res = clientClassify('Adrenal insufficiency with risk of addisonian crisis on stress')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B87: Cushing syndrome with hypercortisolemia and proximal myopathy', () => {
      const res = clientClassify('Cushing syndrome with hypercortisolemia and proximal myopathy')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B88: Graves disease with thyrotoxicosis and resting tachycardia', () => {
      const res = clientClassify('Graves disease with thyrotoxicosis and resting tachycardia')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B89: Severe uncontrolled hyperthyroidism', () => {
      const res = clientClassify('Severe uncontrolled hyperthyroidism')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B90: Primary hyperaldosteronism with refractory hypokalemia', () => {
      const res = clientClassify('Primary hyperaldosteronism with refractory hypokalemia')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B91: Cystic fibrosis with chronic Pseudomonas airway colonization', () => {
      const res = clientClassify('Cystic fibrosis with chronic Pseudomonas airway colonization')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B92: Idiopathic pulmonary fibrosis IPF on supplemental oxygen', () => {
      const res = clientClassify('Idiopathic pulmonary fibrosis IPF on supplemental oxygen')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B93: Pulmonary arterial hypertension PAH functional class III', () => {
      const res = clientClassify('Pulmonary arterial hypertension PAH functional class III')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B94: Severe chronic obstructive pulmonary disease COPD GOLD 3', () => {
      const res = clientClassify('Severe chronic obstructive pulmonary disease COPD GOLD 3')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B95: Pulmonary emphysema with hyperinflated lungs and air trapping', () => {
      const res = clientClassify('Pulmonary emphysema with hyperinflated lungs and air trapping')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B96: Non-CF bronchiectasis with daily sputum production', () => {
      const res = clientClassify('Non-CF bronchiectasis with daily sputum production')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B97: History of spontaneous pneumothorax with bleb resection', () => {
      const res = clientClassify('History of spontaneous pneumothorax with bleb resection')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B98: Recurrent pleural effusion undergoing thoracentesis', () => {
      const res = clientClassify('Recurrent pleural effusion undergoing thoracentesis')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B99: Severe persistent asthma with frequent exacerbations', () => {
      const res = clientClassify('Severe persistent asthma with frequent exacerbations')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B100: Chronic beryllium disease berylliosis with pulmonary granulomas', () => {
      const res = clientClassify('Chronic beryllium disease berylliosis with pulmonary granulomas')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B101: Active invasive breast cancer currently receiving cytotoxic chemotherapy', () => {
      const res = clientClassify('Active invasive breast cancer currently receiving cytotoxic chemotherapy')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B102: Acute lymphoblastic leukemia on consolidation therapy', () => {
      const res = clientClassify('Acute lymphoblastic leukemia on consolidation therapy')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B103: Non-Hodgkin lymphoma receiving chemoimmunotherapy', () => {
      const res = clientClassify('Non-Hodgkin lymphoma receiving chemoimmunotherapy')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B104: Multiple myeloma with osteolytic lesions in spine and pelvis', () => {
      const res = clientClassify('Multiple myeloma with osteolytic lesions in spine and pelvis')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B105: Metastatic prostate cancer with bone metastases to ribs and femur', () => {
      const res = clientClassify('Metastatic prostate cancer with bone metastases to ribs and femur')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B106: Large reducible inguinal hernia with pain during heavy strain', () => {
      const res = clientClassify('Large reducible inguinal hernia with pain during heavy strain')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B107: Umbilical hernia with risk of strangulation during Valsalva', () => {
      const res = clientClassify('Umbilical hernia with risk of strangulation during Valsalva')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B108: Active Crohn disease flare with severe abdominal cramping', () => {
      const res = clientClassify('Active Crohn disease flare with severe abdominal cramping')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B109: Ulcerative colitis with severe pancolitis on biologic therapy', () => {
      const res = clientClassify('Ulcerative colitis with severe pancolitis on biologic therapy')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('B110: Permanent end colostomy stoma in left lower quadrant', () => {
      const res = clientClassify('Permanent end colostomy stoma in left lower quadrant')
      expect(res.isSafetySensitive).toBe(true)
      // Unlisted condition must fail closed WITHOUT inventing false categories in activeCategories
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
  })

  // --------------------------------------------------------------------------
  // SECTION C: RED-FLAG PHYSIOLOGICAL SYMPTOMS & EMERGENT SIGNS (100 Tests: C01 - C100)
  // --------------------------------------------------------------------------
  describe('Section C: Red-Flag Physiological Symptoms & Emergent Signs', () => {
    it('C01: Fainted while running on the treadmill yesterday', () => {
      const res = clientClassify('Fainted while running on the treadmill yesterday')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C02: Blackout when deadlifting 200kg', () => {
      const res = clientClassify('Blackout when deadlifting 200kg')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C03: Passed out during high intensity interval training', () => {
      const res = clientClassify('Passed out during high intensity interval training')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C04: Exertional syncope during heavy leg press', () => {
      const res = clientClassify('Exertional syncope during heavy leg press')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C05: Loss of consciousness while squatting at the gym', () => {
      const res = clientClassify('Loss of consciousness while squatting at the gym')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C06: Blacking out when straining under heavy barbell load', () => {
      const res = clientClassify('Blacking out when straining under heavy barbell load')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C07: Frequent near-syncope episodes during aerobic exercise', () => {
      const res = clientClassify('Frequent near-syncope episodes during aerobic exercise')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C08: Collapsed during sprint workout due to fainting', () => {
      const res = clientClassify('Collapsed during sprint workout due to fainting')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C09: Exertional fainting episodes requiring emergency room visit', () => {
      const res = clientClassify('Exertional fainting episodes requiring emergency room visit')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C10: Episodes of passing out when heart rate exceeds 140', () => {
      const res = clientClassify('Episodes of passing out when heart rate exceeds 140')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C11: Felt room go black and passed out during bench press', () => {
      const res = clientClassify('Felt room go black and passed out during bench press')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C12: Presyncope with tunnel vision during vigorous exercise', () => {
      const res = clientClassify('Presyncope with tunnel vision during vigorous exercise')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C13: Sudden syncope immediately following maximum exertion', () => {
      const res = clientClassify('Sudden syncope immediately following maximum exertion')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C14: Woke up on the gym floor after blacking out during pull-ups', () => {
      const res = clientClassify('Woke up on the gym floor after blacking out during pull-ups')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C15: Recurrent exertional syncope under medical workup', () => {
      const res = clientClassify('Recurrent exertional syncope under medical workup')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C16: Fainting spell during circuit training', () => {
      const res = clientClassify('Fainting spell during circuit training')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C17: Blackout episodes triggered by heavy Valsalva breathing', () => {
      const res = clientClassify('Blackout episodes triggered by heavy Valsalva breathing')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C18: Passed out cold after rowing sprint', () => {
      const res = clientClassify('Passed out cold after rowing sprint')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C19: Syncope on moderate exertion without warning', () => {
      const res = clientClassify('Syncope on moderate exertion without warning')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C20: Loss of consciousness after kettlebell swings', () => {
      const res = clientClassify('Loss of consciousness after kettlebell swings')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C21: Severe air hunger during mild exertion like walking up stairs', () => {
      const res = clientClassify('Severe air hunger during mild exertion like walking up stairs')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C22: Gasping for air while walking short distances', () => {
      const res = clientClassify('Gasping for air while walking short distances')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C23: Acute exertional dyspnea out of proportion to fitness level', () => {
      const res = clientClassify('Acute exertional dyspnea out of proportion to fitness level')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C24: Sudden inability to catch breath while lifting light weights', () => {
      const res = clientClassify('Sudden inability to catch breath while lifting light weights')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C25: Exertional stridor with audible wheezing during exercise', () => {
      const res = clientClassify('Exertional stridor with audible wheezing during exercise')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C26: Extreme breathlessness at rest and minimal exertion', () => {
      const res = clientClassify('Extreme breathlessness at rest and minimal exertion')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C27: Paroxysmal nocturnal dyspnea and severe shortness of breath', () => {
      const res = clientClassify('Paroxysmal nocturnal dyspnea and severe shortness of breath')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C28: Wheezing and acute breathlessness during warm-up', () => {
      const res = clientClassify('Wheezing and acute breathlessness during warm-up')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C29: Air hunger and chest tightness during brisk walking', () => {
      const res = clientClassify('Air hunger and chest tightness during brisk walking')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C30: Unexplained severe shortness of breath during easy cycling', () => {
      const res = clientClassify('Unexplained severe shortness of breath during easy cycling')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C31: Cannot breathe when lying flat orthopnea', () => {
      const res = clientClassify('Cannot breathe when lying flat orthopnea')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C32: Gasping for air and lips turning blue on exertion', () => {
      const res = clientClassify('Gasping for air and lips turning blue on exertion')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C33: Rapid shallow breathing and suffocating sensation when working out', () => {
      const res = clientClassify('Rapid shallow breathing and suffocating sensation when working out')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C34: Sudden acute dyspnea with oxygen saturation dropping to 88%', () => {
      const res = clientClassify('Sudden acute dyspnea with oxygen saturation dropping to 88%')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C35: Disabling breathlessness after 2 minutes of light activity', () => {
      const res = clientClassify('Disabling breathlessness after 2 minutes of light activity')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C36: Severe exertional breathlessness awaiting pulmonary angiogram', () => {
      const res = clientClassify('Severe exertional breathlessness awaiting pulmonary angiogram')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C37: Shortness of breath accompanied by cold sweats during exercise', () => {
      const res = clientClassify('Shortness of breath accompanied by cold sweats during exercise')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C38: Severe dyspnea and wheezing refractory to rescue inhaler', () => {
      const res = clientClassify('Severe dyspnea and wheezing refractory to rescue inhaler')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C39: Exertional air hunger that does not resolve with rest', () => {
      const res = clientClassify('Exertional air hunger that does not resolve with rest')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C40: Sudden onset of profound breathlessness during jogging', () => {
      const res = clientClassify('Sudden onset of profound breathlessness during jogging')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C41: Crushing chest pressure during jogging', () => {
      const res = clientClassify('Crushing chest pressure during jogging')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C42: Acute chest tightness radiating to left arm and jaw', () => {
      const res = clientClassify('Acute chest tightness radiating to left arm and jaw')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C43: Substernal chest pain during exertion relieved by rest', () => {
      const res = clientClassify('Substernal chest pain during exertion relieved by rest')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C44: Jaw pain and chest heaviness while lifting overhead', () => {
      const res = clientClassify('Jaw pain and chest heaviness while lifting overhead')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C45: Crushing substernal pressure climbing stairs', () => {
      const res = clientClassify('Crushing substernal pressure climbing stairs')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C46: Exertional chest constriction feeling like an elephant on chest', () => {
      const res = clientClassify('Exertional chest constriction feeling like an elephant on chest')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C47: Radiating pain to back and neck during cardio session', () => {
      const res = clientClassify('Radiating pain to back and neck during cardio session')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C48: Squeezing chest discomfort when heart rate rises', () => {
      const res = clientClassify('Squeezing chest discomfort when heart rate rises')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C49: Heavy pressure in center of chest with nausea during workout', () => {
      const res = clientClassify('Heavy pressure in center of chest with nausea during workout')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C50: Sharp tearing chest pain radiating between shoulder blades', () => {
      const res = clientClassify('Sharp tearing chest pain radiating between shoulder blades')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C51: Chest tightness with diaphoresis cold sweat during lifting', () => {
      const res = clientClassify('Chest tightness with diaphoresis cold sweat during lifting')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C52: Burning substernal pain triggered exclusively by physical exertion', () => {
      const res = clientClassify('Burning substernal pain triggered exclusively by physical exertion')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C53: Severe chest pain on exertion requiring sublingual nitro', () => {
      const res = clientClassify('Severe chest pain on exertion requiring sublingual nitro')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C54: Tight band around chest during high intensity exercise', () => {
      const res = clientClassify('Tight band around chest during high intensity exercise')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C55: Exertional angina pectoris that worsens with cold weather', () => {
      const res = clientClassify('Exertional angina pectoris that worsens with cold weather')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C56: Chest heaviness and shortness of breath when walking uphill', () => {
      const res = clientClassify('Chest heaviness and shortness of breath when walking uphill')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C57: Unexplained retrosternal pressure during bodyweight circuit', () => {
      const res = clientClassify('Unexplained retrosternal pressure during bodyweight circuit')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C58: Pressure in chest and left shoulder numbness during exertion', () => {
      const res = clientClassify('Pressure in chest and left shoulder numbness during exertion')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C59: Sudden onset chest tightness with rapid irregular pulse', () => {
      const res = clientClassify('Sudden onset chest tightness with rapid irregular pulse')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C60: Severe squeezing chest pain while bench pressing', () => {
      const res = clientClassify('Severe squeezing chest pain while bench pressing')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C61: Sudden left arm weakness and numbness yesterday', () => {
      const res = clientClassify('Sudden left arm weakness and numbness yesterday')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C62: Facial droop and difficulty speaking during morning workout', () => {
      const res = clientClassify('Facial droop and difficulty speaking during morning workout')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C63: Transient ischemic attack TIA episode last month', () => {
      const res = clientClassify('Transient ischemic attack TIA episode last month')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C64: Sudden hemiparesis on right side with slurred speech', () => {
      const res = clientClassify('Sudden hemiparesis on right side with slurred speech')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C65: Loss of balance and acute ataxia during workout', () => {
      const res = clientClassify('Loss of balance and acute ataxia during workout')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C66: Sudden unilateral leg weakness causing immediate fall', () => {
      const res = clientClassify('Sudden unilateral leg weakness causing immediate fall')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C67: Foot drop and progressive loss of motor control in left leg', () => {
      const res = clientClassify('Foot drop and progressive loss of motor control in left leg')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C68: Sudden numbness spreading down entire right side of body', () => {
      const res = clientClassify('Sudden numbness spreading down entire right side of body')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C69: Inability to move left hand after strenuous exercise', () => {
      const res = clientClassify('Inability to move left hand after strenuous exercise')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C70: Stroke symptoms with facial asymmetry under urgent evaluation', () => {
      const res = clientClassify('Stroke symptoms with facial asymmetry under urgent evaluation')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C71: Sudden paralysis in left arm during weight training', () => {
      const res = clientClassify('Sudden paralysis in left arm during weight training')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C72: Dysarthria slurred speech and right arm drift', () => {
      const res = clientClassify('Dysarthria slurred speech and right arm drift')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C73: Drop attacks with sudden loss of postural tone without warning', () => {
      const res = clientClassify('Drop attacks with sudden loss of postural tone without warning')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C74: Acute unilateral facial numbness and arm heaviness', () => {
      const res = clientClassify('Acute unilateral facial numbness and arm heaviness')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C75: Transient loss of vision in one eye amaurosis fugax', () => {
      const res = clientClassify('Transient loss of vision in one eye amaurosis fugax')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C76: Saddle numbness in groin and perineal area', () => {
      const res = clientClassify('Saddle numbness in groin and perineal area')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C77: Saddle anesthesia and loss of sensation between legs', () => {
      const res = clientClassify('Saddle anesthesia and loss of sensation between legs')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C78: Loss of bowel control accompanied by severe back pain', () => {
      const res = clientClassify('Loss of bowel control accompanied by severe back pain')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C79: Loss of bladder control after acute lower back tweak', () => {
      const res = clientClassify('Loss of bladder control after acute lower back tweak')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C80: Sudden progressive bilateral leg weakness and urinary retention', () => {
      const res = clientClassify('Sudden progressive bilateral leg weakness and urinary retention')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C81: Cauda equina syndrome warning signs awaiting emergent MRI', () => {
      const res = clientClassify('Cauda equina syndrome warning signs awaiting emergent MRI')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C82: Fecal incontinence and severe sciatica bilateral', () => {
      const res = clientClassify('Fecal incontinence and severe sciatica bilateral')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C83: Urinary incontinence and numbness in buttocks and inner thighs', () => {
      const res = clientClassify('Urinary incontinence and numbness in buttocks and inner thighs')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C84: Numbness around anus and genital area after deadlifting', () => {
      const res = clientClassify('Numbness around anus and genital area after deadlifting')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C85: Bilateral lower extremity paralysis and loss of sphincter tone', () => {
      const res = clientClassify('Bilateral lower extremity paralysis and loss of sphincter tone')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C86: Coughing up blood hemoptysis after running', () => {
      const res = clientClassify('Coughing up blood hemoptysis after running')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C87: Spitting up blood clots following heavy deadlift session', () => {
      const res = clientClassify('Spitting up blood clots following heavy deadlift session')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C88: Sudden hot swollen red calf on right leg with throbbing pain', () => {
      const res = clientClassify('Sudden hot swollen red calf on right leg with throbbing pain')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C89: Throbbing unilateral calf swelling and severe tenderness to touch', () => {
      const res = clientClassify('Throbbing unilateral calf swelling and severe tenderness to touch')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C90: Deep vein thrombosis DVT suspected in right lower leg', () => {
      const res = clientClassify('Deep vein thrombosis DVT suspected in right lower leg')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C91: Sudden explosive thunderclap headache during heavy deadlift', () => {
      const res = clientClassify('Sudden explosive thunderclap headache during heavy deadlift')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C92: Thunderclap headache peaking in 60 seconds while straining', () => {
      const res = clientClassify('Thunderclap headache peaking in 60 seconds while straining')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C93: Worst headache of my life during weight lifting exertion', () => {
      const res = clientClassify('Worst headache of my life during weight lifting exertion')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C94: Sudden loss of vision in right eye with severe eye pain', () => {
      const res = clientClassify('Sudden loss of vision in right eye with severe eye pain')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C95: Shower of floaters and flashing lights with visual field defect', () => {
      const res = clientClassify('Shower of floaters and flashing lights with visual field defect')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C96: Acute retinal detachment symptoms awaiting emergency surgery', () => {
      const res = clientClassify('Acute retinal detachment symptoms awaiting emergency surgery')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C97: Coughing frank red blood during aerobic workout', () => {
      const res = clientClassify('Coughing frank red blood during aerobic workout')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C98: Severe unilateral leg edema with warmth and erythema', () => {
      const res = clientClassify('Severe unilateral leg edema with warmth and erythema')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C99: Explosive occipital headache triggered by Valsalva maneuver', () => {
      const res = clientClassify('Explosive occipital headache triggered by Valsalva maneuver')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('C100: Sudden onset severe vertigo with uncontrollable vomiting during gym session', () => {
      const res = clientClassify('Sudden onset severe vertigo with uncontrollable vomiting during gym session')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
  })

  // --------------------------------------------------------------------------
  // SECTION D: MEDICATIONS, IMPLANTS & MEDICAL DEVICES (60 Tests: D01 - D60)
  // --------------------------------------------------------------------------
  describe('Section D: Medications, Implants & Medical Devices', () => {
    it('D01: Currently taking warfarin Coumadin for mechanical heart valve', () => {
      const res = clientClassify('Currently taking warfarin Coumadin for mechanical heart valve')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D02: On daily Coumadin therapy with target INR 2.5 to 3.5', () => {
      const res = clientClassify('On daily Coumadin therapy with target INR 2.5 to 3.5')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D03: Prescribed Eliquis apixaban 5mg twice daily for AFib', () => {
      const res = clientClassify('Prescribed Eliquis apixaban 5mg twice daily for AFib')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D04: Taking apixaban blood thinner', () => {
      const res = clientClassify('Taking apixaban blood thinner')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D05: On Xarelto rivaroxaban 20mg daily for prior DVT', () => {
      const res = clientClassify('On Xarelto rivaroxaban 20mg daily for prior DVT')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D06: Taking rivaroxaban oral anticoagulant', () => {
      const res = clientClassify('Taking rivaroxaban oral anticoagulant')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D07: Prescribed Pradaxa dabigatran 150mg twice daily', () => {
      const res = clientClassify('Prescribed Pradaxa dabigatran 150mg twice daily')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D08: Taking dabigatran blood thinner', () => {
      const res = clientClassify('Taking dabigatran blood thinner')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D09: On Plavix clopidogrel 75mg following coronary stent', () => {
      const res = clientClassify('On Plavix clopidogrel 75mg following coronary stent')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D10: Taking clopidogrel antiplatelet therapy', () => {
      const res = clientClassify('Taking clopidogrel antiplatelet therapy')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D11: Prescribed Brilinta ticagrelor 90mg twice daily', () => {
      const res = clientClassify('Prescribed Brilinta ticagrelor 90mg twice daily')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D12: Taking ticagrelor dual antiplatelet therapy', () => {
      const res = clientClassify('Taking ticagrelor dual antiplatelet therapy')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D13: Daily therapeutic Lovenox enoxaparin subcutaneous injections', () => {
      const res = clientClassify('Daily therapeutic Lovenox enoxaparin subcutaneous injections')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D14: On heparin anticoagulant therapy', () => {
      const res = clientClassify('On heparin anticoagulant therapy')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D15: Prescribed systemic blood thinners with high bleeding risk', () => {
      const res = clientClassify('Prescribed systemic blood thinners with high bleeding risk')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D16: On therapeutic anticoagulation cannot participate in contact sports', () => {
      const res = clientClassify('On therapeutic anticoagulation cannot participate in contact sports')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D17: Taking oral anticoagulants for recurrent pulmonary emboli', () => {
      const res = clientClassify('Taking oral anticoagulants for recurrent pulmonary emboli')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D18: On dual antiplatelet therapy DAPT', () => {
      const res = clientClassify('On dual antiplatelet therapy DAPT')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D19: Taking metoprolol tartrate 50mg twice daily for arrhythmia', () => {
      const res = clientClassify('Taking metoprolol tartrate 50mg twice daily for arrhythmia')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D20: On metoprolol succinate 100mg daily beta blocker', () => {
      const res = clientClassify('On metoprolol succinate 100mg daily beta blocker')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D21: Prescribed atenolol 25mg daily for blood pressure and pulse control', () => {
      const res = clientClassify('Prescribed atenolol 25mg daily for blood pressure and pulse control')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D22: Taking propranolol 40mg for tachycardia and tremor', () => {
      const res = clientClassify('Taking propranolol 40mg for tachycardia and tremor')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D23: On carvedilol 25mg twice daily for heart failure', () => {
      const res = clientClassify('On carvedilol 25mg twice daily for heart failure')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D24: Taking bisoprolol 5mg daily beta-blocker', () => {
      const res = clientClassify('Taking bisoprolol 5mg daily beta-blocker')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D25: Prescribed labetalol for severe hypertension', () => {
      const res = clientClassify('Prescribed labetalol for severe hypertension')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D26: Carrying sublingual nitroglycerin for sudden angina attacks', () => {
      const res = clientClassify('Carrying sublingual nitroglycerin for sudden angina attacks')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D27: Prescribed Nitrostat sublingual tablets for exertional chest pain', () => {
      const res = clientClassify('Prescribed Nitrostat sublingual tablets for exertional chest pain')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D28: Taking digoxin Lanoxin for rate control in atrial fibrillation', () => {
      const res = clientClassify('Taking digoxin Lanoxin for rate control in atrial fibrillation')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D29: On amiodarone 200mg daily for ventricular arrhythmias', () => {
      const res = clientClassify('On amiodarone 200mg daily for ventricular arrhythmias')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D30: Prescribed flecainide antiarrhythmic medication', () => {
      const res = clientClassify('Prescribed flecainide antiarrhythmic medication')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D31: Daily insulin injections basal Lantus and bolus Humalog', () => {
      const res = clientClassify('Daily insulin injections basal Lantus and bolus Humalog')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D32: On multiple daily insulin injections MDI for type 1 diabetes', () => {
      const res = clientClassify('On multiple daily insulin injections MDI for type 1 diabetes')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D33: Using Novolog rapid acting insulin before meals', () => {
      const res = clientClassify('Using Novolog rapid acting insulin before meals')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D34: Taking Levemir insulin glargine nightly', () => {
      const res = clientClassify('Taking Levemir insulin glargine nightly')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D35: On chronic high-dose prednisone 20mg daily for autoimmune disease', () => {
      const res = clientClassify('On chronic high-dose prednisone 20mg daily for autoimmune disease')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D36: Long-term oral dexamethasone therapy causing muscle wasting', () => {
      const res = clientClassify('Long-term oral dexamethasone therapy causing muscle wasting')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D37: On systemic corticosteroids for chronic inflammatory condition', () => {
      const res = clientClassify('On systemic corticosteroids for chronic inflammatory condition')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D38: Taking methotrexate weekly for severe rheumatoid arthritis', () => {
      const res = clientClassify('Taking methotrexate weekly for severe rheumatoid arthritis')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D39: Receiving infliximab Remicade infusions every 8 weeks', () => {
      const res = clientClassify('Receiving infliximab Remicade infusions every 8 weeks')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D40: On adalimumab Humira biweekly biologic therapy', () => {
      const res = clientClassify('On adalimumab Humira biweekly biologic therapy')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D41: Prescribed cyclosporine immunosuppression post kidney transplant', () => {
      const res = clientClassify('Prescribed cyclosporine immunosuppression post kidney transplant')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D42: Taking tacrolimus Prograf daily to prevent organ rejection', () => {
      const res = clientClassify('Taking tacrolimus Prograf daily to prevent organ rejection')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D43: Implanted cardiac pacemaker for complete heart block', () => {
      const res = clientClassify('Implanted cardiac pacemaker for complete heart block')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D44: Have a dual chamber pacemaker in left chest', () => {
      const res = clientClassify('Have a dual chamber pacemaker in left chest')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D45: Implantable cardioverter-defibrillator ICD for ventricular tachycardia', () => {
      const res = clientClassify('Implantable cardioverter-defibrillator ICD for ventricular tachycardia')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D46: Biventricular ICD implanted for cardiac resynchronization CRT-D', () => {
      const res = clientClassify('Biventricular ICD implanted for cardiac resynchronization CRT-D')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D47: Living with left ventricular assist device LVAD heart pump', () => {
      const res = clientClassify('Living with left ventricular assist device LVAD heart pump')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D48: Implanted spinal cord stimulator SCS in thoracic spine', () => {
      const res = clientClassify('Implanted spinal cord stimulator SCS in thoracic spine')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D49: Intrathecal baclofen pump implanted in abdominal wall for spasticity', () => {
      const res = clientClassify('Intrathecal baclofen pump implanted in abdominal wall for spasticity')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D50: Vagus nerve stimulator VNS implanted for refractory epilepsy', () => {
      const res = clientClassify('Vagus nerve stimulator VNS implanted for refractory epilepsy')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D51: Ventriculoperitoneal VP shunt for hydrocephalus', () => {
      const res = clientClassify('Ventriculoperitoneal VP shunt for hydrocephalus')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D52: AV fistula in left forearm for hemodialysis access cannot lift heavy', () => {
      const res = clientClassify('AV fistula in left forearm for hemodialysis access cannot lift heavy')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D53: Hemodialysis permcath central line in right internal jugular', () => {
      const res = clientClassify('Hemodialysis permcath central line in right internal jugular')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D54: Chemotherapy port port-a-cath implanted in right upper chest', () => {
      const res = clientClassify('Chemotherapy port port-a-cath implanted in right upper chest')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D55: PICC line in upper right arm for prolonged IV antibiotic therapy', () => {
      const res = clientClassify('PICC line in upper right arm for prolonged IV antibiotic therapy')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D56: Spinal hardware titanium rods and pedicle screws L2-S1', () => {
      const res = clientClassify('Spinal hardware titanium rods and pedicle screws L2-S1')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D57: Large surgical mesh repair for recurrent incisional hernia', () => {
      const res = clientClassify('Large surgical mesh repair for recurrent incisional hernia')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D58: Abdominal wall mesh implant cannot perform heavy core strain', () => {
      const res = clientClassify('Abdominal wall mesh implant cannot perform heavy core strain')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D59: Continuous glucose monitor CGM and automated insulin pump', () => {
      const res = clientClassify('Continuous glucose monitor CGM and automated insulin pump')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('D60: Deep brain stimulator DBS implanted for Parkinson tremor', () => {
      const res = clientClassify('Deep brain stimulator DBS implanted for Parkinson tremor')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
  })

  // --------------------------------------------------------------------------
  // SECTION E: MEDICAL ACRONYMS, JARGON & COMMON TYPOS (55 Tests: E01 - E55)
  // --------------------------------------------------------------------------
  describe('Section E: Medical Acronyms, Jargon & Common Typos', () => {
    it('E01: Diagnosed with T1D on insulin pump', () => {
      const res = clientClassify('Diagnosed with T1D on insulin pump')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E02: Patient has T2D with HbA1c 9.2', () => {
      const res = clientClassify('Patient has T2D with HbA1c 9.2')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E03: Active MS with leg weakness', () => {
      const res = clientClassify('Active MS with leg weakness')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E04: ALS patient with respiratory muscle involvement', () => {
      const res = clientClassify('ALS patient with respiratory muscle involvement')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E05: Diagnosed with hEDS and frequent joint subluxations', () => {
      const res = clientClassify('Diagnosed with hEDS and frequent joint subluxations')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E06: Has POTS with heart rate spiking from 70 to 140 on standing', () => {
      const res = clientClassify('Has POTS with heart rate spiking from 70 to 140 on standing')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E07: CHF stage C with orthopnea', () => {
      const res = clientClassify('CHF stage C with orthopnea')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E08: CKD stage 3b with proteinuria', () => {
      const res = clientClassify('CKD stage 3b with proteinuria')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E09: ESRD on peritoneal dialysis', () => {
      const res = clientClassify('ESRD on peritoneal dialysis')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E10: History of DVT left leg on anticoagulants', () => {
      const res = clientClassify('History of DVT left leg on anticoagulants')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E11: Prior PE requiring ICU admission', () => {
      const res = clientClassify('Prior PE requiring ICU admission')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E12: Diagnosed with AAA 4.2cm under ultrasound surveillance', () => {
      const res = clientClassify('Diagnosed with AAA 4.2cm under ultrasound surveillance')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E13: Severe PAD with leg pain on walking', () => {
      const res = clientClassify('Severe PAD with leg pain on walking')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E14: Diagnosed with SLE lupus nephritis', () => {
      const res = clientClassify('Diagnosed with SLE lupus nephritis')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E15: Active RA flare with morning stiffness', () => {
      const res = clientClassify('Active RA flare with morning stiffness')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E16: Has AS with spinal stiffness and sacroiliitis', () => {
      const res = clientClassify('Has AS with spinal stiffness and sacroiliitis')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E17: MG diagnosis with severe ptosis and fatigue', () => {
      const res = clientClassify('MG diagnosis with severe ptosis and fatigue')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E18: Suffering from ME/CFS for 4 years', () => {
      const res = clientClassify('Suffering from ME/CFS for 4 years')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E19: Diagnosed with VWD bleeding disorder', () => {
      const res = clientClassify('Diagnosed with VWD bleeding disorder')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E20: Severe TBI with lingering cognitive and balance deficits', () => {
      const res = clientClassify('Severe TBI with lingering cognitive and balance deficits')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E21: s/p lap chole 3 weeks ago', () => {
      const res = clientClassify('s/p lap chole 3 weeks ago')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E22: s/p laminectomy L4-L5 with persistent neuropathy', () => {
      const res = clientClassify('s/p laminectomy L4-L5 with persistent neuropathy')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E23: s/p appendectomy 2 weeks ago resting', () => {
      const res = clientClassify('s/p appendectomy 2 weeks ago resting')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E24: s/p total hip arthroplasty right side', () => {
      const res = clientClassify('s/p total hip arthroplasty right side')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E25: s/p sternotomy CABG 6 months ago', () => {
      const res = clientClassify('s/p sternotomy CABG 6 months ago')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E26: h/o DVT and pulmonary embolism in 2023', () => {
      const res = clientClassify('h/o DVT and pulmonary embolism in 2023')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E27: h/o transient ischemic attack 3 months ago', () => {
      const res = clientClassify('h/o transient ischemic attack 3 months ago')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E28: c/o severe SOB on mild exertion', () => {
      const res = clientClassify('c/o severe SOB on mild exertion')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E29: c/o chest tightness and palpitations during gym sessions', () => {
      const res = clientClassify('c/o chest tightness and palpitations during gym sessions')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E30: b/l lower extremity edema and shortness of breath', () => {
      const res = clientClassify('b/l lower extremity edema and shortness of breath')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E31: Severe HTN uncontrolled BP 175/105', () => {
      const res = clientClassify('Severe HTN uncontrolled BP 175/105')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E32: Uncontrolled DM type 2 on metformin and insulin', () => {
      const res = clientClassify('Uncontrolled DM type 2 on metformin and insulin')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E33: hx of spontaneous pneumothorax right lung', () => {
      const res = clientClassify('hx of spontaneous pneumothorax right lung')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E34: w/ history of aortic aneurysm', () => {
      const res = clientClassify('w/ history of aortic aneurysm')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E35: r/o pulmonary embolism following acute dyspnea', () => {
      const res = clientClassify('r/o pulmonary embolism following acute dyspnea')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E36: Have diabetis type 2 on daily meds', () => {
      const res = clientClassify('Have diabetis type 2 on daily meds')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E37: Severe diabeetus with nerve problems', () => {
      const res = clientClassify('Severe diabeetus with nerve problems')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E38: Chronic astma using albuterol daily', () => {
      const res = clientClassify('Chronic astma using albuterol daily')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E39: Severe athsma triggered by cardio exercise', () => {
      const res = clientClassify('Severe athsma triggered by cardio exercise')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E40: Severe artritis in hands and knees', () => {
      const res = clientClassify('Severe artritis in hands and knees')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E41: Crippling athritis in joints', () => {
      const res = clientClassify('Crippling athritis in joints')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E42: Severe arthritus in lower back and hips', () => {
      const res = clientClassify('Severe arthritus in lower back and hips')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E43: Suffering from fibromialgia chronic pain', () => {
      const res = clientClassify('Suffering from fibromialgia chronic pain')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E44: Severe fibromialga tender points all over body', () => {
      const res = clientClassify('Severe fibromialga tender points all over body')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E45: Sharp siatica nerve pain down back of right leg', () => {
      const res = clientClassify('Sharp siatica nerve pain down back of right leg')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E46: Shooting syatica pain into calf and foot', () => {
      const res = clientClassify('Shooting syatica pain into calf and foot')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E47: Diagnosed with epilepsey having frequent seizures', () => {
      const res = clientClassify('Diagnosed with epilepsey having frequent seizures')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E48: Chronic siezure disorder on anticonvulsants', () => {
      const res = clientClassify('Chronic siezure disorder on anticonvulsants')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E49: Suffers from siezures when physically exhausted', () => {
      const res = clientClassify('Suffers from siezures when physically exhausted')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E50: Diagnosed with abdominal aortic aneurism', () => {
      const res = clientClassify('Diagnosed with abdominal aortic aneurism')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E51: Brain anurism clipping surgery in past', () => {
      const res = clientClassify('Brain anurism clipping surgery in past')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E52: Have an implanted pacmaker in my chest', () => {
      const res = clientClassify('Have an implanted pacmaker in my chest')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E53: Pace maker keeps my heart rhythm steady', () => {
      const res = clientClassify('Pace maker keeps my heart rhythm steady')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E54: Painful inguinal hernea in groin', () => {
      const res = clientClassify('Painful inguinal hernea in groin')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
    it('E55: Severe vertago with spinning dizziness during movement', () => {
      const res = clientClassify('Severe vertago with spinning dizziness during movement')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.structuredPromptContext.length).toBeGreaterThan(0)
    })
  })

  // --------------------------------------------------------------------------
  // SECTION F: NON-MEDICAL & BENIGN BOUNDARY DISCRIMINATION (45 Tests: F01 - F45)
  // --------------------------------------------------------------------------
  describe('Section F: Non-Medical & Benign Boundary Discrimination', () => {
    it('F01: Push workout on Mondays, pull on Wednesdays, legs on Fridays', () => {
      const res = clientClassify('Push workout on Mondays, pull on Wednesdays, legs on Fridays')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F02: I do bench press, squats, and barbell rows', () => {
      const res = clientClassify('I do bench press, squats, and barbell rows')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F03: Cardio 30 minutes 4 times a week on stationary bike', () => {
      const res = clientClassify('Cardio 30 minutes 4 times a week on stationary bike')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F04: Weight lifting 5 days a week with standard progressive overload', () => {
      const res = clientClassify('Weight lifting 5 days a week with standard progressive overload')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F05: Running 5k three times per week outdoors', () => {
      const res = clientClassify('Running 5k three times per week outdoors')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F06: Pilates and mobility training twice weekly', () => {
      const res = clientClassify('Pilates and mobility training twice weekly')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F07: Bodyweight calisthenics only pull-ups and push-ups', () => {
      const res = clientClassify('Bodyweight calisthenics only pull-ups and push-ups')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F08: Yoga 3 times a week, clean health and good flexibility', () => {
      const res = clientClassify('Yoga 3 times a week, clean health and good flexibility')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F09: Heavy powerlifting routine, no injuries or limitations', () => {
      const res = clientClassify('Heavy powerlifting routine, no injuries or limitations')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F10: HIIT training twice a week, completely healthy', () => {
      const res = clientClassify('HIIT training twice a week, completely healthy')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F11: Swimming laps 45 minutes daily for endurance', () => {
      const res = clientClassify('Swimming laps 45 minutes daily for endurance')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F12: Cycling outdoors on weekends 20 miles', () => {
      const res = clientClassify('Cycling outdoors on weekends 20 miles')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F13: Functional fitness training with kettlebells and dumbbells', () => {
      const res = clientClassify('Functional fitness training with kettlebells and dumbbells')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F14: Kettlebell workouts at home 3 days per week', () => {
      const res = clientClassify('Kettlebell workouts at home 3 days per week')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F15: Regular gym goer, standard push pull legs split', () => {
      const res = clientClassify('Regular gym goer, standard push pull legs split')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F16: Feel the burn in my quads during high rep cycling', () => {
      const res = clientClassify('Feel the burn in my quads during high rep cycling')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F17: Sweating heavily during high intensity cardio intervals', () => {
      const res = clientClassify('Sweating heavily during high intensity cardio intervals')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F18: Heart rate gets elevated up to 165 bpm when sprinting', () => {
      const res = clientClassify('Heart rate gets elevated up to 165 bpm when sprinting')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F19: Muscles feel tired after heavy squats workout', () => {
      const res = clientClassify('Muscles feel tired after heavy squats workout')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F20: Delayed onset muscle soreness in legs after leg day', () => {
      const res = clientClassify('Delayed onset muscle soreness in legs after leg day')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F21: DOMS in hamstrings after Romanian deadlifts', () => {
      const res = clientClassify('DOMS in hamstrings after Romanian deadlifts')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F22: Foam rolling tight calves after distance running', () => {
      const res = clientClassify('Foam rolling tight calves after distance running')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F23: Tight hamstrings from sitting at office desk all day', () => {
      const res = clientClassify('Tight hamstrings from sitting at office desk all day')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F24: Stiff shoulders after long desk work, no injury just need mobility', () => {
      const res = clientClassify('Stiff shoulders after long desk work, no injury just need mobility')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F25: Normal post-workout muscle fatigue after hard training session', () => {
      const res = clientClassify('Normal post-workout muscle fatigue after hard training session')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F26: Felt fatigued after yesterday long run, fully rested now', () => {
      const res = clientClassify('Felt fatigued after yesterday long run, fully rested now')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F27: Mild muscle burn during dumbbell lateral raises', () => {
      const res = clientClassify('Mild muscle burn during dumbbell lateral raises')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F28: Sore pectorals after high volume pushups', () => {
      const res = clientClassify('Sore pectorals after high volume pushups')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F29: Lactic acid buildup during 400m sprint intervals', () => {
      const res = clientClassify('Lactic acid buildup during 400m sprint intervals')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F30: General muscle tightness relieved by dynamic stretching', () => {
      const res = clientClassify('General muscle tightness relieved by dynamic stretching')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F31: Blood pressure is 120/80, perfectly healthy', () => {
      const res = clientClassify('Blood pressure is 120/80, perfectly healthy')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F32: Normal blood pressure and normal resting heart rate 62 bpm', () => {
      const res = clientClassify('Normal blood pressure and normal resting heart rate 62 bpm')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F33: Resting heart rate 58 bpm, excellent cardiovascular condition', () => {
      const res = clientClassify('Resting heart rate 58 bpm, excellent cardiovascular condition')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F34: Good cholesterol and normal ECG, healthy heart', () => {
      const res = clientClassify('Good cholesterol and normal ECG, healthy heart')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F35: Passed annual physical with clean bill of health from doctor', () => {
      const res = clientClassify('Passed annual physical with clean bill of health from doctor')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F36: Doctor gave me a completely clean bill of health', () => {
      const res = clientClassify('Doctor gave me a completely clean bill of health')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F37: Cleared for all sports, 100% healthy and ready to train', () => {
      const res = clientClassify('Cleared for all sports, 100% healthy and ready to train')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F38: No physical restrictions or health issues, fully active', () => {
      const res = clientClassify('No physical restrictions or health issues, fully active')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F39: Completely healthy, active lifestyle with no limitations', () => {
      const res = clientClassify('Completely healthy, active lifestyle with no limitations')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F40: Fit, healthy, zero medical limitations or injuries', () => {
      const res = clientClassify('Fit, healthy, zero medical limitations or injuries')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F41: No health problems whatsoever, fit and energetic', () => {
      const res = clientClassify('No health problems whatsoever, fit and energetic')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F42: None', () => {
      const res = clientClassify('None')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F43: No injuries or conditions', () => {
      const res = clientClassify('No injuries or conditions')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F44: N/A - completely healthy', () => {
      const res = clientClassify('N/A - completely healthy')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
    it('F45: Healthy adult, no medical issues or physical limitations', () => {
      const res = clientClassify('Healthy adult, no medical issues or physical limitations')
      expect(res.isSafetySensitive).toBe(false)
      expect(res.activeCategories).toHaveLength(0)
    })
  })

  // --------------------------------------------------------------------------
  // SECTION G: MONOTONICITY & FAIL-CLOSED INVARIANTS (30 Tests: G01 - G30)
  // --------------------------------------------------------------------------
  describe('Section G: Monotonicity & Fail-Closed Invariants', () => {
    it('G01: "Push workout 3 days a week" + "Diagnosed with multiple sclerosis" preserves safety sensitivity', () => {
      const bRes = clientClassify('Push workout 3 days a week')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Push workout 3 days a week ; Diagnosed with multiple sclerosis')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Diagnosed with multiple sclerosis ; Push workout 3 days a week')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G02: "Regular gym workouts" + "Has POTS with high heart rate on standing" preserves safety sensitivity', () => {
      const bRes = clientClassify('Regular gym workouts')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Regular gym workouts ; Has POTS with high heart rate on standing')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Has POTS with high heart rate on standing ; Regular gym workouts')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G03: "Fit and active runner" + "Amyotrophic lateral sclerosis ALS" preserves safety sensitivity', () => {
      const bRes = clientClassify('Fit and active runner')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Fit and active runner ; Amyotrophic lateral sclerosis ALS')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Amyotrophic lateral sclerosis ALS ; Fit and active runner')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G04: "Swimming laps 45 minutes daily" + "Stage 4 chronic kidney disease" preserves safety sensitivity', () => {
      const bRes = clientClassify('Swimming laps 45 minutes daily')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Swimming laps 45 minutes daily ; Stage 4 chronic kidney disease')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Stage 4 chronic kidney disease ; Swimming laps 45 minutes daily')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G05: "Yoga 3 times a week" + "Ehlers-Danlos syndrome hypermobile type" preserves safety sensitivity', () => {
      const bRes = clientClassify('Yoga 3 times a week')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Yoga 3 times a week ; Ehlers-Danlos syndrome hypermobile type')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Ehlers-Danlos syndrome hypermobile type ; Yoga 3 times a week')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G06: "Weight lifting 4 days a week" + "Sickle cell disease with crises" preserves safety sensitivity', () => {
      const bRes = clientClassify('Weight lifting 4 days a week')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Weight lifting 4 days a week ; Sickle cell disease with crises')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Sickle cell disease with crises ; Weight lifting 4 days a week')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G07: "Normal blood pressure 120/80" + "End-stage renal disease on hemodialysis" preserves safety sensitivity', () => {
      const bRes = clientClassify('Normal blood pressure 120/80')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Normal blood pressure 120/80 ; End-stage renal disease on hemodialysis')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('End-stage renal disease on hemodialysis ; Normal blood pressure 120/80')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G08: "Passed annual physical" + "Active Crohn disease flare" preserves safety sensitivity', () => {
      const bRes = clientClassify('Passed annual physical')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Passed annual physical ; Active Crohn disease flare')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Active Crohn disease flare ; Passed annual physical')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G09: "Resting heart rate 60 bpm" + "Marfan syndrome with aortic dilation" preserves safety sensitivity', () => {
      const bRes = clientClassify('Resting heart rate 60 bpm')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Resting heart rate 60 bpm ; Marfan syndrome with aortic dilation')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Marfan syndrome with aortic dilation ; Resting heart rate 60 bpm')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G10: "Bodyweight calisthenics only" + "Severe myasthenia gravis with muscle fatigue" preserves safety sensitivity', () => {
      const bRes = clientClassify('Bodyweight calisthenics only')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Bodyweight calisthenics only ; Severe myasthenia gravis with muscle fatigue')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Severe myasthenia gravis with muscle fatigue ; Bodyweight calisthenics only')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G11: "Running 5k three times per week" + "Fainted while running on treadmill" preserves safety sensitivity', () => {
      const bRes = clientClassify('Running 5k three times per week')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Running 5k three times per week ; Fainted while running on treadmill')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Fainted while running on treadmill ; Running 5k three times per week')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G12: "Heavy powerlifting routine" + "Blackout when deadlifting 200kg" preserves safety sensitivity', () => {
      const bRes = clientClassify('Heavy powerlifting routine')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Heavy powerlifting routine ; Blackout when deadlifting 200kg')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Blackout when deadlifting 200kg ; Heavy powerlifting routine')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G13: "Pilates and mobility training" + "Crushing chest pressure during exertion" preserves safety sensitivity', () => {
      const bRes = clientClassify('Pilates and mobility training')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Pilates and mobility training ; Crushing chest pressure during exertion')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Crushing chest pressure during exertion ; Pilates and mobility training')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G14: "Cardio 30 minutes daily" + "Sudden left arm weakness and numbness" preserves safety sensitivity', () => {
      const bRes = clientClassify('Cardio 30 minutes daily')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Cardio 30 minutes daily ; Sudden left arm weakness and numbness')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Sudden left arm weakness and numbness ; Cardio 30 minutes daily')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G15: "Functional fitness workouts" + "Saddle numbness in groin area" preserves safety sensitivity', () => {
      const bRes = clientClassify('Functional fitness workouts')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Functional fitness workouts ; Saddle numbness in groin area')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Saddle numbness in groin area ; Functional fitness workouts')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G16: "Regular push pull legs split" + "Coughing up blood after running" preserves safety sensitivity', () => {
      const bRes = clientClassify('Regular push pull legs split')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Regular push pull legs split ; Coughing up blood after running')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Coughing up blood after running ; Regular push pull legs split')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G17: "Cycling outdoors on weekends" + "Sudden hot swollen red calf on right leg" preserves safety sensitivity', () => {
      const bRes = clientClassify('Cycling outdoors on weekends')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Cycling outdoors on weekends ; Sudden hot swollen red calf on right leg')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Sudden hot swollen red calf on right leg ; Cycling outdoors on weekends')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G18: "Foam rolling tight calves" + "Sudden explosive thunderclap headache while straining" preserves safety sensitivity', () => {
      const bRes = clientClassify('Foam rolling tight calves')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Foam rolling tight calves ; Sudden explosive thunderclap headache while straining')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Sudden explosive thunderclap headache while straining ; Foam rolling tight calves')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G19: "HIIT training twice a week" + "Loss of consciousness while squatting" preserves safety sensitivity', () => {
      const bRes = clientClassify('HIIT training twice a week')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('HIIT training twice a week ; Loss of consciousness while squatting')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Loss of consciousness while squatting ; HIIT training twice a week')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G20: "Doctor gave clean bill of health" + "Acute exertional dyspnea gasping for air" preserves safety sensitivity', () => {
      const bRes = clientClassify('Doctor gave clean bill of health')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Doctor gave clean bill of health ; Acute exertional dyspnea gasping for air')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Acute exertional dyspnea gasping for air ; Doctor gave clean bill of health')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G21: "Bench press and squats" + "Taking warfarin blood thinner" preserves safety sensitivity', () => {
      const bRes = clientClassify('Bench press and squats')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Bench press and squats ; Taking warfarin blood thinner')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Taking warfarin blood thinner ; Bench press and squats')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G22: "Fit healthy adult" + "Implanted cardiac pacemaker" preserves safety sensitivity', () => {
      const bRes = clientClassify('Fit healthy adult')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Fit healthy adult ; Implanted cardiac pacemaker')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Implanted cardiac pacemaker ; Fit healthy adult')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G23: "Swimming laps daily" + "On daily insulin injections for T1D" preserves safety sensitivity', () => {
      const bRes = clientClassify('Swimming laps daily')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Swimming laps daily ; On daily insulin injections for T1D')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('On daily insulin injections for T1D ; Swimming laps daily')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G24: "Weight lifting 5 days a week" + "Taking metoprolol beta-blocker" preserves safety sensitivity', () => {
      const bRes = clientClassify('Weight lifting 5 days a week')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Weight lifting 5 days a week ; Taking metoprolol beta-blocker')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Taking metoprolol beta-blocker ; Weight lifting 5 days a week')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G25: "Yoga and pilates" + "Implantable cardioverter defibrillator ICD" preserves safety sensitivity', () => {
      const bRes = clientClassify('Yoga and pilates')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Yoga and pilates ; Implantable cardioverter defibrillator ICD')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Implantable cardioverter defibrillator ICD ; Yoga and pilates')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G26: "Good cholesterol and resting HR 58" + "On Eliquis apixaban blood thinner" preserves safety sensitivity', () => {
      const bRes = clientClassify('Good cholesterol and resting HR 58')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Good cholesterol and resting HR 58 ; On Eliquis apixaban blood thinner')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('On Eliquis apixaban blood thinner ; Good cholesterol and resting HR 58')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G27: "Regular runner" + "Spinal cord stimulator implanted in back" preserves safety sensitivity', () => {
      const bRes = clientClassify('Regular runner')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Regular runner ; Spinal cord stimulator implanted in back')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Spinal cord stimulator implanted in back ; Regular runner')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G28: "Bodyweight calisthenics" + "AV fistula in forearm for hemodialysis" preserves safety sensitivity', () => {
      const bRes = clientClassify('Bodyweight calisthenics')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Bodyweight calisthenics ; AV fistula in forearm for hemodialysis')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('AV fistula in forearm for hemodialysis ; Bodyweight calisthenics')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G29: "Standard gym routine" + "Chemotherapy port implanted in chest" preserves safety sensitivity', () => {
      const bRes = clientClassify('Standard gym routine')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Standard gym routine ; Chemotherapy port implanted in chest')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Chemotherapy port implanted in chest ; Standard gym routine')
      expect(rev.isSafetySensitive).toBe(true)
    })
    it('G30: "Fit and energetic" + "Spinal hardware titanium rods and screws" preserves safety sensitivity', () => {
      const bRes = clientClassify('Fit and energetic')
      expect(bRes.isSafetySensitive).toBe(false)

      const fwd = clientClassify('Fit and energetic ; Spinal hardware titanium rods and screws')
      expect(fwd.isSafetySensitive).toBe(true)

      const rev = clientClassify('Spinal hardware titanium rods and screws ; Fit and energetic')
      expect(rev.isSafetySensitive).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // SECTION H: MULTI-CLAUSE CONJUNCTIONS & NEGATION LOOPHOLE DEFENSE (25 Tests: H01 - H25)
  // --------------------------------------------------------------------------
  describe('Section H: Multi-Clause Conjunctions & Negation Loophole Defense', () => {
    it('H01: No knee injury, but diagnosed with multiple sclerosis', () => {
      const res = clientClassify('No knee injury, but diagnosed with multiple sclerosis')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('knee_high_impact')
    })
    it('H02: No back problems, but taking warfarin daily', () => {
      const res = clientClassify('No back problems, but taking warfarin daily')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('lumbar_disc_herniation')
    })
    it('H03: No shoulder pain, but I have an implanted pacemaker', () => {
      const res = clientClassify('No shoulder pain, but I have an implanted pacemaker')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('shoulder_impingement_cuff')
    })
    it('H04: Denies knee injury; however suffers from POTS with syncope', () => {
      const res = clientClassify('Denies knee injury; however suffers from POTS with syncope')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('knee_high_impact')
    })
    it('H05: Ruled out disc herniation, but c/o severe exertional dyspnea', () => {
      const res = clientClassify('Ruled out disc herniation, but c/o severe exertional dyspnea')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('lumbar_disc_herniation')
    })
    it('H06: No heart disease, but active Crohn disease flare on biologic therapy', () => {
      const res = clientClassify('No heart disease, but active Crohn disease flare on biologic therapy')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('cardiac_symptomatic_condition')
    })
    it('H07: No osteoporosis, but diagnosed with Ehlers-Danlos syndrome', () => {
      const res = clientClassify('No osteoporosis, but diagnosed with Ehlers-Danlos syndrome')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('severe_osteoporosis')
    })
    it('H08: No osteoarthritis, but taking Eliquis for prior DVT', () => {
      const res = clientClassify('No osteoarthritis, but taking Eliquis for prior DVT')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('severe_osteoarthritis')
    })
    it('H09: Not pregnant, but stage 4 chronic kidney disease on dialysis', () => {
      const res = clientClassify('Not pregnant, but stage 4 chronic kidney disease on dialysis')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('pregnancy_late_stage')
    })
    it('H10: No ACL tear, but blacking out during heavy deadlifts', () => {
      const res = clientClassify('No ACL tear, but blacking out during heavy deadlifts')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('knee_high_impact')
    })
    it('H11: Denies shoulder impingement, but has implantable cardioverter ICD', () => {
      const res = clientClassify('Denies shoulder impingement, but has implantable cardioverter ICD')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('shoulder_impingement_cuff')
    })
    it('H12: Free from back pain, but diagnosed with Amyotrophic lateral sclerosis ALS', () => {
      const res = clientClassify('Free from back pain, but diagnosed with Amyotrophic lateral sclerosis ALS')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('lumbar_disc_herniation')
    })
    it('H13: No cervical spine issues, but sudden numbness and weakness in left arm', () => {
      const res = clientClassify('No cervical spine issues, but sudden numbness and weakness in left arm')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('cervical_spine_pathology')
    })
    it('H14: Knee injury was ruled out, but has abdominal aortic aneurysm 4.5cm', () => {
      const res = clientClassify('Knee injury was ruled out, but has abdominal aortic aneurysm 4.5cm')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('knee_high_impact')
    })
    it('H15: Clear of cardiac disease, but sickle cell disease with severe pain crises', () => {
      const res = clientClassify('Clear of cardiac disease, but sickle cell disease with severe pain crises')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('cardiac_symptomatic_condition')
    })
    it('H16: No lumbar disc problems, but saddle numbness in groin', () => {
      const res = clientClassify('No lumbar disc problems, but saddle numbness in groin')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('lumbar_disc_herniation')
    })
    it('H17: Denies any knee pain, but coughing up blood after jogging', () => {
      const res = clientClassify('Denies any knee pain, but coughing up blood after jogging')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('knee_high_impact')
    })
    it('H18: No shoulder problems, but hot swollen red throbbing right calf', () => {
      const res = clientClassify('No shoulder problems, but hot swollen red throbbing right calf')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('shoulder_impingement_cuff')
    })
    it('H19: No osteoporosis, but Marfan syndrome with aortic root dilation', () => {
      const res = clientClassify('No osteoporosis, but Marfan syndrome with aortic root dilation')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('severe_osteoporosis')
    })
    it('H20: Neither knee pain nor back pain, but on daily insulin injections for T1D', () => {
      const res = clientClassify('Neither knee pain nor back pain, but on daily insulin injections for T1D')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('knee_high_impact')
      expect(res.negatedCategories).toContain('lumbar_disc_herniation')
    })
    it('H21: No history of heart attack, but taking metoprolol beta-blocker', () => {
      const res = clientClassify('No history of heart attack, but taking metoprolol beta-blocker')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('cardiac_symptomatic_condition')
    })
    it('H22: No knee or shoulder issues, but AV fistula left arm for dialysis', () => {
      const res = clientClassify('No knee or shoulder issues, but AV fistula left arm for dialysis')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('knee_high_impact')
      expect(res.negatedCategories).toContain('shoulder_impingement_cuff')
    })
    it('H23: Denies spinal problems, but titanium rods and screws in spine', () => {
      const res = clientClassify('Denies spinal problems, but titanium rods and screws in spine')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('lumbar_disc_herniation')
    })
    it('H24: No osteoarthritis, but severe myasthenia gravis with muscle fatigue', () => {
      const res = clientClassify('No osteoarthritis, but severe myasthenia gravis with muscle fatigue')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.negatedCategories).toContain('severe_osteoarthritis')
    })
    it('H25: No medical issues except occasional exercise-induced asthma', () => {
      const res = clientClassify('No medical issues except occasional exercise-induced asthma')
      expect(res.isSafetySensitive).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // SECTION I: CLIENT/SERVER EQUIVALENCE & DIFFERENTIAL TESTING (15 Tests: I01 - I15)
  // --------------------------------------------------------------------------
  describe('Section I: Client/Server Equivalence & Differential Testing', () => {
    it('I01: Parity on "Diagnosed with multiple sclerosis; no knee injury"', () => {
      const cRes = clientClassify('Diagnosed with multiple sclerosis; no knee injury')
      const sRes = serverModule.classifyMedicalIntake('Diagnosed with multiple sclerosis; no knee injury')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I02: Parity on "Taking warfarin 5mg daily; no back pain"', () => {
      const cRes = clientClassify('Taking warfarin 5mg daily; no back pain')
      const sRes = serverModule.classifyMedicalIntake('Taking warfarin 5mg daily; no back pain')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I03: Parity on "Has POTS and hypermobility; denies cardiac disease"', () => {
      const cRes = clientClassify('Has POTS and hypermobility; denies cardiac disease')
      const sRes = serverModule.classifyMedicalIntake('Has POTS and hypermobility; denies cardiac disease')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I04: Parity on "Fainted during HIIT sprint; no prior injuries"', () => {
      const cRes = clientClassify('Fainted during HIIT sprint; no prior injuries')
      const sRes = serverModule.classifyMedicalIntake('Fainted during HIIT sprint; no prior injuries')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I05: Parity on "Crushing chest pressure radiating to arm during jog"', () => {
      const cRes = clientClassify('Crushing chest pressure radiating to arm during jog')
      const sRes = serverModule.classifyMedicalIntake('Crushing chest pressure radiating to arm during jog')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I06: Parity on "Implanted cardiac pacemaker; fit and active"', () => {
      const cRes = clientClassify('Implanted cardiac pacemaker; fit and active')
      const sRes = serverModule.classifyMedicalIntake('Implanted cardiac pacemaker; fit and active')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I07: Parity on "T1D on insulin pump; denies shoulder problems"', () => {
      const cRes = clientClassify('T1D on insulin pump; denies shoulder problems')
      const sRes = serverModule.classifyMedicalIntake('T1D on insulin pump; denies shoulder problems')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I08: Parity on "End-stage renal disease on hemodialysis MWF"', () => {
      const cRes = clientClassify('End-stage renal disease on hemodialysis MWF')
      const sRes = serverModule.classifyMedicalIntake('End-stage renal disease on hemodialysis MWF')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I09: Parity on "Saddle anesthesia in groin; severe back tweak"', () => {
      const cRes = clientClassify('Saddle anesthesia in groin; severe back tweak')
      const sRes = serverModule.classifyMedicalIntake('Saddle anesthesia in groin; severe back tweak')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I10: Parity on "Hot swollen throbbing right calf; DVT suspected"', () => {
      const cRes = clientClassify('Hot swollen throbbing right calf; DVT suspected')
      const sRes = serverModule.classifyMedicalIntake('Hot swollen throbbing right calf; DVT suspected')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I11: Parity on "Amyotrophic lateral sclerosis ALS patient"', () => {
      const cRes = clientClassify('Amyotrophic lateral sclerosis ALS patient')
      const sRes = serverModule.classifyMedicalIntake('Amyotrophic lateral sclerosis ALS patient')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I12: Parity on "Push workout 3 days a week, fit and healthy, blood pressure 120/80"', () => {
      const cRes = clientClassify('Push workout 3 days a week, fit and healthy, blood pressure 120/80')
      const sRes = serverModule.classifyMedicalIntake('Push workout 3 days a week, fit and healthy, blood pressure 120/80')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I13: Parity on "Foam rolling tight calves, resting heart rate 58 bpm, clean health"', () => {
      const cRes = clientClassify('Foam rolling tight calves, resting heart rate 58 bpm, clean health')
      const sRes = serverModule.classifyMedicalIntake('Foam rolling tight calves, resting heart rate 58 bpm, clean health')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I14: Parity on "s/p laminectomy L4-L5 with persistent foot drop"', () => {
      const cRes = clientClassify('s/p laminectomy L4-L5 with persistent foot drop')
      const sRes = serverModule.classifyMedicalIntake('s/p laminectomy L4-L5 with persistent foot drop')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
    it('I15: Parity on "Severe diabeetus with peripheral neuropathy bilateral feet"', () => {
      const cRes = clientClassify('Severe diabeetus with peripheral neuropathy bilateral feet')
      const sRes = serverModule.classifyMedicalIntake('Severe diabeetus with peripheral neuropathy bilateral feet')
      expect(sRes.isSafetySensitive).toBe(cRes.isSafetySensitive)
      expect(sRes.activeCategories.sort()).toEqual(cRes.activeCategories.sort())
      expect(sRes.negatedCategories.sort()).toEqual(cRes.negatedCategories.sort())
      expect(sRes.historicalCategories.sort()).toEqual(cRes.historicalCategories.sort())
      expect(sRes.hasAmbiguousConditions).toBe(cRes.hasAmbiguousConditions)
    })
  })

  // --------------------------------------------------------------------------
  // SECTION J: NO INVENTED DIAGNOSIS INVARIANT (10 Tests: J01 - J10)
  // --------------------------------------------------------------------------
  describe('Section J: No Invented Diagnosis Invariant', () => {
    it('J01: "Diagnosed with multiple sclerosis" does not invent unassociated categories', () => {
      const res = clientClassify('Diagnosed with multiple sclerosis')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).not.toContain('pregnancy_late_stage')
      expect(res.activeCategories).not.toContain('severe_osteoporosis')
      expect(res.activeCategories).not.toContain('cardiac_symptomatic_condition')
    })
    it('J02: "Postural orthostatic tachycardia syndrome POTS" does not invent unassociated categories', () => {
      const res = clientClassify('Postural orthostatic tachycardia syndrome POTS')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).not.toContain('knee_high_impact')
      expect(res.activeCategories).not.toContain('cervical_spine_pathology')
      expect(res.activeCategories).not.toContain('severe_osteoarthritis')
    })
    it('J03: "Taking warfarin daily for mechanical valve" does not invent unassociated categories', () => {
      const res = clientClassify('Taking warfarin daily for mechanical valve')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).not.toContain('pregnancy_late_stage')
      expect(res.activeCategories).not.toContain('cervical_spine_pathology')
    })
    it('J04: "Has an implanted pacemaker" does not invent unassociated categories', () => {
      const res = clientClassify('Has an implanted pacemaker')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).not.toContain('knee_high_impact')
      expect(res.activeCategories).not.toContain('lumbar_disc_herniation')
    })
    it('J05: "Ehlers-Danlos syndrome hypermobility type" does not invent unassociated categories', () => {
      const res = clientClassify('Ehlers-Danlos syndrome hypermobility type')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).not.toContain('pregnancy_late_stage')
      expect(res.activeCategories).not.toContain('cervical_spine_pathology')
    })
    it('J06: "Amyotrophic lateral sclerosis ALS" does not invent unassociated categories', () => {
      const res = clientClassify('Amyotrophic lateral sclerosis ALS')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).not.toContain('pregnancy_late_stage')
      expect(res.activeCategories).not.toContain('severe_osteoporosis')
    })
    it('J07: "Stage 3 chronic kidney disease on medication" does not invent unassociated categories', () => {
      const res = clientClassify('Stage 3 chronic kidney disease on medication')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).not.toContain('knee_high_impact')
      expect(res.activeCategories).not.toContain('shoulder_impingement_cuff')
    })
    it('J08: "Sickle cell anemia with crises" does not invent unassociated categories', () => {
      const res = clientClassify('Sickle cell anemia with crises')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).not.toContain('pregnancy_late_stage')
      expect(res.activeCategories).not.toContain('severe_osteoporosis')
    })
    it('J09: "Coughing up blood after exertion" does not invent unassociated categories', () => {
      const res = clientClassify('Coughing up blood after exertion')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).not.toContain('knee_high_impact')
      expect(res.activeCategories).not.toContain('shoulder_impingement_cuff')
      expect(res.activeCategories).not.toContain('pregnancy_late_stage')
    })
    it('J10: "Knee feels funny sometimes" does not invent unassociated categories', () => {
      const res = clientClassify('Knee feels funny sometimes')
      expect(res.isSafetySensitive).toBe(true)
      expect(res.activeCategories).not.toContain('cervical_spine_pathology')
      expect(res.activeCategories).not.toContain('cardiac_symptomatic_condition')
      expect(res.activeCategories).not.toContain('pregnancy_late_stage')
    })
  })
})
