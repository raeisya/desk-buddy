import type { FloorDesk, PersonRef } from '../api/contracts'
import { CHARACTER_SHEET, frameStyle, seatPosition, variantFor } from '../theme/characters'
import { DESK_STATE_STYLE } from './deskStyles'
import { OFFICE_MAP } from './officeMap'

const { width: MAP_W, height: MAP_H, src } = OFFICE_MAP
const pct = (value: number, total: number) => `${(value / total) * 100}%`
const SIT_FRAME = CHARACTER_SHEET.frames.sit[0]

/** Who is physically at the desk: today's booking, else the owner if they're in. */
function seatedPerson(d: FloorDesk): PersonRef | null {
  return d.occupant ?? (d.state === 'occupied' ? d.owner : null)
}

/** Owner is out and nobody has taken the desk. Shows "Away" only — never the reason. */
function ownerAway(d: FloorDesk): boolean {
  return d.state === 'available' && d.owner !== null && d.occupant === null
}

interface Props {
  desks: FloorDesk[]
  selectedId?: string | null
  youId?: string | null
  onSelect?: (desk: FloorDesk) => void
}

/**
 * C's map image is the floor; desks are transparent hit areas over the drawn desks, with seated
 * sprites and "Away" bubbles. Everything is placed in map pixels (1280×768) as percentages, so the
 * whole office scales together.
 */
export function PixelOffice({ desks, selectedId, youId, onSelect }: Props) {
  if (desks.length === 0) return <p className="muted">No desks yet — check the seed data.</p>

  // Paint top-to-bottom so lower desks' people overlap the row above, not the other way round.
  const ordered = [...desks].sort((a, b) => a.y - b.y || a.x - b.x)

  return (
    <div
      className="pixel-office"
      style={{ aspectRatio: `${MAP_W} / ${MAP_H}`, backgroundImage: src ? `url("${src}")` : undefined }}
      role="group"
      aria-label="Office floor map"
    >
      {ordered.map((d) => {
        const person = seatedPerson(d)
        const label = DESK_STATE_STYLE[d.state].label
        const isYou = !!youId && (d.owner?.id === youId || d.occupant?.id === youId)
        const seat = seatPosition(d)
        return (
          <div key={d.id} className="px-desk-slot">
            <button
              type="button"
              className={`px-desk state-${d.state}${d.id === selectedId ? ' selected' : ''}${isYou ? ' is-you' : ''}`}
              style={{ left: pct(d.x, MAP_W), top: pct(d.y, MAP_H), width: pct(d.w, MAP_W), height: pct(d.h, MAP_H) }}
              onClick={() => onSelect?.(d)}
              aria-label={`${d.id}, ${label}${person ? `, ${person.name}` : ''}${isYou ? ', your desk' : ''}`}
              title={`${d.id} · ${label}${d.owner ? ` · owner ${d.owner.name}` : ''}${d.occupant ? ` · today ${d.occupant.name}` : ''}`}
            />
            {person && (
              <div
                className={`px-avatar${person.id === youId ? ' is-you' : ''}`}
                aria-hidden="true"
                style={{
                  left: pct(seat.x, MAP_W),
                  top: pct(seat.y, MAP_H),
                  width: pct(CHARACTER_SHEET.frameWidth, MAP_W),
                  height: pct(CHARACTER_SHEET.frameHeight, MAP_H),
                  ...frameStyle(variantFor(person.id), d.facing, SIT_FRAME),
                }}
              />
            )}
            {ownerAway(d) && (
              <span
                className={`px-bubble facing-${d.facing}`}
                aria-hidden="true"
                style={{
                  left: pct(d.x + d.w / 2, MAP_W),
                  // 'down' desks are the top row of a pod → bubble above; 'up' desks → below, so bubbles never cover the other row.
                  top: pct(d.facing === 'down' ? d.y : d.y + d.h, MAP_H),
                }}
              >
                Away
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
