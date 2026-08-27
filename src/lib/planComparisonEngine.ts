import type { SavedPlan } from '@/types/savedPlan'

export interface PlanComparisonResult {
  planAName: string
  planBName: string
  timePerDayDeltaMinutes: number
  timePerDayLabel: string
  sharedEquipment: string[]
  uniqueEquipmentA: string[]
  uniqueEquipmentB: string[]
  goalMatch: boolean
  levelMatch: boolean
  factualSummary: string
}

/**
 * Deterministically compares two saved training plans.
 * Computes time delta, equipment differences, and goal/level alignment without mutating state.
 *
 * NON-MEDICAL HEURISTIC:
 * Provides non-medical comparison of athlete training routines.
 * Never issues clinical diagnoses or guaranteed physiological outcomes.
 */
export function compareSavedPlans(planA: SavedPlan, planB: SavedPlan): PlanComparisonResult {
  const planAName = planA?.name || 'Plan A'
  const planBName = planB?.name || 'Plan B'

  const timeA = parseInt(planA?.planState?.formData?.timePerDay || '45', 10) || 45
  const timeB = parseInt(planB?.planState?.formData?.timePerDay || '45', 10) || 45
  const timePerDayDeltaMinutes = timeB - timeA

  let timePerDayLabel = 'Same daily duration (0m difference)'
  if (timePerDayDeltaMinutes > 0) {
    timePerDayLabel = `${planBName} requires +${timePerDayDeltaMinutes}m more per day`
  } else if (timePerDayDeltaMinutes < 0) {
    timePerDayLabel = `${planBName} requires ${Math.abs(timePerDayDeltaMinutes)}m less per day`
  }

  const eqA = Array.isArray(planA?.planState?.formData?.equipment)
    ? planA.planState.formData.equipment.map(e => e.trim().toLowerCase())
    : []
  const eqB = Array.isArray(planB?.planState?.formData?.equipment)
    ? planB.planState.formData.equipment.map(e => e.trim().toLowerCase())
    : []

  const setA = new Set(eqA)
  const setB = new Set(eqB)

  const sharedEquipment = eqA.filter(e => setB.has(e))
  const uniqueEquipmentA = eqA.filter(e => !setB.has(e))
  const uniqueEquipmentB = eqB.filter(e => !setA.has(e))

  const goalA = planA?.planState?.formData?.mainGoal?.trim().toLowerCase() || ''
  const goalB = planB?.planState?.formData?.mainGoal?.trim().toLowerCase() || ''
  const goalMatch = Boolean(goalA && goalB && goalA === goalB)

  const levelA = planA?.planState?.formData?.fitnessLevel?.trim().toLowerCase() || ''
  const levelB = planB?.planState?.formData?.fitnessLevel?.trim().toLowerCase() || ''
  const levelMatch = Boolean(levelA && levelB && levelA === levelB)

  const factualSummary = goalMatch
    ? `Both plans target "${planA?.planState?.formData?.mainGoal || 'Fitness'}" with ${timePerDayLabel.toLowerCase()}.`
    : `Comparing "${planA?.planState?.formData?.mainGoal || 'Plan A'}" vs "${planB?.planState?.formData?.mainGoal || 'Plan B'}" (${timePerDayLabel.toLowerCase()}).`

  return {
    planAName,
    planBName,
    timePerDayDeltaMinutes,
    timePerDayLabel,
    sharedEquipment,
    uniqueEquipmentA,
    uniqueEquipmentB,
    goalMatch,
    levelMatch,
    factualSummary
  }
}
