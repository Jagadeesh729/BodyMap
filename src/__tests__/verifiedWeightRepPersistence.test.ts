import { describe, it, expect, beforeEach } from 'vitest'
import type { CompletedWorkoutLog, WorkoutSession } from '@/types/workoutSession'
import { saveCompletedWorkoutLog, loadWorkoutHistory, clearWorkoutHistory, saveReflectionForSession } from '@/lib/sessionStorage'
import { extractPersonalRecords } from '@/lib/personalRecords'
import { aggregateCrossSessionExercises } from '@/lib/exerciseCrossSessionEngine'
import { findPreviousPerformance } from '@/lib/progressionEngine'
import { extractPreviousSetPerformance } from '@/lib/exerciseSetProgress'
import { calculateExerciseProgression } from '@/lib/exerciseProgressionTrajectory'
import { calculateEstimated1RM } from '@/lib/oneRepMax'
import { generateBackupPayload, restoreBackupData, validateAndParseBackup } from '@/lib/backupStorage'

// Helper to simulate handleCompleteWorkout summary mapper
function computeExercisesSummary(session: WorkoutSession): CompletedWorkoutLog['exercisesSummary'] {
  return session.exercises.map(e => {
    const completedSets = e.sets.filter(s => s.isCompleted)

    const validWeights = completedSets
      .map(s => s.weightKg)
      .filter((w): w is number => typeof w === 'number' && Number.isFinite(w) && w > 0 && w < 600)
    const peakWeightKg: number | null = validWeights.length > 0
      ? Math.max(...validWeights)
      : null

    const validReps = completedSets
      .map(s => s.completedReps)
      .filter(r => typeof r === 'number' && Number.isFinite(r) && r > 0)
    const avgCompletedReps: number | null = validReps.length > 0
      ? Math.round(validReps.reduce((sum, r) => sum + r, 0) / validReps.length)
      : null

    return {
      name: e.name,
      setsCompleted: completedSets.length,
      totalSets: e.sets.length,
      peakWeightKg,
      avgCompletedReps
    }
  })
}

