"""Foliage as 2D detailed pixel-art leaf cards (alpha-cut, hand-pixelled leaf clusters, many per plant): fir sprigs,
broadleaf clusters and the builders that arrange them into firs, bushes, crowns and garlands."""
import math

from lib import HD, hsh
from pix import Pix

# chars: d deep shadow, n dark, m mid, l lit, h highlight, v vein / twig, s snow, b berry
FIR_KEY = {"d": "pine:1", "n": "pine:2", "m": "pine:4", "l": "pine:5", "h": "pine:6", "v": "bark:3", "s": "snow:6",
           "S": "snow:5"}
LEAF_KEY = {"d": "leaf:1", "n": "leaf:2", "m": "leaf:4", "l": "leaf:5", "h": "leaf:6", "v": "leaf:3", "s": "snow:6",
            "S": "snow:5", "b": "holly:4"}


def card_style(ramp, light=0.75):
    return {"ramp": ramp, "tone": 4, "light": light, "brush": {"off": True}, "rim": {"light": 0, "dark": 0}}


def fir_sprig(cols, rows, seed=0, snow=0.0, droop=0.0):
    """A fir sprig drawn needle by needle: a twig along x (base at the left), side twigs, short needles angled toward
    the tip in light and shadow tones, paler new growth at the tips, optional snow dabs on the upper needles."""
    p = Pix(cols, rows)
    cy = rows / 2

    def twig_y(x):
        return cy + droop * (x / cols) ** 2 * rows * 0.3

    def needles(x0, y0, x1, y1, length, tone_bias):
        n = int(math.hypot(x1 - x0, y1 - y0) / 0.9) + 1
        for i in range(n):
            t = i / max(1, n - 1)
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            L = length * (1 - 0.6 * t ** 2)
            for side in (-1, 1):
                ang = math.atan2(y1 - y0, x1 - x0) + side * 0.95
                ex, ey = x + math.cos(ang) * L, y + math.sin(ang) * L
                up = side * (1 if math.sin(ang) < 0 else -1)
                r = hsh(seed, i, side, int(x))
                ch = "h" if (t > 0.78 and r > 0.4) else ("l" if side < 0 and r > 0.35 else "m" if r > 0.3 else "n")
                if tone_bias < 0 and ch in "lh":
                    ch = "m"
                p.line(x, y, ex, ey, ch)
                if snow and side < 0 and r > 1 - snow:
                    p.set(ex, ey, "s")
                    p.set(ex - 1, ey, "S")
    # side twigs first (behind), then the main twig on top
    k = 0
    for x in range(int(cols * 0.12), int(cols * 0.8), max(3, cols // 7)):
        for side in (-1, 1):
            if hsh(seed, x, side) < 0.2:
                continue
            ln = cols * (0.18 + 0.14 * hsh(seed, x, side, 3)) * (1 - x / cols * 0.6)
            x1, y1 = x + ln * 0.75, twig_y(x) + side * ln * 0.6
            needles(x, twig_y(x), x1, y1, rows * 0.16, -1 if side > 0 else 1)
            p.line(x, twig_y(x), x1, y1, "v")
            k += 1
    needles(0, twig_y(0), cols - 1, twig_y(cols - 1), rows * 0.2, 1)
    for x in range(cols - 1):
        p.set(x, twig_y(x), "v")
    # a darker under-layer so the sprig has depth
    p.map(lambda x, y, c: "d" if c == "n" and y > twig_y(x) + 1 and hsh(x, y, seed) > 0.4 else c)
    return p.rows


def leaf_cluster(cols, rows, seed=0, leaves=9, shape="round", berries=0):
    """A cluster of overlapping leaves, each with a lit upper-left half, a shaded lower-right half, a dark rim and a
    midrib; back leaves darker than front ones."""
    p = Pix(cols, rows)
    cx, cy = cols / 2, rows / 2
    for i in range(leaves):
        depth = i / max(1, leaves - 1)          # 0 back .. 1 front
        a = hsh(seed, i) * math.pi * 2
        rr = (0.15 + 0.3 * hsh(seed, i, 1)) * min(cols, rows)
        lx, ly = cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.8
        L = min(cols, rows) * (0.26 + 0.12 * hsh(seed, i, 2))
        W = L * (0.42 if shape == "round" else 0.3)
        ang = a + (hsh(seed, i, 3) - 0.5) * 1.2
        ca, sa = math.cos(ang), math.sin(ang)
        for y in range(int(ly - L - 1), int(ly + L + 2)):
            for x in range(int(lx - L - 1), int(lx + L + 2)):
                dx, dy = x + 0.5 - lx, y + 0.5 - ly
                u = dx * ca + dy * sa            # along the leaf (0 at its base centre)
                v = -dx * sa + dy * ca           # across
                t = (u + L * 0.5) / L            # 0 base .. 1 tip
                if t < 0 or t > 1:
                    continue
                if shape == "holly":
                    half = W * math.sin(math.pi * t) * (0.75 + 0.25 * math.cos(t * math.pi * 6))
                else:
                    half = W * math.sin(math.pi * t ** 0.85)
                if abs(v) > half:
                    continue
                edge = abs(v) > half - 0.9
                lit = (v < 0) ^ (sa > 0)
                if abs(v) < 0.45 and 0.08 < t < 0.92:
                    ch = "v"
                elif edge:
                    ch = "d" if depth < 0.5 else "n"
                elif lit:
                    ch = "h" if (depth > 0.7 and t > 0.5 and abs(v) < half * 0.5) else ("l" if depth > 0.4 else "m")
                else:
                    ch = "m" if depth > 0.5 else "n"
                p.set(x, y, ch)
    for j in range(berries):
        bx, by = cx + (hsh(seed, j, 7) - 0.5) * cols * 0.3, cy + (hsh(seed, j, 8) - 0.5) * rows * 0.3
        p.disc(bx, by, max(1.0, min(cols, rows) * 0.08), "b")
        p.set(bx - 0.5, by - 0.5, "h")
    return p.rows


def fir(S, id, base, height, radius, tiers=5, snow=0.25, parent=None, ramp="pine", core=True, seed=0, density_k=1.0):
    """A small fir from whorls of drooping fir-sprig cards round a thin dark core."""
    from lib import leafy
    d = S.density * HD
    if core:
        S.lathe(f"{id}_core", [(radius * 0.45, 0), (radius * 0.3, height * 0.45), (0.1, height * 0.95)], base,
                leafy(ramp, tone=2.4), parent=parent, sides=6, caps=(True, False), subdiv=0)
    n = 0
    for k in range(tiers):
        f = k / max(1, tiers - 1)
        y = base[1] + height * (0.12 + 0.78 * f)
        L = radius * (1.0 - 0.75 * f) + 0.4
        cnt = max(4, int((7 - k) * density_k))
        for j in range(cnt):
            a = j * 360 / cnt + k * 31 + seed * 17
            S.bone(f"{id}_j{n}", (base[0], y, base[2]), parent=parent, rot=(0, -a, 0))
            droop = 24 + k * 4
            cols, rows = max(6, round(L * d)), max(4, round(L * 0.7 * d))
            art = fir_sprig(cols, rows, seed=seed * 100 + n, snow=snow, droop=0.3)
            S.card(f"{id}_b{n}", art, S.at(f"{id}_j{n}", (L / 2 * math.cos(math.radians(droop)),
                                                          -L / 2 * math.sin(math.radians(droop)), 0)),
                   card_style(ramp), parent=f"{id}_j{n}", plane="xz", rot=(0, 0, -droop),
                   pivot=S.at(f"{id}_j{n}", (0, 0, 0)), key=FIR_KEY, native=True)
            n += 1
    # the leader at the top
    cols, rows = max(4, round(height * 0.25 * d)), max(6, round(height * 0.3 * d))
    S.card(f"{id}_top", fir_sprig(rows, cols, seed=seed + 7, snow=snow)[::1], (base[0], base[1] + height * 0.92, base[2]),
           card_style(ramp), parent=parent, rot=(0, 0, 90), key=FIR_KEY, native=True)


def bush(S, id, centre, radius, ramp="leaf", cards=14, parent=None, seed=0, squash=(1, 0.8, 1), shape="round",
         berries=0, core=True):
    """A crown or bush: leaf-cluster cards facing outward all round a small dark core, overlapping like real foliage."""
    from lib import plain
    d = S.density * HD
    if core:
        S.ball(f"{id}_core", radius * 0.6, centre, plain(ramp, tone=2.2, noise=0.6), parent=parent, sides=6, rings=4,
               squash=squash)
    key = dict(LEAF_KEY)
    if ramp != "leaf":
        key.update({k: f"{ramp}:{v.split(':')[1]}" for k, v in LEAF_KEY.items() if v.startswith("leaf")})
    size = radius * 1.15
    cols = max(6, round(size * d))
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(cards):
        yv = 1 - 2 * (i + 0.5) / cards
        r = math.sqrt(max(0, 1 - yv * yv))
        a = i * golden + seed
        nx, ny, nz = math.cos(a) * r, yv, math.sin(a) * r
        pos = (centre[0] + nx * radius * 0.72 * squash[0], centre[1] + ny * radius * 0.72 * squash[1],
               centre[2] + nz * radius * 0.72 * squash[2])
        yaw = math.degrees(math.atan2(nx, nz))
        pitch = -math.degrees(math.asin(max(-1, min(1, ny)))) * 0.8
        art = leaf_cluster(cols, cols, seed=seed * 50 + i, leaves=8 + i % 4, shape=shape, berries=berries)
        S.card(f"{id}_c{i}", art, pos, card_style(ramp), parent=parent, rot=(pitch, yaw, 0), key=key, native=True)


def single_leaf(cols, rows, shape="ovate", seed=0, frost=False):
    """One leaf pointing up (base at the bottom row): a lit left half, a shaded right half, a dark rim, a midrib with
    side veins, a slightly wavy edge; optional frosted tip."""
    p = Pix(cols, rows)
    cx = cols / 2
    for y in range(rows):
        t = 1 - (y + 0.5) / rows               # 0 base .. 1 tip
        if shape == "lance":
            half = cols * 0.5 * math.sin(math.pi * min(1, t * 1.05)) ** 0.9
        else:
            half = cols * 0.5 * math.sin(math.pi * min(1, t ** 0.8)) * (1 - 0.15 * t)
        half *= 1 + 0.06 * math.sin(y * 1.7 + seed)
        for x in range(cols):
            v = x + 0.5 - cx
            if abs(v) > half:
                continue
            vein_t = (t * 7 + abs(v) / max(cols, 1) * 4) % 1
            if abs(v) < 0.55 and t < 0.95:
                ch = "v"
            elif abs(v) > half - 0.9:
                ch = "d"
            elif vein_t < 0.12 and abs(v) < half - 1.5:
                ch = "v"
            elif v < 0:
                ch = "h" if (abs(v) < half * 0.45 and 0.3 < t < 0.8) else "l"
            else:
                ch = "m" if abs(v) < half * 0.6 else "n"
            if frost and t > 0.86:
                ch = "s" if ch != "d" else "S"
            p.set(x, y, ch)
    return p.rows
