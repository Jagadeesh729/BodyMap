/**
 * E28-A Phase 13 — Console/Page Error Gate
 *
 * Verifies that critical routes produce zero unhandled page errors
 * on a clean-storage first load and on a reload.
 * This is a cross-cutting gate: ANY unhandled pageerror = test failure.
 */

import { test, expect, waitForAppReady } from '../fixtures'

// These patterns are documented benign warnings from third-party APIs:
// - Wake Lock API: not supported in headless Chromium
// - ResizeObserver loop warnings: cosmetic, non-breaking
const KNOWN_BENIGN_PATTERNS = [
  'Wake Lock API',
  'WakeLock',
  'ResizeObserver loop',
  'vibrate',
  'SpeechSynthesis',
]

function isBenign(text: string): boolean {
  return KNOWN_BENIGN_PATTERNS.some((p) => text.includes(p))
}

const CRITICAL_ROUTES = [
  { path: '/', name: 'Home' },
  { path: '/create-plan', name: 'Create Plan' },
  { path: '/weekly-plan', name: 'Weekly Plan' },
  { path: '/gym-mode', name: 'Gym Mode' },
  { path: '/download-plan', name: 'Download Plan' },
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/about', name: 'About' },
]

test.describe('Console/Page Error Gate (Phase 13)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  for (const route of CRITICAL_ROUTES) {
    test(`CE: ${route.name} (${route.path}) has zero unhandled page errors`, async ({ page }) => {
      const pageErrors: Error[] = []

      page.on('pageerror', (err) => {
        if (!isBenign(err.message)) {
          pageErrors.push(err)
        }
      })

      await page.goto(route.path)
      await waitForAppReady(page)

      // Wait for any deferred effects
      await page.waitForTimeout(500)

      expect(
        pageErrors,
        `Unhandled page errors on ${route.path}: ${pageErrors.map((e) => e.message).join('; ')}`
      ).toHaveLength(0)
    })
  }

  test('CE-RELOAD: Dashboard survives reload with no page errors', async ({ page }) => {
    const pageErrors: Error[] = []

    page.on('pageerror', (err) => {
      if (!isBenign(err.message)) {
        pageErrors.push(err)
      }
    })

    await page.goto('/dashboard')
    await waitForAppReady(page)
    await page.reload()
    await waitForAppReady(page)

    await page.waitForTimeout(500)

    expect(
      pageErrors,
      `Unhandled page errors on reload: ${pageErrors.map((e) => e.message).join('; ')}`
    ).toHaveLength(0)
  })
})
