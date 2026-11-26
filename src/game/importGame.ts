import { Chess, validateFen } from 'chess.js'
import type { Color, PieceSymbol, Square } from 'chess.js'
import { opposite } from './constants'
import { detectOutcome } from './gameModel'
import { DEFAULT_FEN } from './handicap'
import type { GameOutcome } from './notation'

export interface ImportedMove {
  from: Square
  to: Square
  promotion?: PieceSymbol
}

export interface ImportedGame {
  /** Only set when the game does not start from the standard position. */
  startFen?: string
  moves: ImportedMove[]
  headers: Record<string, string>
  white: string
  black: string
  whiteElo: string | null
  blackElo: string | null
  outcome: GameOutcome
  /** The text held more games; only the first one was read. */
  hasMoreGames: boolean
  /** A finished online game opened for review. */
  online?: boolean
}

export type ImportResult =
  | { kind: 'position'; fen: string }
  | { kind: 'game'; game: ImportedGame }
  | { kind: 'error'; message: string }

type PositionResult = { ok: true; fen: string } | { ok: false; message: string }

const FEN_PLACEMENT = /^[pnbrqkPNBRQK1-8]+(\/[pnbrqkPNBRQK1-8]+){7}(\s|$)/
const SUPPORTED_VARIANTS = ['', 'standard', 'chess', 'from position']

const fail = (message: string) => ({ ok: false as const, message })

/** Expands the placement field to a square → piece character lookup. */
function boardOf(placement: string): Map<string, string> {
  const board = new Map<string, string>()
  placement.split('/').forEach((rank, row) => {
    let file = 0
    for (const char of rank) {
      if (/\d/.test(char)) {
        file += Number(char)
        continue
      }
      board.set(`${String.fromCharCode(97 + file)}${8 - row}`, char)
      file += 1
    }
  })
  return board
}

/** More pieces than promotions allow can overflow the engine's move lists. */
function materialProblem(board: Map<string, string>): string | null {
  for (const color of ['w', 'b'] as const) {
    const own = [...board.values()]
      .filter((char) => (color === 'w') === (char !== char.toLowerCase()))
      .map((char) => char.toLowerCase())
    const count = (type: string) => own.filter((piece) => piece === type).length
    const promoted =
      Math.max(0, count('q') - 1) +
      Math.max(0, count('r') - 2) +
      Math.max(0, count('b') - 2) +
      Math.max(0, count('n') - 2)
    if (own.length > 16 || count('p') + promoted > 8) {
      return `${color === 'w' ? 'Bílý' : 'Černý'} má na desce víc figur, než je v partii možné.`
    }
  }
  return null
}

/** Keeps only castling rights whose king and rook still stand on their home squares. */
function castlingFor(board: Map<string, string>, requested: string): string {
  const rights = [
    ['K', 'e1', 'K', 'h1', 'R'],
    ['Q', 'e1', 'K', 'a1', 'R'],
    ['k', 'e8', 'k', 'h8', 'r'],
    ['q', 'e8', 'k', 'a8', 'r'],
  ]
  const kept = rights
    .filter(
      ([flag, kingSquare, king, rookSquare, rook]) =>
        requested.includes(flag) && board.get(kingSquare) === king && board.get(rookSquare) === rook,
    )
    .map(([flag]) => flag)
    .join('')
  return kept || '-'
}

/** An en passant square only makes sense right behind a pawn that just advanced two squares. */
function enPassantFor(board: Map<string, string>, turn: Color, square: string): string {
  const [targetRank, pawnRank, originRank, pawn] =
    turn === 'w' ? ['6', '5', '7', 'p'] : ['3', '4', '2', 'P']
  const file = square[0]
  const valid =
    square.length === 2 &&
    square[1] === targetRank &&
    board.get(`${file}${pawnRank}`) === pawn &&
    !board.has(square) &&
    !board.has(`${file}${originRank}`)
  return valid ? square : '-'
}

/**
 * Validates a FEN typed or pasted by the user and returns it in canonical form.
 * Illegal positions are refused: Stockfish may crash on them.
 */
export function normalizePosition(text: string): PositionResult {
  const fields = text.trim().split(/\s+/)
  if (fields.length > 6) return fail('FEN má příliš mnoho polí.')
  const [placement, turn = 'w', castling = '-', enPassant = '-', halfMoves = '0', moveNumber = '1'] = fields
  if (turn !== 'w' && turn !== 'b') return fail('Neplatný FEN: strana na tahu musí být „w“ nebo „b“.')

  const draft = [placement, turn, '-', '-', halfMoves, moveNumber].join(' ')
  if (!validateFen(draft).ok) return fail('Neplatný FEN. Zkontroluj rozestavení figur.')

  const board = boardOf(placement)
  const problem = materialProblem(board)
  if (problem) return fail(problem)

  const fen = [
    placement,
    turn,
    castlingFor(board, castling),
    enPassantFor(board, turn, enPassant),
    halfMoves,
    moveNumber,
  ].join(' ')

  try {
    const chess = new Chess(fen)
    const waiting = opposite(turn)
    const [king] = chess.findPiece({ type: 'k', color: waiting })
    if (chess.isAttacked(king, turn)) {
      return fail('Neplatná pozice: strana, která není na tahu, stojí v šachu.')
    }
    return { ok: true, fen: chess.fen() }
  } catch {
    return fail('Neplatný FEN. Zkontroluj rozestavení figur.')
  }
}

