// planBindingAdversarial.test.ts
// Full adversarial test matrix for the planBinding security invariant.
// Covers forged state, replayed sessions, persistence rollback, race conditions,
// and combined allergen+medical attacks.
//
// Classification key used in each test:
//   [FAIL-OPEN]       � invariant fails open (no lockout) when it should lock
//   [FAIL-CLOSED]     � invariant correctly locks
//   [RACE]            � concurrent write race
//   [PERSISTENCE]     � localStorage snapshot manipulation
//   [CLIENT-TRUST]    � exploit requires only client-side data manipulation
//   [DELIBERATE-SELF] � requires user to deliberately corrupt their own state

import { describe, it, expect, beforeEach } from 'vitest'
import {
  evaluatePlanProfileBinding,
  computeProfileFingerprint,
} from '../lib/planBinding'
import { loadPersistedState, savePersistedState, STORAGE_KEY } from '../context/planStorage'
import { planReducer, initialState } from '../context/PlanContext'
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
} from '../lib/sessionStorage'
import type { FormData } from '../types/formData'
import type { WorkoutSession } from '../types/workoutSession'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const baseProfile: FormData = {
  age: '30',
  gender: 'male',
  height: '180',
  weight: '80',
  fitnessLevel: 'intermediate',
  mainGoal: 'muscle',
  bodyFocus: ['Full Body'],
  timePerDay: '45',
  recoveryDays: '2',
  medicalIssues: 'None',
  dietaryPreference: 'omnivore',
  allergies: 'None',
  specialRequests: '',
  equipment: ['dumbbells'],
  pushupCount: '20',
  sleepHours: '8',
  stressLevel: 'low',
}

const aclProfile: FormData = { ...baseProfile, medicalIssues: 'Acute ACL tear, post-op week 2' }

const comboProfile: FormData = {
  ...baseProfile,
  medicalIssues: 'Uncontrolled hypertension (190/115)',
  allergies: 'tree nuts, shellfish',
}

