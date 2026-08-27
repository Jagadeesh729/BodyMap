import { describe, it, expect } from 'vitest'
import {
  normalizeExerciseName,
  findPreviousPerformance
} from '@/lib/progressionEngine'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

describe('Workout Progression & Ghost Reference Suite', () => {
  it('normalizes exercise names and strips formatting', () => {
    expect(normalizeExerciseName('Barbell Bench Press: 3 sets x 10 reps (60s rest)')).toBe('barbell bench press')
    expect(normalizeExerciseName('Dumbbell Shoulder Press')).toBe('dumbbell shoulder press')
    expect(normalizeExerciseName('')).toBe('')
  })

  it('matches approved aliases deterministically', () => {
    expect(normalizeExerciseName('bench press')).toBe('barbell bench press')
    expect(normalizeExerciseName('flat bench press')).toBe('barbell bench press')
    expect(normalizeExerciseName('back squat')).toBe('barbell back squat')
    expect(normalizeExerciseName('deadlift')).toBe('barbell deadlift')
    expect(normalizeExerciseName('ohp')).toBe('barbell overhead press')
    expect(normalizeExerciseName('db curl')).toBe('dumbbell bicep curl')
  })

  it('does NOT match unrelated exercises (no dangerous fuzzy false positives)', () => {
    expect(normalizeExerciseName('Incline Dumbbell Press')).not.toBe('barbell bench press')
    expect(normalizeExerciseName('Leg Press')).not.toBe('barbell back squat')
    expect(normalizeExerciseName('Romanian Deadlift')).not.toBe('barbell deadlift')
  })

  it('finds the most recent valid historical performance for an exercise', () => {
    const mockHistory: CompletedWorkoutLog[] = [
      {
        id: 'log_old',
        sessionId: 'sess_old',
        dayIndex: 0,
        dayTitle: 'Day 1 Chest',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-10T10:00:00Z',
        durationSeconds: 1800,
        totalSetsCompleted: 9,
        totalExercises: 3,
        exercisesSummary: [
          { name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3, weightKg: 55 } as unknown as CompletedWorkoutLog['exercisesSummary'][number]
        ]
      },
      {
        id: 'log_new',
        sessionId: 'sess_new',
        dayIndex: 0,
        dayTitle: 'Day 1 Chest',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-20T10:00:00Z',
        durationSeconds: 1800,
        totalSetsCompleted: 9,
        totalExercises: 3,
        exercisesSummary: [
          { name: 'Barbell Bench Press', setsCompleted: 4, totalSets: 4, weightKg: 60 } as unknown as CompletedWorkoutLog['exercisesSummary'][number]
        ]
      }
    ]

    const perf = findPreviousPerformance('Bench Press: 4 sets x 10 reps', mockHistory)
    expect(perf).not.toBeNull()
    expect(perf?.lastWeightKg).toBe(60)
    expect(perf?.lastCompletedAt).toBe('2026-08-20T10:00:00Z')
    expect(perf?.factualSummary).toContain('60 kg')
  })

  it('returns null safely for empty history or unknown exercises', () => {
    expect(findPreviousPerformance('Barbell Bench Press', [])).toBeNull()
    expect(findPreviousPerformance('', [])).toBeNull()
    expect(findPreviousPerformance('Unknown Exercise 123', [
      {
        id: 'log_1',
        sessionId: 's_1',
        dayIndex: 0,
        dayTitle: 'Day 1',
        dayType: 'General',
        completedAt: '2026-08-20T10:00:00Z',
        durationSeconds: 600,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [{ name: 'Squats', setsCompleted: 3, totalSets: 3 }]
      }
    ])).toBeNull()
  })
})
