export type HydrationClimateContext = 'temperate' | 'warm' | 'hot'

export interface RecoveryHydrationResult {
  hasValidInput: boolean
  recommendedFluidMl: number
  recommendedRangeMl: { min: number; max: number }
  hydrationDisclaimer: string
  fluidRecommendationLabel: string
  climateContext: HydrationClimateContext
}

/**
 * Deterministically calculates a post-workout recovery fluid planning guideline.
 * Labeled explicitly as a bounded training replenishment heuristic, not an individualized sweat test or medical prescription.
 */
export function calculateRecoveryHydration(
  durationMinutes: number | null | undefined,
  totalVolumeKg: number | null | undefined,
  climate: HydrationClimateContext = 'temperate'
): RecoveryHydrationResult {
  const mins = typeof durationMinutes === 'number' && !isNaN(durationMinutes) && durationMinutes > 0 ? durationMinutes : 0
  const vol = typeof totalVolumeKg === 'number' && !isNaN(totalVolumeKg) && totalVolumeKg > 0 ? totalVolumeKg : 0

  if (mins === 0 && vol === 0) {
    return {
      hasValidInput: false,
      recommendedFluidMl: 0,
      recommendedRangeMl: { min: 0, max: 0 },
      hydrationDisclaimer: 'Non-medical estimation. Hydrate according to thirst and individual tolerance.',
      fluidRecommendationLabel: 'No active session rehydration required.',
      climateContext: climate
    }
  }

  const climateBonus = climate === 'hot' ? 250 : climate === 'warm' ? 120 : 0
  const durationComponent = Math.min(450, mins * 7)
  const volumeComponent = Math.min(200, Math.floor(vol / 2500) * 35)

  const rawTotal = 300 + durationComponent + volumeComponent + climateBonus
  const recommendedFluidMl = Math.min(1000, Math.max(350, Math.round(rawTotal / 25) * 25))

  const minRange = Math.max(250, recommendedFluidMl - 100)
  const maxRange = Math.min(1200, recommendedFluidMl + 150)

  return {
    hasValidInput: true,
    recommendedFluidMl,
    recommendedRangeMl: { min: minRange, max: maxRange },
    hydrationDisclaimer: 'Non-medical training heuristic. Drink to thirst and adjust for personal tolerance.',
    fluidRecommendationLabel: `~${recommendedFluidMl} ml (${minRange}–${maxRange} ml) recovery fluid planning target`,
    climateContext: climate
  }
}
