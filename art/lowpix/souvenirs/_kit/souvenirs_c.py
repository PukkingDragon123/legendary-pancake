"""Souvenirs, part C: the Amazon, the Serengeti, Banff, Petra, Angkor Wat, the Great Barrier Reef, Rio, Milford
Sound and Antarctica. Units: px (16 per block), origin bottom-centre, facing +Z; wall items hang with their back on z = 0."""
import math

from kit import (UP, Spec, bead, brass, cloth, felt, flat, glass, glaze, glow, lacquer, plush, stone, wood)

ITEMS = {}


def item(fn):
    ITEMS[fn.__name__] = fn
    return fn


# ------------------------------------------------------------------------------------------------ the Amazon
@item
def sv_toucan():
    """A carved toucan on a jungle branch: black body, a cream bib, a big sunset beak, on a little oak stand."""
    s = Spec("sv_toucan", "Toucan Perch", density=7, tris=1600, hero=(28, 14))
    oak = s.style("oak", wood("walnut", 4.2, grain="x", knots=1))
    bark = s.style("bark", wood("bark", 3.8, grain="x", knots=2, wear=0.2))
    blk = s.style("blk", lacquer("soot", 2.6))
    s.box("base", [9, 1.4, 6], oak, (0, 0.7, 0), chamfer=0.4)
    s.cyl("post", 1.4, 6.0, bark, (-2.4, 1.4, 0), sides=7, top=0.8)
    s.loft("branch", [((-6.0, 0, 0), 1.6), ((-2.4, 0.4, 0), 1.8), ((2.0, 0.2, 0), 1.5), ((5.6, 1.0, 0), 1.0)], bark, at=(0, 7.6, 0), sides=7, round_=2.0)
    leaf = ["..aa", ".aab", "aabb", "abb.", "bb.."]
    for k, (x, rz) in enumerate([(5.2, 20), (-5.6, -30)]):
        s.card(f"leaf{k}", leaf, s.style(f"lf{k}", flat("fern", 4.2, outline="none")), at=(x, 8.4, 0.4), plane="xy", key={"a": "fern:5", "b": "leaf:3" if False else "fern:3"}, size=[2.4, 3.0], rot=(0, 30, rz))
    s.loft("body", [((0, 0, -1.6), [3.2, 3.0]), ((0, 1.6, -0.2), [3.8, 4.2]), ((0, 3.6, 0.4), [3.4, 3.6]), ((0, 5.0, 0.6), [2.8, 2.8])], blk, at=(0.6, 8.4, 0), sides=10, round_=2.2)
    s.box("bib", [2.6, 2.2, 1.0], s.style("bib", felt("cream", 4.8)), (0.6, 12.0, 1.6), chamfer=0.5)
    s.add("tail", "taper", [2.0, 1.0, 4.2], blk, centre=(0.6, 8.0, -2.4), rot=(30, 0, 0), front_scale=[1.0, 1.0], back_scale=[0.7, 0.8])
    beak = {"ramp": "orange", "tone": 4.4, "rim": {"light": 1, "dark": 1, "light_shift": 1.1, "dark_shift": -1.0, "outline": "none"},
            "layers": [{"id": "top", "op": "band", "axis": "y", "from": 0.2, "to": 1.0, "ramp": "honey", "tone": 5.0},
                       {"id": "tip", "op": "band", "axis": "z", "from": 0.65, "to": 1.0, "ramp": "soot", "tone": 2.0},
                       {"id": "red", "op": "band", "axis": "z", "from": -1.0, "to": -0.7, "ramp": "vermilion", "tone": 4.0},
                       {"id": "shine", "op": "gloss", "dash": True, "length": 2, "shift": 1.6, "density": 0.8, "post": True}], "brush": {"off": True}}
    s.add("beak", "taper", [1.8, 2.2, 5.6], s.style("beak", beak), centre=(0.6, 13.0, 4.2), rot=(12, 0, 0), front_scale=[0.35, 0.3], front_shift=[0, -0.5])
    for sx in (-1, 1):
        s.add(f"ring{sx}", "prism", [1.4, 1.4, 0.3], s.style("ring", felt("aegean", 4.4)), centre=(0.6 + sx * 1.5, 13.6, 1.2), sides=6, rot=(0, sx * 70, 0))
        s.add(f"eye{sx}", "prism", [0.6, 0.6, 0.3], s.style("eye", bead()), centre=(0.6 + sx * 1.62, 13.6, 1.2), sides=6, rot=(0, sx * 70, 0))
    return s


