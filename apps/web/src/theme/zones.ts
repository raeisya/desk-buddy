import type { FloorDesk, UserSummary } from '../api/contracts'

/** Map image size in map pixels (desks.json coordinate space). */
export const MAP_W = 1280
export const MAP_H = 768

export const isFree = (d: FloorDesk) => d.state === 'available' || d.state === 'unassigned'

export interface Zone {
  name: string
  /** Crop box in map pixels, padded so name tags above/below the pod stay visible. */
  x: number
  y: number
  w: number
  h: number
  desks: FloorDesk[]
}

export function zonesOf(desks: FloorDesk[]): Zone[] {
  const byName = new Map<string, FloorDesk[]>()
  for (const d of desks) byName.set(d.zone, [...(byName.get(d.zone) ?? []), d])
  return [...byName]
    .map(([name, ds]) => {
      const x0 = Math.max(0, Math.min(...ds.map((d) => d.x)) - 24)
      const y0 = Math.max(0, Math.min(...ds.map((d) => d.y)) - 40)
      const x1 = Math.min(MAP_W, Math.max(...ds.map((d) => d.x + d.w)) + 24)
      const y1 = Math.min(MAP_H, Math.max(...ds.map((d) => d.y + d.h)) + 40)
      return { name, x: x0, y: y0, w: x1 - x0, h: y1 - y0, desks: ds }
    })
    .sort((a, b) => a.y - b.y || a.x - b.x) // floor order: top row left→right, then the next row
}

/** The zone holding most of this team's desks: the persona's "home" on the floor. */
export function homeZoneFor(zones: Zone[], team: string | undefined): string | undefined {
  if (!team) return undefined
  let best: Zone | undefined
  let bestCount = 0
  for (const z of zones) {
    const n = z.desks.filter((d) => d.owner?.team === team).length
    if (n > bestCount) [best, bestCount] = [z, n]
  }
  return best?.name
}

/** Free desks, nearest to the centre of the persona's team first (a simple "near your team"). */
export function rankSeats(desks: FloorDesk[], persona: UserSummary): FloorDesk[] {
  const team = desks.filter((d) => d.owner?.team === persona.team)
  const ref = team.length > 0 ? team : desks
  const cx = ref.reduce((s, d) => s + d.x + d.w / 2, 0) / ref.length
  const cy = ref.reduce((s, d) => s + d.y + d.h / 2, 0) / ref.length
  return desks
    .filter((d) => isFree(d) && d.owner?.id !== persona.id)
    .map((d) => ({ d, dist: Math.hypot(d.x + d.w / 2 - cx, d.y + d.h / 2 - cy) }))
    .sort((a, b) => a.dist - b.dist)
    .map((x) => x.d)
}
