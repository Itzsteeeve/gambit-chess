import type { Color, PieceSymbol } from 'chess.js'
import { PIECE_LABELS } from '../game/constants'
import { cx } from '../lib/cx'
import { getPieceImageUrl, usePieceSet } from '../game/pieceSets'
import type { PieceSetId } from '../game/pieceSets'

interface PieceArtProps {
  type: PieceSymbol
  color: Color
  className?: string
  title?: string
  /** Overrides the stored piece set for this instance. */
  pieceSet?: PieceSetId
}

interface Palette {
  fill: string
  shade: string
  stroke: string
  highlight: string
  dark: string
  eye: string
}

const IVORY: Palette = {
  fill: 'url(#ivory-body)',
  shade: 'url(#ivory-shade)',
  stroke: '#6e7064',
  highlight: '#ffffff',
  dark: '#8d8b78',
  eye: '#54564d',
}

const ONYX: Palette = {
  fill: 'url(#onyx-body)',
  shade: 'url(#onyx-shade)',
  stroke: '#a9adae',
  highlight: '#ffffff',
  dark: '#0d0f10',
  eye: '#ebe8db',
}

function Base({ palette }: { palette: Palette }) {
  return (
    <g>
      <ellipse cx="50" cy="88.5" rx="27" ry="6.2" fill="#000" opacity="0.32" />
      <path
        d="M24 83.4c0-4 5.8-6.1 13.2-6.6h25.6c7.4.5 13.2 2.6 13.2 6.6 0 6.1-6.6 8.6-18.2 8.6H42.2C30.6 92 24 89.5 24 83.4Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.5"
      />
      <path
        d="M30.5 83c3-2.5 8.3-3.6 15.2-4"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.5"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M46 91.2h17.4"
        fill="none"
        stroke={palette.stroke}
        strokeOpacity="0.3"
        strokeWidth="1.1"
      />
      <ellipse cx="50" cy="77.4" rx="17.2" ry="3.5" fill={palette.shade} opacity="0.55" />
    </g>
  )
}

function Pawn({ palette }: { palette: Palette }) {
  return (
    <>
      <circle cx="50" cy="30.5" r="11" fill={palette.fill} stroke={palette.stroke} strokeWidth="1.5" />
      <path
        d="M40.8 27c1.4-4 5.1-6.4 9.4-6.1"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.62"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M43.7 43.3c0 5.5-2.4 8.7-4 13.9-1.3 4.2-2.5 11.3-3 20.2h26.6c-.5-8.9-1.7-16-3-20.2-1.6-5.2-4-8.4-4-13.9H43.7Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.5"
      />
      <ellipse cx="50" cy="41.4" rx="14.5" ry="4.8" fill={palette.shade} stroke={palette.stroke} strokeWidth="1.3" />
      <path
        d="M42.3 49.5c-2.2 7-3.4 16.6-3.8 24.4"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.42"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M58.4 49.7c2 7.2 3 15.7 3.4 23.4"
        fill="none"
        stroke={palette.stroke}
        strokeOpacity="0.22"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  )
}

function Rook({ palette }: { palette: Palette }) {
  return (
    <>
      <path
        d="M26 41V27h7.2v-7h7.2v7h6.1v-7h7v7h6.1v-7h7.2v7H74v14H26Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M30 36.5h40"
        fill="none"
        stroke={palette.stroke}
        strokeOpacity="0.28"
        strokeWidth="1.4"
      />
      <path
        d="M33.3 27.5v6.8M46.6 27.5v6.8M60.8 27.5v6.8"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.35"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M29.4 41h41.2l-4.8 12.5H34.2L29.4 41Z"
        fill={palette.shade}
        stroke={palette.stroke}
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M36.2 53.4c-1.2 9.2-3.2 16.3-6.1 23.7h39.8c-2.9-7.4-4.9-14.5-6.1-23.7H36.2Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.5"
      />
      <path
        d="M40.4 57.2c-1.1 7-2.6 13.2-4.7 19.1"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.4"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M58.7 57.2c1 6.8 2.4 13 4.4 19.1"
        fill="none"
        stroke={palette.stroke}
        strokeOpacity="0.22"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M36 58.6h28"
        fill="none"
        stroke={palette.stroke}
        strokeOpacity="0.2"
        strokeWidth="1.1"
      />
    </>
  )
}

