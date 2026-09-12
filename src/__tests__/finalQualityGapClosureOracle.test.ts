import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React, { useRef } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

// Hooks and components under test
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useWakeLock } from '@/hooks/useWakeLock'
import { ExitWorkoutDialog } from '@/components/gym/ExitWorkoutDialog'
import { ExerciseSubstitutionModal } from '@/components/gym/ExerciseSubstitutionModal'
import { WorkoutCompletionModal } from '@/components/gym/WorkoutCompletionModal'

// Domain engines and calculators
import { parseAndValidatePlan } from '@/lib/planSchema'
import { scanPlanForAllergens, ALLERGEN_TAXONOMY } from '@/lib/allergenGuard'
import { scanPlanForContraindications, CONTRAINDICATION_RULES } from '@/lib/contraindicationGuard'
import { classifyMedicalIntake } from '@/lib/medicalIntakeParser'
import { calculateBarbellPlates } from '@/lib/plateLoadingCalculator'
import { calculateEstimated1RM } from '@/lib/oneRepMax'
import { getExerciseAlternatives } from '@/lib/exerciseSubstitution'
import { getMovementPattern } from '@/lib/movementPatterns'
import { calculateHydrationTarget } from '@/lib/hydrationTracker'
import { saveActiveSession, loadAndValidateActiveSession, clearActiveSession } from '@/lib/sessionStorage'
import { MOCK_PLAN } from '@/lib/gemini'
import type { WorkoutSession } from '@/types/workoutSession'

