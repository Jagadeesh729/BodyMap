import type { CompletedWorkoutLog } from '@/types/workoutSession'

export interface WorkoutHistoryFilterOptions {
  dayIndex?: number | 'all'
  searchQuery?: string
  minSets?: number
  hasReflectionOnly?: boolean
  sortBy?: 'newest' | 'oldest' | 'duration' | 'sets'
}

export interface FilteredWorkoutHistoryResult {
  totalCount: number
  filteredCount: number
  logs: CompletedWorkoutLog[]
  uniqueDays: Array<{ dayIndex: number; dayTitle: string; count: number }>
}

/**
 * Deterministically filters, searches, and sorts user workout history.
 *
 * Contracts:
 * - Pure function: does not mutate the input array.
 * - Tolerates null/undefined/empty input safely.
 * - Search query matches dayTitle, dayType, exercise names, or reflection tags case-insensitively.
 * - Preserves all properties of CompletedWorkoutLog unmodified.
 */
export function filterWorkoutHistory(
  history: CompletedWorkoutLog[],
  options: WorkoutHistoryFilterOptions = {}
): FilteredWorkoutHistoryResult {
  if (!Array.isArray(history) || history.length === 0) {
    return {
      totalCount: 0,
      filteredCount: 0,
      logs: [],
      uniqueDays: []
    }
  }

  // Calculate unique days and counts across total history
  const dayMap = new Map<number, { dayIndex: number; dayTitle: string; count: number }>()
  for (const log of history) {
    if (log && typeof log.dayIndex === 'number') {
      const existing = dayMap.get(log.dayIndex)
      if (existing) {
        existing.count++
      } else {
        dayMap.set(log.dayIndex, {
          dayIndex: log.dayIndex,
          dayTitle: log.dayTitle || `Day ${log.dayIndex + 1}`,
          count: 1
        })
      }
    }
  }
  const uniqueDays = Array.from(dayMap.values()).sort((a, b) => a.dayIndex - b.dayIndex)

  const normalizedQuery = typeof options.searchQuery === 'string'
    ? options.searchQuery.trim().toLowerCase()
    : ''

  let result = history.filter(log => {
    if (!log || typeof log !== 'object') return false

    // Filter by dayIndex
    if (typeof options.dayIndex === 'number' && options.dayIndex >= 0) {
      if (log.dayIndex !== options.dayIndex) return false
    }

    // Filter by minSets
    if (typeof options.minSets === 'number' && options.minSets > 0) {
      if ((log.totalSetsCompleted || 0) < options.minSets) return false
    }

    // Filter by hasReflectionOnly
    if (options.hasReflectionOnly) {
      const ref = log.sessionReflection
      if (!ref || (!ref.energyRating && !ref.perceivedReadiness && (!ref.reflectionTags || ref.reflectionTags.length === 0))) {
        return false
      }
    }

    // Search query matching
    if (normalizedQuery.length > 0) {
      const matchesTitle = (log.dayTitle || '').toLowerCase().includes(normalizedQuery)
      const matchesType = (log.dayType || '').toLowerCase().includes(normalizedQuery)
      const matchesExercises = Array.isArray(log.exercisesSummary) &&
        log.exercisesSummary.some(ex => (ex.name || '').toLowerCase().includes(normalizedQuery))
      const matchesTags = Array.isArray(log.sessionReflection?.reflectionTags) &&
        log.sessionReflection!.reflectionTags!.some(t => (t || '').toLowerCase().includes(normalizedQuery))

      if (!matchesTitle && !matchesType && !matchesExercises && !matchesTags) {
        return false
      }
    }

    return true
  })

  // Sort results
  const sortBy = options.sortBy || 'newest'
  result = [...result].sort((a, b) => {
    if (sortBy === 'oldest') {
      const timeA = new Date(a.completedAt).getTime()
      const timeB = new Date(b.completedAt).getTime()
      return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB)
    } else if (sortBy === 'duration') {
      return (b.durationSeconds || 0) - (a.durationSeconds || 0)
    } else if (sortBy === 'sets') {
      return (b.totalSetsCompleted || 0) - (a.totalSetsCompleted || 0)
    } else {
      // Default: newest first
      const timeA = new Date(a.completedAt).getTime()
      const timeB = new Date(b.completedAt).getTime()
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA)
    }
  })

  return {
    totalCount: history.length,
    filteredCount: result.length,
    logs: result,
    uniqueDays
  }
}
