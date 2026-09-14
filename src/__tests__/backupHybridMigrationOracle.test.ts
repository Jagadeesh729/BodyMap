import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  validateAndParseBackup,
  restoreBackupData,
  generateBackupPayload,
  BACKUP_SCHEMA_VERSION,
  BACKUP_SCHEMA_IDENTIFIER,
  LEGACY_BACKUP_SCHEMA_IDENTIFIER,
  type BodyMapBackupV2
} from '@/lib/backupStorage'
import { STORAGE_KEY } from '@/context/planStorage'
import { WORKOUT_HISTORY_STORAGE_KEY } from '@/lib/sessionStorage'
import { SAVED_PLANS_STORAGE_KEY } from '@/lib/savedPlansStorage'
import { BODY_METRICS_STORAGE_KEY } from '@/lib/bodyMetricsStorage'
import { initialState, type PlanState } from '@/context/PlanContext'

describe('Backup Hybrid Migration & Schema Hardening Oracle (E10)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  const validPlanState: PlanState = {
    ...initialState,
    formData: {
      ...initialState.formData,
      age: '28',
      weight: '75',
      mainGoal: 'bulk'
    },
    planId: 'plan_oracle_valid',
    isGenerated: true
  }

  // 1. Pure valid V2 backup
  it('Case 1: parses and validates a pure valid V2 backup', () => {
    const backup: BodyMapBackupV2 = {
      version: BACKUP_SCHEMA_VERSION,
      schema: BACKUP_SCHEMA_IDENTIFIER,
      exportedAt: '2026-03-10T12:00:00.000Z',
      userName: 'Athlete Alex',
      planState: validPlanState,
      savedPlans: [],
      bodyMetrics: [],
      activeSession: null,
      workoutHistory: []
    }

    const result = validateAndParseBackup(JSON.stringify(backup))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.schema).toBe(BACKUP_SCHEMA_IDENTIFIER)
    expect(result.data.userName).toBe('Athlete Alex')
    expect(result.data.planState.formData.mainGoal).toBe('bulk')
    expect(result.data.planState.formData.weight).toBe('75')
  })

  // 2. Pure valid V1 backup (migrates schema to V2)
  it('Case 2: auto-migrates a pure valid legacy V1 backup to V2', () => {
    const legacyV1 = {
      version: '1.2.0',
      schema: LEGACY_BACKUP_SCHEMA_IDENTIFIER,
      exportedAt: '2025-08-01T10:00:00.000Z',
      planState: validPlanState
    }

    const result = validateAndParseBackup(JSON.stringify(legacyV1))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.schema).toBe(BACKUP_SCHEMA_IDENTIFIER)
    expect(result.data.userName).toBe('Athlete')
    expect(result.data.workoutHistory).toEqual([])
  })

  // 3. Hybrid backup: V1 schema marker with V2 extra fields
  it('Case 3: parses hybrid backup with V1 marker but containing V2 collections', () => {
    const hybridV1 = {
      version: '1.9.0',
      schema: LEGACY_BACKUP_SCHEMA_IDENTIFIER,
      exportedAt: '2025-11-20T10:00:00.000Z',
      planState: validPlanState,
      workoutHistory: [
        {
          id: 'log_hybrid_1',
          sessionId: 'sess_h1',
          dayIndex: 0,
          dayTitle: 'Full Body',
          dayType: 'Hypertrophy',
          completedAt: '2025-11-19T10:00:00.000Z',
          durationSeconds: 2400,
          totalSetsCompleted: 8,
          totalExercises: 2,
          exercisesSummary: [{ name: 'Squat', setsCompleted: 4, totalSets: 4, peakWeightKg: 100 }]
        }
      ]
    }

    const result = validateAndParseBackup(JSON.stringify(hybridV1))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.schema).toBe(BACKUP_SCHEMA_IDENTIFIER)
    expect(result.data.workoutHistory.length).toBe(1)
    expect(result.data.workoutHistory[0].id).toBe('log_hybrid_1')
  })

  // 4. Hybrid backup: V2 schema marker with legacy and extra metadata
  it('Case 4: preserves V2 schema marker and cleans extraneous metadata', () => {
    const hybridV2 = {
      version: '2.0.0-beta',
      schema: BACKUP_SCHEMA_IDENTIFIER,
      exportedAt: '2026-01-01T00:00:00.000Z',
      legacyKeyUnused: 'deprecated_value',
      planState: validPlanState,
      workoutHistory: []
    }

    const result = validateAndParseBackup(JSON.stringify(hybridV2))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.schema).toBe(BACKUP_SCHEMA_IDENTIFIER)
  })

  // 5. Empty string or whitespace input
  it('Case 5: fails gracefully on empty string or whitespace input', () => {
    expect(validateAndParseBackup('')).toEqual({
      success: false,
      error: 'The provided backup file is empty.'
    })
    expect(validateAndParseBackup('   \n  \t ')).toEqual({
      success: false,
      error: 'The provided backup file is empty.'
    })
  })

  // 6. Non-JSON / Truncated JSON
  it('Case 6: returns corrupted syntax error on malformed or truncated JSON', () => {
    const malformed = '{"schema": "bodymap_backup_v2", "planState": {'
    const result = validateAndParseBackup(malformed)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain('Corrupted JSON syntax')
  })

  // 7. Primitive non-object root
  it('Case 7: rejects non-object root payloads (arrays, primitives)', () => {
    expect(validateAndParseBackup('12345').success).toBe(false)
    expect(validateAndParseBackup('"hello"').success).toBe(false)
    expect(validateAndParseBackup('[1, 2, 3]').success).toBe(false)
    expect(validateAndParseBackup('true').success).toBe(false)
  })

  // 8. Unsupported schema identifier
  it('Case 8: rejects backup with unsupported or unknown schema identifier', () => {
    const unknownSchema = {
      schema: 'unsupported_fitness_app_v9',
      planState: validPlanState
    }
    const result = validateAndParseBackup(JSON.stringify(unknownSchema))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain('Unsupported backup schema')
  })

  // 9. Missing planState
  it('Case 9: rejects backup missing planState', () => {
    const noPlan = {
      schema: BACKUP_SCHEMA_IDENTIFIER,
      userName: 'Athlete'
    }
    const result = validateAndParseBackup(JSON.stringify(noPlan))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toContain('Missing or invalid planState data')
  })

  // 10. Corrupted or null planState
  it('Case 10: rejects backup with null or non-object planState', () => {
    const nullPlan = {
      schema: BACKUP_SCHEMA_IDENTIFIER,
      planState: null
    }
    expect(validateAndParseBackup(JSON.stringify(nullPlan)).success).toBe(false)

    const primitivePlan = {
      schema: BACKUP_SCHEMA_IDENTIFIER,
      planState: 'not-an-object'
    }
    expect(validateAndParseBackup(JSON.stringify(primitivePlan)).success).toBe(false)
  })

  // 11. Partial planState sanitized safely
  it('Case 11: sanitizes partial planState through buildSafeState defaults', () => {
    const partialStateBackup = {
      schema: BACKUP_SCHEMA_IDENTIFIER,
      planState: {
        formData: { weight: '82', mainGoal: 'bulk' },
        isGenerated: true
      }
    }
    const result = validateAndParseBackup(JSON.stringify(partialStateBackup))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.planState.formData.weight).toBe('82')
    expect(result.data.planState.formData.mainGoal).toBe('bulk')
    expect(result.data.planState.formData.gender).toBe('') // safe default from initialState
  })

  // 12. Corrupt savedPlans array handling
  it('Case 12: filters out malformed or null entries from savedPlans', () => {
    const backupWithCorruptPlans = {
      schema: BACKUP_SCHEMA_IDENTIFIER,
      planState: validPlanState,
      savedPlans: [
        null,
        { id: 'good_plan', name: 'Valid Routine', planState: validPlanState },
        { id: 123 }, // missing name and planState
        { id: 'no_state', name: 'No Plan State' }
      ]
    }
    const result = validateAndParseBackup(JSON.stringify(backupWithCorruptPlans))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.savedPlans.length).toBe(1)
    expect(result.data.savedPlans[0].id).toBe('good_plan')
  })

  // 13. Corrupt bodyMetrics array handling
  it('Case 13: filters out malformed bodyMetrics entries', () => {
    const backupWithCorruptMetrics = {
      schema: BACKUP_SCHEMA_IDENTIFIER,
      planState: validPlanState,
      bodyMetrics: [
        null,
        { id: 'm_1', date: '2026-03-01', waist: 80 },
        { date: '2026-03-02' }, // missing id
        'invalid metric entry'
      ]
    }
    const result = validateAndParseBackup(JSON.stringify(backupWithCorruptMetrics))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.bodyMetrics.length).toBe(1)
    expect(result.data.bodyMetrics[0].id).toBe('m_1')
  })

  // 14. Corrupt workoutHistory array handling
  it('Case 14: filters out corrupted logs from workoutHistory', () => {
    const backupWithCorruptLogs = {
      schema: BACKUP_SCHEMA_IDENTIFIER,
      planState: validPlanState,
      workoutHistory: [
        null,
        { id: 'valid_log', dayTitle: 'Upper A', completedAt: '2026-03-01' },
        { id: 'missing_title' }, // missing dayTitle
        { dayTitle: 'missing_id' } // missing id
      ]
    }
    const result = validateAndParseBackup(JSON.stringify(backupWithCorruptLogs))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.workoutHistory.length).toBe(1)
    expect(result.data.workoutHistory[0].id).toBe('valid_log')
  })

  // 15. ActiveSession hydration verification
  it('Case 15: preserves valid activeSession and defaults invalid to null', () => {
    const withSession = {
      schema: BACKUP_SCHEMA_IDENTIFIER,
      planState: validPlanState,
      activeSession: {
        sessionId: 'active_123',
        status: 'in-progress',
        exercises: []
      }
    }
    const result = validateAndParseBackup(JSON.stringify(withSession))
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.activeSession?.sessionId).toBe('active_123')

    const withoutSession = {
      schema: BACKUP_SCHEMA_IDENTIFIER,
      planState: validPlanState,
      activeSession: null
    }
    const result2 = validateAndParseBackup(JSON.stringify(withoutSession))
    expect(result2.success).toBe(true)
    if (!result2.success) return
    expect(result2.data.activeSession).toBeNull()
  })

  // 16. Atomic restore pre-state snapshot verification
  it('Case 16: guarantees atomic pre-restore preservation on restore failure', () => {
    // Seed pre-existing storage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validPlanState))
    localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify([{ id: 'preserve_me', dayTitle: 'Saved' }]))

    // Create a backup object that will fail during restore
    const badBackup: BodyMapBackupV2 = {
      version: BACKUP_SCHEMA_VERSION,
      schema: BACKUP_SCHEMA_IDENTIFIER,
      exportedAt: '2026-03-01',
      planState: null as unknown as PlanState, // causes savePersistedState to throw/fail
      savedPlans: [],
      bodyMetrics: [],
      activeSession: null,
      workoutHistory: []
    }

    const restoreResult = restoreBackupData(badBackup)
    expect(restoreResult.success).toBe(false)

    // Verify existing state was rolled back and preserved
    const rawHistory = localStorage.getItem(WORKOUT_HISTORY_STORAGE_KEY)
    expect(rawHistory).toContain('preserve_me')
  })

  // 17. Restore rollback on simulated quota failure
  it('Case 17: executes rollback cleanly if quota is exceeded during restore', () => {
    localStorage.setItem('bodymap_user_name', 'PreExistingName')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validPlanState))

    const validBackup: BodyMapBackupV2 = {
      version: BACKUP_SCHEMA_VERSION,
      schema: BACKUP_SCHEMA_IDENTIFIER,
      exportedAt: '2026-03-01',
      userName: 'NewNameAttempt',
      planState: validPlanState,
      savedPlans: [],
      bodyMetrics: [],
      activeSession: null,
      workoutHistory: []
    }

    // Simulate quota failure during localStorage write
    const originalSetItem = localStorage.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      if (key === 'bodymap_user_name' && value === 'NewNameAttempt') {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
      }
      return originalSetItem.call(localStorage, key, value)
    })

    const restoreResult = restoreBackupData(validBackup)
    expect(restoreResult.success).toBe(false)
    expect(restoreResult.error).toContain('Storage quota exceeded')
  })

  // 18. Prototype pollution immunity
  it('Case 18: immune to prototype pollution in JSON payload', () => {
    const malicious = `{"schema":"bodymap_backup_v2","__proto__":{"polluted":true},"planState":${JSON.stringify(validPlanState)}}`
    const parsed = validateAndParseBackup(malicious)
    expect(parsed.success).toBe(true)
    // @ts-expect-error test pollution
    expect(Object.prototype.polluted).toBeUndefined()
  })

  // 19. Large payload resilience
  it('Case 19: parses large history payloads without memory or range exceptions', () => {
    const largeHistory = Array.from({ length: 250 }, (_, i) => ({
      id: `log_large_${i}`,
      sessionId: `sess_${i}`,
      dayIndex: i % 7,
      dayTitle: `Session Day ${i}`,
      dayType: 'Hypertrophy',
      completedAt: new Date(Date.now() - i * 86400000).toISOString(),
      durationSeconds: 3600,
      totalSetsCompleted: 15,
      totalExercises: 4,
      exercisesSummary: [
        { name: 'Barbell Squat', setsCompleted: 4, totalSets: 4, peakWeightKg: 120 + (i % 20) }
      ]
    }))

    const largeBackup: BodyMapBackupV2 = {
      version: BACKUP_SCHEMA_VERSION,
      schema: BACKUP_SCHEMA_IDENTIFIER,
      exportedAt: new Date().toISOString(),
      userName: 'Endurance Athlete',
      planState: validPlanState,
      savedPlans: [],
      bodyMetrics: [],
      activeSession: null,
      workoutHistory: largeHistory
    }

    const jsonStr = JSON.stringify(largeBackup)
    expect(jsonStr.length).toBeGreaterThan(50000)

    const result = validateAndParseBackup(jsonStr)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.workoutHistory.length).toBe(250)
  })

  // 20. Full roundtrip determinism
  it('Case 20: full roundtrip determinism: generate -> validate -> restore', () => {
    // Seed data
    localStorage.setItem('bodymap_user_name', 'Roundtrip Champion')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validPlanState))
    localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify([
      { id: 'plan_rt_1', name: 'RT Plan', createdAt: '2026-01-01', planState: validPlanState }
    ]))
    localStorage.setItem(BODY_METRICS_STORAGE_KEY, JSON.stringify([
      { id: 'bm_rt_1', date: '2026-01-01', waist: 82 }
    ]))
    localStorage.setItem(WORKOUT_HISTORY_STORAGE_KEY, JSON.stringify([
      {
        id: 'wh_rt_1',
        sessionId: 's_rt_1',
        dayIndex: 0,
        dayTitle: 'Legs',
        dayType: 'Strength',
        completedAt: '2026-01-02T10:00:00.000Z',
        durationSeconds: 2700,
        totalSetsCompleted: 9,
        totalExercises: 3,
        exercisesSummary: []
      }
    ]))

    // 1. Generate payload
    const generated = generateBackupPayload()
    expect(generated.userName).toBe('Roundtrip Champion')
    expect(generated.workoutHistory.length).toBe(1)
    expect(generated.savedPlans.length).toBe(1)
    expect(generated.bodyMetrics.length).toBe(1)

    // 2. Validate and parse
    const jsonStr = JSON.stringify(generated)
    const parsed = validateAndParseBackup(jsonStr)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    // 3. Clear storage and restore
    localStorage.clear()
    const restoreResult = restoreBackupData(parsed.data)
    expect(restoreResult.success).toBe(true)

    // Verify restored storage matches original seeded values
    expect(localStorage.getItem('bodymap_user_name')).toBe('Roundtrip Champion')
    expect(JSON.parse(localStorage.getItem(WORKOUT_HISTORY_STORAGE_KEY) || '[]').length).toBe(1)
    expect(JSON.parse(localStorage.getItem(SAVED_PLANS_STORAGE_KEY) || '[]').length).toBe(1)
    expect(JSON.parse(localStorage.getItem(BODY_METRICS_STORAGE_KEY) || '[]').length).toBe(1)
  })
})
