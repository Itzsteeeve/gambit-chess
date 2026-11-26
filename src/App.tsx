import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { Color, Move, PieceSymbol, Square } from 'chess.js'
import { Flag, Handshake } from 'lucide-react'
import { AnalysisCard } from './components/AnalysisCard'
import { Board } from './components/Board'
import type { CaptureFx, LegalTarget, PromotionState, SystemArrow } from './components/Board'
import { BoardToolbar } from './components/BoardToolbar'
import { CoachCard } from './components/CoachCard'
import type { CoachComment } from './components/CoachCard'
import { ConfirmDialog } from './components/ConfirmDialog'
import { EvalBar } from './components/EvalBar'
import type { GraphMarker } from './components/EvalGraph'
import { GameOverDialog } from './components/GameOverDialog'
import type { HighlightMove, KeyMoment } from './components/GameOverDialog'
import { Header } from './components/Header'
import { ImportDialog } from './components/ImportDialog'
import type { ImportedContent } from './components/ImportDialog'
import { MoveClassificationDialog } from './components/MoveClassificationDialog'
import { NewGameDialog } from './components/NewGameDialog'
import type { NewGameSettings } from './components/NewGameDialog'
import { PieceDefs } from './components/PieceDefs'
import { PlayerStrip } from './components/PlayerStrip'
import { ReviewBar } from './components/ReviewBar'
import { SettingsDialog } from './components/SettingsDialog'
import { SidePanel } from './components/SidePanel'
import { StartScreen } from './components/StartScreen'
import { Toast } from './components/Toast'
import { TrainingScreen } from './components/TrainingScreen'
import {
  BOARD_THEMES,
  COLOR_CHOICES,
  COLOR_LABELS,
  COLOR_NAMES,
  TIME_CONTROLS,
  getTimeControl,
  opposite,
  resolveColorChoice,
} from './game/constants'
import type { BoardThemeId, ColorChoice, TimeControl } from './game/constants'
import { explanationText, speakableText } from './game/coachText'
import { explainHistoryMove, threatsAgainst } from './game/explain'
import {
  DEFAULT_ENGINE_LEVEL_ID,
  GAME_MODES,
  getEngineLevel,
  isEngineLevelId,
  parseUciMove,
} from './game/engineLevels'
import type { EngineLevel, GameMode } from './game/engineLevels'
import { timeoutOutcome } from './game/gameModel'
import { DEFAULT_FEN, HANDICAPS, handicapFen, isHandicapId } from './game/handicap'
import type { HandicapId } from './game/handicap'
import { isPlayablePosition } from './game/importGame'
import type { ImportedGame } from './game/importGame'
import { evalToWhite, materialBalance, MOVE_RATING_META } from './game/moveRating'
import { capturedPieces, fenMoveNumber, moveLabel, REASON_LABELS, resultHeadline } from './game/notation'
import { openingName } from './game/openings'
import { premovePromotion, premoveTargets } from './game/premove'
import { collectPuzzles, isPuzzleList, mergePuzzles } from './game/puzzles'
import type { Puzzle } from './game/puzzles'
import { fenTurn, highlightMoves, keyMoments, nextMistakePly } from './game/review'
import { useChessClock } from './game/useChessClock'
import type { ClockSnapshot } from './game/useChessClock'
import { useChessGame } from './game/useChessGame'
import { useEngineAnalysis, useStockfishPlay } from './game/useStockfish'
import { copyText } from './lib/clipboard'
import { isAppearance, useApplyAppearance } from './lib/appearance'
import type { Appearance } from './lib/appearance'
import { useSound } from './lib/useSound'
import { useSpeech } from './lib/useSpeech'
import { isBoolean, isOneOf, useStoredState } from './lib/storage'
import { useToasts } from './lib/useToasts'

type DialogId = 'new' | 'position' | 'import' | 'settings' | 'resign' | 'draw' | 'ratings' | null
type Screen = 'home' | 'game' | 'training'

interface CoachDemo {
  /** Index of the discussed move in the history. */
  index: number
  /** Position after that move; identifies it across undo and new games. */
  after: string
  view: 'problem' | 'better'
}

interface Premove {
  from: Square
  to: Square
  promotion?: PieceSymbol
}

const isBoardTheme = isOneOf<BoardThemeId>(BOARD_THEMES.map((theme) => theme.id))
const isColor = isOneOf<Color>(['w', 'b'])
const isColorChoice = isOneOf<ColorChoice>(COLOR_CHOICES.map((choice) => choice.id))
const isGameMode = isOneOf<GameMode>(GAME_MODES)
const isTempoId = isOneOf<string>(TIME_CONTROLS.map((control) => control.id))

function initialClock(timeControl: TimeControl): ClockSnapshot {
  const ms = timeControl.minutes * 60_000
  return { w: ms, b: ms }
}

/** Square a later move captured on (handles en passant). */
function capturedSquareOf(move: Move): Square | null {
  if (!move.captured) return null
  if (move.flags.includes('e')) return `${move.to[0]}${move.from[1]}` as Square
  return move.to
}

function sanOf(fen: string, uci: string | null | undefined): string | null {
  const parsed = uci ? parseUciMove(uci) : null
  if (!parsed) return null
  try {
    return new Chess(fen).move(parsed).san
  } catch {
    return null
  }
}

function eloLabel(level: EngineLevel) {
  return level.elo === null ? 'Plná síla (Max)' : `Elo ${level.elo}`
}

/** Keeps a ref pointing at the latest value without re-triggering effects. */
function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

