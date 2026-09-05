/**
 * Canonical Exercise Representation & Parsing Engine
 * 
 * Provides a single, deterministic source of truth for decomposing workout plan lines
 * into individual canonical exercise records.
 * 
 * Used symmetrically by:
 * 1. Contraindication Safety Guard (src/lib/contraindicationGuard.ts)
 * 2. Serverless Plan Generator (api/generate-plan.ts)
 * 3. Domain Model Plan Schema (src/lib/planSchema.ts)
 * 4. Runtime Session Parser (src/lib/exerciseSubstitution.ts)
 * 
 * Guarantees:
 * - Preservation of every prescribed exercise (no silent drop after colon)
 * - Safe isolation: unsafe(A) + safe(B) => BLOCK (safe exercise cannot exempt separate forbidden exercise)
 * - Isolation of substitution notes / references from executable exercise names
 * - Modifiers preserved (Bodyweight, Dumbbell, Incline, Single-leg, etc.)
 * - Protection of compound Olympic movements (Clean & press, Clean & jerk) against accidental tearing
 */

export interface CanonicalExercise {
  name: string
  sets?: string
  reps?: string
  rest?: string
  notes?: string
  raw: string
}

// Protected compound names that legitimately contain conjunctions ('and', '&')
// and MUST NOT be split into separate exercises.
const PROTECTED_COMPOUND_NAMES: RegExp[] = [
  /\b(?:(?:barbell|dumbbell|kettlebell|power|hang|squat|split|muscle)\s+)?clean\s*(?:and|&)\s*(?:press|jerk)s?\b/gi,
  /\b(?:(?:barbell|dumbbell|kettlebell|power|hang)\s+)?clean\s+pull\s*(?:and|&)\s*shrugs?\b/gi,
  /\b(?:(?:barbell|dumbbell|kettlebell)\s+)?snatch\s*(?:and|&)\s*(?:overhead\s+squat|press)s?\b/gi,
  /\bc&j\b/gi,
]

const SUBSTITUTION_CLAUSE_REGEX =
  /^(?:alternative(?:\s+(?:to|for))?:?|replaces?:?|replacing:?|replacement(?:\s+(?:for|to|of))?:?|instead\s+of:?|in\s+place\s+of:?|substitut(?:e|es|ed|ing)(?:\s+(?:for|to))?:?|swap(?:\s+out)?(?:\s+(?:for|with))?:?)\b/i

// Normalizes Unicode whitespace, zero-width spaces, and typographic quotes
// Note: Preserves em-dash (—) and en-dash (–) so they act as distinct compound separators
// without colliding with intra-word hyphens (e.g. "Step-ups", "Push-ups", "Bird-dog").
export function normalizeWorkoutLineText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // Unicode whitespace to ASCII space
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Strip zero-width spaces
    .replace(/[\u2018\u2019]/g, "'") // Normalize single quotes
    .replace(/[\u201C\u201D]/g, '"') // Normalize double quotes
    .trim()
}

/**
 * Cleans labeled item prefixes from a line, such as:
 * "Exercise 1:", "Station A:", "Circuit 1:", "Part 2 -", "Item 3:"
 */
export function stripLabeledItemPrefix(line: string): string {
  return line.replace(
    /^(?:(?:exercise|station|movement|circuit|superset|item|part)\s+[a-z\d]+)\s*[:\-–—]\s*/i,
    ''
  ).trim()
}

/**
 * Extracts prescription details (sets, reps, rest) from a text segment.
 */
export function extractPrescriptionDetails(text: string): {
  sets?: string
  reps?: string
  rest?: string
} {
  const setsMatch = text.match(/(\d+)\s*sets?/i)
  const repsMatch = text.match(/(\d+[\d-]*)\s*reps?/i) || text.match(/\b\d+\s*x\s*(\d+[\d-]*)\b/i)
  const restMatch =
    text.match(/(\d+s|\d+\s*sec(?:onds)?|\d+\s*min(?:utes)?)\s*rest/i) ||
    text.match(/\((\d+s|\d+\s*sec(?:onds)?|\d+\s*min(?:utes)?)\)/i) ||
    text.match(/rest:?\s*(\d+s|\d+\s*sec(?:onds)?|\d+\s*min(?:utes)?)/i)

  return {
    sets: setsMatch ? setsMatch[1] : undefined,
    reps: repsMatch ? repsMatch[1] : undefined,
    rest: restMatch ? restMatch[1].trim() : undefined,
  }
}

