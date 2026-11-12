import { translate, type Lang, type StringKey } from '../i18n/lang'
import type { FloorDesk, PersonRef } from '../api/contracts'

/** Who is physically at the desk: today's booking, else the owner if they're in (silent = in the office). */
export function seatedPerson(d: FloorDesk): PersonRef | null {
  return d.occupant ?? (d.state === 'occupied' ? d.owner : null)
}

/** Owner is out and nobody has taken the desk. Shows "Away" only — never the reason. */
export function ownerAway(d: FloorDesk): boolean {
  return d.state === 'available' && d.owner !== null && d.occupant === null
}

/** Can be taken right now. Mirrors the bookings API rule; the API still has the final say. */
export function isFree(d: FloorDesk): boolean {
  return d.state === 'available' || d.state === 'unassigned'
}

const centre = (d: FloorDesk) => ({ x: d.x + d.w / 2, y: d.y + d.h / 2 })
const dist = (a: FloorDesk, b: FloorDesk) => {
  const p = centre(a)
  const q = centre(b)
  return Math.hypot(p.x - q.x, p.y - q.y)
}

/** "Nearby" = within about three desk widths. */
const NEARBY_DESKS = 3
/** Score against the few closest teammates, so one teammate far away doesn't pull the pick off. */
const ANCHORS_PER_DESK = 3

export type SeatSuggestion =
  | { ok: true; desk: FloorDesk; note: string }
  | { ok: false; note: string; deskId?: string }

/**
 * Where should `me` sit? In order:
 * 1. already seated → say where;  2. own desk is free (said WFH, came in anyway) → take it back;
 * 3. the free desk closest to teammates sitting today, else to the team's own desks;
 * 4. no team desks at all → prefer an unowned hot desk over an absent colleague's desk.
 */
export function suggestSeat(desks: FloorDesk[], me: { id: string; team: string }, lang: Lang = 'en'): SeatSuggestion {
  const say = (key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars)
  const mine = desks.find((d) => seatedPerson(d)?.id === me.id)
  if (mine) return { ok: false, note: say('alreadyAt', { desk: mine.id }), deskId: mine.id }

  const free = desks.filter(isFree)
  if (free.length === 0) return { ok: false, note: say('noFreeNow') }

  const ownFree = free.find((d) => d.owner?.id === me.id)
  if (ownFree) return { ok: true, desk: ownFree, note: say('ownFree', { desk: ownFree.id }) }

  const teammatesIn = desks.filter((d) => {
    const p = seatedPerson(d)
    return p !== null && p.id !== me.id && p.team === me.team
  })
  const teamDesks = desks.filter((d) => d.owner?.team === me.team)
  const anchors = teammatesIn.length > 0 ? teammatesIn : teamDesks
  if (anchors.length === 0) {
    const desk = free.find((d) => d.owner === null) ?? free[0]
    return { ok: true, desk, note: say('noTeamDesks', { team: me.team }) }
  }

  const score = (d: FloorDesk) => {
    const nearest = anchors.map((a) => dist(d, a)).sort((x, y) => x - y).slice(0, ANCHORS_PER_DESK)
    return nearest.reduce((s, v) => s + v, 0) / nearest.length
  }
  const best = free
    .map((desk) => ({ desk, s: score(desk) }))
    .reduce((a, b) => (b.s < a.s ? b : a)).desk

  if (teammatesIn.length === 0) {
    return { ok: true, desk: best, note: say('noneIn', { team: me.team }) }
  }
  const nearby = teammatesIn.filter((d) => dist(best, d) <= NEARBY_DESKS * best.w).length
  const who = nearby === 1 ? say('oneMate') : say('manyMates', { n: nearby })
  return {
    ok: true,
    desk: best,
    note: nearby > 0 ? say('nearTeam', { team: me.team, who }) : say('nearToday', { team: me.team }),
  }
}
