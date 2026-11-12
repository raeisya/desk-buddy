import type { DeskState } from '../api/contracts'

export const DESK_STATE_STYLE: Record<DeskState, { label: string; color: string }> = {
  available: { label: 'Available', color: 'var(--desk-available)' },
  unassigned: { label: 'Free (unassigned)', color: 'var(--desk-unassigned)' },
  'hot-seated': { label: 'Hot-seated', color: 'var(--desk-hot)' },
  away: { label: 'Owner not in yet', color: 'var(--desk-away)' },
  occupied: { label: 'Occupied', color: 'var(--desk-occupied)' },
}
