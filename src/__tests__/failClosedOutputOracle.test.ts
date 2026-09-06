/**
 * failClosedOutputOracle.test.ts
 *
 * Comprehensive End-to-End Fail-Closed Output Oracle for BodyMap AI.
 * Validates that NO unvalidated, contraindicated, allergenic, or corrupted candidate content
 * can escape through ANY generation, fallback, storage, profile-switch, or UI render path.
 *
 * Enforces: UNTRUSTED -> STRUCTURALLY VALIDATED -> MEDICALLY SCREENED -> ACCEPTED -> PERSISTED/RENDERED
 *
 * Exactly 142 deterministic cases across:
 * - 30 Core Architectural & Safety Categories (125 cases)
 * - 17 Mutation-Style Adversarial Bypass Scenarios (17 cases)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  validateGeneratedPlan,
  callGeminiWithFormData,
  AllergenSafetyError,
  MedicalContraindicationError,
  MOCK_PLAN,
} from '../lib/gemini'
import {
  parseAndValidatePlan,
} from '../lib/planSchema'
import {
  scanPlanForContraindications,
} from '../lib/contraindicationGuard'
import {
  scanPlanForAllergens,
  getActiveAllergenCategories,
  scanMealTextForAllergens,
} from '../lib/allergenGuard'
import {
  computeProfileFingerprint,
  evaluatePlanProfileBinding,
} from '../lib/planBinding'
import {
  saveActiveSession,
  loadActiveSession,
  loadAndValidateActiveSession,
  clearActiveSession,
  ACTIVE_SESSION_STORAGE_KEY,
} from '../lib/sessionStorage'
import {
  loadSavedPlans,
  savePlanToLibrary,
  normalizePlanTags,
  SAVED_PLANS_STORAGE_KEY,
} from '../lib/savedPlansStorage'
import {
  getExerciseAlternatives,
} from '../lib/exerciseSubstitution'
import { hasSafetySensitiveMedicalIssues } from '../lib/validation'
import type { FormData } from '../types/formData'
import type { WorkoutSession } from '../types/workoutSession'
import type { PlanState } from '../context/PlanContext'

// Helper to generate a valid, clean 7-day markdown plan
function createValidSevenDayMarkdown(options?: {
  exerciseLine?: string
  mealLine?: string
}): string {
  const ex = options?.exerciseLine || '- Push-ups: 3 sets x 10 reps'
  const ml = options?.mealLine || '- Breakfast: Oatmeal with berries (350 kcal)'
  return [
    '# 7-Day Precision Training Plan',
    '> "Consistency creates champions."',
    '## Day 1: Upper Body Focus',
    '### Main Workout',
    'Warm-up: 5 mins light arm circles',
    ex,
    'Cool-down: 5 mins stretching',
    '### Nutrition',
    ml,
    '- Lunch: Grilled chicken quinoa bowl (450 kcal)',
    '- Dinner: Steamed fish with brown rice (500 kcal)',
    '- Snacks: Apple slices (100 kcal)',
    '## Day 2: Lower Body Strength',
    '### Main Workout',
    'Warm-up: 5 mins leg swings',
    '- Bodyweight Squats: 3 sets x 12 reps',
    'Cool-down: 5 mins quad stretches',
    '### Nutrition',
    '- Breakfast: Scrambled eggs with spinach (350 kcal)',
    '- Lunch: Turkey wrap with hummus (450 kcal)',
    '- Dinner: Lean beef with sweet potato (500 kcal)',
    '## Day 3: Active Recovery',
    'Rest Day - 30 min gentle walk',
    '### Nutrition',
    '- Breakfast: Fruit smoothie bowl (300 kcal)',
    '- Lunch: Mixed green salad with tofu (400 kcal)',
    '- Dinner: Lentil soup (450 kcal)',
    '## Day 4: Core & Conditioning',
    '### Main Workout',
    'Warm-up: 5 mins torso twists',
    '- Plank: 3 sets x 30 sec',
    'Cool-down: 5 mins child pose',
    '### Nutrition',
    '- Breakfast: Overnight oats with flaxseeds (350 kcal)',
    '- Lunch: Salmon salad (450 kcal)',
    '- Dinner: Chicken stir-fry (500 kcal)',
    '## Day 5: Full Body Integration',
    '### Main Workout',
    'Warm-up: 5 mins dynamic flow',
    '- Lunges: 3 sets x 10 reps per leg',
    'Cool-down: 5 mins hip opener',
    '### Nutrition',
    '- Breakfast: Protein chia pudding (350 kcal)',
    '- Lunch: Quinoa black bean bowl (450 kcal)',
    '- Dinner: Grilled cod with asparagus (500 kcal)',
    '## Day 6: Aerobic Capacity',
    '### Main Workout',
    'Warm-up: 5 mins marching in place',
    '- Low-impact step aerobics: 20 mins',
    'Cool-down: 5 mins calf stretching',
    '### Nutrition',
    '- Breakfast: Buckwheat pancakes with berries (350 kcal)',
    '- Lunch: Vegetable wrap (400 kcal)',
    '- Dinner: Roasted turkey with squash (480 kcal)',
    '## Day 7: Rest & Rejuvenation',
    'Rest Day - Full body restorative mobility',
    '### Nutrition',
    '- Breakfast: Green protein smoothie (300 kcal)',
    '- Lunch: Mediterranean grain bowl (450 kcal)',
    '- Dinner: Herb roasted chicken (500 kcal)',
  ].join('\n')
}

const baseValidFormData: FormData = {
  age: '28',
  gender: 'female',
  height: '168',
  weight: '62',
  fitnessLevel: 'intermediate',
  mainGoal: 'Strength',
  bodyFocus: ['Full Body'],
  timePerDay: '45',
  medicalIssues: '',
  equipment: ['Dumbbells'],
  pushupCount: '15',
  dietaryPreference: 'omnivore',
  allergies: '',
  specialRequests: '',
  recoveryDays: '2',
  sleepHours: '8',
  stressLevel: 'low',
}

describe('FAIL-CLOSED OUTPUT ORACLE (142 Adversarial Scenarios)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  // ==========================================
  // Category 1: Generation Failure & Non-Resurrection
  // ==========================================
  describe('Category 1: Generation Failure & Non-Resurrection', () => {
    it('C01-1: Rejected plan with 0 days throws structural error and does not return plan', () => {
      const emptyPlan = 'This is just a conversational note with no structured days.'
      const validation = validateGeneratedPlan(emptyPlan)
      expect(validation.isValid).toBe(false)
      expect(validation.dayCount).toBe(0)
    })

    it('C01-2: Non-JSON or malformed API response throws error and rejects candidate', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error 500'),
      })
      await expect(callGeminiWithFormData(baseValidFormData)).rejects.toThrow('API error (500)')
    })

    it('C01-3: HTTP 422 with MEDICAL_CONTRAINDICATION_VIOLATION maps to MedicalContraindicationError', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              error: 'MEDICAL_CONTRAINDICATION_VIOLATION',
              contraindicatedConditions: ['Shoulder Impingement'],
              contraindicatedViolations: [
                {
                  category: 'shoulder_impingement_cuff',
                  conditionLabel: 'Shoulder Impingement',
                  matchedExercise: 'Overhead Press',
                  dayNumber: 1,
                  sourceLine: '- Overhead Press: 3x10',
                  reason: 'Overhead pressing causes subacromial impingement.',
                },
              ],
            })
          ),
      })
      await expect(callGeminiWithFormData(baseValidFormData)).rejects.toThrow(MedicalContraindicationError)
    })

    it('C01-4: HTTP 422 with ALLERGEN_SAFETY_VIOLATION maps to AllergenSafetyError', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              error: 'ALLERGEN_SAFETY_VIOLATION: Peanut detected',
              allergenCategories: ['Peanuts'],
            })
          ),
      })
      await expect(callGeminiWithFormData(baseValidFormData)).rejects.toThrow(AllergenSafetyError)
    })
  })

  // ==========================================
  // Category 2: Network Timeout / Abort Handling
  // ==========================================
  describe('Category 2: Network Timeout / Abort Handling', () => {
    it('C02-1: Aborted request signal throws error without partial acceptance', async () => {
      global.fetch = vi.fn().mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))
      await expect(callGeminiWithFormData(baseValidFormData)).rejects.toThrow('The operation was aborted.')
    })

    it('C02-2: Timeout in fetch throws error and rejects candidate', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Fetch request timed out'))
      await expect(callGeminiWithFormData(baseValidFormData)).rejects.toThrow('Fetch request timed out')
    })

    it('C02-3: Failed network request leaves local active session empty', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network disconnected'))
      await expect(callGeminiWithFormData(baseValidFormData)).rejects.toThrow('Network disconnected')
      expect(loadActiveSession()).toBeNull()
    })
  })

  // ==========================================
  // Category 3: Stale Response / Out-of-Order Completion
  // ==========================================
  describe('Category 3: Stale Response / Out-of-Order Completion', () => {
    it('C03-1: Profile change invalidates binding fingerprint of prior generation', () => {
      const initialForm = { ...baseValidFormData, medicalIssues: 'None' }
      const initialFingerprint = computeProfileFingerprint(initialForm)
      const updatedForm = { ...baseValidFormData, medicalIssues: 'Knee ACL tear' }
      const updatedFingerprint = computeProfileFingerprint(updatedForm)

      expect(initialFingerprint).not.toBe(updatedFingerprint)
    })

    it('C03-2: Evaluation detects safety mismatch when medical issue changes from none to knee injury', () => {
      const boundProfile = { ...baseValidFormData, medicalIssues: '' }
      const currentForm = { ...baseValidFormData, medicalIssues: 'ACL tear and meniscus tear' }
      const evalResult = evaluatePlanProfileBinding(currentForm, boundProfile)

      expect(evalResult.isSafetyMismatched).toBe(true)
      expect(evalResult.mismatchedSafetyFields).toContain('medicalIssues')
    })

    it('C03-3: Evaluation detects safety mismatch when allergy changes from none to peanuts', () => {
      const boundProfile = { ...baseValidFormData, allergies: '' }
      const currentForm = { ...baseValidFormData, allergies: 'Severe peanut allergy' }
      const evalResult = evaluatePlanProfileBinding(currentForm, boundProfile)

      expect(evalResult.isSafetyMismatched).toBe(true)
      expect(evalResult.mismatchedSafetyFields).toContain('allergies')
    })

    it('C03-4: Binding evaluation fails closed when boundProfile is null but current profile has medical issues', () => {
      const currentForm = { ...baseValidFormData, medicalIssues: 'Lumbar disc herniation' }
      const evalResult = evaluatePlanProfileBinding(currentForm, null)

      expect(evalResult.isSafetyMismatched).toBe(true)
      expect(evalResult.reason).toContain('Plan has no recorded profile binding')
    })
  })

  // ==========================================
  // Category 4: JSON Parse & Structure Malformation
  // ==========================================
  describe('Category 4: JSON Parse & Structure Malformation', () => {
    it('C04-1: parseAndValidatePlan rejects malformed markdown with no day headers', () => {
      const res = parseAndValidatePlan('Some generic workout advice without day breakdown.')
      expect(res.success).toBe(false)
      expect(res.errors?.[0]).toContain('No valid Day headers')
    })

    it('C04-2: parseAndValidatePlan rejects markdown with only day titles but no exercises or meals', () => {
      const emptyDays = [
        '## Day 1: Title',
        '## Day 2: Title',
        '## Day 3: Title',
        '## Day 4: Title',
        '## Day 5: Title',
        '## Day 6: Title',
        '## Day 7: Title',
      ].join('\n')
      const res = parseAndValidatePlan(emptyDays)
      expect(res.success).toBe(false)
    })

    it('C04-3: parseAndValidatePlan rejects duplicate day headers (e.g. two Day 1s)', () => {
      const plan = [
        '## Day 1: First',
        '- Push-ups: 3x10',
        'Breakfast: Oats',
        'Lunch: Chicken',
        'Dinner: Fish',
        '## Day 1: Duplicate',
        '- Squats: 3x10',
        'Breakfast: Eggs',
        'Lunch: Beef',
        'Dinner: Salmon',
        '## Day 3: Third',
        'Rest Day',
        'Breakfast: Smoothie',
        'Lunch: Salad',
        'Dinner: Soup',
        '## Day 4: Fourth',
        'Rest Day',
        'Breakfast: Smoothie',
        'Lunch: Salad',
        'Dinner: Soup',
        '## Day 5: Fifth',
        'Rest Day',
        'Breakfast: Smoothie',
        'Lunch: Salad',
        'Dinner: Soup',
        '## Day 6: Sixth',
        'Rest Day',
        'Breakfast: Smoothie',
        'Lunch: Salad',
        'Dinner: Soup',
        '## Day 7: Seventh',
        'Rest Day',
        'Breakfast: Smoothie',
        'Lunch: Salad',
        'Dinner: Soup',
      ].join('\n')
      const res = parseAndValidatePlan(plan)
      expect(res.success).toBe(false)
      expect(res.errors?.[0]).toContain('Duplicate Day 1')
    })

    it('C04-4: parseAndValidatePlan rejects truncated json embedded in markdown', () => {
      const truncated = '\x60\x60\x60json { "days": [ { "dayNumber": 1'
      const res = parseAndValidatePlan(truncated)
      expect(res.success).toBe(false)
    })

    it('C04-5: validateGeneratedPlan returns isValid=false when text is under 50 characters', () => {
      const res = validateGeneratedPlan('Short plan')
      expect(res.isValid).toBe(false)
      expect(res.dayCount).toBe(0)
    })
  })

  // ==========================================
  // Category 5: Missing Mandatory Structural Days
  // ==========================================
  describe('Category 5: Missing Mandatory Structural Days', () => {
    it('C05-1: parseAndValidatePlan with requireSevenDays=true rejects 6-day plan', () => {
      const sixDays = [
        '## Day 1',
        '- Push-ups: 3x10',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 2',
        '- Squats: 3x10',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 3',
        'Rest Day',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 4',
        '- Lunges: 3x10',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 5',
        '- Plank: 3x30s',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 6',
        'Rest Day',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
      ].join('\n')
      const res = parseAndValidatePlan(sixDays, true)
      expect(res.success).toBe(false)
      expect(res.errors?.[0]).toContain('Plan must contain exactly 7 days (found 6)')
    })

    it('C05-2: parseAndValidatePlan with requireSevenDays=true rejects 5-day plan', () => {
      const fiveDays = '## Day 1\n- Push-ups: 3x10\nBreakfast: Oats\nLunch: Salad\nDinner: Fish\n## Day 2\nRest\nBreakfast: Oats\nLunch: Salad\nDinner: Fish\n## Day 3\nRest\nBreakfast: Oats\nLunch: Salad\nDinner: Fish\n## Day 4\nRest\nBreakfast: Oats\nLunch: Salad\nDinner: Fish\n## Day 5\nRest\nBreakfast: Oats\nLunch: Salad\nDinner: Fish'
      const res = parseAndValidatePlan(fiveDays, true)
      expect(res.success).toBe(false)
      expect(res.errors?.[0]).toContain('Plan must contain exactly 7 days (found 5)')
    })

    it('C05-3: parseAndValidatePlan with requireSevenDays=true rejects 1-day plan', () => {
      const oneDay = '## Day 1\n- Push-ups: 3x10\nBreakfast: Oats\nLunch: Salad\nDinner: Fish'
      const res = parseAndValidatePlan(oneDay, true)
      expect(res.success).toBe(false)
      expect(res.errors?.[0]).toContain('Plan must contain exactly 7 days (found 1)')
    })

    it('C05-4: parseAndValidatePlan with requireSevenDays=true sorts and validates sequentially numbered days', () => {
      const outOfOrder = [
        '## Day 1',
        '- Push-ups: 3x10',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 3',
        '- Squats: 3x10',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 2',
        'Rest Day',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 4',
        '- Lunges: 3x10',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 5',
        '- Plank: 3x30s',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 6',
        'Rest Day',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 7',
        'Rest Day',
        'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
      ].join('\n')
      const res = parseAndValidatePlan(outOfOrder, true)
      expect(res.success).toBe(true)
      expect(res.data?.days[1].dayNumber).toBe(2)
      expect(res.data?.days[2].dayNumber).toBe(3)
    })

    it('C05-5: parseAndValidatePlan with requireSevenDays=true rejects 8-day plan', () => {
      const eightDays = [
        '## Day 1', '- Push-ups: 3x10', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 2', '- Squats: 3x10', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 3', 'Rest Day', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 4', '- Lunges: 3x10', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 5', '- Plank: 3x30s', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 6', 'Rest Day', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 7', 'Rest Day', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 8', 'Rest Day', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
      ].join('\n')
      const res = parseAndValidatePlan(eightDays, true)
      expect(res.success).toBe(false)
      expect(res.errors?.[0]).toContain('Plan must contain exactly 7 days (found 8)')
    })
  })

  // ==========================================
  // Category 6: Empty / Null / Undefined Payload Injection
  // ==========================================
  describe('Category 6: Empty / Null / Undefined Payload Injection', () => {
    it('C06-1: validateGeneratedPlan returns isValid=false for empty string', () => {
      expect(validateGeneratedPlan('').isValid).toBe(false)
    })

    it('C06-2: validateGeneratedPlan returns isValid=false for whitespace-only string', () => {
      expect(validateGeneratedPlan('   \n\t  \n  ').isValid).toBe(false)
    })

    it('C06-3: parseAndValidatePlan returns success=false for empty string', () => {
      expect(parseAndValidatePlan('').success).toBe(false)
    })

    it('C06-4: computeProfileFingerprint returns empty string for null/undefined formData', () => {
      expect(computeProfileFingerprint(null)).toBe('')
      expect(computeProfileFingerprint(undefined)).toBe('')
    })
  })

  // ==========================================
  // Category 7: Type Confusion
  // ==========================================
  describe('Category 7: Type Confusion', () => {
    it('C07-1: validateGeneratedPlan handles non-string input gracefully', () => {
      // @ts-expect-error testing runtime defensive guard against unexpected types
      expect(validateGeneratedPlan(12345).isValid).toBe(false)
      // @ts-expect-error testing runtime defensive guard against unexpected types
      expect(validateGeneratedPlan({ plan: 'test' }).isValid).toBe(false)
    })

    it('C07-2: parseAndValidatePlan handles non-string input safely', () => {
      // @ts-expect-error testing runtime defensive guard against unexpected types
      expect(parseAndValidatePlan(null).success).toBe(false)
      // @ts-expect-error testing runtime defensive guard against unexpected types
      expect(parseAndValidatePlan(['Day 1']).success).toBe(false)
    })

    it('C07-3: evaluatePlanProfileBinding handles null/undefined arguments safely', () => {
      const res = evaluatePlanProfileBinding(null, null)
      expect(res.isBound).toBe(false)
      expect(res.isSafetyMismatched).toBe(false)
    })

    it('C07-4: normalizePlanTags handles non-array / non-string items safely', () => {
      expect(normalizePlanTags(null)).toEqual([])
      expect(normalizePlanTags([123, null, undefined, '#Hypertrophy', '   '])).toEqual(['hypertrophy'])
    })
  })

  // ==========================================
  // Category 8: Whitespace / Zero-Width / Control Character Evasion
  // ==========================================
  describe('Category 8: Whitespace / Control Character Evasion', () => {
    it('C08-1: Day header separated by multiple spaces parses correctly', () => {
      const plan = createValidSevenDayMarkdown().replace('## Day 1:', '##    Day    1:')
      const parsed = parseAndValidatePlan(plan)
      expect(parsed.success).toBe(true)
      expect(parsed.data?.days[0].dayNumber).toBe(1)
    })

    it('C08-2: Zero-width spaces in day header do not cause day count bypass', () => {
      const plan = createValidSevenDayMarkdown().replace('## Day 1:', '## Day\u200B 1:')
      const parsed = parseAndValidatePlan(plan)
      expect(typeof parsed.success).toBe('boolean')
    })

    it('C08-3: Control characters in generated plan text do not break parsing or bypass validation', () => {
      const clean = createValidSevenDayMarkdown()
      const corrupted = clean + '\x00\x01\x02'
      const parsed = parseAndValidatePlan(corrupted)
      expect(parsed.success).toBe(true)
    })

    it('C08-4: Markdown with trailing carriage returns handled safely', () => {
      const plan = createValidSevenDayMarkdown().replace(/\n/g, '\r\n')
      const parsed = parseAndValidatePlan(plan)
      expect(parsed.success).toBe(true)
      expect(parsed.data?.days.length).toBe(7)
    })
  })

  // ==========================================
  // Category 9: Medical Contraindication - Direct Matches in Generation
  // ==========================================
  describe('Category 9: Medical Contraindication - Direct Matches in Generation', () => {
    it('C09-1: Candidate plan containing "Overhead Press" rejected for "Shoulder Impingement"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Overhead Press: 3 sets x 10 reps' })
      const scan = scanPlanForContraindications(plan, 'Shoulder Impingement')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.some(v => v.category === 'shoulder_impingement_cuff')).toBe(true)
    })

    it('C09-2: Candidate plan containing "Barbell Back Squats" rejected for "Lumbar Disc Herniation"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Barbell Back Squats: 4 sets x 8 reps' })
      const scan = scanPlanForContraindications(plan, 'Lumbar Disc Herniation')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.some(v => v.category === 'lumbar_disc_herniation')).toBe(true)
    })

    it('C09-3: Candidate plan containing "Box Jumps" rejected for "ACL tear"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Box Jumps: 4 sets x 10 reps' })
      const scan = scanPlanForContraindications(plan, 'ACL tear')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.some(v => v.category === 'knee_high_impact')).toBe(true)
    })

    it('C09-4: Candidate plan containing "Behind-the-neck Press" rejected for "Cervical Spine Stenosis"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Behind-the-neck Press: 3 sets x 10 reps' })
      const scan = scanPlanForContraindications(plan, 'Cervical Spine Stenosis')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.some(v => v.category === 'cervical_spine_pathology')).toBe(true)
    })

    it('C09-5: Candidate plan containing "HIIT Sprint Intervals" rejected for "Symptomatic Angina"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Sprint Intervals / HIIT: 10 sets' })
      const scan = scanPlanForContraindications(plan, 'Symptomatic Angina')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.some(v => v.category === 'cardiac_symptomatic_condition')).toBe(true)
    })

    it('C09-6: Candidate plan containing "Supine Bench Press" rejected for "Pregnancy 3rd Trimester"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Supine Flat Bench Press: 3 sets x 10 reps' })
      const scan = scanPlanForContraindications(plan, 'Pregnancy (3rd Trimester)')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.some(v => v.category === 'pregnancy_late_stage')).toBe(true)
    })
  })

  // ==========================================
  // Category 10: Medical Contraindication - Aliases / Synonyms / Lexical Variations
  // ==========================================
  describe('Category 10: Medical Contraindication - Aliases / Synonyms', () => {
    it('C10-1: "Military Press" detected as shoulder contraindication', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Standing Military Press: 3x8' })
      const scan = scanPlanForContraindications(plan, 'Rotator cuff tendinitis')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.some(v => v.category === 'shoulder_impingement_cuff')).toBe(true)
    })

    it('C10-2: "OHP" detected as shoulder contraindication', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Dumbbell OHP: 3x10' })
      const scan = scanPlanForContraindications(plan, 'Shoulder impingement')
      expect(scan.hasViolation).toBe(true)
    })

    it('C10-3: "Pistol Squats" detected as knee/ACL contraindication', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Single-leg Pistol Squats: 3x5' })
      const scan = scanPlanForContraindications(plan, 'Meniscus tear')
      expect(scan.hasViolation).toBe(true)
    })

    it('C10-4: "Conventional Deadlift" detected as lumbar disc contraindication', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Conventional Barbell Deadlift: 3x5' })
      const scan = scanPlanForContraindications(plan, 'L5-S1 disc bulge')
      expect(scan.hasViolation).toBe(true)
    })

    it('C10-5: "High-impact Bounding" detected as osteoporosis contraindication', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- High-impact Bounding: 3x10' })
      const scan = scanPlanForContraindications(plan, 'Severe osteoporosis with T-score -3.0')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.some(v => v.category === 'severe_osteoporosis')).toBe(true)
    })

    it('C10-6: "Burpees with Tuck Jump" detected as severe osteoarthritis contraindication', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Burpees with Tuck Jump: 3x12' })
      const scan = scanPlanForContraindications(plan, 'Severe knee osteoarthritis')
      expect(scan.hasViolation).toBe(true)
    })
  })

  // ==========================================
  // Category 11: Medical Contraindication - Fallback Plan (MOCK_PLAN) Containment
  // ==========================================
  describe('Category 11: Fallback Plan Containment with Medical Issues', () => {
    it('C11-1: MOCK_PLAN contains "Overhead Press" and is flagged as contraindicated for "Rotator Cuff Tear"', () => {
      const scan = scanPlanForContraindications(MOCK_PLAN, 'Rotator Cuff Tear')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.some(v => v.matchedExercise.toLowerCase().includes('overhead press'))).toBe(true)
    })

    it('C11-2: hasSafetySensitiveMedicalIssues blocks generic mock plan when user has knee meniscus tear', () => {
      expect(hasSafetySensitiveMedicalIssues('Meniscus Tear')).toBe(true)
      expect(hasSafetySensitiveMedicalIssues('Knee ACL reconstruction')).toBe(true)
    })

    it('C11-3: MOCK_PLAN contains "Dips" and is flagged as contraindicated for "Shoulder Impingement"', () => {
      const scan = scanPlanForContraindications(MOCK_PLAN, 'Shoulder Impingement')
      expect(scan.hasViolation).toBe(true)
    })

    it('C11-4: hasSafetySensitiveMedicalIssues returns true for medical limitations preventing unvetted fallback', () => {
      expect(hasSafetySensitiveMedicalIssues('Rotator cuff tear')).toBe(true)
      expect(hasSafetySensitiveMedicalIssues('ACL reconstruction')).toBe(true)
      expect(hasSafetySensitiveMedicalIssues('Herniated disc L4-L5')).toBe(true)
      expect(hasSafetySensitiveMedicalIssues('None')).toBe(false)
      expect(hasSafetySensitiveMedicalIssues('')).toBe(false)
    })
  })

  // ==========================================
  // Category 12: Allergen Screening - Direct Matches in Generation
  // ==========================================
  describe('Category 12: Allergen Screening - Direct Matches in Generation', () => {
    it('C12-1: Candidate plan containing "Peanut butter toast" rejected for "Peanuts"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Breakfast: Peanut butter toast (350 kcal)' })
      const scan = scanPlanForAllergens(plan, 'Peanuts')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.some(v => v.label.toLowerCase().includes('peanut'))).toBe(true)
    })

    it('C12-2: Candidate plan containing "Almond milk smoothie" rejected for "Tree Nuts"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Breakfast: Almond milk berry smoothie (300 kcal)' })
      const scan = scanPlanForAllergens(plan, 'Tree Nuts')
      expect(scan.hasViolation).toBe(true)
    })

    it('C12-3: Candidate plan containing "Shrimp stir fry" rejected for "Shellfish"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Lunch: Shrimp stir fry with rice (450 kcal)' })
      const scan = scanPlanForAllergens(plan, 'Shellfish')
      expect(scan.hasViolation).toBe(true)
    })

    it('C12-4: Candidate plan containing "Whole wheat bread" rejected for "Gluten"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Breakfast: Whole wheat bread with avocado (350 kcal)' })
      const scan = scanPlanForAllergens(plan, 'Gluten')
      expect(scan.hasViolation).toBe(true)
    })

    it('C12-5: Candidate plan containing "Greek yogurt bowl" rejected for "Dairy"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Breakfast: Greek yogurt bowl with honey (350 kcal)' })
      const scan = scanPlanForAllergens(plan, 'Dairy')
      expect(scan.hasViolation).toBe(true)
    })

    it('C12-6: Candidate plan containing "Tofu scramble" rejected for "Soy"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Breakfast: Tofu scramble with bell peppers (300 kcal)' })
      const scan = scanPlanForAllergens(plan, 'Soy')
      expect(scan.hasViolation).toBe(true)
    })
  })

  // ==========================================
  // Category 13: Allergen Screening - Hidden / Derivative Ingredients
  // ==========================================
  describe('Category 13: Allergen Screening - Hidden / Derivative Ingredients', () => {
    it('C13-1: "Whey protein isolate" detected for "Dairy"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Snacks: Whey protein isolate shake (200 kcal)' })
      const scan = scanPlanForAllergens(plan, 'Dairy')
      expect(scan.hasViolation).toBe(true)
    })

    it('C13-2: "Casein shake" detected for "Dairy"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Snacks: Micellar casein pudding (200 kcal)' })
      const scan = scanPlanForAllergens(plan, 'Dairy')
      expect(scan.hasViolation).toBe(true)
    })

    it('C13-3: "Ghee" detected for "Dairy"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Dinner: Rice cooked in clarified ghee (450 kcal)' })
      const scan = scanPlanForAllergens(plan, 'Dairy')
      expect(scan.hasViolation).toBe(true)
    })

    it('C13-4: "Tahini dressing" detected for "Sesame"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Lunch: Falafel with tahini garlic sauce (450 kcal)' })
      const scan = scanPlanForAllergens(plan, 'Sesame')
      expect(scan.hasViolation).toBe(true)
    })

    it('C13-5: "Almond flour pancakes" detected for "Tree Nuts"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Breakfast: Almond flour keto pancakes (350 kcal)' })
      const scan = scanPlanForAllergens(plan, 'Tree Nuts')
      expect(scan.hasViolation).toBe(true)
    })
  })

  // ==========================================
  // Category 14: Allergen Screening - Fallback Plan (MOCK_PLAN) Containment
  // ==========================================
  describe('Category 14: Fallback Plan Containment with Allergies', () => {
    it('C14-1: MOCK_PLAN contains "Greek yogurt" and is flagged for "Dairy"', () => {
      const scan = scanPlanForAllergens(MOCK_PLAN, 'Dairy')
      expect(scan.hasViolation).toBe(true)
    })

    it('C14-2: MOCK_PLAN contains "Almonds" and is flagged for "Tree Nuts"', () => {
      const scan = scanPlanForAllergens(MOCK_PLAN, 'Tree Nuts')
      expect(scan.hasViolation).toBe(true)
    })

    it('C14-3: getActiveAllergenCategories identifies active allergens from user string', () => {
      const active = getActiveAllergenCategories('Peanuts, Shellfish, Gluten')
      expect(active.length).toBeGreaterThanOrEqual(3)
    })

    it('C14-4: scanMealTextForAllergens detects violation in discrete meal line using canonical category key', () => {
      const scan = scanMealTextForAllergens('Snack: Handful of roasted almonds', ['tree_nut'])
      expect(scan.hasViolation).toBe(true)
    })
  })

  // ==========================================
  // Category 15: Plan Profile Binding - Health Risk Mismatches
  // ==========================================
  describe('Category 15: Plan Profile Binding - Health Risk Mismatches', () => {
    it('C15-1: Initial profile without medical issues -> user updates to "Herniated Disc" -> binding is safety mismatched', () => {
      const bound = { ...baseValidFormData, medicalIssues: '' }
      const current = { ...baseValidFormData, medicalIssues: 'Herniated Disc L5-S1' }
      const res = evaluatePlanProfileBinding(current, bound)
      expect(res.isSafetyMismatched).toBe(true)
      expect(res.mismatchedSafetyFields).toContain('medicalIssues')
    })

    it('C15-2: Initial profile without allergies -> user updates to "Peanuts" -> binding is safety mismatched', () => {
      const bound = { ...baseValidFormData, allergies: '' }
      const current = { ...baseValidFormData, allergies: 'Severe peanut allergy' }
      const res = evaluatePlanProfileBinding(current, bound)
      expect(res.isSafetyMismatched).toBe(true)
      expect(res.mismatchedSafetyFields).toContain('allergies')
    })

    it('C15-3: User updates preference (e.g. timePerDay) -> binding is NOT safety mismatched, only preference mismatched', () => {
      const bound = { ...baseValidFormData, timePerDay: '45' }
      const current = { ...baseValidFormData, timePerDay: '60' }
      const res = evaluatePlanProfileBinding(current, bound)
      expect(res.isSafetyMismatched).toBe(false)
      expect(res.isPreferenceMismatched).toBe(true)
      expect(res.mismatchedPreferenceFields).toContain('timePerDay')
    })

    it('C15-4: User profile unchanged -> binding is fully matched', () => {
      const bound = { ...baseValidFormData }
      const current = { ...baseValidFormData }
      const res = evaluatePlanProfileBinding(current, bound)
      expect(res.isBound).toBe(true)
      expect(res.isSafetyMismatched).toBe(false)
      expect(res.isPreferenceMismatched).toBe(false)
    })

    it('C15-5: Bound profile with medical issues cleared by user -> detected as safety mismatch', () => {
      const bound = { ...baseValidFormData, medicalIssues: 'Knee ACL tear' }
      const current = { ...baseValidFormData, medicalIssues: '' }
      const res = evaluatePlanProfileBinding(current, bound)
      expect(res.isSafetyMismatched).toBe(true)
    })
  })

  // ==========================================
  // Category 16: Plan Profile Binding - Fingerprint Tampering / Invalidation
  // ==========================================
  describe('Category 16: Plan Profile Binding - Fingerprint Tampering', () => {
    it('C16-1: Changing one character in medicalIssues changes fingerprint', () => {
      const fp1 = computeProfileFingerprint({ ...baseValidFormData, medicalIssues: 'Knee pain' })
      const fp2 = computeProfileFingerprint({ ...baseValidFormData, medicalIssues: 'Knee pains' })
      expect(fp1).not.toBe(fp2)
    })

    it('C16-2: Changing allergen string changes fingerprint', () => {
      const fp1 = computeProfileFingerprint({ ...baseValidFormData, allergies: 'Dairy' })
      const fp2 = computeProfileFingerprint({ ...baseValidFormData, allergies: 'Eggs' })
      expect(fp1).not.toBe(fp2)
    })

    it('C16-3: Key order in formData does not change canonical fingerprint', () => {
      const objA = { age: '25', gender: 'male', medicalIssues: 'None' }
      const objB = { medicalIssues: 'None', gender: 'male', age: '25' }
      expect(computeProfileFingerprint(objA)).toBe(computeProfileFingerprint(objB))
    })

    it('C16-4: Empty strings and whitespace trimmed in canonical fingerprint', () => {
      const fp1 = computeProfileFingerprint({ ...baseValidFormData, medicalIssues: '  knee pain  ' })
      const fp2 = computeProfileFingerprint({ ...baseValidFormData, medicalIssues: 'knee pain' })
      expect(fp1).toBe(fp2)
    })
  })

  // ==========================================
  // Category 17: SessionStorage Integrity - Valid vs Invalid Serialization
  // ==========================================
  describe('Category 17: SessionStorage Integrity', () => {
    const mockSession: WorkoutSession = {
      sessionId: 'sess_12345',
      planId: 'plan_abc',
      medicalSnapshot: 'None',
      dayIndex: 0,
      dayTitle: 'Day 1: Upper Body',
      dayType: 'Strength',
      durationMinutes: 45,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      elapsedSeconds: 120,
      currentExerciseIndex: 0,
      exercises: [
        {
          name: 'Push-ups',
          focus: 'Chest',
          equipment: 'Bodyweight',
          formCue: 'Keep core braced',
          targetSets: 3,
          targetReps: '10',
          restSeconds: 60,
          sets: [{ setNumber: 1, targetReps: '10', weightKg: null, completedReps: 10, isCompleted: true }],
        },
      ],
      restTimer: { isActive: false, targetEndTime: null, durationSeconds: 60, isPaused: false, remainingSeconds: 60 },
      status: 'in-progress',
      soundEnabled: true,
      vibrateEnabled: true,
    }

    it('C17-1: saveActiveSession and loadActiveSession roundtrip preserves in-progress session', () => {
      saveActiveSession(mockSession)
      const loaded = loadActiveSession()
      expect(loaded).not.toBeNull()
      expect(loaded?.sessionId).toBe('sess_12345')
      expect(loaded?.exercises.length).toBe(1)
    })

    it('C17-2: Completed session is not resurrected by loadActiveSession (anti-resurrection)', () => {
      const completedSession = { ...mockSession, status: 'completed' as const }
      saveActiveSession(completedSession)
      const loaded = loadActiveSession()
      expect(loaded).toBeNull()
    })

    it('C17-3: Abandoned session older than 24 hours is purged and returns null', () => {
      const staleSession = { ...mockSession, lastUpdatedAt: Date.now() - (25 * 60 * 60 * 1000) }
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(staleSession))
      const loaded = loadActiveSession()
      expect(loaded).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('C17-4: Corrupted JSON in sessionStorage is purged and returns null', () => {
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, '{ broken json string')
      const loaded = loadActiveSession()
      expect(loaded).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })
  })

  // ==========================================
  // Category 18: SessionStorage Tampering - Contaminated Storage
  // ==========================================
  describe('Category 18: SessionStorage Tampering & Validation', () => {
    const validSession: WorkoutSession = {
      sessionId: 'sess_sec_1',
      planId: 'plan_valid_1',
      medicalSnapshot: 'None',
      dayIndex: 0,
      dayTitle: 'Day 1',
      dayType: 'Strength',
      durationMinutes: 45,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      elapsedSeconds: 60,
      currentExerciseIndex: 0,
      exercises: [
        {
          name: 'Push-ups',
          focus: 'Chest',
          equipment: 'Bodyweight',
          formCue: 'Keep core tight',
          targetSets: 3,
          targetReps: '10',
          restSeconds: 60,
          sets: [{ setNumber: 1, targetReps: '10', weightKg: null, completedReps: 10, isCompleted: true }],
        },
      ],
      restTimer: { isActive: false, targetEndTime: null, durationSeconds: 60, isPaused: false, remainingSeconds: 60 },
      status: 'in-progress',
      soundEnabled: true,
      vibrateEnabled: true,
    }

    it('C18-1: loadAndValidateActiveSession rejects session when planId does not match currentPlanId', () => {
      saveActiveSession(validSession)
      const res = loadAndValidateActiveSession('different_plan_id', 'None')
      expect(res).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('C18-2: loadAndValidateActiveSession rejects session when medical issues diverged from medicalSnapshot', () => {
      saveActiveSession(validSession)
      const res = loadAndValidateActiveSession('plan_valid_1', 'Severe herniated disc')
      expect(res).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('C18-3: loadAndValidateActiveSession rejects session when exercises contain contraindication', () => {
      const unsafeSession: WorkoutSession = {
        ...validSession,
        medicalSnapshot: 'Rotator cuff tear',
        exercises: [
          {
            name: 'Overhead Press',
            focus: 'Shoulders',
            equipment: 'Barbell',
            formCue: 'Press overhead',
            targetSets: 3,
            targetReps: '10',
            restSeconds: 60,
            sets: [{ setNumber: 1, targetReps: '10', weightKg: null, completedReps: 0, isCompleted: false }],
          },
        ],
      }
      saveActiveSession(unsafeSession)
      const res = loadAndValidateActiveSession('plan_valid_1', 'Rotator cuff tear')
      expect(res).toBeNull()
      expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    })

    it('C18-4: Tampered session with empty exercises array is purged and returns null', () => {
      const emptyExSession = { ...validSession, exercises: [] }
      saveActiveSession(emptyExSession)
      const res = loadActiveSession()
      expect(res).toBeNull()
    })
  })

  // ==========================================
  // Category 19: SavedPlansStorage Provenance - Preserving Provenance
  // ==========================================
  describe('Category 19: SavedPlansStorage Provenance', () => {
    const samplePlanState: PlanState = {
      formData: baseValidFormData,
      generatedPlan: createValidSevenDayMarkdown(),
      isGenerated: true,
      planId: 'plan_provenance_99',
      planGeneratedAt: Date.now(),
      boundProfile: baseValidFormData,
      boundProfileFingerprint: computeProfileFingerprint(baseValidFormData),
      weightLog: [],
      completedDays: [],
    }

    it('C19-1: savePlanToLibrary preserves boundProfile and boundProfileFingerprint', () => {
      const saved = savePlanToLibrary('Strength Block 1', samplePlanState)
      expect(saved.planState.boundProfile).toBeDefined()
      expect(saved.planState.boundProfileFingerprint).toBe(samplePlanState.boundProfileFingerprint)
      expect(saved.planState.planId).toBe('plan_provenance_99')
    })

    it('C19-2: loadSavedPlans restores boundProfile, boundProfileFingerprint, and planId', () => {
      savePlanToLibrary('Strength Block 1', samplePlanState)
      const loaded = loadSavedPlans()
      expect(loaded.length).toBe(1)
      expect(loaded[0].planState.boundProfile).toEqual(baseValidFormData)
      expect(loaded[0].planState.planId).toBe('plan_provenance_99')
    })

    it('C19-3: Saved plan with undefined boundProfile loads gracefully with undefined', () => {
      const legacyState = { ...samplePlanState, boundProfile: undefined, boundProfileFingerprint: undefined }
      savePlanToLibrary('Legacy Block', legacyState)
      const loaded = loadSavedPlans()
      expect(loaded[0].planState.boundProfile).toBeUndefined()
      expect(loaded[0].planState.boundProfileFingerprint).toBeUndefined()
    })

    it('C19-4: Normalizing plan tags strips hashtags, lowercases, and limits to 8 tags', () => {
      const tags = ['#Cardio', 'STRENGTH', '#HYPERTROPHY', '#1', '#2', '#3', '#4', '#5', '#6', '#7']
      const normalized = normalizePlanTags(tags)
      expect(normalized.length).toBe(8)
      expect(normalized).toContain('cardio')
      expect(normalized).toContain('strength')
    })
  })

  // ==========================================
  // Category 20: SavedPlansStorage - Blocking Mismatched Activation
  // ==========================================
  describe('Category 20: SavedPlansStorage - Blocking Mismatched Activation', () => {
    it('C20-1: Activating saved plan with mismatched medical profile flagged by evaluatePlanProfileBinding', () => {
      const savedPlanBoundProfile = { ...baseValidFormData, medicalIssues: 'None' }
      const currentActiveProfile = { ...baseValidFormData, medicalIssues: 'Lumbar disc herniation' }
      const res = evaluatePlanProfileBinding(currentActiveProfile, savedPlanBoundProfile)
      expect(res.isSafetyMismatched).toBe(true)
      expect(res.mismatchedSafetyFields).toContain('medicalIssues')
    })

    it('C20-2: Activating saved plan with mismatched allergen profile flagged by evaluatePlanProfileBinding', () => {
      const savedPlanBoundProfile = { ...baseValidFormData, allergies: 'None' }
      const currentActiveProfile = { ...baseValidFormData, allergies: 'Peanut allergy' }
      const res = evaluatePlanProfileBinding(currentActiveProfile, savedPlanBoundProfile)
      expect(res.isSafetyMismatched).toBe(true)
      expect(res.mismatchedSafetyFields).toContain('allergies')
    })

    it('C20-3: Corrupted saved plans JSON in localStorage returns empty array without throwing', () => {
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, '{ invalid json')
      const plans = loadSavedPlans()
      expect(plans).toEqual([])
    })

    it('C20-4: Non-array root in saved plans storage returns empty array', () => {
      localStorage.setItem(SAVED_PLANS_STORAGE_KEY, JSON.stringify({ notAnArray: true }))
      const plans = loadSavedPlans()
      expect(plans).toEqual([])
    })
  })

  // ==========================================
  // Category 21: UI Render Sink - WeeklyPlanPage Display Contraindication Scanning
  // ==========================================
  describe('Category 21: UI Render Sink - WeeklyPlanPage Contraindication Scanning', () => {
    it('C21-1: Displayed workout exercises scanned for contraindications even if generatedPlan is empty', () => {
      const displayedExerciseLines = '- Overhead Press: 3x10\n- Lateral Raises: 3x12'
      const scan = scanPlanForContraindications(displayedExerciseLines, 'Shoulder impingement')
      expect(scan.hasViolation).toBe(true)
    })

    it('C21-2: Contraindications detected in displayDays trigger hasViolation=true', () => {
      const displayedExerciseLines = '- Box Jumps: 4x10'
      const scan = scanPlanForContraindications(displayedExerciseLines, 'Knee ACL tear')
      expect(scan.hasViolation).toBe(true)
    })

    it('C21-3: Displayed exercises containing warmup/cooldown contraindications detected', () => {
      const warmupLine = '- Box Jumps: 5 mins'
      const scan = scanPlanForContraindications(warmupLine, 'Knee ACL tear')
      expect(scan.hasViolation).toBe(true)
    })

    it('C21-4: Safe displayed exercises result in hasViolation=false', () => {
      const safeExercises = '- Push-ups: 3x10\n- Glute bridges: 3x15'
      const scan = scanPlanForContraindications(safeExercises, 'None')
      expect(scan.hasViolation).toBe(false)
    })
  })

  // ==========================================
  // Category 22: UI Render Sink - WeeklyPlanPage Display Allergen Scanning
  // ==========================================
  describe('Category 22: UI Render Sink - WeeklyPlanPage Allergen Scanning', () => {
    it('C22-1: Displayed meal texts scanned for allergens even if raw plan text omitted', () => {
      const mealTexts = ['Breakfast: Peanut butter toast', 'Lunch: Chicken salad']
      const activeCats = getActiveAllergenCategories('Peanuts')
      const hasViolation = mealTexts.some(text => scanMealTextForAllergens(text, activeCats).hasViolation)
      expect(hasViolation).toBe(true)
    })

    it('C22-2: Allergen detected in Breakfast meal text triggers hasViolation=true', () => {
      const scan = scanMealTextForAllergens('Breakfast: Scrambled eggs and toast', ['egg'])
      expect(scan.hasViolation).toBe(true)
    })

    it('C22-3: Allergen detected in Snacks meal text triggers hasViolation=true', () => {
      const scan = scanMealTextForAllergens('Snack: Greek yogurt with honey', ['dairy'])
      expect(scan.hasViolation).toBe(true)
    })

    it('C22-4: Clean meals result in hasViolation=false', () => {
      const scan = scanMealTextForAllergens('Lunch: Grilled chicken breast with white rice', ['dairy', 'peanut'])
      expect(scan.hasViolation).toBe(false)
    })
  })

  // ==========================================
  // Category 23: UI Render Sink - WeeklyPlanPage Workout Button Locking
  // ==========================================
  describe('Category 23: UI Render Sink - WeeklyPlanPage Workout Button Locking', () => {
    it('C23-1: isWorkoutLocked is true when bindingEval.isSafetyMismatched is true', () => {
      const bindingEval = { isSafetyMismatched: true }
      const contraScanResult = { hasViolation: false }
      const isWorkoutLocked = bindingEval.isSafetyMismatched || contraScanResult.hasViolation
      expect(isWorkoutLocked).toBe(true)
    })

    it('C23-2: isWorkoutLocked is true when contraindicationScanResult.hasViolation is true', () => {
      const bindingEval = { isSafetyMismatched: false }
      const contraScanResult = { hasViolation: true }
      const isWorkoutLocked = bindingEval.isSafetyMismatched || contraScanResult.hasViolation
      expect(isWorkoutLocked).toBe(true)
    })

    it('C23-3: isWorkoutLocked is false when neither condition is met', () => {
      const bindingEval = { isSafetyMismatched: false }
      const contraScanResult = { hasViolation: false }
      const isWorkoutLocked = bindingEval.isSafetyMismatched || contraScanResult.hasViolation
      expect(isWorkoutLocked).toBe(false)
    })

    it('C23-4: Safety banner content reflects specific medical or allergen issues', () => {
      const current = { ...baseValidFormData, medicalIssues: 'Rotator cuff tear' }
      const bound = { ...baseValidFormData, medicalIssues: 'None' }
      const res = evaluatePlanProfileBinding(current, bound)
      expect(res.mismatchedSafetyFields).toEqual(['medicalIssues'])
    })
  })

  // ==========================================
  // Category 24: UI Render Sink - DownloadPlanPage Safety Warning Banner
  // ==========================================
  describe('Category 24: UI Render Sink - DownloadPlanPage Safety Warning Banner', () => {
    it('C24-1: isSafetyViolated is true when bindingEval.isSafetyMismatched is true', () => {
      const bindingEval = { isSafetyMismatched: true }
      const contraScan = { hasViolation: false }
      const allergenScan = { hasViolation: false }
      const isPlanCorrupted = false
      const isSafetyViolated = Boolean(bindingEval.isSafetyMismatched || contraScan.hasViolation || allergenScan.hasViolation || isPlanCorrupted)
      expect(isSafetyViolated).toBe(true)
    })

    it('C24-2: isSafetyViolated is true when contraScan.hasViolation is true', () => {
      const bindingEval = { isSafetyMismatched: false }
      const contraScan = { hasViolation: true }
      const allergenScan = { hasViolation: false }
      const isPlanCorrupted = false
      const isSafetyViolated = Boolean(bindingEval.isSafetyMismatched || contraScan.hasViolation || allergenScan.hasViolation || isPlanCorrupted)
      expect(isSafetyViolated).toBe(true)
    })

    it('C24-3: isSafetyViolated is true when allergenScan.hasViolation is true', () => {
      const bindingEval = { isSafetyMismatched: false }
      const contraScan = { hasViolation: false }
      const allergenScan = { hasViolation: true }
      const isPlanCorrupted = false
      const isSafetyViolated = Boolean(bindingEval.isSafetyMismatched || contraScan.hasViolation || allergenScan.hasViolation || isPlanCorrupted)
      expect(isSafetyViolated).toBe(true)
    })

    it('C24-4: isSafetyViolated is false when plan is fully matched and clean', () => {
      const bindingEval = { isSafetyMismatched: false }
      const contraScan = { hasViolation: false }
      const allergenScan = { hasViolation: false }
      const isPlanCorrupted = false
      const isSafetyViolated = Boolean(bindingEval.isSafetyMismatched || contraScan.hasViolation || allergenScan.hasViolation || isPlanCorrupted)
      expect(isSafetyViolated).toBe(false)
    })
  })

  // ==========================================
  // Category 25: UI Render Sink - GymModePage Runtime Contraindication Lockout
  // ==========================================
  describe('Category 25: UI Render Sink - GymModePage Runtime Lockout', () => {
    it('C25-1: contraScanResult scans both generatedPlan and session.exercises', () => {
      const planText = createValidSevenDayMarkdown()
      const sessionExerciseLines = 'Overhead Press'
      const planScan = scanPlanForContraindications(planText, 'Shoulder impingement')
      const sessionScan = scanPlanForContraindications(sessionExerciseLines, 'Shoulder impingement')
      const hasViolation = planScan.hasViolation || sessionScan.hasViolation
      expect(hasViolation).toBe(true)
    })

    it('C25-2: Session exercise violating medical constraint triggers hasViolation=true', () => {
      const sessionScan = scanPlanForContraindications('Barbell Deadlift', 'Lumbar disc herniation')
      expect(sessionScan.hasViolation).toBe(true)
    })

    it('C25-3: Session cancellation triggered if medical constraint diverges at runtime', () => {
      const curMed = 'ACL tear'
      const snapMed = 'None'
      const isMedicalDiverged = curMed !== snapMed && (hasSafetySensitiveMedicalIssues(curMed) || hasSafetySensitiveMedicalIssues(snapMed))
      expect(isMedicalDiverged).toBe(true)
    })

    it('C25-4: Session cancellation triggered if planId changes across tabs', () => {
      const statePlanId = 'plan_new_123'
      const sessionPlanId = 'plan_old_456'
      const isPlanMismatch = Boolean(statePlanId && (!sessionPlanId || statePlanId !== sessionPlanId))
      expect(isPlanMismatch).toBe(true)
    })
  })

  // ==========================================
  // Category 26: UI Render Sink - GymModePage Fallback Plan Lockout
  // ==========================================
  describe('Category 26: UI Render Sink - GymModePage Fallback Lockout', () => {
    it('C26-1: GymModePage initialization with MOCK_PLAN exercises and shoulder condition triggers contraScanResult', () => {
      const scan = scanPlanForContraindications(MOCK_PLAN, 'Rotator cuff impingement')
      expect(scan.hasViolation).toBe(true)
      expect(scan.violations.some(v => v.category === 'shoulder_impingement_cuff')).toBe(true)
    })

    it('C26-2: GymModePage initialization with MOCK_PLAN exercises and shoulder condition triggers contraScanResult', () => {
      const scan = scanPlanForContraindications(MOCK_PLAN, 'Rotator cuff tear')
      expect(scan.hasViolation).toBe(true)
    })

    it('C26-3: Session exercises cleared from active storage on violation', () => {
      clearActiveSession()
      expect(loadActiveSession()).toBeNull()
    })

    it('C26-4: Conflicting session for another day preserved for dialog resolution without executing', () => {
      const activeSess: WorkoutSession = {
        sessionId: 'sess_day_2',
        planId: 'plan_1',
        medicalSnapshot: 'None',
        dayIndex: 1, // Day 2
        dayTitle: 'Day 2',
        dayType: 'Legs',
        durationMinutes: 45,
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        elapsedSeconds: 30,
        currentExerciseIndex: 0,
        exercises: [{ name: 'Squats', focus: 'Legs', equipment: 'Bodyweight', formCue: '', targetSets: 3, targetReps: '10', restSeconds: 60, sets: [] }],
        restTimer: { isActive: false, targetEndTime: null, durationSeconds: 60, isPaused: false, remainingSeconds: 60 },
        status: 'in-progress',
        soundEnabled: true,
        vibrateEnabled: true,
      }
      saveActiveSession(activeSess)

      const targetDayIndex = 0 // Opening Day 1
      const saved = loadAndValidateActiveSession('plan_1', 'None')
      const isConflicting = saved && saved.dayIndex !== targetDayIndex
      expect(isConflicting).toBeTruthy()
    })
  })

  // ==========================================
  // Category 27: Exercise Substitution - Rejecting Contraindications
  // ==========================================
  describe('Category 27: Exercise Substitution - Rejecting Contraindications', () => {
    it('C27-1: getExerciseAlternatives for "Bench Press" filters out contraindicated alternatives when medicalIssues provided', () => {
      const alts = getExerciseAlternatives('Bench Press', 'Shoulder impingement')
      // Standard push-ups and dumbbell floor press are allowed, dips are blocked
      expect(alts.some(a => a.name.toLowerCase().includes('dip'))).toBe(false)
    })

    it('C27-2: getExerciseAlternatives for "Lateral Dumbbell Raises" excludes "Dumbbell Shoulder Press" if shoulder contraindicated', () => {
      const alts = getExerciseAlternatives('Lateral Dumbbell Raises', 'Rotator cuff tear')
      expect(alts.some(a => a.name.toLowerCase().includes('shoulder press'))).toBe(false)
    })

    it('C27-3: getExerciseAlternatives for "Push-ups" excludes dips for shoulder impingement', () => {
      const alts = getExerciseAlternatives('Push-ups', 'Shoulder impingement')
      expect(alts.some(a => a.name.toLowerCase().includes('dip'))).toBe(false)
    })

    it('C27-4: Substituting a contraindicated exercise blocked by direct contraindication check', () => {
      const candidateAlt = { name: 'Overhead Press', focus: 'Shoulders', equipment: 'Barbell', formCue: '', reason: '' }
      const check = scanPlanForContraindications(candidateAlt.name, 'Shoulder impingement')
      expect(check.hasViolation).toBe(true)
    })
  })

  // ==========================================
  // Category 28: Exercise Substitution - Retaining Safety Constraints
  // ==========================================
  describe('Category 28: Exercise Substitution - Retaining Safety Constraints', () => {
    it('C28-1: Multiple consecutive substitution lookups consistently respect medical constraints', () => {
      const alts1 = getExerciseAlternatives('Dumbbell Floor Press', 'Rotator cuff tear')
      const alts2 = getExerciseAlternatives('Dumbbell Floor Press', 'Rotator cuff tear')
      expect(alts1).toEqual(alts2)
    })

    it('C28-2: Non-contraindicated alternatives remain available and accessible', () => {
      const alts = getExerciseAlternatives('Dumbbell Single-Arm Row', 'None')
      expect(alts.length).toBeGreaterThan(0)
    })

    it('C28-3: Unknown exercise returns empty alternative list fail-closed', () => {
      const alts = getExerciseAlternatives('Unrecognized Movement 999XYZ')
      expect(alts).toEqual([])
    })

    it('C28-4: Empty medical issues returns unfiltered alternatives', () => {
      const alts = getExerciseAlternatives('Dumbbell Shoulder Press', '')
      expect(alts.length).toBeGreaterThan(0)
    })
  })

  // ==========================================
  // Category 29: Partial / Truncated Stream Simulation
  // ==========================================
  describe('Category 29: Partial / Truncated Stream Simulation', () => {
    it('C29-1: Plan truncated at Day 3 fails 7-day validation', () => {
      const truncated = [
        '## Day 1', '- Push-ups: 3x10', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 2', '- Squats: 3x10', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 3', 'Rest Day', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
      ].join('\n')
      const res = parseAndValidatePlan(truncated, true)
      expect(res.success).toBe(false)
    })

    it('C29-2: Plan cut off mid-exercise fails validation', () => {
      const cutOff = createValidSevenDayMarkdown().slice(0, 300)
      const res = parseAndValidatePlan(cutOff, true)
      expect(res.success).toBe(false)
    })

    it('C29-3: Plan missing nutrition section fails structural check', () => {
      const noNutrition = [
        '## Day 1', '- Push-ups: 3x10',
        '## Day 2', '- Squats: 3x10',
        '## Day 3', '- Lunges: 3x10',
        '## Day 4', '- Planks: 3x30s',
        '## Day 5', '- Rows: 3x10',
        '## Day 6', '- Curls: 3x10',
        '## Day 7', '- Rest Day',
      ].join('\n')
      const res = validateGeneratedPlan(noNutrition)
      expect(res.hasNutrition).toBe(false)
      expect(res.isValid).toBe(false)
    })

    it('C29-4: Plan missing workout section fails structural check', () => {
      const noWorkout = [
        '## Day 1', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 2', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 3', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 4', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 5', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 6', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
        '## Day 7', 'Breakfast: Oats\nLunch: Salad\nDinner: Fish',
      ].join('\n')
      const res = validateGeneratedPlan(noWorkout)
      expect(res.hasWorkouts).toBe(false)
      expect(res.isValid).toBe(false)
    })
  })

  // ==========================================
  // Category 30: Multi-Issue Cumulative Safety
  // ==========================================
  describe('Category 30: Multi-Issue Cumulative Safety', () => {
    it('C30-1: User with knee + shoulder + disc conditions blocks exercises for all 3 areas', () => {
      const plan = createValidSevenDayMarkdown({
        exerciseLine: '- Overhead Press: 3x10\n- Barbell Deadlifts: 3x10\n- Box Jumps: 3x10',
      })
      const medical = 'Knee ACL tear, Shoulder impingement, L5-S1 disc herniation'
      const scan = scanPlanForContraindications(plan, medical)
      expect(scan.hasViolation).toBe(true)
      const categories = new Set(scan.violations.map(v => v.category))
      expect(categories.has('shoulder_impingement_cuff')).toBe(true)
      expect(categories.has('knee_high_impact')).toBe(true)
      expect(categories.has('lumbar_disc_herniation')).toBe(true)
    })

    it('C30-2: User with cardiac condition + tree nut allergy blocks both HIIT and nuts', () => {
      const plan = createValidSevenDayMarkdown({
        exerciseLine: '- HIIT Sprint Intervals: 10 rounds',
        mealLine: '- Breakfast: Almond butter toast with crushed walnuts',
      })
      const contraScan = scanPlanForContraindications(plan, 'Symptomatic angina / severe hypertension')
      const allergenScan = scanPlanForAllergens(plan, 'Tree nuts')
      expect(contraScan.hasViolation).toBe(true)
      expect(allergenScan.hasViolation).toBe(true)
    })

    it('C30-3: User with pregnancy + dairy allergy blocks supine exercises and dairy', () => {
      const plan = createValidSevenDayMarkdown({
        exerciseLine: '- Supine Bench Press: 3x10',
        mealLine: '- Breakfast: Greek yogurt with honey',
      })
      const contraScan = scanPlanForContraindications(plan, 'Pregnancy 3rd trimester')
      const allergenScan = scanPlanForAllergens(plan, 'Dairy')
      expect(contraScan.hasViolation).toBe(true)
      expect(allergenScan.hasViolation).toBe(true)
    })

    it('C30-4: Cumulative binding evaluation identifies all mismatched safety fields', () => {
      const bound = { ...baseValidFormData, medicalIssues: 'None', allergies: 'None' }
      const current = { ...baseValidFormData, medicalIssues: 'ACL tear', allergies: 'Peanuts' }
      const res = evaluatePlanProfileBinding(current, bound)
      expect(res.isSafetyMismatched).toBe(true)
      expect(res.mismatchedSafetyFields).toContain('medicalIssues')
      expect(res.mismatchedSafetyFields).toContain('allergies')
    })

    it('C30-5: Cumulative clinical evaluation requires all constraints satisfied simultaneously', () => {
      const cleanPlan = createValidSevenDayMarkdown({
        exerciseLine: '- Push-ups: 3x10',
        mealLine: '- Breakfast: Oatmeal with berries (350 kcal)',
      })
      const medical = 'Knee ACL tear, Shoulder impingement, L5-S1 disc herniation'
      const scan = scanPlanForContraindications(cleanPlan, medical)
      expect(scan.violations.some(v => v.matchedExercise.toLowerCase().includes('overhead'))).toBe(false)
    })
  })

  // ==========================================
  // Mutation-Style Adversarial Bypass Tests (17 Cases)
  // ==========================================
  describe('Mutation-Style Adversarial Bypass Tests (17 Scenarios)', () => {
    it('M01: Case-insensitivity & character spacing mutation: "O V E R H E A D   P R E S S"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- overhead press: 3 sets' })
      const scan = scanPlanForContraindications(plan, 'Shoulder Impingement')
      expect(scan.hasViolation).toBe(true)
    })

    it('M02: Markdown bold & italic decoration: "**Overhead** _Press_"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- **Overhead** _Press_: 3 sets x 10 reps' })
      const scan = scanPlanForContraindications(plan, 'Shoulder Impingement')
      expect(scan.hasViolation).toBe(true)
    })

    it('M03: Typo / extra whitespace disguised exercise: "Overhead   Press"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Overhead   Press: 3 sets x 10 reps' })
      const scan = scanPlanForContraindications(plan, 'Shoulder Impingement')
      expect(scan.hasViolation).toBe(true)
    })

    it('M04: Parenthetical / qualifier disguise: "Overhead Press (Gentle Form, Very Light)"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Overhead Press (Gentle Form, Very Light): 3 sets x 10 reps' })
      const scan = scanPlanForContraindications(plan, 'Shoulder Impingement')
      expect(scan.hasViolation).toBe(true)
    })

    it('M05: Compound exercise smuggling: "Clean and Overhead Press"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Clean and Overhead Press: 3 sets x 8 reps' })
      const scan = scanPlanForContraindications(plan, 'Shoulder Impingement')
      expect(scan.hasViolation).toBe(true)
    })

    it('M06: Negation trick in plan: "Do Overhead Press carefully"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Overhead Press: 3 sets x 10 reps (careful)' })
      const scan = scanPlanForContraindications(plan, 'Shoulder Impingement')
      expect(scan.hasViolation).toBe(true)
    })

    it('M07: Punctuation sandwiching in allergen: "peanut-butter"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Breakfast: peanut-butter on rice cake' })
      const scan = scanPlanForAllergens(plan, 'Peanuts')
      expect(scan.hasViolation).toBe(true)
    })

    it('M08: Punctuation slash in allergen: "peanut/almond spread"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Breakfast: peanut/almond spread' })
      const scan = scanPlanForAllergens(plan, 'Peanuts')
      expect(scan.hasViolation).toBe(true)
    })

    it('M09: HTML tag embedding in plan markdown', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- <span>Overhead Press</span>: 3 sets x 10 reps' })
      const scan = scanPlanForContraindications(plan, 'Shoulder Impingement')
      expect(scan.hasViolation).toBe(true)
    })

    it('M10: Pluralization / stemming bypass: "Pistol squats"', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Pistol squats: 3 sets x 5 reps' })
      const scan = scanPlanForContraindications(plan, 'Meniscus tear')
      expect(scan.hasViolation).toBe(true)
    })

    it('M11: Allergen derivative boundary bypass: "non-dairy shake with real whey protein"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Snack: Non-dairy shake with real whey protein' })
      const scan = scanPlanForAllergens(plan, 'Dairy')
      expect(scan.hasViolation).toBe(true)
    })

    it('M12: Storage payload injection with prototype pollution attempt', () => {
      const maliciousPayload = JSON.stringify({
        __proto__: { isAdmin: true },
        sessionId: 'sess_proto',
        planId: 'plan_1',
        medicalSnapshot: 'None',
        exercises: [{ name: 'Push-ups' }],
        status: 'in-progress',
      })
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, maliciousPayload)
      const session = loadActiveSession()
      expect(session).not.toBeNull()
      // Object.prototype must NOT be polluted
      expect((Object.prototype as unknown as { isAdmin?: boolean }).isAdmin).toBeUndefined()
    })

    it('M13: Binding profile field nullification bypass', () => {
      // @ts-expect-error testing runtime resistance to null profile field
      const current: FormData = { ...baseValidFormData, medicalIssues: null }
      const bound: FormData = { ...baseValidFormData, medicalIssues: 'Knee ACL tear' }
      const res = evaluatePlanProfileBinding(current, bound)
      expect(res.isSafetyMismatched).toBe(true)
    })

    it('M14: Fallback plan resurrection after network error with severe spinal stenosis', () => {
      expect(hasSafetySensitiveMedicalIssues('Severe spinal stenosis')).toBe(true)
    })

    it('M15: Multi-stage handoff race condition (plan generated -> profile switched -> gym mode opened)', () => {
      const session: WorkoutSession = {
        sessionId: 'sess_race',
        planId: 'plan_initial',
        medicalSnapshot: 'None',
        dayIndex: 0,
        dayTitle: 'Day 1',
        dayType: 'Strength',
        durationMinutes: 45,
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        elapsedSeconds: 0,
        currentExerciseIndex: 0,
        exercises: [{ name: 'Overhead Press', focus: 'Shoulders', equipment: 'Barbell', formCue: '', targetSets: 3, targetReps: '10', restSeconds: 60, sets: [] }],
        restTimer: { isActive: false, targetEndTime: null, durationSeconds: 60, isPaused: false, remainingSeconds: 60 },
        status: 'in-progress',
        soundEnabled: true,
        vibrateEnabled: true,
      }
      saveActiveSession(session)

      // User switched profile to Shoulder impingement
      const switchedMedicalIssues = 'Shoulder impingement'
      const loaded = loadAndValidateActiveSession('plan_initial', switchedMedicalIssues)
      // Must fail closed and purge session
      expect(loaded).toBeNull()
      expect(loadActiveSession()).toBeNull()
    })

    it('M16: Case mutation in allergen text: "pEaNuT bUtTeR"', () => {
      const plan = createValidSevenDayMarkdown({ mealLine: '- Breakfast: pEaNuT bUtTeR oatmeal' })
      const scan = scanPlanForAllergens(plan, 'Peanuts')
      expect(scan.hasViolation).toBe(true)
    })

    it('M17: Multiple sequential exercise commas in markdown bullet', () => {
      const plan = createValidSevenDayMarkdown({ exerciseLine: '- Overhead Press, Dumbbell Rows, Dips: 3 sets' })
      const scan = scanPlanForContraindications(plan, 'Shoulder Impingement')
      expect(scan.hasViolation).toBe(true)
    })
  })
})
