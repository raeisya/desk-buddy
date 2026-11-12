#!/usr/bin/env python3
"""Draws the office map image from desks.json -> apps/web/public/office-map.png (1280x768).

Original pixel art (no third-party assets), so there is no licence to worry about.
Drawn at native 16 px tiles (640x384) and upscaled 2x nearest-neighbour, so 1 art pixel = 2 image pixels
and desk coordinates (1280-space) map exactly onto the art.

Run after scripts/generate-floor.mjs:  python3 scripts/generate-map-art.py
No dependencies (writes the PNG with zlib). Deterministic.
"""
import json
import random
import struct
import zlib
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DESKS = ROOT / 'apps/api/src/seed/data/desks.json'
OUT = ROOT / 'apps/web/public/office-map.png'

SCALE = 2
W, H = 1280 // SCALE, 768 // SCALE  # native canvas

# ── Palette ──────────────────────────────────────────────────────────────────
K = (34, 32, 52)  # outline
P = {
    'k': K,
    'floor': (214, 206, 192), 'floor2': (208, 199, 184), 'grout': (196, 186, 170),
    'wall_top': (58, 64, 92), 'wall': (92, 104, 138), 'wall_lo': (74, 84, 114), 'base': (52, 56, 80),
    'glass': (134, 196, 230), 'glass_hi': (204, 234, 250), 'frame': (232, 232, 238),
    'desk': (238, 228, 208), 'desk_seam': (214, 200, 174), 'desk_front': (170, 142, 108), 'desk_front_lo': (140, 114, 84),
    'divider': (118, 130, 150), 'divider_hi': (164, 176, 196),
    'mon_back': (62, 64, 80), 'mon_frame': (44, 46, 60), 'screen': (72, 142, 212), 'screen_hi': (152, 212, 250),
    'kb': (204, 204, 212), 'kb_key': (156, 156, 168),
    'chair': (46, 52, 74), 'chair_seat': (72, 82, 110), 'chair_hi': (100, 112, 146),
    'leaf': (76, 150, 84), 'leaf_dk': (50, 110, 62), 'leaf_hi': (124, 192, 112), 'pot': (178, 104, 72), 'pot_dk': (138, 76, 52),
    'paper': (248, 248, 244), 'mug': (226, 82, 76),
    'white': (244, 244, 240), 'grey': (168, 170, 180), 'grey_dk': (120, 122, 134),
    'sofa': (86, 118, 160), 'sofa_dk': (62, 88, 126), 'sofa_hi': (120, 152, 192),
    'wood': (164, 116, 76), 'wood_dk': (124, 84, 52),
    'water': (120, 190, 240), 'red': (220, 70, 64), 'green_led': (110, 230, 120),
    'mat': (128, 92, 70), 'mat_lo': (100, 70, 52),
}
# Zone rugs: (fill, border). Muted so B's desk-state colours stay readable on top.
RUGS = {
    'Zone A': ((112, 168, 158), (82, 134, 126)),
    'Zone B': ((214, 142, 126), (178, 108, 94)),
    'Zone C': ((160, 176, 108), (126, 142, 80)),
    'Zone D': ((160, 146, 196), (124, 112, 162)),
    'Zone E': ((222, 190, 120), (186, 152, 88)),
    'Zone F': ((122, 164, 212), (90, 130, 180)),
}

canvas = [[P['floor']] * W for _ in range(H)]


