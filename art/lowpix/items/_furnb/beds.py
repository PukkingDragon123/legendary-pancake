"""Beds and seating (src/assets/decor/beds.ts ids)."""
from __future__ import annotations

import math

from kit import (P, Item, check_layers, fabric, face_px, glass, glaze, grid, ink, knit, leafy, metal, moss, painted, patch_layers,
                 plaid_layers, plain, put, rows, soft, stitch_art, stripe_layers, wicker, wood)
from parts import books, drawer, knob, turned_leg

ITEMS = {}


def item(fn):
    ITEMS[fn.__name__] = fn
    return fn


def thread(it):
    """Key for stitch stamps: a pale thread colour."""
    it.ramp_list("pa_thread", [0xcbbd9e, 0xe9dfc8, 0xfaf4e6])
    return {"s": "pa_thread:2", "S": "pa_thread:1"}


def pillow(it, pid, c, w, h, d, st, rot=None, paint=None, rnd=4.0):
    """A plump pillow: a loft along z with a fat middle and soft squared corners."""
    rings = [(0, 0, -d / 2, (w * 0.86, h * 0.8)), (0, 0, -d * 0.2, (w, h)), (0, 0, d * 0.2, (w, h)), (0, 0, d / 2, (w * 0.86, h * 0.8))]
    return it.loft(pid, rings, st, sides=12, round_=rnd, pivot=c, rot=rot, paint=paint)


def bolster(it, pid, c, length, r, st, rot=(0, 90, 0), paint=None):
    rings = [(0, 0, -length / 2, r * 1.4), (0, 0, -length / 2 + 0.5, r * 2), (0, 0, length / 2 - 0.5, r * 2), (0, 0, length / 2, r * 1.4)]
    return it.loft(pid, rings, st, sides=8, round_=2.0, pivot=c, rot=rot, paint=paint)


def plush(it, pid, c, s=1.0, fur_col=0xc49a72, rot=0.0, ears="bear", muzzle_col=0xe8d3b4):
    """A little sleepy plush: body, head, ears, muzzle and dot eyes."""
    fur = soft(it, f"plush{fur_col:x}", fur_col, pattern=[{"id": "fuzz", "op": "spots", "count": 14, "radius": [0.15, 0.3], "shift": 0.8}])
    x, y, z = c
    body = it.loft(pid + "_body", [(0, 0, 0, 2.6 * s), (0, 1.5 * s, 0, 3.6 * s), (0, 3.0 * s, 0, 2.4 * s)], fur, sides=8, round_=2.0,
                   pivot=(x, y, z), rot=(0, rot, 0), up=[0, 0, 1])
    head = it.loft(pid + "_head", [(0, 0, 0, 2.4 * s), (0, 1.3 * s, 0, 3.4 * s), (0, 2.7 * s, 0, 2.2 * s)], fur, sides=8, round_=2.0,
                   pivot=(0, 2.8 * s, 0), parent=body, up=[0, 0, 1])
    if ears == "bear":
        for sx in (-1, 1):
            it.cyl(pid + "_ear", (sx * 1.25 * s, 2.5 * s, -0.1 * s), 0.65 * s, 0.6 * s, fur, sides=6, axis="z", parent=head)
    else:  # mouse: big round ears
        er = soft(it, "mouseear", P["blush"])
        for sx in (-1, 1):
            it.cyl(pid + "_ear", (sx * 1.2 * s, 2.6 * s, -0.3 * s), 0.75 * s, 0.35 * s, er, sides=8, axis="z", parent=head)
    muz = plain(it, f"muzzle{muzzle_col:x}", muzzle_col, tone=3.4)
    it.box(pid + "_muzzle", (0, 1.0 * s, 1.45 * s), (1.5 * s, 1.1 * s, 0.7 * s), muz, ch=0.25 * s, parent=head)
    dot = ink(it)
    for sx in (-1, 1):
        it.box(pid + "_eye", (sx * 0.72 * s, 1.75 * s, 1.55 * s), (0.42 * s, 0.42 * s, 0.25), dot, parent=head)
    it.box(pid + "_nose", (0, 1.35 * s, 1.85 * s), (0.45 * s, 0.32 * s, 0.25), dot, parent=head)
    return body


def tuft_grid(xs, ys, z, r=0.42):
    return [[x, y, z, r] for x in xs for y in ys]


TUFT_BEVEL = {"shadow": 1, "highlight": 1, "shadow_shift": -0.6, "highlight_shift": 1.5}


# ------------------------------------------------------------------ beds
@item
def bunk_bed():
    it = Item("bunk_bed", "Pinewood Bunk Bed", density=3)
    post = wood(it, "pine", "y")
    rail = wood(it, "pine", "x")
    end = wood(it, "pine", "z")
    slat = wood(it, "pale", "y", knots=1)
    dark = wood(it, "oak", "x")
    tick = fabric(it, "tick", P["paper"], tone=3.6)
    tick_paint = {"layers": stripe_layers(it, "tick", P["dusk"], "z", 2.4, 0.22, faces=["top", "front", "back"], tone=3.0)}
    for x in (-16.5, 16.5):
        for z in (-8, 8):
            it.box("post", (x, 23, z), (2.6, 46, 2.6), post, ch=0.5)
            it.loft("finial", [(0, 0, 0, 3.0), (0, 0.7, 0, 3.2), (0, 1.3, 0, 1.6), (0, 2.4, 0, 2.6), (0, 3.4, 0, 1.2)], post, sides=8, pivot=(x, 46, z), up=[0, 0, 1])
            it.box("postfoot", (x, 0.6, z), (3.2, 1.2, 3.2), dark, ch=0.3)
    quilts = [
        ("q0", [P["rose"], P["oat"], P["lake"], P["sage"], P["honey"]], 6, 4),
        ("q1", [P["dusk"], P["cream"], P["moss"], P["terracotta"]], 5, 4),
    ]
    for i, y0 in enumerate((4, 26)):
        for z in (-8, 8):
            it.box("rail", (0, y0 + 1.5, z), (30.4, 3, 1.6), rail, ch=0.3)
        for k in range(7):
            it.box("slat", (-13 + k * 4.4, y0 + 1.1, 0), (3.6, 0.6, 14.4), slat)
        it.box("mattress", (0, y0 + 3.4, 0), (30, 3.4, 14.4), tick, ch=1.0, paint=tick_paint)
        # headboard at the left (three slats between two boards, the middle one with a heart cut-out), low footboard
        it.box("head", (-16.5, y0 + 4, 0), (1.6, 2, 13.4), end, ch=0.3)
        it.box("head", (-16.5, y0 + 12, 0), (1.6, 2.2, 13.4), end, ch=0.3)
        for z in (-4.5, 0, 4.5):
            heart = ["._._.", "_____", "_____", "._._.", ".._.."][::1]
            it.box("hslat", (-16.5, y0 + 8, z), (1.2, 6, 2.4), slat, ch=0.2,
                   paint={"stamps": [{"faces": ["left", "right"], "at": "center", "art": [".__.__.", "_______", "_______", "._____.", ".._._..", "...._.."][:5], "key": {}}]} if z == 0 else None)
        it.box("foot", (16.5, y0 + 5, 0), (1.6, 4, 13.4), end, ch=0.3)
        # the quilt lies on top and folds down the front and back
        key, cols, nx, nz = quilts[i]
        W, H = face_px(22, 15.6, it.density)
        qfab = fabric(it, "quilt", P["oat"], tone=3.2, weave=False)
        qp = {"layers": patch_layers(it, key, cols, nx, nz, seed=3 + i, faces=["top"]),
              "stamps": [{"face": "top", "at": [0, 0], "art": stitch_art(W, H, nx, nz), "key": thread(it)}]}
        it.box("quilt", (4, y0 + 5.7, 0), (22, 1.2, 15.6), qfab, paint=qp)
        for zs in (-1, 1):
            it.box("quiltdrop", (4, y0 + 3.4, zs * 7.95), (22, 4.0, 0.9), qfab, rot=(zs * -4, 0, 0),
                   paint={"layers": patch_layers(it, key + "d", cols, nx, 1, seed=5 + i, faces=["front", "back"], cols_only=True)})
        it.box("sheet", (-6.6, y0 + 5.8, 0), (3, 1.4, 15.6), fabric(it, "sheet", P["paper"], tone=3.8), ch=0.4)
        pillow(it, "pillow", (-11.8, y0 + 6.6, 0), 9.6, 2.6, 5.4, fabric(it, "pillow", P["cream"], tone=3.6), rot=(0, 90, 0))
    it.box("guard", (-4, 36.2, 8), (23, 1.6, 1.6), rail, ch=0.3)
    for x in (-14, -10, -6, -2, 2, 6):
        it.box("spindle", (x, 33.2, 8), (1.1, 4.6, 1.1), post, ch=0.2)
    for x in (9.4, 14.6):
        it.box("ladder", (x, 18, 9.9), (1.4, 36, 1.4), post, ch=0.3)
    for k in range(6):
        it.box("rung", (12, 5.5 + k * 5.5, 9.9), (5.4, 1.1, 1.1), dark)
    plush(it, "bear", (8, 31.6, -3), s=1.1)
    flag = fabric(it, "flag", P["berry"], tone=3.4, weave=False)
    it.box("pennant", (17.4, 27.6, 0), (0.4, 4.6, 8), flag,
           paint={"layers": [{"id": "star", "op": "spots", "centers": [[0.3, 0.3, 0, 1.1]], "ramp": it.ramp("cl_flagstar", P["honey"], n=5), "tone": 3, "faces": ["right", "left"]}],
                  "stamps": [{"faces": ["left", "right"], "at": "bottom", "art": ["_.._.._.._.._.._.._.._.._", "___________________________"], "key": {}}]})
    return it.spec()


