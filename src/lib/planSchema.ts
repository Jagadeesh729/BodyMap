import { z } from 'zod'

export const ExerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name cannot be empty'),
  sets: z.string().optional(),
  reps: z.string().optional(),
  rest: z.string().optional(),
})

export const WorkoutSectionSchema = z.object({
  warmup: z.string().min(1),
  exercises: z.array(ExerciseSchema).default([]),
  cooldown: z.string().min(1),
})

export const MealsSectionSchema = z.object({
  breakfast: z.string().min(1, 'Breakfast is required'),
  lunch: z.string().min(1, 'Lunch is required'),
  dinner: z.string().min(1, 'Dinner is required'),
  snacks: z.string().optional(),
  estimatedCalories: z.string().optional(),
})

export const DayScheduleSchema = z.object({
  dayNumber: z.number().int().min(1).max(7),
  title: z.string().min(1),
  isRestDay: z.boolean().default(false),
  workout: WorkoutSectionSchema.optional(),
  nutrition: MealsSectionSchema.optional(),
  rawContent: z.string().min(1),
})

export const BaseWeeklyPlanSchema = z.object({
  days: z.array(DayScheduleSchema),
  motivationalQuote: z.string().optional(),
  isValid: z.boolean(),
})

export const WeeklyPlanSchema = BaseWeeklyPlanSchema.extend({
  days: z.array(DayScheduleSchema).length(7, 'Plan must contain exactly 7 days (Day 1 to Day 7)'),
}).refine(
  data => data.days.every((d, idx) => d.dayNumber === idx + 1),
  { message: 'Plan days must be numbered sequentially from Day 1 to Day 7' }
)

export type Exercise = z.infer<typeof ExerciseSchema>
export type WorkoutSection = z.infer<typeof WorkoutSectionSchema>
export type MealsSection = z.infer<typeof MealsSectionSchema>
export type DaySchedule = z.infer<typeof DayScheduleSchema>
export type WeeklyPlan = z.infer<typeof WeeklyPlanSchema>

/**
 * Extracts exercise items from markdown bullet points like:
 * - Push-ups: 3 sets x 12 reps
 * - Overhead Press: 3 sets x 10 reps
 */
function parseExercises(text: string): Exercise[] {
  const exercises: Exercise[] = []
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    const isBullet = /^[-*•]/.test(trimmed)
    const isNumbered = /^\d+[.)]\s/.test(trimmed)
    if (isBullet || isNumbered) {
      const content = trimmed
        .replace(/^[-*•]+\s*/, '')
        .replace(/^\d+[.)]\s*/, '')
        .replace(/\*+/g, '')
        .trim()
      const lower = content.toLowerCase()
      if (lower.startsWith('breakfast') ||
          lower.startsWith('lunch') ||
          lower.startsWith('dinner') ||
          lower.startsWith('snack') ||
          lower.startsWith('warm-up') ||
          lower.startsWith('warmup') ||
          lower.startsWith('cool-down') ||
          lower.startsWith('cooldown') ||
          lower.startsWith('main workout') ||
          lower.startsWith('activities')) {
        continue
      }
      if (content.includes(':')) {
        const [name, details] = content.split(':')
        const setsMatch = details.match(/(\d+)\s*sets?/i)
        const repsMatch = details.match(/(\d+[\d-]*)\s*reps?/i)
        const restMatch = details.match(/(\d+s|\d+\s*sec|\d+\s*min)/i)
        exercises.push({
          name: name.trim(),
          sets: setsMatch ? setsMatch[1] : undefined,
          reps: repsMatch ? repsMatch[1] : undefined,
          rest: restMatch ? restMatch[1] : undefined,
        })
      } else if (content.length > 2) {
        exercises.push({ name: content.trim() })
      }
    }

  }
  return exercises
}

/**
 * Parses raw plan markdown into a strictly validated 7-day WeeklyPlan domain model.
 */
