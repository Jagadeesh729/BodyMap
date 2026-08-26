import React from 'react'
import { AlertCircle, Play, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ExitWorkoutDialogProps {
  isOpen: boolean
  onClose: () => void
  onSaveAndExit: () => void
  onDiscardAndExit: () => void
}

export const ExitWorkoutDialog: React.FC<ExitWorkoutDialogProps> = ({
  isOpen,
  onClose,
  onSaveAndExit,
  onDiscardAndExit
}) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-bodymap-dark/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-label="Exit workout confirmation"
      aria-modal="true"
    >
      <div className="bg-card-dark border border-gray-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-bright-coral/20 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-bright-coral" />
          </div>
          <div>
            <h2 className="text-lg font-poppins font-bold text-primary-text">
              Pause or Exit Workout?
            </h2>
            <p className="text-xs text-secondary-text font-open-sans">
              You have an active workout in progress.
            </p>
          </div>
        </div>

        <p className="text-xs text-secondary-text leading-relaxed">
          You can save your progress to resume later from any device tab, or discard this workout session completely.
        </p>

        <div className="space-y-2.5 pt-2">
          <Button
            onClick={onClose}
            className="btn-primary w-full py-3 text-xs sm:text-sm font-bold flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" /> Continue Workout
          </Button>

          <Button
            onClick={onSaveAndExit}
            variant="outline"
            className="w-full py-3 border-gray-700 bg-bodymap-dark text-secondary-text hover:bg-gray-800 text-xs sm:text-sm"
          >
            Save Progress &amp; Resume Later
          </Button>

          <Button
            onClick={onDiscardAndExit}
            variant="ghost"
            className="w-full py-2.5 text-bright-coral hover:bg-bright-coral/10 text-xs flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" /> Discard Session
          </Button>
        </div>
      </div>
    </div>
  )
}
