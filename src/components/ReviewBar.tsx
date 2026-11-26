import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CornerDownLeft,
  Swords,
} from 'lucide-react'
import type { MoveRating } from '../game/moveRating'
import { MOVE_RATING_META } from '../game/moveRating'
import { IconButton } from './IconButton'
import { MoveRatingBadge } from './MoveRatingBadge'

interface ReviewBarProps {
  ply: number
  total: number
  /** e.g. "12… Nf6"; null at the start position. */
  moveLabel: string | null
  rating?: MoveRating | null
  /** Engine's best move in the shown position, as SAN. */
  bestSan?: string | null
  gameOver: boolean
  onNavigate: (ply: number) => void
  onExit: () => void
  onNextMistake?: () => void
  /** Starts a new game from the shown position; absent when it cannot be played. */
  onPlayFrom?: () => void
}

/** Replaces the board toolbar while a past position is shown. */
export function ReviewBar({
  ply,
  total,
  moveLabel,
  rating,
  bestSan,
  gameOver,
  onNavigate,
  onExit,
  onNextMistake,
  onPlayFrom,
}: ReviewBarProps) {
  return (
    <div className="board-toolbar review-bar" role="toolbar" aria-label="Procházení partie">
      <div className="toolbar-group">
        <IconButton label="Na začátek (Home)" onClick={() => onNavigate(0)} disabled={ply === 0} tooltipPosition="top">
          <ChevronFirst size={18} />
        </IconButton>
        <IconButton label="Předchozí tah (←)" onClick={() => onNavigate(ply - 1)} disabled={ply === 0} tooltipPosition="top">
          <ChevronLeft size={18} />
        </IconButton>
        <IconButton
          label="Další tah (→)"
          onClick={() => onNavigate(ply + 1)}
          disabled={ply >= total}
          tooltipPosition="top"
        >
          <ChevronRight size={18} />
        </IconButton>
        <IconButton label="Na konec (End)" onClick={() => onNavigate(total)} disabled={ply >= total} tooltipPosition="top">
          <ChevronLast size={18} />
        </IconButton>
      </div>

      <div className="review-bar-status" aria-live="polite">
        {rating ? <MoveRatingBadge rating={rating} size="xs" /> : null}
        <span className="review-bar-move">{moveLabel ?? 'Výchozí pozice'}</span>
        {rating ? <span className="review-bar-rating">{MOVE_RATING_META[rating].label}</span> : null}
        {bestSan ? <span className="review-bar-best">Nejlepší: {bestSan}</span> : null}
      </div>

      {onNextMistake ? (
        <button type="button" className="toolbar-text-button" onClick={onNextMistake} aria-label="Další chyba">
          <CircleAlert size={17} />
          <span>Další chyba</span>
        </button>
      ) : null}
      {onPlayFrom ? (
        <button type="button" className="toolbar-text-button" onClick={onPlayFrom} aria-label="Hrát odsud">
          <Swords size={17} />
          <span>Hrát odsud</span>
        </button>
      ) : null}
      <button
        type="button"
        className="toolbar-result-button review-bar-exit"
        onClick={onExit}
        aria-label={gameOver ? 'Zpět na konec partie' : 'Zpět do hry'}
      >
        <CornerDownLeft size={16} />
        <span>{gameOver ? 'Konec partie' : 'Zpět do hry'}</span>
      </button>
    </div>
  )
}
