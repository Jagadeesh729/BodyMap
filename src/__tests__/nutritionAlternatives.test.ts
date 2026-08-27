import { describe, it, expect } from 'vitest'
import {
  findMealAlternatives,
  aggregateGroceryList
} from '@/lib/nutritionAlternatives'

describe('Nutrition Alternatives & Grocery Aggregator Suite', () => {
  it('returns protein substitutions for chicken dishes', () => {
    const alts = findMealAlternatives('Grilled chicken breast with quinoa and steamed broccoli')
    expect(alts.length).toBeGreaterThan(0)
    const names = alts.map(a => a.name)
    expect(names.some(n => n.includes('Turkey'))).toBe(true)
    expect(names.some(n => n.includes('Salmon'))).toBe(true)
    expect(names.some(n => n.includes('Tofu'))).toBe(true)
  })

  it('filters vegetarian alternatives correctly', () => {
    const vegAlts = findMealAlternatives('Grilled chicken breast', 'vegetarian')
    expect(vegAlts.length).toBeGreaterThan(0)
    for (const alt of vegAlts) {
      expect(alt.dietaryTags).toContain('vegetarian')
    }
  })

  it('filters vegan alternatives correctly', () => {
    const veganAlts = findMealAlternatives('Grilled chicken breast', 'vegan')
    expect(veganAlts.length).toBeGreaterThan(0)
    for (const alt of veganAlts) {
      expect(alt.dietaryTags).toContain('vegan')
    }
  })

  it('aggregates and categorizes grocery ingredients across multiple meal strings', () => {
    const mealTexts = [
      'Scrambled eggs with spinach and whole wheat toast',
      'Grilled chicken breast with brown rice and broccoli florets',
      'Non-fat Greek yogurt with mixed berries and almonds',
      'Salmon fillet with sweet potatoes and asparagus'
    ]

    const groups = aggregateGroceryList(mealTexts)
    expect(groups.length).toBeGreaterThan(0)

    const produceGroup = groups.find(g => g.category === 'Produce')
    expect(produceGroup).toBeDefined()
    expect(produceGroup?.items.some(i => i.name.includes('Spinach'))).toBe(true)
    expect(produceGroup?.items.some(i => i.name.includes('Broccoli'))).toBe(true)

    const proteinGroup = groups.find(g => g.category === 'Protein')
    expect(proteinGroup).toBeDefined()
    expect(proteinGroup?.items.some(i => i.name.includes('Chicken'))).toBe(true)
    expect(proteinGroup?.items.some(i => i.name.includes('Eggs'))).toBe(true)
    expect(proteinGroup?.items.some(i => i.name.includes('Salmon'))).toBe(true)

    const grainsGroup = groups.find(g => g.category === 'Grains')
    expect(grainsGroup).toBeDefined()
    expect(grainsGroup?.items.some(i => i.name.includes('Rice') || i.name.includes('Bread'))).toBe(true)
  })

  it('falls back safely to default staple items when input meal strings are empty', () => {
    const groups = aggregateGroceryList([])
    expect(groups.length).toBeGreaterThan(0)
    const allItems = groups.flatMap(g => g.items)
    expect(allItems.length).toBeGreaterThan(0)
  })
})