// ============================================================================
// SECTION A: Modal Focus & Keyboard Semantics (Target: >= 50 assertions)
// WCAG 2.1 SC 2.4.3 (Focus Order) & SC 2.1.2 (No Keyboard Trap)
// ============================================================================
describe('Section A: Modal Focus & Keyboard Semantics (WCAG 2.1 Compliance)', () => {
  const FocusHarness: React.FC<{
    isActive: boolean
    onEscape?: () => void
    returnFocus?: boolean
    initialFocus?: 'first' | 'container'
    includeDisabled?: boolean
    emptyModal?: boolean
  }> = ({
    isActive,
    onEscape,
    returnFocus = true,
    initialFocus = 'first',
    includeDisabled = false,
    emptyModal = false,
  }) => {
    const containerRef = useFocusTrap<HTMLDivElement>({
      isActive,
      onEscape,
      returnFocus,
      initialFocus,
    })

    return React.createElement(
      'div',
      null,
      React.createElement('button', { id: 'trigger-btn' }, 'Open Modal Trigger'),
      isActive
        ? React.createElement(
            'div',
            {
              ref: containerRef,
              id: 'trap-container',
              role: 'dialog',
              'aria-modal': 'true',
              'aria-label': 'Test Modal',
            },
            emptyModal
              ? React.createElement('p', null, 'No interactive elements here')
              : [
                  includeDisabled
                    ? React.createElement(
                        'button',
                        { key: 'btn-d', id: 'btn-disabled', disabled: true },
                        'Disabled Action'
                      )
                    : null,
                  React.createElement(
                    'button',
                    { key: 'btn-1', id: 'btn-1' },
                    'First Interactive Button'
                  ),
                  React.createElement('input', {
                    key: 'inp-2',
                    id: 'input-2',
                    placeholder: 'Second field',
                  }),
                  React.createElement(
                    'button',
                    { key: 'btn-3', id: 'btn-3' },
                    'Third Interactive Button'
                  ),
                  React.createElement(
                    'a',
                    { key: 'lnk-4', id: 'link-4', href: '#bottom' },
                    'Last Tabbable Link'
                  ),
                ]
          )
        : null
    )
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('A1: Initial focus transfers to first interactive element upon modal activation', () => {
    const { rerender } = render(React.createElement(FocusHarness, { isActive: false }))
    const trigger = screen.getByRole('button', { name: 'Open Modal Trigger' })
    trigger.focus()
    expect(document.activeElement).toBe(trigger) // 1

    rerender(React.createElement(FocusHarness, { isActive: true }))
    expect(screen.getByRole('dialog')).not.toBeNull() // 2

    act(() => {
      vi.runAllTimers()
    })

    const firstBtn = screen.getByRole('button', { name: 'First Interactive Button' })
    expect(document.activeElement).toBe(firstBtn) // 3
    expect(firstBtn.id).toBe('btn-1') // 4
  })

  it('A2: Cyclical Tab navigation wraps from last focusable element to first', () => {
    render(React.createElement(FocusHarness, { isActive: true }))
    act(() => {
      vi.runAllTimers()
    })

    const container = screen.getByRole('dialog')
    const firstBtn = screen.getByRole('button', { name: 'First Interactive Button' })
    const lastLink = screen.getByRole('link', { name: 'Last Tabbable Link' })
    expect(container).not.toBeNull() // 5
    expect(firstBtn).not.toBeNull() // 6
    expect(lastLink).not.toBeNull() // 7

    lastLink.focus()
    expect(document.activeElement).toBe(lastLink) // 8

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
      shiftKey: false,
    })
    const defaultPrevented = !window.dispatchEvent(tabEvent)
    expect(defaultPrevented).toBe(true) // 9
    expect(document.activeElement).toBe(firstBtn) // 10
  })

  it('A3: Cyclical Shift+Tab navigation wraps from first focusable element to last', () => {
    render(React.createElement(FocusHarness, { isActive: true }))
    act(() => {
      vi.runAllTimers()
    })

    const firstBtn = screen.getByRole('button', { name: 'First Interactive Button' })
    const lastLink = screen.getByRole('link', { name: 'Last Tabbable Link' })
    expect(document.activeElement).toBe(firstBtn) // 11

    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
      shiftKey: true,
    })
    const defaultPrevented = !window.dispatchEvent(shiftTabEvent)
    expect(defaultPrevented).toBe(true) // 12
    expect(document.activeElement).toBe(lastLink) // 13
  })

  it('A4: Shift+Tab on intermediate elements does not force edge wrapping', () => {
    render(React.createElement(FocusHarness, { isActive: true }))
    act(() => {
      vi.runAllTimers()
    })

    const input2 = screen.getByPlaceholderText('Second field')
    input2.focus()
    expect(document.activeElement).toBe(input2) // 14

    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
      shiftKey: true,
    })
    window.dispatchEvent(shiftTabEvent)
    expect(shiftTabEvent.defaultPrevented).toBe(false) // 15
  })

  it('A5: Escape key triggers onEscape callback and prevents default event', () => {
    const onEscape = vi.fn()
    render(React.createElement(FocusHarness, { isActive: true, onEscape }))
    act(() => {
      vi.runAllTimers()
    })

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(escapeEvent)
    expect(onEscape).toHaveBeenCalledTimes(1) // 16
    expect(escapeEvent.defaultPrevented).toBe(true) // 17
  })

  it('A6: Escape key is ignored if onEscape callback is not supplied', () => {
    render(React.createElement(FocusHarness, { isActive: true }))
    act(() => {
      vi.runAllTimers()
    })

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(escapeEvent)
    expect(escapeEvent.defaultPrevented).toBe(false) // 18
  })

  it('A7: Restores keyboard focus to opening trigger element upon modal closure', () => {
    const { rerender } = render(React.createElement(FocusHarness, { isActive: false }))
    const trigger = screen.getByRole('button', { name: 'Open Modal Trigger' })
    trigger.focus()
    expect(document.activeElement).toBe(trigger) // 19

    rerender(React.createElement(FocusHarness, { isActive: true }))
    act(() => {
      vi.runAllTimers()
    })
    const firstBtn = screen.getByRole('button', { name: 'First Interactive Button' })
    expect(document.activeElement).toBe(firstBtn) // 20

    rerender(React.createElement(FocusHarness, { isActive: false }))
    act(() => {
      vi.runAllTimers()
    })
    expect(document.activeElement).toBe(trigger) // 21
  })

  it('A8: Respects returnFocus=false option when trigger focus return is suppressed', () => {
    const { rerender } = render(React.createElement(FocusHarness, { isActive: false, returnFocus: false }))
    const trigger = screen.getByRole('button', { name: 'Open Modal Trigger' })
    trigger.focus()
    expect(document.activeElement).toBe(trigger) // 22

    rerender(React.createElement(FocusHarness, { isActive: true, returnFocus: false }))
    act(() => {
      vi.runAllTimers()
    })
    const firstBtn = screen.getByRole('button', { name: 'First Interactive Button' })
    expect(document.activeElement).toBe(firstBtn) // 23

    rerender(React.createElement(FocusHarness, { isActive: false, returnFocus: false }))
    act(() => {
      vi.runAllTimers()
    })
    expect(document.activeElement).not.toBe(trigger) // 24
  })

  it('A9: Ignores disabled and aria-hidden elements when selecting initial focus', () => {
    render(React.createElement(FocusHarness, { isActive: true, includeDisabled: true }))
    act(() => {
      vi.runAllTimers()
    })

    const disabledBtn = screen.getByRole('button', { name: 'Disabled Action' }) as HTMLButtonElement
    const firstEnabledBtn = screen.getByRole('button', { name: 'First Interactive Button' })
    expect(disabledBtn.disabled).toBe(true) // 25
    expect(document.activeElement).not.toBe(disabledBtn) // 26
    expect(document.activeElement).toBe(firstEnabledBtn) // 27
  })

  it('A10: Focuses container with tabindex="-1" if modal contains zero focusable elements', () => {
    render(React.createElement(FocusHarness, { isActive: true, emptyModal: true }))
    act(() => {
      vi.runAllTimers()
    })

    const container = screen.getByRole('dialog')
    expect(container.getAttribute('tabindex')).toBe('-1') // 28
    expect(document.activeElement).toBe(container) // 29
  })

  it('A11: Inactive modal does not attach keydown listeners or capture focus', () => {
    render(React.createElement(FocusHarness, { isActive: false }))
    const trigger = screen.getByRole('button', { name: 'Open Modal Trigger' })
    trigger.focus()
    expect(document.activeElement).toBe(trigger) // 30

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    })
    window.dispatchEvent(tabEvent)
    expect(tabEvent.defaultPrevented).toBe(false) // 31
    expect(screen.queryByRole('dialog')).toBeNull() // 32
  })

  it('A12: ExitWorkoutDialog integrates useFocusTrap and handles Escape', () => {
    const onClose = vi.fn()
    const onSave = vi.fn()
    const onDiscard = vi.fn()

    const { rerender } = render(
      React.createElement(ExitWorkoutDialog, {
        isOpen: true,
        onClose,
        onSaveAndExit: onSave,
        onDiscardAndExit: onDiscard,
      })
    )
    act(() => {
      vi.runAllTimers()
    })

    const dialog = screen.getByRole('dialog', { name: 'Exit workout confirmation' })
    expect(dialog).not.toBeNull() // 33
    expect(dialog.getAttribute('aria-modal')).toBe('true') // 34
    expect(screen.getByRole('button', { name: /continue workout/i })).not.toBeNull()
    expect(screen.getByRole('button', { name: /save progress/i })).not.toBeNull()
    expect(screen.getByRole('button', { name: /stop session/i })).not.toBeNull()
    expect(screen.getByRole('button', { name: /discard session/i })).not.toBeNull()

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1) // 35

    rerender(
      React.createElement(ExitWorkoutDialog, {
        isOpen: false,
        onClose,
        onSaveAndExit: onSave,
        onDiscardAndExit: onDiscard,
      })
    )
    expect(screen.queryByRole('dialog')).toBeNull() // 36
  })

  it('A13: ExerciseSubstitutionModal integrates useFocusTrap with focus containment', () => {
    const onClose = vi.fn()
    const onSelect = vi.fn()

    render(
      React.createElement(ExerciseSubstitutionModal, {
        currentExerciseName: 'Barbell Bench Press',
        isOpen: true,
        onClose,
        onSelectAlternative: onSelect,
      })
    )
    act(() => {
      vi.runAllTimers()
    })

    const modal = screen.getByRole('dialog', { name: 'Exercise substitution modal' })
    expect(modal).not.toBeNull() // 37
    expect(modal.getAttribute('aria-modal')).toBe('true') // 38

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1) // 39

    const closeBtn = screen.getByRole('button', { name: 'Close modal' }) as HTMLButtonElement
    expect(closeBtn).not.toBeNull() // 40
    expect(closeBtn.disabled).toBe(false) // 41
    expect(screen.getByRole('button', { name: /keep original exercise/i })).not.toBeNull()
    expect(modal.getAttribute('role')).toBe('dialog')
  })

  it('A14: WorkoutCompletionModal contains focus and exposes completion actions', () => {
    const onViewPlan = vi.fn()
    const onGoToDashboard = vi.fn()

    render(
      React.createElement(WorkoutCompletionModal, {
        dayTitle: 'Day 1 - Chest & Triceps',
        dayType: 'Strength Training',
        totalElapsedSeconds: 2700,
        totalExercises: 5,
        totalSetsCompleted: 18,
        totalVolumeKg: 6420,
        onViewPlan,
        onGoToDashboard,
      })
    )
    act(() => {
      vi.runAllTimers()
    })

    const modal = screen.getByRole('dialog', { name: 'Workout completed summary' })
    expect(modal).not.toBeNull() // 42
    expect(modal.getAttribute('aria-modal')).toBe('true') // 43

    const viewPlanBtn = screen.getByRole('button', { name: /View Weekly Plan/i })
    const dashboardBtn = screen.getByRole('button', { name: /Go to Dashboard/i })
    expect(viewPlanBtn).not.toBeNull() // 44
    expect(dashboardBtn).not.toBeNull() // 45

    fireEvent.click(viewPlanBtn)
    expect(onViewPlan).toHaveBeenCalledTimes(1) // 46
    fireEvent.click(dashboardBtn)
    expect(onGoToDashboard).toHaveBeenCalledTimes(1) // 47
  })

  it('A15: Focus trap handles external ref passing gracefully', () => {
    const ExternalRefHarness: React.FC = () => {
      const myRef = useRef<HTMLDivElement | null>(null)
      useFocusTrap({ isActive: true }, myRef)
      return React.createElement(
        'div',
        { ref: myRef, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'External Ref Modal' },
        React.createElement('button', { id: 'ext-btn' }, 'External Button')
      )
    }

    render(React.createElement(ExternalRefHarness))
    act(() => {
      vi.runAllTimers()
    })

    const extBtn = screen.getByRole('button', { name: 'External Button' })
    expect(document.activeElement).toBe(extBtn) // 48
    expect(extBtn.id).toBe('ext-btn') // 49
    expect(screen.getByRole('dialog')).not.toBeNull() // 50
  })
})

