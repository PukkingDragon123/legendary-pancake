"""Paint the globe's planet texture as hand-placed pixel art, one image per mip level.

    ~/.cache/lowpix-venv/bin/python src/world/globe/tools/paint_earth.py <land-50m.json> [out_dir]

<land-50m.json> is Natural Earth's 1:50m land (public domain) as TopoJSON, from the `world-atlas` npm package
(`npm pack world-atlas@2.0.2`). Writes public/models/globe/earth_day_<W>.png and earth_night_<W>.png for
W = 1024, 512, 256, 128. Each level is painted at its own size (not averaged from the one above), so the globe
stays crisp pixel art at every zoom: the runtime loads them as a hand-made mip chain.

Day texture: calm "Moss & Moonlight" colours, biomes (forests drawn as little trees, dunes as wind-combed
stripes, mountains with a north-west hillshade and snow caps, ice with cracks), rivers, stepped ocean depth with
surf on the coasts and wave marks. Its alpha channel flags water for the shader (255 land, 240 water, 224/208 wave
marks in two phases). Night texture: the same world in moonlight, with warm town lights.
"""
from __future__ import annotations

import json
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import geo  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
PHOTOS = os.path.join(ROOT, "art", "lowpix", "souvenirs", "_kit", "photos")   # CC0 Poly Haven photos


def hx(s):
    s = s.lstrip("#")
    return np.array([int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)], np.float64)


def ramp(*cols):
    return np.stack([hx(c) for c in cols])


# ------------------------------------------------------------------------------------------------ palette
# Ramps darkest first; everything leans on src/gfx/palette.ts (moss, sage, pine, straw, ochre, slate, lake, mist).
R = {
    "ocean": ramp("#34485a", "#3d5264", "#46596a", "#506778", "#5b7584", "#678691", "#7598a0", "#86a9b0", "#9dbfc0", "#b9d3cf"),
    "surf": ramp("#a9c0bc", "#bccfca"),
    "temperate": ramp("#3b5536", "#4a663f", "#567446", "#64834f", "#74925a", "#86a06a", "#9aaf7a", "#b0c08e"),
    "forest": ramp("#2a3d2e", "#334a34", "#3f5a3b", "#4b6a42", "#587949", "#688a53", "#7c9b5f"),
    "boreal": ramp("#263830", "#2f4437", "#3a5140", "#465f4a", "#546d56", "#667d64", "#7a8e74"),
    "rain": ramp("#213729", "#2a4530", "#345537", "#40663d", "#4e7742", "#5f8a49", "#749c53", "#8aad60"),
    "savanna": ramp("#7f7246", "#958552", "#a9975e", "#bba96c", "#c9b77b", "#d6c58c", "#e0d29f"),
    "steppe": ramp("#7e8052", "#90915e", "#a2a26b", "#b3b27a", "#c3c18b", "#d0cd9d"),
    "desert": ramp("#9c6c4c", "#ad7c56", "#bd8e62", "#c99f6f", "#d4b07e", "#ddc08f", "#e6cfa3", "#efdfbb"),
    "tundra": ramp("#55634f", "#65735a", "#778466", "#899373", "#9ba383", "#aeb496"),
    "rock": ramp("#4b4741", "#5a554d", "#6a655c", "#7b756a", "#8c8579", "#9d968a", "#b0a99c", "#c4beb0"),
    "snow": ramp("#8ea3ae", "#a3b7c0", "#b7cad0", "#c9d9dc", "#d9e5e6", "#e7efed", "#f3f6f1"),
    "beach": ramp("#cdbb8c", "#ddcda2", "#e8dbb6"),
    "river": ramp("#5b7a88", "#6f909a"),
    "lamp": ramp("#8a6236", "#b78849", "#dcb072", "#f1d39a", "#fbeac2", "#fff8e4"),
}
NIGHT_SKY = hx("#1f2a3a")


