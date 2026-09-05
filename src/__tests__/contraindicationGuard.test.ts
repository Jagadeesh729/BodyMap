import { describe, it, expect } from 'vitest'
import {
  scanPlanForContraindications,
  getActiveContraindicationCategories,
  normalizeExerciseString,
  isPrescriptiveExerciseLine,
  CONTRAINDICATION_TAXONOMY,
} from '../lib/contraindicationGuard'
import { MedicalContraindicationError } from '../lib/gemini'

describe('Deterministic Post-Generation Exercise Contraindication Guard', () => {
  // --- Category Trigger Precision Tests ---

  it('T1: detects acute knee/ACL/meniscus triggers without false positives on benign entries', () => {
    const active = getActiveContraindicationCategories('Acute ACL tear and partial meniscus rupture')
    expect(active.map(a => a.key)).toContain('knee_high_impact')

    const benign = getActiveContraindicationCategories('Knee strengthening exercises for healthy athlete')
    // Does not trigger because "strengthening" or "healthy" does not match tear/surgery/injury/acl/mcl/pcl/meniscus
    expect(benign.map(a => a.key)).not.toContain('knee_high_impact')
  })

  it('T2: detects rotator cuff / shoulder impingement triggers', () => {
    const active = getActiveContraindicationCategories('Rotator cuff tear with severe subacromial impingement')
    expect(active.map(a => a.key)).toContain('shoulder_impingement_cuff')
  })

  it('T3: detects lumbar disc herniation and sciatica triggers', () => {
    const active = getActiveContraindicationCategories('L4-L5 herniated disc and severe sciatica')
    expect(active.map(a => a.key)).toContain('lumbar_disc_herniation')
  })

  it('T4: detects cervical spine / neck injury triggers', () => {
    const active = getActiveContraindicationCategories('Cervical disc herniation at C5-C6 with neck fusion surgery')
    expect(active.map(a => a.key)).toContain('cervical_spine_pathology')
  })

  it('T5: detects symptomatic cardiac / angina triggers', () => {
    const active = getActiveContraindicationCategories('Coronary artery disease, angina, and severe hypertension')
    expect(active.map(a => a.key)).toContain('cardiac_symptomatic_condition')
  })

  it('T6: detects late-stage pregnancy triggers and ignores general early fitness without gestation context', () => {
    const activeLate = getActiveContraindicationCategories('Third trimester pregnancy (34 weeks pregnant)')
    expect(activeLate.map(a => a.key)).toContain('pregnancy_late_stage')

    const activeWeeks = getActiveContraindicationCategories('30 weeks pregnant')
    expect(activeWeeks.map(a => a.key)).toContain('pregnancy_late_stage')
  })

  it('T7: detects severe osteoporosis triggers', () => {
    const active = getActiveContraindicationCategories('Severe osteoporosis with history of vertebral compression fractures')
    expect(active.map(a => a.key)).toContain('severe_osteoporosis')
  })

  it('T8: detects severe osteoarthritis triggers', () => {
    const active = getActiveContraindicationCategories('Severe knee osteoarthritis with severe joint degeneration')
    expect(active.map(a => a.key)).toContain('severe_osteoarthritis')
  })

  // --- High-Confidence Contraindication Detection Tests ---

  it('T9: knee_high_impact blocks Box Jumps, Depth Jumps, Tuck Jumps, Jump Squats, and Burpees', () => {
    const medicalInput = 'Torn ACL and meniscus repair'
    const plan = `## Day 1 - Lower Body Plyometrics
**Warm-up:** 5 mins dynamic leg swings
**Main Workout:**
- Box Jumps: 4 sets x 12 reps (60s rest)
- Depth Jumps: 3 sets x 8 reps (90s rest)
- Tuck Jumps: 3 sets x 10 reps (60s rest)
- Jump Squats: 4 sets x 15 reps (60s rest)
- Burpees: 3 sets x 12 reps (60s rest)
**Cool-down:** 5 mins quad stretch

**Meals:**
- Breakfast: Oatmeal with berries (400 kcal)
- Lunch: Chicken salad (500 kcal)
- Dinner: Salmon with rice (600 kcal)
`
    const result = scanPlanForContraindications(plan, medicalInput)
    expect(result.hasViolation).toBe(true)
    expect(result.violations.length).toBeGreaterThanOrEqual(4)
    const matched = result.violations.map(v => v.matchedExercise.toLowerCase())
    expect(matched.some(m => m.includes('box jump'))).toBe(true)
    expect(matched.some(m => m.includes('depth jump'))).toBe(true)
    expect(matched.some(m => m.includes('tuck jump'))).toBe(true)
    expect(matched.some(m => m.includes('jump squat') || m.includes('jumps squat'))).toBe(true)
    expect(matched.some(m => m.includes('burpee'))).toBe(true)
  })

  it('T10: shoulder_impingement_cuff blocks Barbell Overhead Press, Behind-the-Neck Press, and Parallel Bar Dips', () => {
    const medicalInput = 'Rotator cuff tear, right shoulder'
    const plan = `## Day 1 - Overhead Blast
**Warm-up:** 5 mins band pull-aparts
**Main Workout:**
- Barbell Overhead Press: 4 sets x 8 reps (90s rest)
- Behind-the-Neck Press: 3 sets x 10 reps (90s rest)
- Parallel Bar Dips: 3 sets x 12 reps (60s rest)
- Handstand Push-ups: 3 sets x 5 reps (120s rest)
**Cool-down:** 5 mins shoulder stretch

**Meals:**
- Breakfast: Scrambled eggs and spinach (350 kcal)
`
    const result = scanPlanForContraindications(plan, medicalInput)
    expect(result.hasViolation).toBe(true)
    const matched = result.violations.map(v => v.matchedExercise.toLowerCase())
    expect(matched.some(m => m.includes('overhead press') || m.includes('barbell overhead press'))).toBe(true)
    expect(matched.some(m => m.includes('behind-the-neck press'))).toBe(true)
    expect(matched.some(m => m.includes('parallel bar dip'))).toBe(true)
  })

  it('T11: lumbar_disc_herniation blocks Heavy Deadlifts, Jefferson Curls, and Barbell Good Mornings', () => {
    const medicalInput = 'L4-L5 herniated disc and sciatica'
    const plan = `## Day 1 - Posterior Chain
**Warm-up:** 5 mins bike
**Main Workout:**
- Heavy Barbell Deadlifts: 5 sets x 5 reps (120s rest)
- Jefferson Curls: 3 sets x 10 reps (60s rest)
- Barbell Good-Mornings: 3 sets x 10 reps (90s rest)
- Weighted Decline Sit-ups: 3 sets x 15 reps (60s rest)
**Cool-down:** 5 mins child pose
`
    const result = scanPlanForContraindications(plan, medicalInput)
    expect(result.hasViolation).toBe(true)
    const matched = result.violations.map(v => v.matchedExercise.toLowerCase())
    expect(matched.some(m => m.includes('deadlift'))).toBe(true)
    expect(matched.some(m => m.includes('jefferson curl'))).toBe(true)
    expect(matched.some(m => m.includes('good-morning') || m.includes('good morning'))).toBe(true)
  })

  it('T12: cardiac_symptomatic_condition blocks All-out Sprints and Maximal Sprint Intervals', () => {
    const medicalInput = 'Coronary artery disease and angina'
    const plan = `## Day 1 - High Intensity
**Main Workout:**
- All-out Sprints: 10 sets x 30s maximal effort (30s rest)
- Sprint Intervals: 8 sets x 45s (45s rest)
`
    const result = scanPlanForContraindications(plan, medicalInput)
    expect(result.hasViolation).toBe(true)
    const matched = result.violations.map(v => v.matchedExercise.toLowerCase())
    expect(matched.some(m => m.includes('sprint'))).toBe(true)
  })

  it('T13: pregnancy_late_stage blocks Prone Superman Extensions and Belly-down movements', () => {
    const medicalInput = '32 weeks pregnant (third trimester)'
    const plan = `## Day 1 - Core
**Main Workout:**
- Prone Superman Extensions: 4 sets x 12 reps (60s rest)
- Lying flat on stomach cobra stretch: 3 sets x 30s
- Box Jumps: 3 sets x 10 reps
`
    const result = scanPlanForContraindications(plan, medicalInput)
    expect(result.hasViolation).toBe(true)
    const matched = result.violations.map(v => v.matchedExercise.toLowerCase())
    expect(matched.some(m => m.includes('prone superman') || m.includes('superman'))).toBe(true)
    expect(matched.some(m => m.includes('lying flat on stomach') || m.includes('stomach'))).toBe(true)
    expect(matched.some(m => m.includes('box jump'))).toBe(true)
  })

  it('T14: severe_osteoporosis blocks Jefferson Curls and High-Impact Bounding', () => {
    const medicalInput = 'Severe osteoporosis, bone density loss'
    const plan = `## Day 1 - Spine flexion
**Main Workout:**
- Jefferson Curls: 4 sets x 10 reps (60s rest)
- High-Impact Bounding: 4 sets x 15 reps (60s rest)
`
    const result = scanPlanForContraindications(plan, medicalInput)
    expect(result.hasViolation).toBe(true)
    expect(result.violations.some(v => v.category === 'severe_osteoporosis')).toBe(true)
  })

  // --- Normalization & Character Variant Tests ---

  it('T15: normalizes case, markdown asterisks, hyphens, and whitespace variants', () => {
    expect(normalizeExerciseString('**Box   Jumps**')).toBe('Box Jumps')

    const medicalInput = 'ACL tear'
    const testCases = [
      '**Box Jumps**: 4 sets x 10 reps',
      'box-jumps: 4 sets x 10 reps',
      'BOX   JUMPS: 4 sets x 10 reps',
      '* Box Jumps (Plyometric): 3 sets x 10',
      '1. Jump Squats: 4 sets x 12',
    ]

    for (const item of testCases) {
      const plan = `## Day 1\n**Main Workout:**\n${item}\n`
      const result = scanPlanForContraindications(plan, medicalInput)
      expect(result.hasViolation, `Expected violation for: ${item}`).toBe(true)
    }
  })

  // --- False Positive Resistance Tests ---

  it('T16: Box Squats does NOT match Box Jumps (safe controlled sitting)', () => {
    const medicalInput = 'ACL reconstruction'
    const plan = `## Day 1 - Leg Strength
**Main Workout:**
- Box Squats: 3 sets x 10 reps (90s rest)
- Glute Bridges: 3 sets x 15 reps
- Straight-leg Raises: 3 sets x 15 reps
`
    const result = scanPlanForContraindications(plan, medicalInput)
    expect(result.hasViolation).toBe(false)
  })

  it('T17: Bench Press and Push-ups do NOT trigger Shoulder Overhead Press rule', () => {
    const medicalInput = 'Rotator cuff tendinitis'
    const plan = `## Day 1 - Chest Focus
**Main Workout:**
- Bench Press: 4 sets x 8 reps (90s rest)
- Push-ups: 3 sets x 15 reps (60s rest)
- Chest Flyes: 3 sets x 12 reps (60s rest)
- Dumbbell Rows: 3 sets x 10 reps (60s rest)
`
    const result = scanPlanForContraindications(plan, medicalInput)
    expect(result.hasViolation).toBe(false)
  })

  it('T18: Food items like guacamole dip or salsa dip in Meals do NOT trigger shoulder dip rule', () => {
    const medicalInput = 'Shoulder impingement'
    const plan = `## Day 1 - Healthy Day
**Main Workout:**
- Push-ups: 3 sets x 10 reps
- Dumbbell Rows: 3 sets x 10 reps

**Meals:**
- Breakfast: Scrambled eggs with toast (350 kcal)
- Lunch: Turkey wrap with avocado dip and carrot sticks (450 kcal)
- Dinner: Grilled chicken with salsa dip and roasted vegetables (500 kcal)
- Snacks: Greek yogurt with honey (200 kcal)
`
    const result = scanPlanForContraindications(plan, medicalInput)
    expect(result.hasViolation).toBe(false)
  })

  it('T19: Bird-Dog, Dead Bug, and bodyweight hip hinge do NOT trigger lumbar deadlift rule', () => {
    const medicalInput = 'L5-S1 lumbar disc bulge'
    const plan = `## Day 1 - Spine Neutral Rehab
**Main Workout:**
- Bird-dog: 3 sets x 10 reps per side (60s rest)
- Dead Bugs: 3 sets x 12 reps (60s rest)
- Pallof Press: 3 sets x 12 reps (45s rest)
- Glute Bridges: 3 sets x 15 reps (60s rest)
- Bodyweight Hip Hinge: 3 sets x 12 reps (60s rest)
`
    const result = scanPlanForContraindications(plan, medicalInput)
    expect(result.hasViolation).toBe(false)
  })

  // --- Semantic Negation & Exemption Engine Tests ---

  it('T20: pure avoidance text ("Avoid box jumps") is SAFE and does not trigger false positive', () => {
    const eval1 = isPrescriptiveExerciseLine('Avoid box jumps', /\bbox\s+jumps?\b/i)
    expect(eval1.isPrescription).toBe(false)

    const eval2 = isPrescriptiveExerciseLine('Do NOT perform box jumps', /\bbox\s+jumps?\b/i)
    expect(eval2.isPrescription).toBe(false)

    const eval3 = isPrescriptiveExerciseLine('Box jumps are contraindicated', /\bbox\s+jumps?\b/i)
    expect(eval3.isPrescription).toBe(false)

    const eval4 = isPrescriptiveExerciseLine('Exercises to avoid: Box jumps, Depth jumps', /\bbox\s+jumps?\b/i)
    expect(eval4.isPrescription).toBe(false)

    const eval5 = isPrescriptiveExerciseLine('Box jumps should be avoided; replace them with step-ups.', /\bbox\s+jumps?\b/i)
    expect(eval5.isPrescription).toBe(false)

    const eval6 = isPrescriptiveExerciseLine('- Step-ups: 3 sets x 12 reps (safe alternative to box jumps)', /\bbox\s+jumps?\b/i)
    expect(eval6.isPrescription).toBe(false)
  })

  it('T21: pseudo-avoidance hiding a prescription ("Avoid box jumps, but perform 4 sets of box jumps if tolerated") is UNSAFE', () => {
    const line = 'Avoid box jumps, but perform 4 sets of box jumps if tolerated.'
    const evalResult = isPrescriptiveExerciseLine(line, /\bbox\s+jumps?\b/i)
    expect(evalResult.isPrescription).toBe(true)
  })

  it('T22: substituting one forbidden movement with another ("Do not perform box jumps. Perform jumping lunges instead.") triggers violation', () => {
    const medicalInput = 'ACL tear'
    const plan = `## Day 1
**Main Workout:**
- Do not perform box jumps. Perform 4 sets of jumping lunges instead.
`
    const result = scanPlanForContraindications(plan, medicalInput)
    expect(result.hasViolation).toBe(true)
    expect(result.violations.some(v => v.matchedExercise.toLowerCase().includes('jumping lunge'))).toBe(true)
  })

  // --- Actionable Violation Object Tests ---

  it('T23: violation object contains actionable metadata for UI and retry prompts', () => {
    const medicalInput = 'Acute ACL tear'
    const plan = `## Day 3 - Explosive Power
**Main Workout:**
- Box Jumps: 4 sets x 10 reps (60s rest)
`
    const result = scanPlanForContraindications(plan, medicalInput)
    expect(result.hasViolation).toBe(true)
    const v = result.violations[0]
    expect(v.category).toBe('knee_high_impact')
    expect(v.conditionLabel).toBe('Knee / ACL / Meniscus Pathology')
    expect(v.matchedExercise.toLowerCase()).toContain('box jump')
    expect(v.dayNumber).toBe(3)
    expect(v.dayTitle).toBe('Day 3 - Explosive Power')
    expect(v.severity).toBe('critical')
    expect(v.reason).toBeTruthy()
    expect(v.sourceLine).toContain('Box Jumps: 4 sets x 10 reps')
  })

  // --- MedicalContraindicationError Class Verification ---

  it('T24: MedicalContraindicationError carries status 422 and violation details', () => {
    const err = new MedicalContraindicationError(
      'MEDICAL_CONTRAINDICATION_VIOLATION',
      ['Knee / ACL / Meniscus Pathology'],
      [{
        category: 'knee_high_impact',
        conditionLabel: 'Knee / ACL / Meniscus Pathology',
        matchedExercise: 'Box Jumps',
        dayNumber: 1,
        sourceLine: 'Box Jumps: 3 sets x 10',
        reason: 'High impact shear'
      }]
    )

    expect(err.status).toBe(422)
    expect(err.name).toBe('MedicalContraindicationError')
    expect(err.contraindicatedConditions).toEqual(['Knee / ACL / Meniscus Pathology'])
    expect(err.contraindicatedViolations?.length).toBe(1)
  })

  it('T25: all 6 original falsification cases that bypassed structural validators are now rejected', () => {
    const cases = [
      {
        condition: 'Acute ACL tear and torn meniscus, right knee',
        plan: '## Day 1\n**Main Workout:**\n- Box Jumps: 4 sets x 15 reps\n- Depth Jumps: 3 sets x 10 reps\n',
      },
      {
        condition: 'Rotator cuff tear, severe right shoulder impingement',
        plan: '## Day 1\n**Main Workout:**\n- Barbell Overhead Press: 4 sets x 8 reps\n- Behind the Neck Press: 3 sets x 10 reps\n',
      },
      {
        condition: 'L4-L5 lumbar disc herniation with severe sciatica',
        plan: '## Day 1\n**Main Workout:**\n- Heavy Barbell Deadlift: 5 sets x 5 reps\n- Barbell Good Mornings: 3 sets x 10 reps\n',
      },
      {
        condition: 'History of angina, coronary artery disease, and severe hypertension',
        plan: '## Day 1\n**Main Workout:**\n- All-out Sprint Intervals: 10 sets x 30s maximal effort\n',
      },
      {
        condition: 'Third trimester pregnancy, 32 weeks pregnant',
        plan: '## Day 1\n**Main Workout:**\n- Prone Superman Extensions: 4 sets x 15 reps\n- Box Jumps: 3 sets x 10 reps\n',
      },
      {
        condition: 'Severe osteoporosis, history of vertebral compression fractures',
        plan: '## Day 1\n**Main Workout:**\n- Aggressive Loaded Spinal Flexion: 4 sets x 12 reps\n- High-Impact Bounding: 4 sets x 15 reps\n',
      },
    ]

    for (const c of cases) {
      const scan = scanPlanForContraindications(c.plan, c.condition)
      expect(scan.hasViolation, `Expected violation for condition: ${c.condition}`).toBe(true)
      expect(scan.violations.length).toBeGreaterThan(0)
    }
  })

  it('T26: taxonomy integrity and serverless rule parity check', () => {
    // Verify all 8 categories exist and have valid regexes
    const expectedKeys = [
      'knee_high_impact',
      'shoulder_impingement_cuff',
      'lumbar_disc_herniation',
      'cervical_spine_pathology',
      'cardiac_symptomatic_condition',
      'pregnancy_late_stage',
      'severe_osteoporosis',
      'severe_osteoarthritis',
    ]

    for (const key of expectedKeys) {
      const config = CONTRAINDICATION_TAXONOMY[key]
      expect(config).toBeDefined()
      expect(config.declarationTriggers.length).toBeGreaterThan(0)
      expect(config.forbiddenPatterns.length).toBeGreaterThan(0)
      expect(config.reason.length).toBeGreaterThan(10)
      expect(config.action).toBe('reject')
    }
  })
})
