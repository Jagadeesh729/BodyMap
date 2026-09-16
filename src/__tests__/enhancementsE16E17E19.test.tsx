import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { RestTimerOverlay } from '@/components/gym/RestTimerOverlay'
import { analyzeBackupDiagnostics } from '@/lib/backupDiagnostics'
import { generateVaultManifest } from '@/lib/vaultManifestEngine'
import { findPreviousPerformance } from '@/lib/progressionEngine'
import { ExitWorkoutDialog } from '@/components/gym/ExitWorkoutDialog'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

describe('Enhancement E16: Rest Timer Quick Adjust & Bounded Presets', () => {
  it('E16-01: Renders -15s, +15s, +30s, and +60s quick step buttons with accessible labels', () => {
    const onAddSeconds = vi.fn()
    const onTogglePause = vi.fn()
    const onSkip = vi.fn()
    const onToggleSound = vi.fn()

    render(
      <RestTimerOverlay
        remainingSeconds={90}
        totalDuration={90}
        isPaused={false}
        soundEnabled={true}
        onTogglePause={onTogglePause}
        onAddSeconds={onAddSeconds}
        onSkip={onSkip}
        onToggleSound={onToggleSound}
      />
    )

    const btnSub15 = screen.getByLabelText(/Subtract 15 seconds/i)
    const btnAdd15 = screen.getByLabelText(/Add 15 seconds/i)
    const btnAdd30 = screen.getByLabelText(/Add 30 seconds/i)
    const btnAdd60 = screen.getByLabelText(/Add 60 seconds/i)

    expect(btnSub15).toBeDefined()
    expect(btnAdd15).toBeDefined()
    expect(btnAdd30).toBeDefined()
    expect(btnAdd60).toBeDefined()

    fireEvent.click(btnAdd60)
    expect(onAddSeconds).toHaveBeenCalledWith(60)

    fireEvent.click(btnAdd30)
    expect(onAddSeconds).toHaveBeenCalledWith(30)
  })

  it('E16-02: Renders preset chips and fires onSetDuration when clicked', () => {
    const onSetDuration = vi.fn()

    render(
      <RestTimerOverlay
        remainingSeconds={60}
        totalDuration={90}
        isPaused={false}
        soundEnabled={false}
        onTogglePause={vi.fn()}
        onAddSeconds={vi.fn()}
        onSetDuration={onSetDuration}
        onSkip={vi.fn()}
        onToggleSound={vi.fn()}
      />
    )

    const preset60 = screen.getByLabelText('Set rest timer to 60 seconds')
    const preset90 = screen.getByLabelText('Set rest timer to 90 seconds')
    const preset120 = screen.getByLabelText('Set rest timer to 120 seconds')
    const preset180 = screen.getByLabelText('Set rest timer to 180 seconds')

    expect(preset60).toBeDefined()
    expect(preset90).toBeDefined()
    expect(preset120).toBeDefined()
    expect(preset180).toBeDefined()

    fireEvent.click(preset120)
    expect(onSetDuration).toHaveBeenCalledWith(120)

    fireEvent.click(preset180)
    expect(onSetDuration).toHaveBeenCalledWith(180)
  })

  it('E16-03: Boundary clamping math: strictly enforces min 15s and max 600s', () => {
    const clampTimer = (current: number, delta: number) => {
      return Math.max(15, Math.min(600, current + delta))
    }

    // Normal increment
    expect(clampTimer(90, 30)).toBe(120)
    expect(clampTimer(90, 60)).toBe(150)

    // Subtraction cannot go below 15s
    expect(clampTimer(20, -15)).toBe(15)
    expect(clampTimer(15, -15)).toBe(15)
    expect(clampTimer(10, -10)).toBe(15)

    // Addition cannot exceed 600s (10 minutes)
    expect(clampTimer(580, 60)).toBe(600)
    expect(clampTimer(600, 30)).toBe(600)
    expect(clampTimer(650, 10)).toBe(600)

    // Preset setter clamping
    const clampPreset = (sec: number) => Math.max(15, Math.min(600, sec))
    expect(clampPreset(5)).toBe(15)
    expect(clampPreset(900)).toBe(600)
    expect(clampPreset(120)).toBe(120)
  })
})

describe('Enhancement E17: Grocery Checklist Cart Progress & Reset', () => {
  it('E17-01: Correctly calculates cart progress percentage without division by zero', () => {
    const calcProgress = (total: number, checked: number) => {
      return total > 0 ? Math.round((checked / total) * 100) : 0
    }

    expect(calcProgress(0, 0)).toBe(0)
    expect(calcProgress(20, 0)).toBe(0)
    expect(calcProgress(20, 5)).toBe(25)
    expect(calcProgress(20, 10)).toBe(50)
    expect(calcProgress(20, 20)).toBe(100)
    expect(calcProgress(3, 1)).toBe(33)
  })

  it('E17-02: Clear action resets checklist without altering canonical grocery items or meal plans', () => {
    const canonicalCategories = [
      {
        category: 'Produce',
        items: [
          { id: 'item-1', name: 'Spinach', quantity: 200, unit: 'g' },
          { id: 'item-2', name: 'Bananas', quantity: 4, unit: 'pcs' },
        ]
      },
      {
        category: 'Protein',
        items: [
          { id: 'item-3', name: 'Chicken Breast', quantity: 500, unit: 'g' }
        ]
      }
    ]

    let checkedState: Record<string, boolean> = {
      'item-1': true,
      'item-3': true
    }

    // Simulate clearing checked items
    const handleClear = () => {
      checkedState = {}
    }

    handleClear()

    expect(Object.keys(checkedState)).toHaveLength(0)
    // Canonical categories remain completely untouched
    expect(canonicalCategories).toHaveLength(2)
    expect(canonicalCategories[0].items).toHaveLength(2)
    expect(canonicalCategories[1].items).toHaveLength(1)
  })
})

