import React from 'react'
import { CheckCircle2, Trophy, Clock, Dumbbell, ArrowRight, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WorkoutCompletionModalProps {
  dayTitle: string
  dayType: string
  totalElapsedSeconds: number
  totalExercises: number
  totalSetsCompleted: number
  onViewPlan: () => void
  onGoToDashboard: () => void
}

export const WorkoutCompletionModal: React.FC<WorkoutCompletionModalProps> = ({
  dayTitle,
  dayType,
  totalElapsedSeconds,
  totalExercises,
  totalSetsCompleted,
  onViewPlan,
  onGoToDashboard
}) => {
  const mins = Math.max(1, Math.round(totalElapsedSeconds / 60))

  return (
    <div
      className="fixed inset-0 z-50 bg-bodymap-dark/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in"
      role="dialog"
      aria-label="Workout completed summary"
      aria-modal="true"
    >
      <div className="bg-card-dark border border-gray-700 rounded-2xl max-w-lg w-full p-6 sm:p-8 text-center shadow-2xl space-y-6">
        {/* Celebration Trophy Badge */}
        <div className="w-20 h-20 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto border-2 border-neon-green/40">
          <Trophy className="w-10 h-10 text-neon-green" aria-hidden="true" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-poppins font-semibold text-neon-green uppercase tracking-wider mb-2">
            <CheckCircle2 className="w-4 h-4" /> Workout Protocol Completed
          </div>
          <h2 className="text-2xl sm:text-3xl font-poppins font-bold text-primary-text">
            {dayTitle} Finished!
          </h2>
          <p className="text-xs sm:text-sm text-secondary-text font-open-sans mt-1">
            {dayType}
          </p>
        </div>

        {/* Workout Performance Metric Cards */}
        <div className="grid grid-cols-3 gap-3 text-left">
          <div className="bg-bodymap-dark/80 p-3.5 rounded-xl border border-gray-800">
            <div className="flex items-center gap-1.5 text-secondary-text text-[11px] mb-1">
              <Clock className="w-3.5 h-3.5 text-electric-purple" /> Duration
            </div>
            <p className="text-lg sm:text-xl font-poppins font-bold text-primary-text">{mins} <span className="text-xs font-normal text-secondary-text">min</span></p>
          </div>

          <div className="bg-bodymap-dark/80 p-3.5 rounded-xl border border-gray-800">
            <div className="flex items-center gap-1.5 text-secondary-text text-[11px] mb-1">
              <Dumbbell className="w-3.5 h-3.5 text-neon-green" /> Exercises
            </div>
            <p className="text-lg sm:text-xl font-poppins font-bold text-primary-text">{totalExercises}</p>
          </div>

          <div className="bg-bodymap-dark/80 p-3.5 rounded-xl border border-gray-800">
            <div className="flex items-center gap-1.5 text-secondary-text text-[11px] mb-1">
              <Award className="w-3.5 h-3.5 text-bright-coral" /> Sets
            </div>
            <p className="text-lg sm:text-xl font-poppins font-bold text-primary-text">{totalSetsCompleted}</p>
          </div>
        </div>

        {/* Motivational Coaching Feedback */}
        <div className="p-4 bg-bodymap-dark/60 rounded-xl border border-gray-800 text-xs text-secondary-text italic font-open-sans">
          "Consistency is the catalyst that transforms physical effort into lifelong athletic performance."
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={onViewPlan}
            variant="outline"
            className="border-gray-700 bg-card-dark text-secondary-text hover:bg-gray-800 flex-1 py-3 text-sm"
          >
            View Weekly Plan
          </Button>

          <Button
            onClick={onGoToDashboard}
            className="btn-primary flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
