import { describe, it, expect } from 'vitest'
import {
  calculateSessionVolume,
  compareWorkoutWithPrevious,
  generateRecoveryAdvice
} from '@/lib/smartCoach'
import type { SessionExercise, CompletedWorkoutLog } from '@/types/workoutSession'

describe('Smart Workout Coach Engine Suite', () => {
  it('calculates weighted session volume accurately without fabricating bodyweight load', () => {
    const mockExercises: SessionExercise[] = [
      {
        id: 'ex_1',
        name: 'Barbell Bench Press',
        targetSets: 3,
        reps: '10',
        restSeconds: 60,
        equipment: 'Barbell',
        focus: 'Chest',
        sets: [
          { setNumber: 1, targetReps: 10, repsCompleted: 10, weightKg: 60, isCompleted: true },
          { setNumber: 2, targetReps: 10, repsCompleted: 10, weightKg: 60, isCompleted: true },
          { setNumber: 3, targetReps: 10, repsCompleted: 8, weightKg: 65, isCompleted: true }
        ]
      },
      {
        id: 'ex_2',
        name: 'Bodyweight Dips',
        targetSets: 2,
        reps: '12',
        restSeconds: 60,
        equipment: 'Parallel Bars',
        focus: 'Triceps',
        sets: [
          { setNumber: 1, targetReps: 12, repsCompleted: 12, weightKg: null, isCompleted: true },
          { setNumber: 2, targetReps: 12, repsCompleted: 10, weightKg: null, isCompleted: true }
        ]
      }
    ]

    const volume = calculateSessionVolume(mockExercises)
    // 60*10 + 60*10 + 65*8 = 600 + 600 + 520 = 1720 kg
    expect(volume.totalVolumeKg).toBe(1720)
    expect(volume.weightedSetsCount).toBe(3)
    expect(volume.bodyweightSetsCount).toBe(2)
  })

  it('handles empty or incomplete sets safely', () => {
    const volume = calculateSessionVolume([])
    expect(volume.totalVolumeKg).toBe(0)
    expect(volume.weightedSetsCount).toBe(0)
    expect(volume.bodyweightSetsCount).toBe(0)

    const incompleteExercises: SessionExercise[] = [
      {
        id: 'ex_1',
        name: 'Squat',
        targetSets: 2,
        reps: '5',
        restSeconds: 90,
        equipment: 'Barbell',
        focus: 'Legs',
        sets: [
          { setNumber: 1, targetReps: 5, repsCompleted: 5, weightKg: 100, isCompleted: false }, // Not completed
          { setNumber: 2, targetReps: 5, repsCompleted: 5, weightKg: 100, isCompleted: true }
        ]
      }
    ]
    const incVolume = calculateSessionVolume(incompleteExercises)
    expect(incVolume.totalVolumeKg).toBe(500) // Only set 2 counted
    expect(incVolume.weightedSetsCount).toBe(1)
  })

  it('compares current session volume against previous comparable session in history', () => {
    const mockHistory: CompletedWorkoutLog[] = [
      {
        id: 'log_1',
        sessionId: 'sess_1',
        dayIndex: 0,
        dayTitle: 'Day 1 Chest',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-15T10:00:00Z',
        durationSeconds: 2400,
        totalSetsCompleted: 10,
        totalExercises: 3,
        exercisesSummary: [
          { name: 'Bench Press', setsCompleted: 3, totalSets: 3, weightKg: 50 } as unknown as CompletedWorkoutLog['exercisesSummary'][number]
        ]
      }
    ]

    const comp = compareWorkoutWithPrevious(0, 1800, mockHistory)
    expect(comp.hasComparableSession).toBe(true)
    expect(comp.previousVolumeKg).toBe(1500) // 50kg * 3 sets * 10 reps = 1500kg
    expect(comp.volumeDeltaKg).toBe(300)
    expect(comp.volumeDeltaPercent).toBe(20) // +20%
    expect(comp.summaryText).toContain('+300 kg (+20%)')
  })

  it('returns graceful fallback when no previous session exists for that training day', () => {
    const comp = compareWorkoutWithPrevious(3, 1500, [])
    expect(comp.hasComparableSession).toBe(false)
    expect(comp.previousVolumeKg).toBeNull()
    expect(comp.volumeDeltaKg).toBeNull()
    expect(comp.summaryText).toContain('First recorded workout')
  })

  it('generates non-medical, conservative recovery advice', () => {
    const adviceHigh = generateRecoveryAdvice(3600, 18, { totalVolumeKg: 3500, weightedSetsCount: 18, bodyweightSetsCount: 0 })
    expect(adviceHigh).toContain('High-volume')
    expect(adviceHigh).toContain('24–48 hours')

    const adviceMod = generateRecoveryAdvice(1800, 10, { totalVolumeKg: 1500, weightedSetsCount: 10, bodyweightSetsCount: 0 })
    expect(adviceMod).toContain('Moderate stimulus')

    const adviceLow = generateRecoveryAdvice(900, 4, { totalVolumeKg: 400, weightedSetsCount: 4, bodyweightSetsCount: 0 })
    expect(adviceLow).toContain('Focused session')
  })
})
