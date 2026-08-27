import { describe, it, expect } from 'vitest'
import { forecastEnergyBalancePace } from '@/lib/energyBalanceForecaster'

describe('Energy Balance & Weekly Rate Forecaster Suite', () => {
  it('forecasts weekly surplus pace accurately (+500 kcal/day -> +0.45 kg/week)', () => {
    // 2500 intake vs 2000 maintenance = +500 kcal/day -> +3500 kcal/week -> +0.45 kg/week
    const res = forecastEnergyBalancePace(2500, 2000)
    expect(res.hasForecast).toBe(true)
    expect(res.dailyDeltaKcal).toBe(500)
    expect(res.weeklyDeltaKcal).toBe(3500)
    expect(res.estimatedKgPerWeek).toBe(0.45)
    expect(res.trendType).toBe('surplus')
    expect(res.formattedPaceLabel).toContain('+0.45 kg/week')
  })

  it('forecasts weekly deficit pace accurately (-500 kcal/day -> -0.45 kg/week)', () => {
    // 1500 intake vs 2000 maintenance = -500 kcal/day -> -3500 kcal/week -> -0.45 kg/week
    const res = forecastEnergyBalancePace(1500, 2000)
    expect(res.hasForecast).toBe(true)
    expect(res.dailyDeltaKcal).toBe(-500)
    expect(res.estimatedKgPerWeek).toBe(-0.45)
    expect(res.trendType).toBe('deficit')
    expect(res.formattedPaceLabel).toContain('-0.45 kg/week')
  })

  it('identifies energy balance / maintenance accurately', () => {
    const res = forecastEnergyBalancePace(2000, 2000)
    expect(res.hasForecast).toBe(true)
    expect(res.dailyDeltaKcal).toBe(0)
    expect(res.estimatedKgPerWeek).toBe(0)
    expect(res.trendType).toBe('maintenance')
  })

  it('handles invalid or zero inputs gracefully without NaN', () => {
    expect(forecastEnergyBalancePace(0, 2000).hasForecast).toBe(false)
    expect(forecastEnergyBalancePace(2000, 0).hasForecast).toBe(false)
    expect(forecastEnergyBalancePace(null, undefined).hasForecast).toBe(false)
  })
})
