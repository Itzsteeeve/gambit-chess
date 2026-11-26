import { describe, expect, it } from 'vitest'
import type { Color, Square } from 'chess.js'
import { ABANDON_MS, ABORT_MS, RoomError, RoomManager, WAITING_AWAY_MS } from './rooms'

function setup(colorPick = 0) {
  let id = 0
  const changes: string[] = []
  let lobbyChanges = 0
  const manager = new RoomManager({
    randomId: () => `id${++id}`,
    // Codes use the alphabet sequentially; colour pick is controlled by the test.
    randomInt: (n) => (n === 2 ? colorPick : id++ % n),
    onRoomChange: (roomId) => changes.push(roomId),
    onLobbyChange: () => {
      lobbyChanges += 1
    },
  })
  const connect = (nick: string, now = 0) => {
    const player = manager.hello(nick, undefined, now)
    manager.connect(player.id)
    return player
  }
  return { manager, changes, connect, lobbyChanges: () => lobbyChanges }
}

function code(err: unknown): string | undefined {
  return err instanceof RoomError ? err.code : undefined
}

function expectError(fn: () => unknown, expected: string) {
  let caught: unknown
  try {
    fn()
  } catch (error) {
    caught = error
  }
  expect(code(caught)).toBe(expected)
}

/** Two players in a started room; returns who has which colour. */
function startedGame(timeControl: '3+2' | '5+0' | 'none' = '3+2') {
  const ctx = setup(0)
  const a = ctx.connect('Alice')
  const b = ctx.connect('Bob')
  const room = ctx.manager.create(a.id, timeControl, 'public', 0)
  ctx.manager.join(b.id, room.code, 0)
  const view = ctx.manager.start(a.id, 0)
  const white = view.players.find((p) => p.color === 'w')!.id
  const black = view.players.find((p) => p.color === 'b')!.id
  const play = (from: Square, to: Square, now: number) => {
    const current = ctx.manager.roomViewFor(a.id, now)!
    const turn: Color = current.game!.turn
    ctx.manager.move(turn === 'w' ? white : black, { from, to }, current.game!.moves.length, now)
  }
  return { ...ctx, a, b, white, black, play, roomId: room.id }
}

describe('players', () => {
  it('rejects bad nicknames and trims good ones', () => {
    const { manager } = setup()
    expectError(() => manager.hello('x', undefined, 0), 'bad-nick')
    expectError(() => manager.hello('a'.repeat(21), undefined, 0), 'bad-nick')
    expect(manager.hello('  Kuba   Novák ', undefined, 0).nick).toBe('Kuba Novák')
  })

  it('resumes a player by token', () => {
    const { manager } = setup()
    const first = manager.hello('Kuba', undefined, 0)
    const again = manager.hello('Kubik', first.token, 10)
    expect(again.id).toBe(first.id)
    expect(again.nick).toBe('Kubik')
    expect(manager.hello('Kuba', 'unknown', 0).id).not.toBe(first.id)
  })
})

