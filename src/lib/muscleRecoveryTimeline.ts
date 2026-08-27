export type PrimaryMuscleGroup = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Core'

export type RecoveryWindowStatus = 'optimal_window' | 'moderate_window' | 'recent_stimulation' | 'no_recent_history'

export interface MuscleRecoveryItem {
  muscle: PrimaryMuscleGroup
  lastStimulatedTimestamp: number | null
  hoursElapsed: number | null
  daysElapsed: number | null
  recoveryWindowStatus: RecoveryWindowStatus
  windowLabel: string
  statusColor: string
}

export interface MuscleRecoveryTimelineResult {
  hasData: boolean
  muscles: MuscleRecoveryItem[]
  disclaimer: string
  summary: string
}

interface HistoricalWorkoutItemLike {
  date?: string
  completedAt?: string | number
  sessionData?: {
    exercises?: Array<{
      name?: string
      focus?: string
      sets?: Array<{ completed?: boolean }>
    }>
  }
  exercisesSummary?: Array<{ name?: string }>
}

const MUSCLE_GROUPS: PrimaryMuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core']

/**
 * Deterministically analyzes the elapsed hours and recovery readiness timeline across 6 primary muscle groups.
 * Explicitly labeled as a training-planning heuristic based on time since last stimulus, not an individualized biological recovery test.
 */
export function calculateMuscleRecoveryTimeline(
  workoutHistory: HistoricalWorkoutItemLike[] | null | undefined,
  referenceTimestamp: number = Date.now()
): MuscleRecoveryTimelineResult {
  if (!Array.isArray(workoutHistory) || workoutHistory.length === 0) {
    return {
      hasData: false,
      muscles: MUSCLE_GROUPS.map(m => ({
        muscle: m,
        lastStimulatedTimestamp: null,
        hoursElapsed: null,
        daysElapsed: null,
        recoveryWindowStatus: 'no_recent_history',
        windowLabel: 'No Recorded Sessions',
        statusColor: 'text-gray-400 border-gray-700 bg-gray-800/40'
      })),
      disclaimer: 'Training planning heuristic based on time elapsed since last session. Non-medical reference.',
      summary: 'No historical training sessions logged to calculate muscle recovery timeline.'
    }
  }

  const latestMuscleTimestamps: Record<PrimaryMuscleGroup, number | null> = {
    Chest: null,
    Back: null,
    Shoulders: null,
    Arms: null,
    Legs: null,
    Core: null
  }

  for (const item of workoutHistory) {
    if (!item) continue

    const ts = typeof item.completedAt === 'number'
      ? item.completedAt
      : typeof item.completedAt === 'string'
      ? new Date(item.completedAt).getTime()
      : item.date
      ? new Date(item.date).getTime()
      : 0

    if (isNaN(ts) || ts <= 0 || ts > referenceTimestamp) continue

    const exerciseNames: string[] = []

    if (item.sessionData?.exercises) {
      for (const ex of item.sessionData.exercises) {
        if (ex?.name) exerciseNames.push(ex.name)
      }
    } else if (item.exercisesSummary) {
      for (const ex of item.exercisesSummary) {
        if (ex?.name) exerciseNames.push(ex.name)
      }
    }

    for (const name of exerciseNames) {
      const lower = name.toLowerCase()
      if (lower.includes('bench') || lower.includes('chest') || lower.includes('push-up') || lower.includes('fly')) {
        updateTimestamp('Chest', ts, latestMuscleTimestamps)
      }
      if (lower.includes('row') || lower.includes('pull-up') || lower.includes('lat') || lower.includes('deadlift') || lower.includes('back')) {
        updateTimestamp('Back', ts, latestMuscleTimestamps)
      }
      if (lower.includes('overhead') || lower.includes('shoulder') || lower.includes('lateral') || lower.includes('press') && !lower.includes('leg')) {
        updateTimestamp('Shoulders', ts, latestMuscleTimestamps)
      }
      if (lower.includes('curl') || lower.includes('bicep') || lower.includes('tricep') || lower.includes('dip') || lower.includes('arm')) {
        updateTimestamp('Arms', ts, latestMuscleTimestamps)
      }
      if (lower.includes('squat') || lower.includes('lunge') || lower.includes('leg') || lower.includes('calf') || lower.includes('quad') || lower.includes('hamstring')) {
        updateTimestamp('Legs', ts, latestMuscleTimestamps)
      }
      if (lower.includes('plank') || lower.includes('crunch') || lower.includes('core') || lower.includes('ab') || lower.includes('twist')) {
        updateTimestamp('Core', ts, latestMuscleTimestamps)
      }
    }
  }

  const items: MuscleRecoveryItem[] = MUSCLE_GROUPS.map(muscle => {
    const lastTs = latestMuscleTimestamps[muscle]
    if (lastTs === null) {
      return {
        muscle,
        lastStimulatedTimestamp: null,
        hoursElapsed: null,
        daysElapsed: null,
        recoveryWindowStatus: 'no_recent_history',
        windowLabel: 'No Recent History',
        statusColor: 'text-gray-400 border-gray-700 bg-gray-800/40'
      }
    }

    const elapsedMs = Math.max(0, referenceTimestamp - lastTs)
    const hoursElapsed = Math.round(elapsedMs / (1000 * 60 * 60))
    const daysElapsed = Math.round((hoursElapsed / 24) * 10) / 10

    let recoveryWindowStatus: RecoveryWindowStatus = 'optimal_window'
    let windowLabel = `${hoursElapsed}h ago (>48h window)`
    let statusColor = 'text-neon-green border-neon-green/40 bg-neon-green/10'

    if (hoursElapsed < 24) {
      recoveryWindowStatus = 'recent_stimulation'
      windowLabel = `${hoursElapsed}h ago (<24h window)`
      statusColor = 'text-bright-coral border-bright-coral/40 bg-bright-coral/15'
    } else if (hoursElapsed <= 48) {
      recoveryWindowStatus = 'moderate_window'
      windowLabel = `${hoursElapsed}h ago (24–48h window)`
      statusColor = 'text-yellow-400 border-yellow-500/40 bg-yellow-950/20'
    }

    return {
      muscle,
      lastStimulatedTimestamp: lastTs,
      hoursElapsed,
      daysElapsed,
      recoveryWindowStatus,
      windowLabel,
      statusColor
    }
  })

  const stimulatedCount = items.filter(i => i.hoursElapsed !== null).length

  return {
    hasData: stimulatedCount > 0,
    muscles: items,
    disclaimer: 'Non-medical training heuristic based on elapsed time since last stimulus.',
    summary: `${stimulatedCount}/6 muscle groups tracked with stimulus history.`
  }
}

function updateTimestamp(muscle: PrimaryMuscleGroup, ts: number, record: Record<PrimaryMuscleGroup, number | null>) {
  if (record[muscle] === null || ts > record[muscle]!) {
    record[muscle] = ts
  }
}
