import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '@/pages/DashboardPage'
import { PlanProvider } from '@/context/PlanContext'
import {
  saveCompletedWorkoutLog,
  loadWorkoutHistory,
  deleteCompletedWorkoutLog,
  WORKOUT_HISTORY_STORAGE_KEY,
  MAX_STORED_WORKOUTS
} from '@/lib/sessionStorage'
import type { CompletedWorkoutLog } from '@/types/workoutSession'
import { filterWorkoutHistory } from '@/lib/workoutHistoryFilter'
import { calculateWorkoutStreak } from '@/lib/streakCalculation'
import { extractPersonalRecords } from '@/lib/personalRecords'
import { generateWorkoutHistoryCsv } from '@/lib/workoutHistoryCsvEngine'

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

const makeSampleLog = (id: string, dayIndex = 0, title = 'Push Day', extra?: Partial<CompletedWorkoutLog>): CompletedWorkoutLog => ({
  id,
  sessionId: `sess_${id}`,
  dayIndex,
  dayTitle: title,
  dayType: 'Hypertrophy',
  completedAt: '2026-09-18T10:00:00.000Z',
  durationSeconds: 2700,
  totalSetsCompleted: 12,
  totalExercises: 3,
  exercisesSummary: [
    {
      name: 'Barbell Bench Press',
      setsCompleted: 4,
      totalSets: 4,
      peakWeightKg: 100,
      avgCompletedReps: 8
    }
  ],
  sessionReflection: {
    energyRating: 4,
    perceivedReadiness: 'high',
    reflectionTags: ['Solid Pump']
  },
  ...extra
})

const renderDashboard = () => {
  return render(
    <PlanProvider>
      <BrowserRouter>
        <DashboardPage />
      </BrowserRouter>
    </PlanProvider>
  )
}

