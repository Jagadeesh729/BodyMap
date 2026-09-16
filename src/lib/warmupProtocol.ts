import { calculateBarbellPlates, type PlateLoadingResult } from './plateLoadingCalculator'

export interface WarmupSet {
  setNumber: number
  percentageLabel: string
  calculatedWeightKg: number
  repsLabel: string
  note: string
  plates?: PlateLoadingResult
  platesSummary?: string
}

export interface WarmupProtocolResult {
  hasProtocol: boolean
  workingWeightKg: number | null
  sets: WarmupSet[]
  explanation: string
}

/**
 * Deterministically generates a 4-step progressive warmup set pyramid for weighted movements.
 * Labeled strictly as preparation guidance, not added to completed workout volume.
 */
export function generateWarmupProtocol(
  workingWeightKg: number | null | undefined,
  barWeightKg: number = 20
): WarmupProtocolResult {
  if (
    typeof workingWeightKg !== 'number' ||
    isNaN(workingWeightKg) ||
    workingWeightKg < 15 ||
    workingWeightKg > 500
  ) {
    return {
      hasProtocol: false,
      workingWeightKg: null,
      sets: [],
      explanation: 'Warm-up reference is available for weighted movements with working loads ≥ 15 kg.'
    }
  }

  const baseBarLoad = barWeightKg > 0 ? barWeightKg : 20 // standard Olympic barbell baseline

  // Step 1: Empty Bar / Initial mobility load
  const set1Weight = workingWeightKg > 40 ? baseBarLoad : Math.round(workingWeightKg * 0.4 * 2) / 2
  // Step 2: 50% Working Load
  const set2Weight = Math.round(workingWeightKg * 0.5 * 2) / 2
  // Step 3: 70% Working Load
  const set3Weight = Math.round(workingWeightKg * 0.7 * 2) / 2
  // Step 4: 85% Working Load (Potentiation / Primer)
  const set4Weight = Math.round(workingWeightKg * 0.85 * 2) / 2

  const rawWeights = [
    { num: 1, weight: set1Weight, label: 'Unloaded / Mobility', reps: '8–10 reps', note: 'Focus on full range of motion & joint lubrication' },
    { num: 2, weight: set2Weight, label: '50% Load', reps: '5 reps', note: 'Controlled tempo & groove the motor pattern' },
    { num: 3, weight: set3Weight, label: '70% Load', reps: '3 reps', note: 'Moderate speed & explosive concentric' },
    { num: 4, weight: set4Weight, label: '85% Load', reps: '1–2 reps', note: 'Neuromuscular primer without generating fatigue' }
  ]

  const sets: WarmupSet[] = rawWeights.map(step => {
    const plateResult = calculateBarbellPlates(step.weight, baseBarLoad)
    let platesSummary = plateResult.summaryLabel
    if (plateResult.hasValidConfiguration) {
      if (plateResult.perSidePlates.length === 0) {
        platesSummary = 'Empty Bar'
      }
    } else if (step.weight < baseBarLoad) {
      platesSummary = 'Light DBs / Bar'
    }

    return {
      setNumber: step.num,
      percentageLabel: step.label,
      calculatedWeightKg: step.weight,
      repsLabel: step.reps,
      note: step.note,
      plates: plateResult,
      platesSummary
    }
  })

  return {
    hasProtocol: true,
    workingWeightKg,
    sets,
    explanation: `4-step preparation ladder for ${workingWeightKg} kg target working weight. Adjust based on equipment and feel.`
  }
}
