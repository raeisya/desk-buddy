import { useCallback, useEffect, useState } from 'react'
import { CHARACTER_SHEET, type Direction } from '../theme/characters'
import { frameAt, poseAt, redirect, walkDuration, type Walk } from '../components/walking'

export interface WalkRequest {
  personId: string
  name: string
  walk: Walk
  /** Hide this person's seated sprite while walking (they're "away from the desk"). */
  hideSeated: boolean
}

interface ActiveWalk extends WalkRequest {
  startedAt: number
  durationMs: number
}

export interface WalkerView {
  personId: string
  name: string
  /** Top-left of the 32×48 frame, map px. */
  x: number
  y: number
  dir: Direction
  column: number
  /** Shown while stopped somewhere (e.g. "☕" at the kopi counter); replaces the name tag. */
  bubble?: string
}

const WALK_FPS = 8

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * People currently walking on the map. Drives a requestAnimationFrame clock only while someone is
 * walking; finished walks drop out by themselves (the seated sprite then shows again).
 */
export function useWalkers() {
  const [walks, setWalks] = useState<ActiveWalk[]>([])
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (walks.length === 0) return
    let raf = 0
    const tick = (t: number) => {
      setNow(t)
      setWalks((ws) => {
        const alive = ws.filter((w) => t - w.startedAt < w.durationMs)
        return alive.length === ws.length ? ws : alive
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [walks.length])

  /**
   * Start walks. Someone already walking who now heads back where they came from turns round from
   * where they are (no teleport). With reduced motion on, nobody walks: the map just updates.
   */
  const start = useCallback((requests: WalkRequest[]) => {
    if (requests.length === 0 || prefersReducedMotion()) return
    const t = performance.now()
    setNow(t)
    setWalks((ws) => {
      const current = new Map(ws.map((w) => [w.personId, w]))
      const fresh = requests.map((r) => {
        const old = current.get(r.personId)
        const walk = old ? redirect(old.walk, t - old.startedAt, r.walk) : r.walk
        return { ...r, walk, startedAt: t, durationMs: walkDuration(walk) }
      })
      const ids = new Set(requests.map((r) => r.personId))
      return [...ws.filter((w) => !ids.has(w.personId)), ...fresh]
    })
  }, [])

  /** Stop every walk (bulk reload: the map jumps straight to the new state). */
  const cancelAll = useCallback(() => setWalks((ws) => (ws.length ? [] : ws)), [])

  const { walk: walkFrames, idle } = CHARACTER_SHEET.frames
  const views: WalkerView[] = walks.map((w) => {
    const elapsed = now - w.startedAt
    const pose = poseAt(w.walk, elapsed)
    const column = pose.moving ? walkFrames[Math.floor((elapsed / 1000) * WALK_FPS) % walkFrames.length] : idle[0]
    const { x, y } = frameAt(pose.feet)
    return { personId: w.personId, name: w.name, x, y, dir: pose.dir, column, bubble: pose.bubble }
  })
  const hiddenSeated = new Set(walks.filter((w) => w.hideSeated).map((w) => w.personId))
  /** Everyone walking right now (e.g. so a kopi run can leave them out). */
  const walkingIds = new Set(walks.map((w) => w.personId))

  return { walkers: views, hiddenSeated, walkingIds, start, cancelAll }
}
