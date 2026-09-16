/**
 * RFC 5545 Compliant iCalendar (.ics) Schedule Generator
 * 
 * Generates local floating-time iCalendar event feeds for BodyMap workout plans.
 * Complies strictly with RFC 5545:
 *  - CRLF (\r\n) line termination (RFC 5545 §3.1)
 *  - 75-octet line folding using CRLF + space (RFC 5545 §3.1)
 *  - Proper TEXT character escaping for commas, semicolons, backslashes, newlines (RFC 5545 §3.3.11)
 *  - Floating local time DTSTART/DTEND to prevent timezone/DST synchronization drift (RFC 5545 §3.3.5)
 *  - Deterministic UIDs for calendar deduplication upon repeated exports
 */

export interface CalendarExerciseItem {
  name: string
  sets?: number | string
  reps?: number | string
  rest?: string
}

export interface CalendarDayInput {
  dayNumber: number
  title?: string
  isRestDay?: boolean
  durationMinutes?: number
  warmup?: string | string[]
  mainExercises?: string[] | CalendarExerciseItem[]
  cooldown?: string | string[]
  nutritionSummary?: string
}

export interface GenerateCalendarOptions {
  planTitle?: string
  goal?: string
  planId?: string
  startDate?: Date
  defaultStartHour?: number // default: 8 (08:00 AM)
  defaultDurationMinutes?: number // default: 45
  uidDomain?: string
}

/**
 * Escapes special characters for RFC 5545 TEXT values.
 * Escapes backslash, semicolon, comma, and converts newlines to literal \n.
 */
export function escapeICalText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Folds a single content line to conform to RFC 5545 §3.1 (max 75 octets per line).
 * Splits at byte boundary with CRLF + space continuation.
 */
export function foldLine(line: string): string {
  // If line within 75 ASCII chars/bytes, no folding needed
  const encoder = new TextEncoder()
  const bytes = encoder.encode(line)
  if (bytes.length <= 75) {
    return line
  }

  const chunks: string[] = []
  let currentLine = ''
  let currentBytes = 0
  const maxBytesFirstLine = 75
  const maxBytesContinuation = 74 // accounting for 1 leading space

  // Iterate by Unicode code points / characters
  for (const char of line) {
    const charBytes = encoder.encode(char).length
    const maxAllowed = chunks.length === 0 ? maxBytesFirstLine : maxBytesContinuation

    if (currentBytes + charBytes > maxAllowed) {
      chunks.push(currentLine)
      currentLine = char
      currentBytes = charBytes
    } else {
      currentLine += char
      currentBytes += charBytes
    }
  }

  if (currentLine.length > 0) {
    chunks.push(currentLine)
  }

  return chunks.join('\r\n ')
}

/**
 * Formats a Date object into RFC 5545 floating local time format (YYYYMMDDTHHMMSS).
 */
export function formatFloatingDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  return `${year}${month}${day}T${hours}${minutes}${seconds}`
}

/**
 * Deterministically generates an RFC 5545 .ics calendar string for a weekly fitness plan.
 */
export function generateICalendarSchedule(
  days: CalendarDayInput[],
  options: GenerateCalendarOptions = {}
): string {
  if (!Array.isArray(days) || days.length === 0) {
    throw new Error('Cannot generate iCalendar schedule from empty days list.')
  }

  const {
    planTitle = 'BodyMap 7-Day Fitness Plan',
    goal = 'Fitness & Conditioning',
    planId = 'bodymap-plan',
    startDate,
    defaultStartHour = 8,
    defaultDurationMinutes = 45,
    uidDomain = 'bodymap-ai.vercel.app'
  } = options

  // Default start date: tomorrow morning at defaultStartHour:00:00
  const baseDate = startDate ? new Date(startDate.getTime()) : new Date()
  if (!startDate) {
    baseDate.setDate(baseDate.getDate() + 1)
  }
  baseDate.setHours(defaultStartHour, 0, 0, 0)

  // Format DTSTAMP for creation timestamp
  const now = new Date()
  const dtStamp = formatFloatingDateTime(now)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BodyMap AI//Fitness Schedule Export//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(planTitle)}`,
    `X-WR-CALDESC:${escapeICalText(`Personalized 7-day schedule for ${goal} created with BodyMap AI`)}`
  ]

  days.forEach((day, index) => {
    const eventDate = new Date(baseDate.getTime())
    eventDate.setDate(baseDate.getDate() + index)

    const duration = day.durationMinutes && day.durationMinutes > 0
      ? day.durationMinutes
      : defaultDurationMinutes

    const endDate = new Date(eventDate.getTime() + duration * 60 * 1000)

    const dtStartStr = formatFloatingDateTime(eventDate)
    const dtEndStr = formatFloatingDateTime(endDate)

    const dayNum = day.dayNumber || (index + 1)
    const uid = `bodymap-${planId}-day-${dayNum}@${uidDomain}`

    const titlePrefix = day.isRestDay ? 'BodyMap Recovery' : 'BodyMap Workout'
    const eventTitle = day.title
      ? `${titlePrefix}: ${day.title}`
      : `${titlePrefix}: Day ${dayNum}`

    // Construct formatted description lines
    const descParts: string[] = []
    descParts.push(`🎯 Goal: ${goal}`)
    descParts.push(`⏱ Duration: ${duration} mins`)

    if (day.isRestDay) {
      descParts.push('🌿 Focus: Active Recovery, Hydration & Tissue Repair')
      descParts.push('Recommended: 20-30 min gentle walk, foam rolling, and mobility.')
    } else {
      if (day.warmup) {
        const warmupStr = Array.isArray(day.warmup) ? day.warmup.join('; ') : day.warmup
        descParts.push(`🔥 Warm-up: ${warmupStr}`)
      }

      if (day.mainExercises && day.mainExercises.length > 0) {
        descParts.push('🏋️ Workout Routine:')
        day.mainExercises.forEach((ex, exIdx) => {
          if (typeof ex === 'string') {
            descParts.push(`  ${exIdx + 1}. ${ex}`)
          } else {
            const setRep = [
              ex.sets ? `${ex.sets} sets` : '',
              ex.reps ? `${ex.reps} reps` : '',
              ex.rest ? `(${ex.rest} rest)` : ''
            ].filter(Boolean).join(' × ')
            descParts.push(`  ${exIdx + 1}. ${ex.name}${setRep ? `: ${setRep}` : ''}`)
          }
        })
      }

      if (day.cooldown) {
        const cooldownStr = Array.isArray(day.cooldown) ? day.cooldown.join('; ') : day.cooldown
        descParts.push(`❄️ Cool-down: ${cooldownStr}`)
      }
    }

    if (day.nutritionSummary) {
      descParts.push(`🥗 Nutrition: ${day.nutritionSummary}`)
    }

    descParts.push('Track sets & progress live: https://bodymap-ai.vercel.app/weekly-plan')

    const formattedDescription = descParts.join('\n')

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}`)
    lines.push(`DTSTAMP:${dtStamp}`)
    lines.push(`DTSTART:${dtStartStr}`)
    lines.push(`DTEND:${dtEndStr}`)
    lines.push(`SUMMARY:${escapeICalText(eventTitle)}`)
    lines.push(`DESCRIPTION:${escapeICalText(formattedDescription)}`)
    lines.push('STATUS:CONFIRMED')
    lines.push(day.isRestDay ? 'TRANSP:TRANSPARENT' : 'TRANSP:OPAQUE')
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')

  // Fold each line to ≤ 75 octets and join with CRLF
  const foldedLines = lines.map(line => foldLine(line))
  return foldedLines.join('\r\n') + '\r\n'
}
