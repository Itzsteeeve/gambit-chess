import { Chess } from 'chess.js'
import type { Move, Square } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { arrowGeometry, toggleArrow, toggleMark, toneForModifiers } from './arrows'
import { GameModel } from './gameModel'
import { DEFAULT_FEN, HANDICAPS, handicapFen, isHandicapId } from './handicap'
import type { RatedMove } from './moveRating'
import { premovePromotion, premoveTargets } from './premove'
import {
  buildEvalSeries,
  graphPoints,
  highlightMoves,
  nextMistakePly,
  plyAtX,
  plyFens,
  scoreToUnit,
  summarizeSide,
} from './review'
import type { EngineAnalysis } from './uciEngine'

describe('handicap start positions', () => {
  it('none is the standard position', () => {
    expect(handicapFen('none', 'b')).toBe(DEFAULT_FEN)
    expect(new Chess().fen()).toBe(DEFAULT_FEN)
  })

  it('removes the right piece for the engine side and stays a legal position', () => {
    const queenless = new Chess(handicapFen('queen', 'b'))
    expect(queenless.get('d8')).toBeUndefined()
    expect(queenless.get('d1')?.type).toBe('q')
    expect(queenless.turn()).toBe('w')

    const knightless = new Chess(handicapFen('knight', 'w'))
    expect(knightless.get('b1')).toBeUndefined()
    expect(knightless.get('b8')?.type).toBe('n')

    const pawnless = new Chess(handicapFen('pawn', 'b'))
    expect(pawnless.get('f7')).toBeUndefined()
  })

  it('drops castling rights with the removed rook', () => {
    const fen = handicapFen('rook', 'b')
    expect(fen.split(' ')[2]).toBe('KQk')
    expect(new Chess(fen).get('a8')).toBeUndefined()
    expect(handicapFen('rook', 'w').split(' ')[2]).toBe('Kkq')
  })

  it('validates ids', () => {
    expect(HANDICAPS.every((item) => isHandicapId(item.id))).toBe(true)
    expect(isHandicapId('king')).toBe(false)
  })
})

describe('GameModel custom start + review positions', () => {
  it('starts from a custom FEN and writes SetUp/FEN PGN headers', () => {
    const model = new GameModel()
    const fen = handicapFen('queen', 'b')
    model.reset({ fen, white: 'Ty', black: 'Stockfish' })
    expect(model.state.fen).toBe(fen)
    expect(model.state.pieces).toHaveLength(31)
    expect(model.startingFen).toBe(fen)
    expect(model.move('e2', 'e4').ok).toBe(true)
    const pgn = model.getPgn()
    expect(pgn).toContain('[SetUp "1"]')
    expect(pgn).toContain(`[FEN "${fen}"]`)
    expect(pgn).toContain('[White "Ty"]')
    // The PGN can be replayed by another reader.
    const replay = new Chess()
    replay.loadPgn(pgn)
    expect(replay.history()).toEqual(['e4'])
  })

  it('undo goes back to the custom start, not the standard one', () => {
    const model = new GameModel()
    const fen = handicapFen('knight', 'w')
    model.reset({ fen })
    model.move('e2', 'e4')
    expect(model.undo()).toBe(true)
    expect(model.state.fen).toBe(fen)
    expect(model.state.pieces).toHaveLength(31)
  })

  it('standard reset has no SetUp header', () => {
    const model = new GameModel()
    model.reset()
    model.move('e2', 'e4')
    expect(model.getPgn()).not.toContain('SetUp')
  })

  it('positionAt returns the position after N plies, also after the game ended', () => {
    const model = new GameModel()
    for (const [from, to] of [
      ['f2', 'f3'],
      ['e7', 'e5'],
      ['g2', 'g4'],
      ['d8', 'h4'],
    ] as Array<[Square, Square]>) {
      model.move(from, to)
    }
    expect(model.state.outcome?.reason).toBe('checkmate')
    expect(model.positionAt(0)?.fen).toBe(DEFAULT_FEN)
    expect(model.positionAt(0)?.lastMove).toBeNull()
    const two = model.positionAt(2)
    expect(two?.history.map((m) => m.san)).toEqual(['f3', 'e5'])
    expect(two?.lastMove?.san).toBe('e5')
    expect(two?.outcome).toBeNull()
    expect(model.positionAt(4)).toBe(model.state)
    expect(model.positionAt(5)).toBeNull()
    expect(model.positionAt(-1)).toBeNull()
  })
})

