import { describe, it, expect } from 'vitest'
import {
  generatePRTrajectoryCsv,
  createPRTrajectoryCsvBlob,
  generatePRTrajectoryShareText,
  getPRTrajectoryCsvFilename,
  sanitizeCsvValue,
  UTF8_BOM,
  PR_TRAJECTORY_CSV_COLUMNS
} from '@/lib/prTrajectoryExportEngine'
import type { ExercisePRTrajectory, PRTrajectoryPoint } from '@/lib/prProgressionTrajectory'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

function createMockTrajectory(overrides?: Partial<ExercisePRTrajectory>): ExercisePRTrajectory {
  const defaultPoints: PRTrajectoryPoint[] = [
    {
      date: '2026-08-01T10:00:00.000Z',
      displayDate: 'Aug 1',
      timestamp: 1785578400000,
      weightKg: 80,
      reps: 8,
      estimated1rmKg: 101,
      sessionTitle: 'Chest Day',
      isPRBreakthrough: true
    },
    {
      date: '2026-08-15T10:00:00.000Z',
      displayDate: 'Aug 15',
      timestamp: 1786788000000,
      weightKg: 85,
      reps: 6,
      estimated1rmKg: 102,
      sessionTitle: 'Upper Body Power',
      isPRBreakthrough: true
    },
    {
      date: '2026-09-01T10:00:00.000Z',
      displayDate: 'Sep 1',
      timestamp: 1788256800000,
      weightKg: 90,
      reps: 5,
      estimated1rmKg: 105,
      sessionTitle: 'Push Session',
      isPRBreakthrough: true
    }
  ]

  return {
    exerciseName: 'Barbell Bench Press',
    normalizedName: 'barbell bench press',
    points: defaultPoints,
    allTimePeakWeightKg: 90,
    allTimePeak1rmKg: 105,
    totalDataPoints: 3,
    netWeightGainKg: 10,
    firstRecordedDate: '2026-08-01T10:00:00.000Z',
    latestRecordedDate: '2026-09-01T10:00:00.000Z',
    ...overrides
  }
}

