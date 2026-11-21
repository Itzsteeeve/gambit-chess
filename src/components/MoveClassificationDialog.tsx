import { GraduationCap } from 'lucide-react'
import type { MoveRating } from '../game/moveRating'
import { MOVE_RATING_META } from '../game/moveRating'
import { Modal } from './Modal'
import { MoveRatingBadge } from './MoveRatingBadge'

interface MoveClassificationDialogProps {
  onClose: () => void
}

const ORDERED_RATINGS: MoveRating[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
]

const CHESS_COM_NAMES: Record<MoveRating, string> = {
  brilliant: 'Brilliant',
  great: 'Great Move',
  best: 'Best Move',
  excellent: 'Excellent',
  good: 'Good',
  book: 'Book Move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  miss: 'Miss (Missed Win)',
  blunder: 'Blunder',
}

export function MoveClassificationDialog({ onClose }: MoveClassificationDialogProps) {
  const positive = ORDERED_RATINGS.filter((r) => MOVE_RATING_META[r].category === 'positive')
  const negative = ORDERED_RATINGS.filter((r) => MOVE_RATING_META[r].category === 'negative')

  return (
    <Modal
      title="Hodnocení tahů (Chess.com)"
      description="Podrobný přehled všech 10 kategorií hodnocení tahů podle Chess.com Game Review."
      icon={<GraduationCap size={20} />}
      onClose={onClose}
      size="lg"
      className="ratings-guide-modal"
    >
      <div className="ratings-guide">
        <div className="ratings-guide-intro">
          <p>
            Všechny tvé tahy analyzuje <strong>Stockfish</strong> na plnou hloubku. Každý tah
            porovnává s ideální variantou a podle ztráty pravděpodobnosti výhry mu přiřadí
            jednu z 10 oficiálních kategorií:
          </p>
        </div>

        <div className="ratings-guide-section">
          <h4 className="ratings-guide-section-title ratings-guide-section-title--positive">
            Výborné a přesné tahy
          </h4>
          <div className="ratings-guide-list">
            {positive.map((rating) => {
              const meta = MOVE_RATING_META[rating]
              return (
                <div key={rating} className="ratings-guide-item">
                  <div className="ratings-guide-badge-col">
                    <MoveRatingBadge rating={rating} size="sm" />
                  </div>
                  <div className="ratings-guide-content">
                    <div className="ratings-guide-head">
                      <strong className="ratings-guide-name" style={{ color: meta.tone }}>
                        {meta.label}
                      </strong>
                      <span className="ratings-guide-en">{CHESS_COM_NAMES[rating]}</span>
                    </div>
                    <p className="ratings-guide-desc">{meta.description}</p>
                    <span className="ratings-guide-criteria">
                      <strong>Kdy se uděluje:</strong> {meta.criteria}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="ratings-guide-section">
          <h4 className="ratings-guide-section-title ratings-guide-section-title--negative">
            Nepřesnosti, chyby a přehlédnutí
          </h4>
          <div className="ratings-guide-list">
            {negative.map((rating) => {
              const meta = MOVE_RATING_META[rating]
              return (
                <div key={rating} className="ratings-guide-item">
                  <div className="ratings-guide-badge-col">
                    <MoveRatingBadge rating={rating} size="sm" />
                  </div>
                  <div className="ratings-guide-content">
                    <div className="ratings-guide-head">
                      <strong className="ratings-guide-name" style={{ color: meta.tone }}>
                        {meta.label}
                      </strong>
                      <span className="ratings-guide-en">{CHESS_COM_NAMES[rating]}</span>
                    </div>
                    <p className="ratings-guide-desc">{meta.description}</p>
                    <span className="ratings-guide-criteria">
                      <strong>Kdy se uděluje:</strong> {meta.criteria}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
