"""Fun things that move: goldfish bowl, aquarium, clockwork train, rocking horse, music box, arcade, wheel, feeder."""
import math

from foliage import FIR_KEY, LEAF_KEY, bush, card_style, fir, fir_sprig, leaf_cluster, single_leaf
from lib import HD, Spec, bezier, circle, cloth, glass, glaze, glow, hsh, knit, leafy, metal, paper, plain, wood
from pix import Pix, star_pts

ITEMS = {}


def item(f):
    ITEMS[f.__name__] = f
    return f


def gravel(tone=3.6):
    return {"ramp": "stone", "tone": tone, "rim": {"light_shift": 0.6, "dark_shift": -0.8}, "layers": [
        {"id": "pebbles", "op": "scales", "shape": "round", "along": "x", "size": [0.7, 0.6], "gap": 0.8,
         "highlight": 1.0, "shadow": -1.2, "jitter": 0.9},
        {"id": "ochre", "op": "spots", "count": 14, "radius": [0.25, 0.45], "ramp": "ochre", "tone": 4},
        {"id": "sage", "op": "spots", "count": 10, "radius": [0.25, 0.4], "ramp": "sage", "tone": 3.6},
        {"id": "rose", "op": "spots", "count": 8, "radius": [0.25, 0.4], "ramp": "rose", "tone": 3.6}]}


def fish(S, id, at, parent, length=4.4, ramp='fish', belly='honey', fin='honey', stripe=None, tall=1.0):
    """A little fish facing +x: a lofted body (eye dots, a paler belly) and a wagging tail fin."""
    L, H = length, length * 0.5 * tall
    x0 = at[0] - L * 0.5
    y, z = at[1], at[2]
    body = S.tube(id, [(x0, y, z), (x0 + L * 0.25, y + 0.05, z), (x0 + L * 0.62, y + 0.1, z), (x0 + L, y - 0.05, z)],
                  [(0.35, 0.6), (L * 0.17, H * 0.42), (L * 0.16, H * 0.45), (0.25, 0.4)], {
                      "ramp": ramp, "tone": 2.8, "rim": {"light_shift": 1.0, "dark_shift": -0.8}, "brush": {"off": True},
                      "layers": [
                          {"id": "belly", "op": "band", "axis": "y", "from": -1, "to": -0.25, "ramp": belly, "tone": 5},
                          {"id": "scales", "op": "scales", "shape": "round", "along": "x", "size": [0.45, 0.35],
                           "gap": 0.6, "highlight": 0.6, "shadow": -0.5},
                          *([{"id": "stripe", "op": "band", "axis": "y", "from": -0.1, "to": 0.25, "ramp": stripe,
                              "tone": 4.5}] if stripe else []),
                          {"id": "eye", "op": "spots", "centers": [[L * 0.8, 0.22, L * 0.12, 0.24],
                                                                    [L * 0.8, 0.22, -L * 0.12, 0.24]],
                           "ramp": "soot", "tone": 0.5, "roughness": 0},
                          {"id": "gloss", "op": "gloss", "dash": True, "length": 1, "shift": 1.6, "density": 0.6,
                           "post": True}]}, parent=parent, sides=8, at=(x0, y, z))
    finst = {"ramp": fin, "tone": 4.2, "light": 0.5, "brush": {"off": True}, "rim": {"light": 0, "dark": 0}}
    S.bone(id + "_tailj", (x0 + 0.2, y, z), parent=parent)
    S.card(id + "_tail", ["..aa", ".aab", "aabb", "abb.", "aabb", ".aab", "..aa"][::1], (x0 - 0.45, y, z), finst,
           parent=id + "_tailj", key={"a": f"{fin}:5", "b": f"{fin}:3"}, rot=(0, 0, 0))
    S.card(id + "_fin", ["aab.", "abbb"], (x0 + L * 0.5, y + H * 0.5, z), finst, parent=parent,
           key={"a": f"{fin}:5", "b": f"{fin}:3"})
    return body


@item
def goldfish_bowl():
    S = Spec("goldfish_bowl", "Goldfish Bowl", density=3.5,
             desc="Marmalade's bowl: a turned walnut stand, a round glass bowl with a wide lip, water, pastel gravel, a "
                  "little stone castle with a flag, swaying waterweed and Marmalade herself swimming laps.")
    # turned walnut stand with a brass band
    S.lathe("stand", [(5.4, 0), (5.6, 0.5), (5.2, 1.3), (4.6, 1.6)], (0, 0, 0), wood("walnut", tone=4.2, grain="x"),
            sides=16, caps=(False, True), subdiv=0)
    S.lathe("band", [(5.0, 1.1), (5.0, 1.6)], (0, 0, 0), metal("brass"), sides=16, caps=(False, False), subdiv=0)
    # the glass bowl, open at the top with a rolled lip
    prof = [(3.4, 1.6), (5.0, 2.6), (6.1, 4.6), (6.4, 6.6), (6.0, 9.0), (5.0, 10.9), (4.5, 11.8), (4.9, 12.5), (5.0, 12.9)]
    S.lathe("glass_bowl", prof, (0, 0, 0), glass("glass"), sides=16, caps=(False, False), double_sided=True)
    # water up to just under the shoulder: a surface you can see the fish through
    wprof = [(3.2, 1.7), (4.8, 2.7), (5.9, 4.6), (6.15, 6.6), (5.75, 9.0), (5.45, 9.6)]
    S.lathe("water_body", wprof, (0, 0, 0), {"ramp": "lake", "tone": 3.6, "light": 0.4, "brush": {"off": True},
                                             "rim": {"light": 0, "dark": 0}, "layers": [
                                                 {"id": "ripples", "op": "stripes", "axis": [1, 0, 0.6], "period": 1.3,
                                                  "width": 0.25, "shift": 1.6, "wobble": 0.8, "faces": ["end"]},
                                                 {"id": "deep", "op": "gradient", "axis": "y", "amount": 1.2}]},
            sides=16, caps=(False, True))
    # pastel gravel mound and a sunken castle
    S.lathe("gravel", [(3.4, 1.65), (5.0, 2.7), (4.2, 3.3), (1.5, 3.6)], (0, 0, 0), gravel(), sides=14, caps=(False, True))
    stone = {"ramp": "stone", "tone": 4.2, "rim": {"light_shift": 1.0, "dark_shift": -1.0}, "layers": [
        {"id": "bricks", "op": "scales", "shape": "square", "along": "x", "size": [0.9, 0.6], "gap": 0.8,
         "highlight": 0.6, "shadow": -1.0, "jitter": 0.5},
        {"id": "algae", "op": "patches", "scale": 1.2, "threshold": 0.7, "ramp": "moss", "tone": 3.6, "faces": ["sides"]}]}
    S.cyl("tower", 1.5, 5.2, (-2.4, 3.0, -1.8), stone, sides=8)
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        S.box(f"crenel{k}", (0.9, 0.9, 0.7), (-2.4 + math.cos(a) * 1.35, 8.55, -1.8 + math.sin(a) * 1.35), stone,
              rot=(0, -math.degrees(a) + 90, 0))
    S.cyl("roof", 1.7, 2.4, (-2.4, 8.4, -1.8), plain("holly", tone=4.0, gloss=True), sides=8, r2=0.0, caps=(True, False))
    S.box("door", (1.0, 1.6, 0.6), (-2.0, 3.9, -0.5), plain("soot", 1.2, noise=0), rot=(0, 20, 0))
    S.card("flag", ["aaa.", "aaaa", "aa..", "b...", "b...", "b..."], (-2.0, 11.4, -1.8),
           {"ramp": "honey", "tone": 4, "brush": {"off": True}}, key={"a": "honey:5", "b": "iron:3"})
    # waterweed (sways) and a snail on the gravel
    weed = leafy("leaf", tone=4.6)
    S.bone("weedj", (2.8, 2.8, -2.4))
    for k, (dx, h, ry) in enumerate([(0, 6.2, 10), (0.7, 4.8, 70), (-0.6, 5.4, 130)]):
        S.card(f"weed{k}", [".a.", "aab", ".ab", "aa.", ".ab", "ab.", ".ab", "aa.", ".a.", "aab", ".a.", ".a."][:max(6, int(h * 2))],
               (2.8 + dx, 2.8 + h / 2, -2.4), weed, parent="weedj", rot=(0, ry, 0), pivot=(2.8 + dx, 2.8, -2.4),
               key={"a": "leaf:5", "b": "leaf:3"})
    S.ball("snail", 0.6, (1.8, 3.6, 2.4), plain("tawny", 4.0, gloss=True), sides=8, rings=4)
    # Marmalade, swimming laps round the bowl's middle
    S.bone("swim", (0.4, 0, 0.4))
    fish(S, "fish", (0.4, 6.6, 3.4), "swim", length=4.0)
    # bubbles from the castle
    for k in range(3):
        S.ball(f"glass_bub{k}", 0.35 + k * 0.08, (-2.0, 9.0, -1.6), glass("glass", tone=4.0), sides=6, rings=3)
    S.anim("idle", 6.0, [
        {"part": "swim", "keys": [[0, 0], [6.0, 360]], "axis": "y", "ease": "linear"},
        {"part": "swim", "channel": "position", "osc": {"axis": "y", "amp": 0.9, "cycles": 2}},
        {"part": "fish_tailj", "osc": {"axis": "y", "amp": 30, "cycles": 12}},
        {"part": "weedj", "osc": {"axis": "z", "amp": 6, "cycles": 2}},
        {"part": "weedj", "osc": {"axis": "x", "amp": 4, "cycles": 1, "phase": 0.3}},
        *[{"part": f"glass_bub{k}", "channel": "position", "keys": [[0, [0, -1.5, 0]], [2.0, [0.3 - k * 0.3, 1.2, 0.2]],
                                                                   [2.01, [0, -1.5, 0]], [6.0, [0, -1.5, 0]]],
           "ease": "linear"} for k in range(3)],
    ])
    # stagger the bubbles
    for k, tr in enumerate(S.anims["idle"]["tracks"][5:]):
        o = k * 2.0
        tr["keys"] = [[0, [0, -1.5, 0]], [o + 0.01, [0, -1.5, 0]], [o + 2.0, [0.3 - k * 0.3, 1.6, 0.2]],
                      [min(o + 2.02, 6.0), [0, -1.5, 0]], [6.0, [0, -1.5, 0]]] if o > 0 else \
            [[0, [0, -1.5, 0]], [2.0, [0.3, 1.6, 0.2]], [2.02, [0, -1.5, 0]], [6.0, [0, -1.5, 0]]]
    return S


