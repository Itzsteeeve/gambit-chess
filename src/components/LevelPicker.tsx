import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Check, ChevronDown, Info } from 'lucide-react'
import type { EngineLevel } from '../game/engineLevels'
import { ENGINE_LEVELS } from '../game/engineLevels'
import { cx } from '../lib/cx'

interface LevelPickerProps {
  level: EngineLevel
  /** Called only for a different level; the app starts a new game with it. */
  onChange: (levelId: string) => void
}

type MenuState = 'closed' | 'open' | 'closing'

const CLOSE_MS = 110

function eloText(level: EngineLevel) {
  return level.elo === null ? 'Max' : String(level.elo)
}

/**
 * Header level picker: a button + popover listbox. Keyboard: Arrow keys,
 * Home/End, Enter/Space to pick, Esc/Tab to close, type digits or letters
 * to jump (e.g. "16" → 1600, "m" → Max).
 */
export function LevelPicker({ level, onChange }: LevelPickerProps) {
  const [state, setState] = useState<MenuState>('closed')
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, ENGINE_LEVELS.findIndex((item) => item.id === level.id)),
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeaheadRef = useRef({ text: '', at: 0 })
  const timers = useRef<number[]>([])
  const baseId = useId()
  const listId = `${baseId}-list`
  const open = state !== 'closed'

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current = []
  }

  useEffect(() => clearTimers, [])

  const close = useCallback((returnFocus = true) => {
    clearTimers()
    setState((current) => (current === 'closed' ? current : 'closing'))
    timers.current.push(window.setTimeout(() => setState('closed'), CLOSE_MS))
    if (returnFocus) buttonRef.current?.focus()
  }, [])

  const openMenu = () => {
    clearTimers()
    setActiveIndex(Math.max(0, ENGINE_LEVELS.findIndex((item) => item.id === level.id)))
    setState('open')
  }

  // Focus the listbox on open and keep the active option in view.
  useEffect(() => {
    if (state !== 'open') return
    listRef.current?.focus({ preventScroll: true })
  }, [state])

  useEffect(() => {
    if (!open) return
    const option = document.getElementById(`${baseId}-opt-${activeIndex}`)
    option?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, baseId, open])

  // Click outside closes without stealing focus.
  useEffect(() => {
    if (state !== 'open') return
    const handlePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', handlePointer)
    return () => document.removeEventListener('pointerdown', handlePointer)
  }, [close, state])

  const choose = (index: number) => {
    const next = ENGINE_LEVELS[index]
    if (!next) return
    if (next.id !== level.id) onChange(next.id)
    close()
  }

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    const last = ENGINE_LEVELS.length - 1
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(last, index + 1))
        return
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((index) => Math.max(0, index - 1))
        return
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        return
      case 'End':
        event.preventDefault()
        setActiveIndex(last)
        return
      case 'Enter':
      case ' ':
        event.preventDefault()
        choose(activeIndex)
        return
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        close()
        return
      case 'Tab':
        close(false)
        return
    }

    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const now = Date.now()
      const store = typeaheadRef.current
      store.text = now - store.at > 700 ? event.key.toLowerCase() : store.text + event.key.toLowerCase()
      store.at = now
      const query = store.text
      const match = ENGINE_LEVELS.findIndex(
        (item) =>
          eloText(item).toLowerCase().startsWith(query) || item.name.toLowerCase().startsWith(query),
      )
      if (match >= 0) setActiveIndex(match)
    }
  }

  const handleButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu()
    }
  }

  return (
    <div className="level-picker" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="level-trigger"
        aria-haspopup="listbox"
        aria-expanded={state === 'open'}
        aria-controls={open ? listId : undefined}
        aria-label={`Úroveň Stockfishe: ${level.elo === null ? 'plná síla' : `Elo ${level.elo}`}, ${level.name}. Změnit`}
        onClick={() => (state === 'open' ? close() : openMenu())}
        onKeyDown={handleButtonKeyDown}
      >
        <span className="level-trigger-label">Stockfish</span>
        <span className="level-trigger-elo">{eloText(level)}</span>
        <span className="level-trigger-name">{level.name}</span>
        <ChevronDown size={14} className="level-trigger-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div className="level-popover" data-state={state === 'closing' ? 'closing' : 'open'}>
          <ul
            ref={listRef}
            id={listId}
            className="level-listbox"
            role="listbox"
            tabIndex={-1}
            aria-label="Úroveň Stockfishe"
            aria-activedescendant={`${baseId}-opt-${activeIndex}`}
            onKeyDown={handleListKeyDown}
          >
            {ENGINE_LEVELS.map((item, index) => {
              const selected = item.id === level.id
              return (
                <li
                  key={item.id}
                  id={`${baseId}-opt-${index}`}
                  role="option"
                  aria-selected={selected}
                  className={cx('level-option', index === activeIndex && 'is-active')}
                  onPointerMove={() => setActiveIndex(index)}
                  onClick={() => choose(index)}
                >
                  <span className="level-option-elo">{eloText(item)}</span>
                  <span className="level-option-copy">
                    <span className="level-option-name">{item.name}</span>
                    <span className="level-option-desc">{item.description}</span>
                  </span>
                  {selected ? (
                    <Check size={16} strokeWidth={2.5} className="level-option-check" aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </li>
              )
            })}
          </ul>
          <div className="level-popover-foot">
            <Info size={14} aria-hidden="true" />
            <span>Změna úrovně hned spustí novou partii.</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
