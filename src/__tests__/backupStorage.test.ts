import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateBackupPayload,
  validateAndParseBackup,
  restoreBackupData,
  BACKUP_SCHEMA_IDENTIFIER,
  BACKUP_SCHEMA_VERSION,
  type BodyMapBackupV1
} from '@/lib/backupStorage'
import { savePersistedState, loadPersistedState } from '@/context/planStorage'
import { saveCompletedWorkoutLog, loadWorkoutHistory } from '@/lib/sessionStorage'
import { defaultFormData } from '@/context/PlanContext'

describe('Local-First Backup and Restore Storage Suite', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('generates a valid backup payload containing full user state', () => {
    localStorage.setItem('bodymap_user_name', 'Coach Maya')
    savePersistedState({
      formData: { ...defaultFormData, mainGoal: 'bulk', weight: '78' },
      generatedPlan: '# Elite Bulk Routine',
      isGenerated: true,
      weightLog: [{ date: 'Oct 1', weight: 78 }],
      completedDays: [{ date: '2026-08-26', dayIndex: 0 }]
    })

    saveCompletedWorkoutLog({
      id: 'log_99',
      sessionId: 'sess_99',
      dayIndex: 0,
      dayTitle: 'Day 1 Chest',
      dayType: 'Hypertrophy',
      completedAt: '2026-08-26T12:00:00Z',
      durationSeconds: 1800,
      totalSetsCompleted: 9,
      totalExercises: 3,
      exercisesSummary: [{ name: 'Bench Press', setsCompleted: 3, totalSets: 3 }]
    })

    const payload = generateBackupPayload()
    expect(payload.version).toBe(BACKUP_SCHEMA_VERSION)
    expect(payload.schema).toBe(BACKUP_SCHEMA_IDENTIFIER)
    expect(payload.userName).toBe('Coach Maya')
    expect(payload.planState.isGenerated).toBe(true)
    expect(payload.planState.formData.mainGoal).toBe('bulk')
    expect(payload.workoutHistory.length).toBe(1)
    expect(payload.workoutHistory[0].id).toBe('log_99')
  })

  it('validates and rejects invalid or corrupted backup json', () => {
    const invalidEmpty = validateAndParseBackup('')
    expect(invalidEmpty.success).toBe(false)

    const invalidSyntax = validateAndParseBackup('{ bad json')
    expect(invalidSyntax.success).toBe(false)

    const invalidSchema = validateAndParseBackup(JSON.stringify({ schema: 'unknown_app' }))
    expect(invalidSchema.success).toBe(false)
    if (!invalidSchema.success) {
      expect(invalidSchema.error).toContain('Unsupported backup schema')
    }

    const missingPlanState = validateAndParseBackup(
      JSON.stringify({ schema: BACKUP_SCHEMA_IDENTIFIER, version: BACKUP_SCHEMA_VERSION })
    )
    expect(missingPlanState.success).toBe(false)
  })

  it('successfully parses and restores a valid backup into localStorage', () => {
    const mockBackup: BodyMapBackupV1 = {
      version: BACKUP_SCHEMA_VERSION,
      schema: BACKUP_SCHEMA_IDENTIFIER,
      exportedAt: new Date().toISOString(),
      userName: 'Champion Athlete',
      planState: {
        formData: { ...defaultFormData, mainGoal: 'slim', weight: '65' },
        generatedPlan: '# Calorie Shred Plan',
        isGenerated: true,
        weightLog: [{ date: 'Sep 1', weight: 65 }],
        completedDays: [{ date: '2026-08-25', dayIndex: 0 }]
      },
      activeSession: null,
      workoutHistory: [
        {
          id: 'log_restored',
          sessionId: 'sess_restored',
          dayIndex: 0,
          dayTitle: 'Day 1 Cardio',
          dayType: 'HIIT',
          completedAt: '2026-08-25T09:00:00Z',
          durationSeconds: 1200,
          totalSetsCompleted: 6,
          totalExercises: 2,
          exercisesSummary: []
        }
      ]
    }

    const parseResult = validateAndParseBackup(JSON.stringify(mockBackup))
    expect(parseResult.success).toBe(true)

    if (parseResult.success) {
      const restoreResult = restoreBackupData(parseResult.data)
      expect(restoreResult.success).toBe(true)

      const restoredPlan = loadPersistedState()
      expect(restoredPlan.formData.mainGoal).toBe('slim')
      expect(restoredPlan.formData.weight).toBe('65')
      expect(localStorage.getItem('bodymap_user_name')).toBe('Champion Athlete')

      const restoredHistory = loadWorkoutHistory()
      expect(restoredHistory.length).toBe(1)
      expect(restoredHistory[0].id).toBe('log_restored')
    }
  })
})
