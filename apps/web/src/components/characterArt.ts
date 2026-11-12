import { variantFor, type Direction } from '../theme/characters'

/**
 * C's character generator (scripts/generate-characters.py), ported to the browser so any look can be
 * drawn on the fly: same text patterns, palette, outline and frame layout. Pixel-for-pixel identical
 * to /sprites/characters.png for the 8 preset variants (checked in the browser against that sheet).
 *
 * One sheet per look: 8 columns (0 idle | 1–4 walk | 5 sit | 6–7 type) × 4 rows (down, left, right, up),
 * 16×24 native px per frame, drawn at 2× → 256×192 px. Cached as a data URL per look.
 */

type RGB = readonly [number, number, number]
type RGBA = readonly [number, number, number, number]

export const SKINS = {
  light: [255, 219, 180],
  medlight: [241, 194, 150],
  tan: [214, 160, 116],
  brown: [176, 120, 82],
  deep: [130, 86, 58],
} as const satisfies Record<string, RGB>
export const PANTS = {
  navy: [52, 60, 96],
  charcoal: [64, 64, 72],
  khaki: [150, 130, 96],
  black: [40, 40, 48],
} as const satisfies Record<string, RGB>
export type HairStyle = 'short' | 'long' | 'hijab'
export type SkinTone = keyof typeof SKINS
export type PantsColour = keyof typeof PANTS

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
const FW = 16
const FH = 24
const SCALE = 2
const COLS = 8
const DIRS: readonly Direction[] = ['down', 'left', 'right', 'up']
const OUTLINE: RGBA = [34, 32, 52, 255]
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

function standing(direction: Direction, style: HairStyle, legs: string, swing = 0): string[] {
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

function sitting(direction: Direction, style: HairStyle, typing: 0 | 1 | null = null): string[] {
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

function framesFor(direction: Direction, style: HairStyle): string[][] {
  const walk =
    direction === 'down' || direction === 'up'
      ? ['l', 'n', 'r', 'n'].map((k) => standing(direction, style, k))
      : [standing(direction, style, 'a', 1), standing(direction, style, 'n', 0), standing(direction, style, 'b', -1), standing(direction, style, 'n', 0)]
  return [standing(direction, style, 'n'), ...walk, sitting(direction, style), sitting(direction, style, 0), sitting(direction, style, 1)]
}

/** C's colourise(): palette + a 1px outline around the body (not around the shadow). */
function colourise(rows: string[], a: Avatar): (RGBA | null)[][] {
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

const sheetCache = new Map<string, string>()
const keyOf = (a: Avatar) => `${a.style}|${a.hair.join(',')}|${a.skin}|${a.shirt.join(',')}|${a.pants}`

/** Data URL of one look's sheet, drawn once and cached. */
export function avatarSheetUrl(a: Avatar): string {
  const key = keyOf(a)
  const hit = sheetCache.get(key)
  if (hit) return hit
  const { width, height, data } = avatarSheetPixels(a)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(width, height)
  img.data.set(data)
  ctx.putImageData(img, 0, 0)
  const url = canvas.toDataURL('image/png')
  sheetCache.set(key, url)
  return url
}

/** CSS for one frame of a look, scale-independent (same maths as C's frameStyle). */
export function avatarFrameStyle(a: Avatar, direction: Direction, column: number) {
  return {
    backgroundImage: `url("${avatarSheetUrl(a)}")`,
    backgroundSize: `${COLS * 100}% ${DIRS.length * 100}%`,
    backgroundPosition: `${(column / (COLS - 1)) * 100}% ${(DIRS.indexOf(direction) / (DIRS.length - 1)) * 100}%`,
    imageRendering: 'pixelated' as const,
  }
}

/** The look for a person. Today: C's preset for their variant; customization will override it per person. */
export function avatarFor(personId: string): Avatar {
  return PRESET_AVATARS[variantFor(personId)]
}

/** One frame of a person's look. Drop-in for frameStyle(variantFor(id), dir, col). */
export function personFrameStyle(personId: string, direction: Direction, column: number) {
  return avatarFrameStyle(avatarFor(personId), direction, column)
}
