import type { Color, Move } from 'chess.js'
import type { RatedMove } from '../game/moveRating'
import { summarizeSide } from '../game/review'
import { EvalGraph } from './EvalGraph'
import type { GraphMarker } from './EvalGraph'

interface AnalysisCardProps {
  history: Move[]
  ratings: Record<string, RatedMove>
  series: Array<number | null>
  markers: GraphMarker[]
  viewPly: number
  /** Background analysis progress; shown after the game. */
  progress?: { done: number; total: number }
  whiteName: string
  blackName: string
  onSelectPly: (ply: number) => void
}

const percent = (value: number | null) => (value === null ? '–' : `${Math.round(value)} %`)

/** The review strip of the "Partie" tab: the evaluation graph and both accuracies. */
export function AnalysisCard({
  history,
  ratings,
  series,
  markers,
  viewPly,
  progress,
  whiteName,
  blackName,
  onSelectPly,
}: AnalysisCardProps) {
  const sides = (['w', 'b'] as Color[]).map((color) => ({
    color,
    name: color === 'w' ? whiteName : blackName,
    accuracy: summarizeSide(history, ratings, color).accuracy,
  }))

  return (
    <section className="analysis-card" aria-label="Rozbor partie">
      <EvalGraph
        compact
        series={series}
        currentPly={viewPly}
        markers={markers}
        progress={progress}
        onSelectPly={onSelectPly}
      />
      <p className="analysis-accuracy">
        {sides.map((side) => (
          <span key={side.color}>
            {side.name} <strong>{percent(side.accuracy)}</strong>
          </span>
        ))}
      </p>
    </section>
  )
}
