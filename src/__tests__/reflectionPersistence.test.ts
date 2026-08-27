/**
 * V3.5 Targeted Tests: Session Reflection Persistence (F-01)
 *
 * Tests: save · update · persist · matching sessionId · missing session ·
 * invalid reflection · malformed reflection · empty reflection · backup round-trip
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveReflectionForSession,
  saveCompletedWorkoutLog,
  loadWorkoutHistory,
  clearWorkoutHistory,
  WORKOUT_HISTORY_STORAGE_KEY
} from '@/lib/sessionStorage'
import {
  generateBackupPayload,
  validateAndParseBackup,
  restoreBackupData
} from '@/lib/backupStorage'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLog(overrides: Partial<CompletedWorkoutLog> = {}): CompletedWorkoutLog {
  return {
    id: `log_test_${Math.random().toString(36).slice(2, 7)}`,
    sessionId: `session_test_${Math.random().toString(36).slice(2, 7)}`,
    dayIndex: 0,
    dayTitle: 'Push Day',
    dayType: 'Strength',
    completedAt: new Date().toISOString(),
    durationSeconds: 3600,
    totalSetsCompleted: 12,
    totalExercises: 4,
    exercisesSummary: [{ name: 'Bench Press', setsCompleted: 3, totalSets: 3 }],
    ...overrides
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearWorkoutHistory()
})

// ── Reflection Save Tests ──────────────────────────────────────────────────────

describe('saveReflectionForSession', () => {
  it('attaches energyRating to a matching session log', () => {
    const log = makeLog()
    saveCompletedWorkoutLog(log)

    const result = saveReflectionForSession(log.sessionId, { energyRating: 4 })
    expect(result).toBe(true)

    const history = loadWorkoutHistory()
    const found = history.find(l => l.sessionId === log.sessionId)
    expect(found?.sessionReflection?.energyRating).toBe(4)
  })

  it('attaches perceivedReadiness to a matching session log', () => {
    const log = makeLog()
    saveCompletedWorkoutLog(log)

    saveReflectionForSession(log.sessionId, { perceivedReadiness: 'high' })

    const history = loadWorkoutHistory()
    const found = history.find(l => l.sessionId === log.sessionId)
    expect(found?.sessionReflection?.perceivedReadiness).toBe('high')
  })

  it('attaches reflectionTags to a matching session log', () => {
    const log = makeLog()
    saveCompletedWorkoutLog(log)

    saveReflectionForSession(log.sessionId, { reflectionTags: ['High Energy', 'Solid Pump'] })

    const history = loadWorkoutHistory()
    const found = history.find(l => l.sessionId === log.sessionId)
    expect(found?.sessionReflection?.reflectionTags).toEqual(['High Energy', 'Solid Pump'])
  })

  it('attaches a full reflection with all fields', () => {
    const log = makeLog()
    saveCompletedWorkoutLog(log)

    saveReflectionForSession(log.sessionId, {
      energyRating: 5,
      perceivedReadiness: 'moderate',
      reflectionTags: ['Form Focus', 'Heavy Session']
    })

    const history = loadWorkoutHistory()
    const found = history.find(l => l.sessionId === log.sessionId)
    expect(found?.sessionReflection).toEqual({
      energyRating: 5,
      perceivedReadiness: 'moderate',
      reflectionTags: ['Form Focus', 'Heavy Session']
    })
  })

  it('does NOT mutate objective workout fields when attaching reflection', () => {
    const log = makeLog()
    saveCompletedWorkoutLog(log)

    saveReflectionForSession(log.sessionId, { energyRating: 3 })

    const history = loadWorkoutHistory()
    const found = history.find(l => l.sessionId === log.sessionId)!
    expect(found.id).toBe(log.id)
    expect(found.dayTitle).toBe(log.dayTitle)
    expect(found.dayType).toBe(log.dayType)
    expect(found.completedAt).toBe(log.completedAt)
    expect(found.durationSeconds).toBe(log.durationSeconds)
    expect(found.totalSetsCompleted).toBe(log.totalSetsCompleted)
    expect(found.totalExercises).toBe(log.totalExercises)
    expect(found.exercisesSummary).toEqual(log.exercisesSummary)
  })

  it('overwrites an existing reflection without touching other fields', () => {
    const log = makeLog({ sessionReflection: { energyRating: 2 } })
    saveCompletedWorkoutLog(log)

    saveReflectionForSession(log.sessionId, { energyRating: 5, perceivedReadiness: 'high' })

    const history = loadWorkoutHistory()
    const found = history.find(l => l.sessionId === log.sessionId)
    expect(found?.sessionReflection?.energyRating).toBe(5)
    expect(found?.sessionReflection?.perceivedReadiness).toBe('high')
    expect(found?.durationSeconds).toBe(log.durationSeconds)
  })

  it('returns false and makes no change when session is not found', () => {
    const log = makeLog()
    saveCompletedWorkoutLog(log)

    const result = saveReflectionForSession('nonexistent_session_id', { energyRating: 3 })
    expect(result).toBe(false)

    const history = loadWorkoutHistory()
    const found = history.find(l => l.sessionId === log.sessionId)
    expect(found?.sessionReflection).toBeUndefined()
  })

  it('returns false for an empty string sessionId', () => {
    expect(saveReflectionForSession('', { energyRating: 3 })).toBe(false)
  })

  it('returns false for a null/undefined reflection object', () => {
    const log = makeLog()
    saveCompletedWorkoutLog(log)

    expect(saveReflectionForSession(log.sessionId, null as CompletedWorkoutLog['sessionReflection'])).toBe(false)
    expect(saveReflectionForSession(log.sessionId, undefined)).toBe(false)
  })

  it('returns false for a non-object reflection', () => {
    const log = makeLog()
    saveCompletedWorkoutLog(log)
    // Pass an invalid type via cast — testing runtime validation in saveReflectionForSession
    expect(saveReflectionForSession(log.sessionId, (42 as unknown) as CompletedWorkoutLog['sessionReflection'])).toBe(false)
  })

  it('correctly stores an empty-fields reflection (all fields optional)', () => {
    const log = makeLog()
    saveCompletedWorkoutLog(log)

    // Empty object is still a valid reflection shape
    const result = saveReflectionForSession(log.sessionId, {})
    expect(result).toBe(true)

    const history = loadWorkoutHistory()
    const found = history.find(l => l.sessionId === log.sessionId)
    expect(found?.sessionReflection).toEqual({})
  })

  it('historical records without sessionReflection remain valid after another session saves reflection', () => {
    const oldLog = makeLog({ sessionId: 'old_session', sessionReflection: undefined })
    const newLog = makeLog({ sessionId: 'new_session' })
    saveCompletedWorkoutLog(oldLog)
    saveCompletedWorkoutLog(newLog)

    saveReflectionForSession('new_session', { energyRating: 4 })

    const history = loadWorkoutHistory()
    const old = history.find(l => l.sessionId === 'old_session')!
    expect(old.sessionReflection).toBeUndefined()
    expect(old.id).toBe(oldLog.id)
    expect(old.dayTitle).toBe(oldLog.dayTitle)
  })

  it('handles storage exceptions gracefully and returns false', () => {
    const log = makeLog()
    saveCompletedWorkoutLog(log)

    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const result = saveReflectionForSession(log.sessionId, { energyRating: 3 })
    expect(result).toBe(false)

    spy.mockRestore()
  })
})

// ── Backup Round-Trip Tests ────────────────────────────────────────────────────

describe('reflection backup round-trip', () => {
  it('sessionReflection survives a backup export and import cycle', async () => {
    const { generateBackupPayload, validateAndParseBackup, restoreBackupData } =
      await import('@/lib/backupStorage')

    const log = makeLog()
    saveCompletedWorkoutLog(log)
    saveReflectionForSession(log.sessionId, {
      energyRating: 5,
      perceivedReadiness: 'high',
      reflectionTags: ['Form Focus']
    })

    const payload = generateBackupPayload()
    const jsonStr = JSON.stringify(payload)
    clearWorkoutHistory()

    const parsed = validateAndParseBackup(jsonStr)
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const restoreResult = restoreBackupData(parsed.data)
    expect(restoreResult.success).toBe(true)

    const history = loadWorkoutHistory()
    const found = history.find(l => l.sessionId === log.sessionId)
    expect(found?.sessionReflection?.energyRating).toBe(5)
    expect(found?.sessionReflection?.perceivedReadiness).toBe('high')
    expect(found?.sessionReflection?.reflectionTags).toEqual(['Form Focus'])
  })
})
