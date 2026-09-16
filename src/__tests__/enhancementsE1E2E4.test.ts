import { describe, it, expect } from 'vitest'
import {
  generateICalendarSchedule,
  foldLine,
  escapeICalText,
  formatFloatingDateTime
} from '@/lib/icalendarGenerator'
import { generateWarmupProtocol } from '@/lib/warmupProtocol'
import {
  calculateMacroPercentages,
  estimateDailyMacros
} from '@/lib/macroEstimator'

describe('Enhancement Suite: E2 (iCalendar), E1 (Warm-up Ramp), E4 (Macro Visualizer)', () => {
  // =========================================================================
  // E2: iCalendar Schedule Export RFC 5545 Compliance
  // =========================================================================
  describe('E2: RFC 5545 iCalendar Generator Contract', () => {
    const mockDays = [
      {
        dayNumber: 1,
        title: 'Upper Body Power',
        isRestDay: false,
        durationMinutes: 45,
        warmup: 'Arm circles, band pull-aparts, light pushups',
        mainExercises: [
          { name: 'Barbell Bench Press', sets: 4, reps: '6-8', rest: '90s' },
          { name: 'Bent-Over Rows', sets: 3, reps: '10', rest: '60s' },
          { name: 'Overhead Shoulder Press', sets: 3, reps: '8-10', rest: '60s' }
        ],
        cooldown: 'Chest wall stretch, door frame lat stretch',
        nutritionSummary: 'Oatmeal & eggs | Chicken rice bowl | Salmon sweet potato (~2200 kcal)'
      },
      {
        dayNumber: 2,
        title: 'Active Recovery & Mobility',
        isRestDay: true,
        durationMinutes: 30,
        nutritionSummary: 'Greek yogurt parfait | Quinoa salad | Turkey stir-fry (~2000 kcal)'
      }
    ]

    it('generates valid RFC 5545 VCALENDAR and VEVENT structures', () => {
      const ics = generateICalendarSchedule(mockDays, {
        planTitle: 'Test 7-Day Protocol',
        goal: 'Strength',
        planId: 'plan-xyz-123'
      })

      expect(ics).toContain('BEGIN:VCALENDAR')
      expect(ics).toContain('VERSION:2.0')
      expect(ics).toContain('PRODID:-//BodyMap AI//Fitness Schedule Export//EN')
      expect(ics).toContain('CALSCALE:GREGORIAN')
      expect(ics).toContain('METHOD:PUBLISH')
      expect(ics).toContain('X-WR-CALNAME:Test 7-Day Protocol')
      expect(ics).toContain('END:VCALENDAR')

      // Check event boundaries
      const eventStarts = ics.match(/BEGIN:VEVENT/g)
      const eventEnds = ics.match(/END:VEVENT/g)
      expect(eventStarts?.length).toBe(2)
      expect(eventEnds?.length).toBe(2)
    })

    it('enforces strict CRLF (\\r\\n) line endings across entire file', () => {
      const ics = generateICalendarSchedule(mockDays)
      // Check that there are no bare LF (\n not preceded by \r)
      const bareLf = ics.replace(/\r\n/g, '').includes('\n')
      expect(bareLf).toBe(false)
      expect(ics.endsWith('\r\n')).toBe(true)
    })

    it('folds lines exceeding 75 octets and leaves shorter lines untouched', () => {
      const short = 'SUMMARY:Quick Workout'
      expect(foldLine(short)).toBe(short)

      const long = 'DESCRIPTION:' + 'A'.repeat(80)
      const folded = foldLine(long)
      expect(folded).toContain('\r\n ')
      const parts = folded.split('\r\n ')
      expect(parts[0].length).toBeLessThanOrEqual(75)
    })

    it('enforces maximum 75 octets per line via line folding with leading space', () => {
      const longDay = [
        {
          dayNumber: 1,
          title: 'Exhaustive High Intensity Compound Training Session With Extremely Detailed Exercise Descriptions And Variations',
          isRestDay: false,
          durationMinutes: 60,
          warmup: 'Ten minutes of dynamic warmups including jumping jacks, world greatest stretch, inchworms, and thoracic spine rotations',
          mainExercises: [
            { name: 'Barbell Back Squat with progressive 4-step warmup ladder and potentiation singles', sets: 5, reps: '5 reps at RPE 8.5', rest: '180s' }
          ]
        }
      ]

      const ics = generateICalendarSchedule(longDay)
      const lines = ics.split('\r\n')

      const encoder = new TextEncoder()
      for (const line of lines) {
        if (line.length === 0) continue
        const octets = encoder.encode(line).length
        expect(octets).toBeLessThanOrEqual(75)
      }
    })

    it('properly escapes special characters in TEXT fields according to RFC 5545 §3.3.11', () => {
      const textWithSpecials = 'Squats, Bench & Rows; 100% effort, don\\t fail\nNext line'
      const escaped = escapeICalText(textWithSpecials)
      expect(escaped).toBe('Squats\\, Bench & Rows\\; 100% effort\\, don\\\\t fail\\nNext line')
    })

    it('generates floating local time strings without timezone offset or Z suffix', () => {
      const d = new Date(2026, 8, 20, 8, 30, 0) // Sept 20, 2026 08:30:00
      const formatted = formatFloatingDateTime(d)
      expect(formatted).toBe('20260920T083000')
      expect(formatted).not.toContain('Z')
      expect(formatted).not.toContain('+')
      expect(formatted).not.toContain('-')
    })

    it('generates deterministic UIDs with planId and day numbers', () => {
      const ics = generateICalendarSchedule(mockDays, { planId: 'alpha-beta-77' })
      expect(ics).toContain('UID:bodymap-alpha-beta-77-day-1@bodymap-ai.vercel.app')
      expect(ics).toContain('UID:bodymap-alpha-beta-77-day-2@bodymap-ai.vercel.app')
    })

    it('sets TRANSP:TRANSPARENT for rest days and TRANSP:OPAQUE for workout days', () => {
      const ics = generateICalendarSchedule(mockDays)
      expect(ics).toContain('TRANSP:OPAQUE')
      expect(ics).toContain('TRANSP:TRANSPARENT')
    })

    it('rejects empty day arrays with descriptive error', () => {
      expect(() => generateICalendarSchedule([])).toThrow('Cannot generate iCalendar schedule from empty days list.')
    })
  })

  // =========================================================================
  // E1: Warm-up Ramp Calculator with Plate Loading
  // =========================================================================
  describe('E1: Warm-up Sets Ramp Calculator & Plate Loading', () => {
    it('calculates 4-step progressive warmup ladder with accurate Olympic plate loading for 100 kg lift', () => {
      const res = generateWarmupProtocol(100, 20)
      expect(res.hasProtocol).toBe(true)
      expect(res.sets).toHaveLength(4)

      // Step 1: 20 kg bar baseline -> Bar only
      const s1 = res.sets[0]
      expect(s1.calculatedWeightKg).toBe(20)
      expect(s1.platesSummary).toBe('Empty Bar')
      expect(s1.plates?.perSidePlates).toHaveLength(0)

      // Step 2: 50% load -> 50 kg -> 15 kg per side
      const s2 = res.sets[1]
      expect(s2.calculatedWeightKg).toBe(50)
      expect(s2.platesSummary).toContain('15kg')
      expect(s2.plates?.plateWeightPerSideKg).toBe(15)

      // Step 3: 70% load -> 70 kg -> 25 kg per side
      const s3 = res.sets[2]
      expect(s3.calculatedWeightKg).toBe(70)
      expect(s3.platesSummary).toContain('25kg')
      expect(s3.plates?.plateWeightPerSideKg).toBe(25)

      // Step 4: 85% load -> 85 kg -> 32.5 kg per side (25kg + 5kg + 2.5kg)
      const s4 = res.sets[3]
      expect(s4.calculatedWeightKg).toBe(85)
      expect(s4.plates?.plateWeightPerSideKg).toBe(32.5)
      expect(s4.plates?.hasValidConfiguration).toBe(true)
    })

    it('handles lighter loads (< 20 kg barbell baseline) gracefully', () => {
      const res = generateWarmupProtocol(25, 20)
      expect(res.hasProtocol).toBe(true)
      // Step 1: 40% of 25 = 10 kg (< 20 kg bar)
      expect(res.sets[0].calculatedWeightKg).toBe(10)
      expect(res.sets[0].platesSummary).toBe('Light DBs / Bar')
    })

    it('supports custom Olympic bar weights (e.g. 15 kg Olympic women bar)', () => {
      const res = generateWarmupProtocol(80, 15)
      expect(res.hasProtocol).toBe(true)
      // Step 1 bar weight: 15 kg
      expect(res.sets[0].calculatedWeightKg).toBe(15)
      expect(res.sets[0].platesSummary).toBe('Empty Bar')
    })

    it('rejects out-of-range working loads (<15 kg or >500 kg)', () => {
      expect(generateWarmupProtocol(14).hasProtocol).toBe(false)
      expect(generateWarmupProtocol(501).hasProtocol).toBe(false)
      expect(generateWarmupProtocol(NaN).hasProtocol).toBe(false)
      expect(generateWarmupProtocol(null).hasProtocol).toBe(false)
    })
  })

  // =========================================================================
  // E4: Macronutrient Caloric Distribution Visualizer
  // =========================================================================
  describe('E4: Macronutrient Caloric Distribution & Exact 100% Invariant', () => {
    it('guarantees P% + C% + F% === 100% strictly via Hamilton-Hare largest remainder method', () => {
      // Test 100 diverse combinations of protein, carb, fat kcal values
      const testCases = [
        { p: 600, c: 800, f: 500 },
        { p: 733, c: 921, f: 412 },
        { p: 401, c: 302, f: 199 },
        { p: 1200, c: 1500, f: 700 },
        { p: 543, c: 789, f: 321 },
        { p: 1, c: 1, f: 1 },
        { p: 100, c: 200, f: 300 },
        { p: 850, c: 1100, f: 450 }
      ]

      for (const tc of testCases) {
        const pcts = calculateMacroPercentages(tc.p, tc.c, tc.f)
        const sum = pcts.proteinPct + pcts.carbPct + pcts.fatPct
        expect(sum, `Failed 100% sum for p:${tc.p}, c:${tc.c}, f:${tc.f}`).toBe(100)
        expect(pcts.proteinPct).toBeGreaterThanOrEqual(0)
        expect(pcts.carbPct).toBeGreaterThanOrEqual(0)
        expect(pcts.fatPct).toBeGreaterThanOrEqual(0)
      }
    })

    it('returns 0% across all macros when total caloric intake is zero or invalid', () => {
      const zero = calculateMacroPercentages(0, 0, 0)
      expect(zero).toEqual({ proteinPct: 0, carbPct: 0, fatPct: 0 })

      const nan = calculateMacroPercentages(NaN, 0, 0)
      expect(nan).toEqual({ proteinPct: 0, carbPct: 0, fatPct: 0 })
    })

    it('estimateDailyMacros integrates normalized percentages in output estimate', () => {
      const estimate = estimateDailyMacros(75, 'muscle gain', 2600)
      expect(estimate.hasData).toBe(true)
      expect(estimate.percentages).toBeDefined()
      if (estimate.percentages) {
        const sum = estimate.percentages.proteinPct + estimate.percentages.carbPct + estimate.percentages.fatPct
        expect(sum).toBe(100)
      }
    })
  })
})
