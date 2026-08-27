import { describe, it, expect } from 'vitest'
import { calculateSessionVolumeDelta } from '@/lib/sessionVolumeDelta'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

function makeLog(overrides: Partial<CompletedWorkoutLog> = {}): CompletedWorkoutLog {
  return {
    id: `log_${Math.random().toString(36).slice(2)}`,
    sessionId: `s_${Math.random().toString(36).slice(2)}`,
    dayIndex: 0,
    dayTitle: 'Push Day',
    dayType: 'Strength',
    completedAt: '2026-08-20T10:00:00Z',
    durationSeconds: 3600,
    totalSetsCompleted: 12,
    totalExercises: 4,
    exercisesSummary: [],
    ...overrides
  }
}

describe('calculateSessionVolumeDelta', () => {
  it('returns baseline session when history is empty', () => {
    const res = calculateSessionVolumeDelta(0, 1800, 12, [])
    expect(res.hasPreviousSession).toBe(false)
    expect(res.trend).toBe('first_recorded_session')
    expect(res.currentVolumeKg).toBe(1800)
    expect(res.previousVolumeKg).toBeNull()
    expect(res.setsDelta).toBeNull()
    expect(res.factualSummary).toBe('First logged session for this training split.')
  })

  it('returns baseline when history has no matching dayIndex', () => {
    const history = [makeLog({ dayIndex: 1, dayTitle: 'Pull Day' })]
    const res = calculateSessionVolumeDelta(0, 1800, 12, history)
    expect(res.hasPreviousSession).toBe(false)
    expect(res.trend).toBe('first_recorded_session')
  })

  it('identifies volume & sets up when current sets exceed previous sets', () => {
    const history = [
      makeLog({
        dayIndex: 0,
        dayTitle: 'Push Day',
        completedAt: '2026-08-15T10:00:00Z',
        totalSetsCompleted: 10
      })
    ]

    const res = calculateSessionVolumeDelta(0, 2000, 12, history)
    expect(res.hasPreviousSession).toBe(true)
    expect(res.setsDelta).toBe(2)
    expect(res.trend).toBe('load_increased')
    expect(res.trendLabel).toBe('Volume & Sets Up')
    expect(res.factualSummary).toContain('+2 sets vs Aug 15')
  })

  it('identifies load reduced when current sets are fewer than previous', () => {
    const history = [
      makeLog({
        dayIndex: 0,
        dayTitle: 'Push Day',
        completedAt: '2026-08-15T10:00:00Z',
        totalSetsCompleted: 14
      })
    ]

    const res = calculateSessionVolumeDelta(0, 1500, 10, history)
    expect(res.hasPreviousSession).toBe(true)
    expect(res.setsDelta).toBe(-4)
    expect(res.trend).toBe('load_reduced')
    expect(res.trendLabel).toBe('Fewer Sets')
  })

  it('handles zero volume and zero sets safely without NaN', () => {
    const history = [makeLog({ dayIndex: 0, totalSetsCompleted: 0 })]
    const res = calculateSessionVolumeDelta(0, 0, 0, history)
    expect(res.hasPreviousSession).toBe(true)
    expect(res.currentVolumeKg).toBe(0)
    expect(res.setsDelta).toBe(0)
    expect(res.trend).toBe('load_maintained')
  })

  it('excludes current session from comparison when excludeSessionId is provided', () => {
    const currentSessionId = 'current_sess_123'
    const history = [
      makeLog({ sessionId: currentSessionId, dayIndex: 0, totalSetsCompleted: 15 }),
      makeLog({ sessionId: 'older_sess_456', dayIndex: 0, totalSetsCompleted: 10, completedAt: '2026-08-10T10:00:00Z' })
    ]

    const res = calculateSessionVolumeDelta(0, 1800, 12, history, currentSessionId)
    expect(res.hasPreviousSession).toBe(true)
    // Should compare against older_sess_456 (10 sets), not current_sess_123 (15 sets)
    expect(res.setsDelta).toBe(2) // 12 - 10
  })

  it('handles non-numeric or infinite inputs safely', () => {
    const res = calculateSessionVolumeDelta(0, (NaN as unknown) as number, (Infinity as unknown) as number, [])
    expect(res.currentVolumeKg).toBe(0)
    expect(res.hasPreviousSession).toBe(false)
  })
})
