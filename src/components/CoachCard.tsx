import { GraduationCap, Info, Volume2, VolumeX } from 'lucide-react'
import { useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { splitNotation } from '../game/coachText'
import type { EngineLevel } from '../game/engineLevels'
import type { MoveRating } from '../game/moveRating'
import { MOVE_RATING_META } from '../game/moveRating'
import type { EngineStatus } from '../game/useStockfish'
import { cx } from '../lib/cx'
import { MoveRatingBadge } from './MoveRatingBadge'

export interface CoachComment {
  /** "Tvůj tah Nf3" */
  title: string
  rating: MoveRating
  accuracy: number
  text: string
}

interface CoachCardProps {
  enabled: boolean
  level: EngineLevel
  status: EngineStatus
  /** Comment on the move being discussed; null when there is none (yet). */
  comment: CoachComment | null
  ratingPending: boolean
  engineThinking: boolean
  /** The player just took a move back to try again. */
  retryPrompt?: boolean
  /** Which demonstration the board is showing. */
  demoView?: 'problem' | 'better' | null
  /** Label of the button that closes a demonstration. */
  backLabel?: string
  onShowProblem?: () => void
  onShowBetter?: () => void
  onRetry?: () => void
  onBack?: () => void
  onOpenRatings?: () => void
  /** Read-aloud switch; omitted when the browser has no Czech voice. */
  voice?: { enabled: boolean; onToggle: () => void }
  /** Optional: false hides the coach entirely (analysis switched off). */
  showAnalysis?: boolean
  /** Optional: engine error message, rendered as a small inline error. */
  engineError?: string | null
}

export function CoachCard({
  enabled,
  level,
  status,
  comment,
  ratingPending,
  engineThinking,
  retryPrompt = false,
  demoView = null,
  backLabel = 'Zpět do hry',
  onShowProblem,
  onShowBetter,
  onRetry,
  onBack,
  onOpenRatings,
  voice,
  showAnalysis = true,
  engineError,
}: CoachCardProps) {
  /** The last full comment stays on screen while the next move is being rated. */
  const lastRef = useRef<CoachComment | null>(null)
  if (comment) lastRef.current = comment
  else if (!ratingPending) lastRef.current = null

  if (!showAnalysis) return null

  const failed = Boolean(engineError) || status === 'error'
  const available = !failed && enabled && status !== 'loading' && !retryPrompt
  const loading = available && ratingPending && !comment
  const shown = available ? (comment ?? (loading ? lastRef.current : null)) : null
  const meta = shown ? MOVE_RATING_META[shown.rating] : null

  let message: ReactNode = null
  if (failed) message = engineError || 'Stockfish se nepodařilo načíst. Zkus obnovit stránku.'
  else if (!enabled) message = 'Trenér hodnotí tahy proti Stockfishi. Partii dvou hráčů rozebere po jejím konci.'
  else if (status === 'loading') {
    message = `Načítám Stockfish ${level.elo === null ? 'v plné síle' : `Elo ${level.elo}`}…`
  } else if (retryPrompt) message = 'Zkus najít lepší tah. Pomůže ti tlačítko Rada.'
  else if (!shown) message = loading ? 'Hodnotím tah…' : 'Zahraj tah a trenér ti k němu hned něco řekne.'

  const actions: Array<{ id: string; label: string; onClick: () => void; pressed?: boolean }> = []
  if (shown && !loading) {
    if (onShowProblem) {
      actions.push({ id: 'problem', label: 'Ukaž problém', onClick: onShowProblem, pressed: demoView === 'problem' })
    }
    if (onShowBetter) {
      actions.push({ id: 'better', label: 'Lepší tah', onClick: onShowBetter, pressed: demoView === 'better' })
    }
    if (onRetry) actions.push({ id: 'retry', label: 'Zkusit znovu', onClick: onRetry })
  }

  return (
    <section
      className={cx(
        'coach-card',
        engineThinking && 'is-thinking',
        loading && 'is-loading',
        loading && shown && 'is-stale',
        !enabled && 'is-off',
      )}
      style={meta ? ({ '--coach-tone': meta.tone } as CSSProperties) : undefined}
      aria-label="Hodnocení tahů"
      aria-busy={loading}
    >
      <div className="coach-head">
        {shown ? (
          <MoveRatingBadge rating={shown.rating} size="sm" />
        ) : (
          <GraduationCap className="coach-icon" size={18} aria-hidden="true" />
        )}
        <p className="coach-heading">
          {shown && meta ? (
            <>
              <strong>{meta.label}</strong>
              <span title={`Přesnost tahu ${Math.round(shown.accuracy)} %`}>
                {shown.title} · {Math.round(shown.accuracy)} %
              </span>
            </>
          ) : (
            <strong>Trenér</strong>
          )}
        </p>
        {loading ? (
          <span className="coach-thinking" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        ) : null}
        <div className="coach-tools">
          {/* Up here so the action row never wraps while a demonstration is open. */}
          {onBack ? (
            <button type="button" className="coach-back" onClick={onBack} aria-label={backLabel} title={backLabel}>
              Zpět
            </button>
          ) : null}
          {voice ? (
            <button
              type="button"
              className="coach-tool"
              onClick={voice.onToggle}
              aria-pressed={voice.enabled}
              aria-label="Číst komentáře trenéra nahlas"
              title={voice.enabled ? 'Vypnout hlas trenéra' : 'Zapnout hlas trenéra'}
            >
              {voice.enabled ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
            </button>
          ) : null}
          {onOpenRatings ? (
            <button
              type="button"
              className="coach-tool"
              onClick={onOpenRatings}
              aria-label="Vysvětlení kategorií hodnocení tahů"
              title="Kategorie tahů"
            >
              <Info size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <p className={cx('coach-comment', failed && 'is-error')} aria-live="polite">
        {shown
          ? splitNotation(shown.text).map((part, index) =>
              part.notation ? (
                <b className="coach-notation" key={index}>
                  {part.text}
                </b>
              ) : (
                part.text
              ),
            )
          : message}
      </p>

      {/* The row keeps its height when empty, so the move list below never jumps. */}
      {enabled ? (
        <div className="coach-actions">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={cx('coach-action', `coach-action--${action.id}`, action.pressed && 'is-active')}
              aria-pressed={action.pressed}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
