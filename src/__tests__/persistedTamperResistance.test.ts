// persistedTamperResistance.test.ts
// Comprehensive adversarial regression test matrix for Persisted-State & Session Tamper Resistance.
// Verifies invariants A through M under untrusted storage / cross-tab trust boundary.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadPersistedState,
  savePersistedStateWithVersion,
  parseSafeIncomingState,
  compareVersions,
  STORAGE_KEY,
} from '../context/planStorage'
import {
  saveActiveSession,
  loadActiveSession,
  loadAndValidateActiveSession,
  ACTIVE_SESSION_STORAGE_KEY,
} from '../lib/sessionStorage'
import { scanPlanForContraindications } from '../lib/contraindicationGuard'
import { evaluatePlanProfileBinding } from '../lib/planBinding'
import { parseExerciseStringToSessionExercise } from '../lib/exerciseSubstitution'
import type { WorkoutSession } from '../types/workoutSession'
import type { FormData } from '../types/formData'
import { initialState, defaultFormData, PlanState, StateVersion } from '../context/PlanContext'

const safeProfile: FormData = {
  ...defaultFormData,
  age: '28',
  gender: 'female',
  height: '165',
  weight: '60',
  fitnessLevel: 'intermediate',
  mainGoal: 'tone',
  bodyFocus: ['Full Body'],
  timePerDay: '30',
  recoveryDays: '2',
  medicalIssues: 'None',
  dietaryPreference: 'omnivore',
  allergies: 'None',
  equipment: ['dumbbells'],
}

const aclProfile: FormData = {
  ...safeProfile,
  medicalIssues: 'Acute ACL tear and ligament reconstruction',
}

const buildSession = (overrides?: Partial<WorkoutSession>): WorkoutSession => ({
  sessionId: 'sess_test_100',
  planId: 'plan_active_001',
  medicalSnapshot: 'None',
  dayIndex: 0,
  dayTitle: 'Day 1 - Upper',
  dayType: 'Strength',
  durationMinutes: 45,
  startedAt: Date.now() - 300_000,
  lastUpdatedAt: Date.now() - 60_000,
  elapsedSeconds: 240,
  currentExerciseIndex: 0,
  exercises: [
    parseExerciseStringToSessionExercise('Dumbbell Bench Press: 3 sets x 10 reps (60s rest)', 0),
  ],
  restTimer: {
    isActive: false,
    targetEndTime: null,
    durationSeconds: 60,
    isPaused: false,
    remainingSeconds: 60,
  },
  status: 'in-progress',
  soundEnabled: true,
  vibrateEnabled: true,
  ...overrides,
})