describe('Enhancement E25-A: Individual Completed Workout Log Deletion & Pruning', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('E25A-01: Storage Layer — Canonical Deletion by ID', () => {
    it('deletes an existing log by exact canonical ID and returns true', () => {
      const log1 = makeSampleLog('log_1')
      const log2 = makeSampleLog('log_2')
      saveCompletedWorkoutLog(log1)
      saveCompletedWorkoutLog(log2)

      expect(loadWorkoutHistory()).toHaveLength(2)
      const res = deleteCompletedWorkoutLog('log_1')

      expect(res).toBe(true)
      const history = loadWorkoutHistory()
      expect(history).toHaveLength(1)
      expect(history[0].id).toBe('log_2')
    })

    it('correctly deletes the first, middle, and last log while preserving relative order', () => {
      const logA = makeSampleLog('log_A', 0, 'Session A')
      const logB = makeSampleLog('log_B', 1, 'Session B')
      const logC = makeSampleLog('log_C', 2, 'Session C')
      const logD = makeSampleLog('log_D', 3, 'Session D')

      // Pre-seed in specific order
      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify([logA, logB, logC, logD]))

      // 1. Delete middle (logB)
      expect(deleteCompletedWorkoutLog('log_B')).toBe(true)
      expect(loadWorkoutHistory().map(l => l.id)).toEqual(['log_A', 'log_C', 'log_D'])

      // 2. Delete first (logA)
      expect(deleteCompletedWorkoutLog('log_A')).toBe(true)
      expect(loadWorkoutHistory().map(l => l.id)).toEqual(['log_C', 'log_D'])

      // 3. Delete last (logD)
      expect(deleteCompletedWorkoutLog('log_D')).toBe(true)
      expect(loadWorkoutHistory().map(l => l.id)).toEqual(['log_C'])
    })

    it('deletes the only record from a single-record history leaving an empty history', () => {
      const log = makeSampleLog('sole_log')
      saveCompletedWorkoutLog(log)
      expect(loadWorkoutHistory()).toHaveLength(1)

      const res = deleteCompletedWorkoutLog('sole_log')
      expect(res).toBe(true)
      expect(loadWorkoutHistory()).toEqual([])
    })

    it('returns false and performs zero storage writes when deleting nonexistent ID', () => {
      const log = makeSampleLog('existing_log')
      saveCompletedWorkoutLog(log)
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

      const res = deleteCompletedWorkoutLog('nonexistent_id')
      expect(res).toBe(false)
      expect(loadWorkoutHistory()).toHaveLength(1)
      expect(setItemSpy).not.toHaveBeenCalled()
    })

    it('returns false and performs zero storage writes for empty string, whitespace, null, or malformed ID', () => {
      const log = makeSampleLog('safe_log')
      saveCompletedWorkoutLog(log)
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

      expect(deleteCompletedWorkoutLog('')).toBe(false)
      expect(deleteCompletedWorkoutLog('   ')).toBe(false)
      expect(deleteCompletedWorkoutLog((null as unknown) as string)).toBe(false)
      expect(deleteCompletedWorkoutLog((undefined as unknown) as string)).toBe(false)
      expect(deleteCompletedWorkoutLog((12345 as unknown) as string)).toBe(false)

      expect(setItemSpy).not.toHaveBeenCalled()
      expect(loadWorkoutHistory()).toHaveLength(1)
    })

    it('is safely idempotent: repeated deletion of the same ID returns false on second call', () => {
      const log = makeSampleLog('idempotent_log')
      saveCompletedWorkoutLog(log)

      expect(deleteCompletedWorkoutLog('idempotent_log')).toBe(true)
      expect(deleteCompletedWorkoutLog('idempotent_log')).toBe(false)
      expect(loadWorkoutHistory()).toEqual([])
    })

    it('removes duplicate records with identical IDs if present in storage and returns true', () => {
      const log1 = makeSampleLog('dup_id', 0, 'Log 1')
      const log2 = makeSampleLog('dup_id', 1, 'Log 2')
      const logOther = makeSampleLog('other_id', 2, 'Log Other')

      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify([log1, log2, logOther]))
      expect(loadWorkoutHistory()).toHaveLength(3)

      const res = deleteCompletedWorkoutLog('dup_id')
      expect(res).toBe(true)
      const remaining = loadWorkoutHistory()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe('other_id')
    })

    it('handles corrupted localStorage JSON safely without throwing and returns false', () => {
      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, '{"corrupt_json: true')
      expect(() => deleteCompletedWorkoutLog('any_id')).not.toThrow()
      expect(deleteCompletedWorkoutLog('any_id')).toBe(false)
    })

    it('handles localStorage write failure (quota error) gracefully and returns false', () => {
      const log = makeSampleLog('quota_log')
      saveCompletedWorkoutLog(log)

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const err = new DOMException('QuotaExceededError', 'QuotaExceededError')
        throw err
      })

      const res = deleteCompletedWorkoutLog('quota_log')
      expect(res).toBe(false)
    })

    it('preserves MAX_STORED_WORKOUTS retention behavior', () => {
      const logs: CompletedWorkoutLog[] = []
      for (let i = 0; i < 20; i++) {
        logs.push(makeSampleLog(`bulk_${i}`, i % 7, `Day ${i}`))
      }
      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(logs))

      expect(loadWorkoutHistory()).toHaveLength(20)
      deleteCompletedWorkoutLog('bulk_10')

      const after = loadWorkoutHistory()
      expect(after).toHaveLength(19)
      expect(after.find(l => l.id === 'bulk_10')).toBeUndefined()
      expect(after.length).toBeLessThanOrEqual(MAX_STORED_WORKOUTS)
    })
  })

  describe('E25A-02: Dashboard UX — Modal Trigger, Confirmation & Cancellation', () => {
    it('renders a Delete action button on each workout history card with accessible attributes', () => {
      const log1 = makeSampleLog('ui_log_1', 0, 'Upper Body Push')
      saveCompletedWorkoutLog(log1)

      renderDashboard()

      const deleteBtn = screen.getByTestId('delete-workout-btn-ui_log_1')
      expect(deleteBtn).toBeDefined()
      expect(deleteBtn.getAttribute('aria-label')).toBe('Delete workout log: Upper Body Push')
      expect(deleteBtn.getAttribute('title')).toBe('Delete this workout log')
    })

    it('opens the confirmation modal when Delete button is clicked, showing target workout details', () => {
      const log1 = makeSampleLog('ui_log_target', 1, 'Leg Day Annihilation')
      saveCompletedWorkoutLog(log1)

      renderDashboard()

      const deleteBtn = screen.getByTestId('delete-workout-btn-ui_log_target')
      fireEvent.click(deleteBtn)

      // Modal should appear
      expect(screen.getByTestId('delete-workout-modal')).toBeDefined()
      expect(screen.getByText('Delete Workout Log?')).toBeDefined()
      expect(screen.getAllByText(/Leg Day Annihilation/).length).toBeGreaterThan(0)
      expect(screen.getByText(/Only this specific session record will be removed/)).toBeDefined()
      expect(screen.getByTestId('cancel-delete-workout-btn')).toBeDefined()
      expect(screen.getByTestId('confirm-delete-workout-btn')).toBeDefined()
    })

    it('cancels deletion without storage mutation when Cancel button is clicked', () => {
      const log1 = makeSampleLog('ui_log_cancel', 0, 'Preserved Workout')
      saveCompletedWorkoutLog(log1)

      renderDashboard()

      fireEvent.click(screen.getByTestId('delete-workout-btn-ui_log_cancel'))
      expect(screen.getByTestId('delete-workout-modal')).toBeDefined()

      fireEvent.click(screen.getByTestId('cancel-delete-workout-btn'))

      // Modal closes
      expect(screen.queryByTestId('delete-workout-modal')).toBeNull()
      // Storage remains intact
      expect(loadWorkoutHistory()).toHaveLength(1)
      expect(screen.getByText('Preserved Workout')).toBeDefined()
    })

    it('cancels deletion without storage mutation when Close (X) button is clicked', () => {
      const log1 = makeSampleLog('ui_log_close_x', 0, 'Preserved Workout X')
      saveCompletedWorkoutLog(log1)

      renderDashboard()

      fireEvent.click(screen.getByTestId('delete-workout-btn-ui_log_close_x'))
      expect(screen.getByTestId('delete-workout-modal')).toBeDefined()

      fireEvent.click(screen.getByLabelText('Close dialog'))

      expect(screen.queryByTestId('delete-workout-modal')).toBeNull()
      expect(loadWorkoutHistory()).toHaveLength(1)
    })

    it('cancels deletion without storage mutation when Escape key is pressed', () => {
      const log1 = makeSampleLog('ui_log_escape', 0, 'Preserved Workout Escape')
      saveCompletedWorkoutLog(log1)

      renderDashboard()

      fireEvent.click(screen.getByTestId('delete-workout-btn-ui_log_escape'))
      expect(screen.getByTestId('delete-workout-modal')).toBeDefined()

      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })

      expect(screen.queryByTestId('delete-workout-modal')).toBeNull()
      expect(loadWorkoutHistory()).toHaveLength(1)
    })

    it('deletes only the target workout upon confirming, updating UI state immediately without page reload', () => {
      const logA = makeSampleLog('ui_log_keep', 0, 'Keep This Workout')
      const logB = makeSampleLog('ui_log_remove', 1, 'Remove This Workout')
      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify([logA, logB]))

      renderDashboard()

      expect(screen.getByText('Keep This Workout')).toBeDefined()
      expect(screen.getByText('Remove This Workout')).toBeDefined()

      // Click delete for logB
      fireEvent.click(screen.getByTestId('delete-workout-btn-ui_log_remove'))
      // Confirm deletion
      fireEvent.click(screen.getByTestId('confirm-delete-workout-btn'))

      // Modal should be closed
      expect(screen.queryByTestId('delete-workout-modal')).toBeNull()

      // Target card should disappear immediately from UI
      expect(screen.queryByText('Remove This Workout')).toBeNull()
      // Unrelated card must remain visible
      expect(screen.getByText('Keep This Workout')).toBeDefined()

      // Storage should contain only logA
      const history = loadWorkoutHistory()
      expect(history).toHaveLength(1)
      expect(history[0].id).toBe('ui_log_keep')
    })
  })

  describe('E25A-03: Race Conditions, Stale State & Concurrency', () => {
    it('safely handles deletion attempt on an already-deleted or pruned record', () => {
      const log = makeSampleLog('stale_log', 0, 'Stale Workout')
      saveCompletedWorkoutLog(log)

      renderDashboard()

      // Simulate an out-of-band deletion (e.g. cross-tab)
      localStorage.removeItem(WORKOUT_HISTORY_STORAGE_KEY)

      // Now click delete in UI
      fireEvent.click(screen.getByTestId('delete-workout-btn-stale_log'))
      fireEvent.click(screen.getByTestId('confirm-delete-workout-btn'))

      expect(screen.queryByTestId('delete-workout-modal')).toBeNull()
      expect(loadWorkoutHistory()).toEqual([])
    })

    it('newly added workout during session is preserved when an older workout is deleted', () => {
      const log1 = makeSampleLog('existing_1', 0, 'Session 1')
      const log2 = makeSampleLog('existing_2', 1, 'Session 2')
      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify([log1, log2]))

      // Add a third workout
      const log3 = makeSampleLog('existing_3', 2, 'Session 3')
      saveCompletedWorkoutLog(log3)

      expect(deleteCompletedWorkoutLog('existing_1')).toBe(true)
      const history = loadWorkoutHistory()
      expect(history.map(l => l.id)).toEqual(['existing_3', 'existing_2'])
    })
  })

  describe('E25A-04: Derived Metrics & Subsystem Regression Isolation', () => {
    it('recalculates streak correctly after a workout log is pruned', () => {
      const today = new Date().toISOString()
      const logToday = makeSampleLog('streak_today', 0, 'Today Workout', { completedAt: today })
      saveCompletedWorkoutLog(logToday)

      expect(calculateWorkoutStreak(loadWorkoutHistory(), [])).toBe(1)

      deleteCompletedWorkoutLog('streak_today')
      expect(calculateWorkoutStreak(loadWorkoutHistory(), [])).toBe(0)
    })

    it('recalculates personal records (PRs) correctly after a peak lift log is deleted', () => {
      const log1 = makeSampleLog('pr_normal', 0, 'Bench Day', {
        exercisesSummary: [{ name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 80, avgCompletedReps: 5 }]
      })
      const log2 = makeSampleLog('pr_peak', 1, 'Bench Peak Day', {
        exercisesSummary: [{ name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 120, avgCompletedReps: 5 }]
      })

      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify([log2, log1]))
      let prs = extractPersonalRecords(loadWorkoutHistory())
      let benchPr = prs.find(p => p.exerciseName === 'Barbell Bench Press')
      expect(benchPr?.value).toBe(120)

      // Delete the peak lift
      deleteCompletedWorkoutLog('pr_peak')

      prs = extractPersonalRecords(loadWorkoutHistory())
      benchPr = prs.find(p => p.exerciseName === 'Barbell Bench Press')
      expect(benchPr?.value).toBe(80)
    })

    it('preserves history filtering functionality with remaining records', () => {
      const log1 = makeSampleLog('filt_push', 0, 'Push Day')
      const log2 = makeSampleLog('filt_pull', 1, 'Pull Day')
      const log3 = makeSampleLog('filt_legs', 2, 'Legs Day')
      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify([log1, log2, log3]))

      deleteCompletedWorkoutLog('filt_pull')

      const filtered = filterWorkoutHistory(loadWorkoutHistory(), { searchQuery: 'push' })
      expect(filtered.logs).toHaveLength(1)
      expect(filtered.logs[0].id).toBe('filt_push')

      const filteredPull = filterWorkoutHistory(loadWorkoutHistory(), { searchQuery: 'pull' })
      expect(filteredPull.logs).toHaveLength(0)
    })

    it('preserves CSV export capability on remaining logs without format corruption', () => {
      const logA = makeSampleLog('csv_a', 0, 'Push Session')
      const logB = makeSampleLog('csv_b', 1, 'Pull Session')
      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify([logA, logB]))

      deleteCompletedWorkoutLog('csv_a')

      const remaining = loadWorkoutHistory()
      const csv = generateWorkoutHistoryCsv(remaining)

      expect(csv).toContain('Pull Session')
      expect(csv).not.toContain('Push Session')
      expect(csv.startsWith('\uFEFFDate,Day Title,Day Type')).toBe(true)
    })
  })

  describe('E25A-05: Adversarial & Mutation Validation', () => {
    it('fails if delete targets array index instead of canonical ID', () => {
      const log1 = makeSampleLog('id_alpha', 0, 'Alpha')
      const log2 = makeSampleLog('id_beta', 1, 'Beta')
      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify([log1, log2]))

      // Attempting to delete using an index-like string "0" must NOT delete the 0th element
      expect(deleteCompletedWorkoutLog('0')).toBe(false)
      expect(loadWorkoutHistory()).toHaveLength(2)
    })

    it('fails if clearWorkoutHistory is called instead of selective deletion', () => {
      const log1 = makeSampleLog('persist_1')
      const log2 = makeSampleLog('persist_2')
      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify([log1, log2]))

      deleteCompletedWorkoutLog('persist_1')
      const history = loadWorkoutHistory()
      expect(history.length).toBe(1)
      expect(history[0].id).toBe('persist_2')
    })
  })
})
