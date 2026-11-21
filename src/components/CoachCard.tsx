import { AlertCircle, GraduationCap, Info, LoaderCircle, Sparkles } from 'lucide-react'
import type { EngineLevel } from '../game/engineLevels'
import type { MoveRating } from '../game/moveRating'
import { MOVE_RATING_META, formatEval } from '../game/moveRating'
import type { EngineScore } from '../game/uciEngine'
import type { EngineStatus } from '../game/useStockfish'
import { cx } from '../lib/cx'
import { MoveRatingBadge } from './MoveRatingBadge'

interface CoachCardProps {
  enabled: boolean
  level: EngineLevel
  status: EngineStatus
  latestRated: {
    san: string
    rating: MoveRating
    bestMoveSan: string | null
    accuracy: number
  } | null
  ratingPending: boolean
  currentEval: EngineScore | null
  engineThinking: boolean
  onOpenRatings?: () => void
  /** Optional: false hides the coach entirely (analysis switched off). */
  showAnalysis?: boolean
  /** Optional: engine error message, rendered as a small inline error. */
  engineError?: string | null
}

export function CoachCard({
  enabled,
  level,
  status,
  latestRated,
  ratingPending,
  currentEval,
  engineThinking,
  onOpenRatings,
  showAnalysis = true,
  engineError,
}: CoachCardProps) {
  if (!showAnalysis) return null

  const meta = latestRated ? MOVE_RATING_META[latestRated.rating] : null

  let content
  if (engineError || status === 'error') {
    content = (
      <div className="coach-idle coach-idle--error" role="status">
        <AlertCircle size={16} />
        <p>{engineError || 'Stockfish se nepodařilo načíst. Zkus obnovit stránku.'}</p>
      </div>
    )
  } else if (!enabled) {
    content = (
      <div className="coach-idle">
        <GraduationCap size={16} />
        <p>Zapni Stockfish v nové partii a každý tvůj tah se hned ohodnotí.</p>
      </div>
    )
  } else if (status === 'loading') {
    content = (
      <div className="coach-idle">
        <LoaderCircle size={16} className="spin" />
        <p>Načítám Stockfish {level.elo === null ? 'v plné síle' : `Elo ${level.elo}`}…</p>
      </div>
    )
  } else if (ratingPending) {
    content = (
      <div className="coach-idle">
        <LoaderCircle size={16} className="spin" />
        <p>Hodnotím tvůj tah…</p>
      </div>
    )
  } else if (latestRated && meta) {
    content = (
      <div className="coach-result" key={`${latestRated.san}-${latestRated.rating}`}>
        <div className="coach-result-head">
          <MoveRatingBadge rating={latestRated.rating} size="lg" />
          <div className="coach-result-copy">
            <span className="eyebrow">Tvůj tah {latestRated.san}</span>
            <strong className="coach-rating-title" style={{ color: meta.tone }}>
              {meta.label}
            </strong>
            <span className="coach-result-desc">{meta.description}</span>
          </div>
          <div
            className="coach-accuracy"
            aria-label={`Přesnost ${Math.round(latestRated.accuracy)} procent`}
          >
            <strong>{Math.round(latestRated.accuracy)}%</strong>
            <span>přesnost</span>
          </div>
        </div>
        <div className="coach-result-foot">
          {latestRated.bestMoveSan ? (
            <span className="coach-best-alt">
              <Sparkles size={13} aria-hidden="true" /> Nejlepší byl{' '}
              <strong>{latestRated.bestMoveSan}</strong>
            </span>
          ) : (
            <span className="coach-best-match">
              <Sparkles size={13} aria-hidden="true" /> Přesně tah Stockfishe
            </span>
          )}
          <span className="coach-eval" aria-label={`Hodnocení pozice ${formatEval(currentEval)}`}>
            {formatEval(currentEval)}
          </span>
        </div>
      </div>
    )
  } else {
    content = (
      <div className="coach-idle">
        <GraduationCap size={16} />
        <p>Zahraj tah a Stockfish ho hned ohodnotí.</p>
      </div>
    )
  }

  return (
    <section
      className={cx(
        'coach-card',
        engineThinking && 'is-thinking',
        latestRated && `coach-card--${latestRated.rating}`,
      )}
      aria-label="Hodnocení tahů"
    >
      <div className="coach-head">
        <span className="coach-title">Trenér</span>
        {onOpenRatings ? (
          <div className="coach-head-actions">
            <button
              type="button"
              className="coach-legend-btn"
              onClick={onOpenRatings}
              aria-label="Vysvětlení kategorií hodnocení tahů"
            >
              <Info size={13} aria-hidden="true" />
              <span>Kategorie</span>
            </button>
          </div>
        ) : null}
      </div>
      {content}
    </section>
  )
}
