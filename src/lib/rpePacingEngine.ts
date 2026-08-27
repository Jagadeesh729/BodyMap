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
