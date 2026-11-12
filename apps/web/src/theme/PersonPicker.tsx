import { useId, useState, type KeyboardEvent } from 'react'
import type { UserSummary } from '../api/contracts'

export interface PersonOption {
  user: UserSummary
  /** Short hint after the name: "New joiner", "No desk", "has D-04 · will move". */
  hint: string
}

interface Props {
  label: string
  options: PersonOption[]
  value: UserSummary | null
  onChange: (user: UserSummary | null) => void
  placeholder?: string
}

/**
 * Type-to-search person field (C): an accessible combobox (arrow keys, Enter, Escape), list opens on
 * focus with the most likely people first. Matches anywhere in the name ("aisy" finds Siti Aisyah).
 */
export function PersonPicker({ label, options, value, onChange, placeholder = 'Type a name…' }: Props) {
  const id = useId()
  const [query, setQuery] = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const q = query.trim().toLowerCase()
  const showAll = !q || (value !== null && query === value.name)
  const matches = (showAll ? options : options.filter((o) => o.user.name.toLowerCase().includes(q))).slice(0, 8)

  function pick(o: PersonOption) {
    onChange(o.user)
    setQuery(o.user.name)
    setOpen(false)
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && open && matches[active]) {
      e.preventDefault()
      pick(matches[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="person-picker">
      <label htmlFor={`${id}-input`} className="db-label">
        {label}
      </label>
      <input
        id={`${id}-input`}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
          if (value && e.target.value !== value.name) onChange(null)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
      />
      {open && (
        <ul id={`${id}-list`} role="listbox" className="person-picker__list">
          {matches.length === 0 && <li className="person-picker__empty">Nobody matches "{query}"</li>}
          {matches.map((o, i) => (
            <li
              key={o.user.id}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              // mousedown, not click: fires before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o)
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span>{o.user.name}</span>
              <span className="person-picker__hint">{o.hint}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
