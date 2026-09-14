import type { CompletedWorkoutLog } from '@/types/workoutSession'
import { normalizeExerciseName } from '@/lib/progressionEngine'
import { calculateEstimated1RM } from '@/lib/oneRepMax'

export { normalizeExerciseName }

export interface PRTrajectoryPoint {
  date: string
  displayDate: string
  timestamp: number
  weightKg: number
  reps: number | null
  estimated1rmKg: number | null
  sessionTitle: string
  isPRBreakthrough: boolean
}

export interface ExercisePRTrajectory {
  exerciseName: string
  normalizedName: string
  points: PRTrajectoryPoint[]
  allTimePeakWeightKg: number
  allTimePeak1rmKg: number | null
  totalDataPoints: number
  netWeightGainKg: number
  firstRecordedDate: string
  latestRecordedDate: string
}

export interface AvailableTrajectoryExercise {
  name: string
  normalized: string
  count: number
  peakWeightKg: number
}

function formatDisplayDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return isoString
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return isoString
  }
}

/**
 * Deterministically scans workout history and extracts a chronological progression trajectory
 * for a specific exercise, including load progression, estimated 1RM, and PR breakthroughs.
 */
export function extractExercisePRTrajectory(
  history: CompletedWorkoutLog[],
  targetExerciseName: string
): ExercisePRTrajectory | null {
  if (!Array.isArray(history) || history.length === 0) {
    return null
  }

  if (!targetExerciseName || typeof targetExerciseName !== 'string') {
    return null
  }

  const targetNorm = normalizeExerciseName(targetExerciseName)
  if (!targetNorm) {
    return null
  }

  const rawPoints: PRTrajectoryPoint[] = []
  let canonicalName = targetExerciseName.trim()

  for (const log of history) {
    if (!log || typeof log !== 'object' || !Array.isArray(log.exercisesSummary)) {
      continue
    }

    const completedAtStr = typeof log.completedAt === 'string' ? log.completedAt : ''
    const timestamp = new Date(completedAtStr).getTime()
    if (isNaN(timestamp)) {
      continue
    }

    for (const ex of log.exercisesSummary) {
      if (!ex || typeof ex.name !== 'string') continue
      const norm = normalizeExerciseName(ex.name)
      if (norm !== targetNorm) continue

      // Use the exercise name as seen in actual logs
      if (ex.name.trim().length > 0) {
        canonicalName = ex.name.trim()
      }

      // Check peakWeightKg or legacy weightKg
      const weight = typeof ex.peakWeightKg === 'number' && Number.isFinite(ex.peakWeightKg) && ex.peakWeightKg > 0 && ex.peakWeightKg < 600
        ? ex.peakWeightKg
        : (typeof (ex as Record<string, unknown>).weightKg === 'number' &&
           Number.isFinite((ex as Record<string, unknown>).weightKg) &&
           ((ex as Record<string, unknown>).weightKg as number) > 0 &&
           ((ex as Record<string, unknown>).weightKg as number) < 600
            ? ((ex as Record<string, unknown>).weightKg as number)
            : undefined)

      if (typeof weight !== 'number') continue

      // Rep count extraction
      const reps = typeof ex.avgCompletedReps === 'number' && Number.isFinite(ex.avgCompletedReps) && ex.avgCompletedReps > 0
        ? Math.round(ex.avgCompletedReps)
        : (typeof (ex as Record<string, unknown>).completedReps === 'number' &&
           Number.isFinite((ex as Record<string, unknown>).completedReps) &&
           ((ex as Record<string, unknown>).completedReps as number) > 0
            ? Math.round((ex as Record<string, unknown>).completedReps as number)
            : null)

      const est1rm = reps !== null ? calculateEstimated1RM(weight, reps) : null

      rawPoints.push({
        date: completedAtStr,
        displayDate: formatDisplayDate(completedAtStr),
        timestamp,
        weightKg: weight,
        reps,
        estimated1rmKg: est1rm?.hasValidEstimate && typeof est1rm.estimated1rmKg === 'number' ? est1rm.estimated1rmKg : null,
        sessionTitle: typeof log.dayTitle === 'string' && log.dayTitle.trim().length > 0 ? log.dayTitle : 'Gym Session',
        isPRBreakthrough: false
      })
    }
  }

  if (rawPoints.length === 0) {
    return null
  }

  // Chronological sort ascending; tie-break equal timestamps by weight ascending
  const sorted = rawPoints.sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp
    }
    return a.weightKg - b.weightKg
  })

  // Flag breakthrough points and calculate peak 1RM
  let runningPeakWeight = 0
  let allTimePeak1rm: number | null = null

  for (const pt of sorted) {
    if (pt.weightKg > runningPeakWeight) {
      pt.isPRBreakthrough = true
      runningPeakWeight = pt.weightKg
    } else {
      pt.isPRBreakthrough = false
    }

    if (pt.estimated1rmKg !== null) {
      if (allTimePeak1rm === null || pt.estimated1rmKg > allTimePeak1rm) {
        allTimePeak1rm = pt.estimated1rmKg
      }
    }
  }

  const firstPoint = sorted[0]
  const latestPoint = sorted[sorted.length - 1]
  const netGain = sorted.length >= 2
    ? Number((latestPoint.weightKg - firstPoint.weightKg).toFixed(1))
    : 0

  return {
    exerciseName: canonicalName,
    normalizedName: targetNorm,
    points: sorted,
    allTimePeakWeightKg: runningPeakWeight,
    allTimePeak1rmKg: allTimePeak1rm,
    totalDataPoints: sorted.length,
    netWeightGainKg: netGain,
    firstRecordedDate: firstPoint.date,
    latestRecordedDate: latestPoint.date
  }
}

/**
 * Returns an inventory of all exercises in the workout history that have at least
 * one logged weight data point, ordered by frequency of sessions.
 */
export function getAvailableExercisesForTrajectory(
  history: CompletedWorkoutLog[]
): AvailableTrajectoryExercise[] {
  if (!Array.isArray(history) || history.length === 0) {
    return []
  }

  const map = new Map<string, { name: string; count: number; peak: number }>()

  for (const log of history) {
    if (!log || !Array.isArray(log.exercisesSummary)) continue
    for (const ex of log.exercisesSummary) {
      if (!ex || typeof ex.name !== 'string') continue
      const norm = normalizeExerciseName(ex.name)
      if (!norm) continue

      const weight = typeof ex.peakWeightKg === 'number' && Number.isFinite(ex.peakWeightKg) && ex.peakWeightKg > 0 && ex.peakWeightKg < 600
        ? ex.peakWeightKg
        : (typeof (ex as Record<string, unknown>).weightKg === 'number' &&
           Number.isFinite((ex as Record<string, unknown>).weightKg) &&
           ((ex as Record<string, unknown>).weightKg as number) > 0 &&
           ((ex as Record<string, unknown>).weightKg as number) < 600
            ? ((ex as Record<string, unknown>).weightKg as number)
            : undefined)

      if (typeof weight !== 'number') continue

      const existing = map.get(norm)
      if (existing) {
        existing.count += 1
        if (weight > existing.peak) {
          existing.peak = weight
        }
      } else {
        map.set(norm, {
          name: ex.name.trim(),
          count: 1,
          peak: weight
        })
      }
    }
  }

  return Array.from(map.entries())
    .map(([normalized, data]) => ({
      name: data.name,
      normalized,
      count: data.count,
      peakWeightKg: data.peak
    }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count
      }
      return b.peakWeightKg - a.peakWeightKg
    })
}
