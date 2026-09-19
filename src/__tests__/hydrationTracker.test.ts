import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  calculateHydrationTarget,
  getTodayHydration,
  addHydration,
  resetTodayHydration,
  loadHydrationLog,
  isValidDateStr,
  getTodayDateString,
  HYDRATION_STORAGE_KEY,
  STORAGE_KEY
} from '@/lib/hydrationTracker'

describe('Hydration Tracking & Target Engine Suite', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('exports canonical constants and aliases', () => {
    expect(HYDRATION_STORAGE_KEY).toBe('bodymap_hydration_log')
    expect(STORAGE_KEY).toBe('bodymap_hydration_log')
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

  it('validates Gregorian calendar date format strictly', () => {
    expect(isValidDateStr('2026-09-19')).toBe(true)
    expect(isValidDateStr('2026-02-28')).toBe(true)
    expect(isValidDateStr('2024-02-29')).toBe(true) // Leap year
    expect(isValidDateStr('2025-02-29')).toBe(false) // Non-leap year
    expect(isValidDateStr('2026-09-31')).toBe(false) // September has 30 days
    expect(isValidDateStr('2026-13-01')).toBe(false) // Invalid month
    expect(isValidDateStr('invalid-date')).toBe(false)
    expect(isValidDateStr('')).toBe(false)
    expect(isValidDateStr('2026/09/19')).toBe(false)
    expect(isValidDateStr(null as unknown as string)).toBe(false)
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
    expect(loadHydrationLog()).toEqual({})
  })

  it('rejects array and non-object storage payloads', () => {
    localStorage.setItem(HYDRATION_STORAGE_KEY, JSON.stringify(['not', 'an', 'object']))
    expect(loadHydrationLog()).toEqual({})

    localStorage.setItem(HYDRATION_STORAGE_KEY, JSON.stringify(12345))
    expect(loadHydrationLog()).toEqual({})

    localStorage.setItem(HYDRATION_STORAGE_KEY, JSON.stringify('string-value'))
    expect(loadHydrationLog()).toEqual({})
  })

  it('sanitizes and filters corrupted or malicious keys from stored map', () => {
    const malicious = {
      '__proto__': { polluted: true },
      'constructor': { polluted: true },
      '2026-09-19': 500,
      'invalid-date': 750,
      '2026-09-20': -100,
      '2026-09-21': NaN,
      '2026-09-22': 'not-a-number'
    }
    localStorage.setItem(HYDRATION_STORAGE_KEY, JSON.stringify(malicious))
    const log = loadHydrationLog()

    expect(log['2026-09-19']).toBe(500)
    expect(log['invalid-date']).toBeUndefined()
    expect(log['2026-09-20']).toBeUndefined()
    expect(log['2026-09-21']).toBeUndefined()
    expect(log['2026-09-22']).toBeUndefined()
  })

  it('yesterday entry does not count as today intake', () => {
    const today = getTodayDateString()
    const yesterday = '2026-09-18'
    expect(yesterday).not.toBe(today)

    addHydration(1000, yesterday)
    expect(getTodayHydration(yesterday)).toBe(1000)
    expect(getTodayHydration()).toBe(0)
  })

  it('rejects negative, NaN, Infinity, and non-numeric quick-add amounts', () => {
    const testDate = '2026-09-19'
    addHydration(250, testDate)
    expect(getTodayHydration(testDate)).toBe(250)

    // Negative should be rejected without reducing intake
    addHydration(-100, testDate)
    expect(getTodayHydration(testDate)).toBe(250)

    // NaN rejected
    addHydration(NaN, testDate)
    expect(getTodayHydration(testDate)).toBe(250)

    // Infinity rejected
    addHydration(Infinity, testDate)
    expect(getTodayHydration(testDate)).toBe(250)

    // String rejected
    addHydration('500' as unknown as number, testDate)
    expect(getTodayHydration(testDate)).toBe(250)
  })

  it('enforces upper safety limit of 10,000 mL (10 Liters)', () => {
    const testDate = '2026-09-19'
    addHydration(9500, testDate)
    expect(getTodayHydration(testDate)).toBe(9500)

    addHydration(1000, testDate)
    expect(getTodayHydration(testDate)).toBe(10000)

    addHydration(5000, testDate)
    expect(getTodayHydration(testDate)).toBe(10000)
  })

  it('handles storage read and write exceptions gracefully without throwing', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage access denied')
    })
    expect(() => getTodayHydration()).not.toThrow()
    expect(getTodayHydration()).toBe(0)
    getItemSpy.mockRestore()

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded', 'QuotaExceededError')
    })
    expect(() => addHydration(250)).not.toThrow()
    expect(() => resetTodayHydration()).not.toThrow()
    setItemSpy.mockRestore()
  })

  it('ignores invalid dates passed to addHydration or resetTodayHydration', () => {
    expect(() => addHydration(250, 'bad-date')).not.toThrow()
    expect(() => resetTodayHydration('bad-date')).not.toThrow()
  })
})
