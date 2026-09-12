/**
 * PHASE 5 — Consumer-Sink Discovery Contract
 * ===========================================
 * Asserts that every consumer sink (content-bearing data exit) in the
 * application is in the enumerated known list. Any NEW sink added to the
 * codebase without updating this file will cause the test to fail.
 *
 * A "consumer sink" is any point where user-facing content leaves the browser
 * trust boundary: clipboard, download, share, print, email, or network POST
 * of user content.
 *
 * Rules:
 *  - Adding a new sink REQUIRES updating KNOWN_SINKS and CHANGE_CONTROL.md (Level 3).
 *  - Removing a known sink REQUIRES removing it from KNOWN_SINKS here.
 *  - The classification column is informational; the presence check is the gate.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '../..');

// ─────────────────────────────────────────────────────────────────────────────
// Enumerated Known Sinks
// Each entry: file (relative to ROOT), pattern, classification
// ─────────────────────────────────────────────────────────────────────────────
const KNOWN_SINKS: Array<{
  file: string;
  pattern: RegExp;
  classification: 'SECURED' | 'SAFE BY CONSTRUCTION' | 'RECOVERY ONLY';
  description: string;
}> = [
  {
    file: 'src/pages/WeeklyPlanPage.tsx',
    pattern: /navigator\.clipboard\.writeText/,
    classification: 'SECURED',
    description: 'S01/S02 — Copy workout content to clipboard',
  },
  {
    file: 'src/pages/DownloadPlanPage.tsx',
    pattern: /navigator\.clipboard\.writeText/,
    classification: 'SECURED',
    description: 'S03/S04 — Copy plan content / route URL to clipboard',
  },
  {
    file: 'src/pages/DownloadPlanPage.tsx',
    pattern: /window\.print\(/,
    classification: 'SECURED',
    description: 'S05 — Print plan',
  },
  {
    file: 'src/pages/DownloadPlanPage.tsx',
    pattern: /URL\.createObjectURL/,
    classification: 'SECURED',
    description: 'S06 — TXT download',
  },
  {
    file: 'src/pages/DownloadPlanPage.tsx',
    pattern: /window\.open\(/,
    classification: 'SECURED',
    description: 'S07 — Email via mailto',
  },
  {
    file: 'src/pages/DownloadPlanPage.tsx',
    pattern: /navigator\.share/,
    classification: 'SECURED',
    description: 'S08 — Native share',
  },
  {
    file: 'src/lib/backupStorage.ts',
    pattern: /URL\.createObjectURL/,
    classification: 'RECOVERY ONLY',
    description: 'S09 — V2 backup download',
  },
  {
    file: 'src/components/ContactForm.tsx',
    pattern: /window\.open\(/,
    classification: 'SAFE BY CONSTRUCTION',
    description: 'S10 — Contact form mailto (no user health data)',
  },
  {
    file: 'src/lib/gemini.ts',
    pattern: /fetch\s*\(/,
    classification: 'SECURED',
    description: 'S11 — Gemini API proxy client fetch (server-side proxied, API key server-only)',
  },
];

// Sink API patterns we scan for across the entire src/ tree
const SINK_API_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'navigator.clipboard.writeText', pattern: /navigator\.clipboard\.writeText/ },
  { name: 'navigator.share',               pattern: /navigator\.share/ },
  { name: 'window.print',                  pattern: /window\.print\(/ },
  { name: 'window.open',                   pattern: /window\.open\(/ },
  { name: 'URL.createObjectURL',           pattern: /URL\.createObjectURL/ },
  { name: 'fetch (POST with body)',         pattern: /fetch\s*\(.*\bmethod\s*:\s*['"]POST['"]/s },
  { name: 'XMLHttpRequest.send',           pattern: /\.send\s*\(/ },
  { name: 'sendBeacon',                    pattern: /navigator\.sendBeacon/ },
];

function walkTs(dir: string, acc: string[] = []): string[] {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      // Exclude __tests__ — test assertion strings legitimately reference sink
      // API patterns and should not trigger unknown sink detection
      if (entry.isDirectory() && entry.name !== '__tests__') walkTs(full, acc);
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) acc.push(full);
    }
  } catch { /* skip unreadable entries */ }
  return acc;
}

// Only scan production source files (not test files)
const srcFiles = walkTs(join(ROOT, 'src'));

describe('PHASE 5 — Consumer-Sink Discovery Contract', () => {

  describe('P5-A — Known sink files exist', () => {
    const uniqueFiles = [...new Set(KNOWN_SINKS.map(s => s.file))];
    for (const relFile of uniqueFiles) {
      it(`${relFile} must exist`, () => {
        expect(existsSync(join(ROOT, relFile))).toBe(true);
      });
    }
  });

  describe('P5-B — Every enumerated sink pattern is present in its declared file', () => {
    for (const sink of KNOWN_SINKS) {
      it(`${sink.description} [${sink.classification}]`, () => {
        const content = readFileSync(join(ROOT, sink.file), 'utf8');
        expect(content).toMatch(sink.pattern);
      });
    }
  });

  describe('P5-C — No UNKNOWN sinks outside the enumerated list', () => {
    for (const { name, pattern } of SINK_API_PATTERNS) {
      it(`All "${name}" usages are in the known sink list`, () => {
        const unknownHits: string[] = [];
        for (const absFile of srcFiles) {
          const rel = absFile.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
          const content = readFileSync(absFile, 'utf8');
          if (pattern.test(content) && !isKnownFile(rel, pattern)) {
            unknownHits.push(rel);
          }
        }
        expect(
          unknownHits,
          `Unknown sink "${name}" found in: ${unknownHits.join(', ')}\n` +
          `Add to KNOWN_SINKS in consumerSinkDiscoveryContract.test.ts and CHANGE_CONTROL.md (Level 3)`
        ).toHaveLength(0);
      });
    }
  });

  describe('P5-D — Sink classifications are stable', () => {
    it('All 10 sinks have a classification', () => {
      const valid = ['SECURED', 'SAFE BY CONSTRUCTION', 'RECOVERY ONLY'];
      for (const sink of KNOWN_SINKS) {
        expect(valid).toContain(sink.classification);
      }
    });

    it('No sink is classified as UNKNOWN or UNREVIEWED', () => {
      for (const sink of KNOWN_SINKS) {
        expect(sink.classification).not.toBe('UNKNOWN');
        expect(sink.classification).not.toBe('UNREVIEWED');
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isKnownFile(rel: string, scanPattern: RegExp): boolean {
  return KNOWN_SINKS.some(s => {
    const sinkRel = s.file.replace(/\\/g, '/');
    const fileMatch = rel === sinkRel || rel.endsWith(sinkRel);
    if (!fileMatch) return false;
    // Check if the known sink pattern source contains the scan pattern source
    // (handles prefix patterns: scan /window\.print\(/ matches known /window\.print\(\)/)
    return (
      s.pattern.source === scanPattern.source ||
      s.pattern.source.startsWith(scanPattern.source) ||
      scanPattern.source.startsWith(s.pattern.source)
    );
  });
}
