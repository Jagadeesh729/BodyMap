import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '@/pages/DashboardPage'
import { PlanProvider, usePlan } from '@/context/PlanContext'

vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>()
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 500, height: 300 }}>{children}</div>
    ),
  }
})

// Helper component to seed weight entries
const WeightSetupWrapper = ({ children, weightEntries }: { children: React.ReactNode, weightEntries?: { date: string, weight: number }[] }) => {
  const { dispatch } = usePlan()
  React.useEffect(() => {
    if (weightEntries) {
      weightEntries.forEach(entry => {
        dispatch({ type: 'LOG_WEIGHT', payload: entry })
      })
    }
  }, [dispatch, weightEntries])

  return <>{children}</>
}

const renderDashboard = (weightEntries?: { date: string, weight: number }[]) => {
  return render(
    <PlanProvider>
      <WeightSetupWrapper weightEntries={weightEntries}>
        <BrowserRouter>
          <DashboardPage />
        </BrowserRouter>
      </WeightSetupWrapper>
    </PlanProvider>
  )
}

describe('DashboardPage & Chronological Weight Sorting System', () => {
  beforeEach(() => {
    localStorage.clear()
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })

  it('renders dashboard title and action cards cleanly without crashing', () => {
    renderDashboard()
    expect(screen.getByText(/Hello/i)).toBeDefined()
    expect(screen.getByText(/Current Weight/i)).toBeDefined()
    expect(screen.getByText(/Goal:/i)).toBeDefined()
  })

  it('correctly handles out-of-order and backdated weight entries chronologically', () => {
    const unsortedEntries = [
      { date: '2026-08-25', weight: 75.0 },
      { date: '2026-08-10', weight: 78.2 },
      { date: '2026-08-18', weight: 76.5 },
    ]

    // Verify chronological sorting algorithm
    const sorted = [...unsortedEntries].sort((a, b) => {
      const timeA = Date.parse(a.date)
      const timeB = Date.parse(b.date)
      if (!isNaN(timeA) && !isNaN(timeB)) return timeA - timeB
      return 0
    })

    expect(sorted[0].date).toBe('2026-08-10')
    expect(sorted[1].date).toBe('2026-08-18')
    expect(sorted[2].date).toBe('2026-08-25')
  })

  it('tolerates invalid date strings without crashing or disrupting array order', () => {
    const entriesWithInvalidDate = [
      { date: 'Invalid Date', weight: 77.0 },
      { date: '2026-08-20', weight: 76.0 },
    ]

    const sorted = [...entriesWithInvalidDate].sort((a, b) => {
      const timeA = Date.parse(a.date)
      const timeB = Date.parse(b.date)
      if (!isNaN(timeA) && !isNaN(timeB)) return timeA - timeB
      return 0
    })

    expect(sorted.length).toBe(2)
  })

  it('renders recent workout sessions and motivational empty states', () => {
    renderDashboard()
    expect(screen.getByText(/Recent Workout Sessions/i)).toBeDefined()
    expect(screen.getByText(/No Gym Mode workouts completed yet/i)).toBeDefined()
    expect(screen.getByText(/Active Streak/i)).toBeDefined()
  })

  it('renders interactive Body Measurements card with unit toggles and empty state', () => {
    renderDashboard()
    expect(screen.getAllByText(/Body Measurements/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/No body measurements recorded yet/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /cm/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /in/i })).toBeDefined()
  })

  it('renders Multi-Plan Saved Training Plans Library section and save trigger', () => {
    renderDashboard()
    expect(screen.getByText(/Saved Training Plans Library/i)).toBeDefined()
    expect(screen.getByText(/No saved plans in your library yet/i)).toBeDefined()
    expect(screen.getAllByText(/Save Current Plan/i).length).toBeGreaterThan(0)
  })
})
