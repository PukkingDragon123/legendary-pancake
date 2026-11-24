"""House plants built from 2D detailed pixel-art leaf cards: every leaf is an alpha-cut card with a hand-pixelled
leaf (outline, three shading bands lit from the upper left, a light midrib and side veins, variegation on the
pothos), many cards per plant. All the leaves hang off a joint called `leaves` so the game can sway them.

leaf_art(kind, w, h, seed) is shared with the ivy, the wall shelf and the window sill (office.py imports it)."""
import math
import random

from _kit import Spec, flat, glaze, wood

KEYS = {
    'pothos': {'o': 'pine:1', 'd': 'leaf:2', 'm': 'leaf:3', 'l': 'fern:4', 'h': 'sage:4', 'v': 'sage:3', 'c': 'cream:3'},
    'rubber': {'o': 'pine:0', 'd': 'pine:2', 'm': 'pine:3', 'l': 'leaf:4', 'h': 'sage:5', 'v': 'leaf:4', 'c': 'leaf:4'},
    'fern': {'o': 'pine:1', 'd': 'fern:2', 'm': 'fern:3', 'l': 'moss:4', 'h': 'sage:4', 'v': 'moss:3', 'c': 'moss:4'},
    'ivy': {'o': 'pine:1', 'd': 'leaf:2', 'm': 'leaf:3', 'l': 'leaf:4', 'h': 'moss:5', 'v': 'sage:4', 'c': 'sage:4'},
    'succ': {'o': 'pine:1', 'd': 'sage:2', 'm': 'sage:3', 'l': 'sage:4', 'h': 'mist:4', 'v': 'sage:4', 'c': 'rose:3'},
}


def _width(kind, t):
    """Half-width (-1..1 units of the card) of a leaf at t = 0 (stem) .. 1 (tip)."""
    if kind in ('pothos', 'ivy'):  # heart: lobes at the base, a drawn-out tip
        return 0.95 * math.sin(math.pi * min(1.0, t * 0.92 + 0.08)) ** 0.75 * (1.0 - 0.45 * t)
    if kind == 'rubber':  # a long glossy oval
        return 0.9 * math.sin(math.pi * t) ** 0.85
    if kind == 'succ':  # a fleshy pointed blade
        return 0.85 * (1 - t) ** 0.6 * min(1.0, t * 6 + 0.4)
    return 0.8 * math.sin(math.pi * t) ** 0.9


