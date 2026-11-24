"""House plants and rugs (src/assets/decor/green.ts ids)."""
from __future__ import annotations

import math
import random

from kit import (P, Item, clay, fabric, face_px, glass, glaze, grid, ink, knit, leaf_card, leafy, metal, moss, painted, patch_layers, plain,
                 rows, soft, soil, stitch_art, wicker, wood)

ITEMS = {}


def item(fn):
    ITEMS[fn.__name__] = fn
    return fn


# ------------------------------------------------------------------ leaf art (card pixel art; tip at the top row)
def art_from(W, H, inside, vein=None, edge=True, hl=None):
    """inside(u, v) -> bool with u in -1..1 across, v 0 (stem, bottom row) .. 1 (tip, top row).
    vein(u, v) -> bool marks veins ('v'); outlines become 'e'; hl(u, v) -> bool marks lit dabs ('h')."""
    g = grid(W, H)
    m = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            u = ((x + 0.5) / W) * 2 - 1
            v = 1 - (y + 0.5) / H
            m[y][x] = inside(u, v)
    for y in range(H):
        for x in range(W):
            if not m[y][x]:
                continue
            u = ((x + 0.5) / W) * 2 - 1
            v = 1 - (y + 0.5) / H
            ch = "#"
            if edge and any(not (0 <= y + dy < H and 0 <= x + dx < W and m[y + dy][x + dx]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                ch = "e"
            elif vein and vein(u, v):
                ch = "v"
            elif hl and hl(u, v):
                ch = "h"
            g[y][x] = ch
    return rows(g)


def monstera_art(W, H, seed=0):
    """A split-leaf monstera blade: heart-shaped, widest a third of the way up, with slits from the edge toward the
    midrib (angled to the tip) and a row of oval holes between them."""
    r = random.Random(seed)
    n = 5
    cuts = [0.2 + i * 0.15 + r.uniform(-0.02, 0.02) for i in range(n)]
    holes = [(s_ * r.uniform(0.3, 0.42), c + 0.07, 0.05) for c in cuts[:-1] for s_ in (-1, 1) if r.random() < 0.7]

    def half(v):
        return 0.97 * math.sin(math.pi * min(1.0, max(0.0, v)) ** 0.62)

    def inside(u, v):
        h = half(v)
        if abs(u) > h or v > 0.985:
            return False
        if v < 0.1 and abs(u) < 0.16 * (1 - v / 0.1):
            return False  # the heart notch where the stem joins
        a = abs(u) / max(h, 0.01)
        for c in cuts:  # slits from the edge in, angled toward the tip
            if a > 0.5 and abs(v - (c + (a - 0.5) * 0.3)) < 0.018:
                return False
        for (hu, hv, hr) in holes:
            if ((u - hu) / 0.6) ** 2 + ((v - hv) * 1.4) ** 2 < hr * hr * 0.6:
                return False
        return True

    def vein(u, v):
        return abs(u) < 0.03 and v > 0.05

    def hl(u, v):  # glossy strokes along the lit half, following the side veins
        return u < -0.12 and any(abs(v - (c + (abs(u) / max(half(v), 0.01)) * 0.3) + 0.06) < 0.012 for c in cuts)
    return art_from(W, H, inside, vein, hl=hl)


def fiddle_art(W, H):
    def inside(u, v):
        # a violin body: wide near the tip, gently waisted, a narrow wedge base and a rounded tip
        half = 0.3 + 0.66 * math.sin(math.pi * min(1, v * 1.02) ** 1.25)
        half -= 0.08 * math.exp(-((v - 0.45) / 0.09) ** 2)
        if v > 0.9:
            half *= max(0, (1 - v) / 0.1) ** 0.5
        return abs(u) <= half and v > 0.02

    def vein(u, v):
        return abs(u) < 0.05 and v > 0.04

    def hl(u, v):
        return u < -0.1 and abs(((v - abs(u) * 0.4) * 6) % 1 - 0.5) < 0.045 and abs(u) < 0.75 and v > 0.12
    return art_from(W, H, inside, vein, hl=hl)


def ivy_art(W, H):
    def inside(u, v):
        # three-lobed ivy leaf
        x, y = u, v * 2 - 1
        lobe = lambda cx, cy, r: (x - cx) ** 2 + (y - cy) ** 2 < r * r
        return lobe(0, 0.25, 0.55) or lobe(-0.55, -0.25, 0.45) or lobe(0.55, -0.25, 0.45) or (abs(x) < 0.15 and y < -0.4)
    return art_from(W, H, inside, lambda u, v: abs(u) < 0.1 and v > 0.2)


def oak_art(W, H):
    def inside(u, v):
        if v < 0.06:
            return abs(u) < 0.07
        t = (v - 0.06) / 0.94
        lobes = 0.55 + 0.45 * abs(math.sin(t * math.pi * 3.5 + 0.3))
        half = math.sin(math.pi * min(1, t) ** 0.85) * lobes
        return abs(u) <= half

    def vein(u, v):
        if abs(u) < 0.05:
            return True
        t = (v - 0.06) / 0.94
        return abs(((t * 3.5 - abs(u) * 0.55)) % 1 - 0.15) < 0.05 and abs(u) < 0.75
    return art_from(W, H, inside, vein, hl=lambda u, v: u < -0.25 and int(v * 50 + u * 10) % 7 == 0)


def maple_art(W, H):
    def inside(u, v):
        x, y = u, v * 2 - 1
        a = math.atan2(x, y)
        r = math.hypot(x, y)
        R = 0.65 + 0.35 * abs(math.cos(a * 2.5))
        return r < R * 0.95 and y > -0.95
    return art_from(W, H, inside, None, edge=True)


def daisy_art(W):
    g = grid(W, W)
    c = (W - 1) / 2
    for y in range(W):
        for x in range(W):
            d = math.hypot(x - c, y - c)
            a = math.atan2(y - c, x - c)
            if d < W * 0.18:
                g[y][x] = "c" if d < W * 0.12 else "C"
            elif d < W * 0.48 * (0.75 + 0.25 * abs(math.cos(a * 4))):
                g[y][x] = "p" if (x + y) % 5 else "P"
    return rows(g)


def leaf_key(it, ramp):
    n = len(it.ramps[ramp])
    return {"e": f"{ramp}:2", "v": f"{ramp}:{n - 3}", "h": f"{ramp}:{n - 2}"}


def pot_loft(it, pid, at, r0, r1, h, st, rim=0.8, rim_out=0.5, caps=(True, True)):
    """A flower pot: a tapered body and a rolled rim."""
    x, y, z = at
    it.loft(pid, [(0, 0, 0, 2 * r0), (0, h - rim, 0, 2 * r1), (0, h - rim, 0, 2 * (r1 + rim_out)), (0, h, 0, 2 * (r1 + rim_out))], st, sides=12,
            pivot=(x, y, z), up=[0, 0, 1], caps=caps)


# ------------------------------------------------------------------ plants (the leafy ones live in green_cards.py)
@item
def cactus_trio():
    it = Item("cactus_trio", "Prickly Pals Trio", density=5)
    it.box("tray", (0, 0.4, 0), (15, 0.8, 7), wood(it, "light", "x", knots=1), ch=0.3)
    tc = clay(it)
    pot_loft(it, "pot", (-5, 0.8, 0), 1.9, 2.4, 3.8, tc)
    cs = it.ramp("lf_cactus", 0x6f9468, n=8, at=4)
    ribbed = lambda key, ribs: it.style(f"ribs_{key}", {"ramp": cs, "tone": 3.8, "rim": {"light_shift": 0.8, "dark_shift": -1.0}, "brush": {"flow": "vertical", "length": 1.0, "rough": 0.4},
                                                        "layers": [{"id": "ribs", "op": "stripes", "axis": "around", "period": 1 / ribs, "width": 0.3, "shift": -1.2},
                                                                   {"id": "ridge", "op": "stripes", "axis": "around", "period": 1 / ribs, "width": 0.15, "phase": 0.5 / ribs, "shift": 0.9},
                                                                   {"id": "areoles", "op": "spots", "count": 26, "radius": [0.16, 0.24], "ramp": it.ramp("pa_spine", P["cream"], n=5), "tone": 3.4, "roughness": 0.0, "min_gap": 1.4}]})
    barrel = ribbed("barrel", 10)
    it.loft("barrel", [(0, 0, 0, 4.0), (0, 1.4, 0, 5.2), (0, 3.2, 0, 5.0), (0, 4.6, 0, 3.0), (0, 5.0, 0, 1.0)], barrel, sides=10, pivot=(-5, 4.2, 0), up=[0, 0, 1])
    fl = soft(it, "bloom", P["blush"])
    for k in range(5):
        a = k * 72
        it.loft("petal", [(0, 0, 0, (0.5, 0.3)), (0, 0.4, 0.5, (0.8, 0.3)), (0, 0.6, 1.0, (0.4, 0.2))], fl, sides=4, pivot=(-5, 9.1, 0), rot=(0, a, 0))
    it.cyl("pollen", (-5, 9.2, 0), 0.4, 0.4, plain(it, "pollen", P["honey"], tone=3.6), sides=6)
    wg = glaze(it, "white", P["cream"], band=P["dusk"], bands=[(0.1, 0.35)])
    pot_loft(it, "pot", (0, 0.8, 0), 1.8, 2.2, 4.0, wg)
    col = ribbed("col", 8)
    it.loft("column", [(0, 0, 0, 3.0), (0, 4, 0, 3.2), (0, 9, 0, 3.0), (0, 10.6, 0, 2.2), (0, 11.2, 0, 0.8)], col, sides=8, pivot=(0, 4.6, 0), up=[0, 0, 1])
    it.loft("arm", [(0, 0, 0, 1.6), (1.6, 0.4, 0, 1.6), (2.4, 1.6, 0, 1.6), (2.6, 4.2, 0, 1.5), (2.6, 4.8, 0, 0.8)], col, sides=8, pivot=(1.0, 8.6, 0))
    it.loft("arm", [(0, 0, 0, 1.4), (-1.3, 0.3, 0, 1.4), (-1.9, 1.4, 0, 1.3), (-2.0, 2.8, 0, 0.7)], col, sides=8, pivot=(-1.0, 10.6, 0))
    bg = glaze(it, "blue", P["dusk"], dots=P["cream"])
    pot_loft(it, "pot", (5.2, 0.8, 0), 1.8, 2.2, 3.2, bg)
    pad = it.style("pad", {"ramp": cs, "tone": 4.2, "rim": {"light_shift": 0.8, "dark_shift": -1.0}, "brush": {"flow": "path", "length": 1.0, "rough": 0.4},
                           "layers": [{"id": "glochids", "op": "spots", "count": 14, "radius": [0.15, 0.22], "ramp": "pa_spine", "tone": 3.6, "roughness": 0.0, "min_gap": 1.2},
                                      {"id": "mottle", "op": "noise", "scale": 1.2, "amount": 0.5}]})
    for (x, y, z, rz, sz) in ((5.2, 4.0, 0, 0, 1.0), (6.8, 8.4, 0, -26, 0.75), (3.8, 8.0, 0.2, 32, 0.7)):
        it.loft("pad", [(0, 0, 0, (1.6 * sz, 0.9 * sz)), (0, 2.0 * sz, 0, (3.6 * sz, 1.2 * sz)), (0, 4.0 * sz, 0, (3.0 * sz, 1.0 * sz)), (0, 4.8 * sz, 0, (1.2 * sz, 0.6 * sz))],
                pad, sides=8, pivot=(x, y, z), rot=(0, 0, rz), up=[0, 0, 1])
    it.loft("bud", [(0, 0, 0, 0.6), (0, 0.6, 0, 1.2), (0, 1.0, 0, 0.4)], soft(it, "bud", P["honey"]), sides=6, pivot=(8.2, 11.4, 0), up=[0, 0, 1])
    return it.spec()


# ------------------------------------------------------------------ rugs
@item
def braided_rug():
    it = Item("braided_rug", "Braided Rag Rug", density=3, hero=(-30, 40))
    # coiled from old scarves: neighbouring rounds stay close in value so it reads calm, not like a target
    cols = [P["oat"], P["rose"], P["blush"], P["honey"], P["sage"], P["cream"], P["terracotta"], P["lake"], P["linen"], P["berry"]]
    seq = [0, 1, 2, 5, 3, 8, 4, 0, 6, 2, 9, 1, 5, 7, 8, 3, 0, 4, 1, 6]
    alph = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    key = {}
    for k, c in enumerate(cols):
        it.ramp(f"ru_b{k}", c, n=6, lo=0.9, hi=0.7)
        for t in range(6):
            key[alph[k * 6 + t]] = f"ru_b{k}:{t}"
    rx, rz = 15.5, 15.0
    W, H = face_px(2 * rx, 2 * rz, it.density)
    g = grid(W, H)
    ring_w = 1.25 * it.density
    for y in range(H):
        for x in range(W):
            ex, ez = (x + 0.5 - W / 2) / (W / 2), (y + 0.5 - H / 2) / (H / 2)
            d = math.hypot(ex, ez) * (W / 2)
            if d > W / 2 - 0.5:
                continue
            ring = int(d / ring_w)
            f = (d / ring_w) % 1
            a = math.atan2(ez, ex)
            # three strands plaited: slanted bumps that alternate direction on every other round
            s_ = (a * d / 1.9 + (f if ring % 2 else -f) * 1.4) % 1
            if f < 0.13 or f > 0.93:
                tone = 1
            elif s_ < 0.12:
                tone = 2
            elif s_ < 0.55:
                tone = 4 if f < 0.55 else 3
            else:
                tone = 3
            ci = seq[ring % len(seq)]
            if ring >= int((W / 2) / ring_w) - 1:
                ci = 9  # a darker berry binding round the edge
            g[y][x] = alph[ci * 6 + tone]
    side = it.style("braid_side", {"ramp": "ru_b9", "tone": 2.6, "rim": {"light": 0, "dark": 0}, "brush": {"off": True}, "dither": 0.0,
                                   "layers": [{"id": "twist", "op": "stripes", "axis": [1, 1, 1], "period": 0.8, "width": 0.5, "shift": -1.0}]})
    it.cyl("rug", (0, 0, 0), rx, 0.8, side, sides=24, rz=rz, paint={"stamps": [{"face": "front", "at": [0, 0], "art": rows(g), "key": key}]})
    return it.spec()


@item
def kilim_runner():
    it = Item("kilim_runner", "Kilim Hall Runner", density=3, hero=(-26, 40))
    pal = {"R": P["clay"], "C": P["cream"], "N": P["slate"], "G": P["ochre"], "P": P["pine"], "T": P["terracotta"]}
    key = {}
    for ch, c in pal.items():
        rn = it.ramp(f"ru_k{ch}", c, n=6, lo=0.9, hi=0.8)
        key[ch] = f"{rn}:3"
        key[ch.lower()] = f"{rn}:2"
        key["1234567890"["RCNGPT".index(ch)]] = f"{rn}:4"
    L, Wd = 44.0, 15.0
    W, H = face_px(L, Wd, it.density)
    g = grid(W, H)
    for y in range(H):
        for x in range(W):
            cx, cy = x - W / 2 + 0.5, y - H / 2 + 0.5
            ax, ay = abs(cx), abs(cy)
            if ay > H / 2 - 3 or ax > W / 2 - 3:
                c = "N"
            elif ay > H / 2 - 5 or ax > W / 2 - 5:
                c = "G" if (int(cx + cy) // 2) % 2 else "C"  # a running-dog border
            elif ay > H / 2 - 7 or ax > W / 2 - 7:
                c = "N"
            else:
                # stepped diamonds (lozenges) along the length, each with a hooked centre
                p = 30
                mx = ((cx + W) % p) - p / 2
                d = abs(int(mx / 2)) + abs(int(cy / 2))
                if d <= 1:
                    c = "G"
                elif d <= 3:
                    c = "C"
                elif d == 4:
                    c = "N"
                elif d <= 6:
                    c = "P" if d == 5 else "C"
                elif d == 7:
                    c = "T"
                else:
                    c = "R"
                    if (int(abs(mx)) % 6 == 0) and ay < 2:
                        c = "N"
            # flat-weave texture: alternate rows a touch darker, some warp highlights
            if (y % 2 == 0) and (x % 3 != 0):
                c = c.lower()
            elif (x * 5 + y * 3) % 23 == 0:
                c = "1234567890"["RCNGPT".index(c.upper())]
            g[y][x] = c
    side = it.style("kside", {"ramp": "ru_kN", "tone": 2.6, "rim": {"light": 0, "dark": 0}, "brush": {"off": True}, "dither": 0.0,
                              "layers": [{"id": "weft", "op": "stripes", "axis": "y", "period": 0.34, "width": 0.5, "shift": -0.8}]})
    it.box("rug", (0, 0.3, 0), (L, 0.6, Wd), side, paint={"stamps": [{"face": "top", "at": [0, 0], "art": rows(g), "key": key}]})
    fr = grid(int(Wd * it.density), 6)
    for x in range(len(fr[0])):
        if x % 3 != 2:
            for y in range(6 - (x % 2)):
                fr[y][x] = "#"
            fr[5 - (x % 2)][x] = "k" if x % 6 == 0 else fr[5 - (x % 2)][x]
    fst = plain(it, "fringe", P["cream"], tone=3.4)
    for s in (-1, 1):
        it.card("fringe", (s * (L / 2 + 1.0), 0.25, 0), fst, art=rows(fr), size=(Wd, 2.0), plane="xz", rotation=[0, 90 * s, 0], key={"k": "pa_fringe:1"})
    return it.spec()


@item
def patch_rug():
    it = Item("patch_rug", "Patchwork Quilt Rug", density=3, hero=(-30, 40))
    cols = [P["rose"], P["oat"], P["lake"], P["sageLight"], P["honey"], P["lilac"]]
    base = fabric(it, "binding", P["berry"], tone=3.0, weave=False)
    nx, nz = 6, 5
    layers = patch_layers(it, "pr", cols, nx, nz, seed=7, faces=["top"])
    bnd = 0.05
    layers = [dict(l, rect=[bnd + l["rect"][0] * (1 - 2 * bnd), bnd + l["rect"][1] * (1 - 2 * bnd), bnd + l["rect"][2] * (1 - 2 * bnd), bnd + l["rect"][3] * (1 - 2 * bnd)]) for l in layers]
    W, H = face_px(30, 24, it.density)
    st = stitch_art(W, H, nx, nz, margin=int(W * bnd) - 1)
    from kit import grid as _g
    g = [list(r) for r in st]
    # little embroidered flowers on a few patches
    r = random.Random(3)
    for k in range(7):
        cx, cy = r.randrange(8, W - 8), r.randrange(8, H - 8)
        for (dx, dy, ch) in ((0, 0, "c"), (1, 0, "f"), (-1, 0, "f"), (0, 1, "f"), (0, -1, "f")):
            g[cy + dy][cx + dx] = ch
    it.ramp("pa_flower", P["berry"], n=5)
    key = {"s": "pa_thread:2", "c": "pa_flower:4", "f": "pa_flower:2"}
    it.ramp_list("pa_thread", [0xcbbd9e, 0xe9dfc8, 0xfaf4e6])
    it.box("rug", (0, 0.4, 0), (30, 0.8, 24), base, ch=0.3, paint={"layers": layers, "stamps": [{"face": "top", "at": [0, 0], "art": ["".join(rw) for rw in g], "key": key}]})
    return it.spec()


@item
def sheepskin_rug():
    it = Item("sheepskin_rug", "Cloud Sheepskin", density=3, hero=(-30, 40))
    wool = it.ramp("fl_wool", P["cream"], n=7, lo=0.9, hi=0.7, at=4)
    st = it.style("wool", {"ramp": wool, "tone": 4.0, "rim": {"light_shift": 0.6, "dark_shift": -0.9}, "brush": {"flow": "path", "length": 0.9, "rough": 0.8},
                           "layers": [{"id": "curls", "op": "scales", "along": "x", "size": [1.1, 0.9], "shape": "round", "gradient": 1.1, "rim": -1.0, "shadow": -1.3, "jitter": 0.7},
                                      {"id": "clumps", "op": "noise", "scale": 2.4, "amount": 0.7},
                                      {"id": "tips", "op": "speckle", "density": 0.05, "shift": 1.2}]})
    # a fleece: a soft oval body that slumps into four leg flaps, a neck and a tail, all overlapping into one hide
    it.loft("fleece", [(0, 0, 0, (19.6, 22.6)), (0, 0.9, 0, (19.4, 22.2)), (0, 1.6, 0, (16.6, 19.4)), (0, 2.0, 0, (10.0, 12.0))], st, sides=16, round_=2.2, up=[0, 0, 1])
    for (x, z, a) in ((-6.6, -8.2, -140), (6.6, -8.2, 140), (-6.8, 8.6, -40), (6.8, 8.6, 40)):
        it.loft("flap", [(0, 0.75, 0, (5.6, 1.4)), (0, 0.65, 2.6, (4.4, 1.2)), (0, 0.55, 4.6, (3.0, 1.0)), (0, 0.45, 5.6, (1.4, 0.8))], st, sides=8, round_=2.4,
                pivot=(x, 0, z), rot=(0, a, 0))
    it.loft("neck", [(0, 0.85, 0, (6.6, 1.6)), (0, 0.75, -2.4, (5.4, 1.4)), (0, 0.55, -3.6, (3.2, 1.0))], st, sides=8, round_=2.4, pivot=(0, 0, -10.8))
    it.loft("tail", [(0, 0.75, 0, (4.0, 1.4)), (0, 0.65, 2.2, (2.8, 1.2)), (0, 0.45, 3.0, (1.4, 0.8))], st, sides=8, round_=2.4, pivot=(0, 0, 10.8))
    return it.spec()


@item
def oak_leaf_rug():
    it = Item("oak_leaf_rug", "Oak Leaf Rug", density=3, hero=(-30, 40))
    felt = it.ramp("ru_felt", P["moss"], n=7, at=3)
    st = it.style("felt", {"ramp": felt, "tone": 3.4, "rim": {"light": 0, "dark": 0}, "brush": {"flow": "horizontal", "length": 1.2, "rough": 0.6},
                           "layers": [{"id": "mottle", "op": "noise", "scale": 3.0, "amount": 0.7}, {"id": "fibres", "op": "speckle", "density": 0.04, "shift": 0.8}]})
    W, H = int(22 * it.density), int(34 * it.density)
    art = oak_art(W, H)
    # a stitched outline just inside the edge and a few blanket-stitch ticks
    g = [list(r) for r in art]
    for y in range(H):
        for x in range(W):
            if g[y][x] == "#" and any(0 <= y + dy < H and 0 <= x + dx < W and g[y + dy][x + dx] == "e" for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2))) and (x + y) % 3 == 0:
                g[y][x] = "s"
    it.ramp_list("pa_thread", [0xcbbd9e, 0xe9dfc8, 0xfaf4e6])
    key = {"e": "ru_felt:1", "v": "ru_felt:5", "h": "ru_felt:4", "s": "pa_thread:1"}
    it.card("rug", (0, 0.15, -1.6), st, art=["".join(r) for r in g], size=(22, 34), plane="xz", rotation=[0, 180, 0], key=key)
    return it.spec()
