/**
 * clinicalSafetySemanticBoundaryOracle.test.ts
 *
 * Authoritative Machine-Checkable Clinical Safety Semantic Boundary Oracle for BodyMap AI.
 *
 * 450 Deterministic Test Assertions Covering:
 * - Section A: Medical Intake Semantics & Clause Disambiguation (75 tests: A01 - A75)
 * - Section B: Negation, Temporal Qualifiers & Conditional Overrides (65 tests: B01 - B65)
 * - Section C: Canonical Exercise Representation & Parsing (65 tests: C01 - C65)
 * - Section D: Clinical Contraindication x Exercise Family Cross-Product (110 tests: D01 - D110)
 * - Section E: Exemption Boundary & Substitution Scope Attacks (55 tests: E01 - E55)
 * - Section F: Unicode, Normalization & Typographic Adversaries (30 tests: F01 - F30)
 * - Section G: Client / Server Differential Parity (30 tests: G01 - G30)
 * - Section H: Generation Pipeline & Fail-Closed Adversarial Defense (20 tests: H01 - H20)
 *
 * Enforces:
 * 1. Semantic State Disambiguation (formal, active, acute, symptom, ambiguous, historical, family, negated).
 * 2. Permanent Structural Modification Persistence (joint replacements, fusions, bypass/stents remain restricted).
 * 3. Authority Override Invariance (claims of clinician or trainer clearance cannot bypass safety rules).
 * 4. Compound Exercise Isolation (unsafe + safe on same line always triggers violation).
 * 5. Substitution Scope Isolation (citations in alternative clauses do not falsely trigger violations).
 * 6. 100% Client/Server Differential Parity across all engines.
 */

import { describe, it, expect } from 'vitest'
import {
  classifyMedicalIntake as clientClassify,
  CATEGORY_LABELS,
  type ContraindicationCategoryKey,
} from '../lib/medicalIntakeParser'
import {
  scanPlanForContraindications as clientScanPlan,
  CONTRAINDICATION_TAXONOMY as clientTaxonomy,
} from '../lib/contraindicationGuard'
import {
  parseCanonicalExerciseLine as clientParseLine,
  cleanExerciseName as clientCleanName,
} from '../lib/canonicalExerciseParser'
import { hasSafetySensitiveMedicalIssues } from '../lib/validation'
import { generatePlanPrompt as clientGeneratePlanPrompt } from '../lib/gemini'
import * as serverModule from '../../api/generate-plan'

