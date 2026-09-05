import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GymModePage } from '../pages/GymModePage'
// crossTabSync.test.ts
// Comprehensive adversarial test suite for cross-tab state synchronization,
// Lamport total-ordering protocol, feedback-loop elimination, and runtime session safety.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { PlanProvider, usePlan, initialState, defaultFormData, PlanState, StateVersion } from '../context/PlanContext'
import {
  savePersistedStateWithVersion,
  loadPersistedState,
  compareVersions,
  getTabWriterId,
  STORAGE_KEY,
} from '../context/planStorage'
import {
  saveActiveSession,
  loadActiveSession,
  ACTIVE_SESSION_STORAGE_KEY,
} from '../lib/sessionStorage'
import { evaluatePlanProfileBinding } from '../lib/planBinding'
import type { WorkoutSession } from '../types/workoutSession'
import type { FormData } from '../types/formData'

const sampleProfile: FormData = {
  ...defaultFormData,
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
  equipment: ['dumbbells'],
}

const mockWorkoutSession = (overrides?: Partial<WorkoutSession>): WorkoutSession => ({
  sessionId: 'sess_live_123',
  planId: 'plan_healthy_001',
  medicalSnapshot: 'None',
  dayIndex: 0,
  dayTitle: 'Day 1 - Plyometrics',
  dayType: 'High Impact',
  durationMinutes: 45,
  startedAt: Date.now() - 300_000,
  lastUpdatedAt: Date.now() - 60_000,
  elapsedSeconds: 240,
  currentExerciseIndex: 0,
  exercises: [
    {
      id: 'ex_box_jump',
      name: 'Box Jumps',
      originalName: 'Box Jumps',
      targetSets: 4,
      targetReps: '20',
      restSeconds: 60,
      focus: 'Legs',
      equipment: 'Box',
      formCue: 'Explosive jump',
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

describe('CROSS-TAB SYNCHRONIZATION & ORDERING PROTOCOL', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // T1: Two tabs start at same revision and both write
  // -------------------------------------------------------------------------
  it('T1: two tabs start at same revision and both write -> deterministic total order via compareVersions', () => {
    const vA: StateVersion = { counter: 1, timestamp: 1000, writerId: 'tab_A' }
    const vB: StateVersion = { counter: 1, timestamp: 1000, writerId: 'tab_B' }

    // Same counter, same timestamp: writerId breaks tie deterministically
    const cmpAB = compareVersions(vA, vB)
    const cmpBA = compareVersions(vB, vA)

    expect(cmpAB).toBeLessThan(0) // 'tab_A' < 'tab_B'
    expect(cmpBA).toBeGreaterThan(0) // 'tab_B' > 'tab_A'
    expect(cmpAB).toBe(-cmpBA) // Antisymmetric

    // Both tabs agree that tab_B is the authoritative winner
    const winningVersion = cmpAB > 0 ? vA : vB
    expect(winningVersion.writerId).toBe('tab_B')
  })

  // -------------------------------------------------------------------------
  // T2: Concurrent medical-profile update across tabs
  // -------------------------------------------------------------------------
  it('T2: Tab B changes medical profile -> Tab A receives StorageEvent and updates state', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlanProvider>{children}</PlanProvider>
    )

    const { result } = renderHook(() => usePlan(), { wrapper })

    // Tab A initializes with healthy profile
    expect(result.current.state.formData.medicalIssues).toBe('')

    // Tab B writes new state with ACL tear and higher version
    const tabBState: PlanState = {
      ...initialState,
      formData: { ...sampleProfile, medicalIssues: 'Acute ACL tear' },
      isGenerated: true,
      generatedPlan: '# Safe ACL Plan',
      planId: 'plan_acl_002',
      boundProfile: { ...sampleProfile, medicalIssues: 'Acute ACL tear' },
      stateVersion: { counter: 2, timestamp: Date.now(), writerId: 'tab_B' },
    }

    const rawPayload = JSON.stringify(tabBState)
    localStorage.setItem(STORAGE_KEY, rawPayload)

    // Simulate StorageEvent fired by browser to Tab A
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: rawPayload,
          oldValue: null,
          storageArea: localStorage,
        })
      )
    })

    // Tab A promptly updates to Tab B's ACL-bearing profile without page reload
    expect(result.current.state.formData.medicalIssues).toBe('Acute ACL tear')
    expect(result.current.state.planId).toBe('plan_acl_002')
    expect(result.current.state.isGenerated).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T3: Concurrent allergy update across tabs
  // -------------------------------------------------------------------------
  it('T3: Tab B changes allergies -> Tab A receives StorageEvent and marks safety mismatch if plan not regenerated', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlanProvider>{children}</PlanProvider>
    )

    const { result } = renderHook(() => usePlan(), { wrapper })

    // Tab B writes state where user declared peanut allergy, but plan was generated when bound to None
    const tabBState: PlanState = {
      ...initialState,
      formData: { ...sampleProfile, allergies: 'peanuts' },
      isGenerated: true,
      generatedPlan: '# Old Plan without peanut awareness',
      planId: 'plan_old_001',
      boundProfile: { ...sampleProfile, allergies: 'None' }, // stale binding!
      stateVersion: { counter: 2, timestamp: Date.now(), writerId: 'tab_B' },
    }

    const rawPayload = JSON.stringify(tabBState)
    localStorage.setItem(STORAGE_KEY, rawPayload)

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: rawPayload,
          oldValue: null,
          storageArea: localStorage,
        })
      )
    })

    // Tab A receives the allergy update
    expect(result.current.state.formData.allergies).toBe('peanuts')

    // Tab A's binding evaluation immediately identifies the safety-critical mismatch!
    const binding = evaluatePlanProfileBinding(
      result.current.state.formData,
      result.current.state.boundProfile
    )
    expect(binding.isSafetyMismatched).toBe(true)
    expect(binding.mismatchedSafetyFields).toContain('allergies')
  })

  // -------------------------------------------------------------------------
  // T4: Legitimate update from a tab with numerically lower local counter
  // -------------------------------------------------------------------------
  it('T4: Lamport advancement rule ensures writes advance past storage counter even if local counter was lower', () => {
    // Tab A previously wrote counter 5 to storage
    const stateInStorage: PlanState = {
      ...initialState,
      formData: { ...sampleProfile },
      stateVersion: { counter: 5, timestamp: 1000, writerId: 'tab_A' },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateInStorage))

    // Tab B was idle in the background with local counter 1
    const tabBLocalState: PlanState = {
      ...initialState,
      formData: { ...sampleProfile, medicalIssues: 'Acute ACL tear' },
      stateVersion: { counter: 1, timestamp: 500, writerId: 'tab_B' },
    }

    // Tab B writes to storage using savePersistedStateWithVersion
    const saveResult = savePersistedStateWithVersion(tabBLocalState, 'tab_B')
    expect(saveResult.success).toBe(true)
    expect(saveResult.version).toBeDefined()

    // Counter must be Math.max(1, 5) + 1 = 6!
    expect(saveResult.version!.counter).toBe(6)
    expect(saveResult.version!.counter).toBeGreaterThan(5)

    // When Tab A compares Tab B's write (counter 6) against Tab A's old version (counter 5),
    // Tab B's write is accepted!
    const cmp = compareVersions(saveResult.version, stateInStorage.stateVersion)
    expect(cmp).toBeGreaterThan(0)
  })

  // -------------------------------------------------------------------------
  // T5: Stale event arriving after newer event
  // -------------------------------------------------------------------------
  it('T5: stale event arriving after newer event is rejected', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlanProvider>{children}</PlanProvider>
    )

    const { result } = renderHook(() => usePlan(), { wrapper })

    // 1. Deliver newer event (counter 10)
    const newerState: PlanState = {
      ...initialState,
      formData: { ...sampleProfile, medicalIssues: 'Newer Medical State' },
      stateVersion: { counter: 10, timestamp: 2000, writerId: 'tab_X' },
    }
    const newerPayload = JSON.stringify(newerState)

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: newerPayload,
          oldValue: null,
          storageArea: localStorage,
        })
      )
    })

    expect(result.current.state.formData.medicalIssues).toBe('Newer Medical State')

    // 2. Deliver older/stale event (counter 5)
    const olderState: PlanState = {
      ...initialState,
      formData: { ...sampleProfile, medicalIssues: 'Stale Medical State' },
      stateVersion: { counter: 5, timestamp: 1000, writerId: 'tab_Y' },
    }
    const olderPayload = JSON.stringify(olderState)

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: olderPayload,
          oldValue: newerPayload,
          storageArea: localStorage,
        })
      )
    })

    // Stale event was rejected; current state remains the newer state
    expect(result.current.state.formData.medicalIssues).toBe('Newer Medical State')
  })

  // -------------------------------------------------------------------------
  // T6: Duplicate event idempotence
  // -------------------------------------------------------------------------
  it('T6: duplicate event is completely idempotent and causes no state mutation', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlanProvider>{children}</PlanProvider>
    )

    const { result } = renderHook(() => usePlan(), { wrapper })

    const statePayload: PlanState = {
      ...initialState,
      formData: { ...sampleProfile, weight: '82' },
      stateVersion: { counter: 3, timestamp: 1500, writerId: 'tab_Z' },
    }
    const raw = JSON.stringify(statePayload)

    // First delivery
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: raw,
          oldValue: null,
          storageArea: localStorage,
        })
      )
    })
    expect(result.current.state.formData.weight).toBe('82')
    const refAfterFirst = result.current.state

    // Duplicate delivery of exact same version
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: raw,
          oldValue: raw,
          storageArea: localStorage,
        })
      )
    })

    // Reference and content remain identical (no useless re-dispatch)
    expect(result.current.state).toBe(refAfterFirst)
  })

  // -------------------------------------------------------------------------
  // T7: Remote event does not cause infinite persistence echo
  // -------------------------------------------------------------------------
  it('T7: remote event adoption does NOT call localStorage.setItem (no echo loop)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlanProvider>{children}</PlanProvider>
    )

    const { result } = renderHook(() => usePlan(), { wrapper })
    setItemSpy.mockClear()

    const incomingState: PlanState = {
      ...initialState,
      formData: { ...sampleProfile, fitnessLevel: 'advanced' },
      stateVersion: { counter: 4, timestamp: 1800, writerId: 'tab_Remote' },
    }
    const raw = JSON.stringify(incomingState)

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: raw,
          oldValue: null,
          storageArea: localStorage,
        })
      )
    })

    expect(result.current.state.formData.fitnessLevel).toBe('advanced')

    // CRITICAL INVARIANT: Adopting a remote event must NOT write back to localStorage!
    // If it did, it would emit a StorageEvent to other tabs, causing an infinite loop.
    expect(setItemSpy).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything())
  })

  // -------------------------------------------------------------------------
  // T8: Remote plan regeneration invalidates local active session
  // -------------------------------------------------------------------------
  it('T8: remote plan regeneration invalidates local active workout session in storage', () => {
    // 1. Setup an active workout session in localStorage for Plan A
    const activeSession = mockWorkoutSession({ planId: 'plan_A_old' })
    saveActiveSession(activeSession)
    expect(loadActiveSession()?.sessionId).toBe('sess_live_123')

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlanProvider>{children}</PlanProvider>
    )

    const { result } = renderHook(() => usePlan(), { wrapper })

    // 2. Tab B regenerates Plan B with a different planId
    const regeneratedPlanState: PlanState = {
      ...initialState,
      isGenerated: true,
      generatedPlan: '# Plan B Regenerated',
      planId: 'plan_B_new_789',
      boundProfile: { ...sampleProfile },
      stateVersion: { counter: 5, timestamp: 2000, writerId: 'tab_B' },
    }
    const raw = JSON.stringify(regeneratedPlanState)

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: raw,
          oldValue: null,
          storageArea: localStorage,
        })
      )
    })

    // Plan in Tab A is updated to Plan B
    expect(result.current.state.planId).toBe('plan_B_new_789')

    // Active session for Plan A MUST be cleared from localStorage!
    expect(loadActiveSession()).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T9: Remote session clear propagates locally
  // -------------------------------------------------------------------------
  it('T9: remote session clear event clears active session locally', () => {
    saveActiveSession(mockWorkoutSession())
    expect(loadActiveSession()).not.toBeNull()

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlanProvider>{children}</PlanProvider>
    )

    renderHook(() => usePlan(), { wrapper })

    // Simulate another tab clearing the active session
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: ACTIVE_SESSION_STORAGE_KEY,
          newValue: null,
          oldValue: '{"sessionId":"sess_live_123"}',
          storageArea: localStorage,
        })
      )
    })

    expect(loadActiveSession()).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T10: Malformed event is ignored safely (fails closed)
  // -------------------------------------------------------------------------
  it('T10: malformed, null, unversioned, or NaN events are safely rejected without crashing', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlanProvider>{children}</PlanProvider>
    )

    const { result } = renderHook(() => usePlan(), { wrapper })

    const initialRevision = result.current.state.stateVersion

    const invalidPayloads = [
      null, // Key deletion
      '{ invalid_json ---', // Bad JSON
      'null', // JSON null
      '[]', // JSON array
      JSON.stringify({ isGenerated: true }), // Missing stateVersion
      JSON.stringify({ isGenerated: true, stateVersion: null }), // Null version
      JSON.stringify({ isGenerated: true, stateVersion: { counter: 'not_a_number' } }), // String counter
      JSON.stringify({ isGenerated: true, stateVersion: { counter: NaN, writerId: 'x' } }), // NaN counter
      JSON.stringify({ isGenerated: true, stateVersion: { counter: Infinity, writerId: 'x' } }), // Infinity counter
      JSON.stringify({ isGenerated: true, stateVersion: { counter: -1, writerId: 'x' } }), // Negative counter
      JSON.stringify({ isGenerated: true, stateVersion: { counter: 5, writerId: '' } }), // Empty writerId
    ]

    for (const badPayload of invalidPayloads) {
      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: STORAGE_KEY,
            newValue: badPayload,
            oldValue: null,
            storageArea: localStorage,
          })
        )
      })

      // State is completely untouched by corrupt payloads
      expect(result.current.state.stateVersion).toEqual(initialRevision)
    }
  })

  // -------------------------------------------------------------------------
  // T11: Direct Gym Mode path after remote profile change is locked
  // -------------------------------------------------------------------------
  it('T11: direct Gym Mode evaluation locks out when remote profile changed medical state', () => {
    // Step 1: User has healthy Plan A in storage
    const initialPlan: PlanState = {
      ...initialState,
      formData: { ...sampleProfile, medicalIssues: 'None' },
      isGenerated: true,
      generatedPlan: '# High Impact Plan',
      planId: 'plan_healthy',
      boundProfile: { ...sampleProfile, medicalIssues: 'None' },
      stateVersion: { counter: 1, timestamp: 1000, writerId: 'tab_A' },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialPlan))

    // Step 2: Tab B updates medical profile to Severe Hypertension
    const updatedPlan: PlanState = {
      ...initialPlan,
      formData: { ...sampleProfile, medicalIssues: 'Severe hypertension (190/115)' },
      // boundProfile stays at None because plan has not been regenerated yet!
      stateVersion: { counter: 2, timestamp: 2000, writerId: 'tab_B' },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPlan))

    // Step 3: Tab A loads updated state via loadPersistedState or StorageEvent
    const hydrated = loadPersistedState()
    expect(hydrated.formData.medicalIssues).toContain('hypertension')

    // Gym Mode evaluation locks out immediately
    const evalResult = evaluatePlanProfileBinding(hydrated.formData, hydrated.boundProfile)
    expect(evalResult.isSafetyMismatched).toBe(true)
    expect(evalResult.mismatchedSafetyFields).toContain('medicalIssues')
  })

  // -------------------------------------------------------------------------
  // T12: Reload preserves ordering metadata correctly
  // -------------------------------------------------------------------------
  it('T12: reload preserves writer ID in sessionStorage and stateVersion in localStorage', () => {
    // First call generates a writer ID
    const writer1 = getTabWriterId()
    expect(writer1).toMatch(/^tab_\d+_/)

    // Subsequent calls in the same tab return the EXACT same writer ID
    const writer2 = getTabWriterId()
    expect(writer2).toBe(writer1)

    // Save state with this writer ID
    const state: PlanState = {
      ...initialState,
      formData: { ...sampleProfile },
    }
    const saveRes = savePersistedStateWithVersion(state)
    expect(saveRes.success).toBe(true)
    expect(saveRes.version!.writerId).toBe(writer1)

    // Load state back
    const loaded = loadPersistedState()
    expect(loaded.stateVersion).toBeDefined()
    expect(loaded.stateVersion!.writerId).toBe(writer1)
    expect(loaded.stateVersion!.counter).toBe(saveRes.version!.counter)
  })

  // -------------------------------------------------------------------------
  // T13: Rapid alternating writes converge to one deterministic winner
  // -------------------------------------------------------------------------
  it('T13: rapid alternating writes converge to one deterministic winner without deadlocks', () => {
    let currentState = initialState

    // Simulate 10 rapid alternating writes between Tab A and Tab B
    for (let i = 1; i <= 10; i++) {
      const writer = i % 2 === 0 ? 'tab_A' : 'tab_B'
      const res = savePersistedStateWithVersion(
        {
          ...currentState,
          formData: { ...sampleProfile, pushupCount: String(i) },
        },
        writer
      )
      expect(res.success).toBe(true)
      expect(res.version!.counter).toBe(i)
      expect(res.version!.writerId).toBe(writer)
      currentState = loadPersistedState()
    }

    const finalState = loadPersistedState()
    expect(finalState.stateVersion!.counter).toBe(10)
    expect(finalState.formData.pushupCount).toBe('10')
  })

  // -------------------------------------------------------------------------
  // T14: Two tabs repeatedly update preferences without safety-state corruption
  // -------------------------------------------------------------------------
  it('T14: two tabs repeatedly update preferences without corrupting plan-profile safety', () => {
    // Generate a vetted plan for a healthy profile
    const vettedState: PlanState = {
      ...initialState,
      formData: { ...sampleProfile },
      isGenerated: true,
      generatedPlan: '# Safe Plan',
      planId: 'plan_vetted_001',
      boundProfile: { ...sampleProfile },
      stateVersion: { counter: 1, timestamp: 1000, writerId: 'tab_A' },
    }
    savePersistedStateWithVersion(vettedState, 'tab_A')

    // Tab A changes sleep hours
    savePersistedStateWithVersion(
      { ...loadPersistedState(), formData: { ...sampleProfile, sleepHours: '9' } },
      'tab_A'
    )

    // Tab B changes timePerDay
    savePersistedStateWithVersion(
      { ...loadPersistedState(), formData: { ...sampleProfile, timePerDay: '60' } },
      'tab_B'
    )

    const final = loadPersistedState()
    expect(final.stateVersion!.counter).toBe(4)

    // Verify that non-safety preference updates do NOT trigger a safety lockout!
    const binding = evaluatePlanProfileBinding(final.formData, final.boundProfile)
    expect(binding.isSafetyMismatched).toBe(false)
    expect(binding.isPreferenceMismatched).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T15: Combined medical + allergen update remains fail-closed
  // -------------------------------------------------------------------------
  it('T15: combined medical + allergen update across tabs remains fail-closed', () => {
    const bound: FormData = { ...sampleProfile, medicalIssues: 'None', allergies: 'None' }
    const current: FormData = {
      ...sampleProfile,
      medicalIssues: 'Post-op cardiac bypass',
      allergies: 'peanuts, shellfish',
    }

    const evalResult = evaluatePlanProfileBinding(current, bound)
    expect(evalResult.isSafetyMismatched).toBe(true)
    expect(evalResult.mismatchedSafetyFields).toContain('medicalIssues')
    expect(evalResult.mismatchedSafetyFields).toContain('allergies')
    expect(evalResult.mismatchedSafetyFields.length).toBe(2)
  })

  // -------------------------------------------------------------------------
  // T16: No React/storage event storm occurs after convergence
  // -------------------------------------------------------------------------
  it('T16: multiple rapid StorageEvents do not trigger a cascading setItem storm', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlanProvider>{children}</PlanProvider>
    )

    const { result } = renderHook(() => usePlan(), { wrapper })
    setItemSpy.mockClear()

    // Rapidly fire 5 StorageEvents with increasing revisions
    for (let i = 1; i <= 5; i++) {
      const payload: PlanState = {
        ...initialState,
        formData: { ...sampleProfile, age: String(20 + i) },
        stateVersion: { counter: i, timestamp: 1000 + i, writerId: 'remote_tab' },
      }
      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: STORAGE_KEY,
            newValue: JSON.stringify(payload),
            oldValue: null,
            storageArea: localStorage,
          })
        )
      })
    }

    expect(result.current.state.formData.age).toBe('25')

    // ZERO setItem calls triggered for STORAGE_KEY!
    expect(setItemSpy).not.toHaveBeenCalledWith(STORAGE_KEY, expect.anything())
  })

  // -------------------------------------------------------------------------
  // T17: Live GymModePage component terminates active session on remote plan regeneration
  // -------------------------------------------------------------------------
  it('T17: GymModePage live session immediately renders Workout Session Terminated upon remote plan regeneration', () => {
    // 1. Initial Plan A in storage
    const initialPlan: PlanState = {
      ...initialState,
      formData: { ...sampleProfile, medicalIssues: 'None' },
      isGenerated: true,
      generatedPlan: '# Plan A',
      planId: 'plan_A_running',
      boundProfile: { ...sampleProfile, medicalIssues: 'None' },
      stateVersion: { counter: 1, timestamp: 1000, writerId: 'tab_A' },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialPlan))

    // 2. Active session in storage for Plan A
    const activeSession = mockWorkoutSession({ planId: 'plan_A_running' })
    saveActiveSession(activeSession)

    // 3. Render GymModePage
    render(
      <PlanProvider>
        <MemoryRouter initialEntries={['/gym-mode/0']}>
          <Routes>
            <Route path="/gym-mode/:dayIndex" element={<GymModePage />} />
          </Routes>
        </MemoryRouter>
      </PlanProvider>
    )

    // Initially Gym Mode is actively running
    expect(screen.getByText(/Gym Mode/i)).toBeDefined()
    expect(screen.getByText(/Box Jumps/i)).toBeDefined()

    // 4. Tab B regenerates plan with a new planId
    const tabBRegenPlan: PlanState = {
      ...initialState,
      formData: { ...sampleProfile, medicalIssues: 'None' },
      isGenerated: true,
      generatedPlan: '# Plan B New',
      planId: 'plan_B_new_999',
      boundProfile: { ...sampleProfile, medicalIssues: 'None' },
      stateVersion: { counter: 2, timestamp: 2000, writerId: 'tab_B' },
    }
    const rawNewPlan = JSON.stringify(tabBRegenPlan)
    localStorage.setItem(STORAGE_KEY, rawNewPlan)

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: rawNewPlan,
          oldValue: null,
          storageArea: localStorage,
        })
      )
    })

    // GymModePage immediately locks out with Workout Session Terminated!
    expect(screen.getByText(/Workout Session Terminated/i)).toBeDefined()
    // Stale Box Jumps exercise is no longer accessible
    expect(screen.queryByText(/Box Jumps/i)).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T18: Live GymModePage component immediately locks out upon remote medical condition update
  // -------------------------------------------------------------------------
  it('T18: GymModePage live session immediately renders Workout Safety Lockout upon remote medical profile divergence', () => {
    // 1. Initial Plan A in storage
    const initialPlan: PlanState = {
      ...initialState,
      formData: { ...sampleProfile, medicalIssues: 'None' },
      isGenerated: true,
      generatedPlan: '# Plan A',
      planId: 'plan_A_running_2',
      boundProfile: { ...sampleProfile, medicalIssues: 'None' },
      stateVersion: { counter: 1, timestamp: 1000, writerId: 'tab_A' },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialPlan))

    // 2. Render GymModePage
    render(
      <PlanProvider>
        <MemoryRouter initialEntries={['/gym-mode/0']}>
          <Routes>
            <Route path="/gym-mode/:dayIndex" element={<GymModePage />} />
          </Routes>
        </MemoryRouter>
      </PlanProvider>
    )

    expect(screen.getByText(/Gym Mode/i)).toBeDefined()

    // 3. Tab B updates medical issues to Acute ACL tear without plan regeneration
    const tabBDivergedPlan: PlanState = {
      ...initialPlan,
      formData: { ...sampleProfile, medicalIssues: 'Acute ACL tear' },
      // boundProfile is still None -> mismatch!
      stateVersion: { counter: 2, timestamp: 2000, writerId: 'tab_B' },
    }
    const rawDiverged = JSON.stringify(tabBDivergedPlan)
    localStorage.setItem(STORAGE_KEY, rawDiverged)

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: rawDiverged,
          oldValue: null,
          storageArea: localStorage,
        })
      )
    })

    // GymModePage immediately renders Workout Safety Lockout!
    expect(screen.getByText(/Workout Safety Lockout/i)).toBeDefined()
  })
});
