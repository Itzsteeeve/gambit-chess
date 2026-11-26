import type { Color, PieceSymbol, Square } from 'chess.js'
import type { GameMode } from './engineLevels'
import type { HandicapId } from './handicap'
import type { ClockSnapshot } from './useChessClock'

export const GAME_SESSION_KEY = 'gambit.session-game'

export interface SavedMove {
  from: Square
  to: Square
  promotion?: PieceSymbol
}

export interface SavedGameSession {
  version: 1
  gameMode: GameMode
  engineLevelId: string
  humanColor: Color
  gameHandicap: HandicapId
  timeControlId: string
  startFen: string
  moves: SavedMove[]
  clock: ClockSnapshot
  clockHistory: ClockSnapshot[]
  durationSeconds: number
}

function isClockSnapshot(value: unknown): value is ClockSnapshot {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.w === 'number' &&
    Number.isFinite(record.w) &&
    record.w >= 0 &&
    typeof record.b === 'number' &&
    Number.isFinite(record.b) &&
    record.b >= 0
  )
}

function isSavedMove(value: unknown): value is SavedMove {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (typeof record.from !== 'string' || typeof record.to !== 'string') return false
  if (record.promotion !== undefined && typeof record.promotion !== 'string') return false
  return true
}

export function parseGameSession(raw: string | null): SavedGameSession | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    if (!data || typeof data !== 'object' || data.version !== 1) return null
    if (data.gameMode !== 'stockfish' && data.gameMode !== 'human') return null
    if (typeof data.engineLevelId !== 'string') return null
    if (data.humanColor !== 'w' && data.humanColor !== 'b') return null
    if (typeof data.gameHandicap !== 'string') return null
    if (typeof data.timeControlId !== 'string') return null
    if (typeof data.startFen !== 'string' || !data.startFen) return null
    if (!Array.isArray(data.moves) || !data.moves.every(isSavedMove)) return null
    if (!isClockSnapshot(data.clock)) return null
    if (!Array.isArray(data.clockHistory) || !data.clockHistory.every(isClockSnapshot)) return null
    if (typeof data.durationSeconds !== 'number' || !Number.isFinite(data.durationSeconds)) return null
    return data as unknown as SavedGameSession
  } catch {
    return null
  }
}

export function loadGameSession(): SavedGameSession | null {
  try {
    return parseGameSession(window.sessionStorage.getItem(GAME_SESSION_KEY))
  } catch {
    return null
  }
}

export function saveGameSession(session: SavedGameSession): void {
  try {
    window.sessionStorage.setItem(GAME_SESSION_KEY, JSON.stringify(session))
  } catch {
    // Ignore storage quota / privacy mode errors.
  }
}

export function clearGameSession(): void {
  try {
    window.sessionStorage.removeItem(GAME_SESSION_KEY)
  } catch {
    // Ignore privacy mode errors.
  }
}
