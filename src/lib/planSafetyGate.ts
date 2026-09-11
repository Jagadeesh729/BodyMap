/**
 * planSafetyGate.ts
 *
 * Authoritative, pure, deterministic safety evaluation engine for BodyMap AI consumer sinks.
 * Enforces the core clinical safety invariant:
 * UNSAFE / STALE / PROFILE-MISMATCHED / ALLERGEN-VIOLATING / CONTRAINDICATED / CORRUPTED PLAN
 * -> MUST NOT ESCAPE THROUGH ANY CONTENT-BEARING USER ACTION.
 */

import type { FormData } from '../types/formData'
import { evaluatePlanProfileBinding, type ProfileBindingEvaluation } from './planBinding'
import { scanPlanForContraindications, type ContraindicationScanResult } from './contraindicationGuard'
import {
  scanPlanForAllergens,
  scanMealTextForAllergens,
  getActiveAllergenCategories,
  type AllergenScanResult
} from './allergenGuard'
import { parseAndValidatePlan } from './planSchema'

export interface EvaluatePlanSafetyOptions {
  formData?: FormData | null
  boundProfile?: Partial<FormData> | null
  planText?: string | null
  isGenerated?: boolean
  parsedAiPlanSuccess?: boolean
  additionalExerciseLines?: string
  additionalMealTexts?: string[]
}

export interface PlanSafetyEvaluation {
  isSafetyViolated: boolean
  isWorkoutLocked: boolean
  isSafetyMismatched: boolean
  hasContraindications: boolean
  hasAllergens: boolean
  isPlanCorrupted: boolean
  reasons: string[]
  bindingEval: ProfileBindingEvaluation
  contraScan: ContraindicationScanResult
  allergenScan: AllergenScanResult
}

export interface GrocerySafetyEvaluation {
  isGrocerySafetyViolated: boolean
  hasAllergens: boolean
  isAllergenMismatched: boolean
  isPlanCorrupted: boolean
  reasons: string[]
}

/**
 * Deterministically evaluates the safety state of a fitness/nutrition plan against
 * the user's current medical profile, declared allergies, and schema validity.
 */
export function evaluatePlanContentSafety(options: EvaluatePlanSafetyOptions): PlanSafetyEvaluation {
  const {
    formData,
    boundProfile,
    planText,
    isGenerated = false,
    parsedAiPlanSuccess,
    additionalExerciseLines,
    additionalMealTexts
  } = options

  // 1. Evaluate Profile-Plan Binding & Stale State
  const bindingEval = evaluatePlanProfileBinding(formData, boundProfile)
  const isSafetyMismatched = bindingEval.isSafetyMismatched

  // 2. Scan Contraindications across raw markdown and parsed exercise lines
  const textToScanContra = typeof planText === 'string' ? planText : ''
  const baseContraScan = scanPlanForContraindications(textToScanContra, formData?.medicalIssues)

  let combinedContraScan: ContraindicationScanResult
  if (additionalExerciseLines && additionalExerciseLines.trim()) {
    const additionalContraScan = scanPlanForContraindications(additionalExerciseLines, formData?.medicalIssues)
    combinedContraScan = {
      hasViolation: baseContraScan.hasViolation || additionalContraScan.hasViolation,
      violations: [...baseContraScan.violations, ...additionalContraScan.violations],
      scannedExerciseCount: baseContraScan.scannedExerciseCount + additionalContraScan.scannedExerciseCount
    }
  } else {
    combinedContraScan = baseContraScan
  }

  // 3. Scan Allergens across raw markdown and aggregated meal texts
  const textToScanAllergens = typeof planText === 'string' ? planText : ''
  const baseAllergenScan = (formData?.allergies && formData.allergies.trim())
    ? scanPlanForAllergens(textToScanAllergens, formData.allergies)
    : { hasViolation: false, violations: [] }

  let combinedAllergenScan: AllergenScanResult
  const activeCats = (formData?.allergies && formData.allergies.trim())
    ? getActiveAllergenCategories(formData.allergies)
    : []

  if (activeCats.length > 0 && Array.isArray(additionalMealTexts) && additionalMealTexts.length > 0) {
    const displayedViolations = []
    for (const mealText of additionalMealTexts) {
      const scan = scanMealTextForAllergens(mealText, activeCats)
      if (scan.hasViolation) {
        displayedViolations.push(...scan.violations)
      }
    }
    combinedAllergenScan = {
      hasViolation: baseAllergenScan.hasViolation || displayedViolations.length > 0,
      violations: [...baseAllergenScan.violations, ...displayedViolations]
    }
  } else {
    combinedAllergenScan = baseAllergenScan
  }

  // 4. Evaluate Plan Schema Corruption
  let isPlanCorrupted = false
  if (isGenerated) {
    if (typeof parsedAiPlanSuccess === 'boolean') {
      isPlanCorrupted = !parsedAiPlanSuccess
    } else if (planText && planText.trim()) {
      const parseRes = parseAndValidatePlan(planText, false)
      isPlanCorrupted = !parseRes.success
    } else {
      isPlanCorrupted = true
    }
  }

  const hasContraindications = combinedContraScan.hasViolation
  const hasAllergens = combinedAllergenScan.hasViolation
  const isWorkoutLocked = isSafetyMismatched || hasContraindications
  const isSafetyViolated = isWorkoutLocked || hasAllergens || isPlanCorrupted

  const reasons: string[] = []
  if (isSafetyMismatched) {
    reasons.push(`Profile safety mismatch: ${bindingEval.mismatchedSafetyFields.join(', ')}`)
  }
  if (hasContraindications) {
    const uniqueConditions = Array.from(new Set(combinedContraScan.violations.map(v => v.conditionLabel)))
    reasons.push(`Contraindicated movement detected for: ${uniqueConditions.join(', ')}`)
  }
  if (hasAllergens) {
    const uniqueAllergens = Array.from(new Set(combinedAllergenScan.violations.map(v => v.label)))
    reasons.push(`Allergen conflict detected for: ${uniqueAllergens.join(', ')}`)
  }
  if (isPlanCorrupted) {
    reasons.push('Plan failed schema validation or structure is corrupted')
  }

  return {
    isSafetyViolated,
    isWorkoutLocked,
    isSafetyMismatched,
    hasContraindications,
    hasAllergens,
    isPlanCorrupted,
    reasons,
    bindingEval,
    contraScan: combinedContraScan,
    allergenScan: combinedAllergenScan,
  }
}

/**
 * Evaluates whether grocery list content-bearing export is safe.
 * Blocks if meal plan contains allergens, allergy profile changed, or plan is corrupted.
 */
export function evaluateGroceryContentSafety(safetyEval: PlanSafetyEvaluation): GrocerySafetyEvaluation {
  const isAllergenMismatched = safetyEval.bindingEval.mismatchedSafetyFields.includes('allergies')
  const hasAllergens = safetyEval.hasAllergens
  const isPlanCorrupted = safetyEval.isPlanCorrupted
  const isGrocerySafetyViolated = hasAllergens || isAllergenMismatched || isPlanCorrupted

  const reasons: string[] = []
  if (hasAllergens) reasons.push('Allergen violation present in meal schedule')
  if (isAllergenMismatched) reasons.push('Allergy profile changed since meal schedule was generated')
  if (isPlanCorrupted) reasons.push('Plan schema corrupted')

  return {
    isGrocerySafetyViolated,
    hasAllergens,
    isAllergenMismatched,
    isPlanCorrupted,
    reasons,
  }
}
