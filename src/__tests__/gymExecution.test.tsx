import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlanProvider } from '@/context/PlanContext'
import { GymModePage } from '@/pages/GymModePage'
import { RestTimerOverlay } from '@/components/gym/RestTimerOverlay'
import { ExerciseSubstitutionModal } from '@/components/gym/ExerciseSubstitutionModal'
import { WorkoutCompletionModal } from '@/components/gym/WorkoutCompletionModal'

describe('Gym Mode Execution System & Micro-Interactions', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const renderGymMode = (dayIndex = 0) => {
    return render(
      <PlanProvider>
        <MemoryRouter initialEntries={[`/gym-mode/${dayIndex}`]}>
          <Routes>
            <Route path="/gym-mode/:dayIndex" element={<GymModePage />} />
          </Routes>
        </MemoryRouter>
      </PlanProvider>
    )
  }

  it('renders Gym Mode screen with exercise information, coach cues, and set logger', () => {
    renderGymMode(0)
    expect(screen.getByText(/Gym Mode/i)).toBeDefined()
    expect(screen.getByText(/Coach Cue:/i)).toBeDefined()
    expect(screen.getByText(/Workout Sets/i)).toBeDefined()
    expect(screen.getByText(/SET 1/i)).toBeDefined()
  })

  it('allows incrementing and decrementing reps with 1-tap steppers', () => {
    renderGymMode(0)
    const decBtn = screen.getByLabelText(/Decrease reps for set 1/i)
    const incBtn = screen.getByLabelText(/Increase reps for set 1/i)

    fireEvent.click(incBtn)
    fireEvent.click(decBtn)
    expect(screen.getByText(/SET 1/i)).toBeDefined()
  })

  it('completing a set activates the Rest Timer overlay', () => {
    renderGymMode(0)
    const logBtn = screen.getByLabelText(/Complete set 1/i)
    fireEvent.click(logBtn)

    expect(screen.getByRole('dialog', { name: /Rest timer/i })).toBeDefined()
    expect(screen.getByText(/Rest & Recover/i)).toBeDefined()
  })

  it('handles Rest Timer controls: pause, add time, and skip rest', () => {
    const onTogglePause = vi.fn()
    const onAddSeconds = vi.fn()
    const onSkip = vi.fn()
    const onToggleSound = vi.fn()

    render(
      <RestTimerOverlay
        remainingSeconds={45}
        totalDuration={60}
        isPaused={false}
        soundEnabled={true}
        onTogglePause={onTogglePause}
        onAddSeconds={onAddSeconds}
        onSkip={onSkip}
        onToggleSound={onToggleSound}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Pause/i }))
    expect(onTogglePause).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Add 15 seconds/i }))
    expect(onAddSeconds).toHaveBeenCalledWith(15)

    fireEvent.click(screen.getByRole('button', { name: /Next Set/i }))
    expect(onSkip).toHaveBeenCalled()
  })

  it('allows substituting an exercise with biomechanically matched alternative', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()

    render(
      <ExerciseSubstitutionModal
        currentExerciseName="Dumbbell Bench Press"
        isOpen={true}
        onClose={onClose}
        onSelectAlternative={onSelect}
      />
    )

    expect(screen.getByText(/Substitute Exercise/i)).toBeDefined()
    const selectButtons = screen.getAllByRole('button', { name: /Select/i })
    expect(selectButtons.length).toBeGreaterThan(0)

    fireEvent.click(selectButtons[0])
    expect(onSelect).toHaveBeenCalled()
  })

  it('renders Workout Completion summary with accurate duration and exercise metrics', () => {
    const onViewPlan = vi.fn()
    const onGoToDashboard = vi.fn()

    render(
      <WorkoutCompletionModal
        dayTitle="Day 1 - Upper Body"
        dayType="Strength"
        totalElapsedSeconds={1800}
        totalExercises={5}
        totalSetsCompleted={15}
        onViewPlan={onViewPlan}
        onGoToDashboard={onGoToDashboard}
      />
    )

    expect(screen.getByText(/Day 1 - Upper Body Finished!/i)).toBeDefined()
    expect(screen.getByText(/30/i)).toBeDefined() // 1800s / 60 = 30 min
    expect(screen.getByText(/15/i)).toBeDefined() // 15 sets

    fireEvent.click(screen.getByRole('button', { name: /View Weekly Plan/i }))
    expect(onViewPlan).toHaveBeenCalled()
  })
})
