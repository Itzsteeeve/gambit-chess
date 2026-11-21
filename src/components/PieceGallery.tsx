import type { PieceSymbol } from 'chess.js'
import { PIECE_LABELS, PIECE_VALUES } from '../game/constants'
import { PIECE_SETS, usePieceSet } from '../game/pieceSets'
import { PieceArt } from './PieceArt'

const TYPES: PieceSymbol[] = ['k', 'q', 'r', 'b', 'n', 'p']

export function PieceGallery() {
  const [pieceSet] = usePieceSet()
  const info = PIECE_SETS.find((set) => set.id === pieceSet) ?? PIECE_SETS[0]
  const isOwn = info.id === 'ivory'
  return (
    <div className="gallery-tab">
      <div className="gallery-head">
        <div>
          <span className="eyebrow">{isOwn ? 'Vlastní sada' : 'Sada figur'}</span>
          <h3>{info.name}</h3>
          <p>{info.description} Ostré v každém rozlišení.</p>
        </div>
        <span className="gallery-badge">12 figur</span>
      </div>

      <div className="piece-grid">
        {TYPES.map((type) => (
          <article className="piece-card" key={type}>
            <div className="piece-card-stage" aria-hidden="true">
              <span className="piece-card-halo" />
              <PieceArt type={type} color="w" className="piece-card-art piece-card-art--w" />
              <PieceArt type={type} color="b" className="piece-card-art piece-card-art--b" />
            </div>
            <div className="piece-card-meta">
              <strong>{PIECE_LABELS[type]}</strong>
              <span>{type === 'k' ? 'hodnota ∞' : `hodnota ${PIECE_VALUES[type]}`}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="gallery-note">
        <span className="gallery-note-line" aria-hidden="true" />
        <p>
          {isOwn
            ? 'Bílá slonovina, černý onyx. Stejná základna, stejné světlo — jen jiný materiál.'
            : `Autor: ${info.author} · licence ${info.license}.`}
        </p>
      </div>
    </div>
  )
}
