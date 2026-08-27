import type { CompletedWorkoutLog } from '@/types/workoutSession'

export type AnalyticsTimeWindow = 7 | 14 | 30 | 'all'

export interface TimeWindowMetricsSummary {
  window: AnalyticsTimeWindow
  filteredLogs: CompletedWorkoutLog[]
  sessionCount: number
  totalDurationMinutes: number
  totalSetsCompleted: number
  totalExercisesCompleted: number
  factualSummaryLabel: string
}

/**
 * Deterministically filters workout history logs within a specified calendar day window.
 * Respects local-first data sovereignty and never mutates source records.
 *
 * NON-MEDICAL HEURISTIC:
 * Provides historical aggregation of athlete training logs.
 * Never issues clinical diagnoses or physiological certainty.
 */
export function filterLogsByTimeWindow(
  logs: CompletedWorkoutLog[],
  window: AnalyticsTimeWindow = 7,
  referenceDate: Date = new Date()
): TimeWindowMetricsSummary {
  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      window,
      filteredLogs: [],
      sessionCount: 0,
      totalDurationMinutes: 0,
      totalSetsCompleted: 0,
      totalExercisesCompleted: 0,
      factualSummaryLabel: 'No sessions in window'
    }
  }

  const refTime = referenceDate.getTime()
  const windowMillis = window === 'all' ? Infinity : window * 24 * 60 * 60 * 1000

  const filteredLogs = logs.filter(log => {
    if (!log || typeof log.completedAt !== 'string') return false
    const logTime = new Date(log.completedAt).getTime()
    if (isNaN(logTime)) return false
    if (window === 'all') return true
    const ageMillis = refTime - logTime
    return ageMillis >= 0 && ageMillis <= windowMillis
  })

  let totalDurationSeconds = 0
  let totalSetsCompleted = 0
  let totalExercisesCompleted = 0

  for (const log of filteredLogs) {
    totalDurationSeconds += Math.max(0, log.durationSeconds || 0)
    totalSetsCompleted += Math.max(0, log.totalSetsCompleted || 0)
    totalExercisesCompleted += Math.max(0, log.totalExercises || 0)
  }

  const totalDurationMinutes = Math.max(0, Math.round(totalDurationSeconds / 60))
  const sessionCount = filteredLogs.length

  const windowLabel = window === 'all' ? 'All Time' : `Last ${window} Days`
  const factualSummaryLabel = sessionCount > 0
    ? `${sessionCount} session${sessionCount === 1 ? '' : 's'} (${totalDurationMinutes}m, ${totalSetsCompleted} sets) in ${windowLabel}`
    : `0 sessions logged in ${windowLabel}`

  return {
    window,
    filteredLogs,
    sessionCount,
    totalDurationMinutes,
    totalSetsCompleted,
    totalExercisesCompleted,
    factualSummaryLabel
  }
}
