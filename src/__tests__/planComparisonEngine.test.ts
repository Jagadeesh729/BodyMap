import { describe, it, expect } from 'vitest'
import { compareSavedPlans } from '@/lib/planComparisonEngine'
import type { SavedPlan } from '@/types/savedPlan'

function makePlan(id: string, name: string, timePerDay: string, goal: string, equipment: string[], level = 'Intermediate'): SavedPlan {
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    planState: {
      step: 1,
      formData: {
        gender: 'male',
        age: '25',
        height: '175',
        weight: '75',
        fitnessLevel: level,
        mainGoal: goal,
        bodyFocus: ['Full Body'],
        timePerDay,
        equipment,
        dietaryPreference: 'balanced',
        medicalConditions: ''
      },
      generatedPlan: null,
      customAdjustments: '',
      weightLog: [],
      completedDays: []
    }
  }
}

describe('compareSavedPlans', () => {
  it('correctly calculates time delta when Plan B is longer', () => {
    const planA = makePlan('p1', 'Summer Shred', '45', 'Fat Loss', ['Dumbbells', 'Pull-up Bar'])
    const planB = makePlan('p2', 'Winter Bulk', '60', 'Hypertrophy', ['Dumbbells', 'Barbell', 'Bench'])

    const result = compareSavedPlans(planA, planB)
    expect(result.timePerDayDeltaMinutes).toBe(15)
    expect(result.timePerDayLabel).toContain('+15m more')
    expect(result.goalMatch).toBe(false)
    expect(result.levelMatch).toBe(true)
    expect(result.sharedEquipment).toEqual(['dumbbells'])
    expect(result.uniqueEquipmentA).toEqual(['pull-up bar'])
    expect(result.uniqueEquipmentB).toEqual(['barbell', 'bench'])
  })

  it('correctly calculates time delta when Plan B is shorter', () => {
    const planA = makePlan('p1', 'High Volume Split', '60', 'Hypertrophy', ['Gym Machines'])
    const planB = makePlan('p2', 'Quick Circuit', '30', 'Hypertrophy', ['Gym Machines'])

    const result = compareSavedPlans(planA, planB)
    expect(result.timePerDayDeltaMinutes).toBe(-30)
    expect(result.timePerDayLabel).toContain('30m less')
    expect(result.goalMatch).toBe(true)
    expect(result.sharedEquipment).toEqual(['gym machines'])
  })

  it('handles plans with identical duration and equipment', () => {
    const planA = makePlan('p1', 'Routine 1', '45', 'Strength', ['Bodyweight'])
    const planB = makePlan('p2', 'Routine 2', '45', 'Strength', ['Bodyweight'])

    const result = compareSavedPlans(planA, planB)
    expect(result.timePerDayDeltaMinutes).toBe(0)
    expect(result.timePerDayLabel).toBe('Same daily duration (0m difference)')
    expect(result.goalMatch).toBe(true)
    expect(result.uniqueEquipmentA).toEqual([])
    expect(result.uniqueEquipmentB).toEqual([])
  })
})
