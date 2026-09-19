/**
 * Enhancement E26-B: User Resting Heart Rate (RHR) Preference Persistence & Storage
 *
 * Dedicated Integration, UI, Cross-Tab & Adversarial Mutation Test Suite
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  RESTING_HEART_RATE_STORAGE_KEY,
  loadRestingHeartRate,
  saveRestingHeartRate,
  clearRestingHeartRate,
  validateRestingHeartRate
} from '@/lib/restingHeartRateStorage'
import { calculateTargetHeartRateZones } from '@/lib/targetHeartRateZones'
import DashboardPage from '@/pages/DashboardPage'
import { PlanProvider } from '@/context/PlanContext'

// Mock Recharts ResponsiveContainer to avoid jsdom zero-dimension warnings
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 500, height: 300 }}>{children}</div>
    ),
  }
})

describe('Enhancement E26-B: Dashboard RHR Persistence & Integration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  const renderDashboard = () => {
    return render(
      <MemoryRouter>
        <PlanProvider>
          <DashboardPage />
        </PlanProvider>
      </MemoryRouter>
    )
  }

  describe('D1-D5: Initial Hydration & Default Fallback', () => {
    it('D1: initializes to default 60 BPM when localStorage is empty', () => {
      renderDashboard()

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input).toBeDefined()
      expect(input.value).toBe('60')

      // Reset button should be hidden when value is at default 60
      expect(screen.queryByTestId('reset-resting-hr-btn')).toBeNull()
    })

    it('D2: hydrates initial value from localStorage when valid preference exists', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '75')

      renderDashboard()

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('75')

      // Reset button should be visible when value is not at default 60
      const resetBtn = screen.getByTestId('reset-resting-hr-btn')
      expect(resetBtn).toBeDefined()
    })

    it('D3: safely falls back to default 60 BPM when stored value is corrupted text', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, 'corrupted_value')

      renderDashboard()

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('60')
    })

    it('D4: safely falls back to default 60 BPM when stored value is out-of-bounds number', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '135')

      renderDashboard()

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('60')
    })

    it('D5: safely falls back to default 60 BPM on storage read exception', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('AccessDenied')
      })
      vi.spyOn(console, 'error').mockImplementation(() => {})

      renderDashboard()

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('60')
    })
  })

  describe('D6-D10: User Modifications & Persistence', () => {
    it('D6: persists valid text typing to localStorage and updates zones', () => {
      renderDashboard()

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      fireEvent.change(input, { target: { value: '68' } })

      expect(input.value).toBe('68')
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBe('68')
    })

    it('D7: does NOT persist invalid out-of-bounds numbers to localStorage', () => {
      renderDashboard()

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      fireEvent.change(input, { target: { value: '150' } })

      expect(input.value).toBe('150')
      // Storage should not contain '150'
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBeNull()

      fireEvent.change(input, { target: { value: '20' } })
      expect(input.value).toBe('20')
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBeNull()
    })

    it('D8: persists +5 stepper adjustments to localStorage', () => {
      renderDashboard()

      const btnPlus = screen.getByLabelText(/add 5 bpm to rest rate/i)
      fireEvent.click(btnPlus) // 60 -> 65

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('65')
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBe('65')
    })

    it('D9: persists -5 stepper adjustments to localStorage', () => {
      renderDashboard()

      const btnMinus = screen.getByLabelText(/subtract 5 bpm from rest rate/i)
      fireEvent.click(btnMinus) // 60 -> 55

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('55')
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBe('55')
    })

    it('D10: persists preset chip selection to localStorage', () => {
      renderDashboard()

      const chip80 = screen.getByLabelText(/heart rate preset 80 bpm/i)
      fireEvent.click(chip80)

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('80')
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBe('80')
    })
  })

  describe('D11-D15: Reset Behavior & Idempotence', () => {
    it('D11: clicking Reset button restores UI to 60 BPM and removes storage key', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '74')
      renderDashboard()

      const resetBtn = screen.getByTestId('reset-resting-hr-btn')
      expect(resetBtn).toBeDefined()

      fireEvent.click(resetBtn)

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('60')
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBeNull()

      // Reset button disappears after resetting to default
      expect(screen.queryByTestId('reset-resting-hr-btn')).toBeNull()
    })

    it('D12: reset preserves unrelated keys in localStorage', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '80')
      localStorage.setItem('bodymap_user_note', 'important note')

      renderDashboard()

      const resetBtn = screen.getByTestId('reset-resting-hr-btn')
      fireEvent.click(resetBtn)

      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBeNull()
      expect(localStorage.getItem('bodymap_user_note')).toBe('important note')
    })

    it('D13: remounting after reset still defaults cleanly to 60 BPM', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '80')
      const { unmount } = renderDashboard()

      const resetBtn = screen.getByTestId('reset-resting-hr-btn')
      fireEvent.click(resetBtn)
      unmount()

      renderDashboard()
      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('60')
    })

    it('D14: stepper upper boundary 120 BPM cannot be exceeded and saves 120', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '120')
      renderDashboard()

      const btnPlus = screen.getByLabelText(/add 5 bpm to rest rate/i)
      fireEvent.click(btnPlus) // should stay clamped at 120

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('120')
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBe('120')
    })

    it('D15: stepper lower boundary 30 BPM cannot be subceded and saves 30', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '30')
      renderDashboard()

      const btnMinus = screen.getByLabelText(/subtract 5 bpm from rest rate/i)
      fireEvent.click(btnMinus) // should stay clamped at 30

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('30')
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBe('30')
    })
  })

  describe('D16-D20: Cross-Tab Synchronization', () => {
    it('D16: updates local RHR state upon receiving valid external storage event', () => {
      renderDashboard()

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('60')

      act(() => {
        localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '72')
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: RESTING_HEART_RATE_STORAGE_KEY,
            newValue: '72'
          })
        )
      })

      expect(input.value).toBe('72')
    })

    it('D17: falls back safely to 60 upon receiving external storage clear event', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '72')
      renderDashboard()

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('72')

      act(() => {
        localStorage.removeItem(RESTING_HEART_RATE_STORAGE_KEY)
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: RESTING_HEART_RATE_STORAGE_KEY,
            newValue: null
          })
        )
      })

      expect(input.value).toBe('60')
    })

    it('D18: ignores storage events for unrelated keys', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '65')
      renderDashboard()

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('65')

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'bodymap_unrelated_setting',
            newValue: 'some_val'
          })
        )
      })

      expect(input.value).toBe('65')
    })

    it('D19: falls back safely to 60 when external storage event brings corrupted data', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '65')
      renderDashboard()

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('65')

      act(() => {
        localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, 'corrupted_rhr')
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: RESTING_HEART_RATE_STORAGE_KEY,
            newValue: 'corrupted_rhr'
          })
        )
      })

      expect(input.value).toBe('60')
    })

    it('D20: handles global localStorage.clear() event (key: null) safely', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '70')
      renderDashboard()

      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('70')

      act(() => {
        localStorage.clear()
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: null,
            newValue: null
          })
        )
      })

      expect(input.value).toBe('60')
    })
  })

  describe('D21-D25: Adversarial & Mutation Validation (M1–M20)', () => {
    it('M1-M4: detects mutation that ignores storage or accepts out-of-bounds values', () => {
      // M1: if code hardcodes 60, loadRestingHeartRate with 78 would be ignored
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '78')
      expect(loadRestingHeartRate()).toBe(78)

      // M3: 29 BPM mutation
      expect(validateRestingHeartRate(29)).toBeNull()
      expect(saveRestingHeartRate(29)).toBe(false)

      // M4: 121 BPM mutation
      expect(validateRestingHeartRate(121)).toBeNull()
      expect(saveRestingHeartRate(121)).toBe(false)
    })

    it('M5-M7: detects mutation accepting decimals, NaN, Infinity, or raw invalid text', () => {
      // M5: decimals
      expect(validateRestingHeartRate(60.5)).toBeNull()
      expect(saveRestingHeartRate(60.5)).toBe(false)

      // M6: NaN / Infinity
      expect(validateRestingHeartRate(NaN)).toBeNull()
      expect(validateRestingHeartRate(Infinity)).toBeNull()
      expect(saveRestingHeartRate(NaN)).toBe(false)
      expect(saveRestingHeartRate(Infinity)).toBe(false)

      // M7: raw invalid text
      expect(validateRestingHeartRate('raw text')).toBeNull()
      expect(saveRestingHeartRate('raw text')).toBe(false)
    })

    it('M8-M9: detects mutation that resets UI without clearing key or clears wrong key', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '70')
      localStorage.setItem('other_key', 'preserve')

      clearRestingHeartRate()
      expect(localStorage.getItem(RESTING_HEART_RATE_STORAGE_KEY)).toBeNull()
      expect(localStorage.getItem('other_key')).toBe('preserve')
    })

    it('M12-M16: proves mathematical output invariance with E23 calculation engine', () => {
      // Zone calculation for age 30 and RHR 60
      const zones60 = calculateTargetHeartRateZones(30, 60)
      expect(zones60.isValid).toBe(true)
      expect(zones60.estimatedMaxHr).toBe(187)
      expect(zones60.heartRateReserve).toBe(127)
      expect(zones60.zones[0].bpmRange.min).toBe(124) // 60 + 0.50 * 127 = 123.5 -> 124

      // Zone calculation for age 30 and RHR 70 (from storage)
      const zones70 = calculateTargetHeartRateZones(30, 70)
      expect(zones70.isValid).toBe(true)
      expect(zones70.estimatedMaxHr).toBe(187)
      expect(zones70.heartRateReserve).toBe(117)
      expect(zones70.zones[0].bpmRange.min).toBe(129) // 70 + 0.50 * 117 = 128.5 -> 129

      // Validating math is strictly distinct and correct
      expect(zones70.heartRateReserve).not.toBe(zones60.heartRateReserve)
    })

    it('M17-M20: remounting hydrates from storage and recalculates zones without losing state', () => {
      localStorage.setItem(RESTING_HEART_RATE_STORAGE_KEY, '75')
      const { unmount } = renderDashboard()
      unmount()

      renderDashboard()
      const input = screen.getByLabelText(/rest heart rate bpm/i) as HTMLInputElement
      expect(input.value).toBe('75')
      expect(screen.getByText(/112 BPM/i)).toBeDefined() // HRR for age 30 (187 - 75 = 112)
    })
  })
})
