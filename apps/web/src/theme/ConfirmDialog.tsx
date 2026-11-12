import type { ReactNode } from 'react'
import { Modal } from './Modal'

interface Props {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** In-app "Are you sure?" (C), instead of the browser's window.confirm: same look as every other pop-up. */
export function ConfirmDialog({ open, title, children, confirmLabel, busy = false, onConfirm, onCancel }: Props) {
  return (
    <Modal open={open} title={title} size="small" onClose={() => !busy && onCancel()}>
      <p className="confirm__text">{children}</p>
      <div className="confirm__actions">
        <button type="button" className="db-btn" disabled={busy} onClick={onConfirm}>
          {busy ? 'Saving…' : confirmLabel}
        </button>
        <button type="button" className="db-btn db-btn--plain" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}
