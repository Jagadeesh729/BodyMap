/**
 * BodyMap AI — Hydration Target Calculator (Enhancement E24)
 * ==========================================================
 * Pure, deterministic, local-first domain engine for calculating an
 * informational daily fluid guideline range based on body weight,
 * planned exercise duration, and environmental climate context.
 *
 * SCIENTIFIC METHODOLOGY & ATTRIBUTION:
 * -------------------------------------
 * 1. Baseline Fluid Requirement (Body Mass Standard):
 *    - Standard clinical dietetics & sports nutrition maintenance guideline:
 *      30 to 35 mL of fluid per kilogram of body mass per day (0.030–0.035 L/kg/day).
 *    - Supported by reference values discussed in:
 *      * European Food Safety Authority (EFSA) Scientific Opinion on Dietary
 *        Reference Values for water (EFSA Journal 2010; 8(3):1459).
 *      * National Academies of Sciences, Engineering, and Medicine (NASEM / IOM)
 *        Dietary Reference Intakes for Water (2005).
 *      * Chidester & Spangler (1997) and Holliday & Segar maintenance fluid heuristics.
 *    - Evaluated over the supported adult anthropometric domain: 30 kg <= weight <= 300 kg.
 *    - Rounded to nearest 50 mL for realistic, non-spurious precision.
 *
 * 2. Exercise Activity Adjustment (ACSM Guideline):
 *    - American College of Sports Medicine (ACSM) Position Stand on Exercise and
 *      Fluid Replacement (Med Sci Sports Exerc. 2007; 39(2):377-390):
 *      Recommends fluid replacement during moderate-to-vigorous exercise of
 *      approximately 400 to 800 mL per hour (with ~500 mL/hr conservative moderate baseline),
 *      adjusted for duration.
 *    - Evaluated over the supported domain: 0 <= activityMinutes <= 300 minutes (0 to 5 hours).
 *
 * 3. Climate Heat Adjustment (Canonical BodyMap Environmental Allowance):
 *    - Temperate: +0 mL
 *    - Warm: +250 mL
 *    - Hot: +500 mL
 *    - Reflects modest thermoregulatory perspiration allowances in elevated ambient heat.
 *
 * 4. Composite Target Range:
 *    - Min Target: Baseline Min + Activity Min + Climate Allowance
 *    - Max Target: Baseline Max + Activity Max + Climate Allowance
 *    - Recommended Target: Baseline Midpoint + Activity Midpoint + Climate Allowance
 *    - All components rounded to the nearest 50 mL.
 *
 * SAFETY BOUNDARY & NON-DIAGNOSTIC DISCLAIMER:
 * --------------------------------------------
 * Informational wellness guideline only. Does not diagnose dehydration, overhydration,
 * or electrolyte imbalances. Does not prescribe medical therapy. Individuals with renal
 * disease, congestive heart failure, or clinician-directed fluid restrictions must follow
 * their personal medical provider's directives.
 */

export type HydrationClimateContext = 'temperate' | 'warm' | 'hot'

export interface HydrationRange {
  min: number
  max: number
  midpoint: number
}

export interface HydrationLitersRange {
  min: string
  max: string
  recommended: string
}

export interface HydrationTargetResult {
  isValid: boolean
  weightKg: number | null
  activityMinutes: number
  climate: HydrationClimateContext
  baselineRangeMl: HydrationRange
  activityAdjustmentMl: HydrationRange
  climateAdjustmentMl: number
  totalTargetMl: {
    min: number
    max: number
    recommended: number
  }
  totalTargetLiters: HydrationLitersRange
  glassesEquivalent: {
    min: number
    max: number
    recommended: number
    glassSizeMl: number
  }
  methodology: {
    baselineFormula: string
    activityFormula: string
    climateFormula: string
    summary: string
    sources: string[]
  }
  disclaimer: string
  validationErrors: string[]
}

