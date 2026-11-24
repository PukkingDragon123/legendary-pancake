"""Indoor pieces of src/assets/furniture.ts: stool, chair, hammock, teatable, desk, paperlantern, mushroomlamp, books,
blocks, ball, easel, chest, trophy, globe, telescope, rug, cactus, bonsai, potflowers, planter, gnome (cushion lives in
items_start). Units px, origin bottom-centre, facing +Z."""
import math

import numpy as np

from kit import (Spec, wood, painted_wood, cloth, velvet, brass, iron, glaze, clay, stone, wax, leafy, glow, soil, flat, UP,
                 pillow, lace_art, torus, arc_points, grid_art, flame_art, frond_art, image_art)
from items_start import flame, star_art, book_styles, book, twig_art, twig_style

ITEMS = {}


def item(fn):
    ITEMS[fn.__name__] = fn
    return fn


def card_style(s, name, rmp, tone=4, light=0.8):
    return s.style(name, {"ramp": rmp, "tone": tone, "light": light, "rim": {"outline": "none"}, "layers": []})


def cross_card(s, id, art, style, at, size, key, parent=None, yaw=0, off_y=None):
    """Two crossed cards standing on `at` (grass tufts, flames, leaves seen from any side)."""
    for j, r in enumerate((0, 90)):
        s.card(f"{id}_{j}", art, style, at=at, rot=(0, yaw + r, 0), off=(0, size[1] / 2 if off_y is None else off_y, 0), size=size,
               key=key, parent=parent)


def grass_art(n=14, blades=(0.2, 0.42, 0.6, 0.8)):
    def f(x, y):
        for c in blades:
            lean_ = (c - 0.5) * 0.5
            if abs(x - c - lean_ * (1 - y)) < 0.05 + 0.05 * y and y > 0.15 + abs(c - 0.5) * 0.6:
                return "g" if c < 0.5 else "l"
        return "."
    return grid_art(n, n, f)


def grass_img(k):
    """A tuft of 2D pixel-art grass blades: BUSHED's vegetation atlas (one of three clumps, mirrored on odd k)."""
    return image_art("grass.png", 18, 18, colours=16, crop=((k % 3) / 3, 0, (k % 3 + 1) / 3, 1), flip=k % 2 == 1, seed=k)


def tulip(s, id, base, h, rmp, lean=0.0, yaw=0.0):
    """A tulip: a thin stem, two strap leaves (cards) and a cup-shaped flower head (a lathe with petal tips)."""
    x, y, z = base
    st = s.style(f"{id}_stem", leafy("fern", 4.0, veins=False))
    s.cyl(f"{id}_stem", 0.35, h, st, (x, y, z), sides=4)
    head = velvet(rmp, 3.8, seed=len(id))
    head["layers"] += [{"id": "petal", "op": "stripes", "axis": "around", "period": 0.333, "width": 0.1, "shift": -1.2},
                       {"id": "flush", "op": "gradient", "axis": "y", "amount": 1.4}]
    hs = s.style(f"{id}_head", head)
    s.lathe(f"{id}_head", [(0, 0.4), (0.4, 1.3), (1.2, 2.0), (2.0, 1.9), (2.5, 1.2), (2.8, 1.6)], hs, base=(x, y + h - 0.2, z), sides=6, caps=(True, False),
            double_sided=True)
    lf = card_style(s, f"{id}_lf", "fern", 4)

    # strap leaves: 2D pixel-art blades from BUSHED's vegetation atlas, two crossed cards
    k = sum(map(ord, id))
    for j, (ry, rz) in enumerate(((0, 16), (100, -14))):
        art, key = image_art("grass.png", 12, 28, colours=14, crop=((k + j) % 3 / 3, 0, ((k + j) % 3 + 1) / 3, 1), flip=bool(j), seed=k + j)
        s.card(f"{id}_leaf{j}", art, lf, at=(x, y, z), rot=(0, yaw + ry, rz), off=(0, h * 0.32, 0), size=[1.6, h * 0.64], key=key)


def daisy(s, id, base, h, petal="paper", eye="honey", yaw=0.0):
    x, y, z = base
    st = s.style(f"{id}_stem", leafy("fern", 4.0, veins=False))
    s.cyl(f"{id}_stem", 0.3, h, st, (x, y, z), sides=4)
    fl = card_style(s, f"{id}_fl", petal, 5, light=0.9)

    def flower(u, v):
        dx, dy = u - 0.5, v - 0.5
        r = math.hypot(dx, dy)
        a = math.atan2(dy, dx)
        if r < 0.17:
            return "e" if r < 0.12 else "o"
        R = 0.3 + 0.2 * abs(math.cos(a * 4.5))
        return ("p" if (a * 9 / math.pi) % 2 < 1.3 else "q") if r < R else "."
    s.card(f"{id}_fl", grid_art(16, 16, flower), fl, at=(x, y + h, z), plane="xz", rot=(-25, yaw, 0), size=[2.4, 2.4],
           key={"p": f"{petal}:6", "q": f"{petal}:4", "e": f"{eye}:5", "o": f"{eye}:3"})


# ------------------------------------------------------------------------------------------------ seating and tables
@item
def stool():
    """Log stool: an oak stump with deep bark, growth rings and a split on its sawn top, moss creeping up one side and
    a family of tiny toadstools at its foot. 8 x 8 px, sits at 6 px."""
    s = Spec("stool", "Log Stool", density=8, tris=1600, hero=(30, 24))
    bk = wood("bark", 3.8, grain="y", knots=0, wear=0, seed=3)
    bk["layers"] = [l for l in bk["layers"] if l["id"] not in ("knots",)] + [
        {"id": "furrows", "op": "stripes", "axis": "around", "period": 0.09, "width": 0.3, "shift": -1.3, "wobble": 0.05},
        {"id": "barkphoto", "op": "photo", "src": "art/lowpix/items/_furnA/photos/bark_brown_02", "scale": 5, "amount": 0.9, "ramps": ["bark"]},
        {"id": "moss", "op": "patches", "scale": 1.2, "threshold": 0.62, "ramp": "moss", "tone": 4.0, "faces": ["sides"]}]
    top = {"ramp": "oakl", "tone": 4.6, "rim": {"light": 1, "dark": 1, "light_shift": 0.8, "dark_shift": -0.8, "outline": "dark"},
           "layers": [{"id": "rings", "op": "spots", "centers": [[0.2, 0.02, 0.1, r] for r in (3.4, 2.7, 2.0, 1.4, 0.8)], "shift": -0.7, "ring": 0.9},
                      {"id": "heart", "op": "spots", "centers": [[0.2, 0.02, 0.1, 0.35]], "shift": -1.2},
                      {"id": "split", "op": "band", "axis": [1, 0, 0.4], "from": 0.1, "to": 0.14, "shift": -2.0, "faces": ["up"]}],
           "brush": {"flow": "x", "length": 0.8, "width": 0.4, "rough": 0.4, "textures": {"oakl": "wood"}}}
    bk["layers"] += [
        {"id": "sawn", "op": "fill", "ramp": "oakl", "tone": 4.4, "faces": ["end"]},
        {"id": "rings", "op": "spots", "centers": [[0.3, 6.0, 0.2, r] for r in (3.3, 2.6, 1.9, 1.3, 0.7)], "shift": -0.8, "ring": 0.88, "faces": ["end"]},
        {"id": "heart", "op": "spots", "centers": [[0.3, 6.0, 0.2, 0.3]], "shift": -1.4, "faces": ["end"]},
        {"id": "split", "op": "band", "axis": [1, 0, 0.4], "from": 0.12, "to": 0.16, "shift": -2.2, "faces": ["end"]},
        {"id": "barkring", "op": "spots", "centers": [[0, 6.0, 0, 3.9]], "ring": 0.93, "ramp": "bark", "tone": 2.4, "faces": ["end"]}]
    s.lathe("log", [(0, 9.0), (0.4, 8.8), (1.4, 8.0), (5.6, 7.8), (6.0, 7.6)], s.style("bark", bk), sides=11, caps=(False, True))
    for k, (x, z, h, cw) in enumerate([(3.8, 3.0, 1.8, 2.4), (4.6, 1.6, 1.1, 1.5), (2.6, 4.0, 0.8, 1.1)]):
        s.lathe(f"tstem{k}", [(0, cw * 0.32), (h, cw * 0.26)], s.style("tstem", wax("cream", 5)), base=(x, 0, z), sides=6)
        cap = glaze("berry", 4.2, speck=False, seed=k)
        cap["layers"].append({"id": "dots", "op": "spots", "count": 3, "radius": [0.15, 0.22], "ramp": "cream", "tone": 5.6, "seed": k, "faces": ["up"]})
        s.lathe(f"tcap{k}", [(0, cw), (cw * 0.25, cw * 0.82), (cw * 0.45, cw * 0.3), (cw * 0.5, 0.0)], s.style(f"tcap{k}", cap), base=(x, h - 0.15, z),
                sides=8, caps=(True, False))
    return s


@item
def chair():
    """Heart chair: a hand-carved pale-oak chair with turned legs and stretchers, a woven rush seat and a back panel
    with a heart cut through it. Seat at 7 px, back to ~16 px."""
    s = Spec("chair", "Heart Chair", density=7, tris=1800, hero=(30, 18))
    leg = s.style("leg", wood("oakl", 4.2, grain="y", knots=0, wear=0.4, seed=1))
    frame = s.style("frame", wood("oak", 4.0, grain="x", knots=0, seed=2))
    rush = cloth("straw" if False else "oat", 4.0, weave=0.9, photo="hessian_230", scale=3)
    rush["layers"] += [{"id": "twist_a", "op": "stripes", "axis": [1, 0, 1], "period": 0.7, "width": 0.45, "shift": 0.8, "faces": ["up"]},
                       {"id": "twist_b", "op": "stripes", "axis": [1, 0, -1], "period": 0.7, "width": 0.12, "shift": -1.2, "faces": ["up"]}]
    for k, (x, z) in enumerate([(-3.2, 3.2), (3.2, 3.2), (-3.2, -3.2), (3.2, -3.2)]):
        h = 6.2 if z > 0 else 15.6
        rings = [(0, 1.0), (0.3, 1.3), (2.6, 1.0), (3.4, 1.4), (4.2, 1.0), (h, 1.0)]
        if z < 0:
            rings += [(h + 0.4, 1.3), (h + 0.9, 0.6)]
        s.lathe(f"leg{k}", rings, leg, base=(x, 0, z), sides=8, caps=(False, True))
    for k, (cx, cz, w, d) in enumerate([(0, 3.2, 6.0, 0.6), (0, -3.2, 6.0, 0.6), (-3.2, 0, 0.6, 6.0), (3.2, 0, 0.6, 6.0)]):
        s.box(f"stretch{k}", [w, 0.6, d], frame, (cx, 2.0, cz))
    s.box("apron", [7.6, 1.2, 7.6], frame, (0, 6.0, 0), chamfer=0.2)
    s.box("seat", [7.2, 0.7, 7.2], s.style("rush", rush), (0, 6.95, 0.1), chamfer=0.35)
    s.box("toprail", [7.2, 1.4, 0.9], frame, (0, 15.0, -3.2), chamfer=0.3)
    panel = card_style(s, "panel", "oakl", 4.4)

    def heart(x, y):
        X, Y = (x - 0.5) * 2.4, (0.52 - y) * 2.4
        inside = (X * X + Y * Y - 0.5) ** 3 - X * X * Y ** 3 * 1.0 < 0 if True else False
        hx, hy = X / 0.9, (Y + 0.05) / 0.9
        heart_ = (hx * hx + hy * hy - 0.42) ** 3 - hx * hx * hy ** 3 < 0
        if heart_:
            return "."
        if x < 0.06 or x > 0.94:
            return "d"
        hx2, hy2 = X / 1.05, (Y + 0.05) / 1.05
        if (hx2 * hx2 + hy2 * hy2 - 0.42) ** 3 - hx2 * hx2 * hy2 ** 3 < 0:
            return "h" if X < 0 else "d"
        return "w"
    for k, dz in enumerate((-3.0, -3.45)):
        s.card(f"back{k}", grid_art(40, 36, heart), panel, at=(0, 11.1, dz), size=[5.8, 5.2],
               key={"w": "oakl:4", "h": "oakl:7", "d": "oakl:2"})
    s.box("lowrail", [6.0, 0.7, 0.7], frame, (0, 8.2, -3.2))
    return s


