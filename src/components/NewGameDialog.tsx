import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Bot, Play, Swords, User } from 'lucide-react'
import { COLOR_CHOICES, TIME_CONTROLS } from '../game/constants'
import type { ColorChoice, TimeControl } from '../game/constants'
import type { GameMode } from '../game/engineLevels'
import { HANDICAPS } from '../game/handicap'
import type { HandicapId } from '../game/handicap'
import { fenTurn } from '../game/review'
import { cx } from '../lib/cx'
import { EloSlider } from './EloSlider'
import { Modal } from './Modal'

export interface NewGameSettings {
  mode: GameMode
  levelId: string
  timeControl: TimeControl
  color: ColorChoice
  handicap: HandicapId
  /** Custom start position ("Hrát odsud", imported FEN); replaces the handicap. */
  startFen?: string
}

interface NewGameDialogProps {
  currentMode: GameMode
  currentLevelId: string
  currentTimeControlId: string
  currentColor: ColorChoice
  currentHandicap: HandicapId
  /** Set when the game starts from this position instead of the standard one. */
  startFen?: string
  hasProgress: boolean
  onStart: (settings: NewGameSettings) => void
  onClose: () => void
}

export function NewGameDialog({
  currentMode,
  currentLevelId,
  currentTimeControlId,
  currentColor,
  currentHandicap,
  startFen,
  hasProgress,
  onStart,
  onClose,
}: NewGameDialogProps) {
  const [mode, setMode] = useState<GameMode>(currentMode)
  const [levelId, setLevelId] = useState<string>(currentLevelId)
  const [tempoId, setTempoId] = useState<string>(currentTimeControlId)
  const [color, setColor] = useState<ColorChoice>(currentColor)
  const [handicap, setHandicap] = useState<HandicapId>(currentHandicap)

  const selectedControl =
    TIME_CONTROLS.find((control) => control.id === tempoId) ?? TIME_CONTROLS[0]

  const settings = (): NewGameSettings => ({
    mode,
    levelId,
    timeControl: selectedControl,
    color,
    handicap,
    startFen,
  })
  const toMove = startFen && fenTurn(startFen) === 'b' ? 'černý' : 'bílý'

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onStart(settings())
  }

  const colorWord = color === 'w' ? 'za bílé' : color === 'b' ? 'za černé' : 'za náhodnou barvu'

  return (
    <Modal
      title={startFen ? 'Hrát z pozice' : 'Nová partie'}
      description={
        startFen
          ? `Nová partie začne ze zvolené pozice. Na tahu je ${toMove}.`
          : mode === 'stockfish'
            ? `Hraj ${colorWord} proti Stockfishi s hodnocením tahů v reálném čase.`
            : 'Dva hráči usednou k jedné desce. Lokální souboj.'
      }
      icon={mode === 'stockfish' ? <Bot size={20} /> : <Swords size={20} />}
      onClose={onClose}
      size="md"
      footer={(close) => (
        <>
          <button type="button" className="button button--ghost" onClick={() => close()}>
            Zrušit
          </button>
          <button
            type="button"
            className="button button--primary"
            data-autofocus
            onClick={() => {
              const next = settings()
              close(() => onStart(next))
            }}
          >
            <Play size={15} fill="currentColor" aria-hidden="true" />
            Začít partii
          </button>
        </>
      )}
    >
      <form id="new-game-form" onSubmit={handleSubmit} className="new-game-form">
        {/* Opponent mode toggle */}
        <div
          className="mode-toggle"
          role="radiogroup"
          aria-label="Režim soupeře"
          style={{ '--i': mode === 'stockfish' ? 0 : 1 } as CSSProperties}
        >
          <button
            type="button"
            className={cx('mode-toggle-btn', mode === 'stockfish' && 'is-selected')}
            onClick={() => setMode('stockfish')}
            role="radio"
            aria-checked={mode === 'stockfish'}
          >
            <Bot size={16} />
            <span>Proti Stockfishi</span>
          </button>
          <button
            type="button"
            className={cx('mode-toggle-btn', mode === 'human' && 'is-selected')}
            onClick={() => setMode('human')}
            role="radio"
            aria-checked={mode === 'human'}
          >
            <User size={16} />
            <span>2 hráči lokálně</span>
          </button>
        </div>

        {mode === 'stockfish' ? (
          <>
            <fieldset>
              <legend className="sr-only">Úroveň Stockfishe</legend>
              <EloSlider value={levelId} onChange={setLevelId} />
            </fieldset>

            <div className={cx('new-game-row', startFen && 'new-game-row--single')}>
              <fieldset className="tempo-fieldset">
                <legend>Hraješ za</legend>
                <div
                  className="mode-toggle mode-toggle--three"
                  role="radiogroup"
                  aria-label="Barva figur"
                  style={{ '--i': Math.max(0, COLOR_CHOICES.findIndex((c) => c.id === color)) } as CSSProperties}
                >
                  {COLOR_CHOICES.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      role="radio"
                      aria-checked={color === choice.id}
                      className={cx('mode-toggle-btn', color === choice.id && 'is-selected')}
                      onClick={() => setColor(choice.id)}
                    >
                      {choice.id === 'random' ? null : (
                        <span className={cx('side-dot', choice.id === 'w' ? 'side-dot--white' : 'side-dot--black')} />
                      )}
                      <span>{choice.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {startFen ? null : (
                <fieldset className="tempo-fieldset">
                  <legend>
                    <label htmlFor="handicap-select">Náskok</label>
                  </legend>
                  <select
                    id="handicap-select"
                    className="select"
                    value={handicap}
                    onChange={(event) => setHandicap(event.target.value as HandicapId)}
                  >
                    {HANDICAPS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id === 'none' ? item.label : `Stockfish ${item.label.toLowerCase()}`}
                      </option>
                    ))}
                  </select>
                </fieldset>
              )}
            </div>
          </>
        ) : null}

        {/* Tempo selector */}
        <fieldset className="tempo-fieldset">
          <legend>Tempo</legend>
          <div className="tempo-grid">
            {TIME_CONTROLS.map((control) => (
              <label
                key={control.id}
                className={cx('tempo-option', tempoId === control.id && 'is-selected')}
              >
                <input
                  type="radio"
                  name="tempo"
                  value={control.id}
                  checked={tempoId === control.id}
                  onChange={() => setTempoId(control.id)}
                  className="sr-only"
                />
                <span className="tempo-option-copy">
                  <strong>{control.label}</strong>
                  <span>{control.caption}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="dialog-note tempo-note">
            {tempoId === 'none'
              ? 'Bez hodin, klidná partie bez časového tlaku.'
              : 'Hodiny se rozeběhnou po prvním tahu. Přírůstek se přičítá po každém tahu.'}
          </p>
        </fieldset>

        {hasProgress ? (
          <p className="dialog-warning">Rozehraná partie bude nahrazena. Tuto akci nelze vrátit.</p>
        ) : null}
      </form>
    </Modal>
  )
}
