#!/usr/bin/env python3
"""Draws the character sprite sheet -> apps/web/public/sprites/characters.png

Original pixel art (no third-party assets). Same scale as the office map: art drawn at native
16x24 px per frame and upscaled 2x, so one frame = 32x48 image px on the 1280x768 map.

Sheet layout (must match apps/web/src/theme/characters.ts):
  columns (8): 0 idle | 1-4 walk | 5 sit | 6-7 type
  rows: variant * 4 + direction, direction order = down, left, right, up   (8 variants -> 32 rows)
  => 256 x 1536 px

Run: python3 scripts/generate-characters.py [--preview]
  --preview also writes a map preview with seated/standing people into the scratch dir given by $PREVIEW_DIR.
"""
import importlib.util
import os
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'apps/web/public/sprites/characters.png'

SCALE = 2
FW, FH = 16, 24  # native frame
COLS = 8
DIRS = ['down', 'left', 'right', 'up']

OUTLINE = (34, 32, 52, 255)
SHADOW = (0, 0, 0, 70)

SKIN = {
    'light': (255, 219, 180), 'medlight': (241, 194, 150), 'tan': (214, 160, 116),
    'brown': (176, 120, 82), 'deep': (130, 86, 58),
}
HAIR = {'black': (40, 36, 44), 'dkbrown': (78, 52, 40), 'brown': (120, 80, 50)}
PANTS = {'navy': (52, 60, 96), 'charcoal': (64, 64, 72), 'khaki': (150, 130, 96), 'black': (40, 40, 48)}

# style: short | long | hijab ; hair = hair colour or hijab colour
VARIANTS = [
    dict(style='short', hair=HAIR['black'], skin='medlight', shirt=(70, 130, 200), pants='navy'),
    dict(style='hijab', hair=(150, 60, 90), skin='tan', shirt=(236, 228, 206), pants='charcoal'),
    dict(style='short', hair=HAIR['black'], skin='light', shirt=(90, 160, 100), pants='khaki'),
    dict(style='long', hair=HAIR['black'], skin='light', shirt=(220, 170, 60), pants='navy'),
    dict(style='short', hair=HAIR['dkbrown'], skin='brown', shirt=(150, 156, 170), pants='black'),
    dict(style='hijab', hair=(60, 140, 140), skin='medlight', shirt=(160, 140, 200), pants='charcoal'),
    dict(style='short', hair=HAIR['black'], skin='deep', shirt=(200, 80, 70), pants='navy'),
    dict(style='long', hair=HAIR['brown'], skin='tan', shirt=(230, 130, 60), pants='charcoal'),
]

E = '................'

# ── Heads (rows 0-9) ─────────────────────────────────────────────────────────
HEAD = {
    ('down', 'short'): [E, E, '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....hssssssh....',
                        '....ssessess....', '....ssssssss....', '.....ssssss.....', '.......ss.......'],
    ('up', 'short'): [E, E, '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....',
                      '....hhhhhhhh....', '....shhhhhhs....', '.....hhhhhh.....', '.......ss.......'],
    ('left', 'short'): [E, E, '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....sssshhhh....',
                        '....sesshhhh....', '....ssssshhh....', '.....sssss......', '.......ss.......'],
    ('down', 'hijab'): [E, E, '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....hssssssh....',
                        '....hsessesh....', '....hssssssh....', '....hhsssshh....', '...hhhhhhhhhh...'],
    ('up', 'hijab'): [E, E, '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....',
                      '....hhhhhhhh....', '....hhhhhhhh....', '....hhhhhhhh....', '...hhhhhhhhhh...'],
    ('left', 'hijab'): [E, E, '.....hhhhhh.....', '....hhhhhhhh....', '....hhhhhhhh....', '....ssshhhhh....',
                        '....seshhhhh....', '....ssshhhhh....', '....hhhhhhhh....', '....hhhhhhhhh...'],
}
for style in ('short', 'hijab'):
    HEAD[('right', style)] = [r[::-1] for r in HEAD[('left', style)]]

# ── Torsos (rows 10-15) ──────────────────────────────────────────────────────
ARM = '...a' + 't' * 8 + 'a...'
TORSO_FRONT = ['....tttttttt....', ARM, ARM, ARM, '...s' + 't' * 8 + 's...', '....pppppppp....']
TORSO_SIDE = {  # key = arm swing: 0 neutral, 1 forward, -1 back
    0: ['.....tttttt.....', '.....tttttt.....', '.....ttaatt.....', '.....ttaatt.....', '.....ttaatt.....', '.....ppsspp.....'],
    1: ['.....tttttt.....', '.....tttttt.....', '.....taattt.....', '.....taattt.....', '....staattt.....', '....sppppp......'],
    -1: ['.....tttttt.....', '.....tttttt.....', '.....tttaat.....', '.....tttaat.....', '.....tttaats....', '.....ppppps.....'],
}

