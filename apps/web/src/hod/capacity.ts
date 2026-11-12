import type { FloorResponse, HodHeatmapResponse, HodTodayResponse } from '../api/contracts'
import { isFree } from '../theme/zones'

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const
const WEEKDAYS_PLURAL = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays'] as const

export interface TeamRow {
  team: string
  total: number
  /** Posted IN_OFFICE, or didn't post (silent = in the office since B's #6). */
  inOffice: number
  noUpdate: number
  wfh: number
  mc: number
  leave: number
  outstation: number
  away: number
}

export function teamRows(today: HodTodayResponse): TeamRow[] {
  return today.teams.map((t) => {
    const away = t.counts.WFH + t.counts.MC + t.counts.LEAVE + t.counts.OUTSTATION
    return {
      team: t.team,
      total: t.total,
      inOffice: t.counts.IN_OFFICE + t.noUpdate,
      noUpdate: t.noUpdate,
      wfh: t.counts.WFH,
      mc: t.counts.MC,
      leave: t.counts.LEAVE,
      outstation: t.counts.OUTSTATION,
      away,
    }
  })
}

export interface Capacity {
  staff: number
  desks: number
  /** Mean people in per past weekday, last 4 weeks. */
  avgIn: number
  /** Average occupancy % per weekday (Mon–Fri); null when there's no history for it. */
  byWeekday: (number | null)[]
  /** `day` is plural for prose ("Wednesdays"). */
  busiest: { day: string; pct: number } | null
  quietest: { day: string; pct: number } | null
  /**
   * More staff the floor can take with hot-seating before the busiest weekday runs out of desks,
   * assuming new people come in as often as current staff do. Conservative: sized on the peak day.
   */
  roomForMore: number
  freeNow: number
  /** No owner: can be given to a new joiner permanently, today. */
  unowned: number
  /** Free right now in the zone(s) where this team sits. */
  freeNearTeam: number
}

export function capacity(floor: FloorResponse, today: HodTodayResponse, heat: HodHeatmapResponse, team: string): Capacity {
  const staff = today.teams.reduce((s, t) => s + t.total, 0)
  const desks = heat.totalDesks
  const past = heat.weeks.flatMap((w) => w.days).filter((d) => d.inOffice !== null)
  const avgIn = past.length ? past.reduce((s, d) => s + (d.inOffice ?? 0), 0) / past.length : 0

  const byWeekday = WEEKDAYS.map((_, i) => {
    const days = heat.weeks.map((w) => w.days[i]).filter((d) => d && d.occupancy !== null)
    return days.length ? Math.round(days.reduce((s, d) => s + (d.occupancy ?? 0), 0) / days.length) : null
  })
  const ranked = byWeekday
    .map((pct, i) => ({ day: WEEKDAYS_PLURAL[i] as string, pct }))
    .filter((x): x is { day: string; pct: number } => x.pct !== null)
    .sort((a, b) => b.pct - a.pct)
  const busiest = ranked[0] ?? null
  const quietest = ranked.at(-1) ?? null

  // People in on the busiest weekday, scaled up until it hits the desk count.
  const peakIn = busiest ? (busiest.pct / 100) * desks : avgIn
  const roomForMore = peakIn > 0 && staff > 0 ? Math.max(0, Math.floor((desks * staff) / peakIn) - staff) : 0

  const teamZones = new Set(floor.desks.filter((d) => d.owner?.team === team).map((d) => d.zone))
  return {
    staff,
    desks,
    avgIn,
    byWeekday,
    busiest,
    quietest,
    roomForMore,
    freeNow: floor.desks.filter(isFree).length,
    unowned: floor.desks.filter((d) => !d.owner).length,
    freeNearTeam: floor.desks.filter((d) => isFree(d) && teamZones.has(d.zone)).length,
  }
}

/** Sequential bins for the heatmap (one hue, light → dark). Text colour flips on the dark steps. */
export function heatStep(pct: number): 1 | 2 | 3 | 4 | 5 {
  if (pct >= 95) return 5
  if (pct >= 85) return 4
  if (pct >= 70) return 3
  if (pct >= 50) return 2
  return 1
}
