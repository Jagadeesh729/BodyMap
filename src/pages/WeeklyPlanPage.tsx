import { useState } from 'react'
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
  Dumbbell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { usePlan } from '@/context/PlanContext'
import { parseAndValidatePlan } from '@/lib/planSchema'


interface DayPlan {
  day: string
  type: string
  duration: string
  focus: string[]
  isRest: boolean
  workout: {
    warmup: string[]
    main: string[]
    cooldown: string[]
  }
  meals: {
    breakfast: string
    lunch: string
    dinner: string
    snacks: string[]
  }
  totalCalories: number
}

const DEFAULT_WEEKLY_PLAN: DayPlan[] = [
  {
    day: 'Day 1 - Monday',
    type: 'Upper Body Strength',
    duration: '45 mins',
    focus: ['Chest', 'Arms', 'Shoulders'],
    isRest: false,
    workout: {
      warmup: ['Arm circles (30s)', 'Jumping jacks (1 min)', 'Shoulder rolls (30s)'],
      main: [
        'Push-ups: 3 sets x 12 reps',
        'Dumbbell chest press: 3 sets x 10 reps',
        'Overhead shoulder press: 3 sets x 10 reps',
        'Bicep curls: 3 sets x 12 reps',
        'Tricep dips: 3 sets x 12 reps'
      ],
      cooldown: ['Chest opener stretch (1 min)', 'Arm across chest stretch (1 min)', 'Childs pose (1 min)']
    },
    meals: {
      breakfast: 'Oatmeal with fresh berries, chia seeds & protein powder (350 cal)',
      lunch: 'Grilled chicken breast with mixed greens, quinoa & olive oil (450 cal)',
      dinner: 'Baked salmon with roasted asparagus & sweet potato (500 cal)',
      snacks: ['Greek yogurt with honey (150 cal)', 'Apple with almond butter (150 cal)']
    },
    totalCalories: 1600
  },
  {
    day: 'Day 2 - Tuesday',
    type: 'Lower Body Focus',
    duration: '45 mins',
    focus: ['Legs', 'Glutes', 'Calves'],
    isRest: false,
    workout: {
      warmup: ['High knees (1 min)', 'Leg swings (1 min)', 'Bodyweight squats (15 reps)'],
      main: [
        'Goblet squats: 4 sets x 12 reps',
        'Walking lunges: 3 sets x 10 reps per leg',
        'Glute bridges: 3 sets x 15 reps',
        'Calf raises: 4 sets x 20 reps',
        'Wall sit: 3 sets x 45 seconds'
      ],
      cooldown: ['Hamstring stretch (1 min)', 'Quad stretch (1 min)', 'Pigeon pose (1 min)']
    },
    meals: {
      breakfast: 'Scrambled eggs (3) with whole wheat toast & spinach (380 cal)',
      lunch: 'Turkey wrap with avocado, lettuce & tomato (420 cal)',
      dinner: 'Lean beef stir-fry with broccoli & brown rice (480 cal)',
      snacks: ['Mixed handful of almonds & walnuts (180 cal)', 'Protein shake (140 cal)']
    },
    totalCalories: 1600
  },
  {
    day: 'Day 3 - Wednesday',
    type: 'Active Recovery',
    duration: '30 mins',
    focus: ['Mobility', 'Flexibility'],
    isRest: true,
    workout: {
      warmup: ['Gentle neck & shoulder rolls (2 mins)'],
      main: [
        'Light walking or cycling (20 mins)',
        'Full body yoga flow (10 mins)',
        'Foam rolling major muscle groups'
      ],
      cooldown: ['Deep diaphragmatic breathing (3 mins)']
    },
    meals: {
      breakfast: 'Berry smoothie bowl with granola & flaxseed (320 cal)',
      lunch: 'Mediterranean chickpea salad with feta & cucumber (400 cal)',
      dinner: 'Grilled white fish with roasted zucchini & quinoa (430 cal)',
      snacks: ['Cottage cheese with pineapple (150 cal)', 'Green tea with lemon']
    },
    totalCalories: 1300
  },
  {
    day: 'Day 4 - Thursday',
    type: 'Core & High-Intensity Cardio',
    duration: '40 mins',
    focus: ['Abs', 'Cardio', 'Endurance'],
    isRest: false,
    workout: {
      warmup: ['Jump rope simulation (2 mins)', 'Torso twists (1 min)', 'Cat-cow stretch (1 min)'],
      main: [
        'Plank hold: 3 sets x 60 seconds',
        'Bicycle crunches: 3 sets x 20 reps',
        'Mountain climbers: 4 sets x 30 seconds',
        'Russian twists: 3 sets x 20 reps',
        'Burpees: 3 sets x 10 reps'
      ],
      cooldown: ['Cobra stretch (1 min)', 'Seated forward fold (1 min)', 'Spinal twist (1 min)']
    },
    meals: {
      breakfast: 'Protein pancakes with blueberries & maple drizzle (390 cal)',
      lunch: 'Tuna salad bowl with avocado, greens & olive oil (430 cal)',
      dinner: 'Grilled chicken breast with roasted Brussels sprouts & rice (470 cal)',
      snacks: ['Carrot sticks with hummus (140 cal)', 'Dark chocolate square (70 cal)']
    },
    totalCalories: 1500
  },
  {
    day: 'Day 5 - Friday',
    type: 'Full Body Strength Circuit',
    duration: '50 mins',
    focus: ['Full Body', 'Compound Lifts'],
    isRest: false,
    workout: {
      warmup: ['Jumping jacks (2 mins)', 'Arm & leg swings (2 mins)', 'Inchworms (5 reps)'],
      main: [
        'Dumbbell thrusters: 3 sets x 10 reps',
        'Push-up to renegade row: 3 sets x 8 reps per side',
        'Romanian deadlifts: 3 sets x 12 reps',
        'Dumbbell lunges: 3 sets x 10 per leg',
        'Plank jacks: 3 sets x 20 reps'
      ],
      cooldown: ['Full body stretching routine (5 mins)']
    },
    meals: {
      breakfast: 'Avocado toast on sourdough with 2 poached eggs (420 cal)',
      lunch: 'Quinoa power bowl with tofu or chicken, edamame & tahini (460 cal)',
      dinner: 'Turkey meatballs with zucchini noodles & marinara (440 cal)',
      snacks: ['Protein bar (200 cal)', 'Fresh orange (80 cal)']
    },
    totalCalories: 1600
  },
  {
    day: 'Day 6 - Saturday',
    type: 'Active Recovery & Mobility',
    duration: '30 mins',
    focus: ['Recovery', 'Joint Health'],
    isRest: true,
    workout: {
      warmup: ['Gentle cat-cow stretches (2 mins)'],
      main: [
        'Outdoor hike or brisk neighborhood walk (30 mins)',
        'Targeted hip mobility exercises',
        'Deep hamstring and shoulder stretches'
      ],
      cooldown: ['Mindful meditation & relaxation (5 mins)']
    },
    meals: {
      breakfast: 'Greek yogurt parfait with mixed berries & chia seeds (340 cal)',
      lunch: 'Hearty vegetable lentil soup with whole grain roll (410 cal)',
      dinner: 'Baked cod with sweet potato wedges & green beans (430 cal)',
      snacks: ['Trail mix (160 cal)', 'Herbal peppermint tea']
    },
    totalCalories: 1340
  },
  {
    day: 'Day 7 - Sunday',
    type: 'Complete Rest & Nutrition Prep',
    duration: 'Rest',
    focus: ['Mental Recovery', 'Meal Prep'],
    isRest: true,
    workout: {
      warmup: [],
      main: [
        'Complete physical rest',
        'Hydration focus (3+ liters of water)',
        'Weekly meal prep and goal setting for next week'
      ],
      cooldown: []
    },
    meals: {
      breakfast: 'Weekend scramble: eggs, mushrooms, spinach & feta (420 cal)',
      lunch: 'Grilled chicken caesar wrap with side salad (460 cal)',
      dinner: 'Comfort bowl: grilled chicken with mashed sweet potato (440 cal)',
      snacks: ['Fresh seasonal fruit bowl (150 cal)']
    },
    totalCalories: 1470
  }
]

const WeeklyPlanPage = () => {
  const { state, dispatch } = usePlan()
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
