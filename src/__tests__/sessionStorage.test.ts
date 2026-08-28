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

  it('preserves up to MAX_STORED_WORKOUTS (250) and evicts oldest record on 251st save (ISS-01)', () => {
    // 1. Save 250 sequential sessions
    for (let i = 1; i <= 250; i++) {
      saveCompletedWorkoutLog({
        id: `log_${i}`,
        sessionId: `sess_${i}`,
        dayIndex: (i % 7),
        dayTitle: `Day ${i} - Training`,
        dayType: 'Hypertrophy',
        completedAt: new Date(1700000000000 + i * 86400000).toISOString(),
        durationSeconds: 2400,
        totalSetsCompleted: 15,
        totalExercises: 5,
        exercisesSummary: [{ name: 'Bench Press', setsCompleted: 3, totalSets: 3 }]
      })
    }

    let history = loadWorkoutHistory()
    expect(history.length).toBe(250)
    expect(history[0].id).toBe('log_250') // Newest at index 0
    expect(history[249].id).toBe('log_1') // Oldest at index 249

    // 2. Save 251st session -> triggers FIFO eviction of log_1
    saveCompletedWorkoutLog({
      id: 'log_251',
      sessionId: 'sess_251',
      dayIndex: 1,
      dayTitle: 'Day 251 - Training',
      dayType: 'Strength',
      completedAt: new Date(1700000000000 + 251 * 86400000).toISOString(),
      durationSeconds: 2700,
      totalSetsCompleted: 18,
      totalExercises: 6,
      exercisesSummary: [{ name: 'Squats', setsCompleted: 4, totalSets: 4 }]
    })

    history = loadWorkoutHistory()
    expect(history.length).toBe(250)
    expect(history[0].id).toBe('log_251') // Newest is 251
    expect(history[249].id).toBe('log_2') // Oldest is now log_2 (log_1 evicted)
    expect(history.find(item => item.id === 'log_1')).toBeUndefined()

    // 3. Updating existing session ID deduplicates without growing count
    saveCompletedWorkoutLog({
      id: 'log_251',
      sessionId: 'sess_251',
      dayIndex: 1,
      dayTitle: 'Day 251 - Updated Training',
      dayType: 'Strength',
      completedAt: new Date(1700000000000 + 251 * 86400000).toISOString(),
      durationSeconds: 3000,
      totalSetsCompleted: 20,
      totalExercises: 6,
      exercisesSummary: [{ name: 'Squats', setsCompleted: 5, totalSets: 5 }]
    })

    history = loadWorkoutHistory()
    expect(history.length).toBe(250)
    expect(history[0].dayTitle).toBe('Day 251 - Updated Training')
  })
})
