"""The Frostlight series (gacha prizes): the most special-looking things in the hollow. Christmas tree with twinkling
lights, gingerbread cottage, snow globe, sleigh bed, nutcracker, candy cane, cocoa, wreath, poinsettia, presents,
stockings, snowflake rug and icicle lights."""
import math

from lib import Spec, bezier, circle, cycle_keys, cloth, glass, glaze, glow, hsh, knit, leafy, metal, paper, plain, rotz, snowy, wood
from pix import Pix, star_pts

ITEMS = {}


def item(f):
    ITEMS[f.__name__] = f
    return f


def flat(r, tone=4.0, light=0.6):
    return {"ramp": r, "tone": tone, "light": light, "brush": {"off": True}, "rim": {"light": 0, "dark": 0}}


def candy(base="holly", tone=4.2, period=1.4, width=0.45, stripe="snow", stripe_tone=6.0):
    """Peppermint: a helix of stripes round a tube (zigzag over two turns makes a seamless spiral)."""
    return {"ramp": stripe, "tone": stripe_tone, "rim": {"light_shift": 1.2, "dark_shift": -0.9}, "brush": {"off": True},
            "layers": [
                {"id": "stripe", "op": "stripes", "axis": "path", "period": period, "width": width, "zigzag": [period, 2],
                 "zig_axis": "around", "ramp": base, "tone": tone},
                {"id": "thin", "op": "stripes", "axis": "path", "period": period, "width": 0.08, "phase": period * 0.62,
                 "zigzag": [period, 2], "zig_axis": "around", "ramp": "sage", "tone": 3.6},
                {"id": "gloss", "op": "gloss", "dash": True, "length": 3, "shift": 1.6, "density": 0.8, "post": True}]}


def bauble(r):
    return glaze(r, tone=4.2, dip=None, crackle=False, layers=[
        {"id": "band", "op": "band", "axis": "y", "from": -0.15, "to": 0.15, "ramp": "gold", "tone": 5.0},
        {"id": "dots", "op": "spots", "count": 3, "radius": [0.15, 0.2], "ramp": "snow", "tone": 6}])


def sparkle_art(n=7):
    p = Pix(n, n)
    c = n // 2
    for k in range(n):
        p.set(c, k, "a" if abs(k - c) > 1 else "b")
        p.set(k, c, "a" if abs(k - c) > 1 else "b")
    p.set(c - 1, c - 1, "a"), p.set(c + 1, c + 1, "a"), p.set(c - 1, c + 1, "a"), p.set(c + 1, c - 1, "a")
    p.set(c, c, "b")
    return p.rows


def star3d(S, id, centre, r, ramp="star", parent=None, depth=0.9):
    """A five-pointed star with real depth: five pointed rays round a little core, glowing."""
    S.bone(id, centre, parent=parent)
    for k in range(5):
        a = 90 + k * 72
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        c = (centre[0] + ca * r * 0.5, centre[1] + sa * r * 0.5, centre[2])
        S.taper(f"glow_{id}{k}", (depth, r * 0.62, r), c, glow(ramp, tone=3.6), parent=id, rot=(0, 90, a),
                front_scale=[0.15, 0.05], back_scale=[1.0, 1.0])
    S.ball(f"glow_{id}c", r * 0.32, centre, glow(ramp, tone=4.4), parent=id, sides=8, rings=4, squash=(1, 1, depth * 0.9))


# ====================================================================== the Frostlight fir

