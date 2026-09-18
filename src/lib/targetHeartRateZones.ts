/**
 * Target Heart Rate & Intensity Zones Engine (E23)
 *
 * Implements:
 * 1. Tanaka age-predicted maximal heart rate estimate: HRmax = 208 - (0.7 × age)
 * 2. Karvonen Heart Rate Reserve (HRR) intensity calculation:
 *    HRR = HRmax - HRrest
 *    Target Heart Rate (THR) = HRrest + (intensity_fraction × HRR)
 * 3. Fallback straight-percentage HRmax zones when resting heart rate is not provided
 * 4. Strict numerical input validation with fail-closed rejection for invalid health values
 * 5. Pure, deterministic, side-effect free, local-first calculation
 */

export interface HeartRateZone {
  zoneNumber: number
  zoneName: string
  intensityRange: string
  pctRange: { min: number; max: number }
  rawBpmRange: { min: number; max: number }
  bpmRange: { min: number; max: number }
  description: string
  zoneColor: string
}

export type HeartRateCalculationMethod = 'karvonen_reserve' | 'tanaka_percentage'

export interface HeartRateValidationResult {
  isValid: boolean
  errors: string[]
  sanitizedAge: number | null
  sanitizedRestingHr: number | null
  estimatedMaxHr: number | null
  heartRateReserve: number | null
}

export interface TargetHeartRateResult {
  isValid: boolean
  hasValidAge: boolean
  hasValidRestingHr: boolean
  calculationMethod: HeartRateCalculationMethod
  age: number
  restingHr: number | null
  estimatedMaxHr: number
  heartRateReserve: number | null
  zones: HeartRateZone[]
  formulaLabel: string
  formulaDetails: string
  disclaimer: string
  validationErrors?: string[]
}

/**
 * Standard adult physiological boundaries for safe calculation.
 */
export const MIN_AGE_YEARS = 10
export const MAX_AGE_YEARS = 100
export const MIN_RESTING_HR_BPM = 30
export const MAX_RESTING_HR_BPM = 120
export const MIN_HEART_RATE_RESERVE_BPM = 15

/**
 * Tanaka Age-Predicted Maximal Heart Rate
 * Reference: Tanaka, Monahan, Seals (2001). "Age-predicted maximal heart rate revisited."
 * Formula: HRmax = 208 - (0.7 × age)
 *
 * Explicitly labeled as an age-derived physiological estimate, NOT a directly measured laboratory fact.
 */
export function estimateTanakaMaxHeartRate(age: number): number {
  return Math.round(208 - 0.7 * age)
}

/**
 * Heart Rate Reserve (HRR) calculation:
 * HRR = HRmax - HRrest
 */
export function calculateHeartRateReserve(maxHr: number, restingHr: number): number {
  return maxHr - restingHr
}

/**
 * Karvonen Target Heart Rate for a given intensity fraction:
 * THR = HRrest + (intensity × HRR)
 */
export function calculateKarvonenTargetHeartRate(
  restingHr: number,
  hrr: number,
  intensityFraction: number
): number {
  return restingHr + intensityFraction * hrr
}

/**
 * Validates age and optional resting heart rate inputs against standard physiological limits.
 * Does NOT silently coerce malformed or out-of-bounds numbers into false precision.
 */
