import { describe, it, expect } from 'vitest'
import { analyzeBackupDiagnostics } from '@/lib/backupDiagnostics'

describe('analyzeBackupDiagnostics', () => {
  it('handles null, non-object, or empty payloads gracefully', () => {
    const res = analyzeBackupDiagnostics(null)
    expect(res.isValidStructure).toBe(false)
    expect(res.totalRecords).toBe(0)
    expect(res.integritySummary).toContain('Corrupt or non-object')
  })

  it('analyzes authentic canonical V2 backup structure with full partition breakdown', () => {
    const canonicalBackup = {
      schema: 'bodymap_backup_v2',
      version: '2.3.0',
      exportedAt: '2026-08-27T10:00:00.000Z',
      planState: {
        isGenerated: true,
        generatedPlan: '# 7-Day Push/Pull/Legs Routine',
        formData: { mainGoal: 'Hypertrophy' },
        weightLog: [{ date: 'Aug 24', weight: 78.5 }, { date: 'Aug 27', weight: 78.2 }],
        completedDays: [{ date: 'Aug 27', dayIndex: 0 }]
      },
      workoutHistory: [
        {
          id: 'log_1',
          sessionId: 's_1',
          dayIndex: 0,
          dayTitle: 'Day 1 - Push',
          completedAt: '2026-08-20T10:00:00.000Z',
          durationSeconds: 3600,
          totalSetsCompleted: 12,
          totalExercises: 4,
          exercisesSummary: []
        },
        {
          id: 'log_2',
          sessionId: 's_2',
          dayIndex: 1,
          dayTitle: 'Day 2 - Pull',
          completedAt: '2026-08-25T10:00:00.000Z',
          durationSeconds: 3200,
          totalSetsCompleted: 10,
          totalExercises: 3,
          exercisesSummary: []
        }
      ],
      savedPlans: [
        { id: 'plan_1', name: 'Winter Hypertrophy Block', planState: {} }
      ],
      bodyMetrics: [
        { id: 'bm_1', date: '2026-08-27', waist: 82, chest: 102 }
      ]
    }

    const res = analyzeBackupDiagnostics(canonicalBackup)
    expect(res.isValidStructure).toBe(true)
    expect(res.schemaIdentifier).toBe('bodymap_backup_v2')
    expect(res.version).toBe('2.3.0')
    expect(res.totalRecords).toBe(7) // 1 plan + 2 history + 1 savedPlan + 1 bodyMetric + 2 weightLogs
    expect(res.earliestDate).toBe('2026-08-20')
    expect(res.latestDate).toBe('2026-08-25')
    expect(res.categories.length).toBe(5)
    expect(res.categories.every(c => c.status === 'healthy')).toBe(true)
    expect(res.integritySummary).toContain('Verified backup (7 records')
  })

  it('correctly reports empty status for missing or zero-length partitions', () => {
    const minimalBackup = {
      schema: 'bodymap_backup_v2',
      version: '2.3.0',
      exportedAt: '2026-08-27T10:00:00.000Z',
      planState: {
        isGenerated: false,
        formData: {},
        weightLog: []
      },
      workoutHistory: [],
      savedPlans: [],
      bodyMetrics: []
    }

    const res = analyzeBackupDiagnostics(minimalBackup)
    expect(res.isValidStructure).toBe(true)
    expect(res.totalRecords).toBe(0)
    expect(res.categories.every(c => c.status === 'empty')).toBe(true)
    expect(res.earliestDate).toBeNull()
    expect(res.latestDate).toBeNull()
  })

  it('supports legacy V1 backup structure with state and history keys', () => {
    const legacyBackup = {
      schema: 'bodymap_backup_v1',
      version: '1.0.0',
      state: {
        isGenerated: true,
        generatedPlan: '# Old Routine',
        weightLog: []
      },
      history: [
        { id: 'old_1', completedAt: '2026-08-01T10:00:00.000Z' }
      ]
    }

    const res = analyzeBackupDiagnostics(legacyBackup)
    expect(res.isValidStructure).toBe(true)
    expect(res.schemaIdentifier).toBe('bodymap_backup_v1')
    expect(res.totalRecords).toBe(2)
  })
})
