import type { Color, PieceSymbol } from 'chess.js'

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

export const PIECE_LABELS: Record<PieceSymbol, string> = {
  k: 'Král',
  q: 'Dáma',
  r: 'Věž',
  b: 'Střelec',
  n: 'Jezdec',
  p: 'Pěšec',
}

export const PIECE_ORDER: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p']

export const COLOR_LABELS: Record<Color, string> = {
  w: 'Bílý',
  b: 'Černý',
}

export const COLOR_NAMES: Record<Color, string> = {
  w: 'Bílý hráč',
  b: 'Černý hráč',
}

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w'
}

export type BoardThemeId = 'emerald' | 'walnut' | 'midnight' | 'blush' | 'slate'

export interface BoardTheme {
  id: BoardThemeId
  name: string
  description: string
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'emerald', name: 'Smaragd', description: 'Klubová zelená' },
  { id: 'walnut', name: 'Ořech', description: 'Teplé dřevo' },
  { id: 'midnight', name: 'Půlnoc', description: 'Chladná ocel' },
  { id: 'blush', name: 'Růženín', description: 'Měkký kámen' },
  { id: 'slate', name: 'Břidlice', description: 'Chladný kámen' },
]

/** Player colour choice in the New Game dialog. */
export type ColorChoice = Color | 'random'

export const COLOR_CHOICES: ReadonlyArray<{ id: ColorChoice; label: string }> = [
  { id: 'w', label: 'Bílé' },
  { id: 'random', label: 'Náhodně' },
  { id: 'b', label: 'Černé' },
]

export function resolveColorChoice(choice: ColorChoice, random: () => number = Math.random): Color {
  if (choice === 'random') return random() < 0.5 ? 'w' : 'b'
  return choice
}

export interface TimeControl {
  id: string
  label: string
  minutes: number
  increment: number
  caption: string
}

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'none', label: 'Bez hodin', minutes: 0, increment: 0, caption: 'Klidná hra' },
  { id: '3+2', label: '3 + 2', minutes: 3, increment: 2, caption: 'Bleskovka' },
  { id: '5+0', label: '5 + 0', minutes: 5, increment: 0, caption: 'Bleskovka' },
  { id: '10+0', label: '10 + 0', minutes: 10, increment: 0, caption: 'Rapid' },
  { id: '15+10', label: '15 + 10', minutes: 15, increment: 10, caption: 'Rapid' },
]

export function getTimeControl(id: string): TimeControl {
  return TIME_CONTROLS.find((control) => control.id === id) ?? TIME_CONTROLS[0]
}