/**
 * Cleans an exercise name string by stripping parenthetical notes,
 * colons, prescription numbers, and formatting artifacts, while strictly
 * preserving biomechanical and equipment modifiers.
 */
export function cleanExerciseName(rawName: string): string {
  let cleaned = rawName
    .replace(/^[-*•\d.)\s]+/, '') // Leading bullet or numbering
    .replace(/^(?:(?:exercise|station|movement|circuit|superset|item|part)\s+[a-z\d]+)\s*[:\-–—]\s*/i, '')
    .replace(/\s*\([^)]*\).*/g, '') // Parenthetical notes
    .replace(/\s*\[[^\]]*\].*/g, '') // Bracketed notes
    .replace(/\s*:\s*.*$/, '') // Colon and anything after
    .replace(/\s+\d+\s*sets?.*/i, '') // Trailing sets notation
    .replace(/\s+\d+\s*x\s*\d+.*/i, '') // Trailing NxN notation
    .replace(/\s+\d+[\d-]*\s*reps?.*/i, '') // Trailing reps notation
    .replace(/\s*;\s*.*$/, '') // Trailing semicolons
    .replace(/\s*\|\s*.*$/, '') // Trailing pipe
    .replace(/\s+--\s+.*$/, '') // Trailing double-dashes with spaces
    .replace(/\s*[—–]\s*.*$/, '') // Trailing em/en-dashes
    .trim()

  // Remove wrapping markdown formatting (**bold**, *italic*)
  cleaned = cleaned.replace(/^\*+|\*+$/g, '').trim()

  return cleaned
}

/**
 * Decomposes a workout line into an array of CanonicalExercise objects.
 * Handles single exercises, compound supersets, multiple colons, and shared prescriptions.
 */
