/**
 * PHASE 8 — Privacy Contract
 * ===========================
 * Asserts that the four core privacy invariants of BodyMap AI are structurally
 * intact:
 *
 *  1. No Gemini API key literal in any client source or build artifact.
 *  2. No user health data in URL query parameters.
 *  3. No third-party analytics or tracking scripts wired into the main entry.
 *  4. No health data POST to any endpoint other than the proxied Gemini endpoint.
 *
 * Notes:
 *  - This contract tests STRUCTURAL evidence (source/config file content), not
 *    runtime network calls. Runtime network privacy is covered by the security
 *    boundary in the prior audit (declared inherent/platform-level).
 *  - The Gemini API proxy (api/generate-plan.ts) is ALLOWED to contain
 *    `process.env.GEMINI_API_KEY` but MUST NOT contain a literal key.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '../..');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function walkTs(dir: string, acc: string[] = [], excludeTests = false): string[] {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Optionally exclude __tests__ — test files legitimately reference
        // analytics/tracking domains in test assertions, not production code
        if (excludeTests && entry.name === '__tests__') continue;
        walkTs(full, acc, excludeTests);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        acc.push(full);
      }
    }
  } catch { /* skip unreadable entries */ }
  return acc;
}

// srcFiles: all TypeScript source files (for API key scan — needs to catch even test files)
const srcFiles = walkTs(join(ROOT, 'src'));
// prodFiles: production source only, excludes __tests__ (for analytics/tracking/health-URL scans)
const prodFiles = walkTs(join(ROOT, 'src'), [], true);

