import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { Color, Move, PieceSymbol, Square } from 'chess.js'
import { COLOR_LABELS, PIECE_LABELS } from '../game/constants'
import type { BoardThemeId } from '../game/constants'
import type { GameOutcome } from '../game/notation'
import { MOVE_RATING_META } from '../game/moveRating'
import type { MoveRating } from '../game/moveRating'
import { arrowGeometry, toggleArrow, toggleMark, toneForModifiers } from '../game/arrows'
import type { ArrowTone, BoardArrow, BoardMark } from '../game/arrows'
import { getDisplayPosition, getSquareFromPoint } from '../game/pieces'
import type { GamePiece } from '../game/pieces'
import { cx } from '../lib/cx'
import { MoveRatingBadge } from './MoveRatingBadge'
import { PieceArt } from './PieceArt'
import { PromotionPicker } from './PromotionPicker'

export interface LegalTarget {
  square: Square
  capture: boolean
}

export interface PromotionState {
  from: Square
  to: Square
  color: Color
  options: PieceSymbol[]
}

export interface CaptureFx {
  id: number
  piece: GamePiece
  square: Square
}

export interface HintState {
  level: 1 | 2
  from: Square
  to: Square
}

interface BoardProps {
  pieces: GamePiece[]
  turn: Color
  orientation: Color
  selected: Square | null
  legalTargets: LegalTarget[]
  lastMove: Move | null
  undoneMove?: Move | null
  checkSquare: Square | null
  outcome: GameOutcome | null
  promotion: PromotionState | null
  locked?: boolean
  captureFx: CaptureFx | null
  moveCount: number
  gameNumber: number
  boardTheme: BoardThemeId
  showCoordinates: boolean
  animations: boolean
  ratedBadge?: { square: Square; rating: MoveRating } | null
  hint?: HintState | null
  /** Colour whose pieces can be picked up (defaults to `turn`; differs while premoving). */
  movableColor?: Color
  /** Queued premove, shown with its own highlight and arrow. */
  premove?: { from: Square; to: Square } | null
  /** True while the legal targets are premove targets (styled differently). */
  premoveMode?: boolean
  /** App arrows (best move, threats, coach demo). Hint and premove arrows are derived from their props. */
  systemArrows?: SystemArrow[]
  /** App square marks (coach demo). */
  systemMarks?: BoardMark[]
  /** Read-only review of a past position. */
  reviewing?: boolean
  /** Right click on the board; return true to consume it (e.g. cancel a premove). */
  onRightClick?: () => boolean
  onSelect: (square: Square) => void
  onTap: (square: Square, wasSelected: boolean) => void
  onDrop: (from: Square, to: Square) => void
  onClearSelection: () => void
  onPromote: (type: PieceSymbol) => void
  onCancelPromotion: () => void
}

interface DragState {
  pieceId: string
  from: Square
  x: number
  y: number
  cell: number
}

interface RightPointerState {
  from: Square
  pointerId: number
}

interface PointerDownState {
  square: Square
  pointerId: number
  x: number
  y: number
  wasSelected: boolean
  pieceId: string | null
  active: boolean
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

/** Directions of the sparks around a brilliant move. */
const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

/** How long a piece counts as moving: just over the longest glide (see `glideMs`). */
const MOVE_MS = 420
/** Keep in sync with --dur-flip in tokens.css. */
const FLIP_MS = 260

/** Longer moves take a little longer, so a queen crossing the board does not teleport. */
function glideMs(move: Move): number {
  const files = Math.abs(move.from.charCodeAt(0) - move.to.charCodeAt(0))
  const ranks = Math.abs(Number(move.from[1]) - Number(move.to[1]))
  return 210 + 28 * (Math.max(files, ranks) - 1)
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY).matches),
  )
  useEffect(() => {
    const query = window.matchMedia?.(REDUCED_MOTION_QUERY)
    if (!query) return
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

function squareAt(pieces: GamePiece[], square: Square): GamePiece | undefined {
  return pieces.find((piece) => piece.square === square)
}

function allSquares(orientation: Color): Square[] {
  const squares: Square[] = []
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const file = orientation === 'w' ? col : 7 - col
      const rank = orientation === 'w' ? 7 - row : row
      squares.push(`${FILES[file]}${rank + 1}` as Square)
    }
  }
  return squares
}

