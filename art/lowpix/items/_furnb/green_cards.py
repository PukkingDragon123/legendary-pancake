"""Leafy plants rebuilt from 2D pixel-art leaf cards (see foliage.py): pots, trunks and stands stay modelled, every
leaf is a hand-pixelled, alpha-cut, double-sided card, and the foliage sways in a looping idle clip."""
from __future__ import annotations

import math
import random

import foliage as F
from kit import P, Item, glass, glaze, grid, metal, moss, painted, plain, rows, soil, wicker, wood
from kit import face_px

ITEMS = {}


def item(fn):
    ITEMS[fn.__name__] = fn
    return fn


@item
def monstera():
    it = Item("monstera", "Swiss-Cheese Monstera", density=4)
    wk = wicker(it, "basket", 0xc8a46a)
    it.loft("basket", [(0, 0, 0, 9.0), (0, 0.5, 0, 10.4), (0, 7.4, 0, 11.6)], wk, sides=12, up=[0, 0, 1], caps=(True, False), double_sided=True)
    it.loft("rim", [(math.sin(a) * 5.8, 0, math.cos(a) * 5.8, (1.6, 1.4)) for a in [k * 2 * math.pi / 14 for k in range(15)]],
            wicker(it, "rim", 0xa8794a, size=(1.0, 0.8)), sides=6, pivot=(0, 7.6, 0), caps=(False, False))
    it.cyl("soil", (0, 6.4, 0), 5.4, 0.6, soil(it, "soil"), sides=12)
    stem = plain(it, "petiole", P["leaf"], tone=3.0, layers=[{"id": "streak", "op": "stripes", "axis": "around", "period": 0.25, "width": 0.2, "shift": 0.6}],
                 brush={"flow": "long", "length": 1.0, "rough": 0.4})
    ramps = [F.leaf_ramp(it, "lf_mon", P["leaf"]), F.leaf_ramp(it, "lf_mon2", 0x4f6d43), F.leaf_ramp(it, "lf_monyoung", P["fern"])]
    # (yaw, stalk top height, pitch from upright, leaf length, juvenile)
    leaves = [(0, 19, 66, 14, False), (68, 24, 56, 13, False), (148, 16, 72, 14, False), (212, 22, 60, 13, False), (288, 18, 68, 13.5, False),
              (34, 27, 40, 11, False), (250, 26, 44, 11, False), (110, 21, 62, 12, False), (178, 25, 48, 10, True), (320, 23, 54, 10, True),
              (90, 29, 24, 8, True), (230, 13, 78, 11, False)]
    ids = []
    for k, (yaw, h, pitch, L, young) in enumerate(leaves):
        r = math.radians(yaw)
        bx, bz = math.sin(r) * 3.2, math.cos(r) * 3.2
        it.loft("petiole", [(math.sin(r) * 0.8, 6.8, math.cos(r) * 0.8, 0.6), (bx * 0.5, h * 0.62, bz * 0.5, 0.5), (bx, h, bz, 0.45)], stem, sides=5)
        n = int(L * it.density)
        cv = F.single(n, n, F.monstera(seed=k, juvenile=young), F.midrib(0.035), 0, tone=4.0, seed=k)
        ids.append(F.add(it, "leaf", cv, [ramps[2] if young else ramps[k % 2]], (bx, h, bz), rotation=(pitch, yaw, 0), offset=[0, L / 2 - 0.4, 0]))
    it.anim("idle", 6.0, F.sway(ids, 2.5))
    return it.spec()


