import React, { useState, useEffect } from 'react'
import { AlertTriangle, Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { subscribeToStorageQuotaErrors, type StorageQuotaEventDetail } from '@/lib/storageQuotaHandler'
import { exportBackupToFile } from '@/lib/backupStorage'

export function StorageQuotaBanner() {
  const [quotaEvent, setQuotaEvent] = useState<StorageQuotaEventDetail | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToStorageQuotaErrors((detail) => {
      setQuotaEvent(detail)
    })
    return unsubscribe
  }, [])

  if (!quotaEvent) return null

  const handleExport = () => {
    try {
      exportBackupToFile()
    } catch (err) {
      console.error('Failed to export backup on quota banner:', err)
    }
  }

  const handleDismiss = () => {
    setQuotaEvent(null)
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className="bg-amber-950/80 border-b border-amber-600/50 text-amber-100 px-4 py-3 sm:px-6 transition-all duration-200 z-50 sticky top-0 shadow-lg backdrop-blur-md"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-poppins font-semibold text-sm text-amber-200">
              Browser Storage Quota Exceeded — Data Safely Preserved
            </h3>
            <p className="text-xs text-amber-300/90 mt-0.5 leading-relaxed">
              {quotaEvent.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Button
            size="sm"
            onClick={handleExport}
            className="bg-amber-500 hover:bg-amber-600 text-gray-950 font-poppins font-bold text-xs flex items-center gap-1.5 h-8 px-3"
          >
            <Download className="w-3.5 h-3.5" />
            Export Backup
          </Button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss storage quota warning"
            className="p-1.5 rounded-lg text-amber-300 hover:text-white hover:bg-amber-900/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
