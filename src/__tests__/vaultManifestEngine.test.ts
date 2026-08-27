import { describe, it, expect } from 'vitest'
import { generateVaultManifest } from '@/lib/vaultManifestEngine'

describe('generateVaultManifest', () => {
  it('handles empty or null payloads gracefully', () => {
    const res = generateVaultManifest(null)
    expect(res.totalRecords).toBe(0)
    expect(res.backupReadiness).toBe(false)
    expect(res.vaultHealthStatus).toBe('optimal')
  })

  it('correctly aggregates partition counts and evaluates optimal vault health', () => {
    const payload = {
      version: 2,
      planState: {
        completedDays: [1, 2],
        weightLog: [{ date: '2026-08-01', weight: 75 }]
      },
      workoutHistory: [{ id: 'w1' }, { id: 'w2' }],
      bodyMetrics: [{ id: 'm1' }],
      savedPlans: [{ id: 'p1' }]
    }

    const res = generateVaultManifest(payload)
    expect(res.totalRecords).toBe(7)
    expect(res.partitions.planDays).toBe(2)
    expect(res.partitions.workouts).toBe(2)
    expect(res.partitions.weightEntries).toBe(1)
    expect(res.partitions.bodyMetrics).toBe(1)
    expect(res.partitions.savedPlans).toBe(1)
    expect(res.vaultHealthStatus).toBe('optimal')
    expect(res.backupReadiness).toBe(true)
  })

  it('detects dense vault status when records exceed thresholds', () => {
    const workouts = Array.from({ length: 45 }, (_, i) => ({ id: `w_${i}` }))
    const payload = {
      version: 2,
      planState: {
        completedDays: [],
        weightLog: []
      },
      workoutHistory: workouts,
      bodyMetrics: [],
      savedPlans: []
    }

    const res = generateVaultManifest(payload)
    expect(res.totalRecords).toBe(45)
    expect(res.vaultHealthStatus).toBe('dense')
  })
})
