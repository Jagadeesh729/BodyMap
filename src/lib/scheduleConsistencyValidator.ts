import type { DayPlan } from '@/types/plan'

export interface ScheduleConsistencyIssue {
  severity: 'advisory' | 'warning'
  title: string
  description: string
}

export interface ScheduleConsistencyResult {
  isConsistent: boolean
  totalTrainingDays: number
  totalRestDays: number
  consecutiveTrainingDaysMax: number
  issues: ScheduleConsistencyIssue[]
  summaryLabel: string
}

/**
 * Deterministically analyzes a 7-day training plan for schedule consistency,
 * rest day distribution, and consecutive training day clusters.
 *
 * NON-MEDICAL HEURISTIC:
 * Provides non-medical planning heuristics for general athletic recovery.
 * Never issues clinical diagnoses or medical requirements.
 */
export function validateScheduleConsistency(days: DayPlan[]): ScheduleConsistencyResult {
  if (!Array.isArray(days) || days.length === 0) {
    return {
      isConsistent: true,
      totalTrainingDays: 0,
      totalRestDays: 0,
      consecutiveTrainingDaysMax: 0,
      issues: [],
      summaryLabel: 'No training days scheduled.'
    }
  }

  let totalTrainingDays = 0
  let totalRestDays = 0
  let currentConsecutive = 0
  let consecutiveTrainingDaysMax = 0

  const issues: ScheduleConsistencyIssue[] = []

  for (const day of days) {
    const isRest = Boolean(day.isRest || (day.type && day.type.toLowerCase().includes('rest')) || (day.type && day.type.toLowerCase().includes('recovery')))

    if (isRest) {
      totalRestDays++
      currentConsecutive = 0
    } else {
      totalTrainingDays++
      currentConsecutive++
      if (currentConsecutive > consecutiveTrainingDaysMax) {
        consecutiveTrainingDaysMax = currentConsecutive
      }
    }
  }

  // Check for 7 consecutive training days with 0 rest
  if (totalRestDays === 0 && totalTrainingDays >= 6) {
    issues.push({
      severity: 'advisory',
      title: 'Zero Rest Days Scheduled',
      description: 'Consider programming at least 1 active recovery or rest day per week for muscle tissue recovery.'
    })
  }

  // Check for more than 4 consecutive training days
  if (consecutiveTrainingDaysMax >= 5) {
    issues.push({
      severity: 'advisory',
      title: 'High Consecutive Training Density',
      description: `${consecutiveTrainingDaysMax} consecutive workout days detected without an intermittent recovery day.`
    })
  }

  const isConsistent = issues.length === 0
  const summaryLabel = isConsistent
    ? `Balanced ${totalTrainingDays}-day split with ${totalRestDays} recovery day${totalRestDays === 1 ? '' : 's'}.`
    : `${totalTrainingDays} training days, ${totalRestDays} rest days (${issues.length} recovery advisory).`

  return {
    isConsistent,
    totalTrainingDays,
    totalRestDays,
    consecutiveTrainingDaysMax,
    issues,
    summaryLabel
  }
}
