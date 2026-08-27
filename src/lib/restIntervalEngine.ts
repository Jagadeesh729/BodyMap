import { normalizeExerciseName } from './personalRecords'

export type MovementType = 'compound' | 'isolation' | 'cardio' | 'unknown'

export interface RestRecommendationResult {
  movementType: MovementType
  recommendedRestSeconds: number
  rangeLabel: string
  explanation: string
}

/**
 * Deterministically classifies movement into compound, isolation, or cardio based on approved dictionary.
 */
export function classifyMovementType(rawName: string): MovementType {
  const norm = normalizeExerciseName(rawName)
  if (!norm) return 'unknown'

  // Cardio / Core
  if (/plank|crunch|core|\babs?\b|abdominal|hiit|running|cycling|treadmill|jump rope/i.test(norm)) {
    return 'cardio'
  }

  // Major multi-joint compound movements
  if (
    /squat|deadlift|bench press|overhead press|military press|barbell row|bent over row|pull\s*up|chin\s*up|dips|leg press|lunge|rdl|romanian deadlift/i.test(norm)
  ) {
    return 'compound'
  }

  // Single-joint isolation / accessory movements
  if (
    /curl|lateral raise|front raise|tricep|pushdown|extension|fly|pec dec|calf|calves|shrug|leg curl|leg extension|face pull/i.test(norm)
  ) {
    return 'isolation'
  }

  return 'unknown'
}

/**
 * Deterministically calculates recommended starting rest interval.
 * Labeled strictly as starting reference guidance, not a universal requirement.
 */
export function calculateRecommendedRestSeconds(
  exerciseName: string,
  targetReps?: number | null
): RestRecommendationResult {
  const movementType = classifyMovementType(exerciseName)
  const reps = typeof targetReps === 'number' && !isNaN(targetReps) && targetReps > 0 ? targetReps : 8

  if (movementType === 'compound') {
    if (reps <= 5) {
      return {
        movementType,
        recommendedRestSeconds: 180,
        rangeLabel: '120–180s',
        explanation: 'Heavy compound lift (≤ 5 reps): ~180s recommended for full phosphagen (ATP-CP) recovery.'
      }
    }
    return {
      movementType,
      recommendedRestSeconds: 120,
      rangeLabel: '90–120s',
      explanation: 'Compound hypertrophy lift: ~120s recommended for mechanical tension and fatigue clearance.'
    }
  }

  if (movementType === 'isolation') {
    if (reps > 12) {
      return {
        movementType,
        recommendedRestSeconds: 60,
        rangeLabel: '45–60s',
        explanation: 'High-rep isolation accessory (> 12 reps): ~60s recommended for metabolic conditioning.'
      }
    }
    return {
      movementType,
      recommendedRestSeconds: 90,
      rangeLabel: '60–90s',
      explanation: 'Accessory isolation work: ~90s recommended for local muscle recovery.'
    }
  }

  // Cardio / Unknown
  return {
    movementType,
    recommendedRestSeconds: 90,
    rangeLabel: '60–90s',
    explanation: 'Standard baseline: ~90s starting rest interval.'
  }
}
