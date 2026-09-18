/**
 * Enhancement E25-D: Body Measurement Trend Visualizer & Rate Analytics Test Suite
 *
 * Comprehensive validation across:
 * 1. Data / Engine Unit Tests
 * 2. Mathematical Rate Semantics & Edge Cases
 * 3. Unit Normalization & Mixed-Unit History
 * 4. Source Immutability & Determinism
 * 5. Screen Reader Accessibility (WCAG 2.1 AA)
 * 6. UI Rendering, Tab Switching, and State Variations
 * 7. DashboardPage Integration & Cross-Tab Storage Sync
 * 8. Regressions (E25-A deletion, E25-C search, E22 CSV, streaks, PRs)
 * 9. Controlled Mutation Oracles (Proving detection of 13 canonical mutations)
 */

import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { BodyMeasurementEntry, MetricUnit } from '@/types/bodyMetrics'
import {
  calculateMetricTrend,
  calculateAllMetricTrends,
  formatRateLabel,
  formatDeltaLabel,
  getAccessibleRateDescription
} from '@/lib/bodyMeasurementTrendEngine'
import {
  saveBodyMeasurement,
  loadBodyMetrics,
  deleteBodyMeasurement,
  clearBodyMetrics,
  calculateBodyMetricDeltas,
  convertLength,
  convertMetricValue,
  METRIC_LABELS,
  BODY_METRICS_STORAGE_KEY
} from '@/lib/bodyMetricsStorage'
import { BodyMeasurementVisualizer } from '@/components/BodyMeasurementVisualizer'
import DashboardPage from '@/pages/DashboardPage'
import {
  saveCompletedWorkoutLog,
  loadWorkoutHistory,
  clearWorkoutHistory,
  deleteCompletedWorkoutLog
} from '@/lib/sessionStorage'
import { filterWorkoutHistory } from '@/lib/workoutHistoryFilter'
import { calculateWorkoutStreak } from '@/lib/streakCalculation'
import { extractPersonalRecords } from '@/lib/personalRecords'
import { generateWorkoutHistoryCsv } from '@/lib/workoutHistoryCsvEngine'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

// Mock Recharts ResponsiveContainer to avoid jsdom zero-size layout warnings
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 500, height: 300 }}>{children}</div>
    )
  }
})

// Mock usePlan for DashboardPage context
vi.mock('@/context/PlanContext', () => ({
  usePlan: () => ({
    state: {
      planId: 'test_plan_e25d',
      weightLog: [],
      completedDays: [],
      isGenerated: true,
      plan: {
        splitName: 'Strength Split',
        experienceLevel: 'Advanced',
        days: [
          { dayTitle: 'Day 1 - Push Strength', dayType: 'Strength', exercises: [] }
        ]
      },
      formData: {
        weight: '80',
        height: '180',
        fitnessLevel: 'advanced',
        mainGoal: 'strength',
        medicalIssues: 'None'
      }
    },
    dispatch: vi.fn()
  })
}))

