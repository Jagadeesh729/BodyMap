/**
 * BodyMap AI — Body Measurement Trend & Rate Calculation Engine (E25-D)
 *
 * Pure deterministic calculation engine for body circumference trends and
 * normalized weekly rate of change analytics.
 *
 * Canonical Rate Formula:
 *   ratePerWeek = ((currentValue - previousValue) / deltaDays) * 7
 * where:
 *   deltaDays = (currentTimestamp - previousTimestamp) / 86400000
 *
 * Safety & Clinical Boundaries:
 * - Strictly non-diagnostic and descriptive.
 * - Fails closed on insufficient data (< 2 valid observations) or invalid timestamps (deltaDays <= 0).
 * - Never divides by zero, never emits NaN or Infinity.
 * - Preserves input immutability.
 */

import type {
  BodyMeasurementEntry,
  BodyMetricKey,
  MetricTrendAnalysis,
  MetricUnit,
  TrendStatus,
  TrendTrajectoryPoint
} from '@/types/bodyMetrics'
import { METRIC_LABELS, convertLength } from '@/lib/bodyMetricsStorage'

/**
 * Format a rate value into a human-readable display string.
 */
export function formatRateLabel(rate: number | null, unit: MetricUnit): string {
  if (rate === null || typeof rate !== 'number' || isNaN(rate) || !isFinite(rate)) {
    return 'Insufficient data'
  }
  const sign = rate > 0 ? '+' : ''
  return `${sign}${rate} ${unit}/wk`
}

/**
 * Format a delta value into a human-readable display string.
 */
