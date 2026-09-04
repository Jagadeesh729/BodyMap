// offlineFallbackSafety.test.ts
// Audit and regression tests for the complete offline / fallback / error-safety contract.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  scanPlanForAllergens,
  scanMealTextForAllergens,
  getActiveAllergenCategories,
} from '../lib/allergenGuard'
import {
  MOCK_PLAN,
  AllergenSafetyError,
  callGeminiWithFormData,
} from '../lib/gemini'
import { DEFAULT_WEEKLY_PLAN } from '../types/plan'

describe('PHASE 2: MOCK_PLAN & DEFAULT_WEEKLY_PLAN Allergen Falsification', () => {
  it('falsifies MOCK_PLAN safety: proves MOCK_PLAN contains Dairy (Greek yogurt)', () => {
    const scan = scanPlanForAllergens(MOCK_PLAN, 'dairy')
    expect(scan.hasViolation).toBe(true)
    const violatedTerms = scan.violations.map(v => v.matchedTerm.toLowerCase())
    expect(violatedTerms).toContain('greek yogurt')
  })

  it('falsifies MOCK_PLAN safety: proves MOCK_PLAN contains Tree Nuts (almonds)', () => {
    const scan = scanPlanForAllergens(MOCK_PLAN, 'tree nuts')
    expect(scan.hasViolation).toBe(true)
    const violatedTerms = scan.violations.map(v => v.matchedTerm.toLowerCase())
    expect(violatedTerms).toContain('almonds')
  })

  it('falsifies MOCK_PLAN safety: proves MOCK_PLAN contains Fish (salmon)', () => {
    const scan = scanPlanForAllergens(MOCK_PLAN, 'fish')
    expect(scan.hasViolation).toBe(true)
    const violatedTerms = scan.violations.map(v => v.matchedTerm.toLowerCase())
    expect(violatedTerms).toContain('salmon')
  })

  it('proves MOCK_PLAN has no violation when allergies are "None"', () => {
    const scan = scanPlanForAllergens(MOCK_PLAN, 'None')
    expect(scan.hasViolation).toBe(false)
    expect(scan.violations).toHaveLength(0)
  })

  it('falsifies DEFAULT_WEEKLY_PLAN safety across multiple allergen categories', () => {
    const categoriesToTest = ['tree_nut', 'dairy', 'egg', 'fish', 'gluten_wheat', 'soy', 'sesame'] as const
    for (const cat of categoriesToTest) {
      let foundViolation = false
      for (const day of DEFAULT_WEEKLY_PLAN) {
        const mealTexts = [day.meals.breakfast, day.meals.lunch, day.meals.dinner, ...(day.meals.snacks || [])]
        for (const text of mealTexts) {
          const res = scanMealTextForAllergens(text, [cat])
          if (res.hasViolation) {
            foundViolation = true
            break
          }
        }
        if (foundViolation) break
      }
      expect(foundViolation).toBe(true)
    }
  })
})

describe('PHASE 3, 4, 10: Error Contracts (422 vs 502 vs Network vs Timeout)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  const baseFormData = {
    age: '28',
    gender: 'female',
    height: '165',
    weight: '60',
    fitnessLevel: 'intermediate',
    mainGoal: 'muscle',
    bodyFocus: ['Full Body'],
    timePerDay: '45',
    medicalIssues: '',
    equipment: ['Dumbbells'],
    pushupCount: '15',
    dietaryPreference: 'omnivore',
    allergies: 'dairy',
    specialRequests: '',
    recoveryDays: '2',
    sleepHours: '8',
    stressLevel: 'low',
  }

  it('distinguishes HTTP 422 as AllergenSafetyError with status 422', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({
        error: 'ALLERGEN_SAFETY_VIOLATION: Plan could not be made safe',
        allergenCategories: ['Dairy / Milk'],
        requestId: 'req_123',
        executionSource: 'allergen-safety-rejection',
      }),
    }) as unknown as typeof fetch

    await expect(callGeminiWithFormData(baseFormData)).rejects.toThrowError(AllergenSafetyError)
  })

  it('distinguishes HTTP 502 as general API error (not AllergenSafetyError)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => JSON.stringify({ error: 'All models unavailable' }),
    }) as unknown as typeof fetch

    try {
      await callGeminiWithFormData(baseFormData)
      expect.fail('Should have thrown')
    } catch (err: unknown) {
      expect(err).not.toBeInstanceOf(AllergenSafetyError)
      expect((err as Error).message).toContain('API error (502)')
    }
  })

  it('handles network error (connection refused / fetch rejection)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    try {
      await callGeminiWithFormData(baseFormData)
      expect.fail('Should have thrown')
    } catch (err: unknown) {
      expect(err).not.toBeInstanceOf(AllergenSafetyError)
      expect((err as Error).message).toContain('Failed to fetch')
    }
  })

  it('handles timeout error (AbortError / DOMException)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('The operation was aborted'))

    try {
      await callGeminiWithFormData(baseFormData)
      expect.fail('Should have thrown')
    } catch (err: unknown) {
      expect(err).not.toBeInstanceOf(AllergenSafetyError)
      expect((err as Error).message).toContain('aborted')
    }
  })
})

describe('PHASE 7, 8, 9, 13: Deterministic Fallback Decision Logic & Stale Invalidation', () => {
  it('forbids MOCK_PLAN substitution whenever declared allergies conflict with MOCK_PLAN (dairy, tree nuts, fish)', () => {
    const dangerousAllergies = ['dairy', 'tree nuts', 'almonds', 'fish', 'milk, peanuts', 'dairy, tree nuts']
    for (const allergy of dangerousAllergies) {
      const activeCats = getActiveAllergenCategories(allergy)
      const mockScan = scanPlanForAllergens(MOCK_PLAN, allergy)
      const isUnsafe = activeCats.length > 0 && mockScan.hasViolation
      expect(isUnsafe).toBe(true)
    }
  })

  it('allows MOCK_PLAN substitution ONLY for profile with no declared allergies', () => {
    const safeAllergies = ['', 'None', 'none', 'No known allergies']
    for (const allergy of safeAllergies) {
      const activeCats = getActiveAllergenCategories(allergy)
      const mockScan = scanPlanForAllergens(MOCK_PLAN, allergy)
      const isSafeForDemo = activeCats.length === 0 && !mockScan.hasViolation
      expect(isSafeForDemo).toBe(true)
    }
  })

  it('evaluates dynamic allergenScanResult correctly for stale plans in WeeklyPlanPage', () => {
    // Scenario: User generated a plan containing dairy, then later changed profile to Dairy allergy
    const stalePlanContainingDairy = `## Day 1 - Full Body
**Meals:**
- Breakfast: Oatmeal with milk and honey
- Lunch: Grilled chicken salad
- Dinner: Baked chicken breast with rice
- Snacks: Apple slices`

    const scan = scanPlanForAllergens(stalePlanContainingDairy, 'dairy')
    expect(scan.hasViolation).toBe(true)
    expect(scan.violations[0].category).toBe('dairy')
  })

  it('evaluates clean plan as having no violation in WeeklyPlanPage', () => {
    const cleanPlan = `## Day 1 - Full Body
**Meals:**
- Breakfast: Oatmeal with sunflower seed butter and blueberries
- Lunch: Grilled chicken salad with olive oil
- Dinner: Turkey and roasted vegetables
- Snacks: Apple slices`

    const scan = scanPlanForAllergens(cleanPlan, 'dairy, peanuts, tree nuts')
    expect(scan.hasViolation).toBe(false)
  })
})
