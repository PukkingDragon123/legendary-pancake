"""The Starfall Dreams series (gacha prizes): wishes that fell from the sky and landed in the hollow. Star projector,
crescent moon bed, brass telescope, jar of fallen stars, planet mobile, sleepy cloud pouf and comet rug."""
import math

from lib import Spec, bezier, circle, cloth, cycle_keys, glass, glaze, glow, hsh, knit, leafy, metal, paper, plain, wood
from pix import Pix, star_pts

ITEMS = {}


def item(f):
    ITEMS[f.__name__] = f
    return f


def flat(r, tone=4.0, light=0.6):
    return {"ramp": r, "tone": tone, "light": light, "brush": {"off": True}, "rim": {"light": 0, "dark": 0}}


def star_card(n, inner=0.45, shade=True):
    p = Pix(n, n)
    c = n / 2
    p.star(c, c, n / 2, "a", inner=inner)
    if shade:
        for y in range(n):
            for x in range(n):
                if p.get(x, y) != ".":
                    a = (math.degrees(math.atan2(y + 0.5 - c, x + 0.5 - c)) + 90) % 72
                    p.set(x, y, "a" if a < 36 else "b")
    p.disc(c, c, max(1, n / 7), "c")
    return p.rows


def starry_quilt(r="navy", tone=3.6):
    return cloth(r, tone=tone, weave=0.45, layers=[
        {"id": "stars", "op": "spots", "count": 40, "radius": [0.2, 0.35], "ramp": "star", "tone": 3.6, "roughness": 0.9,
         "rough_scale": 0.25},
        {"id": "dust", "op": "spots", "count": 40, "radius": [0.1, 0.15], "ramp": "lavender", "tone": 5},
        {"id": "quilting", "op": "stripes", "axis": [1, 0, 1], "period": 3.0, "width": 0.06, "shift": -1.0},
        {"id": "quilting2", "op": "stripes", "axis": [1, 0, -1], "period": 3.0, "width": 0.06, "shift": -1.0}])


# ====================================================================== orrery star projector

