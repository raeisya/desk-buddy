import { useState } from 'react'
import { api } from '../api/client'
import type { FloorResponse, PresenceStatus, UserSummary } from '../api/contracts'
import { frameStyle, variantFor } from '../theme/characters'
import { PageHeader } from '../theme/Chrome'
import { DeskPickerMap } from '../theme/DeskPickerMap'
import { Modal } from '../theme/Modal'
import { useNarrow } from '../theme/useNarrow'
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
  const [moving, setMoving] = useState(false)
  const [moveBusy, setMoveBusy] = useState<string | null>(null)
  const [moveMsg, setMoveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [targetId, setTargetId] = useState<string | null>(null)
  const narrow = useNarrow()

  const own = floor.desks.find((d) => d.owner?.id === persona.id) ?? null
  const sitting = floor.desks.find((d) => d.occupant?.id === persona.id) ?? null
  // The floor API says in/out but never the reason, so after a refresh an absent owner shows as "Away".
  const ownerOut = own !== null && own.state === 'available' && !sitting
  const active: PresenceStatus | null = lastSet ?? (sitting || (own && !ownerOut) ? 'IN_OFFICE' : null)
  const headline = active ? STATUSES.find((s) => s.id === active)!.label : ownerOut ? 'Away' : 'No desk yet'
  const out = active !== null ? active !== 'IN_OFFICE' : ownerOut
  const tone = active === 'IN_OFFICE' ? ' me-status--in' : out ? ' me-status--out' : ''

  // Desks you could move your permanent seat to: any with no owner.
  const movable = floor.desks.filter((d) => !d.owner)
  const target = movable.find((d) => d.id === targetId) ?? null

  async function move(deskId: string) {
    setMoveBusy(deskId)
    setMoveMsg(null)
    try {
      const r = await api.moveMyDesk(persona.id, deskId)
      setMoveMsg({ ok: true, text: `Moved. ${r.to} is your desk now; ${r.from} is free for someone else.` })
      setMoving(false)
      setTargetId(null)
      onChanged()
    } catch (e) {
      setMoveMsg({ ok: false, text: (e as Error).message })
    } finally {
      setMoveBusy(null)
    }
  }

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

        {own && (
          <div className="me-move">
            <div className="me-move__head">
              <h2 className="db-label">Permanent desk: {own.id}</h2>
              <button
                type="button"
                className="db-btn db-btn--secondary me-move__toggle"
                aria-haspopup="dialog"
                onClick={() => {
                  setMoving(true)
                  setMoveMsg(null)
                }}
              >
                Change desk
              </button>
            </div>
            {moveMsg?.ok && (
              <p className="me-msg" role="status">
                {moveMsg.text}
              </p>
            )}
          </div>
        )}

        {own && (
          <Modal
            open={moving}
            title="Change your desk"
            onClose={() => {
              setMoving(false)
              setTargetId(null)
            }}
          >
            {movable.length === 0 ? (
              <p className="muted">Every desk has an owner right now. Ask your HOD.</p>
            ) : (
              <>
                <p className="muted modal__hint">
                  {narrow ? 'Pick a desk below the map to move there.' : 'Click a green desk to move there.'} Yours is{' '}
                  <strong>{own.id}</strong>, outlined in red.
                </p>
                <DeskPickerMap
                  floor={floor}
                  candidates={movable}
                  team={persona.team}
                  currentId={own.id}
                  youId={persona.id}
                  selectedId={target?.id ?? null}
                  onSelect={(d) => {
                    setTargetId(d?.id ?? null)
                    setMoveMsg(null)
                  }}
                  popover={
                    target && (
                      <div className="pick-card" role="group" aria-label={`Move to ${target.id}`}>
                        <div className="pick-card__head">
                          <h3>Desk {target.id}</h3>
                          <span className="db-chip db-chip--ok">No owner</span>
                        </div>
                        <p className="pick-card__sub">
                          Move from <strong>{own.id}</strong> to <strong>{target.id}</strong> ({target.zone})? {own.id} becomes free for
                          someone else.
                        </p>
                        <div className="pick-card__actions">
                          <button type="button" className="db-btn" disabled={moveBusy !== null} onClick={() => move(target.id)}>
                            {moveBusy ? 'Moving…' : 'Move here'}
                          </button>
                          <button type="button" className="db-btn db-btn--plain" onClick={() => setTargetId(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )
                  }
                />
                {moveMsg && !moveMsg.ok && (
                  <p className="error" role="alert">
                    {moveMsg.text}
                  </p>
                )}
              </>
            )}
          </Modal>
        )}

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
