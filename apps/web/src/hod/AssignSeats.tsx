import { useState } from 'react'
import { api } from '../api/client'
import type { FloorDesk, FloorResponse, UserSummary } from '../api/contracts'
import { DeskPickerMap } from '../theme/DeskPickerMap'
import { PersonPicker, type PersonOption } from '../theme/PersonPicker'

interface Props {
  floor: FloorResponse
  persona: UserSummary
  /** Active people (from /api/users). */
  users: UserSummary[]
  onChanged: () => void
}

/**
 * HOD gives a permanent desk (C): click a green desk on the map, type who gets it, Assign.
 * Only desks with no owner. Someone who already has a desk moves (their old one is freed).
 * The API re-checks everything (HOD: own team only; desk still has no owner).
 */
export function AssignSeats({ floor, persona, users, onChanged }: Props) {
  const [deskId, setDeskId] = useState<string | null>(null)
  const [person, setPerson] = useState<UserSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const deskOf = new Map(floor.desks.flatMap((d) => (d.owner ? [[d.owner.id, d.id] as const] : [])))
  const teamZones = new Set(floor.desks.filter((d) => d.owner?.team === persona.team).map((d) => d.zone))
  const candidates = floor.desks.filter((d) => !d.owner)
  // HODs assign within their team; an admin can assign anyone.
  const pool = users.filter((u) => persona.role === 'admin' || u.team === persona.team)
  const deskless = pool.filter((u) => !deskOf.has(u.id))
  const options: PersonOption[] = [...pool]
    .sort((a, b) => Number(deskOf.has(a.id)) - Number(deskOf.has(b.id)) || a.name.localeCompare(b.name))
    .map((u) => ({
      user: u,
      hint: deskOf.has(u.id) ? `has ${deskOf.get(u.id)} · will move` : u.id === 'u-aina' ? 'New joiner' : 'No desk',
    }))
  const desk = candidates.find((d) => d.id === deskId) ?? null

  function select(d: FloorDesk | null) {
    setDeskId(d?.id ?? null)
    setMessage(null)
  }

  async function assign() {
    if (!desk || !person) return
    setBusy(true)
    setMessage(null)
    try {
      await api.setDeskOwner(persona.id, desk.id, person.id)
      setMessage({ ok: true, text: `${desk.id} is now ${person.name}'s permanent desk.` })
      setDeskId(null)
      setPerson(null)
      onChanged()
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const popover = desk && (
    <div className="pick-card" role="dialog" aria-label={`Assign desk ${desk.id}`}>
      <div className="pick-card__head">
        <h3>Desk {desk.id}</h3>
        <span className="db-chip db-chip--ok">No owner</span>
      </div>
      <p className="pick-card__sub">
        {desk.zone}
        {teamZones.has(desk.zone) ? `, next to where ${persona.team} sits` : ''}.
      </p>
      <PersonPicker key={desk.id} label="Assign to" options={options} value={person} onChange={setPerson} />
      <div className="pick-card__actions">
        <button type="button" className="db-btn" disabled={!person || busy} onClick={assign}>
          {busy ? 'Assigning…' : `Assign ${desk.id}`}
        </button>
        <button type="button" className="db-btn db-btn--plain" onClick={() => select(null)}>
          Cancel
        </button>
      </div>
    </div>
  )

  return (
    <div className="db-panel">
      <div className="db-panel__head">
        <h2 className="db-panel__title">Give a permanent desk</h2>
        <span className="db-panel__hint">
          {deskless.length} in {persona.role === 'admin' ? 'the company' : persona.team} without one · {candidates.length} desks free to
          assign
        </span>
      </div>
      <div className="db-panel__body hod-assign">
        {candidates.length === 0 ? (
          <p className="muted">Every desk has an owner right now. People without one keep hot-seating.</p>
        ) : (
          <>
            <p className="muted hod-assign__how">Click a green desk, then type who gets it.</p>
            <DeskPickerMap
              floor={floor}
              candidates={candidates}
              team={persona.team}
              youId={persona.id}
              selectedId={deskId}
              onSelect={select}
              popover={popover}
            />
            {deskless.length > 0 && (
              <p className="hod-assign__who">
                <span className="db-label">Without a desk</span>{' '}
                {deskless.map((u) => (u.id === 'u-aina' ? `${u.name} (new joiner)` : u.name)).join(' · ')}
              </p>
            )}
          </>
        )}
        {message && (
          <p className={message.ok ? 'hod-assign__ok' : 'error'} role="status">
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
