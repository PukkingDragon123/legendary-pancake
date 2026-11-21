"""Tables, desks and storage (src/assets/decor/tables.ts ids)."""
from __future__ import annotations

import math
import random

from kit import (P, Item, clay, fabric, face_px, glass, glaze, glow, grid, ink, knit, leafy, metal, moss, painted, plain, rows, soft,
                 stripe_layers, wax, wicker, wood)
from parts import book_style, books, doily_art, drawer, knob, turned_leg

ITEMS = {}


def item(fn):
    ITEMS[fn.__name__] = fn
    return fn


def jar(it, pid, x, y, z, h, fill, lid="copper", r=1.3):
    """A glass jar with something inside and a metal lid."""
    it.cyl(pid + "_fill", (x, y + 0.2, z), r * 0.8, h * 0.72, soft(it, f"fill{fill:x}", fill, pattern=[{"id": "bits", "op": "spots", "count": 8, "radius": [0.2, 0.35], "shift": 1.2}]), sides=8)
    it.cyl(pid, (x, y, z), r, h, glass(it), sides=8, double_sided=True,
           paint={"stamps": [{"faces": ["sides"], "at": "center", "art": ["_" * 12] * 30, "key": {}, "off": True}]})
    it.cyl(pid + "_lid", (x, y + h, z), r * 1.08, 0.7, metal(it, lid), sides=8)


def sprig(it, pid, x, y, z, pot_col, leaf_col=None, seed=1, s=1.0):
    """A little potted plant for shelves: a glazed pot and a leafy mound with a few trailing leaves."""
    it.loft(pid + "_pot", [(0, 0, 0, 2.4 * s), (0, 2.2 * s, 0, 3.0 * s), (0, 2.8 * s, 0, 3.3 * s)], glaze(it, f"pot{pot_col:x}", pot_col), sides=8, pivot=(x, y, z), up=[0, 0, 1])
    lf = leafy(it, f"sprig{seed}", leaf_col or P["fern"])
    it.loft(pid + "_leaves", [(0, 0, 0, (3.4 * s, 3.0 * s)), (0, 1.4 * s, 0, (4.2 * s, 3.8 * s)), (0, 2.6 * s, 0, (2.6 * s, 2.4 * s)), (0, 3.2 * s, 0, 0.8)], lf, sides=8, pivot=(x, y + 2.6 * s, z), up=[0, 0, 1])


# ------------------------------------------------------------------ tables
@item
def writing_desk():
    it = Item("writing_desk", "Roll-Top Writing Desk", density=3.5)
    c = wood(it, "cherry", "y")
    cx = wood(it, "cherry", "x")
    cz = wood(it, "cherry", "z")
    brass = metal(it, "brass")
    for s in (-1, 1):
        it.box("plinth", (s * 9.5, 0.5, 0), (8, 1, 12), wood(it, "walnut", "x"), ch=0.3)
        it.box("pedestal", (s * 9.5, 6.8, 0), (8, 11.6, 11), c, ch=0.3)
        for k in range(3):
            drawer(it, "drawer", (s * 9.5, 3.4 + k * 3.6, 5.6), 7, 3.2, cx, pull=brass)
    it.box("centre", (0, 10.1, 0), (11, 3, 11), cx, ch=0.3)
    drawer(it, "cdrawer", (0, 10.2, 5.6), 10, 2.4, cx, keyhole=ink(it))
    it.box("top", (0, 12.9, 0.5), (28, 1, 13), cx, ch=0.35)
    leather = fabric(it, "leather", P["pine"], tone=3.2, weave=False, piping=False)
    it.box("blotter", (0, 13.45, 2.0), (18, 0.1, 7), leather, paint={"layers": [{"id": "tooling", "op": "panel", "inset": 1, "shift": -1.0, "highlight": 1.2},
                                                                              {"id": "gilt", "op": "band", "axis": "z", "from": 0.82, "to": 0.9, "ramp": it.ramp("br_gilt", 0xd8b66a, n=5), "tone": 2.4}]})
    # the hutch: cubbyholes with letters and a little ink bottle, the tambour half rolled up
    it.box("hutchback", (0, 18.4, -5.4), (27, 10, 1.4), cz, ch=0.2)
    shadow = plain(it, "cubby", P["woodDeep"], tone=1.6, light=0.2)
    for i in range(5):
        for j in range(2):
            x, y = -10.4 + i * 5.2, 15.6 + j * 4.6
            it.box("cubby", (x, y, -4.5), (4.4, 4.0, 0.4), shadow)
            r = random.Random(i * 7 + j)
            if r.random() > 0.35:
                env = plain(it, "env", P["paper"], tone=3.4, layers=[{"id": "flap", "op": "stripes", "axis": [1, 1, 0], "period": 3.0, "width": 0.08, "shift": -0.9, "faces": ["front"]}])
                for k in range(r.randint(1, 3)):
                    it.box("letter", (x - 0.8 + k * 0.7, y - 2.0 + (1.6 + k * 0.5) / 2, -3.4 + k * 0.4), (3.0, 1.6 + k * 0.5, 0.3), env, rot=(0, 0, r.uniform(-4, 4)))
            else:
                it.cyl("ink", (x - 0.6, y - 2.0, -3.4), 0.9, 1.4, glass(it, "ink", 0x4e5a70), sides=6)
                it.cyl("inkcap", (x - 0.6, y - 0.6, -3.4), 0.5, 0.5, brass, sides=6)
                it.box("roll", (x + 1.0, y - 1.4, -3.4), (1.6, 1.2, 1.6), plain(it, "parch", P["oat"], tone=3.4))
    for i in range(6):
        it.box("divider", (-13 + i * 5.2, 18.4, -3.6), (0.8, 10, 3.6), c, ch=0.15)
    it.box("shelf", (0, 18.2, -3.6), (27, 0.6, 3.6), cx)
    for s in (-1, 1):
        it.box("side", (s * 13.7, 19.1, -3.3), (1.2, 11.4, 6.2), cz, ch=0.3)
    tamb = it.style("tambour", dict(it.styles[cx], layers=it.styles[cx]["layers"] + [{"id": "slats", "op": "stripes", "axis": [0, 1, 1], "period": 1.0, "width": 0.2, "shift": -1.4}]))
    it.loft("tambour", [(-13.4, 0, 0, (0.8, 6.4)), (13.4, 0, 0, (0.8, 6.4))], tamb, sides=4, pivot=(0, 23.6, -3.4), rot=(-38, 0, 0))
    it.box("cornice", (0, 24.6, -3.6), (28.4, 1.6, 7.2), cx, ch=0.4)
    # inkwell, quill, a candle stub and a sealed letter
    it.cyl("inkwell", (-8.6, 13.4, 3.6), 1.2, 1.8, glass(it, "ink", 0x4e5a70), sides=8)
    it.cyl("inkcollar", (-8.6, 15.2, 3.6), 0.7, 0.5, brass, sides=8)
    quill = grid(5, 22)
    for y in range(22):
        w = 0 if y > 19 else (1 if y < 2 else 2)
        for x in range(2 - w, 3 + w):
            quill[y][x] = "#" if x != 2 else "v"
    it.card("quill", (-7.3, 18.8, 3.6), plain(it, "feather", P["cream"], tone=4.6, light=0.4), art=rows(quill), size=(1.6, 7.0), rotation=[0, 30, -22], key={"v": "pa_feather:2"})
    it.cyl("holder", (9.2, 13.4, 3.6), 1.4, 0.6, brass, sides=8)
    it.cyl("candle", (9.2, 14.0, 3.6), 0.7, 2.4, wax(it), sides=8)
    from lights import flame, flicker_tracks
    fl = flame(it, "flame", (9.2, 16.5, 3.6), s=0.9)
    it.box("letter", (2.4, 13.55, 3.4), (5, 0.25, 3.4), plain(it, "letter", P["oat"], tone=3.6, layers=[
        {"id": "lines", "op": "stripes", "axis": "z", "period": 0.6, "width": 0.25, "shift": -1.0, "faces": ["top"], "range": [-0.6, 0.6]}]), rot=(0, -12, 0))
    it.cyl("seal", (3.6, 13.6, 4.4), 0.6, 0.3, plain(it, "seal", P["berry"], tone=3.0), sides=8)
    it.anim("idle", 2.0, flicker_tracks(fl))
    return it.spec()


