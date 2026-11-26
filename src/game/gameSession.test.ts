import { describe, expect, it } from 'vitest'
import { parseGameSession } from './gameSession'
import type { SavedGameSession } from './gameSession'

const sample: SavedGameSession = {
  version: 1,
  gameMode: 'stockfish',
  engineLevelId: 'intermediate',
  humanColor: 'w',
  gameHandicap: 'none',
  timeControlId: 'none',
  startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: [
    { from: 'e2', to: 'e4' },
    { from: 'e7', to: 'e5' },
  ],
  clock: { w: 0, b: 0 },
  clockHistory: [{ w: 0, b: 0 }],
  durationSeconds: 12,
}

describe('parseGameSession', () => {
  it('parses a valid saved session', () => {
    const parsed = parseGameSession(JSON.stringify(sample))
    expect(parsed).toEqual(sample)
  })

  it('returns null for empty, invalid JSON, or wrong version', () => {
    expect(parseGameSession(null)).toBeNull()
    expect(parseGameSession('')).toBeNull()
    expect(parseGameSession('{bad')).toBeNull()
    expect(parseGameSession(JSON.stringify({ ...sample, version: 2 }))).toBeNull()
  })

  it('returns null when moves or clock are malformed', () => {
    expect(parseGameSession(JSON.stringify({ ...sample, moves: [{ from: 'e2' }] }))).toBeNull()
    expect(parseGameSession(JSON.stringify({ ...sample, clock: { w: -1, b: 0 } }))).toBeNull()
  })
})