describe('PERSISTED-STATE & SESSION TAMPER RESISTANCE (A-M)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  // A. Forged binding metadata
  describe('A: Forged binding metadata', () => {
    it('A1: diverged boundProfile in storage is quarantined/cleared on load -> triggers safety lockout', () => {
      const tampered = {
        ...initialState,
        formData: aclProfile,
        isGenerated: true,
        generatedPlan: '## Day 1\n**Main Workout:**\n- Bicep Curls\n**Meals:**\n- Oats',
        planId: 'plan_acl_001',
        // Attacker sets boundProfile to None to try to claim the plan is safe
        boundProfile: { ...safeProfile, medicalIssues: 'None' },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tampered))

      const loaded = loadPersistedState()
      // boundProfile safety divergence detected -> boundProfile discarded!
      expect(loaded.boundProfile).toBeUndefined()

      // Binding evaluation sees null boundProfile with active medical issues -> lockout!
      const evalResult = evaluatePlanProfileBinding(loaded.formData, loaded.boundProfile)
      expect(evalResult.isSafetyMismatched).toBe(true)
      expect(evalResult.mismatchedSafetyFields).toContain('medicalIssues')
    })
  })

  // B. Forged version metadata
  describe('B: Forged version metadata', () => {
    it('B1: extractSafeVersion rejects negative counter, NaN, non-finite, and huge numbers', () => {
      const invalidVersions = [
        { counter: -5, timestamp: Date.now(), writerId: 'tab_1' },
        { counter: NaN, timestamp: Date.now(), writerId: 'tab_1' },
        { counter: Infinity, timestamp: Date.now(), writerId: 'tab_1' },
        { counter: 1e12, timestamp: Date.now(), writerId: 'tab_1' }, // exceeds 1e9 limit
        { counter: 1.5, timestamp: Date.now(), writerId: 'tab_1' }, // not integer
        { counter: 10, timestamp: Date.now(), writerId: '' }, // empty writerId
        { counter: 10, timestamp: Date.now(), writerId: 'a'.repeat(200) }, // writerId too long
      ]

      for (const badVer of invalidVersions) {
        const state = {
          ...initialState,
          stateVersion: badVer,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
        const loaded = loadPersistedState()
        expect(loaded.stateVersion).toBeUndefined()
      }
    })
  })

  // C. Rollback / Replay
  describe('C: Rollback and replay defense', () => {
    it('C1: older version counter cannot overwrite newer version via compareVersions', () => {
      const vCurrent: StateVersion = { counter: 10, timestamp: 2000, writerId: 'tab_A' }
      const vOldReplay: StateVersion = { counter: 5, timestamp: 1000, writerId: 'tab_A' }

      expect(compareVersions(vOldReplay, vCurrent)).toBeLessThan(0)
    })
  })

  // D. Cross-tab crafted payload
  describe('D: Cross-tab crafted payload', () => {
    it('D1: parseSafeIncomingState safely discards null, malformed JSON, and non-object payloads', () => {
      expect(parseSafeIncomingState(null)).toBeNull()
      expect(parseSafeIncomingState('')).toBeNull()
      expect(parseSafeIncomingState('not-json')).toBeNull()
      expect(parseSafeIncomingState('12345')).toBeNull()
      expect(parseSafeIncomingState('["array", "not", "object"]')).toBeNull()
    })
  })

  // E. Malformed snapshot
  describe('E: Malformed snapshot recovery', () => {
    it('E1: loadPersistedState safely recovers to initialState on corrupt JSON or missing fields', () => {
      localStorage.setItem(STORAGE_KEY, '{"corrupted": true,')
      const loaded = loadPersistedState()
      expect(loaded).toEqual(initialState)
      expect(loaded.isGenerated).toBe(false)
    })
  })

  // F. Missing safety metadata (Anti-resurrection of orphan sessions)
  describe('F: Missing safety metadata in active session', () => {
    it('F1 [FAIL-CLOSED]: loadAndValidateActiveSession rejects session with missing planId', () => {
      const orphanSession = buildSession({ planId: undefined })
      saveActiveSession(orphanSession)

      const validated = loadAndValidateActiveSession('plan_active_001', 'None')
      expect(validated).toBeNull()
      // Storage is cleaned up!
      expect(loadActiveSession()).toBeNull()
    })

    it('F2 [FAIL-CLOSED]: loadAndValidateActiveSession rejects session with mismatched or missing medicalSnapshot', () => {
      const orphanMedicalSession = buildSession({
        planId: 'plan_active_001',
        medicalSnapshot: undefined, // omitted!
      })
      saveActiveSession(orphanMedicalSession)

      // Active user has ACL tear:
      const validated = loadAndValidateActiveSession('plan_active_001', 'Acute ACL tear')
      expect(validated).toBeNull()
      expect(loadActiveSession()).toBeNull()
    })
  })

  // G. Unsafe persisted plan with "safe" metadata
  describe('G: Unsafe persisted exercises in active session', () => {
    it('G1 [FAIL-CLOSED]: loadAndValidateActiveSession scans runtime exercises and blocks contraindicated movements', () => {
      const dangerousSession = buildSession({
        planId: 'plan_active_001',
        medicalSnapshot: 'Acute ACL tear',
        exercises: [
          parseExerciseStringToSessionExercise('Box Jumps: 5 sets x 20 reps (30s rest)', 0),
        ],
      })
      saveActiveSession(dangerousSession)

      // Even if planId and medicalSnapshot match, runtime exercises are scanned against contraindications:
      const validated = loadAndValidateActiveSession('plan_active_001', 'Acute ACL tear')
      expect(validated).toBeNull()
      expect(loadActiveSession()).toBeNull()
    })
  })

  // H. Unsafe plan + mismatched medical profile
  describe('H: Unsafe plan + mismatched medical profile', () => {
    it('H1 [FAIL-CLOSED]: evaluatePlanProfileBinding detects safety-critical mismatch when profile changes to ACL tear', () => {
      const current = { ...safeProfile, medicalIssues: 'Acute ACL tear' }
      const bound = { ...safeProfile, medicalIssues: 'None' }
      const evalResult = evaluatePlanProfileBinding(current, bound)
      expect(evalResult.isSafetyMismatched).toBe(true)
    })
  })

  // I. Invalidated session resurrection
  describe('I: Invalidated session resurrection', () => {
    it('I1 [FAIL-CLOSED]: loadActiveSession rejects and purges sessions with status !== in-progress', () => {
      const completedSession = buildSession({ status: 'completed' })
      saveActiveSession(completedSession)

      // Directly tampering status in storage:
      const loaded = loadActiveSession()
      expect(loaded).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('I2 [FAIL-CLOSED]: loadActiveSession expires sessions inactive for > 24 hours', () => {
      const staleSession = buildSession({
        lastUpdatedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      })
      // Direct raw write to simulate un-refreshed storage
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(staleSession))

      const loaded = loadActiveSession()
      expect(loaded).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })
  })

  // J. Reload / deep-link after tampering
  describe('J: Reload / deep-link after tampering', () => {
    it('J1: contraScanResult flags contraindicated exercises when loaded directly', () => {
      const planWithContra = '## Day 1\n**Main Workout:**\n- Depth Jumps: 4 sets x 10 reps\n**Meals:**\n- Oats'
      const scan = scanPlanForContraindications(planWithContra, 'Severe knee osteoarthritis')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations[0].category).toBe('severe_osteoarthritis')
    })
  })

  // K. Legitimate offline snapshot still works
  describe('K: Legitimate offline snapshot', () => {
    it('K1: valid offline state with matching plan and profile loads cleanly and without lockout', () => {
      const legitimateState: PlanState = {
        formData: aclProfile,
        boundProfile: aclProfile,
        isGenerated: true,
        generatedPlan: '## Day 1\n**Main Workout:**\n- Seated Bicep Curls: 3 sets x 10 reps\n**Meals:**\n- Protein shake',
        planId: 'plan_legit_001',
        planGeneratedAt: Date.now() - 3600_000,
        stateVersion: { counter: 1, timestamp: Date.now() - 3600_000, writerId: 'tab_offline' },
        weightLog: [{ date: '2026-09-01', weight: 60 }],
        completedDays: [{ date: '2026-09-01', dayIndex: 0 }],
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legitimateState))

      const loaded = loadPersistedState()
      expect(loaded.isGenerated).toBe(true)
      expect(loaded.planId).toBe('plan_legit_001')
      expect(loaded.formData.medicalIssues).toBe(aclProfile.medicalIssues)

      const binding = evaluatePlanProfileBinding(loaded.formData, loaded.boundProfile)
      expect(binding.isSafetyMismatched).toBe(false)
      expect(binding.isBound).toBe(true)

      const contraScan = scanPlanForContraindications(loaded.generatedPlan, loaded.formData.medicalIssues)
      expect(contraScan.hasViolation).toBe(false)
    })

    it('K2: valid active session matching current plan and medical profile loads successfully', () => {
      const validSession = buildSession({
        planId: 'plan_legit_001',
        medicalSnapshot: aclProfile.medicalIssues,
        exercises: [
          parseExerciseStringToSessionExercise('Seated Dumbbell Curls: 3 sets x 12 reps (60s rest)', 0),
        ],
      })
      saveActiveSession(validSession)

      const validated = loadAndValidateActiveSession('plan_legit_001', aclProfile.medicalIssues)
      expect(validated).not.toBeNull()
      expect(validated?.sessionId).toBe('sess_test_100')
    })
  })

  // L. Legitimate cross-tab synchronization
  describe('L: Legitimate cross-tab synchronization', () => {
    it('L1: savePersistedStateWithVersion advances Lamport counter strictly higher than storage', () => {
      const initialStateInStorage: PlanState = {
        ...initialState,
        formData: safeProfile,
        stateVersion: { counter: 3, timestamp: 1000, writerId: 'tab_1' },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialStateInStorage))

      const newState: PlanState = {
        ...initialState,
        formData: { ...safeProfile, mainGoal: 'strength' },
      }

      const { success, version } = savePersistedStateWithVersion(newState, 'tab_2')
      expect(success).toBe(true)
      expect(version?.counter).toBe(4) // strictly 3 + 1 = 4
      expect(version?.writerId).toBe('tab_2')
    })
  })

  // M. Contraindication guard remains enforced after hydration
  describe('M: Contraindication guard enforcement after hydration', () => {
    it('M1: contraindicated movement in hydrated plan triggers violation regardless of storage tampering', () => {
      const forgedPlan = '## Day 1\n**Main Workout:**\n- Barbell Overhead Press: 4 sets x 8 reps\n**Meals:**\n- Salad'
      const scan = scanPlanForContraindications(forgedPlan, 'Rotator cuff tear and impingement')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations[0].category).toBe('shoulder_impingement_cuff')
    })
  })
})
