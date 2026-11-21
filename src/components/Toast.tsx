import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface ToastProps {
  message: string
  tone: 'default' | 'error'
  id: number
  /**
   * Optional: total time the parent keeps the toast mounted (useToasts uses 2600ms).
   * The toast starts its exit animation EXIT_MS before that, so it leaves smoothly
   * even though the parent unmounts it without warning.
   */
  duration?: number
}

const EXIT_MS = 200

export function Toast({ message, tone, id, duration = 2600 }: ToastProps) {
  const [closingId, setClosingId] = useState<number | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setClosingId(id), Math.max(0, duration - EXIT_MS))
    return () => window.clearTimeout(timer)
  }, [duration, id])

  return (
    <div className="toast-region" aria-live="polite" aria-atomic="true">
      <div
        key={id}
        className={`toast ${tone === 'error' ? 'toast--error' : ''}`}
        data-state={closingId === id ? 'closing' : 'open'}
      >
        {tone === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
        <span>{message}</span>
      </div>
    </div>
  )
}
