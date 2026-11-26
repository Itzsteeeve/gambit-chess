import type { CSSProperties } from 'react'
import { CircleAlert, Dumbbell, Flag, Handshake, Info, Plus, RotateCcw, Trophy } from 'lucide-react'
import type { Color, Move } from 'chess.js'
import type { GameOutcome } from '../game/notation'
import { formatDuration, resultHeadline, resultScore, resultSubline } from '../game/notation'
import type { MoveRating, RatedMove } from '../game/moveRating'
import { MOVE_RATING_META } from '../game/moveRating'
import { MoveRatingBadge } from './MoveRatingBadge'
import { RATING_ORDER, RATING_SUMMARY_LABELS, summarizeSide } from '../game/review'
import { cx } from '../lib/cx'
import { Modal } from './Modal'
import { Confetti } from './Confetti'
import { EvalGraph } from './EvalGraph'
import type { GraphMarker } from './EvalGraph'
import { PieceArt } from './PieceArt'

interface GameOverDialogProps {
  outcome: GameOutcome
  history: Move[]
  durationSeconds: number
  ratings?: Record<string, RatedMove>
  /** The human's colour against Stockfish; null in a local two-player game. */
  humanColor: Color | null
  whiteName: string
  blackName: string
  series: Array<number | null>
  progress: { done: number; total: number }
  markers: GraphMarker[]
  /** True when at least one mistake exists for "Další chyba". */
  hasMistakes: boolean
  /** Absent for an imported game, which nobody here played. */
  onRematch?: () => void
  onNewGame: () => void
  onClose: () => void
  onReviewPly: (ply: number) => void
  onNextMistake: () => void
  onOpenRatings?: () => void
  /** The costliest mistakes with the coach's comment. */
  moments?: KeyMoment[]
  onOpenMoment: (index: number) => void
  /** The brilliant and great moves worth showing off. */
  highlights?: HighlightMove[]
  /** Name of the opening the game went through. */
  opening?: string | null
  /** Opens the training with the mistakes of this game; absent when there are none. */
  onTrain?: () => void
}

export interface HighlightMove {
  /** Index of the move in the history. */
  index: number
  label: string
  rating: MoveRating
}

export interface KeyMoment {
  /** Index of the move in the history. */
  index: number
  label: string
  rating: MoveRating
  text: string
}

function headlineFor(outcome: GameOutcome, humanColor: Color | null) {
  if (outcome.winner && humanColor) return outcome.winner === humanColor ? 'Vyhrál jsi' : 'Prohrál jsi'
  return resultHeadline(outcome)
}

function formatAccuracy(value: number | null) {
  return value === null ? '–' : `${value.toFixed(1).replace('.', ',')} %`
}

