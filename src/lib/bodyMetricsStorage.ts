import type {
  BodyMeasurementEntry,
  BodyMetricDelta,
  BodyMetricKey,
  MetricUnit
} from '@/types/bodyMetrics'

export const BODY_METRICS_STORAGE_KEY = 'bodymap_body_metrics'
export const BODY_METRICS_UNIT_KEY = 'bodymap_body_metrics_unit'

export const METRIC_LABELS: Record<BodyMetricKey, string> = {
  waist: 'Waist',
  chest: 'Chest',
  arms: 'Arms (Biceps)',
  thighs: 'Thighs',
  hips: 'Hips'
}

/**
 * Converts length between cm and inches with standard rounding to 1 decimal place.
 * 1 in = 2.54 cm
 */
export function convertLength(value: number, from: MetricUnit, to: MetricUnit): number {
  if (from === to) return Number(value.toFixed(1))
  if (from === 'cm' && to === 'in') {
    return Number((value / 2.54).toFixed(1))
  }
  if (from === 'in' && to === 'cm') {
    return Number((value * 2.54).toFixed(1))
  }
  return Number(value.toFixed(1))
}

/**
 * Loads all body measurements from localStorage, chronologically sorted (newest first).
 */
export function loadBodyMetrics(): BodyMeasurementEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return []
  }

  try {
    const raw = localStorage.getItem(BODY_METRICS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const validEntries: BodyMeasurementEntry[] = []

    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.date === 'string'
      ) {
        const unit: MetricUnit = item.unit === 'in' ? 'in' : 'cm'
        validEntries.push({
          id: item.id,
          date: item.date,
          timestamp: typeof item.timestamp === 'number' ? item.timestamp : new Date(item.date).getTime() || Date.now(),
          unit,
          waist: typeof item.waist === 'number' && item.waist > 0 ? Number(item.waist.toFixed(1)) : undefined,
          chest: typeof item.chest === 'number' && item.chest > 0 ? Number(item.chest.toFixed(1)) : undefined,
          arms: typeof item.arms === 'number' && item.arms > 0 ? Number(item.arms.toFixed(1)) : undefined,
          thighs: typeof item.thighs === 'number' && item.thighs > 0 ? Number(item.thighs.toFixed(1)) : undefined,
          hips: typeof item.hips === 'number' && item.hips > 0 ? Number(item.hips.toFixed(1)) : undefined,
          notes: typeof item.notes === 'string' ? item.notes.trim() : undefined
        })
      }
    }

    // Sort descending by date/timestamp
    return validEntries.sort((a, b) => b.timestamp - a.timestamp)
  } catch (err) {
    console.error('Error loading body metrics:', err)
    return []
  }
}

/**
 * Persists the entire array of body measurements.
 */
export function persistBodyMetrics(entries: BodyMeasurementEntry[]): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false
  }

  try {
    const serialized = JSON.stringify(entries)
    localStorage.setItem(BODY_METRICS_STORAGE_KEY, serialized)
    return true
  } catch (err) {
    console.error('Error persisting body metrics:', err)
    return false
  }
}

/**
 * Adds a new body measurement entry.
 */
export function saveBodyMeasurement(
  entry: Omit<BodyMeasurementEntry, 'id' | 'timestamp'>
): BodyMeasurementEntry {
  const current = loadBodyMetrics()
  const timestamp = new Date(entry.date).getTime() || Date.now()
  const newEntry: BodyMeasurementEntry = {
    ...entry,
    id: `bm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp
  }

  // Deduplicate/replace same-day entry if existing, otherwise prepend
  const filtered = current.filter(e => e.date !== newEntry.date)
  const updated = [newEntry, ...filtered].sort((a, b) => b.timestamp - a.timestamp)
  persistBodyMetrics(updated)
  return newEntry
}

/**
 * Deletes a body measurement entry by ID.
 */
export function deleteBodyMeasurement(id: string): boolean {
  const current = loadBodyMetrics()
  const filtered = current.filter(e => e.id !== id)
  if (filtered.length === current.length) return false
  return persistBodyMetrics(filtered)
}

/**
 * Calculates current values, previous values, and deltas across all metric keys.
 *
 * Delta Semantics:
 * - `deltaFromPrevious`: Current value minus the immediately preceding historical measurement.
 * - `deltaFromBaseline`: Current value minus the very first historical baseline measurement.
 * Both values are converted to `targetUnit` before calculation.
 */
export function calculateBodyMetricDeltas(
  entries: BodyMeasurementEntry[],
  targetUnit: MetricUnit = 'cm'
): Record<BodyMetricKey, BodyMetricDelta> {
  const keys: BodyMetricKey[] = ['waist', 'chest', 'arms', 'thighs', 'hips']
  const result: Partial<Record<BodyMetricKey, BodyMetricDelta>> = {}

  // Chronological order (oldest to newest)
  const chronological = [...entries].sort((a, b) => a.timestamp - b.timestamp)

  for (const key of keys) {
    const validValues = chronological
      .map(entry => {
        const val = entry[key]
        if (typeof val !== 'number' || isNaN(val) || val <= 0) return null
        return convertLength(val, entry.unit, targetUnit)
      })
      .filter((v): v is number => v !== null)

    if (validValues.length === 0) {
      result[key] = {
        key,
        label: METRIC_LABELS[key],
        current: null,
        previous: null,
        baseline: null,
        deltaFromPrevious: null,
        deltaFromBaseline: null,
        unit: targetUnit
      }
      continue
    }

    const baseline = validValues[0]
    const current = validValues[validValues.length - 1]
    const previous = validValues.length > 1 ? validValues[validValues.length - 2] : null

    const deltaFromPrevious = previous !== null ? Number((current - previous).toFixed(1)) : null
    const deltaFromBaseline = Number((current - baseline).toFixed(1))

    result[key] = {
      key,
      label: METRIC_LABELS[key],
      current,
      previous,
      baseline,
      deltaFromPrevious,
      deltaFromBaseline,
      unit: targetUnit
    }
  }

  return result as Record<BodyMetricKey, BodyMetricDelta>
}

/**
 * Clears all body metrics (used during atomic restore / reset).
 */
export function clearBodyMetrics(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(BODY_METRICS_STORAGE_KEY)
  }
}
