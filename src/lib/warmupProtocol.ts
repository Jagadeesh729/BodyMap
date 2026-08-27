export interface WarmupSet {
  setNumber: number
  percentageLabel: string
  calculatedWeightKg: number
  repsLabel: string
  note: string
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
  workingWeightKg: number | null | undefined
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

  const baseBarLoad = 20 // standard Olympic barbell baseline

  // Step 1: Empty Bar / Initial mobility load
  const set1Weight = workingWeightKg > 40 ? baseBarLoad : Math.round(workingWeightKg * 0.4 * 2) / 2
  // Step 2: 50% Working Load
  const set2Weight = Math.round(workingWeightKg * 0.5 * 2) / 2
  // Step 3: 70% Working Load
  const set3Weight = Math.round(workingWeightKg * 0.7 * 2) / 2
  // Step 4: 85% Working Load (Potentiation / Primer)
  const set4Weight = Math.round(workingWeightKg * 0.85 * 2) / 2

  const sets: WarmupSet[] = [
    {
      setNumber: 1,
      percentageLabel: 'Unloaded / Mobility',
      calculatedWeightKg: set1Weight,
      repsLabel: '8–10 reps',
      note: 'Focus on full range of motion & joint lubrication'
    },
    {
      setNumber: 2,
      percentageLabel: '50% Load',
      calculatedWeightKg: set2Weight,
      repsLabel: '5 reps',
      note: 'Controlled tempo & groove the motor pattern'
    },
    {
      setNumber: 3,
      percentageLabel: '70% Load',
      calculatedWeightKg: set3Weight,
      repsLabel: '3 reps',
      note: 'Moderate speed & explosive concentric'
    },
    {
      setNumber: 4,
      percentageLabel: '85% Load',
      calculatedWeightKg: set4Weight,
      repsLabel: '1–2 reps',
      note: 'Neuromuscular primer without generating fatigue'
    }
  ]

  return {
    hasProtocol: true,
    workingWeightKg,
    sets,
    explanation: `4-step preparation ladder for ${workingWeightKg} kg target working weight. Adjust based on equipment and feel.`
  }
}
