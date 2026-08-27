import { describe, it, expect } from 'vitest'
import { calculateTargetHeartRateZones } from '@/lib/targetHeartRateZones'

describe('Target Heart Rate & Training Intensity Zones Suite', () => {
  it('calculates Tanaka HRmax accurately for age 30', () => {
    // 208 - (0.7 * 30) = 208 - 21 = 187 BPM
    const res = calculateTargetHeartRateZones(30)
    expect(res.hasValidAge).toBe(true)
    expect(res.estimatedMaxHr).toBe(187)
    expect(res.zones.length).toBe(5)
    expect(res.zones[0].bpmRange.min).toBe(94) // 50% of 187 = 93.5 -> 94
    expect(res.zones[4].bpmRange.max).toBe(187)
  })

  it('handles invalid ages with safe defaults', () => {
    const res = calculateTargetHeartRateZones(-5)
    expect(res.hasValidAge).toBe(false)
    expect(res.estimatedMaxHr).toBe(187)
  })
})