@item
def star_projector():
    S = Spec("star_projector", "Orrery Star Projector", density=3.0, tris=3000,
             desc="A brass orrery lamp on a walnut base with little gears: a candle-bright core inside a pierced "
                  "midnight dome that turns slowly, sprinkling stars, ringed by a gold equator, two meridian arcs with "
                  "tiny planets, and a crescent moon on top.")
    wd = wood("walnut", tone=4.4, grain="x")
    S.lathe("base", [(5.6, 0.6), (5.8, 1.2), (5.2, 2.6), (4.2, 3.2), (3.8, 3.6)], (0, 0, 0), wd, sides=14, subdiv=0)
    for k in range(3):
        a = math.radians(k * 120 + 90)
        S.ball(f"foot{k}", 0.75, (math.cos(a) * 4.8, 0.6, math.sin(a) * 4.8), metal("brass"), sides=6, rings=3)
    gear = Pix(14, 14)
    gear.disc(7, 7, 6.2, "g")
    for k in range(10):
        a = k * math.pi / 5
        gear.disc(7 + math.cos(a) * 6.4, 7 + math.sin(a) * 6.4, 1.1, "g")
    gear.ring(7, 7, 4.2, "d", 0.9)
    gear.disc(7, 7, 1.4, "d")
    for k in range(5):
        a = k * math.pi * 2 / 5
        gear.line(7 + math.cos(a) * 1.6, 7 + math.sin(a) * 1.6, 7 + math.cos(a) * 3.8, 7 + math.sin(a) * 3.8, "d")
    S.bone("gearj0", (-1.6, 2.2, 4.75))
    S.bone("gearj1", (1.3, 2.4, 4.6))
    S.card("gear0", gear.rows, (-1.6, 2.2, 4.75), flat("brass"), parent="gearj0", key={"g": "brass:6", "d": "brass:2"},
           rot=(0, 18, 0))
    S.card("gear1", [r[2:-2] for r in gear.rows[2:-2]], (1.3, 2.4, 4.6), flat("brass"), parent="gearj1", key={"g": "gold:5", "d": "brass:2"},
           rot=(0, -14, 0))
    S.lathe("column", [(1.2, 3.6), (0.9, 4.6), (0.8, 6.6), (1.6, 7.2), (2.4, 7.6)], (0, 0, 0), metal("brass", tone=4.6),
            sides=10)
    cy = 12.6
    S.ball("glow_core", 2.6, (0, cy, 0), glow("flame", tone=4.6), sides=10, rings=6)
    # the pierced dome, turning: midnight blue with glowing star holes
    S.bone("dome", (0, cy, 0))
    dome = glow("navy", tone=2.6, layers=[
        {"id": "holes", "op": "spots", "count": 46, "radius": [0.25, 0.42], "ramp": "star", "tone": 4.6, "roughness": 0},
        {"id": "big", "op": "spots", "count": 10, "radius": [0.5, 0.65], "ramp": "star", "tone": 3.6, "roughness": 0.9,
         "rough_scale": 0.2},
        {"id": "seam", "op": "stripes", "axis": "around", "period": 0.125, "width": 0.06, "ramp": "gold", "tone": 3.6}])
    S.lathe("glow_dome", [(5.2, 0), (5.3, 0.6), (5.0, 2.4), (4.0, 4.2), (2.4, 5.6), (0.4, 6.4)], (0, cy - 0.2, 0), dome,
            parent="dome", sides=14, caps=(False, True))
    S.lathe("glow_bowl", [(1.6, -3.4), (3.6, -2.4), (4.9, -0.8), (5.2, 0)], (0, cy - 0.2, 0), dome, parent="dome", sides=14,
            caps=(True, False))
    S.tube("equator", circle((0, cy - 0.2, 0), 6.4, 18, "xz"), 0.42, metal("gold", tone=4.8), sides=5, caps=(False, False))
    for k in range(3):
        a = math.radians(k * 120 + 30)
        S.tube(f"strut{k}", [(math.cos(a) * 2.0, 7.4, math.sin(a) * 2.0), (math.cos(a) * 5.2, 9.0, math.sin(a) * 5.2),
                             (math.cos(a) * 6.4, cy - 0.2, math.sin(a) * 6.4)], 0.3, metal("brass", tone=4.4), sides=5)
    # meridian arcs carrying two little planets, turning with the dome
    S.tube("arc0", circle((0, cy, 0), 7.6, 12, "xy", -60, 240, closed=False), 0.28, metal("gold", tone=4.6), parent="dome",
           sides=5)
    S.ball("planet0", 0.9, (7.6 * math.cos(math.radians(-60)), cy + 7.6 * math.sin(math.radians(-60)), 0), plain("terracotta",
           tone=4.6, gloss=True), parent="dome", sides=7, rings=4)
    S.ball("planet1", 1.1, (7.6 * math.cos(math.radians(240)), cy + 7.6 * math.sin(math.radians(240)), 0), plain("lake", tone=4.4,
           gloss=True, layers=[{"id": "land", "op": "patches", "scale": 0.6, "threshold": 0.6, "ramp": "sage", "tone": 4}]),
           parent="dome", sides=7, rings=4)
    S.cyl("finial", 0.35, 2.6, (0, cy + 6.0, 0), metal("gold", tone=4.6), parent="dome", sides=5)
    moon = Pix(14, 14)
    moon.disc(7, 7, 7, "m")
    moon.disc(10, 5.5, 6, ".")
    moon.map(lambda x, y, c: ("M" if c == "m" and x + y < 9 else c))
    S.card("glow_moon", moon.rows, (0, cy + 10.4, 0), glow("star"), parent="dome", key={"m": "star:3", "M": "star:4"})
    S.card("glow_moon2", moon.rows, (0, cy + 10.4, 0), glow("star"), parent="dome", key={"m": "star:3", "M": "star:4"},
           rot=(0, 90, 0))
    S.anim("idle", 12.0, [
        {"part": "dome", "keys": [[0, 0], [12.0, 360]], "axis": "y", "ease": "linear"},
        {"part": "gearj0", "keys": [[0, 0], [12.0, 720]], "axis": "z", "ease": "linear"},
        {"part": "gearj1", "keys": [[0, 0], [12.0, -1080]], "axis": "z", "ease": "linear"},
        {"part": "glow_core", "channel": "scale", "osc": {"amp": [0.06, 0.06, 0.06], "cycles": 6}},
    ])
    return S


