import { describe, it, expect } from 'vitest'
import { validateSessionReflection, formatReflectionSummary } from '@/lib/sessionReflectionTaxonomy'

describe('Session Reflection Taxonomy Suite', () => {
  it('validates and accepts clean subjective reflection payload', () => {
    const valid = {
      energyRating: 4,
      perceivedReadiness: 'moderate' as const,
      reflectionTags: ['High Energy', 'Form Focus'],
      notes: 'Strong tempo on working sets.'
    }
    const res = validateSessionReflection(valid)
    expect(res).not.toBeNull()
    expect(res?.energyRating).toBe(4)
    expect(res?.perceivedReadiness).toBe('moderate')
    expect(res?.reflectionTags).toHaveLength(2)
  })

  it('rejects invalid energy ratings and unknown readiness strings', () => {
    const invalid = {
      energyRating: 10,
      perceivedReadiness: 'extreme_recovery'
    }
    const res = validateSessionReflection(invalid)
    expect(res).toBeNull()
  })

  it('formats reflection summary string cleanly for UI', () => {
    const res = formatReflectionSummary({
      energyRating: 5,
      perceivedReadiness: 'high',
      reflectionTags: ['Solid Pump']
    })
    expect(res).toContain('Energy: 5/5')
    expect(res).toContain('Readiness: High')
    expect(res).toContain('#SolidPump')
  })
})
