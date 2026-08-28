export interface WorkoutSet {
  setIndex: number
  targetReps: string
  completedReps: number
  weightKg: number | null
  isCompleted: boolean
  completedAt: string | null
}

export interface SessionExercise {
  id: string
  name: string
  originalName: string
  targetSets: number
  targetReps: string
  restSeconds: number
  focus: string
  equipment: string
  formCue: string
  sets: WorkoutSet[]
  isSubstituted: boolean
  substitutionReason: string | null
}

export interface RestTimerState {
  isActive: boolean
  targetEndTime: number | null // Absolute timestamp ms for background-tab resilience
  durationSeconds: number
  isPaused: boolean
  remainingSeconds: number
}

export interface WorkoutSession {
  sessionId: string
  dayIndex: number
  dayTitle: string
  dayType: string
  durationMinutes: number
  startedAt: number
  lastUpdatedAt: number
  elapsedSeconds: number
  currentExerciseIndex: number
  exercises: SessionExercise[]
  restTimer: RestTimerState
  status: 'in-progress' | 'completed' | 'abandoned'
  soundEnabled: boolean
  vibrateEnabled: boolean
}

export interface CompletedWorkoutLog {
  id: string
  sessionId: string
  dayIndex: number
  dayTitle: string
  dayType: string
  completedAt: string // ISO string
  durationSeconds: number
  totalSetsCompleted: number
  totalExercises: number
  exercisesSummary: Array<{
    name: string
    setsCompleted: number
    totalSets: number
    /**
     * Peak (maximum) working weight logged across completed sets for this exercise, in kg.
     * Derived deterministically from completed sets only — never from incomplete sets.
     * null  → V11+ record where all completed sets had no valid weight (e.g. bodyweight).
     * undefined → Pre-V11 historical record; weight data was not persisted for this session.
     * Distinguish: undefined ≠ null ≠ 0. Do not coerce undefined to 0.
     */
    peakWeightKg?: number | null
    /**
     * Average completed repetitions across all completed sets for this exercise.
     * Rounded to nearest integer. Derived from completed sets only.
     * null  → V11+ record where no completed sets had valid rep counts.
     * undefined → Pre-V11 historical record; rep data was not persisted.
     */
    avgCompletedReps?: number | null
  }>
  /**
   * Optional post-workout subjective reflection logged by the user at session completion.
   * Strictly user-reported data. Never derived from objective workout facts.
   * Absent on historical records created before V3.5 — treated as undefined, not an error.
   */
  sessionReflection?: {
    energyRating?: 1 | 2 | 3 | 4 | 5
    perceivedReadiness?: 'high' | 'moderate' | 'low'
    reflectionTags?: string[]
  }
}
