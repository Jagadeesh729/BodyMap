import { describe, it, expect } from 'vitest'
import { calculateSessionCaloricExpenditure } from '@/lib/sessionCaloricExpenditure'

describe('Session METs Caloric Expenditure Suite', () => {
  it('estimates bounded calorie burn for a 60-min session at 75 kg', () => {
    // 4.0 MET * 75 kg * 1 hr = 300 kcal
    const res = calculateSessionCaloricExpenditure(60, 75, 'moderate')
    expect(res.hasValidInput).toBe(true)
    expect(res.estimatedCaloriesKcal).toBe(300)
    expect(res.calorieRangeKcal.min).toBeLessThan(300)
    expect(res.calorieRangeKcal.max).toBeGreaterThan(300)
    expect(res.calorieEstimateLabel).toContain('300 kcal')
  })

  it('handles 0 or missing inputs without returning NaN or crashing', () => {
    const res = calculateSessionCaloricExpenditure(0, 0)
    expect(res.hasValidInput).toBe(false)
    expect(res.estimatedCaloriesKcal).toBe(0)
  })
})
