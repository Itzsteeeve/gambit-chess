import type { Color, PieceSymbol } from 'chess.js'
import { Bot } from 'lucide-react'
import { opposite } from '../game/constants'
import { formatClock } from '../game/notation'
import { cx } from '../lib/cx'
import { PieceArt } from './PieceArt'

interface CapturedPiecesProps {
  captured: PieceSymbol[]
  playerColor: Color
  advantage: number
}

export function CapturedPieces({ captured, playerColor, advantage }: CapturedPiecesProps) {
  const capturedColor = opposite(playerColor)
  return (
    <div
      className={cx('captured-pieces', captured.length === 0 && 'is-empty')}
      data-captured={capturedColor}
      aria-label={
        captured.length === 0
          ? 'Zatím žádné zajaté figury'
          : `Zajaté figury: ${captured.length}`
      }
    >
      <span className="captured-row">
        {captured.map((type, index) => (
          <span className="captured-piece" key={`${type}-${index}`} aria-hidden="true">
            <PieceArt type={type} color={capturedColor} />
          </span>
        ))}
      </span>
      {advantage > 0 ? <span className="material-advantage">+{advantage}</span> : null}
    </div>
  )
}

interface PlayerStripProps {
  color: Color
  active: boolean
  inCheck: boolean
  captured: PieceSymbol[]
  advantage: number
  winner: boolean
  gameOver: boolean
  showClock: boolean
  clockRunning?: boolean
  clockMs?: number
  lowTime?: boolean
  criticalTime?: boolean
  paused?: boolean
  name?: string
  rating?: string
  thinking?: boolean
  isEngine?: boolean
}

export function PlayerStrip({
  color,
  active,
  inCheck,
  captured,
  advantage,
  winner,
  gameOver,
  showClock,
  clockRunning,
  clockMs,
  lowTime,
  criticalTime,
  paused,
  name: nameProp,
  rating,
  thinking = false,
  isEngine = false,
}: PlayerStripProps) {
  const name = nameProp ?? (color === 'w' ? 'Bílý hráč' : 'Černý hráč')
  const sideLabel = color === 'w' ? 'Bílý' : 'Černý'

  let status: string
  let statusTone: 'active' | 'idle' | 'check' | 'winner' | 'over' = 'idle'
  if (winner) {
    status = 'Vítěz'
    statusTone = 'winner'
  } else if (gameOver) {
    status = 'Konec'
    statusTone = 'over'
  } else if (active && thinking) {
    status = 'Přemýšlí'
    statusTone = 'active'
  } else if (active) {
    status = inCheck ? 'Šach!' : 'Na tahu'
    statusTone = inCheck ? 'check' : 'active'
  } else {
    status = 'Čeká na tah'
  }

  return (
    <div
      className={cx(
        'player-strip',
        active && !gameOver && 'is-active',
        winner && 'is-winner',
        criticalTime && active && 'is-critical',
        isEngine && 'is-engine',
      )}
      data-color={color}
      aria-label={`${name}${rating ? `, ${rating}` : ''}, ${status}`}
    >
      <div className="player-avatar" aria-hidden="true">
        <PieceArt type="k" color={color} />
        {isEngine ? (
          <span className="player-engine-mark">
            <Bot size={10} strokeWidth={2.4} />
          </span>
        ) : null}
      </div>
      <div className="player-main">
        <div className="player-heading">
          <span className="player-name">{name}</span>
          <span className="player-meta">{rating ?? sideLabel}</span>
        </div>
        <CapturedPieces captured={captured} playerColor={color} advantage={advantage} />
      </div>
      <div className="player-end">
        {showClock && typeof clockMs === 'number' ? (
          <div
            className={cx(
              'player-clock',
              lowTime && 'is-low',
              criticalTime && 'is-critical',
              clockRunning && 'is-running',
            )}
            aria-label={`Hodiny ${name}: ${formatClock(clockMs)}${paused ? ', pauza' : ''}`}
          >
            {formatClock(clockMs)}
            {paused ? <span className="clock-paused">pauza</span> : null}
          </div>
        ) : null}
        {statusTone !== 'idle' ? (
          <div className={cx('player-status', `player-status--${statusTone}`)}>
            {active && thinking && !gameOver ? (
              <span className="thinking-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            ) : null}
            {status}
          </div>
        ) : null}
      </div>
    </div>
  )
}
