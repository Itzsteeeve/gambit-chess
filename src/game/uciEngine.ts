import type { EngineLevel } from './engineLevels'

export interface EngineScore {
  /** Centipawns from the side-to-move point of view. */
  cp?: number
  /** Mate in N moves (positive = side to move mates). */
  mate?: number
}

export interface EngineLine {
  multipv: number
  depth: number
  score: EngineScore
  pv: string[]
}

export interface EngineAnalysis {
  fen: string
  depth: number
  lines: EngineLine[]
  bestMove: string | null
}

type LineListener = (line: string) => void

export interface EngineOptions {
  depth: number
  multipv?: number
  /** Optional upper bound so a request can never hang forever. */
  timeoutMs?: number
  /** Aborting sends UCI `stop` and rejects the request with `EngineAbortError`. */
  signal?: AbortSignal
}

export interface PlayOptions {
  timeoutMs?: number
  signal?: AbortSignal
}

/** Minimal surface of `Worker` the engine relies on (lets tests inject a fake). */
export interface EngineWorker {
  postMessage(message: string): void
  terminate(): void
  onmessage: ((event: MessageEvent<unknown>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

export type EngineWorkerFactory = () => EngineWorker

export class EngineAbortError extends Error {
  constructor() {
    super('Stockfish request was cancelled')
    this.name = 'AbortError'
  }
}

export class EngineDisposedError extends Error {
  constructor() {
    super('Stockfish engine was disposed')
    this.name = 'EngineDisposedError'
  }
}

/** True for errors that only mean "this request is no longer wanted". */
export function isEngineCancellation(error: unknown): boolean {
  return error instanceof EngineAbortError || error instanceof EngineDisposedError
}

export const ENGINE_TIMEOUTS = {
  init: 30_000,
  analyze: 25_000,
  play: 20_000,
  /** How long to wait for the stale `bestmove` after `stop` before giving up on the worker. */
  stopGrace: 2_000,
}

const ENGINE_WASM_JS = `${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`
const ENGINE_ASM_JS = `${import.meta.env.BASE_URL}engine/stockfish-19-asm.js`

let useAsmFallback = false

function supportsWasmSimd(): boolean {
  try {
    return (
      typeof WebAssembly === 'object' &&
      typeof WebAssembly.validate === 'function' &&
      WebAssembly.validate(
        new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 9, 1, 7, 0, 65, 0, 253, 15, 26, 11]),
      )
    )
  } catch {
    return false
  }
}

const defaultWorkerFactory: EngineWorkerFactory = () => {
  const url = !useAsmFallback && supportsWasmSimd() ? ENGINE_WASM_JS : ENGINE_ASM_JS
  return new Worker(url) as unknown as EngineWorker
}

function noop() {}

function parseScore(parts: string[], index: number): EngineScore | null {
  const kind = parts[index]
  const value = Number(parts[index + 1])
  if (!Number.isFinite(value)) return null
  if (kind === 'cp') return { cp: value }
  if (kind === 'mate') return { mate: value }
  return null
}

export function parseInfo(line: string): EngineLine | null {
  if (!line.startsWith('info ') || line.includes(' currmove ') || line.includes(' string ')) return null
  const parts = line.split(/\s+/)
  let depth = 0
  let multipv = 1
  let score: EngineScore | null = null
  let pv: string[] = []

  for (let i = 1; i < parts.length; i += 1) {
    const token = parts[i]
    if (token === 'depth') depth = Number(parts[i + 1]) || depth
    else if (token === 'multipv') multipv = Number(parts[i + 1]) || 1
    else if (token === 'score') score = parseScore(parts, i + 1)
    else if (token === 'pv') {
      pv = parts.slice(i + 1)
      break
    }
  }

  if (!score || pv.length === 0) return null
  return { multipv, depth, score, pv }
}

function parseBestMove(line: string): string | null {
  const match = /^bestmove\s+(\S+)/.exec(line)
  return match && match[1] !== '(none)' ? match[1] : null
}

interface Waiter {
  reject: (error: Error) => void
}

/**
 * Thin, promise-based wrapper around a Stockfish UCI worker.
 * Requests are serialised, so callers can fire-and-forget safely.
 *
 * Guarantees:
 * - after `dispose()` nothing respawns a worker; pending/queued requests reject
 *   with `EngineDisposedError`;
 * - a failed `init()` is not cached, the next request retries from scratch;
 * - a timed-out or aborted search is stopped and its stale `bestmove` is
 *   drained before the next request starts (otherwise the worker is recycled),
 *   so a stale result can never resolve a different request.
 */
export class UciEngine {
  private worker: EngineWorker | null = null
  private listeners = new Set<LineListener>()
  private waiters = new Set<Waiter>()
  private initPromise: Promise<void> | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private multipv = 1
  private disposed = false
  private requestSeq = 0
  private activeRequest: number | null = null
  private readonly createWorker: EngineWorkerFactory

