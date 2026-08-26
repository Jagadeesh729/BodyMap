import type { PlanState } from '@/context/PlanContext'
import { loadPersistedState, savePersistedState } from '@/context/planStorage'
import type { WorkoutSession, CompletedWorkoutLog } from '@/types/workoutSession'
import {
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  loadWorkoutHistory,
  saveCompletedWorkoutLog,
  clearWorkoutHistory
} from '@/lib/sessionStorage'

export const BACKUP_SCHEMA_VERSION = '2.2.0'
export const BACKUP_SCHEMA_IDENTIFIER = 'bodymap_backup_v1'

export interface BodyMapBackupV1 {
  version: typeof BACKUP_SCHEMA_VERSION
  schema: typeof BACKUP_SCHEMA_IDENTIFIER
  exportedAt: string
  userName?: string
  planState: PlanState
  activeSession: WorkoutSession | null
  workoutHistory: CompletedWorkoutLog[]
}

/**
 * Generates a complete, deterministic snapshot of all user-owned local data.
 */
export function generateBackupPayload(): BodyMapBackupV1 {
  const planState = loadPersistedState()
  const activeSession = loadActiveSession()
  const workoutHistory = loadWorkoutHistory()
  let userName = 'Athlete'
  try {
    userName = localStorage.getItem('bodymap_user_name') || 'Athlete'
  } catch {
    // Ignore storage exception
  }

  return {
    version: BACKUP_SCHEMA_VERSION,
    schema: BACKUP_SCHEMA_IDENTIFIER,
    exportedAt: new Date().toISOString(),
    userName,
    planState,
    activeSession,
    workoutHistory
  }
}

/**
 * Validates and safely parses an imported backup JSON string.
 */
export function validateAndParseBackup(
  jsonString: string
): { success: true; data: BodyMapBackupV1 } | { success: false; error: string } {
  if (!jsonString || typeof jsonString !== 'string' || jsonString.trim().length === 0) {
    return { success: false, error: 'The provided backup file is empty.' }
  }

  try {
    const parsed = JSON.parse(jsonString) as Partial<BodyMapBackupV1>

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Invalid backup structure: Root must be a JSON object.' }
    }

    if (parsed.schema !== BACKUP_SCHEMA_IDENTIFIER) {
      return {
        success: false,
        error: `Unsupported backup schema: Expected "${BACKUP_SCHEMA_IDENTIFIER}", received "${parsed.schema || 'unknown'}".`
      }
    }

    if (!parsed.planState || typeof parsed.planState !== 'object') {
      return { success: false, error: 'Invalid backup: Missing or invalid planState data.' }
    }

    const validatedBackup: BodyMapBackupV1 = {
      version: BACKUP_SCHEMA_VERSION,
      schema: BACKUP_SCHEMA_IDENTIFIER,
      exportedAt: parsed.exportedAt || new Date().toISOString(),
      userName: typeof parsed.userName === 'string' ? parsed.userName : 'Athlete',
      planState: parsed.planState as PlanState,
      activeSession: parsed.activeSession && typeof parsed.activeSession === 'object' ? (parsed.activeSession as WorkoutSession) : null,
      workoutHistory: Array.isArray(parsed.workoutHistory) ? (parsed.workoutHistory as CompletedWorkoutLog[]) : []
    }

    return { success: true, data: validatedBackup }
  } catch (err) {
    return { success: false, error: `Corrupted JSON syntax: ${(err as Error).message}` }
  }
}

/**
 * Restores a validated backup into browser storage safely.
 */
export function restoreBackupData(backup: BodyMapBackupV1): { success: boolean; error?: string } {
  try {
    // 1. Restore PlanState
    savePersistedState(backup.planState)

    // 2. Restore User Display Name
    if (backup.userName) {
      localStorage.setItem('bodymap_user_name', backup.userName)
    }

    // 3. Restore Workout History
    clearWorkoutHistory()
    if (Array.isArray(backup.workoutHistory)) {
      for (const log of backup.workoutHistory) {
        if (log && log.id && log.dayTitle) {
          saveCompletedWorkoutLog(log)
        }
      }
    }

    // 4. Restore Active Session if present
    if (backup.activeSession && backup.activeSession.sessionId) {
      saveActiveSession(backup.activeSession)
    } else {
      clearActiveSession()
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: `Failed to restore local storage: ${(err as Error).message}` }
  }
}

/**
 * Triggers a native browser file download for the JSON backup snapshot.
 */
export function exportBackupToFile(filename?: string): void {
  const payload = generateBackupPayload()
  const jsonStr = JSON.stringify(payload, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStamp = new Date().toISOString().split('T')[0]
  link.href = url
  link.download = filename || `bodymap-backup-${dateStamp}.json`

  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 150)
}
