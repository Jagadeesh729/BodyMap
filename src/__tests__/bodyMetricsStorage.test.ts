import { describe, it, expect, beforeEach, vi } from 'vitest'
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

    const result = deleteBodyMeasurement(entry.id)
    expect(result).toBe(true)
    expect(loadBodyMetrics().length).toBe(0)
  })

  it('safely handles corrupted localStorage items', () => {
    localStorage.setItem(
      BODY_METRICS_STORAGE_KEY,
      JSON.stringify([
        { id: 'bm_1', date: '2026-08-10', unit: 'cm', waist: 85 },
        null,
        'corrupted',
        { id: null },
        { id: '   ', date: '2026-08-11', unit: 'cm' }
      ])
    )

    const all = loadBodyMetrics()
    expect(all.length).toBe(1)
    expect(all[0].id).toBe('bm_1')
  })

  describe('E27-C Canonical Deletion & Pruning Suite (U1–U15)', () => {
    it('U1: deletes a valid record by canonical identifier and returns true', () => {
      const entry = saveBodyMeasurement({
        date: '2026-08-05',
        unit: 'cm',
        waist: 82
      })
      expect(loadBodyMetrics().some(e => e.id === entry.id)).toBe(true)

      const success = deleteBodyMeasurement(entry.id)
      expect(success).toBe(true)
      expect(loadBodyMetrics().some(e => e.id === entry.id)).toBe(false)
    })

    it('U2: deletes the newest record in multi-record history', () => {
      const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
      const e2 = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 81 })
      const e3 = saveBodyMeasurement({ date: '2026-08-20', unit: 'cm', waist: 82 })

      const metricsBefore = loadBodyMetrics()
      expect(metricsBefore[0].id).toBe(e3.id) // newest

      const success = deleteBodyMeasurement(e3.id)
      expect(success).toBe(true)

      const metricsAfter = loadBodyMetrics()
      expect(metricsAfter.length).toBe(2)
      expect(metricsAfter[0].id).toBe(e2.id)
      expect(metricsAfter[1].id).toBe(e1.id)
    })

    it('U3: deletes the oldest record in multi-record history', () => {
      const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
      const e2 = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 81 })
      const e3 = saveBodyMeasurement({ date: '2026-08-20', unit: 'cm', waist: 82 })

      const success = deleteBodyMeasurement(e1.id)
      expect(success).toBe(true)

      const metricsAfter = loadBodyMetrics()
      expect(metricsAfter.length).toBe(2)
      expect(metricsAfter[0].id).toBe(e3.id)
      expect(metricsAfter[1].id).toBe(e2.id)
    })

    it('U4: deletes the middle record in multi-record history', () => {
      const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
      const e2 = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 81 })
      const e3 = saveBodyMeasurement({ date: '2026-08-20', unit: 'cm', waist: 82 })

      const success = deleteBodyMeasurement(e2.id)
      expect(success).toBe(true)

      const metricsAfter = loadBodyMetrics()
      expect(metricsAfter.length).toBe(2)
      expect(metricsAfter[0].id).toBe(e3.id)
      expect(metricsAfter[1].id).toBe(e1.id)
    })

    it('U5: deletes the only remaining record returning to empty state', () => {
      const entry = saveBodyMeasurement({ date: '2026-08-15', unit: 'cm', waist: 85 })
      expect(loadBodyMetrics().length).toBe(1)

      const success = deleteBodyMeasurement(entry.id)
      expect(success).toBe(true)
      expect(loadBodyMetrics()).toEqual([])
    })

    it('U6: deleting a nonexistent or malformed ID returns false without mutating state', () => {
      const entry = saveBodyMeasurement({ date: '2026-08-15', unit: 'cm', waist: 85 })
      expect(deleteBodyMeasurement('nonexistent_id')).toBe(false)
      expect(deleteBodyMeasurement('')).toBe(false)
      expect(deleteBodyMeasurement('   ')).toBe(false)
      expect(deleteBodyMeasurement(null as unknown as string)).toBe(false)
      expect(deleteBodyMeasurement(undefined as unknown as string)).toBe(false)
      expect(loadBodyMetrics().length).toBe(1)
      expect(loadBodyMetrics()[0].id).toBe(entry.id)
    })

    it('U7: deleting one record leaves every unrelated record intact', () => {
      const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80, chest: 100 })
      const e2 = saveBodyMeasurement({ date: '2026-08-02', unit: 'in', waist: 32, hips: 38 })
      const e3 = saveBodyMeasurement({ date: '2026-08-03', unit: 'cm', arms: 36, notes: 'Felt strong' })

      deleteBodyMeasurement(e2.id)

      const remaining = loadBodyMetrics()
      expect(remaining.length).toBe(2)
      const foundE1 = remaining.find(e => e.id === e1.id)
      const foundE3 = remaining.find(e => e.id === e3.id)
      expect(foundE1).toBeDefined()
      expect(foundE1?.waist).toBe(80)
      expect(foundE1?.chest).toBe(100)
      expect(foundE3).toBeDefined()
      expect(foundE3?.arms).toBe(36)
      expect(foundE3?.notes).toBe('Felt strong')
    })

    it('U8: duplicate-date records with different IDs remain independently deletable', () => {
      // Direct raw storage with same date but distinct IDs
      const rawRecords = [
        { id: 'bm_dup_1', date: '2026-08-10', timestamp: 1000, unit: 'cm', waist: 80 },
        { id: 'bm_dup_2', date: '2026-08-10', timestamp: 1001, unit: 'cm', waist: 81 }
      ]
      localStorage.setItem(BODY_METRICS_STORAGE_KEY, JSON.stringify(rawRecords))
      expect(loadBodyMetrics().length).toBe(2)

      // Delete only the first duplicate
      const success = deleteBodyMeasurement('bm_dup_1')
      expect(success).toBe(true)

      const remaining = loadBodyMetrics()
      expect(remaining.length).toBe(1)
      expect(remaining[0].id).toBe('bm_dup_2')
      expect(remaining[0].waist).toBe(81)
    })

    it('U9: malformed stored data does not crash deletion', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      localStorage.setItem(BODY_METRICS_STORAGE_KEY, 'invalid json string')
      expect(() => deleteBodyMeasurement('any_id')).not.toThrow()
      expect(deleteBodyMeasurement('any_id')).toBe(false)
      consoleSpy.mockRestore()
    })

    it('U10: storage read failure is handled safely without throwing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('Storage read security violation')
      })
      expect(() => loadBodyMetrics()).not.toThrow()
      expect(loadBodyMetrics()).toEqual([])
      getItemSpy.mockRestore()
      consoleSpy.mockRestore()
    })

    it('U11: storage write failure is handled safely and returns false', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('Storage write failure')
      })
      const metrics = loadBodyMetrics()
      const success = deleteBodyMeasurement(metrics[0].id)
      expect(success).toBe(false)
      setItemSpy.mockRestore()
      consoleSpy.mockRestore()
    })

    it('U12: quota/storage exceptions do not crash the application', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        const err = new Error('QuotaExceededError')
        err.name = 'QuotaExceededError'
        throw err
      })
      const metrics = loadBodyMetrics()
      expect(() => deleteBodyMeasurement(metrics[0].id)).not.toThrow()
      setItemSpy.mockRestore()
      consoleSpy.mockRestore()
    })

    it('U13: derived record ordering remains deterministic after deletions', () => {
      saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
      const e2 = saveBodyMeasurement({ date: '2026-08-05', unit: 'cm', waist: 81 })
      saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 82 })
      saveBodyMeasurement({ date: '2026-08-15', unit: 'cm', waist: 83 })

      deleteBodyMeasurement(e2.id)

      const remaining = loadBodyMetrics()
      expect(remaining.map(r => r.date)).toEqual(['2026-08-15', '2026-08-10', '2026-08-01'])
    })

    it('U14: no duplicate deletion occurs from repeated invocation', () => {
      const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
      saveBodyMeasurement({ date: '2026-08-02', unit: 'cm', waist: 81 })

      const firstCall = deleteBodyMeasurement(e1.id)
      expect(firstCall).toBe(true)

      const secondCall = deleteBodyMeasurement(e1.id)
      expect(secondCall).toBe(false)

      expect(loadBodyMetrics().length).toBe(1)
    })

    it('U15: canonical storage contains exactly the expected remaining records', () => {
      const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
      const e2 = saveBodyMeasurement({ date: '2026-08-02', unit: 'cm', waist: 81 })
      const e3 = saveBodyMeasurement({ date: '2026-08-03', unit: 'cm', waist: 82 })

      deleteBodyMeasurement(e1.id)
      deleteBodyMeasurement(e3.id)

      const raw = localStorage.getItem(BODY_METRICS_STORAGE_KEY)
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed.length).toBe(1)
      expect(parsed[0].id).toBe(e2.id)
      expect(parsed[0].date).toBe('2026-08-02')
    })
  })
})
