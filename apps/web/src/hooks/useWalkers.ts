import { useCallback, useEffect, useState } from 'react'
import { CHARACTER_SHEET, type Direction } from '../theme/characters'
import { poseAt, walkDuration, type Walk } from '../components/walking'

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
  bubble?: string
}

const WALK_FPS = 8

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

  /** Start walks; a new walk for someone already walking replaces theirs. */
  const start = useCallback((requests: WalkRequest[]) => {
    if (requests.length === 0) return
    const t = performance.now()
    const ids = new Set(requests.map((r) => r.personId))
    setNow(t)
    setWalks((ws) => [
      ...ws.filter((w) => !ids.has(w.personId)),
      ...requests.map((r) => ({ ...r, startedAt: t, durationMs: walkDuration(r.walk) })),
    ])
  }, [])

  const { walk: walkFrames, idle } = CHARACTER_SHEET.frames
  const views: WalkerView[] = walks.map((w) => {
    const elapsed = now - w.startedAt
    const pose = poseAt(w.walk, elapsed)
    const column = pose.moving ? walkFrames[Math.floor((elapsed / 1000) * WALK_FPS) % walkFrames.length] : idle[0]
    return { personId: w.personId, name: w.name, x: pose.feet.x - 16, y: pose.feet.y - 44, dir: pose.dir, column, bubble: pose.bubble }
  })
  const hiddenSeated = new Set(walks.filter((w) => w.hideSeated).map((w) => w.personId))

  return { walkers: views, hiddenSeated, start }
}
