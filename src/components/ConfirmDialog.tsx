import type { ReactNode } from 'react'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  icon?: ReactNode
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Pokračovat',
  icon,
  tone = 'default',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      description={description}
      icon={icon}
      onClose={onClose}
      size="sm"
      className={tone === 'danger' ? 'confirm-modal confirm-modal--danger' : 'confirm-modal'}
      footer={(close) => (
        <>
          <button type="button" className="button button--ghost" onClick={() => close()} data-autofocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'button button--danger' : 'button button--primary'}
            onClick={() => close(onConfirm)}
          >
            {confirmLabel}
          </button>
        </>
      )}
    >
      <div className="confirm-copy">
        <p>Potvrzením se partie okamžitě uzavře. Akci nelze vrátit.</p>
      </div>
    </Modal>
  )
}
