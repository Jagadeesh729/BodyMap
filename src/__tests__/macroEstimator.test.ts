import { describe, it, expect } from 'vitest'
import { estimateDailyMacros } from '@/lib/macroEstimator'

describe('Daily Macro Target Estimator Suite', () => {
  it('calculates balanced macro targets for muscle building (bulk)', () => {
    const macros = estimateDailyMacros(75, 'Muscle Gain', 2700)
    expect(macros.hasData).toBe(true)
    // 75kg * 2.0g/kg protein = 150g (600 kcal)
    expect(macros.proteinGrams).toBe(150)
    // 75kg * 1.0g/kg fat = 75g (675 kcal)
    expect(macros.fatGrams).toBe(75)
    // Remaining kcal = 2700 - (600 + 675) = 1425 kcal -> ~356g carbs
    expect(macros.carbGrams).toBe(356)
    expect(macros.totalKcal).toBe(macros.proteinKcal + macros.fatKcal + macros.carbKcal)
    expect(macros.disclaimer).toContain('Non-medical guidance')
  })

  it('calculates higher protein targets for fat loss (cut)', () => {
    const macros = estimateDailyMacros(80, 'Weight Loss')
    expect(macros.hasData).toBe(true)
    // 80kg * 2.2g/kg = 176g protein
    expect(macros.proteinGrams).toBe(176)
    // 80kg * 0.8g/kg = 64g fat
    expect(macros.fatGrams).toBe(64)
  })

  it('returns hasData: false when weight is missing or invalid', () => {
    expect(estimateDailyMacros(null, 'Bulk').hasData).toBe(false)
    expect(estimateDailyMacros(0, 'Bulk').hasData).toBe(false)
    expect(estimateDailyMacros(-50, 'Bulk').hasData).toBe(false)
    expect(estimateDailyMacros(500, 'Bulk').hasData).toBe(false)
  })
})
