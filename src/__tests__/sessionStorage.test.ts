import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
  hasActiveSession,
  ACTIVE_SESSION_STORAGE_KEY,
  saveCompletedWorkoutLog,
  loadWorkoutHistory,
  clearWorkoutHistory
} from '@/lib/sessionStorage'
import type { WorkoutSession } from '@/types/workoutSession'

describe('Workout Session Storage & Recovery Layer', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const mockSession: WorkoutSession = {
    sessionId: 'sess_test_123',
    dayIndex: 0,
    dayTitle: 'Day 1 - Upper Body',
    dayType: 'Strength',
    durationMinutes: 45,
    startedAt: 1700000000000,
    lastUpdatedAt: 1700000005000,
    elapsedSeconds: 120,
    currentExerciseIndex: 1,
    exercises: [
      {
        id: 'ex_1',
        name: 'Push-ups',
        originalName: 'Push-ups',
        targetSets: 3,
        targetReps: '12 reps',
        restSeconds: 60,
        focus: 'Chest',
        equipment: 'Bodyweight',
        formCue: 'Keep back flat.',
        sets: [
          { setIndex: 1, targetReps: '12 reps', completedReps: 12, weightKg: null, isCompleted: true, completedAt: '2026-08-26T10:00:00Z' },
          { setIndex: 2, targetReps: '12 reps', completedReps: 12, weightKg: null, isCompleted: false, completedAt: null },
          { setIndex: 3, targetReps: '12 reps', completedReps: 12, weightKg: null, isCompleted: false, completedAt: null }
        ],
        isSubstituted: false,
        substitutionReason: null
      }
    ],
    restTimer: {
      isActive: false,
      targetEndTime: null,
      durationSeconds: 60,
      isPaused: false,
      remainingSeconds: 60
    },
    status: 'in-progress',
    soundEnabled: true,
    vibrateEnabled: true
  }

  it('saves and loads active workout session correctly', () => {
    saveActiveSession(mockSession)
    expect(hasActiveSession()).toBe(true)

    const loaded = loadActiveSession()
    expect(loaded).not.toBeNull()
    expect(loaded?.sessionId).toBe('sess_test_123')
    expect(loaded?.dayTitle).toBe('Day 1 - Upper Body')
    expect(loaded?.exercises.length).toBe(1)
    expect(loaded?.exercises[0].sets[0].isCompleted).toBe(true)
  })

  it('clears active session cleanly', () => {
    saveActiveSession(mockSession)
    clearActiveSession()
    expect(hasActiveSession()).toBe(false)
    expect(loadActiveSession()).toBeNull()
  })

  it('safely recovers from corrupted localStorage data without throwing unhandled exceptions', () => {
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, '{"invalid_json": true,')
    expect(loadActiveSession()).toBeNull()

    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, '{"sessionId": "bad", "exercises": []}')
    expect(loadActiveSession()).toBeNull()
  })

  it('saves and loads completed workout history correctly', () => {
    expect(loadWorkoutHistory()).toEqual([])

    saveCompletedWorkoutLog({
      id: 'log_1',
      sessionId: 'sess_1',
      dayIndex: 0,
      dayTitle: 'Day 1 - Push Focus',
      dayType: 'Hypertrophy',
      completedAt: '2026-08-26T10:00:00Z',
      durationSeconds: 2400,
      totalSetsCompleted: 12,
      totalExercises: 4,
      exercisesSummary: [{ name: 'Push-ups', setsCompleted: 3, totalSets: 3 }]
    })

    const history = loadWorkoutHistory()
    expect(history.length).toBe(1)
    expect(history[0].id).toBe('log_1')
    expect(history[0].dayTitle).toBe('Day 1 - Push Focus')
    expect(history[0].totalSetsCompleted).toBe(12)

    clearWorkoutHistory()
    expect(loadWorkoutHistory()).toEqual([])
  })
})
