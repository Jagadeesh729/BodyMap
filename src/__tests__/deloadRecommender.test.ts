import { describe, it, expect } from 'vitest'
import type { CompletedWorkoutLog } from '@/types/workoutSession'
import { calculateDeloadAdvisory } from '@/lib/deloadRecommender'

// Helper: build a minimal production-shaped CompletedWorkoutLog.
// Uses completedAt (canonical field) — proves the real production call path.
function makeLog(daysAgo: number, totalSetsCompleted = 20): CompletedWorkoutLog {
  const completedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  return {
    id: `log-${daysAgo}`,
    sessionId: `session-${daysAgo}`,
    dayIndex: 0,
    dayTitle: 'Test Day',
    dayType: 'strength',
    completedAt,
    durationSeconds: 3600,
    totalSetsCompleted,
    totalExercises: 5,
    exercisesSummary: []
  }
}

describe('Deload Advisory Engine Suite', () => {
  // ─── Failure-state coverage ──────────────────────────────────────────────

  it('returns no-data floor state for empty history', () => {
    const emptyRes = calculateDeloadAdvisory([])
    expect(emptyRes.hasData).toBe(false)
    expect(emptyRes.status).toBe('optimal_training')
    expect(emptyRes.tierLabel).toBe('Optimal Training Load')
    expect(emptyRes.consecutiveWeeksActive).toBe(0)
  })

  it('returns no-data floor state for null input', () => {
    const res = calculateDeloadAdvisory(null)
    expect(res.hasData).toBe(false)
    expect(res.status).toBe('optimal_training')
    expect(res.consecutiveWeeksActive).toBe(0)
  })

  it('returns no-data floor state for undefined input', () => {
    const res = calculateDeloadAdvisory(undefined)
    expect(res.hasData).toBe(false)
    expect(res.status).toBe('optimal_training')
    expect(res.consecutiveWeeksActive).toBe(0)
  })

  it('skips records with empty completedAt without crashing', () => {
    const badLog = { ...makeLog(2), completedAt: '' }
    const res = calculateDeloadAdvisory([badLog])
    expect(res.hasData).toBe(true)
    expect(res.consecutiveWeeksActive).toBe(0)
    expect(res.status).toBe('optimal_training')
  })

  it('skips records with malformed timestamp without crashing', () => {
    const badLog = { ...makeLog(2), completedAt: 'not-a-date' }
    const res = calculateDeloadAdvisory([badLog])
    expect(res.hasData).toBe(true)
    expect(res.consecutiveWeeksActive).toBe(0)
    expect(res.status).toBe('optimal_training')
  })

  // ─── Below threshold ─────────────────────────────────────────────────────

  it('returns optimal_training for a single active week (below threshold)', () => {
    const res = calculateDeloadAdvisory([makeLog(2)])
    expect(res.hasData).toBe(true)
    expect(res.consecutiveWeeksActive).toBe(1)
    expect(res.status).toBe('optimal_training')
    expect(res.tierLabel).toBe('Optimal Training Load')
  })

  it('returns optimal_training for 2 active weeks (below threshold)', () => {
    const res = calculateDeloadAdvisory([makeLog(2), makeLog(9)])
    expect(res.hasData).toBe(true)
    expect(res.consecutiveWeeksActive).toBe(2)
    expect(res.status).toBe('optimal_training')
  })

  // ─── Integration regression: completedAt → week count → advisory ──────────

  it('detects 3 consecutive active weeks and returns consider_deload', () => {
    // Critical integration regression test.
    // Before fix: item.date undefined → all records skipped → activeWeeksCount=0 → 'optimal_training'
    // After fix:  item.completedAt consumed → correct bucketing → 'consider_deload'
    const history = [makeLog(2), makeLog(9), makeLog(16)]
    const res = calculateDeloadAdvisory(history)
    expect(res.hasData).toBe(true)
    expect(res.consecutiveWeeksActive).toBe(3)
    expect(res.status).toBe('consider_deload')
    expect(res.tierLabel).toBe('Consider Deload Soon')
    expect(res.explanation).toContain('week 4')
  })

  it('detects 4 consecutive active weeks and advises deload', () => {
    const history = [makeLog(2), makeLog(9), makeLog(16), makeLog(23)]
    const res = calculateDeloadAdvisory(history)
    expect(res.hasData).toBe(true)
    expect(res.consecutiveWeeksActive).toBe(4)
    expect(res.status).toBe('deload_recommended')
    expect(res.tierLabel).toBe('Deload Recommended')
    expect(res.explanation).toContain('40-50%')
  })

  it('ignores records older than 28 days for week bucketing', () => {
    const history = [makeLog(3), makeLog(35)]
    const res = calculateDeloadAdvisory(history)
    expect(res.consecutiveWeeksActive).toBe(1)
    expect(res.status).toBe('optimal_training')
  })

  it('correctly handles zero-sets records — does not inflate active week count', () => {
    // Week 0 has 0 sets → 0 volume → not counted as active week
    const history = [makeLog(2, 0), makeLog(9, 20), makeLog(16, 20)]
    const res = calculateDeloadAdvisory(history)
    expect(res.consecutiveWeeksActive).toBe(2)
    expect(res.status).toBe('optimal_training')
  })
})