# ------------------------------------------------------------------------------------------------ the Serengeti
# ------------------------------------------------------------------------------------------------ Banff
@item
def sv_canoe():
    """A red canvas canoe with cedar gunwales and ribs, hung on two wall brackets, a paddle across it."""
    s = Spec("sv_canoe", "Red Canoe", density=6, tris=1400, hero=(14, 6))
    red = s.style("red", {**cloth("vermilion", 3.8, weave=0.3, photo="rough_linen", scale=8),
                          "layers": cloth("vermilion", 3.8, weave=0.3)["layers"] + [{"id": "paint", "op": "gloss", "dash": True, "length": 4, "shift": 1.2, "density": 0.5, "post": True},
                                                                                     {"id": "scuff", "op": "wear", "width": 1, "density": 0.2, "ramp": "oakl", "tone": 4}]})
    cedar = s.style("cedar", wood("oakl", 4.6, grain="x", knots=0))
    oak = s.style("oak", wood("walnut", 4.0, grain="y", knots=0))
    for sx in (-1, 1):
        s.box(f"bracket{sx}", [1.2, 1.0, 3.6], oak, (sx * 8, 6.0, 1.8), chamfer=0.2)
        s.box(f"plate{sx}", [2.0, 3.0, 0.4], oak, (sx * 8, 6.6, 0.2))
    s.loft("hull", [((-22, 2.4, 0), [0.6, 1.0]), ((-18, 0.6, 0), [2.6, 3.4]), ((-10, 0, 0), [4.4, 4.6]), ((0, 0, 0), [5.0, 5.0]),
                     ((10, 0, 0), [4.4, 4.6]), ((18, 0.6, 0), [2.6, 3.4]), ((22, 2.4, 0), [0.6, 1.0])], red, at=(0, 9.6, 2.8), sides=10, round_=2.0)
    s.loft("gunwale", [((-21, 2.0, 0), [1.0, 0.6]), ((-14, 0.4, 0), [1.0, 0.6]), ((0, 0.2, 0), [1.0, 0.6]), ((14, 0.4, 0), [1.0, 0.6]), ((21, 2.0, 0), [1.0, 0.6])],
           cedar, at=(0, 12.0, 5.1), sides=4, round_=6)
    for k, x in enumerate((-12, -6, 0, 6, 12)):
        s.box(f"rib{k}", [0.6, 0.6, 4.2], cedar, (x, 12.1, 2.8))
    s.box("seat", [2.6, 0.5, 4.0], cedar, (5.0, 11.8, 2.8))
    s.box("shaft", [16, 0.7, 0.7], cedar, (-1.0, 8.2, 5.8), rot=(0, 0, 8))
    s.box("blade", [5.0, 2.6, 0.4], cedar, (8.8, 9.6, 5.8), rot=(0, 0, 8), chamfer=0.6)
    s.box("grip", [1.6, 1.0, 0.8], cedar, (-9.4, 7.0, 5.8), rot=(0, 0, 8))
    return s


