import { describe, it, expect } from 'vitest'
import {
  getActiveAllergenCategories,
  maskNegatedAllergenPhrases,
  scanMealTextForAllergens,
  scanPlanForAllergens,
} from '../lib/allergenGuard'
import { findMealAlternatives } from '../lib/nutritionAlternatives'

describe('Allergen Guard: Taxonomy & Category Activation', () => {
  it('correctly maps single and multiple allergy inputs to standard allergen category keys', () => {
    expect(getActiveAllergenCategories('peanut')).toEqual(['peanut'])
    expect(getActiveAllergenCategories('peanuts, tree nuts, dairy')).toEqual(['peanut', 'tree_nut', 'dairy'])
    expect(getActiveAllergenCategories('celiac / gluten intolerance')).toEqual(['gluten_wheat'])
    expect(getActiveAllergenCategories('egg and shellfish allergy')).toEqual(['egg', 'shellfish'])
    expect(getActiveAllergenCategories('sesame seeds and soy')).toEqual(['soy', 'sesame'])
    expect(getActiveAllergenCategories('lactose intolerance / whey')).toEqual(['dairy'])
  })

  it('returns empty array for negative or missing allergy inputs', () => {
    expect(getActiveAllergenCategories('')).toEqual([])
    expect(getActiveAllergenCategories('none')).toEqual([])
    expect(getActiveAllergenCategories('None')).toEqual([])
    expect(getActiveAllergenCategories('N/A')).toEqual([])
    expect(getActiveAllergenCategories('no')).toEqual([])
    expect(getActiveAllergenCategories('none stated')).toEqual([])
    expect(getActiveAllergenCategories('nothing')).toEqual([])
    expect(getActiveAllergenCategories(undefined)).toEqual([])
  })
})

describe('Allergen Guard: Negation Masking & False-Positive Avoidance', () => {
  it('masks parenthetical clearance phrases like (nut-free), (dairy-free)', () => {
    const masked = maskNegatedAllergenPhrases('Tofu scramble with nutritional yeast (contains no dairy or eggs)')
    expect(masked).toContain('[CLEARED_DISCLAIMER]')
    expect(masked).not.toContain('contains no dairy or eggs')
  })

  it('masks compound negation phrases like "without peanuts or tree nuts"', () => {
    const masked = maskNegatedAllergenPhrases('Salad with olive oil, chickpeas, without peanuts or shellfish.')
    expect(masked).toContain('[CLEARED_NEGATION]')
  })

  it('avoids false positives on peanut-free and nut-free items', () => {
    const resPeanut = scanMealTextForAllergens('Peanut-free sunflower seed butter on toast', ['peanut'])
    expect(resPeanut.hasViolation).toBe(false)

    const resDairy = scanMealTextForAllergens('Plant-based dairy-free coconut yogurt with blueberries', ['dairy'])
    expect(resDairy.hasViolation).toBe(false)

    const resGluten = scanMealTextForAllergens('Gluten-free oats with almond milk and honey', ['gluten_wheat'])
    expect(resGluten.hasViolation).toBe(false)
  })
})

describe('Allergen Guard: True Positive Detection Across All 9 Major Allergen Classes', () => {
  it('detects peanut violations (peanut butter, peanut oil, groundnuts)', () => {
    const res = scanMealTextForAllergens('Oatmeal topped with 1 tbsp natural peanut butter (350 kcal)', ['peanut'])
    expect(res.hasViolation).toBe(true)
    expect(res.violations[0].category).toBe('peanut')
    expect(res.violations[0].label).toBe('Peanuts')
  })

  it('detects tree nut violations (almonds, walnuts, cashews, pistachios)', () => {
    const res = scanMealTextForAllergens('Greek yogurt parfait with mixed berries and raw almonds', ['tree_nut'])
    expect(res.hasViolation).toBe(true)
    expect(res.violations[0].category).toBe('tree_nut')
    expect(res.violations[0].label).toBe('Tree Nuts')
  })

  it('detects dairy violations (whey protein, whole milk, cottage cheese, greek yogurt, butter)', () => {
    const resWhey = scanMealTextForAllergens('Post-workout whey protein shake with whole milk', ['dairy'])
    expect(resWhey.hasViolation).toBe(true)
    expect(resWhey.violations[0].category).toBe('dairy')

    const resCottage = scanMealTextForAllergens('Snack: Cottage cheese with pineapple slices', ['dairy'])
    expect(resCottage.hasViolation).toBe(true)
  })

  it('detects egg violations (scrambled eggs, egg whites, omelet, mayo)', () => {
    const res = scanMealTextForAllergens('3 whole scrambled eggs with toast', ['egg'])
    expect(res.hasViolation).toBe(true)
    expect(res.violations[0].category).toBe('egg')
  })

  it('detects soy violations (tofu, soy sauce, edamame, tempeh, miso)', () => {
    const res = scanMealTextForAllergens('Stir-fried tofu with soy sauce and jasmine rice', ['soy'])
    expect(res.hasViolation).toBe(true)
    expect(res.violations[0].category).toBe('soy')
  })

  it('detects wheat/gluten violations (whole wheat pasta, bread, toast, seitan)', () => {
    const res = scanMealTextForAllergens('Whole wheat pasta with lean ground turkey', ['gluten_wheat'])
    expect(res.hasViolation).toBe(true)
    expect(res.violations[0].category).toBe('gluten_wheat')
  })

  it('detects fish violations (salmon, tuna, cod, tilapia)', () => {
    const res = scanMealTextForAllergens('Grilled salmon fillet with brown rice and asparagus', ['fish'])
    expect(res.hasViolation).toBe(true)
    expect(res.violations[0].category).toBe('fish')
  })

  it('detects shellfish violations (shrimp, prawns, crab, lobster, scallops)', () => {
    const res = scanMealTextForAllergens('Shrimp salad with avocado and olive oil', ['shellfish'])
    expect(res.hasViolation).toBe(true)
    expect(res.violations[0].category).toBe('shellfish')
  })

  it('detects sesame violations (sesame oil, tahini dressing)', () => {
    const res = scanMealTextForAllergens('Hummus bowl with tahini dressing and cucumber', ['sesame'])
    expect(res.hasViolation).toBe(true)
    expect(res.violations[0].category).toBe('sesame')
  })
})

