export type DensityTrendType = 'increasing_density' | 'stable_density' | 'decreasing_density' | 'insufficient_data'

export interface TrainingDensityProgressionResult {
  hasSufficientData: boolean
  currentDensityKgPerMin: number
  previousDensityKgPerMin: number
  densityDeltaKgPerMin: number
  densityDeltaPercentage: number
  densityTrend: DensityTrendType
  trendLabel: string
  trendSummary: string
}

interface HistoricalWorkoutItemLike {
  date?: string
  completedAt?: string | number
  durationSeconds?: number
  durationMinutes?: number
  totalVolumeKg?: number
  sessionData?: {
    exercises?: Array<{
      sets?: Array<{
        weightKg?: number
        weight?: number
        actualReps?: number
        reps?: number
        completed?: boolean
      }>
    }>
  }
}

/**
 * Deterministically analyzes multi-week workload density trends (kg of volume moved per active training minute).
 * Evaluates volume density between the recent 14-day block and the prior 14-day block.
 */
export function calculateTrainingDensityProgression(
  workoutHistory: HistoricalWorkoutItemLike[] | null | undefined,
  referenceTimestamp: number = Date.now()
): TrainingDensityProgressionResult {
  if (!Array.isArray(workoutHistory) || workoutHistory.length === 0) {
    return {
      hasSufficientData: false,
      currentDensityKgPerMin: 0,
      previousDensityKgPerMin: 0,
      densityDeltaKgPerMin: 0,
      densityDeltaPercentage: 0,
      densityTrend: 'insufficient_data',
      trendLabel: 'No Workout History',
      trendSummary: 'Log more workouts across multiple weeks to calculate training density progression.'
    }
  }

  const msPerDay = 86400000
  const fourteenDaysMs = 14 * msPerDay
  const twentyEightDaysMs = 28 * msPerDay

  let currentVolume = 0
  let currentMinutes = 0
  let previousVolume = 0
  let previousMinutes = 0

  for (const item of workoutHistory) {
    if (!item) continue

    const ts = typeof item.completedAt === 'number'
      ? item.completedAt
      : typeof item.completedAt === 'string'
      ? new Date(item.completedAt).getTime()
      : item.date
      ? new Date(item.date).getTime()
      : 0

    if (isNaN(ts) || ts <= 0) continue

    const ageMs = referenceTimestamp - ts
    if (ageMs < 0 || ageMs > twentyEightDaysMs) continue

    // Extract minutes
    const mins = typeof item.durationMinutes === 'number' && item.durationMinutes > 0
      ? item.durationMinutes
      : typeof item.durationSeconds === 'number' && item.durationSeconds > 0
      ? Math.max(1, Math.round(item.durationSeconds / 60))
      : 30 // Safe default duration for historical entry

    // Extract volume
    let vol = 0
    if (typeof item.totalVolumeKg === 'number' && item.totalVolumeKg > 0) {
      vol = item.totalVolumeKg
    } else if (item.sessionData?.exercises) {
      for (const ex of item.sessionData.exercises) {
        if (Array.isArray(ex.sets)) {
          for (const s of ex.sets) {
            if (s.completed) {
              const w = typeof s.weightKg === 'number' ? s.weightKg : typeof s.weight === 'number' ? s.weight : 0
              const r = typeof s.actualReps === 'number' ? s.actualReps : typeof s.reps === 'number' ? s.reps : 0
              vol += w * r
            }
          }
        }
      }
    }

    if (ageMs <= fourteenDaysMs) {
      currentVolume += vol
      currentMinutes += mins
    } else {
      previousVolume += vol
      previousMinutes += mins
    }
  }

  const currentDensity = currentMinutes > 0 ? Math.round((currentVolume / currentMinutes) * 10) / 10 : 0
  const previousDensity = previousMinutes > 0 ? Math.round((previousVolume / previousMinutes) * 10) / 10 : 0

  if (currentDensity === 0 && previousDensity === 0) {
    return {
      hasSufficientData: false,
      currentDensityKgPerMin: 0,
      previousDensityKgPerMin: 0,
      densityDeltaKgPerMin: 0,
      densityDeltaPercentage: 0,
      densityTrend: 'insufficient_data',
      trendLabel: 'Insufficient Volume Data',
      trendSummary: 'Volume density requires non-zero recorded training duration and weights.'
    }
  }

  if (previousDensity === 0) {
    return {
      hasSufficientData: true,
      currentDensityKgPerMin: currentDensity,
      previousDensityKgPerMin: 0,
      densityDeltaKgPerMin: 0,
      densityDeltaPercentage: 0,
      densityTrend: 'stable_density',
      trendLabel: `${currentDensity} kg/min baseline`,
      trendSummary: `Current 14-day training density is ${currentDensity} kg/min (baseline block established).`
    }
  }

  const deltaKgPerMin = Math.round((currentDensity - previousDensity) * 10) / 10
  const deltaPct = Math.round(((currentDensity - previousDensity) / previousDensity) * 1000) / 10

  let trend: DensityTrendType = 'stable_density'
  let trendLabel = `Stable: ${currentDensity} kg/min`

  if (deltaPct > 3.0) {
    trend = 'increasing_density'
    trendLabel = `+${deltaKgPerMin} kg/min (+${deltaPct}%)`
  } else if (deltaPct < -3.0) {
    trend = 'decreasing_density'
    trendLabel = `${deltaKgPerMin} kg/min (${deltaPct}%)`
  }

  return {
    hasSufficientData: true,
    currentDensityKgPerMin: currentDensity,
    previousDensityKgPerMin: previousDensity,
    densityDeltaKgPerMin: deltaKgPerMin,
    densityDeltaPercentage: deltaPct,
    densityTrend: trend,
    trendLabel,
    trendSummary: `14-day density: ${previousDensity} → ${currentDensity} kg/min (${trendLabel})`
  }
}
