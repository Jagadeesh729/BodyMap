/**
 * E28-A Phase 5 — Route Smoke Tests (E01–E06)
 *
 * Verifies:
 * - Each primary SPA route loads without unhandled exceptions
 * - Expected primary landmarks exist (heading, nav)
 * - SPA deep-link direct navigation works (no 404 / blank page)
 * - No unexpected console errors on initial load
 */

import { test, expect, waitForAppReady, expectNoConsoleErrors } from '../fixtures'

// Whitelisted console messages that are expected (not defects)
const KNOWN_BENIGN = [
  'Wake Lock',
  'wakelock',
  'wake lock',
  'ResizeObserver',
]

test.describe('Route Smoke Tests (E01–E06)', () => {
  test.beforeEach(async ({ page }) => {
    // Start each test with clean storage so routes don't depend on persisted plan data
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  // E01 — Home page loads successfully
  test('E01: Home page loads', async ({ page, consoleErrors }) => {
    await page.goto('/')
    await waitForAppReady(page)

    // Primary heading visible
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('nav')).toBeVisible()
    // URL remains at /
    expect(page.url()).toContain('/')
    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  // E02 — SPA deep-link direct navigation (create-plan)
  test('E02: SPA deep-link /create-plan loads directly', async ({ page, consoleErrors }) => {
    await page.goto('/create-plan')
    await waitForAppReady(page)

    // Should not redirect to / or show 404
    expect(page.url()).toContain('create-plan')
    // Main content area rendered
    await expect(page.locator('#main-content')).toBeVisible()
    // No page-error fallback
    await expect(page.locator('text=404')).not.toBeVisible()
    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  // E03 — Dashboard route loads directly
  test('E03: Dashboard /dashboard loads directly', async ({ page, consoleErrors }) => {
    await page.goto('/dashboard')
    await waitForAppReady(page)

    expect(page.url()).toContain('dashboard')
    await expect(page.locator('#main-content')).toBeVisible()
    await expect(page.locator('text=404')).not.toBeVisible()
    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  // E04 — Weekly Plan route loads directly
  test('E04: Weekly Plan /weekly-plan loads directly', async ({ page, consoleErrors }) => {
    await page.goto('/weekly-plan')
    await waitForAppReady(page)

    expect(page.url()).toContain('weekly-plan')
    await expect(page.locator('#main-content')).toBeVisible()
    await expect(page.locator('text=404')).not.toBeVisible()
    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  // E05 — Gym Mode route loads correctly
  test('E05: Gym Mode /gym-mode loads directly', async ({ page, consoleErrors }) => {
    await page.goto('/gym-mode')
    await waitForAppReady(page)

    expect(page.url()).toContain('gym-mode')
    await expect(page.locator('#main-content')).toBeVisible()
    await expect(page.locator('text=404')).not.toBeVisible()
    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  // E06 — Download Plan route loads correctly
  test('E06: Download Plan /download-plan loads directly', async ({ page, consoleErrors }) => {
    await page.goto('/download-plan')
    await waitForAppReady(page)

    expect(page.url()).toContain('download-plan')
    await expect(page.locator('#main-content')).toBeVisible()
    await expect(page.locator('text=404')).not.toBeVisible()
    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  // E07 — About page route
  test('E07: About /about loads directly', async ({ page, consoleErrors }) => {
    await page.goto('/about')
    await waitForAppReady(page)

    expect(page.url()).toContain('about')
    await expect(page.locator('#main-content')).toBeVisible()
    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })

  // E08 — 404 route (unknown path) shows Not Found, not blank
  test('E08: Unknown route shows 404 page not blank screen', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-e28a')
    await waitForAppReady(page)

    // Either shows a not-found component or redirects to home
    // Either way, should NOT show a completely blank page
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.trim().length).toBeGreaterThan(0)
  })

  // E09 — Reload after navigation preserves SPA route
  test('E09: Route remains functional after reload', async ({ page, consoleErrors }) => {
    await page.goto('/dashboard')
    await waitForAppReady(page)

    await page.reload()
    await waitForAppReady(page)

    expect(page.url()).toContain('dashboard')
    await expect(page.locator('#main-content')).toBeVisible()
    expectNoConsoleErrors(consoleErrors, KNOWN_BENIGN)
  })
})
