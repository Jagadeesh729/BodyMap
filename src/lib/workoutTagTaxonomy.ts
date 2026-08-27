export const STANDARD_WORKOUT_TAGS = [
  '#Deload',
  '#HighEnergy',
  '#FormFocus',
  '#PRDay',
  '#HomeGym',
  '#PumpDay'
] as const

export type StandardWorkoutTag = typeof STANDARD_WORKOUT_TAGS[number]

/**
 * Returns list of standard taxonomy tags for session notes.
 */
export function getStandardWorkoutTags(): readonly StandardWorkoutTag[] {
  return STANDARD_WORKOUT_TAGS
}

/**
 * Extracts all hash tags from a note string.
 */
export function extractTagsFromNote(note: string | null | undefined): string[] {
  if (!note || typeof note !== 'string') return []
  const matches = note.match(/#[A-Za-z0-9_-]+/g)
  return matches ? Array.from(new Set(matches)) : []
}

/**
 * Adds a tag to a note string without destroying existing user text.
 */
export function addTagToNote(note: string | null | undefined, rawTag: string): string {
  const currentNote = (note || '').trim()
  const cleanTag = rawTag.startsWith('#') ? rawTag.trim() : `#${rawTag.trim()}`
  if (!cleanTag || cleanTag === '#') return currentNote

  const existingTags = extractTagsFromNote(currentNote)
  if (existingTags.some(t => t.toLowerCase() === cleanTag.toLowerCase())) {
    return currentNote // Already present
  }

  if (currentNote.length === 0) {
    return cleanTag
  }

  return `${currentNote} ${cleanTag}`
}

/**
 * Removes a tag from a note string while preserving user text.
 */
export function removeTagFromNote(note: string | null | undefined, rawTag: string): string {
  if (!note || typeof note !== 'string') return ''
  const cleanTag = rawTag.startsWith('#') ? rawTag.trim() : `#${rawTag.trim()}`
  const regex = new RegExp(`(^|\\s)${cleanTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'gi')
  return note.replace(regex, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Toggles a tag in a note string (adds if missing, removes if present).
 */
export function toggleTagInNote(note: string | null | undefined, rawTag: string): string {
  const currentNote = (note || '').trim()
  const cleanTag = rawTag.startsWith('#') ? rawTag.trim() : `#${rawTag.trim()}`
  const existingTags = extractTagsFromNote(currentNote)

  if (existingTags.some(t => t.toLowerCase() === cleanTag.toLowerCase())) {
    return removeTagFromNote(currentNote, cleanTag)
  }
  return addTagToNote(currentNote, cleanTag)
}
