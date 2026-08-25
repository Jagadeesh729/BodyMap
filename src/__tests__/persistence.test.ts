import { describe, it, expect, beforeEach, vi } from 'vitest'

import { initialState, defaultFormData, PlanState } from '../context/PlanContext'
import { loadPersistedState, savePersistedState, STORAGE_KEY } from '../context/planStorage'

describe('LocalStorage Persistence & Hydration Logic', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('hydrates clean default state when storage is empty', () => {
    const state = loadPersistedState()
    expect(state).toEqual(initialState)
    expect(state.isGenerated).toBe(false)
  })

  it('handles corrupted JSON in localStorage gracefully without crashing', () => {
    localStorage.setItem(STORAGE_KEY, '{ corrupt json string... ')
    const state = loadPersistedState()
    expect(state).toEqual(initialState)
    expect(state.isGenerated).toBe(false)
  })

  it('successfully saves and hydrates state using production storage adapter', () => {
    const savedState: PlanState = {
      formData: { ...defaultFormData, age: '29', mainGoal: 'bulk' },
      generatedPlan: '# 7-Day Plan',
      isGenerated: true,
      weightLog: [{ date: 'Aug 24', weight: 78.5 }],
      completedDays: [{ date: 'Aug 24', dayIndex: 0 }],
    }
    
    const saveSuccess = savePersistedState(savedState)
    expect(saveSuccess).toBe(true)

    const hydrated = loadPersistedState()
    expect(hydrated.formData.age).toBe('29')
    expect(hydrated.formData.mainGoal).toBe('bulk')
    expect(hydrated.isGenerated).toBe(true)
    expect(hydrated.weightLog.length).toBe(1)
    expect(hydrated.completedDays.length).toBe(1)
  })

  it('gracefully handles corrupted nested formData in storage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ isGenerated: true, formData: null }))
    const state = loadPersistedState()
    expect(state.isGenerated).toBe(true)
    expect(state.formData).toEqual(defaultFormData)
  })


  it('gracefully handles non-array corrupted weightLog or completedDays in storage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ isGenerated: true, weightLog: 'invalid_string', completedDays: 123 }))
    const state = loadPersistedState()
    expect(state.isGenerated).toBe(true)
    expect(Array.isArray(state.weightLog)).toBe(true)
    expect(state.weightLog).toEqual([])
    expect(Array.isArray(state.completedDays)).toBe(true)
    expect(state.completedDays).toEqual([])
  })

  it('handles localStorage exceptions gracefully in savePersistedState', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const result = savePersistedState(initialState)
    expect(result).toBe(false)
    spy.mockRestore()
  })

  it('safely tolerates unknown future properties during forward-compatible schema evolution', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...initialState,
      futureAiModel: 'gemini-4.0-ultra',
      betaFeatureFlag: true,
      customClientSettings: { theme: 'dark-neon', telemetry: false }
    }))
    const state = loadPersistedState()
    expect(state.formData).toBeDefined()
    expect(state.isGenerated).toBe(false)
    expect(Array.isArray(state.completedDays)).toBe(true)
  })

  it('filters and sanitizes corrupted entries inside weightLog and completedDays arrays', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...initialState,
      isGenerated: true,
      weightLog: [
        { date: 'Aug 24', weight: 75 },
        null,
        'invalid_entry',
        { invalidField: 123 },
        { date: 'Aug 31', weight: 74 }
      ],
      completedDays: [
        { date: 'Aug 24', dayIndex: 0 },
        null,
        123,
        { date: 'Aug 25', dayIndex: 1 }
      ]
    }))
    const state = loadPersistedState()
    expect(state.isGenerated).toBe(true)
    expect(state.weightLog.length).toBe(2)
    expect(state.weightLog[0].weight).toBe(75)
    expect(state.weightLog[1].weight).toBe(74)
    expect(state.completedDays.length).toBe(2)
    expect(state.completedDays[0].dayIndex).toBe(0)
    expect(state.completedDays[1].dayIndex).toBe(1)
  })
})




