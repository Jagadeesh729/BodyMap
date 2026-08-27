import { describe, it, expect } from 'vitest'
import { calculateMilestones } from '@/lib/milestoneTracker'
import type { CompletedWorkoutLog } from '@/types/workoutSession'
import type { CompletedDay } from '@/context/PlanContext'
import type { SavedPlan } from '@/types/savedPlan'

describe('Verified Training Milestones Suite', () => {
  it('returns locked milestones with 0 progress for brand new user', () => {
    const milestones = calculateMilestones([], [], 0, [])
    expect(milestones.length).toBeGreaterThanOrEqual(10)
    expect(milestones.every(m => !m.isUnlocked)).toBe(true)
    expect(milestones.every(m => m.currentValue === 0)).toBe(true)
  })

  it('unlocks workout count milestones accurately', () => {
    const mockCompletedDays: CompletedDay[] = Array.from({ length: 12 }, (_, i) => ({
      dayIndex: i % 7,
      completedAt: '2026-08-15T10:00:00Z',
      planId: 'plan_1'
    }))

    const milestones = calculateMilestones([], mockCompletedDays, 0, [])
    const wo1 = milestones.find(m => m.id === 'wo_1')
    const wo5 = milestones.find(m => m.id === 'wo_5')
    const wo10 = milestones.find(m => m.id === 'wo_10')
    const wo25 = milestones.find(m => m.id === 'wo_25')

    expect(wo1?.isUnlocked).toBe(true)
    expect(wo5?.isUnlocked).toBe(true)
    expect(wo10?.isUnlocked).toBe(true)
    expect(wo25?.isUnlocked).toBe(false)
    expect(wo25?.progressPercent).toBe(48) // 12/25 = 48%
  })

  it('unlocks set logging milestones from workout history', () => {
    const mockLogs: CompletedWorkoutLog[] = [
      {
        id: 'log_1',
        sessionId: 's1',
        dayIndex: 0,
        dayTitle: 'Legs',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-10T10:00:00Z',
        durationSeconds: 2400,
        totalSetsCompleted: 15,
        totalExercises: 5,
        exercisesSummary: []
      },
      {
        id: 'log_2',
        sessionId: 's2',
        dayIndex: 1,
        dayTitle: 'Chest',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-11T10:00:00Z',
        durationSeconds: 2400,
        totalSetsCompleted: 15,
        totalExercises: 5,
        exercisesSummary: []
      }
    ]

    const milestones = calculateMilestones(mockLogs, [], 2, [])
    const set25 = milestones.find(m => m.id === 'set_25')
    const set50 = milestones.find(m => m.id === 'set_50')

    expect(set25?.isUnlocked).toBe(true) // 30 >= 25
    expect(set50?.isUnlocked).toBe(false) // 30 < 50
    expect(set50?.progressPercent).toBe(60)
  })

  it('unlocks streak and plan library milestones', () => {
    const mockPlans: SavedPlan[] = [
      { id: 'p1', name: 'Plan 1', createdAt: '2026-08-10', updatedAt: '2026-08-10', planState: {} as unknown as SavedPlan['planState'] }
    ]

    const milestones = calculateMilestones([], [], 7, mockPlans)
    const strk3 = milestones.find(m => m.id === 'strk_3')
    const strk7 = milestones.find(m => m.id === 'strk_7')
    const strk14 = milestones.find(m => m.id === 'strk_14')
    const plan1 = milestones.find(m => m.id === 'plan_1')

    expect(strk3?.isUnlocked).toBe(true)
    expect(strk7?.isUnlocked).toBe(true)
    expect(strk14?.isUnlocked).toBe(false)
    expect(plan1?.isUnlocked).toBe(true)
  })
})
