import { useEffect, useRef, useState, useCallback } from 'react'

export interface UseWakeLockOptions {
  enabled: boolean
  onRequestError?: (err: unknown) => void
  onRelease?: () => void
}

export interface UseWakeLockResult {
  isSupported: boolean
  isActive: boolean
  requestWakeLock: () => Promise<void>
  releaseWakeLock: () => Promise<void>
}

// Minimal interface for WakeLockSentinel
interface WakeLockSentinelLike {
  released: boolean
  release: () => Promise<void>
  addEventListener: (type: 'release', listener: () => void) => void
  removeEventListener: (type: 'release', listener: () => void) => void
}

/**
 * Custom React hook for controlling the Screen Wake Lock API.
 * Prevents mobile devices from sleeping during active gym workouts.
 *
 * Requirements met:
 * - Feature detection ('wakeLock' in navigator)
 * - Unsupported browsers fail gracefully with zero throw
 * - Request rejections (battery saver, permission denied) are caught safely
 * - Active lock only during enabled state (in-progress workout)
 * - Releases cleanly on pause, exit, unmount, or tab switch
 * - Reacquires lock on document visibilitychange back to 'visible'
 */
export function useWakeLock({
  enabled,
  onRequestError,
  onRelease,
}: UseWakeLockOptions): UseWakeLockResult {
  const isSupported = typeof window !== 'undefined' && typeof navigator !== 'undefined' && Boolean('wakeLock' in navigator && (navigator as unknown as { wakeLock?: unknown }).wakeLock)
  const [isActive, setIsActive] = useState(false)
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null)
  const isRequestingRef = useRef(false)
  const onReleaseRef = useRef(onRelease)
  onReleaseRef.current = onRelease
  const onRequestErrorRef = useRef(onRequestError)
  onRequestErrorRef.current = onRequestError

  const releaseWakeLock = useCallback(async () => {
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release()
      } catch {
        // Ignore release errors on already released sentinels
      } finally {
        sentinelRef.current = null
        setIsActive(false)
      }
    }
  }, [])

  const requestWakeLock = useCallback(async () => {
    if (!isSupported || !enabled) return
    // Guard against re-entrant calls or active unreleased sentinel
    if (isRequestingRef.current) return
    if (sentinelRef.current && !sentinelRef.current.released) return

    isRequestingRef.current = true
    try {
      // Type assertion for standard Screen Wake Lock API
      const nav = navigator as unknown as {
        wakeLock?: {
          request: (type: 'screen') => Promise<WakeLockSentinelLike>
        }
      }
      if (typeof nav.wakeLock?.request === 'function') {
        const sentinel = await nav.wakeLock.request('screen')
        sentinelRef.current = sentinel
        setIsActive(true)

        const handleRelease = () => {
          sentinelRef.current = null
          setIsActive(false)
          onReleaseRef.current?.()
        }

        sentinel.addEventListener('release', handleRelease)
      }
    } catch (err: unknown) {
      sentinelRef.current = null
      setIsActive(false)
      onRequestErrorRef.current?.(err)
    } finally {
      isRequestingRef.current = false
    }
  }, [isSupported, enabled])

  // Lifecycle control: acquire when enabled, release when disabled or unmounted
  useEffect(() => {
    if (enabled && isSupported) {
      requestWakeLock()
    } else {
      releaseWakeLock()
    }

    return () => {
      releaseWakeLock()
    }
  }, [enabled, isSupported, requestWakeLock, releaseWakeLock])

  // VisibilityChange listener: re-acquire when tab becomes visible again
  useEffect(() => {
    if (!isSupported || !enabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isSupported, enabled, requestWakeLock])

  return {
    isSupported,
    isActive,
    requestWakeLock,
    releaseWakeLock,
  }
}
