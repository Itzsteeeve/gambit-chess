import { Check } from 'lucide-react'
import type { PieceSymbol } from 'chess.js'
import { BOARD_THEMES, PIECE_LABELS, PIECE_VALUES } from '../game/constants'
import type { BoardThemeId } from '../game/constants'
import { PIECE_SETS, usePieceSet } from '../game/pieceSets'
import { cx } from '../lib/cx'
import { PieceArt } from './PieceArt'

const TYPES: PieceSymbol[] = ['k', 'q', 'r', 'b', 'n', 'p']
const SAMPLE: PieceSymbol[] = ['k', 'q', 'n', 'p']

interface PieceGalleryProps {
  boardTheme: BoardThemeId
  onBoardThemeChange: (theme: BoardThemeId) => void
}

/** The "Sada" tab: switch the piece set and the board right here. */
export function PieceGallery({ boardTheme, onBoardThemeChange }: PieceGalleryProps) {
  const [pieceSet, setPieceSet] = usePieceSet()
  const info = PIECE_SETS.find((set) => set.id === pieceSet) ?? PIECE_SETS[0]

  return (
    <div className="gallery-tab">
      <h4 className="gallery-title">Figury</h4>
      <div className="set-picker" role="radiogroup" aria-label="Sada figur">
        {PIECE_SETS.map((set) => (
          <label key={set.id} className={cx('set-option', pieceSet === set.id && 'is-selected')}>
            <input
              type="radio"
              name="gallery-piece-set"
              value={set.id}
              checked={pieceSet === set.id}
              onChange={() => setPieceSet(set.id)}
              className="sr-only"
            />
            <span className="set-option-board" data-theme={boardTheme} aria-hidden="true">
              {SAMPLE.map((type, index) => (
                <span key={type} className={index % 2 === 0 ? 'square--light' : 'square--dark'}>
                  <PieceArt type={type} color={index % 2 === 0 ? 'b' : 'w'} pieceSet={set.id} />
                </span>
              ))}
            </span>
            <span className="set-option-meta">
              <strong>{set.name}</strong>
              <span>{set.author}</span>
            </span>
            <span className="set-option-check" aria-hidden="true">
              <Check size={14} strokeWidth={3} />
            </span>
          </label>
        ))}
      </div>

      <h4 className="gallery-title">Deska</h4>
      <div className="board-picker" role="radiogroup" aria-label="Téma šachovnice">
        {BOARD_THEMES.map((theme) => (
          <label key={theme.id} className={cx('board-option', boardTheme === theme.id && 'is-selected')}>
            <input
              type="radio"
              name="gallery-board-theme"
              value={theme.id}
              checked={boardTheme === theme.id}
              onChange={() => onBoardThemeChange(theme.id)}
              className="sr-only"
            />
            <span className="board-option-swatch" data-theme={theme.id} aria-hidden="true">
              <span className="square--light" />
              <span className="square--dark" />
              <span className="square--dark" />
              <span className="square--light" />
            </span>
            <span>{theme.name}</span>
          </label>
        ))}
      </div>

      <h4 className="gallery-title">Hodnota figur</h4>
      <ul className="piece-values">
        {TYPES.map((type) => (
          <li key={type}>
            <PieceArt type={type} color="w" />
            <span>{PIECE_LABELS[type]}</span>
            <strong>{type === 'k' ? '∞' : PIECE_VALUES[type]}</strong>
          </li>
        ))}
      </ul>

      <p className="gallery-credit">
        {info.description} Autor: {info.author}, licence {info.license}.
      </p>
    </div>
  )
}
