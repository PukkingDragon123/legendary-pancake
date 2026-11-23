"""furnC items made from borrowed models (see compose.py; credits in docs/credits/furnC.md)."""
import os

import compose as C

SCR = "/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad"
GG = os.environ.get("FURNC_GG", SCR + "/refs3/gg/public/models/lowpix/world")
BU = os.environ.get("FURNC_BUSHED", SCR + "/refs4/lpx-bushed/games/bushed/public/assets/models")

ITEMS = {}


def item(f):
    ITEMS[f.__name__] = f
    return f


def calm(pieces, **kw):
    cache = {}
    out = []
    for p in pieces:
        k = id(p["img"])
        if k not in cache:
            cache[k] = C.grade(p["img"], **kw)
        out.append(dict(p, img=cache[k]))
    return out


def recolour(pieces, fn):
    cache = {}
    out = []
    for p in pieces:
        k = id(p["img"])
        if k not in cache:
            cache[k] = fn(p["img"])
        out.append(dict(p, img=cache[k]))
    return out


def hue_palette(im, sat_min=0.3):
    """Saturated colours onto the calm palette by hue band (reds -> berry, blues -> dusk, greens -> fern...)."""
    bands = [((0.92, 1.01), ["plum", "berry", "rose", "blush"]), ((-0.01, 0.06), ["plum", "berry", "rose", "blush"]),
             ((0.06, 0.12), ["russet", "clay", "terracotta", "buff"]), ((0.12, 0.2), ["umber", "ochre", "honey", "lamp"]),
             ((0.2, 0.47), ["pine", "fern", "moss", "sage"]), ((0.47, 0.7), ["night", "slate", "dusk", "lake"]),
             ((0.7, 0.92), ["ink2", "plum", "lilac", "lavender"])]
    for (h0, h1), keys in bands:
        im = C.remap(im, lambda h, s, v, h0=h0, h1=h1: (s > sat_min) & (h >= h0) & (h < h1), keys, strength=0.9)
    return im


@item
def mantel_clock(path):
    """BUSHED's mantel clock (a restyle of Poly Haven's mantel_clock_01), in walnut tones."""
    ps = C.load(f"{BU}/mantel_clock_01.glb")
    ps = C.place(ps, width=13.0)
    ps = calm(ps, sat=0.85, warm=0.14, cool=0.16, lift=0.02)
    return C.write(ps, path)


@item
def mint_typewriter(path):
    """Gacha Garage's vintage typewriter, its black enamel repainted sage-mint."""
    ps = C.load(f"{GG}/typewriter.glb")
    ps = C.place(ps, width=18.0)
    ps = recolour(ps, lambda im: C.remap(im, lambda h, s, v: (v < 0.42) & (s < 0.35),
                                         ["forest", "pine", "fern", "moss", "sage", "sageLight"], strength=0.85))
    ps = calm(ps, sat=0.9, warm=0.12, cool=0.12, lift=0.02)
    return C.write(ps, path)


@item
def vase_trio(path):
    """Three borrowed vessels on one footprint: a painted ceramic vase, a glazed jug and a brass bud vase."""
    a = C.place(C.load(f"{GG}/vase_ceramic.glb"), height=14.0, at=(-2.6, 0, -1.6), yaw=20)
    a = recolour(a, lambda im: C.remap(im, lambda h, s, v: (s > 0.25) & (h > 0.5) & (h < 0.75),
                                       ["slate", "dusk", "lake", "sky"], strength=0.8))
    b = C.place(C.load(f"{BU}/jug_01.glb"), height=9.0, at=(3.2, 0, -0.6), yaw=-60)
    c = C.place(C.load(f"{GG}/vase_brass.glb"), height=10.0, at=(-0.4, 0, 3.4), yaw=10)
    ps = calm(a + b + c, sat=0.85, warm=0.12, cool=0.16)
    return C.write(ps, path)


@item
def reading_pile(path):
    """Gacha Garage's book stack, re-bound in calm cloth colours, with its round spectacles folded on top."""
    books = C.place(C.load(f"{GG}/books_stack.glb"), width=11.0, yaw=-8)
    books = recolour(books, hue_palette)
    books = calm(books, sat=0.85, warm=0.14, cool=0.16)
    lo, hi = C.bounds(books)
    glasses = C.place(C.load(f"{GG}/wear_frames.glb"), width=6.4, at=(0.4, hi[1] - 0.1, 0.6), yaw=15)
    glasses = calm(glasses, sat=0.7)
    return C.write(books + glasses, path)


@item
def rose_tea_set(path):
    """Gacha Garage's tea set (a restyle of Poly Haven's tea_set_01), split into its pieces and laid out for tea:
    the teapot, two cups on saucers and the sugar bowl on a plate."""
    ps = C.load(f"{GG}/tea_set.glb")
    lo, hi = C.bounds(ps)
    objs = sorted(C.split(ps, gap=float((hi - lo).max()) * 0.002), key=lambda o: C.bounds(o)[0][0])
    k = 7.2 / (C.bounds(objs[1])[1][1] - C.bounds(objs[1])[0][1])     # the teapot stands 7.2 px tall
    pot, plate, sugar, saucer_a, cup_a, saucer_b, cup_b = objs[1], objs[2], objs[3], objs[4], objs[5], objs[6], objs[7]

    def put(o, x, y, z, yaw=0.0):
        return C.place(o, keep=k, at=(x, y, z), yaw=yaw)

    def top(o):
        return C.bounds(o)[1][1]
    out = put(pot, -2.8, 0, -2.6, yaw=-30)
    sa = put(saucer_a, 3.6, 0, -2.4)
    out += sa + put(cup_a, 3.6, top(sa) - 0.15, -2.4, yaw=40)
    sb = put(saucer_b, 3.2, 0, 3.6)
    out += sb + put(cup_b, 3.2, top(sb) - 0.15, 3.6, yaw=-70)
    pl = put(plate, -3.2, 0, 3.4)
    out += pl + put(sugar, -3.2, top(pl) - 0.1, 3.4)
    out = calm(out, sat=0.85, warm=0.14, cool=0.12, lift=0.02)
    return C.write(out, path)
