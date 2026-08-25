import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { PlanProvider, usePlan } from '@/context/PlanContext'

// Test Consumer component simulating user actions across the app journey
function TestJourneyConsumer() {
  const { state, dispatch, setFormData, setGeneratedPlan, resetPlan } = usePlan()

  return (
    <div>
      <div data-testid="plan-status">{state.isGenerated ? 'PLAN_ACTIVE' : 'NO_PLAN'}</div>
      <div data-testid="completed-count">{state.completedDays.length}</div>
      <div data-testid="weight-count">{state.weightLog.length}</div>
      <div data-testid="user-goal">{state.formData.mainGoal}</div>

      <button
        onClick={() => {
          setFormData({ age: '28', height: '180', weight: '75', mainGoal: 'bulk' })
          setGeneratedPlan('## Day 1\n- Pushups\n**Meals:** Eggs')
        }}
      >
        Complete Creation Wizard
      </button>

      <button onClick={() => dispatch({ type: 'TOGGLE_DAY_COMPLETE', payload: { date: 'Aug 25', dayIndex: 0 } })}>
        Complete Day 1
      </button>

      <button onClick={() => dispatch({ type: 'LOG_WEIGHT', payload: { date: 'Aug 25', weight: 74.5 } })}>
        Log Dashboard Weight
      </button>

      <button onClick={() => resetPlan()}>
        Reset Entire Plan
      </button>
    </div>
  )
}

describe('End-to-End User Journey Simulation', () => {
  it('executes full lifecycle: creation -> day completion -> weight tracking -> reset', () => {
    render(
      <PlanProvider>
        <TestJourneyConsumer />
      </PlanProvider>
    )

    // Initial State
    expect(screen.getByTestId('plan-status').textContent).toBe('NO_PLAN')
    expect(screen.getByTestId('completed-count').textContent).toBe('0')
    expect(screen.getByTestId('weight-count').textContent).toBe('0')

    // Step 1: Complete Wizard & Generate Plan
    fireEvent.click(screen.getByText('Complete Creation Wizard'))
    expect(screen.getByTestId('plan-status').textContent).toBe('PLAN_ACTIVE')
    expect(screen.getByTestId('user-goal').textContent).toBe('bulk')

    // Step 2: Complete Workout on Day 1
    fireEvent.click(screen.getByText('Complete Day 1'))
    expect(screen.getByTestId('completed-count').textContent).toBe('1')

    // Step 3: Log Weight on Analytics Dashboard
    fireEvent.click(screen.getByText('Log Dashboard Weight'))
    expect(screen.getByTestId('weight-count').textContent).toBe('1')

    // Step 4: Reset Plan
    fireEvent.click(screen.getByText('Reset Entire Plan'))
    expect(screen.getByTestId('plan-status').textContent).toBe('NO_PLAN')
    expect(screen.getByTestId('completed-count').textContent).toBe('0')
    expect(screen.getByTestId('weight-count').textContent).toBe('0')
  })
})
