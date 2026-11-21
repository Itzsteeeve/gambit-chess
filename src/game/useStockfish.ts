import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { Color, Move } from 'chess.js'
import type { EngineLevel } from './engineLevels'
import { parseUciMove } from './engineLevels'
import type { EngineAnalysis } from './uciEngine'
import { EngineAbortError, UciEngine, isEngineCancellation } from './uciEngine'
import type { RatedMove } from './moveRating'
import { evalToWhite, rateMove } from './moveRating'
import { buildEvalSeries, plyFens } from './review'

export type EngineStatus = 'idle' | 'loading' | 'ready' | 'error'

export type ParsedUciMove = NonNullable<ReturnType<typeof parseUciMove>>

/** Upper bound of cached analyses; older entries outside the current game are evicted. */
export const ANALYSIS_CACHE_LIMIT = 400

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new EngineAbortError())
      return
    }
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      globalThis.clearTimeout(timer)
      reject(new EngineAbortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback
}

/**
 * Owns the "playing" engine. Kept separate from the analysis engine so the
 * opponent's strength settings can never leak into the evaluation.
 */
export function useStockfishPlay(enabled: boolean) {
  const engineRef = useRef<UciEngine | null>(null)
  const [status, setStatus] = useState<EngineStatus>(enabled ? 'loading' : 'idle')
  const [error, setError] = useState<string | null>(null)
  /** Bumped by `retry()`; consumers may key effects on it to re-request a move. */
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      setError(null)
      return
    }

    let cancelled = false
    const engine = new UciEngine()
    engineRef.current = engine
    setStatus('loading')
    setError(null)

    engine
      .init()
      .then(() => {
        if (!cancelled) setStatus('ready')
      })
      .catch((reason: unknown) => {
        if (cancelled || isEngineCancellation(reason)) return
        setStatus('error')
        setError(errorMessage(reason, 'Stockfish se nepodařilo načíst'))
      })

    return () => {
      cancelled = true
      engine.dispose()
      if (engineRef.current === engine) engineRef.current = null
    }
  }, [enabled, attempt])

  const getMove = useCallback(
    async (fen: string, level: EngineLevel, signal?: AbortSignal): Promise<string | null> => {
      const engine = engineRef.current
      if (!engine) return null

      const started = Date.now()
      let engineMove: string | null
      try {
        ;[engineMove] = await Promise.all([
          engine.play(fen, level, { signal }),
          sleep(level.depth <= 4 ? 420 : 260, signal),
        ])
      } catch (reason) {
        if (!isEngineCancellation(reason) && engineRef.current === engine) {
          setStatus('error')
          setError(errorMessage(reason, 'Stockfish neodpověděl'))
        }
        throw reason
      }
      if (engineRef.current === engine) {
        setStatus((value) => (value === 'error' ? value : 'ready'))
      }

      let move = engineMove
      if (move && level.randomness > 0 && Math.random() < level.randomness) {
        try {
          const chess = new Chess(fen)
          const legal = chess.moves({ verbose: true })
          if (legal.length > 0) {
            const pick = legal[Math.floor(Math.random() * legal.length)]
            move = `${pick.from}${pick.to}${pick.promotion ?? ''}`
          }
        } catch {
          // Keep the engine move when the position cannot be parsed.
        }
      }

      // Never snap back instantly — a short "thinking" beat feels natural.
      const elapsed = Date.now() - started
      if (elapsed < 380) await sleep(380 - elapsed, signal)
      return move && parseUciMove(move) ? move : null
    },
    [],
  )

  /** Recreates the worker after a failure. */
  const retry = useCallback(() => {
    setError(null)
    setStatus('loading')
    setAttempt((value) => value + 1)
  }, [])

  return useMemo(
    () => ({ status, error, attempt, getMove, retry }),
    [status, error, attempt, getMove, retry],
  )
}

interface AnalysisHookOptions {
  /** Keeps the analysis worker alive. */
  enabled: boolean
  /**
   * Background analysis of every position in the game (eval bar, ratings).
   * When false the worker only answers explicit `getBestMove` requests.
   */
  autoAnalyze?: boolean
  fen: string
  turn: Color
  history: Move[]
  humanColor: Color
  /** Changes on every new game; queued work for the previous game is dropped. */
  gameNumber?: number
  depth?: number
  /** Start position of the game (needed for the eval series before the first move). */
  startFen?: string
  /** Opening-book ratings only make sense from the standard start position. */
  allowBook?: boolean
}

interface QueueEntry {
  fen: string
  generation: number
  promise: Promise<EngineAnalysis | null>
  resolve: (analysis: EngineAnalysis | null) => void
}

