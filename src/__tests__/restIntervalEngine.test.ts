import { describe, it, expect } from 'vitest'
import {
  classifyMovementType,
  calculateRecommendedRestSeconds
} from '@/lib/restIntervalEngine'

describe('Adaptive Rest Interval Engine Suite', () => {
  it('classifies major compound, isolation, and cardio exercises accurately', () => {
    expect(classifyMovementType('Barbell Back Squat')).toBe('compound')
    expect(classifyMovementType('Barbell Bench Press')).toBe('compound')
    expect(classifyMovementType('Romanian Deadlift')).toBe('compound')
    expect(classifyMovementType('Standing Overhead Press')).toBe('compound')
    expect(classifyMovementType('Bicep Curls')).toBe('isolation')
    expect(classifyMovementType('Lateral Raises')).toBe('isolation')
    expect(classifyMovementType('Tricep Pushdown')).toBe('isolation')
    expect(classifyMovementType('Plank')).toBe('cardio')
    expect(classifyMovementType('Unknown Movement X')).toBe('unknown')
  })

  it('recommends longer recovery intervals for heavy compound lifts (<= 5 reps)', () => {
    const res = calculateRecommendedRestSeconds('Barbell Back Squat', 5)
    expect(res.movementType).toBe('compound')
    expect(res.recommendedRestSeconds).toBe(180)
    expect(res.rangeLabel).toBe('120–180s')
  })

  it('recommends moderate recovery intervals for standard compound hypertrophy (6-12 reps)', () => {
    const res = calculateRecommendedRestSeconds('Barbell Bench Press', 8)
    expect(res.movementType).toBe('compound')
    expect(res.recommendedRestSeconds).toBe(120)
    expect(res.rangeLabel).toBe('90–120s')
  })

  it('recommends shorter recovery intervals for accessory isolation work', () => {
    const res = calculateRecommendedRestSeconds('Lateral Raises', 10)
    expect(res.movementType).toBe('isolation')
    expect(res.recommendedRestSeconds).toBe(90)

    const highRep = calculateRecommendedRestSeconds('Lateral Raises', 15)
    expect(highRep.recommendedRestSeconds).toBe(60)
  })

  it('handles invalid or empty inputs safely with documented defaults', () => {
    expect(calculateRecommendedRestSeconds('', null).recommendedRestSeconds).toBe(90)
    expect(calculateRecommendedRestSeconds('Custom Exercise', -5).recommendedRestSeconds).toBe(90)
  })
})
