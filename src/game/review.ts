import type { Color, Move } from 'chess.js'
import type { MoveRating, RatedMove } from './moveRating'
import { winProbability, scoreToCp } from './moveRating'
import type { EngineAnalysis, EngineScore } from './uciEngine'

/** Coarse buckets shown in the post-game summary. */
export type ReviewBucket = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

export const REVIEW_BUCKETS: readonly ReviewBucket[] = ['best', 'good', 'inaccuracy', 'mistake', 'blunder']

export const REVIEW_BUCKET_LABELS: Record<ReviewBucket, string> = {
  best: 'Nejlepší',
  good: 'Dobré',
  inaccuracy: 'Nepřesnosti',
  mistake: 'Chyby',
  blunder: 'Hrubky',
}

export function bucketOf(rating: MoveRating): ReviewBucket | null {
  switch (rating) {
    case 'brilliant':
    case 'great':
    case 'best':
      return 'best'
    case 'excellent':
    case 'good':
      return 'good'
    case 'inaccuracy':
      return 'inaccuracy'
    case 'mistake':
    case 'miss':
      return 'mistake'
    case 'blunder':
      return 'blunder'
    default:
      return null // book moves are not counted
  }
}

export interface SideSummary {
  counts: Record<ReviewBucket, number>
  /** Mean move accuracy (book moves excluded); null when nothing is rated yet. */
  accuracy: number | null
  rated: number
  total: number
}

export function summarizeSide(history: Move[], ratings: Record<string, RatedMove>, color: Color): SideSummary {
  const counts: Record<ReviewBucket, number> = { best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 }
  let accuracySum = 0
  let scored = 0
  let rated = 0
  let total = 0
  for (const move of history) {
    if (move.color !== color) continue
    total += 1
    const rating = ratings[move.after]
    if (!rating) continue
    rated += 1
    const bucket = bucketOf(rating.rating)
    if (!bucket) continue
    counts[bucket] += 1
    accuracySum += rating.accuracy
    scored += 1
  }
  const accuracy = rated === 0 ? null : scored === 0 ? 100 : accuracySum / scored
  return { counts, accuracy, rated, total }
}

export function isMistake(rating: MoveRating): boolean {
  return rating === 'mistake' || rating === 'miss' || rating === 'blunder'
}

/**
 * Ply (1-based: the position after the move) of the next mistake by `color`
 * (`null` = either side) after `afterPly`, wrapping around to the start.
 */
export function nextMistakePly(
  history: Move[],
  ratings: Record<string, RatedMove>,
  color: Color | null,
  afterPly: number,
): number | null {
  const plies: number[] = []
  history.forEach((move, index) => {
    if (color && move.color !== color) return
    const rating = ratings[move.after]
    if (rating && isMistake(rating.rating)) plies.push(index + 1)
  })
  if (plies.length === 0) return null
  return plies.find((ply) => ply > afterPly) ?? plies[0]
}

/** Maps a White-POV score to -1..1 (win-probability scale; mate = ±1). */
export function scoreToUnit(score: EngineScore | null | undefined): number | null {
  if (!score) return null
  if (typeof score.mate === 'number') {
    if (score.mate === 0) return 0
    return score.mate > 0 ? 1 : -1
  }
  return winProbability(scoreToCp(score)) * 2 - 1
}

/** Side to move of a FEN. */
export function fenTurn(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w'
}

/** FEN of every ply: index 0 = start position, index i = after move i. */
export function plyFens(startFen: string, history: Move[]): string[] {
  return [history[0]?.before ?? startFen, ...history.map((move) => move.after)]
}

/**
 * Per-ply evaluation in -1..1 from White's point of view (null = not analysed).
 * `lines[0].score` is from the side to move; "mate 0" means the side to move is mated.
 */
export function buildEvalSeries(
  fens: string[],
  analyses: ReadonlyMap<string, EngineAnalysis>,
): Array<number | null> {
  return fens.map((fen) => {
    const line = analyses.get(fen)?.lines[0]
    if (!line) return null
    const turn = fenTurn(fen)
    if (line.score.mate === 0) return turn === 'w' ? -1 : 1
    const sign = turn === 'w' ? 1 : -1
    const white: EngineScore = {
      cp: typeof line.score.cp === 'number' ? sign * line.score.cp : undefined,
      mate: typeof line.score.mate === 'number' ? sign * line.score.mate : undefined,
    }
    return scoreToUnit(white)
  })
}

export interface GraphPoint {
  ply: number
  x: number
  y: number
}

/**
 * Converts a per-ply eval series (index = ply) into chart coordinates.
 * Missing evals are skipped; `y` grows downward (top = White winning).
 */
export function graphPoints(values: Array<number | null>, width: number, height: number, pad = 2): GraphPoint[] {
  const count = values.length
  if (count === 0) return []
  const span = Math.max(1, count - 1)
  const usable = Math.max(0, height - pad * 2)
  const points: GraphPoint[] = []
  values.forEach((value, ply) => {
    if (value === null || Number.isNaN(value)) return
    const clamped = Math.max(-1, Math.min(1, value))
    points.push({
      ply,
      x: (ply / span) * width,
      y: pad + ((1 - clamped) / 2) * usable,
    })
  })
  return points
}

/** Nearest ply for an x coordinate in a chart of `count` plies. */
export function plyAtX(x: number, width: number, count: number): number {
  if (count <= 1 || width <= 0) return 0
  const ratio = Math.max(0, Math.min(1, x / width))
  return Math.round(ratio * (count - 1))
}
