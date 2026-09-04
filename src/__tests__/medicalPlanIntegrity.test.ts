// medicalPlanIntegrity.test.ts
// Tests verifying medical profile-plan synchronization, prompt safety directives,
// and execution safety boundaries.

import { describe, it, expect } from 'vitest'
import { generatePlanPrompt as clientGeneratePlanPrompt } from '../lib/gemini'
import { generatePlanPrompt as serverGeneratePlanPrompt } from '../../api/generate-plan'
import { hasSafetySensitiveMedicalIssues } from '../lib/validation'
import { getActiveAllergenCategories } from '../lib/allergenGuard'
import type { FormData } from '../types/formData'

describe('Safety Directives in Prompt Construction Parity', () => {
  const sampleForm: FormData = {
    age: '30',
    gender: 'Male',
    height: '180',
    weight: '80',
    fitnessLevel: 'Intermediate',
    mainGoal: 'Build Muscle',
    bodyFocus: ['Full Body'],
    timePerDay: '45',
    recoveryDays: '2',
    medicalIssues: 'Acute ACL tear and left rotator cuff impingement',
    equipment: ['Dumbbells'],
    pushupCount: '15',
    dietaryPreference: 'Omnivore',
    allergies: 'Peanuts',
    specialRequests: 'None',
    sleepHours: '8',
    stressLevel: 'Moderate',
  }

  it('verifies client generatePlanPrompt contains explicit medical contraindication directives', () => {
    const prompt = clientGeneratePlanPrompt(sampleForm)
    expect(prompt).toContain('CRITICAL SAFETY DIRECTIVES')
    expect(prompt).toContain('MEDICAL & INJURY CONTRAINDICATIONS')
    expect(prompt).toContain('NEVER prescribe exercises that aggravate declared conditions')
    expect(prompt).toContain('knee/ACL/meniscus')
    expect(prompt).toContain('rotator cuff')
    expect(prompt).toContain('spinal loading')
  })

  it('verifies server generatePlanPrompt contains identical medical contraindication directives', () => {
    const prompt = serverGeneratePlanPrompt(sampleForm)
    expect(prompt).toContain('CRITICAL SAFETY DIRECTIVES')
    expect(prompt).toContain('MEDICAL & INJURY CONTRAINDICATIONS')
    expect(prompt).toContain('NEVER prescribe exercises that aggravate declared conditions')
    expect(prompt).toContain('knee/ACL/meniscus')
    expect(prompt).toContain('rotator cuff')
    expect(prompt).toContain('spinal loading')
  })
})

describe('EditPlanPage Stale-Plan Synchronization Boundary', () => {
  it('detects safety-critical health mutations requiring regeneration', () => {
    const currentMedical = 'None'
    const newMedical = 'Acute ACL tear'
    const currentAllergies = 'None'
    const newAllergies = 'Peanuts'

    const isMedicalChange = newMedical.trim() !== currentMedical.trim() && hasSafetySensitiveMedicalIssues(newMedical)
    const isAllergyChange = newAllergies.trim() !== currentAllergies.trim() && getActiveAllergenCategories(newAllergies).length > 0

    expect(isMedicalChange).toBe(true)
    expect(isAllergyChange).toBe(true)
  })

  it('permits benign preference changes without forcing regeneration', () => {
    const currentMedical = 'None'
    const newMedical = 'None'
    const currentAllergies = 'None'
    const newAllergies = 'None'

    const isMedicalChange = newMedical.trim() !== currentMedical.trim() && hasSafetySensitiveMedicalIssues(newMedical)
    const isAllergyChange = newAllergies.trim() !== currentAllergies.trim() && getActiveAllergenCategories(newAllergies).length > 0

    expect(isMedicalChange).toBe(false)
    expect(isAllergyChange).toBe(false)
  })
})
