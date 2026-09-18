/**
 * BodyMap AI — Body Measurement Trend Visualizer (E25-D)
 *
 * Compact, responsive, accessible visualization component for body circumference
 * trajectories and normalized weekly delta rates.
 *
 * Features:
 * - Metric selector tabs (waist, chest, arms, thighs, hips)
 * - Trajectory line chart via existing Recharts infrastructure
 * - Normalized weekly change rate chips
 * - Full WCAG 2.1 AA screen-reader tabular representation (sr-only)
 * - Respects prefers-reduced-motion
 * - Strict non-diagnostic descriptive safety boundary
 */

import React, { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { TrendingUp, Ruler, Info } from 'lucide-react'
import type { BodyMeasurementEntry, BodyMetricKey, MetricUnit } from '@/types/bodyMetrics'
import { METRIC_LABELS } from '@/lib/bodyMetricsStorage'
import {
  calculateMetricTrend,
  getAccessibleRateDescription
} from '@/lib/bodyMeasurementTrendEngine'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

interface BodyMeasurementVisualizerProps {
  entries: BodyMeasurementEntry[]
  unit: MetricUnit
  initialMetric?: BodyMetricKey
}

const METRIC_KEYS: BodyMetricKey[] = ['waist', 'chest', 'arms', 'thighs', 'hips']

export const BodyMeasurementVisualizer: React.FC<BodyMeasurementVisualizerProps> = ({
  entries,
  unit,
  initialMetric = 'waist'
}) => {
  const [selectedMetric, setSelectedMetric] = useState<BodyMetricKey>(initialMetric)
  const prefersReducedMotion = usePrefersReducedMotion()

  const analysis = useMemo(() => {
    return calculateMetricTrend(entries, selectedMetric, unit)
  }, [entries, selectedMetric, unit])

  const chartData = useMemo(() => {
    return analysis.points.map(pt => ({
      date: pt.date,
      value: pt.value,
      formattedValue: pt.formattedValue,
      deltaFromPrevious: pt.deltaFromPrevious
    }))
  }, [analysis.points])

  const accessibleDescription = useMemo(() => {
    return getAccessibleRateDescription(analysis)
  }, [analysis])

  return (
    <div
      className="w-full bg-bodymap-dark/40 rounded-xl border border-gray-800 p-3 sm:p-4"
      data-testid="body-measurement-visualizer"
    >
      {/* Header & Metric Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-neon-green" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-poppins font-semibold text-primary-text">
              Measurement Trajectory &amp; Rate
            </h3>
            <p className="text-[11px] text-secondary-text">
              Weekly delta velocity in {unit === 'in' ? 'inches' : 'centimeters'}
            </p>
          </div>
        </div>

        {/* Metric Selector Tabs */}
        <div
          role="tablist"
          aria-label="Select body measurement series"
          className="flex flex-wrap gap-1 bg-bodymap-dark p-1 rounded-lg border border-gray-800 self-start sm:self-auto"
        >
          {METRIC_KEYS.map(key => (
            <button
              key={key}
              role="tab"
              aria-selected={selectedMetric === key}
              aria-controls={`panel-${key}`}
              id={`tab-${key}`}
              onClick={() => setSelectedMetric(key)}
              className={`px-2.5 py-1 text-xs font-poppins font-medium rounded-md transition-all ${
                selectedMetric === key
                  ? 'bg-neon-green text-bodymap-dark shadow-sm'
                  : 'text-secondary-text hover:text-primary-text hover:bg-gray-800/50'
              }`}
            >
              {METRIC_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* KPI & Rate Summary Bar */}
      <div
        id={`panel-${selectedMetric}`}
        role="tabpanel"
        aria-labelledby={`tab-${selectedMetric}`}
        className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3"
      >
        <div className="p-2.5 bg-bodymap-dark/80 rounded-lg border border-gray-800/80">
          <span className="text-[10px] text-secondary-text block font-poppins uppercase tracking-wider">
            Latest {analysis.label}
          </span>
          <span className="text-base font-bold text-primary-text font-poppins">
            {analysis.current !== null ? `${analysis.current} ${unit}` : '—'}
          </span>
        </div>

        <div className="p-2.5 bg-bodymap-dark/80 rounded-lg border border-gray-800/80">
          <span className="text-[10px] text-secondary-text block font-poppins uppercase tracking-wider">
            Prev Change
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-sm font-semibold font-poppins ${
                analysis.deltaFromPrevious !== null && analysis.deltaFromPrevious !== 0
                  ? analysis.deltaFromPrevious > 0
                    ? 'text-bright-coral'
                    : 'text-neon-green'
                  : 'text-primary-text'
              }`}
            >
              {analysis.deltaFromPrevious !== null
                ? `${analysis.deltaFromPrevious > 0 ? '+' : ''}${analysis.deltaFromPrevious} ${unit}`
                : '—'}
            </span>
          </div>
        </div>

        <div className="p-2.5 bg-bodymap-dark/80 rounded-lg border border-gray-800/80">
          <span className="text-[10px] text-secondary-text block font-poppins uppercase tracking-wider">
            Baseline Change
          </span>
          <span
            className={`text-sm font-semibold font-poppins ${
              analysis.deltaFromBaseline !== null && analysis.deltaFromBaseline !== 0
                ? analysis.deltaFromBaseline > 0
                  ? 'text-bright-coral'
                  : 'text-neon-green'
                : 'text-primary-text'
            }`}
          >
            {analysis.deltaFromBaseline !== null
              ? `${analysis.deltaFromBaseline > 0 ? '+' : ''}${analysis.deltaFromBaseline} ${unit}`
              : '—'}
          </span>
        </div>

        <div className="p-2.5 bg-bodymap-dark/80 rounded-lg border border-gray-800/80">
          <span className="text-[10px] text-secondary-text block font-poppins uppercase tracking-wider">
            Rate / Week
          </span>
          <span
            data-testid="rate-per-week-badge"
            aria-label={accessibleDescription}
            className={`text-sm font-semibold font-poppins ${
              analysis.ratePerWeek !== null && analysis.ratePerWeek !== 0
                ? analysis.ratePerWeek > 0
                  ? 'text-bright-coral'
                  : 'text-neon-green'
                : 'text-gray-400'
            }`}
          >
            {analysis.rateLabel}
          </span>
        </div>
      </div>

      {/* Chart or State Notice */}
      {analysis.points.length >= 2 ? (
        <div className="h-48 w-full mt-2" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.6} />
              <XAxis
                dataKey="date"
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                stroke="#9CA3AF"
                fontSize={11}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1E1E1E',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontSize: '12px'
                }}
                formatter={(value: unknown) => {
                  const num = typeof value === 'number' ? value : Number(value)
                  return [`${num} ${unit}`, METRIC_LABELS[selectedMetric]]
                }}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#00FF88"
                strokeWidth={2.5}
                dot={{ fill: '#00FF88', strokeWidth: 1.5, r: 4 }}
                activeDot={{ r: 6, fill: '#00FF88' }}
                isAnimationActive={!prefersReducedMotion}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : analysis.points.length === 1 ? (
        <div
          data-testid="insufficient-data-state"
          className="p-4 bg-bodymap-dark/60 rounded-xl border border-gray-800 text-center text-xs text-secondary-text"
        >
          <Info className="w-4 h-4 text-neon-green mx-auto mb-1.5 opacity-80" aria-hidden="true" />
          <p>
            1 observation recorded ({analysis.points[0].value} {unit} on {analysis.points[0].date}).
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            Log at least 2 measurements across different dates to visualize trend trajectory and calculate weekly rate of change.
          </p>
        </div>
      ) : (
        <div
          data-testid="empty-metric-state"
          className="p-4 bg-bodymap-dark/60 rounded-xl border border-dashed border-gray-800 text-center text-xs text-secondary-text"
        >
          <Ruler className="w-4 h-4 text-gray-500 mx-auto mb-1.5 opacity-80" aria-hidden="true" />
          <p>No recorded measurements for {analysis.label.toLowerCase()}.</p>
          <p className="mt-1 text-[11px] text-gray-500">
            Log your first measurement to start tracking circumference progression.
          </p>
        </div>
      )}

      {/* Screen Reader Accessible Representation (WCAG 2.1 AA) */}
      <div className="sr-only" data-testid="accessible-trend-representation">
        <h4>{analysis.label} Measurement Progression Summary</h4>
        <p>
          Body measurement trajectory for {analysis.label}. Total recorded observations: {analysis.points.length}.{' '}
          {analysis.current !== null ? `Current measurement: ${analysis.current} ${unit}.` : 'No current measurement.'}{' '}
          {accessibleDescription}.
        </p>

        {analysis.points.length > 0 && (
          <table aria-label={`${analysis.label} measurement history table`}>
            <caption>{`Chronological ${analysis.label} measurements in ${unit}`}</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Measurement ({unit})</th>
                <th scope="col">Change from Previous</th>
              </tr>
            </thead>
            <tbody>
              {analysis.points.map((pt, idx) => (
                <tr key={pt.id || `${pt.date}-${idx}`}>
                  <td>{pt.date}</td>
                  <td>{pt.value} {unit}</td>
                  <td>
                    {pt.deltaFromPrevious !== null
                      ? `${pt.deltaFromPrevious > 0 ? '+' : ''}${pt.deltaFromPrevious} ${unit}`
                      : 'Baseline observation'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Clinical & Safety Boundary Disclaimer */}
      <p className="text-[11px] text-gray-500 mt-3 pt-2 border-t border-gray-800/80 leading-relaxed">
        Biometric circumference changes reflect natural tissue and fluid fluctuations. Weekly change rates are descriptive observations only and do not constitute medical advice or body composition diagnosis.
      </p>
    </div>
  )
}

export default BodyMeasurementVisualizer