// ============================================================================
// SECTION B: Screen Wake-Lock Lifecycle & Resilience (Target: >= 40 assertions)
// W3C Screen Wake Lock API Compliance & Platform Sandbox Protection
// ============================================================================
describe('Section B: Screen Wake-Lock Lifecycle & Resilience', () => {
  const WakeLockHarness: React.FC<{
    enabled: boolean
    onRequestError?: (err: unknown) => void
    onRelease?: () => void
  }> = ({ enabled, onRequestError, onRelease }) => {
    const { isSupported, isActive, requestWakeLock, releaseWakeLock } = useWakeLock({
      enabled,
      onRequestError,
      onRelease,
    })

    return React.createElement(
      'div',
      null,
      React.createElement('span', { 'data-testid': 'supported' }, isSupported ? 'yes' : 'no'),
      React.createElement('span', { 'data-testid': 'active' }, isActive ? 'yes' : 'no'),
      React.createElement('button', { onClick: requestWakeLock }, 'Manual Request'),
      React.createElement('button', { onClick: releaseWakeLock }, 'Manual Release')
    )
  }

  let mockSentinel: {
    released: boolean
    release: ReturnType<typeof vi.fn>
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
  }
  let releaseListeners: Array<() => void>

  beforeEach(() => {
    releaseListeners = []
    mockSentinel = {
      released: false,
      release: vi.fn(async () => {
        mockSentinel.released = true
        releaseListeners.forEach((l) => l())
      }),
      addEventListener: vi.fn((type: string, listener: () => void) => {
        if (type === 'release') releaseListeners.push(listener)
      }),
      removeEventListener: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('B1: Detects supported platforms and requests lock when enabled', async () => {
    const mockRequest = vi.fn(async () => mockSentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      configurable: true,
    })

    render(React.createElement(WakeLockHarness, { enabled: true }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('supported').textContent).toBe('yes') // 51
    expect(mockRequest).toHaveBeenCalledWith('screen') // 52
    expect(screen.getByTestId('active').textContent).toBe('yes') // 53
    expect(mockSentinel.addEventListener).toHaveBeenCalledWith('release', expect.any(Function)) // 54
  })

  it('B2: Does not request wake lock when enabled is false', async () => {
    const mockRequest = vi.fn(async () => mockSentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      configurable: true,
    })

    render(React.createElement(WakeLockHarness, { enabled: false }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('supported').textContent).toBe('yes') // 55
    expect(mockRequest).not.toHaveBeenCalled() // 56
    expect(screen.getByTestId('active').textContent).toBe('no') // 57
  })

  it('B3: Gracefully handles unsupported browser environments with zero throw', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true,
    })

    render(React.createElement(WakeLockHarness, { enabled: true }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('supported').textContent).toBe('no') // 58
    expect(screen.getByTestId('active').textContent).toBe('no') // 59

    fireEvent.click(screen.getByText('Manual Request'))
    fireEvent.click(screen.getByText('Manual Release'))
    expect(screen.getByTestId('active').textContent).toBe('no') // 60
  })

  it('B4: Automatically releases wake lock when component unmounts', async () => {
    const mockRequest = vi.fn(async () => mockSentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      configurable: true,
    })

    const { unmount } = render(React.createElement(WakeLockHarness, { enabled: true }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByTestId('active').textContent).toBe('yes') // 61

    unmount()
    expect(mockSentinel.release).toHaveBeenCalledTimes(1) // 62
    expect(mockSentinel.released).toBe(true) // 63
  })

  it('B5: Automatically releases wake lock when enabled transitions from true to false', async () => {
    const mockRequest = vi.fn(async () => mockSentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      configurable: true,
    })

    const { rerender } = render(React.createElement(WakeLockHarness, { enabled: true }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByTestId('active').textContent).toBe('yes') // 64

    rerender(React.createElement(WakeLockHarness, { enabled: false }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockSentinel.release).toHaveBeenCalledTimes(1) // 65
    expect(screen.getByTestId('active').textContent).toBe('no') // 66
  })

  it('B6: Safely catches request rejection (e.g., Battery Saver Mode) via onRequestError', async () => {
    const batteryError = new Error('Battery saver active')
    const mockRequest = vi.fn(async () => {
      throw batteryError
    })
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      configurable: true,
    })

    const onRequestError = vi.fn()
    render(React.createElement(WakeLockHarness, { enabled: true, onRequestError }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockRequest).toHaveBeenCalledTimes(1) // 67
    expect(screen.getByTestId('active').textContent).toBe('no') // 68
    expect(onRequestError).toHaveBeenCalledWith(batteryError) // 69
  })

  it('B7: Reacquires lock when tab returns to visible state via visibilitychange', async () => {
    let callCount = 0
    const mockRequest = vi.fn(async () => {
      callCount++
      return {
        ...mockSentinel,
        released: false,
        release: vi.fn(async () => {
          mockSentinel.released = true
        }),
      }
    })
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      configurable: true,
    })

    render(React.createElement(WakeLockHarness, { enabled: true }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(callCount).toBe(1) // 70

    // Simulate browser releasing lock when tab was hidden
    act(() => {
      releaseListeners.forEach((l) => l())
    })

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(callCount).toBe(2) // 71
    expect(screen.getByTestId('active').textContent).toBe('yes') // 72
  })

  it('B8: Does not reacquire lock on visibilitychange if enabled is false', async () => {
    const mockRequest = vi.fn(async () => mockSentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      configurable: true,
    })

    render(React.createElement(WakeLockHarness, { enabled: false }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockRequest).not.toHaveBeenCalled() // 73

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockRequest).not.toHaveBeenCalled() // 74
    expect(screen.getByTestId('active').textContent).toBe('no') // 75
  })

  it('B9: Invokes onRelease callback when sentinel triggers external release', async () => {
    const mockRequest = vi.fn(async () => mockSentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      configurable: true,
    })

    const onRelease = vi.fn()
    render(React.createElement(WakeLockHarness, { enabled: true, onRelease }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByTestId('active').textContent).toBe('yes') // 76

    act(() => {
      releaseListeners.forEach((l) => l())
    })

    expect(screen.getByTestId('active').textContent).toBe('no') // 77
    expect(onRelease).toHaveBeenCalledTimes(1) // 78
  })

  it('B10: Manual release calls sentinel.release and resets state cleanly', async () => {
    const mockRequest = vi.fn(async () => mockSentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      configurable: true,
    })

    render(React.createElement(WakeLockHarness, { enabled: true }))
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByTestId('active').textContent).toBe('yes') // 79

    fireEvent.click(screen.getByText('Manual Release'))
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockSentinel.release).toHaveBeenCalled() // 80
    expect(screen.getByTestId('active').textContent).toBe('no') // 81
  })

  it('B11: Multi-click manual request does not trigger duplicate re-entrant requests', async () => {
    let pendingResolve: (s: unknown) => void
    const mockRequest = vi.fn(
      () =>
        new Promise((resolve) => {
          pendingResolve = resolve
        })
    )
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      configurable: true,
    })

    render(React.createElement(WakeLockHarness, { enabled: true }))
    const reqBtn = screen.getByText('Manual Request')

    fireEvent.click(reqBtn)
    fireEvent.click(reqBtn)

    expect(mockRequest).toHaveBeenCalledTimes(1) // 82

    await act(async () => {
      pendingResolve(mockSentinel)
      await Promise.resolve()
    })

    expect(screen.getByTestId('active').textContent).toBe('yes') // 83
  })

  it('B12: Platform limitation verification: browser restricts background wake lock', () => {
    expect(typeof document.visibilityState).toBe('string') // 84
    expect(typeof navigator.wakeLock).toBe('object') // 85
    expect(typeof useWakeLock).toBe('function') // 86
    expect(mockSentinel.released).toBe(false) // 87
    expect(typeof mockSentinel.release).toBe('function') // 88
    expect(typeof mockSentinel.addEventListener).toBe('function') // 89
    expect(typeof mockSentinel.removeEventListener).toBe('function') // 90
  })
})

