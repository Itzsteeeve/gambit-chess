/**
 * Turns an engine verdict into reasons. A concrete reason is only returned when
 * both the board and the engine line support it; otherwise it stays null and
 * the coach just names the better move. The result is data, not text
 * (see coachText.ts).
 */
import { Chess } from 'chess.js'
import type { Color, Move, PieceSymbol, Square } from 'chess.js'
import type { MoveRating, RatedMove } from './moveRating'
import { scoreToCp } from './moveRating'
import { applyUci, forkTargets, hangingPieces, lineOutcome } from './tactics'
import type { LineOutcome, PieceRef } from './tactics'
import type { EngineAnalysis } from './uciEngine'

/**
 * What a material-winning move takes. `clean` means that exactly this piece is
 * the whole gain; otherwise exchanges follow and no other piece may be named.
 */
export interface Capture {
  captured?: PieceSymbol
  clean: boolean
}

function captureOf(move: Move, outcome: LineOutcome): Capture {
  const clean =
    Boolean(move.captured) &&
    outcome.lost.length === 0 &&
    outcome.gained.length === 1 &&
    outcome.gained[0] === move.captured
  return { captured: move.captured, clean }
}

export type Reason =
  | { kind: 'mate' }
  | { kind: 'stalemate'; wasted: boolean }
  | { kind: 'allows-mate'; inMoves: number; reply: string }
  | { kind: 'missed-mate'; inMoves: number; move: string }
  | {
      kind: 'hangs'
      piece: PieceRef
      reply: string
      moved: boolean
      ignored: boolean
      defended: boolean
      /** Whether the opponent took it, let it go, or has not answered yet. */
      chance: 'taken' | 'missed' | 'open'
    }
  | { kind: 'bad-trade'; lost: PieceSymbol[]; gained: PieceSymbol[]; reply: string }
  | { kind: 'allows-fork'; targets: PieceRef[]; reply: string }
  | { kind: 'loses-material'; lost: PieceSymbol[]; gained: PieceSymbol[]; line: string[] }
  | ({ kind: 'missed-material'; move: string } & Capture)
  | { kind: 'missed-fork'; targets: PieceRef[]; move: string }
  | { kind: 'early-queen' }
  | { kind: 'sacrifice' }
  | ({ kind: 'wins-material' } & Capture)
  | { kind: 'fork'; targets: PieceRef[] }
  | { kind: 'only-move' }
  | { kind: 'rescues'; piece: PieceRef }
  | { kind: 'castles' }
  | { kind: 'develops'; piece: PieceSymbol }
  | { kind: 'center' }
  | { kind: 'book' }

export interface BoardDemo {
  arrows: Array<{ from: Square; to: Square }>
  marks: Square[]
}

export interface Explanation {
  /** good = nothing to add, ok = fine but there was better, bad = a real error. */
  verdict: 'good' | 'ok' | 'bad'
  /** Why the move is bad. */
  problem: Reason | null
  /** Why the move is good. */
  praise: Reason | null
  better: { san: string; uci: string; reason: Reason | null } | null
  /** What to draw on the position after the move; null when there is nothing to show. */
  problemDemo: BoardDemo | null
}

export interface ExplainInput {
  move: Move
  /** 0-based index of the move in the game. */
  ply: number
  rated: RatedMove
  before: EngineAnalysis
  after: EngineAnalysis
  /** Opening principles only apply to games from the normal start position. */
  openingAdvice?: boolean
  /** The reply that was really played, if any. */
  nextMove?: Move
}

const BAD: readonly MoveRating[] = ['inaccuracy', 'mistake', 'miss', 'blunder']
const OPENING_PLIES = 24
const CENTER = new Set<string>(['d4', 'e4', 'd5', 'e5'])

function isStalemate(fen: string) {
  return new Chess(fen).isStalemate()
}

/** Opening-principle and safety reasons that follow from the move itself. */
function quietPraise(move: Move, ply: number, openingAdvice: boolean): Reason | null {
  const wasHanging = hangingPieces(move.before, move.color).find((piece) => piece.square === move.from)
  if (wasHanging && !hangingPieces(move.after, move.color).some((piece) => piece.square === move.to)) {
    return { kind: 'rescues', piece: { type: wasHanging.type, square: wasHanging.square } }
  }
  if (move.isKingsideCastle() || move.isQueensideCastle()) return { kind: 'castles' }
  if (!openingAdvice || ply >= OPENING_PLIES) return null
  const homeRank = move.color === 'w' ? '1' : '8'
  if ((move.piece === 'n' || move.piece === 'b') && move.from[1] === homeRank && move.to[1] !== homeRank) {
    return { kind: 'develops', piece: move.piece }
  }
  if (move.piece === 'p' && CENTER.has(move.to)) return { kind: 'center' }
  return null
}