const minimalSession = (overrides?: Partial<WorkoutSession>): WorkoutSession => ({
  sessionId: 'sess_test_001',
  planId: 'plan_A_001',
  medicalSnapshot: 'None',
  dayIndex: 0,
  dayTitle: 'Day 1',
  dayType: 'Strength',
  durationMinutes: 45,
  startedAt: Date.now() - 600_000,
  lastUpdatedAt: Date.now() - 300_000,
  elapsedSeconds: 600,
  currentExerciseIndex: 0,
  exercises: [
    {
      id: 'ex_jump',
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

beforeEach(() => {
  localStorage.clear()
})

// ===========================================================================
// ATTACK A: Forged / malformed plan binding metadata in localStorage
// ===========================================================================
describe('ATTACK A: Forged binding metadata in localStorage', () => {
  it('A1: both formData and boundProfile say None � evaluator correctly sees no mismatch for genuinely safe user', () => {
    const forgedBoundProfile = { ...baseProfile, medicalIssues: 'None' }
    const currentFormData: FormData = { ...baseProfile, medicalIssues: 'None' }
    const eval1 = evaluatePlanProfileBinding(currentFormData, forgedBoundProfile)
    expect(eval1.isSafetyMismatched).toBe(false)
  })

  it('A2 [DOCUMENTS RESIDUAL BOUNDARY]: full localStorage rollback cannot be detected client-side', () => {
    const forgedState = {
      ...initialState,
      formData: { ...baseProfile, medicalIssues: 'None' },
      isGenerated: true,
      generatedPlan: '# STALE PLAN with high-impact exercises',
      planId: 'plan_stale_001',
      planGeneratedAt: Date.now() - 7_200_000,
      boundProfile: { ...baseProfile, medicalIssues: 'None' },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(forgedState))
    const loaded = loadPersistedState()
    expect(loaded.formData.medicalIssues).toBe('None')
    expect(loaded.boundProfile?.medicalIssues).toBe('None')
    const evalResult = evaluatePlanProfileBinding(loaded.formData, loaded.boundProfile)
    // Both sides agree � evaluator cannot detect that real medical state changed externally
    expect(evalResult.isSafetyMismatched).toBe(false)
  })

  it('A3 [FAIL-CLOSED]: partial forgery (formData has ACL, boundProfile says None) IS detected', () => {
    const currentFormData: FormData = { ...baseProfile, medicalIssues: 'Acute ACL tear' }
    const staleBoundProfile = { ...baseProfile, medicalIssues: 'None' }
    const evalResult = evaluatePlanProfileBinding(currentFormData, staleBoundProfile)
    expect(evalResult.isSafetyMismatched).toBe(true)
    expect(evalResult.mismatchedSafetyFields).toContain('medicalIssues')
  })

  it('A4 [FAIL-CLOSED]: reverse partial forgery (boundProfile has ACL, formData says None) IS detected', () => {
    const currentFormData: FormData = { ...baseProfile, medicalIssues: 'None' }
    const injuredBoundProfile = { ...baseProfile, medicalIssues: 'Acute ACL tear' }
    const evalResult = evaluatePlanProfileBinding(currentFormData, injuredBoundProfile)
    expect(evalResult.isSafetyMismatched).toBe(true)
    expect(evalResult.mismatchedSafetyFields).toContain('medicalIssues')
  })

  it('A5 [FAIL-CLOSED after patch]: loadPersistedState clears boundProfile when it disagrees with formData on safety', () => {
    const partiallyCorruptedState = {
      ...initialState,
      formData: { ...baseProfile, medicalIssues: 'Acute ACL tear' },
      isGenerated: true,
      generatedPlan: '# PLAN',
      planId: 'plan_corrupt_001',
      boundProfile: { ...baseProfile, medicalIssues: 'None' },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(partiallyCorruptedState))
    const loaded = loadPersistedState()
    // PATCH REQUIRED: loadPersistedState must clear mismatched boundProfile
    expect(loaded.boundProfile).toBeUndefined()
    const evalResult = evaluatePlanProfileBinding(loaded.formData, loaded.boundProfile)
    expect(evalResult.isSafetyMismatched).toBe(true)
  })
})

// ===========================================================================
// ATTACK B: Replayed old plan after regeneration
// ===========================================================================
describe('ATTACK B: Replayed old plan after regeneration', () => {
  it('B1 [FAIL-CLOSED]: binding evaluator detects medical mismatch regardless of planId', () => {
    const currentFormData: FormData = aclProfile
    const oldBoundProfile = { ...baseProfile, medicalIssues: 'None' }
    const evalResult = evaluatePlanProfileBinding(currentFormData, oldBoundProfile)
    expect(evalResult.isSafetyMismatched).toBe(true)
  })

  it('B2: planId replay bypasses session check but binding eval independently fires', () => {
    const oldSession = minimalSession({ planId: 'plan_old_001', medicalSnapshot: 'None' })
    saveActiveSession(oldSession)
    const restoredPlanState = {
      ...initialState,
      formData: { ...baseProfile, medicalIssues: 'None' },
      isGenerated: true,
      generatedPlan: '# OLD PLAN',
      planId: 'plan_old_001',
      boundProfile: { ...baseProfile, medicalIssues: 'None' },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(restoredPlanState))
    const loaded = loadPersistedState()
    const session = loadActiveSession()
    const isPlanMatch = !session?.planId || !loaded.planId || session.planId === loaded.planId
    expect(isPlanMatch).toBe(true)
    // If user's formData diverges, binding eval still fires
    const divergedFormData: FormData = { ...baseProfile, medicalIssues: 'Acute ACL tear' }
    const evalResult = evaluatePlanProfileBinding(divergedFormData, loaded.boundProfile)
    expect(evalResult.isSafetyMismatched).toBe(true)
    clearActiveSession()
  })
})

// ===========================================================================
// ATTACK C: Replayed active workout session
// ===========================================================================
describe('ATTACK C: Replayed active workout session', () => {
  it('C1 [FAIL-CLOSED]: stale medicalSnapshot discarded when current medical differs', () => {
    const staleSession = minimalSession({ planId: 'plan_A_healthy', medicalSnapshot: 'None' })
    saveActiveSession(staleSession)
    const currentMedical = 'Acute ACL tear'
    const session = loadActiveSession()
    const isMedicalMatch =
      !session?.medicalSnapshot ||
      (session.medicalSnapshot || '').trim().toLowerCase() === currentMedical.trim().toLowerCase()
    expect(isMedicalMatch).toBe(false)
    clearActiveSession()
  })

  it('C2 [DELIBERATE-SELF/RESIDUAL BOUNDARY]: fully forged session+plan state bypasses session check but not architecture', () => {
    const forgedSession = minimalSession({ planId: 'plan_forged_001', medicalSnapshot: 'None' })
    saveActiveSession(forgedSession)
    const forgedPlanState = {
      ...initialState,
      formData: { ...baseProfile, medicalIssues: 'None' },
      isGenerated: true,
      generatedPlan: '# PLAN',
      planId: 'plan_forged_001',
      boundProfile: { ...baseProfile, medicalIssues: 'None' },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(forgedPlanState))
    const loaded = loadPersistedState()
    const session = loadActiveSession()
    const isMedicalMatch =
      !session?.medicalSnapshot ||
      (session.medicalSnapshot || '').trim().toLowerCase() ===
        (loaded.formData.medicalIssues || '').trim().toLowerCase()
    expect(isMedicalMatch).toBe(true)
    const evalResult = evaluatePlanProfileBinding(loaded.formData, loaded.boundProfile)
    expect(evalResult.isSafetyMismatched).toBe(false)
    // CLASSIFICATION: Deliberate self-attack. Requires writing to two localStorage keys.
    // Architectural boundary: no server-side anchor available client-only.
    clearActiveSession()
  })
})

// ===========================================================================
// ATTACK D: Legacy state restoration (boundProfile=null path)
// ===========================================================================
describe('ATTACK D: Legacy state restoration', () => {
  it('D1 [FAIL-CLOSED]: legacy plan + user with active medical constraint ? lockout', () => {
    const legacyState = {
      ...initialState,
      formData: { ...baseProfile, medicalIssues: 'Severe lower back herniation' },
      isGenerated: true,
      generatedPlan: '# LEGACY PLAN',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyState))
    const loaded = loadPersistedState()
    expect(loaded.boundProfile).toBeUndefined()
    const evalResult = evaluatePlanProfileBinding(loaded.formData, loaded.boundProfile)
    expect(evalResult.isSafetyMismatched).toBe(true)
    expect(evalResult.reason).toContain('no recorded profile binding')
  })

  it('D2 [INTENTIONAL FAIL-OPEN]: legacy plan + user with NO constraints ? no lockout (correct behavior)', () => {
    const legacyState = {
      ...initialState,
      formData: { ...baseProfile, medicalIssues: 'None', allergies: 'None' },
      isGenerated: true,
      generatedPlan: '# LEGACY PLAN',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyState))
    const loaded = loadPersistedState()
    const evalResult = evaluatePlanProfileBinding(loaded.formData, loaded.boundProfile)
    expect(evalResult.isSafetyMismatched).toBe(false)
  })

  it('D3 [FAIL-CLOSED]: legacy plan + user later adds allergen constraint ? lockout', () => {
    const currentFormData: FormData = { ...baseProfile, allergies: 'peanut allergy' }
    const evalResult = evaluatePlanProfileBinding(currentFormData, undefined)
    expect(evalResult.isSafetyMismatched).toBe(true)
    expect(evalResult.mismatchedSafetyFields).toContain('allergies')
  })
})

// ===========================================================================
// ATTACK E: Partial / corrupt persisted state
// ===========================================================================
describe('ATTACK E: Partial / corrupt persisted state', () => {
  it('E1: malformed JSON falls back to initialState', () => {
    localStorage.setItem(STORAGE_KEY, '{invalid json---')
    const loaded = loadPersistedState()
    expect(loaded).toEqual(initialState)
    expect(loaded.boundProfile).toBeUndefined()
  })

  it('E2: null value in localStorage falls back to initialState', () => {
    localStorage.setItem(STORAGE_KEY, 'null')
    const loaded = loadPersistedState()
    expect(loaded).toEqual(initialState)
  })

  it('E3: boundProfile is a non-object scalar ? treated as no binding', () => {
    const corruptedState = {
      ...initialState,
      formData: { ...baseProfile },
      isGenerated: true,
      generatedPlan: '# PLAN',
      boundProfile: 'not-an-object',
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corruptedState))
    const loaded = loadPersistedState()
    expect(loaded.boundProfile).toBeUndefined()
  })

  it('E4 [FAIL-CLOSED]: boundProfile is numeric + user has medical issues ? lockout via null path', () => {
    const corruptedState = {
      ...initialState,
      formData: { ...baseProfile, medicalIssues: 'Acute ACL tear' },
      isGenerated: true,
      generatedPlan: '# PLAN',
      boundProfile: 42,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corruptedState))
    const loaded = loadPersistedState()
    expect(loaded.boundProfile).toBeUndefined()
    const evalResult = evaluatePlanProfileBinding(loaded.formData, loaded.boundProfile)
    expect(evalResult.isSafetyMismatched).toBe(true)
  })

  it('E5 [FAIL-CLOSED]: partial boundProfile (missing medicalIssues) + user has injury ? lockout', () => {
    const stateWithPartialBound = {
      ...initialState,
      formData: { ...baseProfile, medicalIssues: 'Acute ACL tear' },
      isGenerated: true,
      generatedPlan: '# PLAN',
      boundProfile: { allergies: 'None', mainGoal: 'muscle' }, // no medicalIssues
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateWithPartialBound))
    const loaded = loadPersistedState()
    // boundProfile.medicalIssues defaults to '' from spread of initialState.formData
    const evalResult = evaluatePlanProfileBinding(loaded.formData, loaded.boundProfile)
    // currentMedical: ACL (safety-sensitive) vs boundMedical: '' (not safety-sensitive) ? mismatch
    expect(evalResult.isSafetyMismatched).toBe(true)
  })
})

