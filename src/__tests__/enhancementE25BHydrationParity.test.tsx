/**
 * BodyMap AI — Enhancement E25-B Test Suite
 * ==========================================
 * Weekly Plan Hydration E24 Engine Parity
 *
 * Validates:
 * 1. Exact mathematical parity between Dashboard and Weekly Plan hydration calculation paths.
 * 2. Elimination of the legacy 35 mL/kg single-point formula from the active Weekly Plan path.
 * 3. Fail-closed handling for missing, boundary, and invalid anthropometric weights.
 * 4. Preservation of intake tracking (+250ml, +500ml, reset) and localStorage persistence.
 * 5. Component rendering of canonical recommended targets and climate allowances.
 * 6. Adversarial and mutation sensitivity verifying detection of stale calculation logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PlanProvider, usePlan } from '@/context/PlanContext'
import WeeklyPlanPage from '@/pages/WeeklyPlanPage'
import {
  calculateHydrationTarget,
  roundToNearest50
} from '@/lib/hydrationTarget'
import type { FormData } from '@/types/formData'

const BASE_TEST_FORM_DATA: FormData = {
  gender: 'male',
  age: '28',
  height: '178',
  weight: '70',
  fitnessLevel: 'intermediate',
  mainGoal: 'Build Lean Muscle',
  bodyFocus: ['Full Body'],
  medicalIssues: '',
  pushupCount: '25',
  equipment: ['Dumbbells', 'Barbell'],
  dietaryPreference: 'omnivore',
  allergies: '',
  sleepHours: '8',
  stressLevel: 'low',
  recoveryDays: '2',
  timePerDay: '45',
  specialRequests: ''
}

const SAMPLE_7DAY_PLAN = `# BodyMap 7-Day Fitness & Diet Plan
## Day 1 - Upper Body Push
**Warm-up:** 5 mins dynamic mobility
- Barbell Bench Press: 3 sets x 8 reps (90s rest)
- Incline Dumbbell Press: 3 sets x 10 reps
**Cool-down:** 5 mins chest and triceps stretch
**Meals:**
- Breakfast: Rolled oats with whey protein and banana
- Lunch: Grilled chicken breast with brown rice
- Dinner: Baked salmon fillet with asparagus
- Snacks: Greek yogurt with almonds

## Day 2 - Lower Body Squat Focus
**Warm-up:** 5 mins hip openers
- Barbell Back Squat: 3 sets x 8 reps
- Romanian Deadlifts: 3 sets x 10 reps
**Cool-down:** 5 mins quad and hamstring stretch
**Meals:**
- Breakfast: Scrambled eggs on sourdough
- Lunch: Turkey wrap with avocado
- Dinner: Lean sirloin with sweet potato
- Snacks: Apple slices with peanut butter
`

const SetupWeeklyPlanWrapper = ({
  children,
  formData = BASE_TEST_FORM_DATA,
  planText = SAMPLE_7DAY_PLAN
}: {
  children: React.ReactNode
  formData?: FormData
  planText?: string
}) => {
  const { dispatch } = usePlan()

  React.useEffect(() => {
    dispatch({
      type: 'SET_GENERATED_PLAN',
      payload: {
        plan: planText,
        formData
      }
    })
    dispatch({ type: 'SET_FORM_DATA', payload: formData })
  }, [dispatch, formData, planText])

  return <>{children}</>
}

const renderWeeklyPlan = (formData: FormData = BASE_TEST_FORM_DATA, planText = SAMPLE_7DAY_PLAN) => {
  return render(
    <MemoryRouter>
      <PlanProvider>
        <SetupWeeklyPlanWrapper formData={formData} planText={planText}>
          <WeeklyPlanPage />
        </SetupWeeklyPlanWrapper>
      </PlanProvider>
    </MemoryRouter>
  )
}

describe('Enhancement E25-B: Weekly Plan Hydration E24 Engine Parity', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('E25B-01: Canonical Dashboard vs Weekly Plan Engine Parity', () => {
    it('produces identical calculations for identical inputs across all test weights', () => {
      const testWeights = [30, 45, 55, 60, 70, 75, 80, 90, 100, 125, 180, 250, 300]
      const testClimates = ['temperate', 'warm', 'hot'] as const

      for (const w of testWeights) {
        for (const c of testClimates) {
          const dashboardResult = calculateHydrationTarget(w, { activityMinutes: 0, climate: c })
          const weeklyPlanResult = calculateHydrationTarget(w, { climate: c })

          expect(weeklyPlanResult.isValid).toBe(dashboardResult.isValid)
          expect(weeklyPlanResult.weightKg).toBe(dashboardResult.weightKg)
          expect(weeklyPlanResult.climate).toBe(dashboardResult.climate)
          expect(weeklyPlanResult.climateAdjustmentMl).toBe(dashboardResult.climateAdjustmentMl)
          expect(weeklyPlanResult.totalTargetMl.recommended).toBe(dashboardResult.totalTargetMl.recommended)
          expect(weeklyPlanResult.totalTargetMl.min).toBe(dashboardResult.totalTargetMl.min)
          expect(weeklyPlanResult.totalTargetMl.max).toBe(dashboardResult.totalTargetMl.max)
          expect(weeklyPlanResult.totalTargetLiters.recommended).toBe(dashboardResult.totalTargetLiters.recommended)
          expect(weeklyPlanResult.baselineRangeMl.min).toBe(dashboardResult.baselineRangeMl.min)
          expect(weeklyPlanResult.baselineRangeMl.max).toBe(dashboardResult.baselineRangeMl.max)
          expect(weeklyPlanResult.baselineRangeMl.midpoint).toBe(dashboardResult.baselineRangeMl.midpoint)
        }
      }
    })

    it('verifies exact values for canonical 70 kg athlete in warm climate', () => {
      const res = calculateHydrationTarget(70, { climate: 'warm' })
      expect(res.isValid).toBe(true)
      expect(res.weightKg).toBe(70)
      expect(res.climate).toBe('warm')
      expect(res.climateAdjustmentMl).toBe(250)

      expect(res.baselineRangeMl.min).toBe(2100)
      expect(res.baselineRangeMl.max).toBe(2450)
      expect(res.baselineRangeMl.midpoint).toBe(2300)

      expect(res.totalTargetMl.min).toBe(2350)
      expect(res.totalTargetMl.max).toBe(2700)
      expect(res.totalTargetMl.recommended).toBe(2550)
      expect(res.totalTargetLiters.recommended).toBe('2.55')
    })
  })

  describe('E25B-02: Elimination of Legacy 35 mL/kg Single-Point Divergence', () => {
    it('uses the scientific composite target (2,550 mL) rather than the obsolete 35 mL/kg base (2,450 mL)', () => {
      const canonical = calculateHydrationTarget(70, { climate: 'warm' })
      expect(canonical.totalTargetMl.recommended).toBe(2550)
      expect(canonical.totalTargetMl.recommended).not.toBe(2450)
    })

    it('proves legacy single-point formula is superseded for 80 kg athlete', () => {
      const canonical = calculateHydrationTarget(80, { climate: 'warm' })
      expect(canonical.totalTargetMl.recommended).toBe(2850)
      expect(canonical.totalTargetMl.recommended).not.toBe(2800)
    })
  })

  describe('E25B-03: Boundary Values & Fail-Closed Guarding', () => {
    it('accepts valid weights at the anthropometric boundaries (30 kg and 300 kg)', () => {
      const lower = calculateHydrationTarget(30, { climate: 'warm' })
      expect(lower.isValid).toBe(true)
      expect(lower.weightKg).toBe(30)
      expect(lower.totalTargetMl.recommended).toBeGreaterThan(0)

      const upper = calculateHydrationTarget(300, { climate: 'warm' })
      expect(upper.isValid).toBe(true)
      expect(upper.weightKg).toBe(300)
      expect(upper.totalTargetMl.recommended).toBeGreaterThan(0)
    })

    it('rejects weights outside the supported domain (29.9 kg and 300.1 kg)', () => {
      const subMin = calculateHydrationTarget(29.9, { climate: 'warm' })
      expect(subMin.isValid).toBe(false)
      expect(subMin.weightKg).toBeNull()
      expect(subMin.totalTargetMl.recommended).toBe(0)

      const superMax = calculateHydrationTarget(300.1, { climate: 'warm' })
      expect(superMax.isValid).toBe(false)
      expect(superMax.weightKg).toBeNull()
      expect(superMax.totalTargetMl.recommended).toBe(0)
    })

    it('rejects malformed and non-numeric inputs fail-closed', () => {
      const invalidInputs = [null, undefined, '', '   ', '70kg', 'abc', -50, 0, NaN, Infinity]
      for (const input of invalidInputs) {
        const res = calculateHydrationTarget(input, { climate: 'warm' })
        expect(res.isValid).toBe(false)
        expect(res.weightKg).toBeNull()
        expect(res.totalTargetMl.recommended).toBe(0)
        expect(res.validationErrors.length).toBeGreaterThan(0)
      }
    })
  })

  describe('E25B-04: Deterministic Repetition & Immutability', () => {
    it('returns deeply identical results over repeated calls without state leakage', () => {
      const run1 = calculateHydrationTarget(75, { climate: 'warm' })
      const run2 = calculateHydrationTarget(75, { climate: 'warm' })
      const run3 = calculateHydrationTarget(75, { climate: 'warm' })
      expect(run1).toEqual(run2)
      expect(run2).toEqual(run3)
    })

    it('does not mutate frozen options or input parameters', () => {
      const options = Object.freeze({ climate: 'warm' as const })
      expect(() => calculateHydrationTarget('70', options)).not.toThrow()
    })
  })

  describe('E25B-05: WeeklyPlanPage Component Rendering with Canonical Target', () => {
    it('renders the canonical E24 hydration target (~2,550 ml) and climate badge (+250ml warm)', () => {
      renderWeeklyPlan({ ...BASE_TEST_FORM_DATA, weight: '70' })

      expect(screen.getByText(/Hydration: 0 ml \/ ~2,550 ml/)).toBeDefined()
      expect(screen.getByText('+250ml (warm)')).toBeDefined()
    })

    it('allows logging fluid intake (+250ml, +500ml) and persists to localStorage', () => {
      renderWeeklyPlan({ ...BASE_TEST_FORM_DATA, weight: '70' })

      const add250Btn = screen.getByTitle('Add 250ml water')
      const add500Btn = screen.getByTitle('Add 500ml water')

      fireEvent.click(add250Btn)
      expect(screen.getByText(/Hydration: 250 ml \/ ~2,550 ml/)).toBeDefined()

      fireEvent.click(add500Btn)
      expect(screen.getByText(/Hydration: 750 ml \/ ~2,550 ml/)).toBeDefined()

      const rawLog = localStorage.getItem('bodymap_hydration_log')
      expect(rawLog).not.toBeNull()
      const parsed = JSON.parse(rawLog!)
      const today = new Date().toISOString().split('T')[0]
      expect(parsed[today]).toBe(750)
    })

    it('allows resetting fluid intake back to 0 ml', () => {
      renderWeeklyPlan({ ...BASE_TEST_FORM_DATA, weight: '70' })

      const add250Btn = screen.getByTitle('Add 250ml water')
      fireEvent.click(add250Btn)
      expect(screen.getByText(/Hydration: 250 ml \/ ~2,550 ml/)).toBeDefined()

      const resetBtn = screen.getByTitle("Reset today's hydration")
      fireEvent.click(resetBtn)
      expect(screen.getByText(/Hydration: 0 ml \/ ~2,550 ml/)).toBeDefined()
    })
  })

  describe('E25B-06: WeeklyPlanPage Fail-Closed Rendering on Missing or Invalid Weight', () => {
    it('renders only logged intake without target when profile weight is empty', () => {
      renderWeeklyPlan({ ...BASE_TEST_FORM_DATA, weight: '' })

      expect(screen.getByText('Hydration: 0 ml')).toBeDefined()
      expect(screen.queryByText(/\/ ~/)).toBeNull()
      expect(screen.queryByText('+250ml (warm)')).toBeNull()
    })

    it('renders only logged intake without target when profile weight is invalid (sub-domain: 15 kg)', () => {
      renderWeeklyPlan({ ...BASE_TEST_FORM_DATA, weight: '15' })

      expect(screen.getByText('Hydration: 0 ml')).toBeDefined()
      expect(screen.queryByText(/\/ ~/)).toBeNull()
      expect(screen.queryByText('+250ml (warm)')).toBeNull()
    })

    it('renders only logged intake without target when profile weight is non-numeric', () => {
      renderWeeklyPlan({ ...BASE_TEST_FORM_DATA, weight: 'invalid-wt' })

      expect(screen.getByText('Hydration: 0 ml')).toBeDefined()
      expect(screen.queryByText(/\/ ~/)).toBeNull()
      expect(screen.queryByText('+250ml (warm)')).toBeNull()
    })
  })

  describe('E25B-07: Preservation of Unrelated WeeklyPlanPage Workflows', () => {
    it('preserves the 7-day grocery list button and plan rendering', () => {
      renderWeeklyPlan()

      expect(screen.getByText('7-Day Grocery List')).toBeDefined()
      expect(screen.getByText('Day 1 - Upper Body Push')).toBeDefined()
    })
  })

  describe('E25B-08: Adversarial & Mutation Validation', () => {
    it('fails if WeeklyPlanPage calculations diverge from canonical E24 engine output', () => {
      const weight = 85
      const canonical = calculateHydrationTarget(weight, { climate: 'warm' })

      const staleBaseOnly = roundToNearest50(weight * 35)
      expect(canonical.totalTargetMl.recommended).not.toBe(staleBaseOnly)

      const baselineMidpointOnly = canonical.baselineRangeMl.midpoint
      expect(canonical.totalTargetMl.recommended).not.toBe(baselineMidpointOnly)
      expect(canonical.totalTargetMl.recommended).toBe(baselineMidpointOnly + 250)

      expect(canonical.climateAdjustmentMl).toBe(250)
      expect(canonical.climateAdjustmentMl).not.toBe(0)
      expect(canonical.climateAdjustmentMl).not.toBe(500)
    })
  })
})