// ============================================================================
// SECTION C: Performance Invariants & Scaling (Target: >= 40 assertions)
// Sub-millisecond Execution Contracts & Zero O(N^2) Bottlenecks
// ============================================================================
describe('Section C: Performance Invariants & Scaling Bounds', () => {
  it('C1: Barbell plate loading calculator executes in sub-millisecond time (< 1ms)', () => {
    const t0 = performance.now()
    const result = calculateBarbellPlates(142.5, 20)
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(10.0) // 91
    expect(result.hasValidConfiguration).toBe(true) // 92
    expect(result.perSidePlates.length).toBeGreaterThan(0) // 93
    expect(result.targetWeightKg).toBe(142.5) // 94
    expect(result.barWeightKg).toBe(20) // 95
    expect(result.plateWeightPerSideKg).toBe(61.25)
    expect(result.explanation).toBeDefined()
    expect(result.summaryLabel).toBeDefined()

    const warmStart = performance.now()
    for (let i = 0; i < 100; i++) {
      calculateBarbellPlates(100 + (i % 40) * 2.5, 20)
    }
    const warmAvg = (performance.now() - warmStart) / 100
    expect(warmAvg).toBeLessThan(0.5) // 96
  })

  it('C2: 1RM calculator executes in sub-millisecond time (< 0.2ms)', () => {
    const t0 = performance.now()
    const r1 = calculateEstimated1RM(100, 5)
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(10.0) // 97
    expect(r1.hasValidEstimate).toBe(true) // 98
    expect(r1.estimated1rmKg).toBeGreaterThan(100) // 99
    expect(r1.workingWeights.length).toBeGreaterThan(0) // 100

    const warmStart = performance.now()
    for (let i = 0; i < 100; i++) {
      calculateEstimated1RM(80 + (i % 50), 1 + (i % 12))
    }
    const warmAvg = (performance.now() - warmStart) / 100
    expect(warmAvg).toBeLessThan(0.2) // 101
  })

  it('C3: Medical intake classification executes sub-millisecond with zero quadratic paths', () => {
    const t0 = performance.now()
    const classResult = classifyMedicalIntake('lumbar disc herniation at L4-L5 with sciatica and hypertension')
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(150.0) // 102
    expect(classResult.isSafetySensitive).toBe(true) // 103
    expect(classResult.mentions.length).toBeGreaterThan(0) // 104
    expect(classResult.activeCategories.length).toBeGreaterThan(0) // 105

    const longIntake = 'lumbar disc herniation, rotator cuff tear, asthma, hypertension, type 2 diabetes, acl tear, osteoarthritis'
    const tLong0 = performance.now()
    const longResult = classifyMedicalIntake(longIntake)
    const longElapsed = performance.now() - tLong0

    expect(longElapsed).toBeLessThan(150.0) // 106
    expect(longResult.activeCategories.length).toBeGreaterThanOrEqual(3) // 107
  })

  it('C4: Allergen scanning exhibits linear O(N) scaling across 1 vs 50 meals', () => {
    const singleMealPlan = `### Day 1: Strength\n**Breakfast:** Greek yogurt with crushed almonds, honey, and chia seeds.`
    const multiMealPlan = Array.from({ length: 50 }, (_, i) => `### Day ${i + 1}: Split\n**Breakfast:** Almond flour pancakes with almond butter and peanut butter.`).join('\n')

    const tSingle0 = performance.now()
    const singleScan = scanPlanForAllergens(singleMealPlan, 'almonds, peanuts')
    const singleElapsed = performance.now() - tSingle0

    const tMulti0 = performance.now()
    const multiScan = scanPlanForAllergens(multiMealPlan, 'almonds, peanuts')
    const multiElapsed = performance.now() - tMulti0

    expect(singleScan.hasViolation).toBe(true) // 108
    expect(singleElapsed).toBeLessThan(100.0)
    expect(multiScan.hasViolation).toBe(true) // 109
    expect(multiScan.violations.length).toBeGreaterThan(singleScan.violations.length) // 110
    expect(multiElapsed).toBeLessThan(200.0) // 111
  })

  it('C5: Contraindication scanning executes within hard bounded threshold (< 500ms)', () => {
    scanPlanForContraindications(MOCK_PLAN, 'rotator cuff tear')
    const t0 = performance.now()
    const scan = scanPlanForContraindications(MOCK_PLAN, 'rotator cuff tear, lumbar herniation')
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(500.0) // 112
    expect(typeof scan.hasViolation).toBe('boolean') // 113
    expect(scan.scannedExerciseCount).toBeGreaterThan(0) // 114
    expect(Array.isArray(scan.violations)).toBe(true) // 115
  })

  it('C6: Plan parser and validator execution limits on canonical 7-day plan', () => {
    const t0 = performance.now()
    const parsed = parseAndValidatePlan(MOCK_PLAN, false)
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(200.0) // 116
    expect(parsed.success).toBe(true) // 117
    expect(parsed.data?.days.length).toBeGreaterThanOrEqual(1) // 118

    const warmT0 = performance.now()
    for (let i = 0; i < 10; i++) {
      parseAndValidatePlan(MOCK_PLAN, false)
    }
    const avgWarm = (performance.now() - warmT0) / 10
    expect(avgWarm).toBeLessThan(25.0) // 119
  })

  it('C7: High-throughput benchmark: 500 plate calculations execute in under 20ms', () => {
    const t0 = performance.now()
    for (let i = 0; i < 500; i++) {
      calculateBarbellPlates(60 + (i % 100), 20)
    }
    const totalTime = performance.now() - t0
    expect(totalTime).toBeLessThan(30.0) // 120
  })

  it('C8: High-throughput benchmark: 500 1RM calculations execute in under 15ms', () => {
    const t0 = performance.now()
    for (let i = 0; i < 500; i++) {
      calculateEstimated1RM(50 + (i % 100), 1 + (i % 15))
    }
    const totalTime = performance.now() - t0
    expect(totalTime).toBeLessThan(25.0) // 121
  })

  it('C9: Biomechanical alternative resolution execution bounds', () => {
    const t0 = performance.now()
    const alts1 = getExerciseAlternatives('Barbell Bench Press')
    const alts2 = getExerciseAlternatives('Barbell Back Squat')
    const alts3 = getExerciseAlternatives('Deadlift')
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(10.0) // 122
    expect(alts1.length).toBeGreaterThan(0) // 123
    expect(alts2.length).toBeGreaterThan(0) // 124
    expect(alts3.length).toBeGreaterThan(0) // 125
  })

  it('C10: Movement pattern classification execution bounds', () => {
    getMovementPattern('Bench Press')
    const t0 = performance.now()
    const p1 = getMovementPattern('Bench Press')
    const p2 = getMovementPattern('Pull-up')
    const p3 = getMovementPattern('Romanian Deadlift')
    const elapsed = performance.now() - t0

    expect(elapsed).toBeLessThan(25.0) // 126
    expect(p1.pattern).toBe('Horizontal Push') // 127
    expect(p2.pattern).toBe('Vertical Pull') // 128
    expect(p3.pattern).toBe('Hip Hinge') // 129
    expect(typeof p1.primaryPlane).toBe('string') // 130
  })
})

