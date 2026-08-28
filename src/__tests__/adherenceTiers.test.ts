import { describe, it, expect } from 'vitest'
import type { CompletedWorkoutLog } from '@/types/workoutSession'
import { calculateAdherenceTier } from '@/lib/adherenceTiers'

// Helper: build a minimal production-shaped CompletedWorkoutLog.
// Uses completedAt (canonical field) — proves the real production call path.
function makeLog(daysAgo: number): CompletedWorkoutLog {
  const completedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
  return {
    id: `log-${daysAgo}`,
    sessionId: `session-${daysAgo}`,
    dayIndex: 0,
    dayTitle: 'Test Day',
    dayType: 'strength',
    completedAt,
    durationSeconds: 3600,
    totalSetsCompleted: 20,
    totalExercises: 5,
    exercisesSummary: []
  }
}

describe('Multi-Week Adherence Milestone Tiering Suite', () => {
  // ─── Failure-state coverage ──────────────────────────────────────────────

  it('returns Starter tier for empty workout history', () => {
    const res = calculateAdherenceTier([])
    expect(res.tier).toBe('Starter')
    expect(res.consecutiveWeeks).toBe(0)
    expect(res.badgeEmoji).toBe('🌱')
  })

  it('returns Starter tier for null input', () => {
    const res = calculateAdherenceTier(null)
    expect(res.tier).toBe('Starter')
    expect(res.consecutiveWeeks).toBe(0)
  })

  it('returns Starter tier for undefined input', () => {
    const res = calculateAdherenceTier(undefined)
    expect(res.tier).toBe('Starter')
    expect(res.consecutiveWeeks).toBe(0)
  })

  it('skips records with empty completedAt without crashing', () => {
    const badLog = { ...makeLog(2), completedAt: '' }
    const res = calculateAdherenceTier([badLog])
    expect(res.tier).toBe('Starter')
    expect(res.consecutiveWeeks).toBe(0)
  })

  it('skips records with malformed timestamp without crashing', () => {
    const badLog = { ...makeLog(2), completedAt: 'invalid' }
    const res = calculateAdherenceTier([badLog])
    expect(res.tier).toBe('Starter')
    expect(res.consecutiveWeeks).toBe(0)
  })

  // ─── Integration regression: completedAt → week tracking → tier ───────────

  it('determines Bronze tier for 1 to 2 consecutive active weeks', () => {
    // Critical integration regression test.
    // Before fix: item.date undefined → all records skipped → Starter tier always
    // After fix:  item.completedAt consumed → correct week set → Bronze tier
    const history = [makeLog(2), makeLog(9)]
    const res = calculateAdherenceTier(history)
    expect(res.tier).toBe('Bronze')
    expect(res.consecutiveWeeks).toBe(2)
    expect(res.badgeEmoji).toBe('🥉')
  })

  it('determines Silver tier for 3 to 4 consecutive active weeks', () => {
    const history = [makeLog(2), makeLog(9), makeLog(16)]
    const res = calculateAdherenceTier(history)
    expect(res.tier).toBe('Silver')
    expect(res.consecutiveWeeks).toBe(3)
    expect(res.badgeEmoji).toBe('🥈')
  })

  it('determines Gold tier for 5 to 8 consecutive active weeks', () => {
    const history = [makeLog(2), makeLog(9), makeLog(16), makeLog(23), makeLog(30)]
    const res = calculateAdherenceTier(history)
    expect(res.tier).toBe('Gold')
    expect(res.consecutiveWeeks).toBe(5)
    expect(res.badgeEmoji).toBe('🥇')
  })

  it('determines Diamond tier for 9+ consecutive active weeks', () => {
    const history = Array.from({ length: 9 }, (_, i) => makeLog(2 + i * 7))
    const res = calculateAdherenceTier(history)
    expect(res.tier).toBe('Diamond')
    expect(res.consecutiveWeeks).toBe(9)
    expect(res.badgeEmoji).toBe('💎')
    expect(res.progressPercent).toBe(100)
  })

  it('correctly handles gap in recent week — uses previous week if current is absent', () => {
    // No workout in the last 7 days (week 0), but workout in week 1 (7-14 days ago)
    const history = [makeLog(9)]
    const res = calculateAdherenceTier(history)
    expect(res.consecutiveWeeks).toBe(1)
    expect(res.tier).toBe('Bronze')
  })

  it('ignores records older than 90 days for tier calculation', () => {
    const history = [makeLog(3), makeLog(95)]
    const res = calculateAdherenceTier(history)
    expect(res.consecutiveWeeks).toBe(1)
    expect(res.tier).toBe('Bronze')
  })
})
