import { useState, useEffect } from 'react'
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
  Play
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { usePlan } from '@/context/PlanContext'
import { parseAndValidatePlan } from '@/lib/planSchema'
import { DEFAULT_WEEKLY_PLAN, type DayPlan } from '@/types/plan'
import { loadActiveSession } from '@/lib/sessionStorage'
import type { WorkoutSession } from '@/types/workoutSession'

const WeeklyPlanPage = () => {
  const { state, dispatch } = usePlan()
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null)

  useEffect(() => {
    const saved = loadActiveSession()
    if (saved && saved.status === 'in-progress') {
      setActiveSession(saved)
    }
  }, [])
  const [expandedDay, setExpandedDay] = useState<number | null>(0)
  const [showRawMarkdown, setShowRawMarkdown] = useState(false)
  const [copied, setCopied] = useState(false)

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

  return (

    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">

        {!state.isGenerated && (
          <div className="mb-8 p-4 sm:p-6 bg-electric-purple/10 border border-electric-purple/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <Sparkles className="w-8 h-8 text-electric-purple flex-shrink-0 hidden sm:block" />
              <div>
                <h2 className="font-poppins font-semibold text-primary-text text-base sm:text-lg">
                  Viewing Sample 7-Day Plan
                </h2>
                <p className="text-secondary-text font-open-sans text-xs sm:text-sm">
                  Complete the 5-step questionnaire to generate a plan custom tailored to your biomechanics, equipment, and diet.
                </p>
              </div>
            </div>
            <Link to="/create-plan" className="btn-primary whitespace-nowrap text-sm py-2 px-4 flex-shrink-0">
              Create My AI Plan
              <ArrowRight className="w-4 h-4 ml-1.5 inline" />
            </Link>
          </div>
        )}

        {activeSession && (
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
              : 'Interactive schedule with exercise sets, reps, and precise calorie meal targets'}
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
        </div>

        <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-10">
          <Link to="/download-plan" className="btn-primary text-sm py-2.5 px-5">
            <Download className="w-4 h-4 mr-2" aria-hidden="true" />
            Download Options
          </Link>
          <Link to="/edit-plan" className="btn-coral text-sm py-2.5 px-5">
            <Edit className="w-4 h-4 mr-2" aria-hidden="true" />
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
            {displayDays.map((day, index) => {
              const completed = isDayCompleted(index)

              const isExpanded = expandedDay === index

              return (
                <div
                  key={day.day}
                  className={`card-dark transition-all duration-200 ${
                    completed ? 'border-neon-green/40 bg-card-dark/80' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => toggleDay(index)}
                      aria-expanded={isExpanded}
                      aria-controls={`day-content-${index}`}
                      className="flex-1 flex items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-green rounded-lg p-1"
                    >
                      <div className="flex items-center space-x-4">
                        <div
                          className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${
                            day.isRest ? 'bg-bright-coral' : 'bg-neon-green'
                          }`}
                          aria-hidden="true"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg sm:text-xl font-poppins font-semibold text-primary-text">
                              {day.day}
                            </h2>
                            {completed && (
                              <span className="text-xs bg-neon-green/20 text-neon-green font-medium px-2 py-0.5 rounded">
                                Done
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-secondary-text font-open-sans">
                            {day.type} • {day.duration}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {!day.isRest && day.focus.length > 0 && (
                          <div className="hidden sm:flex space-x-2">
                            {day.focus.map((bodyPart) => (
                              <span
                                key={bodyPart}
                                className="px-2.5 py-0.5 bg-electric-purple/20 text-electric-purple rounded-full text-xs font-medium"
                              >
                                {bodyPart}
                              </span>
                            ))}
                          </div>
                        )}

                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-secondary-text" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-secondary-text" aria-hidden="true" />
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {!day.isRest && (
                        <Link
                          to={`/gym-mode/${index}`}
                          className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shrink-0 shadow-sm"
                          aria-label={`Start Gym Mode workout for ${day.day}`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span className="hidden sm:inline">Start</span> Workout
                        </Link>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleDayComplete(index)}
                        aria-label={completed ? `Mark ${day.day} as incomplete` : `Mark ${day.day} as completed`}
                        className="p-2 text-secondary-text hover:text-neon-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-green rounded-full"
                      >
                        {completed ? (
                          <CheckCircle2 className="w-6 h-6 text-neon-green" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div id={`day-content-${index}`} className="mt-6 pt-6 border-t border-gray-800">

                      <div className="grid lg:grid-cols-2 gap-8">
                        <div>
                          <h3 className="text-base sm:text-lg font-poppins font-semibold text-primary-text mb-4 flex items-center gap-2">
                            <Dumbbell className="w-4 h-4 text-neon-green" />
                            {day.isRest ? 'Recovery & Mobility Activities' : 'Workout Details'}
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
                          <h3 className="text-base sm:text-lg font-poppins font-semibold text-primary-text mb-4">
                            Daily Nutrition Plan
                          </h3>

                          <div className="space-y-3">
                            <div className="p-3 bg-bodymap-dark rounded-lg border border-gray-800">
                              <div className="flex justify-between items-center mb-1">
                                <h4 className="text-neon-green font-semibold text-sm">Breakfast</h4>
                              </div>
                              <p className="text-secondary-text text-xs sm:text-sm leading-relaxed">{day.meals.breakfast}</p>
                            </div>

                            <div className="p-3 bg-bodymap-dark rounded-lg border border-gray-800">
                              <div className="flex justify-between items-center mb-1">
                                <h4 className="text-electric-purple font-semibold text-sm">Lunch</h4>
                              </div>
                              <p className="text-secondary-text text-xs sm:text-sm leading-relaxed">{day.meals.lunch}</p>
                            </div>

                            <div className="p-3 bg-bodymap-dark rounded-lg border border-gray-800">
                              <div className="flex justify-between items-center mb-1">
                                <h4 className="text-bright-coral font-semibold text-sm">Dinner</h4>
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

                            <div className="text-center pt-3 border-t border-gray-800 flex justify-between items-center">
                              <span className="text-xs text-secondary-text font-open-sans">Estimated Target:</span>
                              <span className="text-neon-green font-bold font-poppins text-sm">
                                ~{day.totalCalories} kcal
                              </span>
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

        <div className="mt-12 text-center">
          <div className="card-dark max-w-2xl mx-auto bg-gradient-to-r from-neon-green/10 to-electric-purple/10 border-gray-800">
            <h2 className="text-sm font-poppins font-semibold text-neon-green uppercase tracking-wider mb-2">
              Weekly Motivation
            </h2>
            <blockquote className="text-secondary-text font-open-sans text-base sm:text-lg italic">
              "Success is the sum of small efforts repeated day in and day out."
            </blockquote>
          </div>
        </div>

      </div>
    </div>
  )
}

export default WeeklyPlanPage
