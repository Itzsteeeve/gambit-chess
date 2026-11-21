import type { CSSProperties } from 'react'
import { MOVE_RATING_META } from '../game/moveRating'
import type { MoveRating } from '../game/moveRating'
import { cx } from '../lib/cx'

interface MoveRatingBadgeProps {
  rating: MoveRating
  size?: 'xs' | 'board' | 'sm' | 'lg'
  className?: string
  withLabel?: boolean
}

function RatingIcon({ rating, size }: { rating: MoveRating; size: 'xs' | 'board' | 'sm' | 'lg' }) {
  const iconPx = size === 'board' ? 18 : size === 'xs' ? 11 : size === 'sm' ? 14 : 20

  switch (rating) {
    case 'best':
      // Solid Star
      return (
        <svg
          width={iconPx}
          height={iconPx}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )

    case 'excellent':
    case 'good':
      // Clean, crisp checkmark
      return (
        <svg
          width={iconPx}
          height={iconPx}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )

    case 'book':
      // Clear Spread Open Book (unmistakable theory symbol)
      return (
        <svg
          width={iconPx}
          height={iconPx}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      )

    case 'miss':
      // Sharp X
      return (
        <svg
          width={iconPx}
          height={iconPx}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )

    case 'brilliant':
      return <span className="rating-glyph rating-glyph--double-excl">!!</span>

    case 'great':
      return <span className="rating-glyph rating-glyph--excl">!</span>

    case 'inaccuracy':
      return <span className="rating-glyph rating-glyph--inacc">?!</span>

    case 'mistake':
      return <span className="rating-glyph rating-glyph--mistake">?</span>

    case 'blunder':
      return <span className="rating-glyph rating-glyph--double-q">??</span>
  }
}

export function MoveRatingBadge({
  rating,
  size = 'sm',
  className,
  withLabel = false,
}: MoveRatingBadgeProps) {
  const meta = MOVE_RATING_META[rating]
  return (
    <span
      className={cx(
        'rating-badge',
        `rating-badge--${size}`,
        `rating-badge--${rating}`,
        rating === 'inaccuracy' && 'rating-badge--dark-glyph',
        className,
      )}
      style={{ '--rating-tone': meta.tone } as CSSProperties}
      title={`${meta.label} — ${meta.description}`}
    >
      <span className="rating-badge-mark" aria-hidden="true">
        <RatingIcon rating={rating} size={size} />
      </span>
      {withLabel ? <span className="rating-badge-label">{meta.label}</span> : null}
      {!withLabel ? <span className="sr-only">{meta.label}</span> : null}
    </span>
  )
}
