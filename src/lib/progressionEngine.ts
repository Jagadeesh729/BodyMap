import type { CompletedWorkoutLog } from '@/types/workoutSession'

export interface ExerciseHistoryRecord {
  exerciseName: string
  normalizedName: string
  lastWeightKg: number | null
  lastReps: number
  lastCompletedAt: string
  dayTitle: string
  suggestedStartingWeightKg: number | null
  factualSummary: string
}

/**
 * Approved normalization alias dictionary for deterministic exercise identity matching.
 */
const APPROVED_ALIASES: Record<string, string> = {
  'bench press': 'barbell bench press',
  'flat bench press': 'barbell bench press',
  'flat barbell bench press': 'barbell bench press',
  'db bench press': 'dumbbell bench press',
  'flat dumbbell bench press': 'dumbbell bench press',
  'flat dumbbell press': 'dumbbell bench press',
  'squat': 'barbell back squat',
  'back squat': 'barbell back squat',
  'barbell squat': 'barbell back squat',
  'deadlift': 'barbell deadlift',
  'conventional deadlift': 'barbell deadlift',
  'ohp': 'barbell overhead press',
  'overhead press': 'barbell overhead press',
  'military press': 'barbell overhead press',
  'db shoulder press': 'dumbbell shoulder press',
  'seated dumbbell shoulder press': 'dumbbell shoulder press',
  'barbell row': 'barbell bent over row',
  'bent over row': 'barbell bent over row',
  'bent over barbell row': 'barbell bent over row',
  'lat pulldown': 'cable lat pulldown',
  'pull down': 'cable lat pulldown',
  'bicep curl': 'dumbbell bicep curl',
  'db bicep curl': 'dumbbell bicep curl',
  'db curl': 'dumbbell bicep curl',
  'tricep pushdown': 'cable tricep pushdown',
  'triceps pushdown': 'cable tricep pushdown'
}

/**
 * Normalizes exercise names deterministically (lowercase, strip punctuation, strip sets/reps annotations).
 */
export function normalizeExerciseName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') return ''

  // Strip sets/reps prefixes or suffixes like ": 3 sets x 10 reps" or "(60s rest)"
  let clean = rawName
    .split(':')[0]
    .split('(')[0]
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (APPROVED_ALIASES[clean]) {
    clean = APPROVED_ALIASES[clean]
  }

  return clean
}

/**
 * Finds the most recent valid historical performance for an exercise from completed workout history.
 */
export function findPreviousPerformance(
  currentExerciseName: string,
  history: CompletedWorkoutLog[]
): ExerciseHistoryRecord | null {
  if (!currentExerciseName || !Array.isArray(history) || history.length === 0) {
    return null
  }

  const targetNormalized = normalizeExerciseName(currentExerciseName)
  if (!targetNormalized) return null

  // Sort history newest first by completedAt
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  )

  for (const log of sortedHistory) {
    if (!log || !Array.isArray(log.exercisesSummary)) continue

    for (const ex of log.exercisesSummary) {
      if (!ex || typeof ex.name !== 'string') continue

      const historicalNormalized = normalizeExerciseName(ex.name)
      if (historicalNormalized === targetNormalized) {
        // Look for valid recorded weights and reps
        const reps = typeof ex.avgCompletedReps === 'number' && ex.avgCompletedReps > 0
          ? ex.avgCompletedReps
          : (typeof ex.setsCompleted === 'number' && ex.setsCompleted > 0 ? ex.setsCompleted : 10)
        // Check if weight was logged in exercisesSummary or session
        const weightKg = typeof ex.peakWeightKg === 'number' && Number.isFinite(ex.peakWeightKg) && ex.peakWeightKg > 0 && ex.peakWeightKg < 600
          ? ex.peakWeightKg
          : (typeof (ex as Record<string, unknown>).weightKg === 'number' ? (ex as Record<string, unknown>).weightKg as number : null)

        const factualSummary = weightKg !== null && weightKg > 0
          ? `Last session: ${weightKg} kg (${ex.setsCompleted}/${ex.totalSets} sets done)`
          : `Last session: ${ex.setsCompleted}/${ex.totalSets} sets completed`

        return {
          exerciseName: ex.name,
          normalizedName: targetNormalized,
          lastWeightKg: weightKg,
          lastReps: reps,
          lastCompletedAt: log.completedAt,
          dayTitle: log.dayTitle || 'Previous Workout',
          suggestedStartingWeightKg: weightKg,
          factualSummary
        }
      }
    }
  }

  return null
}
