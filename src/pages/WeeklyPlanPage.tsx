import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Download,
  Edit,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Copy,
  Check,
  FileText,
  Calendar,
  Sparkles,
  ArrowRight,
  Dumbbell,
  Play,
  ShoppingCart,
  Utensils,
  RefreshCw,
  X,
  Flame,
  AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { usePlan } from '@/context/PlanContext'
import { parseAndValidatePlan } from '@/lib/planSchema'
import { scanPlanForAllergens, scanMealTextForAllergens, getActiveAllergenCategories } from '@/lib/allergenGuard'
import { scanPlanForContraindications } from '@/lib/contraindicationGuard'
import { hasSafetySensitiveMedicalIssues } from '@/lib/validation'
import { evaluatePlanProfileBinding } from '@/lib/planBinding'
import { DEFAULT_WEEKLY_PLAN, type DayPlan } from '@/types/plan'
import { loadAndValidateActiveSession } from '@/lib/sessionStorage'
import type { WorkoutSession } from '@/types/workoutSession'
import {
  findMealAlternatives,
  aggregateGroceryList,
  scaleGroceryList,
  filterPantryStaples,
  type FoodAlternative,
  type GroceryCategoryGroup
} from '@/lib/nutritionAlternatives'
import { estimateDailyMacros, type DailyMacroEstimate } from '@/lib/macroEstimator'
import {
  getTodayHydration,
  addHydration,
  resetTodayHydration,
  calculateHydrationTarget
} from '@/lib/hydrationTracker'
import { estimateGroceryPackaging } from '@/lib/groceryCostEstimator'
import { calculateMicronutrientGuide } from '@/lib/micronutrientGuide'
import { forecastEnergyBalancePace } from '@/lib/energyBalanceForecaster'
import { calculateHydrationClimateAdjustment } from '@/lib/hydrationClimateAdjustment'
import { validateScheduleConsistency } from '@/lib/scheduleConsistencyValidator'

