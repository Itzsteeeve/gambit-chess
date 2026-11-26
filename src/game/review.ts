import type { Color, Move } from 'chess.js'
import type { MoveRating, RatedMove } from './moveRating'
import { winProbability, scoreToCp } from './moveRating'
import type { EngineAnalysis, EngineScore } from './uciEngine'

/** Every rating, in the order the post-game summary lists them. */
export const RATING_ORDER: readonly MoveRating[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'miss',
  'mistake',
  'blunder',
]

/** Row labels of the summary (plural). */
export const RATING_SUMMARY_LABELS: Record<MoveRating, string> = {
  brilliant: 'Brilantní',
  great: 'Skvělé',
  best: 'Nejlepší',
  excellent: 'Výborné',
  good: 'Dobré',
  book: 'Z knihy',
  inaccuracy: 'Nepřesnosti',
  miss: 'Promeškané výhry',
  mistake: 'Chyby',
  blunder: 'Hrubky',
}

export interface SideSummary {
  counts: Record<MoveRating, number>
  /** Mean move accuracy (book moves excluded); null when nothing is rated yet. */
  accuracy: number | null
  rated: number
  total: number
}

export function summarizeSide(history: Move[], ratings: Record<string, RatedMove>, color: Color): SideSummary {
  const counts = Object.fromEntries(RATING_ORDER.map((rating) => [rating, 0])) as Record<MoveRating, number>
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
    counts[rating.rating] += 1
    if (rating.rating === 'book') continue
    accuracySum += rating.accuracy
    scored += 1
  }
  const accuracy = rated === 0 ? null : scored === 0 ? 100 : accuracySum / scored
  return { counts, accuracy, rated, total }
}

/** History indices of the brilliant and great moves by `color` (`null` = either side), in game order. */
export function highlightMoves(history: Move[], ratings: Record<string, RatedMove>, color: Color | null): number[] {
  return history.flatMap((move, index) => {
    if (color && move.color !== color) return []
    const rating = ratings[move.after]?.rating
    return rating === 'brilliant' || rating === 'great' ? [index] : []
  })
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

/**
 * History indices of the costliest mistakes by `color` (`null` = either side),
 * at most `limit` of them, in game order.
 */
export function keyMoments(
  history: Move[],
  ratings: Record<string, RatedMove>,
  color: Color | null,
  limit = 3,
): number[] {
  const mistakes: Array<{ index: number; loss: number }> = []
  history.forEach((move, index) => {
    if (color && move.color !== color) return
    const rating = ratings[move.after]
    if (rating && isMistake(rating.rating)) mistakes.push({ index, loss: rating.loss })
  })
  return mistakes
    .sort((a, b) => b.loss - a.loss)
    .slice(0, limit)
    .map((item) => item.index)
    .sort((a, b) => a - b)
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

/**
 * SVG path through the points as a monotone cubic curve (Fritsch–Carlson):
 * smooth, but it never overshoots between two evaluations, so the curve
 * cannot suggest an advantage no position had.
 */
export function smoothPath(points: GraphPoint[]): string {
  const n = points.length
  if (n === 0) return ''
  const f = (value: number) => value.toFixed(1)
  if (n === 1) return `M${f(points[0].x)} ${f(points[0].y)}`
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i += 1) {
    const step = points[i + 1].x - points[i].x || 1e-6
    dx.push(step)
    slope.push((points[i + 1].y - points[i].y) / step)
  }
  const tangent: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i += 1) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2)
  }
  tangent.push(slope[n - 2])
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0
      tangent[i + 1] = 0
      continue
    }
    const a = tangent[i] / slope[i]
    const b = tangent[i + 1] / slope[i]
    const h = a * a + b * b
    if (h > 9) {
      const tau = 3 / Math.sqrt(h)
      tangent[i] = tau * a * slope[i]
      tangent[i + 1] = tau * b * slope[i]
    }
  }
  let path = `M${f(points[0].x)} ${f(points[0].y)}`
  for (let i = 0; i < n - 1; i += 1) {
    const third = dx[i] / 3
    const p0 = points[i]
    const p1 = points[i + 1]
    path +=
      ` C${f(p0.x + third)} ${f(p0.y + tangent[i] * third)}` +
      ` ${f(p1.x - third)} ${f(p1.y - tangent[i + 1] * third)}` +
      ` ${f(p1.x)} ${f(p1.y)}`
  }
  return path
}

/** Nearest ply for an x coordinate in a chart of `count` plies. */
export function plyAtX(x: number, width: number, count: number): number {
  if (count <= 1 || width <= 0) return 0
  const ratio = Math.max(0, Math.min(1, x / width))
  return Math.round(ratio * (count - 1))
}
