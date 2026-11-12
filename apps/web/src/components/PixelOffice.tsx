import type { CSSProperties } from 'react'
import type { FloorDesk } from '../api/contracts'
import type { WalkerView } from '../hooks/useWalkers'
import { CHARACTER_SHEET, frameStyle, seatPosition, variantFor } from '../theme/characters'
import { DESK_STATE_STYLE } from './deskStyles'
import { shortName } from './displayName'
import { KOPI_COUNTER, KOPI_MACHINE } from './kopi'
import { OFFICE_MAP } from './officeMap'
import { ownerAway, seatedPerson } from './seating'

const { width: MAP_W, height: MAP_H, src } = OFFICE_MAP
const pct = (value: number, total: number) => `${(value / total) * 100}%`
const SIT_FRAME = CHARACTER_SHEET.frames.sit[0]
const NAME_DROP = 10 // map px: the sit frame has empty space above the head
const { columns } = CHARACTER_SHEET
const [TYPE_A, TYPE_B] = CHARACTER_SHEET.frames.type
const colPct = (col: number) => `${(col / (columns - 1)) * 100}%`

/** Seated people type: alternate the two type frames, out of step with each other. */
function typingStyle(personId: string): CSSProperties {
  let h = 0
  for (let i = 0; i < personId.length; i++) h = (h * 31 + personId.charCodeAt(i)) | 0
  return {
    '--type-a': colPct(TYPE_A),
    '--type-b': colPct(TYPE_B),
    animationDelay: `-${(Math.abs(h) % 10) / 10}s`,
  } as CSSProperties
}

interface Props {
  desks: FloorDesk[]
  selectedId?: string | null
  youId?: string | null
  /** Desk picked by "Find me a seat": highlighted, with a "Sit here" bubble instead of "Away". */
  suggestedId?: string | null
  /** People walking right now (arriving or leaving). */
  walkers?: WalkerView[]
  /** People whose seated sprite is hidden because they're walking. */
  hiddenSeated?: Set<string>
  /** Kopi Easter Egg: banner text while a kopi run is on (steam rises from the machine). */
  kopiMessage?: string | null
  /** Kopi Easter Egg: hidden hit area over the KOPI counter in the pantry. */
  onKopi?: () => void
  onSelect?: (desk: FloorDesk) => void
}

/**
 * C's map image is the floor; desks are transparent hit areas over the drawn desks, with seated
 * sprites and "Away" bubbles. Everything is placed in map pixels (1280×768) as percentages, so the
 * whole office scales together.
 */
