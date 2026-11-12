import { useState } from 'react'
import { api } from '../api/client'
import type { FloorResponse, PresenceStatus, UserSummary } from '../api/contracts'
import { frameStyle, variantFor } from '../theme/characters'
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
  /** Jump to the Find seat tab (people without a desk of their own). */
  onFindSeat?: () => void
}

/**
 * "Me" tab (C): one card answering "what does DeskBuddy think I'm doing today?", with one-tap fixes.
 * The usual way to update is still a Slack post; this is for when the AI got it wrong.
 * Privacy: only you see your own reason here; colleagues see "Away".
 */
export function Me({ floor, persona, onChanged, onFindSeat }: Props) {
  const [busy, setBusy] = useState<PresenceStatus | null>(null)
  const [lastSet, setLastSet] = useState<PresenceStatus | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const own = floor.desks.find((d) => d.owner?.id === persona.id) ?? null
  const sitting = floor.desks.find((d) => d.occupant?.id === persona.id) ?? null
  // The floor API says in/out but never the reason, so after a refresh an absent owner shows as "Away".
  const ownerOut = own !== null && own.state === 'available' && !sitting
  const active: PresenceStatus | null = lastSet ?? (sitting || (own && !ownerOut) ? 'IN_OFFICE' : null)
  const headline = active ? STATUSES.find((s) => s.id === active)!.label : ownerOut ? 'Away' : 'No desk yet'
  const out = active !== null ? active !== 'IN_OFFICE' : ownerOut
  const tone = active === 'IN_OFFICE' ? ' me-status--in' : out ? ' me-status--out' : ''

  async function set(status: PresenceStatus) {
    setBusy(status)
    setMessage(null)
    try {
      await api.setPresence(persona.id, status)
      setLastSet(status)
      setMessage('Saved. The map has been updated.')
      onChanged()
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="tab-screen">
      <PageHeader title="Today you're" meta={floorDay(floor)} />

      <div className="db-panel me-card">
        <div className="me-id">
          <span className="me-sprite" style={frameStyle(variantFor(persona.id), 'down', 0)} aria-hidden="true" />
          <div className="me-id__text">
            <span className="db-label">
              {persona.name} · {persona.team}
            </span>
            <p className={`me-status${tone}`} aria-live="polite">
              {headline}
            </p>
            <p className="me-desk">
              {own ? (
                out ? (
                  <>
                    <strong>{own.id}</strong> is free for others today. Colleagues just see "Away".
                  </>
                ) : (
                  <>
                    Your desk <strong>{own.id}</strong> ({own.zone}) shows as yours today.
                  </>
                )
              ) : sitting ? (
                <>
                  You're at <strong>{sitting.id}</strong> today ({sitting.zone}).
                </>
              ) : (
                <>No desk of your own yet. Take a free one near your team.</>
              )}
            </p>
            {!own && !sitting && onFindSeat && (
              <button type="button" className="db-btn me-find" onClick={onFindSeat}>
                Find seat ▶
              </button>
            )}
          </div>
        </div>

        <div className="me-fix">
          <h2 className="db-label">Not right? Tap to fix</h2>
          <div className="me-seg" role="group" aria-label="Today's status">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`me-seg__btn${active === s.id ? ' on' : ''}`}
                aria-pressed={active === s.id}
                disabled={busy !== null}
                onClick={() => set(s.id)}
              >
                {busy === s.id ? 'Saving…' : s.label}
              </button>
            ))}
          </div>
          {message && (
            <p className="me-msg" role="status">
              {message}
            </p>
          )}
        </div>

        <p className="me-slack">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M2 3h14v9H7l-4 3v-3H2z" />
          </svg>
          <span>
            Easier still: post in your team's Slack channel, e.g. <q>WFH today</q>. DeskBuddy reads it.
          </span>
        </p>
      </div>
    </section>
  )
}
