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
  if (!formData || typeof formData !== 'object') return ''
  const canonical = {
    age: (typeof formData.age === 'string' ? formData.age : '').trim(),
    gender: (typeof formData.gender === 'string' ? formData.gender : '').trim(),
    height: (typeof formData.height === 'string' ? formData.height : '').trim(),
    weight: (typeof formData.weight === 'string' ? formData.weight : '').trim(),
    fitnessLevel: (typeof formData.fitnessLevel === 'string' ? formData.fitnessLevel : '').trim(),
    mainGoal: (typeof formData.mainGoal === 'string' ? formData.mainGoal : '').trim(),
    bodyFocus: Array.isArray(formData.bodyFocus)
      ? [...formData.bodyFocus.filter((s): s is string => typeof s === 'string')].sort().join(',')
      : '',
    timePerDay: (typeof formData.timePerDay === 'string' ? formData.timePerDay : '').trim(),
    recoveryDays: (typeof formData.recoveryDays === 'string' ? formData.recoveryDays : '').trim(),
    medicalIssues: (typeof formData.medicalIssues === 'string' ? formData.medicalIssues : '').trim().toLowerCase(),
    dietaryPreference: (typeof formData.dietaryPreference === 'string' ? formData.dietaryPreference : '').trim().toLowerCase(),
    allergies: (typeof formData.allergies === 'string' ? formData.allergies : '').trim().toLowerCase(),
    equipment: Array.isArray(formData.equipment)
      ? [...formData.equipment.filter((s): s is string => typeof s === 'string')].sort().join(',')
      : '',
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
  const currentMedical = (typeof currentFormData.medicalIssues === 'string' ? currentFormData.medicalIssues : '').trim().toLowerCase()
  const boundMedical = (typeof boundProfile.medicalIssues === 'string' ? boundProfile.medicalIssues : '').trim().toLowerCase()
  if (currentMedical !== boundMedical) {
    if (hasSafetySensitiveMedicalIssues(currentMedical) || hasSafetySensitiveMedicalIssues(boundMedical)) {
      mismatchedSafetyFields.push('medicalIssues')
    }
  }

  // 2. Check Allergies:
  const currentAllergies = typeof currentFormData.allergies === 'string' ? currentFormData.allergies : ''
  const boundAllergies = typeof boundProfile.allergies === 'string' ? boundProfile.allergies : ''
  const currentAllergens = getActiveAllergenCategories(currentAllergies).sort().join(',')
  const boundAllergens = getActiveAllergenCategories(boundAllergies).sort().join(',')
  if (currentAllergens !== boundAllergens) {
    mismatchedSafetyFields.push('allergies')
  }

  // 3. Check Preferences:
  const curGoal = (typeof currentFormData.mainGoal === 'string' ? currentFormData.mainGoal : '').trim()
  const boundGoal = (typeof boundProfile.mainGoal === 'string' ? boundProfile.mainGoal : '').trim()
  if (curGoal !== boundGoal) {
    mismatchedPreferenceFields.push('mainGoal')
  }

  const curTime = (typeof currentFormData.timePerDay === 'string' ? currentFormData.timePerDay : '').trim()
  const boundTime = (typeof boundProfile.timePerDay === 'string' ? boundProfile.timePerDay : '').trim()
  if (curTime !== boundTime) {
    mismatchedPreferenceFields.push('timePerDay')
  }

  const curFit = (typeof currentFormData.fitnessLevel === 'string' ? currentFormData.fitnessLevel : '').trim()
  const boundFit = (typeof boundProfile.fitnessLevel === 'string' ? boundProfile.fitnessLevel : '').trim()
  if (curFit !== boundFit) {
    mismatchedPreferenceFields.push('fitnessLevel')
  }

  const curEq = Array.isArray(currentFormData.equipment)
    ? [...currentFormData.equipment.filter((s): s is string => typeof s === 'string')].sort().join(',')
    : ''
  const boundEq = Array.isArray(boundProfile.equipment)
    ? [...boundProfile.equipment.filter((s): s is string => typeof s === 'string')].sort().join(',')
    : ''
  if (curEq !== boundEq) {
    mismatchedPreferenceFields.push('equipment')
  }

  const curFocus = Array.isArray(currentFormData.bodyFocus)
    ? [...currentFormData.bodyFocus.filter((s): s is string => typeof s === 'string')].sort().join(',')
    : ''
  const boundFocus = Array.isArray(boundProfile.bodyFocus)
    ? [...boundProfile.bodyFocus.filter((s): s is string => typeof s === 'string')].sort().join(',')
    : ''
  if (curFocus !== boundFocus) {
    mismatchedPreferenceFields.push('bodyFocus')
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
