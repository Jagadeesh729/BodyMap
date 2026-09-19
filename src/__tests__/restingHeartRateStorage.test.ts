import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  RESTING_HEART_RATE_STORAGE_KEY,
  DEFAULT_RESTING_HEART_RATE_BPM,
  DEFAULT_RHR,
  STORAGE_KEY,
  validateRestingHeartRate,
  loadRestingHeartRate,
  saveRestingHeartRate,
  clearRestingHeartRate
} from '@/lib/restingHeartRateStorage'

describe('Resting Heart Rate Storage Engine (E26-B)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('Constants & Canonical Aliases', () => {
    it('exports canonical storage key and default resting heart rate BPM', () => {
      expect(RESTING_HEART_RATE_STORAGE_KEY).toBe('bodymap_resting_heart_rate')
      expect(STORAGE_KEY).toBe('bodymap_resting_heart_rate')
      expect(DEFAULT_RESTING_HEART_RATE_BPM).toBe(60)
      expect(DEFAULT_RHR).toBe(60)
    })
  })

  describe('Validation: validateRestingHeartRate', () => {
    it('accepts exact boundary values 30 and 120 as valid integers', () => {
      expect(validateRestingHeartRate(30)).toBe(30)
      expect(validateRestingHeartRate('30')).toBe(30)
      expect(validateRestingHeartRate(120)).toBe(120)
      expect(validateRestingHeartRate('120')).toBe(120)
    })

    it('accepts valid mid-range whole numbers and numeric strings', () => {
      expect(validateRestingHeartRate(50)).toBe(50)
      expect(validateRestingHeartRate('60')).toBe(60)
      expect(validateRestingHeartRate(72)).toBe(72)
      expect(validateRestingHeartRate('85')).toBe(85)
      expect(validateRestingHeartRate('+65')).toBe(65)
    })

    it('rejects values below MIN_RESTING_HR_BPM (30)', () => {
      expect(validateRestingHeartRate(29)).toBeNull()
      expect(validateRestingHeartRate('29')).toBeNull()
      expect(validateRestingHeartRate(0)).toBeNull()
      expect(validateRestingHeartRate(-10)).toBeNull()
      expect(validateRestingHeartRate('-50')).toBeNull()
    })

    it('rejects values above MAX_RESTING_HR_BPM (120)', () => {
      expect(validateRestingHeartRate(121)).toBeNull()
      expect(validateRestingHeartRate('121')).toBeNull()
      expect(validateRestingHeartRate(150)).toBeNull()
      expect(validateRestingHeartRate(999)).toBeNull()
    })

    it('rejects fractional and decimal numbers', () => {
      expect(validateRestingHeartRate(59.5)).toBeNull()
      expect(validateRestingHeartRate('59.5')).toBeNull()
      expect(validateRestingHeartRate(60.1)).toBeNull()
      expect(validateRestingHeartRate('60.0')).toBeNull()
    })

    it('rejects non-numeric strings, units, and malformed text', () => {
      expect(validateRestingHeartRate('')).toBeNull()
      expect(validateRestingHeartRate('   ')).toBeNull()
      expect(validateRestingHeartRate('abc')).toBeNull()
      expect(validateRestingHeartRate('60bpm')).toBeNull()
      expect(validateRestingHeartRate('60 bpm')).toBeNull()
      expect(validateRestingHeartRate('70 BPM')).toBeNull()
      expect(validateRestingHeartRate('60e1')).toBeNull()
      expect(validateRestingHeartRate('NaN')).toBeNull()
      expect(validateRestingHeartRate('Infinity')).toBeNull()
      expect(validateRestingHeartRate('-Infinity')).toBeNull()
    })

    it('rejects non-finite number primitives', () => {
      expect(validateRestingHeartRate(NaN)).toBeNull()
      expect(validateRestingHeartRate(Infinity)).toBeNull()
      expect(validateRestingHeartRate(-Infinity)).toBeNull()
    })

    it('rejects non-primitive and null/undefined values', () => {
      expect(validateRestingHeartRate(null)).toBeNull()
      expect(validateRestingHeartRate(undefined)).toBeNull()
      expect(validateRestingHeartRate({})).toBeNull()
      expect(validateRestingHeartRate([])).toBeNull()
      expect(validateRestingHeartRate(() => 60)).toBeNull()
      expect(validateRestingHeartRate(true)).toBeNull()
      expect(validateRestingHeartRate(false)).toBeNull()
    })
  })

  describe('Persistence: saveRestingHeartRate', () => {
    it('saves valid whole numbers and numeric strings to localStorage', () => {
      const resNum = saveRestingHeartRate(65)
      expect(resNum).toBe(true)
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBe('65')

      const resStr = saveRestingHeartRate('74')
      expect(resStr).toBe(true)
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBe('74')
    })

    it('refuses to persist invalid values and does not touch localStorage', () => {
      const resUnder = saveRestingHeartRate(29)
      expect(resUnder).toBe(false)
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBeNull()

      const resOver = saveRestingHeartRate(125)
      expect(resOver).toBe(false)
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBeNull()

      const resText = saveRestingHeartRate('invalid')
      expect(resText).toBe(false)
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBeNull()

      const resDecimal = saveRestingHeartRate(60.5)
      expect(resDecimal).toBe(false)
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBeNull()
    })

    it('handles localStorage exceptions gracefully without throwing', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceededError')
      })
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = saveRestingHeartRate(70)
      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('Retrieval: loadRestingHeartRate', () => {
    it('returns null when no preference is stored in localStorage', () => {
      expect(loadRestingHeartRate()).toBeNull()
    })

    it('returns validated number when stored preference is valid', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '68')
      expect(loadRestingHeartRate()).toBe(68)
    })

    it('returns null when stored preference is corrupted or out of bounds', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, 'corrupted')
      expect(loadRestingHeartRate()).toBeNull()

      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '130')
      expect(loadRestingHeartRate()).toBeNull()

      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '25')
      expect(loadRestingHeartRate()).toBeNull()

      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '{"bpm": 60}')
      expect(loadRestingHeartRate()).toBeNull()
    })

    it('handles localStorage read exceptions gracefully without throwing', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('SecurityError')
      })
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(loadRestingHeartRate()).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('Deletion: clearRestingHeartRate', () => {
    it('removes only the resting heart rate key from localStorage', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '72')
      localStorage.setItem('bodymap_unrelated_key', 'keep_me')

      clearRestingHeartRate()

      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBeNull()
      expect(localStorage.getItem('bodymap_unrelated_key')).toBe('keep_me')
    })

    it('handles localStorage remove exceptions gracefully without throwing', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
        throw new Error('AccessDenied')
      })
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => clearRestingHeartRate()).not.toThrow()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('Round-Trip Invariants', () => {
    it('consistently round-trips all valid integer BPMs from 30 to 120', () => {
      for (let bpm = 30; bpm <= 120; bpm += 10) {
        expect(saveRestingHeartRate(bpm)).toBe(true)
        expect(loadRestingHeartRate()).toBe(bpm)
      }
    })

    it('remains idempotent across multiple save and clear cycles', () => {
      saveRestingHeartRate(55)
      expect(loadRestingHeartRate()).toBe(55)

      saveRestingHeartRate(55)
      expect(loadRestingHeartRate()).toBe(55)

      clearRestingHeartRate()
      expect(loadRestingHeartRate()).toBeNull()

      clearRestingHeartRate()
      expect(loadRestingHeartRate()).toBeNull()
    })
  })
})