@item
def fiddle_fig():
    it = Item("fiddle_fig", "Fiddle-Leaf Fig", density=4)
    pot = glaze(it, "pot", P["cream"], band=P["slate"], bands=[(0.55, 0.65), (0.75, 0.82)])
    it.loft("pot", [(0, 0, 0, 8.4), (0, 1.0, 0, 10.4), (0, 9.0, 0, 10.8), (0, 9.4, 0, 11.4), (0, 10.0, 0, 11.2)], pot, sides=12, up=[0, 0, 1])
    it.cyl("soil", (0, 9.2, 0), 4.8, 0.6, soil(it, "soil"), sides=12)
    bark = plain(it, "trunk", 0x8a6a4e, tone=3.4, layers=[{"id": "rings", "op": "stripes", "axis": "path", "period": 2.2, "width": 0.12, "shift": -1.0}],
                 brush={"flow": "path", "length": 1.0, "rough": 0.5})
    it.loft("trunk", [(0, 9.4, 0, 1.6), (0.6, 18, 0.4, 1.4), (-0.4, 27, -0.2, 1.2), (0.3, 35.4, 0, 0.8)], bark, sides=6)
    ramps = [F.leaf_ramp(it, "lf_fig", 0x4f6d43), F.leaf_ramp(it, "lf_fig2", P["leaf"]), F.leaf_ramp(it, "lf_fignew", P["fern"])]
    ls = [(13, 20, 78), (14.5, 150, 74), (16, 270, 76), (17.5, 70, 70), (19, 200, 68), (20.5, 320, 66), (22, 110, 62), (23.5, 240, 60), (25, 10, 56),
          (26, 170, 52), (27, 290, 50), (28, 60, 46), (29, 200, 44), (30, 330, 40), (31, 120, 36), (32, 250, 32), (32.8, 20, 26), (33.4, 160, 20)]
    ids = []
    for k, (y, yaw, pitch) in enumerate(ls):
        r = math.radians(yaw)
        x0, z0 = math.sin(r) * 0.5, math.cos(r) * 0.5
        s = 0.8 + 0.2 * (1 - k / len(ls)) if k < len(ls) - 3 else 0.65
        W, H = int(7.6 * s * it.density), int(10 * s * it.density)
        cv = F.single(W, H, F.fiddle(), F.midrib(0.05, 0.4), 0, tone=4.0, seed=k)
        rp = ramps[2] if k >= len(ls) - 3 else ramps[k % 2]
        ids.append(F.add(it, "leaf", cv, [rp], (x0, y, z0), rotation=(pitch, yaw, 0), offset=[0, H / it.density / 2 - 0.2, 0]))
    it.anim("idle", 6.0, F.sway(ids, 2.0))
    return it.spec()


@item
def hanging_ivy():
    it = Item("hanging_ivy", "Trailing Ivy Pot", density=4, hero=(-30, 10))
    iron = metal(it, "iron")
    it.box("plate", (0, 21.0, 0.3), (2.6, 3.4, 0.6), iron, ch=0.3)
    it.loft("bracket", [(0, 0, 0, 0.7), (0, 0.2, 1.6, 0.7), (0, -0.3, 2.8, 0.6), (0, -1.0, 3.0, 0.5)], iron, sides=4, pivot=(0, 20.4, 0.4))
    cord = plain(it, "cord", P["oat"], tone=3.6, layers=[{"id": "twist", "op": "stripes", "axis": [1, 1, 0.3], "period": 0.7, "width": 0.4, "shift": -1.0}])
    for a in (0, 120, 240):
        r = math.radians(a)
        it.loft("cord", [(0, 19.2, 3.0, 0.5), (math.sin(r) * 1.4, 14, 3 + math.cos(r) * 1.4, 0.5), (math.sin(r) * 2.4, 10.6, 3 + math.cos(r) * 2.4, 0.5),
                         (math.sin(r) * 3.4, 5.4, 3 + math.cos(r) * 3.4, 0.5)], cord, sides=4)
    it.loft("knot", [(0, 0, 0, 1.0), (0, 0.8, 0, 1.6), (0, 1.6, 0, 0.8)], cord, sides=6, pivot=(0, 13.0, 3.0), up=[0, 0, 1])
    it.loft("tassel", [(0, 0, 0, 0.8), (0, -2.0, 0, 1.4), (0, -2.6, 0, 1.0)], cord, sides=6, pivot=(0, 0.0, 3.0), up=[0, 0, 1])
    pg = glaze(it, "pot", P["cream"], drip=P["pine"])
    it.loft("pot", [(0, 0, 0, 4.6), (0, 1.0, 0, 6.2), (0, 4.6, 0, 7.4), (0, 6.0, 0, 7.2)], pg, sides=12, pivot=(0, 0.6, 3.0), up=[0, 0, 1])
    it.cyl("soil", (0, 6.1, 3.0), 3.3, 0.4, soil(it, "soil"), sides=12)
    ramps = [F.leaf_ramp(it, "lf_ivy", P["leaf"]), F.leaf_ramp(it, "lf_ivy2", P["fern"]), F.leaf_ramp(it, "lf_ivy3", P["pine"])]
    ivy = F.palmate(3, 0.38, 0.8)
    ids = []
    # a crown of ivy sprays spilling over the rim, and a few standing up in the middle
    for k in range(10):
        a = k / 10 * 2 * math.pi
        back = math.cos(a) < -0.2  # toward the wall: stand up instead of spilling into it
        cv = F.cluster(30, 30, ivy, 5, 13, 12, F.midrib(0.06), 0, seed=40 + k, ramps=[0, 1, 2])
        ids.append(F.add(it, "crown", cv, ramps, (math.sin(a) * 2.6, 6.0, 3.0 + math.cos(a) * 2.6), rotation=((8, (k % 3 - 1) * 12, 0) if back else (52 + (k % 3) * 8, math.degrees(a), 0))))
    for k in range(3):
        cv = F.cluster(36, 36, ivy, 5, 15, 14, F.midrib(0.06), 0, seed=60 + k, ramps=[0, 1])
        ids.append(F.add(it, "crown", cv, ramps, (0, 6.0, 3.0), rotation=(12, k * 60, 0)))
    strands = [(-3.0, 3.8, 16), (2.6, 5.6, 22), (3.4, 3.0, 12), (-1.4, 6.2, 19), (-3.6, 2.8, 9), (1.0, 6.4, 14)]
    vine = plain(it, "vine", P["fern"], tone=3.0)
    leaf = F.single(14, 14, ivy, F.midrib(0.07), 0, tone=4.0, seed=3)
    leaf2 = F.single(14, 14, ivy, F.midrib(0.07), 0, tone=4.0, seed=4)
    tracks = []
    for i, (x, z, ln) in enumerate(strands):
        b = it.bone("strand", (x, 6.4, z))
        pts = [(math.sin(k * 0.9 + i) * 0.9 + (k * 0.25 if x > 0 else -k * 0.25), -(k / 7) * ln, math.cos(k * 0.7) * 0.5, 0.45) for k in range(8)]
        it.loft("vine", pts, vine, sides=4, parent=b)
        for k, (px, py, pz, _) in enumerate(pts[1:], 1):
            for s in (-1, 1):
                F.add(it, "ivy", leaf if (k + i + (s > 0)) % 2 else leaf2, [ramps[(k + i) % 3]], (px + s * 0.4, py, pz + 0.3), rotation=(30, s * 40 + i * 20, s * 120), parent=b)
        tracks.append({"part": b, "osc": {"axis": "z", "amp": 2.5, "cycles": 1, "phase": i * 0.21}})
        tracks.append({"part": b, "osc": {"axis": "x", "amp": 1.5, "cycles": 1, "phase": i * 0.13 + 0.25}})
    it.anim("idle", 5.0, tracks + F.sway(ids, 1.5))
    return it.spec()


