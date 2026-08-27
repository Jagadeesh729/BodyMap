import { describe, it, expect } from 'vitest'
import { calculateSplitBalance } from '@/lib/splitBalanceMatrix'
import { DEFAULT_WEEKLY_PLAN } from '@/types/plan'

describe('Weekly Split Balance & PPL Ratio Suite', () => {
  it('analyzes standard weekly plan and returns positive push, pull, legs counts', () => {
    const res = calculateSplitBalance(DEFAULT_WEEKLY_PLAN)
    expect(res.hasData).toBe(true)
    expect(res.totalExercises).toBeGreaterThan(0)
    expect(res.pushCount + res.pullCount + res.legsCount + res.coreAccessoryCount).toBe(res.totalExercises)
    expect(res.summary).toContain('total exercises')
  })

  it('handles empty plans safely without throwing errors', () => {
    const res = calculateSplitBalance(null)
    expect(res.hasData).toBe(false)
    expect(res.totalExercises).toBe(0)
  })
})