# ------------------------------------------------------------------------------------------------ land mask
def decode_topo(path):
    topo = json.load(open(path))
    (sx, sy), (tx, ty) = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs = []
    for a in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in a:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def ring(idx):
        out = []
        for i in idx:
            pts = arcs[i] if i >= 0 else arcs[~i][::-1]
            out.extend(pts if not out else pts[1:])
        return out

    polys = []
    for g in topo["objects"]["land"]["geometries"]:
        parts = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"]
        for p in parts:
            polys.append([ring(r) for r in p])
    return polys


def land_mask(polys, W=4096):
    H = W // 2
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    def unwrap(r):
        """Rings that cross the antimeridian jump 360 degrees; make them continuous (pole-circling rings stay)."""
        out, off = [], 0.0
        for i, (lon, lat) in enumerate(r):
            if i:
                d0 = lon + off - out[-1][0]
                if d0 > 180:
                    off -= 360
                elif d0 < -180:
                    off += 360
            out.append((lon + off, lat))
        lons = [q[0] for q in out]
        if max(lons) - min(lons) > 350 or abs(out[0][0] - out[-1][0]) > 1:
            return [r]
        return [[(lon + k, lat) for lon, lat in out] for k in (-360, 0, 360)]

    px = lambda r: [((lon + 180) / 360 * W, (90 - lat) / 180 * H) for lon, lat in r]
    for p in polys:
        for r in unwrap(p[0]):
            d.polygon(px(r), fill=255)
    for p in polys:
        for h in p[1:]:
            for r in unwrap(h):
                d.polygon(px(r), fill=0)
    # Antarctica's southern edge runs along the pole; make sure the bottom rows are land
    a = np.asarray(im).copy()
    a[int(H * 0.968):, :] = 255
    return a


LAKES = [  # (lon, lat), (rx, ry) degrees, rotation: the big lakes Natural Earth's land layer keeps as land
    ((-87.0, 43.8), (0.9, 2.2), 0), ((-82.4, 44.8), (1.6, 1.0), -30), ((-88.0, 47.6), (2.6, 0.7), 10), ((-81.2, 42.2), (2.3, 0.45), 20),
    ((-77.9, 43.6), (1.3, 0.35), 10), ((33.0, -1.0), (1.2, 1.2), 0), ((108.2, 53.6), (0.35, 3.0), -35), ((29.6, -6.2), (0.3, 3.0), 15),
    ((34.6, -12.0), (0.3, 2.6), 0), ((-69.4, -15.8), (0.6, 0.4), -30), ((31.5, 61.0), (0.9, 0.6), 30), ((-123.5, 66.0), (2.0, 0.9), 10),
    ((-114.5, 61.6), (2.0, 0.6), 30), ((-97.5, 52.5), (0.5, 2.3), 10), ((59.5, 45.0), (1.0, 0.8), 0), ((36.5, 3.6), (0.35, 1.3), 0),
    ((74.5, 46.6), (2.0, 0.35), 10), ((76.9, 42.4), (0.8, 0.3), 0), ((14.2, 13.0), (0.8, 0.6), 0), ((-85.5, 11.6), (0.6, 0.4), -30),
]


# ------------------------------------------------------------------------------------------------ noise
def _hash3(ix, iy, iz, seed):
    h = (ix.astype(np.int64) * 374761393 + iy.astype(np.int64) * 668265263 + iz.astype(np.int64) * 2147483647 + seed * 144665) & 0xFFFFFFFF
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def vnoise(x, y, z, seed=0):
    ix, iy, iz = np.floor(x), np.floor(y), np.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    fx, fy, fz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (fx if dx else 1 - fx) * (fy if dy else 1 - fy) * (fz if dz else 1 - fz)
                out = out + w * _hash3(ix + dx, iy + dy, iz + dz, seed)
    return out