  constructor(createWorker: EngineWorkerFactory = defaultWorkerFactory) {
    this.createWorker = createWorker
  }

  get isDisposed() {
    return this.disposed
  }

  /** Resolves when the engine is loaded and answered `uci`/`isready`. */
  init(): Promise<void> {
    if (this.disposed) return Promise.reject(new EngineDisposedError())
    if (this.initPromise) return this.initPromise
    const attempt = this.boot()
    this.initPromise = attempt
    attempt.catch((error: unknown) => {
      // Do not cache the failure: the next request may retry.
      if (this.initPromise === attempt) {
        this.teardownWorker(error instanceof Error ? error : new Error(String(error)))
      }
    })
    return attempt
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.teardownWorker(new EngineDisposedError())
    this.listeners.clear()
  }

  private async boot(): Promise<void> {
    let worker: EngineWorker
    try {
      worker = this.createWorker()
    } catch (error) {
      throw error instanceof Error ? error : new Error('Stockfish worker failed to load')
    }
    this.worker = worker
    this.multipv = 1

    worker.onerror = (event) => {
      event?.preventDefault?.()
      if (this.worker !== worker) return
      if (this.createWorker === defaultWorkerFactory) {
        useAsmFallback = true
      }
      this.teardownWorker(new Error(event?.message || 'Stockfish worker failed to load'))
    }

    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (this.worker !== worker) return
      const data = typeof event.data === 'string' ? event.data : String(event.data ?? '')
      for (const rawLine of data.split('\n')) {
        const line = rawLine.trim()
        if (!line) continue
        for (const listener of [...this.listeners]) listener(line)
      }
    }

    const uciok = this.waitForLine('uciok', ENGINE_TIMEOUTS.init)
    this.send('uci')
    await uciok
    this.send('setoption name Threads value 1')
    this.send('setoption name Hash value 32')
    const readyok = this.waitForLine('readyok', ENGINE_TIMEOUTS.init)
    this.send('isready')
    await readyok
    if (this.disposed || this.worker !== worker) throw new EngineDisposedError()
  }

  private teardownWorker(error: Error) {
    const worker = this.worker
    this.worker = null
    this.initPromise = null
    this.multipv = 1
    this.activeRequest = null
    for (const waiter of [...this.waiters]) waiter.reject(error)
    this.waiters.clear()
    if (worker) {
      worker.onmessage = null
      worker.onerror = null
      try {
        worker.terminate()
      } catch {
        // Already gone.
      }
    }
  }

  private send(command: string) {
    this.worker?.postMessage(command)
  }

  private waitForLine(predicate: string | ((line: string) => boolean), timeoutMs: number): Promise<string> {
    const test = typeof predicate === 'string' ? (line: string) => line === predicate : predicate
    const promise = new Promise<string>((resolve, reject) => {
      const cleanup = () => {
        globalThis.clearTimeout(timer)
        this.listeners.delete(listener)
        this.waiters.delete(waiter)
      }
      const waiter: Waiter = {
        reject: (error) => {
          cleanup()
          reject(error)
        },
      }
      const timer = globalThis.setTimeout(() => {
        cleanup()
        reject(new Error('Stockfish did not respond in time'))
      }, timeoutMs)
      const listener: LineListener = (line) => {
        if (!test(line)) return
        cleanup()
        resolve(line)
      }
      this.listeners.add(listener)
      this.waiters.add(waiter)
    })
    return promise
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    if (this.disposed) return Promise.reject(new EngineDisposedError())
    const run = () => (this.disposed ? Promise.reject(new EngineDisposedError()) : task())
    const next = this.queue.then(run, run)
    this.queue = next.then(noop, noop)
    return next
  }

  private async ensureReady() {
    await this.init()
    if (!this.worker) throw this.disposed ? new EngineDisposedError() : new Error('Stockfish is not available')
  }

  private setMultiPv(value: number) {
    if (this.multipv === value) return
    this.multipv = value
    this.send(`setoption name MultiPV value ${value}`)
  }

