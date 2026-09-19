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

  describe('Timezone & Calendar Date Boundary Suite (T1-T8)', () => {
    it('T1: Local date == UTC date formats identical YYYY-MM-DD', () => {
      // Constructed using local Date constructor: year 2026, month index 8 (Sept), day 19, 12:00
      const d = new Date(2026, 8, 19, 12, 0, 0)
      expect(getTodayDateString(d)).toBe('2026-09-19')
    })

    it('T2: Local date one day ahead of UTC is formatted in local date, not UTC date', () => {
      // In a timezone ahead of UTC (e.g. Asia/Tokyo UTC+9), 01:00 AM on Sept 20 has UTC date Sept 19.
      // Mock local date getters to simulate a date where local date is 2026-09-20 but UTC date is 2026-09-19
      const mockDate = new Date('2026-09-19T16:00:00Z') // 16:00 UTC = Sept 19 in UTC
      vi.spyOn(mockDate, 'getFullYear').mockReturnValue(2026)
      vi.spyOn(mockDate, 'getMonth').mockReturnValue(8) // 0-indexed September
      vi.spyOn(mockDate, 'getDate').mockReturnValue(20) // Local calendar day is 20

      // Must produce local calendar date (2026-09-20), NOT UTC date (2026-09-19)
      expect(getTodayDateString(mockDate)).toBe('2026-09-20')
      expect(mockDate.toISOString().split('T')[0]).toBe('2026-09-19') // Proves discrepancy with UTC
    })

    it('T3: Local date one day behind UTC is formatted in local date, not UTC date', () => {
      // In a timezone behind UTC (e.g. America/Los_Angeles UTC-7), 08:00 PM on Sept 19 has UTC date Sept 20.
      const mockDate = new Date('2026-09-20T03:00:00Z') // 03:00 UTC = Sept 20 in UTC
      vi.spyOn(mockDate, 'getFullYear').mockReturnValue(2026)
      vi.spyOn(mockDate, 'getMonth').mockReturnValue(8) // September
      vi.spyOn(mockDate, 'getDate').mockReturnValue(19) // Local calendar day is 19

      // Must produce local calendar date (2026-09-19), NOT UTC date (2026-09-20)
      expect(getTodayDateString(mockDate)).toBe('2026-09-19')
      expect(mockDate.toISOString().split('T')[0]).toBe('2026-09-20') // Proves discrepancy with UTC
    })

    it('T4: Midnight boundary (00:00:00.000) formats the new local calendar day', () => {
      const midnight = new Date(2026, 8, 20, 0, 0, 0, 0)
      expect(getTodayDateString(midnight)).toBe('2026-09-20')
    })

    it('T5: Near-midnight boundary (23:59:59.999) remains on the current local day', () => {
      const nearMidnight = new Date(2026, 8, 19, 23, 59, 59, 999)
      expect(getTodayDateString(nearMidnight)).toBe('2026-09-19')
    })

    it('T6: Existing yesterday entry + new local day: yesterday intake does not bleed into today', () => {
      const yesterday = '2026-09-19'
      const today = '2026-09-20'

      addHydration(1750, yesterday)
      expect(getTodayHydration(yesterday)).toBe(1750)
      expect(getTodayHydration(today)).toBe(0) // Brand-new clean slate for today
    })

    it('T7: Reload on the boundary preserves distinct bucket allocations', () => {
      const dateA = '2026-09-19'
      const dateB = '2026-09-20'

      addHydration(500, dateA)
      addHydration(750, dateB)

      // Both persisted in storage under separate calendar keys
      const log = loadHydrationLog()
      expect(log[dateA]).toBe(500)
      expect(log[dateB]).toBe(750)
      expect(getTodayHydration(dateA)).toBe(500)
      expect(getTodayHydration(dateB)).toBe(750)
    })

    it('T8: Contract parity with streakCalculation formatCalendarDate', () => {
      const testDate = new Date(2026, 8, 19, 15, 30, 0)
      const expected = `${testDate.getFullYear()}-${String(testDate.getMonth() + 1).padStart(2, '0')}-${String(testDate.getDate()).padStart(2, '0')}`
      expect(getTodayDateString(testDate)).toBe(expected)
    })
  })
})
