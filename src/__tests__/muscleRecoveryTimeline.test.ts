import { describe, it, expect } from 'vitest'
import { calculateMuscleRecoveryTimeline } from '@/lib/muscleRecoveryTimeline'

describe('Muscle Group Recovery Readiness Timeline Suite', () => {
  it('calculates hours elapsed per muscle group accurately', () => {
    const now = 1700000000000
    const oneHour = 3600000

    const history = [
      {
        completedAt: now - 12 * oneHour,
        sessionData: {
          exercises: [{ name: 'Barbell Bench Press', sets: [{ completed: true }] }]
        }
      },
      {
        completedAt: now - 52 * oneHour,
        sessionData: {
          exercises: [{ name: 'Barbell Squat', sets: [{ completed: true }] }]
        }
      }
    ]

    const res = calculateMuscleRecoveryTimeline(history, now)
    expect(res.hasData).toBe(true)

    const chest = res.muscles.find(m => m.muscle === 'Chest')
    expect(chest).toBeDefined()
    expect(chest?.hoursElapsed).toBe(12)
    expect(chest?.recoveryWindowStatus).toBe('recent_stimulation')

    const legs = res.muscles.find(m => m.muscle === 'Legs')
    expect(legs).toBeDefined()
    expect(legs?.hoursElapsed).toBe(52)
    expect(legs?.recoveryWindowStatus).toBe('optimal_window')
  })

  it('handles empty histories gracefully', () => {
    const res = calculateMuscleRecoveryTimeline([])
    expect(res.hasData).toBe(false)
    expect(res.muscles.length).toBe(6)
  })
})
