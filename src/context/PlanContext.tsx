import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react'
import type { FormData } from '../types/formData'

// Re-export so existing imports from '@/context/PlanContext' continue to work
export type { FormData }

// --- Types ---

import { clearActiveSession, ACTIVE_SESSION_STORAGE_KEY } from '../lib/sessionStorage'
import {
  loadPersistedState,
  savePersistedStateWithVersion,
  parseSafeIncomingState,
  compareVersions,
  STORAGE_KEY,
} from './planStorage'

export interface WeightEntry { date: string; weight: number }
export interface CompletedDay { date: string; dayIndex: number }

export interface StateVersion {
  /** Lamport logical counter - strictly advanced on each write */
  counter: number
  /** Physical wall-clock timestamp Date.now() - physical tie-breaker */
  timestamp: number
  /** Unique per-tab identifier - deterministic tie-breaker for identical counter & timestamp */
  writerId: string
}

export interface PlanState {
  formData: FormData
  generatedPlan: string
  isGenerated: boolean
  planId?: string
  planGeneratedAt?: number
  boundProfile?: FormData
  stateVersion?: StateVersion
  weightLog: WeightEntry[]
  completedDays: CompletedDay[]
}

export const defaultFormData: FormData = {
  age: '', gender: '', height: '', weight: '', fitnessLevel: '',
  mainGoal: '', bodyFocus: [], timePerDay: '',
  medicalIssues: '', equipment: [], pushupCount: '',
  dietaryPreference: '', allergies: '', specialRequests: '',
  recoveryDays: '', sleepHours: '', stressLevel: '',
}

export const initialState: PlanState = {
  formData: defaultFormData,
  generatedPlan: '',
  isGenerated: false,
  weightLog: [],
  completedDays: [],
}

// --- Actions ---

export type PlanAction =
  | { type: 'SET_FORM_DATA'; payload: Partial<FormData> }
  | { type: 'SET_GENERATED_PLAN'; payload: string | { plan: string; formData?: FormData } }
  | { type: 'RESET_PLAN' }
  | { type: 'LOG_WEIGHT'; payload: WeightEntry }
  | { type: 'TOGGLE_DAY_COMPLETE'; payload: CompletedDay }
  | { type: 'MARK_DAY_COMPLETE'; payload: CompletedDay }
  | { type: 'LOAD_SAVED_PLAN'; payload: PlanState }

export function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case 'SET_FORM_DATA':
      return { ...state, formData: { ...state.formData, ...action.payload } }
    case 'SET_GENERATED_PLAN': {
      const planText = typeof action.payload === 'string' ? action.payload : action.payload.plan
      const profileSnapshot = typeof action.payload === 'object' && action.payload.formData
        ? { ...action.payload.formData }
        : { ...state.formData }
      const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      return {
        ...state,
        generatedPlan: planText,
        isGenerated: true,
        planId,
        planGeneratedAt: Date.now(),
        formData: profileSnapshot,   // keep formData in sync with what was generated
        boundProfile: profileSnapshot,
      }
    }
    case 'RESET_PLAN':
      return { ...initialState }
    case 'LOG_WEIGHT':
      return { ...state, weightLog: [...state.weightLog, action.payload] }
    case 'LOAD_SAVED_PLAN':
      return {
        formData: action.payload.formData || { ...defaultFormData },
        generatedPlan: action.payload.generatedPlan || '',
        isGenerated: Boolean(action.payload.isGenerated),
        planId: action.payload.planId,
        planGeneratedAt: action.payload.planGeneratedAt,
        boundProfile: action.payload.boundProfile,
        stateVersion: action.payload.stateVersion,
        weightLog: Array.isArray(action.payload.weightLog) ? action.payload.weightLog : [],
        completedDays: Array.isArray(action.payload.completedDays) ? action.payload.completedDays : []
      }
    case 'TOGGLE_DAY_COMPLETE': {
      const exists = state.completedDays.some(
        d => d.date === action.payload.date && d.dayIndex === action.payload.dayIndex
      )
      return {
        ...state,
        completedDays: exists
          ? state.completedDays.filter(d => !(d.date === action.payload.date && d.dayIndex === action.payload.dayIndex))
          : [...state.completedDays, action.payload],
      }
    }
    case 'MARK_DAY_COMPLETE': {
      const exists = state.completedDays.some(
        d => d.date === action.payload.date && d.dayIndex === action.payload.dayIndex
      )
      if (exists) return state
      return {
        ...state,
        completedDays: [...state.completedDays, action.payload],
      }
    }
    default:
      return state
  }
}

// --- Context ---