@item
def canopy_bed():
    it = Item("canopy_bed", "Rosewood Canopy Bed", density=3)
    post = wood(it, "rose", "y", knots=1)
    rail = wood(it, "rose", "x", knots=1)
    railz = wood(it, "rose", "z", knots=1)
    gold = metal(it, "gold")
    voile = fabric(it, "voile", P["blush"], tone=3.6, weave=False, faded=False)
    folds = [{"id": "folds", "op": "stripes", "axis": "x", "period": 1.8, "width": 0.4, "shift": -0.9, "wobble": 0.2},
             {"id": "foldlit", "op": "stripes", "axis": "x", "period": 1.8, "width": 0.18, "phase": 0.9, "shift": 0.8, "wobble": 0.2}]
    foldsz = [dict(l, axis="z") for l in folds]
    for x in (-16.5, 16.5):
        for z in (-10, 10):
            it.box("plinth", (x, 1.5, z), (3, 3, 3), post, ch=0.5)
            it.loft("post", [(0, 3, 0, 2.2), (0, 12, 0, 2.0), (0, 22, 0, 2.2), (0, 40, 0, 2.0), (0, 52, 0, 2.2)], post, sides=8, pivot=(x, 0, z), up=[0, 0, 1])
            for y in (12, 22, 40):
                it.cyl("collar", (x, y - 0.6, z), 1.5, 1.2, gold, sides=8)
            it.loft("finial", [(0, 0, 0, 2.6), (0, 1.2, 0, 2.8), (0, 2, 0, 1.2), (0, 2.8, 0, 2.0), (0, 3.6, 0, 0.6)], gold, sides=8, pivot=(x, 52, z), up=[0, 0, 1])
    for z in (-10, 10):
        it.box("toprail", (0, 50, z), (31, 2, 1.6), rail, ch=0.3)
        it.box("siderail", (0, 6, z), (31, 4, 1.6), rail, ch=0.4)
    for x in (-16.5, 16.5):
        it.box("toprailz", (x, 50, 0), (1.6, 2, 18.4), railz, ch=0.3)
    # canopy roof and a scalloped valance with a gold braid on all four sides
    it.box("roof", (0, 51.4, 0), (34, 0.8, 22), voile)
    scallop = ["".join("_" if (abs((x % 9) - 4) ** 2) / 16 + (y / 3.0) ** 2 * 0 > 0 and y < [3, 2, 1, 1, 0, 1, 1, 2, 3][x % 9] else "." for x in range(110)) for y in range(4)][::-1]
    val_paint = {"layers": folds + [{"id": "braid", "op": "band", "axis": "y", "from": 0.55, "to": 0.85, "ramp": it.ramp("br_braid", 0xd4b36a, n=6), "tone": 3.6, "bevel": True}],
                 "stamps": [{"faces": ["front", "back"], "at": "bottom", "art": scallop, "key": {}}]}
    val_paintz = {"layers": foldsz + [{"id": "braid", "op": "band", "axis": "y", "from": 0.55, "to": 0.85, "ramp": "br_braid", "tone": 3.6, "bevel": True}],
                  "stamps": [{"faces": ["left", "right"], "at": "bottom", "art": scallop, "key": {}}]}
    for z in (-11, 11):
        it.box("valance", (0, 48.6, z), (34, 4.4, 0.6), voile, paint=val_paint, double_sided=True)
    for x in (-17, 17):
        it.box("valancez", (x, 48.6, 0), (0.6, 4.4, 22), voile, paint=val_paintz, double_sided=True)
    # drapes gathered at the front posts, tied back with gold cord and tassels
    drape = it.style("drape", dict(it.styles[voile], brush={"flow": "vertical", "length": 2.0, "rough": 0.35},
                                   layers=[{"id": "mottle", "op": "noise", "scale": 4.0, "amount": 0.3},
                                           {"id": "folds", "op": "stripes", "axis": "around", "period": 0.125, "width": 0.4, "shift": -1.0},
                                           {"id": "foldlit", "op": "stripes", "axis": "around", "period": 0.125, "width": 0.15, "phase": 0.06, "shift": 0.9},
                                           {"id": "hem", "op": "band", "axis": "path", "from": 0.0, "to": 0.04, "shift": 0.8}]))
    for sx in (-1, 1):
        x = sx * 13.6
        it.loft("drape", [(0, 3.0, 0, (5.6, 1.8)), (sx * 0.6, 13, 0, (4.6, 1.8)), (sx * 1.5, 24.4, 0, (2.0, 2.0)), (sx * 0.6, 34, 0, (4.8, 1.6)), (0, 46.6, 0, (6.6, 1.2))],
                drape, sides=10, round_=2.0, pivot=(x, 0, 11.6), up=[0, 0, 1])
        it.box("tie", (x + sx * 1.5, 24.4, 11.6), (2.8, 1.2, 2.8), gold, ch=0.3)
        it.loft("tassel", [(0, 0, 0, 0.6), (0, -1.2, 0, 1.4), (0, -2.8, 0, 1.6)], gold, sides=6, pivot=(x + sx * 0.2, 24.0, 13.0), up=[0, 0, 1])
    backdr = it.style("backdrape", dict(it.styles[voile], brush={"flow": "vertical", "length": 2.0, "rough": 0.35},
                                        layers=[{"id": "mottle", "op": "noise", "scale": 4.0, "amount": 0.3},
                                                {"id": "folds", "op": "stripes", "axis": "x", "period": 2.2, "width": 0.4, "shift": -1.0, "wobble": 0.15},
                                                {"id": "foldlit", "op": "stripes", "axis": "x", "period": 2.2, "width": 0.15, "phase": 1.1, "shift": 0.9, "wobble": 0.15}]))
    it.box("backpanel", (0, 27, -11.2), (30, 40, 0.6), backdr)
    # carved headboard at the left with a crescent-moon window and a gold rail
    W, H = face_px(18.4, 16, it.density)
    g = grid(W, H)
    cx, cy, R = W / 2, H * 0.52, H * 0.26
    for y in range(H):
        for x in range(W):
            if math.hypot(x - cx, y - cy) < R and math.hypot(x - cx - R * 0.45, y - cy + R * 0.2) > R * 0.8:
                g[y][x] = "_"
            # arched top corners
            if y < 6 and (min(x, W - 1 - x) < 6 - y):
                g[y][x] = "_"
    it.box("headboard", (-16.6, 16, 0), (1.4, 16, 18.4), railz, paint={"stamps": [{"faces": ["left", "right"], "at": [0, 0], "art": rows(g), "key": {}}],
                                                                       "layers": [{"id": "panel", "op": "panel", "inset": 3, "shift": -1.2}]})
    it.box("headgold", (-16.6, 24.3, 0), (1.7, 0.8, 12), gold)
    it.box("footboard", (16.6, 10.5, 0), (1.4, 5, 18.4), railz, ch=0.3, paint={"layers": [{"id": "panel", "op": "panel", "inset": 2, "shift": -1.2}]})
    # bedding: mattress, a tufted duvet, a rose sheet turned down, two pillows, a bolster and a striped knit throw
    tick = fabric(it, "tick", P["paper"], tone=3.5)
    it.box("mattress", (0, 9, 0), (31, 4, 19), tick, ch=1.0, paint={"layers": stripe_layers(it, "tick", P["rose"], "z", 2.0, 0.2, faces=["top", "front", "back"], tone=3.0)})
    duvet = fabric(it, "duvet", P["cream"], tone=3.4, weave=False)
    tufts = [[x, 0.6, z, 0.4] for x in (-9, -4.5, 0, 4.5, 9) for z in (-7.5, -2.5, 2.5, 7.5)]
    it.box("duvet", (4, 11.6, 0), (23, 1.8, 20), duvet, ch=0.6,
           paint={"layers": [{"id": "tufts", "op": "spots", "centers": tufts, "shift": -1.5, "bevel": TUFT_BEVEL, "faces": ["top"]},
                             {"id": "quilting", "op": "stripes", "axis": [1, 0, 1], "period": 3.2, "width": 0.1, "shift": -0.6, "faces": ["top"]},
                             {"id": "quilting2", "op": "stripes", "axis": [1, 0, -1], "period": 3.2, "width": 0.1, "shift": -0.6, "faces": ["top"]}]})
    for zs in (-1, 1):
        it.box("duvetdrop", (4, 8.8, zs * 10.1), (23, 5.4, 0.9), duvet, rot=(zs * -5, 0, 0))
    it.box("turn", (-7.4, 12.0, 0), (3, 1.8, 20.2), fabric(it, "rosesheet", P["rose"], tone=3.4), ch=0.5,
           paint={"layers": [{"id": "lace", "op": "stripes", "axis": "x", "period": 0.7, "width": 0.4, "shift": 1.4, "range": [0.6, 1.0]}]})
    pcase = fabric(it, "pcase", P["paper"], tone=3.6)
    for sz in (-1, 1):
        pillow(it, "pillow", (-12.6, 12.6, sz * 4.6), 8.6, 3.0, 5.4, pcase, rot=(0, 90 + sz * 8, 0),
               paint={"layers": [{"id": "frill", "op": "band", "axis": "z", "from": 0.8, "to": 1.0, "ramp": "cl_rosesheet", "tone": 3.6}]})
    bolster(it, "bolster", (-9.4, 12.4, 0), 9, 1.5, soft(it, "bolster", P["berry"], pattern=stripe_layers(it, "bolst", P["honey"], "z", 1.6, 0.25, tone=3.2)), rot=(0, 0, 0))
    k = knit(it, "throw", P["oat"], stripe=P["berry"], every=2.2)
    it.box("throw", (12.2, 12.9, 0), (6, 1.0, 20.6), k)
    it.box("throwdrop", (12.2, 9.2, 10.6), (6, 6.6, 0.9), k, rot=(-6, 0, 0))
    return it.spec()


