import type { Color, Move, PieceSymbol, Square } from 'chess.js'
import { Chess } from 'chess.js'

export interface GamePiece {
  id: string
  type: PieceSymbol
  color: Color
  square: Square
}

export interface AppliedMove {
  pieces: GamePiece[]
  captured: GamePiece | null
  capturedSquare: Square | null
  movedId: string | null
}

export function createInitialPieces(): GamePiece[] {
  const game = new Chess()
  return piecesFromBoard(game)
}

export function piecesFromBoard(game: Chess): GamePiece[] {
  const pieces: GamePiece[] = []
  for (const rank of game.board()) {
    for (const cell of rank) {
      if (!cell) continue
      pieces.push({
        id: `${cell.color}${cell.type}-${cell.square}`,
        type: cell.type,
        color: cell.color,
        square: cell.square,
      })
    }
  }
  return pieces
}

/**
 * Applies a verbose chess.js move to our stable piece list.
 * Stable ids are what let CSS transition a piece between squares.
 */
export function applyMoveToPieces(pieces: GamePiece[], move: Move): AppliedMove {
  const isEnPassant = move.isEnPassant()
  const capturedSquare: Square | null = isEnPassant
    ? (`${move.to[0]}${move.from[1]}` as Square)
    : move.captured
      ? move.to
      : null

  const captured = capturedSquare
    ? (pieces.find((piece) => piece.square === capturedSquare) ?? null)
    : null

  const moved = pieces.find((piece) => piece.square === move.from)
  if (!moved) {
    return { pieces, captured, capturedSquare, movedId: null }
  }

  let next = pieces
    .filter((piece) => piece.id !== captured?.id)
    .map((piece) => {
      if (piece.id === moved.id) {
        return {
          ...piece,
          square: move.to,
          type: move.promotion ?? piece.type,
        }
      }
      return piece
    })

  if (move.isKingsideCastle() || move.isQueensideCastle()) {
    const rank = move.color === 'w' ? '1' : '8'
    const rookFrom = (move.isKingsideCastle() ? `h${rank}` : `a${rank}`) as Square
    const rookTo = (move.isKingsideCastle() ? `f${rank}` : `d${rank}`) as Square
    next = next.map((piece) =>
      piece.square === rookFrom && piece.type === 'r' && piece.color === move.color
        ? { ...piece, square: rookTo }
        : piece,
    )
  }

  return {
    pieces: next,
    captured,
    capturedSquare,
    movedId: moved.id,
  }
}

export function findKing(pieces: GamePiece[], color: Color): GamePiece | undefined {
  return pieces.find((piece) => piece.type === 'k' && piece.color === color)
}

export function getSquareFromPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  orientation: Color,
): Square | null {
  if (rect.width <= 0 || rect.height <= 0) return null
  const col = Math.floor(((clientX - rect.left) / rect.width) * 8)
  const row = Math.floor(((clientY - rect.top) / rect.height) * 8)
  if (col < 0 || col > 7 || row < 0 || row > 7) return null

  const file = orientation === 'w' ? col : 7 - col
  const rank = orientation === 'w' ? 7 - row : row
  return `${String.fromCharCode(97 + file)}${rank + 1}` as Square
}

export function getDisplayPosition(square: Square, orientation: Color): { col: number; row: number } {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  return orientation === 'w'
    ? { col: file, row: 7 - rank }
    : { col: 7 - file, row: rank }
}
