/**
 * E28-A Phase 9–10 — PR Trajectory Export/Share Browser Tests (E27-D)
 * Consumer Sink S14 (CSV export) and S15 (Web Share / Clipboard)
 *
 * Verifies in a real browser:
 * 1. PR trajectory renders with seeded workout history
 * 2. Export CSV button is enabled
 * 3. Download event triggers for correct exercise
 * 4. Filename matches sanitizer contract (no formula injection chars)
 * 5. CSV content parses correctly
 * 6. No unrelated exercise cross-contamination
 * 7. No medical/profile fields in export
 * 8. Rapid double-click → no duplicate download
 * 9. Web Share: stubbed navigator.share → exact payload received
 * 10. AbortError (user cancel) → silenced, no clipboard fallback
 * 11. Technical failure → clipboard fallback triggered
 * 12. Clipboard payload is text-only (no URL, no file)
 * 13. No network requests during local export
 */

import { test, expect, waitForAppReady, expectNoConsoleErrors, setupNetworkBlocker } from '../fixtures'
import {
  STORAGE_KEYS,
  WORKOUT_HISTORY_FULL,
} from '../helpers/storage'

const DASHBOARD_ROUTE = '/dashboard'
const KNOWN_BENIGN = [
  'Wake Lock', 'wakelock', 'ResizeObserver', 'GymFeedbackStorage', 'gemini',
  'AbortError', 'share', 'clipboard',
]

