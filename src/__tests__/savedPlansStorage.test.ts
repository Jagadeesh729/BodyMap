import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadSavedPlans,
  savePlanToLibrary,
  duplicateSavedPlan,
  renameSavedPlan,
  deleteSavedPlan,
  archiveSavedPlan,
  clearSavedPlans,
  SAVED_PLANS_STORAGE_KEY
} from '@/lib/savedPlansStorage'
import type { PlanState } from '@/context/PlanContext'

const mockPlanState: PlanState = {
  formData: {
    age: '28',
    gender: 'male',
    height: '180',
    weight: '75',
    fitnessLevel: 'intermediate',
    mainGoal: 'Hypertrophy',
    bodyFocus: ['Chest', 'Arms'],
    timePerDay: '45',
    medicalIssues: '',
    equipment: ['Dumbbells'],
    pushupCount: '30',
    dietaryPreference: 'high-protein',
    allergies: '',
    specialRequests: '',
    recoveryDays: '2',
    sleepHours: '8',
    stressLevel: 'low'
  },
  generatedPlan: '# 7-Day Hypertrophy Routine',
  isGenerated: true,
  weightLog: [{ date: 'Aug 20', weight: 75 }],
  completedDays: [{ date: '2026-08-26', dayIndex: 0 }]
}

describe('Multi-Plan Library Storage Suite', () => {
  beforeEach(() => {
    clearSavedPlans()
  })

  it('loads empty array when localStorage is empty', () => {
    expect(loadSavedPlans()).toEqual([])
  })

  it('saves a new plan to the library and loads it back', () => {
    const saved = savePlanToLibrary('Hypertrophy Block A', mockPlanState)
    expect(saved.id).toBeDefined()
    expect(saved.name).toBe('Hypertrophy Block A')
    expect(saved.planState.generatedPlan).toBe('# 7-Day Hypertrophy Routine')

    const all = loadSavedPlans()
    expect(all.length).toBe(1)
    expect(all[0].name).toBe('Hypertrophy Block A')
  })

  it('renames an existing saved plan', () => {
    const saved = savePlanToLibrary('Old Name', mockPlanState)
    const success = renameSavedPlan(saved.id, 'New Name')
    expect(success).toBe(true)

    const all = loadSavedPlans()
    expect(all[0].name).toBe('New Name')
  })

  it('duplicates an existing saved plan with a unique ID', () => {
    const saved = savePlanToLibrary('Original Split', mockPlanState)
    const dup = duplicateSavedPlan(saved.id)
    expect(dup).not.toBeNull()
    expect(dup?.name).toBe('Original Split (Copy)')
    expect(dup?.id).not.toBe(saved.id)

    const all = loadSavedPlans()
    expect(all.length).toBe(2)
  })

  it('archives and unarchives a saved plan', () => {
    const saved = savePlanToLibrary('Seasonal Split', mockPlanState)
    expect(saved.isArchived).toBe(false)

    archiveSavedPlan(saved.id, true)
    let all = loadSavedPlans()
    expect(all[0].isArchived).toBe(true)

    archiveSavedPlan(saved.id, false)
    all = loadSavedPlans()
    expect(all[0].isArchived).toBe(false)
  })

  it('deletes a saved plan by ID', () => {
    const p1 = savePlanToLibrary('Plan 1', mockPlanState)
    const p2 = savePlanToLibrary('Plan 2', mockPlanState)
    expect(loadSavedPlans().length).toBe(2)

    const deleted = deleteSavedPlan(p1.id)
    expect(deleted).toBe(true)

    const remaining = loadSavedPlans()
    expect(remaining.length).toBe(1)
    expect(remaining[0].id).toBe(p2.id)
  })

  it('filters out corrupted or invalid JSON items safely', () => {
    localStorage.setItem(
      SAVED_PLANS_STORAGE_KEY,
      JSON.stringify([
        { id: 'valid_1', name: 'Valid Plan', createdAt: new Date().toISOString(), planState: mockPlanState },
        { id: null },
        'corrupt_string',
        { id: 'invalid_2', name: 'No Plan State' }
      ])
    )

    const all = loadSavedPlans()
    expect(all.length).toBe(1)
    expect(all[0].id).toBe('valid_1')
  })
})
