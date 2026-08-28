import { normalizeExerciseName } from '@/lib/personalRecords'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

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

export interface HistoricalWorkoutLike {
  id?: string
  date?: string
  completedAt?: number | string
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
  exercisesSummary?: CompletedWorkoutLog['exercisesSummary']
}

/**
 * Deterministically calculates multi-session overload and load progression trajectory for an exercise.
 *
 * V11-O1 READ-PATH ENHANCEMENT:
 * Supports canonical CompletedWorkoutLog records by reading exercisesSummary[].peakWeightKg and avgCompletedReps.
 * Also preserves support for structured sessionData if present.
 */
export function calculateExerciseProgression(
  rawExerciseName: string | null | undefined,
  workoutHistory: Array<CompletedWorkoutLog | HistoricalWorkoutLike> | null | undefined
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
    if (!item || typeof item !== 'object') continue

    let timestamp = 0
    if (typeof item.completedAt === 'number') {
      timestamp = item.completedAt
    } else if (typeof item.completedAt === 'string') {
      const parsed = new Date(item.completedAt).getTime()
      timestamp = isNaN(parsed) ? 0 : parsed
    } else if ('date' in item && typeof item.date === 'string') {
      const parsed = new Date(item.date).getTime()
      timestamp = isNaN(parsed) ? 0 : parsed
    }

    // 1. Primary path: CompletedWorkoutLog with exercisesSummary
    if (Array.isArray(item.exercisesSummary)) {
      for (const ex of item.exercisesSummary) {
        if (!ex || typeof ex.name !== 'string') continue
        if (normalizeExerciseName(ex.name) === targetNorm) {
          const w = typeof ex.peakWeightKg === 'number' && Number.isFinite(ex.peakWeightKg) && ex.peakWeightKg > 0 && ex.peakWeightKg < 600
            ? ex.peakWeightKg
            : (typeof (ex as Record<string, unknown>).weightKg === 'number' ? (ex as Record<string, unknown>).weightKg as number : null)

          if (w !== null && w > 0 && w < 600) {
            const r = typeof ex.avgCompletedReps === 'number' && Number.isFinite(ex.avgCompletedReps) && ex.avgCompletedReps > 0
              ? ex.avgCompletedReps
              : (typeof (ex as Record<string, unknown>).reps === 'number' ? (ex as Record<string, unknown>).reps as number : 1)
            matchingSessions.push({ weight: w, reps: r, timestamp })
            break
          }
        }
      }
      continue
    }

    // 2. Legacy / sessionData path
    if ('sessionData' in item && item.sessionData?.exercises && Array.isArray(item.sessionData.exercises)) {
      for (const ex of item.sessionData.exercises) {
        if (!ex?.name) continue
        if (normalizeExerciseName(ex.name) === targetNorm && Array.isArray(ex.sets)) {
          for (const s of ex.sets) {
            if (s.completed) {
              const w = typeof s.weightKg === 'number' ? s.weightKg : typeof s.weight === 'number' ? s.weight : 0
              const r = typeof s.actualReps === 'number' ? s.actualReps : typeof s.reps === 'number' ? s.reps : 0
              if (w > 0 && r > 0 && w < 600) {
                matchingSessions.push({ weight: w, reps: r, timestamp })
                break // Take top set of that session
              }
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

  // Sort by timestamp descending (newest first)
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
