import type { CompletedWorkoutLog } from '@/types/workoutSession'
import { normalizeExerciseName } from '@/lib/progressionEngine'

export type MuscleFocusCategory =
  | 'Chest'
  | 'Back'
  | 'Legs'
  | 'Shoulders'
  | 'Arms'
  | 'Core'
  | 'Other'

export interface MuscleVolumeBreakdown {
  category: MuscleFocusCategory
  totalSets: number
  weightedVolumeKg: number
  percentageOfVolume: number
}

export interface VolumeAnalyticsResult {
  totalWeightedSets: number
  totalBodyweightSets: number
  totalWeightedVolumeKg: number
  focusBreakdown: MuscleVolumeBreakdown[]
  hasData: boolean
}

/**
 * Classifies an exercise into a primary muscle focus category deterministically.
 */
export function classifyMuscleFocus(rawName: string): MuscleFocusCategory {
  const norm = normalizeExerciseName(rawName)
  if (!norm) return 'Other'

  // Chest
  if (/bench|chest|pec|fly|push\s*up|dips|incline/i.test(norm) && !/shoulder|overhead|leg/i.test(norm)) {
    return 'Chest'
  }

  // Core
  if (/plank|crunch|core|\babs?\b|russian twist|leg\s*raise/i.test(norm)) {
    return 'Core'
  }

  // Legs
  if (/squat|lunge|leg|quad|hamstring|calf|calves|glute|rdl|romanian/i.test(norm)) {
    return 'Legs'
  }

  // Back
  if (/row|\blats?\b|pulldown|pull\s*up|chin\s*up|deadlift|shrug/i.test(norm) && !/lateral/i.test(norm)) {
    return 'Back'
  }

  // Shoulders
  if (/overhead|shoulder|ohp|military|lateral|front raise|delt/i.test(norm)) {
    return 'Shoulders'
  }

  // Arms
  if (/curl|bicep|tricep|skull crusher|extension/i.test(norm)) {
    return 'Arms'
  }

  return 'Other'
}

/**
 * Calculates volume analytics and muscle focus breakdown deterministically from authentic workout logs.
 * Does NOT fabricate weight for bodyweight movements.
 */
export function calculateVolumeAnalytics(history: CompletedWorkoutLog[]): VolumeAnalyticsResult {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      totalWeightedSets: 0,
      totalBodyweightSets: 0,
      totalWeightedVolumeKg: 0,
      focusBreakdown: [],
      hasData: false
    }
  }

  const categoryTotals: Record<MuscleFocusCategory, { sets: number; volumeKg: number }> = {
    Chest: { sets: 0, volumeKg: 0 },
    Back: { sets: 0, volumeKg: 0 },
    Legs: { sets: 0, volumeKg: 0 },
    Shoulders: { sets: 0, volumeKg: 0 },
    Arms: { sets: 0, volumeKg: 0 },
    Core: { sets: 0, volumeKg: 0 },
    Other: { sets: 0, volumeKg: 0 }
  }

  let totalWeightedSets = 0
  let totalBodyweightSets = 0
  let grandTotalVolumeKg = 0

  for (const log of history) {
    if (!log || !Array.isArray(log.exercisesSummary)) continue

    for (const ex of log.exercisesSummary) {
      if (!ex || typeof ex.name !== 'string') continue
      const cat = classifyMuscleFocus(ex.name)
      const sets = typeof ex.setsCompleted === 'number' && ex.setsCompleted > 0 ? ex.setsCompleted : 0
      const weight = (ex as Record<string, unknown>).weightKg as number | undefined

      if (typeof weight === 'number' && weight > 0 && weight < 600 && sets > 0) {
        // Average 10 reps fallback if setsSummary is aggregate
        const volume = Math.round(weight * sets * 10 * 10) / 10
        categoryTotals[cat].volumeKg += volume
        categoryTotals[cat].sets += sets
        totalWeightedSets += sets
        grandTotalVolumeKg += volume
      } else if (sets > 0) {
        categoryTotals[cat].sets += sets
        totalBodyweightSets += sets
      }
    }
  }

  const focusBreakdown: MuscleVolumeBreakdown[] = Object.entries(categoryTotals)
    .map(([cat, val]) => {
      const category = cat as MuscleFocusCategory
      const percentage = grandTotalVolumeKg > 0 ? Math.round((val.volumeKg / grandTotalVolumeKg) * 100) : 0
      return {
        category,
        totalSets: val.sets,
        weightedVolumeKg: Math.round(val.volumeKg),
        percentageOfVolume: percentage
      }
    })
    .filter(b => b.totalSets > 0 || b.weightedVolumeKg > 0)
    .sort((a, b) => b.weightedVolumeKg - a.weightedVolumeKg)

  return {
    totalWeightedSets,
    totalBodyweightSets,
    totalWeightedVolumeKg: Math.round(grandTotalVolumeKg),
    focusBreakdown,
    hasData: totalWeightedSets > 0 || totalBodyweightSets > 0
  }
}
