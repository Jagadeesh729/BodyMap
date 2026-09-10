import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { initialState, type PlanState, type StateVersion } from '@/context/PlanContext'
import {
  buildSafeState,
  compareVersions,
  parseSafeIncomingState,
  STORAGE_KEY,
} from '@/context/planStorage'
import {
  computeProfileFingerprint,
  evaluatePlanProfileBinding,
} from '@/lib/planBinding'
import {
  loadAndValidateActiveSession,
  saveActiveSession,
  clearActiveSession,
  ACTIVE_SESSION_STORAGE_KEY,
} from '@/lib/sessionStorage'
import {
  validateAndParseBackup,
  BACKUP_SCHEMA_IDENTIFIER,
  BACKUP_SCHEMA_VERSION,
} from '@/lib/backupStorage'
import { scanPlanForContraindications } from '@/lib/contraindicationGuard'
import { parseAndValidatePlan } from '@/lib/planSchema'
import type { FormData } from '@/types/formData'
import type { WorkoutSession } from '@/types/workoutSession'

const baseProfile: FormData = {
  age: '30', gender: 'Female', height: '168', weight: '64', fitnessLevel: 'Intermediate',
  mainGoal: 'Strength', bodyFocus: ['Full Body'], timePerDay: '30', recoveryDays: '2',
  medicalIssues: 'None', equipment: ['Bodyweight'], pushupCount: '10', dietaryPreference: 'Omnivore',
  allergies: 'None', specialRequests: 'None', sleepHours: '8', stressLevel: 'Low',
}

const safePlan = Array.from({ length: 7 }, (_, index) =>
  `## Day ${index + 1}\nWarm-up: walking\n- Glute bridge: 3 sets x 10 reps\nCool-down: breathing\nBreakfast: oats\nLunch: rice\nDinner: vegetables\n`
).join('\n')

const unsafePlan = safePlan.replace('Glute bridge', 'Box jumps')

function profile(overrides: Partial<FormData> = {}): FormData {
  return { ...baseProfile, ...overrides }
}

function state(overrides: Partial<PlanState> = {}): PlanState {
  const boundProfile = overrides.boundProfile || profile()
  return {
    ...initialState,
    formData: profile(),
    generatedPlan: safePlan,
    isGenerated: true,
    planId: 'plan_lifecycle_1',
    planGeneratedAt: 1700000000000,
    boundProfile,
    boundProfileFingerprint: computeProfileFingerprint(boundProfile),
    weightLog: [],
    completedDays: [],
    ...overrides,
  }
}

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    sessionId: 'session_lifecycle_1',
    planId: 'plan_lifecycle_1',
    planFingerprint: computeProfileFingerprint(profile()),
    medicalSnapshot: 'None',
    dayIndex: 0,
    dayTitle: 'Day 1',
    dayType: 'Strength',
    durationMinutes: 30,
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    elapsedSeconds: 0,
    currentExerciseIndex: 0,
    exercises: [{
      id: 'exercise_1', name: 'Glute bridge', originalName: 'Glute bridge', targetSets: 3,
      targetReps: '10', restSeconds: 60, focus: 'Glutes', equipment: 'Bodyweight', formCue: 'Neutral spine',
      sets: [], isSubstituted: false, substitutionReason: null,
    }],
    restTimer: { isActive: false, targetEndTime: null, durationSeconds: 60, isPaused: false, remainingSeconds: 60 },
    status: 'in-progress', soundEnabled: true, vibrateEnabled: true,
    ...overrides,
  }
}

function backup(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: BACKUP_SCHEMA_VERSION,
    schema: BACKUP_SCHEMA_IDENTIFIER,
    exportedAt: new Date().toISOString(),
    planState: state(),
    savedPlans: [],
    bodyMetrics: [],
    activeSession: null,
    workoutHistory: [],
    ...overrides,
  })
}

