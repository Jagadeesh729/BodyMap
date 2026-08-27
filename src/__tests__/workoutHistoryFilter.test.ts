import { describe, it, expect } from 'vitest'
import { filterWorkoutHistory } from '@/lib/workoutHistoryFilter'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

function makeLog(dayIndex: number, dayTitle: string, overrides: Partial<CompletedWorkoutLog> = {}): CompletedWorkoutLog {
  return {
    id: `log_${Math.random().toString(36).slice(2)}`,
    sessionId: `s_${Math.random().toString(36).slice(2)}`,
    dayIndex,
    dayTitle,
    dayType: 'Strength',
    completedAt: new Date().toISOString(),
    durationSeconds: 2700,
    totalSetsCompleted: 12,
    totalExercises: 4,
    exercisesSummary: [
      { name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3 },
      { name: 'Incline Dumbbell Press', setsCompleted: 3, totalSets: 3 }
    ],
    ...overrides
  }
}

describe('filterWorkoutHistory', () => {
  const sampleHistory: CompletedWorkoutLog[] = [
    makeLog(0, 'Day 1 - Push Hypertrophy', {
      completedAt: '2026-08-20T10:00:00Z',
      durationSeconds: 3000,
      totalSetsCompleted: 15,
      sessionReflection: { energyRating: 5, reflectionTags: ['Solid Pump'] }
    }),
    makeLog(1, 'Day 2 - Pull Power', {
      completedAt: '2026-08-21T10:00:00Z',
      durationSeconds: 2400,
      totalSetsCompleted: 10,
      exercisesSummary: [{ name: 'Deadlift', setsCompleted: 4, totalSets: 4 }]
    }),
    makeLog(2, 'Day 3 - Leg Quad Focus', {
      completedAt: '2026-08-22T10:00:00Z',
      durationSeconds: 3600,
      totalSetsCompleted: 16,
      sessionReflection: { perceivedReadiness: 'high' }
    }),
    makeLog(0, 'Day 1 - Push Hypertrophy', {
      completedAt: '2026-08-27T10:00:00Z',
      durationSeconds: 2800,
      totalSetsCompleted: 14
    })
  ]

  it('handles empty or null history safely', () => {
    expect(filterWorkoutHistory([]).logs).toEqual([])
    expect(filterWorkoutHistory((null as unknown) as CompletedWorkoutLog[]).logs).toEqual([])
  })

  it('returns all logs and calculates uniqueDays when no filter is applied', () => {
    const res = filterWorkoutHistory(sampleHistory)
    expect(res.totalCount).toBe(4)
    expect(res.filteredCount).toBe(4)
    expect(res.uniqueDays.length).toBe(3)
    expect(res.uniqueDays.find(d => d.dayIndex === 0)?.count).toBe(2)
  })

  it('filters by dayIndex correctly', () => {
    const res = filterWorkoutHistory(sampleHistory, { dayIndex: 0 })
    expect(res.filteredCount).toBe(2)
    expect(res.logs.every(l => l.dayIndex === 0)).toBe(true)
  })

  it('searches by dayTitle query case-insensitively', () => {
    const res = filterWorkoutHistory(sampleHistory, { searchQuery: 'pull' })
    expect(res.filteredCount).toBe(1)
    expect(res.logs[0].dayTitle).toContain('Pull')
  })

  it('searches by exercise name inside exercisesSummary', () => {
    const res = filterWorkoutHistory(sampleHistory, { searchQuery: 'deadlift' })
    expect(res.filteredCount).toBe(1)
    expect(res.logs[0].dayIndex).toBe(1)
  })

  it('searches by reflection tag', () => {
    const res = filterWorkoutHistory(sampleHistory, { searchQuery: 'Solid Pump' })
    expect(res.filteredCount).toBe(1)
    expect(res.logs[0].dayIndex).toBe(0)
  })

  it('filters by minSets', () => {
    const res = filterWorkoutHistory(sampleHistory, { minSets: 15 })
    expect(res.filteredCount).toBe(2)
    expect(res.logs.every(l => (l.totalSetsCompleted || 0) >= 15)).toBe(true)
  })

  it('filters by hasReflectionOnly', () => {
    const res = filterWorkoutHistory(sampleHistory, { hasReflectionOnly: true })
    expect(res.filteredCount).toBe(2)
  })

  it('sorts by duration descending', () => {
    const res = filterWorkoutHistory(sampleHistory, { sortBy: 'duration' })
    expect(res.logs[0].durationSeconds).toBe(3600)
    expect(res.logs[res.logs.length - 1].durationSeconds).toBe(2400)
  })

  it('sorts by oldest first', () => {
    const res = filterWorkoutHistory(sampleHistory, { sortBy: 'oldest' })
    expect(res.logs[0].completedAt).toBe('2026-08-20T10:00:00Z')
    expect(res.logs[res.logs.length - 1].completedAt).toBe('2026-08-27T10:00:00Z')
  })
})
