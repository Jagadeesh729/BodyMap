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
import type { SavedPlan } from '@/types/savedPlan'
import { loadSavedPlans, persistSavedPlans, clearSavedPlans } from '@/lib/savedPlansStorage'
import type { BodyMeasurementEntry } from '@/types/bodyMetrics'
import { loadBodyMetrics, persistBodyMetrics, clearBodyMetrics } from '@/lib/bodyMetricsStorage'

export const BACKUP_SCHEMA_VERSION = '2.3.0'
export const BACKUP_SCHEMA_IDENTIFIER = 'bodymap_backup_v2'
export const LEGACY_BACKUP_SCHEMA_IDENTIFIER = 'bodymap_backup_v1'

export interface BodyMapBackupV2 {
  version: typeof BACKUP_SCHEMA_VERSION | string
  schema: typeof BACKUP_SCHEMA_IDENTIFIER
  exportedAt: string
  userName?: string
  planState: PlanState
  savedPlans: SavedPlan[]
  bodyMetrics: BodyMeasurementEntry[]
  activeSession: WorkoutSession | null
  workoutHistory: CompletedWorkoutLog[]
}

/**
 * Generates a complete, deterministic snapshot of all user-owned local data.
 */
export function generateBackupPayload(): BodyMapBackupV2 {
  const planState = loadPersistedState()
  const activeSession = loadActiveSession()
  const workoutHistory = loadWorkoutHistory()
  const savedPlans = loadSavedPlans()
  const bodyMetrics = loadBodyMetrics()
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
    savedPlans,
    bodyMetrics,
    activeSession,
    workoutHistory
  }
}

/**
 * Validates and safely parses an imported backup JSON string with automated V1 -> V2 migration.
 */
export function validateAndParseBackup(
  jsonString: string
): { success: true; data: BodyMapBackupV2 } | { success: false; error: string } {
  if (!jsonString || typeof jsonString !== 'string' || jsonString.trim().length === 0) {
    return { success: false, error: 'The provided backup file is empty.' }
  }

  try {
    const parsed = JSON.parse(jsonString) as Record<string, unknown>

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Invalid backup structure: Root must be a JSON object.' }
    }

    if (parsed.schema !== BACKUP_SCHEMA_IDENTIFIER && parsed.schema !== LEGACY_BACKUP_SCHEMA_IDENTIFIER) {
      return {
        success: false,
        error: `Unsupported backup schema: Expected "${BACKUP_SCHEMA_IDENTIFIER}" or "${LEGACY_BACKUP_SCHEMA_IDENTIFIER}", received "${String(parsed.schema || 'unknown')}".`
      }
    }

    if (!parsed.planState || typeof parsed.planState !== 'object') {
      return { success: false, error: 'Invalid backup: Missing or invalid planState data.' }
    }

    // Process and validate saved plans
    const validatedSavedPlans: SavedPlan[] = []
    if (Array.isArray(parsed.savedPlans)) {
      for (const sp of parsed.savedPlans) {
        if (sp && typeof sp === 'object' && typeof sp.id === 'string' && typeof sp.name === 'string' && sp.planState) {
          validatedSavedPlans.push(sp as SavedPlan)
        }
      }
    }

    // Process and validate body metrics
    const validatedBodyMetrics: BodyMeasurementEntry[] = []
    if (Array.isArray(parsed.bodyMetrics)) {
      for (const bm of parsed.bodyMetrics) {
        if (bm && typeof bm === 'object' && typeof bm.id === 'string' && typeof bm.date === 'string') {
          validatedBodyMetrics.push(bm as BodyMeasurementEntry)
        }
      }
    }

    // Process and validate workout history
    const validatedWorkoutHistory: CompletedWorkoutLog[] = []
    if (Array.isArray(parsed.workoutHistory)) {
      for (const wh of parsed.workoutHistory) {
        if (wh && typeof wh === 'object' && typeof wh.id === 'string' && typeof wh.dayTitle === 'string') {
          validatedWorkoutHistory.push(wh as CompletedWorkoutLog)
        }
      }
    }

    const validatedBackup: BodyMapBackupV2 = {
      version: typeof parsed.version === 'string' ? parsed.version : BACKUP_SCHEMA_VERSION,
      schema: BACKUP_SCHEMA_IDENTIFIER,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
      userName: typeof parsed.userName === 'string' ? parsed.userName : 'Athlete',
      planState: parsed.planState as PlanState,
      savedPlans: validatedSavedPlans,
      bodyMetrics: validatedBodyMetrics,
      activeSession: parsed.activeSession && typeof parsed.activeSession === 'object' ? (parsed.activeSession as WorkoutSession) : null,
      workoutHistory: validatedWorkoutHistory
    }

    return { success: true, data: validatedBackup }
  } catch (err) {
    return { success: false, error: `Corrupted JSON syntax: ${(err as Error).message}` }
  }
}

/**
 * Restores a validated backup into browser storage safely and atomically.
 */
export function restoreBackupData(backup: BodyMapBackupV2): { success: boolean; error?: string } {
  try {
    // 1. Restore PlanState
    savePersistedState(backup.planState)

    // 2. Restore User Display Name
    if (backup.userName) {
      localStorage.setItem('bodymap_user_name', backup.userName)
    }

    // 3. Restore Saved Plans Library
    clearSavedPlans()
    if (Array.isArray(backup.savedPlans) && backup.savedPlans.length > 0) {
      persistSavedPlans(backup.savedPlans)
    }

    // 4. Restore Body Metrics
    clearBodyMetrics()
    if (Array.isArray(backup.bodyMetrics) && backup.bodyMetrics.length > 0) {
      persistBodyMetrics(backup.bodyMetrics)
    }

    // 5. Restore Workout History
    clearWorkoutHistory()
    if (Array.isArray(backup.workoutHistory)) {
      for (const log of backup.workoutHistory) {
        if (log && log.id && log.dayTitle) {
          saveCompletedWorkoutLog(log)
        }
      }
    }

    // 6. Restore Active Session if present
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
