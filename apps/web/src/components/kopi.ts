import type { FloorDesk, PersonRef } from '../api/contracts'
import { shortName } from './displayName'
import { seatedPerson } from './seating'
import { seatFeet, tripTo, type Point, type Walk } from './walking'

/**
 * Kopi Easter Egg (challenge round): click the KOPI counter in the pantry and the people from your
 * team who are in today walk over for a kopi, wait at the counter, then walk back to their desks.
 */

/** The KOPI counter + coffee machine on C's map (map px): the hidden hit area. */
export const KOPI_COUNTER = { x: 64, y: 648, w: 208, h: 92 }
/** Where the steam rises: above the coffee machine at the left end of the counter. */
export const KOPI_MACHINE: Point = { x: 102, y: 650 }
/** Where people stand: the open floor just north of the counter, facing it. Feet points. */
const KOPI_SPOTS: Point[] = [112, 142, 172, 202, 232, 262].map((x) => ({ x, y: 676 })) // over the counter (x 72–262)
const KOPI_WAIT_MS = 2500
/** Kopi is urgent: people hurry over (and back), so the whole run fits a live demo. */
const KOPI_SPEED = 360

export interface KopiRun {
  crew: { person: PersonRef; walk: Walk }[]
  message: string
}

const counterCentre: Point = { x: KOPI_COUNTER.x + KOPI_COUNTER.w / 2, y: KOPI_COUNTER.y }
const distToCounter = (d: FloorDesk) => {
  const f = seatFeet(d)
  return Math.hypot(f.x - counterCentre.x, f.y - counterCentre.y)
}

function joinNames(names: string[], total: number): string {
  const extra = total - names.length
  if (extra > 0) return `${names.join(', ')} and ${extra} other${extra === 1 ? '' : 's'}`
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Your teammates who are in today, up to one per spot: you first (if you're in), then nearest the
 * pantry. People already walking (arriving, leaving) sit this run out — redirecting them would lose
 * the stop at the counter.
 */
export function planKopiRun(desks: FloorDesk[], me: { id: string; team: string }, busy: Set<string> = new Set()): KopiRun {
  const team = desks.flatMap((d) => {
    const p = seatedPerson(d)
    return p && p.team === me.team ? [{ person: p, desk: d }] : []
  })
  if (team.length === 0) return { crew: [], message: `Jom kopi! …but nobody from ${me.team} is in today. Kopi sendiri? ☕` }

  const crew = team
    .filter((t) => !busy.has(t.person.id))
    .sort((a, b) => Number(b.person.id === me.id) - Number(a.person.id === me.id) || distToCounter(a.desk) - distToCounter(b.desk))
    .slice(0, KOPI_SPOTS.length)
  const runs = crew.map((c, i) => ({
    person: c.person,
    walk: tripTo(c.desk, KOPI_SPOTS[i], { ms: KOPI_WAIT_MS, face: 'down', bubble: '☕' }, KOPI_SPEED),
  }))

  // "You, Hafiz and Mei Ling" / "Hafiz, Mei Ling and 3 others": up to three names, you first.
  const youIn = team.some((t) => t.person.id === me.id)
  const others = team.filter((t) => t.person.id !== me.id).map((t) => shortName(t.person.name))
  const names = youIn ? ['You', ...others.slice(0, 2)] : others.slice(0, 3)
  const verb = team.length === 1 && !youIn ? 'is' : 'are'
  return { crew: runs, message: `Jom kopi! ${joinNames(names, team.length)} from ${me.team} ${verb} in today ☕` }
}
