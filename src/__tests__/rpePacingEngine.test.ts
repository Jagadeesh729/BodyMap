import { describe, it, expect } from 'vitest'
import { calculateRIRFromRPE } from '@/lib/rpePacingEngine'

describe('RPE / RIR Pacing Engine Suite', () => {
  it('maps integer and fractional RPE to correct Reps in Reserve (RIR)', () => {
    // 10.0 RPE -> 0 RIR (Maximal)
    const ten = calculateRIRFromRPE(10)
    expect(ten.isValid).toBe(true)
    expect(ten.rpe).toBe(10)
    expect(ten.estimatedRIR).toBe(0)
    expect(ten.effortLevel).toBe('maximal')
    expect(ten.summaryLabel).toContain('0 RIR')

    // 9.5 RPE -> 0.5 RIR
    const ninePointFive = calculateRIRFromRPE(9.5)
    expect(ninePointFive.isValid).toBe(true)
    expect(ninePointFive.estimatedRIR).toBe(0.5)
    expect(ninePointFive.effortLevel).toBe('maximal')

    // 9.0 RPE -> 1.0 RIR
    const nine = calculateRIRFromRPE(9)
    expect(nine.isValid).toBe(true)
    expect(nine.estimatedRIR).toBe(1)
    expect(nine.effortLevel).toBe('heavy')

    // 8.5 RPE -> 1.5 RIR
    const eightPointFive = calculateRIRFromRPE(8.5)
    expect(eightPointFive.isValid).toBe(true)
    expect(eightPointFive.estimatedRIR).toBe(1.5)
    expect(eightPointFive.effortLevel).toBe('heavy')

    // 8.0 RPE -> 2.0 RIR
    const eight = calculateRIRFromRPE(8)
    expect(eight.isValid).toBe(true)
    expect(eight.estimatedRIR).toBe(2)
    expect(eight.effortLevel).toBe('moderate')

    // 7.5 RPE -> 2.5 RIR
    const sevenPointFive = calculateRIRFromRPE(7.5)
    expect(sevenPointFive.isValid).toBe(true)
    expect(sevenPointFive.estimatedRIR).toBe(2.5)

    // 6.0 RPE -> 4.0 RIR
    const six = calculateRIRFromRPE(6)
    expect(six.isValid).toBe(true)
    expect(six.estimatedRIR).toBe(4)
    expect(six.effortLevel).toBe('submaximal')
  })

  it('handles string numbers accurately', () => {
    const res = calculateRIRFromRPE('8.5')
    expect(res.isValid).toBe(true)
    expect(res.rpe).toBe(8.5)
    expect(res.estimatedRIR).toBe(1.5)
  })

  it('rejects out of bounds and non-numeric values safely', () => {
    expect(calculateRIRFromRPE(5.5).isValid).toBe(false)
    expect(calculateRIRFromRPE(10.5).isValid).toBe(false)
    expect(calculateRIRFromRPE(NaN).isValid).toBe(false)
    expect(calculateRIRFromRPE(null).isValid).toBe(false)
    expect(calculateRIRFromRPE('invalid').isValid).toBe(false)
  })
})
