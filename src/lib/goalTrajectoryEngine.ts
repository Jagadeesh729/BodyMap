export interface MilestoneCheckpoint {
  milestonePercent: number
  targetWeightKg: number
  label: string
}

export interface GoalTrajectoryMetrics {
  goalDirection: 'lose' | 'gain' | 'maintain'
  startWeightKg: number
  currentWeightKg: number
  targetWeightKg: number
  totalDeltaKg: number
  achievedDeltaKg: number
  remainingDeltaKg: number
  milestoneCheckpoints: MilestoneCheckpoint[]
  factualSummary: string
}

/**
 * Deterministically computes athlete goal trajectory checkpoints across 25%, 50%, 75%, and 100% completion milestones.
 *
 * NON-MEDICAL HEURISTIC:
 * Aggregates athlete weight delta targets mathematically.
 * Never issues clinical diagnoses or guaranteed physiological outcomes.
 */
export function calculateGoalTrajectory(
  startWeightKg: number,
  currentWeightKg: number,
  targetWeightKg: number
): GoalTrajectoryMetrics {
  const s = typeof startWeightKg === 'number' && Number.isFinite(startWeightKg) && startWeightKg > 0 ? startWeightKg : 70
  const c = typeof currentWeightKg === 'number' && Number.isFinite(currentWeightKg) && currentWeightKg > 0 ? currentWeightKg : s
  const t = typeof targetWeightKg === 'number' && Number.isFinite(targetWeightKg) && targetWeightKg > 0 ? targetWeightKg : s

  let goalDirection: 'lose' | 'gain' | 'maintain' = 'maintain'
  if (t < s - 0.1) {
    goalDirection = 'lose'
  } else if (t > s + 0.1) {
    goalDirection = 'gain'
  }

  const totalDeltaKg = Number(Math.abs(t - s).toFixed(1))
  const achievedDeltaKg = Number(Math.abs(c - s).toFixed(1))
  const remainingDeltaKg = Number(Math.max(0, Math.abs(t - c)).toFixed(1))

  const milestoneCheckpoints: MilestoneCheckpoint[] = [25, 50, 75, 100].map(pct => {
    let targetKg = s
    if (goalDirection === 'lose') {
      targetKg = Number((s - (totalDeltaKg * (pct / 100))).toFixed(1))
    } else if (goalDirection === 'gain') {
      targetKg = Number((s + (totalDeltaKg * (pct / 100))).toFixed(1))
    }
    return {
      milestonePercent: pct,
      targetWeightKg: targetKg,
      label: `${pct}% Milestone (${targetKg} kg)`
    }
  })

  const factualSummary = goalDirection === 'maintain'
    ? `Maintenance goal target fixed at ${s} kg.`
    : `${totalDeltaKg} kg ${goalDirection === 'lose' ? 'reduction' : 'gain'} target: ${achievedDeltaKg} kg achieved, ${remainingDeltaKg} kg remaining.`

  return {
    goalDirection,
    startWeightKg: s,
    currentWeightKg: c,
    targetWeightKg: t,
    totalDeltaKg,
    achievedDeltaKg,
    remainingDeltaKg,
    milestoneCheckpoints,
    factualSummary
  }
}
