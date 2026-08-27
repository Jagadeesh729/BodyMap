import { describe, it, expect } from 'vitest'
import { calculateTimeSinceLastWorkout } from '@/lib/recoveryReadiness'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

describe('Time Since Last Workout Suite', () => {
  const createMockLog = (completedAt: string): CompletedWorkoutLog => ({
    id: 'log_test',
    sessionId: 's_test',
    dayIndex: 0,
    dayTitle: 'Push Day',
    dayType: 'Hypertrophy',
    completedAt,
    durationSeconds: 2400,
    totalSetsCompleted: 12,
    totalExercises: 3,
    exercisesSummary: []
  })

  it('calculates elapsed hours and buckets accurately', () => {
    const baseNow = new Date('2026-08-27T12:00:00Z')

    // 12 hours ago
    const twelveHoursAgo = new Date('2026-08-27T00:00:00Z').toISOString()
    const r12 = calculateTimeSinceLastWorkout([createMockLog(twelveHoursAgo)], baseNow)
    expect(r12.hasHistory).toBe(true)
    expect(r12.elapsedHours).toBe(12)
    expect(r12.formattedTimeAgo).toBe('12 hours ago')
    expect(r12.bucketLabel).toBe('< 24h since last session')

    // 30 hours ago (1 day ago)
    const thirtyHoursAgo = new Date('2026-08-26T06:00:00Z').toISOString()
    const r30 = calculateTimeSinceLastWorkout([createMockLog(thirtyHoursAgo)], baseNow)
    expect(r30.hasHistory).toBe(true)
    expect(r30.elapsedHours).toBe(30)
    expect(r30.bucketLabel).toBe('24–48h since last session')

    // 50 hours ago (2 days ago)
    const fiftyHoursAgo = new Date('2026-08-25T10:00:00Z').toISOString()
    const r50 = calculateTimeSinceLastWorkout([createMockLog(fiftyHoursAgo)], baseNow)
    expect(r50.hasHistory).toBe(true)
    expect(r50.elapsedHours).toBe(50)
    expect(r50.bucketLabel).toBe('48–72h since last session')

    // 80 hours ago (3+ days)
    const eightyHoursAgo = new Date('2026-08-24T04:00:00Z').toISOString()
    const r80 = calculateTimeSinceLastWorkout([createMockLog(eightyHoursAgo)], baseNow)
    expect(r80.hasHistory).toBe(true)
    expect(r80.elapsedHours).toBe(80)
    expect(r80.bucketLabel).toBe('72h+ since last session')
  })

  it('handles empty or malformed workout histories safely', () => {
    expect(calculateTimeSinceLastWorkout([]).hasHistory).toBe(false)
    expect(calculateTimeSinceLastWorkout(null).hasHistory).toBe(false)
    expect(calculateTimeSinceLastWorkout([{ id: 'bad' } as unknown as CompletedWorkoutLog]).hasHistory).toBe(false)
  })

  it('guards against future timestamps', () => {
    const futureDate = new Date('2026-08-30T12:00:00Z').toISOString()
    const refDate = new Date('2026-08-27T12:00:00Z')
    const res = calculateTimeSinceLastWorkout([createMockLog(futureDate)], refDate)
    expect(res.hasHistory).toBe(true)
    expect(res.elapsedHours).toBe(0)
    expect(res.formattedTimeAgo).toBe('Just completed')
  })
})
