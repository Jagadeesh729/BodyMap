import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  Calendar,
  Download,
  Edit,
  User,
  Plus,
  Dumbbell,
  ArrowRight,
  Flame,
  CheckCircle2,
  Clock,
  Award,
  Layers,
  Copy,
  Trash2,
  BookmarkPlus,
  Ruler,
  AlertTriangle,
  RotateCcw,
  GitCompare,
  Trophy,
  X,
  Smile,
  Search,
  Heart,
  Droplets,
  FileSpreadsheet
} from 'lucide-react'
import {
  createWorkoutHistoryCsvBlob,
  getWorkoutHistoryCsvFilename,
  type WorkoutHistoryCsvScope
} from '@/lib/workoutHistoryCsvEngine'
import { filterWorkoutHistory } from '@/lib/workoutHistoryFilter'
import { filterLogsByTimeWindow, type AnalyticsTimeWindow } from '@/lib/analyticsTimeWindow'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { usePlan, initialState, type PlanState } from '@/context/PlanContext'
import { buildSafeState } from '@/context/planStorage'
import { hasSafetySensitiveMedicalIssues } from '@/lib/validation'
import { getActiveAllergenCategories } from '@/lib/allergenGuard'
import { computeProfileFingerprint } from '@/lib/planBinding'
import {
  loadWorkoutHistory,
  loadActiveSession,
  loadAndValidateActiveSession,
  clearActiveSession,
  deleteCompletedWorkoutLog,
  MAX_STORED_WORKOUTS,
  BACKUP_NUDGE_THRESHOLD
} from '@/lib/sessionStorage'
import { DeleteWorkoutLogModal } from '@/components/DeleteWorkoutLogModal'
import type { CompletedWorkoutLog, WorkoutSession } from '@/types/workoutSession'
import { calculateWorkoutStreak } from '@/lib/streakCalculation'
import type { SavedPlan } from '@/types/savedPlan'
import {
  loadSavedPlans,
  savePlanToLibrary,
  duplicateSavedPlan,
  deleteSavedPlan
} from '@/lib/savedPlansStorage'
import { compareSavedPlans } from '@/lib/planComparisonEngine'
import { calculateGoalProgress } from '@/lib/goalProgressEngine'
import { calculateGoalTrajectory } from '@/lib/goalTrajectoryEngine'
import type { BodyMeasurementEntry, MetricUnit } from '@/types/bodyMetrics'
import {
  loadBodyMetrics,
  saveBodyMeasurement,
  calculateBodyMetricDeltas,
  BODY_METRICS_STORAGE_KEY
} from '@/lib/bodyMetricsStorage'
import { BodyMeasurementVisualizer } from '@/components/BodyMeasurementVisualizer'
import {
  loadRestingHeartRate,
  saveRestingHeartRate,
  clearRestingHeartRate,
  DEFAULT_RESTING_HEART_RATE_BPM,
  RESTING_HEART_RATE_STORAGE_KEY
} from '@/lib/restingHeartRateStorage'
import { calculateMilestones, type Milestone } from '@/lib/milestoneTracker'
import { extractPersonalRecords, type PersonalRecord } from '@/lib/personalRecords'
import {
  extractExercisePRTrajectory,
  getAvailableExercisesForTrajectory,
  type ExercisePRTrajectory,
  type AvailableTrajectoryExercise
} from '@/lib/prProgressionTrajectory'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { aggregateCrossSessionExercises, type ExerciseCrossSessionSummary } from '@/lib/exerciseCrossSessionEngine'
import { calculateVolumeAnalytics, type VolumeAnalyticsResult } from '@/lib/volumeAnalytics'
import { calculateEstimated1RM } from '@/lib/oneRepMax'
import { generate28DayAdherenceCalendar, type AdherenceDayCell } from '@/lib/adherenceCalendar'
import { calculateWorkloadDensity, type WorkloadDensityMetrics } from '@/lib/workloadIntensity'
import { calculateTimeSinceLastWorkout } from '@/lib/recoveryReadiness'
import { calculate7DayTrainingStrain, type TrainingStrainResult } from '@/lib/trainingStrain'
import { calculateWeeklyMuscleFrequency } from '@/lib/muscleFrequencyMatrix'
import { calculateDeloadAdvisory } from '@/lib/deloadRecommender'
import { calculateAdherenceTier } from '@/lib/adherenceTiers'
import { calculateSplitBalance } from '@/lib/splitBalanceMatrix'
import { calculateTargetHeartRateZones } from '@/lib/targetHeartRateZones'
import { calculateHydrationTarget, type HydrationClimateContext } from '@/lib/hydrationTarget'
import {
  getTodayHydration,
  addHydration,
  resetTodayHydration,
  HYDRATION_STORAGE_KEY
} from '@/lib/hydrationTracker'
import { calculateTrainingDensityProgression } from '@/lib/trainingDensityProgression'
import { calculateMuscleRecoveryTimeline } from '@/lib/muscleRecoveryTimeline'
import { calculateSessionCaloricExpenditure } from '@/lib/sessionCaloricExpenditure'
import { DEFAULT_WEEKLY_PLAN } from '@/types/plan'