def flat(r, tone=4.0, light=0.6):
    return {"ramp": r, "tone": tone, "light": light, "brush": {"off": True}, "rim": {"light": 0, "dark": 0}}


def swim_keys(x0, x1, period, phase, n=4):
    """Back-and-forth swim along x: position keys (offsets) and quick 180 degree turns at each end."""
    pos, rot = [], []
    half = period / 2
    for k in range(-1, 3):
        t0 = k * period + phase * period
        pos += [[t0, [x0, 0, 0]], [t0 + half, [x1, 0, 0]]]
        rot += [[t0 - 0.25, 180], [t0 + 0.25, 360], [t0 + half - 0.25, 360], [t0 + half + 0.25, 540]]
    pos = [p for p in pos if -period <= p[0] <= 2 * period]
    return pos, rot


@item
def aquarium():
    S = Spec("aquarium", "Planted Aquarium", density=2.6, tris=3200,
             desc="A planted tank on a walnut cabinet: iron-framed glass, a lamp hood glowing over clear water, "
                  "sand and pebbles, swaying eelgrass, driftwood, a sunken treasure chest, a shoal of tetras, a platy "
                  "and an angelfish swimming to and fro, and a stream of bubbles.")
    wd = wood("walnut", tone=4.4, grain="y")
    S.box("cabinet", (30.0, 13.0, 12.6), (0, 7.2, 0), wd, chamfer=0.4)
    S.paint("cabinet", layers=[{"id": "doors", "op": "panel", "inset": 3, "shift": -0.8, "highlight": 1, "shadow": 1,
                                "faces": ["front"]}])
    S.box("plinth", (30.6, 0.8, 13.0), (0, 0.4, 0), plain("walnut", tone=2.4, noise=0.3), chamfer=0.2)
    S.box("divider", (0.6, 11.0, 0.3), (0, 7.2, 6.35), plain("walnut", tone=2.6, noise=0.2))
    for k, x in enumerate((-1.6, 1.6)):
        S.ball(f"knob{k}", 0.55, (x, 8.6, 6.6), metal("brass", tone=5.0), sides=6, rings=3)
    S.box("top", (31.0, 0.9, 13.4), (0, 14.15, 0), wd, chamfer=0.3)
    # tank: iron frame, glass, water, sand
    iron = metal("iron", tone=4.0, tarnish=False)
    y0, y1 = 14.6, 27.0
    for k, (x, z) in enumerate([(-14.6, 5.8), (14.6, 5.8), (-14.6, -5.8), (14.6, -5.8)]):
        S.box(f"post{k}", (0.8, y1 - y0, 0.8), (x, (y0 + y1) / 2, z), iron)
    for k, y in enumerate((y0 + 0.35, y1 - 0.35)):
        S.box(f"rimf{k}", (30.0, 0.7, 0.8), (0, y, 5.8), iron)
        S.box(f"rimb{k}", (30.0, 0.7, 0.8), (0, y, -5.8), iron)
        S.box(f"rims{k}a", (0.8, 0.7, 11.0), (-14.6, y, 0), iron)
        S.box(f"rims{k}b", (0.8, 0.7, 11.0), (14.6, y, 0), iron)
    S.box("glass_tank", (29.4, y1 - y0 - 0.2, 11.8), (0, (y0 + y1) / 2, 0), glass("glass"), double_sided=True)
    S.box("water_tank", (28.6, 9.8, 11.0), (0, y0 + 0.4 + 4.9, 0), {
        "ramp": "lake", "tone": 4.0, "light": 0.35, "brush": {"off": True}, "rim": {"light": 0, "dark": 0}, "layers": [
            {"id": "deep", "op": "gradient", "axis": "y", "amount": 1.4},
            {"id": "ripple", "op": "stripes", "axis": [1, 0, 0.5], "period": 1.6, "width": 0.2, "shift": 1.4,
             "faces": ["top"], "wobble": 0.6}]})
    S.taper("sand", (28.4, 2.2, 10.8), (0, y0 + 1.2, 0), {
        "ramp": "buff", "tone": 4.4, "rim": {"light_shift": 0.6, "dark_shift": -0.8}, "layers": [
            {"id": "grain", "op": "noise", "scale": 0.8, "amount": 0.8},
            {"id": "pebbles", "op": "spots", "count": 30, "radius": [0.25, 0.5], "ramp": "stone", "tone": 4,
             "bevel": {"shadow": 1, "highlight": 1}}]}, front_scale=[1, 0.6], front_shift=[0, -0.45])
    # driftwood, rocks, a treasure chest
    S.tube("driftwood", [(-11.0, y0 + 1.6, -3.0), (-7.0, y0 + 3.0, -1.6), (-4.0, y0 + 3.4, -3.4), (-1.0, y0 + 5.6, -4.2)],
           [0.9, 0.75, 0.6, 0.3], plain("bark", tone=4.0, noise=0.6), sides=6)
    for k, (x, z, r) in enumerate([(8.0, -3.0, 1.8), (10.4, -2.0, 1.3), (6.4, -4.2, 1.1), (-9.0, 2.6, 1.0)]):
        S.ball(f"rock{k}", r, (x, y0 + 1.6 + r * 0.6, z), plain("stone", tone=3.6, layers=[
            {"id": "moss", "op": "patches", "scale": 0.9, "threshold": 0.62, "ramp": "moss", "tone": 3.6}]),
            sides=7, rings=4, squash=(1.2, 0.8, 1.0))
    chest = wood("oak", tone=4.0, grain="x", polish=False)
    S.box("chest", (3.2, 1.8, 2.2), (3.0, y0 + 2.5, 2.4), chest, rot=(0, -18, 0), chamfer=0.15)
    S.box("chest_lid", (3.3, 0.6, 2.3), (3.0, y0 + 3.9, 2.0), chest, rot=(-24, -18, 0), chamfer=0.15)
    S.box("chest_gold", (2.6, 0.5, 1.6), (3.0, y0 + 3.45, 2.5), plain("gold", tone=5.5, gloss=True), rot=(0, -18, 0))
    # eelgrass and fan plants (sway)
    S.bone("plantsj", (0, y0 + 2.0, 0))
    for k in range(11):
        x = -13.0 + k * 2.5 + (hsh(k, 1) - 0.5) * 1.6
        z = -4.2 + hsh(k, 2) * 3.0
        h = 6.0 + hsh(k, 3) * 4.5
        rows = int(h * S.density)
        p = Pix(4, rows)
        for y in range(rows):
            off = int(round(math.sin(y * 0.35 + k) * 0.8))
            p.set(1 + off, y, "a")
            p.set(2 + off, y, "b" if y % 3 else "a")
        S.card(f"grass{k}", p.rows, (x, y0 + 2.0 + h / 2, z), flat("leaf"), parent="plantsj",
               rot=(0, (hsh(k, 4) - 0.5) * 60, 0), pivot=(x, y0 + 2.0, z), key={"a": "leaf:5", "b": "leaf:3"})
    # fish: a shoal of tetras, a platy and an angelfish swimming to and fro
    tracks = []
    fishes = [("tetra0", 2.6, "lake", "berry", "lake", "mist", 1.0, y0 + 7.2, -1.8, 0.0, 9.0),
              ("tetra1", 2.6, "lake", "berry", "lake", "mist", 1.0, y0 + 6.4, -0.6, 0.06, 9.0),
              ("tetra2", 2.6, "lake", "berry", "lake", "mist", 1.0, y0 + 7.8, -0.2, 0.12, 9.0),
              ("platy", 3.4, "fish", "honey", "honey", None, 1.0, y0 + 4.8, 1.8, 0.45, 12.0),
              ("angel", 3.4, "cream", "linen", "cream", "soot", 2.2, y0 + 6.2, 0.6, 0.7, 18.0)]
    for nm, L, rmp, bel, fin, stripe, tall, y, z, ph, per in fishes:
        S.bone(f"{nm}j", (0, 0, 0))
        fish(S, nm, (0, y, z), f"{nm}j", length=L, ramp=rmp, belly=bel, fin=fin, stripe=stripe, tall=tall)
        S.paint(nm, layers=[{"id": "tail_wag", "op": "noise", "scale": 1, "amount": 0.1}])
        x0, x1 = -10.5, 10.5
        if per != 18.0:
            pos, rot = swim_keys(x0, x1, per, ph)
            tracks.append({"part": f"{nm}j", "channel": "position", "keys": [[t, v] for t, v in pos if 0 <= t <= 18.0] or
                           [[0, [x0, 0, 0]]], "ease": "linear"})
        else:
            tracks.append({"part": f"{nm}j", "channel": "position", "keys": [[0, [x0, 0, 0]], [9, [x1, 0, 0]], [18, [x0, 0, 0]]]})
            rot = [[0, 0], [8.6, 0], [9.4, 180], [17.6, 180], [18.0, 270]]
        tracks.append({"part": f"{nm}j", "axis": "y", "keys": [[t, v] for t, v in rot if 0 <= t <= 18.0], "ease": "ease"})
        tracks.append({"part": f"{nm}_tailj", "osc": {"axis": "y", "amp": 26, "cycles": 36}})
    # bubbles from an air stone
    S.box("airstone", (1.2, 0.7, 1.2), (11.4, y0 + 2.2, 3.4), plain("stone", tone=3.0, noise=0.6))
    for k in range(4):
        S.ball(f"glass_bub{k}", 0.35 + 0.1 * (k % 2), (11.4, y0 + 2.6, 3.4), glass("glass", tone=4.2), sides=6, rings=3)
        off = k * 0.75
        tracks.append({"part": f"glass_bub{k}", "channel": "position", "ease": "linear",
                       "keys": [[0, [0, 0, 0]], [off, [0, 0, 0]], [off + 2.9, [0.4 * (k - 1.5), 9.0, 0.2]],
                                [off + 2.91, [0, 0, 0]], [18.0, [0, 0, 0]]] if off > 0 else
                       [[0, [0, 0, 0]], [2.9, [-0.6, 9.0, 0.2]], [2.91, [0, 0, 0]], [18.0, [0, 0, 0]]]})
    tracks.append({"part": "plantsj", "osc": {"axis": "z", "amp": 3, "cycles": 6}})
    # hood with a glowing lamp strip
    S.box("hood", (31.0, 2.2, 13.4), (0, y1 + 1.1, 0), wd, chamfer=0.35)
    S.box("glow_lamp", (27.0, 0.3, 2.0), (0, y1 - 0.05, 0), glow("bulb", tone=4.2))
    S.anim("idle", 18.0, tracks)
    return S


