import React from 'react'
import { AlertTriangle, Trash2, X, Clock, Award, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { CompletedWorkoutLog } from '@/types/workoutSession'

export interface DeleteWorkoutLogModalProps {
  isOpen: boolean
  log: CompletedWorkoutLog | null
  onClose: () => void
  onConfirmDelete: (logId: string) => void
}

export const DeleteWorkoutLogModal: React.FC<DeleteWorkoutLogModalProps> = ({
  isOpen,
  log,
  onClose,
  onConfirmDelete
}) => {
  const modalRef = useFocusTrap<HTMLDivElement>({
    isActive: isOpen && Boolean(log),
    onEscape: onClose,
    returnFocus: true,
  })

  if (!isOpen || !log) return null

  const logMins = Math.max(1, Math.round((log.durationSeconds || 0) / 60))
  const dateFormatted = log.completedAt
    ? new Date(log.completedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Unknown date'

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 bg-bodymap-dark/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-workout-title"
      aria-describedby="delete-workout-description"
      data-testid="delete-workout-modal"
    >
      <div className="bg-card-dark border border-gray-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-bright-coral/20 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5 text-bright-coral" />
            </div>
            <div>
              <h2
                id="delete-workout-title"
                className="text-base font-poppins font-bold text-primary-text"
              >
                Delete Workout Log?
              </h2>
              <p className="text-xs text-secondary-text font-open-sans">
                Day {log.dayIndex + 1}: {log.dayTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-primary-text p-1 rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workout Summary Badge */}
        <div className="bg-bodymap-dark/80 rounded-lg p-3 border border-gray-800 text-xs space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="font-semibold text-gray-300">{log.dayType || 'Workout'}</span>
            <span className="text-[11px] font-mono">{dateFormatted}</span>
          </div>
          <div className="flex items-center gap-3 text-secondary-text pt-1 border-t border-gray-800/60">
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

        {/* Warning copy */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p id="delete-workout-description" className="leading-relaxed">
            Only this specific session record will be removed from your history. Your training plan, personal records, and remaining logs will remain intact. This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-gray-700 bg-bodymap-dark text-secondary-text hover:bg-gray-800 text-xs"
            data-testid="cancel-delete-workout-btn"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirmDelete(log.id)}
            className="bg-bright-coral hover:bg-bright-coral/90 text-white font-semibold text-xs flex items-center gap-1.5"
            data-testid="confirm-delete-workout-btn"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Workout Log
          </Button>
        </div>
      </div>
    </div>
  )
}
