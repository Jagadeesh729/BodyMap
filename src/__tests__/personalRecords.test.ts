import { describe, it, expect } from 'vitest'
import { extractPersonalRecords } from '@/lib/personalRecords'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

describe('Personal Records (PR) Vault Suite', () => {
  it('extracts peak weight records per exercise from authentic history', () => {
    const mockHistory: CompletedWorkoutLog[] = [
      {
        id: 'log_1',
        sessionId: 's_1',
        dayIndex: 0,
        dayTitle: 'Chest Day',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-10T10:00:00Z',
        durationSeconds: 1800,
        totalSetsCompleted: 6,
        totalExercises: 2,
        exercisesSummary: [
          { name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3, weightKg: 60 } as unknown as CompletedWorkoutLog['exercisesSummary'][number],
          { name: 'Overhead Press', setsCompleted: 3, totalSets: 3, weightKg: 40 } as unknown as CompletedWorkoutLog['exercisesSummary'][number]
        ]
      },
      {
        id: 'log_2',
        sessionId: 's_2',
        dayIndex: 0,
        dayTitle: 'Chest Day',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-20T10:00:00Z',
        durationSeconds: 1800,
        totalSetsCompleted: 6,
        totalExercises: 2,
        exercisesSummary: [
          { name: 'Flat Bench Press', setsCompleted: 3, totalSets: 3, weightKg: 70 } as unknown as CompletedWorkoutLog['exercisesSummary'][number] // Alias match, higher weight
        ]
      }
    ]

    const prs = extractPersonalRecords(mockHistory)
    expect(prs.length).toBe(2)

    // Bench press should reflect 70kg (the higher weight)
    const benchPr = prs.find(p => p.normalizedName === 'barbell bench press')
    expect(benchPr).toBeDefined()
    expect(benchPr?.value).toBe(70)
    expect(benchPr?.unit).toBe('kg')
    expect(benchPr?.achievedAt).toBe('2026-08-20T10:00:00Z')

    // Overhead press
    const ohpPr = prs.find(p => p.normalizedName === 'barbell overhead press')
    expect(ohpPr).toBeDefined()
    expect(ohpPr?.value).toBe(40)
  })

  it('ignores invalid, negative, or impossible weights (>600 kg)', () => {
    const invalidHistory: CompletedWorkoutLog[] = [
      {
        id: 'log_inv',
        sessionId: 's_inv',
        dayIndex: 0,
        dayTitle: 'Invalid',
        dayType: 'Test',
        completedAt: '2026-08-10T10:00:00Z',
        durationSeconds: 600,
        totalSetsCompleted: 2,
        totalExercises: 2,
        exercisesSummary: [
          { name: 'Bench', setsCompleted: 1, totalSets: 1, weightKg: -50 } as unknown as CompletedWorkoutLog['exercisesSummary'][number],
          { name: 'Squat', setsCompleted: 1, totalSets: 1, weightKg: 9999 } as unknown as CompletedWorkoutLog['exercisesSummary'][number],
          { name: 'Valid Deadlift', setsCompleted: 1, totalSets: 1, weightKg: 120 } as unknown as CompletedWorkoutLog['exercisesSummary'][number]
        ]
      }
    ]

    const prs = extractPersonalRecords(invalidHistory)
    expect(prs.length).toBe(1)
    expect(prs[0].value).toBe(120)
  })

  it('returns empty array when history is empty or has no weighted exercises', () => {
    expect(extractPersonalRecords([])).toEqual([])
    expect(extractPersonalRecords([
      {
        id: 'log_bw',
        sessionId: 's_bw',
        dayIndex: 0,
        dayTitle: 'Bodyweight',
        dayType: 'Calisthenics',
        completedAt: '2026-08-10T10:00:00Z',
        durationSeconds: 600,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          { name: 'Pushups', setsCompleted: 3, totalSets: 3 } as unknown as CompletedWorkoutLog['exercisesSummary'][number]
        ]
      }
    ])).toEqual([])
  })
})
