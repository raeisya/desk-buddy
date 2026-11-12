import type { DeskState, PresenceStatus } from '../common/contracts';

export interface DeskStateInput {
  ownerId: string | null;
  /** Owner's presence for the day, or null if they haven't posted anything. */
  ownerStatus: PresenceStatus | null;
  /** User id on the desk's active (unreleased) booking for the day, if any. */
  bookedBy: string | null;
  pastCutoff: boolean;
}

/** Desk state is always derived, never stored. Keep this pure so it's trivial to test and change. */
export function deriveDeskState({ ownerId, ownerStatus, bookedBy, pastCutoff }: DeskStateInput): DeskState {
  if (bookedBy) return bookedBy === ownerId ? 'occupied' : 'hot-seated';
  if (!ownerId) return 'unassigned';
  if (ownerStatus === 'IN_OFFICE') return 'occupied';
  if (ownerStatus) return 'available'; // owner is out (WFH / MC / LEAVE / OUTSTATION)
  return pastCutoff ? 'available' : 'away'; // silent owner: freed once the cutoff passes
}
