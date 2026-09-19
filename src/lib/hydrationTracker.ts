import { isStorageQuotaError, notifyStorageQuotaExceeded } from '@/lib/storageQuotaHandler'

export const HYDRATION_STORAGE_KEY = 'bodymap_hydration_log'
export const STORAGE_KEY = HYDRATION_STORAGE_KEY

export type HydrationLogMap = Record<string, number>

/**
 * Validates whether a date string strictly matches YYYY-MM-DD format
 * and corresponds to a real Gregorian calendar date.
 */
export function isValidDateStr(dateStr: string): boolean {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false
  }
  const [y, m, d] = dateStr.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return false
  }
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}

/**
 * Returns today's canonical calendar date string in YYYY-MM-DD format using the user's local timezone.
 * Accepts an optional Date instance (defaults to current time) for deterministic testing.
 */
export function getTodayDateString(d: Date = new Date()): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calculates estimated daily fluid target in ml based on body weight (35 ml/kg baseline).
 * Non-medical heuristic starting point.
 */
export function calculateHydrationTarget(weightKg: number | string | null | undefined): number | null {
  const weight = typeof weightKg === 'number' ? weightKg : (typeof weightKg === 'string' ? parseFloat(weightKg) : NaN)
  if (isNaN(weight) || weight < 30 || weight > 300) {
    return null
  }
  return Math.round((weight * 35) / 50) * 50 // Round to nearest 50 ml
}

/**
 * Loads the local hydration log safely from localStorage.
 * Defensive against corruption, non-objects, arrays, prototype pollution, and malformed dates.
 */
export function loadHydrationLog(): HydrationLogMap {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {}
  }
  try {
    const raw = localStorage.getItem(HYDRATION_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

    const sanitized: HydrationLogMap = {}
    for (const [key, val] of Object.entries(parsed)) {
      if (
        key !== '__proto__' &&
        key !== 'constructor' &&
        key !== 'prototype' &&
        isValidDateStr(key) &&
        typeof val === 'number' &&
        Number.isFinite(val) &&
        val >= 0
      ) {
        sanitized[key] = Math.min(10000, Math.round(val))
      }
    }
    return sanitized
  } catch {
    return {}
  }
}

/**
 * Retrieves milliliters logged for today (or specified YYYY-MM-DD).
 * Returns 0 if no entry exists or date format is invalid.
 */
export function getTodayHydration(dateStr?: string): number {
  const targetDate = dateStr ?? getTodayDateString()
  if (!isValidDateStr(targetDate)) {
    return 0
  }
  const log = loadHydrationLog()
  const val = log[targetDate]
  return typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : 0
}

/**
 * Adds an amount of fluid (ml) to today's log.
 * Rejects non-numbers, negative values, NaN, Infinity, and impossible dates.
 * Upper safety bound capped at 10,000 mL (10 Liters).
 */
export function addHydration(amountMl: number, dateStr?: string): number {
  const targetDate = dateStr ?? getTodayDateString()
  if (!isValidDateStr(targetDate)) {
    return getTodayHydration()
  }
  if (typeof amountMl !== 'number' || isNaN(amountMl) || !Number.isFinite(amountMl) || amountMl <= 0) {
    return getTodayHydration(targetDate)
  }

  const log = loadHydrationLog()
  const current = typeof log[targetDate] === 'number' && Number.isFinite(log[targetDate]) && log[targetDate] >= 0
    ? log[targetDate]
    : 0
  const updated = Math.max(0, Math.min(10000, Math.round(current + amountMl)))

  log[targetDate] = updated

  try {
    localStorage.setItem(HYDRATION_STORAGE_KEY, JSON.stringify(log))
  } catch (err) {
    if (isStorageQuotaError(err)) {
      notifyStorageQuotaExceeded('unknown')
    }
  }

  return updated
}

/**
 * Resets today's fluid log to 0 ml.
 */
export function resetTodayHydration(dateStr?: string): void {
  const targetDate = dateStr ?? getTodayDateString()
  if (!isValidDateStr(targetDate)) {
    return
  }
  const log = loadHydrationLog()
  delete log[targetDate]

  try {
    localStorage.setItem(HYDRATION_STORAGE_KEY, JSON.stringify(log))
  } catch (err) {
    if (isStorageQuotaError(err)) {
      notifyStorageQuotaExceeded('unknown')
    }
  }
}