@item
def hammock():
    """Hammock: a striped lake-and-oat canvas hammock with spreader bars and a linen pillow, slung on ropes between two
    birch posts set in mossy stones. Rocks gently (clip 'idle'). ~38 px wide, sleep at y 8."""
    s = Spec("hammock", "Hammock", density=5, tris=3000, hero=(30, 18))
    birch = {"ramp": "pebble", "tone": 5.2, "rim": {"light": 1, "dark": 1, "light_shift": 0.6, "dark_shift": -0.8, "outline": "dark"},
             "layers": [{"id": "lent", "op": "stripes", "axis": "y", "period": 1.6, "width": 0.12, "shift": -2.6, "wobble": 0.4},
                        {"id": "patches", "op": "patches", "scale": 1.0, "threshold": 0.7, "ramp": "bark", "tone": 2.0}],
             "brush": {"flow": "vertical", "length": 1.0, "width": 0.4, "rough": 0.4, "textures": {"pebble": "wood"}}}
    post = s.style("post", birch)
    rock = s.style("rock", stone("stone", 4.0, moss=True, seed=2))
    for sx in (-1, 1):
        s.cyl(f"post{sx}", 2.6, 19.5, post, (sx * 17.2, 0, 0), sides=8, top=0.85, rot=None) if False else \
            s.add(f"post{sx}", "prism", [2.6, 2.6, 19.5], post, at=(sx * 17.2, 0, 0), off=(0, 0, 9.75), rot=(-90, 0, sx * 0) , sides=8, front_scale=[0.85, 0.85])
        s.lathe(f"rock{sx}", [(0, 6.0), (0.8, 6.4), (1.6, 5.0), (2.2, 2.4)], rock, base=(sx * 17.2, 0, 0), sides=8, caps=(False, True))
    s.bone("sling", at=(0, 14.0, 0))
    canvas = cloth("oat", 4.6, weave=0.5, photo="rough_linen", scale=6)
    canvas["layers"] += [{"id": "stripes", "op": "stripes", "axis": "z", "period": 2.4, "width": 0.5, "ramp": "lake", "tone": 4.0},
                         {"id": "pin", "op": "stripes", "axis": "z", "period": 2.4, "width": 0.08, "phase": 1.3, "ramp": "honey", "tone": 4.6}]
    cv = s.style("canvas", canvas)
    rings = []
    for k in range(9):
        x = -11 + k * 2.75
        y = -7.0 + 6.6 * (x / 11) ** 2
        rings.append({"at": [x, y, 0], "size": [9.4 if abs(x) < 10 else 8.0, 1.6 + 1.4 * (1 - (x / 11) ** 2)]})
    s.add("bed", "loft", None, cv, parent="sling", rel=(0, 0, 0), rings=rings, profile={"sides": 8, "round": 1.6}, caps=[True, True], subdiv=1)
    bar = s.style("bar", wood("oakl", 4.2, grain="z", knots=0, seed=6))
    rope = card_style(s, "rope", "oat", 3.6, light=0.5)
    for sx in (-1, 1):
        s.add(f"spread{sx}", "prism", [0.9, 0.9, 10.4], bar, parent="sling", rel=(sx * 11.2, -0.3, 0), sides=6)
        L = 6.4
        ang = math.degrees(math.atan2(4.6, 6.0))
        for j, dz in enumerate((-4.2, 0, 4.2)):
            s.card(f"rope{sx}_{j}", ["r"] * 6, rope, parent="sling", rel=(sx * 11.2, -0.3, dz), rot=(0, 0, -sx * (90 - ang) + (0 if j == 1 else 0)),
                   off=(0, L / 2 * 1.0, 0), size=[0.25, L], key={"r": "oat:3"})
    pil = s.style("pil", cloth("linen", 5.0, weave=0.3, photo="rough_linen", scale=5))
    pillow(s, "pillow", (-7.6, -4.4, 0), 3.0, 1.8, 6.4, pil, axis="x", rot=(0, 0, -24), parent=None) if False else None
    s.add("pillow", "loft", None, pil, parent="sling", rel=(-7.8, -4.2, 0), rot=(0, 90, 18),
          rings=[{"at": [-3.2, 0, 0], "size": [2.4, 0.5]}, {"at": [-2.4, 0, 0], "size": [3.0, 1.8]}, {"at": [0, 0, 0], "size": [3.2, 2.0]},
                 {"at": [2.4, 0, 0], "size": [3.0, 1.8]}, {"at": [3.2, 0, 0], "size": [2.4, 0.5]}],
          profile={"sides": 8, "round": 1.9}, caps=[True, True])
    s.anim("idle", 4.0, [{"part": "sling", "osc": {"axis": "x", "amp": 5, "cycles": 1}}])
    return s


@item
def teatable():
    """Tea table: a low square oak table with a sage embroidered runner, a lake-blue sprigged china teapot, two cups of
    tea (one is for you), a plate of oat cookies and a bud vase with a daisy. 1 x 1 block, top at 8 px."""
    s = Spec("teatable", "Tea Table", density=6, tris=3000, hero=(30, 26))
    top = s.style("top", wood("oakl", 4.4, grain="x", knots=2, seed=1))
    leg = s.style("leg", wood("oak", 4.0, grain="y", knots=0, seed=2))
    s.box("top", [13.6, 1.2, 13.6], top, (0, 7.4, 0), chamfer=0.35)
    s.box("apron", [12.0, 1.4, 12.0], leg, (0, 6.1, 0))
    for k, (x, z) in enumerate([(-5.6, 5.6), (5.6, 5.6), (-5.6, -5.6), (5.6, -5.6)]):
        s.cyl(f"leg{k}", 1.4, 6.0, leg, (x, 0, z), sides=6, bottom=0.75)
    run = cloth("sage", 4.2, weave=0.4, photo="rough_linen", scale=5)
    run["layers"] += [{"id": "hem", "op": "band", "axis": "x", "from": 0.78, "to": 0.86, "ramp": "cream", "tone": 5, "faces": ["up"]},
                      {"id": "hem2", "op": "band", "axis": "x", "from": -0.86, "to": -0.78, "ramp": "cream", "tone": 5, "faces": ["up"]},
                      {"id": "flowers", "op": "spots", "count": 8, "radius": [0.25, 0.35], "ramp": "rose", "tone": 4.6, "seed": 4, "faces": ["up"]}]
    s.box("runner", [4.4, 0.15, 14.4], s.style("run", run), (0, 8.07, 0))
    y0 = 8.15
    china = glaze("paper", 4.6, seed=1)
    china["layers"] += [{"id": "sprig", "op": "spots", "count": 14, "radius": [0.2, 0.32], "ramp": "lake", "tone": 3.6, "seed": 6},
                        {"id": "lip", "op": "band", "axis": "y", "from": 0.78, "to": 0.92, "ramp": "lake", "tone": 3.6}]
    ch = s.style("china", china)
    s.lathe("pot", [(0, 2.4), (0.3, 3.6), (1.5, 4.4), (2.7, 3.8), (3.2, 2.4), (3.4, 2.2)], ch, base=(-0.2, y0, -2.4), sides=12)
    s.lathe("lid", [(0, 2.3), (0.4, 1.8), (0.8, 0.7), (1.2, 0.6), (1.35, 0.2)], ch, base=(-0.2, y0 + 3.35, -2.4), sides=10)
    s.loft("spout", [((0, 0, 0), [1.2, 1.2]), ((1.3, 0.8, 0), [0.8, 0.8]), ((2.0, 2.0, 0), [0.6, 0.6])], ch, at=(1.6, y0 + 1.0, -2.4), sides=6)
    torus(s, "handle", (-2.3, y0 + 1.8, -2.4), 1.1, [0.45, 0.5], ch, n=10, sides=5, rot=(90, 0, 0))
    for k, (x, z, r) in enumerate([(3.4, 3.6, "lake"), (-3.6, 3.2, "rose")]):
        c = s.style(f"cup{k}", glaze(r, 4.4, seed=k + 3))
        s.lathe(f"saucer{k}", [(0, 1.8), (0.2, 3.2), (0.35, 3.4)], c, base=(x, y0, z), sides=10)
        s.lathe(f"cup{k}", [(0, 1.2), (0.3, 1.7), (1.3, 2.2), (1.55, 2.3)], c, base=(x, y0 + 0.3, z), sides=10, caps=(False, True),
                paint={"layers": [{"id": "tea", "op": "spots", "centers": [[0, 1.6, 0, 0.95]], "ramp": "honey", "tone": 3.2, "faces": ["up"]}]})
        torus(s, f"cuph{k}", (x + 1.35, y0 + 1.15, z), 0.5, [0.28, 0.32], c, n=8, sides=4, rot=(90, 0, 0))
    plate = s.style("plate", glaze("cream", 4.8, seed=8))
    s.lathe("plate", [(0, 2.4), (0.2, 4.0), (0.35, 4.3)], plate, base=(4.0, y0, -3.6), sides=12)
    cookie = clay("ochre", 4.6, seed=3)
    cookie["layers"].append({"id": "chips", "op": "spots", "count": 5, "radius": [0.15, 0.25], "ramp": "walnut", "tone": 2, "seed": 2})
    ck = s.style("cookie", cookie)
    for k, (dx, dz, dy, tilt) in enumerate([(-0.7, 0.3, 0, 0), (0.8, -0.2, 0, 8), (0.1, 0.1, 0.45, -10)]):
        s.lathe(f"cookie{k}", [(0, 1.6), (0.35, 1.5)], ck, base=(4.0 + dx, y0 + 0.35 + dy, -3.6 + dz), sides=8, rot=(tilt, 0, 0))
    vase = s.style("vase", glaze("dusk", 4.0, seed=9))
    s.lathe("vase", [(0, 1.0), (0.8, 1.6), (1.8, 1.0), (2.6, 0.6), (2.8, 0.9)], vase, base=(-4.0, y0, -4.2), sides=8)
    daisy(s, "daisy", (-4.0, y0 + 2.6, -4.2), 2.6)
    return s


