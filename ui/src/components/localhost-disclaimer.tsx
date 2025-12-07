import { Shield, X } from 'lucide-react'
import { useState } from 'react'

export function LocalhostDisclaimer() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800 px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
          <Shield className="w-4 h-4" />
          <span>
            This dashboard runs locally. All data stays on your machine.
            Never expose this server to the internet.
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-yellow-600 hover:text-yellow-800 dark:text-yellow-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
