import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  GYM_FEEDBACK_STORAGE_KEY,
  STORAGE_KEY,
  DEFAULT_GYM_FEEDBACK_PREFERENCES,
  DEFAULT_PREFERENCES,
  validateGymFeedbackPreferences,
  loadGymFeedbackPreferences,
  saveGymFeedbackPreferences,
  clearGymFeedbackPreferences,
  type GymFeedbackPreferences
} from '@/lib/gymFeedbackStorage'
import * as storageQuotaHandler from '@/lib/storageQuotaHandler'

describe('Gym Mode Ambient Feedback Preferences Storage (E27-A)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Constants & Export Parity', () => {
    it('exports canonical constants and aliases matching contract', () => {
      expect(GYM_FEEDBACK_STORAGE_KEY).toBe('bodymap_gym_ambient_feedback')
      expect(STORAGE_KEY).toBe(GYM_FEEDBACK_STORAGE_KEY)
      expect(DEFAULT_GYM_FEEDBACK_PREFERENCES).toEqual({ soundEnabled: true, vibrateEnabled: true })
      expect(DEFAULT_PREFERENCES).toEqual(DEFAULT_GYM_FEEDBACK_PREFERENCES)
      expect(Object.isFrozen(DEFAULT_GYM_FEEDBACK_PREFERENCES)).toBe(true)
    })
  })

  describe('validateGymFeedbackPreferences', () => {
    it('accepts valid boolean preference objects', () => {
      expect(validateGymFeedbackPreferences({ soundEnabled: true, vibrateEnabled: true })).toEqual({
        soundEnabled: true,
        vibrateEnabled: true
      })
      expect(validateGymFeedbackPreferences({ soundEnabled: false, vibrateEnabled: true })).toEqual({
        soundEnabled: false,
        vibrateEnabled: true
      })
      expect(validateGymFeedbackPreferences({ soundEnabled: true, vibrateEnabled: false })).toEqual({
        soundEnabled: true,
        vibrateEnabled: false
      })
      expect(validateGymFeedbackPreferences({ soundEnabled: false, vibrateEnabled: false })).toEqual({
        soundEnabled: false,
        vibrateEnabled: false
      })
    })

    it('strips unknown or extra keys from candidate object', () => {
      const input = {
        soundEnabled: false,
        vibrateEnabled: true,
        medicalIssues: 'Heart condition',
        workoutName: 'Chest Day',
        token: 'secret-auth-token'
      }
      const validated = validateGymFeedbackPreferences(input)
      expect(validated).toEqual({ soundEnabled: false, vibrateEnabled: true })
      const candidate = validated as unknown as Record<string, unknown>
      expect(candidate.medicalIssues).toBeUndefined()
      expect(candidate.workoutName).toBeUndefined()
      expect(candidate.token).toBeUndefined()
    })

    it('rejects null and undefined', () => {
      expect(validateGymFeedbackPreferences(null)).toBeNull()
      expect(validateGymFeedbackPreferences(undefined)).toBeNull()
    })

    it('rejects non-object primitives and arrays', () => {
      expect(validateGymFeedbackPreferences(123)).toBeNull()
      expect(validateGymFeedbackPreferences('true')).toBeNull()
      expect(validateGymFeedbackPreferences(true)).toBeNull()
      expect(validateGymFeedbackPreferences([true, false])).toBeNull()
      expect(validateGymFeedbackPreferences([])).toBeNull()
    })

    it('rejects string booleans ("true", "false")', () => {
      expect(validateGymFeedbackPreferences({ soundEnabled: 'true', vibrateEnabled: true })).toBeNull()
      expect(validateGymFeedbackPreferences({ soundEnabled: true, vibrateEnabled: 'false' })).toBeNull()
      expect(validateGymFeedbackPreferences({ soundEnabled: 'true', vibrateEnabled: 'true' })).toBeNull()
    })

    it('rejects numbers (0, 1)', () => {
      expect(validateGymFeedbackPreferences({ soundEnabled: 1, vibrateEnabled: true })).toBeNull()
      expect(validateGymFeedbackPreferences({ soundEnabled: true, vibrateEnabled: 0 })).toBeNull()
    })

    it('rejects missing fields', () => {
      expect(validateGymFeedbackPreferences({ soundEnabled: true })).toBeNull()
      expect(validateGymFeedbackPreferences({ vibrateEnabled: false })).toBeNull()
      expect(validateGymFeedbackPreferences({})).toBeNull()
    })
  })

  describe('loadGymFeedbackPreferences', () => {
    it('returns frozen defaults when storage is empty', () => {
      const prefs = loadGymFeedbackPreferences()
      expect(prefs).toEqual({ soundEnabled: true, vibrateEnabled: true })
    })

    it('loads valid persisted preferences correctly', () => {
      localStorage.setItem(
        GYM_FEEDBACK_STORAGE_KEY,
        JSON.stringify({ soundEnabled: false, vibrateEnabled: false })
      )
      const prefs = loadGymFeedbackPreferences()
      expect(prefs).toEqual({ soundEnabled: false, vibrateEnabled: false })
    })

    it('recovers safely to defaults when storage contains corrupted JSON', () => {
      localStorage.setItem(GYM_FEEDBACK_STORAGE_KEY, '{{corrupted_json')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const prefs = loadGymFeedbackPreferences()
      expect(prefs).toEqual({ soundEnabled: true, vibrateEnabled: true })
      expect(warnSpy).toHaveBeenCalled()
    })

    it('recovers safely to defaults when storage contains invalid payload types', () => {
      localStorage.setItem(GYM_FEEDBACK_STORAGE_KEY, JSON.stringify([true, false]))
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const prefs = loadGymFeedbackPreferences()
      expect(prefs).toEqual({ soundEnabled: true, vibrateEnabled: true })
      expect(warnSpy).toHaveBeenCalled()
    })

    it('recovers safely to defaults on storage read exception', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('AccessDenied')
      })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const prefs = loadGymFeedbackPreferences()
      expect(prefs).toEqual({ soundEnabled: true, vibrateEnabled: true })
      expect(warnSpy).toHaveBeenCalled()
    })
  })

  describe('saveGymFeedbackPreferences', () => {
    it('persists full preferences', () => {
      const success = saveGymFeedbackPreferences({ soundEnabled: false, vibrateEnabled: false })
      expect(success).toBe(true)
      const raw = localStorage.getItem(GYM_FEEDBACK_STORAGE_KEY)
      expect(JSON.parse(raw!)).toEqual({ soundEnabled: false, vibrateEnabled: false })
    })

    it('partially updates soundEnabled while preserving vibrateEnabled', () => {
      // First, set both to false
      saveGymFeedbackPreferences({ soundEnabled: false, vibrateEnabled: false })
      expect(loadGymFeedbackPreferences()).toEqual({ soundEnabled: false, vibrateEnabled: false })

      // Partially toggle sound back to true
      const success = saveGymFeedbackPreferences({ soundEnabled: true })
      expect(success).toBe(true)
      expect(loadGymFeedbackPreferences()).toEqual({ soundEnabled: true, vibrateEnabled: false })
    })

    it('partially updates vibrateEnabled while preserving soundEnabled', () => {
      // Start from defaults (both true)
      const success = saveGymFeedbackPreferences({ vibrateEnabled: false })
      expect(success).toBe(true)
      expect(loadGymFeedbackPreferences()).toEqual({ soundEnabled: true, vibrateEnabled: false })
    })

    it('rejects invalid inputs without modifying storage', () => {
      saveGymFeedbackPreferences({ soundEnabled: false, vibrateEnabled: true })
      const original = localStorage.getItem(GYM_FEEDBACK_STORAGE_KEY)

      expect(saveGymFeedbackPreferences(null as unknown as Partial<GymFeedbackPreferences>)).toBe(false)
      expect(saveGymFeedbackPreferences(undefined as unknown as Partial<GymFeedbackPreferences>)).toBe(false)
      expect(saveGymFeedbackPreferences('invalid' as unknown as Partial<GymFeedbackPreferences>)).toBe(false)
      expect(saveGymFeedbackPreferences([] as unknown as Partial<GymFeedbackPreferences>)).toBe(false)
      expect(saveGymFeedbackPreferences({} as unknown as Partial<GymFeedbackPreferences>)).toBe(false)
      expect(saveGymFeedbackPreferences({ soundEnabled: 'false' as unknown as boolean })).toBe(false)
      expect(saveGymFeedbackPreferences({ vibrateEnabled: 123 as unknown as boolean })).toBe(false)

      expect(localStorage.getItem(GYM_FEEDBACK_STORAGE_KEY)).toBe(original)
    })

    it('notifies quota handler when QuotaExceededError is encountered', () => {
      const quotaSpy = vi.spyOn(storageQuotaHandler, 'notifyStorageQuotaExceeded').mockImplementation(() => {})
      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        const err = new DOMException('Quota exceeded', 'QuotaExceededError')
        throw err
      })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const success = saveGymFeedbackPreferences({ soundEnabled: false })
      expect(success).toBe(false)
      expect(quotaSpy).toHaveBeenCalledWith('session')
      expect(warnSpy).toHaveBeenCalled()
    })
  })

  describe('clearGymFeedbackPreferences', () => {
    it('removes stored preferences from localStorage', () => {
      saveGymFeedbackPreferences({ soundEnabled: false, vibrateEnabled: false })
      expect(localStorage.getItem(GYM_FEEDBACK_STORAGE_KEY)).not.toBeNull()

      clearGymFeedbackPreferences()
      expect(localStorage.getItem(GYM_FEEDBACK_STORAGE_KEY)).toBeNull()
      expect(loadGymFeedbackPreferences()).toEqual({ soundEnabled: true, vibrateEnabled: true })
    })

    it('handles localStorage errors gracefully during clear', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
        throw new Error('StorageLocked')
      })
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(() => clearGymFeedbackPreferences()).not.toThrow()
      expect(warnSpy).toHaveBeenCalled()
    })
  })
})
