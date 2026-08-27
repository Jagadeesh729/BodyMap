export interface BackupValidationResult {
  isValid: boolean
  version: string
  workoutCount: number
  savedPlansCount: number
  weightLogsCount: number
  errors: string[]
  warnings: string[]
  summaryText: string
}

/**
 * Deterministically validates BodyMap backup JSON payload integrity without modifying state.
 * Supports both canonical V2 schema (`schema: 'bodymap_backup_v2'`, `planState`, `workoutHistory`)
 * and legacy V1 payloads (`version: 'bodymap_backup_v1'`, `state`, `history`).
 */
export function validateBackupPayload(payload: unknown): BackupValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!payload || typeof payload !== 'object') {
    return {
      isValid: false,
      version: 'unknown',
      workoutCount: 0,
      savedPlansCount: 0,
      weightLogsCount: 0,
      errors: ['Backup payload is empty or not a valid JSON object.'],
      warnings: [],
      summaryText: 'Invalid backup file structure.'
    }
  }

  const raw = payload as Record<string, unknown>
  const schemaOrVersion = (typeof raw.schema === 'string' ? raw.schema : (typeof raw.version === 'string' ? raw.version : 'unknown'))

  if (schemaOrVersion !== 'bodymap_backup_v2' && schemaOrVersion !== 'bodymap_backup_v1') {
    errors.push(`Unsupported backup schema version: "${schemaOrVersion}". Expected "bodymap_backup_v2".`)
  }

  if (typeof raw.exportedAt !== 'string' || isNaN(new Date(raw.exportedAt).getTime())) {
    warnings.push('Export timestamp missing or invalid format.')
  }

  // Validate state (support both canonical planState and legacy state)
  const stateObj = raw.planState || raw.state
  if (!stateObj || typeof stateObj !== 'object') {
    errors.push('Required "state" object is missing from backup payload.')
  }

  const state = (stateObj || {}) as Record<string, unknown>
  const weightLogs = Array.isArray(state.weightLog) ? state.weightLog : []
  const weightLogsCount = weightLogs.length

  // Validate history (support both canonical workoutHistory and legacy history)
  let workoutCount = 0
  const historyArray = Array.isArray(raw.workoutHistory) ? raw.workoutHistory : (Array.isArray(raw.history) ? raw.history : null)
  if (historyArray) {
    workoutCount = historyArray.length
    for (let i = 0; i < Math.min(historyArray.length, 50); i++) {
      const item = historyArray[i]
      if (!item || typeof item !== 'object' || typeof item.completedAt !== 'string') {
        warnings.push(`Workout record at index ${i} has incomplete metadata.`)
        break
      }
    }
  }

  // Validate saved plans
  let savedPlansCount = 0
  if (Array.isArray(raw.savedPlans)) {
    savedPlansCount = raw.savedPlans.length
  }

  const isValid = errors.length === 0
  const summaryText = isValid
    ? `Valid backup (${schemaOrVersion}): ${workoutCount} workouts, ${savedPlansCount} saved plans, ${weightLogsCount} weight logs.`
    : `Integrity check failed: ${errors.join(', ')}`

  return {
    isValid,
    version: schemaOrVersion,
    workoutCount,
    savedPlansCount,
    weightLogsCount,
    errors,
    warnings,
    summaryText
  }
}
