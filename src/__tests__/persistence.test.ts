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


  it('handles localStorage exceptions gracefully in savePersistedState', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const result = savePersistedState(initialState)
    expect(result).toBe(false)
    spy.mockRestore()
  })
})



