import { useEffect, useState } from 'react'
import { isOneOf } from './storage'

/** Colour appearance of the app shell. `system` follows the OS setting. */
export type Appearance = 'system' | 'light' | 'dark'

export const APPEARANCES: ReadonlyArray<{ id: Appearance; label: string }> = [
  { id: 'system', label: 'Systém' },
  { id: 'light', label: 'Světlý' },
  { id: 'dark', label: 'Tmavý' },
]

export const isAppearance = isOneOf<Appearance>(APPEARANCES.map((option) => option.id))

/** Browser chrome colour per resolved appearance (matches `--bg`). */
const THEME_COLOR = { dark: '#07080d', light: '#eef0f6' } as const

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

/**
 * Writes `data-appearance` and `data-transparency` on <html> and keeps the
 * browser's theme-color in step. The inline script in index.html sets the
 * same attributes before the first paint, so there is no flash.
 */
export function useApplyAppearance(appearance: Appearance, reduceTransparency: boolean): 'light' | 'dark' {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  const prefersLessTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)')
  const resolved = appearance === 'system' ? (prefersDark ? 'dark' : 'light') : appearance
  const reduced = reduceTransparency || prefersLessTransparency

  useEffect(() => {
    const root = document.documentElement
    root.dataset.appearance = resolved
    root.dataset.transparency = reduced ? 'reduced' : 'full'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved])
  }, [resolved, reduced])

  return resolved
}
