import type { PresenceStatus, Role } from '../common/contracts';

/**
 * Rule-based fake attendance for the past 4 weeks (20 weekdays before `today`),
 * so the HOD heatmap has a month of patterns. Deterministic: same input → same rows.
 *
 * Rates are a share of PEOPLE, tuned to 80 people / 60 desks:
 * Tue/Wed ≈ 58 in (near full), Fri ≈ 30 in (half the desks idle).
 */
const IN_OFFICE_RATE: Record<number, number> = { 1: 0.62, 2: 0.72, 3: 0.72, 4: 0.62, 5: 0.38 }; // Mon..Fri
const SENIOR_PENALTY = 0.2; // HODs/admins WFH more
const SICK_OR_LEAVE_RATE = 0.03;
const OUTSTATION_USER = 'u-weijie'; // outstation every Thursday
const MC_CLUSTER_SIZE = 6; // flu week: 6 people on MC Mon–Wed, two weeks back

export interface HistoryRow {
  userId: string;
  date: string;
  status: PresenceStatus;
}

const DAY_MS = 86_400_000;
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

/** The 20 weekdays strictly before `today` (YYYY-MM-DD), oldest first. */
export function pastWeekdays(today: string, count = 20): string[] {
  const out: string[] = [];
  for (let t = toDate(today).getTime() - DAY_MS; out.length < count; t -= DAY_MS) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) out.unshift(fmt(new Date(t)));
  }
  return out;
}

/** Stable pseudo-random number in [0, 1) for a string key (FNV-1a hash). */
function rand(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  // murmur3 finalizer: spreads small key differences (e.g. adjacent dates) across all bits
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

export function generateHistory(users: { id: string; role: Role }[], today: string): HistoryRow[] {
  const dates = pastWeekdays(today);

  // Flu week = Mon–Wed of the week two weeks before this one.
  const t = toDate(today);
  const thisMonday = t.getTime() - ((t.getUTCDay() + 6) % 7) * DAY_MS;
  const clusterDays = new Set([0, 1, 2].map((i) => fmt(new Date(thisMonday - 14 * DAY_MS + i * DAY_MS))));
  const clusterUsers = new Set(
    users
      .filter((u) => u.id !== OUTSTATION_USER)
      .sort((a, b) => rand(`mc:${a.id}`) - rand(`mc:${b.id}`))
      .slice(0, MC_CLUSTER_SIZE)
      .map((u) => u.id),
  );

  const rows: HistoryRow[] = [];
  for (const date of dates) {
    const weekday = toDate(date).getUTCDay();
    for (const u of users) {
      let status: PresenceStatus;
      const r = rand(`${u.id}:${date}`);
      if (u.id === OUTSTATION_USER && weekday === 4) status = 'OUTSTATION';
      else if (clusterDays.has(date) && clusterUsers.has(u.id)) status = 'MC';
      else if (r < SICK_OR_LEAVE_RATE) status = r < SICK_OR_LEAVE_RATE / 2 ? 'MC' : 'LEAVE';
      else {
        const senior = u.role === 'hod' || u.role === 'admin';
        const rate = IN_OFFICE_RATE[weekday] - (senior ? SENIOR_PENALTY : 0);
        status = rand(`in:${u.id}:${date}`) < rate ? 'IN_OFFICE' : 'WFH';
      }
      rows.push({ userId: u.id, date, status });
    }
  }
  return rows;
}
