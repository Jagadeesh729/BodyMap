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
