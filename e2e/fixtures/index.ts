import { test as base, expect, type Page } from '@playwright/test'
import { STORAGE_KEYS } from '../helpers/storage'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConsoleErrorRecord {
  type: string
  text: string
  location: string
}

export interface ClipboardCapture {
  text: string | null
}

// ─── Custom Fixture Definitions ───────────────────────────────────────────────

type BodyMapFixtures = {
  /** Collected console errors/warnings from the page */
  consoleErrors: ConsoleErrorRecord[]
  /** Captured clipboard write text (shimmed) */
  clipboardCapture: ClipboardCapture
  /** Seeds localStorage before page load */
  seedStorage: (entries: Record<string, string>) => Promise<void>
  /** Clears all BodyMap localStorage keys */
  clearAllStorage: () => Promise<void>
  /** Stubs navigator.share; resolves by default, or throws if rejectWith is set */
  stubShare: (options?: {
    rejectWith?: 'AbortError' | 'TypeError' | string
    capturedPayload?: { title?: string; text?: string; url?: string }
  }) => Promise<void>
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export const test = base.extend<BodyMapFixtures>({
  /**
   * Collects all page console.error calls and unhandled page errors.
   * Tests can inspect this fixture after user interactions.
   */
  consoleErrors: async ({ page }, use) => {
    const errors: ConsoleErrorRecord[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push({
          type: 'console.error',
          text: msg.text(),
          location: msg.location().url ?? '',
        })
      }
    })

    page.on('pageerror', (err) => {
      errors.push({
        type: 'pageerror',
        text: err.message,
        location: err.stack ?? '',
      })
    })

    await use(errors)
  },

  /**
   * Captures text written to navigator.clipboard.writeText.
   * The shim is installed before page load via page.addInitScript.
   * Tests call stubShare/seedClipboard before page.goto().
   */
  clipboardCapture: async ({ page }, use) => {
    const capture: ClipboardCapture = { text: null }

    await page.addInitScript(() => {
      // Shim navigator.clipboard.writeText to capture text without requiring permissions
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            ;(window as typeof window & { __clipboardCapture?: string }).__clipboardCapture = text
            return Promise.resolve()
          },
          readText: async () => Promise.resolve(''),
        },
      })
    })

    await use(capture)

    // After test: read captured value from page
    capture.text = await page.evaluate(() =>
      (window as typeof window & { __clipboardCapture?: string }).__clipboardCapture ?? null
    )
  },

  /**
   * Seeds localStorage entries before navigation.
   * Call this before page.goto().
   */
  seedStorage: async ({ page }, use) => {
    const fn = async (entries: Record<string, string>) => {
      await page.addInitScript((storageEntries: Record<string, string>) => {
        for (const [key, value] of Object.entries(storageEntries)) {
          localStorage.setItem(key, value)
        }
      }, entries)
    }
    await use(fn)
  },

  /**
   * Clears all known BodyMap localStorage keys.
   * Call after page.goto() to ensure page has loaded.
   */
  clearAllStorage: async ({ page }, use) => {
    const fn = async () => {
      await page.evaluate((keys: string[]) => {
        for (const key of keys) {
          localStorage.removeItem(key)
        }
        sessionStorage.clear()
      }, Object.values(STORAGE_KEYS))
    }
    await use(fn)
  },

  /**
   * Stubs navigator.share before page load.
   * - By default (no options): resolves successfully.
   * - rejectWith: 'AbortError' → simulates user cancellation.
   * - rejectWith: 'TypeError' → simulates API not supported.
   * - rejectWith: any string → rejects with that error message.
   * Also captures the share payload in window.__sharePayload.
   */
  stubShare: async ({ page }, use) => {
    const fn = async (options?: {
      rejectWith?: 'AbortError' | 'TypeError' | string
    }) => {
      await page.addInitScript((opts?: { rejectWith?: string }) => {
        ;(window as typeof window & { __sharePayload?: unknown }).__sharePayload = undefined
        if (opts?.rejectWith === 'TypeError') {
          // Simulate unsupported: delete navigator.share
          Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: undefined,
          })
        } else {
          Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: async (payload: unknown) => {
              ;(window as typeof window & { __sharePayload?: unknown }).__sharePayload = payload
              if (opts?.rejectWith) {
                const err = new Error(opts.rejectWith)
                err.name = opts.rejectWith
                return Promise.reject(err)
              }
              return Promise.resolve()
            },
          })
        }
      }, options)
    }
    await use(fn)
  },
})

export { expect }

// ─── Helper: Wait for App Ready ───────────────────────────────────────────────

/**
 * Waits for the BodyMap application to finish the Suspense lazy-load.
 * The `main#main-content` element always exists after React mounts.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 })
  // Wait for Suspense to resolve (no loading spinner visible)
  await page.waitForFunction(() => {
    const spinner = document.querySelector('[aria-label="Loading page"]')
    return !spinner
  }, { timeout: 15_000 })
}

// ─── Helper: Expect No Console Errors ─────────────────────────────────────────

export function expectNoConsoleErrors(
  errors: ConsoleErrorRecord[],
  whitelist: string[] = []
): void {
  const filtered = errors.filter(
    (e) => !whitelist.some((w) => e.text.includes(w))
  )
  expect(filtered, `Unexpected console errors: ${JSON.stringify(filtered, null, 2)}`).toHaveLength(0)
}

// ─── Helper: Expect No Unexpected Network Requests ────────────────────────────

export function setupNetworkBlocker(
  page: Page,
  allowedPatterns: RegExp[] = []
): { blocked: string[] } {
  const blocked: string[] = []
  page.on('request', (req) => {
    const url = req.url()
    // Allow: localhost (app itself) and data: URLs
    if (url.startsWith('http://localhost') || url.startsWith('data:')) return
    // Allow: explicitly permitted external patterns
    if (allowedPatterns.some((p) => p.test(url))) return
    blocked.push(url)
  })
  return { blocked }
}
