export interface EnergyBalanceForecastResult {
  hasForecast: boolean
  dailyIntakeKcal: number
  dailyMaintenanceKcal: number
  dailyDeltaKcal: number
  weeklyDeltaKcal: number
  estimatedKgPerWeek: number
  formattedPaceLabel: string
  trendType: 'surplus' | 'deficit' | 'maintenance'
  explanation: string
}

/**
 * Deterministically calculates simplified projected weekly weight change pace based on 7,700 kcal/kg assumption.
 * Strictly labeled as a model-based estimate, not a guaranteed physiological forecast or medical prediction.
 */
export function forecastEnergyBalancePace(
  dailyIntakeKcal: number | null | undefined,
  dailyMaintenanceKcal: number | null | undefined
): EnergyBalanceForecastResult {
  const intake = typeof dailyIntakeKcal === 'number' && !isNaN(dailyIntakeKcal) && dailyIntakeKcal > 0
    ? dailyIntakeKcal
    : 0
  const maintenance = typeof dailyMaintenanceKcal === 'number' && !isNaN(dailyMaintenanceKcal) && dailyMaintenanceKcal > 0
    ? dailyMaintenanceKcal
    : 0

  if (intake <= 0 || maintenance <= 0) {
    return {
      hasForecast: false,
      dailyIntakeKcal: intake,
      dailyMaintenanceKcal: maintenance,
      dailyDeltaKcal: 0,
      weeklyDeltaKcal: 0,
      estimatedKgPerWeek: 0,
      formattedPaceLabel: 'No forecast',
      trendType: 'maintenance',
      explanation: 'Valid intake and maintenance calorie values are required to forecast energy balance.'
    }
  }

  const dailyDelta = Math.round(intake - maintenance)
  const weeklyDelta = dailyDelta * 7
  // 7,700 kcal per kg assumption
  const rawKgPerWeek = weeklyDelta / 7700
  const estimatedKgPerWeek = Math.round(rawKgPerWeek * 100) / 100

  let trendType: 'surplus' | 'deficit' | 'maintenance' = 'maintenance'
  let formattedPaceLabel = '≈ 0.0 kg/week (Maintenance)'

  if (estimatedKgPerWeek > 0.05) {
    trendType = 'surplus'
    formattedPaceLabel = `≈ +${estimatedKgPerWeek.toFixed(2)} kg/week (Caloric Surplus)`
  } else if (estimatedKgPerWeek < -0.05) {
    trendType = 'deficit'
    formattedPaceLabel = `≈ ${estimatedKgPerWeek.toFixed(2)} kg/week (Caloric Deficit)`
  } else {
    trendType = 'maintenance'
    formattedPaceLabel = '≈ 0.00 kg/week (Energy Balance)'
  }

  return {
    hasForecast: true,
    dailyIntakeKcal: Math.round(intake),
    dailyMaintenanceKcal: Math.round(maintenance),
    dailyDeltaKcal: dailyDelta,
    weeklyDeltaKcal: weeklyDelta,
    estimatedKgPerWeek,
    formattedPaceLabel,
    trendType,
    explanation: `${formattedPaceLabel} based on a ${dailyDelta > 0 ? `+${dailyDelta}` : dailyDelta} kcal/day delta (${weeklyDelta > 0 ? `+${weeklyDelta}` : weeklyDelta} kcal/week). Model-based estimate; individual rate varies.`
  }
}
