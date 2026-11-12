import type { FloorDesk } from '../api/contracts'
import { DESK_STATE_STYLE } from './deskStyles'

interface Props {
  desk: FloorDesk
  onClose: () => void
}

/** Privacy: never shows why an owner is away (MC etc.) — the API doesn't send it either. */
export function DeskPanel({ desk, onClose }: Props) {
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
    </aside>
  )
}