@item
def desk():
    """Study desk: an oak writing desk with a three-drawer pedestal (brass pulls), a leather blotter, an open notebook,
    a stack of books, an ink pot with a quill, a mug of pencils and a little brass desk lamp with a glowing shade.
    1.5 x 0.5 blocks, desktop at 11 px."""
    s = Spec("desk", "Study Desk", density=5, tris=3200, hero=(30, 16))
    top = s.style("top", wood("oakl", 4.4, grain="x", knots=2, seed=1))
    body = s.style("body", wood("oak", 4.0, grain="y", knots=1, seed=2))
    front = s.style("front", wood("oak", 4.4, grain="x", knots=0, seed=3))
    br = s.style("br", brass())
    s.box("top", [20.4, 1.2, 9.6], top, (0, 10.4, 0), chamfer=0.35)
    s.box("ped", [7.0, 9.8, 8.6], body, (6.2, 4.9, -0.2), chamfer=0.2)
    for k in range(3):
        y = 1.6 + k * 2.95
        s.box(f"drawer{k}", [6.2, 2.6, 0.4], front, (6.2, y + 1.3, 4.15), chamfer=0.15,
              paint={"layers": [{"id": "panel", "op": "panel", "inset": 2, "shift": -0.6, "highlight": 1, "shadow": 1}]})
        s.box(f"pull{k}", [1.8, 0.45, 0.4], br, (6.2, y + 1.5, 4.5), chamfer=0.1)
    for k, (x, z) in enumerate([(-9.0, 3.8), (-9.0, -3.8)]):
        s.lathe(f"leg{k}", [(0, 1.0), (0.3, 1.3), (1.0, 1.0), (8.0, 1.3), (9.0, 1.4), (9.8, 1.4)], body, base=(x, 0, z), sides=8)
    s.box("stretch", [1.0, 0.8, 7.0], body, (-9.0, 1.6, 0))
    s.box("modesty", [12.0, 3.4, 0.5], body, (-2.8, 8.0, -4.2))
    y0 = 11.0
    blot = s.style("blot", cloth("pine", 3.6, weave=0.2, photo="brown_leather", scale=5))
    s.box("blotter", [8.0, 0.2, 5.4], blot, (-1.8, y0 + 0.1, 1.4), paint={"layers": [{"id": "corner", "op": "band", "axis": "x", "from": 0.82, "to": 1.0, "ramp": "walnut", "tone": 3.6}]})
    paper = {"ramp": "paper", "tone": 4.8, "rim": {"outline": "none"}, "layers": [
        {"id": "lines", "op": "stripes", "axis": "z", "period": 0.55, "width": 0.12, "ramp": "lake", "tone": 4.4, "faces": ["up"]},
        {"id": "margin", "op": "band", "axis": "x", "from": -0.72, "to": -0.66, "ramp": "rose", "tone": 4, "faces": ["up"]}]}
    pp = s.style("paper", paper)
    s.box("pageL", [3.0, 0.3, 4.2], pp, (-3.3, y0 + 0.35, 1.6), rot=(0, 0, 6))
    s.box("pageR", [3.0, 0.3, 4.2], pp, (-0.3, y0 + 0.35, 1.6), rot=(0, 0, -6))
    s.box("spine", [0.5, 0.3, 4.3], s.style("nbk", cloth("berry", 3.6, photo="brown_leather")), (-1.8, y0 + 0.2, 1.6))
    bs = book_styles(s)
    for k, (c, h) in enumerate([("lake", 0.9), ("honey", 0.8), ("plum", 1.0)]):
        book(s, f"book{k}", bs[c], (-7.0, y0 + k * 0.92 - 0.02, -1.4), 0.9, 4.4 - k * 0.3, 3.4 - k * 0.2, rot=(0, (k - 1) * 12, 90), seed=k)
    ink = s.style("ink", glaze("night", 3.0, speck=False))
    s.lathe("inkpot", [(0, 1.6), (0.9, 1.7), (1.2, 1.0), (1.5, 0.9)], ink, base=(2.6, y0, -1.6), sides=8)
    quill = card_style(s, "quill", "cream", 5)

    def feather(u, v):
        half = 0.42 * math.sin(min(1.0, (1 - v) * 1.15) * math.pi) ** 0.7 if v < 0.85 else 0
        if abs(u - 0.5) < 0.05:
            return "q"
        return ("b" if int(v * 10) % 3 == 0 else "c") if abs(u - 0.5) < half else "."
    s.card("quill", grid_art(10, 32, feather), quill, at=(2.6, y0 + 1.2, -1.6), rot=(0, 30, -22), off=(0, 2.3, 0), size=[1.4, 4.6],
           key={"q": "oat:3", "c": "cream:6", "b": "ochre:4"})
    mug = s.style("mug", glaze("terra", 4.2, seed=2))
    s.lathe("mug", [(0, 1.8), (0.2, 2.0), (2.2, 2.0), (2.3, 1.6)], mug, base=(-4.6, y0, -2.6), sides=8, caps=(False, True))
    for k, (dx, dz, c, rot) in enumerate([(-0.4, 0.2, "honey", (0, 0, 8)), (0.35, -0.2, "berry", (0, 0, -10)), (0.1, 0.4, "lake", (6, 0, 0))]):
        s.add(f"pencil{k}", "prism", [0.35, 0.35, 3.6], s.style(f"pen{c}", flat(c, 4)), at=(-4.6 + dx, y0 + 0.4, -2.6 + dz), off=(0, 0, 1.8),
              rot=(-90 + rot[0], 0, rot[2]), sides=6)
    # desk lamp
    s.lathe("lampbase", [(0, 2.6), (0.3, 2.8), (0.6, 1.4)], br, base=(7.2, y0, -2.2), sides=10)
    s.add("lamparm", "prism", [0.4, 0.4, 4.6], br, at=(7.2, y0 + 0.6, -2.2), off=(0, 0, 2.3), rot=(-90, 0, 14), sides=5)
    shade = s.style("shade", painted_wood("sage", 4.0, under="brass", grain="y") if False else glaze("sage", 3.8, speck=False))
    s.lathe("shade", [(0, 3.6), (1.0, 2.6), (2.0, 1.2), (2.2, 0.8)], shade, base=(6.0, y0 + 3.6, -2.2), sides=10, caps=(False, True))
    s.lathe("glow_bulb", [(0, 1.4), (0.6, 1.2), (0.9, 0.4)], s.style("bulb", glow("glow", 4.0)), base=(6.0, y0 + 3.0, -2.2), sides=8)
    return s


# ------------------------------------------------------------------------------------------------ lights
@item
def paperlantern():
    """Festival lantern: a round ribbed paper lantern in soft terracotta with painted honey moths, a brass cap and a
    tasseled tail, hanging from a bamboo crook on a stone foot. Sways (clip 'idle'); the paper glows. ~19 px tall."""
    s = Spec("paperlantern", "Festival Lantern", density=6, tris=2000, hero=(30, 14))
    bam = {"ramp": "honey", "tone": 3.8, "rim": {"light": 1, "dark": 1, "light_shift": 0.8, "dark_shift": -0.8, "outline": "dark"},
           "layers": [{"id": "nodes", "op": "stripes", "axis": "y", "period": 4.2, "width": 0.06, "shift": -1.5},
                      {"id": "nodes_l", "op": "stripes", "axis": "y", "period": 4.2, "width": 0.05, "phase": 0.3, "shift": 1.2},
                      {"id": "streak", "op": "noise", "scale": 1.5, "amount": 0.5}],
           "brush": {"flow": "vertical", "length": 1.2, "width": 0.4, "rough": 0.4, "textures": {"honey": "wood"}}}
    bm = s.style("bam", bam)
    s.lathe("foot", [(0, 5.0), (0.6, 5.4), (1.4, 4.0), (1.8, 2.2)], s.style("rock", stone("stone", 4.2, moss=True, seed=4)), sides=8)
    s.cyl("pole", 1.0, 19.0, bm, (-2.6, 0.6, 0), sides=7)
    s.add("crook", "prism", [0.8, 0.8, 6.0], bm, at=(-2.6, 19.2, 0), off=(0, 0, 3.0), rot=(0, 90, 0) if False else (-80, 90, 0), sides=6) if False else \
        s.add("crook", "prism", [0.8, 0.8, 5.6], bm, centre=(0.0, 19.4, 0), rot=(0, 90, 0), sides=6)
    s.bone("hang", at=(2.0, 19.0, 0))
    cord = card_style(s, "cord", "oat", 3.4, light=0.4)
    s.card("cord", ["c"] * 6, cord, parent="hang", rel=(0, 0, 0), off=(0, -1.0, 0), size=[0.2, 2.0], key={"c": "oat:2"})
    br = s.style("br", brass())
    s.lathe("capt", [(0, 1.6), (0.6, 2.6), (0.9, 2.4)], br, parent="hang", base=(0, -2.9, 0), sides=10, rot=(180, 0, 0)) if False else \
        s.add("capt", "loft", None, br, parent="hang", rel=(0, -2.0, 0), rings=[{"at": [0, -0.9, 0], "size": [2.6, 2.6]}, {"at": [0, 0, 0], "size": [1.4, 1.4]}],
              profile={"sides": 10, "round": 2.0}, caps=[True, True], up=[0, 0, 1])
    pap = glow("terra", 4.2)
    pap["layers"] = [{"id": "ribs", "op": "stripes", "axis": "y", "period": 0.75, "width": 0.18, "shift": -0.9},
                     {"id": "core", "op": "band", "axis": "y", "from": -0.5, "to": 0.5, "shift": 0.8},
                     {"id": "moths", "op": "spots", "count": 5, "radius": [0.4, 0.55], "stretch": [1.6, 0.8, 1.6], "ramp": "honey", "tone": 5.4, "seed": 3,
                      "where": {"y": [-0.4, 0.4]}},
                     {"id": "seams", "op": "stripes", "axis": "around", "period": 0.125, "width": 0.06, "shift": -0.6}]
    ps = s.style("pap", pap)
    s.add("glow_paper", "loft", None, ps, parent="hang", rel=(0, -2.9, 0),
          rings=[{"at": [0, -0.2, 0], "size": [2.4, 2.4]}, {"at": [0, -1.4, 0], "size": [5.6, 5.6]}, {"at": [0, -3.4, 0], "size": [7.2, 7.2]},
                 {"at": [0, -5.4, 0], "size": [5.6, 5.6]}, {"at": [0, -6.6, 0], "size": [2.4, 2.4]}],
          profile={"sides": 12, "round": 2.0}, caps=[True, True], up=[0, 0, 1], subdiv=1)
    s.add("capb", "loft", None, br, parent="hang", rel=(0, -9.5, 0), rings=[{"at": [0, 0, 0], "size": [2.2, 2.2]}, {"at": [0, -0.6, 0], "size": [1.2, 1.2]}],
          profile={"sides": 8, "round": 2.0}, caps=[True, True], up=[0, 0, 1])
    tas = card_style(s, "tas", "berry", 4)

    def tassel(x, y):
        if y < 0.2:
            return "k" if abs(x - 0.5) < 0.15 else "."
        half = 0.15 + 0.3 * min(1, (y - 0.2) * 2.5)
        return ("d" if int(x * 10) % 2 else "l") if abs(x - 0.5) < half else "."
    for j, r in enumerate((0, 90)):
        s.card(f"tassel{j}", grid_art(10, 18, tassel), tas, parent="hang", rel=(0, -10.1, 0), rot=(0, r, 0), off=(0, -1.4, 0), size=[1.3, 2.8],
               key={"k": "honey:4", "l": "berry:5", "d": "berry:3"})
    s.anim("idle", 3.6, [{"part": "hang", "osc": {"axis": "z", "amp": 4, "cycles": 1}},
                         {"part": "hang", "osc": {"axis": "x", "amp": 2.5, "cycles": 1, "phase": 0.25}}])
    return s