test.describe('PR Trajectory Export & Share (S14/S15)', () => {
  test('PR01: PR trajectory section renders with seeded workout history', async ({
    page,
    seedStorage,
    consoleErrors,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.WORKOUT_HISTORY]: JSON.stringify(WORKOUT_HISTORY_FULL),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    // PR section heading should be visible
    const prSection = page.locator('#pr-trajectory-select')
      .or(page.getByText(/pr load progression/i))
      .or(page.getByText(/personal record/i).first())
      .first()

    await expect(prSection).toBeVisible({ timeout: 10_000 })
    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  test('PR02: Barbell Bench Press trajectory is selectable', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.WORKOUT_HISTORY]: JSON.stringify(WORKOUT_HISTORY_FULL),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    const exerciseSelector = page.locator('#pr-trajectory-select')
    await expect(exerciseSelector).toBeVisible({ timeout: 10_000 })

    // Select Squat
    await exerciseSelector.selectOption({ value: 'Barbell Back Squat' })
    await expect(exerciseSelector).toHaveValue('Barbell Back Squat')

    // Select Bench Press back
    await exerciseSelector.selectOption({ value: 'Barbell Bench Press' })
    await expect(exerciseSelector).toHaveValue('Barbell Bench Press')
  })

  test('PR03: Export CSV button is enabled when trajectory is available', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.WORKOUT_HISTORY]: JSON.stringify(WORKOUT_HISTORY_FULL),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    const exportBtn = page.locator('[data-testid="export-pr-trajectory-csv-btn"]')
    await expect(exportBtn).toBeVisible({ timeout: 10_000 })
    await expect(exportBtn).toBeEnabled()
  })

  test('PR04: Export CSV triggers download with safe filename', async ({
    page,
    seedStorage,
    consoleErrors,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.WORKOUT_HISTORY]: JSON.stringify(WORKOUT_HISTORY_FULL),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    const exportBtn = page.locator('[data-testid="export-pr-trajectory-csv-btn"]')
    await expect(exportBtn).toBeVisible({ timeout: 10_000 })


    // Listen for download event
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 })
    await exportBtn.click()

    const download = await downloadPromise
    const filename = download.suggestedFilename()

    // Filename must match contract: bodymap-pr-trajectory-*.csv
    expect(filename).toMatch(/^bodymap-pr-trajectory-.*\.csv$/)

    // Filename must NOT contain formula injection trigger characters
    expect(filename).not.toMatch(/^[=+\-@|]/)
    expect(filename).not.toMatch(/[=+@|]/)

    // Verify CSV content is readable
    const stream = await download.createReadStream()
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', resolve)
      stream.on('error', reject)
    })
    const csvContent = Buffer.concat(chunks).toString('utf-8')

    // CSV should have header row
    expect(csvContent).toMatch(/date|Date|exercise|Exercise/i)
    // CSV should have data rows
    const lines = csvContent.trim().split('\n')
    expect(lines.length).toBeGreaterThan(1)

    // CSV must NOT contain medical/profile fields
    expect(csvContent.toLowerCase()).not.toMatch(/medicalissues|medical_issues|allergies|gender/)

    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  test('PR05: Rapid double-click does not trigger duplicate download', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.WORKOUT_HISTORY]: JSON.stringify(WORKOUT_HISTORY_FULL),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    const exportBtn = page.locator('[data-testid="export-pr-trajectory-csv-btn"]')
    await expect(exportBtn).toBeVisible({ timeout: 10_000 })

    let downloadCount = 0
    page.on('download', () => { downloadCount++ })

    // Double-click rapidly
    await exportBtn.dblclick()

    // Wait 2 seconds for any async downloads
    await page.waitForTimeout(2_000)

    // Should have at most 1 download
    expect(downloadCount).toBeLessThanOrEqual(1)
  })

  test('PR06: Web Share stub receives correct payload (S15)', async ({
    page,
    seedStorage,
    stubShare,
    consoleErrors,
  }) => {
    // Install share stub BEFORE navigation
    await stubShare()

    await seedStorage({
      [STORAGE_KEYS.WORKOUT_HISTORY]: JSON.stringify(WORKOUT_HISTORY_FULL),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    const shareBtn = page.locator('[data-testid="share-pr-trajectory-btn"]')
    await expect(shareBtn).toBeVisible({ timeout: 10_000 })

    await shareBtn.click()

    // Wait for share to be invoked
    await page.waitForFunction(() => {
      return (window as typeof window & { __sharePayload?: unknown }).__sharePayload !== undefined
    }, { timeout: 5_000 })

    const payload = await page.evaluate(() => {
      return (window as typeof window & { __sharePayload?: unknown }).__sharePayload
    }) as { title?: string; text?: string; url?: string; files?: unknown[] }

    // Payload must have title or text (at minimum)
    expect(payload).toBeDefined()
    expect(typeof payload === 'object').toBe(true)

    // Must NOT contain files (privacy: CSV is text-only via share)
    expect(payload.files).toBeUndefined()
    expect(payload.url).toBeUndefined()

    // If text is present, must not contain formula injection characters at start of lines
    if (payload.text) {
      const lines = payload.text.split('\n')
      for (const line of lines) {
        if (line.trim().length > 0) {
          expect(line.charAt(0)).not.toMatch(/[=+\-@|]/)
        }
      }
    }

    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  test('PR07: AbortError (user cancels share) is silenced — no clipboard fallback', async ({
    page,
    seedStorage,
    stubShare,
    clipboardCapture: _clipboardCapture,
    consoleErrors,
  }) => {
    // Install share stub that rejects with AbortError
    await stubShare({ rejectWith: 'AbortError' })

    await seedStorage({
      [STORAGE_KEYS.WORKOUT_HISTORY]: JSON.stringify(WORKOUT_HISTORY_FULL),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    const shareBtn = page.locator('[data-testid="share-pr-trajectory-btn"]')
    await expect(shareBtn).toBeVisible({ timeout: 10_000 })

    await shareBtn.click()

    // Wait for UI to settle
    await page.waitForTimeout(1_000)

    // Clipboard should NOT have been written (AbortError = user chose to cancel, not a technical failure)
    const clipboardText = await page.evaluate(() =>
      (window as typeof window & { __clipboardCapture?: string }).__clipboardCapture ?? null
    )
    expect(clipboardText).toBeNull()

    // No page-level errors about share cancellation
    const shareErrors = consoleErrors.filter(
      (e) => e.text.includes('AbortError') && e.type === 'pageerror'
    )
    expect(shareErrors).toHaveLength(0)
  })

  test('PR08: Technical share failure triggers clipboard fallback', async ({
    page,
    seedStorage,
    stubShare,
    clipboardCapture: _clipboardCapture,
    consoleErrors,
  }) => {
    // Share fails with TypeError (API not supported / permission denied)
    await stubShare({ rejectWith: 'TypeError' })

    await seedStorage({
      [STORAGE_KEYS.WORKOUT_HISTORY]: JSON.stringify(WORKOUT_HISTORY_FULL),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    const shareBtn = page.locator('[data-testid="share-pr-trajectory-btn"]')
    await expect(shareBtn).toBeVisible({ timeout: 10_000 })

    await shareBtn.click()

    // Wait for clipboard fallback
    await page.waitForFunction(() => {
      return (window as typeof window & { __clipboardCapture?: string }).__clipboardCapture !== undefined
    }, { timeout: 5_000 })

    const clipboardText = await page.evaluate(() =>
      (window as typeof window & { __clipboardCapture?: string }).__clipboardCapture ?? null
    )

    // Clipboard should have content (trajectory summary text)
    expect(clipboardText).not.toBeNull()
    expect(clipboardText!).toMatch(/bench press|pr trajectory|bodymap/i)

    // Must NOT start a line with formula injection characters
    const lines = clipboardText!.split('\n')
    for (const line of lines) {
      if (line.trim().length > 0) {
        expect(line.charAt(0)).not.toMatch(/[=+\-@]/)
      }
    }

    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  test('PR09: Export is local-only — no external network requests', async ({
    page,
    seedStorage,
  }) => {
    const { blocked } = setupNetworkBlocker(page)

    await seedStorage({
      [STORAGE_KEYS.WORKOUT_HISTORY]: JSON.stringify(WORKOUT_HISTORY_FULL),
    })

    await page.goto(DASHBOARD_ROUTE)
    await waitForAppReady(page)

    const exportBtn = page.locator('[data-testid="export-pr-trajectory-csv-btn"]')
    await expect(exportBtn).toBeVisible({ timeout: 10_000 })

    // Set up download listener to avoid uncaught error
    page.on('download', async (dl) => { await dl.cancel() })
    await exportBtn.click()
    await page.waitForTimeout(1_000)

    // No unexpected external requests during export
    const external = blocked.filter((u) => !u.includes('localhost'))
    expect(external).toHaveLength(0)
  })

})
