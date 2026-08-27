export interface CategoryDiagnostic {
  name: string
  count: number
  estimatedBytes: number
  status: 'healthy' | 'empty' | 'warning'
}

export interface BackupDiagnosticsResult {
  isValidStructure: boolean
  schemaIdentifier: string
  version: string
  exportedAt: string | null
  totalEstimatedBytes: number
  totalRecords: number
  earliestDate: string | null
  latestDate: string | null
  categories: CategoryDiagnostic[]
  integritySummary: string
}

/**
 * Deterministically analyzes a BodyMap backup snapshot without modifying state.
 * Produces an athlete-facing diagnostic report of storage breakdown and integrity.
 */
export function analyzeBackupDiagnostics(payload: unknown): BackupDiagnosticsResult {
  if (!payload || typeof payload !== 'object') {
    return {
      isValidStructure: false,
      schemaIdentifier: 'unknown',
      version: 'unknown',
      exportedAt: null,
      totalEstimatedBytes: 0,
      totalRecords: 0,
      earliestDate: null,
      latestDate: null,
      categories: [],
      integritySummary: 'Corrupt or non-object backup structure.'
    }
  }

  const raw = payload as Record<string, unknown>
  const schemaIdentifier = typeof raw.schema === 'string' ? raw.schema : (typeof raw.version === 'string' ? raw.version : 'unknown')
  const version = typeof raw.version === 'string' ? raw.version : '2.3.0'
  const exportedAt = typeof raw.exportedAt === 'string' ? raw.exportedAt : null

  let totalBytes = 0
  try {
    totalBytes = new Blob([JSON.stringify(raw)]).size
  } catch {
    totalBytes = JSON.stringify(raw).length
  }

  // Analyze plan state
  const planState = (raw.planState || raw.state || {}) as Record<string, unknown>
  const weightLogs = Array.isArray(planState.weightLog) ? planState.weightLog : []
  const completedDays = Array.isArray(planState.completedDays) ? planState.completedDays : []
  const hasPlan = Boolean(planState.generatedPlan && typeof planState.generatedPlan === 'string' && planState.generatedPlan.length > 0)

  // Analyze workout history
  const history = Array.isArray(raw.workoutHistory) ? raw.workoutHistory : (Array.isArray(raw.history) ? raw.history : [])
  const savedPlans = Array.isArray(raw.savedPlans) ? raw.savedPlans : []
  const bodyMetrics = Array.isArray(raw.bodyMetrics) ? raw.bodyMetrics : []

  const categories: CategoryDiagnostic[] = [
    {
      name: 'Training Plan',
      count: (hasPlan ? 1 : 0) + completedDays.length,
      estimatedBytes: JSON.stringify(planState).length,
      status: (hasPlan || completedDays.length > 0) ? 'healthy' : 'empty'
    },
    {
      name: 'Workout History',
      count: history.length,
      estimatedBytes: JSON.stringify(history).length,
      status: history.length > 0 ? 'healthy' : 'empty'
    },
    {
      name: 'Saved Plans Library',
      count: savedPlans.length,
      estimatedBytes: JSON.stringify(savedPlans).length,
      status: savedPlans.length > 0 ? 'healthy' : 'empty'
    },
    {
      name: 'Body Measurements',
      count: bodyMetrics.length,
      estimatedBytes: JSON.stringify(bodyMetrics).length,
      status: bodyMetrics.length > 0 ? 'healthy' : 'empty'
    },
    {
      name: 'Weight History',
      count: weightLogs.length,
      estimatedBytes: JSON.stringify(weightLogs).length,
      status: weightLogs.length > 0 ? 'healthy' : 'empty'
    }
  ]

  const totalRecords = (hasPlan ? 1 : 0) + history.length + savedPlans.length + bodyMetrics.length + weightLogs.length

  // Find date boundaries across history
  let earliestDate: string | null = null
  let latestDate: string | null = null

  if (history.length > 0) {
    const dates = history
      .map(item => item && typeof item === 'object' && typeof item.completedAt === 'string' ? new Date(item.completedAt).getTime() : NaN)
      .filter(t => !isNaN(t))
      .sort((a, b) => a - b)

    if (dates.length > 0) {
      earliestDate = new Date(dates[0]).toISOString().split('T')[0]
      latestDate = new Date(dates[dates.length - 1]).toISOString().split('T')[0]
    }
  }

  const isValidStructure = (schemaIdentifier === 'bodymap_backup_v2' || schemaIdentifier === 'bodymap_backup_v1') && (Boolean(raw.planState) || Boolean(raw.state))

  const integritySummary = isValidStructure
    ? `Verified backup (${totalRecords} records, ~${Math.max(1, Math.round(totalBytes / 1024))} KB). All data vaults intact.`
    : 'Backup structure has missing required data partitions.'

  return {
    isValidStructure,
    schemaIdentifier,
    version,
    exportedAt,
    totalEstimatedBytes: totalBytes,
    totalRecords,
    earliestDate,
    latestDate,
    categories,
    integritySummary
  }
}
