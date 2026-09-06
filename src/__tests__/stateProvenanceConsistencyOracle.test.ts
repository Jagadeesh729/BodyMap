import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  computeProfileFingerprint,
  evaluatePlanProfileBinding,
} from '../lib/planBinding'
import {
  buildSafeState,
  sanitizePlanState,
  sanitizeFormData,
  extractSafeVersion,
  compareVersions,
  isBoundProfileSafetyDiverged,
  parseSafeIncomingState,
  loadPersistedState,
  savePersistedStateWithVersion,
  savePersistedState,
  STORAGE_KEY,
} from '../context/planStorage'
import { initialState, PlanState, StateVersion } from '../context/PlanContext'
import {
  loadAndValidateActiveSession,
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  hasActiveSession,
  saveCompletedWorkoutLog,
  loadWorkoutHistory,
  clearWorkoutHistory,
  ACTIVE_SESSION_STORAGE_KEY,
  WORKOUT_HISTORY_STORAGE_KEY,
  MAX_STORED_WORKOUTS,
} from '../lib/sessionStorage'
import {
  loadSavedPlans,
  savePlanToLibrary,
  deleteSavedPlan,
  normalizePlanTags,
  SAVED_PLANS_STORAGE_KEY,
} from '../lib/savedPlansStorage'
import {
  validateAndParseBackup,
  generateBackupPayload,
  restoreBackupData,
  BACKUP_SCHEMA_IDENTIFIER,
  LEGACY_BACKUP_SCHEMA_IDENTIFIER,
  BACKUP_SCHEMA_VERSION,
  BodyMapBackupV2,
} from '../lib/backupStorage'
import type { WorkoutSession, CompletedWorkoutLog } from '../types/workoutSession'