# ------------------------------------------------------------------------------------------------ Petra
@item
def sv_sandbottle():
    """A sand-art bottle from Petra: seven desert colours poured into waves and a camel at sunset, with a cork."""
    s = Spec("sv_sandbottle", "Sand Art Bottle", density=8, tris=900, hero=(30, 14))
    sand = {"ramp": "sand", "tone": 4.6, "light": 0.7, "rim": {"light": 1, "dark": 1, "light_shift": 1.6, "dark_shift": -1.0, "outline": "none"},
            "layers": [{"id": "l1", "op": "band", "axis": "y", "from": -1.0, "to": -0.62, "wobble": 0.4, "wobble_scale": 1.5, "ramp": "clay", "tone": 3.6},
                       {"id": "l2", "op": "band", "axis": "y", "from": -0.62, "to": -0.4, "wobble": 0.5, "wobble_scale": 1.8, "ramp": "ochre", "tone": 4.6},
                       {"id": "l3", "op": "band", "axis": "y", "from": -0.4, "to": -0.22, "wobble": 0.4, "wobble_scale": 2.0, "ramp": "terra", "tone": 4.4},
                       {"id": "l4", "op": "band", "axis": "y", "from": -0.22, "to": 0.0, "wobble": 0.5, "wobble_scale": 1.6, "ramp": "honey", "tone": 5.2},
                       {"id": "l5", "op": "band", "axis": "y", "from": 0.0, "to": 0.2, "wobble": 0.4, "ramp": "rose", "tone": 4.6},
                       {"id": "l6", "op": "band", "axis": "y", "from": 0.2, "to": 0.45, "wobble": 0.3, "ramp": "lake", "tone": 4.8},
                       {"id": "grain", "op": "noise", "scale": 0.4, "amount": 0.5},
                       {"id": "shine", "op": "gloss", "dash": True, "length": 3, "shift": 2.6, "density": 1.0, "post": True}],
            "stamps": [{"faces": ["s2_0"], "at": "center", "art": ["......cc.", ".....cccc", "cc...cc..", "ccccccc..", "cccccc...", ".c.c.c...", ".c.c.c..."], "key": {"c": "soot:2"}},
                       {"faces": ["s3_0"], "at": "center", "art": [".ss.", "ssss", ".ss."], "key": {"s": "lamp:5" if False else "honey:6"}}],
            "brush": {"off": True}}
    s.lathe("bottle", [(0, 4.6), (0.4, 5.2), (2.0, 5.6), (5.0, 5.6), (7.4, 5.0), (8.6, 3.4), (9.4, 2.2)], s.style("sand", sand), sides=10, round_=2.0)
    s.cyl("neck", 2.2, 1.8, s.style("glass", glass()), (0, 9.4, 0), sides=8)
    s.cyl("cork", 2.0, 1.8, s.style("cork", wood("oakl", 4.4, grain="y", knots=0, photo=0.0)), (0, 10.8, 0), sides=8, top=1.1)
    return s


# ------------------------------------------------------------------------------------------------ Angkor Wat
@item
def sv_lotuslamp():
    """A pink stone lotus on a lily pad, two rings of petals, a little flame floating in its heart."""
    s = Spec("sv_lotuslamp", "Lotus Lamp", density=8, tris=1400, hero=(32, 26))
    pad = s.style("pad", {**felt("fern", 4.0), "layers": [{"id": "veins", "op": "stripes", "axis": "around", "period": 0.0625, "width": 0.12, "shift": 0.9}]})
    s.lathe("pad", [(0, 11), (0.6, 11.4), (0.9, 10.6)], pad, sides=14, round_=2.0)
    s.cyl("stone", 4.4, 1.6, s.style("stn", stone("pebble", 4.4)), (0, 0.8, 0), sides=10, top=0.9)
    outer = s.style("outer", glaze("rose", 4.2, speck=False))
    inner = s.style("inner", glaze("blush" if False else "rose", 5.0, speck=False))
    for k in range(8):
        a = k / 8 * 360
        s.add(f"op{k}", "taper", [2.6, 0.8, 4.6], outer, at=(0, 2.0, 0), rot=(0, a, 0), off=(0, 1.6, 2.8), front_scale=[0.2, 0.5], paint=None)
        s.parts[-1]["rotation"] = [-48, a, 0]
    for k in range(6):
        a = k / 6 * 360 + 30
        s.add(f"ip{k}", "taper", [2.0, 0.7, 3.4], inner, at=(0, 2.6, 0), rot=(-62, a, 0), off=(0, 0, 1.8), front_scale=[0.2, 0.5])
    s.cyl("cup", 2.2, 1.6, s.style("cup", brass()), (0, 2.6, 0), sides=8)
    flame = ["..f..", ".fyf.", ".fyf.", "fyyyf", "fywyf", ".fyf."]
    s.card("glow_flame", flame, s.style("flm", glow("flame", 4.0)), at=(0, 4.2, 0), plane="xy", key={"f": "flame:2", "y": "flame:4", "w": "flame:5"}, size=[1.4, 2.0], off=(0, 1.0, 0))
    s.card("glow_flame2", flame, "flm", at=(0, 4.2, 0), plane="xy", key={"f": "flame:2", "y": "flame:4", "w": "flame:5"}, size=[1.4, 2.0], off=(0, 1.0, 0), rot=(0, 90, 0))
    s.anim("idle", 1.2, [{"parts": ["glow_flame", "glow_flame2"], "channel": "scale", "osc": {"amp": [0.12, 0.2, 0.12], "cycles": 2}}])
    return s