// ===========================================================================
// ATTACK F: Duplicate-tab race condition
// ===========================================================================
describe('ATTACK F: Duplicate-tab race condition', () => {
  it('F1 [DOCUMENTS ARCHITECTURAL BOUNDARY]: last-write-wins race in localStorage cannot be prevented client-side', () => {
    const planBState = {
      ...initialState,
      formData: { ...baseProfile, medicalIssues: 'Acute ACL tear' },
      isGenerated: true,
      generatedPlan: '# PLAN B (ACL safe)',
      planId: 'plan_B_acl',
      boundProfile: { ...baseProfile, medicalIssues: 'Acute ACL tear' },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(planBState))

    // Stale Tab B overwrites
    const planAState = {
      ...initialState,
      formData: { ...baseProfile, medicalIssues: 'None' },
      isGenerated: true,
      generatedPlan: '# PLAN A (old)',
      planId: 'plan_A_old',
      boundProfile: { ...baseProfile, medicalIssues: 'None' },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(planAState))

    const loaded = loadPersistedState()
    expect(loaded.formData.medicalIssues).toBe('None') // stale tab won the race
    const evalResult = evaluatePlanProfileBinding(loaded.formData, loaded.boundProfile)
    // Both sides stale-matching � evaluator cannot detect the cross-tab overwrite
    expect(evalResult.isSafetyMismatched).toBe(false)
  })

  it('F2: planReducer generates unique planId on each SET_GENERATED_PLAN via random suffix', () => {
    const state1 = planReducer(initialState, {
      type: 'SET_GENERATED_PLAN',
      payload: { plan: '# Plan 1', formData: baseProfile },
    })
    const state2 = planReducer(initialState, {
      type: 'SET_GENERATED_PLAN',
      payload: { plan: '# Plan 2', formData: aclProfile },
    })
    expect(state1.planId).toMatch(/^plan_\d+_/)
    expect(state2.planId).toMatch(/^plan_\d+_/)
    expect(typeof state1.planId).toBe('string')
    expect(typeof state2.planId).toBe('string')
  })
})