@item
def hammock_bed():
    it = Item("hammock_bed", "Woven Hammock Bed", density=3)
    ash = wood(it, "ash", "y")
    ashx = wood(it, "ash", "x")
    ashz = wood(it, "ash", "z")
    rope = plain(it, "rope", P["linen"], tone=3.6, layers=[{"id": "twist", "op": "stripes", "axis": [1, 1, 1], "period": 0.9, "width": 0.4, "shift": -1.0}])
    for s in (-1, 1):
        # an A-frame at each end, splayed, with a crossbar, a cap and a floor runner
        for zs in (-1, 1):
            it.box("leg", (s * 19, 14.0, zs * 5), (2.2, 27.4, 2.2), ash, ch=0.4, rot=(-zs * 11, 0, 0), pivot=(s * 19, 0.5, zs * 5))
        it.box("cap", (s * 19, 26.4, 0), (3.0, 2.0, 3.4), wood(it, "dark", "x"), ch=0.4)
        it.box("crossbar", (s * 19, 7, 0), (1.6, 1.6, 12), ashz, ch=0.3)
        it.box("runner", (s * 19, 0.7, 0), (3, 1.4, 14), ashz, ch=0.4)
        for z in (-3, 0, 3):
            it.loft("rope", [(0, 0, 0, 0.7), (s * -3, -6, z * 0.5, 0.7), (s * -6.2, -12, z, 0.7)], rope, sides=4, pivot=(s * 18.4, 25.4, 0), up=[0, 0, 1])
        it.box("ring", (s * 12.6, 13.2, 0), (1.0, 1.4, 7.4), metal(it, "iron"), ch=0.3)
    it.box("beam", (0, 0.8, 0), (36, 1.6, 2), ashx, ch=0.4)
    # the netted bed: a sagging loft with a macrame weave; a plaid blanket drapes over it
    net = plain(it, "net", 0xdcc9a4, tone=3.6, layers=[
        {"id": "knots", "op": "stripes", "axis": [1, 0, 1], "period": 1.6, "width": 0.25, "shift": -1.6},
        {"id": "knots2", "op": "stripes", "axis": [1, 0, -1], "period": 1.6, "width": 0.25, "shift": -1.6},
        {"id": "lit", "op": "stripes", "axis": [1, 0, 1], "period": 1.6, "width": 0.12, "phase": 0.8, "shift": 1.0}])
    sag = lambda x: 9.6 + 4.2 * (x / 12.6) ** 2
    rings = [(x, sag(x), 0, (12.4, 1.0)) for x in (-12.6, -9, -5, 0, 5, 9, 12.6)]
    it.loft("net", rings, net, sides=4, round_=2.0, up=[0, 1, 0], double_sided=True)
    # macrame fringe hanging under both edges
    fr = grid(78, 9)
    for x in range(78):
        L = 4 + (x * 7 % 5)
        if x % 3 != 2:
            for y in range(min(9, L)):
                fr[y][x] = "#"
            if x % 6 == 0:
                for y in range(L, min(9, L + 2)):
                    fr[y][x] = "k"
    rope_k = {"k": "pa_rope:5"}
    for zs in (-1, 1):
        it.card("fringe", (0, 7.5, zs * 6.3), rope, art=rows(fr), size=(26, 3), key=rope_k)
    blanket = soft(it, "blanket", P["moss"], tone=3.4, pattern=plaid_layers(it, "blk", "cl_blanket", P["pine"], P["honey"], period=3.6, axes=("x", "z")))
    brings = [(x, sag(x) + 0.9, 0, (13.0, 1.0)) for x in (-6, -3, 0, 4, 8, 12.4)]
    it.loft("blanket", brings, blanket, sides=4, round_=2.0, up=[0, 1, 0])
    it.box("blanketdrop", (5.0, 7.6, 6.9), (13.6, 6.4, 0.8), blanket, rot=(-8, 0, 0))
    pillow(it, "pillow", (-8.6, 10.9, 0), 8.0, 2.6, 4.8, soft(it, "pillow", P["cream"], pattern=stripe_layers(it, "pil", P["moss"], "x", 1.2, 0.2, tone=3.0)), rot=(0, 90, -14))
    plush(it, "lamb", (-1.6, 10.2, 2.4), s=0.95, fur_col=0xefe6d2, rot=20, muzzle_col=0x6a5a50)
    return it.spec()


