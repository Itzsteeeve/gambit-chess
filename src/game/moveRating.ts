import { Chess } from 'chess.js'
import type { Color, Move } from 'chess.js'
import { PIECE_VALUES } from './constants'
import type { EngineAnalysis, EngineScore } from './uciEngine'

export type MoveRating =
  | 'book'
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder'

export interface MoveRatingMeta {
  label: string
  short: string
  description: string
  criteria: string
  tone: string
  category: 'positive' | 'negative'
}

export const MOVE_RATING_META: Record<MoveRating, MoveRatingMeta> = {
  book: {
    label: 'Kniha',
    short: '📖',
    description: 'Teoretický tah z openingové knihy zahájení.',
    criteria: 'Tah odpovídá prověřené teorii šachových zahájení.',
    tone: '#a88865',
    category: 'positive',
  },
  brilliant: {
    label: 'Brilantní',
    short: '!!',
    description: 'Skvostný tah s obětí materiálu, který drží nebo zvyšuje výhodu.',
    criteria: 'Oběť figury či kvality, která je nejlepším tahem a pozice zůstává vyhraná.',
    tone: '#1baca6',
    category: 'positive',
  },
  great: {
    label: 'Skvělý tah',
    short: '!',
    description: 'Jediný správný tah v kritické nebo ostré pozici.',
    criteria: 'Kritická pozice, kde všechny alternativní tahy selhávají a hráč našel jedinou záchranu či výhru.',
    tone: '#4f89be',
    category: 'positive',
  },
  best: {
    label: 'Nejlepší tah',
    short: '★',
    description: 'Tah doporučený šachovým motorem jako volba číslo 1.',
    criteria: 'Nejvyšší volba Stockfishe nebo tah se zanedbatelným rozdílem do 0,12 pěšce.',
    tone: '#7fa650',
    category: 'positive',
  },
  excellent: {
    label: 'Výborný tah',
    short: '✓',
    description: 'Téměř stejně silný tah jako nejlepší možnost.',
    criteria: 'Velmi kvalitní tah s minimální ztrátou do 0,3 pěšce.',
    tone: '#96bc4b',
    category: 'positive',
  },
  good: {
    label: 'Dobrý tah',
    short: '✓',
    description: 'Rozumný a pevný tah, drží zdravou pozici.',
    criteria: 'Spolehlivý lidský tah s malou ztrátou do 0,7 pěšce.',
    tone: '#84a559',
    category: 'positive',
  },
  inaccuracy: {
    label: 'Nepřesnost',
    short: '?!',
    description: 'Menší zaváhání — šlo zahrát přesněji.',
    criteria: 'Ztráta 0,7 až 1,4 pěšce. Oslabení pozice bez bezprostředního nebezpečí.',
    tone: '#f0c15c',
    category: 'negative',
  },
  mistake: {
    label: 'Chyba',
    short: '?',
    description: 'Výraznější ztráta výhody nebo obrany.',
    criteria: 'Ztráta 1,4 až 3,2 pěšce. Dává soupeři iniciativu nebo ztrácí převahu.',
    tone: '#e68f44',
    category: 'negative',
  },
  miss: {
    label: 'Promeškaná výhra',
    short: '✕',
    description: 'Přehlédnutá velká šance, taktický zisk nebo mat.',
    criteria: 'Hráč měl vyhranou pozici či matový útok a nedokázal soupeře potrestat.',
    tone: '#e05353',
    category: 'negative',
  },
  blunder: {
    label: 'Hrubka',
    short: '??',
    description: 'Závažná chyba, která fatálně mění výsledek partie.',
    criteria: 'Ztráta figury zadarmo, nahrávka na mat nebo pád z vyrovnané pozice do prohry.',
    tone: '#ca3431',
    category: 'negative',
  },
}

export interface RatedMove {
  ply: number
  san: string
  rating: MoveRating
  /** Win-probability loss in percentage points (0–100). */
  loss: number
  accuracy: number
  bestMoveSan: string | null
  bestMoveUci: string | null
  evalBefore: EngineScore
  evalAfter: EngineScore
  /** Evaluation after the move, from White's point of view. */
  whiteEval: EngineScore
}