def fbm(p, freq, oct=4, seed=0):
    x, y, z = p
    s, a, tot = 0, 1.0, 0
    for o in range(oct):
        s = s + a * vnoise(x * freq, y * freq, z * freq, seed + o * 17)
        tot += a
        a *= 0.5
        freq *= 2.03
    return s / tot


def hash2(x, y, seed):
    return _hash3(x, y, np.zeros_like(x), seed)


BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 + 1 / 32


# ------------------------------------------------------------------------------------------------ fields
def ellipse_field(lon, lat, regions):
    out = np.zeros_like(lon)
    for (cx, cy), (rx, ry), rot, k in regions:
        dx = (lon - cx + 180) % 360 - 180
        dy = lat - cy
        a = math.radians(rot)
        u = (dx * math.cos(a) + dy * math.sin(a)) / rx
        v = (-dx * math.sin(a) + dy * math.cos(a)) / ry
        d = np.sqrt(u * u + v * v)
        out = np.maximum(out, k * np.clip(1.3 - d, 0, 1))
    return out


def ranges_field(lon, lat, ranges):
    e = np.zeros_like(lon)
    for pts, w, h in ranges:
        for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
            c = math.cos(math.radians((y0 + y1) / 2))
            # bbox in degrees around the segment (lon wrap not needed: no range crosses the antimeridian mid-segment)
            pad = w * 1.2
            lo_x, hi_x = min(x0, x1) - pad / max(c, 0.2), max(x0, x1) + pad / max(c, 0.2)
            lo_y, hi_y = min(y0, y1) - pad, max(y0, y1) + pad
            m = (lon >= lo_x) & (lon <= hi_x) & (lat >= lo_y) & (lat <= hi_y)
            if not m.any():
                continue
            px, py = (lon[m] - x0) * c, lat[m] - y0
            sx, sy = (x1 - x0) * c, y1 - y0
            L2 = sx * sx + sy * sy or 1e-9
            t = np.clip((px * sx + py * sy) / L2, 0, 1)
            d = np.hypot(px - t * sx, py - t * sy) / w
            e[m] = np.maximum(e[m], h * np.clip(1 - d * d, 0, 1))
    return e


def blur_wrap(a, sigma_px):
    """Gaussian blur of a 0..1 field, wrapping round the antimeridian."""
    from PIL import ImageFilter
    H, W = a.shape
    pad = int(sigma_px * 3) + 2
    big = np.concatenate([a[:, -pad:], a, a[:, :pad]], 1)
    im = Image.fromarray(np.clip(big * 255, 0, 255).astype(np.uint8))
    im = im.filter(ImageFilter.GaussianBlur(sigma_px))
    return np.asarray(im, np.float64)[:, pad:pad + W] / 255


def dist_from(mask, maxd):
    """Chebyshev distance (texels) from the True cells, wrapping in x, capped at maxd."""
    d = np.where(mask, 0, maxd).astype(np.int32)
    cur = mask.copy()
    for i in range(1, maxd):
        n = cur.copy()
        n |= np.roll(cur, 1, 1) | np.roll(cur, -1, 1)
        up = np.zeros_like(cur)
        up[1:] = cur[:-1]
        dn = np.zeros_like(cur)
        dn[:-1] = cur[1:]
        n |= up | dn
        n |= np.roll(up, 1, 1) | np.roll(up, -1, 1) | np.roll(dn, 1, 1) | np.roll(dn, -1, 1)
        d[n & ~cur] = i
        cur = n
    return d


def pick(r, t):
    """Quantise a float tone onto a ramp."""
    i = np.clip(np.round(t), 0, len(r) - 1).astype(int)
    return r[i]


