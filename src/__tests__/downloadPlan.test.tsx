import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import DownloadPlanPage from '@/pages/DownloadPlanPage'
import { PlanProvider, usePlan } from '@/context/PlanContext'

// Helper component to dispatch a real generated plan into context
const SetupPlanWrapper = ({ children, planText }: { children: React.ReactNode, planText?: string }) => {
  const { dispatch } = usePlan()
  React.useEffect(() => {
    if (planText) {
      dispatch({
        type: 'SET_GENERATED_PLAN',
        payload: planText
      })
    }
  }, [dispatch, planText])

  return <>{children}</>
}

const renderDownloadPage = (planText?: string) => {
  return render(
    <PlanProvider>
      <SetupPlanWrapper planText={planText}>
        <BrowserRouter>
          <DownloadPlanPage />
        </BrowserRouter>
      </SetupPlanWrapper>
    </PlanProvider>
  )
}

describe('DownloadPlanPage & 7-Day Printable Document System', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.print = vi.fn()
  })

  it('renders export page title and action cards', () => {
    renderDownloadPage()
    expect(screen.getByText('Export & Share Your 7-Day Plan')).toBeDefined()
    expect(screen.getAllByText('Print or Save PDF').length).toBeGreaterThan(0)
    expect(screen.getByText('Markdown File')).toBeDefined()
    expect(screen.getAllByText('Share Plan').length).toBeGreaterThan(0)
    expect(screen.getByText('Copy All Text')).toBeDefined()
  })

  it('renders the dedicated 7-day printable document header and athlete summary', () => {
    const { container } = renderDownloadPage()
    expect(screen.getByText('BODYMAP 7-DAY FITNESS & DIET PROTOCOL')).toBeDefined()
    expect(screen.getByText('Athlete Goal')).toBeDefined()
    expect(screen.getByText('Biometrics & BMI')).toBeDefined()
    expect(screen.getByText('Daily Time & Gear')).toBeDefined()
    expect(screen.getByText('Dietary Preference')).toBeDefined()

    const doc = container.querySelector('.printable-plan-doc')
    expect(doc).toBeDefined()
    expect(doc?.classList.contains('printable-plan-doc')).toBe(true)
  })

  it('renders all 7 days with workouts and nutrition breakdown', () => {
    renderDownloadPage()
    expect(screen.getByText('Day 1 - Monday')).toBeDefined()
    expect(screen.getByText('Day 2 - Tuesday')).toBeDefined()
    expect(screen.getByText('Day 3 - Wednesday')).toBeDefined()
    expect(screen.getByText('Day 4 - Thursday')).toBeDefined()
    expect(screen.getByText('Day 5 - Friday')).toBeDefined()
    expect(screen.getByText('Day 6 - Saturday')).toBeDefined()
    expect(screen.getByText('Day 7 - Sunday')).toBeDefined()

    // Verifies Workout Protocol and Nutrition sections exist
    const workoutHeaders = screen.getAllByText('Workout Protocol')
    expect(workoutHeaders.length).toBe(7)

    const nutritionHeaders = screen.getAllByText('Daily Nutrition Plan')
    expect(nutritionHeaders.length).toBe(7)
  })

  it('triggers window.print when Print / Save PDF button is clicked', () => {
    renderDownloadPage()
    const printButtons = screen.getAllByRole('button', { name: /print/i })
    expect(printButtons.length).toBeGreaterThan(0)
    fireEvent.click(printButtons[0])
    expect(window.print).toHaveBeenCalledTimes(1)
  })

  it('contains health & safety medical disclaimer and attribution in document footer', () => {
    renderDownloadPage()
    expect(screen.getByText('Health & Safety Disclaimer:')).toBeDefined()
    expect(screen.getByText('https://bodymap-ai.vercel.app')).toBeDefined()
  })

  it('uses break-inside-avoid protection classes on day cards for clean printing', () => {
    const { container } = renderDownloadPage()
    const dayCards = container.querySelectorAll('.print-avoid-break')
    expect(dayCards.length).toBeGreaterThanOrEqual(7)
  })

  it('correctly renders custom generated plan content and tolerates missing biometrics without crashing', async () => {
    const customPlan = `
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
`
    const { container } = renderDownloadPage(customPlan)
    expect(container).toBeDefined()
    expect(screen.getByText('BODYMAP 7-DAY FITNESS & DIET PROTOCOL')).toBeDefined()
    expect(await screen.findByText('Day 1 - Chest & Triceps')).toBeDefined()
    expect(await screen.findByText('Day 2 - Back & Biceps')).toBeDefined()
    expect(screen.getByText(/BMI N\/A/)).toBeDefined()
  })

  it('gracefully falls back to clipboard copy when navigator.share is unavailable on desktop', () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
    // Ensure navigator.share is undefined
    const originalShare = (navigator as unknown as { share?: unknown }).share
    delete (navigator as unknown as { share?: unknown }).share

    renderDownloadPage()
    const shareButtons = screen.getAllByRole('button', { name: /share plan/i })
    expect(shareButtons.length).toBeGreaterThan(0)
    fireEvent.click(shareButtons[0])

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/weekly-plan'))

    // Restore navigator.share if it previously existed
    if (originalShare) {
      (navigator as unknown as { share?: unknown }).share = originalShare
    }
  })
})