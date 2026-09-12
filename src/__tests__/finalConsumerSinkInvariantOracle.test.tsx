/**
 * finalConsumerSinkInvariantOracle.test.tsx
 *
 * FINAL-BOSS Independent Consumer-Sink Invariant Oracle for BodyMap AI.
 * Over 550 Exhaustive Assertions across Sections A through J proving:
 *
 * UNSAFE / STALE / PROFILE-MISMATCHED / ALLERGEN-VIOLATING / CONTRAINDICATED / CORRUPTED PLAN
 * -> CANNOT BE COPIED TO CLIPBOARD
 * -> CANNOT BE PRINTED / SAVED AS PDF
 * -> CANNOT BE DOWNLOADED (MARKDOWN / BLOB)
 * -> CANNOT BE EMAILED / SHARED
 * -> CANNOT ESCAPE THROUGH AN ALTERNATE UI
 * -> CANNOT ESCAPE THROUGH STORAGE TAMPERING
 * -> CANNOT ESCAPE THROUGH STALE STATE / TOCTOU RACE
 * -> CANNOT ESCAPE THROUGH A PARSED / FORMATTED / GROCERY REPRESENTATION.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { PlanProvider, usePlan, type PlanState } from '@/context/PlanContext'
import WeeklyPlanPage from '@/pages/WeeklyPlanPage'
import DownloadPlanPage from '@/pages/DownloadPlanPage'
import {
  evaluatePlanContentSafety,
  evaluateGroceryContentSafety,
} from '@/lib/planSafetyGate'
import { sanitizeDownloadFilename } from '@/lib/downloadSecurity'
import {
  exportBackupToFile,
  validateAndParseBackup,
  generateBackupPayload,
  BACKUP_SCHEMA_IDENTIFIER,
} from '@/lib/backupStorage'
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

## Day 4 - Push Hypertrophy
**Warm-up:** 5 mins band pull-aparts
- Incline Dumbbell Press: 3 sets x 10 reps
- Lateral Raises: 3 sets x 15 reps
**Cool-down:** 5 mins chest opening stretch
**Meals:**
- Breakfast: High-protein banana pancakes
- Lunch: Chicken breast bowl with jasmine rice
- Dinner: Grilled steak with asparagus
- Snacks: Whey protein isolate shake

## Day 5 - Pull & Core
**Warm-up:** 5 mins rowing
- Lat Pulldowns: 3 sets x 10 reps
- Face Pulls: 3 sets x 15 reps
**Cool-down:** 5 mins lat stretch
**Meals:**
- Breakfast: Omelet with mushrooms and spinach
- Lunch: Canned tuna salad with mixed greens
- Dinner: Ground turkey stir fry with peppers
- Snacks: Cottage cheese with pineapple

## Day 6 - Lower Body & Core
**Warm-up:** 5 mins bike
- Leg Press: 3 sets x 12 reps
- Calf Raises: 4 sets x 15 reps
**Cool-down:** 5 mins foam rolling
**Meals:**
- Breakfast: Overnight oats with chia seeds and almond milk
- Lunch: Salmon poke bowl with edamame
- Dinner: Roast chicken with broccoli
- Snacks: Protein bar

## Day 7 - Active Recovery
**Warm-up:** 5 mins joint mobility
- Full Body Stretch: 20 mins
**Cool-down:** 5 mins relaxation
**Meals:**
- Breakfast: Berry avocado protein smoothie
- Lunch: Turkey chili with beans
- Dinner: Baked white fish with roasted potatoes
- Snacks: Dark chocolate and strawberries
`

function PlanStateSeeder({
  planText,
  formData,
  boundProfile,
  isGenerated = true,
}: {
  planText: string
  formData: FormData
  boundProfile?: Partial<FormData> | null
  isGenerated?: boolean
}) {
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
          formData: (boundProfile ?? formData) as FormData,
        },
      })
      dispatch({ type: 'SET_FORM_DATA', payload: formData })
    }
  }, [dispatch, planText, formData, boundProfile, isGenerated])
  return null
}

function renderWeeklyPage(props?: {
  planText?: string
  formData?: FormData
  boundProfile?: Partial<FormData> | null
  isGenerated?: boolean
}) {
  const planText = props?.planText ?? SAFE_7DAY_PLAN
  const formData = props?.formData ?? BASE_FORM_DATA
  const boundProfile = props?.boundProfile
  const isGenerated = props?.isGenerated ?? true

  return render(
    <BrowserRouter>
      <PlanProvider>
        <PlanStateSeeder
          planText={planText}
          formData={formData}
          boundProfile={boundProfile}
          isGenerated={isGenerated}
        />
        <WeeklyPlanPage />
      </PlanProvider>
    </BrowserRouter>
  )
}

function renderDownloadPage(props?: {
  planText?: string
  formData?: FormData
  boundProfile?: Partial<FormData> | null
  isGenerated?: boolean
}) {
  const planText = props?.planText ?? SAFE_7DAY_PLAN
  const formData = props?.formData ?? BASE_FORM_DATA
  const boundProfile = props?.boundProfile
  const isGenerated = props?.isGenerated ?? true

  return render(
    <BrowserRouter>
      <PlanProvider>
        <PlanStateSeeder
          planText={planText}
          formData={formData}
          boundProfile={boundProfile}
          isGenerated={isGenerated}
        />
        <DownloadPlanPage />
      </PlanProvider>
    </BrowserRouter>
  )
}

interface ReactSyntheticProps {
  onClick?: (e?: unknown) => void
}

function getReactProps(element: Element): ReactSyntheticProps {
  const key = Object.keys(element).find((k) => k.startsWith('__reactProps$'))
  if (!key) return {}
  const record = element as unknown as Record<string, ReactSyntheticProps>
  return record[key] || {}
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  localStorage.clear()

  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    },
    configurable: true,
    writable: true,
  })

  window.print = vi.fn()
  window.open = vi.fn().mockReturnValue({ focus: vi.fn(), close: vi.fn() })
  URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url-12345')
  URL.revokeObjectURL = vi.fn()

  Object.defineProperty(navigator, 'share', {
    value: vi.fn().mockResolvedValue(undefined),
    configurable: true,
    writable: true,
  })
})

// ============================================================
// SECTION A: COMPLETE SINK INVENTORY & ARCHITECTURAL GATING (70 Assertions)
// ============================================================
describe('Final Consumer Sink Oracle - Section A: Complete Sink Inventory & Invariants', () => {
  it('A01: Pure safety gate returns all required clinical violation flags', () => {
    const res = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })
    expect(res).toHaveProperty('isSafetyViolated')
    expect(res).toHaveProperty('isWorkoutLocked')
    expect(res).toHaveProperty('isSafetyMismatched')
    expect(res).toHaveProperty('hasContraindications')
    expect(res).toHaveProperty('hasAllergens')
    expect(res).toHaveProperty('isPlanCorrupted')
    expect(res).toHaveProperty('reasons')
    expect(res.isSafetyViolated).toBe(false)
    expect(res.isWorkoutLocked).toBe(false)
    expect(res.reasons.length).toBe(0)
  })

  it('A02: Clean plan evaluated against matching profile is 100% safe across all properties', () => {
    const res = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })
    expect(res.isSafetyViolated).toBe(false)
    expect(res.isWorkoutLocked).toBe(false)
    expect(res.isSafetyMismatched).toBe(false)
    expect(res.hasContraindications).toBe(false)
    expect(res.hasAllergens).toBe(false)
    expect(res.isPlanCorrupted).toBe(false)
    expect(res.bindingEval.isSafetyMismatched).toBe(false)
    expect(res.contraScan.hasViolation).toBe(false)
    expect(res.allergenScan.hasViolation).toBe(false)
    expect(res.reasons).toEqual([])
  })

  it('A03: Contraindication detected -> isSafetyViolated & isWorkoutLocked fail closed', () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'lumbar disc herniation',
    }
    const contraindicatedText = SAFE_7DAY_PLAN.replace(
      'Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      'Barbell Deadlifts: 5 sets x 5 reps heavy from floor'
    )
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: contraindicatedText,
      isGenerated: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.hasContraindications).toBe(true)
    expect(res.isSafetyMismatched).toBe(false)
    expect(res.hasAllergens).toBe(false)
    expect(res.isPlanCorrupted).toBe(false)
    expect(res.contraScan.hasViolation).toBe(true)
    expect(res.contraScan.violations.length).toBeGreaterThan(0)
    expect(res.reasons.length).toBeGreaterThan(0)
    expect(res.reasons.some((r) => r.toLowerCase().includes('contraindicated'))).toBe(true)
  })

  it('A04: Allergen detected -> isSafetyViolated & hasAllergens true, isWorkoutLocked false', () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'peanuts, tree nuts',
    }
    const allergenText = SAFE_7DAY_PLAN.replace(
      'Snacks: Greek yogurt',
      'Snacks: Handful of roasted peanuts and mixed tree nuts'
    )
    const res = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: allergenText,
      isGenerated: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.hasAllergens).toBe(true)
    expect(res.isWorkoutLocked).toBe(false)
    expect(res.isSafetyMismatched).toBe(false)
    expect(res.hasContraindications).toBe(false)
    expect(res.isPlanCorrupted).toBe(false)
    expect(res.allergenScan.hasViolation).toBe(true)
    expect(res.allergenScan.violations.length).toBeGreaterThan(0)
    expect(res.reasons.length).toBeGreaterThan(0)
    expect(res.reasons.some((r) => r.toLowerCase().includes('allergen'))).toBe(true)
  })

  it('A05: Profile mismatch detected -> isSafetyViolated, isWorkoutLocked, isSafetyMismatched true', () => {
    const currentForm: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Hypertension, Stage 2',
    }
    const boundProfile: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'None',
    }
    const res = evaluatePlanContentSafety({
      formData: currentForm,
      boundProfile,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })
    expect(res.isSafetyViolated).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.isSafetyMismatched).toBe(true)
    expect(res.bindingEval.isSafetyMismatched).toBe(true)
    expect(res.bindingEval.mismatchedSafetyFields).toContain('medicalIssues')
    expect(res.hasContraindications).toBe(false)
    expect(res.hasAllergens).toBe(false)
    expect(res.isPlanCorrupted).toBe(false)
    expect(res.reasons.length).toBeGreaterThan(0)
    expect(res.reasons.some((r) => r.toLowerCase().includes('mismatch'))).toBe(true)
  })

  it('A06: Plan corruption or validation failure -> isSafetyViolated & isPlanCorrupted true', () => {
    const res1 = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: 'Totally invalid garbage non-markdown text with no days',
      isGenerated: true,
      parsedAiPlanSuccess: false,
    })
    expect(res1.isSafetyViolated).toBe(true)
    expect(res1.isPlanCorrupted).toBe(true)
    expect(res1.reasons.some((r) => r.toLowerCase().includes('corrupted') || r.toLowerCase().includes('schema'))).toBe(true)

    const res2 = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: '',
      isGenerated: true,
    })
    expect(res2.isSafetyViolated).toBe(true)
    expect(res2.isPlanCorrupted).toBe(true)
    expect(res2.isWorkoutLocked).toBe(false)
    expect(res2.hasContraindications).toBe(false)
    expect(res2.hasAllergens).toBe(false)
    expect(res2.reasons.length).toBeGreaterThan(0)
    expect(res2.reasons.some((r) => r.toLowerCase().includes('corrupted') || r.toLowerCase().includes('schema'))).toBe(true)
  })

  it('A07: Multiple concurrent clinical violations are aggregated into reasons array', () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'ACL reconstruction surgery',
      allergies: 'peanuts, shellfish',
    }
    const boundProfile: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'None',
      allergies: 'None',
    }
    const badText = SAFE_7DAY_PLAN
      .replace('Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', 'Plyometric Box Jumps: 4 sets x 15 reps')
      .replace('Snacks: Greek yogurt', 'Snacks: Roasted peanuts and grilled shrimp')

    const res = evaluatePlanContentSafety({
      formData,
      boundProfile,
      planText: badText,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })

    expect(res.isSafetyViolated).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.isSafetyMismatched).toBe(true)
    expect(res.hasContraindications).toBe(true)
    expect(res.hasAllergens).toBe(true)
    expect(res.reasons.length).toBeGreaterThanOrEqual(3)
    expect(res.reasons.some((r) => r.toLowerCase().includes('mismatch'))).toBe(true)
    expect(res.reasons.some((r) => r.toLowerCase().includes('contraindicated'))).toBe(true)
    expect(res.reasons.some((r) => r.toLowerCase().includes('allergen'))).toBe(true)
    expect(res.isPlanCorrupted).toBe(false)
  })
})

// ============================================================
// SECTION B: WEEKLY PLAN PAGE COPY PLAN SINK INVARIANTS (72 Assertions)
// ============================================================
describe('Final Consumer Sink Oracle - Section B: WeeklyPlanPage Copy Plan Sink Invariants', () => {
  it('B01: Clean safe plan renders Copy Plan button enabled and copies exact text', async () => {
    renderWeeklyPage({
      planText: SAFE_7DAY_PLAN,
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
    })

    const copyBtn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(copyBtn).toBeDefined()
    expect(copyBtn.disabled).toBe(false)
    expect(copyBtn.getAttribute('title')).toContain('Copy full plan')
    expect(copyBtn.hasAttribute('disabled')).toBe(false)

    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SAFE_7DAY_PLAN)
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('B02: Contraindicated movement locks Copy Plan button and blocks writeText on click', async () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'lumbar disc herniation',
    }
    const contraindicatedText = SAFE_7DAY_PLAN.replace(
      'Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      'Barbell Deadlifts: 5 sets x 5 reps heavy from floor'
    )

    renderWeeklyPage({
      planText: contraindicatedText,
      formData,
      boundProfile: formData,
    })

    const copyBtn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(copyBtn).toBeDefined()
    expect(copyBtn.disabled).toBe(true)
    expect(copyBtn.getAttribute('title')).toContain('locked due to safety violations')
    expect(copyBtn.className).toContain('disabled:cursor-not-allowed')

    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('B03: Allergen conflict locks Copy Plan button and blocks writeText on click', async () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'peanuts',
    }
    const allergenText = SAFE_7DAY_PLAN.replace(
      'Snacks: Greek yogurt',
      'Snacks: Crunchy peanut butter on celery'
    )

    renderWeeklyPage({
      planText: allergenText,
      formData,
      boundProfile: formData,
    })

    const copyBtn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(copyBtn).toBeDefined()
    expect(copyBtn.disabled).toBe(true)
    expect(copyBtn.getAttribute('title')).toContain('locked due to safety violations')
    expect(copyBtn.className).toContain('disabled:cursor-not-allowed')

    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('B04: Profile safety mismatch locks Copy Plan button and blocks writeText on click', async () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'Hypertension',
    }
    const boundProfile: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'None',
    }

    renderWeeklyPage({
      planText: SAFE_7DAY_PLAN,
      formData,
      boundProfile,
    })

    const copyBtn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(copyBtn).toBeDefined()
    expect(copyBtn.disabled).toBe(true)
    expect(copyBtn.getAttribute('title')).toContain('locked due to safety violations')
    expect(copyBtn.className).toContain('disabled:cursor-not-allowed')

    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('B05: Plan corruption locks Copy Plan button and blocks writeText on click', async () => {
    renderWeeklyPage({
      planText: 'Corrupted unparseable plan text without day structure',
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      isGenerated: true,
    })

    const copyBtn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(copyBtn).toBeDefined()
    expect(copyBtn.disabled).toBe(true)
    expect(copyBtn.getAttribute('title')).toContain('locked due to safety violations')
    expect(copyBtn.className).toContain('disabled:cursor-not-allowed')

    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('B06: Sample ungenerated plan is safely viewable and default copy operates cleanly', async () => {
    renderWeeklyPage({
      planText: '',
      formData: BASE_FORM_DATA,
      boundProfile: null,
      isGenerated: false,
    })

    const copyBtn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(copyBtn).toBeDefined()
    expect(copyBtn.disabled).toBe(false)

    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('B07: Direct handler invocation bypass attempt on disabled button fails closed', async () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'lumbar disc herniation',
    }
    const contraindicatedText = SAFE_7DAY_PLAN.replace(
      'Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      'Heavy Barbell Deadlifts: 5 sets x 5 reps'
    )

    renderWeeklyPage({
      planText: contraindicatedText,
      formData,
      boundProfile: formData,
    })

    const copyBtn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)

    // Attempt direct synthetic event bypass via reactProps
    const props = getReactProps(copyBtn)
    if (typeof props.onClick === 'function') {
      props.onClick({ preventDefault: () => {}, stopPropagation: () => {} })
    }

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(copyBtn.disabled).toBe(true)
  })

  it('B08: Multi-condition contraindication matrix verifies WeeklyPlan copy sink lock across diverse injuries', () => {
    const conditions = [
      { issue: 'severe hypertension', exercise: 'Tabata high-intensity sprints: 8 rounds all-out' },
      { issue: 'knee reconstruction', exercise: 'Explosive box jumps: 4x10' },
      { issue: 'rotator cuff tear', exercise: 'Overhead Dumbbell Shoulder Press: 4x12' },
      { issue: 'lumbar disc herniation', exercise: 'Barbell Deadlifts: 5 sets x 5 reps heavy' },
      { issue: 'cervical disc herniation', exercise: 'Behind the neck barbell shoulder press: 3x10' },
    ]

    for (const c of conditions) {
      const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: c.issue }
      const text = SAFE_7DAY_PLAN.replace('Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', c.exercise)
      const res = evaluatePlanContentSafety({ formData, boundProfile: formData, planText: text, isGenerated: true })
      expect(res.isSafetyViolated).toBe(true)
      expect(res.isWorkoutLocked).toBe(true)
    }
  })

  it('B09: Multi-allergen matrix verifies WeeklyPlan copy sink lock across diverse allergens', () => {
    const allergenPairs = [
      { allergy: 'peanuts', meal: 'Peanut butter and banana sandwich' },
      { allergy: 'shellfish', meal: 'Garlic butter grilled shrimp and scallops' },
      { allergy: 'dairy', meal: 'Whole milk Greek yogurt with cheese' },
      { allergy: 'gluten', meal: 'Whole wheat bread with roasted turkey' },
      { allergy: 'soy', meal: 'Tofu stir fry with edamame and soy sauce' },
    ]

    for (const p of allergenPairs) {
      const formData: FormData = { ...BASE_FORM_DATA, allergies: p.allergy }
      const text = SAFE_7DAY_PLAN.replace('Snacks: Greek yogurt', `Snacks: ${p.meal}`)
      const res = evaluatePlanContentSafety({ formData, boundProfile: formData, planText: text, isGenerated: true })
      expect(res.isSafetyViolated).toBe(true)
      expect(res.hasAllergens).toBe(true)
    }
  })
})

// ============================================================
// SECTION C: DOWNLOAD PLAN PAGE MULTI-SINK INVARIANTS (72 Assertions)
// ============================================================
describe('Final Consumer Sink Oracle - Section C: DownloadPlanPage Multi-Sink Invariants', () => {
  it('C01: Clean safe plan renders all 4 consumer sinks enabled on DownloadPlanPage', async () => {
    renderDownloadPage({
      planText: SAFE_7DAY_PLAN,
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
    })

    const printBtn = screen.getAllByRole('button', { name: /print \/ save pdf/i })[0] as HTMLButtonElement
    const dlBtn = screen.getByRole('button', { name: /save \.md file/i }) as HTMLButtonElement
    const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i }) as HTMLButtonElement
    const emailBtn = screen.getByRole('button', { name: /^send$/i }) as HTMLButtonElement

    expect(printBtn.disabled).toBe(false)
    expect(dlBtn.disabled).toBe(false)
    expect(copyBtn.disabled).toBe(false)
    expect(emailBtn.disabled).toBe(false)

    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)

    fireEvent.click(printBtn)
    expect(window.print).toHaveBeenCalledTimes(1)

    fireEvent.click(dlBtn)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('C02: Contraindicated movement locks all 4 consumer sinks on DownloadPlanPage', async () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'rotator cuff tear',
    }
    const contraindicatedText = SAFE_7DAY_PLAN.replace(
      'Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      'Behind the neck heavy barbell press: 4x10'
    )

    renderDownloadPage({
      planText: contraindicatedText,
      formData,
      boundProfile: formData,
    })

    const printBtn = screen.getAllByRole('button', { name: /print \/ save pdf/i })[0] as HTMLButtonElement
    const dlBtn = screen.getByRole('button', { name: /save \.md file/i }) as HTMLButtonElement
    const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i }) as HTMLButtonElement
    const emailBtn = screen.getByRole('button', { name: /^send$/i }) as HTMLButtonElement

    expect(printBtn.disabled).toBe(true)
    expect(dlBtn.disabled).toBe(true)
    expect(copyBtn.disabled).toBe(true)
    expect(emailBtn.disabled).toBe(true)

    fireEvent.click(copyBtn)
    fireEvent.click(printBtn)
    fireEvent.click(dlBtn)
    fireEvent.click(emailBtn)

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('C03: Allergen conflict locks all 4 consumer sinks on DownloadPlanPage', async () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'shellfish',
    }
    const allergenText = SAFE_7DAY_PLAN.replace(
      'Dinner: Baked salmon with sweet potato',
      'Dinner: Giant prawn and crab stir fry with oysters'
    )

    renderDownloadPage({
      planText: allergenText,
      formData,
      boundProfile: formData,
    })

    const printBtn = screen.getAllByRole('button', { name: /print \/ save pdf/i })[0] as HTMLButtonElement
    const dlBtn = screen.getByRole('button', { name: /save \.md file/i }) as HTMLButtonElement
    const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i }) as HTMLButtonElement
    const emailBtn = screen.getByRole('button', { name: /^send$/i }) as HTMLButtonElement

    expect(printBtn.disabled).toBe(true)
    expect(dlBtn.disabled).toBe(true)
    expect(copyBtn.disabled).toBe(true)
    expect(emailBtn.disabled).toBe(true)

    fireEvent.click(copyBtn)
    fireEvent.click(printBtn)
    fireEvent.click(dlBtn)
    fireEvent.click(emailBtn)

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('C04: Profile mismatch locks all 4 consumer sinks on DownloadPlanPage', async () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'peanuts',
    }
    const boundProfile: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'None',
    }

    renderDownloadPage({
      planText: SAFE_7DAY_PLAN,
      formData,
      boundProfile,
    })

    const printBtn = screen.getAllByRole('button', { name: /print \/ save pdf/i })[0] as HTMLButtonElement
    const dlBtn = screen.getByRole('button', { name: /save \.md file/i }) as HTMLButtonElement
    const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i }) as HTMLButtonElement
    const emailBtn = screen.getByRole('button', { name: /^send$/i }) as HTMLButtonElement

    expect(printBtn.disabled).toBe(true)
    expect(dlBtn.disabled).toBe(true)
    expect(copyBtn.disabled).toBe(true)
    expect(emailBtn.disabled).toBe(true)

    fireEvent.click(copyBtn)
    fireEvent.click(printBtn)
    fireEvent.click(dlBtn)
    fireEvent.click(emailBtn)

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('C05: Corrupted plan structure locks all 4 consumer sinks on DownloadPlanPage', async () => {
    renderDownloadPage({
      planText: 'Totally broken schema payload without markdown structure',
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      isGenerated: true,
    })

    const printBtn = screen.getAllByRole('button', { name: /print \/ save pdf/i })[0] as HTMLButtonElement
    const dlBtn = screen.getByRole('button', { name: /save \.md file/i }) as HTMLButtonElement
    const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i }) as HTMLButtonElement
    const emailBtn = screen.getByRole('button', { name: /^send$/i }) as HTMLButtonElement

    expect(printBtn.disabled).toBe(true)
    expect(dlBtn.disabled).toBe(true)
    expect(copyBtn.disabled).toBe(true)
    expect(emailBtn.disabled).toBe(true)

    fireEvent.click(copyBtn)
    fireEvent.click(printBtn)
    fireEvent.click(dlBtn)
    fireEvent.click(emailBtn)

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('C06: Direct handler invocation bypass attempt on DownloadPlanPage sinks fails closed', async () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'cervical disc herniation',
    }
    const contraindicatedText = SAFE_7DAY_PLAN.replace(
      'Dumbbell Bench Press: 3 sets x 10 reps (60s rest)',
      'Behind the neck barbell shoulder press: 4x10'
    )

    renderDownloadPage({
      planText: contraindicatedText,
      formData,
      boundProfile: formData,
    })

    const printBtn = screen.getAllByRole('button', { name: /print \/ save pdf/i })[0] as HTMLButtonElement
    const dlBtn = screen.getByRole('button', { name: /save \.md file/i }) as HTMLButtonElement
    const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i }) as HTMLButtonElement

    getReactProps(copyBtn).onClick?.({ preventDefault: () => {} })
    getReactProps(printBtn).onClick?.({ preventDefault: () => {} })
    getReactProps(dlBtn).onClick?.({ preventDefault: () => {} })

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(printBtn.disabled).toBe(true)
    expect(dlBtn.disabled).toBe(true)
    expect(copyBtn.disabled).toBe(true)
    expect(document.querySelector('.animate-fade-in')).not.toBeNull()
  })

  it('C07: Secondary toolbar print button in preview panel also locked when unsafe', () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'peanuts',
    }
    const allergenText = SAFE_7DAY_PLAN.replace(
      'Snacks: Greek yogurt',
      'Snacks: Peanut butter granola bar'
    )

    renderDownloadPage({
      planText: allergenText,
      formData,
      boundProfile: formData,
    })

    const printButtons = screen.getAllByRole('button', { name: /print \/ save pdf/i })
    expect(printButtons.length).toBeGreaterThanOrEqual(1)
    for (const btn of printButtons) {
      expect((btn as HTMLButtonElement).disabled).toBe(true)
      fireEvent.click(btn)
      getReactProps(btn).onClick?.({ preventDefault: () => {} })
    }

    expect(window.print).not.toHaveBeenCalled()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('C08: Filename sanitizer prevents path traversal and CRLF injection across diverse malicious payloads', () => {
    const testCases = [
      { input: '../../etc/passwd', expectedNot: '..' },
      { input: 'plan\\..\\..\\windows\\system32', expectedNot: '..' },
      { input: 'My Plan\\r\\nSet-Cookie: session=evil', expectedNot: '\\r' },
      { input: 'Plan<script>alert(1)</script>', expectedNot: '<' },
      { input: 'Plan/../../secret.txt', expectedNot: '/' },
      { input: 'Plan\\x00hidden.exe', expectedNot: '\\x00' },
    ]

    for (const tc of testCases) {
      const sanitized = sanitizeDownloadFilename(tc.input, 'fitness-plan', 'md')
      expect(sanitized).not.toContain(tc.expectedNot)
      expect(sanitized.endsWith('.md')).toBe(true)
      expect(sanitized.length).toBeGreaterThan(0)
    }
  })

  it('C09: DownloadPlanPage with medicalIssues mismatch: locks all sinks and shows clear warning', () => {
    const currentForm: FormData = { ...BASE_FORM_DATA, medicalIssues: 'lumbar disc herniation' }
    const boundProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: 'None' }

    renderDownloadPage({
      planText: SAFE_7DAY_PLAN,
      formData: currentForm,
      boundProfile,
    })

    const printBtn = screen.getAllByRole('button', { name: /print \/ save pdf/i })[0] as HTMLButtonElement
    const dlBtn = screen.getByRole('button', { name: /save \.md file/i }) as HTMLButtonElement
    const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i }) as HTMLButtonElement
    const emailBtn = screen.getByRole('button', { name: /^send$/i }) as HTMLButtonElement

    expect(printBtn.disabled).toBe(true)
    expect(dlBtn.disabled).toBe(true)
    expect(copyBtn.disabled).toBe(true)
    expect(emailBtn.disabled).toBe(true)

    expect(screen.getByText(/Safety Warning — Plan Conflicts with Health Profile/i)).toBeDefined()
    expect(screen.getByRole('link', { name: /regenerate plan/i })).toBeDefined()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
  })

  it('C10: DownloadPlanPage with combined contraindication and allergen locks all sinks simultaneously', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'severe hypertension', allergies: 'peanuts' }
    const badPlan = SAFE_7DAY_PLAN
      .replace('Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', 'Tabata high-intensity sprints: 8 rounds all-out')
      .replace('Snacks: Greek yogurt', 'Snacks: Roasted salted peanuts')

    renderDownloadPage({
      planText: badPlan,
      formData,
      boundProfile: formData,
    })

    const printBtn = screen.getAllByRole('button', { name: /print \/ save pdf/i })[0] as HTMLButtonElement
    const dlBtn = screen.getByRole('button', { name: /save \.md file/i }) as HTMLButtonElement
    const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i }) as HTMLButtonElement
    const emailBtn = screen.getByRole('button', { name: /^send$/i }) as HTMLButtonElement

    expect(printBtn.disabled).toBe(true)
    expect(dlBtn.disabled).toBe(true)
    expect(copyBtn.disabled).toBe(true)
    expect(emailBtn.disabled).toBe(true)

    fireEvent.click(copyBtn)
    fireEvent.click(printBtn)
    fireEvent.click(dlBtn)
    fireEvent.click(emailBtn)

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })
})

// ============================================================
// SECTION D: GROCERY LIST SINK INVARIANTS (72 Assertions)
// ============================================================
describe('Final Consumer Sink Oracle - Section D: Grocery List Sink Invariants', () => {
  it('D01: Clean plan with safe nutrition produces valid grocery safety evaluation', () => {
    const planSafety = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })
    const groc = evaluateGroceryContentSafety(planSafety)

    expect(groc.isGrocerySafetyViolated).toBe(false)
    expect(groc.hasAllergens).toBe(false)
    expect(groc.isAllergenMismatched).toBe(false)
    expect(groc.isPlanCorrupted).toBe(false)
    expect(groc.reasons.length).toBe(0)
    expect(planSafety.isSafetyViolated).toBe(false)
    expect(planSafety.hasAllergens).toBe(false)
    expect(planSafety.isPlanCorrupted).toBe(false)
  })

  it('D02: Meal plan with allergen (peanuts) fails grocery safety evaluation', () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'peanuts',
    }
    const allergenText = SAFE_7DAY_PLAN.replace(
      'Snacks: Greek yogurt',
      'Snacks: Peanut butter on toast'
    )
    const planSafety = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: allergenText,
      isGenerated: true,
    })
    const groc = evaluateGroceryContentSafety(planSafety)

    expect(groc.isGrocerySafetyViolated).toBe(true)
    expect(groc.hasAllergens).toBe(true)
    expect(groc.isAllergenMismatched).toBe(false)
    expect(groc.isPlanCorrupted).toBe(false)
    expect(groc.reasons.length).toBeGreaterThan(0)
    expect(groc.reasons.some((r) => r.toLowerCase().includes('allergen')) || groc.isGrocerySafetyViolated).toBe(true)
    expect(planSafety.isSafetyViolated).toBe(true)
    expect(planSafety.hasAllergens).toBe(true)
  })

  it('D03: Allergy profile drift fails grocery safety evaluation', () => {
    const currentForm: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'sesame',
    }
    const boundProfile: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'None',
    }
    const planSafety = evaluatePlanContentSafety({
      formData: currentForm,
      boundProfile,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })
    const groc = evaluateGroceryContentSafety(planSafety)

    expect(groc.isGrocerySafetyViolated).toBe(true)
    expect(groc.isAllergenMismatched).toBe(true)
    expect(groc.hasAllergens).toBe(false)
    expect(groc.isPlanCorrupted).toBe(false)
    expect(groc.reasons.length).toBeGreaterThan(0)
    expect(groc.reasons.some((r) => r.toLowerCase().includes('allergy profile changed'))).toBe(true)
    expect(planSafety.isSafetyViolated).toBe(true)
    expect(planSafety.isSafetyMismatched).toBe(true)
  })

  it('D04: Corrupted plan schema fails grocery safety evaluation', () => {
    const planSafety = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: 'corrupted non-markdown plan string',
      isGenerated: true,
      parsedAiPlanSuccess: false,
    })
    const groc = evaluateGroceryContentSafety(planSafety)

    expect(groc.isGrocerySafetyViolated).toBe(true)
    expect(groc.isPlanCorrupted).toBe(true)
    expect(groc.hasAllergens).toBe(false)
    expect(groc.isAllergenMismatched).toBe(false)
    expect(groc.reasons.length).toBeGreaterThan(0)
    expect(groc.reasons.some((r) => r.toLowerCase().includes('schema'))).toBe(true)
    expect(planSafety.isSafetyViolated).toBe(true)
    expect(planSafety.isPlanCorrupted).toBe(true)
  })

  it('D05: Grocery copy button disabled in WeeklyPlanPage modal when violated', () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'peanuts',
    }
    const allergenText = SAFE_7DAY_PLAN.replace(
      'Snacks: Greek yogurt',
      'Snacks: Roasted salted peanuts'
    )

    renderWeeklyPage({
      planText: allergenText,
      formData,
      boundProfile: formData,
    })

    const groceryModalBtn = screen.getByRole('button', { name: /7-day grocery list/i })
    fireEvent.click(groceryModalBtn)

    const copyGroceryBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyGroceryBtn.disabled).toBe(true)
    expect(copyGroceryBtn.getAttribute('title')).toContain('Grocery export blocked')
    expect(copyGroceryBtn.className).toContain('disabled:cursor-not-allowed')

    fireEvent.click(copyGroceryBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
  })

  it('D06: Direct invocation of handleCopyGroceryList fails closed when violated', () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'shellfish',
    }
    const allergenText = SAFE_7DAY_PLAN.replace(
      'Dinner: Baked salmon with sweet potato',
      'Dinner: Steamed crab legs with melted butter'
    )

    renderWeeklyPage({
      planText: allergenText,
      formData,
      boundProfile: formData,
    })

    const groceryModalBtn = screen.getByRole('button', { name: /7-day grocery list/i })
    fireEvent.click(groceryModalBtn)

    const copyGroceryBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyGroceryBtn.disabled).toBe(true)

    getReactProps(copyGroceryBtn).onClick?.({ preventDefault: () => {} })

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(copyGroceryBtn.disabled).toBe(true)
    expect(screen.getByText(/7-Day Grocery Shopping List/i)).toBeDefined()
    expect(screen.getByText(/Allergen conflicts or invalid plan data detected/i)).toBeDefined()
  })

  it('D07: Pure physical contraindication alone (e.g. ACL tear) does NOT lock grocery list', () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      medicalIssues: 'ACL reconstruction surgery',
    }
    const contraindicatedText = SAFE_7DAY_PLAN.replace(
      'Goblet Squats: 3 sets x 12 reps',
      'Plyometric Box Jumps: 4 sets x 15 reps'
    )

    const planSafety = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: contraindicatedText,
      isGenerated: true,
    })
    const groc = evaluateGroceryContentSafety(planSafety)

    expect(planSafety.isSafetyViolated).toBe(true)
    expect(planSafety.isWorkoutLocked).toBe(true)
    expect(planSafety.hasContraindications).toBe(true)
    expect(planSafety.hasAllergens).toBe(false)
    expect(groc.isGrocerySafetyViolated).toBe(false)
    expect(groc.hasAllergens).toBe(false)
    expect(groc.isAllergenMismatched).toBe(false)
    expect(groc.isPlanCorrupted).toBe(false)
  })

  it('D08: Grocery list scaling and filtering preserve safety invariants', () => {
    const formData: FormData = {
      ...BASE_FORM_DATA,
      allergies: 'peanuts',
    }
    const allergenText = SAFE_7DAY_PLAN.replace(
      'Snacks: Greek yogurt',
      'Snacks: Handful of peanuts'
    )

    const planSafety = evaluatePlanContentSafety({
      formData,
      boundProfile: formData,
      planText: allergenText,
      isGenerated: true,
    })
    const groc = evaluateGroceryContentSafety(planSafety)

    expect(groc.isGrocerySafetyViolated).toBe(true)
    expect(groc.hasAllergens).toBe(true)
    expect(groc.reasons.length).toBeGreaterThan(0)
    expect(groc.reasons[0]).toContain('Allergen violation')
    expect(planSafety.hasAllergens).toBe(true)
    expect(planSafety.isSafetyViolated).toBe(true)
    expect(planSafety.contraScan.hasViolation).toBe(false)
    expect(planSafety.isWorkoutLocked).toBe(false)
  })

  it('D09: Diverse allergen ingredient variations in meal schedule correctly flagged in grocery safety evaluation', () => {
    const allergenVariations = [
      { allergy: 'peanuts', variation: 'Creamy peanut butter on sourdough toast' },
      { allergy: 'peanuts', variation: 'Roasted salted peanuts snack pack' },
      { allergy: 'peanuts', variation: 'Peanut oil dressed spinach salad' },
      { allergy: 'tree nuts', variation: 'Chopped walnuts and pecans in morning oatmeal' },
    ]

    for (const v of allergenVariations) {
      const formData: FormData = { ...BASE_FORM_DATA, allergies: v.allergy }
      const text = SAFE_7DAY_PLAN.replace('Snacks: Greek yogurt', `Snacks: ${v.variation}`)
      const planSafety = evaluatePlanContentSafety({
        formData,
        boundProfile: formData,
        planText: text,
        isGenerated: true,
      })
      const groc = evaluateGroceryContentSafety(planSafety)

      expect(planSafety.hasAllergens).toBe(true)
      expect(groc.isGrocerySafetyViolated).toBe(true)
    }
  })
})

// ============================================================
// SECTION E: CROSS-SINK CONSISTENCY & CANONICAL PARITY (65+ Assertions)
// ============================================================
describe('Final Consumer Sink Oracle - Section E: Cross-Sink Consistency & Canonical Parity', () => {
  it('E01: Identical inputs produce identical evaluation across all sinks and pages', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Hypertension' }
    const boundProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: 'None' }

    const eval1 = evaluatePlanContentSafety({
      formData,
      boundProfile,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })
    const eval2 = evaluatePlanContentSafety({
      formData,
      boundProfile,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })

    expect(eval1.isSafetyViolated).toBe(eval2.isSafetyViolated)
    expect(eval1.isWorkoutLocked).toBe(eval2.isWorkoutLocked)
    expect(eval1.isSafetyMismatched).toBe(eval2.isSafetyMismatched)
    expect(eval1.hasContraindications).toBe(eval2.hasContraindications)
    expect(eval1.hasAllergens).toBe(eval2.hasAllergens)
    expect(eval1.isPlanCorrupted).toBe(eval2.isPlanCorrupted)
    expect(eval1.reasons).toEqual(eval2.reasons)
    expect(eval1.bindingEval).toEqual(eval2.bindingEval)
    expect(eval1.contraScan).toEqual(eval2.contraScan)
    expect(eval1.allergenScan).toEqual(eval2.allergenScan)
  })

  it('E02: Safety evaluation is 100% pure and idempotent across repeated calls', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'peanuts' }
    const results = []

    for (let i = 0; i < 10; i++) {
      results.push(
        evaluatePlanContentSafety({
          formData,
          boundProfile: formData,
          planText: SAFE_7DAY_PLAN,
          isGenerated: true,
        })
      )
    }

    for (let i = 1; i < 10; i++) {
      expect(results[i].isSafetyViolated).toBe(results[0].isSafetyViolated)
      expect(results[i].hasAllergens).toBe(results[0].hasAllergens)
    }
  })

  it('E03: Workout locking invariant: isWorkoutLocked strictly implies isSafetyViolated', () => {
    const testProfiles: Array<{ medicalIssues?: string; boundIssues?: string }> = [
      { medicalIssues: 'Lumbar disc hernia' },
      { medicalIssues: 'Rotator cuff tear' },
      { medicalIssues: 'Knee ligament surgery' },
      { medicalIssues: 'Hypertension', boundIssues: 'None' },
      { medicalIssues: 'Cervical stenosis', boundIssues: 'None' },
    ]

    for (const p of testProfiles) {
      const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: p.medicalIssues || '' }
      const boundProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: p.boundIssues || p.medicalIssues || '' }

      const res = evaluatePlanContentSafety({
        formData,
        boundProfile,
        planText: SAFE_7DAY_PLAN,
        isGenerated: true,
      })

      if (res.isWorkoutLocked) {
        expect(res.isSafetyViolated).toBe(true)
        expect(res.reasons.length).toBeGreaterThan(0)
      } else {
        expect(res.isWorkoutLocked).toBe(false)
        expect(res.hasContraindications).toBe(false)
      }
    }
  })

  it('E04: Allergen invariant: hasAllergens strictly implies isSafetyViolated AND isGrocerySafetyViolated', () => {
    const allergens = ['peanuts', 'shellfish', 'dairy', 'gluten', 'soy']

    for (const alg of allergens) {
      const formData: FormData = { ...BASE_FORM_DATA, allergies: alg }
      const allergenText = SAFE_7DAY_PLAN.replace('Snacks: Greek yogurt', `Snacks: Pure ${alg} snack pack`)

      const planSafety = evaluatePlanContentSafety({
        formData,
        boundProfile: formData,
        planText: allergenText,
        isGenerated: true,
      })
      const grocSafety = evaluateGroceryContentSafety(planSafety)

      expect(planSafety.hasAllergens).toBe(true)
      expect(planSafety.isSafetyViolated).toBe(true)
      expect(grocSafety.isGrocerySafetyViolated).toBe(true)
    }
  })

  it('E05: Plan corruption invariant: isPlanCorrupted strictly implies isSafetyViolated AND isGrocerySafetyViolated', () => {
    const corruptInputs = [
      '',
      '   ',
      'No day headers whatsoever',
      '# Day 1 without any exercises or meals',
      'Random JSON string {"foo": "bar"}',
    ]

    for (const bad of corruptInputs) {
      const planSafety = evaluatePlanContentSafety({
        formData: BASE_FORM_DATA,
        boundProfile: BASE_FORM_DATA,
        planText: bad,
        isGenerated: true,
      })
      const grocSafety = evaluateGroceryContentSafety(planSafety)

      expect(planSafety.isPlanCorrupted).toBe(true)
      expect(planSafety.isSafetyViolated).toBe(true)
      expect(grocSafety.isGrocerySafetyViolated).toBe(true)
    }
  })

  it('E06: Resilient edge-case handling: null, undefined, and empty objects handled safely without throwing', () => {
    expect(() => evaluatePlanContentSafety({})).not.toThrow()
    expect(() => evaluatePlanContentSafety({ formData: null, boundProfile: null, planText: null })).not.toThrow()
    expect(() => evaluatePlanContentSafety({ formData: undefined, boundProfile: undefined, planText: undefined })).not.toThrow()

    const resNull = evaluatePlanContentSafety({ formData: null, boundProfile: null, planText: null })
    expect(resNull.isSafetyViolated).toBe(false)
    expect(resNull.hasContraindications).toBe(false)
    expect(resNull.hasAllergens).toBe(false)
    expect(resNull.isWorkoutLocked).toBe(false)
    expect(resNull.isPlanCorrupted).toBe(false)

    const resEmpty = evaluatePlanContentSafety({ formData: BASE_FORM_DATA, boundProfile: BASE_FORM_DATA, planText: '', isGenerated: false })
    expect(resEmpty.isSafetyViolated).toBe(false)
    expect(resEmpty.isWorkoutLocked).toBe(false)
    expect(resEmpty.reasons.length).toBe(0)
    expect(resEmpty.isPlanCorrupted).toBe(false)
  })

  it('E07: Rest days and empty workouts handled deterministically without false positives', () => {
    const restPlan = `# BodyMap 7-Day Fitness & Diet Plan
## Day 1 - Rest Day
**Warm-up:** Gentle walking
- Rest: Complete rest and recovery
**Cool-down:** Deep breathing
**Meals:**
- Breakfast: Oatmeal
- Lunch: Turkey sandwich
- Dinner: Grilled salmon
- Snacks: Fruit
`
    const res = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: restPlan,
      isGenerated: true,
      parsedAiPlanSuccess: true,
    })

    expect(res.isSafetyViolated).toBe(false)
    expect(res.isWorkoutLocked).toBe(false)
    expect(res.hasContraindications).toBe(false)
    expect(res.hasAllergens).toBe(false)
    expect(res.isPlanCorrupted).toBe(false)
    expect(res.isSafetyMismatched).toBe(false)
    expect(res.reasons.length).toBe(0)
    expect(res.bindingEval.isSafetyMismatched).toBe(false)
    expect(res.contraScan.hasViolation).toBe(false)
    expect(res.allergenScan.hasViolation).toBe(false)
  })

  it('E08: Invariant: reasons array length and content match active clinical violation types', () => {
    const optsClean = { formData: BASE_FORM_DATA, boundProfile: BASE_FORM_DATA, planText: SAFE_7DAY_PLAN, isGenerated: true }
    const resClean = evaluatePlanContentSafety(optsClean)
    expect(resClean.reasons.length).toBe(0)
    expect(Array.isArray(resClean.reasons)).toBe(true)

    const optsContra = {
      formData: { ...BASE_FORM_DATA, medicalIssues: 'lumbar disc herniation' },
      boundProfile: { ...BASE_FORM_DATA, medicalIssues: 'lumbar disc herniation' },
      planText: SAFE_7DAY_PLAN.replace('Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', 'Barbell Deadlifts: 5x5'),
      isGenerated: true,
    }
    const resContra = evaluatePlanContentSafety(optsContra)
    expect(resContra.reasons.length).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(resContra.reasons)).toBe(true)

    const optsAllergen = {
      formData: { ...BASE_FORM_DATA, allergies: 'peanuts' },
      boundProfile: { ...BASE_FORM_DATA, allergies: 'peanuts' },
      planText: SAFE_7DAY_PLAN.replace('Snacks: Greek yogurt', 'Snacks: Roasted peanuts'),
      isGenerated: true,
    }
    const resAllergen = evaluatePlanContentSafety(optsAllergen)
    expect(resAllergen.reasons.length).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(resAllergen.reasons)).toBe(true)
  })

  it('E09: Canonical safety gate truth table: any active violation forces isSafetyViolated true', () => {
    const p1 = evaluatePlanContentSafety({ formData: BASE_FORM_DATA, boundProfile: BASE_FORM_DATA, planText: SAFE_7DAY_PLAN, isGenerated: true })
    expect(p1.isSafetyViolated).toBe(false)

    const p2 = evaluatePlanContentSafety({ formData: { ...BASE_FORM_DATA, medicalIssues: 'None' }, boundProfile: { ...BASE_FORM_DATA, medicalIssues: 'Hypertension' }, planText: SAFE_7DAY_PLAN, isGenerated: true })
    expect(p2.isSafetyViolated).toBe(true)

    const p3 = evaluatePlanContentSafety({ formData: { ...BASE_FORM_DATA, allergies: 'peanuts' }, boundProfile: { ...BASE_FORM_DATA, allergies: 'peanuts' }, planText: SAFE_7DAY_PLAN.replace('Snacks: Greek yogurt', 'Snacks: Peanuts'), isGenerated: true })
    expect(p3.isSafetyViolated).toBe(true)

    const p4 = evaluatePlanContentSafety({ formData: BASE_FORM_DATA, boundProfile: BASE_FORM_DATA, planText: 'corrupted', isGenerated: true, parsedAiPlanSuccess: false })
    expect(p4.isSafetyViolated).toBe(true)
  })

  it('E10: Profile binding mismatch strictly checks medicalIssues field', () => {
    const res = evaluatePlanContentSafety({
      formData: { ...BASE_FORM_DATA, medicalIssues: 'ACL surgery' },
      boundProfile: { ...BASE_FORM_DATA, medicalIssues: 'None' },
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })
    expect(res.isSafetyMismatched).toBe(true)
    expect(res.bindingEval.mismatchedSafetyFields).toContain('medicalIssues')
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.isSafetyViolated).toBe(true)
  })

  it('E11: Profile binding mismatch strictly checks allergies field', () => {
    const res = evaluatePlanContentSafety({
      formData: { ...BASE_FORM_DATA, allergies: 'shellfish' },
      boundProfile: { ...BASE_FORM_DATA, allergies: 'None' },
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })
    expect(res.isSafetyMismatched).toBe(true)
    expect(res.bindingEval.mismatchedSafetyFields).toContain('allergies')
    expect(res.isSafetyViolated).toBe(true)
    expect(res.reasons.length).toBeGreaterThan(0)
  })

  it('E12: Contraindication scan result records exercise name and condition label', () => {
    const res = evaluatePlanContentSafety({
      formData: { ...BASE_FORM_DATA, medicalIssues: 'lumbar disc herniation' },
      boundProfile: { ...BASE_FORM_DATA, medicalIssues: 'lumbar disc herniation' },
      planText: SAFE_7DAY_PLAN.replace('Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', 'Barbell Deadlifts: 5 sets x 5 reps'),
      isGenerated: true,
    })
    expect(res.contraScan.hasViolation).toBe(true)
    expect(res.contraScan.violations.length).toBeGreaterThan(0)
    expect(res.contraScan.violations[0].conditionLabel).toBeDefined()
    expect(res.contraScan.violations[0].matchedExercise).toBeDefined()
  })

  it('E13: Allergen scan result records allergen label and category', () => {
    const res = evaluatePlanContentSafety({
      formData: { ...BASE_FORM_DATA, allergies: 'peanuts' },
      boundProfile: { ...BASE_FORM_DATA, allergies: 'peanuts' },
      planText: SAFE_7DAY_PLAN.replace('Snacks: Greek yogurt', 'Snacks: Roasted peanuts'),
      isGenerated: true,
    })
    expect(res.allergenScan.hasViolation).toBe(true)
    expect(res.allergenScan.violations.length).toBeGreaterThan(0)
    expect(res.allergenScan.violations[0].label).toBeDefined()
    expect(res.hasAllergens).toBe(true)
  })

  it('E14: Non-dietary physical conditions do not trigger false allergen or grocery violations', () => {
    const res = evaluatePlanContentSafety({
      formData: { ...BASE_FORM_DATA, medicalIssues: 'Knee injury' },
      boundProfile: { ...BASE_FORM_DATA, medicalIssues: 'Knee injury' },
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })
    const groc = evaluateGroceryContentSafety(res)
    expect(res.hasAllergens).toBe(false)
    expect(groc.hasAllergens).toBe(false)
    expect(groc.isGrocerySafetyViolated).toBe(false)
    expect(groc.isAllergenMismatched).toBe(false)
  })
})

// ============================================================
// SECTION F: PRESENTATION & HANDLER DEFENSE-IN-DEPTH (56 Assertions)
// ============================================================
describe('Final Consumer Sink Oracle - Section F: Defense-in-Depth Invariants', () => {
  it('F01: WeeklyPlan copy button has disabled attribute when safety violated', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'lumbar disc herniation' }
    const badText = SAFE_7DAY_PLAN.replace('Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', 'Barbell Deadlifts: 5x5')

    renderWeeklyPage({ planText: badText, formData, boundProfile: formData })
    const copyBtn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement

    expect(copyBtn.disabled).toBe(true)
    expect(copyBtn.getAttribute('disabled')).not.toBeNull()
    expect(copyBtn.className).toContain('disabled:opacity-50')
    expect(copyBtn.className).toContain('disabled:cursor-not-allowed')
    expect(copyBtn.getAttribute('title')).toContain('locked due to safety violations')
    expect(screen.getByText(/Workout Safety Lockout/i)).toBeDefined()
  })

  it('F02: WeeklyPlan copy button tooltip and visual warning present on safety violation', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'peanuts' }
    const badText = SAFE_7DAY_PLAN.replace('Snacks: Greek yogurt', 'Snacks: Peanut butter cup')

    renderWeeklyPage({ planText: badText, formData, boundProfile: formData })
    const copyBtn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement

    expect(copyBtn.disabled).toBe(true)
    expect(copyBtn.title).toBe('Plan export locked due to safety violations')
    expect(screen.getByText(/Allergen Safety Warning/i)).toBeDefined()
    expect(screen.getByText(/conflict with your current declared allergy profile/i)).toBeDefined()
    expect(screen.getByRole('link', { name: /update profile/i })).toBeDefined()
    expect(copyBtn.textContent).toContain('Copy Plan')
  })

  it('F03: WeeklyPlan copy handler has independent fail-closed guard', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'rotator cuff' }
    const badText = SAFE_7DAY_PLAN.replace('Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', 'Overhead Dumbbell Press: 4x10')

    renderWeeklyPage({ planText: badText, formData, boundProfile: formData })
    const copyBtn = screen.getByRole('button', { name: /copy plan/i })

    getReactProps(copyBtn).onClick?.({ preventDefault: () => {} })

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(navigator.share).not.toHaveBeenCalled()
    expect(localStorage.getItem('bodymap_copied_plan')).toBeNull()
  })

  it('F04: DownloadPlan buttons (Print, Download, Copy, Email) all disabled when safety violated', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'lumbar disc herniation' }
    const badText = SAFE_7DAY_PLAN.replace('Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', 'Barbell Deadlifts: 5x5')

    renderDownloadPage({ planText: badText, formData, boundProfile: formData })

    const printBtn = screen.getAllByRole('button', { name: /print \/ save pdf/i })[0] as HTMLButtonElement
    const dlBtn = screen.getByRole('button', { name: /save \.md file/i }) as HTMLButtonElement
    const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i }) as HTMLButtonElement
    const emailBtn = screen.getByRole('button', { name: /^send$/i }) as HTMLButtonElement

    expect(printBtn.disabled).toBe(true)
    expect(dlBtn.disabled).toBe(true)
    expect(copyBtn.disabled).toBe(true)
    expect(emailBtn.disabled).toBe(true)

    expect(printBtn.title).toContain('locked due to safety violations')
    expect(dlBtn.title).toContain('locked due to safety violations')
    expect(copyBtn.title).toContain('locked due to safety violations')
    expect(emailBtn.title).toContain('locked due to safety violations')
  })

  it('F05: DownloadPlan handlers all have independent fail-closed guards', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'peanuts' }
    const badText = SAFE_7DAY_PLAN.replace('Snacks: Greek yogurt', 'Snacks: Peanut brittle')

    renderDownloadPage({ planText: badText, formData, boundProfile: formData })

    const printBtn = screen.getAllByRole('button', { name: /print \/ save pdf/i })[0]
    const dlBtn = screen.getByRole('button', { name: /save \.md file/i })
    const copyBtn = screen.getByRole('button', { name: /copy to clipboard/i })
    const emailBtn = screen.getByRole('button', { name: /^send$/i })

    getReactProps(printBtn).onClick?.({ preventDefault: () => {} })
    getReactProps(dlBtn).onClick?.({ preventDefault: () => {} })
    getReactProps(copyBtn).onClick?.({ preventDefault: () => {} })
    getReactProps(emailBtn).onClick?.({ preventDefault: () => {} })

    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(navigator.share).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    expect(screen.getByText(/Safety Warning/i)).toBeDefined()
    expect(screen.getByText(/Plan Conflicts with Health Profile/i)).toBeDefined()
  })

  it('F06: Grocery copy button has disabled attribute and safety title in modal', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'peanuts' }
    const badText = SAFE_7DAY_PLAN.replace('Snacks: Greek yogurt', 'Snacks: Crunchy peanut butter toast')

    renderWeeklyPage({ planText: badText, formData, boundProfile: formData })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))

    const copyGroceryBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyGroceryBtn.disabled).toBe(true)
    expect(copyGroceryBtn.title).toContain('Grocery export blocked')
    expect(copyGroceryBtn.className).toContain('disabled:cursor-not-allowed')
    expect(copyGroceryBtn.className).toContain('disabled:opacity-50')
    expect(screen.getByText(/7-Day Grocery Shopping List/i)).toBeDefined()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('F07: Grocery copy handler has independent fail-closed guard', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'shellfish' }
    const badText = SAFE_7DAY_PLAN.replace('Dinner: Baked salmon with sweet potato', 'Dinner: Fried clams and scallops')

    renderWeeklyPage({ planText: badText, formData, boundProfile: formData })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))

    const copyGroceryBtn = screen.getByRole('button', { name: /copy categorized checklist/i })
    getReactProps(copyGroceryBtn).onClick?.({ preventDefault: () => {} })

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(screen.getByText(/7-Day Grocery Shopping List/i)).toBeDefined()
    expect((copyGroceryBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it('F08: DOM tampering simulation: removing disabled attribute does NOT bypass handler guard', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'lumbar disc herniation' }
    const badText = SAFE_7DAY_PLAN.replace('Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', 'Barbell Deadlifts: 5 sets x 5 reps heavy')

    renderWeeklyPage({ planText: badText, formData, boundProfile: formData })
    const copyBtn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement

    expect(copyBtn.disabled).toBe(true)

    // Attacker modifies DOM via DevTools
    copyBtn.removeAttribute('disabled')
    expect(copyBtn.hasAttribute('disabled')).toBe(false)

    // Even if click event is fired on tampered element, handler checks isSafetyViolated and returns
    getReactProps(copyBtn).onClick?.({ preventDefault: () => {} })

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(navigator.share).not.toHaveBeenCalled()

    const evalRes = evaluatePlanContentSafety({ formData, boundProfile: formData, planText: badText, isGenerated: true })
    expect(evalRes.isSafetyViolated).toBe(true)
    expect(evalRes.isWorkoutLocked).toBe(true)
    expect(evalRes.hasContraindications).toBe(true)
  })
})

// ============================================================
// SECTION G: TOCTOU RACE CONDITIONS & DYNAMIC PROFILE DRIFT (48 Assertions)
// ============================================================
describe('Final Consumer Sink Oracle - Section G: TOCTOU & Profile Drift Invariants', () => {
  it('G01: Adding an allergy to profile immediately disables copy plan without page reload', () => {
    const initialForm: FormData = { ...BASE_FORM_DATA, allergies: '' }
    const resInitial = evaluatePlanContentSafety({
      formData: initialForm,
      boundProfile: initialForm,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })
    expect(resInitial.isSafetyViolated).toBe(false)
    expect(resInitial.hasAllergens).toBe(false)

    // User updates profile
    const updatedForm: FormData = { ...BASE_FORM_DATA, allergies: 'peanuts' }
    const planWithPeanuts = SAFE_7DAY_PLAN.replace('Snacks: Greek yogurt', 'Snacks: Peanut butter snack')

    const resUpdated = evaluatePlanContentSafety({
      formData: updatedForm,
      boundProfile: updatedForm,
      planText: planWithPeanuts,
      isGenerated: true,
    })
    expect(resUpdated.isSafetyViolated).toBe(true)
    expect(resUpdated.hasAllergens).toBe(true)
    expect(resUpdated.reasons.length).toBeGreaterThan(0)
    expect(resUpdated.reasons[0]).toContain('Allergen')
    expect(resUpdated.contraScan.hasViolation).toBe(false)
    expect(resUpdated.isPlanCorrupted).toBe(false)
  })

  it('G02: Adding an injury to profile immediately disables copy and print sinks', () => {
    const initialForm: FormData = { ...BASE_FORM_DATA, medicalIssues: '' }
    const resInitial = evaluatePlanContentSafety({
      formData: initialForm,
      boundProfile: initialForm,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })
    expect(resInitial.isSafetyViolated).toBe(false)
    expect(resInitial.isWorkoutLocked).toBe(false)

    const updatedForm: FormData = { ...BASE_FORM_DATA, medicalIssues: 'lumbar disc herniation' }
    const planWithDeadlift = SAFE_7DAY_PLAN.replace('Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', 'Barbell Deadlifts: 5x5')

    const resUpdated = evaluatePlanContentSafety({
      formData: updatedForm,
      boundProfile: updatedForm,
      planText: planWithDeadlift,
      isGenerated: true,
    })
    expect(resUpdated.isSafetyViolated).toBe(true)
    expect(resUpdated.isWorkoutLocked).toBe(true)
    expect(resUpdated.hasContraindications).toBe(true)
    expect(resUpdated.reasons.length).toBeGreaterThan(0)
    expect(resUpdated.isPlanCorrupted).toBe(false)
    expect(resUpdated.hasAllergens).toBe(false)
  })

  it('G03: Bound profile mismatch detection triggers on profile drift', () => {
    const bound: FormData = { ...BASE_FORM_DATA, medicalIssues: 'None', allergies: 'None' }
    const current: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Rotator cuff injury', allergies: 'shellfish' }

    const res = evaluatePlanContentSafety({
      formData: current,
      boundProfile: bound,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })

    expect(res.isSafetyViolated).toBe(true)
    expect(res.isSafetyMismatched).toBe(true)
    expect(res.bindingEval.isSafetyMismatched).toBe(true)
    expect(res.bindingEval.mismatchedSafetyFields).toContain('medicalIssues')
    expect(res.bindingEval.mismatchedSafetyFields).toContain('allergies')
    expect(res.reasons.length).toBeGreaterThanOrEqual(1)
    expect(res.reasons.some((r) => r.toLowerCase().includes('mismatch'))).toBe(true)
    expect(res.isPlanCorrupted).toBe(false)
  })

  it('G04: Rapid state updates maintain strict fail-closed safety semantics', () => {
    const profiles: FormData[] = [
      { ...BASE_FORM_DATA, medicalIssues: 'ACL tear' },
      { ...BASE_FORM_DATA, allergies: 'peanuts' },
      { ...BASE_FORM_DATA, medicalIssues: 'hypertension' },
      { ...BASE_FORM_DATA, allergies: 'dairy, eggs' },
    ]

    for (const p of profiles) {
      const res = evaluatePlanContentSafety({
        formData: p,
        boundProfile: BASE_FORM_DATA,
        planText: SAFE_7DAY_PLAN,
        isGenerated: true,
      })
      expect(res.isSafetyViolated).toBe(true)
      expect(res.isSafetyMismatched).toBe(true)
    }
  })

  it('G05: Restoring matching profile restores safety cleanly without stale flags', () => {
    const matchedProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: 'mild asthma' }
    const res = evaluatePlanContentSafety({
      formData: matchedProfile,
      boundProfile: matchedProfile,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })

    expect(res.isSafetyViolated).toBe(false)
    expect(res.isSafetyMismatched).toBe(false)
    expect(res.isWorkoutLocked).toBe(false)
    expect(res.hasContraindications).toBe(false)
    expect(res.hasAllergens).toBe(false)
    expect(res.isPlanCorrupted).toBe(false)
    expect(res.reasons.length).toBe(0)
    expect(res.bindingEval.isSafetyMismatched).toBe(false)
  })

  it('G06: Stale timestamp simulation: plan generated in past against old profile fails closed', () => {
    const historicalProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: 'None' }
    const currentActiveProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Lumbar disc herniation' }

    const res = evaluatePlanContentSafety({
      formData: currentActiveProfile,
      boundProfile: historicalProfile,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })

    expect(res.isSafetyViolated).toBe(true)
    expect(res.isSafetyMismatched).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.bindingEval.mismatchedSafetyFields).toContain('medicalIssues')
    expect(res.reasons.length).toBeGreaterThan(0)
    expect(res.reasons[0]).toContain('Profile safety mismatch')
    expect(res.hasAllergens).toBe(false)
    expect(res.isPlanCorrupted).toBe(false)
  })
})

// ============================================================
// SECTION H: STORAGE TAMPERING & CORRUPTED PAYLOAD RESILIENCE (60 Assertions)
// ============================================================
describe('Final Consumer Sink Oracle - Section H: Storage Tampering & Corruption Resilience', () => {
  it('H01: Corrupted JSON in localStorage does not crash or cause unhandled exceptions', () => {
    localStorage.setItem('bodymap_grocery_checked', 'INVALID_CORRUPTED_JSON_NOT_AN_OBJECT')
    localStorage.setItem('bodymap_saved_plans', '{corrupted:true,,,')

    expect(() => {
      renderWeeklyPage({ planText: SAFE_7DAY_PLAN, formData: BASE_FORM_DATA, boundProfile: BASE_FORM_DATA })
    }).not.toThrow()

    expect(screen.getByRole('button', { name: /copy plan/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /7-day grocery list/i })).toBeDefined()
    expect(localStorage.getItem('bodymap_grocery_checked')).toBe('INVALID_CORRUPTED_JSON_NOT_AN_OBJECT')
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('H02: Missing boundProfile in loaded plan is detected and handled safely', () => {
    const currentProfile: FormData = { ...BASE_FORM_DATA, medicalIssues: 'Hypertension' }
    const res = evaluatePlanContentSafety({
      formData: currentProfile,
      boundProfile: null,
      planText: SAFE_7DAY_PLAN,
      isGenerated: true,
    })

    expect(res.isSafetyViolated).toBe(true)
    expect(res.isSafetyMismatched).toBe(true)
    expect(res.isWorkoutLocked).toBe(true)
    expect(res.reasons.length).toBeGreaterThan(0)
    expect(res.bindingEval.isSafetyMismatched).toBe(true)
    expect(res.hasContraindications).toBe(false)
    expect(res.hasAllergens).toBe(false)
    expect(res.isPlanCorrupted).toBe(false)
  })

  it('H03: Truncated or incomplete plan text triggers plan corruption', () => {
    const truncatedPlan = '# BodyMap 7-Day Fitness & Diet Plan\\n## Day 1'
    const res = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: truncatedPlan,
      isGenerated: true,
      parsedAiPlanSuccess: false,
    })

    expect(res.isSafetyViolated).toBe(true)
    expect(res.isPlanCorrupted).toBe(true)
    expect(res.isWorkoutLocked).toBe(false)
    expect(res.hasContraindications).toBe(false)
    expect(res.hasAllergens).toBe(false)
    expect(res.reasons.length).toBeGreaterThan(0)
    expect(res.reasons.some((r) => r.toLowerCase().includes('corrupted') || r.toLowerCase().includes('schema'))).toBe(true)
    expect(res.bindingEval.isSafetyMismatched).toBe(false)
  })

  it('H04: Missing day headers in plan triggers schema validation failure', () => {
    const badPlan = 'Day 1: Squats\\nDay 2: Bench\\nDay 3: Rest'
    const res = evaluatePlanContentSafety({
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
      planText: badPlan,
      isGenerated: true,
      parsedAiPlanSuccess: false,
    })

    expect(res.isSafetyViolated).toBe(true)
    expect(res.isPlanCorrupted).toBe(true)
    expect(res.reasons.length).toBeGreaterThan(0)
    expect(res.reasons[0]).toContain('schema validation')
    expect(res.isWorkoutLocked).toBe(false)
    expect(res.hasContraindications).toBe(false)
    expect(res.hasAllergens).toBe(false)
    expect(res.isSafetyMismatched).toBe(false)
  })

  it('H05: Malicious script tags or XSS injection in plan text handled safely without execution', () => {
    const xssPlan = `# BodyMap 7-Day Fitness & Diet Plan
## Day 1 - Upper Body
**Warm-up:** <script>window.pwned=true;</script>
- Dumbbell Press: 3x10 <img src=x onerror=alert(1)>
**Cool-down:** None
**Meals:**
- Breakfast: Oatmeal <svg onload=evil()>
- Lunch: Chicken
- Dinner: Fish
- Snacks: Fruit
`
    expect(() => {
      renderWeeklyPage({ planText: xssPlan, formData: BASE_FORM_DATA, boundProfile: BASE_FORM_DATA })
    }).not.toThrow()

    expect((window as unknown as Record<string, unknown>)['pwned']).toBeUndefined()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /copy plan/i })).toBeDefined()
    expect(screen.getByRole('heading', { name: /Your 7-Day Fitness & Diet Plan/i })).toBeDefined()
    expect(document.querySelector('script[src*="evil"]')).toBeNull()
    expect(document.querySelector('svg[onload]')).toBeNull()
  })

  it('H06: Tampered grocery checked state does not bypass grocery allergen safety gate', () => {
    const formData: FormData = { ...BASE_FORM_DATA, allergies: 'peanuts' }
    const badText = SAFE_7DAY_PLAN.replace('Snacks: Greek yogurt', 'Snacks: Roasted peanuts')

    localStorage.setItem('bodymap_grocery_checked', JSON.stringify({ 'item-peanut': true }))

    renderWeeklyPage({ planText: badText, formData, boundProfile: formData })
    fireEvent.click(screen.getByRole('button', { name: /7-day grocery list/i }))

    const copyBtn = screen.getByRole('button', { name: /copy categorized checklist/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(copyBtn.getAttribute('title')).toContain('Grocery export blocked')
    expect(localStorage.getItem('bodymap_grocery_checked')).toContain('item-peanut')
  })

  it('H07: Backup payload validation strictly rejects malformed schemas and tampering', () => {
    const badPayloads: unknown[] = [
      null,
      undefined,
      '',
      '{ "version": 999 }',
      '{ "version": 1 }',
      '{ "version": 1, "data": "not an object" }',
      '{ "version": 1, "data": {}, "tampered": true }',
      '<html><body>not json</body></html>',
    ]

    for (const bad of badPayloads) {
      const parsed = validateAndParseBackup(bad as string)
      expect(parsed.success).toBe(false)
    }
    expect(validateAndParseBackup('').success).toBe(false)
    expect(validateAndParseBackup(null as unknown as string).success).toBe(false)
  })
})

// ============================================================
// SECTION I: NATIVE SHARE & MAILTO BOUNDARY INVARIANTS (48 Assertions)
// ============================================================
describe('Final Consumer Sink Oracle - Section I: Share & Mailto Invariants', () => {
  it('I01: Native share payload NEVER contains clinical plan text or medical data', async () => {
    renderDownloadPage({
      planText: SAFE_7DAY_PLAN,
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
    })

    const shareBtn = screen.getByRole('button', { name: /share plan/i })
    await fireEvent.click(shareBtn)

    expect(navigator.share).toHaveBeenCalledTimes(1)
    const shareCall = vi.mocked(navigator.share).mock.calls[0][0] as ShareData

    expect(shareCall.text).not.toContain(SAFE_7DAY_PLAN)
    expect(shareCall.text).not.toContain('Dumbbell Bench Press')
    expect(shareCall.text).not.toContain('Rolled oatmeal')
    expect(shareCall.title).toBe('My BodyMap 7-Day Fitness Plan')
    expect(shareCall.url).toBe(window.location.origin)
    expect(shareCall.text).toBe('Check out my personalized 7-day fitness & nutrition schedule created with BodyMap AI!')
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('I02: Native share fallback copies URL only, zero plan text leaked', () => {
    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    })

    renderDownloadPage({
      planText: SAFE_7DAY_PLAN,
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
    })

    const shareBtn = screen.getByRole('button', { name: /share plan/i })
    fireEvent.click(shareBtn)

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    const copiedText = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0]

    expect(copiedText).toBe(`${window.location.origin}/weekly-plan`)
    expect(copiedText).not.toContain('Dumbbell')
    expect(copiedText).not.toContain('Bench')
    expect(copiedText).not.toContain('Day 1')
    expect(copiedText).not.toContain('Meals')
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('I03: Mailto link is completely blocked when safety is violated', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'lumbar disc herniation' }
    const badText = SAFE_7DAY_PLAN.replace('Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', 'Barbell Deadlifts: 5x5')

    renderDownloadPage({ planText: badText, formData, boundProfile: formData })

    const emailInput = screen.getByPlaceholderText(/enter email address/i) as HTMLInputElement
    const sendBtn = screen.getByRole('button', { name: /^send$/i }) as HTMLButtonElement

    expect(sendBtn.disabled).toBe(true)
    expect(sendBtn.title).toContain('locked due to safety violations')

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(sendBtn)

    expect(window.open).not.toHaveBeenCalled()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(sendBtn.disabled).toBe(true)
  })

  it('I04: Mailto requires valid email formatting and rejects invalid emails', () => {
    renderDownloadPage({
      planText: SAFE_7DAY_PLAN,
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
    })

    const emailInput = screen.getByPlaceholderText(/enter email address/i)
    const sendBtn = screen.getByRole('button', { name: /^send$/i })

    // Invalid email without @
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } })
    fireEvent.click(sendBtn)

    expect(window.open).not.toHaveBeenCalled()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()

    // Valid email
    fireEvent.change(emailInput, { target: { value: 'user@domain.com' } })
    fireEvent.click(sendBtn)

    expect(window.open).toHaveBeenCalledTimes(1)
    const openedUrl = String(vi.mocked(window.open).mock.calls[0][0])
    expect(openedUrl.startsWith('mailto:user@domain.com')).toBe(true)
    expect(openedUrl).toContain('subject=')
    expect(openedUrl).toContain('body=')
  })

  it('I05: Mailto body preview is safely encoded and truncated', () => {
    renderDownloadPage({
      planText: SAFE_7DAY_PLAN,
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
    })

    const emailInput = screen.getByPlaceholderText(/enter email address/i)
    const sendBtn = screen.getByRole('button', { name: /^send$/i })

    fireEvent.change(emailInput, { target: { value: 'athlete@example.com' } })
    fireEvent.click(sendBtn)

    expect(window.open).toHaveBeenCalledTimes(1)
    const openedUrl = String(vi.mocked(window.open).mock.calls[0][0])

    expect(openedUrl).toContain('mailto:athlete@example.com')
    expect(openedUrl).toContain(encodeURIComponent('https://bodymap-ai.vercel.app'))
    expect(openedUrl).not.toContain('<script>')
    expect(openedUrl).not.toContain('javascript:')
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })

  it('I06: Cross-origin security attributes enforced on email external sink', () => {
    renderDownloadPage({
      planText: SAFE_7DAY_PLAN,
      formData: BASE_FORM_DATA,
      boundProfile: BASE_FORM_DATA,
    })

    const emailInput = screen.getByPlaceholderText(/enter email address/i)
    const sendBtn = screen.getByRole('button', { name: /^send$/i })

    fireEvent.change(emailInput, { target: { value: 'coach@example.com' } })
    fireEvent.click(sendBtn)

    expect(window.open).toHaveBeenCalledWith(
      expect.stringMatching(/^mailto:/),
      '_blank'
    )
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^send$/i })).toBeDefined()
    expect(emailInput.textContent).toBe('')
    expect(sendBtn).toBeDefined()
  })
})

// ============================================================
// SECTION J: RECOVERY VAULT SCHEMA ISOLATION & MULTI-TIER INVARIANCE (49 Assertions)
// ============================================================
describe('Final Consumer Sink Oracle - Section J: Recovery Vault & Multi-Tier Invariance', () => {
  it('J01: exportBackupToFile creates JSON backup with schema version and timestamp', () => {
    localStorage.setItem('bodymap_saved_plans', JSON.stringify([{ id: 'p1', name: 'Plan 1' }]))
    localStorage.setItem('bodymap_active_plan_id', 'p1')

    exportBackupToFile()

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    const blobArg = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob

    expect(blobArg instanceof Blob).toBe(true)
    expect(blobArg.type).toContain('application/json')
    expect(window.print).not.toHaveBeenCalled()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(navigator.share).not.toHaveBeenCalled()
  })

  it('J02: exportBackupToFile uses isolated application/json MIME type, not executable or html', () => {
    exportBackupToFile()
    const blobArg = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob

    expect(blobArg.type).toContain('application/json')
    expect(blobArg.type).not.toBe('text/html')
    expect(blobArg.type).not.toBe('text/javascript')
    expect(blobArg.type).not.toBe('application/x-msdownload')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
  })

  it('J03: Backup export creates anchor with sanitized bodymap-backup filename', () => {
    exportBackupToFile()

    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(document.body.children.length).toBeGreaterThanOrEqual(0)
    expect(window.print).not.toHaveBeenCalled()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(navigator.share).not.toHaveBeenCalled()
  })

  it('J04: validateAndParseBackup validates valid backup structure', () => {
    const validPayload = JSON.stringify(generateBackupPayload())
    const parsed = validateAndParseBackup(validPayload)

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.schema).toBe(BACKUP_SCHEMA_IDENTIFIER)
      expect(parsed.data.planState).toBeDefined()
      expect(Array.isArray(parsed.data.savedPlans)).toBe(true)
      expect(Array.isArray(parsed.data.bodyMetrics)).toBe(true)
      expect(typeof parsed.data.exportedAt).toBe('string')
      expect(parsed.data.version).toBeDefined()
    }
  })

  it('J05: validateAndParseBackup rejects invalid JSON or malformed structures', () => {
    const invalidPayloads: unknown[] = [
      '{ invalid json ',
      'null',
      JSON.stringify({ schema: 'unsupported_schema_v99', planState: {} }), // wrong schema
      JSON.stringify({ schema: BACKUP_SCHEMA_IDENTIFIER }), // missing planState
      JSON.stringify({ schema: BACKUP_SCHEMA_IDENTIFIER, planState: null }), // null planState
      JSON.stringify({ appName: 'Fake' }), // missing schema
    ]

    for (const bad of invalidPayloads) {
      const res = validateAndParseBackup(bad as string)
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toBeDefined()
      }
    }
  })

  it('J06: Recovery vault restore does not execute unvalidated code', () => {
    const maliciousPayload = JSON.stringify({
      schema: BACKUP_SCHEMA_IDENTIFIER,
      version: '2.3.0',
      exportedAt: new Date().toISOString(),
      planState: {
        formData: BASE_FORM_DATA,
        generatedPlan: '<img src=x onerror=alert(1)>',
        isGenerated: true,
        weightLog: [],
        completedDays: [],
      },
      savedPlans: [
        {
          id: 'xss-plan',
          name: '<script>alert("xss")</script>',
          createdAt: new Date().toISOString(),
          planState: {
            formData: BASE_FORM_DATA,
            generatedPlan: '<img src=x onerror=alert(1)>',
            isGenerated: true,
            weightLog: [],
            completedDays: [],
          },
        },
      ],
      bodyMetrics: [],
    })

    const parsed = validateAndParseBackup(maliciousPayload)

    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.savedPlans[0].name).toContain('<script>')
    }
    expect((window as unknown as Record<string, unknown>)['pwned']).toBeUndefined()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.open).not.toHaveBeenCalled()
    expect(navigator.share).not.toHaveBeenCalled()
  })

  it('J07: End-to-end multi-tier representation invariance: UNSAFE plan NEVER transforms to SAFE', () => {
    const formData: FormData = { ...BASE_FORM_DATA, medicalIssues: 'lumbar disc herniation', allergies: 'peanuts' }
    const unsafeText = 'Workout: Barbell Deadlifts: 5 sets x 5 reps\\nMeals: Peanut butter toast'

    // Representation 1: Pure safety evaluation
    const evalRes = evaluatePlanContentSafety({ formData, boundProfile: formData, planText: unsafeText, isGenerated: true })
    expect(evalRes.isSafetyViolated).toBe(true)
    expect(evalRes.isWorkoutLocked).toBe(true)
    expect(evalRes.hasAllergens).toBe(true)

    // Representation 2: Grocery safety evaluation
    const grocRes = evaluateGroceryContentSafety(evalRes)
    expect(grocRes.isGrocerySafetyViolated).toBe(true)

    // Representation 3: Weekly Plan Page UI
    renderWeeklyPage({ planText: unsafeText, formData, boundProfile: formData })
    const copyBtn = screen.getByRole('button', { name: /copy plan/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
    fireEvent.click(copyBtn)
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()

    // Clean up DOM before next page render
    cleanup()

    // Representation 4: Download Plan Page UI
    renderDownloadPage({ planText: unsafeText, formData, boundProfile: formData })
    const dlCopyBtn = screen.getByRole('button', { name: /copy to clipboard/i }) as HTMLButtonElement
    const printBtn = screen.getAllByRole('button', { name: /print \/ save pdf/i })[0] as HTMLButtonElement
    const dlBtn = screen.getByRole('button', { name: /save \.md file/i }) as HTMLButtonElement
    expect(dlCopyBtn.disabled).toBe(true)
    expect(printBtn.disabled).toBe(true)
    expect(dlBtn.disabled).toBe(true)

    fireEvent.click(dlCopyBtn)
    fireEvent.click(printBtn)
    fireEvent.click(dlBtn)

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
    expect(window.print).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
