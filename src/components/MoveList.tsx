import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Color, Move } from 'chess.js'
import { Copy, FileBraces, FileText, Swords } from 'lucide-react'
import { PIECE_LABELS, COLOR_LABELS } from '../game/constants'
import type { RatedMove } from '../game/moveRating'
import { MOVE_RATING_META } from '../game/moveRating'
import type { GameOutcome } from '../game/notation'
import { groupMoves, resultHeadline, REASON_LABELS, sanTone } from '../game/notation'
import { cx } from '../lib/cx'
import { MoveRatingBadge } from './MoveRatingBadge'

interface MoveListProps {
  history: Move[]
  turn: Color
  outcome: GameOutcome | null
  isCheck: boolean
  ratings?: Record<string, RatedMove>
  coach?: ReactNode
  onCopyPgn: () => void
  onCopyFen: () => void
  /** Optional column header labels (default: Bílý / Černý). */
  whiteLabel?: string
  blackLabel?: string
  /** Ply shown on the board (history.length when live). */
  viewPly?: number
  /** Click on a move: show the position after it (review). */
  onSelectPly?: (ply: number) => void
  /** Compact eval graph, rendered above the list. */
  graph?: ReactNode
  /** Status text override (e.g. while reviewing). */
  reviewStatus?: string | null
}

export function MoveList({
  history,
  turn,
  outcome,
  isCheck,
  ratings = {},
  coach,
  onCopyPgn,
  onCopyFen,
  whiteLabel = 'Bílý',
  blackLabel = 'Černý',
  viewPly,
  onSelectPly,
  graph,
  reviewStatus,
}: MoveListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pairs = groupMoves(history)
  const shownPly = viewPly ?? history.length
  const reviewing = shownPly !== history.length
  // A game may start with Black to move only from a custom FEN; ours always start with White.
  const plyOf = (move: Move) => history.indexOf(move) + 1

  useEffect(() => {
    const container = scrollRef.current
    if (!container || reviewing) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({ top: container.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }, [history.length, reviewing])

  useEffect(() => {
    if (!reviewing) return
    const cell = scrollRef.current?.querySelector<HTMLElement>('.move-cell.is-current')
    cell?.scrollIntoView({ block: 'nearest' })
  }, [reviewing, shownPly])

  let statusText: string
  if (reviewStatus) {
    statusText = reviewStatus
  } else if (outcome) {
    statusText = `${resultHeadline(outcome)} · ${REASON_LABELS[outcome.reason]}`
  } else if (isCheck) {
    statusText = `Šach! Na tahu ${COLOR_LABELS[turn].toLowerCase()}`
  } else {
    statusText = `Na tahu ${COLOR_LABELS[turn].toLowerCase()}`
  }

  return (
    <div className="move-list-tab">
      <div className="panel-status">
        <div className="panel-status-copy">
          <span
            className={cx(
              'status-dot',
              isCheck && 'status-dot--check',
              outcome && 'status-dot--over',
              reviewStatus && 'status-dot--review',
            )}
            aria-hidden="true"
          />
          <span>{statusText}</span>
        </div>
      </div>

      {coach}
      {graph}

      <div className="move-list" ref={scrollRef}>
        {pairs.length === 0 ? (
          <div className="move-empty">
            <div className="move-empty-art" aria-hidden="true">
              <Swords size={24} strokeWidth={1.75} />
            </div>
            <h3>Deska je připravená</h3>
            <p>Bílý otevírá partii. Vyber figuru a táhni — nebo klikni na výchozí a cílové pole.</p>
            <div className="move-empty-hint">
              <span>1. e4</span>
              <span>1. d4</span>
              <span>1. Nf3</span>
            </div>
          </div>
        ) : (
          <div className="moves-table-wrap">
            <div className="moves-table-header" aria-hidden="true">
              <span className="col-header-num">Tah</span>
              <span className="col-header-side col-header-white">
                <span className="side-dot side-dot--white" />
                <span>{whiteLabel}</span>
              </span>
              <span className="col-header-side col-header-black">
                <span className="side-dot side-dot--black" />
                <span>{blackLabel}</span>
              </span>
            </div>
            <div className="moves-table" role="list" aria-label="Seznam tahů">
              {pairs.map((pair) => (
                <div className="move-row" key={pair.number} role="listitem">
                  <span className="move-number">{pair.number}.</span>
                  <MoveCell
                    move={pair.white}
                    side="white"
                    isCurrent={Boolean(pair.white) && plyOf(pair.white!) === shownPly}
                    rating={pair.white ? ratings[pair.white.after] : undefined}
                    onSelect={onSelectPly && pair.white ? () => onSelectPly(plyOf(pair.white!)) : undefined}
                  />
                  {pair.black ? (
                    <MoveCell
                      move={pair.black}
                      side="black"
                      isCurrent={plyOf(pair.black) === shownPly}
                      rating={ratings[pair.black.after]}
                      onSelect={onSelectPly ? () => onSelectPly(plyOf(pair.black!)) : undefined}
                    />
                  ) : (
                    <span className="move-cell move-cell--black move-cell--pending" aria-label="Čeká na tah černého">
                      <span className="pending-dots">…</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="move-list-footer">
        <button type="button" className="copy-button" onClick={onCopyPgn} disabled={history.length === 0}>
          <FileText size={15} />
          <span>PGN</span>
          <Copy size={13} className="copy-icon" />
        </button>
        <button type="button" className="copy-button" onClick={onCopyFen}>
          <FileBraces size={15} />
          <span>FEN</span>
          <Copy size={13} className="copy-icon" />
        </button>
      </div>
    </div>
  )
}

function MoveCell({
  move,
  side,
  isCurrent,
  rating,
  onSelect,
}: {
  move?: Move
  side: 'white' | 'black'
  isCurrent: boolean
  rating?: RatedMove
  onSelect?: () => void
}) {
  if (!move) {
    return <span className={cx('move-cell', `move-cell--${side}`, 'move-cell--empty')} aria-hidden="true" />
  }
  const tone = sanTone(move.san)
  const ratingMeta = rating ? MOVE_RATING_META[rating.rating] : null
  const isBest = rating?.rating === 'best'
  const isBrilliant = rating?.rating === 'brilliant'
  const isBlunder = rating?.rating === 'blunder'

  const Tag = onSelect ? 'button' : 'span'
  return (
    <Tag
      type={onSelect ? 'button' : undefined}
      onClick={onSelect}
      className={cx(
        'move-cell',
        onSelect && 'move-cell--button',
        `move-cell--${side}`,
        isCurrent && 'is-current',
        tone !== 'normal' && `move-cell--${tone}`,
        rating && 'has-rating',
        rating && `move-cell--rating-${rating.rating}`,
        isBest && 'move-cell--best',
        isBrilliant && 'move-cell--brilliant',
        isBlunder && 'move-cell--blunder',
      )}
      title={`${PIECE_LABELS[move.piece]} ${move.from}–${move.to}${
        move.captured ? `, bere ${PIECE_LABELS[move.captured]}` : ''
      }${ratingMeta ? ` · ${ratingMeta.label}: ${ratingMeta.description}` : ''}`}
      aria-current={isCurrent ? 'step' : undefined}
    >
      <span className="move-cell-badge-slot">
        {rating ? <MoveRatingBadge rating={rating.rating} size="xs" /> : null}
      </span>
      <span className="move-san">{move.san}</span>
    </Tag>
  )
}
