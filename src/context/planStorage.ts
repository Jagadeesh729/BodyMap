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