@item
def mushroomlamp():
    """Mushroom lamp: one big glowcap toadstool lamp, its ice-blue cap speckled with pale spots and a frilly glowing
    gill skirt, on a cream stem with a ring, growing from a mossy rock with a little grass. ~13 px tall."""
    s = Spec("mushroomlamp", "Mushroom Lamp", density=7, tris=1800, hero=(30, 18))
    s.lathe("rock", [(0, 7.6), (0.6, 8.2), (1.6, 6.8), (2.2, 3.8)], s.style("rock", stone("stone", 4.0, moss=True, seed=6)), sides=9)
    stem = s.style("stem", wax("cream", 5.0))
    s.lathe("stem", [(0, 3.0), (0.6, 3.4), (3.0, 2.6), (6.0, 2.2), (7.2, 2.4)], stem, base=(0, 1.8, 0), sides=10)
    s.lathe("ring", [(0, 2.6), (0.7, 3.6), (0.9, 3.4)], stem, base=(0, 6.0, 0), sides=10, caps=(False, True))
    capst = glow("glowblue", 3.0)
    capst["layers"] += [{"id": "spots", "op": "spots", "count": 11, "radius": [0.45, 0.8], "ramp": "glowblue", "tone": 6, "seed": 2, "faces": ["up"], "bevel": True}]
    s.lathe("glow_cap", [(0, 12.0), (0.5, 12.2), (1.6, 11.0), (3.0, 8.0), (4.0, 4.4), (4.3, 0.0)], s.style("cap", capst), base=(0, 8.6, 0), sides=14, caps=(False, False))
    gill = {**glow("glowblue", 4.6), "layers": [{"id": "gills", "op": "stripes", "axis": "around", "period": 0.035, "width": 0.35, "shift": -1.2}]}
    s.lathe("glow_gill", [(0, 12.0), (0.2, 3.0)], s.style("gill", gill), base=(0, 8.55, 0), sides=14, caps=(False, True), rot=(180, 0, 0))
    gr = card_style(s, "grass", "fern", 4)
    for k, (x, z, a) in enumerate([(3.0, 2.6, 10), (-3.2, 1.8, 60), (1.0, -3.2, 120)]):
        cross_card(s, f"tuft{k}", *grass_img(k)[:1], gr, (x, 1.2, z), [1.8, 1.8], grass_img(k)[1], yaw=a)
    s.anim("idle", 3.0, [{"part": "glow_cap", "channel": "scale", "osc": {"amp": [0.015, 0.03, 0.015], "cycles": 1}}])
    return s


# ------------------------------------------------------------------------------------------------ decor and fun
@item
def books():
    """Book tower: six cloth-bound books stacked a little crooked, a ribbon bookmark trailing out, and a pair of round
    brass reading glasses folded on top. Small item, ~10 px tall."""
    s = Spec("books", "Book Tower", density=8, tris=1600, hero=(30, 22))
    bs = book_styles(s)
    y = 0.0
    for k, (c, w, d, h, yaw) in enumerate([("berry", 8.0, 6.0, 1.7, -8), ("lake", 7.2, 5.4, 1.5, 12), ("honey", 7.6, 5.8, 1.8, -4),
                                           ("sage", 6.6, 5.0, 1.3, 18), ("plum", 7.0, 5.2, 1.6, 2), ("clay", 6.0, 4.6, 1.2, -14)]):
        lay = [{"id": "bt", "op": "band", "axis": "x", "from": 0.6, "to": 0.68, "ramp": "brass", "tone": 4.6, "faces": ["front", "back", "top"]},
               {"id": "bb", "op": "band", "axis": "x", "from": -0.68, "to": -0.6, "ramp": "brass", "tone": 4.6, "faces": ["front", "back", "top"]}]
        s.box(f"cover{k}", [w, h, d], bs[c], (0.3 * (k % 2) - 0.15, y + h / 2, 0), rot=(0, yaw, 0), chamfer=0.12, paint={"layers": lay})
        s.box(f"pages{k}", [w - 0.4, h - 0.4, d - 0.25], bs["pages"], (0.3 * (k % 2) - 0.15, y + h / 2, 0.18), rot=(0, yaw, 0))
        y += h
    rib = card_style(s, "rib", "berry", 4, light=0.7)
    s.card("ribbon", ["r"] * 10, rib, at=(1.0, 4.4, 2.9), rot=(-10, 12, 6), off=(0, -1.6, 0), size=[0.6, 3.2], key={"r": "berry:4"})
    br = s.style("br", brass())
    for sx in (-1, 1):
        torus(s, f"lens{sx}", (sx * 1.25, y + 0.25, 0.4), 1.0, [0.32, 0.3], br, n=12, sides=4)
    s.box("bridge", [0.6, 0.2, 0.25], br, (0, y + 0.3, 0.4))
    for sx in (-1, 1):
        s.box(f"temple{sx}", [0.2, 0.2, 3.0], br, (sx * 1.9, y + 0.2, -1.0), rot=(0, -sx * 12, 0))
    glass = s.style("glass", {"ramp": "mist", "tone": 4.6, "light": 0.5, "rim": {"outline": "none"},
                              "layers": [{"id": "glint", "op": "gloss", "dash": True, "length": 2, "shift": 2.0, "density": 0.8, "post": True}]})
    for sx in (-1, 1):
        s.lathe(f"glass{sx}", [(0, 1.7), (0.05, 1.7)], glass, base=(sx * 1.25, y + 0.2, 0.4), sides=12, caps=(False, True))
    return s


