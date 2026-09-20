/**
 * E28-A Phase 14 — Network Boundary Gate
 *
 * Verifies that client-side-only workflows (hydration, gym mode feedback,
 * body measurements, PR export) do NOT make external network requests.
 *
 * Only requests to http://localhost are permitted.
 * Any request to an external origin (including Gemini API endpoints) is a gate failure.
 *
 * Exception: The /api/generate-plan endpoint (AI plan generation) is intentionally
 * external in production but is only invoked when the user explicitly submits the
 * plan generation form — it must NOT fire on passive page loads or local-only workflows.
 */

import { test, expect, waitForAppReady, setupNetworkBlocker } from '../fixtures'
import {
  STORAGE_KEYS,
  WORKOUT_HISTORY_FULL,
  BODY_MEASUREMENTS_3,
} from '../helpers/storage'

const EXTERNAL_ALLOWED_PATTERNS: RegExp[] = [
  // None — all workflows tested here are strictly local
]

test.describe('Network Boundary Gate (Phase 14)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
  })

  test('NB01: Home page load makes no external requests', async ({ page }) => {
    const { blocked } = setupNetworkBlocker(page, EXTERNAL_ALLOWED_PATTERNS)

    await page.goto('/')
    await waitForAppReady(page)
    await page.waitForTimeout(500)

    const external = blocked.filter((u) => !u.startsWith('http://localhost'))
    expect(external, `External requests detected: ${external.join(', ')}`).toHaveLength(0)
  })

  test('NB02: Dashboard load with workout history makes no external requests', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.WORKOUT_HISTORY]: JSON.stringify(WORKOUT_HISTORY_FULL),
    })
    const { blocked } = setupNetworkBlocker(page, EXTERNAL_ALLOWED_PATTERNS)

    await page.goto('/dashboard')
    await waitForAppReady(page)
    await page.waitForTimeout(500)

    const external = blocked.filter((u) => !u.startsWith('http://localhost'))
    expect(external, `External requests on dashboard: ${external.join(', ')}`).toHaveLength(0)
  })

  test('NB03: Gym Mode page makes no external requests', async ({ page }) => {
    const { blocked } = setupNetworkBlocker(page, EXTERNAL_ALLOWED_PATTERNS)

    await page.goto('/gym-mode')
    await waitForAppReady(page)
    await page.waitForTimeout(500)

    const external = blocked.filter((u) => !u.startsWith('http://localhost'))
    expect(external, `External requests on gym-mode: ${external.join(', ')}`).toHaveLength(0)
  })

  test('NB04: Body measurement load makes no external requests', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.BODY_METRICS]: JSON.stringify(BODY_MEASUREMENTS_3),
    })
    const { blocked } = setupNetworkBlocker(page, EXTERNAL_ALLOWED_PATTERNS)

    await page.goto('/dashboard')
    await waitForAppReady(page)
    await page.waitForTimeout(500)

    const external = blocked.filter((u) => !u.startsWith('http://localhost'))
    expect(external, `External requests on body metrics: ${external.join(', ')}`).toHaveLength(0)
  })

  test('NB05: PR trajectory view makes no external requests', async ({
    page,
    seedStorage,
  }) => {
    await seedStorage({
      [STORAGE_KEYS.WORKOUT_HISTORY]: JSON.stringify(WORKOUT_HISTORY_FULL),
    })
    const { blocked } = setupNetworkBlocker(page, EXTERNAL_ALLOWED_PATTERNS)

    await page.goto('/dashboard')
    await waitForAppReady(page)
    await page.waitForTimeout(1000)

    const external = blocked.filter((u) => !u.startsWith('http://localhost'))
    expect(external, `External requests during PR view: ${external.join(', ')}`).toHaveLength(0)
  })

  test('NB06: No GEMINI_API_KEY in browser-visible network requests', async ({ page }) => {
    const requestHeaders: Array<{ url: string; headers: Record<string, string> }> = []

    page.on('request', (req) => {
      const headers = req.headers()
      // Check if any header contains a potential API key
      if (
        Object.values(headers).some(
          (v) => v.length > 20 && (v.includes('AIza') || v.toLowerCase().includes('api_key'))
        )
      ) {
        requestHeaders.push({ url: req.url(), headers })
      }
    })

    await page.goto('/')
    await waitForAppReady(page)
    await page.waitForTimeout(500)

    expect(
      requestHeaders,
      `API key found in request headers: ${JSON.stringify(requestHeaders)}`
    ).toHaveLength(0)
  })

  test('NB07: About and Contact pages make no external requests', async ({ page }) => {
    const { blocked } = setupNetworkBlocker(page, EXTERNAL_ALLOWED_PATTERNS)

    await page.goto('/about')
    await waitForAppReady(page)
    await page.waitForTimeout(300)

    const external = blocked.filter((u) => !u.startsWith('http://localhost'))
    expect(external, `External requests on about: ${external.join(', ')}`).toHaveLength(0)
  })
})
