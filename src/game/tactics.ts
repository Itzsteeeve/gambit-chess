/**
 * Board facts the coach builds its explanations from. Everything here is pure
 * and engine-free: it works on a position and, optionally, an engine line.
 */
import { Chess } from 'chess.js'
import type { Color, Move, PieceSymbol, Square } from 'chess.js'
import { PIECE_VALUES, opposite } from './constants'
import { parseUciMove } from './engineLevels'
import { materialBalance } from './moveRating'
import { parsePlacement } from './premove'
import { fenTurn } from './review'

export interface PieceRef {
  type: PieceSymbol
  square: Square
}

export interface HangingPiece extends PieceRef {
  /** Square of the cheapest piece that can take it. */
  by: Square
  /** Material (in pawns) the capture sequence wins. */
  gain: number
  defended: boolean
}

/** Plays a UCI move on `chess`; null when it is not legal there. */
export function applyUci(chess: Chess, uci: string | null | undefined): Move | null {
  const parsed = uci ? parseUciMove(uci) : null
  if (!parsed) return null
  try {
    return chess.move(parsed)
  } catch {
    return null
  }
}

/** The legal prefix of an engine line played from `fen`. */
export function replayLine(fen: string, pv: string[], limit = 10): Move[] {
  const chess = new Chess(fen)
  const moves: Move[] = []
  for (const uci of pv.slice(0, limit)) {
    const move = applyUci(chess, uci)
    if (!move) break
    moves.push(move)
  }
  return moves
}

/** Ordering value: the king recaptures last. */
function attackerWeight(type: PieceSymbol) {
  return type === 'k' ? 100 : PIECE_VALUES[type]
}

/** The cheapest legal capture on `square` for the side to move. */
function cheapestCapture(chess: Chess, square: Square): Move | null {
  // Only the attackers' moves are generated: verbose move lists are expensive.
  const attackers = chess
    .attackers(square, chess.turn())
    .sort((a, b) => attackerWeight(chess.get(a)!.type) - attackerWeight(chess.get(b)!.type))
  for (const from of attackers) {
    const capture = chess
      .moves({ square: from, verbose: true })
      .find((move) => move.to === square && move.captured && (!move.promotion || move.promotion === 'q'))
    if (capture) return capture
  }
  return null
}

/**
 * Static exchange evaluation: material (in pawns) the side to move wins by
 * capturing on `square`, assuming both sides recapture with their cheapest
 * piece and may stop whenever that is better. Only legal moves are used, so
 * pinned defenders do not count.
 */
export function exchangeGain(chess: Chess, square: Square): number {
  const capture = cheapestCapture(chess, square)
  if (!capture?.captured) return 0
  chess.move({ from: capture.from, to: capture.to, promotion: capture.promotion })
  const promoted = capture.promotion ? PIECE_VALUES[capture.promotion] - PIECE_VALUES.p : 0
  const gain = PIECE_VALUES[capture.captured] + promoted - exchangeGain(chess, square)
  chess.undo()
  return Math.max(0, gain)
}

/** The same position with `color` to move (en passant rights are dropped). */
function withTurn(fen: string, color: Color): string {
  const parts = fen.split(' ')
  if (parts[1] === color) return fen
  parts[1] = color
  parts[3] = '-'
  return parts.join(' ')
}

/**
 * Pieces of `victim` the other side could profitably take if it were to move.
 * Returns nothing while `victim` is in check: the check comes first then.
 */
export function hangingPieces(fen: string, victim: Color): HangingPiece[] {
  const attacker = opposite(victim)
  let chess: Chess
  try {
    chess = new Chess(fen)
    if (fenTurn(fen) === victim) {
      if (chess.isCheck()) return []
      chess = new Chess(withTurn(fen, attacker))
    }
  } catch {
    return []
  }

  const result: HangingPiece[] = []
  for (const [square, piece] of parsePlacement(chess.fen())) {
    if (piece.color !== victim || piece.type === 'k') continue
    if (chess.attackers(square, attacker).length === 0) continue
    const capture = cheapestCapture(chess, square)
    if (!capture) continue
    const gain = exchangeGain(chess, square)
    if (gain < 1) continue
    result.push({
      square,
      type: piece.type,
      by: capture.from,
      gain,
      defended: chess.attackers(square, victim).length > 0,
    })
  }
  return result.sort((a, b) => b.gain - a.gain)
}

