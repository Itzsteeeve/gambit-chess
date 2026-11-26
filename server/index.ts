/**
 * Gambit server: serves the built app under BASE_PATH and runs online play
 * over a WebSocket at `${BASE_PATH}ws`. Rooms live in memory (`rooms.ts`).
 *
 *   BASE_PATH=/chess/ PORT=4173 node dist-server/index.js
 */
import { createReadStream, statSync } from 'node:fs'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomBytes, randomInt } from 'node:crypto'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import { ERROR_MESSAGES, PROTOCOL_VERSION, isOnlineTimeControl } from '../src/online/protocol'
import type { ClientMessage, ServerMessage, WireMove } from '../src/online/protocol'
import { RoomError, RoomManager } from './rooms'

function normalizeBase(value = ''): string {
  const path = value.replace(/^\/+|\/+$/g, '')
  return path ? `/${path}/` : '/'
}

const BASE = normalizeBase(process.env.BASE_PATH)
const PORT = Number(process.env.PORT ?? 4173)
const STATIC_DIR = resolve(process.env.STATIC_DIR ?? 'dist')
const WS_PATH = `${BASE}ws`
const MAX_MESSAGE_BYTES = 4096
/** Messages per socket per second before it is throttled. */
const RATE_LIMIT = 20

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
}

// ── Static files ──────────────────────────────────────────────────────────

function sendFile(res: ServerResponse, file: string, cache: string): boolean {
  try {
    const stat = statSync(file)
    if (!stat.isFile()) return false
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
    })
    createReadStream(file).pipe(res)
    return true
  } catch {
    return false
  }
}

function handleHttp(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://localhost')
  let path: string
  try {
    path = decodeURIComponent(url.pathname)
  } catch {
    res.writeHead(400).end()
    return
  }

  if (path === `${BASE}healthz`) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end()
    return
  }
  if (!path.startsWith(BASE)) {
    if (`${path}/` === BASE) {
      res.writeHead(301, { Location: BASE }).end()
      return
    }
    res.writeHead(404).end('Not found')
    return
  }

  const relative = normalize(path.slice(BASE.length)).replace(/^([/\\])+/, '')
  const file = join(STATIC_DIR, relative)
  if (file !== STATIC_DIR && !file.startsWith(STATIC_DIR + sep)) {
    res.writeHead(403).end()
    return
  }
  const immutable = relative.startsWith('assets') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'
  if (relative && sendFile(res, file, immutable)) return
  // Unknown paths without an extension get the app (client-side screens).
  if (!extname(relative) && sendFile(res, join(STATIC_DIR, 'index.html'), 'no-cache')) return
  res.writeHead(404).end('Not found')
}

// ── Online play ───────────────────────────────────────────────────────────

const sockets = new Map<string, Set<WebSocket>>()
const lobbyWatchers = new Set<WebSocket>()

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message))
}

function sendToPlayer(playerId: string, message: ServerMessage): void {
  for (const socket of sockets.get(playerId) ?? []) send(socket, message)
}

let lobbyPending = false
const manager = new RoomManager({
  randomId: () => randomBytes(16).toString('base64url'),
  randomInt: (n) => randomInt(n),
  onRoomChange: (roomId, members) => {
    const now = Date.now()
    for (const id of members) {
      // A member who has left meanwhile gets their own current room (or null).
      const view = manager.getPlayer(id)?.roomId === roomId ? manager.roomView(roomId, now) : manager.roomViewFor(id, now)
      sendToPlayer(id, { type: 'room', room: view, serverNow: now })
    }
  },
  onLobbyChange: () => {
    // Coalesce bursts of changes into one broadcast.
    if (lobbyPending) return
    lobbyPending = true
    queueMicrotask(() => {
      lobbyPending = false
      broadcastLobby()
    })
  },
})

function lobbyMessage(): ServerMessage {
  return { type: 'lobby', rooms: manager.lobby(), online: manager.onlineCount(), serverNow: Date.now() }
}

function broadcastLobby(): void {
  const message = lobbyMessage()
  for (const socket of lobbyWatchers) send(socket, message)
}

function isWireMove(value: unknown): value is WireMove {
  if (!value || typeof value !== 'object') return false
  const move = value as Record<string, unknown>
  const square = (s: unknown) => typeof s === 'string' && /^[a-h][1-8]$/.test(s)
  return square(move.from) && square(move.to) && (move.promotion === undefined || (typeof move.promotion === 'string' && /^[qrbn]$/.test(move.promotion)))
}

function parse(raw: string): ClientMessage | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>
    return data && typeof data === 'object' && typeof data.type === 'string' ? (data as unknown as ClientMessage) : null
  } catch {
    return null
  }
}

