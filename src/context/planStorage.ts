import { PlanState, initialState } from './PlanContext'
import { hasSafetySensitiveMedicalIssues } from '../lib/validation'
import { getActiveAllergenCategories } from '../lib/allergenGuard'

export const STORAGE_KEY = 'bodymap_plan_v2'

/**
 * Returns true if the restored boundProfile disagrees with formData on a
 * safety-critical field (medical issues or allergen categories).
 *
 * This detects partially-corrupt or write-ordering-race persisted state
 * so that the binding evaluator is not given a stale boundProfile that
 * would suppress the Workout Safety Lockout.
 *
 * NOTE: A complete rollback where both formData AND boundProfile are
 * replaced with an older identical-safe snapshot cannot be detected
 * client-side without a server-authoritative reference. That is the
 * documented residual architectural boundary.
 */
function isBoundProfileSafetyDiverged(
  formDataMedical: string,
  formDataAllergies: string,
  boundMedical: string,
  boundAllergies: string,
): boolean {
  // Medical divergence: strings differ AND at least one side has active constraints
  const medicalDiverged =
    formDataMedical.trim().toLowerCase() !== boundMedical.trim().toLowerCase() &&
    (hasSafetySensitiveMedicalIssues(formDataMedical) || hasSafetySensitiveMedicalIssues(boundMedical))

  // Allergen divergence: active allergen category sets differ
  const currentAllergens = getActiveAllergenCategories(formDataAllergies).sort().join(',')
  const boundAllergens = getActiveAllergenCategories(boundAllergies).sort().join(',')
  const allergenDiverged = currentAllergens !== boundAllergens

  return medicalDiverged || allergenDiverged
}

/**
 * Pure production storage loader for PlanState.
 * Recovers safely from malformed JSON or corrupted storage payloads.
 *
 * Safety invariant: If the restored boundProfile disagrees with formData on
 * any safety-critical field (medical issues, allergen categories), boundProfile
 * is cleared. This forces evaluatePlanProfileBinding into the null-boundProfile
 * branch, which correctly triggers the Workout Safety Lockout for any user
 * who currently has active medical or allergen constraints.
 */
export function loadPersistedState(): PlanState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<PlanState>
      if (parsed && typeof parsed === 'object') {
        const restoredFormData = {
          ...initialState.formData,
          ...(parsed.formData || {}),
        }

        const rawBoundProfile =
          parsed.boundProfile && typeof parsed.boundProfile === 'object'
            ? { ...initialState.formData, ...parsed.boundProfile }
            : undefined

        // Safety-divergence guard: discard boundProfile if it disagrees with
        // formData on a safety-critical field (partial corruption / race condition).
        const safeBoundProfile: typeof rawBoundProfile =
          rawBoundProfile &&
          isBoundProfileSafetyDiverged(
            restoredFormData.medicalIssues ?? '',
            restoredFormData.allergies ?? '',
            rawBoundProfile.medicalIssues ?? '',
            rawBoundProfile.allergies ?? '',
          )
            ? undefined
            : rawBoundProfile

        return {
          ...initialState,
          ...parsed,
          formData: restoredFormData,
          planId: typeof parsed.planId === 'string' ? parsed.planId : undefined,
          planGeneratedAt: typeof parsed.planGeneratedAt === 'number' ? parsed.planGeneratedAt : undefined,
          boundProfile: safeBoundProfile,
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
