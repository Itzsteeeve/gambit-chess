import { useCallback, useEffect, useRef, useState } from 'react'

interface ToastState {
  id: number
  message: string
  tone: 'default' | 'error'
}

export function useToasts() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const idRef = useRef(0)

  const showToast = useCallback((message: string, tone: 'default' | 'error' = 'default') => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    idRef.current += 1
    setToast({ id: idRef.current, message, tone })
    timeoutRef.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  return { toast, showToast }
}
