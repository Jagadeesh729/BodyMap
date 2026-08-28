import type { CompletedWorkoutLog } from '@/types/workoutSession'
import { normalizeExerciseName } from '@/lib/progressionEngine'

export { normalizeExerciseName }

export interface PersonalRecord {
  id: string
  exerciseName: string
  normalizedName: string
  metricType: 'max_weight'
  value: number
  unit: 'kg'
  achievedAt: string
  sessionTitle: string
  factualSummary: string
}

/**
 * Deterministically scans authentic workout history and extracts all-time peak weight records per exercise.
 */
export function extractPersonalRecords(history: CompletedWorkoutLog[]): PersonalRecord[] {
  if (!Array.isArray(history) || history.length === 0) {
    return []
  }

  const recordsByExercise: Map<string, PersonalRecord> = new Map()

  // Sort history chronologically so newest achievements break ties deterministically
  const sorted = [...history].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  )

  for (const log of sorted) {
    if (!log || !Array.isArray(log.exercisesSummary)) continue

    for (const ex of log.exercisesSummary) {
      if (!ex || typeof ex.name !== 'string') continue
      const weight = typeof ex.peakWeightKg === 'number' && Number.isFinite(ex.peakWeightKg) && ex.peakWeightKg > 0 && ex.peakWeightKg < 600
        ? ex.peakWeightKg
        : (typeof (ex as Record<string, unknown>).weightKg === 'number' ? (ex as Record<string, unknown>).weightKg as number : undefined)

      if (typeof weight === 'number' && weight > 0 && weight < 600) {
        const norm = normalizeExerciseName(ex.name)
        if (!norm) continue

        const existing = recordsByExercise.get(norm)
        if (!existing || weight >= existing.value) {
          recordsByExercise.set(norm, {
            id: `pr_${norm.replace(/\s+/g, '_')}`,
            exerciseName: ex.name,
            normalizedName: norm,
            metricType: 'max_weight',
            value: weight,
            unit: 'kg',
            achievedAt: log.completedAt,
            sessionTitle: log.dayTitle || 'Gym Session',
            factualSummary: `${weight} kg peak weight recorded on ${new Date(log.completedAt).toLocaleDateString()}`
          })
        }
      }
    }
  }

  // Return sorted by peak weight descending
  return Array.from(recordsByExercise.values()).sort((a, b) => b.value - a.value)
}
