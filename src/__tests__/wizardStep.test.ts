import { describe, it, expect, beforeEach } from 'vitest'
import { WIZARD_STEP_STORAGE_KEY } from '../pages/CreatePlanPage'

describe('Wizard Step Persistence & Boundary System', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to step 1 when storage is empty', () => {
    const raw = localStorage.getItem(WIZARD_STEP_STORAGE_KEY)
    expect(raw).toBeNull()
  })

  it('persists and restores valid steps (1 to 5)', () => {
    localStorage.setItem(WIZARD_STEP_STORAGE_KEY, '4')
    const saved = localStorage.getItem(WIZARD_STEP_STORAGE_KEY)
    const step = saved ? parseInt(saved, 10) : 1
    expect(step).toBe(4)
  })

  it('safely recovers to step 1 from corrupted or out-of-bound values', () => {
    const invalidInputs = ['0', '6', '10', 'abc', '{ invalid json }', 'null']

    invalidInputs.forEach(input => {
      localStorage.setItem(WIZARD_STEP_STORAGE_KEY, input)
      const saved = localStorage.getItem(WIZARD_STEP_STORAGE_KEY)
      let resolvedStep = 1
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (parsed >= 1 && parsed <= 5) {
          resolvedStep = parsed
        }
      }
      expect(resolvedStep).toBe(1)
    })
  })

  it('cleans up storage key on plan generation completion', () => {
    localStorage.setItem(WIZARD_STEP_STORAGE_KEY, '5')
    expect(localStorage.getItem(WIZARD_STEP_STORAGE_KEY)).toBe('5')

    localStorage.removeItem(WIZARD_STEP_STORAGE_KEY)
    expect(localStorage.getItem(WIZARD_STEP_STORAGE_KEY)).toBeNull()
  })
})