/** Lichess-style win probability for a centipawn score. */
export function winProbability(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp))
  return 1 / (1 + Math.exp(-0.00368208 * clamped))
}

export function scoreToCp(score: EngineScore): number {
  if (typeof score.mate === 'number') {
    if (score.mate > 0) return 10_000 - Math.min(score.mate, 40) * 20
    return -10_000 - Math.min(score.mate, 40) * 20
  }
  return score.cp ?? 0
}

export function scoreForColor(score: EngineScore, sideToMove: Color, color: Color): EngineScore {
  if (sideToMove === color) return score
  return {
    cp: typeof score.cp === 'number' ? -score.cp : undefined,
    mate: typeof score.mate === 'number' ? -score.mate : undefined,
  }
}

export function formatEval(score: EngineScore | null | undefined): string {
  if (!score) return '…'
  if (typeof score.mate === 'number') {
    if (score.mate === 0) return '#'
    return `${score.mate > 0 ? '+' : '−'}M${Math.abs(score.mate)}`
  }
  const pawns = (score.cp ?? 0) / 100
  return `${pawns >= 0 ? '+' : '−'}${Math.abs(pawns).toFixed(1)}`
}

export function evalToWhite(analysis: EngineAnalysis | undefined, fenTurn: Color): EngineScore | null {
  const line = analysis?.lines[0]
  if (!line) return null
  return scoreForColor(line.score, fenTurn, 'w')
}

export function materialBalance(fen: string, color: Color): number {
  const board = fen.split(' ')[0]
  let balance = 0
  for (const char of board) {
    const lower = char.toLowerCase()
    if (!(lower in PIECE_VALUES)) continue
    const sign = char === lower ? -1 : 1
    balance += sign * PIECE_VALUES[lower as keyof typeof PIECE_VALUES]
  }
  return color === 'w' ? balance : -balance
}

function uciOf(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

function sanOfUci(fen: string, uci: string | null): string | null {
  if (!uci) return null
  try {
    const chess = new Chess(fen)
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci.length > 4 ? uci[4] : undefined
    const move = chess.move({ from, to, promotion })
    return move?.san ?? null
  } catch {
    return null
  }
}

/** Minimum material (in pawns) that must stay given up to count as a sacrifice. */
const SACRIFICE_THRESHOLD = 2

/**
 * Detects a real sacrifice. Material is compared with the position *before*
 * the move, after the opponent's best reply (the first PV move of the
 * post-move analysis) and again after the mover's follow-up, so an immediate
 * recapture/trade does not count. Comparing the mover's own material over a
 * single ply can never detect a sacrifice, since a move never loses material
 * by itself.
 */
export function isSacrifice(move: Move, afterPv: string[]): boolean {
  if (afterPv.length === 0) return false
  const mover = move.color
  const baseline = materialBalance(move.before, mover)
  let chess: Chess
  try {
    chess = new Chess(move.after)
  } catch {
    return false
  }

  const deficits: number[] = []
  for (const uci of afterPv.slice(0, 2)) {
    try {
      const played = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      })
      if (!played) break
    } catch {
      break
    }
    deficits.push(baseline - materialBalance(chess.fen(), mover))
  }

  if (deficits.length === 0) return false
  // Down material after the reply, and still down after our follow-up move.
  return deficits.every((deficit) => deficit >= SACRIFICE_THRESHOLD)
}