# ------------------------------------------------------------------------------------------------ the Great Barrier Reef
# ------------------------------------------------------------------------------------------------ Rio
@item
def sv_sambadrum():
    """A surdo samba drum with painted bands, a skin on top, tension rods, metal rims and a pair of felt mallets."""
    s = Spec("sv_sambadrum", "Samba Drum", density=6, tris=1600, hero=(30, 18))
    shell = {"ramp": "vermilion", "tone": 4.2, "rim": {"light": 1, "dark": 1, "light_shift": 1.0, "dark_shift": -1.0, "outline": "none"},
             "layers": [{"id": "g1", "op": "band", "axis": "y", "from": -0.2, "to": 0.2, "ramp": "honey", "tone": 5.0},
                        {"id": "zig", "op": "stripes", "axis": [1, 2, 0], "period": 1.6, "width": 0.35, "ramp": "fern", "tone": 4.0, "range": [-0.12, 0.12]},
                        {"id": "g2", "op": "band", "axis": "y", "from": 0.5, "to": 0.6, "ramp": "aegean", "tone": 4.2},
                        {"id": "g3", "op": "band", "axis": "y", "from": -0.6, "to": -0.5, "ramp": "aegean", "tone": 4.2},
                        {"id": "lac", "op": "gloss", "dash": True, "length": 4, "shift": 1.4, "density": 0.6, "post": True}],
             "brush": {"flow": "horizontal", "length": 1.6, "width": 0.4, "rough": 0.3, "textures": {"vermilion": "wood"}}}
    sh = s.style("shell", shell)
    met = s.style("met", brass("brass", 3.8))
    skin = s.style("skin", {"ramp": "oat", "tone": 5.0, "rim": {"light": 1, "dark": 1, "outline": "none"},
                            "layers": [{"id": "hide", "op": "noise", "scale": 1.2, "amount": 0.6}, {"id": "worn", "op": "spots", "count": 1, "radius": [1.2, 1.4], "shift": -0.8, "centers": [[0, 0, 0, 1.4]]}],
                            "brush": {"flow": "horizontal", "length": 1.0, "width": 0.4, "rough": 0.4, "textures": {"oat": "leather"}}})
    s.cyl("body", 11, 10, sh, (0, 1.0, 0), sides=14)
    s.cyl("rimB", 11.8, 1.2, met, (0, 0.4, 0), sides=14)
    s.cyl("rimT", 11.8, 1.2, met, (0, 10.4, 0), sides=14)
    s.cyl("skin", 10.8, 0.4, skin, (0, 11.2, 0), sides=14)
    for k in range(7):
        a = k / 7 * math.tau
        s.box(f"rod{k}", [0.5, 9.4, 0.5], met, (math.cos(a) * 5.9, 1.0 + 4.7, math.sin(a) * 5.9))
    felt_head = s.style("fh", felt("aegean", 3.6))
    stick = s.style("stick", wood("oakl", 4.6, grain="z", knots=0))
    for k, (rz, z) in enumerate(((10, 1.6), (-14, -1.8))):
        s.box(f"mallet{k}", [0.6, 0.6, 8.4], stick, (k * 1.4 - 0.6, 11.9, z), rot=(0, 20 + k * 30, 0))
    s.cyl("head0", 1.8, 1.4, felt_head, (2.3, 11.4, 4.6), sides=8)
    s.cyl("head1", 1.8, 1.4, felt_head, (-3.2, 11.4, -3.6), sides=8)
    s.box("strap", [0.8, 7.0, 0.4], s.style("strap", felt("ochre", 3.6)), (5.7, 5.6, 0.0), rot=(0, 0, 4))
    return s


