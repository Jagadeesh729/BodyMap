import React from 'react'
import { calculateMacroPercentages, type MacroPercentages } from '@/lib/macroEstimator'

export interface MacroRatioVisualizerProps {
  proteinKcal: number
  carbKcal: number
  fatKcal: number
  proteinGrams?: number
  carbGrams?: number
  fatGrams?: number
  totalKcal?: number
  className?: string
}

export const MacroRatioVisualizer: React.FC<MacroRatioVisualizerProps> = ({
  proteinKcal,
  carbKcal,
  fatKcal,
  proteinGrams,
  carbGrams,
  fatGrams,
  totalKcal,
  className = ''
}) => {
  const sumKcal = totalKcal || (proteinKcal + carbKcal + fatKcal)
  if (sumKcal <= 0) {
    return null
  }

  const percentages: MacroPercentages = calculateMacroPercentages(proteinKcal, carbKcal, fatKcal)
  const ariaLabel = `Caloric macro distribution: Protein ${percentages.proteinPct}%, Carbohydrates ${percentages.carbPct}%, Fats ${percentages.fatPct}%`

  return (
    <div
      className={`w-full space-y-2 ${className}`}
      role="region"
      aria-label="Macronutrient Caloric Distribution"
    >
      {/* Visual Stacked Multi-Segment Bar */}
      <div
        className="h-2.5 w-full rounded-full bg-gray-800 overflow-hidden flex shadow-inner"
        role="img"
        aria-label={ariaLabel}
      >
        {percentages.proteinPct > 0 && (
          <div
            style={{ width: `${percentages.proteinPct}%` }}
            className="h-full bg-electric-purple motion-safe:transition-all duration-500"
            title={`Protein: ${percentages.proteinPct}% (~${proteinKcal} kcal)`}
          />
        )}
        {percentages.carbPct > 0 && (
          <div
            style={{ width: `${percentages.carbPct}%` }}
            className="h-full bg-bright-coral motion-safe:transition-all duration-500"
            title={`Carbohydrates: ${percentages.carbPct}% (~${carbKcal} kcal)`}
          />
        )}
        {percentages.fatPct > 0 && (
          <div
            style={{ width: `${percentages.fatPct}%` }}
            className="h-full bg-yellow-400 motion-safe:transition-all duration-500"
            title={`Fats: ${percentages.fatPct}% (~${fatKcal} kcal)`}
          />
        )}
      </div>

      {/* Accessible Non-Color-Dependent Percentage Badges */}
      <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-secondary-text">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-electric-purple inline-block shrink-0" aria-hidden="true" />
          <span className="text-gray-300 font-medium">P:</span>
          <span>{percentages.proteinPct}%</span>
          {typeof proteinGrams === 'number' && <span className="text-gray-500">({proteinGrams}g)</span>}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-bright-coral inline-block shrink-0" aria-hidden="true" />
          <span className="text-gray-300 font-medium">C:</span>
          <span>{percentages.carbPct}%</span>
          {typeof carbGrams === 'number' && <span className="text-gray-500">({carbGrams}g)</span>}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block shrink-0" aria-hidden="true" />
          <span className="text-gray-300 font-medium">F:</span>
          <span>{percentages.fatPct}%</span>
          {typeof fatGrams === 'number' && <span className="text-gray-500">({fatGrams}g)</span>}
        </span>
      </div>
    </div>
  )
}
