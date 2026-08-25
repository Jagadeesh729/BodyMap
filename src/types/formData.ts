/**
 * Shared FormData type — imported by both the React client (PlanContext.tsx)
 * and the Node.js serverless function (api/generate-plan.ts → gemini.ts).
 *
 * IMPORTANT: This file MUST remain free of React, DOM, or browser-only imports.
 * It is loaded in the Node.js serverless runtime. Any browser dependency here
 * will cause FUNCTION_INVOCATION_FAILED on Vercel cold-start.
 */
export interface FormData {
  age: string
  gender: string
  height: string
  weight: string
  fitnessLevel: string
  mainGoal: string
  bodyFocus: string[]
  timePerDay: string
  medicalIssues: string
  equipment: string[]
  pushupCount: string
  dietaryPreference: string
  allergies: string
  specialRequests: string
  recoveryDays: string
  sleepHours: string
  stressLevel: string
}
