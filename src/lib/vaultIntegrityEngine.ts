export type VaultIntegrityStatus = 'HEALTHY' | 'WARNING' | 'DEGRADED'

export interface PartitionAuditResult {
  partitionKey: string
  recordCount: number
  valid: boolean
  message: string
}

export interface VaultIntegrityAudit {
  overallStatus: VaultIntegrityStatus
  totalPartitionsAudited: number
  healthyPartitionCount: number
  partitionAudits: PartitionAuditResult[]
  integrityScorePercent: number
  auditTimestamp: string
  recommendation: string
}

/**
 * Deterministically evaluates the deep integrity of a multi-partition BodyMap Data Vault payload.
 *
 * PURE FUNCTION / NON-MUTATING:
 * Assesses structural validity, partition compliance, and format health without altering stored records.
 */
export function auditVaultIntegrity(vaultData: Record<string, unknown> | null | undefined): VaultIntegrityAudit {
  const now = new Date().toISOString()

  if (!vaultData || typeof vaultData !== 'object' || Object.keys(vaultData).length === 0) {
    return {
      overallStatus: 'DEGRADED',
      totalPartitionsAudited: 0,
      healthyPartitionCount: 0,
      partitionAudits: [],
      integrityScorePercent: 0,
      auditTimestamp: now,
      recommendation: 'Vault data is empty or unavailable. Initialize local data or import a valid backup.'
    }
  }

  const expectedPartitions = [
    'plan',
    'workoutHistory',
    'bodyMetrics',
    'savedPlans',
    'sessionReflections'
  ]

  const audits: PartitionAuditResult[] = []

  for (const key of expectedPartitions) {
    const partitionVal = vaultData[key]
    if (partitionVal === undefined || partitionVal === null) {
      audits.push({
        partitionKey: key,
        recordCount: 0,
        valid: true,
        message: 'Partition is unpopulated (default empty state).'
      })
    } else if (Array.isArray(partitionVal)) {
      audits.push({
        partitionKey: key,
        recordCount: partitionVal.length,
        valid: true,
        message: `Valid array partition with ${partitionVal.length} entries.`
      })
    } else if (typeof partitionVal === 'object') {
      audits.push({
        partitionKey: key,
        recordCount: 1,
        valid: true,
        message: 'Valid structured object partition.'
      })
    } else {
      audits.push({
        partitionKey: key,
        recordCount: 0,
        valid: false,
        message: `Invalid format: expected array or object, found ${typeof partitionVal}.`
      })
    }
  }

  const healthyCount = audits.filter(a => a.valid).length
  const totalCount = audits.length
  const integrityScorePercent = Math.round((healthyCount / totalCount) * 100)

  let overallStatus: VaultIntegrityStatus = 'HEALTHY'
  let recommendation = 'All vault partitions comply with local schema contracts.'

  if (integrityScorePercent < 70) {
    overallStatus = 'DEGRADED'
    recommendation = 'Critical partition formatting errors detected. Review or repair backup before restoring.'
  } else if (integrityScorePercent < 100) {
    overallStatus = 'WARNING'
    recommendation = 'Non-critical partition warnings present. Export a fresh backup to reconcile schemas.'
  }

  return {
    overallStatus,
    totalPartitionsAudited: totalCount,
    healthyPartitionCount: healthyCount,
    partitionAudits: audits,
    integrityScorePercent,
    auditTimestamp: now,
    recommendation
  }
}
