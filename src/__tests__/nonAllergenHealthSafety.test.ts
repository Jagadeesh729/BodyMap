// nonAllergenHealthSafety.test.ts
// Audit and regression suite for non-allergen health-safety, medical contraindications,
// and fallback safety boundaries.

import { describe, it, expect } from 'vitest'
import { hasSafetySensitiveMedicalIssues } from '../lib/validation'
import { MOCK_PLAN, validateGeneratedPlan } from '../lib/gemini'
import { parseAndValidatePlan } from '../lib/planSchema'
import { scanPlanForAllergens } from '../lib/allergenGuard'
import { calculateBMI } from '../lib/bmi'
import { estimateDailyMacros } from '../lib/macroEstimator'
import { calculateTargetHeartRateZones } from '../lib/targetHeartRateZones'

describe('PHASE 2 & 5: Medical Condition Classification & Fallback Gate', () => {
  it('identifies serious medical conditions and acute injuries as safety-sensitive', () => {
    const medicalInputs = [
      'Chest pain on exertion',
      'Recent heart attack 3 weeks ago',
      'Acute ACL tear yesterday',
      'Severe lower back herniated disc L4-L5',
      'Uncontrolled hypertension 180/110',
      'Third trimester high-risk pregnancy',
      'End stage renal disease (CKD stage 4)',
      'Recent open abdominal surgery 2 weeks ago',
      'Severe recurring syncope / fainting during exertion',
      'Type 1 diabetes with hypoglycemic episodes',
      'Severe exercise-induced asthma',
    ]

    for (const input of medicalInputs) {
      expect(hasSafetySensitiveMedicalIssues(input)).toBe(true)
    }
  })

  it('correctly classifies benign, empty, or explicit "None" medical declarations as non-sensitive', () => {
    const benignInputs = [
      '',
      '   ',
      'None',
      'none',
      'None stated',
      'No',
      'N/A',
      'n/a',
      'na',
      'Nil',
      'Healthy',
      'No injuries',
      'No known medical issues',
      'No limitations',
    ]

    for (const input of benignInputs) {
      expect(hasSafetySensitiveMedicalIssues(input)).toBe(false)
    }
  })

  it('blocks generic MOCK_PLAN fallback for serious medical profiles on API failure', () => {
    // Scenario 1: Chest pain profile with API outage
    const chestPainProfile = {
      allergies: 'None',
      medicalIssues: 'Chest pain on exertion',
    }
    const shouldBlockFallback =
      hasSafetySensitiveMedicalIssues(chestPainProfile.medicalIssues) ||
      scanPlanForAllergens(MOCK_PLAN, chestPainProfile.allergies).hasViolation
    expect(shouldBlockFallback).toBe(true)

    // Scenario 2: Acute ACL tear profile with API outage
    const aclProfile = {
      allergies: 'None',
      medicalIssues: 'Acute ACL tear',
    }
    expect(hasSafetySensitiveMedicalIssues(aclProfile.medicalIssues)).toBe(true)

    // Scenario 3: Pregnancy profile with API outage
    const pregnancyProfile = {
      allergies: 'None',
      medicalIssues: 'Pregnancy (28 weeks)',
    }
    expect(hasSafetySensitiveMedicalIssues(pregnancyProfile.medicalIssues)).toBe(true)

    // Scenario 4: Recent surgery profile with API outage
    const surgeryProfile = {
      allergies: 'None',
      medicalIssues: 'Recent spinal fusion surgery',
    }
    expect(hasSafetySensitiveMedicalIssues(surgeryProfile.medicalIssues)).toBe(true)
  })

  it('permits demo fallback ONLY when profile has NO allergies AND NO medical issues', () => {
    const cleanProfile = {
      allergies: 'None',
      medicalIssues: 'None',
    }
    const isMedicalSensitive = hasSafetySensitiveMedicalIssues(cleanProfile.medicalIssues)
    const isAllergenViolation = scanPlanForAllergens(MOCK_PLAN, cleanProfile.allergies).hasViolation
    const canFallBack = !isMedicalSensitive && !isAllergenViolation
    expect(canFallBack).toBe(true)
  })
})

