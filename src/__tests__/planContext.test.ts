import { describe, it, expect } from 'vitest'
import {
  planReducer,
  initialState,
  defaultFormData,
  PlanState,
} from '@/context/PlanContext'


describe('PlanContext Reducer', () => {
  it('updates form data partially without wiping existing fields', () => {
    const s1 = planReducer(initialState, {
      type: 'SET_FORM_DATA',
      payload: { age: '27', gender: 'female' }
    })
    expect(s1.formData.age).toBe('27')
    expect(s1.formData.gender).toBe('female')

    const s2 = planReducer(s1, {
      type: 'SET_FORM_DATA',
      payload: { height: '168' }
    })
    expect(s2.formData.age).toBe('27')
    expect(s2.formData.height).toBe('168')
  })

  it('sets generated plan and flips isGenerated to true', () => {
    const s = planReducer(initialState, {
      type: 'SET_GENERATED_PLAN',
      payload: '# 7-Day Workout Plan'
    })
    expect(s.isGenerated).toBe(true)
    expect(s.generatedPlan).toBe('# 7-Day Workout Plan')
  })

  it('toggles workout day completion status idempotently', () => {
    const day = { date: 'Aug 24', dayIndex: 0 }
    const s1 = planReducer(initialState, { type: 'TOGGLE_DAY_COMPLETE', payload: day })
    expect(s1.completedDays.length).toBe(1)
    expect(s1.completedDays[0]).toEqual(day)

    const s2 = planReducer(s1, { type: 'TOGGLE_DAY_COMPLETE', payload: day })
    expect(s2.completedDays.length).toBe(0)
  })

  it('logs weight entries sequentially', () => {
    const s1 = planReducer(initialState, {
      type: 'LOG_WEIGHT',
      payload: { date: 'Aug 24', weight: 75.5 }
    })
    const s2 = planReducer(s1, {
      type: 'LOG_WEIGHT',
      payload: { date: 'Aug 31', weight: 74.8 }
    })
    expect(s2.weightLog.length).toBe(2)
    expect(s2.weightLog[1].weight).toBe(74.8)
  })

  it('resets state completely on RESET_PLAN action', () => {
    const modified: PlanState = {
      formData: { ...defaultFormData, age: '30' },
      generatedPlan: 'Custom Plan',
      isGenerated: true,
      weightLog: [{ date: 'Aug 24', weight: 80 }],
      completedDays: [{ date: 'Aug 24', dayIndex: 0 }],
    }
    const reset = planReducer(modified, { type: 'RESET_PLAN' })
    expect(reset).toEqual(initialState)
  })
})