describe('Allergen Guard: Plan-Level Scanning', () => {
  const mockPlanWithAllergen = `## Day 1 - Strength
**Warm-up:** 5 mins jogging
**Main Workout:**
- Push-ups: 3 sets x 10 reps
**Meals:**
- Breakfast: Oatmeal with almond butter and banana
- Lunch: Grilled chicken breast with brown rice
- Dinner: Baked salmon with broccoli
- Snacks: Apple slices

## Day 2 - Cardio
**Warm-up:** 5 mins jumping jacks
**Main Workout:**
- Bodyweight squats: 3 sets x 15 reps
**Meals:**
- Breakfast: Scrambled eggs on toast
- Lunch: Turkey wrap with avocado
- Dinner: Grilled steak with sweet potato
- Snacks: Mixed raw walnuts
`

  it('identifies tree nut violations in multi-day plan markdown', () => {
    const scanResult = scanPlanForAllergens(mockPlanWithAllergen, 'tree nuts, almonds, walnuts')
    expect(scanResult.hasViolation).toBe(true)
    expect(scanResult.violations.length).toBeGreaterThanOrEqual(2)
    expect(scanResult.violations.some(v => v.matchedTerm.toLowerCase().includes('almond'))).toBe(true)
    expect(scanResult.violations.some(v => v.matchedTerm.toLowerCase().includes('walnut'))).toBe(true)
  })

  it('passes cleanly for non-matching allergy profile', () => {
    const scanResult = scanPlanForAllergens(mockPlanWithAllergen, 'shellfish')
    expect(scanResult.hasViolation).toBe(false)
    expect(scanResult.violations.length).toBe(0)
  })
})

describe('Allergen Guard: Protein Swap & Nutrition Alternatives Filtering', () => {
  it('filters out dairy-containing alternatives when user has dairy allergy', () => {
    const alts = findMealAlternatives('yogurt parfait', 'all', 'dairy')
    expect(alts.some(a => a.id === 'sub_cottage_cheese_snack')).toBe(false)
    expect(alts.some(a => a.id === 'sub_whey_pudding')).toBe(false)
    expect(alts.some(a => a.id === 'sub_soy_skyr')).toBe(true)
  })

  it('filters out soy-containing alternatives when user has soy allergy', () => {
    const alts = findMealAlternatives('chicken breast', 'all', 'soy')
    expect(alts.some(a => a.id === 'sub_tofu')).toBe(false)
    expect(alts.some(a => a.id === 'sub_tempeh')).toBe(false)
    expect(alts.some(a => a.id === 'sub_turkey')).toBe(true)
  })

  it('filters out egg-containing alternatives when user has egg allergy', () => {
    const alts = findMealAlternatives('chicken breast', 'all', 'eggs')
    expect(alts.some(a => a.id === 'sub_egg_whites')).toBe(false)
  })

  it('filters out fish-containing alternatives when user has fish allergy', () => {
    const alts = findMealAlternatives('chicken breast', 'all', 'salmon, fish')
    expect(alts.some(a => a.id === 'sub_salmon')).toBe(false)
  })
})
