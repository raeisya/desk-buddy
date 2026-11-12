import type { AvatarConfig, FloorResponse, HairStyle as ContractHairStyle, PantsColour as ContractPants, PersonRef, SkinTone as ContractSkin } from '../api/contracts'
import { CHARACTER_SHEET, frameStyle, variantFor, type Direction } from '../theme/characters'

/**
 * C's character generator (scripts/generate-characters.py), ported to the browser so any look can be
 * drawn on the fly: same text patterns, palette, outline and frame layout. Pixel-for-pixel identical
 * to /sprites/characters.png for the 8 preset variants (checked in the browser against that sheet).
 *
 * One sheet per look: 8 columns (0 idle | 1–4 walk | 5 sit | 6–7 type) × 4 rows (down, left, right, up),
 * 16×24 native px per frame, drawn at 2× → 256×192 px. Cached as a data URL per look.
 *
 * Only CUSTOM looks are drawn here. C's 8 presets keep using her static sheet (/sprites/characters.png):
 * no canvas needed, so default characters still show in browsers that block canvas read-back
 * (Brave, Firefox strict, Tor) or have no 2D context. If C edits the Python patterns, update these too.
 */

export type RGB = readonly [number, number, number]
export type RGBA = readonly [number, number, number, number]

export const SKINS = {
  light: [255, 219, 180],
  medlight: [241, 194, 150],
  tan: [214, 160, 116],
  brown: [176, 120, 82],
  deep: [130, 86, 58],
} as const satisfies Record<ContractSkin, RGB>
export const PANTS = {
  navy: [52, 60, 96],
  charcoal: [64, 64, 72],
  khaki: [150, 130, 96],
  black: [40, 40, 48],
} as const satisfies Record<ContractPants, RGB>
// The server validates against the contracts' lists; drawing must cover exactly those.
export type HairStyle = ContractHairStyle
export type SkinTone = ContractSkin
export type PantsColour = ContractPants

export interface Avatar {
  style: HairStyle
  /** Hair colour, or hijab colour. */
  hair: RGB
  skin: SkinTone
  shirt: RGB
  pants: PantsColour
}

const HAIR = { black: [40, 36, 44], dkbrown: [78, 52, 40], brown: [120, 80, 50] } as const satisfies Record<string, RGB>

/** C's 8 looks, in sheet order (variant index = position). */
export const PRESET_AVATARS: readonly Avatar[] = [
  { style: 'short', hair: HAIR.black, skin: 'medlight', shirt: [70, 130, 200], pants: 'navy' },
  { style: 'hijab', hair: [150, 60, 90], skin: 'tan', shirt: [236, 228, 206], pants: 'charcoal' },
  { style: 'short', hair: HAIR.black, skin: 'light', shirt: [90, 160, 100], pants: 'khaki' },
  { style: 'long', hair: HAIR.black, skin: 'light', shirt: [220, 170, 60], pants: 'navy' },
  { style: 'short', hair: HAIR.dkbrown, skin: 'brown', shirt: [150, 156, 170], pants: 'black' },
  { style: 'hijab', hair: [60, 140, 140], skin: 'medlight', shirt: [160, 140, 200], pants: 'charcoal' },
  { style: 'short', hair: HAIR.black, skin: 'deep', shirt: [200, 80, 70], pants: 'navy' },
  { style: 'long', hair: HAIR.brown, skin: 'tan', shirt: [230, 130, 60], pants: 'charcoal' },
]

// ── C's patterns (verbatim) ──────────────────────────────────────────────────
const SCALE = 2 // native art is drawn at 2× (C's generator)
const FW = CHARACTER_SHEET.frameWidth / SCALE // 16
const FH = CHARACTER_SHEET.frameHeight / SCALE // 24
const COLS = CHARACTER_SHEET.columns // 8
const DIRS: readonly Direction[] = CHARACTER_SHEET.directions
export const OUTLINE: RGBA = [34, 32, 52, 255]
const SHADOW: RGBA = [0, 0, 0, 70]
const E = '................'

