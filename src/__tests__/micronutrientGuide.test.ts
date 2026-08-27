import { describe, it, expect } from 'vitest'
import { calculateMicronutrientGuide } from '@/lib/micronutrientGuide'

describe('Dietary Fiber & Micronutrient Planning Guide Suite', () => {
  it('calculates 14g/1000kcal fiber targets accurately with deterministic rounding', () => {
    // 2000 kcal -> 28g fiber
    const twoThousand = calculateMicronutrientGuide(2000)
    expect(twoThousand.hasCalculation).toBe(true)
    expect(twoThousand.targetCalories).toBe(2000)
    expect(twoThousand.estimatedFiberGrams).toBe(28)
    expect(twoThousand.explanation).toContain('28g/day')

    // 2500 kcal -> 35g fiber
    const twentyFiveHundred = calculateMicronutrientGuide(2500)
    expect(twentyFiveHundred.hasCalculation).toBe(true)
    expect(twentyFiveHundred.estimatedFiberGrams).toBe(35)

    // 3000 kcal -> 42g fiber
    const threeThousand = calculateMicronutrientGuide(3000)
    expect(threeThousand.hasCalculation).toBe(true)
    expect(threeThousand.estimatedFiberGrams).toBe(42)
  })

  it('handles invalid, zero, or negative calorie targets safely', () => {
    expect(calculateMicronutrientGuide(0).hasCalculation).toBe(false)
    expect(calculateMicronutrientGuide(-500).hasCalculation).toBe(false)
    expect(calculateMicronutrientGuide(null).hasCalculation).toBe(false)
    expect(calculateMicronutrientGuide(undefined).hasCalculation).toBe(false)
  })
})
