/**
 * Storage Quota Handler (E9)
 *
 * Provides deterministic classification of browser storage quota exceeded exceptions,
 * event subscription for user-facing notification, and ensures strict data preservation
 * (never auto-deletes or prunes user data upon storage failure).
 */

export type StorageQuotaSource = 'plan' | 'session' | 'history' | 'backup' | 'metrics' | 'unknown'

export interface StorageQuotaEventDetail {
  source: StorageQuotaSource
  timestamp: number
  message: string
}

export type StorageQuotaListener = (detail: StorageQuotaEventDetail) => void

const listeners: Set<StorageQuotaListener> = new Set()

/**
 * Detects whether an error thrown during storage write operations is a QuotaExceededError.
 * Covers W3C standard, legacy WebKit/Safari, Firefox, and Edge/IE error signatures.
 */
export function isStorageQuotaError(err: unknown): boolean {
  if (!err) return false

  if (typeof DOMException !== 'undefined' && err instanceof DOMException) {
    return (
      err.name === 'QuotaExceededError' ||
      err.code === 22 ||
      err.code === 1014 ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )
  }

  if (typeof err === 'object') {
    const errorObj = err as Record<string, unknown>
    if (
      errorObj.name === 'QuotaExceededError' ||
      errorObj.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    ) {
      return true
    }
    if (errorObj.code === 22 || errorObj.code === 1014) {
      return true
    }
    if (errorObj.number === -2147024882) {
      return true
    }
  }

  return false
}

/**
 * Dispatches a storage quota notification event to all registered in-memory listeners
 * and to the window via CustomEvent (if window is defined).
 */
export function notifyStorageQuotaExceeded(
  source: StorageQuotaSource = 'unknown',
  customMessage?: string
): void {
  const message =
    customMessage ||
    'Your browser storage is full. Your existing BodyMap workouts and plans have been fully preserved and not overwritten. Export a backup to secure your data and free up browser space.'

  const detail: StorageQuotaEventDetail = {
    source,
    timestamp: Date.now(),
    message
  }

  listeners.forEach(listener => {
    try {
      listener(detail)
    } catch (e) {
      console.warn('[StorageQuotaHandler] Listener callback error:', e)
    }
  })

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(
        new CustomEvent('bodymap:storage-quota-exceeded', { detail })
      )
    } catch {
      // Ignore CustomEvent dispatch error in headless/constrained environments
    }
  }
}

/**
 * Subscribes a listener to storage quota exceeded events.
 * Returns an unsubscribe callback.
 */
export function subscribeToStorageQuotaErrors(
  listener: StorageQuotaListener
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Clears all registered listeners (primarily used in testing).
 */
export function _clearStorageQuotaListeners(): void {
  listeners.clear()
}
