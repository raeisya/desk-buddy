import { useState } from 'react'
import { api } from '../api/client'
import type { FloorResponse, UserSummary } from '../api/contracts'

interface Props {
  floor: FloorResponse
  persona: UserSummary
  /** Active people (from /api/users). */
  users: UserSummary[]
  onChanged: () => void
}

/**
 * HOD gives a teammate a permanent desk (C). Only desks with no owner; the team's own zones are listed
 * first. The API re-checks everything (own team only, desk still free), so a stale list just errors.
 */
export function AssignSeats({ floor, persona, users, onChanged }: Props) {
  const [pick, setPick] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const owners = new Set(floor.desks.flatMap((d) => (d.owner ? [d.owner.id] : [])))
  const deskless = users.filter((u) => u.team === persona.team && !owners.has(u.id))
  const teamZones = new Set(floor.desks.filter((d) => d.owner?.team === persona.team).map((d) => d.zone))
  const unowned = floor.desks
    .filter((d) => !d.owner)
    .sort((a, b) => Number(teamZones.has(b.zone)) - Number(teamZones.has(a.zone)) || a.id.localeCompare(b.id))

  async function assign(user: UserSummary) {
    const deskId = pick[user.id] ?? unowned[0]?.id
    if (!deskId) return
    setBusyId(user.id)
    setMessage(null)
    try {
      await api.setDeskOwner(persona.id, deskId, user.id)
      setMessage({ ok: true, text: `${deskId} is now ${user.name.split(' ')[0]}'s permanent desk.` })
      onChanged()
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="db-panel">
      <div className="db-panel__head">
        <h2 className="db-panel__title">Give a permanent desk</h2>
        <span className="db-panel__hint">
          {deskless.length} in {persona.team} without one · {unowned.length} desks free to assign
        </span>
      </div>
      <div className="db-panel__body hod-assign">
        {deskless.length === 0 ? (
          <p className="muted">Everyone in {persona.team} has a desk.</p>
        ) : unowned.length === 0 ? (
          <p className="muted">No desks without an owner right now. Teammates can keep hot-seating.</p>
        ) : (
          <ul>
            {deskless.map((u) => (
              <li key={u.id}>
                <span className="hod-assign__name">
                  {u.name}
                  {u.id === 'u-aina' && <span className="db-chip db-chip--ok">New joiner</span>}
                </span>
                <select
                  aria-label={`Desk for ${u.name}`}
                  value={pick[u.id] ?? unowned[0].id}
                  onChange={(e) => setPick((p) => ({ ...p, [u.id]: e.target.value }))}
                  disabled={busyId !== null}
                >
                  {unowned.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} · {d.zone}
                      {teamZones.has(d.zone) ? ' (near team)' : ''}
                    </option>
                  ))}
                </select>
                <button type="button" className="db-btn hod-assign__btn" disabled={busyId !== null} onClick={() => assign(u)}>
                  {busyId === u.id ? 'Assigning…' : 'Assign'}
                </button>
              </li>
            ))}
          </ul>
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