def stadium(s, L=20.0, R=9.6):
    """Point and heading (degrees about y, model faces +x) at arc length s round a stadium loop."""
    per = 2 * L + 2 * math.pi * R
    s = s % per
    if s < L:
        x, z, dx, dz = -L / 2 + s, R, 1, 0
    elif s < L + math.pi * R:
        a = (s - L) / R
        x, z, dx, dz = L / 2 + math.sin(a) * R, math.cos(a) * R, math.cos(a), -math.sin(a)
    elif s < 2 * L + math.pi * R:
        u = s - L - math.pi * R
        x, z, dx, dz = L / 2 - u, -R, -1, 0
    else:
        a = (s - 2 * L - math.pi * R) / R
        x, z, dx, dz = -L / 2 - math.sin(a) * R, -math.cos(a) * R, -math.cos(a), math.sin(a)
    return x, z, math.degrees(math.atan2(-dz, dx))


@item
def toy_train():
    S = Spec("toy_train", "Clockwork Train Loop", density=2.6, tris=3400,
             desc="A clockwork engine with a coal tender and a passenger car going round a sleeper-and-ballast loop "
                  "past the little Snoozeville station, a signal and a fir tree. Puffs of steam from the chimney.")
    L, R = 20.0, 9.6
    per = 2 * L + 2 * math.pi * R
    # the track bed: a flat ballast band with sleepers, and two rails, all following the loop
    path = [stadium(per * i / 48, L, R) for i in range(50)]
    bed = {"ramp": "stone", "tone": 3.8, "rim": {"light_shift": 0.6, "dark_shift": -0.8}, "layers": [
        {"id": "ballast", "op": "noise", "scale": 0.6, "amount": 0.9},
        {"id": "sleepers", "op": "stripes", "axis": "path", "period": 1.6, "width": 0.38, "ramp": "walnut", "tone": 3.6,
         "faces": ["top"], "bevel": {"shadow": 1, "highlight": 1}}]}
    S.tube("bed", [(x, 0.3, z) for x, z, _ in path], [(2.4, 0.3)] * len(path), bed, sides=4, round=6, caps=(False, False),
           subdiv=0)
    for k, off in enumerate((-1.1, 1.1)):
        pts = []
        for i in range(50):
            x, z, h = stadium(per * i / 48, L, R)
            a = math.radians(h)
            pts.append((x + math.sin(a) * off, 0.75, z + math.cos(a) * off))
        S.tube(f"rail{k}", pts, 0.22, metal("silver", tone=4.0, tarnish=False), sides=4, caps=(False, False), subdiv=0)
    # a mossy green board inside the loop with the station, signal and a fir
    S.lathe("lawn", [(8.2, 0), (8.2, 0.3)], (0, 0, 0), {"ramp": "moss", "tone": 4.0, "layers": [
        {"id": "grass", "op": "noise", "scale": 0.7, "amount": 0.9},
        {"id": "flowers", "op": "spots", "count": 16, "radius": [0.2, 0.3], "ramp": "cream", "tone": 5, "faces": ["up"]}]},
        sides=16, squash=0.92, subdiv=0)
    S.box("lawn_mid", (20.0, 0.3, 15.0), (0, 0.15, 0), {"ramp": "moss", "tone": 4.0, "layers": [
        {"id": "grass", "op": "noise", "scale": 0.7, "amount": 0.9},
        {"id": "flowers", "op": "spots", "count": 20, "radius": [0.2, 0.3], "ramp": "cream", "tone": 5, "faces": ["up"]}]})
    st = wood("pale", tone=4.6, grain="y")
    S.box("platform", (11.0, 1.2, 3.4), (-2.0, 0.6, 5.6), plain("stone", tone=4.2, layers=[
        {"id": "slabs", "op": "scales", "shape": "square", "along": "x", "size": [1.6, 1.4], "gap": 0.6, "highlight": 0.6,
         "shadow": -0.8}]))
    S.box("station", (6.0, 4.0, 3.4), (-3.0, 3.2, 2.6), st, chamfer=0.2)
    S.paint("station", stamps=[{"face": "front", "at": "center", "key": {"w": "lamp:4", "f": "walnut:2", "d": "walnut:1"},
                                "art": ["fffffff....dddd....fffffff", "fwwwwwf....dddd....fwwwwwf", "fwwfwwf....dddd....fwwfwwf",
                                        "fwwwwwf....dddd....fwwwwwf", "fffffff....dddd....fffffff"]}])
    for k, s in enumerate((-1, 1)):
        S.box(f"sroof{k}", (7.4, 0.5, 2.6), (-3.0, 5.7, 2.6 + s * 1.05), plain("holly", tone=3.6, layers=[
            {"id": "tiles", "op": "scales", "shape": "square", "along": "x", "size": [0.8, 0.6], "gap": 0.6, "highlight": 0.6,
             "shadow": -0.9}]), rot=(s * 32, 0, 0), chamfer=0.1)
    sign = Pix(24, 6)
    sign.rect(0, 0, 23, 5, "b")
    sign.rect(1, 1, 22, 4, "p")
    for x in range(3, 21):
        if hsh(x, 1) > 0.35:
            sign.set(x, 2 + (x % 2), "i")
    S.card("sign", sign.rows, (2.6, 3.0, 6.6), flat("cream"), key={"b": "walnut:2", "p": "cream:5", "i": "ink:2"})
    S.box("sign_post", (0.3, 2.4, 0.3), (2.6, 1.6, 6.5), plain("walnut", tone=3, noise=0))
    S.cyl("signal", 0.25, 6.0, (6.6, 0.3, 4.2), metal("iron", tone=4.0, tarnish=False), sides=5)
    S.box("signal_arm", (2.6, 0.6, 0.25), (7.6, 5.8, 4.2), plain("holly", tone=4.2, layers=[
        {"id": "band", "op": "band", "axis": "x", "from": 0.3, "to": 0.6, "ramp": "cream", "tone": 5}]), rot=(0, 0, 20))
    S.ball("glow_signal", 0.45, (6.6, 5.2, 4.5), glow("ember", tone=4.0), sides=6, rings=3)
    S.cyl("trunk", 0.5, 2.0, (5.0, 0.3, -3.6), plain("bark", tone=3.4), sides=6)
    fir(S, "fir", (5.0, 1.6, -3.6), 6.8, 3.0, tiers=4, snow=0.0, seed=1)
    # the train: engine, tender and passenger car, each riding its own joint round the loop
    berry = plain("berry", tone=4.0, gloss=True, layers=[
        {"id": "chips", "op": "wear", "width": 1, "density": 0.15, "ramp": "iron", "tone": 3}])
    green = plain("fern", tone=4.2, gloss=True, layers=[
        {"id": "chips", "op": "wear", "width": 1, "density": 0.15, "ramp": "iron", "tone": 3}])
    brass = metal("brass", tone=4.8)
    soot = plain("soot", tone=2.0, noise=0.3)

    def wheels(prefix, parent, xs, z=1.1, r=0.9):
        for k, x in enumerate(xs):
            for s in (-1, 1):
                S.cyl(f"{prefix}w{k}{s}", r, 0.4, (x, r + 0.55, s * (z + 0.4)), plain("iron", tone=3.6, layers=[
                    {"id": "spokes", "op": "stripes", "axis": "around", "period": 0.125, "width": 0.3, "shift": 0.9,
                     "faces": ["end", "start"]}]), parent=parent, rot=(-s * 90, 0, 0), sides=8, caps=(True, True))

    ry = 0.95  # rail top
    S.bone("engine", (0, 0, 0))
    S.box("e_frame", (6.4, 0.6, 2.4), (0, ry + 1.3, 0), soot, parent="engine")
    S.tube("e_boiler", [(-0.6, ry + 2.7, 0), (3.0, ry + 2.7, 0)], 1.25, green, parent="engine", sides=10)
    S.cyl("e_smokebox", 1.32, 0.6, (3.0, ry + 2.7, 0), soot, parent="engine", rot=(0, 0, -90), sides=10, caps=(True, True))
    S.lathe("e_chimney", [(0.5, 0), (0.45, 1.2), (0.85, 2.0), (0.8, 2.3)], (2.4, ry + 3.6, 0), soot, parent="engine", sides=8)
    S.lathe("e_dome", [(0.7, 0), (0.6, 0.6), (0.2, 0.9)], (0.8, ry + 3.8, 0), brass, parent="engine", sides=8)
    S.box("e_cab", (2.4, 2.8, 2.6), (-1.6, ry + 3.0, 0), berry, parent="engine", chamfer=0.15)
    S.paint("e_cab", stamps=[{"faces": ["left", "right"], "at": "center", "offset": [0, 2],
                              "key": {"w": "lamp:5", "f": "walnut:1"}, "art": ["ffffff", "fwwwwf", "fwwwwf", "ffffff"]}])
    S.box("e_roof", (3.0, 0.4, 3.0), (-1.6, ry + 4.55, 0), soot, parent="engine", chamfer=0.1)
    S.taper("e_catcher", (2.2, 1.0, 1.0), (3.8, ry + 0.9, 0), brass, parent="engine", rot=(0, 90, 0),
            front_scale=[1.0, 0.2])
    S.ball("glow_lamp", 0.4, (3.45, ry + 3.5, 0), glow("bulb"), parent="engine", sides=6, rings=3)
    S.box("e_key", (0.2, 1.4, 0.2), (-2.4, ry + 4.6, 0), brass, parent="engine")
    wheels("e", "engine", (-1.6, 0.4, 2.2))
    for k in range(3):
        S.ball(f"puff{k}", 0.5 + 0.15 * k, (2.4, ry + 6.0, 0), plain("cream", tone=5.0, noise=0.2), parent="engine",
               sides=6, rings=3)
    S.bone("tender", (0, 0, 0))
    S.box("t_body", (3.2, 1.8, 2.4), (0, ry + 2.3, 0), green, parent="tender", chamfer=0.15)
    S.box("t_coal", (2.8, 0.5, 2.0), (0, ry + 3.35, 0), plain("soot", tone=1.6, layers=[
        {"id": "lumps", "op": "scales", "shape": "round", "along": "x", "size": [0.5, 0.4], "gap": 0.8, "highlight": 1.2,
         "shadow": -0.6}]), parent="tender")
    S.box("t_frame", (3.4, 0.5, 2.2), (0, ry + 1.2, 0), soot, parent="tender")
    wheels("t", "tender", (-0.9, 0.9), r=0.75)
    S.bone("car", (0, 0, 0))
    S.box("c_body", (5.4, 2.6, 2.4), (0, ry + 2.8, 0), berry, parent="car", chamfer=0.15)
    S.paint("c_body", stamps=[{"faces": ["left", "right"], "at": "center", "offset": [0, 1],
                               "key": {"w": "lamp:5", "f": "cream:4"},
                               "art": ["fffffffffffffff", "fwwwfwwwfwwwfwf", "fwwwfwwwfwwwfwf", "fffffffffffffff"]}])
    S.box("c_roof", (5.8, 0.5, 2.8), (0, ry + 4.3, 0), plain("cream", tone=4.6), parent="car", chamfer=0.15)
    S.box("c_frame", (5.6, 0.5, 2.2), (0, ry + 1.25, 0), soot, parent="car")
    wheels("c", "car", (-1.6, 1.6), r=0.75)
    T = 14.0
    tracks = []
    for nm, back in (("engine", 0.0), ("tender", 5.4), ("car", 10.4)):
        pk, rk = [], []
        prev = None
        for i in range(49):
            t = T * i / 48
            x, z, h = stadium(per * i / 48 - back, L, R)
            if prev is not None:
                while h - prev > 180:
                    h -= 360
                while h - prev < -180:
                    h += 360
            prev = h
            pk.append([round(t, 4), [round(x, 3), 0, round(z, 3)]])
            rk.append([round(t, 4), round(h, 3)])
        rk[-1][1] = rk[0][1] + 360 * round((rk[-1][1] - rk[0][1]) / 360)
        tracks.append({"part": nm, "channel": "position", "keys": pk, "ease": "linear"})
        tracks.append({"part": nm, "axis": "y", "keys": rk, "ease": "linear"})
    for k in range(3):
        o = k * T / 3
        tracks.append({"part": f"puff{k}", "channel": "position", "ease": "linear",
                       "keys": [[0, [0, -1.0, 0]], [o, [0, -1.0, 0]], [o + 1.8, [-1.6, 2.4, 0]], [o + 1.81, [0, -1.0, 0]],
                                [T, [0, -1.0, 0]]] if o > 0 else
                       [[0, [0, -1.0, 0]], [1.8, [-1.6, 2.4, 0]], [1.81, [0, -1.0, 0]], [T, [0, -1.0, 0]]]})
        tracks.append({"part": f"puff{k}", "channel": "scale", "ease": "linear",
                       "keys": [[0, [-0.5, -0.5, -0.5]], [o, [-0.5, -0.5, -0.5]], [o + 1.8, [0.5, 0.5, 0.5]],
                                [o + 1.81, [-0.5, -0.5, -0.5]], [T, [-0.5, -0.5, -0.5]]] if o > 0 else
                       [[0, [-0.5, -0.5, -0.5]], [1.8, [0.5, 0.5, 0.5]], [1.81, [-0.5, -0.5, -0.5]], [T, [-0.5, -0.5, -0.5]]]})
    tracks.append({"part": "e_key", "keys": [[0, 0], [T, 360 * 6]], "axis": "x", "ease": "linear"})
    S.anim("idle", T, tracks)
    return S