function normalizeSan(san: string): string {
  return san.replace(/[+#]/g, '')
}

/**
 * Compact opening book. A move is "book" while the played game remains a
 * prefix of at least one of these mainlines.
 */
const BOOK_LINES: string[][] = [
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5', 'exd5', 'Na5'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nc3', 'Bb4'],
  ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'd6', 'Nf3', 'Nxe4', 'd4', 'd5'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6', 'Bb5', 'Bb4', 'O-O', 'O-O'],
  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'],
  ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5'],
  ['e4', 'c5', 'Nc3', 'Nc6', 'g3', 'g6', 'Bg2', 'Bg7', 'd3', 'd6'],
  ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'a6', 'Bd3', 'Nf6'],
  ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'e5', 'Nfd7', 'f4', 'c5'],
  ['e4', 'e6', 'd4', 'd5', 'Nd2', 'Nf6', 'e5', 'Nfd7', 'Bd3', 'c5'],
  ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5', 'Ng3', 'Bg6'],
  ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Nf3', 'e6', 'Be2', 'c5'],
  ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6', 'Nf3', 'c6'],
  ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'Nf3', 'Bg7', 'Be2', 'O-O'],
  ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6', 'Nf3', 'dxe5', 'Nxe5', 'c6'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4', 'd4', 'Nd6'],
  ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O'],
  ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4', 'a4', 'Bf5'],
  ['d4', 'd5', 'c4', 'dxc4', 'Nf3', 'Nf6', 'e3', 'e6', 'Bxc4', 'c5'],
  ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O'],
  ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'O-O', 'Bd3', 'd5'],
  ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6', 'g3', 'Bb7', 'Bg2', 'Be7'],
  ['d4', 'f5', 'g3', 'Nf6', 'Bg2', 'g6', 'Nf3', 'Bg7', 'O-O', 'O-O'],
  ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'c5', 'c3', 'Nc6'],
  ['d4', 'd5', 'c4', 'Nf6', 'Nc3', 'e6', 'Nf3', 'Be7', 'Bg5', 'O-O'],
  ['c4', 'e5', 'Nc3', 'Nf6', 'Nf3', 'Nc6', 'g3', 'd5', 'cxd5', 'Nxd5'],
  ['c4', 'c5', 'Nf3', 'Nf6', 'Nc3', 'Nc6', 'g3', 'g6', 'Bg2', 'Bg7'],
  ['Nf3', 'd5', 'g3', 'Nf6', 'Bg2', 'e6', 'O-O', 'Be7', 'd3', 'O-O'],
  ['Nf3', 'Nf6', 'c4', 'e6', 'Nc3', 'd5', 'd4', 'Be7', 'Bf4', 'O-O'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5'],
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nd4', 'Nxe5', 'Qg5', 'Nxf7', 'Qxg2'],
  ['e4', 'e5', 'f4', 'exf4', 'Nf3', 'g5', 'h4', 'g4', 'Ne5', 'Nf6'],
  ['e4', 'e5', 'Nc3', 'Nf6', 'f4', 'd5', 'fxe5', 'Nxe4', 'Nf3', 'Be7'],
]

export function isBookMove(historySans: string[]): boolean {
  const normalized = historySans.map(normalizeSan)
  return BOOK_LINES.some(
    (line) =>
      normalized.length <= line.length &&
      normalized.every((san, index) => line[index] === san),
  )
}

function accuracyFromMove(cpLoss: number, winLoss: number, isBest: boolean): number {
  if (isBest) return 100
  const effectiveLoss = Math.max(winLoss, Math.min(100, cpLoss / 10))
  const value = 103.1668 * Math.exp(-0.04354 * effectiveLoss) - 3.1668
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10))
}

export interface RateMoveInput {
  move: Move
  ply: number
  historySans: string[]
  before: EngineAnalysis
  after: EngineAnalysis
  /** False for games from a custom start position (handicap): the book does not apply. */
  allowBook?: boolean
}

