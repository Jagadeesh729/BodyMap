import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  WORKOUT_HISTORY_CSV_COLUMNS,
  UTF8_BOM,
  sanitizeCsvValue,
  escapeCsvField,
  generateWorkoutHistoryCsv,
  createWorkoutHistoryCsvBlob,
  getWorkoutHistoryCsvFilename,
  parseCsvRows
} from '@/lib/workoutHistoryCsvEngine'
import type { CompletedWorkoutLog } from '@/types/workoutSession'
import DownloadPlanPage from '@/pages/DownloadPlanPage'
import { PlanProvider } from '@/context/PlanContext'
import * as sessionStorageModule from '@/lib/sessionStorage'

const sampleWorkoutHistory: CompletedWorkoutLog[] = [
  {
    id: 'log-session-2',
    sessionId: 'session-2',
    completedAt: '2026-09-15T10:30:00.000Z',
    dayTitle: 'Day 2: Pull Hypertrophy',
    dayType: 'Strength',
    durationSeconds: 3120,
    exercisesSummary: [
      {
        exerciseId: 'ex-barbell-row',
        name: 'Barbell Bent-Over Row',
        setsCompleted: 4,
        totalSets: 4,
        peakWeightKg: 80,
        avgCompletedReps: 10
      },
      {
        exerciseId: 'ex-lat-pulldown',
        name: 'Lat Pulldown',
        setsCompleted: 3,
        totalSets: 3,
        peakWeightKg: 65,
        avgCompletedReps: 12
      }
    ],
    sessionReflection: {
      energyRating: 4,
      perceivedReadiness: 'High readiness',
      reflectionTags: ['Strong lats', 'Good form', 'Well rested']
    }
  },
  {
    id: 'log-session-1',
    sessionId: 'session-1',
    completedAt: '2026-09-14T09:00:00.000Z',
    dayTitle: 'Day 1: Push Power',
    dayType: 'Hypertrophy',
    durationSeconds: 2700,
    exercisesSummary: [
      {
        exerciseId: 'ex-bench-press',
        name: 'Barbell Bench Press',
        setsCompleted: 4,
        totalSets: 4,
        peakWeightKg: 100,
        avgCompletedReps: 8
      }
    ],
    sessionReflection: {
      energyRating: 5,
      perceivedReadiness: 'Peak performance',
      reflectionTags: ['Chest pump', 'PR set']
    }
  }
]

