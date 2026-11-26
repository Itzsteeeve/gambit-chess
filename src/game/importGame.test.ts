import { describe, expect, it } from 'vitest'
import { GameModel } from './gameModel'
import { DEFAULT_FEN } from './handicap'
import { isPlayablePosition, normalizePosition, parseImport } from './importGame'
import type { ImportedGame } from './importGame'
import { groupMoves, moveLabel } from './notation'

const ENDGAME = '8/8/8/4k3/8/8/4P3/4K3 b - - 4 40'

function gameFrom(text: string): ImportedGame {
  const result = parseImport(text)
  if (result.kind !== 'game') throw new Error(`expected a game, got ${JSON.stringify(result)}`)
  return result.game
}

function errorFrom(text: string): string {
  const result = parseImport(text)
  if (result.kind !== 'error') throw new Error(`expected an error, got ${result.kind}`)
  return result.message
}

describe('FEN import', () => {
  it('accepts a full FEN and one with the trailing fields left out', () => {
    expect(parseImport(ENDGAME)).toEqual({ kind: 'position', fen: ENDGAME })
    expect(parseImport('  8/8/8/4k3/8/8/4P3/4K3  ')).toEqual({
      kind: 'position',
      fen: '8/8/8/4k3/8/8/4P3/4K3 w - - 0 1',
    })
  })

  it('drops castling rights and en passant squares the board does not support', () => {
    const result = normalizePosition('4k3/8/8/8/8/8/8/4K2R w KQkq e6 0 1')
    expect(result).toEqual({ ok: true, fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1' })
  })

  it('refuses positions the engine cannot play', () => {
    // No black king.
    expect(errorFrom('8/8/8/8/8/8/4P3/4K3 w - - 0 1')).toContain('Neplatný FEN')
    // White to move while the black king is already attacked.
    expect(errorFrom('4k3/8/8/8/8/8/8/4R1K1 w - - 0 1')).toContain('v šachu')
    // Nine white pawns, and more queens than promotions allow.
    expect(errorFrom('4k3/8/8/8/8/P7/PPPPPPPP/4K3 w - - 0 1')).toContain('víc figur')
    expect(errorFrom('4k3/8/8/8/8/8/PPPPPPPP/QQ2K3 w - - 0 1')).toContain('víc figur')
  })

  it('refuses a position where the game is already over', () => {
    expect(errorFrom('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1')).toContain('skončila')
    expect(errorFrom('4k3/8/8/8/8/8/8/4K3 w - - 0 1')).toContain('skončila')
    expect(isPlayablePosition(DEFAULT_FEN)).toBe(true)
    expect(isPlayablePosition('not a position')).toBe(false)
  })
})

describe('PGN import', () => {
  const LICHESS = `[Event "Rated Blitz game"]
[Site "https://lichess.org/abcdefgh"]
[White "alice"]
[Black "bob"]
[Result "0-1"]
[WhiteElo "1500"]
[BlackElo "?"]

1. e4 { [%clk 0:03:00] } e5 { [%clk 0:03:00] } 2. Bc4?! (2. Nf3 Nc6) Nc6 $1 3. Qh5 g6 0-1`

  it('reads the main line, players and result, ignoring comments and variations', () => {
    const game = gameFrom(LICHESS)
    expect(game.moves).toHaveLength(6)
    expect(game.white).toBe('alice')
    expect(game.black).toBe('bob')
    expect(game.whiteElo).toBe('1500')
    expect(game.blackElo).toBeNull()
    expect(game.startFen).toBeUndefined()
    expect(game.outcome).toEqual({ winner: 'b', reason: 'record' })
    expect(game.hasMoreGames).toBe(false)
  })

  it('reads a bare move list as an unfinished game', () => {
    const game = gameFrom('1. d4 d5 2. c4')
    expect(game.moves).toHaveLength(3)
    expect(game.white).toBe('Bílý')
    expect(game.outcome).toEqual({ winner: null, reason: 'unfinished' })
  })

  it('takes the result from the board when the game ends in mate', () => {
    expect(gameFrom('1. f3 e5 2. g4 Qh4#').outcome).toEqual({ winner: 'b', reason: 'checkmate' })
  })

  it('reads only the first game of a collection', () => {
    const game = gameFrom(`${LICHESS}\n\n[Event "Second"]\n\n1. d4 *`)
    expect(game.moves).toHaveLength(6)
    expect(game.hasMoreGames).toBe(true)
  })

  it('plays on past a repetition nobody claimed', () => {
    const game = gameFrom('1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 5. e4 e5 1-0')
    expect(game.outcome).toEqual({ winner: 'w', reason: 'record' })
    const model = new GameModel()
    model.load(game)
    expect(model.state.history).toHaveLength(10)
    expect(model.state.outcome).toEqual(game.outcome)
    // The repeated position inside the game is not shown as finished.
    expect(model.positionAt(8)?.outcome).toBeNull()
  })

  it('keeps a custom start position', () => {
    const game = gameFrom(`[SetUp "1"]\n[FEN "${ENDGAME}"]\n\n40... Kd5 41. Kd2 *`)
    expect(game.startFen).toBe(ENDGAME)
    expect(game.moves).toHaveLength(2)
  })

  it('treats a record with only a position as that position', () => {
    expect(parseImport(`[SetUp "1"]\n[FEN "${ENDGAME}"]\n\n*`)).toEqual({ kind: 'position', fen: ENDGAME })
  })

  it('explains what is wrong', () => {
    expect(errorFrom('')).toContain('Vlož')
    expect(errorFrom('1. e4 e5 2. Ke3')).toContain('Ke3')
    expect(errorFrom('ahoj')).toBeTruthy()
    expect(errorFrom('[Event "x"]\n[Result "*"]\n\n*')).toContain('žádné tahy')
    expect(errorFrom('[Variant "Chess960"]\n\n1. e4 *')).toContain('Chess960')
  })
})

describe('GameModel.load', () => {
  const model = new GameModel()
  const game = gameFrom('[White "alice"]\n[Result "*"]\n\n1. e4 d5 2. exd5 Qxd5 *')
  model.load(game)

  it('builds the history, pieces and review positions', () => {
    expect(model.state.history.map((move) => move.san)).toEqual(['e4', 'd5', 'exd5', 'Qxd5'])
    expect(model.state.pieces).toHaveLength(30)
    expect(model.positionAt(0)?.fen).toBe(DEFAULT_FEN)
    expect(model.positionAt(2)?.pieces).toHaveLength(32)
    expect(model.canUndo).toBe(false)
  })

  it('exports the record again', () => {
    const pgn = model.getPgn()
    expect(pgn).toContain('[White "alice"]')
    expect(pgn).toContain('[Result "*"]')
    expect(gameFrom(pgn).moves).toEqual(game.moves)
  })
})

describe('move numbering from a custom position', () => {
  const model = new GameModel()
  model.reset({ fen: ENDGAME })
  model.move('e5', 'd5')
  model.move('e1', 'd2')
  model.move('d5', 'e4')

  it('follows the FEN, also when Black moves first', () => {
    expect(model.state.history.map(moveLabel)).toEqual(['40... Kd5', '41. Kd2', '41... Ke4'])
    const rows = groupMoves(model.state.history)
    expect(rows.map((row) => [row.number, row.white?.san, row.black?.san])).toEqual([
      [40, undefined, 'Kd5'],
      [41, 'Kd2', 'Ke4'],
    ])
  })
})