const HEAD: Record<string, string[]> = {
  'down/short': [E, E, '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....hssssssh....', '....ssessess....', '....ssssssss....', '.....ssssss.....', '.......ss.......'],
  'up/short': [E, E, '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '....shhhhhhs....', '.....hhhhhh.....', '.......ss.......'],
  'left/short': [E, E, '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....sssshhhh....', '....sesshhhh....', '....ssssshhh....', '.....sssss......', '.......ss.......'],
  'down/hijab': [E, E, '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....hssssssh....', '....hsessesh....', '....hssssssh....', '....hhsssshh....', '...hhhhhhhhhh...'],
  'up/hijab': [E, E, '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '...hhhhhhhhhh...'],
  'left/hijab': [E, E, '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....ssshhhhh....', '....seshhhhh....', '....ssshhhhh....', '....hhhhhhhh....', '....hhhhhhhhh...'],
}
const mirror = (rows: string[]) => rows.map((r) => [...r].reverse().join(''))
for (const style of ['short', 'hijab']) HEAD[`right/${style}`] = mirror(HEAD[`left/${style}`])

const ARM = '...a' + 't'.repeat(8) + 'a...'
const TORSO_FRONT = ['....tttttttt....', ARM, ARM, ARM, '...s' + 't'.repeat(8) + 's...', '....pppppppp....']
const TORSO_SIDE: Record<number, string[]> = {
  0: ['.....tttttt.....', '.....tttttt.....', '.....ttaatt.....', '.....ttaatt.....', '.....ttaatt.....', '.....ppsspp.....'],
  1: ['.....tttttt.....', '.....tttttt.....', '.....taattt.....', '.....taattt.....', '....staattt.....', '....sppppp......'],
  [-1]: ['.....tttttt.....', '.....tttttt.....', '.....tttaat.....', '.....tttaat.....', '.....tttaats....', '.....ppppps.....'],
}
const LEGS_FRONT: Record<string, string[]> = {
  n: [...Array(4).fill('....ppp..ppp....'), '....bbb..bbb....', '.....xxxxxx.....'],
  l: ['....ppp..ppp....', '....ppp..ppp....', '....ppp..bbb....', '....ppp.........', '....bbb.........', '.....xxxxxx.....'],
  r: ['....ppp..ppp....', '....ppp..ppp....', '....bbb..ppp....', '.........ppp....', '.........bbb....', '.....xxxxxx.....'],
}
const LEGS_SIDE: Record<string, string[]> = {
  n: ['.....pppppp.....', '......pppp......', '......pppp......', '......pppp......', '.....bbbbb......', '.....xxxxxx.....'],
  a: ['.....pppppp.....', '.....pp..pp.....', '....pp....pp....', '....pp....pp....', '...bbb....bbb...', '....xxxxxxxx....'],
  b: ['.....pppppp.....', '......pppp......', '.....pp.pp......', '.....pp.pp......', '....bbbbbb......', '.....xxxxxx.....'],
}

export function standing(direction: Direction, style: HairStyle, legs: string, swing = 0): string[] {
  const head = HEAD[`${direction}/${style === 'long' ? 'short' : style}`]
  let torso: string[]
  let leg: string[]
  if (direction === 'down' || direction === 'up') {
    torso = TORSO_FRONT
    leg = LEGS_FRONT[legs]
  } else {
    torso = TORSO_SIDE[swing]
    leg = LEGS_SIDE[legs]
    if (direction === 'right') {
      torso = mirror(torso)
      leg = mirror(leg)
    }
  }
  const rows = [...head, ...torso, ...leg, E, E].map((r) => [...r])
  if (style === 'long') {
    if (direction === 'down') for (let y = 4; y < 12; y++) rows[y][3] = rows[y][12] = 'h'
    else if (direction === 'up') for (let y = 5; y < 12; y++) for (let x = 4; x < 12; x++) rows[y][x] = 'h'
    else {
      const [x0, x1] = direction === 'left' ? [8, 12] : [4, 8]
      for (let y = 5; y < 12; y++) for (let x = x0; x < x1; x++) rows[y][x] = 'h'
    }
  }
  if (style === 'hijab' && (direction === 'down' || direction === 'up')) rows[10] = [...'...hhhhhhhhhh...']
  return rows.map((r) => r.join(''))
}

export function sitting(direction: Direction, style: HairStyle, typing: 0 | 1 | null = null): string[] {
  const upper = standing(direction, style, 'n').slice(0, 16)
  if (direction === 'down' || direction === 'up') {
    const rows = [E, E, E, ...upper, E, E, E, E, E].map((r) => [...r])
    rows[18] = [...E]
    if (typing !== null && direction === 'down') {
      rows[17][3] = rows[17][12] = 't'
      const [up, down] = typing === 0 ? [4, 11] : [11, 4]
      rows[18][down] = 's'
      rows[16][up] = 's'
    } else if (typing !== null) {
      rows[16][typing === 0 ? 2 : 13] = 'a'
      rows[17][typing === 0 ? 2 : 13] = 's'
    }
    return rows.map((r) => r.join(''))
  }
  const rows = [E, E, E, ...upper, '...ppppppp......', '...pp...........', '...bb...........', E, E]
  return direction === 'right' ? [...rows.slice(0, 19), ...mirror(rows.slice(19))] : rows
}

/** C's check(): every frame is exactly FH rows of FW chars, or the art silently breaks. */
function check(rows: string[], label: string): string[] {
  if (rows.length !== FH || rows.some((r) => r.length !== FW)) throw new Error(`characterArt: bad frame ${label}`)
  return rows
}

function framesFor(direction: Direction, style: HairStyle): string[][] {
  const walk =
    direction === 'down' || direction === 'up'
      ? ['l', 'n', 'r', 'n'].map((k) => standing(direction, style, k))
      : [standing(direction, style, 'a', 1), standing(direction, style, 'n', 0), standing(direction, style, 'b', -1), standing(direction, style, 'n', 0)]
  return [standing(direction, style, 'n'), ...walk, sitting(direction, style), sitting(direction, style, 0), sitting(direction, style, 1)].map(
    (f, i) => check(f, `${direction}/${style}/${i}`),
  )
}
// Validate every pattern once at load, so a bad edit fails loudly here rather than as a gap mid-map.
for (const d of DIRS) for (const st of ['short', 'long', 'hijab'] as const) framesFor(d, st)

/** C's colourise(): palette + a 1px outline around the body (not around the shadow). */
export function colourise(rows: string[], a: Avatar): (RGBA | null)[][] {
  const sleeve = a.shirt.map((c) => Math.floor(c * 0.78)) as unknown as RGB
  const cmap: Record<string, RGB> = {
    h: a.hair, s: SKINS[a.skin], e: [OUTLINE[0], OUTLINE[1], OUTLINE[2]], t: a.shirt, a: sleeve, p: PANTS[a.pants], b: [40, 32, 36],
  }
  const px: (RGBA | null)[][] = rows.map((r) =>
    [...r].map((ch) => (ch === 'x' ? SHADOW : ch === '.' ? null : ([...cmap[ch], 255] as unknown as RGBA))),
  )
  const solid = px.map((row) => row.map((p) => p !== null && p !== SHADOW))
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < FW; x++) {
      if (solid[y][x]) continue
      const touches = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(
        ([dy, dx]) => y + dy >= 0 && y + dy < FH && x + dx >= 0 && x + dx < FW && solid[y + dy][x + dx],
      )
      if (touches) px[y][x] = OUTLINE
    }
  return px
}

/** RGBA bytes of one look's 8×4 sheet at 2× (256×192). Exported for the pixel check. */
export function avatarSheetPixels(a: Avatar): { width: number; height: number; data: Uint8ClampedArray } {
  const width = FW * COLS * SCALE
  const height = FH * DIRS.length * SCALE
  const data = new Uint8ClampedArray(width * height * 4)
  DIRS.forEach((d, di) => {
    framesFor(d, a.style).forEach((frame, ci) => {
      const art = colourise(frame, a)
      for (let y = 0; y < FH; y++)
        for (let x = 0; x < FW; x++) {
          const c = art[y][x]
          if (!c) continue
          for (let sy = 0; sy < SCALE; sy++)
            for (let sx = 0; sx < SCALE; sx++) {
              const X = (ci * FW + x) * SCALE + sx
              const Y = (di * FH + y) * SCALE + sy
              data.set(c, (Y * width + X) * 4)
            }
        }
    })
  })
  return { width, height, data }
}

const MAX_CACHED = 200 // looks in use (≈80 people) plus recent picker previews; least recently used out
const sheetCache = new Map<string, string>()
const sheetByObject = new WeakMap<Avatar, string>()
export const keyOf = (a: Avatar) => `${a.style}|${a.hair.join(',')}|${a.skin}|${a.shirt.join(',')}|${a.pants}`

/** Data URL of one look's sheet (cached), or null if this browser can't draw/read a canvas. */
export function avatarSheetUrl(a: Avatar): string | null {
  const fast = sheetByObject.get(a)
  if (fast) return fast
  const key = keyOf(a)
  let url = sheetCache.get(key)
  if (url) {
    sheetCache.delete(key) // refresh: most recently used goes to the back
  } else {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return null
    const { width, height, data } = avatarSheetPixels(a)
    ctx.canvas.width = width
    ctx.canvas.height = height
    const img = ctx.createImageData(width, height)
    img.data.set(data)
    ctx.putImageData(img, 0, 0)
    try {
      url = ctx.canvas.toDataURL('image/png')
    } catch {
      return null
    }
    if (sheetCache.size >= MAX_CACHED) sheetCache.delete(sheetCache.keys().next().value!)
  }
  sheetCache.set(key, url)
  sheetByObject.set(a, url)
  return url
}

const presetIndex = new Map<Avatar, number>()

/**
 * CSS for one frame of a look, scale-independent. Presets use C's static sheet (no canvas); a custom
 * look is drawn here, falling back to the closest preset (same hair style) if the canvas is unavailable.
 */
export function avatarFrameStyle(a: Avatar, direction: Direction, column: number) {
  if (presetIndex.size === 0) PRESET_AVATARS.forEach((p, i) => presetIndex.set(p, i))
  const preset = presetIndex.get(a)
  if (preset !== undefined) return frameStyle(preset, direction, column)
  const url = avatarSheetUrl(a)
  if (!url) return frameStyle(Math.max(0, PRESET_AVATARS.findIndex((p) => p.style === a.style)), direction, column)
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: `${COLS * 100}% ${DIRS.length * 100}%`,
    backgroundPosition: `${(column / (COLS - 1)) * 100}% ${(DIRS.indexOf(direction) / (DIRS.length - 1)) * 100}%`,
    imageRendering: 'pixelated' as const,
  }
}

