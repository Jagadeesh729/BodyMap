import { describe, it, expect } from 'vitest'
import {
  parseCanonicalExerciseLine,
} from '@/lib/canonicalExerciseParser'
import {
  scanPlanForContraindications as clientScanPlanForContraindications,
} from '@/lib/contraindicationGuard'
import {
  scanPlanForContraindications as serverScanPlanForContraindications,
} from '../../api/generate-plan'
import { parseAndValidatePlan } from '@/lib/planSchema'
import { parseExerciseStringToSessionExercise } from '@/lib/exerciseSubstitution'

describe('Canonical Exercise Representation & Scanner-Runtime Parity Suite', () => {
  describe('Invariant 1 & 2: Compound Exercise Isolation (unsafe + safe => BLOCK)', () => {
    const delimiters = [
      { label: '& (ampersand)', token: '&' },
      { label: '&& (double ampersand)', token: '&&' },
      { label: '+ (plus)', token: '+' },
      { label: '/ (slash)', token: '/' },
      { label: '; (semicolon)', token: ';' },
      { label: '| (pipe)', token: '|' },
      { label: '— (em-dash)', token: '—' },
      { label: '-- (double hyphen)', token: '--' },
      { label: 'paired with', token: 'paired with' },
      { label: 'followed by', token: 'followed by' },
      { label: 'then', token: 'then' },
      { label: 'alternating with', token: 'alternating with' },
      { label: 'superset with', token: 'superset with' },
      { label: 'combined with', token: 'combined with' },
    ]

    for (const d of delimiters) {
      it(`blocks safe + forbidden connected by "${d.label}" on multi-colon line`, () => {
        const plan = `## Day 1 - Lower
### Main Workout:
- Step-ups: 3 sets x 12 reps ${d.token} Box jumps: 3 sets x 10 reps
### Meals:
Breakfast: Eggs
Lunch: Chicken
Dinner: Fish
`
        const clientRes = clientScanPlanForContraindications(plan, 'patellar tendinopathy')
        const serverRes = serverScanPlanForContraindications(plan, 'patellar tendinopathy')

        expect(clientRes.hasViolation).toBe(true)
        expect(serverRes.hasViolation).toBe(true)
        expect(clientRes.violations[0].category).toBe('knee_high_impact')
        expect(serverRes.violations[0].category).toBe('knee_high_impact')

        // Runtime parser parity: both exercises must be preserved in structured plan
        const parsed = parseAndValidatePlan(plan, false)
        expect(parsed.success).toBe(true)
        expect(parsed.data?.days[0].workout?.exercises.length).toBe(2)
        expect(parsed.data?.days[0].workout?.exercises[0].name).toBe('Step-ups')
        expect(parsed.data?.days[0].workout?.exercises[1].name).toBe('Box jumps')
      })

      it(`blocks safe + forbidden connected by "${d.label}" on single-colon shared prescription`, () => {
        const plan = `## Day 1 - Lower
### Main Workout:
- Step-ups ${d.token} Box jumps: 3 sets x 10 reps
### Meals:
Breakfast: Eggs
Lunch: Chicken
Dinner: Fish
`
        const clientRes = clientScanPlanForContraindications(plan, 'patellar tendinopathy')
        const serverRes = serverScanPlanForContraindications(plan, 'patellar tendinopathy')

        expect(clientRes.hasViolation).toBe(true)
        expect(serverRes.hasViolation).toBe(true)

        // Runtime parser parity: both exercises present and share sets/reps
        const parsed = parseAndValidatePlan(plan, false)
        expect(parsed.success).toBe(true)
        expect(parsed.data?.days[0].workout?.exercises.length).toBe(2)
        expect(parsed.data?.days[0].workout?.exercises[0].sets).toBe('3')
        expect(parsed.data?.days[0].workout?.exercises[1].sets).toBe('3')
      })

      it(`blocks forbidden + safe connected by "${d.label}"`, () => {
        const plan = `## Day 1 - Upper
### Main Workout:
- Overhead press: 3 sets x 8 reps ${d.token} Bench press: 3 sets x 8 reps
### Meals:
Breakfast: Eggs
Lunch: Chicken
Dinner: Fish
`
        const clientRes = clientScanPlanForContraindications(plan, 'rotator cuff tear')
        const serverRes = serverScanPlanForContraindications(plan, 'rotator cuff tear')

        expect(clientRes.hasViolation).toBe(true)
        expect(serverRes.hasViolation).toBe(true)
      })
    }

    it('blocks safe(A) + unsafe(B) + safe(C) triple compound lines', () => {
      const plan = `## Day 1 - Posterior
### Main Workout:
- Planks: 3 sets x 60s & Romanian deadlifts: 3 sets x 10 reps & Glute bridges: 3 sets x 15 reps
### Meals:
Breakfast: Eggs
Lunch: Chicken
Dinner: Fish
`
      const clientRes = clientScanPlanForContraindications(plan, 'sciatica lumbar disc herniation')
      const serverRes = serverScanPlanForContraindications(plan, 'sciatica lumbar disc herniation')

      expect(clientRes.hasViolation).toBe(true)
      expect(serverRes.hasViolation).toBe(true)
      expect(clientRes.violations[0].category).toBe('lumbar_disc_herniation')

      // All 3 exercises survive in runtime
      const parsed = parseAndValidatePlan(plan, false)
      expect(parsed.success).toBe(true)
      expect(parsed.data?.days[0].workout?.exercises.length).toBe(3)
      expect(parsed.data?.days[0].workout?.exercises[0].name).toBe('Planks')
      expect(parsed.data?.days[0].workout?.exercises[1].name).toBe('Romanian deadlifts')
      expect(parsed.data?.days[0].workout?.exercises[2].name).toBe('Glute bridges')
    })
  })

  describe('Invariant 3 & 4: Notes and Substitution Target Non-Contamination', () => {
    it('allows safe exercise with forbidden target in parenthetical note (note only)', () => {
      const plan = `## Day 1 - Upper
### Main Workout:
- Dumbbell Bench Press: 3 sets x 8 reps (replacing overhead press due to shoulder impingement)
### Meals:
Breakfast: Eggs
Lunch: Chicken
Dinner: Fish
`
      const clientRes = clientScanPlanForContraindications(plan, 'rotator cuff tear')
      const serverRes = serverScanPlanForContraindications(plan, 'rotator cuff tear')

      expect(clientRes.hasViolation).toBe(false)
      expect(serverRes.hasViolation).toBe(false)

      const parsed = parseAndValidatePlan(plan, false)
      expect(parsed.success).toBe(true)
      expect(parsed.data?.days[0].workout?.exercises.length).toBe(1)
      expect(parsed.data?.days[0].workout?.exercises[0].name).toBe('Dumbbell Bench Press')
    })

    it('allows safe exercise with forbidden target in semicolon note', () => {
      const plan = `## Day 1 - Lower
### Main Workout:
- Dumbbell Goblet Squats: 3 sets x 10 reps; alternative to back squats
### Meals:
Breakfast: Eggs
Lunch: Chicken
Dinner: Fish
`
      const clientRes = clientScanPlanForContraindications(plan, 'lumbar radiculopathy')
      const serverRes = serverScanPlanForContraindications(plan, 'lumbar radiculopathy')

      expect(clientRes.hasViolation).toBe(false)
      expect(serverRes.hasViolation).toBe(false)

      const parsed = parseAndValidatePlan(plan, false)
      expect(parsed.success).toBe(true)
      expect(parsed.data?.days[0].workout?.exercises.length).toBe(1)
      expect(parsed.data?.days[0].workout?.exercises[0].name).toBe('Dumbbell Goblet Squats')
    })

    it('strictly blocks when an unexempted forbidden exercise accompanies a note-containing safe exercise', () => {
      const plan = `## Day 1 - Upper
### Main Workout:
- Bench press (replacing barbell overhead press): 3 sets x 8 reps & Overhead press: 3 sets x 8 reps
### Meals:
Breakfast: Eggs
Lunch: Chicken
Dinner: Fish
`
      const clientRes = clientScanPlanForContraindications(plan, 'rotator cuff tear')
      const serverRes = serverScanPlanForContraindications(plan, 'rotator cuff tear')

      expect(clientRes.hasViolation).toBe(true)
      expect(serverRes.hasViolation).toBe(true)
    })
  })

  describe('Invariant 5 & 6: Scanner & Runtime Parser Identity Agreement', () => {
    it('guarantees identical count and normalized names between canonical parser and runtime session parser', () => {
      const testLines = [
        '- Push-ups: 3 sets x 12 reps (60s rest)',
        '- Step-ups: 3 sets x 12 reps & Box jumps: 3 sets x 10 reps',
        '- Bird-dog: 3 sets x 10 reps + Glute bridges: 3 sets x 15 reps',
        '1. Exercise 1: Incline Dumbbell Bench Press: 3 sets x 10 reps / Lateral Raises: 3 sets x 15 reps',
        '- Planks: 3 sets x 60s, Glute bridges: 3 sets x 15 reps, Romanian deadlifts: 3 sets x 10 reps',
        '- Clean and press: 3 sets x 5 reps',
        '- Clean & jerk: 3 sets x 5 reps',
        '- Back extensions with weight: 3 sets x 10 reps',
        '- Planks with shoulder taps: 3 sets x 10 reps',
        '- Bodyweight squats: 3 sets x 15 reps',
      ]

      for (const line of testLines) {
        const canonicals = parseCanonicalExerciseLine(line)
        expect(canonicals.length).toBeGreaterThan(0)

        // Parse through plan schema
        const planMarkdown = `## Day 1\n### Main Workout:\n${line}\n### Meals:\nBreakfast: Eggs\nLunch: Rice\nDinner: Salad\n`
        const parsedPlan = parseAndValidatePlan(planMarkdown, false)
        expect(parsedPlan.success).toBe(true)
        const runtimeExercises = parsedPlan.data?.days[0].workout?.exercises || []

        // Invariant: Count must match exactly
        expect(runtimeExercises.length).toBe(canonicals.length)

        // Invariant: Names and prescriptions must match
        for (let i = 0; i < canonicals.length; i++) {
          expect(runtimeExercises[i].name.toLowerCase()).toBe(canonicals[i].name.toLowerCase())
          if (canonicals[i].sets) {
            expect(runtimeExercises[i].sets).toBe(canonicals[i].sets)
          }

          // Test through SessionExercise creator
          const sessionEx = parseExerciseStringToSessionExercise(
            `${runtimeExercises[i].name}${runtimeExercises[i].sets ? `: ${runtimeExercises[i].sets} sets` : ''}`,
            i
          )
          expect(sessionEx.name.toLowerCase()).toBe(canonicals[i].name.toLowerCase())
        }
      }
    })
  })

  describe('Invariant 7: Client and Server Guard Parity', () => {
    it('produces identical violation detection across client and server on adversarial cases', () => {
      const testCases = [
        {
          name: 'Patellar Tendinopathy - Ampersand compound',
          medical: 'patellar tendinopathy',
          plan: '## Day 1\n### Main Workout:\n- Step-ups: 3x12 & Box jumps: 3x10\n',
        },
        {
          name: 'Rotator Cuff - Paired with compound',
          medical: 'rotator cuff tear',
          plan: '## Day 1\n### Main Workout:\n- Bench press: 3x8 paired with Overhead press: 3x8\n',
        },
        {
          name: 'Lumbar Herniation - Olympic clean & press',
          medical: 'l5-s1 disc herniation',
          plan: '## Day 1\n### Main Workout:\n- Clean and press: 3 sets x 5 reps\n',
        },
        {
          name: 'Safe Exemption - Incline dumbbell bench press',
          medical: 'shoulder impingement',
          plan: '## Day 1\n### Main Workout:\n- Incline dumbbell bench press: 3 sets x 10 reps\n',
        },
        {
          name: 'Safe Exemption - Bodyweight squats',
          medical: 'knee acl tear',
          plan: '## Day 1\n### Main Workout:\n- Bodyweight squats: 3 sets x 15 reps\n',
        },
        {
          name: 'Cardiac - Walking & HIIT Tabata',
          medical: 'angina heart attack',
          plan: '## Day 1\n### Main Workout:\n- Walking: 20 mins & HIIT sprints: 10 sets x 30s\n',
        },
        {
          name: 'Cervical Spine - Chin tucks & Behind-the-neck press',
          medical: 'cervical spine disc herniation',
          plan: '## Day 1\n### Main Workout:\n- Chin tucks: 3 sets x 10 reps & Behind-the-neck press: 3 sets x 8 reps\n',
        }
      ]

      for (const tc of testCases) {
        const clientRes = clientScanPlanForContraindications(tc.plan, tc.medical)
        const serverRes = serverScanPlanForContraindications(tc.plan, tc.medical)

        expect(clientRes.hasViolation).toBe(serverRes.hasViolation)
        expect(clientRes.violations.length).toBe(serverRes.violations.length)

        if (clientRes.violations.length > 0) {
          expect(clientRes.violations[0].category).toBe(serverRes.violations[0].category)
          expect(clientRes.violations[0].matchedExercise).toBe(serverRes.violations[0].matchedExercise)
        }
      }
    })
  })
})
