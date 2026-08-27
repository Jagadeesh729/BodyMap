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
})
