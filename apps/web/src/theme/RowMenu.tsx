import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

export interface RowMenuItem {
  label: string
  onSelect: () => void
  /** Red text: takes something away (deactivate, remove from desk). */
  danger?: boolean
  /** Shown greyed out (and skipped by arrow keys), so people see the action exists but doesn't apply. */
  disabled?: boolean
  /** Short muted note after the label, e.g. "no desk". */
  hint?: string
}

interface Props {
  /** Accessible name of the ⋮ button, e.g. "More actions for Alia". */
  label: string
  items: RowMenuItem[]
  disabled?: boolean
}

const ITEM_H = 36

/**
 * "More actions" ⋮ menu for a table row (C). The menu is portalled to <body> with fixed position, so a
 * scrolling table (overflow-x: auto) can't clip it; it opens upward near the bottom of the screen.
 * Closes on Esc (focus back to ⋮), outside click, scroll or resize. Arrow keys move between items.
 */
export function RowMenu({ label, items, disabled = false }: Props) {
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLUListElement>(null)
  const [pos, setPos] = useState<CSSProperties | null>(null)
  const open = pos !== null

  function show() {
    const r = button.current?.getBoundingClientRect()
    if (!r) return
    const right = window.innerWidth - r.right
    const up = r.bottom + items.length * ITEM_H + 12 > window.innerHeight
    setPos(up ? { right, bottom: window.innerHeight - r.top + 4 } : { right, top: r.bottom + 4 })
  }

  function close(refocus = false) {
    setPos(null)
    if (refocus) button.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setPos(null)
    }
    const onMove = () => setPos(null)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open])

  function onKey(e: KeyboardEvent<HTMLUListElement>) {
    const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      buttons[(at + step + buttons.length) % buttons.length]?.focus()
    } else if (e.key === 'Tab') {
      close()
    }
  }

  // Nothing you can actually do (e.g. your own row, no desk): no ⋮ at all.
  if (items.every((i) => i.disabled)) return null

  return (
    <>
      <button
        ref={button}
        type="button"
        className="row-menu__btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <circle cx="10" cy="4" r="2" />
          <circle cx="10" cy="10" r="2" />
          <circle cx="10" cy="16" r="2" />
        </svg>
      </button>
      {open &&
        createPortal(
          <ul ref={menu} id={id} role="menu" aria-label={label} className="row-menu" style={pos} onKeyDown={onKey}>
            {items.map((item) => (
              <li key={item.label} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className={item.danger ? 'row-menu__item row-menu__item--danger' : 'row-menu__item'}
                  disabled={item.disabled}
                  onClick={() => {
                    close(true)
                    item.onSelect()
                  }}
                >
                  {item.label}
                  {item.hint && <span className="row-menu__hint">{item.hint}</span>}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </>
  )
}
