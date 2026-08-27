export type ClimateContext = 'temperate' | 'warm' | 'hot'

export interface HydrationClimateResult {
  baseTargetMl: number
  climate: ClimateContext
  climateAdjustmentMl: number
  totalPlanningTargetMl: number
  summaryLabel: string
  explanation: string
}

/**
 * Deterministically calculates non-medical environmental hydration planning adjustment.
 */
export function calculateHydrationClimateAdjustment(
  baseTargetMl: number | null | undefined,
  climate: ClimateContext | string | null | undefined = 'temperate'
): HydrationClimateResult {
  const base = typeof baseTargetMl === 'number' && !isNaN(baseTargetMl) && baseTargetMl > 0
    ? Math.round(baseTargetMl)
    : 2000

  let normClimate: ClimateContext = 'temperate'
  const cStr = (climate || '').toLowerCase().trim()

  if (cStr === 'hot' || cStr.includes('humid') || cStr.includes('summer')) {
    normClimate = 'hot'
  } else if (cStr === 'warm' || cStr.includes('moderate')) {
    normClimate = 'warm'
  } else {
    normClimate = 'temperate'
  }

  let climateAdjustmentMl = 0
  if (normClimate === 'warm') {
    climateAdjustmentMl = 250
  } else if (normClimate === 'hot') {
    climateAdjustmentMl = 500
  }

  const totalPlanningTargetMl = base + climateAdjustmentMl
  const summaryLabel = climateAdjustmentMl > 0
    ? `Base: ${base.toLocaleString()} ml + Climate (${normClimate}): +${climateAdjustmentMl} ml = ${totalPlanningTargetMl.toLocaleString()} ml`
    : `Standard Target: ${base.toLocaleString()} ml`

  return {
    baseTargetMl: base,
    climate: normClimate,
    climateAdjustmentMl,
    totalPlanningTargetMl,
    summaryLabel,
    explanation: climateAdjustmentMl > 0
      ? `Estimated target: ~${totalPlanningTargetMl.toLocaleString()} ml/day (includes +${climateAdjustmentMl} ml for ${normClimate} climate sweat allowance). Non-medical guideline.`
      : `Estimated target: ~${totalPlanningTargetMl.toLocaleString()} ml/day based on baseline biometrics. Non-medical guideline.`
  }
}
