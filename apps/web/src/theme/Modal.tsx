import { useEffect, useId, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** 'small' for a confirm (stays a centred card on a phone); default is wide, for the floor map. */
  size?: 'wide' | 'small'
}

/**
 * Pop-up (C), built on the native <dialog>: Esc closes it, focus stays inside, the page behind is inert
 * and screen readers announce it. Centred on desktop; full screen on a phone (theme.css).
 */
export function Modal({ open, onClose, title, children, size = 'wide' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={size === 'small' ? 'modal modal--small' : 'modal'}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault() // Esc: let React state close it so open/closed never drift apart
        onClose()
      }}
      // A click on the backdrop lands on the <dialog> itself; clicks inside land on its children.
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal__head">
        <h2 id={titleId} className="modal__title">
          {title}
        </h2>
        <button type="button" className="modal__close" aria-label="Close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M4 4l12 12M16 4L4 16" />
          </svg>
        </button>
      </div>
      <div className="modal__body">{open && children}</div>
    </dialog>
  )
}
