import type { CSSProperties, ReactNode } from 'react'
import type { FloorDesk, FloorResponse } from '../api/contracts'
import { PixelOffice } from '../components/PixelOffice'
import { useNarrow } from './useNarrow'
import { homeZoneFor, MAP_H, MAP_W, zonesOf } from './zones'

interface Props {
  floor: FloorResponse
  /** Desks that can be picked (no owner): green, clickable. */
  candidates: FloorDesk[]
  /** Team whose area gets a dashed outline, so "near the team" is visible. */
  team: string
  /** Your current permanent desk (Me › Change desk): outlined so you see from → to. */
  currentId?: string | null
  youId?: string | null
  selectedId: string | null
  onSelect: (desk: FloorDesk | null) => void
  /** Card for the selected desk: floats beside it on desktop, sits under the map on a phone. */
  popover?: ReactNode
}

const pct = (v: number, total: number) => `${(v / total) * 100}%`
const box = (b: { x: number; y: number; w: number; h: number }): CSSProperties => ({
  left: pct(b.x, MAP_W),
  top: pct(b.y, MAP_H),
  width: pct(b.w, MAP_W),
  height: pct(b.h, MAP_H),
})

/** Pop-up beside the desk: to its right, or its left on the right side of the floor; low desks anchor from the bottom. */
function popStyle(d: FloorDesk): CSSProperties {
  // Middle desks open to the right (keeps the team area on the left visible); only far-right desks flip.
  const onRight = d.x + d.w > MAP_W * 0.7
  const low = d.y > MAP_H / 2
  return {
    ...(onRight ? { right: `calc(${100 - (d.x / MAP_W) * 100}% + 14px)` } : { left: `calc(${((d.x + d.w) / MAP_W) * 100}% + 14px)` }),
    ...(low ? { bottom: `${100 - ((d.y + d.h) / MAP_H) * 100}%` } : { top: pct(d.y, MAP_H) }),
  }
}

/**
 * Pick a desk on the real floor (C): the live map with people, desks you can pick in green, your team's
 * area dashed, the chosen desk in red with its card beside it. Chips under the map are the same desks,
 * for small screens (a desk is ~18 px wide on a phone) and keyboard users.
 */
export function DeskPickerMap({ floor, candidates, team, currentId, youId, selectedId, onSelect, popover }: Props) {
  const narrow = useNarrow()
  const zones = zonesOf(floor.desks)
  const home = zones.find((z) => z.name === homeZoneFor(zones, team))
  const current = currentId ? floor.desks.find((d) => d.id === currentId) : undefined
  const selected = candidates.find((d) => d.id === selectedId) ?? null

  return (
    <div className="picker">
      <div className="picker-map">
        <PixelOffice desks={floor.desks} youId={youId} />
        <div className="picker-layer">
          {home && (
            <div className="picker-team" style={box(home)}>
              <span>{team}</span>
            </div>
          )}
          {current && (
            <div className="picker-current" style={box(current)}>
              <span>Yours · {current.id}</span>
            </div>
          )}
          {candidates.map((d) => {
            const on = d.id === selectedId
            return (
              <button
                key={d.id}
                type="button"
                className={`picker-desk${on ? ' on' : ''}${d.facing === 'up' ? ' tag-below' : ''}`}
                style={box(d)}
                aria-label={`${d.id}, ${d.zone}, no owner`}
                aria-pressed={on}
                onClick={() => onSelect(on ? null : d)}
              >
                <span className="picker-tag">{d.id}</span>
              </button>
            )
          })}
          {!narrow && selected && popover && (
            <div className="picker-pop" style={popStyle(selected)}>
              {popover}
            </div>
          )}
        </div>
      </div>

      <div className="picker-chips" role="group" aria-label="Desks you can pick">
        {candidates.map((d) => (
          <button
            key={d.id}
            type="button"
            className={d.id === selectedId ? 'on' : undefined}
            aria-pressed={d.id === selectedId}
            onClick={() => onSelect(d.id === selectedId ? null : d)}
          >
            {d.id} <span>{d.zone.replace('Zone ', '')}</span>
          </button>
        ))}
      </div>

      {narrow && selected && popover && <div className="picker-pop picker-pop--inline">{popover}</div>}
    </div>
  )
}
