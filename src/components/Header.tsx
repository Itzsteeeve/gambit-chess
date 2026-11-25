import { AlertCircle, Plus, Settings2, Volume2, VolumeX } from 'lucide-react'
import type { EngineLevel, GameMode } from '../game/engineLevels'
import { Brand } from './Brand'
import { IconButton } from './IconButton'
import { LevelPicker } from './LevelPicker'

interface HeaderProps {
  soundEnabled: boolean
  onToggleSound: () => void
  onOpenSettings: () => void
  onNewGame: () => void
  gameMode: GameMode
  engineLevel: EngineLevel
  onChangeLevel?: (levelId: string) => void
  /** Optional: engine failed to load; shown as a small inline error. */
  engineError?: string | null
  /** Optional, accepted for API symmetry with EvalBar/CoachCard (unused here). */
  showAnalysis?: boolean
  /** Brand click: back to the start screen. */
  onHome?: () => void
}

export function Header({
  soundEnabled,
  onToggleSound,
  onOpenSettings,
  onNewGame,
  gameMode,
  engineLevel,
  onChangeLevel,
  engineError,
  onHome,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <Brand onClick={onHome} />

        <span className="header-divider" aria-hidden="true" />

        {gameMode === 'stockfish' ? (
          onChangeLevel ? (
            <LevelPicker level={engineLevel} onChange={onChangeLevel} />
          ) : (
            <span className="header-mode">
              Stockfish {engineLevel.elo === null ? 'Max' : engineLevel.elo}
            </span>
          )
        ) : (
          <span className="header-mode">Dva hráči · jedna deska</span>
        )}

        {engineError ? (
          <span className="header-error" role="status" title={engineError}>
            <AlertCircle size={14} aria-hidden="true" />
            <span>Engine nedostupný</span>
          </span>
        ) : null}

        <div className="header-actions">
          <IconButton
            label={soundEnabled ? 'Vypnout zvuk' : 'Zapnout zvuk'}
            onClick={onToggleSound}
            active={soundEnabled}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </IconButton>
          <IconButton label="Nastavení" onClick={onOpenSettings}>
            <Settings2 size={18} />
          </IconButton>
          <button
            type="button"
            className="button button--primary new-game-button"
            onClick={onNewGame}
            aria-label="Nová partie"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Nová partie</span>
          </button>
        </div>
      </div>
    </header>
  )
}