@item
def round_table():
    it = Item("round_table", "Lace-Cloth Round Table", density=3)
    oak = wood(it, "oak", "x")
    oaky = wood(it, "oak", "ry", knots=0)
    dark = wood(it, "dark", "rz", knots=0)
    brass = metal(it, "brass")
    it.cyl("top", (0, 13.0, 0), 12, 1.6, oak, sides=16)
    lace = it.ramp("pa_lace", 0xefe7d6, n=6)
    lst = it.style("lace", {"ramp": lace, "tone": 3.6, "rim": {"light_shift": 0.6, "dark_shift": -0.6}, "brush": {"off": True}, "dither": 0.0,
                            "layers": [{"id": "weave", "op": "stripes", "axis": [1, 0, 1], "period": 0.67, "width": 0.3, "shift": -0.6},
                                       {"id": "weave2", "op": "stripes", "axis": [1, 0, -1], "period": 0.67, "width": 0.3, "shift": -0.6}]})
    # top of the cloth: a lace medallion and a ring of eyelets (punched through to the wood)
    W, H = face_px(25.2, 25.2, it.density)
    g = grid(W, H)
    cxp, cyp = (W - 1) / 2, (H - 1) / 2
    for y in range(H):
        for x in range(W):
            d = math.hypot(x - cxp, y - cyp) / (W / 2)
            a = math.atan2(y - cyp, x - cxp)
            if abs(d - 0.74) < 0.03 and int((a + math.pi) / (2 * math.pi) * 48) % 2 == 0:
                g[y][x] = "_"
            elif abs(d - 0.5) < 0.035 and int((a + math.pi) / (2 * math.pi) * 32) % 2 == 0:
                g[y][x] = "_"
            elif d < 0.22 and (int(d * 30) % 3 == 0) and int((a + math.pi) / (2 * math.pi) * 12) % 2 == 0:
                g[y][x] = "_"
            elif abs(d - 0.62) < 0.02:
                g[y][x] = "S"
    it.cyl("cloth", (0, 14.6, 0), 12.6, 0.3, lst, sides=16, paint={"stamps": [{"face": "front", "at": [0, 0], "art": rows(g), "key": {"S": "pa_lace:2"}}]})
    # the scalloped drop all round, with a crochet edge of little holes
    sw = int(round(2 * 12.8 * math.sin(math.pi / 16) * it.density))
    scal = []
    for y in range(4):
        row = ""
        for x in range(sw + 2):
            u = (x % 8) - 3.5
            row += "_" if y < 3 and (u * u) / 12.25 + ((3 - y) / 3) ** 2 * 0 > (y / 3.0) + 0.15 else "."
        scal.append(row)
    eyelet = ["." * (sw + 2)] * 0 + ["".join("_" if (x % 4 == 1) else "." for x in range(sw + 2))]
    it.cyl("drop", (0, 11.2, 0), 12.8, 3.6, lst, sides=16, double_sided=True,
           paint={"stamps": [{"faces": ["sides"], "at": "bottom", "art": scal[::-1], "key": {}},
                             {"faces": ["sides"], "at": "bottom", "offset": [0, -5], "art": eyelet, "key": {}}]},
           hide=["front", "back"])
    # pedestal: a turned column and four splayed claw feet with brass sabots
    turned_leg(it, "column", 0, 0, 12.0, 1.9, oaky, y0=1.0, prof=[1.4, 1.0, 0.85, 1.25, 0.8, 0.9, 1.3, 1.0, 1.2])
    for k in range(4):
        a = k * 90 + 45
        r = math.radians(a)
        it.loft("foot", [(0, 2.2, 0, (2.2, 2.4)), (0, 1.4, 3.6, (2.0, 2.0)), (0, 0.8, 6.6, (1.6, 1.4)), (0, 1.0, 7.6, (1.4, 1.2))], dark, sides=6, pivot=(0, 0, 0), rot=(0, a, 0))
        it.loft("sabot", [(0, 0, 0, 1.6), (0, 1.2, 0, 1.4)], brass, sides=6, pivot=(math.sin(r) * 7.5, 0, math.cos(r) * 7.5), up=[0, 0, 1])
    return it.spec()


@item
def log_table():
    it = Item("log_table", "Old-Oak Coffee Table", density=3.5)
    bark = it.ramp("bk_bark", P["bark"], n=7)
    mossr = it.ramp("ms_moss", P["moss"], n=6)
    barkst = it.style("bark", {"ramp": bark, "tone": 3.2, "rim": {"light_shift": 0.8, "dark_shift": -1.0}, "brush": {"flow": "vertical", "length": 1.6, "rough": 0.7},
                               "layers": [{"id": "photo", "op": "photo", "src": "assets/photos/bark_brown_02", "scale": 6.0, "amount": 0.9, "ramps": ["bk_bark"]},
                                          {"id": "furrows", "op": "stripes", "axis": [1, 0, 0.4], "period": 1.2, "width": 0.25, "shift": -1.2, "wobble": 0.6, "wobble_scale": 2.0},
                                          {"id": "moss", "op": "drip", "ramp": mossr, "tone": 3.2, "depth": 0.4, "length": 1.4, "width": 0.6, "scale": 1.5, "bevel": {"shadow": 1, "highlight": 1}}]})
    # the slice: an elliptical prism with a ring-painted top (a stamp generated ring by ring)
    rx, rz = 11.0, 8.0
    W, H = face_px(2 * rx, 2 * rz, it.density)
    rings_ = it.ramp("wd_heart", 0xcfa877, n=7)
    g = grid(W, H)
    rr = random.Random(5)
    wob = [rr.uniform(-0.25, 0.25) for _ in range(12)]
    for y in range(H):
        for x in range(W):
            ex, ez = (x - (W - 1) / 2) / (W / 2), (y - (H - 1) / 2) / (H / 2)
            d = math.hypot(ex, ez)
            a = math.atan2(ez, ex)
            if d > 1.0:
                continue
            dd = d * 17 + sum(w * math.sin(a * (k + 2) + k) for k, w in enumerate(wob[:4]))
            ring = int(dd)
            fr = dd - ring
            if d > 0.93:
                ch = "b"  # bark rim on the top
            elif d > 0.87:
                ch = "s"  # pale sapwood
            elif abs(a - 0.6) < 0.035 + 0.02 * d and d > 0.3:
                ch = "k"  # a drying crack
            elif d < 0.05:
                ch = "p"  # the pith
            elif fr < 0.16:
                ch = "R"  # the dark late-wood line of each ring
            elif fr < 0.3 and ring % 3 == 0:
                ch = "r"
            else:
                ch = "l" if (ring * 7 % 5 == 0 and fr > 0.6) else "."
            g[y][x] = ch
    # a mug-ring stain
    for y in range(H):
        for x in range(W):
            if abs(math.hypot(x - W * 0.3, y - H * 0.35) - 3.4) < 0.5 and g[y][x] in ".rR":
                g[y][x] = "m"
    top = it.style("slice", {"ramp": rings_, "tone": 4.2, "rim": {"light_shift": 0.6, "dark_shift": -1.0}, "brush": {"flow": "horizontal", "length": 1.0, "rough": 0.3},
                             "layers": [{"id": "photo", "op": "photo", "src": "assets/photos/bark_brown_02", "scale": 9.0, "amount": 0.25, "ramps": ["wd_heart"]},
                                        {"id": "bark", "op": "fill", "ramp": bark, "tone": 2.6, "faces": ["sides"]},
                                        {"id": "barkphoto", "op": "photo", "src": "assets/photos/bark_brown_02", "scale": 5.0, "amount": 1.0, "ramps": ["bk_bark"]},
                                        {"id": "moss", "op": "drip", "ramp": mossr, "tone": 3.0, "depth": 0.2, "length": 1.0, "width": 0.6, "scale": 1.2, "faces": ["sides"]}]})
    key = {"b": "bk_bark:2", "s": "wd_heart:6", "k": "wd_heart:0", "p": "wd_heart:1", "r": "wd_heart:3", "R": "wd_heart:2", "m": "wd_heart:2", "l": "wd_heart:5"}
    it.cyl("slice", (0, 6.4, 0), rx, 2.6, top, sides=14, rz=rz, paint={"stamps": [{"face": "front", "at": [0, 0], "art": rows(g), "key": key}]})
    for (x, z, rz_, rx_) in ((-6.4, 3.2, 8, 5), (6.2, 3.4, -7, 5), (0.2, -5.0, 0, -7)):
        it.loft("leg", [(0, 0, 0, 3.4), (0, 0.6, 0, 3.0), (0, 3.4, 0, 2.6), (0, 5.6, 0, 2.8)], barkst, sides=7, pivot=(x, 0.3, z), rot=(rx_, 0, rz_), up=[0, 0, 1])
    # a little mushroom family has moved in under the edge
    stem = plain(it, "stem", 0xeadfc6, tone=3.6)
    cap = plain(it, "mcap", P["ochre"], tone=3.4, layers=[{"id": "dots", "op": "spots", "count": 4, "radius": [0.25, 0.35], "shift": 1.6}])
    for (x, z, h, r) in ((9.6, 4.2, 2.6, 1.5), (10.6, 2.4, 1.6, 1.0)):
        it.cyl("mstem", (x, 0, z), 0.45, h, stem, sides=6)
        it.loft("mcap", [(0, 0, 0, r * 2), (0, 0.5, 0, r * 1.8), (0, 0.9, 0, r * 0.8)], cap, sides=8, pivot=(x, h, z), up=[0, 0, 1])
    return it.spec()


