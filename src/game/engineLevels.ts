/**
 * Difficulty presets. Stockfish 19 exposes `UCI_Elo` from 1320 to 3190; below
 * that range we lean on `Skill Level`, a shallow search depth and a chance to
 * pick a random legal move, which produces believable beginner play.
 * Full strength ('max') runs without limits at ~3500+ Elo.
 */
export interface EngineLevel {
  id: string
  /** Displayed Elo. `null` means full strength (~3500+ Elo). */
  elo: number | null
  label: string
  name: string
  description: string
  skill: number
  depth: number
  limitStrength: boolean
  /** 0–1 chance to replace the engine move with a random legal move. */
  randomness: number
}

export const ENGINE_LEVELS: EngineLevel[] = [
  {
    id: '250',
    elo: 250,
    label: '250',
    name: 'Úplný začátečník',
    description: 'Hraje chaoticky, často rozdává figury zadarmo. Vhodné pro první krůčky.',
    skill: 0,
    depth: 1,
    limitStrength: false,
    randomness: 0.6,
  },
  {
    id: '400',
    elo: 400,
    label: '400',
    name: 'Začátečník',
    description: 'Zná tahy figur, ale přehlíží základní braní a dvoutahové hrozby.',
    skill: 0,
    depth: 1,
    limitStrength: false,
    randomness: 0.42,
  },
  {
    id: '600',
    elo: 600,
    label: '600',
    name: 'Mírně pokročilý',
    description: 'Hraje přímočaře dopředu, občas napadne figuru, ale dělá hrubky.',
    skill: 1,
    depth: 2,
    limitStrength: false,
    randomness: 0.3,
  },
  {
    id: '800',
    elo: 800,
    label: '800',
    name: 'Nováček',
    description: 'Učí se pravidla a základy, často přehlédne jednoduchou taktiku.',
    skill: 2,
    depth: 2,
    limitStrength: false,
    randomness: 0.22,
  },
  {
    id: '1000',
    elo: 1000,
    label: '1000',
    name: 'Začátečník s praxí',
    description: 'Zná základní maty a otevření, ale pod tlakem nabízí dárky.',
    skill: 3,
    depth: 3,
    limitStrength: false,
    randomness: 0.15,
  },
  {
    id: '1200',
    elo: 1200,
    label: '1200',
    name: 'Hobby hráč',
    description: 'Hraje od oka, občas zahrozí nepříjemným taktickým úderem.',
    skill: 5,
    depth: 4,
    limitStrength: false,
    randomness: 0.08,
  },
  {
    id: '1400',
    elo: 1400,
    label: '1400',
    name: 'Klubový hráč',
    description: 'Solidní základy, vidí dvoutahové kombinace a trestá pasivitu.',
    skill: 7,
    depth: 5,
    limitStrength: true,
    randomness: 0.03,
  },
  {
    id: '1600',
    elo: 1600,
    label: '1600',
    name: 'Pokročilý',
    description: 'Trestá chyby, ovládá základy koncovek a umí hrát plán.',
    skill: 9,
    depth: 6,
    limitStrength: true,
    randomness: 0.01,
  },
  {
    id: '1800',
    elo: 1800,
    label: '1800',
    name: 'Expert',
    description: 'Silná taktika i poziční strategie. Velmi těžký soupeř.',
    skill: 11,
    depth: 8,
    limitStrength: true,
    randomness: 0,
  },
  {
    id: '2000',
    elo: 2000,
    label: '2000',
    name: 'Kandidát mistra',
    description: 'Turnajová úroveň, málokdy chybuje a počítá hluboké varianty.',
    skill: 13,
    depth: 9,
    limitStrength: true,
    randomness: 0,
  },
  {
    id: '2200',
    elo: 2200,
    label: '2200',
    name: 'Národní mistr',
    description: 'Přesná poziční i taktická hra bez zbytečných slabin.',
    skill: 15,
    depth: 10,
    limitStrength: true,
    randomness: 0,
  },
  {
    id: '2500',
    elo: 2500,
    label: '2500',
    name: 'Mezinárodní velmistr',
    description: 'Titulovaný hráč (GM). Hraje nemilosrdně a precizně.',
    skill: 18,
    depth: 12,
    limitStrength: true,
    randomness: 0,
  },
  {
    id: '2800',
    elo: 2800,
    label: '2800',
    name: 'Super GM',
    description: 'Špičková světová úroveň (úroveň Magnuse Carlsena).',
    skill: 20,
    depth: 14,
    limitStrength: true,
    randomness: 0,
  },
  {
    id: 'max',
    elo: null,
    label: 'Max',
    name: 'Plná síla',
    description: 'Nejvyšší úroveň (~3500+ Elo). Stockfish v plné síle bez jakéhokoli omezení.',
    skill: 20,
    depth: 18,
    limitStrength: false,
    randomness: 0,
  },
]

export const DEFAULT_ENGINE_LEVEL_ID = '1600'

export function isEngineLevelId(id: unknown): id is string {
  return typeof id === 'string' && ENGINE_LEVELS.some((level) => level.id === id)
}

export function getEngineLevel(id: string): EngineLevel {
  return (
    ENGINE_LEVELS.find((level) => level.id === id) ??
    ENGINE_LEVELS.find((level) => level.id === DEFAULT_ENGINE_LEVEL_ID) ??
    ENGINE_LEVELS[0]
  )
}

export function engineLevelLabel(level: EngineLevel): string {
  return level.elo === null ? '⚡ Max (3500+ Elo)' : `Elo ${level.elo}`
}

export type GameMode = 'stockfish' | 'human'

export const GAME_MODES: readonly GameMode[] = ['stockfish', 'human']

export function parseUciMove(uci: string): {
  from: string
  to: string
  promotion?: 'q' | 'r' | 'b' | 'n'
} | null {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/i.exec(uci.trim())
  if (!match) return null
  return {
    from: match[1],
    to: match[2],
    promotion: match[3]?.toLowerCase() as 'q' | 'r' | 'b' | 'n' | undefined,
  }
}