# ====================================================================== crescent moon bed

@item
def moon_bed():
    S = Spec("moon_bed", "Crescent Moon Bed", density=2.0, tris=3600,
             desc="A cradle carved as a crescent moon, cream-gold and cratered, resting on two cloud puffs: a lavender "
                  "mattress, a midnight quilt of stars, cloud pillows, a honey throw, and three wishing stars dangling "
                  "from the high tip.")
    cx, cyc, R = 0.0, 27.0, 23.0
    a0, a1 = 172.0, 322.0
    pts, sizes = [], []
    n = 14
    for i in range(n + 1):
        t = i / n
        a = math.radians(a0 + (a1 - a0) * t)
        th = 0.8 + 6.2 * math.sin(math.pi * t) ** 0.8
        rr = R - th / 2
        pts.append((cx + math.cos(a) * rr, cyc + math.sin(a) * rr, 0))
        sizes.append((th / 2, 10.4 - 2.0 * (1 - math.sin(math.pi * t))))
    moon = {"ramp": "cream", "tone": 4.6, "rim": {"light_shift": 1.0, "dark_shift": -1.0}, "brush": {"flow": "path", "rough": 0.5},
            "layers": [
                {"id": "glowedge", "op": "gradient", "axis": "y", "amount": 0.6},
                {"id": "craters", "op": "spots", "count": 16, "radius": [0.6, 1.4], "ring": 0.7, "ramp": "linen", "tone": 3.0,
                 "centre_shift": -0.6, "roughness": 0.2},
                {"id": "dust", "op": "spots", "count": 30, "radius": [0.15, 0.3], "ramp": "honey", "tone": 5},
                {"id": "gilt", "op": "stripes", "axis": "path", "period": 6.0, "width": 0.05, "ramp": "gold", "tone": 5}]}
    S.tube("moon", pts, sizes, moon, sides=10, round=3.0, up=[0, 0, 1])
    for k, x in enumerate((-8.0, 8.0)):
        for j, (dx, r) in enumerate([(-1.6, 2.2), (1.4, 2.6), (0.0, 3.0)]):
            S.ball(f"cloud{k}{j}", r, (x + dx, r * 0.8, (j - 1) * 3.0), plain("snow", tone=5.0, layers=[
                {"id": "shade", "op": "gradient", "axis": "y", "amount": 1.2},
                {"id": "lilac", "op": "band", "axis": "y", "from": -1, "to": -0.4, "ramp": "lavender", "tone": 4}]),
                sides=8, rings=5, squash=(1.2, 0.8, 1.0))
    # mattress, quilt, pillows and throw inside the curve
    S.box("mattress", (22.0, 3.0, 18.4), (0, 9.6, 0), cloth("lavender", tone=4.6, weave=0.5, layers=[
        {"id": "tufts", "op": "spots", "count": 16, "radius": [0.2, 0.3], "ramp": "lilac", "tone": 3, "faces": ["up"]}]),
        chamfer=1.0)
    S.box("quilt", (17.0, 1.4, 18.8), (3.0, 11.6, 0), starry_quilt(), chamfer=0.6)
    S.box("throw", (4.4, 1.2, 19.0), (9.0, 12.6, 0), cloth("honey", tone=4.6, weave=0.4, layers=[
        {"id": "fringe", "op": "stripes", "axis": "z", "period": 0.8, "width": 0.4, "shift": -0.8, "faces": ["left", "right"]}]),
        chamfer=0.5)
    fluff = plain("snow", tone=5.2, layers=[{"id": "shade", "op": "gradient", "axis": "y", "amount": 1.0},
                                           {"id": "lilac", "op": "patches", "scale": 1.0, "threshold": 0.7, "ramp": "lavender",
                                            "tone": 4}])
    for k, z in enumerate((-4.4, 4.4)):
        for j, (dx, dz, r) in enumerate([(0, 0, 2.6), (1.4, 1.8, 1.8), (-1.2, -1.8, 2.0)]):
            S.ball(f"pillow{k}{j}", r, (-9.0 + dx, 12.2, z + dz), fluff, sides=8, rings=5, squash=(1.0, 0.7, 1.0))
    # three wishes dangling from the high tip, swaying
    tip = pts[1]
    tracks = []
    for k, (dx, L, rmp) in enumerate([(0.4, 6.0, "star"), (2.2, 9.0, "star"), (-1.4, 4.0, "moonglow")]):
        S.bone(f"wish{k}", (tip[0] + dx, tip[1] - 0.6, 0.6 * (k - 1)))
        S.box(f"thread{k}", (0.12, L, 0.12), (tip[0] + dx, tip[1] - 0.6 - L / 2, 0.6 * (k - 1)), plain("cream", tone=5, noise=0),
              parent=f"wish{k}")
        S.card(f"glow_wish{k}", star_card(9), (tip[0] + dx, tip[1] - 0.6 - L - 1.4, 0.6 * (k - 1)), glow(rmp),
               parent=f"wish{k}", key={"a": f"{rmp}:4", "b": f"{rmp}:2", "c": f"{rmp}:4"}, rot=(0, k * 40, 0))
        tracks.append({"part": f"wish{k}", "osc": {"axis": "z", "amp": 5, "cycles": 1, "phase": k * 0.3}})
        tracks.append({"part": f"wish{k}", "osc": {"axis": "y", "amp": 25, "cycles": 1, "phase": k * 0.2}})
    S.anim("idle", 5.0, tracks)
    return S


