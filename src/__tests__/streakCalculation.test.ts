import { describe, it, expect } from 'vitest'
import {
  calculateWorkoutStreak,
  formatCalendarDate,
  shiftCalendarDays,
  parseToCalendarDateString
} from '@/lib/streakCalculation'

describe('Calendar-Date Arithmetic Streak Calculation Suite', () => {
  it('formats calendar dates accurately into YYYY-MM-DD', () => {
    const d = new Date(2026, 7, 26) // Aug 26, 2026
    expect(formatCalendarDate(d)).toBe('2026-08-26')
    expect(parseToCalendarDateString('2026-08-26')).toBe('2026-08-26')
    expect(parseToCalendarDateString('2026-08-26T14:30:00Z')).toBe('2026-08-26')
    expect(parseToCalendarDateString('')).toBeNull()
  })

  it('correctly shifts dates across month and leap-year boundaries without millisecond drift', () => {
    // Leap year March 1 -> Feb 29 in 2024
    const leapMarch1 = new Date(2024, 2, 1)
    const feb29 = shiftCalendarDays(leapMarch1, -1)
    expect(formatCalendarDate(feb29)).toBe('2024-02-29')

    // Non-leap year March 1 -> Feb 28 in 2026
    const nonLeapMarch1 = new Date(2026, 2, 1)
    const feb28 = shiftCalendarDays(nonLeapMarch1, -1)
    expect(formatCalendarDate(feb28)).toBe('2026-02-28')

    // Year boundary Jan 1 -> Dec 31
    const newYear = new Date(2027, 0, 1)
    const dec31 = shiftCalendarDays(newYear, -1)
    expect(formatCalendarDate(dec31)).toBe('2026-12-31')
  })

  it('returns 0 when there is no workout history or completed days', () => {
    const ref = new Date(2026, 7, 26)
    expect(calculateWorkoutStreak([], [], ref)).toBe(0)
  })

  it('calculates 1-day streak when workout is completed today', () => {
    const ref = new Date(2026, 7, 26)
    const history = [{ completedAt: '2026-08-26T10:30:00Z' }]
    expect(calculateWorkoutStreak(history, [], ref)).toBe(1)
  })

  it('calculates 1-day streak when workout was completed yesterday', () => {
    const ref = new Date(2026, 7, 26)
    const history = [{ completedAt: '2026-08-25T18:00:00Z' }]
    expect(calculateWorkoutStreak(history, [], ref)).toBe(1)
  })

  it('calculates accurate multi-day consecutive streak', () => {
    const ref = new Date(2026, 7, 26)
    const history = [
      { completedAt: '2026-08-26T08:00:00Z' },
      { completedAt: '2026-08-25T08:00:00Z' },
      { completedAt: '2026-08-24T08:00:00Z' },
      { completedAt: '2026-08-23T08:00:00Z' },
    ]
    expect(calculateWorkoutStreak(history, [], ref)).toBe(4)
  })

  it('stops counting streak at the first skipped calendar day', () => {
    const ref = new Date(2026, 7, 26)
    const history = [
      { completedAt: '2026-08-26T08:00:00Z' }, // Today (day 1)
      { completedAt: '2026-08-25T08:00:00Z' }, // Yesterday (day 2)
      // Missing 2026-08-24
      { completedAt: '2026-08-23T08:00:00Z' },
    ]
    expect(calculateWorkoutStreak(history, [], ref)).toBe(2)
  })

  it('returns 0 when most recent workout is 2 or more days old (broken streak)', () => {
    const ref = new Date(2026, 7, 26)
    const history = [
      { completedAt: '2026-08-24T08:00:00Z' }, // 2 days ago
      { completedAt: '2026-08-23T08:00:00Z' },
    ]
    expect(calculateWorkoutStreak(history, [], ref)).toBe(0)
  })

  it('deduplicates multiple workouts logged on the same calendar day', () => {
    const ref = new Date(2026, 7, 26)
    const history = [
      { completedAt: '2026-08-26T08:00:00Z' }, // Session 1 today
      { completedAt: '2026-08-26T17:00:00Z' }, // Session 2 today
      { completedAt: '2026-08-25T09:00:00Z' }, // Session 1 yesterday
      { completedAt: '2026-08-25T20:00:00Z' }, // Session 2 yesterday
    ]
    expect(calculateWorkoutStreak(history, [], ref)).toBe(2)
  })

  it('tolerates and filters out malformed or corrupted timestamp strings safely', () => {
    const ref = new Date(2026, 7, 26)
    const history = [
      { completedAt: 'invalid-date' },
      { completedAt: '' },
      { completedAt: '2026-08-26T08:00:00Z' }
    ]
    expect(calculateWorkoutStreak(history, [], ref)).toBe(1)
  })

  it('correctly tracks streaks across DST transition dates', () => {
    // Simulated DST transition: Nov 1, 2026 (25-hour day) -> Oct 31, 2026
    const ref = new Date(2026, 10, 1) // Nov 1, 2026
    const history = [
      { completedAt: '2026-11-01T10:00:00' },
      { completedAt: '2026-10-31T10:00:00' },
      { completedAt: '2026-10-30T10:00:00' },
    ]
    expect(calculateWorkoutStreak(history, [], ref)).toBe(3)
  })
})