@item
def bobbin_side_table():
    it = Item("bobbin_side_table", "Bobbin Side Table", density=4)
    legs = wood(it, "walnut", "ry", knots=0)
    top = wood(it, "walnut", "x")
    side = wood(it, "walnut", "z")
    brass = metal(it, "brass")
    for x in (-3.6, 3.6):
        for z in (-3.6, 3.6):
            turned_leg(it, "leg", x, z, 13.4, 0.9, legs)
    it.box("shelf", (0, 4.5, 0), (8.6, 1, 8.6), top, ch=0.3)
    it.box("apron", (0, 11.7, 0), (8.4, 3.4, 8.4), side, ch=0.3)
    drawer(it, "drawer", (0, 11.7, 4.35), 6, 2.6, top, pull=brass)
    it.cyl("top", (0, 13.4, 0), 5.6, 1.2, top, sides=12)
    lace = it.ramp_list("pa_lace", [0xd8cfbc, 0xeae3d2, 0xf7f2e6])
    dl = it.style("lace", {"ramp": lace, "tone": 1.2, "light": 0.3, "rim": {"light": 0, "dark": 0}, "brush": {"off": True}, "dither": 0.0})
    it.card("doily", (0, 14.66, 0), dl, art=doily_art(36, 36), plane="xz", key={"w": "pa_lace:2", "l": "pa_lace:1"})
    books(it, "book", -3.8, 2.6, 5.0, 0.4, 5.6, 3.2, seed=4)
    return it.spec()


@item
def vanity():
    it = Item("vanity", "Gilded Vanity", density=3.5)
    cream = painted(it, "cream", P["cream"], under="light", grain="x", chips=0.12)
    creamy = painted(it, "cream", P["cream"], under="light", grain="y", chips=0.12)
    creamr = painted(it, "cream", P["cream"], under="light", grain="ry", chips=0.12)
    gold = metal(it, "gold", tarnish=False)
    for x in (-9.6, 9.6):
        for z in (-3.6, 3.6):
            turned_leg(it, "leg", x, z, 9.2, 0.8, creamr)
    it.box("apron", (0, 10.7, 0), (21, 3.4, 9), cream, ch=0.3)
    for x in (-6, 6):
        drawer(it, "drawer", (x, 10.7, 4.5), 7.4, 2.6, cream, pull=gold)
    it.box("top", (0, 12.8, 0), (22, 0.8, 10), wood(it, "light", "x"), ch=0.3)
    it.box("trim", (0, 12.3, 5.0), (22.4, 0.4, 0.4), gold)
    # oval mirror in a gilded frame on two turned posts
    W, H = face_px(13, 16, it.density)
    g = grid(W, H)
    for y in range(H):
        for x in range(W):
            u, v = (x + 0.5) / W - 0.5, (y + 0.5) / H - 0.5
            d = math.hypot(u * 1.22, v)
            if d > 0.5:
                g[y][x] = "_"
            elif d > 0.43:
                g[y][x] = "G" if (u - v) < 0 else "g"
                if d > 0.48:
                    g[y][x] = "d"
            else:
                k = (u - v) * 10
                if abs(k - 1.5) < 0.45 or abs(k - 3.0) < 0.22:
                    g[y][x] = "w"
                else:
                    g[y][x] = "m" if v > 0.1 else ("M" if v > -0.2 else "n")
    mir = it.ramp("gl_mirror", 0xa9c3c6, n=6)
    gr = it.ramps.get("br_gold") or it.ramp("br_gold", 0xd4b36a, n=8)
    it.box("mirror", (0, 23, -3.2), (13, 16, 0.6), plain(it, "mirrorback", P["woodDark"], tone=3), paint={"stamps": [
        {"faces": ["front", "back"], "at": [0, 0], "art": rows(g), "key": {"G": "br_gold:6", "g": "br_gold:4", "d": "br_gold:2", "w": "gl_mirror:5", "m": "gl_mirror:2", "M": "gl_mirror:3", "n": "gl_mirror:4"}}]})
    for s in (-1, 1):
        turned_leg(it, "post", s * 7.4, -3.2, 12.0, 0.6, creamr, y0=13.2)
        it.cyl("finial", (s * 7.4, 25.2, -3.2), 0.8, 1.0, gold, sides=8)
        it.box("pin", (s * 6.6, 21.5, -3.2), (1.4, 1.0, 1.0), gold)
    it.loft("crest", [(0, 0, 0, (3.0, 0.8)), (0, 1.0, 0, (2.0, 0.8)), (0, 1.8, 0, (0.8, 0.8))], gold, sides=6, pivot=(0, 31.0, -3.2), up=[0, 0, 1])
    # perfume bottles, a powder puff and an open jewellery box at the ends, the middle left free
    it.loft("scent", [(0, 0, 0, 1.4), (0, 1.3, 0, 1.8), (0, 1.6, 0, 1.2)], soft(it, "scent", P["blush"]), sides=8, pivot=(-8.6, 13.25, 1), up=[0, 0, 1])
    it.loft("glass_perfume", [(0, 0, 0, 1.8), (0, 1.6, 0, 2.2), (0, 2.6, 0, 1.0), (0, 3.0, 0, 0.6)], glass(it, "rosegl", 0xe3c3c6), sides=8, pivot=(-8.6, 13.2, 1), up=[0, 0, 1])
    it.loft("bulb", [(0, 0, 0, 0.8), (0, 0.6, 0, 1.5), (0, 1.4, 0, 0.6)], soft(it, "bulb", P["berry"]), sides=6, pivot=(-8.6, 16.2, 1), up=[0, 0, 1])
    it.loft("scent", [(0, 0, 0, 1.0), (0, 1.2, 0, 1.2)], soft(it, "scent2", P["sky"]), sides=6, pivot=(-6.0, 13.25, 2.2), up=[0, 0, 1])
    it.loft("glass_perfume", [(0, 0, 0, 1.4), (0, 1.8, 0, 1.6), (0, 2.2, 0, 0.6)], glass(it, "bluegl", 0xbcd6dc), sides=6, pivot=(-6.0, 13.2, 2.2), up=[0, 0, 1])
    it.cyl("stopper", (-6.0, 15.4, 2.2), 0.4, 0.8, gold, sides=6)
    jb = soft(it, "velvet", P["plum"], pattern=[{"id": "nap", "op": "noise", "scale": 0.8, "amount": 0.6}])
    it.box("jewelbox", (7.6, 14.4, 1), (5, 2.4, 3.6), jb, ch=0.3, paint={"layers": [{"id": "trim", "op": "band", "axis": "y", "from": 0.6, "to": 0.85, "ramp": "br_gold", "tone": 5}]})
    it.box("jewellid", (7.6, 15.6, -0.8), (5, 0.6, 3.6), jb, ch=0.2, pivot=(7.6, 15.6, -0.8), rot=(-72, 0, 0))
    it.box("lidpad", (7.6, 15.6, -0.5), (4.2, 0.2, 3.0), soft(it, "satin", P["blush"]), pivot=(7.6, 15.6, -0.8), rot=(-72, 0, 0))
    for (x, z, c) in ((7.0, 1.4, P["berry"]), (8.4, 0.6, P["lake"]), (6.4, 0.2, P["honey"])):
        it.box("gem", (x, 15.8, z), (0.9, 0.9, 0.9), glaze(it, f"gem{c:x}", c), rot=(45, 0, 45))
    it.loft("pearls", [(-1.2, 0, 2.6, 0.5), (0, 0.4, 2.2, 0.5), (1.2, 0, 2.6, 0.5)], plain(it, "pearl", P["snow"], tone=3.4,
            layers=[{"id": "beads", "op": "stripes", "axis": "x", "period": 0.5, "width": 0.3, "shift": -1.2}]), sides=6, pivot=(7.6, 15.6, 1.0))
    # the matching stool with a rose cushion
    for x in (-3.4, 3.4):
        for z in (9, 14):
            turned_leg(it, "sleg", x, z, 6.0, 0.6, creamr)
    it.loft("stoolcush", [(0, 0, 0, (9.6, 7.6)), (0, 1.2, 0, (9.8, 7.8)), (0, 2.2, 0, (8.4, 6.4)), (0, 2.6, 0, (4.0, 3.0))], fabric(it, "rosevelvet", P["rose"], tone=3.4, weave=False),
            sides=12, round_=2.6, pivot=(0, 5.8, 11.5), up=[0, 0, 1],
            paint={"layers": [{"id": "tufts", "op": "spots", "centers": [[0, 2.5, 0, 0.5], [2.2, 2.3, 0, 0.4], [-2.2, 2.3, 0, 0.4]], "shift": -1.6, "bevel": True}]})
    it.cyl("stoolrim", (0, 5.6, 11.5), 4.8, 0.6, gold, sides=12, rz=3.8)
    return it.spec()