/**
 * Pieces forked by `move`: at least two targets that are the king, more
 * valuable than the attacker, or undefended, while the attacker itself cannot
 * be profitably taken.
 */
export function forkTargets(move: Move): PieceRef[] {
  const chess = new Chess(move.after)
  const attacker = move.color
  const victim = opposite(attacker)
  const piece = move.promotion ?? move.piece
  if (piece === 'k') return []

  const targets: PieceRef[] = []
  for (const [square, target] of parsePlacement(move.after)) {
    if (target.color !== victim || target.type === 'p') continue
    if (!chess.attackers(square, attacker).includes(move.to)) continue
    const valuable = target.type === 'k' || PIECE_VALUES[target.type] > PIECE_VALUES[piece]
    if (valuable || chess.attackers(square, victim).length === 0) {
      targets.push({ type: target.type, square })
    }
  }
  if (targets.length < 2) return []
  if (exchangeGain(chess, move.to) > 0) return []
  return targets.sort((a, b) => attackerWeight(b.type) - attackerWeight(a.type))
}

export interface LineOutcome {
  /** Net material change for the mover, in pawns. */
  swing: number
  /** The mover's pieces that fell and were not traded for an equal one. */
  lost: PieceSymbol[]
  /** Opponent pieces taken in return (same rule). */
  gained: PieceSymbol[]
  /** The line up to the point where it was judged. */
  moves: Move[]
}

const isLoud = (move: Move | undefined) => Boolean(move && (move.captured || move.promotion))

/** Removes pairs of equally valuable pieces: those were simply traded. */
function cancelTrades(lost: PieceSymbol[], gained: PieceSymbol[]) {
  const remaining = [...gained]
  const net = lost.filter((type) => {
    // Same type first, then any piece of the same value (bishop for knight).
    let index = remaining.indexOf(type)
    if (index === -1) index = remaining.findIndex((other) => PIECE_VALUES[other] === PIECE_VALUES[type])
    if (index === -1) return true
    remaining.splice(index, 1)
    return false
  })
  const byValue = (a: PieceSymbol, b: PieceSymbol) => PIECE_VALUES[b] - PIECE_VALUES[a]
  return { lost: net.sort(byValue), gained: remaining.sort(byValue) }
}

/**
 * What `move` does to the material balance once the engine's reply line has
 * quietened down (no capture in the next two plies). A line that stops in the
 * middle of an exchange is finished with a static exchange evaluation.
 * Returns null without a reply line: nothing can be proved then.
 */
export function lineOutcome(move: Move, replyPv: string[]): LineOutcome | null {
  const reply = replayLine(move.after, replyPv)
  const gameOver = reply.length === 0 && new Chess(move.after).isGameOver()
  if (reply.length === 0 && !gameOver) return null

  let end = reply.length
  for (let index = 1; index < reply.length; index += 1) {
    if (!isLoud(reply[index]) && !isLoud(reply[index + 1])) {
      end = index
      break
    }
  }
  const moves = reply.slice(0, end)
  const last = moves[moves.length - 1] ?? move
  const mover = move.color

  let swing = materialBalance(last.after, mover) - materialBalance(move.before, mover)
  const lost: PieceSymbol[] = []
  const gained: PieceSymbol[] = []
  for (const played of [move, ...moves]) {
    if (!played.captured) continue
    ;(played.color === mover ? gained : lost).push(played.captured)
  }

  // The line ran out right after a capture: let the side to move recapture.
  if (end === reply.length && last.captured && moves.length > 0) {
    const chess = new Chess(last.after)
    const gain = exchangeGain(chess, last.to)
    if (gain > 0) {
      const taken = chess.get(last.to)?.type
      const forMover = chess.turn() === mover
      swing += forMover ? gain : -gain
      if (taken) (forMover ? gained : lost).push(taken)
    }
  }

  return { swing, ...cancelTrades(lost, gained), moves }
}
