export type MovementPatternType =
  | 'Horizontal Push'
  | 'Vertical Push'
  | 'Horizontal Pull'
  | 'Vertical Pull'
  | 'Knee Dominant'
  | 'Hip Hinge'
  | 'Isolation / Accessory'
  | 'Cardio / Dynamic'

export interface MovementPatternResult {
  exerciseName: string
  pattern: MovementPatternType
  primaryPlane: string
  patternDescription: string
}

/**
 * Curated exercise taxonomy for deterministic kinesiology movement pattern classification.
 */
const PATTERN_DATABASE: Array<{ regex: RegExp; pattern: MovementPatternType; plane: string; description: string }> = [
  {
    regex: /overhead|military|shoulder press|arnold|handstand|pike push/i,
    pattern: 'Vertical Push',
    plane: 'Frontal / Sagittal',
    description: 'Deltoids, clavicular head, and triceps pressing movement in vertical plane.'
  },
  {
    regex: /bench|incline|decline|chest press|dumbbell press|push-up|pushup|push up|fly|flye|dip/i,
    pattern: 'Horizontal Push',
    plane: 'Sagittal / Transverse',
    description: 'Pectoralis, anterior deltoid, and triceps pressing movement in horizontal plane.'
  },
  {
    regex: /barbell row|dumbbell row|cable row|inverted row|face pull|seated row/i,
    pattern: 'Horizontal Pull',
    plane: 'Sagittal / Transverse',
    description: 'Latissimus dorsi, rhomboids, rear deltoids, and biceps pulling in horizontal plane.'
  },
  {
    regex: /pull-up|pullup|chin-up|chinup|lat pulldown/i,
    pattern: 'Vertical Pull',
    plane: 'Frontal / Sagittal',
    description: 'Latissimus dorsi, lower trapezius, and biceps vertical pulling movement.'
  },
  {
    regex: /squat|leg press|lunge|split squat|step-up|hack squat|quad/i,
    pattern: 'Knee Dominant',
    plane: 'Sagittal',
    description: 'Quadriceps, gluteus maximus, and adductors lower-body knee extension movement.'
  },
  {
    regex: /deadlift|rdl|romanian|good morning|hip thrust|kettlebell swing|glute bridge/i,
    pattern: 'Hip Hinge',
    plane: 'Sagittal',
    description: 'Hamstrings, gluteus maximus, and erector spinae posterior chain extension movement.'
  },
  {
    regex: /curl|extension|lateral raise|calf raise|shrug|plank|crunch|ab|abs|twist/i,
    pattern: 'Isolation / Accessory',
    plane: 'Multi-planar',
    description: 'Targeted single-joint accessory or core stabilization movement.'
  }
]

/**
 * Deterministically classifies an exercise by its primary movement pattern.
 */
export function getMovementPattern(rawExerciseName: string | null | undefined): MovementPatternResult {
  const name = (rawExerciseName || '').trim()
  if (!name) {
    return {
      exerciseName: 'Unknown',
      pattern: 'Isolation / Accessory',
      primaryPlane: 'General',
      patternDescription: 'General training movement.'
    }
  }

  for (const entry of PATTERN_DATABASE) {
    if (entry.regex.test(name)) {
      return {
        exerciseName: name,
        pattern: entry.pattern,
        primaryPlane: entry.plane,
        patternDescription: entry.description
      }
    }
  }

  return {
    exerciseName: name,
    pattern: 'Isolation / Accessory',
    primaryPlane: 'General',
    patternDescription: 'Accessory or conditioning movement.'
  }
}