/** What the engine's preferred move would have achieved. */
function betterReason(
  { best, bestOutcome: outcome, played, input }: ProblemContext & { best: Move },
): Reason | null {
  const { before, ply, openingAdvice = true } = input
  if (best.san.endsWith('#')) return { kind: 'mate' }
  const mate = before.lines[0]?.score.mate
  if (typeof mate === 'number' && mate > 0) return { kind: 'missed-mate', inMoves: mate, move: best.san }
  // Material only counts as a merit when the played move does not win it too.
  if (outcome && outcome.swing >= 1 && outcome.swing - (played?.swing ?? 0) >= 1) {
    const targets = forkTargets(best)
    if (targets.length > 0) return { kind: 'fork', targets }
    if (outcome.gained.length > 0) return { kind: 'wins-material', ...captureOf(best, outcome) }
  }
  // Safety and opening reasons are only honest when the line loses nothing.
  if (outcome && outcome.swing < 0) return null
  return quietPraise(best, ply, openingAdvice)
}

interface ProblemContext {
  input: ExplainInput
  played: LineOutcome | null
  best: Move | null
  bestOutcome: LineOutcome | null
}

function findProblem({ input, played, best, bestOutcome }: ProblemContext): {
  problem: Reason | null
  demo: BoardDemo | null
} {
  const { move, before, after, ply, openingAdvice = true } = input
  const none = { problem: null, demo: null }

  if (isStalemate(move.after)) {
    const bestScore = before.lines[0]?.score
    return { problem: { kind: 'stalemate', wasted: bestScore ? scoreToCp(bestScore) > 150 : false }, demo: null }
  }

  const reply = applyUci(new Chess(move.after), after.lines[0]?.pv[0])
  const replyArrow = reply ? [{ from: reply.from, to: reply.to }] : []

  // The opponent now mates, and the best move would not have allowed it.
  const replyMate = after.lines[0]?.score.mate
  const wasMated = (before.lines[0]?.score.mate ?? 0) < 0
  if (reply && typeof replyMate === 'number' && replyMate > 0 && !wasMated) {
    return {
      problem: { kind: 'allows-mate', inMoves: replyMate, reply: reply.san },
      demo: { arrows: replyArrow, marks: [] },
    }
  }

  const hadMate = (before.lines[0]?.score.mate ?? 0) > 0
  const stillMates = typeof replyMate === 'number' && replyMate < 0
  if (hadMate && !stillMates && best) {
    return {
      problem: { kind: 'missed-mate', inMoves: before.lines[0].score.mate!, move: best.san },
      demo: null,
    }
  }

  // Material the move gives away compared with what the best move keeps.
  const bestSwing = bestOutcome?.swing ?? 0
  if (played && reply && played.swing <= -1 && played.swing - bestSwing <= -1) {
    const victim = hangingPieces(move.after, move.color).find((piece) => piece.square === reply.to)
    if (reply.captured && victim && played.lost.includes(victim.type)) {
      // Name the capture the opponent really made, when they took the same piece.
      const { nextMove } = input
      const took = Boolean(nextMove?.captured && nextMove.to === reply.to)
      const taken = took && nextMove ? nextMove : reply
      const chance = took ? 'taken' : nextMove ? 'missed' : 'open'
      const demo = { arrows: [{ from: taken.from, to: taken.to }], marks: [victim.square] }
      const moved = victim.square === move.to
      if (moved && move.captured) {
        return { problem: { kind: 'bad-trade', lost: played.lost, gained: played.gained, reply: taken.san }, demo }
      }
      const ignored =
        !moved && hangingPieces(move.before, move.color).some((piece) => piece.square === victim.square)
      return {
        problem: {
          kind: 'hangs',
          piece: { type: victim.type, square: victim.square },
          reply: taken.san,
          moved,
          ignored,
          defended: victim.defended,
          chance,
        },
        demo,
      }
    }

    const targets = forkTargets(reply)
    if (targets.length > 0 && targets.some((target) => target.type === 'k' || played.lost.includes(target.type))) {
      return {
        problem: { kind: 'allows-fork', targets, reply: reply.san },
        demo: { arrows: replyArrow, marks: targets.map((target) => target.square) },
      }
    }

    // With nothing on the board to point at, a single pawn deep in a line is
    // too shaky to claim: a deeper search often wins it back.
    if (played.lost.length > 0 && played.swing - bestSwing <= -2) {
      return {
        problem: {
          kind: 'loses-material',
          lost: played.lost,
          gained: played.gained,
          line: played.moves.slice(0, 4).map((item) => item.san),
        },
        demo: { arrows: replyArrow, marks: [] },
      }
    }
  }

  if (best && bestOutcome && bestOutcome.swing >= 1 && bestOutcome.swing - (played?.swing ?? 0) >= 1) {
    const targets = forkTargets(best)
    if (targets.length > 0) return { problem: { kind: 'missed-fork', targets, move: best.san }, demo: null }
    if (bestOutcome.gained.length > 0) {
      return {
        problem: { kind: 'missed-material', move: best.san, ...captureOf(best, bestOutcome) },
        demo: null,
      }
    }
  }

  const earlyQueen =
    openingAdvice && ply < 16 && move.piece === 'q' && !move.captured && best !== null && best.piece !== 'q'
  if (earlyQueen) return { problem: { kind: 'early-queen' }, demo: null }

  return none
}

