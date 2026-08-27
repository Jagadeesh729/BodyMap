import { normalizeExerciseName } from '@/lib/personalRecords'

export type ProgressionTrajectoryType = 'increasing_load' | 'maintaining_load' | 'reducing_load' | 'baseline'

export interface ExerciseProgressionResult {
  hasHistory: boolean
  exerciseName: string
  latestWorkingWeightKg: number | null
  latestReps: number | null
  previousWorkingWeightKg: number | null
  previousReps: number | null
  weightDeltaKg: number | null
  percentageDelta: number | null
  trajectory: ProgressionTrajectoryType
  trajectoryLabel: string
  progressionSummary: string
}

interface HistoricalWorkoutLike {
  id?: string
  date?: string
  completedAt?: number
  sessionData?: {
    exercises?: Array<{
      name?: string
      sets?: Array<{
        weightKg?: number
        actualReps?: number
        weight?: number
        reps?: number
        completed?: boolean
      }>
    }>
  }
}

/**
 * Deterministically calculates multi-session overload and load progression trajectory for an exercise.
 */
export function calculateExerciseProgression(
  rawExerciseName: string | null | undefined,
  workoutHistory: HistoricalWorkoutLike[] | null | undefined
): ExerciseProgressionResult {
  const name = (rawExerciseName || '').trim()
  if (!name || !Array.isArray(workoutHistory) || workoutHistory.length === 0) {
    return {
      hasHistory: false,
      exerciseName: name || 'Unknown',
      latestWorkingWeightKg: null,
      latestReps: null,
      previousWorkingWeightKg: null,
      previousReps: null,
      weightDeltaKg: null,
      percentageDelta: null,
      trajectory: 'baseline',
      trajectoryLabel: 'First Recorded Session',
      progressionSummary: 'No previous session logs found for progressive overload comparison.'
    }
  }

  const targetNorm = normalizeExerciseName(name)
  const matchingSessions: Array<{ weight: number; reps: number; timestamp: number }> = []

  for (const item of workoutHistory) {
    if (!item?.sessionData?.exercises) continue

    const timestamp = item.completedAt || (item.date ? new Date(item.date).getTime() : 0)
    for (const ex of item.sessionData.exercises) {
      if (!ex?.name) continue
      if (normalizeExerciseName(ex.name) === targetNorm && Array.isArray(ex.sets)) {
        for (const s of ex.sets) {
          if (s.completed) {
            const w = typeof s.weightKg === 'number' ? s.weightKg : typeof s.weight === 'number' ? s.weight : 0
            const r = typeof s.actualReps === 'number' ? s.actualReps : typeof s.reps === 'number' ? s.reps : 0
            if (w > 0 && r > 0) {
              matchingSessions.push({ weight: w, reps: r, timestamp })
              break // Take top set of that session
            }
          }
        }
      }
    }
  }

  if (matchingSessions.length === 0) {
    return {
      hasHistory: false,
      exerciseName: name,
      latestWorkingWeightKg: null,
      latestReps: null,
      previousWorkingWeightKg: null,
      previousReps: null,
      weightDeltaKg: null,
      percentageDelta: null,
      trajectory: 'baseline',
      trajectoryLabel: 'Baseline Session',
      progressionSummary: 'First tracked set for this exercise.'
    }
  }

  // Sort by timestamp descending
  matchingSessions.sort((a, b) => b.timestamp - a.timestamp)

  const latest = matchingSessions[0]
  const previous = matchingSessions.length > 1 ? matchingSessions[1] : null

  if (!previous) {
    return {
      hasHistory: true,
      exerciseName: name,
      latestWorkingWeightKg: latest.weight,
      latestReps: latest.reps,
      previousWorkingWeightKg: null,
      previousReps: null,
      weightDeltaKg: null,
      percentageDelta: null,
      trajectory: 'baseline',
      trajectoryLabel: `Baseline: ${latest.weight} kg × ${latest.reps}`,
      progressionSummary: `Logged ${latest.weight} kg × ${latest.reps} reps as baseline working load.`
    }
  }

  const weightDeltaKg = Math.round((latest.weight - previous.weight) * 10) / 10
  const percentageDelta = previous.weight > 0
    ? Math.round(((latest.weight - previous.weight) / previous.weight) * 1000) / 10
    : 0

  let trajectory: ProgressionTrajectoryType = 'maintaining_load'
  let trajectoryLabel = `Maintained: ${latest.weight} kg`

  if (weightDeltaKg > 0) {
    trajectory = 'increasing_load'
    trajectoryLabel = `+${weightDeltaKg} kg (+${percentageDelta}%)`
  } else if (weightDeltaKg < 0) {
    trajectory = 'reducing_load'
    trajectoryLabel = `${weightDeltaKg} kg (${percentageDelta}%)`
  } else if (latest.reps > previous.reps) {
    trajectory = 'increasing_load'
    trajectoryLabel = `+${latest.reps - previous.reps} reps overload`
  }

  return {
    hasHistory: true,
    exerciseName: name,
    latestWorkingWeightKg: latest.weight,
    latestReps: latest.reps,
    previousWorkingWeightKg: previous.weight,
    previousReps: previous.reps,
    weightDeltaKg,
    percentageDelta,
    trajectory,
    trajectoryLabel,
    progressionSummary: `Previous: ${previous.weight} kg × ${previous.reps} → Latest: ${latest.weight} kg × ${latest.reps} (${trajectoryLabel})`
  }
}
