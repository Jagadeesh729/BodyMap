import { describe, it, expect } from 'vitest'
import { calculateWeeklyMuscleFrequency } from '@/lib/muscleFrequencyMatrix'
import type { DayPlan } from '@/types/plan'

describe('Weekly Muscle Frequency Matrix Suite', () => {
  const createMockDay = (day: string, focus: string[], isRest = false): DayPlan => ({
    day,
    type: isRest ? 'Rest' : focus.join(' & '),
    duration: '45 mins',
    focus,
    isRest,
    workout: {
      warmup: ['Dynamic warm-up'],
      main: focus.map(f => `${f} Press`),
      cooldown: ['Static stretching']
    },
    meals: {
      breakfast: 'Oatmeal',
      lunch: 'Chicken rice',
      dinner: 'Salmon',
      snacks: ['Almonds']
    },
    totalCalories: 2200
  })

  it('counts distinct scheduled days per muscle group accurately (no double counting within same day)', () => {
    // 4 training days, 3 rest days
    // Day 1: Chest & Arms
    // Day 2: Back & Core
    // Day 3: Legs
    // Day 4: Chest & Back
    // Rest 5, 6, 7
    const plan: DayPlan[] = [
      createMockDay('Day 1', ['Chest', 'Arms']),
      createMockDay('Day 2', ['Back', 'Core']),
      createMockDay('Day 3', ['Legs']),
      createMockDay('Day 4', ['Chest', 'Back']),
      createMockDay('Day 5', ['Rest'], true),
      createMockDay('Day 6', ['Rest'], true),
      createMockDay('Day 7', ['Rest'], true)
    ]

    const matrix = calculateWeeklyMuscleFrequency(plan)
    expect(matrix.hasData).toBe(true)
    expect(matrix.totalTrainingDays).toBe(4)

    const chest = matrix.frequencies.find(f => f.muscle === 'Chest')
    expect(chest?.weeklyFrequency).toBe(2)
    expect(chest?.statusLabel).toBe('Moderate (2x)')

    const back = matrix.frequencies.find(f => f.muscle === 'Back')
    expect(back?.weeklyFrequency).toBe(2)

    const legs = matrix.frequencies.find(f => f.muscle === 'Legs')
    expect(legs?.weeklyFrequency).toBe(1)
    expect(legs?.statusLabel).toBe('Low (1x)')

    const shoulders = matrix.frequencies.find(f => f.muscle === 'Shoulders')
    expect(shoulders?.weeklyFrequency).toBe(0)
    expect(shoulders?.statusLabel).toBe('Rest / None')
  })

  it('handles Full Body training splits correctly', () => {
    const fullBodyPlan: DayPlan[] = [
      createMockDay('Day 1', ['Full Body']),
      createMockDay('Day 2', ['Rest'], true),
      createMockDay('Day 3', ['Full Body']),
      createMockDay('Day 4', ['Rest'], true),
      createMockDay('Day 5', ['Full Body']),
      createMockDay('Day 6', ['Rest'], true),
      createMockDay('Day 7', ['Rest'], true)
    ]

    const matrix = calculateWeeklyMuscleFrequency(fullBodyPlan)
    expect(matrix.hasData).toBe(true)
    expect(matrix.totalTrainingDays).toBe(3)

    const chest = matrix.frequencies.find(f => f.muscle === 'Chest')
    expect(chest?.weeklyFrequency).toBe(3)
    expect(chest?.statusLabel).toBe('High (3x+)')
  })

  it('handles empty or malformed plan arrays safely', () => {
    expect(calculateWeeklyMuscleFrequency([]).hasData).toBe(false)
    expect(calculateWeeklyMuscleFrequency(null).hasData).toBe(false)
    expect(calculateWeeklyMuscleFrequency(undefined).hasData).toBe(false)
  })
})
