import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Color, Move, PieceSymbol, Square } from 'chess.js'
import { BarChart3, Flag, Handshake, LogOut, RefreshCw, Repeat2 } from 'lucide-react'
import { COLOR_LABELS, getTimeControl, opposite } from '../game/constants'
import type { BoardThemeId } from '../game/constants'
import type { ImportedGame } from '../game/importGame'
import { materialBalance } from '../game/moveRating'
import { REASON_LABELS, capturedPieces } from '../game/notation'
import type { GameOutcome } from '../game/notation'
import type { SoundName } from '../game/soundEngine'
import { useChessGame } from '../game/useChessGame'
import { copyText } from '../lib/clipboard'
import { cx } from '../lib/cx'
import type { RoomView } from '../online/protocol'
import type { Online } from '../online/useOnline'
import { Board } from './Board'
import type { PromotionState } from './Board'
import { ConfirmDialog } from './ConfirmDialog'
import { EvalBar } from './EvalBar'
import { MoveList } from './MoveList'
import { PlayerStrip } from './PlayerStrip'

interface OnlineGameProps {
  online: Online
  room: RoomView
  boardTheme: BoardThemeId
  showCoordinates: boolean
  animations: boolean
  onSound: (name: SoundName) => void
  onToast: (message: string, tone?: 'default' | 'error') => void
  onAnalyze: (record: ImportedGame, color: Color) => void
}

function sameMove(local: Move, server: { from: string; to: string; promotion?: string }) {
  return local.from === server.from && local.to === server.to && (local.promotion ?? undefined) === (server.promotion ?? undefined)
}

function soundOf(move: Move, isCheck: boolean): SoundName {
  if (isCheck) return 'check'
  if (move.promotion) return 'promote'
  if (move.isKingsideCastle() || move.isQueensideCastle()) return 'castle'
  return move.captured ? 'capture' : 'move'
}

function personalHeadline(outcome: GameOutcome | null, me: Color | null): string {
  if (!outcome) return 'Partie zrušena'
  if (outcome.winner === null) return 'Remíza'
  if (me === null) return `${COLOR_LABELS[outcome.winner]} vyhrál`
  return outcome.winner === me ? 'Vyhrál jsi' : 'Prohrál jsi'
}

function pgnDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`
}

/** A live online game. The server is authoritative; the board mirrors its moves. */
export function OnlineGame({ online, room, boardTheme, showCoordinates, animations, onSound, onToast, onAnalyze }: OnlineGameProps) {
  const { playerId, send, serverNow, status } = online
  const server = room.game!
  const game = useChessGame()
  const me = room.players.find((player) => player.id === playerId) ?? null
  const myColor: Color = me?.color ?? 'w'
  const opponent = room.players.find((player) => player.id !== playerId) ?? null
  const [flipped, setFlipped] = useState(false)
  const [selected, setSelected] = useState<Square | null>(null)
  const [promotion, setPromotion] = useState<PromotionState | null>(null)
  const [confirmResign, setConfirmResign] = useState(false)
  const roundRef = useRef<number | null>(null)
  const announcedRef = useRef<string | null>(null)

  // Mirror the server's move list onto the local board.
  const { reset, move: applyMove, finish } = game
  useLayoutEffect(() => {
    const local = game.history
    const remote = server.moves
    const diverged =
      roundRef.current !== room.round ||
      local.length > remote.length ||
      local.some((move, index) => !sameMove(move, remote[index]))
    let fresh: Move | null = null
    let freshCheck = false
    if (diverged) {
      reset({ fen: server.startFen })
      for (const next of remote) applyMove(next.from, next.to, next.promotion)
      roundRef.current = room.round
      setSelected(null)
      setPromotion(null)
    } else {
      for (const next of remote.slice(local.length)) {
        const result = applyMove(next.from, next.to, next.promotion)
        if (result.ok && result.move) {
          fresh = result.move
          freshCheck = result.move.san.includes('+') || result.move.san.includes('#')
        }
      }
    }
    if (server.outcome) finish(server.outcome)
    if (fresh && fresh.color !== myColor) onSound(soundOf(fresh, freshCheck))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- driven by server state only
  }, [room.round, server.moves, server.outcome])

  // Announce results and starts once.
  useEffect(() => {
    const key = `${room.round}:${room.status}`
    if (announcedRef.current === key) return
    const first = announcedRef.current === null
    announcedRef.current = key
    if (room.status === 'playing' && server.moves.length === 0) {
      onToast(`Hraješ za ${myColor === 'w' ? 'bílé' : 'černé'}`)
      onSound('ui')
    } else if (room.status === 'finished' && !first) {
      onSound(server.outcome?.winner === myColor ? 'end-win' : 'end-draw')
    }
  }, [myColor, onSound, onToast, room.round, room.status, server.moves.length, server.outcome])

  // Clock and countdown display.
  const live = room.status === 'playing'
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => setTick((value) => value + 1), 100)
    return () => window.clearInterval(timer)
  }, [live])
  const now = serverNow()
  const elapsed = server.clockRunning ? Math.max(0, now - server.clockAt) : 0
  const clockMs = (color: Color) => Math.max(0, server.clock[color] - (color === server.turn ? elapsed : 0))
  const hasClock = getTimeControl(room.timeControlId).minutes > 0

  const myTurn = live && game.turn === myColor && !game.outcome
  const interactive = myTurn && !promotion && status === 'online'

  const play = (from: Square, to: Square, promotionType?: PieceSymbol) => {
    const ply = game.moveCount
    const result = game.move(from, to, promotionType)
    setSelected(null)
    setPromotion(null)
    if (!result.ok || !result.move) {
      onSound('illegal')
      return
    }
    onSound(soundOf(result.move, result.move.san.includes('+') || result.move.san.includes('#')))
    send({ type: 'move', move: { from, to, ...(promotionType ? { promotion: promotionType } : {}) }, ply })
  }

  const tryMove = (from: Square, to: Square) => {
    if (!interactive) return
    const candidates = game.getLegalMoves(from).filter((move) => move.to === to)
    if (candidates.length === 0) {
      onSound('illegal')
      return
    }
    const options = candidates.flatMap((move) => (move.promotion ? [move.promotion] : []))
    if (options.length > 0) {
      setSelected(from)
      setPromotion({ from, to, color: myColor, options })
      return
    }
    play(from, to)
  }

  const tap = (square: Square, wasSelected: boolean) => {
    if (!interactive) return
    if (wasSelected) {
      setSelected(null)
      return
    }
    if (selected && game.getLegalMoves(selected).some((move) => move.to === square)) {
      tryMove(selected, square)
      return
    }
    const own = game.pieces.some((piece) => piece.square === square && piece.color === myColor)
    setSelected(own ? square : null)
  }

  const legalTargets =
    selected && interactive
      ? game.getLegalMoves(selected).map((move) => ({ square: move.to, capture: Boolean(move.captured) }))
      : []

  const orientation = flipped ? opposite(myColor) : myColor
  const topColor = opposite(orientation)
  const balance = materialBalance(game.fen, 'w')
  const playerOf = (color: Color) => room.players.find((player) => player.color === color) ?? null

  const renderPlayer = (color: Color) => {
    const player = playerOf(color)
    const away = player ? !player.connected : true
    return (
      <PlayerStrip
        color={color}
        active={game.turn === color && !game.outcome && live}
        inCheck={game.isCheck && game.turn === color}
        captured={capturedPieces(game.history, color)}
        advantage={color === 'w' ? balance : -balance}
        winner={game.outcome?.winner === color}
        gameOver={!live}
        showClock={hasClock}
        clockRunning={server.clockRunning && server.turn === color}
        clockMs={clockMs(color)}
        lowTime={hasClock && clockMs(color) < 20_000}
        criticalTime={hasClock && clockMs(color) < 10_000}
        name={player ? `${player.nick}${player.id === playerId ? ' (ty)' : ''}` : 'Soupeř odešel'}
        rating={away ? 'Odpojen' : COLOR_LABELS[color]}
      />
    )
  }

  const countdown = (until: number | null) => (until === null ? null : Math.max(0, Math.ceil((until - now) / 1000)))
  const abortIn = live ? countdown(server.abortAt) : null
  const abandonIn = live ? countdown(room.abandonAt) : null
  const opponentAway = opponent ? !opponent.connected : false

  const iWantRematch = playerId ? room.rematch.includes(playerId) : false
  const theyWantRematch = opponent ? room.rematch.includes(opponent.id) : false

  const analyze = () => {
    const white = playerOf('w')?.nick ?? 'Bílý'
    const black = playerOf('b')?.nick ?? 'Černý'
    const control = getTimeControl(room.timeControlId)
    onAnalyze(
      {
        moves: server.moves.map(({ from, to, promotion: piece }) => ({ from, to, ...(piece ? { promotion: piece } : {}) })),
        headers: {
          Event: 'Gambit online',
          Site: window.location.host,
          Date: pgnDate(new Date()),
          White: white,
          Black: black,
          ...(control.minutes > 0 ? { TimeControl: `${control.minutes * 60}+${control.increment}` } : {}),
        },
        white,
        black,
        whiteElo: null,
        blackElo: null,
        outcome: server.outcome ?? { winner: null, reason: 'unfinished' },
        hasMoreGames: false,
        online: true,
      },
      myColor,
    )
  }

  let statusLine: string
  if (live) {
    if (abandonIn !== null && opponentAway) statusLine = `Soupeř se odpojil. Pokud se do ${abandonIn} s nevrátí, vyhráváš.`
    else if (abandonIn !== null) statusLine = `Spojení se přerušilo. Vrať se do ${abandonIn} s.`
    else if (abortIn !== null)
      statusLine = myTurn
        ? `Zahraj první tah do ${abortIn} s, jinak se partie zruší.`
        : `Soupeř má na první tah ${abortIn} s.`
    else statusLine = myTurn ? 'Jsi na tahu.' : `Na tahu je ${opponent?.nick ?? 'soupeř'}.`
  } else if (room.status === 'aborted') {
    statusLine = 'Nikdo netáhl včas, partie se nepočítá.'
  } else {
    statusLine = server.outcome ? REASON_LABELS[server.outcome.reason] : ''
  }

  const copy = async (text: string, label: string) => {
    const ok = await copyText(text)
    onToast(ok ? `${label} zkopírován` : 'Kopírování se nepovedlo', ok ? 'default' : 'error')
  }

  return (
    <main className="app-main">
      <section className="play-stage" aria-label="Online partie">
        <div className="board-column">
          {renderPlayer(topColor)}
          <div className="board-area">
            {/* Stockfish stays off during online games; the bar only keeps the layout. */}
            <EvalBar score={null} orientation={orientation} showAnalysis={false} />
            <Board
              pieces={game.pieces}
              turn={game.turn}
              orientation={orientation}
              selected={selected}
              legalTargets={legalTargets}
              lastMove={game.lastMove}
              checkSquare={game.checkSquare}
              outcome={game.outcome}
              promotion={promotion}
              locked={!interactive}
              captureFx={null}
              moveCount={game.moveCount}
              gameNumber={game.gameNumber}
              boardTheme={boardTheme}
              showCoordinates={showCoordinates}
              animations={animations}
              movableColor={myColor}
              onSelect={(square) => interactive && setSelected(square)}
              onTap={tap}
              onDrop={tryMove}
              onClearSelection={() => setSelected(null)}
              onPromote={(type) => promotion && play(promotion.from, promotion.to, type)}
              onCancelPromotion={() => {
                setPromotion(null)
                setSelected(null)
              }}
            />
          </div>
          {renderPlayer(orientation)}
          <div className="board-toolbar" role="toolbar" aria-label="Ovládání online partie">
            {live ? (
              <>
                <button
                  type="button"
                  className="toolbar-text-button"
                  onClick={() => send({ type: 'draw-offer' })}
                  disabled={server.drawOffer === myColor || server.moves.length < 2}
                >
                  <Handshake size={17} />
                  <span>{server.drawOffer === myColor ? 'Remíza nabídnuta' : 'Nabídnout remízu'}</span>
                </button>
                <button
                  type="button"
                  className="toolbar-text-button"
                  onClick={() => (server.moves.length < 2 ? send({ type: 'leave' }) : setConfirmResign(true))}
                >
                  <Flag size={17} />
                  <span>{server.moves.length < 2 ? 'Zrušit partii' : 'Vzdát'}</span>
                </button>
              </>
            ) : null}
            <button type="button" className="toolbar-text-button" onClick={() => setFlipped((value) => !value)} aria-label="Otočit desku">
              <RefreshCw size={17} />
              <span>Otočit</span>
            </button>
          </div>
        </div>
      </section>

      <aside className="side-panel" aria-label="Online partie">
        <div className="side-panel-inner online-panel">
          <header className="training-head">
            <h1>Online partie</h1>
            <span>
              {getTimeControl(room.timeControlId).label}
              {room.round > 1 ? ` · ${room.round}. partie` : ''}
            </span>
          </header>

          {live ? (
            <p className={cx('online-status', abandonIn !== null && 'is-warning')} aria-live="polite">
              {statusLine}
            </p>
          ) : (
            <div className="online-result" aria-live="polite">
              <strong className="start-title">{personalHeadline(server.outcome, me?.color ?? null)}</strong>
              <span>{statusLine}</span>
              <div className="online-result-actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => send({ type: 'rematch' })}
                  disabled={iWantRematch || !opponent}
                >
                  <Repeat2 size={16} />
                  {!opponent ? 'Soupeř odešel' : iWantRematch ? 'Čeká se na soupeře…' : theyWantRematch ? 'Přijmout odvetu' : 'Odveta'}
                </button>
                {server.moves.length > 0 && room.status === 'finished' ? (
                  <button type="button" className="button button--ghost" onClick={analyze}>
                    <BarChart3 size={16} />
                    Rozbor partie
                  </button>
                ) : null}
                <button type="button" className="text-action" onClick={() => send({ type: 'leave' })}>
                  <LogOut size={14} />
                  Zpět do lobby
                </button>
              </div>
              {theyWantRematch && !iWantRematch ? <p className="online-help">{opponent?.nick} chce odvetu, barvy se prohodí.</p> : null}
            </div>
          )}

          {live && server.drawOffer && server.drawOffer !== myColor ? (
            <div className="online-offer" role="alert">
              <span>
                <Handshake size={16} aria-hidden="true" /> {opponent?.nick ?? 'Soupeř'} nabízí remízu
              </span>
              <div>
                <button type="button" className="button button--primary" onClick={() => send({ type: 'draw-accept' })}>
                  Přijmout
                </button>
                <button type="button" className="button button--ghost" onClick={() => send({ type: 'draw-decline' })}>
                  Odmítnout
                </button>
              </div>
            </div>
          ) : null}

          <MoveList
            history={game.history}
            turn={game.turn}
            outcome={game.outcome}
            isCheck={game.isCheck}
            whiteLabel={playerOf('w')?.nick}
            blackLabel={playerOf('b')?.nick}
            onCopyPgn={() => void copy(game.getPgn(), 'PGN')}
            onCopyFen={() => void copy(game.getFen(), 'FEN')}
          />
        </div>
      </aside>

      {confirmResign ? (
        <ConfirmDialog
          title="Vzdát partii?"
          description="Soupeř tím vyhraje. Tuto akci nelze vrátit."
          confirmLabel="Vzdát"
          tone="danger"
          icon={<Flag size={20} />}
          onConfirm={() => {
            // Modal runs the confirm action instead of onClose, so close it here too.
            setConfirmResign(false)
            send({ type: 'resign' })
          }}
          onClose={() => setConfirmResign(false)}
        />
      ) : null}
    </main>
  )
}