describe('rooms and lobby', () => {
  it('lists public waiting rooms, hides private ones', () => {
    const { manager, connect } = setup()
    const a = connect('Alice')
    const b = connect('Bob')
    manager.create(a.id, '10+0', 'public', 0)
    manager.create(b.id, '5+0', 'private', 0)
    const lobby = manager.lobby()
    expect(lobby).toHaveLength(1)
    expect(lobby[0]).toMatchObject({ hostNick: 'Alice', timeControlId: '10+0', status: 'waiting' })
  })

  it('joins by code (case-insensitive) and refuses a third player', () => {
    const { manager, connect } = setup()
    const a = connect('Alice')
    const b = connect('Bob')
    const c = connect('Cyril')
    const room = manager.create(a.id, '10+0', 'private', 0)
    manager.join(b.id, room.code.toLowerCase(), 0)
    expect(manager.roomViewFor(a.id, 0)!.players.map((p) => p.nick)).toEqual(['Alice', 'Bob'])
    expectError(() => manager.join(c.id, room.code, 0), 'full')
    expectError(() => manager.join(c.id, 'ZZZZZ', 0), 'not-found')
  })

  it('only the host starts, and only with two players', () => {
    const { manager, connect } = setup()
    const a = connect('Alice')
    const b = connect('Bob')
    const room = manager.create(a.id, '10+0', 'public', 0)
    expectError(() => manager.start(a.id, 0), 'not-ready')
    manager.join(b.id, room.code, 0)
    expectError(() => manager.start(b.id, 0), 'not-host')
    const view = manager.start(a.id, 0)
    expect(view.status).toBe('playing')
    expect(new Set(view.players.map((p) => p.color))).toEqual(new Set(['w', 'b']))
  })

  it('assigns colours at random', () => {
    for (const pick of [0, 1]) {
      const { manager, connect } = setup(pick)
      const a = connect('Alice')
      const b = connect('Bob')
      const room = manager.create(a.id, '10+0', 'public', 0)
      manager.join(b.id, room.code, 0)
      const view = manager.start(a.id, 0)
      expect(view.players[0].color).toBe(pick === 0 ? 'w' : 'b')
    }
  })

  it('quick pairing creates a room, then the next player joins and the game starts', () => {
    const { manager, connect } = setup()
    const a = connect('Alice')
    const b = connect('Bob')
    const c = connect('Cyril')
    const first = manager.quick(a.id, '3+2', 0)
    expect(first.status).toBe('waiting')
    // Different time control: no match.
    expect(manager.quick(c.id, '10+0', 1).status).toBe('waiting')
    const second = manager.quick(b.id, '3+2', 2)
    expect(second.id).toBe(first.id)
    expect(second.status).toBe('playing')
  })

  it('passes the host on when the host leaves a waiting room, and closes empty rooms', () => {
    const { manager, connect } = setup()
    const a = connect('Alice')
    const b = connect('Bob')
    const room = manager.create(a.id, '10+0', 'public', 0)
    manager.join(b.id, room.code, 0)
    manager.leave(a.id, 1)
    expect(manager.roomViewFor(b.id, 1)!.hostId).toBe(b.id)
    manager.leave(b.id, 2)
    expect(manager.roomView(room.id, 2)).toBeNull()
    expect(manager.lobby()).toHaveLength(0)
  })

  it('closes a waiting room whose host stays away', () => {
    const { manager, connect } = setup()
    const a = connect('Alice')
    const room = manager.create(a.id, '10+0', 'public', 0)
    manager.disconnect(a.id, 1000)
    expect(manager.lobby()).toHaveLength(0)
    manager.tick(1000 + WAITING_AWAY_MS - 1)
    expect(manager.roomView(room.id, 0)).not.toBeNull()
    manager.tick(1000 + WAITING_AWAY_MS)
    expect(manager.roomView(room.id, 0)).toBeNull()
  })
})