export interface HydrationInputValidation {
  isValid: boolean
  weightKg: number | null
  activityMinutes: number
  climate: HydrationClimateContext
  errors: string[]
}

export interface HydrationCalculationOptions {
  activityMinutes?: unknown
  climate?: unknown
}

const MIN_WEIGHT_KG = 30
const MAX_WEIGHT_KG = 300
const MAX_ACTIVITY_MINUTES = 300
const GLASS_SIZE_ML = 250

const VALID_CLIMATES: readonly HydrationClimateContext[] = ['temperate', 'warm', 'hot']

/**
 * Rounds a milliliter value to the nearest 50 mL to avoid spurious precision.
 */
export function roundToNearest50(ml: number): number {
  if (!Number.isFinite(ml)) return 0
  return Math.round(ml / 50) * 50
}

/**
 * Validates inputs for hydration calculation using fail-closed rules.
 * Rejects non-numbers, negative values, NaN, Infinity, and out-of-domain inputs.
 */
export function validateHydrationInputs(
  rawWeight: unknown,
  rawActivityMinutes?: unknown,
  rawClimate?: unknown
): HydrationInputValidation {
  const errors: string[] = []
  let parsedWeight: number | null = null
  let parsedActivityMinutes = 0
  let parsedClimate: HydrationClimateContext = 'temperate'

  // 1. Weight Validation
  if (rawWeight === null || rawWeight === undefined) {
    errors.push('Weight is required')
  } else if (typeof rawWeight === 'number') {
    if (!Number.isFinite(rawWeight) || Number.isNaN(rawWeight)) {
      errors.push('Weight must be a finite numerical value')
    } else if (rawWeight < MIN_WEIGHT_KG) {
      errors.push(`Weight must be at least ${MIN_WEIGHT_KG} kg`)
    } else if (rawWeight > MAX_WEIGHT_KG) {
      errors.push(`Weight cannot exceed ${MAX_WEIGHT_KG} kg`)
    } else {
      parsedWeight = rawWeight
    }
  } else if (typeof rawWeight === 'string') {
    const trimmed = rawWeight.trim()
    if (trimmed === '') {
      errors.push('Weight cannot be empty')
    } else if (!/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) {
      errors.push('Weight must be a valid positive numerical format')
    } else {
      const num = parseFloat(trimmed)
      if (!Number.isFinite(num) || Number.isNaN(num)) {
        errors.push('Weight must be a finite numerical value')
      } else if (num < MIN_WEIGHT_KG) {
        errors.push(`Weight must be at least ${MIN_WEIGHT_KG} kg`)
      } else if (num > MAX_WEIGHT_KG) {
        errors.push(`Weight cannot exceed ${MAX_WEIGHT_KG} kg`)
      } else {
        parsedWeight = num
      }
    }
  } else {
    errors.push('Weight must be a numerical value or numeric string')
  }

  // 2. Activity Duration Validation (Optional, default 0)
  if (rawActivityMinutes !== undefined && rawActivityMinutes !== null) {
    if (typeof rawActivityMinutes === 'number') {
      if (!Number.isFinite(rawActivityMinutes) || Number.isNaN(rawActivityMinutes)) {
        errors.push('Activity duration must be a finite number')
      } else if (!Number.isInteger(rawActivityMinutes)) {
        errors.push('Activity duration must be a whole number of minutes')
      } else if (rawActivityMinutes < 0) {
        errors.push('Activity duration cannot be negative')
      } else if (rawActivityMinutes > MAX_ACTIVITY_MINUTES) {
        errors.push(`Activity duration cannot exceed ${MAX_ACTIVITY_MINUTES} minutes (5 hours)`)
      } else {
        parsedActivityMinutes = rawActivityMinutes
      }
    } else if (typeof rawActivityMinutes === 'string') {
      const trimmed = rawActivityMinutes.trim()
      if (trimmed === '') {
        parsedActivityMinutes = 0
      } else if (!/^[0-9]+$/.test(trimmed)) {
        errors.push('Activity duration must be a non-negative whole integer in minutes')
      } else {
        const num = parseInt(trimmed, 10)
        if (!Number.isFinite(num) || Number.isNaN(num)) {
          errors.push('Activity duration must be a finite number')
        } else if (num < 0) {
          errors.push('Activity duration cannot be negative')
        } else if (num > MAX_ACTIVITY_MINUTES) {
          errors.push(`Activity duration cannot exceed ${MAX_ACTIVITY_MINUTES} minutes (5 hours)`)
        } else {
          parsedActivityMinutes = num
        }
      }
    } else {
      errors.push('Activity duration must be an integer number of minutes')
    }
  }

  // 3. Climate Context Validation (Optional, default 'temperate')
  if (rawClimate !== undefined && rawClimate !== null) {
    if (typeof rawClimate === 'string') {
      const trimmed = rawClimate.trim().toLowerCase()
      if (VALID_CLIMATES.includes(trimmed as HydrationClimateContext)) {
        parsedClimate = trimmed as HydrationClimateContext
      } else {
        errors.push('Climate must be one of: temperate, warm, hot')
      }
    } else {
      errors.push('Climate must be a valid text context')
    }
  }

  return {
    isValid: errors.length === 0,
    weightKg: parsedWeight,
    activityMinutes: parsedActivityMinutes,
    climate: parsedClimate,
    errors
  }
}

