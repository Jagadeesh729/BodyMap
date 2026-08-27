import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import type { FormData } from '../types/formData'

// Re-export so existing imports from '@/context/PlanContext' continue to work
export type { FormData }

// --- Types ---


export interface WeightEntry { date: string; weight: number }
export interface CompletedDay { date: string; dayIndex: number }

export interface PlanState {
  formData: FormData
  generatedPlan: string
  isGenerated: boolean
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
  | { type: 'SET_GENERATED_PLAN'; payload: string }
  | { type: 'RESET_PLAN' }
  | { type: 'LOG_WEIGHT'; payload: WeightEntry }
  | { type: 'TOGGLE_DAY_COMPLETE'; payload: CompletedDay }
  | { type: 'MARK_DAY_COMPLETE'; payload: CompletedDay }
  | { type: 'LOAD_SAVED_PLAN'; payload: PlanState }

export function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case 'SET_FORM_DATA':
      return { ...state, formData: { ...state.formData, ...action.payload } }
    case 'SET_GENERATED_PLAN':
      return { ...state, generatedPlan: action.payload, isGenerated: true }
    case 'RESET_PLAN':
      return { ...initialState }
    case 'LOG_WEIGHT':
      return { ...state, weightLog: [...state.weightLog, action.payload] }
    case 'LOAD_SAVED_PLAN':
      return {
        formData: action.payload.formData || { ...defaultFormData },
        generatedPlan: action.payload.generatedPlan || '',
        isGenerated: Boolean(action.payload.isGenerated),
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
  setGeneratedPlan: (plan: string) => void
  resetPlan: () => void
}

const PlanContext = createContext<PlanContextValue | null>(null)
import { loadPersistedState, savePersistedState } from './planStorage'

export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(planReducer, initialState, loadPersistedState)

  useEffect(() => {
    savePersistedState(state)
  }, [state])


  const setFormData = (data: Partial<FormData>) => dispatch({ type: 'SET_FORM_DATA', payload: data })
  const setGeneratedPlan = (plan: string) => dispatch({ type: 'SET_GENERATED_PLAN', payload: plan })
  const resetPlan = () => dispatch({ type: 'RESET_PLAN' })

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
