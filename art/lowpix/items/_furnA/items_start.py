"""Starter furniture (out of the moving boxes): nestbed, roundrug, moonlamp, armchair, cushion, bookshelf, nightstand,
candles, fernpot. Units: px (16 per block), origin bottom-centre, facing +Z."""
import math

import numpy as np

from kit import (Spec, wood, painted_wood, cloth, velvet, brass, iron, glaze, clay, stone, wax, leafy, glow, soil, flat, UP,
                 pillow, lace_art, torus, arc_points, grid_art, flame_art, frond_art)

ITEMS = {}


def flame(s, n, wick, style, h=1.8, w=1.0, phase=0.0):
    """Two crossed glowing flame cards on a bone at the wick top, with a flicker clip track."""
    bid = f"flame{n}"
    s.bone(bid, at=wick)
    art = flame_art(7, 12)
    key = {"c": "flame:5", "y": "flame:3", "o": "flame:2", "r": "flame:1"}
    for k, rot in enumerate([(0, 0, 0), (0, 90, 0)]):
        s.card(f"glow_{bid}_{k}", art, style, parent=bid, rel=(0, 0, 0), rot=rot, off=(0, h / 2 - 0.05, 0), key=key,
               plane="xy", size=[w, h])
    return [
        {"part": bid, "channel": "scale", "osc": {"amp": [0.08, 0.16, 0.08], "cycles": 3, "phase": phase}},
        {"part": bid, "osc": {"axis": "z", "amp": 5, "cycles": 2, "phase": phase + 0.3}},
        {"part": bid, "osc": {"axis": "x", "amp": 3, "cycles": 1, "phase": phase + 0.6}},
    ]


def star_art(n=9):
    """A little five-point star. Keys: c core, y body, o edge."""
    def f(x, y):
        dx, dy = x - 0.5, y - 0.52
        r = math.hypot(dx, dy)
        a = math.atan2(dx, -dy)
        k = 0.5 + 0.5 * math.cos(a * 5)
        R = 0.2 + 0.3 * k ** 1.6
        if r > R:
            return "."
        return "c" if r < 0.12 else ("y" if r < R * 0.75 else "o")
    return grid_art(n, n, f)


def item(fn):
    ITEMS[fn.__name__] = fn
    return fn


@item
def nightstand():
    """Bedside table: oak carcass on tapered legs, a drawer with a brass pull, an open shelf with two books below.
    Footprint 0.5 x 0.5 blocks, top surface at 10 px."""
    s = Spec("nightstand", "Bedside Table", density=7, tris=1200)
    top = s.style("top", wood("oakl", 4.8, grain="x", knots=1, seed=1))
    body = s.style("body", wood("oak", 4.4, grain="y", knots=1, seed=2))
    front = s.style("front", wood("oak", 4.8, grain="x", knots=0, seed=3))
    leg = s.style("leg", wood("walnut", 4.6, grain="y", knots=0, wear=0.3, seed=4))
    pull = s.style("pull", brass())
    s.box("top", [10, 1, 9], top, (0, 9.5, 0), chamfer=0.3)
    s.box("lip", [9.4, 0.5, 8.4], body, (0, 8.75, 0))
    s.box("carcass", [9, 4.6, 8], body, (0, 6.3, -0.1), hide=["top"])
    s.box("drawer", [7.8, 3.4, 0.5], front, (0, 6.4, 4.05), chamfer=0.2,
          paint={"layers": [{"id": "panel", "op": "panel", "inset": 3, "shift": -0.6, "highlight": 1, "shadow": 1}]})
    s.add("pull", "prism", [1.0, 1.0, 0.7], pull, centre=(0, 6.6, 4.6), sides=8)
    s.box("shelf", [8.4, 0.6, 7.6], top, (0, 1.6, -0.1))
    s.box("backboard", [8.4, 2.4, 0.4], body, (0, 2.9, -3.8))
    for k, (x, z) in enumerate([(-3.9, 3.4), (3.9, 3.4), (-3.9, -3.5), (3.9, -3.5)]):
        s.cyl(f"leg{k}", 1.2, 4.1, leg, (x, 0, z), sides=6, bottom=0.65)
    bk1 = s.style("bk1", cloth("berry", 3.8, weave=0.3, photo="brown_leather", scale=6))
    bk2 = s.style("bk2", cloth("lake", 3.8, weave=0.3, photo="brown_leather", scale=6))
    pages = s.style("pages", {"ramp": "paper", "tone": 4, "rim": {"outline": "none"},
                              "layers": [{"id": "leaves", "op": "stripes", "axis": "y", "period": 0.3, "width": 0.4, "shift": -0.8}]})
    s.box("book1", [5.2, 1.0, 3.8], bk1, (-0.6, 2.4, 0.3), rot=(0, 8, 0))
    s.box("book1p", [4.8, 0.7, 3.6], pages, (-0.5, 2.4, 0.4), rot=(0, 8, 0))
    s.box("book2", [4.4, 0.9, 3.2], bk2, (-0.2, 3.35, 0.4), rot=(0, -12, 0))
    return s


