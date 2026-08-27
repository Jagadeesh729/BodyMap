import { describe, it, expect } from 'vitest'
import { calculateBarbellPlates } from '@/lib/plateLoadingCalculator'

describe('Barbell Plate Loading Calculator Suite', () => {
  it('calculates exact symmetric plate configurations for standard weights', () => {
    // 60 kg = 20kg bar + 20kg per side (1 x 20kg plate per side)
    const sixty = calculateBarbellPlates(60)
    expect(sixty.hasValidConfiguration).toBe(true)
    expect(sixty.plateWeightPerSideKg).toBe(20)
    expect(sixty.perSidePlates).toEqual([{ denominationKg: 20, count: 1 }])
    expect(sixty.summaryLabel).toBe('Per side: 20kg')

    // 100 kg = 20kg bar + 40kg per side (1 x 25kg + 1 x 15kg per side)
    const hundred = calculateBarbellPlates(100)
    expect(hundred.hasValidConfiguration).toBe(true)
    expect(hundred.plateWeightPerSideKg).toBe(40)
    expect(hundred.perSidePlates).toEqual([
      { denominationKg: 25, count: 1 },
      { denominationKg: 15, count: 1 }
    ])

    // 82.5 kg = 20kg bar + 31.25kg per side (1 x 25kg + 1 x 5kg + 1 x 1.25kg per side)
    const fractional = calculateBarbellPlates(82.5)
    expect(fractional.hasValidConfiguration).toBe(true)
    expect(fractional.plateWeightPerSideKg).toBe(31.25)
    expect(fractional.perSidePlates).toEqual([
      { denominationKg: 25, count: 1 },
      { denominationKg: 5, count: 1 },
      { denominationKg: 1.25, count: 1 }
    ])

    // 142.5 kg = 20kg bar + 61.25kg per side (2 x 25kg + 1 x 10kg + 1 x 1.25kg)
    const heavy = calculateBarbellPlates(142.5)
    expect(heavy.hasValidConfiguration).toBe(true)
    expect(heavy.plateWeightPerSideKg).toBe(61.25)
    expect(heavy.perSidePlates).toEqual([
      { denominationKg: 25, count: 2 },
      { denominationKg: 10, count: 1 },
      { denominationKg: 1.25, count: 1 }
    ])
  })

  it('handles empty bar (20 kg) and loads below bar weight safely', () => {
    const barOnly = calculateBarbellPlates(20)
    expect(barOnly.hasValidConfiguration).toBe(true)
    expect(barOnly.plateWeightPerSideKg).toBe(0)
    expect(barOnly.perSidePlates).toEqual([])
    expect(barOnly.summaryLabel).toContain('Bar only')

    const belowBar = calculateBarbellPlates(15)
    expect(belowBar.hasValidConfiguration).toBe(false)
    expect(belowBar.summaryLabel).toContain('Below bar weight')
  })

  it('handles unrepresentable fractional targets safely', () => {
    // 21 kg with 20kg bar leaves 0.5kg per side (smallest plate is 1.25kg)
    const unrep = calculateBarbellPlates(21)
    expect(unrep.hasValidConfiguration).toBe(false)
    expect(unrep.summaryLabel).toContain('Unrepresentable load')
  })

  it('supports custom bar weights and plate inventories', () => {
    // 15kg Women's / Technique Bar + 35kg total = 10kg per side (1 x 10kg)
    const custom = calculateBarbellPlates(35, 15, [20, 10, 5])
    expect(custom.hasValidConfiguration).toBe(true)
    expect(custom.barWeightKg).toBe(15)
    expect(custom.plateWeightPerSideKg).toBe(10)
    expect(custom.perSidePlates).toEqual([{ denominationKg: 10, count: 1 }])
  })

  it('handles invalid inputs without NaN or throw', () => {
    expect(calculateBarbellPlates(0).hasValidConfiguration).toBe(false)
    expect(calculateBarbellPlates(-10).hasValidConfiguration).toBe(false)
    expect(calculateBarbellPlates(null).hasValidConfiguration).toBe(false)
    expect(calculateBarbellPlates(undefined).hasValidConfiguration).toBe(false)
  })
})