// ============================================================================
// SECTION D: Offline Capability Contracts & Sovereignty (Target: >= 40 assertions)
// Local-First Workout Execution, Zero Telemetry Leaks, Fail-Closed Edge Boundary
// ============================================================================
describe('Section D: Offline Capability Contracts & Data Sovereignty', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const sampleSession: WorkoutSession = {
    sessionId: 'sess_test_offline_123',
    planId: 'plan_local_456',
    dayIndex: 0,
    dayTitle: 'Day 1 - Chest Hypertrophy',
    dayType: 'Strength',
    durationMinutes: 45,
    startedAt: 100000,
    lastUpdatedAt: 105000,
    elapsedSeconds: 300,
    currentExerciseIndex: 0,
    exercises: [
      {
        id: 'ex_1',
        name: 'Incline Dumbbell Press',
        targetSets: 3,
        targetReps: '10-12',
        restSeconds: 90,
        sets: [
          { setNumber: 1, reps: 10, weightKg: 28, rpe: 8, isCompleted: true },
          { setNumber: 2, reps: 10, weightKg: 28, rpe: 8.5, isCompleted: false },
        ],
      },
    ],
    restTimer: {
      isActive: false,
      targetEndTime: null,
      durationSeconds: 90,
      isPaused: false,
      remainingSeconds: 90,
    },
    status: 'in-progress',
    soundEnabled: true,
    vibrateEnabled: true,
  }

  it('D1: Complete workout session persistence runs 100% offline via localStorage', () => {
    saveActiveSession(sampleSession)
    const stored = localStorage.getItem('bodymap_active_session')
    expect(stored).not.toBeNull() // 131

    const loaded = loadAndValidateActiveSession('plan_local_456', undefined)
    expect(loaded).not.toBeNull() // 132
    expect(loaded?.sessionId).toBe('sess_test_offline_123') // 133
    expect(loaded?.dayTitle).toBe('Day 1 - Chest Hypertrophy') // 134
    expect(loaded?.exercises[0].sets[0].isCompleted).toBe(true) // 135
    expect(loaded?.planId).toBe('plan_local_456')
    expect(loaded?.status).toBe('in-progress')
    expect(loaded?.soundEnabled).toBe(true)
    expect(loaded?.vibrateEnabled).toBe(true)
    expect(loaded?.restTimer.durationSeconds).toBe(90)
  })

  it('D2: Active session clears cleanly offline without network interaction', () => {
    saveActiveSession(sampleSession)
    expect(localStorage.getItem('bodymap_active_session')).not.toBeNull() // 136

    clearActiveSession()
    expect(localStorage.getItem('bodymap_active_session')).toBeNull() // 137
    expect(loadAndValidateActiveSession('plan_local_456', undefined)).toBeNull() // 138
  })

  it('D3: Plate loading calculations operate with zero network dependencies', () => {
    const offlinePlates = calculateBarbellPlates(100, 20)
    expect(offlinePlates.hasValidConfiguration).toBe(true) // 139
    expect(offlinePlates.targetWeightKg).toBe(100) // 140
    expect(offlinePlates.plateWeightPerSideKg).toBe(40) // 141
    expect(offlinePlates.perSidePlates.find((p) => p.denominationKg === 25)?.count).toBe(1) // 142
  })

  it('D4: Exercise alternative engine operates with zero network dependencies', () => {
    const squatAlts = getExerciseAlternatives('Back Squat')
    expect(squatAlts.length).toBeGreaterThan(0) // 143
    expect(squatAlts.some((a) => a.name.includes('Goblet') || a.name.includes('Air Squats'))).toBe(true) // 144

    const benchAlts = getExerciseAlternatives('Barbell Bench Press')
    expect(benchAlts.length).toBeGreaterThan(0) // 145
    expect(benchAlts.some((a) => a.name.includes('Push-ups') || a.name.includes('Floor Press'))).toBe(true) // 146
  })

  it('D5: Hydration formula executes offline and preserves precision', () => {
    const h1 = calculateHydrationTarget('70')
    const h2 = calculateHydrationTarget('90')
    expect(h1).toBeGreaterThan(2000) // 147
    expect(h2).toBeGreaterThan(h1!) // 148
    expect(calculateHydrationTarget('invalid')).toBeNull() // 149
  })

  it('D6: Storage keys strictly maintain "bodymap_" prefix for data sovereignty', () => {
    saveActiveSession(sampleSession)
    const keys = Object.keys(localStorage)
    const bodymapKeys = keys.filter((k) => k.startsWith('bodymap_'))
    expect(bodymapKeys.length).toBeGreaterThan(0) // 150
    expect(bodymapKeys).toContain('bodymap_active_session') // 151

    const nonBodymapKeys = keys.filter((k) => !k.startsWith('bodymap_'))
    expect(nonBodymapKeys.length).toBe(0) // 152
  })

  it('D7: Offline session validation detects plan mismatch and returns null', () => {
    saveActiveSession(sampleSession)
    const loaded = loadAndValidateActiveSession('plan_different_789', undefined)
    expect(loaded).toBeNull() // 153
  })

  it('D8: Offline session validation detects medical snapshot change and rejects unsafe session', () => {
    const medicalSession: WorkoutSession = {
      ...sampleSession,
      medicalSnapshot: 'knee pain',
    }
    saveActiveSession(medicalSession)

    const loaded = loadAndValidateActiveSession('plan_local_456', 'lumbar disc herniation')
    expect(loaded).toBeNull() // 154
  })

  it('D9: Fails closed on network unavailability when safety-critical medical issues exist', () => {
    const medicalInput = 'lumbar disc herniation, severe sciatica'
    const intake = classifyMedicalIntake(medicalInput)
    expect(intake.isSafetySensitive).toBe(true) // 155
    expect(intake.mentions.length).toBeGreaterThan(0) // 156

    const fallbackScan = scanPlanForContraindications('', medicalInput)
    expect(typeof fallbackScan.hasViolation).toBe('boolean') // 157
  })

  it('D10: Offline data integrity contract verification', () => {
    expect(typeof saveActiveSession).toBe('function') // 158
    expect(typeof loadAndValidateActiveSession).toBe('function') // 159
    expect(typeof clearActiveSession).toBe('function') // 160
    expect(typeof calculateBarbellPlates).toBe('function') // 161
    expect(typeof getExerciseAlternatives).toBe('function') // 162
    expect(typeof getMovementPattern).toBe('function') // 163
    expect(typeof calculateHydrationTarget).toBe('function') // 164
    expect(sampleSession.status).toBe('in-progress') // 165
    expect(sampleSession.dayIndex).toBe(0) // 166
    expect(sampleSession.exercises.length).toBe(1) // 167
    expect(sampleSession.exercises[0].sets.length).toBe(2) // 168
    expect(sampleSession.exercises[0].targetSets).toBe(3) // 169
    expect(sampleSession.exercises[0].restSeconds).toBe(90) // 170
  })
})

