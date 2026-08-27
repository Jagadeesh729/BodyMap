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
 */
export function calculateDeloadAdvisory(
  workoutHistory: Array<{ date: string; volumeKg?: number; sets?: number }> | null | undefined
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
    if (!item || !item.date) continue
    const itemDate = new Date(item.date)
    if (isNaN(itemDate.getTime())) continue

    const diffDays = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays >= 0 && diffDays < 28) {
      const weekIdx = Math.floor(diffDays / 7)
      if (weekIdx >= 0 && weekIdx < 4) {
        const vol = typeof item.volumeKg === 'number' && !isNaN(item.volumeKg)
          ? item.volumeKg
          : ((item.sets || 0) * 10 * 20) // Heuristic estimate if volume unlogged
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
