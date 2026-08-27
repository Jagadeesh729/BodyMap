import React from 'react'
import { CheckCircle2, Trophy, Clock, Dumbbell, ArrowRight, Award, Flame, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WorkoutCompletionModalProps {
  dayTitle: string
  dayType: string
  totalElapsedSeconds: number
  totalExercises: number
  totalSetsCompleted: number
  totalVolumeKg?: number
  comparisonSummary?: string
  recoveryAdvice?: string
  onViewPlan: () => void
  onGoToDashboard: () => void
}

export const WorkoutCompletionModal: React.FC<WorkoutCompletionModalProps> = ({
  dayTitle,
  dayType,
  totalElapsedSeconds,
  totalExercises,
  totalSetsCompleted,
  totalVolumeKg,
  comparisonSummary,
  recoveryAdvice,
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
      <div className="bg-card-dark border border-gray-700 rounded-2xl max-w-lg w-full p-6 sm:p-8 text-center shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Celebration Trophy Badge */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto border-2 border-neon-green/40">
          <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-neon-green" aria-hidden="true" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-poppins font-semibold text-neon-green uppercase tracking-wider mb-1.5">
            <CheckCircle2 className="w-4 h-4" /> Workout Protocol Completed
          </div>
          <h2 className="text-xl sm:text-2xl font-poppins font-bold text-primary-text">
            {dayTitle} Finished!
          </h2>
          <p className="text-xs sm:text-sm text-secondary-text font-open-sans mt-0.5">
            {dayType}
          </p>
        </div>

        {/* Workout Performance Metric Cards */}
        <div className={`grid gap-2.5 text-left ${totalVolumeKg && totalVolumeKg > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
          <div className="bg-bodymap-dark/80 p-3 rounded-xl border border-gray-800">
            <div className="flex items-center gap-1 text-secondary-text text-[10px] mb-0.5">
              <Clock className="w-3 h-3 text-electric-purple" /> Duration
            </div>
            <p className="text-base sm:text-lg font-poppins font-bold text-primary-text">{mins} <span className="text-[11px] font-normal text-secondary-text">min</span></p>
          </div>

          <div className="bg-bodymap-dark/80 p-3 rounded-xl border border-gray-800">
            <div className="flex items-center gap-1 text-secondary-text text-[10px] mb-0.5">
              <Dumbbell className="w-3 h-3 text-neon-green" /> Exercises
            </div>
            <p className="text-base sm:text-lg font-poppins font-bold text-primary-text">{totalExercises}</p>
          </div>

          <div className="bg-bodymap-dark/80 p-3 rounded-xl border border-gray-800">
            <div className="flex items-center gap-1 text-secondary-text text-[10px] mb-0.5">
              <Award className="w-3 h-3 text-bright-coral" /> Sets
            </div>
            <p className="text-base sm:text-lg font-poppins font-bold text-primary-text">{totalSetsCompleted}</p>
          </div>

          {totalVolumeKg !== undefined && totalVolumeKg > 0 && (
            <div className="bg-bodymap-dark/80 p-3 rounded-xl border border-gray-800">
              <div className="flex items-center gap-1 text-secondary-text text-[10px] mb-0.5">
                <Flame className="w-3 h-3 text-neon-green" /> Volume
              </div>
              <p className="text-base sm:text-lg font-poppins font-bold text-neon-green">{totalVolumeKg} <span className="text-[11px] font-normal text-secondary-text">kg</span></p>
            </div>
          )}
        </div>

        {/* Smart Coach Debrief Breakdown */}
        {(comparisonSummary || recoveryAdvice) && (
          <div className="p-4 bg-bodymap-dark/90 rounded-xl border border-gray-800 text-left space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-electric-purple font-poppins font-bold text-[11px] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Smart Coach Debrief
            </div>
            {comparisonSummary && (
              <p className="text-primary-text font-medium">{comparisonSummary}</p>
            )}
            {recoveryAdvice && (
              <p className="text-secondary-text leading-relaxed">{recoveryAdvice}</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={onViewPlan}
            variant="outline"
            className="border-gray-700 bg-card-dark text-secondary-text hover:bg-gray-800 flex-1 py-2.5 text-xs sm:text-sm"
          >
            View Weekly Plan
          </Button>

          <Button
            onClick={onGoToDashboard}
            className="btn-primary flex-1 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