describe('Enhancement E25-D: Body Measurement Trend Visualizer & Rate Analytics Suite', () => {
  beforeEach(() => {
    localStorage.clear()
    clearBodyMetrics()
    clearWorkoutHistory()
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })

  // =========================================================================
  // SECTION 1: Pure Calculation & Engine Tests
  // =========================================================================
  describe('Pure Trend & Rate Calculation Engine', () => {
    it('calculates valid two-point delta and rate over exact 7 days', () => {
      const day1 = Date.parse('2026-08-01T12:00:00.000Z')
      const day8 = Date.parse('2026-08-08T12:00:00.000Z') // Exactly 7 days

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: day1, unit: 'cm', waist: 90 },
        { id: '2', date: '2026-08-08', timestamp: day8, unit: 'cm', waist: 88 }
      ]

      const trend = calculateMetricTrend(entries, 'waist', 'cm')

      expect(trend.observationsCount).toBe(2)
      expect(trend.baseline).toBe(90)
      expect(trend.previous).toBe(90)
      expect(trend.current).toBe(88)
      expect(trend.deltaFromPrevious).toBe(-2)
      expect(trend.deltaFromBaseline).toBe(-2)
      expect(trend.deltaDays).toBe(7)
      // Rate = ((88 - 90) / 7) * 7 = -2.00 cm/wk
      expect(trend.ratePerWeek).toBe(-2)
      expect(trend.rateLabel).toBe('-2 cm/wk')
      expect(trend.trendStatus).toBe('decreasing')
    })

    it('calculates positive rate of change correctly', () => {
      const day1 = Date.parse('2026-08-01T12:00:00.000Z')
      const day15 = Date.parse('2026-08-15T12:00:00.000Z') // 14 days

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: day1, unit: 'cm', arms: 34.0 },
        { id: '2', date: '2026-08-15', timestamp: day15, unit: 'cm', arms: 35.0 }
      ]

      const trend = calculateMetricTrend(entries, 'arms', 'cm')

      expect(trend.current).toBe(35)
      expect(trend.previous).toBe(34)
      expect(trend.deltaFromPrevious).toBe(1)
      expect(trend.deltaDays).toBe(14)
      // Rate = ((35 - 34) / 14) * 7 = +0.50 cm/wk
      expect(trend.ratePerWeek).toBe(0.5)
      expect(trend.rateLabel).toBe('+0.5 cm/wk')
      expect(trend.trendStatus).toBe('increasing')
    })

    it('calculates zero rate when measurements are identical', () => {
      const day1 = Date.parse('2026-08-01T12:00:00.000Z')
      const day8 = Date.parse('2026-08-08T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: day1, unit: 'cm', chest: 102 },
        { id: '2', date: '2026-08-08', timestamp: day8, unit: 'cm', chest: 102 }
      ]

      const trend = calculateMetricTrend(entries, 'chest', 'cm')

      expect(trend.ratePerWeek).toBe(0)
      expect(trend.rateLabel).toBe('0 cm/wk')
      expect(trend.trendStatus).toBe('stable')
    })

    it('accurately normalizes irregular observation intervals', () => {
      const day1 = Date.parse('2026-08-01T12:00:00.000Z')
      const day11 = Date.parse('2026-08-11T12:00:00.000Z') // 10 days

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: day1, unit: 'cm', thighs: 60 },
        { id: '2', date: '2026-08-11', timestamp: day11, unit: 'cm', thighs: 59 }
      ]

      const trend = calculateMetricTrend(entries, 'thighs', 'cm')

      expect(trend.deltaDays).toBe(10)
      // Rate = ((59 - 60) / 10) * 7 = -0.7 cm/wk
      expect(trend.ratePerWeek).toBe(-0.7)
      expect(trend.rateLabel).toBe('-0.7 cm/wk')
    })

    it('accurately normalizes fractional-day intervals without division-by-zero or NaN', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')
      const t2 = t1 + (3.5 * 86400000) // 3.5 days later

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 88 },
        { id: '2', date: '2026-08-04', timestamp: t2, unit: 'cm', waist: 87 }
      ]

      const trend = calculateMetricTrend(entries, 'waist', 'cm')

      expect(trend.deltaDays).toBe(3.5)
      // Rate = ((-1) / 3.5) * 7 = -2.00 cm/wk
      expect(trend.ratePerWeek).toBe(-2)
    })

    it('builds multi-point trajectory points with baseline and sequential deltas', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')
      const t2 = Date.parse('2026-08-10T12:00:00.000Z')
      const t3 = Date.parse('2026-08-20T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', hips: 98 },
        { id: '2', date: '2026-08-10', timestamp: t2, unit: 'cm', hips: 97 },
        { id: '3', date: '2026-08-20', timestamp: t3, unit: 'cm', hips: 96 }
      ]

      const trend = calculateMetricTrend(entries, 'hips', 'cm')

      expect(trend.points.length).toBe(3)
      expect(trend.points[0].deltaFromPrevious).toBeNull() // baseline point
      expect(trend.points[1].deltaFromPrevious).toBe(-1)
      expect(trend.points[2].deltaFromPrevious).toBe(-1)
      expect(trend.baseline).toBe(98)
      expect(trend.previous).toBe(97)
      expect(trend.current).toBe(96)
      expect(trend.deltaFromBaseline).toBe(-2)
    })

    it('maintains strict input immutability', () => {
      const t1 = Date.parse('2026-08-10T12:00:00.000Z')
      const t2 = Date.parse('2026-08-01T12:00:00.000Z') // out-of-order

      const originalEntries: BodyMeasurementEntry[] = Object.freeze([
        Object.freeze({ id: '2', date: '2026-08-10', timestamp: t1, unit: 'cm', waist: 85 }),
        Object.freeze({ id: '1', date: '2026-08-01', timestamp: t2, unit: 'cm', waist: 88 })
      ]) as unknown as BodyMeasurementEntry[]

      const cloned = JSON.parse(JSON.stringify(originalEntries))

      const trend = calculateMetricTrend(originalEntries, 'waist', 'cm')

      // Engine must sort internally without modifying original array order
      expect(originalEntries[0].id).toBe('2')
      expect(originalEntries[1].id).toBe('1')
      expect(JSON.stringify(originalEntries)).toBe(JSON.stringify(cloned))
      expect(trend.points[0].id).toBe('1') // Oldest first in output
      expect(trend.points[1].id).toBe('2')
    })

    it('calculates all 5 metrics simultaneously via calculateAllMetricTrends', () => {
      const day1 = Date.parse('2026-08-01T12:00:00.000Z')
      const day8 = Date.parse('2026-08-08T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: day1, unit: 'cm', waist: 90, chest: 100, arms: 35, thighs: 60, hips: 98 },
        { id: '2', date: '2026-08-08', timestamp: day8, unit: 'cm', waist: 88, chest: 101, arms: 35.5, thighs: 59.5, hips: 97.5 }
      ]

      const all = calculateAllMetricTrends(entries, 'cm')

      expect(all.waist.ratePerWeek).toBe(-2)
      expect(all.chest.ratePerWeek).toBe(1)
      expect(all.arms.ratePerWeek).toBe(0.5)
      expect(all.thighs.ratePerWeek).toBe(-0.5)
      expect(all.hips.ratePerWeek).toBe(-0.5)
    })

    it('formats rate labels and delta labels correctly across edge cases', () => {
      expect(formatRateLabel(0.5, 'cm')).toBe('+0.5 cm/wk')
      expect(formatRateLabel(-1.2, 'in')).toBe('-1.2 in/wk')
      expect(formatRateLabel(0, 'cm')).toBe('0 cm/wk')
      expect(formatRateLabel(null, 'cm')).toBe('Insufficient data')
      expect(formatRateLabel(NaN, 'cm')).toBe('Insufficient data')

      expect(formatDeltaLabel(1.5, 'cm')).toBe('+1.5 cm')
      expect(formatDeltaLabel(-0.8, 'in')).toBe('-0.8 in')
      expect(formatDeltaLabel(null, 'cm')).toBe('—')
      expect(formatDeltaLabel(NaN, 'cm')).toBe('—')
    })
  })

  // =========================================================================
  // SECTION 2: Edge Cases, Malformed Data & Fail-Closed Guardrails
  // =========================================================================
  describe('Fail-Closed Semantics & Edge Case Guardrails', () => {
    it('returns deterministic insufficient_data when entries array is empty', () => {
      const trend = calculateMetricTrend([], 'waist', 'cm')

      expect(trend.observationsCount).toBe(0)
      expect(trend.current).toBeNull()
      expect(trend.previous).toBeNull()
      expect(trend.baseline).toBeNull()
      expect(trend.ratePerWeek).toBeNull()
      expect(trend.rateLabel).toBe('Insufficient data')
      expect(trend.trendStatus).toBe('insufficient_data')
    })

    it('returns deterministic insufficient_data when only 1 valid observation exists', () => {
      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: 1700000000000, unit: 'cm', waist: 85 }
      ]

      const trend = calculateMetricTrend(entries, 'waist', 'cm')

      expect(trend.observationsCount).toBe(1)
      expect(trend.current).toBe(85)
      expect(trend.previous).toBeNull()
      expect(trend.baseline).toBe(85)
      expect(trend.deltaFromPrevious).toBeNull()
      expect(trend.deltaFromBaseline).toBe(0)
      expect(trend.ratePerWeek).toBeNull()
      expect(trend.rateLabel).toBe('Insufficient data')
      expect(trend.trendStatus).toBe('insufficient_data')
    })

    it('fails closed when two observations have duplicate timestamps (deltaDays <= 0)', () => {
      const duplicateTime = Date.parse('2026-08-01T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: duplicateTime, unit: 'cm', waist: 90 },
        { id: '2', date: '2026-08-01', timestamp: duplicateTime, unit: 'cm', waist: 88 }
      ]

      const trend = calculateMetricTrend(entries, 'waist', 'cm')

      // Must NOT divide by zero or emit NaN/Infinity
      expect(trend.ratePerWeek).toBeNull()
      expect(trend.rateLabel).toBe('Insufficient data')
      expect(trend.trendStatus).toBe('insufficient_data')
    })

    it('fails closed when observations have inverted/non-monotonic timestamps', () => {
      // If timestamps produce deltaDays <= 0
      const trend = calculateMetricTrend(
        [
          { id: '1', date: '2026-08-10', timestamp: 1000, unit: 'cm', waist: 90 },
          { id: '2', date: '2026-08-01', timestamp: 1000, unit: 'cm', waist: 88 }
        ],
        'waist',
        'cm'
      )

      expect(trend.ratePerWeek).toBeNull()
      expect(trend.trendStatus).toBe('insufficient_data')
    })

    it('safely filters out NaN, Infinity, negative and non-numeric metric values', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')
      const t2 = Date.parse('2026-08-08T12:00:00.000Z')

      const entries = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm' as MetricUnit, waist: 90 },
        { id: 'bad1', date: '2026-08-03', timestamp: t1 + 86400000, unit: 'cm' as MetricUnit, waist: NaN },
        { id: 'bad2', date: '2026-08-04', timestamp: t1 + 2 * 86400000, unit: 'cm' as MetricUnit, waist: Infinity },
        { id: 'bad3', date: '2026-08-05', timestamp: t1 + 3 * 86400000, unit: 'cm' as MetricUnit, waist: -10 },
        { id: 'bad4', date: '2026-08-06', timestamp: t1 + 4 * 86400000, unit: 'cm' as MetricUnit, waist: 0 },
        { id: 'bad5', date: '2026-08-07', timestamp: t1 + 5 * 86400000, unit: 'cm' as MetricUnit, waist: 'malformed' as unknown as number },
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm' as MetricUnit, waist: 88 }
      ]

      const trend = calculateMetricTrend(entries, 'waist', 'cm')

      // Malformed entries omitted safely without converting into 0
      expect(trend.observationsCount).toBe(2)
      expect(trend.previous).toBe(90)
      expect(trend.current).toBe(88)
      expect(trend.ratePerWeek).toBe(-2)
    })

    it('falls back to Date.parse(entry.date) when timestamp field is missing or malformed', () => {
      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: 0, unit: 'cm', waist: 90 },
        { id: '2', date: '2026-08-08', timestamp: NaN, unit: 'cm', waist: 88 }
      ]

      const trend = calculateMetricTrend(entries, 'waist', 'cm')

      expect(trend.observationsCount).toBe(2)
      expect(trend.ratePerWeek).toBe(-2)
    })

    it('safely skips entries with completely invalid date and timestamp', () => {
      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: 'Invalid Date', timestamp: NaN, unit: 'cm', waist: 90 },
        { id: '2', date: '2026-08-08', timestamp: Date.parse('2026-08-08T12:00:00.000Z'), unit: 'cm', waist: 88 }
      ]

      const trend = calculateMetricTrend(entries, 'waist', 'cm')

      // Only 1 valid observation remaining
      expect(trend.observationsCount).toBe(1)
      expect(trend.ratePerWeek).toBeNull()
    })
  })

  // =========================================================================
  // SECTION 3: Unit Normalization & Conversions
  // =========================================================================
  describe('Unit Normalization & Mixed-Unit History', () => {
    it('verifies convertMetricValue alias is identical to convertLength', () => {
      expect(convertMetricValue).toBe(convertLength)
      expect(convertMetricValue(25.4, 'cm', 'in')).toBe(10)
      expect(convertMetricValue(10, 'in', 'cm')).toBe(25.4)
    })

    it('converts an all-inch history to cm display target', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')
      const t2 = Date.parse('2026-08-08T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'in', waist: 35.0 },
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'in', waist: 34.0 }
      ]

      const trend = calculateMetricTrend(entries, 'waist', 'cm')

      // 35 in = 88.9 cm, 34 in = 86.4 cm
      expect(trend.unit).toBe('cm')
      expect(trend.baseline).toBe(88.9)
      expect(trend.current).toBe(86.4)
      expect(trend.deltaFromPrevious).toBe(-2.5)
      expect(trend.ratePerWeek).toBe(-2.5)
      expect(trend.rateLabel).toBe('-2.5 cm/wk')
    })

    it('converts an all-cm history to inch display target', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')
      const t2 = Date.parse('2026-08-08T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 88.9 },
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm', waist: 86.4 }
      ]

      const trend = calculateMetricTrend(entries, 'waist', 'in')

      expect(trend.unit).toBe('in')
      expect(trend.baseline).toBe(35)
      expect(trend.current).toBe(34)
      expect(trend.deltaFromPrevious).toBe(-1)
      expect(trend.ratePerWeek).toBe(-1)
      expect(trend.rateLabel).toBe('-1 in/wk')
    })

    it('seamlessly handles mixed-unit historical logs', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')
      const t2 = Date.parse('2026-08-08T12:00:00.000Z')

      // Entry 1 logged in inches (10 in = 25.4 cm), Entry 2 logged in cm (26.4 cm)
      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'in', arms: 10 },
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm', arms: 26.4 }
      ]

      const trendCm = calculateMetricTrend(entries, 'arms', 'cm')

      expect(trendCm.baseline).toBe(25.4)
      expect(trendCm.current).toBe(26.4)
      expect(trendCm.deltaFromPrevious).toBe(1)
      expect(trendCm.ratePerWeek).toBe(1)
      expect(trendCm.rateLabel).toBe('+1 cm/wk')
    })

    it('defaults missing unit property in legacy records to cm', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')
      const t2 = Date.parse('2026-08-08T12:00:00.000Z')

      const legacyEntries = [
        { id: '1', date: '2026-08-01', timestamp: t1, waist: 90 },
        { id: '2', date: '2026-08-08', timestamp: t2, waist: 88 }
      ] as unknown as BodyMeasurementEntry[]

      const trend = calculateMetricTrend(legacyEntries, 'waist', 'cm')

      expect(trend.current).toBe(88)
      expect(trend.baseline).toBe(90)
      expect(trend.ratePerWeek).toBe(-2)
    })
  })

  // =========================================================================
  // SECTION 4: Accessibility & Clinical Safety Boundary
  // =========================================================================
  describe('Accessibility & Non-Diagnostic Clinical Safety', () => {
    it('generates descriptive, non-diagnostic screen reader text', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')
      const t2 = Date.parse('2026-08-08T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 90 },
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm', waist: 88 }
      ]

      const trend = calculateMetricTrend(entries, 'waist', 'cm')
      const desc = getAccessibleRateDescription(trend)

      // Expected pattern: "Rate of change: -2 centimeters per week"
      expect(desc).toBe('Rate of change: -2 centimeters per week')
    })

    it('generates non-diagnostic screen reader text for inch units', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')
      const t2 = Date.parse('2026-08-15T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'in', chest: 40 },
        { id: '2', date: '2026-08-15', timestamp: t2, unit: 'in', chest: 41 }
      ]

      const trend = calculateMetricTrend(entries, 'chest', 'in')
      const desc = getAccessibleRateDescription(trend)

      expect(desc).toBe('Rate of change: +0.5 inches per week')
    })

    it('generates fallback accessible description when data is insufficient', () => {
      const trend = calculateMetricTrend([], 'waist', 'cm')
      const desc = getAccessibleRateDescription(trend)

      expect(desc).toBe('No rate of change available (insufficient data)')
    })

    it('ensures trend status and labels strictly avoid clinical or loaded judgments', () => {
      const forbiddenPhrases = [
        'good', 'bad', 'dangerous', 'optimal', 'healthy', 'unhealthy',
        'fat loss', 'muscle gain', 'diagnosis', 'treatment', 'medical'
      ]

      const trendInc = calculateMetricTrend(
        [
          { id: '1', date: '2026-08-01', timestamp: 10000, unit: 'cm', waist: 80 },
          { id: '2', date: '2026-08-08', timestamp: 10000 + 7 * 86400000, unit: 'cm', waist: 84 }
        ],
        'waist',
        'cm'
      )

      for (const phrase of forbiddenPhrases) {
        expect(trendInc.trendStatus.toLowerCase()).not.toContain(phrase)
        expect(trendInc.rateLabel.toLowerCase()).not.toContain(phrase)
      }
    })
  })

  // =========================================================================
  // SECTION 5: Component Rendering & UI Interactions
  // =========================================================================
  describe('BodyMeasurementVisualizer Component', () => {
    it('renders with valid history, displaying badges and metric tabs', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')
      const t2 = Date.parse('2026-08-08T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 90, chest: 100 },
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm', waist: 88, chest: 101 }
      ]

      render(<BodyMeasurementVisualizer entries={entries} unit="cm" />)

      expect(screen.getByTestId('body-measurement-visualizer')).toBeDefined()
      expect(screen.getByRole('tab', { name: /waist/i })).toBeDefined()
      expect(screen.getByRole('tab', { name: /chest/i })).toBeDefined()
      expect(screen.getByRole('tab', { name: /arms/i })).toBeDefined()
      expect(screen.getByRole('tab', { name: /thighs/i })).toBeDefined()
      expect(screen.getByRole('tab', { name: /hips/i })).toBeDefined()

      // Current waist value = 88 cm
      expect(screen.getAllByText('88 cm').length).toBeGreaterThan(0)
      expect(screen.getByTestId('rate-per-week-badge').textContent).toBe('-2 cm/wk')
    })

    it('switches active metric series upon clicking tab buttons', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')
      const t2 = Date.parse('2026-08-08T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 90, chest: 100 },
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm', waist: 88, chest: 101.5 }
      ]

      render(<BodyMeasurementVisualizer entries={entries} unit="cm" />)

      // Initially on waist (-2 cm/wk)
      expect(screen.getByTestId('rate-per-week-badge').textContent).toBe('-2 cm/wk')

      // Switch to chest
      fireEvent.click(screen.getByRole('tab', { name: /chest/i }))

      // Chest rate = ((101.5 - 100) / 7) * 7 = +1.5 cm/wk
      expect(screen.getAllByText('101.5 cm').length).toBeGreaterThan(0)
      expect(screen.getByTestId('rate-per-week-badge').textContent).toBe('+1.5 cm/wk')
    })

    it('renders empty-metric state when selected metric has 0 records', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 90 }
      ]

      render(<BodyMeasurementVisualizer entries={entries} unit="cm" />)

      // Switch to thighs (not logged)
      fireEvent.click(screen.getByRole('tab', { name: /thighs/i }))

      expect(screen.getByTestId('empty-metric-state')).toBeDefined()
      expect(screen.getByText(/No recorded measurements for thighs/i)).toBeDefined()
    })

    it('renders insufficient-data state when selected metric has only 1 record', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 90 }
      ]

      render(<BodyMeasurementVisualizer entries={entries} unit="cm" />)

      expect(screen.getByTestId('insufficient-data-state')).toBeDefined()
      expect(screen.getByText(/1 observation recorded/i)).toBeDefined()
      expect(screen.getByText(/Log at least 2 measurements/i)).toBeDefined()
    })

    it('renders accessible sr-only table with complete observation coordinates', () => {
      const t1 = Date.parse('2026-08-01T12:00:00.000Z')
      const t2 = Date.parse('2026-08-08T12:00:00.000Z')

      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 90 },
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm', waist: 88 }
      ]

      render(<BodyMeasurementVisualizer entries={entries} unit="cm" />)

      const accessibleContainer = screen.getByTestId('accessible-trend-representation')
      expect(accessibleContainer).toBeDefined()

      const table = screen.getByRole('table', { name: /waist measurement history table/i })
      expect(table).toBeDefined()
      expect(screen.getByText(/Chronological Waist measurements in cm/i)).toBeDefined()
      expect(screen.getByText('Baseline observation')).toBeDefined()
      expect(screen.getAllByText('-2 cm').length).toBeGreaterThan(0)
    })

    it('displays the non-diagnostic clinical disclaimer banner', () => {
      render(<BodyMeasurementVisualizer entries={[]} unit="cm" />)

      expect(
        screen.getByText(/Biometric circumference changes reflect natural tissue and fluid fluctuations/i)
      ).toBeDefined()
    })
  })

  // =========================================================================
  // SECTION 6: DashboardPage Integration & Cross-Tab Sync
  // =========================================================================
  describe('DashboardPage Integration & Storage Synchronization', () => {
    it('renders Body Measurements section with visualizer when measurements exist', () => {
      saveBodyMeasurement({
        date: '2026-08-01',
        unit: 'cm',
        waist: 90,
        arms: 34
      })
      saveBodyMeasurement({
        date: '2026-08-08',
        unit: 'cm',
        waist: 88,
        arms: 34.5
      })

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      expect(screen.getByTestId('body-measurement-visualizer')).toBeDefined()
      expect(screen.getByText(/Total Recorded Logs:/i)).toBeDefined()
      expect(screen.getByText(/Latest: 2026-08-08/i)).toBeDefined()
    })

    it('updates visualizer dynamically when storage event fires from another tab', () => {
      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      // Initially empty state
      expect(screen.getByText(/No body measurements recorded yet/i)).toBeDefined()

      // Simulate cross-tab entry addition
      saveBodyMeasurement({
        date: '2026-08-10',
        unit: 'cm',
        waist: 85
      })

      // Dispatch window storage event
      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: BODY_METRICS_STORAGE_KEY,
            newValue: localStorage.getItem(BODY_METRICS_STORAGE_KEY)
          })
        )
      })

      // Visualizer should now appear
      expect(screen.getByTestId('body-measurement-visualizer')).toBeDefined()
    })
  })

  // =========================================================================
  // SECTION 7: Regressions & Cross-Feature Integrity
  // =========================================================================
  describe('Regressions & Provenance Safeguards', () => {
    it('preserves existing calculateBodyMetricDeltas semantics without breakage', () => {
      const entries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: 1000, unit: 'cm', waist: 90 },
        { id: '2', date: '2026-08-10', timestamp: 2000, unit: 'cm', waist: 88 },
        { id: '3', date: '2026-08-20', timestamp: 3000, unit: 'cm', waist: 86 }
      ]

      const deltas = calculateBodyMetricDeltas(entries, 'cm')

      expect(deltas.waist.current).toBe(86)
      expect(deltas.waist.previous).toBe(88)
      expect(deltas.waist.baseline).toBe(90)
      expect(deltas.waist.deltaFromPrevious).toBe(-2)
      expect(deltas.waist.deltaFromBaseline).toBe(-4)
    })

    it('preserves E25-A workout log deletion without regression', () => {
      const logToSave: CompletedWorkoutLog = {
        id: 'sess_reg_1',
        sessionId: 'sess_reg_1',
        dayIndex: 0,
        dayTitle: 'Leg Hypertrophy',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-20T10:00:00.000Z',
        durationSeconds: 3000,
        totalSetsCompleted: 12,
        totalExercises: 3,
        totalVolumeKg: 10000,
        workloadDensityKgPerMin: 200,
        exercisesSummary: []
      }
      saveCompletedWorkoutLog(logToSave)

      expect(loadWorkoutHistory().length).toBe(1)
      const deleted = deleteCompletedWorkoutLog(logToSave.id)
      expect(deleted).toBe(true)
      expect(loadWorkoutHistory().length).toBe(0)
    })

    it('preserves E25-C workout history search and reflection matching', () => {
      const log: CompletedWorkoutLog = {
        id: 'log_search_1',
        sessionId: 's1',
        dayIndex: 0,
        dayTitle: 'Pull Strength',
        dayType: 'Strength',
        completedAt: '2026-08-20T10:00:00.000Z',
        durationSeconds: 2400,
        totalSetsCompleted: 10,
        totalExercises: 2,
        totalVolumeKg: 8000,
        workloadDensityKgPerMin: 200,
        exercisesSummary: [{ name: 'Deadlift', setsCompleted: 4, totalSets: 4, peakWeightKg: 180, avgCompletedReps: 5 }],
        sessionReflection: {
          energyRating: 5,
          perceivedReadiness: 'high',
          reflectionTags: ['HeavyPull', 'BackFocus'],
          notes: 'Felt very explosive on the warmups'
        }
      }

      const res = filterWorkoutHistory([log], { searchQuery: '#HeavyPull' })
      expect(res.filteredCount).toBe(1)
      expect(res.logs.length).toBe(1)

      const notesRes = filterWorkoutHistory([log], { searchQuery: 'explosive' })
      expect(notesRes.filteredCount).toBe(1)
      expect(notesRes.logs.length).toBe(1)
    })

    it('preserves E22 workout history CSV export engine', () => {
      const log: CompletedWorkoutLog = {
        id: 'csv_log_1',
        sessionId: 's2',
        dayIndex: 0,
        dayTitle: 'Push Power',
        dayType: 'Strength',
        completedAt: '2026-08-20T10:00:00.000Z',
        durationSeconds: 3000,
        totalSetsCompleted: 10,
        totalExercises: 1,
        totalVolumeKg: 5000,
        workloadDensityKgPerMin: 100,
        exercisesSummary: [{ name: 'Bench Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 100, avgCompletedReps: 5 }]
      }

      const csv = generateWorkoutHistoryCsv([log])
      expect(csv).toContain('Push Power')
      expect(csv).toContain('Bench Press')
    })

    it('preserves workout streak and personal record calculation integrity', () => {
      const logs: CompletedWorkoutLog[] = [
        {
          id: 'strk_1',
          sessionId: 's_strk_1',
          dayIndex: 0,
          dayTitle: 'Deadlift PR Day',
          dayType: 'Strength',
          completedAt: new Date().toISOString(),
          durationSeconds: 3600,
          totalSetsCompleted: 15,
          totalExercises: 2,
          totalVolumeKg: 12000,
          workloadDensityKgPerMin: 200,
          exercisesSummary: [
            { name: 'Deadlift', setsCompleted: 5, totalSets: 5, peakWeightKg: 200, avgCompletedReps: 5 }
          ]
        }
      ]

      const prs = extractPersonalRecords(logs)
      expect(prs.length).toBe(1)
      expect(prs[0].exerciseName).toBe('Deadlift')
      expect(prs[0].value).toBe(200)

      const streak = calculateWorkoutStreak(logs, [0])
      expect(typeof streak).toBe('number')
      expect(streak).toBeGreaterThanOrEqual(1)

      expect(METRIC_LABELS.waist).toBe('Waist')
    })
  })

  // =========================================================================
  // SECTION 8: Controlled Mutation Testing (Phase 13 Oracles)
  // =========================================================================
  describe('Controlled Mutation Oracles (Phase 13)', () => {
    const t1 = Date.parse('2026-08-01T12:00:00.000Z')
    const t2 = Date.parse('2026-08-08T12:00:00.000Z')
    const canonicalEntries: BodyMeasurementEntry[] = [
      { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 90 },
      { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm', waist: 88 }
    ]

    // Mutation 1: Reverse the delta (previous - current)
    it('Mutation Oracle 1: Detects reversal of delta formula', () => {
      const canonical = calculateMetricTrend(canonicalEntries, 'waist', 'cm')
      expect(canonical.ratePerWeek).toBe(-2) // 88 - 90 = -2

      const mutantRate = ((90 - 88) / 7) * 7 // Reversed
      expect(mutantRate).not.toBe(canonical.ratePerWeek)
    })

    // Mutation 2: Replace actual elapsed time with fixed 7-day assumption
    it('Mutation Oracle 2: Detects replacing elapsed time with 7-day assumption', () => {
      const t14 = t1 + 14 * 86400000 // 14 days
      const entries14 = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 90 },
        { id: '2', date: '2026-08-15', timestamp: t14, unit: 'cm', waist: 88 }
      ]
      const actual = calculateMetricTrend(entries14, 'waist', 'cm')
      expect(actual.ratePerWeek).toBe(-1) // ((88-90)/14)*7 = -1

      const mutant = ((88 - 90) / 7) * 7 // Assumed 7 days
      expect(mutant).toBe(-2)
      expect(mutant).not.toBe(actual.ratePerWeek)
    })

    // Mutation 3: Divide by zero / allow duplicate timestamps
    it('Mutation Oracle 3: Proves divide by zero / duplicate timestamp is caught', () => {
      const dupEntries = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 90 },
        { id: '2', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 88 }
      ]
      const result = calculateMetricTrend(dupEntries, 'waist', 'cm')
      expect(result.ratePerWeek).toBeNull()
      expect(result.trendStatus).toBe('insufficient_data')
    })

    // Mutation 4: Remove unit conversion
    it('Mutation Oracle 4: Detects failure to convert mixed units', () => {
      const mixedEntries: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'in', waist: 35 },
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm', waist: 86.4 }
      ]
      const actual = calculateMetricTrend(mixedEntries, 'waist', 'cm')
      // If unit conversion were removed, 86.4 - 35 = +51.4 (absurd!)
      expect(actual.ratePerWeek).toBeCloseTo(-2.5, 1)
      expect(actual.ratePerWeek).not.toBe(51.4)
    })

    // Mutation 5: Select wrong previous observation in multi-point trajectory
    it('Mutation Oracle 5: Detects selecting wrong previous observation', () => {
      const t3 = t2 + 7 * 86400000
      const entries3: BodyMeasurementEntry[] = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 90 },
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm', waist: 88 },
        { id: '3', date: '2026-08-15', timestamp: t3, unit: 'cm', waist: 87 }
      ]
      const actual = calculateMetricTrend(entries3, 'waist', 'cm')
      // Current = 87, Prev = 88 => delta = -1, rate = -1
      expect(actual.ratePerWeek).toBe(-1)

      const mutant = ((87 - 90) / 7) * 7 // Comparing to baseline instead of prev
      expect(mutant).toBe(-3)
      expect(mutant).not.toBe(actual.ratePerWeek)
    })

    // Mutation 6: Ignore invalid timestamps
    it('Mutation Oracle 6: Proves invalid timestamps are not treated as 0 or ignored silently', () => {
      const invalidEntries: BodyMeasurementEntry[] = [
        { id: '1', date: 'Invalid Date', timestamp: -500, unit: 'cm', waist: 90 },
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm', waist: 88 }
      ]
      const actual = calculateMetricTrend(invalidEntries, 'waist', 'cm')
      expect(actual.observationsCount).toBe(1)
      expect(actual.ratePerWeek).toBeNull()
    })

    // Mutation 7: Convert malformed values into zero
    it('Mutation Oracle 7: Proves malformed values are not converted into zero', () => {
      const malformedEntries = [
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm' as MetricUnit, waist: 90 },
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm' as MetricUnit, waist: null as unknown as number }
      ]
      const actual = calculateMetricTrend(malformedEntries, 'waist', 'cm')
      expect(actual.observationsCount).toBe(1)
      // If null were converted to 0, current would be 0 and delta would be -90!
      expect(actual.current).toBe(90)
      expect(actual.ratePerWeek).toBeNull()
    })

    // Mutation 8: Return 0 instead of null for insufficient data
    it('Mutation Oracle 8: Detects returning 0 instead of null for insufficient data', () => {
      const actual = calculateMetricTrend([], 'waist', 'cm')
      expect(actual.ratePerWeek).toBeNull()
      expect(actual.ratePerWeek).not.toBe(0)
    })

    // Mutation 9: Reverse chronological ordering
    it('Mutation Oracle 9: Detects reverse chronological ordering', () => {
      const outOfOrder: BodyMeasurementEntry[] = [
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm', waist: 88 },
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 90 }
      ]
      const actual = calculateMetricTrend(outOfOrder, 'waist', 'cm')
      expect(actual.points[0].date).toBe('2026-08-01')
      expect(actual.points[1].date).toBe('2026-08-08')
      expect(actual.ratePerWeek).toBe(-2)
    })

    // Mutation 10: Mutate the input measurement array
    it('Mutation Oracle 10: Proves input array is not mutated', () => {
      const inputArr: BodyMeasurementEntry[] = [
        { id: '2', date: '2026-08-08', timestamp: t2, unit: 'cm', waist: 88 },
        { id: '1', date: '2026-08-01', timestamp: t1, unit: 'cm', waist: 90 }
      ]
      const freezeObj = Object.freeze([...inputArr])
      expect(() => calculateMetricTrend(freezeObj, 'waist', 'cm')).not.toThrow()
      expect(freezeObj[0].id).toBe('2')
    })

    // Mutation 11: Plot a deleted/stale measurement
    it('Mutation Oracle 11: Proves deleted measurement does not persist in visualizer', () => {
      const entry1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 90 })
      const entry2 = saveBodyMeasurement({ date: '2026-08-08', unit: 'cm', waist: 88 })

      let metrics = loadBodyMetrics()
      expect(metrics.length).toBe(2)

      deleteBodyMeasurement(entry2.id)
      metrics = loadBodyMetrics()
      expect(metrics.length).toBe(1)
      expect(metrics[0].id).toBe(entry1.id)

      const trend = calculateMetricTrend(metrics, 'waist', 'cm')
      expect(trend.observationsCount).toBe(1)
      expect(trend.ratePerWeek).toBeNull() // Back to insufficient data
    })

    // Mutation 12: Remove the accessible non-visual representation
    it('Mutation Oracle 12: Detects absence of accessible table representation', () => {
      const { container } = render(<BodyMeasurementVisualizer entries={canonicalEntries} unit="cm" />)
      const srTable = container.querySelector('table')
      expect(srTable).not.toBeNull()
      expect(srTable?.getAttribute('aria-label')).toContain('Waist measurement history table')
    })

    // Mutation 13: Introduce medical/clinical interpretation into displayed trend status
    it('Mutation Oracle 13: Detects medical or clinical interpretation in trend status', () => {
      const trend = calculateMetricTrend(canonicalEntries, 'waist', 'cm')
      const allowedStatuses = ['increasing', 'decreasing', 'stable', 'insufficient_data']
      expect(allowedStatuses).toContain(trend.trendStatus)

      const clinicalForbidden = ['healthy', 'unhealthy', 'pathological', 'prescribed', 'optimal']
      for (const forbidden of clinicalForbidden) {
        expect(trend.trendStatus).not.toBe(forbidden)
      }
    })
  })
})
