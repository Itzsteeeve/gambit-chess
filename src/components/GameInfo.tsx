import { Copy } from 'lucide-react'
import type { Color } from 'chess.js'
import type { GameOutcome } from '../game/notation'
import { colorLabelForOrientation } from '../lib/format'

interface GameInfoProps {
  fen: string
  moveCount: number
  outcome: GameOutcome | null
  turn: Color
  isCheck: boolean
  timeControlLabel: string
  boardThemeName: string
  orientation: Color
  modeLabel?: string
  engineLabel?: string
  onCopyFen: () => void
}

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['N'], label: 'Nová partie' },
  { keys: ['F'], label: 'Otočit desku' },
  { keys: ['←', '→'], label: 'Tah zpět / vpřed (při prohlížení: krok)' },
  { keys: ['Home', 'End'], label: 'Prohlížení: začátek / zpět do hry' },
  { keys: ['M'], label: 'Zvuk' },
  { keys: ['Esc'], label: 'Zrušit výběr / předtah / prohlížení' },
  { keys: ['Enter'], label: 'Potvrdit tah' },
]

const MOUSE_TIPS: Array<{ keys: string[]; label: string }> = [
  { keys: ['Pravé tl.'], label: 'Značka na poli, tažením šipka' },
  { keys: ['Shift', 'Ctrl', 'Alt'], label: 'Červená / oranžová / modrá šipka' },
  { keys: ['Tah na tahu soupeře'], label: 'Předtah (pravé tl. ruší)' },
]

const CREDITS: Array<{ name: string; detail: string }> = [
  { name: 'Stockfish 19', detail: 'GPL-3.0' },
  { name: 'chess.js', detail: 'BSD-2-Clause' },
  { name: 'Figury Chessnut — Alexis Luengas', detail: 'Apache-2.0' },
  { name: 'Figury Terracotta — RhosGFX', detail: 'CC0 1.0' },
  { name: 'Figury Ivory & Onyx', detail: 'vlastní dílo' },
  { name: 'Ikony Lucide', detail: 'ISC' },
  { name: 'Písma Inter a Space Grotesk', detail: 'OFL-1.1' },
  { name: 'React', detail: 'MIT' },
]

export function GameInfo({
  fen,
  moveCount,
  outcome,
  turn,
  isCheck,
  timeControlLabel,
  boardThemeName,
  orientation,
  modeLabel,
  engineLabel,
  onCopyFen,
}: GameInfoProps) {
  const side = turn === 'w' ? 'bílý' : 'černý'
  const status = outcome ? 'Partie skončila' : isCheck ? `Šach, na tahu ${side}` : `Na tahu ${side}`

  return (
    <div className="info-tab">
      <div className="info-hero">
        <h3>{modeLabel ?? 'Partie proti Stockfishi'}</h3>
        <p>{engineLabel ?? 'Lokální partie'}</p>
      </div>

      <dl className="info-list">
        <div>
          <dt>Tempo</dt>
          <dd>{timeControlLabel}</dd>
        </div>
        <div>
          <dt>Tahy</dt>
          <dd>{moveCount === 0 ? 'Zatím žádné' : moveCount}</dd>
        </div>
        <div>
          <dt>Stav</dt>
          <dd className={isCheck && !outcome ? 'is-alert' : undefined}>{status}</dd>
        </div>
        <div>
          <dt>Orientace</dt>
          <dd>{colorLabelForOrientation(orientation)}</dd>
        </div>
        <div>
          <dt>Deska</dt>
          <dd>{boardThemeName}</dd>
        </div>
      </dl>

      <div className="fen-head">
        <h4 className="info-section-title">Pozice (FEN)</h4>
        <button type="button" className="fen-copy" onClick={onCopyFen} aria-label="Kopírovat FEN">
          <Copy size={13} aria-hidden="true" />
          Kopírovat
        </button>
      </div>
      <code className="fen-code">{fen}</code>

      <h4 className="info-section-title">Klávesové zkratky</h4>
      <ul className="shortcut-list">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.label}>
            <span>{shortcut.label}</span>
            <span className="shortcut-keys">
              {shortcut.keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>

      <h4 className="info-section-title">Myš</h4>
      <ul className="shortcut-list">
        {MOUSE_TIPS.map((tip) => (
          <li key={tip.label}>
            <span>{tip.label}</span>
            <span className="shortcut-keys">
              {tip.keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>

      <h4 className="info-section-title">O aplikaci / Licence</h4>
      <ul className="shortcut-list credit-list">
        {CREDITS.map((credit) => (
          <li key={credit.name}>
            <span>{credit.name}</span>
            <span className="credit-license">{credit.detail}</span>
          </li>
        ))}
      </ul>
      <p className="info-foot">Gambit běží celý v prohlížeči, bez serveru. Podrobnosti v THIRD_PARTY.md.</p>
    </div>
  )
}
