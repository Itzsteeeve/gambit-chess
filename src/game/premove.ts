import type { Color, PieceSymbol, Square } from 'chess.js'

/**
 * Premove destinations by piece geometry only, ignoring occupancy (like
 * Lichess): the opponent's reply can open lines or put a piece on a square
 * we want to take, so anything the piece could ever reach is allowed. The
 * move is checked for legality only when it is executed.
 */

interface BoardPiece {
  type: PieceSymbol
  color: Color
}

/** Parses the placement field of a FEN into a square → piece map. */
export function parsePlacement(fen: string): Map<Square, BoardPiece> {
  const map = new Map<Square, BoardPiece>()
  const ranks = fen.split(' ')[0].split('/')
  ranks.forEach((rank, rowIndex) => {
    let file = 0
    for (const char of rank) {
      if (/\d/.test(char)) {
        file += Number(char)
        continue
      }
      const square = `${String.fromCharCode(97 + file)}${8 - rowIndex}` as Square
      const lower = char.toLowerCase() as PieceSymbol
      map.set(square, { type: lower, color: char === lower ? 'b' : 'w' })
      file += 1
    }
  })
  return map
}

function toSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null
  return `${String.fromCharCode(97 + file)}${rank + 1}` as Square
}

const KNIGHT = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
]
const KING = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
]
const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]
const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
]

export function premoveTargets(fen: string, from: Square): Square[] {
  const board = parsePlacement(fen)
  const piece = board.get(from)
  if (!piece) return []
  const file = from.charCodeAt(0) - 97
  const rank = Number(from[1]) - 1
  const out = new Set<Square>()
  const add = (f: number, r: number) => {
    const square = toSquare(f, r)
    if (square) out.add(square)
  }

  switch (piece.type) {
    case 'p': {
      const dir = piece.color === 'w' ? 1 : -1
      add(file, rank + dir)
      if ((piece.color === 'w' && rank === 1) || (piece.color === 'b' && rank === 6)) add(file, rank + 2 * dir)
      add(file - 1, rank + dir)
      add(file + 1, rank + dir)
      break
    }
    case 'n':
      for (const [df, dr] of KNIGHT) add(file + df, rank + dr)
      break
    case 'k': {
      for (const [df, dr] of KING) add(file + df, rank + dr)
      const home = piece.color === 'w' ? 0 : 7
      if (file === 4 && rank === home) {
        const rookAt = (f: number) => {
          const rook = board.get(toSquare(f, home) as Square)
          return rook?.type === 'r' && rook.color === piece.color
        }
        if (rookAt(7)) add(6, home)
        if (rookAt(0)) add(2, home)
      }
      break
    }
    default: {
      const dirs =
        piece.type === 'r' ? ROOK_DIRS : piece.type === 'b' ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS]
      for (const [df, dr] of dirs) {
        for (let step = 1; step < 8; step += 1) add(file + df * step, rank + dr * step)
      }
    }
  }

  out.delete(from)
  return [...out]
}

/** A pawn premove to the last rank auto-promotes to a queen. */
export function premovePromotion(fen: string, from: Square, to: Square): PieceSymbol | undefined {
  const piece = parsePlacement(fen).get(from)
  if (piece?.type !== 'p') return undefined
  const lastRank = piece.color === 'w' ? '8' : '1'
  return to[1] === lastRank ? 'q' : undefined
}