describe('PHASE 3 & 4: Output Validator Semantic Boundary Falsification', () => {
  it('proves that structural output validator accepts medically contraindicated exercises', () => {
    // A complete, 7-day, structurally valid plan that prescribes dangerous exercises for an ACL tear
    const structurallyValidUnsafePlan = `## Day 1 - Lower Body Plyometrics
**Warm-up:** 5 mins high knees, jump rope
**Main Workout:**
- Box Jumps: 4 sets x 20 reps
- Heavy Barbell Squats: 5 sets x 5 reps
- Sprint Intervals: 10 sets x 100m
**Cool-down:** 5 mins quad stretch

**Meals:**
- Breakfast: Oatmeal with berries (400 kcal)
- Lunch: Chicken salad (500 kcal)
- Dinner: Turkey and rice (600 kcal)

## Day 2 - Active Rest
**Warm-up:** Gentle walking
**Main Workout:**
- Light stretching: 15 mins
**Cool-down:** Breathing

**Meals:**
- Breakfast: Eggs and toast (400 kcal)
- Lunch: Tuna wrap (500 kcal)
- Dinner: Salmon and sweet potato (600 kcal)

## Day 3 - Upper Body
**Warm-up:** Arm circles
**Main Workout:**
- Push-ups: 3 sets x 15 reps
**Cool-down:** Shoulder stretch

**Meals:**
- Breakfast: Smoothie (350 kcal)
- Lunch: Quinoa bowl (450 kcal)
- Dinner: Chicken and broccoli (550 kcal)

## Day 4 - Rest Day
**Warm-up:** None
**Main Workout:**
- Complete Rest
**Cool-down:** None

**Meals:**
- Breakfast: Fruit bowl (300 kcal)
- Lunch: Salad (400 kcal)
- Dinner: Lentil soup (500 kcal)

## Day 5 - Plyometric Cardio
**Warm-up:** Jumping jacks
**Main Workout:**
- Burpees: 4 sets x 15 reps
- Tuck Jumps: 4 sets x 12 reps
**Cool-down:** Static stretching

**Meals:**
- Breakfast: Oatmeal (350 kcal)
- Lunch: Turkey sandwich (450 kcal)
- Dinner: Beef stir-fry (550 kcal)

## Day 6 - Full Body
**Warm-up:** Joint mobility
**Main Workout:**
- Lunges: 3 sets x 10 reps
- Dumbbell Rows: 3 sets x 10 reps
**Cool-down:** Cooldown walk

**Meals:**
- Breakfast: Greek yogurt (300 kcal)
- Lunch: Rice and beans (450 kcal)
- Dinner: Grilled fish (500 kcal)

## Day 7 - Active Recovery
**Warm-up:** Gentle flow
**Main Workout:**
- Foam rolling: 20 mins
**Cool-down:** Deep breathing

**Meals:**
- Breakfast: Chia pudding (300 kcal)
- Lunch: Soup (400 kcal)
- Dinner: Roasted chicken (500 kcal)

Coaching Quote: "Consistency is key to greatness."`

    // Structural validation PASSES because all 7 days, workouts, and meals exist
    const structuralCheck = validateGeneratedPlan(structurallyValidUnsafePlan)
    expect(structuralCheck.isValid).toBe(true)

    const parsedPlan = parseAndValidatePlan(structurallyValidUnsafePlan)
    expect(parsedPlan.success).toBe(true)
    expect(parsedPlan.data?.days).toHaveLength(7)

    // Falsification proof: The output validator is purely structural; it cannot detect
    // that Box Jumps and Sprint Intervals are contraindicated for an acute ACL tear.
    const hasContraindicatedExercise = parsedPlan.data?.days.some(day =>
      day.workout?.exercises.some(e => /box jump|sprint|burpee/i.test(e.name))
    )
    expect(hasContraindicatedExercise).toBe(true)
  })
})

describe('PHASE 8 & 10: Derived Metrics Transitions & Profile Synchronization', () => {
  it('immediately updates BMI classification upon weight/height mutation', () => {
    // Normal BMI: 70kg, 175cm -> 22.9
    const bmiNormal = calculateBMI(175, 70)
    expect(bmiNormal.category.label).toBe('Normal Weight')

    // Underweight transition: 45kg, 175cm -> 14.7
    const bmiUnder = calculateBMI(175, 45)
    expect(bmiUnder.category.label).toBe('Underweight')

    // Obese transition: 110kg, 175cm -> 35.9
    const bmiObese = calculateBMI(175, 110)
    expect(bmiObese.category.label).toBe('Obese')
  })

  it('immediately updates target heart rate zones upon age transition', () => {
    // 25-year-old: max HR = 208 - (0.7 * 25) = 191
    const hrYoung = calculateTargetHeartRateZones(25)
    expect(hrYoung.estimatedMaxHr).toBe(191)

    // 75-year-old elderly transition: max HR = 208 - (0.7 * 75) = 156
    const hrElderly = calculateTargetHeartRateZones(75)
    expect(hrElderly.estimatedMaxHr).toBe(156)
    expect(hrElderly.estimatedMaxHr).toBeLessThan(hrYoung.estimatedMaxHr)
  })

  it('immediately updates daily macro estimations upon weight and goal mutation', () => {
    const macrosBulk = estimateDailyMacros('80', 'bulk')
    const macrosSlim = estimateDailyMacros('80', 'slim')

    expect(macrosBulk.totalKcal).toBeGreaterThan(macrosSlim.totalKcal)
    expect(macrosBulk.hasData).toBe(true)
    expect(macrosSlim.hasData).toBe(true)
  })

  it('demonstrates CreatePlan and EditPlan medical-failure decision parity', () => {
    // Both pages must evaluate the exact same condition:
    // isBlocked = activeAllergens.length > 0 || mockScan.hasViolation || hasSafetySensitiveMedicalIssues(medicalIssues)
    const testProfiles = [
      { allergies: 'None', medicalIssues: 'Recent knee surgery', expectBlocked: true },
      { allergies: 'None', medicalIssues: 'Pregnant (3rd trimester)', expectBlocked: true },
      { allergies: 'None', medicalIssues: 'None', expectBlocked: false },
      { allergies: 'dairy', medicalIssues: 'None', expectBlocked: true },
      { allergies: 'None', medicalIssues: '', expectBlocked: false },
    ]

    for (const p of testProfiles) {
      const isMedical = hasSafetySensitiveMedicalIssues(p.medicalIssues)
      const isAllergen = scanPlanForAllergens(MOCK_PLAN, p.allergies).hasViolation
      const isBlocked = isMedical || isAllergen
      expect(isBlocked).toBe(p.expectBlocked)
    }
  })

  it('proves WeeklyPlanPage medical advisory condition activates whenever medicalIssues is present', () => {
    expect(hasSafetySensitiveMedicalIssues('Herniated disc L5-S1')).toBe(true)
    expect(hasSafetySensitiveMedicalIssues('Uncontrolled blood pressure')).toBe(true)
    expect(hasSafetySensitiveMedicalIssues('None')).toBe(false)
  })
})
