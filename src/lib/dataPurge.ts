/**
 * BodyMap AI - Centralized Client Data Purge Utility
 *
 * Provides fail-safe, verifiable erasure of all BodyMap health profile,
 * plan state, exercise history, metrics, and session data stored in browser memory.
 */

export const KNOWN_BODYMAP_STORAGE_KEYS = [
  'bodymap_plan_v2',
  'bodymap_plan_state',
  'bodymap_saved_plans',
  'bodymap_body_metrics',
  'bodymap_body_metrics_unit',
  'bodymap_workout_history',
  'bodymap_active_session',
  'bodymap_exercise_notes',
  'bodymap_hydration_log',
  'bodymap_user_name',
  'bodymap_wizard_step',
  'bodymap_grocery_checked',
  'bodymap_tab_id',
] as const

export const BODYMAP_KEY_PREFIX = 'bodymap_'

export interface DataPurgeReport {
  success: boolean
  timestamp: string
  purgedLocalStorageKeys: string[]
  purgedSessionStorageKeys: string[]
  totalKeysPurged: number
  error?: string
}

/**
 * Returns all active storage keys that belong to BodyMap.
 */
export function getStoredUserDataKeys(): {
  localStorage: string[]
  sessionStorage: string[]
} {
  const localKeys: string[] = []
  const sessionKeys: string[] = []

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const len = window.localStorage.length
      for (let i = 0; i < len; i++) {
        const key = window.localStorage.key(i)
        if (key && (key.startsWith(BODYMAP_KEY_PREFIX) || (KNOWN_BODYMAP_STORAGE_KEYS as readonly string[]).includes(key))) {
          localKeys.push(key)
        }
      }
    } catch {
      // Storage access blocked or restricted
    }
  }

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const len = window.sessionStorage.length
      for (let i = 0; i < len; i++) {
        const key = window.sessionStorage.key(i)
        if (key && (key.startsWith(BODYMAP_KEY_PREFIX) || (KNOWN_BODYMAP_STORAGE_KEYS as readonly string[]).includes(key))) {
          sessionKeys.push(key)
        }
      }
    } catch {
      // Storage access blocked or restricted
    }
  }

  return {
    localStorage: Array.from(new Set(localKeys)),
    sessionStorage: Array.from(new Set(sessionKeys)),
  }
}

/**
 * Checks whether any BodyMap user data exists in local or session storage.
 */
export function hasStoredUserData(): boolean {
  const { localStorage, sessionStorage } = getStoredUserDataKeys()
  return localStorage.length > 0 || sessionStorage.length > 0
}

/**
 * Purges all BodyMap client-side stored data from localStorage and sessionStorage.
 *
 * Scans for all keys matching the `bodymap_` prefix as well as all explicitly
 * known schema keys, removes them, and returns an audit trail report.
 */
export function purgeAllUserData(): DataPurgeReport {
  const timestamp = new Date().toISOString()
  const purgedLocal: string[] = []
  const purgedSession: string[] = []

  let caughtError: string | undefined

  // 1. Purge from localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const keysToRemove = new Set<string>()
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key && (key.startsWith(BODYMAP_KEY_PREFIX) || (KNOWN_BODYMAP_STORAGE_KEYS as readonly string[]).includes(key))) {
          keysToRemove.add(key)
        }
      }
      for (const key of KNOWN_BODYMAP_STORAGE_KEYS) {
        if (window.localStorage.getItem(key) !== null) {
          keysToRemove.add(key)
        }
      }

      for (const key of keysToRemove) {
        window.localStorage.removeItem(key)
        purgedLocal.push(key)
      }
    } catch (err) {
      caughtError = err instanceof Error ? err.message : String(err)
    }
  }

  // 2. Purge from sessionStorage
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const keysToRemove = new Set<string>()
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i)
        if (key && (key.startsWith(BODYMAP_KEY_PREFIX) || (KNOWN_BODYMAP_STORAGE_KEYS as readonly string[]).includes(key))) {
          keysToRemove.add(key)
        }
      }
      for (const key of KNOWN_BODYMAP_STORAGE_KEYS) {
        if (window.sessionStorage.getItem(key) !== null) {
          keysToRemove.add(key)
        }
      }

      for (const key of keysToRemove) {
        window.sessionStorage.removeItem(key)
        purgedSession.push(key)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      caughtError = caughtError ? `${caughtError}; ${msg}` : msg
    }
  }

  return {
    success: !caughtError,
    timestamp,
    purgedLocalStorageKeys: purgedLocal,
    purgedSessionStorageKeys: purgedSession,
    totalKeysPurged: purgedLocal.length + purgedSession.length,
    ...(caughtError ? { error: caughtError } : {}),
  }
}
