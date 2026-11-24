"""Home items (src/assets/home.ts): cuckoo, painting, fireplace, wardrobe, record, mushlamp, teaset, starmap, toybox,
mushpot. Units px, origin bottom-centre, facing +Z; wall items hang with their back on z = 0."""
import math
import os

import numpy as np

from kit import (ARTS, image_art, Spec, wood, painted_wood, cloth, velvet, brass, iron, glaze, clay, stone, wax, leafy, glow, soil, flat, UP,
                 pillow, lace_art, torus, arc_points, grid_art, flame_art, frond_art)
from items_start import flame, star_art, book_styles, book, twig_art

ITEMS = {}
CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=?@^~"


def item(fn):
    ITEMS[fn.__name__] = fn
    return fn


def indexed_art(idx, keys):
    """Card art from a 2-D array of indices into `keys` (a list of colour refs); -1 = transparent."""
    rows = []
    for r in idx:
        rows.append("".join("." if v < 0 else CHARS[v] for v in r))
    return rows, {CHARS[i]: k for i, k in enumerate(keys)}


def hashf(x, y, s=0):
    v = math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453
    return v - math.floor(v)


# ------------------------------------------------------------------------------------------------ wall pieces
@item
def cuckoo():
    """Cuckoo clock: a carved oak cottage with a steep shingled roof, carved leaves and a little owl finial, a cream
    dial with painted hour marks and walnut hands, a tiny round door above the dial, pine-cone weights on brass chains
    and a leaf pendulum that swings (clip 'idle'). Wall item, back on z = 0, ~12 px wide."""
    s = Spec("cuckoo", "Cuckoo Clock", density=8, tris=2400, hero=(26, 10), grounded=False)
    body = s.style("body", wood("oak", 4.0, grain="y", knots=1, seed=1))
    trim = s.style("trim", wood("walnut", 4.0, grain="x", knots=0, seed=2))
    roofst = {"ramp": "walnut", "tone": 3.6, "rim": {"light": 1, "dark": 1, "light_shift": 0.8, "dark_shift": -0.8, "outline": "dark"},
              "layers": [{"id": "shingles", "op": "scales", "along": "z", "size": [1.3, 1.0], "shape": "round", "gap": 0.12, "highlight": 1, "shadow": 1, "jitter": 0.3},
                         {"id": "moss", "op": "patches", "scale": 1.4, "threshold": 0.74, "ramp": "moss", "tone": 3.6}],
              "brush": {"flow": "horizontal", "length": 0.8, "width": 0.4, "rough": 0.4, "textures": {"walnut": "wood", "moss": "moss"}}}
    roof = s.style("roof", roofst)
    s.box("house", [10, 10.5, 3.4], body, (0, 5.25, 1.7), chamfer=0.25, paint={"layers": [
        {"id": "boards", "op": "stripes", "axis": "x", "period": 2.0, "width": 0.06, "shift": -1.2, "faces": ["front"]}]})
    for sx in (-1, 1):
        s.box(f"roof{sx}", [7.4, 0.8, 4.6], roof, (sx * 3.0, 13.0, 1.9), rot=(0, 0, -sx * 40))
        s.box(f"gable{sx}", [0.5, 0.5, 0.5], trim, (sx * 5.8, 10.6, 3.7))
    # gable wall triangle under the roof
    s.add("gable", "taper", [10, 5.0, 3.0], body, centre=(0, 12.5, 1.6), front_scale=[1, 1], back_scale=[1, 1], rot=(0, 0, 0),
          paint={"layers": []}, hide=["bottom"]) if False else None
    s.add("gable", "prism", [8.6, 3.0, 3.0], body, centre=(0, 11.6, 1.6), sides=3, angle=0)
    s.box("sill", [11.2, 0.7, 4.0], trim, (0, 0.35, 2.0), chamfer=0.2)
    s.box("eave", [10.6, 0.5, 3.8], trim, (0, 10.3, 2.0))
    # owl finial at the peak
    owl = s.style("owl", wood("oakl", 4.4, grain="y", knots=0, wear=0.2, seed=8))
    s.lathe("owl", [(0, 1.4), (0.9, 1.9), (1.8, 1.6), (2.4, 1.0)], owl, base=(0, 15.2, 1.8), sides=8, caps=(True, True),
            paint={"layers": [{"id": "eyes", "op": "spots", "centers": [[-0.35, 1.6, 0.8, 0.18], [0.35, 1.6, 0.8, 0.18]], "ramp": "ink", "tone": 1}]})
    for sx in (-1, 1):
        s.add(f"ear{sx}", "taper", [0.5, 0.7, 0.5], owl, centre=(sx * 0.45, 17.85, 1.8), front_scale=[0.2, 0.2], rot=(-90, 0, 0))
    # dial
    dial = s.style("dial", {**glaze("cream", 4.8, speck=False), "layers": glaze("cream", 4.8, speck=False)["layers"] + [
        {"id": "ring", "op": "band", "axis": [0, 0, 1], "from": -2, "to": 2, "shift": 0}]})
    s.add("dial", "prism", [6.4, 6.4, 0.5], dial, centre=(0, 5.6, 3.6), sides=14)
    bez = s.style("bez", brass())
    torus(s, "bezel", (0, 5.6, 3.75), 3.25, [0.5, 0.5], bez, n=16, sides=4, rot=(90, 0, 0))
    # hour marks as stamps: 12 dots round the dial (spots on the dial front)
    marks = [[math.sin(k * math.pi / 6) * 2.5, math.cos(k * math.pi / 6) * 2.5, 0.25, 0.22 if k % 3 else 0.32] for k in range(12)]
    s.parts[-2]["paint"] = {"layers": [{"id": "marks", "op": "spots", "centers": [[m[0], m[1], 0.25, m[3]] for m in marks], "ramp": "walnut", "tone": 1.5}]}
    hand = s.style("hand", flat("walnut", 1.6, light=0.4, outline="none"))
    s.box("hour", [0.45, 1.9, 0.2], hand, (0, 5.6, 3.95), rot=(0, 0, -60)) if False else None
    s.add("hourh", "box", [0.5, 1.8, 0.2], hand, at=(0, 5.6, 3.95), off=(0, 0.9, 0), rot=(0, 0, -62))
    s.add("minh", "box", [0.36, 2.6, 0.2], hand, at=(0, 5.6, 4.05), off=(0, 1.3, 0), rot=(0, 0, 18))
    s.add("hub", "prism", [0.6, 0.6, 0.3], bez, centre=(0, 5.6, 4.15), sides=6)
    # little round door with a peeking owl face above the dial
    s.add("door", "prism", [2.2, 2.2, 0.3], trim, centre=(0, 9.3, 3.5), sides=10,
          paint={"layers": [{"id": "hole", "op": "spots", "centers": [[0, 0, 0.15, 0.75]], "ramp": "ink", "tone": 1.2},
                            {"id": "peek", "op": "spots", "centers": [[-0.25, 0.05, 0.15, 0.12], [0.25, 0.05, 0.15, 0.12]], "ramp": "honey", "tone": 6}]})
    # carved leaves either side of the dial
    leafst = s.style("leafst", {"ramp": "oakl", "tone": 4.5, "light": 0.8, "rim": {"outline": "none"}, "layers": []})
    lf = frond_art(12, 20, seed=3, leaflets=5)
    for sx in (-1, 1):
        s.card(f"carve{sx}", lf, leafst, at=(sx * 4.0, 3.2, 3.45), rot=(0, 0, sx * 35), size=[2.2, 3.8], off=(0, 1.6, 0),
               key={"s": "oak:2", "l": "oakl:5", "d": "oak:3", "h": "oakl:7"})
    # weights on chains
    chain = s.style("chain", {"ramp": "brass", "tone": 4, "light": 0.5, "rim": {"outline": "none"}, "layers": []})
    chain_art = ["c.", ".c", "c.", ".c"] * 6
    cone = {"ramp": "bark", "tone": 4.0, "rim": {"light": 1, "dark": 1, "light_shift": 0.8, "dark_shift": -0.8, "outline": "dark"},
            "layers": [{"id": "scales", "op": "scales", "along": "around", "size": [0.9, 0.7], "shape": "round", "gap": 0.1, "highlight": 1, "shadow": 1, "jitter": 0.3}],
            "brush": {"flow": "vertical", "length": 0.6, "width": 0.3, "rough": 0.3, "textures": {"bark": "wood"}}}
    cn = s.style("cone", cone)
    for k, (x, drop) in enumerate([(-2.6, 7.0), (2.6, 9.2)]):
        s.card(f"chain{k}", chain_art, chain, at=(x, -drop / 2 + 0.2, 1.4), size=[0.35, drop], key={"c": "brass:5"})
        s.lathe(f"cone{k}", [(0, 0.4), (0.6, 1.6), (1.8, 2.0), (2.8, 1.5), (3.3, 0.5)], cn, base=(x, -drop - 3.2, 1.4), sides=8)
    # the pendulum: a brass rod with a carved leaf bob
    s.bone("pend", at=(0, 0.4, 1.0))
    s.add("rod", "box", [0.3, 8.0, 0.25], bez, parent="pend", rel=(0, 0, 0), off=(0, -4.0, 0))
    bob = s.style("bob", {"ramp": "brass", "tone": 4.0, "light": 0.8, "rim": {"outline": "dark"}, "layers": []})

    def leaf(x, y):
        dx = abs(x - 0.5)
        half = 0.46 * math.sin(min(1, y * 1.05) * math.pi) ** 0.7
        if dx > half:
            return "."
        if dx < 0.05:
            return "v"
        return "h" if x < 0.4 and y < 0.5 else ("d" if dx > half - 0.08 else "l")
    for k, rot in enumerate([(0, 0, 0)]):
        s.card(f"bob{k}", grid_art(16, 22, leaf), bob, parent="pend", rel=(0, -8.0, 0.1), rot=rot, off=(0, -1.3, 0), size=[2.0, 2.8],
               key={"v": "brass:2", "l": "brass:5", "h": "brass:7", "d": "brass:3"})
    s.anim("idle", 2.0, [{"part": "pend", "osc": {"axis": "z", "amp": 14, "cycles": 1}}])
    return s


