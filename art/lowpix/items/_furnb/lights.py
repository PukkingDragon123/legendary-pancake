"""Lamps, lanterns and candles (src/assets/decor/lights.ts ids). Parts named glow_* are made emissive by make.py;
flames flicker, bulbs twinkle and fireflies drift in looping 'idle' clips."""
from __future__ import annotations

import math

from kit import P, Item, fabric, glass, glaze, glow, grid, ink, leafy, metal, moss, plain, rows, soft, wax, wood

ITEMS = {}


def item(fn):
    ITEMS[fn.__name__] = fn
    return fn


FLAME = ["..o...", "..oo..", ".oco..", ".occo.", "occwco", "ocwwco", "ocwwco", ".cwwc.", "..oo.."]


def flame(it, pid, at, s=1.0):
    """A candle flame: two crossed glowing cards that flicker. Returns the two part ids."""
    from kit import flame_ramp
    fr = flame_ramp(it)
    st = it.style("flame", {"ramp": fr, "tone": 3.0, "light": 0.0, "rim": {"light": 0, "dark": 0}, "brush": {"off": True}, "dither": 0.0})
    key = {"o": "fm_flame:2", "c": "fm_flame:4", "w": "fm_flame:6"}
    w, h = 6 / it.density * s * 1.5, 9 / it.density * s * 1.5
    a = it.card("glow_" + pid, (at[0], at[1], at[2]), st, art=FLAME, size=(w, h), key=key, offset=[0, h / 2, 0])
    b = it.card("glow_" + pid, (at[0], at[1], at[2]), st, art=FLAME, size=(w, h), key=key, offset=[0, h / 2, 0], rotation=[0, 90, 0])
    return [a, b]


def flicker_tracks(ids, seed=0):
    out = []
    for k, pid in enumerate(ids):
        out.append({"part": pid, "channel": "scale", "osc": {"amp": [0.1, 0.22, 0.1], "cycles": 3 + (k + seed) % 2, "phase": ((k * 0.37 + seed * 0.21) % 1)}})
        out.append({"part": pid, "osc": {"axis": "z", "amp": 5, "cycles": 2, "phase": ((k * 0.53) % 1)}})
    return out


def see_through(W=40, H=40, glints=((0.18, 0.08), (0.3, 0.04))):
    """Stamp art for a glass face: transparent, with a frame edge and a couple of diagonal glints."""
    g = grid(W, H, "_")
    for y in range(H):
        for x in range(W):
            u = (x + 0.5) / W - (1 - (y + 0.5) / H) * 0.35
            for (c, w) in glints:
                if abs(u - c) < w / 2:
                    g[y][x] = "w"
            if x == 0 or x == W - 1 or y == 0 or y == H - 1:
                g[y][x] = "e"
    return rows(g)


