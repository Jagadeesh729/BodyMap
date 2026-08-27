import { describe, it, expect } from 'vitest'
import { validateBackupPayload } from '@/lib/backupIntegrity'

describe('Backup Data Integrity & Vault Validator Suite', () => {
  it('validates complete authentic bodymap_backup_v2 payloads', () => {
    const validPayload = {
      version: 'bodymap_backup_v2',
      exportedAt: '2026-08-27T10:00:00Z',
      state: {
        isGenerated: true,
        formData: { weight: '75', mainGoal: 'Muscle Gain' },
        weightLog: [{ date: 'Aug 27', weight: 75 }]
      },
      history: [
        {
          id: 'log_1',
          sessionId: 's_1',
          completedAt: '2026-08-27T10:00:00Z',
          exercisesSummary: []
        }
      ],
      savedPlans: [{ id: 'plan_1', title: 'Power Routine' }]
    }

    const res = validateBackupPayload(validPayload)
    expect(res.isValid).toBe(true)
    expect(res.version).toBe('bodymap_backup_v2')
    expect(res.workoutCount).toBe(1)
    expect(res.savedPlansCount).toBe(1)
    expect(res.weightLogsCount).toBe(1)
    expect(res.errors.length).toBe(0)
  })

  it('flags unsupported versions or missing state structures', () => {
    const badVersion = {
      version: 'unknown_version_9',
      exportedAt: '2026-08-27T10:00:00Z',
      state: {}
    }
    const res1 = validateBackupPayload(badVersion)
    expect(res1.isValid).toBe(false)
    expect(res1.errors.some(e => e.includes('Unsupported backup schema version'))).toBe(true)

    const missingState = {
      version: 'bodymap_backup_v2',
      exportedAt: '2026-08-27T10:00:00Z'
    }
    const res2 = validateBackupPayload(missingState)
    expect(res2.isValid).toBe(false)
    expect(res2.errors.some(e => e.includes('Required "state" object is missing'))).toBe(true)
  })

  it('handles null, empty, or non-object payloads safely', () => {
    expect(validateBackupPayload(null).isValid).toBe(false)
    expect(validateBackupPayload('bad string').isValid).toBe(false)
    expect(validateBackupPayload({}).isValid).toBe(false)
  })
})
