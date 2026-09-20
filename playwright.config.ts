import { defineConfig, devices } from '@playwright/test'

/**
 * E28-A Playwright Configuration
 * Browser E2E verification harness for BodyMap AI.
 *
 * Runs against `vite preview` (production-equivalent SPA build).
 * Chromium is the primary project; WebKit is secondary for share/clipboard API coverage.
 * No browser-level tests run against the Vite dev server.
 */
export default defineConfig({
  testDir: './e2e',
  /* Exclude production smoke tests from normal runs unless explicitly requested or BASE_URL set */
  testIgnore: (process.env.BASE_URL || process.argv.some(arg => arg.includes('production')))
    ? []
    : ['**/production/**'],


  /* Maximum time one test can run */
  timeout: 30_000,
  /* Timeout for each expect assertion */
  expect: {
    timeout: 10_000,
  },
  /* Fail fast: show full error on first failure in CI */
  fullyParallel: true,
  /* Never run retries locally; 1 retry in CI to catch rare transients */
  retries: process.env.CI ? 1 : 0,
  /* Workers: 1 in CI to keep preview server stable, parallel locally */
  workers: process.env.CI ? 1 : undefined,
  /* Reporters */
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list']]
    : [['html', { open: 'on-failure' }], ['list']],
  /* Collect traces/screenshots only on failure to reduce artifact bloat */
  use: {
    /* All tests use vite preview base */
    baseURL: 'http://localhost:4173',
    /* Capture traces only on first retry */
    trace: 'on-first-retry',
    /* Screenshot only on failure */
    screenshot: 'only-on-failure',
    /* Video only on first retry */
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /* Run headless in CI; headed locally via PWHEADED env var */
        headless: process.env.PWHEADED !== '1',
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        headless: process.env.PWHEADED !== '1',
      },
    },
  ],
  /* Launch a production-equivalent preview server before running tests.
     npm run build is assumed to have already run (for speed in repeated runs).
     To force a fresh build: PW_BUILD=1 npx playwright test */
  webServer: {
    command: 'npx vite preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
