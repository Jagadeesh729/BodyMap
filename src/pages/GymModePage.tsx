import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  Clock,
  Plus,
  Minus,
  Check,
  ChevronLeft,
  ChevronRight,
  List,
  AlertCircle,
  Volume2,
  VolumeX,
  Vibrate,
  VibrateOff,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { usePlan } from '@/context/PlanContext'
import { parseAndValidatePlan } from '@/lib/planSchema'
import { DEFAULT_WEEKLY_PLAN } from '@/types/plan'
import type { WorkoutSession, CompletedWorkoutLog } from '@/types/workoutSession'
import {
  parseExerciseStringToSessionExercise,
  type ExerciseAlternative
} from '@/lib/exerciseSubstitution'
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
  loadWorkoutHistory,
  saveCompletedWorkoutLog
} from '@/lib/sessionStorage'
import { findPreviousPerformance, type ExerciseHistoryRecord } from '@/lib/progressionEngine'
import {
  calculateSessionVolume,
  compareWorkoutWithPrevious,
  generateRecoveryAdvice
} from '@/lib/smartCoach'
import {
  getExerciseNote,
  saveExerciseNote,
  deleteExerciseNote
} from '@/lib/exerciseNotesStorage'
import { generateWarmupProtocol } from '@/lib/warmupProtocol'
import { calculateRecommendedRestSeconds } from '@/lib/restIntervalEngine'
import { extractPersonalRecords, normalizeExerciseName } from '@/lib/personalRecords'
import { calculateBarbellPlates } from '@/lib/plateLoadingCalculator'
import { extractPreviousSetPerformance } from '@/lib/exerciseSetProgress'
import { playTimerChime, triggerVibration } from '@/lib/audioCues'
import { RestTimerOverlay } from '@/components/gym/RestTimerOverlay'
import { ExerciseSubstitutionModal } from '@/components/gym/ExerciseSubstitutionModal'
import { WorkoutCompletionModal } from '@/components/gym/WorkoutCompletionModal'
import { ExitWorkoutDialog } from '@/components/gym/ExitWorkoutDialog'