interface PlanContextValue {
  state: PlanState
  dispatch: React.Dispatch<PlanAction>
  setFormData: (data: Partial<FormData>) => void
  setGeneratedPlan: (plan: string, profileOverride?: FormData) => void
  resetPlan: () => void
}

const PlanContext = createContext<PlanContextValue | null>(null)

export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(planReducer, initialState, loadPersistedState)

  // Track the current authoritative version and planId across renders
  const lastKnownVersionRef = useRef<StateVersion | undefined>(state.stateVersion)
  const currentPlanIdRef = useRef<string | undefined>(state.planId)

  // Remote-write echo guard: prevents re-persisting state received from another tab
  const isApplyingRemoteRef = useRef(false)
  // Initial mount guard: prevents overwriting storage with a newly incremented version on mount
  const isInitialMountRef = useRef(true)

  // Persistence effect: saves ONLY locally-originated state changes
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false
      return
    }

    // If this render was triggered by adopting a remote StorageEvent, skip persistence.
    // The data is ALREADY in localStorage. Writing it would create an infinite ping-pong loop!
    if (isApplyingRemoteRef.current) {
      isApplyingRemoteRef.current = false
      return
    }

    const { success, version } = savePersistedStateWithVersion(state)
    if (success && version) {
      lastKnownVersionRef.current = version
    }
    currentPlanIdRef.current = state.planId
  }, [state])

  // Cross-tab synchronization via StorageEvent.
  //
  // StorageEvent fires in OTHER tabs (never in the tab that performed the write),
  // which naturally avoids same-tab reflection.
  //
  // Protocol:
  //   1. Listen for changes to bodymap_plan_v2.
  //   2. Parse and validate incoming payload through parseSafeIncomingState.
  //   3. Compare incoming version against lastKnownVersionRef using total-ordering compareVersions:
  //      - Primary: Lamport counter
  //      - Secondary: physical timestamp
  //      - Tertiary: unique writerId
  //      Only accept if compareVersions(incoming.stateVersion, lastKnownVersionRef.current) > 0.
  //   4. If incoming version is older, equal, or unversioned -> drop (idempotent / stale).
  //   5. If plan changed remotely (incoming.planId !== currentPlanIdRef.current),
  //      immediately clear the active workout session so it cannot continue running.
  //   6. Set isApplyingRemoteRef.current = true to prevent echo loop, then dispatch LOAD_SAVED_PLAN.
  //   7. Also listen for bodymap_active_session: if cleared remotely, clear locally.
  useEffect(() => {
    function handleStorageEvent(event: StorageEvent) {
      if (event.storageArea !== localStorage) return

      if (event.key === STORAGE_KEY) {
        if (event.newValue === null) return

        const incoming = parseSafeIncomingState(event.newValue)
        // Fail closed: ignore malformed, unversioned, or unsafe payloads
        if (!incoming || !incoming.stateVersion) return

        // Total ordering guard: only strictly newer versions can overwrite local state
        if (compareVersions(incoming.stateVersion, lastKnownVersionRef.current) <= 0) {
          return
        }

        // If the plan was regenerated in another tab, immediately invalidate local active session
        if (incoming.planId && incoming.planId !== currentPlanIdRef.current) {
          clearActiveSession()
        }

        // Adopt remote state without re-saving
        isApplyingRemoteRef.current = true
        lastKnownVersionRef.current = incoming.stateVersion
        currentPlanIdRef.current = incoming.planId
        dispatch({ type: 'LOAD_SAVED_PLAN', payload: incoming })
      }

      if (event.key === ACTIVE_SESSION_STORAGE_KEY) {
        if (event.newValue === null) {
          clearActiveSession()
        }
      }
    }

    window.addEventListener('storage', handleStorageEvent)
    return () => window.removeEventListener('storage', handleStorageEvent)
  }, [])

  const setFormData = (data: Partial<FormData>) => dispatch({ type: 'SET_FORM_DATA', payload: data })
  const setGeneratedPlan = (plan: string, profileOverride?: FormData) => {
    clearActiveSession()
    dispatch({ type: 'SET_GENERATED_PLAN', payload: { plan, formData: profileOverride } })
  }
  const resetPlan = () => {
    clearActiveSession()
    dispatch({ type: 'RESET_PLAN' })
  }

  return (
    <PlanContext.Provider value={{ state, dispatch, setFormData, setGeneratedPlan, resetPlan }}>
      {children}
    </PlanContext.Provider>
  )
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext)
  if (!ctx) throw new Error('usePlan must be used inside <PlanProvider>')
  return ctx
}
