import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { graphPoints, plyAtX, smoothPath } from '../game/review'
import { cx } from '../lib/cx'

export type GraphMarkerTone = 'brilliant' | 'inaccuracy' | 'mistake' | 'blunder'

export interface GraphMarker {
  ply: number
  tone: GraphMarkerTone
  label: string
}

interface EvalGraphProps {
  /** Per-ply eval in -1..1 from White's view; index 0 = start position. */
  series: Array<number | null>
  /** Ply shown on the board (live = last ply). */
  currentPly: number
  markers?: GraphMarker[]
  onSelectPly?: (ply: number) => void
  compact?: boolean
  /** Background analysis progress; hidden once complete. */
  progress?: { done: number; total: number }
  className?: string
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

export function EvalGraph({
  series,
  currentPly,
  markers = [],
  onSelectPly,
  compact = false,
  progress,
  className,
}: EvalGraphProps) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const gradientId = `eval-fill-${useId().replace(/:/g, '')}`
  const height = compact ? 52 : 88
  const points = width > 0 ? graphPoints(series, width, height) : []
  const byPly = new Map(points.map((point) => [point.ply, point]))
  const span = Math.max(1, series.length - 1)
  const mid = height / 2
  const pending = progress && progress.total > 0 && progress.done < progress.total

  let line = ''
  let area = ''
  if (points.length >= 2) {
    line = smoothPath(points)
    const first = points[0]
    const last = points[points.length - 1]
    area = `${line} L${last.x.toFixed(1)} ${height} L${first.x.toFixed(1)} ${height} Z`
  }
  const cursorX = (Math.min(currentPly, span) / span) * width
  const cursorPoint = byPly.get(Math.min(currentPly, span))

  const select = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onSelectPly || series.length < 2) return
    const rect = event.currentTarget.getBoundingClientRect()
    onSelectPly(plyAtX(event.clientX - rect.left, rect.width, series.length))
  }

  const known = series.filter((value) => value !== null).length

  return (
    <div className={cx('eval-graph', compact && 'eval-graph--compact', className)}>
      <div
        ref={ref}
        className={cx('eval-graph-plot', onSelectPly && series.length > 1 && 'is-clickable')}
        style={{ height }}
        onPointerDown={select}
        role="img"
        aria-label={`Graf hodnocení pozice, ${series.length - 1} půltahů${pending ? ', rozbor probíhá' : ''}`}
      >
        {width > 0 ? (
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="eval-graph-fill-top" />
                <stop offset="1" className="eval-graph-fill-bottom" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width={width} height={height} className="eval-graph-bg" />
            {area ? <path d={area} className="eval-graph-area" fill={`url(#${gradientId})`} /> : null}
            <line x1="0" x2={width} y1={mid} y2={mid} className="eval-graph-mid" />
            {line ? <path d={line} className="eval-graph-line" /> : null}
            {series.length > 1 ? (
              <line x1={cursorX} x2={cursorX} y1="0" y2={height} className="eval-graph-cursor" />
            ) : null}
            {series.length > 1 && cursorPoint ? (
              <circle cx={cursorPoint.x} cy={cursorPoint.y} r={compact ? 3 : 3.5} className="eval-graph-dot" />
            ) : null}
            {markers.map((marker) => {
              const point = byPly.get(marker.ply)
              if (!point) return null
              return (
                <circle
                  key={`${marker.ply}-${marker.tone}`}
                  cx={point.x}
                  cy={point.y}
                  r={compact ? 3 : 4}
                  className={cx('eval-graph-marker', `eval-graph-marker--${marker.tone}`)}
                >
                  <title>{marker.label}</title>
                </circle>
              )
            })}
          </svg>
        ) : null}
        {known < 2 ? (
          <span className="eval-graph-empty">
            {series.length < 2 ? 'Graf se objeví po prvních tazích' : 'Hodnotím pozice…'}
          </span>
        ) : null}
      </div>
      {pending ? (
        <div className="eval-graph-progress" role="status">
          <span className="eval-graph-progress-bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${progress.done / progress.total})` }} />
          </span>
          <span>
            Rozbor {progress.done}/{progress.total}
          </span>
        </div>
      ) : null}
    </div>
  )
}
