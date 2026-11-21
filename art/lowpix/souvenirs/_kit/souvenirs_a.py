"""Souvenirs, part A: the Scottish Highlands, Paris, Venice and Santorini (Kyoto's lantern and torii and the
macaron tower are borrowed from Gacha Garage, see docs/credits/globe.md).
Units: px (16 per block), origin bottom-centre, facing +Z; wall items hang with their back on z = 0."""
import math

from kit import (UP, Spec, bead, brass, cloth, felt, flat, full_stamp, glass, glaze, glow, iron, lacquer, marble, paper,
                 plush, stone, wood)

ITEMS = {}


def item(fn):
    ITEMS[fn.__name__] = fn
    return fn


# ------------------------------------------------------------------------------------------------ the Highlands
def tartan_art(W, H):
    """A Highlands sett: moss ground, heather and loch-blue bands, a fine honey overcheck; twill-dotted crossings."""
    sett = [("g", 12), ("p", 6), ("g", 3), ("b", 10), ("y", 2), ("b", 10), ("g", 3), ("p", 6), ("g", 12), ("k", 4)]
    seq = []
    for c, n in sett:
        seq += [c] * n
    rank = {"g": 0, "p": 1, "b": 2, "y": 3, "k": 4}
    rows = []
    for y in range(H):
        row = ""
        cy = seq[(y // 1) % len(seq)]
        for x in range(W):
            cx = seq[x % len(seq)]
            # twill: crossings alternate warp/weft on a diagonal
            c = cx if (x + y) % 4 < 2 else cy
            if rank[cx] + rank[cy] >= 5 and (x + y) % 2:
                c = "d"
            if y < 3 or y >= H - 3:
                c = "e" if (x % 3) else "k"
            row += c
        rows.append(row)
    return rows


@item
def sv_tartanrug():
    """A woven Highland tartan blanket used as a rug, fringed at both ends, one corner turned over."""
    s = Spec("sv_tartanrug", "Highland Tartan Rug", density=4, tris=600, hero=(30, 40))
    W, D = 44, 30
    rug = s.style("rug", cloth("moss", 4.0, weave=0.6, photo="rough_linen", scale=6))
    tw, th = round(W * 4), round(D * 4)
    key = {"g": "moss:3", "p": "plum:4", "b": "dusk:3", "y": "honey:5", "k": "pine:1", "d": "night:3", "e": "moss:2"}
    s.box("rug", [W, 0.8, D], rug, (0, 0.4, 0), chamfer=0.2,
          paint={"stamps": [full_stamp("top", tartan_art(tw, th), key)]})
    fringe = ["".join("|" if (x % 2 == 0 and (y < 2 or x % (4 + y) == 0)) else "." for x in range(tw)) for y in range(4)]
    fr = s.style("fringe", flat("oat", 4.0, light=0.6, outline="none"))
    for k, z in enumerate((D / 2, -D / 2)):
        s.card(f"fringe{k}", fringe, fr, at=(0, 0.05, z + (0.5 if k == 0 else -0.5)), plane="xz", key={"|": "oat:5"},
               size=[W - 1, 1], rot=(0, 0 if k == 0 else 180, 0))
    # the turned-over corner shows the back of the weave
    back = s.style("back", cloth("moss", 3.2, weave=0.8, photo="rough_linen", scale=6))
    s.add("corner", "prism", [6, 6, 0.6], back, centre=(W / 2 - 3.2, 0.95, D / 2 - 3.2), rot=(-90, 45, 0), sides=3, angle=180)
    return s


@item
def sv_highlandcow():
    """A Highland cow plush: long russet fleece, a fringe over its eyes, cream horns, little hooves."""
    s = Spec("sv_highlandcow", "Highland Cow Plush", density=6, tris=1600, hero=(34, 18))
    fur = s.style("fur", plush("russet", 4.0, seed=1))
    furl = s.style("furl", plush("russet", 4.4, seed=2))
    nose = s.style("nose", felt("rose", 3.6))
    horn = s.style("horn", glaze("cream", 4.6, speck=False))
    hoof = s.style("hoof", felt("soot", 2.4))
    eye = s.style("eye", bead())
    # body along z, head at +z
    s.loft("body", [((0, 0, -6.2), [6.4, 5.6]), ((0, 0.4, -4), [8.6, 7.8]), ((0, 0.6, 0), [9.2, 8.4]), ((0, 0.4, 3.4), [8.4, 7.8]), ((0, 0.2, 5.2), [6.4, 6.2])],
           fur, at=(0, 6.2, 0), sides=10, round_=2.3)
    for k, (x, z) in enumerate([(-2.6, 3.2), (2.6, 3.2), (-2.6, -3.6), (2.6, -3.6)]):
        s.cyl(f"leg{k}", 2.6, 3.2, fur, (x, 0.9, z), sides=8, bottom=0.92)
        s.cyl(f"hoof{k}", 2.4, 1.0, hoof, (x, 0, z), sides=8)
    s.loft("head", [((0, 0, -1.2), [6.4, 6.2]), ((0, 0, 1.0), [6.8, 6.4]), ((0, -0.6, 2.8), [5.4, 4.8]), ((0, -1.0, 3.8), [4.4, 3.6])],
           furl, at=(0, 8.4, 5.8), sides=10, round_=2.2)
    s.box("muzzle", [3.8, 2.4, 1.2], nose, (0, 7.0, 9.9), chamfer=0.5)
    for sx in (-1, 1):
        s.cyl(f"nostril{sx}", 0.6, 0.3, s.style("nost", felt("berry", 2.0)), (sx * 0.8, 7.3, 10.5), sides=6)
        s.add(f"eye{sx}", "prism", [0.9, 0.9, 0.5], eye, centre=(sx * 1.7, 9.0, 8.9), sides=6, rot=(0, sx * 18, 0))
        # horns: out, then up
        s.add(f"horn{sx}a", "prism", [1.2, 1.2, 3.2], horn, at=(sx * 2.4, 10.6, 6.2), centre=(sx * 3.8, 10.9, 6.2), rot=(0, sx * 90, sx * 12), sides=6, front_scale=[0.8, 0.8])
        s.add(f"horn{sx}b", "prism", [1.0, 1.0, 2.4], horn, at=(sx * 5.1, 11.1, 6.2), centre=(sx * 5.5, 12.2, 6.2), rot=(-90, 0, sx * -20), sides=6, front_scale=[0.3, 0.3])
        s.add(f"ear{sx}", "taper", [2.4, 1.0, 1.6], furl, centre=(sx * 3.6, 9.6, 5.4), rot=(0, 0, sx * -25), front_scale=[0.7, 0.6])
    # the famous fringe: shaggy strands over the eyes
    fr = ["aabaababaabaababaa", "abaababaabaababaab", "babaabaababaababab", "abaab.abaa.baabab.", "ba.ab.ab.a.ba.ab.a", "a..a..b...a..b..a.", "...a.......a......"]
    s.card("fringe", fr, s.style("fringe", flat("russet", 4.4, light=0.6, outline="none")), at=(0, 10.4, 9.4), plane="xy",
           key={"a": "russet:4", "b": "russet:6"}, size=[6.4, 2.8], rot=(10, 0, 0))
    tail = [".a.", "aba", ".a.", ".b.", "aba", "bab", ".a."]
    s.card("tail", tail, s.style("tailst", flat("russet", 4.0, light=0.6, outline="none")), at=(0, 6.4, -6.3), plane="xy", key={"a": "russet:4", "b": "tawny:5"}, size=[1.4, 3.2], rot=(-10, 0, 0))
    return s


# ------------------------------------------------------------------------------------------------ Kyoto
# ------------------------------------------------------------------------------------------------ Paris
@item
def sv_eiffellamp():
    """The Eiffel Tower in wrought iron as a lamp: four legs with arches, two platforms, a spire with a warm beacon."""
    s = Spec("sv_eiffellamp", "Eiffel Tower Lamp", density=7, tris=1600, hero=(30, 14))
    fe = s.style("fe", {**iron("brass", 2.6), "layers": [
        {"id": "lattice", "op": "grille", "rect": [0, 0, 1, 1], "period": 3, "dir": "h", "slit_tone": 1.2},
        {"id": "x", "op": "stripes", "axis": [1, 1, 0], "period": 1.4, "width": 0.18, "shift": -1.2},
        {"id": "x2", "op": "stripes", "axis": [-1, 1, 0], "period": 1.4, "width": 0.18, "shift": -1.2},
        {"id": "bulbs", "op": "spots", "count": 30, "radius": [0.16, 0.22], "ramp": "glow", "tone": 5.0},
        {"id": "polish", "op": "gloss", "dash": True, "length": 2, "shift": 1.2, "density": 0.4, "post": True}]})
    base = s.style("base", lacquer("lacquer", 2.8))
    s.cyl("plinth", 12, 1.4, base, (0, 0, 0), sides=12, top=0.92)
    s.cyl("plinthtop", 10.6, 0.5, s.style("brassb", lacquer("lacquer", 3.6)), (0, 1.4, 0), sides=12)
    s.cyl("plinthring", 11.2, 0.3, s.style("brassr", brass()), (0, 1.2, 0), sides=12)
    # legs lean in from the corners
    for k, (sx, sz) in enumerate([(-1, -1), (1, -1), (-1, 1), (1, 1)]):
        bx, bz, tx, tz = sx * 4.2, sz * 4.2, sx * 1.9, sz * 1.9
        ang_x = math.degrees(math.atan2((bz - tz), 7.4))
        ang_z = math.degrees(math.atan2((bx - tx), 7.4))
        s.add(f"leg{k}", "taper", [1.4, 1.4, 7.8], fe, centre=((bx + tx) / 2, 5.8, (bz + tz) / 2), rot=(-90 - ang_x, 0, ang_z), front_scale=[0.7, 0.7])
    arch = ["....aaaaaaaaaaaa....", "..aaa..........aaa..", ".aa..............aa.", "aa................aa", "a..................a"]
    for k, (pl, rot) in enumerate([((0, 4.6, 4.0), 0), ((0, 4.6, -4.0), 180), ((4.0, 4.6, 0), 90), ((-4.0, 4.6, 0), -90)]):
        s.card(f"arch{k}", arch, s.style("archst", flat("brass", 2.6, outline="none")), at=pl, plane="xy", key={"a": "brass:3"}, size=[6.6, 2.2], rot=(0, rot, 0))
    s.box("deck1", [7.4, 0.8, 7.4], fe, (0, 9.6, 0))
    s.add("mid", "taper", [4.6, 4.6, 5.2], fe, centre=(0, 12.6, 0), rot=UP, front_scale=[0.5, 0.5])
    s.box("deck2", [3.4, 0.6, 3.4], fe, (0, 15.3, 0))
    s.add("spire", "taper", [2.4, 2.4, 6.0], fe, centre=(0, 18.6, 0), rot=UP, front_scale=[0.28, 0.28])
    s.cyl("cupola", 1.0, 1.0, fe, (0, 21.5, 0), sides=6)
    s.cyl("glow_beacon", 0.9, 1.0, s.style("beam", glow("glow", 5.0)), (0, 22.4, 0), sides=6)
    s.anim("idle", 3.0, [{"part": "glow_beacon", "channel": "scale", "osc": {"amp": [0.25, 0.25, 0.25], "cycles": 3, "shape": "pulse"}}])
    return s


# ------------------------------------------------------------------------------------------------ Venice
def mask_art(W=48, H=26):
    """A cat-eye Colombina mask as pixel art: gold leaf with a lit upper edge and a dark lower rim, almond eye
    holes, a plum lattice band over the brow, little pearl dots round the eyes."""
    import math as _m
    rows = []
    for y in range(H):
        row = ""
        for x in range(W):
            u = (x - (W - 1) / 2) / (W / 2)          # -1..1
            v = (y - H * 0.42) / (H / 2)            # -1..1, 0 a little above the middle
            ax = abs(u)
            top = -0.62 - 0.38 * ax ** 1.6 + 0.12 * _m.cos(ax * 6.0)    # upswept outer corners
            bot = 0.55 - 0.32 * ax ** 2 + (0.22 if ax < 0.16 else 0)      # dips to a point over the nose
            inside = top < v < bot and ax < 0.98
            # almond eyes
            ex, ey = (ax - 0.42) / 0.24, (v + 0.02) / 0.2
            eye = ex * ex + ey * ey < 1.0 and abs(ex) < 1.05
            rimd = ex * ex + ey * ey < 1.55
            if not inside or eye:
                row += "."
                continue
            c = "g"
            if v < top + 0.1:
                c = "h"
            elif v > bot - 0.1:
                c = "d"
            elif rimd:
                c = "w" if (x + y) % 3 == 0 else "e"
            elif -0.48 < v < -0.24 and ax < 0.7:
                c = "p" if (x + y) % 4 in (0, 1) and (x - y) % 4 in (0, 1) else "q"
            elif (x * 7 + y * 3) % 11 == 0:
                c = "h"
            row += c
        rows.append(row)
    return rows


@item
def sv_venicemask():
    """A Venetian Colombina mask for the wall: gold leaf, almond eyes ringed with pearls, a plum lattice brow,
    a spray of feathers and a silk ribbon, hung on a brass nail."""
    s = Spec("sv_venicemask", "Venetian Mask", density=7, tris=600, hero=(0, 6))
    art = mask_art()
    key = {"g": "brass:5", "h": "brass:7", "d": "brass:2", "e": "brass:4", "w": "snow:5", "p": "plum:4", "q": "brass:6"}
    s.card("mask", art, s.style("mask", flat("brass", 4.4, light=0.4, outline="none")), at=(0, 9.0, 1.4), plane="xy", key=key, size=[14.0, 7.6])
    back = ["".join("k" if ch != "." else "." for ch in r) for r in art]
    s.card("maskback", back, s.style("mb", flat("night", 2.0, light=0.2, outline="none")), at=(0.3, 8.7, 1.1), plane="xy", key={"k": "night:1"}, size=[14.0, 7.6])
    feather = ["......aa", ".....abb", "....abb.", "...abbc.", "..abbc..", ".abbc...", ".abc....", "abc.....", "ac......", "c......."]
    for k, (x, rz, col) in enumerate([(-5.0, 22, "plum"), (-3.6, 6, "berry"), (-6.4, 40, "lilac")]):
        s.card(f"feather{k}", feather, s.style(f"fs{k}", flat(col, 4.4, light=0.5, outline="none")), at=(x, 11.4, 1.6 + k * 0.1), plane="xy",
               key={"a": f"{col}:6", "b": f"{col}:4", "c": "brass:5"}, size=[3.0, 7.4], rot=(0, 0, rz), off=(0, 3.7, 0))
    rib = ["bb", "bc", "bb", "cb", "bb", "bc", ".b", ".b", "b.", "bb"]
    s.card("ribbon", rib, s.style("rib", flat("berry", 3.6, light=0.4, outline="none")), at=(7.0, 6.6, 1.3), plane="xy", key={"b": "berry:4", "c": "berry:6"}, size=[0.8, 5.0])
    s.add("nail", "prism", [0.8, 0.8, 1.4], s.style("nailst", brass()), centre=(0, 13.4, 0.7), sides=6)
    return s


@item
def sv_gondola():
    """A gondola model in black lacquer with a silver ferro, a red cushioned seat and the gondolier's oar, on a cradle."""
    s = Spec("sv_gondola", "Gondola Model", density=7, tris=1400, hero=(40, 20))
    lac = s.style("lac", lacquer("lacquer", 2.8))
    oak = s.style("oak", wood("oak", 4.4, grain="x", knots=0))
    for z in (-5, 5):
        s.box(f"cradle{z}", [5.4, 2.0, 1.2], oak, (0, 1.0, z), chamfer=0.3)
    s.loft("hull", [((0, 3.2, -11), [0.6, 0.8]), ((0, 1.2, -8), [3.0, 2.0]), ((0, 0.4, -3), [4.6, 2.6]), ((0.3, 0.4, 2), [4.6, 2.6]),
                     ((0, 1.0, 7), [3.2, 2.0]), ((0, 3.6, 10.4), [0.8, 0.9])], lac, at=(0, 2.2, 0), sides=8, round_=2.4,
           paint={"layers": [{"id": "trim", "op": "band", "axis": "y", "from": 0.55, "to": 0.7, "ramp": "brass", "tone": 5}]})
    s.box("seat", [3.6, 0.8, 3.0], s.style("velv", felt("berry", 3.8)), (0, 4.0, -1.0), chamfer=0.4)
    s.box("seatback", [3.6, 1.6, 0.6], lac, (0, 4.8, -2.6))
    ferro = ["sss...", "s.sss.", "sssss.", "s.sss.", "sssss.", "s.sss.", "ssssss", ".sssss"]
    s.card("ferro", ferro, s.style("silver", flat("pebble", 5.0, outline="none")), at=(0, 5.6, 11.0), plane="yz", key={"s": "pebble:6"}, size=[1.6, 3.0], rot=(0, 0, 0))
    s.box("forcola", [0.8, 2.6, 0.8], oak, (1.8, 4.8, -6.0))
    s.box("oar", [0.4, 0.4, 13.0], oak, (1.6, 6.0, -1.0), rot=(8, 6, 0))
    s.box("blade", [0.3, 0.6, 2.4], oak, (2.2, 5.3, 5.6), rot=(8, 6, 0))
    return s


# ------------------------------------------------------------------------------------------------ Santorini
@item
def sv_bluedome():
    """A whitewashed chapel on a rock: blue dome on a drum, a bell tower arch with a bronze bell, a blue door."""
    s = Spec("sv_bluedome", "Blue-Dome Chapel", density=7, tris=1400, hero=(32, 18))
    wash = s.style("wash", {"ramp": "snow", "tone": 4.6, "rim": {"light": 1, "dark": 1, "light_shift": 0.7, "dark_shift": -1.0, "outline": "none"},
                            "layers": [{"id": "lime", "op": "noise", "scale": 1.0, "amount": 0.5}, {"id": "drip", "op": "patches", "scale": 2.0, "threshold": 0.7, "shift": -0.6}],
                            "brush": {"flow": "vertical", "length": 1.0, "width": 0.4, "rough": 0.4, "textures": {"snow": "stone"}}})
    blue = s.style("blue", glaze("aegean", 4.0, speck=False))
    rock = s.style("rock", stone("terra", 3.8))
    s.lathe("rock", [(0, 13), (1.2, 12.4), (2.0, 10.6), (2.4, 9.0)], rock, sides=9, round_=2.0)
    s.box("nave", [7.0, 5.6, 7.6], wash, (0, 5.2, -0.4), chamfer=0.2)
    s.box("door", [2.2, 3.2, 0.4], blue, (0, 4.0, 3.5), paint={"layers": [{"id": "panel", "op": "panel", "inset": 2, "shift": -0.6, "highlight": 1, "shadow": 1}]})
    s.box("step", [3.0, 0.6, 1.2], wash, (0, 2.7, 4.0))
    s.cyl("drum", 5.6, 1.6, wash, (0, 8.0, -0.4), sides=12)
    s.lathe("dome", [(0, 5.8), (1.0, 5.6), (2.0, 4.8), (2.8, 3.4), (3.3, 1.6), (3.5, 0.2)], blue, base=(0, 9.6, -0.4), sides=12, round_=2.0)
    s.box("cross_v", [0.3, 1.6, 0.3], s.style("gold", brass()), (0, 13.6, -0.4))
    s.box("cross_h", [1.0, 0.3, 0.3], "gold", (0, 14.0, -0.4))
    # the bell tower beside the nave: a pierced wall with a bell
    s.box("bellwall", [3.0, 6.0, 1.6], wash, (5.0, 6.0, 2.0), chamfer=0.2,
          paint={"stamps": [{"face": "front", "at": [6, 6], "art": [".kkkkkk.", "kkkkkkkk", "kkkkkkkk", "kkkkkkkk", "kkkkkkkk", "kkkkkkkk"], "key": {"k": "night:1"}}]})
    s.cyl("bell", 1.2, 1.2, s.style("bronze", brass("brass", 3.0)), (5.0, 7.4, 2.9), sides=8, top=0.6)
    s.box("belltop", [3.4, 0.6, 2.0], wash, (5.0, 9.3, 2.0))
    s.box("window", [1.2, 1.8, 0.4], blue, (-2.2, 6.2, 3.3))
    return s
