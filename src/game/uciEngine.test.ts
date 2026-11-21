import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getEngineLevel } from './engineLevels'
import type { EngineWorker } from './uciEngine'
import { ENGINE_TIMEOUTS, EngineAbortError, EngineDisposedError, UciEngine, parseInfo } from './uciEngine'

type GoHandler = (worker: FakeWorker, command: string) => void

/** Answers a search asynchronously with one info line and a bestmove. */
function answer(move: string, cp = 20): GoHandler {
  return (worker) => {
    worker.emitLater(`info depth 10 multipv 1 score cp ${cp} pv ${move} e7e5`)
    worker.emitLater(`bestmove ${move}`)
  }
}

class FakeWorker implements EngineWorker {
  onmessage: EngineWorker['onmessage'] = null
  onerror: EngineWorker['onerror'] = null
  sent: string[] = []
  terminated = false
  /** Handlers for consecutive `go` commands; the last one repeats. */
  goHandlers: GoHandler[] = []
  goCount = 0
  respondToUci = true
  /** What to do on `stop` while a search is running. */
  onStop: ((worker: FakeWorker) => void) | null = null

  postMessage(command: string) {
    this.sent.push(command)
    if (command === 'uci' && this.respondToUci) this.emitLater('id name FakeFish\nuciok')
    else if (command === 'isready' && this.respondToUci) this.emitLater('readyok')
    else if (command.startsWith('go')) {
      const handler = this.goHandlers[Math.min(this.goCount, this.goHandlers.length - 1)]
      this.goCount += 1
      handler?.(this, command)
    } else if (command === 'stop') this.onStop?.(this)
  }

  terminate() {
    this.terminated = true
  }

  emit(data: string) {
    if (this.terminated) return
    this.onmessage?.({ data } as MessageEvent<unknown>)
  }

  emitLater(data: string) {
    void Promise.resolve().then(() => this.emit(data))
  }

  gos() {
    return this.sent.filter((command) => command.startsWith('go'))
  }
}

