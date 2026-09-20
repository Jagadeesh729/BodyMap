/**
 * E28-A Canonical Test Data Fixtures
 *
 * Deterministic, self-contained test data for seeding browser localStorage.
 * All IDs and timestamps are fixed to prevent order-dependence.
 * No real user data. No medical profiles.
 */

// ─── Storage Keys (must match src/lib/* constants) ───────────────────────────

export const STORAGE_KEYS = {
  GYM_FEEDBACK: 'bodymap_gym_ambient_feedback',
  HYDRATION_LOG: 'bodymap_hydration_log',
  BODY_METRICS: 'bodymap_body_metrics',
  WORKOUT_HISTORY: 'bodymap_workout_history',
  // Must match planStorage.ts STORAGE_KEY = 'bodymap_plan_v2'
  PLAN: 'bodymap_plan_v2',
  FORM_DATA: 'bodymap_form_data',
} as const


// ─── Gym Feedback ─────────────────────────────────────────────────────────────

export const GYM_FEEDBACK_DEFAULTS = {
  soundEnabled: true,
  vibrateEnabled: true,
}

export const GYM_FEEDBACK_SOUND_OFF = {
  soundEnabled: false,
  vibrateEnabled: true,
}

export const GYM_FEEDBACK_VIBRATE_OFF = {
  soundEnabled: true,
  vibrateEnabled: false,
}

export const GYM_FEEDBACK_BOTH_OFF = {
  soundEnabled: false,
  vibrateEnabled: false,
}

// ─── Hydration ────────────────────────────────────────────────────────────────

/** Fixed "today" dates for hydration timezone tests */
export const HYDRATION_TODAY_IST = '2026-09-20'     // Asia/Kolkata
export const HYDRATION_TODAY_EST = '2026-09-19'     // UTC-5 (19:00 UTC-5 = 00:30 UTC+5:30 = next day IST)
export const HYDRATION_YESTERDAY = '2026-09-19'

export function buildHydrationLog(entries: Record<string, number>): string {
  return JSON.stringify(entries)
}

// ─── Body Measurements ────────────────────────────────────────────────────────

export interface TestBodyMeasurement {
  id: string
  date: string
  timestamp: number
  unit: 'cm'
  waist?: number
  chest?: number
  arms?: number
  thighs?: number
  hips?: number
}

/** Three entries for deletion testing (newest first after sorting) */
export const BODY_MEASUREMENTS_3: TestBodyMeasurement[] = [
  {
    id: 'bm_test_001',
    date: '2026-09-01',
    timestamp: new Date('2026-09-01').getTime(),
    unit: 'cm',
    waist: 82.0,
    chest: 96.5,
    arms: 34.0,
    thighs: 56.0,
    hips: 91.0,
  },
  {
    id: 'bm_test_002',
    date: '2026-09-10',
    timestamp: new Date('2026-09-10').getTime(),
    unit: 'cm',
    waist: 80.5,
    chest: 97.0,
    arms: 34.5,
    thighs: 55.5,
    hips: 90.0,
  },
  {
    id: 'bm_test_003',
    date: '2026-09-18',
    timestamp: new Date('2026-09-18').getTime(),
    unit: 'cm',
    waist: 79.0,
    chest: 98.0,
    arms: 35.0,
    thighs: 54.5,
    hips: 89.5,
  },
]

/** Two entries with same date (duplicate-date edge case) */
export const BODY_MEASUREMENTS_DUPE_DATE: TestBodyMeasurement[] = [
  {
    id: 'bm_dupe_001',
    date: '2026-09-15',
    timestamp: new Date('2026-09-15').getTime(),
    unit: 'cm',
    waist: 82.0,
  },
  {
    id: 'bm_dupe_002',
    date: '2026-09-15',
    timestamp: new Date('2026-09-15').getTime() + 1,
    unit: 'cm',
    waist: 81.5,
  },
]

/** Single entry for "last record deletion" test */
export const BODY_MEASUREMENTS_SINGLE: TestBodyMeasurement[] = [
  {
    id: 'bm_single_001',
    date: '2026-09-20',
    timestamp: new Date('2026-09-20').getTime(),
    unit: 'cm',
    waist: 80.0,
    chest: 97.0,
  },
]

// ─── Workout History (for PR Trajectory) ─────────────────────────────────────

export interface TestWorkoutSummary {
  name: string
  setsCompleted: number
  totalSets: number
  peakWeightKg: number
  avgCompletedReps: number
}

export interface TestWorkoutLog {
  id: string
  sessionId: string
  dayIndex: number
  dayTitle: string
  dayType: string
  completedAt: string
  durationSeconds: number
  totalSetsCompleted: number
  totalExercises: number
  exercisesSummary: TestWorkoutSummary[]
}

