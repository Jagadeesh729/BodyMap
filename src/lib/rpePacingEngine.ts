export interface RpePacingResult {
  isValid: boolean
  rpe: number
  estimatedRIR: number
  effortLevel: 'maximal' | 'heavy' | 'moderate' | 'submaximal'
  summaryLabel: string
  explanation: string
}

/**
 * Deterministically calculates Reps in Reserve (RIR) from Rating of Perceived Exertion (RPE).
 * Strictly labeled as a training exertion framework reference, not an objective physiological measurement.
 */
export function calculateRIRFromRPE(
  inputRpe: number | string | null | undefined
): RpePacingResult {
  const rpeNum = typeof inputRpe === 'string' ? parseFloat(inputRpe) : (typeof inputRpe === 'number' ? inputRpe : NaN)

  if (isNaN(rpeNum) || rpeNum < 6.0 || rpeNum > 10.0) {
    return {
      isValid: false,
      rpe: 0,
      estimatedRIR: 0,
      effortLevel: 'submaximal',
      summaryLabel: 'Invalid RPE',
      explanation: 'RPE must be a numeric value between 6.0 and 10.0.'
    }
  }

  // Round to nearest 0.5 for standard training quantization
  const normalizedRpe = Math.round(rpeNum * 2) / 2
  const estimatedRIR = Math.max(0, Math.round((10 - normalizedRpe) * 10) / 10)

  let effortLevel: 'maximal' | 'heavy' | 'moderate' | 'submaximal' = 'moderate'
  let summaryLabel = `${normalizedRpe} RPE ≈ ${estimatedRIR} RIR`

  if (normalizedRpe >= 9.5) {
    effortLevel = 'maximal'
    summaryLabel = `${normalizedRpe} RPE ≈ ${estimatedRIR} RIR (Max Effort / Limit)`
  } else if (normalizedRpe >= 8.5) {
    effortLevel = 'heavy'
    summaryLabel = `${normalizedRpe} RPE ≈ ${estimatedRIR} RIR (Heavy Working Load)`
  } else if (normalizedRpe >= 7.5) {
    effortLevel = 'moderate'
    summaryLabel = `${normalizedRpe} RPE ≈ ${estimatedRIR} RIR (Moderate Working Load)`
  } else {
    effortLevel = 'submaximal'
    summaryLabel = `${normalizedRpe} RPE ≈ ${estimatedRIR} RIR (Submaximal / Warm-up)`
  }

  return {
    isValid: true,
    rpe: normalizedRpe,
    estimatedRIR,
    effortLevel,
    summaryLabel,
    explanation: `At ${normalizedRpe} RPE, estimated proximity to failure is approximately ${estimatedRIR} reps in reserve (RIR).`
  }
}

export interface RpeRecommendation extends RpePacingResult {
  movementClassification: string
  isUserOverride: boolean
  disclaimer: string
}

/**
 * Deterministically derives an evidence-aligned general training RPE heuristic based on exercise type.
 * Allows user override. Formulated as non-medical training guidance.
 */
export function getHeuristicRpeRecommendation(
  rawExerciseName: string | null | undefined,
  userOverrideRpe?: number | string | null
): RpeRecommendation {
  const disclaimer = 'General training exertion heuristic for resistance exercise programming. Not individualized medical guidance. Adjust effort based on personal fatigue, recovery, and form integrity.'

  // 1. Check user override first
  if (userOverrideRpe !== undefined && userOverrideRpe !== null && userOverrideRpe !== '') {
    const overrideResult = calculateRIRFromRPE(userOverrideRpe)
    if (overrideResult.isValid) {
      return {
        ...overrideResult,
        movementClassification: 'User Custom Target',
        isUserOverride: true,
        disclaimer
      }
    }
  }

  const name = (rawExerciseName || '').toLowerCase().trim()

  // 2. Classify movement pattern heuristics conservatively
  let targetRpe = 8.0
  let classification = 'General Working Exercise'

  if (/squat|deadlift|bench press|overhead press|military press|barbell row/i.test(name)) {
    // Primary heavy multi-joint compound: RPE 7.5–8.0 (2–2.5 RIR to maintain technical form integrity under axial load)
    targetRpe = 8.0
    classification = 'Primary Compound (High Axial Load)'
  } else if (/lunge|split squat|leg press|romanian|rdl|hip thrust|dumbbell row|cable row|lat pulldown|incline press|push-up|pull-up|dip/i.test(name)) {
    // Secondary compound / accessory: RPE 8.0–8.5 (1.5–2 RIR)
    targetRpe = 8.0
    classification = 'Secondary Compound / Accessory'
  } else if (/curl|extension|lateral raise|fly|flye|calf|shrug|face pull|crunch|plank/i.test(name)) {
    // Single-joint isolation / finisher: RPE 8.5 (1.5 RIR; safe to train closer to failure)
    targetRpe = 8.5
    classification = 'Isolation / Accessory Finisher'
  } else if (/mobility|stretch|dynamic|warmup|warm-up|cooldown|cool-down|walk|jog|yoga/i.test(name)) {
    // Active recovery / mobility: RPE 6.0 (Submaximal restorative effort)
    targetRpe = 6.0
    classification = 'Mobility / Active Recovery'
  } else {
    // Default fallback
    targetRpe = 8.0
    classification = 'Standard Resistance Exercise'
  }

  const baseResult = calculateRIRFromRPE(targetRpe)
  return {
    ...baseResult,
    movementClassification: classification,
    isUserOverride: false,
    disclaimer
  }
}