export const GymModePage: React.FC = () => {
  const { dayIndex: dayIndexParam } = useParams<{ dayIndex?: string }>()
  const navigate = useNavigate()
  const { state, dispatch } = usePlan()

  const targetDayIndex = useMemo(() => {
    const parsed = parseInt(dayIndexParam || '0', 10)
    return isNaN(parsed) || parsed < 0 || parsed > 6 ? 0 : parsed
  }, [dayIndexParam])

  // Get current plan data for target day
  const planData = useMemo(() => {
    if (state.generatedPlan) {
      const parsed = parseAndValidatePlan(state.generatedPlan, false)
      if (parsed.success && parsed.data && parsed.data.days.length > targetDayIndex) {
        const day = parsed.data.days[targetDayIndex]
        return {
          title: day.title || `Day ${targetDayIndex + 1}`,
          type: day.isRestDay ? 'Active Recovery' : `${state.formData.mainGoal || 'Strength & Conditioning'}`,
          durationMinutes: parseInt(state.formData.timePerDay || '45', 10) || 45,
          exercises: day.workout?.exercises && day.workout.exercises.length > 0
            ? day.workout.exercises.map((e, idx) =>
                parseExerciseStringToSessionExercise(
                  `${e.name}${e.sets ? `: ${e.sets} sets` : ''}${e.reps ? ` x ${e.reps} reps` : ''}${e.rest ? ` (${e.rest} rest)` : ''}`,
                  idx
                )
              )
            : day.rawContent
            ? day.rawContent.split('\n').filter(l => l.trim().length > 3).map((l, idx) => parseExerciseStringToSessionExercise(l, idx))
            : [parseExerciseStringToSessionExercise('Bodyweight Circuit: 3 sets x 12 reps (60s rest)', 0)]
        }
      }
    }
    const defaultDay = DEFAULT_WEEKLY_PLAN[targetDayIndex] || DEFAULT_WEEKLY_PLAN[0]
    return {
      title: defaultDay.day,
      type: defaultDay.type,
      durationMinutes: 45,
      exercises: defaultDay.workout.main.map((e, idx) => parseExerciseStringToSessionExercise(e, idx))
    }
  }, [state.generatedPlan, state.formData, targetDayIndex])

  // Session state
  const [session, setSession] = useState<WorkoutSession>(() => {
    const saved = loadActiveSession()
    if (saved && saved.dayIndex === targetDayIndex && saved.status === 'in-progress') {
      return saved
    }
    return {
      sessionId: `sess_${Date.now()}`,
      dayIndex: targetDayIndex,
      dayTitle: planData.title,
      dayType: planData.type,
      durationMinutes: planData.durationMinutes,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      elapsedSeconds: 0,
      currentExerciseIndex: 0,
      exercises: planData.exercises,
      restTimer: {
        isActive: false,
        targetEndTime: null,
        durationSeconds: 60,
        isPaused: false,
        remainingSeconds: 60
      },
      status: 'in-progress',
      soundEnabled: true,
      vibrateEnabled: true
    }
  })

  // Detect if an active session for a different day exists
  const [conflictingSession, setConflictingSession] = useState<WorkoutSession | null>(() => {
    const saved = loadActiveSession()
    if (saved && saved.dayIndex !== targetDayIndex && saved.status === 'in-progress') {
      return saved
    }
    return null
  })

  // Track active stopwatch time accumulated across pauses/reloads
  const mountTimeRef = useRef<number>(Date.now())
  const initialElapsedRef = useRef<number>(session.elapsedSeconds)

  // Modal / Dialog states
  const [isSubModalOpen, setIsSubModalOpen] = useState(false)
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false)
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Persist session changes automatically
  useEffect(() => {
    if (session.status === 'in-progress') {
      saveActiveSession(session)
    }
  }, [session])

  // Active workout stopwatch effect
  useEffect(() => {
    if (session.status !== 'in-progress') return
    const interval = setInterval(() => {
      const activeDelta = Math.floor((Date.now() - mountTimeRef.current) / 1000)
      setSession(prev => ({
        ...prev,
        elapsedSeconds: initialElapsedRef.current + activeDelta
      }))
    }, 1000)
    return () => clearInterval(interval)
  }, [session.status])

  // Rest Timer engine with absolute timestamp resilience
  useEffect(() => {
    if (!session.restTimer.isActive || session.restTimer.isPaused || !session.restTimer.targetEndTime) {
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((session.restTimer.targetEndTime! - now) / 1000))

      if (remaining <= 0) {
        if (session.soundEnabled) playTimerChime()
        if (session.vibrateEnabled) triggerVibration()

        setSession(prev => ({
          ...prev,
          restTimer: {
            ...prev.restTimer,
            isActive: false,
            targetEndTime: null,
            remainingSeconds: 0
          }
        }))
        toast({ title: 'Rest Complete! 🔥', description: 'Get ready for your next set.' })
      } else {
        setSession(prev => ({
          ...prev,
          restTimer: {
            ...prev.restTimer,
            remainingSeconds: remaining
          }
        }))
      }
    }, 250)

    return () => clearInterval(interval)
  }, [session.restTimer.isActive, session.restTimer.isPaused, session.restTimer.targetEndTime, session.soundEnabled, session.vibrateEnabled])

  // Current active exercise
  const currentExercise = session.exercises[session.currentExerciseIndex] || session.exercises[0]

  // Exercise and Session metrics
  const totalExercises = session.exercises.length
  const progressPercent = Math.min(100, Math.round(((session.currentExerciseIndex + (currentExercise?.sets.filter(s => s.isCompleted).length || 0) / (currentExercise?.sets.length || 1)) / totalExercises) * 100))
  const totalSetsCompleted = session.exercises.reduce((sum, e) => sum + e.sets.filter(s => s.isCompleted).length, 0)

  // Toggle Set Complete
  const handleToggleSetComplete = useCallback((setIndex: number) => {
    setSession(prev => {
      const updatedExercises = [...prev.exercises]
      const ex = { ...updatedExercises[prev.currentExerciseIndex] }
      const sets = [...ex.sets]
      const s = { ...sets[setIndex - 1] }

      const isNowCompleted = !s.isCompleted
      s.isCompleted = isNowCompleted
      s.completedAt = isNowCompleted ? new Date().toISOString() : null
      sets[setIndex - 1] = s
      ex.sets = sets
      updatedExercises[prev.currentExerciseIndex] = ex

      // If completed set, trigger rest timer
      let updatedRestTimer = prev.restTimer
      if (isNowCompleted) {
        const restSecs = ex.restSeconds || 60
        updatedRestTimer = {
          isActive: true,
          targetEndTime: Date.now() + restSecs * 1000,
          durationSeconds: restSecs,
          isPaused: false,
          remainingSeconds: restSecs
        }
      }

      return {
        ...prev,
        exercises: updatedExercises,
        restTimer: updatedRestTimer
      }
    })
  }, [])

  // Exercise Personal Cue Note State
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [showWarmupLadder, setShowWarmupLadder] = useState(false)

  const currentExerciseNote = useMemo(() => {
    return currentExercise ? getExerciseNote(currentExercise.name) : null
  }, [currentExercise])

  const targetWorkingWeight = useMemo(() => {
    if (!currentExercise || !Array.isArray(currentExercise.sets)) return null
    const setWithWeight = currentExercise.sets.find(s => typeof s.weightKg === 'number' && s.weightKg > 0)
    return setWithWeight && typeof setWithWeight.weightKg === 'number' ? setWithWeight.weightKg : null
  }, [currentExercise])

  const warmupProtocol = useMemo(() => {
    return generateWarmupProtocol(targetWorkingWeight)
  }, [targetWorkingWeight])

  const recommendedRest = useMemo(() => {
    return calculateRecommendedRestSeconds(currentExercise?.name || '', targetWorkingWeight ? 8 : 10)
  }, [currentExercise, targetWorkingWeight])

  const currentExercisePr = useMemo(() => {
    if (!currentExercise) return null
    const history = loadWorkoutHistory()
    const allPrs = extractPersonalRecords(history)
    const norm = normalizeExerciseName(currentExercise.name)
    return allPrs.find(p => normalizeExerciseName(p.exerciseName) === norm) || null
  }, [currentExercise])

  const plateCalculation = useMemo(() => {
    return calculateBarbellPlates(targetWorkingWeight, 20)
  }, [targetWorkingWeight])

  const previousSetPerformance = useMemo(() => {
    if (!currentExercise) return null
    const history = loadWorkoutHistory()
    return extractPreviousSetPerformance(currentExercise.name, history)
  }, [currentExercise])

  const handleStartEditNote = () => {
    setNoteDraft(currentExerciseNote || '')
    setIsEditingNote(true)
  }

  const handleSaveNote = () => {
    if (currentExercise) {
      saveExerciseNote(currentExercise.name, noteDraft)
    }
    setIsEditingNote(false)
  }

  const handleDeleteNote = () => {
    if (currentExercise) {
      deleteExerciseNote(currentExercise.name)
    }
    setIsEditingNote(false)
  }

  // Update Completed Reps / Weight
  const handleUpdateSetReps = (setIndex: number, delta: number) => {
    const updatedExercises = [...session.exercises]
    const ex = { ...updatedExercises[session.currentExerciseIndex] }
    const sets = [...ex.sets]
    const s = { ...sets[setIndex - 1] }

    const nextReps = Math.max(1, s.completedReps + delta)
    s.completedReps = nextReps
    sets[setIndex - 1] = s
    ex.sets = sets
    updatedExercises[session.currentExerciseIndex] = ex

    setSession(prev => ({ ...prev, exercises: updatedExercises }))
  }

  const handleUpdateSetWeight = (setIndex: number, weightVal: string) => {
    const parsedWeight = parseFloat(weightVal)
    const updatedExercises = [...session.exercises]
    const ex = { ...updatedExercises[session.currentExerciseIndex] }
    const sets = [...ex.sets]
    const s = { ...sets[setIndex - 1] }

    s.weightKg = isNaN(parsedWeight) ? null : parsedWeight
    sets[setIndex - 1] = s
    ex.sets = sets
    updatedExercises[session.currentExerciseIndex] = ex

    setSession(prev => ({ ...prev, exercises: updatedExercises }))
  }

  const handleStepWeight = (setIndex: number, delta: number) => {
    const updatedExercises = [...session.exercises]
    const ex = { ...updatedExercises[session.currentExerciseIndex] }
    const sets = [...ex.sets]
    const s = { ...sets[setIndex - 1] }
    const currentWeight = typeof s.weightKg === 'number' ? s.weightKg : 0
    const nextWeight = Math.max(0, Number((currentWeight + delta).toFixed(1)))

    s.weightKg = nextWeight === 0 && currentWeight === 0 ? null : nextWeight
    sets[setIndex - 1] = s
    ex.sets = sets
    updatedExercises[session.currentExerciseIndex] = ex

    setSession(prev => ({ ...prev, exercises: updatedExercises }))
  }

  // Dynamic Set Management
  const handleAddSet = () => {
    const updatedExercises = [...session.exercises]
    const ex = { ...updatedExercises[session.currentExerciseIndex] }
    const sets = [...ex.sets]
    const nextIndex = sets.length + 1
    const lastSet = sets[sets.length - 1]
    sets.push({
      setIndex: nextIndex,
      targetReps: lastSet ? lastSet.targetReps : '10-12',
      completedReps: lastSet ? lastSet.completedReps : 10,
      weightKg: lastSet ? lastSet.weightKg : null,
      isCompleted: false,
      completedAt: null
    })
    ex.sets = sets
    ex.targetSets = sets.length
    updatedExercises[session.currentExerciseIndex] = ex
    setSession(prev => ({ ...prev, exercises: updatedExercises }))
    toast({ title: 'Set Added', description: `Added Set ${nextIndex} to ${ex.name}.` })
  }

  const handleRemoveSet = () => {
    const updatedExercises = [...session.exercises]
    const ex = { ...updatedExercises[session.currentExerciseIndex] }
    if (ex.sets.length <= 1) return
    const sets = ex.sets.slice(0, -1)
    ex.sets = sets
    ex.targetSets = sets.length
    updatedExercises[session.currentExerciseIndex] = ex
    setSession(prev => ({ ...prev, exercises: updatedExercises }))
    toast({ title: 'Set Removed', description: `Removed last set from ${ex.name}.` })
  }

  // Previous Session Ghost Reference
  const previousPerformance: ExerciseHistoryRecord | null = useMemo(() => {
    if (!currentExercise?.name) return null
    const history = loadWorkoutHistory()
    return findPreviousPerformance(currentExercise.name, history)
  }, [currentExercise?.name])

  const handleMatchPreviousWeight = () => {
    if (!previousPerformance?.lastWeightKg || !currentExercise) return
    const weightToCopy = previousPerformance.lastWeightKg
    const updatedExercises = [...session.exercises]
    const ex = { ...updatedExercises[session.currentExerciseIndex] }
    ex.sets = ex.sets.map(s => ({
      ...s,
      weightKg: weightToCopy
    }))
    updatedExercises[session.currentExerciseIndex] = ex
    setSession(prev => ({ ...prev, exercises: updatedExercises }))
    toast({
      title: 'Previous Weight Applied ⚖️',
      description: `Applied ${weightToCopy} kg across sets for ${ex.name}.`
    })
  }

  // Timer controls
  const handleToggleTimerPause = () => {
    setSession(prev => {
      if (prev.restTimer.isPaused) {
        return {
          ...prev,
          restTimer: {
            ...prev.restTimer,
            isPaused: false,
            targetEndTime: Date.now() + prev.restTimer.remainingSeconds * 1000
          }
        }
      } else {
        return {
          ...prev,
          restTimer: {
            ...prev.restTimer,
            isPaused: true,
            targetEndTime: null
          }
        }
      }
    })
  }

  const handleAddTimerSeconds = (sec: number) => {
    setSession(prev => {
      const nextRemaining = Math.max(5, prev.restTimer.remainingSeconds + sec)
      const nextTotal = Math.max(nextRemaining, prev.restTimer.durationSeconds + (sec > 0 ? sec : 0))
      return {
        ...prev,
        restTimer: {
          ...prev.restTimer,
          remainingSeconds: nextRemaining,
          durationSeconds: nextTotal,
          targetEndTime: prev.restTimer.isPaused ? null : Date.now() + nextRemaining * 1000
        }
      }
    })
  }

  const handleSkipTimer = () => {
    setSession(prev => ({
      ...prev,
      restTimer: {
        ...prev.restTimer,
        isActive: false,
        targetEndTime: null,
        remainingSeconds: 0
      }
    }))
  }

  // Complete Workout Flow with History Logging
  const handleCompleteWorkout = useCallback(() => {
    setSession(prev => {
      const totalSets = prev.exercises.reduce(
        (sum, e) => sum + e.sets.filter(s => s.isCompleted).length,
        0
      )

      const completedLog: CompletedWorkoutLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        sessionId: prev.sessionId,
        dayIndex: targetDayIndex,
        dayTitle: prev.dayTitle,
        dayType: prev.dayType,
        completedAt: new Date().toISOString(),
        durationSeconds: prev.elapsedSeconds,
        totalSetsCompleted: totalSets,
        totalExercises: prev.exercises.length,
        exercisesSummary: prev.exercises.map(e => ({
          name: e.name,
          setsCompleted: e.sets.filter(s => s.isCompleted).length,
          totalSets: e.sets.length
        }))
      }

      // Save to permanent local workout history log
      saveCompletedWorkoutLog(completedLog)

      // Guarantee completion recorded in PlanContext
      dispatch({
        type: 'MARK_DAY_COMPLETE',
        payload: {
          date: new Date().toISOString().split('T')[0],
          dayIndex: targetDayIndex
        }
      })

      clearActiveSession()
      setIsCompletedModalOpen(true)
      return { ...prev, status: 'completed' }
    })
  }, [dispatch, targetDayIndex])

  // Exercise Navigation
  const handleNextExercise = useCallback(() => {
    if (session.currentExerciseIndex < totalExercises - 1) {
      setSession(prev => ({
        ...prev,
        currentExerciseIndex: prev.currentExerciseIndex + 1,
        restTimer: { ...prev.restTimer, isActive: false }
      }))
    } else {
      handleCompleteWorkout()
    }
  }, [session.currentExerciseIndex, totalExercises, handleCompleteWorkout])

  const handlePrevExercise = useCallback(() => {
    if (session.currentExerciseIndex > 0) {
      setSession(prev => ({
        ...prev,
        currentExerciseIndex: prev.currentExerciseIndex - 1,
        restTimer: { ...prev.restTimer, isActive: false }
      }))
    }
  }, [session.currentExerciseIndex])

  // Substitution Handler
  const handleSelectAlternative = (alt: ExerciseAlternative) => {
    const updatedExercises = [...session.exercises]
    const ex = { ...updatedExercises[session.currentExerciseIndex] }

    ex.name = alt.name
    ex.focus = alt.focus
    ex.equipment = alt.equipment
    ex.formCue = alt.formCue
    ex.isSubstituted = true
    ex.substitutionReason = alt.reason

    updatedExercises[session.currentExerciseIndex] = ex
    setSession(prev => ({ ...prev, exercises: updatedExercises }))
    setIsSubModalOpen(false)
    toast({ title: 'Exercise Substituted', description: `Swapped to ${alt.name}.` })
  }

  const handleSaveAndExit = () => {
    saveActiveSession(session)
    setIsExitDialogOpen(false)
    toast({ title: 'Workout Saved', description: 'Your active session is preserved.' })
    navigate('/weekly-plan')
  }

  const handleDiscardAndExit = () => {
    clearActiveSession()
    setIsExitDialogOpen(false)
    toast({ title: 'Session Discarded', description: 'Workout session cleared.' })
    navigate('/weekly-plan')
  }

  // Accessible Keyboard Shortcuts for Gym Companion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys if focused inside input / textarea or modal is open
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return
      }
      if (isSubModalOpen || isExitDialogOpen || isCompletedModalOpen || isDrawerOpen) {
        return
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        // Toggle the first pending set on current exercise
        const currentSets = session.exercises[session.currentExerciseIndex]?.sets || []
        const pendingSet = currentSets.find(s => !s.isCompleted)
        if (pendingSet) {
          handleToggleSetComplete(pendingSet.setIndex)
        } else if (currentSets.length > 0) {
          handleToggleSetComplete(currentSets[currentSets.length - 1].setIndex)
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        if (session.restTimer.isActive) {
          handleSkipTimer()
        } else {
          const restSecs = currentExercise?.restSeconds || 60
          setSession(prev => ({
            ...prev,
            restTimer: {
              isActive: true,
              targetEndTime: Date.now() + restSecs * 1000,
              durationSeconds: restSecs,
              isPaused: false,
              remainingSeconds: restSecs
            }
          }))
        }
      } else if (e.key === 'ArrowRight') {
        handleNextExercise()
      } else if (e.key === 'ArrowLeft') {
        handlePrevExercise()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isSubModalOpen,
    isExitDialogOpen,
    isCompletedModalOpen,
    isDrawerOpen,
    session.exercises,
    session.currentExerciseIndex,
    session.restTimer.isActive,
    currentExercise?.restSeconds,
    handleToggleSetComplete,
    handleNextExercise,
    handlePrevExercise
  ])

  // Formatting helpers
  const minsElapsed = Math.floor(session.elapsedSeconds / 60)
  const secsElapsed = session.elapsedSeconds % 60
  const formattedElapsed = `${minsElapsed.toString().padStart(2, '0')}:${secsElapsed.toString().padStart(2, '0')}`

  return (
    <div className="min-h-screen bg-bodymap-dark text-primary-text flex flex-col justify-between pb-12">
      {/* Top Session Status Bar */}
      <header className="sticky top-0 z-40 bg-bodymap-dark/95 backdrop-blur-md border-b border-gray-800 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <button
          onClick={() => setIsExitDialogOpen(true)}
          className="inline-flex items-center text-xs font-semibold text-secondary-text hover:text-bright-coral transition-colors py-1.5 px-2.5 rounded-lg border border-gray-800 bg-card-dark"
          aria-label="Pause or exit workout"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Exit
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-neon-green animate-ping" />
            <span className="text-xs font-poppins font-bold uppercase tracking-wider text-neon-green">
              Gym Mode
            </span>
          </div>
          <h1 className="text-sm font-poppins font-semibold text-primary-text truncate max-w-[200px] sm:max-w-md">
            {session.dayTitle}
          </h1>
        </div>

        {/* Audio, Vibration, Stopwatch & Routine Drawer */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Sound Chime Toggle */}
          <button
            onClick={() => setSession(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
            className={`p-1.5 rounded-lg border transition-colors ${
              session.soundEnabled
                ? 'bg-card-dark border-gray-800 text-neon-green hover:bg-gray-800'
                : 'bg-card-dark border-gray-800 text-gray-500 hover:text-secondary-text'
            }`}
            title={session.soundEnabled ? 'Timer Chime Enabled' : 'Timer Chime Muted'}
            aria-label={session.soundEnabled ? 'Mute timer chime' : 'Enable timer chime'}
          >
            {session.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Haptic Vibration Toggle */}
          <button
            onClick={() => setSession(prev => ({ ...prev, vibrateEnabled: !prev.vibrateEnabled }))}
            className={`p-1.5 rounded-lg border transition-colors ${
              session.vibrateEnabled
                ? 'bg-card-dark border-gray-800 text-neon-green hover:bg-gray-800'
                : 'bg-card-dark border-gray-800 text-gray-500 hover:text-secondary-text'
            }`}
            title={session.vibrateEnabled ? 'Haptic Vibration Enabled' : 'Haptic Vibration Off'}
            aria-label={session.vibrateEnabled ? 'Disable haptic vibration' : 'Enable haptic vibration'}
          >
            {session.vibrateEnabled ? <Vibrate className="w-4 h-4" /> : <VibrateOff className="w-4 h-4" />}
          </button>

          {/* Stopwatch */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-card-dark border border-gray-800 rounded-lg text-xs font-poppins font-semibold text-electric-purple">
            <Clock className="w-3.5 h-3.5 text-electric-purple" />
            <span className="tabular-nums">{formattedElapsed}</span>
          </div>

          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="p-1.5 bg-card-dark border border-gray-800 rounded-lg text-secondary-text hover:text-neon-green transition-colors"
            aria-label="Toggle workout overview"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="w-full bg-gray-900 h-1.5" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="bg-neon-green h-full transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Active Workout View */}
      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 pt-6 pb-24 flex-1 flex flex-col justify-between">
        {/* Conflicting Session Warning Banner */}
        {conflictingSession && (
          <div className="mb-6 p-4 bg-bright-coral/10 border border-bright-coral/40 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-bright-coral shrink-0" />
              <div>
                <span className="font-poppins font-bold text-primary-text">
                  In-Progress Session Detected:
                </span>{' '}
                <span className="text-secondary-text">
                  You have an unfinished workout for <strong>{conflictingSession.dayTitle}</strong>.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => navigate(`/gym-mode/${conflictingSession.dayIndex}`)}
                size="sm"
                className="btn-coral text-xs py-1 px-3"
              >
                Switch to {conflictingSession.dayTitle}
              </Button>
              <Button
                onClick={() => setConflictingSession(null)}
                variant="ghost"
                size="sm"
                className="text-xs text-gray-400 hover:text-primary-text"
              >
                Ignore
              </Button>
            </div>
          </div>
        )}

        {/* Exercise Header Card */}
        <section className="card-dark relative overflow-hidden mb-6 border-l-4 border-l-neon-green">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-poppins font-bold px-2 py-0.5 rounded bg-neon-green/20 text-neon-green border border-neon-green/30">
                  Exercise {session.currentExerciseIndex + 1} of {totalExercises}
                </span>
                <span className="text-xs text-secondary-text">
                  {currentExercise?.equipment}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-poppins font-bold text-primary-text">
                {currentExercise?.name}
              </h2>
              <p className="text-xs sm:text-sm text-secondary-text mt-1">
                Target Focus: <strong className="text-electric-purple font-semibold">{currentExercise?.focus}</strong>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] text-secondary-text">
                  ⏱️ Recommended Rest: <strong className="text-neon-green font-semibold">{recommendedRest.recommendedRestSeconds}s</strong> ({recommendedRest.rangeLabel})
                </span>
                <button
                  onClick={() => handleSetRestDuration(recommendedRest.recommendedRestSeconds)}
                  className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-[10px] font-mono text-neon-green border border-gray-700 transition-colors"
                  title="Set rest timer to recommended duration"
                >
                  Sync Timer
                </button>
              </div>

              {/* Barbell Plates Loading Helper */}
              {plateCalculation.hasValidConfiguration && targetWorkingWeight && targetWorkingWeight >= 20 && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-300 bg-bodymap-dark/80 px-2.5 py-1 rounded-lg border border-gray-800 w-fit">
                  <span className="text-neon-green font-semibold">🏋️ Plates:</span>
                  <span className="font-mono">{plateCalculation.summaryLabel}</span>
                </div>
              )}

              {/* Previous Session Set-by-Set Performance */}
              {previousSetPerformance && previousSetPerformance.hasPreviousSession && (
                <div className="mt-1.5 text-[11px] text-secondary-text">
                  <span className="text-gray-400">📊 {previousSetPerformance.formattedSummary}</span>
                </div>
              )}
            </div>

            <Button
              onClick={() => setIsSubModalOpen(true)}
              variant="outline"
              size="sm"
              className="border-gray-700 bg-bodymap-dark text-xs text-secondary-text hover:text-neon-green hover:border-neon-green shrink-0 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Swap
            </Button>
          </div>

          {/* Form Cue Callout */}
          {currentExercise?.formCue && (
            <div className="mt-4 p-3 bg-bodymap-dark/90 rounded-lg border border-gray-800 text-xs text-secondary-text leading-relaxed">
              <strong className="text-neon-green font-semibold mr-1.5">Coach Cue:</strong>
              {currentExercise.formCue}
            </div>
          )}

          {/* Previous Session Reference Ghost Badge */}
          {previousPerformance && (
            <div className="mt-3 p-3 bg-electric-purple/10 rounded-lg border border-electric-purple/30 text-xs flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-electric-purple block">
                  Historical Fact
                </span>
                <span className="text-primary-text font-medium">
                  {previousPerformance.factualSummary}
                </span>
              </div>
              {previousPerformance.lastWeightKg && (
                <button
                  onClick={handleMatchPreviousWeight}
                  className="px-2.5 py-1 rounded bg-electric-purple/20 hover:bg-electric-purple/30 text-electric-purple text-xs font-semibold shrink-0 transition-colors border border-electric-purple/40"
                  title="Copy previous weight to all sets"
                >
                  Match Previous Weight
                </button>
              )}
            </div>
          )}

          {/* Personal Cue / Athlete Form Note */}
          <div className="mt-3 p-3 bg-bodymap-dark/80 rounded-lg border border-gray-800 text-xs">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-bright-coral">
                Personal Cue
              </span>
              {!isEditingNote && (
                <button
                  onClick={handleStartEditNote}
                  className="text-[11px] text-gray-400 hover:text-bright-coral font-medium transition-colors"
                >
                  {currentExerciseNote ? 'Edit Cue' : '+ Add Private Note'}
                </button>
              )}
            </div>

            {isEditingNote ? (
              <div className="space-y-2 mt-2">
                <input
                  type="text"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="e.g. Bench pin hole 4, feet slightly wider..."
                  className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-xs text-primary-text focus:outline-none focus:border-bright-coral"
                  maxLength={500}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  {currentExerciseNote && (
                    <button
                      onClick={handleDeleteNote}
                      className="px-2 py-1 rounded text-red-400 hover:bg-red-950/40 text-[11px] font-medium mr-auto"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => setIsEditingNote(false)}
                    className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-secondary-text text-[11px] font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNote}
                    className="px-2.5 py-1 rounded bg-bright-coral hover:bg-bright-coral/90 text-bodymap-dark font-bold text-[11px]"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-secondary-text text-xs italic">
                {currentExerciseNote || 'No private notes saved for this movement yet.'}
              </p>
            )}
          </div>

          {/* Progressive Warm-up Set Protocol */}
          {warmupProtocol.hasProtocol && (
            <div className="mt-3 pt-3 border-t border-gray-800 text-xs">
              <button
                onClick={() => setShowWarmupLadder(!showWarmupLadder)}
                className="w-full flex items-center justify-between text-[11px] font-poppins font-semibold text-gray-400 hover:text-primary-text transition-colors py-1"
              >
                <span className="flex items-center gap-1.5 text-neon-green">
                  <Flame className="w-3.5 h-3.5" />
                  Warm-up Preparation Protocol (~{warmupProtocol.workingWeightKg} kg target)
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                  {showWarmupLadder ? 'Hide Pyramid ▲' : 'Show 4-Step Pyramid ▼'}
                </span>
              </button>

              {showWarmupLadder && (
                <div className="mt-2 p-2.5 bg-bodymap-dark/90 rounded-lg border border-gray-800 space-y-2">
                  <p className="text-[10px] text-gray-400 italic">
                    Preparation sets are for neuromuscular warmup and do not count toward your working volume.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {warmupProtocol.sets.map((wSet) => (
                      <div key={wSet.setNumber} className="p-2 rounded bg-black/40 border border-gray-800/80 text-center">
                        <span className="text-[10px] text-gray-400 block font-mono">Set {wSet.setNumber} &bull; {wSet.repsLabel}</span>
                        <span className="text-xs font-poppins font-bold text-neon-green block mt-0.5">{wSet.calculatedWeightKg} kg</span>
                        <span className="text-[9px] text-gray-500 block truncate mt-0.5">{wSet.percentageLabel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Big Touch-Friendly Set Logger */}
        <section className="space-y-3.5 mb-8">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-poppins font-bold uppercase tracking-wider text-secondary-text">
                Workout Sets ({currentExercise?.sets.length || 3})
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleAddSet}
                  className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-neon-green text-[11px] font-semibold flex items-center gap-1 transition-colors border border-gray-700"
                  aria-label="Add extra set to exercise"
                  title="Add Set"
                >
                  <Plus className="w-3 h-3" /> Add Set
                </button>
                {currentExercise && currentExercise.sets.length > 1 && (
                  <button
                    onClick={handleRemoveSet}
                    className="p-1 rounded bg-gray-800 hover:bg-bright-coral/20 text-gray-400 hover:text-bright-coral text-[11px] transition-colors border border-gray-700"
                    aria-label="Remove last set"
                    title="Remove last set"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            <span className="text-xs text-secondary-text">
              Target: <strong className="text-primary-text">{currentExercise?.targetReps}</strong>
            </span>
          </div>

          {currentExercise?.sets.map((set) => (
            <div
              key={set.setIndex}
              className={`p-4 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                set.isCompleted
                  ? 'bg-neon-green/10 border-neon-green/50 text-primary-text'
                  : 'bg-card-dark border-gray-800'
              }`}
            >
              {/* Set Label */}
              <div className="flex items-center gap-3 shrink-0">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center font-poppins font-bold text-xs ${
                  set.isCompleted ? 'bg-neon-green text-bodymap-dark' : 'bg-gray-800 text-secondary-text'
                }`}>
                  {set.setIndex}
                </span>
                <span className="font-poppins font-semibold text-sm">
                  SET {set.setIndex}
                </span>
                {set.weightKg && currentExercisePr && set.weightKg > currentExercisePr.value && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-bright-coral/20 text-bright-coral border border-bright-coral/40 text-[10px] font-poppins font-bold animate-pulse">
                    🎯 PR Attempt (+{(set.weightKg - currentExercisePr.value).toFixed(1)} kg)
                  </span>
                )}
              </div>

              {/* Reps Stepper */}
              <div className="flex items-center gap-1.5 bg-bodymap-dark p-1 rounded-lg border border-gray-800">
                <button
                  onClick={() => handleUpdateSetReps(set.setIndex, -1)}
                  className="w-7 h-7 rounded bg-gray-800 text-secondary-text hover:text-primary-text flex items-center justify-center active:scale-95"
                  aria-label={`Decrease reps for set ${set.setIndex}`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center font-poppins font-bold text-sm tabular-nums">
                  {set.completedReps}
                </span>
                <button
                  onClick={() => handleUpdateSetReps(set.setIndex, 1)}
                  className="w-7 h-7 rounded bg-gray-800 text-secondary-text hover:text-primary-text flex items-center justify-center active:scale-95"
                  aria-label={`Increase reps for set ${set.setIndex}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-gray-500 uppercase px-1">reps</span>
              </div>

              {/* Weight Input & Steppers */}
              <div className="hidden sm:flex items-center gap-1 bg-bodymap-dark px-1.5 py-1 rounded-lg border border-gray-800">
                <button
                  onClick={() => handleStepWeight(set.setIndex, -2.5)}
                  className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-gray-400 hover:text-primary-text font-mono hover:bg-gray-700 active:scale-95"
                  title="Decrease 2.5 kg"
                  aria-label={`Decrease weight by 2.5 kg for set ${set.setIndex}`}
                >
                  -2.5
                </button>
                <Input
                  type="number"
                  placeholder="kg"
                  value={set.weightKg !== null ? set.weightKg : ''}
                  onChange={(e) => handleUpdateSetWeight(set.setIndex, e.target.value)}
                  className="bg-transparent border-0 text-xs p-0 text-center text-primary-text focus:ring-0 w-12"
                  aria-label={`Weight in kg for set ${set.setIndex}`}
                />
                <span className="text-[10px] text-gray-500 pr-0.5">kg</span>
                <button
                  onClick={() => handleStepWeight(set.setIndex, 2.5)}
                  className="px-1.5 py-0.5 rounded bg-gray-800 text-[10px] text-neon-green hover:bg-gray-700 font-mono active:scale-95"
                  title="Increase 2.5 kg"
                  aria-label={`Increase weight by 2.5 kg for set ${set.setIndex}`}
                >
                  +2.5
                </button>
              </div>

              {/* Large Checkmark Action Button */}
              <button
                onClick={() => handleToggleSetComplete(set.setIndex)}
                className={`h-12 px-5 rounded-xl font-poppins font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-95 shrink-0 ${
                  set.isCompleted
                    ? 'bg-neon-green text-bodymap-dark shadow-md shadow-neon-green/20'
                    : 'bg-gray-800 text-secondary-text hover:bg-neon-green hover:text-bodymap-dark'
                }`}
                aria-label={set.isCompleted ? `Mark set ${set.setIndex} incomplete` : `Complete set ${set.setIndex}`}
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>{set.isCompleted ? 'DONE' : 'LOG'}</span>
              </button>
            </div>
          ))}

          {/* Keyboard & Companion Shortcuts Tip */}
          <div className="hidden sm:flex items-center justify-center gap-4 text-[11px] text-gray-500 pt-2 font-open-sans">
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-[10px] border border-gray-700">Space</kbd> Log Set</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-[10px] border border-gray-700">R</kbd> Rest Timer</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-[10px] border border-gray-700">← / →</kbd> Switch Exercise</span>
          </div>
        </section>

        {/* Bottom Navigation Buttons (Desktop) */}
        <div className="hidden md:flex items-center justify-between gap-3 pt-4 border-t border-gray-800">
          <Button
            onClick={handlePrevExercise}
            variant="outline"
            disabled={session.currentExerciseIndex === 0}
            className="border-gray-700 bg-card-dark text-secondary-text hover:bg-gray-800 py-3.5 px-4 text-xs font-semibold"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          {session.currentExerciseIndex < totalExercises - 1 ? (
            <Button
              onClick={handleNextExercise}
              className="btn-primary py-3.5 px-6 text-xs sm:text-sm font-bold flex items-center gap-1.5"
            >
              Next Exercise
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleCompleteWorkout}
              className="btn-primary py-3.5 px-6 text-xs sm:text-sm font-bold flex items-center gap-1.5 bg-neon-green"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finish Workout
            </Button>
          )}
        </div>
      </main>

      {/* Mobile Sticky One-Handed Action Bar */}
      <aside aria-label="Quick mobile controls" className="md:hidden fixed bottom-0 left-0 right-0 z-30 p-3 bg-bodymap-dark/95 backdrop-blur-md border-t border-gray-800 flex items-center justify-between gap-2 shadow-2xl">
        <Button
          onClick={handlePrevExercise}
          variant="outline"
          size="sm"
          disabled={session.currentExerciseIndex === 0}
          className="border-gray-800 bg-card-dark text-secondary-text p-2.5 h-11"
          aria-label="Previous Exercise"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {/* Primary Action Button */}
        {(() => {
          const pendingSet = currentExercise?.sets.find(s => !s.isCompleted)
          if (pendingSet) {
            return (
              <Button
                onClick={() => handleToggleSetComplete(pendingSet.setIndex)}
                className="btn-primary flex-1 h-11 text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-neon-green/10"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                Log Set {pendingSet.setIndex} (DONE)
              </Button>
            )
          } else if (session.currentExerciseIndex < totalExercises - 1) {
            return (
              <Button
                onClick={handleNextExercise}
                className="btn-primary flex-1 h-11 text-xs font-bold flex items-center justify-center gap-1.5 bg-electric-purple text-white shadow-lg shadow-electric-purple/10"
              >
                Next Exercise
                <ChevronRight className="w-4 h-4" />
              </Button>
            )
          } else {
            return (
              <Button
                onClick={handleCompleteWorkout}
                className="btn-primary flex-1 h-11 text-xs font-bold flex items-center justify-center gap-1.5 bg-neon-green shadow-lg shadow-neon-green/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                Finish Workout
              </Button>
            )
          }
        })()}

        <Button
          onClick={handleNextExercise}
          variant="outline"
          size="sm"
          disabled={session.currentExerciseIndex >= totalExercises - 1 && currentExercise?.sets.every(s => s.isCompleted)}
          className="border-gray-800 bg-card-dark text-secondary-text p-2.5 h-11"
          aria-label="Next Exercise"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </aside>

      {/* Routine Quick Jump Drawer */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-bodymap-dark/80 backdrop-blur-sm flex justify-end"
          role="dialog"
          aria-label="Workout routine overview"
        >
          <div className="bg-card-dark border-l border-gray-700 w-full max-w-sm h-full p-6 flex flex-col justify-between shadow-2xl animate-slide-left">
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800">
                <h3 className="font-poppins font-bold text-base text-primary-text">
                  Workout Overview
                </h3>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-secondary-text hover:text-primary-text p-1"
                  aria-label="Close drawer"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-2.5 overflow-y-auto max-h-[70vh]">
                {session.exercises.map((ex, idx) => {
                  const isDone = ex.sets.every(s => s.isCompleted)
                  const isCurrent = idx === session.currentExerciseIndex
                  return (
                    <button
                      key={ex.id}
                      onClick={() => {
                        setSession(prev => ({ ...prev, currentExerciseIndex: idx }))
                        setIsDrawerOpen(false)
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between gap-2 ${
                        isCurrent
                          ? 'border-neon-green bg-neon-green/10 text-primary-text'
                          : isDone
                          ? 'border-gray-800 bg-bodymap-dark text-gray-400'
                          : 'border-gray-800 bg-bodymap-dark text-secondary-text hover:border-gray-700'
                      }`}
                    >
                      <div className="truncate">
                        <p className="text-xs font-semibold truncate">{ex.name}</p>
                        <p className="text-[11px] text-gray-400">{ex.sets.length} sets • {ex.focus}</p>
                      </div>
                      {isDone && <CheckCircle2 className="w-4 h-4 text-neon-green shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              onClick={() => setIsDrawerOpen(false)}
              variant="outline"
              className="w-full border-gray-700 text-xs py-2.5 text-secondary-text"
            >
              Resume Active Exercise
            </Button>
          </div>
        </div>
      )}

      {/* Rest Timer Overlay */}
      {session.restTimer.isActive && (
        <RestTimerOverlay
          remainingSeconds={session.restTimer.remainingSeconds}
          totalDuration={session.restTimer.durationSeconds}
          isPaused={session.restTimer.isPaused}
          soundEnabled={session.soundEnabled}
          onTogglePause={handleToggleTimerPause}
          onAddSeconds={handleAddTimerSeconds}
          onSkip={handleSkipTimer}
          onToggleSound={() => setSession(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
        />
      )}

      {/* Exercise Substitution Modal */}
      <ExerciseSubstitutionModal
        currentExerciseName={currentExercise?.name || ''}
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        onSelectAlternative={handleSelectAlternative}
      />

      {/* Exit Confirmation Dialog */}
      <ExitWorkoutDialog
        isOpen={isExitDialogOpen}
        onClose={() => setIsExitDialogOpen(false)}
        onSaveAndExit={handleSaveAndExit}
        onDiscardAndExit={handleDiscardAndExit}
      />

      {/* Workout Completion Modal */}
      {isCompletedModalOpen && (() => {
        const volumeMetrics = calculateSessionVolume(session.exercises)
        const history = loadWorkoutHistory()
        const comparison = compareWorkoutWithPrevious(session.dayIndex, volumeMetrics.totalVolumeKg, history)
        const recoveryAdvice = generateRecoveryAdvice(session.elapsedSeconds, totalSetsCompleted, volumeMetrics)

        return (
          <WorkoutCompletionModal
            dayTitle={session.dayTitle}
            dayType={session.dayType}
            totalElapsedSeconds={session.elapsedSeconds}
            totalExercises={totalExercises}
            totalSetsCompleted={totalSetsCompleted}
            totalVolumeKg={volumeMetrics.totalVolumeKg}
            comparisonSummary={comparison.summaryText}
            recoveryAdvice={recoveryAdvice}
            onViewPlan={() => {
              setIsCompletedModalOpen(false)
              navigate('/weekly-plan')
            }}
            onGoToDashboard={() => {
              setIsCompletedModalOpen(false)
              navigate('/dashboard')
            }}
          />
        )
      })()}
    </div>
  )
}

export default GymModePage
