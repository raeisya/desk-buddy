import { useEffect, useRef } from 'react'
import type { FloorResponse, UserSummary } from '../api/contracts'
import { seatedPerson } from '../components/seating'
import { strollAlongAisle, strollBetween, walkDuration, type Point } from '../components/walking'
import type { Direction } from '../theme/characters'
import type { WalkRequest } from './useWalkers'

/**
 * Background life on the map, so the floor never looks frozen during the demo:
 * - John (HOD, no desk) is always on the floor, strolling from spot to spot and pausing at each.
 * - Chi Keen gets up now and then: chats along his aisle (💬) or paces, then sits back down.
 * Purely visual: nothing is saved. Skips anyone already walking (arriving, leaving, kopi run).
 */
const BOSS_ID = 'u-john'
const MINGLER_ID = 'u-khairul' // Chi Keen

/** Places John strolls between (feet points on C's map, map px). No bubble = just looking around. */
const BOSS_SPOTS: { at: Point; face: Direction; bubble?: string }[] = [
  { at: { x: 200, y: 676 }, face: 'down', bubble: '☕' }, // kopi counter
  { at: { x: 752, y: 690 }, face: 'right', bubble: '💧' }, // water cooler
  { at: { x: 1012, y: 636 }, face: 'down', bubble: '😌' }, // lounge sofa
  { at: { x: 352, y: 668 }, face: 'down', bubble: '📄' }, // printer
  { at: { x: 640, y: 392 }, face: 'up', bubble: '📝' }, // whiteboard, middle corridor
  { at: { x: 280, y: 392 }, face: 'up', bubble: '👀' }, // checking on the floor
  { at: { x: 1000, y: 392 }, face: 'down', bubble: '👀' },
  { at: { x: 150, y: 392 }, face: 'right' }, // corridor, west end
  { at: { x: 1130, y: 392 }, face: 'left' }, // corridor, east end
  { at: { x: 560, y: 640 }, face: 'down' }, // by the entrance
]

const STROLL_SPEED = 140 // slower than a walk to the door: browsing, not going anywhere
const rand = (min: number, max: number) => min + Math.random() * (max - min)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

export function useAmbientWalks(
  floor: FloorResponse | null,
  users: UserSummary[],
  walkingIds: Set<string>,
  start: (requests: WalkRequest[]) => void,
) {
  // Timers read the latest state through refs, so they don't restart on every floor update.
  const latest = useRef({ floor, users, walkingIds, start })
  latest.current = { floor, users, walkingIds, start }

  useEffect(() => {
    const timers: number[] = []
    const loop = (firstMs: number, everyMs: [number, number], step: () => void) => {
      const run = (ms: number) => {
        timers.push(
          window.setTimeout(() => {
            step()
            run(rand(...everyMs))
          }, ms),
        )
      }
      run(firstMs)
    }

    // John: one stroll after another, each starting where the last one ended, so he never leaves the map.
    // The next stroll takes over just before the current one ends (no blink between them).
    let here = pick(BOSS_SPOTS)
    const stroll = () => {
      const { users, start } = latest.current
      const john = users.find((u) => u.id === BOSS_ID)
      if (!john) return void timers.push(window.setTimeout(stroll, 2000)) // users not loaded yet
      const next = pick(BOSS_SPOTS.filter((s) => s !== here))
      const walk = strollBetween(here.at, next.at, { ms: rand(2500, 6000), face: next.face, bubble: next.bubble }, STROLL_SPEED)
      start([{ personId: john.id, name: john.name, hideSeated: false, takeOver: true, walk }])
      here = next
      timers.push(window.setTimeout(stroll, walkDuration(walk) - 150))
    }
    timers.push(window.setTimeout(stroll, 1000))

    loop(9000, [18000, 32000], () => {
      const { floor, walkingIds, start } = latest.current
      const desk = floor?.desks.find((d) => seatedPerson(d)?.id === MINGLER_ID)
      const person = desk && seatedPerson(desk)
      if (!desk || !person || walkingIds.has(person.id)) return // not in today, or already walking
      const chat = Math.random() < 0.6
      const x = desk.x + rand(-320, 320)
      const wait = chat
        ? { ms: 4000, face: (desk.facing === 'down' ? 'down' : 'up') as Direction, bubble: '💬' } // turned to the desks in his row
        : { ms: 1200, face: (Math.random() < 0.5 ? 'left' : 'right') as Direction } // pacing: a pause, then back
      start([{ personId: person.id, name: person.name, hideSeated: true, walk: strollAlongAisle(desk, x, wait, STROLL_SPEED) }])
    })

    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [])
}
