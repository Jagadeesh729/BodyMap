import { describe, it, expect } from 'vitest'
import { extractPreviousSetPerformance } from '@/lib/exerciseSetProgress'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

describe('Exercise Set-by-Set Historical Performance Suite', () => {
  const mockHistory: CompletedWorkoutLog[] = [
    {
      id: 'log_old',
      sessionId: 's_old',
      dayIndex: 0,
      dayTitle: 'Push Day A',
      dayType: 'Hypertrophy',
      completedAt: '2026-08-20T10:00:00Z',
      durationSeconds: 1800,
      totalSetsCompleted: 6,
      totalExercises: 2,
      exercisesSummary: [
        {
          name: 'Barbell Bench Press',
          setsCompleted: 3,
          totalSets: 3,
          weightKg: 55
        } as unknown as CompletedWorkoutLog['exercisesSummary'][number]
      ]
    },
    {
      id: 'log_new',
      sessionId: 's_new',
      dayIndex: 0,
      dayTitle: 'Push Day B',
      dayType: 'Hypertrophy',
      completedAt: '2026-08-26T10:00:00Z',
      durationSeconds: 2000,
      totalSetsCompleted: 6,
      totalExercises: 2,
      exercisesSummary: [
        {
          name: 'Barbell Bench Press',
          setsCompleted: 3,
          totalSets: 3,
          weightKg: 60
        } as unknown as CompletedWorkoutLog['exercisesSummary'][number]
      ]
    }
  ]

  it('extracts latest historical session for matching normalized exercise', () => {
    const res = extractPreviousSetPerformance('Bench Press', mockHistory)
    expect(res.hasPreviousSession).toBe(true)
    expect(res.sessionTitle).toBe('Push Day B')
    expect(res.sets.length).toBe(3)
    expect(res.sets[0].weightKg).toBe(60)
    expect(res.formattedSummary).toContain('60kg')
  })

  it('handles unrecognized exercises or empty history gracefully', () => {
    const res = extractPreviousSetPerformance('Incline Dumbbell Press', mockHistory)
    expect(res.hasPreviousSession).toBe(false)
    expect(res.sets).toEqual([])

    expect(extractPreviousSetPerformance('Bench Press', []).hasPreviousSession).toBe(false)
    expect(extractPreviousSetPerformance('', mockHistory).hasPreviousSession).toBe(false)
  })
})
