// API contracts shared with the frontend.
// COPY of apps/api/src/common/contracts.ts — KEEP IN SYNC (copy the whole file when it changes).

export const PRESENCE_STATUSES = ['IN_OFFICE', 'WFH', 'MC', 'LEAVE', 'OUTSTATION'] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export const PRESENCE_SOURCES = ['slack', 'manual', 'seed'] as const;
export type PresenceSource = (typeof PRESENCE_SOURCES)[number];

export const ROLES = ['staff', 'hod', 'admin'] as const;
export type Role = (typeof ROLES)[number];

// occupied   – owner is in: silent (no post = in the office), posted IN_OFFICE, or checked in to their own desk
// available  – owner said they're out (WFH/MC/LEAVE/OUTSTATION); free to claim
// hot-seated – someone other than the owner has an active booking today
// away       – NOT USED since 12 Nov (silent owners count as in the office; no auto-release). Kept so nothing breaks.
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

// HOD dashboard. Absence reasons (MC, leave…) are allowed here, never on the floor map.
export interface HodTeamToday {
  team: string;
  total: number;
  counts: Record<PresenceStatus, number>;
  /** No presence row yet today. */
  noUpdate: number;
}

export interface HodTodayResponse {
  date: string;
  teams: HodTeamToday[];
}

export interface HodHeatmapDay {
  date: string;
  /** People IN_OFFICE that day; null for today and future days. */
  inOffice: number | null;
  /** % of desks used (0–100, capped); null for today and future days. */
  occupancy: number | null;
}

// Admin page + permanent seats (C). Identity is the persona id in the body/query for now, like bookings.
export interface AdminUser extends UserSummary {
  active: boolean;
  /** Permanent desk, if any. */
  deskId: string | null;
}

export interface AdminUserPatch {
  team?: string;
  role?: Role;
  active?: boolean;
}

export interface HodHeatmapResponse {
  totalDesks: number;
  /** Oldest first; each week is Mon–Fri. */
  weeks: { weekStart: string; days: HodHeatmapDay[] }[];
}

export type StreamEvent =
  | { type: 'floor-changed'; date: string }
  | { type: 'clock-changed'; now: string };
