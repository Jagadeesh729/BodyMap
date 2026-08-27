import { describe, it, expect } from 'vitest'
import { calculateDeloadAdvisory } from '@/lib/deloadRecommender'

describe('Deload Advisory Engine Suite', () => {
  it('returns normal status when history is empty or sparse', () => {
    const emptyRes = calculateDeloadAdvisory([])
    expect(emptyRes.hasData).toBe(false)
    expect(emptyRes.status).toBe('optimal_training')
    expect(emptyRes.tierLabel).toBe('Optimal Training Load')
  })

  it('detects 4-week sustained training volume and advises deload', () => {
    const now = new Date()
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

    const fourWeekHistory = [
      { date: daysAgo(2), volumeKg: 12000, sets: 20 },
      { date: daysAgo(9), volumeKg: 12500, sets: 20 },
      { date: daysAgo(16), volumeKg: 11800, sets: 18 },
      { date: daysAgo(23), volumeKg: 13000, sets: 22 }
    ]

    const res = calculateDeloadAdvisory(fourWeekHistory)
    expect(res.hasData).toBe(true)
    expect(res.consecutiveWeeksActive).toBe(4)
    expect(res.status).toBe('deload_recommended')
    expect(res.tierLabel).toBe('Deload Recommended')
    expect(res.explanation).toContain('40-50%')
  })

  it('detects 3-week cumulative training volume and returns consider_deload', () => {
    const now = new Date()
    const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

    const threeWeekHistory = [
      { date: daysAgo(2), volumeKg: 10000, sets: 16 },
      { date: daysAgo(9), volumeKg: 11000, sets: 18 },
      { date: daysAgo(16), volumeKg: 10500, sets: 17 }
    ]

    const res = calculateDeloadAdvisory(threeWeekHistory)
    expect(res.hasData).toBe(true)
    expect(res.consecutiveWeeksActive).toBe(3)
    expect(res.status).toBe('consider_deload')
    expect(res.tierLabel).toBe('Consider Deload Soon')
  })
})
