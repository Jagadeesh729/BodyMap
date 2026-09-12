import { useEffect, useRef, type RefObject } from 'react'

export interface UseFocusTrapOptions {
  /** Whether the focus trap is actively engaged. Defaults to true. */
  isActive?: boolean
  /** Whether to restore focus to the opening trigger button on exit. Defaults to true. */
  returnFocus?: boolean
  /** Optional callback invoked when the Escape key is pressed. */
  onEscape?: () => void
  /** Which element to focus first inside the modal: 'first' focusable element or 'container'. Defaults to 'first'. */
  initialFocus?: 'first' | 'container'
}

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ')

/**
 * Zero-dependency WCAG 2.1 SC 2.4.3 compliant focus trap hook.
 *
 * Guarantees:
 * 1. Initial focus: Transfers keyboard focus inside the modal dialog upon activation.
 * 2. Focus containment: Cyclically traps Tab and Shift+Tab within modal bounds.
 * 3. Escape key dismissal: Dispatches onEscape callback on Escape keydown.
 * 4. Focus restoration: Restores focus to the element that triggered modal opening upon unmount or closing.
 * 5. Defensive zero-throw: Safely handles detached DOM nodes, disabled elements, and non-browser runtimes.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  options: boolean | UseFocusTrapOptions = true,
  externalRef?: RefObject<T | null>
): RefObject<T | null> {
  const internalRef = useRef<T | null>(null)
  const containerRef = externalRef || internalRef
  const previousActiveElementRef = useRef<HTMLElement | null>(null)

  const opts: UseFocusTrapOptions = typeof options === 'boolean' ? { isActive: options } : options
  const { isActive = true, returnFocus = true, onEscape, initialFocus = 'first' } = opts

  useEffect(() => {
    if (!isActive) return

    // 1. Capture currently active element so we can restore focus when closing
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      previousActiveElementRef.current = document.activeElement
    }

    const container = containerRef.current
    if (!container) return

    // Query helper for tabbable, visible, non-disabled elements
    const getFocusableElements = (): HTMLElement[] => {
      if (!containerRef.current) return []
      const elements = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      )
      return elements.filter((el) => {
        if (el.hasAttribute('disabled')) return false
        if (el.getAttribute('aria-hidden') === 'true') return false
        return true
      })
    }

    // 2. Set initial focus into modal
    const timer = setTimeout(() => {
      if (!containerRef.current) return
      const focusable = getFocusableElements()

      if (initialFocus === 'container' || focusable.length === 0) {
        if (!containerRef.current.hasAttribute('tabindex')) {
          containerRef.current.setAttribute('tabindex', '-1')
        }
        containerRef.current.focus?.()
      } else {
        // Find element with autofocus if present, otherwise first focusable
        const autoFocusEl = focusable.find((el) => el.hasAttribute('autofocus'))
        const target = autoFocusEl || focusable[0]
        target.focus?.()
      }
    }, 0)

    // 3. Trap keyboard navigation inside container
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault()
        onEscape()
        return
      }

      if (e.key !== 'Tab') return

      const focusable = getFocusableElements()
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }

      const firstEl = focusable[0]
      const lastEl = focusable[focusable.length - 1]

      if (e.shiftKey) {
        // Shift + Tab: if on first element or outside, cycle to last
        if (document.activeElement === firstEl || !containerRef.current?.contains(document.activeElement)) {
          e.preventDefault()
          lastEl.focus?.()
        }
      } else {
        // Tab: if on last element or outside, cycle to first
        if (document.activeElement === lastEl || !containerRef.current?.contains(document.activeElement)) {
          e.preventDefault()
          firstEl.focus?.()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    // 4. Return focus to previous element upon deactivation or unmount
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
      if (returnFocus && previousActiveElementRef.current) {
        try {
          if (
            typeof document !== 'undefined' &&
            document.contains(previousActiveElementRef.current)
          ) {
            previousActiveElementRef.current.focus?.()
          }
        } catch {
          // Zero-throw fallback
        }
      }
    }
  }, [isActive, returnFocus, onEscape, initialFocus, containerRef])

  return containerRef
}