/** Deterministic 5-session workout history for "Barbell Bench Press" trajectory */
export const WORKOUT_HISTORY_BENCH: TestWorkoutLog[] = [
  {
    id: 'wh_test_001',
    sessionId: 'sess_001',
    dayIndex: 0,
    dayTitle: 'Chest Day 1',
    dayType: 'Strength',
    completedAt: '2026-07-01T10:00:00.000Z',
    durationSeconds: 2400,
    totalSetsCompleted: 2,
    totalExercises: 1,
    exercisesSummary: [
      {
        name: 'Barbell Bench Press',
        setsCompleted: 2,
        totalSets: 2,
        peakWeightKg: 80,
        avgCompletedReps: 8,
      },
    ],
  },
  {
    id: 'wh_test_002',
    sessionId: 'sess_002',
    dayIndex: 0,
    dayTitle: 'Chest Day 2',
    dayType: 'Strength',
    completedAt: '2026-07-15T10:00:00.000Z',
    durationSeconds: 2400,
    totalSetsCompleted: 2,
    totalExercises: 1,
    exercisesSummary: [
      {
        name: 'Barbell Bench Press',
        setsCompleted: 2,
        totalSets: 2,
        peakWeightKg: 90,
        avgCompletedReps: 6,
      },
    ],
  },
  {
    id: 'wh_test_003',
    sessionId: 'sess_003',
    dayIndex: 0,
    dayTitle: 'PR Attempt',
    dayType: 'Strength',
    completedAt: '2026-08-01T10:00:00.000Z',
    durationSeconds: 2400,
    totalSetsCompleted: 2,
    totalExercises: 1,
    exercisesSummary: [
      {
        name: 'Barbell Bench Press',
        setsCompleted: 2,
        totalSets: 2,
        peakWeightKg: 100,
        avgCompletedReps: 5,
      },
    ],
  },
  {
    id: 'wh_test_004',
    sessionId: 'sess_004',
    dayIndex: 0,
    dayTitle: 'Volume Block',
    dayType: 'Strength',
    completedAt: '2026-08-20T10:00:00.000Z',
    durationSeconds: 2400,
    totalSetsCompleted: 1,
    totalExercises: 1,
    exercisesSummary: [
      {
        name: 'Barbell Bench Press',
        setsCompleted: 1,
        totalSets: 1,
        peakWeightKg: 85,
        avgCompletedReps: 10,
      },
    ],
  },
  {
    id: 'wh_test_005',
    sessionId: 'sess_005',
    dayIndex: 0,
    dayTitle: 'Peak Week',
    dayType: 'Strength',
    completedAt: '2026-09-10T10:00:00.000Z',
    durationSeconds: 2400,
    totalSetsCompleted: 1,
    totalExercises: 1,
    exercisesSummary: [
      {
        name: 'Barbell Bench Press',
        setsCompleted: 1,
        totalSets: 1,
        peakWeightKg: 110,
        avgCompletedReps: 3,
      },
    ],
  },
]

/** Separate exercise (Squat) to verify no cross-contamination in PR export */
export const WORKOUT_HISTORY_SQUAT_EXTRA: TestWorkoutLog = {
  id: 'wh_test_squat_001',
  sessionId: 'sess_squat_001',
  dayIndex: 1,
  dayTitle: 'Leg Day',
  dayType: 'Strength',
  completedAt: '2026-09-05T10:00:00.000Z',
  durationSeconds: 2400,
  totalSetsCompleted: 1,
  totalExercises: 1,
  exercisesSummary: [
    {
      name: 'Barbell Back Squat',
      setsCompleted: 1,
      totalSets: 1,
      peakWeightKg: 120,
      avgCompletedReps: 5,
    },
  ],
}

export const WORKOUT_HISTORY_FULL = [...WORKOUT_HISTORY_BENCH, WORKOUT_HISTORY_SQUAT_EXTRA]

// ─── Plan Data (minimal plan for safety-gate seeding) ────────────────────────