# ── Legs (rows 16-21) ────────────────────────────────────────────────────────
LEGS_FRONT = {
    'n': ['....ppp..ppp....'] * 4 + ['....bbb..bbb....', '.....xxxxxx.....'],
    # stepping: the other leg lifts 2px so the cycle reads at small size
    'l': ['....ppp..ppp....', '....ppp..ppp....', '....ppp..bbb....', '....ppp.........', '....bbb.........', '.....xxxxxx.....'],
    'r': ['....ppp..ppp....', '....ppp..ppp....', '....bbb..ppp....', '.........ppp....', '.........bbb....', '.....xxxxxx.....'],
}
LEGS_SIDE = {
    'n': ['.....pppppp.....', '......pppp......', '......pppp......', '......pppp......', '.....bbbbb......', '.....xxxxxx.....'],
    'a': ['.....pppppp.....', '.....pp..pp.....', '....pp....pp....', '....pp....pp....', '...bbb....bbb...', '....xxxxxxxx....'],
    'b': ['.....pppppp.....', '......pppp......', '.....pp.pp......', '.....pp.pp......', '....bbbbbb......', '.....xxxxxx.....'],
}


def mirror(rows):
    return [r[::-1] for r in rows]


def check(rows, label):
    assert len(rows) == FH, f'{label}: {len(rows)} rows'
    for i, r in enumerate(rows):
        assert len(r) == FW, f'{label} row {i}: {len(r)} chars {r!r}'


def standing(direction, style, legs, torso_swing=0):
    head = HEAD[(direction, 'short' if style == 'long' else style)]
    if direction in ('down', 'up'):
        torso = list(TORSO_FRONT)
        leg = LEGS_FRONT[legs]
    else:
        torso = TORSO_SIDE[torso_swing]
        leg = LEGS_SIDE[legs]
        if direction == 'right':
            torso, leg = mirror(torso), mirror(leg)
    rows = head + torso + leg + [E, E]
    rows = [list(r) for r in rows]
    if style == 'long':  # hair falls over the shoulders / down the back
        if direction == 'down':
            for y in range(4, 12):
                rows[y][3] = rows[y][12] = 'h'
        elif direction == 'up':
            for y in range(5, 12):
                for x in range(4, 12):
                    rows[y][x] = 'h'
        else:
            xs = range(8, 12) if direction == 'left' else range(4, 8)
            for y in range(5, 12):
                for x in xs:
                    rows[y][x] = 'h'
    if style == 'hijab' and direction in ('down', 'up'):  # drape over the shoulders
        rows[10] = list('...hhhhhhhhhh...')
    return [''.join(r) for r in rows]


def sitting(direction, style, typing=None):
    """Upper body only for down/up (legs are under the desk). Shifted down 3 rows."""
    base = standing(direction, style, 'n')
    upper = base[:16]
    if direction in ('down', 'up'):
        rows = [E, E, E] + upper + [E] * 5
        rows = [list(r) for r in rows]
        rows[18] = list(E)  # waist sits in the chair
        if typing is not None and direction == 'down':  # hands reach for the keyboard, one up one down
            rows[17][3] = rows[17][12] = 't'
            up, down = (4, 11) if typing == 0 else (11, 4)
            rows[18][down] = 's'
            rows[16][up] = 's'
        elif typing is not None:  # back view: elbows move out alternately
            rows[16][2 if typing == 0 else 13] = 'a'
            rows[17][2 if typing == 0 else 13] = 's'
        return [''.join(r) for r in rows]
    # side: thighs forward, shins down
    rows = [E, E, E] + upper + ['...ppppppp......', '...pp...........', '...bb...........', E, E]
    if direction == 'right':
        rows = rows[:19] + mirror(rows[19:])
    return rows


