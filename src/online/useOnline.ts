import { useCallback, useEffect, useRef, useState } from 'react'
import { PROTOCOL_VERSION, cleanNick } from './protocol'
import type { ClientMessage, LobbyRoom, RoomView, ServerMessage } from './protocol'

const NICK_KEY = 'gambit.online-nick'
const TOKEN_KEY = 'gambit.online-token'

export type OnlineStatus = 'idle' | 'connecting' | 'online' | 'offline'

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Private mode: the identity just does not survive a reload.
  }
}

/** True when this browser has played online before (it then reconnects on load). */
export function hasOnlineIdentity(): boolean {
  return readStorage(TOKEN_KEY) !== null && cleanNick(readStorage(NICK_KEY)) !== null
}

function socketUrl(): string {
  const { protocol, host } = window.location
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}${import.meta.env.BASE_URL}ws`
}

export interface OnlineError {
  id: number
  message: string
}

/**
 * Connection to the Gambit server. Connects while `enabled` and a nickname is
 * set, reconnects with backoff, and resumes the same player via a stored token.
 */
export function useOnline(enabled: boolean) {
  const [nick, setNickState] = useState<string | null>(() => cleanNick(readStorage(NICK_KEY)))
  const [status, setStatus] = useState<OnlineStatus>('idle')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [lobby, setLobby] = useState<LobbyRoom[]>([])
  const [online, setOnline] = useState(0)
  const [room, setRoom] = useState<RoomView | null>(null)
  const [error, setError] = useState<OnlineError | null>(null)
  /** serverNow - Date.now(), so clocks and countdowns use server time. */
  const offsetRef = useRef(0)
  const socketRef = useRef<WebSocket | null>(null)
  const queueRef = useRef<ClientMessage[]>([])
  /** True once the server has greeted the current socket. */
  const readyRef = useRef(false)
  const nickRef = useRef(nick)
  nickRef.current = nick

  const active = enabled && nick !== null

  useEffect(() => {
    if (!active) {
      setStatus('idle')
      return
    }
    let disposed = false
    let retry = 0
    let retryTimer: number | null = null
    let pingTimer: number | null = null

    const connect = () => {
      if (disposed) return
      setStatus('connecting')
      const socket = new WebSocket(socketUrl())
      socketRef.current = socket

      socket.onopen = () => {
        retry = 0
        const token = readStorage(TOKEN_KEY) ?? undefined
        socket.send(JSON.stringify({ type: 'hello', version: PROTOCOL_VERSION, nick: nickRef.current ?? '', token }))
        pingTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping', t: Date.now() }))
        }, 15_000)
      }

      socket.onmessage = (event) => {
        let message: ServerMessage
        try {
          message = JSON.parse(String(event.data)) as ServerMessage
        } catch {
          return
        }
        if ('serverNow' in message) offsetRef.current = message.serverNow - Date.now()
        switch (message.type) {
          case 'welcome':
            writeStorage(TOKEN_KEY, message.token)
            setPlayerId(message.playerId)
            setNickState(message.nick)
            writeStorage(NICK_KEY, message.nick)
            setStatus('online')
            readyRef.current = true
            for (const queued of queueRef.current.splice(0)) socket.send(JSON.stringify(queued))
            break
          case 'lobby':
            setLobby(message.rooms)
            setOnline(message.online)
            break
          case 'room':
            setRoom(message.room)
            break
          case 'error':
            setError((previous) => ({ id: (previous?.id ?? 0) + 1, message: message.message }))
            if (message.code === 'bad-nick') {
              writeStorage(NICK_KEY, null)
              setNickState(null)
            }
            break
          case 'pong':
            break
        }
      }

      socket.onclose = () => {
        readyRef.current = false
        if (pingTimer !== null) window.clearInterval(pingTimer)
        pingTimer = null
        if (socketRef.current === socket) socketRef.current = null
        if (disposed) return
        setStatus('offline')
        const delay = Math.min(10_000, 500 * 2 ** retry)
        retry += 1
        retryTimer = window.setTimeout(connect, delay)
      }
    }

    connect()
    return () => {
      disposed = true
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      if (pingTimer !== null) window.clearInterval(pingTimer)
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [active])

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current
    if (socket && readyRef.current && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
    // Sent once the server has greeted us again.
    else queueRef.current.push(message)
  }, [])

  const setNick = useCallback(
    (value: string): boolean => {
      const clean = cleanNick(value)
      if (!clean) return false
      writeStorage(NICK_KEY, clean)
      setNickState(clean)
      if (readyRef.current) send({ type: 'nick', nick: clean })
      return true
    },
    [send],
  )

  /** Current server time in ms. */
  const serverNow = useCallback(() => Date.now() + offsetRef.current, [])

  return { status, nick, setNick, playerId, lobby, online, room, error, send, serverNow }
}

export type Online = ReturnType<typeof useOnline>
