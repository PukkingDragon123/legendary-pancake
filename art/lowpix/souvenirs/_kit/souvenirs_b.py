"""Souvenirs, part B: the Sahara, the Grand Canyon, Cappadocia, the Taj Mahal, Iceland and Machu Picchu.
Units: px (16 per block), origin bottom-centre, facing +Z; wall items hang with their back on z = 0."""
import math

from kit import (UP, Spec, bead, brass, cloth, felt, flat, full_stamp, glass, glaze, glow, lacquer, marble, plush, stone,
                 wicker, wood)

ITEMS = {}


def item(fn):
    ITEMS[fn.__name__] = fn
    return fn


# ------------------------------------------------------------------------------------------------ the Sahara
CAMEL = ["..........aa....", ".........aaaa...", "..aa.....aa.....", ".aaaa...aaa.....", "aaaaaaaaaaa.....", "aaaaaaaaaa......",
         ".aaaaaaaa.......", ".a.a..a.a.......", ".a.a..a.a.......", ".a.a..a.a......."]


def kilim_art(W, H):
    """A kilim: madder field, an indigo border with a caravan of camels, stepped diamond medallions, cream guards."""
    rows = [["r"] * W for _ in range(H)]

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            rows[y][x] = c
    B = max(16, H // 6)
    for y in range(H):
        for x in range(W):
            e = min(x, y, W - 1 - x, H - 1 - y)
            if e < 2:
                put(x, y, "k")
            elif e < 4:
                put(x, y, "c" if (x + y) % 4 < 2 else "o")
            elif e < B:
                put(x, y, "i")
            elif e < B + 2:
                put(x, y, "c")
            elif e < B + 4:
                put(x, y, "o" if (x // 2 + y // 2) % 2 else "c")
    # camels march round the border
    for x0 in range(8, W - 20, 22):
        for (cx, cy, flip) in ((x0, 4 + (B - 4 - len(CAMEL)) // 2, False), (x0 + 6, H - 4 - (B - 4 - len(CAMEL)) // 2 - len(CAMEL), True)):
            for j, row in enumerate(CAMEL):
                for i, ch in enumerate(row):
                    if ch == "a":
                        put(cx + (len(row) - 1 - i if flip else i), cy + j, "c")
    # stepped diamonds down the field
    cx = W // 2
    for k, cy in enumerate(range(B + 14, H - B - 10, max(26, (H - 2 * B) // 3))):
        for y in range(-12, 13):
            for x in range(-24, 25):
                d = abs(x) / 2 + abs(y)
                step = int(d) // 3
                if d < 12:
                    put(cx + x, cy + y, ["o", "i", "c", "k"][step % 4])
                if d < 3:
                    put(cx + x, cy + y, "y")
    for x0 in (B + 8, W - B - 9):
        for y in range(B + 6, H - B - 6, 6):
            for d in range(3):
                put(x0 - d, y + d, "o"); put(x0 + d, y + d, "o")
    return ["".join(r) for r in rows]


@item
def sv_camelrug():
    """A hand-knotted kilim in desert reds and indigo with a caravan of camels marching round the border."""
    s = Spec("sv_camelrug", "Camel Kilim Rug", density=4, tris=600, hero=(30, 40))
    W, D = 44, 30
    rug = s.style("rug", cloth("terra", 3.6, weave=0.7, photo="rough_linen", scale=6))
    key = {"r": "clay:3", "i": "indigo:2", "c": "oat:5", "o": "ochre:4", "k": "night:2", "y": "honey:5"}
    s.box("rug", [W, 0.9, D], rug, (0, 0.45, 0), chamfer=0.2, paint={"stamps": [full_stamp("top", kilim_art(W * 4, D * 4), key)]})
    tas = ["".join("|" if (x % 3 == 0 and (y == 0 or x % 6 == 0)) else "." for x in range(W * 4)) for y in range(2)]
    fr = s.style("fr", flat("oat", 4.0, light=0.6, outline="none"))
    for k, z in enumerate((D / 2 + 0.5, -D / 2 - 0.5)):
        s.card(f"tassels{k}", tas, fr, at=(0, 0.05, z), plane="xz", key={"|": "oat:5"}, size=[W - 1, 1], rot=(0, 0 if k == 0 else 180, 0))
    return s


@item
def sv_brasslantern():
    """A Moroccan table lantern: pierced brass onion with amber and teal glass panes, a domed top and a finial."""
    s = Spec("sv_brasslantern", "Moroccan Lantern", density=7, tris=1600, hero=(30, 16))
    br = s.style("br", brass("brass", 3.6))
    pierced = s.style("pierced", {**brass("brass", 3.4), "layers": brass("brass", 3.4)["layers"] + [
        {"id": "holes", "op": "spots", "count": 70, "radius": [0.16, 0.26], "ramp": "glow", "tone": 5.2, "min_gap": 0.5},
        {"id": "stars", "op": "spots", "count": 14, "radius": [0.35, 0.45], "ramp": "flame", "tone": 4.0, "min_gap": 1.2}]})
    pane = s.style("pane", {"ramp": "flame", "tone": 3.6, "light": 0.3, "rim": {"light": 1, "dark": 0, "light_shift": 0.8, "outline": "none"},
                            "layers": [{"id": "lead", "op": "stripes", "axis": "y", "period": 1.8, "width": 0.12, "ramp": "brass", "tone": 2},
                                       {"id": "tint", "op": "patches", "scale": 1.0, "threshold": 0.55, "ramp": "teal", "tone": 4}], "brush": {"off": True}})
    s.cyl("foot", 6.4, 1.0, br, (0, 0, 0), sides=10, top=0.85)
    s.cyl("neck", 3.0, 1.0, br, (0, 1.0, 0), sides=10)
    s.lathe("glow_body", [(2.0, 4.0), (3.2, 6.4), (5.0, 7.6), (7.0, 7.4), (8.8, 6.2), (10.2, 4.4), (11.0, 3.4)], pane, sides=8, round_=2.0)
    s.lathe("cage", [(2.0, 4.2), (3.2, 6.6), (5.0, 7.8), (7.0, 7.6), (8.8, 6.4), (10.2, 4.6), (11.0, 3.6)], pierced, sides=8, round_=2.0,
            paint={"layers": [{"id": "windows", "op": "stripes", "axis": "around", "period": 0.25, "width": 0.4, "ramp": "flame", "tone": 3.8, "range": [0.3, 0.7]}]})
    s.lathe("dome", [(11.0, 4.0), (12.0, 4.4), (13.2, 3.4), (14.4, 1.8), (15.4, 0.6)], pierced, sides=8, round_=2.0)
    s.cyl("finial", 0.8, 1.6, br, (0, 15.2, 0), sides=6, top=0.4)
    s.cyl("ball", 1.2, 1.0, br, (0, 16.6, 0), sides=6)
    return s


# ------------------------------------------------------------------------------------------------ the Grand Canyon
@item
def sv_canyondiorama():
    """A carved diorama of the canyon on an oak base: striped mesas, a silver river, sage shrubs and a brass plaque."""
    s = Spec("sv_canyondiorama", "Canyon Diorama", density=7, tris=1600, hero=(34, 26))
    oak = s.style("oak", wood("walnut", 4.4, grain="x", knots=1))
    strata = {"ramp": "terra", "tone": 4.0, "rim": {"light": 1, "dark": 1, "light_shift": 1.0, "dark_shift": -1.0, "outline": "none"},
              "layers": [{"id": "s1", "op": "stripes", "axis": "y", "period": 1.6, "width": 0.4, "ramp": "ochre", "tone": 4.6, "wobble": 0.3, "space": "world"},
                         {"id": "s2", "op": "stripes", "axis": "y", "period": 2.3, "width": 0.25, "ramp": "clay", "tone": 3.0, "wobble": 0.3, "space": "world"},
                         {"id": "s3", "op": "stripes", "axis": "y", "period": 3.1, "width": 0.15, "ramp": "sand", "tone": 5.0, "space": "world"},
                         {"id": "rock", "op": "photo", "src": "art/lowpix/souvenirs/_kit/photos/rock_face_03", "scale": 10, "amount": 0.6, "ramps": ["terra"]},
                         {"id": "cracks", "op": "cracks", "scale": 1.0, "width": 0.06, "threshold": 0.84, "shift": -1.0}],
              "brush": {"flow": "horizontal", "length": 1.6, "width": 0.5, "rough": 0.6, "textures": {"terra": "stone"}}}
    st = s.style("strata", strata)
    s.box("base", [14, 2.0, 11], oak, (0, 1.0, 0), chamfer=0.4)
    s.box("plaque", [5.0, 1.2, 0.3], s.style("pl", brass()), (0, 1.0, 5.6))
    s.box("river", [2.2, 0.5, 10], s.style("water", glaze("lake", 4.2, speck=False)), (0.4, 2.2, 0))
    s.add("mesaL", "taper", [5.6, 9.6, 6.2], st, centre=(-3.6, 5.6, -0.6), rot=(-90, 0, 0), front_scale=[0.8, 0.85], back_shift=[0, 0])
    s.box("mesaLtop", [4.8, 0.8, 7.6], st, (-3.8, 8.0, -0.4), chamfer=0.3)
    s.add("mesaR", "taper", [5.0, 9.6, 5.0], st, centre=(4.2, 4.6, 0.4), rot=(-90, 0, 0), front_scale=[0.75, 0.8])
    s.box("butte", [2.6, 6.8, 2.6], st, (4.6, 5.4, -3.4), chamfer=0.5)
    s.box("ledgeL", [2.0, 3.0, 9.0], st, (-1.4, 3.4, 0.2), chamfer=0.4)
    s.box("ledgeR", [1.6, 2.2, 9.0], st, (2.4, 3.1, 0.4), chamfer=0.4)
    sage = s.style("sage", felt("sage", 3.8))
    for k, (x, y, z) in enumerate([(-5.2, 8.4, 2.2), (-2.4, 8.4, -2.8), (4.0, 6.2, 2.4), (-1.0, 4.9, 3.6), (2.2, 4.2, -2.0)]):
        s.cyl(f"shrub{k}", 1.1, 0.8, sage, (x, y, z), sides=6, top=0.6)
    return s


# ------------------------------------------------------------------------------------------------ Cappadocia
@item
def sv_balloon():
    """A striped hot-air balloon tethered over its wicker basket on a little turf stand; it bobs gently."""
    s = Spec("sv_balloon", "Hot-Air Balloon", density=6, tris=1800, hero=(30, 10))
    turf = s.style("turf", felt("moss", 3.8))
    oak = s.style("oak", wood("oak", 4.4, grain="y", knots=0))
    s.cyl("stand", 8.0, 1.4, oak, (0, 0, 0), sides=10, top=0.92)
    s.cyl("turf", 7.0, 0.5, turf, (0, 1.4, 0), sides=10)
    s.cyl("peg", 0.6, 2.0, oak, (2.6, 1.6, 0), sides=6)
    s.bone("float", at=(0, 4, 0))
    s.box("basket", [3.6, 2.6, 3.6], s.style("wick", wicker("straw", 4.0)), (0, 3.4, 0), chamfer=0.4, parent="float")
    s.box("rim", [4.0, 0.6, 4.0], s.style("rimst", wood("walnut", 3.8, grain="x", knots=0)), (0, 4.9, 0), chamfer=0.2, parent="float")
    rope = s.style("rope", flat("oat", 4.4, light=0.6, outline="none"))
    for k, (x, z) in enumerate([(-1.5, -1.5), (1.5, -1.5), (-1.5, 1.5), (1.5, 1.5)]):
        s.add(f"rope{k}", "box", [0.25, 5.4, 0.25], rope, centre=(x * 1.05, 7.6, z * 1.05), rot=(z * -6, 0, x * 6), parent="float")
    stripes = {"ramp": "vermilion", "tone": 4.2, "rim": {"light": 1, "dark": 1, "light_shift": 1.0, "dark_shift": -1.0, "outline": "none"},
               "layers": [{"id": "gores", "op": "stripes", "axis": "around", "period": 0.125, "width": 0.5, "ramp": "honey", "tone": 4.8},
                          {"id": "band", "op": "band", "axis": "path", "from": 0.35, "to": 0.45, "ramp": "aegean", "tone": 4.0},
                          {"id": "band2", "op": "band", "axis": "path", "from": 0.46, "to": 0.5, "ramp": "oat", "tone": 5.0},
                          {"id": "cloth", "op": "noise", "scale": 1.4, "amount": 0.4},
                          {"id": "sheen", "op": "gloss", "dash": True, "length": 3, "shift": 1.0, "density": 0.4, "post": True}],
               "brush": {"flow": "vertical", "length": 1.6, "width": 0.4, "rough": 0.35, "textures": {"vermilion": "cloth", "honey": "cloth"}}}
    s.lathe("envelope", [(10.2, 2.4), (11.2, 4.4), (13.2, 8.0), (15.6, 10.6), (18.4, 11.8), (21.0, 11.2), (23.0, 8.8), (24.2, 5.4), (24.7, 1.6)],
            s.style("env", stripes), base=(0, 0, 0), sides=16, round_=2.0, parent="float")
    s.cyl("skirt", 2.6, 0.8, s.style("sk", felt("soot", 2.8)), (0, 9.6, 0), sides=10, parent="float")
    s.cyl("glow_burner", 1.0, 0.6, s.style("fl", glow("flame", 4.0)), (0, 8.6, 0), sides=6, parent="float")
    s.anim("idle", 4.0, [{"part": "float", "channel": "position", "osc": {"axis": "y", "amp": 0.8, "cycles": 1}},
                         {"part": "float", "osc": {"axis": "z", "amp": 2.0, "cycles": 1, "phase": 0.25}}])
    return s


# ------------------------------------------------------------------------------------------------ the Taj Mahal
@item
def sv_tajmodel():
    """The Taj Mahal carved in milky marble: plinth, octagonal hall with arched iwans, onion dome, chhatris, minarets."""
    s = Spec("sv_tajmodel", "Marble Taj Mahal", density=8, tris=2200, hero=(30, 14))
    mb = s.style("mb", marble("marble", 5.0))
    inlay = s.style("inlay", {**marble("marble", 4.8), "stamps": []})
    arch = [".kk.", "kkkk", "kkkk", "kkkk", "kkkk"]
    big = ["..kkkk..", ".kkkkkk.", "kkkkkkkk", "kkkkkkkk", "kkkkkkkk", "kkkkkkkk", "kkkkkkkk", "kkkkkkkk"]
    s.box("plinth", [16, 1.6, 16], mb, (0, 0.8, 0), chamfer=0.2,
          paint={"layers": [{"id": "flowers", "op": "spots", "count": 30, "radius": [0.15, 0.22], "ramp": "berry", "tone": 4, "faces": ["sides"]}]})
    s.cyl("hall", 9.6, 6.4, mb, (0, 1.6, 0), sides=8, angle=22.5,
          paint={"stamps": [{"faces": ["sides"], "at": [8, 6], "art": big, "key": {"k": "lilac:1"}},
                            {"faces": ["sides"], "at": [3, 8], "art": arch, "key": {"k": "lilac:2"}},
                            {"faces": ["sides"], "at": [16, 8], "art": arch, "key": {"k": "lilac:2"}}]})
    s.cyl("parapet", 10.2, 0.6, mb, (0, 8.0, 0), sides=8, angle=22.5)
    s.cyl("drum", 5.2, 1.6, mb, (0, 8.6, 0), sides=12)
    s.lathe("dome", [(0, 5.0), (0.8, 6.0), (2.0, 6.6), (3.4, 6.0), (4.6, 4.4), (5.6, 2.4), (6.2, 0.8)], mb, base=(0, 10.2, 0), sides=12, round_=2.0)
    s.cyl("finial", 0.4, 1.4, s.style("gold", brass("brass", 4.4)), (0, 16.3, 0), sides=6, top=0.5)
    for k, (x, z) in enumerate([(-3.2, -3.2), (3.2, -3.2), (-3.2, 3.2), (3.2, 3.2)]):
        s.cyl(f"chhatri{k}", 1.8, 1.4, mb, (x, 8.6, z), sides=8)
        s.lathe(f"cdome{k}", [(0, 2.0), (0.6, 2.2), (1.2, 1.6), (1.8, 0.4)], mb, base=(x, 10.0, z), sides=8, round_=2.0)
    for k, (x, z) in enumerate([(-7, -7), (7, -7), (-7, 7), (7, 7)]):
        s.cyl(f"minaret{k}", 1.3, 10.0, mb, (x, 1.6, z), sides=8, top=0.85)
        for y in (4.4, 7.8):
            s.cyl(f"bal{k}_{y}", 1.8, 0.4, mb, (x, y, z), sides=8)
        s.lathe(f"mcap{k}", [(0, 1.6), (0.6, 1.4), (1.2, 0.3)], mb, base=(x, 11.6, z), sides=8, round_=2.0)
    return s


# ------------------------------------------------------------------------------------------------ Iceland
@item
def sv_puffin():
    """A puffin plush: black back, white front and face, a big striped beak, orange feet, a look of mild surprise."""
    s = Spec("sv_puffin", "Puffin Plush", density=7, tris=1600, hero=(30, 16))
    blk = s.style("blk", plush("soot", 3.2, seed=1))
    wht = s.style("wht", plush("snow", 4.6, seed=2))
    org = s.style("org", felt("orange", 4.2))
    s.lathe("body", [(1.0, 4.4), (2.0, 6.6), (4.0, 7.6), (6.2, 7.0), (8.0, 5.6), (8.8, 4.6)], blk, sides=12, round_=2.0)
    s.lathe("belly", [(1.2, 3.6), (2.2, 5.6), (4.0, 6.4), (6.0, 5.6), (7.4, 4.2)], wht, base=(0, 0, 1.2), sides=12, round_=2.0)
    s.lathe("head", [(8.4, 4.2), (9.0, 5.6), (10.6, 6.0), (12.0, 5.0), (12.8, 3.0)], blk, sides=12, round_=2.0)
    for sx in (-1, 1):
        s.box(f"cheek{sx}", [2.6, 2.8, 2.4], wht, (sx * 1.6, 10.4, 1.4), chamfer=0.9)
        s.add(f"eye{sx}", "prism", [0.8, 0.8, 0.5], s.style("eye", bead()), centre=(sx * 1.7, 11.0, 2.7), sides=6, rot=(0, sx * 20, 0))
        s.add(f"wing{sx}", "taper", [1.4, 5.0, 3.0], blk, centre=(sx * 3.7, 4.8, -0.4), rot=(0, 0, sx * -10), front_scale=[0.8, 0.5])
        s.box(f"foot{sx}", [2.0, 0.7, 2.8], org, (sx * 1.5, 0.35, 1.4), chamfer=0.3)
    beak = {"ramp": "orange", "tone": 4.4, "rim": {"light": 1, "dark": 1, "light_shift": 1.0, "dark_shift": -1.0, "outline": "none"},
            "layers": [{"id": "base", "op": "band", "axis": "z", "from": -1.0, "to": -0.45, "ramp": "stone", "tone": 3.6},
                       {"id": "line", "op": "band", "axis": "z", "from": -0.45, "to": -0.3, "ramp": "honey", "tone": 5.4}], "brush": {"off": True}}
    s.add("beak", "taper", [2.4, 3.0, 2.8], s.style("beak", beak), centre=(0, 10.0, 3.6), front_scale=[0.35, 0.35], front_shift=[0, -0.4])
    s.card("tail", [".aa.", "aaaa", "aaaa"], s.style("tl", flat("soot", 3.0, outline="none")), at=(0, 2.6, -3.6), plane="xz", key={"a": "soot:3"}, size=[2.4, 2.0])
    return s


@item
def sv_auroraglobe():
    """A snow globe on a turned base: inside, the northern lights over black sand and a turf cottage (it glows softly)."""
    s = Spec("sv_auroraglobe", "Aurora Snow Globe", density=8, tris=1500, hero=(30, 14))
    base = s.style("base", wood("walnut", 4.2, grain="y", knots=0))
    globe = {"ramp": "night", "tone": 3.0, "light": 0.35, "rim": {"light": 1, "dark": 0, "light_shift": 1.2, "outline": "none"},
             "layers": [{"id": "sky", "op": "gradient", "axis": "y", "amount": -1.2},
                        {"id": "aur1", "op": "band", "axis": "y", "from": 0.05, "to": 0.4, "wobble": 0.5, "wobble_scale": 2.0, "ramp": "aurora", "tone": 4.0},
                        {"id": "aur2", "op": "band", "axis": "y", "from": 0.3, "to": 0.5, "wobble": 0.6, "wobble_scale": 2.6, "ramp": "lilac", "tone": 3.6},
                        {"id": "stars", "op": "spots", "count": 18, "radius": [0.1, 0.15], "ramp": "snow", "tone": 6, "where": {"y": [0.2, 1.0]}},
                        {"id": "ground", "op": "band", "axis": "y", "from": -1.0, "to": -0.45, "wobble": 0.2, "ramp": "soot", "tone": 2.0},
                        {"id": "snow", "op": "band", "axis": "y", "from": -0.5, "to": -0.38, "wobble": 0.3, "ramp": "snow", "tone": 5.0},
                        {"id": "flakes", "op": "spots", "count": 26, "radius": [0.08, 0.12], "ramp": "snow", "tone": 6},
                        {"id": "shine", "op": "gloss", "dash": True, "length": 3, "shift": 3.0, "density": 1.0, "post": True}],
             "stamps": [{"faces": ["s2_0"], "at": "center", "art": ["..gg..", ".gggg.", "gggggg", "wwlwww", "wwlwww"], "key": {"g": "moss:3", "w": "oat:4", "l": "glow:5"}}],
             "brush": {"off": True}}
    s.cyl("foot", 8.4, 1.0, base, (0, 0, 0), sides=12, top=0.94)
    s.cyl("waist", 7.0, 2.4, base, (0, 1.0, 0), sides=12, top=0.82)
    s.cyl("band", 6.0, 0.6, s.style("br", brass()), (0, 3.4, 0), sides=12)
    s.lathe("glow_globe", [(3.8, 4.4), (4.6, 6.6), (6.4, 8.0), (8.4, 8.2), (10.2, 7.2), (11.4, 5.0), (12.0, 2.0)], s.style("gl", globe), sides=14, round_=2.0)
    return s


# ------------------------------------------------------------------------------------------------ Machu Picchu
@item
def sv_llama():
    """A llama plush: cream wool, a proud neck, banana ears with woven tassels, a striped saddle blanket and pompoms."""
    s = Spec("sv_llama", "Llama Plush", density=7, tris=1800, hero=(36, 16))
    wool = s.style("wool", plush("oat", 4.8, seed=3))
    face = s.style("face", plush("buff", 4.6, seed=4))
    s.loft("body", [((0, 0, -4.6), [4.6, 4.4]), ((0, 0.3, -2.6), [5.6, 5.4]), ((0, 0.3, 1.6), [5.6, 5.4]), ((0, 0, 3.6), [4.8, 4.8])], wool, at=(0, 7.0, 0), sides=10, round_=2.2)
    for k, (x, z) in enumerate([(-1.6, 2.4), (1.6, 2.4), (-1.6, -3.2), (1.6, -3.2)]):
        s.cyl(f"leg{k}", 1.7, 5.2, wool, (x, 0, z), sides=8, bottom=0.9)
        s.cyl(f"toe{k}", 1.8, 0.6, s.style("toe", felt("soot", 2.6)), (x, 0, z + 0.2), sides=8)
    s.loft("neck", [((0, 0, 0), [3.0, 3.2]), ((0, 3.0, 0.4), [2.6, 2.8]), ((0, 6.0, 0.6), [2.4, 2.6])], wool, at=(0, 8.4, 3.4), sides=10, round_=2.2)
    s.loft("head", [((0, 0, -1.0), [3.2, 3.0]), ((0, 0, 0.8), [3.0, 2.8]), ((0, -0.4, 2.4), [2.2, 2.0])], face, at=(0, 15.2, 4.2), sides=10, round_=2.3)
    for sx in (-1, 1):
        s.add(f"ear{sx}", "taper", [1.0, 3.4, 0.8], face, centre=(sx * 1.0, 18.0, 3.6), rot=(-90 + 10, 0, sx * -12), front_scale=[0.5, 0.6])
        s.cyl(f"tassel{sx}", 0.9, 0.9, s.style(f"ts{sx}", felt("vermilion" if sx < 0 else "aegean", 4.0)), (sx * 1.4, 19.4, 3.4), sides=6)
        s.add(f"eye{sx}", "prism", [0.6, 0.6, 0.4], s.style("eye", bead()), centre=(sx * 1.2, 15.6, 5.3), sides=6, rot=(0, sx * 25, 0))
    s.box("nose", [1.0, 0.6, 0.4], s.style("nos", felt("soot", 2.4)), (0, 14.9, 6.6))
    blanket = ["rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr", "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy", "gg.gg.gg.gg.gg.gg.gg.gg.gg.gg.gg.gg.",
               "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "b.r.b.r.b.r.b.r.b.r.b.r.b.r.b.r.b.r.", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
               "gg.gg.gg.gg.gg.gg.gg.gg.gg.gg.gg.gg.", "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy", "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"]
    bl = s.style("blanket", {**cloth("vermilion", 4.0, weave=0.5, photo="rough_linen", scale=5),
                             "stamps": [{"faces": ["sides", "top"], "at": "center", "art": blanket, "key": {"r": "vermilion:4", "y": "honey:5", "g": "fern:4", "b": "indigo:3"}}]})
    s.box("saddle", [6.2, 3.4, 5.0], bl, (0, 8.9, -0.4), chamfer=0.6)
    pom = {"vermilion": (-1.6, 12.0), "honey": (0, 11.6), "aegean": (1.6, 12.0)}
    for k, (c, (x, y)) in enumerate(pom.items()):
        s.cyl(f"pom{k}", 1.2, 1.0, s.style(f"pom{k}", felt(c, 4.2)), (x, y, 5.1), sides=8)
    return s


def weave_art(W, H):
    """Andean weaving: bright bands of stepped diamonds, little condors and zigzags on cream and madder."""
    rows = []
    for y in range(H):
        band = (y * 7) // H
        row = ""
        for x in range(W):
            if band in (0, 6):
                c = "r" if (y % 4 == 0) else "c"
                if (x // 3 + y // 2) % 4 == 0:
                    c = "y"
            elif band in (1, 5):
                c = "g" if ((x + y) // 3) % 2 == 0 else "b"
            elif band == 3:
                d = abs((x % 24) - 12) + abs((y % (H // 7 or 1)) - (H // 14))
                c = "y" if d < 4 else "r" if d < 7 else "p" if d < 9 else "c"
            else:
                zz = (x + (y % 6 if band == 2 else -y % 6)) % 6
                c = "r" if zz < 2 else "c" if zz < 4 else "p"
            if y % (H // 7 or 1) == 0:
                c = "k"
            row += c
        rows.append(row)
    return rows


@item
def sv_andeanweave():
    """An Andean weaving hung from a wooden rod: bands of diamonds, condors and zigzags in alpaca wool, tasselled."""
    s = Spec("sv_andeanweave", "Andean Weaving", density=6, tris=800, hero=(16, 6))
    W, H = 22, 15
    oak = s.style("oak", wood("walnut", 4.2, grain="x", knots=0))
    cl = s.style("cl", cloth("vermilion", 4.0, weave=0.7, photo="rough_linen", scale=5))
    key = {"r": "vermilion:4", "c": "oat:5", "y": "honey:5", "g": "fern:4", "b": "indigo:3", "p": "plum:4", "k": "night:2"}
    s.box("cloth", [W, H, 0.5], cl, (0, 3.6 + H / 2, 0.7), paint={"stamps": [full_stamp("front", weave_art(W * 6, H * 6), key)]})
    s.add("rod", "prism", [1.0, 1.0, W + 4], oak, centre=(0, 3.6 + H + 0.4, 0.9), rot=(0, 90, 0), sides=8)
    for sx in (-1, 1):
        s.cyl(f"knob{sx}", 1.6, 1.0, oak, (sx * (W / 2 + 2.4), 3.6 + H - 0.1, 0.9), sides=8)
    s.box("cord", [0.3, 3.0, 0.3], s.style("cord", felt("oat", 4.0)), (0, 3.6 + H + 2.2, 0.6))
    tas = ["a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a.b.c.a."[:W * 6]] * 10
    s.card("tassels", tas, s.style("tas", flat("oat", 4.2, light=0.6, outline="none")), at=(0, 3.6 - 1.6, 0.95), plane="xy",
           key={"a": "vermilion:4", "b": "honey:5", "c": "oat:5"}, size=[W, 3.2])
    return s