/**
 * Calculates baseline maintenance fluid intake range based on body weight (30–35 mL/kg).
 */
export function calculateBaselineFluidRange(weightKg: number): HydrationRange {
  const min = roundToNearest50(weightKg * 30)
  const max = roundToNearest50(weightKg * 35)
  const midpoint = roundToNearest50((min + max) / 2)
  return { min, max, midpoint }
}

/**
 * Calculates exercise fluid replacement allowance based on ACSM guidelines (400–800 mL/hr, ~500 mL/hr baseline).
 */
export function calculateActivityFluidAdjustment(activityMinutes: number): HydrationRange {
  if (activityMinutes <= 0) {
    return { min: 0, max: 0, midpoint: 0 }
  }
  const hours = activityMinutes / 60
  const min = roundToNearest50(hours * 400)
  const max = roundToNearest50(hours * 800)
  const midpoint = roundToNearest50(hours * 500)
  return { min, max, midpoint }
}

/**
 * Calculates climate heat perspiration allowance based on BodyMap environmental increments.
 */
export function calculateClimateFluidAdjustment(climate: HydrationClimateContext): number {
  switch (climate) {
    case 'warm':
      return 250
    case 'hot':
      return 500
    case 'temperate':
    default:
      return 0
  }
}

/**
 * Authoritative, pure function calculating the composite daily hydration target guideline.
 * Deterministic and fail-closed.
 */
