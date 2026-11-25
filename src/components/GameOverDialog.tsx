import type { CSSProperties } from 'react'
import { CircleAlert, Flag, Handshake, Info, Plus, RotateCcw, Trophy } from 'lucide-react'
import type { Color, Move } from 'chess.js'
import type { GameOutcome } from '../game/notation'
import { formatDuration, resultHeadline, resultScore, resultSubline } from '../game/notation'
import type { MoveRating, RatedMove } from '../game/moveRating'
import { MoveRatingBadge } from './MoveRatingBadge'
import { REVIEW_BUCKETS, REVIEW_BUCKET_LABELS, summarizeSide } from '../game/review'
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
  onRematch: () => void
  onNewGame: () => void
  onClose: () => void
  onReviewPly: (ply: number) => void
  onNextMistake: () => void
  onOpenRatings?: () => void
  /** The costliest mistakes with the coach's comment. */
  moments?: KeyMoment[]
  onOpenMoment: (index: number) => void
}

export interface KeyMoment {
  /** Index of the move in the history. */
  index: number
  label: string
  rating: MoveRating
  text: string
}

function headlineFor(outcome: GameOutcome, humanColor: Color | null) {
  if (!outcome.winner) return 'Remíza'
  if (humanColor) return outcome.winner === humanColor ? 'Vyhrál jsi' : 'Prohrál jsi'
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
}: GameOverDialogProps) {
  const winner = outcome.winner
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
      icon={!winner ? <Handshake size={20} /> : humanWon ? <Trophy size={20} /> : <Flag size={20} />}
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
          <button type="button" className="button button--ghost" onClick={() => close()}>
            Prohlédnout desku
          </button>
          <button type="button" className="button button--primary" onClick={() => close(onRematch)} data-autofocus>
            <RotateCcw size={16} />
            Odveta
          </button>
        </>
      )}
    >
      {humanWon && winner ? <Confetti /> : null}
      <div className="result-body">
        <div className="result-score" aria-label={`Skóre ${resultScore(outcome)}`}>
          <span className="result-score-side">{whiteName}</span>
          <strong>{resultScore(outcome)}</strong>
          <span className="result-score-side">{blackName}</span>
        </div>

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

        <div className="result-stats">
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
          <div>
            <span>Trvání</span>
            <strong>{formatDuration(durationSeconds)}</strong>
          </div>
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
                  {REVIEW_BUCKETS.map((bucket) => (
                    <tr key={bucket} className={`review-table-row review-table-row--${bucket}`}>
                      <th scope="row">
                        <span className="review-dot" aria-hidden="true" />
                        {REVIEW_BUCKET_LABELS[bucket]}
                      </th>
                      <td className={cx(white.counts[bucket] === 0 && 'is-zero')}>{white.counts[bucket]}</td>
                      <td className={cx(black.counts[bucket] === 0 && 'is-zero')}>{black.counts[bucket]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="dialog-note">
                {analysing ? 'Stockfish právě prochází partii…' : 'Rozbor není k dispozici.'}
              </p>
            )}

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
