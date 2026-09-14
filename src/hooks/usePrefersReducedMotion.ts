import { useState, useEffect } from 'react'

/**
 * Hook to detect whether the user has enabled "prefers-reduced-motion" in their OS or browser.
 * Used to disable decorative Recharts transitions and canvas animations.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else if (typeof (mediaQuery as { addListener?: (fn: (e: MediaQueryListEvent) => void) => void }).addListener === 'function') {
      (mediaQuery as { addListener: (fn: (e: MediaQueryListEvent) => void) => void }).addListener(handleChange)
      return () => {
        if (typeof (mediaQuery as { removeListener?: (fn: (e: MediaQueryListEvent) => void) => void }).removeListener === 'function') {
          (mediaQuery as { removeListener: (fn: (e: MediaQueryListEvent) => void) => void }).removeListener(handleChange)
        }
      }
    }
  }, [])

  return prefersReducedMotion
}
