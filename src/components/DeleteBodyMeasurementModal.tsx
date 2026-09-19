import React from 'react'
import { AlertTriangle, Trash2, X, Ruler } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { BodyMeasurementEntry, MetricUnit } from '@/types/bodyMetrics'
import { convertLength, METRIC_LABELS } from '@/lib/bodyMetricsStorage'

export interface DeleteBodyMeasurementModalProps {
  isOpen: boolean
  entry: BodyMeasurementEntry | null
  unit: MetricUnit
  onClose: () => void
  onConfirmDelete: (id: string) => void
}

export const DeleteBodyMeasurementModal: React.FC<DeleteBodyMeasurementModalProps> = ({
  isOpen,
  entry,
  unit,
  onClose,
  onConfirmDelete
}) => {
  const modalRef = useFocusTrap<HTMLDivElement>({
    isActive: isOpen && Boolean(entry),
    onEscape: onClose,
    returnFocus: true
  })

  if (!isOpen || !entry) return null

  const keys = (['waist', 'chest', 'arms', 'thighs', 'hips'] as const).filter(
    k => entry[k] !== undefined
  )

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 bg-bodymap-dark/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-measurement-title"
      aria-describedby="delete-measurement-description"
      data-testid="delete-body-measurement-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
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
                id="delete-measurement-title"
                className="text-base font-poppins font-bold text-primary-text"
              >
                Delete Measurement Entry?
              </h2>
              <p className="text-xs text-secondary-text font-open-sans">
                Recorded on {entry.date}
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

        {/* Measurement Summary Card */}
        <div className="bg-bodymap-dark/80 rounded-lg p-3 border border-gray-800 text-xs space-y-2">
          <div className="flex items-center justify-between text-gray-400">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-neon-green" /> Body Circumference
            </span>
            <span className="text-[11px] font-mono text-gray-400">{entry.date}</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-800/60">
            {keys.map((k) => (
              <span
                key={k}
                className="bg-gray-900 border border-gray-800 px-2 py-0.5 rounded text-[11px] font-mono text-gray-300"
              >
                {METRIC_LABELS[k]}: <strong className="text-white">{convertLength(entry[k]!, entry.unit, unit)} {unit}</strong>
              </span>
            ))}
            {keys.length === 0 && (
              <span className="text-gray-500 italic text-[11px]">No individual values</span>
            )}
          </div>

          {entry.notes && (
            <p className="text-[11px] text-gray-400 italic pt-1 border-t border-gray-800/60">
              &ldquo;{entry.notes}&rdquo;
            </p>
          )}
        </div>

        {/* Warning Copy */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p id="delete-measurement-description" className="leading-relaxed">
            Only this specific measurement entry will be removed from your history. Your training plan, workout history, and other recorded measurements will remain intact. This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-gray-700 bg-bodymap-dark text-secondary-text hover:bg-gray-800 text-xs"
            data-testid="cancel-delete-measurement-btn"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirmDelete(entry.id)}
            className="bg-bright-coral hover:bg-bright-coral/90 text-white font-semibold text-xs flex items-center gap-1.5"
            data-testid="confirm-delete-measurement-btn"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Entry
          </Button>
        </div>
      </div>
    </div>
  )
}
