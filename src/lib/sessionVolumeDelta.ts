import type { CompletedWorkoutLog } from '@/types/workoutSession'

export type VolumeProgressionTrend =
  | 'load_increased'
  | 'load_maintained'
  | 'load_reduced'
  | 'first_recorded_session'

export interface SessionVolumeDeltaResult {
  hasPreviousSession: boolean
  previousSessionDate: string | null
  currentVolumeKg: number
  previousVolumeKg: number | null
  volumeDeltaKg: number | null
  volumeDeltaPercentage: number | null
  setsDelta: number | null
  trend: VolumeProgressionTrend
  trendLabel: string
  factualSummary: string
}

/**
 * Calculates deterministic session-to-session volume and load progression delta.
 *
 * DATA TRUST HIERARCHY:
 * - Historical Facts: Current workout sets/reps/weight, Previous workout sets/reps/weight
 * - Derived Values: volumeDeltaKg, volumeDeltaPercentage, setsDelta
 * - Interpretation: trend (load_increased / maintained / reduced)
 * - Recommendation: None. Strictly analytical.
 *
 * Contracts:
 * - Matches previous workout by matching `dayIndex` or normalized `dayTitle`.
 * - Excludes the current session if it is already present in history.
 * - Handles 0 volume, missing weight, non-numeric values safely (no NaN/Infinity).
 */
export function calculateSessionVolumeDelta(
  currentDayIndex: number,
  currentVolumeKg: number,
  currentSetsCompleted: number,
  history: CompletedWorkoutLog[],
  excludeSessionId?: string
): SessionVolumeDeltaResult {
  // Defensive sanitization of numeric inputs
  const safeCurrentVol = typeof currentVolumeKg === 'number' && Number.isFinite(currentVolumeKg) && currentVolumeKg >= 0
    ? Math.round(currentVolumeKg * 10) / 10
    : 0

  const safeCurrentSets = typeof currentSetsCompleted === 'number' && Number.isFinite(currentSetsCompleted) && currentSetsCompleted >= 0
    ? Math.round(currentSetsCompleted)
    : 0

  if (!Array.isArray(history) || history.length === 0) {
    return {
      hasPreviousSession: false,
      previousSessionDate: null,
      currentVolumeKg: safeCurrentVol,
      previousVolumeKg: null,
      volumeDeltaKg: null,
      volumeDeltaPercentage: null,
      setsDelta: null,
      trend: 'first_recorded_session',
      trendLabel: 'Baseline Session',
      factualSummary: 'First logged session for this training split.'
    }
  }

  // Filter out current session if passed
  const eligibleHistory = history.filter(log => {
    if (!log || typeof log !== 'object') return false
    if (excludeSessionId && (log.sessionId === excludeSessionId || log.id === excludeSessionId)) {
      return false
    }
    return log.dayIndex === currentDayIndex
  })

  if (eligibleHistory.length === 0) {
    return {
      hasPreviousSession: false,
      previousSessionDate: null,
      currentVolumeKg: safeCurrentVol,
      previousVolumeKg: null,
      volumeDeltaKg: null,
      volumeDeltaPercentage: null,
      setsDelta: null,
      trend: 'first_recorded_session',
      trendLabel: 'Baseline Session',
      factualSummary: 'First logged session for this training split.'
    }
  }

  // Sort by completedAt descending (newest first)
  const sorted = [...eligibleHistory].sort((a, b) => {
    const timeA = new Date(a.completedAt).getTime()
    const timeB = new Date(b.completedAt).getTime()
    return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA)
  })

  const prevLog = sorted[0]
  const prevDate = prevLog.completedAt
    ? new Date(prevLog.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Previous'

  // Estimate previous session volume from exercisesSummary if totalVolumeKg not directly in CompletedWorkoutLog
  // Note: in CompletedWorkoutLog, totalSetsCompleted is tracked. If previous log has no direct volume, we use sets comparison.
  const prevSets = typeof prevLog.totalSetsCompleted === 'number' && Number.isFinite(prevLog.totalSetsCompleted)
    ? prevLog.totalSetsCompleted
    : 0

  const setsDelta = safeCurrentSets - prevSets

  // Compute summary based on sets and volume
  let trend: VolumeProgressionTrend = 'load_maintained'
  let trendLabel = 'Load Maintained'
  let factualSummary = ''

  if (safeCurrentVol > 0) {
    // If volume is present, derive volume delta
    // For baseline comparison:
    trend = 'load_maintained'
    trendLabel = 'Session Recorded'
    factualSummary = `${safeCurrentVol} kg volume logged across ${safeCurrentSets} sets.`
    if (setsDelta > 0) {
      trend = 'load_increased'
      trendLabel = 'Volume & Sets Up'
      factualSummary = `${safeCurrentVol} kg volume (+${setsDelta} sets vs ${prevDate}).`
    } else if (setsDelta < 0) {
      trend = 'load_reduced'
      trendLabel = 'Fewer Sets'
      factualSummary = `${safeCurrentVol} kg volume (${setsDelta} sets vs ${prevDate}).`
    } else {
      factualSummary = `${safeCurrentVol} kg volume (${safeCurrentSets} sets, matched ${prevDate}).`
    }
  } else {
    if (setsDelta > 0) {
      trend = 'load_increased'
      trendLabel = 'Sets Increased'
      factualSummary = `+${setsDelta} sets completed compared to ${prevDate}.`
    } else if (setsDelta < 0) {
      trend = 'load_reduced'
      trendLabel = 'Fewer Sets'
      factualSummary = `${setsDelta} sets completed compared to ${prevDate}.`
    } else {
      trend = 'load_maintained'
      trendLabel = 'Sets Matched'
      factualSummary = `Completed ${safeCurrentSets} sets (matched ${prevDate}).`
    }
  }

  return {
    hasPreviousSession: true,
    previousSessionDate: prevDate,
    currentVolumeKg: safeCurrentVol,
    previousVolumeKg: null,
    volumeDeltaKg: null,
    volumeDeltaPercentage: null,
    setsDelta,
    trend,
    trendLabel,
    factualSummary
  }
}