function findPraise(input: ExplainInput, played: LineOutcome | null): Reason | null {
  const { move, rated, ply, openingAdvice = true } = input
  if (move.san.endsWith('#')) return { kind: 'mate' }
  if (isStalemate(move.after)) return { kind: 'stalemate', wasted: false }
  if (rated.rating === 'brilliant') return { kind: 'sacrifice' }
  if (played && played.swing >= 1) {
    const targets = forkTargets(move)
    if (targets.length > 0) return { kind: 'fork', targets }
    if (move.captured && played.gained.length > 0) {
      return { kind: 'wins-material', ...captureOf(move, played) }
    }
  }
  if (rated.rating === 'great') return { kind: 'only-move' }
  // A move that drops material gets no safety or development compliment, and
  // theory is not described as an escape (some book lines are sharp traps).
  const quiet = played && played.swing < 0 ? null : quietPraise(move, ply, openingAdvice)
  const book = rated.rating === 'book'
  if (quiet && !(book && quiet.kind === 'rescues')) return quiet
  return book ? { kind: 'book' } : null
}

export function explainMove(input: ExplainInput): Explanation {
  const { move, rated, before, after } = input
  const isBad = BAD.includes(rated.rating)
  const played = lineOutcome(move, after.lines[0]?.pv ?? [])

  // `bestMoveSan` is null when the played move is the engine's choice.
  const bestUci = rated.bestMoveSan ? rated.bestMoveUci : null
  const best = bestUci ? applyUci(new Chess(move.before), bestUci) : null
  const bestPv = before.lines[0]?.pv ?? []
  const bestOutcome = best && bestPv[0] === bestUci ? lineOutcome(best, bestPv.slice(1)) : null

  // Opening theory is never second-guessed.
  const showBetter = best !== null && rated.rating !== 'book'
  const verdict = isBad ? 'bad' : showBetter && (rated.rating === 'good' || rated.rating === 'excellent') ? 'ok' : 'good'

  const context = { input, played, best, bestOutcome }

  if (isBad) {
    const { problem, demo } = findProblem(context)
    let reason = best ? betterReason({ ...context, best }) : null
    // Do not repeat what the problem sentence already says about the best move.
    if (problem && (problem.kind === 'missed-mate' || problem.kind === 'missed-material' || problem.kind === 'missed-fork')) {
      reason = null
    }
    return {
      verdict,
      problem,
      praise: null,
      better: best && bestUci ? { san: best.san, uci: bestUci, reason } : null,
      problemDemo: demo,
    }
  }

  return {
    verdict,
    problem: null,
    praise: findPraise(input, played),
    better:
      verdict === 'ok' && best && bestUci
        ? { san: best.san, uci: bestUci, reason: betterReason({ ...context, best }) }
        : null,
    problemDemo: null,
  }
}

/** Explains move `index` of a game; null until both of its positions are analysed. */
export function explainHistoryMove(
  history: Move[],
  index: number,
  ratings: Record<string, RatedMove>,
  analyses: ReadonlyMap<string, EngineAnalysis>,
  openingAdvice = true,
): Explanation | null {
  const move = history[index]
  if (!move) return null
  const rated = ratings[move.after]
  const before = analyses.get(move.before)
  const after = analyses.get(move.after)
  if (!rated || !before || !after) return null
  return explainMove({ move, ply: index, rated, before, after, openingAdvice, nextMove: history[index + 1] })
}

/** Red "you can lose this" arrows for the player about to move. */
export function threatsAgainst(fen: string, color: Color): Array<{ from: Square; to: Square }> {
  return hangingPieces(fen, color).map((piece) => ({ from: piece.by, to: piece.square }))
}
