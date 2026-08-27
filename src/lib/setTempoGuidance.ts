export interface TempoGuidanceResult {
  tempoString: string // e.g. "3-0-1-0"
  eccentricSeconds: number
  bottomPauseSeconds: number
  concentricSeconds: number
  topPauseSeconds: number
  summaryLabel: string
  explanation: string
}

/**
 * Deterministically recommends repetition cadence based on training goal and movement type.
 * Labeled strictly as a suggested tempo reference, not a universal or mandatory prescription.
 */
export function getRecommendedRepTempo(
  goal?: string | null,
  movementType?: string | null
): TempoGuidanceResult {
  const normGoal = (goal || '').toLowerCase().trim()
  const normType = (movementType || '').toLowerCase().trim()

  // Cardio / Core / Mobility
  if (normType === 'cardio') {
    return {
      tempoString: 'Smooth',
      eccentricSeconds: 1,
      bottomPauseSeconds: 0,
      concentricSeconds: 1,
      topPauseSeconds: 0,
      summaryLabel: 'Smooth / Continuous Cadence',
      explanation: 'Continuous, controlled rhythmic pacing for core or conditioning movements.'
    }
  }

  // Hypertrophy & Muscle Building: 3-0-1-0 (Accentuated eccentric for mechanical tension)
  if (/hypertrophy|muscle|build|mass|bodybuilding/i.test(normGoal)) {
    return {
      tempoString: '3-0-1-0',
      eccentricSeconds: 3,
      bottomPauseSeconds: 0,
      concentricSeconds: 1,
      topPauseSeconds: 0,
      summaryLabel: '3s Lower • 1s Lift (3-0-1-0)',
      explanation: 'Hypertrophy tempo: 3s controlled eccentric lowering, explosive 1s concentric lift.'
    }
  }

  // Pure Strength & Power: 2-0-1-0 (Controlled descent with explosive concentric)
  if (/strength|power|powerlifting|heavy/i.test(normGoal)) {
    return {
      tempoString: '2-0-1-0',
      eccentricSeconds: 2,
      bottomPauseSeconds: 0,
      concentricSeconds: 1,
      topPauseSeconds: 0,
      summaryLabel: '2s Lower • 1s Lift (2-0-1-0)',
      explanation: 'Strength tempo: 2s controlled descent, maximal intent 1s concentric drive.'
    }
  }

  // Endurance & Conditioning: 2-0-2-0 (Even cadence)
  if (/endurance|stamina|tone|toning|conditioning/i.test(normGoal)) {
    return {
      tempoString: '2-0-2-0',
      eccentricSeconds: 2,
      bottomPauseSeconds: 0,
      concentricSeconds: 2,
      topPauseSeconds: 0,
      summaryLabel: '2s Lower • 2s Lift (2-0-2-0)',
      explanation: 'Endurance tempo: Constant 2s lowering and 2s lifting cadence for metabolic stress.'
    }
  }

  // Standard Baseline: 2-0-1-0
  return {
    tempoString: '2-0-1-0',
    eccentricSeconds: 2,
    bottomPauseSeconds: 0,
    concentricSeconds: 1,
    topPauseSeconds: 0,
    summaryLabel: '2s Lower • 1s Lift (2-0-1-0)',
    explanation: 'Standard controlled tempo: 2s lowering with a controlled 1s lifting motion.'
  }
}
