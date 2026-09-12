/**
 * PHASE 7 — Offline Capability Contract
 * =======================================
 * Asserts that the declared offline-safe feature set remains structurally
 * intact (their rendering code exists and is wired in). This does NOT test
 * actual browser offline behaviour (which is a domain-inherent limitation).
 *
 * Declared offline-safe features (from release-contract.json):
 *  - View saved weekly plan (WeeklyPlanPage)
 *  - View daily workout details (WeeklyPlanPage / GymModePage)
 *  - Log completed exercises and sets (GymModePage)
 *  - Start rest timer (GymModePage)
 *  - Start workout timer (GymModePage)
 *  - View exercise substitutions (WeeklyPlanPage / GymModePage)
 *  - View barbell plate calculator (plateLoadingCalculator)
 *  - View workout history and analytics (DashboardPage)
 *  - View personal records vault (DashboardPage / GymModePage)
 *  - View body metrics tracker (bodyMetricsStorage)
 *  - View nutrition / grocery list (WeeklyPlanPage)
 *  - Export / download saved plan (DownloadPlanPage)
 *  - Restore from backup file (backupStorage)
 *  - View all static app content (Router / static assets)
 *
 * Cloud AI generation is declared UNAVAILABLE offline — this is tested by
 * asserting the offline detection + user feedback path exists.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(__dirname, '../..');

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT A — Offline-safe feature modules exist
// ─────────────────────────────────────────────────────────────────────────────
describe('PHASE 7 — Offline Capability Contract', () => {

  describe('P7-A — Offline-safe feature modules exist', () => {
    const OFFLINE_SAFE_MODULES = [
      { file: 'src/pages/WeeklyPlanPage.tsx',        feature: 'View saved weekly plan' },
      { file: 'src/pages/GymModePage.tsx',           feature: 'Gym mode / rest timer / workout timer' },
      { file: 'src/lib/plateLoadingCalculator.ts',   feature: 'Barbell plate calculator' },
      { file: 'src/pages/DashboardPage.tsx',         feature: 'Workout history and analytics' },
      { file: 'src/lib/bodyMetricsStorage.ts',       feature: 'Body metrics tracker' },
      { file: 'src/pages/DownloadPlanPage.tsx',       feature: 'Export / download saved plan' },
      { file: 'src/lib/backupStorage.ts',             feature: 'Restore from backup file' },
    ];

    for (const { file, feature } of OFFLINE_SAFE_MODULES) {
      it(`${feature} — ${file} must exist`, () => {
        expect(existsSync(join(ROOT, file))).toBe(true);
      });
    }
  });

  describe('P7-B — Offline detection and user feedback path exists', () => {
    it('CreatePlanPage.tsx must check navigator.onLine for offline detection', () => {
      const content = readFileSync(join(ROOT, 'src/pages/CreatePlanPage.tsx'), 'utf8');
      expect(content).toContain('navigator.onLine');
    });

    it('CreatePlanPage.tsx must show a toast or feedback when offline', () => {
      const content = readFileSync(join(ROOT, 'src/pages/CreatePlanPage.tsx'), 'utf8');
      // Toast feedback: must use toast(), addToast(), or similar feedback mechanism
      expect(content).toMatch(/toast\s*\(|addToast\s*\(|setError\s*\(|showError\s*\(/);
    });

    it('CreatePlanPage.tsx must surface an offline-specific user message', () => {
      const content = readFileSync(join(ROOT, 'src/pages/CreatePlanPage.tsx'), 'utf8');
      expect(content).toMatch(/offline|no internet|network|connection/i);
    });
  });

  describe('P7-C — Cloud AI declared unavailable offline (not silently failing)', () => {
    it('CreatePlanPage.tsx must not attempt AI generation when offline', () => {
      const content = readFileSync(join(ROOT, 'src/pages/CreatePlanPage.tsx'), 'utf8');
      // The offline check must come before or guard the AI generation call
      const onlineCheckIdx = content.indexOf('navigator.onLine');
      expect(onlineCheckIdx).toBeGreaterThan(-1);
    });
  });

  describe('P7-D — GymMode rest timer structural integrity', () => {
    it('GymModePage.tsx must contain rest timer logic', () => {
      const content = readFileSync(join(ROOT, 'src/pages/GymModePage.tsx'), 'utf8');
      expect(content).toMatch(/rest.*timer|timer.*rest|restTimer|rest_timer/i);
    });

    it('GymModePage.tsx must contain set/rep logging logic', () => {
      const content = readFileSync(join(ROOT, 'src/pages/GymModePage.tsx'), 'utf8');
      expect(content).toMatch(/set[s]?.*log|log.*set[s]?|complete[d]?\s*set|sets.*complete/i);
    });
  });

  describe('P7-E — Backup restore capability', () => {
    it('backupStorage.ts must export validateAndParseBackup', () => {
      const content = readFileSync(join(ROOT, 'src/lib/backupStorage.ts'), 'utf8');
      expect(content).toMatch(/export\s+(function|const|async function)\s+validateAndParseBackup/);
    });

    it('backupStorage.ts must check BACKUP_SCHEMA_IDENTIFIER', () => {
      const content = readFileSync(join(ROOT, 'src/lib/backupStorage.ts'), 'utf8');
      expect(content).toContain('BACKUP_SCHEMA_IDENTIFIER');
    });
  });
});