@item
def workbench():
    it = Item("workbench", "Tinkerer's Workbench", density=3.5)
    dark = wood(it, "dark", "y")
    oak = wood(it, "oak", "x")
    bl = it.ramp("wd_block", 0xc89d6a, n=8, at=4)
    block = it.style("block", {"ramp": bl, "tone": 4.0, "rim": {"light_shift": 1.0, "dark_shift": -1.1}, "brush": {"flow": "x", "length": 2.4, "rough": 0.4},
                               "layers": [{"id": "strips", "op": "stripes", "axis": "z", "period": 1.6, "width": 0.5, "shift": -0.6, "faces": ["top", "front", "back"]},
                                          {"id": "glue", "op": "stripes", "axis": "z", "period": 1.6, "width": 0.07, "shift": -1.4, "faces": ["top", "front", "back"]},
                                          {"id": "fibre", "op": "photo", "src": "assets/photos/bark_brown_02", "scale": 16.0, "amount": 0.2, "ramps": ["wd_block"]},
                                          {"id": "scorch", "op": "spots", "count": 3, "radius": [0.5, 1.0], "shift": -2.0, "faces": ["top"]},
                                          {"id": "cuts", "op": "cracks", "scale": 3.0, "width": 0.02, "threshold": 0.4, "shift": -1.0, "faces": ["top"]},
                                          {"id": "ends", "op": "fill", "shift": -0.6, "faces": ["left", "right"]}]})
    for x in (-11, 11):
        for z in (-3.6, 3.6):
            it.box("leg", (x, 6, z), (2.4, 12, 2.4), dark, ch=0.4)
    it.box("shelf", (0, 3.5, 0), (22, 1, 9), oak, ch=0.3)
    it.box("top", (0, 13.2, 0), (26, 2.4, 10), block, ch=0.3)
    crate = wood(it, "light", "x", knots=1)
    it.box("crate", (-6, 6.5, 0), (7, 5, 6.6), crate, ch=0.2, paint={"layers": [{"id": "slats", "op": "stripes", "axis": "y", "period": 1.7, "width": 0.18, "shift": -1.6, "faces": ["sides"]}]})
    it.box("cratefill", (-6, 8.9, 0), (6, 0.4, 5.6), plain(it, "straw", P["straw"], tone=3.4, layers=[{"id": "straws", "op": "stripes", "axis": [1, 0, 0.6], "period": 0.5, "width": 0.4, "shift": -1.0}]))
    it.box("crate2", (4, 6, 0.6), (5, 4, 5), wood(it, "pale", "x", knots=1), ch=0.2, paint={"layers": [{"id": "stencil", "op": "rect", "rect": [0.3, 0.3, 0.7, 0.6], "shift": -1.3, "faces": ["front"]}]})
    it.cyl("can", (9, 4, 1), 1.3, 3.4, metal(it, "pewter"), sides=8)
    # the pegboard with its tools
    peg = it.ramp("wd_peg", 0xb89c74, n=6)
    W, H = face_px(24, 14, it.density)
    holes = grid(W, H)
    for y in range(2, H - 1, 4):
        for x in range(2, W - 1, 4):
            holes[y][x] = "o"
    pegst = it.style("peg", {"ramp": peg, "tone": 3.2, "rim": {"light_shift": 0.8, "dark_shift": -0.9}, "brush": {"flow": "x", "length": 2.0, "rough": 0.4},
                             "layers": [{"id": "mottle", "op": "noise", "scale": 2.0, "amount": 0.4}]})
    it.box("pegboard", (0, 21.4, -4.6), (24, 14, 0.8), pegst, paint={"stamps": [{"face": "front", "at": [0, 0], "art": rows(holes), "key": {"o": "wd_peg:0"}}]})
    for x in (-12.4, 12.4):
        it.box("upright", (x, 21.7, -4.6), (1.2, 14.6, 1.6), dark, ch=0.3)
    it.box("toprail", (0, 29.0, -4.6), (26, 1.2, 1.8), oak, ch=0.3)
    iron = metal(it, "iron")
    it.box("hammer", (-8, 21.4, -3.8), (0.9, 7, 0.8), wood(it, "light", "y", knots=0), ch=0.2)
    it.box("hammerhead", (-8, 25.2, -3.8), (3.6, 1.4, 1.0), iron, ch=0.2)
    saw = grid(21, 13)
    for y in range(13):
        for x in range(21):
            if y >= 11 and x % 2 == 0:
                saw[y][x] = "_"
    it.box("saw", (-2.2, 19.2, -3.95), (6, 3.6, 0.3), metal(it, "pewter"), paint={"stamps": [{"face": "front", "at": [0, 0], "art": rows(saw), "key": {}}]})
    it.box("sawhandle", (1.6, 19.6, -3.8), (2.4, 3.2, 0.8), wood(it, "cherry", "y", knots=0), ch=0.3)
    it.box("wrench", (5.6, 20.4, -3.8), (0.9, 6, 0.6), iron, ch=0.15)
    it.box("wrenchjaw", (5.6, 23.8, -3.8), (2.4, 1.4, 0.6), iron, ch=0.2)
    it.cyl("driver", (9.4, 19.0, -3.8), 0.3, 3.2, metal(it, "pewter"), sides=4)
    it.cyl("driverhandle", (9.4, 22.2, -3.8), 0.7, 2.8, soft(it, "handle", P["berry"]), sides=6)
    it.loft("string", [(0, 0, 0, 2.6), (0, 1.0, 0, 3.4), (0, 2.0, 0, 2.6)], plain(it, "twine", P["linen"], tone=3.4,
            layers=[{"id": "wind", "op": "stripes", "axis": "y", "period": 0.4, "width": 0.4, "shift": -1.0}]), sides=8, pivot=(-8.4, 15.6, -3.0), up=[0, 0, 1])
    # a vice on the corner and a small clock under repair, gears and shavings
    vice = metal(it, "vice", base=P["dusk"])
    it.box("vice", (10.6, 15.6, 3.2), (4, 2.4, 3), vice, ch=0.4)
    it.box("vicejaw", (10.6, 17.5, 3.2), (3.6, 1.4, 1.2), vice, ch=0.3)
    it.cyl("vicebar", (10.6, 16.0, 5.4), 0.3, 3.6, metal(it, "pewter"), sides=4, axis="x")
    it.cyl("clock", (-4, 14.4, 2), 2.4, 1.4, metal(it, "brass"), sides=12)
    face = grid(14, 14)
    for y in range(14):
        for x in range(14):
            d = math.hypot(x - 6.5, y - 6.5)
            if d < 5.6:
                face[y][x] = "f"
            if d < 5.6 and d > 4.4 and (int(math.atan2(y - 6.5, x - 6.5) / (math.pi / 6)) % 1 == 0) and (x + y) % 3 == 0:
                face[y][x] = "t"
    for k in range(4):
        face[6 - k][6] = "h"
        face[6][6 + k] = "h"
    it.cyl("clockface", (-4, 15.85, 2), 2.0, 0.05, plain(it, "dial", P["paper"], tone=3.8), sides=12,
           paint={"stamps": [{"face": "front", "at": "center", "art": rows(face), "key": {"f": "pa_dial:5", "t": "pa_ink:1", "h": "pa_ink:1"}}]})
    ink(it)
    gear = grid(12, 12)
    for y in range(12):
        for x in range(12):
            d = math.hypot(x - 5.5, y - 5.5)
            a = math.atan2(y - 5.5, x - 5.5)
            teeth = 5.6 if int((a + math.pi) / (2 * math.pi) * 16) % 2 == 0 else 4.4
            if d < teeth and d > 1.4:
                gear[y][x] = "#" if d < 3.4 or d > 3.9 else "d"
    gk = {"d": "br_brass:2"}
    it.card("gear", (2.4, 14.45, 2.6), metal(it, "brass"), art=rows(gear), size=(3.4, 3.4), plane="xz", key=gk)
    it.card("gear", (4.6, 14.45, 0.9), metal(it, "brass"), art=rows(gear), size=(2.2, 2.2), plane="xz", key=gk, rot=(0, 20, 0))
    shav = ["..##..", ".#..#.", "#....#", ".#..#.", "..##.."]
    sh = plain(it, "shaving", P["woodPale"], tone=3.8)
    for i in range(5):
        r = random.Random(i)
        it.card("shaving", (-9 + r.uniform(0, 7), 14.42, 1.5 + r.uniform(0, 3)), sh, art=shav, size=(1.6, 1.4), plane="xz", rot=(0, r.uniform(0, 180), 0))
    return it.spec()