def px(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        canvas[y][x] = c


def rect(x, y, w, h, c):
    for yy in range(max(0, y), min(H, y + h)):
        row = canvas[yy]
        for xx in range(max(0, x), min(W, x + w)):
            row[xx] = c


def box(x, y, w, h, fill, outline=K):
    rect(x, y, w, h, outline)
    rect(x + 1, y + 1, w - 2, h - 2, fill)


def darken(x, y, f=0.82):
    if 0 <= x < W and 0 <= y < H:
        r, g, b = canvas[y][x]
        canvas[y][x] = (int(r * f), int(g * f), int(b * f))


def sprite(rows, x, y, cmap, flip_v=False):
    """Draw ASCII-art rows. '.' = transparent, 's' = shadow (darken what's underneath)."""
    rows = rows[::-1] if flip_v else rows
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == '.':
                continue
            if ch == 's':
                darken(x + dx, y + dy)
            else:
                px(x + dx, y + dy, P[cmap[ch]])


# 5x7 bitmap font (only the glyphs we use)
FONT = {
    'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    'C': ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    'I': ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
    'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
    ' ': ['00000'] * 7,
}


def text(s, x, y, c):
    for i, ch in enumerate(s):
        for dy, row in enumerate(FONT[ch]):
            for dx, bit in enumerate(row):
                if bit == '1':
                    px(x + i * 6 + dx, y + dy, c)


def text_width(s):
    return len(s) * 6 - 1


def plaque(s, cx, y, fill=P['white'], ink=K):
    w = text_width(s) + 6
    x = cx - w // 2
    box(x, y, w, 11, fill)
    rect(x + 1, y + 10, w - 2, 1, P['grey'])  # bottom bevel
    text(s, x + 3, y + 2, ink)


# ── Sprites (16x16 native) ───────────────────────────────────────────────────
CHAIR = [  # backrest at the top = person faces down
    '................',
    '....kkkkkkkk....',
    '...kbbbbbbbbk...',
    '...kbhhhhhhbk...',
    '...kbbbbbbbbk...',
    '....kkkkkkkk....',
    '...kssssssssk...',
    '..kshhhhhhhhsk..',
    '..kssssssssssk..',
    '..kssssssssssk..',
    '...kssssssssk...',
    '....kkkkkkkk....',
    '.......kk.......',
    '.....kkkkkk.....',
    '....k..kk..k....',
    '................',
]
CHAIR_MAP = {'k': 'k', 'b': 'chair', 'h': 'chair_hi', 's': 'chair_seat'}

PLANT = [
    '................',
    '.....gl..lg.....',
    '....gllg.glg....',
    '...gglgggllgg...',
    '..gdglgglggdgg..',
    '..gggdgglgdggg..',
    '...gdgggggdgg...',
    '....ggdgdggg....',
    '.....dggggd.....',
    '....kkkkkkkk....',
    '....kppppppk....',
    '.....kppppk.....',
    '.....kqqqqk.....',
    '.....skkkks.....',
    '......ssss......',
    '................',
]
PLANT_MAP = {'g': 'leaf', 'l': 'leaf_hi', 'd': 'leaf_dk', 'k': 'k', 'p': 'pot', 'q': 'pot_dk'}
# 's' in CHAIR means seat colour, in PLANT it means shadow — handle via maps:
CHAIR = [r.replace('s', 'e') for r in CHAIR]
CHAIR_MAP = {'k': 'k', 'b': 'chair', 'h': 'chair_hi', 'e': 'chair_seat'}


def plant(x, y):
    sprite(PLANT, x, y, PLANT_MAP)


# ── Room shell ───────────────────────────────────────────────────────────────
def draw_floor():
    for y in range(H):
        for x in range(W):
            tx, ty = x // 16, y // 16
            c = P['floor'] if (tx + ty) % 2 == 0 else P['floor2']
            if x % 16 == 15 or y % 16 == 15:
                c = P['grout']
            canvas[y][x] = c


def draw_walls():
    # top wall (3/4 view: we see its face)
    rect(0, 0, W, 4, P['wall_top'])
    rect(0, 4, W, 22, P['wall'])
    rect(0, 22, W, 6, P['wall_lo'])
    rect(0, 28, W, 4, P['base'])
    rect(0, 32, W, 1, K)
    for y in range(36, 40):  # soft shadow cast on the floor
        for x in range(W):
            darken(x, y, 0.94 if y > 37 else 0.88)

    # company sign, centre of the wall
    sign = 'ACME TECH'
    sw = text_width(sign) + 10
    sx = (W - sw) // 2
    box(sx, 8, sw, 13, P['wall_top'])
    text(sign, sx + 5, 11, P['white'])

    # windows, skipping the sign
    left = [24, 88, 152, 216]
    for wx in left + [W - x - 44 for x in left]:  # mirrored around the sign
        box(wx, 6, 44, 18, P['glass'], P['frame'])
        rect(wx + 21, 7, 2, 16, P['frame'])  # mullion
        for i in range(5):  # glare
            px(wx + 4 + i, 18 - i, P['glass_hi'])
            px(wx + 27 + i, 18 - i, P['glass_hi'])
        rect(wx - 1, 24, 46, 2, P['white'])  # sill

    # side + bottom walls (seen from above: thick dark trim)
    rect(0, 0, 6, H, P['wall_top'])
    rect(6, 33, 1, H - 33, K)
    rect(W - 6, 0, 6, H, P['wall_top'])
    rect(W - 7, 33, 1, H - 33, K)
    rect(0, H - 6, W, 6, P['wall_top'])
    rect(0, H - 7, W, 1, K)

    # entrance (gap in the bottom wall) + door mat
    door_x, door_w = W // 2 - 24, 48
    rect(door_x, H - 7, door_w, 7, P['floor'])
    rect(door_x - 2, H - 7, 2, 7, K)
    rect(door_x + door_w, H - 7, 2, 7, K)
    box(door_x + 4, H - 20, door_w - 8, 12, P['mat'])
    for i in range(door_x + 7, door_x + door_w - 7, 4):
        rect(i, H - 18, 2, 8, P['mat_lo'])


# ── Desks ────────────────────────────────────────────────────────────────────
def draw_pod(zone, desks, rng):
    xs = [d['x'] // SCALE for d in desks]
    ys = [d['y'] // SCALE for d in desks]
    cell = desks[0]['w'] // SCALE  # 32
    x0, y0 = min(xs), min(ys)
    x1 = max(xs) + cell
    y1 = max(ys) + cell
    fill, border = RUGS.get(zone, ((180, 180, 180), (140, 140, 140)))

    # rug, inset 8px around the pod
    rx, ry, rw, rh = x0 - 8, y0 - 8, (x1 - x0) + 16, (y1 - y0) + 16
    rect(rx, ry, rw, rh, border)
    rect(rx + 2, ry + 2, rw - 4, rh - 4, fill)
    for xx in range(rx + 4, rx + rw - 4, 2):  # stitched inner edge
        px(xx, ry + 3, border)
        px(xx, ry + rh - 4, border)

    plaque(zone.upper(), x0 + 22, ry - 15)

    downs = [d for d in desks if d.get('facing', 'down') == 'down']
    ups = [d for d in desks if d.get('facing') == 'up']

    # chairs first (desk island overlaps nothing of them)
    for d in downs:
        sprite(CHAIR, d['x'] // SCALE + 8, d['y'] // SCALE, CHAIR_MAP)
    for d in ups:
        sprite(CHAIR, d['x'] // SCALE + 8, d['y'] // SCALE + 16, CHAIR_MAP, flip_v=True)

    # desk island: bottom half of the 'down' row + top half of the 'up' row
    iy0 = y0 + cell // 2
    iy1 = y1 - cell // 2 if ups else y0 + cell
    ih = iy1 - iy0
    for xx in range(x0 + 1, x1 + 1):  # drop shadow
        darken(xx, iy1 + 3, 0.86)
        darken(xx, iy1 + 4, 0.92)
    box(x0, iy0, x1 - x0, ih + 4, P['desk'])
    rect(x0 + 1, iy1, x1 - x0 - 2, 3, P['desk_front'])  # front face
    rect(x0 + 1, iy1 + 2, x1 - x0 - 2, 1, P['desk_front_lo'])
    for sx in range(x0 + cell, x1, cell):  # seams between desks
        rect(sx, iy0 + 1, 1, ih - 1, P['desk_seam'])
    if ups:  # privacy divider down the middle
        mid = y0 + cell - 1
        rect(x0 + 2, mid - 1, x1 - x0 - 4, 3, P['divider'])
        rect(x0 + 2, mid - 1, x1 - x0 - 4, 1, P['divider_hi'])

    for d in downs:  # monitor back faces us, keyboard by the person
        x, y = d['x'] // SCALE, d['y'] // SCALE + 16
        rect(x + 11, y + 2, 10, 2, P['kb'])
        rect(x + 12, y + 2, 8, 1, P['kb_key'])
        box(x + 9, y + 6, 14, 7, P['mon_back'], P['mon_frame'])
        rect(x + 15, y + 12, 2, 2, P['mon_frame'])
        clutter(x, y + 1, rng, near_top=True)
    for d in ups:  # screen faces us
        x, y = d['x'] // SCALE, d['y'] // SCALE
        box(x + 9, y + 2, 14, 9, P['screen'], P['mon_frame'])
        for i in range(3):
            px(x + 11 + i, y + 6 - i, P['screen_hi'])
        rect(x + 15, y + 11, 2, 1, P['mon_frame'])
        rect(x + 11, y + 12, 10, 2, P['kb'])
        rect(x + 12, y + 13, 8, 1, P['kb_key'])
        clutter(x, y + 10, rng, near_top=False)


def clutter(x, y, rng, near_top):
    pick = rng.random()
    side = x + 3 if rng.random() < 0.5 else x + 25
    if pick < 0.3:  # mug
        rect(side, y + 1, 3, 3, P['mug'])
        px(side + 3, y + 2, P['mug'])
    elif pick < 0.55:  # papers
        rect(side - 1, y, 5, 4, P['paper'])
        rect(side, y + 1, 3, 1, P['grey'])
    elif pick < 0.7:  # tiny cactus
        rect(side, y + 2, 3, 2, P['pot'])
        rect(side + 1, y, 1, 2, P['leaf'])


# ── Amenities ────────────────────────────────────────────────────────────────
def draw_pantry(x, y):
    # fridge
    box(x, y - 8, 18, 46, P['white'])
    rect(x + 1, y + 10, 16, 1, P['grey'])
    rect(x + 14, y - 4, 1, 10, P['grey_dk'])
    rect(x + 14, y + 13, 1, 10, P['grey_dk'])
    # counter
    cx = x + 20
    box(cx, y + 10, 96, 16, P['grey'])
    rect(cx + 1, y + 11, 94, 1, P['white'])
    box(cx, y + 25, 96, 13, P['wood'])
    for dx in range(24, 96, 24):
        rect(cx + dx, y + 26, 1, 11, P['wood_dk'])
    text('KOPI', cx + 36, y + 28, P['white'])
    # coffee machine
    box(cx + 8, y - 2, 14, 16, P['mon_back'])
    px(cx + 18, y + 2, P['red'])
    rect(cx + 12, y + 8, 6, 2, P['grey_dk'])
    rect(cx + 13, y + 10, 3, 3, P['white'])  # cup
    # sink
    box(cx + 54, y + 12, 18, 9, P['grey_dk'])
    rect(cx + 62, y + 9, 2, 4, P['grey_dk'])
    # kettle
    box(cx + 80, y + 4, 8, 8, P['white'])


def draw_lounge(x, y):
    # sofa
    for xx in range(x + 1, x + 72):
        darken(xx, y + 25, 0.86)
    box(x, y, 72, 10, P['sofa_dk'])
    box(x - 4, y + 4, 8, 20, P['sofa_dk'])
    box(x + 68, y + 4, 8, 20, P['sofa_dk'])
    box(x + 2, y + 9, 68, 15, P['sofa'])
    for dx in (24, 46):
        rect(x + dx, y + 10, 1, 13, P['sofa_dk'])
    rect(x + 3, y + 10, 66, 1, P['sofa_hi'])
    # coffee table
    box(x + 18, y + 30, 36, 10, P['wood'])
    rect(x + 19, y + 37, 34, 2, P['wood_dk'])
    rect(x + 24, y + 32, 5, 3, P['paper'])
    rect(x + 42, y + 32, 3, 3, P['mug'])


def draw_water_cooler(x, y):
    box(x, y, 12, 9, P['water'])
    rect(x + 2, y + 2, 2, 4, P['glass_hi'])
    box(x - 1, y + 8, 14, 22, P['white'])
    px(x + 4, y + 13, P['red'])
    px(x + 8, y + 13, P['water'])
    rect(x + 2, y + 18, 8, 1, P['grey'])


def draw_printer(x, y):
    box(x, y, 26, 16, P['grey'])
    rect(x + 1, y + 1, 24, 2, P['white'])
    box(x + 5, y - 3, 16, 5, P['paper'])
    rect(x + 4, y + 9, 18, 2, P['grey_dk'])
    px(x + 21, y + 5, P['green_led'])


def draw_whiteboard(x, y):
    box(x, y, 40, 22, P['white'])
    rect(x + 1, y + 21, 38, 2, P['grey_dk'])
    rect(x + 5, y + 5, 14, 1, (70, 120, 200))
    rect(x + 5, y + 9, 22, 1, (70, 120, 200))
    rect(x + 5, y + 13, 10, 1, P['red'])
    rect(x + 24, y + 12, 9, 6, P['green_led'])


def write_png(path, rows):
    raw = bytearray()
    for row in rows:
        line = bytearray(b'\x00')
        for c in row:
            line += bytes(c) * SCALE
        raw += bytes(line) * SCALE

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', W * SCALE, H * SCALE, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    path.write_bytes(png)


def main():
    desks = json.loads(DESKS.read_text())
    rng = random.Random(7)

    draw_floor()
    draw_walls()

    by_zone = defaultdict(list)
    for d in desks:
        by_zone[d['zone']].append(d)
    for zone in sorted(by_zone):
        draw_pod(zone, by_zone[zone], rng)

    # corridor + corner plants (in the gaps between pods / along the walls)
    for x, y in [(216, 176), (408, 176), (12, 40), (W - 28, 40), (12, 176), (W - 28, 176), (12, 290), (W - 28, 290)]:
        plant(x, y)

    # bottom strip: pantry (left), printer, entrance (centre), water cooler + lounge (right)
    draw_pantry(16, 330)
    draw_printer(176, 344)
    draw_water_cooler(388, 330)
    draw_lounge(470, 324)
    plant(W - 34, 344)
    draw_whiteboard(300, 168)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    write_png(OUT, canvas)
    print(f'wrote {OUT.relative_to(ROOT)} ({W * SCALE}x{H * SCALE}) from {len(desks)} desks')


if __name__ == '__main__':
    main()