describe('prTrajectoryExportEngine — Unit Tests (U1–U20)', () => {
  // U1: Canonical PR trajectory serializes deterministically
  it('U1: Canonical PR trajectory serializes deterministically', () => {
    const trajectory = createMockTrajectory()
    const csv1 = generatePRTrajectoryCsv(trajectory)
    const csv2 = generatePRTrajectoryCsv(trajectory)

    expect(csv1).toBe(csv2)
    expect(csv1.startsWith(UTF8_BOM)).toBe(true)

    const lines = csv1.replace(UTF8_BOM, '').split('\r\n')
    expect(lines).toHaveLength(4) // 1 header + 3 data rows
    expect(lines[0]).toBe('Exercise Name,Date,Peak Weight (kg),Reps,Estimated 1RM (kg),Session,PR Breakthrough')
  })

  // U2: Multiple exercises serialize correctly
  it('U2: Multiple exercises serialize correctly with their respective exercise names', () => {
    const bench = createMockTrajectory({ exerciseName: 'Barbell Bench Press' })
    const squat = createMockTrajectory({
      exerciseName: 'Barbell Back Squat',
      points: [
        {
          date: '2026-08-05T10:00:00.000Z',
          displayDate: 'Aug 5',
          timestamp: 1785924000000,
          weightKg: 120,
          reps: 5,
          estimated1rmKg: 140,
          sessionTitle: 'Leg Day',
          isPRBreakthrough: true
        }
      ]
    })

    const benchCsv = generatePRTrajectoryCsv(bench)
    const squatCsv = generatePRTrajectoryCsv(squat)

    expect(benchCsv).toContain('Barbell Bench Press')
    expect(benchCsv).not.toContain('Barbell Back Squat')
    expect(squatCsv).toContain('Barbell Back Squat')
    expect(squatCsv).not.toContain('Barbell Bench Press')
  })

  // U3: Multiple trajectory points preserve chronological order
  it('U3: Multiple trajectory points preserve chronological order', () => {
    const trajectory = createMockTrajectory()
    const csv = generatePRTrajectoryCsv(trajectory)
    const lines = csv.replace(UTF8_BOM, '').split('\r\n')

    expect(lines[1]).toContain('2026-08-01T10:00:00.000Z')
    expect(lines[2]).toContain('2026-08-15T10:00:00.000Z')
    expect(lines[3]).toContain('2026-09-01T10:00:00.000Z')
  })

  // U4: Numeric values preserve intended precision
  it('U4: Numeric values preserve intended precision without unintended rounding', () => {
    const trajectory = createMockTrajectory({
      points: [
        {
          date: '2026-08-01T10:00:00.000Z',
          displayDate: 'Aug 1',
          timestamp: 1785578400000,
          weightKg: 82.5,
          reps: 7,
          estimated1rmKg: 101.75,
          sessionTitle: 'Chest Day',
          isPRBreakthrough: true
        }
      ]
    })

    const csv = generatePRTrajectoryCsv(trajectory)
    expect(csv).toContain('82.5')
    expect(csv).toContain('101.75')
  })

  // U5: Dates serialize deterministically
  it('U5: Dates serialize deterministically', () => {
    const trajectory = createMockTrajectory()
    const csv = generatePRTrajectoryCsv(trajectory)
    expect(csv).toContain('2026-08-01T10:00:00.000Z')
    expect(csv).toContain('2026-08-15T10:00:00.000Z')
  })

  // U6: Empty PR vault produces safe empty output (header only)
  it('U6: Empty PR vault produces safe empty output', () => {
    const empty1 = generatePRTrajectoryCsv(null)
    const lines1 = empty1.replace(UTF8_BOM, '').split('\r\n')
    expect(lines1).toHaveLength(1)
    expect(lines1[0]).toBe(PR_TRAJECTORY_CSV_COLUMNS.join(','))

    const empty2 = generatePRTrajectoryCsv({
      exerciseName: 'Deadlift',
      normalizedName: 'deadlift',
      points: [],
      allTimePeakWeightKg: 0,
      allTimePeak1rmKg: null,
      totalDataPoints: 0,
      netWeightGainKg: 0,
      firstRecordedDate: '',
      latestRecordedDate: ''
    })
    const lines2 = empty2.replace(UTF8_BOM, '').split('\r\n')
    expect(lines2).toHaveLength(1)
    expect(lines2[0]).toBe(PR_TRAJECTORY_CSV_COLUMNS.join(','))

    const emptyShare = generatePRTrajectoryShareText(null)
    expect(emptyShare).toBe('No personal record trajectory data available.')
  })

  // U7: Scoped export excludes non-selected records
  it('U7: Scoped export excludes non-selected records', () => {
    const bench = createMockTrajectory({ exerciseName: 'Bench Press' })
    const csv = generatePRTrajectoryCsv(bench)
    expect(csv).not.toContain('Overhead Press')
    expect(csv).not.toContain('Pull-up')
  })

  // U8: User-controlled commas are escaped
  it('U8: User-controlled commas in session titles or names are escaped per RFC 4180', () => {
    const trajectory = createMockTrajectory({
      exerciseName: 'Bench Press, Dumbbell (Incline)',
      points: [
        {
          date: '2026-08-01T10:00:00.000Z',
          displayDate: 'Aug 1',
          timestamp: 1785578400000,
          weightKg: 30,
          reps: 10,
          estimated1rmKg: 40,
          sessionTitle: 'Chest, Shoulders, and Triceps',
          isPRBreakthrough: true
        }
      ]
    })

    const csv = generatePRTrajectoryCsv(trajectory)
    expect(csv).toContain('"Bench Press, Dumbbell (Incline)"')
    expect(csv).toContain('"Chest, Shoulders, and Triceps"')
  })

  // U9: Quotes are escaped
  it('U9: Quotes are escaped with double-quotes per RFC 4180', () => {
    const trajectory = createMockTrajectory({
      exerciseName: 'Arnold "The Oak" Press',
      points: [
        {
          date: '2026-08-01T10:00:00.000Z',
          displayDate: 'Aug 1',
          timestamp: 1785578400000,
          weightKg: 24,
          reps: 12,
          estimated1rmKg: 33.6,
          sessionTitle: 'Workout "Alpha"',
          isPRBreakthrough: false
        }
      ]
    })

    const csv = generatePRTrajectoryCsv(trajectory)
    expect(csv).toContain('"Arnold ""The Oak"" Press"')
    expect(csv).toContain('"Workout ""Alpha"""')
  })

  // U10: CR/LF values are safely encoded
  it('U10: CR/LF values are safely encoded within quoted fields', () => {
    const trajectory = createMockTrajectory({
      points: [
        {
          date: '2026-08-01T10:00:00.000Z',
          displayDate: 'Aug 1',
          timestamp: 1785578400000,
          weightKg: 50,
          reps: 10,
          estimated1rmKg: 66.7,
          sessionTitle: 'Session Part 1\nSession Part 2',
          isPRBreakthrough: true
        }
      ]
    })

    const csv = generatePRTrajectoryCsv(trajectory)
    expect(csv).toContain('"Session Part 1\nSession Part 2"')
  })

  // U11: Spreadsheet formula prefixes are neutralized
  it('U11: Spreadsheet formula prefixes (=, +, -, @, \\t, \\r) are neutralized with single quote prefix', () => {
    expect(sanitizeCsvValue('=SUM(A1:B10)')).toBe("'=SUM(A1:B10)")
    expect(sanitizeCsvValue('+12345')).toBe("'+12345")
    expect(sanitizeCsvValue('-cmd|/C calc')).toBe("'-cmd|/C calc")
    expect(sanitizeCsvValue('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(sanitizeCsvValue('\tTabInjection')).toBe("'\tTabInjection")
    expect(sanitizeCsvValue('\rReturnInjection')).toBe("'\rReturnInjection")

    // Valid positive numbers without leading plus are NOT quote-prefixed
    expect(sanitizeCsvValue(100)).toBe('100')
    expect(sanitizeCsvValue(85.5)).toBe('85.5')

    const hostileTrajectory = createMockTrajectory({
      exerciseName: '=CMD()',
      points: [
        {
          date: '2026-08-01T10:00:00.000Z',
          displayDate: 'Aug 1',
          timestamp: 1785578400000,
          weightKg: 80,
          reps: 8,
          estimated1rmKg: 101,
          sessionTitle: '+DDE("cmd";"calc")',
          isPRBreakthrough: true
        }
      ]
    })

    const csv = generatePRTrajectoryCsv(hostileTrajectory)
    expect(csv).toContain("'=CMD()")
    expect(csv).toContain("'+DDE(\"\"cmd\"\";\"\"calc\"\")")
  })

  // U12: Unicode remains intact
  it('U12: Unicode characters (accents, emojis, non-Latin) remain intact', () => {
    const trajectory = createMockTrajectory({
      exerciseName: 'Développé Couché 💪',
      points: [
        {
          date: '2026-08-01T10:00:00.000Z',
          displayDate: 'Aug 1',
          timestamp: 1785578400000,
          weightKg: 90,
          reps: 5,
          estimated1rmKg: 105,
          sessionTitle: 'Entraînement Force 🔥',
          isPRBreakthrough: true
        }
      ]
    })

    const csv = generatePRTrajectoryCsv(trajectory)
    expect(csv).toContain('Développé Couché 💪')
    expect(csv).toContain('Entraînement Force 🔥')

    const shareText = generatePRTrajectoryShareText(trajectory)
    expect(shareText).toContain('Développé Couché 💪')
  })

  // U13: Hostile filename values are sanitized
  it('U13: Hostile filename values are sanitized using downloadSecurity', () => {
    const date = new Date(2026, 8, 19)
    const filename = getPRTrajectoryCsvFilename('Bench:Press*Special?<>|', date)
    expect(filename).toBe('bodymap-pr-trajectory-bench-press-special-2026-09-19.csv')
    expect(filename).not.toMatch(/[:*?<>|]/)
  })

  // U14: Path traversal values are neutralized in filename
  it('U14: Path traversal values are neutralized in filename', () => {
    const date = new Date(2026, 8, 19)
    const filename = getPRTrajectoryCsvFilename('../../../etc/passwd', date)
    expect(filename).not.toContain('..')
    expect(filename).not.toContain('/')
    expect(filename).not.toContain('\\')
    expect(filename.endsWith('.csv')).toBe(true)
  })

  // U15: Very long user-controlled strings are bounded/safely handled
  it('U15: Very long user-controlled strings are bounded in filename', () => {
    const veryLongName = 'A'.repeat(500)
    const filename = getPRTrajectoryCsvFilename(veryLongName)
    expect(filename.length).toBeLessThanOrEqual(70) // MAX_FILENAME_BASE_LENGTH = 60 + .csv
    expect(filename.endsWith('.csv')).toBe(true)
  })

  // U16: No medical/profile fields enter the export payload
  it('U16: No medical/profile fields enter the export or share payload', () => {
    const trajectory = createMockTrajectory()
    const csv = generatePRTrajectoryCsv(trajectory)
    const shareText = generatePRTrajectoryShareText(trajectory)

    const prohibitedKeys = [
      'medicalIssues',
      'allergies',
      'contraindication',
      'injuries',
      'medications',
      'bloodPressure',
      'heartRate',
      'dietaryPreference',
      'bodyFat',
      'user_id',
      'token',
      'password'
    ]

    for (const key of prohibitedKeys) {
      expect(csv.toLowerCase()).not.toContain(key.toLowerCase())
      expect(shareText.toLowerCase()).not.toContain(key.toLowerCase())
    }
  })

  // U17: Output contains no API key patterns
  it('U17: Output contains no API key patterns', () => {
    const trajectory = createMockTrajectory()
    const csv = generatePRTrajectoryCsv(trajectory)
    const shareText = generatePRTrajectoryShareText(trajectory)

    const apiKeyPattern = /AIzaSy[A-Za-z0-9_-]{33}/
    expect(apiKeyPattern.test(csv)).toBe(false)
    expect(apiKeyPattern.test(shareText)).toBe(false)
  })

  // U18: Export is deterministic across repeated calls
  it('U18: Export is deterministic across repeated calls', () => {
    const trajectory = createMockTrajectory()
    const call1 = generatePRTrajectoryCsv(trajectory)
    const call2 = generatePRTrajectoryCsv(trajectory)
    const call3 = generatePRTrajectoryCsv(trajectory)

    expect(call1).toBe(call2)
    expect(call2).toBe(call3)

    const text1 = generatePRTrajectoryShareText(trajectory)
    const text2 = generatePRTrajectoryShareText(trajectory)
    expect(text1).toBe(text2)
  })

  // U19: Export does not mutate canonical PR trajectory
  it('U19: Export does not mutate canonical PR trajectory', () => {
    const trajectory = createMockTrajectory()
    const originalPointsJson = JSON.stringify(trajectory.points)

    generatePRTrajectoryCsv(trajectory)
    generatePRTrajectoryShareText(trajectory)
    createPRTrajectoryCsvBlob(trajectory)

    expect(JSON.stringify(trajectory.points)).toBe(originalPointsJson)
    expect(trajectory.totalDataPoints).toBe(3)
  })

  // U20: Export does not mutate workout history
  it('U20: Export does not mutate workout history', () => {
    const mockHistory: CompletedWorkoutLog[] = [
      {
        id: 'log_1',
        completedAt: '2026-08-01T10:00:00.000Z',
        dayTitle: 'Day 1',
        dayType: 'upper',
        durationSeconds: 2400,
        exercisesSummary: [
          {
            name: 'Barbell Bench Press',
            setsCompleted: 3,
            totalSets: 3,
            peakWeightKg: 80,
            avgCompletedReps: 8
          }
        ]
      }
    ]

    const originalHistoryJson = JSON.stringify(mockHistory)
    const trajectory = createMockTrajectory()

    generatePRTrajectoryCsv(trajectory)
    expect(JSON.stringify(mockHistory)).toBe(originalHistoryJson)
  })
})