# ------------------------------------------------------------------ storage
def folk_flower(W, H, cx, cy, petal="p", centre="c", leaf="l"):
    g = grid(W, H)
    for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0), (-1, -1), (1, -1), (-1, 1), (1, 1)):
        if abs(dx) + abs(dy) == 1:
            g[cy + dy * 2][cx + dx * 2] = petal
        g[cy + dy][cx + dx] = petal
    g[cy][cx] = centre
    for s in (-1, 1):
        g[cy + 2][cx + s * 3] = leaf
        g[cy + 3][cx + s * 4] = leaf
        g[cy + 3][cx + s * 3] = leaf
    return g


@item
def painted_dresser():
    it = Item("painted_dresser", "Painted Dresser", density=3.5)
    sage = painted(it, "sage", P["sage"], under="oak", grain="x")
    sagey = painted(it, "sage", P["sage"], under="oak", grain="y")
    brass = metal(it, "brass")
    walnut = wood(it, "walnut", "ry", knots=0)
    for x in (-9.6, 9.6):
        for z in (-3.6, 3.6):
            it.loft("foot", [(0, 0, 0, 2.0), (0, 0.8, 0, 2.8), (0, 1.6, 0, 2.2)], walnut, sides=8, pivot=(x, 0, z), up=[0, 0, 1])
    # scalloped apron
    W, H = face_px(22, 2, it.density)
    ap = grid(W, H)
    for x in range(W):
        u = (x % 18) - 8.5
        for y in range(H):
            if y >= H - 3 and abs(u) < 5 - (H - 1 - y) * 1.6:
                ap[y][x] = "_"
    it.box("apron", (0, 2.6, 0), (22, 2, 10), sage, paint={"stamps": [{"face": "front", "at": [0, 0], "art": rows(ap), "key": {}}]})
    it.box("carcass", (0, 11.2, 0), (21, 15.6, 10), sagey, ch=0.4)
    it.ramp("pa_folk_p", P["rose"], n=5)
    it.ramp("pa_folk_c", P["honey"], n=5)
    it.ramp("pa_folk_l", P["fern"], n=5)
    fk = {"p": "pa_folk_p:3", "c": "pa_folk_c:3", "l": "pa_folk_l:2", "w": "pa_folk_p:4"}
    for (x, y, w, h, pulls) in ((-5.3, 16.6, 10, 3.6, 1), (5.3, 16.6, 10, 3.6, 1), (0, 11.6, 20.6, 4.6, 2), (0, 6.4, 20.6, 4.6, 2)):
        Wd, Hd = face_px(w - 0.5, h - 0.5, it.density)
        g = grid(Wd, Hd)
        cy = Hd // 2 - 1
        for fx in ((int(Wd * 0.2), int(Wd * 0.8)) if w > 12 else (int(Wd * 0.22),)):
            fg = folk_flower(Wd, Hd, fx, cy)
            for yy in range(Hd):
                for xx in range(Wd):
                    if fg[yy][xx] != ".":
                        g[yy][xx] = fg[yy][xx]
        it.box("drawer", (x, y, 5.2), (w, h, 0.6), sage, ch=0.25,
               paint={"layers": [{"id": "panel", "op": "panel", "inset": 1, "shift": -1.3, "highlight": 0.8}], "stamps": [{"face": "front", "at": [0, 0], "art": rows(g), "key": fk}]})
        for s in ((-1, 1) if pulls == 2 else (0,)):
            px = x + s * w * 0.26 if pulls == 2 else x + w * 0.22
            it.loft("pull", [(-0.9, 0, 0, 0.5), (0, -0.5, 0, 0.5), (0.9, 0, 0, 0.5)], brass, sides=4, pivot=(px if pulls == 2 else x, y - 0.3, 5.7))
            it.box("pullplate", (px if pulls == 2 else x, y, 5.55), (2.4, 0.8, 0.2), brass)
    it.box("top", (0, 19.5, 0), (23, 1, 11), wood(it, "light", "x"), ch=0.35)
    # one drawer is a little open: a stripy sock is escaping
    it.box("sockcuff", (-6.2, 18.6, 5.9), (2.4, 0.6, 1.4), knit(it, "sock", P["terracotta"], stripe=P["cream"], every=1.0))
    it.box("sock", (-7.0, 16.4, 6.3), (1.4, 3.6, 0.8), "knit_sock", rot=(0, 0, 8))
    it.box("sockheel", (-7.4, 14.6, 6.4), (1.6, 1.2, 0.9), knit(it, "heel", P["cream"]))
    return it.spec()


