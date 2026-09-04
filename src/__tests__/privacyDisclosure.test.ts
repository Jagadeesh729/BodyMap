import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { FullFormDataSchema } from '../lib/validation'

describe('Privacy Disclosure & Local Storage Invariants', () => {
  it('verifies exact 17 form fields in FullFormDataSchema', () => {
    const shape = FullFormDataSchema.shape
    const fieldKeys = Object.keys(shape)
    expect(fieldKeys.length).toBe(17)
    expect(fieldKeys).toEqual([
      'age',
      'gender',
      'height',
      'weight',
      'fitnessLevel',
      'mainGoal',
      'bodyFocus',
      'timePerDay',
      'medicalIssues',
      'equipment',
      'pushupCount',
      'dietaryPreference',
      'allergies',
      'specialRequests',
      'recoveryDays',
      'sleepHours',
      'stressLevel',
    ])
  })

  it('verifies point-of-collection privacy disclosure in CreatePlanPage.tsx', () => {
    const createPlanSource = fs.readFileSync(path.resolve(__dirname, '../pages/CreatePlanPage.tsx'), 'utf-8')
    expect(createPlanSource).toContain('Privacy &amp; Data Transparency')
    expect(createPlanSource).toContain('your 17 physical and dietary parameters are transmitted securely via TLS')
    expect(createPlanSource).toContain('stateless serverless proxy to invoke Google Gemini AI under applicable provider terms')
    expect(createPlanSource).toContain('workout logs, personal records, and progress metrics remain 100% on your local device')
    expect(createPlanSource).toContain('BodyMap maintains zero remote user databases or advertising trackers')
  })

  it('verifies local-first architecture disclosure in AboutContactPage.tsx', () => {
    const aboutSource = fs.readFileSync(path.resolve(__dirname, '../pages/AboutContactPage.tsx'), 'utf-8')
    expect(aboutSource).toContain('Local-first architecture: workout history &amp; metrics remain exclusively on your device')
    expect(aboutSource).toContain('Powered by Gemini AI &amp; React 18')
  })
})
