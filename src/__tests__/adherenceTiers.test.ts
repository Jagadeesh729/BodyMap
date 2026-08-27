import { describe, it, expect } from 'vitest'
import { calculateAdherenceTier } from '@/lib/adherenceTiers'

describe('Multi-Week Adherence Milestone Tiering Suite', () => {
  it('returns Starter tier for empty workout history', () => {
    const res = calculateAdherenceTier([])
    expect(res.tier).toBe('Starter')
    expect(res.consecutiveWeeks).toBe(0)
    expect(res.badgeEmoji).toBe('🌱')
  })

  it('determines Bronze tier for 1 to 2 consecutive active weeks', () => {
    const now = new Date()
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

    const history = [{ date: daysAgo(2) }, { date: daysAgo(9) }]
    const res = calculateAdherenceTier(history)
    expect(res.tier).toBe('Bronze')
    expect(res.consecutiveWeeks).toBe(2)
    expect(res.badgeEmoji).toBe('🥉')
  })

  it('determines Silver tier for 3 to 4 consecutive active weeks', () => {
    const now = new Date()
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

    const history = [
      { date: daysAgo(2) },
      { date: daysAgo(9) },
      { date: daysAgo(16) }
    ]
    const res = calculateAdherenceTier(history)
    expect(res.tier).toBe('Silver')
    expect(res.consecutiveWeeks).toBe(3)
    expect(res.badgeEmoji).toBe('🥈')
  })

  it('determines Gold tier for 5 to 8 consecutive active weeks', () => {
    const now = new Date()
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

    const history = [
      { date: daysAgo(2) },
      { date: daysAgo(9) },
      { date: daysAgo(16) },
      { date: daysAgo(23) },
      { date: daysAgo(30) }
    ]
    const res = calculateAdherenceTier(history)
    expect(res.tier).toBe('Gold')
    expect(res.consecutiveWeeks).toBe(5)
    expect(res.badgeEmoji).toBe('🥇')
  })
})