@item
def maple_bonsai():
    it = Item("maple_bonsai", "Ember Maple Bonsai", density=4)
    stand = wood(it, "deep", "x", knots=0)
    it.box("stand", (0, 0.6, 0), (16, 1.0, 10), stand, ch=0.3)
    for x in (-6.4, 6.4):
        it.box("standfoot", (x, 0.15, 0), (2.2, 0.4, 9), stand)
    pot = glaze(it, "pot", P["slate"], band=P["ochre"], bands=[(0.55, 0.75)])
    it.box("pot", (0, 2.6, 0), (14, 3, 8.4), pot, ch=0.5)
    it.box("soil", (0, 4.1, 0), (12.6, 0.4, 7.0), soil(it, "soil", moss=P["moss"]))
    it.loft("rock", [(0, 0, 0, (3.8, 2.8)), (0.2, 1.4, 0, (3.0, 2.2)), (0.4, 2.4, 0, (1.4, 1.2))], plain(it, "rock", P["stone"], tone=3.4,
            layers=[{"id": "photo", "op": "photo", "src": "assets/photos/rock_face_03", "scale": 4.0, "amount": 0.8, "ramps": ["pa_rock"]}]), sides=6, pivot=(4.6, 4.2, 1.4), up=[0, 0, 1])
    bark = it.ramp("bk_bark", 0x6b5444, n=7)
    bk = it.style("bark", {"ramp": bark, "tone": 3.2, "rim": {"light_shift": 0.8, "dark_shift": -1.0}, "brush": {"flow": "path", "length": 1.2, "rough": 0.6},
                           "layers": [{"id": "photo", "op": "photo", "src": "assets/photos/bark_brown_02", "scale": 3.0, "amount": 0.9, "ramps": ["bk_bark"]},
                                      {"id": "lit", "op": "stripes", "axis": "around", "period": 0.33, "width": 0.25, "shift": 0.6}]})
    it.loft("trunk", [(0, 0, 0, 3.0), (-0.8, 2.0, 0, 2.4), (-1.6, 4.4, 0.2, 2.0), (-0.6, 6.6, 0, 1.8), (0.8, 8.4, -0.2, 1.5), (0.4, 10.6, 0, 1.2)], bk, sides=7, pivot=(-1.4, 4.2, 0), up=[0, 0, 1])
    it.loft("branch", [(0, 0, 0, 1.2), (-2.4, 1.2, 0.4, 1.0), (-4.6, 1.6, 0.6, 0.7)], bk, sides=6, pivot=(-2.6, 9.6, 0.2))
    it.loft("branch", [(0, 0, 0, 1.1), (2.6, 0.8, 0.2, 0.9), (5.0, 1.2, 0.6, 0.6)], bk, sides=6, pivot=(-0.8, 11.2, 0))
    it.loft("branch", [(0, 0, 0, 0.9), (-0.8, 2.0, -0.4, 0.7), (-1.0, 3.6, -0.6, 0.5)], bk, sides=6, pivot=(-1.0, 14.0, 0))
    ramps = [F.leaf_ramp(it, "lf_ember", P["clay"]), F.leaf_ramp(it, "lf_gold", P["ochre"]), F.leaf_ramp(it, "lf_rust", P["russet"])]
    maple = F.palmate(5, 0.42, 1.4)
    rr = random.Random(11)
    ids = []
    # each pad is a cloud of crossed cards: upright sprays round its rim and flat ones over its top
    for p, (x, y, z, w) in enumerate(((-6.6, 11.6, 0.6, 7.0), (5.0, 12.8, 0.8, 6.4), (-2.0, 17.4, -0.4, 8.0), (2.4, 15.6, 1.4, 5.0), (-8.2, 10.0, 2.0, 3.6))):
        nn = 5 if w > 4 else 3
        for k in range(nn):
            cv = F.cluster(26, 26, maple, 5, 11, 11, F.radial_veins(5), 0, seed=p * 20 + k, ramps=[0, 1, 2] if p % 2 else [0, 2, 1], fan=1.2)
            a = k / nn * 180 + rr.uniform(-15, 15)
            ids.append(F.add(it, "pad", cv, ramps, (x * 0.92 + rr.uniform(-0.25, 0.25) * w, y - 0.6, z + rr.uniform(-0.2, 0.2) * w), rotation=(rr.uniform(-12, 12), a, 0)))
        for k in range(nn - 1):
            cv = F.cluster(26, 26, maple, 6, 11, 11, F.radial_veins(5), 0, seed=p * 20 + 10 + k, ramps=[1, 0, 2], fan=1.6)
            ids.append(F.add(it, "padtop", cv, ramps, (x + rr.uniform(-0.3, 0.3) * w, y + 0.4, z + rr.uniform(-0.2, 0.2) * w),
                             rotation=(-75 + rr.uniform(-10, 10), rr.uniform(0, 360), 0), anchor="centre"))
    one = F.single(14, 14, maple, F.radial_veins(5), 0, tone=4.0, seed=2)
    for (x, z, a) in ((3.0, -2.6, 20), (-4.6, 2.8, 70), (6.2, 3.6, -30)):
        F.add(it, "fallen", one, [ramps[a % 2]], (x, 4.45 if abs(x) < 6 else 1.15, z), rotation=(-90, a, 0), anchor="centre")
    it.anim("idle", 6.0, F.sway(ids, 1.6))
    return it.spec()


