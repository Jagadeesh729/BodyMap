import type { CompletedWorkoutLog } from '@/types/workoutSession'
import { sanitizeDownloadFilename } from '@/lib/downloadSecurity'

/**
 * UTF-8 Byte Order Mark (BOM).
 * Ensures Microsoft Excel and other spreadsheet applications decode UTF-8 characters (accents, emojis, Unicode)
 * correctly rather than interpreting them as legacy Windows-1252 / ANSI characters.
 */
export const UTF8_BOM = '\uFEFF'

/**
 * Canonical deterministic CSV column ordering for Workout History export.
 * Preserves the exact semantics of CompletedWorkoutLog without exposing internal IDs,
 * server secrets, or unrelated health profile data.
 */
export const WORKOUT_HISTORY_CSV_COLUMNS = [
  'Date',
  'Day Title',
  'Day Type',
  'Duration (Seconds)',
  'Exercise Name',
  'Sets Completed',
  'Total Sets',
  'Peak Weight (kg)',
  'Avg Reps',
  'Energy Rating',
  'Perceived Readiness',
  'Reflection Tags'
] as const

/**
 * Characters that could trigger spreadsheet formula execution in Excel/Google Sheets
 * when appearing as the first non-whitespace character in a text cell.
 * Triggers: = (formula), + (expression), - (expression), @ (function/lookup), \t (tab), \r (carriage return).
 */
const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/

/**
 * Neutralizes potentially unsafe spreadsheet formula prefixes by prepending a single quote (').
 * This forces spreadsheet software to treat the cell contents strictly as plain text.
 * Legitimate user text is preserved without silent data loss.
 *
 * Numbers are validated and emitted cleanly without quote prefixes.
 * Null/undefined values are converted to empty strings.
 */
export function sanitizeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }

  // Preserve valid finite numbers without accidental formula prefixing
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    return String(value)
  }

  let str = String(value)

  // Neutralize formula injection if the string starts with =, +, -, @, \t, or \r
  if (FORMULA_PREFIX_REGEX.test(str)) {
    str = `'${str}`
  }

  return str
}

/**
 * Escapes a cell value according to RFC 4180.
 * If the value contains double quotes, commas, newlines (\n), or carriage returns (\r),
 * internal double quotes are escaped by doubling them ("") and the entire field is enclosed in quotes.
 */
