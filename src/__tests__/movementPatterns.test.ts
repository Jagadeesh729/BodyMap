import { describe, it, expect } from 'vitest'
import { getMovementPattern } from '@/lib/movementPatterns'

describe('Movement Pattern & Biomechanical Classification Suite', () => {
  it('correctly classifies Horizontal Push exercises', () => {
    expect(getMovementPattern('Barbell Bench Press').pattern).toBe('Horizontal Push')
    expect(getMovementPattern('Push-ups').pattern).toBe('Horizontal Push')
    expect(getMovementPattern('Incline Dumbbell Press').pattern).toBe('Horizontal Push')
  })

  it('correctly classifies Vertical Push exercises', () => {
    expect(getMovementPattern('Overhead Press').pattern).toBe('Vertical Push')
    expect(getMovementPattern('Military Press').pattern).toBe('Vertical Push')
    expect(getMovementPattern('Arnold Press').pattern).toBe('Vertical Push')
  })

  it('correctly classifies Pulling exercises', () => {
    expect(getMovementPattern('Barbell Row').pattern).toBe('Horizontal Pull')
    expect(getMovementPattern('Cable Row').pattern).toBe('Horizontal Pull')
    expect(getMovementPattern('Pull-ups').pattern).toBe('Vertical Pull')
    expect(getMovementPattern('Lat Pulldown').pattern).toBe('Vertical Pull')
  })

  it('correctly classifies Lower Body Knee Dominant and Hip Hinge exercises', () => {
    expect(getMovementPattern('Barbell Back Squat').pattern).toBe('Knee Dominant')
    expect(getMovementPattern('Walking Lunges').pattern).toBe('Knee Dominant')
    expect(getMovementPattern('Romanian Deadlift').pattern).toBe('Hip Hinge')
    expect(getMovementPattern('Conventional Deadlift').pattern).toBe('Hip Hinge')
  })

  it('handles unknown or empty exercise names safely with default isolation/accessory pattern', () => {
    expect(getMovementPattern('').pattern).toBe('Isolation / Accessory')
    expect(getMovementPattern(null).pattern).toBe('Isolation / Accessory')
    expect(getMovementPattern('Random Complex Drill').pattern).toBe('Isolation / Accessory')
  })
})