export function GameOverDialog({
  outcome,
  history,
  durationSeconds,
  ratings = {},
  humanColor,
  whiteName,
  blackName,
  series,
  progress,
  markers,
  hasMistakes,
  onRematch,
  onNewGame,
  onClose,
  onReviewPly,
  onNextMistake,
  onOpenRatings,
  moments = [],
  onOpenMoment,
  highlights = [],
  opening,
  onTrain,
}: GameOverDialogProps) {
  const winner = outcome.winner
  const imported = !onRematch
  const humanWon = Boolean(winner && (humanColor === null || winner === humanColor))
  const captures = history.filter((move) => move.captured).length
  const checks = history.filter((move) => move.san.includes('+') || move.san.includes('#')).length

  const white = summarizeSide(history, ratings, 'w')
  const black = summarizeSide(history, ratings, 'b')
  const anyRated = white.rated + black.rated > 0
  const analysing = progress.total > 1 && progress.done < progress.total

  const humanAccuracy = humanColor ? (humanColor === 'w' ? white : black).accuracy : null
  let accTone = 'var(--text)'
  if (humanAccuracy !== null) {
    if (humanAccuracy >= 80) accTone = 'var(--primary)'
    else if (humanAccuracy < 65) accTone = 'var(--amber)'
  }

  return (
    <Modal
      title={headlineFor(outcome, humanColor)}
      description={resultSubline(outcome)}
      icon={
        outcome.reason === 'unfinished' ? (
          <Info size={20} />
        ) : !winner ? (
          <Handshake size={20} />
        ) : humanWon ? (
          <Trophy size={20} />
        ) : (
          <Flag size={20} />
        )
      }
      onClose={onClose}
      size="md"
      className={cx('result-modal', !winner && 'is-draw', humanColor && winner && !humanWon && 'is-loss')}
      footer={(close) => (
        <>
          <button type="button" className="text-action" onClick={() => close(onNewGame)}>
            <Plus size={15} />
            Nová partie
          </button>
          <div className="footer-spacer" />
          <button
            type="button"
            className={cx('button', onRematch ? 'button--ghost' : 'button--primary')}
            onClick={() => close()}
            data-autofocus={onRematch ? undefined : true}
          >
            Prohlédnout desku
          </button>
          {onRematch ? (
            <button type="button" className="button button--primary" onClick={() => close(onRematch)} data-autofocus>
              <RotateCcw size={16} />
              Odveta
            </button>
          ) : null}
        </>
      )}
    >
      {humanWon && winner && !imported ? <Confetti /> : null}
      <div className="result-body">
        <div className="result-score" aria-label={`Skóre ${resultScore(outcome)}`}>
          <span className="result-score-side">{whiteName}</span>
          <strong>{resultScore(outcome)}</strong>
          <span className="result-score-side">{blackName}</span>
        </div>
        {opening ? <p className="result-opening">{opening}</p> : null}

        <div className="result-stage" aria-hidden="true">
          {winner ? (
            <div className="result-king">
              <PieceArt type="k" color={winner} />
            </div>
          ) : (
            <div className="result-draw-kings">
              <PieceArt type="k" color="w" />
              <PieceArt type="k" color="b" />
            </div>
          )}
        </div>

        <div className={cx('result-stats', imported && 'result-stats--three')}>
          <div>
            <span>Tahy</span>
            <strong>{history.length}</strong>
          </div>
          <div>
            <span>Zajetí</span>
            <strong>{captures}</strong>
          </div>
          <div>
            <span>Šachy</span>
            <strong>{checks}</strong>
          </div>
          {imported ? null : (
            <div>
              <span>Trvání</span>
              <strong>{formatDuration(durationSeconds)}</strong>
            </div>
          )}
        </div>

        {history.length > 0 ? (
          <section className="result-review" aria-labelledby="result-review-title">
            <div className="result-review-head">
              <h4 id="result-review-title">Rozbor</h4>
              {humanAccuracy !== null ? (
                <span className="result-review-acc" style={{ '--acc-tone': accTone } as CSSProperties}>
                  Tvoje přesnost <strong>{formatAccuracy(humanAccuracy)}</strong>
                </span>
              ) : null}
            </div>

            <EvalGraph
              series={series}
              currentPly={history.length}
              markers={markers}
              progress={progress}
              onSelectPly={(ply) => onReviewPly(ply)}
            />

            {anyRated ? (
              <table className="review-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Kategorie</span>
                    </th>
                    <th scope="col">
                      <span className="side-dot side-dot--white" aria-hidden="true" />
                      {whiteName}
                    </th>
                    <th scope="col">
                      <span className="side-dot side-dot--black" aria-hidden="true" />
                      {blackName}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="review-table-accuracy">
                    <th scope="row">Přesnost</th>
                    <td>{formatAccuracy(white.accuracy)}</td>
                    <td>{formatAccuracy(black.accuracy)}</td>
                  </tr>
                  {RATING_ORDER.map((rating, row) => {
                    const found = white.counts[rating] + black.counts[rating] > 0
                    return (
                      <tr
                        key={rating}
                        className={cx('review-table-row', `review-table-row--${rating}`, found && 'is-found')}
                        style={{ '--row': row, '--row-tone': MOVE_RATING_META[rating].tone } as CSSProperties}
                      >
                        <th scope="row">
                          {/* Keyed so the badge lands again when its first move is found. */}
                          <span key={String(found)} className={cx('review-table-badge', found && 'rating-fx')} aria-hidden="true">
                            <MoveRatingBadge rating={rating} size="xs" />
                          </span>
                          {RATING_SUMMARY_LABELS[rating]}
                        </th>
                        <td className={cx(white.counts[rating] === 0 && 'is-zero')}>{white.counts[rating]}</td>
                        <td className={cx(black.counts[rating] === 0 && 'is-zero')}>{black.counts[rating]}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p className="dialog-note">
                {analysing ? 'Stockfish právě prochází partii…' : 'Rozbor není k dispozici.'}
              </p>
            )}

            {highlights.length > 0 ? (
              <div className="key-moments">
                <h5>Brilantní a skvělé tahy</h5>
                <ul className="highlight-moves">
                  {highlights.map((move) => (
                    <li key={move.index}>
                      <button
                        type="button"
                        className={cx('highlight-move', `highlight-move--${move.rating}`)}
                        onClick={() => onReviewPly(move.index + 1)}
                      >
                        <span className="rating-fx">
                          <MoveRatingBadge rating={move.rating} size="sm" />
                        </span>
                        <strong>{move.label}</strong>
                        <span>{MOVE_RATING_META[move.rating].label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {moments.length > 0 ? (
              <div className="key-moments">
                <h5>Klíčové momenty</h5>
                <ul>
                  {moments.map((moment) => (
                    <li key={moment.index}>
                      <button type="button" className="key-moment" onClick={() => onOpenMoment(moment.index)}>
                        <MoveRatingBadge rating={moment.rating} size="xs" />
                        <span className="key-moment-copy">
                          <strong>{moment.label}</strong>
                          <span>{moment.text}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="result-review-actions">
              {onTrain ? (
                <button type="button" className="result-review-guide-btn" onClick={onTrain}>
                  <Dumbbell size={14} />
                  <span>Procvičit chyby</span>
                </button>
              ) : null}
              <button
                type="button"
                className="result-review-guide-btn"
                onClick={onNextMistake}
                disabled={!hasMistakes}
              >
                <CircleAlert size={14} />
                <span>{hasMistakes ? 'Další chyba' : 'Žádné chyby'}</span>
              </button>
              {onOpenRatings ? (
                <button type="button" className="result-review-guide-btn" onClick={onOpenRatings}>
                  <Info size={14} />
                  <span>Jak funguje hodnocení tahů?</span>
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </Modal>
  )
}