export function validateHeartRateInputs(
  rawAge: unknown,
  rawRestingHr?: unknown
): HeartRateValidationResult {
  const errors: string[] = []

  // Validate Age
  let sanitizedAge: number | null = null
  if (rawAge === null || rawAge === undefined || rawAge === '') {
    errors.push('Age is required')
  } else {
    let parsedAge: number
    if (typeof rawAge === 'number') {
      parsedAge = rawAge
    } else if (typeof rawAge === 'string') {
      const trimmed = rawAge.trim()
      // Reject non-numeric strings
      if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
        parsedAge = NaN
      } else {
        parsedAge = Number(trimmed)
      }
    } else {
      parsedAge = NaN
    }

    if (!Number.isFinite(parsedAge) || Number.isNaN(parsedAge)) {
      errors.push('Age must be a valid number')
    } else if (!Number.isInteger(parsedAge)) {
      errors.push('Age must be a whole number')
    } else if (parsedAge < MIN_AGE_YEARS || parsedAge > MAX_AGE_YEARS) {
      errors.push(`Age must be between ${MIN_AGE_YEARS} and ${MAX_AGE_YEARS} years`)
    } else {
      sanitizedAge = parsedAge
    }
  }

  // Validate Resting Heart Rate (if provided)
  let sanitizedRestingHr: number | null = null
  let rawNumericRestingHr: number | null = null

  if (rawRestingHr !== undefined && rawRestingHr !== null && rawRestingHr !== '') {
    let parsedRestingHr: number
    if (typeof rawRestingHr === 'number') {
      parsedRestingHr = rawRestingHr
    } else if (typeof rawRestingHr === 'string') {
      const trimmed = rawRestingHr.trim()
      if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
        parsedRestingHr = NaN
      } else {
        parsedRestingHr = Number(trimmed)
      }
    } else {
      parsedRestingHr = NaN
    }

    if (!Number.isFinite(parsedRestingHr) || Number.isNaN(parsedRestingHr)) {
      errors.push('Resting heart rate must be a valid number')
    } else if (!Number.isInteger(parsedRestingHr)) {
      errors.push('Resting heart rate must be a whole number')
    } else {
      rawNumericRestingHr = parsedRestingHr
      if (parsedRestingHr < MIN_RESTING_HR_BPM || parsedRestingHr > MAX_RESTING_HR_BPM) {
        errors.push(`Resting heart rate must be between ${MIN_RESTING_HR_BPM} and ${MAX_RESTING_HR_BPM} BPM`)
      } else {
        sanitizedRestingHr = parsedRestingHr
      }
    }
  }

  // Evaluate Physiological Invariants
  let estimatedMaxHr: number | null = null
  let heartRateReserve: number | null = null

  if (sanitizedAge !== null) {
    estimatedMaxHr = estimateTanakaMaxHeartRate(sanitizedAge)

    if (rawNumericRestingHr !== null) {
      heartRateReserve = calculateHeartRateReserve(estimatedMaxHr, rawNumericRestingHr)

      if (rawNumericRestingHr >= estimatedMaxHr) {
        errors.push('Resting heart rate must be lower than estimated maximum heart rate')
      } else if (heartRateReserve < MIN_HEART_RATE_RESERVE_BPM) {
        errors.push(`Heart rate reserve (${heartRateReserve} BPM) is too narrow for standard training zones`)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedAge,
    sanitizedRestingHr,
    estimatedMaxHr,
    heartRateReserve
  }
}

/**
 * Generates the 5 canonical Karvonen heart-rate intensity zones.
 *
 * Monotonicity and rounding guarantees:
 * - Uses Math.round on exact boundary cutoffs.
 * - Zone_i.max equals Zone_{i+1}.min, guaranteeing zero gap and zero overlap.
 * - Provides both raw unrounded and rounded integer values.
 */
export function generateKarvonenZones(
  restingHr: number,
  hrr: number,
  maxHr: number
): HeartRateZone[] {
  // Cutoffs at 50%, 60%, 70%, 80%, 90%, 100%
  const cut0 = calculateKarvonenTargetHeartRate(restingHr, hrr, 0.50)
  const cut1 = calculateKarvonenTargetHeartRate(restingHr, hrr, 0.60)
  const cut2 = calculateKarvonenTargetHeartRate(restingHr, hrr, 0.70)
  const cut3 = calculateKarvonenTargetHeartRate(restingHr, hrr, 0.80)
  const cut4 = calculateKarvonenTargetHeartRate(restingHr, hrr, 0.90)
  const cut5 = maxHr

  const bpm0 = Math.round(cut0)
  const bpm1 = Math.round(cut1)
  const bpm2 = Math.round(cut2)
  const bpm3 = Math.round(cut3)
  const bpm4 = Math.round(cut4)
  const bpm5 = maxHr

  return [
    {
      zoneNumber: 1,
      zoneName: 'Very Light (Active Recovery)',
      intensityRange: '50% – 60% HRR',
      pctRange: { min: 50, max: 60 },
      rawBpmRange: { min: cut0, max: cut1 },
      bpmRange: { min: bpm0, max: bpm1 },
      description: 'Active recovery, warm-up preparation, and gentle aerobic cooldown.',
      zoneColor: 'text-blue-400 border-blue-500/40 bg-blue-950/30'
    },
    {
      zoneNumber: 2,
      zoneName: 'Light (Aerobic Base)',
      intensityRange: '60% – 70% HRR',
      pctRange: { min: 60, max: 70 },
      rawBpmRange: { min: cut1, max: cut2 },
      bpmRange: { min: bpm1, max: bpm2 },
      description: 'Base aerobic endurance, cardiovascular foundation, and steady-state conditioning.',
      zoneColor: 'text-neon-green border-neon-green/40 bg-neon-green/10'
    },
    {
      zoneNumber: 3,
      zoneName: 'Moderate (Aerobic Endurance)',
      intensityRange: '70% – 80% HRR',
      pctRange: { min: 70, max: 80 },
      rawBpmRange: { min: cut2, max: cut3 },
      bpmRange: { min: bpm2, max: bpm3 },
      description: 'Sustained aerobic capacity, muscular endurance, and tempo cardiovascular work.',
      zoneColor: 'text-amber-400 border-amber-500/40 bg-amber-950/30'
    },
    {
      zoneNumber: 4,
      zoneName: 'Hard (Anaerobic Threshold)',
      intensityRange: '80% – 90% HRR',
      pctRange: { min: 80, max: 90 },
      rawBpmRange: { min: cut3, max: cut4 },
      bpmRange: { min: bpm3, max: bpm4 },
      description: 'High-intensity intervals, lactate threshold tolerance, and anaerobic power.',
      zoneColor: 'text-bright-coral border-bright-coral/40 bg-bright-coral/20'
    },
    {
      zoneNumber: 5,
      zoneName: 'Maximum (Peak Capacity)',
      intensityRange: '90% – 100% HRR',
      pctRange: { min: 90, max: 100 },
      rawBpmRange: { min: cut4, max: cut5 },
      bpmRange: { min: bpm4, max: bpm5 },
      description: 'Short maximal sprints, peak neuromuscular output, and maximum aerobic capacity.',
      zoneColor: 'text-electric-purple border-electric-purple/40 bg-electric-purple/20'
    }
  ]
}

/**
 * Generates straight percentage Tanaka zones (used when resting HR is unavailable).
 */
export function generateTanakaPercentageZones(maxHr: number): HeartRateZone[] {
  const cut0 = maxHr * 0.50
  const cut1 = maxHr * 0.60
  const cut2 = maxHr * 0.70
  const cut3 = maxHr * 0.80
  const cut4 = maxHr * 0.90
  const cut5 = maxHr

  const bpm0 = Math.round(cut0)
  const bpm1 = Math.round(cut1)
  const bpm2 = Math.round(cut2)
  const bpm3 = Math.round(cut3)
  const bpm4 = Math.round(cut4)
  const bpm5 = maxHr

  return [
    {
      zoneNumber: 1,
      zoneName: 'Recovery & Warmup',
      intensityRange: '50% – 60%',
      pctRange: { min: 50, max: 60 },
      rawBpmRange: { min: cut0, max: cut1 },
      bpmRange: { min: bpm0, max: bpm1 },
      description: 'Active recovery, warmup preparation, and easy cooldown.',
      zoneColor: 'text-blue-400 border-blue-500/40 bg-blue-950/30'
    },
    {
      zoneNumber: 2,
      zoneName: 'Aerobic Base (Zone 2)',
      intensityRange: '60% – 70%',
      pctRange: { min: 60, max: 70 },
      rawBpmRange: { min: cut1, max: cut2 },
      bpmRange: { min: bpm1, max: bpm2 },
      description: 'Mitochondrial efficiency, fat oxidation, and cardiovascular foundation.',
      zoneColor: 'text-neon-green border-neon-green/40 bg-neon-green/10'
    },
    {
      zoneNumber: 3,
      zoneName: 'Aerobic Tempo',
      intensityRange: '70% – 80%',
      pctRange: { min: 70, max: 80 },
      rawBpmRange: { min: cut2, max: cut3 },
      bpmRange: { min: bpm2, max: bpm3 },
      description: 'Steady-state cardiorespiratory stamina and muscular endurance.',
      zoneColor: 'text-amber-400 border-amber-500/40 bg-amber-950/30'
    },
    {
      zoneNumber: 4,
      zoneName: 'Lactate Threshold',
      intensityRange: '80% – 90%',
      pctRange: { min: 80, max: 90 },
      rawBpmRange: { min: cut3, max: cut4 },
      bpmRange: { min: bpm3, max: bpm4 },
      description: 'High-intensity intervals and sustained anaerobic threshold work.',
      zoneColor: 'text-bright-coral border-bright-coral/40 bg-bright-coral/20'
    },
    {
      zoneNumber: 5,
      zoneName: 'Maximum Peak / HIIT',
      intensityRange: '90% – 100%',
      pctRange: { min: 90, max: 100 },
      rawBpmRange: { min: cut4, max: cut5 },
      bpmRange: { min: bpm4, max: bpm5 },
      description: 'Short maximal sprints, peak neuromuscular output, and HIIT intervals.',
      zoneColor: 'text-electric-purple border-electric-purple/40 bg-electric-purple/20'
    }
  ]
}

/**
 * Authoritative Heart Rate Zone Calculator.
 *
 * Supports:
 * - Dual-input Karvonen calculation: age + restingHr -> Karvonen HRR zones.
 * - Single-input Tanaka calculation: age -> Tanaka straight-percentage zones.
 * - Explicit fail-closed handling for malformed / invalid health data.
 */
export function calculateTargetHeartRateZones(
  rawAge: unknown,
  rawRestingHr?: unknown
): TargetHeartRateResult {
  const validation = validateHeartRateInputs(rawAge, rawRestingHr)

  const defaultAge = 30
  const defaultMaxHr = estimateTanakaMaxHeartRate(defaultAge)
  const standardDisclaimer = 'Informational exercise physiology training guideline (Tanaka / Karvonen). Not medical advice, diagnosis, or individualized clinical clearance.'

  // Fail-closed handling when inputs are invalid
  if (!validation.isValid || validation.sanitizedAge === null) {
    return {
      isValid: false,
      hasValidAge: false,
      hasValidRestingHr: false,
      calculationMethod: 'tanaka_percentage',
      age: defaultAge,
      restingHr: null,
      estimatedMaxHr: defaultMaxHr,
      heartRateReserve: null,
      zones: generateTanakaPercentageZones(defaultMaxHr),
      disclaimer: standardDisclaimer,
      formulaLabel: `Tanaka: 208 - (0.7 × ${defaultAge}) = ${defaultMaxHr} Max BPM (Default fallback)`,
      formulaDetails: `Invalid input: ${validation.errors.join('; ')}`,
      validationErrors: validation.errors
    }
  }

  const age = validation.sanitizedAge
  const estimatedMaxHr = validation.estimatedMaxHr!

  // Karvonen Calculation Path (when valid resting HR is supplied)
  if (validation.sanitizedRestingHr !== null && validation.heartRateReserve !== null) {
    const restingHr = validation.sanitizedRestingHr
    const hrr = validation.heartRateReserve
    const zones = generateKarvonenZones(restingHr, hrr, estimatedMaxHr)

    return {
      isValid: true,
      hasValidAge: true,
      hasValidRestingHr: true,
      calculationMethod: 'karvonen_reserve',
      age,
      restingHr,
      estimatedMaxHr,
      heartRateReserve: hrr,
      zones,
      disclaimer: standardDisclaimer,
      formulaLabel: `Karvonen HRR: ${restingHr} BPM + % × (${estimatedMaxHr} - ${restingHr})`,
      formulaDetails: `Age: ${age} yrs • Tanaka Est. Max HR: ${estimatedMaxHr} BPM • Resting HR: ${restingHr} BPM • Heart Rate Reserve (HRR): ${hrr} BPM`
    }
  }

  // Tanaka Percentage Fallback Path (when resting HR is omitted)
  const zones = generateTanakaPercentageZones(estimatedMaxHr)
  return {
    isValid: true,
    hasValidAge: true,
    hasValidRestingHr: false,
    calculationMethod: 'tanaka_percentage',
    age,
    restingHr: null,
    estimatedMaxHr,
    heartRateReserve: null,
    zones,
    disclaimer: standardDisclaimer,
    formulaLabel: `Tanaka 208 - (0.7 × ${age}) = ${estimatedMaxHr} Max BPM`,
    formulaDetails: `Age: ${age} yrs • Tanaka Est. Max HR: ${estimatedMaxHr} BPM • Percentage of Max HR`
  }
}