def frames_for(direction, style):
    if direction in ('down', 'up'):
        walk = [standing(direction, style, k) for k in ('l', 'n', 'r', 'n')]
    else:
        walk = [standing(direction, style, 'a', 1), standing(direction, style, 'n', 0),
                standing(direction, style, 'b', -1), standing(direction, style, 'n', 0)]
    out = [standing(direction, style, 'n')] + walk + [sitting(direction, style), sitting(direction, style, 0),
                                                     sitting(direction, style, 1)]
    for i, f in enumerate(out):
        check(f, f'{direction}/{style}/frame{i}')
    return out


def colourise(rows, v):
    shirt = v['shirt']
    cmap = {
        'h': v['hair'], 's': SKIN[v['skin']], 'e': OUTLINE[:3], 't': shirt,
        'a': tuple(int(c * 0.78) for c in shirt), 'p': PANTS[v['pants']], 'b': (40, 32, 36),
    }
    px = [[None] * FW for _ in range(FH)]
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == 'x':
                px[y][x] = SHADOW
            elif ch != '.':
                px[y][x] = cmap[ch] + (255,)
    # 1px outline around the body (not around the shadow)
    solid = [[p is not None and p != SHADOW for p in row] for row in px]
    for y in range(FH):
        for x in range(FW):
            if solid[y][x]:
                continue
            if any(0 <= y + dy < FH and 0 <= x + dx < FW and solid[y + dy][x + dx]
                   for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[y][x] = OUTLINE
    return px


def build_sheet():
    sheet = [[(0, 0, 0, 0)] * (FW * COLS) for _ in range(FH * 4 * len(VARIANTS))]
    for vi, v in enumerate(VARIANTS):
        for di, d in enumerate(DIRS):
            for ci, f in enumerate(frames_for(d, v['style'])):
                art = colourise(f, v)
                oy, ox = (vi * 4 + di) * FH, ci * FW
                for y in range(FH):
                    for x in range(FW):
                        if art[y][x] is not None:
                            sheet[oy + y][ox + x] = art[y][x]
    return sheet


def write_png_rgba(path, rows, scale=SCALE):
    h, w = len(rows), len(rows[0])
    raw = bytearray()
    for row in rows:
        line = bytearray(b'\x00')
        for c in row:
            line += bytes(c) * scale
        raw += bytes(line) * scale

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w * scale, h * scale, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def preview(sheet):
    """Map + a few people (seated at chairs per the anchors in characters.ts, plus walkers)."""
    import json
    spec = importlib.util.spec_from_file_location('mapart', ROOT / 'scripts/generate-map-art.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    desks = json.loads(m.DESKS.read_text())
    m.draw_floor()
    m.draw_walls()
    from collections import defaultdict
    import random
    by = defaultdict(list)
    for d in desks:
        by[d['zone']].append(d)
    rng = random.Random(7)
    for z in sorted(by):
        m.draw_pod(z, by[z], rng)

    def blit(variant, direction, col, nx, ny):
        oy, ox = (variant * 4 + DIRS.index(direction)) * FH, col * FW
        for y in range(FH):
            for x in range(FW):
                r, g, b, a = sheet[oy + y][ox + x]
                if a == 0:
                    continue
                if 0 <= ny + y < m.H and 0 <= nx + x < m.W:
                    br, bg, bb = m.canvas[ny + y][nx + x]
                    f = a / 255
                    m.canvas[ny + y][nx + x] = (int(r * f + br * (1 - f)), int(g * f + bg * (1 - f)), int(b * f + bb * (1 - f)))

    for i, d in enumerate(desks[:20]):
        if i % 3 == 2:
            continue
        nx, ny = d['x'] // 2, d['y'] // 2
        if d['facing'] == 'down':
            blit(i % 8, 'down', 6 + i % 2, nx + 8, ny - 10)
        else:
            blit(i % 8, 'up', 6 + i % 2, nx + 8, ny + 8)
    for i, (dname, col) in enumerate([('down', 0), ('left', 1), ('right', 3), ('up', 2), ('down', 1), ('left', 0), ('right', 0), ('up', 0)]):
        blit(i, dname, col, 40 + i * 24, 184)
    out = Path(os.environ.get('PREVIEW_DIR', '.')) / 'characters-on-map.png'
    m.write_png(out, m.canvas)
    print(f'preview: {out}')


def main():
    sheet = build_sheet()
    write_png_rgba(OUT, sheet)
    print(f'wrote {OUT.relative_to(ROOT)} ({FW * COLS * SCALE}x{FH * 4 * len(VARIANTS) * SCALE}), {len(VARIANTS)} variants')
    if '--preview' in sys.argv:
        preview(sheet)


if __name__ == '__main__':
    main()
