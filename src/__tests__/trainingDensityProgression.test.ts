import { describe, it, expect } from 'vitest'
import { calculateTrainingDensityProgression } from '@/lib/trainingDensityProgression'

describe('Training Density & Efficiency Progression Suite', () => {
  it('detects density progression across consecutive 14-day training blocks', () => {
    const now = 1700000000000
    const oneDay = 86400000

    const history = [
      // Recent 14-day block: 6000 kg in 40 mins -> 150 kg/min
      {
        completedAt: now - 3 * oneDay,
        durationMinutes: 40,
        totalVolumeKg: 6000
      },
      // Prior 14-day block: 5000 kg in 50 mins -> 100 kg/min
      {
        completedAt: now - 18 * oneDay,
        durationMinutes: 50,
        totalVolumeKg: 5000
      }
    ]

    const res = calculateTrainingDensityProgression(history, now)
    expect(res.hasSufficientData).toBe(true)
    expect(res.currentDensityKgPerMin).toBe(150)
    expect(res.previousDensityKgPerMin).toBe(100)
    expect(res.densityDeltaKgPerMin).toBe(50)
    expect(res.densityDeltaPercentage).toBe(50)
    expect(res.densityTrend).toBe('increasing_density')
    expect(res.trendLabel).toContain('+50 kg/min')
  })

  it('handles empty workout histories safely without NaN or crashes', () => {
    const res = calculateTrainingDensityProgression([])
    expect(res.hasSufficientData).toBe(false)
    expect(res.densityTrend).toBe('insufficient_data')
  })
})
