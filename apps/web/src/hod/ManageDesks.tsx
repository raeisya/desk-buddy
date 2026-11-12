import { useState } from 'react'
import { api } from '../api/client'
import type { FloorDesk, FloorResponse, UserSummary } from '../api/contracts'
import { DeskPickerMap } from '../theme/DeskPickerMap'
import { Modal } from '../theme/Modal'
import { PersonPicker, type PersonOption } from '../theme/PersonPicker'
import { useNarrow } from '../theme/useNarrow'

interface Props {
  floor: FloorResponse
  persona: UserSummary
  /** Active people (from /api/users). */
  users: UserSummary[]
  onChanged: () => void
}

/**
 * HOD/admin manages permanent desks (C): one "Manage desks" button opens a pop-up with the floor map.
 * - Green desk (no owner): type who gets it, Assign. Someone who already has a desk moves (old one freed).
 * - Grey desk (has an owner): Remove takes it back; it goes to the pool and anyone can claim it.
 * HODs only see their own team's desks to take back and only assign their own team; an admin does anyone.
 * The API re-checks everything (HOD: own team only; desk still has no owner).
 */
export function ManageDesks({ floor, persona, users, onChanged }: Props) {
  const [deskId, setDeskId] = useState<string | null>(null)
  const [person, setPerson] = useState<UserSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const narrow = useNarrow()
  const [open, setOpen] = useState(false)

  const isAdmin = persona.role === 'admin'
  const deskOf = new Map(floor.desks.flatMap((d) => (d.owner ? [[d.owner.id, d.id] as const] : [])))
  const teamZones = new Set(floor.desks.filter((d) => d.owner?.team === persona.team).map((d) => d.zone))
  const candidates = floor.desks.filter((d) => !d.owner)
  const owned = floor.desks.filter((d) => d.owner && (isAdmin || d.owner.team === persona.team))
  // HODs assign within their team; an admin can assign anyone.
  const pool = users.filter((u) => isAdmin || u.team === persona.team)
  const deskless = pool.filter((u) => !deskOf.has(u.id))
  const options: PersonOption[] = [...pool]
    .sort((a, b) => Number(deskOf.has(a.id)) - Number(deskOf.has(b.id)) || a.name.localeCompare(b.name))
    .map((u) => ({
      user: u,
      hint: deskOf.has(u.id) ? `has ${deskOf.get(u.id)} · will move` : u.id === 'u-aina' ? 'New joiner' : 'No desk',
    }))
  const desk = [...candidates, ...owned].find((d) => d.id === deskId) ?? null
  const who = isAdmin ? 'the company' : persona.team

  function select(d: FloorDesk | null) {
    setDeskId(d?.id ?? null)
    setPerson(null)
    setMessage(null)
  }

  function close() {
    setOpen(false)
    setDeskId(null)
    setPerson(null)
  }

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      setMessage({ ok: true, text: done })
      setDeskId(null)
      setPerson(null)
      onChanged()
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const assign = () =>
    desk && person && run(() => api.setDeskOwner(persona.id, desk.id, person.id), `${desk.id} is now ${person.name}'s permanent desk.`)

  const remove = () =>
    desk?.owner &&
    run(() => api.setDeskOwner(persona.id, desk.id, null), `${desk.owner.name} no longer has a permanent desk. ${desk.id} is free to assign.`)

  const popover =
    desk &&
    (desk.owner ? (
      <div className="pick-card" role="dialog" aria-label={`Take back desk ${desk.id}`}>
        <div className="pick-card__head">
          <h3>Desk {desk.id}</h3>
          <span className="db-chip db-chip--soft">{desk.owner.name}</span>
        </div>
        <p className="pick-card__sub">
          {desk.zone}. Remove {desk.owner.name} from this desk? It goes back to the pool and anyone can claim it.
          {desk.occupant?.id === desk.owner.id ? ' They stay checked in for today.' : ''}
        </p>
        <div className="pick-card__actions">
          <button type="button" className="db-btn" disabled={busy} onClick={remove}>
            {busy ? 'Removing…' : `Remove ${desk.owner.name}`}
          </button>
          <button type="button" className="db-btn db-btn--plain" onClick={() => select(null)}>
            Cancel
          </button>
        </div>
      </div>
    ) : (
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
    ))

  return (
    <div className="hod-assign">
      <p className="hod-assign__line">
        <strong>{deskless.length}</strong> in {who} without a desk · <strong>{candidates.length}</strong> desks free to assign
      </p>
      <button
        type="button"
        className="db-btn hod-assign__open"
        aria-haspopup="dialog"
        disabled={candidates.length === 0 && owned.length === 0}
        onClick={() => {
          setOpen(true)
          setMessage(null)
        }}
      >
        Manage desks ▶
      </button>
      {!open && message?.ok && (
        <p className="hod-assign__ok" role="status">
          {message.text}
        </p>
      )}

      <Modal open={open} title="Manage desks" onClose={close}>
        <p className="muted modal__hint">
          {narrow ? 'Pick a desk below the map.' : 'Click a desk.'} <strong>Green</strong> has no owner: give it to someone.{' '}
          <strong>Grey</strong> is {isAdmin ? "someone's" : `a ${persona.team}`} permanent desk: take it back. {deskless.length} in{' '}
          {who} have no desk yet.
        </p>
        {message && (
          <p className={message.ok ? 'hod-assign__ok' : 'error'} role={message.ok ? 'status' : 'alert'}>
            {message.text}
          </p>
        )}
        <DeskPickerMap
          floor={floor}
          candidates={candidates}
          owned={owned}
          team={persona.team}
          youId={persona.id}
          selectedId={deskId}
          onSelect={select}
          popover={popover}
        />
      </Modal>
    </div>
  )
}
