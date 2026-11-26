import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import type { RatedMove } from './moveRating'
import { collectPuzzles, isPuzzleList, judgeAttempt, mergePuzzles, nextPuzzle, quickVerdict } from './puzzles'
import type { Puzzle } from './puzzles'
import type { EngineAnalysis, EngineScore } from './uciEngine'

const game = new Chess()
for (const san of ['e4', 'e5', 'Nf3', 'f6']) game.move(san)
const history = game.history({ verbose: true })

function analysis(fen: string, score: EngineScore, bestMove: string): EngineAnalysis {
  return { fen, depth: 12, bestMove, lines: [{ multipv: 1, depth: 12, score, pv: [bestMove] }] }
}

const rated = (rating: RatedMove['rating']) => ({ rating }) as RatedMove

const ratings = { [history[2].after]: rated('best'), [history[3].after]: rated('blunder') }
const analyses = new Map([[history[3].before, analysis(history[3].before, { cp: -20 }, 'b8c6')]])

const puzzle = collectPuzzles(history, ratings, analyses, 'b', 1000)[0]

/** Plays `san` in the puzzle position. */
const attempt = (san: string) => new Chess(puzzle.fen).move(san)

/** Analysis of the position after a move; the score is from White, who moves next. */
const reply = (san: string, score: EngineScore) => analysis(attempt(san).after, score, 'a2a3')

const stored = (id: string, solved = false): Puzzle => ({ ...puzzle, id, solved })

describe('training puzzles', () => {
  it('stores the mistakes of the chosen side with the engine answer', () => {
    expect(puzzle).toMatchObject({ playedUci: 'f7f6', bestUci: 'b8c6', rating: 'blunder', label: '2... f6' })
    expect(puzzle.fen).toBe(history[3].before)
    expect(collectPuzzles(history, ratings, analyses, 'w', 1000)).toEqual([])
    expect(collectPuzzles(history, ratings, analyses, null, 1000)).toHaveLength(1)
    // Without the analysis of the position there is no answer to check against.
    expect(collectPuzzles(history, ratings, new Map(), 'b', 1000)).toEqual([])
  })

  it('adds only unknown puzzles and keeps the list as it is otherwise', () => {
    const list = [stored('a', true), stored('b')]
    expect(mergePuzzles(list, [stored('a')])).toBe(list)
    expect(mergePuzzles(list, [stored('c'), stored('c')]).map((p) => p.id)).toEqual(['c', 'a', 'b'])
  })

  it('drops solved puzzles first when full', () => {
    const list = [stored('a'), stored('b', true), stored('c')]
    expect(mergePuzzles(list, [stored('d')], 3).map((p) => p.id)).toEqual(['d', 'a', 'c'])
    expect(mergePuzzles(list, [stored('d'), stored('e')], 2).map((p) => p.id)).toEqual(['e', 'd'])
  })

  it('moves on to the next unsolved puzzle, wrapping around', () => {
    const list = [stored('a'), stored('b', true), stored('c')]
    expect(nextPuzzle(list, 'a')?.id).toBe('c')
    expect(nextPuzzle(list, 'c')?.id).toBe('a')
    expect(nextPuzzle(list, null)?.id).toBe('a')
    expect(nextPuzzle([stored('a')], 'a')).toBeNull()
    expect(nextPuzzle([], null)).toBeNull()
  })

  it('accepts the best move and refuses the old mistake without the engine', () => {
    expect(quickVerdict(puzzle, attempt('Nc6'))).toEqual({ accepted: true, rating: 'best' })
    expect(quickVerdict(puzzle, attempt('f6'))).toEqual({ accepted: false, rating: 'blunder' })
    expect(quickVerdict(puzzle, attempt('d6'))).toBeNull()
  })

  it('judges other moves by how much they lose', () => {
    expect(judgeAttempt(puzzle, attempt('d6'), reply('d6', { cp: 35 })).accepted).toBe(true)
    expect(judgeAttempt(puzzle, attempt('a6'), reply('a6', { cp: 140 })).accepted).toBe(false)
    expect(judgeAttempt(puzzle, attempt('d6'), null)).toEqual({ accepted: false, rating: null })
  })

  it('validates what it reads back from storage', () => {
    expect(isPuzzleList(JSON.parse(JSON.stringify([puzzle])))).toBe(true)
    expect(isPuzzleList([{ ...puzzle, rating: 'best' }])).toBe(false)
    expect(isPuzzleList({})).toBe(false)
  })
})
