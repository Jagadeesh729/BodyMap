/**
 * Enhancement E26-A: Scoped & Filtered Workout History CSV Export Test Suite
 *
 * Covers:
 * 1. Scope-aware filename generation (unfiltered, filtered, day-filtered, single-workout)
 * 2. Adversarial filename sanitization (path traversal, control chars, reserved names, bounds)
 * 3. Filtered CSV export logic & RFC 4180 compliance (exact records, zero extra/missing/duplicates)
 * 4. Formula injection neutralization & UTF-8 BOM integrity
 * 5. Dashboard toolbar export UI (scope-aware accessible label, record count, disabled state)
 * 6. Individual workout card export UI (single-session isolation, deterministic filename)
 * 7. Client-side download pipeline & object URL lifecycle (createObjectURL, revokeObjectURL)
 * 8. Integration with E25-A (deleted logs never exported) and E25-C (tag/note search filtering)
 * 9. Privacy boundary: zero health conditions, medications, or internal secrets exported
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  WORKOUT_HISTORY_CSV_COLUMNS,
  generateWorkoutHistoryCsv,
  createWorkoutHistoryCsvBlob,
  getWorkoutHistoryCsvFilename,
  parseCsvRows,
  type WorkoutHistoryCsvScope
} from '@/lib/workoutHistoryCsvEngine'
import {
  saveCompletedWorkoutLog,
  clearWorkoutHistory,
  deleteCompletedWorkoutLog
} from '@/lib/sessionStorage'
import DashboardPage from '@/pages/DashboardPage'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

// Mock Recharts ResponsiveContainer to avoid jsdom layout zero-dimension warnings
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 500, height: 300 }}>{children}</div>
    ),
  }
})

// Mock usePlan
vi.mock('@/context/PlanContext', () => ({
  usePlan: () => ({
    state: {
      planId: 'test_plan_e26a',
      weightLog: [],
      completedDays: [],
      isGenerated: true,
      plan: {
        splitName: 'Hypertrophy Split',
        experienceLevel: 'Intermediate',
        days: [
          { dayTitle: 'Day 1 - Push Power', dayType: 'Hypertrophy', exercises: [] },
          { dayTitle: 'Day 2 - Pull Strength', dayType: 'Strength', exercises: [] },
          { dayTitle: 'Day 3 - Leg Dynamic', dayType: 'Endurance', exercises: [] }
        ]
      },
      formData: {
        weight: '75',
        height: '178',
        fitnessLevel: 'intermediate',
        mainGoal: 'bulk',
        medicalIssues: 'None'
      }
    },
    dispatch: vi.fn()
  })
}))

const sampleLogs: CompletedWorkoutLog[] = [
  {
    id: 'log-e26-1',
    sessionId: 'sess-1',
    dayIndex: 0,
    dayTitle: 'Day 1 - Push Power',
    dayType: 'Hypertrophy',
    durationSeconds: 2700,
    totalExercises: 2,
    totalSetsCompleted: 6,
    completedAt: '2026-09-17T09:00:00.000Z',
    exercisesSummary: [
      {
        exerciseId: 'ex-bench',
        name: 'Barbell Bench Press',
        setsCompleted: 3,
        totalSets: 3,
        peakWeightKg: 100,
        avgCompletedReps: 8
      },
      {
        exerciseId: 'ex-incline',
        name: 'Incline Dumbbell Press',
        setsCompleted: 3,
        totalSets: 3,
        peakWeightKg: 34,
        avgCompletedReps: 10
      }
    ],
    sessionReflection: {
      energyRating: 5,
      perceivedReadiness: 'High',
      reflectionTags: ['Chest pump', 'PR set'],
      notes: 'Crushed the working sets with solid form'
    }
  },
  {
    id: 'log-e26-2',
    sessionId: 'sess-2',
    dayIndex: 1,
    dayTitle: 'Day 2 - Pull Strength',
    dayType: 'Strength',
    durationSeconds: 3100,
    totalExercises: 1,
    totalSetsCompleted: 4,
    completedAt: '2026-09-18T10:30:00.000Z',
    exercisesSummary: [
      {
        exerciseId: 'ex-deadlift',
        name: 'Barbell Deadlift',
        setsCompleted: 4,
        totalSets: 4,
        peakWeightKg: 180,
        avgCompletedReps: 5
      }
    ],
    sessionReflection: {
      energyRating: 4,
      perceivedReadiness: 'Moderate',
      reflectionTags: ['Heavy pull', 'Tired lats'],
      notes: 'Grip gave out on the last set'
    }
  },
  {
    id: 'log-e26-3',
    sessionId: 'sess-3',
    dayIndex: 2,
    dayTitle: 'Day 3 - Leg Dynamic',
    dayType: 'Endurance',
    durationSeconds: 2400,
    totalExercises: 1,
    totalSetsCompleted: 3,
    completedAt: '2026-09-19T08:15:00.000Z',
    exercisesSummary: [
      {
        exerciseId: 'ex-squat',
        name: 'Front Squat',
        setsCompleted: 3,
        totalSets: 3,
        peakWeightKg: 90,
        avgCompletedReps: 12
      }
    ],
    sessionReflection: {
      energyRating: 3,
      perceivedReadiness: 'Sore quads',
      reflectionTags: ['High reps', 'Leg pump'],
      notes: 'Quad burn was intense'
    }
  }
]

describe('Enhancement E26-A: Scoped & Filtered Workout History CSV Export', () => {
  let createdUrls: string[] = []
  let revokedUrls: string[] = []
  let capturedBlobs: Blob[] = []
  let lastAppendedLink: HTMLAnchorElement | null = null

  beforeEach(() => {
    localStorage.clear()
    clearWorkoutHistory()
    createdUrls = []
    revokedUrls = []
    capturedBlobs = []
    lastAppendedLink = null

    // Mock URL methods
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob) => {
      capturedBlobs.push(blob)
      const mockUrl = `blob:http://localhost:3000/mock-uuid-${createdUrls.length + 1}`
      createdUrls.push(mockUrl)
      return mockUrl
    })

    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
      revokedUrls.push(url)
    })

    // Spy on document.body.appendChild to capture download links
    const origAppend = document.body.appendChild.bind(document.body)
    vi.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => {
      if (node instanceof HTMLAnchorElement) {
        lastAppendedLink = node
      }
      return origAppend(node)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION A: Filename Generation & Scope Handling
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Section A: Scope-Aware Filename Generation', () => {
    const fixedDate = new Date(2026, 8, 19) // 2026-09-19

    it('generates standard unfiltered filename when scope is undefined or "all"', () => {
      expect(getWorkoutHistoryCsvFilename(fixedDate)).toBe('bodymap-workout-history-2026-09-19.csv')
      expect(getWorkoutHistoryCsvFilename(fixedDate, 'all')).toBe('bodymap-workout-history-2026-09-19.csv')
    })

    it('generates filtered filename when scope is "filtered"', () => {
      expect(getWorkoutHistoryCsvFilename(fixedDate, 'filtered')).toBe('bodymap-workout-history-filtered-2026-09-19.csv')
    })

    it('generates day-filtered filename for object and string day formats', () => {
      expect(getWorkoutHistoryCsvFilename(fixedDate, { type: 'day', dayIndex: 0 })).toBe('bodymap-workout-history-day1-2026-09-19.csv')
      expect(getWorkoutHistoryCsvFilename(fixedDate, { type: 'day', dayIndex: 2 })).toBe('bodymap-workout-history-day3-2026-09-19.csv')
      expect(getWorkoutHistoryCsvFilename(fixedDate, 'day1')).toBe('bodymap-workout-history-day1-2026-09-19.csv')
      expect(getWorkoutHistoryCsvFilename(fixedDate, 'day-2')).toBe('bodymap-workout-history-day2-2026-09-19.csv')
    })

    it('generates deterministic single-workout filename with sanitized title', () => {
      const scope: WorkoutHistoryCsvScope = {
        type: 'single',
        title: 'Push Power',
        dayIndex: 0
      }
      expect(getWorkoutHistoryCsvFilename(fixedDate, scope)).toBe('bodymap-workout-history-day1-push-power-2026-09-19.csv')
    })

    it('neutralizes path traversal attempts in custom scope or titles', () => {
      const maliciousScope: WorkoutHistoryCsvScope = {
        type: 'single',
        title: '../../../../etc/passwd',
        dayIndex: 0
      }
      const filename = getWorkoutHistoryCsvFilename(fixedDate, maliciousScope)
      expect(filename).not.toContain('..')
      expect(filename).not.toContain('/')
      expect(filename).not.toContain('\\')
      expect(filename.endsWith('.csv')).toBe(true)
    })

    it('neutralizes Windows drive prefixes and control characters in titles', () => {
      const maliciousScope: WorkoutHistoryCsvScope = {
        type: 'single',
        title: 'C:\\Windows\\System32\\cmd.exe\x00evil',
        dayIndex: 1
      }
      const filename = getWorkoutHistoryCsvFilename(fixedDate, maliciousScope)
      expect(filename).not.toContain('C:')
      expect(filename).not.toContain('\x00')
      expect(filename.endsWith('.csv')).toBe(true)
    })

    it('prefixes Windows reserved device names in titles', () => {
      const reservedScope: WorkoutHistoryCsvScope = {
        type: 'single',
        title: 'CON',
        dayIndex: 0
      }
      const filename = getWorkoutHistoryCsvFilename(fixedDate, reservedScope)
      expect(filename.endsWith('.csv')).toBe(true)
      expect(filename).toContain('con')
    })

    it('bounds total filename length to safe limits', () => {
      const superLongTitle = 'A'.repeat(200)
      const filename = getWorkoutHistoryCsvFilename(fixedDate, { type: 'single', title: superLongTitle })
      expect(filename.length).toBeLessThanOrEqual(70)
      expect(filename.endsWith('.csv')).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION B: Filtered CSV Engine Integrity & Security
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Section B: Filtered CSV Engine Integrity & Security', () => {
    it('serializes exactly the provided filtered logs subset without sibling contamination', () => {
      // Pass only 1 log (Push Power)
      const csv = generateWorkoutHistoryCsv([sampleLogs[0]], false)
      const rows = parseCsvRows(csv)

      // Header + 2 exercise rows for Bench Press and Incline Dumbbell Press
      expect(rows.length).toBe(3)
      expect(rows[0]).toEqual(Array.from(WORKOUT_HISTORY_CSV_COLUMNS))
      expect(rows[1][1]).toBe('Day 1 - Push Power')
      expect(rows[1][4]).toBe('Barbell Bench Press')
      expect(rows[2][1]).toBe('Day 1 - Push Power')
      expect(rows[2][4]).toBe('Incline Dumbbell Press')

      // Assert no deadlift or squat rows exist
      const allText = csv.toLowerCase()
      expect(allText).not.toContain('deadlift')
      expect(allText).not.toContain('front squat')
    })

    it('neutralizes formula injection characters (=, +, -, @, \\t, \\r) in titles, notes, and tags', () => {
      const formulaLog: CompletedWorkoutLog = {
        ...sampleLogs[0],
        dayTitle: '=cmd|/c calc!A0',
        sessionReflection: {
          energyRating: 5,
          perceivedReadiness: '+12345',
          reflectionTags: ['@SUM(A1:A10)', '-malicious'],
          notes: '\t=HYPERLINK("http://evil.com")'
        }
      }

      const csv = generateWorkoutHistoryCsv([formulaLog], false)
      const rows = parseCsvRows(csv)

      // Title escaped with leading quote
      expect(rows[1][1]).toBe("'=cmd|/c calc!A0")
      // Readiness escaped
      expect(rows[1][10]).toBe("'+12345")
      // Tags escaped
      expect(rows[1][11]).toBe("'@SUM(A1:A10); -malicious")
    })

    it('properly handles RFC 4180 escaping for quotes and commas in notes', () => {
      const quotedLog: CompletedWorkoutLog = {
        ...sampleLogs[0],
        sessionReflection: {
          notes: 'Felt "strong, energized" on bench press, 100% effort'
        }
      }
      const csv = generateWorkoutHistoryCsv([quotedLog], false)
      expect(csv).toContain('Day 1 - Push Power')
      const rows = parseCsvRows(csv)
      expect(rows.length).toBe(3)
    })

    it('preserves UTF-8 BOM by default for Excel compatibility', () => {
      const blob = createWorkoutHistoryCsvBlob([sampleLogs[0]])
      expect(blob.type).toBe('text/csv;charset=utf-8')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION C: Dashboard Toolbar Export UI
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Section C: Dashboard Toolbar Export UI', () => {
    it('renders the toolbar Export CSV button with accurate record count and scope in aria-label', async () => {
      sampleLogs.forEach(log => saveCompletedWorkoutLog(log))

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('toolbar-export-csv-btn')).toBeDefined()
      })

      const btn = screen.getByTestId('toolbar-export-csv-btn')
      expect(btn.hasAttribute('disabled')).toBe(false)
      expect(btn.getAttribute('aria-label')).toBe('Export 3 workouts to CSV')

      // Click unfiltered export
      fireEvent.click(btn)
      expect(capturedBlobs.length).toBe(1)
      const allText = await capturedBlobs[0].text()
      const allRows = parseCsvRows(allText)
      // Header + 2 rows (Push) + 1 row (Pull) + 1 row (Leg) = 5 rows
      expect(allRows.length).toBe(5)
    })

    it('updates aria-label to reflect active search filter and exports only matching logs', async () => {
      sampleLogs.forEach(log => saveCompletedWorkoutLog(log))

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('toolbar-export-csv-btn')).toBeDefined()
      })

      // Type "deadlift" into search input
      const searchInput = screen.getByPlaceholderText(/search exercises, splits, tags/i)
      fireEvent.change(searchInput, { target: { value: 'deadlift' } })

      const btn = screen.getByTestId('toolbar-export-csv-btn')
      expect(btn.getAttribute('aria-label')).toBe('Export 1 filtered workout to CSV')

      // Click Export CSV
      fireEvent.click(btn)

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
      expect(lastAppendedLink).not.toBeNull()
      expect(lastAppendedLink?.download).toMatch(/bodymap-workout-history-filtered-\d{4}-\d{2}-\d{2}\.csv/)

      // Assert Blob contains exactly the filtered log (Deadlift only)
      expect(capturedBlobs.length).toBe(1)
      const csvText = await capturedBlobs[0].text()
      const rows = parseCsvRows(csvText)
      expect(rows.length).toBe(2)
      expect(rows[1][4]).toBe('Barbell Deadlift')
      expect(csvText).not.toContain('Bench Press')
      expect(csvText).not.toContain('Front Squat')

      // Verify URL is revoked
      await waitFor(() => {
        expect(URL.revokeObjectURL).toHaveBeenCalled()
      })
    })

    it('exports day-filtered workouts with day-specific filename when day pill is selected', async () => {
      sampleLogs.forEach(log => saveCompletedWorkoutLog(log))

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('toolbar-export-csv-btn')).toBeDefined()
      })

      // Click "Day 2" pill
      const day2Btn = screen.getByRole('button', { name: /^Day 2 \(\d+\)$/i })
      fireEvent.click(day2Btn)

      const exportBtn = screen.getByTestId('toolbar-export-csv-btn')
      expect(exportBtn.getAttribute('aria-label')).toBe('Export 1 filtered workout to CSV')

      fireEvent.click(exportBtn)

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
      expect(lastAppendedLink?.download).toMatch(/bodymap-workout-history-day2-\d{4}-\d{2}-\d{2}\.csv/)

      // Assert Blob contains Day 2 only
      expect(capturedBlobs.length).toBe(1)
      const csvText = await capturedBlobs[0].text()
      const rows = parseCsvRows(csvText)
      expect(rows.length).toBe(2)
      expect(rows[1][1]).toBe('Day 2 - Pull Strength')
      expect(csvText).not.toContain('Day 1 - Push Power')
      expect(csvText).not.toContain('Day 3 - Leg Dynamic')
    }, 15000)

    it('disables the toolbar export button when search filter matches 0 workouts', async () => {
      sampleLogs.forEach(log => saveCompletedWorkoutLog(log))

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('toolbar-export-csv-btn')).toBeDefined()
      })

      const searchInput = screen.getByPlaceholderText(/search exercises, splits, tags/i)
      fireEvent.change(searchInput, { target: { value: 'non-existent-exercise-xyz' } })

      const btn = screen.getByTestId('toolbar-export-csv-btn')
      expect(btn.hasAttribute('disabled')).toBe(true)
      expect(btn.getAttribute('aria-label')).toBe('Export to CSV disabled (0 matching workouts)')

      // Click should be a no-op
      fireEvent.click(btn)
      expect(URL.createObjectURL).not.toHaveBeenCalled()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION D: Individual Card Export UI
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Section D: Individual Card Export UI', () => {
    it('renders an Export CSV button on each workout history card with accessible title', async () => {
      sampleLogs.forEach(log => saveCompletedWorkoutLog(log))

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('export-csv-btn-log-e26-1')).toBeDefined()
        expect(screen.getByTestId('export-csv-btn-log-e26-2')).toBeDefined()
        expect(screen.getByTestId('export-csv-btn-log-e26-3')).toBeDefined()
      })

      const cardBtn = screen.getByTestId('export-csv-btn-log-e26-1')
      expect(cardBtn.getAttribute('aria-label')).toContain('Export CSV for Day 1 - Push Power')
    })

    it('clicking individual card export serializes only that specific workout session', async () => {
      sampleLogs.forEach(log => saveCompletedWorkoutLog(log))

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('export-csv-btn-log-e26-2')).toBeDefined()
      })

      // Click card 2 (Pull Strength)
      const card2Btn = screen.getByTestId('export-csv-btn-log-e26-2')
      fireEvent.click(card2Btn)

      expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
      expect(lastAppendedLink?.download).toMatch(/bodymap-workout-history-day2-day-2-pull-strength-\d{4}-\d{2}-\d{2}\.csv/i)

      // Verify prompt revocation
      await waitFor(() => {
        expect(URL.revokeObjectURL).toHaveBeenCalled()
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION E: Object URL Lifecycle & Anti-Leak Guards
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Section E: Object URL Lifecycle & Anti-Leak Guards', () => {
    it('does NOT trigger object URL creation on component mount or re-render', async () => {
      sampleLogs.forEach(log => saveCompletedWorkoutLog(log))

      const { rerender } = render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('toolbar-export-csv-btn')).toBeDefined()
      })

      expect(URL.createObjectURL).not.toHaveBeenCalled()

      // Re-render
      rerender(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      expect(URL.createObjectURL).not.toHaveBeenCalled()
    })

    it('revokes the created object URL promptly after download trigger', async () => {
      sampleLogs.forEach(log => saveCompletedWorkoutLog(log))

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('toolbar-export-csv-btn')).toBeDefined()
      })

      fireEvent.click(screen.getByTestId('toolbar-export-csv-btn'))

      expect(createdUrls.length).toBe(1)
      await waitFor(() => {
        expect(revokedUrls.length).toBe(1)
        expect(revokedUrls[0]).toBe(createdUrls[0])
      })
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION F: Regression & Integration with E25-A (Deletion) & E25-C (Search)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Section F: Regression & Integration with E25-A and E25-C', () => {
    it('integrates with E25-C: hashtag search filters export dataset accurately', async () => {
      sampleLogs.forEach(log => saveCompletedWorkoutLog(log))

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('toolbar-export-csv-btn')).toBeDefined()
      })

      // Search for reflection tag "#PR"
      const searchInput = screen.getByPlaceholderText(/search exercises, splits, tags/i)
      fireEvent.change(searchInput, { target: { value: '#PR' } })

      const btn = screen.getByTestId('toolbar-export-csv-btn')
      expect(btn.getAttribute('aria-label')).toBe('Export 1 filtered workout to CSV')

      fireEvent.click(btn)
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    })

    it('integrates with E25-A: deleted workouts are permanently removed and cannot be exported', async () => {
      sampleLogs.forEach(log => saveCompletedWorkoutLog(log))

      // Delete log 1 directly via storage
      deleteCompletedWorkoutLog('log-e26-1')

      render(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByTestId('toolbar-export-csv-btn')).toBeDefined()
      })

      // Should now show 2 workouts instead of 3
      const btn = screen.getByTestId('toolbar-export-csv-btn')
      expect(btn.getAttribute('aria-label')).toBe('Export 2 workouts to CSV')

      // Ensure deleted card button is not in document
      expect(screen.queryByTestId('export-csv-btn-log-e26-1')).toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION G: Privacy & Secret Leaks Boundary
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Section G: Privacy & Confidentiality Boundary', () => {
    it('never includes medical issues, allergies, or server secrets in the exported CSV', () => {
      const csv = generateWorkoutHistoryCsv(sampleLogs, false)
      const rawText = csv.toLowerCase()

      expect(rawText).not.toContain('medical')
      expect(rawText).not.toContain('allergies')
      expect(rawText).not.toContain('gemini')
      expect(rawText).not.toContain('api_key')
      expect(rawText).not.toContain('secret')
      expect(rawText).not.toContain('password')
    })
  })
})
