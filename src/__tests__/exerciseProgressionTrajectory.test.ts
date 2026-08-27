import { describe, it, expect } from 'vitest'
import { calculateExerciseProgression } from '@/lib/exerciseProgressionTrajectory'

describe('Exercise Progression Trajectory Suite', () => {
  it('returns baseline status when no history exists', () => {
    const res = calculateExerciseProgression('Barbell Bench Press', [])
    expect(res.hasHistory).toBe(false)
    expect(res.trajectory).toBe('baseline')
  })

  it('detects load increase across multiple sessions', () => {
    const history = [
      {
        id: 'sess_2',
        completedAt: 1700000000000,
        sessionData: {
          exercises: [
            {
              name: 'Barbell Bench Press',
              sets: [{ weightKg: 85, actualReps: 8, completed: true }]
            }
          ]
        }
      },
      {
        id: 'sess_1',
        completedAt: 1699000000000,
        sessionData: {
          exercises: [
            {
              name: 'Barbell Bench Press',
              sets: [{ weightKg: 80, actualReps: 8, completed: true }]
            }
          ]
        }
      }
    ]

    const res = calculateExerciseProgression('Barbell Bench Press', history)
    expect(res.hasHistory).toBe(true)
    expect(res.latestWorkingWeightKg).toBe(85)
    expect(res.previousWorkingWeightKg).toBe(80)
    expect(res.weightDeltaKg).toBe(5)
    expect(res.percentageDelta).toBe(6.3)
    expect(res.trajectory).toBe('increasing_load')
    expect(res.trajectoryLabel).toContain('+5 kg')
  })
})
