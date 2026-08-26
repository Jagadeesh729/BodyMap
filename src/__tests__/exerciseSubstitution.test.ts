import { describe, it, expect } from 'vitest'
import {
  getExerciseAlternatives,
  parseExerciseStringToSessionExercise
} from '@/lib/exerciseSubstitution'

describe('Exercise Substitution & Biomechanical Mapping System', () => {
  it('returns valid biomechanical alternatives for horizontal push movements', () => {
    const alts = getExerciseAlternatives('Dumbbell Bench Press')
    expect(alts.length).toBeGreaterThan(0)
    expect(alts.some(a => a.name.includes('Push-ups') || a.name.includes('Floor Press'))).toBe(true)
    expect(alts[0].reason).toBeDefined()
    expect(alts[0].formCue).toBeDefined()
    expect(alts[0].equipment).toBeDefined()
  })

  it('returns valid biomechanical alternatives for squat and quad dominant movements', () => {
    const alts = getExerciseAlternatives('Barbell Back Squats')
    expect(alts.length).toBeGreaterThan(0)
    expect(alts.some(a => a.name.includes('Goblet') || a.name.includes('Split Squat'))).toBe(true)
  })

  it('returns valid biomechanical alternatives for vertical and horizontal pull movements', () => {
    const alts = getExerciseAlternatives('Lat Pulldown')
    expect(alts.length).toBeGreaterThan(0)
    expect(alts.some(a => a.name.includes('Row') || a.name.includes('Cobra'))).toBe(true)
  })

  it('provides safe generic alternatives for unclassified exercises without crashing', () => {
    const alts = getExerciseAlternatives('Unusual Custom Exercise XYZ')
    expect(alts.length).toBeGreaterThan(0)
    expect(alts[0].name).toBeDefined()
  })

  it('parses structured workout strings into SessionExercise objects with sets and rest', () => {
    const parsed = parseExerciseStringToSessionExercise('Dumbbell Goblet Squats: 4 sets x 10 reps (90s rest)', 0)
    expect(parsed.name).toBe('Dumbbell Goblet Squats')
    expect(parsed.targetSets).toBe(4)
    expect(parsed.sets.length).toBe(4)
    expect(parsed.targetReps).toBe('10 reps')
    expect(parsed.restSeconds).toBe(90)
    expect(parsed.focus).toContain('Quads')
    expect(parsed.formCue).toBeDefined()
  })

  it('parses unstructured bullet lines with safe defaults', () => {
    const parsed = parseExerciseStringToSessionExercise('Walking Lunges', 1)
    expect(parsed.name).toBe('Walking Lunges')
    expect(parsed.targetSets).toBe(3)
    expect(parsed.sets.length).toBe(3)
    expect(parsed.restSeconds).toBe(60)
  })
})