@item
def armchair():
    """A deep club armchair in moss velvet: chesterfield-tufted back with a top roll, rolled arms with brass-buttoned
    scrolls, a puffy seat cushion, a honey gingham lumbar pillow and a crochet doily over the back. Turned walnut legs.
    Footprint 1 x 1 block, about 17 px tall; sit anchor (0, 6, 1)."""
    s = Spec("armchair", "Velvet Armchair", density=6, tris=3000)
    vel = s.style("vel", velvet("moss", 3.6))
    vel_d = s.style("vel_d", velvet("moss", 3.1, seed=4))
    leg = s.style("leg", wood("walnut", 4.2, grain="y", knots=0, wear=0.3, seed=4))
    btn = s.style("btn", brass())
    sx, sy = 3.4, 2.6
    per = sx * sy / (sx * sx + sy * sy) ** 0.5
    tufts = [[x * sx / 2, y * sy / 2 - 0.5, 1.75, 0.42] for x in range(-3, 4) for y in range(-2, 4) if (x + y) % 2 == 0]
    tuft_layers = [
        {"id": "pleat_a", "op": "stripes", "axis": [sy, sx, 0], "period": per, "width": 0.11, "phase": per * 0.055, "shift": -0.9, "faces": ["front"]},
        {"id": "pleat_b", "op": "stripes", "axis": [sy, -sx, 0], "period": per, "width": 0.11, "phase": per * 0.055, "shift": -0.9, "faces": ["front"]},
        {"id": "tufts", "op": "spots", "centers": tufts, "ramp": "moss", "tone": 1.2, "bevel": {"highlight_shift": 1.6, "shadow_shift": -1.0}},
    ]
    for k, (x, z) in enumerate([(-6.1, 5.2), (6.1, 5.2), (-6.1, -5.6), (6.1, -5.6)]):
        s.cyl(f"leg{k}", 1.7, 2.5, leg, (x, 0, z), sides=8, bottom=0.62)
    nails = [[x * 0.9, -1.35, 6.75, 0.22] for x in range(-8, 9)]
    s.box("base", [15.2, 3.8, 13.6], vel_d, (0, 4.3, 0.2), chamfer=0.9, hide=["bottom"],
          paint={"layers": [{"id": "pipe", "op": "band", "axis": "y", "from": 0.62, "to": 0.78, "shift": 0.9},
                            {"id": "pipe_s", "op": "band", "axis": "y", "from": 0.5, "to": 0.62, "shift": -0.9},
                            {"id": "nails", "op": "spots", "centers": nails, "ramp": "brass", "tone": 4.5, "bevel": True}]})
    pillow(s, "seat", (0, 7.3, 1.2), 10.8, 2.8, 10.6, vel, paint={"layers": [
        {"id": "seam", "op": "band", "axis": "y", "from": -0.12, "to": 0.0, "shift": -0.7},
        {"id": "dimple", "op": "spots", "centers": [[0, 1.4, 0, 0.5]], "ramp": "moss", "tone": 1.6, "bevel": True}]})
    s.box("back", [14.2, 10.6, 3.4], vel, (0, 11.6, -5.0), rot=(-9, 0, 0), chamfer=1.2, hide=["bottom"],
          paint={"layers": tuft_layers})
    s.loft("toproll", [((-7.3, 0, 0), [2.2, 1.6]), ((-6.6, 0, 0), [3.8, 3.0]), ((0, 0, 0), [4.2, 3.2]), ((6.6, 0, 0), [3.8, 3.0]), ((7.3, 0, 0), [2.2, 1.6])],
           vel_d, at=(0, 16.7, -5.9), sides=10, round_=2.1, subdiv=0)
    for side in (-1, 1):
        x = side * 6.75
        sd = "l" if side < 0 else "r"
        s.box(f"arm_{sd}", [2.7, 4.8, 12.4], vel, (x, 8.5, 0.6), chamfer=0.8, hide=["bottom"])
        s.loft(f"armroll_{sd}", [((0, 0, -6.0), [2.6, 2.0]), ((0, 0, -5.2), [3.6, 2.7]), ((0, 0, 5.8), [3.8, 2.8]), ((0, 0, 6.8), [3.4, 2.5])],
               vel_d, at=(x + side * 0.3, 11.2, 0.4), sides=10, round_=2.1, subdiv=0)
        s.add(f"scroll_{sd}", "prism", [2.6, 2.6, 0.5], vel_d, centre=(x + side * 0.3, 10.6, 7.25), sides=10,
              paint={"layers": [{"id": "swirl", "op": "spots", "centers": [[0, 0, 0.25, 0.8]], "shift": -0.9, "bevel": True}]})
        s.add(f"button_{sd}", "prism", [0.9, 0.9, 0.4], btn, centre=(x + side * 0.3, 10.6, 7.6), sides=8)
    ging = s.style("ging", cloth("oat", 5.0, weave=0.3, photo="rough_linen", scale=6))
    pillow(s, "lumbar", (0, 10.4, -2.4), 7.0, 4.4, 2.2, ging, rot=(-14, 0, 6), paint={"layers": [
        {"id": "check_a", "op": "stripes", "axis": "x", "period": 1.2, "width": 0.5, "ramp": "honey", "tone": 4.2},
        {"id": "check_b", "op": "stripes", "axis": "y", "period": 1.2, "width": 0.5, "shift": -1.3},
        {"id": "check_c", "op": "stripes", "axis": "z", "period": 1.2, "width": 0.5, "shift": -1.3, "faces": ["top", "bottom"]}]})
    lace = s.style("lace", {"ramp": "paper", "tone": 4, "light": 0.6, "rim": {"outline": "none"}, "layers": []})
    s.card("doily", lace_art(48, 22), lace, at=(0, 16.6, -3.65), rot=(-12, 0, 0), plane="xy",
           key={"w": "paper:6", "l": "paper:5", "s": "paper:3"})
    return s


