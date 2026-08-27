export interface PlateCount {
  denominationKg: number
  count: number
}

export interface PlateLoadingResult {
  hasValidConfiguration: boolean
  targetWeightKg: number
  barWeightKg: number
  plateWeightPerSideKg: number
  perSidePlates: PlateCount[]
  summaryLabel: string
  explanation: string
}

export const DEFAULT_PLATE_DENOMINATIONS_KG = [25, 20, 15, 10, 5, 2.5, 1.25]
export const DEFAULT_BAR_WEIGHT_KG = 20

/**
 * Deterministically calculates symmetric barbell plate loading configuration.
 * Labeled strictly as reference plate configuration using standard Olympic inventory.
 */
export function calculateBarbellPlates(
  targetWeightKg: number | null | undefined,
  barWeightKg: number = DEFAULT_BAR_WEIGHT_KG,
  availableDenominationsKg: number[] = DEFAULT_PLATE_DENOMINATIONS_KG
): PlateLoadingResult {
  const target = typeof targetWeightKg === 'number' && !isNaN(targetWeightKg) ? targetWeightKg : 0
  const bar = typeof barWeightKg === 'number' && !isNaN(barWeightKg) && barWeightKg > 0 ? barWeightKg : DEFAULT_BAR_WEIGHT_KG

  if (target <= 0) {
    return {
      hasValidConfiguration: false,
      targetWeightKg: target,
      barWeightKg: bar,
      plateWeightPerSideKg: 0,
      perSidePlates: [],
      summaryLabel: 'No load',
      explanation: 'Target weight must be greater than zero.'
    }
  }

  if (target < bar) {
    return {
      hasValidConfiguration: false,
      targetWeightKg: target,
      barWeightKg: bar,
      plateWeightPerSideKg: 0,
      perSidePlates: [],
      summaryLabel: 'Below bar weight',
      explanation: `Target weight (${target} kg) is less than the empty barbell weight (${bar} kg).`
    }
  }

  if (target === bar) {
    return {
      hasValidConfiguration: true,
      targetWeightKg: target,
      barWeightKg: bar,
      plateWeightPerSideKg: 0,
      perSidePlates: [],
      summaryLabel: 'Bar only (0 kg / side)',
      explanation: `Empty ${bar} kg Olympic bar only. No plates required.`
    }
  }

  const plateWeightPerSide = (target - bar) / 2
  // Convert to integer cents (1.25 kg -> 125) to prevent floating point inaccuracy
  let remainingCents = Math.round(plateWeightPerSide * 100)

  const sortedDenoms = [...availableDenominationsKg]
    .filter(d => d > 0)
    .sort((a, b) => b - a)

  const perSidePlates: PlateCount[] = []

  for (const denom of sortedDenoms) {
    const denomCents = Math.round(denom * 100)
    if (denomCents <= 0) continue

    const count = Math.floor(remainingCents / denomCents)
    if (count > 0) {
      perSidePlates.push({
        denominationKg: denom,
        count
      })
      remainingCents -= count * denomCents
    }
  }

  if (remainingCents > 0) {
    return {
      hasValidConfiguration: false,
      targetWeightKg: target,
      barWeightKg: bar,
      plateWeightPerSideKg: plateWeightPerSide,
      perSidePlates: [],
      summaryLabel: 'Unrepresentable load',
      explanation: `Target weight (${target} kg) cannot be loaded symmetrically with available plate denominations (smallest plate: ${sortedDenoms[sortedDenoms.length - 1]} kg).`
    }
  }

  const plateDescriptions = perSidePlates
    .map(p => `${p.count > 1 ? `${p.count}×` : ''}${p.denominationKg}kg`)
    .join(' + ')

  return {
    hasValidConfiguration: true,
    targetWeightKg: target,
    barWeightKg: bar,
    plateWeightPerSideKg: plateWeightPerSide,
    perSidePlates,
    summaryLabel: `Per side: ${plateDescriptions}`,
    explanation: `Load ${plateDescriptions} on each side of the ${bar} kg bar (${plateWeightPerSide} kg per side).`
  }
}