  /**
   * Sends `go`, collects `info` lines and resolves with the `bestmove`.
   * Each search is tagged; output is only attributed to the active tag.
   */
  private async search(
    goCommand: string,
    timeoutMs: number,
    timeoutMessage: string,
    signal: AbortSignal | undefined,
    onInfo?: (info: EngineLine) => void,
  ): Promise<string | null> {
    if (signal?.aborted) throw new EngineAbortError()
    if (!this.worker) throw new Error('Stockfish is not available')

    const id = ++this.requestSeq
    this.activeRequest = id
    let sawBestMove = false

    try {
      return await new Promise<string | null>((resolve, reject) => {
        const cleanup = () => {
          globalThis.clearTimeout(timer)
          this.listeners.delete(listener)
          this.waiters.delete(waiter)
          signal?.removeEventListener('abort', onAbort)
        }
        const waiter: Waiter = {
          reject: (error) => {
            cleanup()
            reject(error)
          },
        }
        const onAbort = () => {
          cleanup()
          reject(new EngineAbortError())
        }
        const timer = globalThis.setTimeout(() => {
          cleanup()
          reject(new Error(timeoutMessage))
        }, timeoutMs)
        const listener: LineListener = (line) => {
          if (this.activeRequest !== id) return
          if (line.startsWith('bestmove')) {
            sawBestMove = true
            cleanup()
            resolve(parseBestMove(line))
            return
          }
          const info = parseInfo(line)
          if (info) onInfo?.(info)
        }
        this.listeners.add(listener)
        this.waiters.add(waiter)
        signal?.addEventListener('abort', onAbort, { once: true })
        this.send(goCommand)
      })
    } catch (error) {
      // Search was abandoned (timeout/abort). Stop it and drain its stale
      // `bestmove` so it cannot be read as the answer to the next request.
      if (!sawBestMove && this.worker && !this.disposed) await this.recoverAfterStop()
      throw error
    } finally {
      if (this.activeRequest === id) this.activeRequest = null
    }
  }

  private async recoverAfterStop() {
    const drained = this.waitForLine((line) => line.startsWith('bestmove'), ENGINE_TIMEOUTS.stopGrace)
    this.send('stop')
    try {
      await drained
    } catch {
      // The worker ignored `stop`; recycle it so stale output cannot leak.
      if (this.worker && !this.disposed) this.teardownWorker(new Error('Stockfish přestal odpovídat'))
    }
  }

  /**
   * Analyses a FEN. Scores are always from the point of view of the side to
   * move in that FEN, exactly as UCI reports them.
   */
  analyze(fen: string, options: EngineOptions): Promise<EngineAnalysis> {
    return this.enqueue(async () => {
      if (options.signal?.aborted) throw new EngineAbortError()
      await this.ensureReady()
      const multipv = Math.max(1, options.multipv ?? 1)
      this.setMultiPv(multipv)
      this.send('setoption name UCI_LimitStrength value false')
      this.send('setoption name Skill Level value 20')
      this.send(`position fen ${fen}`)

      const lines = new Map<number, EngineLine>()
      const bestMove = await this.search(
        `go depth ${options.depth}`,
        options.timeoutMs ?? ENGINE_TIMEOUTS.analyze,
        'Stockfish analysis timed out',
        options.signal,
        (info) => {
          const previous = lines.get(info.multipv)
          if (!previous || info.depth >= previous.depth) lines.set(info.multipv, info)
        },
      )

      const sorted = [...lines.values()].sort((a, b) => a.multipv - b.multipv)
      return {
        fen,
        depth: sorted.reduce((max, line) => Math.max(max, line.depth), 0),
        lines: sorted,
        bestMove,
      }
    })
  }

  /** Returns the engine's move for the given level, in UCI notation. */
  play(fen: string, level: EngineLevel, options: PlayOptions = {}): Promise<string | null> {
    return this.enqueue(async () => {
      if (options.signal?.aborted) throw new EngineAbortError()
      await this.ensureReady()
      this.setMultiPv(1)
      this.send(`setoption name Skill Level value ${level.skill}`)
      this.send(`setoption name UCI_LimitStrength value ${level.limitStrength}`)
      if (level.limitStrength && level.elo !== null) {
        const elo = Math.max(1320, Math.min(3190, Math.round(level.elo / 10) * 10))
        this.send(`setoption name UCI_Elo value ${elo}`)
      }
      this.send(`position fen ${fen}`)
      return this.search(
        `go depth ${level.depth}`,
        options.timeoutMs ?? ENGINE_TIMEOUTS.play,
        'Stockfish move timed out',
        options.signal,
      )
    })
  }
}