def twig_style(rmp="twig", tone=4.2, seed=0):
    """Woven twigs: lit strands crossing each other, dark gaps between them, bark texture."""
    return {"ramp": rmp, "tone": tone, "rim": {"light": 1, "dark": 1, "light_shift": 0.6, "dark_shift": -0.6, "outline": "none"},
            "layers": [
                {"id": "strand_a", "op": "stripes", "axis": "path", "period": 1.1, "width": 0.42, "shift": 1.0, "wobble": 0.9,
                 "zigzag": [0.9, 0.5], "seed": seed},
                {"id": "strand_b", "op": "stripes", "axis": "around", "period": 0.11, "width": 0.3, "shift": -1.2, "wobble": 0.04,
                 "seed": seed + 1},
                {"id": "gaps", "op": "stripes", "axis": "path", "period": 0.75, "width": 0.18, "shift": -1.4, "wobble": 1.4, "seed": seed + 2},
                {"id": "bark", "op": "photo", "src": "art/lowpix/items/_furnA/photos/bark_brown_02", "scale": 6, "amount": 0.6, "ramps": [rmp]},
                {"id": "moss", "op": "patches", "scale": 1.6, "threshold": 0.8, "ramp": "moss", "tone": 3.5, "seed": seed + 3},
            ],
            "brush": {"flow": "path", "length": 1.6, "width": 0.4, "rough": 0.5, "textures": {rmp: "wood", "moss": "moss"}}}


