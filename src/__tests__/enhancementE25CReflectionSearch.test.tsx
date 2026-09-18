/**
 * Enhancement E25-C: Workout History Reflection Tag & Note Search Test Suite
 *
 * Covers:
 * 1. Pure tag normalization & hashtag matching (normalizeTagForSearch, matchesReflectionTag)
 * 2. Pure reflection note matching (matchesReflectionNote)
 * 3. FilterWorkoutHistory search matching across dayTitle, dayType, exercises, tags, notes
 * 4. Hashtag equivalence (#SolidPump vs SolidPump vs solid pump)
 * 5. Case insensitivity, whitespace collapsing, Unicode & punctuation
 * 6. Non-matching of unrelated fields (ID, sessionId, timestamp, metrics, volume)
 * 7. Combined filter interactions (dayIndex, minSets, hasReflectionOnly, sorting)
 * 8. Legacy / malformed / missing reflection resilience & immutability
 * 9. Dashboard UI search interaction, hashtag search, note display & clear search
 * 10. Regression safety: streak calculation, PR extraction, log deletion, CSV export
 */
import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  filterWorkoutHistory,
  normalizeTagForSearch,
  matchesReflectionTag,
  matchesReflectionNote
} from '@/lib/workoutHistoryFilter'
import {
  saveCompletedWorkoutLog,
  loadWorkoutHistory,
  clearWorkoutHistory,
  deleteCompletedWorkoutLog
} from '@/lib/sessionStorage'
import { calculateWorkoutStreak } from '@/lib/streakCalculation'
import { extractPersonalRecords } from '@/lib/personalRecords'
import { generateWorkoutHistoryCsv, WORKOUT_HISTORY_CSV_COLUMNS } from '@/lib/workoutHistoryCsvEngine'
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
      planId: 'test_plan_e25c',
      weightLog: [],
      completedDays: [],
      isGenerated: true,
      plan: {
        splitName: 'Hypertrophy Split',
        experienceLevel: 'Intermediate',
        days: [
          { dayTitle: 'Day 1 - Chest & Triceps', dayType: 'Strength', exercises: [] },
          { dayTitle: 'Day 2 - Back & Biceps', dayType: 'Strength', exercises: [] }
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

// Helper to construct test workout logs
function createTestLog(overrides: Partial<CompletedWorkoutLog> = {}): CompletedWorkoutLog {
  const id = overrides.id || `log_${Math.random().toString(36).slice(2, 9)}`
  const sessionId = overrides.sessionId || `sess_${Math.random().toString(36).slice(2, 9)}`
  return {
    id,
    sessionId,
    dayIndex: 0,
    dayTitle: 'Day 1 - Push Hypertrophy',
    dayType: 'Hypertrophy',
    completedAt: '2026-08-20T10:00:00.000Z',
    durationSeconds: 3000,
    totalSetsCompleted: 15,
    totalExercises: 4,
    totalVolumeKg: 12000,
    workloadDensityKgPerMin: 240,
    exercisesSummary: [
      { name: 'Barbell Bench Press', setsCompleted: 4, totalSets: 4, peakWeightKg: 100, avgCompletedReps: 8 },
      { name: 'Incline Dumbbell Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 34, avgCompletedReps: 10 }
    ],
    sessionReflection: {
      energyRating: 5,
      perceivedReadiness: 'high',
      reflectionTags: ['Solid Pump', 'Form Focus'],
      notes: 'Shoulder felt super stable today. Increased weight on 3rd bench set.'
    },
    ...overrides
  }
}

describe('Enhancement E25-C: Tag Normalization & Pure Matchers', () => {
  describe('normalizeTagForSearch', () => {
    it('normalizes standard tag with spaces to compact lowercase', () => {
      expect(normalizeTagForSearch('Solid Pump')).toBe('solidpump')
      expect(normalizeTagForSearch('High Energy')).toBe('highenergy')
      expect(normalizeTagForSearch('Heavy Session')).toBe('heavysession')
    })

    it('strips leading hashtags and collapses whitespace', () => {
      expect(normalizeTagForSearch('#SolidPump')).toBe('solidpump')
      expect(normalizeTagForSearch('###Solid Pump')).toBe('solidpump')
      expect(normalizeTagForSearch('  #High Energy  ')).toBe('highenergy')
    })

    it('handles empty, whitespace, and non-string inputs safely', () => {
      expect(normalizeTagForSearch('')).toBe('')
      expect(normalizeTagForSearch('   ')).toBe('')
      expect(normalizeTagForSearch((null as unknown) as string)).toBe('')
      expect(normalizeTagForSearch((undefined as unknown) as string)).toBe('')
    })
  })

  describe('matchesReflectionTag', () => {
    it('matches exact raw tag case-insensitively', () => {
      expect(matchesReflectionTag('Solid Pump', 'Solid Pump')).toBe(true)
      expect(matchesReflectionTag('Solid Pump', 'solid pump')).toBe(true)
      expect(matchesReflectionTag('Solid Pump', 'SOLID PUMP')).toBe(true)
    })

    it('matches substring of raw tag', () => {
      expect(matchesReflectionTag('Solid Pump', 'solid')).toBe(true)
      expect(matchesReflectionTag('Solid Pump', 'pump')).toBe(true)
      expect(matchesReflectionTag('High Energy', 'energy')).toBe(true)
    })

    it('matches hashtag query against tag with spaces', () => {
      expect(matchesReflectionTag('Solid Pump', '#SolidPump')).toBe(true)
      expect(matchesReflectionTag('Solid Pump', '#solidpump')).toBe(true)
      expect(matchesReflectionTag('Solid Pump', '#SOLIDPUMP')).toBe(true)
      expect(matchesReflectionTag('Solid Pump', '##SolidPump')).toBe(true)
      expect(matchesReflectionTag('Solid Pump', '# Solid Pump')).toBe(true)
    })

    it('matches compact form without hash', () => {
      expect(matchesReflectionTag('Solid Pump', 'SolidPump')).toBe(true)
      expect(matchesReflectionTag('Solid Pump', 'solidpump')).toBe(true)
    })

    it('matches partial hashtag prefix or suffix', () => {
      expect(matchesReflectionTag('Solid Pump', '#Solid')).toBe(true)
      expect(matchesReflectionTag('Solid Pump', '#Pump')).toBe(true)
      expect(matchesReflectionTag('High Energy', '#High')).toBe(true)
    })

    it('matches lone hash symbol if tag is non-empty', () => {
      expect(matchesReflectionTag('Solid Pump', '#')).toBe(true)
      expect(matchesReflectionTag('Solid Pump', '##')).toBe(true)
    })

    it('returns false when tag does not match query', () => {
      expect(matchesReflectionTag('Solid Pump', 'Deadlift')).toBe(false)
      expect(matchesReflectionTag('Solid Pump', '#HighEnergy')).toBe(false)
      expect(matchesReflectionTag('Solid Pump', 'Cardio')).toBe(false)
    })

    it('returns false on invalid or empty inputs', () => {
      expect(matchesReflectionTag('', 'Solid')).toBe(false)
      expect(matchesReflectionTag('Solid Pump', '')).toBe(false)
      expect(matchesReflectionTag('Solid Pump', '   ')).toBe(false)
      expect(matchesReflectionTag((null as unknown) as string, 'Solid')).toBe(false)
      expect(matchesReflectionTag('Solid Pump', (null as unknown) as string)).toBe(false)
    })
  })

  describe('matchesReflectionNote', () => {
    const note = 'Left knee felt great during heavy squats! Pr on 3rd set. #Recovery'

    it('matches note substring case-insensitively', () => {
      expect(matchesReflectionNote(note, 'knee')).toBe(true)
      expect(matchesReflectionNote(note, 'KNEE')).toBe(true)
      expect(matchesReflectionNote(note, 'heavy squats')).toBe(true)
      expect(matchesReflectionNote(note, '3rd set')).toBe(true)
    })

    it('collapses multiple consecutive spaces in query and note', () => {
      expect(matchesReflectionNote(note, 'heavy   squats')).toBe(true)
      expect(matchesReflectionNote(note, 'heavy     squats!')).toBe(true)
    })

    it('matches hashtag present in note or strips hash to match word in note', () => {
      expect(matchesReflectionNote(note, '#Recovery')).toBe(true)
      expect(matchesReflectionNote(note, 'recovery')).toBe(true)
      expect(matchesReflectionNote(note, '#knee')).toBe(true)
    })

    it('supports Unicode and punctuation in notes', () => {
      const unicodeNote = 'Café boost before workout! 100% effort 🚀'
      expect(matchesReflectionNote(unicodeNote, 'café')).toBe(true)
      expect(matchesReflectionNote(unicodeNote, 'CAFÉ')).toBe(true)
      expect(matchesReflectionNote(unicodeNote, '100%')).toBe(true)
      expect(matchesReflectionNote(unicodeNote, '🚀')).toBe(true)
    })

    it('returns false when query is not in note', () => {
      expect(matchesReflectionNote(note, 'shoulder pain')).toBe(false)
      expect(matchesReflectionNote(note, 'biceps')).toBe(false)
    })

    it('returns false on missing or empty notes safely', () => {
      expect(matchesReflectionNote('', 'knee')).toBe(false)
      expect(matchesReflectionNote('   ', 'knee')).toBe(false)
      expect(matchesReflectionNote(undefined, 'knee')).toBe(false)
      expect(matchesReflectionNote(null, 'knee')).toBe(false)
      expect(matchesReflectionNote(note, '')).toBe(false)
      expect(matchesReflectionNote(note, '   ')).toBe(false)
    })
  })
})

describe('Enhancement E25-C: filterWorkoutHistory Pure Filter Invariants', () => {
  const log1 = createTestLog({
    id: 'log_1',
    sessionId: 'sess_1',
    dayIndex: 0,
    dayTitle: 'Day 1 - Chest & Arms',
    dayType: 'Strength',
    completedAt: '2026-08-20T10:00:00.000Z',
    exercisesSummary: [{ name: 'Incline Dumbbell Press', setsCompleted: 4, totalSets: 4 }],
    sessionReflection: {
      energyRating: 4,
      reflectionTags: ['Solid Pump'],
      notes: 'Felt great pump in upper chest.'
    }
  })

  const log2 = createTestLog({
    id: 'log_2',
    sessionId: 'sess_2',
    dayIndex: 1,
    dayTitle: 'Day 2 - Back & Core',
    dayType: 'Hypertrophy',
    completedAt: '2026-08-21T10:00:00.000Z',
    exercisesSummary: [{ name: 'Barbell Deadlift', setsCompleted: 5, totalSets: 5 }],
    sessionReflection: {
      perceivedReadiness: 'high',
      reflectionTags: ['Heavy Session', 'Form Focus'],
      notes: 'Strict spine neutral cue on heavy pulls.'
    }
  })

  const log3 = createTestLog({
    id: 'log_3',
    sessionId: 'sess_3',
    dayIndex: 2,
    dayTitle: 'Day 3 - Leg Annihilation',
    dayType: 'Powerlifting',
    completedAt: '2026-08-22T10:00:00.000Z',
    exercisesSummary: [{ name: 'Barbell Back Squat', setsCompleted: 6, totalSets: 6 }],
    sessionReflection: {
      energyRating: 5,
      notes: 'Hydration made a huge difference. Zero cramp.'
    }
  })

  const legacyLog = createTestLog({
    id: 'log_legacy',
    sessionId: 'sess_legacy',
    dayIndex: 0,
    dayTitle: 'Day 1 - Vintage Workout',
    dayType: 'Conditioning',
    completedAt: '2026-08-15T10:00:00.000Z',
    exercisesSummary: [{ name: 'Kettlebell Swings', setsCompleted: 5, totalSets: 5 }],
    sessionReflection: undefined
  })

  const sampleLogs = [log1, log2, log3, legacyLog]

  it('filters by dayTitle', () => {
    const res = filterWorkoutHistory(sampleLogs, { searchQuery: 'Leg Annihilation' })
    expect(res.filteredCount).toBe(1)
    expect(res.logs[0].id).toBe('log_3')
  })

  it('filters by dayType', () => {
    const res = filterWorkoutHistory(sampleLogs, { searchQuery: 'Powerlifting' })
    expect(res.filteredCount).toBe(1)
    expect(res.logs[0].id).toBe('log_3')
  })

  it('filters by exercise name', () => {
    const res = filterWorkoutHistory(sampleLogs, { searchQuery: 'Deadlift' })
    expect(res.filteredCount).toBe(1)
    expect(res.logs[0].id).toBe('log_2')
  })

  it('filters by reflection tag with exact string', () => {
    const res = filterWorkoutHistory(sampleLogs, { searchQuery: 'Solid Pump' })
    expect(res.filteredCount).toBe(1)
    expect(res.logs[0].id).toBe('log_1')
  })

  it('filters by reflection tag using hashtag syntax (#SolidPump)', () => {
    const res = filterWorkoutHistory(sampleLogs, { searchQuery: '#SolidPump' })
    expect(res.filteredCount).toBe(1)
    expect(res.logs[0].id).toBe('log_1')
  })

  it('filters by reflection tag using compact lowercase without hashtag (solidpump)', () => {
    const res = filterWorkoutHistory(sampleLogs, { searchQuery: 'solidpump' })
    expect(res.filteredCount).toBe(1)
    expect(res.logs[0].id).toBe('log_1')
  })

  it('filters by reflection tag using partial hashtag (#Heavy)', () => {
    const res = filterWorkoutHistory(sampleLogs, { searchQuery: '#Heavy' })
    expect(res.filteredCount).toBe(1)
    expect(res.logs[0].id).toBe('log_2')
  })

  it('filters by reflection note text', () => {
    const res = filterWorkoutHistory(sampleLogs, { searchQuery: 'spine neutral' })
    expect(res.filteredCount).toBe(1)
    expect(res.logs[0].id).toBe('log_2')
  })

  it('filters by reflection note text with leading hashtag (#Hydration)', () => {
    const res = filterWorkoutHistory(sampleLogs, { searchQuery: '#Hydration' })
    expect(res.filteredCount).toBe(1)
    expect(res.logs[0].id).toBe('log_3')
  })

  it('does NOT match unrelated fields such as log IDs, timestamps, or session IDs', () => {
    expect(filterWorkoutHistory(sampleLogs, { searchQuery: 'log_1' }).filteredCount).toBe(0)
    expect(filterWorkoutHistory(sampleLogs, { searchQuery: 'sess_' }).filteredCount).toBe(0)
    expect(filterWorkoutHistory(sampleLogs, { searchQuery: '2026-08-20' }).filteredCount).toBe(0)
    expect(filterWorkoutHistory(sampleLogs, { searchQuery: 'totalVolumeKg' }).filteredCount).toBe(0)
  })

  it('returns all logs when search query is empty or whitespace-only', () => {
    expect(filterWorkoutHistory(sampleLogs, { searchQuery: '' }).filteredCount).toBe(4)
    expect(filterWorkoutHistory(sampleLogs, { searchQuery: '    ' }).filteredCount).toBe(4)
  })

  it('combines search query with dayIndex filter without false positives', () => {
    // Both log1 and legacyLog are dayIndex 0
    const res1 = filterWorkoutHistory(sampleLogs, { dayIndex: 0 })
    expect(res1.filteredCount).toBe(2)

    // Search for pump on dayIndex 0
    const res2 = filterWorkoutHistory(sampleLogs, { dayIndex: 0, searchQuery: '#SolidPump' })
    expect(res2.filteredCount).toBe(1)
    expect(res2.logs[0].id).toBe('log_1')

    // Search for deadlift on dayIndex 0 (deadlift is on dayIndex 1) -> 0 matches
    const res3 = filterWorkoutHistory(sampleLogs, { dayIndex: 0, searchQuery: 'Deadlift' })
    expect(res3.filteredCount).toBe(0)
  })

  it('combines search query with hasReflectionOnly filter', () => {
    // legacyLog has no reflection
    const res1 = filterWorkoutHistory(sampleLogs, { hasReflectionOnly: true })
    expect(res1.filteredCount).toBe(3)
    expect(res1.logs.some(l => l.id === 'log_legacy')).toBe(false)

    const res2 = filterWorkoutHistory(sampleLogs, { hasReflectionOnly: true, searchQuery: 'Swings' })
    expect(res2.filteredCount).toBe(0)
  })

  it('preserves sorting order (newest first by default)', () => {
    const res = filterWorkoutHistory(sampleLogs)
    expect(res.logs.map(l => l.id)).toEqual(['log_3', 'log_2', 'log_1', 'log_legacy'])
  })

  it('sorts by oldest first when requested', () => {
    const res = filterWorkoutHistory(sampleLogs, { sortBy: 'oldest' })
    expect(res.logs.map(l => l.id)).toEqual(['log_legacy', 'log_1', 'log_2', 'log_3'])
  })

  it('guarantees purity and does not mutate input records', () => {
    const originalJson = JSON.stringify(sampleLogs)
    filterWorkoutHistory(sampleLogs, { searchQuery: '#SolidPump' })
    expect(JSON.stringify(sampleLogs)).toBe(originalJson)
  })

  it('handles malformed records with null or missing properties gracefully', () => {
    const malformedList = [
      null as unknown as CompletedWorkoutLog,
      undefined as unknown as CompletedWorkoutLog,
      { id: 'bad_1' } as unknown as CompletedWorkoutLog,
      { id: 'bad_2', sessionReflection: { reflectionTags: [null as unknown as string, 'Valid Tag'] } } as unknown as CompletedWorkoutLog
    ]
    const res = filterWorkoutHistory(malformedList, { searchQuery: 'Valid Tag' })
    expect(res.filteredCount).toBe(1)
  })
})

describe('Enhancement E25-C: Dashboard UI Search Integration', () => {
  beforeEach(() => {
    clearWorkoutHistory()
    localStorage.clear()
  })

  it('renders search input with placeholder indicating tags and notes are searchable', () => {
    saveCompletedWorkoutLog(createTestLog({ dayTitle: 'Upper Body A' }))

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    const searchInput = screen.getByPlaceholderText(/Search exercises, splits, tags, notes.../i)
    expect(searchInput).toBeDefined()
  })

  it('filters workouts interactively when typing reflection note text', () => {
    const logA = createTestLog({
      id: 'log_a',
      dayTitle: 'Pull Workout A',
      sessionReflection: {
        notes: 'Forearm grip was fatigue bottleneck on rack pulls.'
      }
    })
    const logB = createTestLog({
      id: 'log_b',
      dayTitle: 'Leg Workout B',
      sessionReflection: {
        notes: 'Calf raises felt smooth and painless.'
      }
    })
    saveCompletedWorkoutLog(logA)
    saveCompletedWorkoutLog(logB)

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    const searchInput = screen.getByPlaceholderText(/Search exercises, splits, tags, notes.../i)

    // Type note-specific word
    fireEvent.change(searchInput, { target: { value: 'bottleneck' } })

    expect(screen.getByText('Pull Workout A')).toBeDefined()
    expect(screen.queryByText('Leg Workout B')).toBeNull()
  })

  it('filters workouts interactively when typing hashtag (#SolidPump)', () => {
    const logA = createTestLog({
      id: 'log_a',
      dayTitle: 'Arm Day Deluxe',
      sessionReflection: {
        reflectionTags: ['Solid Pump']
      }
    })
    const logB = createTestLog({
      id: 'log_b',
      dayTitle: 'Leg Day Extreme',
      sessionReflection: {
        reflectionTags: ['Heavy Session']
      }
    })
    saveCompletedWorkoutLog(logA)
    saveCompletedWorkoutLog(logB)

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    const searchInput = screen.getByPlaceholderText(/Search exercises, splits, tags, notes.../i)

    // Search by hashtag
    fireEvent.change(searchInput, { target: { value: '#SolidPump' } })

    expect(screen.getByText('Arm Day Deluxe')).toBeDefined()
    expect(screen.queryByText('Leg Day Extreme')).toBeNull()
  })

  it('clearing search query restores all workouts', () => {
    const logA = createTestLog({
      id: 'log_a',
      dayTitle: 'Arm Day Deluxe',
      sessionReflection: { notes: 'Great bicep isolation' }
    })
    const logB = createTestLog({
      id: 'log_b',
      dayTitle: 'Leg Day Extreme',
      sessionReflection: { notes: 'Quads burning' }
    })
    saveCompletedWorkoutLog(logA)
    saveCompletedWorkoutLog(logB)

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    const searchInput = screen.getByPlaceholderText(/Search exercises, splits, tags, notes.../i)
    fireEvent.change(searchInput, { target: { value: 'bicep' } })

    expect(screen.getByText('Arm Day Deluxe')).toBeDefined()
    expect(screen.queryByText('Leg Day Extreme')).toBeNull()

    // Click clear button
    const clearBtn = screen.getByLabelText('Clear search query')
    fireEvent.click(clearBtn)

    expect(screen.getByText('Arm Day Deluxe')).toBeDefined()
    expect(screen.getByText('Leg Day Extreme')).toBeDefined()
  })

  it('displays reflection notes text on the workout history card', () => {
    const noteText = 'Personal best on tempo squats with 3-second eccentric.'
    saveCompletedWorkoutLog(createTestLog({
      id: 'log_note_card',
      dayTitle: 'Tempo Squat Protocol',
      sessionReflection: {
        notes: noteText
      }
    }))

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText(new RegExp(noteText, 'i'))).toBeDefined()
  })
})

describe('Enhancement E25-C: Regression Safety with E25-A, Streaks, PRs, and CSV', () => {
  beforeEach(() => {
    clearWorkoutHistory()
    localStorage.clear()
  })

  it('streak calculations continue to compute accurately from stored history', () => {
    const today = new Date().toISOString().split('T')[0]
    saveCompletedWorkoutLog(createTestLog({
      completedAt: `${today}T12:00:00Z`,
      sessionReflection: { notes: 'Streak session 1' }
    }))

    const history = loadWorkoutHistory()
    const streak = calculateWorkoutStreak(history, [0])
    expect(streak).toBeGreaterThanOrEqual(1)
  })

  it('personal records extraction continues to work accurately with reflection notes', () => {
    saveCompletedWorkoutLog(createTestLog({
      exercisesSummary: [{ name: 'Overhead Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 65 }],
      sessionReflection: { notes: 'Strict form overhead press PR' }
    }))

    const history = loadWorkoutHistory()
    const prs = extractPersonalRecords(history)
    const ohpPr = prs.find(p => p.exerciseName === 'Overhead Press')
    expect(ohpPr).toBeDefined()
    expect(ohpPr?.value).toBe(65)
  })

  it('E25-A log deletion continues to function and pruning removes records cleanly', () => {
    const log = createTestLog({
      id: 'log_to_delete',
      sessionReflection: { notes: 'Session to be deleted', reflectionTags: ['Form Focus'] }
    })
    saveCompletedWorkoutLog(log)
    expect(loadWorkoutHistory().length).toBe(1)

    const success = deleteCompletedWorkoutLog('log_to_delete')
    expect(success).toBe(true)
    expect(loadWorkoutHistory().length).toBe(0)
  })

  it('E22 CSV export includes reflection fields and preserves expected column structure', () => {
    const log = createTestLog({
      sessionReflection: {
        energyRating: 5,
        perceivedReadiness: 'high',
        reflectionTags: ['Form Focus', 'Solid Pump'],
        notes: 'Csv test note'
      }
    })
    saveCompletedWorkoutLog(log)
    const history = loadWorkoutHistory()

    const csvContent = generateWorkoutHistoryCsv(history, false)
    expect(csvContent.startsWith(WORKOUT_HISTORY_CSV_COLUMNS.join(','))).toBe(true)
    expect(csvContent).toContain('Form Focus; Solid Pump')
    expect(csvContent).toContain('high')
  })
})