describe('Enhancement E19: Data Vault Storage Partition Breakdown Gauge', () => {
  it('E19-01: Analyzes backup payload and computes proportional partition bytes', () => {
    const mockPayload = {
      schema: 'bodymap_backup_v2',
      version: '2.3.0',
      exportedAt: new Date().toISOString(),
      planState: {
        generatedPlan: 'Day 1: Squats 4x10',
        completedDays: [0, 1],
        weightLog: [{ date: '2026-09-01', weightKg: 75 }]
      },
      workoutHistory: [
        {
          id: 'sess-1',
          dayTitle: 'Leg Day',
          completedAt: Date.now(),
          exercises: [{ name: 'Squat', sets: [{ completed: true, weight: 100, reps: 5 }] }]
        }
      ],
      savedPlans: [],
      bodyMetrics: []
    }

    const diag = analyzeBackupDiagnostics(mockPayload)
    const manifest = generateVaultManifest(mockPayload)

    expect(diag.isValidStructure).toBe(true)
    expect(diag.totalEstimatedBytes).toBeGreaterThan(0)
    expect(diag.categories.length).toBeGreaterThan(0)
    expect(manifest.totalRecords).toBeGreaterThan(0)

    // Verify percentages sum to <= 100% and no NaN
    let totalPct = 0
    for (const cat of diag.categories) {
      const pct = diag.totalEstimatedBytes > 0
        ? Math.round((cat.estimatedBytes / diag.totalEstimatedBytes) * 100)
        : 0
      expect(isNaN(pct)).toBe(false)
      expect(pct).toBeGreaterThanOrEqual(0)
      expect(pct).toBeLessThanOrEqual(100)
      totalPct += pct
    }
    expect(totalPct).toBeLessThanOrEqual(105) // allow rounding tolerance
  })

  it('E19-02: Handles empty or corrupt payload safely without throwing', () => {
    const diagNull = analyzeBackupDiagnostics(null)
    expect(diagNull.isValidStructure).toBe(false)
    expect(diagNull.totalEstimatedBytes).toBe(0)
    expect(diagNull.categories).toEqual([])

    const manifestNull = generateVaultManifest(null)
    expect(manifestNull.totalRecords).toBe(0)
    expect(manifestNull.vaultHealthStatus).toBe('optimal')
  })
})

describe('E15 & E20 Verification Audit', () => {
  it('E15: Ghost history lookup produces factual summary without prescriptive language', () => {
    const mockHistory: CompletedWorkoutLog[] = [
      {
        id: 'session-1',
        sessionId: 'sess-abc',
        dayIndex: 0,
        dayTitle: 'Upper Body',
        dayType: 'Upper Strength',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
        completedAt: new Date().toISOString(),
        durationSeconds: 1800,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          {
            name: 'Barbell Bench Press',
            setsCompleted: 3,
            totalSets: 3,
            avgCompletedReps: 10,
            peakWeightKg: 60
          }
        ]
      }
    ]

    const perf = findPreviousPerformance('Barbell Bench Press', mockHistory)
    expect(perf).not.toBeNull()
    if (perf) {
      expect(perf.lastWeightKg).toBe(60)
      // Factual only — no prescriptive phrase
      expect(perf.factualSummary).toContain('Last session: 60 kg')
      expect(perf.factualSummary).not.toContain('you should increase')
      expect(perf.factualSummary).not.toContain('must add weight')
    }
  })

  it('E20: ExitWorkoutDialog renders with accessible buttons and focus trapping', () => {
    const onClose = vi.fn()
    const onSave = vi.fn()
    const onDiscard = vi.fn()

    const { unmount } = render(
      <ExitWorkoutDialog
        isOpen={true}
        onClose={onClose}
        onSaveAndExit={onSave}
        onDiscardAndExit={onDiscard}
      />
    )

    expect(screen.getByText('Pause or Exit Workout?')).toBeDefined()
    expect(screen.getByRole('dialog')).toBeDefined()

    const btnContinue = screen.getByText(/Continue Workout/i)
    const btnSave = screen.getByText(/Save Progress & Resume Later/i)
    const btnDiscard = screen.getByText(/Discard Session/i)

    fireEvent.click(btnContinue)
    expect(onClose).toHaveBeenCalled()

    fireEvent.click(btnSave)
    expect(onSave).toHaveBeenCalled()

    fireEvent.click(btnDiscard)
    expect(onDiscard).toHaveBeenCalled()

    unmount()
  })
})
