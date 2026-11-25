import { ChevronDown, Copy } from 'lucide-react'
import type { Color } from 'chess.js'
import type { ReactNode } from 'react'
import type { GameOutcome } from '../game/notation'

interface GameInfoProps {
  fen: string
  moveCount: number
  outcome: GameOutcome | null
  turn: Color
  isCheck: boolean
  timeControlLabel: string
  orientation: Color
  modeLabel?: string
  engineLabel?: string
  onCopyFen: () => void
}

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['N'], label: 'Nová partie' },
  { keys: ['F'], label: 'Otočit desku' },
  { keys: ['M'], label: 'Zvuk' },
  { keys: ['←', '→'], label: 'Zpět / vpřed' },
  { keys: ['Home', 'End'], label: 'Začátek / konec' },
  { keys: ['Esc'], label: 'Zrušit' },
  { keys: ['Enter'], label: 'Potvrdit tah' },
  { keys: ['Pravé tl.'], label: 'Značka, tažením šipka' },
  { keys: ['Shift', 'Ctrl', 'Alt'], label: 'Barva šipky' },
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

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="info-fold">
      <summary>
        {title}
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      {children}
    </details>
  )
}

export function GameInfo({
  fen,
  moveCount,
  outcome,
  turn,
  isCheck,
  timeControlLabel,
  orientation,
  modeLabel,
  engineLabel,
  onCopyFen,
}: GameInfoProps) {
  const side = turn === 'w' ? 'Bílý' : 'Černý'
  const facts = [
    { label: 'Tempo', value: timeControlLabel },
    { label: 'Půltahy', value: String(moveCount) },
    {
      label: 'Na tahu',
      value: outcome ? 'Konec partie' : isCheck ? `${side} (šach)` : side,
      alert: isCheck && !outcome,
    },
    { label: 'Dole hraje', value: orientation === 'w' ? 'Bílý' : 'Černý' },
  ]

  return (
    <div className="info-tab">
      <div className="info-hero">
        <h3>{modeLabel ?? 'Partie proti Stockfishi'}</h3>
        <p>{engineLabel ?? 'Lokální partie'}</p>
      </div>

      <dl className="info-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd className={fact.alert ? 'is-alert' : undefined}>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <button type="button" className="info-fen" onClick={onCopyFen} aria-label="Kopírovat FEN" title={fen}>
        <span>FEN</span>
        <code>{fen}</code>
        <Copy size={14} aria-hidden="true" />
      </button>

      <Fold title="Klávesy a myš">
        <ul className="shortcut-grid">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.label}>
              <span className="shortcut-keys">
                {shortcut.keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </span>
              <span>{shortcut.label}</span>
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title="Licence">
        <ul className="shortcut-list credit-list">
          {CREDITS.map((credit) => (
            <li key={credit.name}>
              <span>{credit.name}</span>
              <span className="credit-license">{credit.detail}</span>
            </li>
          ))}
        </ul>
        <p className="info-foot">Gambit běží celý v prohlížeči, bez serveru. Podrobnosti v THIRD_PARTY.md.</p>
      </Fold>
    </div>
  )
}
