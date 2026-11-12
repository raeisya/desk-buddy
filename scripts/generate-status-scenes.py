#!/usr/bin/env python3
"""Draws the Me-page status scenes -> apps/web/public/sprites/status/{wfh,mc,outstation,leave}-{variant}.png

Original pixel art built on C's character generator (scripts/generate-characters.py): same patterns,
palette and outline, so the person in the scene is the same sprite as on the map.

  wfh         at a home desk in striped pyjamas, laptop + mug + lamp
  mc          in bed under a blanket, pale, ice pack + thermometer
  outstation  in a bus: one hand on the pole, the other holding a bag
  leave       on holiday at the beach: sunglasses, holiday shirt, coconut drink, umbrella

Scene = 48x32 native px, written at 3x (144x96) to match the Me card. One PNG per variant (8).
Privacy: these show the REASON, so the app only uses them on your own Me page, never on the map.

Run: python3 scripts/generate-status-scenes.py
"""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'apps/web/public/sprites/status'
spec = importlib.util.spec_from_file_location('chars', ROOT / 'scripts/generate-characters.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

SW, SH = 48, 32
SCALE = 3
OUTLINE = g.OUTLINE
CLEAR = (0, 0, 0, 0)


def rgba(c, a=255):
    return tuple(c[:3]) + (a,)


def mix(a, b, f):
    return tuple(int(a[i] * (1 - f) + b[i] * f) for i in range(3))


def canvas(fill):
    return [[rgba(fill) for _ in range(SW)] for _ in range(SH)]


def rect(cv, x0, y0, x1, y1, colour):
    """Inclusive rectangle, clipped."""
    for y in range(max(0, y0), min(SH - 1, y1) + 1):
        for x in range(max(0, x0), min(SW - 1, x1) + 1):
            cv[y][x] = rgba(colour)


def outline_rect(cv, x0, y0, x1, y1, colour):
    rect(cv, x0, y0, x1, y1, OUTLINE)
    rect(cv, x0 + 1, y0 + 1, x1 - 1, y1 - 1, colour)


def blit(cv, px, ox, oy):
    for y, row in enumerate(px):
        for x, c in enumerate(row):
            if c is None or c[3] == 0:
                continue
            X, Y = ox + x, oy + y
            if 0 <= X < SW and 0 <= Y < SH:
                if c[3] == 255:
                    cv[Y][X] = c
                else:  # shadow: blend
                    f = c[3] / 255
                    cv[Y][X] = rgba(mix(cv[Y][X], c, f))


def person(v, rows, *, pyjamas=False, pale=False):
    """C's colourise(), plus pyjama stripes on the shirt/pants or a sick tint on the skin."""
    vv = dict(v)
    if pyjamas:
        vv['shirt'] = (150, 176, 226)
    px = g.colourise(rows, vv)
    if pyjamas:
        light = (226, 234, 248, 255)
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in 'ta' and y % 2 == 0:
                    px[y][x] = light
                elif ch == 'p':  # pyjama trousers to match
                    px[y][x] = (150, 176, 226, 255) if y % 2 else light
    if pale:
        skin = g.SKIN[v['skin']]
        sick = rgba(mix(skin, (160, 205, 150), 0.42))
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch == 's':
                    px[y][x] = sick
    return px


# ── WFH: home desk, pyjamas ──────────────────────────────────────────────────
def scene_wfh(v):
    cv = canvas((236, 226, 204))  # warm wall
    rect(cv, 0, 26, SW - 1, SH - 1, (176, 128, 90))  # wooden floor
    for x in range(0, SW, 8):
        rect(cv, x, 26, x, SH - 1, (150, 108, 76))
    outline_rect(cv, 2, 3, 12, 11, (170, 210, 236))  # window
    rect(cv, 7, 4, 7, 10, OUTLINE[:3])
    rect(cv, 3, 7, 11, 7, OUTLINE[:3])
    # upper body above the desk so the striped pyjama top shows
    rows = g.sitting('down', v['style'], typing=0)
    blit(cv, person(v, rows, pyjamas=True), 16, 2)

    outline_rect(cv, 4, 22, 43, 24, (196, 146, 98))  # desk top
    outline_rect(cv, 6, 24, 41, 31, (164, 116, 76))  # desk front
    rect(cv, 7, 27, 40, 27, (140, 98, 64))
    outline_rect(cv, 6, 18, 13, 23, (176, 182, 196))  # laptop at the side (lid back)
    rect(cv, 9, 20, 10, 21, (226, 230, 240))
    outline_rect(cv, 31, 19, 35, 23, (210, 90, 70))  # mug
    rect(cv, 32, 16, 32, 17, (255, 255, 255))  # steam
    rect(cv, 34, 15, 34, 16, (255, 255, 255))
    rect(cv, 41, 13, 41, 22, (90, 90, 100))  # desk lamp, right
    outline_rect(cv, 38, 10, 44, 13, (250, 214, 110))
    return cv


# ── MC: in bed, pale, ice pack + thermometer ─────────────────────────────────
def scene_mc(v):
    cv = canvas((214, 206, 232))  # lilac bedroom
    rect(cv, 0, 27, SW - 1, SH - 1, (150, 130, 120))
    outline_rect(cv, 8, 9, 39, 17, (150, 100, 70))  # low headboard
    outline_rect(cv, 13, 13, 34, 18, (248, 248, 250))  # pillow behind the head

    rows = g.sitting('down', v['style'])  # head on the pillow, the blanket covers the rest
    blit(cv, person(v, rows, pale=True), 16, 2)

    outline_rect(cv, 25, 5, 29, 7, (170, 220, 245))  # ice pack, top of the head
    rect(cv, 25, 13, 27, 13, (250, 250, 250))  # thermometer from the mouth
    rect(cv, 28, 13, 28, 13, (220, 50, 50))
    outline_rect(cv, 6, 17, 41, 28, (120, 170, 160))  # blanket up to the chin, check pattern
    for y in range(18, 28):
        for x in range(7, 41):
            if (x // 4 + y // 4) % 2 == 0:
                cv[y][x] = rgba((140, 190, 178))
    rect(cv, 6, 29, 41, 29, (110, 80, 60))
    rect(cv, 33, 6, 33, 7, (120, 180, 240))  # sweat drop
    rect(cv, 32, 8, 34, 8, (120, 180, 240))
    # "z z" of a sick nap
    for (x, y) in ((38, 4), (41, 1)):
        rect(cv, x, y, x + 2, y, OUTLINE[:3]); rect(cv, x + 1, y + 1, x + 1, y + 1, OUTLINE[:3]); rect(cv, x, y + 2, x + 2, y + 2, OUTLINE[:3])
    return cv


# ── Outstation: in a bus, hand on the pole, bag in the other hand ────────────
def scene_outstation(v):
    cv = canvas((226, 222, 204))  # bus wall
    # window band with a passing view
    outline_rect(cv, 0, 3, SW - 1, 13, (172, 212, 236))
    for x in (12, 24, 36):
        rect(cv, x, 3, x, 13, OUTLINE[:3])
    rect(cv, 1, 11, SW - 2, 12, (120, 178, 110))  # trees/grass going by
    for x in (5, 17, 29, 41):
        rect(cv, x, 9, x + 2, 11, (90, 150, 90))
    rect(cv, 0, 0, SW - 1, 1, (196, 60, 52))  # red trim (bus livery)
    rect(cv, 0, 27, SW - 1, SH - 1, (84, 86, 96))  # floor
    rect(cv, 0, 27, SW - 1, 27, (236, 200, 70))  # yellow edge strip
    # seat behind, on the right
    outline_rect(cv, 36, 16, 46, 26, (60, 110, 170))

    # person standing facing us; viewer-left arm raised to the pole
    rows = [list(r) for r in g.standing('down', v['style'], 'n')]
    for y in (11, 12, 13, 14):  # drop the hanging left arm/hand
        if rows[y][3] in 'as':
            rows[y][3] = '.'
    for y in range(5, 11):  # sleeve going up
        rows[y][2] = 'a'
    rows[4][2] = 's'  # hand
    rows = [''.join(r) for r in rows]
    px = person(v, rows)

    ox, oy = 15, 4
    pole_x = ox + 2
    rect(cv, pole_x, 0, pole_x, 27, (186, 192, 204))  # pole (behind the hand)
    rect(cv, pole_x + 1, 0, pole_x + 1, 27, (150, 156, 170))
    rect(cv, 0, 2, SW - 1, 2, (186, 192, 204))  # ceiling rail
    blit(cv, px, ox, oy)
    cv[oy + 4][pole_x] = rgba(g.SKIN[v['skin']])  # hand wraps the pole

    # bag in the other hand (viewer right): handle + body
    hx, hy = ox + 12, oy + 14
    rect(cv, hx - 1, hy + 1, hx + 2, hy + 1, (90, 60, 40))
    outline_rect(cv, hx - 2, hy + 2, hx + 3, hy + 8, (150, 98, 56))
    rect(cv, hx - 1, hy + 4, hx + 2, hy + 4, (120, 76, 44))
    return cv


# ── Leave: on holiday at the beach ───────────────────────────────────────────
def scene_leave(v):
    cv = canvas((150, 206, 240))  # sky
    rect(cv, 0, 12, SW - 1, 17, (60, 140, 200))  # sea
    for x in range(2, SW, 7):
        rect(cv, x, 14, x + 2, 14, (190, 228, 246))  # little waves
    rect(cv, 0, 18, SW - 1, SH - 1, (240, 214, 150))  # sand
    for (x, y) in ((6, 24), (13, 29), (30, 27), (42, 23), (37, 30)):
        cv[y][x] = rgba((214, 184, 120))
    outline_rect(cv, 38, 1, 44, 7, (255, 214, 80))  # sun
    # beach umbrella (striped) on the left
    rect(cv, 9, 8, 9, 27, (120, 100, 90))
    for x in range(1, 18):
        top = 4 + abs(x - 9) // 3
        for y in range(top, 8):
            cv[y][x] = rgba((230, 70, 60) if (x // 3) % 2 == 0 else (250, 246, 240))
    rect(cv, 1, 8, 17, 8, OUTLINE[:3])

    # holiday shirt + sunglasses
    vv = dict(v)
    vv['shirt'] = (240, 140, 70)
    rows = [list(r) for r in g.standing('down', v['style'], 'n')]
    for x in range(4, 12):  # sunglasses across the eyes
        if rows[6][x] in 'se':
            rows[6][x] = 'e'
    rows = [''.join(r) for r in rows]
    px = g.colourise(rows, vv)
    for y, row in enumerate(rows):  # flower dots on the shirt
        for x, ch in enumerate(row):
            if ch == 't' and (x + y) % 3 == 0:
                px[y][x] = (255, 236, 120, 255)
    ox, oy = 22, 6
    blit(cv, px, ox, oy)
    # coconut drink in the viewer-right hand, with a straw
    hx, hy = ox + 12, oy + 13
    outline_rect(cv, hx, hy - 1, hx + 3, hy + 2, (130, 90, 50))
    rect(cv, hx + 2, hy - 4, hx + 2, hy - 2, (240, 80, 120))
    return cv


SCENES = {'wfh': scene_wfh, 'mc': scene_mc, 'outstation': scene_outstation, 'leave': scene_leave}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    n = 0
    for name, draw in SCENES.items():
        for vi, v in enumerate(g.VARIANTS):
            cv = draw(v)
            assert len(cv) == SH and all(len(r) == SW for r in cv)
            g.write_png_rgba(OUT / f'{name}-{vi}.png', cv, scale=SCALE)
            n += 1
    print(f'wrote {n} scenes to {OUT.relative_to(ROOT)} ({SW * SCALE}x{SH * SCALE})')


if __name__ == '__main__':
    main()
