import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { PlanProvider, usePlan } from '@/context/PlanContext'
import WeeklyPlanPage from '@/pages/WeeklyPlanPage'

const TestSetupWrapper = ({ children, customSetup }: { children: React.ReactNode, customSetup?: () => void }) => {
  const { dispatch } = usePlan()

  React.useEffect(() => {
    dispatch({
      type: 'SET_FORM_DATA',
      payload: {
        gender: 'male',
        age: '28',
        height: '178',
        weight: '75',
        fitnessLevel: 'intermediate',
        mainGoal: 'Muscle Gain',
        bodyFocus: ['Chest', 'Arms'],
        medicalConditions: '',
        pushupCount: '25',
        equipment: ['Dumbbells', 'Barbell'],
        dietaryPreference: 'omnivore',
        allergies: '',
        mealsPerDay: '3',
        specialDiet: '',
        sleepHours: '8',
        stressLevel: 'low',
        restDays: ['Sunday']
      }
    })
    dispatch({
      type: 'SET_GENERATED_PLAN',
      payload: '# Sample Plan\nDay 1: Chest workout\nDay 2: Back workout'
    })
    if (customSetup) {
      customSetup()
    }
  }, [dispatch, customSetup])

  return <>{children}</>
}

describe('WeeklyPlanPage Component Suite', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders WeeklyPlanPage without crashing and displays macro targets and hydration widget', () => {
    render(
      <BrowserRouter>
        <PlanProvider>
          <TestSetupWrapper>
            <WeeklyPlanPage />
          </TestSetupWrapper>
        </PlanProvider>
      </BrowserRouter>
    )

    // Verify main page title/elements
    expect(screen.getByText(/Your 7-Day Fitness & Diet Plan/i)).toBeDefined()
    // Verify macro target breakdown rendered with Flame icon
    expect(screen.getByText(/Daily Macro Target:/i)).toBeDefined()
    // Verify Hydration tracker
    expect(screen.getByText(/Hydration:/i)).toBeDefined()
  })

  it('renders MOCK_PLAN without markdown delimiter leakage in warm-up or cool-down', () => {
    const MockPlanWrapper = ({ children }: { children: React.ReactNode }) => {
      const { dispatch } = usePlan()
      React.useEffect(() => {
        dispatch({
          type: 'SET_GENERATED_PLAN',
          payload: `## Day 1 - Upper Body Strength Focus
**Warm-up:** 5 mins arm circles, jumping jacks, shoulder mobility
**Main Workout:**
- Push-ups: 3 sets x 12 reps
**Cool-down:** 5 mins chest & tricep static stretching
**Meals:**
- Breakfast: Oatmeal with berries (350 kcal)
- Lunch: Grilled chicken salad (450 kcal)
- Dinner: Baked salmon (500 kcal)
- Snacks: Greek yogurt (300 kcal)
`
        })
      }, [dispatch])
      return <>{children}</>
    }

    render(
      <BrowserRouter>
        <PlanProvider>
          <MockPlanWrapper>
            <WeeklyPlanPage />
          </MockPlanWrapper>
        </PlanProvider>
      </BrowserRouter>
    )

    // Warm-up and cool-down should not have leading **
    expect(screen.getByText(/5 mins arm circles, jumping jacks, shoulder mobility/i)).toBeDefined()
    expect(screen.queryByText(/•\*\*/i)).toBeNull()
    expect(screen.getByText(/5 mins chest & tricep static stretching/i)).toBeDefined()

    // Daily Nutrition Target should display derived sum (~1600 kcal), NOT ~350 kcal
    expect(screen.getByText(/~1600 kcal target/i)).toBeDefined()
    expect(screen.queryByText(/~350 kcal target/i)).toBeNull()
  })

  it('adjusts completion count and title dynamically for partial/degraded plans', () => {
    const DegradedPlanWrapper = ({ children }: { children: React.ReactNode }) => {
      const { dispatch } = usePlan()
      React.useEffect(() => {
        dispatch({
          type: 'SET_GENERATED_PLAN',
          payload: `## Day 1 - Strength
**Main Workout:**
- Push-ups: 3 sets x 10 reps
**Meals:**
- Breakfast: Eggs (300 kcal)
- Lunch: Chicken (400 kcal)
- Dinner: Fish (400 kcal)

## Day 2 - Cardio
**Main Workout:**
- Running: 20 mins
**Meals:**
- Breakfast: Oats (300 kcal)
- Lunch: Salad (400 kcal)
- Dinner: Soup (400 kcal)
`
        })
      }, [dispatch])
      return <>{children}</>
    }

    render(
      <BrowserRouter>
        <PlanProvider>
          <DegradedPlanWrapper>
            <WeeklyPlanPage />
          </DegradedPlanWrapper>
        </PlanProvider>
      </BrowserRouter>
    )

    // Denominator should match actual 2 days, not 7
    expect(screen.getByText(/Weekly Completion: 0 of 2 Days Done/i)).toBeDefined()
    expect(screen.getByText(/Your 7-Day Fitness & Diet Plan/i)).toBeDefined()
  })
})
