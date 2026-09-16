export interface MacroPercentages {
  proteinPct: number
  carbPct: number
  fatPct: number
}

export interface DailyMacroEstimate {
  hasData: boolean
  proteinGrams: number
  carbGrams: number
  fatGrams: number
  proteinKcal: number
  carbKcal: number
  fatKcal: number
  totalKcal: number
  percentages?: MacroPercentages
  disclaimer: string
}

/**
 * Calculates exact integer percentages of daily macronutrient caloric contribution
 * using the Largest Remainder Method (Hamilton-Hare) to guarantee sum === 100%.
 */
export function calculateMacroPercentages(
  proteinKcal: number,
  carbKcal: number,
  fatKcal: number
): MacroPercentages {
  const pSafe = Math.max(0, typeof proteinKcal === 'number' && !isNaN(proteinKcal) ? proteinKcal : 0)
  const cSafe = Math.max(0, typeof carbKcal === 'number' && !isNaN(carbKcal) ? carbKcal : 0)
  const fSafe = Math.max(0, typeof fatKcal === 'number' && !isNaN(fatKcal) ? fatKcal : 0)
  const total = pSafe + cSafe + fSafe
  if (total <= 0) {
    return { proteinPct: 0, carbPct: 0, fatPct: 0 }
  }

  const pRaw = (pSafe / total) * 100
  const cRaw = (cSafe / total) * 100
  const fRaw = (fSafe / total) * 100

  let pFloor = Math.floor(pRaw)
  let cFloor = Math.floor(cRaw)
  let fFloor = Math.floor(fRaw)

  const remainder = 100 - (pFloor + cFloor + fFloor)

  const remainders = [
    { key: 'p', rem: pRaw - pFloor },
    { key: 'c', rem: cRaw - cFloor },
    { key: 'f', rem: fRaw - fFloor },
  ]
  remainders.sort((a, b) => b.rem - a.rem)

  for (let i = 0; i < remainder; i++) {
    if (remainders[i].key === 'p') pFloor++
    else if (remainders[i].key === 'c') cFloor++
    else if (remainders[i].key === 'f') fFloor++
  }

  return {
    proteinPct: pFloor,
    carbPct: cFloor,
    fatPct: fFloor
  }
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
      percentages: { proteinPct: 0, carbPct: 0, fatPct: 0 },
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
  const percentages = calculateMacroPercentages(proteinKcal, carbKcal, fatKcal)

  return {
    hasData: true,
    proteinGrams: proteinG,
    carbGrams: carbG,
    fatGrams: fatG,
    proteinKcal,
    carbKcal,
    fatKcal,
    totalKcal: reconciledTotalKcal,
    percentages,
    disclaimer: 'Estimated daily macro targets based on training goal and body weight. Non-medical guidance.'
  }
}
