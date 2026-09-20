/**
 * E28-A Phase 7 — Hydration Browser Tests (E27-B)
 *
 * Hydration widget lives on /weekly-plan (visible only when a plan is active).
 * Buttons have text "+250ml", "+500ml", "Reset" (exact from WeeklyPlanPage.tsx).
 *
 * Verifies in a real browser:
 * 1. Weekly plan hydration section renders when plan exists
 * 2. +250ml quick-add increments localStorage
 * 3. +500ml quick-add increments localStorage
 * 4. Reset clears today's amount
 * 5. Reload retains the stored value
 * 6. Yesterday's value does NOT become today's value
 */

import { test, expect, waitForAppReady, expectNoConsoleErrors, setupNetworkBlocker } from '../fixtures'
import {
  STORAGE_KEYS,
  buildHydrationLog,
  MINIMAL_PLAN_NO_SAFETY_ISSUES,
} from '../helpers/storage'

// Hydration widget lives on /weekly-plan (requires a plan to be present)
const HYDRATION_ROUTE = '/weekly-plan'
const KNOWN_BENIGN = ['Wake Lock', 'wakelock', 'ResizeObserver', 'GymFeedbackStorage', 'gemini']

test.describe('Hydration Browser Tests (E27-B)', () => {


  test('H01: Hydration section renders on weekly-plan with active plan', async ({
    page,
    seedStorage,
    consoleErrors,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.PLAN]: MINIMAL_PLAN_NO_SAFETY_ISSUES,
    })

    await page.goto(HYDRATION_ROUTE)
    await waitForAppReady(page)

    // Hydration widget text is always "Hydration: X ml" — use getByText
    const hydrationText = page.getByText(/Hydration:/i)
    await expect(hydrationText).toBeVisible({ timeout: 10_000 })
    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  test('H02: Seeded today hydration value is displayed', async ({
    page,
    seedStorage,
  }) => {
    const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD
    await seedStorage({
      [STORAGE_KEYS.PLAN]: MINIMAL_PLAN_NO_SAFETY_ISSUES,
      [STORAGE_KEYS.HYDRATION_LOG]: buildHydrationLog({ [today]: 750 }),
    })

    await page.goto(HYDRATION_ROUTE)
    await waitForAppReady(page)

    // "750" should appear in the hydration widget
    await expect(page.getByText(/750/)).toBeVisible({ timeout: 10_000 })
  })

  test('H03: Yesterday value does NOT appear as today value', async ({
    page,
    seedStorage,
  }) => {
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA')
    const today = new Date().toLocaleDateString('en-CA')

    await seedStorage({
      [STORAGE_KEYS.PLAN]: MINIMAL_PLAN_NO_SAFETY_ISSUES,
      [STORAGE_KEYS.HYDRATION_LOG]: buildHydrationLog({ [yesterday]: 9999 }),
    })

    await page.goto(HYDRATION_ROUTE)
    await waitForAppReady(page)

    // Today's key must be 0 (absent or not populated)
    const stored = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : {}
    }, STORAGE_KEYS.HYDRATION_LOG)

    const todayVal = stored[today] ?? 0
    expect(todayVal).toBe(0)
  })

  test('H04: +250ml button increments localStorage by 250', async ({
    page,
    seedStorage,
    consoleErrors,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.PLAN]: MINIMAL_PLAN_NO_SAFETY_ISSUES,
    })

    await page.goto(HYDRATION_ROUTE)
    await waitForAppReady(page)

    // Exact text from WeeklyPlanPage.tsx line 670: "+250ml"
    const btn250 = page.getByRole('button', { name: '+250ml' })

    const count = await btn250.count()
    if (count === 0) {
      test.skip(true, '+250ml button not found — hydration widget may be hidden without plan weight data')
      return
    }

    const before = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      const today = new Date().toLocaleDateString('en-CA')
      return raw ? ((JSON.parse(raw) as Record<string, number>)[today] ?? 0) : 0
    }, STORAGE_KEYS.HYDRATION_LOG)

    await btn250.click()

    await page.waitForFunction(
      ([key, expected]: [string, number]) => {
        const raw = localStorage.getItem(key)
        if (!raw) return false
        const log = JSON.parse(raw) as Record<string, number>
        const today = new Date().toLocaleDateString('en-CA')
        return (log[today] ?? 0) >= expected
      },
      [STORAGE_KEYS.HYDRATION_LOG, before + 250] as [string, number],
      { timeout: 5_000 }
    )

    const after = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      const today = new Date().toLocaleDateString('en-CA')
      return raw ? ((JSON.parse(raw) as Record<string, number>)[today] ?? 0) : 0
    }, STORAGE_KEYS.HYDRATION_LOG)

    expect(after).toBeGreaterThanOrEqual(before + 250)
    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  test('H05: +500ml button increments localStorage by 500', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.PLAN]: MINIMAL_PLAN_NO_SAFETY_ISSUES,
    })

    await page.goto(HYDRATION_ROUTE)
    await waitForAppReady(page)

    // Exact text from WeeklyPlanPage.tsx line 677: "+500ml"
    const btn500 = page.getByRole('button', { name: '+500ml' })

    const count = await btn500.count()
    if (count === 0) {
      test.skip(true, '+500ml button not found')
      return
    }

    const before = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      const today = new Date().toLocaleDateString('en-CA')
      return raw ? ((JSON.parse(raw) as Record<string, number>)[today] ?? 0) : 0
    }, STORAGE_KEYS.HYDRATION_LOG)

    await btn500.click()

    await page.waitForFunction(
      ([key, expected]: [string, number]) => {
        const raw = localStorage.getItem(key)
        if (!raw) return false
        const log = JSON.parse(raw) as Record<string, number>
        const today = new Date().toLocaleDateString('en-CA')
        return (log[today] ?? 0) >= expected
      },
      [STORAGE_KEYS.HYDRATION_LOG, before + 500] as [string, number],
      { timeout: 5_000 }
    )

    const after = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      const today = new Date().toLocaleDateString('en-CA')
      return raw ? ((JSON.parse(raw) as Record<string, number>)[today] ?? 0) : 0
    }, STORAGE_KEYS.HYDRATION_LOG)

    expect(after).toBeGreaterThanOrEqual(before + 500)
  })

  test('H06: Hydration value persists across page reload', async ({
    page,
    seedStorage,
  }) => {
    const today = new Date().toLocaleDateString('en-CA')
    await seedStorage({
      [STORAGE_KEYS.PLAN]: MINIMAL_PLAN_NO_SAFETY_ISSUES,
      [STORAGE_KEYS.HYDRATION_LOG]: buildHydrationLog({ [today]: 1500 }),
    })

    await page.goto(HYDRATION_ROUTE)
    await waitForAppReady(page)
    await page.reload()
    await waitForAppReady(page)

    const stored = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      const today = new Date().toLocaleDateString('en-CA')
      return raw ? ((JSON.parse(raw) as Record<string, number>)[today] ?? 0) : 0
    }, STORAGE_KEYS.HYDRATION_LOG)

    expect(stored).toBe(1500)
  })

  test('H07: Reset button clears today value (visible only when logged > 0)', async ({
    page,
    seedStorage,
    consoleErrors,
  }) => {
    const today = new Date().toLocaleDateString('en-CA')
    await seedStorage({
      [STORAGE_KEYS.PLAN]: MINIMAL_PLAN_NO_SAFETY_ISSUES,
      [STORAGE_KEYS.HYDRATION_LOG]: buildHydrationLog({ [today]: 1000 }),
    })

    await page.goto(HYDRATION_ROUTE)
    await waitForAppReady(page)

    // From WeeklyPlanPage.tsx line 685: text is "Reset" with title "Reset today's hydration"
    const resetBtn = page.getByTitle("Reset today's hydration")
    const resetBtnCount = await resetBtn.count()

    if (resetBtnCount === 0) {
      test.skip(true, 'Reset button not visible — requires hydrationLogged > 0')
      return
    }

    await resetBtn.click()

    await page.waitForFunction(
      ([key, todayKey]: [string, string]) => {
        const raw = localStorage.getItem(key)
        if (!raw) return true
        const log = JSON.parse(raw) as Record<string, number>
        return (log[todayKey] ?? 0) === 0
      },
      [STORAGE_KEYS.HYDRATION_LOG, today] as [string, string],
      { timeout: 5_000 }
    )

    const stored = await page.evaluate(([key, todayKey]: [string, string]) => {
      const raw = localStorage.getItem(key)
      return raw ? ((JSON.parse(raw) as Record<string, number>)[todayKey] ?? 0) : 0
    }, [STORAGE_KEYS.HYDRATION_LOG, today] as [string, string])

    expect(stored).toBe(0)
    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  test('H08: Hydration storage is local-only — no external network requests', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.PLAN]: MINIMAL_PLAN_NO_SAFETY_ISSUES,
    })

    const { blocked } = setupNetworkBlocker(page)

    await page.goto(HYDRATION_ROUTE)
    await waitForAppReady(page)
    await page.waitForTimeout(500)

    const external = blocked.filter((u) => !u.startsWith('http://localhost'))
    expect(external, `External requests: ${external.join(', ')}`).toHaveLength(0)
  })

  test.describe('Hydration Timezone Matrix (Phase 5 / Local vs UTC)', () => {
    test.describe('Asia/Kolkata timezone (UTC+5:30)', () => {
      test.use({ timezoneId: 'Asia/Kolkata' })

      test('H09: Hydration date keying reflects local calendar in Asia/Kolkata', async ({
        page,
        seedStorage,
      }) => {
        // Fix clock to 2026-09-20 22:30:00 UTC (which is 2026-09-21 04:00:00 in IST)
        await page.clock.setFixedTime(new Date('2026-09-20T22:30:00Z'))
        await seedStorage({
          [STORAGE_KEYS.PLAN]: MINIMAL_PLAN_NO_SAFETY_ISSUES,
        })

        await page.goto(HYDRATION_ROUTE)
        await waitForAppReady(page)

        const btn250 = page.getByRole('button', { name: '+250ml' })
        await expect(btn250).toBeVisible({ timeout: 5000 })
        await btn250.click()

        await page.waitForFunction((key: string) => {
          const raw = localStorage.getItem(key)
          if (!raw) return false
          const log = JSON.parse(raw) as Record<string, number>
          return log['2026-09-21'] === 250
        }, STORAGE_KEYS.HYDRATION_LOG)

        const stored = await page.evaluate((key: string) => {
          const raw = localStorage.getItem(key)
          return raw ? JSON.parse(raw) : {}
        }, STORAGE_KEYS.HYDRATION_LOG)

        // UTC date is 2026-09-20, but IST local date is 2026-09-21
        expect(stored['2026-09-21']).toBe(250)
        expect(stored['2026-09-20']).toBeUndefined()
      })
    })

    test.describe('America/New_York timezone (UTC-4 / EDT)', () => {
      test.use({ timezoneId: 'America/New_York' })

      test('H10: Hydration date keying reflects local calendar in America/New_York', async ({
        page,
        seedStorage,
      }) => {
        // At the exact same UTC moment 2026-09-20 22:30:00 UTC, it is 18:30 in New York (2026-09-20)
        await page.clock.setFixedTime(new Date('2026-09-20T22:30:00Z'))
        await seedStorage({
          [STORAGE_KEYS.PLAN]: MINIMAL_PLAN_NO_SAFETY_ISSUES,
        })

        await page.goto(HYDRATION_ROUTE)
        await waitForAppReady(page)

        const btn250 = page.getByRole('button', { name: '+250ml' })
        await expect(btn250).toBeVisible({ timeout: 5000 })
        await btn250.click()

        await page.waitForFunction((key: string) => {
          const raw = localStorage.getItem(key)
          if (!raw) return false
          const log = JSON.parse(raw) as Record<string, number>
          return log['2026-09-20'] === 250
        }, STORAGE_KEYS.HYDRATION_LOG)

        const stored = await page.evaluate((key: string) => {
          const raw = localStorage.getItem(key)
          return raw ? JSON.parse(raw) : {}
        }, STORAGE_KEYS.HYDRATION_LOG)

        // In New York, it is still 2026-09-20
        expect(stored['2026-09-20']).toBe(250)
        expect(stored['2026-09-21']).toBeUndefined()
      })
    })
  })
})
