import { describe, it, expect } from 'vitest'
import { calculateGoalTrajectory } from '@/lib/goalTrajectoryEngine'

describe('calculateGoalTrajectory', () => {
  it('correctly calculates trajectory checkpoints for fat loss goals', () => {
    const res = calculateGoalTrajectory(80, 78, 70)
    expect(res.goalDirection).toBe('lose')
    expect(res.totalDeltaKg).toBe(10)
    expect(res.achievedDeltaKg).toBe(2)
    expect(res.remainingDeltaKg).toBe(8)
    expect(res.milestoneCheckpoints.length).toBe(4)

    // Checkpoints: 25% -> 77.5, 50% -> 75, 75% -> 72.5, 100% -> 70
    expect(res.milestoneCheckpoints[0].targetWeightKg).toBe(77.5)
    expect(res.milestoneCheckpoints[1].targetWeightKg).toBe(75)
    expect(res.milestoneCheckpoints[2].targetWeightKg).toBe(72.5)
    expect(res.milestoneCheckpoints[3].targetWeightKg).toBe(70)
  })

  it('correctly calculates trajectory checkpoints for muscle gain goals', () => {
    const res = calculateGoalTrajectory(60, 62, 70)
    expect(res.goalDirection).toBe('gain')
    expect(res.totalDeltaKg).toBe(10)
    expect(res.achievedDeltaKg).toBe(2)
    expect(res.remainingDeltaKg).toBe(8)

    // Checkpoints: 25% -> 62.5, 50% -> 65, 75% -> 67.5, 100% -> 70
    expect(res.milestoneCheckpoints[0].targetWeightKg).toBe(62.5)
    expect(res.milestoneCheckpoints[1].targetWeightKg).toBe(65)
    expect(res.milestoneCheckpoints[2].targetWeightKg).toBe(67.5)
    expect(res.milestoneCheckpoints[3].targetWeightKg).toBe(70)
  })

  it('handles maintenance goals properly', () => {
    const res = calculateGoalTrajectory(75, 75, 75)
    expect(res.goalDirection).toBe('maintain')
    expect(res.totalDeltaKg).toBe(0)
    expect(res.remainingDeltaKg).toBe(0)
  })
})
