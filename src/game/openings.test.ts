import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { OPENING_LINES, openingName } from './openings'

function play(moves: string) {
  const chess = new Chess()
  for (const san of moves.split(' ')) chess.move(san)
  return chess.history({ verbose: true })
}

describe('opening names', () => {
  it('every listed line is legal and written in canonical SAN', () => {
    for (const [name, moves] of OPENING_LINES) {
      expect(() => play(moves), name).not.toThrow()
      expect(play(moves).map((move) => move.san).join(' '), name).toBe(moves)
      expect(play(moves).length, name).toBeLessThanOrEqual(30)
    }
  })

  it('no position carries two different names', () => {
    const seen = new Map<string, string>()
    for (const [name, moves] of OPENING_LINES) {
      const history = play(moves)
      const key = history[history.length - 1].after.split(' ', 3).join(' ')
      expect(seen.get(key) ?? name, moves).toBe(name)
      seen.set(key, name)
    }
  })

  it('names the deepest position reached and keeps it afterwards', () => {
    const history = play('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5')
    expect(openingName(history, 0)).toBeNull()
    expect(openingName(history, 1)).toBe('Hra královským pěšcem')
    expect(openingName(history, 2)).toBe('Sicilská obrana')
    expect(openingName(history)).toBe('Sicilská obrana: Najdorfova varianta')
  })

  it('recognises a transposition', () => {
    expect(openingName(play('Nf3 Nc6 e4 e5 Bc4'))).toBe('Italská hra')
    expect(openingName(play('c4 e6 d4 d5'))).toBe('Dámský gambit: odmítnutý')
  })
})