@item
def library_case():
    it = Item("library_case", "Library Bookcase", density=3)
    c = wood(it, "walnut", "y")
    cx = wood(it, "walnut", "x")
    light = wood(it, "light", "x")
    it.box("plinth", (0, 1.0, 0), (22, 2, 9), cx, ch=0.3)
    for s in (-1, 1):
        it.box("side", (s * 10.2, 20.5, 0), (1.6, 37, 9), c, ch=0.3)
    it.box("back", (0, 20, -4.1), (19, 38, 0.8), plain(it, "backboard", P["woodDeep"], tone=2.6, layers=[
        {"id": "boards", "op": "stripes", "axis": "x", "period": 4.0, "width": 0.07, "shift": -1.2}, {"id": "mottle", "op": "noise", "scale": 2.0, "amount": 0.4}]))
    it.box("cornice", (0, 39.8, 0), (23, 1.6, 10), cx, ch=0.3)
    it.box("cornice2", (0, 41.2, 0.4), (24, 1.2, 10.6), cx, ch=0.4)
    dent = grid(70, 4)
    for x in range(70):
        if x % 3 == 0:
            dent[1][x] = "d"
            dent[2][x] = "d"
    it.box("dentil", (0, 38.4, 4.6), (20, 1.2, 0.6), cx, paint={"stamps": [{"face": "front", "at": [0, 0], "art": rows(dent), "key": {"d": "wd_walnut:1"}}]})
    for y in (11.4, 20.8, 30.2):
        it.box("shelf", (0, y - 0.5, 0), (18.8, 1, 8.4), light, ch=0.2)
        it.box("lip", (0, y - 0.5, 4.2), (18.8, 1.1, 0.4), cx)
    books(it, "book", -9.2, 4.6, 2.0, -0.2, 7.6, 6.4, seed=11)
    books(it, "book", -9.2, 9.0, 11.4, -0.2, 7.4, 6.6, seed=12, gap_at=1)
    books(it, "book", -2.0, 9.2, 20.8, -0.2, 7.6, 6.4, seed=13)
    books(it, "book", -9.2, 3.0, 30.2, -0.2, 7.6, 6.6, seed=14)
    # a lantern jar of honey-coloured light, an owl figurine, a trailing plant and a little globe
    it.cyl("candlestub", (7.0, 2.0, 0.6), 0.8, 1.6, wax(it), sides=8)
    it.cyl("glass_jar", (7.0, 2.0, 0.6), 1.6, 4.2, glass(it, "amber", 0xe9cf96), sides=8)
    it.cyl("jarlid", (7.0, 6.2, 0.6), 1.7, 0.6, metal(it, "copper"), sides=8)
    owl = soft(it, "owlfig", 0xc8ab84, pattern=[{"id": "chest", "op": "scales", "along": "x", "size": [0.7, 0.6], "shape": "round", "where": {}, "gradient": 0.8, "rim": -0.6, "shadow": -0.8}])
    it.loft("owl", [(0, 0, 0, 2.6), (0, 1.6, 0, 3.0), (0, 3.2, 0, 2.6), (0, 4.6, 0, 2.8), (0, 5.6, 0, 1.6)], owl, sides=8, pivot=(1.2, 11.4, 1.0), up=[0, 0, 1])
    dot = ink(it)
    for sx in (-1, 1):
        it.box("owleye", (1.2 + sx * 0.6, 15.4, 2.35), (0.4, 0.4, 0.2), dot)
        it.box("owlear", (1.2 + sx * 0.8, 17.0, 1.0), (0.5, 0.8, 0.5), owl, rot=(0, 0, sx * -15))
    it.box("owlbeak", (1.2, 14.9, 2.4), (0.4, 0.5, 0.3), plain(it, "beak", P["ochre"], tone=3))
    sprig(it, "plant", -6.0, 20.8, 1.0, P["dusk"], seed=3)
    ivy = leafy(it, "ivy", P["leaf"])
    it.loft("trail", [(0, 0, 0, 1.2), (-0.4, -2.6, 0.6, 1.4), (0.2, -5.4, 0.8, 1.2), (-0.2, -7.6, 0.6, 0.8)], ivy, sides=6, pivot=(-7.2, 21.4, 3.6), up=[0, 0, 1])
    globe = plain(it, "sea", P["lake"], tone=3.2, layers=[{"id": "land", "op": "patches", "scale": 1.0, "threshold": 0.55, "ramp": it.ramp("pa_land", P["sage"], n=6), "tone": 3.2, "bevel": True}])
    it.loft("globe", [(0, 0, 0, 1.0), (0, 0.8, 0, 3.4), (0, 2.0, 0, 4.2), (0, 3.2, 0, 3.4), (0, 4.0, 0, 1.0)], globe, sides=10, pivot=(6.6, 31.6, 0.6), up=[0, 0, 1])
    it.cyl("globestand", (6.6, 30.2, 0.6), 1.5, 1.4, metal(it, "brass"), sides=8)
    it.loft("meridian", [(0, 0, -2.3, 0.4), (0, 2.3, -1.4, 0.4), (0, 2.9, 0, 0.4), (0, 2.3, 1.4, 0.4), (0, 0, 2.3, 0.4)], metal(it, "brass"), sides=4, pivot=(6.6, 33.6, 0.6), rot=(0, 30, 0))
    it.box("topbook", (-1, 43.2, 0.6), (5, 1.6, 4), book_style(it, "top1", P["plum"]), rot=(0, 8, 0))
    it.box("topbook", (-0.6, 44.6, 0.6), (4.4, 1.2, 3.6), book_style(it, "top2", P["ochre"]), rot=(0, -6, 0))
    return it.spec()


@item
def toy_chest():
    it = Item("toy_chest", "Starry Toy Chest", density=3.5)
    navy = painted(it, "navy", P["dusk"], under="oak", grain="x", chips=0.18)
    navyz = painted(it, "navy", P["dusk"], under="oak", grain="z", chips=0.18)
    brass = metal(it, "brass")
    it.ramp("pa_star", P["honey"], n=5)

    def stars(W, H, seed):
        r = random.Random(seed)
        g = grid(W, H)
        for k in range(int(W * H / 70)):
            x, y = r.randrange(2, W - 2), r.randrange(2, H - 2)
            if any(g[y + dy][x + dx] != "." for dy in (-2, -1, 0, 1, 2) for dx in (-2, -1, 0, 1, 2)):
                continue
            big = r.random() < 0.45
            g[y][x] = "S"
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                g[y + dy][x + dx] = "s"
            if big:
                for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                    g[y + dy][x + dx] = "d"
        return rows(g)
    sk = {"S": "pa_star:4", "s": "pa_star:3", "d": "pa_star:1"}
    Wf, Hf = face_px(18, 9, it.density)
    Ws, Hs = face_px(9, 9, it.density)
    it.box("plinth", (0, 0.7, 0), (19, 1.4, 10), wood(it, "dark", "x"), ch=0.3)
    it.box("body", (0, 5.9, 0), (18, 9, 9), navy, ch=0.3, paint={"stamps": [{"faces": ["front", "back"], "at": [0, 0], "art": stars(Wf, Hf, 1), "key": sk},
                                                                          {"faces": ["left", "right"], "at": [0, 0], "art": stars(Ws, Hs, 2), "key": sk}]})
    for x in (-7, 7):
        it.box("strap", (x, 5.9, 4.6), (1.2, 9, 0.4), brass)
        it.box("strap", (x, 10.6, 0), (1.2, 0.4, 9.4), brass)
    it.box("lock", (0, 9.6, 4.7), (1.6, 2.0, 0.5), brass, ch=0.2)
    it.box("rim", (0, 10.8, 0), (19, 0.8, 10), wood(it, "pale", "x"), ch=0.2)
    # the lid, open on its hinges, star-painted inside too
    lid = it.bone("lidhinge", (0, 11.2, -4.8), rot=(-105, 0, 0))
    it.box("lid", (0, 0.8, 4.8), (19, 1.6, 10), navyz, parent=lid, ch=0.4, paint={"stamps": [{"faces": ["top", "bottom"], "at": [0, 0], "art": stars(66, 35, 3), "key": sk}]})
    it.box("lidstrap", (-7, 1.7, 4.8), (1.2, 0.3, 10.2), brass, parent=lid)
    it.box("lidstrap", (7, 1.7, 4.8), (1.2, 0.3, 10.2), brass, parent=lid)
    # teddy, a striped ball, a wooden sword and a little rocket peeking out
    from beds import plush
    plush(it, "ted", (-4.0, 8.0, 0.4), s=1.6, fur_col=0xc0915e)
    it.box("bow", (-4.0, 12.6, 2.6), (2.4, 0.9, 0.6), soft(it, "bow", P["berry"]))
    ball = soft(it, "ball", P["cream"], pattern=[{"id": "segs", "op": "stripes", "axis": "around", "period": 0.25, "width": 0.5, "ramp": it.ramp("cl_ballr", P["berry"], n=6), "tone": 3},
                                               {"id": "band", "op": "band", "axis": "path", "from": 0.45, "to": 0.55, "ramp": it.ramp("cl_ballb", P["lake"], n=6), "tone": 3}])
    it.loft("ball", [(0, 0, 0, 1.0), (0, 0.8, 0, 3.8), (0, 2.6, 0, 5.0), (0, 4.4, 0, 3.8), (0, 5.2, 0, 1.0)], ball, sides=10, pivot=(3.2, 8.4, 0.8), up=[0, 0, 1])
    it.box("sword", (6.4, 12.4, -1.2), (1.0, 9, 0.5), wood(it, "pale", "y", knots=0), rot=(0, 0, -18), ch=0.2)
    it.box("hilt", (5.5, 9.8, -1.2), (3.2, 0.9, 1.0), wood(it, "dark", "x", knots=0), rot=(0, 0, -18), ch=0.2)
    rk = plain(it, "rocket", P["cream"], tone=3.6, layers=[{"id": "window", "op": "spots", "centers": [[0, 3.6, 1.2, 0.6]], "ramp": it.ramp("pa_window", P["lake"], n=5), "tone": 3, "bevel": True}])
    it.loft("rocket", [(0, 0, 0, 2.0), (0, 2.0, 0, 2.6), (0, 4.6, 0, 2.2), (0, 6.2, 0, 0.6)], rk, sides=8, pivot=(0.6, 9.2, -2.6), rot=(10, 0, 8), up=[0, 0, 1])
    for k in range(3):
        a = k * 120
        it.box("fin", (0.6 + math.sin(math.radians(a)) * 1.2, 9.6, -2.6 + math.cos(math.radians(a)) * 1.2), (0.3, 1.8, 1.2), soft(it, "fin", P["berry"]), rot=(10, a, 8))
    return it.spec()


