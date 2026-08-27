export interface MicronutrientGuideResult {
  hasCalculation: boolean
  targetCalories: number
  estimatedFiberGrams: number
  fiberDensityLabel: string
  explanation: string
  electrolyteGuidance: string
}

/**
 * Deterministically calculates estimated daily dietary fiber planning target (14g / 1000 kcal).
 * Labeled strictly as a nutritional planning reference estimate, not a clinical prescription.
 */
export function calculateMicronutrientGuide(
  dailyCalories: number | null | undefined
): MicronutrientGuideResult {
  const calories = typeof dailyCalories === 'number' && !isNaN(dailyCalories) && dailyCalories > 0
    ? dailyCalories
    : 0

  if (calories <= 0) {
    return {
      hasCalculation: false,
      targetCalories: 0,
      estimatedFiberGrams: 0,
      fiberDensityLabel: '14g / 1000 kcal',
      explanation: 'Set a daily calorie target to calculate your estimated dietary fiber planning goal.',
      electrolyteGuidance: 'Electrolyte needs vary with sweat rate, climate, and exercise duration.'
    }
  }

  // 14g fiber per 1000 kcal reference guideline
  const fiberGrams = Math.round((calories / 1000) * 14)

  return {
    hasCalculation: true,
    targetCalories: Math.round(calories),
    estimatedFiberGrams: fiberGrams,
    fiberDensityLabel: '14g / 1000 kcal',
    explanation: `Estimated Daily Fiber Goal: ~${fiberGrams}g/day (based on ~14g per 1,000 kcal baseline for a ${Math.round(calories).toLocaleString()} kcal intake).`,
    electrolyteGuidance: 'Ensure balanced electrolyte intake (sodium, potassium, magnesium) from whole foods and adequate hydration around training.'
  }
}
