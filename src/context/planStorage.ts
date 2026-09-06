import { PlanState, initialState, StateVersion } from './PlanContext'
import { hasSafetySensitiveMedicalIssues } from '../lib/validation'
import { getActiveAllergenCategories } from '../lib/allergenGuard'
import { computeProfileFingerprint } from '../lib/planBinding'

export const STORAGE_KEY = 'bodymap_plan_v2'

/**
 * Returns a persistent or newly initialized unique writer ID for this browser tab instance.
 * Stored in sessionStorage so it persists across page reloads in the same tab,
 * but differs across different tabs.
 */
export function getTabWriterId(): string {
  if (typeof window === 'undefined') return 'server_instance'
  try {
    let id = sessionStorage.getItem('bodymap_tab_id')
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      id = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      sessionStorage.setItem('bodymap_tab_id', id)
    }
    return id
  } catch {
    return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }
}

/**
 * Total ordering comparison function for StateVersion tuples: (counter, timestamp, writerId).
 *
 * Rules:
 *   1. Primary: logical Lamport counter (higher counter wins).
 *   2. Secondary: physical timestamp tie-breaker for concurrent equal-counter writes.
 *   3. Tertiary: writerId tie-breaker (lexicographical total order) to ensure deterministic
 *      agreement between tabs even in the same millisecond.
 *
 * Returns:
 *   > 0 if a is strictly newer than b
 *   < 0 if a is strictly older than b
 *   === 0 if a and b are identical or both missing
 */
export function compareVersions(a?: StateVersion | null, b?: StateVersion | null): number {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1

  // 1. Primary: logical Lamport counter
  if (a.counter !== b.counter) {
    return a.counter - b.counter
  }

  // 2. Secondary: physical timestamp
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp
  }

  // 3. Tertiary: writerId tie-breaker
  if (a.writerId < b.writerId) return -1
  if (a.writerId > b.writerId) return 1
  return 0
}

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
export function isBoundProfileSafetyDiverged(
  formDataMedical: string,
  formDataAllergies: string,
  boundMedical: string,
  boundAllergies: string
): boolean {
  const medicalDiverged =
    formDataMedical.trim().toLowerCase() !== boundMedical.trim().toLowerCase() &&
    (hasSafetySensitiveMedicalIssues(formDataMedical) || hasSafetySensitiveMedicalIssues(boundMedical))
  const currentAllergens = getActiveAllergenCategories(formDataAllergies).sort().join(',')
  const boundAllergens = getActiveAllergenCategories(boundAllergies).sort().join(',')
  const allergenDiverged = currentAllergens !== boundAllergens
  return medicalDiverged || allergenDiverged
}

/**
 * Sanitizes untrusted form data objects into canonical, prototype-safe FormData.
 * Extracts only explicit known fields and enforces length/item bounds to prevent
 * memory amplification and prototype pollution.
 */
export function sanitizeFormData(raw: unknown): FormData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...initialState.formData }
  }
  const r = raw as Record<string, unknown>

  const sanitizeString = (val: unknown, maxLen = 50): string => {
    if (typeof val !== 'string') return ''
    return val.trim().slice(0, maxLen)
  }

  const sanitizeArray = (val: unknown, maxItems = 50, maxItemLen = 50): string[] => {
    if (!Array.isArray(val)) return []
    const out: string[] = []
    for (const item of val) {
      if (typeof item === 'string') {
        const clean = item.trim().slice(0, maxItemLen)
        if (clean.length > 0 && out.length < maxItems) {
          out.push(clean)
        }
      }
    }
    return out
  }

  return {
    age: sanitizeString(r.age, 20),
    gender: sanitizeString(r.gender, 30),
    height: sanitizeString(r.height, 20),
    weight: sanitizeString(r.weight, 20),
    fitnessLevel: sanitizeString(r.fitnessLevel, 50),
    mainGoal: sanitizeString(r.mainGoal, 50),
    bodyFocus: sanitizeArray(r.bodyFocus, 50, 50),
    timePerDay: sanitizeString(r.timePerDay, 20),
    medicalIssues: sanitizeString(r.medicalIssues, 1000),
    equipment: sanitizeArray(r.equipment, 50, 50),
    pushupCount: sanitizeString(r.pushupCount, 20),
    dietaryPreference: sanitizeString(r.dietaryPreference, 100),
    allergies: sanitizeString(r.allergies, 1000),
    specialRequests: sanitizeString(r.specialRequests, 1000),
    recoveryDays: sanitizeString(r.recoveryDays, 30),
    sleepHours: sanitizeString(r.sleepHours, 20),
    stressLevel: sanitizeString(r.stressLevel, 30),
  }
}