@item
def basket_nest():
    it = Item("basket_nest", "Mossy Basket Nest", density=3)
    wk = wicker(it, "nest", 0xc49a62)
    rim = wicker(it, "rim", 0xa8794a, size=(1.0, 0.9))
    it.loft("basket", [(0, 0, 0, 21.0), (0, 0.4, 0, 22.2), (0, 3.0, 0, 23.0), (0, 5.4, 0, 23.6)], wk, sides=14, pivot=(0, 0, 0), caps=(True, False), up=[0, 0, 1], double_sided=True)
    it.loft("rim", [(math.sin(a) * 11.6, 0, math.cos(a) * 11.6, (2.6, 2.4)) for a in [k * 2 * math.pi / 18 for k in range(19)]], rim, sides=8, pivot=(0, 6.4, 0), caps=(False, False), round_=2.0)
    cush = fabric(it, "cush", P["plum"], tone=3.5, weave=False)
    tufts = [[math.cos(a) * r, 1.6, math.sin(a) * r, 0.5] for r, n in ((0, 1), (4.5, 6)) for a in [k * 2 * math.pi / n for k in range(n)]]
    it.loft("cushion", [(0, 0, 0, 18.4), (0, 1.6, 0, 19.4), (0, 2.6, 0, 18.4), (0, 3.1, 0, 14.0)], cush, sides=14, pivot=(0, 1.0, 0), up=[0, 0, 1],
            paint={"layers": [{"id": "tufts", "op": "spots", "centers": [[x, 3.0, z, rr] for x, _, z, rr in tufts], "shift": -1.6, "bevel": TUFT_BEVEL},
                              {"id": "piping", "op": "band", "axis": "y", "from": 0.1, "to": 0.25, "shift": 1.0}]})
    # moss creeping over the rim, with tiny white flowers and clover
    ms = moss(it, "rim", P["moss"], bloom=P["snow"])
    for k in range(7):
        a = k / 7 * 2 * math.pi + 0.9
        r = 11.9
        w = 3.6 + 1.6 * (k % 3)
        # flat cushions of moss draped over the rim, spilling a little down the outside
        it.loft("moss", [(0, 0, -0.4, (w, 3.4)), (0, 0.7, -0.2, (w * 0.92, 3.0)), (0, 1.1, 0, (w * 0.6, 1.8))], ms, sides=8, round_=2.6,
                pivot=(math.sin(a) * r, 7.3, math.cos(a) * r), rot=(0, math.degrees(a), 0), up=[0, 0, 1])
        it.loft("mossdrip", [(0, 0, 0, (w * 0.6, 1.0)), (0, -1.4, 0.3, (w * 0.45, 0.8)), (0, -2.2, 0.3, (w * 0.2, 0.5))], ms, sides=6, round_=2.4,
                pivot=(math.sin(a) * (r + 1.3), 7.6, math.cos(a) * (r + 1.3)), rot=(0, math.degrees(a), 0), up=[0, 0, 1])
    # a knitted blanket over the front rim and a little plush mouse curled up asleep on the cushion
    k = knit(it, "blanket", P["honey"], stripe=P["cream"], every=2.0)
    it.box("blanket", (5.6, 7.7, 6.8), (7.4, 1.0, 6.4), k, rot=(0, 40, 0))
    it.box("blanketdrop", (8.4, 4.8, 9.6), (6.6, 5.6, 0.8), k, rot=(-8, 40, 0))
    fur = soft(it, "mousefur", 0xc9c1cf, pattern=[{"id": "fuzz", "op": "spots", "count": 10, "radius": [0.15, 0.3], "shift": 0.8}])
    m = it.loft("mouse", [(0, 0, -2.6, (2.4, 1.8)), (0, 0.2, -1.2, (4.2, 3.4)), (0, 0.2, 0.6, (4.0, 3.2)), (0, 0, 2.0, (2.6, 2.2)), (0, -0.2, 2.9, (1.0, 0.9))],
                fur, sides=8, round_=2.0, pivot=(-3.4, 5.3, -1.4), rot=(0, 30, 0))
    pink = soft(it, "mousepink", P["blush"])
    for sx in (-1, 1):
        it.cyl("mouseear", (sx * 1.1, 1.6, 1.4), 0.8, 0.3, pink, sides=8, axis="z", parent=m, rotation=[-20, sx * 20, 0])
    it.box("mousenose", (0, -0.2, 3.3), (0.5, 0.45, 0.4), pink, parent=m)
    dot = ink(it)
    for sx in (-1, 1):
        it.box("mouseeye", (sx * 0.7, 0.55, 2.35), (0.6, 0.18, 0.2), dot, parent=m)  # sleepy closed eyes
    it.loft("tail", [(0, 0, 0, 0.35), (1.6, 0, 0.6, 0.35), (2.6, 0, 2.2, 0.3), (2.2, 0, 3.6, 0.25)], pink, sides=4, pivot=(0, -1.0, -2.6), parent=m)
    return it.spec()


