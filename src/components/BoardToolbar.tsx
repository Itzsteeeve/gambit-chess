import { ArrowDownUp, Flag, Handshake, Lightbulb, Loader2, Redo2, Trophy, Undo2 } from 'lucide-react'
import { IconButton } from './IconButton'

interface BoardToolbarProps {
  canUndo: boolean
  canRedo: boolean
  gameOver: boolean
  started: boolean
  hintLevel?: number
  hintLoading?: boolean
  canHint?: boolean
  onUndo: () => void
  onRedo: () => void
  onFlip: () => void
  onResign: () => void
  onDraw: () => void
  onHint?: () => void
  onShowResult: () => void
}

export function BoardToolbar({
  canUndo,
  canRedo,
  gameOver,
  started,
  hintLevel = 0,
  hintLoading = false,
  canHint = true,
  onUndo,
  onRedo,
  onFlip,
  onResign,
  onDraw,
  onHint,
  onShowResult,
}: BoardToolbarProps) {
  return (
    <div className="board-toolbar" role="toolbar" aria-label="Ovládání partie">
      <div className="toolbar-group">
        <IconButton
          label="Odvolat tah"
          onClick={onUndo}
          disabled={!canUndo || gameOver}
          tooltipPosition="top"
        >
          <Undo2 size={18} />
        </IconButton>
        <IconButton
          label="Znovu provést tah"
          onClick={onRedo}
          disabled={!canRedo || gameOver}
          tooltipPosition="top"
        >
          <Redo2 size={18} />
        </IconButton>
      </div>

      <span className="toolbar-divider" aria-hidden="true" />

      <button type="button" className="toolbar-text-button" onClick={onFlip} aria-label="Otočit desku">
        <ArrowDownUp size={17} />
        <span>Otočit</span>
      </button>

      <div className="toolbar-spacer" />

      {gameOver ? (
        <button
          type="button"
          className="toolbar-result-button"
          onClick={onShowResult}
          aria-label="Zobrazit výsledek"
        >
          <Trophy size={16} />
          <span>Zobrazit výsledek</span>
        </button>
      ) : (
        <>
          {onHint ? (
            <button
              type="button"
              className={`toolbar-text-button${hintLevel > 0 ? ' toolbar-text-button--hint-active' : ''}`}
              onClick={onHint}
              disabled={!canHint}
              aria-label={
                hintLevel === 1
                  ? 'Rada: kliknutím zobrazíte šipku tahu'
                  : hintLevel === 2
                    ? 'Rada: kliknutím radu skryjete'
                    : 'Rada: doporučit nejlepší tah'
              }
              title={
                hintLevel === 1
                  ? 'Zobrazena figura. Klikni pro zobrazení šipky tahu (2/2)'
                  : hintLevel === 2
                    ? 'Zobrazena šipka. Klikni pro skrytí rady'
                    : 'Rada (1. klik: označí figurku, 2. klik: ukáže šipku)'
              }
            >
              {hintLoading ? (
                <Loader2 size={17} className="spin" />
              ) : (
                <Lightbulb size={17} />
              )}
              <span>
                {hintLoading
                  ? 'Hledám...'
                  : hintLevel === 1
                    ? 'Rada (1/2)'
                    : hintLevel === 2
                      ? 'Rada (2/2)'
                      : 'Rada'}
              </span>
            </button>
          ) : null}
          <button
            type="button"
            className="toolbar-text-button"
            onClick={onDraw}
            disabled={!started}
            aria-label="Nabídnout remízu"
          >
            <Handshake size={17} />
            <span>Remíza</span>
          </button>
          <button
            type="button"
            className="toolbar-text-button toolbar-text-button--danger"
            onClick={onResign}
            disabled={!started}
            aria-label="Vzdát partii"
          >
            <Flag size={17} />
            <span>Vzdát se</span>
          </button>
        </>
      )}
    </div>
  )
}
