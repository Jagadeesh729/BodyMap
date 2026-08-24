import { describe, it, expect } from 'vitest'
import { generatePlanPrompt, validateGeneratedPlan, MOCK_PLAN } from '../lib/gemini'

describe('generatePlanPrompt', () => {
  it('builds a comprehensive prompt with user metrics and guidelines', () => {
    const prompt = generatePlanPrompt({
      age: '30',
      gender: 'female',
      height: '165',
      weight: '62',
      fitnessLevel: 'intermediate',
      mainGoal: 'muscle',
      bodyFocus: ['Legs', 'Glutes'],
      timePerDay: '45',
      medicalIssues: 'None',
      equipment: ['Dumbbells', 'Resistance Bands'],
      pushupCount: '15',
      dietaryPreference: 'vegetarian',
      allergies: 'Peanuts',
      specialRequests: 'High protein focus',
      recoveryDays: '2',
      sleepHours: '8-9',
      stressLevel: 'low'
    })

    expect(prompt).toContain('Age: 30')
    expect(prompt).toContain('Gender: female')
    expect(prompt).toContain('Height: 165')
    expect(prompt).toContain('Weight: 62')
    expect(prompt).toContain('Legs, Glutes')
    expect(prompt).toContain('Dumbbells, Resistance Bands')
    expect(prompt).toContain('vegetarian')
    expect(prompt).toContain('Peanuts')
    expect(prompt).toContain('Divide clearly into 7 distinct days')
  })

  it('has a fallback mock plan containing daily breakdown', () => {
    expect(MOCK_PLAN).toContain('Day 1')
    expect(MOCK_PLAN).toContain('Warm-up')
    expect(MOCK_PLAN).toContain('Main Workout')
    expect(MOCK_PLAN).toContain('Meals')
  })

  it('validates generated plan structure correctly', () => {
    expect(validateGeneratedPlan('').isValid).toBe(false)
    expect(validateGeneratedPlan('Too short').isValid).toBe(false)
    expect(validateGeneratedPlan('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.').isValid).toBe(false)
    expect(validateGeneratedPlan('## Day 1\nSome text with no workout and no nutrition information at all across multiple lines.').isValid).toBe(false)
    expect(validateGeneratedPlan(MOCK_PLAN).isValid).toBe(true)
    expect(validateGeneratedPlan(MOCK_PLAN).hasWorkouts).toBe(true)
    expect(validateGeneratedPlan(MOCK_PLAN).hasNutrition).toBe(true)
    expect(validateGeneratedPlan(MOCK_PLAN).dayCount).toBeGreaterThanOrEqual(1)
  })
})


