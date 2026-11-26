/**
 * Wire protocol between the browser and the Gambit server (WebSocket, JSON).
 * Shared by `server/` and the client; keep it free of DOM and Node APIs.
 *
 * The server is authoritative: it validates moves, runs the clocks, picks the
 * colours and decides results. Clients send intents and render `RoomView`s.
 */
import type { Color, PieceSymbol, Square } from 'chess.js'
import type { GameOutcome } from '../game/notation'

export const PROTOCOL_VERSION = 1

/** Time controls offered online (ids match `TIME_CONTROLS` in game/constants). */
export const ONLINE_TIME_CONTROL_IDS = ['3+2', '5+0', '10+0', '15+10', 'none'] as const
export type OnlineTimeControlId = (typeof ONLINE_TIME_CONTROL_IDS)[number]

export const NICK_MIN = 2
export const NICK_MAX = 20
/** Room codes avoid look-alike characters (0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 5

/** Normalises a nickname; returns null when it is not acceptable. */
export function cleanNick(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  // Drop control characters and collapse whitespace.
  // eslint-disable-next-line no-control-regex
  const nick = raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
  if (nick.length < NICK_MIN || nick.length > NICK_MAX) return null
  return nick
}

export function isOnlineTimeControl(value: unknown): value is OnlineTimeControlId {
  return typeof value === 'string' && (ONLINE_TIME_CONTROL_IDS as readonly string[]).includes(value)
}

export type Visibility = 'public' | 'private'

export interface WireMove {
  from: Square
  to: Square
  promotion?: PieceSymbol
}

export interface PlayedMove extends WireMove {
  san: string
}

export type RoomStatus = 'waiting' | 'playing' | 'finished' | 'aborted'

export interface RoomPlayer {
  id: string
  nick: string
  connected: boolean
  /** Colour in the current game; null before the first start. */
  color: Color | null
}

export interface GameView {
  startFen: string
  moves: PlayedMove[]
  /** Remaining time in ms at `clockAt`; meaningless without a clock. */
  clock: { w: number; b: number }
  /** Server time (ms) the clock snapshot was taken. */
  clockAt: number
  /** True while the side to move is being charged. */
  clockRunning: boolean
  turn: Color
  /** Colour that offered a draw on the current move, if any. */
  drawOffer: Color | null
  outcome: GameOutcome | null
  /** Server time by which the side to move must make its first move, or the game is aborted. */
  abortAt: number | null
}

export interface RoomView {
  id: string
  code: string
  visibility: Visibility
  /** Opened by quick pairing: starts by itself once an opponent arrives. */
  quick: boolean
  timeControlId: OnlineTimeControlId
  hostId: string
  players: RoomPlayer[]
  status: RoomStatus
  game: GameView | null
  /** Player ids that asked for a rematch after the game. */
  rematch: string[]
  /** Server time an absent opponent loses by abandonment, if someone is away mid-game. */
  abandonAt: number | null
  /** Number of games played in this room (1 for the first). */
  round: number
}

export interface LobbyRoom {
  id: string
  code: string
  hostNick: string
  timeControlId: OnlineTimeControlId
  status: RoomStatus
  /** Nicknames of both players while a game is running. */
  players: string[]
  createdAt: number
}

export type ClientMessage =
  | { type: 'hello'; version: number; nick: string; token?: string }
  | { type: 'nick'; nick: string }
  | { type: 'create'; timeControlId: OnlineTimeControlId; visibility: Visibility }
  | { type: 'quick'; timeControlId: OnlineTimeControlId }
  | { type: 'join'; code: string }
  | { type: 'leave' }
  | { type: 'start' }
  | { type: 'move'; move: WireMove; ply: number }
  | { type: 'resign' }
  | { type: 'draw-offer' }
  | { type: 'draw-accept' }
  | { type: 'draw-decline' }
  | { type: 'rematch' }
  | { type: 'ping'; t: number }

export type ErrorCode =
  | 'bad-request'
  | 'bad-nick'
  | 'version'
  | 'not-found'
  | 'full'
  | 'not-host'
  | 'not-in-room'
  | 'already-in-room'
  | 'not-ready'
  | 'illegal-move'
  | 'not-your-turn'
  | 'game-over'
  | 'rate-limit'

export type ServerMessage =
  | { type: 'welcome'; playerId: string; token: string; nick: string; serverNow: number }
  | { type: 'lobby'; rooms: LobbyRoom[]; online: number; serverNow: number }
  | { type: 'room'; room: RoomView | null; serverNow: number }
  | { type: 'error'; code: ErrorCode; message: string }
  | { type: 'pong'; t: number; serverNow: number }

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  'bad-request': 'Neplatný požadavek.',
  'bad-nick': `Přezdívka musí mít ${NICK_MIN}–${NICK_MAX} znaků.`,
  version: 'Stránka je zastaralá, obnov ji prosím.',
  'not-found': 'Místnost neexistuje nebo už skončila.',
  full: 'Místnost je plná.',
  'not-host': 'Hru může spustit jen zakladatel místnosti.',
  'not-in-room': 'Nejsi v žádné místnosti.',
  'already-in-room': 'Už jsi v jiné místnosti.',
  'not-ready': 'Na hru je potřeba dva hráče.',
  'illegal-move': 'Neplatný tah.',
  'not-your-turn': 'Nejsi na tahu.',
  'game-over': 'Partie už skončila.',
  'rate-limit': 'Moc rychle, zkus to za chvíli.',
}

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
