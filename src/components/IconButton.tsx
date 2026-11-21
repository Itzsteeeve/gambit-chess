import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../lib/cx'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  active?: boolean
  tone?: 'default' | 'danger'
  tooltipPosition?: 'top' | 'bottom'
}

export function IconButton({
  label,
  children,
  active,
  tone = 'default',
  className,
  tooltipPosition = 'bottom',
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'icon-button',
        active && 'is-active',
        tone === 'danger' && 'icon-button--danger',
        tooltipPosition === 'top' && 'tooltip-top',
        className,
      )}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      data-tooltip={label}
      {...props}
    >
      {children}
    </button>
  )
}