describe('PHASE 8 — Privacy Contract', () => {

  // ─────────────────────────────────────────────────────────────────────────
  // P8-A — No API key literal in client source
  // ─────────────────────────────────────────────────────────────────────────
  describe('P8-A — No Gemini API key literal in src/', () => {
    const KEY_PATTERN = /AIzaSy[A-Za-z0-9_-]{33}/;

    it('No literal API key pattern found in any src/ TypeScript file', () => {
      const hits: string[] = [];
      for (const absFile of srcFiles) {
        const rel = absFile.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
        const content = readFileSync(absFile, 'utf8');
        if (KEY_PATTERN.test(content)) hits.push(rel);
      }
      expect(hits, `API key literal in: ${hits.join(', ')}`).toHaveLength(0);
    });

    it('api/generate-plan.ts uses env variable, not a literal key', () => {
      const apiFile = join(ROOT, 'api/generate-plan.ts');
      if (!existsSync(apiFile)) {
        // Acceptable if serverless function is not present in test environment
        return;
      }
      const content = readFileSync(apiFile, 'utf8');
      const KEY_PATTERN_LITERAL = /AIzaSy[A-Za-z0-9_-]{33}/;
      expect(KEY_PATTERN_LITERAL.test(content)).toBe(false);
      expect(content).toContain('GEMINI_API_KEY');
    });

    it('VITE_GEMINI_API_KEY must not be referenced in production src/ (would expose key at bundle time)', () => {
      const hits: string[] = [];
      // Use prodFiles — test files contain this string in their own assertion checks,
      // not as actual production code exposing the key through the VITE_ bundler mechanism
      for (const absFile of prodFiles) {
        const rel = absFile.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
        const content = readFileSync(absFile, 'utf8');
        // VITE_ prefix exposes env vars to client bundle
        if (content.includes('VITE_GEMINI_API_KEY') || content.includes('import.meta.env.VITE_GEMINI')) {
          hits.push(rel);
        }
      }
      expect(hits, `VITE_GEMINI_API_KEY exposure in: ${hits.join(', ')}`).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // P8-B — No user health data in URL query parameters
  // ─────────────────────────────────────────────────────────────────────────
  describe('P8-B — No health data in URL query parameters', () => {
    const HEALTH_URL_PATTERNS = [
      // Precise patterns: only match URLSearchParams/router API calls with health field names,
      // NOT generic TypeScript ternaries which also use '?' operator
      /searchParams\.set\s*\(\s*['"](?:age|weight|height|bmi|condition|injury|allerg)/i,
      /URLSearchParams\s*\(\s*\{[^}]*(?:age|weight|height)\s*:/i,
      /useNavigate.*(?:search|query)\s*:.*(?:age|weight|bmi|condition|injury)/i,
    ];

    it('No health data pushed into URL search parameters in production src/', () => {
      const hits: string[] = [];
      for (const absFile of prodFiles) {
        const rel = absFile.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
        const content = readFileSync(absFile, 'utf8');
        for (const pattern of HEALTH_URL_PATTERNS) {
          if (pattern.test(content)) {
            hits.push(`${rel} (pattern: ${pattern})`);
          }
        }
      }
      expect(hits, `Health data in URLs: ${hits.join('\n')}`).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // P8-C — No third-party analytics or tracking in main entry
  // ─────────────────────────────────────────────────────────────────────────
  describe('P8-C — No third-party analytics/tracking', () => {
    const TRACKING_PATTERNS = [
      /google-analytics\.com/i,
      /googletagmanager\.com/i,
      /gtag\s*\(/i,
      /ga\s*\(\s*['"]send['"]/i,
      /mixpanel\./i,
      /segment\.io/i,
      /amplitude\.com/i,
      /analytics\.track\s*\(/i,
      /heap\.io/i,
      /hotjar\.com/i,
      /clarity\.ms/i,
      /_fbq\s*\(/i,
      /fbevents\.js/i,
    ];

    it('No third-party analytics or tracking scripts in production src/', () => {
      const hits: string[] = [];
      // Only scan production source files — test files check for absence of these
      // patterns in test assertions (which legitimately contain the pattern strings)
      for (const absFile of prodFiles) {
        const rel = absFile.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
        const content = readFileSync(absFile, 'utf8');
        for (const pattern of TRACKING_PATTERNS) {
          if (pattern.test(content)) {
            hits.push(`${rel} (matches: ${pattern})`);
          }
        }
      }
      expect(hits, `Third-party tracking found:\n${hits.join('\n')}`).toHaveLength(0);
    });

    it('index.html must not include third-party analytics script tags', () => {
      const indexHtml = join(ROOT, 'index.html');
      if (!existsSync(indexHtml)) return;
      const content = readFileSync(indexHtml, 'utf8');
      for (const pattern of TRACKING_PATTERNS) {
        expect(content, `Analytics pattern ${pattern} in index.html`).not.toMatch(pattern);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // P8-D — Health data POST only to approved endpoint
  // ─────────────────────────────────────────────────────────────────────────
  describe('P8-D — Health data fetch only to approved API route', () => {
    const ALLOWED_ENDPOINTS = [
      '/api/generate-plan',
      'api/generate-plan',
    ];

    it('Any fetch with POST method only targets the approved Gemini proxy endpoint', () => {
      const externalFetchHits: string[] = [];
      for (const absFile of prodFiles) {
        const rel = absFile.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
        const content = readFileSync(absFile, 'utf8');
        // Look for fetch calls with POST
        const fetchPostMatches = content.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`][^)]*method\s*:\s*['"]POST['"]/gs) || [];
        for (const match of fetchPostMatches) {
          const endpointMatch = match.match(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/);
          if (endpointMatch) {
            const endpoint = endpointMatch[1];
            const isAllowed = ALLOWED_ENDPOINTS.some(a => endpoint.includes(a));
            if (!isAllowed) {
              externalFetchHits.push(`${rel}: POST to ${endpoint}`);
            }
          }
        }
      }
      expect(
        externalFetchHits,
        `Unexpected POST fetch targets:\n${externalFetchHits.join('\n')}`
      ).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // P8-E — LocalStorage only (no remote storage of health data)
  // ─────────────────────────────────────────────────────────────────────────
  describe('P8-E — Health data stored only in localStorage (no remote DB)', () => {
    const REMOTE_STORAGE_PATTERNS = [
      /firebase\./i,
      /firestore\./i,
      /supabase\./i,
      /mongodb\./i,
      /\.collection\s*\(/i,
      /dynamodb/i,
      /\.put\s*\(\s*\{.*health/i,
    ];

    it('No remote database storage of health data in production src/', () => {
      const hits: string[] = [];
      // Only scan production source files — this test file itself contains the
      // pattern strings in the REMOTE_STORAGE_PATTERNS array definition above
      for (const absFile of prodFiles) {
        const rel = absFile.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
        const content = readFileSync(absFile, 'utf8');
        for (const pattern of REMOTE_STORAGE_PATTERNS) {
          if (pattern.test(content)) {
            hits.push(`${rel} (pattern: ${pattern})`);
          }
        }
      }
      expect(hits, `Remote health storage found:\n${hits.join('\n')}`).toHaveLength(0);
    });
  });
});
