import type { FloorDesk } from '../api/contracts'
import { seatPosition, type Direction } from '../theme/characters'
import { seatedPerson } from './seating'

/**
 * Walking routes on C's 1280×768 map, in map px, using FEET points (bottom-centre of the 32×48 frame).
 * Pods sit at x 96–416 / 480–800 / 864–1184, rows y 160/224 and 480/544, so people leave their chair
 * into the aisle beside their row, walk to the nearest vertical gap between pods, then along the
 * open strip below the bottom pods (the "hub" row) to wherever they're going. Nobody cuts through a desk.
 */
export interface Point {
  x: number
  y: number
}

export type Step =
  | { kind: 'move'; to: Point }
  | { kind: 'wait'; ms: number; face: Direction; bubble?: string }

export interface Walk {
  start: Point
  steps: Step[]
}

export const WALK_SPEED = 200 // map px per second (a desk is 64 px)
const GAP_XS = [56, 448, 832, 1224] // left margin, between pod columns, right margin
const HUB_Y = 640 // open strip between the bottom pods and the pantry
export const DOOR: Point = { x: 640, y: 744 } // gap in the bottom wall
const AISLE_OFFSET = 28

export function seatFeet(d: FloorDesk): Point {
  const s = seatPosition(d)
  return { x: s.x + 16, y: s.y + 44 }
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

const moves = (points: Point[]): Step[] => points.map((to) => ({ kind: 'move', to }))

export function walkOut(d: FloorDesk): Walk {
  return { start: seatFeet(d), steps: moves([...seatToHub(d), { x: DOOR.x, y: HUB_Y }, DOOR]) }
}

export function walkIn(d: FloorDesk): Walk {
  const back = [seatFeet(d), ...seatToHub(d), { x: DOOR.x, y: HUB_Y }].reverse()
  return { start: DOOR, steps: moves(back) }
}

/** Seat → spot → wait (with a bubble) → back to the seat. */
export function roundTrip(d: FloorDesk, spot: Point, waitMs: number, face: Direction, bubble?: string): Walk {
  const there = [...seatToHub(d), { x: spot.x, y: HUB_Y }, spot]
  const back = [seatFeet(d), ...seatToHub(d), { x: spot.x, y: HUB_Y }].reverse()
  return { start: seatFeet(d), steps: [...moves(there), { kind: 'wait', ms: waitMs, face, bubble }, ...moves(back)] }
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
  for (const s of w.steps) {
    if (s.kind === 'move') {
      total += segMs(at, s.to)
      at = s.to
    } else total += s.ms
  }
  return total
}

export interface WalkPose {
  feet: Point
  dir: Direction
  moving: boolean
  bubble?: string
}

/** Where the walker is `ms` into the walk. */
export function poseAt(w: Walk, ms: number): WalkPose {
  let at = w.start
  let left = Math.max(0, ms)
  let lastDir: Direction = 'down'
  for (const s of w.steps) {
    if (s.kind === 'move') {
      const d = segMs(at, s.to)
      const dir: Direction = d > 0 ? dirOf(at, s.to) : lastDir
      if (left < d) {
        const f = left / d
        return { feet: { x: at.x + (s.to.x - at.x) * f, y: at.y + (s.to.y - at.y) * f }, dir, moving: true }
      }
      left -= d
      at = s.to
      lastDir = dir
    } else {
      if (left < s.ms) return { feet: at, dir: s.face, moving: false, bubble: s.bubble }
      left -= s.ms
    }
  }
  return { feet: at, dir: lastDir, moving: false }
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