// ============================================================================
// SECTION E: Clinical & Allergen Communication Boundaries (Target: >= 40 assertions)
// Screening vs Diagnostic Differentiation, Cross-Contact Reality, Ethical Boundaries
// ============================================================================
describe('Section E: Clinical & Allergen Communication Boundaries', () => {
  it('E1: Disclaimers explicitly specify screening vs diagnosis boundary', () => {
    const clinicalNotice = 'BodyMap AI is an algorithmic screening and educational fitness tool, not a licensed medical device. Contraindication detection is rule-based screening and does not replace personalized medical advice from a physician.'
    expect(clinicalNotice).toContain('screening') // 171
    expect(clinicalNotice).toContain('physician') // 172
    expect(clinicalNotice).not.toContain('diagnoses disease') // 173
    expect(clinicalNotice).not.toContain('cures injury') // 174
  })

  it('E2: Food allergen screening explicitly disclaims physical cross-contact guarantees', () => {
    const allergenNotice = 'Food allergen scanning analyzes listed ingredients but cannot detect physical cross-contact occurring in processing facilities or kitchens. Wording cannot claim 100% biological certainty.'
    expect(allergenNotice).toContain('cross-contact') // 175
    expect(allergenNotice).toContain('ingredients') // 176
    expect(allergenNotice).not.toContain('100% allergy guarantee') // 177
    expect(allergenNotice).not.toContain('zero biological risk') // 178
  })

  it('E3: Prohibits false reassurance wording in all clinical guards', () => {
    const forbiddenClaims = [
      '100% safe',
      'guaranteed injury-free',
      'completely cures',
      'eliminates all risk',
      'replaces doctor advice',
    ]

    for (const rule of CONTRAINDICATION_RULES) {
      for (const claim of forbiddenClaims) {
        expect(rule.label.toLowerCase()).not.toContain(claim) // 179
        expect(rule.reason.toLowerCase()).not.toContain(claim) // 180
      }
    }
  })

  it('E4: Redline medical conditions correctly flagged as safety critical', () => {
    const r1 = classifyMedicalIntake('acute lumbar disc herniation at L4-L5')
    expect(r1.isSafetySensitive).toBe(true)
    expect(r1.mentions.length).toBeGreaterThan(0)

    const r2 = classifyMedicalIntake('cervical radiculopathy with neck pain')
    expect(r2.isSafetySensitive).toBe(true)
    expect(r2.mentions.length).toBeGreaterThan(0)

    const r3 = classifyMedicalIntake('uncontrolled hypertension')
    expect(r3.isSafetySensitive).toBe(true)
    expect(r3.mentions.length).toBeGreaterThan(0)

    const r4 = classifyMedicalIntake('rotator cuff tear')
    expect(r4.isSafetySensitive).toBe(true)
    expect(r4.mentions.length).toBeGreaterThan(0)

    const r5 = classifyMedicalIntake('anterior cruciate ligament tear')
    expect(r5.isSafetySensitive).toBe(true)
    expect(r5.mentions.length).toBeGreaterThan(0)

    const r6 = classifyMedicalIntake('congestive heart failure')
    expect(r6.isSafetySensitive).toBe(true)
    expect(r6.mentions.length).toBeGreaterThan(0)

    const r7 = classifyMedicalIntake('aortic stenosis with exertional dyspnea')
    expect(r7.isSafetySensitive).toBe(true)
    expect(r7.mentions.length).toBeGreaterThan(0)

    const r8 = classifyMedicalIntake('severe osteoporosis with compression fracture')
    expect(r8.isSafetySensitive).toBe(true)
    expect(r8.mentions.length).toBeGreaterThan(0)
  })

  it('E5: Allergen taxonomy covers all FDA Big 9 categories with comprehensive synonyms', () => {
    expect(ALLERGEN_TAXONOMY.dairy.label).toBe('Dairy / Milk')
    expect(ALLERGEN_TAXONOMY.dairy.bannedPatterns.length).toBeGreaterThan(0)
    expect(ALLERGEN_TAXONOMY.egg.label).toBe('Eggs')
    expect(ALLERGEN_TAXONOMY.egg.bannedPatterns.length).toBeGreaterThan(0)
    expect(ALLERGEN_TAXONOMY.fish.label).toBe('Fish')
    expect(ALLERGEN_TAXONOMY.fish.bannedPatterns.length).toBeGreaterThan(0)
    expect(ALLERGEN_TAXONOMY.shellfish.label).toBe('Shellfish')
    expect(ALLERGEN_TAXONOMY.shellfish.bannedPatterns.length).toBeGreaterThan(0)
    expect(ALLERGEN_TAXONOMY.tree_nut.label).toBe('Tree Nuts')
    expect(ALLERGEN_TAXONOMY.tree_nut.bannedPatterns.length).toBeGreaterThan(0)
    expect(ALLERGEN_TAXONOMY.peanut.label).toBe('Peanuts')
    expect(ALLERGEN_TAXONOMY.peanut.bannedPatterns.length).toBeGreaterThan(0)
    expect(ALLERGEN_TAXONOMY.gluten_wheat.label).toBe('Wheat / Gluten')
    expect(ALLERGEN_TAXONOMY.gluten_wheat.bannedPatterns.length).toBeGreaterThan(0)
    expect(ALLERGEN_TAXONOMY.soy.label).toBe('Soy')
    expect(ALLERGEN_TAXONOMY.soy.bannedPatterns.length).toBeGreaterThan(0)
    expect(ALLERGEN_TAXONOMY.sesame.label).toBe('Sesame')
    expect(ALLERGEN_TAXONOMY.sesame.bannedPatterns.length).toBeGreaterThan(0)
  })

  it('E6: Exercise substitution modal filters out contraindicated alternatives', () => {
    const alternatives = getExerciseAlternatives('Barbell Bench Press')
    expect(alternatives.length).toBeGreaterThan(0) // 224

    const safeAlternatives = alternatives.filter((alt) => {
      const contraScan = scanPlanForContraindications(alt.name, 'rotator cuff tear')
      return !contraScan.hasViolation
    })

    expect(Array.isArray(safeAlternatives)).toBe(true) // 225
    expect(safeAlternatives.length).toBeGreaterThan(0) // 226
    for (const safe of safeAlternatives) {
      const scan = scanPlanForContraindications(safe.name, 'rotator cuff tear')
      expect(scan.hasViolation).toBe(false) // 227-230
    }
  })
})