function setup(configure?: (worker: FakeWorker, index: number) => void) {
  const workers: FakeWorker[] = []
  const factory = vi.fn(() => {
    const worker = new FakeWorker()
    worker.goHandlers = [answer('e2e4')]
    configure?.(worker, workers.length)
    workers.push(worker)
    return worker
  })
  return { engine: new UciEngine(factory), workers, factory }
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('parseInfo', () => {
  it('parses depth, multipv, score and pv', () => {
    expect(parseInfo('info depth 12 seldepth 18 multipv 2 score cp -35 nodes 1 pv e2e4 e7e5')).toEqual({
      depth: 12,
      multipv: 2,
      score: { cp: -35 },
      pv: ['e2e4', 'e7e5'],
    })
    expect(parseInfo('info depth 5 score mate 3 pv h5f7')?.score).toEqual({ mate: 3 })
  })

  it('ignores currmove / string / scoreless lines', () => {
    expect(parseInfo('info depth 3 currmove e2e4 currmovenumber 1')).toBeNull()
    expect(parseInfo('info string NNUE enabled')).toBeNull()
    expect(parseInfo('info depth 3 nodes 100')).toBeNull()
  })
})

describe('UciEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('initialises and analyses a position', async () => {
    const { engine, workers } = setup()
    const result = await engine.analyze(START, { depth: 10, multipv: 2 })
    expect(result.bestMove).toBe('e2e4')
    expect(result.depth).toBe(10)
    expect(result.lines[0].score).toEqual({ cp: 20 })
    expect(workers[0].sent).toContain('setoption name MultiPV value 2')
    expect(workers[0].sent).toContain(`position fen ${START}`)
  })

  it('serialises requests: the next go is only sent after the previous bestmove', async () => {
    const control: { release?: () => void } = {}
    const { engine, workers } = setup((worker) => {
      worker.goHandlers = [
        (w) => {
          control.release = () => w.emit('bestmove e2e4')
        },
        answer('d2d4'),
      ]
    })
    const first = engine.play(START, getEngineLevel('1600'))
    const second = engine.play(START, getEngineLevel('1600'))
    await vi.advanceTimersByTimeAsync(0)
    expect(workers[0].gos()).toHaveLength(1)
    control.release?.()
    await expect(first).resolves.toBe('e2e4')
    await expect(second).resolves.toBe('d2d4')
    expect(workers[0].gos()).toHaveLength(2)
  })

  it('on timeout stops the search and drains the stale bestmove before the next request', async () => {
    const { engine, workers } = setup((worker) => {
      worker.goHandlers = [() => {}, answer('d2d4')]
      // The stale answer for the timed-out search arrives only after `stop`.
      worker.onStop = (w) => w.emitLater('bestmove h2h4')
    })
    const first = engine.analyze(START, { depth: 30, timeoutMs: 1000 })
    const firstResult = first.catch((error: Error) => error)
    const second = engine.analyze(START, { depth: 10 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(((await firstResult) as Error).message).toMatch(/timed out/)
    const secondResult = await second
    expect(secondResult.bestMove).toBe('d2d4')
    const sent = workers[0].sent
    expect(sent.indexOf('stop')).toBeGreaterThan(-1)
    expect(sent.lastIndexOf('go depth 10')).toBeGreaterThan(sent.indexOf('stop'))
  })

  it('a stale bestmove never resolves a different request', async () => {
    const { engine } = setup((worker) => {
      worker.goHandlers = [() => {}, answer('d2d4')]
      worker.onStop = (w) => w.emitLater('bestmove h2h4')
    })
    const controller = new AbortController()
    const first = engine.play(START, getEngineLevel('2000'), { signal: controller.signal })
    const firstResult = first.catch((error: unknown) => error)
    const second = engine.play(START, getEngineLevel('2000'))
    await vi.advanceTimersByTimeAsync(0)
    controller.abort()
    expect(await firstResult).toBeInstanceOf(EngineAbortError)
    await expect(second).resolves.toBe('d2d4')
  })

  it('aborting a queued request rejects it without sending go', async () => {
    const { engine, workers } = setup()
    const controller = new AbortController()
    controller.abort()
    await expect(engine.play(START, getEngineLevel('1600'), { signal: controller.signal })).rejects.toBeInstanceOf(
      EngineAbortError,
    )
    await engine.init()
    expect(workers[0].gos()).toHaveLength(0)
  })

  it('recycles a worker that ignores stop', async () => {
    const { engine, workers, factory } = setup((worker, index) => {
      worker.goHandlers = index === 0 ? [() => {}] : [answer('g1f3')]
    })
    const first = engine.analyze(START, { depth: 30, timeoutMs: 500 }).catch((error: Error) => error)
    await vi.advanceTimersByTimeAsync(500 + ENGINE_TIMEOUTS.stopGrace)
    expect(await first).toBeInstanceOf(Error)
    expect(workers[0].terminated).toBe(true)
    const next = await engine.analyze(START, { depth: 10 })
    expect(next.bestMove).toBe('g1f3')
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failed init: the next call retries with a fresh worker', async () => {
    const { engine, workers, factory } = setup((worker, index) => {
      worker.respondToUci = index > 0
    })
    const failed = engine.init().catch((error: Error) => error)
    await vi.advanceTimersByTimeAsync(ENGINE_TIMEOUTS.init)
    expect(((await failed) as Error).message).toMatch(/did not respond/)
    expect(workers[0].terminated).toBe(true)
    await expect(engine.init()).resolves.toBeUndefined()
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('a worker error rejects init and allows a retry', async () => {
    const { engine, workers, factory } = setup((worker, index) => {
      if (index === 0) {
        worker.respondToUci = false
        void Promise.resolve().then(() => worker.onerror?.({ message: 'boom', preventDefault() {} } as ErrorEvent))
      }
    })
    await expect(engine.init()).rejects.toThrow('boom')
    expect(workers[0].terminated).toBe(true)
    await expect(engine.init()).resolves.toBeUndefined()
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('after dispose, pending and queued requests reject and no worker is respawned', async () => {
    const { engine, workers, factory } = setup((worker) => {
      worker.goHandlers = [() => {}]
    })
    const running = engine.analyze(START, { depth: 30 }).catch((error: unknown) => error)
    const queued = engine.analyze(START, { depth: 30 }).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(0)
    engine.dispose()
    expect(await running).toBeInstanceOf(EngineDisposedError)
    expect(await queued).toBeInstanceOf(EngineDisposedError)
    await expect(engine.init()).rejects.toBeInstanceOf(EngineDisposedError)
    await expect(engine.play(START, getEngineLevel('1600'))).rejects.toBeInstanceOf(EngineDisposedError)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(workers[0].terminated).toBe(true)
  })

  it('dispose during init (StrictMode double mount) rejects quietly and leaves no timers behind', async () => {
    const { engine, factory } = setup((worker) => {
      worker.respondToUci = false
    })
    const init = engine.init()
    engine.dispose()
    await expect(init).rejects.toBeInstanceOf(EngineDisposedError)
    expect(vi.getTimerCount()).toBe(0)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('sends level options for play', async () => {
    const { engine, workers } = setup()
    await engine.play(START, getEngineLevel('1400'))
    const sent = workers[0].sent
    expect(sent).toContain('setoption name UCI_LimitStrength value true')
    expect(sent).toContain('setoption name UCI_Elo value 1400')
    expect(sent).toContain('go depth 5')
  })
})
