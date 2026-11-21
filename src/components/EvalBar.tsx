import type { CSSProperties } from 'react'
import type { Color } from 'chess.js'
import type { EngineScore } from '../game/uciEngine'
import { formatEval, winProbability, scoreToCp } from '../game/moveRating'
import { cx } from '../lib/cx'

interface EvalBarProps {
  score: EngineScore | null
  orientation: Color
  /** Kept for API compatibility; the only "thinking" indicator lives in the player strip. */
  thinking?: boolean
  /** Optional: false renders a neutral, empty bar (keeps the layout stable). */
  showAnalysis?: boolean
  /** Optional: engine error; renders the neutral bar with an error outline. */
  engineError?: string | null
}

export function EvalBar({ score, orientation, showAnalysis = true, engineError }: EvalBarProps) {
  const off = !showAnalysis || Boolean(engineError)
  const win = score ? winProbability(scoreToCp(score)) : 0.5
  // Keep a sliver of both colours visible, as chess.com does.
  const whiteShare = 0.04 + win * 0.92
  const label = off
    ? engineError
      ? `Hodnocení nedostupné: ${engineError}`
      : 'Hodnocení vypnuto'
    : `Hodnocení pozice ${formatEval(score)} ve prospěch ${win >= 0.5 ? 'bílého' : 'černého'}`

  return (
    <div
      className={cx('eval-bar', off && 'is-off', engineError && 'is-error')}
      role="img"
      aria-label={label}
      title={engineError ?? undefined}
      data-white={orientation === 'w' ? 'bottom' : 'top'}
      data-lead={win >= 0.5 ? 'white' : 'black'}
      style={{ '--eval-share': whiteShare } as CSSProperties}
    >
      <div className="eval-bar-fill" />
      <span className="eval-bar-mid" aria-hidden="true" />
      <span className="eval-bar-value" aria-hidden="true">
        {formatEval(score)}
      </span>
    </div>
  )
}
