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
 * Normalizes a tag string into its canonical compact hashtag form without leading '#' or whitespace.
 * E.g., 'Solid Pump' -> 'solidpump', '#SolidPump' -> 'solidpump', '###Solid Pump' -> 'solidpump'.
 */
export function normalizeTagForSearch(tag: string): string {
  if (!tag || typeof tag !== 'string') return ''
  return tag.trim().replace(/^#+/, '').replace(/\s+/g, '').toLowerCase()
}

/**
 * Checks if a single reflection tag matches the search query.
 * Supports:
 * - Direct substring match against raw tag (case-insensitive)
 * - Hashtag syntax matching (e.g., '#SolidPump' matches 'Solid Pump')
 * - Compact tag matching without spaces (e.g., 'SolidPump' matches 'Solid Pump')
 * - Queries with leading '#' (e.g., '#Solid', '#Pump', '###SolidPump')
 * - Lone '#' or '##' matching any valid non-empty reflection tag
 */
export function matchesReflectionTag(tag: string, query: string): boolean {
  if (!tag || typeof tag !== 'string' || !query || typeof query !== 'string') {
    return false
  }

  const rawTagLower = tag.trim().toLowerCase()
  const rawQueryLower = query.trim().toLowerCase()
  if (rawTagLower.length === 0 || rawQueryLower.length === 0) {
    return false
  }

  // Exact or substring match on raw tag (e.g. "solid pump" matches "solid pump" or "pump")
  if (rawTagLower.includes(rawQueryLower)) {
    return true
  }

  // If query is exclusively '#' characters (e.g. '#', '##'), matches any non-empty reflection tag
  const strippedQuery = rawQueryLower.replace(/^#+/, '').trim()
  if (strippedQuery.length === 0 && rawQueryLower.startsWith('#')) {
    return true
  }

  // Check compact forms without whitespace (e.g. 'Solid Pump' -> 'solidpump')
  const compactTag = rawTagLower.replace(/\s+/g, '')
  const compactQuery = strippedQuery.replace(/\s+/g, '')

  if (compactQuery.length > 0 && compactTag.includes(compactQuery)) {
    return true
  }

  // Check presentation hashtag form (e.g., '#solidpump') against raw query
  const hashtagTag = `#${compactTag}`
  if (hashtagTag.includes(rawQueryLower)) {
    return true
  }

  return false
}

/**
 * Checks if session reflection notes match the search query.
 * Supports:
 * - Freeform substring match (case-insensitive)
 * - Whitespace-collapsed matching for multiple consecutive spaces
 * - Leading '#' queries matching words in notes
 * - Unicode and punctuation tolerance
 */
export function matchesReflectionNote(notes: string | undefined | null, query: string): boolean {
  if (!notes || typeof notes !== 'string' || !query || typeof query !== 'string') {
    return false
  }

  const rawNotesLower = notes.trim().toLowerCase()
  const rawQueryLower = query.trim().toLowerCase()
  if (rawNotesLower.length === 0 || rawQueryLower.length === 0) {
    return false
  }

  // Direct substring match
  if (rawNotesLower.includes(rawQueryLower)) {
    return true
  }

  // If query or notes have multiple consecutive spaces, normalize and check
  const normalizedSpacesQuery = rawQueryLower.replace(/\s+/g, ' ')
  const normalizedSpacesNotes = rawNotesLower.replace(/\s+/g, ' ')
  if (normalizedSpacesNotes.includes(normalizedSpacesQuery)) {
    return true
  }

  // If query starts with '#' and notes contains the word
  if (rawQueryLower.startsWith('#')) {
    const strippedQuery = rawQueryLower.replace(/^#+/, '').trim()
    if (strippedQuery.length > 0 && (
      rawNotesLower.includes(strippedQuery) ||
      normalizedSpacesNotes.includes(strippedQuery.replace(/\s+/g, ' '))
    )) {
      return true
    }
  }

  return false
}

/**
 * Deterministically filters, searches, and sorts user workout history.
 *
 * Contracts:
 * - Pure function: does not mutate the input array or its objects.
 * - Tolerates null/undefined/empty input safely.
 * - Search query matches dayTitle, dayType, exercise names, reflection tags, or reflection notes.
 * - Reflection tags support hashtag syntax (#SolidPump, SolidPump, solid pump).
 * - Never searches unrelated fields, IDs, timestamps, or arbitrary serialized metadata.
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

  const rawQuery = typeof options.searchQuery === 'string' ? options.searchQuery : ''
  const normalizedQuery = rawQuery.trim().toLowerCase()
  const normalizedSpacesQuery = normalizedQuery.replace(/\s+/g, ' ')

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
      const hasTags = Array.isArray(ref?.reflectionTags) && ref!.reflectionTags.length > 0
      const hasNotes = typeof ref?.notes === 'string' && ref!.notes.trim().length > 0
      if (!ref || (!ref.energyRating && !ref.perceivedReadiness && !hasTags && !hasNotes)) {
        return false
      }
    }

    // Search query matching
    if (normalizedQuery.length > 0) {
      const titleLower = (log.dayTitle || '').toLowerCase()
      const typeLower = (log.dayType || '').toLowerCase()

      const matchesTitle = titleLower.includes(normalizedQuery) ||
        titleLower.replace(/\s+/g, ' ').includes(normalizedSpacesQuery)

      const matchesType = typeLower.includes(normalizedQuery) ||
        typeLower.replace(/\s+/g, ' ').includes(normalizedSpacesQuery)

      const matchesExercises = Array.isArray(log.exercisesSummary) &&
        log.exercisesSummary.some(ex => {
          if (!ex || typeof ex.name !== 'string') return false
          const exLower = ex.name.toLowerCase()
          return exLower.includes(normalizedQuery) ||
            exLower.replace(/\s+/g, ' ').includes(normalizedSpacesQuery)
        })

      const matchesTags = Array.isArray(log.sessionReflection?.reflectionTags) &&
        log.sessionReflection!.reflectionTags!.some(t => matchesReflectionTag(t, rawQuery))

      const matchesNotes = matchesReflectionNote(log.sessionReflection?.notes, rawQuery)

      if (!matchesTitle && !matchesType && !matchesExercises && !matchesTags && !matchesNotes) {
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
