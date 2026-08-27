import { describe, it, expect } from 'vitest'
import { validateScheduleConsistency } from '@/lib/scheduleConsistencyValidator'
import type { DayPlan } from '@/types/plan'

function makeDay(day: string, isRest: boolean, type = 'Strength'): DayPlan {
  return {
    day,
    type: isRest ? 'Active Recovery' : type,
    duration: '45 mins',
    focus: ['Full Body'],
    isRest,
    workout: { warmup: [], main: [], cooldown: [] },
    meals: { breakfast: '', lunch: '', dinner: '', snacks: [] },
    totalCalories: 2000
  }
}

describe('validateScheduleConsistency', () => {
  it('handles empty days array safely', () => {
    const res = validateScheduleConsistency([])
    expect(res.isConsistent).toBe(true)
    expect(res.totalTrainingDays).toBe(0)
    expect(res.totalRestDays).toBe(0)
  })

  it('identifies balanced 4-day split with 3 rest days as consistent', () => {
    const days: DayPlan[] = [
      makeDay('Day 1', false),
      makeDay('Day 2', false),
      makeDay('Day 3', true),
      makeDay('Day 4', false),
      makeDay('Day 5', false),
      makeDay('Day 6', true),
      makeDay('Day 7', true)
    ]

    const res = validateScheduleConsistency(days)
    expect(res.isConsistent).toBe(true)
    expect(res.totalTrainingDays).toBe(4)
    expect(res.totalRestDays).toBe(3)
    expect(res.consecutiveTrainingDaysMax).toBe(2)
    expect(res.issues.length).toBe(0)
  })

  it('flags 7 consecutive training days with zero rest as advisory issue', () => {
    const days: DayPlan[] = [
      makeDay('Day 1', false),
      makeDay('Day 2', false),
      makeDay('Day 3', false),
      makeDay('Day 4', false),
      makeDay('Day 5', false),
      makeDay('Day 6', false),
      makeDay('Day 7', false)
    ]

    const res = validateScheduleConsistency(days)
    expect(res.isConsistent).toBe(false)
    expect(res.totalTrainingDays).toBe(7)
    expect(res.totalRestDays).toBe(0)
    expect(res.consecutiveTrainingDaysMax).toBe(7)
    expect(res.issues.some(i => i.title.includes('Zero Rest Days'))).toBe(true)
  })

  it('flags 5 consecutive training days followed by 2 rest days with high density advisory', () => {
    const days: DayPlan[] = [
      makeDay('Day 1', false),
      makeDay('Day 2', false),
      makeDay('Day 3', false),
      makeDay('Day 4', false),
      makeDay('Day 5', false),
      makeDay('Day 6', true),
      makeDay('Day 7', true)
    ]

    const res = validateScheduleConsistency(days)
    expect(res.isConsistent).toBe(false)
    expect(res.consecutiveTrainingDaysMax).toBe(5)
    expect(res.issues.some(i => i.title.includes('High Consecutive Training Density'))).toBe(true)
  })

  it('recognizes rest days by type name containing recovery or rest', () => {
    const days: DayPlan[] = [
      makeDay('Day 1', false),
      makeDay('Day 2', false, 'Active Recovery & Mobility'),
      makeDay('Day 3', false, 'Full Rest Day')
    ]

    const res = validateScheduleConsistency(days)
    expect(res.totalTrainingDays).toBe(1)
    expect(res.totalRestDays).toBe(2)
  })
})