export function escapeCsvField(val: string): string {
  if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

/**
 * Deterministically converts a list of completed workout logs into a sanitized, RFC 4180 compliant CSV string.
 *
 * Rules:
 * - Deterministic sorting: chronological ascending by completedAt (with tie-breaker on session id).
 * - Deterministic column order matching WORKOUT_HISTORY_CSV_COLUMNS.
 * - Each row represents a logged exercise in a workout session.
 * - If a session has zero exercises, a single row is emitted with empty exercise fields.
 * - If history is empty, only the header row is emitted.
 * - Zero mutation of source records.
 * - Pure function without side effects or network calls.
 */
export function generateWorkoutHistoryCsv(
  history: CompletedWorkoutLog[] | null | undefined,
  includeBom: boolean = true
): string {
  const safeLogs = Array.isArray(history) ? history : []

  // Deterministic stable sort: chronological (oldest to newest), tie-breaker on id
  const sortedLogs = [...safeLogs].sort((a, b) => {
    const timeA = a?.completedAt ? new Date(a.completedAt).getTime() : 0
    const timeB = b?.completedAt ? new Date(b.completedAt).getTime() : 0
    if (timeA !== timeB) return timeA - timeB
    return String(a?.id || '').localeCompare(String(b?.id || ''))
  })

  const rows: string[] = []

  // Header row
  rows.push(WORKOUT_HISTORY_CSV_COLUMNS.map(escapeCsvField).join(','))

  for (const log of sortedLogs) {
    if (!log || typeof log !== 'object') continue

    const dateVal = log.completedAt || ''
    const dayTitleVal = log.dayTitle || ''
    const dayTypeVal = log.dayType || ''
    const durationVal = typeof log.durationSeconds === 'number' && Number.isFinite(log.durationSeconds) ? log.durationSeconds : ''
    const energyVal = typeof log.sessionReflection?.energyRating === 'number' && Number.isFinite(log.sessionReflection.energyRating)
      ? log.sessionReflection.energyRating
      : ''
    const readinessVal = log.sessionReflection?.perceivedReadiness || ''
    const tagsVal = Array.isArray(log.sessionReflection?.reflectionTags)
      ? log.sessionReflection.reflectionTags.join('; ')
      : ''

    const exercises = Array.isArray(log.exercisesSummary) ? log.exercisesSummary : []

    if (exercises.length === 0) {
      // Emit 1 row for session with empty exercise fields
      const row = [
        sanitizeCsvValue(dateVal),
        sanitizeCsvValue(dayTitleVal),
        sanitizeCsvValue(dayTypeVal),
        sanitizeCsvValue(durationVal),
        '', // Exercise Name
        '', // Sets Completed
        '', // Total Sets
        '', // Peak Weight (kg)
        '', // Avg Reps
        sanitizeCsvValue(energyVal),
        sanitizeCsvValue(readinessVal),
        sanitizeCsvValue(tagsVal)
      ].map(escapeCsvField).join(',')
      rows.push(row)
    } else {
      for (const ex of exercises) {
        if (!ex || typeof ex !== 'object') continue

        const exName = ex.name || ''
        const setsCompletedVal = typeof ex.setsCompleted === 'number' && Number.isFinite(ex.setsCompleted) ? ex.setsCompleted : ''
        const totalSetsVal = typeof ex.totalSets === 'number' && Number.isFinite(ex.totalSets) ? ex.totalSets : ''
        const peakWeightVal = typeof ex.peakWeightKg === 'number' && Number.isFinite(ex.peakWeightKg) ? ex.peakWeightKg : ''
        const avgRepsVal = typeof ex.avgCompletedReps === 'number' && Number.isFinite(ex.avgCompletedReps) ? ex.avgCompletedReps : ''

        const row = [
          sanitizeCsvValue(dateVal),
          sanitizeCsvValue(dayTitleVal),
          sanitizeCsvValue(dayTypeVal),
          sanitizeCsvValue(durationVal),
          sanitizeCsvValue(exName),
          sanitizeCsvValue(setsCompletedVal),
          sanitizeCsvValue(totalSetsVal),
          sanitizeCsvValue(peakWeightVal),
          sanitizeCsvValue(avgRepsVal),
          sanitizeCsvValue(energyVal),
          sanitizeCsvValue(readinessVal),
          sanitizeCsvValue(tagsVal)
        ].map(escapeCsvField).join(',')
        rows.push(row)
      }
    }
  }

  const csvContent = rows.join('\r\n')
  return includeBom ? `${UTF8_BOM}${csvContent}` : csvContent
}

/**
 * Creates a browser-ready Blob for CSV file download.
 */
export function createWorkoutHistoryCsvBlob(history: CompletedWorkoutLog[]): Blob {
  const csvContent = generateWorkoutHistoryCsv(history, true)
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
}

export type WorkoutHistoryCsvScope =
  | 'all'
  | 'filtered'
  | { type: 'day'; dayIndex: number }
  | { type: 'single'; title?: string; dayIndex?: number; id?: string; date?: string }
  | string

/**
 * Generates a sanitized, predictable filename for workout history export.
 * Supports unfiltered, filtered, day-filtered, and individual session scopes.
 *
 * Deterministic forms:
 * - Unfiltered: bodymap-workout-history-YYYY-MM-DD.csv
 * - Filtered: bodymap-workout-history-filtered-YYYY-MM-DD.csv
 * - Day-filtered: bodymap-workout-history-dayN-YYYY-MM-DD.csv
 * - Individual workout: bodymap-workout-history-dayN-title-YYYY-MM-DD.csv
 */
export function getWorkoutHistoryCsvFilename(
  date: Date = new Date(),
  scope?: WorkoutHistoryCsvScope
): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const dateStamp = `${yyyy}-${mm}-${dd}`

  if (!scope || scope === 'all') {
    return sanitizeDownloadFilename(`bodymap-workout-history-${dateStamp}`, 'bodymap-workout-history', 'csv')
  }

  if (scope === 'filtered') {
    return sanitizeDownloadFilename(`bodymap-workout-history-filtered-${dateStamp}`, 'bodymap-workout-history-filtered', 'csv')
  }

  if (typeof scope === 'object' && scope !== null) {
    if (scope.type === 'day') {
      const dayNum = (typeof scope.dayIndex === 'number' && Number.isFinite(scope.dayIndex) && scope.dayIndex >= 0)
        ? scope.dayIndex + 1
        : 1
      return sanitizeDownloadFilename(`bodymap-workout-history-day${dayNum}-${dateStamp}`, `bodymap-workout-history-day${dayNum}`, 'csv')
    }

    if (scope.type === 'single') {
      const dayPart = (typeof scope.dayIndex === 'number' && Number.isFinite(scope.dayIndex) && scope.dayIndex >= 0)
        ? `day${scope.dayIndex + 1}-`
        : ''
      const titlePart = scope.title ? `${scope.title.toLowerCase()}-` : ''
      return sanitizeDownloadFilename(`bodymap-workout-history-${dayPart}${titlePart}${dateStamp}`, 'bodymap-workout-history-single', 'csv')
    }
  }

  if (typeof scope === 'string') {
    const normalized = scope.trim().toLowerCase()
    if (normalized === 'filtered') {
      return sanitizeDownloadFilename(`bodymap-workout-history-filtered-${dateStamp}`, 'bodymap-workout-history-filtered', 'csv')
    }
    const dayMatch = normalized.match(/^day-?(\d+)$/)
    if (dayMatch) {
      const dayNum = parseInt(dayMatch[1], 10)
      return sanitizeDownloadFilename(`bodymap-workout-history-day${dayNum}-${dateStamp}`, `bodymap-workout-history-day${dayNum}`, 'csv')
    }
    return sanitizeDownloadFilename(`bodymap-workout-history-${normalized}-${dateStamp}`, 'bodymap-workout-history', 'csv')
  }

  return sanitizeDownloadFilename(`bodymap-workout-history-${dateStamp}`, 'bodymap-workout-history', 'csv')
}

