import { describe, it, expect } from 'vitest'
import { auditVaultIntegrity } from '@/lib/vaultIntegrityEngine'

describe('vaultIntegrityEngine', () => {
  it('correctly audits empty/null vault payloads as DEGRADED with 0 score', () => {
    const auditNull = auditVaultIntegrity(null)
    expect(auditNull.overallStatus).toBe('DEGRADED')
    expect(auditNull.integrityScorePercent).toBe(0)

    const auditEmpty = auditVaultIntegrity({})
    expect(auditEmpty.overallStatus).toBe('DEGRADED')
    expect(auditEmpty.integrityScorePercent).toBe(0)
  })

  it('correctly audits standard healthy multi-partition vaults as HEALTHY with 100% score', () => {
    const validVault = {
      plan: { days: [] },
      workoutHistory: [{ id: '1', date: '2026-08-28' }],
      bodyMetrics: [{ date: '2026-08-28', weight: 75 }],
      savedPlans: [],
      sessionReflections: [{ sessionId: 'sess_1', rpe: 8 }]
    }

    const audit = auditVaultIntegrity(validVault)
    expect(audit.overallStatus).toBe('HEALTHY')
    expect(audit.integrityScorePercent).toBe(100)
    expect(audit.healthyPartitionCount).toBe(5)
    expect(audit.partitionAudits.length).toBe(5)
  })

  it('correctly identifies malformed partitions and downgrades score accordingly', () => {
    const corruptedVault = {
      plan: 'invalid-string-instead-of-object',
      workoutHistory: 12345, // invalid type
      bodyMetrics: [],
      savedPlans: [],
      sessionReflections: []
    }

    const audit = auditVaultIntegrity(corruptedVault as unknown as Record<string, unknown>)
    expect(audit.overallStatus).toBe('DEGRADED')
    expect(audit.integrityScorePercent).toBe(60)
    expect(audit.healthyPartitionCount).toBe(3)
  })
})