export function rateMove({ move, ply, historySans, before, after, allowBook = true }: RateMoveInput): RatedMove | null {
  const beforeLine = before.lines[0]
  const afterLine = after.lines[0]
  if (!beforeLine || !afterLine) return null

  const mover = move.color
  const bestScore = beforeLine.score
  const afterScoreMover = scoreForColor(afterLine.score, move.color === 'w' ? 'b' : 'w', mover)
  const bestCp = scoreToCp(bestScore)
  const afterCp = scoreToCp(afterScoreMover)
  const cpLoss = Math.max(0, bestCp - afterCp)

  const bestWin = winProbability(bestCp)
  const afterWin = winProbability(afterCp)
  const winLoss = Math.max(0, (bestWin - afterWin) * 100)

  const playedUci = uciOf(move)
  const engineBest = before.bestMove ?? beforeLine.pv[0] ?? null
  const isBest = engineBest === playedUci
  const secondLine = before.lines[1]
  const secondCp = secondLine ? scoreToCp(secondLine.score) : bestCp
  const onlyMove = bestCp - secondCp >= 120

  const isBook = allowBook && isBookMove(historySans)

  const whiteTurnAfter = move.color === 'w' ? 'b' : 'w'
  const whiteEval = scoreForColor(afterLine.score, whiteTurnAfter, 'w')

  // Check mate situations
  const hadMate = typeof beforeLine.score.mate === 'number' && beforeLine.score.mate > 0
  const hasMateAfter = typeof afterScoreMover.mate === 'number' && afterScoreMover.mate > 0
  const opponentHasMate = typeof afterLine.score.mate === 'number' && afterLine.score.mate > 0

  let rating: MoveRating
  if (isBook) {
    rating = 'book'
  } else {
    // Sacrifice detection over the engine's principal variation after the move.
    const sacrificed = isSacrifice(move, afterLine.pv)

    // 1. Brilliant: sound sacrifice that is (practically) the engine best move
    //    and keeps the position at least balanced.
    if (sacrificed && (isBest || (cpLoss <= 25 && winLoss <= 2)) && afterCp >= -50) {
      rating = 'brilliant'
    }
    // 2. Great: only winning/saving move found in a sharp situation
    else if (isBest && onlyMove && afterCp >= -100) {
      rating = 'great'
    }
    // 3. Best: engine's #1 move, or practically tied with #1
    else if (isBest || (cpLoss <= 15 && winLoss <= 1.5)) {
      rating = 'best'
    }
    // 4. Excellent: very close to best move (<= 40 cp loss, minimal win prob loss)
    else if (cpLoss <= 40 && winLoss <= 3.0) {
      rating = 'excellent'
    }
    // 5. Good: solid reasonable move (<= 85 cp loss, small win prob loss)
    else if (cpLoss <= 85 && winLoss <= 6.5) {
      rating = 'good'
    }
    // 6. Miss: had a winning position or forced mate and gave it up to equal or slight edge
    else if (
      (hadMate && !hasMateAfter) ||
      (bestWin >= 0.80 && afterWin < 0.60 && winLoss >= 18) ||
      (bestCp >= 280 && afterCp <= 70 && cpLoss >= 200)
    ) {
      rating = 'miss'
    }
    // 7. Blunder: true catastrophic error that decisively loses the game or hangs forced mate
    // - walked into forced mate when not already getting mated
    // - OR massive game-throwing blunder from an equal/winning position into a lost one
    else if (
      (opponentHasMate && !hadMate) ||
      (bestCp >= -150 && afterCp <= -300 && (winLoss >= 28 || (cpLoss >= 450 && winLoss >= 20))) ||
      (bestCp >= -100 && afterCp <= -450 && cpLoss >= 500)
    ) {
      rating = 'blunder'
    }
    // 8. Mistake: noticeable error (15-28% win prob drop, or 180-450 cp loss)
    // Hands over an advantage or significant initiative without immediate total collapse
    else if (winLoss >= 15 || cpLoss >= 180) {
      rating = 'mistake'
    }
    // 9. Inaccuracy: mild sub-optimal drop (6.5-15% win prob drop, or 85-180 cp loss)
    else {
      rating = 'inaccuracy'
    }
  }

  const accuracy = rating === 'book' ? 100 : accuracyFromMove(cpLoss, winLoss, isBest)

  return {
    ply,
    san: move.san,
    rating,
    loss: winLoss,
    accuracy,
    bestMoveSan: isBest ? null : sanOfUci(move.before, engineBest),
    bestMoveUci: engineBest,
    evalBefore: bestScore,
    evalAfter: afterScoreMover,
    whiteEval,
  }
}
