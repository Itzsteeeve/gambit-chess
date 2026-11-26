import type { Color, Move } from 'chess.js'
import { rateMove, scoreForColor } from './moveRating'
import type { MoveRating, RatedMove } from './moveRating'
import { moveLabel } from './notation'
import { fenTurn, isMistake } from './review'
import type { EngineAnalysis, EngineScore } from './uciEngine'

/** Training puzzles: positions where the player went wrong in their own games. */

export type PuzzleRating = 'mistake' | 'miss' | 'blunder'

export interface Puzzle {
  /** Position and the move played there: the same slip is stored once. */
  id: string
  /** Position before the mistake; the side to move solves it. */
  fen: string
  /** The move played in the game, e.g. "14… Nf6". */
  label: string
  playedUci: string
  rating: PuzzleRating
  bestUci: string
  /** Engine scores of its two best moves, from the solver's point of view. */
  bestScore: EngineScore
  secondScore: EngineScore | null
  depth: number
  createdAt: number
  solved: boolean
}

export const PUZZLE_LIMIT = 100

function uciOf(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`
}

/** Puzzles for the rated mistakes of `color` (`null` = both sides). */
export function collectPuzzles(
  history: Move[],
  ratings: Record<string, RatedMove>,
  analyses: ReadonlyMap<string, EngineAnalysis>,
  color: Color | null,
  now: number,
): Puzzle[] {
  return history.flatMap((move) => {
    if (color && move.color !== color) return []
    const rated = ratings[move.after]
    if (!rated || !isMistake(rated.rating)) return []
    const before = analyses.get(move.before)
    const best = before?.lines[0]
    const bestUci = before?.bestMove ?? best?.pv[0]
    const playedUci = uciOf(move)
    if (!before || !best || !bestUci || bestUci === playedUci) return []
    return [
      {
        id: `${move.before}|${playedUci}`,
        fen: move.before,
        label: moveLabel(move),
        playedUci,
        rating: rated.rating as PuzzleRating,
        bestUci,
        bestScore: best.score,
        secondScore: before.lines[1]?.score ?? null,
        depth: before.depth,
        createdAt: now,
        solved: false,
      },
    ]
  })
}

/**
 * Adds the unknown puzzles to the front. Over the limit, solved ones go first
 * (oldest first), then the oldest. Returns `existing` itself if nothing is new.
 */
export function mergePuzzles(existing: Puzzle[], found: Puzzle[], limit = PUZZLE_LIMIT): Puzzle[] {
  const known = new Set(existing.map((puzzle) => puzzle.id))
  const fresh = found.filter((puzzle) => {
    if (known.has(puzzle.id)) return false
    known.add(puzzle.id)
    return true
  })
  if (fresh.length === 0) return existing
  const merged = [...fresh.reverse(), ...existing]
  for (let i = merged.length - 1; i >= 0 && merged.length > limit; i -= 1) {
    if (merged[i].solved) merged.splice(i, 1)
  }
  return merged.slice(0, limit)
}

/** The next unsolved puzzle after `currentId`, wrapping; null when there is no other. */
export function nextPuzzle(puzzles: Puzzle[], currentId: string | null): Puzzle | null {
  const start = puzzles.findIndex((puzzle) => puzzle.id === currentId)
  for (let step = 1; step <= puzzles.length; step += 1) {
    const puzzle = puzzles[(start + step) % puzzles.length]
    if (!puzzle.solved && puzzle.id !== currentId) return puzzle
  }
  return null
}

export interface Verdict {
  accepted: boolean
  /** Null when the move could not be evaluated. */
  rating: MoveRating | null
}

/** Verdicts that need no engine: the stored best move, a mate, or the old mistake. */
export function quickVerdict(puzzle: Puzzle, move: Move): Verdict | null {
  const uci = uciOf(move)
  if (uci === puzzle.bestUci || move.san.endsWith('#')) return { accepted: true, rating: 'best' }
  if (uci === puzzle.playedUci) return { accepted: false, rating: puzzle.rating }
  return null
}

const ACCEPTED: ReadonlySet<MoveRating> = new Set<MoveRating>(['brilliant', 'great', 'best', 'excellent'])

/**
 * Judges any other move by the same rules as in a game: it solves the puzzle
 * when it is about as good as the engine's choice. `after` is the analysis of
 * the position the move led to.
 */
export function judgeAttempt(puzzle: Puzzle, move: Move, after: EngineAnalysis | null): Verdict {
  const quick = quickVerdict(puzzle, move)
  if (quick) return quick
  if (!after) return { accepted: false, rating: null }

  const line = (multipv: number, score: EngineScore, pv: string[]) => ({ multipv, depth: puzzle.depth, score, pv })
  const before: EngineAnalysis = {
    fen: puzzle.fen,
    depth: puzzle.depth,
    bestMove: puzzle.bestUci,
    lines: [
      line(1, puzzle.bestScore, [puzzle.bestUci]),
      ...(puzzle.secondScore ? [line(2, puzzle.secondScore, [])] : []),
    ],
  }
  const rated = rateMove({ move, ply: 0, historySans: [], before, after, allowBook: false })
  if (!rated) return { accepted: false, rating: null }

  // A slower forced mate still solves a puzzle that asked for a mate.
  const reply = after.lines[0].score
  const kept = scoreForColor(reply, fenTurn(move.after), move.color)
  if ((puzzle.bestScore.mate ?? 0) > 0 && (kept.mate ?? 0) > 0) return { accepted: true, rating: 'excellent' }

  return { accepted: ACCEPTED.has(rated.rating), rating: rated.rating }
}

function isScore(value: unknown): value is EngineScore {
  if (typeof value !== 'object' || value === null) return false
  const { cp, mate } = value as EngineScore
  return (cp === undefined || typeof cp === 'number') && (mate === undefined || typeof mate === 'number')
}

function isPuzzle(value: unknown): value is Puzzle {
  if (typeof value !== 'object' || value === null) return false
  const p = value as Partial<Puzzle>
  return (
    typeof p.id === 'string' &&
    typeof p.fen === 'string' &&
    typeof p.label === 'string' &&
    typeof p.playedUci === 'string' &&
    typeof p.bestUci === 'string' &&
    (p.rating === 'mistake' || p.rating === 'miss' || p.rating === 'blunder') &&
    isScore(p.bestScore) &&
    (p.secondScore === null || isScore(p.secondScore)) &&
    typeof p.depth === 'number' &&
    typeof p.createdAt === 'number' &&
    typeof p.solved === 'boolean'
  )
}

export function isPuzzleList(value: unknown): value is Puzzle[] {
  return Array.isArray(value) && value.every(isPuzzle)
}
