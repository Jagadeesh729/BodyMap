import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  Calendar,
  Download,
  Edit,
  User,
  Plus,
  Dumbbell,
  Sparkles,
  ArrowRight,
  Flame,
  CheckCircle2,
  Clock,
  Award
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { usePlan } from '@/context/PlanContext'
import { loadWorkoutHistory } from '@/lib/sessionStorage'
import type { CompletedWorkoutLog } from '@/types/workoutSession'
import { calculateWorkoutStreak } from '@/lib/streakCalculation'

interface Measurement {
  part: string
  current: number
  change: number
}

const DEFAULT_MEASUREMENTS: Measurement[] = [
  { part: 'Chest', current: 98, change: -2 },
  { part: 'Waist', current: 85, change: -4 },
  { part: 'Arms', current: 33, change: +1.5 },
  { part: 'Thighs', current: 58, change: -2 },
]

const DashboardPage = () => {
  const { state, dispatch } = usePlan()
  const { formData, isGenerated, completedDays, weightLog } = state

  const [newWeight, setNewWeight] = useState('')
  const [userName, setUserName] = useState(() => localStorage.getItem('bodymap_user_name') || 'Athlete')
  const [isEditingName, setIsEditingName] = useState(false)
  const [measurements] = useState<Measurement[]>(DEFAULT_MEASUREMENTS)
  const [workoutHistory, setWorkoutHistory] = useState<CompletedWorkoutLog[]>([])

  useEffect(() => {
    setWorkoutHistory(loadWorkoutHistory())
  }, [])

  const initialWeightNum = Number(formData.weight) || 72
  const targetWeightNum = formData.mainGoal === 'slim'
    ? Math.max(45, Math.round(initialWeightNum * 0.92))
    : formData.mainGoal === 'bulk'
    ? Math.round(initialWeightNum * 1.08)
    : initialWeightNum

  // Built dynamic chart data from chronologically sorted weightLog if present, else standard progression
  const sortedWeightLog = [...weightLog].sort((a, b) => {
    const timeA = Date.parse(a.date)
    const timeB = Date.parse(b.date)
    if (!isNaN(timeA) && !isNaN(timeB)) {
      return timeA - timeB
    }
    return 0
  })

  const chartData = sortedWeightLog.length > 0
    ? sortedWeightLog.map((entry, _idx) => ({ week: entry.date || `Entry ${_idx + 1}`, weight: entry.weight }))
    : [
        { week: 'Start', weight: initialWeightNum },
        { week: 'Wk 1', weight: Number((initialWeightNum - 0.4).toFixed(1)) },
        { week: 'Wk 2', weight: Number((initialWeightNum - 0.9).toFixed(1)) },
        { week: 'Wk 3', weight: Number((initialWeightNum - 1.3).toFixed(1)) },
        { week: 'Current', weight: Number((initialWeightNum - 1.8).toFixed(1)) },
      ]

  const currentWeightNum = chartData[chartData.length - 1].weight
  const weightChange = Number((currentWeightNum - initialWeightNum).toFixed(1))
  const completedWorkoutsCount = Math.max(completedDays.length, workoutHistory.length)
  const currentStreak = calculateWorkoutStreak(workoutHistory, completedDays)

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
    toast({ title: 'Weight Logged!', description: `Recorded ${val} kg for ${todayStr}.` })
  }

  const handleSaveName = () => {
    setIsEditingName(false)
    localStorage.setItem('bodymap_user_name', userName)
    toast({ title: 'Profile Updated', description: `Display name updated to ${userName}.` })
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Not generated banner */}
        {!isGenerated && (
          <div className="mb-8 p-4 sm:p-6 bg-neon-green/10 border border-neon-green/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-neon-green flex-shrink-0" />
              <div>
                <h2 className="font-poppins font-semibold text-primary-text text-base">
                  Unlock Personalized Fitness Tracking
                </h2>
                <p className="text-secondary-text text-xs sm:text-sm">
                  Complete the questionnaire to sync your target goals, calories, and personalized workout streak.
                </p>
              </div>
            </div>
            <Link to="/create-plan" className="btn-primary text-xs sm:text-sm py-2 px-4 whitespace-nowrap">
              Generate AI Plan
              <ArrowRight className="w-4 h-4 ml-1.5 inline" />
            </Link>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-3">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="input-dark max-w-[200px]"
                    placeholder="Your Name"
                    autoFocus
                  />
                  <Button onClick={handleSaveName} size="sm" className="btn-primary py-1 px-3 text-xs">
                    Save
                  </Button>
                </div>
              ) : (
                <h1 className="text-3xl sm:text-4xl font-poppins font-bold text-primary-text flex items-center gap-2">
                  Hello, {userName}!
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-xs text-secondary-text hover:text-neon-green underline font-normal ml-2"
                    aria-label="Edit display name"
                  >
                    edit
                  </button>
                </h1>
              )}
            </div>
            <p className="text-base sm:text-lg text-secondary-text font-open-sans mt-1">
              Here is your fitness and body composition progress
            </p>
          </div>

          <Link to="/weekly-plan" className="btn-primary text-sm py-2.5 px-5 self-start sm:self-auto flex items-center gap-2">
            <Dumbbell className="w-4 h-4" />
            Today's Workout
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
          <div className="card-dark text-center">
            <div className="w-12 h-12 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-neon-green" aria-hidden="true" />
            </div>
            <p className="text-2xl sm:text-3xl font-poppins font-bold text-primary-text">
              {completedWorkoutsCount}
            </p>
            <p className="text-xs sm:text-sm text-secondary-text font-open-sans mt-1">Workouts Logged</p>
          </div>

          <div className="card-dark text-center">
            <div className="w-12 h-12 bg-bright-coral/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Flame className="w-6 h-6 text-bright-coral" aria-hidden="true" />
            </div>
            <p className="text-2xl sm:text-3xl font-poppins font-bold text-primary-text">
              {currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}
            </p>
            <p className="text-xs sm:text-sm text-secondary-text font-open-sans mt-1">Active Streak</p>
          </div>

          <div className="card-dark text-center">
            <div className="w-12 h-12 bg-electric-purple/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-6 h-6 text-electric-purple" aria-hidden="true" />
            </div>
            <p className="text-2xl sm:text-3xl font-poppins font-bold text-primary-text">
              {formData.timePerDay ? `${formData.timePerDay}m` : '45m'}
            </p>
            <p className="text-xs sm:text-sm text-secondary-text font-open-sans mt-1">Daily Target</p>
          </div>

          <div className="card-dark text-center">
            <div className="w-12 h-12 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <User className="w-6 h-6 text-neon-green" aria-hidden="true" />
            </div>
            <p className="text-2xl sm:text-3xl font-poppins font-bold text-primary-text">
              {currentWeightNum} kg
            </p>
            <p className="text-xs sm:text-sm text-secondary-text font-open-sans mt-1">Current Weight</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Weight Chart with Logger */}
          <div className="card-dark flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg sm:text-xl font-poppins font-semibold text-primary-text">
                  Weight Progression
                </h2>
                <div className="flex items-center gap-2 text-xs text-secondary-text">
                  <span>Delta: <strong className={weightChange <= 0 ? 'text-neon-green' : 'text-bright-coral'}>{weightChange > 0 ? `+${weightChange}` : weightChange} kg</strong></span>
                  <span>•</span>
                  <span>Target: <strong className="text-neon-green">{targetWeightNum} kg</strong></span>
                </div>
              </div>

              <div className="h-60 sm:h-64 w-full" role="region" aria-label="Weight progress line chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="week" stroke="#9ca3af" fontSize={12} tickLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} />
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

          {/* Body Measurements */}
          <div className="card-dark flex flex-col justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-poppins font-semibold text-primary-text mb-4">
                Body Measurements
              </h2>
              <div className="space-y-3">
                {measurements.map((measurement) => (
                  <div key={measurement.part} className="flex justify-between items-center p-3.5 bg-bodymap-dark rounded-lg border border-gray-800">
                    <span className="text-secondary-text font-open-sans text-sm">{measurement.part}</span>
                    <div className="text-right">
                      <span className="text-primary-text font-semibold text-sm">{measurement.current} cm</span>
                      <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded ${
                        measurement.change > 0 ? 'bg-bright-coral/20 text-bright-coral' : 'bg-neon-green/20 text-neon-green'
                      }`}>
                        {measurement.change > 0 ? '+' : ''}{measurement.change} cm
                      </span>

                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between text-xs text-secondary-text">
              <span>Goal: {formData.mainGoal || 'Full Body Fitness'}</span>
              <Link to="/edit-plan" className="text-electric-purple hover:underline">
                Update Goals &rarr;
              </Link>
            </div>
          </div>
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
                </p>
              </div>
            </div>

            <Link
              to="/weekly-plan"
              className="text-xs font-semibold text-neon-green hover:underline flex items-center gap-1"
            >
              All Days <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {workoutHistory.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workoutHistory.slice(0, 6).map((log) => {
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
                <p className="text-xs text-secondary-text font-open-sans">Download printable PDF or share</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Motivational Card */}
        <div className="mt-12 text-center">
          <div className="card-dark max-w-2xl mx-auto bg-gradient-to-r from-neon-green/10 to-electric-purple/10 border-gray-800">
            <h2 className="text-xs font-poppins font-semibold text-neon-green uppercase tracking-wider mb-2">
              Today's Focus
            </h2>
            <blockquote className="text-secondary-text font-open-sans text-base italic">
              "Your body can stand almost anything. It's your mind you have to convince."
            </blockquote>
          </div>
        </div>

      </div>
    </div>
  )
}

export default DashboardPage
