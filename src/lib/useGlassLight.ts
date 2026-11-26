import { useEffect } from 'react'

/** Glass surfaces that catch the pointer light (see glass.css, `--mx` / `--my`). */
const LIT_SELECTOR = '.header-inner, .side-panel-inner, .start-card, .board-toolbar, .modal-panel'

/**
 * Moves a soft specular spot over the glass surface under a mouse pointer.
 * One passive listener on the document, at most one write per frame; touch
 * and pen input are ignored, and so is everything while motion is off.
 */
export function useGlassLight(): void {
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let lit: HTMLElement | null = null
    let frame = 0
    let last: PointerEvent | null = null

    const release = () => {
      if (!lit) return
      lit.style.removeProperty('--mx')
      lit.style.removeProperty('--my')
      lit = null
    }

    const apply = () => {
      frame = 0
      const event = last
      if (!event) return
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(LIT_SELECTOR) : null
      if (target !== lit) release()
      if (!target) return
      const rect = target.getBoundingClientRect()
      target.style.setProperty('--mx', `${Math.round(event.clientX - rect.left)}px`)
      target.style.setProperty('--my', `${Math.round(event.clientY - rect.top)}px`)
      lit = target
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      if (reducedMotion.matches || document.documentElement.dataset.motion === 'off') {
        release()
        return
      }
      last = event
      if (!frame) frame = requestAnimationFrame(apply)
    }

    const onLeave = () => release()

    document.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      if (frame) cancelAnimationFrame(frame)
      release()
    }
  }, [])
}
