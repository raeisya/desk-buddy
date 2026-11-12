import { colourise, OUTLINE, SKINS, sitting, standing, type Avatar, type RGB, type RGBA } from './characterArt'

/**
 * Me-page status scenes, drawn in the browser in YOUR look. 48×32 native px at 3× → 144×96.
 * (Ported from the scene generator that produced the earlier PNGs; for C's 8 presets it matched them
 * byte for byte before they were removed in favour of this.)
 * Privacy: they show the REASON, so they're only used on your own Me page, never on the map.
 */
export type SceneName = 'wfh' | 'mc' | 'outstation' | 'leave'

const SW = 48
const SH = 32
const SCALE = 3
const INK: RGB = [OUTLINE[0], OUTLINE[1], OUTLINE[2]]
type Px = RGBA | null
type Canvas = RGBA[][]

const rgba = (c: RGB, a = 255): RGBA => [c[0], c[1], c[2], a]
const mix = (a: readonly number[], b: readonly number[], f: number): RGB => [
  Math.trunc(a[0] * (1 - f) + b[0] * f),
  Math.trunc(a[1] * (1 - f) + b[1] * f),
  Math.trunc(a[2] * (1 - f) + b[2] * f),
]
const canvas = (fill: RGB): Canvas => Array.from({ length: SH }, () => Array.from({ length: SW }, () => rgba(fill)))

/** Inclusive rectangle, clipped. */
function rect(cv: Canvas, x0: number, y0: number, x1: number, y1: number, c: RGB) {
  for (let y = Math.max(0, y0); y <= Math.min(SH - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(SW - 1, x1); x++) cv[y][x] = rgba(c)
}
function outlineRect(cv: Canvas, x0: number, y0: number, x1: number, y1: number, c: RGB) {
  rect(cv, x0, y0, x1, y1, INK)
  rect(cv, x0 + 1, y0 + 1, x1 - 1, y1 - 1, c)
}
function blit(cv: Canvas, px: Px[][], ox: number, oy: number) {
  px.forEach((row, y) =>
    row.forEach((c, x) => {
      if (!c || c[3] === 0) return
      const X = ox + x
      const Y = oy + y
      if (X < 0 || X >= SW || Y < 0 || Y >= SH) return
      cv[Y][X] = c[3] === 255 ? c : rgba(mix(cv[Y][X], c, c[3] / 255)) // shadow: blend
    }),
  )
}

/** colourise() plus pyjama stripes on shirt/pants, or a sick tint on the skin. */
function person(a: Avatar, rows: string[], opts: { pyjamas?: boolean; pale?: boolean } = {}): Px[][] {
  const px = colourise(rows, opts.pyjamas ? { ...a, shirt: [150, 176, 226] } : a)
  if (opts.pyjamas) {
    const light: RGBA = [226, 234, 248, 255]
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if ((ch === 't' || ch === 'a') && y % 2 === 0) px[y][x] = light
        else if (ch === 'p') px[y][x] = y % 2 ? [150, 176, 226, 255] : light
      }),
    )
  }
  if (opts.pale) {
    const sick = rgba(mix(SKINS[a.skin], [160, 205, 150], 0.42))
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch === 's' && (px[y][x] = sick)))
  }
  return px
}

