export interface WorkoutCheckpointPayload {
  sessionId: string
  dayIndex: number
  dayTitle: string
  startedAt: string
  lastActiveTimestamp: number
  elapsedSeconds: number
  completedExerciseIds: string[]
  loggedSetsCount: number
}

const CHECKPOINT_STORAGE_KEY = 'bodymap_active_workout_checkpoint'

/**
 * Deterministically serializes and validates an in-flight workout checkpoint.
 *
 * NON-MEDICAL HEURISTIC:
 * Saves volatile in-flight session state locally to prevent silent session loss upon browser reload.
 */
export function saveWorkoutCheckpoint(payload: WorkoutCheckpointPayload): boolean {
  if (!payload || typeof payload !== 'object' || !payload.sessionId) {
    return false
  }
  try {
    const raw = JSON.stringify(payload)
    sessionStorage.setItem(CHECKPOINT_STORAGE_KEY, raw)
    return true
  } catch {
    return false
  }
}

/**
 * Deterministically retrieves and validates an existing workout checkpoint.
 */
export function loadWorkoutCheckpoint(): WorkoutCheckpointPayload | null {
  try {
    const raw = sessionStorage.getItem(CHECKPOINT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkoutCheckpointPayload
    if (
      parsed &&
      typeof parsed.sessionId === 'string' &&
      typeof parsed.dayIndex === 'number' &&
      typeof parsed.elapsedSeconds === 'number'
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

/**
 * Deterministically clears an active workout checkpoint upon successful completion or intentional discard.
 */
export function clearWorkoutCheckpoint(): void {
  try {
    sessionStorage.removeItem(CHECKPOINT_STORAGE_KEY)
  } catch {
    // Ignore storage clear failure
  }
}
