"""Reusable furniture pieces for furnB's recipes (all in px, centred coordinates)."""
from __future__ import annotations

import math

from kit import Item, P, fabric, glass, grid, metal, plain, put, rows, stitch_rect, wood

BOBBIN = [1.0, 0.72, 1.12, 0.62, 0.92, 0.66, 1.1, 0.78, 1.0]


def turned_leg(it: Item, pid: str, x: float, z: float, h: float, r: float, st: str, y0: float = 0.0, prof=BOBBIN, sides: int = 8) -> str:
    """A lathe-turned leg: a loft through rings that bulge and pinch like a bobbin."""
    n = len(prof)
    rings = [(0, y0 + h * i / (n - 1), 0, 2 * r * k) for i, k in enumerate(prof)]
    return it.loft(pid, rings, st, sides=sides, round_=2.0, pivot=(x, 0, z), subdiv=0, up=[0, 0, 1])


def tapered_leg(it: Item, pid: str, x: float, z: float, h: float, r0: float, r1: float, st: str, y0: float = 0.0, sides: int = 6, splay=(0, 0)) -> str:
    rings = [(0, y0, 0, 2 * r1), (splay[0] * 0.5, y0 + h * 0.5, splay[1] * 0.5, 2 * (r0 + r1) / 2), (splay[0], y0 + h, splay[1], 2 * r0)]
    return it.loft(pid, rings, st, sides=sides, round_=2.0, pivot=(x, 0, z), subdiv=1, up=[0, 0, 1])


def knob(it: Item, pid: str, x: float, y: float, z: float, st: str, r: float = 0.6, depth: float = 0.8) -> str:
    """A round drawer knob sticking out along +z."""
    return it.cyl(pid, (x, y, z + depth / 2), r, depth, st, sides=6, axis="z")


def drawer(it: Item, pid: str, c, w: float, h: float, st: str, pull: str | None = None, pulls: int = 1, keyhole: str | None = None, d: float = 0.6, panel=True):
    """A drawer front (a thin box on the +z face) with a recessed panel and brass knobs or a keyhole."""
    paint = {"layers": [{"id": "panel", "op": "panel", "inset": 1, "shift": -1.4, "highlight": 0.8, "shadow": -0.6, "min_size": 5}]} if panel else None
    it.box(pid, c, (w, h, d), st, ch=0.25, paint=paint)
    if pull:
        if pulls == 1:
            knob(it, pid + "_knob", c[0], c[1], c[2] + d / 2, pull, r=min(0.7, h * 0.22))
        else:
            for s in (-1, 1):
                knob(it, pid + "_knob", c[0] + s * w * 0.28, c[1], c[2] + d / 2, pull, r=min(0.7, h * 0.22))
    if keyhole:
        it.box(pid + "_key", (c[0], c[1], c[2] + d / 2 + 0.1), (0.8, 1.2, 0.2), keyhole)


def book_style(it: Item, key: str, cover, band=None) -> str:
    """Cloth-bound book: spine bands and a gilt title block on the sides, ruled pages on top/ends."""
    rn = it.ramp(f"cl_book_{key}", cover, n=6, lo=0.9, hi=0.8)
    pr = it.ramp("pa_pages", P["paper"], n=5, lo=0.6, hi=0.5, at=3)
    gr = it.ramp("br_gilt", 0xd8b66a, n=5, lo=0.9, hi=0.9)
    layers = [
        {"id": "mottle", "op": "noise", "scale": 1.5, "amount": 0.4},
        {"id": "pages", "op": "fill", "ramp": pr, "tone": 2.6, "faces": ["top", "bottom", "back"]},
        {"id": "leaves", "op": "stripes", "axis": "y", "period": 0.34, "width": 0.4, "shift": -0.8, "faces": ["back"]},
        {"id": "leavest", "op": "stripes", "axis": "x", "period": 0.34, "width": 0.4, "shift": -0.8, "faces": ["top", "bottom"]},
        {"id": "gilt1", "op": "band", "axis": "y", "from": 0.55, "to": 0.68, "ramp": gr, "tone": 2.6, "faces": ["front"]},
        {"id": "gilt2", "op": "band", "axis": "y", "from": -0.72, "to": -0.6, "ramp": gr, "tone": 2.3, "faces": ["front"]},
        {"id": "title", "op": "rect", "rect": [0.25, 0.3, 0.75, 0.42], "ramp": gr, "tone": 3.0, "faces": ["front"]},
    ]
    if band is not None:
        br = it.ramp(f"cl_book_{key}_b", band, n=5, lo=0.8, hi=0.8)
        layers.append({"id": "band", "op": "band", "axis": "y", "from": -0.2, "to": 0.15, "ramp": br, "tone": 2.4, "faces": ["front", "left", "right"]})
    st = {"ramp": rn, "tone": 2.8, "rim": {"light_shift": 0.8, "dark_shift": -0.8}, "brush": {"off": True}, "dither": 0.0, "layers": layers}
    return it.style(f"book_{key}", st)


BOOK_COLS = [P["berry"], P["pine"], P["dusk"], P["ochre"], P["plum"], P["clay"], P["fern"], P["slate"], 0x7c4f3e, P["lake"], P["russet"]]


def books(it: Item, pid: str, x0: float, x1: float, y: float, z: float, depth: float, hmax: float, seed: int = 1, gap_at=None, lean_last=True):
    """A row of books standing on a shelf from x0 to x1 (spines face +z)."""
    import random
    r = random.Random(seed)
    x = x0
    k = 0
    while x < x1 - 0.8:
        w = r.choice([0.9, 1.0, 1.2, 1.4, 1.6])
        if x + w > x1:
            w = x1 - x
        h = hmax * r.uniform(0.7, 1.0)
        dz = depth * r.uniform(0.8, 1.0)
        c = BOOK_COLS[(seed * 3 + k * 5) % len(BOOK_COLS)]
        st = book_style(it, f"{(seed * 3 + k * 5) % len(BOOK_COLS)}", c, band=P["brass"] if k % 3 == 1 else None)
        if gap_at is not None and k == gap_at:
            x += 2.2
        last = lean_last and x + w + 1.5 >= x1 and k > 2
        if last:
            it.box(pid, (x + w / 2 + h * 0.15, y + h / 2 - 0.1, z - depth / 2 + dz / 2), (w, h, dz), st, rot=(0, 0, -16))
            break
        it.box(pid, (x + w / 2, y + h / 2, z - depth / 2 + dz / 2), (w, h, dz), st)
        x += w + 0.05
        k += 1


def doily_art(w: int, h: int) -> list[str]:
    """Crochet doily (top view): concentric lace rings with holes and a scalloped edge."""
    g = grid(w, h)
    cx, cy = (w - 1) / 2, (h - 1) / 2
    R = min(w, h) / 2
    for y in range(h):
        for x in range(w):
            dx, dy = (x - cx) / R, (y - cy) / R
            d, a = math.hypot(dx, dy), math.atan2(dy, dx)
            edge = 0.9 + 0.08 * math.cos(a * 12)
            if d > edge:
                continue
            ring = int(d * 7)
            hole = (ring % 2 == 1) and (int((a + math.pi) / (2 * math.pi) * (8 + ring * 4)) % 2 == 0)
            if hole:
                continue
            g[y][x] = "w" if (x + y) % 3 else "l"
            if d > edge - 0.08:
                g[y][x] = "l"
    return rows(g)
