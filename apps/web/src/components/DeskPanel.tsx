import { useState } from 'react'
import { api } from '../api/client'
import type { FloorDesk, UserSummary } from '../api/contracts'
import { DESK_STATE_STYLE } from './deskStyles'

interface Props {
  desk: FloorDesk
  persona: UserSummary | null
  onClose: () => void
}

type Action = 'take' | 'leave' | null

/** What the current persona can do at this desk. Mirrors the API rules; the API has the final say. */
function actionFor(desk: FloorDesk, persona: UserSummary | null): Action {
  if (!persona) return null
  if (desk.occupant?.id === persona.id) return 'leave'
  return desk.state === 'available' || desk.state === 'unassigned' ? 'take' : null
}

/** Privacy: never shows why an owner is away (MC etc.) — the API doesn't send it either. */
export function DeskPanel({ desk, persona, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const action = actionFor(desk, persona)

  async function run() {
    if (!persona || !action) return
    setBusy(true)
    setError(null)
    try {
      // The map refreshes itself from the live stream; no manual reload needed.
      if (action === 'take') await api.claimDesk(desk.id, persona.id)
      else await api.releaseDesk(desk.id, persona.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
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
        <dd>{desk.occupant ? desk.occupant.name : 'Nobody'}</dd>
      </dl>

      <div className="desk-actions">
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
        {!persona && <p className="muted">Pick who you are to take a desk.</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </aside>
  )
}
