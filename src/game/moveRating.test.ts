import { Chess } from 'chess.js'
import type { Move } from 'chess.js'
import { describe, expect, it } from 'vitest'
import type { EngineAnalysis, EngineScore } from './uciEngine'
import {
  evalToWhite,
  formatEval,
  isBookMove,
  isSacrifice,
  materialBalance,
  rateMove,
  scoreForColor,
  scoreToCp,
  winProbability,
} from './moveRating'

function analysis(fen: string, lines: Array<{ score: EngineScore; pv: string[] }>): EngineAnalysis {
  return {
    fen,
    depth: 14,
    bestMove: lines[0]?.pv[0] ?? null,
    lines: lines.map((line, index) => ({ multipv: index + 1, depth: 14, ...line })),
  }
}

function play(fen: string, san: string): Move {
  return new Chess(fen).move(san)
}

// White: Kg1 Qd1 Bd3, Black: Kg8 + f7 g7 h7. Bxh7+ is a classic bishop sacrifice.
const GREEK_GIFT = '6k1/5ppp/8/8/8/3B4/8/3Q2K1 w - - 0 1'

describe('evaluation helpers', () => {
  it('win probability is 50% at equality and monotonic', () => {
    expect(winProbability(0)).toBeCloseTo(0.5)
    expect(winProbability(300)).toBeGreaterThan(winProbability(100))
    expect(winProbability(-200)).toBeCloseTo(1 - winProbability(200))
  })

  it('orders mate scores above any centipawn score', () => {
    expect(scoreToCp({ mate: 1 })).toBeGreaterThan(scoreToCp({ mate: 5 }))
    expect(scoreToCp({ mate: 5 })).toBeGreaterThan(scoreToCp({ cp: 2000 }))
    expect(scoreToCp({ mate: -1 })).toBeLessThan(scoreToCp({ mate: -5 }))
    expect(scoreToCp({ mate: -5 })).toBeLessThan(scoreToCp({ cp: -2000 }))
  })

  it('converts scores between points of view', () => {
    expect(scoreForColor({ cp: 50 }, 'b', 'w')).toEqual({ cp: -50, mate: undefined })
    expect(scoreForColor({ mate: 2 }, 'w', 'w')).toEqual({ mate: 2 })
    expect(evalToWhite(analysis('x', [{ score: { cp: 30 }, pv: ['e7e5'] }]), 'b')?.cp).toBe(-30)
    expect(formatEval({ cp: 150 })).toBe('+1.5')
    expect(formatEval({ mate: -3 })).toBe('−M3')
  })

  it('counts material from the given side', () => {
    expect(materialBalance(GREEK_GIFT, 'w')).toBe(9)
    expect(materialBalance(GREEK_GIFT, 'b')).toBe(-9)
  })
})

describe('isBookMove', () => {
  it('accepts prefixes of known lines and rejects deviations', () => {
    expect(isBookMove(['e4'])).toBe(true)
    expect(isBookMove(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])).toBe(true)
    expect(isBookMove(['e4', 'e5', 'Ke2'])).toBe(false)
    expect(isBookMove(['f3'])).toBe(false)
  })
})

describe('isSacrifice', () => {
  it('detects a piece given up over the PV', () => {
    const move = play(GREEK_GIFT, 'Bxh7+')
    expect(isSacrifice(move, ['g8h7', 'd1h5'])).toBe(true)
  })

  it('is not a sacrifice when the opponent declines', () => {
    const move = play(GREEK_GIFT, 'Bxh7+')
    expect(isSacrifice(move, ['g8f8'])).toBe(false)
  })

  it('is not a sacrifice for an even trade', () => {
    const fen = '4k3/1p6/2n5/8/3N4/8/8/4K3 w - - 0 1'
    const move = play(fen, 'Nxc6')
    expect(isSacrifice(move, ['b7c6'])).toBe(false)
  })

  it('counts an exchange sacrifice (rook for knight)', () => {
    const fen = '3qk3/8/8/3n4/8/8/8/3RK3 w - - 0 1'
    const move = play(fen, 'Rxd5')
    // Black recaptures and there is no follow-up: White stays down the exchange.
    expect(isSacrifice(move, ['d8d5'])).toBe(true)
    // An empty PV can never prove a sacrifice.
    expect(isSacrifice(move, [])).toBe(false)
  })
})

