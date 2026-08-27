import { describe, it, expect } from 'vitest'
import { calculate7DayTrainingStrain } from '@/lib/trainingStrain'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

describe('7-Day Training Load, Monotony & Strain Suite', () => {
  const createDailyLog = (dateStr: string, weightKg: number): CompletedWorkoutLog => ({
    id: `log_${dateStr}`,
    sessionId: `s_${dateStr}`,
    dayIndex: 0,
    dayTitle: 'Workout Session',
    dayType: 'Hypertrophy',
    completedAt: `${dateStr}T10:00:00Z`,
    durationSeconds: 2400,
    totalSetsCompleted: 5,
    totalExercises: 1,
    exercisesSummary: [
      {
        name: 'Barbell Bench Press',
        setsCompleted: 5,
        totalSets: 5,
        weightKg
      } as unknown as CompletedWorkoutLog['exercisesSummary'][number] // weightKg * 5 * 10 = volume
    ]
  })

  it('calculates weekly load, mean, standard deviation, monotony, and strain accurately for even workloads', () => {
    const baseDate = new Date('2026-08-27T12:00:00Z')
    // 7 days with identical 1000 kg volume (20 kg * 5 sets * 10 reps = 1000 kg)
    const logs: CompletedWorkoutLog[] = [
      createDailyLog('2026-08-21', 20),
      createDailyLog('2026-08-22', 20),
      createDailyLog('2026-08-23', 20),
      createDailyLog('2026-08-24', 20),
      createDailyLog('2026-08-25', 20),
      createDailyLog('2026-08-26', 20),
      createDailyLog('2026-08-27', 20)
    ]

    const res = calculate7DayTrainingStrain(logs, baseDate)
    expect(res.hasData).toBe(true)
    expect(res.total7DayVolumeKg).toBe(7000)
    expect(res.dailyMeanVolumeKg).toBe(1000)
    expect(res.standardDeviationKg).toBe(0)
    expect(res.monotonyIndex).toBe(1.0)
    expect(res.trainingStrainScore).toBe(7000)
  })

  it('calculates variation and monotony correctly for concentrated/spiked workloads', () => {
    const baseDate = new Date('2026-08-27T12:00:00Z')
    // 3 training days of 2000 kg and 4 rest days (0 kg) -> total 6000 kg
    const logs: CompletedWorkoutLog[] = [
      createDailyLog('2026-08-21', 40),
      createDailyLog('2026-08-23', 40),
      createDailyLog('2026-08-25', 40)
    ]

    const res = calculate7DayTrainingStrain(logs, baseDate)
    expect(res.hasData).toBe(true)
    expect(res.total7DayVolumeKg).toBe(6000)
    expect(res.dailyMeanVolumeKg).toBe(857.1)
    expect(res.standardDeviationKg).toBeGreaterThan(0)
    expect(res.monotonyIndex).toBeGreaterThan(0)
    expect(res.trainingStrainScore).toBeGreaterThan(0)
  })

  it('handles empty or zero-volume histories gracefully without division by zero', () => {
    const emptyRes = calculate7DayTrainingStrain([])
    expect(emptyRes.hasData).toBe(false)
    expect(emptyRes.total7DayVolumeKg).toBe(0)
    expect(emptyRes.monotonyIndex).toBe(null)
    expect(emptyRes.trainingStrainScore).toBe(null)

    const nullRes = calculate7DayTrainingStrain(null)
    expect(nullRes.hasData).toBe(false)
  })
})