function Bishop({ palette }: { palette: Palette }) {
  return (
    <>
      <circle cx="50" cy="13.3" r="4.7" fill={palette.fill} stroke={palette.stroke} strokeWidth="1.4" />
      <path
        d="M50 18.5c-11.7 8.8-17.2 19.2-15.7 31.2 1 7.4 7.2 11.8 15.7 11.8s14.7-4.4 15.7-11.8c1.5-12-4-22.4-15.7-31.2Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.5"
      />
      <path
        d="M55.8 26.4c4.3 6.4 6 13.3 4.3 20.2"
        fill="none"
        stroke={palette.stroke}
        strokeOpacity="0.55"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M41.7 30.8c-5.2 7.2-6.6 14.6-4.6 21.2"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.5"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <ellipse cx="50" cy="62.7" rx="14.8" ry="4.7" fill={palette.shade} stroke={palette.stroke} strokeWidth="1.35" />
      <path
        d="M43 66.8c-1.1 3.7-3.6 6.6-5.2 10.5h24.4c-1.6-3.9-4.1-6.8-5.2-10.5H43Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.4"
      />
      <path
        d="M45.7 69.3c-.9 2.6-2.1 4.5-3.2 6.4"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.35"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M50 18.8v7.4"
        fill="none"
        stroke={palette.stroke}
        strokeOpacity="0.26"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  )
}

function Queen({ palette }: { palette: Palette }) {
  return (
    <>
      <path
        d="M26 43.5 23.7 24.8l10.2 7.4 6-12.2 6.6 11.1L50 14.2l3.5 16.9 6.6-11.1 6 12.2 10.2-7.4L74 43.5H26Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <circle cx="23.6" cy="23.3" r="3.3" fill={palette.fill} stroke={palette.stroke} strokeWidth="1.25" />
      <circle cx="39.6" cy="18.1" r="3.1" fill={palette.fill} stroke={palette.stroke} strokeWidth="1.25" />
      <circle cx="50" cy="12.4" r="3.7" fill={palette.fill} stroke={palette.stroke} strokeWidth="1.25" />
      <circle cx="60.4" cy="18.1" r="3.1" fill={palette.fill} stroke={palette.stroke} strokeWidth="1.25" />
      <circle cx="76.4" cy="23.3" r="3.3" fill={palette.fill} stroke={palette.stroke} strokeWidth="1.25" />
      <path
        d="M27.2 41.2 26 29.8l7.3 4.7M72.8 41.2 74 29.8l-7.3 4.7"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.32"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M30.6 43.4h38.8v6.8c0 4.4-8.8 7-19.4 7s-19.4-2.6-19.4-7v-6.8Z"
        fill={palette.shade}
        stroke={palette.stroke}
        strokeWidth="1.35"
      />
      <circle cx="40.2" cy="49.1" r="1.35" fill={palette.dark} opacity="0.5" />
      <circle cx="50" cy="50.1" r="1.5" fill={palette.dark} opacity="0.5" />
      <circle cx="59.8" cy="49.1" r="1.35" fill={palette.dark} opacity="0.5" />
      <path
        d="M36.6 55.8c-1.2 8.7-3.2 15.3-6.2 21.3h39.2c-3-6-5-12.6-6.2-21.3H36.6Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.5"
      />
      <path
        d="M40.7 59.2c-.9 7-2.4 12.8-4.5 18"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.4"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M58.6 59.2c.8 6.6 2.1 12.1 4 17.1"
        fill="none"
        stroke={palette.stroke}
        strokeOpacity="0.22"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  )
}

