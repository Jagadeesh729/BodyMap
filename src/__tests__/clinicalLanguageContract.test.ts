/**
 * PHASE 6 — Clinical Language Regression Contract
 * ================================================
 * Tests that the application's clinical language meets two invariants:
 *
 *   1. FORBIDDEN PHRASES — high-risk over-assurance language is absent from all source files.
 *   2. REQUIRED CONCEPTS — the key safety-disclosure concepts are present in their
 *      designated locations. These concepts may be phrased flexibly, but the
 *      semantic intent must be present.
 *
 * Rules:
 *  - Do NOT add forbidden phrases back under any alias or paraphrase.
 *  - Do NOT remove required concept checks without Level 3 change-control approval.
 *  - This test does NOT hard-code exact sentences — it tests required semantic concepts
 *    and a set of forbidden high-risk phrase patterns.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '../..');

// ─────────────────────────────────────────────────────────────────────────────
// Forbidden Phrases — must NOT appear in any src/ file (case-insensitive)
// ─────────────────────────────────────────────────────────────────────────────
const FORBIDDEN_PHRASES: string[] = [
  '100% safe',
  'guaranteed safe',
  'medically proven',
  'clinically proven',
  'replace your doctor',
  'replace your physician',
  'replace your therapist',
  'no risk',
];

// ─────────────────────────────────────────────────────────────────────────────
// Required Concept Checks — semantic concepts that MUST appear in each file
// At least ONE of the `anyOf` patterns must match in the file content.
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_CONCEPTS: Array<{
  file: string;
  concept: string;
  anyOf: (string | RegExp)[];
}> = [
  {
    file: 'src/pages/CreatePlanPage.tsx',
    concept: 'Informational wellness disclaimer (not a substitute for clinical care)',
    anyOf: [
      'informational wellness guidance',
      /does not substitute for.*clinical/i,
      /not a substitute for.*medical/i,
      /wellness.*guidance/i,
    ],
  },
  {
    file: 'src/pages/WeeklyPlanPage.tsx',
    concept: 'Non-over-assurance exercise substitution language',
    anyOf: [
      'adapted exercise alternatives',
      /adapted.*exercise/i,
      /exercise.*alternatives/i,
      /modified.*exercise/i,
    ],
  },
  {
    file: 'src/pages/AboutContactPage.tsx',
    concept: 'Calibrated sustainability language (not "safe")',
    anyOf: [
      'adaptable, and sustainable',
      /adaptable.*sustainable/i,
      /effective.*sustainable/i,
      /informed.*sustainable/i,
    ],
  },
  {
    file: 'src/pages/WeeklyPlanPage.tsx',
    concept: 'Cross-contact disclosure for allergen screening',
    anyOf: [
      'cross-contact',
      /biological cross-contact/i,
      /cross.contact.*cannot/i,
      /allergen.*not.*guarantee/i,
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function walkTs(dir: string, acc: string[] = []): string[] {
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      // Exclude __tests__ directory — test files may legitimately reference
      // forbidden phrases in their own assertion strings and comment blocks
      if (entry.isDirectory() && entry.name !== '__tests__') walkTs(full, acc);
      else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) acc.push(full);
    }
  } catch { /* skip unreadable entries */ }
  return acc;
}

// Only scan production source files, not test files
const srcFiles = walkTs(join(ROOT, 'src'));

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
describe('PHASE 6 — Clinical Language Regression Contract', () => {

  describe('P6-A — Forbidden high-risk phrases absent from all source files', () => {
    for (const phrase of FORBIDDEN_PHRASES) {
      it(`"${phrase}" must not appear in any src/ file`, () => {
        const hits: string[] = [];
        for (const absFile of srcFiles) {
          const rel = absFile.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
          const content = readFileSync(absFile, 'utf8');
          if (content.toLowerCase().includes(phrase.toLowerCase())) {
            hits.push(rel);
          }
        }
        expect(
          hits,
          `Forbidden phrase "${phrase}" found in: ${hits.join(', ')}`
        ).toHaveLength(0);
      });
    }
  });

  describe('P6-B — Required safety disclosure concepts present', () => {
    for (const check of REQUIRED_CONCEPTS) {
      it(`[${check.file}] — ${check.concept}`, () => {
        const filePath = join(ROOT, check.file);
        expect(existsSync(filePath), `File missing: ${check.file}`).toBe(true);
        const content = readFileSync(filePath, 'utf8');
        const matched = check.anyOf.some(pattern =>
          typeof pattern === 'string'
            ? content.includes(pattern)
            : pattern.test(content)
        );
        expect(
          matched,
          `Required concept "${check.concept}" not found in ${check.file}.\n` +
          `Expected one of: ${check.anyOf.map(p => p.toString()).join(', ')}`
        ).toBe(true);
      });
    }
  });

  describe('P6-C — Clinical language structural sanity', () => {
    it('WeeklyPlanPage.tsx must not use "safe alternatives" (original over-assurance phrase)', () => {
      const file = join(ROOT, 'src/pages/WeeklyPlanPage.tsx');
      const content = readFileSync(file, 'utf8');
      // "safe alternatives" as a standalone phrase (not part of "exercise-safe" or similar)
      expect(content).not.toMatch(/\bsafe alternatives\b/i);
    });

    it('AboutContactPage.tsx must not use "safe, and sustainable" (original over-assurance phrase)', () => {
      const file = join(ROOT, 'src/pages/AboutContactPage.tsx');
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/\bsafe,\s+and\s+sustainable\b/i);
    });

    it('No source file may claim to provide medical diagnosis', () => {
      const hits: string[] = [];
      for (const absFile of srcFiles) {
        const rel = absFile.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '');
        const content = readFileSync(absFile, 'utf8');
        if (/provide[s]?\s+(a\s+)?medical\s+diagnosis/i.test(content)) {
          hits.push(rel);
        }
      }
      expect(hits, `Medical diagnosis claim found in: ${hits.join(', ')}`).toHaveLength(0);
    });
  });
});
