const HYDRATION_STORAGE_KEY = 'bodymap_hydration_log'

export type HydrationLogMap = Record<string, number>

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
 */
export function loadHydrationLog(): HydrationLogMap {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {}
  }
  try {
    const raw = localStorage.getItem(HYDRATION_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as HydrationLogMap
  } catch {
    return {}
  }
}

/**
 * Retrieves milliliters logged for today (or specified YYYY-MM-DD).
 */
export function getTodayHydration(dateStr?: string): number {
  const targetDate = dateStr || new Date().toISOString().split('T')[0]
  const log = loadHydrationLog()
  const val = log[targetDate]
  return typeof val === 'number' && val >= 0 ? val : 0
}

/**
 * Adds an amount of fluid (ml) to today's log.
 */
export function addHydration(amountMl: number, dateStr?: string): number {
  const targetDate = dateStr || new Date().toISOString().split('T')[0]
  const log = loadHydrationLog()
  const current = typeof log[targetDate] === 'number' ? log[targetDate] : 0
  const updated = Math.max(0, Math.min(10000, current + amountMl)) // 10L upper safety cap

  log[targetDate] = updated

  try {
    localStorage.setItem(HYDRATION_STORAGE_KEY, JSON.stringify(log))
  } catch {
    // Ignore storage failure
  }

  return updated
}

/**
 * Resets today's fluid log to 0 ml.
 */
export function resetTodayHydration(dateStr?: string): void {
  const targetDate = dateStr || new Date().toISOString().split('T')[0]
  const log = loadHydrationLog()
  delete log[targetDate]

  try {
    localStorage.setItem(HYDRATION_STORAGE_KEY, JSON.stringify(log))
  } catch {
    // Ignore storage failure
  }
}