@item
def window_flower_box():
    it = Item("window_flower_box", "Geranium Window Box", density=4)
    pb = painted(it, "white", P["cream"], under="light", grain="x", chips=0.16)
    W, H = face_px(22, 6, it.density)
    hearts = grid(W, H)
    for cxp in range(14, W, 28):
        for (dx, dy) in ((-2, -1), (-1, -2), (1, -2), (2, -1), (-2, 0), (2, 0), (-1, 1), (1, 1), (0, 2), (-1, -1), (1, -1), (0, 0), (-1, 0), (1, 0), (0, 1), (0, -1)):
            y = H // 2 + dy
            if 0 <= cxp + dx < W:
                hearts[y][cxp + dx] = "r"
    it.ramp("pa_heart", P["rose"], n=5)
    it.box("box", (0, 3.0, 0), (22, 6, 7), pb, ch=0.3, paint={"stamps": [{"face": "front", "at": [0, 0], "art": rows(hearts), "key": {"r": "pa_heart:2"}}]})
    it.box("rim", (0, 6.4, 0), (23, 0.8, 7.6), wood(it, "light", "x", knots=0), ch=0.3)
    it.box("soil", (0, 6.6, 0), (20.4, 0.6, 5.6), soil(it))
    iron = metal(it, "iron")
    for x in (-9.4, 9.4):
        it.box("bracket", (x, -0.3, 0), (1.6, 0.6, 7.2), iron, ch=0.2)
    lramps = [F.leaf_ramp(it, "lf_ger", P["fern"]), F.leaf_ramp(it, "lf_ger2", P["leaf"]), F.leaf_ramp(it, "lf_ger3", P["moss"])]
    gleaf = F.round_scalloped(11)
    zone = lambda x, a: abs(math.hypot(x, (a - 0.5) * 2) - 0.55) < 0.1  # the darker horseshoe zone of a geranium leaf
    rr = random.Random(4)
    ids = []
    for k in range(13):
        x = -9.6 + k * 1.6
        cv = F.cluster(32, 30, gleaf, 4, 15, 15, zone, 0, seed=k, ramps=[0, 1, 2], fan=1.3)
        ids.append(F.add(it, "leaves", cv, lramps, (x, 6.8, rr.uniform(-2.0, 2.0)), rotation=(rr.uniform(-25, 25), rr.uniform(-50, 50), 0)))
    fr = [F.leaf_ramp(it, "fl_ger", P["berry"]), F.leaf_ramp(it, "fl_gerc", P["blush"])]
    stalk = plain(it, "stalk", P["fern"], tone=3.0)
    for i, x in enumerate((-7, 0.4, 7.4)):
        it.cyl("stalk", (x, 8.0, -0.6), 0.25, 3.0, stalk, sides=4)
        for k, rot in enumerate(((0, 0, 0), (0, 60, 0), (0, 120, 0), (-90, 0, 0))):
            cv = F.florets(30, 30, 0, 1, n=7, seed=i * 9 + k, size=5)
            ids.append(F.add(it, "floret", cv, fr, (x, 12.6, -0.6), rotation=rot, anchor="centre"))
    dsy = plain(it, "daisy", P["snow"], tone=3.6)
    it.ramp("pa_dcen", P["honey"], n=5)
    from green import daisy_art
    for (x, z) in ((-3.6, 1.6), (4.0, 1.8), (-10.0, 1.0)):
        it.cyl("dstalk", (x, 6.8, z), 0.15, 2.8, stalk, sides=4)
        it.card("daisy", (x, 9.7, z), dsy, art=daisy_art(10), size=(2.6, 2.6), plane="xz", rotation=[-20, 0, 0], key={"c": "pa_dcen:3", "C": "pa_dcen:2", "P": "pa_daisy:4", "p": "pa_daisy:5"})
    # lobelia tumbling over the front edge: strands of tiny periwinkle flowers and leaves
    lob = [F.leaf_ramp(it, "lf_lob", P["leaf"]), F.leaf_ramp(it, "fl_lob", P["lilac"]), F.leaf_ramp(it, "fl_lob2", P["sky"])]
    for i in range(8):
        Wc, Hc = 12, 22 + (i % 3) * 4
        cv = F.Canvas(Wc, Hc)
        rs = random.Random(i)
        x = Wc / 2
        for y in range(Hc):
            x += rs.choice((-0.5, 0, 0.5))
            xi = max(1, min(Wc - 2, int(x)))
            cv.dot(xi, y, 0, 3)
            if rs.random() < 0.45:
                cv.leaf(xi, y, 3.5, 2.4, rs.choice((-1.2, 1.2)) + math.pi, F.ovate(), 0, 4.0, None, seed=i * 50 + y)
            if rs.random() < 0.4:
                fx = max(1, min(Wc - 2, xi + rs.choice((-2, 2))))
                for p in range(5):
                    cv.leaf(fx, y, 2.2, 2.0, p / 5 * 2 * math.pi, F.ovate(0.6), rs.choice((1, 2)), 5.0, None, seed=i * 70 + y * 5 + p, fold=False, rim=False)
                cv.dot(fx, y, 1, 8)
        ids.append(F.add(it, "lobelia", cv, lob, (-9.4 + i * 2.7, 6.9, 3.9), rotation=(-12 + (i % 2) * 8, (i % 3 - 1) * 14, 0), offset=[0, -Hc / it.density / 2, 0]))
    it.anim("idle", 5.0, F.sway(ids, 1.4))
    return it.spec()


