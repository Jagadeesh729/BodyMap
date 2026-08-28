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

  it('accurately preserves avgCompletedReps and generates enriched factual summary', () => {
    const historyWithReps: CompletedWorkoutLog[] = [
      {
        id: 'log_reps_1',
        sessionId: 's_reps_1',
        dayIndex: 0,
        dayTitle: 'Strength Day',
        dayType: 'Strength',
        completedAt: '2026-08-15T10:00:00Z',
        durationSeconds: 1200,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          {
            name: 'Barbell Squat',
            setsCompleted: 3,
            totalSets: 3,
            peakWeightKg: 140,
            avgCompletedReps: 5
          }
        ]
      }
    ]

    const prs = extractPersonalRecords(historyWithReps)
    expect(prs.length).toBe(1)
    expect(prs[0].exerciseName).toBe('Barbell Squat')
    expect(prs[0].value).toBe(140)
    expect(prs[0].reps).toBe(5)
    expect(prs[0].factualSummary).toContain('140 kg × 5 reps')
  })

  it('gracefully handles legacy records without avgCompletedReps by setting reps to null', () => {
    const legacyHistory: CompletedWorkoutLog[] = [
      {
        id: 'log_legacy',
        sessionId: 's_legacy',
        dayIndex: 0,
        dayTitle: 'Old Session',
        dayType: 'Legacy',
        completedAt: '2026-07-01T10:00:00Z',
        durationSeconds: 1500,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          {
            name: 'Deadlift',
            setsCompleted: 3,
            totalSets: 3,
            weightKg: 160
          } as unknown as CompletedWorkoutLog['exercisesSummary'][number]
        ]
      }
    ]

    const prs = extractPersonalRecords(legacyHistory)
    expect(prs.length).toBe(1)
    expect(prs[0].value).toBe(160)
    expect(prs[0].reps).toBeNull()
    expect(prs[0].factualSummary).toContain('160 kg peak weight')
  })
})
