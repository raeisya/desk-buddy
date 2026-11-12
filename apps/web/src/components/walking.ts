import type { FloorDesk } from '../api/contracts'
import { seatPosition, standPosition, type Direction } from '../theme/characters'
import { seatedPerson } from './seating'

/**
 * Walking routes on C's 1280×768 map, in map px, using FEET points (bottom-centre of the 32×48 frame).
 * Pods sit at x 96–416 / 480–800 / 864–1184, rows y 160/224 and 480/544, so people leave their chair
 * into the aisle beside their row, walk to the nearest vertical gap between pods, then along the
 * open strip below the bottom pods (the "hub" row) to the door. Nobody cuts through a desk.
 */
export interface Point {
  x: number
  y: number
}

/**
 * A walk is a stretch of one fixed ROUTE: the polyline from the door to a seat. `from`/`to` are
 * distances along it (0 = door, length = seat). Walking in is 0 → length, out is length → 0, so
 * someone who changes their mind any number of times just reverses from where they stand.
 */
export interface Walk {
  route: Point[]
  from: number
  to: number
}

export const WALK_SPEED = 200 // map px per second (a desk is 64 px)
const GAP_XS = [56, 448, 832, 1224] // left margin, between pod columns, right margin
const HUB_Y = 640 // open strip between the bottom pods and the pantry
export const DOOR: Point = { x: 640, y: 744 } // gap in the bottom wall
const AISLE_OFFSET = 28

// Frame top-left ↔ feet offset comes from C's standPosition(), the single source for the anchor.
const ANCHOR = standPosition(0, 0) // feet (0,0) → frame top-left

/** Feet → top-left of the 32×48 frame. */
export const frameAt = (feet: Point): Point => standPosition(feet.x, feet.y)

export function seatFeet(d: FloorDesk): Point {
  const s = seatPosition(d)
  return { x: s.x - ANCHOR.x, y: s.y - ANCHOR.y }
}

/** Aisle beside the person's row: above the pod for front-facing (top) rows, below for back-facing rows. */
function aisleY(d: FloorDesk): number {
  return d.facing === 'down' ? d.y - AISLE_OFFSET : d.y + d.h + AISLE_OFFSET
}

const nearestGap = (x: number) => GAP_XS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a))

/** Seat → aisle → nearest gap → hub row. Returns the waypoints after the seat. */
function seatToHub(d: FloorDesk): Point[] {
  const feet = seatFeet(d)
  const aisle = aisleY(d)
  if (aisle >= HUB_Y - 8) return [{ x: feet.x, y: HUB_Y }] // bottom row of the bottom pods: hub is right there
  const gap = nearestGap(feet.x)
  return [
    { x: feet.x, y: aisle },
    { x: gap, y: aisle },
    { x: gap, y: HUB_Y },
  ]
}

/** Door → hub row → gap → aisle → seat, for this desk. */
function routeTo(d: FloorDesk): Point[] {
  return [DOOR, { x: DOOR.x, y: HUB_Y }, ...[seatFeet(d), ...seatToHub(d)].reverse()]
}

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)
const routeLength = (route: Point[]) => route.slice(1).reduce((sum, p, i) => sum + dist(route[i], p), 0)

export function walkIn(d: FloorDesk): Walk {
  const route = routeTo(d)
  return { route, from: 0, to: routeLength(route) }
}

export function walkOut(d: FloorDesk): Walk {
  const route = routeTo(d)
  return { route, from: routeLength(route), to: 0 }
}

/** The open corridor between the top and bottom pods (y 304–464): clear from wall to wall. */
const inMiddleCorridor = (y: number) => y > 304 && y < 464

/**
 * Seated at desk A, moving to desk B. If both chairs open onto the same aisle, or both onto the middle
 * corridor, walk straight across it; otherwise down to the hub row, along it, and up to B. No door.
 */
export function walkBetween(a: FloorDesk, b: FloorDesk): Walk {
  const fa = seatFeet(a)
  const fb = seatFeet(b)
  const ya = aisleY(a)
  const yb = aisleY(b)
  const route =
    ya === yb || (inMiddleCorridor(ya) && inMiddleCorridor(yb))
      ? dedupe([fa, { x: fa.x, y: ya }, { x: fb.x, y: ya }, { x: fb.x, y: yb }, fb])
      : dedupe([fa, ...seatToHub(a), ...[...seatToHub(b)].reverse(), fb])
  return { route, from: 0, to: routeLength(route) }
}

const onHub = (p: Point) => Math.abs(p.y - HUB_Y) < 0.5
function dedupe(points: Point[]): Point[] {
  return points.filter((p, i) => i === 0 || dist(points[i - 1], p) > 0.5)
}

function dirOf(a: Point, b: Point): Direction {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

export function walkDuration(w: Walk): number {
  return (Math.abs(w.to - w.from) / WALK_SPEED) * 1000
}

/** The point `s` px along the route, and the segment it's on (for facing). */
function pointAlong(route: Point[], s: number): { p: Point; a: Point; b: Point } {
  let left = Math.max(0, s)
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]
    const b = route[i]
    const d = dist(a, b)
    if (left <= d || i === route.length - 1) {
      const f = d > 0 ? Math.min(1, left / d) : 0
      return { p: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, a, b }
    }
    left -= d
  }
  return { p: route[0], a: route[0], b: route[0] }
}

