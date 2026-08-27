import { describe, it, expect } from 'vitest'
import {
  findMealAlternatives,
  aggregateGroceryList,
  scaleGroceryList,
  type GroceryCategoryGroup
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

  it('scales grocery item quantities deterministically without mutating source data', () => {
    const sampleGroups: GroceryCategoryGroup[] = [
      {
        category: 'Protein',
        items: [
          { id: '1', name: '200g Chicken Breast', category: 'Protein', checked: false },
          { id: '2', name: 'Eggs (Dozen)', category: 'Protein', checked: false }
        ]
      }
    ]

    // 1x multiplier leaves data unchanged
    const scaled1x = scaleGroceryList(sampleGroups, 1)
    expect(scaled1x[0].items[0].name).toBe('200g Chicken Breast')

    // 2x multiplier doubles numeric quantity
    const scaled2x = scaleGroceryList(sampleGroups, 2)
    expect(scaled2x[0].items[0].name).toBe('400 g Chicken Breast')
    expect(scaled2x[0].items[1].name).toBe('Eggs (Dozen) (2x)')

    // 4x multiplier quadruples numeric quantity
    const scaled4x = scaleGroceryList(sampleGroups, 4)
    expect(scaled4x[0].items[0].name).toBe('800 g Chicken Breast')

    // Original source data is completely unmutated
    expect(sampleGroups[0].items[0].name).toBe('200g Chicken Breast')
  })
})
