import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveWorkoutCheckpoint,
  loadWorkoutCheckpoint,
  clearWorkoutCheckpoint,
  type WorkoutCheckpointPayload
} from '@/lib/workoutCheckpointEngine'

describe('workoutCheckpointEngine', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('correctly saves and loads valid workout checkpoints', () => {
    const payload: WorkoutCheckpointPayload = {
      sessionId: 'sess_123',
      dayIndex: 1,
      dayTitle: 'Upper Body Strength',
      startedAt: '2026-08-28T07:00:00Z',
      lastActiveTimestamp: Date.now(),
      elapsedSeconds: 1200,
      completedExerciseIds: ['ex_1', 'ex_2'],
      loggedSetsCount: 6
    }

    const saved = saveWorkoutCheckpoint(payload)
    expect(saved).toBe(true)

    const loaded = loadWorkoutCheckpoint()
    expect(loaded).toEqual(payload)
  })

  it('returns null when checkpoint does not exist or is invalid', () => {
    expect(loadWorkoutCheckpoint()).toBeNull()

    sessionStorage.setItem('bodymap_active_workout_checkpoint', 'invalid-json')
    expect(loadWorkoutCheckpoint()).toBeNull()
  })

  it('correctly clears active checkpoints', () => {
    const payload: WorkoutCheckpointPayload = {
      sessionId: 'sess_123',
      dayIndex: 1,
      dayTitle: 'Upper Body Strength',
      startedAt: '2026-08-28T07:00:00Z',
      lastActiveTimestamp: Date.now(),
      elapsedSeconds: 1200,
      completedExerciseIds: ['ex_1'],
      loggedSetsCount: 3
    }

    saveWorkoutCheckpoint(payload)
    expect(loadWorkoutCheckpoint()).not.toBeNull()

    clearWorkoutCheckpoint()
    expect(loadWorkoutCheckpoint()).toBeNull()
  })
})