/**
 * Validates and extracts a safe StateVersion object from parsed JSON.
 * Returns undefined if missing, malformed, non-numeric, or non-finite.
 */
export function extractSafeVersion(raw: unknown): StateVersion | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const v = raw as Record<string, unknown>
  if (
    typeof v.counter !== 'number' ||
    !Number.isFinite(v.counter) ||
    !Number.isSafeInteger(v.counter) ||
    v.counter <= 0 ||
    v.counter > 1e9 ||
    typeof v.timestamp !== 'number' ||
    !Number.isFinite(v.timestamp) ||
    v.timestamp <= 0 ||
    v.timestamp > Date.now() + 86400000 ||
    typeof v.writerId !== 'string' ||
    v.writerId.trim().length === 0 ||
    v.writerId.length > 128
  ) {
    return undefined
  }
  return {
    counter: Math.floor(v.counter),
    timestamp: v.timestamp,
    writerId: v.writerId.trim(),
  }
}

/**
 * Validates, sanitizes, and reconstructs a PlanState from an untrusted parsed object.
 * Enforces canonical schema bounds, boundProfile integrity, and safety-divergence checks.
 * Returns null if the input is not a valid non-null plain object.
 */
export function buildSafeState(parsed: Partial<PlanState> | unknown): PlanState | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const raw = parsed as Record<string, unknown>

  // 1. Sanitize formData
  const restoredFormData = sanitizeFormData(raw.formData)

  // 2. Sanitize boundProfile
  let safeBoundProfile: FormData | undefined = undefined
  if (raw.boundProfile !== undefined && raw.boundProfile !== null) {
    if (typeof raw.boundProfile === 'object') {
      const sanitizedBound = sanitizeFormData(raw.boundProfile)
      // Check safety divergence
      if (
        !isBoundProfileSafetyDiverged(
          restoredFormData.medicalIssues,
          restoredFormData.allergies,
          sanitizedBound.medicalIssues,
          sanitizedBound.allergies,
        )
      ) {
        safeBoundProfile = sanitizedBound
      }
    }
  }

  // 3. Bound Profile Fingerprint verification:
  if (safeBoundProfile && raw.boundProfileFingerprint !== undefined) {
    if (
      typeof raw.boundProfileFingerprint !== 'string' ||
      raw.boundProfileFingerprint.trim().length === 0 ||
      computeProfileFingerprint(safeBoundProfile) !== raw.boundProfileFingerprint.trim()
    ) {
      safeBoundProfile = undefined
    }
  }

  const safeFingerprint = safeBoundProfile
    ? (typeof raw.boundProfileFingerprint === 'string' && raw.boundProfileFingerprint.trim().length > 0
        ? raw.boundProfileFingerprint.trim()
        : computeProfileFingerprint(safeBoundProfile))
    : undefined

  // 4. Safe Version
  const safeVersion = extractSafeVersion(raw.stateVersion)

  // 5. Plan identity & generation timestamp
  const safePlanId = typeof raw.planId === 'string' && raw.planId.trim().length > 0
    ? raw.planId.trim().slice(0, 128)
    : undefined

  const safePlanGeneratedAt = typeof raw.planGeneratedAt === 'number' &&
    Number.isFinite(raw.planGeneratedAt) &&
    raw.planGeneratedAt > 0 &&
    raw.planGeneratedAt <= Date.now() + 86400000
      ? raw.planGeneratedAt
      : undefined

  // 6. Generated plan string (cap at 250,000 chars)
  const safeGeneratedPlan = typeof raw.generatedPlan === 'string'
    ? raw.generatedPlan.slice(0, 250000)
    : ''

  // 7. Weight Log (cap at 1000 entries, safe numeric weight)
  const safeWeightLog: WeightEntry[] = Array.isArray(raw.weightLog)
    ? (raw.weightLog as unknown[])
        .filter((entry): entry is { date: string; weight: number } =>
          Boolean(
            entry &&
            typeof entry === 'object' &&
            typeof (entry as Record<string, unknown>).date === 'string' &&
            typeof (entry as Record<string, unknown>).weight === 'number' &&
            Number.isFinite((entry as { weight: number }).weight) &&
            (entry as { weight: number }).weight >= 0 &&
            (entry as { weight: number }).weight <= 1000
          )
        )
        .slice(0, 1000)
    : initialState.weightLog

  // 8. Completed Days (cap at 1000 entries, dayIndex 0..6)
  const safeCompletedDays: CompletedDay[] = Array.isArray(raw.completedDays)
    ? (raw.completedDays as unknown[])
        .filter((entry): entry is { date: string; dayIndex: number } =>
          Boolean(
            entry &&
            typeof entry === 'object' &&
            typeof (entry as Record<string, unknown>).date === 'string' &&
            typeof (entry as Record<string, unknown>).dayIndex === 'number' &&
            Number.isSafeInteger((entry as { dayIndex: number }).dayIndex) &&
            (entry as { dayIndex: number }).dayIndex >= 0 &&
            (entry as { dayIndex: number }).dayIndex <= 6
          )
        )
        .slice(0, 1000)
    : initialState.completedDays

  return {
    ...initialState,
    formData: restoredFormData,
    generatedPlan: safeGeneratedPlan,
    isGenerated: Boolean(raw.isGenerated),
    planId: safePlanId,
    planGeneratedAt: safePlanGeneratedAt,
    stateVersion: safeVersion,
    boundProfile: safeBoundProfile,
    boundProfileFingerprint: safeFingerprint,
    weightLog: safeWeightLog,
    completedDays: safeCompletedDays,
  }
}

