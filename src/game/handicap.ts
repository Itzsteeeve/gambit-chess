import type { Color } from 'chess.js'

export const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Material odds for games against Stockfish: the engine side starts without a piece. */
export type HandicapId = 'none' | 'pawn' | 'knight' | 'rook' | 'queen'

export interface HandicapInfo {
  id: HandicapId
  label: string
  /** File of the removed piece on the engine's back rank (or pawn rank). */
  square: { file: string; back: boolean } | null
}

export const HANDICAPS: readonly HandicapInfo[] = [
  { id: 'none', label: 'Bez náskoku', square: null },
  { id: 'pawn', label: 'Bez pěšce f', square: { file: 'f', back: false } },
  { id: 'knight', label: 'Bez jezdce', square: { file: 'b', back: true } },
  { id: 'rook', label: 'Bez věže', square: { file: 'a', back: true } },
  { id: 'queen', label: 'Bez dámy', square: { file: 'd', back: true } },
]

export function isHandicapId(value: unknown): value is HandicapId {
  return typeof value === 'string' && HANDICAPS.some((handicap) => handicap.id === value)
}

/** Expands a FEN rank ("rnbqkbnr", "8", "p2p4") to 8 single characters ('.' = empty). */
function expandRank(rank: string): string[] {
  const cells: string[] = []
  for (const char of rank) {
    if (/\d/.test(char)) cells.push(...'.'.repeat(Number(char)))
    else cells.push(char)
  }
  return cells
}

function compressRank(cells: string[]): string {
  let out = ''
  let empty = 0
  for (const cell of cells) {
    if (cell === '.') {
      empty += 1
      continue
    }
    if (empty > 0) out += String(empty)
    empty = 0
    out += cell
  }
  if (empty > 0) out += String(empty)
  return out
}

/**
 * Start position with the engine's piece removed. White always moves first,
 * so an engine playing White simply starts a piece down. Castling rights are
 * dropped for a removed rook.
 */
export function handicapFen(handicap: HandicapId, engineColor: Color): string {
  const info = HANDICAPS.find((item) => item.id === handicap)
  if (!info?.square) return DEFAULT_FEN

  const [placement, turn, castling, ...rest] = DEFAULT_FEN.split(' ')
  const ranks = placement.split('/') // ranks[0] = rank 8
  const rankNumber = engineColor === 'w' ? (info.square.back ? 1 : 2) : info.square.back ? 8 : 7
  const index = 8 - rankNumber
  const cells = expandRank(ranks[index])
  cells[info.square.file.charCodeAt(0) - 97] = '.'
  ranks[index] = compressRank(cells)

  let nextCastling = castling
  if (handicap === 'rook') {
    nextCastling = castling.replace(engineColor === 'w' ? 'Q' : 'q', '')
    if (nextCastling === '') nextCastling = '-'
  }
  return [ranks.join('/'), turn, nextCastling, ...rest].join(' ')
}