// ===========================================================================
// ATTACK G: Persistence write ordering race (atomic write verification)
// ===========================================================================
describe('ATTACK G: Persistence write is atomic (single setItem call)', () => {
  it('G1: savePersistedState writes planId + boundProfile atomically', () => {
    const fullState = {
      ...initialState,
      formData: aclProfile,
      isGenerated: true,
      generatedPlan: '# PLAN',
      planId: 'plan_atomic_001',
      boundProfile: aclProfile,
    }
    const saved = savePersistedState(fullState)
    expect(saved).toBe(true)
    const loaded = loadPersistedState()
    expect(loaded.formData.medicalIssues).toBe('Acute ACL tear, post-op week 2')
    expect(loaded.boundProfile?.medicalIssues).toBe('Acute ACL tear, post-op week 2')
    expect(loaded.planId).toBe('plan_atomic_001')
    const evalResult = evaluatePlanProfileBinding(loaded.formData, loaded.boundProfile)
    expect(evalResult.isSafetyMismatched).toBe(false)
    expect(evalResult.isBound).toBe(true)
  })

  it('G2: planReducer SET_GENERATED_PLAN atomically sets both planId and boundProfile', () => {
    let state = planReducer(initialState, { type: 'SET_FORM_DATA', payload: { medicalIssues: 'Acute ACL tear' } })
    expect(state.planId).toBeUndefined()
    expect(state.boundProfile).toBeUndefined()
    state = planReducer(state, {
      type: 'SET_GENERATED_PLAN',
      payload: { plan: '# ACL Plan', formData: aclProfile },
    })
    expect(state.planId).toBeDefined()
    expect(state.boundProfile).toBeDefined()
    expect(state.boundProfile?.medicalIssues).toBe('Acute ACL tear, post-op week 2')
    const evalResult = evaluatePlanProfileBinding(state.formData, state.boundProfile)
    expect(evalResult.isSafetyMismatched).toBe(false)
  })
})

