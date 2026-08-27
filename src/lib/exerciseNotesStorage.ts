import { normalizeExerciseName } from '@/lib/progressionEngine'

const EXERCISE_NOTES_STORAGE_KEY = 'bodymap_exercise_notes'

export interface ExercisePersonalNote {
  note: string
  updatedAt: string
}

export type ExerciseNotesMap = Record<string, ExercisePersonalNote>

/**
 * Loads all personal exercise notes safely from localStorage.
 */
export function loadExerciseNotes(): ExerciseNotesMap {
  try {
    const raw = localStorage.getItem(EXERCISE_NOTES_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as ExerciseNotesMap
  } catch {
    return {}
  }
}

/**
 * Retrieves a personal cue note for a specific exercise using normalized identity.
 */
export function getExerciseNote(exerciseName: string): string | null {
  const norm = normalizeExerciseName(exerciseName)
  if (!norm) return null
  const map = loadExerciseNotes()
  return map[norm]?.note || null
}

/**
 * Saves a personal cue note for a specific exercise.
 */
export function saveExerciseNote(exerciseName: string, noteText: string): void {
  const norm = normalizeExerciseName(exerciseName)
  if (!norm) return

  const trimmed = noteText.trim()
  const map = loadExerciseNotes()

  if (trimmed === '') {
    delete map[norm]
  } else {
    map[norm] = {
      note: trimmed.slice(0, 500), // Enforce sensible max length
      updatedAt: new Date().toISOString()
    }
  }

  try {
    localStorage.setItem(EXERCISE_NOTES_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Ignore storage failure gracefully
  }
}

/**
 * Deletes a personal cue note for a specific exercise.
 */
export function deleteExerciseNote(exerciseName: string): void {
  const norm = normalizeExerciseName(exerciseName)
  if (!norm) return

  const map = loadExerciseNotes()
  if (map[norm]) {
    delete map[norm]
    try {
      localStorage.setItem(EXERCISE_NOTES_STORAGE_KEY, JSON.stringify(map))
    } catch {
      // Ignore storage failure gracefully
    }
  }
}
