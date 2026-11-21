import type { ReactNode } from 'react'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'is-on' : ''}`}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="switch-thumb" aria-hidden="true" />
    </button>
  )
}

interface SwitchRowProps {
  title: string
  description: string
  children: ReactNode
  disabled?: boolean
}

export function SwitchRow({ title, description, children, disabled }: SwitchRowProps) {
  return (
    <div className={`setting-row ${disabled ? 'is-disabled' : ''}`}>
      <div className="setting-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      {children}
    </div>
  )
}
