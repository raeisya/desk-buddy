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

/** A walk: start here, then straight lines through each waypoint in turn. */
export interface Walk {
  start: Point
  path: Point[]
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

export function walkOut(d: FloorDesk): Walk {
  return { start: seatFeet(d), path: [...seatToHub(d), { x: DOOR.x, y: HUB_Y }, DOOR] }
}

export function walkIn(d: FloorDesk): Walk {
  return { start: DOOR, path: [seatFeet(d), ...seatToHub(d), { x: DOOR.x, y: HUB_Y }].reverse() }
}

const segMs = (a: Point, b: Point) => (Math.hypot(b.x - a.x, b.y - a.y) / WALK_SPEED) * 1000

function dirOf(a: Point, b: Point): Direction {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

export function walkDuration(w: Walk): number {
  let at = w.start
  let total = 0
  for (const to of w.path) {
    total += segMs(at, to)
    at = to
  }
  return total
}

export interface WalkPose {
  feet: Point
  dir: Direction
  moving: boolean
}

/** Where the walker is `ms` into the walk. */
export function poseAt(w: Walk, ms: number): WalkPose {
  let at = w.start
  let left = Math.max(0, ms)
  let lastDir: Direction = 'down'
  for (const to of w.path) {
    const d = segMs(at, to)
    const dir: Direction = d > 0 ? dirOf(at, to) : lastDir
    if (left < d) {
      const f = left / d
      return { feet: { x: at.x + (to.x - at.x) * f, y: at.y + (to.y - at.y) * f }, dir, moving: true }
    }
    left -= d
    at = to
    lastDir = dir
  }
  return { feet: at, dir: lastDir, moving: false }
}

const same = (a: Point, b: Point) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5
const end = (w: Walk): Point => w.path[w.path.length - 1] ?? w.start

/**
 * Someone mid-walk gets a new walk. If it heads back where they came from (walking in, then they
 * leave — or the reverse), turn round and retrace the route walked so far, from where they are now,
 * instead of teleporting to the chair or the door. Otherwise the new walk replaces the old one.
 */
export function redirect(old: Walk, elapsedMs: number, next: Walk): Walk {
  if (!same(end(next), old.start)) return next
  const here = poseAt(old, elapsedMs).feet
  const walked: Point[] = [old.start]
  let at = old.start
  let left = Math.max(0, elapsedMs)
  for (const to of old.path) {
    const d = segMs(at, to)
    if (left < d) break
    left -= d
    at = to
    walked.push(at)
  }
  return { start: here, path: walked.reverse() }
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
 * seat; leavers walk from their old seat out of the door. Someone moving desks walks in to the new one.
 */
export function presenceWalks(prev: FloorDesk[], next: FloorDesk[]): PresenceWalk[] {
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
    if (!was || was.desk.id !== now.desk.id) walks.push({ personId: id, name: now.name, walk: walkIn(now.desk), direction: 'in' })
  }
  for (const [id, was] of before) {
    if (!after.has(id)) walks.push({ personId: id, name: was.name, walk: walkOut(was.desk), direction: 'out' })
  }
  return walks.length > MAX_ANIMATED_CHANGES ? [] : walks
}
