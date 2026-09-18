export type MetricUnit = 'cm' | 'in'

export type BodyMetricKey = 'waist' | 'chest' | 'arms' | 'thighs' | 'hips'

export interface BodyMeasurementEntry {
  id: string
  date: string // YYYY-MM-DD
  timestamp: number
  unit: MetricUnit
  waist?: number
  chest?: number
  arms?: number
  thighs?: number
  hips?: number
  notes?: string
}

export interface BodyMetricDelta {
  key: BodyMetricKey
  label: string
  current: number | null
  previous: number | null
  baseline: number | null
  deltaFromPrevious: number | null
  deltaFromBaseline: number | null
  unit: MetricUnit
}

export type TrendStatus = 'increasing' | 'decreasing' | 'stable' | 'insufficient_data'

export interface TrendTrajectoryPoint {
  id?: string
  date: string
  timestamp: number
  value: number
  formattedValue: string
  deltaFromPrevious: number | null
}

export interface MetricTrendAnalysis {
  key: BodyMetricKey
  label: string
  unit: MetricUnit
  current: number | null
  previous: number | null
  baseline: number | null
  deltaFromPrevious: number | null
  deltaFromBaseline: number | null
  ratePerWeek: number | null
  rateLabel: string
  trendStatus: TrendStatus
  observationsCount: number
  points: TrendTrajectoryPoint[]
  deltaDays: number | null
}
