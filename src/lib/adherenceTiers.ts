import type { CompletedWorkoutLog } from '@/types/workoutSession'

export type AdherenceTierName = 'Diamond' | 'Gold' | 'Silver' | 'Bronze' | 'Starter'

export interface AdherenceTierResult {
  tier: AdherenceTierName
  consecutiveWeeks: number
  badgeEmoji: string
  tierColor: string
  tierLabel: string
  nextMilestoneWeeks: number
  progressPercent: number
  summary: string
}

/**
 * Deterministically calculates milestone adherence tiers from workout completion history.
 * Strictly uses authentic history without fabricating completion days.
 * Accepts the canonical CompletedWorkoutLog contract and reads completedAt for date bucketing.
 */
export function calculateAdherenceTier(
  workoutHistory: CompletedWorkoutLog[] | null | undefined
): AdherenceTierResult {
  if (!Array.isArray(workoutHistory) || workoutHistory.length === 0) {
    return {
      tier: 'Starter',
      consecutiveWeeks: 0,
      badgeEmoji: '🌱',
      tierColor: 'text-gray-400 border-gray-700 bg-gray-800/40',
      tierLabel: 'Starter (Week 0)',
      nextMilestoneWeeks: 1,
      progressPercent: 0,
      summary: 'Complete your first workout to unlock Bronze Tier.'
    }
  }

  // Calculate unique weeks with completed workouts
  const now = new Date()
  const activeWeeks = new Set<number>()

  for (const item of workoutHistory) {
    if (!item || !item.completedAt) continue
    const d = new Date(item.completedAt)
    if (isNaN(d.getTime())) continue

    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays >= 0 && diffDays < 90) { // Look back up to ~12 weeks
      const weekIdx = Math.floor(diffDays / 7)
      activeWeeks.add(weekIdx)
    }
  }

  // Count consecutive active weeks starting from week 0
  let consecutiveWeeks = 0
  while (activeWeeks.has(consecutiveWeeks)) {
    consecutiveWeeks++
  }

  // If no workout in the last 7 days but history exists, check if previous week was active
  if (consecutiveWeeks === 0 && activeWeeks.has(1)) {
    consecutiveWeeks = 1
  }

  let tier: AdherenceTierName = 'Starter'
  let badgeEmoji = '🌱'
  let tierColor = 'text-gray-400 border-gray-700 bg-gray-800/40'
  let nextMilestoneWeeks = 1
  let progressPercent = 0

  if (consecutiveWeeks >= 9) {
    tier = 'Diamond'
    badgeEmoji = '💎'
    tierColor = 'text-cyan-400 border-cyan-500/40 bg-cyan-950/30'
    nextMilestoneWeeks = 12
    progressPercent = 100
  } else if (consecutiveWeeks >= 5) {
    tier = 'Gold'
    badgeEmoji = '🥇'
    tierColor = 'text-amber-400 border-amber-500/40 bg-amber-950/30'
    nextMilestoneWeeks = 9
    progressPercent = Math.round((consecutiveWeeks / 9) * 100)
  } else if (consecutiveWeeks >= 3) {
    tier = 'Silver'
    badgeEmoji = '🥈'
    tierColor = 'text-slate-300 border-slate-400/40 bg-slate-800/40'
    nextMilestoneWeeks = 5
    progressPercent = Math.round((consecutiveWeeks / 5) * 100)
  } else if (consecutiveWeeks >= 1) {
    tier = 'Bronze'
    badgeEmoji = '🥉'
    tierColor = 'text-amber-600 border-amber-700/40 bg-amber-950/20'
    nextMilestoneWeeks = 3
    progressPercent = Math.round((consecutiveWeeks / 3) * 100)
  }

  return {
    tier,
    consecutiveWeeks,
    badgeEmoji,
    tierColor,
    tierLabel: `${badgeEmoji} ${tier} Tier (${consecutiveWeeks} Week${consecutiveWeeks === 1 ? '' : 's'})`,
    nextMilestoneWeeks,
    progressPercent,
    summary: `${consecutiveWeeks} consecutive week${consecutiveWeeks === 1 ? '' : 's'} with verified workout sessions.`
  }
}