function King({ palette }: { palette: Palette }) {
  return (
    <>
      <path
        d="M45.4 8.6h9.2v7.1h7.1v8.9h-7.1v7.2h-9.2v-7.2h-7.1v-8.9h7.1V8.6Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.45"
        strokeLinejoin="round"
      />
      <path
        d="M48 12.2v4.1M42.5 15.4h5"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.5"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M29.8 44.4V34c6.5 1.6 10.6-1.2 12.4-6.7 2.9 4.5 5.4 5.9 7.8 5.9s4.9-1.4 7.8-5.9c1.8 5.5 5.9 8.3 12.4 6.7v10.4H29.8Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M33.3 39.5c3.8.7 6.9-.6 9-3.4"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.38"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M31 44.2h38v7c0 4.5-8.6 7.2-19 7.2s-19-2.7-19-7.2v-7Z"
        fill={palette.shade}
        stroke={palette.stroke}
        strokeWidth="1.35"
      />
      <circle cx="50" cy="50.2" r="2.1" fill={palette.dark} opacity="0.5" />
      <path
        d="M35.8 55.8c-1.2 9-3.2 15.5-6.2 21.3h40.8c-3-5.8-5-12.3-6.2-21.3H35.8Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.5"
      />
      <path
        d="M40.2 59.4c-.9 7.2-2.4 13-4.4 18.1"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.42"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path
        d="M59.2 59.4c.9 6.8 2.3 12.4 4.2 17.4"
        fill="none"
        stroke={palette.stroke}
        strokeOpacity="0.22"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </>
  )
}

function Knight({ palette }: { palette: Palette }) {
  return (
    <>
      {/* Majestic Staunton Knight Body */}
      <path
        d="M66 77.4 C66 64 65 48 62 34 C60.5 27 61.5 19 58 13 C56.5 11 54.5 11.5 53.5 14 L52 19 C46 22.5 39.5 26.5 32.5 34 C29.5 38 30.5 42 34 44 C37.5 45.5 41.5 44.8 44.5 42.5 C42.5 47 44 51 46.5 52.5 C44.5 59 41.5 67 35 77.4 H66 Z"
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Mane accent lines */}
      <path
        d="M58 20 C56 26 55.5 33 56 40 M59 36 C58 43 57.5 50 58.5 57 M57 53 C55.5 60 54.5 67 55 74"
        fill="none"
        stroke={palette.stroke}
        strokeOpacity="0.32"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Forehead & muzzle highlight */}
      <path
        d="M53 16 L51.5 19.5 C45.5 22.5 41 26 35 32.5 C32.5 36 32.5 39 34.5 41.5"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.55"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Alert eye */}
      <ellipse
        cx="44.5"
        cy="31"
        rx="2.4"
        ry="1.6"
        transform="rotate(-20 44.5 31)"
        fill={palette.eye}
        opacity="0.92"
      />
      <circle cx="44.2" cy="30.6" r="0.7" fill={palette.highlight} opacity="0.95" />
      {/* Nostril */}
      <path
        d="M34.5 39.5 C36 40 37.5 40.8 38 42"
        fill="none"
        stroke={palette.dark}
        strokeOpacity="0.75"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Chest arch light highlight */}
      <path
        d="M45.5 54 C43.5 61 40 68 36.5 74.5"
        fill="none"
        stroke={palette.highlight}
        strokeOpacity="0.35"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  )
}

const RENDERERS = {
  p: Pawn,
  r: Rook,
  b: Bishop,
  q: Queen,
  k: King,
  n: Knight,
} as const

export function PieceArt({ type, color, className, title, pieceSet }: PieceArtProps) {
  const [storedSet] = usePieceSet()
  const set = pieceSet ?? storedSet
  const label = title ?? `${color === 'w' ? 'Bílý' : 'Černý'} ${PIECE_LABELS[type].toLowerCase()}`
  const classes = cx('piece-art', `piece-art--${color}`, `piece-art--${set}`, className)
  const url = set === 'ivory' ? null : getPieceImageUrl(set, color, type)

  if (url) {
    return (
      <img
        src={url}
        className={cx(classes, 'piece-art--img')}
        alt={title ? label : ''}
        aria-hidden={title ? undefined : true}
        draggable={false}
        decoding="async"
      />
    )
  }

  const palette = color === 'w' ? IVORY : ONYX
  const Renderer = RENDERERS[type]

  return (
    <svg
      viewBox="0 0 100 100"
      className={classes}
      role={title ? 'img' : undefined}
      aria-label={title ? label : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{label}</title> : null}
      <Base palette={palette} />
      <Renderer palette={palette} />
    </svg>
  )
}
