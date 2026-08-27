import { describe, it, expect } from 'vitest'
import { calculateHydrationClimateAdjustment } from '@/lib/hydrationClimateAdjustment'

describe('Hydration Climate Context Adjustment Suite', () => {
  it('calculates climate adjustment values accurately for temperate, warm, and hot contexts', () => {
    // Temperate: +0 ml
    const temperate = calculateHydrationClimateAdjustment(2500, 'temperate')
    expect(temperate.baseTargetMl).toBe(2500)
    expect(temperate.climate).toBe('temperate')
    expect(temperate.climateAdjustmentMl).toBe(0)
    expect(temperate.totalPlanningTargetMl).toBe(2500)

    // Warm: +250 ml
    const warm = calculateHydrationClimateAdjustment(2500, 'warm')
    expect(warm.climate).toBe('warm')
    expect(warm.climateAdjustmentMl).toBe(250)
    expect(warm.totalPlanningTargetMl).toBe(2750)

    // Hot: +500 ml
    const hot = calculateHydrationClimateAdjustment(2500, 'hot')
    expect(hot.climate).toBe('hot')
    expect(hot.climateAdjustmentMl).toBe(500)
    expect(hot.totalPlanningTargetMl).toBe(3000)
  })

  it('handles empty or missing base target safely with default baseline', () => {
    const res = calculateHydrationClimateAdjustment(0, 'warm')
    expect(res.baseTargetMl).toBe(2000)
    expect(res.climateAdjustmentMl).toBe(250)
    expect(res.totalPlanningTargetMl).toBe(2250)
  })
})
