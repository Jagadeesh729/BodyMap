import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  isStorageQuotaError,
  notifyStorageQuotaExceeded,
  subscribeToStorageQuotaErrors,
  _clearStorageQuotaListeners
} from '@/lib/storageQuotaHandler'

describe('Storage Quota Handler (E9)', () => {
  beforeEach(() => {
    _clearStorageQuotaListeners()
  })

  describe('isStorageQuotaError', () => {
    it('returns false for null, undefined, or empty values', () => {
      expect(isStorageQuotaError(null)).toBe(false)
      expect(isStorageQuotaError(undefined)).toBe(false)
      expect(isStorageQuotaError('')).toBe(false)
      expect(isStorageQuotaError(123)).toBe(false)
    })

    it('identifies DOMException with QuotaExceededError name', () => {
      const err = new DOMException('Storage limit reached', 'QuotaExceededError')
      expect(isStorageQuotaError(err)).toBe(true)
    })

    it('identifies Firefox NS_ERROR_DOM_QUOTA_REACHED signature', () => {
      const err = { name: 'NS_ERROR_DOM_QUOTA_REACHED', code: 1014 }
      expect(isStorageQuotaError(err)).toBe(true)
    })

    it('identifies standard code 22 error', () => {
      const err = { code: 22, message: 'Quota exceeded' }
      expect(isStorageQuotaError(err)).toBe(true)
    })

    it('identifies IE/Edge legacy number code', () => {
      const err = { number: -2147024882 }
      expect(isStorageQuotaError(err)).toBe(true)
    })

    it('returns false for unrelated errors', () => {
      const err = new Error('Network failure')
      expect(isStorageQuotaError(err)).toBe(false)
      expect(isStorageQuotaError(new TypeError('Cannot read property'))).toBe(false)
    })
  })

  describe('Event notification and subscription', () => {
    it('notifies registered listeners when quota is exceeded', () => {
      const callback = vi.fn()
      const unsubscribe = subscribeToStorageQuotaErrors(callback)

      notifyStorageQuotaExceeded('session', 'Custom quota message')

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'session',
          message: 'Custom quota message',
          timestamp: expect.any(Number)
        })
      )

      unsubscribe()
      notifyStorageQuotaExceeded('plan')
      expect(callback).toHaveBeenCalledTimes(1) // Not called again after unsubscribing
    })

    it('uses standard preservation message when no custom message is supplied', () => {
      const callback = vi.fn()
      subscribeToStorageQuotaErrors(callback)

      notifyStorageQuotaExceeded('plan')

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'plan',
          message: expect.stringContaining('preserved')
        })
      )
    })
  })

  describe('Integration & Data Preservation Guarantees', () => {
    it('dispatches quota error and preserves existing history when workout log save hits quota', async () => {
      const { saveCompletedWorkoutLog, loadWorkoutHistory, WORKOUT_HISTORY_STORAGE_KEY } = await import('@/lib/sessionStorage')

      // Seed pre-existing workout history
      const initialLogs = [
        {
          id: 'existing_log_1',
          sessionId: 'sess_1',
          dayIndex: 0,
          dayTitle: 'Leg Day',
          dayType: 'Strength',
          completedAt: '2026-03-01T08:00:00.000Z',
          durationSeconds: 3000,
          totalSetsCompleted: 10,
          totalExercises: 3,
          exercisesSummary: []
        }
      ]
      localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify(initialLogs))

      const quotaCallback = vi.fn()
      const unsubscribe = subscribeToStorageQuotaErrors(quotaCallback)

      // Spy on Storage.prototype.setItem to simulate QuotaExceededError
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string) => {
        if (key === WORKOUT_HISTORY_STORAGE_KEY) {
          throw new DOMException('Disk quota exceeded', 'QuotaExceededError')
        }
      })

      const newLog = {
        id: 'overflow_log_2',
        sessionId: 'sess_2',
        dayIndex: 1,
        dayTitle: 'Chest Day',
        dayType: 'Hypertrophy',
        completedAt: '2026-03-02T08:00:00.000Z',
        durationSeconds: 3000,
        totalSetsCompleted: 10,
        totalExercises: 3,
        exercisesSummary: []
      }

      // Execute write that triggers quota error
      saveCompletedWorkoutLog(newLog)

      // Verify quota notification fired
      expect(quotaCallback).toHaveBeenCalledTimes(1)
      expect(quotaCallback).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'history' })
      )

      // Restore original setItem to check that prior data was preserved
      setItemSpy.mockRestore()
      const preserved = loadWorkoutHistory()
      expect(preserved.length).toBe(1)
      expect(preserved[0].id).toBe('existing_log_1')

      unsubscribe()
    })
  })
})
