import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ENGINE_LEVEL_ID,
  ENGINE_LEVELS,
  GAME_MODES,
  engineLevelLabel,
  getEngineLevel,
  isEngineLevelId,
  parseUciMove,
} from './engineLevels'

describe('parseUciMove', () => {
  it('parses plain and promotion moves', () => {
    expect(parseUciMove('e2e4')).toEqual({ from: 'e2', to: 'e4', promotion: undefined })
    expect(parseUciMove('a7a8q')).toEqual({ from: 'a7', to: 'a8', promotion: 'q' })
    expect(parseUciMove(' g7g8N ')).toEqual({ from: 'g7', to: 'g8', promotion: 'n' })
  })

  it('rejects malformed input', () => {
    for (const bad of ['', '(none)', 'e2', 'e2e9', 'i2i4', 'e7e8k', 'e2e4e5', '0000']) {
      expect(parseUciMove(bad)).toBeNull()
    }
  })
})

describe('engine levels', () => {
  it('have unique ids', () => {
    const ids = ENGINE_LEVELS.map((level) => level.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('are ordered from weakest to strongest, with full strength last', () => {
    const elos = ENGINE_LEVELS.slice(0, -1).map((level) => level.elo as number)
    expect(elos.every((elo) => typeof elo === 'number')).toBe(true)
    expect([...elos].sort((a, b) => a - b)).toEqual(elos)
    expect(ENGINE_LEVELS[ENGINE_LEVELS.length - 1].elo).toBeNull()
  })

  it('never get weaker settings as Elo rises', () => {
    for (let i = 1; i < ENGINE_LEVELS.length; i += 1) {
      const previous = ENGINE_LEVELS[i - 1]
      const level = ENGINE_LEVELS[i]
      expect(level.depth).toBeGreaterThanOrEqual(previous.depth)
      expect(level.skill).toBeGreaterThanOrEqual(previous.skill)
      expect(level.randomness).toBeLessThanOrEqual(previous.randomness)
    }
  })

  it('only limit strength inside the UCI_Elo range', () => {
    for (const level of ENGINE_LEVELS) {
      if (level.limitStrength) {
        expect(level.elo).not.toBeNull()
        expect(level.elo as number).toBeGreaterThanOrEqual(1320)
        expect(level.elo as number).toBeLessThanOrEqual(3190)
      }
      expect(level.randomness).toBeGreaterThanOrEqual(0)
      expect(level.randomness).toBeLessThanOrEqual(1)
    }
  })

  it('getEngineLevel falls back to the default level', () => {
    expect(getEngineLevel('2200').elo).toBe(2200)
    expect(getEngineLevel('nonsense').id).toBe(DEFAULT_ENGINE_LEVEL_ID)
    expect(getEngineLevel('').id).toBe(DEFAULT_ENGINE_LEVEL_ID)
  })

  it('validates stored ids', () => {
    expect(isEngineLevelId('max')).toBe(true)
    expect(isEngineLevelId('1600')).toBe(true)
    expect(isEngineLevelId('1601')).toBe(false)
    expect(isEngineLevelId(1600)).toBe(false)
    expect(isEngineLevelId(null)).toBe(false)
  })

  it('labels levels', () => {
    expect(engineLevelLabel(getEngineLevel('800'))).toBe('Elo 800')
    expect(engineLevelLabel(getEngineLevel('max'))).toContain('Max')
  })

  it('exposes the two game modes', () => {
    expect(GAME_MODES).toEqual(['stockfish', 'human'])
  })
})