function wfh(a: Avatar): Canvas {
  const cv = canvas([236, 226, 204]) // warm wall
  rect(cv, 0, 26, SW - 1, SH - 1, [176, 128, 90]) // wooden floor
  for (let x = 0; x < SW; x += 8) rect(cv, x, 26, x, SH - 1, [150, 108, 76])
  outlineRect(cv, 2, 3, 12, 11, [170, 210, 236]) // window
  rect(cv, 7, 4, 7, 10, INK)
  rect(cv, 3, 7, 11, 7, INK)
  blit(cv, person(a, sitting('down', a.style, 0), { pyjamas: true }), 16, 2) // striped pyjama top above the desk
  outlineRect(cv, 4, 22, 43, 24, [196, 146, 98]) // desk top
  outlineRect(cv, 6, 24, 41, 31, [164, 116, 76]) // desk front
  rect(cv, 7, 27, 40, 27, [140, 98, 64])
  outlineRect(cv, 6, 18, 13, 23, [176, 182, 196]) // laptop at the side
  rect(cv, 9, 20, 10, 21, [226, 230, 240])
  outlineRect(cv, 31, 19, 35, 23, [210, 90, 70]) // mug
  rect(cv, 32, 16, 32, 17, [255, 255, 255]) // steam
  rect(cv, 34, 15, 34, 16, [255, 255, 255])
  rect(cv, 41, 13, 41, 22, [90, 90, 100]) // desk lamp
  outlineRect(cv, 38, 10, 44, 13, [250, 214, 110])
  return cv
}

function mc(a: Avatar): Canvas {
  const cv = canvas([214, 206, 232]) // lilac bedroom
  rect(cv, 0, 27, SW - 1, SH - 1, [150, 130, 120])
  outlineRect(cv, 8, 9, 39, 17, [150, 100, 70]) // low headboard
  outlineRect(cv, 13, 13, 34, 18, [248, 248, 250]) // pillow
  blit(cv, person(a, sitting('down', a.style), { pale: true }), 16, 2)
  outlineRect(cv, 25, 5, 29, 7, [170, 220, 245]) // ice pack
  rect(cv, 25, 13, 27, 13, [250, 250, 250]) // thermometer
  rect(cv, 28, 13, 28, 13, [220, 50, 50])
  outlineRect(cv, 6, 17, 41, 28, [120, 170, 160]) // blanket, check pattern
  for (let y = 18; y < 28; y++) for (let x = 7; x < 41; x++) if ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0) cv[y][x] = rgba([140, 190, 178])
  rect(cv, 6, 29, 41, 29, [110, 80, 60])
  rect(cv, 33, 6, 33, 7, [120, 180, 240]) // sweat drop
  rect(cv, 32, 8, 34, 8, [120, 180, 240])
  for (const [x, y] of [[38, 4], [41, 1]]) {
    rect(cv, x, y, x + 2, y, INK) // "z"
    rect(cv, x + 1, y + 1, x + 1, y + 1, INK)
    rect(cv, x, y + 2, x + 2, y + 2, INK)
  }
  return cv
}

function outstation(a: Avatar): Canvas {
  const cv = canvas([226, 222, 204]) // bus wall
  outlineRect(cv, 0, 3, SW - 1, 13, [172, 212, 236]) // windows
  for (const x of [12, 24, 36]) rect(cv, x, 3, x, 13, INK)
  rect(cv, 1, 11, SW - 2, 12, [120, 178, 110]) // trees going by
  for (const x of [5, 17, 29, 41]) rect(cv, x, 9, x + 2, 11, [90, 150, 90])
  rect(cv, 0, 0, SW - 1, 1, [196, 60, 52]) // red trim
  rect(cv, 0, 27, SW - 1, SH - 1, [84, 86, 96]) // floor
  rect(cv, 0, 27, SW - 1, 27, [236, 200, 70]) // yellow edge strip
  outlineRect(cv, 36, 16, 46, 26, [60, 110, 170]) // seat

  const rows = standing('down', a.style, 'n').map((r) => [...r])
  for (const y of [11, 12, 13, 14]) if (rows[y][3] === 'a' || rows[y][3] === 's') rows[y][3] = '.' // drop the hanging arm
  for (let y = 5; y < 11; y++) rows[y][2] = 'a' // sleeve going up
  rows[4][2] = 's' // hand
  const px = person(a, rows.map((r) => r.join('')))
  const ox = 15
  const oy = 4
  const poleX = ox + 2
  rect(cv, poleX, 0, poleX, 27, [186, 192, 204]) // pole
  rect(cv, poleX + 1, 0, poleX + 1, 27, [150, 156, 170])
  rect(cv, 0, 2, SW - 1, 2, [186, 192, 204]) // ceiling rail
  blit(cv, px, ox, oy)
  cv[oy + 4][poleX] = rgba(SKINS[a.skin]) // hand wraps the pole
  const hx = ox + 12
  const hy = oy + 14
  rect(cv, hx - 1, hy + 1, hx + 2, hy + 1, [90, 60, 40]) // bag handle
  outlineRect(cv, hx - 2, hy + 2, hx + 3, hy + 8, [150, 98, 56]) // bag
  rect(cv, hx - 1, hy + 4, hx + 2, hy + 4, [120, 76, 44])
  return cv
}