# ====================================================================== brass telescope

@item
def telescope_brass():
    S = Spec("telescope_brass", "Stargazer's Brass Telescope", density=2.6, tris=3200,
             desc="A polished brass refractor on a cherry-wood tripod with brass feet and a chain-hung tray: leather "
                  "grip, gold rings, a finder scope, a dew shield with a glinting lens, and a rolled star chart. It "
                  "drifts slowly across the sky, looking for wishes.")
    cherry = wood("cherry", tone=4.4, grain="y")
    top = (0, 14.4, 0)
    feet = []
    for k in range(3):
        a = math.radians(k * 120 + 30)
        f = (math.cos(a) * 7.2, 0.0, math.sin(a) * 7.2)
        feet.append(f)
        S.tube(f"leg{k}", [(f[0], 0.9, f[2]), (top[0] + math.cos(a) * 1.0, top[1] - 0.6, top[2] + math.sin(a) * 1.0)], 0.7,
               cherry, sides=6)
        S.lathe(f"foot{k}", [(0.9, 0), (0.7, 0.9), (0.6, 1.2)], f, metal("brass", tone=4.4), sides=6, subdiv=0)
    tray_y = 6.4
    S.lathe("tray", [(3.0, tray_y), (3.2, tray_y + 0.5)], (0, 0, 0), wood("cherry", tone=4.6, grain="x", knots=False),
            sides=10, subdiv=0)
    for k in range(3):
        a = math.radians(k * 120 + 30)
        S.tube(f"chain{k}", [(math.cos(a) * 2.9, tray_y + 0.3, math.sin(a) * 2.9), (math.cos(a) * 4.9, tray_y + 0.6, math.sin(a) * 4.9)],
               0.15, metal("brass", tone=4.0), sides=4, subdiv=0)
    S.box("book", (2.6, 0.6, 2.0), (0.4, tray_y + 0.8, 0.2), plain("navy", tone=3.6, layers=[
        {"id": "pages", "op": "band", "axis": "y", "from": -0.3, "to": 0.3, "ramp": "paper", "tone": 5}]), rot=(0, 20, 0))
    S.lathe("head", [(1.6, 0), (1.3, 1.0), (1.8, 1.4), (1.6, 2.2)], (0, top[1] - 1.4, 0), metal("brass", tone=4.6), sides=10)
    # the tube on its yoke: pans and tilts slowly
    S.bone("pan", (0, top[1] + 0.8, 0))
    for s in (-1, 1):
        S.box(f"yoke{s}", (0.5, 2.8, 1.2), (s * 1.9, top[1] + 1.8, 0), metal("brass", tone=4.2), parent="pan")
    S.bone("tilt", (0, top[1] + 2.8, 0), parent="pan", rot=(-28, 0, 0))
    brass = metal("brass", tone=4.8, layers=[{"id": "ring", "op": "stripes", "axis": "path", "period": 4.0, "width": 0.06,
                                              "ramp": "gold", "tone": 6}])
    T = lambda z, y=0.0, x=0.0: S.at("tilt", (x, y, z))  # noqa: E731
    S.tube("tube", [T(-7.6), T(-2.0), T(4.0), T(8.6)], [1.0, 1.35, 1.6, 1.75], brass, parent="tilt", sides=12)
    S.tube("grip", [T(-1.2), T(1.8)], 1.55, cloth("russet", tone=3.4, weave=0.3, layers=[
        {"id": "stitch", "op": "stripes", "axis": "around", "period": 0.0833, "width": 0.1, "ramp": "honey", "tone": 5}]),
        parent="tilt", sides=12)
    S.tube("shield", [T(8.2), T(11.6)], [2.0, 2.1], metal("brass", tone=4.2), parent="tilt", sides=12, caps=(True, False))
    S.tube("lip", [T(11.4), T(11.8)], 2.25, metal("gold", tone=5.0), parent="tilt", sides=12, caps=(False, False))
    S.card("glass_lens", ["..aaaa..", ".abbaaa.", "abbaaaaa", "abaaaaaa", "aaaaaaaa", "aaaaaaaa", ".aaaaaa.", "..aaaa.."],
           T(10.9), glass("lake"), parent="tilt", key={"a": "lake:3", "b": "snow:6"})
    S.tube("eyepiece", [T(-7.6), T(-9.4), T(-10.2)], [0.7, 0.55, 0.75], metal("brass", tone=4.0), parent="tilt", sides=8)
    S.tube("finder", [T(-2.0, 2.4), T(4.2, 2.4)], [0.45, 0.6], metal("brass", tone=5.0), parent="tilt", sides=8)
    for z in (-0.6, 2.8):
        S.box(f"finder_mount{z}", (0.4, 1.2, 0.4), T(z, 1.6), metal("brass", tone=4.0), parent="tilt", rot=(-28, 0, 0))
    S.tube("focus", [T(-6.0, -1.0, -1.6), T(-6.0, -1.0, 1.6)], 0.3, metal("brass", tone=4.6), parent="tilt", sides=6)
    # a rolled star chart leaning on a leg
    S.tube("chart", [(4.4, 0.4, 4.8), (5.6, 9.0, 3.6)], 0.8, paper("parch", tone=4.6, layers=[
        {"id": "ink", "op": "spots", "count": 8, "radius": [0.15, 0.25], "ramp": "navy", "tone": 2}]), sides=8)
    S.tube("chart_ribbon", [(4.5, 3.4, 4.5), (4.52, 3.9, 4.45)], 0.88, plain("berry", tone=4.0), sides=8, caps=(False, False))
    S.anim("idle", 16.0, [
        {"part": "pan", "keys": [[0, -40], [8.0, 30], [16.0, -40]], "axis": "y", "ease": "ease"},
        {"part": "tilt", "keys": [[0, 0], [5.0, -6], [11.0, 5], [16.0, 0]], "axis": "x", "ease": "smooth"},
    ])
    return S


