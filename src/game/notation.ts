import type { Color, Move, PieceSymbol } from 'chess.js'
import { PIECE_VALUES, PIECE_ORDER, opposite } from './constants'

export type GameReason =
  | 'checkmate'
  | 'resignation'
  | 'timeout'
  | 'stalemate'
  | 'insufficient-material'
  | 'threefold-repetition'
  | 'fifty-move-rule'
  | 'agreement'
  | 'draw'
  /** Imported game: the result comes from its record. */
  | 'record'
  /** Imported game whose record has no result. */
  | 'unfinished'
  /** Online game: a player stayed disconnected past the grace period. */
  | 'abandonment'

export interface GameOutcome {
  winner: Color | null
  reason: GameReason
}

export interface MovePair {
  number: number
  white?: Move
  black?: Move
}

export const REASON_LABELS: Record<GameReason, string> = {
  checkmate: 'Šach mat',
  resignation: 'Vzdání se',
  timeout: 'Vypršení času',
  stalemate: 'Pat',
  'insufficient-material': 'Nedostatečný materiál',
  'threefold-repetition': 'Trojí opakování pozice',
  'fifty-move-rule': 'Pravidlo padesáti tahů',
  agreement: 'Dohoda hráčů',
  draw: 'Remíza',
  record: 'Výsledek ze zápisu',
  unfinished: 'Zápis končí bez výsledku',
  abandonment: 'Soupeř opustil partii',
}

/** Full-move number of a FEN. */
export function fenMoveNumber(fen: string): number {
  return Number(fen.split(' ')[5]) || 1
}

/** "12. Nf3" / "12... Nf6", numbered from the position the move was played in. */
export function moveLabel(move: Move): string {
  return `${fenMoveNumber(move.before)}.${move.color === 'b' ? '..' : ''} ${move.san}`
}

/** Rows of the move list. A game from a custom position may open with Black. */
export function groupMoves(history: Move[]): MovePair[] {
  const pairs: MovePair[] = []
  for (const move of history) {
    const number = fenMoveNumber(move.before)
    let pair = pairs[pairs.length - 1]
    if (!pair || pair.number !== number) {
      pair = { number }
      pairs.push(pair)
    }
    if (move.color === 'w') pair.white = move
    else pair.black = move
  }
  return pairs
}

export function capturedPieces(history: Move[], byColor: Color): PieceSymbol[] {
  const captured = history
    .filter((move) => move.color === byColor && move.captured)
    .map((move) => move.captured as PieceSymbol)
  return captured.sort((a, b) => PIECE_ORDER.indexOf(a) - PIECE_ORDER.indexOf(b))
}

export function materialAdvantage(history: Move[]): { white: number; black: number } {
  const white = capturedPieces(history, 'w').reduce((sum, type) => sum + PIECE_VALUES[type], 0)
  const black = capturedPieces(history, 'b').reduce((sum, type) => sum + PIECE_VALUES[type], 0)
  return { white: white - black, black: black - white }
}

export function formatClock(ms: number): string {
  const safe = Math.max(0, ms)
  const totalSeconds = safe / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  if (safe < 10_000) {
    return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
  }
  return `${minutes}:${Math.floor(seconds).toString().padStart(2, '0')}`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes < 60) return `${minutes}:${rest.toString().padStart(2, '0')}`
  const hours = Math.floor(minutes / 60)
  return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${rest
    .toString()
    .padStart(2, '0')}`
}

export function resultScore(outcome: GameOutcome): string {
  if (outcome.reason === 'unfinished') return '*'
  if (!outcome.winner) return '½–½'
  return outcome.winner === 'w' ? '1–0' : '0–1'
}

/** ASCII result token mandated by the PGN specification. */
export function pgnResult(outcome: GameOutcome): string {
  if (outcome.reason === 'unfinished') return '*'
  if (!outcome.winner) return '1/2-1/2'
  return outcome.winner === 'w' ? '1-0' : '0-1'
}

export function resultHeadline(outcome: GameOutcome): string {
  if (outcome.reason === 'unfinished') return 'Nedohraná partie'
  if (!outcome.winner) return 'Remíza'
  return outcome.winner === 'w' ? 'Bílý vyhrává' : 'Černý vyhrává'
}

export function resultSubline(outcome: GameOutcome): string {
  return REASON_LABELS[outcome.reason]
}

export function checkedKing(history: Move[]): Color | null {
  const last = history[history.length - 1]
  if (!last) return null
  if (last.san.includes('+') || last.san.includes('#')) {
    return opposite(last.color)
  }
  return null
}

export function sanTone(san: string): 'check' | 'mate' | 'normal' {
  if (san.includes('#')) return 'mate'
  if (san.includes('+')) return 'check'
  return 'normal'
}
