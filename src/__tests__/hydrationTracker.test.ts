import { describe, it, expect, beforeEach } from 'vitest'
import {
  calculateHydrationTarget,
  getTodayHydration,
  addHydration,
  resetTodayHydration
} from '@/lib/hydrationTracker'

describe('Hydration Tracking & Target Engine Suite', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('calculates daily hydration target based on 35ml/kg heuristic', () => {
    // 70 kg * 35 = 2450 ml
    expect(calculateHydrationTarget(70)).toBe(2450)
    // 80 kg * 35 = 2800 ml
    expect(calculateHydrationTarget(80)).toBe(2800)
  })

  it('returns null for missing, non-numeric, or out-of-range weights', () => {
    expect(calculateHydrationTarget(null)).toBeNull()
    expect(calculateHydrationTarget('')).toBeNull()
    expect(calculateHydrationTarget(15)).toBeNull()
    expect(calculateHydrationTarget(500)).toBeNull()
  })

  it('logs, accumulates, and resets daily fluid intake', () => {
    const testDate = '2026-08-27'
    expect(getTodayHydration(testDate)).toBe(0)

    addHydration(250, testDate)
    expect(getTodayHydration(testDate)).toBe(250)

    addHydration(500, testDate)
    expect(getTodayHydration(testDate)).toBe(750)

    resetTodayHydration(testDate)
    expect(getTodayHydration(testDate)).toBe(0)
  })

  it('handles corrupted localStorage safely', () => {
    localStorage.setItem('bodymap_hydration_log', '{malformed json}')
    expect(getTodayHydration()).toBe(0)
  })
})