export const CANONICAL_MOCK_PLAN = `## Day 1 - Upper Body Strength Focus
**Warm-up:** 5 mins arm circles, jumping jacks, shoulder mobility
**Main Workout:**
- Push-ups: 3 sets x 12 reps
- Dumbbell Rows: 3 sets x 10 reps
- Overhead Press: 3 sets x 10 reps
- Bicep Curls / Dips Superset: 3 sets x 12 reps
**Cool-down:** 5 mins chest & tricep static stretching

**Meals:**
- Breakfast: Oatmeal with berries, chia seeds & protein (350 kcal)
- Lunch: Grilled chicken salad with quinoa & avocado (450 kcal)
- Dinner: Baked salmon with sweet potato & broccoli (500 kcal)
- Snacks: Greek yogurt & almonds (300 kcal)
Total Calories: 1600 kcal

## Day 2 - Lower Body Strength & Core
**Warm-up:** 5 mins dynamic leg swings, bodyweight squats, hip openers
**Main Workout:**
- Goblet Squats: 4 sets x 12 reps
- Romanian Deadlifts: 3 sets x 10 reps
- Walking Lunges: 3 sets x 12 reps per leg
- Plank Hold: 3 sets x 45 secs
**Cool-down:** 5 mins hamstring & quad stretching

**Meals:**
- Breakfast: Scrambled eggs with spinach and whole grain toast (380 kcal)
- Lunch: Turkey wrap with hummus, cucumber and mixed greens (440 kcal)
- Dinner: Lean beef stir-fry with brown rice and bell peppers (520 kcal)
- Snacks: Cottage cheese with sliced pineapple (260 kcal)
Total Calories: 1600 kcal

## Day 3 - Active Recovery & Mobility
**Warm-up:** 5 mins diaphragmatic breathing and gentle spinal waves
**Main Workout:**
- Cat-Cow Flow: 3 sets x 10 reps
- World's Greatest Stretch: 3 sets x 5 reps per side
- Foam Rolling Lower Body: 3 sets x 60 secs
**Cool-down:** 5 mins full body child's pose and passive relaxation

**Meals:**
- Breakfast: Protein smoothie with banana, spinach, flax seeds and oat milk (360 kcal)
- Lunch: Mediterranean lentil salad with cucumber, olives and olive oil (460 kcal)
- Dinner: Grilled white fish with quinoa and roasted asparagus (480 kcal)
- Snacks: Mixed fruit and pumpkin seeds (250 kcal)
Total Calories: 1550 kcal`

export const MINIMAL_PLAN_NO_SAFETY_ISSUES = JSON.stringify({
  planId: 'plan_e2e_valid_001',
  generatedPlan: CANONICAL_MOCK_PLAN,
  planText: CANONICAL_MOCK_PLAN,
  formData: {
    age: '28',
    gender: 'Male',
    height: '175',
    weight: '75',
    fitnessLevel: 'Intermediate',
    mainGoal: 'Build Muscle',
    bodyFocus: ['Chest', 'Back'],
    timePerDay: '45',
    recoveryDays: '2',
    medicalIssues: '',
    dietaryPreference: 'omnivore',
    allergies: '',
    equipment: ['Barbell', 'Dumbbells'],
    pushupCount: '20',
    sleepHours: '7',
    stressLevel: 'Low',
    specialRequests: '',
  },
  boundProfile: {
    age: '28',
    gender: 'Male',
    height: '175',
    weight: '75',
    fitnessLevel: 'Intermediate',
    mainGoal: 'Build Muscle',
    bodyFocus: ['Chest', 'Back'],
    timePerDay: '45',
    recoveryDays: '2',
    medicalIssues: '',
    dietaryPreference: 'omnivore',
    allergies: '',
    equipment: ['Barbell', 'Dumbbells'],
  },
  isGenerated: true,
  savedAt: '2026-09-20T00:00:00.000Z',
  stateVersion: { counter: 1, timestamp: 1726790400000, writerId: 'e2e_test_writer' },
})

/** Safety-mismatched plan: current profile has knee injury, bound profile does not */
export const PLAN_WITH_SAFETY_MISMATCH = JSON.stringify({
  planText: 'Day 1: Jump Squats\nDay 2: Rest',
  formData: {
    age: '30',
    gender: 'Female',
    height: '165',
    weight: '65',
    fitnessLevel: 'Beginner',
    mainGoal: 'Weight Loss',
    bodyFocus: ['Legs'],
    timePerDay: '30',
    recoveryDays: '3',
    medicalIssues: 'knee injury',
    dietaryPreference: 'vegan',
    allergies: '',
    equipment: ['Bodyweight'],
    pushupCount: '5',
    sleepHours: '7',
    stressLevel: 'Moderate',
    specialRequests: '',
  },
  boundProfile: {
    age: '30',
    gender: 'Female',
    height: '165',
    weight: '65',
    fitnessLevel: 'Beginner',
    mainGoal: 'Weight Loss',
    bodyFocus: ['Legs'],
    timePerDay: '30',
    recoveryDays: '3',
    medicalIssues: '',  // OLD profile had no medical issues
    dietaryPreference: 'vegan',
    allergies: '',
    equipment: ['Bodyweight'],
  },
  isGenerated: true,
  savedAt: '2026-09-10T00:00:00.000Z',
})