function handleMessage(socket: WebSocket, state: { playerId: string | null }, message: ClientMessage): void {
  const now = Date.now()
  if (message.type === 'ping') {
    send(socket, { type: 'pong', t: Number(message.t) || 0, serverNow: now })
    return
  }
  if (message.type === 'hello') {
    if (message.version !== PROTOCOL_VERSION) throw new RoomError('version')
    if (state.playerId) return
    const player = manager.hello(message.nick, typeof message.token === 'string' ? message.token : undefined, now)
    state.playerId = player.id
    let set = sockets.get(player.id)
    if (!set) sockets.set(player.id, (set = new Set()))
    set.add(socket)
    manager.connect(player.id)
    lobbyWatchers.add(socket)
    send(socket, { type: 'welcome', playerId: player.id, token: player.token, nick: player.nick, serverNow: now })
    send(socket, lobbyMessage())
    send(socket, { type: 'room', room: manager.roomViewFor(player.id, now), serverNow: now })
    broadcastLobby()
    return
  }
  const playerId = state.playerId
  if (!playerId) throw new RoomError('bad-request')

  switch (message.type) {
    case 'nick':
      manager.rename(playerId, message.nick)
      send(socket, { type: 'welcome', playerId, token: manager.getPlayer(playerId)!.token, nick: manager.getPlayer(playerId)!.nick, serverNow: now })
      break
    case 'create':
      if (!isOnlineTimeControl(message.timeControlId)) throw new RoomError('bad-request')
      manager.create(playerId, message.timeControlId, message.visibility === 'private' ? 'private' : 'public', now)
      break
    case 'quick':
      if (!isOnlineTimeControl(message.timeControlId)) throw new RoomError('bad-request')
      manager.quick(playerId, message.timeControlId, now)
      break
    case 'join':
      if (typeof message.code !== 'string') throw new RoomError('bad-request')
      manager.join(playerId, message.code, now)
      break
    case 'leave':
      manager.leave(playerId, now)
      break
    case 'start':
      manager.start(playerId, now)
      break
    case 'move':
      if (!isWireMove(message.move) || !Number.isInteger(message.ply)) throw new RoomError('bad-request')
      manager.move(playerId, message.move, message.ply, now)
      break
    case 'resign':
      manager.resign(playerId, now)
      break
    case 'draw-offer':
      manager.offerDraw(playerId, now)
      break
    case 'draw-accept':
      manager.acceptDraw(playerId, now)
      break
    case 'draw-decline':
      manager.declineDraw(playerId, now)
      break
    case 'rematch':
      manager.rematch(playerId, now)
      break
    default:
      throw new RoomError('bad-request')
  }
  // The actor always gets its own state back (also after leaving: null).
  sendToPlayer(playerId, { type: 'room', room: manager.roomViewFor(playerId, now), serverNow: now })
}

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES })

wss.on('connection', (socket: WebSocket & { isAlive?: boolean }) => {
  const state: { playerId: string | null } = { playerId: null }
  let windowStart = Date.now()
  let count = 0
  socket.isAlive = true
  socket.on('pong', () => {
    socket.isAlive = true
  })
  socket.on('message', (data) => {
    const now = Date.now()
    if (now - windowStart > 1000) {
      windowStart = now
      count = 0
    }
    count += 1
    if (count > RATE_LIMIT) {
      if (count === RATE_LIMIT + 1) send(socket, { type: 'error', code: 'rate-limit', message: ERROR_MESSAGES['rate-limit'] })
      return
    }
    const message = parse(data.toString())
    if (!message) {
      send(socket, { type: 'error', code: 'bad-request', message: ERROR_MESSAGES['bad-request'] })
      return
    }
    try {
      handleMessage(socket, state, message)
    } catch (error) {
      if (error instanceof RoomError) {
        send(socket, { type: 'error', code: error.code, message: ERROR_MESSAGES[error.code] })
        // Resynchronise: a rejected move or stale action leaves the client behind.
        if (state.playerId) send(socket, { type: 'room', room: manager.roomViewFor(state.playerId, now), serverNow: now })
      } else {
        console.error('[ws] handler failed', error)
        send(socket, { type: 'error', code: 'bad-request', message: ERROR_MESSAGES['bad-request'] })
      }
    }
  })
  socket.on('close', () => {
    lobbyWatchers.delete(socket)
    if (!state.playerId) return
    const set = sockets.get(state.playerId)
    set?.delete(socket)
    if (set && set.size === 0) sockets.delete(state.playerId)
    manager.disconnect(state.playerId, Date.now())
    broadcastLobby()
  })
})

const server = createServer(handleHttp)
server.on('upgrade', (req, socket, head) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (path !== WS_PATH) {
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
})

// Clocks, aborts, abandonment, cleanup.
setInterval(() => manager.tick(Date.now()), 200).unref()
// Drop sockets that stopped answering (closed laptops, dead mobile networks).
setInterval(() => {
  for (const socket of wss.clients as Set<WebSocket & { isAlive?: boolean }>) {
    if (!socket.isAlive) {
      socket.terminate()
      continue
    }
    socket.isAlive = false
    socket.ping()
  }
}, 25_000).unref()

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Gambit on http://0.0.0.0:${PORT}${BASE} (WebSocket ${WS_PATH})`)
})

function shutdown() {
  server.close()
  for (const socket of wss.clients) socket.close(1001, 'restart')
  setTimeout(() => process.exit(0), 500).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