export function calculateHydrationTarget(
  rawWeight: unknown,
  options?: HydrationCalculationOptions
): HydrationTargetResult {
  const validation = validateHydrationInputs(rawWeight, options?.activityMinutes, options?.climate)

  if (!validation.isValid || validation.weightKg === null) {
    return {
      isValid: false,
      weightKg: null,
      activityMinutes: 0,
      climate: 'temperate',
      baselineRangeMl: { min: 0, max: 0, midpoint: 0 },
      activityAdjustmentMl: { min: 0, max: 0, midpoint: 0 },
      climateAdjustmentMl: 0,
      totalTargetMl: { min: 0, max: 0, recommended: 0 },
      totalTargetLiters: { min: '0.00', max: '0.00', recommended: '0.00' },
      glassesEquivalent: { min: 0, max: 0, recommended: 0, glassSizeMl: GLASS_SIZE_ML },
      methodology: {
        baselineFormula: 'Baseline: 30–35 mL/kg body weight (clinical dietetic standard)',
        activityFormula: 'Activity: 400–800 mL/hour exercise allowance (ACSM guideline)',
        climateFormula: 'Climate: +0 mL (temperate) / +250 mL (warm) / +500 mL (hot)',
        summary: 'Invalid input parameters. No hydration guideline could be calculated.',
        sources: [
          'European Food Safety Authority (EFSA) Dietary Reference Values for Water (2010)',
          'National Academies of Sciences (NASEM / IOM) Dietary Reference Intakes (2005)',
          'American College of Sports Medicine (ACSM) Position Stand on Exercise and Fluid Replacement (2007)'
        ]
      },
      disclaimer: 'Informational wellness guideline only. Non-diagnostic heuristic starting point. Individuals with medical fluid restrictions should consult their healthcare provider.',
      validationErrors: validation.errors
    }
  }

  const weightKg = validation.weightKg
  const activityMinutes = validation.activityMinutes
  const climate = validation.climate

  const baseline = calculateBaselineFluidRange(weightKg)
  const activityAdj = calculateActivityFluidAdjustment(activityMinutes)
  const climateAdj = calculateClimateFluidAdjustment(climate)

  const minTotalMl = baseline.min + activityAdj.min + climateAdj
  const maxTotalMl = baseline.max + activityAdj.max + climateAdj
  const recommendedTotalMl = baseline.midpoint + activityAdj.midpoint + climateAdj

  const minLiters = (minTotalMl / 1000).toFixed(2)
  const maxLiters = (maxTotalMl / 1000).toFixed(2)
  const recommendedLiters = (recommendedTotalMl / 1000).toFixed(2)

  const minGlasses = Math.round(minTotalMl / GLASS_SIZE_ML)
  const maxGlasses = Math.round(maxTotalMl / GLASS_SIZE_ML)
  const recommendedGlasses = Math.round(recommendedTotalMl / GLASS_SIZE_ML)

  const activityText = activityMinutes > 0
    ? ` + Activity (${activityMinutes}m: +${activityAdj.min}–${activityAdj.max} mL)`
    : ''
  const climateText = climateAdj > 0
    ? ` + Climate (${climate}: +${climateAdj} mL)`
    : ''

  const summary = `Baseline (${weightKg} kg: ${baseline.min}–${baseline.max} mL)${activityText}${climateText} = ${minTotalMl.toLocaleString()}–${maxTotalMl.toLocaleString()} mL/day`

  return {
    isValid: true,
    weightKg,
    activityMinutes,
    climate,
    baselineRangeMl: baseline,
    activityAdjustmentMl: activityAdj,
    climateAdjustmentMl: climateAdj,
    totalTargetMl: {
      min: minTotalMl,
      max: maxTotalMl,
      recommended: recommendedTotalMl
    },
    totalTargetLiters: {
      min: minLiters,
      max: maxLiters,
      recommended: recommendedLiters
    },
    glassesEquivalent: {
      min: minGlasses,
      max: maxGlasses,
      recommended: recommendedGlasses,
      glassSizeMl: GLASS_SIZE_ML
    },
    methodology: {
      baselineFormula: 'Baseline: 30–35 mL/kg body weight (clinical dietetic standard)',
      activityFormula: 'Activity: 400–800 mL/hour exercise allowance (ACSM guideline)',
      climateFormula: 'Climate: +0 mL (temperate) / +250 mL (warm) / +500 mL (hot)',
      summary,
      sources: [
        'European Food Safety Authority (EFSA) Dietary Reference Values for Water (2010)',
        'National Academies of Sciences (NASEM / IOM) Dietary Reference Intakes (2005)',
        'American College of Sports Medicine (ACSM) Position Stand on Exercise and Fluid Replacement (2007)'
      ]
    },
    disclaimer: 'Informational wellness guideline only. Non-diagnostic heuristic starting point. Actual fluid requirements vary by individual sweat rate, ambient humidity, temperature, metabolic rate, clothing, and dietary intake. Drink to thirst and avoid over-drinking. Individuals with renal conditions, congestive heart failure, or physician-directed fluid restrictions must follow their personal healthcare provider\'s instructions.',
    validationErrors: []
  }
}
