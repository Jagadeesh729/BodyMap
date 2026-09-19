/**
 * Enhancement E27-A: Gym Mode Ambient Feedback Preferences Persistence
 *
 * Dedicated Integration, UI, Cross-Tab & Adversarial Test Suite
 */

import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import {
  GYM_FEEDBACK_STORAGE_KEY,
  loadGymFeedbackPreferences,
  saveGymFeedbackPreferences,
  clearGymFeedbackPreferences,
  type GymFeedbackPreferences
} from '@/lib/gymFeedbackStorage'
import { GymModePage } from '@/pages/GymModePage'
import { PlanProvider, initialState, defaultFormData, type PlanState } from '@/context/PlanContext'
import { STORAGE_KEY as PLAN_STORAGE_KEY } from '@/context/planStorage'
import { saveActiveSession, ACTIVE_SESSION_STORAGE_KEY } from '@/lib/sessionStorage'
import type { WorkoutSession } from '@/types/workoutSession'
import type { FormData } from '@/types/formData'
import { MOCK_PLAN } from '@/lib/gemini'

const sampleProfile: FormData = {
  ...defaultFormData,
  age: '28',
  gender: 'female',
  height: '168',
  weight: '62',
  fitnessLevel: 'intermediate',
  mainGoal: 'strength',
  bodyFocus: ['Full Body'],
  timePerDay: '45',
  recoveryDays: '2',
  medicalIssues: 'None',
  dietaryPreference: 'omnivore',
  allergies: 'None',
  equipment: ['dumbbells', 'barbell'],
}

