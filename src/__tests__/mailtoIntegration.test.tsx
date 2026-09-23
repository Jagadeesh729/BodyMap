import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { ContactForm } from '@/components/ContactForm'
import DownloadPlanPage from '@/pages/DownloadPlanPage'
import { PlanProvider, usePlan } from '@/context/PlanContext'

const SAFE_PLAN = `# BodyMap 7-Day Fitness & Diet Plan
## Day 1 - Full Body
- Dumbbell Bench Press: 3 sets x 10 reps
- Goblet Squat: 3 sets x 10 reps
Meals:
- Breakfast: Oatmeal with berries`

const SetupPlan = ({ children, planText }: { children: React.ReactNode; planText?: string }) => {
  const { dispatch } = usePlan()
  React.useEffect(() => {
    if (planText) {
      dispatch({ type: 'SET_GENERATED_PLAN', payload: planText })
    }
  }, [dispatch, planText])
  return <>{children}</>
}

const renderDownloadPage = (planText = SAFE_PLAN) => {
  return render(
    <PlanProvider>
      <SetupPlan planText={planText}>
        <BrowserRouter>
          <DownloadPlanPage />
        </BrowserRouter>
      </SetupPlan>
    </PlanProvider>
  )
}

describe('Mailto Integration — Component window.open Mock Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.open = vi.fn()
  })

  describe('ContactForm Component mailto integration', () => {
    it('calls window.open with a sanitized, properly encoded mailto URI on valid submission', () => {
      render(<ContactForm />)
      const nameInput = screen.getByLabelText(/name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const subjectInput = screen.getByLabelText(/subject/i)
      const messageInput = screen.getByLabelText(/message/i)
      const submitBtn = screen.getByRole('button', { name: /send message/i })

      fireEvent.change(nameInput, { target: { value: 'Alex Athlete' } })
      fireEvent.change(emailInput, { target: { value: 'alex@example.com' } })
      fireEvent.change(subjectInput, { target: { value: 'Custom 7-Day Plan & Diet?' } })
      fireEvent.change(messageInput, { target: { value: 'Hello,\nCan I adjust my calorie deficit?\nThanks!' } })
      fireEvent.click(submitBtn)

      expect(window.open).toHaveBeenCalledTimes(1)
      const openedUrl = String(vi.mocked(window.open).mock.calls[0][0])
      expect(openedUrl.startsWith('mailto:support@bodymap.ai?')).toBe(true)

      const parsed = new URL(openedUrl)
      expect(parsed.searchParams.get('subject')).toBe('Custom 7-Day Plan & Diet?')
      expect(parsed.searchParams.has('bcc')).toBe(false)
      expect(parsed.searchParams.has('cc')).toBe(false)
      expect(parsed.searchParams.get('body')).toContain('Can I adjust my calorie deficit?')
    })

    it('blocks window.open when encoded CRLF (%0d%0a) is injected into subject', () => {
      render(<ContactForm />)
      const nameInput = screen.getByLabelText(/name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const subjectInput = screen.getByLabelText(/subject/i)
      const messageInput = screen.getByLabelText(/message/i)
      const submitBtn = screen.getByRole('button', { name: /send message/i })

      fireEvent.change(nameInput, { target: { value: 'Adversary' } })
      fireEvent.change(emailInput, { target: { value: 'attacker@example.com' } })
      fireEvent.change(subjectInput, { target: { value: 'Inquiry%0d%0abcc:victim@example.com' } })
      fireEvent.change(messageInput, { target: { value: 'Malicious payload' } })
      fireEvent.click(submitBtn)

      expect(window.open).not.toHaveBeenCalled()
    })
  })

  describe('DownloadPlanPage Component mailto integration', () => {
    it('calls window.open with validated mailto URL when email is legitimate', () => {
      renderDownloadPage()
      const emailInput = screen.getByPlaceholderText(/enter email address/i)
      const sendBtn = screen.getByRole('button', { name: /^send$/i })

      fireEvent.change(emailInput, { target: { value: 'athlete@example.com' } })
      fireEvent.click(sendBtn)

      expect(window.open).toHaveBeenCalledTimes(1)
      const openedUrl = String(vi.mocked(window.open).mock.calls[0][0])
      expect(openedUrl.startsWith('mailto:athlete@example.com?')).toBe(true)
      const parsed = new URL(openedUrl)
      expect(parsed.searchParams.get('subject')).toBe('My BodyMap 7-Day Fitness & Diet Plan')
      expect(parsed.searchParams.has('bcc')).toBe(false)
      expect(parsed.searchParams.has('cc')).toBe(false)
      expect(parsed.searchParams.get('body')).toContain('custom BodyMap 7-day fitness and meal plan')
    })

    it('blocks window.open when delimiter injection (?bcc=) is attempted in recipient email', () => {
      renderDownloadPage()
      const emailInput = screen.getByPlaceholderText(/enter email address/i)
      const sendBtn = screen.getByRole('button', { name: /^send$/i })

      fireEvent.change(emailInput, { target: { value: 'athlete@example.com?bcc=evil@example.com' } })
      fireEvent.click(sendBtn)

      expect(window.open).not.toHaveBeenCalled()
    })

    it('blocks window.open when multiple recipients are attempted in recipient email', () => {
      renderDownloadPage()
      const emailInput = screen.getByPlaceholderText(/enter email address/i)
      const sendBtn = screen.getByRole('button', { name: /^send$/i })

      fireEvent.change(emailInput, { target: { value: 'athlete@example.com,victim@example.com' } })
      fireEvent.click(sendBtn)

      expect(window.open).not.toHaveBeenCalled()
    })

    it('blocks window.open when encoded CRLF is attempted in recipient email', () => {
      renderDownloadPage()
      const emailInput = screen.getByPlaceholderText(/enter email address/i)
      const sendBtn = screen.getByRole('button', { name: /^send$/i })

      fireEvent.change(emailInput, { target: { value: 'athlete@example.com%0d%0abcc:victim@example.com' } })
      fireEvent.click(sendBtn)

      expect(window.open).not.toHaveBeenCalled()
    })
  })
})
