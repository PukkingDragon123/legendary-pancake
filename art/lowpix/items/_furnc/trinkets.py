"""Decor and wall pieces: vases, books, globe, clocks, record player, tea, ship, typewriter, frames, mirror,
tapestry, bunting, shelf, cuckoo clock, map, dream catcher, star garland and the peg rail with hats."""
import math

from lib import Spec, bezier, circle, rotz, cloth, glass, glaze, glow, hsh, knit, leafy, metal, paper, plain, wood
from pix import Pix, star_pts

ITEMS = {}


def item(f):
    ITEMS[f.__name__] = f
    return f


def flat(r, tone=4.0, light=0.6):
    """Card style: art colours come from the key; a little painted light, no brush."""
    return {"ramp": r, "tone": tone, "light": light, "brush": {"off": True}, "rim": {"light": 0, "dark": 0}}


def hole(r_in, y, ramp="soot", tone=0.8):
    """A dark opening painted on a lathe's top cap (vase mouths, cups)."""
    return {"id": "mouth", "op": "spots", "centers": [[0, y, 0, r_in]], "ramp": ramp, "tone": tone, "roughness": 0,
            "faces": ["end"], "bevel": {"shadow": 0, "highlight": 1, "highlight_shift": 1.2}}


def sprig(S, id, base, n, height, ramp="sage", flower=None, spread=18, seed=0, parent=None):
    """A little bunch of stems with leaves (and optional flower heads) standing in a vase, as crossed cards."""
    for k in range(n):
        h = height * (0.75 + 0.25 * hsh(seed, k))
        rows = int(h * S.density)
        p = Pix(5, rows)
        for y in range(rows):
            p.set(2, y, "s")
        for y in range(2, rows - 3, 3):
            side = 1 if (y // 3 + k) % 2 else -1
            p.set(2 + side, y, "l")
            p.set(2 + side * 2, y - 1, "L")
        if flower:
            for y in range(0, max(3, rows // 3)):
                if y % 2 == 0:
                    p.set(1, y, "f")
                    p.set(3, y, "F")
                p.set(2, y, "F" if y % 2 else "f")
        a = (k - (n - 1) / 2) * spread
        S.card(f"{id}{k}", p.rows, (base[0], base[1] + h / 2, base[2]), flat(ramp), parent=parent,
               pivot=base, rot=(0, k * 67 + seed * 30, a * 0.6),
               key={"s": f"{ramp}:2", "l": f"{ramp}:4", "L": f"{ramp}:6",
                    **({"f": f"{flower}:3", "F": f"{flower}:5"} if flower else {})})


# ====================================================================== decor

@item
def vase_trio():
    S = Spec("vase_trio", "Glazed Vase Trio", density=3.5,
             desc="Three hand-thrown vases: a tall crackled celadon bottle with lavender, a cornflower-blue jug with a "
                  "painted flower band, and a little unglazed terracotta bud pot with sgraffito.")
    a = glaze("sage", dip="linen", dip_to=-0.82)
    S.lathe("vase_a", [(1.5, 0), (2.2, 0.5), (2.8, 2.6), (2.7, 5), (2.0, 6.8), (1.05, 8.2), (0.95, 10), (1.4, 10.7),
                       (1.3, 11.1)], (-2.4, 0, -1.4), a, sides=12)
    S.paint("vase_a", layers=[hole(0.85, 11.1)])
    sprig(S, "lav", (-2.4, 10.6, -1.4), 4, 7.0, ramp="sage", flower="lilac", spread=16)
    b = glaze("lake", dip="linen", dip_to=-0.85, layers=[
        {"id": "bandc", "op": "band", "axis": "y", "from": -0.05, "to": 0.32, "ramp": "cream", "tone": 4.6,
         "bevel": {"shadow": 1, "highlight": 1}},
        {"id": "flowers", "op": "spots", "count": 9, "radius": [0.35, 0.5], "ramp": "dusk", "tone": 3.6,
         "where": {"y": [3.3, 5.0]}, "roughness": 0.1},
        {"id": "hearts", "op": "spots", "count": 9, "radius": [0.15, 0.2], "ramp": "honey", "tone": 5,
         "where": {"y": [3.3, 5.0]}, "roughness": 0}])
    S.lathe("vase_b", [(1.8, 0), (2.9, 0.9), (3.3, 2.8), (3.1, 4.8), (2.2, 6.4), (1.6, 7.3), (1.8, 8.0), (1.95, 8.3)],
            (2.5, 0, -0.4), b, sides=12)
    S.paint("vase_b", layers=[hole(1.4, 8.3)])
    S.tube("handle_b", [(4.0, 7.2, -0.4), (5.3, 7.0, -0.4), (5.8, 5.4, -0.4), (5.0, 3.6, -0.4), (4.6, 3.2, -0.4)], 0.45,
           glaze("lake", dip=None, crackle=False), sides=6)
    c = plain("terracotta", tone=4.2, noise=0.6, layers=[
        {"id": "sgraffito", "op": "stripes", "axis": "y", "period": 1.6, "width": 0.22, "zigzag": [0.5, 0.18],
         "range": [-0.2, 0.45], "ramp": "linen", "tone": 4},
        {"id": "rubbed", "op": "patches", "scale": 1.0, "threshold": 0.7, "shift": -0.7}])
    S.lathe("vase_c", [(1.5, 0), (2.3, 0.7), (2.5, 2.0), (2.0, 3.4), (1.3, 4.0), (1.55, 4.6)], (-0.3, 0, 2.6), c, sides=10)
    S.paint("vase_c", layers=[hole(1.1, 4.6, ramp="clay", tone=1.0)])
    sprig(S, "sage", (-0.3, 4.2, 2.6), 3, 3.6, ramp="leaf", spread=28, seed=2)
    return S


@item
def reading_pile():
    S = Spec("reading_pile", "Bedtime Reading Pile", density=3.5,
             desc="Five cloth-bound books stacked a little crooked, round wire spectacles on top and a berry ribbon "
                  "marking 'just one more chapter'.")
    books = [  # (w, h, d, yaw, cover ramp, band ramp, spine side)
        (10.6, 1.8, 7.6, -4, "fern", "honey", -1), (9.8, 1.5, 7.0, 6, "berry", "honey", 1),
        (10.2, 2.0, 7.4, -2, "dusk", "cream", -1), (8.8, 1.4, 6.4, 9, "ochre", "russet", 1),
        (9.4, 1.6, 6.8, -7, "plum", "honey", -1)]
    y = 0.0
    for k, (w, h, d, yaw, cov, band, side) in enumerate(books):
        cx = (hsh(k, 3) - 0.5) * 1.2
        cz = (hsh(k, 4) - 0.5) * 0.8
        S.bone(f"book{k}", (cx, y, cz), rot=(0, yaw, 0))
        t = 0.3
        cover = cloth(cov, tone=3.8, weave=0.45, layers=[
            {"id": "corners", "op": "wear", "width": 1, "density": 0.25, "ramp": cov, "tone": 2.0}])
        bk = f"book{k}"
        S.box(f"b{k}_bot", (w, t, d), S.at(bk, (0, t / 2, 0)), cover, parent=bk)
        S.box(f"b{k}_top", (w, t, d), S.at(bk, (0, h - t / 2, 0)), cover, parent=bk)
        S.box(f"b{k}_spine", (w, h, t + 0.2), S.at(bk, (0, h / 2, side * (d / 2 - 0.05))), cloth(cov, tone=3.6, layers=[
            {"id": "bands", "op": "stripes", "axis": "x", "period": w / 3.2, "width": 0.09, "ramp": band, "tone": 5,
             "bevel": {"shadow": 1, "highlight": 1}},
            {"id": "title", "op": "band", "axis": "y", "from": -0.2, "to": 0.2, "ramp": band, "tone": 4.2,
             "faces": ["front", "back"], "wobble": 0.05}]), parent=f"book{k}")
        S.box(f"b{k}_pages", (w - 0.5, h - 2 * t + 0.02, d - 0.6), S.at(bk, (-0.1, h / 2, -side * 0.2)),
              paper("paper", tone=4.6, layers=[
                  {"id": "leaves", "op": "stripes", "axis": "y", "period": 0.28, "width": 0.5, "shift": -0.7,
                   "faces": ["sides"]}]), parent=f"book{k}")
        y += h
    # ribbon bookmark from the third book
    S.card("ribbon", ["aa", "ab", "ab", "ab", "aa", "ab", "a.", "aa", "b."], (2.6, 3.9, 3.85), flat("berry"),
           key={"a": "berry:4", "b": "berry:2"}, rot=(8, 0, 6))
    # spectacles on top: two wire rims, a bridge and folded arms
    top = y + 0.25
    wire = metal("brass", tone=4.4, tarnish=False)
    for s in (-1, 1):
        S.tube(f"rim{s}", circle((s * 1.55, top + 0.15, 0.6), 1.2, 10, "xz"), 0.17, wire, sides=5, caps=(False, False))
        S.lathe(f"glass_lens{s}", [(1.15, 0), (1.15, 0.12)], (s * 1.55, top + 0.1, 0.6), glass(), sides=10, caps=(False, True),
                subdiv=0)
        S.tube(f"arm{s}", [(s * 2.7, top + 0.15, 0.2), (s * 2.4, top + 0.2, -1.5), (s * 0.6, top + 0.25, -2.2)], 0.14,
               wire, sides=4)
    S.tube("bridge", [(-0.4, top + 0.15, 0.9), (0, top + 0.45, 1.0), (0.4, top + 0.15, 0.9)], 0.15, wire, sides=4)
    # a pressed leaf poking out of the second book
    leaf = Pix(9, 6)
    leaf.poly([(0, 3), (3, 0.5), (8.5, 2.5), (6, 5.5), (2, 5)], "l")
    leaf.line(0, 3, 8, 3, "v")
    S.card("pressed_leaf", leaf.rows, (-4.6, 2.9, -2.6), flat("ochre"), key={"l": "ochre:4", "v": "ochre:2"},
           plane="xz", rot=(0, 20, 0))
    return S


@item
def floor_globe():
    S = Spec("floor_globe", "Explorer's Floor Globe", density=2.8,
             desc="A tripod floor globe: turned walnut column and curved legs with brass feet, a brass meridian and "
                  "horizon ring, and a hand-painted globe of seas and sage continents that turns slowly.")
    wd = wood("walnut", tone=4.6, grain="y")
    S.lathe("column", [(1.0, 2.0), (1.6, 2.8), (0.9, 4.4), (0.75, 7.2), (1.3, 8.4), (1.0, 9.0), (2.0, 9.6), (1.6, 10.2)],
            (0, 0, 0), wd, sides=10)
    for k in range(3):
        a = math.radians(k * 120 + 30)
        ca, sa = math.cos(a), math.sin(a)
        pts = [(ca * 0.6, 4.2, sa * 0.6), (ca * 3.0, 3.4, sa * 3.0), (ca * 5.2, 1.6, sa * 5.2), (ca * 6.4, 0.7, sa * 6.4)]
        S.tube(f"leg{k}", pts, [0.75, 0.7, 0.6, 0.55], wd, sides=6)
        S.ball(f"foot{k}", 0.75, (ca * 6.6, 0.7, sa * 6.6), metal("brass"), sides=8, rings=4)
    # horizon ring held by three short posts
    S.lathe("horizon", [(7.2, 14.4), (7.4, 14.8), (6.6, 14.9), (6.4, 14.5)], (0, 0, 0), metal("brass", tone=4.2), sides=16,
            caps=(True, True), subdiv=0)
    for k in range(3):
        a = math.radians(k * 120 + 30)
        S.tube(f"post{k}", [(math.cos(a) * 1.4, 10.0, math.sin(a) * 1.4), (math.cos(a) * 5.0, 12.2, math.sin(a) * 5.0),
                            (math.cos(a) * 6.8, 14.4, math.sin(a) * 6.8)], 0.32, metal("brass", tone=4.0), sides=5)
    # the globe, tilted, turning inside a brass meridian
    S.bone("tilt", (0, 15.6, 0), rot=(0, 0, 23))
    S.tube("meridian", [rotz(q, (0, 15.6, 0), 23) for q in circle((0, 15.6, 0.0), 6.7, 16, "xy", -100, 100, closed=False)],
           0.32, metal("brass", tone=4.6), parent="tilt", sides=5)
    S.bone("spin", (0, 15.6, 0), parent="tilt")
    S.ball("globe", 6.0, (0, 15.6, 0), {
        "ramp": "lake", "tone": 4.0, "rim": {"light_shift": 0.8, "dark_shift": -1.0}, "brush": {"flow": "path", "rough": 0.5},
        "layers": [
            {"id": "deep", "op": "noise", "scale": 1.6, "amount": 0.6},
            {"id": "land", "op": "patches", "scale": 3.4, "threshold": 0.56, "ramp": "sage", "tone": 4.2,
             "bevel": {"shadow": 1, "highlight": 1, "shadow_ramp": "lake", "shadow_tone": 2.0}},
            {"id": "forest", "op": "patches", "scale": 1.2, "threshold": 0.72, "ramp": "fern", "tone": 3.8},
            {"id": "desert", "op": "patches", "scale": 1.6, "threshold": 0.8, "ramp": "buff", "tone": 4.6},
            {"id": "lat", "op": "stripes", "axis": "path", "period": 2.0, "width": 0.07, "shift": 0.9},
            {"id": "lon", "op": "stripes", "axis": "around", "period": 0.0833, "width": 0.08, "shift": 0.8},
            {"id": "inkring", "op": "spots", "centers": [[2.2, 9.0, 4.4, 0.9]], "ring": 0.6, "ramp": "berry",
             "tone": 3.0, "roughness": 0.1},
            {"id": "varnish", "op": "gloss", "dash": True, "length": 3, "shift": 1.4, "density": 0.5, "post": True}]},
        parent="spin", sides=14, rings=9)
    S.ball("cap_top", 0.6, rotz((0, 22.4, 0), (0, 15.6, 0), 23), metal("brass"), parent="tilt", sides=6, rings=3)
    S.anim("idle", 24.0, [{"part": "spin", "keys": [[0, 0], [24, 360]], "axis": "y", "ease": "linear"}])
    return S


def dial_art(px, cream="cream", ink="ink", roman=True):
    """A clock dial: cream face, ink ticks round the edge, a pale ring; drawn on a px x px card."""
    p = Pix(px, px)
    c = (px - 1) / 2 + 0.5
    p.disc(c, c, px / 2, "b")
    p.disc(c, c, px / 2 - 1.2, "f")
    p.ring(c, c, px / 2 - 2.6, "r", 0.8)
    for k in range(12):
        a = math.radians(k * 30 - 90)
        r0, r1 = px / 2 - 2.2, px / 2 - (4.6 if k % 3 == 0 else 3.4)
        p.line(c + math.cos(a) * r0, c + math.sin(a) * r0, c + math.cos(a) * r1, c + math.sin(a) * r1, "t")
    p.disc(c, c, 1.0, "t")
    return p.rows


def hand_art(length_px, width=1, tip="t"):
    rows = []
    for y in range(length_px):
        rows.append(("t" * width).center(max(3, width + 2), "."))
    rows[0] = tip.center(max(3, width + 2), ".")
    return rows


@item
def mantel_clock():
    S = Spec("mantel_clock", "Pendulum Mantel Clock", density=3.5,
             desc="An arched walnut mantel clock on brass bun feet: cream dial with ink ticks under a brass bezel, a "
                  "glazed door showing the swinging brass pendulum, and a little brass finial.")
    wd = wood("walnut", tone=4.4, grain="x")
    S.box("plinth", (11.0, 1.2, 6.0), (0, 1.1, 0), wd, chamfer=0.35)
    for k, (x, z) in enumerate([(-4.6, 2.2), (4.6, 2.2), (-4.6, -2.2), (4.6, -2.2)]):
        S.ball(f"foot{k}", 0.55, (x, 0.5, z), metal("brass"), sides=6, rings=3)
    S.box("body", (9.4, 9.6, 5.0), (0, 6.5, 0), wd, chamfer=0.3)
    S.box("cornice", (10.2, 0.8, 5.6), (0, 11.5, 0), wd, chamfer=0.25)
    S.cyl("arch", 4.7, 5.0, (0, 11.6, -2.5), wd, sides=14, rot=(90, 0, 0), caps=(True, True))
    S.lathe("finial", [(0.8, 0), (0.5, 0.4), (0.7, 0.9), (0.25, 1.4), (0.15, 2.4)], (0, 16.1, 0), metal("brass"), sides=6)
    # dial under a brass bezel
    S.tube("bezel", circle((0, 11.6, 3.0), 3.55, 16, "xy"), 0.42, metal("brass", tone=4.8), sides=6, caps=(False, False))
    S.card("dial", dial_art(25), (0, 11.6, 2.92), flat("cream"),
           key={"b": "brass:4", "f": "cream:5", "r": "cream:3", "t": "ink:1"})
    S.card("hand_h", hand_art(6, 1), (-0.7, 11.95, 3.0), flat("ink"), key={"t": "ink:1"}, rot=(0, 0, 60),
           pivot=(0, 11.6, 3.0))
    S.card("hand_m", hand_art(10, 1), (0, 12.9, 3.04), flat("ink"), key={"t": "ink:1"}, pivot=(0, 11.6, 3.04))
    # glazed pendulum door with a brass frame and the pendulum behind it
    S.box("door_frame", (6.0, 5.0, 0.35), (0, 4.6, 2.62), metal("brass", tone=4.2), hide=["back"])
    S.box("door_back", (5.2, 4.2, 0.2), (0, 4.6, 2.45), plain("walnut", tone=1.6, noise=0.3))
    S.bone("pend", (0, 7.0, 2.6))
    S.box("rod", (0.25, 3.6, 0.2), (0, 5.3, 2.6), metal("brass", tone=4.0), parent="pend")
    S.cyl("bob", 1.1, 0.35, (0, 3.6, 2.5), metal("brass", tone=5.0), parent="pend", rot=(90, 0, 0), sides=10,
          caps=(True, True))
    S.box("glass_door", (5.2, 4.2, 0.15), (0, 4.6, 2.85), glass())
    S.box("keyhole", (0.5, 0.7, 0.3), (2.3, 4.6, 2.85), metal("brass", tone=5.2))
    S.anim("idle", 2.0, [{"part": "pend", "osc": {"axis": "z", "amp": 11, "cycles": 1}}])
    return S


@item
def record_player():
    S = Spec("record_player", "Suitcase Record Player", density=3.2,
             desc="A dusk-blue leatherette suitcase record player with brass corners, the lid propped open on its "
                  "cream speaker cloth, a spinning record with a honey label and a silver tone arm.")
    leather = cloth("dusk", tone=3.8, weave=0.35, layers=[
        {"id": "stitch", "op": "panel", "inset": 2, "shift": 1.4, "highlight": 0, "shadow": 0},
        {"id": "scuff", "op": "wear", "width": 1, "density": 0.2, "ramp": "dusk", "tone": 5}])
    S.box("case", (14.0, 4.0, 10.0), (0, 2.1, 0.2), leather, chamfer=0.5)
    S.box("deck", (13.0, 0.4, 9.0), (0, 4.2, 0.2), plain("linen", tone=4.4, noise=0.3))
    for k, (x, z) in enumerate([(-6.7, 4.9), (6.7, 4.9), (-6.7, -4.5), (6.7, -4.5)]):
        S.box(f"corner{k}", (1.0, 1.0, 1.0), (x, 0.5, z), metal("brass"), chamfer=0.2)
    S.box("latch", (1.6, 1.2, 0.4), (0, 3.9, 5.3), metal("brass", tone=5.0), chamfer=0.15)
    S.tube("handle", [(-2.0, 2.6, 5.3), (-1.6, 2.4, 6.2), (1.6, 2.4, 6.2), (2.0, 2.6, 5.3)], 0.4,
           plain("russet", tone=3.4, noise=0.2), sides=6)
    S.box("grille_front", (7.0, 2.0, 0.2), (2.8, 2.4, 5.25), {"ramp": "linen", "tone": 3.4, "rim": {"light": 0}, "layers": [
        {"id": "g", "op": "grille", "rect": [0.05, 0.1, 0.95, 0.9], "period": 2, "dir": "v", "slit_tone": 1.0}]})
    # the open lid, hinged at the back edge
    S.bone("lid", (0, 4.6, -4.8), rot=(-108, 0, 0))
    S.box("lid_shell", (14.0, 0.8, 9.6), S.at("lid", (0, 0.4, 4.8)), leather, parent="lid", chamfer=0.3)
    S.box("lid_cloth", (12.4, 0.2, 8.2), S.at("lid", (0, -0.05, 4.8)), cloth("cream", tone=4.0, weave=0.3, layers=[
        {"id": "dots", "op": "stripes", "axis": "x", "period": 0.6, "width": 0.35, "shift": -0.8}]), parent="lid")
    # platter, record (spins) and tone arm
    S.lathe("platter", [(4.6, 4.7), (4.6, 5.1)], (-1.2, 0, 0.4), metal("silver", tone=3.6), sides=16, subdiv=0)
    S.bone("spin", (-1.2, 5.1, 0.4))
    rec = Pix(28, 28)
    for y in range(28):
        for x in range(28):
            d = math.hypot(x + 0.5 - 14, y + 0.5 - 14)
            if d <= 14:
                rec.set(x, y, "g" if int(d * 1.3) % 2 else "v")
                if d < 4.6:
                    rec.set(x, y, "l" if d > 1.0 else "h")
                if 7 < d < 12 and 2 < math.degrees(math.atan2(y - 14, x - 14)) % 90 < 9:
                    rec.set(x, y, "s")
    S.card("record", rec.rows, (-1.2, 5.16, 0.4), flat("soot", light=0.4), plane="xz", parent="spin",
           key={"v": "soot:1", "g": "soot:2", "l": "honey:4", "h": "soot:0", "s": "soot:4"})
    S.cyl("spindle", 0.25, 0.7, (-1.2, 5.1, 0.4), metal("silver", tone=5), parent="spin", sides=5)
    S.cyl("arm_base", 1.0, 1.0, (4.6, 4.7, -2.4), metal("silver", tone=4.0), sides=8)
    arm = metal("silver", tone=4.6, tarnish=False)
    S.tube("arm", [(4.6, 5.9, -2.4), (4.4, 6.0, 0.2), (3.2, 5.8, 2.4), (2.0, 5.6, 3.2)], 0.25, arm, sides=5)
    S.box("headshell", (1.0, 0.45, 1.6), (1.6, 5.5, 3.4), metal("iron", tone=4.4), rot=(0, 50, 0))
    for k, x in enumerate((4.2, 5.6)):
        S.cyl(f"knob{k}", 0.55, 0.6, (x, 4.7, 3.8), plain("cream", tone=4.4, gloss=True), sides=8)
    S.anim("idle", 1.8, [{"part": "spin", "keys": [[0, 0], [1.8, -360]], "axis": "y", "ease": "linear"}])
    return S


def china(r="cream"):
    return glaze(r, tone=4.8, dip=None, crackle=False, layers=[
        {"id": "roses", "op": "spots", "count": 7, "radius": [0.45, 0.7], "ramp": "rose", "tone": 3.8, "roughness": 0.5,
         "bevel": {"shadow": 1, "highlight": 1, "shadow_shift": -1.4}},
        {"id": "leaves", "op": "spots", "count": 9, "radius": [0.2, 0.32], "ramp": "sage", "tone": 3.6},
        {"id": "gilt", "op": "band", "axis": "y", "from": 0.82, "to": 1.0, "ramp": "honey", "tone": 4.6}])


@item
def rose_tea_set():
    S = Spec("rose_tea_set", "Rose Tea Service", density=3.5,
             desc="A rosebud china tea service on an oval wooden tray: a round teapot with a curved spout, two cups of "
                  "chamomile on saucers and a little plate of shortbread.")
    S.lathe("tray", [(7.0, 0), (7.3, 0.5), (7.3, 0.75)], (0, 0, 0), wood("oak", tone=4.6, grain="x"), sides=16,
            squash=0.72, subdiv=0)
    S.tube("tray_rim", circle((0, 0.85, 0), 7.1, 18, "xz"), 0.35, wood("oak", tone=4.8, grain="x", knots=False),
           sides=5, caps=(False, False))
    S.paint("tray_rim", layers=[])
    # scale the rim ring into an oval to match the tray
    for r in S.parts[-1]["rings"]:
        r["at"][2] *= 0.72
    tp = (-2.4, 0.75, -1.0)
    S.lathe("teapot", [(1.6, 0), (2.8, 0.7), (3.3, 2.3), (3.05, 3.8), (2.2, 4.7), (1.5, 5.0)], tp, china(), sides=12)
    S.lathe("lid", [(1.6, 5.0), (1.4, 5.4), (0.6, 5.8), (0.45, 6.0)], tp, china(), sides=10)
    S.ball("knob", 0.6, (tp[0], tp[1] + 6.4, tp[2]), china("rose"), sides=8, rings=4)
    S.tube("spout", [(tp[0] + 2.6, tp[1] + 1.8, tp[2]), (tp[0] + 3.7, tp[1] + 2.4, tp[2]), (tp[0] + 4.3, tp[1] + 3.6, tp[2]),
                     (tp[0] + 4.9, tp[1] + 4.6, tp[2])], [0.85, 0.65, 0.5, 0.42], china(), sides=6)
    S.tube("handle", [(tp[0] - 2.8, tp[1] + 4.0, tp[2]), (tp[0] - 4.2, tp[1] + 3.8, tp[2]), (tp[0] - 4.4, tp[1] + 2.2, tp[2]),
                      (tp[0] - 3.1, tp[1] + 1.2, tp[2])], 0.4, china(), sides=6)
    for k, (x, z) in enumerate([(3.2, 1.6), (0.6, 3.4)]):
        S.lathe(f"saucer{k}", [(1.0, 0), (2.1, 0.25), (2.3, 0.45)], (x, 0.75, z), china(), sides=12, subdiv=0)
        S.lathe(f"cup{k}", [(0.8, 0.45), (1.3, 0.7), (1.65, 1.8), (1.75, 2.5)], (x, 0.75, z), china(), sides=10)
        S.paint(f"cup{k}", layers=[hole(1.5, 2.5, ramp="honey", tone=2.6)])
        S.tube(f"cuph{k}", [(x + 1.6, 2.9, z), (x + 2.4, 2.8, z), (x + 2.3, 1.9, z), (x + 1.55, 1.8, z)], 0.25, china(),
               sides=4)
    S.lathe("plate", [(1.0, 0), (2.4, 0.2), (2.6, 0.4)], (4.0, 0.75, -2.4), china(), sides=12, subdiv=0)
    bisc = plain("buff", tone=4.6, noise=0.5, layers=[
        {"id": "pricks", "op": "spots", "count": 6, "radius": [0.1, 0.15], "ramp": "ochre", "tone": 2.6, "faces": ["top"]}])
    for k, (dx, dz, yaw) in enumerate([(-0.8, 0.2, 10), (0.8, -0.4, -25), (0.1, 0.5, 70)]):
        S.box(f"biscuit{k}", (1.8, 0.45, 1.1), (4.0 + dx, 1.4 + k * 0.42, -2.4 + dz), bisc, rot=(0, yaw, 0), chamfer=0.15)
    return S


@item
def ship_bottle():
    S = Spec("ship_bottle", "Ship in a Bottle", density=3.2,
             desc="The good ship Hootenanny under full sail on a painted sea, inside a green-tinted bottle with a cork, "
                  "resting on a walnut cradle with a brass name plate.")
    wd = wood("walnut", tone=4.4, grain="x")
    S.box("plank", (13.0, 0.9, 5.0), (0, 0.45, 0), wd, chamfer=0.25)
    for k, x in enumerate((-4.2, 3.6)):
        S.box(f"cradle{k}", (1.2, 1.8, 4.4), (x, 1.6, 0), wd, chamfer=0.2)
    S.box("plate", (3.6, 0.6, 0.2), (0, 0.5, 2.55), metal("brass", tone=4.8, layers=[
        {"id": "name", "op": "stripes", "axis": "x", "period": 0.5, "width": 0.5, "range": [-0.7, 0.7], "shift": -1.6,
         "faces": ["front"]}]))
    cy = 4.4
    body = [(-6.4, 2.2), (-6.1, 3.1), (-5.2, 3.3), (2.6, 3.3), (3.8, 3.0), (5.0, 1.6), (5.8, 1.2), (7.0, 1.25)]
    S.tube("glass_bottle", [(x, cy, 0) for x, _ in body], [r for _, r in body], glass("ice", tone=3.0), sides=12,
           caps=(True, False), double_sided=True)
    S.tube("cork", [(6.4, cy, 0), (7.9, cy, 0)], [1.0, 1.12], plain("buff", tone=3.6, noise=0.8, layers=[
        {"id": "pores", "op": "spots", "count": 10, "radius": [0.1, 0.18], "ramp": "russet", "tone": 2.4}]), sides=8)
    # painted sea along the bottom of the bottle
    S.tube("sea", [(-5.6, cy - 2.3, 0), (2.8, cy - 2.3, 0)], [(2.6, 0.7), (2.6, 0.7)], {
        "ramp": "lake", "tone": 3.6, "rim": {"light_shift": 0.6, "dark_shift": -0.8}, "layers": [
            {"id": "waves", "op": "stripes", "axis": "y", "period": 0.7, "width": 0.3, "zigzag": [0.4, 0.8],
             "zig_axis": "x", "shift": 1.0},
            {"id": "foam", "op": "spots", "count": 10, "radius": [0.25, 0.45], "ramp": "mist", "tone": 5, "faces": ["up"]}]},
        sides=8)
    # the ship: hull, deck, two masts with sails and a pennant
    S.taper("hull", (2.2, 1.4, 6.0), (-1.4, cy - 0.5, 0), plain("walnut", tone=4.0, noise=0.4, layers=[
        {"id": "planks", "op": "stripes", "axis": "y", "period": 0.45, "width": 0.25, "shift": -0.7},
        {"id": "trim", "op": "band", "axis": "y", "from": 0.55, "to": 1.0, "ramp": "honey", "tone": 4}]),
        rot=(0, 90, 0), front_scale=[0.25, 0.8], back_scale=[0.85, 1.0])
    S.box("deck", (5.2, 0.3, 1.8), (-1.6, cy + 0.25, 0), wood("oak", tone=5, polish=False, knots=False))
    sail = cloth("cream", tone=4.6, weave=0.3)
    for k, (x, h) in enumerate([(-2.8, 4.2), (-0.2, 3.4)]):
        S.cyl(f"mast{k}", 0.15, h, (x, cy + 0.3, 0), plain("walnut", tone=3.0, noise=0), sides=4)
        S.card(f"sail{k}", ["." + "s" * 6 + ".", "s" * 8, "s" * 8, "S" * 8, "s" * 8, "s" * 8, "S" * 8, ".ssssss."],
               (x, cy + 0.6 + h * 0.5, 0.1), flat("cream"), key={"s": "cream:5", "S": "cream:3"}, plane="yz")
    S.card("pennant", ["bbbb", "bb.."], (-2.8 + 0.6, cy + 4.7, 0), flat("berry"), key={"b": "berry:4"})
    return S


@item
def mint_typewriter():
    S = Spec("mint_typewriter", "Mint Typewriter", density=3.0,
             desc="A sage-green enamel typewriter with worn edges: cream round keys, a black platen with brass knobs, a "
                  "sheet of dream-journal paper and a chrome return lever.")
    enamel = plain("sage", tone=4.4, gloss=True, layers=[
        {"id": "chips", "op": "wear", "width": 1, "density": 0.2, "ramp": "iron", "tone": 3}])
    S.taper("body", (15.0, 5.2, 9.0), (0, 2.6 + 0.2, -0.6), enamel, front_scale=[1.0, 0.55], front_shift=[0, -1.15],
            chamfer=0.6)
    for k, x in enumerate((-6.6, 6.6)):
        for kk, z in enumerate((3.2, -4.4)):
            S.box(f"foot{k}{kk}", (1.4, 0.4, 1.4), (x, 0.2, z), plain("soot", tone=2, noise=0))
    # keyboard: three rows of round keys on a sloping deck, and a space bar
    keys = Pix(40, 14)
    for row in range(3):
        for col in range(9 - (row == 2)):
            cx = 3.5 + col * 4.2 + row * 1.6
            cy = 2.5 + row * 4.4
            keys.disc(cx, cy, 1.9, "k")
            keys.ring(cx, cy, 1.9, "r", 0.8)
            keys.set(cx - 0.6, cy - 0.6, "h")
            keys.set(cx, cy, "c" if (row * 9 + col) % 4 == 0 else "k")
    S.card("keys", keys.rows, (0, 3.75, 1.7), flat("cream"), plane="xz", rot=(14.5, 0, 0),
           key={"k": "cream:5", "r": "soot:1", "h": "cream:6", "c": "ink:2"})
    S.box("spacebar", (7.0, 0.5, 0.9), (0, 1.5, 4.6), plain("cream", tone=4.4, gloss=True), chamfer=0.15)
    S.box("basket", (11.0, 1.2, 2.2), (0, 5.4, -1.2), {"ramp": "soot", "tone": 1.8, "rim": dict(light_shift=0.8, dark_shift=-0.6),
                                                      "layers": [{"id": "bars", "op": "stripes", "axis": "x", "period": 0.5,
                                                                  "width": 0.3, "ramp": "silver", "tone": 3.6}]})
    # carriage: platen roller with knobs, paper, bail bar, ribbon spools and the return lever
    S.tube("platen", [(-8.2, 6.6, -3.0), (8.2, 6.6, -3.0)], 1.35, plain("soot", tone=2.2, gloss=True), sides=10)
    for k, x in enumerate((-9.0, 9.0)):
        S.tube(f"pknob{k}", [(x * 0.93, 6.6, -3.0), (x * 1.06, 6.6, -3.0)], [1.0, 0.9], metal("brass"), sides=8)
    page = Pix(26, 26)
    page.rect(0, 0, 25, 25, "p")
    for k in range(9):
        y = 3 + k * 2.4
        n = 14 + int(hsh(k, 7) * 8)
        x = 3
        while x < 3 + n:
            w = 1 + int(hsh(k, x) * 3)
            page.line(x, y, min(x + w, 22), y, "i")
            x += w + 1
    for x in range(26):
        if hsh(x, 99) > 0.6:
            page.set(x, 25, ".")
    S.card("paper", page.rows, (0, 10.6, -3.6), flat("paper"), rot=(-12, 0, 0), key={"p": "paper:5", "i": "ink:2"})
    S.tube("bail", [(-6.0, 7.9, -1.8), (6.0, 7.9, -1.8)], 0.18, metal("silver", tone=5), sides=4)
    S.tube("lever", [(-7.6, 7.4, -2.2), (-9.0, 8.4, -0.8), (-9.8, 8.6, 1.2)], 0.25, metal("silver", tone=5), sides=5)
    for k, x in enumerate((-4.8, 4.8)):
        S.cyl(f"spool{k}", 1.3, 0.7, (x, 5.4, -1.4), plain("berry", tone=3.4, noise=0.3), sides=10)
    S.box("badge", (2.4, 0.7, 0.2), (0, 2.0, 4.0), metal("brass", tone=5.0), rot=(-28, 0, 0))
    return S


# ====================================================================== wall pieces (back flat against z = 0)

def landscape_art(w, h):
    p = Pix(w, h)
    for y in range(h):
        for x in range(w):
            t = y / h
            c = "1" if t < 0.18 else "2" if t < 0.32 else "3" if t < 0.44 else "4"
            if (x + y * 3) % 7 == 0 and 0.1 < t < 0.5:
                c = {"1": "2", "2": "3", "3": "4", "4": "4"}[c]
            p.set(x, y, c)
    p.disc(w * 0.68, h * 0.42, h * 0.14, "s")
    hills = [(0.55, "h"), (0.66, "H"), (0.8, "g")]
    for base, ch in hills:
        for x in range(w):
            top = h * base - math.sin(x / w * 6.3 + base * 9) * h * 0.06 - math.sin(x / w * 13 + base) * h * 0.025
            for y in range(int(top), h):
                p.set(x, y, ch)
    for x in range(w):
        y = int(h * 0.9 - abs(math.sin(x / w * 3)) * h * 0.25)
        if 0.2 < x / w < 0.8:
            p.set(x, y, "p")
            p.set(x, y + 1, "p")
    for k in range(5):
        tx = int(w * (0.08 + k * 0.08))
        ty = int(h * 0.78)
        for d in range(4):
            p.line(tx - d * 0.6, ty - 3 + d, tx + d * 0.6, ty - 3 + d, "t")
    return p.rows


@item
def photo_frames():
    S = Spec("photo_frames", "Family Picture Wall", density=3.0, wall=True,
             desc="A wall of frames on twine and brass pins: a big oak-framed sunset over the far hills, a gilt oval "
                  "moonlit branch, a pressed rosebud under linen and a little round pinecone sketch.")
    oak = wood("oak", tone=4.6, grain="x")
    gilt = metal("gold", tone=4.6)

    def rect_frame(id, cx, cy, w, h, style, art, key, depth=1.2, bar=1.1):
        S.box(f"{id}_back", (w - 0.4, h - 0.4, 0.4), (cx, cy, 0.2), plain("woodDark" if False else "walnut", tone=2.0, noise=0.2))
        S.card(f"{id}_pic", art, (cx, cy, 0.45), flat(next(iter(key.values())).split(":")[0]), key=key)
        S.box(f"{id}_t", (w, bar, depth), (cx, cy + h / 2 - bar / 2, depth / 2), style, chamfer=0.25)
        S.box(f"{id}_b", (w, bar, depth), (cx, cy - h / 2 + bar / 2, depth / 2), style, chamfer=0.25)
        S.box(f"{id}_l", (bar, h - 2 * bar, depth), (cx - w / 2 + bar / 2, cy, depth / 2), style, chamfer=0.25)
        S.box(f"{id}_r", (bar, h - 2 * bar, depth), (cx + w / 2 - bar / 2, cy, depth / 2), style, chamfer=0.25)

    rect_frame("sunset", -7.0, 9.0, 15.0, 11.0, oak, landscape_art(39, 27),
               {"1": "lilac:4", "2": "rose:5", "3": "blush:5", "4": "honey:5", "s": "lamp:6" if False else "honey:7",
                "h": "sage:4", "H": "fern:4", "g": "pine:4", "p": "buff:5", "t": "pine:2"})
    # oval: a moonlit branch, in a gilt oval ring
    ov = Pix(19, 25)
    ov.disc(9.5, 12.5, 9.5, "n", ry=12.5)
    ov.disc(12.5, 7.5, 2.6, "m")
    ov.disc(13.4, 6.8, 2.2, "n")
    ov.map(lambda x, y, c: ("N" if c == "n" and (y < 8) and hsh(x, y) > 0.8 else "*" if c == "n" and hsh(x, y, 2) > 0.965 else c))
    ov.path([(0, 18), (5, 16), (9, 16.5), (14, 14), (19, 13)], "b", 1.6)
    for x, y in [(4, 15), (8, 15.5), (12, 14), (6, 17.5), (11, 16)]:
        ov.disc(x, y - 1, 1.3, "l", ry=0.8)
    S.card("oval_pic", ov.rows, (7.4, 11.0, 0.45), flat("night"),
           key={"n": "night:3", "N": "night:4", "*": "star:3", "m": "moonglow:3", "b": "bark:2", "l": "sage:3"})
    S.tube("oval_ring", [(7.4 + math.cos(a) * 3.4, 11.0 + math.sin(a) * 4.45, 0.7)
                         for a in [i * 2 * math.pi / 16 for i in range(18)]], 0.6, gilt, sides=6, caps=(False, False))
    S.box("oval_back", (6.4, 8.6, 0.4), (7.4, 11.0, 0.2), plain("walnut", tone=2.0, noise=0.2))
    # small square: a pressed rosebud on linen
    rb = Pix(14, 14)
    rb.rect(0, 0, 13, 13, "c")
    rb.map(lambda x, y, c: "C" if (x + y) % 3 == 0 else c)
    rb.line(7, 12, 6, 5, "s")
    rb.disc(6, 4, 2.2, "r", ry=2.6)
    rb.disc(5.5, 3.5, 1.0, "R")
    rb.disc(8.5, 8.5, 1.4, "l", ry=0.8)
    rb.disc(4.5, 9.5, 1.2, "l", ry=0.7)
    rect_frame("rose", 14.0, 4.4, 6.4, 6.4, wood("pale", tone=5.0, grain="x"), rb.rows,
               {"c": "linen:5", "C": "linen:4", "s": "leaf:3", "r": "rose:3", "R": "berry:3", "l": "sage:3"}, bar=0.8)
    # little round frame: a pinecone sketch
    pc = Pix(12, 12)
    pc.disc(6, 6, 6, "p")
    for k in range(5):
        pc.line(6 - (3 - abs(k - 2)), 3 + k * 1.4, 6 + (3 - abs(k - 2)), 3 + k * 1.4, "i")
    pc.line(6, 2, 6, 10, "i")
    S.card("cone_pic", pc.rows, (14.0, 13.6, 0.45), flat("parch"), key={"p": "parch:6", "i": "ink:3"})
    S.tube("cone_ring", circle((14.0, 13.6, 0.65), 2.2, 12, "xy"), 0.45, gilt, sides=5, caps=(False, False))
    S.lathe("cone_back", [(2.1, 0), (2.1, 0.4)], (14.0, 13.6, 0.0), plain("walnut", tone=2, noise=0), rot=(90, 0, 0),
            sides=10, subdiv=0)
    # brass pins and twine
    tw = plain("straw", tone=3.4, noise=0.3)
    for k, (x, y, x0, y0, x1) in enumerate([(-7.0, 18.6, -11.5, 14.5, -2.5), (7.4, 18.6, 5.2, 14.6, 9.6), (14.0, 17.6, 13.0, 15.4, 15.0)]):
        S.ball(f"pin{k}", 0.45, (x, y, 0.5), metal("brass", tone=5.0), sides=6, rings=3)
        S.tube(f"twine{k}", [(x0, y0, 0.3), (x, y - 0.3, 0.45), (x1, y0, 0.3)], 0.12, tw, sides=3, subdiv=0)
    return S


@item
def sunburst_mirror():
    S = Spec("sunburst_mirror", "Sunburst Mirror", density=2.6, wall=True,
             desc="A round looking-glass in a brass ring, with gilt and pale-wood rays bursting out around it, each "
                  "long ray tipped with a little brass bead.")
    cy = 10.0
    S.cyl("backplate", 8.6, 0.5, (0, cy, 0), wood("walnut", tone=3.0, grain="x", polish=False), rot=(90, 0, 0), sides=16,
          caps=(False, True))
    S.cyl("mirror", 7.1, 0.8, (0, cy, 0.3), {
        "ramp": "silver", "tone": 4.2, "light": 0.4, "brush": {"off": True}, "rim": {"light_shift": 1.2, "dark": 0}, "layers": [
            {"id": "sky", "op": "gradient", "axis": "y", "amount": 1.2},
            {"id": "streak", "op": "stripes", "axis": [1, -1, 0], "period": 5.0, "width": 0.14, "phase": 1.0,
             "ramp": "silver", "tone": 7, "faces": ["end"]},
            {"id": "streak2", "op": "stripes", "axis": [1, -1, 0], "period": 5.0, "width": 0.05, "phase": 2.0,
             "ramp": "silver", "tone": 6.4, "faces": ["end"]},
            {"id": "foxing", "op": "patches", "scale": 1.2, "threshold": 0.84, "ramp": "stone", "tone": 3}]},
        rot=(90, 0, 0), sides=16, caps=(False, True))
    S.tube("ring", circle((0, cy, 1.0), 7.4, 18, "xy"), 0.75, metal("brass", tone=4.6), sides=6, caps=(False, False))
    S.tube("ring2", circle((0, cy, 0.7), 8.4, 18, "xy"), 0.45, metal("gold", tone=4.0), sides=5, caps=(False, False))
    for k in range(20):
        a = k * 18 + 9
        long = k % 2 == 0
        L = 7.6 if long else 4.8
        r0 = 8.0
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        c = (ca * (r0 + L / 2), cy + sa * (r0 + L / 2), 0.5)
        st = metal("gold", tone=4.8) if long else wood("pale", tone=5.2, grain="x", knots=False)
        S.taper(f"ray{k}", (0.7, 1.5 if long else 1.2, L), c, st, rot=(0, 90, a), front_scale=[0.6, 0.15],
                back_scale=[1.0, 1.0])
        if long:
            S.ball(f"tip{k}", 0.55, (ca * (r0 + L + 0.3), cy + sa * (r0 + L + 0.3), 0.6), metal("brass", tone=5.0),
                   sides=6, rings=3)
    return S


@item
def owl_tapestry():
    S = Spec("owl_tapestry", "Owl Crest Tapestry", density=3.0, wall=True,
             desc="A pine-green woven banner on a walnut rod with turned finials: a gold-stitched border, the hollow's "
                  "crest of an owl under a crescent moon and seven stars, and gold tassels on its swallowtail.")
    w, h = 15.0, 23.0
    cols, rows = int(w * 3), int(h * 3)
    p = Pix(cols, rows)
    cut = 9
    for y in range(rows):
        for x in range(cols):
            if y > rows - cut and abs(x - cols / 2 + 0.5) < (y - (rows - cut)) * (cols / 2 / cut) * 0.8:
                continue
            p.set(x, y, "a" if (x + y) % 4 < 2 else "b")
    # top hem with loops
    for x in range(cols):
        p.set(x, 0, "d")
        p.set(x, 1, "d" if x % 6 < 4 else "b")
    # border: a gold stitched line inset, with a little running stitch
    for y in range(3, rows - 2):
        for x in (2, cols - 3):
            if p.get(x, y) != ".":
                p.set(x, y, "g" if y % 3 else "G")
    for x in range(2, cols - 2):
        p.set(x, 3, "g" if x % 3 else "G")
    p.outline("e")
    # crest: crescent moon, seven stars on an arc, the owl emblem
    cx, cy = cols / 2, rows * 0.48
    p.disc(cx, cy - 13, 5.2, "m")
    p.disc(cx + 2.4, cy - 14.2, 4.6, "a")
    for k in range(7):
        a = math.radians(200 + k * 23.3)
        p.star(cx + math.cos(a) * 15, cy - 2 + math.sin(a) * 15, 1.7, "s", inner=0.4)
    # the owl: round body, ear tufts, wings, dot eyes, a little beak, on a branch
    p.disc(cx, cy + 4, 6.6, "o", ry=7.4)
    p.poly([(cx - 6, cy - 3.5), (cx - 4.4, cy - 7.5), (cx - 2.4, cy - 3)], "o")
    p.poly([(cx + 6, cy - 3.5), (cx + 4.4, cy - 7.5), (cx + 2.4, cy - 3)], "o")
    p.disc(cx, cy + 6, 4.2, "c", ry=4.6)
    for k in range(3):
        for dx in (-2, 0, 2):
            p.set(cx + dx + (k % 2), cy + 4.5 + k * 1.8, "O")
    p.disc(cx - 2.6, cy - 0.2, 1.9, "c")
    p.disc(cx + 2.6, cy - 0.2, 1.9, "c")
    p.disc(cx - 2.6, cy - 0.2, 0.9, "k")
    p.disc(cx + 2.6, cy - 0.2, 0.9, "k")
    p.poly([(cx - 0.8, cy + 1.2), (cx + 0.8, cy + 1.2), (cx, cy + 2.8)], "y")
    p.path([(cx - 10, cy + 12.2), (cx, cy + 11.6), (cx + 10, cy + 12.4)], "w", 1.4)
    for dx in (-2.5, 2.5):
        p.line(cx + dx - 1, cy + 11, cx + dx + 1, cy + 11, "y")
    for k, dx in enumerate((-7, 7)):
        p.disc(cx + dx, cy + 10.6, 1.3, "l", ry=0.8)
    S.card("banner", p.rows, (0, 3.0 - h / 2, 0.8), flat("pine", light=0.7),
           key={"a": "pine:3", "b": "pine:4", "d": "pine:2", "e": "pine:1", "g": "honey:5", "G": "honey:3",
                "m": "cream:5", "s": "honey:6", "o": "tawny:4", "O": "tawny:2", "c": "cream:4", "k": "soot:0",
                "y": "honey:4", "w": "bark:3", "l": "sage:4"})
    wd = wood("walnut", tone=4.4, grain="x")
    S.tube("rod", [(-9.0, 3.4, 0.9), (9.0, 3.4, 0.9)], 0.55, wd, sides=8)
    for k, s in enumerate((-1, 1)):
        S.lathe(f"finial{k}", [(0.6, 0), (1.0, 0.5), (0.9, 1.0), (0.3, 1.5), (0.2, 1.8)], (s * 9.0, 3.4, 0.9), wd,
                rot=(0, 0, -s * 90), sides=8)
    S.tube("cord", [(-8.0, 3.6, 0.9), (-4.0, 4.6, 0.7), (0, 5.2, 0.5), (4.0, 4.6, 0.7), (8.0, 3.6, 0.9)], 0.16,
           plain("honey", tone=3.6, noise=0.2), sides=4)
    for k, x in enumerate((-w / 2 + 0.4, w / 2 - 0.4)):
        ty = 3.0 - h + cut / 3.0 - 0.1
        S.ball(f"tassel_knot{k}", 0.5, (x, ty, 0.85), metal("gold", tone=4.6), sides=6, rings=3)
        S.lathe(f"tassel{k}", [(0.3, 0), (0.7, -1.6), (0.75, -2.6)], (x, ty - 0.3, 0.85),
                plain("honey", tone=4.0, layers=[{"id": "threads", "op": "stripes", "axis": "around", "period": 0.125,
                                                  "width": 0.4, "shift": -0.9}]), sides=8, caps=(False, True))
    return S


@item
def patch_bunting():
    S = Spec("patch_bunting", "Patchwork Bunting", density=3.0, wall=True,
             desc="Nine cloth pennants cut from old pyjamas, each a different print with stitched edges, folded over a "
                  "sagging twine between two brass pins. They sway a little.")
    n = 9
    pts = [(-24.0 + 48.0 * i / 16, -2.6 * (1 - ((i / 16) * 2 - 1) ** 2) + 0.0, 0.8) for i in range(17)]
    S.tube("twine", pts, 0.18, plain("straw", tone=3.6, noise=0.3), sides=4)
    for k, x in enumerate((-24.2, 24.2)):
        S.ball(f"pin{k}", 0.6, (x, 0.0, 0.5), metal("brass", tone=5.0), sides=6, rings=3)
    prints = [("rose", "linen", "check"), ("sage", "oat", "stripe"), ("dusk", "linen", "dots"), ("berry", "cream", "flower"),
              ("night", "honey", "stars"), ("fern", "ochre", "plaid"), ("lilac", "cream", "dots"),
              ("terracotta", "linen", "stripe"), ("lake", "cream", "check")]
    for k in range(n):
        base, acc, kind = prints[k]
        t = (k + 0.5) / n
        x = -24.0 + 48.0 * t
        y = -2.6 * (1 - (t * 2 - 1) ** 2)
        cols, rows = 16, 24
        p = Pix(cols, rows)
        for yy in range(rows):
            half = (cols / 2) * (1 - yy / rows)
            for xx in range(cols):
                if abs(xx + 0.5 - cols / 2) <= half:
                    c = "a"
                    if kind == "check":
                        c = "b" if ((xx // 3) + (yy // 3)) % 2 else "a"
                    elif kind == "stripe":
                        c = "b" if (xx // 2) % 2 else "a"
                    elif kind == "dots":
                        c = "b" if (xx % 4 == 1 and yy % 4 == 1) or (xx % 4 == 3 and yy % 4 == 3) else "a"
                    elif kind == "plaid":
                        c = "b" if xx % 5 == 2 or yy % 5 == 2 else "a"
                        c = "B" if xx % 5 == 2 and yy % 5 == 2 else c
                    p.set(xx, yy, c)
        if kind == "flower":
            for fx, fy in [(4, 6), (11, 5), (8, 11), (6, 16), (10, 15)]:
                p.disc(fx, fy, 1.4, "b")
                p.set(fx, fy, "B")
        if kind == "stars":
            for fx, fy in [(4, 5), (11, 7), (7, 12), (9, 17)]:
                p.star(fx, fy, 1.8, "b", inner=0.45)
        p.outline("e", inside="e")
        for xx in range(cols):
            if p.get(xx, 2) != ".":
                p.set(xx, 2, "f")
        S.bone(f"flag{k}j", (x, y, 0.8), rot=(0, (hsh(k, 1) - 0.5) * 16, (hsh(k, 2) - 0.5) * 8))
        S.card(f"flag{k}", p.rows, (x, y - rows / 6.0 + 0.2, 0.85), flat(base, light=0.7), parent=f"flag{k}j",
               key={"a": f"{base}:4", "b": f"{acc}:5", "B": f"{acc}:3", "e": f"{base}:2", "f": f"{base}:3"})
    S.anim("idle", 4.0, [{"part": f"flag{k}j", "osc": {"axis": "x", "amp": 7, "cycles": 1, "phase": k * 0.13}}
                         for k in range(n)])
    return S


def scroll_bracket(S, id, x, style):
    """A wrought-iron shelf bracket: a wall bar, an arm under the shelf and a scrolled brace."""
    S.tube(f"{id}_wall", [(x, 1.6, 0.4), (x, 8.8, 0.4)], 0.42, style, sides=5)
    S.tube(f"{id}_arm", [(x, 8.4, 0.4), (x, 8.4, 5.4)], 0.42, style, sides=5)
    sc = bezier((x, 2.2, 0.5), (x, 6.6, 1.0), (x, 8.0, 4.6), 8)
    curl = [(x, 8.0 - 1.4 * math.sin(a) - 0.4, 4.0 + 1.3 * math.cos(a)) for a in [i * 0.55 for i in range(1, 9)]]
    S.tube(f"{id}_scroll", sc + curl, [0.38] * len(sc) + [0.34 - i * 0.02 for i in range(len(curl))], style, sides=5)
    lower = [(x, 2.6 + 1.1 * math.cos(a), 0.5 + 1.0 + 1.0 * math.sin(a)) for a in [-1.6 + i * 0.6 for i in range(9)]]
    S.tube(f"{id}_curl", lower, 0.3, style, sides=5)


@item
def bracket_shelf():
    S = Spec("bracket_shelf", "Bracket Shelf", density=2.8, wall=True,
             desc="A thick oak plank with a moulded front edge, resting on two curly wrought-iron brackets.")
    S.box("plank", (26.0, 1.4, 6.0), (0, 9.3, 3.0), wood("oak", tone=4.6, grain="x"), chamfer=0.35)
    S.box("lip", (26.4, 0.5, 0.7), (0, 8.85, 6.0), wood("oak", tone=4.0, grain="x", knots=False), chamfer=0.15)
    iron = metal("iron", tone=4.2, tarnish=False)
    for k, x in enumerate((-9.0, 9.0)):
        scroll_bracket(S, f"br{k}", x, iron)
        for y in (3.0, 7.6):
            S.ball(f"br{k}_screw{int(y)}", 0.4, (x, y, 0.75), metal("brass", tone=4.6), sides=6, rings=3)
    return S


@item
def chalet_cuckoo():
    S = Spec("chalet_cuckoo", "Chalet Cuckoo Clock", density=3.0, wall=True,
             desc="A carved walnut chalet clock: shingled roof with a carved bird on the ridge, leaf carvings, a cream "
                  "dial, a little door where a wooden owlet pops out to hoot, a leaf pendulum and pinecone weights.")
    wd = wood("walnut", tone=4.4, grain="y")
    S.box("case", (11.0, 11.6, 4.0), (0, 9.8, 2.0), wd, chamfer=0.3)
    S.box("ledge", (12.4, 0.8, 4.8), (0, 3.8, 2.4), wd, chamfer=0.25)
    # gable front (a carved triangle) and the shingled roof
    g = Pix(36, 18)
    g.poly([(0, 18), (18, 0), (36, 18)], "a")
    g.map(lambda x, y, c: ("b" if c == "a" and (x + y * 2) % 5 == 0 else c))
    g.disc(18, 11, 3.4, "d", ry=3.8)
    g.rect(15, 11, 21, 17, "d")
    g.ring(18, 11, 3.6, "e", 1.0, ry=4.0)
    S.card("gable", g.rows, (0, 15.6 + 3.0, 4.05), flat("walnut"), key={"a": "walnut:4", "b": "walnut:3", "d": "soot:0",
                                                                       "e": "honey:4"})
    shingle = {"ramp": "walnut", "tone": 3.4, "rim": {"light_shift": 1.0, "dark_shift": -1.0}, "layers": [
        {"id": "shingles", "op": "scales", "shape": "round", "along": "z", "size": [1.0, 0.9], "gap": 0.8,
         "highlight": 0.8, "shadow": -1.1, "jitter": 0.5}]}
    for k, s in enumerate((-1, 1)):
        S.box(f"roof{k}", (8.6, 0.7, 6.2), (s * 3.3, 18.7, 2.7), shingle, rot=(0, 0, -s * 40), chamfer=0.15)
    S.card("bird", ["..aa....", ".aaaa..a", "aaaaaaaa", ".aaaaaa.", "..a..a.."], (0, 22.9, 2.6), flat("walnut"),
           key={"a": "walnut:5"}, plane="xy")
    # carved leaves round the dial
    lv = Pix(12, 7)
    lv.poly([(0, 3.5), (5, 0), (12, 3.5), (5, 7)], "l")
    lv.line(0, 3.5, 11, 3.5, "v")
    for k, (x, y, rz) in enumerate([(-4.0, 13.2, 30), (4.0, 13.2, -30), (-4.4, 6.0, -40), (4.4, 6.0, 40), (0, 4.9, 0)]):
        S.card(f"leaf{k}", lv.rows, (x, y, 4.05), flat("walnut"), key={"l": "walnut:5", "v": "walnut:2"}, rot=(0, 0, rz))
    S.card("dial", dial_art(21), (0, 9.4, 4.06), flat("cream"),
           key={"b": "brass:4", "f": "cream:5", "r": "cream:3", "t": "ink:1"})
    S.card("hand_h", hand_art(5), (-0.6, 9.7, 4.12), flat("ink"), key={"t": "ink:1"}, rot=(0, 0, 60), pivot=(0, 9.4, 4.12))
    S.card("hand_m", hand_art(8), (0, 10.7, 4.14), flat("ink"), key={"t": "ink:1"}, pivot=(0, 9.4, 4.14))
    # the owlet who pops out of the door to hoot
    S.bone("owlet", (0, 16.6, 2.6))
    S.ball("owlet_body", 1.2, (0, 16.4, 3.0), plain("tawny", tone=4.0, layers=[
        {"id": "belly", "op": "band", "axis": "z", "from": 0.2, "to": 1.0, "ramp": "cream", "tone": 4.4}]),
        parent="owlet", sides=8, rings=5, squash=(1, 1.15, 1))
    S.ball("owlet_head", 1.05, (0, 18.3, 3.0), plain("tawny", tone=4.4, layers=[
        {"id": "eyes", "op": "spots", "centers": [[-0.45, 1.25, 0.95, 0.22], [0.45, 1.25, 0.95, 0.22]],
         "ramp": "soot", "tone": 0.4, "roughness": 0}]), parent="owlet", sides=8, rings=5)
    S.card("owlet_beak", ["a", "a"], (0, 18.1, 4.06), flat("honey"), key={"a": "honey:4"}, parent="owlet")
    # pendulum with a carved leaf bob, and two pinecone weights on chains
    S.bone("pend", (0, 4.2, 2.6))
    S.box("rod", (0.4, 8.0, 0.25), (0, 0.2, 2.6), wood("walnut", tone=3.6, knots=False, polish=False), parent="pend")
    bob = Pix(12, 15)
    bob.poly([(6, 0), (11.5, 6), (9, 13), (6, 15), (3, 13), (0.5, 6)], "a")
    bob.line(6, 1, 6, 14, "v")
    for k in range(4):
        bob.line(6, 4 + k * 2.6, 2.5, 2.5 + k * 2.6, "v")
        bob.line(6, 4 + k * 2.6, 9.5, 2.5 + k * 2.6, "v")
    S.card("bob", bob.rows, (0, -6.0, 2.7), flat("walnut"), key={"a": "walnut:5", "v": "walnut:3"}, parent="pend")
    chain = metal("iron", tone=4.4, tarnish=False)
    cone = {"ramp": "walnut", "tone": 4.0, "rim": {"light_shift": 1.0, "dark_shift": -1.0}, "layers": [
        {"id": "scales", "op": "scales", "shape": "round", "along": "x", "size": [0.9, 0.8], "gap": 0.7, "highlight": 1.0,
         "shadow": -1.2}]}
    for k, (x, bottom) in enumerate([(-3.0, -12.4), (3.0, -9.2)]):
        S.tube(f"chain{k}", [(x, 4.0, 2.0), (x, bottom + 4.4, 2.0)], 0.14, chain, sides=4, subdiv=0)
        S.lathe(f"cone{k}", [(0.3, 0), (1.0, 0.6), (1.25, 1.8), (1.05, 3.0), (0.5, 3.8), (0.25, 4.2)], (x, bottom, 2.0),
                cone, sides=8)
    S.anim("idle", 6.0, [
        {"part": "pend", "osc": {"axis": "z", "amp": 10, "cycles": 4}},
        {"part": "owlet", "channel": "position", "keys": [[0, [0, 0, -1.6]], [3.6, [0, 0, -1.6]], [3.9, [0, 0, 1.4], "out_back"],
                                                          [5.1, [0, 0, 1.4]], [5.5, [0, 0, -1.6], "in"]]},
        {"part": "owlet_head", "keys": [[0, 0], [4.0, 0], [4.3, 14], [4.6, -14], [4.9, 0]], "axis": "z"},
    ])
    return S


def map_art(cols, rows):
    p = Pix(cols, rows)
    for y in range(rows):
        for x in range(cols):
            n = hsh(x // 3, y // 3, 5) * 0.6 + hsh(x, y, 6) * 0.4
            p.set(x, y, "q" if n > 0.82 else "P" if n < 0.12 else "p")
    for x in range(cols):
        for y in (1, rows - 2):
            p.set(x, y, "i")
    for y in range(rows):
        for x in (1, cols - 2):
            p.set(x, y, "i")
    for x in range(3, cols - 3):
        if x % 2 == 0:
            p.set(x, 3, "j")
            p.set(x, rows - 4, "j")
    # river
    river = [(cols * 0.05, rows * 0.25)]
    for k in range(1, 12):
        t = k / 11
        river.append((cols * (0.05 + 0.9 * t), rows * (0.25 + 0.5 * t) + math.sin(t * 9) * rows * 0.08))
    p.path(river, "r", 2.2)
    p.path(river, "R", 0.8)
    # lake
    p.disc(cols * 0.74, rows * 0.72, cols * 0.1, "r", ry=rows * 0.12)
    p.disc(cols * 0.74, rows * 0.72, cols * 0.06, "R", ry=rows * 0.07)
    # hills
    for k, (hx, hy) in enumerate([(0.15, 0.62), (0.22, 0.7), (0.32, 0.6)]):
        x0, y0 = cols * hx, rows * hy
        p.path([(x0 - 4, y0 + 2), (x0, y0 - 2), (x0 + 4, y0 + 2)], "h")
    # forest of little trees
    for k in range(26):
        x = cols * (0.38 + hsh(k, 1) * 0.3)
        y = rows * (0.12 + hsh(k, 2) * 0.32)
        p.poly([(x - 1.5, y + 2), (x, y - 1.5), (x + 1.5, y + 2)], "t")
        p.set(x, y + 2, "w")
    # the great oak (the hollow) with its door
    ox, oy = cols * 0.2, rows * 0.36
    p.disc(ox, oy - 2, 4.6, "T", ry=3.6)
    p.rect(ox - 1, oy + 1, ox + 1, oy + 5, "w")
    p.set(ox, oy + 3, "d")
    # dashed paths
    path = [(ox, oy + 5), (cols * 0.3, rows * 0.55), (cols * 0.45, rows * 0.62), (cols * 0.6, rows * 0.5),
            (cols * 0.8, rows * 0.3)]
    for a, b in zip(path, path[1:]):
        n = int(math.hypot(b[0] - a[0], b[1] - a[1]))
        for s in range(n):
            if s % 3 < 2:
                p.set(a[0] + (b[0] - a[0]) * s / n, a[1] + (b[1] - a[1]) * s / n, "i")
    # X marks the blueberry bush
    bx, by = cols * 0.8, rows * 0.28
    p.disc(bx + 3, by + 1, 1.6, "b")
    p.line(bx - 1.5, by - 1.5, bx + 1.5, by + 1.5, "x")
    p.line(bx - 1.5, by + 1.5, bx + 1.5, by - 1.5, "x")
    # compass rose
    cx, cy = cols * 0.88, rows * 0.78
    p.poly([(cx, cy - 5), (cx + 1.2, cy), (cx, cy + 5), (cx - 1.2, cy)], "c")
    p.poly([(cx - 5, cy), (cx, cy - 1.2), (cx + 5, cy), (cx, cy + 1.2)], "c")
    p.set(cx, cy - 6, "i")
    # title scribble
    for x in range(int(cols * 0.08), int(cols * 0.34)):
        if hsh(x, 3) > 0.3:
            p.set(x, rows * 0.1, "i")
    return p.rows


@item
def hollow_map():
    S = Spec("hollow_map", "Map of the Hollow", density=3.0, wall=True,
             desc="A parchment map of every path Pip has flown, hung between two walnut dowels: the great oak, the "
                  "winding river and lake, a little forest, dashed paths, a compass rose and an X at the best "
                  "blueberry bush.")
    w, h = 27.0, 17.0
    S.card("map", map_art(int(w * 3), int(h * 3)), (0, 9.4, 0.6), flat("parch", light=0.7),
           key={"p": "parch:5", "q": "parch:6", "P": "parch:4", "i": "ink:2", "j": "ochre:3", "r": "lake:4",
                "R": "lake:5", "h": "fern:3", "t": "pine:4", "w": "bark:3", "T": "leaf:4", "d": "soot:0",
                "b": "dusk:3", "x": "berry:3", "c": "berry:4"})
    wd = wood("walnut", tone=4.4, grain="x", knots=False)
    for k, y in enumerate((18.2, 0.6)):
        S.tube(f"dowel{k}", [(-14.4, y, 0.7), (14.4, y, 0.7)], 0.7, wd, sides=8)
        S.tube(f"roll{k}", [(-13.6, y + (-0.5 if k == 0 else 0.5), 0.55), (13.6, y + (-0.5 if k == 0 else 0.5), 0.55)],
               0.55, paper("parch", tone=4.6), sides=8)
        for s in (-1, 1):
            S.ball(f"knob{k}{s}", 0.9, (s * 15.0, y, 0.7), wd, sides=8, rings=4)
    S.tube("cord", [(-13.0, 18.6, 0.7), (-6.0, 19.4, 0.5), (0, 19.8, 0.3), (6.0, 19.4, 0.5), (13.0, 18.6, 0.7)], 0.14,
           plain("honey", tone=3.4, noise=0.2), sides=4)
    return S


@item
def dream_catcher():
    S = Spec("dream_catcher", "Moonthread Dream Catcher", density=3.2, wall=True,
             desc="A leather-wrapped willow hoop strung with a cream moonthread web and glass beads, a moonstone at "
                  "its heart, and three soft feathers swaying on beaded strings.")
    cy = 14.6
    S.tube("hoop", circle((0, cy, 0.8), 5.0, 18, "xy"), 0.45, {
        "ramp": "tawny", "tone": 3.8, "rim": {"light_shift": 0.8, "dark_shift": -0.9}, "layers": [
            {"id": "wrap", "op": "stripes", "axis": "path", "period": 0.7, "width": 0.4, "shift": -1.0}]},
        sides=6, caps=(False, False))
    web = Pix(30, 30)
    c = 15
    for ring, r in enumerate((13.5, 10, 6.6, 3.6)):
        pts = []
        for k in range(9):
            a = math.radians(k * 40 + ring * 20)
            pts.append((c + math.cos(a) * r, c + math.sin(a) * r))
        for a, b in zip(pts, pts[1:] + pts[:1]):
            web.line(a[0], a[1], b[0], b[1], "w")
    for k in range(9):
        a = math.radians(k * 40)
        web.line(c + math.cos(a) * 3.6, c + math.sin(a) * 3.6, c + math.cos(a) * 14, c + math.sin(a) * 14, "W")
    for k, (r, ch) in enumerate([(10, "b"), (6.6, "B"), (13.5, "b")]):
        a = math.radians(k * 97 + 15)
        web.disc(c + math.cos(a) * r, c + math.sin(a) * r, 0.9, ch)
    web.disc(c, c, 1.8, "m")
    web.set(c - 1, c - 1, "M")
    S.card("web", web.rows, (0, cy, 0.8), flat("cream"),
           key={"w": "cream:5", "W": "cream:4", "b": "lake:4", "B": "honey:5", "m": "moonglow:2", "M": "moonglow:4"})
    S.tube("loop", circle((0, cy + 5.9, 0.8), 0.9, 8, "xy"), 0.14, plain("tawny", tone=3.6), sides=4, caps=(False, False))
    feather_cols = ["buff", "tawny", "cream"]
    for k, (x, L) in enumerate([(-3.2, 4.0), (0.0, 6.0), (3.2, 4.0)]):
        top = cy - math.sqrt(max(0.0, 25 - x * x)) + 0.2
        S.bone(f"f{k}j", (x, top, 0.8))
        S.box(f"f{k}_string", (0.15, L, 0.15), (x, top - L / 2, 0.8), plain("cream", tone=4.0, noise=0), parent=f"f{k}j")
        S.ball(f"f{k}_bead", 0.5, (x, top - L * 0.45, 0.8), plain(["lake", "honey", "rose"][k], tone=4.2, gloss=True),
               parent=f"f{k}j", sides=6, rings=3)
        fp = Pix(7, 22)
        for y in range(22):
            half = 3.3 * math.sin(math.pi * min(1, (y + 2) / 22)) ** 0.8
            for xx in range(7):
                dx = xx + 0.5 - 3.5
                if abs(dx) <= half:
                    fp.set(xx, y, "s" if xx == 3 else ("a" if (y + (xx > 3)) % 3 else "b"))
        fcol = feather_cols[k]
        S.card(f"f{k}_feather", fp.rows, (x, top - L - 3.4, 0.82), flat(fcol), parent=f"f{k}j",
               key={"a": f"{fcol}:5", "b": f"{fcol}:3", "s": f"{fcol}:1"}, rot=(0, 0, (k - 1) * 6))
    S.anim("idle", 4.0, [{"part": f"f{k}j", "osc": {"axis": "z", "amp": 6, "cycles": 1, "phase": k * 0.3}} for k in range(3)])
    return S


def paper_star(r=6, folded=True):
    """A folded paper star: each arm has a lit half and a shaded half (reads as a 3D fold)."""
    n = int(r * 2 + 1)
    p = Pix(n, n)
    c = n / 2
    p.star(c, c, r, "a", inner=0.48)
    if folded:
        for y in range(n):
            for x in range(n):
                if p.get(x, y) != ".":
                    a = (math.degrees(math.atan2(y + 0.5 - c, x + 0.5 - c)) + 90) % 72
                    p.set(x, y, "a" if a < 36 else "b")
    p.outline("e", inside="e")
    return p.rows


@item
def star_garland():
    S = Spec("star_garland", "Paper Star Garland", density=3.0, wall=True,
             desc="Folded paper stars in oat, sage, rose and gold on cotton threads hanging from a sagging string; the "
                  "golden ones glow and twinkle when the lamps go down.")
    pts = [(-22.0 + 44.0 * i / 16, -1.8 * (1 - ((i / 16) * 2 - 1) ** 2), 0.8) for i in range(17)]
    S.tube("string", pts, 0.15, plain("linen", tone=3.6, noise=0.2), sides=4)
    for k, x in enumerate((-22.2, 22.2)):
        S.ball(f"pin{k}", 0.55, (x, 0.0, 0.5), metal("brass", tone=5.0), sides=6, rings=3)
    cols = ["oat", "sage", "rose", "gold", "linen", "lake", "gold", "rose", "sage", "gold", "oat"]
    tracks = []
    for k in range(11):
        t = (k + 0.5) / 11
        x = -22.0 + 44.0 * t
        y = -1.8 * (1 - (t * 2 - 1) ** 2)
        L = 4.0 + hsh(k, 5) * 9.0
        S.bone(f"d{k}", (x, y, 0.8))
        S.box(f"d{k}_thread", (0.12, L, 0.12), (x, y - L / 2, 0.8), plain("cream", tone=4.0, noise=0), parent=f"d{k}")
        nstars = 1 + (k % 3 == 1)
        for s in range(nstars):
            sy = y - L + s * 5.0
            ck = cols[(k + s * 4) % len(cols)]
            r = 7 if s == 0 else 6
            if ck == "gold":
                nm = f"glow_star{k}_{s}"
                S.card(nm, paper_star(r), (x, sy - r / 3.0, 0.85), glow("star"), parent=f"d{k}",
                       key={"a": "star:4", "b": "star:2", "e": "star:1"}, rot=(0, (hsh(k, s) - 0.5) * 50, 0))
                tracks.append({"part": nm, "channel": "scale", "osc": {"amp": [0.18, 0.18, 0.18], "cycles": 2,
                                                                       "phase": hsh(k, 9), "shape": "sine"}})
            else:
                S.card(f"star{k}_{s}", paper_star(r), (x, sy - r / 3.0, 0.85), flat(ck), parent=f"d{k}",
                       key={"a": f"{ck}:5", "b": f"{ck}:3", "e": f"{ck}:2"}, rot=(0, (hsh(k, s) - 0.5) * 50, 0))
        tracks.append({"part": f"d{k}", "osc": {"axis": "z", "amp": 4, "cycles": 1, "phase": hsh(k, 3)}})
    S.anim("idle", 4.0, tracks)
    return S


@item
def hat_rack():
    S = Spec("hat_rack", "Peg Rail with Hats", density=3.0, wall=True,
             desc="An oak peg rail with four turned pegs: Pip's striped nightcap with a pompom, a straw sunhat with a "
                  "berry ribbon and daisies, and a long knitted scarf that is mostly holes and love.")
    oak = wood("oak", tone=4.6, grain="x")
    S.box("rail", (26.0, 3.6, 1.0), (0, 1.8, 0.5), oak, chamfer=0.35)
    for k, x in enumerate((-9.6, -3.2, 3.2, 9.6)):
        S.lathe(f"peg{k}", [(0.7, 0), (0.5, 1.2), (0.45, 3.0), (0.9, 3.4), (0.7, 3.9)], (x, 1.8, 1.0), oak, rot=(80, 0, 0),
                sides=8)
    # nightcap on peg 0: a floppy striped cone with a pompom
    cap = cloth("dusk", tone=3.8, weave=0.4, layers=[
        {"id": "stripes", "op": "stripes", "axis": "path", "period": 1.6, "width": 0.45, "ramp": "cream", "tone": 4.6}])
    S.tube("nightcap", [(-9.6, 2.6, 3.6), (-9.4, 0.6, 3.9), (-8.8, -2.8, 3.6), (-7.6, -5.6, 3.0), (-6.4, -7.2, 2.6)],
           [(2.4, 1.4), (2.2, 1.3), (1.5, 1.0), (0.9, 0.7), (0.35, 0.3)], cap, sides=8, caps=(True, False))
    S.ball("pompom", 1.0, (-6.1, -7.6, 2.6), knit("cream", tone=4.6), sides=8, rings=4)
    # sunhat on peg 1/2: straw brim and crown, a berry ribbon and two daisies
    straw = {"ramp": "straw" if False else "buff", "tone": 4.6, "rim": {"light_shift": 0.8, "dark_shift": -0.9}, "layers": [
        {"id": "weave", "op": "stripes", "axis": "around", "period": 0.0625, "width": 0.5, "shift": -0.7},
        {"id": "rows", "op": "stripes", "axis": "path", "period": 0.5, "width": 0.4, "shift": 0.5}]}
    hc = (0.0, -1.2, 1.2)
    S.lathe("brim", [(7.0, 0.0), (6.6, 0.3), (3.4, 0.55)], hc, straw, rot=(78, 0, 0), sides=16, caps=(True, True))
    S.lathe("crown", [(3.5, 0.4), (3.4, 2.4), (2.9, 3.6), (1.8, 4.0)], hc, straw, rot=(78, 0, 0), sides=14)
    S.lathe("ribbon", [(3.55, 0.5), (3.5, 1.3)], hc, plain("berry", tone=3.8, gloss=True), rot=(78, 0, 0), sides=14,
            caps=(False, False), subdiv=0)
    daisy = Pix(18, 18)  # drawn at the final (HD) density: thin petals round a honey heart
    for k in range(12):
        a = k * math.pi / 6
        for t in range(3, 9):
            daisy.disc(9 + math.cos(a) * t, 9 + math.sin(a) * t, 0.9 if t < 8 else 0.6, "p" if t < 7 else "P")
    daisy.disc(9, 9, 2.8, "c")
    daisy.disc(8.4, 8.4, 1.0, "C")
    for k, (x, y) in enumerate([(-3.0, 0.4), (-1.6, -0.6)]):
        S.card(f"daisy{k}", daisy.rows, (x, y, 5.0), flat("cream"), native=True, rot=(-12, 0, 0),
               key={"p": "cream:6", "P": "cream:4", "c": "honey:4", "C": "honey:6"})
    # scarf over peg 3: two knitted tails with fringes
    sc = knit("fern", tone=3.8, layers=[
        {"id": "bands", "op": "stripes", "axis": "path", "period": 3.0, "width": 0.3, "ramp": "ochre", "tone": 4.4},
        {"id": "holes", "op": "spots", "count": 6, "radius": [0.2, 0.3], "ramp": "fern", "tone": 0.8}])
    S.tube("scarf_over", [(8.0, 2.4, 2.4), (9.6, 3.0, 3.4), (11.2, 2.4, 2.4)], [(1.4, 0.4)] * 3, sc, sides=6)
    S.tube("scarf_a", [(8.0, 2.4, 2.4), (8.2, -2.0, 2.2), (8.6, -7.0, 2.0), (8.4, -9.6, 1.8)], [(1.3, 0.4)] * 4, sc, sides=6,
           up=[0, 0, 1])
    S.tube("scarf_b", [(11.2, 2.4, 2.4), (11.0, -1.0, 2.2), (11.4, -4.6, 2.1)], [(1.3, 0.4)] * 3, sc, sides=6, up=[0, 0, 1])
    fr = ["a.a.a.a.", "a.a.a.a.", "a..a.a.a", ".a.a..a.", ".a..a.a."]
    S.card("fringe_a", fr, (8.4, -10.4, 1.8), flat("fern"), key={"a": "ochre:4"})
    S.card("fringe_b", fr, (11.4, -5.4, 2.1), flat("fern"), key={"a": "ochre:4"})
    return S
