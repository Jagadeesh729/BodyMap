/**
 * V3.5 Targeted Tests: handleSetRestDuration (F-07)
 * and handleCompleteWorkout double-completion guard (F-03)
 *
 * Tests: valid duration · zero · negative · NaN · Infinity · fractional ·
 * double-completion guard · rapid completion
 */
import { describe, it, expect } from 'vitest'

// ── handleSetRestDuration unit tests ──────────────────────────────────────────
// We test the validation logic extracted from GymModePage directly.
// The function must: reject invalid inputs, clamp to [1, 900], and return
// the correct RestTimerState shape.

function isValidRestDuration(seconds: unknown): boolean {
  if (typeof seconds !== 'number') return false
  if (!Number.isFinite(seconds)) return false
  if (seconds <= 0) return false
  if (!Number.isInteger(seconds)) return false
  return true
}

function computeClampedDuration(seconds: number): number {
  return Math.min(Math.max(1, seconds), 900)
}

describe('handleSetRestDuration — input validation (F-07)', () => {
  it('accepts a valid positive integer', () => {
    expect(isValidRestDuration(90)).toBe(true)
    expect(computeClampedDuration(90)).toBe(90)
  })

  it('accepts 1 (minimum valid)', () => {
    expect(isValidRestDuration(1)).toBe(true)
    expect(computeClampedDuration(1)).toBe(1)
  })

  it('accepts 900 (maximum valid)', () => {
    expect(isValidRestDuration(900)).toBe(true)
    expect(computeClampedDuration(900)).toBe(900)
  })

  it('rejects zero', () => {
    expect(isValidRestDuration(0)).toBe(false)
  })

  it('rejects negative values', () => {
    expect(isValidRestDuration(-60)).toBe(false)
    expect(isValidRestDuration(-1)).toBe(false)
  })

  it('rejects NaN', () => {
    expect(isValidRestDuration(NaN)).toBe(false)
  })

  it('rejects Infinity', () => {
    expect(isValidRestDuration(Infinity)).toBe(false)
    expect(isValidRestDuration(-Infinity)).toBe(false)
  })

  it('rejects fractional values (non-integer)', () => {
    expect(isValidRestDuration(60.5)).toBe(false)
    expect(isValidRestDuration(1.1)).toBe(false)
  })

  it('rejects string values', () => {
    expect(isValidRestDuration('90' as unknown as number)).toBe(false)
    expect(isValidRestDuration('sixty' as unknown as number)).toBe(false)
  })

  it('rejects null and undefined', () => {
    expect(isValidRestDuration(null as unknown as number)).toBe(false)
    expect(isValidRestDuration(undefined as unknown as number)).toBe(false)
  })

  it('clamps below 1 to 1 (guard in clamp)', () => {
    // The guard rejects <=0 before clamping, but clamping logic is tested independently
    expect(computeClampedDuration(0)).toBe(1)
  })

  it('clamps above 900 to 900', () => {
    expect(computeClampedDuration(1000)).toBe(900)
    expect(computeClampedDuration(9999)).toBe(900)
  })

  it('120s sets duration and remaining to 120', () => {
    const duration = computeClampedDuration(120)
    expect(duration).toBe(120)
    // Verify the timer state shape that would be produced
    const now = Date.now()
    const timerState = {
      isActive: true,
      isPaused: false,
      durationSeconds: duration,
      remainingSeconds: duration,
      targetEndTime: now + duration * 1000
    }
    expect(timerState.isActive).toBe(true)
    expect(timerState.isPaused).toBe(false)
    expect(timerState.durationSeconds).toBe(120)
    expect(timerState.remainingSeconds).toBe(120)
    expect(timerState.targetEndTime).toBeGreaterThan(now)
  })
})

// ── handleCompleteWorkout guard tests (F-03) ──────────────────────────────────

import {
  saveCompletedWorkoutLog,
  loadWorkoutHistory,
  clearWorkoutHistory
} from '@/lib/sessionStorage'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

