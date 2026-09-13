import { describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlanProvider } from '@/context/PlanContext'
import WeeklyPlanPage from '@/pages/WeeklyPlanPage'
import { GymModePage } from '@/pages/GymModePage'
import { ACTIVE_SESSION_STORAGE_KEY } from '@/lib/sessionStorage'
import { computeProfileFingerprint } from '@/lib/planBinding'

const valid7DayMarkdownPlan = `
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
- Breakfast: Scrambled tofu & fruit (350 kcal)
- Lunch: Salmon salad (500 kcal)
- Dinner: Lean beef with broccoli (550 kcal)

## Day 7 - Rest & Recovery
**Activities:** Gentle walk, meditation, 8+ hours sleep
**Meals:**
- Breakfast: Protein pancakes (400 kcal)
- Lunch: Mediterranean salad with chicken (500 kcal)
- Dinner: Grilled shrimp with roasted vegetables (500 kcal)
- Snacks: Mixed nuts (150 kcal)
`

const defaultTestFormData = {
  age: '28',
  gender: 'female',
  height: '165',
  weight: '60',
  fitnessLevel: 'intermediate',
  mainGoal: 'Full Body Tone',
  bodyFocus: ['Full Body'],
  timePerDay: '45',
  medicalIssues: '',
  equipment: ['Dumbbells'],
  pushupCount: '15',
  dietaryPreference: 'omnivore',
  allergies: '',
  specialRequests: '',
  recoveryDays: 'Sunday',
  sleepHours: '8',
  stressLevel: 'low'
}

function seedPlanState({
  planText = '',
  isGenerated = true,
  planId = 'plan_test_sync_1',
  completedDays = [] as Array<{ date: string; dayIndex: number }>
}) {
  const payload = {
    formData: defaultTestFormData,
    generatedPlan: planText,
    isGenerated,
    planId,
    planGeneratedAt: Date.now(),
    boundProfile: defaultTestFormData,
    boundProfileFingerprint: computeProfileFingerprint(defaultTestFormData),
    completedDays,
    weightLog: []
  }
  localStorage.setItem('bodymap_plan_v2', JSON.stringify(payload))
}

