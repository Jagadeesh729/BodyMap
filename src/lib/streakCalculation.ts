/**
 * Formats a Date object into a standard YYYY-MM-DD local calendar date string.
 */
export function formatCalendarDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Shifts a calendar date by an integer number of days using native calendar arithmetic (immune to DST).
 */
export function shiftCalendarDays(baseDate: Date, dayOffset: number): Date {
  const result = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
  result.setDate(result.getDate() + dayOffset)
  return result
}

/**
 * Parses an ISO date/timestamp string into a standardized YYYY-MM-DD calendar string.
 */
export function parseToCalendarDateString(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }
  const parsed = new Date(trimmed)
  if (isNaN(parsed.getTime())) return null
  return formatCalendarDate(parsed)
}

export interface WorkoutHistoryEntry {
  completedAt?: string
  date?: string
}

/**
 * Calculates consecutive daily workout streaks using strict calendar-date arithmetic.
 *
 * Streak Semantics:
 * - A streak represents consecutive calendar days with at least 1 recorded workout.
 * - If the most recent workout was completed Today or Yesterday, the streak is active.
 * - If the most recent workout was before Yesterday, the streak is 0.
 * - Multiple workouts on the same calendar day count as 1 active day.
 * - Handled strictly with Date.prototype.setDate() to prevent DST 23h/25h calculation errors.
 */
export function calculateWorkoutStreak(
  history: WorkoutHistoryEntry[],
  completedDays: Array<{ date: string }>,
  referenceDate: Date = new Date()
): number {
  const allDates = new Set<string>()

  // 1. Gather all calendar dates from completed workout history
  if (Array.isArray(history)) {
    for (const h of history) {
      const parsed = parseToCalendarDateString(h.completedAt || h.date || '')
      if (parsed) allDates.add(parsed)
    }
  }

  // 2. Gather from legacy completedDays context state
  if (Array.isArray(completedDays)) {
    for (const c of completedDays) {
      const parsed = parseToCalendarDateString(c.date || '')
      if (parsed) allDates.add(parsed)
    }
  }

  if (allDates.size === 0) return 0

  const todayStr = formatCalendarDate(referenceDate)
  const yesterdayStr = formatCalendarDate(shiftCalendarDays(referenceDate, -1))

  // Find the most recent recorded workout date
  const sortedDates = Array.from(allDates).sort().reverse()
  const mostRecentDateStr = sortedDates[0]

  // If the latest workout is older than yesterday, the active streak has broken
  if (mostRecentDateStr !== todayStr && mostRecentDateStr !== yesterdayStr) {
    return 0
  }

  // Anchor to the start of streak (either today or yesterday)
  const anchorDate = mostRecentDateStr === todayStr ? referenceDate : shiftCalendarDays(referenceDate, -1)
  let streak = 0

  // Walk backward day by day using true calendar date math
  for (let offset = 0; offset < 3650; offset++) {
    const targetDateStr = formatCalendarDate(shiftCalendarDays(anchorDate, -offset))
    if (allDates.has(targetDateStr)) {
      streak++
    } else {
      break
    }
  }

  return streak
}