@item
def rocking_horse():
    S = Spec("rocking_horse", "Dapple Rocking Horse", density=2.6, tris=3200,
             desc="Biscuit, a dapple-grey rocking horse on curved walnut rockers: oat yarn mane and tail, a berry "
                  "leather saddle with brass studs, a bridle and wooden handle pegs.")
    wd = wood("walnut", tone=4.4, grain="x")
    for k, z in enumerate((-3.4, 3.4)):
        pts = [(x, 1.0 + (x / 15.0) ** 2 * 3.2, z) for x in [-15.6, -11, -6, 0, 6, 11, 15.6]]
        S.tube(f"rocker{k}", pts, [(0.7, 1.0)] * len(pts), wd, sides=6, up=[0, 0, 1])
        for kk, x in enumerate((-7.0, 7.0)):
            S.tube(f"leg{k}{kk}", [(x * 1.0, 1.2 + (x / 15) ** 2 * 3.2, z), (x * 0.82, 6.0, z * 0.85), (x * 0.7, 9.6, z * 0.55)],
                   0.6, wd, sides=6)
    for kk, x in enumerate((-11.0, 0.0, 11.0)):
        S.tube(f"stretch{kk}", [(x, 1.6 + (x / 15) ** 2 * 3.2, -3.4), (x, 1.6 + (x / 15) ** 2 * 3.2, 3.4)], 0.4, wd, sides=5)
    dapple = {"ramp": "stone", "tone": 4.6, "rim": {"light_shift": 0.8, "dark_shift": -1.0},
              "brush": {"flow": "path", "rough": 0.5}, "layers": [
                  {"id": "dapples", "op": "spots", "count": 26, "radius": [0.5, 0.9], "ramp": "stone", "tone": 5.6,
                   "roughness": 0.3},
                  {"id": "shade", "op": "gradient", "axis": "y", "amount": 0.8},
                  {"id": "gloss", "op": "gloss", "dash": True, "length": 2, "shift": 1.2, "density": 0.4, "post": True}]}
    S.tube("body", [(-7.6, 11.2, 0), (-5.0, 12.0, 0), (0, 12.2, 0), (5.0, 12.2, 0), (7.4, 12.6, 0)],
           [(2.6, 2.8), (3.2, 3.6), (3.4, 3.8), (3.3, 3.7), (2.6, 3.2)], dapple, sides=10, caps=(True, True))
    S.tube("neck", [(5.6, 12.8, 0), (8.0, 15.6, 0), (9.6, 18.6, 0)], [(2.2, 2.6), (1.8, 2.2), (1.6, 2.0)], dapple, sides=8)
    S.tube("head", [(8.6, 19.8, 0), (10.6, 19.6, 0), (12.8, 18.4, 0), (14.0, 17.6, 0)],
           [(1.8, 2.1), (1.7, 2.0), (1.3, 1.6), (1.15, 1.3)], dapple, sides=8)
    S.paint("head", layers=[
        {"id": "eye", "op": "spots", "centers": [[2.4, -0.3, 1.6, 0.42], [2.4, -0.3, -1.6, 0.42]], "ramp": "soot",
         "tone": 0.6, "roughness": 0},
        {"id": "nose", "op": "spots", "centers": [[5.4, -1.5, 0.7, 0.3], [5.4, -1.5, -0.7, 0.3]], "ramp": "soot",
         "tone": 1.4, "roughness": 0},
        {"id": "muzzle", "op": "band", "axis": "x", "from": 0.55, "to": 1.0, "ramp": "stone", "tone": 3.6}])
    ear = ["..a..", ".aba.", ".aba.", "aabaa", "aaaaa"]
    for k, z in enumerate((-0.8, 0.8)):
        S.card(f"ear{k}", ear, (9.4, 21.6, z), flat("stone"), key={"a": "stone:4", "b": "rose:4"}, rot=(0, 70, -10))
    # mane and tail: yarn strands
    mane = Pix(10, 30)
    for y in range(30):
        for x in range(10):
            if x < 4 + int(3 * math.sin(y * 0.4)) + (y % 3):
                mane.set(x, y, "a" if (x + y) % 3 else "b")
    S.card("mane", mane.rows, (7.8, 17.2, 0), flat("oat"), key={"a": "oat:5", "b": "oat:3"}, rot=(0, 0, -36), plane="xy")
    S.card("mane2", mane.rows, (7.8, 17.2, 0), flat("oat"), key={"a": "oat:5", "b": "oat:3"}, rot=(0, 90, -36), plane="yz")
    tail = Pix(12, 26)
    for y in range(26):
        for x in range(12):
            if abs(x - 6 + y * 0.12) < 2.5 + y * 0.12 and (x + y // 2) % 4 != 0:
                tail.set(x, y, "a" if (x + y) % 3 else "b")
    S.card("tail", tail.rows, (-9.4, 9.8, 0), flat("oat"), key={"a": "oat:5", "b": "oat:3"}, rot=(0, 0, 22))
    # saddle, blanket, stirrups, bridle, handle pegs
    S.box("blanket", (6.6, 0.4, 8.2), (-0.6, 15.3, 0), plain("dusk", tone=4.0, layers=[
        {"id": "edge", "op": "band", "axis": "z", "from": 0.8, "to": 1.0, "ramp": "honey", "tone": 4.4}]), chamfer=0.15)
    S.box("saddle", (5.0, 1.4, 5.6), (-0.6, 16.0, 0), plain("berry", tone=3.6, gloss=True, layers=[
        {"id": "studs", "op": "rivets", "inset": 1, "spacing": 4, "ramp": "brass", "tone": 6}]), chamfer=0.6)
    S.box("pommel", (1.2, 1.2, 2.6), (1.8, 16.9, 0), plain("berry", tone=3.4, gloss=True), chamfer=0.4)
    for k, z in enumerate((-4.0, 4.0)):
        S.box(f"strap{k}", (0.6, 4.6, 0.2), (-0.6, 13.4, z), plain("russet", tone=3.4))
        S.tube(f"stirrup{k}", circle((-0.6, 10.6, z), 0.9, 8, "xy"), 0.18, metal("brass"), sides=4, caps=(False, False))
    S.tube("bridle", circle((12.4, 18.6, 0), 1.75, 10, "yz"), 0.2, plain("russet", tone=3.6), sides=4, caps=(False, False))
    S.tube("pegs", [(9.4, 19.8, -2.8), (9.4, 19.8, 2.8)], 0.38, wood("oak", tone=5.0, knots=False), sides=6)
    return S


@item
def music_box():
    S = Spec("music_box", "Owlet Music Box", density=3.4,
             desc="A walnut music box with an inlaid lid propped open on a little mirror, berry velvet inside, a brass "
                  "crank, and a tiny owlet in a lilac tutu pirouetting on her turntable while notes float up.")
    wd = wood("walnut", tone=4.4, grain="x")
    S.box("box", (12.0, 5.0, 9.0), (0, 2.8, 0), wd, chamfer=0.35)
    S.paint("box", layers=[{"id": "inlay", "op": "panel", "inset": 2, "shift": 1.4, "highlight": 1, "shadow": 1,
                            "faces": ["front", "left", "right"]}])
    for k, (x, z) in enumerate([(-5.6, 4.1), (5.6, 4.1), (-5.6, -4.1), (5.6, -4.1)]):
        S.ball(f"foot{k}", 0.55, (x, 0.55, z), metal("brass"), sides=6, rings=3)
    S.box("velvet", (11.0, 0.3, 8.0), (0, 5.2, 0), cloth("berry", tone=3.6, weave=0.3))
    S.box("comb", (4.0, 0.6, 1.6), (-3.4, 5.6, 2.4), metal("brass", tone=4.6, layers=[
        {"id": "teeth", "op": "stripes", "axis": "x", "period": 0.4, "width": 0.4, "shift": -1.0}]))
    S.cyl("drum", 0.7, 3.2, (-5.0, 5.9, 0.8), metal("brass", tone=4.2, layers=[
        {"id": "pins", "op": "spots", "count": 14, "radius": [0.08, 0.12], "ramp": "brass", "tone": 7}]),
        rot=(0, 0, -90), sides=8, caps=(True, True))
    # the lid, hinged at the back, with a mirror and an inlaid star
    S.bone("lid", (0, 5.3, -4.5), rot=(-100, 0, 0))
    S.box("lid_board", (12.0, 0.8, 9.0), S.at("lid", (0, 0.4, 4.5)), wd, parent="lid", chamfer=0.25)
    S.box("mirror", (9.4, 0.2, 6.4), S.at("lid", (0, -0.1, 4.5)), {
        "ramp": "silver", "tone": 4.6, "light": 0.4, "brush": {"off": True}, "rim": {"light": 0, "dark": 0}, "layers": [
            {"id": "streak", "op": "stripes", "axis": [1, 0, 1], "period": 4.0, "width": 0.15, "ramp": "silver", "tone": 7}]},
        parent="lid")
    S.paint("lid_board", stamps=[{"face": "bottom", "at": "center", "key": {"s": "honey:5", "S": "honey:3"},
                                  "art": ["....s....", "...sSs...", "sssSSSsss", ".sSSSSSs.", "..sSsSs..", ".sS...Ss."]}])
    S.box("frame_mirror", (10.4, 0.25, 7.4), S.at("lid", (0, -0.02, 4.5)), metal("gold", tone=4.4), parent="lid")
    # turntable and dancer
    S.cyl("table", 1.8, 0.5, (2.0, 5.3, 0.6), metal("brass", tone=4.8), sides=12)
    S.bone("dancer", (2.0, 5.8, 0.6))
    feath = plain("cream", tone=4.6, layers=[
        {"id": "breast", "op": "scales", "shape": "round", "along": "x", "size": [0.5, 0.4], "gap": 0.7, "highlight": 0.5,
         "shadow": -0.6}])
    S.lathe("tutu", [(0.6, 0.6), (2.2, 1.1), (2.3, 1.35), (0.8, 1.5)], (2.0, 5.8, 0.6), plain("lilac", tone=4.6, layers=[
        {"id": "pleats", "op": "stripes", "axis": "around", "period": 0.0833, "width": 0.5, "shift": 0.7}]),
        parent="dancer", sides=12, caps=(True, True))
    S.ball("d_body", 1.05, (2.0, 7.3, 0.6), feath, parent="dancer", sides=8, rings=5, squash=(1, 1.2, 1))
    S.ball("d_head", 1.0, (2.0, 9.3, 0.6), plain("cream", tone=4.8, layers=[
        {"id": "eyes", "op": "spots", "centers": [[-0.42, 1.05, 0.88, 0.2], [0.42, 1.05, 0.88, 0.2]], "ramp": "soot",
         "tone": 0.3, "roughness": 0}]), parent="dancer", sides=8, rings=5)
    S.card("d_beak", ["a", "a"], (2.0, 9.15, 1.62), flat("honey"), key={"a": "honey:4"}, parent="dancer")
    for k, s in enumerate((-1, 1)):
        S.card(f"d_tuft{k}", ["a.", "aa"], (2.0 + s * 0.6, 10.3, 0.6), flat("cream"), key={"a": "cream:4"}, parent="dancer")
        S.card(f"d_wing{k}", ["aa.", "aaa", ".aa", "..a"], (2.0 + s * 1.5, 8.3, 0.6), flat("cream"), key={"a": "lilac:5"},
               parent="dancer", rot=(0, 0, s * 50), pivot=(2.0 + s * 0.9, 8.0, 0.6))
    # crank on the side
    S.bone("crank", (6.2, 3.0, 0))
    S.tube("crank_arm", [(6.2, 3.0, 0), (7.0, 3.0, 0), (7.0, 4.6, 0)], 0.22, metal("brass", tone=5.0), parent="crank", sides=4)
    S.ball("crank_knob", 0.45, (7.4, 4.6, 0), plain("cream", tone=4.4, gloss=True), parent="crank", sides=6, rings=3)
    # notes drifting up
    note = ["..aa", "..ab", "..a.", "..a.", "aaa.", "aaa."]
    tracks = [{"part": "dancer", "keys": [[0, 0], [4.0, 360]], "axis": "y", "ease": "linear"},
              {"part": "crank", "keys": [[0, 0], [4.0, 720]], "axis": "x", "ease": "linear"},
              {"part": "d_wing0", "osc": {"axis": "z", "amp": 10, "cycles": 4}},
              {"part": "d_wing1", "osc": {"axis": "z", "amp": 10, "cycles": 4, "phase": 0.5}}]
    for k in range(2):
        nm = f"glow_note{k}"
        S.card(nm, note, (-2.0 + k * 1.6, 7.0, 1.0), glow("honey"), key={"a": "honey:6", "b": "honey:4"})
        o = k * 2.0
        tracks.append({"part": nm, "channel": "position", "ease": "linear",
                       "keys": [[0, [0, -2, 0]], [o, [0, -2, 0]], [o + 1.98, [-1.2 + k * 2.4, 4.0, 0]], [4.0, [0, -2, 0]]] if o > 0 else
                       [[0, [0, -2, 0]], [2.0, [-1.2, 4.0, 0]], [2.01, [0, -2, 0]], [4.0, [0, -2, 0]]]})
        tracks.append({"part": nm, "channel": "scale", "ease": "linear",
                       "keys": [[0, [-1, -1, -1]], [o, [-1, -1, -1]], [o + 0.3, [0, 0, 0]], [o + 1.7, [0, 0, 0]],
                                [4.0, [-1, -1, -1]]] if o > 0 else
                       [[0, [-1, -1, -1]], [0.3, [0, 0, 0]], [1.7, [0, 0, 0]], [2.0, [-1, -1, -1]], [4.0, [-1, -1, -1]]]})
    S.anim("idle", 4.0, tracks)
    return S


def moth_px(p, x, y, c="m", d="n"):
    p.set(x, y, d)
    p.set(x, y + 1, d)
    for dx in (-2, -1, 1, 2):
        p.set(x + dx, y, c)
        p.set(x + dx, y + 1, c if abs(dx) == 1 else ".")


@item
def moth_arcade():
    S = Spec("moth_arcade", "Moth Catcher Arcade", density=2.6, tris=3200,
             desc="A tall arcade cabinet in midnight blue with gold trim: a glowing marquee, side art of moths round a "
                  "moonlit lamp, a screen where little moths flutter toward the lamp, a joystick, two buttons and "
                  "glowing coin slots.")
    navy = plain("navy", tone=3.4, layers=[
        {"id": "chips", "op": "wear", "width": 1, "density": 0.12, "ramp": "walnut", "tone": 3}])
    trim = metal("gold", tone=4.6)
    S.box("base", (15.0, 16.0, 12.0), (0, 8.0, -0.5), navy, chamfer=0.3)
    S.box("kick", (14.0, 2.0, 0.4), (0, 1.0, 5.6), plain("soot", tone=2.0, noise=0.2))
    slots = Pix(20, 8)
    for k, x in enumerate((4, 14)):
        slots.rect(x - 3, 0, x + 3, 7, "f")
        slots.rect(x - 2, 1, x + 2, 6, "p")
        slots.rect(x, 2, x, 5, "g")
    S.card("glow_slots", slots.rows, (0, 7.0, 5.62), glow("ember"), key={"f": "gold:3", "p": "berry:2", "g": "ember:5"})
    S.taper("panel", (15.0, 2.4, 5.0), (0, 16.6, 3.6), navy, front_scale=[1, 0.5], front_shift=[0, -0.6], chamfer=0.3)
    S.cyl("stick", 0.22, 2.2, (-3.0, 17.4, 3.4), metal("silver", tone=4.0, tarnish=False), sides=5)
    S.ball("stick_ball", 0.75, (-3.0, 19.7, 3.4), plain("holly", tone=4.0, gloss=True), sides=8, rings=4)
    for k, (x, r) in enumerate([(1.8, "honey"), (4.2, "lake")]):
        S.cyl(f"button{k}", 0.75, 0.6, (x, 17.4, 3.6), plain(r, tone=4.4, gloss=True), sides=8)
    S.box("upper", (15.0, 19.0, 8.0), (0, 27.4, -2.5), navy, chamfer=0.3)
    S.box("bezel", (13.0, 12.0, 0.6), (0, 26.0, 1.6), plain("soot", tone=1.8, noise=0.2), rot=(-8, 0, 0), chamfer=0.2)
    # the screen: night sky, a lamp at the top, moths
    sc = Pix(28, 26)
    for y in range(26):
        for x in range(28):
            sc.set(x, y, "a" if y > 6 else "b")
            if hsh(x, y, 4) > 0.96:
                sc.set(x, y, "s")
    sc.disc(14, 4, 3.6, "l")
    sc.disc(14, 4, 2.0, "L")
    sc.rect(13, 0, 15, 1, "f")
    for k in range(4):
        sc.line(14, 4, 14 + math.cos(k * 1.57 + 0.78) * 6, 4 + math.sin(k * 1.57 + 0.78) * 6, "r")
    sc.rect(0, 23, 27, 25, "g")
    for x in range(2, 10):
        if x % 2:
            sc.set(x, 24, "t")
    sc.disc(5, 15, 2.6, "n", ry=1.6)
    S.card("glow_screen", sc.rows, (0, 26.0, 1.95), glow("night", tone=3.0), rot=(-8, 0, 0),
           key={"a": "night:2", "b": "night:3", "s": "star:3", "l": "bulb:3", "L": "bulb:5", "f": "gold:4", "r": "bulb:2",
                "g": "moss:2", "t": "honey:5", "n": "lilac:3"})
    tracks = []
    for k in range(3):
        nm = f"glow_moth{k}"
        S.card(nm, ["a.b.a", "aabaa", ".a.a."], (-4.0 + k * 4, 24.0, 2.2), glow("lilac"), rot=(-8, 0, 0),
               key={"a": "lavender:5", "b": "plum:2"})
        o = k / 3
        pts = [[(i / 6) * 3.0, [math.sin((i / 6 + o) * 6.28) * 2.5, (math.cos((i / 6 + o) * 12.56) + 1) * 1.6 + (i % 2) * 0.4, 0]]
               for i in range(7)]
        pts[-1][1] = pts[0][1]
        tracks.append({"part": nm, "channel": "position", "keys": pts, "ease": "smooth"})
    S.box("marquee_box", (15.4, 4.0, 9.0), (0, 38.0, -2.0), navy, chamfer=0.3)
    mq = Pix(36, 9)
    mq.rect(0, 0, 35, 8, "b")
    mq.rect(1, 1, 34, 7, "a")
    for k, x in enumerate(range(4, 33, 4)):
        mq.rect(x, 3, x + 2, 5, "t" if k % 2 else "T")
    mq.disc(2.5, 4.5, 1.2, "m")
    mq.disc(33.5, 4.5, 1.2, "m")
    S.card("glow_marquee", mq.rows, (0, 38.0, 2.55), glow("bulb", tone=4.0), key={"a": "bulb:4", "b": "gold:3",
                                                                                   "t": "berry:2", "T": "night:2",
                                                                                   "m": "lilac:3"})
    # side art: moths round a moonlit lamp
    for k, s in enumerate((-1, 1)):
        side = Pix(30, 46)
        side.disc(15, 12, 6, "l")
        side.disc(15, 12, 3.4, "L")
        for m in range(6):
            moth_px(side, 4 + int(hsh(m, 1) * 22), 4 + int(hsh(m, 2) * 36))
        side.path([(0, 46), (8, 38), (16, 40), (30, 30)], "g", 2)
        S.card(f"side{k}", side.rows, (s * 7.56, 21.0, -0.5), flat("navy"), plane="yz",
               key={"l": "honey:5", "L": "lamp:6" if False else "honey:7", "m": "lilac:5", "n": "plum:2", "g": "moss:3"})
    for k, s in enumerate((-1, 1)):
        S.box(f"tmold{k}", (0.4, 15.6, 0.5), (s * 7.6, 8.0, 5.4), trim)
        S.box(f"tmoldu{k}", (0.4, 19.0, 0.5), (s * 7.6, 27.4, 1.4), trim)
    S.anim("idle", 3.0, tracks + [{"part": "stick_ball", "channel": "position", "osc": {"axis": "x", "amp": 0.3, "cycles": 3}}])
    return S


@item
def hamster_wheel():
    S = Spec("hamster_wheel", "Dormouse Exercise Wheel", density=3.0,
             desc="Clover the dormouse's wheel: a pale wooden A-frame on a little base, a slatted wheel that spins for "
                  "about four steps, a seed bowl and a straw nest. Clover bobs along, then dozes.")
    pale = wood("pale", tone=4.6, grain="y")
    S.box("base", (15.0, 1.0, 10.0), (0, 0.5, 0), wood("oak", tone=4.2, grain="x"), chamfer=0.3)
    for k, z in enumerate((-3.4, 3.4)):
        S.tube(f"a{k}0", [(-4.0, 1.0, z), (0, 8.2, z)], 0.45, pale, sides=5)
        S.tube(f"a{k}1", [(4.0, 1.0, z), (0, 8.2, z)], 0.45, pale, sides=5)
    S.tube("axle", [(0, 8.2, -3.8), (0, 8.2, 3.8)], 0.35, metal("brass"), sides=6)
    S.bone("wheel", (0, 8.2, 0))
    for k, z in enumerate((-2.6, 2.6)):
        S.tube(f"rim{k}", circle((0, 8.2, z), 5.6, 16, "xy"), 0.35, pale, parent="wheel", sides=5, caps=(False, False))
        for j in range(4):
            a = j * math.pi / 2 + 0.3
            S.tube(f"spoke{k}{j}", [(0, 8.2, z), (math.cos(a) * 5.4, 8.2 + math.sin(a) * 5.4, z)], 0.2, pale,
                   parent="wheel", sides=4)
    for j in range(16):
        a = j * math.pi / 8
        S.box(f"rung{j}", (0.45, 0.25, 5.2), (math.cos(a) * 5.55, 8.2 + math.sin(a) * 5.55, 0),
              plain("woodPale" if False else "pale", tone=4.2, noise=0.3), parent="wheel", rot=(0, 0, math.degrees(a)))
    # Clover the dormouse, running at the bottom of the wheel
    S.bone("mouse", (0, 3.2, 0))
    fur = plain("tawny", tone=4.4, layers=[{"id": "belly", "op": "band", "axis": "y", "from": -1, "to": -0.3,
                                             "ramp": "cream", "tone": 4.6}])
    S.ball("m_body", 1.5, (0, 4.2, 0), fur, parent="mouse", sides=8, rings=5, squash=(1.35, 0.9, 1))
    S.ball("m_head", 1.05, (1.8, 4.6, 0), plain("tawny", tone=4.6, layers=[
        {"id": "eye", "op": "spots", "centers": [[0.55, 1.2, 0.75, 0.2], [0.55, 1.2, -0.75, 0.2]], "ramp": "soot",
         "tone": 0.3, "roughness": 0}]), parent="mouse", sides=8, rings=4)
    for k, z in enumerate((-0.7, 0.7)):
        S.ball(f"m_ear{k}", 0.5, (1.6, 5.7, z), plain("blush", tone=4.0), parent="mouse", sides=6, rings=3,
               squash=(0.6, 1, 1))
    S.tube("m_tail", [(-1.8, 4.0, 0), (-3.0, 4.6, 0), (-3.6, 6.0, 0), (-3.0, 7.0, 0)], [0.5, 0.6, 0.6, 0.35],
           plain("tawny", tone=4.0, layers=[{"id": "fluff", "op": "noise", "scale": 0.5, "amount": 0.8}]), parent="mouse",
           sides=6)
    # seed bowl and a straw nest
    S.lathe("bowl", [(0.9, 0), (1.5, 0.4), (1.7, 1.0)], (5.6, 1.0, 3.2), glaze("terracotta", crackle=False), sides=10)
    S.paint("bowl", layers=[{"id": "seeds", "op": "spots", "centers": [[0, 1.0, 0, 1.4]], "ramp": "buff", "tone": 4.6,
                             "faces": ["end"]}])
    S.lathe("nest", [(2.2, 0), (2.4, 0.8), (1.6, 1.6), (0.2, 1.9)], (-5.4, 1.0, 2.6), plain("straw", tone=4.0, layers=[
        {"id": "straws", "op": "stripes", "axis": [1, 1, 0.3], "period": 0.6, "width": 0.3, "shift": -0.9, "wobble": 0.8}]),
        sides=10)
    S.anim("idle", 8.0, [
        {"part": "wheel", "keys": [[0, 0], [2.4, -260, "out"], [8.0, -260]], "axis": "z"},
        {"part": "mouse", "channel": "position", "keys": [[0, [0, 0, 0]], [0.3, [0, 0.4, 0]], [0.6, [0, 0, 0]], [0.9, [0, 0.4, 0]],
                                                          [1.2, [0, 0, 0]], [1.5, [0, 0.3, 0]], [1.8, [0, 0, 0]], [8.0, [0, 0, 0]]]},
        {"part": "mouse", "keys": [[0, 0], [2.0, 0], [2.6, -8], [7.4, -8], [8.0, 0]], "axis": "z"},
        {"part": "m_head", "keys": [[0, 0], [2.4, 0], [3.0, -18], [7.4, -18], [8.0, 0]], "axis": "z"},
    ])
    return S


@item
def bird_feeder():
    S = Spec("bird_feeder", "Bluebird Feeder", density=3.0,
             desc="A little seed house on an oak post with a mossy shingle roof, a glass seed hopper, perches and "
                  "spilled seed, ivy climbing the post, and Sid the bluebird hopping and pecking.")
    oak = wood("oak", tone=4.4, grain="y")
    S.box("foot_a", (10.0, 1.2, 1.6), (0, 0.6, 0), oak, chamfer=0.3)
    S.box("foot_b", (1.6, 1.2, 10.0), (0, 0.6, 0), oak, chamfer=0.3)
    S.box("post", (1.8, 22.0, 1.8), (0, 12.0, 0), oak, chamfer=0.3)
    for k, (dx, dz, ry) in enumerate([(1, 0, 0), (-1, 0, 180), (0, 1, 270), (0, -1, 90)]):
        S.taper(f"brace{k}", (0.8, 0.8, 3.6), (dx * 1.8, 2.4, dz * 1.8), oak, rot=(-45, ry - 90, 0),
                front_scale=[1, 1])
    S.box("tray", (10.0, 0.8, 10.0), (0, 23.4, 0), oak, chamfer=0.2)
    for k, (w, d, x, z) in enumerate([(10, 0.6, 0, 4.7), (10, 0.6, 0, -4.7), (0.6, 10, 4.7, 0), (0.6, 10, -4.7, 0)]):
        S.box(f"lip{k}", (w, 1.0, d), (x, 24.2, z), oak)
    S.box("seeds", (8.8, 0.3, 8.8), (0, 23.9, 0), {"ramp": "buff", "tone": 4.2, "layers": [
        {"id": "seeds", "op": "scales", "shape": "round", "along": "x", "size": [0.45, 0.35], "gap": 0.6, "highlight": 1.0,
         "shadow": -1.0},
        {"id": "sun", "op": "spots", "count": 14, "radius": [0.15, 0.25], "ramp": "soot", "tone": 2}]})
    S.box("glass_hopper", (4.6, 6.0, 4.6), (0, 27.6, 0), glass(), double_sided=True)
    S.box("hopper_seed", (4.2, 3.6, 4.2), (0, 26.2, 0), {"ramp": "buff", "tone": 4.0, "layers": [
        {"id": "seeds", "op": "scales", "shape": "round", "along": "x", "size": [0.45, 0.35], "gap": 0.6, "highlight": 1.0,
         "shadow": -1.0}]})
    for k, s in enumerate((-1, 1)):
        S.box(f"roof{k}", (7.6, 0.7, 11.4), (s * 3.0, 32.2, 0), {"ramp": "walnut", "tone": 3.6, "layers": [
            {"id": "shingles", "op": "scales", "shape": "square", "along": "z", "size": [1.2, 1.0], "gap": 0.7,
             "highlight": 0.8, "shadow": -1.1, "jitter": 0.6},
            {"id": "moss", "op": "drip", "ramp": "moss", "tone": 4.2, "depth": 0.15, "length": 0.3, "width": 0.5,
             "scale": 1.0}]}, rot=(0, 0, -s * 34), chamfer=0.15)
    S.box("gable_f", (5.0, 2.6, 0.4), (0, 31.4, 4.6), oak)
    S.box("gable_b", (5.0, 2.6, 0.4), (0, 31.4, -4.6), oak)
    S.tube("perch", [(-6.0, 24.6, 3.6), (6.0, 24.6, 3.6)], 0.25, wood("pale", tone=4.6, knots=False), sides=5)
    # ivy up the post
    d = S.density * HD
    for k in range(9):
        y = 2.6 + k * 2.2
        s = 1 if k % 2 else -1
        S.card(f"ivy{k}", leaf_cluster(round(2.4 * d), round(2.4 * d), seed=k, leaves=4, shape="round"),
               (s * 1.05, y, 0.95 - (k % 3) * 0.5), card_style("leaf", 0.8), key=LEAF_KEY, native=True,
               rot=(0, 90 * s, 0))
    S.tube("ivy_vine", [(0.95, 2.0, 0.95), (-0.95, 6.0, 0.6), (0.95, 10.0, 0.0), (-0.95, 14.0, -0.5), (0.95, 19.0, 0.4)],
           0.12, plain("leaf", tone=2.8), sides=3)
    # Sid the bluebird on the tray edge: body, head, beak, tail, wings
    S.bone("bird", (2.0, 24.8, 3.6))
    S.bone("bird_head", (2.9, 26.4, 3.6), parent="bird")
    blue = plain("dusk", tone=4.6, layers=[{"id": "breast", "op": "band", "axis": "x", "from": 0.2, "to": 1.0,
                                            "ramp": "terracotta", "tone": 4.6, "wobble": 0.2}])
    S.ball("b_body", 1.3, (2.0, 25.8, 3.6), blue, parent="bird", sides=8, rings=5, squash=(1.25, 1, 0.95))
    S.ball("b_head", 0.95, (3.1, 26.9, 3.6), plain("dusk", tone=4.8, layers=[
        {"id": "eye", "op": "spots", "centers": [[0.45, 1.05, 0.72, 0.18], [0.45, 1.05, -0.72, 0.18]], "ramp": "soot",
         "tone": 0.2, "roughness": 0}]), parent="bird_head", sides=8, rings=4)
    S.taper("b_beak", (0.45, 0.4, 0.9), (4.25, 26.8, 3.6), plain("ochre", tone=3.4), parent="bird_head", rot=(0, 90, 0),
            front_scale=[0.2, 0.2])
    S.card("b_tail", ["aaa.", "aaaa", ".aab", "..ab"], (0.4, 25.9, 3.6), flat("dusk"), key={"a": "dusk:3", "b": "dusk:5"},
           parent="bird", rot=(0, 0, 25))
    for k, z in enumerate((2.45, 4.75)):
        S.card(f"b_wing{k}", ["aaaa.", ".aaab", "..abb"], (1.8, 26.0, z), flat("dusk"),
               key={"a": "dusk:5", "b": "dusk:3"}, parent="bird")
    S.anim("idle", 5.0, [
        {"part": "bird_head", "keys": [[0, 0], [0.6, 0], [0.75, 38], [0.9, 0], [1.05, 38], [1.2, 0], [3.0, 0], [3.2, -10],
                                       [3.8, 10], [4.4, 0], [5.0, 0]], "axis": "z"},
        {"part": "bird", "channel": "position", "keys": [[0, [0, 0, 0]], [1.8, [0, 0, 0]], [2.0, [-0.8, 0.9, 0], "out"],
                                                         [2.2, [-1.6, 0, 0], "in"], [4.2, [-1.6, 0, 0]],
                                                         [4.4, [-0.8, 0.9, 0], "out"], [4.6, [0, 0, 0], "in"], [5.0, [0, 0, 0]]]},
        {"part": "bird", "channel": "scale", "keys": [[0, [0, 0, 0]], [2.2, [0, 0, 0]], [2.3, [0.08, -0.12, 0.08]],
                                                      [2.45, [0, 0, 0]], [5.0, [0, 0, 0]]]},
    ])
    return S
