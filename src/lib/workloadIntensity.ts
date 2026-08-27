import type { CompletedWorkoutLog } from '@/types/workoutSession'

export interface WorkloadDensityMetrics {
  hasData: boolean
  totalWeightedVolumeKg: number
  activeDurationMinutes: number
  densityKgPerMin: number
  setsPerHour: number
  explanation: string
}

/**
 * Deterministically calculates session workload density (kg/min) and pacing efficiency.
 * Labeled clearly as workload density, not a complete measure of physiological intensity.
 */
export function calculateWorkloadDensity(
  log: CompletedWorkoutLog | null | undefined
): WorkloadDensityMetrics {
  if (!log || typeof log !== 'object') {
    return {
      hasData: false,
      totalWeightedVolumeKg: 0,
      activeDurationMinutes: 0,
      densityKgPerMin: 0,
      setsPerHour: 0,
      explanation: 'No workout log available.'
    }
  }

  const durationSeconds = typeof log.durationSeconds === 'number' && log.durationSeconds > 0 ? log.durationSeconds : 0
  const durationMinutes = Math.round((durationSeconds / 60) * 10) / 10

  if (durationMinutes <= 0) {
    return {
      hasData: false,
      totalWeightedVolumeKg: 0,
      activeDurationMinutes: 0,
      densityKgPerMin: 0,
      setsPerHour: 0,
      explanation: 'Active workout duration must be greater than zero.'
    }
  }

  let totalVolumeKg = 0
  if (Array.isArray(log.exercisesSummary)) {
    for (const ex of log.exercisesSummary) {
      if (!ex) continue
      const sets = typeof ex.setsCompleted === 'number' && ex.setsCompleted > 0 ? ex.setsCompleted : 0
      const weight = (ex as Record<string, unknown>).weightKg as number | undefined
      if (typeof weight === 'number' && weight > 0 && sets > 0) {
        totalVolumeKg += Math.round(weight * sets * 10)
      }
    }
  }

  const totalSets = typeof log.totalSetsCompleted === 'number' && log.totalSetsCompleted > 0 ? log.totalSetsCompleted : 0

  const densityKgPerMin = Math.round((totalVolumeKg / durationMinutes) * 10) / 10
  const setsPerHour = Math.round((totalSets / (durationSeconds / 3600)) * 10) / 10

  return {
    hasData: true,
    totalWeightedVolumeKg: totalVolumeKg,
    activeDurationMinutes: durationMinutes,
    densityKgPerMin,
    setsPerHour,
    explanation: `${totalVolumeKg.toLocaleString()} kg moved across ${durationMinutes} active minutes (~${densityKgPerMin} kg/min density).`
  }
}
