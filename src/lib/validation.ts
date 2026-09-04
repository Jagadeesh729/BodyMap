import { z } from 'zod'

// Step 1 - Personal Details
export const step1Schema = z.object({
  age: z.string().min(1, 'Age is required').refine(v => {
    const n = Number(v); return n >= 13 && n <= 100
  }, 'Age must be between 13 and 100'),
  gender: z.string().min(1, 'Please select a gender'),
  height: z.string().min(1, 'Height is required').refine(v => {
    const n = Number(v); return n >= 50 && n <= 300
  }, 'Height must be between 50 and 300 cm'),
  weight: z.string().min(1, 'Weight is required').refine(v => {
    const n = Number(v); return n >= 20 && n <= 500
  }, 'Weight must be between 20 and 500 kg'),
  fitnessLevel: z.string().min(1, 'Please select your fitness level'),
})

// Step 2 - Goals
export const step2Schema = z.object({
  mainGoal: z.string().min(1, 'Please select a main goal'),
  bodyFocus: z.array(z.string()).min(1, 'Select at least one focus area'),
  timePerDay: z.string().min(1, 'Please select time available per day'),
})

// Step 3 - Health & Equipment (all optional)
export const step3Schema = z.object({
  medicalIssues: z.string().optional(),
  equipment: z.array(z.string()),
  pushupCount: z.string().optional(),
})

// Step 4 - Diet (dietary preference required)
export const step4Schema = z.object({
  dietaryPreference: z.string().min(1, 'Please select a dietary preference'),
  allergies: z.string().optional(),
  specialRequests: z.string().optional(),
})

// Step 5 - Recovery & Lifestyle
export const step5Schema = z.object({
  recoveryDays: z.string().min(1, 'Please select recovery days per week'),
  sleepHours: z.string().min(1, 'Please select sleep hours'),
  stressLevel: z.string().min(1, 'Please select your stress level'),
})

export type Step1Data = z.infer<typeof step1Schema>
export type Step2Data = z.infer<typeof step2Schema>
export type Step3Data = z.infer<typeof step3Schema>
export type Step4Data = z.infer<typeof step4Schema>
export type Step5Data = z.infer<typeof step5Schema>

export const FullFormDataSchema = z.object({
  age: z.string().trim().refine(v => {
    const n = Number(v)
    return Number.isInteger(n) && n >= 13 && n <= 100
  }, 'Age must be an integer between 13 and 100'),
  gender: z.string().trim().min(1, 'Gender is required').max(50, 'Gender must not exceed 50 characters'),
  height: z.string().trim().refine(v => {
    const n = Number(v)
    return !isNaN(n) && n >= 50 && n <= 300
  }, 'Height must be between 50 and 300 cm'),
  weight: z.string().trim().refine(v => {
    const n = Number(v)
    return !isNaN(n) && n >= 20 && n <= 500
  }, 'Weight must be between 20 and 500 kg'),
  fitnessLevel: z.string().trim().min(1, 'Fitness level is required').max(50, 'Fitness level must not exceed 50 characters'),
  mainGoal: z.string().trim().min(1, 'Main goal is required').max(50, 'Main goal must not exceed 50 characters'),
  bodyFocus: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  timePerDay: z.string().trim().refine(v => {
    const n = Number(v)
    return !isNaN(n) && n >= 10 && n <= 180
  }, 'Time per day must be between 10 and 180 minutes'),
  medicalIssues: z.string().trim().max(1000, 'Medical issues must not exceed 1000 characters').optional().default(''),
  equipment: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  pushupCount: z.string().trim().refine(v => {
    if (!v) return true
    const n = Number(v)
    return Number.isInteger(n) && n >= 0 && n <= 200
  }, 'Push-up count must be an integer between 0 and 200').optional().default(''),
  dietaryPreference: z.string().trim().min(1, 'Dietary preference is required').max(50, 'Dietary preference must not exceed 50 characters'),
  allergies: z.string().trim().max(1000, 'Allergies must not exceed 1000 characters').optional().default(''),
  specialRequests: z.string().trim().max(1000, 'Special requests must not exceed 1000 characters').optional().default(''),
  recoveryDays: z.string().trim().refine(v => {
    const n = Number(v)
    return Number.isInteger(n) && n >= 0 && n <= 6
  }, 'Recovery days must be an integer between 0 and 6'),
  sleepHours: z.string().trim().min(1, 'Sleep hours is required').max(50, 'Sleep hours must not exceed 50 characters'),
  stressLevel: z.string().trim().min(1, 'Stress level is required').max(50, 'Stress level must not exceed 50 characters'),
})

export type FullFormData = z.infer<typeof FullFormDataSchema>

export const stepSchemas = [step1Schema, step2Schema, step3Schema, step4Schema, step5Schema] as const

export function validateStep(step: number, data: Record<string, unknown>) {
  const schema = stepSchemas[step - 1]
  if (!schema) return { success: true, errors: {} }
  const result = schema.safeParse(data)
  if (result.success) return { success: true, errors: {} }
  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path[0] as string
    if (!errors[key]) errors[key] = issue.message
  }
  return { success: false, errors }
}

/**
 * Determines whether a user's declared medical issues string represents an active,
 * safety-sensitive medical condition or physical limitation (as opposed to 'None', empty, etc.).
 */
export function hasSafetySensitiveMedicalIssues(medicalIssues?: string): boolean {
  if (!medicalIssues || typeof medicalIssues !== 'string') return false
  const trimmed = medicalIssues.trim().toLowerCase()
  if (!trimmed) return false
  const benignPatterns = [
    /^none\b/i,
    /^none\s+stated\b/i,
    /^no\b/i,
    /^n\/?a\b/i,
    /^nil\b/i,
    /^nothing\b/i,
    /^healthy\b/i,
    /^no\s+(?:known\s+)?(?:medical\s+issues?|injuries|limitations|conditions)\b/i,
  ]
  return !benignPatterns.some(pattern => pattern.test(trimmed))
}