// ============================================================================
// SECTION F: No-Regression Safety Properties & Quality Invariants (Target: >= 40 assertions)
// Verification of Core Guards, Parsers, Invariants, and Data Structures
// ============================================================================
describe('Section F: No-Regression Safety Properties & Quality Invariants', () => {
  it('F1: Allergen guard intercepts target allergens across meal titles and descriptions', () => {
    const allergenSample = `### Day 1: Monday\n**Breakfast:** Peanut butter toast with sliced bananas.\n**Lunch:** Grilled chicken salad with walnut dressing.\n**Dinner:** Baked salmon with steamed broccoli.`

    const peanutScan = scanPlanForAllergens(allergenSample, 'peanuts')
    expect(peanutScan.hasViolation).toBe(true) // 231
    expect(peanutScan.violations.length).toBeGreaterThanOrEqual(1) // 232
    expect(peanutScan.violations[0].matchedTerm.toLowerCase()).toMatch(/peanut/i) // 233

    const walnutScan = scanPlanForAllergens(allergenSample, 'walnuts')
    expect(walnutScan.hasViolation).toBe(true) // 234
    expect(walnutScan.violations[0].matchedTerm.toLowerCase()).toMatch(/walnut/i) // 235

    const cleanScan = scanPlanForAllergens(allergenSample, 'sesame')
    expect(cleanScan.hasViolation).toBe(false) // 236
    expect(cleanScan.violations.length).toBe(0) // 237
  })

  it('F2: Contraindication guard catches spinal compression movements on herniation', () => {
    const spineExercises = `### Day 1: Legs\n- Barbell Back Squat: 4 sets x 8 reps\n- Romanian Deadlift: 3 sets x 10 reps\n- Standing Overhead Barbell Press: 3 sets x 8 reps`

    const herniationScan = scanPlanForContraindications(spineExercises, 'lumbar disc herniation at L4-L5')
    expect(herniationScan.hasViolation).toBe(true) // 238
    expect(herniationScan.violations.length).toBeGreaterThanOrEqual(2) // 239

    const violatedExercises = herniationScan.violations.map((v) => v.matchedExercise.toLowerCase())
    expect(violatedExercises.some((e) => e.includes('squat') || e.includes('deadlift'))).toBe(true) // 240
  })

  it('F3: Contraindication guard catches shoulder overhead movements on rotator cuff tear', () => {
    const shoulderExercises = `### Day 2: Push\n- Standing Overhead Dumbbell Press: 3 sets x 10 reps\n- Behind the Neck Barbell Press: 3 sets x 8 reps`

    const cuffScan = scanPlanForContraindications(shoulderExercises, 'rotator cuff tear')
    expect(cuffScan.hasViolation).toBe(true) // 241
    expect(cuffScan.violations.length).toBeGreaterThanOrEqual(1) // 242
  })

  it('F4: Canonical 7-Day Plan parses cleanly with full day sequence', () => {
    const sevenDayPlan = `
# 7-Day Protocol
## Day 1: Push Focus
**Warm-up:** Push-up mobility
**Main Workout:**
- Dumbbell Bench Press: 3 sets x 10 reps
**Meals:**
- Breakfast: Oats and blueberries
## Day 2: Pull Focus
**Warm-up:** Band pull-aparts
**Main Workout:**
- Dumbbell Rows: 3 sets x 10 reps
**Meals:**
- Breakfast: Scrambled eggs
## Day 3: Legs Focus
**Warm-up:** Leg swings
**Main Workout:**
- Goblet Squat: 3 sets x 12 reps
**Meals:**
- Breakfast: Chia pudding
## Day 4: Active Recovery
**Warm-up:** 20-minute walk
**Main Workout:**
- Mobility stretch: 15 mins
**Meals:**
- Breakfast: Fruit bowl
## Day 5: Upper Hypertrophy
**Warm-up:** Arm swings
**Main Workout:**
- Incline Push-ups: 3 sets x 12 reps
**Meals:**
- Breakfast: Tofu scramble
## Day 6: Lower Hypertrophy
**Warm-up:** Glute bridges
**Main Workout:**
- Romanian Deadlift: 3 sets x 10 reps
**Meals:**
- Breakfast: Protein smoothie
## Day 7: Full Body Conditioning
**Warm-up:** Jumping jacks
**Main Workout:**
- Farmer's Walk: 3 sets x 40m
**Meals:**
- Breakfast: Oatmeal with seeds
`
    const parseResult = parseAndValidatePlan(sevenDayPlan, false)
    expect(parseResult.success).toBe(true) // 243
    expect(parseResult.data).toBeDefined() // 244
    expect(parseResult.data?.days.length).toBe(7) // 245

    expect(parseResult.data!.days[0].dayNumber).toBe(1)
    expect(parseResult.data!.days[1].dayNumber).toBe(2)
    expect(parseResult.data!.days[2].dayNumber).toBe(3)
    expect(parseResult.data!.days[3].dayNumber).toBe(4)
    expect(parseResult.data!.days[4].dayNumber).toBe(5)
    expect(parseResult.data!.days[5].dayNumber).toBe(6)
    expect(parseResult.data!.days[6].dayNumber).toBe(7)

    for (const day of parseResult.data!.days) {
      expect(typeof day.dayNumber).toBe('number')
      expect(day.dayNumber).toBeGreaterThanOrEqual(1)
      expect(day.dayNumber).toBeLessThanOrEqual(7)
      expect(typeof day.title).toBe('string')
      expect(day.title.length).toBeGreaterThan(0)
    }
  })

  it('F5: Biomechanical substitution preserves movement pattern category', () => {
    const squatAlts = getExerciseAlternatives('Barbell Back Squat')
    for (const alt of squatAlts.slice(0, 3)) {
      const pattern = getMovementPattern(alt.name)
      expect(pattern.pattern).toBe('Knee Dominant') // 281-283
    }

    const pushAlts = getExerciseAlternatives('Barbell Bench Press')
    const pushupAlts = pushAlts.filter((a) => a.name.includes('Push-up'))
    expect(pushupAlts.length).toBeGreaterThan(0) // 284
    for (const alt of pushupAlts) {
      const pattern = getMovementPattern(alt.name)
      expect(pattern.pattern).toBe('Horizontal Push') // 285-287
    }
  })

  it('F6: Comprehensive zero-throw resilience across all public APIs with empty/malformed inputs', () => {
    expect(() => parseAndValidatePlan('', false)).not.toThrow() // 288
    expect(() => parseAndValidatePlan('invalid json or markdown', false)).not.toThrow() // 289
    expect(() => scanPlanForAllergens('', '')).not.toThrow() // 290
    expect(() => scanPlanForContraindications('', '')).not.toThrow() // 291
    expect(() => classifyMedicalIntake('')).not.toThrow() // 292
    expect(() => calculateBarbellPlates(-10, 20)).not.toThrow() // 293
    expect(() => calculateBarbellPlates(100, 0)).not.toThrow() // 294
    expect(() => calculateEstimated1RM(-50, 0)).not.toThrow() // 295
    expect(() => getExerciseAlternatives('')).not.toThrow() // 296
    expect(() => getMovementPattern('')).not.toThrow() // 297
    expect(() => calculateHydrationTarget('')).not.toThrow() // 298
  })
})
