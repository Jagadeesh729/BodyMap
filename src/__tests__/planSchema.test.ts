import { describe, it, expect } from 'vitest'
import { parseAndValidatePlan } from '../lib/planSchema'


const FULL_SEVEN_DAY_PLAN = `
## Day 1 - Chest & Triceps
**Warm-up:** 5 mins arm circles
- Push-ups: 3 sets x 12 reps (60s rest)
- Dips: 3 sets x 10 reps
**Cool-down:** 5 mins stretching
**Meals:**
- Breakfast: Oatmeal with eggs (400 kcal)
- Lunch: Grilled chicken bowl (550 kcal)
- Dinner: Salmon with quinoa (600 kcal)
- Snacks: Greek yogurt (200 kcal)

## Day 2 - Back & Biceps
**Warm-up:** 5 mins shoulder rolls
- Pull-ups: 3 sets x 8 reps
- Dumbbell Rows: 3 sets x 12 reps
**Cool-down:** 5 mins upper body stretch
**Meals:**
- Breakfast: Protein smoothie (350 kcal)
- Lunch: Turkey wrap (500 kcal)
- Dinner: Steak with asparagus (650 kcal)

## Day 3 - Legs & Core
**Warm-up:** 5 mins leg swings
- Bodyweight Squats: 4 sets x 15 reps
- Lunges: 3 sets x 12 reps
- Plank: 3 sets x 45s
**Cool-down:** 5 mins quad stretch
**Meals:**
- Breakfast: Scrambled eggs & toast (450 kcal)
- Lunch: Tuna salad (450 kcal)
- Dinner: Chicken breast with sweet potato (550 kcal)

## Day 4 - Active Recovery
**Activities:** 30 mins brisk walk and mobility
**Meals:**
- Breakfast: Berry smoothie (300 kcal)
- Lunch: Lentil soup with bread (400 kcal)
- Dinner: Baked cod with vegetables (450 kcal)

## Day 5 - Shoulders & Arms
**Warm-up:** 5 mins jumping jacks
- Overhead Press: 3 sets x 10 reps
- Lateral Raises: 3 sets x 15 reps
**Cool-down:** 5 mins shoulder stretch
**Meals:**
- Breakfast: Overnight oats with peanut butter (500 kcal)
- Lunch: Chicken rice bowl (600 kcal)
- Dinner: Tofu stir-fry (450 kcal)

## Day 6 - Full Body HIIT
**Warm-up:** 5 mins dynamic stretch
- Burpees: 4 sets x 10 reps
- Mountain Climbers: 4 sets x 20 reps
**Cool-down:** 5 mins full stretch
**Meals:**
- Breakfast: Egg white omelet with avocado (400 kcal)
- Lunch: Roast beef sandwich (550 kcal)
- Dinner: Grilled shrimp with rice (500 kcal)

## Day 7 - Rest & Meal Prep
**Activities:** Rest day and hydration
**Meals:**
- Breakfast: Pancakes with fruit (450 kcal)
- Lunch: Meal prep chicken and vegetables (500 kcal)
- Dinner: Homemade vegetable pasta (550 kcal)

> "Consistency beats intensity every single day."
`

describe('Zod AI Plan Schema and Parser', () => {
  it('successfully parses and validates full 7-day workout plans with exercise extraction', () => {
    const result = parseAndValidatePlan(FULL_SEVEN_DAY_PLAN, true)
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.days.length).toBe(7)


    expect(result.data?.days[0].workout?.exercises.length).toBe(2)
    expect(result.data?.days[0].workout?.exercises[0].name).toBe('Push-ups')
    expect(result.data?.days[0].workout?.exercises[0].sets).toBe('3')
    expect(result.data?.days[0].workout?.exercises[0].reps).toBe('12')
    expect(result.data?.days[0].nutrition?.breakfast).toContain('Oatmeal with eggs')
    expect(result.data?.motivationalQuote).toBe('Consistency beats intensity every single day.')
  })

  it('rejects 6-day plans when exactly 7 days are required', () => {
    const sixDayPlan = `
## Day 1 - Upper
**Meals:** Breakfast: Eggs, Lunch: Rice, Dinner: Fish
## Day 2 - Lower
**Meals:** Breakfast: Eggs, Lunch: Rice, Dinner: Fish
## Day 3 - Rest
**Meals:** Breakfast: Eggs, Lunch: Rice, Dinner: Fish
## Day 4 - Core
**Meals:** Breakfast: Eggs, Lunch: Rice, Dinner: Fish
## Day 5 - Arms
**Meals:** Breakfast: Eggs, Lunch: Rice, Dinner: Fish
## Day 6 - Cardio
**Meals:** Breakfast: Eggs, Lunch: Rice, Dinner: Fish
`
    const res = parseAndValidatePlan(sixDayPlan, true)
    expect(res.success).toBe(false)
    expect(res.errors?.[0]).toContain('Plan must contain exactly 7 days')
  })

  it('rejects duplicate day headers', () => {
    const duplicatePlan = `
## Day 1 - Chest
**Meals:** Breakfast: Eggs, Lunch: Rice, Dinner: Fish
## Day 1 - Duplicate Chest
**Meals:** Breakfast: Eggs, Lunch: Rice, Dinner: Fish
`
    const res = parseAndValidatePlan(duplicatePlan, false)
    expect(res.success).toBe(false)
    expect(res.errors?.[0]).toContain('Duplicate Day 1')
  })

  it('rejects empty or whitespace-only inputs', () => {
    expect(parseAndValidatePlan('').success).toBe(false)
    expect(parseAndValidatePlan('   ').success).toBe(false)
  })

  it('rejects truncated inputs under 50 characters', () => {
    const res = parseAndValidatePlan('## Day 1: Short')
    expect(res.success).toBe(false)
    expect(res.errors?.[0]).toContain('too short')
  })

  it('rejects plans with no Day headers', () => {
    const res = parseAndValidatePlan('This is a workout plan with exercises but no day headers at all across paragraphs of text.')
    expect(res.success).toBe(false)
    expect(res.errors?.[0]).toContain('No valid Day headers')
  })

  it('correctly identifies rest and recovery days', () => {
    const restPlan = `## Day 1 - Active Recovery Day
**Activities:** 20 mins light walking and full body stretching
**Meals:**
- Breakfast: Fruit smoothie with protein
- Lunch: Turkey wrap with avocado
- Dinner: Grilled chicken and vegetables
`
    const res = parseAndValidatePlan(restPlan, false)
    expect(res.success).toBe(true)
    expect(res.data?.days[0].isRestDay).toBe(true)
  })
})


