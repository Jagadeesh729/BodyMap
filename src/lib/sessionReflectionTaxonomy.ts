export type EnergyRating = 1 | 2 | 3 | 4 | 5
export type PerceivedReadiness = 'high' | 'moderate' | 'low'

export const STANDARD_REFLECTION_TAGS = [
  'High Energy',
  'Form Focus',
  'Solid Pump',
  'Low Fatigue',
  'Heavy Session',
  'Fast Paced',
  'Stretched Well',
  'Grind Out'
] as const

export type StandardReflectionTag = typeof STANDARD_REFLECTION_TAGS[number]

export interface SessionReflection {
  energyRating?: EnergyRating
  perceivedReadiness?: PerceivedReadiness
  reflectionTags?: string[]
  notes?: string
}

/**
 * Validates and sanitizes a user-reported subjective session reflection.
 * Ensures subjective data is bounded, strictly typed, and cleanly separated from objective workout facts.
 */
export function validateSessionReflection(input: unknown): SessionReflection | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  const obj = input as Record<string, unknown>
  let energyRating: EnergyRating | undefined = undefined
  let perceivedReadiness: PerceivedReadiness | undefined = undefined
  let reflectionTags: string[] | undefined = undefined
  let notes: string | undefined = undefined

  // Validate energy rating 1..5
  if (typeof obj.energyRating === 'number' && Number.isInteger(obj.energyRating)) {
    if (obj.energyRating >= 1 && obj.energyRating <= 5) {
      energyRating = obj.energyRating as EnergyRating
    }
  }

  // Validate perceived readiness
  if (obj.perceivedReadiness === 'high' || obj.perceivedReadiness === 'moderate' || obj.perceivedReadiness === 'low') {
    perceivedReadiness = obj.perceivedReadiness
  }

  // Validate tags array
  if (Array.isArray(obj.reflectionTags)) {
    const validTags = obj.reflectionTags
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0 && t.length <= 40)
      .map(t => t.trim())
      .slice(0, 8)
    if (validTags.length > 0) {
      reflectionTags = validTags
    }
  }

  // Validate notes
  if (typeof obj.notes === 'string') {
    const trimmed = obj.notes.trim()
    if (trimmed.length > 0) {
      notes = trimmed.slice(0, 300)
    }
  }

  if (energyRating === undefined && perceivedReadiness === undefined && (!reflectionTags || reflectionTags.length === 0) && !notes) {
    return null
  }

  return {
    ...(energyRating !== undefined && { energyRating }),
    ...(perceivedReadiness !== undefined && { perceivedReadiness }),
    ...(reflectionTags && reflectionTags.length > 0 && { reflectionTags }),
    ...(notes && { notes })
  }
}

/**
 * Formats a clean human-readable summary of the subjective reflection for UI display.
 */
export function formatReflectionSummary(reflection: SessionReflection | null | undefined): string {
  if (!reflection) return 'No subjective reflection logged.'

  const parts: string[] = []
  if (reflection.energyRating) {
    parts.push(`Energy: ${reflection.energyRating}/5`)
  }
  if (reflection.perceivedReadiness) {
    const capitalized = reflection.perceivedReadiness.charAt(0).toUpperCase() + reflection.perceivedReadiness.slice(1)
    parts.push(`Readiness: ${capitalized}`)
  }
  if (reflection.reflectionTags && reflection.reflectionTags.length > 0) {
    parts.push(reflection.reflectionTags.map(t => `#${t.replace(/\s+/g, '')}`).join(' '))
  }

  return parts.length > 0 ? parts.join(' • ') : 'No subjective reflection logged.'
}