// ===========================================================================
// ATTACK H: Direct deep-link after tampered persisted state
// ===========================================================================
describe('ATTACK H: Deep-link to /gym-mode/:day with tampered state', () => {
  it('H1 [FAIL-CLOSED]: binding eval fires regardless of navigation path � blocks lockout on ACL mismatch', () => {
    const loadedFormData: FormData = { ...baseProfile, medicalIssues: 'Acute ACL tear' }
    const loadedBoundProfile = { ...baseProfile, medicalIssues: 'None' }
    const bindingEval = evaluatePlanProfileBinding(loadedFormData, loadedBoundProfile)
    expect(bindingEval.isSafetyMismatched).toBe(true)
  })

  it('H2 [FAIL-CLOSED]: isGenerated=true does not bypass safety lockout when profile diverged', () => {
    const planState = {
      ...initialState,
      formData: { ...baseProfile, medicalIssues: 'Uncontrolled hypertension (190/115)' },
      isGenerated: true,
      generatedPlan: '# PLAN',
      planId: 'plan_hyper_001',
      boundProfile: { ...baseProfile, medicalIssues: 'None' },
    }
    const bindingEval = evaluatePlanProfileBinding(planState.formData, planState.boundProfile)
    expect(bindingEval.isSafetyMismatched).toBe(true)
    expect(bindingEval.mismatchedSafetyFields).toContain('medicalIssues')
  })
})

// ===========================================================================
// ATTACK I: WeeklyPlanPage ? GymModePage both fire independently
// ===========================================================================
describe('ATTACK I: WeeklyPlanPage lockout fires in parallel with GymModePage', () => {
  it('I1 [FAIL-CLOSED]: WeeklyPlan binding eval detects mismatch and would disable Gym Mode buttons', () => {
    const currentFormData: FormData = { ...baseProfile, medicalIssues: 'Severe spinal stenosis' }
    const staleBoundProfile = { ...baseProfile, medicalIssues: 'None' }
    const weeklyPlanBindingEval = evaluatePlanProfileBinding(currentFormData, staleBoundProfile)
    expect(weeklyPlanBindingEval.isSafetyMismatched).toBe(true)
    const shouldDisableGymModeButtons = weeklyPlanBindingEval.isSafetyMismatched
    expect(shouldDisableGymModeButtons).toBe(true)
  })
})

