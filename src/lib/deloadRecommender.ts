import type { CompletedWorkoutLog } from '@/types/workoutSession'

export interface DeloadAdvisoryResult {
  hasData: boolean
  status: 'optimal_training' | 'consider_deload' | 'deload_recommended'
  consecutiveWeeksActive: number
  recent7DayVolumeKg: number
  baselineAvgWeeklyVolumeKg: number
  tierLabel: string
  advisoryMessage: string
  explanation: string
}

/**
 * Deterministically calculates a training deload advisory from workout history.
 * Explicitly labeled as an advisory training heuristic, not a physiological diagnosis.
 * Accepts the canonical CompletedWorkoutLog contract and reads completedAt for date bucketing.
 */
export function calculateDeloadAdvisory(
  workoutHistory: CompletedWorkoutLog[] | null | undefined
): DeloadAdvisoryResult {
  if (!Array.isArray(workoutHistory) || workoutHistory.length === 0) {
    return {
      hasData: false,
      status: 'optimal_training',
      consecutiveWeeksActive: 0,
      recent7DayVolumeKg: 0,
      baselineAvgWeeklyVolumeKg: 0,
      tierLabel: 'Optimal Training Load',
      advisoryMessage: 'Normal training baseline.',
      explanation: 'No recent workout history logged. Continue planned training program.'
    }
  }

  const now = new Date()
  const weekBuckets: number[] = [0, 0, 0, 0] // [Week 0 (most recent 7d), Week 1, Week 2, Week 3]

  for (const item of workoutHistory) {
    if (!item || !item.completedAt) continue
    const itemDate = new Date(item.completedAt)
    if (isNaN(itemDate.getTime())) continue

    const diffDays = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays >= 0 && diffDays < 28) {
      const weekIdx = Math.floor(diffDays / 7)
      if (weekIdx >= 0 && weekIdx < 4) {
        // Use total sets as a volume proxy when per-exercise weight is not available at this level.
        // Sets * 10 * 20 is the same heuristic used historically for volume estimation.
        const vol = (item.totalSetsCompleted || 0) * 10 * 20
        weekBuckets[weekIdx] += vol
      }
    }
  }

  const activeWeeksCount = weekBuckets.filter(v => v > 0).length
  const recent7DayVolumeKg = weekBuckets[0] || 0
  const priorWeeks = weekBuckets.slice(1).filter(v => v > 0)
  const baselineAvgWeeklyVolumeKg = priorWeeks.length > 0
    ? Math.round(priorWeeks.reduce((a, b) => a + b, 0) / priorWeeks.length)
    : recent7DayVolumeKg

  let status: DeloadAdvisoryResult['status'] = 'optimal_training'
  let tierLabel = 'Optimal Training Load'
  let advisoryMessage = 'Training load is well within normal progression.'
  let explanation = 'Continue planned weekly volume and intensity.'

  if (activeWeeksCount >= 4) {
    status = 'deload_recommended'
    tierLabel = 'Deload Recommended'
    advisoryMessage = 'Sustained 4+ consecutive weeks of high training volume detected.'
    explanation = 'Consider scheduling a structured deload week (reducing volume by ~40-50% while maintaining form) to support recovery.'
  } else if (activeWeeksCount >= 3) {
    status = 'consider_deload'
    tierLabel = 'Consider Deload Soon'
    advisoryMessage = 'Elevated 3-week cumulative training volume.'
    explanation = 'Review recovery markers. A lower-load deload session or week may be beneficial after week 4.'
  }

  return {
    hasData: true,
    status,
    consecutiveWeeksActive: activeWeeksCount,
    recent7DayVolumeKg,
    baselineAvgWeeklyVolumeKg,
    tierLabel,
    advisoryMessage,
    explanation
  }
}