const DashboardPage: React.FC = () => {
  const { state, dispatch } = usePlan()
  const { formData, isGenerated, completedDays, weightLog } = state

  const [newWeight, setNewWeight] = useState('')
  const [userName, setUserName] = useState(() => {
    try {
      return localStorage.getItem('bodymap_user_name') || 'Athlete'
    } catch {
      return 'Athlete'
    }
  })
  const [isEditingName, setIsEditingName] = useState(false)
  const [workoutHistory, setWorkoutHistory] = useState<CompletedWorkoutLog[]>([])
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null)

  // Multi-Plan Library State
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([])
  const [isSavePlanModalOpen, setIsSavePlanModalOpen] = useState(false)
  const [planSaveName, setPlanSaveName] = useState('')
  const [pendingPlanSwitch, setPendingPlanSwitch] = useState<SavedPlan | null>(null)
  const [isPlanSwitchConfirmOpen, setIsPlanSwitchConfirmOpen] = useState(false)
  const [comparingPlanIds, setComparingPlanIds] = useState<{ planAId: string; planBId: string } | null>(null)

  // Body Metrics State
  const [bodyMetrics, setBodyMetrics] = useState<BodyMeasurementEntry[]>([])
  const [metricUnit, setMetricUnit] = useState<MetricUnit>('cm')
  const [isLogMetricModalOpen, setIsLogMetricModalOpen] = useState(false)
  const [metricForm, setMetricForm] = useState({
    date: new Date().toISOString().split('T')[0],
    waist: '',
    chest: '',
    arms: '',
    thighs: '',
    hips: '',
    notes: ''
  })

  // Workout History Filter & Search State
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all')
  const [historySortBy, setHistorySortBy] = useState<'newest' | 'oldest' | 'duration' | 'sets'>('newest')
  const [analyticsTimeWindow, setAnalyticsTimeWindow] = useState<AnalyticsTimeWindow>('all')
  const [selectedPrExercise, setSelectedPrExercise] = useState<string>('')
  const [restingHeartRateInput, setRestingHeartRateInput] = useState<number | string>(() => loadRestingHeartRate() ?? DEFAULT_RESTING_HEART_RATE_BPM)
  const [hydrationWeightInput, setHydrationWeightInput] = useState<string>(() => formData.weight || '70')
  const [hydrationExerciseMinutes, setHydrationExerciseMinutes] = useState<number>(45)
  const [hydrationClimate, setHydrationClimate] = useState<HydrationClimateContext>('temperate')
  const [todayHydration, setTodayHydration] = useState<number>(() => getTodayHydration())

  const handleAddHydration = useCallback((amountMl: number) => {
    const updated = addHydration(amountMl)
    setTodayHydration(updated)
  }, [])

  const handleResetHydration = useCallback(() => {
    resetTodayHydration()
    setTodayHydration(0)
  }, [])
  const [workoutToDelete, setWorkoutToDelete] = useState<CompletedWorkoutLog | null>(null)
  const [isExportingCsv, setIsExportingCsv] = useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()

  const filteredHistoryResult = useMemo(() => {
    return filterWorkoutHistory(workoutHistory, {
      searchQuery: historySearchQuery,
      dayIndex: selectedDayFilter === 'all' ? undefined : selectedDayFilter,
      sortBy: historySortBy
    })
  }, [workoutHistory, historySearchQuery, selectedDayFilter, historySortBy])

  const windowFilteredLogsSummary = useMemo(() => {
    return filterLogsByTimeWindow(workoutHistory, analyticsTimeWindow)
  }, [workoutHistory, analyticsTimeWindow])

  const refreshData = useCallback(() => {
    setWorkoutHistory(loadWorkoutHistory())
    setActiveSession(loadAndValidateActiveSession(state.planId, state.formData.medicalIssues))
    setSavedPlans(loadSavedPlans())
    setBodyMetrics(loadBodyMetrics())
    setTodayHydration(getTodayHydration())
  }, [state.planId, state.formData.medicalIssues])

  useEffect(() => {
    refreshData()
  }, [refreshData])

  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (!e.key || e.key === BODY_METRICS_STORAGE_KEY) {
        setBodyMetrics(loadBodyMetrics())
      }
      if (!e.key || e.key === RESTING_HEART_RATE_STORAGE_KEY) {
        setRestingHeartRateInput(loadRestingHeartRate() ?? DEFAULT_RESTING_HEART_RATE_BPM)
      }
      if (!e.key || e.key === HYDRATION_STORAGE_KEY) {
        setTodayHydration(getTodayHydration())
      }
    }
    window.addEventListener('storage', handleStorageSync)
    return () => window.removeEventListener('storage', handleStorageSync)
  }, [])

  useEffect(() => {
    if (formData.weight) {
      setHydrationWeightInput(formData.weight)
    }
  }, [formData.weight])

  const initialWeightNum = Number(formData.weight) || 72
  const targetWeightNum = formData.mainGoal === 'slim'
    ? Math.max(45, Math.round(initialWeightNum * 0.92))
    : formData.mainGoal === 'bulk'
    ? Math.round(initialWeightNum * 1.08)
    : initialWeightNum

  // Built dynamic chart data from chronologically sorted weightLog
  const sortedWeightLog = useMemo(() => {
    return [...weightLog].sort((a, b) => {
      const timeA = Date.parse(a.date)
      const timeB = Date.parse(b.date)
      if (!isNaN(timeA) && !isNaN(timeB)) {
        return timeA - timeB
      }
      return 0
    })
  }, [weightLog])

  const chartData = useMemo(() => {
    if (sortedWeightLog.length > 0) {
      return sortedWeightLog.map(entry => ({
        date: entry.date,
        weight: entry.weight
      }))
    }
    const currentW = initialWeightNum
    const delta = (targetWeightNum - currentW) / 4
    return [
      { date: 'Start', weight: currentW },
      { date: 'W2', weight: Number((currentW + delta * 0.3).toFixed(1)) },
      { date: 'W3', weight: Number((currentW + delta * 0.6).toFixed(1)) },
      { date: 'W4', weight: Number((currentW + delta * 0.85).toFixed(1)) },
      { date: 'Target', weight: targetWeightNum },
    ]
  }, [sortedWeightLog, initialWeightNum, targetWeightNum])

  const currentWeightNum = chartData[chartData.length - 1].weight
  const weightChange = Number((currentWeightNum - initialWeightNum).toFixed(1))
  const goalProgress = useMemo(() => {
    return calculateGoalProgress(initialWeightNum, currentWeightNum, targetWeightNum, sortedWeightLog)
  }, [initialWeightNum, currentWeightNum, targetWeightNum, sortedWeightLog])
  const goalTrajectory = useMemo(() => {
    return calculateGoalTrajectory(initialWeightNum, currentWeightNum, targetWeightNum)
  }, [initialWeightNum, currentWeightNum, targetWeightNum])
  const completedWorkoutsCount = Math.max(completedDays.length, workoutHistory.length)
  const currentStreak = calculateWorkoutStreak(workoutHistory, completedDays)
  const metricDeltas = useMemo(() => calculateBodyMetricDeltas(bodyMetrics, metricUnit), [bodyMetrics, metricUnit])
  const verifiedMilestones: Milestone[] = useMemo(() => {
    return calculateMilestones(workoutHistory, completedDays, currentStreak, savedPlans)
  }, [workoutHistory, completedDays, currentStreak, savedPlans])
  const personalRecords: PersonalRecord[] = useMemo(() => {
    return extractPersonalRecords(workoutHistory)
  }, [workoutHistory])
  const availablePrExercises: AvailableTrajectoryExercise[] = useMemo(() => {
    return getAvailableExercisesForTrajectory(workoutHistory)
  }, [workoutHistory])
  const effectivePrExercise = selectedPrExercise || (availablePrExercises.length > 0 ? availablePrExercises[0].name : '')
  const prTrajectory: ExercisePRTrajectory | null = useMemo(() => {
    if (!effectivePrExercise) return null
    return extractExercisePRTrajectory(workoutHistory, effectivePrExercise)
  }, [workoutHistory, effectivePrExercise])
  const crossSessionExercises: ExerciseCrossSessionSummary[] = useMemo(() => {
    return aggregateCrossSessionExercises(workoutHistory)
  }, [workoutHistory])
  const volumeAnalytics: VolumeAnalyticsResult = useMemo(() => {
    return calculateVolumeAnalytics(windowFilteredLogsSummary.filteredLogs)
  }, [windowFilteredLogsSummary.filteredLogs])
  const adherenceCalendar: AdherenceDayCell[] = useMemo(() => {
    return generate28DayAdherenceCalendar(workoutHistory)
  }, [workoutHistory])
  const latestWorkloadDensity: WorkloadDensityMetrics = useMemo(() => {
    return calculateWorkloadDensity(workoutHistory[0])
  }, [workoutHistory])
  const timeSinceLastWorkout = useMemo(() => {
    return calculateTimeSinceLastWorkout(workoutHistory)
  }, [workoutHistory])
  const trainingStrain: TrainingStrainResult = useMemo(() => {
    return calculate7DayTrainingStrain(workoutHistory)
  }, [workoutHistory])
  const muscleFrequency = useMemo(() => {
    return calculateWeeklyMuscleFrequency(DEFAULT_WEEKLY_PLAN)
  }, [])
  const deloadAdvisory = useMemo(() => {
    return calculateDeloadAdvisory(workoutHistory)
  }, [workoutHistory])
  const adherenceTier = useMemo(() => {
    return calculateAdherenceTier(workoutHistory)
  }, [workoutHistory])
  const splitBalance = useMemo(() => {
    return calculateSplitBalance(DEFAULT_WEEKLY_PLAN)
  }, [])
  const heartRateZones = useMemo(() => {
    return calculateTargetHeartRateZones(formData.age || 30, restingHeartRateInput)
  }, [formData.age, restingHeartRateInput])
  const hydrationGuideline = useMemo(() => {
    return calculateHydrationTarget(hydrationWeightInput || formData.weight || '70', {
      activityMinutes: hydrationExerciseMinutes,
      climate: hydrationClimate
    })
  }, [hydrationWeightInput, formData.weight, hydrationExerciseMinutes, hydrationClimate])
  const densityProgression = useMemo(() => {
    return calculateTrainingDensityProgression(workoutHistory)
  }, [workoutHistory])
  const muscleTimeline = useMemo(() => {
    return calculateMuscleRecoveryTimeline(workoutHistory)
  }, [workoutHistory])

  const handleAddWeight = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(newWeight)
    if (!val || val < 20 || val > 400) {
      toast({ title: 'Invalid weight', description: 'Please enter a valid weight between 20 and 400 kg.', variant: 'destructive' })
      return
    }
    const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    dispatch({
      type: 'LOG_WEIGHT',
      payload: { date: todayStr, weight: val }
    })
    setNewWeight('')
    toast({ title: 'Weight Logged! ⚖️', description: `Recorded ${val} kg for ${todayStr}.` })
  }

  const handleSaveName = () => {
    const trimmed = userName.trim()
    if (!trimmed) {
      setUserName('Athlete')
      localStorage.setItem('bodymap_user_name', 'Athlete')
    } else {
      localStorage.setItem('bodymap_user_name', trimmed)
    }
    setIsEditingName(false)
    toast({ title: 'Profile Updated', description: 'Your athlete name has been saved.' })
  }

  // --- Multi-Plan Handlers ---
  const handleSaveCurrentPlan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.generatedPlan && !isGenerated) {
      toast({ title: 'No Plan to Save', description: 'Generate a routine before saving it to your library.', variant: 'destructive' })
      return
    }
    const nameToUse = planSaveName.trim() || `${state.formData.mainGoal || 'Custom'} Routine (${new Date().toLocaleDateString()})`
    savePlanToLibrary(nameToUse, state)
    setSavedPlans(loadSavedPlans())
    setIsSavePlanModalOpen(false)
    setPlanSaveName('')
    toast({ title: 'Plan Saved to Library! 📚', description: `"${nameToUse}" has been saved.` })
  }

  const handleTriggerPlanSwitch = (plan: SavedPlan) => {
    const currentSession = loadActiveSession()
    if (currentSession && currentSession.status === 'in-progress') {
      setPendingPlanSwitch(plan)
      setIsPlanSwitchConfirmOpen(true)
    } else {
      executePlanSwitch(plan)
    }
  }

  const executePlanSwitch = (plan: SavedPlan) => {
    // Purge any active workout session from prior routine to prevent cross-plan state contamination
    clearActiveSession()

    // Canonical validation and sanitization of saved plan state
    const rawCandidate = {
      ...initialState,
      ...plan.planState,
      planId: plan.planState.planId || `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      boundProfile: plan.planState.boundProfile || plan.planState.formData,
      boundProfileFingerprint:
        plan.planState.boundProfileFingerprint ||
        (plan.planState.boundProfile
          ? computeProfileFingerprint(plan.planState.boundProfile)
          : plan.planState.formData
          ? computeProfileFingerprint(plan.planState.formData)
          : undefined),
    }

    const validated = buildSafeState(rawCandidate) || initialState

    // Health Profile Preservation:
    // If current profile has safety-critical medical constraints or active allergens,
    // preserve them in formData so that evaluatePlanProfileBinding will detect any
    // safety divergence against the saved plan's boundProfile and enforce the safety lockout!
    const currentHasMedical = hasSafetySensitiveMedicalIssues(state.formData.medicalIssues)
    const currentHasAllergens = getActiveAllergenCategories(state.formData.allergies).length > 0

    const finalPlanState: PlanState = {
      ...validated,
      formData: {
        ...validated.formData,
        ...(currentHasMedical ? { medicalIssues: state.formData.medicalIssues } : {}),
        ...(currentHasAllergens ? { allergies: state.formData.allergies } : {}),
      },
      stateVersion: undefined, // Freshly activated plan receives newly incremented Lamport version on persist
    }

    dispatch({
      type: 'LOAD_SAVED_PLAN',
      payload: finalPlanState,
    })
    setPendingPlanSwitch(null)
    setIsPlanSwitchConfirmOpen(false)
    toast({ title: 'Plan Activated! ⚡', description: `Switched active routine to "${plan.name}".` })
  }

  const handleDuplicatePlan = (id: string) => {
    const dup = duplicateSavedPlan(id)
    if (dup) {
      setSavedPlans(loadSavedPlans())
      toast({ title: 'Plan Duplicated', description: `Created copy: "${dup.name}"` })
    }
  }

  const handleDeletePlan = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}" from your library?`)) {
      deleteSavedPlan(id)
      setSavedPlans(loadSavedPlans())
      toast({ title: 'Plan Deleted', description: `"${name}" removed from library.` })
    }
  }

  const handleConfirmDeleteWorkout = (id: string) => {
    const success = deleteCompletedWorkoutLog(id)
    if (success) {
      setWorkoutHistory(prev => prev.filter(item => item.id !== id))
      toast({
        title: 'Workout Log Deleted',
        description: 'The workout record was removed from your history.'
      })
    } else {
      toast({
        title: 'Deletion Failed',
        description: 'Could not remove workout log. Please try again.',
        variant: 'destructive'
      })
    }
    setWorkoutToDelete(null)
    refreshData()
  }

  // --- Scoped CSV Export Handlers (E26-A) ---
  const triggerCsvDownload = useCallback((blob: Blob, filename: string) => {
    try {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename

      document.body.appendChild(link)
      link.click()
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link)
        }
        URL.revokeObjectURL(url)
        setIsExportingCsv(false)
      }, 150)
    } catch {
      setIsExportingCsv(false)
      toast({
        title: 'Export Failed',
        description: 'Unable to trigger CSV download.',
        variant: 'destructive'
      })
    }
  }, [])

  const handleExportFilteredCsv = useCallback(() => {
    if (isExportingCsv) return
    const logsToExport = filteredHistoryResult.logs
    if (logsToExport.length === 0) {
      toast({
        title: 'No Workouts to Export',
        description: 'Current filter produced zero matching workout sessions.',
        variant: 'destructive'
      })
      return
    }

    setIsExportingCsv(true)
    try {
      let scope: WorkoutHistoryCsvScope = 'all'
      if (selectedDayFilter !== 'all' && !historySearchQuery.trim()) {
        scope = { type: 'day', dayIndex: selectedDayFilter }
      } else if (selectedDayFilter !== 'all' || historySearchQuery.trim()) {
        scope = 'filtered'
      }

      const filename = getWorkoutHistoryCsvFilename(new Date(), scope)
      const blob = createWorkoutHistoryCsvBlob(logsToExport)
      triggerCsvDownload(blob, filename)

      toast({
        title: 'Workout History Exported! 📊',
        description: `Exported ${logsToExport.length} completed session${logsToExport.length === 1 ? '' : 's'} as CSV.`
      })
    } catch {
      setIsExportingCsv(false)
      toast({
        title: 'Export Failed',
        description: 'Unable to generate CSV workout history.',
        variant: 'destructive'
      })
    }
  }, [isExportingCsv, filteredHistoryResult.logs, selectedDayFilter, historySearchQuery, triggerCsvDownload])

  const handleExportSingleWorkoutCsv = useCallback((log: CompletedWorkoutLog) => {
    if (!log || isExportingCsv) return

    setIsExportingCsv(true)
    try {
      const logDate = log.completedAt ? new Date(log.completedAt) : new Date()
      const scope: WorkoutHistoryCsvScope = {
        type: 'single',
        title: log.dayTitle,
        dayIndex: log.dayIndex
      }
      const filename = getWorkoutHistoryCsvFilename(logDate, scope)
      const blob = createWorkoutHistoryCsvBlob([log])
      triggerCsvDownload(blob, filename)

      toast({
        title: 'Workout Session Exported! 📊',
        description: `Exported "${log.dayTitle || `Day ${(log.dayIndex ?? 0) + 1}`}" as CSV.`
      })
    } catch {
      setIsExportingCsv(false)
      toast({
        title: 'Export Failed',
        description: 'Unable to generate CSV for this workout session.',
        variant: 'destructive'
      })
    }
  }, [isExportingCsv, triggerCsvDownload])

  // --- Body Measurement Handlers ---
  const handleLogMeasurementSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const waistNum = parseFloat(metricForm.waist)
    const chestNum = parseFloat(metricForm.chest)
    const armsNum = parseFloat(metricForm.arms)
    const thighsNum = parseFloat(metricForm.thighs)
    const hipsNum = parseFloat(metricForm.hips)

    if (isNaN(waistNum) && isNaN(chestNum) && isNaN(armsNum) && isNaN(thighsNum) && isNaN(hipsNum)) {
      toast({ title: 'Empty Log', description: 'Please enter at least one measurement value.', variant: 'destructive' })
      return
    }

    saveBodyMeasurement({
      date: metricForm.date || new Date().toISOString().split('T')[0],
      unit: metricUnit,
      waist: isNaN(waistNum) ? undefined : waistNum,
      chest: isNaN(chestNum) ? undefined : chestNum,
      arms: isNaN(armsNum) ? undefined : armsNum,
      thighs: isNaN(thighsNum) ? undefined : thighsNum,
      hips: isNaN(hipsNum) ? undefined : hipsNum,
      notes: metricForm.notes.trim() || undefined
    })

    setBodyMetrics(loadBodyMetrics())
    setIsLogMetricModalOpen(false)
    setMetricForm({
      date: new Date().toISOString().split('T')[0],
      waist: '',
      chest: '',
      arms: '',
      thighs: '',
      hips: '',
      notes: ''
    })
    toast({ title: 'Measurements Logged! 📏', description: `Recorded body composition for ${metricForm.date}.` })
  }

  // Plan Comparison Derived Objects
  const comparisonDetails = useMemo(() => {
    if (!comparingPlanIds) return null
    const planA = savedPlans.find(p => p.id === comparingPlanIds.planAId)
    const planB = savedPlans.find(p => p.id === comparingPlanIds.planBId)
    if (!planA || !planB) return null
    return { planA, planB }
  }, [comparingPlanIds, savedPlans])

  return (
    <div className="min-h-screen bg-bodymap-dark py-12 px-4 sm:px-6 lg:px-8 text-primary-text">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card-dark p-6 rounded-2xl border border-gray-800">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-neon-green/20 rounded-full flex items-center justify-center border border-neon-green/30 shrink-0">
              <User className="w-7 h-7 text-neon-green" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="input-dark py-1 px-2 h-8 text-lg font-poppins font-bold w-48"
                      autoFocus
                    />
                    <Button onClick={handleSaveName} size="sm" className="btn-primary h-8 px-3 text-xs">
                      Save
                    </Button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl sm:text-2xl font-poppins font-bold text-primary-text">
                      Hello, {userName}
                    </h1>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-gray-400 hover:text-neon-green transition-colors"
                      title="Edit display name"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              <p className="text-xs sm:text-sm text-secondary-text font-open-sans">
                Goal: <span className="text-electric-purple font-semibold capitalize">{formData.mainGoal || 'Full Body Transformation'}</span> &bull; {formData.fitnessLevel || 'Intermediate'}
              </p>
              {timeSinceLastWorkout.hasHistory && (
                <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
                  <span>⏱️ Last Session: <strong className="text-neon-green">{timeSinceLastWorkout.formattedTimeAgo}</strong></span>
                  <span className="text-gray-600">&bull;</span>
                  <span className="text-gray-400">{timeSinceLastWorkout.bucketLabel}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              onClick={() => setIsSavePlanModalOpen(true)}
              variant="outline"
              size="sm"
              className="border-gray-700 bg-bodymap-dark hover:bg-gray-800 text-xs font-semibold text-primary-text flex items-center gap-1.5"
            >
              <BookmarkPlus className="w-4 h-4 text-electric-purple" />
              Save Active Plan
            </Button>
            <Link to="/weekly-plan" className="btn-primary text-xs py-2.5 px-4 inline-flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              View Weekly Plan
            </Link>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-dark p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-poppins font-bold uppercase tracking-wider text-secondary-text">Current Weight</span>
              <TrendingUp className="w-4 h-4 text-neon-green" />
            </div>
            <p className="text-2xl sm:text-3xl font-poppins font-bold text-primary-text mt-2">
              {currentWeightNum} <span className="text-sm font-normal text-secondary-text">kg</span>
            </p>
            <p className="text-xs text-secondary-text mt-1">
              Initial: {initialWeightNum} kg
            </p>
          </div>

          <div className="card-dark p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-poppins font-bold uppercase tracking-wider text-secondary-text">Weight Delta</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-electric-purple/20 text-electric-purple border border-electric-purple/30">
                  {goalProgress.progressPercent}% Goal
                </span>
              </div>
              <p className={`text-2xl sm:text-3xl font-poppins font-bold mt-2 ${
                weightChange <= 0 ? 'text-neon-green' : 'text-bright-coral'
              }`}>
                {weightChange > 0 ? `+${weightChange}` : weightChange} <span className="text-sm font-normal text-secondary-text">kg</span>
              </p>
            </div>
            <p className="text-xs text-secondary-text mt-1">
              Target: {targetWeightNum} kg ({goalProgress.remainingKg > 0 ? `${goalProgress.remainingKg} kg left` : 'Achieved!'})
              {goalProgress.remainingKg > 0 && goalTrajectory.milestoneCheckpoints.find(m => m.milestonePercent > goalProgress.progressPercent) && (
                <span className="block text-[10px] text-gray-400 font-mono mt-0.5">
                  Next checkpoint: {goalTrajectory.milestoneCheckpoints.find(m => m.milestonePercent > goalProgress.progressPercent)?.label}
                </span>
              )}
            </p>
          </div>

          <div className="card-dark p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-poppins font-bold uppercase tracking-wider text-secondary-text">Active Streak</span>
              <Flame className="w-4 h-4 text-bright-coral" />
            </div>
            <p className="text-2xl sm:text-3xl font-poppins font-bold text-bright-coral mt-2">
              {currentStreak} <span className="text-sm font-normal text-secondary-text">days</span>
            </p>
            <p className="text-xs text-secondary-text mt-1">
              {currentStreak > 0 ? 'Consistent progress!' : 'Start today to begin streak'}
            </p>
          </div>

          <div className="card-dark p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-poppins font-bold uppercase tracking-wider text-secondary-text">Workouts</span>
              <CheckCircle2 className="w-4 h-4 text-neon-green" />
            </div>
            <p className="text-2xl sm:text-3xl font-poppins font-bold text-primary-text mt-2">
              {completedWorkoutsCount}
            </p>
            <p className="text-xs text-secondary-text mt-1">
              Verified sessions logged
            </p>
          </div>
        </div>

        {/* 28-Day Training Consistency & Adherence Heatmap */}
        <div className="card-dark">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-neon-green" />
              <h2 className="text-base sm:text-lg font-poppins font-semibold text-primary-text">
                28-Day Training Consistency
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded border ${adherenceTier.tierColor}`}>
                {adherenceTier.tierLabel}
              </span>
              <span className="text-xs text-secondary-text hidden sm:inline">
                • {adherenceCalendar.filter(d => d.isCompleted).length} Active Days
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 sm:grid-cols-14 lg:grid-cols-28 gap-1.5 pt-2">
            {adherenceCalendar.map((day) => (
              <div
                key={day.dateStr}
                className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center transition-all ${
                  day.isCompleted
                    ? 'bg-neon-green/20 border-neon-green/50 text-neon-green font-bold shadow-sm shadow-neon-green/10'
                    : day.isToday
                    ? 'bg-electric-purple/20 border-electric-purple/50 text-electric-purple'
                    : 'bg-bodymap-dark border-gray-800 text-gray-500'
                }`}
                title={day.ariaLabel}
                aria-label={day.ariaLabel}
              >
                <span className="text-[9px] uppercase font-mono">{day.dayOfWeek}</span>
                <span className="text-xs font-poppins font-semibold mt-0.5">{day.dayOfMonth}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Verified Training Milestones Section */}
        <div className="card-dark">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Award className="w-5 h-5 text-neon-green" />
              <h2 className="text-base sm:text-lg font-poppins font-semibold text-primary-text">
                Verified Training Milestones
              </h2>
            </div>
            <span className="text-xs text-secondary-text">
              {verifiedMilestones.filter(m => m.isUnlocked).length} of {verifiedMilestones.length} Unlocked
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {verifiedMilestones.slice(0, 8).map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-xl border transition-all ${
                  m.isUnlocked
                    ? 'bg-neon-green/10 border-neon-green/40 text-primary-text shadow-sm shadow-neon-green/5'
                    : 'bg-bodymap-dark border-gray-800 text-gray-500 opacity-75'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className={`text-[11px] font-poppins font-bold truncate ${m.isUnlocked ? 'text-neon-green' : 'text-gray-400'}`}>
                    {m.title}
                  </span>
                  {m.isUnlocked && <CheckCircle2 className="w-3.5 h-3.5 text-neon-green shrink-0" />}
                </div>
                <p className="text-[11px] text-secondary-text truncate mb-2">{m.description}</p>
                <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${m.isUnlocked ? 'bg-neon-green' : 'bg-gray-600'}`}
                    style={{ width: `${m.progressPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Personal Records Vault Section */}
        <div className="card-dark">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-bright-coral" />
              <h2 className="text-base sm:text-lg font-poppins font-semibold text-primary-text">
                Personal Records (PR) Vault
              </h2>
            </div>
            <span className="text-xs text-secondary-text">
              {personalRecords.length} All-Time Peak Lift Records
            </span>
          </div>

          {personalRecords.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {personalRecords.slice(0, 8).map((pr) => {
                const est1rm = calculateEstimated1RM(
                  pr.value,
                  typeof pr.reps === 'number' && pr.reps > 0 ? pr.reps : 10
                )
                return (
                  <div
                    key={pr.id}
                    className="p-3.5 bg-bodymap-dark rounded-xl border border-gray-800 hover:border-gray-700 transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[11px] font-poppins font-bold text-bright-coral block truncate">
                        {pr.exerciseName}
                      </span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl font-poppins font-bold text-primary-text">{pr.value}</span>
                        <span className="text-xs text-secondary-text font-semibold">{pr.unit}</span>
                      </div>
                      {est1rm.hasValidEstimate && (
                        <span className="text-[10px] text-neon-green font-mono block mt-0.5">
                          Est. 1RM: ~{est1rm.estimated1rmKg} kg
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500 block mt-2 pt-1 border-t border-gray-800/60">
                      Set on {new Date(pr.achievedAt).toLocaleDateString()}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-secondary-text text-center bg-bodymap-dark/50 p-4 rounded-xl border border-dashed border-gray-800">
              No personal records logged yet. Complete weighted sets in Gym Mode to build your all-time PR vault.
            </p>
          )}

          {/* PR Load Progression & 1RM Trajectory (E6) */}
          {availablePrExercises.length > 0 && prTrajectory && (
            <div className="mt-6 pt-5 border-t border-gray-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-neon-green shrink-0" />
                  <div>
                    <h3 className="text-sm font-poppins font-semibold text-primary-text">
                      PR Load Progression &amp; 1RM Trajectory
                    </h3>
                    <p className="text-[11px] text-secondary-text">
                      Chronological peak working weight and estimated 1RM across logged workouts.
                    </p>
                  </div>
                </div>

                {/* Exercise Selector */}
                <div className="flex items-center gap-2">
                  <label htmlFor="pr-trajectory-select" className="sr-only">
                    Select exercise for progression trajectory
                  </label>
                  <select
                    id="pr-trajectory-select"
                    value={effectivePrExercise}
                    onChange={(e) => setSelectedPrExercise(e.target.value)}
                    className="bg-bodymap-dark border border-gray-800 rounded-lg text-xs font-poppins px-3 py-1.5 text-primary-text focus:outline-none focus:border-bright-coral"
                  >
                    {availablePrExercises.map((ex) => (
                      <option key={ex.normalized} value={ex.name}>
                        {ex.name} ({ex.count} sessions · {ex.peakWeightKg} kg peak)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Trajectory Stats Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="bg-bodymap-dark/70 border border-gray-800/80 rounded-lg p-2.5">
                  <span className="text-[10px] uppercase font-mono text-gray-400 block">All-Time Peak</span>
                  <span className="text-base font-poppins font-bold text-bright-coral">
                    {prTrajectory.allTimePeakWeightKg} <span className="text-xs text-secondary-text font-normal">kg</span>
                  </span>
                </div>
                <div className="bg-bodymap-dark/70 border border-gray-800/80 rounded-lg p-2.5">
                  <span className="text-[10px] uppercase font-mono text-gray-400 block">Est. Peak 1RM</span>
                  <span className="text-base font-poppins font-bold text-neon-green">
                    {prTrajectory.allTimePeak1rmKg ? `~${prTrajectory.allTimePeak1rmKg}` : '—'}{' '}
                    <span className="text-xs text-secondary-text font-normal">{prTrajectory.allTimePeak1rmKg ? 'kg' : ''}</span>
                  </span>
                </div>
                <div className="bg-bodymap-dark/70 border border-gray-800/80 rounded-lg p-2.5">
                  <span className="text-[10px] uppercase font-mono text-gray-400 block">Net Progress</span>
                  <span className={`text-base font-poppins font-bold ${prTrajectory.netWeightGainKg > 0 ? 'text-neon-green' : prTrajectory.netWeightGainKg < 0 ? 'text-bright-coral' : 'text-primary-text'}`}>
                    {prTrajectory.netWeightGainKg > 0 ? `+${prTrajectory.netWeightGainKg}` : `${prTrajectory.netWeightGainKg}`}{' '}
                    <span className="text-xs text-secondary-text font-normal">kg</span>
                  </span>
                </div>
                <div className="bg-bodymap-dark/70 border border-gray-800/80 rounded-lg p-2.5">
                  <span className="text-[10px] uppercase font-mono text-gray-400 block">Sessions Logged</span>
                  <span className="text-base font-poppins font-bold text-primary-text">
                    {prTrajectory.totalDataPoints}{' '}
                    <span className="text-xs text-secondary-text font-normal">pts</span>
                  </span>
                </div>
              </div>

              {/* Trajectory Recharts Chart */}
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={prTrajectory.points}
                    margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                    <XAxis dataKey="displayDate" stroke="#9CA3AF" fontSize={11} tickLine={false} />
                    <YAxis
                      domain={['dataMin - 5', 'dataMax + 5']}
                      stroke="#9CA3AF"
                      fontSize={11}
                      tickLine={false}
                      unit="kg"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E1E1E',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                        fontSize: '12px'
                      }}
                      formatter={(value: unknown, name: string) => {
                        if (name === 'weightKg') return [`${value} kg`, 'Peak Load']
                        if (name === 'estimated1rmKg') return [`~${value} kg`, 'Est. 1RM']
                        return [value, name]
                      }}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="weightKg"
                      stroke="#FF5733"
                      strokeWidth={2.5}
                      isAnimationActive={!prefersReducedMotion}
                      dot={(props) => {
                        const { cx, cy, payload } = props
                        const isBreakthrough = payload?.isPRBreakthrough
                        return (
                          <circle
                            key={`${cx}-${cy}`}
                            cx={cx}
                            cy={cy}
                            r={isBreakthrough ? 5.5 : 3.5}
                            fill={isBreakthrough ? '#00FF88' : '#FF5733'}
                            stroke="#121212"
                            strokeWidth={2}
                          />
                        )
                      }}
                      activeDot={{ r: 7, fill: '#FF5733' }}
                      name="weightKg"
                    />
                    {prTrajectory.allTimePeak1rmKg !== null && (
                      <Line
                        type="monotone"
                        dataKey="estimated1rmKg"
                        stroke="#00FF88"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        isAnimationActive={!prefersReducedMotion}
                        dot={false}
                        name="estimated1rmKg"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend & Accessible Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-800/60 text-[11px] text-secondary-text">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-bright-coral inline-block rounded-full" />
                    Peak Load
                  </span>
                  {prTrajectory.allTimePeak1rmKg !== null && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-neon-green border-dashed inline-block" />
                      Est. 1RM
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-neon-green inline-block" />
                    PR Breakthrough
                  </span>
                </div>

                <details className="text-[11px] text-gray-400">
                  <summary className="cursor-pointer hover:text-primary-text transition-colors">
                    View Tabular History ({prTrajectory.points.length})
                  </summary>
                  <div className="mt-2 overflow-x-auto max-h-36 border border-gray-800 rounded-lg">
                    <table className="w-full text-left text-[10px] font-mono">
                      <thead className="bg-gray-900/80 text-gray-400 border-b border-gray-800">
                        <tr>
                          <th className="p-1.5">Date</th>
                          <th className="p-1.5">Peak Load</th>
                          <th className="p-1.5">Reps</th>
                          <th className="p-1.5">Est. 1RM</th>
                          <th className="p-1.5">PR</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/60">
                        {prTrajectory.points.map((pt, idx) => (
                          <tr key={idx} className="hover:bg-gray-800/30">
                            <td className="p-1.5 text-gray-300">{pt.displayDate}</td>
                            <td className="p-1.5 font-bold text-bright-coral">{pt.weightKg} kg</td>
                            <td className="p-1.5 text-gray-400">{pt.reps ?? '—'}</td>
                            <td className="p-1.5 text-neon-green">{pt.estimated1rmKg ? `~${pt.estimated1rmKg} kg` : '—'}</td>
                            <td className="p-1.5">
                              {pt.isPRBreakthrough ? (
                                <span className="px-1 py-0.5 rounded bg-neon-green/20 text-neon-green font-semibold text-[9px]">PR</span>
                              ) : (
                                <span className="text-gray-600">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            </div>
          )}

          {/* Cross-Session Movement Frequency Strip */}
          {crossSessionExercises.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-gray-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
              <div>
                <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-bright-coral block">
                  Movement Volume &amp; Consistency
                </span>
                <span className="text-secondary-text text-[11px]">
                  Multi-session set volume recorded across training splits.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                {crossSessionExercises.slice(0, 4).map(ex => (
                  <span
                    key={ex.normalizedName}
                    className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-gray-300 font-semibold"
                    title={ex.factualSummary}
                  >
                    {ex.exerciseName}: <strong className="text-bright-coral">{ex.totalSetsCompleted} sets</strong> ({ex.totalSessions}x)
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Weekly Muscle Focus & Volume Analytics Section */}
        <div className="card-dark">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-electric-purple" />
              <div>
                <h2 className="text-base sm:text-lg font-poppins font-semibold text-primary-text">
                  Muscle Focus &amp; Weighted Volume
                </h2>
                <p className="text-xs text-secondary-text">
                  {windowFilteredLogsSummary.factualSummaryLabel}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Time Window Selector Pills */}
              <div className="flex items-center bg-bodymap-dark p-0.5 rounded-lg border border-gray-800 text-[11px]">
                {(['all', 30, 14, 7] as const).map((win) => (
                  <button
                    key={win}
                    onClick={() => setAnalyticsTimeWindow(win)}
                    className={`px-2 py-1 rounded font-semibold transition-colors ${
                      analyticsTimeWindow === win
                        ? 'bg-electric-purple text-white font-bold'
                        : 'text-gray-400 hover:text-primary-text'
                    }`}
                  >
                    {win === 'all' ? 'All Time' : `${win}D`}
                  </button>
                ))}
              </div>

              <span className="text-xs text-secondary-text font-mono">
                {volumeAnalytics.totalWeightedVolumeKg.toLocaleString()} kg
              </span>
            </div>
          </div>

          {volumeAnalytics.hasData ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {volumeAnalytics.focusBreakdown.map((item) => (
                <div
                  key={item.category}
                  className="p-3 bg-bodymap-dark rounded-xl border border-gray-800 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-xs font-poppins font-bold text-electric-purple block">
                      {item.category}
                    </span>
                    <span className="text-[11px] text-secondary-text block mt-0.5">
                      {item.totalSets} completed sets
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-800/80 flex items-baseline justify-between">
                    <span className="text-sm font-poppins font-bold text-primary-text">
                      {item.weightedVolumeKg > 0 ? `${item.weightedVolumeKg} kg` : 'Bodyweight'}
                    </span>
                    {item.percentageOfVolume > 0 && (
                      <span className="text-[10px] font-semibold text-neon-green">
                        {item.percentageOfVolume}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-secondary-text text-center bg-bodymap-dark/50 p-4 rounded-xl border border-dashed border-gray-800">
              No workout volume recorded yet. Complete exercises in Gym Mode to view your muscle group volume attribution.
            </p>
          )}

          {/* Workload Density & Session Efficiency Metrics */}
          {latestWorkloadDensity.hasData && (
            <div className="mt-4 pt-3.5 border-t border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-neon-green block">
                  Latest Session Density &amp; Pacing
                </span>
                <span className="text-secondary-text">
                  {latestWorkloadDensity.explanation}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                <span className="px-2.5 py-1 rounded bg-neon-green/20 text-neon-green border border-neon-green/40 font-semibold">
                  ~{latestWorkloadDensity.densityKgPerMin} kg/min
                </span>
                <span className="px-2.5 py-1 rounded bg-electric-purple/20 text-electric-purple border border-electric-purple/40 font-semibold">
                  ~{latestWorkloadDensity.setsPerHour} sets/hr
                </span>
              </div>
            </div>
          )}

          {/* 7-Day Training Load & Monotony Distribution */}
          {trainingStrain.hasData && (
            <div className="mt-3.5 pt-3.5 border-t border-gray-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-electric-purple block">
                  7-Day Training Load &amp; Monotony
                </span>
                <span className="text-secondary-text">
                  {trainingStrain.explanation}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                <span className="px-2.5 py-1 rounded bg-electric-purple/20 text-electric-purple border border-electric-purple/40 font-semibold">
                  Monotony: {trainingStrain.monotonyIndex}
                </span>
                <span className="px-2.5 py-1 rounded bg-gray-800 text-gray-300 border border-gray-700 font-semibold">
                  Strain: {trainingStrain.trainingStrainScore?.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Weekly Muscle Frequency Matrix */}
          {muscleFrequency.hasData && (
            <div className="mt-3.5 pt-3.5 border-t border-gray-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-neon-green block">
                  Weekly Muscle Frequency
                </span>
                <span className="text-secondary-text">
                  Direct scheduled target days per primary muscle group.
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
                {muscleFrequency.frequencies.map(f => (
                  <span
                    key={f.muscle}
                    className={`px-2 py-0.5 rounded border font-semibold ${
                      f.weeklyFrequency > 0
                        ? 'bg-neon-green/15 text-neon-green border-neon-green/30'
                        : 'bg-gray-800/60 text-gray-400 border-gray-700'
                    }`}
                  >
                    {f.muscle}: {f.frequencyLabel}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Deload Advisory Status */}
          {deloadAdvisory.hasData && (
            <div className="mt-3.5 pt-3.5 border-t border-gray-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-bright-coral block">
                  Deload &amp; Recovery Advisory
                </span>
                <span className="text-secondary-text">
                  {deloadAdvisory.explanation}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded font-mono text-[11px] font-semibold shrink-0 border ${
                deloadAdvisory.status === 'deload_recommended'
                  ? 'bg-bright-coral/20 text-bright-coral border-bright-coral/40'
                  : deloadAdvisory.status === 'consider_deload'
                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                  : 'bg-neon-green/15 text-neon-green border-neon-green/30'
              }`}>
                {deloadAdvisory.tierLabel}
              </span>
            </div>
          )}

          {/* Weekly Split Balance Matrix */}
          {splitBalance.hasData && (
            <div className="mt-3.5 pt-3.5 border-t border-gray-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-electric-purple block">
                  Weekly Split Balance (PPL Ratio)
                </span>
                <span className="text-secondary-text">
                  {splitBalance.summary}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded font-mono text-[11px] font-semibold shrink-0 border bg-electric-purple/15 text-electric-purple border-electric-purple/30">
                {splitBalance.balanceStatusLabel}
              </span>
            </div>
          )}

          {/* Training Density Progression Trend */}
          {densityProgression.hasSufficientData && (
            <div className="mt-3.5 pt-3.5 border-t border-gray-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-cyan-400 block">
                  Training Density Progression (28-Day Trend)
                </span>
                <span className="text-secondary-text">
                  {densityProgression.trendSummary}
                </span>
              </div>
              <span className={`px-2.5 py-1 rounded font-mono text-[11px] font-semibold shrink-0 border ${
                densityProgression.densityTrend === 'increasing_density'
                  ? 'bg-neon-green/20 text-neon-green border-neon-green/40'
                  : densityProgression.densityTrend === 'decreasing_density'
                  ? 'bg-bright-coral/20 text-bright-coral border-bright-coral/40'
                  : 'bg-gray-800 text-gray-300 border-gray-700'
              }`}>
                {densityProgression.trendLabel}
              </span>
            </div>
          )}
        </div>

        {/* Charts & Body Composition Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* Weight Progression Chart */}
          <div className="card-dark flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-poppins font-semibold text-primary-text">
                    Weight Progression
                  </h2>
                  <p className="text-xs text-secondary-text">Chronological trend vs goal target</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neon-green/20 text-neon-green border border-neon-green/30">
                  Target: {targetWeightNum} kg
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} tickLine={false} />
                    <YAxis domain={['dataMin - 2', 'dataMax + 2']} stroke="#9CA3AF" fontSize={12} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1E1E1E',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#FFFFFF'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#00FF88"
                      strokeWidth={3}
                      dot={{ fill: '#00FF88', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, fill: '#00FF88' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Log Form */}
            <form onSubmit={handleAddWeight} className="mt-6 pt-4 border-t border-gray-800 flex gap-3">
              <Input
                type="number"
                step="0.1"
                placeholder="Log today's weight (kg)"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="input-dark text-sm"
              />
              <Button type="submit" className="btn-primary text-xs py-2 px-4 flex-shrink-0">
                <Plus className="w-4 h-4 mr-1 inline" />
                Log Weight
              </Button>
            </form>
          </div>

          {/* Interactive Body Composition & Circumference Tracker */}
          <div className="card-dark flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-poppins font-semibold text-primary-text flex items-center gap-2">
                    <Ruler className="w-5 h-5 text-neon-green" /> Body Measurements
                  </h2>
                  <p className="text-xs text-secondary-text">Chronological circumference tracking</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-bodymap-dark p-0.5 rounded-lg border border-gray-800 text-xs">
                    <button
                      onClick={() => setMetricUnit('cm')}
                      className={`px-2 py-1 rounded font-semibold transition-colors ${metricUnit === 'cm' ? 'bg-neon-green text-bodymap-dark' : 'text-gray-400 hover:text-primary-text'}`}
                    >
                      cm
                    </button>
                    <button
                      onClick={() => setMetricUnit('in')}
                      className={`px-2 py-1 rounded font-semibold transition-colors ${metricUnit === 'in' ? 'bg-neon-green text-bodymap-dark' : 'text-gray-400 hover:text-primary-text'}`}
                    >
                      in
                    </button>
                  </div>

                  <Button
                    onClick={() => setIsLogMetricModalOpen(true)}
                    size="sm"
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log
                  </Button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(['waist', 'chest', 'arms', 'thighs', 'hips'] as const).map((key) => {
                  const data = metricDeltas[key]
                  return (
                    <div key={key} className="p-3 bg-bodymap-dark rounded-xl border border-gray-800">
                      <span className="text-xs text-secondary-text font-poppins capitalize">{data.label}</span>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="text-lg font-poppins font-bold text-primary-text">
                          {data.current !== null ? `${data.current} ${metricUnit}` : '—'}
                        </span>
                        {data.deltaFromPrevious !== null && (
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                            data.deltaFromPrevious <= 0 ? 'bg-neon-green/20 text-neon-green' : 'bg-bright-coral/20 text-bright-coral'
                          }`}>
                            {data.deltaFromPrevious > 0 ? `+${data.deltaFromPrevious}` : data.deltaFromPrevious}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 block mt-0.5">
                        {data.baseline !== null ? `Base: ${data.baseline} ${metricUnit}` : 'No baseline'}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* E25-D Body Measurement Trend Visualizer & Rate Analytics */}
              {bodyMetrics.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <BodyMeasurementVisualizer
                    entries={bodyMetrics}
                    unit={metricUnit}
                  />
                </div>
              )}

              {bodyMetrics.length === 0 && (
                <p className="text-xs text-secondary-text text-center mt-4 bg-bodymap-dark/50 p-3 rounded-lg border border-dashed border-gray-800">
                  No body measurements recorded yet. Tap <strong>+ Log</strong> to start tracking circumference.
                </p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-secondary-text">
              <span>Total Recorded Logs: <strong>{bodyMetrics.length}</strong></span>
              {bodyMetrics.length > 0 && (
                <span className="text-gray-400">
                  Latest: {bodyMetrics[0].date}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Target Heart Rate & Intensity Zones Section */}
        <div className="card-dark" aria-labelledby="heart-rate-zones-heading">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-bright-coral/15 border border-bright-coral/30 flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5 text-bright-coral" aria-hidden="true" />
              </div>
              <div>
                <h2 id="heart-rate-zones-heading" className="text-base sm:text-lg font-poppins font-semibold text-primary-text">
                  Target Heart Rate &amp; Intensity Zones
                </h2>
                <p className="text-xs text-secondary-text">
                  {heartRateZones.formulaLabel}
                </p>
              </div>
            </div>

            {/* Resting HR Input & Controls */}
            <div className="flex flex-wrap items-center gap-2 bg-gray-900/90 border border-gray-800 p-2 rounded-xl">
              <label htmlFor="resting-hr-input" className="text-xs font-semibold text-gray-300 whitespace-nowrap">
                Resting HR:
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const current = typeof restingHeartRateInput === 'number' ? restingHeartRateInput : parseInt(String(restingHeartRateInput), 10) || DEFAULT_RESTING_HEART_RATE_BPM
                    const nextVal = Math.max(30, current - 5)
                    setRestingHeartRateInput(nextVal)
                    saveRestingHeartRate(nextVal)
                  }}
                  className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-mono transition-colors"
                  aria-label="Subtract 5 BPM from rest rate"
                >
                  -5
                </button>
                <input
                  id="resting-hr-input"
                  type="number"
                  min={30}
                  max={120}
                  step={1}
                  value={restingHeartRateInput}
                  onChange={(e) => {
                    const val = e.target.value
                    setRestingHeartRateInput(val)
                    saveRestingHeartRate(val)
                  }}
                  className="w-16 px-2 py-1 text-xs text-center font-mono rounded bg-gray-950 border border-gray-700 text-primary-text focus:outline-none focus:border-neon-green"
                  aria-label="Rest Heart Rate BPM"
                />
                <button
                  type="button"
                  onClick={() => {
                    const current = typeof restingHeartRateInput === 'number' ? restingHeartRateInput : parseInt(String(restingHeartRateInput), 10) || DEFAULT_RESTING_HEART_RATE_BPM
                    const nextVal = Math.min(120, current + 5)
                    setRestingHeartRateInput(nextVal)
                    saveRestingHeartRate(nextVal)
                  }}
                  className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-mono transition-colors"
                  aria-label="Add 5 BPM to rest rate"
                >
                  +5
                </button>
                <span className="text-xs font-mono text-gray-400 pl-1">BPM</span>
              </div>

              {/* Preset chips */}
              <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-gray-800">
                <span className="text-[10px] text-gray-500 font-mono">Presets:</span>
                {[50, 60, 70, 80].map((bpm) => (
                  <button
                    key={bpm}
                    type="button"
                    onClick={() => {
                      setRestingHeartRateInput(bpm)
                      saveRestingHeartRate(bpm)
                    }}
                    className={`px-1.5 py-0.5 text-[10px] rounded font-mono transition-colors ${
                      Number(restingHeartRateInput) === bpm
                        ? 'bg-bright-coral/20 text-bright-coral border border-bright-coral/40 font-bold'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-transparent'
                    }`}
                    aria-label={`Heart rate preset ${bpm} BPM`}
                  >
                    {bpm}
                  </button>
                ))}
              </div>

              {/* Reset to Default Button (Phase 5) */}
              {Number(restingHeartRateInput) !== DEFAULT_RESTING_HEART_RATE_BPM && (
                <div className="flex items-center pl-2 border-l border-gray-800">
                  <button
                    type="button"
                    onClick={() => {
                      setRestingHeartRateInput(DEFAULT_RESTING_HEART_RATE_BPM)
                      clearRestingHeartRate()
                    }}
                    className="px-2 py-1 text-[11px] rounded font-mono transition-colors bg-gray-800 hover:bg-bright-coral/20 text-gray-400 hover:text-bright-coral border border-gray-700 hover:border-bright-coral/40 flex items-center gap-1"
                    aria-label="Reset resting heart rate to default 60 BPM"
                    title="Reset resting heart rate to default (60 BPM)"
                    data-testid="reset-resting-hr-btn"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Details & Invariants Strip */}
          <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl p-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3 text-secondary-text font-mono text-[11px]">
              <span>Age: <strong className="text-gray-200">{heartRateZones.age} yrs</strong></span>
              <span>•</span>
              <span>Tanaka Est. Max: <strong className="text-bright-coral">{heartRateZones.estimatedMaxHr} BPM</strong></span>
              {heartRateZones.restingHr !== null && (
                <>
                  <span>•</span>
                  <span>Resting HR: <strong className="text-neon-green">{heartRateZones.restingHr} BPM</strong></span>
                  <span>•</span>
                  <span>HR Reserve (HRR): <strong className="text-electric-purple">{heartRateZones.heartRateReserve} BPM</strong></span>
                </>
              )}
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300 font-semibold">
              {heartRateZones.calculationMethod === 'karvonen_reserve' ? 'Karvonen Model' : 'Tanaka Percentage'}
            </span>
          </div>

          {/* Validation Error Alert if invalid */}
          {!heartRateZones.isValid && heartRateZones.validationErrors && heartRateZones.validationErrors.length > 0 && (
            <div className="p-3 mb-4 rounded-xl bg-bright-coral/15 border border-bright-coral/30 flex items-start gap-2.5 text-xs text-bright-coral">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Calculation Input Alert</p>
                <p className="text-gray-300 text-[11px] mt-0.5">
                  {heartRateZones.validationErrors.join('. ')}. Please enter an age between 10–100 years and a resting heart rate between 30–120 BPM that is lower than your estimated maximum heart rate.
                </p>
              </div>
            </div>
          )}

          {/* Visual Intensity Distribution Bar */}
          {heartRateZones.isValid && (
            <div className="mb-4 space-y-1.5" role="region" aria-label="Heart rate intensity zones visual distribution">
              <div className="flex justify-between items-center text-[10px] font-mono text-gray-400">
                <span>Intensity Continuum (% HRR)</span>
                <span>{heartRateZones.zones[0]?.bpmRange.min} BPM → {heartRateZones.zones[4]?.bpmRange.max} BPM</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden flex" role="progressbar" aria-label="Heart rate zones gradient breakdown">
                {heartRateZones.zones.map((zone) => (
                  <div
                    key={zone.zoneNumber}
                    style={{ width: '20%' }}
                    className={`h-full flex items-center justify-center text-[9px] font-mono font-bold text-gray-950 ${
                      zone.zoneNumber === 1 ? 'bg-blue-400' :
                      zone.zoneNumber === 2 ? 'bg-neon-green' :
                      zone.zoneNumber === 3 ? 'bg-amber-400' :
                      zone.zoneNumber === 4 ? 'bg-bright-coral' : 'bg-electric-purple'
                    }`}
                    title={`Zone ${zone.zoneNumber}: ${zone.bpmRange.min}–${zone.bpmRange.max} BPM`}
                  >
                    Z{zone.zoneNumber}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zones Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
            {heartRateZones.zones.map((zone) => (
              <div
                key={zone.zoneNumber}
                className={`p-3 rounded-xl border flex flex-col justify-between ${zone.zoneColor}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-poppins font-bold uppercase tracking-wider">
                      Zone {zone.zoneNumber}
                    </span>
                    <span className="text-[10px] font-mono opacity-80">
                      {zone.intensityRange}
                    </span>
                  </div>
                  <h3 className="font-poppins font-bold text-sm text-primary-text truncate">
                    {zone.zoneName}
                  </h3>
                  <div className="mt-1 font-mono text-base font-bold text-primary-text">
                    {zone.bpmRange.min}–{zone.bpmRange.max} <span className="text-xs font-normal text-secondary-text">BPM</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                  {zone.description}
                </p>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-gray-500 italic mt-3 text-center sm:text-left">
            * {heartRateZones.disclaimer}
          </p>
        </div>

        {/* Hydration Target Calculator Section (Enhancement E24) */}
        <div className="card-dark" aria-labelledby="hydration-target-heading">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Droplets className="w-5 h-5 text-blue-400" aria-hidden="true" />
              </div>
              <div>
                <h2 id="hydration-target-heading" className="text-base sm:text-lg font-poppins font-semibold text-primary-text">
                  Hydration Target Calculator
                </h2>
                <p className="text-xs text-secondary-text">
                  Biometric fluid guideline based on body mass, exercise, and climate
                </p>
              </div>
            </div>

            {/* Interactive Controls Strip */}
            <div className="flex flex-wrap items-center gap-2 bg-gray-900/90 border border-gray-800 p-2 rounded-xl">
              {/* Weight Adjustment */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="hydration-weight-input" className="text-xs font-semibold text-gray-300 whitespace-nowrap">
                  Weight:
                </label>
                <input
                  id="hydration-weight-input"
                  type="number"
                  min={30}
                  max={300}
                  step={0.5}
                  value={hydrationWeightInput}
                  onChange={(e) => setHydrationWeightInput(e.target.value)}
                  className="w-16 px-2 py-1 text-xs text-center font-mono rounded bg-gray-950 border border-gray-700 text-primary-text focus:outline-none focus:border-blue-400"
                  aria-label="Target Weight Kg"
                />
                <span className="text-xs font-mono text-gray-400">kg</span>
              </div>

              {/* Workout Duration Controls */}
              <div className="flex items-center gap-1 pl-2 border-l border-gray-800">
                <span className="text-xs font-semibold text-gray-300 whitespace-nowrap">
                  Exercise:
                </span>
                <button
                  type="button"
                  onClick={() => setHydrationExerciseMinutes((prev) => Math.max(0, prev - 15))}
                  className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-mono transition-colors"
                  aria-label="Step down 15 duration"
                >
                  -15
                </button>
                <span className="w-10 text-center text-xs font-mono text-primary-text">
                  {hydrationExerciseMinutes}m
                </span>
                <button
                  type="button"
                  onClick={() => setHydrationExerciseMinutes((prev) => Math.min(300, prev + 15))}
                  className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-mono transition-colors"
                  aria-label="Step up 15 duration"
                >
                  +15
                </button>
              </div>

              {/* Climate Context Selector */}
              <div className="flex items-center gap-1 pl-2 border-l border-gray-800">
                {(['temperate', 'warm', 'hot'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setHydrationClimate(c)}
                    className={`px-2 py-1 text-[11px] rounded font-mono capitalize transition-colors ${
                      hydrationClimate === c
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 font-bold'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-transparent'
                    }`}
                    aria-label={`${c} climate`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Details & Invariants Strip */}
          <div className="bg-gray-900/60 border border-gray-800/80 rounded-xl p-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-3 text-secondary-text font-mono text-[11px]">
              <span>Body Mass: <strong className="text-gray-200">{hydrationGuideline.weightKg ?? '—'} kg</strong></span>
              <span>•</span>
              <span>Baseline (30–35 mL/kg): <strong className="text-blue-400">{hydrationGuideline.baselineRangeMl.min.toLocaleString()}–{hydrationGuideline.baselineRangeMl.max.toLocaleString()} mL</strong></span>
              {hydrationGuideline.activityAdjustmentMl.midpoint > 0 && (
                <>
                  <span>•</span>
                  <span>Exercise ({hydrationGuideline.activityMinutes}m): <strong className="text-neon-green">+{hydrationGuideline.activityAdjustmentMl.min}–{hydrationGuideline.activityAdjustmentMl.max} mL</strong></span>
                </>
              )}
              {hydrationGuideline.climateAdjustmentMl > 0 && (
                <>
                  <span>•</span>
                  <span>Climate ({hydrationGuideline.climate}): <strong className="text-amber-400">+{hydrationGuideline.climateAdjustmentMl} mL</strong></span>
                </>
              )}
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300 font-semibold">
              EFSA &amp; ACSM Reference
            </span>
          </div>

          {/* Validation Error Alert if invalid */}
          {!hydrationGuideline.isValid && hydrationGuideline.validationErrors && hydrationGuideline.validationErrors.length > 0 && (
            <div className="p-3 mb-4 rounded-xl bg-bright-coral/15 border border-bright-coral/30 flex items-start gap-2.5 text-xs text-bright-coral">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Calculation Input Alert</p>
                <p className="text-gray-300 text-[11px] mt-0.5">
                  {hydrationGuideline.validationErrors.join('. ')}. Please enter a valid body weight between 30 and 300 kg.
                </p>
              </div>
            </div>
          )}

          {/* Fluid Continuum & Output Cards when valid */}
          {hydrationGuideline.isValid && (
            <div className="space-y-4">
              {/* Proportional Contribution Bar */}
              <div className="space-y-1.5" role="region" aria-label="Hydration intake guideline component distribution">
                <div className="flex justify-between items-center text-[10px] font-mono text-gray-400">
                  <span>Fluid Component Breakdown</span>
                  <span>Recommended: ~{hydrationGuideline.totalTargetMl.recommended.toLocaleString()} mL ({hydrationGuideline.totalTargetLiters.recommended} L)</span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden flex" role="progressbar" aria-label="Hydration components progress breakdown">
                  <div
                    style={{
                      width: `${Math.round((hydrationGuideline.baselineRangeMl.midpoint / (hydrationGuideline.totalTargetMl.recommended || 1)) * 100)}%`
                    }}
                    className="h-full bg-blue-500 flex items-center justify-center text-[9px] font-mono font-bold text-gray-950"
                    title={`Baseline: ${hydrationGuideline.baselineRangeMl.midpoint} mL`}
                  >
                    Base
                  </div>
                  {hydrationGuideline.activityAdjustmentMl.midpoint > 0 && (
                    <div
                      style={{
                        width: `${Math.round((hydrationGuideline.activityAdjustmentMl.midpoint / (hydrationGuideline.totalTargetMl.recommended || 1)) * 100)}%`
                      }}
                      className="h-full bg-neon-green flex items-center justify-center text-[9px] font-mono font-bold text-gray-950"
                      title={`Exercise: +${hydrationGuideline.activityAdjustmentMl.midpoint} mL`}
                    >
                      Ex
                    </div>
                  )}
                  {hydrationGuideline.climateAdjustmentMl > 0 && (
                    <div
                      style={{
                        width: `${Math.round((hydrationGuideline.climateAdjustmentMl / (hydrationGuideline.totalTargetMl.recommended || 1)) * 100)}%`
                      }}
                      className="h-full bg-amber-400 flex items-center justify-center text-[9px] font-mono font-bold text-gray-950"
                      title={`Climate: +${hydrationGuideline.climateAdjustmentMl} mL`}
                    >
                      Heat
                    </div>
                  )}
                </div>
              </div>

              {/* Metric Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Recommended Target */}
                <div className="p-3.5 rounded-xl border bg-blue-500/10 border-blue-500/30 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-blue-400">
                      Recommended Baseline Target
                    </span>
                    <div className="mt-1 font-mono text-xl font-bold text-primary-text">
                      ~{hydrationGuideline.totalTargetMl.recommended.toLocaleString()} <span className="text-xs font-normal text-secondary-text">mL/day</span>
                    </div>
                    <div className="font-mono text-xs text-blue-300 mt-0.5">
                      {hydrationGuideline.totalTargetLiters.recommended} Liters
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                    Midpoint starting target combining resting body mass baseline, planned training, and climate allowance.
                  </p>
                </div>

                {/* Estimated Daily Range */}
                <div className="p-3.5 rounded-xl border bg-gray-900/80 border-gray-800 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-gray-400">
                      Estimated Daily Range
                    </span>
                    <div className="mt-1 font-mono text-xl font-bold text-primary-text">
                      {hydrationGuideline.totalTargetMl.min.toLocaleString()}–{hydrationGuideline.totalTargetMl.max.toLocaleString()} <span className="text-xs font-normal text-secondary-text">mL</span>
                    </div>
                    <div className="font-mono text-xs text-secondary-text mt-0.5">
                      {hydrationGuideline.totalTargetLiters.min} – {hydrationGuideline.totalTargetLiters.max} Liters
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                    Accounting for variance in daily metabolic rate and exercise sweat rates (400–800 mL/hr).
                  </p>
                </div>

                {/* Serving Breakdown (Glasses) */}
                <div className="p-3.5 rounded-xl border bg-gray-900/80 border-gray-800 flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-gray-400">
                      Glass Equivalents (~250 mL)
                    </span>
                    <div className="mt-1 font-mono text-xl font-bold text-primary-text">
                      ~{hydrationGuideline.glassesEquivalent.recommended} <span className="text-xs font-normal text-secondary-text">glasses/day</span>
                    </div>
                    <div className="font-mono text-xs text-secondary-text mt-0.5">
                      Range: {hydrationGuideline.glassesEquivalent.min}–{hydrationGuideline.glassesEquivalent.max} standard glasses
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                    Standard 250 mL glass heuristic to facilitate intuitive pacing across the day.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* E27-B — Daily Hydration Intake Logging & Progress Alignment */}
          {hydrationGuideline.isValid && (
            <div
              className="mt-4 pt-4 border-t border-gray-800"
              aria-labelledby="hydration-intake-heading"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                {/* Left: progress label block */}
                <div className="flex-1">
                  <p
                    id="hydration-intake-heading"
                    className="text-[11px] font-poppins font-bold uppercase tracking-wider text-blue-400 mb-1.5"
                  >
                    Today&apos;s Intake Progress
                  </p>

                  {/* Progress bar */}
                  <div className="relative w-full">
                    <div
                      className="w-full bg-gray-900 rounded-full h-3 overflow-hidden"
                      role="progressbar"
                      aria-label="Today's hydration intake progress"
                      aria-valuenow={Math.min(100, Math.round((todayHydration / (hydrationGuideline.totalTargetMl.recommended || 1)) * 100))}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round((todayHydration / (hydrationGuideline.totalTargetMl.recommended || 1)) * 100))}%`,
                          transition: prefersReducedMotion ? 'none' : 'width 0.25s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Numeric status — aria-live for dynamic updates */}
                  <div
                    className="flex flex-wrap gap-3 mt-1.5 text-xs font-mono"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <span className="text-primary-text">
                      <strong>{todayHydration.toLocaleString()}</strong>
                      <span className="text-secondary-text"> / ~{hydrationGuideline.totalTargetMl.recommended.toLocaleString()} mL</span>
                    </span>
                    <span className="text-secondary-text">
                      Remaining:&nbsp;
                      <strong className="text-blue-300">
                        {Math.max(0, hydrationGuideline.totalTargetMl.recommended - todayHydration).toLocaleString()} mL
                      </strong>
                    </span>
                    <span className="text-secondary-text">
                      {Math.min(100, Math.round((todayHydration / (hydrationGuideline.totalTargetMl.recommended || 1)) * 100))}%
                    </span>
                  </div>
                </div>

                {/* Right: quick-add controls */}
                <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAddHydration(250)}
                    className="px-2.5 py-1 rounded bg-bodymap-dark hover:bg-gray-800 text-neon-green border border-gray-700 font-semibold transition-colors"
                    aria-label="Add 250 millilitres of water"
                    title="Add 250ml water"
                  >
                    +250ml
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddHydration(500)}
                    className="px-2.5 py-1 rounded bg-bodymap-dark hover:bg-gray-800 text-neon-green border border-gray-700 font-semibold transition-colors"
                    aria-label="Add 500 millilitres of water"
                    title="Add 500ml water"
                  >
                    +500ml
                  </button>
                  {todayHydration > 0 && (
                    <button
                      type="button"
                      onClick={handleResetHydration}
                      className="px-2 py-1 rounded text-gray-400 hover:text-red-400 text-[10px] font-sans transition-colors"
                      aria-label="Reset today's hydration intake to zero"
                      title="Reset today's hydration"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <p className="text-[10px] text-gray-500 italic mt-3 text-center sm:text-left">
            * {hydrationGuideline.disclaimer}
          </p>
        </div>

        {/* Muscle Group Recovery Readiness Timeline Section */}
        <div className="card-dark">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-neon-green" />
              <div>
                <h2 className="text-base sm:text-lg font-poppins font-semibold text-primary-text">
                  Muscle Group Recovery Timeline
                </h2>
                <p className="text-xs text-secondary-text">
                  {muscleTimeline.summary}
                </p>
              </div>
            </div>
            <span className="text-[10px] text-gray-400 bg-gray-800/80 px-2.5 py-1 rounded border border-gray-700 font-mono">
              6 Anatomical Muscle Clusters
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
            {muscleTimeline.muscles.map((m) => (
              <div
                key={m.muscle}
                className={`p-3 rounded-xl border flex flex-col justify-between ${m.statusColor}`}
              >
                <div>
                  <span className="text-[11px] font-poppins font-bold uppercase tracking-wider block">
                    {m.muscle}
                  </span>
                  <div className="mt-1 font-mono text-sm font-bold text-primary-text">
                    {m.hoursElapsed !== null ? `${m.hoursElapsed}h` : '—'}
                  </div>
                </div>
                <span className="text-[10px] font-medium opacity-90 mt-2 block truncate">
                  {m.windowLabel}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-gray-500 italic mt-3 text-center sm:text-left">
            * {muscleTimeline.disclaimer}
          </p>
        </div>

        {/* Multi-Plan Library Section */}
        <div className="card-dark">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-electric-purple/20 flex items-center justify-center">
                <Layers className="w-5 h-5 text-electric-purple" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-poppins font-semibold text-primary-text">
                  Saved Training Plans Library
                </h2>
                <p className="text-xs text-secondary-text font-open-sans">
                  Manage multiple training splits and seasonal routines locally
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {savedPlans.length >= 2 && (
                <Button
                  onClick={() => setComparingPlanIds({ planAId: savedPlans[0].id, planBId: savedPlans[1].id })}
                  variant="outline"
                  size="sm"
                  className="border-gray-700 text-xs py-1.5 px-3 flex items-center gap-1 text-secondary-text hover:text-primary-text"
                >
                  <GitCompare className="w-3.5 h-3.5 text-electric-purple" />
                  Compare Plans
                </Button>
              )}
              <Button
                onClick={() => setIsSavePlanModalOpen(true)}
                size="sm"
                className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                Save Current Plan
              </Button>
            </div>
          </div>

          {savedPlans.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="p-4 bg-bodymap-dark rounded-xl border border-gray-800 hover:border-gray-700 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-poppins font-bold px-2 py-0.5 rounded bg-electric-purple/15 text-electric-purple">
                        {plan.planState.formData.mainGoal || 'Custom Plan'}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {new Date(plan.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="font-poppins font-bold text-sm text-primary-text truncate mb-1">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-secondary-text mb-2">
                      {plan.planState.formData.fitnessLevel || 'Intermediate'} &bull; {plan.planState.formData.timePerDay || '45'} mins/day
                    </p>

                    {plan.tags && plan.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {plan.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-800">
                    <Button
                      onClick={() => handleTriggerPlanSwitch(plan)}
                      size="sm"
                      className="btn-primary text-[11px] py-1 px-3 h-7 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Activate
                    </Button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDuplicatePlan(plan.id)}
                        className="p-1.5 text-gray-400 hover:text-electric-purple transition-colors rounded hover:bg-gray-800"
                        title="Duplicate plan"
                        aria-label={`Duplicate plan ${plan.name}`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id, plan.name)}
                        className="p-1.5 text-gray-400 hover:text-bright-coral transition-colors rounded hover:bg-gray-800"
                        title="Delete plan"
                        aria-label={`Delete plan ${plan.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-bodymap-dark/60 rounded-xl border border-gray-800/80">
              <p className="text-sm font-poppins font-medium text-primary-text mb-1">
                No saved plans in your library yet
              </p>
              <p className="text-xs text-secondary-text mb-4 max-w-md mx-auto">
                Save your currently active plan or create multiple routines for different training goals.
              </p>
              <Button
                onClick={() => setIsSavePlanModalOpen(true)}
                size="sm"
                className="btn-primary text-xs py-2 px-5 inline-flex items-center gap-2"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                Save Current Plan to Library
              </Button>
            </div>
          )}
        </div>

        {/* Recent Workout History Stream */}
        <div className="card-dark mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-neon-green/20 flex items-center justify-center">
                <Dumbbell className="w-5 h-5 text-neon-green" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-poppins font-semibold text-primary-text">
                  Recent Workout Sessions
                </h2>
                <p className="text-xs text-secondary-text font-open-sans">
                  Your verified training logs recorded in Gym Mode
                  {workoutHistory.length > 0 && (
                    <span className="ml-2 font-mono text-[11px] text-gray-500">
                      ({workoutHistory.length} / {MAX_STORED_WORKOUTS} stored)
                    </span>
                  )}
                </p>
                {/* F-02: Backup nudge when approaching the storage cap */}
                {workoutHistory.length >= BACKUP_NUDGE_THRESHOLD && (
                  <p className="text-[11px] text-bright-coral font-semibold mt-0.5">
                    ⚠️ Approaching storage cap — export a backup to preserve older sessions.
                  </p>
                )}
              </div>
            </div>

            <Link
              to="/weekly-plan"
              className="text-xs font-semibold text-neon-green hover:underline flex items-center gap-1"
            >
              All Days <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* History Search & Split Filter Toolbar */}
          {workoutHistory.length > 0 && (
            <div className="mb-6 p-3.5 bg-bodymap-dark/80 rounded-xl border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Search exercises, splits, tags, notes..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="input-dark pl-9 py-1.5 h-8 text-xs w-full"
                />
                {historySearchQuery && (
                  <button
                    onClick={() => setHistorySearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs"
                    aria-label="Clear search query"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Split Filters & Sort Controls */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                {/* Day Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setSelectedDayFilter('all')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                      selectedDayFilter === 'all'
                        ? 'bg-neon-green text-black font-bold'
                        : 'bg-gray-850 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    All ({workoutHistory.length})
                  </button>
                  {filteredHistoryResult.uniqueDays.map((d) => (
                    <button
                      key={d.dayIndex}
                      onClick={() => setSelectedDayFilter(d.dayIndex)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors ${
                        selectedDayFilter === d.dayIndex
                          ? 'bg-electric-purple text-white font-bold'
                          : 'bg-gray-850 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      Day {d.dayIndex + 1} ({d.count})
                    </button>
                  ))}
                </div>

                {/* Sort Dropdown */}
                <select
                  value={historySortBy}
                  onChange={(e) => setHistorySortBy(e.target.value as 'newest' | 'oldest' | 'duration' | 'sets')}
                  className="bg-bodymap-dark border border-gray-700 text-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-neon-green"
                  aria-label="Sort workout history"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="duration">Longest Duration</option>
                  <option value="sets">Most Sets</option>
                </select>

                {/* Toolbar Export CSV Button (E26-A) */}
                <Button
                  onClick={handleExportFilteredCsv}
                  disabled={filteredHistoryResult.logs.length === 0 || isExportingCsv}
                  variant="outline"
                  size="sm"
                  className="border-gray-700 bg-bodymap-dark text-secondary-text hover:text-neon-green hover:border-neon-green text-xs font-semibold px-2.5 py-1 h-7 flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={
                    filteredHistoryResult.logs.length === 0
                      ? 'Export to CSV disabled (0 matching workouts)'
                      : selectedDayFilter !== 'all' || historySearchQuery.trim()
                      ? `Export ${filteredHistoryResult.logs.length} filtered workout${filteredHistoryResult.logs.length === 1 ? '' : 's'} to CSV`
                      : `Export ${filteredHistoryResult.logs.length} workout${filteredHistoryResult.logs.length === 1 ? '' : 's'} to CSV`
                  }
                  title={
                    filteredHistoryResult.logs.length === 0
                      ? 'No matching workouts to export'
                      : selectedDayFilter !== 'all' || historySearchQuery.trim()
                      ? `Export ${filteredHistoryResult.logs.length} filtered session(s) as CSV`
                      : `Export ${filteredHistoryResult.logs.length} session(s) as CSV`
                  }
                  data-testid="toolbar-export-csv-btn"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">CSV</span>
                </Button>
              </div>
            </div>
          )}

          {workoutHistory.length > 0 ? (
            filteredHistoryResult.logs.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredHistoryResult.logs.map((log) => {
                  const logMins = Math.max(1, Math.round(log.durationSeconds / 60))
                  const dateFormatted = new Date(log.completedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })

                  return (
                    <div
                      key={log.id}
                      className="p-4 bg-bodymap-dark rounded-xl border border-gray-800 hover:border-gray-700 transition-colors flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[11px] font-poppins font-bold px-2 py-0.5 rounded bg-neon-green/15 text-neon-green">
                            Day {log.dayIndex + 1}
                          </span>
                          <span className="text-[11px] text-gray-500">{dateFormatted}</span>
                        </div>

                        <h3 className="font-poppins font-bold text-sm text-primary-text truncate">
                          {log.dayTitle}
                        </h3>
                        <p className="text-xs text-secondary-text truncate mb-3">
                          {log.dayType}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-secondary-text mb-3">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-electric-purple" /> {logMins}m
                          </span>
                          <span className="flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-bright-coral" /> {log.totalSetsCompleted} sets
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-neon-green" /> {log.totalExercises} exercises
                          </span>
                        </div>

                        {/* Session Caloric Burn Estimate */}
                        {(() => {
                          const calRes = calculateSessionCaloricExpenditure(logMins, currentWeightNum || 70, 'moderate')
                          return calRes.hasValidInput ? (
                            <div className="text-[10px] font-mono text-gray-400 bg-gray-900/60 px-2 py-0.5 rounded border border-gray-800 mb-2 inline-block">
                              🔥 {calRes.calorieEstimateLabel}
                            </div>
                          ) : null
                        })()}

                        {/* Post-Workout Subjective Reflection Display */}
                        {log.sessionReflection && (log.sessionReflection.energyRating || log.sessionReflection.perceivedReadiness || (log.sessionReflection.reflectionTags && log.sessionReflection.reflectionTags.length > 0) || log.sessionReflection.notes) && (
                          <div className="mt-2 pt-2 border-t border-gray-850 text-[10px] space-y-1">
                            <div className="flex items-center gap-1.5 text-gray-400">
                              <Smile className="w-3 h-3 text-bright-coral" />
                              <span className="font-semibold text-gray-300">Reflection:</span>
                              {log.sessionReflection.energyRating && (
                                <span className="text-neon-green font-mono">
                                  ⚡ Energy {log.sessionReflection.energyRating}/5
                                </span>
                              )}
                              {log.sessionReflection.perceivedReadiness && (
                                <span className="text-electric-purple font-medium capitalize">
                                  • {log.sessionReflection.perceivedReadiness} Readiness
                                </span>
                              )}
                            </div>
                            {log.sessionReflection.reflectionTags && log.sessionReflection.reflectionTags.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {log.sessionReflection.reflectionTags.map(tag => (
                                  <span key={tag} className="px-1.5 py-0.2 rounded bg-gray-850 text-gray-400 font-mono text-[9px]">
                                    #{tag.replace(/\s+/g, '')}
                                  </span>
                                ))}
                              </div>
                            )}
                            {log.sessionReflection.notes && (
                              <p className="text-gray-400 italic text-[10px] pt-0.5 break-words">
                                &ldquo;{log.sessionReflection.notes}&rdquo;
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                        <Link
                          to={`/gym-mode/${log.dayIndex}`}
                          className="text-[11px] font-semibold text-electric-purple hover:text-neon-green transition-colors inline-flex items-center gap-1"
                        >
                          Repeat Session &rarr;
                        </Link>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleExportSingleWorkoutCsv(log)}
                            disabled={isExportingCsv}
                            className="text-[11px] text-gray-400 hover:text-neon-green transition-colors inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-neon-green/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-neon-green disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`Export CSV for ${log.dayTitle} completed on ${dateFormatted}`}
                            title={`Export ${log.dayTitle} to CSV`}
                            data-testid={`export-csv-btn-${log.id}`}
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Export CSV</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setWorkoutToDelete(log)}
                            className="text-[11px] text-gray-400 hover:text-bright-coral transition-colors inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-bright-coral/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-bright-coral"
                            aria-label={`Delete workout log: ${log.dayTitle}`}
                            title="Delete this workout log"
                            data-testid={`delete-workout-btn-${log.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-8 text-center bg-bodymap-dark/60 rounded-xl border border-gray-800/80">
                <p className="text-sm font-poppins font-medium text-primary-text mb-1">
                  No workouts found matching &ldquo;{historySearchQuery || `Day ${Number(selectedDayFilter) + 1}`}&rdquo;
                </p>
                <p className="text-xs text-secondary-text mb-4">
                  Try adjusting your search keywords or clear the filter.
                </p>
                <Button
                  onClick={() => {
                    setHistorySearchQuery('')
                    setSelectedDayFilter('all')
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-700"
                >
                  Clear Filters
                </Button>
              </div>
            )
          ) : (
            <div className="p-8 text-center bg-bodymap-dark/60 rounded-xl border border-gray-800/80">
              <p className="text-sm font-poppins font-medium text-primary-text mb-1">
                No Gym Mode workouts completed yet
              </p>
              <p className="text-xs text-secondary-text mb-4 max-w-md mx-auto">
                Launch interactive Gym Mode on any day to log sets, run automatic rest timers, and build your verified activity log.
              </p>
              <Link
                to="/gym-mode/0"
                className="btn-primary text-xs py-2 px-5 inline-flex items-center gap-2"
              >
                <Dumbbell className="w-3.5 h-3.5" />
                Start Day 1 Workout
              </Link>
            </div>
          )}
        </div>

        {/* Quick Action Navigation Grid */}
        <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
          <Link to="/weekly-plan" className="card-dark hover:border-electric-purple/50 transition-all group block">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-electric-purple/20 rounded-full flex items-center justify-center group-hover:bg-electric-purple/30 transition-colors flex-shrink-0">
                <Calendar className="w-6 h-6 text-electric-purple" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-poppins font-semibold text-primary-text group-hover:text-electric-purple transition-colors">
                  7-Day Schedule
                </h3>
                <p className="text-xs text-secondary-text font-open-sans">Interactive daily workouts &amp; meals</p>
              </div>
            </div>
          </Link>

          <Link to="/edit-plan" className="card-dark hover:border-bright-coral/50 transition-all group block">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-bright-coral/20 rounded-full flex items-center justify-center group-hover:bg-bright-coral/30 transition-colors flex-shrink-0">
                <Edit className="w-6 h-6 text-bright-coral" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-poppins font-semibold text-primary-text group-hover:text-bright-coral transition-colors">
                  Adjust Plan
                </h3>
                <p className="text-xs text-secondary-text font-open-sans">Regenerate with updated goals</p>
              </div>
            </div>
          </Link>

          <Link to="/download-plan" className="card-dark hover:border-neon-green/50 transition-all group block">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-neon-green/20 rounded-full flex items-center justify-center group-hover:bg-neon-green/30 transition-colors flex-shrink-0">
                <Download className="w-6 h-6 text-neon-green" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-poppins font-semibold text-primary-text group-hover:text-neon-green transition-colors">
                  Export Plan
                </h3>
                <p className="text-xs text-secondary-text font-open-sans">Download printable PDF or JSON backup</p>
              </div>
            </div>
          </Link>
        </div>

      </div>

      {/* Plan Comparison Modal Dialog */}
      {comparisonDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card-dark max-w-3xl w-full p-6 space-y-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-electric-purple" />
                <h3 className="text-lg font-poppins font-bold text-primary-text">
                  Side-by-Side Plan Comparison
                </h3>
              </div>
              <button
                onClick={() => setComparingPlanIds(null)}
                className="p-1.5 text-gray-400 hover:text-primary-text rounded-lg hover:bg-gray-800"
                aria-label="Close comparison"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Deterministic Plan Comparison Insights Banner */}
            {(() => {
              const comp = compareSavedPlans(comparisonDetails.planA, comparisonDetails.planB)
              return (
                <div className="p-3.5 bg-bodymap-dark rounded-xl border border-gray-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-poppins font-bold text-gray-200">Comparison Summary:</span>
                    <span className={`font-mono text-[11px] px-2 py-0.5 rounded font-semibold ${
                      comp.timePerDayDeltaMinutes === 0
                        ? 'bg-gray-800 text-gray-300'
                        : comp.timePerDayDeltaMinutes > 0
                        ? 'bg-electric-purple/20 text-electric-purple'
                        : 'bg-neon-green/20 text-neon-green'
                    }`}>
                      {comp.timePerDayLabel}
                    </span>
                  </div>
                  <p className="text-secondary-text text-[11px]">
                    {comp.factualSummary}
                  </p>
                  {comp.sharedEquipment.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <span className="font-semibold text-gray-300">Shared Gear:</span>
                      <span className="capitalize">{comp.sharedEquipment.join(', ')}</span>
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Plan A */}
              <div className="p-4 bg-bodymap-dark rounded-xl border border-gray-800 space-y-3">
                <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-electric-purple">
                  Plan A
                </span>
                <h4 className="text-base font-poppins font-bold text-primary-text truncate">
                  {comparisonDetails.planA.name}
                </h4>
                <div className="space-y-2 text-xs text-secondary-text">
                  <p>Goal: <strong className="text-primary-text">{comparisonDetails.planA.planState.formData.mainGoal || 'Custom'}</strong></p>
                  <p>Fitness Level: <strong className="text-primary-text">{comparisonDetails.planA.planState.formData.fitnessLevel || 'Intermediate'}</strong></p>
                  <p>Daily Time: <strong className="text-primary-text">{comparisonDetails.planA.planState.formData.timePerDay || '45'} mins</strong></p>
                  <p>Equipment: <strong className="text-primary-text">{comparisonDetails.planA.planState.formData.equipment?.join(', ') || 'Bodyweight'}</strong></p>
                  <p>Focus Areas: <strong className="text-primary-text">{comparisonDetails.planA.planState.formData.bodyFocus?.join(', ') || 'Full Body'}</strong></p>
                </div>
                <Button
                  onClick={() => {
                    executePlanSwitch(comparisonDetails.planA)
                    setComparingPlanIds(null)
                  }}
                  size="sm"
                  className="btn-primary text-xs w-full mt-2"
                >
                  Activate Plan A
                </Button>
              </div>

              {/* Plan B */}
              <div className="p-4 bg-bodymap-dark rounded-xl border border-gray-800 space-y-3">
                <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-neon-green">
                  Plan B
                </span>
                <h4 className="text-base font-poppins font-bold text-primary-text truncate">
                  {comparisonDetails.planB.name}
                </h4>
                <div className="space-y-2 text-xs text-secondary-text">
                  <p>Goal: <strong className="text-primary-text">{comparisonDetails.planB.planState.formData.mainGoal || 'Custom'}</strong></p>
                  <p>Fitness Level: <strong className="text-primary-text">{comparisonDetails.planB.planState.formData.fitnessLevel || 'Intermediate'}</strong></p>
                  <p>Daily Time: <strong className="text-primary-text">{comparisonDetails.planB.planState.formData.timePerDay || '45'} mins</strong></p>
                  <p>Equipment: <strong className="text-primary-text">{comparisonDetails.planB.planState.formData.equipment?.join(', ') || 'Bodyweight'}</strong></p>
                  <p>Focus Areas: <strong className="text-primary-text">{comparisonDetails.planB.planState.formData.bodyFocus?.join(', ') || 'Full Body'}</strong></p>
                </div>
                <Button
                  onClick={() => {
                    executePlanSwitch(comparisonDetails.planB)
                    setComparingPlanIds(null)
                  }}
                  size="sm"
                  className="btn-coral text-xs w-full mt-2"
                >
                  Activate Plan B
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Plan Modal Dialog */}
      {isSavePlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card-dark max-w-md w-full p-6 space-y-4 border border-gray-700">
            <h3 className="text-lg font-poppins font-bold text-primary-text flex items-center gap-2">
              <BookmarkPlus className="w-5 h-5 text-electric-purple" />
              Save Routine to Library
            </h3>
            <p className="text-xs text-secondary-text">
              Save your current 7-day routine so you can switch back to it anytime.
            </p>
            <form onSubmit={handleSaveCurrentPlan} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary-text mb-1">Plan Name</label>
                <Input
                  value={planSaveName}
                  onChange={(e) => setPlanSaveName(e.target.value)}
                  placeholder="e.g., Hypertrophy Block A"
                  className="input-dark text-sm"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => setIsSavePlanModalOpen(false)}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="btn-primary text-xs">
                  Save Plan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan Switch Conflict Warning Dialog */}
      {isPlanSwitchConfirmOpen && pendingPlanSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card-dark max-w-md w-full p-6 space-y-4 border border-bright-coral/50">
            <div className="flex items-center gap-3 text-bright-coral">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-poppins font-bold text-primary-text">
                Active Workout in Progress
              </h3>
            </div>
            <p className="text-xs text-secondary-text leading-relaxed">
              You currently have an active Gym Mode workout for <strong>{activeSession?.dayTitle}</strong>. Switching plans will activate &ldquo;{pendingPlanSwitch.name}&rdquo;.
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <Button
                type="button"
                onClick={() => {
                  setPendingPlanSwitch(null)
                  setIsPlanSwitchConfirmOpen(false)
                }}
                variant="ghost"
                size="sm"
                className="text-xs"
              >
                Keep Current
              </Button>
              <Button
                type="button"
                onClick={() => executePlanSwitch(pendingPlanSwitch)}
                size="sm"
                className="btn-coral text-xs"
              >
                Switch Plan Anyway
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Log Body Measurements Modal Dialog */}
      {isLogMetricModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card-dark max-w-lg w-full p-6 space-y-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-poppins font-bold text-primary-text flex items-center gap-2">
                <Ruler className="w-5 h-5 text-neon-green" />
                Log Body Measurements
              </h3>
              <span className="text-xs font-semibold text-neon-green uppercase tracking-wider">
                Unit: {metricUnit}
              </span>
            </div>

            <form onSubmit={handleLogMeasurementSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-secondary-text mb-1">Date</label>
                <Input
                  type="date"
                  value={metricForm.date}
                  onChange={(e) => setMetricForm({ ...metricForm, date: e.target.value })}
                  className="input-dark text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-secondary-text mb-1">Waist ({metricUnit})</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 82.5"
                    value={metricForm.waist}
                    onChange={(e) => setMetricForm({ ...metricForm, waist: e.target.value })}
                    className="input-dark text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary-text mb-1">Chest ({metricUnit})</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 102"
                    value={metricForm.chest}
                    onChange={(e) => setMetricForm({ ...metricForm, chest: e.target.value })}
                    className="input-dark text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary-text mb-1">Arms ({metricUnit})</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 36.5"
                    value={metricForm.arms}
                    onChange={(e) => setMetricForm({ ...metricForm, arms: e.target.value })}
                    className="input-dark text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary-text mb-1">Thighs ({metricUnit})</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 58"
                    value={metricForm.thighs}
                    onChange={(e) => setMetricForm({ ...metricForm, thighs: e.target.value })}
                    className="input-dark text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-secondary-text mb-1">Hips ({metricUnit})</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 96"
                    value={metricForm.hips}
                    onChange={(e) => setMetricForm({ ...metricForm, hips: e.target.value })}
                    className="input-dark text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-800">
                <Button
                  type="button"
                  onClick={() => setIsLogMetricModalOpen(false)}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="btn-primary text-xs">
                  Save Measurements
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Individual Workout Log Deletion Modal */}
      {workoutToDelete && (
        <DeleteWorkoutLogModal
          isOpen={Boolean(workoutToDelete)}
          log={workoutToDelete}
          onClose={() => setWorkoutToDelete(null)}
          onConfirmDelete={handleConfirmDeleteWorkout}
        />
      )}

    </div>
  )
}

export default DashboardPage
