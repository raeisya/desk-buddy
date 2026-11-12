// API contracts shared with the frontend.
// KEEP IN SYNC with apps/web/src/api/contracts.ts (copy the whole file when it changes).

export const PRESENCE_STATUSES = ['IN_OFFICE', 'WFH', 'MC', 'LEAVE', 'OUTSTATION'] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export const PRESENCE_SOURCES = ['slack', 'manual', 'seed'] as const;
export type PresenceSource = (typeof PRESENCE_SOURCES)[number];

export const ROLES = ['staff', 'hod', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// occupied   – owner is in (posted IN_OFFICE or checked in to their own desk)
// available  – owner is out (WFH/MC/LEAVE/OUTSTATION) or no-show after the release cutoff; free to claim
// hot-seated – someone other than the owner has an active booking today
// away       – owner hasn't said anything yet and it's before the release cutoff (not claimable yet)
// unassigned – no owner and no booking; free to claim
export const DESK_STATES = ['occupied', 'available', 'hot-seated', 'away', 'unassigned'] as const;
export type DeskState = (typeof DESK_STATES)[number];

// Which way the seated person looks (towards their monitor), in map space.
// 'down' = chair in the top half of the desk cell, desk in the bottom half; 'up' = the reverse.
export const DESK_FACINGS = ['up', 'down'] as const;
export type DeskFacing = (typeof DESK_FACINGS)[number];

export interface PersonRef {
  id: string;
  name: string;
  team: string;
}

export interface FloorDesk {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zone: string;
  facing: DeskFacing;
  state: DeskState;
  owner: PersonRef | null;
  /** Who is sitting there today via a booking (owner or hot-seater). */
  occupant: PersonRef | null;
  // Privacy: the owner's absence *reason* (MC, leave…) is deliberately NOT exposed here.
  // HOD-only endpoints may return it.
}

export interface FloorResponse {
  date: string; // YYYY-MM-DD, Asia/Kuala_Lumpur
  now: string; // ISO timestamp of the (demo) clock
  releaseCutoff: string; // HH:MM
  desks: FloorDesk[];
}

export interface UserSummary extends PersonRef {
  role: Role;
}

export interface ClockResponse {
  now: string;
  today: string;
  localTime: string;
  releaseCutoff: string;
  isDemoTime: boolean;
}

export type StreamEvent =
  | { type: 'floor-changed'; date: string }
  | { type: 'clock-changed'; now: string };
