import { Check, Settings2, Volume2, VolumeX } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { BoardThemeId } from '../game/constants'
import { BOARD_THEMES } from '../game/constants'
import { PIECE_SETS, usePieceSet } from '../game/pieceSets'
import { APPEARANCES } from '../lib/appearance'
import type { Appearance } from '../lib/appearance'
import { cx } from '../lib/cx'
import { Modal } from './Modal'
import { PieceArt } from './PieceArt'
import { Switch, SwitchRow } from './Switch'

interface SettingsDialogProps {
  soundEnabled: boolean
  onToggleSound: () => void
  volume: number
  onVolumeChange: (volume: number) => void
  appearance: Appearance
  onAppearanceChange: (value: Appearance) => void
  reduceTransparency: boolean
  onReduceTransparencyChange: (value: boolean) => void
  boardTheme: BoardThemeId
  onBoardThemeChange: (theme: BoardThemeId) => void
  showCoordinates: boolean
  onShowCoordinatesChange: (value: boolean) => void
  animations: boolean
  onAnimationsChange: (value: boolean) => void
  showThreats: boolean
  onShowThreatsChange: (value: boolean) => void
  onTestSound: () => void
  onClose: () => void
}

export function SettingsDialog({
  soundEnabled,
  onToggleSound,
  volume,
  onVolumeChange,
  appearance,
  onAppearanceChange,
  reduceTransparency,
  onReduceTransparencyChange,
  boardTheme,
  onBoardThemeChange,
  showCoordinates,
  onShowCoordinatesChange,
  animations,
  onAnimationsChange,
  showThreats,
  onShowThreatsChange,
  onTestSound,
  onClose,
}: SettingsDialogProps) {
  const [pieceSet, setPieceSet] = usePieceSet()
  return (
    <Modal
      title="Nastavení"
      description="Vzhled, zvuk, deska, figury a jemnost pohybu."
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
        <section className="settings-section" aria-labelledby="settings-appearance">
          <h3 className="settings-label" id="settings-appearance">
            Vzhled
          </h3>
          <div className="settings-group">
            <div className="appearance-picker" role="radiogroup" aria-labelledby="settings-appearance">
              {APPEARANCES.map((option) => (
                <label
                  key={option.id}
                  className={cx('appearance-option', appearance === option.id && 'is-selected')}
                >
                  <input
                    type="radio"
                    name="appearance"
                    value={option.id}
                    checked={appearance === option.id}
                    onChange={() => onAppearanceChange(option.id)}
                    className="sr-only"
                  />
                  <span className={`appearance-preview appearance-preview--${option.id}`} aria-hidden="true">
                    <span className="appearance-preview-bar" />
                    <span className="appearance-preview-board" />
                    <span className="appearance-preview-panel" />
                  </span>
                  <span className="appearance-name">{option.label}</span>
                </label>
              ))}
            </div>
            <SwitchRow
              title="Omezit průhlednost"
              description="Plné plochy místo skla. Klidnější a šetrnější k výkonu."
            >
              <Switch
                checked={reduceTransparency}
                onChange={onReduceTransparencyChange}
                label="Omezit průhlednost"
              />
            </SwitchRow>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-sound">
          <div className="settings-label-row">
            <h3 className="settings-label" id="settings-sound">
              Zvuk
            </h3>
            <button
              type="button"
              className="test-sound-button"
              onClick={onTestSound}
              disabled={!soundEnabled}
            >
              Vyzkoušet
            </button>
          </div>
          <div className="settings-group">
            <SwitchRow
              title="Zvuky partie"
              description="Jemné dřevěné kliknutí, šach a konec. Nic otravného."
            >
              <Switch checked={soundEnabled} onChange={onToggleSound} label="Zapnout zvuky" />
            </SwitchRow>
            <div className={cx('volume-row', !soundEnabled && 'is-disabled')}>
              <VolumeX size={16} aria-hidden="true" />
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
                aria-label="Hlasitost zvuků"
                disabled={!soundEnabled}
                style={{ '--fill': `${Math.round(volume * 100)}%` } as CSSProperties}
              />
              <Volume2 size={16} aria-hidden="true" />
              <span>{Math.round(volume * 100)} %</span>
            </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-board">
          <h3 className="settings-label" id="settings-board">
            Deska
          </h3>
          <div className="settings-group settings-group--padded">
            <div className="theme-grid" role="radiogroup" aria-labelledby="settings-board">
              {BOARD_THEMES.map((theme) => (
                <label
                  key={theme.id}
                  className={cx('theme-option', boardTheme === theme.id && 'is-selected')}
                  title={theme.description}
                >
                  <input
                    type="radio"
                    name="board-theme"
                    value={theme.id}
                    checked={boardTheme === theme.id}
                    onChange={() => onBoardThemeChange(theme.id)}
                    className="sr-only"
                  />
                  <span className="theme-swatches" data-theme={theme.id} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="theme-name">{theme.name}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-pieces">
          <h3 className="settings-label" id="settings-pieces">
            Figury
          </h3>
          <div className="settings-group" role="radiogroup" aria-labelledby="settings-pieces">
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
                <Check className="piece-set-check" size={18} strokeWidth={2.5} aria-hidden="true" />
              </label>
            ))}
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-play">
          <h3 className="settings-label" id="settings-play">
            Hra
          </h3>
          <div className="settings-group">
            <SwitchRow title="Souřadnice" description="Písmena a čísla v okrajových polích.">
              <Switch checked={showCoordinates} onChange={onShowCoordinatesChange} label="Zobrazit souřadnice" />
            </SwitchRow>
            <SwitchRow title="Jemné animace" description="Pohyb figur, zajetí a plynulé přechody.">
              <Switch checked={animations} onChange={onAnimationsChange} label="Zapnout animace" />
            </SwitchRow>
            <SwitchRow
              title="Ukazovat hrozby"
              description="Proti Stockfishi: červené šipky na figury, o které můžeš přijít."
            >
              <Switch checked={showThreats} onChange={onShowThreatsChange} label="Ukazovat hrozby" />
            </SwitchRow>
          </div>
        </section>
      </div>
    </Modal>
  )
}
