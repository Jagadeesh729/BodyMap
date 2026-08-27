import type { SessionExercise, CompletedWorkoutLog } from '@/types/workoutSession'

export interface SessionVolumeMetrics {
  totalVolumeKg: number
  weightedSetsCount: number
  bodyweightSetsCount: number
}

export interface WorkoutComparisonResult {
  hasComparableSession: boolean
  previousCompletedAt: string | null
  previousVolumeKg: number | null
  volumeDeltaKg: number | null
  volumeDeltaPercent: number | null
  previousDurationMinutes: number | null
  summaryText: string
}

export interface SmartCoachDebrief {
  durationMinutes: number
  totalSetsCompleted: number
  totalExercisesCompleted: number
  volumeMetrics: SessionVolumeMetrics
  comparison: WorkoutComparisonResult
  recoverySuggestion: string
}

/**
 * Calculates total session volume (kg) deterministically from completed sets.
 * Does NOT fabricate weight for bodyweight movements.
 */
export function calculateSessionVolume(exercises: SessionExercise[]): SessionVolumeMetrics {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    return { totalVolumeKg: 0, weightedSetsCount: 0, bodyweightSetsCount: 0 }
  }

  let totalVolumeKg = 0
  let weightedSetsCount = 0
  let bodyweightSetsCount = 0

  for (const ex of exercises) {
    if (!ex || !Array.isArray(ex.sets)) continue

    for (const set of ex.sets) {
      if (!set.isCompleted) continue

      const reps = typeof set.repsCompleted === 'number' && set.repsCompleted > 0
        ? set.repsCompleted
        : (typeof set.targetReps === 'number' ? set.targetReps : 0)

      if (typeof set.weightKg === 'number' && set.weightKg > 0 && reps > 0) {
        totalVolumeKg += set.weightKg * reps
        weightedSetsCount++
      } else {
        bodyweightSetsCount++
      }
    }
  }

  return {
    totalVolumeKg: Math.round(totalVolumeKg * 10) / 10,
    weightedSetsCount,
    bodyweightSetsCount
  }
}

/**
 * Compares current workout workload against the latest valid comparable session in history.
 */
export function compareWorkoutWithPrevious(
  currentDayIndex: number,
  currentVolumeKg: number,
  history: CompletedWorkoutLog[]
): WorkoutComparisonResult {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      hasComparableSession: false,
      previousCompletedAt: null,
      previousVolumeKg: null,
      volumeDeltaKg: null,
      volumeDeltaPercent: null,
      previousDurationMinutes: null,
      summaryText: 'First recorded workout for this training day.'
    }
  }

  // Find latest log for matching dayIndex
  const matchingLog = [...history]
    .filter(log => log && log.dayIndex === currentDayIndex)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0]

  if (!matchingLog) {
    return {
      hasComparableSession: false,
      previousCompletedAt: null,
      previousVolumeKg: null,
      volumeDeltaKg: null,
      volumeDeltaPercent: null,
      previousDurationMinutes: null,
      summaryText: 'First recorded workout for this specific training day.'
    }
  }

  // Estimate previous volume if stored, or calculate from exercisesSummary
  let prevVolume = 0
  if (Array.isArray(matchingLog.exercisesSummary)) {
    for (const ex of matchingLog.exercisesSummary) {
      const weight = (ex as Record<string, unknown>).weightKg as number | undefined
      if (typeof weight === 'number' && weight > 0 && typeof ex.setsCompleted === 'number') {
        prevVolume += weight * (ex.setsCompleted * 10) // 10 reps average fallback
      }
    }
  }

  const prevMins = Math.max(1, Math.round(matchingLog.durationSeconds / 60))
  const hasValidPrevVolume = prevVolume > 0

  if (hasValidPrevVolume && currentVolumeKg > 0) {
    const delta = Math.round((currentVolumeKg - prevVolume) * 10) / 10
    const percent = Math.round((delta / prevVolume) * 100)
    const sign = delta >= 0 ? '+' : ''

    return {
      hasComparableSession: true,
      previousCompletedAt: matchingLog.completedAt,
      previousVolumeKg: prevVolume,
      volumeDeltaKg: delta,
      volumeDeltaPercent: percent,
      previousDurationMinutes: prevMins,
      summaryText: `Workload: ${sign}${delta} kg (${sign}${percent}%) vs previous session on ${new Date(matchingLog.completedAt).toLocaleDateString()}`
    }
  }

  return {
    hasComparableSession: true,
    previousCompletedAt: matchingLog.completedAt,
    previousVolumeKg: hasValidPrevVolume ? prevVolume : null,
    volumeDeltaKg: null,
    volumeDeltaPercent: null,
    previousDurationMinutes: prevMins,
    summaryText: `Previous session completed on ${new Date(matchingLog.completedAt).toLocaleDateString()} (${prevMins} mins)`
  }
}

/**
 * Generates non-medical, conservative post-workout recovery suggestion.
 */
export function generateRecoveryAdvice(
  durationSeconds: number,
  totalSetsCompleted: number,
  volumeMetrics: SessionVolumeMetrics
): string {
  const durationMins = Math.round(durationSeconds / 60)

  if (totalSetsCompleted >= 15 || volumeMetrics.totalVolumeKg >= 3000 || durationMins >= 60) {
    return 'High-volume session completed. Prioritize nutrient-dense recovery meals, adequate hydration, and 24–48 hours before retraining this target muscle group.'
  }

  if (totalSetsCompleted >= 8 || volumeMetrics.totalVolumeKg >= 1000) {
    return 'Moderate stimulus achieved. Support recovery with balanced protein intake and adequate sleep.'
  }

  return 'Focused session logged. Ensure good hydration and light mobility work as you recover.'
}
