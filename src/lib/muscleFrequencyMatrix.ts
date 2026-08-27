import type { DayPlan } from '@/types/plan'

export type MuscleGroupKey = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Core'

export interface MuscleFrequencyItem {
  muscle: MuscleGroupKey
  weeklyFrequency: number // number of distinct days trained
  frequencyLabel: string // e.g. "2x / week"
  statusLabel: 'Low (1x)' | 'Moderate (2x)' | 'High (3x+)' | 'Rest / None'
}

export interface MuscleFrequencyMatrixResult {
  hasData: boolean
  totalTrainingDays: number
  frequencies: MuscleFrequencyItem[]
  summaryLabel: string
}

const CANONICAL_MUSCLES: MuscleGroupKey[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core']

/**
 * Deterministically calculates weekly direct muscle training frequency across a 7-day schedule.
 * Strictly counts distinct days per muscle group to prevent duplicate counting within the same day.
 */
export function calculateWeeklyMuscleFrequency(
  days: DayPlan[] | null | undefined
): MuscleFrequencyMatrixResult {
  if (!Array.isArray(days) || days.length === 0) {
    return {
      hasData: false,
      totalTrainingDays: 0,
      frequencies: CANONICAL_MUSCLES.map(muscle => ({
        muscle,
        weeklyFrequency: 0,
        frequencyLabel: '0x / week',
        statusLabel: 'Rest / None'
      })),
      summaryLabel: 'No scheduled plan days available.'
    }
  }

  const muscleDayCounts: Record<MuscleGroupKey, number> = {
    Chest: 0,
    Back: 0,
    Shoulders: 0,
    Arms: 0,
    Legs: 0,
    Core: 0
  }

  let totalTrainingDays = 0

  for (const day of days) {
    if (!day || day.isRest) continue

    const dayMuscles = new Set<MuscleGroupKey>()
    const focusArr = Array.isArray(day.focus) ? day.focus : []
    const focusStr = `${day.type || ''} ${focusArr.join(' ')}`.toLowerCase()

    if (/full body/i.test(focusStr)) {
      dayMuscles.add('Chest')
      dayMuscles.add('Back')
      dayMuscles.add('Legs')
      dayMuscles.add('Core')
    } else {
      if (/chest|push|pec/i.test(focusStr)) dayMuscles.add('Chest')
      if (/back|pull|lat|rhomboid/i.test(focusStr)) dayMuscles.add('Back')
      if (/shoulder|delt|overhead/i.test(focusStr)) dayMuscles.add('Shoulders')
      if (/arm|bicep|tricep/i.test(focusStr)) dayMuscles.add('Arms')
      if (/leg|lower|quad|hamstring|glute|squat/i.test(focusStr)) dayMuscles.add('Legs')
      if (/core|ab|abs/i.test(focusStr)) dayMuscles.add('Core')
    }

    // Also inspect exercise text if focus was empty
    if (dayMuscles.size === 0 && day.workout && Array.isArray(day.workout.main)) {
      const exerciseText = day.workout.main.join(' ').toLowerCase()
      if (/bench|press|push-up|fly/i.test(exerciseText)) dayMuscles.add('Chest')
      if (/pull-up|row|deadlift|pulldown/i.test(exerciseText)) dayMuscles.add('Back')
      if (/shoulder|military|overhead|lateral/i.test(exerciseText)) dayMuscles.add('Shoulders')
      if (/curl|extension|dip/i.test(exerciseText)) dayMuscles.add('Arms')
      if (/squat|lunge|leg press|calf/i.test(exerciseText)) dayMuscles.add('Legs')
      if (/plank|crunch/i.test(exerciseText)) dayMuscles.add('Core')
    }

    if (dayMuscles.size > 0) {
      totalTrainingDays++
      dayMuscles.forEach(m => {
        muscleDayCounts[m] = (muscleDayCounts[m] || 0) + 1
      })
    }
  }

  const frequencies: MuscleFrequencyItem[] = CANONICAL_MUSCLES.map(muscle => {
    const count = muscleDayCounts[muscle] || 0
    let statusLabel: MuscleFrequencyItem['statusLabel'] = 'Rest / None'
    if (count >= 3) statusLabel = 'High (3x+)'
    else if (count === 2) statusLabel = 'Moderate (2x)'
    else if (count === 1) statusLabel = 'Low (1x)'

    return {
      muscle,
      weeklyFrequency: count,
      frequencyLabel: `${count}x / week`,
      statusLabel
    }
  })

  const activeMuscles = frequencies.filter(f => f.weeklyFrequency > 0)
  const summaryLabel = activeMuscles.length > 0
    ? activeMuscles.map(f => `${f.muscle}: ${f.frequencyLabel}`).join(' • ')
    : 'No direct muscle training days identified.'

  return {
    hasData: totalTrainingDays > 0,
    totalTrainingDays,
    frequencies,
    summaryLabel
  }
}
