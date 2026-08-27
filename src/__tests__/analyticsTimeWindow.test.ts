import { describe, it, expect } from 'vitest'
import { filterLogsByTimeWindow } from '@/lib/analyticsTimeWindow'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

function makeLog(daysAgo: number, sets = 10, durationSeconds = 1800): CompletedWorkoutLog {
  const now = new Date('2026-08-27T12:00:00.000Z')
  const completedDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)

  return {
    id: `log_${daysAgo}`,
    sessionId: `sess_${daysAgo}`,
    dayIndex: daysAgo % 7,
    dayTitle: `Day ${(daysAgo % 7) + 1}`,
    dayType: 'Strength',
    completedAt: completedDate.toISOString(),
    durationSeconds,
    totalSetsCompleted: sets,
    totalExercises: 4,
    exercisesSummary: ['Squat', 'Bench Press']
  }
}

describe('filterLogsByTimeWindow', () => {
  const referenceDate = new Date('2026-08-27T12:00:00.000Z')

  it('handles empty logs array safely', () => {
    const res = filterLogsByTimeWindow([], 7, referenceDate)
    expect(res.sessionCount).toBe(0)
    expect(res.filteredLogs).toEqual([])
    expect(res.totalDurationMinutes).toBe(0)
    expect(res.totalSetsCompleted).toBe(0)
  })

  it('filters workouts within 7-day window', () => {
    const logs = [
      makeLog(1, 10, 1800), // in 7d
      makeLog(5, 12, 2400), // in 7d
      makeLog(10, 15, 3000), // outside 7d
      makeLog(25, 8, 1200)  // outside 7d
    ]

    const res = filterLogsByTimeWindow(logs, 7, referenceDate)
    expect(res.sessionCount).toBe(2)
    expect(res.totalSetsCompleted).toBe(22)
    expect(res.totalDurationMinutes).toBe(70) // 1800+2400 = 4200s = 70m
    expect(res.factualSummaryLabel).toContain('Last 7 Days')
  })

  it('filters workouts within 14-day window', () => {
    const logs = [
      makeLog(1, 10, 1800),
      makeLog(5, 12, 2400),
      makeLog(10, 15, 3000),
      makeLog(25, 8, 1200)
    ]

    const res = filterLogsByTimeWindow(logs, 14, referenceDate)
    expect(res.sessionCount).toBe(3)
    expect(res.totalSetsCompleted).toBe(37)
    expect(res.totalDurationMinutes).toBe(120) // 7200s = 120m
  })

  it('returns all valid workouts when window is "all"', () => {
    const logs = [
      makeLog(1, 10, 1800),
      makeLog(5, 12, 2400),
      makeLog(10, 15, 3000),
      makeLog(45, 8, 1200)
    ]

    const res = filterLogsByTimeWindow(logs, 'all', referenceDate)
    expect(res.sessionCount).toBe(4)
    expect(res.totalSetsCompleted).toBe(45)
    expect(res.factualSummaryLabel).toContain('All Time')
  })

  it('skips records with invalid completedAt timestamps', () => {
    const logs = [
      makeLog(1, 10, 1800),
      { ...makeLog(2), completedAt: 'invalid-date' },
      makeLog(3, 8, 1200)
    ]

    const res = filterLogsByTimeWindow(logs, 7, referenceDate)
    expect(res.sessionCount).toBe(2)
    expect(res.totalSetsCompleted).toBe(18)
  })
})
