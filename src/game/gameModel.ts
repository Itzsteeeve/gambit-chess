import { Chess } from 'chess.js'
import type { Color, Move, PieceSymbol, Square } from 'chess.js'
import { opposite } from './constants'
import { applyMoveToPieces, createInitialPieces, findKing, piecesFromBoard } from './pieces'
import type { GamePiece } from './pieces'
import type { GameOutcome } from './notation'
import { pgnResult } from './notation'

export interface GameState {
  pieces: GamePiece[]
  fen: string
  turn: Color
  history: Move[]
  lastMove: Move | null
  undoneMove: Move | null
  outcome: GameOutcome | null
  isCheck: boolean
  checkSquare: Square | null
}

export interface MoveResult {
  ok: boolean
  move?: Move
  captured?: GamePiece | null
  capturedSquare?: Square | null
  outcome?: GameOutcome | null
}

interface PastEntry {
  before: GameState
  move: Move
}

interface RedoEntry {
  after: GameState
  move: Move
}

export function detectOutcome(game: Chess): GameOutcome | null {
  if (game.isCheckmate()) {
    return { winner: opposite(game.turn()), reason: 'checkmate' }
  }
  if (game.isStalemate()) {
    return { winner: null, reason: 'stalemate' }
  }
  if (game.isInsufficientMaterial()) {
    return { winner: null, reason: 'insufficient-material' }
  }
  if (game.isThreefoldRepetition()) {
    return { winner: null, reason: 'threefold-repetition' }
  }
  if (game.isDrawByFiftyMoves()) {
    return { winner: null, reason: 'fifty-move-rule' }
  }
  if (game.isDraw()) {
    return { winner: null, reason: 'draw' }
  }
  return null
}

/**
 * True when `color` has no material that could ever deliver mate: a lone king,
 * or king plus a single minor piece. Used for "timeout vs insufficient
 * material", which is a draw rather than a loss (FIDE 6.9).
 */
export function cannotMate(fen: string, color: Color): boolean {
  const board = fen.split(' ')[0]
  let minors = 0
  for (const char of board) {
    const lower = char.toLowerCase()
    if (!'pnbrq'.includes(lower)) continue
    const isWhite = char !== lower
    if ((color === 'w') !== isWhite) continue
    if (lower === 'p' || lower === 'r' || lower === 'q') return false
    minors += 1
  }
  return minors <= 1
}

/** Outcome when `loser` runs out of time. */
export function timeoutOutcome(fen: string, loser: Color): GameOutcome {
  const winner = opposite(loser)
  if (cannotMate(fen, winner)) return { winner: null, reason: 'timeout' }
  return { winner, reason: 'timeout' }
}

function buildState(game: Chess, pieces: GamePiece[]): GameState {
  const history = game.history({ verbose: true })
  const turn = game.turn()
  const isCheck = game.isCheck()
  const checkSquare = isCheck ? (findKing(pieces, turn)?.square ?? null) : null
  return {
    pieces,
    fen: game.fen(),
    turn,
    history,
    lastMove: history[history.length - 1] ?? null,
    undoneMove: null,
    outcome: detectOutcome(game),
    isCheck,
    checkSquare,
  }
}

export interface GameSetup {
  /** Custom start position (handicap). Adds [SetUp "1"] and [FEN] PGN headers. */
  fen?: string
  white?: string
  black?: string
  event?: string
}

