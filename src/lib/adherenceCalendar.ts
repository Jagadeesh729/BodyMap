import type { CompletedWorkoutLog } from '@/types/workoutSession'

export interface AdherenceDayCell {
  dateStr: string
  dayOfWeek: string
  dayOfMonth: number
  isCompleted: boolean
  isToday: boolean
  ariaLabel: string
}

/**
 * Generates a 28-calendar-day representation of workout adherence ending today.
 * Uses calendar date arithmetic to handle month boundaries and leap years cleanly.
 */
export function generate28DayAdherenceCalendar(
  history: CompletedWorkoutLog[] = [],
  referenceDate: Date = new Date()
): AdherenceDayCell[] {
  const completedDateSet = new Set<string>()

  if (Array.isArray(history)) {
    for (const log of history) {
      if (log && typeof log.completedAt === 'string') {
        const datePart = log.completedAt.split('T')[0]
        if (datePart) {
          completedDateSet.add(datePart)
        }
      }
    }
  }

  const cells: AdherenceDayCell[] = []
  const todayStr = referenceDate.toISOString().split('T')[0]

  // Generate 28 consecutive calendar days ending at referenceDate
  for (let i = 27; i >= 0; i--) {
    const d = new Date(referenceDate)
    d.setDate(referenceDate.getDate() - i)

    const dateStr = d.toISOString().split('T')[0]
    const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'narrow' })
    const dayOfMonth = d.getDate()
    const isCompleted = completedDateSet.has(dateStr)
    const isToday = dateStr === todayStr

    const formattedFull = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })

    const statusText = isCompleted ? 'Workout completed' : (isToday ? 'Today (Active)' : 'Rest / Recovery day')
    const ariaLabel = `${formattedFull} — ${statusText}`

    cells.push({
      dateStr,
      dayOfWeek,
      dayOfMonth,
      isCompleted,
      isToday,
      ariaLabel
    })
  }

  return cells
}