# ====================================================================== jar of fallen stars

@item
def star_jar():
    S = Spec("star_jar", "Jar of Fallen Stars", density=3.4,
             desc="A big glass mason jar with a cloth lid tied with twine and a paper tag, full of little fallen stars "
                  "in honey, rose and moonlight that glow and hum and twinkle in turn.")
    S.lathe("glass_jar", [(3.4, 0), (4.1, 0.4), (4.3, 1.4), (4.3, 8.4), (3.6, 9.8), (2.9, 10.3), (2.9, 11.2), (3.1, 11.6)],
            (0, 0, 0), glass("glass"), sides=14, caps=(True, False), double_sided=True)
    S.lathe("lid", [(3.3, 11.0), (3.4, 11.9), (3.0, 12.2), (1.0, 12.4)], (0, 0, 0), metal("brass", tone=4.2), sides=12)
    cloth_lid = cloth("lilac", tone=4.4, weave=0.4, layers=[
        {"id": "gingham", "op": "stripes", "axis": "x", "period": 1.2, "width": 0.5, "ramp": "cream", "tone": 5},
        {"id": "gingham2", "op": "stripes", "axis": "z", "period": 1.2, "width": 0.5, "shift": -0.6}])
    S.lathe("cloth", [(4.0, 10.0), (4.2, 10.4), (3.5, 11.3), (3.6, 12.2), (2.8, 12.7), (0.4, 12.9)], (0, 0, 0), cloth_lid,
            sides=12)
    S.lathe("twine", [(3.55, 11.1), (3.55, 11.6)], (0, 0, 0), plain("straw", tone=3.6, layers=[
        {"id": "twist", "op": "stripes", "axis": [0, 1, 1], "period": 0.4, "width": 0.5, "shift": -0.8}]), sides=12,
        caps=(False, False), subdiv=0)
    tag = Pix(10, 7)
    tag.poly([(0, 1), (2, 0), (10, 0), (10, 7), (2, 7), (0, 6)], "p")
    tag.disc(1.8, 3.5, 0.7, ".")
    tag.star(6, 3.5, 2.6, "s", inner=0.45)
    S.card("tag", tag.rows, (3.0, 9.0, 3.4), flat("paper"), key={"p": "paper:5", "s": "honey:5"}, rot=(0, 40, -14))
    S.tube("tag_string", [(3.0, 11.3, 2.2), (3.4, 10.0, 3.2)], 0.08, plain("straw", tone=3, noise=0), sides=3)
    tracks = []
    cols = ["star", "star", "ember", "moonglow"]
    for i in range(15):
        a = hsh(i, 1) * math.pi * 2
        r = hsh(i, 2) * 2.4
        y = 0.9 + (hsh(i, 3) ** 1.3) * 7.6
        c = cols[i % 4]
        nm = f"glow_star{i}"
        S.card(nm, star_card(7 if i % 3 else 9), (math.cos(a) * r, y, math.sin(a) * r), glow(c), rot=(hsh(i, 5) * 40 - 20,
               hsh(i, 4) * 180, hsh(i, 6) * 60), key={"a": f"{c}:4", "b": f"{c}:2", "c": f"{c}:4"})
        tracks.append({"part": nm, "channel": "scale", "keys": cycle_keys(
            [(0, [0, 0, 0]), (0.4, [0.35, 0.35, 0.35]), (1.0, [-0.3, -0.3, -0.3]), (1.6, [0, 0, 0]), (4.0, [0, 0, 0])],
            4.0, hsh(i, 9) * 4.0)})
    S.anim("idle", 4.0, tracks)
    return S