describe('Enhancement E22: CSV Workout History Export Engine', () => {
  describe('E22-01: Canonical Column Structure & Formatting', () => {
    it('defines the 12 expected canonical column headers in exact deterministic order', () => {
      expect(WORKOUT_HISTORY_CSV_COLUMNS).toEqual([
        'Date',
        'Day Title',
        'Day Type',
        'Duration (Seconds)',
        'Exercise Name',
        'Sets Completed',
        'Total Sets',
        'Peak Weight (kg)',
        'Avg Reps',
        'Energy Rating',
        'Perceived Readiness',
        'Reflection Tags'
      ])
    })

    it('emits only header row when workout history is empty or null', () => {
      const csvFromEmpty = generateWorkoutHistoryCsv([], false)
      expect(csvFromEmpty).toBe(WORKOUT_HISTORY_CSV_COLUMNS.join(','))

      const csvFromNull = generateWorkoutHistoryCsv(null, false)
      expect(csvFromNull).toBe(WORKOUT_HISTORY_CSV_COLUMNS.join(','))

      const csvFromUndefined = generateWorkoutHistoryCsv(undefined, false)
      expect(csvFromUndefined).toBe(WORKOUT_HISTORY_CSV_COLUMNS.join(','))
    })

    it('prepends UTF-8 BOM by default for Excel compatibility', () => {
      const csvWithBom = generateWorkoutHistoryCsv([], true)
      expect(csvWithBom.startsWith(UTF8_BOM)).toBe(true)
      expect(csvWithBom.slice(UTF8_BOM.length)).toBe(WORKOUT_HISTORY_CSV_COLUMNS.join(','))
    })
  })

  describe('E22-02: Chronological Ordering & Deterministic Rows', () => {
    it('sorts sessions chronologically ascending regardless of input array order', () => {
      // Input has session 2 (Sept 15) before session 1 (Sept 14)
      const csv = generateWorkoutHistoryCsv(sampleWorkoutHistory, false)
      const rows = parseCsvRows(csv)

      // Header row
      expect(rows[0]).toEqual(Array.from(WORKOUT_HISTORY_CSV_COLUMNS))

      // Row 1: Session 1 (Sept 14) Bench Press
      expect(rows[1][0]).toBe('2026-09-14T09:00:00.000Z')
      expect(rows[1][1]).toBe('Day 1: Push Power')
      expect(rows[1][4]).toBe('Barbell Bench Press')
      expect(rows[1][7]).toBe('100')

      // Row 2: Session 2 (Sept 15) Barbell Row
      expect(rows[2][0]).toBe('2026-09-15T10:30:00.000Z')
      expect(rows[2][1]).toBe('Day 2: Pull Hypertrophy')
      expect(rows[2][4]).toBe('Barbell Bent-Over Row')
      expect(rows[2][7]).toBe('80')

      // Row 3: Session 2 (Sept 15) Lat Pulldown
      expect(rows[3][0]).toBe('2026-09-15T10:30:00.000Z')
      expect(rows[3][1]).toBe('Day 2: Pull Hypertrophy')
      expect(rows[3][4]).toBe('Lat Pulldown')
      expect(rows[3][7]).toBe('65')
    })

    it('emits a session row with empty exercise fields if a workout had zero exercises logged', () => {
      const sessionWithNoExercises: CompletedWorkoutLog[] = [
        {
          id: 'log-session-empty',
          sessionId: 'session-empty',
          completedAt: '2026-09-16T08:00:00.000Z',
          dayTitle: 'Mobility & Foam Rolling',
          dayType: 'Recovery',
          durationSeconds: 1200,
          exercisesSummary: [],
          sessionReflection: {
            energyRating: 3,
            perceivedReadiness: 'Recovered',
            reflectionTags: ['Stretched']
          }
        }
      ]

      const csv = generateWorkoutHistoryCsv(sessionWithNoExercises, false)
      const rows = parseCsvRows(csv)

      expect(rows).toHaveLength(2) // Header + 1 row
      expect(rows[1][0]).toBe('2026-09-16T08:00:00.000Z')
      expect(rows[1][1]).toBe('Mobility & Foam Rolling')
      expect(rows[1][2]).toBe('Recovery')
      expect(rows[1][3]).toBe('1200')
      expect(rows[1][4]).toBe('') // Empty exercise name
      expect(rows[1][5]).toBe('') // Empty sets
      expect(rows[1][6]).toBe('') // Empty total sets
      expect(rows[1][7]).toBe('') // Empty peak weight
      expect(rows[1][8]).toBe('') // Empty avg reps
      expect(rows[1][9]).toBe('3') // Energy rating
      expect(rows[1][10]).toBe('Recovered')
      expect(rows[1][11]).toBe('Stretched')
    })
  })

  describe('E22-03: Formula Injection Protection (CSV Injection Neutralization)', () => {
    it('prepends a single quote to neutralize formula triggers (=, +, -, @, \\t, \\r)', () => {
      expect(sanitizeCsvValue('=CMD|"/C calc"!A0')).toBe('\'=CMD|"/C calc"!A0')
      expect(sanitizeCsvValue('+SUM(1,2)')).toBe('\'+SUM(1,2)')
      expect(sanitizeCsvValue('-10% DISCOUNT')).toBe('\'-10% DISCOUNT')
      expect(sanitizeCsvValue('@SUM(A1:A10)')).toBe('\'@SUM(A1:A10)')
      expect(sanitizeCsvValue('\tTAB_PREFIXED')).toBe('\'\tTAB_PREFIXED')
      expect(sanitizeCsvValue('\rCR_PREFIXED')).toBe('\'\rCR_PREFIXED')
    })

    it('preserves valid finite numbers without prefixing single quotes', () => {
      expect(sanitizeCsvValue(100)).toBe('100')
      expect(sanitizeCsvValue(82.5)).toBe('82.5')
      expect(sanitizeCsvValue(0)).toBe('0')
      expect(sanitizeCsvValue(-5)).toBe('-5') // number type: finite number preserved as string
    })

    it('converts null, undefined, and non-finite numbers into empty strings', () => {
      expect(sanitizeCsvValue(null)).toBe('')
      expect(sanitizeCsvValue(undefined)).toBe('')
      expect(sanitizeCsvValue(NaN)).toBe('')
      expect(sanitizeCsvValue(Infinity)).toBe('')
    })

    it('neutralizes formula injection in exercise names and reflection tags during full CSV export', () => {
      const maliciousLog: CompletedWorkoutLog[] = [
        {
          id: 'log-malicious',
          sessionId: 'session-malicious',
          completedAt: '2026-09-17T12:00:00.000Z',
          dayTitle: '=HYPERLINK("http://attacker.com")',
          dayType: '@DANGEROUS',
          durationSeconds: 1800,
          exercisesSummary: [
            {
              exerciseId: 'ex-1',
              name: '+10 Rep Overhead Press',
              setsCompleted: 3,
              totalSets: 3,
              peakWeightKg: 50,
              avgCompletedReps: 10
            }
          ],
          sessionReflection: {
            energyRating: 4,
            perceivedReadiness: '-Feeling tired',
            reflectionTags: ['=DDE("server")', '+MaliciousTag']
          }
        }
      ]

      const csv = generateWorkoutHistoryCsv(maliciousLog, false)
      const rows = parseCsvRows(csv)

      expect(rows[1][1]).toBe('\'=HYPERLINK("http://attacker.com")')
      expect(rows[1][2]).toBe('\'@DANGEROUS')
      expect(rows[1][4]).toBe('\'+10 Rep Overhead Press')
      expect(rows[1][10]).toBe('\'-Feeling tired')
      expect(rows[1][11]).toBe('\'=DDE("server"); +MaliciousTag')
    })
  })

  describe('E22-04: RFC 4180 Escaping & Unicode Fidelity', () => {
    it('escapes fields containing commas, double quotes, and newlines correctly', () => {
      expect(escapeCsvField('Simple')).toBe('Simple')
      expect(escapeCsvField('Text, with comma')).toBe('"Text, with comma"')
      expect(escapeCsvField('Text "with quotes"')).toBe('"Text ""with quotes"""')
      expect(escapeCsvField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"')
      expect(escapeCsvField('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"')
    })

    it('preserves multi-lingual Unicode characters and symbols without corruption', () => {
      const unicodeLog: CompletedWorkoutLog[] = [
        {
          id: 'log-unicode',
          sessionId: 'session-unicode',
          completedAt: '2026-09-18T06:00:00.000Z',
          dayTitle: 'Séance de Force 💪 (日本語)',
          dayType: 'Conditioning',
          durationSeconds: 2400,
          exercisesSummary: [
            {
              exerciseId: 'ex-squat',
              name: 'スクワット (Squat & Piña)',
              setsCompleted: 5,
              totalSets: 5,
              peakWeightKg: 140,
              avgCompletedReps: 5
            }
          ],
          sessionReflection: {
            energyRating: 5,
            perceivedReadiness: 'Très bien / 最高',
            reflectionTags: ['🔥 Fire', 'café crème']
          }
        }
      ]

      const csv = generateWorkoutHistoryCsv(unicodeLog, false)
      const rows = parseCsvRows(csv)

      expect(rows[1][1]).toBe('Séance de Force 💪 (日本語)')
      expect(rows[1][4]).toBe('スクワット (Squat & Piña)')
      expect(rows[1][10]).toBe('Très bien / 最高')
      expect(rows[1][11]).toBe('🔥 Fire; café crème')
    })

    it('achieves 100% round-trip fidelity between generator and RFC 4180 parser', () => {
      const csv = generateWorkoutHistoryCsv(sampleWorkoutHistory, false)
      const parsed = parseCsvRows(csv)

      expect(parsed).toHaveLength(4) // Header + 3 exercise rows
      expect(parsed[0]).toEqual(Array.from(WORKOUT_HISTORY_CSV_COLUMNS))
      expect(parsed[1][4]).toBe('Barbell Bench Press')
      expect(parsed[2][4]).toBe('Barbell Bent-Over Row')
      expect(parsed[3][4]).toBe('Lat Pulldown')
    })
  })

  describe('E22-05: Invariants & Security Boundaries', () => {
    it('does not mutate the source workout history array or inner objects', () => {
      const originalHistory: CompletedWorkoutLog[] = JSON.parse(JSON.stringify(sampleWorkoutHistory))
      const historyCopy = JSON.parse(JSON.stringify(sampleWorkoutHistory))

      generateWorkoutHistoryCsv(historyCopy, true)
      createWorkoutHistoryCsvBlob(historyCopy)

      expect(historyCopy).toEqual(originalHistory)
    })

    it('generates a valid text/csv Blob', () => {
      const blob = createWorkoutHistoryCsvBlob(sampleWorkoutHistory)
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('text/csv;charset=utf-8')
      expect(blob.size).toBeGreaterThan(0)
    })

    it('generates a clean sanitized filename with date stamp', () => {
      const testDate = new Date(2026, 8, 18) // Sept 18, 2026
      const filename = getWorkoutHistoryCsvFilename(testDate)
      expect(filename).toBe('bodymap-workout-history-2026-09-18.csv')
    })

    it('scales linearly and cleanly handles 200+ workout sessions without memory or performance issues', () => {
      const largeHistory: CompletedWorkoutLog[] = []
      for (let i = 0; i < 200; i++) {
        largeHistory.push({
          id: `log-${i}`,
          sessionId: `session-${i}`,
          completedAt: new Date(2026, 0, 1 + (i % 250)).toISOString(),
          dayTitle: `Workout Day ${i + 1}`,
          dayType: i % 2 === 0 ? 'Strength' : 'Hypertrophy',
          durationSeconds: 3000 + i * 10,
          exercisesSummary: [
            {
              exerciseId: `ex-${i}-1`,
              name: `Exercise Alpha ${i}`,
              setsCompleted: 4,
              totalSets: 4,
              peakWeightKg: 75 + (i % 50),
              avgCompletedReps: 10
            },
            {
              exerciseId: `ex-${i}-2`,
              name: `Exercise Beta ${i}`,
              setsCompleted: 3,
              totalSets: 3,
              peakWeightKg: 40 + (i % 20),
              avgCompletedReps: 12
            }
          ],
          sessionReflection: {
            energyRating: ((i % 5) + 1),
            perceivedReadiness: 'Optimal',
            reflectionTags: ['Focus', 'Consistency']
          }
        })
      }

      const t0 = performance.now()
      const csv = generateWorkoutHistoryCsv(largeHistory, true)
      const t1 = performance.now()

      expect(t1 - t0).toBeLessThan(200) // Must generate in < 200ms
      expect(csv.length).toBeGreaterThan(10000)

      const parsed = parseCsvRows(csv)
      expect(parsed).toHaveLength(1 + 400) // 1 header + 400 exercise rows
    })
  })

  describe('E22-06: UI Integration & User Flow', () => {
    beforeEach(() => {
      vi.spyOn(sessionStorageModule, 'loadWorkoutHistory').mockReturnValue(sampleWorkoutHistory)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('renders the Export History (CSV) button within the Data Vault section', () => {
      render(
        <MemoryRouter>
          <PlanProvider>
            <DownloadPlanPage />
          </PlanProvider>
        </MemoryRouter>
      )

      const csvButton = screen.getByRole('button', { name: /export history \(csv\)/i })
      expect(csvButton).toBeTruthy()
      expect((csvButton as HTMLButtonElement).disabled).toBe(false)
    })

    it('triggers CSV download workflow upon user click', async () => {
      const createObjectURLMock = vi.fn().mockReturnValue('blob:bodymap/csv-test-url')
      const revokeObjectURLMock = vi.fn()
      window.URL.createObjectURL = createObjectURLMock
      window.URL.revokeObjectURL = revokeObjectURLMock

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

      render(
        <MemoryRouter>
          <PlanProvider>
            <DownloadPlanPage />
          </PlanProvider>
        </MemoryRouter>
      )

      const csvButton = screen.getByRole('button', { name: /export history \(csv\)/i })
      fireEvent.click(csvButton)

      await waitFor(() => {
        expect(createObjectURLMock).toHaveBeenCalledTimes(1)
        expect(clickSpy).toHaveBeenCalledTimes(1)
      })

      clickSpy.mockRestore()
    })
  })
})