// ── Who looks like what ──────────────────────────────────────────────────────
// Saved looks arrive with /api/users (everyone) and /api/floor (people on the floor, fresher), plus
// your own just-saved look (freshest, until the next fetch catches up). App calls registerPeople on
// each render; it only rebuilds when the users list or the floor object actually changed.
const fromUsers = new Map<string, AvatarConfig | null>()
const fromFloor = new Map<string, AvatarConfig | null>()
const justSaved = new Map<string, { avatar: AvatarConfig | null; newer: number }>()
let lastUsers: unknown = null
let lastFloor: unknown = null
const sameLook = (a: AvatarConfig | null | undefined, b: AvatarConfig | null | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function registerPeople(users: readonly PersonRef[], floor: FloorResponse | null) {
  if (users === lastUsers && floor === lastFloor) return // nothing new (e.g. every animation frame)
  lastUsers = users
  lastFloor = floor
  fromUsers.clear()
  for (const u of users) fromUsers.set(u.id, u.avatar ?? null)
  fromFloor.clear()
  for (const d of floor?.desks ?? []) for (const p of [d.owner, d.occupant]) if (p) fromFloor.set(p.id, p.avatar ?? null)
  // Your save wins until the server data shows it (caught up), or until two newer arrivals: a fetch
  // already in flight when you saved can still carry the OLD look, but by the second one a newer
  // change made elsewhere (another device, an admin) is the truth and should show.
  for (const [id, s] of justSaved) {
    const server = fromFloor.has(id) ? fromFloor.get(id) : fromUsers.get(id)
    s.newer += 1
    if (sameLook(server, s.avatar) || s.newer >= 2) justSaved.delete(id)
  }
}

/** Call after saving your look, so it shows everywhere at once (before the next refetch). */
export function rememberSaved(personId: string, avatar: AvatarConfig | null) {
  justSaved.set(personId, { avatar, newer: 0 })
}

export function savedLookOf(personId: string): AvatarConfig | null {
  const own = justSaved.get(personId)
  if (own) return own.avatar
  if (fromFloor.has(personId)) return fromFloor.get(personId) ?? null
  return fromUsers.get(personId) ?? null
}

const hexToRgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
export const rgbToHex = (c: RGB) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`

const fromConfigCache = new WeakMap<AvatarConfig, Avatar>() // one Avatar per config object (per fetch)
export function avatarFromConfig(c: AvatarConfig): Avatar {
  let a = fromConfigCache.get(c)
  if (!a) {
    a = { style: c.style, hair: hexToRgb(c.hair), skin: c.skin, shirt: hexToRgb(c.shirt), pants: c.pants }
    fromConfigCache.set(c, a)
  }
  return a
}
export function configFromAvatar(a: Avatar): AvatarConfig {
  return { style: a.style, hair: rgbToHex(a.hair), skin: a.skin, shirt: rgbToHex(a.shirt), pants: a.pants }
}

/** The look for a person: what they saved, else C's preset for their variant. */
export function avatarFor(personId: string): Avatar {
  const saved = savedLookOf(personId)
  return saved ? avatarFromConfig(saved) : PRESET_AVATARS[variantFor(personId)]
}

/** One frame of a person's look. Drop-in for frameStyle(variantFor(id), dir, col). */
export function personFrameStyle(personId: string, direction: Direction, column: number) {
  return avatarFrameStyle(avatarFor(personId), direction, column)
}