@item
def moss_terrarium():
    it = Item("moss_terrarium", "Moss Terrarium", density=5)
    it.cyl("base", (0, 0, 0), 6.0, 1.6, wood(it, "walnut", "x", knots=0), sides=14)
    br = metal(it, "brass")
    it.cyl("ring", (0, 1.6, 0), 5.4, 0.6, br, sides=14)
    it.cyl("earth", (0, 2.2, 0), 5.0, 1.4, soil(it, "earth", base=0x6a5040, moss=P["moss"]), sides=14)
    peb = plain(it, "pebble", P["pebble"], tone=3.6)
    for (x, z) in ((2.0, 2.4), (0.8, 3.4), (3.0, 1.0)):
        it.loft("pebble", [(0, 0, 0, (1.2, 0.9)), (0, 0.3, 0, (1.0, 0.7))], peb, sides=6, pivot=(x, 3.6, z), up=[0, 0, 1])
    stem = plain(it, "stem", 0xeadfc6, tone=3.6)
    for (x, z, h, r, c) in ((-2.4, 1.6, 1.6, 1.0, P["clay"]), (-1.0, 2.6, 1.0, 0.6, P["ochre"])):
        it.cyl("mstem", (x, 3.6, z), 0.3, h, stem, sides=5)
        it.loft("mcap", [(0, 0, 0, r * 2), (0, r * 0.5, 0, r * 1.8), (0, r * 0.9, 0, r * 0.6)], plain(it, f"mcap{c:x}", c, tone=3.4,
                layers=[{"id": "dots", "op": "spots", "count": 3, "radius": [0.15, 0.2], "shift": 2.0}]), sides=8, pivot=(x, 3.6 + h, z), up=[0, 0, 1])
    ramps = [F.leaf_ramp(it, "lf_moss", P["moss"]), F.leaf_ramp(it, "lf_moss2", P["fern"]), F.leaf_ramp(it, "lf_moss3", P["sage"])]
    rr = random.Random(5)
    ids = []
    # cushions of moss: tufts of tiny pointed leaves, crossed in pairs, densest at the back
    for k in range(18):
        a, d = rr.uniform(0, 2 * math.pi), rr.uniform(0, 4.0)
        x, z = math.cos(a) * d - 0.4, math.sin(a) * d * 0.9 - 0.4
        cv = F.cluster(18, 14, F.lanceolate(), 8, 6, 3, None, 0, seed=k, ramps=[0, 1, 2], fan=1.4)
        for rot in (rr.uniform(0, 180),):
            ids.append(F.add(it, "moss", cv, ramps, (x, 3.6, z), rotation=(rr.uniform(-15, 15), rot, 0)))
            F.add(it, "moss", cv, ramps, (x, 3.6, z), rotation=(rr.uniform(-15, 15), rot + 90, 0))
    for k in range(4):
        a = k / 4 * 2 * math.pi + 0.5
        cv = F.cluster(16, 14, F.heartlet(), 3, 6, 6, F.midrib(0.08), 0, seed=30 + k, ramps=[1, 2], fan=1.3)
        F.add(it, "clover", cv, ramps, (math.cos(a) * 2.6, 3.6, math.sin(a) * 2.6), rotation=(-20, math.degrees(a), 0))
    for k in range(5):
        cv = F.frond(16, 34, 1, seed=k, pinnae=10)
        ids.append(F.add(it, "frond", cv, ramps, (1.8, 3.8, -1.6), rotation=(-35 + (k % 2) * 10, k * 72, 0)))
    gl = glass(it, "dome", 0xdcebe6)
    it.loft("glass_dome", [(0, 0, 0, 10.8), (0, 5.6, 0, 10.8), (0, 7.4, 0, 9.4), (0, 8.4, 0, 7.0), (0, 8.9, 0, 3.6)], gl, sides=12, pivot=(0, 2.2, 0), caps=(False, True), up=[0, 0, 1])
    for (x, z, h) in ((-3.8, 3.4, 5.0), (-4.6, 1.8, 3.4)):
        it.card("glint", (x * 1.08, 2.8 + h / 2, z * 1.08), gl, size=(0.45, h), rotation=[0, -45, 0], paint={"light": 0, "tone": 5.0})
    it.cyl("knob", (0, 11.0, 0), 1.0, 0.9, br, sides=8)
    it.cyl("knobtop", (0, 11.9, 0), 0.6, 0.6, metal(it, "gold", tarnish=False), sides=8)
    it.anim("idle", 6.0, F.sway(ids, 1.0))
    return it.spec()