const WeeklyPlanPage: React.FC = () => {
  const { state, dispatch } = usePlan()
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null)

  useEffect(() => {
    const saved = loadAndValidateActiveSession(state.planId, state.formData.medicalIssues)
    if (saved && saved.status === 'in-progress') {
      setActiveSession(saved)
    } else {
      setActiveSession(null)
    }
  }, [state.planId, state.formData.medicalIssues])

  const [expandedDay, setExpandedDay] = useState<number | null>(0)
  const [showRawMarkdown, setShowRawMarkdown] = useState(false)
  const [copied, setCopied] = useState(false)

  // Nutrition & Grocery Modal States
  const [isGroceryModalOpen, setIsGroceryModalOpen] = useState(false)
  const [servingMultiplier, setServingMultiplier] = useState<number>(1)
  const [hidePantryStaples, setHidePantryStaples] = useState<boolean>(false)
  const [selectedMealForSwap, setSelectedMealForSwap] = useState<{ title: string; text: string } | null>(null)
  const [checkedGroceryItems, setCheckedGroceryItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('bodymap_grocery_checked')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const toggleDay = (index: number) => {
    setExpandedDay(expandedDay === index ? null : index)
  }

  const isDayCompleted = (dayIndex: number) => {
    return state.completedDays.some(d => d.dayIndex === dayIndex)
  }

  const toggleDayComplete = (dayIndex: number) => {
    dispatch({
      type: 'TOGGLE_DAY_COMPLETE',
      payload: {
        date: new Date().toISOString().split('T')[0],
        dayIndex
      }
    })
    toast({
      title: isDayCompleted(dayIndex) ? 'Day unmarked' : 'Day completed! 🎉',
      description: isDayCompleted(dayIndex) ? 'Progress updated' : 'Great job staying consistent!'
    })
  }

  const handleCopy = () => {
    const textToCopy = state.generatedPlan || JSON.stringify(DEFAULT_WEEKLY_PLAN, null, 2)
    navigator.clipboard.writeText(textToCopy)
    setCopied(true)
    toast({ title: 'Copied!', description: 'Plan copied to clipboard.' })
    setTimeout(() => setCopied(false), 2000)
  }

  const [hydrationLogged, setHydrationLogged] = useState<number>(() => getTodayHydration())
  const hydrationTarget = useMemo(() => calculateHydrationTarget(state.formData.weight), [state.formData.weight])

  const handleAddHydration = (amountMl: number) => {
    const updated = addHydration(amountMl)
    setHydrationLogged(updated)
  }

  const handleResetHydration = () => {
    resetTodayHydration()
    setHydrationLogged(0)
  }

  const completedCount = state.completedDays.length
  const progressPercent = Math.min(100, Math.round((completedCount / 7) * 100))

  const parsedAiPlan = state.generatedPlan ? parseAndValidatePlan(state.generatedPlan, false) : null
  const displayDays: DayPlan[] = (parsedAiPlan?.success && parsedAiPlan.data && parsedAiPlan.data.days.length > 0)
    ? parsedAiPlan.data.days.map((d, i) => ({
        day: d.title || `Day ${d.dayNumber || i + 1}`,
        type: d.isRestDay ? 'Active Recovery & Mobility' : `${state.formData.mainGoal || 'Custom Strength & Conditioning'}`,
        duration: state.formData.timePerDay ? `${state.formData.timePerDay} mins` : '45 mins',
        focus: d.isRestDay ? ['Recovery', 'Mobility'] : (state.formData.bodyFocus.length > 0 ? state.formData.bodyFocus : ['Full Body']),
        isRest: d.isRestDay,
        workout: {
          warmup: d.workout?.warmup ? [d.workout.warmup] : ['5-minute dynamic mobility warm-up'],
          main: d.workout?.exercises && d.workout.exercises.length > 0
            ? d.workout.exercises.map(e => `${e.name}${e.sets ? `: ${e.sets} sets` : ''}${e.reps ? ` x ${e.reps} reps` : ''}${e.rest ? ` (${e.rest} rest)` : ''}`)
            : [d.rawContent],
          cooldown: d.workout?.cooldown ? [d.workout.cooldown] : ['5-minute static cooldown stretching']
        },
        meals: {
          breakfast: d.nutrition?.breakfast || 'High-protein breakfast',
          lunch: d.nutrition?.lunch || 'Nutrient-dense lunch',
          dinner: d.nutrition?.dinner || 'Clean recovery dinner',
          snacks: d.nutrition?.snacks ? [d.nutrition.snacks] : ['Healthy post-workout snack']
        },
        totalCalories: d.nutrition?.estimatedCalories ? parseInt(d.nutrition.estimatedCalories, 10) || 1800 : 1800
      }))
    : DEFAULT_WEEKLY_PLAN

  // Extract all meal strings across 7 days for the grocery aggregator
  const allMealTexts = useMemo(() => {
    const texts: string[] = []
    for (const d of displayDays) {
      if (d.meals.breakfast) texts.push(d.meals.breakfast)
      if (d.meals.lunch) texts.push(d.meals.lunch)
      if (d.meals.dinner) texts.push(d.meals.dinner)
      if (d.meals.snacks) texts.push(...d.meals.snacks)
    }
    return texts
  }, [displayDays])

  const groceryCategories: GroceryCategoryGroup[] = useMemo(() => {
    return aggregateGroceryList(allMealTexts)
  }, [allMealTexts])

  const displayGroceryCategories: GroceryCategoryGroup[] = useMemo(() => {
    const scaled = scaleGroceryList(groceryCategories, servingMultiplier)
    return filterPantryStaples(scaled, hidePantryStaples)
  }, [groceryCategories, servingMultiplier, hidePantryStaples])

  const handleToggleGroceryItem = (itemId: string) => {
    const updated = {
      ...checkedGroceryItems,
      [itemId]: !checkedGroceryItems[itemId]
    }
    setCheckedGroceryItems(updated)
    try {
      localStorage.setItem('bodymap_grocery_checked', JSON.stringify(updated))
    } catch {
      // Ignore storage error
    }
  }

  const handleCopyGroceryList = () => {
    let output = `🛒 BODYMAP 7-DAY GROCERY CHECKLIST (${servingMultiplier}x Servings${hidePantryStaples ? ' • Pantry Excluded' : ''})\n`
    output += `Generated for: ${state.formData.mainGoal || 'Fitness'} Plan\n\n`
    for (const group of displayGroceryCategories) {
      output += `[ ${group.category.toUpperCase()} ]\n`
      for (const item of group.items) {
        const isChecked = checkedGroceryItems[item.id] ? '[x]' : '[ ]'
        output += `${isChecked} ${item.name}\n`
      }
      output += '\n'
    }
    navigator.clipboard.writeText(output)
    toast({ title: 'Grocery List Copied! 📋', description: `Categorized ${servingMultiplier}x grocery checklist copied to clipboard.` })
  }

  const mealAlternatives: FoodAlternative[] = useMemo(() => {
    if (!selectedMealForSwap) return []
    return findMealAlternatives(
      selectedMealForSwap.text,
      state.formData.dietaryPreference || 'all',
      state.formData.allergies || ''
    )
  }, [selectedMealForSwap, state.formData.dietaryPreference, state.formData.allergies])

  const dailyMacros: DailyMacroEstimate = useMemo(() => {
    return estimateDailyMacros(state.formData.weight, state.formData.mainGoal)
  }, [state.formData.weight, state.formData.mainGoal])

  const micronutrientGuide = useMemo(() => {
    return calculateMicronutrientGuide(dailyMacros.totalKcal)
  }, [dailyMacros.totalKcal])

  const energyForecast = useMemo(() => {
    const weightNum = parseFloat(state.formData.weight) || 70
    // Standard baseline maintenance estimate ~32 kcal/kg
    const estimatedMaintenance = Math.round(weightNum * 32)
    return forecastEnergyBalancePace(dailyMacros.totalKcal, estimatedMaintenance)
  }, [dailyMacros.totalKcal, state.formData.weight])

  const hydrationClimate = useMemo(() => {
    return calculateHydrationClimateAdjustment(hydrationTarget, 'warm')
  }, [hydrationTarget])

  const allergenScanResult = useMemo(() => {
    if (!state.formData.allergies || !state.formData.allergies.trim()) return { hasViolation: false, violations: [] }
    if (state.generatedPlan) {
      return scanPlanForAllergens(state.generatedPlan, state.formData.allergies)
    }
    const activeCats = getActiveAllergenCategories(state.formData.allergies)
    if (activeCats.length === 0) return { hasViolation: false, violations: [] }
    for (const text of allMealTexts) {
      const scan = scanMealTextForAllergens(text, activeCats)
      if (scan.hasViolation) {
        return { hasViolation: true, violations: scan.violations }
      }
    }
    return { hasViolation: false, violations: [] }
  }, [state.generatedPlan, state.formData.allergies, allMealTexts])

  const hasMedicalIssues = useMemo(() => {
    return hasSafetySensitiveMedicalIssues(state.formData.medicalIssues)
  }, [state.formData.medicalIssues])

  const bindingEval = useMemo(() => {
    return evaluatePlanProfileBinding(state.formData, state.boundProfile)
  }, [state.formData, state.boundProfile])

  const contraindicationScanResult = useMemo(() => {
    return scanPlanForContraindications(state.generatedPlan, state.formData.medicalIssues)
  }, [state.generatedPlan, state.formData.medicalIssues])

  const isWorkoutLocked = bindingEval.isSafetyMismatched || contraindicationScanResult.hasViolation

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-bodymap-dark text-primary-text">
      <div className="max-w-6xl mx-auto">

        {contraindicationScanResult.hasViolation && (
          <div className="mb-8 p-4 sm:p-6 bg-bright-coral/10 border-2 border-bright-coral/50 rounded-xl flex items-start gap-4 shadow-lg shadow-bright-coral/10 animate-fade-in">
            <AlertCircle className="w-8 h-8 text-bright-coral shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-poppins font-semibold text-bright-coral text-base sm:text-lg">
                Workout Safety Lockout — Contraindicated Movement Detected
              </h2>
              <p className="text-secondary-text font-open-sans text-xs sm:text-sm mt-1">
                This plan contains exercises that conflict with your declared medical conditions ({Array.from(new Set(contraindicationScanResult.violations.map(v => v.conditionLabel))).join(', ')}). Workouts are locked to prevent injury. Please regenerate your plan to receive safe alternatives.
              </p>
              <div className="mt-2 space-y-1">
                {contraindicationScanResult.violations.slice(0, 3).map((v, i) => (
                  <div key={i} className="text-xs text-bright-coral font-medium">
                    &bull; Day {v.dayNumber || '?'}: <strong>{v.matchedExercise}</strong> ({v.conditionLabel})
                  </div>
                ))}
              </div>
            </div>
            <Link to="/edit-plan" className="btn-primary whitespace-nowrap text-xs sm:text-sm py-2 px-4 self-center sm:self-auto shrink-0">
              Regenerate Plan
            </Link>
          </div>
        )}

        {bindingEval.isSafetyMismatched && (
          <div className="mb-8 p-4 sm:p-6 bg-bright-coral/10 border-2 border-bright-coral/50 rounded-xl flex items-start gap-4 shadow-lg shadow-bright-coral/10 animate-fade-in">
            <AlertCircle className="w-8 h-8 text-bright-coral shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-poppins font-semibold text-bright-coral text-base sm:text-lg">
                Workout Safety Lockout — Profile Mismatch
              </h2>
              <p className="text-secondary-text font-open-sans text-xs sm:text-sm mt-1">
                Your medical conditions or allergies have changed since this plan was generated ({bindingEval.mismatchedSafetyFields.join(', ')}). Workouts are locked to prevent injury until you regenerate your plan to match your current profile.
              </p>
            </div>
            <Link to="/edit-plan" className="btn-primary whitespace-nowrap text-xs sm:text-sm py-2 px-4 self-center sm:self-auto shrink-0">
              Regenerate Plan
            </Link>
          </div>
        )}

        {allergenScanResult.hasViolation && (
          <div className="mb-8 p-4 sm:p-6 bg-red-500/10 border-2 border-red-500/40 rounded-xl flex items-start gap-4 shadow-lg shadow-red-500/5">
            <AlertTriangle className="w-8 h-8 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-poppins font-semibold text-red-400 text-base sm:text-lg">
                Allergen Safety Warning
              </h2>
              <p className="text-secondary-text font-open-sans text-xs sm:text-sm mt-1">
                This plan contains ingredients that conflict with your current declared allergy profile ({Array.from(new Set(allergenScanResult.violations.map(v => v.label))).join(', ')}). Please regenerate your plan before preparing any meals.
              </p>
            </div>
            <Link to="/edit-plan" className="btn-secondary whitespace-nowrap text-xs sm:text-sm py-2 px-4 self-center sm:self-auto shrink-0 border-red-500/40 text-red-400 hover:bg-red-500/20">
              Update Profile
            </Link>
          </div>
        )}

        {hasMedicalIssues && (
          <div className="mb-8 p-4 sm:p-6 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl flex items-start gap-4 shadow-lg shadow-amber-500/5">
            <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-poppins font-semibold text-amber-400 text-base sm:text-lg">
                Medical &amp; Injury Safety Advisory
              </h2>
              <p className="text-secondary-text font-open-sans text-xs sm:text-sm mt-1">
                Your profile notes pre-existing conditions or physical limitations ({state.formData.medicalIssues}). This plan was generated by AI and is not medical advice. Always obtain physician clearance before starting, and immediately discontinue any exercise that causes pain, dizziness, or discomfort.
              </p>
            </div>
            <Link to="/edit-plan" className="btn-secondary whitespace-nowrap text-xs sm:text-sm py-2 px-4 self-center sm:self-auto shrink-0 border-amber-500/40 text-amber-400 hover:bg-amber-500/20">
              Update Profile
            </Link>
          </div>
        )}

        {!state.isGenerated && (
          <div className="mb-8 p-4 sm:p-6 bg-electric-purple/10 border border-electric-purple/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <Sparkles className="w-8 h-8 text-electric-purple flex-shrink-0 hidden sm:block" />
              <div>
                <h2 className="font-poppins font-semibold text-primary-text text-base sm:text-lg">
                  Viewing Sample 7-Day Plan
                </h2>
                <p className="text-secondary-text font-open-sans text-xs sm:text-sm">
                  Complete the questionnaire to generate a plan custom tailored to your biomechanics, equipment, and diet.
                </p>
              </div>
            </div>
            <Link to="/create-plan" className="btn-primary whitespace-nowrap text-sm py-2 px-4 flex-shrink-0">
              Create My AI Plan
              <ArrowRight className="w-4 h-4 ml-1.5 inline" />
            </Link>
          </div>
        )}

        {activeSession && !isWorkoutLocked && (
          <div className="mb-6 p-4 sm:p-5 bg-neon-green/10 border-2 border-neon-green/40 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-neon-green/5">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-neon-green animate-ping shrink-0" />
              <div>
                <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-neon-green">
                  Active Workout Session in Progress
                </span>
                <h3 className="font-poppins font-bold text-primary-text text-sm sm:text-base">
                  {activeSession.dayTitle} • {activeSession.dayType}
                </h3>
              </div>
            </div>
            <Link
              to={`/gym-mode/${activeSession.dayIndex}`}
              className="btn-primary whitespace-nowrap text-xs sm:text-sm py-2 px-5 flex-shrink-0 flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Resume Workout
            </Link>
          </div>
        )}

        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text mb-3">
            Your 7-Day Fitness &amp; Diet Plan
          </h1>
          <p className="text-base sm:text-lg text-secondary-text font-open-sans max-w-2xl mx-auto">
            {state.isGenerated
              ? `Personalized for your ${state.formData.mainGoal || 'fitness'} goal • ${state.formData.timePerDay || '30'} mins/day`
              : 'Interactive schedule with exercise sets, reps, and precise nutrition targets'}
          </p>
        </div>

        <div className="card-dark mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-neon-green" />
              <span className="font-poppins font-semibold text-primary-text text-sm sm:text-base">
                Weekly Completion: {completedCount} of 7 Days Done
              </span>
            </div>
            <span className="text-neon-green font-bold text-sm font-poppins">{progressPercent}% Completed</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-neon-green h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Schedule Recovery Assistant */}
          {completedCount > 0 && completedCount < 7 && (() => {
            const nextIdx = displayDays.findIndex((_, idx) => !isDayCompleted(idx))
            if (nextIdx === -1) return null
            const nextDay = displayDays[nextIdx]
            return (
              <div className="mt-3.5 pt-3.5 border-t border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-electric-purple block">
                    Schedule Assistant
                  </span>
                  <span className="text-secondary-text">
                    Next recommended session: <strong className="text-primary-text">{nextDay.day} &bull; {nextDay.title}</strong>
                  </span>
                </div>
                {isWorkoutLocked ? (
                  <span className="px-3 py-1.5 rounded-lg bg-bright-coral/10 text-bright-coral text-xs font-semibold border border-bright-coral/30 shrink-0">
                    Locked
                  </span>
                ) : (
                  <Link
                    to={`/gym-mode/${nextIdx}`}
                    className="px-3 py-1.5 rounded-lg bg-electric-purple/20 hover:bg-electric-purple/30 text-electric-purple text-xs font-semibold flex items-center gap-1.5 transition-colors border border-electric-purple/30 shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Resume Day {nextIdx + 1}
                  </Link>
                )}
              </div>
            )
          })()}

          {/* Daily Macro Target Breakdown */}
          {dailyMacros.hasData && (
            <div className="mt-3.5 pt-3.5 border-t border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-neon-green" />
                <span className="font-poppins font-semibold text-primary-text">
                  Daily Macro Target: ~{dailyMacros.totalKcal} kcal
                </span>
                <span className="text-[10px] text-gray-500 hidden sm:inline">
                  (Estimated from goal &amp; weight)
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="px-2 py-0.5 rounded bg-electric-purple/20 text-electric-purple border border-electric-purple/30 font-semibold">
                  P: {dailyMacros.proteinGrams}g
                </span>
                <span className="px-2 py-0.5 rounded bg-bright-coral/20 text-bright-coral border border-bright-coral/30 font-semibold">
                  C: {dailyMacros.carbGrams}g
                </span>
                <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-semibold">
                  F: {dailyMacros.fatGrams}g
                </span>
                {micronutrientGuide.hasCalculation && (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                    Fiber: ~{micronutrientGuide.estimatedFiberGrams}g
                  </span>
                )}
                {energyForecast.hasForecast && (
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold">
                    {energyForecast.formattedPaceLabel}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Daily Hydration Tracking Widget */}
          <div className="mt-3.5 pt-3.5 border-t border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neon-green font-bold">💧</span>
              <span className="font-poppins font-semibold text-primary-text">
                Hydration: {hydrationLogged.toLocaleString()} ml {hydrationTarget ? `/ ~${hydrationTarget.toLocaleString()} ml` : ''}
              </span>
              {hydrationClimate.climateAdjustmentMl > 0 && (
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-mono font-semibold hidden md:inline">
                  +{hydrationClimate.climateAdjustmentMl}ml ({hydrationClimate.climate})
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <button
                onClick={() => handleAddHydration(250)}
                className="px-2.5 py-1 rounded bg-bodymap-dark hover:bg-gray-800 text-neon-green border border-gray-700 font-semibold transition-colors"
                title="Add 250ml water"
              >
                +250ml
              </button>
              <button
                onClick={() => handleAddHydration(500)}
                className="px-2.5 py-1 rounded bg-bodymap-dark hover:bg-gray-800 text-neon-green border border-gray-700 font-semibold transition-colors"
                title="Add 500ml water"
              >
                +500ml
              </button>
              {hydrationLogged > 0 && (
                <button
                  onClick={handleResetHydration}
                  className="px-2 py-1 rounded text-gray-400 hover:text-red-400 text-[10px] font-sans transition-colors"
                  title="Reset today's hydration"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-10">
          <Button
            onClick={() => setIsGroceryModalOpen(true)}
            className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            7-Day Grocery List
          </Button>
          <Link to="/download-plan" className="btn-coral text-sm py-2.5 px-5 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export &amp; Backups
          </Link>
          <Link to="/edit-plan" className="btn-secondary text-sm py-2.5 px-5 flex items-center gap-2 border border-gray-700 bg-card-dark text-secondary-text hover:text-primary-text">
            <Edit className="w-4 h-4" />
            Adjust Plan
          </Link>
          <Button
            onClick={handleCopy}
            variant="outline"
            className="border-gray-700 text-secondary-text hover:bg-gray-800 hover:text-primary-text text-sm py-2.5 px-4"
          >
            {copied ? <Check className="w-4 h-4 mr-2 text-neon-green" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy Plan'}
          </Button>
          {state.generatedPlan && (
            <Button
              onClick={() => setShowRawMarkdown(!showRawMarkdown)}
              variant="outline"
              className="border-gray-700 text-secondary-text hover:bg-gray-800 hover:text-primary-text text-sm py-2.5 px-4"
            >
              <FileText className="w-4 h-4 mr-2" />
              {showRawMarkdown ? 'Structured View' : 'Raw AI Output'}
            </Button>
          )}
        </div>

        {showRawMarkdown && state.generatedPlan ? (
          <div className="card-dark mb-8">
            <h2 className="text-lg font-poppins font-semibold text-neon-green mb-4">Gemini AI Output</h2>
            <pre className="text-secondary-text font-mono text-xs sm:text-sm whitespace-pre-wrap overflow-x-auto leading-relaxed bg-bodymap-dark p-4 rounded-lg border border-gray-800">
              {state.generatedPlan}
            </pre>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 7-Day Schedule Consistency & Recovery Balance Strip */}
            {(() => {
              const consistency = validateScheduleConsistency(displayDays)
              return (
                <div className="p-3 bg-bodymap-dark/80 rounded-xl border border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs font-open-sans">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-neon-green" />
                    <span className="font-semibold text-gray-300">Schedule Split:</span>
                    <span className="text-secondary-text">{consistency.summaryLabel}</span>
                  </div>
                  {consistency.issues.length > 0 && (
                    <div className="flex items-center gap-1.5 text-bright-coral font-medium text-[11px]">
                      <span>⚠️ {consistency.issues[0].description}</span>
                    </div>
                  )}
                </div>
              )
            })()}

            {displayDays.map((day, index) => {
              const completed = isDayCompleted(index)
              const isExpanded = expandedDay === index

              return (
                <div
                  key={day.day}
                  className={`card-dark transition-all duration-300 border ${
                    completed
                      ? 'border-neon-green/30 bg-neon-green/5'
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <button
                      onClick={() => toggleDay(index)}
                      className="flex items-center space-x-4 flex-grow text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-green rounded-lg"
                      aria-expanded={isExpanded}
                      aria-controls={`day-content-${index}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-poppins font-bold text-sm flex-shrink-0 ${
                        completed ? 'bg-neon-green text-bodymap-dark' : 'bg-gray-800 text-primary-text'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-poppins font-semibold text-primary-text">
                            {day.day}
                          </h2>
                          {day.isRest && (
                            <span className="text-[10px] font-poppins font-bold px-2 py-0.5 rounded bg-electric-purple/20 text-electric-purple border border-electric-purple/30">
                              Recovery
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-secondary-text font-open-sans">
                          {day.type} &bull; {day.duration}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                      {!day.isRest && (
                        isWorkoutLocked ? (
                          <span
                            className="px-3 py-1.5 rounded-lg bg-bright-coral/10 border border-bright-coral/30 text-bright-coral text-xs font-semibold"
                            title={bindingEval.isSafetyMismatched ? "Workouts locked due to health profile changes" : "Workouts locked due to contraindicated exercises"}
                          >
                            Locked
                          </span>
                        ) : (
                          <Link
                            to={`/gym-mode/${index}`}
                            className="btn-primary text-xs py-2 px-3.5 inline-flex items-center gap-1.5 shadow-sm shadow-neon-green/20"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Gym Mode
                          </Link>
                        )
                      )}

                      <button
                        onClick={() => toggleDayComplete(index)}
                        className={`p-2 rounded-lg border transition-colors ${
                          completed
                            ? 'bg-neon-green/20 border-neon-green text-neon-green'
                            : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-primary-text'
                        }`}
                        title={completed ? 'Mark incomplete' : 'Mark complete'}
                        aria-label={completed ? `Mark Day ${index + 1} incomplete` : `Mark Day ${index + 1} complete`}
                      >
                        {completed ? (
                          <CheckCircle2 className="w-5 h-5 text-neon-green" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <button
                        onClick={() => toggleDay(index)}
                        className="p-2 text-gray-400 hover:text-primary-text rounded-lg hover:bg-gray-800"
                        aria-label={isExpanded ? `Collapse Day ${index + 1}` : `Expand Day ${index + 1}`}
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div id={`day-content-${index}`} className="mt-6 pt-6 border-t border-gray-800">
                      <div className="grid lg:grid-cols-2 gap-8">
                        <div>
                          <h3 className="text-base sm:text-lg font-poppins font-semibold text-primary-text mb-4 flex items-center gap-2">
                            <Dumbbell className="w-4 h-4 text-neon-green" />
                            {day.isRest ? 'Recovery & Mobility Activities' : 'Workout Routine'}
                          </h3>

                          {!day.isRest && day.workout.warmup.length > 0 && (
                            <div className="mb-4">
                              <h4 className="text-neon-green font-semibold text-sm mb-2">Warm-up (5 mins)</h4>
                              <ul className="space-y-1.5 text-xs sm:text-sm text-secondary-text">
                                {day.workout.warmup.map((exercise) => (
                                  <li key={exercise} className="flex items-start">
                                    <span className="text-neon-green mr-2">•</span>
                                    {exercise}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div className="mb-4">
                            <h4 className="text-electric-purple font-semibold text-sm mb-2">
                              {day.isRest ? 'Recommended Activities' : 'Main Circuit'}
                            </h4>
                            <ul className="space-y-1.5 text-xs sm:text-sm text-secondary-text">
                              {day.workout.main.map((exercise) => (
                                <li key={exercise} className="flex items-start">
                                  <span className="text-electric-purple mr-2">•</span>
                                  {exercise}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {!day.isRest && day.workout.cooldown.length > 0 && (
                            <div>
                              <h4 className="text-bright-coral font-semibold text-sm mb-2">Cool-down &amp; Stretch</h4>
                              <ul className="space-y-1.5 text-xs sm:text-sm text-secondary-text">
                                {day.workout.cooldown.map((exercise) => (
                                  <li key={exercise} className="flex items-start">
                                    <span className="text-bright-coral mr-2">•</span>
                                    {exercise}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base sm:text-lg font-poppins font-semibold text-primary-text flex items-center gap-2">
                              <Utensils className="w-4 h-4 text-bright-coral" /> Daily Nutrition Plan
                            </h3>
                            <span className="text-xs text-secondary-text font-mono">
                              ~{day.totalCalories} kcal target
                            </span>
                          </div>

                          <div className="space-y-3">
                            <div className="p-3 bg-bodymap-dark rounded-lg border border-gray-800">
                              <div className="flex justify-between items-center mb-1">
                                <h4 className="text-neon-green font-semibold text-sm">Breakfast</h4>
                                <button
                                  onClick={() => setSelectedMealForSwap({ title: 'Breakfast', text: day.meals.breakfast })}
                                  className="text-[11px] font-semibold text-secondary-text hover:text-neon-green flex items-center gap-1 transition-colors"
                                  title="Find protein alternatives"
                                >
                                  <RefreshCw className="w-3 h-3" /> Swap Protein
                                </button>
                              </div>
                              <p className="text-secondary-text text-xs sm:text-sm leading-relaxed">{day.meals.breakfast}</p>
                            </div>

                            <div className="p-3 bg-bodymap-dark rounded-lg border border-gray-800">
                              <div className="flex justify-between items-center mb-1">
                                <h4 className="text-electric-purple font-semibold text-sm">Lunch</h4>
                                <button
                                  onClick={() => setSelectedMealForSwap({ title: 'Lunch', text: day.meals.lunch })}
                                  className="text-[11px] font-semibold text-secondary-text hover:text-electric-purple flex items-center gap-1 transition-colors"
                                  title="Find protein alternatives"
                                >
                                  <RefreshCw className="w-3 h-3" /> Swap Protein
                                </button>
                              </div>
                              <p className="text-secondary-text text-xs sm:text-sm leading-relaxed">{day.meals.lunch}</p>
                            </div>

                            <div className="p-3 bg-bodymap-dark rounded-lg border border-gray-800">
                              <div className="flex justify-between items-center mb-1">
                                <h4 className="text-bright-coral font-semibold text-sm">Dinner</h4>
                                <button
                                  onClick={() => setSelectedMealForSwap({ title: 'Dinner', text: day.meals.dinner })}
                                  className="text-[11px] font-semibold text-secondary-text hover:text-bright-coral flex items-center gap-1 transition-colors"
                                  title="Find protein alternatives"
                                >
                                  <RefreshCw className="w-3 h-3" /> Swap Protein
                                </button>
                              </div>
                              <p className="text-secondary-text text-xs sm:text-sm leading-relaxed">{day.meals.dinner}</p>
                            </div>

                            <div className="p-3 bg-bodymap-dark rounded-lg border border-gray-800">
                              <h4 className="text-gray-400 font-semibold text-sm mb-1.5">Snacks</h4>
                              <ul className="text-secondary-text text-xs sm:text-sm space-y-1">
                                {day.meals.snacks.map((snack) => (
                                  <li key={snack} className="flex items-start">
                                    <span className="text-gray-500 mr-2">•</span>
                                    {snack}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>

      {/* 7-Day Grocery List Modal Dialog */}
      {isGroceryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card-dark max-w-2xl w-full p-6 space-y-6 border border-gray-700 max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neon-green/20 flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-neon-green" />
                  </div>
                  <div>
                    <h3 className="text-lg font-poppins font-bold text-primary-text">
                      7-Day Grocery Shopping List
                    </h3>
                    <p className="text-xs text-secondary-text">
                      Aggregated items across your 7-day meal schedule
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsGroceryModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-primary-text rounded-lg hover:bg-gray-800"
                  aria-label="Close grocery list"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Serving Scaler & Pantry Filter Selector Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 py-2.5 px-3 bg-bodymap-dark rounded-lg border border-gray-800 mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-secondary-text">Servings:</span>
                  <div className="flex items-center bg-card-dark p-0.5 rounded-lg border border-gray-700 text-xs">
                    {[1, 2, 3, 4].map((mult) => (
                      <button
                        key={mult}
                        onClick={() => setServingMultiplier(mult)}
                        className={`px-2.5 py-1 rounded font-semibold transition-colors ${
                          servingMultiplier === mult
                            ? 'bg-neon-green text-bodymap-dark font-bold'
                            : 'text-gray-400 hover:text-primary-text'
                        }`}
                      >
                        {mult}x
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-secondary-text hover:text-primary-text">
                  <input
                    type="checkbox"
                    checked={hidePantryStaples}
                    onChange={(e) => setHidePantryStaples(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-700 text-neon-green focus:ring-neon-green bg-gray-900"
                  />
                  <span>Hide In-Pantry Staples</span>
                </label>
              </div>

              {/* Categorized Grocery Checklist */}
              <div className="overflow-y-auto max-h-[50vh] pr-2 mt-3 space-y-5">
                {displayGroceryCategories.map((group) => (
                  <div key={group.category} className="space-y-2">
                    <h4 className="text-xs font-poppins font-bold uppercase tracking-wider text-neon-green flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-neon-green" />
                      {group.category} ({group.items.length})
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {group.items.map((item) => {
                        const isChecked = Boolean(checkedGroceryItems[item.id])
                        const pkg = estimateGroceryPackaging(item.name, item.quantity || 100, item.unit || 'g')
                        return (
                          <label
                            key={item.id}
                            className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                              isChecked
                                ? 'bg-neon-green/10 border-neon-green/30 text-gray-400 line-through'
                                : 'bg-bodymap-dark border-gray-800 text-primary-text hover:border-gray-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleGroceryItem(item.id)}
                              className="w-4 h-4 rounded border-gray-700 text-neon-green focus:ring-neon-green bg-gray-900 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-medium truncate block">{item.name}</span>
                              {pkg.hasPackageEstimate && !isChecked && (
                                <span className="text-[10px] text-electric-purple font-mono block mt-0.5">
                                  📦 {pkg.displayLabel}
                                </span>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-gray-800">
              <button
                onClick={() => {
                  setCheckedGroceryItems({})
                  try { localStorage.removeItem('bodymap_grocery_checked') } catch { /* Ignore */ }
                  toast({ title: 'Checklist Reset', description: 'All grocery checkmarks have been cleared.' })
                }}
                className="text-xs text-gray-400 hover:text-bright-coral underline"
              >
                Clear all checkboxes
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  onClick={handleCopyGroceryList}
                  size="sm"
                  className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 w-full sm:w-auto"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Categorized Checklist
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Meal Protein Alternatives Modal */}
      {selectedMealForSwap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card-dark max-w-lg w-full p-6 space-y-4 border border-gray-700">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div>
                <h3 className="text-lg font-poppins font-bold text-primary-text flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-neon-green" />
                  {selectedMealForSwap.title} Protein Alternatives
                </h3>
                <p className="text-xs text-secondary-text truncate max-w-sm mt-0.5">
                  Current: {selectedMealForSwap.text}
                </p>
              </div>
              <button
                onClick={() => setSelectedMealForSwap(null)}
                className="p-1 text-gray-400 hover:text-primary-text rounded"
                aria-label="Close protein alternatives"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {mealAlternatives.map((alt) => (
                <div key={alt.id} className="p-3.5 bg-bodymap-dark rounded-xl border border-gray-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-poppins font-bold text-sm text-primary-text">
                      {alt.name}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-neon-green/20 text-neon-green">
                      ~{alt.approxProteinGrams}g protein
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-secondary-text font-open-sans">
                    <span>Portion: <strong>{alt.portion}</strong></span>
                    <span>&bull;</span>
                    <span>Energy: <strong>~{alt.approxCalories} kcal</strong></span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed italic">
                    {alt.notes}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setSelectedMealForSwap(null)}
                size="sm"
                className="btn-primary text-xs px-4"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default WeeklyPlanPage
