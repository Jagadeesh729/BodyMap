import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadBodyMetrics,
  saveBodyMeasurement,
  deleteBodyMeasurement,
  calculateBodyMetricDeltas,
  convertLength,
  clearBodyMetrics,
  BODY_METRICS_STORAGE_KEY
} from '@/lib/bodyMetricsStorage'

describe('Body Composition & Metrics Storage Suite', () => {
  beforeEach(() => {
    clearBodyMetrics()
  })

  it('converts length correctly between cm and inches', () => {
    // 1 in = 2.54 cm
    expect(convertLength(25.4, 'cm', 'in')).toBe(10)
    expect(convertLength(10, 'in', 'cm')).toBe(25.4)
    expect(convertLength(85, 'cm', 'cm')).toBe(85)
  })

  it('saves and loads body measurements chronologically', () => {
    saveBodyMeasurement({
      date: '2026-08-01',
      unit: 'cm',
      waist: 88,
      chest: 100,
      arms: 34
    })

    saveBodyMeasurement({
      date: '2026-08-15',
      unit: 'cm',
      waist: 86,
      chest: 101,
      arms: 35
    })

    const all = loadBodyMetrics()
    expect(all.length).toBe(2)
    expect(all[0].date).toBe('2026-08-15')
    expect(all[1].date).toBe('2026-08-01')
  })

  it('deduplicates same-day measurements by updating entry', () => {
    saveBodyMeasurement({
      date: '2026-08-20',
      unit: 'cm',
      waist: 85
    })

    saveBodyMeasurement({
      date: '2026-08-20',
      unit: 'cm',
      waist: 84.5,
      chest: 102
    })

    const all = loadBodyMetrics()
    expect(all.length).toBe(1)
    expect(all[0].waist).toBe(84.5)
    expect(all[0].chest).toBe(102)
  })

  it('calculates deltas from previous and baseline accurately', () => {
    saveBodyMeasurement({
      date: '2026-08-01',
      unit: 'cm',
      waist: 90,
      arms: 34
    })

    saveBodyMeasurement({
      date: '2026-08-10',
      unit: 'cm',
      waist: 88,
      arms: 34.5
    })

    saveBodyMeasurement({
      date: '2026-08-20',
      unit: 'cm',
      waist: 86,
      arms: 35
    })

    const all = loadBodyMetrics()
    const deltas = calculateBodyMetricDeltas(all, 'cm')

    // Waist: Baseline = 90, Prev = 88, Current = 86 -> deltaFromPrev = -2, deltaFromBase = -4
    expect(deltas.waist.current).toBe(86)
    expect(deltas.waist.previous).toBe(88)
    expect(deltas.waist.baseline).toBe(90)
    expect(deltas.waist.deltaFromPrevious).toBe(-2)
    expect(deltas.waist.deltaFromBaseline).toBe(-4)

    // Arms: Baseline = 34, Prev = 34.5, Current = 35 -> deltaFromPrev = +0.5, deltaFromBase = +1
    expect(deltas.arms.current).toBe(35)
    expect(deltas.arms.previous).toBe(34.5)
    expect(deltas.arms.baseline).toBe(34)
    expect(deltas.arms.deltaFromPrevious).toBe(0.5)
    expect(deltas.arms.deltaFromBaseline).toBe(1)

    // Thighs: not logged -> null
    expect(deltas.thighs.current).toBeNull()
    expect(deltas.thighs.deltaFromPrevious).toBeNull()
  })

  it('deletes an entry by ID', () => {
    const entry = saveBodyMeasurement({
      date: '2026-08-12',
      unit: 'cm',
      waist: 85
    })
    expect(loadBodyMetrics().length).toBe(1)

    deleteBodyMeasurement(entry.id)
    expect(loadBodyMetrics().length).toBe(0)
  })

  it('safely handles corrupted localStorage items', () => {
    localStorage.setItem(
      BODY_METRICS_STORAGE_KEY,
      JSON.stringify([
        { id: 'bm_1', date: '2026-08-10', unit: 'cm', waist: 85 },
        null,
        'corrupted',
        { id: null }
      ])
    )

    const all = loadBodyMetrics()
    expect(all.length).toBe(1)
    expect(all[0].id).toBe('bm_1')
  })
})