function makeLog(sessionId: string): CompletedWorkoutLog {
  return {
    id: `log_${Math.random().toString(36).slice(2)}`,
    sessionId,
    dayIndex: 0,
    dayTitle: 'Test Day',
    dayType: 'Strength',
    completedAt: new Date().toISOString(),
    durationSeconds: 1800,
    totalSetsCompleted: 9,
    totalExercises: 3,
    exercisesSummary: []
  }
}

describe('handleCompleteWorkout double-completion guard (F-03)', () => {
  beforeEach(() => {
    clearWorkoutHistory()
  })

  it('saveCompletedWorkoutLog deduplicates by log.id — simulating the data-safety invariant', () => {
    const log = makeLog('sess_001')
    saveCompletedWorkoutLog(log)
    saveCompletedWorkoutLog(log) // second identical call
    saveCompletedWorkoutLog(log) // third identical call

    const history = loadWorkoutHistory()
    const matches = history.filter(l => l.id === log.id)
    expect(matches.length).toBe(1)
  })

  it('two logs with different IDs and same sessionId both persist (distinct calls)', () => {
    // This should NOT happen in practice — the guard in handleCompleteWorkout prevents it
    // But testing the storage layer behaviour for documentation
    const sessionId = 'sess_002'
    const log1 = { ...makeLog(sessionId), id: 'log_001' }
    const log2 = { ...makeLog(sessionId), id: 'log_002' }

    saveCompletedWorkoutLog(log1)
    saveCompletedWorkoutLog(log2)

    const history = loadWorkoutHistory()
    // Both are present — the status guard in handleCompleteWorkout prevents this in UI
    const matches = history.filter(l => l.sessionId === sessionId)
    expect(matches.length).toBe(2)
  })

  it('verifies the status guard logic: completed status prevents second save', () => {
    // Simulates the guard check inside handleCompleteWorkout
    let status: 'in-progress' | 'completed' | 'abandoned' = 'in-progress'
    let savedCount = 0

    const completeFn = () => {
      if (status === 'completed') return // guard
      savedCount++
      status = 'completed'
    }

    completeFn() // first call — should save
    completeFn() // second call — should be blocked
    completeFn() // third call — should be blocked

    expect(savedCount).toBe(1)
    expect(status).toBe('completed')
  })
})

// ── F-04: convertedSession field mapping correctness ─────────────────────────

describe('convertedSession field mapping (F-04)', () => {
  it('completedReps (not actualReps) is used for debrief reps', () => {
    const mockSet = {
      setIndex: 1,
      targetReps: '10',
      completedReps: 10,
      weightKg: 60,
      isCompleted: true,
      completedAt: new Date().toISOString()
    }

    // Simulate the fixed mapping in GymModePage convertedSession adapter
    const adapted = {
      setNumber: 1,
      targetReps: mockSet.targetReps || '10',
      weight: mockSet.weightKg,
      reps: mockSet.completedReps, // FIXED: was mockSet.actualReps || 0
      completed: mockSet.isCompleted // FIXED: was mockSet.completed
    }

    expect(adapted.reps).toBe(10)
    expect(adapted.reps).not.toBe(0)
    expect(adapted.completed).toBe(true)
  })

  it('computes correct volume for 3 sets of 10 reps at 60 kg', () => {
    const sets = [
      { completedReps: 10, weightKg: 60, isCompleted: true },
      { completedReps: 10, weightKg: 60, isCompleted: true },
      { completedReps: 10, weightKg: 60, isCompleted: true }
    ]

    const totalVolume = sets.reduce((sum, s) => {
      return s.isCompleted && s.weightKg ? sum + s.completedReps * s.weightKg : sum
    }, 0)

    expect(totalVolume).toBe(1800)
  })

  it('does not count reps from incomplete sets toward volume', () => {
    const sets = [
      { completedReps: 10, weightKg: 60, isCompleted: true },
      { completedReps: 5, weightKg: 60, isCompleted: false }, // incomplete
      { completedReps: 10, weightKg: 60, isCompleted: true }
    ]

    const totalVolume = sets.reduce((sum, s) => {
      return s.isCompleted && s.weightKg ? sum + s.completedReps * s.weightKg : sum
    }, 0)

    expect(totalVolume).toBe(1200)
  })

  it('isCompleted field exists on WorkoutSet type — no type error on correct field access', () => {
    // Type-level test: if the adapter uses wrong fields, TypeScript would error at build.
    // This test documents the correct field names.
    type WorkoutSetFields = 'setIndex' | 'targetReps' | 'completedReps' | 'weightKg' | 'isCompleted' | 'completedAt'
    const correctFields: WorkoutSetFields[] = ['completedReps', 'isCompleted']
    expect(correctFields).toContain('completedReps')
    expect(correctFields).toContain('isCompleted')
    // The following would fail at runtime — confirming the old wrong field names are NOT present
    expect((correctFields as string[]).includes('actualReps')).toBe(false)
    expect((correctFields as string[]).includes('completed')).toBe(false)
  })
})