describe('V11-O1 Verified Weight & Rep Persistence Suite', () => {
  beforeEach(() => {
    localStorage.clear()
    clearWorkoutHistory()
  })

  // T-01: Completed weight persists
  it('T-01: persists completed weight accurately from workout session', () => {
    const session: WorkoutSession = {
      sessionId: 'sess_t1',
      dayIndex: 0,
      dayTitle: 'Push Day',
      dayType: 'Hypertrophy',
      durationMinutes: 45,
      startedAt: Date.now() - 2700000,
      lastUpdatedAt: Date.now(),
      elapsedSeconds: 2700,
      currentExerciseIndex: 0,
      status: 'in-progress',
      soundEnabled: true,
      vibrateEnabled: true,
      restTimer: { isActive: false, targetEndTime: null, durationSeconds: 60, isPaused: false, remainingSeconds: 60 },
      exercises: [
        {
          id: 'ex_1',
          name: 'Barbell Bench Press',
          originalName: 'Barbell Bench Press',
          targetSets: 3,
          targetReps: '8 reps',
          restSeconds: 90,
          focus: 'Chest',
          equipment: 'Barbell',
          formCue: 'Retract scapula',
          isSubstituted: false,
          substitutionReason: null,
          sets: [
            { setIndex: 1, targetReps: '8', completedReps: 8, weightKg: 80, isCompleted: true, completedAt: '2026-08-28T09:00:00Z' },
            { setIndex: 2, targetReps: '8', completedReps: 8, weightKg: 85, isCompleted: true, completedAt: '2026-08-28T09:03:00Z' },
            { setIndex: 3, targetReps: '8', completedReps: 7, weightKg: 85, isCompleted: true, completedAt: '2026-08-28T09:06:00Z' }
          ]
        }
      ]
    }

    const summary = computeExercisesSummary(session)
    expect(summary[0].peakWeightKg).toBe(85)
    expect(summary[0].setsCompleted).toBe(3)
  })

  // T-02: Completed reps persist as average
  it('T-02: persists average completed reps accurately across sets', () => {
    const session: WorkoutSession = {
      sessionId: 'sess_t2',
      dayIndex: 1,
      dayTitle: 'Pull Day',
      dayType: 'Strength',
      durationMinutes: 40,
      startedAt: Date.now() - 2400000,
      lastUpdatedAt: Date.now(),
      elapsedSeconds: 2400,
      currentExerciseIndex: 0,
      status: 'in-progress',
      soundEnabled: true,
      vibrateEnabled: true,
      restTimer: { isActive: false, targetEndTime: null, durationSeconds: 60, isPaused: false, remainingSeconds: 60 },
      exercises: [
        {
          id: 'ex_pull',
          name: 'Barbell Bent Over Row',
          originalName: 'Barbell Bent Over Row',
          targetSets: 3,
          targetReps: '10 reps',
          restSeconds: 90,
          focus: 'Back',
          equipment: 'Barbell',
          formCue: 'Hinge at hips',
          isSubstituted: false,
          substitutionReason: null,
          sets: [
            { setIndex: 1, targetReps: '10', completedReps: 12, weightKg: 60, isCompleted: true, completedAt: null },
            { setIndex: 2, targetReps: '10', completedReps: 10, weightKg: 65, isCompleted: true, completedAt: null },
            { setIndex: 3, targetReps: '10', completedReps: 8, weightKg: 65, isCompleted: true, completedAt: null }
          ]
        }
      ]
    }

    const summary = computeExercisesSummary(session)
    // (12 + 10 + 8) / 3 = 10
    expect(summary[0].avgCompletedReps).toBe(10)
    expect(summary[0].peakWeightKg).toBe(65)
  })

  // T-03: Multiple sets aggregate correctly to maximum peak weight
  it('T-03: aggregates multiple sets with ascending and descending loads to true peak', () => {
    const session: WorkoutSession = {
      sessionId: 'sess_t3',
      dayIndex: 0,
      dayTitle: 'Leg Day',
      dayType: 'Strength',
      durationMinutes: 50,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      elapsedSeconds: 3000,
      currentExerciseIndex: 0,
      status: 'in-progress',
      soundEnabled: true,
      vibrateEnabled: true,
      restTimer: { isActive: false, targetEndTime: null, durationSeconds: 60, isPaused: false, remainingSeconds: 60 },
      exercises: [
        {
          id: 'ex_squat',
          name: 'Barbell Back Squat',
          originalName: 'Barbell Back Squat',
          targetSets: 4,
          targetReps: '5 reps',
          restSeconds: 120,
          focus: 'Quads',
          equipment: 'Barbell',
          formCue: 'Depth below parallel',
          isSubstituted: false,
          substitutionReason: null,
          sets: [
            { setIndex: 1, targetReps: '5', completedReps: 5, weightKg: 100, isCompleted: true, completedAt: null },
            { setIndex: 2, targetReps: '5', completedReps: 5, weightKg: 120, isCompleted: true, completedAt: null },
            { setIndex: 3, targetReps: '5', completedReps: 3, weightKg: 140, isCompleted: true, completedAt: null },
            { setIndex: 4, targetReps: '5', completedReps: 5, weightKg: 110, isCompleted: true, completedAt: null }
          ]
        }
      ]
    }

    const summary = computeExercisesSummary(session)
    expect(summary[0].peakWeightKg).toBe(140)
    // (5 + 5 + 3 + 5) / 4 = 18 / 4 = 4.5 -> round to 5
    expect(summary[0].avgCompletedReps).toBe(5)
  })

  // T-04: Multiple exercises aggregate independently
  it('T-04: computes independent peak weight and reps per exercise in multi-exercise session', () => {
    const session: WorkoutSession = {
      sessionId: 'sess_t4',
      dayIndex: 0,
      dayTitle: 'Upper Split',
      dayType: 'Hypertrophy',
      durationMinutes: 60,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      elapsedSeconds: 3600,
      currentExerciseIndex: 0,
      status: 'in-progress',
      soundEnabled: true,
      vibrateEnabled: true,
      restTimer: { isActive: false, targetEndTime: null, durationSeconds: 60, isPaused: false, remainingSeconds: 60 },
      exercises: [
        {
          id: 'ex_1',
          name: 'Barbell Bench Press',
          originalName: 'Barbell Bench Press',
          targetSets: 2,
          targetReps: '8 reps',
          restSeconds: 90,
          focus: 'Chest',
          equipment: 'Barbell',
          formCue: 'Scapula retracted',
          isSubstituted: false,
          substitutionReason: null,
          sets: [
            { setIndex: 1, targetReps: '8', completedReps: 8, weightKg: 90, isCompleted: true, completedAt: null },
            { setIndex: 2, targetReps: '8', completedReps: 6, weightKg: 95, isCompleted: true, completedAt: null }
          ]
        },
        {
          id: 'ex_2',
          name: 'Cable Lat Pulldown',
          originalName: 'Cable Lat Pulldown',
          targetSets: 2,
          targetReps: '10 reps',
          restSeconds: 60,
          focus: 'Lats',
          equipment: 'Cable',
          formCue: 'Pull to clavicle',
          isSubstituted: false,
          substitutionReason: null,
          sets: [
            { setIndex: 1, targetReps: '10', completedReps: 10, weightKg: 70, isCompleted: true, completedAt: null },
            { setIndex: 2, targetReps: '10', completedReps: 10, weightKg: 75, isCompleted: true, completedAt: null }
          ]
        }
      ]
    }

    const summary = computeExercisesSummary(session)
    expect(summary.length).toBe(2)
    expect(summary[0].name).toBe('Barbell Bench Press')
    expect(summary[0].peakWeightKg).toBe(95)
    expect(summary[0].avgCompletedReps).toBe(7)

    expect(summary[1].name).toBe('Cable Lat Pulldown')
    expect(summary[1].peakWeightKg).toBe(75)
    expect(summary[1].avgCompletedReps).toBe(10)
  })

  // T-05: Incomplete sets do not contribute to peakWeightKg or avgCompletedReps
  it('T-05: ignores uncompleted sets when computing peak weight and average reps', () => {
    const session: WorkoutSession = {
      sessionId: 'sess_t5',
      dayIndex: 0,
      dayTitle: 'Push Day',
      dayType: 'Hypertrophy',
      durationMinutes: 30,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      elapsedSeconds: 1800,
      currentExerciseIndex: 0,
      status: 'in-progress',
      soundEnabled: true,
      vibrateEnabled: true,
      restTimer: { isActive: false, targetEndTime: null, durationSeconds: 60, isPaused: false, remainingSeconds: 60 },
      exercises: [
        {
          id: 'ex_ohp',
          name: 'Barbell Overhead Press',
          originalName: 'Barbell Overhead Press',
          targetSets: 3,
          targetReps: '5 reps',
          restSeconds: 90,
          focus: 'Shoulders',
          equipment: 'Barbell',
          formCue: 'Core tight',
          isSubstituted: false,
          substitutionReason: null,
          sets: [
            { setIndex: 1, targetReps: '5', completedReps: 5, weightKg: 50, isCompleted: true, completedAt: null },
            { setIndex: 2, targetReps: '5', completedReps: 5, weightKg: 55, isCompleted: true, completedAt: null },
            { setIndex: 3, targetReps: '5', completedReps: 5, weightKg: 80, isCompleted: false, completedAt: null }
          ]
        }
      ]
    }

    const summary = computeExercisesSummary(session)
    expect(summary[0].setsCompleted).toBe(2)
    expect(summary[0].totalSets).toBe(3)
    expect(summary[0].peakWeightKg).toBe(55) // Not 80
    expect(summary[0].avgCompletedReps).toBe(5)
  })

  // T-06: Missing weight (bodyweight) yields null peakWeightKg
  it('T-06: sets peakWeightKg to null for bodyweight exercises with no valid weightKg', () => {
    const session: WorkoutSession = {
      sessionId: 'sess_t6',
      dayIndex: 0,
      dayTitle: 'Calisthenics',
      dayType: 'Bodyweight',
      durationMinutes: 25,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      elapsedSeconds: 1500,
      currentExerciseIndex: 0,
      status: 'in-progress',
      soundEnabled: true,
      vibrateEnabled: true,
      restTimer: { isActive: false, targetEndTime: null, durationSeconds: 60, isPaused: false, remainingSeconds: 60 },
      exercises: [
        {
          id: 'ex_pushup',
          name: 'Push-ups',
          originalName: 'Push-ups',
          targetSets: 3,
          targetReps: '20 reps',
          restSeconds: 45,
          focus: 'Chest',
          equipment: 'Bodyweight',
          formCue: 'Full range',
          isSubstituted: false,
          substitutionReason: null,
          sets: [
            { setIndex: 1, targetReps: '20', completedReps: 20, weightKg: null, isCompleted: true, completedAt: null },
            { setIndex: 2, targetReps: '20', completedReps: 18, weightKg: null, isCompleted: true, completedAt: null },
            { setIndex: 3, targetReps: '20', completedReps: 15, weightKg: null, isCompleted: true, completedAt: null }
          ]
        }
      ]
    }

    const summary = computeExercisesSummary(session)
    expect(summary[0].peakWeightKg).toBeNull()
    expect(summary[0].avgCompletedReps).toBe(18) // (20 + 18 + 15) / 3 = 17.67 -> 18
  })

  // T-07: Missing reps handled safely
  it('T-07: sets avgCompletedReps to null when 0 completed sets exist', () => {
    const session: WorkoutSession = {
      sessionId: 'sess_t7',
      dayIndex: 0,
      dayTitle: 'Skipped Session',
      dayType: 'Strength',
      durationMinutes: 5,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      elapsedSeconds: 300,
      currentExerciseIndex: 0,
      status: 'in-progress',
      soundEnabled: true,
      vibrateEnabled: true,
      restTimer: { isActive: false, targetEndTime: null, durationSeconds: 60, isPaused: false, remainingSeconds: 60 },
      exercises: [
        {
          id: 'ex_none',
          name: 'Barbell Squat',
          originalName: 'Barbell Squat',
          targetSets: 3,
          targetReps: '5 reps',
          restSeconds: 90,
          focus: 'Quads',
          equipment: 'Barbell',
          formCue: 'Chest up',
          isSubstituted: false,
          substitutionReason: null,
          sets: [
            { setIndex: 1, targetReps: '5', completedReps: 0, weightKg: 100, isCompleted: false, completedAt: null },
            { setIndex: 2, targetReps: '5', completedReps: 0, weightKg: 100, isCompleted: false, completedAt: null }
          ]
        }
      ]
    }

    const summary = computeExercisesSummary(session)
    expect(summary[0].setsCompleted).toBe(0)
    expect(summary[0].peakWeightKg).toBeNull()
    expect(summary[0].avgCompletedReps).toBeNull()
  })

  // T-08: Old records without new fields remain valid across load and analytics
  it('T-08: successfully loads and processes historical records lacking peakWeightKg/avgCompletedReps', () => {
    const legacyLog: CompletedWorkoutLog = {
      id: 'legacy_log_001',
      sessionId: 'legacy_sess_001',
      dayIndex: 0,
      dayTitle: 'Legacy Upper',
      dayType: 'Strength',
      completedAt: '2026-08-01T10:00:00Z',
      durationSeconds: 2000,
      totalSetsCompleted: 6,
      totalExercises: 2,
      exercisesSummary: [
        { name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3 },
        { name: 'Barbell Bent Over Row', setsCompleted: 3, totalSets: 3 }
      ]
    }

    saveCompletedWorkoutLog(legacyLog)
    const history = loadWorkoutHistory()
    expect(history.length).toBe(1)
    expect(history[0].id).toBe('legacy_log_001')
    expect(history[0].exercisesSummary[0].peakWeightKg).toBeUndefined()
    expect(history[0].exercisesSummary[0].avgCompletedReps).toBeUndefined()

    // Downstream consumers safely handle legacy record
    const prs = extractPersonalRecords(history)
    expect(prs).toEqual([]) // No weight to extract, does not crash

    const crossSession = aggregateCrossSessionExercises(history)
    expect(crossSession.length).toBe(2)
    expect(crossSession[0].peakWeightKg).toBeNull()

    const previousPerf = findPreviousPerformance('Barbell Bench Press', history)
    expect(previousPerf).not.toBeNull()
    expect(previousPerf?.lastWeightKg).toBeNull()
    expect(previousPerf?.lastReps).toBe(3) // setsCompleted fallback
  })

  // T-09: exerciseProgressionTrajectory reads persisted summary correctly
  it('T-09: calculateExerciseProgression detects load progression from canonical exercisesSummary', () => {
    const history: CompletedWorkoutLog[] = [
      {
        id: 'log_recent',
        sessionId: 'sess_recent',
        dayIndex: 0,
        dayTitle: 'Push Day 2',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-20T10:00:00Z',
        durationSeconds: 2400,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          { name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 90, avgCompletedReps: 8 }
        ]
      },
      {
        id: 'log_older',
        sessionId: 'sess_older',
        dayIndex: 0,
        dayTitle: 'Push Day 1',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-10T10:00:00Z',
        durationSeconds: 2400,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          { name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 85, avgCompletedReps: 8 }
        ]
      }
    ]

    const result = calculateExerciseProgression('Barbell Bench Press', history)
    expect(result.hasHistory).toBe(true)
    expect(result.latestWorkingWeightKg).toBe(90)
    expect(result.previousWorkingWeightKg).toBe(85)
    expect(result.weightDeltaKg).toBe(5)
    expect(result.percentageDelta).toBe(5.9)
    expect(result.trajectory).toBe('increasing_load')
    expect(result.trajectoryLabel).toContain('+5 kg')
  })

  // T-10: personalRecords consumes persisted peak weight
  it('T-10: extractPersonalRecords identifies peak lift from persisted peakWeightKg', () => {
    const history: CompletedWorkoutLog[] = [
      {
        id: 'log_pr_1',
        sessionId: 'sess_pr_1',
        dayIndex: 0,
        dayTitle: 'Chest Day',
        dayType: 'Strength',
        completedAt: '2026-08-15T10:00:00Z',
        durationSeconds: 1800,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          { name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 100, avgCompletedReps: 5 }
        ]
      },
      {
        id: 'log_pr_2',
        sessionId: 'sess_pr_2',
        dayIndex: 0,
        dayTitle: 'Chest Day',
        dayType: 'Strength',
        completedAt: '2026-08-25T10:00:00Z',
        durationSeconds: 1800,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          { name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 105, avgCompletedReps: 5 }
        ]
      }
    ]

    const prs = extractPersonalRecords(history)
    expect(prs.length).toBe(1)
    expect(prs[0].exerciseName).toBe('Barbell Bench Press')
    expect(prs[0].value).toBe(105)
    expect(prs[0].unit).toBe('kg')
    expect(prs[0].achievedAt).toBe('2026-08-25T10:00:00Z')
  })

  // T-11: cross-session aggregation consumes persisted peak weight
  it('T-11: aggregateCrossSessionExercises aggregates multi-session peak loads and total volume', () => {
    const history: CompletedWorkoutLog[] = [
      {
        id: 'log_cs_1',
        sessionId: 'sess_cs_1',
        dayIndex: 0,
        dayTitle: 'Leg Day',
        dayType: 'Strength',
        completedAt: '2026-08-10T10:00:00Z',
        durationSeconds: 2400,
        totalSetsCompleted: 4,
        totalExercises: 1,
        exercisesSummary: [
          { name: 'Barbell Back Squat', setsCompleted: 4, totalSets: 4, peakWeightKg: 120, avgCompletedReps: 6 }
        ]
      },
      {
        id: 'log_cs_2',
        sessionId: 'sess_cs_2',
        dayIndex: 0,
        dayTitle: 'Leg Day',
        dayType: 'Strength',
        completedAt: '2026-08-17T10:00:00Z',
        durationSeconds: 2400,
        totalSetsCompleted: 4,
        totalExercises: 1,
        exercisesSummary: [
          { name: 'Barbell Back Squat', setsCompleted: 4, totalSets: 4, peakWeightKg: 130, avgCompletedReps: 6 }
        ]
      }
    ]

    const summaries = aggregateCrossSessionExercises(history)
    expect(summaries.length).toBe(1)
    expect(summaries[0].normalizedName).toBe('barbell back squat')
    expect(summaries[0].totalSessions).toBe(2)
    expect(summaries[0].totalSetsCompleted).toBe(8)
    expect(summaries[0].peakWeightKg).toBe(130)
  })

  // T-12: progressionEngine consumes persisted data
  it('T-12: findPreviousPerformance returns accurate lastWeightKg and suggestedStartingWeightKg', () => {
    const history: CompletedWorkoutLog[] = [
      {
        id: 'log_prog_1',
        sessionId: 'sess_prog_1',
        dayIndex: 0,
        dayTitle: 'Upper Power',
        dayType: 'Strength',
        completedAt: '2026-08-22T10:00:00Z',
        durationSeconds: 2000,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          { name: 'Barbell Overhead Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 62.5, avgCompletedReps: 5 }
        ]
      }
    ]

    const record = findPreviousPerformance('OHP', history)
    expect(record).not.toBeNull()
    expect(record?.lastWeightKg).toBe(62.5)
    expect(record?.lastReps).toBe(5)
    expect(record?.suggestedStartingWeightKg).toBe(62.5)
    expect(record?.factualSummary).toContain('62.5 kg')
  })

  // T-13: oneRepMax receives valid historical weight input
  it('T-13: calculates estimated 1RM from persisted PR peak weight and average reps', () => {
    const history: CompletedWorkoutLog[] = [
      {
        id: 'log_1rm',
        sessionId: 'sess_1rm',
        dayIndex: 0,
        dayTitle: 'Heavy Bench',
        dayType: 'Strength',
        completedAt: '2026-08-24T10:00:00Z',
        durationSeconds: 2100,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          { name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 100, avgCompletedReps: 5 }
        ]
      }
    ]

    const prs = extractPersonalRecords(history)
    expect(prs.length).toBe(1)
    const est1rm = calculateEstimated1RM(prs[0].value, 5)
    expect(est1rm.hasValidEstimate).toBe(true)
    // Epley formula: 100 * (1 + 5/30) = 100 * 1.1667 = 116.67 -> rounded to nearest 0.5 = 116.5 kg
    expect(est1rm.estimated1rmKg).toBe(116.5)
    expect(est1rm.formulaUsed).toBe('Epley')
  })

  // T-14: backup round-trip preserves enriched data
  it('T-14: exports and restores enriched workout history without data truncation or corruption', () => {
    const enrichedLog: CompletedWorkoutLog = {
      id: 'log_backup_v11',
      sessionId: 'sess_backup_v11',
      dayIndex: 2,
      dayTitle: 'Leg Hypertrophy',
      dayType: 'Hypertrophy',
      completedAt: '2026-08-27T10:00:00Z',
      durationSeconds: 3200,
      totalSetsCompleted: 12,
      totalExercises: 3,
      exercisesSummary: [
        { name: 'Barbell Back Squat', setsCompleted: 4, totalSets: 4, peakWeightKg: 135, avgCompletedReps: 8 },
        { name: 'Romanian Deadlift', setsCompleted: 4, totalSets: 4, peakWeightKg: 110, avgCompletedReps: 10 },
        { name: 'Calf Raises', setsCompleted: 4, totalSets: 4, peakWeightKg: 80, avgCompletedReps: 15 }
      ]
    }

    saveCompletedWorkoutLog(enrichedLog)
    const backupPayload = generateBackupPayload()
    expect(backupPayload.workoutHistory.length).toBe(1)
    expect(backupPayload.workoutHistory[0].exercisesSummary[0].peakWeightKg).toBe(135)
    expect(backupPayload.workoutHistory[0].exercisesSummary[0].avgCompletedReps).toBe(8)

    // Clear and restore
    clearWorkoutHistory()
    expect(loadWorkoutHistory()).toEqual([])

    const jsonStr = JSON.stringify(backupPayload)
    const parseRes = validateAndParseBackup(jsonStr)
    expect(parseRes.success).toBe(true)
    if (parseRes.success) {
      const restoreRes = restoreBackupData(parseRes.data)
      expect(restoreRes.success).toBe(true)
    }

    const restoredHistory = loadWorkoutHistory()
    expect(restoredHistory.length).toBe(1)
    expect(restoredHistory[0].exercisesSummary[0].peakWeightKg).toBe(135)
    expect(restoredHistory[0].exercisesSummary[0].avgCompletedReps).toBe(8)
    expect(restoredHistory[0].exercisesSummary[1].peakWeightKg).toBe(110)
    expect(restoredHistory[0].exercisesSummary[2].peakWeightKg).toBe(80)
  })

  // T-15: objective workout facts remain unchanged by reflection behavior
  it('T-15: attaching a session reflection preserves objective weight and repetition facts', () => {
    const log: CompletedWorkoutLog = {
      id: 'log_refl_test',
      sessionId: 'sess_refl_test',
      dayIndex: 0,
      dayTitle: 'Upper A',
      dayType: 'Hypertrophy',
      completedAt: '2026-08-28T08:00:00Z',
      durationSeconds: 2500,
      totalSetsCompleted: 6,
      totalExercises: 2,
      exercisesSummary: [
        { name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 95, avgCompletedReps: 8 },
        { name: 'Barbell Bent Over Row', setsCompleted: 3, totalSets: 3, peakWeightKg: 80, avgCompletedReps: 8 }
      ]
    }

    saveCompletedWorkoutLog(log)

    // Attach reflection
    const attached = saveReflectionForSession('sess_refl_test', {
      energyRating: 5,
      perceivedReadiness: 'high',
      reflectionTags: ['Solid Pump', 'High Energy']
    })
    expect(attached).toBe(true)

    const updated = loadWorkoutHistory()
    expect(updated[0].sessionReflection?.energyRating).toBe(5)
    // Objective facts strictly preserved
    expect(updated[0].exercisesSummary[0].peakWeightKg).toBe(95)
    expect(updated[0].exercisesSummary[0].avgCompletedReps).toBe(8)
    expect(updated[0].exercisesSummary[1].peakWeightKg).toBe(80)
    expect(updated[0].totalSetsCompleted).toBe(6)
    expect(updated[0].durationSeconds).toBe(2500)
  })

  // T-16: extractPreviousSetPerformance uses persisted peakWeightKg and avgCompletedReps
  it('T-16: extractPreviousSetPerformance populates set detail using persisted weight and reps', () => {
    const history: CompletedWorkoutLog[] = [
      {
        id: 'log_set_perf',
        sessionId: 'sess_set_perf',
        dayIndex: 0,
        dayTitle: 'Chest Day',
        dayType: 'Hypertrophy',
        completedAt: '2026-08-25T10:00:00Z',
        durationSeconds: 1800,
        totalSetsCompleted: 3,
        totalExercises: 1,
        exercisesSummary: [
          { name: 'Barbell Bench Press', setsCompleted: 3, totalSets: 3, peakWeightKg: 95, avgCompletedReps: 8 }
        ]
      }
    ]

    const result = extractPreviousSetPerformance('Barbell Bench Press', history)
    expect(result.hasPreviousSession).toBe(true)
    expect(result.sets.length).toBe(3)
    expect(result.sets[0].weightKg).toBe(95)
    expect(result.sets[0].repsCompleted).toBe(8)
    expect(result.formattedSummary).toContain('95kg × 8')
  })
})

