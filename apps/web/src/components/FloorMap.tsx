import type { FloorDesk } from '../api/contracts'
import { DESK_STATE_STYLE } from './deskStyles'

const PAD = 30

interface Props {
  desks: FloorDesk[]
  onSelect?: (desk: FloorDesk) => void
}

/** Renders desks as SVG from their x/y/w/h. The viewBox fits whatever floor the seed data describes. */
export function FloorMap({ desks, onSelect }: Props) {
  if (desks.length === 0) return <p className="muted">No desks yet — check the seed data.</p>

  const minX = Math.min(...desks.map((d) => d.x)) - PAD
  const minY = Math.min(...desks.map((d) => d.y)) - PAD
  const maxX = Math.max(...desks.map((d) => d.x + d.w)) + PAD
  const maxY = Math.max(...desks.map((d) => d.y + d.h)) + PAD

  // Zone label sits above the top-left desk of each zone.
  const zones = new Map<string, { x: number; y: number }>()
  for (const d of desks) {
    const z = zones.get(d.zone)
    zones.set(d.zone, { x: Math.min(z?.x ?? Infinity, d.x), y: Math.min(z?.y ?? Infinity, d.y) })
  }

  return (
    <svg className="floor" viewBox={`${minX} ${minY - 10} ${maxX - minX} ${maxY - minY + 10}`} role="img" aria-label="Office floor map">
      {[...zones].map(([zone, p]) => (
        <text key={zone} x={p.x} y={p.y - 12} className="zone-label">{zone}</text>
      ))}
      {desks.map((d) => {
        const person = d.occupant ?? d.owner
        return (
          <g key={d.id} className="desk" onClick={() => onSelect?.(d)} tabIndex={0} role="button"
             aria-label={`${d.id}, ${DESK_STATE_STYLE[d.state].label}${person ? `, ${person.name}` : ''}`}>
            <title>{`${d.id} · ${DESK_STATE_STYLE[d.state].label}${d.owner ? ` · owner ${d.owner.name}` : ''}${d.occupant ? ` · today ${d.occupant.name}` : ''}`}</title>
            <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={8} fill={DESK_STATE_STYLE[d.state].color} />
            <text x={d.x + 10} y={d.y + 22} className="desk-id">{d.id}</text>
            <text x={d.x + 10} y={d.y + 42} className="desk-person">{person ? person.name.split(' ')[0] : '—'}</text>
          </g>
        )
      })}
    </svg>
  )
}
