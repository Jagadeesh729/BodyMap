/**
 * Enhancement E27-C: Body Measurement Historical Entry Deletion & Pruning UI Test Suite
 *
 * Full Autonomous Implementation, Privacy Hardening & Adversarial Verification:
 * F1. Historical entries render in the Body Measurements card.
 * F2. Correct date and circumference value metadata appears.
 * F3. Empty state renders cleanly when no entries exist.
 * F4. Clicking Delete opens the accessible confirmation modal.
 * F5. Cancel closes confirmation without mutating records.
 * F6. Confirm deletes exactly the selected record.
 * F7. UI immediately removes the deleted record from the list.
 * F8. Remaining records stay intact with correct data.
 * F9. Derived visualization and analytics recompute immediately.
 * F10. Reload/remount preserves the deletion in storage.
 * F11. Delete newest entry works properly.
 * F12. Delete oldest entry works properly.
 * F13. Delete middle entry works properly.
 * F14. Delete final remaining record transitions to empty state.
 * F15. Rapid repeated delete interactions do not double-delete.
 * F16. Keyboard navigation works properly.
 * F17. Accessible modal semantics (role="dialog", aria-modal="true", aria-labelledby, aria-describedby).
 * F18. Escape key closes the confirmation modal without mutation.
 * F19. Cross-tab storage deletion synchronizes via storage event.
 * F20. Full user data purge removes all body measurement data completely.
 * F21. No unexpected network requests are generated.
 * F22. No new consumer sinks are introduced.
 * F23. Sequential deletion of two different entries works correctly.
 * F24. Switching from record A to record B does not delete record A.
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '@/pages/DashboardPage'
import {
  saveBodyMeasurement,
  loadBodyMetrics,
  clearBodyMetrics,
  deleteBodyMeasurement,
  BODY_METRICS_STORAGE_KEY
} from '@/lib/bodyMetricsStorage'
import { purgeAllUserData } from '@/lib/dataPurge'

// Mock Recharts ResponsiveContainer to avoid jsdom layout warnings
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 500, height: 300 }}>{children}</div>
    )
  }
})

// Mock usePlan for DashboardPage context
vi.mock('@/context/PlanContext', () => ({
  usePlan: () => ({
    state: {
      planId: 'test_plan_e27c',
      weightLog: [],
      completedDays: [],
      isGenerated: true,
      plan: {
        splitName: 'Strength Split',
        experienceLevel: 'Advanced',
        days: [
          { dayTitle: 'Day 1 - Push Strength', dayType: 'Strength', exercises: [] }
        ]
      },
      formData: {
        weight: '80',
        height: '180',
        fitnessLevel: 'advanced',
        mainGoal: 'strength',
        medicalIssues: 'None'
      }
    },
    dispatch: vi.fn()
  })
}))

describe('Enhancement E27-C: Body Measurement Historical Entry Deletion & Pruning Suite', () => {
  beforeEach(() => {
    localStorage.clear()
    clearBodyMetrics()
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('F1 & F2: renders historical entries with correct date and value metadata', () => {
    const e1 = saveBodyMeasurement({
      date: '2026-08-01',
      unit: 'cm',
      waist: 85,
      chest: 102,
      arms: 35
    })
    const e2 = saveBodyMeasurement({
      date: '2026-08-15',
      unit: 'cm',
      waist: 83.5,
      chest: 101,
      arms: 35.5,
      notes: 'Morning measurement after workout'
    })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // Verify section header with count
    expect(screen.getByText(/Measurement History \(2\)/i)).toBeDefined()

    // Verify both entries are rendered
    const list = screen.getByTestId('body-measurement-history-list')
    expect(list).toBeDefined()
    expect(screen.getByTestId(`measurement-entry-${e1.id}`)).toBeDefined()
    expect(screen.getByTestId(`measurement-entry-${e2.id}`)).toBeDefined()

    // Verify metadata and notes within the history list
    expect(within(list).getByText('2026-08-15')).toBeDefined()
    expect(within(list).getByText('2026-08-01')).toBeDefined()
    expect(within(list).getByText(/Morning measurement after workout/i)).toBeDefined()
    expect(within(list).getByTestId(`delete-measurement-btn-${e1.id}`)).toBeDefined()
    expect(within(list).getByTestId(`delete-measurement-btn-${e2.id}`)).toBeDefined()
  })

  it('F3: renders clean empty state when no body measurements exist', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/No body measurements recorded yet/i)).toBeDefined()
    expect(screen.queryByTestId('body-measurement-history-list')).toBeNull()
    expect(screen.getByText(/Total Recorded Logs:/i).textContent).toContain('0')
  })

  it('F4 & F5: clicking Delete opens confirmation modal and Cancel closes it without mutation', () => {
    const entry = saveBodyMeasurement({
      date: '2026-08-10',
      unit: 'cm',
      waist: 84
    })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    const deleteBtn = screen.getByTestId(`delete-measurement-btn-${entry.id}`)
    fireEvent.click(deleteBtn)

    // Modal should be open
    const modal = screen.getByTestId('delete-body-measurement-modal')
    expect(modal).toBeDefined()
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText(/Delete Measurement Entry\?/i)).toBeDefined()
    expect(screen.getByText(/Recorded on 2026-08-10/i)).toBeDefined()

    // Click Cancel
    const cancelBtn = screen.getByTestId('cancel-delete-measurement-btn')
    fireEvent.click(cancelBtn)

    // Modal should be closed
    expect(screen.queryByTestId('delete-body-measurement-modal')).toBeNull()

    // Canonical storage must be untouched
    const stored = loadBodyMetrics()
    expect(stored.length).toBe(1)
    expect(stored[0].id).toBe(entry.id)
  })

  it('F6, F7, F8: Confirm deletes exactly the selected record and preserves remaining records', () => {
    const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 88, chest: 105 })
    const e2 = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 86, chest: 104 })
    const e3 = saveBodyMeasurement({ date: '2026-08-20', unit: 'cm', waist: 84, chest: 103 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // Click delete on middle entry (e2)
    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${e2.id}`))

    // Confirm deletion
    const confirmBtn = screen.getByTestId('confirm-delete-measurement-btn')
    fireEvent.click(confirmBtn)

    // UI immediately updates: e2 is removed, e1 and e3 remain
    expect(screen.queryByTestId(`measurement-entry-${e2.id}`)).toBeNull()
    expect(screen.getByTestId(`measurement-entry-${e1.id}`)).toBeDefined()
    expect(screen.getByTestId(`measurement-entry-${e3.id}`)).toBeDefined()

    // Canonical storage reflects exact remaining records
    const stored = loadBodyMetrics()
    expect(stored.length).toBe(2)
    expect(stored.some(e => e.id === e2.id)).toBe(false)
    expect(stored.some(e => e.id === e1.id)).toBe(true)
    expect(stored.some(e => e.id === e3.id)).toBe(true)
  })

  it('F9: recomputes derived metrics (current value & delta) immediately after deletion', () => {
    // e1: waist 90, e2: waist 85 -> current is 85
    saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 90 })
    const e2 = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 85 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // Current waist is 85 cm
    expect(screen.getAllByText('85 cm').length).toBeGreaterThan(0)

    // Delete e2 (the latest entry)
    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${e2.id}`))
    fireEvent.click(screen.getByTestId('confirm-delete-measurement-btn'))

    // Now current waist must immediately become 90 cm
    expect(screen.getAllByText('90 cm').length).toBeGreaterThan(0)
  })

  it('F10: reload/remount preserves the deletion in storage', () => {
    const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 88 })
    const e2 = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 86 })

    const { unmount } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${e1.id}`))
    fireEvent.click(screen.getByTestId('confirm-delete-measurement-btn'))
    unmount()

    // Remount
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.queryByTestId(`measurement-entry-${e1.id}`)).toBeNull()
    expect(screen.getByTestId(`measurement-entry-${e2.id}`)).toBeDefined()
  })

  it('F11: delete newest record works cleanly', () => {
    const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
    const e2 = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 82 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${e2.id}`))
    fireEvent.click(screen.getByTestId('confirm-delete-measurement-btn'))

    expect(screen.queryByTestId(`measurement-entry-${e2.id}`)).toBeNull()
    expect(screen.getByTestId(`measurement-entry-${e1.id}`)).toBeDefined()
    expect(loadBodyMetrics().length).toBe(1)
  })

  it('F12: delete oldest record works cleanly', () => {
    const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
    const e2 = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 82 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${e1.id}`))
    fireEvent.click(screen.getByTestId('confirm-delete-measurement-btn'))

    expect(screen.queryByTestId(`measurement-entry-${e1.id}`)).toBeNull()
    expect(screen.getByTestId(`measurement-entry-${e2.id}`)).toBeDefined()
    expect(loadBodyMetrics().length).toBe(1)
  })

  it('F13: delete middle record works cleanly', () => {
    const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
    const e2 = saveBodyMeasurement({ date: '2026-08-05', unit: 'cm', waist: 81 })
    const e3 = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 82 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${e2.id}`))
    fireEvent.click(screen.getByTestId('confirm-delete-measurement-btn'))

    expect(screen.queryByTestId(`measurement-entry-${e2.id}`)).toBeNull()
    expect(screen.getByTestId(`measurement-entry-${e1.id}`)).toBeDefined()
    expect(screen.getByTestId(`measurement-entry-${e3.id}`)).toBeDefined()
    expect(loadBodyMetrics().length).toBe(2)
  })

  it('F14: deleting the final remaining record returns to the empty state', () => {
    const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${e1.id}`))
    fireEvent.click(screen.getByTestId('confirm-delete-measurement-btn'))

    expect(screen.getByText(/No body measurements recorded yet/i)).toBeDefined()
    expect(screen.queryByTestId('body-measurement-history-list')).toBeNull()
    expect(loadBodyMetrics()).toEqual([])
  })

  it('F15: rapid repeated clicks on delete do not double-delete or crash', () => {
    const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
    const e2 = saveBodyMeasurement({ date: '2026-08-02', unit: 'cm', waist: 81 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${e1.id}`))
    const confirmBtn = screen.getByTestId('confirm-delete-measurement-btn')

    // Rapid double click
    fireEvent.click(confirmBtn)
    fireEvent.click(confirmBtn)

    expect(loadBodyMetrics().length).toBe(1)
    expect(loadBodyMetrics()[0].id).toBe(e2.id)
  })

  it('F16, F17, F18: accessible modal semantics, Escape key handling, and backdrop click', () => {
    const entry = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 85 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${entry.id}`))

    const modal = screen.getByTestId('delete-body-measurement-modal')
    expect(modal.getAttribute('role')).toBe('dialog')
    expect(modal.getAttribute('aria-modal')).toBe('true')
    expect(modal.getAttribute('aria-labelledby')).toBe('delete-measurement-title')
    expect(modal.getAttribute('aria-describedby')).toBe('delete-measurement-description')

    // Press Escape to dismiss
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('delete-body-measurement-modal')).toBeNull()
    expect(loadBodyMetrics().length).toBe(1)

    // Reopen and test backdrop click dismiss
    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${entry.id}`))
    const reopenedModal = screen.getByTestId('delete-body-measurement-modal')
    fireEvent.click(reopenedModal)
    expect(screen.queryByTestId('delete-body-measurement-modal')).toBeNull()
    expect(loadBodyMetrics().length).toBe(1)
  })

  it('F19: cross-tab storage deletion synchronizes via storage event', () => {
    const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
    const e2 = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 85 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    expect(screen.getByTestId(`measurement-entry-${e1.id}`)).toBeDefined()
    expect(screen.getByTestId(`measurement-entry-${e2.id}`)).toBeDefined()

    // Simulate another tab deleting e1
    deleteBodyMeasurement(e1.id)

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: BODY_METRICS_STORAGE_KEY,
          newValue: localStorage.getItem(BODY_METRICS_STORAGE_KEY)
        })
      )
    })

    // UI in this tab should update automatically
    expect(screen.queryByTestId(`measurement-entry-${e1.id}`)).toBeNull()
    expect(screen.getByTestId(`measurement-entry-${e2.id}`)).toBeDefined()
  })

  it('F20: full purge still removes all body measurement data completely', () => {
    saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
    expect(loadBodyMetrics().length).toBe(1)

    purgeAllUserData()

    expect(localStorage.getItem(BODY_METRICS_STORAGE_KEY)).toBeNull()
    expect(loadBodyMetrics()).toEqual([])
  })

  it('F21: no unexpected network request is generated on delete', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const entry = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 85 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${entry.id}`))
    fireEvent.click(screen.getByTestId('confirm-delete-measurement-btn'))

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('F22: no new consumer sink is introduced', () => {
    const writeTextMock = vi.fn()
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock }
    })
    const entry = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 85 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${entry.id}`))
    fireEvent.click(screen.getByTestId('confirm-delete-measurement-btn'))

    expect(writeTextMock).not.toHaveBeenCalled()
  })

  it('F23: sequential deletion of two different entries works correctly', () => {
    const e1 = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
    const e2 = saveBodyMeasurement({ date: '2026-08-05', unit: 'cm', waist: 82 })
    const e3 = saveBodyMeasurement({ date: '2026-08-10', unit: 'cm', waist: 84 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // Delete e1
    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${e1.id}`))
    fireEvent.click(screen.getByTestId('confirm-delete-measurement-btn'))

    // Delete e3
    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${e3.id}`))
    fireEvent.click(screen.getByTestId('confirm-delete-measurement-btn'))

    expect(loadBodyMetrics().length).toBe(1)
    expect(loadBodyMetrics()[0].id).toBe(e2.id)
  })

  it('F24: switching from record A to record B does not delete record A', () => {
    const eA = saveBodyMeasurement({ date: '2026-08-01', unit: 'cm', waist: 80 })
    const eB = saveBodyMeasurement({ date: '2026-08-02', unit: 'cm', waist: 85 })

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

    // Open modal for A
    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${eA.id}`))
    expect(screen.getByText(/Recorded on 2026-08-01/i)).toBeDefined()

    // Cancel modal
    fireEvent.click(screen.getByTestId('cancel-delete-measurement-btn'))

    // Open modal for B
    fireEvent.click(screen.getByTestId(`delete-measurement-btn-${eB.id}`))
    expect(screen.getByText(/Recorded on 2026-08-02/i)).toBeDefined()

    // Confirm deletion of B
    fireEvent.click(screen.getByTestId('confirm-delete-measurement-btn'))

    // Verify B is deleted, A remains intact!
    const stored = loadBodyMetrics()
    expect(stored.length).toBe(1)
    expect(stored[0].id).toBe(eA.id)
  })
})
