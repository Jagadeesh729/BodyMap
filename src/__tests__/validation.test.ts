import { describe, it, expect } from 'vitest'
import { validateStep } from '../lib/validation'

describe('validateStep', () => {
  it('validates Step 1 correctly on empty fields', () => {
    const res = validateStep(1, {
      age: '',
      gender: '',
      height: '',
      weight: '',
      fitnessLevel: '',
      mainGoal: '',
      bodyFocus: [],
      timePerDay: '',
      medicalIssues: '',
      equipment: [],
      pushupCount: '',
      dietaryPreference: '',
      allergies: '',
      specialRequests: '',
      recoveryDays: '',
      sleepHours: '',
      stressLevel: ''
    })
    expect(res.success).toBe(false)
    expect(res.errors.age).toBeDefined()
    expect(res.errors.gender).toBeDefined()
    expect(res.errors.height).toBeDefined()
    expect(res.errors.weight).toBeDefined()
  })

  it('passes Step 1 with valid data', () => {
    const res = validateStep(1, {
      age: '28',
      gender: 'male',
      height: '178',
      weight: '75',
      fitnessLevel: 'intermediate',
      mainGoal: '',
      bodyFocus: [],
      timePerDay: '',
      medicalIssues: '',
      equipment: [],
      pushupCount: '',
      dietaryPreference: '',
      allergies: '',
      specialRequests: '',
      recoveryDays: '',
      sleepHours: '',
      stressLevel: ''
    })
    expect(res.success).toBe(true)
    expect(res.errors).toEqual({})
  })

  it('validates Step 2 goals and body focus selection', () => {
    const emptyRes = validateStep(2, {
      age: '28',
      gender: 'male',
      height: '178',
      weight: '75',
      fitnessLevel: 'intermediate',
      mainGoal: '',
      bodyFocus: [],
      timePerDay: '',
      medicalIssues: '',
      equipment: [],
      pushupCount: '',
      dietaryPreference: '',
      allergies: '',
      specialRequests: '',
      recoveryDays: '',
      sleepHours: '',
      stressLevel: ''
    })
    expect(emptyRes.success).toBe(false)
    expect(emptyRes.errors.mainGoal).toBeDefined()
    expect(emptyRes.errors.bodyFocus).toBeDefined()

    const validRes = validateStep(2, {
      age: '28',
      gender: 'male',
      height: '178',
      weight: '75',
      fitnessLevel: 'intermediate',
      mainGoal: 'muscle',
      bodyFocus: ['Chest', 'Arms'],
      timePerDay: '45',
      medicalIssues: '',
      equipment: [],
      pushupCount: '',
      dietaryPreference: '',
      allergies: '',
      specialRequests: '',
      recoveryDays: '',
      sleepHours: '',
      stressLevel: ''
    })
    expect(validRes.success).toBe(true)
  })

  it('passes Step 3 optional fields', () => {
    const res = validateStep(3, {
      age: '28',
      gender: 'male',
      height: '178',
      weight: '75',
      fitnessLevel: 'intermediate',
      mainGoal: 'muscle',
      bodyFocus: ['Chest'],
      timePerDay: '45',
      medicalIssues: 'None',
      equipment: ['Dumbbells'],
      pushupCount: '25',
      dietaryPreference: '',
      allergies: '',
      specialRequests: '',
      recoveryDays: '',
      sleepHours: '',
      stressLevel: ''
    })
    expect(res.success).toBe(true)
  })

  it('validates Step 4 dietary preference requirement', () => {
    const emptyRes = validateStep(4, {
      age: '28',
      gender: 'male',
      height: '178',
      weight: '75',
      fitnessLevel: 'intermediate',
      mainGoal: 'muscle',
      bodyFocus: ['Chest'],
      timePerDay: '45',
      medicalIssues: '',
      equipment: [],
      pushupCount: '',
      dietaryPreference: '',
      allergies: '',
      specialRequests: '',
      recoveryDays: '',
      sleepHours: '',
      stressLevel: ''
    })
    expect(emptyRes.success).toBe(false)
    expect(emptyRes.errors.dietaryPreference).toBeDefined()

    const validRes = validateStep(4, {
      age: '28',
      gender: 'male',
      height: '178',
      weight: '75',
      fitnessLevel: 'intermediate',
      mainGoal: 'muscle',
      bodyFocus: ['Chest'],
      timePerDay: '45',
      medicalIssues: '',
      equipment: [],
      pushupCount: '',
      dietaryPreference: 'omnivore',
      allergies: 'None',
      specialRequests: 'High protein',
      recoveryDays: '',
      sleepHours: '',
      stressLevel: ''
    })
    expect(validRes.success).toBe(true)
  })

  it('validates Step 5 recovery, sleep, and stress inputs', () => {
    const validRes = validateStep(5, {
      age: '28',
      gender: 'male',
      height: '178',
      weight: '75',
      fitnessLevel: 'intermediate',
      mainGoal: 'muscle',
      bodyFocus: ['Chest'],
      timePerDay: '45',
      medicalIssues: '',
      equipment: [],
      pushupCount: '',
      dietaryPreference: 'omnivore',
      allergies: '',
      specialRequests: '',
      recoveryDays: '2',
      sleepHours: '8-9',
      stressLevel: 'low'
    })
    expect(validRes.success).toBe(true)
  })
})
