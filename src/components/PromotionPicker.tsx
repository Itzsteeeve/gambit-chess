import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { Color, PieceSymbol } from 'chess.js'
import { PieceArt } from './PieceArt'

interface PromotionPickerProps {
  color: Color
  options: PieceSymbol[]
  side: 'up' | 'down'
  anchorStyle: CSSProperties
  onSelect: (type: PieceSymbol) => void
  onCancel: () => void
}

const ORDER: PieceSymbol[] = ['q', 'r', 'b', 'n']

const PROMOTION_LABELS: Record<PieceSymbol, string> = {
  q: 'dámu',
  r: 'věž',
  b: 'střelce',
  n: 'jezdce',
  k: 'krále',
  p: 'pěšce',
}

export function PromotionPicker({
  color,
  options,
  side,
  anchorStyle,
  onSelect,
  onCancel,
}: PromotionPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCancelRef = useRef(onCancel)

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  // Mount-only: focus the first option, restore focus on close. Callback
  // identity changes must not steal focus back to the first option.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const getButtons = () =>
      Array.from(panel.querySelectorAll<HTMLButtonElement>('button.promotion-option'))
    getButtons()[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      const buttons = getButtons()
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelRef.current()
        return
      }
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const direction = event.key === 'ArrowDown' ? 1 : -1
        const next = (index + direction + buttons.length) % buttons.length
        buttons[next]?.focus()
        return
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        const direction = event.shiftKey ? -1 : 1
        const next = (index + direction + buttons.length) % buttons.length
        buttons[next]?.focus()
        return
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      if (!/^[1-9]$/.test(event.key)) return
      const numeric = Number(event.key)
      if (numeric <= buttons.length) {
        event.preventDefault()
        buttons[numeric - 1]?.click()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      const active = document.activeElement
      const focusWasInside = !active || active === document.body || panel.contains(active)
      if (focusWasInside && opener && opener.isConnected && !panel.contains(opener)) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [])

  return (
    <div className="promotion-backdrop" onPointerDown={onCancel}>
      <div
        className={`promotion-picker promotion-picker--${side}`}
        role="dialog"
        aria-modal="true"
        aria-label="Vyberte figuru pro proměnu"
        ref={panelRef}
        style={anchorStyle}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="promotion-options">
          {ORDER.filter((type) => options.includes(type)).map((type, index) => (
            <button
              key={type}
              type="button"
              className="promotion-option"
              onClick={() => onSelect(type)}
              aria-label={`Proměnit na ${PROMOTION_LABELS[type]}`}
            >
              <span className="promotion-key" aria-hidden="true">
                {index + 1}
              </span>
              <PieceArt type={type} color={color} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
