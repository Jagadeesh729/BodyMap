import { describe, it, expect } from 'vitest'
import { calculateGoalProgress } from '@/lib/goalProgressEngine'

describe('calculateGoalProgress', () => {
  it('calculates fat loss (cutting) goal progress accurately', () => {
    // Initial 80kg, Current 76kg, Target 70kg -> 4kg achieved out of 10kg (40%)
    const res = calculateGoalProgress(80, 76, 70)
    expect(res.goalDirection).toBe('lose')
    expect(res.totalDeltaKg).toBe(10)
    expect(res.achievedDeltaKg).toBe(4)
    expect(res.remainingKg).toBe(6)
    expect(res.progressPercent).toBe(40)
    expect(res.isTargetAchieved).toBe(false)
    expect(res.factualSummary).toContain('6 kg remaining')
  })

  it('calculates hypertrophy (bulking) goal progress accurately', () => {
    // Initial 70kg, Current 73kg, Target 75kg -> 3kg achieved out of 5kg (60%)
    const res = calculateGoalProgress(70, 73, 75)
    expect(res.goalDirection).toBe('gain')
    expect(res.totalDeltaKg).toBe(5)
    expect(res.achievedDeltaKg).toBe(3)
    expect(res.remainingKg).toBe(2)
    expect(res.progressPercent).toBe(60)
    expect(res.isTargetAchieved).toBe(false)
  })

  it('recognizes target achieved when target reached or surpassed', () => {
    const resLose = calculateGoalProgress(80, 69.5, 70)
    expect(resLose.progressPercent).toBe(100)
    expect(resLose.isTargetAchieved).toBe(true)
    expect(resLose.remainingKg).toBe(0)
    expect(resLose.factualSummary).toContain('Target weight of 70 kg achieved')

    const resGain = calculateGoalProgress(70, 76, 75)
    expect(resGain.progressPercent).toBe(100)
    expect(resGain.isTargetAchieved).toBe(true)
  })

  it('handles maintenance goal gracefully', () => {
    const res = calculateGoalProgress(75, 75.2, 75)
    expect(res.goalDirection).toBe('maintain')
    expect(res.totalDeltaKg).toBe(0)
    expect(res.isTargetAchieved).toBe(true)
    expect(res.factualSummary).toContain('Weight maintained')
  })

  it('computes weekly rate of change from weight log with >=7 days span', () => {
    const weightLog = [
      { date: '2026-08-01', weight: 80 },
      { date: '2026-08-15', weight: 78 } // -2kg over 14 days = -1.00 kg/week
    ]
    const res = calculateGoalProgress(80, 78, 70, weightLog)
    expect(res.weeklyRateKg).toBe(-1)
  })
})
