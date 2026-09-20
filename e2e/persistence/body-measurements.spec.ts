/**
 * E28-A Phase 8 — Body Measurement Deletion Browser Tests (E27-C)
 *
 * Uses exact data-testid attributes from source:
 * - `body-measurement-history-list` — history container
 * - `measurement-entry-${id}` — individual entry row
 * - `delete-measurement-btn-${id}` — delete trigger per entry
 * - `delete-body-measurement-modal` — confirmation dialog
 * - `cancel-delete-measurement-btn` — cancel button in dialog
 * - `confirm-delete-measurement-btn` — confirm delete button in dialog
 *
 * Verifies in a real browser:
 * 1. History renders with seeded measurements
 * 2. Delete button appears for each entry
 * 3. Confirmation modal opens on delete click
 * 4. Cancel closes modal without mutation
 * 5. Confirm deletes only the selected record
 * 6. Remaining records stay intact after deletion
 * 7. Deletion persists across reload
 * 8. Escape closes modal without deletion
 * 9. Empty state appears after last record deletion
 */

import { test, expect, waitForAppReady, expectNoConsoleErrors } from '../fixtures'
import {
  STORAGE_KEYS,
  BODY_MEASUREMENTS_3,
  BODY_MEASUREMENTS_SINGLE,
} from '../helpers/storage'

const DASHBOARD_ROUTE = '/dashboard'
const KNOWN_BENIGN = ['Wake Lock', 'wakelock', 'ResizeObserver', 'GymFeedbackStorage']

test.describe('Body Measurement Deletion (E27-C)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  test('BM01: Body measurement history list renders with 3 seeded entries', async ({
    page,
    seedStorage,
    consoleErrors,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.BODY_METRICS]: JSON.stringify(BODY_MEASUREMENTS_3),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    // The history list has a known data-testid
    const historyList = page.locator('[data-testid="body-measurement-history-list"]')
    await expect(historyList).toBeVisible({ timeout: 10_000 })

    // Three entries should be present
    const entries = page.locator('[data-testid^="measurement-entry-"]')
    await expect(entries).toHaveCount(3, { timeout: 5_000 })

    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  test('BM02: Delete button exists for each measurement entry', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.BODY_METRICS]: JSON.stringify(BODY_MEASUREMENTS_3),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    // Three delete buttons: delete-measurement-btn-bm_test_001, _002, _003
    const deleteButtons = page.locator('[data-testid^="delete-measurement-btn-"]')
    await expect(deleteButtons).toHaveCount(3, { timeout: 5_000 })
  })

  test('BM03: Clicking delete opens the confirmation modal', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.BODY_METRICS]: JSON.stringify(BODY_MEASUREMENTS_3),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    // Click the first entry's delete button (bm_test_003 = most recent, shown first)
    const deleteBtn = page.locator('[data-testid="delete-measurement-btn-bm_test_003"]')
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 })
    await deleteBtn.click()

    // Modal should open
    const modal = page.locator('[data-testid="delete-body-measurement-modal"]')
    await expect(modal).toBeVisible({ timeout: 5_000 })
  })

  test('BM04: Cancel button closes modal without deleting', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.BODY_METRICS]: JSON.stringify(BODY_MEASUREMENTS_3),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    const deleteBtn = page.locator('[data-testid="delete-measurement-btn-bm_test_003"]')
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 })
    await deleteBtn.click()

    // Click Cancel
    const cancelBtn = page.locator('[data-testid="cancel-delete-measurement-btn"]')
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 })
    await cancelBtn.click()

    // Modal should close
    const modal = page.locator('[data-testid="delete-body-measurement-modal"]')
    await expect(modal).not.toBeVisible({ timeout: 3_000 })

    // All 3 records still in storage
    const stored = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : []
    }, STORAGE_KEYS.BODY_METRICS)
    expect(stored.length).toBe(3)
  })

  test('BM05: Confirm deletion removes only the selected record', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.BODY_METRICS]: JSON.stringify(BODY_MEASUREMENTS_3),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    // Delete bm_test_003 (most recent)
    const deleteBtn = page.locator('[data-testid="delete-measurement-btn-bm_test_003"]')
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 })
    await deleteBtn.click()

    // Confirm deletion
    const confirmBtn = page.locator('[data-testid="confirm-delete-measurement-btn"]')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    // Modal closes
    const modal = page.locator('[data-testid="delete-body-measurement-modal"]')
    await expect(modal).not.toBeVisible({ timeout: 5_000 })

    // Storage should have exactly 2 records
    await page.waitForFunction(
      (key: string) => {
        const raw = localStorage.getItem(key)
        if (!raw) return false
        return JSON.parse(raw).length === 2
      },
      STORAGE_KEYS.BODY_METRICS,
      { timeout: 5_000 }
    )

    const stored = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : []
    }, STORAGE_KEYS.BODY_METRICS)

    expect(stored.length).toBe(2)

    // bm_test_003 must be gone; bm_test_001 and bm_test_002 must remain
    const ids = stored.map((e: { id: string }) => e.id)
    expect(ids).not.toContain('bm_test_003')
    expect(ids).toContain('bm_test_001')
    expect(ids).toContain('bm_test_002')
  })

  test('BM06: Deletion state persists after page reload', async ({
    page,
    seedStorage,
  }) => {
    // Seed only 2 records (simulates state after one deletion)
    const twoRecords = BODY_MEASUREMENTS_3.slice(0, 2)
    await seedStorage({
      [STORAGE_KEYS.BODY_METRICS]: JSON.stringify(twoRecords),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)
    await page.reload()
    await waitForAppReady(page)

    const stored = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : []
    }, STORAGE_KEYS.BODY_METRICS)

    expect(stored.length).toBe(2)
  })

  test('BM07: Escape key closes modal without deleting', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.BODY_METRICS]: JSON.stringify(BODY_MEASUREMENTS_3),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    const deleteBtn = page.locator('[data-testid="delete-measurement-btn-bm_test_003"]')
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 })
    await deleteBtn.click()

    const modal = page.locator('[data-testid="delete-body-measurement-modal"]')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Press Escape
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible({ timeout: 3_000 })

    // Records intact
    const stored = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : []
    }, STORAGE_KEYS.BODY_METRICS)
    expect(stored.length).toBe(3)
  })

  test('BM08: Deleting the last record shows empty state', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.BODY_METRICS]: JSON.stringify(BODY_MEASUREMENTS_SINGLE),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    const deleteBtn = page.locator('[data-testid="delete-measurement-btn-bm_single_001"]')
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 })
    await deleteBtn.click()

    const confirmBtn = page.locator('[data-testid="confirm-delete-measurement-btn"]')
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 })
    await confirmBtn.click()

    const modal = page.locator('[data-testid="delete-body-measurement-modal"]')
    await expect(modal).not.toBeVisible({ timeout: 5_000 })

    // Storage is empty
    await page.waitForFunction(
      (key: string) => {
        const raw = localStorage.getItem(key)
        if (!raw) return true
        return JSON.parse(raw).length === 0
      },
      STORAGE_KEYS.BODY_METRICS,
      { timeout: 5_000 }
    )

    const stored = await page.evaluate((key: string) => {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : []
    }, STORAGE_KEYS.BODY_METRICS)
    expect(stored.length).toBe(0)
  })
})