export function useEngineAnalysis({
  enabled,
  autoAnalyze = true,
  fen,
  turn,
  history,
  humanColor,
  gameNumber = 0,
  depth = 12,
  startFen,
  allowBook = true,
}: AnalysisHookOptions) {
  const engineRef = useRef<UciEngine | null>(null)
  const cacheRef = useRef<Map<string, EngineAnalysis>>(new Map())
  const [cacheVersion, setCacheVersion] = useState(0)
  const inflightRef = useRef<Map<string, QueueEntry>>(new Map())
  const queueRef = useRef<QueueEntry[]>([])
  const failedRef = useRef<Set<string>>(new Set())
  const runningRef = useRef(false)
  const generationRef = useRef(0)
  const currentAbortRef = useRef<AbortController | null>(null)
  const protectedFensRef = useRef<Set<string>>(new Set())
  const depthRef = useRef(depth)
  const [status, setStatus] = useState<EngineStatus>(enabled ? 'loading' : 'idle')

  depthRef.current = depth

  const dropQueue = useCallback(() => {
    generationRef.current += 1
    for (const entry of queueRef.current) entry.resolve(null)
    queueRef.current = []
    for (const entry of inflightRef.current.values()) entry.resolve(null)
    inflightRef.current.clear()
    failedRef.current.clear()
    currentAbortRef.current?.abort()
    currentAbortRef.current = null
  }, [])

  const store = useCallback((result: EngineAnalysis) => {
    const cache = cacheRef.current
    const previous = cache.get(result.fen)
    // Never overwrite a deeper analysis with a shallower one.
    if (previous && previous.depth > result.depth) return
    cache.delete(result.fen)
    cache.set(result.fen, result)
    if (cache.size > ANALYSIS_CACHE_LIMIT) {
      for (const key of cache.keys()) {
        if (cache.size <= ANALYSIS_CACHE_LIMIT) break
        if (protectedFensRef.current.has(key)) continue
        cache.delete(key)
      }
    }
    setCacheVersion((value) => value + 1)
  }, [])

  const pump = useCallback(async () => {
    if (runningRef.current) return
    const engine = engineRef.current
    if (!engine) return
    runningRef.current = true
    try {
      while (queueRef.current.length > 0 && engineRef.current === engine) {
        const entry = queueRef.current.shift()!
        if (entry.generation !== generationRef.current) {
          entry.resolve(null)
          continue
        }
        const cached = cacheRef.current.get(entry.fen)
        if (cached) {
          inflightRef.current.delete(entry.fen)
          entry.resolve(cached)
          continue
        }

        const controller = new AbortController()
        currentAbortRef.current = controller
        let result: EngineAnalysis | null = null
        try {
          result = await engine.analyze(entry.fen, {
            depth: depthRef.current,
            multipv: 2,
            signal: controller.signal,
          })
        } catch (reason) {
          if (!isEngineCancellation(reason)) failedRef.current.add(entry.fen)
        }
        if (currentAbortRef.current === controller) currentAbortRef.current = null
        if (inflightRef.current.get(entry.fen) === entry) inflightRef.current.delete(entry.fen)
        const current = entry.generation === generationRef.current && engineRef.current === engine
        if (result && current) store(result)
        entry.resolve(current ? result : null)
      }
    } finally {
      runningRef.current = false
      // The engine may have been swapped while we were awaiting; resume on the new one.
      if (queueRef.current.length > 0 && engineRef.current && engineRef.current !== engine) {
        void pump()
      }
    }
  }, [store])

  const request = useCallback(
    (key: string, front = false): Promise<EngineAnalysis | null> => {
      const cached = cacheRef.current.get(key)
      if (cached) return Promise.resolve(cached)
      const existing = inflightRef.current.get(key)
      if (existing) {
        if (front) {
          const index = queueRef.current.indexOf(existing)
          if (index > 0) {
            queueRef.current.splice(index, 1)
            queueRef.current.unshift(existing)
          }
        }
        return existing.promise
      }
      let resolve!: (analysis: EngineAnalysis | null) => void
      const promise = new Promise<EngineAnalysis | null>((done) => {
        resolve = done
      })
      const entry: QueueEntry = { fen: key, generation: generationRef.current, promise, resolve }
      inflightRef.current.set(key, entry)
      if (front) queueRef.current.unshift(entry)
      else queueRef.current.push(entry)
      void pump()
      return promise
    },
    [pump],
  )

  // Worker lifecycle.
  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      return
    }

    let cancelled = false
    const engine = new UciEngine()
    engineRef.current = engine
    setStatus('loading')

    engine
      .init()
      .then(() => {
        if (cancelled) return
        setStatus('ready')
        void pump()
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      engine.dispose()
      if (engineRef.current === engine) engineRef.current = null
      dropQueue()
    }
  }, [dropQueue, enabled, pump])

  // New game: forget queued work for the previous one.
  const previousGameRef = useRef(gameNumber)
  useEffect(() => {
    if (previousGameRef.current === gameNumber) return
    previousGameRef.current = gameNumber
    dropQueue()
  }, [dropQueue, gameNumber])

  // Positions of the current game are never evicted from the cache.
  useEffect(() => {
    const keep = new Set<string>([fen])
    for (const move of history) {
      keep.add(move.before)
      keep.add(move.after)
    }
    protectedFensRef.current = keep
  }, [fen, history])

  // Background analysis: current position first, then the game history.
  useEffect(() => {
    if (!enabled || !autoAnalyze || status !== 'ready') return
    const wanted = (key: string) =>
      !cacheRef.current.has(key) && !inflightRef.current.has(key) && !failedRef.current.has(key)

    if (!failedRef.current.has(fen)) void request(fen, true)
    const seen = new Set<string>([fen])
    for (let index = history.length - 1; index >= 0; index -= 1) {
      const move = history[index]
      for (const key of [move.after, move.before]) {
        if (seen.has(key)) continue
        seen.add(key)
        if (wanted(key)) void request(key)
      }
    }
  }, [autoAnalyze, enabled, fen, gameNumber, history, request, status])

  // Immutable snapshot per cache change so dependent memos recompute.
  const analyses = useMemo(() => {
    void cacheVersion
    return new Map(cacheRef.current)
  }, [cacheVersion])

  const ratings = useMemo(() => {
    const result: Record<string, RatedMove> = {}
    if (!enabled || !autoAnalyze) return result
    const sans: string[] = []

    history.forEach((move, index) => {
      sans.push(move.san)

      const before = analyses.get(move.before)
      const after = analyses.get(move.after)
      if (!before?.lines.length || !after?.lines.length) return

      const rated = rateMove({
        move,
        ply: index,
        historySans: sans.slice(),
        before,
        after,
        allowBook,
      })
      if (rated) result[move.after] = rated
    })

    return result
  }, [allowBook, analyses, autoAnalyze, enabled, history])

  const latestHumanMove = useMemo(() => {
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index].color === humanColor) return history[index]
    }
    return null
  }, [history, humanColor])

  const latestRated = latestHumanMove ? (ratings[latestHumanMove.after] ?? null) : null

  const ratingPending =
    enabled &&
    autoAnalyze &&
    Boolean(latestHumanMove) &&
    !latestRated &&
    status !== 'error' &&
    !(latestHumanMove && analyses.get(latestHumanMove.after)?.lines.length === 0)

  const accuracy = useMemo(() => {
    const humanRatedMoves = history
      .filter((m) => m.color === humanColor)
      .map((m) => ratings[m.after])
      .filter(Boolean)
    if (humanRatedMoves.length === 0) return null
    const scored = humanRatedMoves.filter((move) => move.rating !== 'book')
    if (scored.length === 0) return 100
    return scored.reduce((sum, move) => sum + move.accuracy, 0) / scored.length
  }, [history, humanColor, ratings])

  const currentAnalysis = analyses.get(fen)
  const currentEval = useMemo(() => evalToWhite(currentAnalysis, turn), [currentAnalysis, turn])

  const currentBestUci = currentAnalysis?.bestMove ?? currentAnalysis?.lines?.[0]?.pv?.[0] ?? null
  const currentBestMove = useMemo(
    () => (currentBestUci ? parseUciMove(currentBestUci) : null),
    [currentBestUci],
  )

  /**
   * Best move for a position. Reuses a cached or in-flight analysis instead of
   * starting a duplicate search; the request jumps the background queue.
   * Stable identity.
   */
  const getBestMove = useCallback(
    async (targetFen: string): Promise<ParsedUciMove | null> => {
      const analysis = await request(targetFen, true)
      const uci = analysis?.bestMove ?? analysis?.lines?.[0]?.pv?.[0]
      return uci ? parseUciMove(uci) : null
    },
    [request],
  )

  const thinking = enabled && autoAnalyze && status === 'ready' && !currentAnalysis

  /** Per-ply evaluation (-1..1, White POV), index 0 = start position. */
  const evalSeries = useMemo(
    () => buildEvalSeries(plyFens(startFen ?? fen, history), analyses),
    [analyses, fen, history, startFen],
  )
  const progress = useMemo(() => {
    const done = evalSeries.filter((value) => value !== null).length
    return { done, total: evalSeries.length }
  }, [evalSeries])

  /** Analyses a position ahead of the background queue (review, best-move arrow). */
  const requestAnalysis = useCallback((targetFen: string) => request(targetFen, true), [request])

  return useMemo(
    () => ({
      status,
      ratings,
      latestRated,
      latestHumanMove,
      ratingPending,
      accuracy,
      currentEval,
      currentBestMove,
      getBestMove,
      thinking,
      analyses,
      evalSeries,
      progress,
      requestAnalysis,
    }),
    [
      accuracy,
      analyses,
      evalSeries,
      progress,
      requestAnalysis,
      currentBestMove,
      currentEval,
      getBestMove,
      latestHumanMove,
      latestRated,
      ratingPending,
      ratings,
      status,
      thinking,
    ],
  )
}