export function parseCanonicalExerciseLine(rawLine: string): CanonicalExercise[] {
  if (!rawLine || typeof rawLine !== 'string') return []

  const normalized = normalizeWorkoutLineText(rawLine)
  if (normalized.length < 3) return []

  // Check if line is purely a markdown header, separator, or rest day message
  if (/^#{1,4}\s+/i.test(normalized)) return []
  if (/^[-*_]{3,}$/.test(normalized)) return []
  if (/^rest\s+day/i.test(normalized)) return []

  // Strip leading bullet / numbering
  let content = normalized
    .replace(/^[-*•]+\s*/, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/\*+/g, '') // Strip bold/italic markdown delimiters
    .trim()

  // Strip labeled prefix: "Exercise 1:", "Circuit A:", "Station 2:"
  content = stripLabeledItemPrefix(content)
  if (content.length < 2) return []

  // Skip nutritional items or non-workout sections
  const lowerContent = content.toLowerCase()
  if (
    lowerContent.startsWith('breakfast') ||
    lowerContent.startsWith('lunch') ||
    lowerContent.startsWith('dinner') ||
    lowerContent.startsWith('snack') ||
    lowerContent.startsWith('morning snack') ||
    lowerContent.startsWith('afternoon snack') ||
    lowerContent.startsWith('evening snack') ||
    lowerContent.startsWith('post-workout') ||
    lowerContent.startsWith('pre-workout') ||
    lowerContent.startsWith('hydration') ||
    lowerContent.startsWith('warm-up') ||
    lowerContent.startsWith('warmup') ||
    lowerContent.startsWith('cool-down') ||
    lowerContent.startsWith('cooldown') ||
    lowerContent.startsWith('main workout') ||
    lowerContent.startsWith('activities')
  ) {
    // If it's a section header without sets/reps, skip
    if (!/\b(?:\d+\s*sets?|\d+\s*reps?|\d+\s*x\s*\d+)\b/i.test(content)) {
      return []
    }
  }

  // STEP 1: Protect legitimate compound Olympic movements containing 'and' or '&'
  const protectedTokens: Array<{ token: string; original: string }> = []
  let protectedContent = content

  PROTECTED_COMPOUND_NAMES.forEach((pattern, idx) => {
    protectedContent = protectedContent.replace(pattern, match => {
      const token = `__BODYMAP_PROTECTED_${idx}_${protectedTokens.length}__`
      protectedTokens.push({ token, original: match })
      return token
    })
  })

  // STEP 2: Multi-exercise compound segmentation
  // Supported compound conjunctions:
  // - & or &&
  // - + (plus)
  // - / (slash)
  // - ; (semicolon)
  // - | (pipe)
  // - — or – (em/en-dash) or -- (double hyphen)
  // - paired with
  // - followed by
  // - then
  // - alternating with
  // - superset with / superset
  // - combined with
  // - and (when surrounded by whitespace, protected lifts preserved)
  // - commas (when followed by a new exercise with its own prescription)
  // NOTE: Bare 'with' is intentionally NOT a separator (e.g. 'Back extensions with weight')
  const compoundSplitRegex =
    /(?:[;+|]|\s*[—–]\s*|\s+--\s+|\s+and\s+|\s*&\s*|\s*&&\s*|\s*\+\s*|\s+paired\s+with\s+|\s+followed\s+by\s+|\s+then\s+|\s+alternating\s+with\s+|\s+superset(?:\s+with)?\s+|\s+combined\s+with\s+|\s*[/]\s*|,\s*(?=[A-Za-z0-9- ]+:\s*\d))/i

  const rawSegments = protectedContent.split(compoundSplitRegex).map(s => s.trim()).filter(s => s.length > 0)

  // Restore protected tokens inside segments
  const segments = rawSegments.map(seg => {
    let restored = seg
    for (const p of protectedTokens) {
      restored = restored.replace(p.token, p.original)
    }
    return restored
  })

  // If multiple colon-separated exercises exist inside a single segment, split on comma
  const normalizedSegments: string[] = []
  for (const seg of segments) {
    if ((seg.match(/:/g) || []).length > 1) {
      const subParts = seg.split(/,\s*(?=[A-Za-z0-9- ]+:)/)
      if (subParts.length > 1) {
        normalizedSegments.push(...subParts.map(sp => sp.trim()))
      } else {
        normalizedSegments.push(seg)
      }
    } else {
      normalizedSegments.push(seg)
    }
  }

  // STEP 3: Parse individual segments and handle shared vs individual prescriptions
  // Check if a line-level shared prescription exists at the end of the line
  const lastSeg = normalizedSegments[normalizedSegments.length - 1]
  const lineLevelPrescription = extractPrescriptionDetails(lastSeg)

  const exercises: CanonicalExercise[] = []

  for (let i = 0; i < normalizedSegments.length; i++) {
    const seg = normalizedSegments[i]
    if (seg.length < 2) continue

    // Check if this segment is actually a substitution clause attached via semicolon or comma
    // e.g. "alternative to back squats" or "substitute for deadlifts"
    if (SUBSTITUTION_CLAUSE_REGEX.test(seg) && exercises.length > 0) {
      // Attach to the preceding exercise's notes and raw representation
      const prev = exercises[exercises.length - 1]
      prev.notes = prev.notes ? `${prev.notes} (${seg})` : `(${seg})`
      prev.raw = `${prev.raw}; ${seg}`
      continue
    }

    // Extract any parenthetical/bracketed notes
    const notesMatches = seg.match(/(?:\([^)]*\)|\[[^\]]*\])/g)
    const notes = notesMatches ? notesMatches.join(' ') : undefined

    // Extract prescription details specific to this segment
    const segPrescription = extractPrescriptionDetails(seg)

    // Name extraction
    const cleanName = cleanExerciseName(seg)

    // If segment has no colon or prescription, but line has a shared prescription at the end:
    // inherit the line-level prescription
    const sets = segPrescription.sets || (normalizedSegments.length > 1 ? lineLevelPrescription.sets : undefined)
    const reps = segPrescription.reps || (normalizedSegments.length > 1 ? lineLevelPrescription.reps : undefined)
    const rest = segPrescription.rest || (normalizedSegments.length > 1 ? lineLevelPrescription.rest : undefined)

    if (cleanName.length > 1) {
      exercises.push({
        name: cleanName,
        sets,
        reps,
        rest,
        notes,
        raw: seg,
      })
    }
  }

  return exercises
}

/**
 * Extracts all canonical exercises from a multiline workout section text.
 */
export function parseWorkoutSectionToCanonicalExercises(sectionText: string): CanonicalExercise[] {
  if (!sectionText || typeof sectionText !== 'string') return []

  const exercises: CanonicalExercise[] = []
  const lines = sectionText.split('\n')

  for (const line of lines) {
    const parsed = parseCanonicalExerciseLine(line)
    exercises.push(...parsed)
  }

  return exercises
}
