import type { Color, Square } from 'chess.js'
import { getDisplayPosition } from './pieces'

/** Arrow / mark colours. Each maps to a CSS token (see board.css). */
export type ArrowTone = 'green' | 'red' | 'amber' | 'blue'

export interface BoardArrow {
  from: Square
  to: Square
  tone: ArrowTone
}

export interface BoardMark {
  square: Square
  tone: ArrowTone
}

/** Arrow tone from the modifier keys held while drawing (right-drag). */
export function toneForModifiers(mods: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): ArrowTone {
  if (mods.shiftKey) return 'red'
  if (mods.ctrlKey || mods.metaKey) return 'amber'
  if (mods.altKey) return 'blue'
  return 'green'
}

/** Adds the arrow, or removes it if the same from→to already exists (any tone replaced). */
export function toggleArrow(arrows: BoardArrow[], next: BoardArrow): BoardArrow[] {
  const index = arrows.findIndex((arrow) => arrow.from === next.from && arrow.to === next.to)
  if (index === -1) return [...arrows, next]
  if (arrows[index].tone !== next.tone) return arrows.map((arrow, i) => (i === index ? next : arrow))
  return arrows.filter((_, i) => i !== index)
}

export function toggleMark(marks: BoardMark[], next: BoardMark): BoardMark[] {
  const index = marks.findIndex((mark) => mark.square === next.square)
  if (index === -1) return [...marks, next]
  if (marks[index].tone !== next.tone) return marks.map((mark, i) => (i === index ? next : mark))
  return marks.filter((_, i) => i !== index)
}

export interface ArrowGeometry {
  /** SVG path for the shaft (viewBox 0 0 800 800, one square = 100). */
  shaft: string
  /** Polygon points for the head. */
  head: string
}

/**
 * Geometry of an arrow between two squares. Knight jumps get an L-shaped
 * shaft (long leg first), everything else a straight line.
 */
export function arrowGeometry(from: Square, to: Square, orientation: Color): ArrowGeometry {
  const a = getDisplayPosition(from, orientation)
  const b = getDisplayPosition(to, orientation)
  const x1 = a.col * 100 + 50
  const y1 = a.row * 100 + 50
  const x2 = b.col * 100 + 50
  const y2 = b.row * 100 + 50
  const dx = b.col - a.col
  const dy = b.row - a.row
  const isKnight = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1)

  let startX = x1
  let startY = y1
  let cornerX: number | null = null
  let cornerY: number | null = null
  if (isKnight) {
    const verticalFirst = Math.abs(dy) === 2
    cornerX = verticalFirst ? x1 : x2
    cornerY = verticalFirst ? y2 : y1
  }

  const fromX = cornerX ?? x1
  const fromY = cornerY ?? y1
  const len = Math.hypot(x2 - fromX, y2 - fromY) || 1
  const ux = (x2 - fromX) / len
  const uy = (y2 - fromY) / len
  const nx = -uy
  const ny = ux

  const r = (value: number) => Math.round(value * 10) / 10
  const tip = { x: x2 - ux * 8, y: y2 - uy * 8 }
  const base = { x: x2 - ux * 44, y: y2 - uy * 44 }
  const side1 = { x: base.x + nx * 27, y: base.y + ny * 27 }
  const side2 = { x: base.x - nx * 27, y: base.y - ny * 27 }
  const notch = { x: base.x + ux * 5, y: base.y + uy * 5 }

  // Start clear of the middle of the piece that is moving.
  const lead = 30
  if (cornerX !== null && cornerY !== null) {
    const legLength = Math.hypot(cornerX - x1, cornerY - y1) || 1
    startX = x1 + ((cornerX - x1) / legLength) * lead
    startY = y1 + ((cornerY - y1) / legLength) * lead
  } else {
    startX = x1 + ux * lead
    startY = y1 + uy * lead
  }

  const shaft =
    cornerX !== null && cornerY !== null
      ? `M ${r(startX)} ${r(startY)} L ${r(cornerX)} ${r(cornerY)} L ${r(base.x)} ${r(base.y)}`
      : `M ${r(startX)} ${r(startY)} L ${r(base.x)} ${r(base.y)}`
  const head = [tip, side1, notch, side2].map((p) => `${r(p.x)},${r(p.y)}`).join(' ')
  return { shaft, head }
}
