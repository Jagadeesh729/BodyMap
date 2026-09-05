import React, { useMemo } from 'react'
import { X, RefreshCw, CheckCircle2, Dumbbell, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getExerciseAlternatives, type ExerciseAlternative } from '@/lib/exerciseSubstitution'
import { getMovementPattern } from '@/lib/movementPatterns'
import { scanPlanForContraindications } from '@/lib/contraindicationGuard'

interface ExerciseSubstitutionModalProps {
  currentExerciseName: string
  isOpen: boolean
  onClose: () => void
  onSelectAlternative: (alternative: ExerciseAlternative) => void
  medicalIssues?: string
}

export const ExerciseSubstitutionModal: React.FC<ExerciseSubstitutionModalProps> = ({
  currentExerciseName,
  isOpen,
  onClose,
  onSelectAlternative,
  medicalIssues
}) => {
  const rawAlternatives = getExerciseAlternatives(currentExerciseName)
  const alternatives = useMemo(() => {
    if (!medicalIssues || !medicalIssues.trim()) return rawAlternatives
    return rawAlternatives.filter(alt => {
      const contraScan = scanPlanForContraindications(alt.name, medicalIssues)
      return !contraScan.hasViolation
    })
  }, [rawAlternatives, medicalIssues])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-bodymap-dark/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in"
      role="dialog"
      aria-label="Exercise substitution modal"
      aria-modal="true"
    >
      <div className="bg-card-dark border border-gray-700 rounded-xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-electric-purple/20 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-electric-purple" />
            </div>
            <div>
              <h2 className="text-lg font-poppins font-bold text-primary-text">
                Substitute Exercise
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-secondary-text font-open-sans truncate max-w-xs sm:max-w-sm">
                  Replacing: <strong className="text-neon-green font-semibold">{currentExerciseName}</strong>
                </p>
                <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-gray-800 text-gray-300 border border-gray-700 font-medium">
                  {getMovementPattern(currentExerciseName).pattern}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-secondary-text hover:text-primary-text p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of alternatives */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {alternatives.length === 0 ? (
            <div className="p-6 text-center bg-bodymap-dark/60 rounded-xl border border-gray-800 space-y-2 my-auto">
              <p className="text-sm font-poppins font-semibold text-secondary-text">
                No confident biomechanical substitute found
              </p>
              <p className="text-xs text-gray-400 font-open-sans leading-relaxed max-w-sm mx-auto">
                To preserve target training intent and joint safety, please keep this exercise or customize your 7-day schedule from the Weekly Plan.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-secondary-text mb-2">
                Select a biomechanically matched alternative matching your available gear and joint comfort:
              </p>

              {alternatives.map((alt, idx) => (
                <div
                  key={idx}
                  className="bg-bodymap-dark/80 border border-gray-800 hover:border-neon-green/60 rounded-lg p-4 transition-all duration-200 flex flex-col justify-between gap-3 group"
                >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-poppins font-semibold text-primary-text text-sm sm:text-base group-hover:text-neon-green transition-colors">
                    {alt.name}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700 font-medium">
                      {getMovementPattern(alt.name).pattern}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-electric-purple/20 text-electric-purple rounded border border-electric-purple/40">
                      {alt.equipment}
                    </span>
                  </div>
                </div>

                <div className="mt-2 space-y-1 text-xs">
                  <p className="text-secondary-text flex items-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5 text-neon-green shrink-0" />
                    <span>Focus: <strong className="text-primary-text">{alt.focus}</strong></span>
                  </p>
                  <p className="text-secondary-text flex items-start gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-electric-purple shrink-0 mt-0.5" />
                    <span>Rationale: <em>{alt.reason}</em></span>
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between">
                <p className="text-[11px] text-gray-400 italic truncate max-w-xs">
                  Cue: {alt.formCue}
                </p>
                <Button
                  onClick={() => onSelectAlternative(alt)}
                  size="sm"
                  className="btn-primary text-xs py-1.5 px-3.5 shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Select
                </Button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-bodymap-dark/40 flex justify-end">
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
            className="border-gray-700 text-secondary-text hover:bg-gray-800 text-xs"
          >
            Keep Original Exercise
          </Button>
        </div>
      </div>
    </div>
  )
}