function leave(a: Avatar): Canvas {
  const cv = canvas([150, 206, 240]) // sky
  rect(cv, 0, 12, SW - 1, 17, [60, 140, 200]) // sea
  for (let x = 2; x < SW; x += 7) rect(cv, x, 14, x + 2, 14, [190, 228, 246])
  rect(cv, 0, 18, SW - 1, SH - 1, [240, 214, 150]) // sand
  for (const [x, y] of [[6, 24], [13, 29], [30, 27], [42, 23], [37, 30]]) cv[y][x] = rgba([214, 184, 120])
  outlineRect(cv, 38, 1, 44, 7, [255, 214, 80]) // sun
  rect(cv, 9, 8, 9, 27, [120, 100, 90]) // umbrella pole
  for (let x = 1; x < 18; x++) {
    const top = 4 + Math.floor(Math.abs(x - 9) / 3)
    for (let y = top; y < 8; y++) cv[y][x] = rgba(Math.floor(x / 3) % 2 === 0 ? [230, 70, 60] : [250, 246, 240])
  }
  rect(cv, 1, 8, 17, 8, INK)

  const rows = standing('down', a.style, 'n').map((r) => [...r])
  for (let x = 4; x < 12; x++) if (rows[6][x] === 's' || rows[6][x] === 'e') rows[6][x] = 'e' // sunglasses
  const flat = rows.map((r) => r.join(''))
  const px = colourise(flat, { ...a, shirt: [240, 140, 70] }) // holiday shirt
  flat.forEach((row, y) => [...row].forEach((ch, x) => ch === 't' && (x + y) % 3 === 0 && (px[y][x] = [255, 236, 120, 255])))
  const ox = 22
  const oy = 6
  blit(cv, px, ox, oy)
  const hx = ox + 12
  const hy = oy + 13
  outlineRect(cv, hx, hy - 1, hx + 3, hy + 2, [130, 90, 50]) // coconut
  rect(cv, hx + 2, hy - 4, hx + 2, hy - 2, [240, 80, 120]) // straw
  return cv
}

const DRAW: Record<SceneName, (a: Avatar) => Canvas> = { wfh, mc, outstation, leave }

/** RGBA bytes at 3× (144×96). */
export function scenePixels(name: SceneName, a: Avatar): { width: number; height: number; data: Uint8ClampedArray } {
  const cv = DRAW[name](a)
  const width = SW * SCALE
  const height = SH * SCALE
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++)
      for (let sy = 0; sy < SCALE; sy++)
        for (let sx = 0; sx < SCALE; sx++) data.set(cv[y][x], ((y * SCALE + sy) * width + x * SCALE + sx) * 4)
  return { width, height, data }
}

const cache = new Map<string, string>()
const MAX_CACHED = 32 // a few scenes × your recent looks; oldest out first

/** Data URL of a scene in this look, drawn once and cached. */
export function sceneUrl(name: SceneName, a: Avatar): string {
  const key = `${name}|${JSON.stringify(a)}`
  const hit = cache.get(key)
  if (hit) return hit
  const { width, height, data } = scenePixels(name, a)
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(width, height)
  img.data.set(data)
  ctx.putImageData(img, 0, 0)
  const url = c.toDataURL('image/png')
  cache.set(key, url)
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!)
  return url
}
