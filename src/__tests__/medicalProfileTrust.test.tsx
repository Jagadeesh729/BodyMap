// medicalProfileTrust.test.tsx
// Comprehensive adversarial regression test matrix for Medical-Profile Trust & Safety-State Machine.
// Verifies bidirectional safety enforcement, active-session purging on profile change,
// cross-tab profile invalidation, and fail-closed boundProfile fingerprinting.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { PlanProvider, usePlan, initialState, defaultFormData, PlanState } from '../context/PlanContext'
import {
  savePersistedStateWithVersion,
  loadPersistedState,
  parseSafeIncomingState,
  STORAGE_KEY,
} from '../context/planStorage'
import {
  saveActiveSession,
  loadActiveSession,
  loadAndValidateActiveSession,
} from '../lib/sessionStorage'
import { evaluatePlanProfileBinding, computeProfileFingerprint } from '../lib/planBinding'
import { hasSafetySensitiveMedicalIssues } from '../lib/validation'
import { getActiveAllergenCategories } from '../lib/allergenGuard'
import type { WorkoutSession } from '../types/workoutSession'
import type { FormData } from '../types/formData'

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

const peanutProfile: FormData = {
  ...safeProfile,
  allergies: 'Severe peanut allergy',
}

const buildSession = (overrides?: Partial<WorkoutSession>): WorkoutSession => ({
  sessionId: 'sess_test_trust_001',
  planId: 'plan_active_001',
  medicalSnapshot: 'None',
  dayIndex: 0,
  dayTitle: 'Day 1 - Full Body Tone',
  dayType: 'Conditioning',
  durationMinutes: 30,
  startedAt: Date.now() - 300_000,
  lastUpdatedAt: Date.now() - 60_000,
  elapsedSeconds: 240,
  currentExerciseIndex: 0,
  exercises: [
    {
      id: 'ex_1',
      name: 'Dumbbell Bicep Curls',
      focus: 'Arms',
      equipment: 'Dumbbells',
      targetSets: 3,
      targetReps: '12',
      restSeconds: 60,
      sets: [
        { setIndex: 1, reps: '12', weightLbs: '15', isCompleted: true, completedAt: new Date().toISOString() },
        { setIndex: 2, reps: '12', weightLbs: '15', isCompleted: false, completedAt: null },
      ],
    },
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

describe('Medical-Profile Trust & Safety-State Machine Matrix', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  // =========================================================================
  // 1. Bidirectional EditPlanPage Safety Enforcement
  // =========================================================================
  describe('1: Bidirectional Safety Enforcement on Profile Edit', () => {
    it('1A: Transitioning from healthy profile to injury requires plan regeneration', () => {
      const currentMed = safeProfile.medicalIssues
      const newMed = 'Acute ACL tear'
      const medicalChanged = currentMed.trim() !== newMed.trim()
      const safetyCriticalChange = medicalChanged && (
        hasSafetySensitiveMedicalIssues(currentMed) || hasSafetySensitiveMedicalIssues(newMed)
      )
      expect(safetyCriticalChange).toBe(true)
    })

    it('1B [CRITICAL BIDIRECTIONAL]: Transitioning from injury to "None" or empty requires plan regeneration', () => {
      // Prior bug: only checked hasSafetySensitiveMedicalIssues(newMed) which was false for "None"!
      const currentMed = aclProfile.medicalIssues
      const newMed = 'None'
      const medicalChanged = currentMed.trim() !== newMed.trim()
      const safetyCriticalChange = medicalChanged && (
        hasSafetySensitiveMedicalIssues(currentMed) || hasSafetySensitiveMedicalIssues(newMed)
      )
      expect(safetyCriticalChange).toBe(true)

      // Also for empty string
      const emptyNewMed = ''
      const emptyChanged = currentMed.trim() !== emptyNewMed.trim()
      const emptySafetyCritical = emptyChanged && (
        hasSafetySensitiveMedicalIssues(currentMed) || hasSafetySensitiveMedicalIssues(emptyNewMed)
      )
      expect(emptySafetyCritical).toBe(true)
    })

    it('1C [CRITICAL BIDIRECTIONAL]: Transitioning from peanut allergy to "None" requires plan regeneration', () => {
      const currentAllergies = peanutProfile.allergies
      const newAllergies = 'None'
      const allergiesChanged = currentAllergies.trim() !== newAllergies.trim()
      const allergiesSafetyCritical = allergiesChanged && (
        getActiveAllergenCategories(currentAllergies).length > 0 ||
        getActiveAllergenCategories(newAllergies).length > 0
      )
      expect(allergiesSafetyCritical).toBe(true)
    })

    it('1D: Modifying non-safety preferences does not trigger safety regeneration block', () => {
      const currentMed = safeProfile.medicalIssues
      const newMed = 'None' // unchanged
      const medicalChanged = currentMed.trim() !== newMed.trim()

      const currentAllergies = safeProfile.allergies
      const newAllergies = 'None' // unchanged
      const allergiesChanged = currentAllergies.trim() !== newAllergies.trim()

      const safetyCriticalChange = (
        medicalChanged && (hasSafetySensitiveMedicalIssues(currentMed) || hasSafetySensitiveMedicalIssues(newMed))
      ) || (
        allergiesChanged && (
          getActiveAllergenCategories(currentAllergies).length > 0 ||
          getActiveAllergenCategories(newAllergies).length > 0
        )
      )
      expect(safetyCriticalChange).toBe(false)
    })
  })

  // =========================================================================
  // 2. Active Session Purging on Local Profile Update
  // =========================================================================
  describe('2: Local Profile Update Purges Active Workout Session', () => {
    it('2A [FAIL-CLOSED]: Changing medical profile via setFormData immediately purges active session', () => {
      saveActiveSession(buildSession({ medicalSnapshot: 'None' }))
      expect(loadActiveSession()).not.toBeNull()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PlanProvider>{children}</PlanProvider>
      )
      const { result } = renderHook(() => usePlan(), { wrapper })

      act(() => {
        result.current.setFormData({ medicalIssues: 'Acute ACL tear' })
      })

      expect(loadActiveSession()).toBeNull()
    })

    it('2B [FAIL-CLOSED]: Clearing medical profile from ACL tear to None via setFormData purges active session', () => {
      const initialPlan: PlanState = {
        ...initialState,
        formData: { ...aclProfile },
        boundProfile: { ...aclProfile },
        planId: 'plan_acl_001',
        isGenerated: true,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialPlan))
      saveActiveSession(buildSession({ planId: 'plan_acl_001', medicalSnapshot: aclProfile.medicalIssues }))
      expect(loadActiveSession()).not.toBeNull()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PlanProvider>{children}</PlanProvider>
      )
      const { result } = renderHook(() => usePlan(), { wrapper })

      act(() => {
        result.current.setFormData({ medicalIssues: 'None' })
      })

      expect(loadActiveSession()).toBeNull()
    })

    it('2C [FAIL-CLOSED]: Adding allergen via setFormData purges active session', () => {
      saveActiveSession(buildSession())
      expect(loadActiveSession()).not.toBeNull()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PlanProvider>{children}</PlanProvider>
      )
      const { result } = renderHook(() => usePlan(), { wrapper })

      act(() => {
        result.current.setFormData({ allergies: 'Peanuts and Tree Nuts' })
      })

      expect(loadActiveSession()).toBeNull()
    })

    it('2D: Non-safety profile edits preserve active workout session', () => {
      saveActiveSession(buildSession())
      expect(loadActiveSession()).not.toBeNull()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PlanProvider>{children}</PlanProvider>
      )
      const { result } = renderHook(() => usePlan(), { wrapper })

      act(() => {
        result.current.setFormData({ pushupCount: '30', fitnessLevel: 'advanced' })
      })

      expect(loadActiveSession()).not.toBeNull()
    })
  })

  // =========================================================================
  // 3. Cross-Tab Medical Profile Invalidation
  // =========================================================================
  describe('3: Cross-Tab Medical Profile Invalidation', () => {
    it('3A [FAIL-CLOSED]: Remote tab changing medical profile clears local active session (even with same planId)', () => {
      // Seed Tab 1 with plan_active_001 and safeProfile
      const initialPlan: PlanState = {
        ...initialState,
        formData: { ...safeProfile },
        boundProfile: { ...safeProfile },
        planId: 'plan_active_001',
        isGenerated: true,
        stateVersion: { counter: 1, timestamp: Date.now() - 1000, writerId: 'tab_local_001' },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialPlan))

      saveActiveSession(buildSession({ planId: 'plan_active_001', medicalSnapshot: 'None' }))
      expect(loadActiveSession()).not.toBeNull()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PlanProvider>{children}</PlanProvider>
      )
      renderHook(() => usePlan(), { wrapper })

      // Simulate StorageEvent from Tab 2: SAME planId, but medical profile changed to herniated disc
      const remoteState: PlanState = {
        ...initialState,
        formData: { ...safeProfile, medicalIssues: 'Lumbar disc herniation' },
        planId: 'plan_active_001', // exact same planId!
        isGenerated: true,
        stateVersion: { counter: 2, timestamp: Date.now() + 100, writerId: 'tab_remote_999' },
      }

      act(() => {
        const event = new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: JSON.stringify(remoteState),
          storageArea: localStorage,
        })
        window.dispatchEvent(event)
      })

      // Active session MUST be purged locally because medical profile diverged!
      expect(loadActiveSession()).toBeNull()
    })

    it('3B: Remote tab non-safety update with same planId preserves local active session', () => {
      // Seed Tab 1 with plan_active_001 and safeProfile
      const initialPlan: PlanState = {
        ...initialState,
        formData: { ...safeProfile },
        boundProfile: { ...safeProfile },
        planId: 'plan_active_001',
        isGenerated: true,
        stateVersion: { counter: 1, timestamp: Date.now() - 1000, writerId: 'tab_local_001' },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialPlan))

      saveActiveSession(buildSession({ planId: 'plan_active_001', medicalSnapshot: 'None' }))
      expect(loadActiveSession()).not.toBeNull()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <PlanProvider>{children}</PlanProvider>
      )
      renderHook(() => usePlan(), { wrapper })

      // Remote tab logs weight, SAME planId, SAME medical profile
      const remoteState: PlanState = {
        ...initialState,
        formData: { ...safeProfile },
        planId: 'plan_active_001',
        isGenerated: true,
        weightLog: [{ date: '2026-09-05', weight: 61 }],
        stateVersion: { counter: 2, timestamp: Date.now() + 100, writerId: 'tab_remote_999' },
      }

      act(() => {
        const event = new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: JSON.stringify(remoteState),
          storageArea: localStorage,
        })
        window.dispatchEvent(event)
      })

      // Non-safety update with same planId and unchanged medical profile preserves active session
      expect(loadActiveSession()).not.toBeNull()
    })
  })

  // =========================================================================
  // 4. Bound Profile Fingerprint Tamper Resistance
  // =========================================================================
  describe('4: Bound Profile Fingerprint Tamper Resistance', () => {
    it('4A: Legitimate saved plan carries matching boundProfileFingerprint', () => {
      const planState: PlanState = {
        ...initialState,
        formData: { ...aclProfile },
        boundProfile: { ...aclProfile },
        planId: 'plan_legit_001',
        isGenerated: true,
      }

      const { success, version } = savePersistedStateWithVersion(planState)
      expect(success).toBe(true)
      expect(version).toBeDefined()

      const loaded = loadPersistedState()
      expect(loaded.boundProfile).toBeDefined()
      expect(loaded.boundProfileFingerprint).toBe(computeProfileFingerprint(aclProfile))
    })

    it('4B [FAIL-CLOSED]: Tampered boundProfile with invalid fingerprint is cleared on hydration', () => {
      const validFingerprint = computeProfileFingerprint(aclProfile)
      const tamperedRaw: PlanState = {
        ...initialState,
        formData: { ...aclProfile },
        // Attacker mutates boundProfile to claim "None" in storage without updating fingerprint
        boundProfile: { ...aclProfile, medicalIssues: 'None' },
        boundProfileFingerprint: validFingerprint, // Fingerprint was for ACL profile!
        planId: 'plan_tampered_001',
        isGenerated: true,
        stateVersion: { counter: 1, timestamp: Date.now(), writerId: 'attacker_tab' },
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(tamperedRaw))

      const restored = loadPersistedState()
      // Integrity failure: restored boundProfile MUST be undefined!
      expect(restored.boundProfile).toBeUndefined()
    })

    it('4C [FAIL-CLOSED]: Cleared boundProfile enforces Safety Mismatch Lockout for injured user', () => {
      const restoredFormData = { ...aclProfile }
      const bindingEval = evaluatePlanProfileBinding(restoredFormData, undefined)

      expect(bindingEval.isBound).toBe(false)
      expect(bindingEval.isSafetyMismatched).toBe(true)
      expect(bindingEval.mismatchedSafetyFields).toContain('medicalIssues')
      expect(bindingEval.reason).toContain('Plan has no recorded profile binding')
    })

    it('4D [FAIL-CLOSED]: parseSafeIncomingState also enforces fingerprint verification', () => {
      const tamperedRaw = {
        ...initialState,
        formData: { ...aclProfile },
        boundProfile: { ...aclProfile, medicalIssues: 'None' },
        boundProfileFingerprint: 'bogus_fingerprint_hash',
        planId: 'plan_remote_001',
        isGenerated: true,
        stateVersion: { counter: 5, timestamp: Date.now(), writerId: 'remote_attacker' },
      }

      const safeState = parseSafeIncomingState(JSON.stringify(tamperedRaw))
      expect(safeState).not.toBeNull()
      expect(safeState?.boundProfile).toBeUndefined()
    })
  })

  // =========================================================================
  // 5. Bidirectional loadAndValidateActiveSession
  // =========================================================================
  describe('5: Bidirectional loadAndValidateActiveSession Fail-Closed Invariants', () => {
    it('5A [FAIL-CLOSED]: Rejects active session when user profile cleared injury', () => {
      saveActiveSession(buildSession({
        planId: 'plan_active_001',
        medicalSnapshot: 'Acute ACL tear and ligament reconstruction',
      }))
      expect(loadActiveSession()).not.toBeNull()

      const validated = loadAndValidateActiveSession('plan_active_001', '')
      expect(validated).toBeNull()
      expect(loadActiveSession()).toBeNull()
    })

    it('5B [FAIL-CLOSED]: Rejects active session when user profile cleared injury to "None"', () => {
      saveActiveSession(buildSession({
        planId: 'plan_active_001',
        medicalSnapshot: 'Acute ACL tear and ligament reconstruction',
      }))

      const validated = loadAndValidateActiveSession('plan_active_001', 'None')
      expect(validated).toBeNull()
      expect(loadActiveSession()).toBeNull()
    })

    it('5C [FAIL-CLOSED]: Rejects active session when user profile acquired new injury', () => {
      saveActiveSession(buildSession({
        planId: 'plan_active_001',
        medicalSnapshot: 'None',
      }))

      const validated = loadAndValidateActiveSession('plan_active_001', 'Rotator cuff tear')
      expect(validated).toBeNull()
      expect(loadActiveSession()).toBeNull()
    })

    it('5D: Accepts benign session between "None" and empty string', () => {
      saveActiveSession(buildSession({
        planId: 'plan_active_001',
        medicalSnapshot: 'None',
      }))

      const validated = loadAndValidateActiveSession('plan_active_001', '')
      expect(validated).not.toBeNull()
      expect(validated?.sessionId).toBe('sess_test_trust_001')
    })

    it('5E: Accepts matching safe exercises under declared medical condition', () => {
      saveActiveSession(buildSession({
        planId: 'plan_active_001',
        medicalSnapshot: 'Acute ACL tear and ligament reconstruction',
        exercises: [
          {
            id: 'ex_safe',
            name: 'Seated Dumbbell Bicep Curls',
            focus: 'Arms',
            equipment: 'Dumbbells',
            targetSets: 3,
            targetReps: '10',
            restSeconds: 60,
            sets: [{ setIndex: 1, reps: '10', weightLbs: '20', isCompleted: true, completedAt: null }],
          },
        ],
      }))

      const validated = loadAndValidateActiveSession(
        'plan_active_001',
        'Acute ACL tear and ligament reconstruction'
      )
      expect(validated).not.toBeNull()
      expect(validated?.sessionId).toBe('sess_test_trust_001')
    })
  })
})