def moonlit_lake(W, H, seed=1):
    """Pixel art: a moonlit lake under a full moon, pines on the far shore, reeds in front."""
    keys = ["night:1", "night:2", "night:3", "dusk:2", "dusk:3", "glow:2", "glow:4", "glow:6", "pine:1", "pine:2", "pine:3",
            "lake:2", "lake:3", "lake:5", "fern:2", "fern:4", "honey:4", "mist:3"]
    K = {k: i for i, k in enumerate(keys)}
    a = np.zeros((H, W), int)
    mx, my, mr = W * 0.68, H * 0.28, H * 0.11
    horizon = int(H * 0.56)
    for y in range(H):
        for x in range(W):
            t = y / horizon
            if y < horizon:
                c = "night:1" if t < 0.3 else "night:2" if t < 0.6 else "night:3" if t < 0.85 else "dusk:2"
                # dither between bands
                if 0.27 < t < 0.33 and (x + y) % 2:
                    c = "night:2"
                if 0.57 < t < 0.63 and (x + y) % 2:
                    c = "night:3"
                d = math.hypot(x - mx, y - my)
                if d < mr * 2.1 and (int(d) % 2 == 0) and d > mr * 1.5 and hashf(x, y, 3) > 0.5:
                    c = "dusk:3"
                if d < mr:
                    c = "glow:6" if d < mr * 0.6 else "glow:4"
                    if math.hypot(x - mx + mr * 0.3, y - my + mr * 0.2) < mr * 0.22:
                        c = "glow:2"
                elif hashf(x, y, seed) > 0.985 and t < 0.8:
                    c = "glow:6"
                # far hills and pines
                ridge = horizon - 2 - 2.5 * math.sin(x * 0.11 + 1.3) - 1.5 * math.sin(x * 0.29)
                tree = horizon - 3 - (6 * abs(((x * 0.37) % 1.0) - 0.5) * 2 if hashf(int(x / 2.7), 0, 5) > 0.35 else 0)
                if y > min(ridge, tree):
                    c = "pine:1" if y > ridge else "pine:2"
            else:
                t2 = (y - horizon) / (H - horizon)
                c = "lake:2" if t2 > 0.5 else "lake:3"
                if (y + int(hashf(x // 4, y, 2) * 3)) % 4 == 0:
                    c = "lake:3" if c == "lake:2" else "dusk:3"
                # moon path on the water
                if abs(x - mx) < (2 + t2 * 6) * (0.6 + 0.4 * hashf(y, 0, 9)) and (y % 2 == 0 or hashf(x, y, 4) > 0.6):
                    c = "glow:4" if abs(x - mx) < 2 + t2 * 3 else "lake:5"
                # reflection of the far shore
                if y < horizon + 3 and hashf(x, y, 7) > 0.4:
                    c = "pine:1"
            a[y, x] = K[c]
    # reeds in the front left and right
    for x in list(range(2, int(W * 0.2))) + list(range(int(W * 0.86), W - 1)):
        if hashf(x, 1, 6) > 0.45:
            h = int(H * (0.12 + 0.18 * hashf(x, 2, 6)))
            for y in range(H - h, H):
                a[y, x] = K["fern:2" if (x + y) % 3 else "fern:4"]
            if hashf(x, 3, 6) > 0.6:
                a[H - h - 1, x] = K["honey:4"]
                a[H - h - 2, x] = K["honey:4"]
    return indexed_art(a, keys)


@item
def painting():
    """Moonlit painting: a real nocturne (Whistler's moonrise over Southampton Water, 1872, public domain), pixel-graded,
    in a carved, rubbed-gilt frame with a brass name plate. Wall item, back on z = 0, 14 x 10 px."""
    s = Spec("painting", "Moonlit Painting", density=12, tris=600, hero=(24, 8), grounded=False)
    gilt = s.style("gilt", brass(tone=3.8))
    gilt_d = s.style("gilt_d", brass(tone=3.0, seed=3))
    for k, (cx, cy, w, h) in enumerate([(0, 9.4, 14.0, 1.2), (0, 0.6, 14.0, 1.2), (-6.4, 5.0, 1.2, 7.6), (6.4, 5.0, 1.2, 7.6)]):
        s.box(f"frame{k}", [w, h, 1.0], gilt, (cx, cy, 0.5), chamfer=0.3,
              paint={"layers": [{"id": "bead", "op": "stripes", "axis": "x" if w > h else "y", "period": 0.6, "width": 0.4, "shift": 0.8,
                                 "faces": ["front"], "range": [-0.2, 0.2]}]})
    s.box("liner", [11.8, 8.0, 0.4], gilt_d, (0, 5.0, 0.35))
    canvas = s.style("canvas", {"ramp": "night", "tone": 3, "light": 0.35, "rim": {"outline": "none"}, "layers": []})
    # real art: James McNeill Whistler, Nocturne: Blue and Gold - Southampton Water (1872), Art Institute of Chicago
    art, key = image_art(os.path.join(ARTS, "whistler_nocturne_southampton.jpg"), 132, 89, colours=40, sat=1.1, light=0.05, shadow=0.04, contrast=1.0)
    s.card("canvas", art, canvas, at=(0, 5.0, 0.62), size=[11.0, 7.4], key=key)
    s.box("plate", [2.6, 0.6, 0.2], gilt, (0, 0.6, 1.08))
    return s


def star_chart(W, H):
    keys = ["night:1", "night:2", "night:3", "dusk:2", "glow:3", "glow:5", "glow:6", "brass:4", "brass:6", "mist:3", "lilac:3"]
    K = {k: i for i, k in enumerate(keys)}
    a = np.full((H, W), K["night:2"], int)
    cx, cy = W / 2, H / 2
    for y in range(H):
        for x in range(W):
            d = math.hypot((x - cx) / W, (y - cy) / H)
            a[y, x] = K["night:1"] if d > 0.55 else K["night:2"]
            if (x + y) % 7 == 0 and hashf(x, y, 1) > 0.5:
                a[y, x] = K["night:3"]
            r = math.hypot(x - cx, (y - cy) * 1.0)
            if abs(r - H * 0.42) < 0.6 or abs(r - H * 0.44) < 0.4:
                a[y, x] = K["brass:4"]
            if hashf(x, y, 5) > 0.975:
                a[y, x] = K["glow:3"]
    # border
    a[0, :] = a[-1, :] = K["brass:6"]
    a[:, 0] = a[:, -1] = K["brass:6"]
    a[2, 2:-2] = a[-3, 2:-2] = K["brass:4"]
    a[2:-2, 2] = a[2:-2, -3] = K["brass:4"]
    # constellations: an owl (two eyes and ears), the Great Moth, a crescent
    groups = [
        [(0.22, 0.3), (0.3, 0.25), (0.38, 0.3), (0.34, 0.42), (0.26, 0.42), (0.22, 0.3)],
        [(0.62, 0.22), (0.7, 0.3), (0.78, 0.22), (0.74, 0.4), (0.66, 0.4), (0.62, 0.22)],
        [(0.18, 0.68), (0.3, 0.62), (0.42, 0.7), (0.55, 0.64), (0.68, 0.72)],
        [(0.72, 0.6), (0.82, 0.66), (0.8, 0.8)],
    ]
    for g in groups:
        for (x0, y0), (x1, y1) in zip(g, g[1:]):
            n = int(max(abs(x1 - x0) * W, abs(y1 - y0) * H))
            for k in range(0, n, 2):
                t = k / max(n, 1)
                a[int((y0 + (y1 - y0) * t) * H), int((x0 + (x1 - x0) * t) * W)] = K["lilac:3"]
        for x0, y0 in g:
            X, Y = int(x0 * W), int(y0 * H)
            for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
                a[Y + dy, X + dx] = K["glow:5"] if (dx or dy) else K["glow:6"]
    # crescent moon in the middle and a compass rose
    for y in range(H):
        for x in range(W):
            d1 = math.hypot(x - cx, y - cy)
            d2 = math.hypot(x - cx - 2.2, y - cy + 1.2)
            if d1 < 5.5 and d2 > 4.6:
                a[y, x] = K["glow:5"] if d1 < 4.6 else K["brass:6"]
    for k in range(8):
        ang = k * math.pi / 4
        L = 7 if k % 2 == 0 else 4
        for q in range(L):
            x, y = int(W * 0.86 + math.sin(ang) * q * 0.6), int(H * 0.84 - math.cos(ang) * q * 0.6)
            if 0 <= x < W and 0 <= y < H:
                a[y, x] = K["brass:6"]
    return indexed_art(a, keys)


@item
def starmap():
    """Star chart: a real 1515 woodcut star chart (Duerer's Northern Sky, public domain) mounted as a hanging scroll
    between two turned walnut rods with brass end caps, on a cord. Wall item, back on z = 0, ~11 px tall."""
    s = Spec("starmap", "Star Chart", density=14, tris=900, hero=(24, 8), grounded=False)
    rod = s.style("rod", wood("walnut", 4.2, grain="x", knots=0, wear=0.3, seed=1))
    cap = s.style("cap", brass())
    for k, y in enumerate([10.0, 0.7]):
        s.add(f"rod{k}", "prism", [0.9, 0.9, 9.6], rod, centre=(0, y, 0.6), rot=(0, 90, 0), sides=8)
        for sx in (-1, 1):
            s.add(f"cap{k}{sx}", "prism", [1.2, 1.2, 0.6], cap, centre=(sx * 5.1, y, 0.6), rot=(0, 90, 0), sides=8)
    # real art: Albrecht Duerer, Celestial Map of the Northern Sky with the Twelve Zodiac Signs (1515), woodcut,
    # Art Institute of Chicago (public domain)
    paper = s.style("paper", {"ramp": "paper", "tone": 4, "light": 0.4, "rim": {"outline": "none"}, "layers": []})
    art, key = image_art(os.path.join(ARTS, "durer_celestial_north.jpg"), 104, 129, colours=16, sat=0.7, light=0.04, shadow=0.1, contrast=1.0)
    s.card("chart", art, paper, at=(0, 5.35, 0.42), size=[7.4, 9.2], key=key)
    cord = s.style("cord", {"ramp": "oat", "tone": 3, "light": 0.5, "rim": {"outline": "none"}, "layers": []})

    def cord_art(x, y):
        yy = 1 - y
        cxl = 0.5 - 0.5 * (1 - yy)
        cxr = 0.5 + 0.5 * (1 - yy)
        return "c" if abs(x - cxl) < 0.04 or abs(x - cxr) < 0.04 else "."
    s.card("cord", grid_art(40, 10, cord_art), cord, at=(0, 11.2, 0.5), size=[8.4, 1.8], key={"c": "oat:3"})
    return s


# ------------------------------------------------------------------------------------------------ hearth
@item
def fireplace():
    """Stone hearth: a river-stone fireplace with an arched opening and keystone, an oak mantel beam with a candle stub,
    a jar and a tiny framed owl print, a sooty firebox with crossed birch logs and a flickering fire (glowing cards,
    clip 'idle'), glowing embers, a flagstone hearth and a brass poker. 1.5 x 1 blocks, 26 px tall."""
    s = Spec("fireplace", "Stone Hearth", density=5, tris=3200, hero=(28, 14))
    st = stone("stone", 4.2, seed=1)
    st["layers"].insert(0, {"id": "blocks", "op": "scales", "along": "x", "size": [3.2, 2.2], "shape": "square", "gap": 0.18,
                            "highlight": 1, "shadow": 1, "jitter": 0.6, "gradient": 0.4})
    st["layers"].append({"id": "moss", "op": "patches", "scale": 1.6, "threshold": 0.83, "ramp": "moss", "tone": 3.6})
    stn = s.style("stn", st)
    soot = s.style("soot", {"ramp": "iron", "tone": 1.4, "light": 0.6, "rim": {"outline": "none"},
                            "layers": [{"id": "soot", "op": "noise", "scale": 1.0, "amount": 0.8}]})
    # side piers, arch and chimney breast
    for sx in (-1, 1):
        s.box(f"pier{sx}", [5.0, 14.0, 8.0], stn, (sx * 7.0, 7.0, 0.2), chamfer=0.4, hide=["bottom"])
    s.box("arch", [19.0, 3.6, 8.6], stn, (0, 15.8, 0.2), chamfer=0.5)
    s.box("keystone", [2.4, 3.0, 1.0], s.style("key", stone("pebble", 4.4, seed=5)), (0, 13.9, 4.5), chamfer=0.3)
    s.box("breast", [14.0, 8.6, 5.6], stn, (0, 21.7, -1.0), chamfer=0.4)
    s.box("firebox", [9.4, 13.6, 1.0], soot, (0, 6.8, -3.2))
    s.box("fbside_l", [0.6, 13.6, 6.0], soot, (-4.4, 6.8, 0.0))
    s.box("fbside_r", [0.6, 13.6, 6.0], soot, (4.4, 6.8, 0.0))
    s.box("fbtop", [9.4, 0.6, 6.0], soot, (0, 13.7, 0.0))
    # mantel beam
    beam = s.style("beam", wood("oak", 4.0, grain="x", knots=3, seed=4))
    s.box("mantel", [20.0, 1.8, 3.4], beam, (0, 18.5, 4.0), chamfer=0.35)
    for sx in (-1, 1):
        s.add(f"corbel{sx}", "taper", [1.4, 2.4, 2.4], beam, centre=(sx * 8.2, 16.4, 4.4), front_scale=[1, 0.3], front_shift=[0, 0.8])
    # hearth slab
    s.box("hearth", [22.0, 1.0, 5.0], s.style("flag", stone("pebble", 3.8, seed=7)), (0, 0.5, 5.2), chamfer=0.3)
    # logs and fire
    bark = s.style("barkst", {"ramp": "pebble", "tone": 5, "rim": {"light": 1, "dark": 1, "light_shift": 0.6, "dark_shift": -0.8, "outline": "dark"},
                              "layers": [{"id": "lent", "op": "stripes", "axis": "z", "period": 1.0, "width": 0.15, "shift": -2.4, "wobble": 0.4},
                                         {"id": "char", "op": "patches", "scale": 0.8, "threshold": 0.55, "ramp": "iron", "tone": 1.2}],
                              "brush": {"flow": "long", "length": 1.0, "width": 0.4, "rough": 0.4, "textures": {"pebble": "wood"}}})
    s.add("log0", "prism", [1.8, 1.8, 7.6], bark, centre=(-0.6, 1.9, 0.6), rot=(0, 72, 8), sides=7)
    s.add("log1", "prism", [1.7, 1.7, 7.2], bark, centre=(0.8, 2.2, 0.2), rot=(0, -66, -6), sides=7)
    s.add("log2", "prism", [1.4, 1.4, 6.0], bark, centre=(0.1, 3.4, 0.0), rot=(0, 92, 4), sides=7)
    ember = s.style("ember", glow("flame", 2.6))
    s.box("glow_embers", [7.4, 0.5, 4.6], ember, (0, 1.25, 0.6))
    fl = s.style("fl", glow("flame", 4.0))
    tracks = []
    for k, (x, z, h, w) in enumerate([(-1.6, 0.8, 5.6, 3.0), (1.2, 0.4, 6.6, 3.4), (0.0, 1.4, 4.6, 2.6), (2.4, 1.0, 3.6, 2.0), (-2.6, 0.2, 3.8, 2.2)]):
        tracks += flame(s, k, (x, 2.6, z), fl, h=h, w=w, phase=k * 0.23)
    s.anim("idle", 1.6, tracks)
    # mantel things: a candle stub, a little jar and a tiny framed owl print
    wx = wax("cream", 5.0)
    s.lathe("stub", [(0, 1.4), (1.6, 1.4), (1.9, 1.1)], s.style("stub", wx), base=(-6.4, 19.4, 4.2), sides=8)
    s.lathe("jar", [(0, 1.6), (0.3, 1.8), (2.2, 1.8), (2.6, 1.0), (2.9, 1.1)], s.style("jarst", glaze("lake", 4.2)), base=(6.6, 19.4, 4.0), sides=8)
    fr = s.style("fr", wood("walnut", 4, grain="y", knots=0, seed=9))
    s.box("print", [3.4, 4.2, 0.4], fr, (2.2, 21.5, 3.4), rot=(-8, -10, 0), chamfer=0.15, paint={"layers": [
        {"id": "pic", "op": "rect", "rect": [0.18, 0.15, 0.82, 0.85], "ramp": "oat", "tone": 5, "faces": ["front"], "bevel": True},
        {"id": "owl", "op": "spots", "centers": [[0, 0.1, 0.25, 0.8]], "ramp": "ochre", "tone": 3.4, "faces": ["front"]},
        {"id": "eyes", "op": "spots", "centers": [[-0.3, 0.35, 0.25, 0.16], [0.3, 0.35, 0.25, 0.16]], "ramp": "ink", "tone": 1, "faces": ["front"]}]})
    # brass poker leaning on the right pier
    br = s.style("br", iron())
    s.add("poker", "prism", [0.4, 0.4, 10.0], br, at=(10.0, 0.1, 4.8), off=(0, 0, 5.0), rot=(-80, 0, 10), sides=5)
    s.lathe("pokerknob", [(0, 0.9), (0.5, 1.0), (0.9, 0.5)], s.style("brk", brass()), base=(11.6, 9.8, 6.6), sides=6)
    return s


# ------------------------------------------------------------------------------------------------ storage
@item
def wardrobe():
    """Painted wardrobe: a milk-painted lake-blue armoire with cream-trimmed raised door panels, hand-painted rose and
    fern sprays, chipped edges showing the oak beneath, brass knobs and keyhole escutcheon, a crowned cornice and bun
    feet. 1 x 0.5 blocks, flat top at 26 px."""
    s = Spec("wardrobe", "Painted Wardrobe", density=5, tris=2400, hero=(30, 14))
    body = s.style("body", painted_wood("lake", 3.8, under="oakl", grain="y"))
    trim = s.style("trim", painted_wood("cream", 4.8, under="oak", grain="x", seed=3))
    s.box("carcass", [14.6, 21.6, 7.4], body, (0, 13.0, -0.1), chamfer=0.3)
    s.box("plinth", [15.6, 1.6, 8.2], trim, (0, 2.2, 0.0), chamfer=0.3)
    s.box("cornice", [16.0, 1.0, 8.6], trim, (0, 24.3, 0.1), chamfer=0.3)
    s.box("crown", [16.6, 1.2, 9.0], trim, (0, 25.4, 0.1), chamfer=0.4)
    for k, (x, z) in enumerate([(-6.4, 3.0), (6.4, 3.0), (-6.4, -3.0), (6.4, -3.0)]):
        s.lathe(f"foot{k}", [(0, 1.0), (0.4, 1.8), (1.0, 1.9), (1.45, 1.3)], s.style("footst", wood("walnut", 4, grain="y", knots=0)), base=(x, 0, z), sides=8)
    flowers = [
        {"id": "petals", "op": "spots", "centers": [[cx + 0.55 * math.cos(a), cy + 0.55 * math.sin(a), 0.45, 0.42] for cx, cy in [(0.2, 3.0), (-0.8, -1.8), (0.9, -2.6)] for a in np.linspace(0, 2 * math.pi, 6)[:5]],
         "ramp": "rose", "tone": 4.6, "bevel": True, "faces": ["front"]},
        {"id": "hearts", "op": "spots", "centers": [[0.2, 3.0, 0.45, 0.3], [-0.8, -1.8, 0.45, 0.3], [0.9, -2.6, 0.45, 0.3]], "ramp": "honey", "tone": 5.2, "faces": ["front"]},
        {"id": "leaves", "op": "spots", "centers": [[-0.9, 3.6, 0.45, 0.4], [1.2, 2.2, 0.45, 0.4], [0.1, -3.4, 0.45, 0.35], [-1.6, -1.0, 0.45, 0.35], [1.6, -1.8, 0.45, 0.35], [-0.4, 0.4, 0.45, 0.3]],
         "ramp": "fern", "tone": 4.0, "stretch": [1.8, 0.8, 1], "faces": ["front"]},
        {"id": "stem", "op": "band", "axis": "x", "from": -0.06, "to": 0.06, "ramp": "fern", "tone": 3.2, "faces": ["front"]},
    ]
    for sx in (-1, 1):
        s.box(f"door{sx}", [6.9, 19.6, 0.6], body, (sx * 3.55, 13.0, 3.75), chamfer=0.15, paint={"layers": [
            {"id": "panel", "op": "panel", "inset": 4, "shift": -0.7, "highlight": 1, "shadow": 1},
            {"id": "trimline", "op": "panel", "inset": 6, "shift": 1.8, "highlight": 0, "shadow": 0}] + flowers})
        s.add(f"knob{sx}", "prism", [0.8, 0.8, 0.6], s.style("knob", brass()), centre=(sx * 0.9, 13.0, 4.3), sides=8)
    s.box("escut", [0.9, 1.5, 0.15], "knob", (0, 11.6, 4.1), paint={"layers": [{"id": "hole", "op": "spots", "centers": [[0, 0.1, 0.1, 0.18]], "ramp": "ink", "tone": 1}]})
    return s


@item
def toybox():
    """Plush pile: an open honey-painted toy chest with stencilled stars and rope handles, the lid propped open, spilling
    plushies: a lilac mouse, a honey moon and a slightly worried rose worm. 1 x 0.5 blocks."""
    s = Spec("toybox", "Plush Pile", density=6, tris=2600, hero=(30, 22))
    body = s.style("body", painted_wood("sage", 4.0, under="oak", grain="x"))
    trim = s.style("trim", wood("walnut", 4.0, grain="x", knots=0, seed=2))
    stars = [[x, y, 4.2, 0.45] for x, y in [(-3.8, 0.6), (-0.8, -0.6), (2.6, 0.9), (4.6, -0.8)]]
    s.box("chest", [12.0, 6.0, 8.0], body, (0, 3.4, 0), chamfer=0.25, paint={"layers": [
        {"id": "stars", "op": "spots", "centers": stars, "ramp": "cream", "tone": 5.4, "bevel": True},
        {"id": "boards", "op": "stripes", "axis": "y", "period": 2.0, "width": 0.06, "shift": -1.2, "faces": ["front", "back", "left", "right"]}]})
    s.box("base", [12.6, 0.8, 8.6], trim, (0, 0.4, 0), chamfer=0.2)
    s.box("rimf", [12.4, 0.7, 0.8], trim, (0, 6.55, 3.7))
    s.box("rimb", [12.4, 0.7, 0.8], trim, (0, 6.55, -3.7))
    s.box("lid", [12.4, 0.9, 8.4], body, (0, 10.6, -4.4), rot=(-78, 0, 0), chamfer=0.2)
    rope = s.style("rope", cloth("straw" if False else "oat", 3.8, weave=0.6, photo="hessian_230", scale=3))
    for sx in (-1, 1):
        torus(s, f"handle{sx}", (sx * 6.2, 4.8, 0), 1.1, [0.45, 0.45], rope, n=8, sides=4, rot=(0, 0, 90))
    # plush mouse
    mouse = s.style("mouse", velvet("lilac", 4.2, seed=1))
    s.loft("mouse", [((0, 0, -1.8), [0.6, 0.6]), ((0, 0.2, -1.0), [3.0, 2.8]), ((0, 0.4, 0.4), [3.4, 3.2]), ((0, 0.3, 1.6), [2.0, 2.0]), ((0, 0, 2.4), [0.4, 0.4])],
           mouse, at=(-3.2, 8.0, 0.6), rot=(0, 25, 0), sides=8, round_=2.0)
    for sx in (-1, 1):
        s.add(f"mear{sx}", "prism", [1.6, 1.6, 0.35], mouse, centre=(-3.2 + sx * 1.1 + 0.6, 10.0, 0.6), rot=(0, 25, 0), sides=8,
              paint={"layers": [{"id": "inner", "op": "spots", "centers": [[0, 0, 0.2, 0.5]], "ramp": "rose", "tone": 4.6}]})
    s.add("mnose", "prism", [0.5, 0.5, 0.4], s.style("nose", flat("rose", 3.6)), centre=(-2.15, 8.2, 2.85), rot=(0, 25, 0), sides=6)
    # plush moon
    moon = s.style("moonp", velvet("honey", 4.4, seed=2))
    pts = arc_points(2.2, 30, -210, 9)
    s.loft("moon", [((x, y, 0), [max(0.4, 1.8 * math.sin(k / 8 * math.pi)), max(0.4, 2.0 * math.sin(k / 8 * math.pi))]) for k, (x, y, _) in enumerate(pts)],
           moon, at=(2.6, 9.4, 0.2), rot=(0, -20, -15), sides=8, round_=2.0, paint={"layers": [
               {"id": "eye", "op": "spots", "centers": [[-1.9, 0.4, 0.9, 0.2]], "ramp": "ink", "tone": 1}]})
    # worried worm
    worm = s.style("worm", velvet("rose", 4.2, seed=3))
    rings = []
    for k in range(8):
        x = -4.4 + k * 1.25
        rings.append(((x, 0.5 * math.sin(k * 1.3), 1.0 * math.cos(k * 0.9)), [1.6 if k % 2 else 1.35, 1.6 if k % 2 else 1.35]))
    s.loft("worm", rings, worm, at=(0.6, 7.4, 3.0), sides=8, round_=2.0, subdiv=1, paint={"layers": [
        {"id": "eyes", "op": "spots", "centers": [[4.6, 0.6, 1.0, 0.2], [4.6, 0.6, 0.3, 0.2]], "ramp": "ink", "tone": 1},
        {"id": "brow", "op": "spots", "centers": [[4.5, 1.05, 1.0, 0.14], [4.5, 1.1, 0.3, 0.14]], "ramp": "berry", "tone": 2}]})
    return s


# ------------------------------------------------------------------------------------------------ lights and small things
@item
def mushlamp():
    """Glowcap lamp: two glowing toadstools growing from a mossy stump slice. Cream stems with a skirt ring, domed caps
    in soft ice-blue glow with pale spots, glowing gills underneath (unlit glow parts). Small item."""
    s = Spec("mushlamp", "Glowcap Lamp", density=7, tris=1800, hero=(30, 22))
    stump = s.style("stump", wood("bark", 4.0, grain="y", knots=0, seed=2))
    s.lathe("stump", [(0, 10.4), (0.3, 11.2), (1.8, 10.6), (2.0, 10.0)], stump, sides=12, caps=(False, True), paint={"layers": [
        {"id": "rings", "op": "spots", "centers": [[0, 2.0, 0, r] for r in (4.6, 3.4, 2.2, 1.0)], "shift": -0.7, "faces": ["up"]},
        {"id": "moss", "op": "drip", "ramp": "moss", "tone": 4.2, "depth": 0.5, "length": 1.0, "width": 0.6}]})
    stem = s.style("stem", wax("cream", 5.0))
    capst = glow("glowblue", 3.2)
    capst["layers"] += [{"id": "spots", "op": "spots", "count": 9, "radius": [0.35, 0.6], "ramp": "glowblue", "tone": 6, "seed": 4, "faces": ["up"]}]
    cap = s.style("cap", capst)
    gill = s.style("gill", {**glow("glowblue", 4.4), "layers": [{"id": "gills", "op": "stripes", "axis": "around", "period": 0.05, "width": 0.35, "shift": -1.0}]})
    for k, (x, z, h, cw, lean) in enumerate([(-0.6, -0.4, 9.0, 10.4, -6), (3.4, 2.4, 4.6, 5.2, 14)]):
        s.lathe(f"stem{k}", [(0, cw * 0.3), (h * 0.5, cw * 0.24), (h, cw * 0.2)], stem, base=(x, 2.0, z), sides=8, rot=(0, 0, lean))
        top = 2.0 + h
        cx = x - math.sin(math.radians(lean)) * h
        s.lathe(f"glow_gill{k}", [(0, cw * 0.92), (0.1, cw * 0.4)], gill, base=(cx, top - 0.1, z), sides=12, caps=(False, True), rot=(180, 0, lean))
        s.lathe(f"glow_cap{k}", [(0, cw), (cw * 0.18, cw * 0.92), (cw * 0.34, cw * 0.66), (cw * 0.42, cw * 0.26), (cw * 0.44, 0.0)], cap,
                base=(cx, top - 0.2, z), sides=12, caps=(True, False), rot=(0, 0, lean))
        s.lathe(f"skirt{k}", [(0, cw * 0.26), (0.5, cw * 0.36)], stem, base=(x - math.sin(math.radians(lean)) * h * 0.65, 2.0 + h * 0.62, z), sides=8, rot=(0, 0, lean))
    s.anim("idle", 3.0, [{"part": "glow_cap0", "channel": "scale", "osc": {"amp": [0.015, 0.03, 0.015], "cycles": 1}},
                         {"part": "glow_cap1", "channel": "scale", "osc": {"amp": [0.02, 0.04, 0.02], "cycles": 1, "phase": 0.4}}])
    return s


@item
def mushpot():
    """Mushroom planter: a little oak trough with iron bands, mossy soil, three toadstools (a berry-red cap with
    cream spots, an ochre one and a tiny button) and grass tufts. Small item."""
    s = Spec("mushpot", "Mushroom Planter", density=8, tris=1800, hero=(30, 22))
    box = s.style("box", wood("oak", 4.0, grain="x", knots=1, seed=3))
    band = s.style("band", iron())
    s.box("trough", [8.4, 4.0, 6.2], box, (0, 2.0, 0), chamfer=0.25, paint={"layers": [
        {"id": "boards", "op": "stripes", "axis": "y", "period": 1.35, "width": 0.07, "shift": -1.2, "faces": ["front", "back", "left", "right"]}]})
    for sx in (-1, 1):
        s.box(f"band{sx}", [0.5, 4.1, 6.4], band, (sx * 2.8, 2.05, 0))
    s.box("soil", [7.6, 0.3, 5.4], s.style("soil", soil()), (0, 4.05, 0), paint={"layers": [
        {"id": "moss", "op": "patches", "scale": 1.2, "threshold": 0.5, "ramp": "moss", "tone": 4.2}]})
    stem = s.style("stem", wax("cream", 5.0))
    for k, (x, z, h, cw, rmp, lean) in enumerate([(-1.8, -0.2, 3.6, 4.6, "berry", -8), (1.8, 0.8, 2.6, 3.4, "ochre", 10), (0.4, -1.6, 1.2, 1.8, "terra", 0)]):
        s.lathe(f"stem{k}", [(0, cw * 0.34), (h * 0.6, cw * 0.27), (h, cw * 0.24)], stem, base=(x, 4.1, z), sides=8, rot=(0, 0, lean))
        cx = x - math.sin(math.radians(lean)) * h
        capst = glaze(rmp, 4.0, speck=False, seed=k)
        capst["layers"].append({"id": "spots", "op": "spots", "count": 6 if k == 0 else 3, "radius": [0.25, 0.42], "ramp": "cream", "tone": 5.6,
                                "seed": k + 2, "faces": ["up"], "bevel": True})
        s.lathe(f"cap{k}", [(0, cw), (cw * 0.2, cw * 0.9), (cw * 0.38, cw * 0.62), (cw * 0.48, cw * 0.22), (cw * 0.5, 0.0)],
                s.style(f"cap{k}", capst), base=(cx, 4.1 + h - 0.3, z), sides=10, caps=(True, False), rot=(0, 0, lean))
    gr = s.style("grass", {"ramp": "fern", "tone": 4, "light": 0.8, "rim": {"outline": "none"}, "layers": []})

    def tuft(x, y):
        for c in (0.2, 0.42, 0.6, 0.8):
            lean_ = (c - 0.5) * 0.5 * (1 - y)
            if abs(x - c - lean_ * (1 - y)) < 0.05 + 0.05 * y and y > 0.15 + abs(c - 0.5) * 0.6:
                return "g" if c < 0.5 else "l"
        return "."
    for k, (x, z, a) in enumerate([(-3.2, 2.2, 20), (3.4, -1.8, -30), (2.6, 2.4, 70)]):
        for j, r in enumerate((0, 90)):
            ga, gk = image_art("grass.png", 18, 18, colours=16, crop=((k % 3) / 3, 0, (k % 3 + 1) / 3, 1), flip=j == 1, seed=k)
            s.card(f"tuft{k}_{j}", ga, gr, at=(x, 4.1, z), rot=(0, a + r, 0), off=(0, 0.9, 0), size=[1.8, 1.8],
                   key=gk)
    return s


@item
def teaset():
    """Chamomile tea set: a round walnut pedestal tea table under a lace-edged linen cloth, a cream teapot painted
    with chamomile flowers, two cups on saucers (lake and rose glaze), a honey pot with a dipper, and steam curling
    from the spout (clip 'idle'). 1 x 1 block."""
    s = Spec("teaset", "Chamomile Tea Set", density=6, tris=3200, hero=(30, 26))
    wd = s.style("wd", wood("walnut", 4.2, grain="y", knots=0, seed=2))
    s.lathe("foot", [(0, 7.0), (0.5, 7.2), (1.0, 5.0), (1.4, 2.0)], wd, sides=12, caps=(False, True))
    s.lathe("post", [(0, 2.0), (1.0, 2.6), (2.2, 1.8), (5.0, 1.6), (6.2, 2.4), (7.2, 2.0)], wd, base=(0, 1.2, 0), sides=10, caps=(False, False))
    s.lathe("top", [(0, 13.0), (0.6, 14.0), (1.0, 13.8)], s.style("topst", wood("walnut", 4.4, grain="x", knots=1, seed=5)), base=(0, 8.0, 0), sides=16, caps=(True, True))
    cloth_st = cloth("linen", 4.8, weave=0.45, photo="rough_linen", scale=5)
    cloth_st["layers"] += [
        {"id": "lacehem", "op": "band", "axis": "y", "from": -1.0, "to": -0.55, "ramp": "paper", "tone": 5.4, "faces": ["sides"]},
        {"id": "laceholes", "op": "stripes", "axis": "around", "period": 0.025, "width": 0.4, "shift": -1.6, "faces": ["sides"],
         "range": [-0.95, -0.65]},
        {"id": "embroid", "op": "spots", "count": 10, "radius": [0.25, 0.4], "ramp": "honey", "tone": 4.8, "seed": 5, "faces": ["sides"],
         "where": {"y": [-0.4, 0.4]}}]
    s.lathe("cloth", [(-2.2, 15.0), (-1.4, 14.8), (-0.2, 14.4), (0.15, 13.9), (0.3, 9.0)], s.style("clothst", cloth_st), base=(0, 8.95, 0),
            sides=16, caps=(False, True))
    y0 = 9.3
    # teapot
    pot = glaze("cream", 4.8, speck=True, seed=1)
    pot["layers"] += [{"id": "petals", "op": "spots", "centers": [[math.sin(a) * 2.5 + 0.28 * math.cos(b), 1.6 + math.cos(a) * 0.6 + 0.28 * math.sin(b), math.cos(a) * 2.5, 0.22]
                                                                 for a in (0.4, 1.9, 3.6, 5.0) for b in np.linspace(0, 6.28, 7)[:6]], "ramp": "paper", "tone": 6},
                      {"id": "eyes", "op": "spots", "centers": [[math.sin(a) * 2.6, 1.6 + math.cos(a) * 0.6, math.cos(a) * 2.6, 0.16] for a in (0.4, 1.9, 3.6, 5.0)], "ramp": "honey", "tone": 5}]
    ps = s.style("pot", pot)
    s.lathe("teapot", [(0, 3.0), (0.4, 4.4), (1.6, 5.2), (2.8, 4.6), (3.4, 3.0), (3.6, 2.6)], ps, base=(-2.2, y0, -0.6), sides=12)
    s.lathe("lid", [(0, 2.8), (0.5, 2.2), (0.9, 0.9), (1.3, 0.8), (1.5, 0.3)], ps, base=(-2.2, y0 + 3.55, -0.6), sides=10)
    s.loft("spout", [((0, 0, 0), [1.4, 1.4]), ((1.4, 0.8, 0), [1.0, 1.0]), ((2.4, 2.4, 0), [0.7, 0.7]), ((2.9, 2.8, 0), [0.6, 0.6])], ps,
           at=(0.2, y0 + 1.2, -0.6), sides=6, round_=2.0)
    torus(s, "handle", (-4.6, y0 + 2.0, -0.6), 1.3, [0.5, 0.6], ps, n=10, sides=5, rot=(90, 0, 0))
    # cups and saucers
    for k, (x, z, rmp) in enumerate([(3.4, 2.6, "lake"), (2.6, -3.4, "rose")]):
        c = s.style(f"cup{k}", glaze(rmp, 4.4, seed=k + 2))
        s.lathe(f"saucer{k}", [(0, 2.0), (0.2, 3.6), (0.4, 3.9)], c, base=(x, y0, z), sides=12)
        s.lathe(f"cup{k}", [(0, 1.4), (0.3, 1.9), (1.4, 2.4), (1.7, 2.5)], c, base=(x, y0 + 0.35, z), sides=10, caps=(False, True),
                paint={"layers": [{"id": "tea", "op": "spots", "centers": [[0, 1.75, 0, 1.0]], "ramp": "honey", "tone": 3.4, "faces": ["up"]}]})
        torus(s, f"cuph{k}", (x + 1.45, y0 + 1.25, z), 0.55, [0.3, 0.35], c, n=8, sides=4, rot=(90, 0, 0))
    # honey pot
    hp = s.style("hp", clay("ochre", 4.2))
    s.lathe("honeypot", [(0, 1.4), (0.8, 2.4), (1.8, 2.2), (2.2, 1.6), (2.4, 1.8)], hp, base=(-2.4, y0, 3.6), sides=10,
            paint={"layers": [{"id": "drip", "op": "drip", "ramp": "honey", "tone": 4.6, "depth": 0.3, "length": 1.0, "width": 0.5}]})
    s.add("dipper", "prism", [0.35, 0.35, 3.4], s.style("dip", wood("pale", 4.4, grain="z", knots=0)), at=(-2.2, y0 + 1.6, 3.6), off=(0, 0, 1.7), rot=(-60, 20, 0), sides=5)
    # steam wisps from the spout
    steam = s.style("steam", {"ramp": "mist", "tone": 5, "light": 0.2, "rim": {"outline": "none"}, "layers": []})

    def wisp(x, y):
        cx = 0.5 + 0.25 * math.sin(y * 7.0)
        w_ = 0.12 * (1 - y * 0.6) + 0.04
        return ("s" if abs(x - cx) < w_ * 0.5 else "m") if abs(x - cx) < w_ else "."
    tracks = []
    for k in range(2):
        s.bone(f"steam{k}", at=(-2.2 + 3.1 + k * 0.4, y0 + 4.4 + k * 0.6, -0.6))
        for j, r in enumerate((0, 90)):
            s.card(f"steamc{k}_{j}", grid_art(10, 30, wisp), steam, parent=f"steam{k}", rel=(0, 0, 0), rot=(0, r + k * 40, 0),
                   off=(0, 1.6, 0), size=[1.4, 3.6], key={"s": "mist:6", "m": "mist:4"})
        tracks.append({"part": f"steam{k}", "channel": "position", "keys": [[0, [0, -0.4, 0]], [1.5, [0.2, 0.8, 0]], [3.0, [0, -0.4, 0]]], "ease": "linear"})
        tracks.append({"part": f"steam{k}", "channel": "scale", "osc": {"amp": [0.15, 0.2, 0.15], "cycles": 1, "phase": k * 0.5}})
        tracks.append({"part": f"steam{k}", "osc": {"axis": "y", "amp": 30, "cycles": 1, "phase": k * 0.3}})
    s.anim("idle", 3.0, tracks)
    return s


@item
def record():
    """Gramophone: a walnut cabinet with brass corners and a side crank, a felt turntable with a spinning record
    (clip 'idle'), a brass tonearm and a big morning-glory horn with fluted petals. Small item, ~16 px tall."""
    s = Spec("record", "Gramophone", density=6, tris=2600, hero=(30, 18))
    cab = s.style("cab", wood("walnut", 4.2, grain="x", knots=1, seed=2))
    br = s.style("br", brass())
    s.box("cabinet", [10.0, 4.6, 9.0], cab, (0, 2.6, 0), chamfer=0.3, paint={"layers": [
        {"id": "panel", "op": "panel", "inset": 3, "shift": -0.6, "highlight": 1, "shadow": 1, "faces": ["front", "left", "right"]}]})
    s.box("plinth", [10.6, 0.6, 9.6], cab, (0, 0.3, 0), chamfer=0.2)
    s.box("lidrim", [10.4, 0.5, 9.4], cab, (0, 5.15, 0), chamfer=0.2)
    for k, (x, z) in enumerate([(-4.9, 4.4), (4.9, 4.4), (-4.9, -4.4), (4.9, -4.4)]):
        s.box(f"corner{k}", [0.6, 4.6, 0.6], br, (x, 2.6, z))
    s.add("crankax", "prism", [0.5, 0.5, 1.4], br, centre=(5.6, 3.0, 0), rot=(0, 90, 0), sides=6)
    s.bone("crank", at=(6.3, 3.0, 0))
    s.add("crankarm", "box", [0.4, 2.2, 0.4], br, parent="crank", rel=(0, 0, 0), off=(0, 1.0, 0))
    s.lathe("crankknob", [(0, 0.6), (0.9, 0.7)], s.style("knobw", wood("pale", 4.4, grain="y", knots=0)), base=(6.6, 4.2, 0), sides=6, rot=(0, 0, 90)) if False else \
        s.add("crankknob", "prism", [0.7, 0.7, 1.0], "cab", parent="crank", rel=(0.4, 2.0, 0), rot=(0, 90, 0), sides=6)
    felt = s.style("felt", cloth("pine", 3.6, weave=0.3, photo="velour_velvet", scale=4))
    s.lathe("platter", [(0, 7.6), (0.4, 7.8)], felt, base=(-0.6, 5.4, 0.4), sides=16)
    s.bone("spin", at=(-0.6, 5.8, 0.4))
    vinyl = {"ramp": "ink", "tone": 1.4, "rim": {"light": 1, "dark": 0, "light_shift": 1.0, "outline": "none"},
             "layers": [{"id": "grooves", "op": "spots", "centers": [[0, 0.1, 0, r] for r in (3.4, 3.0, 2.6, 2.2)], "shift": 0.6, "faces": ["up"]},
                        {"id": "label", "op": "spots", "centers": [[0, 0.1, 0, 1.2]], "ramp": "berry", "tone": 4.2, "faces": ["up"]},
                        {"id": "labelstar", "op": "spots", "centers": [[0.3, 0.1, 0.4, 0.25]], "ramp": "honey", "tone": 5.4, "faces": ["up"]},
                        {"id": "shine", "op": "gloss", "dash": True, "length": 4, "shift": 2.0, "density": 0.6, "post": True}],
             "brush": {"off": True}}
    s.lathe("disc", [(0, 7.0), (0.25, 7.0)], s.style("vinyl", vinyl), parent="spin", base=(0, 0, 0), sides=16) if False else None
    s.add("disc", "loft", None, s.style("vinyl", vinyl), parent="spin", rel=(0, 0, 0),
          rings=[{"at": [0, 0, 0], "size": [7.0, 7.0]}, {"at": [0, 0.25, 0], "size": [7.0, 7.0]}],
          profile={"sides": 16, "round": 2.0}, caps=[True, True], up=[0, 0, 1])
    s.lathe("spindle", [(0, 0.3), (0.5, 0.25)], br, parent="spin", base=(0, 0.25, 0), sides=6) if False else None
    # tonearm and the horn
    s.lathe("armbase", [(0, 1.2), (1.2, 1.0), (1.5, 0.7)], br, base=(3.6, 5.4, -3.2), sides=8)
    s.loft("tonearm", [((0, 0, 0), [0.4, 0.4]), ((-1.2, 0.2, 2.0), [0.35, 0.35]), ((-2.2, -0.2, 3.4), [0.35, 0.35])], br, at=(3.6, 6.9, -3.2), sides=5)
    horn = brass(tone=3.6)
    horn["layers"].append({"id": "flutes", "op": "stripes", "axis": "around", "period": 0.1, "width": 0.4, "shift": -1.0})
    hs = s.style("horn", horn)
    path = [(0, 0, 0), (0.0, 1.6, 0.0), (-0.4, 3.4, 0.6), (-1.0, 5.0, 1.8), (-1.6, 6.2, 3.4), (-2.0, 6.9, 5.0)]
    sizes = [0.8, 0.9, 1.3, 2.4, 4.6, 8.4]
    s.loft("horn", [(p, [w, w]) for p, w in zip(path, sizes)], hs, at=(3.6, 7.0, -3.4), sides=10, round_=2.0, caps=(False, False),
           double_sided=True, subdiv=2)
    s.anim("idle", 2.0, [{"part": "spin", "keys": [[0, 0], [1.0, 180], [2.0, 360]], "axis": "y", "ease": "linear"},
                         {"part": "crank", "keys": [[0, 0], [2.0, 360]], "axis": "x", "ease": "linear"}])
    return s
