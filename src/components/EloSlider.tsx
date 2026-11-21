import type { ChangeEvent, CSSProperties } from 'react'
import { DEFAULT_ENGINE_LEVEL_ID, ENGINE_LEVELS } from '../game/engineLevels'
import type { EngineLevel } from '../game/engineLevels'
import { cx } from '../lib/cx'

interface EloSliderProps {
  value: string
  onChange: (levelId: string) => void
  className?: string
}

/** Short names for the quick-pick chips. Ids must exist in ENGINE_LEVELS. */
const QUICK_LEVELS: Array<{ id: string; short: string }> = [
  { id: '400', short: 'Začátečník' },
  { id: '1000', short: 'Hobby' },
  { id: '1600', short: 'Klub' },
  { id: '2200', short: 'Mistr' },
  { id: 'max', short: 'Plná síla' },
]

const LAST_INDEX = ENGINE_LEVELS.length - 1

/** Chips and slider marks are derived from the same list, so they always agree. */
const QUICK_MARKS = QUICK_LEVELS.flatMap((quick) => {
  const index = ENGINE_LEVELS.findIndex((level) => level.id === quick.id)
  return index < 0 ? [] : [{ ...quick, index, level: ENGINE_LEVELS[index], pos: index / LAST_INDEX }]
})

function eloText(level: EngineLevel) {
  return level.elo === null ? 'Max' : String(level.elo)
}

export function EloSlider({ value, onChange, className }: EloSliderProps) {
  const foundIndex = ENGINE_LEVELS.findIndex((lvl) => lvl.id === value)
  // Unknown ids fall back to the same default level as getEngineLevel().
  const defaultIndex = Math.max(
    0,
    ENGINE_LEVELS.findIndex((lvl) => lvl.id === DEFAULT_ENGINE_LEVEL_ID),
  )
  const currentIndex = foundIndex >= 0 ? foundIndex : defaultIndex
  const currentLevel: EngineLevel = ENGINE_LEVELS[currentIndex] ?? ENGINE_LEVELS[0]
  const isMax = currentLevel.elo === null
  const pos = currentIndex / LAST_INDEX

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextLevel = ENGINE_LEVELS[Number(event.target.value)]
    if (nextLevel) onChange(nextLevel.id)
  }

  return (
    <div className={cx('elo-slider-root', className)} style={{ '--elo-pos': pos } as CSSProperties}>
      <div className="elo-readout" aria-hidden="true">
        <span className="elo-readout-value">
          {eloText(currentLevel)}
          {isMax ? null : <span className="elo-readout-unit">Elo</span>}
        </span>
        <span className="elo-readout-name">{currentLevel.name}</span>
      </div>
      <p className="elo-description">{currentLevel.description}</p>

      <div className="elo-track">
        <div className="elo-track-bar">
          <div className="elo-track-fill" />
        </div>
        <div className="elo-track-ticks" aria-hidden="true">
          {ENGINE_LEVELS.map((level, index) => (
            <span
              key={level.id}
              className={cx('elo-tick', QUICK_MARKS.some((mark) => mark.index === index) && 'is-major')}
              style={{ '--tick-pos': index / LAST_INDEX } as CSSProperties}
            />
          ))}
        </div>
        <input
          type="range"
          min={0}
          max={LAST_INDEX}
          step={1}
          value={currentIndex}
          onChange={handleSliderChange}
          className="elo-range-input"
          aria-label="Nastavení síly Stockfishe podle Elo"
          aria-valuetext={
            isMax
              ? `Plná síla (Max), přes 3500 Elo – ${currentLevel.name}`
              : `Elo ${currentLevel.elo} – ${currentLevel.name}`
          }
        />
        <div className="elo-thumb-rail" aria-hidden="true">
          <span className="elo-thumb" />
        </div>
      </div>

      <div className="elo-quick-chips" role="group" aria-label="Rychlá volba úrovně">
        {QUICK_MARKS.map((mark) => {
          const active = mark.id === currentLevel.id
          return (
            <button
              key={mark.id}
              type="button"
              className={cx('elo-chip-btn', active && 'is-active')}
              aria-pressed={active}
              onClick={() => onChange(mark.id)}
            >
              <strong>{eloText(mark.level)}</strong>
              <span>{mark.short}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
