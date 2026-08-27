import React, { useState } from 'react'
import { CheckCircle2, Trophy, Clock, Dumbbell, ArrowRight, Award, Flame, Sparkles, Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STANDARD_REFLECTION_TAGS, type EnergyRating, type PerceivedReadiness, type SessionReflection } from '@/lib/sessionReflectionTaxonomy'

interface WorkoutCompletionModalProps {
  dayTitle: string
  dayType: string
  totalElapsedSeconds: number
  totalExercises: number
  totalSetsCompleted: number
  totalVolumeKg?: number
  workloadDensityKgPerMin?: number
  sessionPRs?: string[]
  comparisonSummary?: string
  recoveryAdvice?: string
  recoveryHydrationLabel?: string
  onViewPlan: () => void
  onGoToDashboard: () => void
  onSaveReflection?: (reflection: SessionReflection) => void
}

export const WorkoutCompletionModal: React.FC<WorkoutCompletionModalProps> = ({
  dayTitle,
  dayType,
  totalElapsedSeconds,
  totalExercises,
  totalSetsCompleted,
  totalVolumeKg,
  workloadDensityKgPerMin,
  sessionPRs = [],
  comparisonSummary,
  recoveryAdvice,
  recoveryHydrationLabel,
  onViewPlan,
  onGoToDashboard,
  onSaveReflection
}) => {
  const mins = Math.max(1, Math.round(totalElapsedSeconds / 60))

  const [energyRating, setEnergyRating] = useState<EnergyRating | undefined>(undefined)
  const [readiness, setReadiness] = useState<PerceivedReadiness | undefined>(undefined)
  const [selectedTags, setSelectedTags] = useState<string[]>([])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleFinish = (action: 'plan' | 'dashboard') => {
    if (onSaveReflection && (energyRating || readiness || selectedTags.length > 0)) {
      onSaveReflection({
        energyRating,
        perceivedReadiness: readiness,
        reflectionTags: selectedTags
      })
    }
    if (action === 'plan') onViewPlan()
    else onGoToDashboard()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-bodymap-dark/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in"
      role="dialog"
      aria-label="Workout completed summary"
      aria-modal="true"
    >
      <div className="bg-card-dark border border-gray-700 rounded-2xl max-w-lg w-full p-6 sm:p-8 text-center shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
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
              {workloadDensityKgPerMin !== undefined && workloadDensityKgPerMin > 0 && (
                <span className="text-[10px] text-gray-500 font-mono block mt-0.5">
                  ~{workloadDensityKgPerMin} kg/min
                </span>
              )}
            </div>
          )}
        </div>

        {/* Session PRs Celebration Banner */}
        {sessionPRs.length > 0 && (
          <div className="p-3 bg-neon-green/10 rounded-xl border border-neon-green/30 text-left text-xs">
            <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-neon-green block mb-1">
              🏆 New Personal Records Achieved!
            </span>
            <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
              {sessionPRs.map((pr, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded bg-neon-green/20 text-neon-green border border-neon-green/40 font-semibold">
                  {pr}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Post-Workout Subjective Session Reflection */}
        <div className="p-3.5 bg-bodymap-dark/90 rounded-xl border border-gray-800 text-left space-y-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-bright-coral font-poppins font-bold text-[11px] uppercase tracking-wider">
            <Smile className="w-3.5 h-3.5" /> Subjective Session Reflection
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-medium">Session Energy (1 to 5):</span>
            <div className="flex items-center gap-1.5">
              {([1, 2, 3, 4, 5] as EnergyRating[]).map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setEnergyRating(lvl === energyRating ? undefined : lvl)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all border ${
                    energyRating === lvl
                      ? 'bg-neon-green text-black border-neon-green shadow-sm'
                      : 'bg-card-dark text-gray-400 border-gray-700 hover:border-gray-500'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-medium">Perceived Readiness for Next Session:</span>
            <div className="flex items-center gap-2">
              {(['high', 'moderate', 'low'] as PerceivedReadiness[]).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReadiness(r === readiness ? undefined : r)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize border transition-all ${
                    readiness === r
                      ? 'bg-electric-purple text-white border-electric-purple shadow-sm'
                      : 'bg-card-dark text-gray-400 border-gray-700 hover:border-gray-500'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-medium">Session Highlights:</span>
            <div className="flex flex-wrap gap-1.5">
              {STANDARD_REFLECTION_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-0.5 rounded text-[10px] border transition-all ${
                    selectedTags.includes(tag)
                      ? 'bg-neon-green/20 text-neon-green border-neon-green/50 font-semibold'
                      : 'bg-card-dark text-gray-400 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  #{tag.replace(/\s+/g, '')}
                </button>
              ))}
            </div>
          </div>
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

        {/* Post-Workout Recovery Hydration Banner */}
        {recoveryHydrationLabel && (
          <div className="p-3 bg-cyan-950/20 rounded-xl border border-cyan-500/30 text-left text-xs space-y-1">
            <span className="text-[11px] font-poppins font-bold uppercase tracking-wider text-cyan-400 block">
              💧 Recovery Fluid Planning Target
            </span>
            <p className="text-gray-300 font-mono text-[11px]">
              {recoveryHydrationLabel}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={() => handleFinish('plan')}
            variant="outline"
            className="border-gray-700 bg-card-dark text-secondary-text hover:bg-gray-800 flex-1 py-2.5 text-xs sm:text-sm"
          >
            View Weekly Plan
          </Button>

          <Button
            onClick={() => handleFinish('dashboard')}
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