export default function App() {
  const game = useChessGame()
  const sound = useSound()
  const { toast, showToast } = useToasts()

  const [gameMode, setGameMode] = useStoredState<GameMode>('gambit.mode', 'stockfish', isGameMode)
  const [engineLevelId, setEngineLevelId] = useStoredState<string>(
    'gambit.engine-level',
    DEFAULT_ENGINE_LEVEL_ID,
    isEngineLevelId,
  )
  const [orientation, setOrientation] = useStoredState<Color>('gambit.orientation', 'w', isColor)
  const [boardTheme, setBoardTheme] = useStoredState<BoardThemeId>(
    'gambit.board-theme',
    'emerald',
    isBoardTheme,
  )
  const [appearance, setAppearance] = useStoredState<Appearance>('gambit.appearance', 'system', isAppearance)
  const [reduceTransparency, setReduceTransparency] = useStoredState(
    'gambit.reduce-transparency',
    false,
    isBoolean,
  )
  useApplyAppearance(appearance, reduceTransparency)
  const [showCoordinates, setShowCoordinates] = useStoredState('gambit.coordinates', true, isBoolean)
  const [animations, setAnimations] = useStoredState('gambit.animations', true, isBoolean)
  const [storedTempo, setStoredTempo] = useStoredState('gambit.tempo', 'none', isTempoId)
  const [colorChoice, setColorChoice] = useStoredState<ColorChoice>('gambit.player-color', 'w', isColorChoice)
  const [storedHandicap, setStoredHandicap] = useStoredState<HandicapId>('gambit.handicap', 'none', isHandicapId)
  const [showThreats, setShowThreats] = useStoredState('gambit.threats', false, isBoolean)
  const [coachVoice, setCoachVoice] = useStoredState('gambit.coach-voice', false, isBoolean)
  /** Positions from the player's mistakes, for the training screen. */
  const [puzzles, setPuzzles] = useStoredState<Puzzle[]>('gambit.puzzles', [], isPuzzleList)
  /** Puzzle the training opens with (null = the newest unsolved one). */
  const [trainingStart, setTrainingStart] = useState<string | null>(null)

  const engineLevel = useMemo(() => getEngineLevel(engineLevelId), [engineLevelId])

  // The game is not persisted, so every load starts on the home screen.
  const [screen, setScreen] = useState<Screen>('home')
  /** Colour the human plays against Stockfish in the current game. */
  const [humanColor, setHumanColor] = useState<Color>('w')
  const engineColor = opposite(humanColor)
  const [gameHandicap, setGameHandicap] = useState<HandicapId>('none')
  /** Position the current game was started from by "Hrát odsud" or a FEN import. */
  const [positionStart, setPositionStart] = useState<string | null>(null)
  /** Position offered by the "Hrát z pozice" dialog. */
  const [positionOffer, setPositionOffer] = useState<{ fen: string; color: Color } | null>(null)
  /** Set while the board shows an imported game record. */
  const [imported, setImported] = useState<ImportedGame | null>(null)

  const [timeControl, setTimeControl] = useState<TimeControl>(() => getTimeControl(storedTempo))
  const [selected, setSelected] = useState<Square | null>(null)
  const [promotion, setPromotion] = useState<PromotionState | null>(null)
  const [captureFx, setCaptureFx] = useState<CaptureFx | null>(null)
  const [dialog, setDialog] = useState<DialogId>(null)
  const [resigningColor, setResigningColor] = useState<Color>('w')
  const [gameOverOpen, setGameOverOpen] = useState(false)
  const [durationSeconds, setDurationSeconds] = useState(0)
  /** Ply shown in read-only review (null = live position). */
  const [reviewPly, setReviewPly] = useState<number | null>(null)
  const [premove, setPremove] = useState<Premove | null>(null)
  /** Coach demonstration on the board; the game (engine and clock) waits meanwhile. */
  const [demo, setDemo] = useState<CoachDemo | null>(null)
  /** Position the player returned to with "Zkusit znovu". */
  const [retryFen, setRetryFen] = useState<string | null>(null)
  // Stale once the move it talks about is no longer in the game.
  const activeDemo = demo && game.history[demo.index]?.after === demo.after ? demo : null
  const demoActive = activeDemo !== null

  const [engineThinking, setEngineThinking] = useState(false)

  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0)
  const [hintMove, setHintMove] = useState<{ from: Square; to: Square } | null>(null)
  const [hintLoading, setHintLoading] = useState(false)
  const [isUndoing, setIsUndoing] = useState(false)
  const isUndoingRef = useRef(false)

  const captureIdRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)
  /** Clock times for each ply reached (index = number of moves played). */
  const clockHistoryRef = useRef<ClockSnapshot[]>([initialClock(timeControl)])

  // An imported record is neutral, whatever mode the next game will be played in.
  const isEngineGame = gameMode === 'stockfish' && !imported
  /** The opening book and opening advice only apply from the standard position. */
  const standardStart = game.startFen === DEFAULT_FEN
  /** Eval bar, coach and live move ratings only make sense against Stockfish. */
  const showAnalysis = isEngineGame
  /** Local games are analysed once they are over (post-game review). */
  const postGameAnalysis = Boolean(game.outcome) && game.history.length > 0
  const analysisActive = showAnalysis || postGameAnalysis
  /** In local mode the analysis worker is only started once a hint is asked for. */
  const [hintEngineWanted, setHintEngineWanted] = useState(false)

  // Stockfish Playing Worker
  const stockfishPlay = useStockfishPlay(isEngineGame)

  // Stockfish Analysis Worker
  const analysis = useEngineAnalysis({
    enabled: analysisActive || hintEngineWanted,
    autoAnalyze: analysisActive,
    fen: game.fen,
    turn: game.turn,
    history: game.history,
    humanColor,
    gameNumber: game.gameNumber,
    startFen: game.startFen,
    allowBook: standardStart,
  })

  const engineError =
    isEngineGame && stockfishPlay.status === 'error'
      ? (stockfishPlay.error ?? 'Stockfish neodpovídá')
      : null

  const timeControlLabel =
    timeControl.id === 'none' ? 'Bez hodin' : `${timeControl.label} · ${timeControl.caption}`

  // ---------------------------------------------------------------- review
  const history = game.history
  const requestedPly = activeDemo
    ? activeDemo.index + (activeDemo.view === 'problem' ? 1 : 0)
    : reviewPly
  const viewPly = requestedPly !== null && requestedPly < history.length ? requestedPly : history.length
  const reviewing = screen === 'game' && viewPly < history.length
  const positionAt = game.positionAt
  const viewState = useMemo(
    () => (reviewing ? positionAt(viewPly) : null),
    // history: positions change with every move even if the ply number does not.
    [history, positionAt, reviewing, viewPly],
  )
  const viewFen = viewState?.fen ?? game.fen
  const viewHistory = useMemo(() => (reviewing ? history.slice(0, viewPly) : history), [history, reviewing, viewPly])

  useEffect(() => {
    if (reviewPly !== null && reviewPly >= history.length) setReviewPly(null)
  }, [history.length, reviewPly])

  const { timeout: gameTimeout, getFen } = game
  const playSound = sound.play
  const handleTimeout = useCallback(
    (loser: Color) => {
      const outcome = timeoutOutcome(getFen(), loser)
      gameTimeout(loser)
      playSound(outcome.winner ? 'end-win' : 'end-draw')
    },
    [gameTimeout, getFen, playSound],
  )

  const clockPaused = gameOverOpen || dialog !== null || promotion !== null || demoActive || screen !== 'game'
  const clock = useChessClock({
    timeControl,
    activeColor: game.turn,
    enabled: timeControl.id !== 'none' && game.started && !game.outcome,
    paused: clockPaused,
    resetKey: game.gameNumber,
    onTimeout: handleTimeout,
  })

  // Open the result card whenever a new result is produced. An imported game
  // opens in review instead; the card stays one click away.
  useEffect(() => {
    setGameOverOpen(Boolean(game.outcome) && !imported)
    if (game.outcome) setPremove(null)
  }, [game.outcome, imported])

  // Track the active game duration for the result card.
  useEffect(() => {
    if (game.history.length === 0) {
      startTimeRef.current = null
      return
    }
    if (startTimeRef.current === null) startTimeRef.current = Date.now()
  }, [game.history.length])

  useEffect(() => {
    if (!game.outcome) {
      setDurationSeconds(0)
      return
    }
    const start = startTimeRef.current ?? Date.now()
    setDurationSeconds(Math.max(1, Math.round((Date.now() - start) / 1000)))
  }, [game.outcome])

  useEffect(() => {
    document.documentElement.dataset.motion = animations ? 'on' : 'off'
    return () => {
      delete document.documentElement.dataset.motion
    }
  }, [animations])

  const unlockSound = sound.unlock
  useEffect(() => {
    const unlock = () => unlockSound()
    window.addEventListener('pointerdown', unlock, { once: true, capture: true })
    return () => window.removeEventListener('pointerdown', unlock, { capture: true })
  }, [unlockSound])

  const commitMove = useCallback(
    (from: Square, to: Square, promotionType?: PieceSymbol, byEngine = false): boolean => {
      const mover = game.turn
      const plyBefore = game.moveCount
      const result = game.move(from, to, promotionType)
      if (!result.ok || !result.move) {
        sound.play('illegal')
        return false
      }

      // An engine move keeps the piece the player picked up for a premove.
      if (!byEngine) setSelected(null)
      setPromotion(null)
      setHintLevel(0)
      setHintMove(null)
      setRetryFen(null)
      if (timeControl.id !== 'none') {
        // The clock only starts after the first move of the game, so that move earns no increment.
        if (plyBefore > 0) clock.addIncrement(mover)
        const clockHistory = clockHistoryRef.current
        clockHistory.length = plyBefore + 1
        clockHistory[plyBefore + 1] = clock.getSnapshot()
      }

      if (result.captured && result.capturedSquare) {
        captureIdRef.current += 1
        setCaptureFx({
          id: captureIdRef.current,
          piece: result.captured,
          square: result.capturedSquare,
        })
      }

      const move = result.move
      if (result.outcome) {
        window.setTimeout(() => {
          sound.play(result.outcome?.winner ? 'end-win' : 'end-draw')
        }, 90)
      } else {
        if (move.isKingsideCastle() || move.isQueensideCastle()) {
          sound.play('castle')
        } else if (result.captured) {
          sound.play('capture')
        } else {
          sound.play('move')
        }

        if (move.promotion) {
          window.setTimeout(() => sound.play('promote'), 100)
        } else if (move.san.includes('+')) {
          window.setTimeout(() => sound.play('check'), 120)
        }
      }

      return true
    },
    [clock, game, sound, timeControl.id],
  )

  /** Restores the clock to the snapshot stored for `ply` (undo/redo). */
  const restoreClockFor = useCallback(
    (ply: number) => {
      if (timeControl.id === 'none') return
      const snapshot = clockHistoryRef.current[ply]
      if (snapshot) clock.restore(snapshot)
    },
    [clock, timeControl.id],
  )

  // Latest values for the engine effect, so it can be keyed on the position only.
  const engineLatest = useLatest({ commitMove, getMove: stockfishPlay.getMove, engineLevel, fen: game.fen })

  // Drive Stockfish's move whenever it is the engine's turn (also its first move as White).
  useEffect(() => {
    if (!isEngineGame) return
    if (screen !== 'game') return
    if (game.turn !== engineColor) return
    if (game.outcome) return
    if (isUndoing || demoActive) return

    const controller = new AbortController()
    const fen = game.fen
    const { getMove, engineLevel: level } = engineLatest.current
    setEngineThinking(true)

    getMove(fen, level, controller.signal)
      .then((uci) => {
        if (controller.signal.aborted) return
        setEngineThinking(false)
        if (engineLatest.current.fen !== fen) return
        const parsed = uci ? parseUciMove(uci) : null
        if (!parsed) return
        engineLatest.current.commitMove(parsed.from as Square, parsed.to as Square, parsed.promotion, true)
      })
      .catch(() => {
        // Failures surface through stockfishPlay.status/error (engineError).
        if (!controller.signal.aborted) setEngineThinking(false)
      })

    return () => {
      // Sends UCI `stop` for an in-flight search.
      controller.abort()
      setEngineThinking(false)
    }
  }, [
    demoActive,
    engineColor,
    engineLatest,
    engineLevelId,
    game.fen,
    game.outcome,
    game.turn,
    isEngineGame,
    isUndoing,
    screen,
    stockfishPlay.attempt,
  ])

  // Surface engine failures; any click retries.
  const retryEngine = stockfishPlay.retry
  useEffect(() => {
    if (!engineError) return
    showToast('Stockfish neodpovídá. Klepni kamkoli pro nový pokus.', 'error')
    const retry = () => retryEngine()
    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', retry, { once: true })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', retry)
    }
  }, [engineError, retryEngine, showToast])

  const anyModal = dialog !== null || gameOverOpen
  const baseInteractive =
    screen === 'game' && !game.outcome && !anyModal && !isUndoing && !reviewing && !demoActive

  const userCanInteract =
    baseInteractive && !(isEngineGame && (game.turn !== humanColor || engineThinking))

  /** Against Stockfish, the human may queue a move while the engine is to move. */
  const premoveMode = baseInteractive && isEngineGame && !promotion && game.turn !== humanColor

  /** Colour whose pieces can be picked up right now. */
  const moverColor: Color = premoveMode ? humanColor : game.turn
  const canAct = userCanInteract || premoveMode

  // Reset hint when position changes
  useEffect(() => {
    setHintLevel(0)
    setHintMove(null)
    setHintLoading(false)
  }, [game.fen])

  const setHintMoveIfChanged = useCallback((next: { from: Square; to: Square } | null) => {
    setHintMove((previous) => {
      if (previous === next) return previous
      if (previous && next && previous.from === next.from && previous.to === next.to) return previous
      return next
    })
  }, [])

  const hintLatest = useLatest({ getLegalMoves: game.getLegalMoves, pieces: game.pieces, turn: game.turn })
  const bestFrom = analysis.currentBestMove?.from ?? null
  const bestTo = analysis.currentBestMove?.to ?? null
  const getBestMove = analysis.getBestMove

  // Resolve best move when hint is requested
  useEffect(() => {
    if (hintLevel === 0) {
      setHintMoveIfChanged(null)
      setHintLoading(false)
      return
    }

    if (bestFrom && bestTo) {
      setHintMoveIfChanged({ from: bestFrom as Square, to: bestTo as Square })
      setHintLoading(false)
      return
    }

    let cancelled = false
    setHintLoading(true)

    getBestMove(game.fen)
      .then((move) => {
        if (cancelled) return
        setHintLoading(false)
        if (move) {
          setHintMoveIfChanged({ from: move.from as Square, to: move.to as Square })
          return
        }
        const { pieces, turn, getLegalMoves } = hintLatest.current
        const legal = pieces
          .filter((p) => p.color === turn)
          .flatMap((p) => getLegalMoves(p.square))
        if (legal.length > 0) setHintMoveIfChanged({ from: legal[0].from, to: legal[0].to })
      })
      .catch(() => {
        if (!cancelled) setHintLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [bestFrom, bestTo, game.fen, getBestMove, hintLatest, hintLevel, setHintMoveIfChanged])

  const handleToggleHint = useCallback(() => {
    if (game.outcome || !userCanInteract || isUndoingRef.current) return
    sound.play('ui')
    if (!showAnalysis) setHintEngineWanted(true)
    setHintLevel((prev) => {
      if (prev === 0) return 1
      if (prev === 1) return 2
      return 0
    })
  }, [game.outcome, showAnalysis, sound, userCanInteract])

  const legalTargets = useMemo<LegalTarget[]>(() => {
    if (!selected || !canAct) return []
    if (premoveMode) {
      const occupied = new Map(game.pieces.map((piece) => [piece.square, piece.color]))
      return premoveTargets(game.fen, selected).map((square) => ({
        square,
        capture: occupied.has(square) && occupied.get(square) !== humanColor,
      }))
    }
    const targets: LegalTarget[] = []
    const seen = new Set<Square>()
    for (const move of game.getLegalMoves(selected)) {
      if (seen.has(move.to)) continue
      seen.add(move.to)
      targets.push({ square: move.to, capture: Boolean(move.captured) })
    }
    return targets
    // game.fen: legal moves change with the position even if `selected` does not.
  }, [selected, canAct, premoveMode, game.getLegalMoves, game.fen, game.pieces, humanColor])

  const tryMove = useCallback(
    (from: Square, to: Square) => {
      if (!canAct || promotion) return
      if (premoveMode) {
        if (!premoveTargets(game.fen, from).includes(to)) {
          setSelected(null)
          return
        }
        setPremove({ from, to, promotion: premovePromotion(game.fen, from, to) })
        setSelected(null)
        sound.play('select')
        return
      }
      const candidates = game.getLegalMoves(from).filter((move) => move.to === to)
      if (candidates.length === 0) {
        sound.play('illegal')
        return
      }

      const options = candidates
        .filter((move) => move.promotion)
        .map((move) => move.promotion as PieceSymbol)

      if (options.length > 0) {
        const piece = game.pieces.find((candidate) => candidate.square === from)
        setSelected(from)
        setPromotion({
          from,
          to,
          color: piece?.color ?? game.turn,
          options,
        })
        return
      }

      commitMove(from, to)
    },
    [canAct, commitMove, game, premoveMode, promotion, sound],
  )

  const handleSelect = useCallback(
    (square: Square) => {
      if (!canAct || promotion || selected === square) return
      setSelected(square)
      // Keep an arrow (level 2) hint while the player explores other pieces, and
      // keep any hint when the hinted piece itself is picked up. Only a level-1
      // "which piece" hint is dismissed by choosing a different piece.
      if (hintLevel === 1 && hintMove?.from !== square) {
        setHintLevel(0)
        setHintMove(null)
      }
      sound.play('select')
    },
    [canAct, hintLevel, hintMove, promotion, selected, sound],
  )

  const handleSquareTap = useCallback(
    (square: Square, wasSelected: boolean) => {
      if (!canAct || promotion) return
      if (wasSelected) {
        setSelected(null)
        return
      }

      const piece = game.pieces.find((candidate) => candidate.square === square)

      if (selected) {
        const isTarget = premoveMode
          ? premoveTargets(game.fen, selected).includes(square) && piece?.color !== humanColor
          : game.getLegalMoves(selected).some((move) => move.to === square)
        if (isTarget) {
          tryMove(selected, square)
          return
        }
        if (piece?.color === moverColor) {
          handleSelect(square)
          return
        }
        setSelected(null)
        return
      }

      if (piece?.color === moverColor) {
        handleSelect(square)
      } else if (premoveMode && premove) {
        // Tapping an empty square or an enemy piece drops a queued premove.
        setPremove(null)
      }
    },
    [canAct, game, handleSelect, humanColor, moverColor, premove, premoveMode, promotion, selected, tryMove],
  )

  const handleDrop = useCallback(
    (from: Square, to: Square) => {
      tryMove(from, to)
    },
    [tryMove],
  )

  const handlePromote = useCallback(
    (type: PieceSymbol) => {
      if (!promotion) return
      commitMove(promotion.from, promotion.to, type)
    },
    [commitMove, promotion],
  )

  const handleCancelPromotion = useCallback(() => {
    if (!promotion) return
    setSelected(promotion.from)
    setPromotion(null)
  }, [promotion])

  // Execute a queued premove as soon as it is the human's turn (if still legal).
  const premoveLatest = useLatest({ commitMove, getLegalMoves: game.getLegalMoves })
  useEffect(() => {
    if (!premove) return
    if (!isEngineGame || game.outcome) {
      setPremove(null)
      return
    }
    if (game.turn !== humanColor || isUndoing) return
    const queued = premove
    setPremove(null)
    const moves = premoveLatest.current.getLegalMoves(queued.from).filter((move) => move.to === queued.to)
    if (moves.length === 0) return
    const needsPromotion = moves.some((move) => move.promotion)
    premoveLatest.current.commitMove(queued.from, queued.to, needsPromotion ? (queued.promotion ?? 'q') : undefined)
  }, [game.fen, game.outcome, game.turn, humanColor, isEngineGame, isUndoing, premove, premoveLatest])

  const cancelPremove = useCallback((): boolean => {
    if (!premove && !(premoveMode && selected)) return false
    setPremove(null)
    setSelected(null)
    return true
  }, [premove, premoveMode, selected])

  /** Fewest plies that must stay on the board (an opening move by Stockfish). */
  const keepPlies = isEngineGame && fenTurn(game.startFen) !== humanColor ? 1 : 0
  const undoPlies = isEngineGame && game.turn === humanColor ? 2 : 1
  const canUndoNow = game.canUndo && !isUndoing && history.length - undoPlies >= keepPlies

  const handleUndo = useCallback(async () => {
    if (isUndoingRef.current || !canUndoNow) return
    isUndoingRef.current = true
    // Also suppresses (and, via its cleanup, stops) the engine search.
    setIsUndoing(true)
    setHintLevel(0)
    setHintMove(null)
    setSelected(null)
    setPromotion(null)
    setCaptureFx(null)
    setPremove(null)
    setReviewPly(null)
    setDemo(null)

    try {
      let ply = game.moveCount
      if (isEngineGame && game.turn === humanColor && game.history.length >= 2) {
        // Take back Stockfish's reply and the player's move, one after another.
        if (game.undo()) {
          ply -= 1
          sound.play('move')
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250))
        if (game.undo()) {
          ply -= 1
          sound.play('move')
        }
      } else if (game.undo()) {
        ply -= 1
        sound.play('move')
      }
      restoreClockFor(ply)
    } finally {
      isUndoingRef.current = false
      setIsUndoing(false)
    }
  }, [canUndoNow, game, humanColor, isEngineGame, restoreClockFor, sound])

  const handleRedo = useCallback(() => {
    if (isUndoingRef.current || !game.redo()) {
      sound.play('illegal')
      return
    }
    restoreClockFor(game.moveCount + 1)
    setHintLevel(0)
    setHintMove(null)
    setSelected(null)
    setPromotion(null)
    setPremove(null)
    sound.play('move')
  }, [game, restoreClockFor, sound])

  const handleFlip = useCallback(() => {
    setOrientation((value) => (value === 'w' ? 'b' : 'w'))
    sound.play('ui')
  }, [setOrientation, sound])

  /** Clears everything that belonged to the previous game and shows the board. */
  const enterGame = useCallback(
    (clockSettings: TimeControl) => {
      clockHistoryRef.current = [initialClock(clockSettings)]
      setSelected(null)
      setPromotion(null)
      setCaptureFx(null)
      setHintLevel(0)
      setHintMove(null)
      setPremove(null)
      setReviewPly(null)
      setDemo(null)
      setRetryFen(null)
      setGameOverOpen(false)
      setDialog(null)
      setDurationSeconds(0)
      setScreen('game')
      startTimeRef.current = null
      sound.play('ui')
    },
    [sound],
  )

  const startNewGame = useCallback(
    (settings: NewGameSettings) => {
      const { mode, levelId, timeControl: nextTimeControl, color, handicap, startFen } = settings
      setGameMode(mode)
      setEngineLevelId(levelId)
      // A game from a position is a one-off: it leaves these preferences alone.
      if (!startFen) {
        setColorChoice(color)
        setStoredHandicap(handicap)
      }
      setTimeControl(nextTimeControl)
      setStoredTempo(nextTimeControl.id)

      const engine = mode === 'stockfish'
      const human = engine ? resolveColorChoice(color) : 'w'
      const level = getEngineLevel(levelId)
      const activeHandicap = engine && !startFen ? handicap : 'none'
      setHumanColor(human)
      setGameHandicap(activeHandicap)
      setPositionStart(startFen ?? null)
      setImported(null)
      // Face your own pieces: the board turns to the player's colour.
      setOrientation(engine ? human : 'w')

      const engineName = `Stockfish (${eloLabel(level)})`
      game.reset({
        fen: startFen ?? (activeHandicap === 'none' ? undefined : handicapFen(activeHandicap, opposite(human))),
        event: engine ? 'Gambit — partie proti Stockfishi' : undefined,
        white: engine ? (human === 'w' ? 'Hráč' : engineName) : undefined,
        black: engine ? (human === 'b' ? 'Hráč' : engineName) : undefined,
      })
      enterGame(nextTimeControl)
    },
    [
      enterGame,
      game,
      setColorChoice,
      setEngineLevelId,
      setGameMode,
      setOrientation,
      setStoredHandicap,
      setStoredTempo,
    ],
  )

  /** Puts an imported record on the board, in review from its first position. */
  const openRecord = useCallback(
    (record: ImportedGame) => {
      const untimed = getTimeControl('none')
      setTimeControl(untimed)
      setHumanColor('w')
      setGameHandicap('none')
      setPositionStart(null)
      setImported(record)
      setOrientation('w')
      game.load(record)
      enterGame(untimed)
      setReviewPly(0)
      showToast(
        record.hasMoreGames ? 'Text obsahoval víc partií, načetla se první.' : 'Partie importována',
      )
    },
    [enterGame, game, setOrientation, showToast],
  )

  /** Opens the dialog for a new game from `fen`; `color` is preselected there. */
  const offerPosition = useCallback((fen: string, color: Color) => {
    setPositionOffer({ fen, color })
    setGameOverOpen(false)
    setDialog('position')
  }, [])

  const handleImport = useCallback(
    (content: ImportedContent) => {
      if (content.kind === 'game') openRecord(content.game)
      else offerPosition(content.fen, fenTurn(content.fen))
    },
    [offerPosition, openRecord],
  )

  const openImport = useCallback(() => {
    setGameOverOpen(false)
    setDialog('import')
  }, [])

  const lastSettings = useMemo<NewGameSettings>(
    () => ({
      mode: gameMode,
      levelId: engineLevelId,
      timeControl: getTimeControl(storedTempo),
      color: colorChoice,
      handicap: storedHandicap,
    }),
    [colorChoice, engineLevelId, gameMode, storedHandicap, storedTempo],
  )

  /** A game from a position is replayed from it, with the same colour. */
  const replaySettings = useMemo<NewGameSettings>(
    () => (positionStart ? { ...lastSettings, startFen: positionStart, color: humanColor } : lastSettings),
    [humanColor, lastSettings, positionStart],
  )

  const handleRematch = useCallback(() => {
    startNewGame({ ...replaySettings, timeControl })
  }, [replaySettings, startNewGame, timeControl])

  /** Picking another level in the header starts a new game with it right away. */
  const changeLevel = useCallback(
    (levelId: string) => {
      startNewGame({ ...replaySettings, mode: 'stockfish', levelId })
    },
    [replaySettings, startNewGame],
  )

  const openNewGame = useCallback(() => {
    setGameOverOpen(false)
    setDialog('new')
  }, [])

  const goHome = useCallback(() => {
    setGameOverOpen(false)
    setDialog(null)
    setSelected(null)
    setReviewPly(null)
    setDemo(null)
    setScreen('home')
  }, [])

  const openResign = useCallback(() => {
    // Captured now so the dialog text and the result never flip if the engine moves meanwhile.
    setResigningColor(isEngineGame ? humanColor : game.turn)
    setDialog('resign')
  }, [game.turn, humanColor, isEngineGame])

  const handleResignConfirm = useCallback(() => {
    game.resign(resigningColor)
    setDialog(null)
    setSelected(null)
    setPromotion(null)
    setPremove(null)
    sound.play(isEngineGame ? 'end-draw' : 'end-win')
  }, [game, isEngineGame, resigningColor, sound])

  const handleDrawConfirm = useCallback(() => {
    game.agreeDraw()
    setDialog(null)
    setSelected(null)
    setPromotion(null)
    setPremove(null)
    sound.play('end-draw')
  }, [game, sound])

  const copy = useCallback(
    async (text: string, label: string) => {
      const copied = await copyText(text)
      showToast(
        copied ? `${label} zkopírováno` : 'Kopírování se nepovedlo',
        copied ? 'default' : 'error',
      )
      if (copied) sound.play('ui')
    },
    [showToast, sound],
  )

  const copyPgn = useCallback(() => {
    void copy(game.getPgn(), 'PGN')
  }, [copy, game])

  const copyFen = useCallback(() => {
    void copy(reviewing ? viewFen : game.getFen(), 'FEN')
  }, [copy, game, reviewing, viewFen])

  const toggleSound = useCallback(() => {
    sound.toggle()
  }, [sound])

  // ---------------------------------------------------------------- review navigation
  const showPly = useCallback(
    (ply: number) => {
      const clamped = Math.max(0, Math.min(history.length, ply))
      setSelected(null)
      setPromotion(null)
      setHintLevel(0)
      setHintMove(null)
      setDemo(null)
      setReviewPly(clamped >= history.length ? null : clamped)
    },
    [history.length],
  )

  const openDemo = useCallback(
    (index: number, view: CoachDemo['view']) => {
      const move = history[index]
      if (!move) return
      setSelected(null)
      setPromotion(null)
      setPremove(null)
      setHintLevel(0)
      setHintMove(null)
      setDemo({ index, after: move.after, view })
      // On narrow layouts the coach sits below the board.
      document.querySelector('.board-frame')?.scrollIntoView({ block: 'nearest' })
    },
    [history],
  )
  const closeDemo = useCallback(() => setDemo(null), [])

  const mistakeColor: Color | null = isEngineGame ? humanColor : null
  const ratings = analysisActive ? analysis.ratings : undefined
  const nextMistake = useMemo(
    () => nextMistakePly(history, ratings ?? {}, mistakeColor, reviewing ? viewPly : 0),
    [history, mistakeColor, ratings, reviewing, viewPly],
  )

  const jumpToNextMistake = useCallback(() => {
    if (nextMistake === null) return
    setGameOverOpen(false)
    setScreen('game')
    showPly(nextMistake)
  }, [nextMistake, showPly])

  const reviewFromDialog = useCallback(
    (ply: number) => {
      setGameOverOpen(false)
      showPly(ply)
    },
    [showPly],
  )

  // Make sure the reviewed position gets analysed first (best-move arrow, eval bar).
  const requestAnalysis = analysis.requestAnalysis
  const analysisReady = analysis.status === 'ready'
  useEffect(() => {
    if (!reviewing || !analysisActive || !analysisReady) return
    void requestAnalysis(viewFen)
  }, [analysisActive, analysisReady, requestAnalysis, reviewing, viewFen])

  useEffect(() => {
    const clearSelectionOutsideBoard = (event: PointerEvent) => {
      // The target can be the document or window (e.g. synthetic events), which have no closest().
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('.board-frame')) return
      setSelected(null)
    }
    document.addEventListener('pointerdown', clearSelectionOutsideBoard)
    return () => document.removeEventListener('pointerdown', clearSelectionOutsideBoard)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return

      const anyDialog = dialog !== null || gameOverOpen || Boolean(promotion)
      if (anyDialog) return
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        openNewGame()
        return
      }
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault()
        toggleSound()
        return
      }
      if (screen !== 'game') return
      if (event.key === 'f' || event.key === 'F') {
        event.preventDefault()
        handleFlip()
        return
      }
      if (event.key === 'Escape') {
        if (demoActive) {
          closeDemo()
          return
        }
        if (cancelPremove()) return
        if (reviewing) {
          showPly(history.length)
          return
        }
        setSelected(null)
        setHintLevel(0)
        setHintMove(null)
        return
      }
      if (target?.closest('.board-grid, [role="tablist"], [role="slider"]')) return
      if (event.key === 'Home' || event.key === 'End') {
        if (history.length === 0) return
        event.preventDefault()
        showPly(event.key === 'Home' ? 0 : history.length)
        return
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const step = event.key === 'ArrowLeft' ? -1 : 1
        // While reviewing, or after the game (undo is closed then), arrows browse the moves.
        if (reviewing || game.outcome || demoActive) {
          showPly(viewPly + step)
          return
        }
        // Auto-repeat would chain several take-backs while one is animating.
        if (event.repeat) return
        if (step < 0) void handleUndo()
        else handleRedo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    cancelPremove,
    closeDemo,
    demoActive,
    dialog,
    game.outcome,
    gameOverOpen,
    handleFlip,
    handleRedo,
    handleUndo,
    history.length,
    openNewGame,
    promotion,
    reviewing,
    screen,
    showPly,
    toggleSound,
    viewPly,
  ])

  // ---------------------------------------------------------------- derived view
  const topColor: Color = orientation === 'w' ? 'b' : 'w'
  const bottomColor: Color = orientation === 'w' ? 'w' : 'b'
  const captured = {
    w: capturedPieces(viewHistory, 'w'),
    b: capturedPieces(viewHistory, 'b'),
  }
  // From the board itself, so a handicap start and promotions count correctly.
  const balance = materialBalance(viewFen, 'w')
  const clockRunning = game.started && !game.outcome && !clockPaused

  const playerName = (color: Color) => {
    if (imported) return color === 'w' ? imported.white : imported.black
    if (isEngineGame) return color === engineColor ? 'Stockfish' : 'Ty'
    return COLOR_NAMES[color]
  }
  const shortName = (color: Color) => (isEngineGame || imported ? playerName(color) : COLOR_LABELS[color])

  const viewTurn = viewState?.turn ?? game.turn
  const viewCheck = viewState ? viewState.isCheck : game.isCheck

  const renderPlayer = (color: Color) => {
    const isEngine = isEngineGame && color === engineColor
    const importedElo = color === 'w' ? imported?.whiteElo : imported?.blackElo
    const rating = isEngine
      ? `${eloLabel(engineLevel)}${gameHandicap !== 'none' ? ` · ${HANDICAPS.find((h) => h.id === gameHandicap)?.label.toLowerCase()}` : ''}`
      : isEngineGame
        ? COLOR_LABELS[color]
        : importedElo
          ? `Elo ${importedElo}`
          : undefined

    return (
      <PlayerStrip
        color={color}
        active={game.turn === color && !game.outcome}
        inCheck={viewCheck && viewTurn === color}
        captured={captured[color]}
        advantage={color === 'w' ? balance : -balance}
        winner={game.outcome?.winner === color}
        gameOver={Boolean(game.outcome)}
        showClock={timeControl.id !== 'none'}
        clockRunning={clockRunning && game.turn === color}
        clockMs={color === 'w' ? clock.whiteMs : clock.blackMs}
        lowTime={clock.isLow(color)}
        criticalTime={clock.isCritical(color)}
        paused={clockPaused && !game.outcome && timeControl.id !== 'none' && game.started}
        name={playerName(color)}
        rating={rating}
        isEngine={isEngine}
        thinking={isEngine && engineThinking && game.turn === color}
      />
    )
  }

  const lastMove = history[history.length - 1]
  const reviewedMove = reviewing && viewPly > 0 ? history[viewPly - 1] : null

  const announcement = reviewing
    ? `Prohlížení: ${reviewedMove ? moveLabel(reviewedMove) : 'výchozí pozice'}.`
    : game.outcome
      ? `${resultHeadline(game.outcome)}. ${REASON_LABELS[game.outcome.reason]}.`
      : lastMove
        ? `${
            isEngineGame
              ? lastMove.color === engineColor
                ? 'Stockfish zahrál'
                : 'Zahrál jsi'
              : `${COLOR_NAMES[lastMove.color]} zahrál`
          } ${lastMove.san}.${
            game.isCheck ? ' Šach.' : ''
          } Na tahu ${COLOR_LABELS[game.turn].toLowerCase()}.`
        : `Nová partie. Na tahu ${COLOR_LABELS[game.turn].toLowerCase()}.`

  // The badge belongs to the rated move's piece: it is dropped as soon as a
  // later move captures on (or moves through) that square.
  const liveBadge = useMemo(() => {
    if (!showAnalysis) return null
    const rated = analysis.latestRated
    const ratedMove = analysis.latestHumanMove
    if (!rated || !ratedMove) return null
    const index = history.lastIndexOf(ratedMove)
    if (index === -1 || history[index].after !== ratedMove.after) return null
    const square = ratedMove.to
    for (const later of history.slice(index + 1)) {
      if (later.from === square || later.to === square || capturedSquareOf(later) === square) return null
    }
    return { square, rating: rated.rating }
  }, [analysis.latestHumanMove, analysis.latestRated, history, showAnalysis])

  const reviewedRating = reviewedMove ? (ratings?.[reviewedMove.after] ?? null) : null
  const ratedBadge = reviewing
    ? reviewedMove && reviewedRating
      ? { square: reviewedMove.to, rating: reviewedRating.rating }
      : null
    : liveBadge

  const viewAnalysis = analysis.analyses.get(viewFen)
  const viewEval = reviewing ? evalToWhite(viewAnalysis, fenTurn(viewFen)) : analysis.currentEval
  const bestUci = reviewing ? (viewAnalysis?.bestMove ?? viewAnalysis?.lines[0]?.pv[0] ?? null) : null
  const bestSan = reviewing ? sanOf(viewFen, bestUci) : null

  // ---------------------------------------------------------------- coach
  const latestHumanIndex = analysis.latestHumanMove ? history.lastIndexOf(analysis.latestHumanMove) : -1
  /** Move the coach talks about: the demonstrated, the reviewed or the latest one. */
  const coachIndex = activeDemo
    ? activeDemo.index
    : reviewing
      ? viewPly - 1
      : isEngineGame
        ? latestHumanIndex
        : history.length - 1
  const coachMove = history[coachIndex] ?? null
  const coachRated = coachMove ? (ratings?.[coachMove.after] ?? null) : null
  const analyses = analysis.analyses
  const explanation = useMemo(
    () =>
      ratings ? explainHistoryMove(history, coachIndex, ratings, analyses, standardStart) : null,
    [analyses, coachIndex, history, ratings, standardStart],
  )

  const coachComment: CoachComment | null =
    coachMove && coachRated && explanation
      ? {
          moveKey: coachMove.after,
          title: `${
            !isEngineGame
              ? `Tah ${coachMove.color === 'w' ? 'bílého' : 'černého'}`
              : coachMove.color === humanColor
                ? 'Tvůj tah'
                : 'Tah Stockfishe'
          } ${coachMove.san}`,
          rating: coachRated.rating,
          accuracy: coachRated.accuracy,
          text: explanationText(explanation),
        }
      : null
  const coachPending = Boolean(coachMove) && !coachRated && analyses.get(coachMove!.after)?.lines.length !== 0

  const speech = useSpeech()
  const { speak, cancel: cancelSpeech } = speech
  const spoken =
    screen === 'game' && coachVoice && coachComment && retryFen !== game.fen
      ? `${MOVE_RATING_META[coachComment.rating].label}. ${speakableText(coachComment.text)}`
      : null
  // One reading per move: the wording may still be refined (the opponent replies,
  // a deeper analysis arrives) and must not be read a second time.
  const spokenMove = spoken ? (coachMove?.after ?? null) : null
  const spokenRef = useRef<string | null>(null)
  const spokenText = useLatest(spoken)
  useEffect(() => {
    if (!spokenMove) {
      cancelSpeech()
      if (!coachVoice) spokenRef.current = null
      return
    }
    if (spokenRef.current === spokenMove || !spokenText.current) return
    spokenRef.current = spokenMove
    speak(spokenText.current)
  }, [cancelSpeech, coachVoice, speak, spokenMove, spokenText])

  // Brilliant and great moves have a sound of their own, once each time the coach turns to one.
  const specialRating =
    screen === 'game' && (coachComment?.rating === 'brilliant' || coachComment?.rating === 'great')
      ? coachComment.rating
      : null
  const coachKey = coachMove?.after ?? null
  const celebratedRef = useRef<string | null>(null)
  useEffect(() => {
    if (celebratedRef.current !== coachKey) celebratedRef.current = null
    if (!specialRating || celebratedRef.current === coachKey) return
    // After the click of the move itself.
    const timer = window.setTimeout(() => {
      celebratedRef.current = coachKey
      playSound(specialRating)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [coachKey, playSound, specialRating])

  // ---------------------------------------------------------------- training
  // Every rated mistake of your own is kept, even if the game is never finished.
  useEffect(() => {
    if (!ratings || imported) return
    const found = collectPuzzles(history, ratings, analyses, isEngineGame ? humanColor : null, Date.now())
    if (found.length > 0) setPuzzles((previous) => mergePuzzles(previous, found))
  }, [analyses, history, humanColor, imported, isEngineGame, ratings, setPuzzles])

  /** The newest unsolved mistake of the game on the board. */
  const gamePuzzle = useMemo(() => {
    if (imported) return null
    const positions = new Set(history.map((move) => move.before))
    return puzzles.find((puzzle) => !puzzle.solved && positions.has(puzzle.fen)) ?? null
  }, [history, imported, puzzles])

  const openTraining = useCallback((startId: string | null) => {
    setTrainingStart(startId)
    setGameOverOpen(false)
    setDialog(null)
    setSelected(null)
    setPremove(null)
    setDemo(null)
    setScreen('training')
  }, [])

  const solvePuzzle = useCallback(
    (id: string) => {
      setPuzzles((previous) => previous.map((puzzle) => (puzzle.id === id ? { ...puzzle, solved: true } : puzzle)))
    },
    [setPuzzles],
  )
  const restartPuzzles = useCallback(() => {
    setPuzzles((previous) => previous.map((puzzle) => ({ ...puzzle, solved: false })))
  }, [setPuzzles])

  const canRetry =
    isEngineGame &&
    !game.outcome &&
    canUndoNow &&
    coachIndex === latestHumanIndex &&
    explanation?.verdict === 'bad' &&
    (demoActive || !reviewing)

  const handleRetry = useCallback(() => {
    if (!coachMove) return
    setRetryFen(coachMove.before)
    void handleUndo()
  }, [coachMove, handleUndo])

  const moments = useMemo<KeyMoment[]>(() => {
    if (!gameOverOpen || !ratings) return []
    return keyMoments(history, ratings, isEngineGame ? humanColor : null).flatMap((index) => {
      const explained = explainHistoryMove(history, index, ratings, analyses, standardStart)
      if (!explained) return []
      const move = history[index]
      return [
        {
          index,
          label: moveLabel(move),
          rating: ratings[move.after].rating,
          text: explanationText(explained),
        },
      ]
    })
  }, [analyses, gameOverOpen, history, humanColor, isEngineGame, ratings, standardStart])

  const highlights = useMemo<HighlightMove[]>(() => {
    if (!gameOverOpen || !ratings) return []
    return highlightMoves(history, ratings, isEngineGame ? humanColor : null).map((index) => ({
      index,
      label: moveLabel(history[index]),
      rating: ratings[history[index].after].rating,
    }))
  }, [gameOverOpen, history, humanColor, isEngineGame, ratings])

  const openMoment = (index: number) => {
    if (!ratings) return
    const explained = explainHistoryMove(history, index, ratings, analyses, standardStart)
    setGameOverOpen(false)
    openDemo(index, explained?.problemDemo ? 'problem' : 'better')
  }

  // Arrows: the demonstration wins, then the review's best move, then live threats.
  const showThreatArrows =
    showThreats && isEngineGame && !reviewing && !demoActive && !game.outcome && game.turn === humanColor
  const threats = useMemo(
    () => (showThreatArrows ? threatsAgainst(game.fen, humanColor) : []),
    [game.fen, humanColor, showThreatArrows],
  )
  const arrowFor = (uci: string | null, kind: SystemArrow['kind']): SystemArrow[] => {
    const parsed = uci ? parseUciMove(uci) : null
    return parsed ? [{ from: parsed.from as Square, to: parsed.to as Square, kind }] : []
  }
  const demoProblem = activeDemo?.view === 'problem' ? (explanation?.problemDemo ?? null) : null
  const systemArrows: SystemArrow[] = activeDemo
    ? activeDemo.view === 'better'
      ? arrowFor(explanation?.better?.uci ?? null, 'best')
      : (demoProblem?.arrows.map((arrow) => ({ ...arrow, kind: 'threat' as const })) ?? [])
    : reviewing
      ? arrowFor(bestUci, 'best')
      : threats.map((arrow) => ({ ...arrow, kind: 'threat' as const }))
  const systemMarks = demoProblem?.marks.map((square) => ({ square, tone: 'red' as const }))

  const graphMarkers = useMemo<GraphMarker[]>(() => {
    if (!ratings) return []
    const markers: GraphMarker[] = []
    history.forEach((move, index) => {
      const rated = ratings[move.after]
      if (!rated) return
      const tone =
        rated.rating === 'blunder'
          ? 'blunder'
          : rated.rating === 'mistake' || rated.rating === 'miss'
            ? 'mistake'
            : rated.rating === 'brilliant' || rated.rating === 'great'
              ? 'brilliant'
              : null
      if (!tone) return
      markers.push({
        ply: index + 1,
        tone,
        label: `${moveLabel(move)} · ${MOVE_RATING_META[rated.rating].label}`,
      })
    })
    return markers
  }, [history, ratings])

  // Present from the first moment, so nothing shifts when the first move is made.
  const analysisCard = ratings ? (
      <AnalysisCard
        history={history}
        ratings={ratings}
        series={analysis.evalSeries}
        markers={graphMarkers}
        viewPly={viewPly}
        progress={game.outcome ? analysis.progress : undefined}
        whiteName={shortName('w')}
        blackName={shortName('b')}
        onSelectPly={showPly}
      />
  ) : null

  const handicapLabel = HANDICAPS.find((item) => item.id === storedHandicap)?.label ?? ''
  const settingsSummary =
    gameMode === 'stockfish'
      ? [
          `Stockfish · ${eloLabel(engineLevel)}`,
          colorChoice === 'random' ? 'náhodná barva' : colorChoice === 'w' ? 'hraješ za bílé' : 'hraješ za černé',
          getTimeControl(storedTempo).label,
          storedHandicap !== 'none' ? `Stockfish ${handicapLabel.toLowerCase()}` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : `Dva hráči na jedné desce · ${getTimeControl(storedTempo).label}`
  const progressSummary = `${
    isEngineGame ? `Proti Stockfishi (${eloLabel(engineLevel)})` : 'Dva hráči lokálně'
  } · ${fenMoveNumber(lastMove?.before ?? game.fen)}. tah · na tahu ${
    isEngineGame ? (game.turn === humanColor ? 'jsi ty' : 'Stockfish') : COLOR_LABELS[game.turn].toLowerCase()
  }`

  const reviewStatus = reviewing
    ? `Prohlížíš ${reviewedMove ? moveLabel(reviewedMove) : 'výchozí pozici'} · ${viewPly}/${history.length}`
    : null

  // "Hrát odsud": against Stockfish keep your colour, otherwise take the side to move.
  const playFromView = isPlayablePosition(viewFen)
    ? () => offerPosition(viewFen, isEngineGame ? humanColor : fenTurn(viewFen))
    : undefined

  return (
    <div className="app">
      <svg className="svg-defs" aria-hidden="true" focusable="false">
        {/* Soft, low-frequency displacement: the toolbar glass bends what is behind it. */}
        <filter id="liquid-glass" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.02" numOctaves={2} seed={7} result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale={28} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <PieceDefs />

      <Header
        soundEnabled={sound.enabled}
        onToggleSound={toggleSound}
        onOpenSettings={() => setDialog('settings')}
        onNewGame={openNewGame}
        onHome={goHome}
        gameMode={gameMode}
        engineLevel={engineLevel}
        onChangeLevel={changeLevel}
      />

      {screen === 'training' ? (
        <TrainingScreen
          puzzles={puzzles}
          startId={trainingStart}
          boardTheme={boardTheme}
          showCoordinates={showCoordinates}
          animations={animations}
          onSolved={solvePuzzle}
          onRestart={restartPuzzles}
          onSound={playSound}
          onExit={goHome}
        />
      ) : screen === 'home' ? (
        <main className="app-main app-main--home">
          <StartScreen
            inProgress={game.started && !game.outcome}
            settingsSummary={settingsSummary}
            progressSummary={progressSummary}
            pieces={game.pieces}
            orientation={game.started ? orientation : lastSettings.color === 'b' && gameMode === 'stockfish' ? 'b' : 'w'}
            boardTheme={boardTheme}
            onPlay={() => startNewGame(lastSettings)}
            onContinue={() => setScreen('game')}
            onCustomize={openNewGame}
            onLocal={() => startNewGame({ ...lastSettings, mode: 'human', handicap: 'none' })}
            onImport={openImport}
            onTrain={() => openTraining(null)}
            openPuzzles={puzzles.filter((puzzle) => !puzzle.solved).length}
          />
        </main>
      ) : (
        <main className="app-main">
          <section className="play-stage" aria-label="Herní deska">
            <div className="board-column">
              {renderPlayer(topColor)}
              <div className="board-area">
                {/* Always rendered (neutral when off) so strips and toolbar stay aligned. */}
                <EvalBar
                  score={viewEval}
                  orientation={orientation}
                  showAnalysis={analysisActive}
                  thinking={reviewing ? !viewAnalysis : analysis.thinking}
                />
                <Board
                  pieces={viewState?.pieces ?? game.pieces}
                  turn={viewTurn}
                  orientation={orientation}
                  selected={reviewing ? null : selected}
                  legalTargets={reviewing ? [] : legalTargets}
                  lastMove={reviewing ? (reviewedMove ?? null) : game.lastMove}
                  undoneMove={reviewing ? (history[viewPly] ?? null) : game.undoneMove}
                  checkSquare={viewState ? viewState.checkSquare : game.checkSquare}
                  outcome={reviewing ? null : game.outcome}
                  promotion={promotion}
                  locked={reviewing || !canAct}
                  captureFx={reviewing ? null : captureFx}
                  moveCount={viewPly}
                  gameNumber={game.gameNumber}
                  boardTheme={boardTheme}
                  showCoordinates={showCoordinates}
                  animations={animations}
                  ratedBadge={ratedBadge}
                  movableColor={moverColor}
                  premove={reviewing ? null : premove}
                  premoveMode={premoveMode}
                  systemArrows={systemArrows}
                  systemMarks={systemMarks}
                  reviewing={reviewing}
                  onRightClick={cancelPremove}
                  hint={
                    !reviewing && hintLevel > 0 && hintMove
                      ? {
                          level: hintLevel as 1 | 2,
                          from: hintMove.from,
                          to: hintMove.to,
                        }
                      : null
                  }
                  onSelect={handleSelect}
                  onTap={handleSquareTap}
                  onDrop={handleDrop}
                  onClearSelection={() => setSelected(null)}
                  onPromote={handlePromote}
                  onCancelPromotion={handleCancelPromotion}
                />
              </div>
              {renderPlayer(bottomColor)}
              {reviewing ? (
                <ReviewBar
                  ply={viewPly}
                  total={history.length}
                  moveLabel={reviewedMove ? moveLabel(reviewedMove) : null}
                  rating={reviewedRating?.rating ?? null}
                  bestSan={bestSan}
                  gameOver={Boolean(game.outcome)}
                  onNavigate={showPly}
                  onExit={() => showPly(history.length)}
                  onNextMistake={nextMistake !== null ? jumpToNextMistake : undefined}
                  onPlayFrom={playFromView}
                />
              ) : (
                <BoardToolbar
                  canUndo={canUndoNow}
                  canRedo={game.canRedo && !isUndoing}
                  gameOver={Boolean(game.outcome)}
                  started={game.started}
                  hintLevel={hintLevel}
                  hintLoading={hintLoading}
                  canHint={userCanInteract && !game.outcome && !isUndoing}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onFlip={handleFlip}
                  onResign={openResign}
                  onDraw={() => setDialog('draw')}
                  onHint={handleToggleHint}
                  onShowResult={() => setGameOverOpen(true)}
                  onPlayFrom={playFromView}
                />
              )}
              {engineError ? (
                <div className="engine-error" role="alert" data-engine-error="">
                  <span className="engine-error-copy">
                    <strong>Stockfish neodpovídá</strong>
                    <span>{engineError}</span>
                  </span>
                  <button type="button" className="button button--ghost engine-error-retry" onClick={retryEngine}>
                    Zkusit znovu
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <SidePanel
            history={history}
            turn={game.turn}
            outcome={game.outcome}
            isCheck={game.isCheck}
            fen={viewFen}
            timeControlLabel={timeControlLabel}
            boardTheme={boardTheme}
            onBoardThemeChange={setBoardTheme}
            orientation={orientation}
            ratings={ratings}
            coach={
              <CoachCard
                enabled={analysisActive}
                level={engineLevel}
                status={analysis.status}
                comment={coachComment}
                ratingPending={coachPending}
                engineThinking={engineThinking}
                gameOver={Boolean(game.outcome)}
                retryPrompt={retryFen === game.fen && !reviewing && !demoActive}
                demoView={activeDemo?.view ?? null}
                backLabel={game.outcome ? 'Zavřít ukázku' : 'Zpět do hry'}
                onShowProblem={explanation?.problemDemo ? () => openDemo(coachIndex, 'problem') : undefined}
                onShowBetter={explanation?.better ? () => openDemo(coachIndex, 'better') : undefined}
                onRetry={canRetry ? handleRetry : undefined}
                onBack={demoActive ? closeDemo : undefined}
                onOpenRatings={() => setDialog('ratings')}
                voice={
                  speech.available
                    ? { enabled: coachVoice, onToggle: () => setCoachVoice((value) => !value) }
                    : undefined
                }
              />
            }
            modeLabel={
              imported ? 'Importovaná partie' : isEngineGame ? 'Proti Stockfishi' : 'Dva hráči lokálně'
            }
            engineLabel={
              imported
                ? `${imported.white} – ${imported.black}`
                : isEngineGame
                  ? `${eloLabel(engineLevel)} · hraješ za ${humanColor === 'w' ? 'bílé' : 'černé'}`
                  : undefined
            }
            onCopyPgn={copyPgn}
            onCopyFen={copyFen}
            onImport={openImport}
            customStart={!standardStart}
            whiteLabel={shortName('w')}
            blackLabel={shortName('b')}
            viewPly={viewPly}
            onSelectPly={showPly}
            analysis={analysisCard}
            opening={
              standardStart
                ? (openingName(history, viewPly) ??
                  (viewPly === 0 ? 'Zahájení se ukáže po prvním tahu' : 'Zahájení bez názvu'))
                : undefined
            }
            reviewStatus={reviewStatus}
          />
        </main>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {dialog === 'new' ? (
        <NewGameDialog
          currentMode={gameMode}
          currentLevelId={engineLevelId}
          currentTimeControlId={storedTempo}
          currentColor={colorChoice}
          currentHandicap={storedHandicap}
          hasProgress={game.started && !game.outcome}
          onStart={startNewGame}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'position' && positionOffer ? (
        <NewGameDialog
          currentMode={gameMode}
          currentLevelId={engineLevelId}
          currentTimeControlId={storedTempo}
          currentColor={positionOffer.color}
          currentHandicap="none"
          startFen={positionOffer.fen}
          hasProgress={game.started && !game.outcome}
          onStart={startNewGame}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'import' ? (
        <ImportDialog
          hasProgress={game.started && !game.outcome}
          onImport={handleImport}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'settings' ? (
        <SettingsDialog
          soundEnabled={sound.enabled}
          onToggleSound={toggleSound}
          volume={sound.volume}
          onVolumeChange={sound.setVolume}
          appearance={appearance}
          onAppearanceChange={setAppearance}
          reduceTransparency={reduceTransparency}
          onReduceTransparencyChange={setReduceTransparency}
          boardTheme={boardTheme}
          onBoardThemeChange={setBoardTheme}
          showCoordinates={showCoordinates}
          onShowCoordinatesChange={setShowCoordinates}
          animations={animations}
          onAnimationsChange={setAnimations}
          showThreats={showThreats}
          onShowThreatsChange={setShowThreats}
          onTestSound={() => sound.play('capture')}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'resign' ? (
        <ConfirmDialog
          title="Vzdát partii?"
          description={
            isEngineGame
              ? 'Partii předáš Stockfishi. Soupeř okamžitě vyhrává.'
              : `${COLOR_NAMES[resigningColor]} předá partii. Soupeř okamžitě vyhrává.`
          }
          confirmLabel="Vzdát se"
          icon={<Flag size={19} />}
          tone="danger"
          onConfirm={handleResignConfirm}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog === 'draw' ? (
        <ConfirmDialog
          title="Dohodnout remízu?"
          description="Oba hráči potvrdí, že partie končí nerozhodně. Rozdělení bodů ½–½."
          confirmLabel="Dohodnout remízu"
          icon={<Handshake size={19} />}
          onConfirm={handleDrawConfirm}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {/* Deferred while another dialog/promotion is open so modals never stack. */}
      {gameOverOpen && game.outcome && dialog === null && !promotion ? (
        <GameOverDialog
          outcome={game.outcome}
          history={history}
          durationSeconds={durationSeconds}
          ratings={ratings}
          humanColor={isEngineGame ? humanColor : null}
          whiteName={shortName('w')}
          blackName={shortName('b')}
          series={analysis.evalSeries}
          progress={analysis.progress}
          markers={graphMarkers}
          hasMistakes={nextMistake !== null}
          onRematch={imported ? undefined : handleRematch}
          onNewGame={openNewGame}
          onReviewPly={reviewFromDialog}
          onNextMistake={jumpToNextMistake}
          onOpenRatings={() => setDialog('ratings')}
          onClose={() => setGameOverOpen(false)}
          moments={moments}
          onOpenMoment={openMoment}
          highlights={highlights}
          opening={standardStart ? openingName(history) : null}
          onTrain={gamePuzzle ? () => openTraining(gamePuzzle.id) : undefined}
        />
      ) : null}

      {dialog === 'ratings' ? (
        <MoveClassificationDialog onClose={() => setDialog(null)} />
      ) : null}

      {toast ? <Toast message={toast.message} tone={toast.tone} id={toast.id} /> : null}
    </div>
  )
}