# ====================================================================== planet mobile

@item
def planet_mobile():
    S = Spec("planet_mobile", "Planetarium Mobile", density=3.0, wall=True,
             desc="A little glowing sun and four planets (one ringed, one with a moon) on brass arms, hanging from a "
                  "curly wrought-iron wall bracket and turning slowly.")
    iron = metal("iron", tone=4.2, tarnish=False)
    S.box("plate", (3.0, 6.0, 0.8), (0, 2.6, 0.4), iron, chamfer=0.2)
    for y in (0.6, 4.6):
        S.ball(f"screw{y}", 0.35, (0, y, 0.9), metal("brass", tone=4.6), sides=6, rings=3)
    S.tube("arm", [(0, 4.0, 0.8), (0, 5.0, 5.0), (0, 4.4, 9.4), (0, 3.0, 12.0)], 0.45, iron, sides=5)
    curl = [(0, 2.0 + 1.6 * math.cos(a), 1.4 + 1.6 * math.sin(a) + 1.2) for a in [-1.8 + i * 0.6 for i in range(10)]]
    S.tube("curl", [(0, 1.6, 0.8)] + curl, 0.32, iron, sides=5)
    S.tube("hook", [(0, 3.0, 12.0), (0, 1.8, 12.6), (0, 1.2, 12.0)], 0.3, iron, sides=5)
    # the mobile, turning
    mc = (0, -1.4, 12.0)
    S.bone("mobile", mc)
    S.box("hanger", (0.12, 2.6, 0.12), (0, -0.1, 12.0), plain("cream", tone=5, noise=0), parent="mobile")
    for k, rot in enumerate((0, 90)):
        S.tube(f"bar{k}", [(-7.4 * math.cos(math.radians(rot)), -1.6, 12.0 + 7.4 * math.sin(math.radians(rot))),
                            (7.4 * math.cos(math.radians(rot)), -1.6, 12.0 - 7.4 * math.sin(math.radians(rot)))], 0.22,
               metal("brass", tone=4.6), parent="mobile", sides=5)
    S.ball("glow_sun", 2.0, (0, -4.6, 12.0), glow("flame", tone=4.6, layers=[
        {"id": "flares", "op": "spots", "count": 8, "radius": [0.3, 0.5], "ramp": "flame", "tone": 6}]), parent="mobile",
        sides=10, rings=6)
    S.box("sun_thread", (0.1, 1.6, 0.1), (0, -2.4, 12.0), plain("cream", tone=5, noise=0), parent="mobile")
    planets = [("buff", 1.6, (7.0, 0), 6.2, True), ("lake", 1.3, (0, 7.0), 8.0, False), ("terracotta", 1.0, (-7.0, 0), 4.8, False),
               ("lilac", 1.2, (0, -7.0), 7.0, False)]
    for k, (rmp, r, (dx, dz), drop, ringed) in enumerate(planets):
        x, z = dx, 12.0 + dz
        S.box(f"thread{k}", (0.1, drop, 0.1), (x, -1.6 - drop / 2, z), plain("cream", tone=5, noise=0), parent="mobile")
        st = plain(rmp, tone=4.4, gloss=True, layers=[
            {"id": "bands", "op": "stripes", "axis": "y", "period": 0.9, "width": 0.3, "shift": -0.7, "wobble": 0.3},
            {"id": "spots", "op": "patches", "scale": 0.7, "threshold": 0.66, "shift": 0.9}])
        S.ball(f"planet{k}", r, (x, -1.6 - drop - r, z), st, parent="mobile", sides=10, rings=6)
        if ringed:
            ring = Pix(26, 26)
            ring.ring(13, 13, 11.5, "a", 2.6)
            ring.ring(13, 13, 9.6, "b", 1.0)
            S.card(f"ring{k}", ring.rows, (x, -1.6 - drop - r, z), flat("buff"), plane="xz", parent="mobile",
                   key={"a": "buff:6", "b": "ochre:3"}, rot=(16, 0, 18))
        if rmp == "lake":
            S.ball("moonlet", 0.45, (x + 2.2, -1.6 - drop - r + 0.6, z + 0.4), plain("snow", tone=5), parent="mobile", sides=6,
                   rings=3)
    S.anim("idle", 20.0, [
        {"part": "mobile", "keys": [[0, 0], [20.0, 360]], "axis": "y", "ease": "linear"},
        {"part": "mobile", "osc": {"axis": "z", "amp": 2.5, "cycles": 4}},
    ])
    return S


