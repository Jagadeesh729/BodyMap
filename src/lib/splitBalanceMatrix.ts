import type { DayPlan, WeeklyPlan } from '@/types/plan'
import { getMovementPattern } from '@/lib/movementPatterns'

export interface SplitBalanceResult {
  hasData: boolean
  totalExercises: number
  pushCount: number
  pullCount: number
  legsCount: number
  coreAccessoryCount: number
  pushPercentage: number
  pullPercentage: number
  legsPercentage: number
  corePercentage: number
  balanceStatusLabel: string
  summary: string
}

type CompatibleDay = {
  workout?: { main?: string[] }
  exercises?: Array<string | { name?: string }>
}

/**
 * Deterministically analyzes the anatomical Push / Pull / Legs movement pattern balance across a 7-day schedule.
 * Robustly parses both DayPlan[] array and WeeklyPlan object formats.
 */
export function calculateSplitBalance(
  plan: DayPlan[] | WeeklyPlan | { days?: CompatibleDay[] } | null | undefined
): SplitBalanceResult {
  if (!plan) {
    return createEmptyResult('No Plan Data', 'No active 7-day training schedule available to evaluate split balance.')
  }

  const days: CompatibleDay[] = Array.isArray(plan)
    ? plan
    : 'days' in plan && Array.isArray(plan.days)
    ? (plan.days as CompatibleDay[])
    : []

  if (days.length === 0) {
    return createEmptyResult('No Plan Data', 'No active 7-day training schedule available to evaluate split balance.')
  }

  let pushCount = 0
  let pullCount = 0
  let legsCount = 0
  let coreAccessoryCount = 0
  let totalExercises = 0

  for (const day of days) {
    if (!day) continue

    // Extract exercise names from either workout.main string[] or exercises object array
    const exerciseNames: string[] = []

    if (day.workout && Array.isArray(day.workout.main)) {
      for (const item of day.workout.main) {
        if (typeof item === 'string') {
          const cleanName = item.split(':')[0].trim()
          if (cleanName) exerciseNames.push(cleanName)
        }
      }
    } else if (Array.isArray(day.exercises)) {
      for (const ex of day.exercises) {
        if (typeof ex === 'string') {
          exerciseNames.push(ex)
        } else if (ex && typeof ex.name === 'string') {
          exerciseNames.push(ex.name)
        }
      }
    }

    for (const name of exerciseNames) {
      totalExercises++
      const patternRes = getMovementPattern(name)
      if (patternRes.pattern === 'Horizontal Push' || patternRes.pattern === 'Vertical Push') {
        pushCount++
      } else if (patternRes.pattern === 'Horizontal Pull' || patternRes.pattern === 'Vertical Pull') {
        pullCount++
      } else if (patternRes.pattern === 'Knee Dominant' || patternRes.pattern === 'Hip Hinge') {
        legsCount++
      } else {
        coreAccessoryCount++
      }
    }
  }

  if (totalExercises === 0) {
    return createEmptyResult('0 Exercises', 'No exercises scheduled in current weekly plan.')
  }

  const pushPercentage = Math.round((pushCount / totalExercises) * 100)
  const pullPercentage = Math.round((pullCount / totalExercises) * 100)
  const legsPercentage = Math.round((legsCount / totalExercises) * 100)
  const corePercentage = Math.round((coreAccessoryCount / totalExercises) * 100)

  let balanceStatusLabel = 'Balanced Multi-Planar Split'
  if (pushPercentage > 50) {
    balanceStatusLabel = 'Push-Dominant Split'
  } else if (pullPercentage > 50) {
    balanceStatusLabel = 'Pull-Dominant Split'
  } else if (legsPercentage > 50) {
    balanceStatusLabel = 'Lower-Body Dominant Split'
  }

  return {
    hasData: true,
    totalExercises,
    pushCount,
    pullCount,
    legsCount,
    coreAccessoryCount,
    pushPercentage,
    pullPercentage,
    legsPercentage,
    corePercentage,
    balanceStatusLabel,
    summary: `${pushPercentage}% Push • ${pullPercentage}% Pull • ${legsPercentage}% Legs • ${corePercentage}% Accessory (${totalExercises} total exercises)`
  }
}

function createEmptyResult(label: string, summary: string): SplitBalanceResult {
  return {
    hasData: false,
    totalExercises: 0,
    pushCount: 0,
    pullCount: 0,
    legsCount: 0,
    coreAccessoryCount: 0,
    pushPercentage: 0,
    pullPercentage: 0,
    legsPercentage: 0,
    corePercentage: 0,
    balanceStatusLabel: label,
    summary
  }
}
