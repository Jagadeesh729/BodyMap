import { describe, it, expect } from 'vitest'
import { parseAndValidatePlan, cleanSectionContent, extractDailyCalories } from '../lib/planSchema'
import { MOCK_PLAN, validateGeneratedPlan } from '../lib/gemini'
import { scanPlanForContraindications } from '../lib/contraindicationGuard'
import { scanPlanForAllergens } from '../lib/allergenGuard'

describe('Plan Parsing & UX Contract Remediation Oracle (Defects A, B, C)', () => {
  // ==========================================================================
  // DEFECT A: Warm-up & Cool-down Markdown Normalization
  // ==========================================================================
  describe('Defect A: Markdown Delimiter Normalization', () => {
    it('strips leading markdown asterisks from bold **Warm-up:** source lines', () => {
      const raw = '** 5 mins arm circles, jumping jacks, shoulder mobility'
      expect(cleanSectionContent(raw)).toBe('5 mins arm circles, jumping jacks, shoulder mobility')
    })

    it('strips leading markdown asterisks from bold **Cool-down:** source lines', () => {
      const raw = '** 5 mins chest & tricep static stretching'
      expect(cleanSectionContent(raw)).toBe('5 mins chest & tricep static stretching')
    })

    it('strips markdown bold wrapper around text while preserving internal words', () => {
      const raw = '**5 mins dynamic mobility**'
      expect(cleanSectionContent(raw)).toBe('5 mins dynamic mobility')
    })

    it('strips markdown bold from embedded words without dropping text', () => {
      const raw = '**5 mins** arm circles and **shoulder** mobility'
      expect(cleanSectionContent(raw)).toBe('5 mins arm circles and shoulder mobility')
    })

    it('preserves legitimate internal punctuation (&, commas, hyphens, parentheses)', () => {
      const raw = '** 5-10 mins chest & tricep static stretching (foam rolling)'
      expect(cleanSectionContent(raw)).toBe('5-10 mins chest & tricep static stretching (foam rolling)')
    })

    it('handles leading bullets and hashes cleanly', () => {
      expect(cleanSectionContent('• **5 mins warmup**')).toBe('5 mins warmup')
      expect(cleanSectionContent('### **5 mins mobility**')).toBe('5 mins mobility')
      expect(cleanSectionContent('- 5 mins stretching')).toBe('5 mins stretching')
    })

    it('handles empty and whitespace-only sections safely', () => {
      expect(cleanSectionContent('')).toBeUndefined()
      expect(cleanSectionContent('   ')).toBeUndefined()
      expect(cleanSectionContent('** **')).toBeUndefined()
      expect(cleanSectionContent(undefined)).toBeUndefined()
    })

    it('cleans warm-up and cool-down in full plan parsing without delimiter leakage', () => {
      const planMarkdown = `## Day 1 - Test Routine
**Warm-up:** 5 mins arm circles, jumping jacks, shoulder mobility
**Main Workout:**
- Push-ups: 3 sets x 12 reps
**Cool-down:** 5 mins chest & tricep static stretching
**Meals:**
- Breakfast: Oatmeal (350 kcal)
- Lunch: Salad (450 kcal)
- Dinner: Salmon (500 kcal)
`
      const parsed = parseAndValidatePlan(planMarkdown, false)
      expect(parsed.success).toBe(true)
      if (!parsed.success || !parsed.data) return

      const day1 = parsed.data.days[0]
      expect(day1.workout?.warmup).toBe('5 mins arm circles, jumping jacks, shoulder mobility')
      expect(day1.workout?.warmup.startsWith('**')).toBe(false)
      expect(day1.workout?.cooldown).toBe('5 mins chest & tricep static stretching')
      expect(day1.workout?.cooldown.startsWith('**')).toBe(false)
    })
  })

  // ==========================================================================
  // DEFECT B: Daily Calorie Calculation vs First Meal
  // ==========================================================================
  describe('Defect B: Calorie Aggregation and Day-Level Target', () => {
    it('aggregates sum of individual meal calories when no explicit total line is present', () => {
      const nutritionText = `
- Breakfast: Oatmeal with berries, chia seeds & protein (350 kcal)
- Lunch: Grilled chicken salad with quinoa & avocado (450 kcal)
- Dinner: Baked salmon with sweet potato & broccoli (500 kcal)
- Snacks: Greek yogurt & almonds (300 kcal)
`
      const total = extractDailyCalories(nutritionText)
      // 350 + 450 + 500 + 300 = 1600 kcal (NOT 350 kcal!)
      expect(total).toBe('1600 kcal')
    })

    it('prioritizes explicit day-level calorie target over meal sum', () => {
      const nutritionText = `
Daily Target: 1738 kcal
- Breakfast: Oatmeal (350 kcal)
- Lunch: Salad (450 kcal)
- Dinner: Salmon (500 kcal)
`
      const total = extractDailyCalories(nutritionText)
      expect(total).toBe('1738 kcal')
    })

    it('recognizes "Total Calories: 1800 kcal" explicit line', () => {
      const nutritionText = `
- Breakfast: Eggs and toast (400 kcal)
- Lunch: Turkey wrap (500 kcal)
- Dinner: Steak and potatoes (600 kcal)
Total Calories: 1800 kcal
`
      const total = extractDailyCalories(nutritionText)
      expect(total).toBe('1800 kcal')
    })

    it('does not misinterpret workout energy expenditure as nutrition target', () => {
      const nutritionText = `
- Breakfast: Protein shake (300 kcal)
- Lunch: Chicken bowl (500 kcal)
- Dinner: White fish (400 kcal)
Note: Workout aims to burn 450 calories of energy.
`
      const total = extractDailyCalories(nutritionText)
      // 300 + 500 + 400 = 1200 kcal, should NOT return 450 calories
      expect(total).toBe('1200 kcal')
    })

    it('handles single meal safely without inflating or crashing', () => {
      const nutritionText = `
- Breakfast: Large recovery breakfast (650 kcal)
`
      const total = extractDailyCalories(nutritionText)
      expect(total).toBe('650 kcal')
    })

    it('extracts daily calories correctly in full plan parse', () => {
      const planMarkdown = `## Day 1 - Full Nutrition
**Main Workout:**
- Push-ups: 3 sets x 12 reps
**Meals:**
- Breakfast: Oatmeal with berries (350 kcal)
- Lunch: Grilled chicken salad (450 kcal)
- Dinner: Baked salmon (500 kcal)
- Snacks: Greek yogurt (300 kcal)
`
      const parsed = parseAndValidatePlan(planMarkdown, false)
      expect(parsed.success).toBe(true)
      if (!parsed.success || !parsed.data) return

      expect(parsed.data.days[0].nutrition?.estimatedCalories).toBe('1600 kcal')
    })
  })

  // ==========================================================================
  // DEFECT C: Fallback Plan 7-Day Completeness & Contract
  // ==========================================================================
  describe('Defect C: Fallback Plan 7-Day Completeness & Contract', () => {
    it('validates that MOCK_PLAN is a complete 7-day plan satisfying WeeklyPlanSchema', () => {
      const validation = validateGeneratedPlan(MOCK_PLAN)
      expect(validation.isValid).toBe(true)
      expect(validation.dayCount).toBe(7)
      expect(validation.hasWorkouts).toBe(true)
      expect(validation.hasNutrition).toBe(true)

      const parsed = parseAndValidatePlan(MOCK_PLAN, true)
      expect(parsed.success).toBe(true)
      if (!parsed.success || !parsed.data) return
      expect(parsed.data.days.length).toBe(7)
      expect(parsed.data.days.every((d, i) => d.dayNumber === i + 1)).toBe(true)
    })

    it('preserves Day 1 contraindication signatures (Overhead Press, Dips for shoulder injuries)', () => {
      const shoulderContra = scanPlanForContraindications(MOCK_PLAN, 'Rotator Cuff Tear')
      expect(shoulderContra.hasViolation).toBe(true)
      expect(shoulderContra.violations.some(v => v.matchedExercise.toLowerCase().includes('overhead press'))).toBe(true)
    })

    it('preserves Day 1 allergen signatures (Greek yogurt for Dairy, Almonds for Tree Nuts)', () => {
      const dairyAllergen = scanPlanForAllergens(MOCK_PLAN, 'Dairy')
      expect(dairyAllergen.hasViolation).toBe(true)

      const treeNutsAllergen = scanPlanForAllergens(MOCK_PLAN, 'Tree Nuts')
      expect(treeNutsAllergen.hasViolation).toBe(true)
    })

    it('provides structured rest/recovery days on Day 3 and Day 7', () => {
      const parsed = parseAndValidatePlan(MOCK_PLAN, true)
      expect(parsed.success).toBe(true)
      if (!parsed.success || !parsed.data) return

      const day3 = parsed.data.days[2]
      const day7 = parsed.data.days[6]
      expect(day3.isRestDay).toBe(true)
      expect(day7.isRestDay).toBe(true)
    })

    it('every day in MOCK_PLAN has valid non-leaking warm-up and cool-down', () => {
      const parsed = parseAndValidatePlan(MOCK_PLAN, true)
      expect(parsed.success).toBe(true)
      if (!parsed.success || !parsed.data) return

      for (const d of parsed.data.days) {
        if (d.workout) {
          expect(d.workout.warmup.startsWith('**')).toBe(false)
          expect(d.workout.cooldown.startsWith('**')).toBe(false)
        }
      }
    })

    it('every day in MOCK_PLAN has a valid estimated daily calorie count >= 1200 kcal', () => {
      const parsed = parseAndValidatePlan(MOCK_PLAN, true)
      expect(parsed.success).toBe(true)
      if (!parsed.success || !parsed.data) return

      for (const d of parsed.data.days) {
        expect(d.nutrition?.estimatedCalories).toBeDefined()
        const kcal = parseInt(d.nutrition!.estimatedCalories!, 10)
        expect(kcal).toBeGreaterThanOrEqual(1200)
        expect(kcal).toBeLessThanOrEqual(3000)
      }
    })
  })
})
