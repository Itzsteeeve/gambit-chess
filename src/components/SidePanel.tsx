import { useId, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { Color, Move } from 'chess.js'
import { Crown, Info, ListOrdered } from 'lucide-react'
import type { RatedMove } from '../game/moveRating'
import type { GameOutcome } from '../game/notation'
import { cx } from '../lib/cx'
import { GameInfo } from './GameInfo'
import { MoveList } from './MoveList'
import { PieceGallery } from './PieceGallery'

type TabId = 'moves' | 'pieces' | 'info'

const TABS: Array<{ id: TabId; label: string; icon: typeof ListOrdered }> = [
  { id: 'moves', label: 'Partie', icon: ListOrdered },
  { id: 'pieces', label: 'Sada', icon: Crown },
  { id: 'info', label: 'Info', icon: Info },
]

interface SidePanelProps {
  history: Move[]
  turn: Color
  outcome: GameOutcome | null
  isCheck: boolean
  fen: string
  timeControlLabel: string
  boardThemeName: string
  orientation: Color
  ratings?: Record<string, RatedMove>
  coach?: ReactNode
  modeLabel?: string
  engineLabel?: string
  onCopyPgn: () => void
  onCopyFen: () => void
  /** Optional move-list column labels, e.g. "Ty" / "Stockfish". */
  whiteLabel?: string
  blackLabel?: string
  viewPly?: number
  onSelectPly?: (ply: number) => void
  graph?: ReactNode
  reviewStatus?: string | null
}

export function SidePanel({
  history,
  turn,
  outcome,
  isCheck,
  fen,
  timeControlLabel,
  boardThemeName,
  orientation,
  ratings,
  coach,
  modeLabel,
  engineLabel,
  onCopyPgn,
  onCopyFen,
  whiteLabel,
  blackLabel,
  viewPly,
  onSelectPly,
  graph,
  reviewStatus,
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('moves')
  const baseId = useId()

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const currentIndex = TABS.findIndex((tab) => tab.id === activeTab)
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const next = TABS[(currentIndex + direction + TABS.length) % TABS.length]
    setActiveTab(next.id)
    const nextButton = document.getElementById(`${baseId}-tab-${next.id}`)
    nextButton?.focus()
  }

  return (
    <aside className="side-panel" aria-label="Informace o partii">
      <div className="side-panel-inner">
        <div className="side-tabs" role="tablist" aria-label="Panel partie" onKeyDown={handleTabKeyDown}>
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                id={`${baseId}-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={cx('side-tab', activeTab === tab.id && 'is-active')}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} strokeWidth={2} aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div
          className="side-panel-content"
          id={`${baseId}-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${activeTab}`}
          key={activeTab}
        >
          {activeTab === 'moves' ? (
            <MoveList
              history={history}
              turn={turn}
              outcome={outcome}
              isCheck={isCheck}
              ratings={ratings}
              coach={coach}
              onCopyPgn={onCopyPgn}
              onCopyFen={onCopyFen}
              whiteLabel={whiteLabel}
              blackLabel={blackLabel}
              viewPly={viewPly}
              onSelectPly={onSelectPly}
              graph={graph}
              reviewStatus={reviewStatus}
            />
          ) : null}
          {activeTab === 'pieces' ? <PieceGallery /> : null}
          {activeTab === 'info' ? (
            <GameInfo
              fen={fen}
              moveCount={history.length}
              outcome={outcome}
              turn={turn}
              isCheck={isCheck}
              timeControlLabel={timeControlLabel}
              boardThemeName={boardThemeName}
              orientation={orientation}
              modeLabel={modeLabel}
              engineLabel={engineLabel}
              onCopyFen={onCopyFen}
            />
          ) : null}
        </div>
      </div>
    </aside>
  )
}
