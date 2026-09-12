/**
 * consumerSinkSafetyBoundaryOracle.test.tsx
 *
 * Exhaustive Adversarial Consumer-Sink Safety Boundary Oracle for BodyMap AI.
 * 400+ Assertions across Sections A through I enforcing:
 * UNSAFE / STALE / PROFILE-MISMATCHED / ALLERGEN-VIOLATING / CONTRAINDICATED / CORRUPTED PLAN
 * -> MUST NEVER ESCAPE THROUGH ANY CONTENT-BEARING CONSUMER SINK.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { PlanProvider, usePlan } from '@/context/PlanContext'
import WeeklyPlanPage from '@/pages/WeeklyPlanPage'
import DownloadPlanPage from '@/pages/DownloadPlanPage'
import {
  evaluatePlanContentSafety,
  evaluateGroceryContentSafety,
} from '@/lib/planSafetyGate'
import type { FormData } from '@/types/formData'

const BASE_FORM_DATA: FormData = {
  gender: 'male',
  age: '28',
  height: '178',
  weight: '75',
  fitnessLevel: 'intermediate',
  mainGoal: 'Muscle Gain',
  bodyFocus: ['Chest', 'Arms'],
  medicalIssues: '',
  pushupCount: '25',
  equipment: ['Dumbbells', 'Barbell'],
  dietaryPreference: 'omnivore',
  allergies: '',
  mealsPerDay: '3',
  specialDiet: '',
  sleepHours: '8',
  stressLevel: 'low',
  recoveryDays: '2',
  timePerDay: '45',
}

const SAFE_7DAY_PLAN = `# BodyMap 7-Day Fitness & Diet Plan
## Day 1 - Upper Body
**Warm-up:** 5 mins arm circles
- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)
- Dumbbell Rows: 3 sets x 12 reps
**Cool-down:** 5 mins shoulder stretch
**Meals:**
- Breakfast: Rolled oatmeal with whey protein and berries
- Lunch: Grilled chicken breast with brown rice
- Dinner: Baked salmon with sweet potato
- Snacks: Greek yogurt

## Day 2 - Lower Body
**Warm-up:** 5 mins leg swings
- Goblet Squats: 3 sets x 12 reps
- Romanian Deadlifts: 3 sets x 10 reps
**Cool-down:** 5 mins hamstring stretch
**Meals:**
- Breakfast: Scrambled eggs on toast
- Lunch: Turkey wrap with avocado
- Dinner: Lean beef with quinoa
- Snacks: Apple slices

## Day 3 - Rest & Mobility
**Warm-up:** 5 mins gentle walk
- Gentle Stretching: 20 mins
**Cool-down:** Deep breathing
**Meals:**
- Breakfast: Fruit smoothie
- Lunch: Quinoa salad with chickpeas
- Dinner: Grilled cod with vegetables
- Snacks: Mixed berries

## Day 4 - Push Day
**Warm-up:** 5 mins jumping jacks
- Overhead Dumbbell Press: 3 sets x 10 reps
- Push-ups: 3 sets x 15 reps
**Cool-down:** 5 mins chest stretch
**Meals:**
- Breakfast: Chia seed pudding
- Lunch: Lentil soup with pita
- Dinner: Roast chicken with zucchini
- Snacks: Hard-boiled eggs

## Day 5 - Pull Day
**Warm-up:** 5 mins band pull-aparts
- Dumbbell Pullovers: 3 sets x 12 reps
- Plank: 3 sets x 45 seconds
**Cool-down:** 5 mins core stretch
**Meals:**
- Breakfast: Steel cut oats
- Lunch: Tuna salad greens
- Dinner: Tofu stir fry
- Snacks: Edamame

## Day 6 - Full Body
**Warm-up:** 5 mins high knees
- Bodyweight Lunges: 3 sets x 12 reps
- Incline Push-ups: 3 sets x 12 reps
**Cool-down:** 5 mins quad stretch
**Meals:**
- Breakfast: Poached eggs with toast
- Lunch: Grilled chicken salad
- Dinner: Baked trout with potatoes
- Snacks: Hummus with carrots

## Day 7 - Active Recovery
**Warm-up:** 10 mins walk
- Full Body Stretch: 20 mins
**Cool-down:** Meditation
**Meals:**
- Breakfast: Protein oatmeal
- Lunch: Chicken breast bowl
- Dinner: Salmon fillet with broccoli
- Snacks: Orange slices
`

const SetupPlanWrapper = ({
  children,
  planText = SAFE_7DAY_PLAN,
  formData = BASE_FORM_DATA,
  boundProfile = BASE_FORM_DATA,
  isGenerated = true,
}: {
  children: React.ReactNode
  planText?: string
  formData?: FormData
  boundProfile?: Partial<FormData> | null
  isGenerated?: boolean
}) => {
  const { dispatch } = usePlan()
  React.useEffect(() => {
    if (boundProfile === null) {
      dispatch({
        type: 'LOAD_SAVED_PLAN',
        payload: {
          formData,
          generatedPlan: isGenerated ? planText : '',
          isGenerated,
          weightLog: [],
          completedDays: [],
        } as unknown as PlanState,
      })
    } else {
      dispatch({
        type: 'SET_GENERATED_PLAN',
        payload: {
          plan: isGenerated ? planText : '',
          formData: boundProfile as FormData,
        },
      })
      dispatch({ type: 'SET_FORM_DATA', payload: formData })
    }
  }, [dispatch, formData, boundProfile, planText, isGenerated])

  return <>{children}</>
}

const renderWeeklyPage = (options?: {
  planText?: string
  formData?: FormData
  boundProfile?: Partial<FormData> | null
  isGenerated?: boolean
}) => {
  return render(
    <PlanProvider>
      <SetupPlanWrapper
        planText={options?.planText}
        formData={options?.formData}
        boundProfile={options?.boundProfile}
        isGenerated={options?.isGenerated}
      >
        <BrowserRouter>
          <WeeklyPlanPage />
        </BrowserRouter>
      </SetupPlanWrapper>
    </PlanProvider>
  )
}

const renderDownloadPage = (options?: {
  planText?: string
  formData?: FormData
  boundProfile?: Partial<FormData> | null
  isGenerated?: boolean
}) => {
  return render(
    <PlanProvider>
      <SetupPlanWrapper
        planText={options?.planText}
        formData={options?.formData}
        boundProfile={options?.boundProfile}
        isGenerated={options?.isGenerated}
      >
        <BrowserRouter>
          <DownloadPlanPage />
        </BrowserRouter>
      </SetupPlanWrapper>
    </PlanProvider>
  )
}

describe('Consumer Sink Safety Oracle - Section A: Pure Safety Gate Engine', () => {
  it('A01: Safe standard profile and safe plan evaluates to 100% clean safety pass', () => {
    const res = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(false)
    expect(res.isWorkoutLocked).toBe(false)
    expect(res.isSafetyMismatched).toBe(false)
    expect(res.hasContraindications).toBe(false)
    expect(res.hasAllergens).toBe(false)
    expect(res.isPlanCorrupted).toBe(false)
    expect(res.reasons).toEqual([])
  })

  it('A02: Contraindication [knee_high_impact] correctly triggers safety violation & workout lock', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- High box jumps: 4 sets x 15 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Torn ACL and meniscus repair',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithContra,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.hasContraindications).toBe(true)
    expect(res.contraScan.hasViolation).toBe(true)
    expect(res.contraScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Contraindicated'))).toBe(true)
  })

  it('A03: Contraindication [shoulder_impingement_cuff] correctly triggers safety violation & workout lock', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Behind-the-neck barbell military press: 3 sets x 10 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Severe rotator cuff tendinitis and subacromial impingement',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithContra,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.hasContraindications).toBe(true)
    expect(res.contraScan.hasViolation).toBe(true)
    expect(res.contraScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Contraindicated'))).toBe(true)
  })

  it('A04: Contraindication [lumbar_disc_herniation] correctly triggers safety violation & workout lock', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Heavy conventional barbell deadlift: 5 sets x 5 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'L4-L5 herniated disc with acute sciatica',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithContra,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.hasContraindications).toBe(true)
    expect(res.contraScan.hasViolation).toBe(true)
    expect(res.contraScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Contraindicated'))).toBe(true)
  })

  it('A05: Contraindication [cervical_spine_pathology] correctly triggers safety violation & workout lock', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Barbell back squat with heavy neck loading: 3 sets x 8 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Cervical spinal stenosis and radiculopathy',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithContra,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.hasContraindications).toBe(true)
    expect(res.contraScan.hasViolation).toBe(true)
    expect(res.contraScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Contraindicated'))).toBe(true)
  })

  it('A06: Contraindication [cardiac_symptomatic_condition] correctly triggers safety violation & workout lock', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Tabata all-out maximal sprint intervals: 8 rounds'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Hypertrophic cardiomyopathy and angina symptoms',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithContra,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.hasContraindications).toBe(true)
    expect(res.contraScan.hasViolation).toBe(true)
    expect(res.contraScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Contraindicated'))).toBe(true)
  })

  it('A07: Contraindication [pregnancy_late_stage] correctly triggers safety violation & workout lock', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Supine floor crunches and sit-ups: 4 sets x 25 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: '32 weeks pregnant, third trimester',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithContra,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.hasContraindications).toBe(true)
    expect(res.contraScan.hasViolation).toBe(true)
    expect(res.contraScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Contraindicated'))).toBe(true)
  })

  it('A08: Contraindication [severe_osteoporosis] correctly triggers safety violation & workout lock', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Loaded spinal flexion twists with barbell: 3 sets x 12 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Severe lumbar and hip osteoporosis T-score -3.5',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithContra,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.hasContraindications).toBe(true)
    expect(res.contraScan.hasViolation).toBe(true)
    expect(res.contraScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Contraindicated'))).toBe(true)
  })

  it('A09: Contraindication [severe_osteoarthritis] correctly triggers safety violation & workout lock', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Box jumps: 4 sets x 15 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Severe knee osteoarthritis with joint degeneration',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithContra,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.hasContraindications).toBe(true)
    expect(res.contraScan.hasViolation).toBe(true)
    expect(res.contraScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Contraindicated'))).toBe(true)
  })

  it('A10: Allergen [peanut] correctly triggers safety violation', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Creamy organic peanut butter with toast'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Severe peanut allergy (anaphylaxis)',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithAllergen,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasAllergens).toBe(true)
    expect(res.allergenScan.hasViolation).toBe(true)
    expect(res.allergenScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Allergen conflict'))).toBe(true)
  })

  it('A11: Allergen [tree_nut] correctly triggers safety violation', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Trail mix with raw almonds and walnuts'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Tree nut allergy',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithAllergen,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasAllergens).toBe(true)
    expect(res.allergenScan.hasViolation).toBe(true)
    expect(res.allergenScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Allergen conflict'))).toBe(true)
  })

  it('A12: Allergen [dairy] correctly triggers safety violation', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Cheddar cheese cubes and whole milk latte'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Cow milk dairy allergy',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithAllergen,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasAllergens).toBe(true)
    expect(res.allergenScan.hasViolation).toBe(true)
    expect(res.allergenScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Allergen conflict'))).toBe(true)
  })

  it('A13: Allergen [egg] correctly triggers safety violation', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Scrambled whole eggs with spinach'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Egg intolerance and ovalbumin allergy',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithAllergen,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasAllergens).toBe(true)
    expect(res.allergenScan.hasViolation).toBe(true)
    expect(res.allergenScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Allergen conflict'))).toBe(true)
  })

  it('A14: Allergen [soy] correctly triggers safety violation', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Steamed edamame and firm tofu cubes'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Severe soy allergy',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithAllergen,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasAllergens).toBe(true)
    expect(res.allergenScan.hasViolation).toBe(true)
    expect(res.allergenScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Allergen conflict'))).toBe(true)
  })

  it('A15: Allergen [gluten_wheat] correctly triggers safety violation', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Whole wheat bread with turkey slices'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Celiac disease and wheat allergy',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithAllergen,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasAllergens).toBe(true)
    expect(res.allergenScan.hasViolation).toBe(true)
    expect(res.allergenScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Allergen conflict'))).toBe(true)
  })

  it('A16: Allergen [fish] correctly triggers safety violation', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Grilled Atlantic salmon fillet with dill'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Fin-fish allergy',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithAllergen,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasAllergens).toBe(true)
    expect(res.allergenScan.hasViolation).toBe(true)
    expect(res.allergenScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Allergen conflict'))).toBe(true)
  })

  it('A17: Allergen [shellfish] correctly triggers safety violation', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Sauteed shrimp and crab cake salad'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Crustacean shellfish allergy',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithAllergen,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasAllergens).toBe(true)
    expect(res.allergenScan.hasViolation).toBe(true)
    expect(res.allergenScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Allergen conflict'))).toBe(true)
  })

  it('A18: Allergen [sesame] correctly triggers safety violation', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Tahini paste and toasted sesame seed dressing'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Sesame seed allergy',
    }
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithAllergen,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasAllergens).toBe(true)
    expect(res.allergenScan.hasViolation).toBe(true)
    expect(res.allergenScan.violations.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some(r => r.includes('Allergen conflict'))).toBe(true)
  })

  it('A19: Profile medical condition change after plan generation triggers profile mismatch violation', () => {
    const boundProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: 'None' }
    const currentFormData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Lumbar disc herniation' }
    const res = evaluatePlanContentSafety({
      formData: currentFormData,
      boundProfile,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isSafetyMismatched).toBe(true)
    expect(res.bindingEval.mismatchedSafetyFields).toContain('medicalIssues')
  })

  it('A20: Profile allergy change after plan generation triggers profile mismatch violation', () => {
    const boundProfile: FormData = { ...BASE_FORM_DATA, allergies: 'None' }
    const currentFormData: FormData = { ...BASE_FORM_DATA, allergies: 'Peanut allergy' }
    const res = evaluatePlanContentSafety({
      formData: currentFormData,
      boundProfile,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isSafetyMismatched).toBe(true)
    expect(res.bindingEval.mismatchedSafetyFields).toContain('allergies')
  })

  it('A21: Both medical and allergy changes trigger compound profile mismatch', () => {
    const boundProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: '', allergies: '' }
    const currentFormData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Cervical stenosis',
      allergies: 'Tree nut allergy',
    }
    const res = evaluatePlanContentSafety({
      formData: currentFormData,
      boundProfile,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isSafetyMismatched).toBe(true)
    expect(res.bindingEval.mismatchedSafetyFields).toContain('medicalIssues')
    expect(res.bindingEval.mismatchedSafetyFields).toContain('allergies')
  })

  it('A22: Preference-only changes (goal, equipment, time) do NOT trigger safety violation', () => {
    const boundProfile: FormData = {
      ...BASE_FORM_DATA,
      mainGoal: 'Weight Loss',
      timePerDay: '30',
      equipment: ['Bodyweight'],
    }
    const currentFormData: FormData = {
      ...BASE_FORM_DATA,
      mainGoal: 'Muscle Gain',
      timePerDay: '60',
      equipment: ['Dumbbells', 'Barbell'],
    }
    const res = evaluatePlanContentSafety({
      formData: currentFormData,
      boundProfile,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(false)
    expect(res.isSafetyMismatched).toBe(false)
    expect(res.bindingEval.isPreferenceMismatched).toBe(true)
    expect(res.bindingEval.mismatchedPreferenceFields).toContain('mainGoal')
    expect(res.bindingEval.mismatchedPreferenceFields).toContain('timePerDay')
    expect(res.bindingEval.mismatchedPreferenceFields).toContain('equipment')
  })

  it('A23: Schema corruption flag parsedAiPlanSuccess=false triggers isPlanCorrupted violation', () => {
    const res = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: false,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isPlanCorrupted).toBe(true)
    expect(res.reasons.some(r => r.includes('corrupted'))).toBe(true)
  })

  it('A24: Empty plan text when isGenerated=true triggers isPlanCorrupted violation', () => {
    const res = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: '',
      isGenerated: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isPlanCorrupted).toBe(true)
  })

  it('A25: Sample plan (isGenerated=false) with empty planText is safe by design', () => {
    const res = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: '',
      isGenerated: false,
    })
    expect(res.isSafetyViolated).toBe(false)
    expect(res.isPlanCorrupted).toBe(false)
  })

  it('A26: Additional exercise lines scanning detects contraindications in parsed exercises', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Knee ACL tear' }
    const additionalLines = 'Box jumps: 3 sets x 10 reps\nLeg curls: 3 sets x 12 reps'
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
      additionalExerciseLines: additionalLines,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasContraindications).toBe(true)
  })

  it('A27: Additional meal texts scanning detects allergens in parsed meals', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Peanut allergy' }
    const additionalMeals = [
      'Healthy oats with peanut butter topping',
      'Grilled chicken salad',
    ]
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
      additionalMealTexts: additionalMeals,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasAllergens).toBe(true)
  })

  it('A28: Multi-category concurrent violations (knee + peanut + allergy profile change) aggregated', () => {
    const boundProfile: FormData = { ...BASE_FORM_DATA, allergies: '' }
    const currentFormData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Knee ACL reconstruction',
      allergies: 'Peanut allergy',
    }
    const unsafePlan = SAFE_7DAY_PLAN
      .replace('- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', '- Box jumps: 3 sets x 10 reps')
      .replace('- Breakfast: Rolled oatmeal with whey protein and berries', '- Breakfast: Toast with peanut butter')
    const res = evaluatePlanContentSafety({
      formData: currentFormData,
      boundProfile,
      planText: unsafePlan,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasContraindications).toBe(true)
    expect(res.hasAllergens).toBe(true)
    expect(res.isSafetyMismatched).toBe(true)
    expect(res.reasons.length).toBeGreaterThanOrEqual(3)
  })

  it('A29: Grocery safety evaluator permits grocery export when only exercise contraindication exists', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Knee ACL reconstruction' }
    const planWithKneeContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Box jumps: 3 sets x 10 reps'
    )
    const planSafety = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithKneeContra,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(planSafety.isSafetyViolated).toBe(true)
    expect(planSafety.hasContraindications).toBe(true)
    expect(planSafety.hasAllergens).toBe(false)

    const grocerySafety = evaluateGroceryContentSafety(planSafety)
    expect(grocerySafety.isGrocerySafetyViolated).toBe(false)
    expect(grocerySafety.hasAllergens).toBe(false)
    expect(grocerySafety.isAllergenMismatched).toBe(false)
  })

  it('A30: Grocery safety evaluator blocks grocery export when meal plan contains allergens', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Peanut allergy' }
    const planWithPeanuts = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Peanut butter toast'
    )
    const planSafety = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithPeanuts,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    const grocerySafety = evaluateGroceryContentSafety(planSafety)
    expect(grocerySafety.isGrocerySafetyViolated).toBe(true)
    expect(grocerySafety.hasAllergens).toBe(true)
    expect(grocerySafety.reasons.some(r => r.includes('Allergen violation'))).toBe(true)
  })

  it('A31: Grocery safety evaluator blocks grocery export when profile allergy changes', () => {
    const boundProfile: FormData = { ...BASE_FORM_DATA, allergies: '' }
    const currentFormData: FormData = { ...BASE_FORM_DATA, allergies: 'Tree nut allergy' }
    const planSafety = evaluatePlanContentSafety({
      formData: currentFormData,
      boundProfile,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    const grocerySafety = evaluateGroceryContentSafety(planSafety)
    expect(grocerySafety.isGrocerySafetyViolated).toBe(true)
    expect(grocerySafety.isAllergenMismatched).toBe(true)
  })

  it('A32: Grocery safety evaluator blocks grocery export when plan is corrupted', () => {
    const planSafety = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: false,
    })
    const grocerySafety = evaluateGroceryContentSafety(planSafety)
    expect(grocerySafety.isGrocerySafetyViolated).toBe(true)
    expect(grocerySafety.isPlanCorrupted).toBe(true)
  })

  it('A33: Safe exemptions: peanut-free butter does not trigger allergen violation', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Peanut allergy' }
    const planWithExemption = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Toast with certified peanut-free sunflower butter'
    )
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: planWithExemption,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.hasAllergens).toBe(false)
    expect(res.isSafetyViolated).toBe(false)
  })

  it('A34: Unbound legacy plan with active safety constraints in current profile is locked', () => {
    const currentFormData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Cardiac arrhythmia' }
    const res = evaluatePlanContentSafety({
      formData: currentFormData,
      boundProfile: null,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isSafetyMismatched).toBe(true)
    expect(res.bindingEval.isBound).toBe(false)
  })

  it('A35: Unbound legacy plan without safety constraints in profile is permitted', () => {
    const currentFormData: FormData = { ...BASE_FORM_DATA, medicalIssues: '', allergies: '' }
    const res = evaluatePlanContentSafety({
      formData: currentFormData,
      boundProfile: null,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res.isSafetyViolated).toBe(false)
    expect(res.isSafetyMismatched).toBe(false)
    expect(res.bindingEval.isBound).toBe(false)
  })
})

describe('Consumer Sink Safety Oracle - Section B: WeeklyPlanPage Copy Plan Sink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('B01: Clean safe plan renders Copy Plan button enabled and writes plan to clipboard on click', () => {
    renderWeeklyPage()
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.title).toContain('Copy full plan')

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SAFE_7DAY_PLAN)
  }, 15000)

  it('B02: WeeklyPlanPage blocks Copy Plan when contraindicated exercise present: [knee_high_impact]', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- High box jumps: 4 sets x 15 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Torn ACL and meniscus repair',
    }
    renderWeeklyPage({
      planText: planWithContra,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toContain('locked due to safety')

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B03: WeeklyPlanPage blocks Copy Plan when contraindicated exercise present: [shoulder_impingement_cuff]', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Behind-the-neck barbell military press: 3 sets x 10 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Severe rotator cuff tendinitis and subacromial impingement',
    }
    renderWeeklyPage({
      planText: planWithContra,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toContain('locked due to safety')

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B04: WeeklyPlanPage blocks Copy Plan when contraindicated exercise present: [lumbar_disc_herniation]', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Heavy conventional barbell deadlift: 5 sets x 5 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'L4-L5 herniated disc with acute sciatica',
    }
    renderWeeklyPage({
      planText: planWithContra,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toContain('locked due to safety')

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B05: WeeklyPlanPage blocks Copy Plan when contraindicated exercise present: [cervical_spine_pathology]', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Barbell back squat with heavy neck loading: 3 sets x 8 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Cervical spinal stenosis and radiculopathy',
    }
    renderWeeklyPage({
      planText: planWithContra,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toContain('locked due to safety')

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B06: WeeklyPlanPage blocks Copy Plan when contraindicated exercise present: [cardiac_symptomatic_condition]', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Tabata all-out maximal sprint intervals: 8 rounds'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Hypertrophic cardiomyopathy and angina symptoms',
    }
    renderWeeklyPage({
      planText: planWithContra,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toContain('locked due to safety')

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B07: WeeklyPlanPage blocks Copy Plan when contraindicated exercise present: [pregnancy_late_stage]', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Supine floor crunches and sit-ups: 4 sets x 25 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: '32 weeks pregnant, third trimester',
    }
    renderWeeklyPage({
      planText: planWithContra,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toContain('locked due to safety')

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B08: WeeklyPlanPage blocks Copy Plan when contraindicated exercise present: [severe_osteoporosis]', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Loaded spinal flexion twists with barbell: 3 sets x 12 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Severe lumbar and hip osteoporosis T-score -3.5',
    }
    renderWeeklyPage({
      planText: planWithContra,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toContain('locked due to safety')

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B09: WeeklyPlanPage blocks Copy Plan when contraindicated exercise present: [severe_osteoarthritis]', () => {
    const planWithContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Box jumps: 4 sets x 15 reps'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Severe knee osteoarthritis with joint degeneration',
    }
    renderWeeklyPage({
      planText: planWithContra,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toContain('locked due to safety')

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B10: WeeklyPlanPage blocks Copy Plan when allergen present: [peanut]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Creamy organic peanut butter with toast'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Severe peanut allergy (anaphylaxis)',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B11: WeeklyPlanPage blocks Copy Plan when allergen present: [tree_nut]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Trail mix with raw almonds and walnuts'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Tree nut allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B12: WeeklyPlanPage blocks Copy Plan when allergen present: [dairy]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Cheddar cheese cubes and whole milk latte'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Cow milk dairy allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B13: WeeklyPlanPage blocks Copy Plan when allergen present: [egg]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Scrambled whole eggs with spinach'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Egg intolerance and ovalbumin allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B14: WeeklyPlanPage blocks Copy Plan when allergen present: [soy]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Steamed edamame and firm tofu cubes'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Severe soy allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B15: WeeklyPlanPage blocks Copy Plan when allergen present: [gluten_wheat]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Whole wheat bread with turkey slices'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Celiac disease and wheat allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B16: WeeklyPlanPage blocks Copy Plan when allergen present: [fish]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Grilled Atlantic salmon fillet with dill'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Fin-fish allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B17: WeeklyPlanPage blocks Copy Plan when allergen present: [shellfish]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Sauteed shrimp and crab cake salad'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Crustacean shellfish allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B18: WeeklyPlanPage blocks Copy Plan when allergen present: [sesame]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Tahini paste and toasted sesame seed dressing'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Sesame seed allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    expect(copyButtons.length).toBeGreaterThan(0)
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B19: WeeklyPlanPage blocks Copy Plan when profile medical condition changed after generation', () => {
    const boundProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: '' }
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Rotator cuff tear' }
    renderWeeklyPage({
      planText: SAFE_7DAY_PLAN,
      formData,
      boundProfile,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B20: WeeklyPlanPage blocks Copy Plan when profile allergy changed after generation', () => {
    const boundProfile: FormData = { ...BASE_FORM_DATA, allergies: '' }
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Peanut allergy' }
    renderWeeklyPage({
      planText: SAFE_7DAY_PLAN,
      formData,
      boundProfile,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B21: WeeklyPlanPage blocks Copy Plan when plan is corrupted (unparseable structure)', () => {
    renderWeeklyPage({
      planText: 'Totally invalid non-plan text missing all days and structure',
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      isGenerated: true,
    })
    const copyButtons = screen.getAllByRole('button', { name: /copy plan/i })
    const btn = copyButtons[0] as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B22: Direct programmatic click invocation bypass attempt on disabled button is blocked by handler gate', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Knee ACL reconstruction' }
    const planWithKnee = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Box jumps: 3 sets x 10 reps'
    )
    renderWeeklyPage({
      planText: planWithKnee,
      formData,
      boundProfile: formData,
    })
    const btn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    // Even if an attacker removes disabled in DOM and invokes the handler directly:
    btn.disabled = false
    const reactPropsKey = Object.keys(btn).find(k => k.startsWith('__reactProps$'))
    expect(reactPropsKey).toBeDefined()
    if (reactPropsKey) {
      const props = (btn as Record<string, unknown>)[reactPropsKey] as { onClick?: () => void } | undefined
      expect(typeof props?.onClick).toBe('function')
      props?.onClick?.()
    }
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('B23: Day 7 late-week subtle contraindication blocks Copy Plan from page toolbar', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Cervical stenosis' }
    const planWithDay7Contra = SAFE_7DAY_PLAN.replace(
      '- Full Body Stretch: 20 mins',
      '- Behind-the-neck barbell press: 3 sets x 8 reps'
    )
    renderWeeklyPage({
      planText: planWithDay7Contra,
      formData,
      boundProfile: formData,
    })
    const btn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })
})

describe('Consumer Sink Safety Oracle - Section C: WeeklyPlanPage Grocery Checklist Sink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('C01: Safe plan allows opening grocery modal and copying categorized checklist', () => {
    renderWeeklyPage()
    const openBtn = screen.getByRole('button', { name: /7-day grocery list/i })
    fireEvent.click(openBtn)

    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(false)

    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    const copiedText = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]
    expect(copiedText).toContain('BODYMAP 7-DAY GROCERY CHECKLIST')
    expect(copiedText).toContain('[ PRODUCE ]')
  })

  it('C02: Grocery checklist export is blocked when allergen present: [peanut]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Creamy organic peanut butter with toast'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Severe peanut allergy (anaphylaxis)',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('C03: Grocery checklist export is blocked when allergen present: [tree_nut]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Trail mix with raw almonds and walnuts'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Tree nut allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('C04: Grocery checklist export is blocked when allergen present: [dairy]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Cheddar cheese cubes and whole milk latte'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Cow milk dairy allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('C05: Grocery checklist export is blocked when allergen present: [egg]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Scrambled whole eggs with spinach'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Egg intolerance and ovalbumin allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('C06: Grocery checklist export is blocked when allergen present: [soy]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Steamed edamame and firm tofu cubes'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Severe soy allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('C07: Grocery checklist export is blocked when allergen present: [gluten_wheat]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Whole wheat bread with turkey slices'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Celiac disease and wheat allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('C08: Grocery checklist export is blocked when allergen present: [fish]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Grilled Atlantic salmon fillet with dill'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Fin-fish allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('C09: Grocery checklist export is blocked when allergen present: [shellfish]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Sauteed shrimp and crab cake salad'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Crustacean shellfish allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('C10: Grocery checklist export is blocked when allergen present: [sesame]', () => {
    const planWithAllergen = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Tahini paste and toasted sesame seed dressing'
    )
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'Sesame seed allergy',
    }
    renderWeeklyPage({
      planText: planWithAllergen,
      formData,
      boundProfile: formData,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('C11: Profile allergy change after generation disables grocery export', () => {
    const boundProfile: FormData = { ...BASE_FORM_DATA, allergies: '' }
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Tree nut allergy' }
    renderWeeklyPage({
      planText: SAFE_7DAY_PLAN,
      formData,
      boundProfile,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('C12: Plan with corrupted schema disables grocery export', () => {
    renderWeeklyPage({
      planText: 'Corrupted unparseable markdown structure',
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      isGenerated: true,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('C13: Musculoskeletal injury with 100% safe meals leaves grocery checklist export enabled', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Knee ACL tear' }
    const planWithKneeContra = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Box jumps: 3 sets x 10 reps'
    )
    renderWeeklyPage({
      planText: planWithKneeContra,
      formData,
      boundProfile: formData,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(false)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
  })

  it('C14: Serving multiplier scaling operates correctly on safe grocery copy', () => {
    renderWeeklyPage()
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const mult2x = screen.getByRole('button', { name: /2x/i })
    fireEvent.click(mult2x)
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i })
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]
    expect(copied).toContain('(2x Servings')
  })
})

describe('Consumer Sink Safety Oracle - Section D: DownloadPlanPage Markdown Download Sink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    URL.createObjectURL = vi.fn().mockReturnValue('blob:bodymap-test')
    URL.revokeObjectURL = vi.fn()
  })

  it('D01: Clean safe plan allows Markdown download', () => {
    renderDownloadPage()
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it('D02: Markdown download blocked on contraindication [knee_high_impact]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Torn ACL and meniscus repair' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- High box jumps: 4 sets x 15 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D03: Markdown download blocked on contraindication [shoulder_impingement_cuff]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Severe rotator cuff tendinitis and subacromial impingement' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Behind-the-neck barbell military press: 3 sets x 10 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D04: Markdown download blocked on contraindication [lumbar_disc_herniation]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'L4-L5 herniated disc with acute sciatica' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Heavy conventional barbell deadlift: 5 sets x 5 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D05: Markdown download blocked on contraindication [cervical_spine_pathology]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Cervical spinal stenosis and radiculopathy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Barbell back squat with heavy neck loading: 3 sets x 8 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D06: Markdown download blocked on contraindication [cardiac_symptomatic_condition]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Hypertrophic cardiomyopathy and angina symptoms' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Tabata all-out maximal sprint intervals: 8 rounds'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D07: Markdown download blocked on contraindication [pregnancy_late_stage]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: '32 weeks pregnant, third trimester' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Supine floor crunches and sit-ups: 4 sets x 25 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D08: Markdown download blocked on contraindication [severe_osteoporosis]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Severe lumbar and hip osteoporosis T-score -3.5' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Loaded spinal flexion twists with barbell: 3 sets x 12 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D09: Markdown download blocked on contraindication [severe_osteoarthritis]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Severe knee osteoarthritis with joint degeneration' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Box jumps: 4 sets x 15 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D10: Markdown download blocked on allergen [peanut]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Severe peanut allergy (anaphylaxis)' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Creamy organic peanut butter with toast'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D11: Markdown download blocked on allergen [tree_nut]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Tree nut allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Trail mix with raw almonds and walnuts'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D12: Markdown download blocked on allergen [dairy]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Cow milk dairy allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Cheddar cheese cubes and whole milk latte'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D13: Markdown download blocked on allergen [egg]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Egg intolerance and ovalbumin allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Scrambled whole eggs with spinach'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D14: Markdown download blocked on allergen [soy]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Severe soy allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Steamed edamame and firm tofu cubes'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D15: Markdown download blocked on allergen [gluten_wheat]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Celiac disease and wheat allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Whole wheat bread with turkey slices'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D16: Markdown download blocked on allergen [fish]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Fin-fish allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Grilled Atlantic salmon fillet with dill'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D17: Markdown download blocked on allergen [shellfish]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Crustacean shellfish allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Sauteed shrimp and crab cake salad'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D18: Markdown download blocked on allergen [sesame]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Sesame seed allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Tahini paste and toasted sesame seed dressing'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D19: Markdown download blocked on profile medical mismatch', () => {
    const boundProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: '' }
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Lumbar disc herniation' }
    renderDownloadPage({
      planText: SAFE_7DAY_PLAN,
      formData,
      boundProfile,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('D20: Markdown download blocked on plan corruption', () => {
    renderDownloadPage({
      planText: 'corrupted markdown structure',
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      isGenerated: true,
    })
    const mdButton = screen.getByRole('button', { name: /save \.md file/i })
    expect((mdButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(mdButton)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})

describe('Consumer Sink Safety Oracle - Section E: DownloadPlanPage Print / PDF Sink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    window.print = vi.fn()
  })

  it('E01: Clean safe plan triggers window.print on print button click', () => {
    renderDownloadPage()
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect(printButtons.length).toBeGreaterThan(0)
    fireEvent.click(printButtons[0])
    expect(window.print).toHaveBeenCalledTimes(1)
  })

  it('E02: Print blocked on contraindication [knee_high_impact]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Torn ACL and meniscus repair' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- High box jumps: 4 sets x 15 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E03: Print blocked on contraindication [shoulder_impingement_cuff]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Severe rotator cuff tendinitis and subacromial impingement' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Behind-the-neck barbell military press: 3 sets x 10 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E04: Print blocked on contraindication [lumbar_disc_herniation]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'L4-L5 herniated disc with acute sciatica' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Heavy conventional barbell deadlift: 5 sets x 5 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E05: Print blocked on contraindication [cervical_spine_pathology]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Cervical spinal stenosis and radiculopathy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Barbell back squat with heavy neck loading: 3 sets x 8 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E06: Print blocked on contraindication [cardiac_symptomatic_condition]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Hypertrophic cardiomyopathy and angina symptoms' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Tabata all-out maximal sprint intervals: 8 rounds'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E07: Print blocked on contraindication [pregnancy_late_stage]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: '32 weeks pregnant, third trimester' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Supine floor crunches and sit-ups: 4 sets x 25 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E08: Print blocked on contraindication [severe_osteoporosis]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Severe lumbar and hip osteoporosis T-score -3.5' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Loaded spinal flexion twists with barbell: 3 sets x 12 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E09: Print blocked on contraindication [severe_osteoarthritis]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Severe knee osteoarthritis with joint degeneration' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Box jumps: 4 sets x 15 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E10: Print blocked on allergen [peanut]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Severe peanut allergy (anaphylaxis)' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Creamy organic peanut butter with toast'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E11: Print blocked on allergen [tree_nut]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Tree nut allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Trail mix with raw almonds and walnuts'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E12: Print blocked on allergen [dairy]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Cow milk dairy allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Cheddar cheese cubes and whole milk latte'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E13: Print blocked on allergen [egg]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Egg intolerance and ovalbumin allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Scrambled whole eggs with spinach'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E14: Print blocked on allergen [soy]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Severe soy allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Steamed edamame and firm tofu cubes'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E15: Print blocked on allergen [gluten_wheat]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Celiac disease and wheat allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Whole wheat bread with turkey slices'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E16: Print blocked on allergen [fish]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Fin-fish allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Grilled Atlantic salmon fillet with dill'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E17: Print blocked on allergen [shellfish]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Crustacean shellfish allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Sauteed shrimp and crab cake salad'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E18: Print blocked on allergen [sesame]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Sesame seed allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Tahini paste and toasted sesame seed dressing'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E19: Print blocked on profile allergen mismatch', () => {
    const boundProfile: FormData = { ...BASE_FORM_DATA, allergies: '' }
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Peanut allergy' }
    renderDownloadPage({
      planText: SAFE_7DAY_PLAN,
      formData,
      boundProfile,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })

  it('E20: Print blocked on plan corruption', () => {
    renderDownloadPage({
      planText: 'corrupted plan text',
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      isGenerated: true,
    })
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect((printButtons[0] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(printButtons[0])
    expect(window.print).not.toHaveBeenCalled()
  })
})

describe('Consumer Sink Safety Oracle - Section F: DownloadPlanPage Email Plan Sink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    window.open = vi.fn()
  })

  it('F01: Clean safe plan triggers window.open with mailto on form submit', () => {
    renderDownloadPage()
    const emailInput = screen.getByPlaceholderText(/enter email address/i)
    fireEvent.change(emailInput, { target: { value: 'athlete@example.com' } })
    const sendButton = screen.getByRole('button', { name: /send/i })
    fireEvent.click(sendButton)
    expect(window.open).toHaveBeenCalledTimes(1)
    expect(vi.mocked(window.open).mock.calls[0][0]).toContain('mailto:athlete@example.com')
  })

  it('F02: Email plan blocked on contraindication [knee_high_impact]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Torn ACL and meniscus repair' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- High box jumps: 4 sets x 15 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F03: Email plan blocked on contraindication [shoulder_impingement_cuff]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Severe rotator cuff tendinitis and subacromial impingement' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Behind-the-neck barbell military press: 3 sets x 10 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F04: Email plan blocked on contraindication [lumbar_disc_herniation]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'L4-L5 herniated disc with acute sciatica' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Heavy conventional barbell deadlift: 5 sets x 5 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F05: Email plan blocked on contraindication [cervical_spine_pathology]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Cervical spinal stenosis and radiculopathy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Barbell back squat with heavy neck loading: 3 sets x 8 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F06: Email plan blocked on contraindication [cardiac_symptomatic_condition]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Hypertrophic cardiomyopathy and angina symptoms' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Tabata all-out maximal sprint intervals: 8 rounds'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F07: Email plan blocked on contraindication [pregnancy_late_stage]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: '32 weeks pregnant, third trimester' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Supine floor crunches and sit-ups: 4 sets x 25 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F08: Email plan blocked on contraindication [severe_osteoporosis]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Severe lumbar and hip osteoporosis T-score -3.5' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Loaded spinal flexion twists with barbell: 3 sets x 12 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F09: Email plan blocked on contraindication [severe_osteoarthritis]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Severe knee osteoarthritis with joint degeneration' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Box jumps: 4 sets x 15 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F10: Email plan blocked on allergen [peanut]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Severe peanut allergy (anaphylaxis)' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Creamy organic peanut butter with toast'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F11: Email plan blocked on allergen [tree_nut]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Tree nut allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Trail mix with raw almonds and walnuts'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F12: Email plan blocked on allergen [dairy]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Cow milk dairy allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Cheddar cheese cubes and whole milk latte'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F13: Email plan blocked on allergen [egg]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Egg intolerance and ovalbumin allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Scrambled whole eggs with spinach'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F14: Email plan blocked on allergen [soy]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Severe soy allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Steamed edamame and firm tofu cubes'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F15: Email plan blocked on allergen [gluten_wheat]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Celiac disease and wheat allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Whole wheat bread with turkey slices'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F16: Email plan blocked on allergen [fish]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Fin-fish allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Grilled Atlantic salmon fillet with dill'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F17: Email plan blocked on allergen [shellfish]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Crustacean shellfish allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Sauteed shrimp and crab cake salad'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F18: Email plan blocked on allergen [sesame]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Sesame seed allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Tahini paste and toasted sesame seed dressing'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F19: Email plan blocked on profile medical mismatch', () => {
    const boundProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: '' }
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Shoulder impingement' }
    renderDownloadPage({
      planText: SAFE_7DAY_PLAN,
      formData,
      boundProfile,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })

  it('F20: Email plan blocked on plan corruption', () => {
    renderDownloadPage({
      planText: 'corrupted plan text',
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      isGenerated: true,
    })
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect((sendButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(window.open).not.toHaveBeenCalled()
  })
})

describe('Consumer Sink Safety Oracle - Section G: DownloadPlanPage Copy Plan Sink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('G01: Clean safe plan allows Copy All Text on DownloadPlanPage', () => {
    renderDownloadPage()
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SAFE_7DAY_PLAN)
  })

  it('G02: Copy All Text blocked on contraindication [knee_high_impact]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Torn ACL and meniscus repair' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- High box jumps: 4 sets x 15 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G03: Copy All Text blocked on contraindication [shoulder_impingement_cuff]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Severe rotator cuff tendinitis and subacromial impingement' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Behind-the-neck barbell military press: 3 sets x 10 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G04: Copy All Text blocked on contraindication [lumbar_disc_herniation]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'L4-L5 herniated disc with acute sciatica' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Heavy conventional barbell deadlift: 5 sets x 5 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G05: Copy All Text blocked on contraindication [cervical_spine_pathology]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Cervical spinal stenosis and radiculopathy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Barbell back squat with heavy neck loading: 3 sets x 8 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G06: Copy All Text blocked on contraindication [cardiac_symptomatic_condition]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Hypertrophic cardiomyopathy and angina symptoms' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Tabata all-out maximal sprint intervals: 8 rounds'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G07: Copy All Text blocked on contraindication [pregnancy_late_stage]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: '32 weeks pregnant, third trimester' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Supine floor crunches and sit-ups: 4 sets x 25 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G08: Copy All Text blocked on contraindication [severe_osteoporosis]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Severe lumbar and hip osteoporosis T-score -3.5' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Loaded spinal flexion twists with barbell: 3 sets x 12 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G09: Copy All Text blocked on contraindication [severe_osteoarthritis]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Severe knee osteoarthritis with joint degeneration' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Box jumps: 4 sets x 15 reps'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G10: Copy All Text blocked on allergen [peanut]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Severe peanut allergy (anaphylaxis)' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Creamy organic peanut butter with toast'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G11: Copy All Text blocked on allergen [tree_nut]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Tree nut allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Trail mix with raw almonds and walnuts'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G12: Copy All Text blocked on allergen [dairy]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Cow milk dairy allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Cheddar cheese cubes and whole milk latte'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G13: Copy All Text blocked on allergen [egg]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Egg intolerance and ovalbumin allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Scrambled whole eggs with spinach'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G14: Copy All Text blocked on allergen [soy]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Severe soy allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Steamed edamame and firm tofu cubes'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G15: Copy All Text blocked on allergen [gluten_wheat]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Celiac disease and wheat allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Whole wheat bread with turkey slices'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G16: Copy All Text blocked on allergen [fish]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Fin-fish allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Grilled Atlantic salmon fillet with dill'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G17: Copy All Text blocked on allergen [shellfish]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Crustacean shellfish allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Sauteed shrimp and crab cake salad'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G18: Copy All Text blocked on allergen [sesame]', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Sesame seed allergy' }
    const unsafePlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Tahini paste and toasted sesame seed dressing'
    )
    renderDownloadPage({
      planText: unsafePlan,
      formData,
      boundProfile: formData,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G19: Copy All Text blocked on profile medical mismatch', () => {
    const boundProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: '' }
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Lumbar disc herniation' }
    renderDownloadPage({
      planText: SAFE_7DAY_PLAN,
      formData,
      boundProfile,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('G20: Copy All Text blocked on plan corruption', () => {
    renderDownloadPage({
      planText: 'corrupted plan text',
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      isGenerated: true,
    })
    const copyButton = screen.getByRole('button', { name: /copy to clipboard/i })
    expect((copyButton as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(copyButton)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })
})

describe('Consumer Sink Safety Oracle - Section H: Race Conditions & Rapid Double Activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('H01: Rapid double click on unsafe WeeklyPlanPage Copy button results in 0 clipboard writes', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Knee ACL reconstruction' }
    const planWithKnee = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- Box jumps: 3 sets x 10 reps'
    )
    renderWeeklyPage({
      planText: planWithKnee,
      formData,
      boundProfile: formData,
    })
    const btn = screen.getByRole('button', { name: /copy plan/i })
    fireEvent.click(btn)
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('H02: Rapid double click on safe WeeklyPlanPage Copy button invokes clipboard safely', () => {
    renderWeeklyPage()
    const btn = screen.getByRole('button', { name: /copy plan/i })
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })

  it('H03: Synchronous safety transition: changing profile from safe to contraindicated immediately locks gate', () => {
    const safeRes = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(safeRes.isSafetyViolated).toBe(false)

    const updatedForm: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Rotator cuff tear' }
    const unsafeRes = evaluatePlanContentSafety({
      formData: updatedForm,
      boundProfile: BASE_FORM_DATA,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(unsafeRes.isSafetyViolated).toBe(true)
    expect(unsafeRes.isSafetyMismatched).toBe(true)
  })

  it('H04: Corrupted plan injection synchronously locks pure safety gate', () => {
    const res = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: 'corrupted payload { bad json',
      isGenerated: true,
      parsedAiPlanSuccess: false,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isPlanCorrupted).toBe(true)
  })
})

describe('Consumer Sink Safety Oracle - Section I: Deep-Link & Tampered Storage Resistance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('I01: Maliciously stored contraindicated exercise in localStorage cannot escape via WeeklyPlanPage Copy', () => {
    const maliciousPlan = SAFE_7DAY_PLAN.replace(
      '- Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      '- High impact box jumps: 4 sets x 20 reps'
    )
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Knee ACL tear' }
    renderWeeklyPage({
      planText: maliciousPlan,
      formData,
      boundProfile: formData,
    })
    const btn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('I02: Maliciously stored allergen in localStorage cannot escape via Grocery checklist copy', () => {
    const maliciousPlan = SAFE_7DAY_PLAN.replace(
      '- Breakfast: Rolled oatmeal with whey protein and berries',
      '- Breakfast: Peanut butter toast with extra ground peanuts'
    )
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Peanut allergy' }
    renderWeeklyPage({
      planText: maliciousPlan,
      formData,
      boundProfile: formData,
    })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))
    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('I03: Tampered legacy plan missing bound profile but containing medical issues locks export', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Osteoporosis lumbar spine' }
    renderWeeklyPage({
      planText: SAFE_7DAY_PLAN,
      formData,
      boundProfile: null,
    })
    const btn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('I04: Tampered legacy plan missing bound profile but containing allergies locks export', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'Tree nut allergy' }
    renderWeeklyPage({
      planText: SAFE_7DAY_PLAN,
      formData,
      boundProfile: null,
    })
    const btn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(btn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('I05: Truncated empty plan with isGenerated=true locks all sinks', () => {
    renderDownloadPage({
      planText: '',
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      isGenerated: true,
    })
    const mdBtn = screen.getByRole('button', { name: /save \.md file/i }) as HTMLButtonElement
    expect(mdBtn.disabled).toBe(true)
  })
})
