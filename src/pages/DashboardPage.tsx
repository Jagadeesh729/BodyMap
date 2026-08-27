import React, { useState, useEffect, useMemo } from 'react'
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
  Activity,
  X,
  Smile,
  Search
} from 'lucide-react'
import { filterWorkoutHistory } from '@/lib/workoutHistoryFilter'
import { filterLogsByTimeWindow, type AnalyticsTimeWindow } from '@/lib/analyticsTimeWindow'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { usePlan } from '@/context/PlanContext'
import { loadWorkoutHistory, loadActiveSession } from '@/lib/sessionStorage'
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
import type { BodyMeasurementEntry, MetricUnit } from '@/types/bodyMetrics'
import {
  loadBodyMetrics,
  saveBodyMeasurement,
  calculateBodyMetricDeltas
} from '@/lib/bodyMetricsStorage'
import { calculateMilestones, type Milestone } from '@/lib/milestoneTracker'
import { extractPersonalRecords, type PersonalRecord } from '@/lib/personalRecords'
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

  const refreshData = () => {
    setWorkoutHistory(loadWorkoutHistory())
    setActiveSession(loadActiveSession())
    setSavedPlans(loadSavedPlans())
    setBodyMetrics(loadBodyMetrics())
  }

  useEffect(() => {
    refreshData()
  }, [])

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
  const completedWorkoutsCount = Math.max(completedDays.length, workoutHistory.length)
  const currentStreak = calculateWorkoutStreak(workoutHistory, completedDays)
  const metricDeltas = useMemo(() => calculateBodyMetricDeltas(bodyMetrics, metricUnit), [bodyMetrics, metricUnit])
  const verifiedMilestones: Milestone[] = useMemo(() => {
    return calculateMilestones(workoutHistory, completedDays, currentStreak, savedPlans)
  }, [workoutHistory, completedDays, currentStreak, savedPlans])
  const personalRecords: PersonalRecord[] = useMemo(() => {
    return extractPersonalRecords(workoutHistory)
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
    return calculateTargetHeartRateZones(formData.age || 30)
  }, [formData.age])
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
    dispatch({
      type: 'LOAD_SAVED_PLAN',
      payload: plan.planState
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
                const est1rm = calculateEstimated1RM(pr.value, 10)
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
        <div className="card-dark">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-bright-coral" />
              <div>
                <h2 className="text-base sm:text-lg font-poppins font-semibold text-primary-text">
                  Target Heart Rate &amp; Intensity Zones
                </h2>
                <p className="text-xs text-secondary-text">
                  {heartRateZones.formulaLabel}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-gray-400 bg-gray-800/80 px-2.5 py-1 rounded border border-gray-700">
              Age: {heartRateZones.age} yrs • Est. Max: {heartRateZones.estimatedMaxHr} BPM
            </span>
          </div>

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
                      ({workoutHistory.length} / 50 stored)
                    </span>
                  )}
                </p>
                {/* F-02: Backup nudge when approaching the 50-session cap */}
                {workoutHistory.length >= 40 && (
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
                  placeholder="Search exercises, splits, tags..."
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
                        {log.sessionReflection && (log.sessionReflection.energyRating || log.sessionReflection.perceivedReadiness || (log.sessionReflection.reflectionTags && log.sessionReflection.reflectionTags.length > 0)) && (
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
                          </div>
                        )}
                      </div>

                      <Link
                        to={`/gym-mode/${log.dayIndex}`}
                        className="text-[11px] font-semibold text-electric-purple hover:text-neon-green transition-colors inline-flex items-center gap-1 pt-2 border-t border-gray-800"
                      >
                        Repeat Session &rarr;
                      </Link>
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

    </div>
  )
}

export default DashboardPage