export function parseAndValidatePlan(markdown: string, requireSevenDays = true): {
  success: boolean
  data?: WeeklyPlan
  errors?: string[]
} {
  if (!markdown || typeof markdown !== 'string' || markdown.trim().length < 50) {
    return { success: false, errors: ['Plan content is too short or empty.'] }
  }

  const dayHeaderRegex = /#{2,3}\s*Day\s*(\d+)[^\n]*/gi
  const dayMatches = Array.from(markdown.matchAll(dayHeaderRegex))

  if (dayMatches.length === 0) {
    return { success: false, errors: ['No valid Day headers (## Day N or ### Day N) found in plan.'] }
  }

  const seenDayNumbers = new Set<number>()
  const days: DaySchedule[] = []

  for (let i = 0; i < dayMatches.length; i++) {
    const match = dayMatches[i]
    const parsedNumber = parseInt(match[1], 10)
    const dayNumber = isNaN(parsedNumber) ? i + 1 : parsedNumber

    if (seenDayNumbers.has(dayNumber)) {
      return { success: false, errors: [`Duplicate Day ${dayNumber} found in plan.`] }
    }
    seenDayNumbers.add(dayNumber)

    const title = match[0].replace(/^#{2,3}\s*/, '').trim()
    const startIndex = match.index! + match[0].length
    const endIndex = i + 1 < dayMatches.length ? dayMatches[i + 1].index! : markdown.length
    const dayContent = markdown.substring(startIndex, endIndex).trim()

    const isRest = /rest\s+day|active\s+recovery/i.test(title) || /rest\s+day|active\s+recovery/i.test(dayContent)

    // Separate workout section from meals section
    const mealSplitRegex = /\*\*(?:Meals|Nutrition|Diet):?\*\*|\*\*(?:Meals|Nutrition|Diet)\*\*:?/i
    const parts = dayContent.split(mealSplitRegex)
    const workoutText = parts[0] || ''
    const nutritionText = parts.length > 1 ? parts[1] : dayContent


    // Parse warm-up, cool-down, and exercises from workout section
    const warmupMatch = workoutText.match(/Warm-up:?\s*([^\n]+)/i)
    const cooldownMatch = workoutText.match(/Cool-down:?\s*([^\n]+)/i)
    const exercises = parseExercises(workoutText)

    // Parse meals from nutrition section
    const breakfastMatch = nutritionText.match(/Breakfast:?\s*([^\n]+)/i)
    const lunchMatch = nutritionText.match(/Lunch:?\s*([^\n]+)/i)
    const dinnerMatch = nutritionText.match(/Dinner:?\s*([^\n]+)/i)
    const snacksMatch = nutritionText.match(/Snacks?:?\s*([^\n]+)/i)
    const caloriesMatch = nutritionText.match(/(\d{3,4})\s*(?:kcal|calories)/i)

    const daySchedule: DaySchedule = {
      dayNumber,
      title: title || `Day ${dayNumber}`,
      isRestDay: isRest,
      rawContent: dayContent,
      workout: !isRest || exercises.length > 0 ? {
        warmup: warmupMatch ? warmupMatch[1].trim() : '5-minute dynamic mobility warm-up',
        exercises,
        cooldown: cooldownMatch ? cooldownMatch[1].trim() : '5-minute static cooldown stretching',
      } : undefined,
      nutrition: (breakfastMatch && lunchMatch && dinnerMatch) ? {
        breakfast: breakfastMatch[1].trim(),
        lunch: lunchMatch[1].trim(),
        dinner: dinnerMatch[1].trim(),
        snacks: snacksMatch ? snacksMatch[1].trim() : undefined,
        estimatedCalories: caloriesMatch ? `${caloriesMatch[1]} kcal` : undefined,
      } : undefined,
    }

    days.push(daySchedule)

  }

  // Sort days sequentially by dayNumber
  days.sort((a, b) => a.dayNumber - b.dayNumber)

  const quoteMatch = markdown.match(/>\s*["“]([^"”]+)["”]/)
  const motivationalQuote = quoteMatch ? quoteMatch[1].trim() : undefined

  const schemaToUse = requireSevenDays
    ? WeeklyPlanSchema
    : BaseWeeklyPlanSchema.extend({ days: z.array(DayScheduleSchema).min(1).max(7) })

  const validationResult = schemaToUse.safeParse({
    days,
    motivationalQuote,
    isValid: days.length >= 1,
  })

  if (!validationResult.success) {
    const issues = validationResult.error.issues.map(iss => `${iss.path.join('.')}: ${iss.message}`)
    return { success: false, errors: issues }
  }

  return { success: true, data: validationResult.data as WeeklyPlan }
}

