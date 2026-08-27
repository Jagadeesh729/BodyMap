import { describe, it, expect } from 'vitest'
import { getRecommendedRepTempo } from '@/lib/setTempoGuidance'

describe('Repetition Tempo Guidance Suite', () => {
  it('maps hypertrophy and bodybuilding goals to 3-0-1-0 tempo', () => {
    const res = getRecommendedRepTempo('Hypertrophy / Muscle Building', 'compound')
    expect(res.tempoString).toBe('3-0-1-0')
    expect(res.eccentricSeconds).toBe(3)
    expect(res.concentricSeconds).toBe(1)
    expect(res.summaryLabel).toContain('3s Lower')
  })

  it('maps strength and powerlifting goals to 2-0-1-0 tempo', () => {
    const res = getRecommendedRepTempo('Pure Strength & Power', 'compound')
    expect(res.tempoString).toBe('2-0-1-0')
    expect(res.eccentricSeconds).toBe(2)
    expect(res.concentricSeconds).toBe(1)
  })

  it('maps endurance and conditioning goals to 2-0-2-0 tempo', () => {
    const res = getRecommendedRepTempo('Endurance & Stamina', 'isolation')
    expect(res.tempoString).toBe('2-0-2-0')
    expect(res.eccentricSeconds).toBe(2)
    expect(res.concentricSeconds).toBe(2)
  })

  it('handles cardio and core movements with continuous pacing', () => {
    const res = getRecommendedRepTempo('Fat Loss', 'cardio')
    expect(res.tempoString).toBe('Smooth')
  })

  it('falls back gracefully to standard baseline tempo for unrecognized or empty inputs', () => {
    const res = getRecommendedRepTempo(null, null)
    expect(res.tempoString).toBe('2-0-1-0')
  })
})