/** Arrow drawn by the app (hint, best move, premove) rather than the user. */
export interface SystemArrow {
  from: Square
  to: Square
  kind: 'hint' | 'best' | 'premove' | 'threat'
}

const SYSTEM_TONE: Record<SystemArrow['kind'], ArrowTone> = {
  hint: 'amber',
  best: 'green',
  premove: 'blue',
  threat: 'red',
}

/** One SVG overlay for every arrow and square mark; pointer-events: none. */
function BoardArrowLayer({
  arrows,
  marks,
  orientation,
}: {
  arrows: Array<BoardArrow & { kind?: SystemArrow['kind'] | 'user' | 'drawing' }>
  marks: BoardMark[]
  orientation: Color
}) {
  if (arrows.length === 0 && marks.length === 0) return null
  return (
    <div className="board-arrow-layer" aria-hidden="true">
      <svg viewBox="0 0 800 800" className="board-arrow-svg">
        {marks.map((mark, index) => {
          const position = getDisplayPosition(mark.square, orientation)
          return (
            <circle
              key={`mark-${mark.square}-${index}`}
              cx={position.col * 100 + 50}
              cy={position.row * 100 + 50}
              r={44}
              className={cx('board-mark', `board-tone--${mark.tone}`)}
            />
          )
        })}
        {arrows.map((arrow) => {
          const geometry = arrowGeometry(arrow.from, arrow.to, orientation)
          return (
            <g
              // No index in the key: an arrow keeps its element when others come and go.
              key={`${arrow.kind ?? 'user'}-${arrow.from}-${arrow.to}`}
              className={cx('board-arrow', `board-tone--${arrow.tone}`, arrow.kind && `board-arrow--${arrow.kind}`)}
            >
              <path
                d={geometry.shaft}
                className="board-arrow-shaft"
                strokeWidth="20"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polygon points={geometry.head} className="board-arrow-head" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function Board({
  pieces,
  turn,
  orientation,
  selected,
  legalTargets,
  lastMove,
  undoneMove,
  checkSquare,
  outcome,
  promotion,
  locked = false,
  captureFx,
  moveCount,
  gameNumber,
  boardTheme,
  showCoordinates,
  animations,
  ratedBadge,
  hint,
  movableColor,
  premove = null,
  premoveMode = false,
  systemArrows,
  systemMarks,
  reviewing = false,
  onRightClick,
  onSelect,
  onTap,
  onDrop,
  onClearSelection,
  onPromote,
  onCancelPromotion,
}: BoardProps) {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const squareRefs = useRef<Map<Square, HTMLDivElement>>(new Map())
  const pointerRef = useRef<PointerDownState | null>(null)
  const rightRef = useRef<RightPointerState | null>(null)
  const [userArrows, setUserArrows] = useState<BoardArrow[]>([])
  const [userMarks, setUserMarks] = useState<BoardMark[]>([])
  const [drawing, setDrawing] = useState<BoardArrow | null>(null)
  const mover = movableColor ?? turn
  const previousMoveCount = useRef(moveCount)
  const previousGame = useRef(gameNumber)

  const reducedMotion = usePrefersReducedMotion()
  const motion = animations && !reducedMotion
  const [viewOrientation, setViewOrientation] = useState<Color>(orientation)
  const [flipPhase, setFlipPhase] = useState<'idle' | 'rotating' | 'settle'>('idle')
  const flipping = flipPhase === 'rotating'
  const [drag, setDrag] = useState<DragState | null>(null)
  const [ghost, setGhost] = useState<CaptureFx | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [restoredId, setRestoredId] = useState<string | null>(null)
  const [promotedSquare, setPromotedSquare] = useState<Square | null>(null)
  const [focusedSquare, setFocusedSquare] = useState<Square>(
    orientation === 'w' ? 'a1' : 'h8',
  )

  const targetMap = new Map(legalTargets.map((target) => [target.square, target]))
  const interactive = !outcome && !promotion && !locked
  const displaySquares = allSquares(viewOrientation)
  const hoveredDropSquare: Square | null = drag
    ? (() => {
        const surface = surfaceRef.current
        if (!surface) return null
        const rect = surface.getBoundingClientRect()
        return getSquareFromPoint(drag.x + rect.left, drag.y + rect.top, rect, viewOrientation)
      })()
    : null

  // Flip: rotate the surface 180deg (pieces counter-rotate to stay upright),
  // then swap to the new orientation with transitions suppressed for a frame.
  useEffect(() => {
    if (orientation === viewOrientation) {
      setFlipPhase((phase) => (phase === 'rotating' ? 'idle' : phase))
      return
    }
    if (!motion) {
      setViewOrientation(orientation)
      setFlipPhase('idle')
      return
    }
    setFlipPhase('rotating')
    const timer = window.setTimeout(() => {
      setViewOrientation(orientation)
      setFlipPhase('settle')
    }, FLIP_MS)
    return () => window.clearTimeout(timer)
  }, [motion, orientation, viewOrientation])

  useEffect(() => {
    if (flipPhase !== 'settle') return
    // Two frames' worth: long enough for the un-transitioned swap to paint.
    const timer = window.setTimeout(() => setFlipPhase('idle'), 34)
    return () => window.clearTimeout(timer)
  }, [flipPhase])

  useEffect(() => {
    if (previousGame.current !== gameNumber) {
      previousGame.current = gameNumber
      previousMoveCount.current = moveCount
      setGhost(null)
      setDrag(null)
      setMovingId(null)
      setPromotedSquare(null)
      setFocusedSquare(viewOrientation === 'w' ? 'a1' : 'h8')
      return
    }

    if (moveCount > previousMoveCount.current && lastMove) {
      const target = pieces.find((piece) => piece.square === lastMove.to)
      if (target) {
        previousMoveCount.current = moveCount
        if (!motion) return
        setMovingId(target.id)
        const timer = window.setTimeout(() => setMovingId(null), MOVE_MS)
        if (lastMove.promotion) {
          setPromotedSquare(lastMove.to)
          const promoTimer = window.setTimeout(() => setPromotedSquare(null), MOVE_MS + 120)
          return () => {
            window.clearTimeout(timer)
            window.clearTimeout(promoTimer)
          }
        }
        return () => window.clearTimeout(timer)
      }
    }

    if (moveCount < previousMoveCount.current && undoneMove) {
      previousMoveCount.current = moveCount
      if (!motion) return
      const target = pieces.find((piece) => piece.square === undoneMove.from)
      if (target) {
        setMovingId(target.id)
      }
      if (undoneMove.captured) {
        const capturedSq = undoneMove.isEnPassant()
          ? (`${undoneMove.to[0]}${undoneMove.from[1]}` as Square)
          : undoneMove.to
        const restored = pieces.find((piece) => piece.square === capturedSq)
        if (restored) {
          setRestoredId(restored.id)
          const restoreTimer = window.setTimeout(() => setRestoredId(null), MOVE_MS)
          const timer = window.setTimeout(() => setMovingId(null), MOVE_MS)
          return () => {
            window.clearTimeout(timer)
            window.clearTimeout(restoreTimer)
          }
        }
      }
      const timer = window.setTimeout(() => setMovingId(null), MOVE_MS)
      return () => window.clearTimeout(timer)
    }

    previousMoveCount.current = moveCount
  }, [gameNumber, lastMove, motion, moveCount, pieces, undoneMove, viewOrientation])

  useEffect(() => {
    if (!captureFx) return
    if (!motion) {
      setGhost(null)
      return
    }
    setGhost(captureFx)
    // The ghost pops during the last 120ms of the mover's glide.
    const timer = window.setTimeout(() => setGhost(null), MOVE_MS)
    return () => window.clearTimeout(timer)
  }, [motion, captureFx])

  useEffect(() => {
    if (!interactive) {
      setDrag(null)
      pointerRef.current = null
    }
  }, [interactive])

  useEffect(() => {
    const cancelDrag = () => {
      pointerRef.current = null
      setDrag(null)
    }
    window.addEventListener('resize', cancelDrag)
    window.addEventListener('blur', cancelDrag)
    return () => {
      window.removeEventListener('resize', cancelDrag)
      window.removeEventListener('blur', cancelDrag)
    }
  }, [])

  // User arrows and marks belong to one position: any move (or review step) clears them.
  useEffect(() => {
    setUserArrows([])
    setUserMarks([])
    setDrawing(null)
    rightRef.current = null
  }, [moveCount, gameNumber])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>, square: Square) => {
    if (event.button === 2) {
      event.preventDefault()
      if (onRightClick?.()) return
      rightRef.current = { from: square, pointerId: event.pointerId }
      try {
        surfaceRef.current?.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic or already-released pointers cannot be captured; drawing still works.
      }
      return
    }
    if (event.button !== 0) return
    if (userArrows.length > 0 || userMarks.length > 0) {
      setUserArrows([])
      setUserMarks([])
    }
    if (!interactive) return
    const piece = squareAt(pieces, square)
    const ownPiece = piece && piece.color === mover ? piece : null
    const wasSelected = selected === square

    squareRefs.current.get(square)?.focus({ preventScroll: true })
    if (ownPiece && !wasSelected) {
      onSelect(square)
    }

    event.preventDefault()
    surfaceRef.current?.setPointerCapture(event.pointerId)
    const rect = surfaceRef.current?.getBoundingClientRect()
    pointerRef.current = {
      square,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      wasSelected,
      pieceId: ownPiece?.id ?? null,
      active: false,
    }
    if (ownPiece && rect) {
      setDrag(null)
    }
  }

  const squareFromEvent = (event: ReactPointerEvent<HTMLDivElement>): Square | null => {
    const surface = surfaceRef.current
    if (!surface) return null
    return getSquareFromPoint(event.clientX, event.clientY, surface.getBoundingClientRect(), viewOrientation)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const right = rightRef.current
    if (right && right.pointerId === event.pointerId) {
      const target = squareFromEvent(event)
      const next =
        target && target !== right.from ? { from: right.from, to: target, tone: toneForModifiers(event) } : null
      setDrawing((previous) =>
        previous?.to === next?.to && previous?.tone === next?.tone && previous?.from === next?.from ? previous : next,
      )
      return
    }
    const pointer = pointerRef.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    const distance = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y)
    if (!pointer.active && distance < 5) return
    if (!pointer.pieceId) return
    const surface = surfaceRef.current
    if (!surface) return
    const rect = surface.getBoundingClientRect()
    pointer.active = true
    setDrag({
      pieceId: pointer.pieceId,
      from: pointer.square,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      cell: rect.width / 8,
    })
  }

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const right = rightRef.current
    if (right && right.pointerId === event.pointerId) {
      rightRef.current = null
      setDrawing(null)
      if (surfaceRef.current?.hasPointerCapture(event.pointerId)) {
        surfaceRef.current.releasePointerCapture(event.pointerId)
      }
      const target = squareFromEvent(event)
      if (!target) return
      const tone = toneForModifiers(event)
      if (target === right.from) setUserMarks((marks) => toggleMark(marks, { square: target, tone }))
      else setUserArrows((arrows) => toggleArrow(arrows, { from: right.from, to: target, tone }))
      return
    }
    const pointer = pointerRef.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    pointerRef.current = null
    if (surfaceRef.current?.hasPointerCapture(event.pointerId)) {
      surfaceRef.current.releasePointerCapture(event.pointerId)
    }

    if (pointer.active && pointer.pieceId) {
      const surface = surfaceRef.current
      if (surface) {
        const rect = surface.getBoundingClientRect()
        const target = getSquareFromPoint(event.clientX, event.clientY, rect, viewOrientation)
        if (target && targetMap.has(target) && target !== pointer.square) {
          onDrop(pointer.square, target)
        }
      }
      setDrag(null)
      return
    }

    setDrag(null)
    onTap(pointer.square, pointer.wasSelected)
  }

  const handlePointerCancel = () => {
    pointerRef.current = null
    rightRef.current = null
    setDrawing(null)
    setDrag(null)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return
    const current = focusedSquare
    const position = getDisplayPosition(current, viewOrientation)

    if (event.key === 'Escape') {
      event.preventDefault()
      onClearSelection()
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onTap(current, selected === current)
      return
    }

    let nextRow = position.row
    let nextCol = position.col
    if (event.key === 'ArrowUp') nextRow -= 1
    else if (event.key === 'ArrowDown') nextRow += 1
    else if (event.key === 'ArrowLeft') nextCol -= 1
    else if (event.key === 'ArrowRight') nextCol += 1
    else return

    event.preventDefault()
    nextRow = Math.max(0, Math.min(7, nextRow))
    nextCol = Math.max(0, Math.min(7, nextCol))
    const file = viewOrientation === 'w' ? nextCol : 7 - nextCol
    const rank = viewOrientation === 'w' ? 7 - nextRow : nextRow
    const nextSquare = `${FILES[file]}${rank + 1}` as Square
    setFocusedSquare(nextSquare)
    squareRefs.current.get(nextSquare)?.focus({ preventScroll: true })
  }

  const handleRecord = (square: Square) => {
    setFocusedSquare(square)
  }

  const promotionPosition = promotion ? getDisplayPosition(promotion.to, viewOrientation) : null
  const promotionSide = promotionPosition && promotionPosition.row >= 4 ? 'up' : 'down'
  const promotionStyle: CSSProperties | undefined =
    promotion && promotionPosition
      ? promotionSide === 'up'
        ? {
            left: `${promotionPosition.col * 12.5}%`,
            bottom: `${(7 - promotionPosition.row) * 12.5}%`,
          }
        : {
            left: `${promotionPosition.col * 12.5}%`,
            top: `${promotionPosition.row * 12.5}%`,
          }
      : undefined

  return (
    <div
      className="board-frame"
      data-theme={boardTheme}
      data-orientation={viewOrientation}
      data-reviewing={reviewing ? '' : undefined}
    >
      <div
        ref={surfaceRef}
        className={cx(
          'board-surface',
          flipping && 'is-flipping',
          flipPhase === 'settle' && 'is-flip-settle',
          interactive && 'is-interactive',
          selected && 'has-selection',
          drag && 'is-dragging',
        )}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div
          className="board-grid"
          role="grid"
          aria-label="Šachovnice"
          aria-describedby="board-instructions"
          onKeyDown={handleKeyDown}
        >
          {displaySquares.map((square) => {
            const piece = squareAt(pieces, square)
            const position = getDisplayPosition(square, viewOrientation)
            const isLight = (position.row + position.col) % 2 === 0
            const isSelected = selected === square
            const isLast = lastMove?.from === square || lastMove?.to === square
            const isCheck = checkSquare === square
            const target = targetMap.get(square)
            const isHoveredDrop = hoveredDropSquare === square && drag?.from !== square
            const ownPiece = piece?.color === mover
            const isPremove = premove?.from === square || premove?.to === square
            const showFile = position.row === 7
            const showRank = position.col === 0
            const isHintSource = hint?.from === square
            const isHintTarget = hint?.level === 2 && hint?.to === square

            const labels: string[] = [`Pole ${square}`]
            if (piece) {
              labels.push(`${COLOR_LABELS[piece.color].toLowerCase()} ${PIECE_LABELS[piece.type].toLowerCase()}`)
            }
            if (isSelected) labels.push('vybráno')
            if (target) labels.push(target.capture ? 'možné braní' : 'možný tah')
            if (isCheck) labels.push('šach')
            if (isLast) labels.push('poslední tah')
            if (isHintSource) labels.push('doporučená figura k tahu')
            if (isHintTarget) labels.push('cílové pole doporučeného tahu')
            if (isPremove) labels.push(premove?.from === square ? 'předtah z tohoto pole' : 'cíl předtahu')

            return (
              <div
                key={square}
                ref={(element) => {
                  if (element) squareRefs.current.set(square, element)
                  else squareRefs.current.delete(square)
                }}
                role="gridcell"
                aria-label={labels.join(', ')}
                aria-selected={isSelected}
                tabIndex={focusedSquare === square ? 0 : -1}
                className={cx(
                  'square',
                  isLight ? 'square--light' : 'square--dark',
                  isSelected && 'is-selected',
                  isLast && 'is-last-move',
                  isCheck && 'is-check',
                  isHintSource && 'is-hint-source',
                  isHintTarget && 'is-hint-target',
                  target && 'is-target',
                  target?.capture && 'is-capture-target',
                  isHoveredDrop && target && 'is-hovered-target',
                  isHoveredDrop && !target && 'is-hovered-illegal',
                  premoveMode && target && 'is-premove-target',
                  ownPiece && interactive && 'is-own-piece',
                )}
                onPointerDown={(event) => handlePointerDown(event, square)}
                onFocus={() => handleRecord(square)}
              >
                {isLast ? <span className="square-overlay square-overlay--last" aria-hidden="true" /> : null}
                {isSelected ? (
                  <span
                    className={cx('square-overlay', premoveMode ? 'square-overlay--premove' : 'square-overlay--selected')}
                    aria-hidden="true"
                  />
                ) : null}
                {isPremove ? <span className="square-overlay square-overlay--premove" aria-hidden="true" /> : null}
                {isCheck ? <span className="square-overlay square-overlay--check" aria-hidden="true" /> : null}
                {isHintSource ? <span className="square-overlay square-overlay--hint-source" aria-hidden="true" /> : null}
                {isHintTarget ? <span className="square-overlay square-overlay--hint-target" aria-hidden="true" /> : null}
                {target && !target.capture ? (
                  <span className="move-dot" aria-hidden="true">
                    <span />
                  </span>
                ) : null}
                {target?.capture ? <span className="capture-ring" aria-hidden="true" /> : null}
                {showCoordinates && showFile ? (
                  <span className={cx('coord', 'coord--file', isLight ? 'coord--on-light' : 'coord--on-dark')} aria-hidden="true">
                    {square[0]}
                  </span>
                ) : null}
                {showCoordinates && showRank ? (
                  <span className={cx('coord', 'coord--rank', isLight ? 'coord--on-light' : 'coord--on-dark')} aria-hidden="true">
                    {square[1]}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="piece-layer" key={gameNumber}>
          {pieces.map((piece, index) => {
            const position = getDisplayPosition(piece.square, viewOrientation)
            const isDragging = drag?.pieceId === piece.id
            const isMoving = movingId === piece.id
            const isRestored = restoredId === piece.id
            const isHintSource = hint && hint.from === piece.square
            const isMated =
              outcome?.reason === 'checkmate' &&
              piece.type === 'k' &&
              piece.color !== outcome.winner

            const style: CSSProperties & Record<string, string | number> = isDragging
              ? {
                  transform: `translate3d(${drag.x - drag.cell / 2}px, ${drag.y - drag.cell / 2}px, 0) scale(1.08)`,
                  zIndex: 30,
                }
              : {
                  '--x': position.col,
                  '--y': position.row,
                  '--piece-index': index,
                  // Set with the position itself, so the transition picks it up.
                  ...(lastMove?.to === piece.square ? { '--dur-move': `${glideMs(lastMove)}ms` } : null),
                  ...(undoneMove?.from === piece.square ? { '--dur-move': `${glideMs(undoneMove)}ms` } : null),
                }

            return (
              <div
                key={piece.id}
                className={cx(
                  'piece',
                  isDragging && 'is-dragging',
                  isMoving && 'is-moving',
                  isRestored && 'is-restored',
                  isHintSource && 'is-hint-source',
                  promotedSquare === piece.square && 'is-promoted',
                  isMated && 'is-mated',
                )}
                data-piece-type={piece.type}
                data-piece-color={piece.color}
                data-square={piece.square}
                style={style}
                aria-hidden="true"
              >
                <span className="piece-lift">
                  <PieceArt type={piece.type} color={piece.color} />
                </span>
              </div>
            )
          })}
        </div>

        {ghost ? (
          <div className="capture-ghost-layer" aria-hidden="true">
            <div
              className="capture-ghost"
              style={{
                '--x': getDisplayPosition(ghost.square, viewOrientation).col,
                '--y': getDisplayPosition(ghost.square, viewOrientation).row,
                // The captured piece pops as the capturing one arrives.
                ...(lastMove ? { '--dur-move': `${glideMs(lastMove)}ms` } : null),
              } as CSSProperties}
              key={ghost.id}
            >
              <PieceArt type={ghost.piece.type} color={ghost.piece.color} />
            </div>
          </div>
        ) : null}

        {ratedBadge && (ratedBadge.rating === 'brilliant' || ratedBadge.rating === 'great') ? (
          <div
            key={`fx-${ratedBadge.square}-${ratedBadge.rating}`}
            className={`board-fx board-fx--${ratedBadge.rating}`}
            style={{
              '--x': getDisplayPosition(ratedBadge.square, viewOrientation).col,
              '--y': getDisplayPosition(ratedBadge.square, viewOrientation).row,
              '--fx-tone': MOVE_RATING_META[ratedBadge.rating].tone,
            } as CSSProperties}
            aria-hidden="true"
          >
            {ratedBadge.rating === 'brilliant' ? (
              <>
                <span className="board-fx-ring" />
                <span className="board-fx-ring" />
                {SPARK_ANGLES.map((angle) => (
                  <span
                    key={angle}
                    className="board-fx-spark"
                    style={{ '--angle': `${angle}deg` } as CSSProperties}
                  />
                ))}
              </>
            ) : (
              <span />
            )}
          </div>
        ) : null}

        {ratedBadge ? (
          <div
            // A new verdict is a new element, so its entrance plays again.
            key={`${ratedBadge.square}-${ratedBadge.rating}`}
            className="board-rating-badge-layer"
            style={{
              '--x': getDisplayPosition(ratedBadge.square, viewOrientation).col,
              '--y': getDisplayPosition(ratedBadge.square, viewOrientation).row,
            } as CSSProperties}
            aria-hidden="true"
          >
            <div className="board-rating-badge">
              <MoveRatingBadge rating={ratedBadge.rating} size="board" />
            </div>
          </div>
        ) : null}

        <BoardArrowLayer
          orientation={viewOrientation}
          marks={[...(systemMarks ?? []), ...userMarks]}
          arrows={[
            ...(systemArrows ?? []).map((arrow) => ({ ...arrow, tone: SYSTEM_TONE[arrow.kind] })),
            ...(hint && hint.level === 2
              ? [{ from: hint.from, to: hint.to, tone: SYSTEM_TONE.hint, kind: 'hint' as const }]
              : []),
            ...(premove ? [{ ...premove, tone: SYSTEM_TONE.premove, kind: 'premove' as const }] : []),
            ...userArrows.map((arrow) => ({ ...arrow, kind: 'user' as const })),
            ...(drawing ? [{ ...drawing, kind: 'drawing' as const }] : []),
          ]}
        />

        {promotion && promotionStyle ? (
          <PromotionPicker
            color={promotion.color}
            options={promotion.options}
            side={promotionSide}
            anchorStyle={promotionStyle}
            onSelect={onPromote}
            onCancel={onCancelPromotion}
          />
        ) : null}

        {outcome && !promotion && !reviewing ? <span className="board-inactive-shade" aria-hidden="true" /> : null}
      </div>
      <p id="board-instructions" className="sr-only">
        Šachovnice. Pohybujte se šipkami mezi poli. Enter nebo mezerník vybere figuru a provede tah.
        Escape zruší výběr. Pravé tlačítko myši kreslí šipky a značky.
      </p>
    </div>
  )
}
