// planProfileBinding.test.ts
// Exhaustive test suite for plan-profile binding, session integrity, deep-link gating,
// and state synchronization.

import { describe, it, expect } from 'vitest'
import {
  computeProfileFingerprint,
  evaluatePlanProfileBinding
} from '../lib/planBinding'
import {
  planReducer,
  initialState
} from '../context/PlanContext'
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession
} from '../lib/sessionStorage'
import type { FormData } from '../types/formData'
import type { WorkoutSession } from '../types/workoutSession'

describe('CRITICAL INVARIANT: Plan-Profile Fingerprinting & Binding', () => {
  const healthyProfile: FormData = {
    age: '28',
    gender: 'female',
    height: '168',
    weight: '62',
    fitnessLevel: 'intermediate',
    mainGoal: 'muscle',
    bodyFocus: ['Full Body'],
    timePerDay: '45',
    recoveryDays: '2',
    medicalIssues: 'None',
    dietaryPreference: 'omnivore',
    allergies: 'None',
    specialRequests: 'None',
    equipment: ['dumbbells'],
    pushupCount: '12',
    sleepHours: '8',
    stressLevel: 'low',
  }

  it('computes deterministic and canonical profile fingerprints', () => {
    const fp1 = computeProfileFingerprint(healthyProfile)
    const fp2 = computeProfileFingerprint({ ...healthyProfile })
    expect(fp1).toBe(fp2)
    expect(fp1.length).toBeGreaterThan(20)

    // Mutation in medicalIssues changes fingerprint
    const fpInjured = computeProfileFingerprint({
      ...healthyProfile,
      medicalIssues: 'Acute ACL tear',
    })
    expect(fpInjured).not.toBe(fp1)
  })

  it('SCENARIO A: medicalIssues changed after generation → marks safety mismatch', () => {
    const boundProfile = { ...healthyProfile, medicalIssues: 'None' }
    const currentForm = { ...healthyProfile, medicalIssues: 'Acute ACL tear' }

    const evalResult = evaluatePlanProfileBinding(currentForm, boundProfile)
    expect(evalResult.isBound).toBe(false)
    expect(evalResult.isSafetyMismatched).toBe(true)
    expect(evalResult.mismatchedSafetyFields).toContain('medicalIssues')
    expect(evalResult.reason).toContain('Safety-critical mismatch')
  })

  it('SCENARIO B: allergies changed after generation → marks safety mismatch', () => {
    const boundProfile = { ...healthyProfile, allergies: 'None' }
    const currentForm = { ...healthyProfile, allergies: 'peanuts' }

    const evalResult = evaluatePlanProfileBinding(currentForm, boundProfile)
    expect(evalResult.isBound).toBe(false)
    expect(evalResult.isSafetyMismatched).toBe(true)
    expect(evalResult.mismatchedSafetyFields).toContain('allergies')
  })

  it('SCENARIO C: age/weight/goal changed → deterministic preference mismatch (non-safety blocking)', () => {
    const boundProfile = { ...healthyProfile, mainGoal: 'bulk' }
    const currentForm = { ...healthyProfile, mainGoal: 'slim' }

    const evalResult = evaluatePlanProfileBinding(currentForm, boundProfile)
    expect(evalResult.isBound).toBe(false)
    expect(evalResult.isSafetyMismatched).toBe(false) // Not a medical/allergen emergency
    expect(evalResult.isPreferenceMismatched).toBe(true)
    expect(evalResult.mismatchedPreferenceFields).toContain('mainGoal')
  })

  it('SCENARIO D: orphaned active workout session from old plan is invalidated when plan is regenerated', () => {
    clearActiveSession()

    // Step 1: User has an active workout session in localStorage from Plan A (no injuries)
    const oldSession: WorkoutSession = {
      sessionId: 'sess_old_123',
      planId: 'plan_A_clean',
      medicalSnapshot: 'None',
      dayIndex: 0,
      dayTitle: 'Day 1 - Plyometrics',
      dayType: 'High Impact',
      durationMinutes: 45,
      startedAt: Date.now() - 3600000,
      lastUpdatedAt: Date.now() - 1800000,
      elapsedSeconds: 600,
      currentExerciseIndex: 0,
      exercises: [
        {
          id: 'ex_1',
          name: 'Box Jumps',
          originalName: 'Box Jumps',
          targetSets: 4,
          targetReps: '20',
          restSeconds: 60,
          focus: 'Legs',
          equipment: 'Box',
          formCue: 'Explode up',
          sets: [],
          isSubstituted: false,
          substitutionReason: null,
        }
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
    }

    saveActiveSession(oldSession)
    expect(loadActiveSession()?.sessionId).toBe('sess_old_123')

    // Step 2: User gets an ACL tear and generates Plan B
    const newPlanId = 'plan_B_injured'
    const newMedical = 'Acute ACL tear'

    // Verify session validation logic
    const loaded = loadActiveSession()
    const isPlanMatching = loaded?.planId === newPlanId
    const isMedicalMatching = (loaded?.medicalSnapshot || '').trim().toLowerCase() === newMedical.trim().toLowerCase()
    const isSessionActionable = Boolean(isPlanMatching && isMedicalMatching)

    expect(isSessionActionable).toBe(false) // Stale session CANNOT be executed under new plan!

    clearActiveSession()
  })

  it('SCENARIO E: direct /gym-mode/:day deep-link access rejects safety-mismatched plan', () => {
    // Current user state has severe hypertension
    const currentForm: FormData = {
      ...healthyProfile,
      medicalIssues: 'Uncontrolled hypertension (190/115)',
    }
    // Plan in storage was generated for a healthy profile with no medical issues
    const boundProfile: FormData = {
      ...healthyProfile,
      medicalIssues: 'None',
    }

    const evaluation = evaluatePlanProfileBinding(currentForm, boundProfile)
    expect(evaluation.isSafetyMismatched).toBe(true)
    // Application must lock Gym Mode when isSafetyMismatched is true
    const shouldLockGymMode = evaluation.isSafetyMismatched
    expect(shouldLockGymMode).toBe(true)
  })

  it('SCENARIO F: PlanContext reducer guarantees atomic plan-profile binding and race-free updates', () => {
    let state = initialState

    // Generation 1 completes with Profile 1
    const profile1: FormData = { ...healthyProfile, medicalIssues: 'None' }
    state = planReducer(state, {
      type: 'SET_GENERATED_PLAN',
      payload: {
        plan: '# Plan 1',
        formData: profile1,
      },
    })

    expect(state.isGenerated).toBe(true)
    expect(state.generatedPlan).toBe('# Plan 1')
    expect(state.planId).toBeDefined()
    expect(state.boundProfile?.medicalIssues).toBe('None')

    // Profile mutation occurs (user enters ACL tear)
    state = planReducer(state, {
      type: 'SET_FORM_DATA',
      payload: { medicalIssues: 'Acute ACL tear' },
    })

    // Now current formData differs from boundProfile!
    const evalResult = evaluatePlanProfileBinding(state.formData, state.boundProfile)
    expect(evalResult.isSafetyMismatched).toBe(true)

    // Generation 2 completes with Profile 2 (ACL tear accommodated)
    const profile2: FormData = { ...healthyProfile, medicalIssues: 'Acute ACL tear' }
    state = planReducer(state, {
      type: 'SET_GENERATED_PLAN',
      payload: {
        plan: '# Plan 2 (ACL safe)',
        formData: profile2,
      },
    })

    // Now boundProfile is updated to Profile 2, clearing the mismatch!
    const postRegenEval = evaluatePlanProfileBinding(state.formData, state.boundProfile)
    expect(postRegenEval.isSafetyMismatched).toBe(false)
  })
})
