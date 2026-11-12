import type { DeskState, PresenceStatus } from '../common/contracts';

export interface DeskStateInput {
  ownerId: string | null;
  /** Owner's presence for the day, or null if they haven't posted anything. */
  ownerStatus: PresenceStatus | null;
  /** User id on the desk's active (unreleased) booking for the day, if any. */
  bookedBy: string | null;
}

/**
 * Desk state is always derived, never stored. Keep this pure so it's trivial to test and change.
 *
 * Silence means "in the office": people only post in Slack when they're OUT (MC / AL / WFH /
 * outstation), never when they come in. So a desk is only freed when its owner says they're out.
 * (Team decision, 12 Nov: the earlier 10:00 auto-release freed desks of people sitting at them.)
 */
export function deriveDeskState({ ownerId, ownerStatus, bookedBy }: DeskStateInput): DeskState {
  if (bookedBy) return bookedBy === ownerId ? 'occupied' : 'hot-seated';
  if (!ownerId) return 'unassigned';
  if (!ownerStatus || ownerStatus === 'IN_OFFICE') return 'occupied';
  return 'available'; // owner said they're out (WFH / MC / LEAVE / OUTSTATION)
}