@item
def floor_futon():
    it = Item("floor_futon", "Tatami Futon", density=3)
    straw = it.ramp("wk_tatami", 0xc8bf86, n=7)
    tat = it.style("tatami", {"ramp": straw, "tone": 3.4, "rim": {"light_shift": 0.6, "dark_shift": -0.8}, "brush": {"flow": "x", "length": 3, "rough": 0.4},
                              "layers": [{"id": "rush", "op": "stripes", "axis": "z", "period": 0.67, "width": 0.5, "shift": -0.6},
                                         {"id": "weft", "op": "stripes", "axis": "x", "period": 6.0, "width": 0.06, "shift": -0.9},
                                         {"id": "border", "op": "band", "axis": "z", "from": 0.84, "to": 1.0, "ramp": it.ramp("cl_heri", P["pine"], n=6), "tone": 2.8, "faces": ["top", "front", "back"]},
                                         {"id": "border2", "op": "band", "axis": "z", "from": -1.0, "to": -0.84, "ramp": "cl_heri", "tone": 2.8, "faces": ["top", "front", "back"]},
                                         {"id": "border_pat", "op": "stripes", "axis": "x", "period": 1.4, "width": 0.3, "shift": 0.8, "range": [0.86, 0.98]}]})
    it.box("tatami", (0, 0.5, 0), (38, 1.0, 24), tat, ch=0.3)
    it.box("futon", (0, 2.6, 0), (32, 3.2, 18), fabric(it, "futon", P["paper"], tone=3.6), ch=1.1,
           paint={"layers": [{"id": "quilt", "op": "stripes", "axis": "x", "period": 4, "width": 0.06, "shift": -0.8, "faces": ["sides"]}]})
    indigo = fabric(it, "indigo", P["slate"], tone=3.2, weave=False)
    wave = [{"id": "waves", "op": "stripes", "axis": "z", "period": 2.2, "width": 0.14, "wobble": 0.35, "wobble_scale": 1.0, "ramp": it.ramp("cl_wave", P["mist"], n=6), "tone": 3.2},
            {"id": "waves2", "op": "stripes", "axis": "z", "period": 2.2, "width": 0.1, "phase": 1.1, "wobble": 0.35, "wobble_scale": 1.0, "shift": -0.7},
            {"id": "tie", "op": "spots", "centers": [[x, 0.9, z, 0.45] for x in (-7, 0, 7) for z in (-5, 0, 5)], "ramp": "cl_wave", "tone": 4, "faces": ["top"]}]
    it.box("duvet", (5, 4.8, 0), (22, 1.6, 18.6), indigo, ch=0.5, paint={"layers": wave})
    it.box("duvetdrop", (5, 2.8, 9.4), (22, 3.6, 0.9), indigo, paint={"layers": wave})
    it.box("fold", (-6.4, 5.0, 0), (4, 2.6, 18.6), indigo, ch=0.9, paint={"layers": wave})
    it.box("sheet", (-4.4, 4.6, 0), (1.4, 1.6, 18.6), fabric(it, "sheet", P["paper"], tone=3.8))
    soba = soft(it, "soba", P["linen"], pattern=stripe_layers(it, "soba", P["straw"], "x", 1.0, 0.45, tone=2.6))
    pillow(it, "pillow", (-12.4, 5.3, 0), 9.4, 2.6, 5.2, soba, rot=(0, 90, 0))
    # bedside tray: a teapot, a cup of tea, and a little brass alarm clock
    tray = wood(it, "dark", "x", knots=0)
    it.box("tray", (-14, 1.6, 14.2), (9.6, 0.8, 7), tray, ch=0.3, paint={"layers": [{"id": "lip", "op": "panel", "inset": 1, "shift": -1.0}]})
    teap = glaze(it, "tea", P["fern"], tone=3.2)
    it.loft("teapot", [(0, 0, 0, 2.6), (0, 0.6, 0, 3.6), (0, 1.8, 0, 3.8), (0, 2.8, 0, 2.6), (0, 3.2, 0, 1.4)], teap, sides=10, pivot=(-16.2, 2.0, 14), up=[0, 0, 1])
    it.loft("spout", [(0, 0, 0, 0.9), (1.4, 0.8, 0, 0.7), (2.0, 1.8, 0, 0.5)], teap, sides=6, pivot=(-14.6, 3.0, 14), up=[0, 0, 1])
    it.loft("handle", [(0, 0, 0, 0.5), (-1.0, 0.6, 0, 0.5), (-1.0, 1.8, 0, 0.5), (0, 2.4, 0, 0.5)], teap, sides=4, pivot=(-17.9, 2.6, 14), up=[0, 0, 1])
    it.cyl("lid", (-16.2, 5.2, 14), 0.5, 0.6, metal(it, "brass"), sides=6)
    cup = glaze(it, "cup", P["cream"], band=P["dusk"], bands=[(0.4, 0.7)])
    it.loft("cup", [(0, 0, 0, 1.4), (0, 0.4, 0, 2.0), (0, 1.8, 0, 2.3)], cup, sides=10, pivot=(-12.2, 2.0, 15.6), caps=(True, False), up=[0, 0, 1], double_sided=True)
    it.cyl("tea", (-12.2, 3.3, 15.6), 1.0, 0.2, plain(it, "tea", P["ochre"], tone=2.6), sides=10)
    clock = metal(it, "brass")
    it.cyl("clock", (-11.4, 3.7, 12.8), 1.6, 1.4, plain(it, "clockcase", P["clay"], tone=3.2), sides=12, axis="z")
    it.cyl("face", (-11.4, 3.7, 13.55), 1.2, 0.1, plain(it, "clockface", P["paper"], tone=4.0,
           layers=[{"id": "hands", "op": "rect", "rect": [0.47, 0.2, 0.55, 0.55], "ramp": "pa_ink", "tone": 1}]), sides=12, axis="z")
    ink(it)
    for sx in (-1, 1):
        it.cyl("bell", (-11.4 + sx * 1.1, 5.4, 12.8), 0.6, 0.5, clock, sides=6)
        it.box("leg", (-11.4 + sx * 0.9, 2.2, 12.8), (0.4, 0.8, 0.4), clock)
    return it.spec()


# ------------------------------------------------------------------ seating
@item
def patch_sofa():
    it = Item("patch_sofa", "Patchwork Sofa", density=3)
    plum = fabric(it, "plum", P["plum"], tone=3.4)
    back_tufts = tuft_grid((-12.5, -7.5, -2.5, 2.5, 7.5, 12.5), (-2.6, 1.4), 1.8) + tuft_grid((-10, -5, 0, 5, 10), (-0.6, 3.4), 1.8)
    walnut = wood(it, "walnut", "ry", knots=0)
    brass = metal(it, "brass")
    oat = fabric(it, "oat", P["oat"], tone=3.2)
    for x in (-15.6, 15.6):
        for z in (-5.2, 5.2):
            it.loft("foot", [(0, 0.5, 0, 1.6), (0, 1.2, 0, 2.4), (0, 2.2, 0, 1.8)], walnut, sides=8, pivot=(x, 0, z), up=[0, 0, 1])
            it.cyl("footcap", (x, 0, z), 0.9, 0.6, brass, sides=6)
    it.box("base", (0, 4.2, 0.2), (34, 4.4, 14), plum, ch=0.9,
           paint={"layers": [{"id": "welt", "op": "band", "axis": "y", "from": -1, "to": -0.7, "shift": -1.0}]})
    it.box("back", (0, 12.2, -5.3), (31, 12, 3.6), plum, ch=1.0,
           paint={"layers": [{"id": "tufts", "op": "spots", "centers": back_tufts, "shift": -1.7, "roughness": 0.1, "bevel": TUFT_BEVEL, "faces": ["front"]},
                             {"id": "pleats", "op": "stripes", "axis": [1, 1, 0], "period": 5.0, "width": 0.08, "shift": -0.7, "faces": ["front"]},
                             {"id": "pleats2", "op": "stripes", "axis": [1, -1, 0], "period": 5.0, "width": 0.08, "shift": -0.7, "faces": ["front"]}]})
    it.loft("crest", [(-16, 0, 0, (3.6, 2.4)), (-8, 0.3, 0, (4.0, 2.8)), (8, 0.3, 0, (4.0, 2.8)), (16, 0, 0, (3.6, 2.4))], plum, sides=8, round_=2.2, pivot=(0, 18.3, -5.4))
    cols = [P["rose"], P["honey"], P["sage"], P["lake"], P["oat"], P["lilac"], P["terracotta"]]
    W, H = face_px(10 - 2 * 0.9, 11 - 2 * 0.9, it.density)
    for i, x in enumerate((-10.2, 0, 10.2)):
        it.box("seat", (x, 8.0, 1.5), (10, 3.6, 11), oat, ch=0.9,
               paint={"layers": patch_layers(it, f"s{i}", cols, 3, 3, seed=11 + i) + patch_layers(it, f"sf{i}", cols, 3, 1, seed=21 + i, faces=["front"], cols_only=True),
                      "stamps": [{"face": "top", "at": [0, 0], "art": stitch_art(W, H, 3, 3, margin=0), "key": thread(it)}]})
    mauve = fabric(it, "mauve", 0xa07a90, tone=3.4)
    for i, x in enumerate((-10.2, 0, 10.2)):
        it.box("backcush", (x, 13.6, -2.7), (9.4, 8.4, 2.4), mauve, ch=0.9, rot=(-10, 0, 0),
               paint={"layers": [{"id": "tuft", "op": "spots", "centers": [[0, 0.6, 1.2, 0.5]], "shift": -1.6, "bevel": TUFT_BEVEL},
                                 {"id": "dimple", "op": "stripes", "axis": [1, 1, 0], "period": 4.6, "width": 0.07, "shift": -0.5, "faces": ["front"]}]})
    for s in (-1, 1):
        it.box("arm", (s * 16.0, 9.0, 0.4), (3.6, 6.2, 13.6), plum, ch=0.8)
        it.loft("roll", [(0, 0, -6.9, 3.6), (0, 0, -6.5, 4.6), (0, 0, 6.5, 4.6), (0, 0, 6.9, 3.6)], plum, sides=10, round_=2.0, pivot=(s * 16.4, 12.4, 0.4),
                paint={"layers": [{"id": "rosette", "op": "spots", "centers": [[0, 0, 6.95, 0.55]], "shift": -1.4, "bevel": {"shadow": 1, "highlight": 1}},
                                  {"id": "pleat", "op": "stripes", "axis": [1, 1, 0], "period": 1.0, "width": 0.25, "shift": -0.6, "faces": ["end", "start"]}]})
    honey = soft(it, "honey", P["honey"], tone=3.2, pattern=check_layers(it, "honeyck", P["ochre"], 1.4, tone=2.8, axes=("x", "y")))
    sage = soft(it, "sage", P["sage"], tone=3.3, pattern=[{"id": "flowers", "op": "spots", "count": 7, "radius": [0.5, 0.8], "ramp": it.ramp("cl_sagefl", P["blush"], n=5), "tone": 2.8, "min_gap": 2, "bevel": True}])
    pillow(it, "pillow", (-11.4, 11.8, -1.2), 6.4, 6.2, 2.4, honey, rot=(-14, 14, 9))
    pillow(it, "pillow", (11.2, 11.6, -1.2), 6.0, 5.8, 2.4, sage, rot=(-14, -12, -8))
    k = knit(it, "throw", P["cream"], stripe=P["terracotta"], every=3.0)
    it.box("throw", (16.4, 15.1, 1.0), (4.2, 0.8, 8.0), k)
    it.box("throw", (18.6, 11.0, 1.0), (0.8, 8.6, 8.0), k, rot=(0, 0, -3))
    it.box("throw", (14.1, 12.6, 1.0), (0.8, 4.8, 8.0), k, rot=(0, 0, 18))
    return it.spec()


