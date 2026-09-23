import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  calculateHydrationTarget,
  calculateBaselineFluidRange,
  calculateActivityFluidAdjustment,
  calculateClimateFluidAdjustment,
  roundToNearest50
} from '@/lib/hydrationTarget'
import DashboardPage from '@/pages/DashboardPage'
import { PlanProvider } from '@/context/PlanContext'

vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 500, height: 300 }}>{children}</div>
    ),
  }
})

describe('Enhancement E24: Hydration Target Calculator', () => {
  describe('E24-01: Baseline Maintenance Fluid Calculation (30–35 mL/kg)', () => {
    it('calculates exact baseline range for 70 kg adult', () => {
      const baseline = calculateBaselineFluidRange(70)
      // 70 * 30 = 2100 mL
      expect(baseline.min).toBe(2100)
      // 70 * 35 = 2450 mL
      expect(baseline.max).toBe(2450)
      // (2100 + 2450) / 2 = 2275 -> roundToNearest50 -> 2300 mL
      expect(baseline.midpoint).toBe(2300)
    })

    it('calculates exact baseline range for 60 kg adult', () => {
      const baseline = calculateBaselineFluidRange(60)
      // 60 * 30 = 1800 mL
      expect(baseline.min).toBe(1800)
      // 60 * 35 = 2100 mL
      expect(baseline.max).toBe(2100)
      expect(baseline.midpoint).toBe(1950)
    })

    it('calculates exact baseline range for 85 kg adult', () => {
      const baseline = calculateBaselineFluidRange(85)
      // 85 * 30 = 2550 mL
      expect(baseline.min).toBe(2550)
      // 85 * 35 = 2975 -> roundToNearest50 -> 3000 mL
      expect(baseline.max).toBe(3000)
      // (2550 + 3000) / 2 = 2775 -> roundToNearest50 -> 2800 mL
      expect(baseline.midpoint).toBe(2800)
    })

    it('enforces strict monotonicity: higher weight produces greater or equal baseline fluid targets', () => {
      let previousMax = 0
      for (let weight = 30; weight <= 200; weight += 5) {
        const current = calculateBaselineFluidRange(weight)
        expect(current.max).toBeGreaterThanOrEqual(previousMax)
        expect(current.min).toBeLessThanOrEqual(current.midpoint)
        expect(current.midpoint).toBeLessThanOrEqual(current.max)
        previousMax = current.max
      }
    })
  })

  describe('E24-02: Exercise Activity Fluid Adjustment (ACSM 400–800 mL/hr)', () => {
    it('returns 0 mL adjustment when activity minutes is 0', () => {
      const adj = calculateActivityFluidAdjustment(0)
      expect(adj.min).toBe(0)
      expect(adj.max).toBe(0)
      expect(adj.midpoint).toBe(0)
    })

    it('calculates correct adjustment for 60 minutes (1 hour) of exercise', () => {
      const adj = calculateActivityFluidAdjustment(60)
      // 1 hr * 400 mL/hr = 400 mL
      expect(adj.min).toBe(400)
      // 1 hr * 800 mL/hr = 800 mL
      expect(adj.max).toBe(800)
      // 1 hr * 500 mL/hr = 500 mL
      expect(adj.midpoint).toBe(500)
    })

    it('calculates correct adjustment for 30 minutes (0.5 hour) of exercise', () => {
      const adj = calculateActivityFluidAdjustment(30)
      // 0.5 * 400 = 200 mL
      expect(adj.min).toBe(200)
      // 0.5 * 800 = 400 mL
      expect(adj.max).toBe(400)
      // 0.5 * 500 = 250 mL
      expect(adj.midpoint).toBe(250)
    })

    it('calculates correct adjustment for 45 minutes (0.75 hour) of exercise', () => {
      const adj = calculateActivityFluidAdjustment(45)
      // 0.75 * 400 = 300 mL
      expect(adj.min).toBe(300)
      // 0.75 * 800 = 600 mL
      expect(adj.max).toBe(600)
      // 0.75 * 500 = 375 -> roundToNearest50 -> 400 mL
      expect(adj.midpoint).toBe(400)
    })
  })

  describe('E24-03: Climate Heat Fluid Adjustment', () => {
    it('applies correct environmental increments', () => {
      expect(calculateClimateFluidAdjustment('temperate')).toBe(0)
      expect(calculateClimateFluidAdjustment('warm')).toBe(250)
      expect(calculateClimateFluidAdjustment('hot')).toBe(500)
    })
  })

  describe('E24-04: Composite Hydration Calculation & Conversions', () => {
    it('calculates total target for 70 kg, 45 min exercise, warm climate', () => {
      const res = calculateHydrationTarget(70, { activityMinutes: 45, climate: 'warm' })
      expect(res.isValid).toBe(true)
      expect(res.weightKg).toBe(70)
      expect(res.activityMinutes).toBe(45)
      expect(res.climate).toBe('warm')

      // Baseline: 2100 min, 2450 max, 2300 mid
      // Activity (45m): 300 min, 600 max, 400 mid
      // Climate (warm): 250
      // Min Total: 2100 + 300 + 250 = 2650 mL
      // Max Total: 2450 + 600 + 250 = 3300 mL
      // Recommended: 2300 + 400 + 250 = 2950 mL
      expect(res.totalTargetMl.min).toBe(2650)
      expect(res.totalTargetMl.max).toBe(3300)
      expect(res.totalTargetMl.recommended).toBe(2950)

      // Liters check
      expect(res.totalTargetLiters.min).toBe('2.65')
      expect(res.totalTargetLiters.max).toBe('3.30')
      expect(res.totalTargetLiters.recommended).toBe('2.95')

      // Glasses (250 mL):
      // 2650 / 250 = 10.6 -> 11
      // 3300 / 250 = 13.2 -> 13
      // 2950 / 250 = 11.8 -> 12
      expect(res.glassesEquivalent.min).toBe(11)
      expect(res.glassesEquivalent.max).toBe(13)
      expect(res.glassesEquivalent.recommended).toBe(12)
      expect(res.glassesEquivalent.glassSizeMl).toBe(250)
    })

    it('ensures unit conversions between mL and Liters are mathematically consistent', () => {
      const res = calculateHydrationTarget(80, { activityMinutes: 60, climate: 'hot' })
      expect(parseFloat(res.totalTargetLiters.min)).toBeCloseTo(res.totalTargetMl.min / 1000, 2)
      expect(parseFloat(res.totalTargetLiters.max)).toBeCloseTo(res.totalTargetMl.max / 1000, 2)
      expect(parseFloat(res.totalTargetLiters.recommended)).toBeCloseTo(res.totalTargetMl.recommended / 1000, 2)
    })

    it('ensures rounding to nearest 50 mL is applied deterministically', () => {
      expect(roundToNearest50(2224)).toBe(2200)
      expect(roundToNearest50(2225)).toBe(2250)
      expect(roundToNearest50(2249)).toBe(2250)
      expect(roundToNearest50(2250)).toBe(2250)
      expect(roundToNearest50(2274)).toBe(2250)
      expect(roundToNearest50(2275)).toBe(2300)
    })
  })

  describe('E24-05: Input Validation & Fail-Closed Guarding', () => {
    it('accepts valid string numbers like "75" and "82.5"', () => {
      const res1 = calculateHydrationTarget('75')
      expect(res1.isValid).toBe(true)
      expect(res1.weightKg).toBe(75)

      const res2 = calculateHydrationTarget('82.5')
      expect(res2.isValid).toBe(true)
      expect(res2.weightKg).toBe(82.5)
    })

    it('rejects null, undefined, empty string, and whitespace', () => {
      expect(calculateHydrationTarget(null).isValid).toBe(false)
      expect(calculateHydrationTarget(undefined).isValid).toBe(false)
      expect(calculateHydrationTarget('').isValid).toBe(false)
      expect(calculateHydrationTarget('   ').isValid).toBe(false)
    })

    it('rejects non-numeric characters and malformed strings without silent coercion', () => {
      expect(calculateHydrationTarget('70kg').isValid).toBe(false)
      expect(calculateHydrationTarget('abc').isValid).toBe(false)
      expect(calculateHydrationTarget('70.5.2').isValid).toBe(false)
      expect(calculateHydrationTarget('--50').isValid).toBe(false)
    })

    it('rejects zero and negative weight', () => {
      expect(calculateHydrationTarget(0).isValid).toBe(false)
      expect(calculateHydrationTarget(-70).isValid).toBe(false)
    })

    it('rejects NaN and Infinity', () => {
      expect(calculateHydrationTarget(NaN).isValid).toBe(false)
      expect(calculateHydrationTarget(Infinity).isValid).toBe(false)
      expect(calculateHydrationTarget(-Infinity).isValid).toBe(false)
    })

    it('enforces weight domain boundaries (30 kg <= weight <= 300 kg)', () => {
      // Lower boundary
      expect(calculateHydrationTarget(29.9).isValid).toBe(false)
      expect(calculateHydrationTarget(30).isValid).toBe(true)

      // Upper boundary
      expect(calculateHydrationTarget(300).isValid).toBe(true)
      expect(calculateHydrationTarget(300.1).isValid).toBe(false)
      expect(calculateHydrationTarget(500).isValid).toBe(false)
    })

    it('rejects invalid activity durations', () => {
      expect(calculateHydrationTarget(70, { activityMinutes: -15 }).isValid).toBe(false)
      expect(calculateHydrationTarget(70, { activityMinutes: 301 }).isValid).toBe(false)
      expect(calculateHydrationTarget(70, { activityMinutes: 45.5 }).isValid).toBe(false)
      expect(calculateHydrationTarget(70, { activityMinutes: 'fast' }).isValid).toBe(false)
    })

    it('rejects invalid climate contexts', () => {
      expect(calculateHydrationTarget(70, { climate: 'arctic' }).isValid).toBe(false)
      expect(calculateHydrationTarget(70, { climate: 'tropical' }).isValid).toBe(false)
      expect(calculateHydrationTarget(70, { climate: 123 }).isValid).toBe(false)
    })

    it('returns zero / safe defaults and non-empty error list when validation fails', () => {
      const res = calculateHydrationTarget('invalid-weight')
      expect(res.isValid).toBe(false)
      expect(res.weightKg).toBeNull()
      expect(res.totalTargetMl.recommended).toBe(0)
      expect(res.totalTargetLiters.recommended).toBe('0.00')
      expect(res.validationErrors.length).toBeGreaterThan(0)
    })
  })

  describe('E24-06: Determinism & Immutability Invariants', () => {
    it('produces identical outputs for identical inputs across repeated invocations', () => {
      const run1 = calculateHydrationTarget(75, { activityMinutes: 60, climate: 'warm' })
      const run2 = calculateHydrationTarget(75, { activityMinutes: 60, climate: 'warm' })
      expect(run1).toEqual(run2)
    })

    it('does not mutate input options or source parameters', () => {
      const options = { activityMinutes: 45, climate: 'hot' as const }
      const frozenOptions = Object.freeze({ ...options })
      expect(() => calculateHydrationTarget(70, frozenOptions)).not.toThrow()
    })

    it('guarantees min <= recommended <= max invariant for all supported combinations', () => {
      const weights = [30, 50, 70, 90, 120, 200, 300]
      const activities = [0, 15, 30, 45, 60, 90, 120, 180, 300]
      const climates = ['temperate', 'warm', 'hot'] as const

      for (const w of weights) {
        for (const a of activities) {
          for (const c of climates) {
            const res = calculateHydrationTarget(w, { activityMinutes: a, climate: c })
            expect(res.isValid).toBe(true)
            expect(res.totalTargetMl.min).toBeLessThanOrEqual(res.totalTargetMl.recommended)
            expect(res.totalTargetMl.recommended).toBeLessThanOrEqual(res.totalTargetMl.max)
            expect(res.totalTargetMl.min).toBeGreaterThan(0)
          }
        }
      }
    })
  })

  describe('E24-07: Clinical Safety & Disclaimer Boundaries', () => {
    it('contains clear non-diagnostic informational disclaimers without prohibited phrases', () => {
      const res = calculateHydrationTarget(70)
      const prohibitedPhrases = [
        '100% safe',
        'guaranteed safe',
        'medically proven',
        'clinically proven',
        'replace your doctor',
        'replace your physician',
        'replace your therapist',
        'no risk',
        'prevents dehydration',
        'optimal hydration'
      ]

      for (const phrase of prohibitedPhrases) {
        expect(res.disclaimer.toLowerCase()).not.toContain(phrase.toLowerCase())
        expect(res.methodology.summary.toLowerCase()).not.toContain(phrase.toLowerCase())
      }

      expect(res.disclaimer).toContain('Informational wellness guideline only')
      expect(res.disclaimer).toContain('Drink to thirst')
    })

    it('cites authoritative scientific sources in methodology metadata', () => {
      const res = calculateHydrationTarget(70)
      expect(res.methodology.sources).toContain(
        'European Food Safety Authority (EFSA) Dietary Reference Values for Water (2010)'
      )
      expect(res.methodology.sources).toContain(
        'American College of Sports Medicine (ACSM) Position Stand on Exercise and Fluid Replacement (2007)'
      )
    })
  })

  describe('E24-08: Dashboard UI Rendering & Interactive Controls', () => {
    const renderDashboard = () => {
      return render(
        <MemoryRouter>
          <PlanProvider>
            <DashboardPage />
          </PlanProvider>
        </MemoryRouter>
      )
    }

    it('renders the Hydration Target Calculator heading and default recommendation', () => {
      renderDashboard()
      expect(screen.getByText('Hydration Target Calculator')).toBeDefined()
      expect(screen.getByText('Recommended Baseline Target')).toBeDefined()
      expect(screen.getByText('Estimated Daily Range')).toBeDefined()
      expect(screen.getByText('Glass Equivalents (~250 mL)')).toBeDefined()
    })

    it('provides accessible weight, exercise duration, and climate controls', () => {
      renderDashboard()
      const weightInput = screen.getByLabelText('Target Weight Kg')
      expect(weightInput).toBeDefined()

      const stepDownBtn = screen.getByLabelText('Step down 15 duration')
      const stepUpBtn = screen.getByLabelText('Step up 15 duration')
      expect(stepDownBtn).toBeDefined()
      expect(stepUpBtn).toBeDefined()

      expect(screen.getByLabelText('temperate climate')).toBeDefined()
      expect(screen.getByLabelText('warm climate')).toBeDefined()
      expect(screen.getByLabelText('hot climate')).toBeDefined()
    })

    it('allows adjusting exercise duration via steppers and updates displayed fluid targets', () => {
      renderDashboard()
      const stepUpBtn = screen.getByLabelText('Step up 15 duration')

      // Initial state is 45m. Clicking +15 brings it to 60m.
      fireEvent.click(stepUpBtn)
      expect(screen.getByText('60m')).toBeDefined()
    })

    it('allows switching climate context and updates active styling', () => {
      renderDashboard()
      const warmBtn = screen.getByLabelText('warm climate')
      fireEvent.click(warmBtn)
      // Active climate gets highlight class
      expect(warmBtn.className).toContain('text-blue-400')
    })

    it('renders fail-closed error alert when user enters an invalid body weight', () => {
      renderDashboard()
      const weightInput = screen.getByLabelText('Target Weight Kg')
      fireEvent.change(weightInput, { target: { value: '15' } })

      expect(screen.getByText('Calculation Input Alert')).toBeDefined()
      expect(screen.getByText(/Weight must be at least 30 kg/)).toBeDefined()
    })
  })
})