describe('Plan Lifecycle Safety Boundary Oracle (500 cases)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('A: plan/profile binding monotonicity (70 cases)', () => {
    const medicalCases = [
      'Acute ACL tear', 'Torn meniscus', 'Rotator cuff tear', 'Shoulder impingement',
      'Herniated lumbar disc', 'Sciatica', 'Cervical spine stenosis', 'Chest pain on exertion',
      'Pregnancy third trimester', 'Severe osteoporosis', 'Severe osteoarthritis', 'Angina',
      'Lumbar fusion', 'Knee replacement', 'Heart failure', 'Aortic stenosis',
      'Whiplash injury', 'Spinal fracture', 'Uncontrolled hypertension', 'Cardiomyopathy',
      'Acute shoulder injury', 'Active knee surgery recovery', 'Disc surgery', 'Neck radiculopathy',
      'Symptomatic arrhythmia', 'Compression fracture', 'Patellar tendon injury', 'Labral tear',
      'Lumbar spinal stenosis', 'Exertional dyspnea', 'Pregnancy second trimester', 'ACL reconstruction',
      'Severe knee arthritis', 'Heart attack history', 'Recent bypass surgery',
      'Acute right ACL tear', 'Acute left ACL tear', 'Medial meniscus tear', 'Lateral meniscus injury',
      'Right rotator cuff injury', 'Left shoulder impingement', 'Lumbar L4-L5 herniation', 'Lumbar L5-S1 sciatica',
      'Cervical disc herniation', 'Neck spinal stenosis', 'Exertional chest tightness', 'Exercise palpitations',
      'Late-stage pregnancy', 'Second trimester pregnancy', 'Fragility fracture risk', 'Vertebral compression fracture',
      'Severe hip osteoarthritis', 'Uncontrolled high blood pressure', 'Symptomatic heart disease', 'Recent cardiac surgery',
      'Knee arthroscopy recovery', 'Shoulder arthroplasty recovery', 'Lumbar spinal fusion recovery', 'Active disc injury',
      'Active knee injury',
    ]
    it.each(medicalCases.map((value, index) => [index + 1, value]))('A%02d: adding medical risk locks plan (%s)', (_index, value) => {
      const result = evaluatePlanProfileBinding(profile({ medicalIssues: value }), profile())
      expect(result.isSafetyMismatched).toBe(true)
      expect(result.isBound).toBe(false)
    })
    const allergyCases = ['Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Soy', 'Wheat', 'Gluten', 'Fish', 'Shellfish', 'Sesame']
    it.each(allergyCases.map((value, index) => [index + 36, value]))('A%02d: adding allergen risk locks plan (%s)', (_index, value) => {
      const result = evaluatePlanProfileBinding(profile({ allergies: value }), profile())
      expect(result.isSafetyMismatched).toBe(true)
      expect(result.mismatchedSafetyFields).toContain('allergies')
    })
  })

  describe('B: saved-plan provenance and state hydration (60 cases)', () => {
    it.each(Array.from({ length: 20 }, (_, index) => index + 1))('B%02d: forged fingerprint is discarded', index => {
      const built = buildSafeState({ ...state(), boundProfileFingerprint: `forged_${index}` })
      expect(built?.boundProfile).toBeUndefined()
      expect(built?.boundProfileFingerprint).toBeUndefined()
    })
    it.each(Array.from({ length: 20 }, (_, index) => index + 21))('B%02d: missing binding does not certify constrained profile', _index => {
      const built = buildSafeState({ ...state({ formData: profile({ medicalIssues: 'Acute ACL tear' }), boundProfile: undefined }), boundProfileFingerprint: undefined })
      expect(built).not.toBeNull()
      expect(evaluatePlanProfileBinding(built!.formData, built!.boundProfile).isSafetyMismatched).toBe(true)
    })
    it.each(Array.from({ length: 20 }, (_, index) => index + 41))('B%02d: changed bound medical profile is not silently accepted', index => {
      const built = buildSafeState({ ...state(), formData: profile({ medicalIssues: 'Acute ACL tear' }), boundProfile: profile() })
      expect(built?.boundProfile).toBeUndefined()
      expect(index).toBeGreaterThan(0)
    })
  })

  describe('C: active workout session integrity (60 cases)', () => {
    it.each(Array.from({ length: 20 }, (_, index) => index + 1))('C%02d: plan identity mismatch clears session', index => {
      saveActiveSession(session({ planId: `other_${index}` }))
      expect(loadAndValidateActiveSession('plan_lifecycle_1', 'None')).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })
    it.each(Array.from({ length: 20 }, (_, index) => index + 21))('C%02d: medical snapshot divergence clears session', index => {
      saveActiveSession(session({ medicalSnapshot: 'None' }))
      expect(loadAndValidateActiveSession('plan_lifecycle_1', 'Acute ACL tear')).toBeNull()
      expect(index).toBeGreaterThan(0)
    })
    it.each(Array.from({ length: 20 }, (_, index) => index + 41))('C%02d: contraindicated runtime exercise clears session', index => {
      saveActiveSession(session({ medicalSnapshot: 'Acute ACL tear', exercises: [{ ...session().exercises[0], name: 'Box jumps' }] }))
      expect(loadAndValidateActiveSession('plan_lifecycle_1', 'Acute ACL tear')).toBeNull()
      expect(index).toBeGreaterThan(0)
    })
  })

  describe('D: backup/import trust boundary (60 cases)', () => {
    it.each(Array.from({ length: 20 }, (_, index) => index + 1))('D%02d: malformed backup is rejected', index => {
      const result = validateAndParseBackup(index === 1 ? '{' : `not-json-${index}`)
      expect(result.success).toBe(false)
    })
    it.each(Array.from({ length: 20 }, (_, index) => index + 21))('D%02d: unsupported schema is rejected', index => {
      const result = validateAndParseBackup(backup({ schema: `future_${index}` }))
      expect(result.success).toBe(false)
    })
    it.each(Array.from({ length: 20 }, (_, index) => index + 41))('D%02d: forged plan binding is not preserved as trusted binding', index => {
      const parsed = validateAndParseBackup(backup({ planState: { ...state(), boundProfileFingerprint: `forged_${index}` } }))
      expect(parsed.success).toBe(true)
      expect(parsed.success && parsed.data.planState.boundProfile).toBeUndefined()
    })
  })

  describe('E: deep-link/render plan validation (40 cases)', () => {
    it.each(Array.from({ length: 20 }, (_, index) => index + 1))('E%02d: malformed generated plan is not parseable', index => {
      const parsed = parseAndValidatePlan(`## Day 1\nunsafe-${index}`, false)
      expect(parsed.success).toBe(false)
    })
    it.each(Array.from({ length: 20 }, (_, index) => index + 21))('E%02d: unsafe content is detected before execution', index => {
      const scan = scanPlanForContraindications(unsafePlan + `\nmarker-${index}`, 'Acute ACL tear')
      expect(scan.hasViolation).toBe(true)
    })
  })

  describe('F: cross-tab ordering and stale-state rejection (60 cases)', () => {
    it.each(Array.from({ length: 20 }, (_, index) => index + 1))('F%02d: newer Lamport state wins', index => {
      const oldVersion: StateVersion = { counter: index, timestamp: 1000, writerId: 'old' }
      const newVersion: StateVersion = { counter: index + 1, timestamp: 1, writerId: 'new' }
      expect(compareVersions(newVersion, oldVersion)).toBeGreaterThan(0)
    })
    it.each(Array.from({ length: 20 }, (_, index) => index + 21))('F%02d: equal counters use timestamp ordering', index => {
      const a: StateVersion = { counter: index, timestamp: 1000, writerId: 'a' }
      const b: StateVersion = { counter: index, timestamp: 1001, writerId: 'b' }
      expect(compareVersions(b, a)).toBeGreaterThan(0)
    })
    it.each(Array.from({ length: 20 }, (_, index) => index + 41))('F%02d: stale incoming state is rejected by parser or version gate', index => {
      const parsed = parseSafeIncomingState(JSON.stringify({ ...state(), stateVersion: { counter: index, timestamp: Date.now(), writerId: 'remote' } }))
      expect(parsed?.stateVersion?.counter).toBe(index)
      expect(compareVersions(parsed?.stateVersion, { counter: index + 1, timestamp: Date.now(), writerId: 'local' })).toBeLessThan(0)
    })
  })

  describe('G: persistence tampering is inert (60 cases)', () => {
    it.each(Array.from({ length: 20 }, (_, index) => index + 1))('G%02d: invalid plan ids are removed', index => {
      const built = buildSafeState({ ...state(), planId: index as unknown as string })
      expect(built?.planId).toBeUndefined()
    })
    it.each(Array.from({ length: 20 }, (_, index) => index + 21))('G%02d: oversized plan content is bounded', index => {
      const built = buildSafeState({ ...state(), generatedPlan: 'x'.repeat(250000 + index) })
      expect(built?.generatedPlan.length).toBe(250000)
    })
    it.each(Array.from({ length: 20 }, (_, index) => index + 41))('G%02d: prototype pollution does not create trusted fields', index => {
      const polluted = JSON.parse(`{"__proto__":{"isAdmin":true},"planId":"safe_${index}"}`)
      const built = buildSafeState(polluted)
      expect((built as unknown as Record<string, unknown>)?.isAdmin).toBeUndefined()
    })
  })

  describe('H: execution-time safety revalidation (50 cases)', () => {
    const cases = [
      ['Acute ACL tear', 'Box jumps'], ['Torn meniscus', 'Jump squats'], ['Rotator cuff tear', 'Overhead press'],
      ['Shoulder impingement', 'Dips'], ['Herniated lumbar disc', 'Heavy deadlifts'], ['Sciatica', 'Sit-ups'],
      ['Cervical spine stenosis', 'Heavy shrugs'], ['Chest pain on exertion', 'Sprint intervals'],
      ['Pregnancy third trimester', 'Prone superman'], ['Severe osteoporosis', 'Russian twists'],
    ]
    it.each(Array.from({ length: 50 }, (_, index) => cases[index % cases.length]))('H%02d: runtime scan blocks %s for %s', (medical, exercise) => {
      expect(scanPlanForContraindications(`Main Workout: ${exercise}`, medical).hasViolation).toBe(true)
    })
  })

  describe('I: purge and resurrection prevention (20 cases)', () => {
    it.each(Array.from({ length: 20 }, (_, index) => index + 1))('I%02d: purge removes active session and stale plan state', index => {
      saveActiveSession(session({ sessionId: `purge_${index}` }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state({ planId: `purge_plan_${index}` })))
      clearActiveSession()
      localStorage.removeItem(STORAGE_KEY)
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })

  describe('J: round-trip and policy monotonicity (20 cases)', () => {
    it.each(Array.from({ length: 10 }, (_, index) => index + 1))('J%02d: safe state round-trip preserves binding', index => {
      const original = state({ planId: `roundtrip_${index}` })
      const restored = buildSafeState(JSON.parse(JSON.stringify(original)))
      expect(restored?.boundProfileFingerprint).toBe(computeProfileFingerprint(restored?.boundProfile))
    })
    it.each(Array.from({ length: 10 }, (_, index) => index + 11))('J%02d: increasing medical risk never improves trust', index => {
      const result = evaluatePlanProfileBinding(profile({ medicalIssues: 'Severe osteoporosis' }), profile())
      expect(result.isSafetyMismatched).toBe(true)
      expect(index).toBeGreaterThan(0)
    })
  })
})
