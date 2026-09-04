import { PlanState, initialState } from './PlanContext'

export const STORAGE_KEY = 'bodymap_plan_v2'

/**
 * Pure production storage loader for PlanState.
 * Recovers safely from malformed JSON or corrupted storage payloads.
 */
export function loadPersistedState(): PlanState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<PlanState>
      if (parsed && typeof parsed === 'object') {
        return {
          ...initialState,
          ...parsed,
          formData: {
            ...initialState.formData,
            ...(parsed.formData || {}),
          },
          planId: typeof parsed.planId === 'string' ? parsed.planId : undefined,
          planGeneratedAt: typeof parsed.planGeneratedAt === 'number' ? parsed.planGeneratedAt : undefined,
          boundProfile: parsed.boundProfile && typeof parsed.boundProfile === 'object'
            ? { ...initialState.formData, ...parsed.boundProfile }
            : undefined,
          weightLog: Array.isArray(parsed.weightLog)
            ? parsed.weightLog.filter((entry): entry is { date: string; weight: number } =>
                Boolean(entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).date === 'string' && typeof (entry as Record<string, unknown>).weight === 'number' && !isNaN((entry as { weight: number }).weight))
              )
            : initialState.weightLog,
          completedDays: Array.isArray(parsed.completedDays)
            ? parsed.completedDays.filter((entry): entry is { date: string; dayIndex: number } =>
                Boolean(entry && typeof entry === 'object' && typeof (entry as Record<string, unknown>).date === 'string' && typeof (entry as Record<string, unknown>).dayIndex === 'number')
              )
            : initialState.completedDays,
        }

      }
    }
  } catch {
    // Malformed JSON or private browsing storage access exception
  }
  return initialState
}

/**
 * Pure production storage saver for PlanState.
 */
export function savePersistedState(state: PlanState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    // QuotaExceededError or storage disabled
    return false
  }
}