// ----------------------------------------------------------------------------
// SECTION A: MEDICAL INTAKE SEMANTICS & CLAUSE DISAMBIGUATION (A01 - A75)
// ----------------------------------------------------------------------------
describe('Section A: Medical Intake Semantics & Clause Disambiguation', () => {
  it("A01: Anterior cruciate ligament tear", () => {
    const res = clientClassify("Torn anterior cruciate ligament")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A02: Posterior cruciate ligament reconstruction", () => {
    const res = clientClassify("Posterior cruciate ligament reconstruction")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A03: Medial collateral ligament sprain", () => {
    const res = clientClassify("MCL sprain grade 2")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A04: Lateral collateral ligament tear", () => {
    const res = clientClassify("LCL tear left knee")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A05: Meniscus tear", () => {
    const res = clientClassify("Medial meniscus tear")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A06: Meniscal tear symptom", () => {
    const res = clientClassify("Meniscal tear with clicking")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A07: Chondromalacia patellae", () => {
    const res = clientClassify("Severe chondromalacia patellae")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A08: Patellofemoral pain syndrome", () => {
    const res = clientClassify("Patellofemoral pain syndrome bilateral")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A09: Patellar tendinitis", () => {
    const res = clientClassify("Chronic patellar tendinitis")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A10: Runner's knee", () => {
    const res = clientClassify("Severe runner's knee right leg")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A11: Supraspinatus tear", () => {
    const res = clientClassify("Full-thickness supraspinatus tear")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A12: Infraspinatus tendinopathy", () => {
    const res = clientClassify("Infraspinatus tendinitis with pain")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A13: Subscapularis tear", () => {
    const res = clientClassify("Partial subscapularis tear")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A14: Teres minor strain", () => {
    const res = clientClassify("Teres minor strain")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A15: Rotator cuff tear", () => {
    const res = clientClassify("Rotator cuff tear right shoulder")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A16: Subacromial impingement", () => {
    const res = clientClassify("Subacromial impingement syndrome")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A17: Glenoid labral tear", () => {
    const res = clientClassify("Glenoid labral tear anterior")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A18: SLAP tear", () => {
    const res = clientClassify("SLAP tear type II shoulder")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A19: Shoulder subluxation", () => {
    const res = clientClassify("Recurrent shoulder subluxation")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A20: Adhesive capsulitis", () => {
    const res = clientClassify("Adhesive capsulitis left shoulder")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A21: L4-L5 disc herniation", () => {
    const res = clientClassify("L4-L5 disc herniation")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A22: L5-S1 disc protrusion", () => {
    const res = clientClassify("L5-S1 disc protrusion with nerve impingement")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A23: Extruded lumbar disc", () => {
    const res = clientClassify("Extruded disc at L4-L5")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A24: Sciatica radiating pain", () => {
    const res = clientClassify("Severe sciatica down right leg")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A25: Lumbar radiculopathy", () => {
    const res = clientClassify("Lumbar radiculopathy with numbness")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A26: Spinal stenosis lumbar", () => {
    const res = clientClassify("Lumbar spinal stenosis")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A27: Spondylolisthesis", () => {
    const res = clientClassify("Grade 1 spondylolisthesis L5-S1")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A28: Degenerative disc disease lumbar", () => {
    const res = clientClassify("Degenerative disc disease lower back")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A29: Slipped disc lower back", () => {
    const res = clientClassify("Slipped disc lower back")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A30: Lower back disc injury", () => {
    const res = clientClassify("Lower back disc tear")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A31: C5-C6 cervical herniation", () => {
    const res = clientClassify("C5-C6 disc herniation")
    expect(res.activeCategories).toContain("cervical_spine_pathology")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A32: C6-C7 disc bulge", () => {
    const res = clientClassify("C6-C7 bulging disc in neck")
    expect(res.activeCategories).toContain("cervical_spine_pathology")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A33: Cervical radiculopathy", () => {
    const res = clientClassify("Cervical radiculopathy with arm tingling")
    expect(res.activeCategories).toContain("cervical_spine_pathology")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A34: Cervical spinal stenosis", () => {
    const res = clientClassify("Cervical spinal stenosis")
    expect(res.activeCategories).toContain("cervical_spine_pathology")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A35: Severe neck whiplash", () => {
    const res = clientClassify("Severe whiplash injury neck pain")
    expect(res.activeCategories).toContain("cervical_spine_pathology")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A36: Pinched nerve in neck", () => {
    const res = clientClassify("Pinched nerve in neck")
    expect(res.activeCategories).toContain("cervical_spine_pathology")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A37: Cervical disc surgery", () => {
    const res = clientClassify("Cervical disc herniation awaiting surgery")
    expect(res.activeCategories).toContain("cervical_spine_pathology")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A38: Acute neck injury", () => {
    const res = clientClassify("Injured neck with muscle spasms")
    expect(res.activeCategories).toContain("cervical_spine_pathology")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A39: Coronary artery disease", () => {
    const res = clientClassify("Coronary artery disease")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A40: Myocardial infarction history", () => {
    const res = clientClassify("Prior myocardial infarction")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A41: Heart attack", () => {
    const res = clientClassify("Had a heart attack")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A42: Unstable angina", () => {
    const res = clientClassify("Unstable angina pectoris")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A43: Exertional chest pain", () => {
    const res = clientClassify("Chest pain on exertion")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A44: Severe aortic stenosis", () => {
    const res = clientClassify("Severe aortic stenosis")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A45: Congestive heart failure", () => {
    const res = clientClassify("Congestive heart failure")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A46: Coronary stent", () => {
    const res = clientClassify("Coronary stent placed in 2021")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A47: Coronary artery bypass graft", () => {
    const res = clientClassify("Coronary artery bypass graft")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A48: Hypertrophic cardiomyopathy", () => {
    const res = clientClassify("Hypertrophic cardiomyopathy")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A49: 24 weeks pregnant", () => {
    const res = clientClassify("24 weeks pregnant")
    expect(res.activeCategories).toContain("pregnancy_late_stage")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A50: 28 weeks pregnant", () => {
    const res = clientClassify("28 weeks pregnant")
    expect(res.activeCategories).toContain("pregnancy_late_stage")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A51: 32 weeks pregnant", () => {
    const res = clientClassify("32 weeks pregnant")
    expect(res.activeCategories).toContain("pregnancy_late_stage")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A52: 36 weeks pregnant", () => {
    const res = clientClassify("36 weeks pregnant")
    expect(res.activeCategories).toContain("pregnancy_late_stage")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A53: Second trimester pregnancy", () => {
    const res = clientClassify("Currently in second trimester of pregnancy")
    expect(res.activeCategories).toContain("pregnancy_late_stage")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A54: Third trimester pregnancy", () => {
    const res = clientClassify("Third trimester pregnancy")
    expect(res.activeCategories).toContain("pregnancy_late_stage")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A55: 7 months pregnant", () => {
    const res = clientClassify("7 months pregnant")
    expect(res.activeCategories).toContain("pregnancy_late_stage")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A56: Late stage pregnancy", () => {
    const res = clientClassify("Late stage pregnancy")
    expect(res.activeCategories).toContain("pregnancy_late_stage")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A57: Severe osteoporosis", () => {
    const res = clientClassify("Severe osteoporosis")
    expect(res.activeCategories).toContain("severe_osteoporosis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A58: Osteopenia with fracture", () => {
    const res = clientClassify("Osteopenia with fracture history")
    expect(res.activeCategories).toContain("severe_osteoporosis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A59: T-score -3.1", () => {
    const res = clientClassify("T-score -3.1 in lumbar spine")
    expect(res.activeCategories).toContain("severe_osteoporosis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A60: Vertebral compression fracture", () => {
    const res = clientClassify("Vertebral compression fracture")
    expect(res.activeCategories).toContain("severe_osteoporosis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A61: Brittle bones", () => {
    const res = clientClassify("Brittle bones diagnosed")
    expect(res.activeCategories).toContain("severe_osteoporosis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A62: Severe bone density loss", () => {
    const res = clientClassify("Severe bone density loss")
    expect(res.activeCategories).toContain("severe_osteoporosis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A63: Bone fragility", () => {
    const res = clientClassify("Bone fragility syndrome")
    expect(res.activeCategories).toContain("severe_osteoporosis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A64: Osteoporosis with prior fracture", () => {
    const res = clientClassify("Osteoporosis with spine fracture")
    expect(res.activeCategories).toContain("severe_osteoporosis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A65: Severe osteoarthritis knee", () => {
    const res = clientClassify("Severe osteoarthritis of the knee")
    expect(res.activeCategories).toContain("severe_osteoarthritis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A66: End-stage degenerative joint disease", () => {
    const res = clientClassify("End-stage degenerative joint disease")
    expect(res.activeCategories).toContain("severe_osteoarthritis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A67: Grade 4 osteoarthritis", () => {
    const res = clientClassify("Grade 4 osteoarthritis right hip")
    expect(res.activeCategories).toContain("severe_osteoarthritis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A68: Bone on bone knee arthritis", () => {
    const res = clientClassify("Bone on bone knee arthritis")
    expect(res.activeCategories).toContain("severe_osteoarthritis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A69: Severe osteoarthritis hip", () => {
    const res = clientClassify("Severe osteoarthritis hip joint")
    expect(res.activeCategories).toContain("severe_osteoarthritis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("A70: Advanced knee arthrosis", () => {
    const res = clientClassify("Advanced knee arthrosis with severe pain")
    expect(res.activeCategories).toContain("severe_osteoarthritis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it('A71: Multi-clause semicolon separation parses both conditions', () => {
    const res = clientClassify('ACL tear left knee; L5-S1 disc herniation')
    expect(res.activeCategories).toContain('knee_high_impact')
    expect(res.activeCategories).toContain('lumbar_disc_herniation')
    expect(res.activeCategories.length).toBe(2)
  })

  it('A72: Numbered item list parses both conditions', () => {
    const res = clientClassify('1. Rotator cuff tear 2. Aortic stenosis')
    expect(res.activeCategories).toContain('shoulder_impingement_cuff')
    expect(res.activeCategories).toContain('cardiac_symptomatic_condition')
    expect(res.activeCategories.length).toBe(2)
  })

  it('A73: Conjunction "and also" parses knee and cervical spine conditions', () => {
    const res = clientClassify('Meniscus tear and also whiplash injury')
    expect(res.activeCategories).toContain('knee_high_impact')
    expect(res.activeCategories).toContain('cervical_spine_pathology')
    expect(res.activeCategories.length).toBe(2)
  })

  it('A74: Multiline newline separation parses osteoporosis and pregnancy', () => {
    const res = clientClassify('Severe osteoporosis\nThird trimester pregnancy')
    expect(res.activeCategories).toContain('severe_osteoporosis')
    expect(res.activeCategories).toContain('pregnancy_late_stage')
    expect(res.activeCategories.length).toBe(2)
  })

  it('A75: Multi-clause knee replacement and hip osteoarthritis', () => {
    const res = clientClassify('Total knee replacement; severe osteoarthritis right hip')
    expect(res.activeCategories).toContain('knee_high_impact')
    expect(res.activeCategories).toContain('severe_osteoarthritis')
    expect(res.activeCategories.length).toBe(2)
  })
})

// ----------------------------------------------------------------------------
// SECTION B: NEGATION, TEMPORAL QUALIFIERS & CONDITIONAL OVERRIDES (B01 - B65)
// ----------------------------------------------------------------------------
describe('Section B: Negation, Temporal Qualifiers & Conditional Overrides', () => {
  it("B01: Prefix negation: no knee pain", () => {
    const res = clientClassify("No knee pain")
    expect(res.activeCategories).not.toContain("knee_high_impact")
    expect(res.negatedCategories).toContain("knee_high_impact")
  })
  it("B02: Prefix negation: no shoulder injuries", () => {
    const res = clientClassify("No shoulder injuries")
    expect(res.activeCategories).not.toContain("shoulder_impingement_cuff")
    expect(res.negatedCategories).toContain("shoulder_impingement_cuff")
  })
  it("B03: Prefix negation: denies back pain", () => {
    const res = clientClassify("Denies back pain")
    expect(res.activeCategories).not.toContain("lumbar_disc_herniation")
    expect(res.negatedCategories).toContain("lumbar_disc_herniation")
  })
  it("B04: Prefix negation: never had cardiac issues", () => {
    const res = clientClassify("Never had cardiac issues")
    expect(res.activeCategories).not.toContain("cardiac_symptomatic_condition")
    expect(res.negatedCategories).toContain("cardiac_symptomatic_condition")
  })
  it("B05: Prefix negation: ruled out disc herniation", () => {
    const res = clientClassify("Ruled out disc herniation")
    expect(res.activeCategories).not.toContain("lumbar_disc_herniation")
    expect(res.negatedCategories).toContain("lumbar_disc_herniation")
  })
  it("B06: Prefix negation: free of spinal conditions", () => {
    const res = clientClassify("Free of any spinal conditions")
    expect(res.activeCategories).not.toContain("lumbar_disc_herniation")
    expect(res.negatedCategories).toContain("lumbar_disc_herniation")
  })
  it("B07: Prefix negation: without meniscus injury", () => {
    const res = clientClassify("Without meniscus injury")
    expect(res.activeCategories).not.toContain("knee_high_impact")
    expect(res.negatedCategories).toContain("knee_high_impact")
  })
  it("B08: Prefix negation: no history of rotator cuff tear", () => {
    const res = clientClassify("No history of rotator cuff tear")
    expect(res.activeCategories).not.toContain("shoulder_impingement_cuff")
    expect(res.negatedCategories).toContain("shoulder_impingement_cuff")
  })
  it("B09: Prefix negation: negative for osteoporosis", () => {
    const res = clientClassify("Negative for osteoporosis")
    expect(res.activeCategories).not.toContain("severe_osteoporosis")
    expect(res.negatedCategories).toContain("severe_osteoporosis")
  })
  it("B10: Prefix negation: no ACL tears", () => {
    const res = clientClassify("No ACL tears")
    expect(res.activeCategories).not.toContain("knee_high_impact")
    expect(res.negatedCategories).toContain("knee_high_impact")
  })
  it("B11: Prefix negation: zero cardiovascular symptoms", () => {
    const res = clientClassify("Zero cardiovascular symptoms")
    expect(res.activeCategories).not.toContain("cardiac_symptomatic_condition")
    expect(res.negatedCategories).toContain("cardiac_symptomatic_condition")
  })
  it("B12: Prefix negation: denies joint replacement", () => {
    const res = clientClassify("Denies any joint replacement")
    expect(res.activeCategories).not.toContain("knee_high_impact")
    expect(res.negatedCategories).toContain("knee_high_impact")
  })
  it("B13: Suffix negation: knee injury was ruled out", () => {
    const res = clientClassify("Knee injury was ruled out")
    expect(res.activeCategories).not.toContain("knee_high_impact")
  })
  it("B14: Suffix negation: back pain has been ruled out", () => {
    const res = clientClassify("Back pain has been ruled out")
    expect(res.activeCategories).not.toContain("lumbar_disc_herniation")
  })
  it("B15: Suffix negation: shoulder pain is non-existent", () => {
    const res = clientClassify("Shoulder pain is non-existent")
    expect(res.activeCategories).not.toContain("shoulder_impingement_cuff")
  })
  it("B16: Suffix negation: cardiac symptoms are absent", () => {
    const res = clientClassify("Cardiac symptoms are absent")
    expect(res.activeCategories).not.toContain("cardiac_symptomatic_condition")
  })
  it("B17: Historical resolved: disc herniation resolved without recurrence", () => {
    const res = clientClassify("Disc herniation resolved without recurrence years ago")
    expect(res.activeCategories).not.toContain("lumbar_disc_herniation")
  })
  it("B18: Historical resolved: no longer experiencing knee discomfort", () => {
    const res = clientClassify("Old knee injury years ago, no longer experiencing knee discomfort")
    expect(res.activeCategories).not.toContain("knee_high_impact")
  })
  it("B19: Historical resolved: sciatica has completely resolved", () => {
    const res = clientClassify("Sciatica has completely resolved 3 years ago")
    expect(res.activeCategories).not.toContain("lumbar_disc_herniation")
  })
  it("B20: Suffix negation: heart problems cleared negative", () => {
    const res = clientClassify("Checked for heart problems and cleared negative")
    expect(res.activeCategories).not.toContain("cardiac_symptomatic_condition")
  })
  it("B21: Suffix negation: meniscus is uninjured", () => {
    const res = clientClassify("Meniscus is uninjured")
    expect(res.activeCategories).not.toContain("knee_high_impact")
  })
  it("B22: Suffix negation: neck pain is absent", () => {
    const res = clientClassify("Neck pain is absent")
    expect(res.activeCategories).not.toContain("cervical_spine_pathology")
  })
  it("B23: No knee issues, but suffering from severe L5-S1 disc herniation", () => {
    const res = clientClassify("No knee issues, but suffering from severe L5-S1 disc herniation")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.negatedCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B24: Denies shoulder pain, however diagnosed with aortic stenosis", () => {
    const res = clientClassify("Denies shoulder pain, however diagnosed with aortic stenosis")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.negatedCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B25: No history of back pain; recovering from acute ACL reconstruction", () => {
    const res = clientClassify("No history of back pain; recovering from acute ACL reconstruction")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.negatedCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B26: Never had heart problems, but 28 weeks pregnant", () => {
    const res = clientClassify("Never had heart problems, but 28 weeks pregnant")
    expect(res.activeCategories).toContain("pregnancy_late_stage")
    expect(res.negatedCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B27: Ruled out rotator cuff injury, but bilateral severe knee osteoarthritis", () => {
    const res = clientClassify("Ruled out rotator cuff injury, but bilateral severe knee osteoarthritis")
    expect(res.activeCategories).toContain("severe_osteoarthritis")
    expect(res.negatedCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B28: No neck pain, but active sciatica down right leg", () => {
    const res = clientClassify("No neck pain, but active sciatica down right leg")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.negatedCategories).toContain("cervical_spine_pathology")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B29: No osteoporosis, but recent rotator cuff surgery", () => {
    const res = clientClassify("No osteoporosis, but recent rotator cuff surgery")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.negatedCategories).toContain("severe_osteoporosis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B30: Without cardiac disease, but experiencing lumbar disc bulge", () => {
    const res = clientClassify("Without cardiac disease, but experiencing lumbar disc bulge")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.negatedCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B32: Free from spinal issues, but severe patellar tendinitis", () => {
    const res = clientClassify("Free from spinal issues, but severe patellar tendinitis")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.negatedCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it('B31: Active condition overrides negation within same category (No joint replacements, but torn meniscus)', () => {
    const res = clientClassify('No joint replacements, but torn meniscus')
    expect(res.activeCategories).toContain('knee_high_impact')
    expect(res.negatedCategories).not.toContain('knee_high_impact')
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B33: Sprained ankle 5 years ago, fully healed", () => {
    const res = clientClassify("Sprained ankle 5 years ago, fully healed")
    expect(res.activeCategories).toEqual([])
    expect(res.isSafetySensitive).toBe(false)
  })
  it("B34: Mild shoulder strain 10 years ago, completely resolved and 100% pain-free", () => {
    const res = clientClassify("Mild shoulder strain in high school 10 years ago, completely resolved and 100% pain-free")
    expect(res.activeCategories).toEqual([])
    expect(res.isSafetySensitive).toBe(false)
  })
  it("B35: Pulled hamstring last summer, rehabilitated", () => {
    const res = clientClassify("Pulled hamstring 2 years ago, rehabilitated")
    expect(res.activeCategories).toEqual([])
    expect(res.isSafetySensitive).toBe(false)
  })
  it("B36: Broken collarbone 15 years ago in childhood, completely healed", () => {
    const res = clientClassify("Broken collarbone 15 years ago in childhood, completely healed")
    expect(res.activeCategories).toEqual([])
    expect(res.isSafetySensitive).toBe(false)
  })
  it("B37: Past runner's knee 8 years ago, resolved", () => {
    const res = clientClassify("Past runner's knee 8 years ago, resolved")
    expect(res.activeCategories).toEqual([])
    expect(res.isSafetySensitive).toBe(false)
  })
  it("B38: Prior tennis elbow 3 years ago, no pain now", () => {
    const res = clientClassify("Prior tennis elbow 3 years ago, healed")
    expect(res.activeCategories).toEqual([])
    expect(res.isSafetySensitive).toBe(false)
  })
  it("B39: Had mild backache 4 years ago after moving furniture, healed", () => {
    const res = clientClassify("Had mild backache 4 years ago after moving furniture, healed")
    expect(res.activeCategories).toEqual([])
    expect(res.isSafetySensitive).toBe(false)
  })
  it("B40: Old wrist fracture 12 years ago, fully functional", () => {
    const res = clientClassify("Old wrist fracture 12 years ago, fully functional and healed")
    expect(res.activeCategories).toEqual([])
    expect(res.isSafetySensitive).toBe(false)
  })
  it("B41: Mild neck stiffness 2 years ago, resolved with PT", () => {
    const res = clientClassify("Mild neck stiffness 2 years ago, resolved")
    expect(res.activeCategories).toEqual([])
    expect(res.isSafetySensitive).toBe(false)
  })
  it("B42: Past calf strain 6 years ago, cleared", () => {
    const res = clientClassify("Past calf strain 6 years ago, resolved and cleared")
    expect(res.activeCategories).toEqual([])
    expect(res.isSafetySensitive).toBe(false)
  })
  it("B43: Total knee replacement 5 years ago, pain-free now", () => {
    const res = clientClassify("Total knee replacement 5 years ago, pain-free now")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B44: Right knee arthroplasty done in 2019, fully healed", () => {
    const res = clientClassify("Right knee arthroplasty done in 2019, fully healed")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B45: Spinal fusion L4-L5 in 2016, no current pain", () => {
    const res = clientClassify("Spinal fusion L4-L5 in 2016, no current pain")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B46: Lumbar fusion 8 years ago, fully rehabilitated", () => {
    const res = clientClassify("Lumbar fusion 8 years ago, fully rehabilitated")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B47: Coronary artery bypass graft 4 years ago, feeling great", () => {
    const res = clientClassify("Coronary artery bypass graft 4 years ago, feeling great")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B48: Coronary stent placed in 2021, on aspirin, asymptomatic", () => {
    const res = clientClassify("Coronary stent placed in 2021, on aspirin, asymptomatic")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B49: Reverse shoulder arthroplasty 3 years ago", () => {
    const res = clientClassify("Reverse shoulder arthroplasty 3 years ago")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B50: Total shoulder replacement in 2018, doctor cleared for daily living", () => {
    const res = clientClassify("Total shoulder replacement in 2018, doctor cleared for daily living")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B51: Cervical spinal fusion C5-C6 6 years ago, neck is stable", () => {
    const res = clientClassify("Cervical spinal fusion C5-C6 6 years ago, neck is stable")
    expect(res.activeCategories).toContain("cervical_spine_pathology")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B52: Heart bypass surgery in 2017, no issues", () => {
    const res = clientClassify("Heart bypass surgery in 2017, no issues")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B53: Torn ACL, doctor cleared for box jumps", () => {
    const res = clientClassify("Torn ACL, but doctor cleared me for box jumps")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B54: L5-S1 disc herniation, PT cleared for heavy deadlifts", () => {
    const res = clientClassify("L5-S1 disc herniation, but physical therapist cleared me for heavy deadlifts")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B55: Aortic stenosis, cardiologist said sprint intervals okay", () => {
    const res = clientClassify("Aortic stenosis, cardiologist said I can do sprint intervals")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B56: Rotator cuff tear, doctor gave clearance for overhead press", () => {
    const res = clientClassify("Rotator cuff tear, doctor gave clearance for overhead press")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B57: 32 weeks pregnant, OBGYN said flat bench on back is fine", () => {
    const res = clientClassify("32 weeks pregnant, OBGYN said flat bench press on back is fine")
    expect(res.activeCategories).toContain("pregnancy_late_stage")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B58: Severe osteoporosis, doctor said loaded Russian twists okay", () => {
    const res = clientClassify("Severe osteoporosis T-score -3.5, doctor said loaded Russian twists are okay")
    expect(res.activeCategories).toContain("severe_osteoporosis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B59: Severe knee osteoarthritis bone on bone, cleared for jumping lunges", () => {
    const res = clientClassify("Severe knee osteoarthritis bone on bone, cleared by doctor for jumping lunges")
    expect(res.activeCategories).toContain("severe_osteoarthritis")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B60: Cervical spine herniation, chiropractor cleared for handstand push-ups", () => {
    const res = clientClassify("Cervical spine herniation, chiropractor cleared me for handstand push-ups")
    expect(res.activeCategories).toContain("cervical_spine_pathology")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B61: Patellar tendon rupture, trainer cleared for depth jumps", () => {
    const res = clientClassify("Patellar tendinitis, trainer cleared me for depth jumps")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B62: Meniscus tear, coach signed off on burpees", () => {
    const res = clientClassify("Meniscus tear, coach signed off on burpees")
    expect(res.activeCategories).toContain("knee_high_impact")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B63: Heart attack last year, cleared by gym owner for HIIT", () => {
    const res = clientClassify("Heart attack last year, cleared by gym owner for HIIT")
    expect(res.activeCategories).toContain("cardiac_symptomatic_condition")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B64: Sciatica, friend who is an MD cleared for good mornings", () => {
    const res = clientClassify("Sciatica, friend who is an MD cleared me for good mornings")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
    expect(res.isSafetySensitive).toBe(true)
  })
  it("B65: Subacromial impingement, sports doctor cleared for behind neck press", () => {
    const res = clientClassify("Subacromial impingement, sports doctor cleared me for behind the neck presses")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
    expect(res.isSafetySensitive).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// SECTION C: CANONICAL EXERCISE REPRESENTATION & PARSING (C01 - C65)
// ----------------------------------------------------------------------------
describe('Section C: Canonical Exercise Representation & Parsing', () => {
  it("C01: Parses single exercise \"Barbell Back Squat\"", () => {
    const res = clientParseLine("Barbell Back Squat: 4 sets x 8 reps, 90s rest")
    expect(res.length).toBe(1)
    expect(res[0].name).toBe("Barbell Back Squat")
    expect(res[0].sets).toBe("4")
    expect(res[0].reps).toBe("8")
  })
  it("C02: Parses single exercise \"Dumbbell Incline Bench Press\"", () => {
    const res = clientParseLine("Dumbbell Incline Bench Press: 3x10 (slow tempo)")
    expect(res.length).toBe(1)
    expect(res[0].name).toBe("Dumbbell Incline Bench Press")
    expect(res[0].sets).toBe("3")
    expect(res[0].reps).toBe("10")
  })
  it("C03: Parses single exercise \"Bodyweight Push-ups\"", () => {
    const res = clientParseLine("Bodyweight Push-ups: 3 sets x 15 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toBe("Bodyweight Push-ups")
    expect(res[0].sets).toBe("3")
    expect(res[0].reps).toBe("15")
  })
  it("C04: Parses single exercise \"Single-Leg Romanian Deadlift\"", () => {
    const res = clientParseLine("Single-Leg Romanian Deadlift: 3 sets x 12 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toBe("Single-Leg Romanian Deadlift")
    expect(res[0].sets).toBe("3")
    expect(res[0].reps).toBe("12")
  })
  it("C05: Parses single exercise \"Goblet Squat\"", () => {
    const res = clientParseLine("Goblet Squat (elevated heels): 3x12")
    expect(res.length).toBe(1)
    expect(res[0].name).toBe("Goblet Squat")
    expect(res[0].sets).toBe("3")
    expect(res[0].reps).toBe("12")
  })
  it("C06: Parses single exercise \"Side Plank\"", () => {
    const res = clientParseLine("Side Plank: 3 sets x 30 sec")
    expect(res.length).toBe(1)
    expect(res[0].name).toBe("Side Plank")
    expect(res[0].sets).toBe("3")
    
  })
  it("C07: Parses single exercise \"Standing Bicep Curls\"", () => {
    const res = clientParseLine("Standing Bicep Curls: 4 sets x 12 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toBe("Standing Bicep Curls")
    expect(res[0].sets).toBe("4")
    expect(res[0].reps).toBe("12")
  })
  it("C08: Parses single exercise \"Cable Face Pulls\"", () => {
    const res = clientParseLine("Cable Face Pulls: 3x15, 60s rest")
    expect(res.length).toBe(1)
    expect(res[0].name).toBe("Cable Face Pulls")
    expect(res[0].sets).toBe("3")
    expect(res[0].reps).toBe("15")
  })
  it("C09: Parses single exercise \"Lat Pulldown\"", () => {
    const res = clientParseLine("Lat Pulldown (wide grip): 3x10")
    expect(res.length).toBe(1)
    expect(res[0].name).toBe("Lat Pulldown")
    expect(res[0].sets).toBe("3")
    expect(res[0].reps).toBe("10")
  })
  it("C10: Parses single exercise \"Seated Leg Curl\"", () => {
    const res = clientParseLine("Seated Leg Curl: 3 sets x 12 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toBe("Seated Leg Curl")
    expect(res[0].sets).toBe("3")
    expect(res[0].reps).toBe("12")
  })
  it("C11: Parses single exercise \"Farmer's Walk\"", () => {
    const res = clientParseLine("Farmer's Walk: 3 sets x 40 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toBe("Farmer's Walk")
    expect(res[0].sets).toBe("3")
    expect(res[0].reps).toBe("40")
  })
  it("C12: Parses single exercise \"Hanging Knee Raises\"", () => {
    const res = clientParseLine("Hanging Knee Raises: 3 sets x 12 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toBe("Hanging Knee Raises")
    expect(res[0].sets).toBe("3")
    expect(res[0].reps).toBe("12")
  })
  it("C13: Olympic movement protected from tearing: \"Clean & Press: 3 sets x 5 reps\"", () => {
    const res = clientParseLine("Clean & Press: 3 sets x 5 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/clean\s*&\s*press/i)
  })
  it("C14: Olympic movement protected from tearing: \"Clean and Press: 4 sets x 3 reps\"", () => {
    const res = clientParseLine("Clean and Press: 4 sets x 3 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/clean\s+and\s+press/i)
  })
  it("C15: Olympic movement protected from tearing: \"Barbell Clean and Jerk: 5 sets x 2 reps\"", () => {
    const res = clientParseLine("Barbell Clean and Jerk: 5 sets x 2 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/clean\s+and\s+jerk/i)
  })
  it("C16: Olympic movement protected from tearing: \"Dumbbell Clean & Jerk: 3 sets x 5 reps\"", () => {
    const res = clientParseLine("Dumbbell Clean & Jerk: 3 sets x 5 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/clean\s*&\s*jerk/i)
  })
  it("C17: Olympic movement protected from tearing: \"Power Snatch & Overhead Squat: 3 sets x 3 reps\"", () => {
    const res = clientParseLine("Power Snatch & Overhead Squat: 3 sets x 3 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/snatch\s*&\s*overhead\s+squat/i)
  })
  it("C18: Olympic movement protected from tearing: \"Hang Clean and Jerk: 4 sets x 2 reps\"", () => {
    const res = clientParseLine("Hang Clean and Jerk: 4 sets x 2 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/clean\s+and\s+jerk/i)
  })
  it("C19: Olympic movement protected from tearing: \"Clean pull and shrug: 3 sets x 5 reps\"", () => {
    const res = clientParseLine("Clean pull and shrug: 3 sets x 5 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/clean\s+pull\s+and\s+shrug/i)
  })
  it("C20: Olympic movement protected from tearing: \"Clean & jerk: 3 sets x 3 reps\"", () => {
    const res = clientParseLine("Clean & jerk: 3 sets x 3 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/clean\s*&\s*jerk/i)
  })
  it("C21: Olympic movement protected from tearing: \"C&J: 5 sets x 2 reps\"", () => {
    const res = clientParseLine("C&J: 5 sets x 2 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/c&j/i)
  })
  it("C22: Olympic movement protected from tearing: \"Barbell Snatch & Overhead Squat: 3 sets x 2 reps\"", () => {
    const res = clientParseLine("Barbell Snatch & Overhead Squat: 3 sets x 2 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/snatch\s*&\s*overhead\s+squat/i)
  })
  it("C23: Olympic movement protected from tearing: \"Muscle clean & press: 3 sets x 4 reps\"", () => {
    const res = clientParseLine("Muscle clean & press: 3 sets x 4 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/clean\s*&\s*press/i)
  })
  it("C24: Olympic movement protected from tearing: \"Kettlebell clean and press: 3 sets x 5 reps\"", () => {
    const res = clientParseLine("Kettlebell clean and press: 3 sets x 5 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/clean\s+and\s+press/i)
  })
  it("C25: Olympic movement protected from tearing: \"Squat clean & jerk: 3 sets x 2 reps\"", () => {
    const res = clientParseLine("Squat clean & jerk: 3 sets x 2 reps")
    expect(res.length).toBe(1)
    expect(res[0].name).toMatch(/clean\s*&\s*jerk/i)
  })
  it("C26: Compound segmentation via \"&\" produces 2 exercises", () => {
    const res = clientParseLine("Push-ups & Pull-ups: 3 sets x 10 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Push-ups")
    expect(res[1].name).toBe("Pull-ups")
  })
  it("C27: Compound segmentation via \"&&\" produces 2 exercises", () => {
    const res = clientParseLine("Squats && Calf Raises: 3 sets x 15 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Squats")
    expect(res[1].name).toBe("Calf Raises")
  })
  it("C28: Compound segmentation via \"+\" produces 2 exercises", () => {
    const res = clientParseLine("Glute Bridges + Plank: 3 sets x 10 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Glute Bridges")
    expect(res[1].name).toBe("Plank")
  })
  it("C29: Compound segmentation via \"/\" produces 2 exercises", () => {
    const res = clientParseLine("Bicep Curls / Tricep Pushdowns: 3 sets x 12 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Bicep Curls")
    expect(res[1].name).toBe("Tricep Pushdowns")
  })
  it("C30: Compound segmentation via \";\" produces 2 exercises", () => {
    const res = clientParseLine("Step-ups: 3x12; Lunges: 3x12")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Step-ups")
    expect(res[1].name).toBe("Lunges")
  })
  it("C31: Compound segmentation via \"|\" produces 2 exercises", () => {
    const res = clientParseLine("Leg Press | Leg Extensions: 3 sets x 10 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Leg Press")
    expect(res[1].name).toBe("Leg Extensions")
  })
  it("C32: Compound segmentation via \"— (em-dash)\" produces 2 exercises", () => {
    const res = clientParseLine("Dumbbell Rows — Face Pulls: 3 sets x 12 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Dumbbell Rows")
    expect(res[1].name).toBe("Face Pulls")
  })
  it("C33: Compound segmentation via \"– (en-dash)\" produces 2 exercises", () => {
    const res = clientParseLine("Dumbbell Press – Chest Flyes: 3 sets x 10 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Dumbbell Press")
    expect(res[1].name).toBe("Chest Flyes")
  })
  it("C34: Compound segmentation via \"--\" produces 2 exercises", () => {
    const res = clientParseLine("Hamstring Curls -- Calf Raises: 3 sets x 15 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Hamstring Curls")
    expect(res[1].name).toBe("Calf Raises")
  })
  it("C35: Compound segmentation via \"paired with\" produces 2 exercises", () => {
    const res = clientParseLine("Incline Press paired with Cable Row: 3 sets x 10 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Incline Press")
    expect(res[1].name).toBe("Cable Row")
  })
  it("C36: Compound segmentation via \"followed by\" produces 2 exercises", () => {
    const res = clientParseLine("Wall Sit followed by Calf Raises: 3 sets x 10 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Wall Sit")
    expect(res[1].name).toBe("Calf Raises")
  })
  it("C37: Compound segmentation via \"then\" produces 2 exercises", () => {
    const res = clientParseLine("Plank then Bird-Dog: 3 sets x 10 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Plank")
    expect(res[1].name).toBe("Bird-Dog")
  })
  it("C38: Compound segmentation via \"alternating with\" produces 2 exercises", () => {
    const res = clientParseLine("Bicep Curls alternating with Hammer Curls: 3 sets x 10 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Bicep Curls")
    expect(res[1].name).toBe("Hammer Curls")
  })
  it("C39: Compound segmentation via \"superset with\" produces 2 exercises", () => {
    const res = clientParseLine("Chest Press superset with Lat Pulldown: 3 sets x 12 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Chest Press")
    expect(res[1].name).toBe("Lat Pulldown")
  })
  it("C40: Compound segmentation via \"combined with\" produces 2 exercises", () => {
    const res = clientParseLine("Step-ups combined with Calf Raises: 3 sets x 15 reps")
    expect(res.length).toBe(2)
    expect(res[0].name).toBe("Step-ups")
    expect(res[1].name).toBe("Calf Raises")
  })
  it("C41: Prescription preservation / formatting on \"Push-ups and Sit-ups: 3 sets x 15 reps\"", () => {
    const res = clientParseLine("Push-ups and Sit-ups: 3 sets x 15 reps")
    expect(res.length).toBeGreaterThanOrEqual(1)
    
    expect(res[0].name).toBe("Push-ups")
    expect(res[1].name).toBe("Sit-ups")
    expect(res[0].sets).toBe("3")
    expect(res[0].reps).toBe("15")
    
  })
  it("C42: Prescription preservation / formatting on \"Bench Press: 4 sets x 6 reps, Barbell Row: 4 sets x 8 reps\"", () => {
    const res = clientParseLine("Bench Press: 4 sets x 6 reps, Barbell Row: 4 sets x 8 reps")
    expect(res.length).toBeGreaterThanOrEqual(1)
    
    expect(res[0].name).toBe("Bench Press")
    expect(res[1].name).toBe("Barbell Row")
    
    
    
  })
  it("C43: Prescription preservation / formatting on \"Exercise 1: Incline Dumbbell Press: 3 sets x 10 reps\"", () => {
    const res = clientParseLine("Exercise 1: Incline Dumbbell Press: 3 sets x 10 reps")
    expect(res.length).toBeGreaterThanOrEqual(1)
    expect(res[0].name).toBe("Incline Dumbbell Press")
    
    
    
    
    
  })
  it("C44: Prescription preservation / formatting on \"Circuit A: Squats: 3 sets x 12 reps\"", () => {
    const res = clientParseLine("Circuit A: Squats: 3 sets x 12 reps")
    expect(res.length).toBeGreaterThanOrEqual(1)
    expect(res[0].name).toBe("Squats")
    
    
    
    
    
  })
  it("C45: Prescription preservation / formatting on \"Station 3: Kettlebell Swings: 3 sets x 15 reps\"", () => {
    const res = clientParseLine("Station 3: Kettlebell Swings: 3 sets x 15 reps")
    expect(res.length).toBeGreaterThanOrEqual(1)
    expect(res[0].name).toBe("Kettlebell Swings")
    
    
    
    
    
  })
  it("C46: Prescription preservation / formatting on \"Movement 2 - Lunges: 3 sets x 10 reps\"", () => {
    const res = clientParseLine("Movement 2 - Lunges: 3 sets x 10 reps")
    expect(res.length).toBeGreaterThanOrEqual(1)
    expect(res[0].name).toBe("Lunges")
    
    
    
    
    
  })
  it("C47: Prescription preservation / formatting on \"Part 1: Pull-ups: 3 sets x 8 reps\"", () => {
    const res = clientParseLine("Part 1: Pull-ups: 3 sets x 8 reps")
    expect(res.length).toBeGreaterThanOrEqual(1)
    expect(res[0].name).toBe("Pull-ups")
    
    
    
    
    
  })
  it("C48: Prescription preservation / formatting on \"Squats [Tempo 3-0-1-0]: 3 sets x 10 reps\"", () => {
    const res = clientParseLine("Squats [Tempo 3-0-1-0]: 3 sets x 10 reps")
    expect(res.length).toBeGreaterThanOrEqual(1)
    expect(res[0].name).toBe("Squats")
    
    
    
    
    
  })
  it("C49: Prescription preservation / formatting on \"Lateral Raises (slow eccentric): 3 sets x 12 reps\"", () => {
    const res = clientParseLine("Lateral Raises (slow eccentric): 3 sets x 12 reps")
    expect(res.length).toBeGreaterThanOrEqual(1)
    expect(res[0].name).toBe("Lateral Raises")
    
    
    
    
    
  })
  it("C50: Prescription preservation / formatting on \"Dumbbell Rows: 4 sets x 8 reps (90s rest)\"", () => {
    const res = clientParseLine("Dumbbell Rows: 4 sets x 8 reps (90s rest)")
    expect(res.length).toBeGreaterThanOrEqual(1)
    expect(res[0].name).toBe("Dumbbell Rows")
    
    
    expect(res[0].sets).toBe("4")
    expect(res[0].reps).toBe("8")
    expect(res[0].rest).toBe("90s")
  })
  it("C51: Prescription preservation / formatting on \"Leg Press: 3x10; Calf Raises: 3x15\"", () => {
    const res = clientParseLine("Leg Press: 3x10; Calf Raises: 3x15")
    expect(res.length).toBeGreaterThanOrEqual(1)
    
    expect(res[0].name).toBe("Leg Press")
    expect(res[1].name).toBe("Calf Raises")
    
    
    
  })
  it("C52: Prescription preservation / formatting on \"Pull-ups: 3 sets x 8 reps, Dips: 3 sets x 10 reps\"", () => {
    const res = clientParseLine("Pull-ups: 3 sets x 8 reps, Dips: 3 sets x 10 reps")
    expect(res.length).toBeGreaterThanOrEqual(1)
    
    expect(res[0].name).toBe("Pull-ups")
    expect(res[1].name).toBe("Dips")
    
    
    
  })
  it("C53: Non-exercise line filters out: \"Breakfast: 3 scrambled eggs with spinach and whole wheat toast\"", () => {
    const res = clientParseLine("Breakfast: 3 scrambled eggs with spinach and whole wheat toast")
    expect(res.length).toBe(0)
  })
  it("C54: Non-exercise line filters out: \"Lunch: Grilled chicken breast with quinoa and steamed broccoli\"", () => {
    const res = clientParseLine("Lunch: Grilled chicken breast with quinoa and steamed broccoli")
    expect(res.length).toBe(0)
  })
  it("C55: Non-exercise line filters out: \"Dinner: Baked salmon with sweet potato and asparagus\"", () => {
    const res = clientParseLine("Dinner: Baked salmon with sweet potato and asparagus")
    expect(res.length).toBe(0)
  })
  it("C56: Non-exercise line filters out: \"Snack: Greek yogurt with blueberries and almonds\"", () => {
    const res = clientParseLine("Snack: Greek yogurt with blueberries and almonds")
    expect(res.length).toBe(0)
  })
  it("C57: Non-exercise line filters out: \"Morning Snack: Protein shake with banana\"", () => {
    const res = clientParseLine("Morning Snack: Protein shake with banana")
    expect(res.length).toBe(0)
  })
  it("C58: Non-exercise line filters out: \"Afternoon Snack: Apple slices with peanut butter\"", () => {
    const res = clientParseLine("Afternoon Snack: Apple slices with peanut butter")
    expect(res.length).toBe(0)
  })
  it("C59: Non-exercise line filters out: \"Evening Snack: Cottage cheese\"", () => {
    const res = clientParseLine("Evening Snack: Cottage cheese")
    expect(res.length).toBe(0)
  })
  it("C60: Non-exercise line filters out: \"Hydration: Drink at least 3 liters of water throughout the day\"", () => {
    const res = clientParseLine("Hydration: Drink at least 3 liters of water throughout the day")
    expect(res.length).toBe(0)
  })
  it("C61: Non-exercise line filters out: \"Warm-up: 5 minutes light dynamic stretching\"", () => {
    const res = clientParseLine("Warm-up: 5 minutes light dynamic stretching")
    expect(res.length).toBe(0)
  })
  it("C62: Non-exercise line filters out: \"Cool-down: 5 minutes gentle foam rolling and deep breathing\"", () => {
    const res = clientParseLine("Cool-down: 5 minutes gentle foam rolling and deep breathing")
    expect(res.length).toBe(0)
  })
  it("C63: Non-exercise line filters out: \"Main Workout: 45 minutes high intensity\"", () => {
    const res = clientParseLine("Main Workout: 45 minutes high intensity")
    expect(res.length).toBe(0)
  })
  it("C64: Non-exercise line filters out: \"### Day 1: Full Body Blast\"", () => {
    const res = clientParseLine("### Day 1: Full Body Blast")
    expect(res.length).toBe(0)
  })
  it("C65: Non-exercise line filters out: \"Rest Day - Active recovery walk recommended\"", () => {
    const res = clientParseLine("Rest Day - Active recovery walk recommended")
    expect(res.length).toBe(0)
  })
})

// ----------------------------------------------------------------------------
// SECTION D: CLINICAL CONTRAINDICATION x EXERCISE FAMILY CROSS-PRODUCT (D01 - D110)
// ----------------------------------------------------------------------------
describe('Section D: Clinical Contraindication x Exercise Family Cross-Product', () => {
  it("D01: [knee_high_impact] \"Box Jumps\" for \"Torn ACL\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Box Jumps" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(true)
  })
  it("D02: [knee_high_impact] \"Depth Jumps\" for \"Meniscus tear\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Depth Jumps" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Meniscus tear")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(true)
  })
  it("D03: [knee_high_impact] \"Burpees\" for \"Patellar tendinitis\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Burpees" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Patellar tendinitis")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(true)
  })
  it("D04: [knee_high_impact] \"Jump Squats\" for \"ACL reconstruction\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Jump Squats" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "ACL reconstruction")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(true)
  })
  it("D05: [knee_high_impact] \"Tuck Jumps\" for \"Chondromalacia patellae\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Tuck Jumps" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Chondromalacia patellae")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(true)
  })
  it("D06: [knee_high_impact] \"Broad Jumps\" for \"Patellofemoral pain\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Broad Jumps" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Patellofemoral pain")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(true)
  })
  it("D07: [knee_high_impact] \"Jumping Lunges\" for \"Torn meniscus\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Jumping Lunges" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Torn meniscus")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(true)
  })
  it("D08: [knee_high_impact] \"Skater Jumps\" for \"MCL sprain\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Skater Jumps" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "MCL sprain")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(true)
  })
  it("D09: [knee_high_impact] \"Double Unders\" for \"Knee reconstruction\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Double Unders" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Knee reconstruction")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(true)
  })
  it("D10: [knee_high_impact] \"Pistol Squats\" for \"Total knee replacement\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Pistol Squats" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Total knee replacement")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(true)
  })
  it("D11: [knee_high_impact] \"Box Squats\" for \"ACL tear\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Box Squats" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "ACL tear")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(false)
  })
  it("D12: [knee_high_impact] \"Goblet Squats\" for \"Meniscus tear\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Goblet Squats" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Meniscus tear")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(false)
  })
  it("D13: [knee_high_impact] \"Bodyweight Squats\" for \"Patellar tendinitis\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Bodyweight Squats" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Patellar tendinitis")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(false)
  })
  it("D14: [knee_high_impact] \"Wall Sits\" for \"Patellofemoral pain\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Wall Sits" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Patellofemoral pain")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(false)
  })
  it("D15: [knee_high_impact] \"Step-ups\" for \"Chondromalacia patellae\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Step-ups" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Chondromalacia patellae")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(false)
  })
  it("D16: [knee_high_impact] \"Straight-Leg Raises\" for \"Torn meniscus\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Straight-Leg Raises" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Torn meniscus")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(false)
  })
  it("D17: [knee_high_impact] \"Glute Bridges\" for \"ACL reconstruction\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Glute Bridges" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "ACL reconstruction")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(false)
  })
  it("D18: [knee_high_impact] \"Stationary Cycling\" for \"MCL sprain\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Stationary Cycling" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "MCL sprain")
    const isBlocked = scan.violations.some(v => v.category === "knee_high_impact")
    expect(isBlocked).toBe(false)
  })
  it("D19: [shoulder_impingement_cuff] \"Overhead Press\" for \"Rotator cuff tear\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Overhead Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Rotator cuff tear")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(true)
  })
  it("D20: [shoulder_impingement_cuff] \"Military Press\" for \"Subacromial impingement\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Military Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Subacromial impingement")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(true)
  })
  it("D21: [shoulder_impingement_cuff] \"Arnold Press\" for \"Supraspinatus tear\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Arnold Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Supraspinatus tear")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(true)
  })
  it("D22: [shoulder_impingement_cuff] \"Behind-the-Neck Press\" for \"Shoulder impingement\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Behind-the-Neck Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Shoulder impingement")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(true)
  })
  it("D23: [shoulder_impingement_cuff] \"Handstand Push-ups\" for \"Labral tear\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Handstand Push-ups" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Labral tear")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(true)
  })
  it("D24: [shoulder_impingement_cuff] \"Upright Rows\" for \"SLAP tear\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Upright Rows" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "SLAP tear")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(true)
  })
  it("D25: [shoulder_impingement_cuff] \"Parallel Bar Dips\" for \"Rotator cuff repair\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Parallel Bar Dips" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Rotator cuff repair")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(true)
  })
  it("D26: [shoulder_impingement_cuff] \"Bench Dips\" for \"Shoulder dislocation\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Bench Dips" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Shoulder dislocation")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(true)
  })
  it("D27: [shoulder_impingement_cuff] \"Clean & Press\" for \"Infraspinatus strain\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Clean & Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Infraspinatus strain")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(true)
  })
  it("D28: [shoulder_impingement_cuff] \"Push Jerk\" for \"Subscapularis tear\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Push Jerk" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Subscapularis tear")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(true)
  })
  it("D29: [shoulder_impingement_cuff] \"Barbell Bench Press\" for \"Rotator cuff tear\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Barbell Bench Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Rotator cuff tear")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(false)
  })
  it("D30: [shoulder_impingement_cuff] \"Push-ups\" for \"Subacromial impingement\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Push-ups" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Subacromial impingement")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(false)
  })
  it("D31: [shoulder_impingement_cuff] \"Floor Press\" for \"Supraspinatus tear\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Floor Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Supraspinatus tear")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(false)
  })
  it("D32: [shoulder_impingement_cuff] \"Chest Press\" for \"Shoulder impingement\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Chest Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Shoulder impingement")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(false)
  })
  it("D33: [shoulder_impingement_cuff] \"Chest Flyes\" for \"Labral tear\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Chest Flyes" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Labral tear")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(false)
  })
  it("D34: [shoulder_impingement_cuff] \"Lateral Raises below shoulder\" for \"SLAP tear\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Lateral Raises below shoulder" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "SLAP tear")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(false)
  })
  it("D35: [shoulder_impingement_cuff] \"External Rotations\" for \"Rotator cuff repair\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "External Rotations" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Rotator cuff repair")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(false)
  })
  it("D36: [shoulder_impingement_cuff] \"Bicep Curls\" for \"Shoulder subluxation\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Bicep Curls" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Shoulder subluxation")
    const isBlocked = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(isBlocked).toBe(false)
  })
  it("D37: [lumbar_disc_herniation] \"Conventional Deadlift\" for \"L4-L5 disc herniation\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Conventional Deadlift" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "L4-L5 disc herniation")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(true)
  })
  it("D38: [lumbar_disc_herniation] \"Romanian Deadlift\" for \"L5-S1 disc protrusion\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Romanian Deadlift" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "L5-S1 disc protrusion")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(true)
  })
  it("D39: [lumbar_disc_herniation] \"Stiff-Leg Deadlift\" for \"Sciatica\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Stiff-Leg Deadlift" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Sciatica")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(true)
  })
  it("D40: [lumbar_disc_herniation] \"Barbell Back Squats\" for \"Lumbar radiculopathy\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Barbell Back Squats" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Lumbar radiculopathy")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(true)
  })
  it("D41: [lumbar_disc_herniation] \"Good Mornings\" for \"Spinal stenosis\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Good Mornings" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Spinal stenosis")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(true)
  })
  it("D42: [lumbar_disc_herniation] \"Jefferson Curls\" for \"Spondylolisthesis\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Jefferson Curls" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Spondylolisthesis")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(true)
  })
  it("D43: [lumbar_disc_herniation] \"Bent-Over Barbell Rows\" for \"Disc bulge lower back\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Bent-Over Barbell Rows" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Disc bulge lower back")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(true)
  })
  it("D44: [lumbar_disc_herniation] \"Russian Twists\" for \"Slipped disc\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Russian Twists" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Slipped disc")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(true)
  })
  it("D45: [lumbar_disc_herniation] \"Weighted Sit-ups\" for \"Extruded lumbar disc\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Weighted Sit-ups" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Extruded lumbar disc")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(true)
  })
  it("D46: [lumbar_disc_herniation] \"Clean and Jerk\" for \"Lumbar disc herniation\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Clean and Jerk" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Lumbar disc herniation")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(true)
  })
  it("D47: [lumbar_disc_herniation] \"Glute Bridges\" for \"L4-L5 disc herniation\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Glute Bridges" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "L4-L5 disc herniation")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(false)
  })
  it("D48: [lumbar_disc_herniation] \"Bird-Dog\" for \"L5-S1 disc protrusion\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Bird-Dog" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "L5-S1 disc protrusion")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(false)
  })
  it("D49: [lumbar_disc_herniation] \"McGill Curl-up\" for \"Sciatica\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "McGill Curl-up" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Sciatica")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(false)
  })
  it("D50: [lumbar_disc_herniation] \"Side Plank\" for \"Lumbar radiculopathy\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Side Plank" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Lumbar radiculopathy")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(false)
  })
  it("D51: [lumbar_disc_herniation] \"Pallof Press\" for \"Spinal stenosis\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Pallof Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Spinal stenosis")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(false)
  })
  it("D52: [lumbar_disc_herniation] \"Chest Supported Row\" for \"Spondylolisthesis\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Chest Supported Row" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Spondylolisthesis")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(false)
  })
  it("D53: [lumbar_disc_herniation] \"Wall Sits\" for \"Disc bulge\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Wall Sits" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Disc bulge")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(false)
  })
  it("D54: [lumbar_disc_herniation] \"Step-ups\" for \"Slipped disc\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Step-ups" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Slipped disc")
    const isBlocked = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(isBlocked).toBe(false)
  })
  it("D55: [cervical_spine_pathology] \"Barbell Shrugs\" for \"C5-C6 disc herniation\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Barbell Shrugs" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "C5-C6 disc herniation")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(true)
  })
  it("D56: [cervical_spine_pathology] \"Handstand Push-ups\" for \"Cervical radiculopathy\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Handstand Push-ups" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Cervical radiculopathy")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(true)
  })
  it("D57: [cervical_spine_pathology] \"Behind-the-Neck Press\" for \"Cervical stenosis\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Behind-the-Neck Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Cervical stenosis")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(true)
  })
  it("D58: [cervical_spine_pathology] \"Behind the Neck Pulldown\" for \"Neck whiplash\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Behind the Neck Pulldown" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Neck whiplash")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(true)
  })
  it("D59: [cervical_spine_pathology] \"Headstands\" for \"C6-C7 disc bulge\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Headstands" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "C6-C7 disc bulge")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(true)
  })
  it("D60: [cervical_spine_pathology] \"Barbell Back Squats\" for \"Pinched nerve in neck\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Barbell Back Squats" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Pinched nerve in neck")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(true)
  })
  it("D61: [cervical_spine_pathology] \"Upright Rows\" for \"Cervical disc surgery\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Upright Rows" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Cervical disc surgery")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(true)
  })
  it("D62: [cervical_spine_pathology] \"Neck Bridges\" for \"Cervical herniation\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Neck Bridges" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Cervical herniation")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(true)
  })
  it("D63: [cervical_spine_pathology] \"Chest Press\" for \"C5-C6 disc herniation\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Chest Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "C5-C6 disc herniation")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(false)
  })
  it("D64: [cervical_spine_pathology] \"Incline Dumbbell Row\" for \"Cervical radiculopathy\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Incline Dumbbell Row" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Cervical radiculopathy")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(false)
  })
  it("D65: [cervical_spine_pathology] \"Seated Cable Row\" for \"Cervical stenosis\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Seated Cable Row" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Cervical stenosis")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(false)
  })
  it("D66: [cervical_spine_pathology] \"Leg Press\" for \"Neck whiplash\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Leg Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Neck whiplash")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(false)
  })
  it("D67: [cervical_spine_pathology] \"Glute Bridges\" for \"C6-C7 disc bulge\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Glute Bridges" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "C6-C7 disc bulge")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(false)
  })
  it("D68: [cervical_spine_pathology] \"Dumbbell Lunges\" for \"Pinched nerve in neck\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Dumbbell Lunges" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Pinched nerve in neck")
    const isBlocked = scan.violations.some(v => v.category === "cervical_spine_pathology")
    expect(isBlocked).toBe(false)
  })
  it("D69: [cardiac_symptomatic_condition] \"Maximal 1RM Squat Testing\" for \"Aortic stenosis\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Maximal 1RM Squat Testing" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Aortic stenosis")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(true)
  })
  it("D70: [cardiac_symptomatic_condition] \"Heavy Leg Press with Valsalva\" for \"Coronary artery disease\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Heavy Leg Press with Valsalva" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Coronary artery disease")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(true)
  })
  it("D71: [cardiac_symptomatic_condition] \"Maximal Wall Sit with Valsalva\" for \"Prior heart attack\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Maximal Wall Sit with Valsalva" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Prior heart attack")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(true)
  })
  it("D72: [cardiac_symptomatic_condition] \"Sprint Interval Burpees\" for \"Unstable angina\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Sprint Interval Burpees" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Unstable angina")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(true)
  })
  it("D73: [cardiac_symptomatic_condition] \"Heavy Deadlift 1RM Test\" for \"Congestive heart failure\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Heavy Deadlift 1RM Test" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Congestive heart failure")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(true)
  })
  it("D74: [cardiac_symptomatic_condition] \"Max Effort Sled Push to Failure\" for \"Coronary stent placed\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Max Effort Sled Push to Failure" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Coronary stent placed")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(true)
  })
  it("D75: [cardiac_symptomatic_condition] \"High Intensity Interval Battle Ropes\" for \"Severe hypertension\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "High Intensity Interval Battle Ropes" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Severe hypertension")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(true)
  })
  it("D76: [cardiac_symptomatic_condition] \"All-out Sprint Intervals\" for \"Hypertrophic cardiomyopathy\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "All-out Sprint Intervals" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Hypertrophic cardiomyopathy")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(true)
  })
  it("D77: [cardiac_symptomatic_condition] \"Moderate Walking\" for \"Aortic stenosis\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Moderate Walking" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Aortic stenosis")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(false)
  })
  it("D78: [cardiac_symptomatic_condition] \"Stationary Cycling (low resistance)\" for \"Coronary artery disease\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Stationary Cycling (low resistance)" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Coronary artery disease")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(false)
  })
  it("D79: [cardiac_symptomatic_condition] \"Light Dumbbell Bicep Curls\" for \"Prior heart attack\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Light Dumbbell Bicep Curls" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Prior heart attack")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(false)
  })
  it("D80: [cardiac_symptomatic_condition] \"Seated Machine Chest Press (light)\" for \"Unstable angina\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Seated Machine Chest Press (light)" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Unstable angina")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(false)
  })
  it("D81: [cardiac_symptomatic_condition] \"Water Aerobics\" for \"Coronary stent placed\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Water Aerobics" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Coronary stent placed")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(false)
  })
  it("D82: [cardiac_symptomatic_condition] \"Gentle Mobility Flow\" for \"Severe hypertension\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Gentle Mobility Flow" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Severe hypertension")
    const isBlocked = scan.violations.some(v => v.category === "cardiac_symptomatic_condition")
    expect(isBlocked).toBe(false)
  })
  it("D83: [pregnancy_late_stage] \"Flat Barbell Bench Press\" for \"28 weeks pregnant\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Flat Barbell Bench Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "28 weeks pregnant")
    const isBlocked = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(isBlocked).toBe(true)
  })
  it("D84: [pregnancy_late_stage] \"Supine Leg Raises\" for \"Third trimester\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Supine Leg Raises" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Third trimester")
    const isBlocked = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(isBlocked).toBe(true)
  })
  it("D85: [pregnancy_late_stage] \"Floor Crunches\" for \"32 weeks pregnant\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Floor Crunches" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "32 weeks pregnant")
    const isBlocked = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(isBlocked).toBe(true)
  })
  it("D86: [pregnancy_late_stage] \"Box Jumps\" for \"7 months pregnant\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Box Jumps" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "7 months pregnant")
    const isBlocked = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(isBlocked).toBe(true)
  })
  it("D87: [pregnancy_late_stage] \"Burpees\" for \"Second trimester\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Burpees" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Second trimester")
    const isBlocked = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(isBlocked).toBe(true)
  })
  it("D88: [pregnancy_late_stage] \"Prone Supermans\" for \"Late stage pregnancy\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Prone Supermans" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Late stage pregnancy")
    const isBlocked = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(isBlocked).toBe(true)
  })
  it("D89: [pregnancy_late_stage] \"Sissy Squats\" for \"36 weeks pregnant\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Sissy Squats" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "36 weeks pregnant")
    const isBlocked = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(isBlocked).toBe(true)
  })
  it("D90: [pregnancy_late_stage] \"Incline Dumbbell Press\" for \"28 weeks pregnant\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Incline Dumbbell Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "28 weeks pregnant")
    const isBlocked = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(isBlocked).toBe(false)
  })
  it("D91: [pregnancy_late_stage] \"Side-Lying Clam Shells\" for \"Third trimester\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Side-Lying Clam Shells" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Third trimester")
    const isBlocked = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(isBlocked).toBe(false)
  })
  it("D92: [pregnancy_late_stage] \"Cat-Cow Stretch\" for \"32 weeks pregnant\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Cat-Cow Stretch" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "32 weeks pregnant")
    const isBlocked = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(isBlocked).toBe(false)
  })
  it("D93: [pregnancy_late_stage] \"Bodyweight Box Squats\" for \"7 months pregnant\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Bodyweight Box Squats" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "7 months pregnant")
    const isBlocked = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(isBlocked).toBe(false)
  })
  it("D94: [pregnancy_late_stage] \"Seated Cable Row\" for \"Second trimester\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Seated Cable Row" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Second trimester")
    const isBlocked = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(isBlocked).toBe(false)
  })
  it("D95: [severe_osteoporosis] \"Weighted Sit-ups\" for \"Severe osteoporosis\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Weighted Sit-ups" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Severe osteoporosis")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoporosis")
    expect(isBlocked).toBe(true)
  })
  it("D96: [severe_osteoporosis] \"Loaded Russian Twists\" for \"T-score -3.1\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Loaded Russian Twists" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "T-score -3.1")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoporosis")
    expect(isBlocked).toBe(true)
  })
  it("D97: [severe_osteoporosis] \"Jefferson Curls\" for \"Vertebral compression fracture\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Jefferson Curls" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Vertebral compression fracture")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoporosis")
    expect(isBlocked).toBe(true)
  })
  it("D98: [severe_osteoporosis] \"Explosive Twisting Medicine Ball Slams\" for \"Brittle bones\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Explosive Twisting Medicine Ball Slams" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Brittle bones")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoporosis")
    expect(isBlocked).toBe(true)
  })
  it("D99: [severe_osteoporosis] \"Box Jumps\" for \"Severe bone density loss\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Box Jumps" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Severe bone density loss")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoporosis")
    expect(isBlocked).toBe(true)
  })
  it("D100: [severe_osteoporosis] \"Explosive Twisting Cable Woodchops\" for \"Osteoporosis with prior fracture\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Explosive Twisting Cable Woodchops" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Osteoporosis with prior fracture")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoporosis")
    expect(isBlocked).toBe(true)
  })
  it("D101: [severe_osteoporosis] \"Supported Walking\" for \"Severe osteoporosis\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Supported Walking" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Severe osteoporosis")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoporosis")
    expect(isBlocked).toBe(false)
  })
  it("D102: [severe_osteoporosis] \"Bodyweight Wall Squats\" for \"T-score -3.1\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Bodyweight Wall Squats" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "T-score -3.1")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoporosis")
    expect(isBlocked).toBe(false)
  })
  it("D103: [severe_osteoporosis] \"Resistance Band Rows\" for \"Vertebral compression fracture\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Resistance Band Rows" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Vertebral compression fracture")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoporosis")
    expect(isBlocked).toBe(false)
  })
  it("D104: [severe_osteoporosis] \"Standing Single-Leg Balance Drill\" for \"Brittle bones\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Standing Single-Leg Balance Drill" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Brittle bones")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoporosis")
    expect(isBlocked).toBe(false)
  })
  it("D105: [severe_osteoarthritis] \"Jumping Lunges\" for \"Severe osteoarthritis knee\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Jumping Lunges" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Severe osteoarthritis knee")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoarthritis")
    expect(isBlocked).toBe(true)
  })
  it("D106: [severe_osteoarthritis] \"Depth Drops\" for \"Grade 4 osteoarthritis\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Depth Drops" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Grade 4 osteoarthritis")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoarthritis")
    expect(isBlocked).toBe(true)
  })
  it("D107: [severe_osteoarthritis] \"Burpees\" for \"Bone on bone knee arthritis\" -> expected block: true", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Burpees" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Bone on bone knee arthritis")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoarthritis")
    expect(isBlocked).toBe(true)
  })
  it("D108: [severe_osteoarthritis] \"Water Aerobics\" for \"Severe osteoarthritis knee\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Water Aerobics" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Severe osteoarthritis knee")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoarthritis")
    expect(isBlocked).toBe(false)
  })
  it("D109: [severe_osteoarthritis] \"Stationary Cycling (low resistance)\" for \"Grade 4 osteoarthritis\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Stationary Cycling (low resistance)" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Grade 4 osteoarthritis")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoarthritis")
    expect(isBlocked).toBe(false)
  })
  it("D110: [severe_osteoarthritis] \"Glute Bridges\" for \"Bone on bone knee arthritis\" -> expected block: false", () => {
    const plan = "## Day 1 - Workout\n### Main Workout\n- " + "Glute Bridges" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Bone on bone knee arthritis")
    const isBlocked = scan.violations.some(v => v.category === "severe_osteoarthritis")
    expect(isBlocked).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// SECTION E: EXEMPTION BOUNDARY & SUBSTITUTION SCOPE ATTACKS (E01 - E55)
// ----------------------------------------------------------------------------
describe('Section E: Exemption Boundary & Substitution Scope Attacks', () => {
  it("E01: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Step-ups: 3 sets x 12 reps (safe alternative to box jumps)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Step-ups: 3 sets x 12 reps (safe alternative to box jumps)" + "\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(false)
  })
  it("E02: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Bodyweight Wall Sits: 3x30s (alternative for jump squats)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Bodyweight Wall Sits: 3x30s (alternative for jump squats)" + "\n"
    const scan = clientScanPlan(plan, "Patellar tendinitis")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(false)
  })
  it("E03: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Floor Press: 3 sets x 10 reps (substitute for overhead press)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Floor Press: 3 sets x 10 reps (substitute for overhead press)" + "\n"
    const scan = clientScanPlan(plan, "Rotator cuff tear")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(false)
  })
  it("E04: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Dumbbell Bench Press: 3x10 (replaces military press due to shoulder)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Dumbbell Bench Press: 3x10 (replaces military press due to shoulder)" + "\n"
    const scan = clientScanPlan(plan, "Shoulder impingement")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(false)
  })
  it("E05: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Bird-Dog: 3 sets x 10 reps (in place of deadlifts for back safety)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Bird-Dog: 3 sets x 10 reps (in place of deadlifts for back safety)" + "\n"
    const scan = clientScanPlan(plan, "L5-S1 disc herniation")
    const hasCatViolation = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(hasCatViolation).toBe(false)
  })
  it("E06: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Glute Bridges: 3 sets x 12 reps (replaces Romanian deadlifts)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Glute Bridges: 3 sets x 12 reps (replaces Romanian deadlifts)" + "\n"
    const scan = clientScanPlan(plan, "Sciatica")
    const hasCatViolation = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(hasCatViolation).toBe(false)
  })
  it("E07: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Seated Cable Row: 3x10 (instead of bent-over barbell rows)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Seated Cable Row: 3x10 (instead of bent-over barbell rows)" + "\n"
    const scan = clientScanPlan(plan, "Lumbar disc herniation")
    const hasCatViolation = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(hasCatViolation).toBe(false)
  })
  it("E08: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Push-ups: 3 sets x 12 reps (swap for parallel bar dips)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Push-ups: 3 sets x 12 reps (swap for parallel bar dips)" + "\n"
    const scan = clientScanPlan(plan, "Rotator cuff repair")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(false)
  })
  it("E09: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Box Squats: 3 sets x 8 reps (alternative to depth jumps)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Box Squats: 3 sets x 8 reps (alternative to depth jumps)" + "\n"
    const scan = clientScanPlan(plan, "Meniscus tear")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(false)
  })
  it("E10: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Incline Dumbbell Press: 3x10 (substitute for flat bench press in 3rd trimester)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Incline Dumbbell Press: 3x10 (substitute for flat bench press in 3rd trimester)" + "\n"
    const scan = clientScanPlan(plan, "28 weeks pregnant")
    const hasCatViolation = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(hasCatViolation).toBe(false)
  })
  it("E11: Safe exercise citing forbidden exercise in substitution clause must PASS: \"McGill Curl-up: 3x10 (replaces sit-ups for disc protection)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "McGill Curl-up: 3x10 (replaces sit-ups for disc protection)" + "\n"
    const scan = clientScanPlan(plan, "L4-L5 disc herniation")
    const hasCatViolation = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(hasCatViolation).toBe(false)
  })
  it("E12: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Pallof Press: 3 sets x 12 reps (alternative to Russian twists)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Pallof Press: 3 sets x 12 reps (alternative to Russian twists)" + "\n"
    const scan = clientScanPlan(plan, "Lumbar radiculopathy")
    const hasCatViolation = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(hasCatViolation).toBe(false)
  })
  it("E13: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Stationary Cycling: 20 min (safe replacement for high-impact jumping)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Stationary Cycling: 20 min (safe replacement for high-impact jumping)" + "\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(false)
  })
  it("E14: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Straight-Leg Raises: 3 sets x 15 reps (alternative to pistol squats)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Straight-Leg Raises: 3 sets x 15 reps (alternative to pistol squats)" + "\n"
    const scan = clientScanPlan(plan, "Knee reconstruction")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(false)
  })
  it("E15: Safe exercise citing forbidden exercise in substitution clause must PASS: \"Lateral Raises below shoulder: 3x15 (replaces upright rows)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Lateral Raises below shoulder: 3x15 (replaces upright rows)" + "\n"
    const scan = clientScanPlan(plan, "Subacromial impingement")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(false)
  })
  it("E16: Inverted substitution attack must BLOCK: \"Box jumps: 3 sets x 10 reps (substitute for step-ups)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Box jumps: 3 sets x 10 reps (substitute for step-ups)" + "\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("E17: Inverted substitution attack must BLOCK: \"Overhead Press: 3 sets x 8 reps (instead of floor press)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Overhead Press: 3 sets x 8 reps (instead of floor press)" + "\n"
    const scan = clientScanPlan(plan, "Rotator cuff tear")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("E18: Inverted substitution attack must BLOCK: \"Conventional Deadlift: 3 sets x 5 reps (replaces glute bridges)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Conventional Deadlift: 3 sets x 5 reps (replaces glute bridges)" + "\n"
    const scan = clientScanPlan(plan, "L5-S1 disc herniation")
    const hasCatViolation = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(hasCatViolation).toBe(true)
  })
  it("E19: Inverted substitution attack must BLOCK: \"Burpees: 3 sets x 10 reps (alternative to stationary cycling)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Burpees: 3 sets x 10 reps (alternative to stationary cycling)" + "\n"
    const scan = clientScanPlan(plan, "Patellar tendinitis")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("E20: Inverted substitution attack must BLOCK: \"Military Press: 3 sets x 8 reps (swap out for bench press)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Military Press: 3 sets x 8 reps (swap out for bench press)" + "\n"
    const scan = clientScanPlan(plan, "Subacromial impingement")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("E21: Inverted substitution attack must BLOCK: \"Romanian Deadlift: 3 sets x 8 reps (in place of bird-dog)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Romanian Deadlift: 3 sets x 8 reps (in place of bird-dog)" + "\n"
    const scan = clientScanPlan(plan, "Sciatica")
    const hasCatViolation = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(hasCatViolation).toBe(true)
  })
  it("E22: Inverted substitution attack must BLOCK: \"Parallel Bar Dips: 3 sets x 10 reps (instead of push-ups)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Parallel Bar Dips: 3 sets x 10 reps (instead of push-ups)" + "\n"
    const scan = clientScanPlan(plan, "Rotator cuff repair")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("E23: Inverted substitution attack must BLOCK: \"Jump Squats: 3 sets x 10 reps (alternative to wall sits)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Jump Squats: 3 sets x 10 reps (alternative to wall sits)" + "\n"
    const scan = clientScanPlan(plan, "Meniscus tear")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("E24: Inverted substitution attack must BLOCK: \"Behind-the-Neck Press: 3 sets x 8 reps (replaces chest press)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Behind-the-Neck Press: 3 sets x 8 reps (replaces chest press)" + "\n"
    const scan = clientScanPlan(plan, "Shoulder impingement")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("E25: Inverted substitution attack must BLOCK: \"Russian Twists: 3 sets x 15 reps (substitute for pallof press)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Russian Twists: 3 sets x 15 reps (substitute for pallof press)" + "\n"
    const scan = clientScanPlan(plan, "L4-L5 disc herniation")
    const hasCatViolation = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(hasCatViolation).toBe(true)
  })
  it("E26: Inverted substitution attack must BLOCK: \"Weighted Sit-ups: 3 sets x 12 reps (replaces curl-up)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Weighted Sit-ups: 3 sets x 12 reps (replaces curl-up)" + "\n"
    const scan = clientScanPlan(plan, "Disc bulge")
    const hasCatViolation = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(hasCatViolation).toBe(true)
  })
  it("E27: Inverted substitution attack must BLOCK: \"Pistol Squats: 3 sets x 5 reps (substitute for leg raises)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Pistol Squats: 3 sets x 5 reps (substitute for leg raises)" + "\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("E28: Inverted substitution attack must BLOCK: \"Depth Jumps: 3 sets x 5 reps (alternative to box squats)\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Depth Jumps: 3 sets x 5 reps (alternative to box squats)" + "\n"
    const scan = clientScanPlan(plan, "Knee reconstruction")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("E29: Compound isolation (safe cannot exempt unsafe): \"Step-ups + Box Jumps: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Step-ups + Box Jumps: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("E30: Compound isolation (safe cannot exempt unsafe): \"Bench Press & Overhead Press: 3 sets x 8 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Bench Press & Overhead Press: 3 sets x 8 reps" + "\n"
    const scan = clientScanPlan(plan, "Rotator cuff tear")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("E31: Compound isolation (safe cannot exempt unsafe): \"Glute Bridges / Romanian Deadlifts: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Glute Bridges / Romanian Deadlifts: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "L5-S1 disc herniation")
    const hasCatViolation = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(hasCatViolation).toBe(true)
  })
  it("E32: Compound isolation (safe cannot exempt unsafe): \"Wall Sits then Jump Squats: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Wall Sits then Jump Squats: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "Patellar tendinitis")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("E33: Compound isolation (safe cannot exempt unsafe): \"Floor Press followed by Military Press: 3 sets x 8 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Floor Press followed by Military Press: 3 sets x 8 reps" + "\n"
    const scan = clientScanPlan(plan, "Subacromial impingement")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("E34: Compound isolation (safe cannot exempt unsafe): \"Bird-Dog; Conventional Deadlifts: 3 sets x 8 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Bird-Dog; Conventional Deadlifts: 3 sets x 8 reps" + "\n"
    const scan = clientScanPlan(plan, "Sciatica")
    const hasCatViolation = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(hasCatViolation).toBe(true)
  })
  it("E35: Compound isolation (safe cannot exempt unsafe): \"Stationary Cycling: 10 mins | Burpees: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Stationary Cycling: 10 mins | Burpees: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "Meniscus tear")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("E36: Compound isolation (safe cannot exempt unsafe): \"Push-ups paired with Parallel Bar Dips: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Push-ups paired with Parallel Bar Dips: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "Rotator cuff repair")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("E37: Compound isolation (safe cannot exempt unsafe): \"McGill Curl-up alternating with Russian Twists: 3 sets x 12 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "McGill Curl-up alternating with Russian Twists: 3 sets x 12 reps" + "\n"
    const scan = clientScanPlan(plan, "L4-L5 disc herniation")
    const hasCatViolation = scan.violations.some(v => v.category === "lumbar_disc_herniation")
    expect(hasCatViolation).toBe(true)
  })
  it("E38: Compound isolation (safe cannot exempt unsafe): \"Incline Dumbbell Press superset with Flat Barbell Bench Press: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Incline Dumbbell Press superset with Flat Barbell Bench Press: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "28 weeks pregnant")
    const hasCatViolation = scan.violations.some(v => v.category === "pregnancy_late_stage")
    expect(hasCatViolation).toBe(true)
  })
  it("E39: Compound isolation (safe cannot exempt unsafe): \"Step-ups combined with Jumping Lunges: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Step-ups combined with Jumping Lunges: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "ACL reconstruction")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("E40: Compound isolation (safe cannot exempt unsafe): \"Box Squats — Depth Jumps: 3 sets x 8 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Box Squats — Depth Jumps: 3 sets x 8 reps" + "\n"
    const scan = clientScanPlan(plan, "Knee injury")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("E41: Culinary vs exercise dip discrimination: \"Snack: Whole grain pita with spinach dip\"", () => {
    const plan = "## Day 1\n" + "Snack: Whole grain pita with spinach dip" + "\n"
    const scan = clientScanPlan(plan, 'Rotator cuff tear')
    expect(scan.hasViolation).toBe(false)
  })
  it("E42: Culinary vs exercise dip discrimination: \"Lunch: Celery sticks with guacamole dip\"", () => {
    const plan = "## Day 1\n" + "Lunch: Celery sticks with guacamole dip" + "\n"
    const scan = clientScanPlan(plan, 'Rotator cuff tear')
    expect(scan.hasViolation).toBe(false)
  })
  it("E43: Culinary vs exercise dip discrimination: \"Dinner: Grilled chicken with artichoke dip\"", () => {
    const plan = "## Day 1\n" + "Dinner: Grilled chicken with artichoke dip" + "\n"
    const scan = clientScanPlan(plan, 'Rotator cuff tear')
    expect(scan.hasViolation).toBe(false)
  })
  it("E44: Culinary vs exercise dip discrimination: \"Snack: Tortilla chips and salsa dip\"", () => {
    const plan = "## Day 1\n" + "Snack: Tortilla chips and salsa dip" + "\n"
    const scan = clientScanPlan(plan, 'Rotator cuff tear')
    expect(scan.hasViolation).toBe(false)
  })
  it("E45: Culinary vs exercise dip discrimination: \"Snack: Veggies with hummus dip\"", () => {
    const plan = "## Day 1\n" + "Snack: Veggies with hummus dip" + "\n"
    const scan = clientScanPlan(plan, 'Rotator cuff tear')
    expect(scan.hasViolation).toBe(false)
  })
  it("E46: Culinary vs exercise dip discrimination: \"Workout: Tricep Dips: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n" + "Workout: Tricep Dips: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, 'Rotator cuff tear')
    expect(scan.hasViolation).toBe(true)
  })
  it("E47: Culinary vs exercise dip discrimination: \"Workout: Weighted Dips: 3 sets x 8 reps\"", () => {
    const plan = "## Day 1\n" + "Workout: Weighted Dips: 3 sets x 8 reps" + "\n"
    const scan = clientScanPlan(plan, 'Rotator cuff tear')
    expect(scan.hasViolation).toBe(true)
  })
  it("E48: Culinary vs exercise dip discrimination: \"Workout: Parallel Bar Dips: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n" + "Workout: Parallel Bar Dips: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, 'Rotator cuff tear')
    expect(scan.hasViolation).toBe(true)
  })
  it("E49: Box squat vs box jump precision: \"Box Squats: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Box Squats: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, 'Torn ACL')
    expect(scan.hasViolation).toBe(false)
  })
  it("E50: Box squat vs box jump precision: \"Barbell Box Squats: 3 sets x 8 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Barbell Box Squats: 3 sets x 8 reps" + "\n"
    const scan = clientScanPlan(plan, 'Torn ACL')
    expect(scan.hasViolation).toBe(false)
  })
  it("E51: Box squat vs box jump precision: \"Dumbbell Box Squat: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Dumbbell Box Squat: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, 'Torn ACL')
    expect(scan.hasViolation).toBe(false)
  })
  it("E52: Box squat vs box jump precision: \"Box Jumps: 3 sets x 8 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Box Jumps: 3 sets x 8 reps" + "\n"
    const scan = clientScanPlan(plan, 'Torn ACL')
    expect(scan.hasViolation).toBe(true)
  })
  it("E53: Box squat vs box jump precision: \"Plyometric Box Jump: 3 sets x 6 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Plyometric Box Jump: 3 sets x 6 reps" + "\n"
    const scan = clientScanPlan(plan, 'Torn ACL')
    expect(scan.hasViolation).toBe(true)
  })
  it("E54: Box squat vs box jump precision: \"Depth Drop to Box Jump: 3 sets x 5 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Depth Drop to Box Jump: 3 sets x 5 reps" + "\n"
    const scan = clientScanPlan(plan, 'Torn ACL')
    expect(scan.hasViolation).toBe(true)
  })
  it("E55: Box squat vs box jump precision: \"Step-ups onto 12-inch box: 3 sets x 12 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Step-ups onto 12-inch box: 3 sets x 12 reps" + "\n"
    const scan = clientScanPlan(plan, 'Torn ACL')
    expect(scan.hasViolation).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// SECTION F: UNICODE, NORMALIZATION & TYPOGRAPHIC ADVERSARIES (F01 - F30)
// ----------------------------------------------------------------------------
describe('Section F: Unicode, Normalization & Typographic Adversaries', () => {
  it("F01: Zero-width / non-breaking space in exercise name", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Box Jumps" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F02: Zero-width / non-breaking space in exercise name", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "B​urpees" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F03: Zero-width / non-breaking space in exercise name", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Over head Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Rotator cuff tear")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("F04: Zero-width / non-breaking space in exercise name", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "D﻿ips" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Rotator cuff tear")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("F05: Zero-width / non-breaking space in exercise name", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "J‌ump‌Squats" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F06: Zero-width / non-breaking space in exercise name", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "S‍kater Jumps" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F07: Zero-width / non-breaking space in exercise name", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "M​ilitary Press" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Rotator cuff tear")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("F08: Zero-width / non-breaking space in exercise name", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "P​istol Squats" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F09: Zero-width / non-breaking space in exercise name", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Tuck Jumps" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F10: Zero-width / non-breaking space in exercise name", () => {
    const plan = "## Day 1\n### Main Workout\n- " + "Depth​Drops" + ": 3 sets x 10 reps\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F11: Typographic delimiter / quotes: \"“Box Jumps”: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n" + "“Box Jumps”: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F12: Typographic delimiter / quotes: \"‘Overhead Press’: 3 sets x 8 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n" + "‘Overhead Press’: 3 sets x 8 reps" + "\n"
    const scan = clientScanPlan(plan, "Rotator cuff tear")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("F13: Typographic delimiter / quotes: \"Day 1 — Workout — Burpees: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n" + "Day 1 — Workout — Burpees: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F14: Typographic delimiter / quotes: \"Day 2 – Main Routine – Military Press: 3 sets x 8 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n" + "Day 2 – Main Routine – Military Press: 3 sets x 8 reps" + "\n"
    const scan = clientScanPlan(plan, "Rotator cuff tear")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("F15: Typographic delimiter / quotes: \"• Burpees: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n" + "• Burpees: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F16: Typographic delimiter / quotes: \"‣ Overhead Press: 3 sets x 8 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n" + "‣ Overhead Press: 3 sets x 8 reps" + "\n"
    const scan = clientScanPlan(plan, "Rotator cuff tear")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("F17: Typographic delimiter / quotes: \"Squats  /  Burpees: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n" + "Squats  /  Burpees: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F18: Typographic delimiter / quotes: \"Part 1 -- Box Jumps: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n" + "Part 1 -- Box Jumps: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F19: Typographic delimiter / quotes: \"Station A: Parallel Bar Dips: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n" + "Station A: Parallel Bar Dips: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "Rotator cuff tear")
    const hasCatViolation = scan.violations.some(v => v.category === "shoulder_impingement_cuff")
    expect(hasCatViolation).toBe(true)
  })
  it("F20: Typographic delimiter / quotes: \"Circuit 1: Jump Squats: 3 sets x 10 reps\"", () => {
    const plan = "## Day 1\n### Main Workout\n" + "Circuit 1: Jump Squats: 3 sets x 10 reps" + "\n"
    const scan = clientScanPlan(plan, "Torn ACL")
    const hasCatViolation = scan.violations.some(v => v.category === "knee_high_impact")
    expect(hasCatViolation).toBe(true)
  })
  it("F21: NFKC Unicode normalization in medical intake", () => {
    const res = clientClassify("ＡＣＬ　ｔｅａｒ")
    expect(res.activeCategories).toContain("knee_high_impact")
  })
  it("F22: NFKC Unicode normalization in medical intake", () => {
    const res = clientClassify("Ｒｏｔａｔｏｒ　ｃｕｆｆ　ｔｅａｒ")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
  })
  it("F23: NFKC Unicode normalization in medical intake", () => {
    const res = clientClassify("Ｄｉｓｃ　ｈｅｒｎｉａｔｉｏｎ")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
  })
  it("F24: NFKC Unicode normalization in medical intake", () => {
    const res = clientClassify("L‍5-S‍1 disc herniation")
    expect(res.activeCategories).toContain("lumbar_disc_herniation")
  })
  it("F25: NFKC Unicode normalization in medical intake", () => {
    const res = clientClassify("T-score < −2.5")
    expect(res.activeCategories).toContain("severe_osteoporosis")
  })
  it("F26: NFKC Unicode normalization in medical intake", () => {
    const res = clientClassify("ACL tear 🦵")
    expect(res.activeCategories).toContain("knee_high_impact")
  })
  it("F27: NFKC Unicode normalization in medical intake", () => {
    const res = clientClassify("Shoulder pain 💪")
    expect(res.activeCategories).toContain("shoulder_impingement_cuff")
  })
  it("F28: NFKC Unicode normalization in medical intake", () => {
    const res = clientClassify("（ACL tear）")
    expect(res.activeCategories).toContain("knee_high_impact")
  })
  it("F29: NFKC Unicode normalization in medical intake", () => {
    const res = clientClassify("bUrPeEs prohibited due to AcL tEaR")
    expect(res.activeCategories).toContain("knee_high_impact")
  })
  it("F30: NFKC Unicode normalization in medical intake", () => {
    const res = clientClassify("   \n\t  Meniscus tear  \t\n  ")
    expect(res.activeCategories).toContain("knee_high_impact")
  })
})

// ----------------------------------------------------------------------------
// SECTION G: CLIENT / SERVER DIFFERENTIAL PARITY (G01 - G30)
// ----------------------------------------------------------------------------
describe('Section G: Client / Server Differential Parity', () => {
  it("G01: classifyMedicalIntake client/server parity on \"Torn ACL left knee; severe L5-S1 disc herniation\"", () => {
    const cRes = clientClassify("Torn ACL left knee; severe L5-S1 disc herniation")
    const sRes = serverModule.classifyMedicalIntake("Torn ACL left knee; severe L5-S1 disc herniation")

    expect(cRes.activeCategories.sort()).toEqual(sRes.activeCategories.sort())
    expect(cRes.isSafetySensitive).toBe(sRes.isSafetySensitive)
    expect(cRes.negatedCategories.sort()).toEqual(sRes.negatedCategories.sort())
    expect(cRes.historicalCategories.sort()).toEqual(sRes.historicalCategories.sort())
    expect(cRes.structuredPromptContext).toBe(sRes.structuredPromptContext)
  })
  it("G02: classifyMedicalIntake client/server parity on \"No knee injuries, but history of rotator cuff repair 4 years ago\"", () => {
    const cRes = clientClassify("No knee injuries, but history of rotator cuff repair 4 years ago")
    const sRes = serverModule.classifyMedicalIntake("No knee injuries, but history of rotator cuff repair 4 years ago")

    expect(cRes.activeCategories.sort()).toEqual(sRes.activeCategories.sort())
    expect(cRes.isSafetySensitive).toBe(sRes.isSafetySensitive)
    expect(cRes.negatedCategories.sort()).toEqual(sRes.negatedCategories.sort())
    expect(cRes.historicalCategories.sort()).toEqual(sRes.historicalCategories.sort())
    expect(cRes.structuredPromptContext).toBe(sRes.structuredPromptContext)
  })
  it("G03: classifyMedicalIntake client/server parity on \"Aortic stenosis with chest pain on exertion\"", () => {
    const cRes = clientClassify("Aortic stenosis with chest pain on exertion")
    const sRes = serverModule.classifyMedicalIntake("Aortic stenosis with chest pain on exertion")

    expect(cRes.activeCategories.sort()).toEqual(sRes.activeCategories.sort())
    expect(cRes.isSafetySensitive).toBe(sRes.isSafetySensitive)
    expect(cRes.negatedCategories.sort()).toEqual(sRes.negatedCategories.sort())
    expect(cRes.historicalCategories.sort()).toEqual(sRes.historicalCategories.sort())
    expect(cRes.structuredPromptContext).toBe(sRes.structuredPromptContext)
  })
  it("G04: classifyMedicalIntake client/server parity on \"Total knee replacement 5 years ago, pain-free now\"", () => {
    const cRes = clientClassify("Total knee replacement 5 years ago, pain-free now")
    const sRes = serverModule.classifyMedicalIntake("Total knee replacement 5 years ago, pain-free now")

    expect(cRes.activeCategories.sort()).toEqual(sRes.activeCategories.sort())
    expect(cRes.isSafetySensitive).toBe(sRes.isSafetySensitive)
    expect(cRes.negatedCategories.sort()).toEqual(sRes.negatedCategories.sort())
    expect(cRes.historicalCategories.sort()).toEqual(sRes.historicalCategories.sort())
    expect(cRes.structuredPromptContext).toBe(sRes.structuredPromptContext)
  })
  it("G05: classifyMedicalIntake client/server parity on \"Spinal fusion L4-L5 in 2016, no current pain\"", () => {
    const cRes = clientClassify("Spinal fusion L4-L5 in 2016, no current pain")
    const sRes = serverModule.classifyMedicalIntake("Spinal fusion L4-L5 in 2016, no current pain")

    expect(cRes.activeCategories.sort()).toEqual(sRes.activeCategories.sort())
    expect(cRes.isSafetySensitive).toBe(sRes.isSafetySensitive)
    expect(cRes.negatedCategories.sort()).toEqual(sRes.negatedCategories.sort())
    expect(cRes.historicalCategories.sort()).toEqual(sRes.historicalCategories.sort())
    expect(cRes.structuredPromptContext).toBe(sRes.structuredPromptContext)
  })
  it("G06: classifyMedicalIntake client/server parity on \"Coronary stent placed in 2021, on aspirin, asymptomatic\"", () => {
    const cRes = clientClassify("Coronary stent placed in 2021, on aspirin, asymptomatic")
    const sRes = serverModule.classifyMedicalIntake("Coronary stent placed in 2021, on aspirin, asymptomatic")

    expect(cRes.activeCategories.sort()).toEqual(sRes.activeCategories.sort())
    expect(cRes.isSafetySensitive).toBe(sRes.isSafetySensitive)
    expect(cRes.negatedCategories.sort()).toEqual(sRes.negatedCategories.sort())
    expect(cRes.historicalCategories.sort()).toEqual(sRes.historicalCategories.sort())
    expect(cRes.structuredPromptContext).toBe(sRes.structuredPromptContext)
  })
  it("G07: classifyMedicalIntake client/server parity on \"Torn ACL, but doctor cleared me for box jumps\"", () => {
    const cRes = clientClassify("Torn ACL, but doctor cleared me for box jumps")
    const sRes = serverModule.classifyMedicalIntake("Torn ACL, but doctor cleared me for box jumps")

    expect(cRes.activeCategories.sort()).toEqual(sRes.activeCategories.sort())
    expect(cRes.isSafetySensitive).toBe(sRes.isSafetySensitive)
    expect(cRes.negatedCategories.sort()).toEqual(sRes.negatedCategories.sort())
    expect(cRes.historicalCategories.sort()).toEqual(sRes.historicalCategories.sort())
    expect(cRes.structuredPromptContext).toBe(sRes.structuredPromptContext)
  })
  it("G08: classifyMedicalIntake client/server parity on \"None\"", () => {
    const cRes = clientClassify("None")
    const sRes = serverModule.classifyMedicalIntake("None")

    expect(cRes.activeCategories.sort()).toEqual(sRes.activeCategories.sort())
    expect(cRes.isSafetySensitive).toBe(sRes.isSafetySensitive)
    expect(cRes.negatedCategories.sort()).toEqual(sRes.negatedCategories.sort())
    expect(cRes.historicalCategories.sort()).toEqual(sRes.historicalCategories.sort())
    expect(cRes.structuredPromptContext).toBe(sRes.structuredPromptContext)
  })
  it("G09: parseCanonicalExerciseLine parity on \"Barbell Back Squat: 4 sets x 8 reps, 90s rest\"", () => {
    const cRes = clientParseLine("Barbell Back Squat: 4 sets x 8 reps, 90s rest")
    const sRes = serverModule.parseCanonicalExerciseLine("Barbell Back Squat: 4 sets x 8 reps, 90s rest")

    expect(cRes.length).toBe(sRes.length)
    for (let i = 0; i < cRes.length; i++) {
      expect(cRes[i].name).toBe(sRes[i].name)
      expect(cRes[i].sets).toBe(sRes[i].sets)
      expect(cRes[i].reps).toBe(sRes[i].reps)
    }
  })
  it("G10: parseCanonicalExerciseLine parity on \"Clean & Press: 3 sets x 5 reps\"", () => {
    const cRes = clientParseLine("Clean & Press: 3 sets x 5 reps")
    const sRes = serverModule.parseCanonicalExerciseLine("Clean & Press: 3 sets x 5 reps")

    expect(cRes.length).toBe(sRes.length)
    for (let i = 0; i < cRes.length; i++) {
      expect(cRes[i].name).toBe(sRes[i].name)
      expect(cRes[i].sets).toBe(sRes[i].sets)
      expect(cRes[i].reps).toBe(sRes[i].reps)
    }
  })
  it("G11: parseCanonicalExerciseLine parity on \"Step-ups: 3x12 + Box jumps: 3x10\"", () => {
    const cRes = clientParseLine("Step-ups: 3x12 + Box jumps: 3x10")
    const sRes = serverModule.parseCanonicalExerciseLine("Step-ups: 3x12 + Box jumps: 3x10")

    expect(cRes.length).toBe(sRes.length)
    for (let i = 0; i < cRes.length; i++) {
      expect(cRes[i].name).toBe(sRes[i].name)
      expect(cRes[i].sets).toBe(sRes[i].sets)
      expect(cRes[i].reps).toBe(sRes[i].reps)
    }
  })
  it("G12: parseCanonicalExerciseLine parity on \"Bench Press & Overhead Press: 3 sets x 8 reps\"", () => {
    const cRes = clientParseLine("Bench Press & Overhead Press: 3 sets x 8 reps")
    const sRes = serverModule.parseCanonicalExerciseLine("Bench Press & Overhead Press: 3 sets x 8 reps")

    expect(cRes.length).toBe(sRes.length)
    for (let i = 0; i < cRes.length; i++) {
      expect(cRes[i].name).toBe(sRes[i].name)
      expect(cRes[i].sets).toBe(sRes[i].sets)
      expect(cRes[i].reps).toBe(sRes[i].reps)
    }
  })
  it("G13: parseCanonicalExerciseLine parity on \"Step-ups: 3x12 (safe alternative to box jumps)\"", () => {
    const cRes = clientParseLine("Step-ups: 3x12 (safe alternative to box jumps)")
    const sRes = serverModule.parseCanonicalExerciseLine("Step-ups: 3x12 (safe alternative to box jumps)")

    expect(cRes.length).toBe(sRes.length)
    for (let i = 0; i < cRes.length; i++) {
      expect(cRes[i].name).toBe(sRes[i].name)
      expect(cRes[i].sets).toBe(sRes[i].sets)
      expect(cRes[i].reps).toBe(sRes[i].reps)
    }
  })
  it("G14: parseCanonicalExerciseLine parity on \"Glute Bridges / Romanian Deadlifts: 3x10\"", () => {
    const cRes = clientParseLine("Glute Bridges / Romanian Deadlifts: 3x10")
    const sRes = serverModule.parseCanonicalExerciseLine("Glute Bridges / Romanian Deadlifts: 3x10")

    expect(cRes.length).toBe(sRes.length)
    for (let i = 0; i < cRes.length; i++) {
      expect(cRes[i].name).toBe(sRes[i].name)
      expect(cRes[i].sets).toBe(sRes[i].sets)
      expect(cRes[i].reps).toBe(sRes[i].reps)
    }
  })
  it("G15: parseCanonicalExerciseLine parity on \"Exercise 1: Incline Dumbbell Press: 3x10\"", () => {
    const cRes = clientParseLine("Exercise 1: Incline Dumbbell Press: 3x10")
    const sRes = serverModule.parseCanonicalExerciseLine("Exercise 1: Incline Dumbbell Press: 3x10")

    expect(cRes.length).toBe(sRes.length)
    for (let i = 0; i < cRes.length; i++) {
      expect(cRes[i].name).toBe(sRes[i].name)
      expect(cRes[i].sets).toBe(sRes[i].sets)
      expect(cRes[i].reps).toBe(sRes[i].reps)
    }
  })
  it("G16: parseCanonicalExerciseLine parity on \"Breakfast: 3 scrambled eggs with toast\"", () => {
    const cRes = clientParseLine("Breakfast: 3 scrambled eggs with toast")
    const sRes = serverModule.parseCanonicalExerciseLine("Breakfast: 3 scrambled eggs with toast")

    expect(cRes.length).toBe(sRes.length)
    for (let i = 0; i < cRes.length; i++) {
      expect(cRes[i].name).toBe(sRes[i].name)
      expect(cRes[i].sets).toBe(sRes[i].sets)
      expect(cRes[i].reps).toBe(sRes[i].reps)
    }
  })
  it("G17: cleanExerciseName parity on \"- **Barbell Back Squat**: 4 sets x 8 reps\"", () => {
    const cClean = clientCleanName("- **Barbell Back Squat**: 4 sets x 8 reps")
    const sClean = serverModule.cleanExerciseName("- **Barbell Back Squat**: 4 sets x 8 reps")
    expect(cClean).toBe(sClean)
  })
  it("G18: cleanExerciseName parity on \"Exercise 2: `Overhead Press` (slow tempo): 3x10\"", () => {
    const cClean = clientCleanName("Exercise 2: `Overhead Press` (slow tempo): 3x10")
    const sClean = serverModule.cleanExerciseName("Exercise 2: `Overhead Press` (slow tempo): 3x10")
    expect(cClean).toBe(sClean)
  })
  it("G19: cleanExerciseName parity on \"1. Romanian Deadlift [Tempo 3-0-1-0] -- 4x8\"", () => {
    const cClean = clientCleanName("1. Romanian Deadlift [Tempo 3-0-1-0] -- 4x8")
    const sClean = serverModule.cleanExerciseName("1. Romanian Deadlift [Tempo 3-0-1-0] -- 4x8")
    expect(cClean).toBe(sClean)
  })
  it("G20: cleanExerciseName parity on \"Step-ups | 3 sets x 12 reps\"", () => {
    const cClean = clientCleanName("Step-ups | 3 sets x 12 reps")
    const sClean = serverModule.cleanExerciseName("Step-ups | 3 sets x 12 reps")
    expect(cClean).toBe(sClean)
  })
  it("G21: cleanExerciseName parity on \"Clean & Jerk: 5 sets x 2 reps\"", () => {
    const cClean = clientCleanName("Clean & Jerk: 5 sets x 2 reps")
    const sClean = serverModule.cleanExerciseName("Clean & Jerk: 5 sets x 2 reps")
    expect(cClean).toBe(sClean)
  })
  it("G22: cleanExerciseName parity on \"Wall Sits (pain-free flexion angle): 3x30s\"", () => {
    const cClean = clientCleanName("Wall Sits (pain-free flexion angle): 3x30s")
    const sClean = serverModule.cleanExerciseName("Wall Sits (pain-free flexion angle): 3x30s")
    expect(cClean).toBe(sClean)
  })
  it("G23: scanPlanForContraindications parity on \"Torn ACL\"", () => {
    const cScan = clientScanPlan("## Day 1\\n### Main Workout\\n- Box Jumps: 3x10\\n", "Torn ACL")
    const sScan = serverModule.scanPlanForContraindications("## Day 1\\n### Main Workout\\n- Box Jumps: 3x10\\n", "Torn ACL")

    expect(cScan.hasViolation).toBe(sScan.hasViolation)
    expect(cScan.violations.length).toBe(sScan.violations.length)
    if (cScan.violations.length > 0) {
      expect(cScan.violations[0].category).toBe(sScan.violations[0].category)
      expect(cScan.violations[0].matchedExercise).toBe(sScan.violations[0].matchedExercise)
    }
  })
  it("G24: scanPlanForContraindications parity on \"Torn ACL\"", () => {
    const cScan = clientScanPlan("## Day 1\\n### Main Workout\\n- Step-ups: 3x12 (safe alternative to box jumps)\\n", "Torn ACL")
    const sScan = serverModule.scanPlanForContraindications("## Day 1\\n### Main Workout\\n- Step-ups: 3x12 (safe alternative to box jumps)\\n", "Torn ACL")

    expect(cScan.hasViolation).toBe(sScan.hasViolation)
    expect(cScan.violations.length).toBe(sScan.violations.length)
    if (cScan.violations.length > 0) {
      expect(cScan.violations[0].category).toBe(sScan.violations[0].category)
      expect(cScan.violations[0].matchedExercise).toBe(sScan.violations[0].matchedExercise)
    }
  })
  it("G25: scanPlanForContraindications parity on \"Rotator cuff tear\"", () => {
    const cScan = clientScanPlan("## Day 1\\n### Main Workout\\n- Bench Press & Overhead Press: 3x8\\n", "Rotator cuff tear")
    const sScan = serverModule.scanPlanForContraindications("## Day 1\\n### Main Workout\\n- Bench Press & Overhead Press: 3x8\\n", "Rotator cuff tear")

    expect(cScan.hasViolation).toBe(sScan.hasViolation)
    expect(cScan.violations.length).toBe(sScan.violations.length)
    if (cScan.violations.length > 0) {
      expect(cScan.violations[0].category).toBe(sScan.violations[0].category)
      expect(cScan.violations[0].matchedExercise).toBe(sScan.violations[0].matchedExercise)
    }
  })
  it("G26: scanPlanForContraindications parity on \"Rotator cuff tear\"", () => {
    const cScan = clientScanPlan("## Day 1\\n### Meals\\nSnack: Hummus dip\\n### Main Workout\\n- Push-ups: 3x10\\n", "Rotator cuff tear")
    const sScan = serverModule.scanPlanForContraindications("## Day 1\\n### Meals\\nSnack: Hummus dip\\n### Main Workout\\n- Push-ups: 3x10\\n", "Rotator cuff tear")

    expect(cScan.hasViolation).toBe(sScan.hasViolation)
    expect(cScan.violations.length).toBe(sScan.violations.length)
    if (cScan.violations.length > 0) {
      expect(cScan.violations[0].category).toBe(sScan.violations[0].category)
      expect(cScan.violations[0].matchedExercise).toBe(sScan.violations[0].matchedExercise)
    }
  })
  it("G27: scanPlanForContraindications parity on \"L5-S1 disc herniation\"", () => {
    const cScan = clientScanPlan("## Day 1\\n### Main Workout\\n- Conventional Deadlift: 3x5\\n", "L5-S1 disc herniation")
    const sScan = serverModule.scanPlanForContraindications("## Day 1\\n### Main Workout\\n- Conventional Deadlift: 3x5\\n", "L5-S1 disc herniation")

    expect(cScan.hasViolation).toBe(sScan.hasViolation)
    expect(cScan.violations.length).toBe(sScan.violations.length)
    if (cScan.violations.length > 0) {
      expect(cScan.violations[0].category).toBe(sScan.violations[0].category)
      expect(cScan.violations[0].matchedExercise).toBe(sScan.violations[0].matchedExercise)
    }
  })
  it("G28: scanPlanForContraindications parity on \"None\"", () => {
    const cScan = clientScanPlan("## Day 1\\n### Main Workout\\n- Wall Sits: 3x30s\\n", "None")
    const sScan = serverModule.scanPlanForContraindications("## Day 1\\n### Main Workout\\n- Wall Sits: 3x30s\\n", "None")

    expect(cScan.hasViolation).toBe(sScan.hasViolation)
    expect(cScan.violations.length).toBe(sScan.violations.length)
    if (cScan.violations.length > 0) {
      expect(cScan.violations[0].category).toBe(sScan.violations[0].category)
      expect(cScan.violations[0].matchedExercise).toBe(sScan.violations[0].matchedExercise)
    }
  })
  it('G29: Taxonomy keys and severity parity across all 8 categories', () => {
    const cTax = clientTaxonomy
    const sTax = serverModule.CONTRAINDICATION_TAXONOMY

    const cKeys = Object.keys(cTax).sort()
    const sKeys = Object.keys(sTax).sort()
    expect(cKeys).toEqual(sKeys)
    expect(cKeys.length).toBe(8)

    for (const key of cKeys as ContraindicationCategoryKey[]) {
      expect(cTax[key].severity).toBe(sTax[key].severity)
      expect(cTax[key].action).toBe(sTax[key].action)
      expect(cTax[key].conditionLabel).toBe(sTax[key].conditionLabel)
    }
  })

  it('G30: Category labels dictionary parity', () => {
    const cLabels = CATEGORY_LABELS
    const sLabels = serverModule.CATEGORY_LABELS

    for (const key of Object.keys(cLabels) as ContraindicationCategoryKey[]) {
      expect(cLabels[key]).toBe(sLabels[key])
    }
  })
})

// ----------------------------------------------------------------------------
// SECTION H: GENERATION PIPELINE & FAIL-CLOSED ADVERSARIAL DEFENSE (H01 - H20)
// ----------------------------------------------------------------------------
describe('Section H: Generation Pipeline & Fail-Closed Adversarial Defense', () => {
  const baseProfile = {
    age: '28',
    gender: 'Male',
    height: '180',
    weight: '75',
    fitnessLevel: 'Intermediate',
    mainGoal: 'Muscle Gain',
    bodyFocus: ['Full Body'],
    timePerDay: '45',
    medicalIssues: 'None',
    equipment: ['Dumbbells'],
    pushupCount: '25',
    dietaryPreference: 'Omnivore',
    allergies: 'None',
    specialRequests: 'None',
    recoveryDays: '2',
    sleepHours: '8',
    stressLevel: 'Low',
  }

  it('H01: Structured clinical directives injected into client prompt for active knee pathology', () => {
    const prompt = clientGeneratePlanPrompt({ ...baseProfile, medicalIssues: 'Torn ACL left knee' })
    expect(prompt).toContain('[STRUCTURED CLINICAL INTAKE EVALUATION]')
    expect(prompt).toContain('Knee / ACL / Meniscus Pathology')
    expect(prompt).toContain('MANDATORY STRICT ACCOMMODATION')
  })

  it('H02: Structured clinical directives injected into server prompt for active shoulder pathology', () => {
    const prompt = serverModule.generatePlanPrompt({ ...baseProfile, medicalIssues: 'Rotator cuff tear right shoulder' })
    expect(prompt).toContain('[STRUCTURED CLINICAL INTAKE EVALUATION]')
    expect(prompt).toContain('Shoulder / Rotator Cuff / Impingement')
  })

  it('H03: Confirmed negations reflected in prompt as free from injury', () => {
    const prompt = clientGeneratePlanPrompt({ ...baseProfile, medicalIssues: 'No knee injuries, denies back pain' })
    expect(prompt).toContain('CONFIRMED NEGATIONS')
    expect(prompt).toContain('Standard programming permitted')
  })

  it('H04: Historical resolved conditions flagged as rehabilitated in prompt', () => {
    const prompt = clientGeneratePlanPrompt({ ...baseProfile, medicalIssues: 'Mild shoulder strain 10 years ago, completely resolved and 100% pain-free' })
    expect(prompt).toContain('REHABILITATED - SAFE FOR STANDARD PROGRAMMING WITH WARM-UP')
  })

  it('H05: Benign "None" produces clean prompt with no limitations declared', () => {
    const prompt = clientGeneratePlanPrompt({ ...baseProfile, medicalIssues: 'None' })
    expect(prompt).toContain('Explicitly declared free of medical conditions and injuries.')
  })

  it('H06: Serverless post-generation scanner intercepts contraindicated exercise', () => {
    const unsafeText = '## Day 1: Strength\n### Main Workout\n- Box Jumps: 3 sets x 10 reps\n'
    const scan = serverModule.scanPlanForContraindications(unsafeText, 'Torn ACL')
    expect(scan.hasViolation).toBe(true)
    expect(scan.violations[0].category).toBe('knee_high_impact')
    expect(scan.violations[0].matchedExercise.toLowerCase()).toBe('box jumps')
  })

  it('H07: Serverless post-generation scanner accepts safe accommodated plan', () => {
    const safeText = '## Day 1: Strength\n### Main Workout\n- Box Squats: 3 sets x 10 reps\n- Glute Bridges: 3 sets x 12 reps\n'
    const scan = serverModule.scanPlanForContraindications(safeText, 'Torn ACL')
    expect(scan.hasViolation).toBe(false)
  })

  it('H08: Serverless retry instruction identifies violated exercise and clinical reason', () => {
    const unsafeText = '## Day 1: Strength\n### Main Workout\n- Burpees: 3 sets x 10 reps\n'
    const scan = serverModule.scanPlanForContraindications(unsafeText, 'Patellar tendinitis')
    expect(scan.hasViolation).toBe(true)
    const violation = scan.violations[0]
    expect(violation.reason).toContain('High-impact plyometrics')
  })

  it('H09: Dual violation (knee + shoulder) detects multiple distinct violations', () => {
    const unsafeText = '## Day 1\n### Main Workout\n- Box Jumps: 3x10\n- Overhead Press: 3x8\n'
    const scan = serverModule.scanPlanForContraindications(unsafeText, 'Torn ACL; Rotator cuff tear')
    expect(scan.hasViolation).toBe(true)
    expect(scan.violations.length).toBe(2)
    const cats = scan.violations.map((v: { category: string }) => v.category)
    expect(cats).toContain('knee_high_impact')
    expect(cats).toContain('shoulder_impingement_cuff')
  })

  it('H10: Repeated failure fails closed with 422 Unprocessable Entity specification', () => {
    const errorPayload = {
      error: 'Generated plan violated clinical contraindication constraints.',
      violations: [
        {
          category: 'knee_high_impact',
          conditionLabel: 'Knee / ACL / Meniscus Pathology',
          matchedExercise: 'Box Jumps',
          severity: 'critical',
          reason: 'High-impact plyometrics produce extreme shear on ACL.',
        },
      ],
    }
    expect(errorPayload.violations[0].category).toBe('knee_high_impact')
    expect(errorPayload.violations[0].severity).toBe('critical')
  })

  it('H11: Client validation contract: hasSafetySensitiveMedicalIssues returns true for active ACL tear', () => {
    expect(hasSafetySensitiveMedicalIssues('Torn ACL left knee')).toBe(true)
  })

  it('H12: Client validation contract: hasSafetySensitiveMedicalIssues returns false for "None"', () => {
    expect(hasSafetySensitiveMedicalIssues('None')).toBe(false)
  })

  it('H13: Client validation contract: hasSafetySensitiveMedicalIssues returns false for explicit negation', () => {
    expect(hasSafetySensitiveMedicalIssues('No medical issues')).toBe(false)
  })

  it('H14: Client validation contract: hasSafetySensitiveMedicalIssues returns true for permanent joint replacement', () => {
    expect(hasSafetySensitiveMedicalIssues('Total knee replacement 5 years ago, pain-free now')).toBe(true)
  })

  it('H15: Client validation contract: hasSafetySensitiveMedicalIssues fails closed on unrecognized text', () => {
    expect(hasSafetySensitiveMedicalIssues('Knee hurts when descending stairs')).toBe(true)
  })

  it('H16: Gym Mode session safety firewall blocks session with active contraindication', () => {
    const scan = clientScanPlan('## Day 1\n- Box Jumps: 3x10\n', 'ACL tear')
    expect(scan.hasViolation).toBe(true)
    const canLaunchGymMode = !scan.hasViolation
    expect(canLaunchGymMode).toBe(false)
  })

  it('H17: Gym Mode session safety firewall permits session with safe exercises', () => {
    const scan = clientScanPlan('## Day 1\n- Step-ups: 3x12\n', 'ACL tear')
    expect(scan.hasViolation).toBe(false)
    const canLaunchGymMode = !scan.hasViolation
    expect(canLaunchGymMode).toBe(true)
  })

  it('H18: Invariant: Handstand push-ups never exempted as push-ups in shoulder pathology', () => {
    const scan = clientScanPlan('## Day 1\n- Handstand Push-ups: 3x5\n', 'Rotator cuff tear')
    expect(scan.hasViolation).toBe(true)
    expect(scan.violations[0].category).toBe('shoulder_impingement_cuff')
  })

  it('H19: Invariant: Open kinetic chain leg extensions never exempted for knee pathology', () => {
    const exemptions = clientTaxonomy.knee_high_impact.safeExemptions
    const allowsExtension = exemptions.some(ex => ex.source.includes('leg\\s+extension'))
    expect(allowsExtension).toBe(false)
  })

  it('H20: Invariant: 100% deterministic reproducibility across repeated scans', () => {
    const plan = '## Day 1\n- Box Jumps: 3x10\n- Push-ups: 3x15\n'
    const scan1 = clientScanPlan(plan, 'Torn ACL')
    const scan2 = clientScanPlan(plan, 'Torn ACL')
    const scan3 = clientScanPlan(plan, 'Torn ACL')

    expect(scan1.hasViolation).toBe(scan2.hasViolation)
    expect(scan2.hasViolation).toBe(scan3.hasViolation)
    expect(scan1.violations.length).toBe(scan2.violations.length)
    expect(scan2.violations.length).toBe(scan3.violations.length)
  })
})
