export interface WorkingWeightPercentage {
  percentage: number
  targetRepsLabel: string
  calculatedWeightKg: number
}

export interface OneRepMaxResult {
  hasValidEstimate: boolean
  estimated1rmKg: number | null
  formulaUsed: 'Epley' | 'Brzycki'
  workingWeights: WorkingWeightPercentage[]
  explanation: string
}

/**
 * Deterministically calculates estimated One Rep Max (1RM) and working weight reference ladder.
 * Clearly labeled as an athletic estimate for load planning, not a guaranteed true maximum.
 */
export function calculateEstimated1RM(
  weightKg: number | null | undefined,
  reps: number | null | undefined,
  formula: 'epley' | 'brzycki' = 'epley'
): OneRepMaxResult {
  if (
    typeof weightKg !== 'number' ||
    isNaN(weightKg) ||
    weightKg <= 0 ||
    typeof reps !== 'number' ||
    isNaN(reps) ||
    reps < 1 ||
    reps > 30
  ) {
    return {
      hasValidEstimate: false,
      estimated1rmKg: null,
      formulaUsed: formula === 'brzycki' ? 'Brzycki' : 'Epley',
      workingWeights: [],
      explanation: 'Requires valid positive weight and reps between 1 and 30.'
    }
  }

  let oneRepMax = weightKg

  if (reps === 1) {
    oneRepMax = weightKg
  } else if (formula === 'brzycki') {
    // Brzycki: weight * 36 / (37 - reps)
    oneRepMax = (weightKg * 36) / (37 - reps)
  } else {
    // Epley: weight * (1 + reps / 30)
    oneRepMax = weightKg * (1 + reps / 30)
  }

  const rounded1RM = Math.round(oneRepMax * 2) / 2 // Round to nearest 0.5 kg

  const targetPercentages = [
    { percentage: 90, targetRepsLabel: '3–4 reps' },
    { percentage: 85, targetRepsLabel: '5–6 reps' },
    { percentage: 80, targetRepsLabel: '7–8 reps' },
    { percentage: 75, targetRepsLabel: '9–10 reps' },
    { percentage: 70, targetRepsLabel: '11–12 reps' }
  ]

  const workingWeights: WorkingWeightPercentage[] = targetPercentages.map(p => ({
    percentage: p.percentage,
    targetRepsLabel: p.targetRepsLabel,
    calculatedWeightKg: Math.round((rounded1RM * (p.percentage / 100)) * 2) / 2
  }))

  return {
    hasValidEstimate: true,
    estimated1rmKg: rounded1RM,
    formulaUsed: formula === 'brzycki' ? 'Brzycki' : 'Epley',
    workingWeights,
    explanation: `Estimated ~${rounded1RM} kg 1RM based on ${weightKg} kg × ${reps} reps using the ${formula === 'brzycki' ? 'Brzycki' : 'Epley'} formula.`
  }
}
