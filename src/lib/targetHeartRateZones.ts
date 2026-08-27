export interface HeartRateZone {
  zoneNumber: number
  zoneName: string
  intensityRange: string
  bpmRange: { min: number; max: number }
  description: string
  zoneColor: string
}

export interface TargetHeartRateResult {
  hasValidAge: boolean
  estimatedMaxHr: number
  age: number
  zones: HeartRateZone[]
  disclaimer: string
  formulaLabel: string
}

/**
 * Deterministically calculates Tanaka age-predicted maximal heart rate and training intensity zones.
 * Labeled explicitly as a non-diagnostic exercise physiology training guideline.
 */
export function calculateTargetHeartRateZones(rawAge: number | string | null | undefined): TargetHeartRateResult {
  const age = typeof rawAge === 'string' ? parseInt(rawAge, 10) : typeof rawAge === 'number' ? Math.round(rawAge) : 30

  if (isNaN(age) || age < 10 || age > 100) {
    return {
      hasValidAge: false,
      estimatedMaxHr: 187,
      age: 30,
      zones: generateZones(187),
      disclaimer: 'Tanaka age-predicted estimate (208 - 0.7 × age). Non-medical guideline.',
      formulaLabel: 'Tanaka 208 - 0.7 × 30 = ~187 BPM (Default)'
    }
  }

  const estimatedMaxHr = Math.round(208 - 0.7 * age)

  return {
    hasValidAge: true,
    estimatedMaxHr,
    age,
    zones: generateZones(estimatedMaxHr),
    disclaimer: 'Tanaka age-predicted estimate (208 - 0.7 × age). Non-medical training guideline.',
    formulaLabel: `Tanaka 208 - (0.7 × ${age}) = ${estimatedMaxHr} Max BPM`
  }
}

function generateZones(maxHr: number): HeartRateZone[] {
  return [
    {
      zoneNumber: 1,
      zoneName: 'Recovery & Warmup',
      intensityRange: '50% – 60%',
      bpmRange: { min: Math.round(maxHr * 0.5), max: Math.round(maxHr * 0.6) },
      description: 'Active recovery, warmup preparation, and easy cooldown.',
      zoneColor: 'text-blue-400 border-blue-500/40 bg-blue-950/30'
    },
    {
      zoneNumber: 2,
      zoneName: 'Aerobic Base (Zone 2)',
      intensityRange: '60% – 70%',
      bpmRange: { min: Math.round(maxHr * 0.6), max: Math.round(maxHr * 0.7) },
      description: 'Mitochondrial efficiency, fat oxidation, and cardiovascular foundation.',
      zoneColor: 'text-neon-green border-neon-green/40 bg-neon-green/10'
    },
    {
      zoneNumber: 3,
      zoneName: 'Aerobic Tempo',
      intensityRange: '70% – 80%',
      bpmRange: { min: Math.round(maxHr * 0.7), max: Math.round(maxHr * 0.8) },
      description: 'Steady-state cardiorespiratory stamina and muscular endurance.',
      zoneColor: 'text-amber-400 border-amber-500/40 bg-amber-950/30'
    },
    {
      zoneNumber: 4,
      zoneName: 'Lactate Threshold',
      intensityRange: '80% – 90%',
      bpmRange: { min: Math.round(maxHr * 0.8), max: Math.round(maxHr * 0.9) },
      description: 'High-intensity intervals and sustained anaerobic threshold work.',
      zoneColor: 'text-bright-coral border-bright-coral/40 bg-bright-coral/20'
    },
    {
      zoneNumber: 5,
      zoneName: 'Maximum Peak / HIIT',
      intensityRange: '90% – 100%',
      bpmRange: { min: Math.round(maxHr * 0.9), max: maxHr },
      description: 'Short maximal sprints, peak neuromuscular output, and HIIT intervals.',
      zoneColor: 'text-electric-purple border-electric-purple/40 bg-electric-purple/20'
    }
  ]
}
