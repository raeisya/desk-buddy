import { useState } from 'react'
import { api } from '../api/client'
import type { FloorDesk, UserSummary } from '../api/contracts'
import { DESK_STATE_STYLE } from './deskStyles'
import { isFree, seatedPerson } from './seating'

interface Props {
  desk: FloorDesk
  persona: UserSummary | null
  /** Why this desk was suggested ("Find me a seat"), shown above the button. */
  note?: string
  onClose: () => void
  /** Refetch the floor. The live stream usually does this, but it may be down (venue Wi-Fi). */
  onChanged: () => void
  /** Open the Me tab (set today's status). Shown on your own desk while you're at it without a booking. */
  onOpenMe?: () => void
}

type Action = 'take' | 'leave' | null

/** What the current persona can do at this desk. Mirrors the API rules; the API has the final say. */
function actionFor(desk: FloorDesk, persona: UserSummary | null): Action {
  if (!persona) return null
  if (desk.occupant?.id === persona.id) return 'leave'
  return isFree(desk) ? 'take' : null
}

/** Privacy: never shows why an owner is away (MC etc.) — the API doesn't send it either. */
export function DeskPanel({ desk, persona, note, onClose, onChanged, onOpenMe }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const action = actionFor(desk, persona)
  const seated = seatedPerson(desk)
  // Your own desk, and you're "in" without a booking (silent = in the office): there's nothing to
  // leave here — you free it by saying you're out (Me tab, or a Slack post).
  const atOwnDeskByDefault = !!persona && desk.owner?.id === persona.id && !desk.occupant && seated?.id === persona.id

  async function run() {
    if (!persona || !action) return
    setBusy(true)
    setError(null)
    try {
      if (action === 'take') await api.claimDesk(desk.id, persona.id)
      else await api.releaseDesk(desk.id, persona.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      // Refetch either way (success, or "someone just took it"), so the map is right even if the
      // live stream is down. When it's up this is a harmless duplicate fetch.
      onChanged()
      setBusy(false)
    }
  }

  return (
    <aside className="desk-panel" aria-label={`Desk ${desk.id} details`}>
      <header>
        <h2>{desk.id}</h2>
        <button type="button" onClick={onClose} aria-label="Close">×</button>
      </header>
      <dl>
        <dt>Status</dt>
        <dd>{DESK_STATE_STYLE[desk.state].label}</dd>
        <dt>Zone</dt>
        <dd>{desk.zone}</dd>
        <dt>Owner</dt>
        <dd>{desk.owner ? `${desk.owner.name} · ${desk.owner.team}` : 'Unassigned'}</dd>
        <dt>Sitting here today</dt>
        <dd>{seated ? seated.name : 'Nobody'}</dd>
      </dl>

      <div className="desk-actions">
        {note && action === 'take' && <p className="suggest-note">★ {note}</p>}
        {action === 'take' && (
          <button type="button" className="px-button primary" onClick={run} disabled={busy}>
            {busy ? 'Taking…' : 'Take this desk'}
          </button>
        )}
        {action === 'leave' && (
          <button type="button" className="px-button" onClick={run} disabled={busy}>
            {busy ? 'Leaving…' : 'Leave desk'}
          </button>
        )}
        {atOwnDeskByDefault && (
          <>
            <p className="muted">You're at your desk today. Out today (WFH, MC, leave)?</p>
            {onOpenMe && (
              <button type="button" className="px-button" onClick={onOpenMe}>
                Set my status
              </button>
            )}
          </>
        )}
        {!persona && <p className="muted">Pick who you are to take a desk.</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </aside>
  )
}
