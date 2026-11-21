import type { ReactNode } from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cx } from '../lib/cx'

/**
 * Plays the exit animation, then calls the parent's `onClose` — or `after`
 * instead, e.g. a footer "confirm" action that also unmounts the modal.
 */
export type ModalCloseFn = (after?: () => void) => void

interface ModalProps {
  title: string
  description?: string
  icon?: ReactNode
  children: ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'lg'
  closeOnBackdrop?: boolean
  /** Footer content, or a render function receiving the animated `close`. */
  footer?: ReactNode | ((close: ModalCloseFn) => ReactNode)
  className?: string
  hideClose?: boolean
}

/** Keep in sync with the 160ms exit animation in dialogs.css. */
const EXIT_MS = 160

function motionReduced(): boolean {
  if (typeof window === 'undefined') return true
  if (document.documentElement.dataset.motion === 'off') return true
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Open modals, bottom → top. Only the topmost one reacts to Esc/Tab/focus. */
const modalStack: symbol[] = []
let savedBodyOverflow: string | null = null

function appRoot(): HTMLElement | null {
  return document.getElementById('root')
}

function isVisible(element: HTMLElement) {
  return element.getClientRects().length > 0
}

function focusableIn(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => !element.hasAttribute('disabled') && !element.closest('[inert]') && isVisible(element),
  )
}

function pushModal(token: symbol) {
  if (modalStack.length === 0) {
    savedBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    appRoot()?.setAttribute('inert', '')
  }
  modalStack.push(token)
}

function popModal(token: symbol) {
  const index = modalStack.lastIndexOf(token)
  if (index !== -1) modalStack.splice(index, 1)
  if (modalStack.length === 0) {
    appRoot()?.removeAttribute('inert')
    document.body.style.overflow = savedBodyOverflow ?? ''
    savedBodyOverflow = null
  }
}

function isTopmost(token: symbol) {
  return modalStack[modalStack.length - 1] === token
}

export function Modal({
  title,
  description,
  icon,
  children,
  onClose,
  size = 'md',
  closeOnBackdrop = true,
  footer,
  className,
  hideClose = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const descriptionId = useId()
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const requestClose = useCallback<ModalCloseFn>((after) => {
    if (closingRef.current) return
    closingRef.current = true
    const finish = () => {
      timerRef.current = null
      ;(after ?? onCloseRef.current)()
    }
    if (motionReduced()) {
      finish()
      return
    }
    setClosing(true)
    timerRef.current = window.setTimeout(finish, EXIT_MS)
  }, [])
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose

  useEffect(() => {
    const token = Symbol('modal')
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    pushModal(token)

    const panel = panelRef.current
    const focusInitial = () => {
      if (!panel) return
      const target = panel.querySelector<HTMLElement>('[data-autofocus]') ?? focusableIn(panel)[0] ?? panel
      target.focus()
    }
    focusInitial()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost(token)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        requestCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return

      const focusable = focusableIn(panel)
      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && panel.contains(active)
      if (!inside) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    // Pull focus back if it escapes the topmost modal (including to <body>).
    const handleFocusIn = (event: FocusEvent) => {
      if (!isTopmost(token) || !panel) return
      const target = event.target
      if (target instanceof Node && panel.contains(target)) return
      focusInitial()
    }
    let refocusFrame = 0
    const handleFocusOut = (event: FocusEvent) => {
      if (!panel || event.relatedTarget) return
      window.cancelAnimationFrame(refocusFrame)
      refocusFrame = window.requestAnimationFrame(() => {
        if (!isTopmost(token) || !panel.isConnected) return
        const active = document.activeElement
        if (!active || active === document.body || !panel.contains(active)) focusInitial()
      })
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)
    panel?.addEventListener('focusout', handleFocusOut)
    return () => {
      window.cancelAnimationFrame(refocusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      panel?.removeEventListener('focusout', handleFocusOut)
      const wasTopmost = isTopmost(token)
      popModal(token)
      // Hand focus back to whatever opened this modal (after `inert` is lifted).
      if (wasTopmost && opener && opener.isConnected && !opener.closest('[inert]')) {
        opener.focus({ preventScroll: true })
      }
    }
  }, [])

  return createPortal(
    <div
      className={cx('modal-backdrop', closing && 'is-closing')}
      data-state={closing ? 'closing' : 'open'}
      onPointerDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) requestClose()
      }}
    >
      <div
        ref={panelRef}
        className={cx('modal-panel', `modal-panel--${size}`, closing && 'is-closing', className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="modal-head">
          {icon ? <div className="modal-icon">{icon}</div> : null}
          <div className="modal-heading">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          {hideClose ? null : (
            <button
              type="button"
              className="icon-button modal-close"
              onClick={() => requestClose()}
              aria-label="Zavřít"
            >
              <X size={18} strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer ? (
          <div className="modal-footer">
            {typeof footer === 'function' ? footer(requestClose) : footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
