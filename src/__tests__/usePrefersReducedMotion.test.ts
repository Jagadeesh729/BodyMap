import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

describe('usePrefersReducedMotion', () => {
  it('defaults to false when matchMedia returns false', () => {
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)
  })

  it('detects when prefers-reduced-motion is true', () => {
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(true)
  })
})
