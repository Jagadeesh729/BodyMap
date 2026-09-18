import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { generateWarmupProtocol } from '@/lib/warmupProtocol'
import {
  calculateBarbellPlates,
  formatPlateChips,
  verifyPlateLoadingInvariant,
  DEFAULT_PLATE_DENOMINATIONS_KG,
  DEFAULT_BAR_WEIGHT_KG
} from '@/lib/plateLoadingCalculator'

describe('Enhancement E21: Warm-Up Plate Loading Breakdown', () => {
  it('E21-01: Canonical 100kg warm-up pyramid produces exact per-side plate breakdowns', () => {
    const protocol = generateWarmupProtocol(100)
    expect(protocol.hasProtocol).toBe(true)
    expect(protocol.sets).toHaveLength(4)

    // Set 1: 20kg empty bar mobility
    const set1 = protocol.sets[0]
    expect(set1.calculatedWeightKg).toBe(20)
    expect(set1.plates).toBeDefined()
    expect(set1.plates!.hasValidConfiguration).toBe(true)
    expect(set1.plates!.plateWeightPerSideKg).toBe(0)
    expect(set1.plates!.perSidePlates).toEqual([])
    expect(formatPlateChips(set1.plates!.perSidePlates)).toEqual([])
    expect(verifyPlateLoadingInvariant(set1.plates!)).toBe(true)

    // Set 2: 50kg (50% working load) -> 15kg per side (1 x 15kg)
    const set2 = protocol.sets[1]
    expect(set2.calculatedWeightKg).toBe(50)
    expect(set2.plates).toBeDefined()
    expect(set2.plates!.hasValidConfiguration).toBe(true)
    expect(set2.plates!.plateWeightPerSideKg).toBe(15)
    expect(set2.plates!.perSidePlates).toEqual([{ denominationKg: 15, count: 1 }])
    expect(formatPlateChips(set2.plates!.perSidePlates)).toEqual(['15kg'])
    expect(verifyPlateLoadingInvariant(set2.plates!)).toBe(true)

    // Set 3: 70kg (70% working load) -> 25kg per side (1 x 25kg)
    const set3 = protocol.sets[2]
    expect(set3.calculatedWeightKg).toBe(70)
    expect(set3.plates).toBeDefined()
    expect(set3.plates!.hasValidConfiguration).toBe(true)
    expect(set3.plates!.plateWeightPerSideKg).toBe(25)
    expect(set3.plates!.perSidePlates).toEqual([{ denominationKg: 25, count: 1 }])
    expect(formatPlateChips(set3.plates!.perSidePlates)).toEqual(['25kg'])
    expect(verifyPlateLoadingInvariant(set3.plates!)).toBe(true)

    // Set 4: 85kg (85% potentiation load) -> 32.5kg per side (25kg + 5kg + 2.5kg)
    const set4 = protocol.sets[3]
    expect(set4.calculatedWeightKg).toBe(85)
    expect(set4.plates).toBeDefined()
    expect(set4.plates!.hasValidConfiguration).toBe(true)
    expect(set4.plates!.plateWeightPerSideKg).toBe(32.5)
    expect(set4.plates!.perSidePlates).toEqual([
      { denominationKg: 25, count: 1 },
      { denominationKg: 5, count: 1 },
      { denominationKg: 2.5, count: 1 }
    ])
    expect(formatPlateChips(set4.plates!.perSidePlates)).toEqual(['25kg', '5kg', '2.5kg'])
    expect(verifyPlateLoadingInvariant(set4.plates!)).toBe(true)
  })

  it('E21-02: Heavy lift (150kg) calculates multiple high-denomination plates accurately', () => {
    const protocol = generateWarmupProtocol(150)
    expect(protocol.hasProtocol).toBe(true)

    // Set 4: 85% of 150kg = 127.5kg -> per side = (127.5 - 20) / 2 = 53.75kg
    // 53.75kg = 2×25kg (50kg) + 1×2.5kg (2.5kg) + 1×1.25kg (1.25kg)
    const set4 = protocol.sets[3]
    expect(set4.calculatedWeightKg).toBe(127.5)
    expect(set4.plates!.hasValidConfiguration).toBe(true)
    expect(set4.plates!.plateWeightPerSideKg).toBe(53.75)
    expect(set4.plates!.perSidePlates).toEqual([
      { denominationKg: 25, count: 2 },
      { denominationKg: 2.5, count: 1 },
      { denominationKg: 1.25, count: 1 }
    ])
    expect(formatPlateChips(set4.plates!.perSidePlates)).toEqual(['2×25kg', '2.5kg', '1.25kg'])
    expect(verifyPlateLoadingInvariant(set4.plates!)).toBe(true)
  })

  it('E21-03: Sub-barbell loads (<20kg) are handled safely without invalid plate math', () => {
    // 30kg working weight: Step 1 is 40% of 30 = 12kg (< 20kg bar)
    const protocol = generateWarmupProtocol(30)
    expect(protocol.hasProtocol).toBe(true)
    const set1 = protocol.sets[0]
    expect(set1.calculatedWeightKg).toBe(12)
    expect(set1.plates).toBeDefined()
    expect(set1.plates!.hasValidConfiguration).toBe(false)
    expect(set1.plates!.summaryLabel).toBe('Below bar weight')
    expect(set1.platesSummary).toBe('Light DBs / Bar')
  })

  it('E21-04: Unrepresentable fractional weights do not fabricate impossible plate setups', () => {
    // 21kg total weight with 20kg bar leaves 0.5kg per side, impossible with min plate 1.25kg
    const result = calculateBarbellPlates(21, 20)
    expect(result.hasValidConfiguration).toBe(false)
    expect(result.summaryLabel).toBe('Unrepresentable load')
    expect(result.perSidePlates).toEqual([])
    expect(verifyPlateLoadingInvariant(result)).toBe(true)
  })

  it('E21-05: Non-barbell equipment maintains truthful equipment-specific summaries', () => {
    // Dumbbells
    const dbProtocol = generateWarmupProtocol(50, 20, 'Dumbbell Bench Press')
    expect(dbProtocol.hasProtocol).toBe(true)
    expect(dbProtocol.sets[0].plates).toBeUndefined()
    expect(dbProtocol.sets[0].platesSummary).toBe('Light DBs / Mobility')
    expect(dbProtocol.sets[1].platesSummary).toBe('~25kg DBs')

    // Cable
    const cableProtocol = generateWarmupProtocol(40, 20, 'Cable Crossover')
    expect(cableProtocol.hasProtocol).toBe(true)
    expect(cableProtocol.sets[0].plates).toBeUndefined()
    expect(cableProtocol.sets[1].platesSummary).toBe('~20kg Cable Stack')

    // Machine
    const machineProtocol = generateWarmupProtocol(100, 20, 'Smith Machine Squat')
    expect(machineProtocol.hasProtocol).toBe(true)
    expect(machineProtocol.sets[0].plates).toBeUndefined()
    expect(machineProtocol.sets[1].platesSummary).toBe('~50kg Machine Load')

    // Bodyweight
    const bwProtocol = generateWarmupProtocol(80, 20, 'Weighted Pull-up')
    expect(bwProtocol.hasProtocol).toBe(true)
    expect(bwProtocol.sets[0].plates).toBeUndefined()
    expect(bwProtocol.sets[0].platesSummary).toBe('Bodyweight / Mobility')
  })

  it('E21-06: Supports custom plate inventories and non-standard barbell weights', () => {
    // 15kg Technique bar, 45kg load, available plates [10, 5, 2.5]
    const customProtocol = generateWarmupProtocol(45, 15, 'Overhead Press', [10, 5, 2.5])
    expect(customProtocol.hasProtocol).toBe(true)
    // Set 2 is 50% of 45 = 22.5kg
    const set2 = customProtocol.sets[1]
    expect(set2.calculatedWeightKg).toBe(22.5)
    expect(set2.plates!.barWeightKg).toBe(15)
    // (22.5 - 15) / 2 = 3.75kg -> unrepresentable with min plate 2.5kg
    expect(set2.plates!.hasValidConfiguration).toBe(false)
  })

  it('E21-07: formatPlateChips formats single and multiple plates correctly', () => {
    expect(formatPlateChips([])).toEqual([])
    expect(formatPlateChips([{ denominationKg: 20, count: 1 }])).toEqual(['20kg'])
    expect(formatPlateChips([
      { denominationKg: 25, count: 2 },
      { denominationKg: 10, count: 1 },
      { denominationKg: 1.25, count: 1 }
    ])).toEqual(['2×25kg', '10kg', '1.25kg'])
    // @ts-expect-error test non-array safety
    expect(formatPlateChips(null)).toEqual([])
  })

  it('E21-08: Mathematical invariant: barWeight + 2 * sum(plates) strictly equals targetWeight', () => {
    // Sweep loads from 20kg to 160kg in 2.5kg increments
    for (let weight = 20; weight <= 160; weight += 2.5) {
      const res = calculateBarbellPlates(weight, DEFAULT_BAR_WEIGHT_KG, DEFAULT_PLATE_DENOMINATIONS_KG)
      expect(verifyPlateLoadingInvariant(res)).toBe(true)
      if (res.hasValidConfiguration) {
        const perSideSum = res.perSidePlates.reduce((acc, p) => acc + p.count * p.denominationKg, 0)
        expect(res.barWeightKg + perSideSum * 2).toBeCloseTo(weight, 5)
      }
    }
  })

  it('E21-09: Renders warm-up plate chips and bar-only badges with accessible markup', () => {
    const protocol = generateWarmupProtocol(100)
    expect(protocol.hasProtocol).toBe(true)

    // Render a lightweight harness matching GymModePage's warm-up pyramid card rendering
    const WarmupHarness = () => (
      <div data-testid="warmup-container">
        {protocol.sets.map((wSet) => (
          <div key={wSet.setNumber} data-testid={`warmup-set-${wSet.setNumber}`}>
            <span>Set {wSet.setNumber} &bull; {wSet.repsLabel}</span>
            <span>{wSet.calculatedWeightKg} kg</span>
            {wSet.plates && wSet.plates.hasValidConfiguration && wSet.plates.perSidePlates.length > 0 ? (
              <div
                title={wSet.plates.explanation}
                aria-label={`Set ${wSet.setNumber} plate loading: ${wSet.plates.summaryLabel}`}
              >
                <span>Per side: {wSet.plates.plateWeightPerSideKg}kg</span>
                {formatPlateChips(wSet.plates.perSidePlates).map((chip, idx) => (
                  <span key={idx} data-testid={`plate-chip-${wSet.setNumber}-${chip}`}>
                    {chip}
                  </span>
                ))}
              </div>
            ) : wSet.plates && wSet.plates.hasValidConfiguration && wSet.plates.perSidePlates.length === 0 ? (
              <div
                title={wSet.plates.explanation}
                aria-label={`Set ${wSet.setNumber} plate loading: Empty bar only`}
              >
                <span>🏋️ Bar only (0kg/side)</span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    )

    render(<WarmupHarness />)

    // Check Set 1 (bar only)
    expect(screen.getByText(/Bar only \(0kg\/side\)/i)).toBeDefined()
    expect(screen.getByLabelText(/Set 1 plate loading: Empty bar only/i)).toBeDefined()

    // Check Set 2 (15kg chip)
    expect(screen.getByText('Per side: 15kg')).toBeDefined()
    expect(screen.getByTestId('plate-chip-2-15kg')).toBeDefined()

    // Check Set 3 (25kg chip)
    expect(screen.getByText('Per side: 25kg')).toBeDefined()
    expect(screen.getByTestId('plate-chip-3-25kg')).toBeDefined()

    // Check Set 4 (25kg, 5kg, 2.5kg chips)
    expect(screen.getByText('Per side: 32.5kg')).toBeDefined()
    expect(screen.getByTestId('plate-chip-4-25kg')).toBeDefined()
    expect(screen.getByTestId('plate-chip-4-5kg')).toBeDefined()
    expect(screen.getByTestId('plate-chip-4-2.5kg')).toBeDefined()
  })
})