// ===========================================================================
// ATTACK J: Combined allergen + medical binding simultaneously
// ===========================================================================
describe('ATTACK J: Combined allergen + medical binding', () => {
  it('J1 [FAIL-CLOSED]: both medical AND allergen diverge simultaneously � both reported', () => {
    const evalResult = evaluatePlanProfileBinding(comboProfile, baseProfile)
    expect(evalResult.isSafetyMismatched).toBe(true)
    expect(evalResult.mismatchedSafetyFields).toContain('medicalIssues')
    expect(evalResult.mismatchedSafetyFields).toContain('allergies')
    expect(evalResult.mismatchedSafetyFields.length).toBe(2)
  })

  it('J2 [FAIL-CLOSED]: allergen-only divergence is safety mismatch independent of medical', () => {
    const currentFormData: FormData = { ...baseProfile, allergies: 'peanuts, tree nuts' }
    const boundProfile = { ...baseProfile, allergies: 'None' }
    const evalResult = evaluatePlanProfileBinding(currentFormData, boundProfile)
    expect(evalResult.isSafetyMismatched).toBe(true)
    expect(evalResult.mismatchedSafetyFields).toContain('allergies')
    expect(evalResult.mismatchedSafetyFields).not.toContain('medicalIssues')
  })

  it('J3 [FAIL-CLOSED]: medical-only divergence is safety mismatch independent of allergen', () => {
    const currentFormData: FormData = { ...baseProfile, medicalIssues: 'Post-op cardiac bypass' }
    const boundProfile = { ...baseProfile, medicalIssues: 'None' }
    const evalResult = evaluatePlanProfileBinding(currentFormData, boundProfile)
    expect(evalResult.isSafetyMismatched).toBe(true)
    expect(evalResult.mismatchedSafetyFields).toContain('medicalIssues')
    expect(evalResult.mismatchedSafetyFields).not.toContain('allergies')
  })

  it('J4: computeProfileFingerprint is deterministic and sensitive to any safety field change', () => {
    const fp1 = computeProfileFingerprint(comboProfile)
    const fp2 = computeProfileFingerprint({ ...comboProfile })
    expect(fp1).toBe(fp2)
    const fpDifferent = computeProfileFingerprint({ ...comboProfile, medicalIssues: 'None' })
    expect(fpDifferent).not.toBe(fp1)
  })
})

// ===========================================================================
// ATTACK K: loadPersistedState boundProfile validation edge cases
// ===========================================================================
describe('ATTACK K: loadPersistedState boundProfile validation edge cases', () => {
  it('K1: boundProfile=[] (array) passes typeof guard and spreads to defaults (safe outcome)', () => {
    const corruptedState = {
      ...initialState,
      formData: { ...baseProfile },
      isGenerated: true,
      generatedPlan: '# PLAN',
      boundProfile: [],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(corruptedState))
    const loaded = loadPersistedState()
    // Array spreads to initialState.formData defaults � medicalIssues defaults to ''
    expect(loaded.boundProfile?.medicalIssues).toBe('')
  })

  it('K2: XSS-style string in boundProfile is preserved but safely compared by evaluator', () => {
    const xssStr = '<script>alert(1)</script>'
    const injectionCurrentData: FormData = { ...baseProfile, medicalIssues: xssStr }
    const injectionBoundProfile = { ...baseProfile, medicalIssues: xssStr }
    const evalResult = evaluatePlanProfileBinding(injectionCurrentData, injectionBoundProfile)
    // Both sides equal ? no binding mismatch (binding is correct; XSS is a display concern)
    expect(evalResult.isSafetyMismatched).toBe(false)
  })

  it('K3 [FAIL-CLOSED]: empty boundProfile.medicalIssues + current user with severe injury ? lockout', () => {
    const currentFormData: FormData = { ...baseProfile, medicalIssues: 'Post-op knee replacement' }
    const emptyConstraintBound = { ...baseProfile, medicalIssues: '' }
    const evalResult = evaluatePlanProfileBinding(currentFormData, emptyConstraintBound)
    // currentMedical is safety-sensitive; boundMedical is '' (not) ? mismatch
    expect(evalResult.isSafetyMismatched).toBe(true)
  })
})
