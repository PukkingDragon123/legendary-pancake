"""The foot of the oak: great buttress roots arching out of the flared trunk into the moss, with stones tucked
between them, toadstools and chanterelles, ferns, grass tufts, fallen leaves and an acorn or two."""
import math
import random

from hx import DOOR_A, OPEN_A, Spec, pol
from trunk import R_of


def leaf_art(rng, w, h, lobes=True):
    """A small oak leaf as pixel art rows (o outline, d dark, m mid, l light, v vein)."""
    rows = [['.'] * w for _ in range(h)]
    cx = (w - 1) / 2
    for y in range(h):
        t = y / (h - 1)
        hw = (w / 2 - 0.5) * (math.sin(math.pi * min(1, t * 1.05)) ** 0.8)
        if lobes:
            hw *= 0.78 + 0.22 * abs(math.cos(t * math.pi * 3.2))
        for x in range(w):
            d = abs(x - cx)
            if d <= hw:
                rows[y][x] = 'v' if d < 0.6 and 0.1 < t < 0.95 else ('l' if x < cx else 'm')
    for y in range(h):
        for x in range(w):
            if rows[y][x] == '.':
                continue
            edge = any(not (0 <= y + dy < h and 0 <= x + dx < w) or rows[y + dy][x + dx] == '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                rows[y][x] = 'o' if (x >= cx or y > h * 0.6) else 'd'
    return [''.join(r) for r in rows]


def fern_art(rng, h=20):
    w = 13
    rows = [['.'] * w for _ in range(h)]
    cx = w // 2
    for y in range(h):
        rows[y][cx] = 's'
        if y % 2 == 0 and y > 1:
            L = int((h - y) / h * 5) + 1
            for k in range(1, L + 1):
                c = 'l' if k < L else 'm'
                rows[y - (k // 3)][max(0, cx - k)] = c
                rows[y - (k // 3)][min(w - 1, cx + k)] = 'm' if k < L else 'd'
    return [''.join(r) for r in rows]


def grass_art(rng, w=10, h=12):
    rows = [['.'] * w for _ in range(h)]
    for b in range(6):
        x = rng.uniform(1, w - 2)
        lean = rng.uniform(-0.35, 0.35)
        hh = rng.randint(h // 2, h)
        for k in range(hh):
            xx = int(round(x + lean * k))
            if 0 <= xx < w:
                rows[h - 1 - k][xx] = 'l' if k > hh * 0.6 else ('m' if k > hh * 0.25 else 'd')
    return [''.join(r) for r in rows]


def toadstool(S, x, z, h, r, cap='red', seed=0):
    rng = random.Random(seed)
    S.disc('stem', r * 0.32, 0, h, x, z, sides=7, paint={'ramp': 'cream', 'tone': 3.2})
    S.loft('cap', [{'at': [x, h - 0.6, z], 'size': 2 * r}, {'at': [x, h + r * 0.35, z], 'size': 2 * r * 0.86},
                   {'at': [x, h + r * 0.7, z], 'size': r * 0.9}, {'at': [x, h + r * 0.82, z], 'size': 0.05}],
           sides=9, rnd=2.0, caps=(True, False), subdiv=1,
           paint={'ramp': cap, 'tone': 3.6, 'rim': {'light_shift': 1.0, 'dark_shift': -1.0}, 'layers': [
               {'id': 'dots', 'op': 'spots', 'count': 7, 'radius': [0.35, 0.7], 'ramp': 'cream', 'tone': 4.2, 'where': {'y': [h + r * 0.15, h + 99]}},
               {'id': 'gills', 'op': 'fill', 'faces': ['start'], 'ramp': 'cream', 'tone': 2.4}]})


def specs():
    S = Spec('roots', density=2, desc='Buttress roots, stones, toadstools, ferns and grass round the foot of the oak')
    S.style('root', ramp='bark', tone=3.8, rim={'light_shift': 0.6, 'dark_shift': -0.9},
            brush={'flow': 'path', 'length': 5, 'width': 1, 'rough': 0.65}, layers=[
                {'id': 'ph', 'op': 'photo', 'src': S.d['styles']['bark']['layers'][0]['src'], 'scale': 22, 'amount': 0.75},
                {'id': 'furrows', 'op': 'stripes', 'axis': 'around', 'period': 0.09, 'width': 0.22, 'shift': -1.4, 'wobble': 0.6},
                {'id': 'mottle', 'op': 'noise', 'scale': 7, 'amount': 0.45},
                {'id': 'moss', 'op': 'drip', 'ramp': 'moss', 'tone': 3.0, 'depth': 0.7, 'length': 3.2, 'width': 0.6, 'scale': 5,
                 'bevel': {'shadow': 1, 'highlight': 0, 'shadow_ramp': 'bark', 'shadow_tone': 1.0}},
                {'id': 'lichen', 'op': 'spots', 'count': 6, 'radius': [0.8, 1.8], 'ramp': 'lichen', 'tone': 3.4, 'bevel': True},
                {'id': 'earth', 'op': 'band', 'axis': 'y', 'from': -1, 'to': -0.7, 'shift': -1.0, 'wobble': 0.2}])
    rng = random.Random(4)
    # roots: (angle, scale); none in the dollhouse cut, the porch steps or the chimney foot
    roots = [(-1.02, 1.0), (-1.55, 1.15), (-1.98, 0.8), (-2.55, 1.2), (-3.0, 0.9), (2.95, 1.1), (2.45, 1.25), (1.9, 0.9), (1.62, 0.8), (-0.98, 0.75)]
    for i, (a, s) in enumerate(roots):
        s *= 1.3
        a += rng.uniform(-0.05, 0.05)
        r0 = R_of(30) - 6
        pts = [(r0, 34 * s), (r0 + 10 * s, 22 * s), (r0 + 24 * s, 9 * s), (r0 + 40 * s, 3.5 * s), (r0 + 54 * s, 0.8)]
        side = rng.uniform(-6, 6)
        rings = []
        for k, (rr, yy) in enumerate(pts):
            aa = a + side / rr * (k / 4)
            th = [26, 20, 14, 9, 4][k] * s
            rings.append({'at': pol(aa, rr, yy - th * 0.32), 'size': [th * 1.05, th * 0.72]})
        S.loft('root', rings, sides=8, rnd=2.2, style='root', caps=(False, True), subdiv=1)
        # a smaller side root branching off
        if i % 2 == 0:
            b0 = pol(a, r0 + 22 * s, 5 * s)
            aa = a + (0.22 if i % 4 == 0 else -0.22)
            S.loft('rootlet', [{'at': b0, 'size': [9 * s, 6 * s]}, {'at': pol(aa, r0 + 36 * s, 2.2 * s), 'size': [6 * s, 4 * s]},
                               {'at': pol(aa + 0.05, r0 + 48 * s, 0.6), 'size': [2.5, 2]}], sides=7, rnd=2.2, style='root', caps=(False, True), subdiv=1)
    # stones bedded in the moss between the roots
    for k in range(16):
        a = rng.uniform(-math.pi, math.pi)
        if abs(a) < OPEN_A + 0.15 or abs(a - DOOR_A) < 0.35:
            continue
        r = R_of(0) + rng.uniform(4, 40)
        p = pol(a, r, 0)
        w = rng.uniform(4, 10)
        S.box('stone', w, w * rng.uniform(0.4, 0.7), w * rng.uniform(0.7, 1.1), p[0], -1.2, p[2], style='stone', chamfer=w * 0.18,
              rot=[rng.uniform(-6, 6), rng.uniform(0, 90), rng.uniform(-8, 8)])
    # toadstools and chanterelles
    for k, (a, r, h, rad, cap) in enumerate([(-1.25, 12, 6, 4.2, 'red'), (-1.32, 18, 4, 2.8, 'red'), (-1.18, 22, 3, 2, 'red'),
                                             (2.2, 16, 5, 3.6, 'ochre'), (2.28, 22, 3.4, 2.6, 'ochre'), (-2.25, 10, 7, 4.6, 'red'),
                                             (-2.8, 30, 4, 3, 'terra'), (1.15, 26, 3.6, 2.6, 'red')]):
        p = pol(a, R_of(0) + r, 0)
        toadstool(S, p[0], p[2], h, rad, cap, k)
    # ferns, grass and fallen leaves (cards)
    key = {'o': 'leaf:1', 'd': 'leaf:2', 'm': 'leaf:4', 'l': 'leaf:5', 'v': 'leaf:3', 's': 'fern:1'}
    fkey = {'s': 'fern:1', 'd': 'fern:2', 'm': 'fern:3', 'l': 'fern:4'}
    for k in range(26):
        a = rng.uniform(-math.pi, math.pi)
        if abs(a) < OPEN_A + 0.1 or abs(a - DOOR_A) < 0.3:
            continue
        r = R_of(0) + rng.uniform(2, 34)
        p = pol(a, r, 0)
        if k % 3 == 0:
            art = fern_art(rng, rng.randint(16, 22))
            for t in range(3):
                yaw = math.degrees(a) + t * 60 + rng.uniform(-15, 15)
                S.card('fern', art, [p[0], len(art) / 4 - 0.2, p[2]], plane='xy', key=fkey, rot=[rng.uniform(-25, -5), yaw, 0])
        else:
            art = grass_art(rng)
            for t in range(2):
                S.card('grass', art, [p[0], len(art) / 4 - 0.3, p[2]], plane='xy', key=fkey, rot=[0, rng.uniform(0, 180), 0])
    lkey = {'o': 'ochre:2', 'd': 'ochre:3', 'm': 'ochre:4', 'l': 'ochre:5', 'v': 'terra:3'}
    for k in range(18):
        a = rng.uniform(-math.pi, math.pi)
        if abs(a) < OPEN_A:
            continue
        p = pol(a, R_of(0) + rng.uniform(0, 30), 0.25)
        S.card('fallen', leaf_art(rng, 7, 9), p, plane='xz', key=lkey if k % 2 else key, rot=[0, rng.uniform(0, 360), 0])
    return {'roots': S}
