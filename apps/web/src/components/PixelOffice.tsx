import type { FloorDesk } from '../api/contracts'
import { DESK_STATE_STYLE } from './deskStyles'
import { OFFICE_MAP } from './officeMap'

const pct = (value: number, total: number) => `${(value / total) * 100}%`

interface Props {
  desks: FloorDesk[]
  selectedId?: string | null
  onSelect?: (desk: FloorDesk) => void
}

export function PixelOffice({ desks, selectedId, onSelect }: Props) {
  if (desks.length === 0) return <p className="muted">No desks yet — check the seed data.</p>

  const { width, height, src } = OFFICE_MAP

  return (
    <div
      className={`pixel-office${src ? ' has-image' : ''}`}
      style={{ aspectRatio: `${width} / ${height}`, backgroundImage: src ? `url("${src}")` : undefined }}
      role="group"
      aria-label="Office floor map"
    >
      {desks.map((d) => {
        const person = d.occupant ?? d.owner
        const label = DESK_STATE_STYLE[d.state].label
        return (
          <button
            key={d.id}
            type="button"
            className={`px-desk state-${d.state}${d.id === selectedId ? ' selected' : ''}`}
            style={{ left: pct(d.x, width), top: pct(d.y, height), width: pct(d.w, width), height: pct(d.h, height) }}
            onClick={() => onSelect?.(d)}
            aria-label={`${d.id}, ${label}${person ? `, ${person.name}` : ''}`}
            title={`${d.id} · ${label}${d.owner ? ` · owner ${d.owner.name}` : ''}${d.occupant ? ` · today ${d.occupant.name}` : ''}`}
          >
            <span className="px-desk-id">{d.id}</span>
            <span className="px-desk-person">{person ? person.name.split(' ')[0] : '—'}</span>
          </button>
        )
      })}
    </div>
  )
}