/** Canonical alias for buildSafeState */
export const sanitizePlanState = buildSafeState

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
      const built = buildSafeState(parsed)
      if (built) return built
    }
  } catch {
    // Malformed JSON or private browsing storage access exception
  }
  return initialState
}

/**
 * Parses and validates an arbitrary raw JSON string into a safe PlanState.
 * Used by the cross-tab StorageEvent handler so that incoming state from
 * another tab goes through exactly the same safety-divergence validation
 * as normal localStorage load.
 *
 * Returns null if the raw string is null, empty, malformed JSON, or produces
 * an invalid/unsafe state object. Callers MUST treat null as fail-closed
 * (do not update React state from an invalid cross-tab payload).
 */
export function parseSafeIncomingState(rawJson: string | null): PlanState | null {
  if (!rawJson) return null
  try {
    const parsed = JSON.parse(rawJson) as Partial<PlanState>
    return buildSafeState(parsed)
  } catch {
    return null
  }
}

/**
 * Advanced production saver that returns both the boolean success flag and the
 * newly generated StateVersion.
 *
 * Lamport advancement rule:
 *   Reads the current storage counter so that even if the calling tab missed
 *   intervening writes, the new write is strictly higher than any previously
 *   committed write in localStorage.
 */
export function savePersistedStateWithVersion(
  state: PlanState,
  customWriterId?: string
): { success: boolean; version?: StateVersion } {
  try {
    let highestObservedCounter = state.stateVersion?.counter ?? 0
    try {
      const existingRaw = localStorage.getItem(STORAGE_KEY)
      if (existingRaw) {
        const existing = JSON.parse(existingRaw) as Partial<PlanState>
        const existingVer = extractSafeVersion(existing?.stateVersion)
        if (existingVer) {
          highestObservedCounter = Math.max(highestObservedCounter, existingVer.counter)
        }
      }
    } catch {
      // Ignore read errors
    }

    const nextCounter = highestObservedCounter + 1
    const nextVersion: StateVersion = {
      counter: nextCounter,
      timestamp: Date.now(),
      writerId: customWriterId || getTabWriterId(),
    }

    const boundFingerprint = state.boundProfile
      ? (state.boundProfileFingerprint || computeProfileFingerprint(state.boundProfile))
      : undefined

    const payload: PlanState = {
      ...state,
      boundProfileFingerprint: boundFingerprint,
      stateVersion: nextVersion,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return { success: true, version: nextVersion }
  } catch {
    return { success: false }
  }
}

/**
 * Standard production storage saver for PlanState.
 * Preserves the original boolean return signature for full backward compatibility.
 */
export function savePersistedState(state: PlanState): boolean {
  return savePersistedStateWithVersion(state).success
}