@item
def beanbag():
    it = Item("beanbag", "Squashy Beanbag", density=4)
    cord = soft(it, "cord", P["terracotta"], tone=3.4, flow="path", pattern=[
        {"id": "wale", "op": "stripes", "axis": "around", "period": 0.042, "width": 0.45, "shift": -0.8},
        {"id": "seams", "op": "stripes", "axis": "around", "period": 0.1667, "width": 0.05, "shift": -1.6}])
    # one squashy teardrop that slumps back into a backrest, with a sat-in hollow on its front slope
    it.loft("bag", [(0, 0, 0.6, (13.0, 12.6)), (0, 1.4, 0.6, (16.4, 15.8)), (0, 3.6, 0.4, (17.0, 16.2)), (0, 5.8, -0.4, (16.4, 14.6)),
                    (0, 7.4, -2.6, (15.2, 10.4)), (0, 9.6, -3.8, (13.8, 7.8)), (0, 12.4, -4.4, (11.0, 6.2)), (0, 14.4, -4.7, (6.6, 4.2)), (0, 15.2, -4.8, (2.0, 1.4))],
            cord, sides=14, round_=2.0, pivot=(0, 0, 0), up=[0, 0, 1])
    it.loft("dent", [(0, 0, 0, (11.0, 6.4)), (0, 0.25, 0, (10.0, 5.6)), (0, 0.4, 0, (6.0, 3.2))], soft(it, "dent", P["clay"], tone=3.0, flow="vertical",
            pattern=[{"id": "wale", "op": "stripes", "axis": "x", "period": 0.5, "width": 0.45, "shift": -0.7}]), sides=12, pivot=(0.2, 6.7, 2.2), rot=(-14, 0, 0), up=[0, 0, 1])
    it.cyl("button", (0, 14.9, -4.6), 0.9, 0.5, soft(it, "button", P["clay"], tone=2.4), sides=8, rot=(-20, 0, 0))
    it.loft("handle", [(0, 0, 0, (2.6, 0.5)), (0, 0.9, -0.7, (2.6, 0.5)), (0, 1.8, 0, (2.6, 0.5))], soft(it, "strap", P["clay"], tone=2.6), sides=4,
            pivot=(0, 9.0, -8.0), rot=(-20, 0, 0), up=[0, 0, 1])
    it.box("tag", (3.6, 3.0, 7.9), (2.0, 1.4, 0.3), plain(it, "tag", P["paper"], tone=3.6, layers=[{"id": "logo", "op": "rect", "rect": [0.2, 0.35, 0.8, 0.6], "ramp": "cl_cord", "tone": 3}]),
           rot=(0, 12, 0))
    return it.spec()


@item
def rocking_chair():
    it = Item("rocking_chair", "Grandmother Rocking Chair", density=3.5)
    ch = wood(it, "cherry", "y")
    chx = wood(it, "cherry", "x")
    chz = wood(it, "cherry", "z")
    chr_ = wood(it, "cherry", "rz", knots=0)
    for x in (-5, 5):
        pts = [(0, 26 - math.cos(a) * 26 + 0.8, math.sin(a) * 26, (1.6, 1.4)) for a in [-0.62 + i / 7 * 1.24 for i in range(8)]]
        it.loft("rocker", pts, chr_, sides=4, round_=2.0, pivot=(x, 0, 0), up=[0, 1, 0])
        it.box("leg", (x, 5.2, 4.4), (1.6, 7.4, 1.6), ch, ch=0.3)
        it.box("leg", (x, 5.2, -4.0), (1.6, 7.4, 1.6), ch, ch=0.3)
    it.box("seat", (0, 8.6, 0.4), (12, 1.4, 11), chx, ch=0.4)
    back = it.bone("back", (0, 9.2, -5.2), rot=(-10, 0, 0))
    it.box("backrail", (0, 0.8, 0), (12, 1.4, 1.4), chx, parent=back, ch=0.3)
    it.box("crest", (0, 16.6, 0), (13, 2.4, 1.6), chx, parent=back, ch=0.5)
    it.loft("crestcap", [(-4.5, 0, 0, (1.4, 1.0)), (0, 0.8, 0, (1.4, 1.2)), (4.5, 0, 0, (1.4, 1.0))], chr_, sides=4, round_=2.0, pivot=(0, 18.2, 0), parent=back)
    for x in (-5.8, 5.8):
        it.box("stile", (x, 8.4, 0), (1.6, 16, 1.6), ch, parent=back, ch=0.3)
    for x in (-3, -1, 1, 3):
        it.loft("spindle", [(0, 0, 0, 0.9), (0, 3, 0, 1.2), (0, 7, 0, 0.8), (0, 11, 0, 1.1), (0, 14.4, 0, 0.9)], chr_, sides=6, pivot=(x, 1.4, 0), parent=back, up=[0, 0, 1])
    for x in (-6.2, 6.2):
        it.box("arm", (x, 14.6, 0.4), (1.6, 1.2, 11.4), chz, ch=0.3)
        it.box("armpost", (x, 11.9, 4.8), (1.2, 4.6, 1.2), ch, ch=0.2)
    it.box("cushion", (0, 10.3, 0.8), (10.4, 1.8, 9.6), fabric(it, "cush", P["honey"], tone=3.2), ch=0.6,
           paint={"layers": [{"id": "tufts", "op": "spots", "centers": tuft_grid((-2.5, 2.5), (0.9,), 0, 0.45) + [[x, 0.9, z, 0.45] for x in (-2.5, 2.5) for z in (-2.4, 2.4)],
                              "shift": -1.6, "bevel": TUFT_BEVEL, "faces": ["top"]}]})
    for x in (-4.8, 4.8):
        it.box("tie", (x, 10.6, -4.2), (0.5, 2.4, 0.5), plain(it, "tie", P["ochre"], tone=3.0))
    # a granny-square blanket over the back: crocheted squares with dark joins
    cols = [P["berry"], P["honey"], P["fern"], P["dusk"], P["cream"], P["terracotta"]]
    gs = [{"id": "gs_base", "op": "fill", "ramp": it.ramp("kn_join", P["ink2"], n=4, lo=0.5, hi=0.6), "tone": 1.6}]
    import random
    r = random.Random(9)
    for i in range(4):
        for j in range(3):
            c0, c1 = r.sample(range(len(cols)), 2)
            gs.append({"id": f"gs{i}{j}", "op": "rect", "rect": [i / 4 + 0.02, j / 3 + 0.03, (i + 1) / 4 - 0.02, (j + 1) / 3 - 0.03], "ramp": it.ramp(f"kn_g{c0}", cols[c0], n=6), "tone": 3.2})
            gs.append({"id": f"gc{i}{j}", "op": "rect", "rect": [i / 4 + 0.08, j / 3 + 0.1, (i + 1) / 4 - 0.08, (j + 1) / 3 - 0.1], "ramp": it.ramp(f"kn_g{c1}", cols[c1], n=6), "tone": 3.0})
            gs.append({"id": f"gd{i}{j}", "op": "rect", "rect": [i / 4 + 0.105, j / 3 + 0.14, (i + 1) / 4 - 0.105, (j + 1) / 3 - 0.14], "ramp": f"kn_g{c0}", "tone": 3.8})
    gst = it.style("granny", {"ramp": "kn_join", "tone": 1.6, "rim": {"light_shift": 0.6, "dark_shift": -0.6}, "brush": {"off": True}, "dither": 0.0,
                              "layers": [{"id": "crochet", "op": "stripes", "axis": "y", "period": 0.5, "width": 0.4, "shift": -0.4}]})
    it.box("granny", (0, 9.8, 0.9), (12.4, 9.0, 0.7), gst, parent=back, paint={"layers": gs})
    it.box("granny", (0, 17.9, -0.1), (12.6, 0.7, 2.6), gst, parent=back, paint={"layers": gs})
    # a yarn basket on the floor beside it with two balls and knitting needles
    it.loft("yarnbasket", [(0, 0, 0, 4.6), (0, 2.6, 0, 5.6), (0, 3.0, 0, 5.8)], wicker(it, "yb", 0xb88d58, size=(1.0, 0.8)), sides=10, pivot=(9.6, 0, 6), caps=(True, False), up=[0, 0, 1], double_sided=True)
    for (x, y, z, c, rr) in ((9.0, 2.6, 6.4, P["dusk"], 1.7), (10.6, 2.8, 5.2, P["berry"], 1.5)):
        it.loft("yarn", [(0, 0, 0, rr * 1.2), (0, rr * 0.8, 0, rr * 2), (0, rr * 1.7, 0, rr * 1.0)], soft(it, f"yarn{c:x}", c, pattern=[
            {"id": "wind", "op": "stripes", "axis": [1, 1, 0.3], "period": 0.6, "width": 0.4, "shift": -0.9}]), sides=8, pivot=(x, y, z), up=[0, 0, 1])
    for k in range(2):
        it.cyl("needle", (9.8 + k * 0.6, 4.6, 6.0), 0.18, 6, metal(it, "pewter"), sides=4, axis="z", rot=(30 + k * 12, 40, 0))
    return it.spec()


