/**
 * Online rooms: players, lobby, pairing and authoritative games.
 *
 * Framework-free and deterministic: time is always passed in (`now`, ms) and
 * randomness comes from `deps`, so tests drive it without timers or sockets.
 * The socket layer (`server/index.ts`) calls these methods, then sends the
 * views of whatever `onRoomChange` / `onLobbyChange` reported.
 */
import { Chess } from 'chess.js'
import type { Color } from 'chess.js'
import { opposite, getTimeControl } from '../src/game/constants'
import { detectOutcome, timeoutOutcome } from '../src/game/gameModel'
import type { GameOutcome } from '../src/game/notation'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, cleanNick, normalizeRoomCode } from '../src/online/protocol'
import type {
  ErrorCode,
  GameView,
  LobbyRoom,
  OnlineTimeControlId,
  PlayedMove,
  RoomView,
  Visibility,
  WireMove,
} from '../src/online/protocol'

/** Each side must make its first move within this time, or the game is aborted. */
export const ABORT_MS = 30_000
/** A player disconnected mid-game for this long loses by abandonment. */
export const ABANDON_MS = 60_000
/** A waiting room whose players are all away for this long is closed. */
export const WAITING_AWAY_MS = 2 * 60_000
/** A finished room nobody is connected to is closed after this long. */
export const FINISHED_AWAY_MS = 60_000
/** A finished room is closed after this much inactivity, connected or not. */
export const FINISHED_IDLE_MS = 30 * 60_000
/** Players without sockets are forgotten after this long (their token stops working). */
export const PLAYER_FORGET_MS = 24 * 60 * 60_000

export class RoomError extends Error {
  readonly code: ErrorCode
  constructor(code: ErrorCode) {
    super(code)
    this.code = code
  }
}

export interface Player {
  id: string
  token: string
  nick: string
  roomId: string | null
  sockets: number
  /** When the last socket closed; null while connected. */
  awaySince: number | null
}

interface Game {
  chess: Chess
  startFen: string
  moves: PlayedMove[]
  colors: Record<Color, string>
  clock: Record<Color, number>
  /** When the side to move started its turn. */
  turnStart: number
  drawOffer: Color | null
  /** Ply at which each side last offered a draw (one offer per move). */
  lastOfferPly: Record<Color, number>
  outcome: GameOutcome | null
}

interface Room {
  id: string
  code: string
  visibility: Visibility
  timeControlId: OnlineTimeControlId
  /** Created by quick pairing: the game starts as soon as a second player joins. */
  quick: boolean
  hostId: string
  playerIds: string[]
  status: RoomView['status']
  game: Game | null
  rematch: Set<string>
  createdAt: number
  updatedAt: number
  round: number
}

export interface RoomDeps {
  /** Unguessable id (tokens, ids). */
  randomId: () => string
  /** Uniform integer in [0, n). */
  randomInt: (n: number) => number
  /** A room's view changed (or it closed: then `roomView` returns null). */
  onRoomChange?: (roomId: string, memberIds: string[]) => void
  onLobbyChange?: () => void
}

export class RoomManager {
  private readonly players = new Map<string, Player>()
  private readonly byToken = new Map<string, string>()
  private readonly rooms = new Map<string, Room>()
  private readonly byCode = new Map<string, string>()
  private readonly deps: RoomDeps

  constructor(deps: RoomDeps) {
    this.deps = deps
  }

  // ── Players ────────────────────────────────────────────────────────────

