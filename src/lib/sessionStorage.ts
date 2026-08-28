import type { WorkoutSession, CompletedWorkoutLog } from '@/types/workoutSession'

export const ACTIVE_SESSION_STORAGE_KEY = 'bodymap_active_session'
export const WORKOUT_HISTORY_STORAGE_KEY = 'bodymap_workout_history'
export const MAX_STORED_WORKOUTS = 250
export const BACKUP_NUDGE_THRESHOLD = 220

export function saveActiveSession(session: WorkoutSession): void {
  try {
    const payload = JSON.stringify({
      ...session,
      lastUpdatedAt: Date.now()
    })
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, payload)
  } catch (err) {
    console.warn('[SessionStorage] Failed to save active workout session:', err)
  }
}

export function loadActiveSession(): WorkoutSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkoutSession

    if (!parsed || !parsed.sessionId || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      return null
    }

    return parsed
  } catch (err) {
    console.warn('[SessionStorage] Corrupted active session recovered:', err)
    clearActiveSession()
    return null
  }
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
  } catch (err) {
    console.warn('[SessionStorage] Failed to clear active session:', err)
  }
}

export function hasActiveSession(): boolean {
  return loadActiveSession() !== null
}

export function saveCompletedWorkoutLog(log: CompletedWorkoutLog): void {
  try {
    const history = loadWorkoutHistory()
    const updated = [log, ...history.filter(item => item.id !== log.id)].slice(0, MAX_STORED_WORKOUTS)
    localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.warn('[SessionStorage] Failed to save completed workout log:', err)
  }
}

export function loadWorkoutHistory(): CompletedWorkoutLog[] {
  try {
    const raw = localStorage.getItem(WORKOUT_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is CompletedWorkoutLog =>
        Boolean(item && typeof item === 'object' && typeof item.id === 'string' && typeof item.dayTitle === 'string')
    )
  } catch (err) {
    console.warn('[SessionStorage] Corrupted workout history recovered:', err)
    return []
  }
}

export function clearWorkoutHistory(): void {
  try {
    localStorage.removeItem(WORKOUT_HISTORY_STORAGE_KEY)
  } catch (err) {
    console.warn('[SessionStorage] Failed to clear workout history:', err)
  }
}

/**
 * Attaches a post-workout subjective reflection to an existing CompletedWorkoutLog by sessionId.
 *
 * CONTRACT:
 * - Locates the matching log by sessionId (not log.id) to survive duplicate-dedup.
 * - Overwrites only the sessionReflection field.
 * - Never mutates: timestamp, sets, reps, weights, duration, dayTitle, dayType, exercisesSummary.
 * - Silently no-ops if no matching session is found (session may have been pruned at 50-log cap).
 * - Wrapped in try/catch — storage failure is logged and does not throw.
 *
 * Returns true if a matching session was found and updated, false otherwise.
 */
export function saveReflectionForSession(
  sessionId: string,
  reflection: CompletedWorkoutLog['sessionReflection']
): boolean {
  try {
    if (!sessionId || typeof sessionId !== 'string') return false
    if (!reflection || typeof reflection !== 'object') return false

    const history = loadWorkoutHistory()
    const idx = history.findIndex(log => log.sessionId === sessionId)

    if (idx === -1) {
      // Session not found — may have been pruned by the 50-log cap
      return false
    }

    // Attach reflection only — all objective workout fields remain unchanged
    history[idx] = {
      ...history[idx],
      sessionReflection: reflection
    }

    localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(history))
    return true
  } catch (err) {
    console.warn('[SessionStorage] Failed to save session reflection:', err)
    return false
  }
}