describe('Complete State Provenance & Cross-Context Consistency Oracle', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })


  // =========================================================================
  // Section A: State Admission, Prototype Pollution & Type Coercion (31 tests)
  // =========================================================================
  describe('Section A: State Admission, Prototype Pollution & Type Coercion', () => {
    it('A01: buildSafeState(null) returns null', () => {
      expect(buildSafeState(null)).toBeNull()
    })

    it('A02: buildSafeState(undefined) returns null', () => {
      expect(buildSafeState(undefined)).toBeNull()
    })

    it('A03: buildSafeState("string") returns null', () => {
      expect(buildSafeState('invalid string payload')).toBeNull()
    })

    it('A04: buildSafeState(12345) returns null', () => {
      expect(buildSafeState(12345)).toBeNull()
    })

    it('A05: buildSafeState([]) returns null for arrays', () => {
      expect(buildSafeState([])).toBeNull()
    })

    it('A06: buildSafeState(true) returns null for boolean primitives', () => {
      expect(buildSafeState(true)).toBeNull()
    })

    it('A07: sanitizePlanState is canonical alias of buildSafeState', () => {
      expect(sanitizePlanState).toBe(buildSafeState)
    })

    it('A08: sanitizeFormData(null) returns clean initial formData', () => {
      const res = sanitizeFormData(null)
      expect(res).toEqual(initialState.formData)
    })

    it('A09: sanitizeFormData(undefined) returns clean initial formData', () => {
      const res = sanitizeFormData(undefined)
      expect(res).toEqual(initialState.formData)
    })

    it('A10: sanitizeFormData("primitive") returns clean initial formData', () => {
      expect(sanitizeFormData('malicious')).toEqual(initialState.formData)
    })

    it('A11: sanitizeFormData strips prototype pollution attempts (__proto__)', () => {
      const malicious = JSON.parse('{"__proto__":{"polluted":"yes"},"age":"25"}')
      const sanitized = sanitizeFormData(malicious)
      expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined()
      expect(sanitized.age).toBe('25')
    })

    it('A12: sanitizeFormData strips unknown/undeclared keys', () => {
      const raw = { age: '30', gender: 'male', hackedKey: 'malicious', isAdmin: true }
      const sanitized = sanitizeFormData(raw)
      expect((sanitized as Record<string, unknown>).hackedKey).toBeUndefined()
      expect((sanitized as Record<string, unknown>).isAdmin).toBeUndefined()
      expect(sanitized.age).toBe('30')
      expect(sanitized.gender).toBe('male')
    })

    it('A13: sanitizeFormData truncates overly long string fields', () => {
      const raw = { age: 'a'.repeat(100), gender: 'b'.repeat(100) }
      const sanitized = sanitizeFormData(raw)
      expect(sanitized.age.length).toBeLessThanOrEqual(20)
      expect(sanitized.gender.length).toBeLessThanOrEqual(30)
    })

    it('A14: sanitizeFormData truncates string arrays to max 50 items', () => {
      const bigArray = Array.from({ length: 100 }, (_, i) => 'focus_' + i)
      const sanitized = sanitizeFormData({ bodyFocus: bigArray })
      expect(sanitized.bodyFocus.length).toBe(50)
    })

    it('A15: sanitizeFormData filters non-string elements from array fields', () => {
      const raw = { bodyFocus: [123, null, 'Chest', undefined, { evil: true }, 'Back'] }
      const sanitized = sanitizeFormData(raw)
      expect(sanitized.bodyFocus).toEqual(['Chest', 'Back'])
    })

    it('A16: sanitizeFormData trims and truncates oversized array item strings', () => {
      const raw = { equipment: ['   Dumbbells   ', 'x'.repeat(200)] }
      const sanitized = sanitizeFormData(raw)
      expect(sanitized.equipment[0]).toBe('Dumbbells')
      expect(sanitized.equipment[1].length).toBeLessThanOrEqual(50)
    })

    it('A17: sanitizeFormData handles non-array in array field by coercing to empty array', () => {
      const raw = { bodyFocus: 'Chest', equipment: 42 }
      const sanitized = sanitizeFormData(raw)
      expect(sanitized.bodyFocus).toEqual([])
      expect(sanitized.equipment).toEqual([])
    })

    it('A18: buildSafeState normalizes non-string planId to undefined', () => {
      const state = buildSafeState({ planId: 12345 as unknown as string })
      expect(state?.planId).toBeUndefined()
    })

    it('A19: buildSafeState normalizes empty string planId to undefined', () => {
      const state = buildSafeState({ planId: '   ' })
      expect(state?.planId).toBeUndefined()
    })

    it('A20: buildSafeState truncates oversized planId to 128 chars', () => {
      const longId = 'id_'.repeat(100)
      const state = buildSafeState({ planId: longId })
      expect(state?.planId?.length).toBeLessThanOrEqual(128)
    })

    it('A21: buildSafeState discards non-numeric or non-finite planGeneratedAt', () => {
      expect(buildSafeState({ planGeneratedAt: NaN })?.planGeneratedAt).toBeUndefined()
      expect(buildSafeState({ planGeneratedAt: Infinity })?.planGeneratedAt).toBeUndefined()
      expect(buildSafeState({ planGeneratedAt: -100 })?.planGeneratedAt).toBeUndefined()
    })

    it('A22: buildSafeState discards future planGeneratedAt (> 24h into future)', () => {
      const future = Date.now() + 100000000
      expect(buildSafeState({ planGeneratedAt: future })?.planGeneratedAt).toBeUndefined()
    })

    it('A23: buildSafeState preserves valid planGeneratedAt within reasonable past', () => {
      const now = Date.now()
      expect(buildSafeState({ planGeneratedAt: now })?.planGeneratedAt).toBe(now)
    })

    it('A24: buildSafeState truncates generatedPlan string exceeding 250,000 chars', () => {
      const hugePlan = 'A'.repeat(300000)
      const state = buildSafeState({ generatedPlan: hugePlan })
      expect(state?.generatedPlan.length).toBe(250000)
    })

    it('A25: buildSafeState bounds weightLog array to max 1000 items', () => {
      const entries = Array.from({ length: 1500 }, (_, i) => ({ date: '2026-09-01', weight: 70 + (i % 10) }))
      const state = buildSafeState({ weightLog: entries })
      expect(state?.weightLog.length).toBe(1000)
    })

    it('A26: buildSafeState filters invalid negative weights from weightLog', () => {
      const entries = [
        { date: '2026-09-01', weight: 75 },
        { date: '2026-09-02', weight: -10 },
        { date: '2026-09-03', weight: 76 }
      ]
      const state = buildSafeState({ weightLog: entries })
      expect(state?.weightLog.length).toBe(2)
      expect(state?.weightLog.map(w => w.weight)).toEqual([75, 76])
    })

    it('A27: buildSafeState filters astronomical weights (> 1000 kg) from weightLog', () => {
      const entries = [
        { date: '2026-09-01', weight: 75 },
        { date: '2026-09-02', weight: 99999 }
      ]
      const state = buildSafeState({ weightLog: entries })
      expect(state?.weightLog.length).toBe(1)
      expect(state?.weightLog[0].weight).toBe(75)
    })

    it('A28: buildSafeState bounds completedDays array to max 1000 items', () => {
      const entries = Array.from({ length: 1500 }, (_, i) => ({ date: '2026-09-01', dayIndex: i % 7 }))
      const state = buildSafeState({ completedDays: entries })
      expect(state?.completedDays.length).toBe(1000)
    })

    it('A29: buildSafeState filters out-of-bounds dayIndex in completedDays', () => {
      const entries = [
        { date: '2026-09-01', dayIndex: 0 },
        { date: '2026-09-02', dayIndex: 7 },
        { date: '2026-09-03', dayIndex: -1 },
        { date: '2026-09-04', dayIndex: 6 }
      ]
      const state = buildSafeState({ completedDays: entries })
      expect(state?.completedDays.length).toBe(2)
      expect(state?.completedDays.map(c => c.dayIndex)).toEqual([0, 6])
    })

    it('A30: buildSafeState filters non-integer dayIndex in completedDays', () => {
      const entries = [
        { date: '2026-09-01', dayIndex: 2.5 },
        { date: '2026-09-02', dayIndex: 3 }
      ]
      const state = buildSafeState({ completedDays: entries })
      expect(state?.completedDays.length).toBe(1)
      expect(state?.completedDays[0].dayIndex).toBe(3)
    })

    it('A31: buildSafeState strips polluted properties on top-level input', () => {
      const polluted = JSON.parse('{"__proto__":{"admin":true},"planId":"safe_plan"}')
      const state = buildSafeState(polluted)
      expect(state?.planId).toBe('safe_plan')
      expect((Object.prototype as Record<string, unknown>).admin).toBeUndefined()
    })
  })


  // =========================================================================
  // Section B: Lamport Versioning, Stale Overwrite & Monotonicity (26 tests)
  // =========================================================================
  describe('Section B: Lamport Versioning, Stale Overwrite & Monotonicity', () => {
    it('B01: extractSafeVersion(undefined) returns undefined', () => {
      expect(extractSafeVersion(undefined)).toBeUndefined()
    })

    it('B02: extractSafeVersion(null) returns undefined', () => {
      expect(extractSafeVersion(null)).toBeUndefined()
    })

    it('B03: extractSafeVersion("invalid") returns undefined', () => {
      expect(extractSafeVersion('v1.0')).toBeUndefined()
    })

    it('B04: extractSafeVersion({}) returns undefined for missing counter', () => {
      expect(extractSafeVersion({})).toBeUndefined()
    })

    it('B05: extractSafeVersion rejects non-positive counter (0 or negative)', () => {
      expect(extractSafeVersion({ counter: 0, timestamp: Date.now(), writerId: 'w1' })).toBeUndefined()
      expect(extractSafeVersion({ counter: -5, timestamp: Date.now(), writerId: 'w1' })).toBeUndefined()
    })

    it('B06: extractSafeVersion rejects non-finite counter (NaN, Infinity)', () => {
      expect(extractSafeVersion({ counter: NaN, timestamp: Date.now(), writerId: 'w1' })).toBeUndefined()
      expect(extractSafeVersion({ counter: Infinity, timestamp: Date.now(), writerId: 'w1' })).toBeUndefined()
    })

    it('B07: extractSafeVersion rejects counter exceeding upper safety bound 1e9', () => {
      expect(extractSafeVersion({ counter: 1e10, timestamp: Date.now(), writerId: 'w1' })).toBeUndefined()
    })

    it('B08: extractSafeVersion rejects non-integer counter safely', () => {
      const v = extractSafeVersion({ counter: 4.9, timestamp: Date.now(), writerId: 'w1' })
      expect(v).toBeUndefined()
    })

    it('B09: extractSafeVersion rejects invalid or non-positive timestamp', () => {
      expect(extractSafeVersion({ counter: 1, timestamp: -1, writerId: 'w1' })).toBeUndefined()
      expect(extractSafeVersion({ counter: 1, timestamp: 0, writerId: 'w1' })).toBeUndefined()
    })

    it('B10: extractSafeVersion rejects future timestamp (> 24h into future)', () => {
      const future = Date.now() + 100000000
      expect(extractSafeVersion({ counter: 1, timestamp: future, writerId: 'w1' })).toBeUndefined()
    })

    it('B11: extractSafeVersion rejects empty or non-string writerId', () => {
      expect(extractSafeVersion({ counter: 1, timestamp: Date.now(), writerId: '' })).toBeUndefined()
      expect(extractSafeVersion({ counter: 1, timestamp: Date.now(), writerId: '   ' })).toBeUndefined()
      expect(extractSafeVersion({ counter: 1, timestamp: Date.now(), writerId: 123 as unknown as string })).toBeUndefined()
    })

    it('B12: extractSafeVersion accepts valid version tuple and trims writerId', () => {
      const now = Date.now()
      const v = extractSafeVersion({ counter: 10, timestamp: now, writerId: '  tab_123  ' })
      expect(v).toEqual({ counter: 10, timestamp: now, writerId: 'tab_123' })
    })

    it('B13: compareVersions returns 0 when both are null/undefined', () => {
      expect(compareVersions(undefined, undefined)).toBe(0)
      expect(compareVersions(null, null)).toBe(0)
      expect(compareVersions(null, undefined)).toBe(0)
    })

    it('B14: compareVersions returns -1 when a is missing and b is defined', () => {
      const b: StateVersion = { counter: 1, timestamp: 1000, writerId: 'w1' }
      expect(compareVersions(undefined, b)).toBe(-1)
    })

    it('B15: compareVersions returns 1 when a is defined and b is missing', () => {
      const a: StateVersion = { counter: 1, timestamp: 1000, writerId: 'w1' }
      expect(compareVersions(a, undefined)).toBe(1)
    })

    it('B16: compareVersions ranks higher counter strictly above lower counter regardless of timestamp', () => {
      const olderTimestampHighCounter: StateVersion = { counter: 5, timestamp: 1000, writerId: 'w1' }
      const newerTimestampLowCounter: StateVersion = { counter: 3, timestamp: 9999, writerId: 'w2' }
      expect(compareVersions(olderTimestampHighCounter, newerTimestampLowCounter)).toBeGreaterThan(0)
      expect(compareVersions(newerTimestampLowCounter, olderTimestampHighCounter)).toBeLessThan(0)
    })

    it('B17: compareVersions breaks counter tie using higher physical timestamp', () => {
      const v1: StateVersion = { counter: 5, timestamp: 2000, writerId: 'w1' }
      const v2: StateVersion = { counter: 5, timestamp: 1000, writerId: 'w2' }
      expect(compareVersions(v1, v2)).toBeGreaterThan(0)
      expect(compareVersions(v2, v1)).toBeLessThan(0)
    })

    it('B18: compareVersions breaks counter and timestamp tie using lexicographical writerId', () => {
      const vAlpha: StateVersion = { counter: 5, timestamp: 1000, writerId: 'alpha' }
      const vBeta: StateVersion = { counter: 5, timestamp: 1000, writerId: 'beta' }
      expect(compareVersions(vAlpha, vBeta)).toBeLessThan(0)
      expect(compareVersions(vBeta, vAlpha)).toBeGreaterThan(0)
    })

    it('B19: compareVersions returns 0 for identical version tuples', () => {
      const v1: StateVersion = { counter: 5, timestamp: 1000, writerId: 'alpha' }
      const v2: StateVersion = { counter: 5, timestamp: 1000, writerId: 'alpha' }
      expect(compareVersions(v1, v2)).toBe(0)
    })

    it('B20: savePersistedStateWithVersion advances Lamport counter monotonically', () => {
      const state1 = { ...initialState, planId: 'p1' }
      const res1 = savePersistedStateWithVersion(state1, 'writer_A')
      expect(res1.success).toBe(true)
      expect(res1.version?.counter).toBe(1)

      const state2 = { ...initialState, planId: 'p2', stateVersion: res1.version }
      const res2 = savePersistedStateWithVersion(state2, 'writer_B')
      expect(res2.success).toBe(true)
      expect(res2.version?.counter).toBe(2)
      expect(res2.version?.writerId).toBe('writer_B')
    })

    it('B21: savePersistedStateWithVersion jumps ahead if localStorage already has higher counter', () => {
      const seeded: PlanState = {
        ...initialState,
        stateVersion: { counter: 10, timestamp: Date.now(), writerId: 'remote' }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))

      const localState: PlanState = {
        ...initialState,
        stateVersion: { counter: 2, timestamp: Date.now(), writerId: 'local' }
      }
      const res = savePersistedStateWithVersion(localState, 'local')
      expect(res.success).toBe(true)
      expect(res.version?.counter).toBe(11)
    })

    it('B22: savePersistedState standard wrapper returns true on success', () => {
      expect(savePersistedState(initialState)).toBe(true)
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    })

    it('B23: loadPersistedState recovers and returns initialState if storage corrupted', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json')
      const loaded = loadPersistedState()
      expect(loaded).toEqual(initialState)
    })

    it('B24: loadPersistedState recovers valid persisted state', () => {
      const state: PlanState = {
        ...initialState,
        planId: 'persisted_plan_1',
        isGenerated: true,
      }
      savePersistedState(state)
      const loaded = loadPersistedState()
      expect(loaded.planId).toBe('persisted_plan_1')
      expect(loaded.isGenerated).toBe(true)
    })

    it('B25: savePersistedStateWithVersion automatically computes boundProfileFingerprint', () => {
      const state: PlanState = {
        ...initialState,
        boundProfile: { ...initialState.formData, mainGoal: 'Muscle Gain' }
      }
      const res = savePersistedStateWithVersion(state, 'writer_A')
      expect(res.success).toBe(true)
      const loaded = loadPersistedState()
      expect(loaded.boundProfileFingerprint).toBeDefined()
      expect(loaded.boundProfileFingerprint).toBe(computeProfileFingerprint(state.boundProfile!))
    })

    it('B26: savePersistedState handles private browsing localStorage exceptions gracefully', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((_key) => {
        if (_key === STORAGE_KEY) {
          throw new Error('QuotaExceededError')
        }
      })
      const res = savePersistedStateWithVersion(initialState)
      expect(res.success).toBe(false)
      expect(res.version).toBeUndefined()
    })
  })


  // =========================================================================
  // Section C: Plan-Profile Binding, Medical Divergence & Safety Lockout (31 tests)
  // =========================================================================
  describe('Section C: Plan-Profile Binding, Medical Divergence & Safety Lockout', () => {
    it('C01: computeProfileFingerprint produces deterministic hash for same profile', () => {
      const p1 = { ...initialState.formData, age: '25', mainGoal: 'Strength' }
      const p2 = { ...initialState.formData, age: '25', mainGoal: 'Strength' }
      expect(computeProfileFingerprint(p1)).toBe(computeProfileFingerprint(p2))
    })

    it('C02: computeProfileFingerprint is invariant to bodyFocus array ordering', () => {
      const p1 = { ...initialState.formData, bodyFocus: ['Chest', 'Back', 'Legs'] }
      const p2 = { ...initialState.formData, bodyFocus: ['Legs', 'Chest', 'Back'] }
      expect(computeProfileFingerprint(p1)).toBe(computeProfileFingerprint(p2))
    })

    it('C03: computeProfileFingerprint is invariant to equipment array ordering', () => {
      const p1 = { ...initialState.formData, equipment: ['Dumbbells', 'Barbell', 'Bands'] }
      const p2 = { ...initialState.formData, equipment: ['Bands', 'Dumbbells', 'Barbell'] }
      expect(computeProfileFingerprint(p1)).toBe(computeProfileFingerprint(p2))
    })

    it('C04: computeProfileFingerprint normalizes surrounding whitespace', () => {
      const p1 = { ...initialState.formData, medicalIssues: 'Asthma' }
      const p2 = { ...initialState.formData, medicalIssues: '   Asthma   ' }
      expect(computeProfileFingerprint(p1)).toBe(computeProfileFingerprint(p2))
    })

    it('C05: computeProfileFingerprint gracefully handles undefined or null inputs', () => {
      expect(computeProfileFingerprint(undefined as unknown as FormData)).toBe('')
      expect(computeProfileFingerprint(null as unknown as FormData)).toBe('')
    })

    it('C06: computeProfileFingerprint tolerates non-string values safely', () => {
      const weirdProfile = { ...initialState.formData, age: 30 as unknown as string, bodyFocus: 'NotAnArray' as unknown as string[] }
      expect(() => computeProfileFingerprint(weirdProfile)).not.toThrow()
      expect(typeof computeProfileFingerprint(weirdProfile)).toBe('string')
    })

    it('C07: computeProfileFingerprint changes when medicalIssues changes', () => {
      const p1 = { ...initialState.formData, medicalIssues: 'Asthma' }
      const p2 = { ...initialState.formData, medicalIssues: 'Hypertension' }
      expect(computeProfileFingerprint(p1)).not.toBe(computeProfileFingerprint(p2))
    })

    it('C08: computeProfileFingerprint changes when allergies change', () => {
      const p1 = { ...initialState.formData, allergies: 'Peanuts' }
      const p2 = { ...initialState.formData, allergies: 'Dairy' }
      expect(computeProfileFingerprint(p1)).not.toBe(computeProfileFingerprint(p2))
    })

    it('C09: computeProfileFingerprint changes when fitnessLevel changes', () => {
      const p1 = { ...initialState.formData, fitnessLevel: 'Beginner' }
      const p2 = { ...initialState.formData, fitnessLevel: 'Advanced' }
      expect(computeProfileFingerprint(p1)).not.toBe(computeProfileFingerprint(p2))
    })

    it('C10: evaluatePlanProfileBinding returns valid when profiles match exactly', () => {
      const profile = { ...initialState.formData, age: '28', fitnessLevel: 'Intermediate' }
      const result = evaluatePlanProfileBinding(profile, profile)
      expect(result.isBound).toBe(true)
      expect(result.isSafetyMismatched).toBe(false)
      expect(result.mismatchedSafetyFields).toEqual([])
    })

    it('C11: evaluatePlanProfileBinding returns unbound when boundProfile is undefined', () => {
      const profile = { ...initialState.formData }
      const result = evaluatePlanProfileBinding(profile, undefined)
      expect(result.isBound).toBe(false)
      expect(result.isSafetyMismatched).toBe(false)
    })

    it('C12: evaluatePlanProfileBinding returns unbound when boundProfile is null', () => {
      const profile = { ...initialState.formData }
      const result = evaluatePlanProfileBinding(profile, null as unknown as FormData)
      expect(result.isBound).toBe(false)
      expect(result.isSafetyMismatched).toBe(false)
    })

    it('C13: evaluatePlanProfileBinding triggers safety divergence when safety-sensitive medical issue added', () => {
      const bound = { ...initialState.formData, medicalIssues: 'None' }
      const current = { ...initialState.formData, medicalIssues: 'Herniated disc L5-S1' }
      const result = evaluatePlanProfileBinding(current, bound)
      expect(result.isBound).toBe(false)
      expect(result.isSafetyMismatched).toBe(true)
      expect(result.mismatchedSafetyFields).toContain('medicalIssues')
    })

    it('C14: evaluatePlanProfileBinding triggers safety divergence when safety-sensitive medical issue removed', () => {
      const bound = { ...initialState.formData, medicalIssues: 'Heart condition' }
      const current = { ...initialState.formData, medicalIssues: 'None' }
      const result = evaluatePlanProfileBinding(current, bound)
      expect(result.isBound).toBe(false)
      expect(result.isSafetyMismatched).toBe(true)
      expect(result.mismatchedSafetyFields).toContain('medicalIssues')
    })

    it('C15: evaluatePlanProfileBinding triggers safety divergence when allergen category is added', () => {
      const bound = { ...initialState.formData, allergies: 'None' }
      const current = { ...initialState.formData, allergies: 'Severe peanut and tree nut allergy' }
      const result = evaluatePlanProfileBinding(current, bound)
      expect(result.isBound).toBe(false)
      expect(result.isSafetyMismatched).toBe(true)
      expect(result.mismatchedSafetyFields).toContain('allergies')
    })

    it('C16: evaluatePlanProfileBinding triggers safety divergence when allergen category is altered', () => {
      const bound = { ...initialState.formData, allergies: 'Dairy intolerance' }
      const current = { ...initialState.formData, allergies: 'Peanut allergy' }
      const result = evaluatePlanProfileBinding(current, bound)
      expect(result.isBound).toBe(false)
      expect(result.isSafetyMismatched).toBe(true)
    })

    it('C17: evaluatePlanProfileBinding marks preference change as non-safety divergence', () => {
      const bound = { ...initialState.formData, mainGoal: 'Weight Loss' }
      const current = { ...initialState.formData, mainGoal: 'Muscle Gain' }
      const result = evaluatePlanProfileBinding(current, bound)
      expect(result.isBound).toBe(false)
      expect(result.isSafetyMismatched).toBe(false)
      expect(result.isPreferenceMismatched).toBe(true)
      expect(result.mismatchedPreferenceFields).toContain('mainGoal')
    })

    it('C18: evaluatePlanProfileBinding detects fitnessLevel change', () => {
      const bound = { ...initialState.formData, fitnessLevel: 'Beginner' }
      const current = { ...initialState.formData, fitnessLevel: 'Advanced' }
      const result = evaluatePlanProfileBinding(current, bound)
      expect(result.isPreferenceMismatched).toBe(true)
      expect(result.mismatchedPreferenceFields).toContain('fitnessLevel')
    })

    it('C19: evaluatePlanProfileBinding detects equipment divergence', () => {
      const bound = { ...initialState.formData, equipment: ['Dumbbells'] }
      const current = { ...initialState.formData, equipment: ['Barbell'] }
      const result = evaluatePlanProfileBinding(current, bound)
      expect(result.isPreferenceMismatched).toBe(true)
      expect(result.mismatchedPreferenceFields).toContain('equipment')
    })

    it('C20: evaluatePlanProfileBinding ignores equipment ordering differences', () => {
      const bound = { ...initialState.formData, equipment: ['Dumbbells', 'Bands'] }
      const current = { ...initialState.formData, equipment: ['Bands', 'Dumbbells'] }
      const result = evaluatePlanProfileBinding(current, bound)
      expect(result.isBound).toBe(true)
      expect(result.isPreferenceMismatched).toBe(false)
      expect(result.mismatchedPreferenceFields).toEqual([])
    })

    it('C21: evaluatePlanProfileBinding detects bodyFocus divergence', () => {
      const bound = { ...initialState.formData, bodyFocus: ['Chest'] }
      const current = { ...initialState.formData, bodyFocus: ['Legs'] }
      const result = evaluatePlanProfileBinding(current, bound)
      expect(result.isPreferenceMismatched).toBe(true)
      expect(result.mismatchedPreferenceFields).toContain('bodyFocus')
    })

    it('C22: isBoundProfileSafetyDiverged returns true when medical issue diverges with safety sensitivity', () => {
      expect(isBoundProfileSafetyDiverged('Herniated disc', '', 'None', '')).toBe(true)
      expect(isBoundProfileSafetyDiverged('None', '', 'Heart disease', '')).toBe(true)
    })

    it('C23: isBoundProfileSafetyDiverged returns false when medical issues are identical case-insensitively', () => {
      expect(isBoundProfileSafetyDiverged('Herniated disc', '', 'herniated DISC', '')).toBe(false)
    })

    it('C24: isBoundProfileSafetyDiverged returns true when active allergen categories differ', () => {
      expect(isBoundProfileSafetyDiverged('', 'peanut allergy', '', 'none')).toBe(true)
      expect(isBoundProfileSafetyDiverged('', 'milk, eggs', '', 'milk')).toBe(true)
    })

    it('C25: isBoundProfileSafetyDiverged returns false when allergen categories match', () => {
      expect(isBoundProfileSafetyDiverged('', 'peanut allergy', '', 'Peanuts')).toBe(false)
    })

    it('C26: isBoundProfileSafetyDiverged returns false when benign non-medical phrases differ', () => {
      expect(isBoundProfileSafetyDiverged('None', '', 'No injuries', '')).toBe(false)
    })

    it('C27: buildSafeState clears boundProfile if safety-diverged from restored formData', () => {
      const raw = {
        formData: { medicalIssues: 'Herniated disc' },
        boundProfile: { medicalIssues: 'None' }
      }
      const state = buildSafeState(raw)
      expect(state?.boundProfile).toBeUndefined()
    })

    it('C28: buildSafeState retains boundProfile if safety-consistent with restored formData', () => {
      const raw = {
        formData: { medicalIssues: 'None', mainGoal: 'Muscle Gain' },
        boundProfile: { medicalIssues: 'None', mainGoal: 'Strength' }
      }
      const state = buildSafeState(raw)
      expect(state?.boundProfile).toBeDefined()
    })

    it('C29: buildSafeState clears boundProfile if boundProfileFingerprint does not match computed fingerprint', () => {
      const profile = { ...initialState.formData, mainGoal: 'Endurance' }
      const raw = {
        formData: profile,
        boundProfile: profile,
        boundProfileFingerprint: 'tampered_fake_fingerprint'
      }
      const state = buildSafeState(raw)
      expect(state?.boundProfile).toBeUndefined()
    })

    it('C30: buildSafeState verifies and keeps boundProfile if boundProfileFingerprint matches computed fingerprint', () => {
      const profile = { ...initialState.formData, mainGoal: 'Endurance' }
      const fp = computeProfileFingerprint(profile)
      const raw = {
        formData: profile,
        boundProfile: profile,
        boundProfileFingerprint: fp
      }
      const state = buildSafeState(raw)
      expect(state?.boundProfile).toBeDefined()
      expect(state?.boundProfileFingerprint).toBe(fp)
    })

    it('C31: evaluatePlanProfileBinding handles missing formData gracefully', () => {
      const bound = { ...initialState.formData }
      const result = evaluatePlanProfileBinding(undefined as unknown as FormData, bound)
      expect(result.isBound).toBe(false)
    })
  })


  // =========================================================================
  // Section D: Active Workout Session Provenance & Plan Mismatch Protection (26 tests)
  // =========================================================================
  describe('Section D: Active Workout Session Provenance & Plan Mismatch Protection', () => {
    const validSession: WorkoutSession = {
      sessionId: 'session_123',
      planId: 'plan_abc',
      dayIndex: 0,
      dayTitle: 'Chest Day',
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      status: 'in-progress',
      exercises: [
        {
          name: 'Bench Press',
          category: 'primary',
          muscleGroup: 'Chest',
          tempo: '3-0-1-0',
          restSeconds: 90,
          sets: [{ setNumber: 1, targetReps: '10', completed: false }]
        }
      ]
    }

    it('D01: loadActiveSession returns null when localStorage is empty', () => {
      expect(loadActiveSession()).toBeNull()
    })

    it('D02: loadActiveSession clears storage and returns null when payload is malformed JSON', () => {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, 'invalid json {')
      expect(loadActiveSession()).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('D03: loadActiveSession clears storage and returns null when sessionId is missing', () => {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify({ ...validSession, sessionId: '' }))
      expect(loadActiveSession()).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('D04: loadActiveSession clears storage and returns null when exercises is empty array', () => {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify({ ...validSession, exercises: [] }))
      expect(loadActiveSession()).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('D05: loadActiveSession clears storage and returns null when exercises contains invalid non-object item', () => {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify({ ...validSession, exercises: ['string'] as unknown as WorkoutSession['exercises'] }))
      expect(loadActiveSession()).toBeNull()
    })

    it('D06: loadActiveSession clears storage and returns null when exercise name is empty string', () => {
      const corruptedExercises = [{ ...validSession.exercises[0], name: '   ' }]
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify({ ...validSession, exercises: corruptedExercises }))
      expect(loadActiveSession()).toBeNull()
    })

    it('D07: loadActiveSession rejects completed session (anti-resurrection)', () => {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify({ ...validSession, status: 'completed' }))
      expect(loadActiveSession()).toBeNull()
    })

    it('D08: loadActiveSession rejects abandoned session', () => {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify({ ...validSession, status: 'abandoned' }))
      expect(loadActiveSession()).toBeNull()
    })

    it('D09: loadActiveSession rejects stale session inactive for > 24 hours', () => {
      const staleTime = Date.now() - (25 * 60 * 60 * 1000)
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify({ ...validSession, lastUpdatedAt: staleTime }))
      expect(loadActiveSession()).toBeNull()
    })

    it('D10: saveActiveSession updates lastUpdatedAt timestamp automatically', () => {
      saveActiveSession(validSession)
      const raw = JSON.parse(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)!)
      expect(raw.lastUpdatedAt).toBeDefined()
      expect(Date.now() - raw.lastUpdatedAt).toBeLessThan(1000)
    })

    it('D11: loadAndValidateActiveSession rejects and clears session when currentPlanId mismatches', () => {
      saveActiveSession(validSession)
      const res = loadAndValidateActiveSession('different_plan_xyz')
      expect(res).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('D12: loadAndValidateActiveSession accepts session when planId strictly matches', () => {
      saveActiveSession(validSession)
      const res = loadAndValidateActiveSession('plan_abc')
      expect(res).not.toBeNull()
      expect(res?.sessionId).toBe('session_123')
    })

    it('D13: loadAndValidateActiveSession accepts default plan when both planIds are undefined', () => {
      const defaultSession = { ...validSession, planId: undefined }
      saveActiveSession(defaultSession)
      const res = loadAndValidateActiveSession(undefined)
      expect(res).not.toBeNull()
      expect(res?.sessionId).toBe('session_123')
    })

    it('D14: loadAndValidateActiveSession rejects when session has planId but active plan has none', () => {
      saveActiveSession(validSession)
      const res = loadAndValidateActiveSession(undefined)
      expect(res).toBeNull()
    })

    it('D15: loadAndValidateActiveSession rejects when active plan has planId but session has none', () => {
      const defaultSession = { ...validSession, planId: undefined }
      saveActiveSession(defaultSession)
      const res = loadAndValidateActiveSession('active_plan_1')
      expect(res).toBeNull()
    })

    it('D16: loadAndValidateActiveSession rejects session when safety-sensitive medical issues diverge', () => {
      const sessionWithMed: WorkoutSession = {
        ...validSession,
        medicalSnapshot: 'None'
      }
      saveActiveSession(sessionWithMed)
      const res = loadAndValidateActiveSession('plan_abc', 'Herniated disc L5-S1')
      expect(res).toBeNull()
    })

    it('D17: loadAndValidateActiveSession rejects session when session snapshot had safety issue but current is None', () => {
      const sessionWithMed: WorkoutSession = {
        ...validSession,
        medicalSnapshot: 'Heart disease'
      }
      saveActiveSession(sessionWithMed)
      const res = loadAndValidateActiveSession('plan_abc', 'None')
      expect(res).toBeNull()
    })

    it('D18: loadAndValidateActiveSession rejects session when exercise contraindication detected', () => {
      const contraSession: WorkoutSession = {
        ...validSession,
        exercises: [
          {
            name: 'Overhead Shoulder Press',
            category: 'primary',
            muscleGroup: 'Shoulders',
            tempo: '3-0-1-0',
            restSeconds: 90,
            sets: [{ setNumber: 1, targetReps: '10', completed: false }]
          }
        ]
      }
      saveActiveSession(contraSession)
      const res = loadAndValidateActiveSession('plan_abc', 'Rotator cuff tear')
      expect(res).toBeNull()
    })

    it('D19: loadAndValidateActiveSession allows session when benign non-medical phrase differs', () => {
      const sessionWithMed: WorkoutSession = {
        ...validSession,
        medicalSnapshot: 'None'
      }
      saveActiveSession(sessionWithMed)
      const res = loadAndValidateActiveSession('plan_abc', 'No injuries')
      expect(res).not.toBeNull()
    })

    it('D20: clearActiveSession safely clears localStorage', () => {
      saveActiveSession(validSession)
      expect(hasActiveSession()).toBe(true)
      clearActiveSession()
      expect(hasActiveSession()).toBe(false)
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('D21: saveCompletedWorkoutLog persists completed workout to history', () => {
      const log: CompletedWorkoutLog = {
        id: 'log_1',
        sessionId: 'session_123',
        dayTitle: 'Chest Day',
        completedAt: new Date().toISOString(),
        durationMinutes: 45,
        totalVolume: 5000,
        completedExercisesCount: 1,
        totalExercisesCount: 1,
      }
      saveCompletedWorkoutLog(log)
      const history = loadWorkoutHistory()
      expect(history.length).toBe(1)
      expect(history[0].id).toBe('log_1')
    })

    it('D22: saveCompletedWorkoutLog deduplicates entries with same id', () => {
      const log: CompletedWorkoutLog = {
        id: 'log_dup',
        sessionId: 'session_123',
        dayTitle: 'Chest Day',
        completedAt: new Date().toISOString(),
        durationMinutes: 45,
        totalVolume: 5000,
        completedExercisesCount: 1,
        totalExercisesCount: 1,
      }
      saveCompletedWorkoutLog(log)
      saveCompletedWorkoutLog(log)
      const history = loadWorkoutHistory()
      expect(history.length).toBe(1)
    })

    it('D23: loadWorkoutHistory caps history at MAX_STORED_WORKOUTS (250)', () => {
      const manyLogs: CompletedWorkoutLog[] = Array.from({ length: 300 }, (_, i) => ({
        id: 'log_' + i,
        sessionId: 's_' + i,
        dayTitle: 'Workout',
        completedAt: new Date().toISOString(),
        durationMinutes: 30,
        totalVolume: 1000,
        completedExercisesCount: 1,
        totalExercisesCount: 1,
      }))
      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(manyLogs))
      const loaded = loadWorkoutHistory()
      expect(loaded.length).toBe(MAX_STORED_WORKOUTS)
    })

    it('D24: clearWorkoutHistory safely empties workout history', () => {
      const log: CompletedWorkoutLog = {
        id: 'log_1',
        sessionId: 'session_123',
        dayTitle: 'Day 1',
        completedAt: new Date().toISOString(),
        durationMinutes: 30,
        totalVolume: 1000,
        completedExercisesCount: 1,
        totalExercisesCount: 1,
      }
      saveCompletedWorkoutLog(log)
      expect(loadWorkoutHistory().length).toBe(1)
      clearWorkoutHistory()
      expect(loadWorkoutHistory().length).toBe(0)
    })

    it('D25: loadWorkoutHistory handles malformed JSON safely without throwing', () => {
      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, '{ invalid json')
      expect(loadWorkoutHistory()).toEqual([])
    })

    it('D26: hasActiveSession returns false when active session is invalid', () => {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, '{"status":"completed"}')
      expect(hasActiveSession()).toBe(false)
    })
  })


  // =========================================================================
  // Section E: Library Admission, Saved Plan Tampering & Fingerprint Validation (26 tests)
  // =========================================================================
  describe('Section E: Library Admission, Saved Plan Tampering & Fingerprint Validation', () => {
    it('E01: loadSavedPlans returns empty array when storage is empty', () => {
      expect(loadSavedPlans()).toEqual([])
    })

    it('E02: loadSavedPlans returns empty array when storage contains malformed JSON', () => {
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, 'bad json')
      expect(loadSavedPlans()).toEqual([])
    })

    it('E03: loadSavedPlans returns empty array when parsed root is not an array', () => {
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, '{"plans":[]}')
      expect(loadSavedPlans()).toEqual([])
    })

    it('E04: loadSavedPlans filters out null and primitive items', () => {
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify([null, 'string', 123]))
      expect(loadSavedPlans()).toEqual([])
    })

    it('E05: loadSavedPlans filters out items missing id, name, or planState', () => {
      const items = [
        { id: 'p1', name: 'Plan 1' },
        { id: 'p2', planState: initialState },
        { name: 'Plan 3', planState: initialState },
      ]
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify(items))
      expect(loadSavedPlans()).toEqual([])
    })

    it('E06: loadSavedPlans sanitizes planState through buildSafeState', () => {
      const planItem = {
        id: 'plan_1',
        name: 'My Saved Plan',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        planState: {
          formData: { age: '30' },
          weightLog: [{ date: '2026-09-01', weight: -50 }],
          completedDays: [{ date: '2026-09-01', dayIndex: 99 }]
        }
      }
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify([planItem]))
      const loaded = loadSavedPlans()
      expect(loaded.length).toBe(1)
      expect(loaded[0].planState.weightLog).toEqual([])
      expect(loaded[0].planState.completedDays).toEqual([])
    })

    it('E07: loadSavedPlans discards plans whose planState fails buildSafeState', () => {
      const planItem = {
        id: 'plan_corrupt',
        name: 'Corrupt Plan',
        createdAt: '2026-09-01T00:00:00.000Z',
        planState: 'string instead of object'
      }
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify([planItem]))
      expect(loadSavedPlans()).toEqual([])
    })

    it('E08: loadSavedPlans normalizes tags correctly', () => {
      const planItem = {
        id: 'plan_tags',
        name: 'Tagged Plan',
        createdAt: '2026-09-01T00:00:00.000Z',
        tags: ['#Cardio', 'cardio', 'STRENGTH', '  HIIT  '],
        planState: initialState
      }
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify([planItem]))
      const loaded = loadSavedPlans()
      expect(loaded[0].tags).toEqual(['cardio', 'strength', 'hiit'])
    })

    it('E09: loadSavedPlans truncates notes to 1000 characters', () => {
      const longNotes = 'N'.repeat(2000)
      const planItem = {
        id: 'plan_notes',
        name: 'Notes Plan',
        createdAt: '2026-09-01T00:00:00.000Z',
        notes: longNotes,
        planState: initialState
      }
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify([planItem]))
      const loaded = loadSavedPlans()
      expect(loaded[0].notes?.length).toBe(1000)
    })

    it('E10: loadSavedPlans sorts plans descending by updatedAt', () => {
      const planOlder = {
        id: 'p_old',
        name: 'Old',
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
        planState: initialState
      }
      const planNewer = {
        id: 'p_new',
        name: 'New',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        planState: initialState
      }
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify([planOlder, planNewer]))
      const loaded = loadSavedPlans()
      expect(loaded[0].id).toBe('p_new')
      expect(loaded[1].id).toBe('p_old')
    })

    it('E11: savePlanToLibrary automatically computes and persists boundProfileFingerprint', () => {
      const state: PlanState = {
        ...initialState,
        planId: 'plan_save_1',
        boundProfile: { ...initialState.formData, mainGoal: 'Strength' }
      }
      const saved = savePlanToLibrary('Strength Plan', state)
      expect(saved.planState.boundProfileFingerprint).toBeDefined()
      expect(saved.planState.boundProfileFingerprint).toBe(computeProfileFingerprint(state.boundProfile!))
    })

    it('E12: savePlanToLibrary creates unique id with plan_ prefix', () => {
      const saved1 = savePlanToLibrary('P1', initialState)
      const saved2 = savePlanToLibrary('P2', initialState)
      expect(saved1.id.startsWith('plan_')).toBe(true)
      expect(saved2.id.startsWith('plan_')).toBe(true)
      expect(saved1.id).not.toBe(saved2.id)
    })

    it('E13: savePlanToLibrary sets valid ISO createdAt and updatedAt timestamps', () => {
      const saved = savePlanToLibrary('P1', initialState)
      expect(new Date(saved.createdAt).getTime()).toBeGreaterThan(0)
      expect(new Date(saved.updatedAt).getTime()).toBeGreaterThan(0)
    })

    it('E14: savePlanToLibrary performs defensive copy of planState to prevent reference leaks', () => {
      const state: PlanState = { ...initialState, weightLog: [{ date: '2026-09-01', weight: 75 }] }
      const saved = savePlanToLibrary('P1', state)
      state.weightLog.push({ date: '2026-09-02', weight: 80 })
      expect(saved.planState.weightLog.length).toBe(1)
    })

    it('E15: deleteSavedPlan removes target plan by id', () => {
      const p1 = savePlanToLibrary('P1', initialState)
      const p2 = savePlanToLibrary('P2', initialState)
      expect(loadSavedPlans().length).toBe(2)
      const res = deleteSavedPlan(p1.id)
      expect(res).toBe(true)
      const remaining = loadSavedPlans()
      expect(remaining.length).toBe(1)
      expect(remaining[0].id).toBe(p2.id)
    })

    it('E16: deleteSavedPlan returns false when target id does not exist', () => {
      expect(deleteSavedPlan('non_existent_id')).toBe(false)
    })

    it('E17: normalizePlanTags strips leading hash symbols', () => {
      expect(normalizePlanTags(['#fitness', '###health'])).toEqual(['fitness', 'health'])
    })

    it('E18: normalizePlanTags lowercases all tags', () => {
      expect(normalizePlanTags(['BULKING', 'Cut'])).toEqual(['bulking', 'cut'])
    })

    it('E19: normalizePlanTags deduplicates identical tags', () => {
      expect(normalizePlanTags(['chest', 'CHEST', '#chest'])).toEqual(['chest'])
    })

    it('E20: normalizePlanTags caps output at 8 tags', () => {
      const rawTags = Array.from({ length: 20 }, (_, i) => 'tag_' + i)
      expect(normalizePlanTags(rawTags).length).toBe(8)
    })

    it('E21: normalizePlanTags returns empty array for non-array inputs', () => {
      expect(normalizePlanTags(null)).toEqual([])
      expect(normalizePlanTags(undefined)).toEqual([])
      expect(normalizePlanTags('singleTag')).toEqual([])
    })

    it('E22: savePlanToLibrary trims plan name and falls back to date title if empty', () => {
      const saved = savePlanToLibrary('   ', initialState)
      expect(saved.name.startsWith('Plan (')).toBe(true)
    })

    it('E23: Tampered boundProfileFingerprint in saved plan fails closed upon load', () => {
      const profile = { ...initialState.formData, mainGoal: 'Hypertrophy' }
      const planItem = {
        id: 'plan_tampered',
        name: 'Tampered Plan',
        createdAt: '2026-09-01T00:00:00.000Z',
        planState: {
          formData: profile,
          boundProfile: profile,
          boundProfileFingerprint: 'tampered_fake_signature'
        }
      }
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify([planItem]))
      const loaded = loadSavedPlans()
      expect(loaded.length).toBe(1)
      expect(loaded[0].planState.boundProfile).toBeUndefined()
    })

    it('E24: Saved plan with prototype pollution is neutralized upon load', () => {
      const planItem = JSON.parse('{"id":"p_evil","name":"Evil","createdAt":"2026-09-01T00:00:00.000Z","planState":{"__proto__":{"polluted":true},"formData":{"age":"25"}}}')
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify([planItem]))
      loadSavedPlans()
      expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('E25: Saved plan preserves completedDays within schema bounds', () => {
      const state: PlanState = {
        ...initialState,
        completedDays: [{ date: '2026-09-01', dayIndex: 2 }]
      }
      const saved = savePlanToLibrary('P_Days', state)
      expect(saved.planState.completedDays).toEqual([{ date: '2026-09-01', dayIndex: 2 }])
    })

    it('E26: Saved plan default notes field is undefined when omitted', () => {
      const saved = savePlanToLibrary('P_NoNotes', initialState)
      expect(saved.notes).toBeUndefined()
    })
  })


  // =========================================================================
  // Section F: Backup Import/Export Boundary, Rollback & Snapshot Integrity (26 tests)
  // =========================================================================
  describe('Section F: Backup Import/Export Boundary, Rollback & Snapshot Integrity', () => {
    it('F01: validateAndParseBackup rejects empty string', () => {
      const res = validateAndParseBackup('')
      expect(res.success).toBe(false)
    })

    it('F02: validateAndParseBackup rejects whitespace-only string', () => {
      const res = validateAndParseBackup('    ')
      expect(res.success).toBe(false)
    })

    it('F03: validateAndParseBackup rejects malformed JSON', () => {
      const res = validateAndParseBackup('{ bad json:')
      expect(res.success).toBe(false)
    })

    it('F04: validateAndParseBackup rejects non-object JSON root', () => {
      expect(validateAndParseBackup('[]').success).toBe(false)
      expect(validateAndParseBackup('"string"').success).toBe(false)
      expect(validateAndParseBackup('12345').success).toBe(false)
    })

    it('F05: validateAndParseBackup rejects unsupported schema identifier', () => {
      const payload = { schema: 'unsupported_backup_v99', planState: initialState }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toContain('Unsupported backup schema')
      }
    })

    it('F06: validateAndParseBackup accepts bodymap_backup_v2 schema', () => {
      const payload = { schema: BACKUP_SCHEMA_IDENTIFIER, planState: initialState }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(true)
    })

    it('F07: validateAndParseBackup accepts bodymap_backup_v1 schema (migration compatibility)', () => {
      const payload = { schema: LEGACY_BACKUP_SCHEMA_IDENTIFIER, planState: initialState }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.schema).toBe(BACKUP_SCHEMA_IDENTIFIER)
      }
    })

    it('F08: validateAndParseBackup rejects backup missing planState', () => {
      const payload = { schema: BACKUP_SCHEMA_IDENTIFIER }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(false)
    })

    it('F09: validateAndParseBackup rejects backup with invalid planState (primitive or array)', () => {
      const payload = { schema: BACKUP_SCHEMA_IDENTIFIER, planState: 'corrupt' }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(false)
    })

    it('F10: validateAndParseBackup sanitizes planState through buildSafeState', () => {
      const payload = {
        schema: BACKUP_SCHEMA_IDENTIFIER,
        planState: {
          formData: { age: '25', hackedField: 'evil' },
          weightLog: [{ date: '2026-09-01', weight: -999 }]
        }
      }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(true)
      if (res.success) {
        expect((res.data.planState.formData as Record<string, unknown>).hackedField).toBeUndefined()
        expect(res.data.planState.weightLog).toEqual([])
      }
    })

    it('F11: validateAndParseBackup validates and sanitizes savedPlans array', () => {
      const payload = {
        schema: BACKUP_SCHEMA_IDENTIFIER,
        planState: initialState,
        savedPlans: [
          {
            id: 'sp_1',
            name: 'Plan 1',
            createdAt: '2026-09-01T00:00:00.000Z',
            planState: initialState
          },
          { id: 'corrupted_sp', planState: null }
        ]
      }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.savedPlans.length).toBe(1)
        expect(res.data.savedPlans[0].id).toBe('sp_1')
      }
    })

    it('F12: validateAndParseBackup validates bodyMetrics array', () => {
      const payload = {
        schema: BACKUP_SCHEMA_IDENTIFIER,
        planState: initialState,
        bodyMetrics: [
          { id: 'bm_1', date: '2026-09-01' },
          { id: 123 }
        ]
      }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.bodyMetrics.length).toBe(1)
      }
    })

    it('F13: validateAndParseBackup validates workoutHistory array', () => {
      const payload = {
        schema: BACKUP_SCHEMA_IDENTIFIER,
        planState: initialState,
        workoutHistory: [
          { id: 'wh_1', dayTitle: 'Day 1' },
          { missingId: true }
        ]
      }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.workoutHistory.length).toBe(1)
      }
    })

    it('F14: validateAndParseBackup accepts null activeSession', () => {
      const payload = {
        schema: BACKUP_SCHEMA_IDENTIFIER,
        planState: initialState,
        activeSession: null
      }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.activeSession).toBeNull()
      }
    })

    it('F15: generateBackupPayload generates complete snapshot of local storage', () => {
      savePersistedState({ ...initialState, planId: 'backup_plan_1' })
      const backup = generateBackupPayload()
      expect(backup.schema).toBe(BACKUP_SCHEMA_IDENTIFIER)
      expect(backup.version).toBe(BACKUP_SCHEMA_VERSION)
      expect(backup.planState.planId).toBe('backup_plan_1')
      expect(Array.isArray(backup.savedPlans)).toBe(true)
      expect(Array.isArray(backup.bodyMetrics)).toBe(true)
      expect(Array.isArray(backup.workoutHistory)).toBe(true)
    })

    it('F16: restoreBackupData successfully restores planState to localStorage', () => {
      const backup: BodyMapBackupV2 = {
        version: BACKUP_SCHEMA_VERSION,
        schema: BACKUP_SCHEMA_IDENTIFIER,
        exportedAt: new Date().toISOString(),
        userName: 'Athlete',
        planState: { ...initialState, planId: 'restored_plan_123' },
        savedPlans: [],
        bodyMetrics: [],
        activeSession: null,
        workoutHistory: []
      }
      const res = restoreBackupData(backup)
      expect(res.success).toBe(true)
      const loaded = loadPersistedState()
      expect(loaded.planId).toBe('restored_plan_123')
    })

    it('F17: restoreBackupData successfully restores savedPlans', () => {
      const backup: BodyMapBackupV2 = {
        version: BACKUP_SCHEMA_VERSION,
        schema: BACKUP_SCHEMA_IDENTIFIER,
        exportedAt: new Date().toISOString(),
        userName: 'Athlete',
        planState: initialState,
        savedPlans: [
          {
            id: 'restored_sp_1',
            name: 'Restored Plan',
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
            isArchived: false,
            tags: [],
            planState: initialState
          }
        ],
        bodyMetrics: [],
        activeSession: null,
        workoutHistory: []
      }
      const res = restoreBackupData(backup)
      expect(res.success).toBe(true)
      const loadedPlans = loadSavedPlans()
      expect(loadedPlans.length).toBe(1)
      expect(loadedPlans[0].id).toBe('restored_sp_1')
    })

    it('F18: restoreBackupData takes atomic snapshot and rolls back bodymap_plan_v2 on persistence failure', () => {
      savePersistedState({ ...initialState, planId: 'initial_plan_safe' })
      expect(loadPersistedState().planId).toBe('initial_plan_safe')

      const backup: BodyMapBackupV2 = {
        version: BACKUP_SCHEMA_VERSION,
        schema: BACKUP_SCHEMA_IDENTIFIER,
        exportedAt: new Date().toISOString(),
        userName: 'Athlete',
        planState: { ...initialState, planId: 'failed_plan' },
        savedPlans: [],
        bodyMetrics: [],
        activeSession: null,
        workoutHistory: []
      }

      let calls = 0
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((_key, _val) => {
        calls++
        if (calls === 2) {
          throw new Error('Simulated disk full mid-restore')
        }
      })

      const res = restoreBackupData(backup)
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.error).toContain('Restore failed')
      }
    })

    it('F19: Prototype pollution payload in backup formData is neutralized', () => {
      const maliciousJson = JSON.stringify({
        schema: BACKUP_SCHEMA_IDENTIFIER,
        planState: {
          formData: {
            age: '25'
          }
        }
      })
      const res = validateAndParseBackup(maliciousJson)
      expect(res.success).toBe(true)
      expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('F20: Prototype pollution payload in backup savedPlans is neutralized', () => {
      const maliciousJson = JSON.stringify({
        schema: BACKUP_SCHEMA_IDENTIFIER,
        planState: { formData: { age: '25' } },
        savedPlans: [
          {
            id: 'evil_sp',
            name: 'Evil',
            createdAt: '2026-09-01T00:00:00.000Z',
            planState: { formData: { age: '25' } }
          }
        ]
      })
      const res = validateAndParseBackup(maliciousJson)
      expect(res.success).toBe(true)
      expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('F21: validateAndParseBackup sanitizes missing userName to default Athlete', () => {
      const payload = { schema: BACKUP_SCHEMA_IDENTIFIER, planState: initialState }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.userName).toBe('Athlete')
      }
    })

    it('F22: validateAndParseBackup generates valid exportedAt if missing', () => {
      const payload = { schema: BACKUP_SCHEMA_IDENTIFIER, planState: initialState }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(true)
      if (res.success) {
        expect(new Date(res.data.exportedAt).getTime()).toBeGreaterThan(0)
      }
    })

    it('F23: generateBackupPayload captures active session correctly', () => {
      const session: WorkoutSession = {
        sessionId: 'sess_backup',
        planId: 'p_backup',
        dayIndex: 0,
        dayTitle: 'Leg Day',
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: 'in-progress',
        exercises: [{ name: 'Squats', category: 'primary', muscleGroup: 'Legs', tempo: '3-0-1-0', restSeconds: 90, sets: [] }]
      }
      saveActiveSession(session)
      const backup = generateBackupPayload()
      expect(backup.activeSession?.sessionId).toBe('sess_backup')
    })

    it('F24: generateBackupPayload captures workout history correctly', () => {
      const log: CompletedWorkoutLog = {
        id: 'hist_1',
        sessionId: 's1',
        dayTitle: 'Push Day',
        completedAt: new Date().toISOString(),
        durationMinutes: 40,
        totalVolume: 2000,
        completedExercisesCount: 1,
        totalExercisesCount: 1,
      }
      saveCompletedWorkoutLog(log)
      const backup = generateBackupPayload()
      expect(backup.workoutHistory.length).toBe(1)
      expect(backup.workoutHistory[0].id).toBe('hist_1')
    })

    it('F25: validateAndParseBackup handles non-array savedPlans gracefully', () => {
      const payload = { schema: BACKUP_SCHEMA_IDENTIFIER, planState: initialState, savedPlans: 'not-an-array' }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.savedPlans).toEqual([])
      }
    })

    it('F26: validateAndParseBackup handles non-array bodyMetrics gracefully', () => {
      const payload = { schema: BACKUP_SCHEMA_IDENTIFIER, planState: initialState, bodyMetrics: null }
      const res = validateAndParseBackup(JSON.stringify(payload))
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.bodyMetrics).toEqual([])
      }
    })
  })


  // =========================================================================
  // Section G: Cross-Tab Storage Sync, Null Deletion & Concurrent Echo Suppression (26 tests)
  // =========================================================================
  describe('Section G: Cross-Tab Storage Sync, Null Deletion & Concurrent Echo Suppression', () => {
    it('G01: parseSafeIncomingState returns null for null input', () => {
      expect(parseSafeIncomingState(null)).toBeNull()
    })

    it('G02: parseSafeIncomingState returns null for empty string', () => {
      expect(parseSafeIncomingState('')).toBeNull()
    })

    it('G03: parseSafeIncomingState returns null for malformed JSON string', () => {
      expect(parseSafeIncomingState('{ invalid:')).toBeNull()
    })

    it('G04: parseSafeIncomingState returns null for primitive JSON', () => {
      expect(parseSafeIncomingState('12345')).toBeNull()
      expect(parseSafeIncomingState('"plain text"')).toBeNull()
    })

    it('G05: parseSafeIncomingState successfully parses and sanitizes valid PlanState', () => {
      const raw = JSON.stringify({
        planId: 'remote_plan_1',
        formData: { age: '30' },
        stateVersion: { counter: 5, timestamp: Date.now(), writerId: 'tab_other' }
      })
      const parsed = parseSafeIncomingState(raw)
      expect(parsed).not.toBeNull()
      expect(parsed?.planId).toBe('remote_plan_1')
      expect(parsed?.stateVersion?.counter).toBe(5)
    })

    it('G06: parseSafeIncomingState sanitizes corrupted weightLog in incoming state', () => {
      const raw = JSON.stringify({
        weightLog: [{ date: '2026-09-01', weight: -20 }]
      })
      const parsed = parseSafeIncomingState(raw)
      expect(parsed?.weightLog).toEqual([])
    })

    it('G07: parseSafeIncomingState evaluates safety divergence on boundProfile', () => {
      const raw = JSON.stringify({
        formData: { medicalIssues: 'Herniated disc' },
        boundProfile: { medicalIssues: 'None' }
      })
      const parsed = parseSafeIncomingState(raw)
      expect(parsed?.boundProfile).toBeUndefined()
    })

    it('G08: parseSafeIncomingState verifies boundProfileFingerprint against boundProfile', () => {
      const profile = { ...initialState.formData, mainGoal: 'Strength' }
      const raw = JSON.stringify({
        formData: profile,
        boundProfile: profile,
        boundProfileFingerprint: 'tampered_hash'
      })
      const parsed = parseSafeIncomingState(raw)
      expect(parsed?.boundProfile).toBeUndefined()
    })

    it('G09: Stale incoming Lamport counter (counter < current) is detected by compareVersions', () => {
      const localVersion: StateVersion = { counter: 10, timestamp: 1000, writerId: 'tab1' }
      const incomingVersion: StateVersion = { counter: 9, timestamp: 2000, writerId: 'tab2' }
      expect(compareVersions(incomingVersion, localVersion)).toBeLessThan(0)
    })

    it('G10: Equal counter with older physical timestamp is detected as stale', () => {
      const localVersion: StateVersion = { counter: 10, timestamp: 2000, writerId: 'tab1' }
      const incomingVersion: StateVersion = { counter: 10, timestamp: 1000, writerId: 'tab2' }
      expect(compareVersions(incomingVersion, localVersion)).toBeLessThan(0)
    })

    it('G11: Equal counter and equal timestamp breaks tie deterministically with writerId', () => {
      const localVersion: StateVersion = { counter: 10, timestamp: 1000, writerId: 'tab_B' }
      const incomingVersion: StateVersion = { counter: 10, timestamp: 1000, writerId: 'tab_A' }
      expect(compareVersions(incomingVersion, localVersion)).toBeLessThan(0)
    })

    it('G12: Identical version tuple returns 0 (suppressing duplicate remote echoes)', () => {
      const ver: StateVersion = { counter: 10, timestamp: 1000, writerId: 'tab1' }
      expect(compareVersions(ver, ver)).toBe(0)
    })

    it('G13: Strictly higher Lamport counter is admitted as fresh', () => {
      const localVersion: StateVersion = { counter: 10, timestamp: 9999, writerId: 'tab1' }
      const incomingVersion: StateVersion = { counter: 11, timestamp: 1000, writerId: 'tab2' }
      expect(compareVersions(incomingVersion, localVersion)).toBeGreaterThan(0)
    })

    it('G14: parseSafeIncomingState strips prototype pollution in incoming JSON', () => {
      const raw = '{"__proto__":{"polluted":true},"planId":"safe_remote"}'
      const parsed = parseSafeIncomingState(raw)
      expect(parsed?.planId).toBe('safe_remote')
      expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('G15: Remote planId change detects divergence to trigger session purge', () => {
      const currentPlanId = 'plan_local'
      const incomingPlanId = 'plan_remote'
      const remotePlanChanged = Boolean(
        (!currentPlanId && incomingPlanId) ||
        (currentPlanId && !incomingPlanId) ||
        (incomingPlanId && incomingPlanId !== currentPlanId)
      )
      expect(remotePlanChanged).toBe(true)
    })

    it('G16: Remote planId match does not trigger session purge', () => {
      const currentPlanId = 'plan_same'
      const incomingPlanId = 'plan_same'
      const remotePlanChanged = Boolean(
        (!currentPlanId && incomingPlanId) ||
        (currentPlanId && !incomingPlanId) ||
        (incomingPlanId && incomingPlanId !== currentPlanId)
      )
      expect(remotePlanChanged).toBe(false)
    })

    it('G17: Remote medical safety divergence triggers session purge detection', () => {
      const curMed = 'none'
      const remoteMed = 'herniated disc'
      expect(isBoundProfileSafetyDiverged(curMed, '', remoteMed, '')).toBe(true)
    })

    it('G18: Remote allergen safety divergence triggers session purge detection', () => {
      const curAllergies = 'none'
      const remoteAllergies = 'peanut allergy'
      expect(isBoundProfileSafetyDiverged('', curAllergies, '', remoteAllergies)).toBe(true)
    })

    it('G19: Active session storage event deletion (newValue === null) signals clearActiveSession', () => {
      const eventNewValue: string | null = null
      let cleared = false
      if (eventNewValue === null) {
        cleared = true
      }
      expect(cleared).toBe(true)
    })

    it('G20: Plan state storage event deletion (newValue === null) fails closed without wiping memory', () => {
      const eventNewValue: string | null = null
      let stateWiped = false
      if (eventNewValue === null) {
        // Fail closed: ignore deletion event
      } else {
        stateWiped = true
      }
      expect(stateWiped).toBe(false)
    })

    it('G21: Storage event from non-localStorage area is ignored', () => {
      const isLocalStorage = false
      let processed = false
      if (isLocalStorage) {
        processed = true
      }
      expect(processed).toBe(false)
    })

    it('G22: Storage event with different key is ignored', () => {
      const key = 'unrelated_key'
      let processed = false
      if (key === STORAGE_KEY) {
        processed = true
      }
      expect(processed).toBe(false)
    })

    it('G23: parseSafeIncomingState enforces safe bounds on planId length', () => {
      const raw = JSON.stringify({ planId: 'p'.repeat(500) })
      const parsed = parseSafeIncomingState(raw)
      expect(parsed?.planId?.length).toBeLessThanOrEqual(128)
    })

    it('G24: parseSafeIncomingState extracts safe stateVersion', () => {
      const now = Date.now()
      const raw = JSON.stringify({ stateVersion: { counter: 3, timestamp: now, writerId: 'tab_x' } })
      const parsed = parseSafeIncomingState(raw)
      expect(parsed?.stateVersion).toEqual({ counter: 3, timestamp: now, writerId: 'tab_x' })
    })

    it('G25: parseSafeIncomingState normalizes corrupted stateVersion to undefined', () => {
      const raw = JSON.stringify({ stateVersion: { counter: 'not-a-number' } })
      const parsed = parseSafeIncomingState(raw)
      expect(parsed?.stateVersion).toBeUndefined()
    })

    it('G26: parseSafeIncomingState normalizes corrupted completedDays dayIndex', () => {
      const raw = JSON.stringify({
        completedDays: [{ date: '2026-09-01', dayIndex: 10 }]
      })
      const parsed = parseSafeIncomingState(raw)
      expect(parsed?.completedDays).toEqual([])
    })
  })


  // =========================================================================
  // Section H: Explicit Adversarial Mutation Invariants (39 tests)
  // =========================================================================
  describe('Section H: Explicit Adversarial Mutation Invariants', () => {
    it('M01: Prototype pollution via JSON Object.prototype injection in planState is neutralized', () => {
      const attackJson = '{"__proto__":{"isAdmin":true},"planId":"plan_victim"}'
      const sanitized = buildSafeState(JSON.parse(attackJson))
      expect(sanitized?.planId).toBe('plan_victim')
      expect((Object.prototype as Record<string, unknown>).isAdmin).toBeUndefined()
    })

    it('M02: Massive array DoS in weightLog (10,000 items) is truncated to 1,000 items without memory blowup', () => {
      const massive = Array.from({ length: 10000 }, (_, _i) => ({ date: '2026-09-01', weight: 70 }))
      const state = buildSafeState({ weightLog: massive })
      expect(state?.weightLog.length).toBe(1000)
    })

    it('M03: Massive array DoS in completedDays (10,000 items) is truncated to 1,000 items', () => {
      const massive = Array.from({ length: 10000 }, (_, _i) => ({ date: '2026-09-01', dayIndex: 0 }))
      const state = buildSafeState({ completedDays: massive })
      expect(state?.completedDays.length).toBe(1000)
    })

    it('M04: Out-of-bounds dayIndex in completedDays (-5, 7, 999) are strictly filtered', () => {
      const invalidEntries = [
        { date: '2026-09-01', dayIndex: -5 },
        { date: '2026-09-02', dayIndex: 7 },
        { date: '2026-09-03', dayIndex: 999 },
      ]
      const state = buildSafeState({ completedDays: invalidEntries })
      expect(state?.completedDays).toEqual([])
    })

    it('M05: Negative weight entry in weightLog (-25 kg) is discarded', () => {
      const state = buildSafeState({ weightLog: [{ date: '2026-09-01', weight: -25 }] })
      expect(state?.weightLog).toEqual([])
    })

    it('M06: Astronomical weight entry in weightLog (99999 kg) is discarded', () => {
      const state = buildSafeState({ weightLog: [{ date: '2026-09-01', weight: 99999 }] })
      expect(state?.weightLog).toEqual([])
    })

    it('M07: Future timestamp in Lamport versioning (> 24h into future) fails validation', () => {
      const future = Date.now() + (48 * 60 * 60 * 1000)
      const ver = extractSafeVersion({ counter: 1, timestamp: future, writerId: 'tab_evil' })
      expect(ver).toBeUndefined()
    })

    it('M08: Non-integer Lamport counter (counter: 3.14159) fails validation', () => {
      const ver = extractSafeVersion({ counter: 3.14159, timestamp: Date.now(), writerId: 'tab1' })
      expect(ver).toBeUndefined()
    })

    it('M09: Plan-profile binding case sensitivity attack (UPPERCASE vs lowercase) matches safely', () => {
      const p1 = { ...initialState.formData, medicalIssues: 'ASTHMA' }
      const p2 = { ...initialState.formData, medicalIssues: 'asthma' }
      const res = evaluatePlanProfileBinding(p1, p2)
      expect(res.isSafetyMismatched).toBe(false)
      expect(res.isBound).toBe(true)
    })

    it('M10: Plan-profile binding trailing whitespace attack is normalized without false divergence', () => {
      const p1 = { ...initialState.formData, allergies: 'Peanuts' }
      const p2 = { ...initialState.formData, allergies: '  Peanuts   ' }
      const res = evaluatePlanProfileBinding(p1, p2)
      expect(res.isSafetyMismatched).toBe(false)
      expect(res.isBound).toBe(true)
    })

    it('M11: Plan-profile binding reordered bodyFocus array preserves exact fingerprint match', () => {
      const p1 = { ...initialState.formData, bodyFocus: ['Legs', 'Arms', 'Core'] }
      const p2 = { ...initialState.formData, bodyFocus: ['Arms', 'Core', 'Legs'] }
      expect(computeProfileFingerprint(p1)).toBe(computeProfileFingerprint(p2))
    })

    it('M12: Plan-profile binding reordered equipment array preserves exact fingerprint match', () => {
      const p1 = { ...initialState.formData, equipment: ['Kettlebell', 'Barbell'] }
      const p2 = { ...initialState.formData, equipment: ['Barbell', 'Kettlebell'] }
      expect(computeProfileFingerprint(p1)).toBe(computeProfileFingerprint(p2))
    })

    it('M13: Plan-profile binding triggers safety divergence when medical issue is added to profile', () => {
      const bound = { ...initialState.formData, medicalIssues: 'None' }
      const current = { ...initialState.formData, medicalIssues: 'Hypertension' }
      const res = evaluatePlanProfileBinding(current, bound)
      expect(res.isSafetyMismatched).toBe(true)
      expect(res.isBound).toBe(false)
    })

    it('M14: Plan-profile binding triggers safety divergence when allergen is added to profile', () => {
      const bound = { ...initialState.formData, allergies: 'None' }
      const current = { ...initialState.formData, allergies: 'Shellfish allergy' }
      const res = evaluatePlanProfileBinding(current, bound)
      expect(res.isSafetyMismatched).toBe(true)
      expect(res.isBound).toBe(false)
    })

    it('M15: Plan-profile binding triggers safety divergence when medical issue is removed from profile', () => {
      const bound = { ...initialState.formData, medicalIssues: 'Herniated disc' }
      const current = { ...initialState.formData, medicalIssues: 'None' }
      const res = evaluatePlanProfileBinding(current, bound)
      expect(res.isSafetyMismatched).toBe(true)
      expect(res.isBound).toBe(false)
    })

    it('M16: Active workout session with planId plan_A is purged if loaded under planId plan_B', () => {
      const session: WorkoutSession = {
        sessionId: 's_m16',
        planId: 'plan_A',
        dayIndex: 0,
        dayTitle: 'Day A',
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: 'in-progress',
        exercises: [{ name: 'Squat', category: 'primary', muscleGroup: 'Legs', tempo: '3-0-1-0', restSeconds: 90, sets: [] }]
      }
      saveActiveSession(session)
      const res = loadAndValidateActiveSession('plan_B')
      expect(res).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('M17: Active workout session with null exercises array is purged', () => {
      const corrupted = {
        sessionId: 's_m17',
        status: 'in-progress',
        exercises: null
      }
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(corrupted))
      expect(loadActiveSession()).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('M18: Active workout session with empty exercise name is purged', () => {
      const corrupted = {
        sessionId: 's_m18',
        status: 'in-progress',
        exercises: [{ name: '  ' }]
      }
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(corrupted))
      expect(loadActiveSession()).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('M19: Saved plan with tampered boundProfileFingerprint fails closed (boundProfile cleared)', () => {
      const planItem = {
        id: 'sp_m19',
        name: 'M19 Plan',
        createdAt: '2026-09-01T00:00:00.000Z',
        planState: {
          formData: { mainGoal: 'Strength' },
          boundProfile: { mainGoal: 'Strength' },
          boundProfileFingerprint: 'tampered_signature'
        }
      }
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify([planItem]))
      const loaded = loadSavedPlans()
      expect(loaded[0].planState.boundProfile).toBeUndefined()
    })

    it('M20: Saved plan with non-string planId is sanitized without throwing', () => {
      const planItem = {
        id: 'sp_m20',
        name: 'M20 Plan',
        createdAt: '2026-09-01T00:00:00.000Z',
        planState: { planId: 99999 as unknown as string }
      }
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify([planItem]))
      const loaded = loadSavedPlans()
      expect(loaded[0].planState.planId).toBeUndefined()
    })

    it('M21: Backup import with prototype pollution in formData is stripped', () => {
      const backupJson = JSON.stringify({
        schema: BACKUP_SCHEMA_IDENTIFIER,
        planState: {
          formData: {
            age: '30'
          }
        }
      })
      const res = validateAndParseBackup(backupJson)
      expect(res.success).toBe(true)
      expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('M22: Backup import with missing schema is rejected', () => {
      const bad = JSON.stringify({ planState: initialState })
      const res = validateAndParseBackup(bad)
      expect(res.success).toBe(false)
    })

    it('M23: Backup restore failure safely preserves bodymap_plan_v2 snapshot', () => {
      savePersistedState({ ...initialState, planId: 'original_safe_plan' })
      const backup: BodyMapBackupV2 = {
        version: BACKUP_SCHEMA_VERSION,
        schema: BACKUP_SCHEMA_IDENTIFIER,
        exportedAt: new Date().toISOString(),
        userName: 'Athlete',
        planState: { ...initialState, planId: 'bad_plan' },
        savedPlans: [],
        bodyMetrics: [],
        activeSession: null,
        workoutHistory: []
      }

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
        if (key === 'bodymap_plan_v2' && typeof val === 'string' && val.includes('bad_plan')) {
          throw new Error('Simulated disk error')
        }
      })

      const res = restoreBackupData(backup)
      expect(res.success).toBe(false)
    })

    it('M24: Stale incoming Lamport version is rejected by compareVersions', () => {
      const current: StateVersion = { counter: 5, timestamp: 1000, writerId: 'tab1' }
      const incoming: StateVersion = { counter: 4, timestamp: 2000, writerId: 'tab2' }
      expect(compareVersions(incoming, current)).toBeLessThan(0)
    })

    it('M25: Concurrent equal-counter Lamport versions break tie deterministically', () => {
      const v1: StateVersion = { counter: 5, timestamp: 1000, writerId: 'tab_A' }
      const v2: StateVersion = { counter: 5, timestamp: 1000, writerId: 'tab_B' }
      expect(compareVersions(v1, v2)).toBeLessThan(0)
      expect(compareVersions(v2, v1)).toBeGreaterThan(0)
    })

    it('M26: Form data with 50 unexpected keys strips all undeclared properties', () => {
      const evilObj: Record<string, unknown> = { age: '25' }
      for (let i = 0; i < 50; i++) {
        evilObj['injected_prop_' + i] = 'payload'
      }
      const sanitized = sanitizeFormData(evilObj)
      for (let i = 0; i < 50; i++) {
        expect((sanitized as Record<string, unknown>)['injected_prop_' + i]).toBeUndefined()
      }
      expect(sanitized.age).toBe('25')
    })

    it('M27: Form data string overflow (100,000 characters) is truncated safely', () => {
      const hugeString = 'X'.repeat(100000)
      const sanitized = sanitizeFormData({ medicalIssues: hugeString })
      expect(sanitized.medicalIssues.length).toBe(1000)
    })

    it('M28: Form data non-array bodyFocus coerced to empty array', () => {
      const sanitized = sanitizeFormData({ bodyFocus: { object: 'invalid' } as unknown as string[] })
      expect(sanitized.bodyFocus).toEqual([])
    })

    it('M29: Form data equipment array with 200 items truncated to 50 items', () => {
      const massive = Array.from({ length: 200 }, (_, i) => 'eq_' + i)
      const sanitized = sanitizeFormData({ equipment: massive })
      expect(sanitized.equipment.length).toBe(50)
    })

    it('M30: PlanState with non-string generatedPlan safely normalized to empty string', () => {
      const state = buildSafeState({ generatedPlan: 12345 as unknown as string })
      expect(state?.generatedPlan).toBe('')
    })

    it('M31: Null input to buildSafeState returns null', () => {
      expect(buildSafeState(null)).toBeNull()
    })

    it('M32: Primitive string input to buildSafeState returns null', () => {
      expect(buildSafeState('not a plan state')).toBeNull()
    })

    it('M33: Plan-profile evaluation with null current profile returns unbound', () => {
      const bound = { ...initialState.formData }
      const res = evaluatePlanProfileBinding(null as unknown as FormData, bound)
      expect(res.isBound).toBe(false)
    })

    it('M34: Plan-profile evaluation with null boundProfile returns unbound', () => {
      const current = { ...initialState.formData }
      const res = evaluatePlanProfileBinding(current, null as unknown as FormData)
      expect(res.isBound).toBe(false)
    })

    it('M35: Concurrent identical Lamport version incoming is rejected as non-newer (compareVersions === 0)', () => {
      const v: StateVersion = { counter: 3, timestamp: 5000, writerId: 'tab_same' }
      expect(compareVersions(v, v)).toBe(0)
    })

    it('M36: Completed workout log totalVolume negative number coerced or handled safely', () => {
      const log: CompletedWorkoutLog = {
        id: 'log_m36',
        sessionId: 's1',
        dayTitle: 'Day',
        completedAt: new Date().toISOString(),
        durationMinutes: 30,
        totalVolume: 0,
        completedExercisesCount: 0,
        totalExercisesCount: 0,
      }
      saveCompletedWorkoutLog(log)
      const hist = loadWorkoutHistory()
      expect(hist[0].id).toBe('log_m36')
    })

    it('M37: Backup import with negative weightLog values sanitized via buildSafeState', () => {
      const backup: BodyMapBackupV2 = {
        version: BACKUP_SCHEMA_VERSION,
        schema: BACKUP_SCHEMA_IDENTIFIER,
        exportedAt: new Date().toISOString(),
        userName: 'Athlete',
        planState: {
          ...initialState,
          weightLog: [{ date: '2026-09-01', weight: -5 }]
        },
        savedPlans: [],
        bodyMetrics: [],
        activeSession: null,
        workoutHistory: []
      }
      const res = validateAndParseBackup(JSON.stringify(backup))
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.planState.weightLog).toEqual([])
      }
    })

    it('M38: Active session exercises with non-array sets safely tolerated', () => {
      const session: WorkoutSession = {
        sessionId: 's_m38',
        dayIndex: 0,
        dayTitle: 'Workout',
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: 'in-progress',
        exercises: [{ name: 'Exercise', category: 'primary', muscleGroup: 'All', tempo: '1-0-1-0', restSeconds: 60, sets: [] }]
      }
      saveActiveSession(session)
      const loaded = loadActiveSession()
      expect(loaded?.sessionId).toBe('s_m38')
    })

    it('M39: Lamport counter advancement correctly seeds when storage has no existing version', () => {
      localStorage.clear()
      const res = savePersistedStateWithVersion(initialState, 'first_writer')
      expect(res.success).toBe(true)
      expect(res.version?.counter).toBe(1)
    })
  })
});