describe('premoves', () => {
  it('pawn premoves include pushes and both diagonals regardless of occupancy', () => {
    const targets = premoveTargets(DEFAULT_FEN, 'e2').sort()
    expect(targets).toEqual(['d3', 'e3', 'e4', 'f3'])
  })

  it('sliders ignore blockers (the line may open)', () => {
    const targets = premoveTargets(DEFAULT_FEN, 'a1')
    expect(targets).toContain('a8')
    expect(targets).toContain('h1')
    expect(targets).toHaveLength(14)
  })

  it('king premoves include castling only with the rook at home', () => {
    expect(premoveTargets(DEFAULT_FEN, 'e1')).toEqual(expect.arrayContaining(['g1', 'c1', 'f2']))
    const noRook = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1 w Qkq - 0 1'
    expect(premoveTargets(noRook, 'e1')).not.toContain('g1')
  })

  it('knight geometry and empty squares', () => {
    expect(premoveTargets(DEFAULT_FEN, 'g1').sort()).toEqual(['e2', 'f3', 'h3'])
    expect(premoveTargets(DEFAULT_FEN, 'e4')).toEqual([])
  })

  it('auto-promotes pawn premoves to a queen', () => {
    const fen = '8/4P3/8/8/8/8/8/k1K5 b - - 0 1'
    expect(premovePromotion(fen, 'e7', 'e8')).toBe('q')
    expect(premovePromotion(DEFAULT_FEN, 'e2', 'e4')).toBeUndefined()
  })
})

function analysis(fen: string, score: { cp?: number; mate?: number }): EngineAnalysis {
  return { fen, depth: 12, bestMove: null, lines: [{ multipv: 1, depth: 12, score, pv: [] }] }
}

function rated(rating: RatedMove['rating'], accuracy: number): RatedMove {
  return {
    ply: 0,
    san: '',
    rating,
    loss: 0,
    accuracy,
    bestMoveSan: null,
    bestMoveUci: null,
    evalBefore: { cp: 0 },
    evalAfter: { cp: 0 },
    whiteEval: { cp: 0 },
  }
}

function playSan(sans: string[]): Move[] {
  const chess = new Chess()
  for (const san of sans) chess.move(san)
  return chess.history({ verbose: true })
}

