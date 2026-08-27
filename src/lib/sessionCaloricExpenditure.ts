export type SessionTrainingIntensity = 'moderate' | 'vigorous' | 'circuit'

export interface SessionCaloricExpenditureResult {
  hasValidInput: boolean
  estimatedCaloriesKcal: number
  calorieRangeKcal: { min: number; max: number }
  calorieEstimateLabel: string
  intensity: SessionTrainingIntensity
  disclaimer: string
}

const INTENSITY_METS: Record<SessionTrainingIntensity, { base: number; min: number; max: number }> = {
  moderate: { base: 4.0, min: 3.5, max: 4.8 },
  vigorous: { base: 6.0, min: 5.0, max: 7.0 },
  circuit: { base: 7.5, min: 6.5, max: 8.5 }
}

/**
 * Deterministically estimates session energy expenditure using standard Ainsworth METs (Metabolic Equivalent of Task).
 * Labeled explicitly as a bounded mathematical estimate, not a direct metabolic measurement or clinical prescription.
 */
export function calculateSessionCaloricExpenditure(
  durationMinutes: number | null | undefined,
  bodyweightKg: number | null | undefined,
  intensity: SessionTrainingIntensity = 'moderate'
): SessionCaloricExpenditureResult {
  const mins = typeof durationMinutes === 'number' && !isNaN(durationMinutes) && durationMinutes > 0 ? durationMinutes : 0
  const weight = typeof bodyweightKg === 'number' && !isNaN(bodyweightKg) && bodyweightKg > 0 ? bodyweightKg : 0

  if (mins === 0 || weight === 0) {
    return {
      hasValidInput: false,
      estimatedCaloriesKcal: 0,
      calorieRangeKcal: { min: 0, max: 0 },
      calorieEstimateLabel: 'No active session or bodyweight data',
      intensity,
      disclaimer: 'MET-based energy expenditure estimate (Ainsworth Compendium). Non-clinical guideline.'
    }
  }

  const hours = mins / 60
  const metConfig = INTENSITY_METS[intensity] || INTENSITY_METS.moderate

  const rawBase = metConfig.base * weight * hours
  const rawMin = metConfig.min * weight * hours
  const rawMax = metConfig.max * weight * hours

  const estimatedCaloriesKcal = Math.round(rawBase)
  const minRange = Math.round(rawMin)
  const maxRange = Math.round(rawMax)

  return {
    hasValidInput: true,
    estimatedCaloriesKcal,
    calorieRangeKcal: { min: minRange, max: maxRange },
    calorieEstimateLabel: `~${estimatedCaloriesKcal} kcal (${minRange}–${maxRange} kcal est.)`,
    intensity,
    disclaimer: 'MET-based energy expenditure estimate (Ainsworth Compendium). Non-clinical guideline.'
  }
}