const mockWorkoutSession = (overrides?: Partial<WorkoutSession>): WorkoutSession => ({
  sessionId: 'sess_e27a_test',
  planId: 'plan_e27a_001',
  medicalSnapshot: 'None',
  dayIndex: 0,
  dayTitle: 'Day 1 - Full Body Strength',
  dayType: 'Strength',
  durationMinutes: 45,
  startedAt: Date.now() - 100_000,
  lastUpdatedAt: Date.now() - 10_000,
  elapsedSeconds: 90,
  currentExerciseIndex: 0,
  exercises: [
    {
      id: 'ex_1',
      name: 'Goblet Squats',
      originalName: 'Goblet Squats',
      targetSets: 3,
      targetReps: '10',
      restSeconds: 60,
      focus: 'Quads',
      equipment: 'Dumbbell',
      formCue: 'Keep chest high',
      sets: [
        {
          setNumber: 1,
          targetReps: 10,
          actualReps: 10,
          weightKg: null,
          isCompleted: false,
          completedAt: null
        }
      ],
      isSubstituted: false
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
  vibrateEnabled: true,
  ...overrides
})

function setupValidPlanInStorage(planId = 'plan_e27a_001') {
  const planState: PlanState = {
    ...initialState,
    formData: { ...sampleProfile },
    isGenerated: true,
    generatedPlan: MOCK_PLAN,
    planId,
    boundProfile: { ...sampleProfile },
    stateVersion: { counter: 1, timestamp: Date.now(), writerId: 'test_writer' }
  }
  localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(planState))
}

function renderGymMode(dayIndex = 0) {
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

describe('Enhancement E27-A: Gym Mode Ambient Feedback Preferences Persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    setupValidPlanInStorage()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('F1-F4: Initial Hydration & Default Fallback in GymModePage', () => {
    it('F1: initializes sound and vibration to enabled by default when storage is empty', () => {
      renderGymMode()

      const soundBtn = screen.getByLabelText(/mute timer chime/i)
      const vibrateBtn = screen.getByLabelText(/disable haptic vibration/i)

      expect(soundBtn).toBeDefined()
      expect(soundBtn.getAttribute('title')).toBe('Timer Chime Enabled')
      expect(vibrateBtn).toBeDefined()
      expect(vibrateBtn.getAttribute('title')).toBe('Haptic Vibration Enabled')
    })

    it('F2: hydrates sound disabled and vibration enabled from persisted storage', () => {
      saveGymFeedbackPreferences({ soundEnabled: false, vibrateEnabled: true })

      renderGymMode()

      const soundBtn = screen.getByLabelText(/enable timer chime/i)
      const vibrateBtn = screen.getByLabelText(/disable haptic vibration/i)

      expect(soundBtn).toBeDefined()
      expect(soundBtn.getAttribute('title')).toBe('Timer Chime Muted')
      expect(vibrateBtn).toBeDefined()
      expect(vibrateBtn.getAttribute('title')).toBe('Haptic Vibration Enabled')
    })

    it('F3: hydrates sound enabled and vibration disabled from persisted storage', () => {
      saveGymFeedbackPreferences({ soundEnabled: true, vibrateEnabled: false })

      renderGymMode()

      const soundBtn = screen.getByLabelText(/mute timer chime/i)
      const vibrateBtn = screen.getByLabelText(/enable haptic vibration/i)

      expect(soundBtn).toBeDefined()
      expect(soundBtn.getAttribute('title')).toBe('Timer Chime Enabled')
      expect(vibrateBtn).toBeDefined()
      expect(vibrateBtn.getAttribute('title')).toBe('Haptic Vibration Off')
    })

    it('F4: falls back to defaults when stored preferences contain corrupted JSON', () => {
      localStorage.setItem(GYM_FEEDBACK_STORAGE_KEY, '{malformed_json_###')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderGymMode()

      expect(screen.getByLabelText(/mute timer chime/i)).toBeDefined()
      expect(screen.getByLabelText(/disable haptic vibration/i)).toBeDefined()
      expect(warnSpy).toHaveBeenCalled()
    })
  })

  describe('U1-U4: User Interactions & Independent Persistence', () => {
    it('U1: clicking sound toggle mutes chime, updates UI, and persists to storage', () => {
      renderGymMode()

      const soundBtn = screen.getByLabelText(/mute timer chime/i)
      fireEvent.click(soundBtn)

      // UI should reflect muted state immediately
      expect(screen.getByLabelText(/enable timer chime/i)).toBeDefined()
      expect(screen.getByTitle('Timer Chime Muted')).toBeDefined()

      // Storage should have saved soundEnabled: false, vibrateEnabled: true
      const stored = loadGymFeedbackPreferences()
      expect(stored.soundEnabled).toBe(false)
      expect(stored.vibrateEnabled).toBe(true)
    })

    it('U2: clicking sound toggle twice restores enabled state and persists', () => {
      renderGymMode()

      const soundBtn = screen.getByLabelText(/mute timer chime/i)
      fireEvent.click(soundBtn)
      expect(loadGymFeedbackPreferences().soundEnabled).toBe(false)

      const mutedBtn = screen.getByLabelText(/enable timer chime/i)
      fireEvent.click(mutedBtn)

      expect(screen.getByLabelText(/mute timer chime/i)).toBeDefined()
      expect(loadGymFeedbackPreferences().soundEnabled).toBe(true)
    })

    it('U3: clicking vibration toggle disables haptic vibration and persists to storage', () => {
      renderGymMode()

      const vibrateBtn = screen.getByLabelText(/disable haptic vibration/i)
      fireEvent.click(vibrateBtn)

      // UI should reflect disabled state immediately
      expect(screen.getByLabelText(/enable haptic vibration/i)).toBeDefined()
      expect(screen.getByTitle('Haptic Vibration Off')).toBeDefined()

      // Storage should have saved vibrateEnabled: false, soundEnabled: true
      const stored = loadGymFeedbackPreferences()
      expect(stored.soundEnabled).toBe(true)
      expect(stored.vibrateEnabled).toBe(false)
    })

    it('U4: independently toggling both controls preserves both choices in storage', () => {
      renderGymMode()

      fireEvent.click(screen.getByLabelText(/mute timer chime/i))
      fireEvent.click(screen.getByLabelText(/disable haptic vibration/i))

      expect(screen.getByLabelText(/enable timer chime/i)).toBeDefined()
      expect(screen.getByLabelText(/enable haptic vibration/i)).toBeDefined()

      const stored = loadGymFeedbackPreferences()
      expect(stored).toEqual({ soundEnabled: false, vibrateEnabled: false })
    })
  })

  describe('R1-R2: RestTimerOverlay Integration', () => {
    it('R1: toggling sound inside active RestTimerOverlay persists preference to storage', () => {
      // Set active session with rest timer active
      const sessionWithTimer = mockWorkoutSession({
        restTimer: {
          isActive: true,
          targetEndTime: Date.now() + 60_000,
          durationSeconds: 60,
          isPaused: false,
          remainingSeconds: 45
        }
      })
      saveActiveSession(sessionWithTimer)

      renderGymMode()

      // RestTimerOverlay should be rendered
      const overlaySoundBtn = screen.getByLabelText(/disable timer sound/i)
      expect(overlaySoundBtn).toBeDefined()

      // Toggle sound off from the overlay
      fireEvent.click(overlaySoundBtn)

      // Both overlay and header reflect sound disabled
      expect(screen.getByLabelText(/enable timer sound/i)).toBeDefined()
      expect(loadGymFeedbackPreferences().soundEnabled).toBe(false)
    })

    it('R2: RestTimerOverlay reflects persisted preferences when initialized', () => {
      saveGymFeedbackPreferences({ soundEnabled: false, vibrateEnabled: true })
      const sessionWithTimer = mockWorkoutSession({
        restTimer: {
          isActive: true,
          targetEndTime: Date.now() + 60_000,
          durationSeconds: 60,
          isPaused: false,
          remainingSeconds: 45
        }
      })
      saveActiveSession(sessionWithTimer)

      renderGymMode()

      expect(screen.getByLabelText(/enable timer sound/i)).toBeDefined()
    })
  })

  describe('C1-C3: Multi-Session Continuity & Reload Resilience', () => {
    it('C1: preferences persist across component unmount and remount (simulating reload)', () => {
      const { unmount } = renderGymMode()

      // User mutes sound and disables haptics
      fireEvent.click(screen.getByLabelText(/mute timer chime/i))
      fireEvent.click(screen.getByLabelText(/disable haptic vibration/i))

      unmount()

      // Fresh remount (simulating page reload or new navigation)
      renderGymMode()

      expect(screen.getByLabelText(/enable timer chime/i)).toBeDefined()
      expect(screen.getByLabelText(/enable haptic vibration/i)).toBeDefined()
    })

    it('C2: preferences persist across subsequent Gym Mode sessions after previous workout is cleared', () => {
      const { unmount } = renderGymMode(0)

      // Toggle sound off
      fireEvent.click(screen.getByLabelText(/mute timer chime/i))
      expect(loadGymFeedbackPreferences().soundEnabled).toBe(false)

      unmount()
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)

      // Open Day 1 workout
      renderGymMode(1)

      expect(screen.getByLabelText(/enable timer chime/i)).toBeDefined()
      expect(screen.getByLabelText(/disable haptic vibration/i)).toBeDefined()
    })

    it('C3: clearing preferences restores defaults on next session load', () => {
      saveGymFeedbackPreferences({ soundEnabled: false, vibrateEnabled: false })
      expect(loadGymFeedbackPreferences()).toEqual({ soundEnabled: false, vibrateEnabled: false })

      clearGymFeedbackPreferences()

      renderGymMode()

      expect(screen.getByLabelText(/mute timer chime/i)).toBeDefined()
      expect(screen.getByLabelText(/disable haptic vibration/i)).toBeDefined()
    })
  })

  describe('X1-X2: Cross-Tab Synchronization', () => {
    it('X1: synchronizes sound and vibration in live GymModePage when another tab dispatches StorageEvent', () => {
      renderGymMode()

      // Initially enabled
      expect(screen.getByLabelText(/mute timer chime/i)).toBeDefined()
      expect(screen.getByLabelText(/disable haptic vibration/i)).toBeDefined()

      // Remote tab updates storage to both false
      saveGymFeedbackPreferences({ soundEnabled: false, vibrateEnabled: false })

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: GYM_FEEDBACK_STORAGE_KEY,
            newValue: JSON.stringify({ soundEnabled: false, vibrateEnabled: false })
          })
        )
      })

      // Live page should update buttons immediately
      expect(screen.getByLabelText(/enable timer chime/i)).toBeDefined()
      expect(screen.getByLabelText(/enable haptic vibration/i)).toBeDefined()
    })

    it('X2: ignores StorageEvents for unrelated keys without altering preferences', () => {
      renderGymMode()

      expect(screen.getByLabelText(/mute timer chime/i)).toBeDefined()

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'unrelated_storage_key',
            newValue: 'some_value'
          })
        )
      })

      expect(screen.getByLabelText(/mute timer chime/i)).toBeDefined()
      expect(loadGymFeedbackPreferences()).toEqual({ soundEnabled: true, vibrateEnabled: true })
    })
  })

  describe('S1-S3: Safety Boundaries & Data Confidentiality', () => {
    it('S1: safety lockout still takes precedence upon medical condition mismatch without corrupting feedback preferences', () => {
      saveGymFeedbackPreferences({ soundEnabled: false, vibrateEnabled: false })

      // Create diverged plan state with safety condition
      const dangerousState: PlanState = {
        ...initialState,
        formData: { ...sampleProfile, medicalIssues: 'Acute rotator cuff tear' },
        isGenerated: true,
        generatedPlan: MOCK_PLAN,
        planId: 'plan_e27a_001',
        boundProfile: { ...sampleProfile, medicalIssues: 'None' }, // Divergence!
        stateVersion: { counter: 2, timestamp: Date.now(), writerId: 'safety_test' }
      }
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(dangerousState))

      renderGymMode()

      // Safety lockout UI must be displayed
      expect(screen.getByText(/Safety Lockout/i)).toBeDefined()

      // Feedback preferences must remain uncorrupted
      expect(loadGymFeedbackPreferences()).toEqual({ soundEnabled: false, vibrateEnabled: false })
    })

    it('S2: feedback storage never contains medical snapshots, workouts, or personal identifiers', () => {
      renderGymMode()

      fireEvent.click(screen.getByLabelText(/mute timer chime/i))

      const raw = localStorage.getItem(GYM_FEEDBACK_STORAGE_KEY)
      expect(raw).not.toBeNull()

      const parsed = JSON.parse(raw!)
      const allowedKeys = ['soundEnabled', 'vibrateEnabled']
      const actualKeys = Object.keys(parsed)

      expect(actualKeys.sort()).toEqual(allowedKeys.sort())
      expect(typeof parsed.soundEnabled).toBe('boolean')
      expect(typeof parsed.vibrateEnabled).toBe('boolean')

      // Ensure no PHI or PII leak
      expect(raw).not.toContain('medical')
      expect(raw).not.toContain('tear')
      expect(raw).not.toContain('weight')
      expect(raw).not.toContain('exercise')
    })

    it('S3: validateGymFeedbackPreferences strictly purges any injected metadata', () => {
      const maliciousPayload = {
        soundEnabled: false,
        vibrateEnabled: false,
        __proto__: { admin: true },
        sessionToken: 'xyz-secret-token',
        medicalCondition: 'Hypertension'
      }

      const success = saveGymFeedbackPreferences(maliciousPayload as unknown as Partial<GymFeedbackPreferences>)
      expect(success).toBe(true)

      const raw = localStorage.getItem(GYM_FEEDBACK_STORAGE_KEY)
      const parsed = JSON.parse(raw!)
      expect(parsed).toEqual({ soundEnabled: false, vibrateEnabled: false })
      expect(parsed.sessionToken).toBeUndefined()
      expect(parsed.medicalCondition).toBeUndefined()
    })
  })
})