export function PixelOffice({
  desks,
  selectedId,
  youId,
  suggestedId,
  walkers = [],
  hiddenSeated,
  kopiMessage,
  onKopi,
  onSelect,
}: Props) {
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
        const seated = seatedPerson(d)
        // Still walking in from the door: the desk is taken but the chair stays empty until they arrive.
        const person = seated && !hiddenSeated?.has(seated.id) ? seated : null
        const label = DESK_STATE_STYLE[d.state].label
        const isYou = !!youId && (d.owner?.id === youId || d.occupant?.id === youId)
        const youSeatedHere = !!person && person.id === youId
        const suggested = d.id === suggestedId && !seated
        const seat = seatPosition(d)
        return (
          <div key={d.id} className="px-desk-slot">
            <button
              type="button"
              className={`px-desk state-${d.state}${d.id === selectedId ? ' selected' : ''}${isYou ? ' is-you' : ''}${isYou && !person ? ' is-you-empty' : ''}${suggested ? ' suggested' : ''}`}
              style={{ left: pct(d.x, MAP_W), top: pct(d.y, MAP_H), width: pct(d.w, MAP_W), height: pct(d.h, MAP_H) }}
              onClick={() => onSelect?.(d)}
              aria-label={`${d.id}, ${label}${seated ? `, ${seated.name}` : ''}${isYou ? ', your desk' : ''}`}
              title={`${d.id} · ${label}${d.owner ? ` · owner ${d.owner.name}` : ''}${d.occupant ? ` · today ${d.occupant.name}` : ''}`}
            />
            {person && (
              <div
                className={`px-avatar typing${person.id === youId ? ' is-you' : ''}`}
                aria-hidden="true"
                style={{
                  left: pct(seat.x, MAP_W),
                  top: pct(seat.y, MAP_H),
                  width: pct(CHARACTER_SHEET.frameWidth, MAP_W),
                  height: pct(CHARACTER_SHEET.frameHeight, MAP_H),
                  ...frameStyle(variantFor(person.id), d.facing, SIT_FRAME),
                  ...typingStyle(person.id),
                }}
              />
            )}
            {person && (
              <span
                className={`px-name facing-${d.facing}${youSeatedHere ? ' is-you' : ''}`}
                aria-hidden="true"
                style={{
                  left: pct(seat.x + CHARACTER_SHEET.frameWidth / 2, MAP_W),
                  // Above the head for top-row (front-facing) people, below for the bottom row — same side as the bubbles.
                  // (+NAME_DROP so top-row tags clear the zone signs drawn just above the pods)
                  top: pct(d.facing === 'down' ? seat.y + NAME_DROP : d.y + d.h, MAP_H),
                }}
              >
                {youSeatedHere ? 'YOU' : shortName(person.name)}
              </span>
            )}
            {(ownerAway(d) || suggested) && (
              <span
                className={`px-bubble facing-${d.facing}${suggested ? ' suggested' : ''}`}
                aria-hidden="true"
                style={{
                  left: pct(d.x + d.w / 2, MAP_W),
                  // 'down' desks are the top row of a pod → bubble above; 'up' desks → below, so bubbles never cover the other row.
                  top: pct(d.facing === 'down' ? d.y : d.y + d.h, MAP_H),
                }}
              >
                {suggested ? 'Sit here!' : 'Away'}
              </span>
            )}
          </div>
        )
      })}
      {[...walkers]
        .sort((a, b) => a.y - b.y)
        .map((w) => (
          <div key={`walk-${w.personId}`} className="px-walker" aria-hidden="true">
            <div
              className={`px-avatar walking${w.personId === youId ? ' is-you' : ''}`}
              style={{
                left: pct(w.x, MAP_W),
                top: pct(w.y, MAP_H),
                width: pct(CHARACTER_SHEET.frameWidth, MAP_W),
                height: pct(CHARACTER_SHEET.frameHeight, MAP_H),
                ...frameStyle(variantFor(w.personId), w.dir, w.column),
              }}
            />
            {!w.bubble && (
              // Stopped with a bubble (kopi counter): the bubble replaces the name, or a crowd's tags overlap.
              <span
                className={`px-name facing-down${w.personId === youId ? ' is-you' : ''}`}
                style={{ left: pct(w.x + CHARACTER_SHEET.frameWidth / 2, MAP_W), top: pct(w.y + NAME_DROP, MAP_H) }}
              >
                {w.personId === youId ? 'YOU' : shortName(w.name)}
              </span>
            )}
            {w.bubble && (
              <span
                className="px-bubble facing-down kopi"
                style={{ left: pct(w.x + CHARACTER_SHEET.frameWidth / 2, MAP_W), top: pct(w.y - 2, MAP_H) }}
              >
                {w.bubble}
              </span>
            )}
          </div>
        ))}
      {onKopi && (
        // Easter egg: looks like part of the drawing until you click the KOPI counter.
        <button
          type="button"
          className="px-kopi-hit"
          aria-label="Kopi counter"
          onClick={onKopi}
          style={{
            left: pct(KOPI_COUNTER.x, MAP_W),
            top: pct(KOPI_COUNTER.y, MAP_H),
            width: pct(KOPI_COUNTER.w, MAP_W),
            height: pct(KOPI_COUNTER.h, MAP_H),
          }}
        />
      )}
      {kopiMessage && (
        <>
          <div className="px-steam" aria-hidden="true" style={{ left: pct(KOPI_MACHINE.x, MAP_W), top: pct(KOPI_MACHINE.y, MAP_H) }}>
            <span />
            <span />
            <span />
          </div>
          <div className="px-kopi-banner" role="status">
            {kopiMessage}
          </div>
        </>
      )}
    </div>
  )
}
