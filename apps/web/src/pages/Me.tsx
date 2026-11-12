import { useState } from 'react'
import { api } from '../api/client'
import type { FloorResponse, PresenceStatus, UserSummary } from '../api/contracts'
import { PageHeader } from '../theme/Chrome'
import { floorDay } from '../theme/format'
import './screens.css'

const STATUSES: { id: PresenceStatus; label: string }[] = [
  { id: 'IN_OFFICE', label: 'In office' },
  { id: 'WFH', label: 'WFH' },
  { id: 'MC', label: 'MC' },
  { id: 'LEAVE', label: 'Leave' },
  { id: 'OUTSTATION', label: 'Outstation' },
]

interface Props {
  floor: FloorResponse
  persona: UserSummary
  onChanged: () => void
}

/**
 * "Me" tab (C): your desk and today's status, with one-tap fixes.
 * The usual way to update is still a Slack post; this is for when the AI got it wrong.
 * Privacy: only you see your own reason here; colleagues see "Away".
 */
export function Me({ floor, persona, onChanged }: Props) {
  const [busy, setBusy] = useState<PresenceStatus | null>(null)
  const [lastSet, setLastSet] = useState<PresenceStatus | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const own = floor.desks.find((d) => d.owner?.id === persona.id) ?? null
  const sitting = floor.desks.find((d) => d.occupant?.id === persona.id) ?? null
  // The floor API only says in/out (never the reason), so after a refresh we can show In office or Out.
  const inOffice = !!sitting || (own !== null && own.state !== 'available')
  const active = lastSet ?? (inOffice ? 'IN_OFFICE' : null)

  async function set(status: PresenceStatus) {
    setBusy(status)
    setMessage(null)
    try {
      await api.setPresence(persona.id, status)
      setLastSet(status)
      setMessage(
        status === 'IN_OFFICE'
          ? 'Saved. Your desk shows as taken.'
          : own
            ? `Saved. ${own.id} is free for others today; colleagues just see "Away".`
            : 'Saved.',
      )
      onChanged()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="tab-screen">
      <PageHeader
        title="Today you're"
        meta={floorDay(floor)}
        note="DeskBuddy reads your Slack posts. If it got you wrong, fix it here."
      />

      <div className="db-panel">
        <div className="db-panel__head">
          <h2 className="db-panel__title">{active ? STATUSES.find((s) => s.id === active)?.label : inOffice ? 'In office' : 'Out'}</h2>
          {own && <span className={`db-chip ${inOffice ? 'db-chip--soft' : 'db-chip--ok'}`}>{inOffice ? `${own.id} in use` : `${own.id} free for others`}</span>}
        </div>
        <div className="db-panel__body screen-stack">
          {own ? (
            <p className="screen-lead">
              Your desk is <strong>{own.id}</strong> in {own.zone}.
            </p>
          ) : (
            <p className="screen-lead">
              {sitting ? (
                <>
                  You're at <strong>{sitting.id}</strong> today ({sitting.zone}).
                </>
              ) : (
                'No desk of your own yet. Use Find seat to take a free one near your team.'
              )}
            </p>
          )}
        </div>
      </div>

      <div className="screen-stack">
        <h3 className="screen-subtitle">Not right? Tap to fix</h3>
        <div className="status-chips">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`status-chip${active === s.id ? ' on' : ''}`}
              aria-pressed={active === s.id}
              disabled={busy !== null}
              onClick={() => set(s.id)}
            >
              {busy === s.id ? 'Saving…' : s.label}
              {active === s.id && busy === null ? ' ✓' : ''}
            </button>
          ))}
        </div>
        {message && (
          <p className="muted" role="status">
            {message}
          </p>
        )}
        <p className="muted">Easier still: just post in your team's Slack channel. DeskBuddy reads it.</p>
      </div>
    </section>
  )
}