# ------------------------------------------------------------------ floor lamp
@item
def fringe_floor_lamp():
    it = Item("fringe_floor_lamp", "Fringed Floor Lamp", density=3.5)
    br = metal(it, "brass")
    gold = metal(it, "gold", tarnish=False)
    for k in range(3):
        a = k * 120
        it.loft("foot", [(0, 1.4, 0, (1.4, 1.2)), (0, 0.6, 3.6, (1.2, 1.0)), (0, 0.4, 6.4, (1.0, 0.8))], br, sides=6, rot=(0, a, 0))
        r = math.radians(a)
        it.loft("toe", [(0, 0, 0, 1.6), (0, 0.7, 0, 1.4)], gold, sides=6, pivot=(math.sin(r) * 6.6, 0, math.cos(r) * 6.6), up=[0, 0, 1])
    it.loft("base", [(0, 0, 0, 4.4), (0, 1.0, 0, 4.0), (0, 2.0, 0, 2.2), (0, 2.6, 0, 1.4)], br, sides=10, up=[0, 0, 1])
    it.cyl("pole", (0, 2.4, 0), 0.5, 28.0, br, sides=6)
    for y in (9, 19, 27):
        it.loft("knop", [(0, 0, 0, 1.0), (0, 0.6, 0, 2.2), (0, 1.2, 0, 1.0)], gold, sides=8, pivot=(0, y, 0), up=[0, 0, 1])
    # the shade: eight apricot silk panels with seams and gold rims, lit from within
    silk = glow(it, "silk", P["honey"], tone=3.2)
    silkst = it.style("silk", dict(it.styles[silk], light=0.35, layers=[
        {"id": "seams", "op": "stripes", "axis": "around", "period": 0.125, "width": 0.07, "shift": -1.4},
        {"id": "pleats", "op": "stripes", "axis": "around", "period": 0.03125, "width": 0.4, "shift": -0.5},
        {"id": "heat", "op": "band", "axis": "path", "from": 0.0, "to": 0.5, "shift": 0.6},
        {"id": "rimlo", "op": "band", "axis": "path", "from": 0.0, "to": 0.08, "ramp": "br_gold", "tone": 5},
        {"id": "rimhi", "op": "band", "axis": "path", "from": 0.93, "to": 1.0, "ramp": "br_gold", "tone": 5}]))
    it.loft("glow_shade", [(0, 0, 0, 14.0), (0, 3.6, 0, 12.2), (0, 7.4, 0, 10.2)], silkst, sides=8, pivot=(0, 29.8, 0), caps=(False, False), double_sided=True, up=[0, 0, 1])
    it.cyl("finial", (0, 37.2, 0), 0.7, 0.5, gold, sides=6)
    # the tassel fringe: a band of hanging threads with little knots at the ends
    fr = it.ramp("cl_fringe", P["terracotta"], n=6)
    W = int(round(2 * 7.1 * math.sin(math.pi / 8) * it.density)) + 2
    H = int(round(2.8 * it.density))
    g = grid(W, H)
    for x in range(W):
        if x % 2 == 1:
            for y in range(H):
                g[y][x] = "_"
        else:
            L = H - (1 if (x // 2) % 3 == 0 else 0)
            for y in range(L, H):
                g[y][x] = "_"
            if L - 1 >= 0:
                g[L - 1][x] = "k"
    fst = it.style("fringe", {"ramp": fr, "tone": 3.0, "rim": {"light": 0, "dark": 0}, "brush": {"off": True}, "dither": 0.0, "light": 0.5,
                              "layers": [{"id": "shade", "op": "gradient", "axis": "y", "amount": 1.0}]})
    it.loft("fringe", [(0, 0, 0, 14.6), (0, 2.8, 0, 14.4)], fst, sides=8, pivot=(0, 27.2, 0), caps=(False, False), double_sided=True, up=[0, 0, 1],
            paint={"stamps": [{"faces": ["sides"], "at": [0, 0], "art": rows(g), "key": {"k": "cl_fringe:5"}}]})
    it.loft("glow_bulb", [(0, 0, 0, 1.4), (0, 1.2, 0, 2.6), (0, 2.6, 0, 1.6)], glow(it, "bulb", P["lamp"], tone=4.4), sides=8, pivot=(0, 30.6, 0), up=[0, 0, 1])
    it.cyl("socket", (0, 29.4, 0), 0.8, 1.4, br, sides=6)
    chain = it.bone("chain", (2.0, 31.0, 1.2))
    it.box("pull", (0, -2.6, 0), (0.25, 5.2, 0.25), gold, parent=chain)
    it.loft("bead", [(0, 0, 0, 0.5), (0, 0.5, 0, 1.0), (0, 1.0, 0, 0.5)], gold, sides=6, pivot=(0, -6.2, 0), parent=chain, up=[0, 0, 1])
    it.anim("idle", 4.0, [{"part": chain, "osc": {"axis": "z", "amp": 5, "cycles": 1}}, {"part": chain, "osc": {"axis": "x", "amp": 3, "cycles": 2, "phase": 0.25}},
                          {"part": "glow_bulb", "channel": "scale", "osc": {"amp": [0.03, 0.03, 0.03], "cycles": 2}}])
    return it.spec()


# ------------------------------------------------------------------ fairy lights (wall)
def sag(a, b, drop, n):
    return [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - drop * math.sin(math.pi * t), a[2] + (b[2] - a[2]) * t) for t in [i / n for i in range(n + 1)]]


@item
def fairy_lights():
    it = Item("fairy_lights", "Fairy-Light String", density=4, hero=(-20, 12))
    wire = plain(it, "wire", P["forest"], tone=3.0, layers=[{"id": "twist", "op": "stripes", "axis": "x", "period": 0.6, "width": 0.4, "shift": -0.8}])
    brass = metal(it, "brass")
    pts = sag((-22, 0, 1), (0, -2, 1), 3.6, 10)[:-1] + sag((0, -2, 1), (22, 0, 1), 3.6, 10)
    it.loft("wire", [(x, y, z, 0.45) for (x, y, z) in pts], wire, sides=4, caps=(True, True))
    for x, y in ((-22, 0), (0, -2), (22, 0)):
        it.box("plate", (x, y + 0.2, 0.3), (2.0, 2.0, 0.6), brass, ch=0.3)
        it.loft("hook", [(0, 0, 0, 0.5), (0, 0, 0.9, 0.5), (0, -0.8, 1.2, 0.5)], brass, sides=4, pivot=(x, y + 0.4, 0.4))
    # fourteen bulbs on little caps, in calm lamp colours
    cols = [P["lamp"], P["blush"], P["sky"], P["sageLight"], P["honey"], P["lavender"]]
    bpts = sag((-22, 0, 1), (0, -2, 1), 3.6, 8)[1:-1] + sag((0, -2, 1), (22, 0, 1), 3.6, 8)[1:-1]
    cap = metal(it, "cap", base=P["fern"], tarnish=False)
    tracks = []
    for k, (x, y, z) in enumerate(bpts):
        c = cols[(k * 2) % len(cols)]
        st = glow(it, f"b{k % len(cols)}", c, tone=4.0)
        b = it.bone("bulb", (x, y - 0.3, z), rot=(0, 0, (k % 3 - 1) * 12))
        it.box("cap", (0, -0.4, 0), (0.9, 0.8, 0.9), cap, parent=b)
        g = it.loft("glow_bulb", [(0, 0, 0, 0.9), (0, -0.9, 0, 1.6), (0, -1.9, 0, 1.4), (0, -2.6, 0, 0.5)], st, sides=6, pivot=(0, -0.8, 0), parent=b, up=[0, 0, 1])
        tracks.append({"part": g, "channel": "scale", "osc": {"amp": [0.28, 0.28, 0.28], "cycles": 1 + k % 3, "phase": (k * 0.29) % 1, "shape": "pulse" if k % 4 == 0 else "sine"}})
        tracks.append({"part": b, "osc": {"axis": "z", "amp": 3, "cycles": 1, "phase": (k * 0.13) % 1}})
    it.anim("idle", 6.0, tracks)
    return it.spec()


# ------------------------------------------------------------------ lantern
@item
def iron_lantern():
    it = Item("iron_lantern", "Wrought-Iron Lantern", density=5)
    iron = metal(it, "iron")
    it.box("base", (0, 0.5, 0), (7, 1, 7), iron, ch=0.3)
    it.box("base2", (0, 1.3, 0), (6, 0.6, 6), iron, ch=0.2)
    for x in (-2.8, 2.8):
        for z in (-2.8, 2.8):
            it.box("post", (x, 5.6, z), (0.9, 9, 0.9), iron, ch=0.2)
    gl = glass(it, "pane", 0xe8dcb8)
    for (x, z, w, d) in ((0, 2.8, 4.8, 0.25), (0, -2.8, 4.8, 0.25), (2.8, 0, 0.25, 4.8), (-2.8, 0, 0.25, 4.8)):
        it.box("glass_pane", (x, 5.8, z), (w, 8, d), gl)
    for (x, z, rot) in ((-1.2, 2.95, 0), (2.95, 1.0, 90)):
        it.card("glint", (x, 6.6, z), gl, size=(0.35, 3.6), rotation=[0, rot, 14], paint={"light": 0, "tone": 5.0})
    for (x, z, w, d) in ((0, 3.0, 5, 0.4), (0, -3.0, 5, 0.4), (3.0, 0, 0.4, 5), (-3.0, 0, 0.4, 5)):
        it.box("bar", (x, 5.8, z), (w, 0.5, d), iron)
    it.box("rim", (0, 10.4, 0), (7.4, 0.8, 7.4), iron, ch=0.3)
    it.taper("roof", (0, 12.0, 0), (6.8, 6.8, 2.6), iron, rot=(-90, 0, 0), front=[0.25, 0.25])
    it.cyl("chimney", (0, 13.2, 0), 0.8, 0.8, iron, sides=6)
    it.loft("ring", [(math.sin(a) * 1.4, 1.4 + math.cos(a) * 1.4, 0, 0.45) for a in [k * 2 * math.pi / 10 for k in range(11)]], iron, sides=4, pivot=(0, 13.0, 0), caps=(False, False))
    it.cyl("candle", (0, 1.6, 0), 1.1, 3.4, wax(it), sides=8)
    it.cyl("dish", (0, 1.6, 0), 1.5, 0.5, metal(it, "brass"), sides=8)
    it.box("wick", (0, 5.25, 0), (0.15, 0.4, 0.15), ink(it))
    f = flame(it, "flame", (0, 5.3, 0), s=1.2)
    it.anim("idle", 2.0, flicker_tracks(f))
    return it.spec()


@item
def candelabra():
    it = Item("candelabra", "Brass Candelabra", density=4)
    br = metal(it, "brass")
    it.loft("base", [(0, 0, 0, 7.2), (0, 0.6, 0, 7.0), (0, 1.2, 0, 5.0), (0, 1.8, 0, 2.6)], br, sides=12, up=[0, 0, 1])
    it.loft("stem", [(0, 0, 0, 1.4), (0, 1.2, 0, 2.8), (0, 2.0, 0, 1.2), (0, 4.6, 0, 1.0), (0, 5.4, 0, 2.4), (0, 6.2, 0, 1.2), (0, 7.4, 0, 1.4)], br, sides=8, pivot=(0, 1.8, 0), up=[0, 0, 1])
    cups = []
    for k in range(4):
        a = k * 90 + 45
        r = math.radians(a)
        R = 5.6 if k % 2 == 0 else 4.4
        it.loft("arm", [(0, 0, 0, 0.8), (0, -0.5, R * 0.5, 0.8), (0, 0.6, R * 0.9, 0.8), (0, 2.0, R, 0.8)], br, sides=6, pivot=(0, 9.2, 0), rot=(0, a, 0))
        cups.append((math.sin(r) * R, 11.2, math.cos(r) * R, 4.6 if k % 2 == 0 else 4.0))
    cups.append((0, 9.2, 0, 6.6))
    fl = []
    for k, (x, y, z, h) in enumerate(cups):
        it.loft("cup", [(0, 0, 0, 1.2), (0, 0.6, 0, 2.6), (0, 0.9, 0, 2.8)], br, sides=8, pivot=(x, y, z), up=[0, 0, 1])
        it.cyl("candle", (x, y + 0.9, z), 0.75, h, wax(it, "wax", P["paper"]), sides=8)
        it.box("wick", (x, y + 0.9 + h + 0.15, z), (0.12, 0.3, 0.12), ink(it))
        fl += flame(it, f"flame{k}", (x, y + 1.0 + h, z), s=1.0)
    it.anim("idle", 2.0, flicker_tracks(fl))
    return it.spec()


@item
def toadstool_lamp():
    it = Item("toadstool_lamp", "Toadstool Cottage Lamp", density=4)
    ms = moss(it, "base", P["moss"], bloom=P["cream"])
    it.loft("base", [(0, 0, 0, 14.0), (0, 0.8, 0, 13.4), (0, 1.4, 0, 11.0)], ms, sides=12, up=[0, 0, 1])
    import foliage as F
    gr = [F.leaf_ramp(it, "lf_grass", P["fern"]), F.leaf_ramp(it, "lf_grass2", P["moss"]), F.leaf_ramp(it, "lf_clover", P["sage"])]
    for k in range(9):
        a = k / 9 * 2 * math.pi + 0.3
        if 0.9 < a < 1.9:
            continue  # keep the path to the door clear
        cv = F.cluster(20, 16, F.lanceolate(), 7, 9, 2.6, None, 0, seed=k, ramps=[0, 1], fan=0.7) if k % 3 else F.cluster(16, 14, F.heartlet(), 4, 6, 6, F.midrib(0.08), 0, seed=k, ramps=[2, 0], fan=1.3)
        F.add(it, "grass", cv, gr, (math.sin(a) * 5.6, 1.1, math.cos(a) * 5.6), rotation=(-10, math.degrees(a) + 90, 0))
    stem = plain(it, "stem", 0xeadfc6, tone=3.6, layers=[{"id": "fibre", "op": "stripes", "axis": "around", "period": 0.05, "width": 0.25, "shift": -0.5}])
    it.ramp("wd_door", P["woodDark"], n=6)
    it.loft("stem", [(0, 0, 0, 5.6), (0, 3.0, 0, 5.0), (0, 6.6, 0, 4.8), (0, 7.8, 0, 5.4)], stem, sides=10, pivot=(0, 1.4, 0), up=[0, 0, 1])
    door = plain(it, "door", P["woodDark"], tone=3.0, layers=[{"id": "planks", "op": "stripes", "axis": "x", "period": 0.6, "width": 0.25, "shift": -1.0}])
    dart = grid(8, 14)
    for x in (0, 1, 6, 7):
        dart[0][x] = "_"
    for x in (0, 7):
        dart[1][x] = "_"
    dart[7][6] = "k"
    it.box("door", (0, 3.1, 2.45), (2.0, 3.4, 0.5), door, paint={"stamps": [{"face": "front", "at": [0, 0], "art": rows(dart), "key": {"k": "br_brass:6"}}]})
    it.box("step", (0, 1.55, 3.0), (2.4, 0.3, 1.0), plain(it, "stone", P["pebble"], tone=3.2))
    it.box("glow_window", (1.0, 6.4, 2.3), (1.4, 1.2, 0.5), glow(it, "window", P["lamp"], tone=4.0),
           paint={"layers": [{"id": "mullion", "op": "rect", "rect": [0.42, 0, 0.58, 1], "ramp": "wd_door", "tone": 2}, {"id": "mull2", "op": "rect", "rect": [0, 0.42, 1, 0.58], "ramp": "wd_door", "tone": 2}]})
    it.box("sill", (1.0, 5.7, 2.6), (1.8, 0.3, 0.6), door)
    metal(it, "brass")
    capst = glow(it, "cap", P["clay"], tone=3.6)
    cap = it.style("capglow", dict(it.styles[capst], light=0.5, layers=[
        {"id": "dots", "op": "spots", "count": 9, "radius": [0.6, 1.0], "ramp": it.ramp("fm_spot", P["paper"], n=5), "tone": 3.6, "min_gap": 1.5, "where": {"y": [-0.2, 1]}},
        {"id": "under", "op": "gradient", "axis": "y", "amount": 0.6}]))
    gills = glow(it, "gill", P["lamp"], tone=3.4)
    it.loft("glow_cap", [(0, 0, 0, 12.6), (0, 0.8, 0, 13.0), (0, 2.0, 0, 11.0), (0, 3.0, 0, 7.0), (0, 3.4, 0, 2.0)], cap, sides=12, pivot=(0, 9.0, 0), up=[0, 0, 1])
    it.loft("glow_gills", [(0, 0, 0, 5.0), (0, 0.6, 0, 12.4)], it.style("gillst", dict(it.styles[gills], layers=[
        {"id": "gill", "op": "stripes", "axis": "around", "period": 0.03, "width": 0.4, "shift": -1.0}])), sides=12, pivot=(0, 8.6, 0), caps=(False, False), double_sided=True, up=[0, 0, 1])
    for (x, z, h, r, key) in ((4.6, 2.6, 4.0, 3.0, "m1"), (-4.8, 1.8, 2.6, 2.2, "m2")):
        it.loft("stem", [(0, 0, 0, r * 0.7), (0, h, 0, r * 0.6)], stem, sides=8, pivot=(x, 1.2, z), up=[0, 0, 1])
        it.loft("glow_cap", [(0, 0, 0, r * 2.0), (0, r * 0.5, 0, r * 1.8), (0, r * 0.9, 0, r * 0.7)], cap, sides=10, pivot=(x, 1.2 + h, z), up=[0, 0, 1])
    peb = plain(it, "pebble", P["pebble"], tone=3.4)
    for (x, z, s) in ((0.2, 4.2, 1.2), (0.9, 5.6, 1.0), (-0.3, 6.6, 0.9)):
        it.loft("pebble", [(0, 0, 0, (s * 1.4, s)), (0, 0.4, 0, (s * 1.2, s * 0.8))], peb, sides=6, pivot=(x, 1.2, z), up=[0, 0, 1])
    iron = metal(it, "iron")
    it.cyl("lampost", (-2.0, 1.2, 4.0), 0.2, 3.2, iron, sides=4)
    it.box("glow_lantern", (-2.0, 4.8, 4.0), (0.9, 1.0, 0.9), glow(it, "lantern", P["lamp"], tone=4.2))
    it.box("lanterncap", (-2.0, 5.5, 4.0), (1.2, 0.4, 1.2), iron)
    it.anim("idle", 3.0, [{"part": "glow_cap", "channel": "scale", "osc": {"amp": [0.015, 0.03, 0.015], "cycles": 1}}])
    return it.spec()


@item
def firefly_jar():
    it = Item("firefly_jar", "Firefly Jar", density=5)
    gl = glass(it, "jar", 0xd9e8dc)
    it.loft("glass_jar", [(0, 0, 0, 7.4), (0, 0.6, 0, 8.0), (0, 8.4, 0, 8.0), (0, 9.4, 0, 6.6), (0, 10.0, 0, 6.6)], gl, sides=10, caps=(True, False), up=[0, 0, 1], subdiv=0)
    for (x, z, h, a) in ((-2.2, 2.4, 6.4, 0), (-3.0, 1.0, 4.0, 0)):
        it.card("glint", (x * 1.18, 1.8 + h / 2, z * 1.18), gl, size=(0.45, h), rotation=[0, -40, 0], paint={"light": 0, "tone": 5.0, "layers": []})
    it.cyl("moss", (0, 0.4, 0), 3.4, 1.4, moss(it, "jar", P["moss"]), sides=10)
    import foliage as F
    fr = [F.leaf_ramp(it, "lf_sprig", P["fern"]), F.leaf_ramp(it, "lf_sprig2", P["moss"])]
    for k, (x, z, a) in enumerate(((-1.4, 0.6, -10), (1.6, -1.0, 14), (0.4, 1.6, 4))):
        cv = F.cluster(16, 22 - k * 3, F.lanceolate(), 6, 7, 3.2, F.midrib(0.08), 0, seed=k, ramps=[0, 1], fan=0.8)
        for rot in (0, 90):
            F.add(it, "sprig", cv, fr, (x, 1.8, z), rotation=(0, rot + k * 30, a))
    pew = metal(it, "pewter")
    it.cyl("lid", (0, 9.8, 0), 3.6, 1.2, pew, sides=10, paint={"layers": [{"id": "thread", "op": "stripes", "axis": "y", "period": 0.4, "width": 0.4, "shift": -0.9, "faces": ["sides"]},
                                                                       {"id": "holes", "op": "spots", "centers": [[x, 0, 0.6, 0.25] for x in (-1.2, 0, 1.2)], "shift": -2.4, "faces": ["front"]}]})
    it.cyl("cloth", (0, 11.0, 0), 3.4, 0.2, fabric(it, "gingham", P["cream"], tone=3.4, weave=False), sides=10)
    twine = plain(it, "twine", P["linen"], tone=3.4, layers=[{"id": "twist", "op": "stripes", "axis": [1, 1, 0], "period": 0.6, "width": 0.4, "shift": -1.0}])
    it.loft("handle", [(math.cos(a) * 3.7, 11.0 + math.sin(a) * 4.8, 0, 0.5) for a in [k * math.pi / 8 for k in range(9)]], twine, sides=4, caps=(True, True))
    # five fireflies drifting in slow loops, blinking
    fly = glow(it, "fly", 0xd9e89a, tone=4.4)
    body = plain(it, "flybody", P["soot"], tone=2.4)
    tracks = []
    homes = [(-1.2, 4.0, 0.8), (1.4, 6.0, -0.6), (0.2, 7.6, 1.2), (-1.0, 5.6, -1.4), (1.6, 3.2, 1.0)]
    for k, (x, y, z) in enumerate(homes):
        b = it.bone("fly", (x, y, z))
        it.box("glow_fly", (0, 0, 0), (0.9, 0.9, 0.9), fly, parent=b, ch=0.2)
        it.box("flyhead", (0, 0.55, 0.3), (0.6, 0.4, 0.5), body, parent=b)
        tracks.append({"part": b, "channel": "position", "osc": {"axis": [1, 0, 0], "amp": 1.2, "cycles": 1, "phase": k * 0.2}})
        tracks.append({"part": b, "channel": "position", "osc": {"axis": [0, 0, 1], "amp": 1.1, "cycles": 1, "phase": k * 0.2 + 0.25}})
        tracks.append({"part": b, "channel": "position", "osc": {"axis": [0, 1, 0], "amp": 0.9, "cycles": 2, "phase": k * 0.31}})
    for k in range(len(homes)):
        tracks.append({"part": f"glow_fly{k}" if k else "glow_fly", "channel": "scale", "osc": {"amp": [0.45, 0.45, 0.45], "cycles": 2 + k % 2, "phase": k * 0.23, "shape": "pulse"}})
    it.anim("idle", 6.0, tracks)
    return it.spec()


# ------------------------------------------------------------------ glow parts merged into borrowed lights (borrowed.py)
@item
def fringe_floor_lamp_extra():
    """A warm bulb and a lit lining under the borrowed lamp's shade (emissive at night)."""
    it = Item("fringe_floor_lamp_extra", "Floor lamp glow", density=4)
    it.loft("glow_bulb", [(0, 0, 0, 1.4), (0, 1.0, 0, 2.6), (0, 2.2, 0, 1.6)], glow(it, "bulb", P["lamp"], tone=4.4), sides=8, pivot=(0, 30.4, 0), up=[0, 0, 1])
    disc = grid(40, 40)
    for y in range(40):
        for x in range(40):
            d = math.hypot(x - 19.5, y - 19.5)
            disc[y][x] = "." if d > 19.5 else ("w" if d < 7 else "#")
    st = glow(it, "lining", P["honey"], tone=3.6)
    it.card("glow_lining", (0, 29.2, 0), st, art=rows(disc), size=(9.6, 9.6), plane="xz", key={"w": "fm_lining:5"})
    it.anim("idle", 4.0, [{"part": "glow_bulb", "channel": "scale", "osc": {"amp": [0.04, 0.04, 0.04], "cycles": 2}}])
    return it.spec()


@item
def iron_lantern_extra():
    """A flickering candle flame for the borrowed lantern."""
    it = Item("iron_lantern_extra", "Lantern flame", density=6)
    it.loft("glow_core", [(0, 0, 0, 0.8), (0, 0.8, 0, 1.6), (0, 1.8, 0, 0.6)], glow(it, "core", P["lamp"], tone=4.6), sides=6, pivot=(0, 4.2, 0), up=[0, 0, 1])
    f = flame(it, "flame", (0, 4.6, 0), s=1.3)
    it.anim("idle", 2.0, flicker_tracks(f) + [{"part": "glow_core", "channel": "scale", "osc": {"amp": [0.12, 0.2, 0.12], "cycles": 3}}])
    return it.spec()