@item
def window_seat():
    it = Item("window_seat", "Window-Nook Bench", density=3)
    teal = painted(it, "teal", 0x7d9e92, under="oak", grain="x")
    tealy = painted(it, "teal", 0x7d9e92, under="oak", grain="y")
    brass = metal(it, "brass")
    top = wood(it, "light", "x")
    it.box("plinth", (0, 0.7, 0), (36, 1.4, 12), wood(it, "dark", "x"), ch=0.3)
    it.box("body", (0, 4.2, 0), (35, 5.6, 11), teal, ch=0.3)
    for x in (-8.6, 0, 8.6):
        drawer(it, "drawer", (x, 4.2, 5.6), 8, 4.4, teal, pull=brass, pulls=2)
    for x in (-13.5, 13.5):
        drawer(it, "drawer", (x, 4.2, 5.6), 5.0, 4.4, teal, keyhole=ink(it))
    it.box("lid", (0, 7.5, 0), (36, 1.0, 12.4), top, ch=0.3)
    it.box("backpanel", (0, 14, -5.4), (36, 12, 1.6), tealy, ch=0.3, paint={"layers": [{"id": "boards", "op": "stripes", "axis": "x", "period": 4.0, "width": 0.06, "shift": -1.4, "faces": ["front"]}]})
    it.box("backcap", (0, 20.7, -5.2), (37, 1.4, 2.8), top, ch=0.4)
    for s in (-1, 1):
        it.box("cheek", (s * 17.4, 12, 0), (1.6, 8, 12), tealy, ch=0.3)
        it.box("cheekcap", (s * 17.4, 16.5, 0), (2.2, 1.0, 12.6), top, ch=0.3)
    it.box("cushion", (0, 9.2, 0.6), (33, 2.4, 10), fabric(it, "cush", P["linen"], tone=3.4), ch=0.8,
           paint={"layers": [{"id": "pipe", "op": "band", "axis": "y", "from": 0.55, "to": 0.9, "ramp": it.ramp("cl_pipe", P["rose"], n=6), "tone": 3.0, "faces": ["sides"]},
                             {"id": "buttons", "op": "spots", "centers": [[x, 1.2, 0, 0.45] for x in (-12, -6, 0, 6, 12)], "shift": -1.5, "bevel": TUFT_BEVEL, "faces": ["top"]}]})
    rose = soft(it, "rose", P["rose"], pattern=stripe_layers(it, "bol", P["cream"], "z", 1.4, 0.3, tone=3.4))
    for s in (-1, 1):
        bolster(it, "bolster", (s * 14.4, 12.1, 0.6), 9.4, 1.7, rose, rot=(0, 0, 0))
    pl = soft(it, "plaid", P["dusk"], pattern=plaid_layers(it, "pl", "cl_plaid", P["honey"], P["berry"], period=2.4, axes=("x", "y")))
    pillow(it, "pillow", (-5.4, 13.6, -2.8), 7, 6.4, 2.4, pl, rot=(-14, 8, 4))
    pillow(it, "pillow", (3.6, 13.4, -2.8), 6, 5.8, 2.4, soft(it, "cream", P["cream"], pattern=[{"id": "tuft", "op": "spots", "centers": [[0, 0, 1.2, 0.5]], "shift": -1.6, "bevel": TUFT_BEVEL}]), rot=(-14, -8, -4))
    # an open book face down on the cushion, and a mug
    it.box("book", (9.4, 10.6, 2.4), (6.4, 0.5, 4.6), soft(it, "bookcover", P["dusk"], tone=2.8), rot=(0, 14, 0))
    for s in (-1, 1):
        it.box("pages", (9.4 + s * 1.55, 10.95, 2.4), (3.0, 0.4, 4.3), plain(it, "pages", P["paper"], tone=3.8, layers=[
            {"id": "lines", "op": "stripes", "axis": "z", "period": 0.6, "width": 0.3, "shift": -0.8, "faces": ["top"]}]), rot=(0, 14, -s * 8), pivot=(9.4, 10.8, 2.4))
    it.loft("mug", [(0, 0, 0, 2.0), (0, 2.4, 0, 2.2)], glaze(it, "mug", P["sage"], dots=P["cream"]), sides=10, pivot=(13.4, 10.4, 2.6), caps=(True, False), up=[0, 0, 1], double_sided=True)
    it.cyl("cocoa", (13.4, 12.3, 2.6), 0.95, 0.2, plain(it, "cocoa", P["umber"], tone=3.0), sides=10)
    return it.spec()