describe('rateMove', () => {
  it("rates a sound sacrifice that is the engine's best move as brilliant", () => {
    const move = play(GREEK_GIFT, 'Bxh7+')
    const rated = rateMove({
      move,
      ply: 30,
      historySans: ['d4', 'd5', 'Bxh7+'],
      before: analysis(GREEK_GIFT, [
        { score: { cp: 320 }, pv: ['d3h7', 'g8h7'] },
        { score: { cp: 250 }, pv: ['d1h5'] },
      ]),
      // Black to move after the sacrifice, so the score is from Black's view.
      after: analysis(move.after, [{ score: { cp: -330 }, pv: ['g8h7', 'd1h5', 'h7g8'] }]),
    })
    expect(rated?.rating).toBe('brilliant')
    expect(rated?.accuracy).toBe(100)
    expect(rated?.bestMoveSan).toBeNull()
  })

  it('does not call the same move brilliant when it loses the evaluation', () => {
    const move = play(GREEK_GIFT, 'Bxh7+')
    const rated = rateMove({
      move,
      ply: 30,
      historySans: ['d4', 'd5', 'Bxh7+'],
      before: analysis(GREEK_GIFT, [{ score: { cp: 320 }, pv: ['d1g4'] }]),
      after: analysis(move.after, [{ score: { cp: 150 }, pv: ['g8h7', 'd1h5', 'h7g8'] }]),
    })
    expect(rated?.rating).not.toBe('brilliant')
    expect(rated?.bestMoveSan).toBe('Qg4')
  })

  it('rates the engine move as best and a quiet equal move as best/excellent', () => {
    const start = new Chess().fen()
    const move = play(start, 'a3')
    const rated = rateMove({
      move,
      ply: 0,
      historySans: ['a3'],
      before: analysis(start, [{ score: { cp: 30 }, pv: ['a2a3'] }]),
      after: analysis(move.after, [{ score: { cp: -30 }, pv: ['e7e5'] }]),
    })
    expect(rated?.rating).toBe('best')
  })

  it('rates opening theory as book', () => {
    const start = new Chess().fen()
    const move = play(start, 'e4')
    const rated = rateMove({
      move,
      ply: 0,
      historySans: ['e4'],
      before: analysis(start, [{ score: { cp: 30 }, pv: ['d2d4'] }]),
      after: analysis(move.after, [{ score: { cp: -25 }, pv: ['e7e5'] }]),
    })
    expect(rated?.rating).toBe('book')
    expect(rated?.accuracy).toBe(100)
  })

  it('rates walking into a forced mate as a blunder', () => {
    const start = new Chess().fen()
    const move = play(start, 'f3')
    const rated = rateMove({
      move,
      ply: 0,
      historySans: ['f3'],
      before: analysis(start, [{ score: { cp: 20 }, pv: ['e2e4'] }]),
      after: analysis(move.after, [{ score: { mate: 2 }, pv: ['e7e5', 'g2g4', 'd8h4'] }]),
    })
    expect(rated?.rating).toBe('blunder')
    expect(rated?.bestMoveSan).toBe('e4')
  })

  it('rates giving up a forced mate as a miss', () => {
    const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1'
    const move = play(fen, 'h3')
    const rated = rateMove({
      move,
      ply: 40,
      historySans: ['h3'],
      before: analysis(fen, [{ score: { mate: 1 }, pv: ['a1a8'] }]),
      after: analysis(move.after, [{ score: { cp: -50 }, pv: ['h7h6'] }]),
    })
    expect(rated?.rating).toBe('miss')
  })

  it('returns null without engine lines', () => {
    const start = new Chess().fen()
    const move = play(start, 'e4')
    expect(
      rateMove({ move, ply: 0, historySans: ['e4'], before: analysis(start, []), after: analysis(move.after, []) }),
    ).toBeNull()
  })
})
