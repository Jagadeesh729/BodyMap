import { describe, it, expect } from 'vitest'
import { calculateSessionDebrief } from '@/lib/sessionDebrief'
import type { WorkoutSession } from '@/types/workoutSession'

describe('Post-Workout Session Debrief Engine Suite', () => {
  it('calculates total volume, completed sets, exercise count, and workload density accurately', () => {
    const mockSession: WorkoutSession = {
      id: 'sess_123',
      dayIndex: 0,
      dayTitle: 'Chest & Arms',
      startedAt: Date.now() - 45 * 60 * 1000,
      completedAt: Date.now(),
      durationSeconds: 2700, // 45 minutes
      status: 'completed',
      exercises: [
        {
          name: 'Barbell Bench Press',
          focus: 'Chest',
          sets: [
            { setNumber: 1, targetReps: '10', weight: 80, reps: 10, completed: true },
            { setNumber: 2, targetReps: '10', weight: 80, reps: 10, completed: true },
            { setNumber: 3, targetReps: '8', weight: 85, reps: 8, completed: true },
            { setNumber: 4, targetReps: '8', weight: 85, reps: 0, completed: false } // Incomplete
          ]
        },
        {
          name: 'Incline Dumbbell Press',
          focus: 'Chest',
          sets: [
            { setNumber: 1, targetReps: '12', weight: 26, reps: 12, completed: true },
            { setNumber: 2, targetReps: '12', weight: 26, reps: 12, completed: true }
          ]
        }
      ]
    }

    const debrief = calculateSessionDebrief(mockSession)
    expect(debrief.hasData).toBe(true)
    expect(debrief.setCount).toBe(5) // 3 + 2
    expect(debrief.exerciseCount).toBe(2)
    expect(debrief.durationMinutes).toBe(45)

    // Expected Volume: (80*10) + (80*10) + (85*8) + (26*12) + (26*12) = 800 + 800 + 680 + 312 + 312 = 2904 kg
    expect(debrief.totalVolumeKg).toBe(2904)

    // Expected Density: 2904 / 45 ≈ 65 kg/min
    expect(debrief.workloadDensityKgPerMin).toBe(65)
    expect(debrief.summaryLabel).toContain('2,904 kg total volume')
  })

  it('handles empty or zero-set sessions safely without division by zero', () => {
    const emptyDebrief = calculateSessionDebrief(null)
    expect(emptyDebrief.hasData).toBe(false)
    expect(emptyDebrief.totalVolumeKg).toBe(0)
    expect(emptyDebrief.workloadDensityKgPerMin).toBe(0)
  })
})