def leaf_art(kind, w, h, seed=1, bend=0.0):
    """A single leaf, pointing up (stem at the bottom row), as card art rows."""
    rnd = random.Random(seed)
    inside = [[False] * w for _ in range(h)]
    grid = [['.'] * w for _ in range(h)]
    var = [(rnd.uniform(0.2, 0.9), rnd.uniform(-0.6, 0.6), rnd.uniform(0.08, 0.16)) for _ in range(4)]
    for y in range(h):
        t = 1 - (y + 0.5) / h
        cx = bend * t * t
        hw = _width(kind, t)
        for x in range(w):
            u = (x + 0.5) / w * 2 - 1 - cx
            if abs(u) > hw or (kind in ('pothos', 'ivy') and t < 0.1 and abs(u) < 0.14):
                continue
            inside[y][x] = True
            un = u / max(hw, 1e-3)
            tone = 0.52 - 0.3 * un + 0.22 * (t - 0.4) + rnd.uniform(-0.06, 0.06)
            ch = 'd' if tone < 0.32 else 'm' if tone < 0.55 else 'l' if tone < 0.8 else 'h'
            if abs(u) < 0.06 + 0.03 * (1 - t):
                ch = 'v'
            elif kind != 'succ' and ((t - abs(u) * 0.55) % 0.2) < 0.035 and abs(u) < hw * 0.85:
                ch = 'l' if ch in ('d', 'm') else 'm'
            if kind == 'pothos':
                for vt, vu, vr in var:
                    if (t - vt) ** 2 + (un - vu) ** 2 * 0.25 < vr * vr * 0.5:
                        ch = 'c'
            if kind == 'rubber' and 0.15 < t < 0.85 and -0.55 < un < -0.3:
                ch = 'h'  # the glossy shine
            grid[y][x] = ch
    for y in range(h):
        for x in range(w):
            if not inside[y][x]:
                continue
            edge = any(not (0 <= x + dx < w and 0 <= y + dy < h and inside[y + dy][x + dx]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                lit = (x < w / 2 and y < h * 0.7)
                grid[y][x] = 'h' if lit and rnd.random() < 0.35 else 'o'
    # a short stalk below the leaf
    sx = w // 2
    for y in range(h - 2, h):
        grid[y][sx] = grid[y][sx] if inside[y][sx] else 'v'
    return [''.join(r) for r in grid]


def frond_art(n=30, seed=1):
    """A fern frond: a rachis with shaded leaflets that shrink towards the tip."""
    rnd = random.Random(seed)
    W = 15
    g = [['.'] * W for _ in range(n)]
    for y in range(n):
        t = 1 - y / n
        g[y][W // 2] = 'v'
        span = int(6.5 * math.sin(math.pi * min(1, (t * 1.05 + 0.05)))) if t > 0.05 else 0
        if y % 2 == 0 and span > 0:
            for sd in (-1, 1):
                for k in range(1, span + 1):
                    yy = y + (1 if k > span * 0.6 else 0)
                    if yy >= n:
                        continue
                    ch = ('l' if sd < 0 else 'm') if k < span else 'o'
                    if k == 1:
                        ch = 'd'
                    if rnd.random() < 0.08:
                        ch = 'h'
                    g[yy][W // 2 + sd * k] = ch
    return [''.join(r) for r in g]


def _leafstyle(S, kind, name=None):
    return S.style(name or 'leaf_' + kind, dict(ramp='leaf', brush={'off': True}, art_key=KEYS[kind]))


def plant_floor():
    """A rubber plant in a glazed pot: three woody stems and ~36 glossy leaf cards spiralling up. ~1.7 tall."""
    S = Spec('plant_floor', density=90)
    S.styles(pot=glaze('clay', 3.2, layers=[dict(op='band', id='rim', axis='z', **{'from': 0.62, 'to': 1.0}, shift=0.7),
                                             dict(op='band', id='glz', axis='z', **{'from': -0.5, 'to': 0.2}, ramp='sage', tone=3.0)]),
             soil=flat('soil', 2.2, layers=[dict(op='noise', id='lumps', scale=0.05, amount=1.0)]),
             stem=wood('walnut', 3.0, worn=False))
    lf = _leafstyle(S, 'rubber')
    S.cyl('pot', 0.3, 0.5, 0, 0, 0, sides=12, style='pot', back_scale=[0.8, 0.8])
    S.cyl('lip', 0.32, 0.07, 0, 0.47, 0, sides=12, style='pot')
    S.cyl('soil', 0.28, 0.02, 0, 0.5, 0, sides=12, style='soil')
    S.bone('leaves', [0, 0.52, 0])
    rnd = random.Random(9)
    for s, (sx, sz, top) in enumerate(((-0.06, 0.02, 1.05), (0.07, -0.03, 1.2), (0.0, 0.08, 0.85))):
        S.rod('stem', [sx, 0, sz], [sx * 2.5, top, sz * 2.5], 0.018, sides=5, style='stem', parent='leaves')
        n = 12
        for k in range(n):
            t = 0.25 + 0.75 * k / n
            a = k * 2.4 + s
            x, y, z = sx + sx * 1.5 * t, top * t, sz + sz * 1.5 * t
            art = leaf_art('rubber', 18, 36, seed=s * 50 + k, bend=rnd.uniform(-0.3, 0.3))
            S.card('leaf', art, [x, y, z], plane='xy', parent='leaves', style=lf, double_sided=True,
                   rot=[-rnd.uniform(35, 70), math.degrees(a), rnd.uniform(-12, 12)], offset=[0, 18 / 90, 0])
    return S


def plant_pothos():
    """A pothos in a cream pot: a mound of variegated heart leaves and vines trailing over the rim. ~0.6 tall."""
    S = Spec('plant_pothos', density=110)
    S.styles(pot=glaze('cream', 3.4, layers=[dict(op='band', id='band', axis='z', **{'from': -0.2, 'to': 0.1}, ramp='lake', tone=3.0)]),
             soil=flat('soil', 2.2), vine=flat('fern', 2.8))
    lf = _leafstyle(S, 'pothos')
    S.cyl('pot', 0.2, 0.3, 0, 0, 0, sides=10, style='pot', back_scale=[0.85, 0.85])
    S.cyl('soil', 0.18, 0.02, 0, 0.3, 0, sides=10, style='soil')
    S.bone('leaves', [0, 0.3, 0])
    rnd = random.Random(4)
    for k in range(40):
        a = rnd.uniform(0, math.tau)
        r = rnd.uniform(0.03, 0.19)
        S.card('leaf', leaf_art('pothos', 20, 22, seed=k, bend=rnd.uniform(-0.25, 0.25)), [math.sin(a) * r, rnd.uniform(0.0, 0.14), math.cos(a) * r],
               plane='xy', parent='leaves', style=lf, double_sided=True, rot=[-rnd.uniform(40, 85), math.degrees(a), rnd.uniform(-20, 20)], offset=[0, 0.1, 0])
    for v in range(4):
        a = v / 4 * math.tau + 0.4
        x0, z0 = math.sin(a) * 0.19, math.cos(a) * 0.19
        L = rnd.uniform(0.35, 0.6)
        S.rod('vine', [x0, 0.0, z0], [x0 * 1.3, -L, z0 * 1.3], 0.008, sides=4, style='vine', parent='leaves')
        for k in range(5):
            t = (k + 0.5) / 5
            S.card('leaf', leaf_art('pothos', 16, 18, seed=100 + v * 10 + k, bend=rnd.uniform(-0.3, 0.3)), [x0 * (1 + 0.3 * t), -L * t, z0 * (1 + 0.3 * t)],
                   plane='xy', parent='leaves', style=lf, double_sided=True, rot=[rnd.uniform(-30, 10), math.degrees(a) + rnd.uniform(-40, 40), rnd.uniform(140, 220)], offset=[0, 0.08, 0])
    return S


def plant_fern():
    """A small Boston fern in a terracotta pot: a fountain of shaded fronds. ~0.55 tall."""
    S = Spec('plant_fern', density=100)
    S.styles(pot=glaze('terracotta', 3.2, layers=[dict(op='band', id='rim', axis='z', **{'from': 0.55, 'to': 1.0}, shift=0.7)]), soil=flat('soil', 2.2))
    lf = _leafstyle(S, 'fern')
    S.cyl('pot', 0.13, 0.17, 0, 0, 0, sides=10, style='pot', back_scale=[0.8, 0.8])
    S.cyl('soil', 0.12, 0.02, 0, 0.17, 0, sides=10, style='soil')
    S.bone('leaves', [0, 0.18, 0])
    rnd = random.Random(2)
    for k in range(16):
        a = k / 16 * 360 + rnd.uniform(-10, 10)
        S.card('frond', frond_art(30, k), [0, 0, 0], plane='xy', parent='leaves', style=lf, double_sided=True,
               rot=[-rnd.uniform(25, 70), a, rnd.uniform(-10, 10)], offset=[0, 0.15, 0])
    return S


def specs():
    return {f.__name__: f() for f in (plant_floor, plant_pothos, plant_fern)}
