/**
 * Gym Mode Ambient Feedback Preferences Storage Engine (E27-A)
 *
 * Implements:
 * 1. Dedicated browser-local persistence for Gym Mode ambient feedback preferences (audio chime & haptic vibration).
 * 2. Fail-safe, deterministic boolean validation strictly rejecting non-boolean or corrupted values.
 * 3. Safe fallback to defaults ({ soundEnabled: true, vibrateEnabled: true }) upon missing or corrupted storage data.
 * 4. Partial update support to update one preference without altering the other.
 * 5. Storage quota exceeded exception handling without data loss.
 * 6. Zero external transmission, zero telemetry, zero schema migrations.
 */

import { isStorageQuotaError, notifyStorageQuotaExceeded } from '@/lib/storageQuotaHandler'

export interface GymFeedbackPreferences {
  soundEnabled: boolean
  vibrateEnabled: boolean
}

export const GYM_FEEDBACK_STORAGE_KEY = 'bodymap_gym_ambient_feedback'

/** Canonical aliases for contract parity */
export const STORAGE_KEY = GYM_FEEDBACK_STORAGE_KEY

export const DEFAULT_GYM_FEEDBACK_PREFERENCES: Readonly<GymFeedbackPreferences> = Object.freeze({
  soundEnabled: true,
  vibrateEnabled: true
})

export const DEFAULT_PREFERENCES = DEFAULT_GYM_FEEDBACK_PREFERENCES

/**
 * Validates whether a raw input is a valid GymFeedbackPreferences object.
 *
 * Rejection criteria:
 * - null or undefined
 * - non-objects or arrays
 * - non-boolean soundEnabled
 * - non-boolean vibrateEnabled
 *
 * Discards unexpected extra properties by returning a clean, strict object.
 */
export function validateGymFeedbackPreferences(value: unknown): GymFeedbackPreferences | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>

  if (typeof candidate.soundEnabled !== 'boolean') {
    return null
  }

  if (typeof candidate.vibrateEnabled !== 'boolean') {
    return null
  }

  return {
    soundEnabled: candidate.soundEnabled,
    vibrateEnabled: candidate.vibrateEnabled
  }
}

/**
 * Loads the Gym Mode ambient feedback preferences safely from localStorage.
 * Returns the validated GymFeedbackPreferences, or default values if absent or corrupted.
 */
export function loadGymFeedbackPreferences(): GymFeedbackPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_GYM_FEEDBACK_PREFERENCES }
  }

  try {
    const raw = localStorage.getItem(GYM_FEEDBACK_STORAGE_KEY)
    if (!raw) {
      return { ...DEFAULT_GYM_FEEDBACK_PREFERENCES }
    }

    const parsed = JSON.parse(raw)
    const validated = validateGymFeedbackPreferences(parsed)
    if (!validated) {
      console.warn('[GymFeedbackStorage] Corrupted feedback preferences recovered to defaults')
      return { ...DEFAULT_GYM_FEEDBACK_PREFERENCES }
    }

    return validated
  } catch (err) {
    console.warn('[GymFeedbackStorage] Failed to read feedback preferences, falling back to defaults:', err)
    return { ...DEFAULT_GYM_FEEDBACK_PREFERENCES }
  }
}

/**
 * Persists validated Gym Mode ambient feedback preferences to localStorage.
 * Accepts partial updates, merging with existing persisted preferences or defaults.
 *
 * Rejects invalid types before writing and returns false.
 */
export function saveGymFeedbackPreferences(prefs: Partial<GymFeedbackPreferences>): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false
  }

  if (prefs === null || prefs === undefined || typeof prefs !== 'object' || Array.isArray(prefs)) {
    return false
  }

  if (prefs.soundEnabled !== undefined && typeof prefs.soundEnabled !== 'boolean') {
    return false
  }

  if (prefs.vibrateEnabled !== undefined && typeof prefs.vibrateEnabled !== 'boolean') {
    return false
  }

  if (prefs.soundEnabled === undefined && prefs.vibrateEnabled === undefined) {
    return false
  }

  try {
    const current = loadGymFeedbackPreferences()
    const next: GymFeedbackPreferences = {
      soundEnabled: prefs.soundEnabled !== undefined ? prefs.soundEnabled : current.soundEnabled,
      vibrateEnabled: prefs.vibrateEnabled !== undefined ? prefs.vibrateEnabled : current.vibrateEnabled
    }

    const validated = validateGymFeedbackPreferences(next)
    if (!validated) {
      return false
    }

    localStorage.setItem(GYM_FEEDBACK_STORAGE_KEY, JSON.stringify(validated))
    return true
  } catch (err) {
    if (isStorageQuotaError(err)) {
      notifyStorageQuotaExceeded('session')
    }
    console.warn('[GymFeedbackStorage] Failed to save feedback preferences:', err)
    return false
  }
}

/**
 * Removes the Gym Mode ambient feedback preferences from localStorage.
 */
export function clearGymFeedbackPreferences(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    localStorage.removeItem(GYM_FEEDBACK_STORAGE_KEY)
  } catch (err) {
    console.warn('[GymFeedbackStorage] Failed to clear feedback preferences:', err)
  }
}
