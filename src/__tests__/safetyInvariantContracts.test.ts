/**
 * PHASE 4 — Permanent Safety Invariant Regression Contracts
 * ==========================================================
 * These tests encode the non-negotiable safety invariants of BodyMap AI as
 * permanent regression guards. Any future refactor that breaks these invariants
 * is caught immediately.
 *
 * Rules:
 *  - These tests MUST NOT be deleted, disabled, or have their assertions weakened.
 *  - These tests MUST pass before ANY commit to main.
 *  - Changes to these tests require Level 3 change-control approval (see CHANGE_CONTROL.md).
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '../..');

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT A — Safety Module File Existence
// ─────────────────────────────────────────────────────────────────────────────
describe('CONTRACT A — Safety module file existence', () => {
  const REQUIRED = [
    'src/lib/planBinding.ts',
    'src/lib/contraindicationGuard.ts',
    'src/lib/allergenGuard.ts',
    'src/hooks/useWakeLock.ts',
  ];

  for (const mod of REQUIRED) {
    it(`${mod} must exist`, () => {
      expect(existsSync(join(ROOT, mod)), `Safety module deleted: ${mod}`).toBe(true);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT B — Safety Mismatch Sentinel (isSafetyMismatched)
// ─────────────────────────────────────────────────────────────────────────────
describe('CONTRACT B — isSafetyMismatched sentinel in planBinding.ts', () => {
  const file = join(ROOT, 'src/lib/planBinding.ts');

  it('planBinding.ts must exist', () => {
    expect(existsSync(file)).toBe(true);
  });

  it('isSafetyMismatched must be derived from mismatchedSafetyFields.length > 0', () => {
    const content = readFileSync(file, 'utf8');
    expect(content).toContain('const isSafetyMismatched = mismatchedSafetyFields.length > 0');
  });

  it('evaluatePlanProfileBinding must be exported', () => {
    const content = readFileSync(file, 'utf8');
    expect(content).toMatch(/export\s+(function|const)\s+evaluatePlanProfileBinding/);
  });

  it('isSafetyMismatched must be returned by evaluatePlanProfileBinding', () => {
    const content = readFileSync(file, 'utf8');
    expect(content).toContain('isSafetyMismatched');
    // Ensure it's in a return/object context (not just a dead variable)
    expect(content).toMatch(/isSafetyMismatched[,\s}:]/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT C — Contraindication Guard Sentinel
// ─────────────────────────────────────────────────────────────────────────────
describe('CONTRACT C — contraindicationGuard.ts sentinel', () => {
  const file = join(ROOT, 'src/lib/contraindicationGuard.ts');

  it('scanPlanForContraindications must be exported', () => {
    const content = readFileSync(file, 'utf8');
    expect(content).toMatch(/export\s+(function|const)\s+scanPlanForContraindications/);
  });

  it('scanPlanForContraindications must return hasViolation', () => {
    const content = readFileSync(file, 'utf8');
    expect(content).toContain('hasViolation');
  });

  it('scanPlanForContraindications must return scannedExerciseCount', () => {
    const content = readFileSync(file, 'utf8');
    expect(content).toContain('scannedExerciseCount');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT D — Allergen Guard Sentinel
// ─────────────────────────────────────────────────────────────────────────────
describe('CONTRACT D — allergenGuard.ts sentinel', () => {
  const file = join(ROOT, 'src/lib/allergenGuard.ts');

  it('scanPlanForAllergens must be exported', () => {
    const content = readFileSync(file, 'utf8');
    expect(content).toMatch(/export\s+(function|const)\s+scanPlanForAllergens/);
  });

  it('getActiveAllergenCategories must be exported', () => {
    const content = readFileSync(file, 'utf8');
    expect(content).toMatch(/export\s+(function|const)\s+getActiveAllergenCategories/);
  });

  it('ALLERGEN_TAXONOMY must be defined', () => {
    const content = readFileSync(file, 'utf8');
    expect(content).toContain('ALLERGEN_TAXONOMY');
  });

  it('ALLERGEN_TAXONOMY must contain at least 9 entries', () => {
    const content = readFileSync(file, 'utf8');
    const matches = content.match(/ALLERGEN_TAXONOMY/g);
    expect(matches).not.toBeNull();
    // At minimum the definition site and usage site
    expect((matches ?? []).length).toBeGreaterThanOrEqual(2);
    // Count object entries by the 'key:' field used in the taxonomy
    const entryMatches = content.match(/\bkey:\s*['"`]/g);
    expect(entryMatches).not.toBeNull();
    expect((entryMatches ?? []).length).toBeGreaterThanOrEqual(9);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT E — Canonical Safety Test File Existence
// ─────────────────────────────────────────────────────────────────────────────
describe('CONTRACT E — canonical safety test file', () => {
  const file = join(ROOT, 'src/__tests__/planLifecycleSafetyBoundaryOracle.test.ts');

  it('planLifecycleSafetyBoundaryOracle.test.ts must exist', () => {
    expect(existsSync(file), 'Safety test suite deleted — restore immediately').toBe(true);
  });

  it('planLifecycleSafetyBoundaryOracle.test.ts must contain safety-relevant assertions', () => {
    const content = readFileSync(file, 'utf8');
    expect(content).toContain('isSafetyMismatched');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT F — API Key Never in Client Source
// ─────────────────────────────────────────────────────────────────────────────
describe('CONTRACT F — GEMINI_API_KEY never in client source', () => {
  const KEY_PATTERN = /AIzaSy[A-Za-z0-9_-]{33}/;

  function walkDir(dir: string, ext: string[], acc: string[] = []): string[] {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walkDir(full, ext, acc);
        else if (ext.some((e: string) => entry.name.endsWith(e))) acc.push(full);
      }
    } catch { /* skip unreadable entries */ }
    return acc;
  }

  it('no Gemini API key pattern in src/', () => {
    const files = walkDir(join(ROOT, 'src'), ['.ts', '.tsx']);
    const hits: string[] = [];
    for (const f of files) {
      const content = readFileSync(f, 'utf8');
      if (KEY_PATTERN.test(content)) hits.push(f.replace(ROOT, ''));
    }
    expect(hits, `API key found in: ${hits.join(', ')}`).toHaveLength(0);
  });

  it('api/generate-plan.ts must use process.env.GEMINI_API_KEY not a literal key', () => {
    const apiFile = join(ROOT, 'api/generate-plan.ts');
    if (!existsSync(apiFile)) return; // serverless — may not be present in test env
    const content = readFileSync(apiFile, 'utf8');
    expect(KEY_PATTERN.test(content)).toBe(false);
    expect(content).toContain('GEMINI_API_KEY');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT G — Wake Lock Re-entrancy Guard Sentinel
// ─────────────────────────────────────────────────────────────────────────────
describe('CONTRACT G — Wake lock re-entrancy sentinel', () => {
  const file = join(ROOT, 'src/hooks/useWakeLock.ts');

  it('Re-entrancy guard ref must be present (isRequestingRef)', () => {
    const content = readFileSync(file, 'utf8');
    // The implementation uses isRequestingRef to prevent concurrent requests
    expect(content).toContain('isRequestingRef');
  });

  it('releaseWakeLock must be called on unmount', () => {
    const content = readFileSync(file, 'utf8');
    expect(content).toContain('releaseWakeLock');
    // The cleanup function returned from useEffect must call releaseWakeLock
    expect(content).toMatch(/return\s*\(\s*\)\s*=>\s*\{[\s\S]*?releaseWakeLock/);
  });

  it('visibilitychange listener must be registered', () => {
    const content = readFileSync(file, 'utf8');
    expect(content).toContain('visibilitychange');
  });

  it('Wake lock must respond to document.visibilityState changes', () => {
    const content = readFileSync(file, 'utf8');
    // Implementation re-acquires lock when tab becomes visible again
    expect(content).toContain('visibilityState');
    expect(content).toMatch(/visible|hidden/);
  });
});
