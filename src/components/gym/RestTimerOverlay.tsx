import React from 'react'
import { Play, Pause, SkipForward, Plus, Minus, Volume2, VolumeX, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RestTimerOverlayProps {
  remainingSeconds: number
  totalDuration: number
  isPaused: boolean
  soundEnabled: boolean
  onTogglePause: () => void
  onAddSeconds: (seconds: number) => void
  onSkip: () => void
  onToggleSound: () => void
}

export const RestTimerOverlay: React.FC<RestTimerOverlayProps> = ({
  remainingSeconds,
  totalDuration,
  isPaused,
  soundEnabled,
  onTogglePause,
  onAddSeconds,
  onSkip,
  onToggleSound
}) => {
  const safeTotal = Math.max(1, totalDuration)
  const safeRemaining = Math.max(0, remainingSeconds)
  const progressPercent = Math.min(100, Math.max(0, ((safeTotal - safeRemaining) / safeTotal) * 100))

  const mins = Math.floor(safeRemaining / 60)
  const secs = safeRemaining % 60
  const formattedTime = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

  // Circular progress math (radius 88, circumference ~552.9)
  const radius = 88
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference

  return (
    <div
      className="fixed inset-0 z-50 bg-bodymap-dark/95 backdrop-blur-md flex flex-col justify-between p-6 sm:p-10 animate-fade-in text-primary-text"
      role="dialog"
      aria-label="Rest timer"
      aria-modal="true"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between max-w-md w-full mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-neon-green/20 flex items-center justify-center">
            <Bell className="w-4 h-4 text-neon-green" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-poppins font-bold text-primary-text uppercase tracking-wider">
              Rest &amp; Recover
            </h2>
            <p className="text-xs text-secondary-text font-open-sans">
              Catch your breath before next set
            </p>
          </div>
        </div>

        <Button
          onClick={onToggleSound}
          variant="outline"
          size="sm"
          className="border-gray-700 bg-card-dark text-secondary-text hover:text-neon-green"
          aria-label={soundEnabled ? 'Disable timer sound' : 'Enable timer sound'}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
      </div>

      {/* Center Timer Circular Progress */}
      <div className="flex flex-col items-center justify-center my-auto">
        <div className="relative w-64 h-64 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
            {/* Background circle track */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              className="stroke-gray-800"
              strokeWidth="10"
              fill="transparent"
            />
            {/* Animated progress circle */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              className="stroke-neon-green transition-all duration-300 ease-linear"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          {/* Time digits */}
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span
              className="font-poppins font-extrabold text-5xl sm:text-6xl text-primary-text tracking-tight tabular-nums"
              aria-live="polite"
              aria-atomic="true"
            >
              {formattedTime}
            </span>
            <span className="text-xs font-medium uppercase tracking-widest text-secondary-text mt-1">
              {isPaused ? 'Timer Paused' : 'Seconds Left'}
            </span>
          </div>
        </div>

        {/* Quick adjust time buttons */}
        <div className="flex items-center gap-3 mt-6">
          <Button
            onClick={() => onAddSeconds(-15)}
            variant="outline"
            size="sm"
            className="border-gray-700 bg-card-dark text-xs px-3 py-1.5 text-secondary-text hover:border-neon-green"
            disabled={safeRemaining <= 15}
            aria-label="Subtract 15 seconds"
          >
            <Minus className="w-3.5 h-3.5 mr-1" />
            15s
          </Button>

          <Button
            onClick={() => onAddSeconds(15)}
            variant="outline"
            size="sm"
            className="border-gray-700 bg-card-dark text-xs px-3 py-1.5 text-secondary-text hover:border-neon-green"
            aria-label="Add 15 seconds"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            15s
          </Button>

          <Button
            onClick={() => onAddSeconds(30)}
            variant="outline"
            size="sm"
            className="border-gray-700 bg-card-dark text-xs px-3 py-1.5 text-secondary-text hover:border-neon-green"
            aria-label="Add 30 seconds"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            30s
          </Button>
        </div>
      </div>

      {/* Bottom Action Controls */}
      <div className="max-w-md w-full mx-auto grid grid-cols-2 gap-4">
        <Button
          onClick={onTogglePause}
          variant="outline"
          className="py-4 border-gray-700 bg-card-dark text-primary-text hover:bg-gray-800 text-sm font-semibold flex items-center justify-center gap-2"
        >
          {isPaused ? (
            <>
              <Play className="w-4 h-4 text-neon-green" /> Resume
            </>
          ) : (
            <>
              <Pause className="w-4 h-4 text-bright-coral" /> Pause
            </>
          )}
        </Button>

        <Button
          onClick={onSkip}
          className="btn-primary py-4 text-sm font-bold flex items-center justify-center gap-2"
        >
          <SkipForward className="w-4 h-4" /> Next Set
        </Button>
      </div>
    </div>
  )
}
