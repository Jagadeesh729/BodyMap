/**
 * E28-A Phase 23 — Live Production Smoke Tests
 *
 * Read-only verification against https://bodymap-ai.vercel.app
 *
 * CONSTRAINTS:
 * - All tests are read-only (no localStorage writes to production)
 * - No login, no form submission, no plan generation
 * - No download or share triggers (to avoid any accidental data exfiltration)
 * - This suite is NOT run in standard CI — must be triggered explicitly:
 *   npx playwright test e2e/production/ --project=chromium
 *
 * Environment variable BASE_URL must be set to override baseURL.
 */

import { test, expect, waitForAppReady } from '../fixtures'

const PROD_URL = process.env.BASE_URL ?? 'https://bodymap-ai.vercel.app'

test.describe('Production Smoke Tests (Phase 23)', () => {
  test.use({ baseURL: PROD_URL })

  test('PROD01: Production home page loads within 10s', async ({ page }) => {
    const start = Date.now()
    await page.goto('/', { timeout: 15_000 })
    await waitForAppReady(page)
    const elapsed = Date.now() - start

    await expect(page.locator('#main-content')).toBeVisible()
    expect(elapsed).toBeLessThan(10_000)
  })

  test('PROD02: Production page has correct title', async ({ page }) => {
    await page.goto('/', { timeout: 15_000 })
    const title = await page.title()
    expect(title.trim().length).toBeGreaterThan(0)
    expect(title.toLowerCase()).toMatch(/bodymap|fitness|plan/i)
  })

  test('PROD03: Production CSP headers are present', async ({ page }) => {
    const response = await page.goto('/', { timeout: 15_000 })
    const csp = response?.headers()['content-security-policy']
    expect(csp, 'CSP header missing on production').toBeTruthy()

    // Must include connect-src 'self'
    expect(csp).toMatch(/connect-src/i)
  })

  test('PROD04: SPA deep-link /dashboard loads on production', async ({ page }) => {
    await page.goto('/dashboard', { timeout: 15_000 })
    await waitForAppReady(page)

    await expect(page.locator('#main-content')).toBeVisible()
    await expect(page.locator('text=404')).not.toBeVisible()
  })

  test('PROD05: SPA deep-link /gym-mode loads on production', async ({ page }) => {
    await page.goto('/gym-mode', { timeout: 15_000 })
    await waitForAppReady(page)

    await expect(page.locator('#main-content')).toBeVisible()
    await expect(page.locator('text=404')).not.toBeVisible()
  })

  test('PROD06: Production has no unhandled page errors on home', async ({ page }) => {
    const pageErrors: Error[] = []
    page.on('pageerror', (e) => pageErrors.push(e))

    await page.goto('/', { timeout: 15_000 })
    await waitForAppReady(page)
    await page.waitForTimeout(500)

    expect(
      pageErrors,
      `Unhandled page errors on production: ${pageErrors.map((e) => e.message).join('; ')}`
    ).toHaveLength(0)
  })

  test('PROD07: Production Vercel rewrite serves SPA — no raw 404', async ({ page }) => {
    const response = await page.goto('/dashboard', { timeout: 15_000 })
    // Vercel rewrite should return 200, not 404
    expect(response?.status()).toBe(200)
  })
})
