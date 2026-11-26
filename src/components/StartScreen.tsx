import type { Color } from 'chess.js'
import { Dumbbell, Globe, Import, Play, SlidersHorizontal, Users } from 'lucide-react'
import type { BoardThemeId } from '../game/constants'
import { getDisplayPosition } from '../game/pieces'
import type { GamePiece } from '../game/pieces'
import { cx } from '../lib/cx'
import { PieceArt } from './PieceArt'

interface StartScreenProps {
  /** A game is under way (not finished): the primary action continues it. */
  inProgress: boolean
  /** One-line summary of the settings "Hrát" will use, e.g. "Stockfish · Elo 1600 · Bílé · Bez hodin". */
  settingsSummary: string
  progressSummary?: string
  pieces: GamePiece[]
  orientation: Color
  boardTheme: BoardThemeId
  onPlay: () => void
  onContinue: () => void
  onCustomize: () => void
  onLocal: () => void
  onImport: () => void
  onTrain: () => void
  onOnline: () => void
  /** An online game is running in the background. */
  onlineInGame?: boolean
  /** Unsolved training puzzles. */
  openPuzzles: number
}

const SQUARES = Array.from({ length: 64 }, (_, index) => index)

/** Quiet home: a still board preview and three ways to start. */
export function StartScreen({
  inProgress,
  settingsSummary,
  progressSummary,
  pieces,
  orientation,
  boardTheme,
  onPlay,
  onContinue,
  onCustomize,
  onLocal,
  onImport,
  onTrain,
  onOnline,
  onlineInGame = false,
  openPuzzles,
}: StartScreenProps) {
  return (
    <section className="start-screen" aria-labelledby="start-title">
      <div className="start-preview board-frame" data-theme={boardTheme} aria-hidden="true">
        <div className="start-preview-grid">
          {SQUARES.map((index) => {
            const row = Math.floor(index / 8)
            const col = index % 8
            return (
              <span
                key={index}
                className={cx('start-preview-square', (row + col) % 2 === 0 ? 'square--light' : 'square--dark')}
              />
            )
          })}
        </div>
        <div className="start-preview-pieces">
          {pieces.map((piece) => {
            const position = getDisplayPosition(piece.square, orientation)
            return (
              <span
                key={piece.id}
                className="start-preview-piece"
                style={{ left: `${position.col * 12.5}%`, top: `${position.row * 12.5}%` }}
              >
                <PieceArt type={piece.type} color={piece.color} />
              </span>
            )
          })}
        </div>
      </div>

      <div className="start-card">
        <h1 id="start-title" className="start-title">
          {inProgress ? 'Partie čeká' : 'Zahraj si partii'}
        </h1>
        <p className="start-summary">{inProgress && progressSummary ? progressSummary : settingsSummary}</p>

        <div className="start-actions">
          {inProgress ? (
            <button type="button" className="button button--primary start-primary" onClick={onContinue} autoFocus>
              <Play size={18} />
              Pokračovat
            </button>
          ) : (
            <button type="button" className="button button--primary start-primary" onClick={onPlay} autoFocus>
              <Play size={18} />
              Hrát
            </button>
          )}
          {inProgress ? (
            <button type="button" className="button button--ghost" onClick={onPlay}>
              Nová partie se stejným nastavením
            </button>
          ) : null}
          <button type="button" className="button button--ghost start-online" onClick={onOnline}>
            <Globe size={17} />
            {onlineInGame ? 'Zpět k online partii' : 'Hrát online'}
          </button>
          <div className="start-secondary">
            <button type="button" className="text-action" onClick={onCustomize}>
              <SlidersHorizontal size={15} />
              Přizpůsobit
            </button>
            <button type="button" className="text-action" onClick={onLocal}>
              <Users size={15} />
              Dva hráči lokálně
            </button>
            <button type="button" className="text-action" onClick={onImport}>
              <Import size={15} />
              Importovat partii
            </button>
            <button type="button" className="text-action" onClick={onTrain}>
              <Dumbbell size={15} />
              Trénink chyb{openPuzzles > 0 ? ` (${openPuzzles})` : ''}
            </button>
          </div>
        </div>
        <p className="start-foot">
          <kbd>Enter</kbd> {inProgress ? 'pokračuje' : 'začne hrát'} · <kbd>N</kbd> nová partie
        </p>
      </div>
    </section>
  )
}
