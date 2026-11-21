import { Settings2, Volume2, VolumeX } from 'lucide-react'
import type { BoardThemeId } from '../game/constants'
import { BOARD_THEMES } from '../game/constants'
import { PIECE_SETS, usePieceSet } from '../game/pieceSets'
import { cx } from '../lib/cx'
import { Modal } from './Modal'
import { PieceArt } from './PieceArt'
import { Switch, SwitchRow } from './Switch'

interface SettingsDialogProps {
  soundEnabled: boolean
  onToggleSound: () => void
  volume: number
  onVolumeChange: (volume: number) => void
  boardTheme: BoardThemeId
  onBoardThemeChange: (theme: BoardThemeId) => void
  showCoordinates: boolean
  onShowCoordinatesChange: (value: boolean) => void
  animations: boolean
  onAnimationsChange: (value: boolean) => void
  onTestSound: () => void
  onClose: () => void
}

export function SettingsDialog({
  soundEnabled,
  onToggleSound,
  volume,
  onVolumeChange,
  boardTheme,
  onBoardThemeChange,
  showCoordinates,
  onShowCoordinatesChange,
  animations,
  onAnimationsChange,
  onTestSound,
  onClose,
}: SettingsDialogProps) {
  const [pieceSet, setPieceSet] = usePieceSet()
  return (
    <Modal
      title="Nastavení"
      description="Zvuk, deska, figury a jemnost pohybu."
      icon={<Settings2 size={19} />}
      onClose={onClose}
      size="md"
      footer={(close) => (
        <>
          <span className="settings-footnote">Vše se ukládá jen ve vašem prohlížeči.</span>
          <button type="button" className="button button--primary" onClick={() => close()} data-autofocus>
            Hotovo
          </button>
        </>
      )}
    >
      <div className="settings-sections">
        <section className="settings-section">
          <div className="settings-section-head">
            <h3>Zvuk</h3>
            <button
              type="button"
              className="test-sound-button"
              onClick={onTestSound}
              disabled={!soundEnabled}
            >
              Vyzkoušet
            </button>
          </div>
          <SwitchRow
            title="Zvuky partie"
            description="Jemné dřevěné kliknutí, šach a konec. Nic otravného."
          >
            <div className="sound-control">
              {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              <Switch checked={soundEnabled} onChange={onToggleSound} label="Zapnout zvuky" />
            </div>
          </SwitchRow>
          <div className={cx('volume-row', !soundEnabled && 'is-disabled')}>
            <span>Ticho</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
              aria-label="Hlasitost zvuků"
              disabled={!soundEnabled}
            />
            <span>{Math.round(volume * 100)} %</span>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h3>Materiál desky</h3>
          </div>
          <div className="theme-grid" role="radiogroup" aria-label="Téma šachovnice">
            {BOARD_THEMES.map((theme) => (
              <label
                key={theme.id}
                className={cx('theme-option', boardTheme === theme.id && 'is-selected')}
              >
                <input
                  type="radio"
                  name="board-theme"
                  value={theme.id}
                  checked={boardTheme === theme.id}
                  onChange={() => onBoardThemeChange(theme.id)}
                  className="sr-only"
                />
                <span
                  className={cx('theme-swatches', `theme-swatches--${theme.id}`)}
                  data-theme={theme.id}
                  aria-hidden="true"
                >
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
                <span className="theme-meta">
                  <strong>{theme.name}</strong>
                  <span>{theme.description}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h3>Sada figur</h3>
          </div>
          <div className="piece-set-list" role="radiogroup" aria-label="Sada figur">
            {PIECE_SETS.map((set) => (
              <label key={set.id} className={cx('piece-set-option', pieceSet === set.id && 'is-selected')}>
                <input
                  type="radio"
                  name="piece-set"
                  value={set.id}
                  checked={pieceSet === set.id}
                  onChange={() => setPieceSet(set.id)}
                  className="sr-only"
                />
                <span className="piece-set-preview" data-theme={boardTheme} aria-hidden="true">
                  <span className="square--light">
                    <PieceArt type="n" color="w" pieceSet={set.id} />
                  </span>
                  <span className="square--dark">
                    <PieceArt type="k" color="b" pieceSet={set.id} />
                  </span>
                </span>
                <span className="theme-meta">
                  <strong>{set.name}</strong>
                  <span>
                    {set.author} · {set.license}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="settings-section settings-section--rows">
          <SwitchRow title="Souřadnice" description="Písmena a čísla v okrajových polích.">
            <Switch checked={showCoordinates} onChange={onShowCoordinatesChange} label="Zobrazit souřadnice" />
          </SwitchRow>
          <SwitchRow title="Jemné animace" description="Pohyb figur, zajetí a plynulé přechody.">
            <Switch checked={animations} onChange={onAnimationsChange} label="Zapnout animace" />
          </SwitchRow>
        </section>
      </div>
    </Modal>
  )
}
