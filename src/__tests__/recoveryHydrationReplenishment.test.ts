import { describe, it, expect } from 'vitest'
import { calculateRecoveryHydration } from '@/lib/recoveryHydrationReplenishment'

describe('Recovery Hydration Replenishment Suite', () => {
  it('calculates bounded fluid replenishment for a standard 45-min workout', () => {
    const res = calculateRecoveryHydration(45, 5000, 'temperate')
    expect(res.hasValidInput).toBe(true)
    expect(res.recommendedFluidMl).toBeGreaterThanOrEqual(350)
    expect(res.recommendedFluidMl).toBeLessThanOrEqual(1000)
    expect(res.recommendedRangeMl.min).toBeLessThan(res.recommendedFluidMl)
    expect(res.recommendedRangeMl.max).toBeGreaterThan(res.recommendedFluidMl)
  })

  it('adjusts fluid target upwards in hot climate', () => {
    const tempRes = calculateRecoveryHydration(60, 8000, 'temperate')
    const hotRes = calculateRecoveryHydration(60, 8000, 'hot')
    expect(hotRes.recommendedFluidMl).toBeGreaterThan(tempRes.recommendedFluidMl)
  })

  it('handles zero or missing values safely without crashing or returning NaN', () => {
    const emptyRes = calculateRecoveryHydration(0, 0)
    expect(emptyRes.hasValidInput).toBe(false)
    expect(emptyRes.recommendedFluidMl).toBe(0)
  })
})
