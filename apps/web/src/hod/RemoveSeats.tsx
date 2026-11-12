import { useState } from 'react'
import { api } from '../api/client'
import type { FloorResponse, UserSummary } from '../api/contracts'
import { Modal } from '../theme/Modal'
import { PersonPicker, type PersonOption } from '../theme/PersonPicker'

interface Props {
  floor: FloorResponse
  persona: UserSummary
  /** Active people (from /api/users). */
  users: UserSummary[]
  onChanged: () => void
}

/**
 * HOD/admin takes a permanent desk back (C): a button under "Give a permanent desk" opens a pop-up;
 * type who, Remove. The desk goes back to the pool (no owner), so anyone can claim it straight away.
 * HODs see their own team only; an admin sees everyone. The API re-checks the team.
 */
export function RemoveSeats({ floor, persona, users, onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [person, setPerson] = useState<UserSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const byId = new Map(users.map((u) => [u.id, u]))
  const owned = floor.desks
    .filter((d) => d.owner && (persona.role === 'admin' || d.owner.team === persona.team))
    .map((d) => ({ desk: d, user: byId.get(d.owner!.id) ?? { ...d.owner!, role: 'staff' as const, avatar: d.owner!.avatar ?? null } }))
  const options: PersonOption[] = owned
    .sort((a, b) => a.user.name.localeCompare(b.user.name))
    .map(({ desk, user }) => ({ user, hint: persona.role === 'admin' ? `${desk.id} · ${user.team}` : desk.id }))
  const picked = person ? owned.find((o) => o.user.id === person.id) ?? null : null

  function close() {
    setOpen(false)
    setPerson(null)
  }

  async function remove() {
    if (!picked) return
    const { desk, user } = picked
    // Sitting there today via check-in keeps them seated; only the ownership goes.
    const sitting = desk.occupant?.id === user.id ? ' They stay checked in for today.' : ''
    if (!window.confirm(`Remove ${user.name} from ${desk.id}? The desk goes back to the pool and anyone can claim it.${sitting}`)) return
    setBusy(true)
    setMessage(null)
    try {
      await api.setDeskOwner(persona.id, desk.id, null)
      setMessage({ ok: true, text: `${user.name} no longer has a permanent desk. ${desk.id} is free to assign.` })
      close()
      onChanged()
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="hod-assign">
      <button
        type="button"
        className="db-btn db-btn--secondary hod-assign__open"
        aria-haspopup="dialog"
        disabled={owned.length === 0}
        onClick={() => {
          setOpen(true)
          setMessage(null)
        }}
      >
        Take back a desk ▶
      </button>
      {message?.ok && (
        <p className="hod-assign__ok" role="status">
          {message.text}
        </p>
      )}

      <Modal open={open} title="Take back a permanent desk" onClose={close}>
        <p className="muted modal__hint">
          {owned.length} in {persona.role === 'admin' ? 'the company' : persona.team} have a permanent desk. Type who loses theirs.
        </p>
        <PersonPicker label="Remove from their desk" options={options} value={person} onChange={setPerson} />
        {picked && (
          <div className="pick-card" role="group" aria-label={`Remove ${picked.user.name} from ${picked.desk.id}`}>
            <div className="pick-card__head">
              <h3>Desk {picked.desk.id}</h3>
              <span className="db-chip db-chip--soft">{picked.user.name}</span>
            </div>
            <p className="pick-card__sub">
              {picked.desk.zone}. After this, {picked.user.name} has no permanent desk until someone assigns one.
            </p>
            <div className="pick-card__actions">
              <button type="button" className="db-btn" disabled={busy} onClick={remove}>
                {busy ? 'Removing…' : `Remove from ${picked.desk.id}`}
              </button>
              <button type="button" className="db-btn db-btn--plain" onClick={() => setPerson(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {message && !message.ok && (
          <p className="error" role="alert">
            {message.text}
          </p>
        )}
      </Modal>
    </div>
  )
}