describe('Plan Corruption Safety Boundary & Execution Gate Invariant', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('locks WeeklyPlanPage Gym Mode buttons, Schedule Assistant, copy button, and renders alert when plan data is corrupted', () => {
    // Seed state with 1 completed day to trigger Schedule Assistant
    seedPlanState({
      planText: '{"corrupted": true}',
      isGenerated: true,
      completedDays: [{ date: '2026-09-13', dayIndex: 0 }]
    })

    render(
      <PlanProvider>
        <MemoryRouter initialEntries={['/weekly-plan']}>
          <WeeklyPlanPage />
        </MemoryRouter>
      </PlanProvider>
    )

    // Verify corruption alert banner is rendered with role="alert"
    expect(screen.getByRole('alert')).toBeDefined()
    expect(screen.getByText(/Corrupted or Invalid Plan Data Detected/i)).toBeDefined()
    expect(screen.getByText(/Plan export and workout execution are locked/i)).toBeDefined()

    // Verify Schedule Assistant button is locked
    expect(screen.getByText(/Schedule Assistant/i)).toBeDefined()
    const lockedBadges = screen.getAllByText('Locked')
    expect(lockedBadges.length).toBeGreaterThan(0)

    // Gym Mode link buttons must NOT exist in the DOM
    expect(screen.queryByRole('link', { name: /Gym Mode/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /Resume Day/i })).toBeNull()

    // Plan copy button must be disabled
    const copyBtn = screen.getByRole('button', { name: /Copy Plan/i }) as HTMLButtonElement
    expect(copyBtn.disabled).toBe(true)
  })

  it('renders Gym Mode Safety Lockout screen when navigating to /gym-mode/:id with corrupted plan data', () => {
    seedPlanState({
      planText: '{"bad_schema": "missing days"}',
      isGenerated: true
    })

    render(
      <PlanProvider>
        <MemoryRouter initialEntries={['/gym-mode/0']}>
          <Routes>
            <Route path="/gym-mode/:dayIndex" element={<GymModePage />} />
          </Routes>
        </MemoryRouter>
      </PlanProvider>
    )

    // Must trigger safety lockout
    expect(screen.getByRole('alert')).toBeDefined()
    expect(screen.getByText(/Workout Safety Lockout — Corrupted Plan Data/i)).toBeDefined()
    expect(screen.getByText(/Workout execution is locked to protect your training/i)).toBeDefined()
    expect(screen.getByText(/Plan data failed schema validation or structure is corrupted/i)).toBeDefined()

    // Workout sets or exercise cues must NOT be rendered
    expect(screen.queryByText(/Workout Sets/i)).toBeNull()
    expect(screen.queryByText(/Coach Cue:/i)).toBeNull()

    // Regenerate and Back buttons must be provided for safe user recovery
    expect(screen.getByRole('button', { name: /Regenerate Plan/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Back to My Plan/i })).toBeDefined()
  })

  it('allows normal workout execution when plan data is completely valid', () => {
    seedPlanState({
      planText: valid7DayMarkdownPlan,
      isGenerated: true,
      planId: 'plan_valid_123'
    })

    render(
      <PlanProvider>
        <MemoryRouter initialEntries={['/gym-mode/0']}>
          <Routes>
            <Route path="/gym-mode/:dayIndex" element={<GymModePage />} />
          </Routes>
        </MemoryRouter>
      </PlanProvider>
    )

    // Normal Gym Mode should be active
    expect(screen.getByText(/Gym Mode/i)).toBeDefined()
    expect(screen.getByText(/Coach Cue:/i)).toBeDefined()
    expect(screen.getByText(/Workout Sets/i)).toBeDefined()
    expect(screen.queryByText(/Workout Safety Lockout/i)).toBeNull()
  })

  it('cancels active in-progress session if plan data becomes corrupted', () => {
    const planId = 'plan_test_corrupt_active'
    // Seed active session in localStorage
    const activeSession = {
      sessionId: 'sess_corrupt_test_1',
      planId,
      medicalSnapshot: '',
      dayIndex: 0,
      dayTitle: 'Day 1',
      dayType: 'Full Body Tone',
      durationMinutes: 45,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      elapsedSeconds: 120,
      currentExerciseIndex: 0,
      exercises: [
        {
          id: 'ex_1',
          name: 'Push-up',
          targetSets: 3,
          targetReps: 10,
          restSeconds: 60,
          sets: [{ setNumber: 1, reps: 10, weightKg: 0, completed: false, rpe: 8 }]
        }
      ],
      restTimer: {
        isActive: false,
        targetEndTime: null,
        durationSeconds: 60,
        isPaused: false,
        remainingSeconds: 60
      },
      status: 'in-progress',
      soundEnabled: true,
      vibrateEnabled: true
    }
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(activeSession))

    seedPlanState({
      planText: 'corrupted unparsable text',
      isGenerated: true,
      planId
    })

    render(
      <PlanProvider>
        <MemoryRouter initialEntries={['/gym-mode/0']}>
          <Routes>
            <Route path="/gym-mode/:dayIndex" element={<GymModePage />} />
          </Routes>
        </MemoryRouter>
      </PlanProvider>
    )

    // Active session should be invalidated and cleared
    expect(localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull()
    // Safety lockout screen rendered
    expect(screen.getByText(/Workout Safety Lockout — Corrupted Plan Data/i)).toBeDefined()
  })

  it('demo state (isGenerated=false) does not trigger corruption alert and keeps sample plan interactive', () => {
    seedPlanState({
      planText: '',
      isGenerated: false,
      planId: undefined
    })

    render(
      <PlanProvider>
        <MemoryRouter initialEntries={['/weekly-plan']}>
          <WeeklyPlanPage />
        </MemoryRouter>
      </PlanProvider>
    )

    // Corruption alert must NOT be present
    expect(screen.queryByText(/Corrupted or Invalid Plan Data Detected/i)).toBeNull()
    // Sample plan indicator must be displayed
    expect(screen.getByText(/Viewing Sample 7-Day Plan/i)).toBeDefined()
    // Gym Mode links must be active
    const gymModeLinks = screen.getAllByRole('link', { name: /Gym Mode/i })
    expect(gymModeLinks.length).toBeGreaterThan(0)
  })
})