@item
def armoire():
    it = Item("armoire", "Grand Armoire", density=3)
    c = wood(it, "russet", "y", base=P["russet"])
    cx = wood(it, "russet", "x", base=P["russet"])
    gold = metal(it, "gold", tarnish=False)
    for x in (-9.6, 9.6):
        for z in (-3.8, 3.8):
            it.loft("foot", [(0, 0, 0, 2.0), (0, 1.0, 0, 2.8), (0, 2.4, 0, 2.4)], wood(it, "dark", "ry", knots=0), sides=8, pivot=(x, 0, z), up=[0, 0, 1])
    it.box("base", (0, 4.7, 0), (22, 4.6, 10.6), cx, ch=0.4)
    drawer(it, "drawer", (0, 4.7, 5.4), 19, 3.4, cx, pull=gold, pulls=2)
    for s in (-1, 1):
        it.box("side", (s * 10.2, 22.5, 0), (1.6, 31, 10.6), c, ch=0.3, paint={"layers": [{"id": "panel", "op": "panel", "inset": 3, "shift": -1.2, "faces": ["left", "right"]}]})
    it.box("back", (0, 22.5, -4.8), (19, 31, 1), plain(it, "inner", P["woodDeep"], tone=2.2, light=0.3))
    it.box("floor", (0, 7.4, 0), (19, 0.6, 9.6), cx)

    def door(mirror):
        W, H = face_px(9.6, 30.4, it.density)
        g = grid(W, H)
        for y in range(H):
            for x in range(W):
                u = x - (W - 1) / 2
                top = 9 + (abs(u) ** 2) / 10
                inside = 3 <= x <= W - 4 and 4 <= y <= H - 5 and y >= top
                edge = inside and (x in (3, W - 4) or y in (H - 5,) or y < top + 1.0)
                if edge:
                    g[y][x] = "e"
                elif inside and mirror:
                    k = (x - y * 0.55) % 22
                    g[y][x] = "w" if 4 < k < 6 or 9 < k < 9.8 else ("m" if y < H * 0.5 else "n")
                elif inside:
                    g[y][x] = "p"
        return rows(g)
    mir = it.ramp("gl_mirror", 0xa9c3c6, n=6)
    dk = {"e": "wd_russet:1", "w": "gl_mirror:5", "m": "gl_mirror:3", "n": "gl_mirror:2", "p": "wd_russet:5"}
    it.box("door", (4.8, 22.2, 4.9), (9.6, 30.4, 0.8), c, ch=0.2, paint={"stamps": [{"face": "front", "at": [0, 0], "art": door(True), "key": dk}]})
    it.box("handle", (1.2, 21, 5.5), (0.8, 2.6, 0.6), gold, ch=0.2)
    # the other door swung open on its hinge
    hinge = it.bone("hinge", (-9.6, 7.0, 5.3), rot=(0, -62, 0))
    it.box("door", (4.8, 15.2, -0.4), (9.6, 30.4, 0.8), c, parent=hinge, ch=0.2,
           paint={"stamps": [{"face": "front", "at": [0, 0], "art": door(False), "key": dk}, {"face": "back", "at": [0, 0], "art": door(False), "key": dk}]})
    it.box("handle", (8.4, 14, 0.3), (0.8, 2.6, 0.6), gold, parent=hinge, ch=0.2)
    # inside: a shelf with a hat, a hanging coat and a striped scarf, and boots on the floor
    it.box("ishelf", (-5, 28.4, 0), (9, 0.8, 9), wood(it, "light", "x"))
    hat = soft(it, "hat", P["slate"])
    it.cyl("hatbrim", (-5, 28.8, 0.4), 3.2, 0.4, hat, sides=10)
    it.loft("hatcrown", [(0, 0, 0, 3.6), (0, 2.6, 0, 3.2), (0, 3.2, 0, 2.4)], hat, sides=10, pivot=(-5, 29.2, 0.4), up=[0, 0, 1],
            paint={"layers": [{"id": "band", "op": "band", "axis": "path", "from": 0.0, "to": 0.3, "ramp": it.ramp("cl_hatband", P["berry"], n=6), "tone": 3}]})
    it.cyl("rod", (-5, 25.6, 0), 0.3, 9, metal(it, "brass"), sides=6, axis="x")
    coat = fabric(it, "coat", P["ochre"], tone=3.2)
    it.box("hanger", (-6, 24.8, 0), (4.4, 0.5, 0.5), wood(it, "light", "x", knots=0))
    it.taper("coat", (-6, 18.6, 0), (5, 12, 2.8), coat, front=[1.25, 1.0], rot=(-90, 0, 0), paint={"layers": [{"id": "buttons", "op": "spots", "centers": [[0, 1.5, z, 0.35] for z in (-3, -1, 1, 3)], "shift": -1.8, "faces": ["top"]}]})
    it.box("scarf", (-2.4, 18.6, 1.2), (2.2, 13, 0.8), knit(it, "scarf", P["fern"], stripe=P["cream"], every=2.0), rot=(0, 0, 3))
    boot = soft(it, "boot", P["umber"], tone=3)
    for x in (-6.4, -3.2):
        it.box("boot", (x, 10.4, 0.4), (2.2, 5, 2.2), boot, ch=0.4)
        it.box("toe", (x, 8.6, 2.2), (2.2, 1.6, 2.4), boot, ch=0.5)
    # cornice with a carved oak-leaf crest and a gilded acorn
    it.box("cornice", (0, 38.8, 0), (23, 1.6, 11.4), cx, ch=0.3)
    it.box("cornice2", (0, 40.3, 0), (24.6, 1.4, 12.4), cx, ch=0.5)
    W, H = face_px(16, 7, it.density)
    cr = grid(W, H)
    for y in range(H):
        for x in range(W):
            u, v = (x + 0.5) / W - 0.5, 1 - (y + 0.5) / H
            if v < 1 - abs(u) * 2.3 + math.sin(u * 30) * 0.08:
                cr[y][x] = "#" if (int(abs(u) * 14) % 2 == 0) else "c"
                if math.hypot(u * 4, v - 0.45) < 0.24:
                    cr[y][x] = "g"
    it.box("crest", (0, 44.5, 5.0), (16, 7, 0.8), cx, paint={"stamps": [{"faces": ["front", "back"], "at": [0, 0], "art": rows([r.replace(".", "_") for r in rows(cr)]),
                                                                       "key": {"#": "wd_russet:4", "c": "wd_russet:2", "g": "br_gold:6"}}]})
    return it.spec()


