import { describe, it, expect } from 'vitest'
import {
  getHeuristicRpeRecommendation
} from '@/lib/rpePacingEngine'
import {
  filterPantryStaples,
  countHiddenPantryStaples,
  type GroceryCategoryGroup
} from '@/lib/nutritionAlternatives'
import { getExerciseAlternatives } from '@/lib/exerciseSubstitution'

describe('BodyMap AI — Enhancement Suite (E14 Stepper Chips • E7 Pantry Filter • E3 RPE Guidance)', () => {
  // =========================================================================
  // E14: Working Weight Stepper & Clamp Invariants
  // =========================================================================
  describe('E14: Working Weight Quick Stepper Mathematics', () => {
    const stepWeight = (currentWeightKg: number | null, delta: number): number | null => {
      if (currentWeightKg === null) {
        if (delta <= 0) return null
        return Math.min(999.75, Math.max(0, Math.round(delta * 100) / 100))
      }
      const rawNext = currentWeightKg + delta
      return Math.min(999.75, Math.max(0, Math.round(rawNext * 100) / 100))
    }

    it('correctly increments weight with standard plate steps (+1.25, +2.5, +5, +10)', () => {
      expect(stepWeight(20, 1.25)).toBe(21.25)
      expect(stepWeight(21.25, 1.25)).toBe(22.5)
      expect(stepWeight(20, 2.5)).toBe(22.5)
      expect(stepWeight(20, 5)).toBe(25)
      expect(stepWeight(20, 10)).toBe(30)
    })

    it('correctly decrements weight with matching negative increments (-1.25, -2.5, -5, -10)', () => {
      expect(stepWeight(22.5, -1.25)).toBe(21.25)
      expect(stepWeight(21.25, -1.25)).toBe(20)
      expect(stepWeight(25, -2.5)).toBe(22.5)
      expect(stepWeight(30, -5)).toBe(25)
      expect(stepWeight(40, -10)).toBe(30)
    })

    it('enforces non-negative lower boundary (cannot decrement below 0)', () => {
      expect(stepWeight(1, -1.25)).toBe(0)
      expect(stepWeight(5, -10)).toBe(0)
      expect(stepWeight(0, -2.5)).toBe(0)
      expect(stepWeight(null, -5)).toBe(null)
    })

    it('safely bounds large values to 999.75 kg', () => {
      expect(stepWeight(995, 10)).toBe(999.75)
      expect(stepWeight(999.75, 1.25)).toBe(999.75)
    })

    it('preserves exact 2-decimal precision without IEEE-754 floating point drift', () => {
      let weight = 0
      weight = stepWeight(weight, 1.25)!
      expect(weight).toBe(1.25)
      weight = stepWeight(weight, 1.25)!
      expect(weight).toBe(2.5)
      weight = stepWeight(weight, 1.25)!
      expect(weight).toBe(3.75)
      weight = stepWeight(weight, 1.25)!
      expect(weight).toBe(5)
    })
  })

  // =========================================================================
  // E7: Pantry Staples Filter with Clinical Allergen Safety
  // =========================================================================
  describe('E7: Allergen-Aware Pantry Staples Filtering', () => {
    const mockGroceryGroups: GroceryCategoryGroup[] = [
      {
        category: 'Healthy Fats & Pantry',
        items: [
          { id: 'item_1', name: 'Extra Virgin Olive Oil', category: 'Healthy Fats & Pantry' },
          { id: 'item_2', name: 'Black Pepper', category: 'Healthy Fats & Pantry' },
          { id: 'item_3', name: 'Raw Almonds', category: 'Healthy Fats & Pantry' },
          { id: 'item_4', name: 'Organic Chia Seeds', category: 'Healthy Fats & Pantry' }
        ]
      },
      {
        category: 'Produce',
        items: [
          { id: 'item_5', name: 'Fresh Spinach', category: 'Produce' }
        ]
      }
    ]

    it('returns all items when hidePantry is false', () => {
      const result = filterPantryStaples(mockGroceryGroups, false)
      expect(result.length).toBe(2)
      expect(result[0].items.length).toBe(4)
      expect(result[1].items.length).toBe(1)
    })

    it('filters standard staples when hidePantry is true and no allergens conflict', () => {
      const result = filterPantryStaples(mockGroceryGroups, true, [])
      expect(result.length).toBe(2)
      const healthyFats = result.find(g => g.category === 'Healthy Fats & Pantry')
      expect(healthyFats).toBeDefined()
      const names = healthyFats!.items.map(i => i.name)
      expect(names).toContain('Raw Almonds')
      expect(names).not.toContain('Extra Virgin Olive Oil')
      expect(names).not.toContain('Black Pepper')
    })

    it('SAFETY INVARIANT: NEVER filters out a pantry staple that contains an active declared allergen', () => {
      const activeAllergens = ['seeds', 'chia']
      const result = filterPantryStaples(mockGroceryGroups, true, activeAllergens)
      const healthyFats = result.find(g => g.category === 'Healthy Fats & Pantry')
      expect(healthyFats).toBeDefined()
      const names = healthyFats!.items.map(i => i.name)

      // Chia seeds MUST NOT be filtered out because it carries clinical allergy significance!
      expect(names).toContain('Organic Chia Seeds')
      expect(names).toContain('Raw Almonds')

      // Harmless staples without allergy conflict are still filtered
      expect(names).not.toContain('Extra Virgin Olive Oil')
      expect(names).not.toContain('Black Pepper')
    })

    it('correctly counts hidden pantry staples taking allergen overrides into account', () => {
      const countWithoutAllergy = countHiddenPantryStaples(mockGroceryGroups, [])
      expect(countWithoutAllergy).toBe(3)

      const countWithSeedAllergy = countHiddenPantryStaples(mockGroceryGroups, ['seeds', 'chia'])
      expect(countWithSeedAllergy).toBe(2)
    })

    it('handles empty groups and invalid inputs gracefully without throwing', () => {
      expect(filterPantryStaples([], true)).toEqual([])
      expect(countHiddenPantryStaples([])).toBe(0)
      // @ts-expect-error test non-array input
      expect(filterPantryStaples(null, true)).toBeNull()
      // @ts-expect-error test non-array input
      expect(countHiddenPantryStaples(null)).toBe(0)
    })

    it('preserves full grocery list recoverability (zero underlying data mutation)', () => {
      const originalCopy = JSON.parse(JSON.stringify(mockGroceryGroups))
      filterPantryStaples(mockGroceryGroups, true)
      expect(mockGroceryGroups).toEqual(originalCopy)
    })
  })

  // =========================================================================
  // E3: Movement-Pattern-Aware Heuristic RPE Guidance
  // =========================================================================
  describe('E3: Movement-Pattern-Aware Heuristic RPE Guidance', () => {
    it('classifies primary heavy compound movements to conservative technical RPE (8.0 ≈ 2 RIR)', () => {
      const squat = getHeuristicRpeRecommendation('Barbell Back Squat')
      expect(squat.isValid).toBe(true)
      expect(squat.rpe).toBe(8.0)
      expect(squat.estimatedRIR).toBe(2.0)
      expect(squat.movementClassification).toBe('Primary Compound (High Axial Load)')
      expect(squat.isUserOverride).toBe(false)

      const deadlift = getHeuristicRpeRecommendation('Conventional Deadlift')
      expect(deadlift.rpe).toBe(8.0)
      expect(deadlift.movementClassification).toBe('Primary Compound (High Axial Load)')

      const bench = getHeuristicRpeRecommendation('Barbell Bench Press')
      expect(bench.rpe).toBe(8.0)
      expect(bench.movementClassification).toBe('Primary Compound (High Axial Load)')
    })

    it('classifies secondary compound / accessory exercises to RPE 8.0', () => {
      const lunge = getHeuristicRpeRecommendation('Walking Dumbbell Lunges')
      expect(lunge.rpe).toBe(8.0)
      expect(lunge.movementClassification).toBe('Secondary Compound / Accessory')

      const pulldown = getHeuristicRpeRecommendation('Lat Pulldown')
      expect(pulldown.rpe).toBe(8.0)
      expect(pulldown.movementClassification).toBe('Secondary Compound / Accessory')
    })

    it('classifies single-joint isolation finishers to higher effort (8.5 RPE ≈ 1.5 RIR)', () => {
      const curls = getHeuristicRpeRecommendation('Standing Dumbbell Bicep Curls')
      expect(curls.rpe).toBe(8.5)
      expect(curls.estimatedRIR).toBe(1.5)
      expect(curls.movementClassification).toBe('Isolation / Accessory Finisher')

      const lateralRaises = getHeuristicRpeRecommendation('Dumbbell Lateral Raise')
      expect(lateralRaises.rpe).toBe(8.5)
      expect(lateralRaises.movementClassification).toBe('Isolation / Accessory Finisher')
    })

    it('classifies mobility and active recovery movements to submaximal effort (6.0 RPE)', () => {
      const mobility = getHeuristicRpeRecommendation('Dynamic Thoracic Mobility Flow')
      expect(mobility.rpe).toBe(6.0)
      expect(mobility.estimatedRIR).toBe(4.0)
      expect(mobility.movementClassification).toBe('Mobility / Active Recovery')
    })

    it('supports user custom override and marks isUserOverride true', () => {
      const overridden = getHeuristicRpeRecommendation('Barbell Back Squat', 9.0)
      expect(overridden.rpe).toBe(9.0)
      expect(overridden.estimatedRIR).toBe(1.0)
      expect(overridden.isUserOverride).toBe(true)
      expect(overridden.movementClassification).toBe('User Custom Target')
    })

    it('ignores invalid user override and safely falls back to movement heuristic', () => {
      const invalidOverride = getHeuristicRpeRecommendation('Barbell Back Squat', 15.0)
      expect(invalidOverride.rpe).toBe(8.0)
      expect(invalidOverride.isUserOverride).toBe(false)
      expect(invalidOverride.movementClassification).toBe('Primary Compound (High Axial Load)')
    })

    it('includes conservative non-medical disclaimer without prohibited phrases', () => {
      const rec = getHeuristicRpeRecommendation('Any Exercise')
      expect(rec.disclaimer).toBeDefined()
      expect(rec.disclaimer.length).toBeGreaterThan(20)

      const forbiddenPhrases = [
        '100% safe',
        'guaranteed safe',
        'medically proven',
        'clinically proven',
        'replace your doctor',
        'no risk'
      ]
      for (const phrase of forbiddenPhrases) {
        expect(rec.disclaimer.toLowerCase()).not.toContain(phrase)
      }
    })
  })

  // =========================================================================
  // E13: Biomechanical Substitution Contraindication Safety Gate
  // =========================================================================
  describe('E13: Exercise Substitution Safety Invariant', () => {
    it('returns biomechanically valid alternatives for known exercise families', () => {
      const pushAlts = getExerciseAlternatives('Barbell Bench Press')
      expect(pushAlts.length).toBeGreaterThan(0)
      const names = pushAlts.map(a => a.name)
      expect(names).toContain('Standard Push-ups')
    })

    it('strictly filters out contraindicated exercises when medical considerations exist', () => {
      const alts = getExerciseAlternatives('Dumbbell Shoulder Press', 'shoulder impingement rotator cuff tear')
      for (const alt of alts) {
        expect(alt.name.toLowerCase()).not.toContain('overhead press')
        expect(alt.name.toLowerCase()).not.toContain('military press')
      }
    })

    it('returns empty array when no confident biomechanical family matches (fails closed)', () => {
      const unknown = getExerciseAlternatives('Underwater Basket Weaving 9000')
      expect(unknown).toEqual([])
    })
  })
})
