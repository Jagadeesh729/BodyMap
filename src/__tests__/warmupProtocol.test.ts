import { describe, it, expect } from 'vitest'
import { generateWarmupProtocol } from '@/lib/warmupProtocol'

describe('Progressive Warmup Set Protocol Suite', () => {
  it('generates a 4-step warmup ladder for a standard heavy lift', () => {
    // 100 kg working weight
    const res = generateWarmupProtocol(100)
    expect(res.hasProtocol).toBe(true)
    expect(res.sets.length).toBe(4)

    // Set 1: Bar baseline (20 kg)
    expect(res.sets[0].calculatedWeightKg).toBe(20)
    expect(res.sets[0].repsLabel).toBe('8–10 reps')

    // Set 2: 50% (50 kg)
    expect(res.sets[1].calculatedWeightKg).toBe(50)
    expect(res.sets[1].repsLabel).toBe('5 reps')

    // Set 3: 70% (70 kg)
    expect(res.sets[2].calculatedWeightKg).toBe(70)
    expect(res.sets[2].repsLabel).toBe('3 reps')

    // Set 4: 85% (85 kg)
    expect(res.sets[3].calculatedWeightKg).toBe(85)
    expect(res.sets[3].repsLabel).toBe('1–2 reps')
  })

  it('handles lighter working loads (< 40 kg) with proportional scaling', () => {
    const res = generateWarmupProtocol(30)
    expect(res.hasProtocol).toBe(true)
    // 40% of 30 = 12 kg
    expect(res.sets[0].calculatedWeightKg).toBe(12)
    // 50% of 30 = 15 kg
    expect(res.sets[1].calculatedWeightKg).toBe(15)
  })

  it('returns hasProtocol: false for loads < 15 kg or invalid values', () => {
    expect(generateWarmupProtocol(0).hasProtocol).toBe(false)
    expect(generateWarmupProtocol(10).hasProtocol).toBe(false)
    expect(generateWarmupProtocol(null).hasProtocol).toBe(false)
    expect(generateWarmupProtocol(600).hasProtocol).toBe(false)
  })
})
