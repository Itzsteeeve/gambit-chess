import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Move, PieceSymbol, Square } from 'chess.js'
import { Check, ChevronRight, Dumbbell, Eye, Lightbulb, RotateCcw } from 'lucide-react'
import { COLOR_LABELS } from '../game/constants'
import type { BoardThemeId } from '../game/constants'
import { MOVE_RATING_META } from '../game/moveRating'
import { parseUciMove } from '../game/engineLevels'
import { judgeAttempt, nextPuzzle, quickVerdict } from '../game/puzzles'
import type { Puzzle, Verdict } from '../game/puzzles'
import { fenTurn } from '../game/review'
import type { SoundName } from '../game/soundEngine'
import type { EngineAnalysis } from '../game/uciEngine'
import { useChessGame } from '../game/useChessGame'
import { useEngineAnalysis } from '../game/useStockfish'
import { cx } from '../lib/cx'
import { Board } from './Board'
import type { PromotionState } from './Board'
import { EvalBar } from './EvalBar'
import { MoveRatingBadge } from './MoveRatingBadge'

interface TrainingScreenProps {
  puzzles: Puzzle[]
  /** Puzzle to open with; otherwise the newest unsolved one. */
  startId?: string | null
  boardTheme: BoardThemeId
  showCoordinates: boolean
  animations: boolean
  onSolved: (id: string) => void
  /** Marks every puzzle unsolved again. */
  onRestart: () => void
  onSound: (name: SoundName) => void
  onExit: () => void
}

const NO_HISTORY: Move[] = []

/** "Trénink chyb": find the better move in positions from your own games. */
export function TrainingScreen({ puzzles, startId, onExit, ...rest }: TrainingScreenProps) {
  const [currentId, setCurrentId] = useState<string | null>(
    () => startId ?? nextPuzzle(puzzles, null)?.id ?? puzzles[0]?.id ?? null,
  )
  const puzzle = puzzles.find((candidate) => candidate.id === currentId) ?? puzzles[0] ?? null

  // Only answers explicit requests: the positions after the attempted moves.
  const analysis = useEngineAnalysis({
    enabled: puzzle !== null,
    autoAnalyze: false,
    fen: puzzle?.fen ?? '',
    turn: 'w',
    history: NO_HISTORY,
    humanColor: 'w',
  })

  if (!puzzle) {
    return (
      <main className="app-main app-main--home">
        <section className="training-empty">
          <Dumbbell size={28} aria-hidden="true" />
          <h1 className="start-title">Zatím tu nic není</h1>
          <p>
            Zahraj partii proti Stockfishi. Chyby, hrubky a promeškané výhry se sem uloží samy a můžeš si na nich
            zkusit najít lepší tah.
          </p>
          <button type="button" className="button button--primary" onClick={onExit} autoFocus>
            Zpět na úvod
          </button>
        </section>
      </main>
    )
  }

  return (
    <PuzzleView
      key={puzzle.id}
      puzzle={puzzle}
      puzzles={puzzles}
      onOpen={setCurrentId}
      requestAnalysis={analysis.requestAnalysis}
      {...rest}
    />
  )
}

type PuzzleViewProps = Omit<TrainingScreenProps, 'startId' | 'onExit'> & {
  puzzle: Puzzle
  onOpen: (id: string) => void
  requestAnalysis: (fen: string) => Promise<EngineAnalysis | null>
}

