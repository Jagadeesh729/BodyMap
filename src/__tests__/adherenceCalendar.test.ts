import { describe, it, expect } from 'vitest'
import { generate28DayAdherenceCalendar } from '@/lib/adherenceCalendar'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

describe('28-Day Adherence Calendar Heatmap Suite', () => {
  const refDate = new Date('2026-08-27T12:00:00Z')

  it('generates exactly 28 consecutive days ending at reference date', () => {
    const calendar = generate28DayAdherenceCalendar([], refDate)
    expect(calendar.length).toBe(28)
    expect(calendar[27].dateStr).toBe('2026-08-27')
    expect(calendar[27].isToday).toBe(true)
    expect(calendar[0].dateStr).toBe('2026-07-31')
  })

  it('correctly flags completed workout dates and constructs accessible labels', () => {
    const mockHistory: CompletedWorkoutLog[] = [
      {
        id: 'w1',
        sessionId: 's1',
        dayIndex: 0,
        dayTitle: 'Chest Day',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-26T10:00:00Z',
        durationSeconds: 2000,
        totalSetsCompleted: 4,
        totalExercises: 2,
        exercisesSummary: []
      }
    ]

    const calendar = generate28DayAdherenceCalendar(mockHistory, refDate)
    const yesterdayCell = calendar.find(c => c.dateStr === '2026-08-26')
    expect(yesterdayCell).toBeDefined()
    expect(yesterdayCell?.isCompleted).toBe(true)
    expect(yesterdayCell?.ariaLabel).toContain('Workout completed')

    const olderCell = calendar.find(c => c.dateStr === '2026-08-25')
    expect(olderCell?.isCompleted).toBe(false)
    expect(olderCell?.ariaLabel).toContain('Rest')
  })

  it('handles empty or malformed workout logs safely', () => {
    const calendar = generate28DayAdherenceCalendar([null as unknown as CompletedWorkoutLog], refDate)
    expect(calendar.length).toBe(28)
    expect(calendar.every(c => !c.isCompleted)).toBe(true)
  })
})