function gameWithHeaders(setup: GameSetup = {}): Chess {
  // Throws on an invalid FEN; callers pass generated positions only.
  const game = setup.fen ? new Chess(setup.fen) : new Chess()
  const now = new Date()
  const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(
    now.getDate(),
  ).padStart(2, '0')}`
  game.setHeader('Event', setup.event ?? 'Gambit — lokální partie')
  game.setHeader('Site', 'Gambit · jedno zařízení')
  game.setHeader('Date', date)
  game.setHeader('White', setup.white ?? 'Bílý hráč')
  game.setHeader('Black', setup.black ?? 'Černý hráč')
  return game
}

/**
 * Framework-free game core: a chess.js instance plus undo/redo stacks of full
 * `GameState` snapshots. `useChessGame` mirrors `state` into React.
 */
export class GameModel {
  private game: Chess = gameWithHeaders()
  private past: PastEntry[] = []
  private future: RedoEntry[] = []
  private startFen: string = this.game.fen()
  state: GameState = buildState(this.game, createInitialPieces())

  get canUndo() {
    return !this.state.outcome && this.past.length > 0
  }

  get canRedo() {
    return !this.state.outcome && this.future.length > 0
  }

  move(from: Square, to: Square, promotion?: PieceSymbol): MoveResult {
    const current = this.state
    if (current.outcome) return { ok: false }

    let moveResult: Move
    try {
      moveResult = this.game.move({ from, to, promotion })
    } catch {
      return { ok: false }
    }

    const applied = applyMoveToPieces(current.pieces, moveResult)
    const next = buildState(this.game, applied.pieces)
    this.past.push({ before: current, move: moveResult })
    this.future = []
    this.state = next

    if (next.outcome) {
      this.game.setHeader('Result', pgnResult(next.outcome))
    }

    return {
      ok: true,
      move: moveResult,
      captured: applied.captured,
      capturedSquare: applied.capturedSquare,
      outcome: next.outcome,
    }
  }

  undo(): boolean {
    const current = this.state
    if (current.outcome) return false
    const entry = this.past.pop()
    if (!entry) return false

    this.game.undo()
    this.future.push({ after: current, move: entry.move })
    this.state = { ...entry.before, undoneMove: entry.move }
    return true
  }

  redo(): boolean {
    const current = this.state
    // A finished game (mate, resignation, timeout, agreed draw) is final.
    if (current.outcome) return false
    const entry = this.future.pop()
    if (!entry) return false

    let replayed: Move
    try {
      replayed = this.game.move({
        from: entry.move.from,
        to: entry.move.to,
        promotion: entry.move.promotion,
      })
    } catch {
      this.future = []
      return false
    }

    this.past.push({ before: current, move: replayed })
    this.state = { ...entry.after, undoneMove: null }
    return true
  }

  /** Starts a new game, optionally from a custom position (`setup.fen`). */
  reset(setup: GameSetup = {}) {
    this.game = gameWithHeaders(setup)
    this.past = []
    this.future = []
    this.startFen = this.game.fen()
    this.state = buildState(this.game, setup.fen ? piecesFromBoard(this.game) : createInitialPieces())
  }

  /** FEN the current game started from. */
  get startingFen() {
    return this.startFen
  }

  /**
   * Read-only position after `ply` moves (0 = start), for move review.
   * Returns null when the ply is out of range.
   */
  positionAt(ply: number): GameState | null {
    if (!Number.isInteger(ply) || ply < 0 || ply > this.past.length) return null
    if (ply === this.past.length) return this.state
    return { ...this.past[ply].before, undoneMove: null, outcome: null }
  }

  finish(outcome: GameOutcome): boolean {
    const current = this.state
    if (current.outcome) return false
    this.game.setHeader('Result', pgnResult(outcome))
    // Ending the game discards the redo branch.
    this.future = []
    this.state = { ...current, outcome }
    return true
  }

  resign(color: Color) {
    return this.finish({ winner: opposite(color), reason: 'resignation' })
  }

  agreeDraw() {
    return this.finish({ winner: null, reason: 'agreement' })
  }

  timeout(loser: Color) {
    return this.finish(timeoutOutcome(this.state.fen, loser))
  }

  getLegalMoves(square: Square): Move[] {
    if (this.state.outcome) return []
    try {
      return this.game.moves({ square, verbose: true })
    } catch {
      return []
    }
  }

  getPgn() {
    const pgn = this.game.pgn({ maxWidth: 80, newline: '\n' })
    return pgn || '*'
  }

  getFen() {
    return this.game.fen()
  }
}
