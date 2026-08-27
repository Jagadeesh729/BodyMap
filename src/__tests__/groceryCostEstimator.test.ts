import { describe, it, expect } from 'vitest'
import { estimateGroceryPackaging } from '@/lib/groceryCostEstimator'

describe('Smart Grocery Packaging Estimator Suite', () => {
  it('estimates required retail packages for standard meats and proteins', () => {
    // 1400g chicken -> 3 x 500g packages (1500g purchased, 100g overshoot)
    const chicken = estimateGroceryPackaging('Chicken Breast', 1400, 'g')
    expect(chicken.hasPackageEstimate).toBe(true)
    expect(chicken.packagesNeeded).toBe(3)
    expect(chicken.packageSize).toBe(500)
    expect(chicken.totalPurchasedQuantity).toBe(1500)
    expect(chicken.overshootQuantity).toBe(100)
    expect(chicken.displayLabel).toContain('3 × 500 g packs')
  })

  it('converts kg to grams appropriately for dry grains and carbs', () => {
    // 1.5 kg Rice -> 2 x 1000g packs
    const rice = estimateGroceryPackaging('Brown Rice', 1.5, 'kg')
    expect(rice.hasPackageEstimate).toBe(true)
    expect(rice.packagesNeeded).toBe(2)
    expect(rice.packageSize).toBe(1000)
    expect(rice.totalPurchasedQuantity).toBe(2000)
  })

  it('estimates dairy and liquids in carton units', () => {
    // 2000 ml Almond Milk -> 2 x 1000ml packs
    const milk = estimateGroceryPackaging('Almond Milk', 2000, 'ml')
    expect(milk.hasPackageEstimate).toBe(true)
    expect(milk.packagesNeeded).toBe(2)
    expect(milk.packageSize).toBe(1000)
  })

  it('falls back gracefully for unrecognized items or zero quantities', () => {
    const unknownItem = estimateGroceryPackaging('Exotic Spice Mix', 50, 'g')
    expect(unknownItem.hasPackageEstimate).toBe(false)
    expect(unknownItem.displayLabel).toBe('50 g')

    const zeroItem = estimateGroceryPackaging('Chicken', 0, 'g')
    expect(zeroItem.hasPackageEstimate).toBe(false)
  })
})