function PuzzleView({
  puzzle,
  puzzles,
  boardTheme,
  showCoordinates,
  animations,
  onSolved,
  onRestart,
  onSound,
  onOpen,
  requestAnalysis,
}: PuzzleViewProps) {
  const game = useChessGame()
  const solver = fenTurn(puzzle.fen)
  const [selected, setSelected] = useState<Square | null>(null)
  const [promotion, setPromotion] = useState<PromotionState | null>(null)
  /** The move on the board; its verdict is null while the engine checks it. */
  const [attempt, setAttempt] = useState<{ move: Move; verdict: Verdict | null } | null>(null)
  const [help, setHelp] = useState<0 | 1 | 2>(0)
  /** Changes whenever a pending check no longer concerns the board. */
  const runRef = useRef(0)

  const { reset } = game
  useLayoutEffect(() => {
    reset({ fen: puzzle.fen })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the view is keyed on the puzzle
  }, [])
  useEffect(() => () => void (runRef.current += 1), [])

  const best = parseUciMove(puzzle.bestUci)
  const verdict = attempt?.verdict ?? null
  const checking = attempt !== null && verdict === null
  const interactive = attempt === null && !promotion
  const solvedCount = puzzles.filter((candidate) => candidate.solved).length
  const next = nextPuzzle(puzzles, puzzle.id)

  const conclude = (move: Move, result: Verdict) => {
    setAttempt({ move, verdict: result })
    if (!result.accepted) {
      onSound('illegal')
      return
    }
    onSound(result.rating === 'brilliant' ? 'brilliant' : 'great')
    onSolved(puzzle.id)
  }

  const play = (from: Square, to: Square, promotionType?: PieceSymbol) => {
    const result = game.move(from, to, promotionType)
    setSelected(null)
    setPromotion(null)
    const move = result.move
    if (!result.ok || !move) return
    onSound(result.captured ? 'capture' : 'move')

    const quick = quickVerdict(puzzle, move)
    if (quick) {
      conclude(move, quick)
      return
    }
    setAttempt({ move, verdict: null })
    const run = runRef.current
    void requestAnalysis(move.after).then((after) => {
      if (run === runRef.current) conclude(move, judgeAttempt(puzzle, move, after))
    })
  }

  const tryMove = (from: Square, to: Square) => {
    if (!interactive) return
    const candidates = game.getLegalMoves(from).filter((move) => move.to === to)
    if (candidates.length === 0) {
      onSound('illegal')
      return
    }
    const options = candidates.flatMap((move) => (move.promotion ? [move.promotion] : []))
    if (options.length > 0) {
      setSelected(from)
      setPromotion({ from, to, color: solver, options })
      return
    }
    play(from, to)
  }

  const tap = (square: Square, wasSelected: boolean) => {
    if (!interactive) return
    if (wasSelected) {
      setSelected(null)
      return
    }
    if (selected && game.getLegalMoves(selected).some((move) => move.to === square)) {
      tryMove(selected, square)
      return
    }
    const own = game.pieces.some((piece) => piece.square === square && piece.color === solver)
    setSelected(own ? square : null)
  }

  const retry = () => {
    runRef.current += 1
    setAttempt(null)
    setSelected(null)
    reset({ fen: puzzle.fen })
  }

  const showSolution = () => {
    if (attempt) retry()
    setHelp(2)
  }

  const legalTargets = selected
    ? game.getLegalMoves(selected).map((move) => ({ square: move.to, capture: Boolean(move.captured) }))
    : []

  let heading = `Najdi lepší tah za ${solver === 'w' ? 'bílého' : 'černého'}`
  let detail = `V partii zaznělo ${puzzle.label} (${MOVE_RATING_META[puzzle.rating].label.toLowerCase()}).`
  if (checking) {
    heading = 'Stockfish ověřuje tvůj tah…'
  } else if (attempt && verdict) {
    if (verdict.accepted) {
      heading = verdict.rating === 'excellent' ? 'Správně, výborný tah' : 'Správně!'
      detail = `${attempt.move.san} je to, co pozice chtěla.`
    } else {
      heading = 'Tohle to není'
      detail =
        verdict.rating === null
          ? 'Stockfish tah neověřil, takže se počítá jen jeho nejlepší tah.'
          : attempt.move.lan === puzzle.playedUci
            ? 'Stejný tah jako v partii. Zkus jiný.'
            : `${attempt.move.san} ještě ztrácí. Zkus to znovu.`
    }
  }

  return (
    <main className="app-main">
      <section className="play-stage" aria-label="Tréninková deska">
        <div className="board-column">
          <p className="training-strip">
            <span className={cx('side-dot', solver === 'w' ? 'side-dot--white' : 'side-dot--black')} aria-hidden="true" />
            Na tahu {COLOR_LABELS[solver].toLowerCase()}
          </p>
          <div className="board-area">
            <EvalBar score={null} orientation={solver} showAnalysis={false} />
            <Board
              pieces={game.pieces}
              turn={game.turn}
              orientation={solver}
              selected={selected}
              legalTargets={legalTargets}
              lastMove={game.lastMove}
              checkSquare={game.checkSquare}
              outcome={null}
              promotion={promotion}
              locked={!interactive}
              captureFx={null}
              moveCount={game.moveCount}
              gameNumber={game.gameNumber}
              boardTheme={boardTheme}
              showCoordinates={showCoordinates}
              animations={animations}
              ratedBadge={attempt && verdict?.rating ? { square: attempt.move.to, rating: verdict.rating } : null}
              movableColor={solver}
              hint={
                help === 1 && best && !attempt
                  ? { level: 1, from: best.from as Square, to: best.to as Square }
                  : null
              }
              systemArrows={
                help === 2 && best && !attempt
                  ? [{ from: best.from as Square, to: best.to as Square, kind: 'best' }]
                  : []
              }
              onSelect={setSelected}
              onTap={tap}
              onDrop={tryMove}
              onClearSelection={() => setSelected(null)}
              onPromote={(type) => promotion && play(promotion.from, promotion.to, type)}
              onCancelPromotion={() => setPromotion(null)}
            />
          </div>
          <div className="training-strip" />
          <div className="board-toolbar" role="toolbar" aria-label="Ovládání tréninku">
            <button
              type="button"
              className="toolbar-text-button"
              onClick={() => setHelp(1)}
              disabled={Boolean(attempt) || help > 0}
              aria-label="Napovědět figuru"
            >
              <Lightbulb size={17} />
              <span>Napověz</span>
            </button>
            <button
              type="button"
              className="toolbar-text-button"
              onClick={showSolution}
              disabled={Boolean(verdict?.accepted)}
              aria-label="Ukázat řešení"
            >
              <Eye size={17} />
              <span>Řešení</span>
            </button>
            <button type="button" className="toolbar-text-button" onClick={retry} disabled={!attempt} aria-label="Zkusit znovu">
              <RotateCcw size={17} />
              <span>Znovu</span>
            </button>
            <button
              type="button"
              className="toolbar-result-button training-next"
              onClick={() => next && onOpen(next.id)}
              disabled={!next}
              aria-label="Další úloha"
            >
              <ChevronRight size={17} />
              <span>Další úloha</span>
            </button>
          </div>
        </div>
      </section>

      <aside className="side-panel" aria-label="Trénink chyb">
        <div className="side-panel-inner">
          <header className="training-head">
            <h1>Trénink chyb</h1>
            <span>
              Vyřešeno {solvedCount} z {puzzles.length}
            </span>
          </header>

          <div className="training-feedback" aria-live="polite">
            {verdict?.rating ? (
              <span key={`${verdict.rating}-${attempt?.move.after}`} className="rating-fx">
                <MoveRatingBadge rating={verdict.rating} size="lg" />
              </span>
            ) : (
              <MoveRatingBadge rating={puzzle.rating} size="lg" />
            )}
            <div>
              <strong>{heading}</strong>
              <p>{detail}</p>
            </div>
          </div>

          {solvedCount === puzzles.length ? (
            <div className="training-done">
              <p>Všechny úlohy máš vyřešené.</p>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  retry()
                  setHelp(0)
                  onRestart()
                }}
              >
                Procvičit znovu
              </button>
            </div>
          ) : null}

          <ul className="training-list">
            {puzzles.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cx('training-item', item.id === puzzle.id && 'is-current')}
                  aria-current={item.id === puzzle.id ? 'true' : undefined}
                  onClick={() => onOpen(item.id)}
                >
                  <MoveRatingBadge rating={item.rating} size="xs" />
                  <strong>{item.label}</strong>
                  <span>{new Date(item.createdAt).toLocaleDateString('cs-CZ')}</span>
                  {item.solved ? <Check size={16} className="training-check" aria-label="Vyřešeno" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </main>
  )
}
