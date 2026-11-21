import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Color } from 'chess.js'
import type { TimeControl } from '../game/constants'

interface ClockOptions {
  timeControl: TimeControl
  activeColor: Color
  enabled: boolean
  paused: boolean
  resetKey: number
  onTimeout: (color: Color) => void
}

export interface ClockSnapshot {
  w: number
  b: number
}

const TICK_MS = 100

export function useChessClock({
  timeControl,
  activeColor,
  enabled,
  paused,
  resetKey,
  onTimeout,
}: ClockOptions) {
  const initialMs = timeControl.minutes * 60_000
  const timesRef = useRef<ClockSnapshot>({ w: initialMs, b: initialMs })
  const [times, setTimes] = useState<ClockSnapshot>(timesRef.current)
  /** Timestamp of the last time charge; null while the clock is stopped. */
  const lastTickRef = useRef<number | null>(null)
  /** Colour that is charged for time elapsed since `lastTickRef`. */
  const chargedColorRef = useRef<Color>(activeColor)
  const timeoutFiredRef = useRef(false)
  const onTimeoutRef = useRef(onTimeout)

  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  const publish = useCallback(() => {
    setTimes({ ...timesRef.current })
  }, [])

  /** Charges the time elapsed since the last tick to the colour on move. */
  const flush = useCallback(() => {
    const previous = lastTickRef.current
    if (previous === null) return
    const now = performance.now()
    lastTickRef.current = now
    const color = chargedColorRef.current
    timesRef.current = {
      ...timesRef.current,
      [color]: Math.max(0, timesRef.current[color] - (now - previous)),
    }
  }, [])

  useEffect(() => {
    timesRef.current = { w: initialMs, b: initialMs }
    lastTickRef.current = null
    timeoutFiredRef.current = false
    publish()
  }, [initialMs, publish, resetKey])

  useEffect(() => {
    if (!enabled || paused) {
      lastTickRef.current = null
      return
    }

    chargedColorRef.current = activeColor
    lastTickRef.current = performance.now()
    const interval = window.setInterval(() => {
      flush()
      publish()
    }, TICK_MS)

    return () => {
      window.clearInterval(interval)
      // Charge the partial tick so a turn change never drops up to TICK_MS.
      flush()
      lastTickRef.current = null
      publish()
    }
  }, [activeColor, enabled, flush, paused, publish])

  useEffect(() => {
    if (!enabled) return
    const remaining = times[activeColor]
    if (remaining > 0 || timeoutFiredRef.current) return
    timeoutFiredRef.current = true
    onTimeoutRef.current(activeColor)
  }, [activeColor, enabled, times])

  const addIncrement = useCallback(
    (color: Color) => {
      if (timeControl.increment === 0) return
      flush()
      const incrementMs = timeControl.increment * 1000
      timesRef.current = { ...timesRef.current, [color]: timesRef.current[color] + incrementMs }
      publish()
    },
    [flush, publish, timeControl.increment],
  )

  /** Current remaining times (including the running partial tick). */
  const getSnapshot = useCallback((): ClockSnapshot => {
    flush()
    return { ...timesRef.current }
  }, [flush])

  /** Restores times, e.g. when undo/redo moves through the history. */
  const restore = useCallback(
    (snapshot: ClockSnapshot) => {
      timesRef.current = { ...snapshot }
      if (lastTickRef.current !== null) lastTickRef.current = performance.now()
      if (snapshot.w > 0 && snapshot.b > 0) timeoutFiredRef.current = false
      publish()
    },
    [publish],
  )

  const whiteMs = times.w
  const blackMs = times.b

  return useMemo(
    () => ({
      whiteMs,
      blackMs,
      addIncrement,
      getSnapshot,
      restore,
      isLow: (color: Color) => enabled && (color === 'w' ? whiteMs : blackMs) < 20_000,
      isCritical: (color: Color) => enabled && (color === 'w' ? whiteMs : blackMs) < 10_000,
    }),
    [addIncrement, blackMs, enabled, getSnapshot, restore, whiteMs],
  )
}