# ====================================================================== sleepy cloud pouf

@item
def cloud_pouf():
    S = Spec("cloud_pouf", "Sleepy Cloud Pouf", density=2.6,
             desc="A plump little cloud pouf that drifted in and dozed off: puffy billows shaded lilac underneath, a "
                  "sleepy stitched face with rosy cheeks, a rainbow ribbon tag, and a little 'z' drifting up as it "
                  "breathes.")
    puff = knit("snow", tone=5.0, layers=[
        {"id": "under", "op": "band", "axis": "y", "from": -1.0, "to": -0.35, "ramp": "lavender", "tone": 4.0, "wobble": 0.2},
        {"id": "shade", "op": "gradient", "axis": "y", "amount": 0.8}])
    S.bone("breathe", (0, 0, 0))
    for k, (x, y, z, r, sq) in enumerate([(0, 6.6, 0, 6.8, 0.8), (-6.6, 4.8, 0.6, 4.8, 0.9), (6.8, 4.9, 0.4, 5.0, 0.9),
                                           (-2.6, 10.4, -1.0, 4.2, 0.9), (3.2, 10.0, -0.6, 3.9, 0.9), (-9.0, 3.4, -1.6, 2.6, 0.9),
                                           (9.4, 3.2, -1.2, 2.6, 0.9)]):
        S.ball(f"puff{k}", r, (x, y, z), puff, parent="breathe", sides=10, rings=6, squash=(1.0, sq, 0.95))
    face = Pix(30, 14)
    for s, cx in ((-1, 8), (1, 22)):
        face.path([(cx - 3, 4), (cx - 1.5, 5.5), (cx + 1.5, 5.5), (cx + 3, 4)], "i")
        face.set(cx + s * 3.5, 3, "i")
        face.disc(cx + s * 1.0, 9.5, 2.4, "b", ry=1.4)
    face.path([(13, 9), (14, 10), (16, 10), (17, 9)], "i")
    S.card("face", face.rows, (0, 6.4, 6.4), flat("snow"), parent="breathe", key={"i": "plum:2", "b": "blush:4"},
           rot=(-8, 0, 0))
    tag = Pix(6, 16)
    for y in range(16):
        for x in range(6):
            tag.set(x, y, "abcde"[min(4, x)] if y < 14 or x % 2 else ".")
    S.card("ribbon", tag.rows, (9.6, 2.6, 4.2), flat("rose"), parent="breathe",
           key={"a": "rose:5", "b": "honey:5", "c": "sage:5", "d": "lake:5", "e": "lilac:5"}, rot=(0, 30, 6))
    zz = ["aaaa", "..a.", ".a..", "aaaa"]
    tracks = [{"part": "breathe", "channel": "scale", "osc": {"amp": [0.025, 0.05, 0.025], "cycles": 1}}]
    for k in range(2):
        nm = f"zz{k}"
        S.card(nm, zz, (4.0 + k * 1.4, 14.0, 1.0), flat("lilac", light=0.3), key={"a": "lilac:5"})
        tracks.append({"part": nm, "channel": "position", "keys": cycle_keys(
            [(0, [0, 0, 0]), (2.9, [1.6, 3.6, 0]), (2.95, [0, 0, 0]), (3.0, [0, 0, 0])], 3.0, k * 1.5), "ease": "linear"})
        tracks.append({"part": nm, "channel": "scale", "keys": cycle_keys(
            [(0, [-1, -1, -1]), (0.4, [0, 0, 0]), (2.2, [0, 0, 0]), (2.9, [-1, -1, -1]), (3.0, [-1, -1, -1])], 3.0, k * 1.5)})
    S.anim("idle", 3.0, tracks)
    return S