def letter_art(ch, scale=3):
    G = {"A": [".XXX.", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
         "B": ["XXXX.", "X...X", "X...X", "XXXX.", "X...X", "X...X", "XXXX."],
         "C": [".XXX.", "X...X", "X....", "X....", "X....", "X...X", ".XXX."],
         "*": ["..X..", "X.X.X", ".XXX.", "XXXXX", ".XXX.", "X.X.X", "..X.."],
         "M": ["X...X", "XX.XX", "X.X.X", "X.X.X", "X...X", "X...X", "X...X"]}[ch]
    out = []
    for r in G:
        row = "".join(("L" if c == "X" else ".") * scale for c in r)
        out += [row] * scale
    return out


@item
def blocks():
    """ABC blocks: three chunky painted wooden toy blocks (berry, lake, sage) with raised letters and stars on every
    face, cream bevelled borders and rubbed corners. Stacked two and one. Small item."""
    s = Spec("blocks", "ABC Blocks", density=8, tris=900, hero=(30, 22))
    for k, (c, letters, pos, yaw) in enumerate([("berry", "A*", (-3.7, 0, 0.2), 8), ("lake", "BM", (3.6, 0, 0.8), -14), ("sage", "C*", (0, 6.6, 0.3), 24)]):
        st = painted_wood(c, 4.0, under="oakl", grain="y", seed=k)
        st["layers"] += [{"id": "border", "op": "panel", "inset": 4, "shift": 0, "highlight": 1, "shadow": 1},
                         {"id": "frame", "op": "rect", "rect": [0.1, 0.1, 0.9, 0.9], "ramp": "cream", "tone": 5.0, "bevel": True},
                         {"id": "inner", "op": "rect", "rect": [0.17, 0.17, 0.83, 0.83], "ramp": c, "tone": 4.0}]
        bs = s.style(f"blk{k}", st)
        stamps = []
        for j, face in enumerate(["front", "back", "left", "right", "top"]):
            ch = letters[j % 2]
            stamps.append({"face": face, "at": "center", "art": letter_art(ch, 4), "key": {"L": "cream:6"}})
        s.box(f"block{k}", [6.6, 6.6, 6.6], bs, (pos[0], pos[1] + 3.3, pos[2]), rot=(0, yaw, 0), chamfer=0.35, paint={"stamps": stamps})
    return s


@item
def ball():
    """Bouncy ball: a stitched felt ball of six panels (berry, oat, lake, honey) with raised seams. Small item, ~7 px."""
    s = Spec("ball", "Bouncy Ball", density=9, tris=700, hero=(30, 24))
    st = cloth("berry", 3.6, weave=0.3, photo="jersey_melange", scale=4)
    st["layers"] += [{"id": "p1", "op": "stripes", "axis": "around", "period": 0.5, "width": 0.25, "ramp": "cream", "tone": 5.2},
                     {"id": "p2", "op": "stripes", "axis": "around", "period": 0.5, "width": 0.25, "phase": 0.125, "ramp": "lake", "tone": 3.4},
                     {"id": "p3", "op": "stripes", "axis": "around", "period": 0.5, "width": 0.25, "phase": 0.25, "ramp": "honey", "tone": 4.0},
                     {"id": "seam", "op": "stripes", "axis": "around", "period": 0.1111, "width": 0.07, "shift": -1.3},
                     {"id": "stitch", "op": "stripes", "axis": "path", "period": 0.5, "width": 0.4, "shift": 1.4, "range": [-1, 1]}]
    rings = [(0, 0.0)]
    for k in range(1, 8):
        a = k / 8 * math.pi
        rings.append((3.5 - 3.5 * math.cos(a), 7.0 * math.sin(a)))
    rings.append((7.0, 0.0))
    s.lathe("ball", rings, s.style("felt", st), sides=12, caps=(False, False))
    return s


@item
def easel():
    """Quest board: an oak A-frame easel holding a slate chalkboard with today's plan in chalk (tick boxes, lines, a
    moon and a doodled owl with dot eyes), a chalk ledge with chalk sticks and a cloth rag. ~20 px tall."""
    s = Spec("easel", "Quest Board", density=6, tris=1400, hero=(28, 12))
    leg = s.style("leg", wood("oak", 4.0, grain="y", knots=1, seed=1))
    for sx in (-1, 1):
        s.add(f"leg{sx}", "box", [1.3, 20.6, 1.3], leg, at=(sx * 5.4, 0, 1.4), off=(0, 10.3, 0), rot=(-12, 0, -sx * 7), chamfer=0.2)
    s.add("backleg", "box", [1.2, 19.0, 1.2], leg, at=(0, 0, -5.0), off=(0, 9.5, 0), rot=(16, 0, 0), chamfer=0.2)
    s.add("ledge", "box", [14.6, 0.7, 2.2], leg, at=(0, 5.0, 1.4), off=(0, 0, 0.7), rot=(-12, 0, 0))
    s.add("lip", "box", [14.6, 0.8, 0.4], leg, at=(0, 5.0, 1.4), off=(0, 0.6, 1.7), rot=(-12, 0, 0))
    s.add("frame", "box", [14.0, 12.4, 0.9], leg, at=(0, 5.4, 0.9), off=(0, 6.4, 0), rot=(-12, 0, 0), chamfer=0.2)
    slate = card_style(s, "slate", "pine", 3, light=0.5)

    def board(x, y):
        X, Y = x * 80, y * 70
        c = "s" if (int(X / 3) + int(Y / 3)) % 7 else "t"
        # three tick-box lines
        for k, yy in enumerate((14, 28, 42)):
            if 8 <= X <= 15 and yy <= Y <= yy + 7 and (X < 9 or X > 14 or Y < yy + 1 or Y > yy + 6):
                return "w"
            if k < 2 and 9 <= X <= 14 and yy <= Y <= yy + 7 and abs((Y - yy) - (7 - (X - 9) * 1.2)) < 1.0 and X > 11:
                return "g"
            if k < 2 and 9 <= X <= 12 and abs((Y - yy) - (2 + (X - 9))) < 0.9:
                return "g"
            if 19 <= X <= 52 - k * 6 and yy + 3 <= Y <= yy + 4:
                return "w" if int(X) % 9 else "s"
        # moon
        if math.hypot(X - 66, Y - 14) < 7 and math.hypot(X - 69, Y - 12) > 6:
            return "y"
        # doodled owl
        if abs(math.hypot((X - 64) / 8, (Y - 46) / 10) - 1) < 0.12:
            return "w"
        if math.hypot(X - 61, Y - 43) < 1.4 or math.hypot(X - 67, Y - 43) < 1.4:
            return "w"
        if abs(Y - 36.5 + abs(X - 64) * 0.0) < 0.8 and (57 < X < 60 or 68 < X < 71):
            return "w"
        if 10 <= X <= 70 and 60 <= Y <= 61:
            return "w" if int(X / 2) % 2 else "s"
        return c
    s.card("slate", grid_art(80, 70, board), slate, at=(0, 5.4, 0.9), rot=(-12, 0, 0), off=(0, 6.4, 0.5), size=[12.6, 11.0],
           key={"s": "pine:2", "t": "pine:3", "w": "paper:5", "g": "sage:6", "y": "honey:6"})
    chalk = s.style("chalk", flat("paper", 5))
    for k, (x, rot) in enumerate([(-3.0, 12), (-1.6, -20), (4.2, 80)]):
        s.add(f"chalk{k}", "prism", [0.5, 0.5, 1.8], chalk, at=(x, 5.6, 2.2), rot=(-12, rot, 90) if k == 2 else (-12, 90 + rot, 0), sides=6)
    rag = s.style("rag", cloth("rose", 4.0, weave=0.5))
    s.add("rag", "loft", None, rag, at=(5.6, 5.4, 2.0), rot=(-12, 10, 0),
          rings=[{"at": [-1.2, 0.3, 0], "size": [1.6, 0.5]}, {"at": [0, 0.6, 0], "size": [2.0, 0.9]}, {"at": [1.2, 0.2, 0], "size": [1.4, 0.5]}],
          profile={"sides": 6, "round": 1.8}, caps=[True, True])
    return s


@item
def chest():
    """Treasure chest: an oak chest with tarnished brass bands, studs and a hasp, its domed lid thrown open on a heap
    of owl coins, a lake-blue gem, a string of pearls and a rolled map. 1 x 0.5 blocks, ~13 px tall."""
    s = Spec("chest", "Treasure Chest", density=6, tris=2600, hero=(30, 20))
    body = s.style("body", wood("oak", 3.8, grain="x", knots=2, seed=2))
    band = brass(tone=3.2)
    band["layers"].append({"id": "studs", "op": "rivets", "inset": 2, "spacing": 6, "highlight": 1, "shadow": 1})
    bd = s.style("band", band)
    s.box("box", [13.4, 6.0, 8.4], body, (0, 3.0, 0), chamfer=0.3, paint={"layers": [
        {"id": "planks", "op": "stripes", "axis": "y", "period": 2.0, "width": 0.07, "shift": -1.3, "faces": ["front", "back", "left", "right"]}]})
    for k, x in enumerate((-4.8, 4.8)):
        s.box(f"band{k}", [1.2, 6.2, 8.6], bd, (x, 3.0, 0))
    s.box("trim", [13.6, 0.8, 8.6], bd, (0, 5.7, 0))
    s.box("hasp", [1.6, 2.4, 0.4], bd, (0, 4.6, 4.35), chamfer=0.1, paint={"layers": [{"id": "hole", "op": "spots", "centers": [[0, -0.3, 0.2, 0.25]], "ramp": "ink", "tone": 1}]})
    # domed lid hinged at the back, thrown open
    s.bone("lid", at=(0, 6.0, -4.2), rot=(-105, 0, 0))
    lid_rings = [{"at": [-6.7, 0, 0], "size": [8.4, 3.4]}, {"at": [6.7, 0, 0], "size": [8.4, 3.4]}]
    s.add("lidtop", "loft", None, body, parent="lid", rel=(0, 0, 4.2), rings=lid_rings, profile={"sides": 10, "round": 2.0}, caps=[True, True], subdiv=0)
    for k, x in enumerate((-4.8, 4.8)):
        s.add(f"lidband{k}", "loft", None, bd, parent="lid", rel=(x, 0, 4.2),
              rings=[{"at": [-0.6, 0, 0], "size": [8.6, 3.6]}, {"at": [0.6, 0, 0], "size": [8.6, 3.6]}], profile={"sides": 10, "round": 2.0}, caps=[True, True], subdiv=0)
    # treasure
    coins = {"ramp": "brass", "tone": 4.6, "rim": {"outline": "none"}, "dither": 0.0,
             "layers": [{"id": "coins", "op": "scales", "along": "x", "size": [1.0, 0.8], "shape": "round", "gap": 0.1, "highlight": 1, "shadow": 1, "jitter": 0.8},
                        {"id": "glint", "op": "gloss", "dash": True, "length": 2, "shift": 2.2, "density": 0.9, "post": True}],
             "brush": {"off": True}}
    s.lathe("hoard", [(0, [12.6, 7.6]), (0.6, [12.0, 7.0]), (1.4, [8.4, 5.0]), (2.0, [3.0, 2.0])], s.style("coins", coins), base=(0, 5.6, 0.2), sides=12, caps=(False, True))
    gem = {"ramp": "lake", "tone": 4.4, "light": 0.6, "rim": {"light": 1, "dark": 1, "light_shift": 1.5, "dark_shift": -1.2, "outline": "dark"},
           "layers": [{"id": "glint", "op": "gloss", "dash": True, "length": 2, "shift": 2.4, "density": 1.0, "post": True}], "brush": {"off": True}}
    s.lathe("gem", [(0, 0.2), (0.9, 1.8), (1.5, 1.2)], s.style("gem", gem), base=(2.8, 6.6, 1.4), sides=6, rot=(0, 0, 18))
    pearl = s.style("pearl", glaze("paper", 5.2, speck=False))
    for k in range(9):
        a = k / 8 * math.pi * 1.1
        s.lathe(f"pearl{k}", [(0, 0.1), (0.3, 0.6), (0.6, 0.1)], pearl, base=(-3.6 + math.cos(a) * 2.2, 6.9 + math.sin(a) * 0.3, 1.2 + math.sin(a) * 1.6), sides=5)
    s.add("map", "prism", [1.4, 1.4, 5.0], s.style("map", cloth("oat", 4.6, weave=0.2)), centre=(0.6, 7.2, -1.6), rot=(0, 80, 14), sides=8)
    return s


@item
def trophy():
    """Gold trophy: a polished brass loving cup with looping handles and an embossed owl, on a stepped walnut plinth
    with a brass plaque, a berry ribbon tied round the stem. Small item, ~14 px tall."""
    s = Spec("trophy", "Gold Trophy", density=8, tris=1600, hero=(30, 16))
    wd = s.style("wd", wood("walnut", 4.0, grain="x", knots=0, seed=2))
    br = s.style("br", brass(tone=3.8))
    s.box("plinth", [7.6, 2.0, 7.6], wd, (0, 1.0, 0), chamfer=0.3)
    s.box("plinth2", [6.0, 1.4, 6.0], wd, (0, 2.7, 0), chamfer=0.25)
    s.box("plaque", [4.2, 1.1, 0.2], br, (0, 1.0, 3.85))
    s.lathe("cup", [(0, 3.0), (0.4, 3.0), (0.8, 1.2), (2.6, 0.9), (3.2, 1.6), (4.4, 4.2), (6.6, 5.8), (7.6, 6.2), (8.0, 6.6), (8.3, 6.2)], br,
            base=(0, 3.4, 0), sides=14, caps=(False, True), paint={"layers": [
                {"id": "owl", "op": "spots", "centers": [[0, 6.4, 2.6, 1.0]], "shift": 0.9, "bevel": True},
                {"id": "owleyes", "op": "spots", "centers": [[-0.35, 6.7, 2.75, 0.22], [0.35, 6.7, 2.75, 0.22]], "ramp": "brass", "tone": 1.5}]})
    for sx in (-1, 1):
        s.loft(f"handle{sx}", [((0, 0, 0), 0.6), ((sx * 1.8, 0.4, 0), 0.6), ((sx * 2.0, -1.8, 0), 0.6), ((sx * 0.6, -3.0, 0), 0.5)], br,
               at=(sx * 2.9, 10.6, 0), sides=5, round_=2.0)
    rib = card_style(s, "rib", "berry", 4, light=0.7)

    def ribbon(x, y):
        if abs(y - 0.25) < 0.2 and (abs(x - 0.3) < 0.18 or abs(x - 0.7) < 0.18):
            return "r"
        if y > 0.35 and (abs(x - 0.42 + (y - 0.35) * 0.2) < 0.08 or abs(x - 0.58 - (y - 0.35) * 0.2) < 0.08):
            return "d" if y > 0.9 else "r"
        if abs(x - 0.5) < 0.08 and abs(y - 0.25) < 0.1:
            return "k"
        return "."
    s.card("ribbon", grid_art(16, 20, ribbon), rib, at=(0, 6.2, 1.25), off=(0, -0.8, 0), size=[2.6, 3.2], key={"r": "berry:4", "d": "berry:2", "k": "berry:6"})
    return s


@item
def globe():
    """Desk globe: a sea-blue globe painted with sage and oat continents and a compass rose, tilted in a brass meridian
    ring on a turned walnut stand. The globe turns slowly (clip 'idle'). Small item."""
    s = Spec("globe", "Desk Globe", density=8, tris=1800, hero=(30, 18))
    wd = s.style("wd", wood("walnut", 4.2, grain="x", knots=0, seed=1))
    br = s.style("br", brass())
    s.lathe("base", [(0, 6.0), (0.4, 6.2), (0.8, 5.0), (1.2, 2.6), (1.6, 2.0)], wd, sides=12)
    s.lathe("stem", [(0, 1.2), (1.4, 0.8), (2.6, 1.1)], br, base=(0, 1.5, 0), sides=8)
    s.bone("tilt", at=(0, 8.6, 0), rot=(0, 0, 23))
    s.add("meridian", "loft", None, br, parent="tilt", rel=(0, 0, 0),
          rings=[{"at": [math.sin(a) * 4.6, math.cos(a) * 4.6, 0], "size": [0.5, 0.45]} for a in np.linspace(-math.pi * 0.95, math.pi * 0.95, 17)],
          profile={"sides": 4, "round": 2.0}, caps=[True, True], subdiv=0)
    s.bone("spin", parent="tilt", rel=(0, 0, 0))
    sea = glaze("lake", 3.8, speck=False, seed=2)
    sea["layers"] = [{"id": "depth", "op": "noise", "scale": 1.2, "amount": 0.5},
                     {"id": "land", "op": "patches", "scale": 1.8, "threshold": 0.56, "ramp": "sage", "tone": 4.4, "seed": 7, "bevel": True},
                     {"id": "sand", "op": "patches", "scale": 1.8, "threshold": 0.66, "ramp": "oat", "tone": 4.8, "seed": 7},
                     {"id": "grid", "op": "stripes", "axis": "around", "period": 0.0833, "width": 0.05, "shift": 0.7},
                     {"id": "lat", "op": "stripes", "axis": "path", "period": 1.6, "width": 0.07, "shift": 0.7},
                     {"id": "wet", "op": "gloss", "dash": True, "length": 3, "shift": 1.6, "density": 0.6, "post": True}]
    rings = []
    for k in range(9):
        a = k / 8 * math.pi
        rings.append({"at": [0, -4.0 * math.cos(a), 0], "size": max(0.01, 8.0 * math.sin(a))})
    s.add("ball", "loft", None, s.style("sea", sea), parent="spin", rel=(0, 0, 0), rings=rings, profile={"sides": 14, "round": 2.0},
          caps=[False, False], up=[0, 0, 1], subdiv=0)
    s.add("axle", "prism", [0.45, 0.45, 9.8], br, parent="tilt", rel=(0, 0, 0), rot=(90, 0, 0), sides=5)
    s.anim("idle", 12.0, [{"part": "spin", "keys": [[0, 0], [6.0, 180], [12.0, 360]], "axis": "y", "ease": "linear"}])
    return s


@item
def telescope():
    """Star telescope: a brass refractor with lacquered dusk-blue tube bands, a dew shield and an eyepiece, tilted to
    the sky on an oak tripod with brass feet and a little star map pinned to one leg. ~20 px tall."""
    s = Spec("telescope", "Star Telescope", density=6, tris=2400, hero=(30, 16))
    leg = s.style("leg", wood("oak", 4.0, grain="y", knots=0, seed=1))
    br = s.style("br", brass())
    head = (0, 11.6, 0)
    for k, a in enumerate((0, 120, 240)):
        s.add(f"leg{k}", "box", [1.1, 12.4, 1.1], leg, at=head, off=(0, -6.2, 0), rot=(0, a, 24) if False else (24, a, 0), chamfer=0.2) if False else None
        ra = math.radians(a)
        fx, fz = math.sin(ra) * 5.2, math.cos(ra) * 5.2
        L = math.sqrt(fx * fx + fz * fz + 11.6 ** 2)
        pitch = math.degrees(math.atan2(math.hypot(fx, fz), 11.6))
        s.add(f"leg{k}", "box", [1.1, L, 1.1], leg, at=head, off=(0, -L / 2, 0), rot=(0, a, 0), chamfer=0.2) if False else None
        s.bone(f"lb{k}", at=head, rot=(0, a, 0))
        s.add(f"leg{k}", "box", [1.1, L, 1.1], leg, parent=f"lb{k}", rel=(0, 0, 0), rot=(-pitch, 0, 0), off=(0, -L / 2, 0), chamfer=0.2)
        s.lathe(f"foot{k}", [(0, 1.2), (0.6, 1.0)], br, base=(fx, 0, fz), sides=6)
    s.lathe("mount", [(0, 2.4), (0.8, 2.6), (1.6, 1.6)], br, base=(0, 11.0, 0), sides=8)
    s.bone("aim", at=(0, 13.2, 0), rot=(0, -62, 0))
    tube = brass(tone=3.6)
    tube["layers"].append({"id": "lacquer", "op": "stripes", "axis": "z", "period": 4.0, "width": 0.55, "ramp": "dusk", "tone": 3.6})
    tb = s.style("tube", tube)
    s.add("tube", "prism", [2.6, 2.6, 13.0], tb, parent="aim", rel=(0, 0, 0), rot=(-32, 0, 0), off=(0, 0, 1.6), sides=10, front_scale=[1.15, 1.15])
    s.add("shield", "prism", [3.4, 3.4, 2.6], br, parent="tube", rel=(0, 0, 8.6), sides=10, double_sided=True)
    s.add("lens", "prism", [2.8, 2.8, 0.2], s.style("lens", {"ramp": "night", "tone": 3, "light": 0.4, "rim": {"outline": "none"},
                                                            "layers": [{"id": "glint", "op": "spots", "centers": [[-0.6, 0.6, 0.1, 0.35]], "ramp": "mist", "tone": 6}]}),
          parent="tube", rel=(0, 0, 9.5), sides=10)
    s.add("eyepiece", "prism", [1.0, 1.0, 2.4], br, parent="tube", rel=(0, 0, -6.2), sides=8)
    s.add("finder", "prism", [0.8, 0.8, 4.0], br, parent="tube", rel=(0, 1.8, 1.0), sides=6)
    note = card_style(s, "note", "paper", 5)

    def map_(x, y):
        if x < 0.05 or x > 0.95 or y < 0.05 or y > 0.95:
            return "e"
        if hashf_(x * 30, y * 30) > 0.93:
            return "s"
        return "p"
    s.card("note", grid_art(18, 22, map_), note, parent="lb0", rel=(0, -4.0, 1.8), rot=(-math.degrees(math.atan2(5.2, 11.6)), 0, 0), off=(0, 0, 0.6),
           size=[2.6, 3.2], key={"p": "paper:4", "e": "oat:3", "s": "dusk:3"})
    return s


def hashf_(x, y):
    v = math.sin(int(x) * 127.1 + int(y) * 311.7) * 43758.5453
    return v - math.floor(v)


@item
def rug():
    """Woven rug: a flat-woven wool kilim in lake, oat and terracotta with stepped diamonds, a woven border and knotted
    fringe at both ends. 1.5 x 1 blocks, flat."""
    s = Spec("rug", "Woven Rug", density=6, tris=600, hero=(28, 50))
    st = cloth("oat", 4.6, weave=0.6, photo="hessian_230", scale=4)
    st["layers"] += [
        {"id": "border", "op": "band", "axis": "z", "from": 0.72, "to": 0.9, "ramp": "terra", "tone": 4.0, "faces": ["up"]},
        {"id": "border2", "op": "band", "axis": "z", "from": -0.9, "to": -0.72, "ramp": "terra", "tone": 4.0, "faces": ["up"]},
        {"id": "borderx", "op": "band", "axis": "x", "from": 0.82, "to": 0.92, "ramp": "terra", "tone": 4.0, "faces": ["up"]},
        {"id": "borderx2", "op": "band", "axis": "x", "from": -0.92, "to": -0.82, "ramp": "terra", "tone": 4.0, "faces": ["up"]},
        {"id": "dia_a", "op": "stripes", "axis": [1, 0, 1], "period": 4.0, "width": 0.22, "ramp": "lake", "tone": 3.8, "faces": ["up"], "zigzag": [0.4, 0.8], "zig_axis": "x"},
        {"id": "dia_b", "op": "stripes", "axis": [1, 0, -1], "period": 4.0, "width": 0.22, "ramp": "lake", "tone": 3.8, "faces": ["up"], "zigzag": [0.4, 0.8], "zig_axis": "x"},
        {"id": "dots", "op": "stripes", "axis": [1, 0, 1], "period": 4.0, "width": 0.06, "phase": 1.6, "ramp": "honey", "tone": 4.8, "faces": ["up"]},
        {"id": "rows", "op": "stripes", "axis": "z", "period": 0.3, "width": 0.5, "shift": -0.35},
    ]
    s.box("rug", [21.6, 0.45, 16.0], s.style("wool", st), (0, 0.225, 0), hide=["bottom"])
    fr = card_style(s, "fringe", "oat", 4.6, light=0.7)

    def fringe(x, y):
        return ("f" if int(x * 40) % 2 == 0 else ".") if y > 0.1 else "k"
    for sx in (-1, 1):
        s.card(f"fringe{sx}", grid_art(40, 6, fringe), fr, at=(sx * 11.4, 0.1, 0), plane="xz", rot=(0, 90 if sx > 0 else -90, 0), size=[15.6, 1.2],
               key={"f": "oat:5", "k": "oat:3"})
    return s


# ------------------------------------------------------------------------------------------------ plants
@item
def cactus():
    """Brave cactus: a ribbed sage-green columnar cactus with two arms, rows of pale spines and a rosy flower on top, in a
    cream glazed pot with a lake-blue band and pebble topping. Small item, ~16 px."""
    s = Spec("cactus", "Brave Cactus", density=8, tris=1800, hero=(30, 16))
    pot = glaze("cream", 4.8, seed=1)
    pot["layers"].append({"id": "band", "op": "band", "axis": "y", "from": 0.2, "to": 0.45, "ramp": "lake", "tone": 4.0})
    s.lathe("pot", [(0, 4.6), (0.3, 5.2), (4.2, 6.4), (4.6, 7.0), (5.4, 7.0), (5.5, 6.4)], s.style("pot", pot), sides=12, caps=(False, True))
    s.lathe("pebbles", [(0, 6.2), (0.3, 5.0)], s.style("peb", stone("pebble", 4.6, seed=3)), base=(0, 5.1, 0), sides=12, caps=(False, True))
    cac = {"ramp": "sage", "tone": 3.8, "rim": {"light": 1, "dark": 1, "light_shift": 0.6, "dark_shift": -0.6, "outline": "dark"},
           "layers": [{"id": "ribs", "op": "stripes", "axis": "around", "period": 0.125, "width": 0.25, "shift": -1.1},
                      {"id": "ridge", "op": "stripes", "axis": "around", "period": 0.125, "width": 0.12, "phase": 0.06, "shift": 0.9},
                      {"id": "spines", "op": "spots", "count": 60, "radius": [0.1, 0.14], "ramp": "cream", "tone": 6, "seed": 5, "min_gap": 0.4},
                      {"id": "tone", "op": "noise", "scale": 1.4, "amount": 0.5}],
           "brush": {"flow": "path", "length": 0.8, "width": 0.4, "rough": 0.4, "textures": {"sage": "organic"}}}
    cs = s.style("cac", cac)
    s.lathe("trunk", [(0, 3.6), (1.0, 4.2), (6.0, 4.0), (8.5, 3.4), (9.6, 2.0), (10.0, 0.0)], cs, base=(0, 5.2, 0), sides=10, caps=(False, False))
    for sx, y0, up in ((1, 9.0, 3.8), (-1, 11.0, 2.8)):
        s.loft(f"arm{sx}", [((0, 0, 0), 2.0), ((sx * 2.2, 0.2, 0), 2.2), ((sx * 2.8, 1.4, 0), 2.1), ((sx * 2.9, up, 0), 1.9), ((sx * 2.9, up + 1.0, 0), 0.01)],
               cs, at=(sx * 1.4, y0, 0), sides=8, round_=2.0, subdiv=1)
    fl = glaze("rose", 4.4, speck=False)
    fl["layers"].append({"id": "petals", "op": "stripes", "axis": "around", "period": 0.125, "width": 0.2, "shift": -1.0})
    s.lathe("flower", [(0, 0.6), (0.5, 1.8), (1.0, 2.6), (1.2, 2.0)], s.style("fl", fl), base=(0, 15.0, 0), sides=8, caps=(False, True),
            paint={"layers": [{"id": "eye", "op": "spots", "centers": [[0, 1.2, 0, 0.5]], "ramp": "honey", "tone": 5.4, "faces": ["up"]}]})
    return s


@item
def bonsai():
    """Tiny bonsai: a gnarled juniper with a twisting trunk and cloud pads of needle foliage, on a shallow lake-blue
    glazed tray with moss, a pebble and a little stone lantern. ~17 px tall."""
    s = Spec("bonsai", "Tiny Bonsai", density=7, tris=2600, hero=(30, 18))
    tray = glaze("dusk", 4.0, seed=2)
    s.box("tray", [12.4, 2.6, 8.2], s.style("tray", tray), (0, 1.6, 0), chamfer=0.5)
    for k, (x, z) in enumerate([(-5.0, 3.0), (5.0, 3.0), (-5.0, -3.0), (5.0, -3.0)]):
        s.box(f"tfoot{k}", [1.4, 0.4, 1.4], "tray", (x, 0.2, z))
    s.box("moss", [11.2, 0.3, 7.0], s.style("moss", {**soil("moss", 4.0), "layers": soil("moss", 4.0)["layers"]}), (0, 2.95, 0))
    trunk = wood("bark", 4.0, grain="y", knots=0, wear=0, seed=5)
    trunk["layers"].append({"id": "twist", "op": "stripes", "axis": "around", "period": 0.2, "width": 0.3, "shift": -1.0, "zigzag": [0.4, 0.6], "zig_axis": "path"})
    tr = s.style("trunk", trunk)
    s.loft("trunk", [((0, 0, 0), 2.8), ((-1.2, 2.0, 0.3), 2.2), ((0.6, 4.2, -0.2), 1.8), ((2.4, 5.6, 0.4), 1.4), ((1.6, 7.6, 0), 1.1), ((-0.6, 9.0, -0.2), 0.8)],
           tr, at=(-1.4, 3.0, 0), sides=7, round_=2.0, subdiv=1)
    s.loft("branch", [((0, 0, 0), 1.0), ((2.6, 0.6, 0.4), 0.7), ((4.4, 0.4, 0.8), 0.45)], tr, at=(1.0, 8.6, 0.2), sides=6)
    s.loft("branch2", [((0, 0, 0), 0.9), ((-2.4, 0.8, -0.3), 0.6), ((-3.8, 1.0, -0.4), 0.4)], tr, at=(-0.2, 10.4, -0.2), sides=6)
    foliage = {"ramp": "pine", "tone": 4.2, "rim": {"light": 1, "dark": 1, "light_shift": 1.0, "dark_shift": -0.8, "outline": "dark"},
               "layers": [{"id": "tufts", "op": "scales", "along": "x", "size": [0.9, 0.7], "shape": "round", "gap": 0.1, "highlight": 1, "shadow": 1, "jitter": 0.9},
                          {"id": "tips", "op": "spots", "count": 30, "radius": [0.15, 0.25], "ramp": "moss", "tone": 5, "seed": 3, "faces": ["up"]},
                          {"id": "under", "op": "gradient", "axis": "y", "amount": 1.4}],
               "brush": {"flow": "horizontal", "length": 0.7, "width": 0.3, "rough": 0.5, "textures": {"pine": "fur"}}}
    foliage["tone"] = 2.6          # the pads are only a dark core now; the foliage itself is sprig cards
    foliage["layers"] = [l for l in foliage["layers"] if l["id"] != "tips"]
    fo = s.style("foliage", foliage)
    # 2D pixel-art foliage: juniper sprigs from BUSHED's vegetation atlas (from Poly Haven's Fir Tree 01 twig maps, CC0),
    # many crossed cards per cloud pad, fanned out and tilted, over a small dark core
    sprig = card_style(s, "sprig", "pine", 4, light=0.9)
    arts = [image_art("juniper.png", 40, 17, colours=20, flip=bool(j % 2), seed=j) for j in range(2)]
    rng = np.random.default_rng(5)
    tracks = []
    for k, (x, y, z, w, h) in enumerate([(5.0, 9.6, 0.8, 5.4, 2.0), (-4.8, 11.8, -0.6, 4.8, 1.8), (0.2, 13.8, 0.0, 5.6, 2.4), (2.6, 11.2, -1.4, 3.4, 1.4)]):
        s.lathe(f"pad{k}", [(0, [w * 0.45, w * 0.35]), (h * 0.5, [w * 0.6, w * 0.45]), (h * 0.85, [w * 0.3, w * 0.25])], fo, base=(x, y + 0.2, z), sides=7)
        s.bone(f"padb{k}", at=(x, y + h * 0.45, z))
        n = int(5 + w * 1.4)
        for j in range(n):
            ang = j * 360 / n + float(rng.uniform(-14, 14))
            art, key = arts[j % 2]
            r = w * 0.18
            ra = math.radians(ang)
            s.card(f"sprig{k}_{j}", art, sprig, parent=f"padb{k}", rel=(math.sin(ra) * r, float(rng.uniform(-0.3, 0.5)) * h, math.cos(ra) * r),
                   rot=(float(rng.uniform(-35, -5)), ang + 90, float(rng.uniform(-12, 12))), plane="xy", off=(w * 0.28, 0, 0),
                   size=[w * 0.62, w * 0.62 * 17 / 40], key=key)
        for j in range(3):   # a few lying flat on top so the pad reads from above
            art, key = arts[j % 2]
            s.card(f"sprigtop{k}_{j}", art, sprig, parent=f"padb{k}", rel=(0, h * 0.55, 0), rot=(0, j * 60 + 15, 0), plane="xz",
                   size=[w * 0.9, w * 0.38], key=key)
        tracks.append({"part": f"padb{k}", "osc": {"axis": "z", "amp": 1.5, "cycles": 1, "phase": k * 0.23}})
    s.anim("idle", 5.0, tracks)
    s.lathe("pebble", [(0, 1.4), (0.5, 1.6), (0.8, 0.8)], s.style("peb", stone("pebble", 4.4, seed=7)), base=(3.6, 3.0, 2.2), sides=6)
    lant = s.style("lant", stone("stone", 4.4, seed=8))
    s.box("lbase", [1.0, 0.4, 1.0], lant, (-4.0, 3.3, 2.4))
    s.box("lpost", [0.5, 1.2, 0.5], lant, (-4.0, 4.1, 2.4))
    s.box("lbox", [1.0, 0.9, 1.0], lant, (-4.0, 5.1, 2.4))
    s.add("lroof", "taper", [1.6, 0.6, 1.6], lant, centre=(-4.0, 5.85, 2.4), rot=(-90, 0, 0), front_scale=[0.2, 0.2])
    return s


@item
def potflowers():
    """Tulip pot: a terracotta pot with a chalky rim and three tulips (rose, honey and cream) with strap leaves. Small."""
    s = Spec("potflowers", "Tulip Pot", density=8, tris=1800, hero=(30, 18))
    s.lathe("pot", [(0, 4.6), (0.3, 5.2), (4.0, 6.4), (4.1, 7.0), (5.2, 7.2), (5.3, 6.6)], s.style("pot", clay("terra", 4.2)), sides=12, caps=(False, True))
    s.lathe("soil", [(0, 6.4), (0.2, 5.4)], s.style("soil", soil()), base=(0, 5.0, 0), sides=12, caps=(False, True))
    for k, (x, z, h, c, yaw) in enumerate([(-1.4, 0.4, 5.2, "rose", 20), (1.5, -0.4, 6.4, "honey", 140), (0.1, 1.6, 4.4, "cream", 260)]):
        tulip(s, f"tulip{k}", (x, 5.1, z), h, c, yaw=yaw)
    return s


@item
def planter():
    """Flower planter: a long oak planter box on stub feet, brimming with a little meadow: daisies, rose and lilac tulips,
    lavender spikes and grass tufts. 18 px long."""
    s = Spec("planter", "Flower Planter", density=6, tris=3000, hero=(30, 18))
    bx = s.style("box", wood("oak", 4.0, grain="x", knots=2, seed=4))
    s.box("box", [18.0, 5.0, 7.0], bx, (0, 3.5, 0), chamfer=0.3, paint={"layers": [
        {"id": "boards", "op": "stripes", "axis": "y", "period": 1.66, "width": 0.07, "shift": -1.3, "faces": ["front", "back"]}]})
    s.box("rim", [18.6, 0.6, 7.6], s.style("rim", wood("walnut", 4.0, grain="x", knots=0, seed=5)), (0, 6.2, 0), chamfer=0.2)
    for sx in (-1, 1):
        s.box(f"foot{sx}", [2.0, 1.0, 7.0], "rim", (sx * 7.5, 0.5, 0))
    s.box("soil", [17.0, 0.3, 6.0], s.style("soil", soil()), (0, 6.1, 0), paint={"layers": [
        {"id": "moss", "op": "patches", "scale": 1.0, "threshold": 0.6, "ramp": "moss", "tone": 4.2}]})
    y0 = 6.2
    daisy(s, "daisy0", (-6.4, y0, 0.6), 3.2)
    daisy(s, "daisy1", (2.2, y0, -1.2), 3.8, petal="rose", eye="honey", yaw=40)
    daisy(s, "daisy2", (6.8, y0, 1.4), 2.8, yaw=-30)
    tulip(s, "tulip0", (-2.6, y0, 1.0), 4.4, "rose", yaw=30)
    tulip(s, "tulip1", (5.0, y0, -0.8), 5.0, "lilac", yaw=200)
    lav = card_style(s, "lav", "lilac", 4)

    def spike(x, y):
        if abs(x - 0.5) < 0.06:
            return "s"
        if y < 0.55 and abs(x - 0.5) < 0.28 * (1 - abs(y - 0.3) * 1.4) and int(y * 20) % 2 == 0:
            return "p" if x < 0.5 else "q"
        return "."
    for k, (x, z) in enumerate([(-4.4, -1.6), (0.0, 1.8), (-0.8, -1.4)]):
        cross_card(s, f"lav{k}", grid_art(12, 30, spike), lav, (x, y0, z), [1.6, 4.4], {"s": "fern:3", "p": "lilac:5", "q": "lilac:3"}, yaw=k * 33)
    gr = card_style(s, "grass", "fern", 4)
    for k, (x, z) in enumerate([(-8.0, -2.0), (-1.4, 2.4), (3.8, 2.2), (8.0, -1.8), (-5.0, 2.2)]):
        cross_card(s, f"tuft{k}", *grass_img(k)[:1], gr, (x, y0, z), [2.0, 2.0], grass_img(k)[1], yaw=k * 47)
    return s


@item
def gnome():
    """Garden gnome: a glazed ceramic gnome in a dusk-blue coat with a brass-buckled belt, a long curly cream beard, a
    rosy nose, dot eyes and a tall berry-red hat flopping to one side, holding a little lantern. ~19 px tall."""
    s = Spec("gnome", "Garden Gnome", density=7, tris=2400, hero=(30, 16))
    s.lathe("base", [(0, 6.4), (0.3, 6.6), (1.0, 6.2), (1.2, 5.6)], s.style("base", stone("stone", 4.2, moss=True, seed=2)), sides=10)
    boots = s.style("boots", glaze("walnut", 3.6, speck=False))
    for sx in (-1, 1):
        s.lathe(f"boot{sx}", [(0, [2.0, 2.6]), (0.8, [2.0, 2.6]), (1.2, [1.6, 2.0])], boots, base=(sx * 1.1, 1.2, 0.5), sides=8)
    coat = glaze("dusk", 3.8, seed=3)
    coat["layers"].append({"id": "hem", "op": "band", "axis": "y", "from": -1.0, "to": -0.8, "ramp": "dusk", "tone": 2.8})
    s.lathe("body", [(0, 5.6), (0.8, 5.8), (3.6, 5.0), (5.6, 4.2), (6.6, 3.8)], s.style("coat", coat), base=(0, 2.2, 0), sides=10)
    s.lathe("belt", [(0, 5.3), (0.8, 5.2)], s.style("belt", glaze("walnut", 3.2, speck=False)), base=(0, 4.6, 0), sides=10)
    s.box("buckle", [1.4, 1.1, 0.3], s.style("br", brass()), (0, 5.0, 2.65))
    skin = s.style("skin", glaze("blush", 4.2, speck=False) if False else glaze("rose", 5.0, speck=False))
    s.lathe("head", [(0, 2.4), (0.8, 3.8), (2.2, 4.0), (3.4, 3.2)], skin, base=(0, 8.6, 0.2), sides=10, paint={"layers": [
        {"id": "eyes", "op": "spots", "centers": [[-0.75, 2.4, 1.85, 0.24], [0.75, 2.4, 1.85, 0.24]], "ramp": "ink", "tone": 0.5},
        {"id": "cheeks", "op": "spots", "centers": [[-1.3, 1.6, 1.6, 0.45], [1.3, 1.6, 1.6, 0.45]], "ramp": "rose", "tone": 3.8}]})
    s.lathe("nose", [(0, 0.9), (0.5, 1.1), (0.9, 0.5)], s.style("nose", glaze("rose", 3.8, speck=False)), base=(0, 9.6, 2.0), sides=7, rot=(-80, 0, 0))
    beard = glaze("cream", 5.2, speck=False)
    beard["layers"].append({"id": "curls", "op": "scales", "along": "x", "size": [0.8, 0.8], "shape": "round", "gap": 0.1, "highlight": 1, "shadow": 1, "jitter": 0.7})
    s.loft("beard", [((0, 0, 0), [3.6, 1.6]), ((0, -1.8, 0.4), [3.8, 1.8]), ((0, -3.6, 0.6), [2.6, 1.4]), ((0, -4.8, 0.5), [0.6, 0.4])],
           s.style("beard", beard), at=(0, 9.4, 1.9), sides=8, round_=2.0)
    hat = glaze("berry", 4.0, seed=4)
    hat["layers"].append({"id": "brim", "op": "band", "axis": "path", "from": 0.0, "to": 0.12, "shift": -0.8})
    hs = s.style("hat", hat)
    s.loft("hat", [((0, 0, 0), [5.0, 4.8]), ((0, 2.0, -0.2), [3.8, 3.6]), ((0.2, 4.2, -0.4), [2.4, 2.3]), ((1.4, 6.0, -0.2), [1.3, 1.3]), ((3.0, 6.4, 0.2), [0.2, 0.2])],
           hs, at=(0, 11.4, 0.1), sides=9, round_=2.0, subdiv=2)
    # little lantern in his hand
    s.lathe("arm", [(0, 1.4), (2.6, 1.1)], s.style("coat"), base=(2.8, 6.8, 0.6), sides=6, rot=(0, 0, 70)) if False else None
    s.loft("arm", [((0, 0, 0), 1.6), ((1.2, -1.4, 0.8), 1.3), ((1.6, -2.4, 1.4), 1.1)], "coat", at=(2.6, 7.6, 0.4), sides=6)
    s.lathe("hand", [(0, 0.9), (0.6, 1.1), (1.0, 0.5)], skin, base=(4.2, 4.6, 1.8), sides=6)
    s.lathe("lantframe", [(0, 1.6), (0.3, 1.6), (0.35, 1.0), (2.2, 1.0), (2.3, 1.7), (2.6, 1.0), (3.1, 0.3)], "br", base=(4.2, 2.0, 2.0), sides=6, caps=(True, True))
    s.lathe("glow_lamp", [(0, 1.15), (1.8, 1.15)], s.style("lamp", glow("glow", 3.6)), base=(4.2, 2.4, 2.0), sides=6)
    return s


# ------------------------------------------------------------------------------------------------ extras
EXTRAS = {}


def extra(fn):
    EXTRAS[fn.__name__] = fn
    return fn


@extra
def planter_flowers():
    """The little meadow that fills the borrowed planter box (merged by borrow.py): daisies, rose and lilac tulips,
    lavender spikes and grass tufts, standing on y = 0 (the soil line)."""
    s = Spec("planter_flowers", "Planter flowers", density=6, tris=2000, hero=(30, 18))
    daisy(s, "daisy0", (-6.0, 0, 0.8), 3.4)
    daisy(s, "daisy1", (2.2, 0, -1.4), 4.0, petal="rose", eye="honey", yaw=40)
    daisy(s, "daisy2", (6.4, 0, 1.2), 3.0, yaw=-30)
    daisy(s, "daisy3", (-1.6, 0, 1.6), 2.6, yaw=70)
    tulip(s, "tulip0", (-3.2, 0, -0.6), 4.6, "rose", yaw=30)
    tulip(s, "tulip1", (4.6, 0, -0.4), 5.2, "lilac", yaw=200)
    tulip(s, "tulip2", (0.4, 0, 0.2), 4.0, "honey", yaw=120)
    lav = card_style(s, "lav", "lilac", 4)

    def spike(x, y):
        if abs(x - 0.5) < 0.06:
            return "s"
        if y < 0.55 and abs(x - 0.5) < 0.28 * (1 - abs(y - 0.3) * 1.4) and int(y * 20) % 2 == 0:
            return "p" if x < 0.5 else "q"
        return "."
    for k, (x, z) in enumerate([(-4.6, 1.4), (1.2, 1.6), (-0.8, -1.6), (6.8, -1.4)]):
        cross_card(s, f"lav{k}", grid_art(12, 30, spike), lav, (x, 0, z), [1.6, 4.6], {"s": "fern:3", "p": "lilac:5", "q": "lilac:3"}, yaw=k * 33)
    gr = card_style(s, "grass", "fern", 4)
    for k, (x, z) in enumerate([(-7.2, -1.6), (-2.0, 2.0), (3.6, 1.8), (7.4, 0.6), (-5.0, -1.8), (0.0, -2.2)]):
        cross_card(s, f"tuft{k}", *grass_img(k)[:1], gr, (x, 0, z), [2.4, 2.4], grass_img(k)[1], yaw=k * 47)
    return s
