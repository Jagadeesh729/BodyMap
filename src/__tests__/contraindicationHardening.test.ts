import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  scanPlanForContraindications,
  normalizeExerciseString,
} from '../lib/contraindicationGuard'
import {
  callGeminiWithFormData,
  AllergenSafetyError,
  MedicalContraindicationError,
} from '../lib/gemini'
import { parseAndValidatePlan } from '../lib/planSchema'
import { parseExerciseStringToSessionExercise } from '../lib/exerciseSubstitution'
import type { FormData } from '../types/formData'

describe('Contraindication Hardening & Evasion Resistance', () => {
  describe('Movement Pattern Evasion Resistance Across 8 Categories', () => {
    it('catches Shoulder / Rotator Cuff press variants previously bypassed', () => {
      const shoulderCondition = 'Rotator cuff tear, subacromial impingement right shoulder'
      const bypassedExercises = [
        'Dumbbell Shoulder Press: 3 sets x 10 reps',
        'Barbell Shoulder Press: 4 sets x 8 reps',
        'Seated Shoulder Press: 3 sets x 12 reps',
        'Standing Shoulder Press: 3 sets x 10 reps',
        'Machine Shoulder Press: 3 sets x 12 reps',
        'Kettlebell Shoulder Press: 3 sets x 8 reps',
        'Shoulder Press: 3 sets x 10 reps',
        'Bench Dips: 3 sets x 15 reps',
        'Dips: 3 sets x 10 reps',
      ]

      for (const ex of bypassedExercises) {
        const plan = `## Day 1 - Shoulder Focus\n**Main Workout:**\n- ${ex}\n**Meals:**\n- Lunch: Salad\n`
        const res = scanPlanForContraindications(plan, shoulderCondition)
        expect(res.hasViolation, `Expected "${ex}" to be flagged for rotator cuff`).toBe(true)
        expect(res.violations[0].category).toBe('shoulder_impingement_cuff')
      }
    })

    it('catches Lumbar Disc / Sciatica axial loads previously bypassed', () => {
      const lumbarCondition = 'L5-S1 disc herniation with active sciatica and severe lower back pain'
      const bypassedExercises = [
        'Deadlifts: 3 sets x 5 reps',
        'Barbell Deadlifts: 3 sets x 5 reps',
        'Romanian Deadlifts: 3 sets x 8 reps',
        'Sumo Deadlifts: 3 sets x 6 reps',
        'Stiff-Leg Deadlifts: 3 sets x 8 reps',
        'Back Squats: 4 sets x 8 reps',
        'Barbell Back Squats: 4 sets x 6 reps',
        'Sit-ups: 3 sets x 20 reps',
        'Crunches: 3 sets x 25 reps',
      ]

      for (const ex of bypassedExercises) {
        const plan = `## Day 1 - Strength\n**Main Workout:**\n- ${ex}\n**Meals:**\n- Lunch: Quinoa bowl\n`
        const res = scanPlanForContraindications(plan, lumbarCondition)
        expect(res.hasViolation, `Expected "${ex}" to be flagged for lumbar herniation`).toBe(true)
        expect(res.violations[0].category).toBe('lumbar_disc_herniation')
      }
    })

    it('catches Cardiac / Angina anaerobic sprint and HIIT protocols', () => {
      const cardiacCondition = 'Coronary artery disease, previous myocardial infarction, angina'
      const bypassedExercises = [
        'Sprints: 10 sets x 50m',
        'HIIT: 20 minutes interval circuit',
        'HIIT Cardio: 25 minutes',
        'Tabata Intervals: 8 rounds x 20s work / 10s rest',
        'High-Intensity Interval Training: 30 mins',
      ]

      for (const ex of bypassedExercises) {
        const plan = `## Day 1 - Cardio\n**Main Workout:**\n- ${ex}\n**Meals:**\n- Lunch: Oatmeal\n`
        const res = scanPlanForContraindications(plan, cardiacCondition)
        expect(res.hasViolation, `Expected "${ex}" to be flagged for cardiac condition`).toBe(true)
        expect(res.violations[0].category).toBe('cardiac_symptomatic_condition')
      }
    })

    it('catches Late-Stage Pregnancy contraindicated prone/supine/ballistic exercises', () => {
      const pregnancyCondition = '32 weeks pregnant, third trimester'
      const bypassedExercises = [
        'Superman: 3 sets x 12 reps',
        'Superman Holds: 3 sets x 30s',
        'Flat Bench Press: 3 sets x 10 reps',
        'Supine Leg Raises: 3 sets x 15 reps',
        'Burpees: 4 sets x 12 reps',
        'Crunches: 3 sets x 20 reps',
        'Sit-ups: 3 sets x 15 reps',
      ]

      for (const ex of bypassedExercises) {
        const plan = `## Day 1 - General Fitness\n**Main Workout:**\n- ${ex}\n**Meals:**\n- Lunch: Steamed veggies\n`
        const res = scanPlanForContraindications(plan, pregnancyCondition)
        expect(res.hasViolation, `Expected "${ex}" to be flagged for late pregnancy`).toBe(true)
        expect(res.violations[0].category).toBe('pregnancy_late_stage')
      }
    })

    it('catches Severe Osteoporosis flexion and impact exercises', () => {
      const osteoCondition = 'Severe osteoporosis, vertebral compression fracture history'
      const bypassedExercises = [
        'Russian Twists: 3 sets x 20 reps',
        'Deadlifts: 3 sets x 5 reps',
        'Barbell Deadlifts: 3 sets x 5 reps',
        'Box Jumps: 4 sets x 8 reps',
        'Burpees: 3 sets x 10 reps',
        'Crunches: 3 sets x 15 reps',
      ]

      for (const ex of bypassedExercises) {
        const plan = `## Day 1 - Bone Strength\n**Main Workout:**\n- ${ex}\n**Meals:**\n- Lunch: Greek yogurt\n`
        const res = scanPlanForContraindications(plan, osteoCondition)
        expect(res.hasViolation, `Expected "${ex}" to be flagged for osteoporosis`).toBe(true)
        expect(res.violations[0].category).toBe('severe_osteoporosis')
      }
    })

    it('catches Severe Osteoarthritis ballistic jumping exercises', () => {
      const arthritisCondition = 'Severe osteoarthritis in bilateral knees with joint space narrowing'
      const bypassedExercises = [
        'Squat Jumps: 3 sets x 12 reps',
        'Tuck Jumps: 3 sets x 10 reps',
        'Broad Jumps: 4 sets x 6 reps',
        'Burpees: 3 sets x 12 reps',
      ]

      for (const ex of bypassedExercises) {
        const plan = `## Day 1 - Plyo\n**Main Workout:**\n- ${ex}\n**Meals:**\n- Lunch: Salmon\n`
        const res = scanPlanForContraindications(plan, arthritisCondition)
        expect(res.hasViolation, `Expected "${ex}" to be flagged for severe osteoarthritis`).toBe(true)
        expect(res.violations[0].category).toBe('severe_osteoarthritis')
      }
    })

    it('catches Cervical Spine neck-loading exercises', () => {
      const cervicalCondition = 'Cervical spine disc herniation at C5-C6 with radiculopathy'
      const bypassedExercises = [
        'Handstands: 3 sets x 30s',
        'Handstand Push-ups: 3 sets x 6 reps',
        'Shoulder Stands: 3 sets x 45s',
      ]

      for (const ex of bypassedExercises) {
        const plan = `## Day 1 - Gymnastics\n**Main Workout:**\n- ${ex}\n**Meals:**\n- Lunch: Tofu stirfry\n`
        const res = scanPlanForContraindications(plan, cervicalCondition)
        expect(res.hasViolation, `Expected "${ex}" to be flagged for cervical spine`).toBe(true)
        expect(res.violations[0].category).toBe('cervical_spine_pathology')
      }
    })

    it('catches Knee / ACL ballistic jumps and ropes', () => {
      const kneeCondition = 'ACL reconstruction and lateral meniscus repair'
      const bypassedExercises = [
        'Skater Jumps: 3 sets x 12 reps',
        'Speed Skater Jumps: 3 sets x 10 reps',
        'Jump Rope: 5 minutes continuous',
        'High-Knee Jumps: 3 sets x 15 reps',
      ]

      for (const ex of bypassedExercises) {
        const plan = `## Day 1 - Agility\n**Main Workout:**\n- ${ex}\n**Meals:**\n- Lunch: Chicken breast\n`
        const res = scanPlanForContraindications(plan, kneeCondition)
        expect(res.hasViolation, `Expected "${ex}" to be flagged for knee/ACL`).toBe(true)
        expect(res.violations[0].category).toBe('knee_high_impact')
      }
    })
  })

  describe('Unicode & Zero-Width Evasion Resistance', () => {
    it('normalizes zero-width spaces, soft hyphens, and BOM characters', () => {
      const zeroWidthInputs = [
        'Box \u200bJumps',
        'Box\u200c Jumps',
        'Box\u200d Jumps',
        'Box\u00ad Jumps',
        'Box\u2060 Jumps',
        '\uFEFFBox Jumps',
      ]

      for (const zw of zeroWidthInputs) {
        const normalized = normalizeExerciseString(zw)
        expect(normalized.toLowerCase()).toBe('box jumps')
      }

      // Strips zero-width chars completely from unspaced compound tokens
      expect(normalizeExerciseString('Box\u200bJumps')).toBe('BoxJumps')
    })

    it('decomposes full-width Unicode characters (NFKC)', () => {
      const fullWidth = '\uFF22\uFF4F\uFF58\u3000\uFF2A\uFF55\uFF4D\uFF50\uFF53'
      const normalized = normalizeExerciseString(fullWidth)
      expect(normalized.toLowerCase()).toBe('box jumps')
    })

    it('flags contraindications even when obfuscated with zero-width characters', () => {
      const condition = 'Acute ACL tear'
      // Intra-word zero-width evasion
      const obfuscatedPlan1 = `## Day 1\n**Main Workout:**\n- B\u200bo\u200bx\u200b Jumps: 3 sets x 10 reps\n**Meals:**\n- Lunch: Rice\n`
      const res1 = scanPlanForContraindications(obfuscatedPlan1, condition)
      expect(res1.hasViolation).toBe(true)
      expect(res1.violations[0].category).toBe('knee_high_impact')

      // Boundary zero-width evasion (no space, e.g. Box\u200bJumps)
      const obfuscatedPlan2 = `## Day 1\n**Main Workout:**\n- Box\u200bJumps: 3 sets x 10 reps\n**Meals:**\n- Lunch: Rice\n`
      const res2 = scanPlanForContraindications(obfuscatedPlan2, condition)
      expect(res2.hasViolation).toBe(true)
      expect(res2.violations[0].category).toBe('knee_high_impact')
    })
  })

  describe('Safe Clinical Exemptions Preservation', () => {
    it('allows evidence-based safe rehab exercises for Lumbar condition', () => {
      const lumbarCondition = 'L4-L5 herniation, lower back pain'
      const safePlan = `## Day 1 - Spine-Safe Lower\n**Main Workout:**\n- Goblet Squats: 3 sets x 10 reps\n- Bodyweight Squats: 3 sets x 12 reps\n- Bird-Dog: 3 sets x 10 reps per side\n- Dead Bugs: 3 sets x 10 reps\n- Planks: 3 sets x 45s\n- Pallof Press: 3 sets x 12 reps\n- Glute Bridges: 3 sets x 15 reps\n**Meals:**\n- Lunch: Salmon & greens\n`
      const res = scanPlanForContraindications(safePlan, lumbarCondition)
      expect(res.hasViolation).toBe(false)
    })

    it('allows safe chest, arm, and posture movements for Shoulder condition', () => {
      const shoulderCondition = 'Subacromial impingement syndrome'
      const safePlan = `## Day 1 - Upper Push\n**Main Workout:**\n- Bench Press: 3 sets x 10 reps\n- Push-ups: 3 sets x 12 reps\n- Bicep Curls: 3 sets x 12 reps\n- Hammer Curls: 3 sets x 12 reps\n- Face Pulls: 3 sets x 15 reps\n- External Rotations: 3 sets x 15 reps\n**Meals:**\n- Lunch: Chicken salad\n`
      const res = scanPlanForContraindications(safePlan, shoulderCondition)
      expect(res.hasViolation).toBe(false)
    })

    it('allows safe non-impact cardio and knee rehab exercises', () => {
      const kneeCondition = 'Meniscus tear right knee'
      const safePlan = `## Day 1 - Knee Rehab\n**Main Workout:**\n- Box Squats: 3 sets x 10 reps\n- Bodyweight Squats: 3 sets x 12 reps\n- Wall Sits: 3 sets x 30s\n- Step-ups: 3 sets x 10 reps\n- Glute Bridges: 3 sets x 15 reps\n- Straight-Leg Raises: 3 sets x 12 reps\n- Stationary Cycling: 20 minutes\n- Swimming: 20 minutes\n**Meals:**\n- Lunch: Turkey wrap\n`
      const res = scanPlanForContraindications(safePlan, kneeCondition)
      expect(res.hasViolation).toBe(false)
    })
  })

  describe('Client Pre-Acceptance Safety Firewall (callGeminiWithFormData)', () => {
    const baseFormData: FormData = {
      age: '30',
      gender: 'Male',
      height: '180',
      weight: '80',
      fitnessLevel: 'Intermediate',
      mainGoal: 'Build Muscle',
      bodyFocus: ['Full Body'],
      timePerDay: '45',
      medicalIssues: 'Rotator cuff impingement, right shoulder',
      equipment: ['Dumbbells'],
      pushupCount: '20',
      dietaryPreference: 'Balanced',
      allergies: 'Peanuts, Tree nuts',
      specialRequests: '',
      recoveryDays: '2',
      sleepHours: '8',
      stressLevel: 'Low',
    }

    const valid7DayPlan = `
## Day 1 - Chest & Core
**Warm-up:** 5 mins dynamic stretching
**Main Workout:**
- Push-ups: 3 sets x 12 reps
- Dumbbell Rows: 3 sets x 10 reps
**Cool-down:** 5 mins stretch
**Meals:**
- Breakfast: Oatmeal with berries (350 kcal)
- Lunch: Grilled chicken quinoa bowl (500 kcal)
- Dinner: Salmon with asparagus (550 kcal)
- Snacks: Greek yogurt (200 kcal)

## Day 2 - Rest & Recovery
**Warm-up:** 5 mins walking
**Main Workout:**
- Rest Day: Active recovery walk
**Cool-down:** 5 mins stretching
**Meals:**
- Breakfast: Scrambled eggs on toast (350 kcal)
- Lunch: Turkey wrap (450 kcal)
- Dinner: Lean beef with sweet potato (500 kcal)
- Snacks: Apple slices (100 kcal)

## Day 3 - Lower Body
**Warm-up:** 5 mins light cycling
**Main Workout:**
- Goblet Squats: 3 sets x 10 reps
- Glute Bridges: 3 sets x 12 reps
**Cool-down:** 5 mins stretch
**Meals:**
- Breakfast: Berry smoothie (350 kcal)
- Lunch: Quinoa salad (450 kcal)
- Dinner: Cod with broccoli (500 kcal)
- Snacks: Carrot sticks & hummus (150 kcal)

## Day 4 - Rest & Mobility
**Warm-up:** 5 mins mobility
**Main Workout:**
- Rest Day: Gentle yoga
**Cool-down:** 5 mins relaxation
**Meals:**
- Breakfast: Oatmeal (350 kcal)
- Lunch: Lentil soup (450 kcal)
- Dinner: Tofu stir fry (500 kcal)
- Snacks: Pear (100 kcal)

## Day 5 - Back & Biceps
**Warm-up:** 5 mins arm swings
**Main Workout:**
- Dumbbell Rows: 3 sets x 10 reps
- Bicep Curls: 3 sets x 12 reps
**Cool-down:** 5 mins stretch
**Meals:**
- Breakfast: Eggs & spinach (350 kcal)
- Lunch: Chicken salad (500 kcal)
- Dinner: Halibut with rice (550 kcal)
- Snacks: Cottage cheese (150 kcal)

## Day 6 - Core & Conditioning
**Warm-up:** 5 mins jogging
**Main Workout:**
- Planks: 3 sets x 45s
- Dead Bugs: 3 sets x 10 reps
**Cool-down:** 5 mins stretch
**Meals:**
- Breakfast: Protein shake (350 kcal)
- Lunch: Turkey salad (450 kcal)
- Dinner: Chicken stir fry (500 kcal)
- Snacks: Orange (100 kcal)

## Day 7 - Active Rest
**Warm-up:** 5 mins walking
**Main Workout:**
- Rest Day: Nature walk
**Cool-down:** 5 mins stretch
**Meals:**
- Breakfast: Fruit bowl (300 kcal)
- Lunch: Tuna salad (450 kcal)
- Dinner: Roast turkey with veggies (500 kcal)
- Snacks: Berries (100 kcal)
`

    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
      originalFetch = globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
      vi.restoreAllMocks()
    })

    it('rejects a 200 OK plan containing contraindicated exercises at client acceptance boundary', async () => {
      const unsafePlan = valid7DayPlan.replace('Push-ups: 3 sets x 12 reps', 'Dumbbell Shoulder Press: 4 sets x 10 reps')

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ plan: unsafePlan }),
      } as Response)

      await expect(callGeminiWithFormData(baseFormData)).rejects.toThrow(MedicalContraindicationError)
    })

    it('rejects a 200 OK plan containing declared allergens at client acceptance boundary', async () => {
      const allergenPlan = valid7DayPlan.replace('Oatmeal with berries', 'Oatmeal with peanut butter and crushed peanuts')

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ plan: allergenPlan }),
      } as Response)

      await expect(callGeminiWithFormData(baseFormData)).rejects.toThrow(AllergenSafetyError)
    })

    it('rejects a 200 OK plan failing structural standards', async () => {
      const malformedPlan = 'This is a plan with some text but completely lacks proper Day headers and meals.'

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ plan: malformedPlan }),
      } as Response)

      await expect(callGeminiWithFormData(baseFormData)).rejects.toThrow(
        /Generated plan does not meet structural quality standards/
      )
    })

    it('accepts and returns a safe, structurally valid, allergen-clean, contraindication-clean plan', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ plan: valid7DayPlan }),
      } as Response)

      const result = await callGeminiWithFormData(baseFormData)
      expect(result).toBe(valid7DayPlan)
    })
  })

  describe('Robust Numbered and Bullet List Parsing', () => {
    it('parses numbered lists (1., 2., 3.) into exercise objects in planSchema', () => {
      const planWithNumberedList = `
## Day 1 - Full Body
**Warm-up:** 5 mins arm circles
**Main Workout:**
1. Dumbbell Goblet Squats: 3 sets x 10 reps (60s rest)
2. Push-ups: 3 sets x 12 reps (45s rest)
3. Dumbbell Rows: 3 sets x 10 reps (60s rest)
**Cool-down:** 5 mins stretching
**Meals:**
- Breakfast: Oatmeal (350 kcal)
- Lunch: Salad (450 kcal)
- Dinner: Salmon (500 kcal)

## Day 2 - Rest Day
**Warm-up:** Walk
**Main Workout:**
- Rest Day
**Cool-down:** Stretch
**Meals:**
- Breakfast: Eggs (350 kcal)
- Lunch: Wrap (450 kcal)
- Dinner: Beef (500 kcal)

## Day 3 - Full Body
**Warm-up:** Walk
**Main Workout:**
1) Goblet Squats: 3 sets x 10 reps
2) Dumbbell Rows: 3 sets x 10 reps
**Cool-down:** Stretch
**Meals:**
- Breakfast: Eggs (350 kcal)
- Lunch: Wrap (450 kcal)
- Dinner: Beef (500 kcal)

## Day 4 - Rest Day
**Warm-up:** Walk
**Main Workout:**
- Rest Day
**Cool-down:** Stretch
**Meals:**
- Breakfast: Eggs (350 kcal)
- Lunch: Wrap (450 kcal)
- Dinner: Beef (500 kcal)

## Day 5 - Full Body
**Warm-up:** Walk
**Main Workout:**
• Dumbbell Rows: 3 sets x 10 reps
• Push-ups: 3 sets x 12 reps
**Cool-down:** Stretch
**Meals:**
- Breakfast: Eggs (350 kcal)
- Lunch: Wrap (450 kcal)
- Dinner: Beef (500 kcal)

## Day 6 - Rest Day
**Warm-up:** Walk
**Main Workout:**
- Rest Day
**Cool-down:** Stretch
**Meals:**
- Breakfast: Eggs (350 kcal)
- Lunch: Wrap (450 kcal)
- Dinner: Beef (500 kcal)

## Day 7 - Rest Day
**Warm-up:** Walk
**Main Workout:**
- Rest Day
**Cool-down:** Stretch
**Meals:**
- Breakfast: Eggs (350 kcal)
- Lunch: Wrap (450 kcal)
- Dinner: Beef (500 kcal)
`
      const parsed = parseAndValidatePlan(planWithNumberedList, true)
      expect(parsed.success).toBe(true)
      expect(parsed.data?.days[0].workout?.exercises.length).toBe(3)
      expect(parsed.data?.days[0].workout?.exercises[0].name).toBe('Dumbbell Goblet Squats')
      expect(parsed.data?.days[0].workout?.exercises[0].sets).toBe('3')
      expect(parsed.data?.days[0].workout?.exercises[0].reps).toBe('10')

      // Day 3 (parenthesis numbered)
      expect(parsed.data?.days[2].workout?.exercises.length).toBe(2)
      expect(parsed.data?.days[2].workout?.exercises[0].name).toBe('Goblet Squats')

      // Day 5 (Unicode bullet •)
      expect(parsed.data?.days[4].workout?.exercises.length).toBe(2)
      expect(parsed.data?.days[4].workout?.exercises[0].name).toBe('Dumbbell Rows')
    })

    it('parseExerciseStringToSessionExercise cleanly strips numbered prefixes for Gym Mode', () => {
      const ex1 = parseExerciseStringToSessionExercise('1. Dumbbell Shoulder Press: 3 sets x 10 reps (60s rest)', 0)
      expect(ex1.name).toBe('Dumbbell Shoulder Press')
      expect(ex1.targetSets).toBe(3)
      expect(ex1.targetReps).toBe('10 reps')

      const ex2 = parseExerciseStringToSessionExercise('2) Barbell Back Squats: 4 sets x 8 reps (90s rest)', 1)
      expect(ex2.name).toBe('Barbell Back Squats')
      expect(ex2.targetSets).toBe(4)

      const ex3 = parseExerciseStringToSessionExercise('• Seated Cable Rows: 3 sets x 12 reps (60s rest)', 2)
      expect(ex3.name).toBe('Seated Cable Rows')
      expect(ex3.targetSets).toBe(3)
    })
  })
})
