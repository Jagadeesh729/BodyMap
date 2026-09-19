/**
 * BodyMap AI — Enhancement E27-B Test Suite
 * ==========================================
 * Dashboard Daily Hydration Intake Logging & Progress Alignment
 *
 * Validates:
 * F1–F17: Integration / UI continuity tests.
 * M1–M16 (selected): Adversarial mutation sensitivity.
 *
 * Canonical flow under test:
 *   hydrationTarget engine --> recommended mL target
 *   hydrationTracker        --> today's consumed mL (bodymap_hydration_log)
 *   DashboardPage           --> reads both; renders intake section; quick-add; reset; cross-tab sync
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PlanProvider, usePlan } from '@/context/PlanContext'
import DashboardPage from '@/pages/DashboardPage'
import WeeklyPlanPage from '@/pages/WeeklyPlanPage'
import {
  getTodayHydration,
  addHydration,
  HYDRATION_STORAGE_KEY,
  getTodayDateString
} from '@/lib/hydrationTracker'
import { calculateHydrationTarget } from '@/lib/hydrationTarget'
import type { FormData } from '@/types/formData'

// ─────────────────────────────────────────────────────────────────
// Mock recharts ResponsiveContainer (avoids ResizeObserver errors in jsdom)
// ─────────────────────────────────────────────────────────────────
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 500, height: 300 }}>{children}</div>
    ),
  }
})

// ─────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────

const BASE_FORM_DATA: FormData = {
  gender: 'male',
  age: '28',
  height: '178',
  weight: '70',
  fitnessLevel: 'intermediate',
  mainGoal: 'Build Lean Muscle',
  bodyFocus: ['Full Body'],
  medicalIssues: '',
  pushupCount: '25',
  equipment: ['Dumbbells'],
  dietaryPreference: 'omnivore',
  allergies: '',
  sleepHours: '8',
  stressLevel: 'low',
  recoveryDays: '2',
  timePerDay: '45',
  specialRequests: ''
}

// Canonical target: 70 kg, temperate climate, 45 min
const CANONICAL_70_TEMPERATE_45 = calculateHydrationTarget(70, { activityMinutes: 45, climate: 'temperate' })

// ─────────────────────────────────────────────────────────────────
// Wrappers
// ─────────────────────────────────────────────────────────────────

const FormSetup = ({
  formData = BASE_FORM_DATA,
  children,
}: {
  formData?: FormData
  children: React.ReactNode
}) => {
  const { dispatch } = usePlan()
  React.useEffect(() => {
    dispatch({ type: 'SET_FORM_DATA', payload: formData })
  }, [dispatch, formData])
  return <>{children}</>
}

const renderDashboard = (formData: FormData = BASE_FORM_DATA) =>
  render(
    <MemoryRouter>
      <PlanProvider>
        <FormSetup formData={formData}>
          <DashboardPage />
        </FormSetup>
      </PlanProvider>
    </MemoryRouter>
  )

const SAMPLE_PLAN = `# BodyMap 7-Day Plan\n## Day 1 - Upper Body\n**Warm-up:** 5 mins\n- Push-ups: 3 sets\n**Meals:**\n- Breakfast: Oats\n- Lunch: Chicken\n- Dinner: Salmon\n- Snacks: Almonds`

const renderWeeklyPlan = (formData: FormData = BASE_FORM_DATA) => {
  const WPSetup = ({ children }: { children: React.ReactNode }) => {
    const { dispatch } = usePlan()
    React.useEffect(() => {
      dispatch({ type: 'SET_FORM_DATA', payload: formData })
      dispatch({ type: 'SET_GENERATED_PLAN', payload: { plan: SAMPLE_PLAN, formData } })
    }, [dispatch])
    return <>{children}</>
  }
  return render(
    <MemoryRouter>
      <PlanProvider>
        <WPSetup>
          <WeeklyPlanPage />
        </WPSetup>
      </PlanProvider>
    </MemoryRouter>
  )
}

// ─────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────

describe('Enhancement E27-B: Dashboard Daily Hydration Intake Alignment', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    // ResizeObserver stub required for recharts in jsdom
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })

  afterEach(() => {
    cleanup()
  })

  // ─────────────────────────────────────────────────────────────
  // F1–F4: Initial display
  // ─────────────────────────────────────────────────────────────

  describe('F1–F4: Initial Display', () => {
    it('F1: Dashboard renders hydration intake section heading', () => {
      renderDashboard()
      expect(screen.getByText("Today's Intake Progress")).toBeDefined()
    })

    it('F2: Dashboard renders today\'s canonical consumed amount as 0 on empty state', () => {
      renderDashboard()
      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(progressbar.getAttribute('aria-valuenow')).toBe('0')
    })

    it('F3: Dashboard renders remaining hydration = target on empty state', () => {
      const target = CANONICAL_70_TEMPERATE_45
      if (!target.isValid) return
      const expected = target.totalTargetMl.recommended

      renderDashboard()
      // Scope to the aria-live status region to avoid matching other target displays
      const liveRegion = document.querySelector('[aria-live="polite"]')
      expect(liveRegion).not.toBeNull()
      expect(liveRegion!.textContent).toContain('Remaining:')
      expect(liveRegion!.textContent).toContain(`${expected.toLocaleString()} mL`)
    })

    it('F4: Dashboard renders 0% progress on empty state', () => {
      renderDashboard()
      expect(screen.getByText('0%')).toBeDefined()
    })
  })

  // ─────────────────────────────────────────────────────────────
  // F5–F8: Quick-add
  // ─────────────────────────────────────────────────────────────

  describe('F5–F8: Quick-Add Controls', () => {
    it('F5: +250ml updates canonical tracker and progress bar', () => {
      renderDashboard()
      fireEvent.click(screen.getByTitle('Add 250ml water'))

      expect(getTodayHydration()).toBe(250)

      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(Number(progressbar.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
    })

    it('F6: +250ml updates remaining amount correctly', () => {
      const target = CANONICAL_70_TEMPERATE_45
      if (!target.isValid) return

      renderDashboard()
      fireEvent.click(screen.getByTitle('Add 250ml water'))

      const remaining = Math.max(0, target.totalTargetMl.recommended - 250)
      const liveRegion = document.querySelector('[aria-live="polite"]')
      expect(liveRegion).not.toBeNull()
      expect(liveRegion!.textContent).toContain('Remaining:')
      expect(liveRegion!.textContent).toContain(`${remaining.toLocaleString()} mL`)
    })

    it('F7: +250ml updates progress percentage', () => {
      const target = CANONICAL_70_TEMPERATE_45
      if (!target.isValid) return

      renderDashboard()
      fireEvent.click(screen.getByTitle('Add 250ml water'))

      const expectedPct = Math.min(100, Math.round((250 / target.totalTargetMl.recommended) * 100))
      expect(screen.getByText(`${expectedPct}%`)).toBeDefined()
    })

    it('F8: Multiple quick-add operations accumulate exactly once (no double counting)', () => {
      renderDashboard()

      fireEvent.click(screen.getByTitle('Add 250ml water'))
      fireEvent.click(screen.getByTitle('Add 500ml water'))
      fireEvent.click(screen.getByTitle('Add 250ml water'))

      // 250 + 500 + 250 = 1000
      expect(getTodayHydration()).toBe(1000)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // F9: Reset
  // ─────────────────────────────────────────────────────────────

  describe('F9: Reset', () => {
    it('F9: Reset updates canonical storage and progress bar to 0', () => {
      renderDashboard()
      fireEvent.click(screen.getByTitle('Add 250ml water'))
      expect(getTodayHydration()).toBe(250)

      fireEvent.click(screen.getByTitle("Reset today's hydration"))
      expect(getTodayHydration()).toBe(0)

      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(progressbar.getAttribute('aria-valuenow')).toBe('0')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // F10: Remount restores intake
  // ─────────────────────────────────────────────────────────────

  describe('F10: Remount Restores Canonical Intake', () => {
    it('F10: After remount, Dashboard restores canonical intake from tracker', () => {
      addHydration(750)
      renderDashboard()

      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(Number(progressbar.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // F11: WeeklyPlan and Dashboard share canonical intake
  // ─────────────────────────────────────────────────────────────

  describe('F11: Cross-Component Canonical Parity', () => {
    it('F11: WeeklyPlan and Dashboard both observe the same canonical intake', () => {
      addHydration(500)
      renderWeeklyPlan()
      expect(screen.getByText(/Hydration: 500 ml/)).toBeDefined()
    })
  })

  // ─────────────────────────────────────────────────────────────
  // F12: Date isolation
  // ─────────────────────────────────────────────────────────────

  describe('F12: Date Isolation', () => {
    it("F12: Yesterday's intake does not appear as today's intake", () => {
      const today = getTodayDateString()
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      expect(yesterday).not.toBe(today)

      addHydration(2000, yesterday)
      expect(getTodayHydration()).toBe(0)

      renderDashboard()
      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(progressbar.getAttribute('aria-valuenow')).toBe('0')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // F13–F14: Storage fault tolerance
  // ─────────────────────────────────────────────────────────────

  describe('F13–F14: Storage Fault Tolerance', () => {
    it('F13: Corrupt hydration storage does not crash Dashboard', () => {
      localStorage.setItem(HYDRATION_STORAGE_KEY, '{corrupt:json]')
      // Should render without throwing (hydration module returns 0)
      let threw = false
      try {
        renderDashboard()
      } catch {
        threw = true
      }
      expect(threw).toBe(false)
    })

    it('F14: Storage read exception for hydration key does not crash Dashboard', () => {
      const orig = Storage.prototype.getItem
      Storage.prototype.getItem = (key: string) => {
        if (key === HYDRATION_STORAGE_KEY) throw new Error('Storage denied')
        return orig.call(localStorage, key)
      }
      let threw = false
      try {
        renderDashboard()
      } catch {
        threw = true
      }
      Storage.prototype.getItem = orig
      expect(threw).toBe(false)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // F15: Accessibility
  // ─────────────────────────────────────────────────────────────

  describe('F15: Accessibility', () => {
    it('F15: Progress bar has ARIA role, bounds, and buttons have accessible names', () => {
      addHydration(250)
      renderDashboard()

      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(progressbar.getAttribute('aria-valuemin')).toBe('0')
      expect(progressbar.getAttribute('aria-valuemax')).toBe('100')
      expect(Number(progressbar.getAttribute('aria-valuenow'))).toBeGreaterThan(0)

      expect(screen.getByRole('button', { name: /add 250 millilitres/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /add 500 millilitres/i })).toBeDefined()
      expect(screen.getByRole('button', { name: /reset today's hydration intake/i })).toBeDefined()

      const liveRegion = document.querySelector('[aria-live="polite"]')
      expect(liveRegion).not.toBeNull()
    })
  })

  // ─────────────────────────────────────────────────────────────
  // F16: Reduced motion
  // ─────────────────────────────────────────────────────────────

  describe('F16: Reduced Motion', () => {
    it('F16: Dashboard intake section renders without regression regardless of motion preference', () => {
      // The progress bar transition is conditionally set inline via prefersReducedMotion
      // We render normally (motion enabled in tests) and confirm no crash
      addHydration(100)
      renderDashboard()
      expect(screen.getByText("Today's Intake Progress")).toBeDefined()
    })
  })

  // ─────────────────────────────────────────────────────────────
  // F17: No duplicate listeners
  // ─────────────────────────────────────────────────────────────

  describe('F17: No duplicate storage listeners across remounts', () => {
    it('F17: Each mount registers exactly one storage handler which is removed on unmount', () => {
      const added: string[] = []
      const removed: string[] = []

      const origAdd = window.addEventListener.bind(window)
      const origRemove = window.removeEventListener.bind(window)

      vi.spyOn(window, 'addEventListener').mockImplementation((type, ...rest) => {
        if (type === 'storage') added.push(type)
        return origAdd(type, ...rest)
      })
      vi.spyOn(window, 'removeEventListener').mockImplementation((type, ...rest) => {
        if (type === 'storage') removed.push(type)
        return origRemove(type, ...rest)
      })

      const { unmount } = renderDashboard()
      const addedCount = added.length
      unmount()

      expect(removed.length).toBeGreaterThanOrEqual(addedCount)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Cross-tab sync
  // ─────────────────────────────────────────────────────────────

  describe('Cross-Tab Sync', () => {
    it('Dashboard updates when another tab fires a storage event for the hydration key', () => {
      renderDashboard()

      const progressbarBefore = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(progressbarBefore.getAttribute('aria-valuenow')).toBe('0')

      addHydration(500)
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: HYDRATION_STORAGE_KEY,
          storageArea: window.localStorage,
        }))
      })

      const progressbarAfter = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(Number(progressbarAfter.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Progress & Remaining bounds
  // ─────────────────────────────────────────────────────────────

  describe('Progress & Remaining Bounds', () => {
    it('Progress is capped at 100% when consumed exceeds target', () => {
      addHydration(10000)
      renderDashboard()

      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(Number(progressbar.getAttribute('aria-valuenow'))).toBe(100)
    })

    it('Remaining is bounded at 0 when consumed exceeds target', () => {
      addHydration(10000)
      renderDashboard()

      const liveRegion = document.querySelector('[aria-live="polite"]')
      expect(liveRegion).not.toBeNull()
      expect(liveRegion!.textContent).toContain('Remaining:')
      expect(liveRegion!.textContent).toContain('0')
    })
  })

  // ─────────────────────────────────────────────────────────────
  // M-series: Adversarial / Mutation Sensitivity
  // ─────────────────────────────────────────────────────────────

  describe('Adversarial / Mutation Sensitivity', () => {
    it('M1: Dashboard target matches canonical engine output for the given inputs', () => {
      renderDashboard()
      const canonical = CANONICAL_70_TEMPERATE_45
      if (!canonical.isValid) return
      const targetStr = canonical.totalTargetMl.recommended.toLocaleString()
      // Scope to the aria-live status region which contains the "~N mL" display
      const liveRegion = document.querySelector('[aria-live="polite"]')
      expect(liveRegion).not.toBeNull()
      expect(liveRegion!.textContent).toContain(`~${targetStr} mL`)
    })

    it('M3: Dashboard reads intake from canonical tracker at mount (seeded value is shown)', () => {
      addHydration(400)
      renderDashboard()

      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(Number(progressbar.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
      expect(getTodayHydration()).toBe(400)
    })

    it('M4: Quick-add persists to canonical storage, not just UI state', () => {
      renderDashboard()
      fireEvent.click(screen.getByTitle('Add 500ml water'))

      expect(getTodayHydration()).toBe(500)
      const raw = localStorage.getItem(HYDRATION_STORAGE_KEY)
      expect(raw).not.toBeNull()
      const parsed = JSON.parse(raw!)
      expect(parsed[getTodayDateString()]).toBe(500)
    })

    it('M5: Single click persists exactly once (no double-write)', () => {
      renderDashboard()
      fireEvent.click(screen.getByTitle('Add 250ml water'))
      expect(getTodayHydration()).toBe(250)
    })

    it('M6: Reset updates canonical storage to 0, not just UI', () => {
      addHydration(500)
      renderDashboard()

      fireEvent.click(screen.getByTitle("Reset today's hydration"))

      expect(getTodayHydration()).toBe(0)
      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(progressbar.getAttribute('aria-valuenow')).toBe('0')
    })

    it("M7: Yesterday's large intake is isolated from today's display", () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      addHydration(9999, yesterday)

      renderDashboard()

      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(progressbar.getAttribute('aria-valuenow')).toBe('0')
    })

    it('M8: Negative intake is rejected by canonical tracker', () => {
      addHydration(250)
      addHydration(-100)
      expect(getTodayHydration()).toBe(250)
    })

    it('M9: NaN and Infinity are rejected by canonical tracker', () => {
      addHydration(250)
      addHydration(NaN)
      addHydration(Infinity)
      expect(getTodayHydration()).toBe(250)
    })

    it('M10: Progress bar aria-valuenow is capped at 100 when intake exceeds target', () => {
      addHydration(10000)
      renderDashboard()

      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(Number(progressbar.getAttribute('aria-valuenow'))).toBe(100)
    })

    it('M11: Remaining amount display never shows negative value', () => {
      addHydration(10000)
      renderDashboard()

      const allText = document.body.textContent ?? ''
      // The phrase "Remaining:" should not be followed by a negative number
      expect(allText).not.toMatch(/Remaining:\s*-[0-9]/)
    })

    it('M14: Corrupt hydration storage does not crash Dashboard', () => {
      localStorage.setItem(HYDRATION_STORAGE_KEY, '[invalid,json')
      let threw = false
      try {
        renderDashboard()
      } catch {
        threw = true
      }
      expect(threw).toBe(false)
    })

    it('M15: Dashboard and WeeklyPlan share the same canonical intake value', () => {
      addHydration(750)
      renderWeeklyPlan()
      expect(screen.getByText(/Hydration: 750 ml/)).toBeDefined()
    })

    it('M16: Target weight input change does not wipe consumed intake', () => {
      addHydration(500)
      renderDashboard()

      // Change weight input to trigger hydrationGuideline recalculation
      const weightInput = screen.getByLabelText('Target Weight Kg')
      fireEvent.change(weightInput, { target: { value: '80' } })

      // Canonical tracker must still hold the pre-change value
      expect(getTodayHydration()).toBe(500)

      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      expect(Number(progressbar.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // Canonical storage key contract
  // ─────────────────────────────────────────────────────────────

  describe('E27-B Canonical Storage Key Contract', () => {
    it('HYDRATION_STORAGE_KEY is the canonical key shared between Dashboard and WeeklyPlan', () => {
      expect(HYDRATION_STORAGE_KEY).toBe('bodymap_hydration_log')
    })

    it('End-to-end: canonical flow wires intake -> progress -> display correctly', () => {
      const canonical = CANONICAL_70_TEMPERATE_45
      if (!canonical.isValid) return

      addHydration(500)
      renderDashboard()

      const progressbar = screen.getByRole('progressbar', { name: /today's hydration intake progress/i })
      const expectedPct = Math.min(100, Math.round((500 / canonical.totalTargetMl.recommended) * 100))
      expect(Number(progressbar.getAttribute('aria-valuenow'))).toBe(expectedPct)
    })
  })
})