export function formatDeltaLabel(delta: number | null, unit: MetricUnit): string {
  if (delta === null || typeof delta !== 'number' || isNaN(delta) || !isFinite(delta)) {
    return '—'
  }
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta} ${unit}`
}

/**
 * Produces an objective, non-diagnostic screen-reader description of the rate of change.
 * Adheres strictly to non-clinical boundaries:
 * e.g. "Rate of change: +0.4 centimeters per week" or "Rate of change: -0.4 centimeters per week"
 */
export function getAccessibleRateDescription(analysis: MetricTrendAnalysis): string {
  if (analysis.ratePerWeek === null) {
    return 'No rate of change available (insufficient data)'
  }

  const unitFullName = analysis.unit === 'in' ? 'inches' : 'centimeters'
  const rate = analysis.ratePerWeek
  const sign = rate > 0 ? '+' : ''
  return `Rate of change: ${sign}${rate} ${unitFullName} per week`
}

/**
 * Pure deterministic calculation of measurement trajectory and weekly rate of change
 * for a specific body metric key.
 *
 * Requirements:
 * - Does not mutate input array or entries.
 * - Chronologically orders valid observations.
 * - Converts all historical values to targetUnit before delta/rate calculations.
 * - Fails closed when < 2 valid observations or when deltaDays <= 0.
 */
export function calculateMetricTrend(
  entries: readonly BodyMeasurementEntry[] | BodyMeasurementEntry[],
  metricKey: BodyMetricKey,
  targetUnit: MetricUnit = 'cm'
): MetricTrendAnalysis {
  const label = METRIC_LABELS[metricKey] || metricKey

  // Fail closed on non-array or empty inputs
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      key: metricKey,
      label,
      unit: targetUnit,
      current: null,
      previous: null,
      baseline: null,
      deltaFromPrevious: null,
      deltaFromBaseline: null,
      ratePerWeek: null,
      rateLabel: 'Insufficient data',
      trendStatus: 'insufficient_data',
      observationsCount: 0,
      points: [],
      deltaDays: null
    }
  }

  // 1. Extract valid points without mutating input
  const validRawPoints: Array<{ id?: string; date: string; timestamp: number; value: number }> = []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue

    const rawVal = entry[metricKey]
    if (typeof rawVal !== 'number' || isNaN(rawVal) || !isFinite(rawVal) || rawVal <= 0) {
      continue
    }

    // Resolve and validate timestamp
    let timestamp = entry.timestamp
    if (typeof timestamp !== 'number' || isNaN(timestamp) || !isFinite(timestamp) || timestamp <= 0) {
      if (typeof entry.date === 'string' && entry.date.trim().length > 0) {
        const parsed = Date.parse(entry.date)
        if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
          timestamp = parsed
        } else {
          continue // Skip invalid entry safely
        }
      } else {
        continue // Skip invalid entry safely
      }
    }

    const dateStr = typeof entry.date === 'string' && entry.date.trim().length > 0
      ? entry.date.trim()
      : new Date(timestamp).toISOString().split('T')[0]

    const sourceUnit: MetricUnit = entry.unit === 'in' ? 'in' : 'cm'
    const normalizedVal = convertLength(rawVal, sourceUnit, targetUnit)

    validRawPoints.push({
      id: entry.id,
      date: dateStr,
      timestamp,
      value: normalizedVal
    })
  }

  // 2. Chronological sort (oldest first, newest last) on shallow copy
  const sorted = [...validRawPoints].sort((a, b) => a.timestamp - b.timestamp)

  // 3. Build trajectory points with sequential deltas
  const points: TrendTrajectoryPoint[] = []
  for (let i = 0; i < sorted.length; i++) {
    const pt = sorted[i]
    const prevPt = i > 0 ? sorted[i - 1] : null
    const deltaFromPrevious = prevPt !== null ? Number((pt.value - prevPt.value).toFixed(1)) : null

    points.push({
      id: pt.id,
      date: pt.date,
      timestamp: pt.timestamp,
      value: pt.value,
      formattedValue: `${pt.value} ${targetUnit}`,
      deltaFromPrevious
    })
  }

  const count = points.length

  if (count === 0) {
    return {
      key: metricKey,
      label,
      unit: targetUnit,
      current: null,
      previous: null,
      baseline: null,
      deltaFromPrevious: null,
      deltaFromBaseline: null,
      ratePerWeek: null,
      rateLabel: 'Insufficient data',
      trendStatus: 'insufficient_data',
      observationsCount: 0,
      points: [],
      deltaDays: null
    }
  }

  if (count === 1) {
    const single = points[0]
    return {
      key: metricKey,
      label,
      unit: targetUnit,
      current: single.value,
      previous: null,
      baseline: single.value,
      deltaFromPrevious: null,
      deltaFromBaseline: 0,
      ratePerWeek: null,
      rateLabel: 'Insufficient data',
      trendStatus: 'insufficient_data',
      observationsCount: 1,
      points,
      deltaDays: null
    }
  }

  // count >= 2: calculate current, previous, baseline, and normalized rate
  const baselinePoint = points[0]
  const previousPoint = points[count - 2]
  const currentPoint = points[count - 1]

  const current = currentPoint.value
  const previous = previousPoint.value
  const baseline = baselinePoint.value

  const deltaFromPrevious = Number((current - previous).toFixed(1))
  const deltaFromBaseline = Number((current - baseline).toFixed(1))

  // Elapsed time in days between previous observation and current observation
  const deltaMs = currentPoint.timestamp - previousPoint.timestamp
  const deltaDays = deltaMs / 86400000

  // Fail closed if timestamps are non-monotonic, identical, or invalid
  if (deltaDays <= 0 || !isFinite(deltaDays) || isNaN(deltaDays)) {
    return {
      key: metricKey,
      label,
      unit: targetUnit,
      current,
      previous,
      baseline,
      deltaFromPrevious,
      deltaFromBaseline,
      ratePerWeek: null,
      rateLabel: 'Insufficient data',
      trendStatus: 'insufficient_data',
      observationsCount: count,
      points,
      deltaDays: deltaDays <= 0 ? deltaDays : null
    }
  }

  // Canonical formula:
  // ratePerWeek = ((currentValue - previousValue) / deltaDays) * 7
  const rawRate = ((current - previous) / deltaDays) * 7

  if (isNaN(rawRate) || !isFinite(rawRate)) {
    return {
      key: metricKey,
      label,
      unit: targetUnit,
      current,
      previous,
      baseline,
      deltaFromPrevious,
      deltaFromBaseline,
      ratePerWeek: null,
      rateLabel: 'Insufficient data',
      trendStatus: 'insufficient_data',
      observationsCount: count,
      points,
      deltaDays: Number(deltaDays.toFixed(1))
    }
  }

  // Round to 2 decimal places to eliminate IEEE-754 precision artifacts
  let ratePerWeek = Number(rawRate.toFixed(2))
  if (Object.is(ratePerWeek, -0) || Math.abs(ratePerWeek) === 0) {
    ratePerWeek = 0
  }

  let trendStatus: TrendStatus = 'stable'
  if (ratePerWeek > 0) {
    trendStatus = 'increasing'
  } else if (ratePerWeek < 0) {
    trendStatus = 'decreasing'
  }

  const rateLabel = formatRateLabel(ratePerWeek, targetUnit)

  return {
    key: metricKey,
    label,
    unit: targetUnit,
    current,
    previous,
    baseline,
    deltaFromPrevious,
    deltaFromBaseline,
    ratePerWeek,
    rateLabel,
    trendStatus,
    observationsCount: count,
    points,
    deltaDays: Number(deltaDays.toFixed(1))
  }
}

/**
 * Calculates trend analytics for all 5 canonical body metrics simultaneously.
 */
export function calculateAllMetricTrends(
  entries: readonly BodyMeasurementEntry[] | BodyMeasurementEntry[],
  targetUnit: MetricUnit = 'cm'
): Record<BodyMetricKey, MetricTrendAnalysis> {
  const keys: BodyMetricKey[] = ['waist', 'chest', 'arms', 'thighs', 'hips']
  const result: Partial<Record<BodyMetricKey, MetricTrendAnalysis>> = {}

  for (const key of keys) {
    result[key] = calculateMetricTrend(entries, key, targetUnit)
  }

  return result as Record<BodyMetricKey, MetricTrendAnalysis>
}
