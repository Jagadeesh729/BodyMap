import type { WorkoutSession } from '@/types/workoutSession'
import type { PersonalRecord } from '@/lib/personalRecords'

export interface SessionDebriefResult {
  hasData: boolean
  totalVolumeKg: number
  setCount: number
  exerciseCount: number
  durationMinutes: number
  workloadDensityKgPerMin: number
  sessionPRs: PersonalRecord[]
  summaryLabel: string
  factualBreakdown: string
}

/**
 * Deterministically calculates a post-workout debrief breakdown from an active or completed workout session.
 * Strictly counts only completed sets with valid positive weight and reps.
 */
export function calculateSessionDebrief(
  session: WorkoutSession | null | undefined,
  detectedPRs: PersonalRecord[] = []
): SessionDebriefResult {
  if (!session || !Array.isArray(session.exercises) || session.exercises.length === 0) {
    return {
      hasData: false,
      totalVolumeKg: 0,
      setCount: 0,
      exerciseCount: 0,
      durationMinutes: 0,
      workloadDensityKgPerMin: 0,
      sessionPRs: [],
      summaryLabel: 'No workout session data available.',
      factualBreakdown: '0 sets completed'
    }
  }

  let totalVolumeKg = 0
  let completedSetCount = 0
  const activeExerciseNames = new Set<string>()

  for (const ex of session.exercises) {
    if (!ex || !Array.isArray(ex.sets)) continue

    let hasCompletedSetInExercise = false

    for (const s of ex.sets) {
      if (s.completed && typeof s.reps === 'number' && s.reps > 0) {
        completedSetCount++
        hasCompletedSetInExercise = true

        const weight = typeof s.weight === 'number' && !isNaN(s.weight) && s.weight > 0 ? s.weight : 0
        totalVolumeKg += Math.round(weight * s.reps)
      }
    }

    if (hasCompletedSetInExercise) {
      activeExerciseNames.add(ex.name)
    }
  }

  const durationSec = typeof session.durationSeconds === 'number' && !isNaN(session.durationSeconds) && session.durationSeconds > 0
    ? session.durationSeconds
    : (session.completedAt && session.startedAt ? Math.max(0, Math.round((session.completedAt - session.startedAt) / 1000)) : 0)

  const durationMinutes = Math.max(1, Math.round(durationSec / 60))
  const workloadDensityKgPerMin = totalVolumeKg > 0 && durationMinutes > 0
    ? Math.round(totalVolumeKg / durationMinutes)
    : 0

  const exerciseCount = activeExerciseNames.size
  const summaryLabel = completedSetCount > 0
    ? `Completed ${completedSetCount} sets across ${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'} • ${totalVolumeKg.toLocaleString()} kg total volume (${workloadDensityKgPerMin} kg/min density)`
    : 'Session ended with 0 completed sets.'

  const factualBreakdown = `${completedSetCount} sets • ${exerciseCount} exercises • ${durationMinutes} mins`

  return {
    hasData: completedSetCount > 0,
    totalVolumeKg,
    setCount: completedSetCount,
    exerciseCount,
    durationMinutes,
    workloadDensityKgPerMin,
    sessionPRs: detectedPRs,
    summaryLabel,
    factualBreakdown
  }
}
