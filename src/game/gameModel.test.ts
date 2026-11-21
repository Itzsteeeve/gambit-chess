import { Chess } from 'chess.js'
import type { Square } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { GameModel, cannotMate, detectOutcome, timeoutOutcome } from './gameModel'

function playAll(model: GameModel, moves: Array<[string, string]>) {
  for (const [from, to] of moves) {
    const result = model.move(from as Square, to as Square)
    expect(result.ok).toBe(true)
  }
}

const FOOLS_MATE: Array<[string, string]> = [
  ['f2', 'f3'],
  ['e7', 'e5'],
  ['g2', 'g4'],
  ['d8', 'h4'],
]

describe('detectOutcome', () => {
  it('detects checkmate with the right winner', () => {
    const chess = new Chess()
    for (const san of ['f3', 'e5', 'g4', 'Qh4#']) chess.move(san)
    expect(detectOutcome(chess)).toEqual({ winner: 'b', reason: 'checkmate' })
  })

  it('detects stalemate, insufficient material and fifty-move rule', () => {
    expect(detectOutcome(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toEqual({
      winner: null,
      reason: 'stalemate',
    })
    expect(detectOutcome(new Chess('8/8/8/8/8/8/8/k1K5 w - - 0 1'))?.reason).toBe('insufficient-material')
    expect(detectOutcome(new Chess('8/8/8/8/8/8/R7/k1K5 w - - 100 80'))?.reason).toBe('fifty-move-rule')
  })

  it('returns null for a running game', () => {
    expect(detectOutcome(new Chess())).toBeNull()
  })
})

describe('timeout vs insufficient material', () => {
  it('knows which material cannot mate', () => {
    expect(cannotMate('8/8/8/8/8/8/8/k1K5 w - - 0 1', 'w')).toBe(true)
    expect(cannotMate('8/8/8/8/8/8/8/k1KN4 w - - 0 1', 'w')).toBe(true)
    expect(cannotMate('8/8/8/8/8/8/8/k1KNN3 w - - 0 1', 'w')).toBe(false)
    expect(cannotMate('8/8/8/8/8/8/P7/k1K5 w - - 0 1', 'w')).toBe(false)
    expect(cannotMate('8/8/8/8/8/8/p7/k1K5 w - - 0 1', 'w')).toBe(true)
  })

  it('a flag fall is a draw when the opponent cannot mate', () => {
    // White flags, Black only has a king (and White still has a rook).
    expect(timeoutOutcome('k7/8/8/8/8/8/R7/2K5 w - - 0 1', 'w')).toEqual({ winner: null, reason: 'timeout' })
    expect(timeoutOutcome('k7/8/8/8/8/8/R7/2K5 w - - 0 1', 'b')).toEqual({ winner: 'w', reason: 'timeout' })
  })
})

describe('GameModel undo/redo', () => {
  it('undoes and redoes moves with full state snapshots', () => {
    const model = new GameModel()
    playAll(model, [
      ['e2', 'e4'],
      ['e7', 'e5'],
    ])
    const afterTwo = model.state.fen
    expect(model.undo()).toBe(true)
    expect(model.state.turn).toBe('b')
    expect(model.state.history).toHaveLength(1)
    expect(model.state.undoneMove?.san).toBe('e5')
    expect(model.canRedo).toBe(true)

    expect(model.redo()).toBe(true)
    expect(model.state.fen).toBe(afterTwo)
    expect(model.state.undoneMove).toBeNull()
    expect(model.canRedo).toBe(false)
    expect(model.getFen()).toBe(afterTwo)
  })

  it('a new move discards the redo branch', () => {
    const model = new GameModel()
    playAll(model, [
      ['e2', 'e4'],
      ['e7', 'e5'],
    ])
    model.undo()
    playAll(model, [['c7', 'c5']])
    expect(model.canRedo).toBe(false)
    expect(model.redo()).toBe(false)
    expect(model.state.history.map((m) => m.san)).toEqual(['e4', 'c5'])
  })

  it('rejects illegal moves without changing state', () => {
    const model = new GameModel()
    const before = model.state
    expect(model.move('e2', 'e5').ok).toBe(false)
    expect(model.state).toBe(before)
  })

  it('refuses redo after resignation and clears the redo stack', () => {
    const model = new GameModel()
    playAll(model, [
      ['e2', 'e4'],
      ['e7', 'e5'],
    ])
    model.undo()
    expect(model.canRedo).toBe(true)
    expect(model.resign('w')).toBe(true)
    expect(model.state.outcome).toEqual({ winner: 'b', reason: 'resignation' })
    expect(model.canRedo).toBe(false)
    expect(model.redo()).toBe(false)
    expect(model.state.history).toHaveLength(1)
    expect(model.getPgn()).toContain('0-1')
  })

  it('refuses redo after timeout or agreed draw', () => {
    for (const end of [(m: GameModel) => m.timeout('b'), (m: GameModel) => m.agreeDraw()]) {
      const model = new GameModel()
      playAll(model, [
        ['d2', 'd4'],
        ['d7', 'd5'],
      ])
      model.undo()
      end(model)
      expect(model.state.outcome).not.toBeNull()
      expect(model.redo()).toBe(false)
    }
  })

  it('a finished game cannot be undone, finished twice, or moved in', () => {
    const model = new GameModel()
    playAll(model, FOOLS_MATE)
    expect(model.state.outcome).toEqual({ winner: 'b', reason: 'checkmate' })
    expect(model.canUndo).toBe(false)
    expect(model.undo()).toBe(false)
    expect(model.resign('b')).toBe(false)
    expect(model.move('e2', 'e3').ok).toBe(false)
    expect(model.getLegalMoves('e2')).toEqual([])
  })

  it('reports captures and keeps piece ids stable', () => {
    const model = new GameModel()
    playAll(model, [
      ['e2', 'e4'],
      ['d7', 'd5'],
    ])
    const pawnId = model.state.pieces.find((p) => p.square === 'e4')?.id
    const result = model.move('e4', 'd5')
    expect(result.ok).toBe(true)
    expect(result.captured?.type).toBe('p')
    expect(result.capturedSquare).toBe('d5')
    expect(model.state.pieces.find((p) => p.square === 'd5')?.id).toBe(pawnId)
    expect(model.state.pieces).toHaveLength(31)
  })

  it('reset starts a fresh game', () => {
    const model = new GameModel()
    playAll(model, FOOLS_MATE)
    model.reset()
    expect(model.state.outcome).toBeNull()
    expect(model.state.history).toHaveLength(0)
    expect(model.canUndo).toBe(false)
    expect(model.state.pieces).toHaveLength(32)
  })
})
