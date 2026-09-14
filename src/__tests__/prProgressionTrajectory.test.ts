import { describe, it, expect } from 'vitest'
import {
  extractExercisePRTrajectory,
  getAvailableExercisesForTrajectory
} from '@/lib/prProgressionTrajectory'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

describe('PR Progression Trajectory Engine (E6)', () => {
  const mockHistory: CompletedWorkoutLog[] = [
    {
      id: 'log_3',
      sessionId: 'sess_3',
      dayIndex: 0,
      dayTitle: 'Chest & Back Heavy',
      dayType: 'Hypertrophy',
      completedAt: '2026-03-01T10:00:00.000Z',
      durationSeconds: 3600,
      totalSetsCompleted: 12,
      totalExercises: 3,
      exercisesSummary: [
        {
          name: 'Barbell Bench Press',
          setsCompleted: 4,
          totalSets: 4,
          peakWeightKg: 100,
          avgCompletedReps: 5
        }
      ]
    },
    {
      id: 'log_1',
      sessionId: 'sess_1',
      dayIndex: 0,
      dayTitle: 'Upper Body Intro',
      dayType: 'Hypertrophy',
      completedAt: '2026-01-15T10:00:00.000Z',
      durationSeconds: 3000,
      totalSetsCompleted: 10,
      totalExercises: 2,
      exercisesSummary: [
        {
          name: 'Barbell Bench Press',
          setsCompleted: 3,
          totalSets: 3,
          peakWeightKg: 80,
          avgCompletedReps: 8
        },
        {
          name: 'Incline Dumbbell Press',
          setsCompleted: 3,
          totalSets: 3,
          peakWeightKg: 28,
          avgCompletedReps: 10
        }
      ]
    },
    {
      id: 'log_2',
      sessionId: 'sess_2',
      dayIndex: 3,
      dayTitle: 'Push Day 2',
      dayType: 'Strength',
      completedAt: '2026-02-01T10:00:00.000Z',
      durationSeconds: 3200,
      totalSetsCompleted: 10,
      totalExercises: 2,
      exercisesSummary: [
        {
          name: 'Barbell Bench Press',
          setsCompleted: 4,
          totalSets: 4,
          peakWeightKg: 90,
          avgCompletedReps: 6
        }
      ]
    },
    {
      id: 'log_4',
      sessionId: 'sess_4',
      dayIndex: 0,
      dayTitle: 'Deload Push',
      dayType: 'Deload',
      completedAt: '2026-03-15T10:00:00.000Z',
      durationSeconds: 2400,
      totalSetsCompleted: 8,
      totalExercises: 2,
      exercisesSummary: [
        {
          name: 'Barbell Bench Press',
          setsCompleted: 3,
          totalSets: 3,
          peakWeightKg: 85, // Lower than peak of 100
          avgCompletedReps: 10
        }
      ]
    }
  ]

  it('handles empty, null, or invalid inputs safely without throwing', () => {
    expect(extractExercisePRTrajectory([], 'Barbell Bench Press')).toBeNull()
    expect(extractExercisePRTrajectory(null as unknown as CompletedWorkoutLog[], 'Bench Press')).toBeNull()
    expect(extractExercisePRTrajectory(mockHistory, '')).toBeNull()
    expect(extractExercisePRTrajectory(mockHistory, 'Nonexistent Lift XYZ')).toBeNull()
  })

  it('chronologically sorts trajectory points regardless of input order', () => {
    const trajectory = extractExercisePRTrajectory(mockHistory, 'barbell bench press')
    expect(trajectory).not.toBeNull()
    if (!trajectory) return

    expect(trajectory.points.length).toBe(4)
    expect(trajectory.points[0].weightKg).toBe(80) // 2026-01-15
    expect(trajectory.points[1].weightKg).toBe(90) // 2026-02-01
    expect(trajectory.points[2].weightKg).toBe(100) // 2026-03-01
    expect(trajectory.points[3].weightKg).toBe(85) // 2026-03-15

    expect(trajectory.firstRecordedDate).toBe('2026-01-15T10:00:00.000Z')
    expect(trajectory.latestRecordedDate).toBe('2026-03-15T10:00:00.000Z')
    expect(trajectory.totalDataPoints).toBe(4)
    expect(trajectory.netWeightGainKg).toBe(5) // 85 - 80 = +5 kg
  })

  it('accurately identifies PR breakthrough points', () => {
    const trajectory = extractExercisePRTrajectory(mockHistory, 'Barbell Bench Press')
    expect(trajectory).not.toBeNull()
    if (!trajectory) return

    // 80 kg is first point -> breakthrough
    expect(trajectory.points[0].isPRBreakthrough).toBe(true)
    // 90 kg > 80 kg -> breakthrough
    expect(trajectory.points[1].isPRBreakthrough).toBe(true)
    // 100 kg > 90 kg -> breakthrough
    expect(trajectory.points[2].isPRBreakthrough).toBe(true)
    // 85 kg < 100 kg -> NOT breakthrough
    expect(trajectory.points[3].isPRBreakthrough).toBe(false)

    expect(trajectory.allTimePeakWeightKg).toBe(100)
  })

  it('calculates estimated 1RM when reps are available', () => {
    const trajectory = extractExercisePRTrajectory(mockHistory, 'Barbell Bench Press')
    expect(trajectory).not.toBeNull()
    if (!trajectory) return

    // Point 2: 100 kg x 5 reps -> Epley 1RM = 100 * (1 + 5/30) = 116.67 -> ~116.5 kg
    const pt2 = trajectory.points[2]
    expect(pt2.weightKg).toBe(100)
    expect(pt2.reps).toBe(5)
    expect(pt2.estimated1rmKg).toBeGreaterThan(100)
    expect(trajectory.allTimePeak1rmKg).toBe(pt2.estimated1rmKg)
  })

  it('handles single-data-point trajectory gracefully with 0 net gain', () => {
    const singleHistory: CompletedWorkoutLog[] = [mockHistory[1]]
    const trajectory = extractExercisePRTrajectory(singleHistory, 'Incline Dumbbell Press')
    expect(trajectory).not.toBeNull()
    if (!trajectory) return

    expect(trajectory.points.length).toBe(1)
    expect(trajectory.netWeightGainKg).toBe(0)
    expect(trajectory.allTimePeakWeightKg).toBe(28)
    expect(trajectory.points[0].isPRBreakthrough).toBe(true)
  })

  it('extracts legacy weightKg if peakWeightKg is not present', () => {
    const legacyHistory: CompletedWorkoutLog[] = [
      {
        id: 'leg_1',
        sessionId: 'sess_leg',
        dayIndex: 0,
        dayTitle: 'Legacy Session',
        dayType: 'Hypertrophy',
        completedAt: '2025-10-01T10:00:00.000Z',
        durationSeconds: 1800,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          {
            name: 'Deadlift',
            setsCompleted: 3,
            totalSets: 3,
            // @ts-expect-error test legacy schema
            weightKg: 140,
            completedReps: 5
          }
        ]
      }
    ]

    const trajectory = extractExercisePRTrajectory(legacyHistory, 'Deadlift')
    expect(trajectory).not.toBeNull()
    if (!trajectory) return

    expect(trajectory.points[0].weightKg).toBe(140)
    expect(trajectory.points[0].reps).toBe(5)
    expect(trajectory.allTimePeakWeightKg).toBe(140)
  })

  it('ignores invalid weights (< 0 or > 600 kg) and corrupt entries', () => {
    const corruptHistory: CompletedWorkoutLog[] = [
      {
        id: 'corrupt_1',
        sessionId: 'sess_c',
        dayIndex: 0,
        dayTitle: 'Corrupt Session',
        dayType: 'Hypertrophy',
        completedAt: '2026-01-01T10:00:00.000Z',
        durationSeconds: 1800,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          {
            name: 'Squat',
            setsCompleted: 3,
            totalSets: 3,
            peakWeightKg: -50 // Invalid
          },
          {
            name: 'Squat',
            setsCompleted: 3,
            totalSets: 3,
            peakWeightKg: 999 // Unrealistic / invalid
          }
        ]
      },
      // @ts-expect-error corrupt log
      null,
      // @ts-expect-error missing exercisesSummary
      { id: 'bad', completedAt: '2026-01-02' }
    ]

    const trajectory = extractExercisePRTrajectory(corruptHistory, 'Squat')
    expect(trajectory).toBeNull()
  })

  describe('getAvailableExercisesForTrajectory', () => {
    it('returns empty array for empty or invalid history', () => {
      expect(getAvailableExercisesForTrajectory([])).toEqual([])
      expect(getAvailableExercisesForTrajectory(null as unknown as CompletedWorkoutLog[])).toEqual([])
    })

    it('returns exercises sorted by logged session count descending', () => {
      const inventory = getAvailableExercisesForTrajectory(mockHistory)
      expect(inventory.length).toBe(2)

      // Barbell Bench Press has 4 logs, Incline Dumbbell Press has 1 log
      expect(inventory[0].normalized).toBe('barbell bench press')
      expect(inventory[0].count).toBe(4)
      expect(inventory[0].peakWeightKg).toBe(100)

      expect(inventory[1].normalized).toBe('incline dumbbell press')
      expect(inventory[1].count).toBe(1)
      expect(inventory[1].peakWeightKg).toBe(28)
    })
  })
})
