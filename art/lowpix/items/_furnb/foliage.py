"""Hand-pixelled leaf art for foliage cards: every leafy plant is built from many alpha-cut, double-sided cards that
carry detailed pixel-art leaves or leaf clusters (outlines, a lit and a shaded half folded along the midrib, veins,
a highlight dab, darker leaves behind with a drop shadow under the leaves in front).

A Canvas holds ramp indices per pixel (and which ramp); `card_art()` turns it into lowpix card art + art_key with
fixed colours, so the painting is ours and the scene light does the shading in game.
"""
from __future__ import annotations

import math
import random

from kit import P, Item, make_ramp

DIGITS = "0123456789"
SETS = ["0123456789", "abcdefghij", "klmnopqrst", "ABCDEFGHIJ", "KLMNOPQRST", "uvwxyz!$%&"]


class Canvas:
    def __init__(self, W: int, H: int):
        self.W, self.H = W, H
        self.t = [[-1] * W for _ in range(H)]   # tone index
        self.r = [[0] * W for _ in range(H)]    # ramp slot
        self.id = [[-1] * W for _ in range(H)]  # leaf id (for outlines between overlapping leaves)
        self.n = 0

    def leaf(self, cx, cy, length, width, angle, inside, ramp=0, tone=4.0, vein=None, depth=0.0, seed=0, rim=True, fold=True, light=1):
        """Draw one leaf. (cx, cy) is its base in pixels; angle 0 points the tip up (-y), radians clockwise.
        inside(x, a): x across -1..1, a along 0 (base) .. 1 (tip). vein(x, a) marks vein pixels."""
        rr = random.Random(seed)
        lid = self.n
        self.n += 1
        ca, sa = math.cos(angle), math.sin(angle)
        half = width / 2
        pts = [(cx + sa * a * length + ca * x * half, cy - ca * a * length + sa * x * half) for a in (0, 1) for x in (-1, 1)]
        pts += [(cx + sa * 0.5 * length + ca * x * half, cy - ca * 0.5 * length + sa * x * half) for x in (-1, 1)]
        x0, x1 = max(0, int(min(p[0] for p in pts)) - 1), min(self.W - 1, int(max(p[0] for p in pts)) + 1)
        y0, y1 = max(0, int(min(p[1] for p in pts)) - 1), min(self.H - 1, int(max(p[1] for p in pts)) + 1)
        mask = {}
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                along = (dx * sa - dy * ca) / max(length, 1e-6)
                across = (dx * ca + dy * sa) / max(half, 1e-6)
                if 0 <= along <= 1 and -1.2 <= across <= 1.2 and inside(across, along):
                    mask[(x, y)] = (across, along)
        if not mask:
            return
        jit = rr.uniform(-0.35, 0.35)
        # drop shadow of this leaf onto what is already drawn (down-right)
        for (x, y) in mask:
            for (sx, sy) in ((1, 1), (1, 2)):
                X, Y = x + sx, y + sy
                if 0 <= X < self.W and 0 <= Y < self.H and (X, Y) not in mask and self.t[Y][X] >= 0:
                    self.t[Y][X] = max(0, self.t[Y][X] - 1)
        for (x, y), (across, along) in mask.items():
            edge = any((x + dx, y + dy) not in mask for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            tn = tone + jit - depth
            if fold:  # folded along the midrib: one half catches the light
                tn += 1.2 * light if across < 0 else -0.9 * light
            tn += 0.5 * along - 0.6 * (along < 0.12)  # brighter toward the tip, darker at the stalk
            if vein and vein(across, along):
                tn += 1.6 if across < 0 else 1.2
            if edge:
                lit_edge = rim and across < -0.2 and 0.15 < along < 0.85
                tn = tone + 2.8 - depth if lit_edge else max(0.0, tone - 3.6 - depth * 0.5)
            elif rr.random() < 0.012 and across < -0.3:
                tn += 2.0  # a glossy glint
            self.t[y][x] = int(round(min(9, max(0, tn))))
            self.r[y][x] = ramp
            self.id[y][x] = lid

    def stem(self, x0, y0, x1, y1, ramp=0, tone=3, width=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for k in range(n):
            t = k / max(1, n - 1)
            x, y = int(round(x0 + (x1 - x0) * t)), int(round(y0 + (y1 - y0) * t))
            for w in range(width):
                X = x + w
                if 0 <= X < self.W and 0 <= y < self.H:
                    self.t[y][X] = tone + (1 if w == 0 else 0)
                    self.r[y][X] = ramp

    def dot(self, x, y, ramp, tone):
        if 0 <= x < self.W and 0 <= y < self.H:
            self.t[y][x] = tone
            self.r[y][x] = ramp


def card_art(cv: Canvas, ramps: list[str], it: Item) -> tuple[list[str], dict]:
    """Rows of chars plus the art_key mapping every char to a fixed ramp colour."""
    rows_, key = [], {}
    for y in range(cv.H):
        row = []
        for x in range(cv.W):
            t = cv.t[y][x]
            if t < 0:
                row.append(".")
                continue
            slot = cv.r[y][x]
            rn = ramps[slot]
            n = len(it.ramps[rn])
            t = min(t, n - 1)
            ch = SETS[slot][t]
            key[ch] = f"{rn}:{t}"
            row.append(ch)
        rows_.append("".join(row))
    return rows_, key


def leaf_ramp(it: Item, name: str, base, n: int = 10) -> str:
    """A 10-step foliage ramp: deep shade, mid greens, sunlit edge, a pale glint."""
    if name not in it.ramps:
        it.ramps[name] = make_ramp(base, n=n, lo=1.25, hi=1.15, at=4)
    return name


# ------------------------------------------------------------------ leaf shapes (x across -1..1, a along 0..1)
def ovate(point=0.75):
    return lambda x, a: abs(x) <= math.sin(math.pi * min(1, a) ** point) * (1 - 0.15 * a)


def lanceolate():
    return lambda x, a: abs(x) <= math.sin(math.pi * min(1, a) ** 0.9) ** 1.3


def fiddle():
    def f(x, a):
        h = 0.3 + 0.66 * math.sin(math.pi * min(1, a * 1.02) ** 1.25) - 0.08 * math.exp(-((a - 0.45) / 0.09) ** 2)
        if a > 0.9:
            h *= max(0, (1 - a) / 0.1) ** 0.5
        return abs(x) <= h and a > 0.02
    return f


def monstera(seed=0, juvenile=False):
    r = random.Random(seed)
    cuts = [] if juvenile else [0.2 + i * 0.15 + r.uniform(-0.02, 0.02) for i in range(5)]
    holes = [] if juvenile else [(s_ * r.uniform(0.3, 0.42), c + 0.07, 0.05) for c in cuts[:-1] for s_ in (-1, 1) if r.random() < 0.7]

    def half(a):
        return 0.97 * math.sin(math.pi * min(1.0, max(0.0, a)) ** 0.62)

    def f(x, a):
        h = half(a)
        if abs(x) > h or a > 0.985:
            return False
        if a < 0.1 and abs(x) < 0.16 * (1 - a / 0.1):
            return False
        q = abs(x) / max(h, 0.01)
        for c in cuts:
            if q > 0.5 and abs(a - (c + (q - 0.5) * 0.3)) < 0.02:
                return False
        for (hx, ha, hr) in holes:
            if ((x - hx) / 0.6) ** 2 + ((a - ha) * 1.4) ** 2 < hr * hr * 0.6:
                return False
        return True
    f.cuts = cuts
    return f


def palmate(lobes=5, depth=0.35, sharp=1.0):
    """Maple / ivy style: lobes radiating from the stalk end."""
    def f(x, a):
        px, py = x, (a - 0.42) * 2.1
        th = math.atan2(px, py)
        rr_ = math.hypot(px, py)
        k = abs(math.cos(th * lobes / 2)) ** sharp
        R = (1 - depth) + depth * k
        return rr_ < R * 0.98 and not (py < -0.75 and abs(px) > 0.12)
    return f


def round_scalloped(n=11):
    def f(x, a):
        px, py = x, (a - 0.5) * 2
        th = math.atan2(py, px)
        R = 0.9 + 0.08 * math.cos(th * n)
        return math.hypot(px, py) < R and not (py < -0.72 and abs(px) < 0.12)
    return f


def heartlet():
    """A clover leaflet."""
    def f(x, a):
        px, py = x, a * 2 - 1
        return (px * px + (py - math.sqrt(abs(px)) * 0.7) ** 2) < 0.75
    return f


def midrib(w=0.06, side=None):
    def v(x, a):
        if abs(x) < w and a > 0.05:
            return True
        if side:
            return abs(((a - abs(x) * side) * 6) % 1 - 0.5) < 0.05 and abs(x) < 0.8 and a > 0.1
        return False
    return v


def radial_veins(n=5):
    def v(x, a):
        px, py = x, (a - 0.42) * 2.1
        th = math.atan2(px, py)
        return abs(((th / math.pi) * n / 2 + 0.5) % 1 - 0.5) < 0.06 and math.hypot(px, py) < 0.8
    return v


# ------------------------------------------------------------------ ready-made cards
def single(W, H, shape, vein=None, ramp=0, tone=4.0, seed=0, stalk=True):
    """One big leaf filling the card, base at the bottom centre."""
    cv = Canvas(W, H)
    if stalk:
        cv.stem(W // 2, H - 1, W // 2, int(H * 0.94), ramp, 2, 1)
    cv.leaf(W / 2, H - 0.5, H * 0.98, W * 0.98, 0.0, shape, ramp, tone, vein, seed=seed)
    return cv


def cluster(W, H, shape, n, leaf_len, leaf_w, vein=None, ramp=0, tone=4.0, seed=0, spread=1.0, stems=True, ramps=None, fan=1.1):
    """A spray of leaves from a twig at the bottom centre: back leaves darker, front leaves brighter."""
    r = random.Random(seed)
    cv = Canvas(W, H)
    base = (W / 2, H - 1)
    items = []
    for k in range(n):
        ang = r.uniform(-fan, fan) * spread
        reach = r.uniform(0.25, 0.75)
        bx = base[0] + math.sin(ang) * reach * (H - leaf_len) * 0.9
        by = base[1] - math.cos(ang) * reach * (H - leaf_len) * 0.9
        L = leaf_len * r.uniform(0.75, 1.1)
        items.append((reach + r.uniform(-0.2, 0.2), bx, by, L, leaf_w * L / leaf_len, ang + r.uniform(-0.35, 0.35)))
    items.sort(key=lambda t: t[0])  # far/back first
    if stems:
        for (_, bx, by, *_r) in items:
            cv.stem(base[0], base[1], bx, by, ramp, 2, 1)
    for k, (depth_key, bx, by, L, Wd, ang) in enumerate(items):
        depth = 1.2 * (1 - k / max(1, len(items) - 1))
        rp = ramp if not ramps else ramps[k % len(ramps)]
        cv.leaf(bx, by, L, Wd, ang, shape, rp, tone, vein, depth=depth, seed=seed * 31 + k)
    return cv


def frond(W, H, ramp=0, tone=4.0, seed=0, pinnae=11):
    """A fern frond: a curved rachis with paired leaflets shrinking to the tip."""
    r = random.Random(seed)
    cv = Canvas(W, H)
    pts = []
    for k in range(H):
        t = k / (H - 1)
        pts.append((W / 2 + math.sin(t * 2.2) * W * 0.08, H - 1 - k))
    for (x, y) in pts:
        cv.dot(int(x), int(y), ramp, 2)
    for i in range(pinnae):
        t = 0.08 + 0.88 * i / pinnae
        x, y = pts[int(t * (H - 1))]
        L = (1 - t) * W * 0.5 + 2
        for s in (-1, 1):
            cv.leaf(x, y, L, max(2.2, L * 0.38), s * (1.25 - t * 0.4), lanceolate(), ramp, tone, None, depth=0.6 * (1 - t), seed=seed + i * 2 + (s > 0))
    return cv


def florets(W, H, petal_ramp, centre_ramp, leaf_ramp=None, n=7, seed=0, size=3):
    """A ball of five-petalled florets (geranium, lobelia, cherry blossom)."""
    r = random.Random(seed)
    cv = Canvas(W, H)
    for k in range(n):
        a = r.uniform(0, 2 * math.pi)
        d = r.uniform(0, 0.42) * min(W, H)
        cx, cy = W / 2 + math.cos(a) * d, H / 2 + math.sin(a) * d
        depth = 1.0 - k / n
        for p in range(5):
            pa = p / 5 * 2 * math.pi + r.uniform(0, 1)
            cv.leaf(cx, cy, size, size * 0.9, pa, ovate(0.6), petal_ramp, 5.0, None, depth=depth, seed=seed * 7 + k * 5 + p, fold=False, rim=False)
        cv.dot(int(cx), int(cy), centre_ramp, 6)
    return cv


def add(it: Item, pid: str, cv: Canvas, ramps: list[str], at, rotation=(0, 0, 0), offset=None, parent=None, anchor="base", plane="xy") -> str:
    """Place a canvas as a foliage card (1 art pixel = 1 texel at the item's density). anchor 'base' puts the card's
    bottom centre on `at` (leaves and sprays grow from there); 'centre' centres it."""
    rows_, key = card_art(cv, ramps, it)
    w, h = cv.W / it.density, cv.H / it.density
    st = it.style("foliage_card", {"ramp": ramps[0], "tone": 4, "light": 0.0, "rim": {"light": 0, "dark": 0}, "brush": {"off": True}, "dither": 0.0})
    off = list(offset) if offset is not None else ([0, h / 2, 0] if anchor == "base" else [0, 0, 0])
    return it.card(pid, tuple(at), st, art=rows_, size=(w, h), rotation=list(rotation), offset=off, parent=parent, key=key, plane=plane)


def sway(ids, amp=2.5, cycles=1, axis="x"):
    return [{"part": pid, "osc": {"axis": axis, "amp": amp, "cycles": cycles, "phase": (k * 0.17) % 1}} for k, pid in enumerate(ids)]
