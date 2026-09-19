/**
 * User Resting Heart Rate (RHR) Preference Storage Engine (E26-B)
 *
 * Implements:
 * 1. Dedicated browser-local persistence for user resting heart rate preference.
 * 2. Fail-safe, deterministic integer validation strictly within canonical E23 bounds (30–120 BPM).
 * 3. Safe fallback to default (60 BPM) upon missing or corrupted storage data.
 * 4. Zero external transmission, zero telemetry, zero schema migrations.
 */

import { MIN_RESTING_HR_BPM, MAX_RESTING_HR_BPM } from '@/lib/targetHeartRateZones'

export const RESTING_HEART_RATE_STORAGE_KEY = 'bodymap_resting_heart_rate'
export const DEFAULT_RESTING_HEART_RATE_BPM = 60

/** Canonical aliases for contract parity */
export const DEFAULT_RHR = DEFAULT_RESTING_HEART_RATE_BPM
export const STORAGE_KEY = RESTING_HEART_RATE_STORAGE_KEY

/**
 * Validates whether a raw input is a strict whole integer within [30, 120] BPM.
 *
 * Rejection criteria:
 * - null or undefined
 * - non-numeric strings (e.g. 'abc', '60bpm', 'NaN', 'Infinity')
 * - floats / decimals (e.g. 59.5, 60.2, '60.0')
 * - NaN, Infinity, -Infinity
 * - negative numbers or zero
 * - numbers strictly below 30 or strictly above 120 BPM
 * - empty string or whitespace
 */
export function validateRestingHeartRate(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null
  }

  let parsed: number

  if (typeof value === 'number') {
    parsed = value
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return null
    }
    // Strict integer regex: only optional leading '+' and digits, no decimals, no scientific notation, no units
    if (!/^\+?\d+$/.test(trimmed)) {
      return null
    }
    parsed = Number(trimmed)
  } else {
    return null
  }

  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return null
  }

  if (!Number.isInteger(parsed)) {
    return null
  }

  if (parsed < MIN_RESTING_HR_BPM || parsed > MAX_RESTING_HR_BPM) {
    return null
  }

  return parsed
}

/**
 * Loads the resting heart rate preference safely from localStorage.
 * Returns the validated integer BPM, or null if absent or corrupted.
 */
export function loadRestingHeartRate(): number | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  try {
    const raw = localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)
    if (raw === null || raw === undefined) {
      return null
    }

    return validateRestingHeartRate(raw)
  } catch (err) {
    console.error('Error loading resting heart rate preference:', err)
    return null
  }
}

/**
 * Persists a validated resting heart rate preference to localStorage.
 * Validates strictly before writing; invalid inputs return false and are NOT saved.
 */
export function saveRestingHeartRate(value: number | string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false
  }

  const validated = validateRestingHeartRate(value)
  if (validated === null) {
    return false
  }

  try {
    localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, String(validated))
    return true
  } catch (err) {
    console.error('Error persisting resting heart rate preference:', err)
    return false
  }
}

/**
 * Removes the resting heart rate preference from localStorage.
 */
export function clearRestingHeartRate(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return
  }

  try {
    localStorage.removeItem(RESTING_HEART_RATE_STORAGE_KEY)
  } catch (err) {
    console.error('Error clearing resting heart rate preference:', err)
  }
}
