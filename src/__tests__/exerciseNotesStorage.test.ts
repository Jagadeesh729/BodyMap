import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadExerciseNotes,
  getExerciseNote,
  saveExerciseNote,
  deleteExerciseNote
} from '@/lib/exerciseNotesStorage'

describe('Exercise Personal Notes Storage Suite', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and retrieves personal notes by normalized exercise identity', () => {
    saveExerciseNote('Barbell Bench Press', 'Pin position 4, pause at bottom')
    
    // Exact match
    expect(getExerciseNote('Barbell Bench Press')).toBe('Pin position 4, pause at bottom')
    
    // Case and spacing variation match
    expect(getExerciseNote('barbell   bench press')).toBe('Pin position 4, pause at bottom')
  })

  it('updates existing note and prevents duplicate keys', () => {
    saveExerciseNote('Squat', 'Flat shoes')
    saveExerciseNote('Squat', 'Elevated heel shoes')

    expect(getExerciseNote('Squat')).toBe('Elevated heel shoes')
    const all = loadExerciseNotes()
    expect(Object.keys(all).length).toBe(1)
  })

  it('deletes notes cleanly', () => {
    saveExerciseNote('Overhead Press', 'Brace core tightly')
    expect(getExerciseNote('Overhead Press')).toBe('Brace core tightly')

    deleteExerciseNote('Overhead Press')
    expect(getExerciseNote('Overhead Press')).toBeNull()
  })

  it('handles empty input and corrupted storage safely', () => {
    expect(getExerciseNote('')).toBeNull()
    saveExerciseNote('', 'Invalid')
    expect(loadExerciseNotes()).toEqual({})

    localStorage.setItem('bodymap_exercise_notes', '{invalid json}')
    expect(loadExerciseNotes()).toEqual({})
  })
})
