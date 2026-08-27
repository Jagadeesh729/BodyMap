import { describe, it, expect } from 'vitest'
import { calculateWorkloadDensity } from '@/lib/workloadIntensity'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

describe('Workload Density & Session Efficiency Suite', () => {
  it('calculates weighted volume density (kg/min) and pacing accurately', () => {
    const mockLog: CompletedWorkoutLog = {
      id: 'log_1',
      sessionId: 's_1',
      dayIndex: 0,
      dayTitle: 'Upper Body',
      dayType: 'Hypertrophy',
      completedAt: '2026-08-27T10:00:00Z',
      durationSeconds: 1800, // 30 mins
      totalSetsCompleted: 10,
      totalExercises: 2,
      exercisesSummary: [
        {
          name: 'Barbell Bench Press',
          setsCompleted: 5,
          totalSets: 5,
          weightKg: 60
        } as unknown as CompletedWorkoutLog['exercisesSummary'][number] // 60 kg * 5 sets * 10 reps = 3000 kg
      ]
    }

    const density = calculateWorkloadDensity(mockLog)
    expect(density.hasData).toBe(true)
    expect(density.totalWeightedVolumeKg).toBe(3000)
    expect(density.activeDurationMinutes).toBe(30)
    // 3000 kg / 30 mins = 100 kg/min
    expect(density.densityKgPerMin).toBe(100)
    // 10 sets / 0.5 hr = 20 sets/hr
    expect(density.setsPerHour).toBe(20)
  })

  it('handles zero duration or missing logs safely without division by zero', () => {
    expect(calculateWorkloadDensity(null).hasData).toBe(false)
    expect(calculateWorkloadDensity({ durationSeconds: 0 } as CompletedWorkoutLog).hasData).toBe(false)
  })
})