# ------------------------------------------------------------------------------------------------ painting
def paint_level(mask4k, W):
    H = W // 2
    s = W / 1024.0                                # 1 at the top level
    deg = 360.0 / W                               # degrees per texel
    yy, xx = np.mgrid[0:H, 0:W]
    lon = (xx + 0.5) / W * 360 - 180
    lat = 90 - (yy + 0.5) / H * 180
    cl = np.cos(np.radians(lat))
    P = (np.cos(np.radians(lat)) * np.cos(np.radians(lon)), np.sin(np.radians(lat)), np.cos(np.radians(lat)) * np.sin(np.radians(lon)))
    by = BAYER[yy % 4, xx % 4]

    frac = np.asarray(Image.fromarray(mask4k).resize((W, H), Image.BOX), np.float64) / 255
    land = frac > 0.5
    lakes = ellipse_field(lon, lat, [(c, r, rot, 1.0) for c, r, rot in LAKES]) > 0.02
    land &= ~lakes
    water = ~land

    n1 = fbm(P, 3.0, 4, 1)          # broad variation
    n2 = fbm(P, 11.0, 3, 2)         # medium clusters
    n3 = fbm(P, 40.0, 2, 3)         # fine clusters
    wig = (n2 - 0.5) * 0.5 + (n3 - 0.5) * 0.25   # wiggles every region border

    # ---- scores, looked up through a wobbly warp so no region keeps an ellipse's shape
    wl = lon + (fbm(P, 4.0, 3, 101) - 0.5) * 16 + (n3 - 0.5) * 2.5
    wt = lat + (fbm(P, 4.0, 3, 102) - 0.5) * 9 + (n3 - 0.5) * 1.5
    wig = wig * 1.5
    desert = ellipse_field(wl, wt, geo.DESERT) * 1.25 + wig
    rain = ellipse_field(wl, wt, geo.RAIN) * 1.15 + wig
    sav = ellipse_field(wl, wt, geo.SAVANNA) * 1.05 + wig * 0.8
    steppe = ellipse_field(wl, wt, geo.STEPPE) * 1.05 + wig * 0.8
    ice = ellipse_field(wl, wt, geo.ICE) * 2.0 + wig * 0.5
    base = ranges_field(lon + (n3 - 0.5) * 1.2, lat + (n2 - 0.5) * 0.8, geo.RANGES)
    ridged = 1 - np.abs(fbm(P, 26.0, 4, 9) * 2 - 1)
    elev = base * (0.35 + 0.85 * ridged ** 1.5)
    elev = np.where(land, elev, 0)
    alat = np.abs(lat)
    boreal = np.clip((wt - 50) / 6, 0, 1) * np.clip((69 - wt) / 5, 0, 1) * 0.9 + wig * 0.6
    tundra = np.clip((wt - 65) / 5, 0, 1) + np.clip((-wt - 52) / 4, 0, 1) * 0.6 + wig * 0.5
    antarctic = (lat < -60).astype(float) * 2
    ice = np.maximum(ice, antarctic) + np.clip((lat - 79) / 3, 0, 1)
    temperate = np.full_like(lon, 0.45) + (n1 - 0.5) * 0.3
    forest_dense = np.clip((n1 - 0.48) * 4 + (n2 - 0.5), -1, 1)

    names = ["temperate", "desert", "rain", "savanna", "steppe", "boreal", "tundra", "ice"]
    stack = np.stack([temperate, desert, rain, sav, steppe, boreal, tundra, ice])
    biome = np.argmax(stack, 0)
    B = {k: biome == i for i, k in enumerate(names)}

    # ---- coast distances (texels)
    dl = dist_from(water, 6)        # land: how far from the sea
    dw = dist_from(land, int(14 * s) + 2)   # sea: how far from land
    dwd = dw * deg                  # in degrees

    img = np.zeros((H, W, 3))
    tone = np.zeros((H, W))
    # hillshade from a north-west light
    gx = np.roll(elev, -1, 1) - np.roll(elev, 1, 1)
    gy = np.zeros_like(elev)
    gy[1:-1] = elev[2:] - elev[:-2]
    shade = (-gx * 0.7 - gy * 0.7) * (9.0 / s ** 0.25)

    def put(mask, r, t):
        img[mask] = pick(r, t[mask] if isinstance(t, np.ndarray) else np.full(mask.sum(), t))

    clusters = (n2 - 0.5) * 2.4 + (n3 - 0.5) * 1.6
    cell = max(2, int(round(3 * s ** 0.35)))
    jx, jy = hash2(xx // cell, yy // cell, 11), hash2(xx // cell, yy // cell, 12)
    cx_, cy_ = (xx // cell) * cell + (jx * (cell - 1)).astype(int), (yy // cell) * cell + (jy * (cell - 1)).astype(int)
    tree_top = (xx == cx_) & (yy == cy_)
    tree_bot = (xx == cx_ + 1) & (yy == cy_ + 1)
    tree_side = (xx == cx_ + 1) & (yy == cy_)
    tree_on = hash2(xx // cell, yy // cell, 13)

    # temperate: meadow and woods in patches
    woods = B["temperate"] & (forest_dense > -0.1)
    meadow = B["temperate"] & ~woods
    put(meadow, R["temperate"], 4.6 + clusters * 0.9 + shade)
    put(woods, R["forest"], 3.6 + clusters * 0.7 + shade)
    trees = woods & (tree_on < 0.8)
    put(trees & tree_top, R["forest"], 5.6 + shade)
    put(trees & tree_side, R["forest"], 4.4 + shade)
    put(trees & tree_bot, R["forest"], 1.2 + shade)
    m_trees = meadow & (tree_on < 0.18)
    put(m_trees & tree_top, R["forest"], 4.4 + shade)
    put(m_trees & tree_bot, R["forest"], 1.6 + shade)

    # boreal: dark conifer ranks
    put(B["boreal"], R["boreal"], 3.4 + clusters * 0.7 + shade)
    con = B["boreal"] & (tree_on < 0.85)
    put(con & tree_top, R["boreal"], 5.4 + shade)
    put(con & (xx == cx_) & (yy == cy_ + 1), R["boreal"], 1.0 + shade)
    snowy = B["boreal"] & (lat > 61) & (hash2(xx, yy, 21) < 0.03 + (lat - 61) / 90)
    put(snowy & ~tree_top, R["snow"], 3.2)

    # rainforest: thick billowing canopy
    put(B["rain"], R["rain"], 3.8 + clusters * 1.1 + shade)
    rr = B["rain"] & (tree_on < 0.95)
    put(rr & tree_top, R["rain"], 6.4 + shade)
    put(rr & tree_side, R["rain"], 5.0 + shade)
    put(rr & tree_bot, R["rain"], 1.0 + shade)

    # savanna: gold grass with acacia dots
    put(B["savanna"], R["savanna"], 3.6 + clusters * 0.9 + shade)
    acc = B["savanna"] & (tree_on < 0.3)
    put(acc & tree_top, R["forest"], 4.2)
    put(acc & tree_side, R["forest"], 3.2)
    put(acc & tree_bot, R["savanna"], 0.6)

    # steppe: combed grass strokes
    put(B["steppe"], R["steppe"], 3.0 + clusters * 0.8 + shade)
    stroke = B["steppe"] & (hash2(xx // 3, yy, 31) < 0.22) & (xx % 3 != 2)
    put(stroke, R["steppe"], 4.6 + shade)

    # desert: wind-combed dunes
    ang = math.radians(25)
    du = (xx * math.cos(ang) + yy * math.sin(ang)) / (4.2 * s ** 0.5) + (n2 - 0.5) * 3.0 + (n3 - 0.5) * 0.8
    fr = du - np.floor(du)
    put(B["desert"], R["desert"], 4.0 + (n1 - 0.5) * 2.4 + (n3 - 0.5) * 0.8 + shade)
    crest = B["desert"] & (fr < 0.14)
    lee = B["desert"] & (fr >= 0.14) & (fr < 0.3)
    put(crest, R["desert"], 6.2 + (n1 - 0.5) * 2 + shade)
    put(lee, R["desert"], 2.4 + (n1 - 0.5) * 2 + shade)
    rocky = B["desert"] & (fbm(P, 9.0, 3, 33) > 0.62)
    put(rocky & ~crest, R["rock"], 4.6 + clusters * 0.6 + shade)

    # tundra: mottled moss and lichen
    put(B["tundra"], R["tundra"], 3.0 + clusters * 1.2 + shade)
    lich = B["tundra"] & (hash2(xx, yy, 41) < 0.12)
    put(lich, R["tundra"], 5.0)
    put(B["tundra"] & (fbm(P, 30.0, 2, 42) > 0.66 - np.clip(alat - 68, 0, 12) * 0.012), R["snow"], 4.0)

    # mountains: rock and snow over whatever grows below
    mtn = land & (elev > 0.36 + (n3 - 0.5) * 0.1)
    hi = land & (elev > 0.84 + (n3 - 0.5) * 0.08) & (base > 0.62)
    put(mtn, R["rock"], 4.0 + shade * 1.5 + clusters * 0.5)
    put(hi, R["snow"], 4.4 + shade * 1.4 + clusters * 0.4)
    # little ridge chevrons on a jittered grid
    mc = max(3, int(round(5 * s ** 0.45)))
    mjx = (hash2(xx // mc, yy // mc, 51) * (mc - 2)).astype(int) + 1
    mjy = (hash2(xx // mc, yy // mc, 52) * (mc - 2)).astype(int) + 1
    ox, oy = xx - (xx // mc) * mc - mjx, yy - (yy // mc) * mc - mjy
    peak_cell = mtn & (hash2(xx // mc, yy // mc, 53) < 0.85)
    left = peak_cell & (oy == -ox) & (ox <= 0) & (ox >= -1)
    right = peak_cell & (oy == ox) & (ox >= 1) & (ox <= 2)
    top = peak_cell & (ox == 0) & (oy == 0)
    put(left & ~hi, R["rock"], 6.6)
    put(left & hi, R["snow"], 6.4)
    put(right & ~hi, R["rock"], 1.0)
    put(right & hi, R["snow"], 1.4)
    put(top, R["snow"], 6.0)

    # ice sheets: bright, with pale blue cracks
    put(B["ice"] & land, R["snow"], 4.8 + clusters * 0.8 + shade * 0.8)
    cr = B["ice"] & land & (np.abs(fbm(P, 14.0, 3, 61) - 0.5) < 0.018 * (1.6 / s ** 0.3))
    put(cr, R["snow"], 2.4)

    # coasts: a beach on warm, dry shores; a dark lip elsewhere
    beachy = (B["desert"] | B["savanna"] | B["steppe"] | (alat < 30)) & (n2 > 0.42)
    put(land & (dl == 1) & beachy & ~B["ice"], R["beach"], 1.0 + (n3 > 0.5))
    lip = land & (dl == 1) & ~(beachy & ~B["ice"])
    img[lip] = img[lip] * 0.82 + R["ocean"][2] * 0.18

    # rivers
    if W >= 512:
        rv = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(rv)
        for k, pts in enumerate(geo.RIVERS):
            if W < 1024 and k > 8:
                break
            d.line([((lo + 180) / 360 * W, (90 - la) / 180 * H) for lo, la in pts], fill=255, width=1)
        rmask = (np.asarray(rv) > 0) & land & (dl >= 1) & ~B["ice"]
        put(rmask, R["river"], 1.0)

    # ---- the sea
    near = blur_wrap(land.astype(float), 2.2 / deg)        # ~2 degrees of shelf
    far = blur_wrap(land.astype(float), 7.0 / deg)         # continental slope
    depth = np.clip(1 - far * 3.2, 0, 1) * 0.75 + (1 - n1) * 0.3 + (n2 - 0.5) * 0.3
    otone = 7.2 - depth * 7.0
    shelf = water & (near + (n2 - 0.5) * 0.12 > 0.16)
    otone = np.where(shelf, np.maximum(otone, 6.6 + (n3 - 0.5) * 1.2 + np.clip(near - 0.3, 0, 1) * 3), otone)
    # stepped bands, dithered at their edges
    q = np.floor(otone) + (otone - np.floor(otone) > by)
    put(water, R["ocean"], q)
    surf = water & (dw == 1) & (n3 > 0.47) & (np.abs(lat) < 68)
    put(surf, R["surf"], np.where(n2 > 0.5, 1, 0))
    # wave marks: little "~" dashes on a jittered grid, two phases that twinkle in turn
    wcx, wcy = max(5, int(round(9 * s ** 0.5))), max(3, int(round(5 * s ** 0.5)))
    gx_, gy_ = xx // wcx, yy // wcy
    wox = xx - gx_ * wcx - (hash2(gx_, gy_, 71) * (wcx - 3)).astype(int)
    woy = yy - gy_ * wcy - (hash2(gx_, gy_, 72) * (wcy - 2)).astype(int)
    wave_on = water & (dw > 2) & ~shelf & (hash2(gx_, gy_, 73) < 0.42) & (np.abs(lat) < 70)
    dash = wave_on & (((woy == 0) & ((wox == 1) | (wox == 2))) | ((woy == 1) & (wox == 0)))
    under = wave_on & (woy == 1) & ((wox == 1) | (wox == 2))
    img[dash] = img[dash] * 0.45 + R["ocean"][9] * 0.55
    img[under] = img[under] * 0.85 + R["ocean"][0] * 0.15
    phase = hash2(gx_, gy_, 74) < 0.5

    # sea ice at the poles
    seaice = water & (((lat > 70) & (fbm(P, 6.0, 4, 81) + (lat - 79) / 14 > 0.55)) | ((lat < -64) & (near > 0.22) & (fbm(P, 7.0, 4, 82) > 0.42)))
    put(seaice, R["snow"], 4.4 + clusters * 0.9)
    put(seaice & (np.abs(fbm(P, 18.0, 2, 83) - 0.5) < 0.03), R["snow"], 1.8)

    # ---- photo-based colour (as in BUSHED): real CC0 photos of leaves, rock and dry earth tiled over their biomes,
    # their relief and hue drift worked into the paint, so the land has the mottled richness of a real surface
    def photo(name, tile):
        im = Image.open(os.path.join(PHOTOS, name, "diff.jpg")).convert("RGB").resize((tile, tile), Image.BOX)
        a = np.asarray(im, np.float64)
        a = a / a.reshape(-1, 3).mean(0)
        reps = (H // tile + 1, W // tile + 1, 1)
        return np.tile(a, reps)[:H, :W]
    tile = max(32, int(96 * s))
    leaves, rock, earth = photo("forest_leaves_02", tile), photo("rock_face_03", tile), photo("clay_floor_001", tile)
    veg = land & (B["temperate"] | B["boreal"] | B["rain"])
    dry = land & (B["desert"] | B["savanna"] | B["steppe"])
    stony = land & (mtn | B["tundra"])
    for m, ph, k in ((veg, leaves, 0.55), (dry, earth, 0.45), (stony, rock, 0.5)):
        img[m] = img[m] * (1 - k + k * np.clip(ph[m], 0.6, 1.5))

    # ---- the hand-made map look: an uneven ink line round every coast, muted colours, paper grain
    ink = np.array([74.0, 62.0, 50.0])
    coast = land & (dl == 1) & ~B["ice"] & (hash2(xx // 2, yy // 2, 201) > 0.12)
    img[coast] = img[coast] * 0.3 + ink * 0.7
    lum = img @ np.array([0.3, 0.59, 0.11])
    img = img * 0.7 + (lum[..., None] * np.array([1.05, 1.0, 0.9])[None, None]) * 0.3
    grain = (fbm(P, 60.0, 2, 203) - 0.5) * 0.1
    img = img * (1 + grain[..., None])
    img = np.round(img / 4) * 4          # back onto a stepped palette

    alpha = np.full((H, W), 255, np.uint8)
    alpha[water & ~seaice] = 240
    alpha[dash & phase & ~seaice] = 224
    alpha[dash & ~phase & ~seaice] = 208
    day = np.dstack([np.clip(img, 0, 255).astype(np.uint8), alpha])

    # ---- night: moonlit world plus warm lamps
    lum = img @ np.array([0.3, 0.59, 0.11])
    night = img * 0.16 + NIGHT_SKY * 0.55 + lum[..., None] * np.array([0.05, 0.07, 0.11])[None, None]
    night = np.where(water[..., None], night * 0.85, night)
    # stepped back onto a few tones so it stays pixel art
    night = np.round(night / 6) * 6
    lit = np.zeros((H, W))
    for (cx, cy), (rx, ry), k in geo.LIT:
        dx = ((lon - cx + 180) % 360 - 180) / rx
        dy = (lat - cy) / ry
        lit = np.maximum(lit, k * np.clip(1 - np.sqrt(dx * dx + dy * dy), 0, 1))
    rnd = hash2(xx, yy, 91)
    town = land & ~B["ice"] & (rnd < lit * 0.11 * (0.6 + n2)) & (elev < 0.6)
    lv = np.zeros((H, W))
    lv[town] = 1.6 + hash2(xx, yy, 92)[town] * 1.2
    for (lo, la, b) in geo.CITIES:
        x0 = (lo + 180) / 360 * W
        y0 = (90 - la) / 180 * H
        rad = max(1.0, (0.35 + b * 0.75) / deg * 0.55)
        x_lo, x_hi = int(math.floor(x0 - rad - 1)), int(math.ceil(x0 + rad + 1))
        y_lo, y_hi = max(0, int(math.floor(y0 - rad - 1))), min(H - 1, int(math.ceil(y0 + rad + 1)))
        for y in range(y_lo, y_hi + 1):
            for x in range(x_lo, x_hi + 1):
                xw = x % W
                r_ = math.hypot((x + 0.5 - x0), (y + 0.5 - y0)) / rad
                if r_ > 1.05:
                    continue
                h = float(hash2(np.array([xw]), np.array([y]), 93)[0])
                core = 1 - r_
                if h < 0.25 + core * 0.95 and land[y, xw]:
                    lv[y, xw] = max(lv[y, xw], 1.8 + core * 3.4 * b + h * 0.6)
    lampm = lv > 0
    night[lampm] = pick(R["lamp"], lv[lampm])
    # a soft halo of dim amber round the brightest towns
    glow = np.zeros((H, W), bool)
    br = lv > 3.6
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        glow |= np.roll(np.roll(br, dx, 1), dy, 0)
    glow &= ~lampm & land
    night[glow] = night[glow] * 0.55 + R["lamp"][1] * 0.45
    ngt = np.dstack([np.clip(night, 0, 255).astype(np.uint8), alpha])
    return day, ngt


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "public", "models", "globe")
    os.makedirs(out, exist_ok=True)
    mask = land_mask(decode_topo(src))
    for W in (1024, 512, 256, 128):
        day, night = paint_level(mask, W)
        Image.fromarray(day, "RGBA").save(os.path.join(out, f"earth_day_{W}.png"), optimize=True)
        Image.fromarray(night, "RGBA").save(os.path.join(out, f"earth_night_{W}.png"), optimize=True)
        print(W, os.path.getsize(os.path.join(out, f"earth_day_{W}.png")) // 1024, "KB day,",
              os.path.getsize(os.path.join(out, f"earth_night_{W}.png")) // 1024, "KB night", flush=True)


if __name__ == "__main__":
    main()
