import type { CompletedWorkoutLog } from '@/types/workoutSession'

export interface DailyLoadItem {
  dateStr: string // YYYY-MM-DD
  dayLabel: string // Mon, Tue, etc.
  weightedVolumeKg: number
}

export interface TrainingStrainResult {
  hasData: boolean
  total7DayVolumeKg: number
  dailyMeanVolumeKg: number
  standardDeviationKg: number
  monotonyIndex: number | null
  trainingStrainScore: number | null
  dailyLoads: DailyLoadItem[]
  balanceLabel: string
  explanation: string
}

/**
 * Deterministically calculates Foster's 7-Day Training Monotony & Strain metrics.
 * Strictly labeled as an analytical distribution indicator, not a clinical or injury diagnosis.
 */
export function calculate7DayTrainingStrain(
  history: CompletedWorkoutLog[] | null | undefined,
  referenceDate: Date | string = new Date()
): TrainingStrainResult {
  const ref = typeof referenceDate === 'string' ? new Date(referenceDate) : new Date(referenceDate.getTime())
  const refTime = isNaN(ref.getTime()) ? new Date() : ref

  // Build 7 consecutive days ending on reference date
  const dailyLoads: DailyLoadItem[] = []
  const volumeByDate: Map<string, number> = new Map()

  if (Array.isArray(history) && history.length > 0) {
    for (const log of history) {
      if (!log || typeof log.completedAt !== 'string') continue
      const dateKey = log.completedAt.split('T')[0]
      if (!dateKey) continue

      let sessionVol = 0
      if (Array.isArray(log.exercisesSummary)) {
        for (const ex of log.exercisesSummary) {
          if (!ex) continue
          const sets = typeof ex.setsCompleted === 'number' && ex.setsCompleted > 0 ? ex.setsCompleted : 0
          const weight = (ex as Record<string, unknown>).weightKg as number | undefined
          if (typeof weight === 'number' && weight > 0 && sets > 0) {
            sessionVol += Math.round(weight * sets * 10)
          }
        }
      }

      volumeByDate.set(dateKey, (volumeByDate.get(dateKey) || 0) + sessionVol)
    }
  }

  for (let i = 6; i >= 0; i--) {
    const d = new Date(refTime.getTime())
    d.setDate(refTime.getDate() - i)
    const dateKey = d.toISOString().split('T')[0]
    const dayLabel = d.toLocaleDateString(undefined, { weekday: 'short' })
    const vol = volumeByDate.get(dateKey) || 0

    dailyLoads.push({
      dateStr: dateKey,
      dayLabel,
      weightedVolumeKg: vol
    })
  }

  const totalVol = dailyLoads.reduce((sum, d) => sum + d.weightedVolumeKg, 0)

  if (totalVol <= 0) {
    return {
      hasData: false,
      total7DayVolumeKg: 0,
      dailyMeanVolumeKg: 0,
      standardDeviationKg: 0,
      monotonyIndex: null,
      trainingStrainScore: null,
      dailyLoads,
      balanceLabel: 'No 7-day load',
      explanation: 'No weighted workout volume recorded in the last 7 days.'
    }
  }

  const mean = Math.round((totalVol / 7) * 10) / 10
  const variance = dailyLoads.reduce((sum, d) => sum + Math.pow(d.weightedVolumeKg - mean, 2), 0) / 7
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10

  let monotony: number | null = null
  let strain: number | null = null
  let balanceLabel = 'Balanced variation'

  if (stdDev === 0) {
    monotony = 1.0
    strain = Math.round(totalVol * monotony)
    balanceLabel = 'Uniform daily load'
  } else {
    monotony = Math.round((mean / stdDev) * 100) / 100
    strain = Math.round(totalVol * monotony)
    if (monotony > 2.0) {
      balanceLabel = 'High daily monotony'
    } else if (monotony < 1.0) {
      balanceLabel = 'High daily variation'
    } else {
      balanceLabel = 'Moderate variation'
    }
  }

  return {
    hasData: true,
    total7DayVolumeKg: totalVol,
    dailyMeanVolumeKg: mean,
    standardDeviationKg: stdDev,
    monotonyIndex: monotony,
    trainingStrainScore: strain,
    dailyLoads,
    balanceLabel,
    explanation: `7-day load: ${totalVol.toLocaleString()} kg (~${mean} kg/day, SD ±${stdDev} kg). Monotony Index: ${monotony} (${balanceLabel}).`
  }
}
