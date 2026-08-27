import type { CompletedWorkoutLog } from '@/types/workoutSession'
import { normalizeExerciseName } from '@/lib/personalRecords'

export interface ExerciseCrossSessionSummary {
  exerciseName: string
  normalizedName: string
  totalSessions: number
  totalSetsCompleted: number
  peakWeightKg: number | null
  latestSessionDate: string | null
  factualSummary: string
}

/**
 * Deterministically aggregates multi-session exercise logs across authentic workout history.
 * Groups by normalized exercise name without mutating source records.
 *
 * NON-MEDICAL HEURISTIC:
 * Aggregates athlete training history deterministically.
 * Never issues clinical diagnoses or guaranteed physiological outcomes.
 */
export function aggregateCrossSessionExercises(
  history: CompletedWorkoutLog[] = []
): ExerciseCrossSessionSummary[] {
  if (!Array.isArray(history) || history.length === 0) {
    return []
  }

  const map: Map<
    string,
    {
      displayName: string
      totalSessions: number
      totalSetsCompleted: number
      peakWeightKg: number | null
      latestTimestamp: number
      latestDateStr: string | null
    }
  > = new Map()

  for (const log of history) {
    if (!log || !Array.isArray(log.exercisesSummary)) continue
    const timestamp = log.completedAt ? new Date(log.completedAt).getTime() : 0

    for (const ex of log.exercisesSummary) {
      if (!ex || typeof ex.name !== 'string') continue
      const norm = normalizeExerciseName(ex.name)
      if (!norm) continue

      const sets = typeof ex.setsCompleted === 'number' && ex.setsCompleted > 0 ? ex.setsCompleted : 1
      const weight = (ex as Record<string, unknown>).weightKg as number | undefined
      const validWeight = typeof weight === 'number' && weight > 0 && weight < 600 ? weight : null

      const existing = map.get(norm)
      if (!existing) {
        map.set(norm, {
          displayName: ex.name,
          totalSessions: 1,
          totalSetsCompleted: sets,
          peakWeightKg: validWeight,
          latestTimestamp: timestamp,
          latestDateStr: log.completedAt || null
        })
      } else {
        existing.totalSessions += 1
        existing.totalSetsCompleted += sets
        if (validWeight !== null) {
          existing.peakWeightKg = existing.peakWeightKg !== null ? Math.max(existing.peakWeightKg, validWeight) : validWeight
        }
        if (timestamp > existing.latestTimestamp) {
          existing.latestTimestamp = timestamp
          existing.latestDateStr = log.completedAt || existing.latestDateStr
        }
      }
    }
  }

  return Array.from(map.entries())
    .map(([norm, data]) => {
      const weightText = data.peakWeightKg !== null ? ` (peak ${data.peakWeightKg} kg)` : ''
      const dateText = data.latestDateStr ? ` - last on ${new Date(data.latestDateStr).toLocaleDateString()}` : ''
      return {
        exerciseName: data.displayName,
        normalizedName: norm,
        totalSessions: data.totalSessions,
        totalSetsCompleted: data.totalSetsCompleted,
        peakWeightKg: data.peakWeightKg,
        latestSessionDate: data.latestDateStr,
        factualSummary: `${data.totalSessions} session${data.totalSessions === 1 ? '' : 's'}, ${data.totalSetsCompleted} sets${weightText}${dateText}`
      }
    })
    .sort((a, b) => b.totalSessions - a.totalSessions || b.totalSetsCompleted - a.totalSetsCompleted)
}
