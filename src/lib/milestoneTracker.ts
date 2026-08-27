import type { CompletedWorkoutLog } from '@/types/workoutSession'
import type { CompletedDay } from '@/context/PlanContext'
import type { SavedPlan } from '@/types/savedPlan'

export interface Milestone {
  id: string
  title: string
  description: string
  category: 'workouts' | 'sets' | 'streak' | 'plans'
  threshold: number
  currentValue: number
  isUnlocked: boolean
  progressPercent: number
}

/**
 * Calculates verified training milestones deterministically from authoritative history.
 * No vanity metrics or arbitrary gamification.
 */
export function calculateMilestones(
  workoutHistory: CompletedWorkoutLog[] = [],
  completedDays: CompletedDay[] = [],
  currentStreak: number = 0,
  savedPlans: SavedPlan[] = []
): Milestone[] {
  const totalWorkouts = Math.max(workoutHistory.length, completedDays.length)
  const totalSets = workoutHistory.reduce((sum, log) => sum + (log.totalSetsCompleted || 0), 0)
  const totalPlans = savedPlans.length

  const definitions = [
    // Workouts
    { id: 'wo_1', title: 'First Session', description: '1 workout completed in Gym Mode', category: 'workouts' as const, threshold: 1, current: totalWorkouts },
    { id: 'wo_5', title: '5 Workouts', description: '5 verified training sessions completed', category: 'workouts' as const, threshold: 5, current: totalWorkouts },
    { id: 'wo_10', title: '10 Workouts', description: '10 verified training sessions completed', category: 'workouts' as const, threshold: 10, current: totalWorkouts },
    { id: 'wo_25', title: '25 Workouts', description: '25 verified training sessions completed', category: 'workouts' as const, threshold: 25, current: totalWorkouts },
    { id: 'wo_50', title: '50 Workouts', description: '50 verified training sessions completed', category: 'workouts' as const, threshold: 50, current: totalWorkouts },

    // Sets
    { id: 'set_25', title: '25 Sets Logged', description: '25 dynamic exercise sets recorded', category: 'sets' as const, threshold: 25, current: totalSets },
    { id: 'set_50', title: '50 Sets Logged', description: '50 dynamic exercise sets recorded', category: 'sets' as const, threshold: 50, current: totalSets },
    { id: 'set_100', title: '100 Sets Logged', description: '100 dynamic exercise sets recorded', category: 'sets' as const, threshold: 100, current: totalSets },
    { id: 'set_250', title: '250 Sets Logged', description: '250 dynamic exercise sets recorded', category: 'sets' as const, threshold: 250, current: totalSets },

    // Streak
    { id: 'strk_3', title: '3-Day Consistency', description: '3 consecutive calendar days trained', category: 'streak' as const, threshold: 3, current: currentStreak },
    { id: 'strk_7', title: '7-Day Consistency', description: '7 consecutive calendar days trained', category: 'streak' as const, threshold: 7, current: currentStreak },
    { id: 'strk_14', title: '14-Day Consistency', description: '14 consecutive calendar days trained', category: 'streak' as const, threshold: 14, current: currentStreak },

    // Plans
    { id: 'plan_1', title: 'Plan Saved', description: '1 custom training split saved to local library', category: 'plans' as const, threshold: 1, current: totalPlans },
    { id: 'plan_3', title: 'Routine Builder', description: '3 custom training splits saved to local library', category: 'plans' as const, threshold: 3, current: totalPlans }
  ]

  return definitions.map(def => {
    const isUnlocked = def.current >= def.threshold
    const progressPercent = Math.min(100, Math.round((def.current / def.threshold) * 100))
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      category: def.category,
      threshold: def.threshold,
      currentValue: def.current,
      isUnlocked,
      progressPercent
    }
  })
}
