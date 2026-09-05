import { describe, it, expect } from 'vitest'
import {
  scanPlanForContraindications,
  isPrescriptiveExerciseLine,
  CONTRAINDICATION_TAXONOMY,
} from '../lib/contraindicationGuard'
import { parseExerciseStringToSessionExercise } from '../lib/exerciseSubstitution'
import { parseAndValidatePlan } from '../lib/planSchema'
import {
  scanPlanForContraindications as serverScanPlanForContraindications,
  isPrescriptiveExerciseLine as serverIsPrescriptiveExerciseLine,
  CONTRAINDICATION_TAXONOMY as SERVER_CONTRAINDICATION_TAXONOMY,
} from '../../api/generate-plan'

describe('Semantic & Acronym Hardening Suite (Red-Team Audit)', () => {
  describe('T1: Parenthetical Substitution Exemption Trap Neutralization', () => {
    it('catches dangerous exercises disguised behind labeled item prefixes and irrelevant substitution notes', () => {
      const planA = `## Day 1
**Main Workout:**
- Exercise 1: Box Jumps: 4 sets x 15 reps (substitute for outdoor running)
`
      const scanA = scanPlanForContraindications(planA, 'acl tear')
      expect(scanA.hasViolation).toBe(true)
      expect(scanA.violations.length).toBe(1)
      expect(scanA.violations[0].category).toBe('knee_high_impact')

      const planB = `## Day 1
**Main Workout:**
- Station A: Romanian Deadlifts: 3 sets x 10 reps (replaces kettlebell swings)
`
      const scanB = scanPlanForContraindications(planB, 'disc herniation')
      expect(scanB.hasViolation).toBe(true)
      expect(scanB.violations.length).toBe(1)
      expect(scanB.violations[0].category).toBe('lumbar_disc_herniation')

      const planC = `## Day 1
**Main Workout:**
- Circuit 1: Overhead Press: 3 sets x 10 reps (alternative to pushups)
`
      const scanC = scanPlanForContraindications(planC, 'rotator cuff repair')
      expect(scanC.hasViolation).toBe(true)
      expect(scanC.violations.length).toBe(1)
      expect(scanC.violations[0].category).toBe('shoulder_impingement_cuff')

      const planD = `## Day 1
**Main Workout:**
- Superset: Burpees: 4 sets x 20 reps (instead of jumping rope)
`
      const scanD = scanPlanForContraindications(planD, 'meniscus surgery')
      expect(scanD.hasViolation).toBe(true)
      expect(scanD.violations.length).toBe(1)
      expect(scanD.violations[0].category).toBe('knee_high_impact')
    })

    it('preserves legitimate clinical safe alternatives where the contraindicated pattern is explicitly what is avoided', () => {
      const safePlan1 = `## Day 1
**Main Workout:**
- Step-ups: 3 sets x 12 reps (safe alternative to box jumps)
- Bodyweight Squats: 3 sets x 15 reps (joint-friendly knee option)
`
      const scan1 = scanPlanForContraindications(safePlan1, 'knee reconstruction')
      expect(scan1.hasViolation).toBe(false)
      expect(scan1.violations.length).toBe(0)

      const safePlan2 = `## Day 1
**Main Workout:**
- Glute Bridges: 3 sets x 15 reps (substitute for deadlifts)
- Bird-Dog: 3 sets x 10 reps (safe for lower back)
`
      const scan2 = scanPlanForContraindications(safePlan2, 'l5-s1 disc herniation')
      expect(scan2.hasViolation).toBe(false)
      expect(scan2.violations.length).toBe(0)

      const safePlan3 = `## Day 1
**Main Workout:**
- Incline Dumbbell Bench Press: 3 sets x 10 reps (safe alternative to overhead press)
- External Rotations: 3 sets x 15 reps
`
      const scan3 = scanPlanForContraindications(safePlan3, 'shoulder impingement')
      expect(scan3.hasViolation).toBe(false)
      expect(scan3.violations.length).toBe(0)

      const safePlan4 = `## Day 1
**Main Workout:**
- Dumbbell Goblet Squats: 3 sets x 10 reps; alternative to back squats
`
      const scan4 = scanPlanForContraindications(safePlan4, 'lumbar radiculopathy')
      expect(scan4.hasViolation).toBe(false)
      expect(scan4.violations.length).toBe(0)
    })

    it('blocks adversarial self-exemption and dual-contraindication traps', () => {
      // Trying to exempt itself by putting its own name in the substitution note
      const selfExempt = `- Box Jumps: 4 sets x 15 reps (substitute for box jumps)`
      const boxJumpPattern = /\b(?:box|depth|tuck|jump|squat|split|broad|hurdle)[- ]*jumps?\b/i
      const res = isPrescriptiveExerciseLine(selfExempt, boxJumpPattern)
      expect(res.isPrescription).toBe(true)

      // Dual-contraindicated trap: substituting one forbidden lift with another forbidden lift
      const dualTrap = `## Day 1
**Main Workout:**
- Romanian Deadlifts: 3 sets x 8 reps (substitute for conventional deadlifts)
`
      const dualScan = scanPlanForContraindications(dualTrap, 'sciatica')
      expect(dualScan.hasViolation).toBe(true)
    })

    it('correctly handles avoid clauses prefixed with labeled items', () => {
      const avoidLine = `- Exercise 1: Avoid Box Jumps: do not perform under any circumstances`
      const boxJumpPattern = /\b(?:box|depth|tuck|jump|squat|split|broad|hurdle)[- ]*jumps?\b/i
      const res = isPrescriptiveExerciseLine(avoidLine, boxJumpPattern)
      expect(res.isPrescription).toBe(false)
    })
  })

  describe('T2: Universal Gym Acronym & Compound Pattern Protection', () => {
    it('detects RDL, Dumbbell RDL, and Barbell RDLs for lumbar disc herniation and severe osteoporosis', () => {
      const rdlPlan = `## Day 1
**Main Workout:**
- Dumbbell RDL: 3 sets x 10 reps
- Barbell RDLs: 4 sets x 8 reps
- Single-Leg RDL: 3 sets x 10 reps
`
      const discScan = scanPlanForContraindications(rdlPlan, 'disc herniation')
      expect(discScan.hasViolation).toBe(true)
      expect(discScan.violations.length).toBeGreaterThanOrEqual(3)

      const osteoScan = scanPlanForContraindications(rdlPlan, 'severe osteoporosis')
      expect(osteoScan.hasViolation).toBe(true)
      expect(osteoScan.violations.length).toBeGreaterThanOrEqual(3)
    })

    it('detects OHP, Standing OHP, and Barbell OHP for rotator cuff tears and impingement', () => {
      const ohpPlan = `## Day 1
**Main Workout:**
- Standing OHP: 3 sets x 8 reps
- Barbell OHP: 4 sets x 6 reps
- Seated Dumbbell OHP: 3 sets x 10 reps
`
      const shoulderScan = scanPlanForContraindications(ohpPlan, 'rotator cuff tear')
      expect(shoulderScan.hasViolation).toBe(true)
      expect(shoulderScan.violations.length).toBeGreaterThanOrEqual(3)
    })

    it('detects HSPU (Handstand Push-ups) for cervical spine pathology and rotator cuff issues', () => {
      const hspuPlan = `## Day 1
**Main Workout:**
- Strict HSPU: 3 sets x 5 reps
- Deficit HSPUs: 3 sets x 5 reps
`
      const neckScan = scanPlanForContraindications(hspuPlan, 'cervical disc herniation')
      expect(neckScan.hasViolation).toBe(true)
      expect(neckScan.violations.length).toBeGreaterThanOrEqual(2)

      const cuffScan = scanPlanForContraindications(hspuPlan, 'subacromial impingement')
      expect(cuffScan.hasViolation).toBe(true)
      expect(cuffScan.violations.length).toBeGreaterThanOrEqual(2)
    })

    it('detects Clean & Jerk with ampersand and C&J abbreviation for lumbar conditions', () => {
      const cjPlan = `## Day 1
**Main Workout:**
- Clean & Jerk: 3 sets x 3 reps
- Barbell C&J: 3 sets x 2 reps
`
      const cjScan = scanPlanForContraindications(cjPlan, 'slipped disc')
      expect(cjScan.hasViolation).toBe(true)
      expect(cjScan.violations.length).toBeGreaterThanOrEqual(2)
    })

    it('detects Double Unders for knee high-impact pathology', () => {
      const duPlan = `## Day 1
**Main Workout:**
- Double Unders: 4 sets x 50 reps
`
      const duScan = scanPlanForContraindications(duPlan, 'patellar tendinitis')
      expect(duScan.hasViolation).toBe(true)
      expect(duScan.violations.length).toBe(1)
    })
  })

  describe('T3: Executable-Representation Integrity for Labeled Items', () => {
    it('parseExerciseStringToSessionExercise cleanly extracts exercise name and sets/reps from labeled items', () => {
      const ex1 = parseExerciseStringToSessionExercise(
        'Exercise 1: Dumbbell Shoulder Press: 3 sets x 10 reps (60s rest)',
        0
      )
      expect(ex1.name).toBe('Dumbbell Shoulder Press')
      expect(ex1.targetSets).toBe(3)
      expect(ex1.targetReps).toBe('10 reps')
      expect(ex1.restSeconds).toBe(60)

      const ex2 = parseExerciseStringToSessionExercise(
        'Station A: Romanian Deadlifts: 4 sets x 8 reps (90s rest)',
        1
      )
      expect(ex2.name).toBe('Romanian Deadlifts')
      expect(ex2.targetSets).toBe(4)
      expect(ex2.targetReps).toBe('8 reps')
      expect(ex2.restSeconds).toBe(90)

      const ex3 = parseExerciseStringToSessionExercise(
        'Circuit 2: Barbell Back Squats: 5 sets x 5 reps (120s rest)',
        2
      )
      expect(ex3.name).toBe('Barbell Back Squats')
      expect(ex3.targetSets).toBe(5)
      expect(ex3.targetReps).toBe('5 reps')
      expect(ex3.restSeconds).toBe(120)
    })

    it('parseAndValidatePlan extracts real exercise names from labeled markdown without representation loss', () => {
      const markdown = `## Day 1
**Main Workout:**
- Exercise 1: Push-ups: 3 sets x 15 reps
- Station 2: Goblet Squats: 4 sets x 10 reps
- Movement 3: Plank: 3 sets x 60s
**Meals:**
- Breakfast: Oatmeal
`
      const parsed = parseAndValidatePlan(markdown, false)
      expect(parsed.success).toBe(true)
      if (parsed.success && parsed.data) {
        const exercises = parsed.data.days[0].workout.exercises
        expect(exercises[0].name).toBe('Push-ups')
        expect(exercises[0].sets).toBe('3')
        expect(exercises[0].reps).toBe('15')
        expect(exercises[1].name).toBe('Goblet Squats')
        expect(exercises[1].sets).toBe('4')
        expect(exercises[1].reps).toBe('10')
        expect(exercises[2].name).toBe('Plank')
      }
    })
  })

  describe('T4: Client and Server Implementation Parity', () => {
    it('server contraindication scanner produces identical violation results to client scanner', () => {
      const testCases = [
        { plan: '## Day 1\n**Main Workout:**\n- Exercise 1: Box Jumps: 4 sets x 15 reps (substitute for outdoor running)', med: 'knee injury' },
        { plan: '## Day 1\n**Main Workout:**\n- Station A: Dumbbell RDL: 3 sets x 10 reps (replaces kettlebell swings)', med: 'sciatica' },
        { plan: '## Day 1\n**Main Workout:**\n- Circuit 1: Barbell OHP: 3 sets x 8 reps (alternative to pushups)', med: 'rotator cuff tear' },
        { plan: '## Day 1\n**Main Workout:**\n- Step-ups: 3 sets x 12 reps (safe alternative to box jumps)', med: 'knee surgery' },
        { plan: '## Day 1\n**Main Workout:**\n- Strict HSPU: 3 sets x 5 reps', med: 'cervical disc' },
        { plan: '## Day 1\n**Main Workout:**\n- Double Unders: 4 sets x 50 reps', med: 'acl tear' },
      ]

      for (const tc of testCases) {
        const clientResult = scanPlanForContraindications(tc.plan, tc.med)
        const serverResult = serverScanPlanForContraindications(tc.plan, tc.med)

        expect(clientResult.hasViolation).toBe(serverResult.hasViolation)
        expect(clientResult.violations.length).toBe(serverResult.violations.length)
        if (clientResult.violations.length > 0) {
          expect(clientResult.violations[0].category).toBe(serverResult.violations[0].category)
          expect(clientResult.violations[0].matchedExercise).toBe(serverResult.violations[0].matchedExercise)
        }
      }
    })

    it('taxonomy configurations between client and server have identical keys and severity', () => {
      const clientKeys = Object.keys(CONTRAINDICATION_TAXONOMY).sort()
      const serverKeys = Object.keys(SERVER_CONTRAINDICATION_TAXONOMY).sort()
      expect(clientKeys).toEqual(serverKeys)

      for (const key of clientKeys) {
        const cConfig = CONTRAINDICATION_TAXONOMY[key as keyof typeof CONTRAINDICATION_TAXONOMY]
        const sConfig = SERVER_CONTRAINDICATION_TAXONOMY[key as keyof typeof SERVER_CONTRAINDICATION_TAXONOMY]
        expect(cConfig.severity).toBe(sConfig.severity)
        expect(cConfig.forbiddenPatterns.length).toBe(sConfig.forbiddenPatterns.length)
      }
    })

    it('line-level prescriptive evaluation is identical between client and server functions', () => {
      const testLineA = '- Exercise 1: Box Jumps: 4 sets x 15 reps (substitute for outdoor running)'
      const boxPattern = /\b(?:box|depth|tuck|jump|squat|split|broad|hurdle)[- ]*jumps?\b/i
      const clientRes = isPrescriptiveExerciseLine(testLineA, boxPattern)
      const serverRes = serverIsPrescriptiveExerciseLine(testLineA, boxPattern)
      expect(clientRes.isPrescription).toBe(serverRes.isPrescription)
      expect(clientRes.matchedSnippet).toBe(serverRes.matchedSnippet)
    })
  })
})