@item
def cubby_shelf():
    it = Item("cubby_shelf", "Cubby Shelf", density=3)
    birch = wood(it, "birch", "y")
    birchx = wood(it, "birch", "x")
    it.box("bottom", (0, 0.7, 0), (25, 1.4, 10), birchx, ch=0.3)
    it.box("top", (0, 24.3, 0), (25, 1.4, 10), birchx, ch=0.3)
    it.box("back", (0, 12.5, -4.6), (24, 22.2, 0.8), plain(it, "backboard", 0xb49a76, tone=3.0, layers=[{"id": "ply", "op": "stripes", "axis": "y", "period": 1.0, "width": 0.3, "shift": -0.5}]))
    for x in (-12, -4, 4, 12):
        it.box("upright", (x, 12.5, 0), (1.2, 22.2, 10), birch, ch=0.2)
    for y in (8.2, 15.8):
        it.box("shelf", (0, y, 0), (24, 1.2, 10), birchx, ch=0.2)
    cell = lambda i, j: (-8 + i * 8, 1.4 + j * 7.6)
    for (i, j, col) in ((0, 0, P["rose"]), (2, 0, P["lake"]), (1, 2, P["sage"])):
        x, y = cell(i, j)
        it.box("basket", (x, y + 2.6, 0.6), (6.4, 5.2, 7.6), wicker(it, "bk", 0xc49a62), ch=0.3)
        it.box("basketrim", (x, y + 5.4, 0.6), (6.8, 0.8, 8.0), wicker(it, "bkrim", 0xa8794a, size=(1.0, 0.8)), ch=0.2)
        it.box("liner", (x, y + 5.0, 4.5), (5.2, 2.0, 0.4), fabric(it, f"liner{col:x}", col, tone=3.2), rot=(-12, 0, 0),
               paint={"layers": [{"id": "gingham", "op": "stripes", "axis": "x", "period": 1.0, "width": 0.5, "shift": -0.8}]})
        it.box("label", (x, y + 2.6, 4.45), (2.4, 1.2, 0.2), plain(it, "label", P["paper"], tone=3.6, layers=[{"id": "txt", "op": "stripes", "axis": "y", "period": 0.6, "width": 0.3, "shift": -1.2}]))
    x, y = cell(1, 0)
    for k, col in enumerate((P["berry"], P["honey"], P["dusk"])):
        it.box("blanket", (x, y + 0.85 + k * 1.7, 0.4), (6.4, 1.7, 7), knit(it, f"bl{k}", col, stripe=P["cream"] if k == 2 else None, every=1.0), ch=0.4)
    x, y = cell(0, 1)
    books(it, "book", x - 3.2, x + 3.4, y + 0.6, 0.2, 6.6, 6.0, seed=21)
    x, y = cell(2, 1)
    sprig(it, "plant", x - 0.4, y + 0.6, 0.6, P["cream"], seed=5, s=1.2)
    x, y = cell(1, 1)
    it.cyl("glass_jar", (x - 1.4, y + 0.6, 1), 1.5, 4.0, glass(it), sides=8)
    btn = soft(it, "buttons", P["terracotta"], pattern=[{"id": "b", "op": "spots", "count": 10, "radius": [0.3, 0.45], "ramp": it.ramp("cl_btn2", P["lake"], n=5), "tone": 3}])
    it.cyl("buttons", (x - 1.4, y + 0.8, 1), 1.2, 2.6, btn, sides=8)
    it.cyl("jarlid", (x - 1.4, y + 4.6, 1), 1.6, 0.6, metal(it, "copper"), sides=8)
    it.loft("cup", [(0, 0, 0, 2.0), (0, 1.8, 0, 2.6)], glaze(it, "cup", P["dusk"]), sides=8, pivot=(x + 2.2, y + 0.6, 1), caps=(True, False), up=[0, 0, 1], double_sided=True)
    x, y = cell(0, 2)
    it.loft("vase", [(0, 0, 0, 2.6), (0, 1.6, 0, 4.0), (0, 3.4, 0, 2.4), (0, 4.4, 0, 1.6), (0, 5.0, 0, 2.2)], glaze(it, "vase", P["cream"], band=P["dusk"], bands=[(-0.2, 0.0), (0.2, 0.3)]),
            sides=10, pivot=(x, y + 0.6, 0.6), up=[0, 0, 1], caps=(True, False), double_sided=True)
    stem = plain(it, "stalk", P["fern"], tone=3)
    for k, (dx, h, col) in enumerate(((-0.4, 3.6, P["honey"]), (0.5, 2.8, P["blush"]))):
        it.cyl("stalk", (x + dx, y + 5.4, 0.6), 0.15, h, stem, sides=4)
        it.loft("bloom", [(0, 0, 0, 0.8), (0, 0.4, 0, 1.6), (0, 0.8, 0, 0.6)], soft(it, f"bloom{col:x}", col), sides=6, pivot=(x + dx, y + 5.4 + h, 0.6), up=[0, 0, 1])
    x, y = cell(2, 2)
    it.box("papers", (x - 1, y + 3.6, 0), (3, 6, 4), plain(it, "papers", P["oat"], tone=3.6, layers=[{"id": "sheets", "op": "stripes", "axis": "z", "period": 0.4, "width": 0.3, "shift": -0.9, "faces": ["top", "left", "right"]}]), rot=(0, 0, 6))
    it.loft("duck", [(0, 0, 0, (2.4, 2.0)), (0, 1.0, 0, (2.6, 2.2)), (0, 1.8, 0, (1.8, 1.6))], soft(it, "duck", P["honey"]), sides=8, pivot=(x + 2.0, y + 0.6, 1.0), up=[0, 0, 1])
    it.loft("duckhead", [(0, 0, 0, 1.4), (0, 0.8, 0, 1.6), (0, 1.4, 0, 0.8)], "soft_duck", sides=8, pivot=(x + 2.4, y + 2.2, 1.2), up=[0, 0, 1])
    it.box("duckbill", (x + 2.4, y + 2.8, 2.1), (0.8, 0.4, 0.8), plain(it, "bill", P["terracotta"], tone=3))
    return it.spec()


@item
def apothecary():
    it = Item("apothecary", "Apothecary Cabinet", density=3.5)
    c = wood(it, "cab", "y", base=0x7a5640)
    cx = wood(it, "dark", "x")
    brass = metal(it, "brass")
    it.box("base", (0, 1.0, 0), (15, 2, 9), cx, ch=0.4)
    it.box("body", (0, 13.5, 0), (14, 23, 8), c, ch=0.3)
    it.ramp("pa_label", P["paper"], n=5)
    ink(it)
    r = random.Random(4)
    for i in range(4):
        for j in range(5):
            W, H = face_px(3.1, 4.1, it.density)
            g = grid(W, H)
            # a little paper label held in a brass frame, with a scribbled herb name
            for y in range(H - 6, H - 2):
                for x in range(1, W - 1):
                    g[y][x] = "L" if 0 < y - (H - 6) < 3 and 1 < x < W - 2 else "f"
            for x in range(2, W - 2):
                if r.random() < 0.55:
                    g[H - 4][x] = "i"
            if i == 3 and j == 4:
                g[H - 4][W // 2] = "x"
            it.box("drawer", (-4.95 + i * 3.3, 4.3 + j * 4.4, 4.2), (3.1, 4.1, 0.6), wood(it, "drawer", "x", base=0x936a4c, knots=0), ch=0.2,
                   paint={"layers": [{"id": "panel", "op": "panel", "inset": 1, "shift": -1.2, "highlight": 0.7}],
                          "stamps": [{"face": "front", "at": [0, 0], "art": rows(g), "key": {"L": "pa_label:3", "f": "br_brass:5", "i": "pa_ink:1", "x": "pa_ink:0"}}]})
            knob(it, "knob", -4.95 + i * 3.3, 3.3 + j * 4.4, 4.5, brass, r=0.4)
    it.box("top", (0, 25.7, 0), (16, 1.4, 10), cx, ch=0.4)
    # mortar and pestle, jars of dried herbs, and a little brass balance
    mort = glaze(it, "mortar", P["pebble"])
    it.loft("mortar", [(0, 0, 0, 2.6), (0, 0.6, 0, 3.6), (0, 2.2, 0, 3.8)], mort, sides=10, pivot=(-4.8, 26.4, 1.0), caps=(True, False), up=[0, 0, 1], double_sided=True)
    it.cyl("herbs", (-4.8, 27.9, 1.0), 1.5, 0.3, leafy(it, "herb", P["fern"]), sides=10)
    it.cyl("pestle", (-4.4, 28.6, 1.0), 0.45, 4.2, mort, sides=6, rot=(0, 0, -24))
    for (x, h, col) in ((-0.6, 5.0, P["lilac"]), (2.4, 4.0, P["honey"])):
        it.cyl("jarfill", (x, 26.6, -2.0), 1.1, h * 0.7, soft(it, f"dried{col:x}", col, pattern=[{"id": "bits", "op": "spots", "count": 10, "radius": [0.2, 0.35], "shift": -1.2}]), sides=8)
        it.cyl("glass_jar", (x, 26.4, -2.0), 1.4, h, glass(it), sides=8)
        it.cyl("cork", (x, 26.4 + h, -2.0), 0.9, 0.8, plain(it, "cork", P["straw"], tone=3.2), sides=8)
        it.box("jarlabel", (x, 26.4 + h * 0.45, -0.62), (1.6, 1.0, 0.1), plain(it, "jarlabel", P["paper"], tone=3.6))
    it.box("scalebase", (4.6, 26.7, 1.6), (3, 0.6, 2), brass, ch=0.2)
    it.cyl("scalepost", (4.6, 27.0, 1.6), 0.3, 4.0, brass, sides=6)
    it.box("beam", (4.6, 31.0, 1.6), (5, 0.4, 0.4), brass)
    for s in (-1, 1):
        it.cyl("pan", (4.6 + s * 2.2, 29.2, 1.6), 0.9, 0.3, brass, sides=8)
        it.box("chain", (4.6 + s * 2.2, 30.1, 1.6), (0.15, 1.8, 0.15), brass)
    return it.spec()
