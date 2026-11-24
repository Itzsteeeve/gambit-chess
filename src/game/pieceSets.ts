/**
 * Piece sets.
 *
 * API
 *   PIECE_SETS            list of { id, name, author, license, description, source? } for a settings UI
 *   DEFAULT_PIECE_SET     'chessnut'
 *   isPieceSetId(v)       type guard (validates stored / external values)
 *   getPieceSet()         current id (synchronous)
 *   setPieceSet(id)       change the set everywhere; persisted to localStorage key `gambit.piece-set`
 *   usePieceSet()         React hook -> [pieceSet, setPieceSet]; all components re-render on change
 *                         (module-level store, no provider needed; syncs across tabs too)
 *   getPieceImageUrl(set, color, type)  URL of the bundled SVG for image-based sets ('ivory' has none)
 *   <PieceArt pieceSet="..." />         optional prop overrides the stored choice for one instance
 *
 * Third-party artwork and licenses are documented in /THIRD_PARTY.md.
 */
import { useSyncExternalStore } from 'react'
import type { Color, PieceSymbol } from 'chess.js'

export type PieceSetId = 'ivory' | 'chessnut' | 'terracotta'

export interface PieceSetInfo {
  id: PieceSetId
  name: string
  author: string
  license: string
  description: string
  source?: string
}

export const PIECE_SETS: readonly PieceSetInfo[] = [
  {
    id: 'chessnut',
    name: 'Chessnut',
    author: 'Alexis Luengas',
    license: 'Apache-2.0',
    description: 'Čisté, moderní ploché figury s výraznou linkou.',
    source: 'https://github.com/LexLuengas/chessnut-pieces',
  },
  {
    id: 'ivory',
    name: 'Ivory & Onyx',
    author: 'Gambit',
    license: 'Původní dílo projektu',
    description: 'Vektorové figury s vrstvenou 3D modelací.',
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    author: 'RhosGFX',
    license: 'CC0 1.0',
    description: 'Měkké figury ve slonovině a pálené hlíně.',
    source: 'https://rhosgfx.itch.io/',
  },
]

export const DEFAULT_PIECE_SET: PieceSetId = 'chessnut'
export const PIECE_SET_STORAGE_KEY = 'gambit.piece-set'

export function isPieceSetId(value: unknown): value is PieceSetId {
  return typeof value === 'string' && PIECE_SETS.some((set) => set.id === value)
}

const urls = import.meta.glob('../assets/pieces/*/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export function getPieceImageUrl(set: PieceSetId, color: Color, type: PieceSymbol): string | null {
  return urls[`../assets/pieces/${set}/${color}${type.toUpperCase()}.svg`] ?? null
}

function readStored(): PieceSetId {
  try {
    const raw = window.localStorage.getItem(PIECE_SET_STORAGE_KEY)
    if (raw !== null) {
      let value: unknown = raw
      try {
        value = JSON.parse(raw)
      } catch {
        // tolerate a bare, unquoted id
      }
      if (isPieceSetId(value)) return value
    }
  } catch {
    // storage unavailable
  }
  return DEFAULT_PIECE_SET
}

let current: PieceSetId = typeof window === 'undefined' ? DEFAULT_PIECE_SET : readStored()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function getPieceSet(): PieceSetId {
  return current
}

export function setPieceSet(id: PieceSetId): void {
  if (!isPieceSetId(id) || id === current) return
  current = id
  try {
    window.localStorage.setItem(PIECE_SET_STORAGE_KEY, JSON.stringify(id))
  } catch {
    // ignore
  }
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== PIECE_SET_STORAGE_KEY) return
    const next = readStored()
    if (next !== current) {
      current = next
      emit()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function usePieceSet(): readonly [PieceSetId, (id: PieceSetId) => void] {
  const set = useSyncExternalStore(subscribe, getPieceSet, () => DEFAULT_PIECE_SET)
  return [set, setPieceSet] as const
}
