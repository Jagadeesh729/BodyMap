import { describe, it, expect } from 'vitest'
import { calculateEstimated1RM } from '@/lib/oneRepMax'

describe('One Rep Max (1RM) Estimator & Working Weight Suite', () => {
  it('calculates 1RM accurately using Epley formula for standard lifts', () => {
    // 100 kg for 10 reps -> 100 * (1 + 10/30) = 133.33 -> rounded to 133.5 kg
    const res = calculateEstimated1RM(100, 10, 'epley')
    expect(res.hasValidEstimate).toBe(true)
    expect(res.estimated1rmKg).toBe(133.5)
    expect(res.formulaUsed).toBe('Epley')
    expect(res.workingWeights.length).toBe(5)
    // 85% of 133.5 = 113.475 -> ~113.5 kg
    const w85 = res.workingWeights.find(w => w.percentage === 85)
    expect(w85?.calculatedWeightKg).toBe(113.5)
  })

  it('calculates 1RM accurately using Brzycki formula', () => {
    // 100 kg for 5 reps -> 100 * 36 / (37 - 5) = 3600 / 32 = 112.5 kg
    const res = calculateEstimated1RM(100, 5, 'brzycki')
    expect(res.hasValidEstimate).toBe(true)
    expect(res.estimated1rmKg).toBe(112.5)
    expect(res.formulaUsed).toBe('Brzycki')
  })

  it('returns exact weight for a 1-rep lift without inflation', () => {
    const res = calculateEstimated1RM(120, 1)
    expect(res.hasValidEstimate).toBe(true)
    expect(res.estimated1rmKg).toBe(120)
  })

  it('handles invalid, negative, zero, and out-of-range inputs safely', () => {
    expect(calculateEstimated1RM(0, 5).hasValidEstimate).toBe(false)
    expect(calculateEstimated1RM(-50, 5).hasValidEstimate).toBe(false)
    expect(calculateEstimated1RM(100, 0).hasValidEstimate).toBe(false)
    expect(calculateEstimated1RM(100, 45).hasValidEstimate).toBe(false) // > 30 reps unsupported
    expect(calculateEstimated1RM(null, 5).hasValidEstimate).toBe(false)
  })
})