@item
def toad_stool():
    it = Item("toad_stool", "Toadstool Seat", density=4)
    stem = plain(it, "stem", 0xeadfc6, tone=3.6, layers=[{"id": "fibres", "op": "stripes", "axis": "around", "period": 0.05, "width": 0.25, "shift": -0.5},
                                                     {"id": "mottle", "op": "noise", "scale": 1.6, "amount": 0.5}], brush={"flow": "vertical", "length": 1.0, "rough": 0.5})
    it.loft("stem", [(0, 0, 0, 9.4), (0, 0.8, 0, 8.4), (0, 2.4, 0, 7.0), (0, 5.4, 0, 6.6), (0, 7.6, 0, 7.4)], stem, sides=12, up=[0, 0, 1])
    it.loft("skirt", [(0, 0, 0, 7.2), (0, -0.4, 0, 9.0), (0, -1.0, 0, 9.4)], stem, sides=12, pivot=(0, 6.4, 0), up=[0, 0, 1], caps=(False, False), double_sided=True)
    cap = it.ramp("cl_cap", P["clay"], n=8, at=4)
    spot = it.ramp("pa_spot", P["cream"], n=5)
    capst = it.style("cap", {"ramp": cap, "tone": 4.0, "rim": {"light_shift": 0.8, "dark_shift": -0.8}, "brush": {"flow": "path", "length": 1.4, "rough": 0.5},
                             "layers": [{"id": "mottle", "op": "noise", "scale": 2.0, "amount": 0.6},
                                        {"id": "streaks", "op": "stripes", "axis": "around", "period": 0.06, "width": 0.2, "shift": -0.4},
                                        {"id": "spots", "op": "spots", "count": 16, "radius": [0.9, 1.6], "ramp": spot, "tone": 3.2, "min_gap": 1.4, "roughness": 0.3,
                                         "where": {"y": [0.2, 1.0]}, "bevel": {"shadow": 1, "highlight": 1, "shadow_shift": -1.2, "highlight_shift": 0.8}},
                                        {"id": "gloss", "op": "gloss", "dash": True, "length": 2, "shift": 1.4, "density": 0.4, "post": True}]})
    it.loft("cap", [(0, 0, 0, 13.6), (0, 0.6, 0, 16.0), (0, 1.6, 0, 15.6), (0, 2.8, 0, 13.0), (0, 3.6, 0, 9.0), (0, 4.0, 0, 3.0)], capst, sides=14, pivot=(0, 7.0, 0), up=[0, 0, 1])
    gills = it.style("gills", {"ramp": it.ramp("pa_gill", 0xd9c7a4, n=6), "tone": 2.8, "light": 0.3, "rim": {"light": 0, "dark": 0}, "brush": {"off": True}, "dither": 0.0,
                               "layers": [{"id": "gill", "op": "stripes", "axis": "around", "period": 0.025, "width": 0.4, "shift": -1.2}]})
    it.loft("gills", [(0, 0, 0, 7.0), (0, 0.6, 0, 14.0), (0, 0.7, 0, 15.6)], gills, sides=14, pivot=(0, 6.9, 0), up=[0, 0, 1], caps=(False, False), double_sided=True)
    # grass and clover tufts at the foot
    grass = grid(12, 10)
    for x in range(12):
        h = [6, 9, 5, 8, 10, 4, 7, 9, 5, 8, 6, 3][x]
        for y in range(10 - h, 10):
            grass[y][x] = "#" if y > 10 - h + 1 else "t"
    gs = leafy(it, "grass", P["fern"], tone=3.6)
    for k, a in enumerate((20, 140, 250)):
        r = math.radians(a)
        it.card("grass", (math.sin(r) * 4.8, 1.25, math.cos(r) * 4.8), gs, art=rows(grass), size=(3, 2.5), rot=(0, a + 70, 0), key={"t": "lf_grass:6"})
    return it.spec()


@item
def wingback():
    it = Item("wingback", "Tartan Wingback", density=3.5)
    base = soft(it, "tartan", P["berry"], tone=3.3, flow="horizontal", pattern=plaid_layers(it, "tt", "cl_tartan", P["pine"], P["honey"], period=3.2, axes=("x", "y")))
    tz = it.style("tartan_top", dict(it.styles[base], layers=[it.styles[base]["layers"][0]] + plaid_layers(it, "tt", "cl_tartan", P["pine"], P["honey"], period=3.2, axes=("x", "z"))))
    tside = it.style("tartan_side", dict(it.styles[base], layers=[it.styles[base]["layers"][0]] + plaid_layers(it, "tt", "cl_tartan", P["pine"], P["honey"], period=3.2, axes=("z", "y"))))
    plainb = fabric(it, "berry", P["berry"], tone=3.2)
    walnut = wood(it, "walnut", "y", knots=0)
    for x in (-6, 6):
        for z in (-5, 5):
            it.taper("leg", (x, 1.5, z), (1.8, 1.8, 3.0), walnut, rot=(-90, 0, 0), back=[1.2, 1.2], front=[0.7, 0.7])
    it.box("seatbase", (0, 5.2, 0), (15, 4.4, 13), tside, ch=0.6)
    it.box("seatcush", (0, 8.4, 1.6), (11, 2.0, 10), tz, ch=0.7, paint={"layers": [{"id": "pipe", "op": "band", "axis": "y", "from": 0.5, "to": 0.95, "shift": 0.8, "faces": ["sides"]}]})
    it.box("back", (0, 16, -5.2), (14, 17.2, 3), base, ch=0.8)
    it.loft("backtop", [(-5.2, 0, 0, (3.2, 2.6)), (0, 0.8, 0, (3.4, 3.2)), (5.2, 0, 0, (3.2, 2.6))], base, sides=8, round_=2.4, pivot=(0, 24.6, -5.2))
    it.box("backcush", (0, 14.6, -3.2), (10, 10, 1.4), plainb, ch=0.5,
           paint={"layers": [{"id": "tufts", "op": "spots", "centers": tuft_grid((-2.5, 2.5), (-2, 2), 0.7, 0.45), "shift": -1.6, "bevel": TUFT_BEVEL, "faces": ["front"]}]})
    for s in (-1, 1):
        it.box("armside", (s * 6.6, 10.0, 1.0), (2.4, 5.0, 11), tside, ch=0.5)
        it.loft("armroll", [(0, 0, -5.6, 2.8), (0, 0, -5.2, 3.6), (0, 0, 5.4, 3.6), (0, 0, 5.8, 2.8)], base, sides=8, pivot=(s * 6.9, 12.6, 1.2),
                paint={"layers": [{"id": "rosette", "op": "spots", "centers": [[0, 0, 5.85, 0.5]], "shift": -1.4, "bevel": True}]})
        # the wings: tall cheeks that flare forward
        it.taper("wing", (s * 6.9, 18.4, -2.6), (1.6, 10.6, 5.6), tside, front=[1.0, 0.55], fshift=[0, 1.6], rot=(0, s * -16, 0))
    # footstool with a folded newspaper and spectacles
    for x in (-3.6, 3.6):
        for z in (12, 17):
            it.taper("sleg", (x, 1.2, z), (1.4, 1.4, 2.4), walnut, rot=(-90, 0, 0), back=[1.2, 1.2], front=[0.7, 0.7])
    it.box("stool", (0, 3.9, 14.5), (9.6, 3.0, 7.6), plainb, ch=0.8,
           paint={"layers": [{"id": "tufts", "op": "spots", "centers": [[x, 1.5, z, 0.45] for x in (-2.4, 0, 2.4) for z in (-1.6, 1.6)], "shift": -1.6, "bevel": TUFT_BEVEL, "faces": ["top"]},
                             {"id": "pipe", "op": "band", "axis": "y", "from": 0.6, "to": 0.95, "shift": 0.8, "faces": ["sides"]}]})
    it.box("paper", (1.4, 5.6, 14.2), (4.4, 0.4, 3.0), plain(it, "news", P["oat"], tone=3.4, layers=[
        {"id": "cols", "op": "stripes", "axis": "x", "period": 1.0, "width": 0.5, "shift": -0.8, "faces": ["top"]},
        {"id": "head", "op": "band", "axis": "z", "from": -1, "to": -0.6, "shift": -1.6, "faces": ["top"]}]), rot=(0, 18, 0))
    gl = metal(it, "gold", tarnish=False)
    for sx in (-1, 1):
        it.cyl("lens", (-1.6 + sx * 0.8, 5.95, 15.6), 0.6, 0.15, gl, sides=8)
    return it.spec()
