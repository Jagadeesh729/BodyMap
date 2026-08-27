import type { CompletedWorkoutLog } from '@/types/workoutSession'

export interface TimeSinceLastWorkoutResult {
  hasHistory: boolean
  lastCompletedAt: string | null
  lastSessionTitle: string | null
  elapsedHours: number | null
  formattedTimeAgo: string
  bucketLabel: string
  guidanceNote: string
}

/**
 * Deterministically calculates time elapsed since latest completed workout.
 * Strictly labeled as a time-based indicator, not a physiological diagnosis or medical proof.
 */
export function calculateTimeSinceLastWorkout(
  history: CompletedWorkoutLog[] | null | undefined,
  referenceDate: Date | string = new Date()
): TimeSinceLastWorkoutResult {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      hasHistory: false,
      lastCompletedAt: null,
      lastSessionTitle: null,
      elapsedHours: null,
      formattedTimeAgo: 'No workouts completed yet',
      bucketLabel: 'No history',
      guidanceNote: 'Complete a workout session in Gym Mode to begin tracking your training cadence.'
    }
  }

  // Filter valid logs and sort chronologically descending (newest first)
  const validLogs = history.filter(
    log => log && typeof log.completedAt === 'string' && !isNaN(new Date(log.completedAt).getTime())
  )

  if (validLogs.length === 0) {
    return {
      hasHistory: false,
      lastCompletedAt: null,
      lastSessionTitle: null,
      elapsedHours: null,
      formattedTimeAgo: 'No valid timestamp',
      bucketLabel: 'No history',
      guidanceNote: 'Complete a workout session in Gym Mode to begin tracking your training cadence.'
    }
  }

  const sorted = [...validLogs].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  )

  const latest = sorted[0]
  const latestTime = new Date(latest.completedAt).getTime()
  const refTime = typeof referenceDate === 'string' ? new Date(referenceDate).getTime() : referenceDate.getTime()

  // Guard against negative elapsed time if clock discrepancy or future date
  const diffMs = Math.max(0, refTime - latestTime)
  const elapsedHours = Math.floor(diffMs / (1000 * 60 * 60))

  let formattedTimeAgo = ''
  let bucketLabel = ''
  let guidanceNote = ''

  if (elapsedHours < 1) {
    formattedTimeAgo = 'Just completed'
    bucketLabel = '< 24h since last session'
    guidanceNote = 'Recent session completed. Prioritize adequate post-workout nutrition and hydration.'
  } else if (elapsedHours < 24) {
    formattedTimeAgo = `${elapsedHours} hour${elapsedHours > 1 ? 's' : ''} ago`
    bucketLabel = '< 24h since last session'
    guidanceNote = 'Session completed within the past 24 hours. Recovery needs vary between individuals.'
  } else if (elapsedHours < 48) {
    const days = Math.floor(elapsedHours / 24)
    formattedTimeAgo = `${days} day ago (~${elapsedHours}h)`
    bucketLabel = '24–48h since last session'
    guidanceNote = '1–2 days since last session. Standard training cadence window for most training splits.'
  } else if (elapsedHours < 72) {
    formattedTimeAgo = `2 days ago (~${elapsedHours}h)`
    bucketLabel = '48–72h since last session'
    guidanceNote = '2–3 days since last session. Consistent rest window between intensive muscle group sessions.'
  } else {
    const days = Math.floor(elapsedHours / 24)
    formattedTimeAgo = `${days} days ago (~${elapsedHours}h)`
    bucketLabel = '72h+ since last session'
    guidanceNote = 'Extended rest window (3+ days since last workout). Ready for your next planned session.'
  }

  return {
    hasHistory: true,
    lastCompletedAt: latest.completedAt,
    lastSessionTitle: latest.dayTitle || 'Workout',
    elapsedHours,
    formattedTimeAgo,
    bucketLabel,
    guidanceNote
  }
}