  /** Identifies a connection: resumes the player behind `token`, or creates one. */
  hello(nickRaw: string, token: string | undefined, now: number): Player {
    const nick = cleanNick(nickRaw)
    if (!nick) throw new RoomError('bad-nick')
    const existingId = token ? this.byToken.get(token) : undefined
    let player = existingId ? this.players.get(existingId) : undefined
    if (!player) {
      player = { id: this.deps.randomId(), token: this.deps.randomId(), nick, roomId: null, sockets: 0, awaySince: now }
      this.players.set(player.id, player)
      this.byToken.set(player.token, player.id)
    } else if (player.nick !== nick) {
      this.renameInternal(player, nick)
    }
    return player
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId)
  }

  connect(playerId: string): void {
    const player = this.mustPlayer(playerId)
    player.sockets += 1
    if (player.awaySince !== null) {
      player.awaySince = null
      this.touchPlayerRoom(player)
    }
  }

  disconnect(playerId: string, now: number): void {
    const player = this.players.get(playerId)
    if (!player) return
    player.sockets = Math.max(0, player.sockets - 1)
    if (player.sockets === 0) {
      player.awaySince = now
      this.touchPlayerRoom(player)
    }
  }

  rename(playerId: string, nickRaw: string): void {
    const nick = cleanNick(nickRaw)
    if (!nick) throw new RoomError('bad-nick')
    this.renameInternal(this.mustPlayer(playerId), nick)
  }

  onlineCount(): number {
    let count = 0
    for (const player of this.players.values()) if (player.sockets > 0) count += 1
    return count
  }

  // ── Rooms ──────────────────────────────────────────────────────────────

  create(playerId: string, timeControlId: OnlineTimeControlId, visibility: Visibility, now: number): RoomView {
    const player = this.mustPlayer(playerId)
    this.leaveFinished(player, now)
    if (player.roomId) throw new RoomError('already-in-room')
    const room = this.newRoom(player, timeControlId, visibility, false, now)
    return this.view(room, now)
  }

  /**
   * Quick pairing: joins the oldest public room waiting for this time control
   * and starts the game at once, or opens a new quick room and waits.
   */
  quick(playerId: string, timeControlId: OnlineTimeControlId, now: number): RoomView {
    const player = this.mustPlayer(playerId)
    this.leaveFinished(player, now)
    if (player.roomId) throw new RoomError('already-in-room')
    let match: Room | null = null
    for (const room of this.rooms.values()) {
      if (room.status !== 'waiting' || room.visibility !== 'public') continue
      if (room.timeControlId !== timeControlId || room.playerIds.length !== 1) continue
      const host = this.players.get(room.hostId)
      if (!host || host.sockets === 0) continue
      if (!match || room.createdAt < match.createdAt) match = room
    }
    if (!match) {
      const room = this.newRoom(player, timeControlId, 'public', true, now)
      return this.view(room, now)
    }
    this.addToRoom(match, player, now)
    this.startGame(match, now)
    return this.view(match, now)
  }

  join(playerId: string, codeRaw: string, now: number): RoomView {
    const player = this.mustPlayer(playerId)
    const roomId = this.byCode.get(normalizeRoomCode(codeRaw))
    const room = roomId ? this.rooms.get(roomId) : undefined
    if (!room) throw new RoomError('not-found')
    if (player.roomId === room.id) return this.view(room, now)
    this.leaveFinished(player, now)
    if (player.roomId) throw new RoomError('already-in-room')
    if (room.status !== 'waiting') throw new RoomError(room.playerIds.length >= 2 ? 'full' : 'not-found')
    if (room.playerIds.length >= 2) throw new RoomError('full')
    this.addToRoom(room, player, now)
    if (room.quick) this.startGame(room, now)
    return this.view(room, now)
  }

  /** Leaves the current room. Mid-game this resigns (or aborts before both have moved). */
  leave(playerId: string, now: number): void {
    const player = this.mustPlayer(playerId)
    const room = player.roomId ? this.rooms.get(player.roomId) : undefined
    if (!room) {
      player.roomId = null
      return
    }
    if (room.status === 'playing' && room.game) {
      const color = this.colorOf(room, player.id)
      if (room.game.moves.length < 2) this.abort(room, now)
      else this.finish(room, { winner: opposite(color), reason: 'resignation' }, now)
    }
    this.removeFromRoom(room, player, now)
  }

  start(playerId: string, now: number): RoomView {
    const room = this.roomOf(playerId)
    if (room.hostId !== playerId) throw new RoomError('not-host')
    if (room.status !== 'waiting') throw new RoomError('bad-request')
    if (room.playerIds.length !== 2) throw new RoomError('not-ready')
    this.startGame(room, now)
    return this.view(room, now)
  }

  // ── Game actions ───────────────────────────────────────────────────────

  move(playerId: string, move: WireMove, ply: number, now: number): void {
    const room = this.roomOf(playerId)
    const game = this.liveGame(room)
    const color = this.colorOf(room, playerId)
    // A late move may arrive after the flag fell; settle the clock first.
    this.checkClock(room, now)
    if (game.outcome) throw new RoomError('game-over')
    if (game.chess.turn() !== color) throw new RoomError('not-your-turn')
    if (ply !== game.moves.length) throw new RoomError('illegal-move')

    let san: string
    try {
      san = game.chess.move({ from: move.from, to: move.to, promotion: move.promotion }).san
    } catch {
      throw new RoomError('illegal-move')
    }
    const clockWasRunning = this.clockRunning(room)
    if (clockWasRunning) {
      game.clock[color] = Math.max(0, game.clock[color] - (now - game.turnStart))
      game.clock[color] += getTimeControl(room.timeControlId).increment * 1000
    }
    game.moves.push({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}), san })
    game.turnStart = now
    // Moving declines the opponent's standing draw offer.
    if (game.drawOffer && game.drawOffer !== color) game.drawOffer = null
    room.updatedAt = now

    const outcome = detectOutcome(game.chess)
    if (outcome) this.finish(room, outcome, now)
    else this.changed(room)
  }

  resign(playerId: string, now: number): void {
    const room = this.roomOf(playerId)
    this.liveGame(room)
    const color = this.colorOf(room, playerId)
    this.finish(room, { winner: opposite(color), reason: 'resignation' }, now)
  }

  offerDraw(playerId: string, now: number): void {
    const room = this.roomOf(playerId)
    const game = this.liveGame(room)
    const color = this.colorOf(room, playerId)
    if (game.drawOffer === opposite(color)) {
      this.finish(room, { winner: null, reason: 'agreement' }, now)
      return
    }
    if (game.drawOffer === color || game.lastOfferPly[color] === game.moves.length) return
    game.drawOffer = color
    game.lastOfferPly[color] = game.moves.length
    room.updatedAt = now
    this.changed(room)
  }

  acceptDraw(playerId: string, now: number): void {
    const room = this.roomOf(playerId)
    const game = this.liveGame(room)
    const color = this.colorOf(room, playerId)
    if (game.drawOffer !== opposite(color)) throw new RoomError('bad-request')
    this.finish(room, { winner: null, reason: 'agreement' }, now)
  }

  declineDraw(playerId: string, now: number): void {
    const room = this.roomOf(playerId)
    const game = this.liveGame(room)
    const color = this.colorOf(room, playerId)
    if (game.drawOffer !== opposite(color)) return
    game.drawOffer = null
    room.updatedAt = now
    this.changed(room)
  }

  /** Asks for a rematch; when both asked, a new game starts with colours swapped. */
  rematch(playerId: string, now: number): void {
    const room = this.roomOf(playerId)
    if (room.status !== 'finished' && room.status !== 'aborted') throw new RoomError('bad-request')
    if (room.playerIds.length !== 2) throw new RoomError('not-ready')
    room.rematch.add(playerId)
    room.updatedAt = now
    if (room.rematch.size === 2) {
      const previous = room.game?.colors ?? null
      this.startGame(room, now, previous ? { w: previous.b, b: previous.w } : null)
    } else {
      this.changed(room)
    }
  }

  // ── Time ───────────────────────────────────────────────────────────────

  /** Flags, aborts, abandonment and cleanup. Call a few times per second. */
  tick(now: number): void {
    for (const room of [...this.rooms.values()]) {
      if (room.status === 'playing' && room.game) {
        this.checkClock(room, now)
        if (room.status !== 'playing') continue
        const abortAt = this.abortAt(room)
        if (abortAt !== null && now >= abortAt) {
          this.abort(room, now)
          continue
        }
        const away = room.playerIds
          .map((id) => this.players.get(id))
          .filter((player): player is Player => !!player && player.awaySince !== null && now - player.awaySince >= ABANDON_MS)
        if (away.length === 2) this.finish(room, { winner: null, reason: 'abandonment' }, now)
        else if (away.length === 1) {
          const loser = this.colorOf(room, away[0].id)
          this.finish(room, { winner: opposite(loser), reason: 'abandonment' }, now)
        }
        continue
      }
      const present = room.playerIds.some((id) => (this.players.get(id)?.sockets ?? 0) > 0)
      const awayFor = present ? 0 : now - this.lastAway(room, now)
      if (room.status === 'waiting') {
        if (!present && awayFor >= WAITING_AWAY_MS) this.closeRoom(room)
      } else if ((!present && awayFor >= FINISHED_AWAY_MS) || now - room.updatedAt >= FINISHED_IDLE_MS) {
        this.closeRoom(room)
      }
    }
    for (const player of [...this.players.values()]) {
      if (player.sockets === 0 && player.awaySince !== null && !player.roomId && now - player.awaySince >= PLAYER_FORGET_MS) {
        this.players.delete(player.id)
        this.byToken.delete(player.token)
      }
    }
  }

  // ── Views ──────────────────────────────────────────────────────────────

  roomViewFor(playerId: string, now: number): RoomView | null {
    const player = this.players.get(playerId)
    const room = player?.roomId ? this.rooms.get(player.roomId) : undefined
    return room ? this.view(room, now) : null
  }

  roomView(roomId: string, now: number): RoomView | null {
    const room = this.rooms.get(roomId)
    return room ? this.view(room, now) : null
  }

  lobby(): LobbyRoom[] {
    const list: LobbyRoom[] = []
    for (const room of this.rooms.values()) {
      if (room.visibility !== 'public') continue
      if (room.status !== 'waiting' && room.status !== 'playing') continue
      const host = this.players.get(room.hostId)
      if (room.status === 'waiting' && (!host || host.sockets === 0)) continue
      list.push({
        id: room.id,
        code: room.code,
        hostNick: host?.nick ?? '?',
        timeControlId: room.timeControlId,
        status: room.status,
        players: room.playerIds.map((id) => this.players.get(id)?.nick ?? '?'),
        createdAt: room.createdAt,
      })
    }
    return list.sort((a, b) =>
      a.status === b.status ? a.createdAt - b.createdAt : a.status === 'waiting' ? -1 : 1,
    )
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private view(room: Room, now: number): RoomView {
    const game = room.game
    let gameView: GameView | null = null
    if (game) {
      const running = this.clockRunning(room)
      const turn = game.chess.turn()
      const clock = { ...game.clock }
      if (running) clock[turn] = Math.max(0, clock[turn] - (now - game.turnStart))
      gameView = {
        startFen: game.startFen,
        moves: game.moves.slice(),
        clock,
        clockAt: now,
        clockRunning: running,
        turn,
        drawOffer: game.drawOffer,
        outcome: game.outcome,
        abortAt: room.status === 'playing' ? this.abortAt(room) : null,
      }
    }
    let abandonAt: number | null = null
    if (room.status === 'playing') {
      for (const id of room.playerIds) {
        const away = this.players.get(id)?.awaySince
        if (away != null && (abandonAt === null || away + ABANDON_MS < abandonAt)) abandonAt = away + ABANDON_MS
      }
    }
    return {
      id: room.id,
      code: room.code,
      visibility: room.visibility,
      quick: room.quick,
      timeControlId: room.timeControlId,
      hostId: room.hostId,
      players: room.playerIds.map((id) => {
        const player = this.players.get(id)
        return {
          id,
          nick: player?.nick ?? '?',
          connected: (player?.sockets ?? 0) > 0,
          color: game ? (game.colors.w === id ? 'w' : game.colors.b === id ? 'b' : null) : null,
        }
      }),
      status: room.status,
      game: gameView,
      rematch: [...room.rematch],
      abandonAt,
      round: room.round,
    }
  }

  private newRoom(host: Player, timeControlId: OnlineTimeControlId, visibility: Visibility, quick: boolean, now: number): Room {
    const room: Room = {
      id: this.deps.randomId(),
      code: this.uniqueCode(),
      visibility,
      timeControlId,
      quick,
      hostId: host.id,
      playerIds: [host.id],
      status: 'waiting',
      game: null,
      rematch: new Set(),
      createdAt: now,
      updatedAt: now,
      round: 0,
    }
    this.rooms.set(room.id, room)
    this.byCode.set(room.code, room.id)
    host.roomId = room.id
    this.changed(room, true)
    return room
  }

  private uniqueCode(): string {
    for (;;) {
      let code = ''
      for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
        code += ROOM_CODE_ALPHABET[this.deps.randomInt(ROOM_CODE_ALPHABET.length)]
      }
      if (!this.byCode.has(code)) return code
    }
  }

  private addToRoom(room: Room, player: Player, now: number): void {
    room.playerIds.push(player.id)
    player.roomId = room.id
    room.updatedAt = now
    this.changed(room, true)
  }

  private removeFromRoom(room: Room, player: Player, now: number): void {
    room.playerIds = room.playerIds.filter((id) => id !== player.id)
    room.rematch.delete(player.id)
    player.roomId = null
    room.updatedAt = now
    if (room.playerIds.length === 0) {
      this.closeRoom(room)
      return
    }
    if (room.hostId === player.id) room.hostId = room.playerIds[0]
    // The one who stays waits for a new opponent in the same room.
    if (room.status !== 'playing') {
      room.status = 'waiting'
      room.rematch.clear()
    }
    this.changed(room, true)
  }

  /** A player who is still sitting in a finished room may start something new. */
  private leaveFinished(player: Player, now: number): void {
    const room = player.roomId ? this.rooms.get(player.roomId) : undefined
    if (!room) {
      player.roomId = null
      return
    }
    if (room.status === 'finished' || room.status === 'aborted') this.removeFromRoom(room, player, now)
    else if (room.status === 'waiting' && room.playerIds.length === 1) this.removeFromRoom(room, player, now)
  }

  private closeRoom(room: Room): void {
    for (const id of room.playerIds) {
      const player = this.players.get(id)
      if (player && player.roomId === room.id) player.roomId = null
    }
    const members = room.playerIds
    room.playerIds = []
    this.rooms.delete(room.id)
    this.byCode.delete(room.code)
    // Members get one last (null) view so they know the room is gone.
    this.deps.onRoomChange?.(room.id, members)
    this.deps.onLobbyChange?.()
  }

  private startGame(room: Room, now: number, colors: Record<Color, string> | null = null): void {
    const [a, b] = room.playerIds
    const assigned = colors ?? (this.deps.randomInt(2) === 0 ? { w: a, b } : { w: b, b: a })
    const chess = new Chess()
    const initial = getTimeControl(room.timeControlId).minutes * 60_000
    room.game = {
      chess,
      startFen: chess.fen(),
      moves: [],
      colors: assigned,
      clock: { w: initial, b: initial },
      turnStart: now,
      drawOffer: null,
      lastOfferPly: { w: -1, b: -1 },
      outcome: null,
    }
    room.status = 'playing'
    room.rematch.clear()
    room.round += 1
    room.updatedAt = now
    this.changed(room, true)
  }

  private finish(room: Room, outcome: GameOutcome, now: number): void {
    const game = room.game
    if (!game || game.outcome) return
    if (this.clockRunning(room)) {
      const turn = game.chess.turn()
      game.clock[turn] = Math.max(0, game.clock[turn] - (now - game.turnStart))
    }
    game.outcome = outcome
    game.drawOffer = null
    room.status = 'finished'
    room.updatedAt = now
    this.changed(room, true)
  }

  private abort(room: Room, now: number): void {
    if (room.game) room.game.drawOffer = null
    room.status = 'aborted'
    room.updatedAt = now
    this.changed(room, true)
  }

  private checkClock(room: Room, now: number): void {
    const game = room.game
    if (!game || game.outcome || !this.clockRunning(room)) return
    const turn = game.chess.turn()
    if (game.clock[turn] - (now - game.turnStart) <= 0) {
      game.clock[turn] = 0
      game.turnStart = now
      this.finish(room, timeoutOutcome(game.chess.fen(), turn), now)
    }
  }

  /** Clocks run once both sides have made their first move (as on most servers). */
  private clockRunning(room: Room): boolean {
    const game = room.game
    if (!game || game.outcome || room.status !== 'playing') return false
    if (getTimeControl(room.timeControlId).minutes === 0) return false
    return game.moves.length >= 2
  }

  private abortAt(room: Room): number | null {
    const game = room.game
    if (!game || game.moves.length >= 2) return null
    return game.turnStart + ABORT_MS
  }

  private lastAway(room: Room, now: number): number {
    let latest = 0
    for (const id of room.playerIds) latest = Math.max(latest, this.players.get(id)?.awaySince ?? now)
    return room.playerIds.length ? latest : now
  }

  private liveGame(room: Room): Game {
    if (room.status !== 'playing' || !room.game) throw new RoomError('game-over')
    return room.game
  }

  private colorOf(room: Room, playerId: string): Color {
    const game = room.game
    if (game?.colors.w === playerId) return 'w'
    if (game?.colors.b === playerId) return 'b'
    throw new RoomError('not-in-room')
  }

  private roomOf(playerId: string): Room {
    const player = this.mustPlayer(playerId)
    const room = player.roomId ? this.rooms.get(player.roomId) : undefined
    if (!room) throw new RoomError('not-in-room')
    return room
  }

  private mustPlayer(playerId: string): Player {
    const player = this.players.get(playerId)
    if (!player) throw new RoomError('bad-request')
    return player
  }

  private renameInternal(player: Player, nick: string): void {
    player.nick = nick
    this.touchPlayerRoom(player)
  }

  private touchPlayerRoom(player: Player): void {
    const room = player.roomId ? this.rooms.get(player.roomId) : undefined
    if (room) this.changed(room, true)
  }

  private changed(room: Room, lobby = false): void {
    this.deps.onRoomChange?.(room.id, room.playerIds.slice())
    if (lobby || room.status === 'waiting') this.deps.onLobbyChange?.()
  }
}
