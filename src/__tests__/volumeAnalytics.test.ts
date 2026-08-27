import { describe, it, expect } from 'vitest'
import {
  classifyMuscleFocus,
  calculateVolumeAnalytics
} from '@/lib/volumeAnalytics'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

describe('Volume Analytics & Muscle Attribution Suite', () => {
  it('classifies exercises into primary muscle focus groups accurately', () => {
    expect(classifyMuscleFocus('Barbell Bench Press')).toBe('Chest')
    expect(classifyMuscleFocus('Incline Dumbbell Press')).toBe('Chest')
    expect(classifyMuscleFocus('Barbell Bent-Over Row')).toBe('Back')
    expect(classifyMuscleFocus('Pull-ups')).toBe('Back')
    expect(classifyMuscleFocus('Barbell Back Squat')).toBe('Legs')
    expect(classifyMuscleFocus('Romanian Deadlift')).toBe('Legs')
    expect(classifyMuscleFocus('Standing Overhead Press')).toBe('Shoulders')
    expect(classifyMuscleFocus('Lateral Raises')).toBe('Shoulders')
    expect(classifyMuscleFocus('Bicep Curls')).toBe('Arms')
    expect(classifyMuscleFocus('Tricep Rope Pushdown')).toBe('Arms')
    expect(classifyMuscleFocus('Hanging Leg Raises')).toBe('Core')
    expect(classifyMuscleFocus('Stretching Routine')).toBe('Other')
  })

  it('aggregates weighted volume and completed sets accurately without fabricating bodyweight load', () => {
    const mockHistory: CompletedWorkoutLog[] = [
      {
        id: 'log_1',
        sessionId: 's_1',
        dayIndex: 0,
        dayTitle: 'Upper Body',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-20T10:00:00Z',
        durationSeconds: 2400,
        totalSetsCompleted: 6,
        totalExercises: 2,
        exercisesSummary: [
          { name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3, weightKg: 60 } as unknown as CompletedWorkoutLog['exercisesSummary'][number],
          { name: 'Pushups', setsCompleted: 3, totalSets: 3 } as unknown as CompletedWorkoutLog['exercisesSummary'][number] // Bodyweight (no weightKg)
        ]
      }
    ]

    const analytics = calculateVolumeAnalytics(mockHistory)
    expect(analytics.hasData).toBe(true)
    expect(analytics.totalWeightedSets).toBe(3)
    expect(analytics.totalBodyweightSets).toBe(3)
    // 60 kg * 3 sets * 10 reps = 1800 kg
    expect(analytics.totalWeightedVolumeKg).toBe(1800)

    const chest = analytics.focusBreakdown.find(f => f.category === 'Chest')
    expect(chest).toBeDefined()
    expect(chest?.totalSets).toBe(6) // 3 weighted + 3 bodyweight
    expect(chest?.weightedVolumeKg).toBe(1800)
    expect(chest?.percentageOfVolume).toBe(100)
  })

  it('handles empty or malformed logs safely', () => {
    expect(calculateVolumeAnalytics([])).toEqual({
      totalWeightedSets: 0,
      totalBodyweightSets: 0,
      totalWeightedVolumeKg: 0,
      focusBreakdown: [],
      hasData: false
    })
  })
})
