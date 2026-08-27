export interface VaultPartitionCounts {
  planDays: number
  workouts: number
  weightEntries: number
  bodyMetrics: number
  savedPlans: number
}

export interface VaultManifestSummary {
  totalRecords: number
  partitions: VaultPartitionCounts
  vaultHealthStatus: 'optimal' | 'moderate' | 'dense'
  backupReadiness: boolean
  factualSummary: string
}

/**
 * Deterministically analyzes a backup JSON payload or current local stores to generate an indexed Data Vault Manifest.
 *
 * NON-MEDICAL HEURISTIC:
 * Aggregates athlete local storage partition metrics deterministically.
 * Never issues clinical diagnoses or guaranteed physiological outcomes.
 */
export function generateVaultManifest(payload: Record<string, unknown> | null | undefined): VaultManifestSummary {
  if (!payload || typeof payload !== 'object') {
    return {
      totalRecords: 0,
      partitions: {
        planDays: 0,
        workouts: 0,
        weightEntries: 0,
        bodyMetrics: 0,
        savedPlans: 0
      },
      vaultHealthStatus: 'optimal',
      backupReadiness: false,
      factualSummary: 'Empty or uninitialized vault.'
    }
  }

  const planState = payload.planState as Record<string, unknown> | undefined
  const planDays = Array.isArray(planState?.completedDays) ? planState.completedDays.length : 0
  const workouts = Array.isArray(payload.workoutHistory) ? payload.workoutHistory.length : 0
  const weightEntries = Array.isArray(planState?.weightLog) ? planState.weightLog.length : 0
  const bodyMetrics = Array.isArray(payload.bodyMetrics) ? payload.bodyMetrics.length : 0
  const savedPlans = Array.isArray(payload.savedPlans) ? payload.savedPlans.length : 0

  const totalRecords = planDays + workouts + weightEntries + bodyMetrics + savedPlans

  let vaultHealthStatus: 'optimal' | 'moderate' | 'dense' = 'optimal'
  if (totalRecords >= 100 || workouts >= 40) {
    vaultHealthStatus = 'dense'
  } else if (totalRecords >= 30 || workouts >= 15) {
    vaultHealthStatus = 'moderate'
  }

  const backupReadiness = totalRecords > 0

  const factualSummary = totalRecords > 0
    ? `${totalRecords} items indexed across 5 partitions (${workouts} workouts, ${weightEntries} weights, ${savedPlans} plans).`
    : 'No records currently stored in Data Vault.'

  return {
    totalRecords,
    partitions: {
      planDays,
      workouts,
      weightEntries,
      bodyMetrics,
      savedPlans
    },
    vaultHealthStatus,
    backupReadiness,
    factualSummary
  }
}