/**
 * RFC 4180 compliant CSV parser utility.
 * Used for testing and proving round-trip fidelity: parse(export(history)).
 */
export function parseCsvRows(csvString: string): string[][] {
  // Strip optional UTF-8 BOM if present
  const cleanStr = csvString.startsWith(UTF8_BOM) ? csvString.slice(UTF8_BOM.length) : csvString

  const result: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < cleanStr.length) {
    const char = cleanStr[i]

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < cleanStr.length && cleanStr[i + 1] === '"') {
          // Escaped quote ("") -> literal quote
          currentField += '"'
          i += 2
          continue
        } else {
          // End of quoted field
          inQuotes = false
          i++
          continue
        }
      } else {
        currentField += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
        continue
      } else if (char === ',') {
        currentRow.push(currentField)
        currentField = ''
        i++
        continue
      } else if (char === '\r') {
        if (i + 1 < cleanStr.length && cleanStr[i + 1] === '\n') {
          i++ // skip \r of \r\n
        }
        currentRow.push(currentField)
        currentField = ''
        result.push(currentRow)
        currentRow = []
        i++
        continue
      } else if (char === '\n') {
        currentRow.push(currentField)
        currentField = ''
        result.push(currentRow)
        currentRow = []
        i++
        continue
      } else {
        currentField += char
        i++
        continue
      }
    }
  }

  // Final field/row if any characters remain
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField)
    result.push(currentRow)
  }

  return result
}