/** True when a new game can be played from this position (it is not already over). */
export function isPlayablePosition(fen: string): boolean {
  try {
    return detectOutcome(new Chess(fen)) === null
  } catch {
    return false
  }
}

/**
 * Result of an imported game. The final position wins over the header when it is
 * decisive on its own; claimable draws (repetition, fifty moves) only count when
 * the game record does not say somebody won.
 */
function importedOutcome(game: Chess, result: string | undefined): GameOutcome {
  const onBoard = detectOutcome(game)
  if (game.isCheckmate() || game.isStalemate() || game.isInsufficientMaterial()) return onBoard!
  if (result === '1-0') return { winner: 'w', reason: 'record' }
  if (result === '0-1') return { winner: 'b', reason: 'record' }
  if (onBoard) return onBoard
  if (result === '1/2-1/2') return { winner: null, reason: 'record' }
  return { winner: null, reason: 'unfinished' }
}

function headerValue(headers: Record<string, string>, key: string): string | null {
  const value = headers[key]?.trim()
  return value && value !== '?' && value !== '-' ? value : null
}

function parsePgn(text: string): ImportResult {
  // Every game of a collection opens with its own Event tag.
  const nextGame = /\n\s*\[Event\s+"/g
  nextGame.lastIndex = Math.max(0, text.indexOf('[Event ')) + 1
  const boundary = nextGame.exec(text)
  const first = boundary ? text.slice(0, boundary.index) : text

  const variant = /\[Variant\s+"([^"]*)"/i.exec(first)?.[1] ?? ''
  if (!SUPPORTED_VARIANTS.includes(variant.trim().toLowerCase())) {
    return { kind: 'error', message: `Varianta „${variant}“ není podporovaná, jen klasické šachy.` }
  }

  const record = new Chess()
  try {
    record.loadPgn(first)
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : ''
    const illegal = /Invalid move in PGN: (.+)$/.exec(detail)?.[1]
    return {
      kind: 'error',
      message: illegal
        ? `Zápis obsahuje neplatný tah: ${illegal}`
        : 'Text se nepodařilo přečíst. Vlož celé PGN nebo FEN.',
    }
  }

  const headers = record.getHeaders()
  const played = record.history({ verbose: true })
  const rawStart = played[0]?.before ?? record.fen()
  const position = normalizePosition(rawStart)
  if (!position.ok) return { kind: 'error', message: position.message }
  const startFen = position.fen

  if (played.length === 0) {
    if (startFen === DEFAULT_FEN) return { kind: 'error', message: 'V zápisu nejsou žádné tahy.' }
    return positionResult(startFen)
  }

  // Replayed from the checked start position, exactly as the game model will do it.
  const replay = new Chess(startFen)
  const moves: ImportedMove[] = []
  for (const move of played) {
    const next: ImportedMove = { from: move.from, to: move.to, promotion: move.promotion }
    try {
      replay.move(next)
    } catch {
      return { kind: 'error', message: `Zápis obsahuje neplatný tah: ${move.san}` }
    }
    moves.push(next)
  }

  return {
    kind: 'game',
    game: {
      startFen: startFen === DEFAULT_FEN ? undefined : startFen,
      moves,
      headers,
      white: headerValue(headers, 'White') ?? 'Bílý',
      black: headerValue(headers, 'Black') ?? 'Černý',
      whiteElo: headerValue(headers, 'WhiteElo'),
      blackElo: headerValue(headers, 'BlackElo'),
      outcome: importedOutcome(replay, headers.Result),
      hasMoreGames: boundary !== null,
    },
  }
}

function positionResult(fen: string): ImportResult {
  return isPlayablePosition(fen)
    ? { kind: 'position', fen }
    : { kind: 'error', message: 'V této pozici už partie skončila, není co hrát.' }
}

/** Reads pasted text as either a single position (FEN) or a game record (PGN). */
export function parseImport(text: string): ImportResult {
  const trimmed = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim()
  if (!trimmed) return { kind: 'error', message: 'Vlož PGN nebo FEN.' }
  if (FEN_PLACEMENT.test(trimmed)) {
    const position = normalizePosition(trimmed)
    return position.ok ? positionResult(position.fen) : { kind: 'error', message: position.message }
  }
  return parsePgn(trimmed)
}
