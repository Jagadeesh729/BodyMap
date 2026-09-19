import type { ExercisePRTrajectory } from '@/lib/prProgressionTrajectory'
import { sanitizeDownloadFilename } from '@/lib/downloadSecurity'

/**
 * UTF-8 Byte Order Mark (BOM).
 * Guarantees proper UTF-8 decoding for spreadsheet software (e.g. Microsoft Excel).
 */
export const UTF8_BOM = '\uFEFF'

/**
 * Canonical deterministic CSV column ordering for Personal Record Trajectory export.
 * Follows strict privacy allowlist: only exercise performance data, zero personal/health metadata.
 */
export const PR_TRAJECTORY_CSV_COLUMNS = [
  'Exercise Name',
  'Date',
  'Peak Weight (kg)',
  'Reps',
  'Estimated 1RM (kg)',
  'Session',
  'PR Breakthrough'
] as const

/**
 * Characters that trigger spreadsheet formula execution in Excel/Google Sheets
 * when appearing as the initial non-whitespace character in a text field.
 */
const FORMULA_PREFIX_REGEX = /^[=+\-@\t\r]/

/**
 * Neutralizes potential spreadsheet formula prefixes by prepending a single quote (').
 * Finite numeric values are preserved as clean numeric strings without quotes.
 */
export function sanitizeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    return String(value)
  }

  let str = String(value)
  if (FORMULA_PREFIX_REGEX.test(str)) {
    str = `'${str}`
  }
  return str
}

/**
 * Escapes a cell value according to RFC 4180.
 * If the value contains double quotes, commas, newlines (\n), or carriage returns (\r),
 * internal double quotes are escaped by doubling them ("") and the entire field is quoted.
 */
export function escapeCsvField(val: string): string {
  if (val.includes('"') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

/**
 * Deterministically generates an RFC 4180 compliant CSV string for a Personal Record trajectory.
 * 
 * Rules:
 * - Deterministic column headers matching PR_TRAJECTORY_CSV_COLUMNS.
 * - Deterministic row order matching the trajectory's chronological order.
 * - Strict field allowlist: exerciseName, date, weightKg, reps, estimated1rmKg, sessionTitle, isPRBreakthrough.
 * - Safe formula prefix neutralization and RFC 4180 quoting.
 * - Pure function: zero side-effects, zero mutations.
 */
export function generatePRTrajectoryCsv(
  trajectory: ExercisePRTrajectory | null | undefined,
  includeBom: boolean = true
): string {
  const rows: string[] = []

  // Header row
  rows.push(PR_TRAJECTORY_CSV_COLUMNS.map(escapeCsvField).join(','))

  if (trajectory && Array.isArray(trajectory.points) && trajectory.points.length > 0) {
    const exerciseName = trajectory.exerciseName || 'Unknown Exercise'

    for (const pt of trajectory.points) {
      if (!pt || typeof pt !== 'object') continue

      const dateVal = typeof pt.date === 'string' ? pt.date : ''
      const weightVal = typeof pt.weightKg === 'number' && Number.isFinite(pt.weightKg) ? pt.weightKg : ''
      const repsVal = typeof pt.reps === 'number' && Number.isFinite(pt.reps) ? pt.reps : ''
      const est1rmVal = typeof pt.estimated1rmKg === 'number' && Number.isFinite(pt.estimated1rmKg) ? pt.estimated1rmKg : ''
      const sessionVal = typeof pt.sessionTitle === 'string' ? pt.sessionTitle : 'Gym Session'
      const prVal = pt.isPRBreakthrough ? 'Yes' : 'No'

      const row = [
        sanitizeCsvValue(exerciseName),
        sanitizeCsvValue(dateVal),
        sanitizeCsvValue(weightVal),
        sanitizeCsvValue(repsVal),
        sanitizeCsvValue(est1rmVal),
        sanitizeCsvValue(sessionVal),
        sanitizeCsvValue(prVal)
      ].map(escapeCsvField).join(',')

      rows.push(row)
    }
  }

  const csvContent = rows.join('\r\n')
  return includeBom ? `${UTF8_BOM}${csvContent}` : csvContent
}

/**
 * Creates a browser-ready Blob for PR Trajectory CSV download.
 */
export function createPRTrajectoryCsvBlob(trajectory: ExercisePRTrajectory): Blob {
  const csvContent = generatePRTrajectoryCsv(trajectory, true)
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
}

/**
 * Deterministically generates a clean, formatted plain text summary of the PR trajectory
 * for the Web Share API or clipboard copy fallback.
 */
export function generatePRTrajectoryShareText(
  trajectory: ExercisePRTrajectory | null | undefined
): string {
  if (!trajectory || !Array.isArray(trajectory.points) || trajectory.points.length === 0) {
    return 'No personal record trajectory data available.'
  }

  const est1rmText = trajectory.allTimePeak1rmKg !== null && Number.isFinite(trajectory.allTimePeak1rmKg)
    ? `~${trajectory.allTimePeak1rmKg} kg`
    : '—'

  const progressSign = trajectory.netWeightGainKg > 0 ? '+' : ''
  const progressText = `${progressSign}${trajectory.netWeightGainKg} kg`

  const historyLines = trajectory.points.map((pt) => {
    const dateLabel = pt.displayDate || (typeof pt.date === 'string' ? pt.date.slice(0, 10) : 'Session')
    const repsText = typeof pt.reps === 'number' && Number.isFinite(pt.reps) ? ` × ${pt.reps} reps` : ''
    const estText = typeof pt.estimated1rmKg === 'number' && Number.isFinite(pt.estimated1rmKg)
      ? ` (Est. 1RM: ~${pt.estimated1rmKg} kg)`
      : ''
    const prTag = pt.isPRBreakthrough ? ' [PR Breakthrough]' : ''
    return `• ${dateLabel}: ${pt.weightKg} kg${repsText}${estText}${prTag}`
  })

  return [
    'BodyMap AI — Personal Record Trajectory',
    `Exercise: ${trajectory.exerciseName}`,
    `All-Time Peak: ${trajectory.allTimePeakWeightKg} kg`,
    `Est. Peak 1RM: ${est1rmText}`,
    `Net Progress: ${progressText}`,
    `Sessions Logged: ${trajectory.totalDataPoints}`,
    '',
    'Progression History:',
    ...historyLines
  ].join('\n')
}

/**
 * Generates a sanitized, filesystem-safe filename for PR trajectory CSV export.
 * Form: bodymap-pr-trajectory-<exercise>-<YYYY-MM-DD>.csv
 */
export function getPRTrajectoryCsvFilename(
  exerciseName: string | null | undefined,
  date: Date = new Date()
): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const dateStamp = `${yyyy}-${mm}-${dd}`

  const cleanExercise = (exerciseName || 'exercise')
    .toLowerCase()
    .replace(/[\s+;,$!@#%^&*()|<>`~:]+/g, '-')

  const rawBase = `bodymap-pr-trajectory-${cleanExercise}-${dateStamp}`
  return sanitizeDownloadFilename(rawBase, 'bodymap-pr-trajectory', 'csv')
}
