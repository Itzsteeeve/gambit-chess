import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { exchangeGain, forkTargets, hangingPieces, lineOutcome } from './tactics'

const play = (fen: string, san: string) => new Chess(fen).move(san)

describe('exchangeGain', () => {
  it('wins an undefended piece', () => {
    expect(exchangeGain(new Chess('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1'), 'd5')).toBe(3)
  })

  it('does not take a defended piece with a more valuable one', () => {
    expect(exchangeGain(new Chess('4k3/8/4p3/3n4/8/8/8/3RK3 w - - 0 1'), 'd5')).toBe(0)
  })

  it('ignores a pinned defender', () => {
    // The e6 pawn is pinned by the e1 rook, so d5 is effectively undefended.
    expect(exchangeGain(new Chess('4k3/8/4p3/3n4/8/8/8/3RR1K1 w - - 0 1'), 'd5')).toBe(3)
  })

  it('leaves the board unchanged', () => {
    const chess = new Chess('4k3/8/4p3/3n4/8/8/8/3RK3 w - - 0 1')
    const fen = chess.fen()
    exchangeGain(chess, 'd5')
    expect(chess.fen()).toBe(fen)
  })
})

describe('hangingPieces', () => {
  const fen = '4k3/8/8/3n4/8/8/8/3RK3 b - - 0 1'

  it('finds a piece that can be taken, also on the owner’s turn', () => {
    expect(hangingPieces(fen, 'b')).toEqual([{ square: 'd5', type: 'n', by: 'd1', gain: 3, defended: false }])
  })

  it('reports nothing for a defended piece', () => {
    expect(hangingPieces('4k3/8/4p3/3n4/8/8/8/3RK3 b - - 0 1', 'b')).toEqual([])
  })

  it('stays quiet while the owner is in check', () => {
    expect(hangingPieces('4k3/8/8/3n4/8/8/8/3KR3 b - - 0 1', 'b')).toEqual([])
  })
})

describe('forkTargets', () => {
  it('finds a knight fork of king and rook', () => {
    const move = play('r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', 'Nc7+')
    expect(forkTargets(move).map((target) => target.square)).toEqual(['e8', 'a8'])
  })

  it('is not a fork when the forking piece can simply be taken', () => {
    const move = play('r2qk3/8/8/3N4/8/8/8/4K3 w - - 0 1', 'Nc7+')
    expect(forkTargets(move)).toEqual([])
  })
})

describe('lineOutcome', () => {
  it('calls an even trade even', () => {
    const move = play('4k3/1p6/2n5/8/3N4/8/8/4K3 w - - 0 1', 'Nxc6')
    expect(lineOutcome(move, ['b7c6', 'e1e2', 'e8e7'])).toMatchObject({ swing: 0, lost: [], gained: [] })
  })

  it('counts a piece left to be taken', () => {
    const move = play('3rk3/8/8/8/8/8/8/3NK2R w - - 0 1', 'Rh2')
    expect(lineOutcome(move, ['d8d1', 'e1d1', 'e8e7', 'h2h3'])).toMatchObject({ swing: -3 + 5 })
  })

  it('finishes an exchange the line cuts off', () => {
    const move = play('4k3/1p6/2n5/8/3N4/8/8/4K3 w - - 0 1', 'Nxc6')
    // Only the recapture is known; nothing is left to take back.
    expect(lineOutcome(move, ['b7c6'])?.swing).toBe(0)
    // The reply stops right after taking an undefended piece.
    const hang = play('3rk3/8/8/8/8/8/8/3N2K1 w - - 0 1', 'Kg2')
    expect(lineOutcome(hang, ['d8d1'])?.swing).toBe(-3)
  })

  it('proves nothing without a reply line', () => {
    const move = play('4k3/8/8/8/8/8/8/3NK2R w - - 0 1', 'Nc3')
    expect(lineOutcome(move, [])).toBeNull()
  })
})