describe('games', () => {
  it('validates moves and turn order', () => {
    const { manager, white, black, play } = startedGame()
    expectError(() => manager.move(black, { from: 'e7', to: 'e5' }, 0, 0), 'not-your-turn')
    expectError(() => manager.move(white, { from: 'e2', to: 'e5' }, 0, 0), 'illegal-move')
    expectError(() => manager.move(white, { from: 'e2', to: 'e4' }, 3, 0), 'illegal-move')
    play('e2', 'e4', 100)
    const view = manager.roomViewFor(white, 100)!
    expect(view.game!.moves.map((m) => m.san)).toEqual(['e4'])
    expect(view.game!.turn).toBe('b')
  })

  it('detects checkmate', () => {
    const { manager, white, play } = startedGame()
    play('f2', 'f3', 1)
    play('e7', 'e5', 2)
    play('g2', 'g4', 3)
    play('d8', 'h4', 4)
    const view = manager.roomViewFor(white, 4)!
    expect(view.status).toBe('finished')
    expect(view.game!.outcome).toEqual({ winner: 'b', reason: 'checkmate' })
  })

  it('starts the clocks after both first moves and adds the increment', () => {
    const { manager, white, play } = startedGame('3+2')
    play('e2', 'e4', 5_000)
    play('e7', 'e5', 9_000)
    let game = manager.roomViewFor(white, 9_000)!.game!
    expect(game.clock).toEqual({ w: 180_000, b: 180_000 })
    expect(game.clockRunning).toBe(true)
    play('g1', 'f3', 19_000)
    game = manager.roomViewFor(white, 19_000)!.game!
    expect(game.clock.w).toBe(180_000 - 10_000 + 2_000)
  })

  it('flags a player who runs out of time', () => {
    const { manager, white, play } = startedGame('3+2')
    play('e2', 'e4', 0)
    play('e7', 'e5', 0)
    manager.tick(180_000 - 1)
    expect(manager.roomViewFor(white, 0)!.status).toBe('playing')
    manager.tick(180_000)
    const view = manager.roomViewFor(white, 180_000)!
    expect(view.game!.outcome).toEqual({ winner: 'b', reason: 'timeout' })
    expect(view.game!.clock.w).toBe(0)
  })

  it('aborts when the first move does not come', () => {
    const { manager, white, play } = startedGame()
    play('e2', 'e4', 1_000)
    manager.tick(1_000 + ABORT_MS)
    const view = manager.roomViewFor(white, 0)!
    expect(view.status).toBe('aborted')
    expect(view.game!.outcome).toBeNull()
  })

  it('resigning and leaving end the game', () => {
    const first = startedGame()
    first.play('e2', 'e4', 0)
    first.play('e7', 'e5', 0)
    first.manager.resign(first.white, 1)
    expect(first.manager.roomViewFor(first.black, 1)!.game!.outcome).toEqual({ winner: 'b', reason: 'resignation' })

    const second = startedGame()
    second.play('e2', 'e4', 0)
    second.play('e7', 'e5', 0)
    second.manager.leave(second.black, 1)
    expect(second.manager.roomViewFor(second.white, 1)!.game!.outcome).toEqual({ winner: 'w', reason: 'resignation' })
  })

  it('handles draw offers', () => {
    const { manager, white, black, play } = startedGame()
    play('e2', 'e4', 0)
    manager.offerDraw(white, 1)
    expect(manager.roomViewFor(white, 1)!.game!.drawOffer).toBe('w')
    // Black moving declines it.
    play('e7', 'e5', 2)
    expect(manager.roomViewFor(white, 2)!.game!.drawOffer).toBeNull()
    manager.offerDraw(black, 3)
    manager.acceptDraw(white, 4)
    expect(manager.roomViewFor(white, 4)!.game!.outcome).toEqual({ winner: null, reason: 'agreement' })
  })

  it('a player away for too long loses by abandonment', () => {
    const { manager, white, black, play } = startedGame()
    play('e2', 'e4', 0)
    play('e7', 'e5', 0)
    manager.disconnect(black, 1_000)
    expect(manager.roomViewFor(white, 1_000)!.abandonAt).toBe(1_000 + ABANDON_MS)
    manager.tick(1_000 + ABANDON_MS - 1)
    expect(manager.roomViewFor(white, 0)!.status).toBe('playing')
    manager.tick(1_000 + ABANDON_MS)
    expect(manager.roomViewFor(white, 0)!.game!.outcome).toEqual({ winner: 'w', reason: 'abandonment' })
  })

  it('coming back in time cancels abandonment', () => {
    const { manager, white, black, play } = startedGame('none')
    play('e2', 'e4', 0)
    play('e7', 'e5', 0)
    manager.disconnect(black, 1_000)
    manager.connect(black)
    manager.tick(1_000 + ABANDON_MS * 2)
    expect(manager.roomViewFor(white, 0)!.status).toBe('playing')
    expect(manager.roomViewFor(white, 0)!.abandonAt).toBeNull()
  })

  it('rematch swaps colours once both players ask', () => {
    const { manager, white, black, play } = startedGame()
    play('e2', 'e4', 0)
    play('e7', 'e5', 0)
    manager.resign(white, 1)
    manager.rematch(white, 2)
    expect(manager.roomViewFor(white, 2)!.status).toBe('finished')
    expect(manager.roomViewFor(white, 2)!.rematch).toEqual([white])
    manager.rematch(black, 3)
    const view = manager.roomViewFor(white, 3)!
    expect(view.status).toBe('playing')
    expect(view.round).toBe(2)
    expect(view.players.find((p) => p.id === white)!.color).toBe('b')
  })

  it('a player can leave a finished room to start something new', () => {
    const { manager, white, black, play } = startedGame()
    play('e2', 'e4', 0)
    play('e7', 'e5', 0)
    manager.resign(white, 1)
    const fresh = manager.create(white, '5+0', 'public', 2)
    expect(fresh.status).toBe('waiting')
    expect(manager.roomViewFor(black, 2)!.players.map((p) => p.id)).toEqual([black])
  })
})