describe('review: eval series and summary', () => {
  const history = playSan(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'])

  it('converts scores to a White-POV unit scale, mate = ±1', () => {
    expect(scoreToUnit({ cp: 0 })).toBeCloseTo(0)
    expect(scoreToUnit({ cp: 300 })!).toBeGreaterThan(0.4)
    expect(scoreToUnit({ mate: 3 })).toBe(1)
    expect(scoreToUnit({ mate: -2 })).toBe(-1)
    expect(scoreToUnit(null)).toBeNull()
  })

  it('builds a per-ply series with side-to-move scores flipped and mate 0 handled', () => {
    const fens = plyFens(DEFAULT_FEN, history)
    expect(fens).toHaveLength(history.length + 1)
    const map = new Map<string, EngineAnalysis>()
    map.set(fens[0], analysis(fens[0], { cp: 30 })) // white to move, +0.3
    map.set(fens[1], analysis(fens[1], { cp: 40 })) // black to move: -0.4 for white
    map.set(fens[7], analysis(fens[7], { mate: 0 })) // black is mated
    const series = buildEvalSeries(fens, map)
    expect(series[0]!).toBeGreaterThan(0)
    expect(series[1]!).toBeLessThan(0)
    expect(series[2]).toBeNull()
    expect(series[7]).toBe(1)
  })

  it('maps series to graph points, skipping gaps, and x back to a ply', () => {
    const points = graphPoints([0, null, 1, -1], 300, 100, 0)
    expect(points.map((p) => p.ply)).toEqual([0, 2, 3])
    expect(points[0]).toMatchObject({ x: 0, y: 50 })
    expect(points[1]).toMatchObject({ x: 200, y: 0 })
    expect(points[2]).toMatchObject({ x: 300, y: 100 })
    expect(plyAtX(160, 300, 4)).toBe(2)
    expect(plyAtX(-20, 300, 4)).toBe(0)
    expect(plyAtX(999, 300, 4)).toBe(3)
  })

  it('summarises each side and finds the next mistake (wrapping)', () => {
    const ratings: Record<string, RatedMove> = {
      [history[0].after]: rated('book', 100),
      [history[1].after]: rated('book', 100),
      [history[2].after]: rated('inaccuracy', 70),
      [history[3].after]: rated('good', 90),
      [history[4].after]: rated('best', 100),
      [history[5].after]: rated('blunder', 10),
      [history[6].after]: rated('brilliant', 100),
    }
    const white = summarizeSide(history, ratings, 'w')
    expect(white.counts).toMatchObject({ book: 1, inaccuracy: 1, best: 1, brilliant: 1, great: 0, blunder: 0 })
    expect(white.accuracy).toBeCloseTo(90)
    expect(white.total).toBe(4)
    const black = summarizeSide(history, ratings, 'b')
    expect(black.counts.blunder).toBe(1)
    expect(black.accuracy).toBeCloseTo(50)

    expect(nextMistakePly(history, ratings, 'b', 0)).toBe(6)
    expect(nextMistakePly(history, ratings, 'b', 6)).toBe(6) // wraps to the only one
    expect(nextMistakePly(history, ratings, 'w', 0)).toBeNull() // inaccuracy is not a mistake
    expect(nextMistakePly(history, ratings, null, 0)).toBe(6)
    expect(highlightMoves(history, ratings, null)).toEqual([6])
    expect(highlightMoves(history, ratings, 'b')).toEqual([])
  })

  it('summary with nothing rated has null accuracy', () => {
    expect(summarizeSide(history, {}, 'w').accuracy).toBeNull()
  })
})

describe('board arrows and marks', () => {
  it('picks tones from modifiers', () => {
    expect(toneForModifiers({})).toBe('green')
    expect(toneForModifiers({ shiftKey: true })).toBe('red')
    expect(toneForModifiers({ ctrlKey: true })).toBe('amber')
    expect(toneForModifiers({ altKey: true })).toBe('blue')
  })

  it('toggles arrows and marks (same tone removes, other tone replaces)', () => {
    let arrows = toggleArrow([], { from: 'e2', to: 'e4', tone: 'green' })
    expect(arrows).toHaveLength(1)
    arrows = toggleArrow(arrows, { from: 'e2', to: 'e4', tone: 'red' })
    expect(arrows).toEqual([{ from: 'e2', to: 'e4', tone: 'red' }])
    arrows = toggleArrow(arrows, { from: 'e2', to: 'e4', tone: 'red' })
    expect(arrows).toEqual([])

    let marks = toggleMark([], { square: 'd4', tone: 'green' })
    marks = toggleMark(marks, { square: 'd4', tone: 'green' })
    expect(marks).toEqual([])
  })

  it('draws straight and L-shaped arrows in board coordinates', () => {
    const straight = arrowGeometry('e2', 'e4', 'w')
    expect(straight.shaft.startsWith('M 450 ')).toBe(true)
    expect(straight.shaft.split(' L ')).toHaveLength(2)
    const knight = arrowGeometry('g1', 'f3', 'w')
    expect(knight.shaft.split(' L ')).toHaveLength(3)
    // Flipped orientation mirrors the coordinates.
    expect(arrowGeometry('e2', 'e4', 'b').shaft.startsWith('M 350 ')).toBe(true)
  })
})