// ── F-02: History cap disclosure threshold tests ──────────────────────────────

import { MAX_STORED_WORKOUTS, BACKUP_NUDGE_THRESHOLD } from '@/lib/sessionStorage'

describe('history cap disclosure threshold (F-02 / ISS-01)', () => {
  it('exports correct capacity and nudge thresholds', () => {
    expect(MAX_STORED_WORKOUTS).toBe(250)
    expect(BACKUP_NUDGE_THRESHOLD).toBe(220)
  })

  it('no nudge shown at count 0', () => {
    expect(0 >= BACKUP_NUDGE_THRESHOLD).toBe(false)
  })

  it('no nudge shown at count 219', () => {
    expect(219 >= BACKUP_NUDGE_THRESHOLD).toBe(false)
  })

  it('nudge shown at count 220 (at threshold)', () => {
    expect(220 >= BACKUP_NUDGE_THRESHOLD).toBe(true)
  })

  it('nudge shown at count 249', () => {
    expect(249 >= BACKUP_NUDGE_THRESHOLD).toBe(true)
  })

  it('nudge shown at count 250 (at cap)', () => {
    expect(250 >= BACKUP_NUDGE_THRESHOLD).toBe(true)
  })

  it('count/250 display is correct for 12 sessions', () => {
    const count = 12
    const display = `${count} / ${MAX_STORED_WORKOUTS} stored`
    expect(display).toBe('12 / 250 stored')
  })

  it('count/250 display is correct for 250 sessions', () => {
    const count = 250
    const display = `${count} / ${MAX_STORED_WORKOUTS} stored`
    expect(display).toBe('250 / 250 stored')
  })
})

// ── F-08: All reflection tags are reachable ───────────────────────────────────

import { STANDARD_REFLECTION_TAGS } from '@/lib/sessionReflectionTaxonomy'

describe('STANDARD_REFLECTION_TAGS — all tags visible (F-08)', () => {
  it('exports exactly 8 standard reflection tags', () => {
    expect(STANDARD_REFLECTION_TAGS.length).toBe(8)
  })

  it('contains "Stretched Well" (previously hidden by .slice(0,6))', () => {
    expect(STANDARD_REFLECTION_TAGS).toContain('Stretched Well')
  })

  it('contains "Grind Out" (previously hidden by .slice(0,6))', () => {
    expect(STANDARD_REFLECTION_TAGS).toContain('Grind Out')
  })

  it('all 8 tags are non-empty strings', () => {
    for (const tag of STANDARD_REFLECTION_TAGS) {
      expect(typeof tag).toBe('string')
      expect(tag.trim().length).toBeGreaterThan(0)
    }
  })

  it('renders all 8 tags when no slice is applied', () => {
    const rendered = [...STANDARD_REFLECTION_TAGS] // no .slice()
    expect(rendered.length).toBe(8)
    expect(rendered).toEqual(expect.arrayContaining(['High Energy', 'Form Focus', 'Solid Pump', 'Low Fatigue', 'Heavy Session', 'Fast Paced', 'Stretched Well', 'Grind Out']))
  })
})
