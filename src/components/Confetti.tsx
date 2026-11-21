import { useMemo } from 'react'
import type { CSSProperties } from 'react'

const COLORS = ['var(--primary)', 'var(--gold)', 'var(--text)', 'var(--primary-hover)', 'var(--gold)']

export function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 1.8 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 80,
        rotate: 160 + Math.random() * 480,
        color: COLORS[index % COLORS.length],
        width: 4 + Math.random() * 4,
        height: 8 + Math.random() * 8,
      })),
    [],
  )

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece"
          style={
            {
              left: `${piece.left}%`,
              width: piece.width,
              height: piece.height,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              '--confetti-drift': `${piece.drift}px`,
              '--confetti-rotate': `${piece.rotate}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
