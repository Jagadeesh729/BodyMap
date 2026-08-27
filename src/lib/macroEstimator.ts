export interface DailyMacroEstimate {
  hasData: boolean
  proteinGrams: number
  carbGrams: number
  fatGrams: number
  proteinKcal: number
  carbKcal: number
  fatKcal: number
  totalKcal: number
  disclaimer: string
}

/**
 * Deterministically estimates daily target macronutrient distribution based on body weight and fitness goal.
 * Clearly labeled as an estimate for training support, not a clinical prescription.
 */
export function estimateDailyMacros(
  weightInput?: number | string | null,
  goalInput?: string | null,
  dailyCalorieTarget?: number | null
): DailyMacroEstimate {
  const weight = typeof weightInput === 'number' ? weightInput : (typeof weightInput === 'string' ? parseFloat(weightInput) : NaN)

  if (isNaN(weight) || weight < 30 || weight > 300) {
    return {
      hasData: false,
      proteinGrams: 0,
      carbGrams: 0,
      fatGrams: 0,
      proteinKcal: 0,
      carbKcal: 0,
      fatKcal: 0,
      totalKcal: 0,
      disclaimer: 'Estimated daily macro targets based on training goal and profile.'
    }
  }

  const goal = (goalInput || '').toLowerCase()

  // Base multiplier per kg bodyweight
  let proteinMultiplier = 1.8 // g/kg
  let fatMultiplier = 0.9 // g/kg
  let targetCalories = typeof dailyCalorieTarget === 'number' && dailyCalorieTarget > 1000 && dailyCalorieTarget < 6000
    ? dailyCalorieTarget
    : Math.round(weight * 32) // Standard TDEE baseline estimate

  if (goal.includes('loss') || goal.includes('cut') || goal.includes('slim')) {
    proteinMultiplier = 2.2
    fatMultiplier = 0.8
    if (!dailyCalorieTarget) targetCalories = Math.round(weight * 28) // Deficit
  } else if (goal.includes('gain') || goal.includes('bulk') || goal.includes('mass') || goal.includes('hypertrophy')) {
    proteinMultiplier = 2.0
    fatMultiplier = 1.0
    if (!dailyCalorieTarget) targetCalories = Math.round(weight * 36) // Surplus
  } else if (goal.includes('endurance') || goal.includes('cardio') || goal.includes('stamina')) {
    proteinMultiplier = 1.6
    fatMultiplier = 0.8
    if (!dailyCalorieTarget) targetCalories = Math.round(weight * 34)
  }

  const proteinG = Math.round(weight * proteinMultiplier)
  const fatG = Math.round(weight * fatMultiplier)

  const proteinKcal = proteinG * 4
  const fatKcal = fatG * 9

  // Allocate remaining calories to carbohydrates
  const remainingKcal = Math.max(200, targetCalories - (proteinKcal + fatKcal))
  const carbG = Math.round(remainingKcal / 4)
  const carbKcal = carbG * 4

  const reconciledTotalKcal = proteinKcal + fatKcal + carbKcal

  return {
    hasData: true,
    proteinGrams: proteinG,
    carbGrams: carbG,
    fatGrams: fatG,
    proteinKcal,
    carbKcal,
    fatKcal,
    totalKcal: reconciledTotalKcal,
    disclaimer: 'Estimated daily macro targets based on training goal and body weight. Non-medical guidance.'
  }
}
