// planBinding.ts
// Pure, deterministic plan-profile fingerprinting and integrity evaluation engine.

import type { FormData } from '../types/formData'
import { hasSafetySensitiveMedicalIssues } from './validation'
import { getActiveAllergenCategories } from './allergenGuard'

export interface ProfileBindingEvaluation {
  isBound: boolean
  isSafetyMismatched: boolean
  isPreferenceMismatched: boolean
  mismatchedSafetyFields: string[]
  mismatchedPreferenceFields: string[]
  reason?: string
}

/**
 * Computes a deterministic canonical string representation of the safety-critical
 * and physiological parameters of a user profile.
 */
export function computeProfileFingerprint(formData?: Partial<FormData> | null): string {
  if (!formData) return ''
  const canonical = {
    age: (formData.age || '').trim(),
    gender: (formData.gender || '').trim(),
    height: (formData.height || '').trim(),
    weight: (formData.weight || '').trim(),
    fitnessLevel: (formData.fitnessLevel || '').trim(),
    mainGoal: (formData.mainGoal || '').trim(),
    bodyFocus: [...(formData.bodyFocus || [])].sort().join(','),
    timePerDay: (formData.timePerDay || '').trim(),
    recoveryDays: (formData.recoveryDays || '').trim(),
    medicalIssues: (formData.medicalIssues || '').trim().toLowerCase(),
    dietaryPreference: (formData.dietaryPreference || '').trim().toLowerCase(),
    allergies: (formData.allergies || '').trim().toLowerCase(),
    equipment: [...(formData.equipment || [])].sort().join(','),
  }
  return JSON.stringify(canonical)
}

/**
 * Evaluates whether a currently displayed or executed plan is bound to and consistent with
 * the user's current formData.
 *
 * Safety-critical mismatch:
 * - Current profile has active medical issues that differ from the plan's bound profile.
 * - Current profile has active allergen categories that differ from the plan's bound profile.
 *
 * Preference mismatch:
 * - Goals, time commitment, or equipment changed (informational stale notice, non-blocking).
 */
export function evaluatePlanProfileBinding(
  currentFormData?: FormData | null,
  boundProfile?: Partial<FormData> | null
): ProfileBindingEvaluation {
  if (!currentFormData) {
    return {
      isBound: false,
      isSafetyMismatched: false,
      isPreferenceMismatched: false,
      mismatchedSafetyFields: [],
      mismatchedPreferenceFields: [],
    }
  }

  // If there is no bound profile record (e.g. legacy plan created before binding),
  // we check if the current profile has safety constraints.
  if (!boundProfile) {
    const hasMedical = hasSafetySensitiveMedicalIssues(currentFormData.medicalIssues)
    const hasAllergens = getActiveAllergenCategories(currentFormData.allergies).length > 0
    if (hasMedical || hasAllergens) {
      return {
        isBound: false,
        isSafetyMismatched: true,
        isPreferenceMismatched: false,
        mismatchedSafetyFields: [
          ...(hasMedical ? ['medicalIssues'] : []),
          ...(hasAllergens ? ['allergies'] : []),
        ],
        reason: 'Plan has no recorded profile binding and current profile contains active safety constraints.',
      }
    }
    return {
      isBound: false,
      isSafetyMismatched: false,
      isPreferenceMismatched: false,
      mismatchedSafetyFields: [],
      mismatchedPreferenceFields: [],
    }
  }

  const mismatchedSafetyFields: string[] = []
  const mismatchedPreferenceFields: string[] = []

  // 1. Check Medical Issues:
  const currentMedical = (currentFormData.medicalIssues || '').trim().toLowerCase()
  const boundMedical = (boundProfile.medicalIssues || '').trim().toLowerCase()
  if (currentMedical !== boundMedical) {
    if (hasSafetySensitiveMedicalIssues(currentFormData.medicalIssues) || hasSafetySensitiveMedicalIssues(boundProfile.medicalIssues)) {
      mismatchedSafetyFields.push('medicalIssues')
    }
  }

  // 2. Check Allergies:
  const currentAllergens = getActiveAllergenCategories(currentFormData.allergies).sort().join(',')
  const boundAllergens = getActiveAllergenCategories(boundProfile.allergies).sort().join(',')
  if (currentAllergens !== boundAllergens) {
    mismatchedSafetyFields.push('allergies')
  }

  // 3. Check Preferences:
  if ((currentFormData.mainGoal || '').trim() !== (boundProfile.mainGoal || '').trim()) {
    mismatchedPreferenceFields.push('mainGoal')
  }
  if ((currentFormData.timePerDay || '').trim() !== (boundProfile.timePerDay || '').trim()) {
    mismatchedPreferenceFields.push('timePerDay')
  }
  if ((currentFormData.fitnessLevel || '').trim() !== (boundProfile.fitnessLevel || '').trim()) {
    mismatchedPreferenceFields.push('fitnessLevel')
  }

  const isSafetyMismatched = mismatchedSafetyFields.length > 0
  const isPreferenceMismatched = mismatchedPreferenceFields.length > 0
  const isBound = !isSafetyMismatched && !isPreferenceMismatched

  let reason: string | undefined
  if (isSafetyMismatched) {
    reason = `Safety-critical mismatch detected in: ${mismatchedSafetyFields.join(', ')}. Plan must be regenerated before workouts or meals can proceed.`
  } else if (isPreferenceMismatched) {
    reason = `Preference changes detected in: ${mismatchedPreferenceFields.join(', ')}. Plan may not reflect latest preferences.`
  }

  return {
    isBound,
    isSafetyMismatched,
    isPreferenceMismatched,
    mismatchedSafetyFields,
    mismatchedPreferenceFields,
    reason,
  }
}
