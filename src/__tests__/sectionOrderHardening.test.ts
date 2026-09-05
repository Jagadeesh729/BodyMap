import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  scanPlanForContraindications,
  getActiveContraindicationCategories,
} from '@/lib/contraindicationGuard'
import { parseAndValidatePlan, extractDaySections } from '@/lib/planSchema'
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
  ACTIVE_SESSION_STORAGE_KEY,
} from '@/lib/sessionStorage'
import type { WorkoutSession } from '@/types/workoutSession'
import * as serverModule from '../../api/generate-plan'

describe('Section Order & Evasion Hardening', () => {
  describe('Contraindication Guard Section Order Invariance', () => {
    it('catches multiple contraindicated exercises when Meals precedes Main Workout', () => {
      const planMealsFirst = `## Day 1 - Full Body & Nutrition
**Meals:**
- Breakfast: Oatmeal with berries (350 kcal)
- Lunch: Grilled chicken salad (450 kcal)
- Dinner: Salmon with sweet potato (500 kcal)

**Main Workout:**
- Box Jumps: 4 sets x 15 reps
- Romanian Deadlifts: 3 sets x 10 reps
- Overhead Shoulder Press: 3 sets x 10 reps
- Burpees: 4 sets x 20 reps
`

      const condition = 'Acute ACL tear, torn meniscus, herniated disc, rotator cuff tear'
      const scan = scanPlanForContraindications(planMealsFirst, condition)

      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.length).toBe(4)
      expect(scan.scannedExerciseCount).toBe(4)

      const categories = scan.violations.map(v => v.category).sort()
      expect(categories).toEqual([
        'knee_high_impact',
        'knee_high_impact',
        'lumbar_disc_herniation',
        'shoulder_impingement_cuff',
      ])
    })

    it('catches contraindications when Diet/Nutrition header precedes Workout', () => {
      const planDietFirst = `## Day 1 - Strength & Diet
**Diet:**
- Breakfast: Protein shake (300 kcal)
- Lunch: Turkey sandwich (400 kcal)
- Dinner: Steak and broccoli (600 kcal)

**Workout:**
- Barbell Deadlifts: 3 sets x 8 reps
- Behind the Neck Shoulder Press: 3 sets x 10 reps
`
      const scan = scanPlanForContraindications(planDietFirst, 'L5-S1 disc herniation, cervical spine pain')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.length).toBe(2)
      expect(scan.violations.map(v => v.category).sort()).toEqual([
        'cervical_spine_pathology',
        'lumbar_disc_herniation',
      ])
    })

    it('catches contraindications across interleaved sections (Warm-up -> Meals -> Workout -> Cool-down)', () => {
      const planInterleaved = `## Day 1 - Split Schedule
**Warm-up:**
- 5-minute dynamic jog
- Tuck Jumps: 2 sets x 10 reps

**Meals:**
- Breakfast: Eggs and avocado (400 kcal)
- Lunch: Tuna salad (350 kcal)

**Main Workout:**
- Dumbbell Bench Press: 3 sets x 10 reps
- Romanian Deadlifts: 4 sets x 8 reps

**Cool-down:**
- 5-minute stretch
`
      const scan = scanPlanForContraindications(planInterleaved, 'Patellofemoral pain, bulging disc')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.length).toBe(2)
      expect(scan.violations.map(v => v.category).sort()).toEqual([
        'knee_high_impact',
        'lumbar_disc_herniation',
      ])
    })

    it('catches contraindicated exercise covertly placed inside Meals section', () => {
      const evasivePlan = `## Day 1 - Mixed
**Meals:**
- Breakfast: Oatmeal (300 kcal)
- Box Jumps: 4 sets x 15 reps
- Lunch: Chicken salad (400 kcal)
- Dinner: Salmon (500 kcal)
`
      const scan = scanPlanForContraindications(evasivePlan, 'ACL tear, meniscus repair')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.some(v => v.matchedExercise.toLowerCase().includes('box jumps'))).toBe(true)
    })

    it('does not falsely trigger contraindications on culinary dip descriptions', () => {
      const safePlanWithFoodDip = `## Day 1 - Healthy Routine
**Main Workout:**
- Bodyweight Squats: 3 sets x 12 reps
- Push-ups: 3 sets x 10 reps
- Glute Bridges: 3 sets x 15 reps

**Meals:**
- Breakfast: Greek yogurt with honey
- Snack: Carrots with spinach dip and pita chips
- Lunch: Turkey wrap with hummus dip
- Dinner: Grilled salmon with quinoa
`
      const scan = scanPlanForContraindications(safePlanWithFoodDip, 'Rotator cuff tear, shoulder impingement')
      expect(scan.hasViolation).toBe(false)
      expect(scan.violations).toHaveLength(0)
    })

    it('preserves safe clinical exemptions even with inverted sections', () => {
      const safeReversedPlan = `## Day 1 - Knee & Spine Safe
**Meals:**
- Breakfast: Oatmeal
- Lunch: Salmon wrap
- Dinner: Chicken stir-fry

**Main Workout:**
- Box Squats: 3 sets x 10 reps
- Bodyweight Squats: 3 sets x 12 reps
- Wall Sits: 3 sets x 30s
- Stationary Cycling: 20 minutes
`
      const scan = scanPlanForContraindications(safeReversedPlan, 'ACL tear, torn meniscus, L4-L5 herniation')
      expect(scan.hasViolation).toBe(false)
      expect(scan.violations).toHaveLength(0)
    })
  })

  describe('Serverless API & Client Parity Under Inverted Sections', () => {
    it('produces identical scan results between contraindicationGuard and api/generate-plan', () => {
      const testCases = [
        {
          name: 'Meals first with knee and shoulder contraindications',
          plan: `## Day 1
**Meals:**
- Breakfast: Oats
**Main Workout:**
- Box Jumps: 3 sets x 10 reps
- Overhead Shoulder Press: 3 sets x 8 reps
`,
          condition: 'ACL tear, shoulder impingement',
        },
        {
          name: 'Food dips in meals with shoulder condition',
          plan: `## Day 1
**Meals:**
- Snack: Celery sticks with spinach dip
**Main Workout:**
- Push-ups: 3 sets x 10 reps
`,
          condition: 'Rotator cuff tear',
        },
        {
          name: 'Multiple sections interleaved',
          plan: `## Day 1
**Warm-up:**
- Burpees: 2 sets x 10 reps
**Nutrition:**
- Lunch: Rice bowl
**Workout:**
- Deadlifts: 3 sets x 5 reps
`,
          condition: 'Herniated disc, knee pain',
        },
      ]

      for (const tc of testCases) {
        const clientActive = getActiveContraindicationCategories(tc.condition).map(c => c.key).sort()
        const serverActive = serverModule.getActiveContraindicationCategories(tc.condition).map((c: { key: string }) => c.key).sort()
        expect(clientActive).toEqual(serverActive)

        const clientScan = scanPlanForContraindications(tc.plan, tc.condition)
        const serverScan = serverModule.scanPlanForContraindications(tc.plan, tc.condition)

        expect(clientScan.hasViolation).toBe(serverScan.hasViolation)
        expect(clientScan.violations.length).toBe(serverScan.violations.length)
        expect(clientScan.scannedExerciseCount).toBe(serverScan.scannedExerciseCount)

        for (let i = 0; i < clientScan.violations.length; i++) {
          expect(clientScan.violations[i].category).toBe(serverScan.violations[i].category)
          expect(clientScan.violations[i].matchedExercise).toBe(serverScan.violations[i].matchedExercise)
        }
      }
    })
  })

  describe('Plan Schema Section Parsing Order Invariance', () => {
    it('extracts exercises and meals correctly regardless of section ordering', () => {
      const fullPlanMealsFirst = `# 7-Day Plan
## Day 1 - Full Body
**Meals:**
- Breakfast: Oatmeal with berries (350 kcal)
- Lunch: Grilled chicken salad (450 kcal)
- Dinner: Salmon with sweet potato (500 kcal)

**Main Workout:**
- Warm-up: 5 min mobility
- Squats: 3 sets x 10 reps
- Lunges: 3 sets x 12 reps
- Cool-down: 5 min stretch

## Day 2 - Rest Day
Rest day. Active recovery walking.

## Day 3 - Upper Body
**Main Workout:**
- Bench Press: 3 sets x 10 reps
- Rows: 3 sets x 10 reps

**Meals:**
- Breakfast: Eggs
- Lunch: Turkey wrap
- Dinner: Beef bowl

## Day 4 - Rest Day
Rest day.

## Day 5 - Lower Body
**Meals:**
- Breakfast: Oats
- Lunch: Salad
- Dinner: Fish

**Main Workout:**
- Leg Press: 3 sets x 12 reps
- Calf Raises: 3 sets x 15 reps

## Day 6 - Rest Day
Rest day.

## Day 7 - Rest Day
Rest day.
`
      const parsed = parseAndValidatePlan(fullPlanMealsFirst)
      expect(parsed.success).toBe(true)
      expect(parsed.data?.days).toHaveLength(7)

      // Day 1: Meals first
      const day1 = parsed.data!.days[0]
      expect(day1.workout).toBeDefined()
      expect(day1.workout!.exercises).toHaveLength(2)
      expect(day1.workout!.exercises[0].name).toBe('Squats')
      expect(day1.workout!.exercises[1].name).toBe('Lunges')
      expect(day1.nutrition).toBeDefined()
      expect(day1.nutrition!.breakfast).toContain('Oatmeal')

      // Day 3: Workout first
      const day3 = parsed.data!.days[2]
      expect(day3.workout).toBeDefined()
      expect(day3.workout!.exercises).toHaveLength(2)
      expect(day3.workout!.exercises[0].name).toBe('Bench Press')
      expect(day3.nutrition).toBeDefined()
      expect(day3.nutrition!.breakfast).toBe('Eggs')

      // Day 5: Meals first again
      const day5 = parsed.data!.days[4]
      expect(day5.workout).toBeDefined()
      expect(day5.workout!.exercises).toHaveLength(2)
      expect(day5.workout!.exercises[0].name).toBe('Leg Press')
    })

    it('extractDaySections reliably routes content', () => {
      const content = `**Meals:**
- Breakfast: Toast
**Main Workout:**
- Push-ups: 3 sets x 10 reps
`
      const { workoutText, nutritionText } = extractDaySections(content)
      expect(workoutText).toContain('Push-ups')
      expect(nutritionText).toContain('Breakfast')
    })
  })

  describe('Session Cleanup on Plan Switch', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    afterEach(() => {
      localStorage.clear()
    })

    it('purges active session when clearActiveSession is called', () => {
      const mockSession: WorkoutSession = {
        sessionId: 'test-sess-1',
        planId: 'plan-1',
        dayNumber: 1,
        dayTitle: 'Day 1',
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        status: 'in-progress',
        exercises: [
          {
            exerciseIndex: 0,
            name: 'Squats',
            targetSets: 3,
            targetReps: '10',
            completedSets: [],
            isCompleted: false,
          },
        ],
      }

      saveActiveSession(mockSession)
      expect(loadActiveSession()).not.toBeNull()

      clearActiveSession()
      expect(loadActiveSession()).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })
  })
})
