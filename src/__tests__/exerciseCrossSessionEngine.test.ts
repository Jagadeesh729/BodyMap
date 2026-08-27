import { describe, it, expect } from 'vitest'
import { aggregateCrossSessionExercises } from '@/lib/exerciseCrossSessionEngine'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

function makeLog(id: string, date: string, exercises: Array<{ name: string; setsCompleted: number; weightKg?: number }>): CompletedWorkoutLog {
  return {
    id,
    sessionId: `sess_${id}`,
    dayIndex: 0,
    dayTitle: 'Full Body Session',
    dayType: 'Strength',
    completedAt: date,
    durationSeconds: 2400,
    totalSetsCompleted: exercises.reduce((sum, e) => sum + e.setsCompleted, 0),
    totalExercises: exercises.length,
    exercisesSummary: exercises.map(e => ({
      name: e.name,
      setsCompleted: e.setsCompleted,
      totalSets: e.setsCompleted,
      weightKg: e.weightKg
    }))
  }
}

describe('aggregateCrossSessionExercises', () => {
  it('returns empty array when history is empty', () => {
    expect(aggregateCrossSessionExercises([])).toEqual([])
  })

  it('correctly aggregates multi-session exercise frequency and peak weights', () => {
    const history: CompletedWorkoutLog[] = [
      makeLog('1', '2026-08-10T10:00:00Z', [
        { name: 'Barbell Bench Press', setsCompleted: 4, weightKg: 70 },
        { name: 'Barbell Squat', setsCompleted: 5, weightKg: 100 }
      ]),
      makeLog('2', '2026-08-15T10:00:00Z', [
        { name: 'barbell bench press', setsCompleted: 3, weightKg: 75 },
        { name: 'Pull-ups', setsCompleted: 3 }
      ]),
      makeLog('3', '2026-08-20T10:00:00Z', [
        { name: 'Barbell Bench Press', setsCompleted: 4, weightKg: 80 }
      ])
    ]

    const result = aggregateCrossSessionExercises(history)
    expect(result.length).toBe(3)

    // Bench Press should be first with 3 sessions, 11 sets, peak 80kg
    const bench = result.find(r => r.normalizedName === 'barbell bench press')
    expect(bench).toBeDefined()
    expect(bench?.totalSessions).toBe(3)
    expect(bench?.totalSetsCompleted).toBe(11)
    expect(bench?.peakWeightKg).toBe(80)
    expect(bench?.latestSessionDate).toBe('2026-08-20T10:00:00Z')

    // Squat should have 1 session, 5 sets, peak 100kg
    const squat = result.find(r => r.normalizedName === 'barbell back squat')
    expect(squat).toBeDefined()
    expect(squat?.totalSessions).toBe(1)
    expect(squat?.peakWeightKg).toBe(100)
  })
})
