export type GoalDirection = 'lose' | 'gain' | 'maintain'

export interface GoalProgressMetrics {
  initialWeightKg: number
  currentWeightKg: number
  targetWeightKg: number
  goalDirection: GoalDirection
  totalDeltaKg: number
  achievedDeltaKg: number
  remainingKg: number
  progressPercent: number
  isTargetAchieved: boolean
  weeklyRateKg: number | null
  factualSummary: string
}

/**
 * Deterministically calculates goal progress metrics from initial, current, and target weights.
 *
 * NON-MEDICAL MATHEMATICAL PROJECTION:
 * Calculations reflect arithmetic progress towards user-specified milestones.
 * Never provides metabolic guarantees, clinical diagnoses, or physiological certainty.
 */
export function calculateGoalProgress(
  initialWeight: number,
  currentWeight: number,
  targetWeight: number,
  weightLog: Array<{ date: string; weight: number }> = []
): GoalProgressMetrics {
  const init = typeof initialWeight === 'number' && !isNaN(initialWeight) && initialWeight > 0 ? initialWeight : 70
  const curr = typeof currentWeight === 'number' && !isNaN(currentWeight) && currentWeight > 0 ? currentWeight : init
  const target = typeof targetWeight === 'number' && !isNaN(targetWeight) && targetWeight > 0 ? targetWeight : init

  let goalDirection: GoalDirection = 'maintain'
  if (target < init) {
    goalDirection = 'lose'
  } else if (target > init) {
    goalDirection = 'gain'
  }

  const totalDeltaKg = Number(Math.abs(target - init).toFixed(1))

  if (goalDirection === 'maintain' || totalDeltaKg === 0) {
    const isMaintained = Math.abs(curr - target) <= 1.0
    return {
      initialWeightKg: init,
      currentWeightKg: curr,
      targetWeightKg: target,
      goalDirection: 'maintain',
      totalDeltaKg: 0,
      achievedDeltaKg: 0,
      remainingKg: 0,
      progressPercent: isMaintained ? 100 : 80,
      isTargetAchieved: isMaintained,
      weeklyRateKg: null,
      factualSummary: isMaintained
        ? `Weight maintained within ±1.0 kg of ${target} kg target.`
        : `Current weight ${curr} kg vs maintenance target ${target} kg.`
    }
  }

  let achievedDeltaKg = 0
  let remainingKg = 0
  let isTargetAchieved = false

  if (goalDirection === 'lose') {
    achievedDeltaKg = Number(Math.max(0, init - curr).toFixed(1))
    remainingKg = Number(Math.max(0, curr - target).toFixed(1))
    isTargetAchieved = curr <= target
  } else {
    achievedDeltaKg = Number(Math.max(0, curr - init).toFixed(1))
    remainingKg = Number(Math.max(0, target - curr).toFixed(1))
    isTargetAchieved = curr >= target
  }

  const progressPercent = totalDeltaKg > 0
    ? Math.min(100, Math.max(0, Math.round((achievedDeltaKg / totalDeltaKg) * 100)))
    : 100

  // Calculate rate if weight log has >= 2 entries
  let weeklyRateKg: number | null = null
  if (Array.isArray(weightLog) && weightLog.length >= 2) {
    const sorted = [...weightLog].filter(e => typeof e?.weight === 'number' && !isNaN(e.weight) && e.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    if (sorted.length >= 2) {
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const days = Math.max(1, Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / (1000 * 60 * 60 * 24)))
      if (days >= 7) {
        const delta = last.weight - first.weight
        weeklyRateKg = Number(((delta / days) * 7).toFixed(2))
      }
    }
  }

  let factualSummary = `${achievedDeltaKg} kg of ${totalDeltaKg} kg goal achieved (${progressPercent}%).`
  if (isTargetAchieved) {
    factualSummary = `Target weight of ${target} kg achieved! (${progressPercent}% progress)`
  } else if (remainingKg > 0) {
    factualSummary = `${remainingKg} kg remaining to reach ${target} kg target.`
  }

  return {
    initialWeightKg: init,
    currentWeightKg: curr,
    targetWeightKg: target,
    goalDirection,
    totalDeltaKg,
    achievedDeltaKg,
    remainingKg,
    progressPercent,
    isTargetAchieved,
    weeklyRateKg,
    factualSummary
  }
}
