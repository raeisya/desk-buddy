import type { CSSProperties, ReactNode } from 'react'
import type { FloorDesk, FloorResponse } from '../api/contracts'
import { PixelOffice } from '../components/PixelOffice'
import { useNarrow } from './useNarrow'
import { homeZoneFor, MAP_H, MAP_W, zonesOf } from './zones'

interface Props {
  floor: FloorResponse
  /** Desks that can be picked (no owner): green, clickable. */
  candidates: FloorDesk[]
  /** Desks with an owner that can also be picked (Team › Manage desks, to take back): clickable, not highlighted. */
  owned?: FloorDesk[]
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
 * area dashed, the chosen desk in red with its card beside it. Every green desk is a real button (Tab/Enter).
 * On a phone the map is too small to tap, so a zone-grouped dropdown does the picking.
 */
export function DeskPickerMap({ floor, candidates, owned = [], team, currentId, youId, selectedId, onSelect, popover }: Props) {
  const narrow = useNarrow()
  const zones = zonesOf(floor.desks)
  const home = zones.find((z) => z.name === homeZoneFor(zones, team))
  const current = currentId ? floor.desks.find((d) => d.id === currentId) : undefined
  const pickable = [...candidates, ...owned]
  const selected = pickable.find((d) => d.id === selectedId) ?? null
  // Team's zone first, then floor order.
  const byZone = zones
    .map((z) => [z.name, candidates.filter((d) => d.zone === z.name).sort((a, b) => a.id.localeCompare(b.id))] as const)
    .filter(([, ds]) => ds.length > 0)
    .sort(([a], [b]) => Number(b === home?.name) - Number(a === home?.name))

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
          {pickable.map((d) => {
            const on = d.id === selectedId
            return (
              <button
                key={d.id}
                type="button"
                className={`picker-desk${d.owner ? ' picker-desk--owned' : ''}${on ? ' on' : ''}${d.facing === 'up' ? ' tag-below' : ''}`}
                style={box(d)}
                aria-label={`${d.id}, ${d.zone}, ${d.owner ? `${d.owner.name}'s desk` : 'no owner'}`}
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

      {narrow && (
        // Phone: a desk is ~18 px wide on the map, so pick from one dropdown instead (any number of desks).
        <label className="picker-select">
          <span className="db-label">Pick a desk</span>
          <select
            value={selectedId ?? ''}
            onChange={(e) => onSelect(pickable.find((d) => d.id === e.target.value) ?? null)}
          >
            <option value="">{pickable.length} desks to choose from</option>
            {byZone.map(([zone, desks]) => (
              <optgroup key={zone} label={zone === home?.name ? `${zone} · ${team}` : zone}>
                {desks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id}
                  </option>
                ))}
              </optgroup>
            ))}
            {owned.length > 0 && (
              <optgroup label="Has an owner">
                {[...owned]
                  .sort((a, b) => a.id.localeCompare(b.id))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · {d.owner?.name}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </label>
      )}

      {narrow && selected && popover && <div className="picker-pop picker-pop--inline">{popover}</div>}
    </div>
  )
}