@item
def xmas_tree():
    S = Spec("xmas_tree", "Frostlight Fir", density=2.2, tris=4200,
             desc="A snow-dusted fir in a hooped wooden tub on a knitted skirt: glass baubles, a gold tinsel spiral, "
                  "candy canes, gingerbread ornaments, strings of fairy lights that twinkle in turn, and a glowing star "
                  "on top that slowly turns.")
    # tub and knitted tree skirt
    S.lathe("skirt", [(13.6, 0), (13.8, 0.5), (12.0, 0.8), (6.0, 1.0)], (0, 0, 0), knit("holly", tone=3.8, layers=[
        {"id": "band", "op": "stripes", "axis": "x", "period": 3.0, "width": 0.18, "ramp": "cream", "tone": 5}]),
        sides=18, subdiv=0)
    tub = wood("oak", tone=4.4, grain="y", layers=[
        {"id": "staves", "op": "stripes", "axis": "around", "period": 0.0833, "width": 0.08, "shift": -1.4}])
    S.lathe("tub", [(4.6, 0.8), (5.4, 3.0), (5.8, 5.6)], (0, 0, 0), tub, sides=12, subdiv=0)
    for k, y in enumerate((1.8, 4.8)):
        S.lathe(f"hoop{k}", [(4.95 + k * 0.7, y), (5.1 + k * 0.7, y + 0.6)], (0, 0, 0), metal("brass", tone=4.2), sides=12,
                caps=(False, False), subdiv=0)
    S.paint("tub", layers=[{"id": "soil", "op": "spots", "centers": [[0, 5.6, 0, 5.2]], "ramp": "snow", "tone": 4.6,
                            "faces": ["end"]}])
    S.cyl("trunk", 1.2, 6.0, (0, 5.0, 0), plain("bark", tone=3.6, noise=0.6), sides=7)
    # the fir: a dark inner cone for body, then whorls of drooping painted branch cards (bushy, not a stack of cones)
    tiers = [(12.6, 9.0, 6.4), (11.2, 13.4, 6.0), (9.8, 17.6, 5.6), (8.2, 21.6, 5.2), (6.6, 25.4, 4.8), (5.0, 29.0, 4.4),
             (3.4, 32.4, 4.0), (1.8, 35.4, 3.6)]
    S.lathe("body", [(6.8, 8.4), (5.4, 14.0), (3.8, 22.0), (2.0, 30.0), (0.2, 38.0)], (0, 0, 0),
            leafy("pine", tone=2.6), sides=10, caps=(True, False), subdiv=0)

    def branch_art(x, y, cols, rows):
        u, v = (x + 0.5) / cols, (y + 0.5) / rows * 2 - 1        # u along the branch, v across it
        half = 0.95 * (1 - u ** 1.6) ** 0.5 * (0.75 + 0.25 * math.sin(u * 3.1))
        rib = abs(v) < 0.08 and u < 0.92
        side = abs(abs(v) - (u * 0.0 + ((u * 7.0) % 1.0) * 0.9)) < 0.1 and u > 0.08
        if abs(v) > half + 0.12 * math.sin(x * 2.1 + y * 1.3):
            return "."
        if rib:
            return "d"
        n = hsh(x // 2, y // 2, 7)
        tip = u > 0.84 or abs(v) > half - 0.12
        if tip and v < 0 and n > 0.55:
            return "s"
        if side:
            return "d"
        if tip:
            return "c" if n > 0.4 else "b"
        return "a" if (x + y) % 3 else ("b" if n > 0.5 else "d")

    n = 0
    for k, (r, y, h) in enumerate(tiers):
        cnt = max(6, 13 - k)
        for j in range(cnt):
            a = j * 360 / cnt + k * 23 + (hsh(k, j) - 0.5) * 18
            L = r * (1.02 + (hsh(j, k, 3) - 0.5) * 0.2)
            S.bone(f"bj{n}", (0, y + 0.4, 0), rot=(0, -a, 0))
            droop = 22 + k * 3 + (hsh(k, j, 5) - 0.5) * 10
            S.pcard(f"branch{n}", L, max(2.6, L * 0.8), branch_art,
                    {"a": "pine:4", "b": "pine:5", "c": "pine:6", "d": "pine:2", "w": "bark:3", "s": "snow:6"},
                    S.at(f"bj{n}", (L / 2 * math.cos(math.radians(droop)), -L / 2 * math.sin(math.radians(droop)), 0)),
                    style=flat("pine", light=0.8), parent=f"bj{n}", plane="xz", rot=(0, 0, -droop),
                    pivot=S.at(f"bj{n}", (0, 0, 0)))
            n += 1
        # a second, upturned layer between the whorls fills the gaps
        for j in range(max(3, cnt - 3)):
            a = (j + 0.5) * 360 / max(3, cnt - 3) + k * 23
            L = r * 0.8
            S.bone(f"bu{n}", (0, y + h * 0.45, 0), rot=(0, -a, 0))
            S.pcard(f"branch{n}", L, max(2.2, L * 0.6), branch_art,
                    {"a": "pine:5", "b": "pine:4", "c": "pine:6", "d": "pine:3", "w": "bark:3", "s": "snow:6"},
                    S.at(f"bu{n}", (L / 2 * 0.94, -L / 2 * 0.34, 0)), style=flat("pine", light=0.8), parent=f"bu{n}",
                    plane="xz", rot=(0, 0, -20), pivot=S.at(f"bu{n}", (0, 0, 0)))
            n += 1
    # gold tinsel spiral
    helix = []
    for i in range(60):
        t = i / 59
        y = 9.6 + t * 24.0
        rr = (12.4 - t * 9.6) * 0.86
        a = t * math.pi * 2 * 3.2
        helix.append((math.cos(a) * rr, y, math.sin(a) * rr))
    S.tube("tinsel", helix, 0.32, metal("gold", tone=5.0, layers=[
        {"id": "twist", "op": "stripes", "axis": "path", "period": 0.6, "width": 0.4, "shift": 1.4}]), sides=4, subdiv=0)
    # baubles
    cols = ["holly", "gold", "lake", "cream", "holly", "sage", "gold", "plum", "lake", "holly", "gold", "cream",
            "holly", "lake", "gold", "sage"]
    k = 0
    for ti, (r, y, h) in enumerate(tiers[:6]):
        for j in range(3 if ti < 4 else 2):
            a = j * 360 / (3 if ti < 4 else 2) + ti * 51 + 20
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            br = 1.45 - ti * 0.1
            S.ball(f"bauble{k}", br, (ca * (r * 0.8), y - 1.6, sa * (r * 0.8)), bauble(cols[k % len(cols)]), sides=8, rings=5)
            S.box(f"cap{k}", (0.5, 0.4, 0.5), (ca * (r * 0.8), y - 1.6 + br + 0.1, sa * (r * 0.8)), metal("gold", tone=5))
            k += 1
    # candy canes and gingerbread ornaments
    for j, (ti, a) in enumerate([(1, 200), (3, 320), (2, 80)]):
        r, y, h = tiers[ti]
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        x0, z0 = ca * (r * 0.95), sa * (r * 0.95)
        S.tube(f"cane{j}", [(x0, y - 3.4, z0), (x0, y - 0.6, z0), (x0 + ca * 0.5, y + 0.1, z0 + sa * 0.5),
                            (x0 + ca * 1.1, y - 0.5, z0 + sa * 1.1)], 0.3, candy(period=0.8), sides=5)
    gb = Pix(11, 13)
    gb.poly([(2, 4.5), (9, 4.5), (11, 7), (9, 8), (8.5, 13), (6.5, 13), (5.5, 10), (4.5, 13), (2.5, 13), (2, 8), (0, 7)], "g")
    gb.disc(5.5, 2.6, 2.4, "g")
    gb.set(4.5, 2.2, "k"), gb.set(6.5, 2.2, "k")
    gb.line(4.5, 3.6, 6.5, 3.6, "i")
    gb.set(5.5, 6, "b"), gb.set(5.5, 8, "b")
    gb.line(0.5, 7, 2, 6.5, "i"), gb.line(9, 6.5, 10.5, 7, "i")
    for j, (ti, a) in enumerate([(2, 250), (4, 130)]):
        r, y, h = tiers[ti]
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        S.card(f"ginger{j}", gb.rows, (ca * (r * 0.95 + 0.3), y - 2.0, sa * (r * 0.95 + 0.3)), flat("ginger"),
               rot=(0, 90 - a, 0), key={"g": "ginger:4", "k": "soot:0", "i": "icing:4", "b": "holly:4"})
    # fairy lights: three strings that twinkle in turn
    tracks = []
    li = 0
    for g in range(3):
        S.bone(f"lights{g}", (0, 0, 0))
    for i in range(24):
        t = (i + 0.5) / 24
        y = 10.2 + t * 23.5
        rr = 12.0 - t * 9.4
        a = t * math.pi * 2 * 3.6 + 1.3
        g = i % 3
        nm = f"glow_bulb{i}"
        S.ball(nm, 0.62, (math.cos(a) * rr * 0.92, y, math.sin(a) * rr * 0.92), glow(["bulb", "ember", "cold"][g], tone=4.2),
               sides=5, rings=2)
        tracks.append({"part": nm, "channel": "scale", "keys": cycle_keys(
            [(0, [0, 0, 0]), (0.3, [0.45, 0.45, 0.45]), (0.9, [-0.35, -0.35, -0.35]), (1.6, [0, 0, 0]), (3.0, [0, 0, 0])],
            3.0, g * 1.0 + (i // 3) * 0.13)})
        li += 1
    # sparkles that wink on the snow
    for j, (x, y, z) in enumerate([(-6.0, 15.0, 8.0), (5.0, 22.0, 5.4), (-2.0, 28.4, 3.6), (8.0, 11.0, 4.0)]):
        nm = f"glow_spark{j}"
        S.card(nm, sparkle_art(7), (x, y, z), glow("cold", tone=5), key={"a": "cold:5", "b": "cold:6"}, rot=(0, 30, 0))
        o = j * 0.7
        tracks.append({"part": nm, "channel": "scale", "keys": [[0, [-1, -1, -1]], [o, [-1, -1, -1]], [o + 0.3, [0.3, 0.3, 0.3]],
                                                                [o + 0.7, [-1, -1, -1]], [3.0, [-1, -1, -1]]]})
    # the star on top, slowly turning
    star3d(S, "star", (0, 41.6, 0), 3.4)
    S.cyl("star_stem", 0.3, 2.2, (0, 38.6, 0), metal("gold", tone=4.6), sides=5)
    tracks.append({"part": "star", "keys": [[0, 0], [3.0, 360]], "axis": "y", "ease": "linear"})
    for tr in tracks:
        for kk in tr.get("keys", []):
            kk[0] = kk[0] * 2  # six-second loop
    S.anim("idle", 6.0, tracks)
    return S


# ====================================================================== gingerbread cottage

@item
def gingerbread_house():
    S = Spec("gingerbread_house", "Gingerbread Cottage", density=2.8, tris=3600,
             desc="A gingerbread cottage on a snowy cake board: piped icing on every edge, a peppermint-striped roof "
                  "with icicle drips, gumdrops, a candy-cane porch, a cookie door, glowing sugar-glass windows and a "
                  "chimney, with a gingerbread owl-man and two sugared firs in the garden.")
    S.lathe("board", [(11.0, 0), (11.2, 0.6), (11.0, 0.9)], (0, 0, 1.6), plain("cream", tone=4.0, layers=[
        {"id": "doily", "op": "stripes", "axis": "around", "period": 0.0417, "width": 0.5, "shift": 1.0, "faces": ["sides"]}]),
        sides=18, squash=1.0, subdiv=0)
    S.lathe("snowfield", [(10.4, 0.9), (10.0, 1.4), (6.0, 1.7)], (0, 0, 1.6), snowy(), sides=16, subdiv=0)
    ginger = plain("ginger", tone=4.0, noise=0.7, layers=[
        {"id": "pores", "op": "spots", "count": 30, "radius": [0.12, 0.2], "ramp": "ginger", "tone": 2.4},
        {"id": "bake", "op": "gradient", "axis": "y", "amount": -0.5},
        {"id": "pipe", "op": "panel", "inset": 1, "shift": 3.4, "highlight": 0, "shadow": 1}])
    S.box("walls", (14.0, 9.0, 11.0), (0, 6.2, 0), ginger)
    S.paint("walls", layers=[{"id": "icing_drip", "op": "drip", "ramp": "icing", "tone": 5.2, "depth": 0.02, "length": 0.18,
                              "width": 0.5, "scale": 1.0, "faces": ["sides"]},
                             {"id": "icing_dots", "op": "stripes", "axis": "x", "period": 1.4, "width": 0.3,
                              "range": [0.86, 0.96], "ramp": "icing", "tone": 5, "faces": ["front", "back"]}])
    # peppermint roof with icing drips and a snowy ridge
    roof = {"ramp": "holly", "tone": 4.4, "rim": {"light_shift": 1.0, "dark_shift": -1.0}, "layers": [
        {"id": "stripes", "op": "stripes", "axis": [0, 0.3, 1], "period": 2.2, "width": 0.45, "ramp": "icing", "tone": 4.8},
        {"id": "tiles", "op": "scales", "shape": "round", "along": "z", "size": [1.1, 1.0], "gap": 0.6, "highlight": 0.6,
         "shadow": -0.8},
        {"id": "frost", "op": "patches", "scale": 1.6, "threshold": 0.72, "ramp": "icing", "tone": 5.4, "faces": ["top"],
         "bevel": {"shadow": 1, "highlight": 0, "shadow_ramp": "holly", "shadow_tone": 2.0}}]}
    for k, s in enumerate((-1, 1)):
        S.box(f"roof{k}", (9.6, 0.9, 13.6), (s * 3.9, 13.7, 0), roof, rot=(0, 0, -s * 38), chamfer=0.2)
    gable = Pix(42, 16)
    gable.poly([(0, 16), (21, 0), (42, 16)], "g")
    gable.map(lambda x, y, c: ("G" if c == "g" and hsh(x, y) > 0.86 else c))
    gable.disc(21, 10, 3.0, "w")
    gable.ring(21, 10, 3.3, "i", 1.0)
    gable.line(18, 10, 24, 10, "i"), gable.line(21, 7, 21, 13, "i")
    for x in range(2, 41, 3):
        y = 16 - abs(x - 21) * 16 / 21
        gable.set(x, y, "i")
    for k, z in enumerate((5.52, -5.52)):
        S.card(f"gable{k}", gable.rows, (0, 10.7 + 2.9, z), flat("ginger"), rot=(0, 180 * k, 0),
               key={"g": "ginger:4", "G": "ginger:3", "w": "flame:4", "i": "icing:5"})
    S.box("chimney", (2.2, 4.4, 2.2), (3.6, 16.4, -2.2), ginger)
    S.box("chimney_snow", (2.6, 0.7, 2.6), (3.6, 18.8, -2.2), snowy())
    # windows (warm glow) with icing frames, a cookie door with a gumdrop knob
    win = Pix(10, 10)
    win.rect(0, 0, 9, 9, "i")
    win.rect(1, 1, 8, 8, "w")
    win.rect(1, 1, 8, 3, "W")
    win.line(4.5, 1, 4.5, 8, "i"), win.line(1, 4.5, 8, 4.5, "i")
    for k, (x, z, ry) in enumerate([(-4.2, 5.52, 0), (4.2, 5.52, 0), (7.02, 0, 90), (-7.02, 0, -90)]):
        S.card(f"glow_win{k}", win.rows, (x, 6.6, z), glow("flame", tone=4.0), rot=(0, ry, 0),
               key={"i": "icing:5", "w": "flame:4", "W": "flame:5"})
    door = Pix(9, 14)
    door.rect(0, 4, 8, 13, "d")
    door.disc(4.5, 4.5, 4.5, "d")
    door.map(lambda x, y, c: ("D" if c == "d" and x % 3 == 1 else c))
    door.disc(6.6, 8.5, 0.9, "k")
    S.card("door", door.rows, (0, 4.2, 5.56), flat("ginger"), key={"d": "ginger:2", "D": "ginger:3", "k": "holly:5"})
    # gumdrops along the eaves and a candy-cane porch
    gum = ["holly", "sage", "honey", "lilac", "lake"]
    for k in range(7):
        for s in (-1, 1):
            x = s * 7.6
            z = -5.4 + k * 1.8
            S.lathe(f"gum{k}{s}", [(0.55, 0), (0.5, 0.45), (0.15, 0.8)], (x, 10.3, z), plain(gum[(k + (s > 0)) % 5], tone=4.6,
                                                                                         gloss=True, layers=[
                {"id": "sugar", "op": "speckle", "density": 0.25, "shift": 1.4}]), sides=6, subdiv=0)
    for k, x in enumerate((-2.2, 2.2)):
        S.tube(f"cane{k}", [(x, 1.6, 7.6), (x, 7.0, 7.6), (x + 0.4 * (1 if k else -1), 7.9, 7.6),
                            (x + 1.1 * (1 if k else -1), 7.3, 7.6)], 0.42, candy(period=0.9), sides=6)
    S.box("step", (3.8, 0.7, 1.6), (0, 2.0, 6.4), ginger, chamfer=0.15)
    # a gingerbread owl-man and two sugared firs in the garden
    om = Pix(12, 15)
    om.disc(6, 7.5, 5.5, "g", ry=6.5)
    om.poly([(1.5, 3), (3, 0), (4.5, 2.5)], "g"), om.poly([(10.5, 3), (9, 0), (7.5, 2.5)], "g")
    om.disc(4, 5, 1.5, "i"), om.disc(8, 5, 1.5, "i")
    om.set(4, 5, "k"), om.set(8, 5, "k")
    om.set(6, 7, "b"), om.set(6, 8, "b")
    for y in (10, 12):
        om.line(4, y, 8, y, "i")
    om.set(4, 14, "g"), om.set(8, 14, "g")
    S.card("owlman", om.rows, (-6.4, 4.4, 8.4), flat("ginger"), rot=(0, 20, 0),
           key={"g": "ginger:4", "i": "icing:5", "k": "soot:0", "b": "holly:4"})
    for k, (x, z, h) in enumerate([(7.6, 7.6, 6.0), (-8.6, 4.0, 4.8)]):
        S.lathe(f"fir{k}", [(2.2, 0), (1.0, h * 0.45), (1.6, h * 0.45), (0.1, h)], (x, 1.6, z), leafy("pine", tone=4.6, snow=True),
                sides=8, subdiv=0)
    return S


# ====================================================================== snow globe

@item
def snow_globe():
    S = Spec("snow_globe", "Hollow Snow Globe", density=3.2, tris=3000,
             desc="A glass globe on a turned walnut and brass pedestal: inside, a tiny hollow oak with a lit door and "
                  "window, a sugared fir and a toadstool on a snowy mound, while snow swirls round it forever.")
    wd = wood("walnut", tone=4.4, grain="x")
    S.lathe("base", [(6.6, 0), (7.0, 0.6), (6.8, 1.6), (6.0, 3.4), (5.0, 4.2), (4.6, 4.6)], (0, 0, 0), wd, sides=16, subdiv=0)
    for k, (r, y) in enumerate([(7.05, 0.6), (5.1, 4.2)]):
        S.lathe(f"band{k}", [(r, y), (r, y + 0.5)], (0, 0, 0), metal("brass", tone=4.8), sides=16, caps=(False, False), subdiv=0)
    S.box("plaque", (3.6, 1.2, 0.3), (0, 2.2, 6.4), metal("brass", tone=4.8, layers=[
        {"id": "text", "op": "stripes", "axis": "x", "period": 0.5, "width": 0.5, "range": [-0.7, 0.7], "shift": -1.6,
         "faces": ["front"]}]), rot=(-24, 0, 0))
    cy = 10.6
    S.lathe("mound", [(4.8, 4.6), (4.6, 5.4), (3.0, 6.3), (0.5, 6.6)], (0, 0, 0), snowy(), sides=14)
    # the tiny hollow oak
    bark = plain("bark", tone=3.8, noise=0.6, layers=[
        {"id": "fur", "op": "stripes", "axis": [1, 0, 0.8], "period": 0.5, "width": 0.3, "shift": -0.8, "wobble": 0.5}])
    S.lathe("oak", [(1.8, 5.6), (1.4, 7.0), (1.2, 9.4), (1.5, 10.4)], (-0.6, 0, -0.8), bark, sides=9)
    for k, (x, y, z, r) in enumerate([(-0.6, 12.0, -0.8, 2.6), (-2.2, 11.0, -0.2, 1.7), (1.0, 11.4, -1.2, 1.8),
                                      (-0.4, 13.4, -1.4, 1.6)]):
        S.ball(f"crown{k}", r, (x, y, z), leafy("leaf", tone=3.8, snow=True), sides=8, rings=5)
    S.card("glow_door", [".ww.", "wwww", "wwww", "wwWw", "wwww"], (-0.6, 6.6, 0.95), glow("flame"),
           key={"w": "flame:4", "W": "flame:2"})
    S.card("glow_window", ["ww", "ww"], (0.2, 8.8, 0.62), glow("flame"), key={"w": "flame:5"}, rot=(0, 20, 0))
    S.lathe("fir", [(1.4, 6.0), (0.6, 7.6), (1.0, 7.6), (0.1, 9.6)], (2.6, 0, 0.6), leafy("pine", tone=4.6, snow=True),
            sides=7, subdiv=0)
    S.cyl("stalk", 0.3, 0.8, (-2.4, 6.0, 2.0), plain("cream", tone=4.6), sides=5)
    S.lathe("toad", [(0.9, 0), (0.75, 0.4), (0.1, 0.7)], (-2.4, 6.8, 2.0), plain("holly", tone=4.4, gloss=True, layers=[
        {"id": "dots", "op": "spots", "count": 4, "radius": [0.12, 0.16], "ramp": "cream", "tone": 6}]), sides=7, subdiv=0)
    # swirling snow: three flurries orbiting at different speeds and heights
    tracks = []
    for g in range(3):
        S.bone(f"flurry{g}", (0, cy, 0))
        for j in range(7):
            a = j * 2 * math.pi / 7 + g
            r = 2.2 + hsh(g, j) * 2.6
            y = cy - 3.0 + hsh(j, g, 3) * 7.0
            S.box(f"flake{g}_{j}", (0.35, 0.35, 0.35), (math.cos(a) * r, y, math.sin(a) * r), plain("snow", tone=6.4, noise=0),
                  parent=f"flurry{g}", rot=(45, 45, 0))
        tracks.append({"part": f"flurry{g}", "keys": [[0, 0], [6.0, 360 * (1 if g % 2 == 0 else -1)]], "axis": "y",
                       "ease": "linear"})
        tracks.append({"part": f"flurry{g}", "channel": "position", "osc": {"axis": "y", "amp": 0.7, "cycles": 2, "phase": g / 3}})
    S.ball("glass_globe", 6.2, (0, cy, 0), glass("glass"), sides=14, rings=9, double_sided=True)
    S.anim("idle", 6.0, tracks)
    return S


# ====================================================================== sleigh bed

@item
def sleigh_bed():
    S = Spec("sleigh_bed", "Sleigh Bed", density=2.2, tris=3600,
             desc="A berry-lacquered sleigh bed with gold scrollwork on rolled head and foot boards, curling brass "
                  "runners, a strap of sleigh bells, a deep cream mattress, a plaid quilt, a cable-knit throw and two "
                  "plump pillows.")
    lacq = plain("holly", tone=3.8, gloss=True, layers=[
        {"id": "scroll", "op": "stripes", "axis": "y", "period": 2.4, "width": 0.1, "zigzag": [0.8, 3.0], "zig_axis": "x",
         "ramp": "gold", "tone": 5.0, "faces": ["front", "back", "left", "right"]},
        {"id": "edge", "op": "panel", "inset": 2, "shift": 2.4, "highlight": 0, "shadow": 0},
        {"id": "chips", "op": "wear", "width": 1, "density": 0.1, "ramp": "walnut", "tone": 3}])
    W = 21.0  # bed width along z

    def board(prefix, xs, ys, out_x, roll_r):
        """A curved board from a list of (x, y) points (segments), rolled outward at the top."""
        pts = list(zip(xs, ys))
        for k, (a, b) in enumerate(zip(pts, pts[1:])):
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            L = math.hypot(b[0] - a[0], b[1] - a[1]) + 0.35
            ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
            S.box(f"{prefix}{k}", (L, 1.2, W), (mx, my, 0), lacq, rot=(0, 0, ang), chamfer=0.3)
        S.tube(f"{prefix}_roll", [(out_x, ys[-1] - roll_r * 0.3, -W / 2 - 0.4), (out_x, ys[-1] - roll_r * 0.3, W / 2 + 0.4)],
               roll_r, plain("holly", tone=4.0, gloss=True, layers=[
                   {"id": "gilt", "op": "stripes", "axis": "path", "period": 2.0, "width": 0.12, "ramp": "gold", "tone": 5}]),
               sides=10)
        for s in (-1, 1):
            S.lathe(f"{prefix}_boss{s}", [(roll_r + 0.2, 0), (roll_r * 0.6, 0.6), (0.3, 0.9)], (out_x, ys[-1] - roll_r * 0.3,
                                                                                                s * (W / 2 + 0.4)),
                    metal("gold", tone=4.8), rot=(s * 90, 0, 0), sides=10, subdiv=0)

    board("head", [-17.6, -18.2, -18.4, -18.0, -19.2], [3.0, 9.0, 15.0, 20.0, 23.2], -19.8, 1.9)
    board("foot", [17.4, 17.8, 18.0, 19.4], [3.0, 7.6, 11.4, 13.6], 19.8, 1.6)
    for k, s in enumerate((-1, 1)):
        S.box(f"rail{k}", (35.0, 4.4, 1.2), (0, 5.4, s * (W / 2 - 0.6)), lacq, chamfer=0.3)
    # brass runners with curled tips
    for k, s in enumerate((-1, 1)):
        z = s * (W / 2 - 1.6)
        run = [(-17.0, 0.6, z), (-8.0, 0.4, z), (8.0, 0.4, z), (17.0, 0.6, z), (20.2, 1.8, z), (21.0, 4.0, z), (20.0, 5.2, z),
               (19.0, 4.4, z)]
        S.tube(f"runner{k}", run, 0.55, metal("gold", tone=4.6), sides=6)
        for j, x in enumerate((-12.0, 0.0, 12.0)):
            S.box(f"strut{k}{j}", (0.8, 3.2, 0.8), (x, 2.2, z), metal("gold", tone=4.2))
    # mattress, quilt, throw and pillows
    S.box("mattress", (34.0, 3.6, 19.4), (0, 8.8, 0), cloth("cream", tone=4.6, weave=0.5, layers=[
        {"id": "tufts", "op": "spots", "count": 20, "radius": [0.2, 0.3], "ramp": "linen", "tone": 3, "faces": ["up"]}]),
        chamfer=0.9)
    plaid = cloth("holly", tone=3.6, weave=0.45, layers=[
        {"id": "plaid_a", "op": "stripes", "axis": "x", "period": 3.0, "width": 0.25, "ramp": "pine", "tone": 3.4},
        {"id": "plaid_b", "op": "stripes", "axis": "z", "period": 3.0, "width": 0.25, "ramp": "pine", "tone": 3.4},
        {"id": "plaid_c", "op": "stripes", "axis": "x", "period": 3.0, "width": 0.06, "phase": 1.6, "ramp": "honey", "tone": 5},
        {"id": "plaid_d", "op": "stripes", "axis": "z", "period": 3.0, "width": 0.06, "phase": 1.6, "ramp": "honey", "tone": 5}])
    S.box("quilt", (24.0, 1.4, 20.6), (4.6, 11.0, 0), plaid, chamfer=0.6)
    S.box("quilt_fold", (3.0, 1.2, 20.8), (-6.6, 11.9, 0), cloth("cream", tone=4.8, weave=0.4), chamfer=0.5)
    S.box("throw", (6.0, 1.2, 21.2), (12.0, 12.0, 0), knit("cream", tone=4.4), chamfer=0.5)
    for k, z in enumerate((-4.8, 4.8)):
        S.box(f"pillow{k}", (5.6, 2.8, 8.4), (-13.2, 12.0, z), cloth("linen", tone=5.0, weave=0.4, layers=[
            {"id": "piping", "op": "panel", "inset": 1, "shift": -0.9, "highlight": 0, "shadow": 0}]), rot=(0, 0, -14),
            chamfer=1.2)
    # a strap of sleigh bells along the foot board
    S.tube("strap", [(18.9, 10.6, -9.0), (19.4, 9.6, -3.0), (19.4, 9.6, 3.0), (18.9, 10.6, 9.0)], (0.25, 0.5),
           plain("russet", tone=3.4), sides=4)
    for j in range(5):
        z = -6.0 + j * 3.0
        S.ball(f"bell{j}", 0.75, (19.8, 9.0 + abs(z) * 0.06, z), metal("gold", tone=4.6, layers=[
            {"id": "slot", "op": "band", "axis": "y", "from": -0.3, "to": -0.1, "ramp": "brass", "tone": 1.5}]), sides=8, rings=4)
    return S


# ====================================================================== nutcracker

@item
def nutcracker():
    S = Spec("nutcracker", "Captain Nutcracker", density=3.0, tris=3000,
             desc="A carved and painted nutcracker captain on a turned plinth: berry tunic with gold braid and buttons, "
                  "cream breeches, black boots, gold epaulettes, a tall black shako with a gold badge and plume, a "
                  "white beard and moustache, and a jaw that clacks.")
    wd = wood("walnut", tone=4.4, grain="x")
    S.lathe("plinth", [(5.6, 0), (6.0, 0.6), (5.6, 1.6), (4.6, 2.2)], (0, 0, 0), wd, sides=14, subdiv=0)
    S.lathe("plinth_band", [(5.9, 0.6), (5.9, 1.1)], (0, 0, 0), metal("gold", tone=4.6), sides=14, caps=(False, False), subdiv=0)
    black = plain("soot", tone=2.4, gloss=True)
    cream = plain("cream", tone=4.4, noise=0.3)
    red = plain("holly", tone=3.8, gloss=True)
    gold = metal("gold", tone=4.8)
    for k, x in enumerate((-1.6, 1.6)):
        S.lathe(f"boot{k}", [(1.4, 2.2), (1.3, 5.4), (1.5, 6.8)], (x, 0, 0.2), black, sides=8, subdiv=0)
        S.box(f"toe{k}", (2.2, 1.2, 2.0), (x, 2.8, 1.2), black, chamfer=0.4)
        S.lathe(f"leg{k}", [(1.3, 6.6), (1.25, 10.6), (1.6, 12.4)], (x, 0, 0), cream, sides=8, subdiv=0)
    S.lathe("tunic", [(3.0, 11.6), (3.3, 13.0), (2.9, 15.2), (2.8, 18.6), (3.1, 20.6), (2.4, 21.4)], (0, 0, 0), plain("holly",
            tone=3.8, gloss=True, layers=[
                {"id": "buttons", "op": "spots", "centers": [[0, 14.4, 2.9, 0.3], [0, 16.2, 2.85, 0.3], [0, 18.0, 2.85, 0.3],
                                                             [0, 19.6, 2.95, 0.3]], "ramp": "gold", "tone": 6, "roughness": 0},
                {"id": "braid", "op": "stripes", "axis": "y", "period": 1.6, "width": 0.16, "range": [-0.4, 0.75],
                 "ramp": "gold", "tone": 5, "faces": ["sides"]},
                {"id": "skirt", "op": "band", "axis": "y", "from": -1.0, "to": -0.78, "ramp": "gold", "tone": 4.4}]),
            sides=12)
    S.lathe("belt", [(3.05, 13.4), (3.05, 14.2)], (0, 0, 0), black, sides=12, caps=(False, False), subdiv=0)
    S.box("buckle", (1.2, 1.0, 0.3), (0, 13.8, 3.05), gold)
    for k, s in enumerate((-1, 1)):
        S.box(f"epaulette{k}", (2.2, 0.8, 2.4), (s * 3.0, 20.6, 0), gold, chamfer=0.25)
        S.card(f"fringe{k}", ["a.a.a.a", "a.a.a.a", "a.a.a.a"], (s * 3.0, 19.8, 1.25), flat("gold"), key={"a": "gold:5"})
        S.tube(f"arm{k}", [(s * 3.2, 20.0, 0), (s * 3.9, 17.2, 0.4), (s * 4.0, 14.6, 1.2)], [1.05, 1.0, 0.95], red, sides=8)
        S.lathe(f"cuff{k}", [(1.0, 0), (1.0, 0.8)], (s * 4.0, 14.2, 1.3), gold, sides=8, subdiv=0, rot=(20, 0, 0))
        S.ball(f"hand{k}", 0.85, (s * 4.0, 13.4, 1.5), cream, sides=7, rings=4)
    S.tube("sword", [(4.0, 13.4, 1.6), (4.1, 21.0, 2.6)], [0.25, 0.08], metal("silver", tone=5, tarnish=False), sides=4)
    S.box("hilt", (1.8, 0.35, 0.4), (4.0, 14.6, 1.7), gold)
    # head with painted face, jaw bone that clacks, beard, moustache
    skin = plain("blush", tone=4.6, noise=0.2, layers=[
        {"id": "cheeks", "op": "spots", "centers": [[-1.3, 1.5, 1.85, 0.55], [1.3, 1.5, 1.85, 0.55]], "ramp": "rose",
         "tone": 4.2, "roughness": 0.1},
        {"id": "eyes", "op": "spots", "centers": [[-0.85, 2.3, 2.1, 0.3], [0.85, 2.3, 2.1, 0.3]], "ramp": "soot", "tone": 0.4,
         "roughness": 0},
        {"id": "brows", "op": "spots", "centers": [[-0.85, 3.0, 2.05, 0.35], [0.85, 3.0, 2.05, 0.35]], "ramp": "cream",
         "tone": 6, "stretch": [1.6, 0.6, 1], "roughness": 0}])
    S.lathe("head", [(2.1, 0), (2.3, 1.6), (2.2, 3.6), (1.9, 4.2)], (0, 21.6, 0), skin, sides=12)
    S.ball("nose", 0.5, (0, 23.3, 2.3), plain("rose", tone=4.4), sides=6, rings=3)
    S.card("moustache", ["aa....aa", "aaaaaaaa", ".aaaaaa.", "..a..a.."], (0, 22.8, 2.35), flat("cream"),
           key={"a": "cream:6"})
    S.bone("jaw", (0, 22.2, 0.4))
    S.box("jawbox", (3.2, 1.4, 2.6), (0, 21.8, 1.2), skin, parent="jaw", chamfer=0.3)
    beard = Pix(14, 12)
    beard.poly([(0, 0), (14, 0), (12, 6), (7, 12), (2, 6)], "a")
    beard.map(lambda x, y, c: ("b" if c == "a" and (x + y) % 3 == 0 else c))
    beard.rect(4, 0, 10, 1, "m")
    S.card("beard", beard.rows, (0, 20.6, 2.55), flat("cream"), parent="jaw", key={"a": "cream:6", "b": "cream:4", "m": "berry:2"})
    S.lathe("shako", [(2.3, 25.4), (2.4, 26.6), (2.6, 30.4), (2.75, 31.2)], (0, 0, 0), plain("soot", tone=2.2, gloss=True,
            layers=[{"id": "band", "op": "band", "axis": "y", "from": -1.0, "to": -0.72, "ramp": "gold", "tone": 4.8},
                    {"id": "top", "op": "band", "axis": "y", "from": 0.82, "to": 1.0, "ramp": "gold", "tone": 4.4}]), sides=12)
    S.lathe("visor", [(2.6, 25.2), (2.9, 25.5)], (0, 0, 0.5), black, sides=12, subdiv=0)
    badge = Pix(9, 9)
    badge.star(4.5, 4.7, 4.4, "g", inner=0.5)
    badge.disc(4.5, 4.7, 1.4, "r")
    S.card("badge", badge.rows, (0, 28.2, 2.62), flat("gold"), key={"g": "gold:5", "r": "holly:4"})
    plume = Pix(6, 14)
    for y in range(14):
        for x in range(6):
            if abs(x - 3 + math.sin(y * 0.5)) < 1.5 + y * 0.08:
                plume.set(x, y, "a" if (x + y) % 3 else "b")
    S.card("plume", plume.rows, (0, 33.8, 0.6), flat("cream"), key={"a": "cream:6", "b": "cream:4"}, rot=(0, 30, 0))
    S.card("plume2", plume.rows, (0, 33.8, 0.6), flat("cream"), key={"a": "cream:6", "b": "cream:4"}, rot=(0, 120, 0))
    S.anim("idle", 4.0, [
        {"part": "jaw", "keys": [[0, 0], [2.6, 0], [2.75, 16], [2.9, 0], [3.05, 16], [3.2, 0], [4.0, 0]], "axis": "x"},
        {"part": "plume", "osc": {"axis": "z", "amp": 4, "cycles": 2}},
        {"part": "plume2", "osc": {"axis": "z", "amp": 4, "cycles": 2, "phase": 0.3}},
    ])
    return S


# ====================================================================== candy cane

@item
def candy_cane():
    S = Spec("candy_cane", "Giant Candy Cane", density=2.8,
             desc="A giant peppermint candy cane, taller than Pip, planted in a little snow drift and tied with a "
                  "velvet bow with long tails.")
    S.lathe("drift", [(5.4, 0), (5.0, 0.8), (3.4, 1.8), (1.2, 2.4)], (0, 0, 0), snowy(), sides=12)
    pts = [(-1.0, 0.8, 0), (-1.0, 12.0, 0), (-1.0, 21.0, 0), (-0.6, 25.0, 0), (1.2, 27.6, 0), (3.6, 28.2, 0), (5.8, 27.2, 0),
           (6.6, 24.8, 0), (6.4, 22.6, 0)]
    S.tube("cane", pts, 1.65, candy(period=2.6, width=0.42), sides=10)
    # velvet bow at the neck of the hook
    vel = plain("holly", tone=3.6, layers=[{"id": "nap", "op": "noise", "scale": 0.5, "amount": 0.7},
                                           {"id": "sheen", "op": "gloss", "dash": True, "length": 2, "shift": 1.4,
                                            "density": 0.6, "post": True}])
    for k, s in enumerate((-1, 1)):
        S.tube(f"loop{k}", [(-1.0, 21.4, 1.4), (s * 2.6 - 1.0, 23.2, 1.9), (s * 3.6 - 1.0, 21.6, 1.8), (s * 2.2 - 1.0, 20.4, 1.7),
                             (-1.0, 21.2, 1.5)], [(0.9, 0.35)] * 5, vel, sides=6)
        S.tube(f"tail{k}", [(-1.0, 21.0, 1.6), (s * 1.2 - 1.0, 18.6, 2.0), (s * 1.6 - 1.0, 15.6, 1.8)], [(0.8, 0.3), (0.7, 0.3),
                                                                                                         (0.75, 0.3)],
               vel, sides=4)
    S.ball("knot", 0.95, (-1.0, 21.3, 1.7), vel, sides=8, rings=4)
    return S


# ====================================================================== cocoa

@item
def cocoa_mug():
    S = Spec("cocoa_mug", "Marshmallow Cocoa", density=3.6,
             desc="A big cream mug painted with dusk-blue snowflakes on a knitted coaster: cocoa, a swirl of whipped "
                  "cream with cocoa dust, marshmallows, a peppermint stirrer and curls of steam rising forever.")
    S.lathe("coaster", [(4.6, 0), (4.6, 0.5)], (0, 0, 0), knit("sage", tone=4.0), sides=14, subdiv=0)
    mug = glaze("cream", tone=4.8, dip="ochre", dip_to=-0.9, crackle=False, layers=[
        {"id": "flakes", "op": "spots", "count": 9, "radius": [0.4, 0.6], "ramp": "dusk", "tone": 3.8, "roughness": 0.8,
         "rough_scale": 0.3},
        {"id": "dots", "op": "spots", "count": 14, "radius": [0.12, 0.16], "ramp": "dusk", "tone": 4.6},
        {"id": "rimline", "op": "band", "axis": "y", "from": 0.86, "to": 0.96, "ramp": "dusk", "tone": 4}])
    S.lathe("mug", [(2.6, 0.5), (3.1, 0.9), (3.25, 3.0), (3.35, 6.6), (3.5, 7.6)], (0, 0, 0), mug, sides=14)
    S.paint("mug", layers=[{"id": "cocoa", "op": "spots", "centers": [[0, 7.6, 0, 3.0]], "ramp": "umber" if False else "russet",
                            "tone": 2.0, "faces": ["end"]}])
    S.tube("handle", [(3.2, 6.6, 0), (4.9, 6.4, 0), (5.3, 4.4, 0), (4.6, 2.6, 0), (3.2, 2.4, 0)], 0.55, glaze("cream", tone=4.8,
           crackle=False), sides=6)
    cream = plain("cream", tone=5.0, noise=0.4, layers=[
        {"id": "swirl", "op": "stripes", "axis": "path", "period": 0.8, "width": 0.3, "zigzag": [0.8, 2], "zig_axis": "around",
         "shift": -0.9},
        {"id": "dust", "op": "spots", "count": 12, "radius": [0.1, 0.18], "ramp": "russet", "tone": 3, "faces": ["up"]}])
    S.lathe("cream", [(2.9, 7.4), (3.0, 8.2), (2.4, 9.2), (1.6, 10.0), (0.8, 10.8), (0.2, 11.4)], (0.2, 0, -0.1), cream, sides=12)
    for k, (x, z, yaw, c) in enumerate([(1.8, 1.4, 20, "cream"), (-1.6, 1.2, -30, "blush"), (0.4, -1.8, 60, "cream"),
                                        (-0.6, 0.2, 10, "blush")]):
        S.box(f"mallow{k}", (1.3, 1.1, 1.3), (x, 8.6 + (k == 3) * 1.6, z), plain(c, tone=5.0, noise=0.3), rot=(10, yaw, 8),
              chamfer=0.35)
    S.tube("stirrer", [(-1.8, 6.0, -1.0), (-2.6, 10.6, -1.6), (-2.8, 12.2, -1.8), (-2.2, 12.9, -1.8), (-1.6, 12.4, -1.8)],
           0.35, candy(period=0.9), sides=6)
    # steam curls
    steam = Pix(6, 18)
    for y in range(18):
        x = 3 + math.sin(y * 0.55) * 1.8
        steam.set(x, y, "a")
        steam.set(x + 1, y, "b" if y % 3 else "a")
    tracks = []
    for k in range(3):
        nm = f"steam{k}"
        S.card(nm, steam.rows, (-0.8 + k * 0.9, 13.4, 0.4 - k * 0.4), flat("mist", light=0.3), rot=(0, k * 55, 0),
               key={"a": "mist:6", "b": "mist:5"})
        o = k * 1.0
        tracks.append({"part": nm, "channel": "position", "ease": "linear",
                       "keys": cycle_keys([(0, [0, -1.5, 0]), (2.9, [0.4, 2.2, 0]), (2.92, [0, -1.5, 0]), (3.0, [0, -1.5, 0])],
                                          3.0, o)})
        tracks.append({"part": nm, "channel": "scale",
                       "keys": cycle_keys([(0, [-0.9, -0.9, -0.9]), (0.8, [0, 0, 0]), (1.9, [0, 0, 0]),
                                           (2.9, [-0.9, -0.9, -0.9]), (3.0, [-0.9, -0.9, -0.9])], 3.0, o)})
    S.anim("idle", 3.0, tracks)
    return S


# ====================================================================== wreath

@item
def wreath():
    S = Spec("wreath", "Holly Wreath", density=2.8, tris=3000, wall=True,
             desc="A full fir wreath dusted with snow: holly sprigs with glossy berries, pine cones, a velvet berry bow "
                  "with long tails and two little brass bells that swing.")
    cy = 10.0
    S.tube("ring", circle((0, cy, 1.6), 7.4, 16, "xy"), [2.3] * 18, leafy("pine", tone=4.0, snow=True), sides=8,
           caps=(False, False))
    tip = Pix(9, 5)
    tip.poly([(0, 2.5), (8.5, 0.3), (9, 2.5), (8.5, 4.7)], "a")
    tip.line(0, 2.5, 8, 2.5, "b")
    tip.set(7, 1, "s"), tip.set(8, 1, "s")
    for j in range(24):
        a = j * 15 + (j % 2) * 6
        rr = 7.4 + (2.0 if j % 2 else -2.0)
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        S.card(f"needles{j}", tip.rows, (ca * rr, cy + sa * rr, 2.4 + (j % 3) * 0.5), flat("pine"),
               rot=(0, 0, a + (90 if j % 2 else -90) * 0.4), key={"a": "pine:4", "b": "pine:2", "s": "snow:6"})
    holly = Pix(12, 7)
    holly.poly([(0, 3.5), (2, 1), (4, 2.2), (6, 0), (8, 2.2), (10, 1), (12, 3.5), (10, 6), (8, 4.8), (6, 7), (4, 4.8), (2, 6)], "a")
    holly.line(0, 3.5, 12, 3.5, "b")
    for j, a in enumerate((20, 140, 250)):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        x, y = ca * 7.6, cy + sa * 7.6
        for m in range(3):
            S.card(f"holly{j}_{m}", holly.rows, (x + math.cos(m * 2.1) * 1.3, y + math.sin(m * 2.1) * 1.3, 3.9),
                   flat("pine"), rot=(0, 0, m * 120 + a), key={"a": "leaf:3", "b": "leaf:5"})
        for m in range(4):
            S.ball(f"berry{j}_{m}", 0.55, (x + (m % 2 - 0.5) * 1.0, y + (m // 2 - 0.5) * 0.9, 4.4), plain("holly", tone=4.4,
                   gloss=True), sides=6, rings=3)
    cone = {"ramp": "walnut", "tone": 4.2, "layers": [{"id": "sc", "op": "scales", "shape": "round", "along": "x",
                                                       "size": [0.7, 0.6], "gap": 0.7, "highlight": 1.0, "shadow": -1.2}]}
    for j, a in enumerate((60, 200, 320)):
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        S.lathe(f"cone{j}", [(0.3, 0), (1.0, 0.6), (1.1, 1.6), (0.4, 2.6)], (ca * 7.2, cy + sa * 7.2, 3.6), cone,
                rot=(70, 0, a), sides=7)
    # velvet bow at the bottom and the bells
    vel = plain("holly", tone=3.6, layers=[{"id": "nap", "op": "noise", "scale": 0.5, "amount": 0.7},
                                           {"id": "sheen", "op": "gloss", "dash": True, "length": 2, "shift": 1.4,
                                            "density": 0.6, "post": True}])
    by = cy - 7.6
    for k, s in enumerate((-1, 1)):
        S.tube(f"bowloop{k}", [(0, by, 4.4), (s * 2.8, by + 1.8, 4.6), (s * 4.0, by + 0.2, 4.4), (s * 2.6, by - 1.2, 4.4),
                               (0, by, 4.4)], [(1.0, 0.4)] * 5, vel, sides=6)
        S.tube(f"bowtail{k}", [(0, by, 4.4), (s * 1.6, by - 3.0, 4.6), (s * 2.6, by - 6.6, 4.2), (s * 2.0, by - 8.4, 4.0)],
               [(0.9, 0.3)] * 4, vel, sides=4, up=[0, 0, 1])
    S.ball("bowknot", 1.0, (0, by, 4.7), vel, sides=8, rings=4)
    tracks = []
    for k, x in enumerate((-0.8, 0.9)):
        S.bone(f"bellj{k}", (x, by - 0.8, 4.2))
        S.box(f"bellcord{k}", (0.15, 1.8, 0.15), (x, by - 1.7, 4.2), plain("honey", tone=4, noise=0), parent=f"bellj{k}")
        S.lathe(f"bell{k}", [(0.3, 0), (0.55, -0.4), (0.7, -1.4), (1.1, -2.0)], (x, by - 2.5, 4.2), metal("gold", tone=4.6),
                parent=f"bellj{k}", sides=8, caps=(True, True))
        tracks.append({"part": f"bellj{k}", "osc": {"axis": "z", "amp": 9, "cycles": 2, "phase": k * 0.35}})
    S.tube("hanger", [(0, cy + 9.0, 1.0), (0, cy + 12.0, 0.4)], (0.6, 0.2), vel, sides=4)
    S.anim("idle", 3.0, tracks)
    return S


# ====================================================================== poinsettia

@item
def poinsettia():
    S = Spec("poinsettia", "Frostlight Poinsettia", density=3.2,
             desc="Crimson star-leaves frosted at the tips over deep green leaves, little golden flower buds at each "
                  "heart, in a pot wrapped in crinkled gold foil with a berry bow.")
    foil = metal("gold", tone=4.4, tarnish=False, layers=[
        {"id": "crinkle", "op": "stripes", "axis": "around", "period": 0.06, "width": 0.4, "shift": 1.2, "wobble": 0.3},
        {"id": "creases", "op": "cracks", "scale": 1.2, "width": 0.08, "threshold": 0.8, "shift": -1.2}])
    S.lathe("pot", [(2.6, 0), (3.2, 2.8), (3.9, 4.8), (4.3, 5.4), (3.8, 5.6)], (0, 0, 0), foil, sides=12)
    S.paint("pot", layers=[{"id": "soil", "op": "spots", "centers": [[0, 5.6, 0, 3.6]], "ramp": "bark", "tone": 1.6,
                            "faces": ["end"]}])
    S.lathe("pot_bow", [(3.65, 3.6), (3.85, 4.3)], (0, 0, 0), plain("holly", tone=3.8, gloss=True), sides=12,
            caps=(False, False), subdiv=0)
    bw = Pix(10, 6)
    bw.poly([(0, 0), (5, 2.5), (0, 6)], "a"), bw.poly([(10, 0), (5, 2.5), (10, 6)], "a")
    bw.disc(5, 3, 1.2, "b")
    S.card("bow", bw.rows, (0, 4.0, 3.9), flat("holly"), key={"a": "holly:4", "b": "holly:2"}, rot=(-14, 0, 0))
    leaf = Pix(7, 14)
    leaf.poly([(3.5, 0), (6.5, 4), (5.5, 10), (3.5, 14), (1.5, 10), (0.5, 4)], "a")
    leaf.line(3.5, 1, 3.5, 13, "v")
    for k in range(3):
        leaf.line(3.5, 5 + k * 3, 1.5, 3.5 + k * 3, "v"), leaf.line(3.5, 5 + k * 3, 5.5, 3.5 + k * 3, "v")
    bract = Pix(10, 14)
    bract.poly([(5, 0), (9, 3), (9.8, 6.5), (7.5, 11), (5, 14), (2.5, 11), (0.2, 6.5), (1, 3)], "a")
    bract.line(5, 1, 5, 13, "v")
    for k in range(3):
        bract.line(5, 4 + k * 3, 2.2, 2.6 + k * 3, "v"), bract.line(5, 4 + k * 3, 7.8, 2.6 + k * 3, "v")
    bract.map(lambda x, y, c: ("f" if c == "a" and y < 3 else c))
    # green leaves underneath, then two rosettes of red bracts with golden buds
    for j in range(7):
        a = j * 360 / 7 + 10
        S.card(f"leaf{j}", leaf.rows, (math.cos(math.radians(a)) * 3.6, 6.6, math.sin(math.radians(a)) * 3.6), flat("leaf"),
               pivot=(math.cos(math.radians(a)) * 1.4, 6.0, math.sin(math.radians(a)) * 1.4), rot=(72, 90 - a, 0),
               key={"a": "leaf:3", "v": "leaf:5"})
    centres = [(0.0, 9.2, 0.0, 7), (-1.8, 8.2, 1.6, 5), (1.9, 8.0, -1.2, 5)]
    for c, (cx, cy, cz, n) in enumerate(centres):
        for j in range(n):
            a = j * 360 / n + c * 30
            r = 2.4 if c == 0 else 1.8
            S.card(f"bract{c}_{j}", bract.rows, (cx + math.cos(math.radians(a)) * r, cy + 0.4, cz + math.sin(math.radians(a)) * r),
                   flat("holly"), pivot=(cx, cy, cz), rot=(64 + c * 6, 90 - a, 0),
                   key={"a": "berry:5", "v": "berry:3", "f": "snow:6"})
        for m in range(3):
            S.ball(f"bud{c}_{m}", 0.35, (cx + (m - 1) * 0.45, cy + 0.6, cz + (m % 2) * 0.3), plain("honey", tone=5, gloss=True),
                   sides=6, rings=3)
    return S


# ====================================================================== presents

@item
def present_pile():
    S = Spec("present_pile", "Pile of Presents", density=2.8,
             desc="A heap of presents in stripes, spots and stars tied with satin ribbons and big bows, a round hat "
                  "box and a paper gift tag; the little one at the front keeps wriggling.")

    def gift(id, size, centre, paper_style, ribbon, yaw=0, parent=None, bow=True):
        w, h, d = size
        S.box(id, size, centre, paper_style, rot=(0, yaw, 0), parent=parent, chamfer=0.2)
        rib = plain(ribbon, tone=4.2, gloss=True)
        S.box(f"{id}_rx", (w + 0.12, h + 0.12, 0.9), centre, rib, rot=(0, yaw, 0), parent=parent)
        S.box(f"{id}_rz", (0.9, h + 0.14, d + 0.12), centre, rib, rot=(0, yaw, 0), parent=parent)
        if bow:
            top = (centre[0], centre[1] + h / 2, centre[2])
            for k, s in enumerate((-1, 1)):
                a = math.radians(yaw)
                S.tube(f"{id}_loop{k}", [top, (top[0] + s * 1.6 * math.cos(a), top[1] + 1.4, top[2] - s * 1.6 * math.sin(a)),
                                         (top[0] + s * 2.2 * math.cos(a), top[1] + 0.3, top[2] - s * 2.2 * math.sin(a)), top],
                       [(0.8, 0.3)] * 4, rib, sides=5, parent=parent)
            S.ball(f"{id}_knot", 0.6, (top[0], top[1] + 0.3, top[2]), rib, sides=6, rings=3, parent=parent)

    stripes = plain("cream", tone=4.6, layers=[{"id": "s", "op": "stripes", "axis": [1, 1, 0], "period": 1.8, "width": 0.45,
                                                "ramp": "holly", "tone": 4.0}])
    spots = plain("sage", tone=4.2, layers=[{"id": "d", "op": "spots", "count": 26, "radius": [0.35, 0.45], "ramp": "cream",
                                             "tone": 5, "roughness": 0}])
    stars = plain("navy", tone=3.4, layers=[{"id": "st", "op": "spots", "count": 22, "radius": [0.25, 0.4], "ramp": "gold",
                                             "tone": 5.5, "roughness": 0.9, "rough_scale": 0.2}])
    check = plain("honey", tone=4.4, layers=[{"id": "c1", "op": "stripes", "axis": "x", "period": 1.6, "width": 0.5,
                                              "shift": -0.8}, {"id": "c2", "op": "stripes", "axis": "z", "period": 1.6,
                                                               "width": 0.5, "shift": -0.8},
                                             {"id": "c3", "op": "stripes", "axis": "y", "period": 1.6, "width": 0.5, "shift": -0.5}])
    gift("big", (10.0, 7.0, 8.6), (-4.0, 3.5, -0.6), stripes, "gold", yaw=8, bow=False)
    gift("tall", (5.4, 8.4, 5.4), (-4.6, 11.2, -1.0), stars, "cream", yaw=-14)
    gift("mid", (7.0, 5.0, 6.4), (6.4, 2.5, -1.2), spots, "holly", yaw=-20)
    S.lathe("hatbox", [(3.4, 0), (3.4, 4.0)], (6.6, 5.0, -1.0), plain("lilac", tone=4.4, layers=[
        {"id": "stripes", "op": "stripes", "axis": "around", "period": 0.0833, "width": 0.4, "ramp": "cream", "tone": 5}]),
        sides=12, subdiv=0)
    S.lathe("hatlid", [(3.65, 3.8), (3.65, 4.8)], (6.6, 5.0, -1.0), plain("plum", tone=4.0), sides=12, subdiv=0)
    S.lathe("hatbow", [(1.2, 4.8), (0.4, 6.0)], (6.6, 5.0, -1.0), plain("cream", tone=5.0, gloss=True), sides=6, subdiv=0)
    tag = Pix(9, 6)
    tag.rect(0, 0, 8, 5, "p")
    tag.disc(1.5, 2.5, 0.8, "h")
    for x in range(3, 8):
        tag.set(x, 2 if x % 2 else 3, "i")
    S.card("tag", tag.rows, (0.8, 6.0, 4.0), flat("paper"), key={"p": "paper:5", "h": "honey:3", "i": "ink:2"}, rot=(0, 10, -20))
    # the little one that wriggles
    S.bone("wiggle", (2.4, 0, 4.0))
    gift("small", (4.0, 3.6, 4.0), (2.4, 1.8, 4.0), check, "lake", yaw=24, parent="wiggle")
    S.anim("idle", 3.0, [
        {"part": "wiggle", "keys": [[0, 0], [1.6, 0], [1.75, 8], [1.9, -8], [2.05, 6], [2.2, -4], [2.4, 0], [3.0, 0]], "axis": "z"},
        {"part": "wiggle", "channel": "scale", "keys": [[0, [0, 0, 0]], [1.6, [0, 0, 0]], [1.7, [0.06, -0.08, 0.06]],
                                                        [1.85, [-0.04, 0.1, -0.04]], [2.1, [0, 0, 0]], [3.0, [0, 0, 0]]]},
    ])
    return S


# ====================================================================== stockings

@item
def stockings():
    S = Spec("stockings", "Knitted Stockings", density=2.8, wall=True,
             desc="A fir garland with holly berries and three hand-knitted stockings on brass hooks: berry with cream "
                  "stripes, sage with snowflake dots and honey with a cable band, fluffy cuffs, and a candy cane "
                  "poking out of one.")
    pts = [(-15.0 + 30.0 * i / 10, 0.6 - 1.4 * (1 - ((i / 10) * 2 - 1) ** 2), 1.6) for i in range(11)]
    S.tube("garland", pts, 1.3, leafy("pine", tone=4.2, snow=True), sides=7)
    tip = ["..aab", ".aaab", "aaaab", ".aaab", "..aab"]
    for j in range(14):
        x = -14.0 + j * 2.15
        S.card(f"needle{j}", tip, (x, pts[0][1] - 0.5 - 1.4 * (1 - (x / 15) ** 2) + (j % 2) * 1.2, 2.6), flat("pine"),
               rot=(0, 0, 90 + (j % 3 - 1) * 40), key={"a": "pine:4", "b": "pine:2"})
    for j in range(6):
        x = -12.5 + j * 5.0
        S.ball(f"berry{j}", 0.55, (x, 0.2 - 1.4 * (1 - (x / 15) ** 2) + 1.0, 3.0), plain("holly", tone=4.4, gloss=True),
               sides=6, rings=3)
    styles = [
        knit("holly", tone=3.8, layers=[{"id": "stripes", "op": "stripes", "axis": "path", "period": 2.4, "width": 0.35,
                                         "ramp": "cream", "tone": 5}]),
        knit("sage", tone=4.0, layers=[{"id": "flakes", "op": "spots", "count": 10, "radius": [0.3, 0.45], "ramp": "cream",
                                        "tone": 5.5, "roughness": 0.9, "rough_scale": 0.25}]),
        knit("honey", tone=4.2, layers=[{"id": "cable", "op": "stripes", "axis": "path", "period": 6.0, "width": 0.2,
                                         "ramp": "russet", "tone": 3.6}])]
    tracks = []
    for k, x in enumerate((-9.6, 0.0, 9.6)):
        top = 0.6 - 1.4 * (1 - (x / 15) ** 2) - 0.6
        S.box(f"hook{k}", (0.5, 1.6, 0.5), (x, top + 0.4, 1.0), metal("brass", tone=4.8))
        S.bone(f"st{k}", (x, top, 1.6))
        leg = [(x, top - 1.8, 1.6), (x, top - 6.0, 1.6), (x + 0.2, top - 10.0, 1.6), (x + 1.4, top - 12.2, 1.6),
               (x + 3.6, top - 12.6, 1.6), (x + 4.6, top - 12.0, 1.6)]
        S.tube(f"sock{k}", leg, [(2.0, 1.0), (1.9, 0.95), (1.8, 0.95), (1.7, 1.0), (1.4, 1.0), (0.6, 0.6)], styles[k],
               parent=f"st{k}", sides=8, up=[0, 0, 1])
        S.lathe(f"cuff{k}", [(2.2, 0), (2.4, 0.8), (2.3, 2.4), (2.0, 2.8)], (x, top - 2.6, 1.6), knit("cream", tone=4.8, layers=[
            {"id": "fluff", "op": "noise", "scale": 0.5, "amount": 0.9}]), parent=f"st{k}", sides=10, squash=0.55)
        S.ball(f"heel{k}", 1.0, (x + 0.2, top - 11.2, 1.6), knit("cream", tone=4.6), parent=f"st{k}", sides=6, rings=3,
               squash=(1, 1, 0.8))
        tracks.append({"part": f"st{k}", "osc": {"axis": "z", "amp": 2.5, "cycles": 1, "phase": k * 0.27}})
    S.tube("cane", [(10.4, -1.8, 2.0), (10.6, 2.0, 2.0), (11.2, 2.9, 2.0), (12.0, 2.3, 2.0)], 0.4, candy(period=0.9),
           parent="st2", sides=5)
    S.anim("idle", 4.0, tracks)
    return S


# ====================================================================== snowflake rug

def snowflake_art(n):
    p = Pix(n, n)
    c = n / 2
    R = n / 2
    for y in range(n):
        for x in range(n):
            d = math.hypot(x + 0.5 - c, y + 0.5 - c)
            if d <= R:
                ring = int(d / (R / 9))
                p.set(x, y, "a" if ring % 3 else "b")
                if d > R - 2.2:
                    p.set(x, y, "e")
                elif d > R - 4.5 and (math.degrees(math.atan2(y - c, x - c)) % 15) < 7.5:
                    p.set(x, y, "c")
    for k in range(6):
        a = math.radians(k * 60 - 90)
        ca, sa = math.cos(a), math.sin(a)
        L = R * 0.78
        p.line(c, c, c + ca * L, c + sa * L, "s", w=2.2)
        for t, bl in ((0.35, 0.22), (0.58, 0.18), (0.78, 0.12)):
            px, py = c + ca * L * t, c + sa * L * t
            for s in (-1, 1):
                b = a + s * math.radians(55)
                p.line(px, py, px + math.cos(b) * L * bl, py + math.sin(b) * L * bl, "s", w=1.6)
        p.disc(c + ca * L, c + sa * L, 1.6, "S")
    p.disc(c, c, R * 0.13, "S")
    p.star(c, c, R * 0.11, "s", points=6, inner=0.5)
    return p.rows


@item
def snowflake_rug():
    S = Spec("snowflake_rug", "Snowflake Rug", density=3.0,
             desc="A round tufted rug in icy blues with a big six-armed snowflake worked in cream wool, a scalloped "
                  "border and snowball pom-poms all the way round.")
    S.lathe("rug", [(15.0, 0), (15.2, 0.5), (14.8, 0.9)], (0, 0, 0), knit("ice", tone=3.8), sides=24, subdiv=0)
    S.card("top", snowflake_art(88), (0, 0.95, 0), flat("ice", light=0.7), plane="xz",
           key={"a": "ice:3", "b": "ice:4", "c": "frost:5" if False else "snow:5", "e": "ice:2", "s": "snow:6", "S": "snow:7"})
    for k in range(20):
        a = k * 2 * math.pi / 20
        S.ball(f"pom{k}", 0.85, (math.cos(a) * 15.3, 0.85, math.sin(a) * 15.3), knit("snow", tone=5.4), sides=6, rings=4)
    return S


# ====================================================================== icicle lights

@item
def icicle_lights():
    S = Spec("icicle_lights", "Icicle Lights", density=3.0, wall=True,
             desc="A frosted wire of glass icicles along the wall, each lit from within with cold blue light; drops of "
                  "light slide down them one after another, and a crust of snow sits along the top.")
    S.tube("wire", [(-24.0 + 48 * i / 8, 0.4 - 0.5 * math.sin(i / 8 * math.pi), 1.0) for i in range(9)], 0.25,
           plain("silver", tone=4.4, noise=0), sides=4)
    for k, x in enumerate((-24.0, -8.0, 8.0, 24.0)):
        S.box(f"clip{k}", (1.2, 1.6, 1.2), (x, 0.2, 0.6), metal("silver", tone=4.4, tarnish=False))
    for i in range(12):
        x = -22.0 + i * 4.0 + (hsh(i, 1) - 0.5)
        S.ball(f"snow{i}", 1.1 + hsh(i, 2) * 0.5, (x, 0.9 - 0.5 * math.sin((x + 24) / 48 * math.pi), 1.1), snowy(tone=5.2),
               sides=6, rings=3, squash=(1.8, 0.55, 1))
    tracks = []
    for i in range(23):
        x = -22.0 + i * 2.0
        wy = 0.4 - 0.5 * math.sin((x + 24) / 48 * math.pi)
        L = 3.0 + hsh(i, 4) * 6.0
        S.taper(f"glow_ice{i}", (1.1, 1.1, L), (x, wy - L / 2 - 0.1, 1.0), glow("cold", tone=4.0, layers=[
            {"id": "facets", "op": "stripes", "axis": "y", "period": 1.0, "width": 0.25, "shift": 0.8}]),
            rot=(90, 0, 0), pivot=(x, wy - 0.1, 1.0), front_scale=[0.1, 0.1], back_scale=[1, 1])
        nm = f"glow_drop{i}"
        S.ball(nm, 0.4, (x, wy - 0.8, 1.0), glow("snow" if False else "cold", tone=6.4), sides=6, rings=3)
        o = round((i * 0.37) % 1.7, 3)
        k0 = [[0, [0, 0, 0]]] + ([[o, [0, 0, 0]]] if o > 0 else [])
        tracks.append({"part": nm, "channel": "position", "ease": "in",
                       "keys": k0 + [[o + 1.2, [0, -L * 0.8, 0]], [o + 1.21, [0, 0, 0]], [3.0, [0, 0, 0]]]})
        s0 = [[0, [-0.7, -0.7, -0.7]]] + ([[o, [-0.7, -0.7, -0.7]]] if o > 0 else [])
        tracks.append({"part": nm, "channel": "scale",
                       "keys": s0 + [[o + 0.3, [0.2, 0.2, 0.2]], [o + 1.2, [-0.7, -0.7, -0.7]], [3.0, [-0.7, -0.7, -0.7]]]})
    for tr in tracks:
        ks = tr["keys"]
        tr["keys"] = [kk for j, kk in enumerate(ks) if j == 0 or kk[0] > ks[j - 1][0]]
    S.anim("idle", 3.0, tracks)
    return S