/** Distance along the route `ms` into the walk. */
const positionAt = (w: Walk, ms: number) => {
  const travelled = Math.min(Math.abs(w.to - w.from), (Math.max(0, ms) / 1000) * WALK_SPEED)
  return w.from + Math.sign(w.to - w.from) * travelled
}

export interface WalkPose {
  feet: Point
  dir: Direction
  moving: boolean
}

/** Where the walker is `ms` into the walk. */
export function poseAt(w: Walk, ms: number): WalkPose {
  const s = positionAt(w, ms)
  const { p, a, b } = pointAlong(w.route, s)
  const forward = w.to >= w.from
  const dir = dist(a, b) > 0 ? (forward ? dirOf(a, b) : dirOf(b, a)) : 'down'
  return { feet: p, dir, moving: ms < walkDuration(w) }
}

const sameRoute = (a: Point[], b: Point[]) =>
  a.length === b.length && a.every((p, i) => Math.abs(p.x - b[i].x) < 0.5 && Math.abs(p.y - b[i].y) < 0.5)

/** Index i of the segment route[i] → route[i+1] that contains distance s. */
function segmentIndex(route: Point[], s: number): number {
  let left = Math.max(0, s)
  for (let i = 0; i < route.length - 1; i++) {
    const d = dist(route[i], route[i + 1])
    if (left <= d) return i
    left -= d
  }
  return Math.max(0, route.length - 2)
}

/** From distance s on a route, the waypoints that get you onto the hub row (empty if already on it). */
function toHub(route: Point[], s: number): Point[] {
  const here = pointAlong(route, s).p
  if (onHub(here)) return []
  const i = segmentIndex(route, s)
  const lastHub = route.reduce((k, p, j) => (onHub(p) ? j : k), -1)
  if (lastHub < 0) return [] // no hub on this route (shouldn't happen)
  if (i >= lastHub) return route.slice(lastHub, i + 1).reverse() // seat side: go back towards the hub
  const firstAhead = route.findIndex((p, j) => j > i && onHub(p))
  return route.slice(i + 1, firstAhead + 1) // door side: go forward onto the hub
}

/** From the hub row to where `next` is heading: its seat (walking in) or the door (walking out). */
function fromHub(next: Walk): Point[] {
  const r = next.route
  if (next.to >= next.from) {
    const lastHub = r.reduce((k, p, j) => (onHub(p) ? j : k), -1)
    return r.slice(Math.max(0, lastHub))
  }
  const firstHub = r.findIndex(onHub)
  return r.slice(0, firstHub + 1).reverse()
}

/**
 * Someone mid-walk gets a new walk.
 * - Same route (took the desk, left, took it again…): carry on from where they stand towards the new end.
 * - Different route (switched desk, or left for the door from a switched route): walk from where they
 *   stand back onto the hub row along the route they're on, then to the new destination. No teleports.
 */
export function redirect(old: Walk, elapsedMs: number, next: Walk): Walk {
  const s = positionAt(old, elapsedMs)
  if (sameRoute(old.route, next.route)) return { route: next.route, from: s, to: next.to }
  const here = pointAlong(old.route, s).p
  const route = dedupe([here, ...toHub(old.route, s), ...fromHub(next)])
  return { route, from: 0, to: routeLength(route) }
}

export interface PresenceWalk {
  personId: string
  name: string
  walk: Walk
  /** 'in' walks hide the seated sprite until they arrive; 'out' walkers are no longer seated anyway. */
  direction: 'in' | 'out'
}

/** Above this many changes in one update it's a reload/reseed, not people arriving: don't animate. */
const MAX_ANIMATED_CHANGES = 6

/**
 * Who arrived or left between two floor snapshots → walks. Arrivals walk in from the door to their
 * seat; leavers walk from their old seat out of the door; someone moving desks walks across from A to B.
 */
export function presenceWalks(prev: FloorDesk[], next: FloorDesk[]): { walks: PresenceWalk[]; bulk: boolean } {
  const seatedIn = (desks: FloorDesk[]) => {
    const m = new Map<string, { desk: FloorDesk; name: string }>()
    for (const d of desks) {
      const p = seatedPerson(d)
      if (p) m.set(p.id, { desk: d, name: p.name })
    }
    return m
  }
  const before = seatedIn(prev)
  const after = seatedIn(next)

  const walks: PresenceWalk[] = []
  for (const [id, now] of after) {
    const was = before.get(id)
    if (!was) walks.push({ personId: id, name: now.name, walk: walkIn(now.desk), direction: 'in' })
    else if (was.desk.id !== now.desk.id) walks.push({ personId: id, name: now.name, walk: walkBetween(was.desk, now.desk), direction: 'in' })
  }
  for (const [id, was] of before) {
    if (!after.has(id)) walks.push({ personId: id, name: was.name, walk: walkOut(was.desk), direction: 'out' })
  }
  // A reload/reseed: don't animate, and the caller should stop any walks still in flight.
  return walks.length > MAX_ANIMATED_CHANGES ? { walks: [], bulk: true } : { walks, bulk: false }
}