def twig_art(w, h, seed=0):
    """A forked twig for card art. Keys: t twig, d dark side, l lit side."""
    rng = np.random.default_rng(seed)
    g = [["."] * w for _ in range(h)]

    def line(x0, y0, x1, y1):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 1.5) + 1
        for k in range(n + 1):
            t = k / n
            x, y = int(round(x0 + (x1 - x0) * t)), int(round(y0 + (y1 - y0) * t))
            if 0 <= x < w and 0 <= y < h:
                g[y][x] = "t"
                if x + 1 < w and g[y][x + 1] == ".":
                    g[y][x + 1] = "d"
                if x - 1 >= 0 and g[y][x - 1] == ".":
                    g[y][x - 1] = "l"
    cx = w // 2
    line(cx, h - 1, cx + rng.integers(-2, 3), 0)
    for k in range(2):
        y0 = int(h * (0.35 + 0.25 * k))
        line(cx, y0, cx + (1 if k else -1) * (w // 2 - 1), y0 - h // 4)
    return ["".join(r) for r in g]


def feather_art(w, h):
    """An owl feather: a pale vane with tawny bars and a quill. Keys: q quill, c cream, b bar, s shade."""
    def f(x, y):
        yy = 1 - y
        half = 0.5 * math.sin(min(1.0, yy * 1.1) * math.pi) ** 0.7 if yy > 0.08 else 0
        dx = x - 0.5 + (yy - 0.5) * 0.1
        if abs(dx) < 0.06 and yy < 0.97:
            return "q"
        if abs(dx) > half:
            return "."
        band = int((yy + abs(dx) * 0.6) * 7) % 2
        return "b" if band and yy > 0.15 else ("s" if dx > half * 0.6 else "c")
    return grid_art(w, h, f)


@item
def nestbed():
    """The twig nest bed: a woven twig bowl with a thick rim, lined with a patchwork quilt, a linen pillow with a
    stitched moon, stray twigs, two tucked owl feathers and a fern leaf. Footprint 1.5 x 1.5 blocks; sleep at y 6."""
    s = Spec("nestbed", "Twig Nest Bed", density=5, tris=3000)
    tw = s.style("tw", twig_style("twig", 4.0))
    tw_d = s.style("tw_d", twig_style("twig", 3.3, seed=5))
    s.lathe("bowl", [(0, 15.5), (0.8, 18.4), (2.2, 20.6), (3.8, 21.6), (4.6, 21.0)], tw_d, sides=14, round_=2.0, caps=(False, False))
    torus(s, "rim", (0, 4.9, 0), 10.0, [4.0, 3.6], tw, n=18, sides=8)
    # patchwork quilt mattress
    quilt = s.style("quilt", {**cloth("rose", 4.4, weave=0.35, photo="rough_linen", scale=6),
                              "layers": cloth("rose", 4.4, weave=0.35, photo="rough_linen", scale=6)["layers"] + [
                                  {"id": "patch_a", "op": "stripes", "axis": "x", "period": 6.4, "width": 0.5, "ramp": "sage", "tone": 4.6},
                                  {"id": "patch_b", "op": "stripes", "axis": "z", "period": 6.4, "width": 0.5, "ramp": "lake", "tone": 4.6, "phase": 1.6},
                                  {"id": "patch_c", "op": "stripes", "axis": [1, 0, 1], "period": 9.05, "width": 0.25, "ramp": "honey", "tone": 5.0},
                                  {"id": "seam_a", "op": "stripes", "axis": "x", "period": 3.2, "width": 0.07, "shift": -1.3},
                                  {"id": "seam_b", "op": "stripes", "axis": "z", "period": 3.2, "width": 0.07, "shift": -1.3},
                                  {"id": "stitch_a", "op": "stripes", "axis": "x", "period": 3.2, "width": 0.05, "phase": 0.45, "shift": 1.6,
                                   "faces": ["up"]},
                              ]})
    s.lathe("quilt", [(3.4, 16.8), (4.6, 17.8), (5.5, 17.2), (6.0, 15.2)], quilt, sides=14, round_=2.0, caps=(False, True))
    # turned-down quilt edge (a soft roll across the front)
    s.loft("fold", [((-6.8, 0, 0), [1.6, 1.0]), ((-5.6, 0, 0), [2.6, 1.6]), ((0, 0.3, 0), [3.0, 1.8]), ((5.6, 0, 0), [2.6, 1.6]), ((6.8, 0, 0), [1.6, 1.0])],
           quilt, at=(0, 6.2, 3.6), sides=8, round_=2.0)
    pil = s.style("pil", cloth("linen", 5.0, weave=0.3, photo="rough_linen", scale=6))
    pillow(s, "pillow", (0, 7.2, -5.0), 9.4, 2.8, 4.6, pil, rot=(-14, 0, 0), paint={"layers": [
        {"id": "moon", "op": "spots", "centers": [[1.6, 1.2, 0.6, 0.9]], "ramp": "honey", "tone": 4.4},
        {"id": "bite", "op": "spots", "centers": [[2.2, 1.35, 0.3, 0.75]], "ramp": "linen", "tone": 5.0},
        {"id": "dots", "op": "spots", "count": 9, "radius": [0.14, 0.2], "ramp": "lake", "tone": 4.0, "seed": 4, "faces": ["up"]},
        {"id": "seam", "op": "band", "axis": "y", "from": -0.1, "to": 0.05, "shift": -0.8}]})
    # stray twigs, feathers and a leaf tucked in the rim
    tws = s.style("tws", {"ramp": "twig", "tone": 4, "light": 0.8, "rim": {"outline": "none"}, "layers": []})
    for k in range(9):
        a = k * 40 + 13
        r = 11.6
        x, z = math.sin(math.radians(a)) * r, math.cos(math.radians(a)) * r
        s.card(f"twig{k}", twig_art(14, 22, seed=k), tws, at=(x * 0.92, 5.4, z * 0.92), rot=(0, a + 90, (-1) ** k * 30 - 8),
               size=[2.6, 4.2], key={"t": "twig:3", "d": "twig:1", "l": "twig:5"}, off=(0, 1.6, 0))
    fea = s.style("fea", {"ramp": "cream", "tone": 5, "light": 0.8, "rim": {"outline": "none"}, "layers": []})
    for k, (a, tilt) in enumerate([(-38, 24), (-52, -10)]):
        x, z = math.sin(math.radians(a)) * 10.6, math.cos(math.radians(a)) * 10.6
        s.card(f"feather{k}", feather_art(12, 30), fea, at=(x, 6.0, z), rot=(0, a + 90, tilt), size=[1.8, 4.6], off=(0, 2.0, 0),
               key={"q": "oat:3", "c": "cream:6", "b": "ochre:3", "s": "cream:3"})
    fernc = s.style("fernc", {"ramp": "fern", "tone": 4, "light": 0.8, "rim": {"outline": "none"}, "layers": []})
    s.card("fern", frond_art(18, 30, lean=0.4, seed=2), fernc, at=(8.2, 6.0, -6.2), rot=(0, 130, -30), size=[3.0, 5.0], off=(0, 2.2, 0),
           key={"s": "fern:2", "l": "fern:4", "d": "fern:2", "h": "fern:6"})
    return s


@item
def roundrug():
    """The moon rug: a coiled braided rag rug (dusk blue, oat, sage and rose braids) around a linen centre with an
    appliqued honey crescent and stitched stars. 1.5 x 1.5 blocks, flat (0.6 px)."""
    s = Spec("roundrug", "Moon Rug", density=6, tris=3200, hero=(28, 48))
    braid = lambda rmp, tone, seed: {**cloth(rmp, tone, weave=0.25, photo="hessian_230", scale=5, seed=seed),
                                     "layers": [
                                         {"id": "braid", "op": "stripes", "axis": "path", "period": 0.9, "width": 0.45, "shift": -1.0,
                                          "zigzag": [0.55, 0.5], "zig_axis": "around"},
                                         {"id": "lit", "op": "stripes", "axis": "path", "period": 0.9, "width": 0.18, "phase": 0.5, "shift": 0.9,
                                          "zigzag": [0.55, 0.5], "zig_axis": "around"},
                                         {"id": "photo", "op": "photo", "src": "art/lowpix/items/_furnA/photos/hessian_230", "scale": 5, "amount": 0.4, "ramps": [rmp]},
                                         {"id": "fuzz", "op": "noise", "scale": 1.0, "amount": 0.4, "seed": seed}],
                                     "brush": {"flow": "path", "length": 0.8, "width": 0.4, "rough": 0.4, "textures": {rmp: "cloth"}}}
    cols = [("dusk", 3.8), ("oat", 4.6), ("sage", 4.2), ("dusk", 3.8), ("rose", 4.2), ("oat", 4.6), ("dusk", 3.6), ("sage", 4.0)]
    styles = {}
    for k, (c, t) in enumerate(cols):
        key = f"br_{c}"
        if key not in styles:
            styles[key] = s.style(key, braid(c, t, k))
    r = 3.8
    for k, (c, t) in enumerate(cols):
        n = max(12, int(r * 2.3))
        torus(s, f"coil{k}", (0, 0.32, 0), r, [1.22, 0.62], styles[f"br_{c}"], n=n, sides=6, round_=2.2)
        r += 1.08
    centre = s.style("centre", {**cloth("linen", 4.8, weave=0.4, photo="rough_linen", scale=5), })
    s.lathe("centre", [(0, 7.0), (0.5, 7.2), (0.62, 6.0)], centre, sides=16, caps=(False, True), paint={"layers": [
        {"id": "stars", "op": "spots", "centers": [[-2.2, 0.6, 1.4, 0.22], [1.9, 0.6, -2.0, 0.2], [-1.0, 0.6, -2.5, 0.18], [2.5, 0.6, 1.5, 0.16]],
         "ramp": "honey", "tone": 5.2}]})
    moon = s.style("moon", {"ramp": "honey", "tone": 4.6, "light": 0.7, "rim": {"outline": "none"}, "layers": []})

    def crescent(x, y):
        dx, dy = x - 0.5, y - 0.5
        a = math.hypot(dx, dy) < 0.46
        b = math.hypot(dx - 0.2, dy + 0.1) < 0.36
        if not a or b:
            return "."
        edge = math.hypot(dx, dy) > 0.4 or math.hypot(dx - 0.2, dy + 0.1) < 0.41
        return "s" if edge else ("h" if dx < -0.15 and dy < 0 else "m")
    s.card("applique", grid_art(28, 28, crescent), moon, at=(0, 0.66, 0), plane="xz", size=[4.6, 4.6], rot=(0, -20, 0),
           key={"m": "honey:4", "h": "honey:6", "s": "paper:5"})
    return s


@item
def moonlamp():
    """Crescent moon nightlight: a sleepy glowing moon (unlit glow material) held by a brass crook on a turned walnut
    base, with a little star dangling from its tip on a thread (the star sways). Small item, ~18 px tall."""
    s = Spec("moonlamp", "Crescent Moon Lamp", density=8, tris=1600, hero=(30, 16))
    base = s.style("base", wood("walnut", 4.4, grain="x", knots=0, wear=0.4, seed=2))
    br = s.style("br", brass())
    s.lathe("base", [(0, 6.4), (0.5, 6.6), (0.9, 6.2), (1.2, 4.6), (1.8, 3.6), (2.1, 2.4)], base, sides=12, caps=(False, True))
    s.cyl("stem", 0.7, 5.4, br, (0, 2.0, 0), sides=6)
    s.lathe("collar", [(0, 1.4), (0.5, 1.2)], br, base=(0, 7.2, 0), sides=8)
    # the crook: a brass arc cradling the moon's back
    pts = arc_points(4.6, -200, -120, 6)
    s.loft("crook", [((x, y, 0), [0.7, 0.7]) for x, y, _ in pts], br, at=(0.6, 12.6, -0.4), sides=6, round_=2.0)
    # the moon: a loft along an arc, pinched to points at both tips
    moon = s.style("moon", {**glow("glow", 2.6), "layers": glow("glow", 2.6)["layers"] + [
        {"id": "craters", "op": "spots", "count": 6, "radius": [0.25, 0.45], "shift": -0.7, "seed": 3, "bevel": True}]})
    n = 11
    pts = arc_points(4.2, 35, -215, n)
    rings = []
    for k, (x, y, _) in enumerate(pts):
        t = k / (n - 1)
        th = math.sin(t * math.pi) ** 0.9
        rings.append(((x, y, 0), [max(0.35, 3.2 * th), max(0.3, 3.4 * th)]))
    s.loft("glow_moon", rings, moon, at=(0.6, 12.6, 0), sides=8, round_=2.0, subdiv=1, paint={"layers": [
        # a sleepy closed eye and a rosy cheek on the front of the moon
        {"id": "eye", "op": "spots", "centers": [[-3.9 + 0.25 * k, 0.6 - 0.12 * abs(k - 2), 1.55, 0.2] for k in range(5)], "ramp": "ochre", "tone": 1.5},
        {"id": "cheek", "op": "spots", "centers": [[-3.2, -0.6, 1.5, 0.45]], "ramp": "rose", "tone": 4.6}]})
    # dangling star
    s.bone("starhang", at=(3.4, 15.9, 0.2))
    thread = s.style("thread", {"ramp": "oat", "tone": 3, "light": 0, "rim": {"outline": "none"}, "layers": []})
    s.card("thread", ["t"] * 8, thread, parent="starhang", rel=(0, 0, 0), off=(0, -1.4, 0), size=[0.14, 2.8], key={"t": "oat:2"})
    starst = s.style("starst", glow("glow", 4.6))
    sa = star_art(11)
    for k, rot in enumerate([(0, 0, 0), (0, 90, 0)]):
        s.card(f"glow_star{k}", sa, starst, parent="starhang", rel=(0, -3.4, 0), rot=rot, size=[1.6, 1.6],
               key={"c": "glow:6", "y": "glow:5", "o": "glow:3"})
    s.anim("idle", 3.0, [
        {"part": "starhang", "osc": {"axis": "z", "amp": 9, "cycles": 1}},
        {"part": "starhang", "osc": {"axis": "x", "amp": 5, "cycles": 1, "phase": 0.25}},
    ])
    return s


@item
def cushion():
    """Floor cushion: a fat dusty-rose linen cushion with sage piping, a cloth-covered centre button, quilted stitch
    lines and honey corner tassels. ~11 x 11 px, 4 px tall; sit/sleep at y 4."""
    s = Spec("cushion", "Floor Cushion", density=7, tris=1400, hero=(30, 28))
    c = s.style("c", cloth("rose", 4.2, weave=0.45, photo="rough_linen", scale=6))
    pillow(s, "body", (0, 2.05, 0), 11.6, 4.1, 11.4, c, sides=12, round_=2.2, paint={"layers": [
        {"id": "pipe", "op": "band", "axis": "y", "from": -0.07, "to": 0.07, "ramp": "sage", "tone": 4.4},
        {"id": "pipe_s", "op": "band", "axis": "y", "from": -0.13, "to": -0.07, "shift": -1.0},
        {"id": "quilt_a", "op": "stripes", "axis": [1, 0, 1], "period": 2.4, "width": 0.07, "shift": -0.9, "faces": ["up"]},
        {"id": "quilt_b", "op": "stripes", "axis": [1, 0, -1], "period": 2.4, "width": 0.07, "shift": -0.9, "faces": ["up"]},
        {"id": "dimple", "op": "spots", "centers": [[0, 2.0, 0, 1.0]], "shift": -0.8}]})
    btn = s.style("btn", cloth("sage", 4.0, weave=0.2, photo="rough_linen", scale=4))
    s.lathe("button", [(0, 1.1), (0.3, 1.2), (0.45, 0.7)], btn, base=(0, 3.85, 0), sides=8, caps=(False, True))
    tas = s.style("tas", {"ramp": "honey", "tone": 4.4, "light": 0.8, "rim": {"outline": "none"}, "layers": []})

    def tassel(x, y):
        if y < 0.25:
            return "k" if abs(x - 0.5) < 0.18 else "."
        half = 0.18 + 0.25 * min(1, (y - 0.25) * 3)
        if abs(x - 0.5) > half:
            return "."
        return "d" if int(x * 9) % 2 else "l"
    art = grid_art(9, 14, tassel)
    for k, (x, z) in enumerate([(-5.7, 5.0), (5.7, 5.0), (-5.7, -5.0), (5.7, -5.0)]):
        s.bone(f"tas{k}", at=(x, 2.0, z))
        for j, rot in enumerate([(0, 0, 0), (0, 90, 0)]):
            s.card(f"tassel{k}_{j}", art, tas, parent=f"tas{k}", rel=(0, 0, 0), rot=rot, off=(0, -0.9, 0), size=[0.9, 1.8],
                   key={"k": "honey:2", "l": "honey:5", "d": "honey:3"})
    return s


def book_styles(s):
    names = {}
    for c, t in [("berry", 3.6), ("lake", 3.8), ("sage", 3.8), ("honey", 4.0), ("plum", 3.8), ("dusk", 3.8), ("rose", 4.0), ("fern", 3.6), ("clay", 3.8)]:
        st = cloth(c, t, weave=0.25, photo="brown_leather", scale=5, seed=len(names))
        st["layers"].append({"id": "scuff", "op": "wear", "width": 1, "density": 0.4, "shift": 0.9})
        names[c] = s.style(f"bk_{c}", st)
    names["pages"] = s.style("bk_pages", {"ramp": "paper", "tone": 4.2, "rim": {"outline": "none"},
                                          "layers": [{"id": "leaves", "op": "stripes", "axis": "y", "period": 0.28, "width": 0.4, "shift": -0.8}]})
    return names


def book(s, id, st, at, w, h, d, rot=(0, 0, 0), seed=0, lie=False):
    """A cloth-bound book standing (or lying, `lie`) at `at` (bottom centre): spine bands and a title label on the
    spine (+Z), page block on the top edge."""
    rng = np.random.default_rng(seed)
    b0, b1 = rng.uniform(0.55, 0.7), rng.uniform(-0.75, -0.6)
    lay = [{"id": "band_t", "op": "band", "axis": "y", "from": b0, "to": b0 + 0.08, "ramp": "brass", "tone": 4.4, "faces": ["front"]},
           {"id": "band_b", "op": "band", "axis": "y", "from": b1, "to": b1 + 0.07, "ramp": "brass", "tone": 4.0, "faces": ["front"]}]
    if rng.random() < 0.6:
        lay.append({"id": "label", "op": "rect", "rect": [0.2, 0.3, 0.8, 0.5], "ramp": "paper", "tone": 4.6, "faces": ["front"],
                    "bevel": True})
    x, y, z = at
    if lie:
        return s.box(id, [h, w, d], st, (x, y + w / 2, z), rot=rot, paint={"layers": lay})
    return s.box(id, [w, h, d], st, (x, y + h / 2, z), rot=rot, paint={"layers": lay})


@item
def bookshelf():
    """The storybook shelf: an oak bookcase with a carved moon-and-stars apron under the cornice, three shelves of
    cloth-bound books (leaning, stacked), a jar of fireflies, a rolled map and a tiny potted succulent.
    1 x 0.5 blocks, 26 px tall (flat top at 26 for small items)."""
    s = Spec("bookshelf", "Storybook Shelf", density=5, tris=3000, hero=(28, 14))
    side = s.style("side", wood("oak", 4.2, grain="y", knots=2, seed=1))
    shelf = s.style("shelf", wood("oakl", 4.4, grain="x", knots=1, seed=2))
    bk = wood("walnut", 3.6, grain="y", knots=1, seed=3)
    bk["layers"].append({"id": "planks", "op": "stripes", "axis": "x", "period": 3.2, "width": 0.06, "shift": -1.4, "faces": ["front"]})
    back = s.style("back", bk)
    kick = s.style("kick", wood("walnut", 3.8, grain="x", knots=0, seed=4))
    for sx in (-1, 1):
        s.box(f"side{'l' if sx < 0 else 'r'}", [1.4, 25.0, 7.2], side, (sx * 7.6, 12.5, 0), chamfer=0.2)
    s.box("back", [14.0, 24.0, 0.6], back, (0, 12.6, -3.3))
    s.box("kick", [14.2, 1.3, 6.6], kick, (0, 0.65, 0.1))
    s.box("top", [17.0, 0.7, 7.8], shelf, (0, 25.65, 0.2), chamfer=0.2)
    s.box("cornice", [16.4, 0.6, 7.4], shelf, (0, 25.0, 0.2), chamfer=0.25)
    for k, y in enumerate([1.3, 9.0, 16.9]):
        s.box(f"shelf{k}", [14.0, 0.7, 6.8], shelf, (0, y + 0.35, 0.1))
    # carved apron with a crescent moon and stars cut through
    apron = s.style("apron", {**wood("oak", 4.4, grain="x", knots=0, seed=6)})

    def apron_art(x, y):
        # scalloped lower edge
        edge = 0.62 + 0.22 * abs(math.cos(x * math.pi * 5))
        if y > edge:
            return "."
        dx, dy = (x - 0.5) * 4.0, y - 0.32
        if math.hypot(dx, dy) < 0.2 and math.hypot(dx - 0.09, dy + 0.05) > 0.16:
            return "."
        for sxp in (0.3, 0.7):
            if abs(x - sxp) < 0.012 and abs(y - 0.3) < 0.07 or abs(y - 0.3) < 0.025 and abs(x - sxp) < 0.035:
                return "."
        return "h" if y < 0.08 else ("d" if y > edge - 0.07 else "w")
    s.card("apron", grid_art(84, 12, apron_art), apron, at=(0, 23.85, 3.45), size=[14.0, 2.0],
           key={"w": "oak:5", "h": "oak:7", "d": "oak:2"})
    bs = book_styles(s)
    cols = ["berry", "lake", "sage", "honey", "plum", "dusk", "rose", "fern", "clay"]
    rng = np.random.default_rng(7)
    bays = [2.0, 9.7, 17.6]
    n = 0
    for bi, y0 in enumerate(bays):
        x = -6.6
        right = 6.6 - (3.2 if bi == 0 else 2.8 if bi == 1 else 3.6)
        while x < right:
            w = float(rng.uniform(0.8, 1.35))
            h = float(rng.uniform(4.4, 6.4 if bi < 2 else 5.2))
            d = float(rng.uniform(4.4, 5.4))
            c = cols[int(rng.integers(len(cols)))]
            lean = 0.0
            if x + w > right - 1.2 and rng.random() < 0.7:
                lean = -13.0
            if lean:
                book(s, f"book{n}", bs[c], (x + w / 2 + h * 0.11, y0, -0.2), w, h, d, rot=(0, 0, lean), seed=n)
                x = right + 1
            else:
                book(s, f"book{n}", bs[c], (x + w / 2, y0, -0.2), w, h, d, seed=n)
                x += w + 0.06
            n += 1
        # the rest of the bay: a horizontal stack or an object
        rx = 6.6 - (3.2 if bi == 0 else 2.8 if bi == 1 else 3.6) / 2 + 0.3
        if bi == 0:
            for k in range(3):
                c = cols[(k * 3 + 1) % len(cols)]
                book(s, f"stack{k}", bs[c], (rx, y0 + k * 0.95, -0.1), 0.95, 3.6 - k * 0.3, 4.6 - k * 0.2, rot=(0, (k - 1) * 9, 90), seed=40 + k, lie=False)
        elif bi == 1:
            jar = glow("glow", 1.6)
            jar["layers"] = [{"id": "glass", "op": "gradient", "axis": "y", "amount": 0.6},
                             {"id": "halo", "op": "spots", "count": 7, "radius": [0.5, 0.6], "ramp": "glow", "tone": 3.6, "seed": 5},
                             {"id": "flies", "op": "spots", "count": 7, "radius": [0.22, 0.32], "ramp": "glow", "tone": 6, "seed": 5}]
            s.lathe("glow_jar", [(0, 2.0), (0.3, 2.3), (3.0, 2.3), (3.4, 1.8), (3.6, 1.6)], s.style("jar", jar), base=(rx, y0, 0.4), sides=10, caps=(False, True))
            s.cyl("jarlid", 1.9, 0.6, s.style("cork", wood("pale", 4.0, grain="y", knots=0, wear=0)), (rx, y0 + 3.55, 0.4), sides=10)
        else:
            scroll = s.style("scroll", cloth("oat", 4.6, weave=0.2, photo="rough_linen", scale=5))
            s.add("map", "prism", [1.6, 1.6, 5.0], scroll, centre=(rx - 0.4, y0 + 0.8, 0.2), rot=(0, 70, 0), sides=8)
            s.add("map2", "prism", [1.2, 1.2, 4.4], scroll, centre=(rx + 0.4, y0 + 2.1, -0.1), rot=(0, 100, 0), sides=8)
    # a tiny succulent on the bottom shelf front corner
    pot = s.style("pot", clay("terra", 4.2))
    s.lathe("succpot", [(0, 1.5), (1.3, 2.0), (1.5, 2.2)], pot, base=(4.6, 2.0, 2.3), sides=8, caps=(False, True))
    leafs = s.style("leafs", leafy("sage", 4.2, veins=False))
    for k in range(5):
        a = k * 72
        s.loft(f"succ{k}", [((0, 0, 0), [0.7, 0.4]), ((0, 0.6, 0.5), [0.9, 0.5]), ((0, 1.1, 0.8), [0.2, 0.2])], leafs,
               at=(4.6, 3.4, 2.3), rot=(0, a, 0), sides=6, round_=2.0)
    return s


@item
def candles():
    """Candle cluster: three cream pillar candles of different heights with wax drips, on a tarnished brass tray
    with a finger loop. Flames are glowing crossed cards that flicker (clip 'idle'). Small item."""
    s = Spec("candles", "Candle Cluster", density=9, tris=1600, hero=(30, 20),
             light={"dir": [-0.5, 1.0, 0.7], "strength": 0.45, "gradient": 0.3, "ao": 0.2, "ao_height": 2.0})
    br = s.style("br", brass(tone=2.8))
    s.lathe("tray", [(0, [7.2, 5.6]), (0.35, [8.6, 7.0]), (0.8, [9.0, 7.4]), (0.9, [8.2, 6.6])], br, sides=14, caps=(False, True))
    torus(s, "loop", (5.0, 0.6, 0), 0.9, [0.4, 0.45], br, n=10, sides=4, rz=0.75)
    w = wax("cream", 5.0)
    w["layers"].append({"id": "drips", "op": "drip", "ramp": "cream", "tone": 6.6, "depth": 0.35, "length": 1.3, "width": 0.45, "scale": 0.8})
    s.style("wax", w)
    wick = s.style("wick", flat("ink", 1.5, light=0.3, outline="none"))
    fl = s.style("fl", glow("flame", 4.2))
    tracks = []
    for k, (x, z, d, h) in enumerate([(-1.9, 0.4, 2.3, 6.2), (1.2, -0.9, 2.5, 8.2), (2.0, 1.6, 1.9, 4.2)]):
        s.lathe(f"candle{k}", [(0, d), (h - 0.35, d), (h, d * 0.82)], "wax", base=(x, 0.9, z), sides=10, caps=(False, True))
        top = 0.9 + h
        s.cyl(f"wick{k}", 0.22, 0.55, wick, (x, top - 0.1, z), sides=4)
        tracks += flame(s, k, (x, top + 0.3, z), fl, h=2.6, w=1.4, phase=k * 0.31)
    s.anim("idle", 2.0, tracks)
    return s


@item
def fernpot():
    """Potted fern: a sage-glazed stoneware pot with a cream rim band and painted leaf sprigs, dark soil with moss,
    and nine arching two-part fronds that sway gently (clip 'idle'). Small item, ~13 px tall."""
    s = Spec("fernpot", "Potted Fern", density=8, tris=1800, hero=(30, 22))
    pot = glaze("sage", 4.0)
    pot["layers"] += [
        {"id": "rimband", "op": "band", "axis": "y", "from": 0.62, "to": 0.88, "ramp": "cream", "tone": 4.8},
        {"id": "rimline", "op": "band", "axis": "y", "from": 0.56, "to": 0.62, "ramp": "fern", "tone": 2.6},
        {"id": "sprigs", "op": "spots", "count": 10, "radius": [0.22, 0.34], "stretch": [1, 2.2, 1], "ramp": "fern", "tone": 2.8,
         "where": {"y": [-0.5, 0.25]}, "seed": 3, "min_gap": 1.0},
    ]
    pot = s.style("pot", pot)
    s.lathe("pot", [(0, 4.2), (0.25, 4.8), (3.0, 5.8), (3.9, 6.3), (4.0, 6.9), (5.0, 7.0), (5.1, 6.4)], pot, sides=12, caps=(False, True))
    s.lathe("soil", [(0, 6.0), (0.2, 5.4)], s.style("soil", soil()), base=(0, 4.95, 0), sides=12, caps=(False, True),
            paint={"layers": [{"id": "moss", "op": "patches", "scale": 1.0, "threshold": 0.55, "ramp": "moss", "tone": 4.0}]})
    fr = s.style("fr", {"ramp": "fern", "tone": 4, "light": 0.9, "rim": {"outline": "none"}, "layers": []})
    key = {"s": "fern:2", "l": "fern:5", "d": "fern:3", "h": "moss:5"}
    tracks = []
    for k in range(9):
        a = k * 40 + (k % 2) * 12
        L = 4.6 + (k % 3) * 0.8
        art = frond_art(22, 40, lean=0.0, seed=k, leaflets=8)
        half = len(art) // 2
        tip, base = art[:half], art[half:]
        s.bone(f"fb{k}", at=(0, 5.2, 0), rot=(0, a, 0))
        s.card(f"frond{k}", base, fr, parent=f"fb{k}", rel=(0, 0, 0), rot=(48 + (k % 3) * 8, 0, 0), plane="xz",
               off=(0, 0, -L / 2), size=[3.6, L], key=key)
        s.card(f"frondtip{k}", tip, fr, parent=f"frond{k}", rel=(0, 0, -L), rot=(-40, 0, 0), plane="xz",
               off=(0, 0, -L / 2), size=[3.6, L], key=key)
        tracks.append({"part": f"frond{k}", "osc": {"axis": "x", "amp": 3, "cycles": 1, "phase": k * 0.13}})
        tracks.append({"part": f"frondtip{k}", "osc": {"axis": "x", "amp": 5, "cycles": 1, "phase": k * 0.13 + 0.15}})
    s.anim("idle", 4.0, tracks)
    return s