# ====================================================================== comet rug

def comet_art(cols, rows):
    p = Pix(cols, rows)
    hx, hy = cols * 0.82, rows / 2
    band_keys = ["1", "2", "3", "4", "5"]
    for y in range(rows):
        for x in range(cols):
            k = (hx - x) / (hx - 1)
            if k < 0 or k > 1:
                continue
            half = (rows * 0.42) * (1 - k) ** 0.9 + 1.2 + math.sin(x * 0.35) * 1.0 * k
            d = abs(y + 0.5 - hy)
            if d > half:
                continue
            b = min(4, int(d / half * 2.2 + k * 2.8))
            c = band_keys[b]
            if (x + y * 2) % 7 == 0 and b < 4:
                c = band_keys[b + 1]
            if d > half - 1.2:
                c = "e"
            p.set(x, y, c)
    for i in range(40):
        x, y = hsh(i, 1) * cols * 0.8, hsh(i, 2) * rows
        if p.get(x, y) != ".":
            p.set(x, y, "s")
    p.star(hx, hy, rows * 0.36, "h", inner=0.48)
    p.star(hx, hy, rows * 0.22, "H", inner=0.48)
    p.disc(hx, hy, rows * 0.07, "c")
    p.outline("e")
    return p.rows


@item
def comet_rug():
    S = Spec("comet_rug", "Comet Rug", density=2.6,
             desc="A tufted rug shaped like a golden star streaking across the floor, its long soft tail fading from "
                  "honey through rose and lilac into dusk blue, with little stitched sparkles.")
    art = comet_art(int(42 * 2.6), int(16 * 2.6))
    S.card("rug", art, (-1.0, 0.7, 0), flat("honey", light=0.7), plane="xz",
           key={"1": "honey:5", "2": "rose:4", "3": "lilac:4", "4": "dusk:4", "5": "navy:4", "e": "navy:2", "s": "snow:6",
                "h": "honey:5", "H": "lamp:4", "c": "lamp:5"})
    base = Pix(len(art[0]), len(art))
    for y, row in enumerate(art):
        for x, ch in enumerate(row):
            if ch != ".":
                base.set(x, y, "d")
    base.outline("d")
    S.card("rug_base", base.rows, (-1.0, 0.25, 0), flat("navy"), plane="xz", key={"d": "navy:1"})
    return S