# ------------------------------------------------------------------------------------------------ Milford Sound
@item
def sv_kiwi():
    """A kiwi plush: round, brown, shaggy, with a long curious beak and little stompy feet."""
    s = Spec("sv_kiwi", "Kiwi Plush", density=8, tris=1200, hero=(36, 14))
    fur = s.style("fur", plush("tawny", 3.8, seed=5))
    s.loft("body", [((0, 0, -4.6), [4.0, 4.2]), ((0, 0.4, -2.6), [7.4, 6.6]), ((0, 0.6, 0.4), [8.0, 7.2]), ((0, 0.8, 2.6), [6.6, 6.2]), ((0, 1.4, 4.4), [4.2, 4.2])],
           fur, at=(0, 4.6, 0), sides=12, round_=2.1)
    beak = s.style("beak", glaze("cream", 4.0, speck=False))
    s.add("beak", "prism", [0.9, 0.9, 6.6], beak, at=(0, 6.0, 5.8), off=(0, 0, 3.0), rot=(30, 0, 0), sides=6, front_scale=[0.45, 0.45])
    for sx in (-1, 1):
        s.add(f"eye{sx}", "prism", [0.7, 0.7, 0.4], s.style("eye", bead()), centre=(sx * 1.5, 6.9, 5.4), sides=6, rot=(0, sx * 35, 0))
        s.cyl(f"leg{sx}", 0.9, 1.6, s.style("leg", felt("buff", 3.8)), (sx * 1.6, 0.6, 0.8), sides=6)
        s.box(f"foot{sx}", [1.8, 0.6, 2.4], s.style("leg", felt("buff", 3.8)), (sx * 1.6, 0.3, 1.6), chamfer=0.2)
    return s


# ------------------------------------------------------------------------------------------------ Antarctica
@item
def sv_penguin():
    """An emperor penguin plush with honey ear patches and a fluffy grey chick tucked on its feet."""
    s = Spec("sv_penguin", "Penguin Plush", density=7, tris=1800, hero=(30, 14))
    blk = s.style("blk", plush("soot", 3.0, seed=6))
    wht = s.style("wht", plush("snow", 4.8, seed=7))
    s.lathe("body", [(0.6, 5.6), (1.6, 7.6), (4.0, 8.6), (7.4, 8.0), (10.2, 6.4), (11.4, 5.2)], blk, sides=12, round_=2.0)
    s.lathe("belly", [(0.8, 4.6), (1.8, 6.6), (4.0, 7.4), (7.2, 6.8), (9.6, 4.8)], wht, base=(0, 0, 1.5), sides=12, round_=2.0)
    s.lathe("head", [(11.0, 5.0), (11.8, 5.8), (13.2, 6.0), (14.6, 5.0), (15.4, 3.0)], blk, sides=12, round_=2.0)
    for sx in (-1, 1):
        s.box(f"ear{sx}", [1.6, 2.6, 2.0], s.style("ear", felt("honey", 4.6)), (sx * 2.5, 12.2, 1.0), rot=(0, sx * 25, 0), chamfer=0.6)
        s.add(f"eye{sx}", "prism", [0.7, 0.7, 0.4], s.style("eye", bead()), centre=(sx * 1.4, 13.6, 2.7), sides=6, rot=(0, sx * 25, 0))
        s.add(f"flipper{sx}", "taper", [1.2, 7.0, 3.0], blk, centre=(sx * 4.4, 6.6, -0.4), rot=(0, 0, sx * -12), front_scale=[0.8, 0.5])
        s.box(f"foot{sx}", [2.2, 0.8, 3.0], s.style("feet", felt("soot", 2.2)), (sx * 1.6, 0.4, 2.4), chamfer=0.3)
    s.add("beak", "taper", [1.2, 1.0, 2.6], s.style("beak", felt("orange", 3.8)), centre=(0, 13.0, 3.6), rot=(14, 0, 0), front_scale=[0.3, 0.4])
    chick = s.style("chick", plush("pebble", 4.4, seed=8))
    s.lathe("chick", [(0.6, 2.6), (1.4, 3.8), (3.0, 4.0), (4.4, 3.4), (5.2, 2.0)], chick, base=(0, 0, 5.2), sides=10, round_=2.0)
    s.lathe("chickhead", [(5.0, 2.6), (5.8, 3.4), (6.8, 3.2), (7.6, 1.6)], blk, base=(0, 0, 5.2), sides=10, round_=2.0)
    s.box("chickface", [2.4, 1.6, 1.2], wht, (0, 6.4, 6.6), chamfer=0.5)
    for sx in (-1, 1):
        s.add(f"ceye{sx}", "prism", [0.5, 0.5, 0.3], s.style("eye", bead()), centre=(sx * 0.6, 6.6, 7.2), sides=6)
    return s
