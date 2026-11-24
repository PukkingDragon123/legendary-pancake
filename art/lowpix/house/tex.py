"""The hollow oak's textures: crisp, palette-limited pixel-art versions of CC0 Poly Haven scans (bark, deck boards,
door boards, shutter planks; vendored in art/lowpix/house/photos, see docs/credits/house4.md), plus generated pixel
art (moss cushions and the crown's leaf atlas: lobed oak-leaf clusters, sprays, acorn sprigs, ivy and ferns).
Written to public/models/house/tex/ for src/world/house/oak.ts and crown.ts. No directional light is painted in:
only cavity/AO and form, the scene's light does the rest.

    python3 art/lowpix/house/tex.py [bark|wood|moss|leaves ...]
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PH = os.path.join(HERE, 'photos')
OUT = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'public', 'models', 'house', 'tex'))


def save(im, name, q=92, lossless=False):
    p = os.path.join(OUT, name)
    im.save(p, 'WEBP', quality=q, lossless=lossless, method=6)
    print(name, im.size, os.path.getsize(p) // 1024, 'KB')


def quantize(im, n, alpha=None):
    """Palette-limit an RGB image (no dither) and clean isolated single pixels (pixel-art clusters, not noise)."""
    q = im.convert('RGB').quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    a = np.array(q)
    pal = np.array(q.getpalette()[:n * 3]).reshape(-1, 3)
    h, w = a.shape
    out = a.copy()
    for y in range(h):
        for x in range(w):
            c = a[y, x]
            nb = [a[(y + dy) % h, (x + dx) % w] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if all(v != c for v in nb):
                # adopt the most common neighbour
                out[y, x] = max(set(nb), key=nb.count)
    rgb = pal[out].astype(np.uint8)
    return Image.fromarray(rgb, 'RGB')


def hsv_grade(rgb, sat=1.0, val=1.0, warm=0.0, contrast=1.0):
    """rgb float 0..1 array -> graded; warm shifts lights to honey and shadows a touch cooler."""
    lum = (rgb * [0.299, 0.587, 0.114]).sum(-1, keepdims=True)
    rgb = lum + (rgb - lum) * sat
    rgb = 0.5 + (rgb - 0.5) * contrast
    rgb = rgb * val
    rgb = rgb + warm * np.concatenate([lum * 0.10, lum * 0.03, -lum * 0.07], -1) - warm * np.concatenate([(1 - lum) * 0.01, 0 * lum, -(1 - lum) * 0.02], -1)
    return np.clip(rgb, 0, 1)


def load(name, k='diff', size=None):
    im = Image.open(os.path.join(PH, name, k + '.jpg'))
    if size:
        im = im.resize((size, size), Image.LANCZOS)
    return im


# ------------------------------------------------------------------ bark

def bark():
    """Old oak bark: deep vertical furrows and blocky ridges, grey-brown with warm undertones. The scan's moss is
    calmed to bark colour (the shader lays real moss where it belongs); AO deepens the furrows."""
    S = 512
    d = np.asarray(load('bark_brown_02', 'diff', S)).astype(np.float32) / 255
    ao = np.asarray(load('bark_brown_02', 'ao', S)).astype(np.float32)[..., None] / 255
    # pull greenish (mossy) texels back to bark: hue towards brown, less saturation
    r, g, b = d[..., 0], d[..., 1], d[..., 2]
    green = np.clip((g - np.maximum(r, b)) * 6 + 0.1, 0, 1)[..., None]
    lum = (d * [0.3, 0.59, 0.11]).sum(-1, keepdims=True)
    brown = lum * np.array([1.12, 0.96, 0.8])
    d = d * (1 - green) + brown * green
    d = d * (0.45 + 0.55 * ao ** 1.4)
    # the scan's pale lichen crusts read as birch-white streaks on our oak: compress the highlights, warm them
    lum = (d * [0.3, 0.59, 0.11]).sum(-1, keepdims=True)
    knee = 0.36
    k = np.where(lum > knee, (knee + (lum - knee) * 0.35) / np.maximum(lum, 1e-4), 1.0)
    d = d * k
    hi = np.clip((lum - knee) * 3, 0, 1)
    d = d * (1 - hi * 0.25) + hi * 0.25 * d.mean(-1, keepdims=True) * np.array([1.1, 0.98, 0.86])
    d = hsv_grade(d, sat=1.08, val=1.0, warm=0.55, contrast=1.16)
    # slight local contrast (ridges pop against the furrows)
    im = Image.fromarray((d * 255).astype(np.uint8))
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    im = quantize(im, 40)
    save(im, 'bark.webp', 90)
    n = load('bark_brown_02', 'nor', 256)
    save(n, 'bark_n.webp', 88)


# ------------------------------------------------------------------ wood (decks, doors, shutters)

def wood():
    for src, name, size, sat, val, warm, con in (
        ('wood_floor_deck', 'deck', 256, 0.72, 1.12, 0.05, 1.04),
        ('rough_pine_door', 'door', 256, 1.0, 1.12, 0.35, 1.06),
        ('wood_shutter', 'planks', 256, 0.95, 1.0, 0.25, 1.08),
    ):
        d = np.asarray(load(src, 'diff', size)).astype(np.float32) / 255
        d = hsv_grade(d, sat=sat, val=val, warm=warm, contrast=con)
        im = Image.fromarray((d * 255).astype(np.uint8))
        im = quantize(im, 36)
        save(im, name + '.webp', 90)


# ------------------------------------------------------------------ periodic noise helpers

def pnoise(n, scale, seed):
    """Tileable smooth noise in 0..1 (random field low-passed in the Fourier domain)."""
    rng = np.random.default_rng(seed)
    f = np.fft.fft2(rng.standard_normal((n, n)))
    ky = np.fft.fftfreq(n)[:, None]
    kx = np.fft.fftfreq(n)[None, :]
    k = np.sqrt(kx * kx + ky * ky)
    f *= np.exp(-(k * scale) ** 2)
    v = np.real(np.fft.ifft2(f))
    return (v - v.min()) / (v.max() - v.min() + 1e-9)


# ------------------------------------------------------------------ moss

def moss():
    """Moss cushions: clumps of tiny star-shaped shoots, bright where they bulge, deep green in the hollows,
    with a scatter of rust-orange spore stalks. Tileable."""
    S = 256
    rng = random.Random(5)
    base = pnoise(S, 14, 1)
    fine = pnoise(S, 3, 2)
    # cushions: sum of soft domes
    dome = np.zeros((S, S), np.float32)
    yy, xx = np.mgrid[0:S, 0:S]
    for _ in range(420):
        cx, cy, r = rng.uniform(0, S), rng.uniform(0, S), rng.uniform(4, 11)
        dx = (xx - cx + S / 2) % S - S / 2
        dy = (yy - cy + S / 2) % S - S / 2
        dd = np.sqrt(dx * dx + dy * dy) / r
        dome = np.maximum(dome, np.clip(1 - dd * dd, 0, 1))
    h = dome * 0.38 + base * 0.42 + fine * 0.32
    pal = np.array([[22, 52, 26], [34, 74, 30], [52, 100, 34], [74, 126, 38], [104, 150, 46], [140, 174, 62], [176, 196, 92]], np.float32)
    k = np.clip(h * 1.25 - 0.1, 0, 0.999) * (len(pal) - 1)
    i0 = k.astype(int)
    rgb = pal[i0]
    # shoots: a fine stipple of lighter texels on the domes
    st = (fine > 0.62) & (dome > 0.3)
    rgb[st] = np.minimum(255, rgb[st] * 1.18 + 8)
    img = rgb.astype(np.uint8)
    for _ in range(90):
        x, y = rng.randrange(S), rng.randrange(S)
        img[y % S, x % S] = (176, 98, 46)
        img[(y + 1) % S, x % S] = (120, 78, 40)
    im = quantize(Image.fromarray(img), 24)
    save(im, 'moss.webp', 92)


# ------------------------------------------------------------------ leaves

GREENS = [  # sRGB leaf base colours: emerald, spring, olive, sap, deep, yellow-green
    (52, 132, 54), (84, 156, 48), (100, 130, 40), (62, 146, 72), (38, 102, 50), (130, 170, 52), (70, 124, 38), (46, 118, 60)]


def oak_outline(u, lobes, W):
    """Half-width of an oak leaf at u in 0..1 (stalk..tip): rounded lobes with deep sinuses, little ears at the base."""
    env = math.sin(math.pi * min(1.0, u ** 0.85 * 1.02)) ** 0.65
    env *= 0.55 + 0.45 * min(1.0, u * 2.5)
    lob = 0.42 + 0.58 * abs(math.cos(math.pi * u * lobes + 0.4)) ** 0.7
    ear = 0.35 * math.exp(-((u - 0.06) / 0.05) ** 2)
    return W * (env * lob + ear)


def ivy_outline(u, W):
    """Ivy: a broad three-to-five-pointed leaf."""
    env = math.sin(math.pi * min(1.0, u)) ** 0.5
    pts = 0.7 + 0.3 * abs(math.cos(math.pi * u * 1.5 + 0.2))
    return W * env * pts * (1.2 - 0.5 * u)


class Canvas:
    """RGBA float canvas at 4x supersampling; leaves are painted back to front."""
    SS = 4

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.c = np.zeros((h * self.SS, w * self.SS, 4), np.float32)
        self.clip = (0, 0, w, h)

    def leaf(self, cx, cy, ang, L, W, col, depth, kind='oak', lobes=4.5, fold=1, rib=True):
        S = self.SS
        cx, cy, L, W = cx * S, cy * S, L * S, W * S
        ca, sa = math.cos(ang), math.sin(ang)
        r = L + W
        k0, k1, k2, k3 = self.clip
        x0, x1 = int(max(k0 * S + S, cx - r)), int(min(k2 * S - S, cx + r))
        y0, y1 = int(max(k1 * S + S, cy - r)), int(min(k3 * S - S, cy + r))
        if x1 <= x0 or y1 <= y0:
            return
        ys, xs = np.mgrid[y0:y1, x0:x1].astype(np.float32) + 0.5
        dx, dy = xs - cx, ys - cy
        u = (dx * ca + dy * sa) / L
        v = (-dx * sa + dy * ca)
        if kind == 'oak':
            hw = np.vectorize(lambda t: oak_outline(t, lobes, W) if 0 <= t <= 1 else -1.0)(np.clip(u, -0.01, 1.01))
        else:
            hw = np.vectorize(lambda t: ivy_outline(t, W) if 0 <= t <= 1 else -1.0)(np.clip(u, -0.01, 1.01))
        inside = (np.abs(v) <= hw) & (u >= 0) & (u <= 1)
        if not inside.any():
            return
        base = np.array(col, np.float32) / 255
        rel = np.abs(v) / np.maximum(hw, 1e-3)
        shade = np.where(v * fold > 0, 1.06, 0.9)            # the leaf folds along its midrib
        shade = shade * (1 - 0.22 * np.clip((rel - 0.72) / 0.28, 0, 1))  # darker rim
        shade = shade * (0.92 + 0.16 * u)                     # tips catch more light (sunlit tips)
        c = base[None, None, :] * shade[..., None]
        if rib:
            rib_m = (np.abs(v) < 0.55 * S) & (u > 0.04) & (u < 0.92)
            c[rib_m] = c[rib_m] * 0.65 + np.array([0.78, 0.82, 0.42]) * 0.35
            # side veins
            vein = (np.abs(((u * 7 + rel * 1.6) % 1) - 0.5) < 0.07) & (rel < 0.8) & (rel > 0.12)
            c[vein] = c[vein] * 0.88 + np.array([0.7, 0.78, 0.4]) * 0.12
        c = c * depth
        a = self.c[y0:y1, x0:x1]
        # contact shadow: darken what is already under the new leaf's footprint, just outside it
        grow = inside.copy()
        for sh in ((S, S), (S * 2, S // 2)):
            g2 = np.zeros_like(inside)
            g2[sh[0]:, sh[1]:] = inside[:-sh[0], :-sh[1]]
            grow |= g2
        occl = grow & ~inside & (a[..., 3] > 0)
        a[occl, :3] *= 0.72
        a[inside, :3] = c[inside]
        a[inside, 3] = 1.0

    def line(self, pts, width, col):
        S = self.SS
        col = np.array(col, np.float32) / 255
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            n = int(max(abs(xb - xa), abs(yb - ya)) * S * 1.5) + 1
            for i in range(n + 1):
                t = i / n
                x, y = (xa + (xb - xa) * t) * S, (ya + (yb - ya) * t) * S
                r = width * S / 2
                xi0, xi1 = int(max(0, x - r)), int(min(self.w * S, x + r + 1))
                yi0, yi1 = int(max(0, y - r)), int(min(self.h * S, y + r + 1))
                if xi1 > xi0 and yi1 > yi0:
                    self.c[yi0:yi1, xi0:xi1, :3] = col
                    self.c[yi0:yi1, xi0:xi1, 3] = 1

    def acorn(self, x, y, s):
        S = self.SS
        ys, xs = np.mgrid[0:self.h * S, 0:self.w * S].astype(np.float32) + 0.5
        dx, dy = (xs - x * S) / (s * S), (ys - y * S) / (s * S)
        nut = (dx * dx / 0.36 + (dy - 0.45) ** 2 / 0.7) < 1
        cup = (dx * dx / 0.5 + (dy + 0.05) ** 2 / 0.16) < 1
        sh = np.clip(0.75 + 0.35 * (-dx), 0.6, 1.1)
        nutc = np.array([0.72, 0.52, 0.22])[None, None, :] * sh[..., None]
        cupc = np.array([0.42, 0.33, 0.2])[None, None, :] * (0.9 + 0.2 * ((xs // S + ys // S) % 2))[..., None]
        self.c[nut, :3] = nutc[nut]
        self.c[nut, 3] = 1
        self.c[cup, :3] = cupc[cup]
        self.c[cup, 3] = 1

    def image(self):
        S = self.SS
        c = self.c.reshape(self.h, S, self.w, S, 4)
        a = c[..., 3].mean(axis=(1, 3))
        w = c[..., 3:4]
        rgb = (c[..., :3] * w).sum(axis=(1, 3)) / np.maximum(w.sum(axis=(1, 3)), 1e-6)
        alpha = (a > 0.45).astype(np.float32)
        return rgb, alpha


def oak_cluster(cv, ox, oy, size, rng, n, spread, hang=False, sprig=False):
    """A cluster of oak leaves round a twig: leaves fan out from a few short twigs, back leaves darker."""
    cv.clip = (ox, oy, ox + size, oy + size)
    cx, cy = ox + size / 2, oy + size / 2 + (0 if not hang else -size * 0.22)
    twig = []
    base_ang = rng.uniform(-math.pi, math.pi)
    leaves = []
    for i in range(n):
        a = base_ang + rng.uniform(-math.pi, math.pi) * spread
        if hang:
            a = math.pi / 2 + rng.uniform(-0.9, 0.9)
        dist = rng.uniform(0.0, 0.13) * size
        L = rng.uniform(0.24, 0.31) * size
        W = L * rng.uniform(0.32, 0.38)
        sx = cx + math.cos(a) * dist + rng.uniform(-0.04, 0.04) * size
        sy = cy + math.sin(a) * dist + rng.uniform(-0.04, 0.04) * size
        leaves.append((rng.random(), sx, sy, a + rng.uniform(-0.5, 0.5), L, W))
        twig.append((sx, sy))
    leaves.sort()
    # twigs first (under the leaves)
    for (sx, sy) in twig[::2]:
        cv.line([(cx, cy), ((cx + sx) / 2 + rng.uniform(-2, 2), (cy + sy) / 2), (sx, sy)], 1.2, (92, 70, 48))
    for k, (dep, sx, sy, a, L, W) in enumerate(leaves):
        col = GREENS[rng.randrange(len(GREENS))]
        col = tuple(min(255, max(0, int(ch * rng.uniform(0.9, 1.1)))) for ch in col)
        depth = 0.62 + 0.42 * (k / max(1, n - 1))
        cv.leaf(sx, sy, a, L, W, col, depth, lobes=rng.uniform(3.6, 5.2), fold=rng.choice((-1, 1)))
    if sprig:
        for j in range(rng.randint(2, 3)):
            ax, ay = cx + rng.uniform(-0.12, 0.12) * size, cy + rng.uniform(0.05, 0.2) * size
            cv.line([(cx, cy), (ax, ay - size * 0.05)], 1.2, (92, 70, 48))
            cv.acorn(ax, ay, size * 0.075)


def ivy_strand(cv, ox, oy, w, h, rng):
    """A climbing ivy strand running the height of the cell (tiles vertically), dark glossy leaves either side."""
    cv.clip = (ox, oy - 1, ox + w, oy + h + 1)
    x = ox + w / 2
    pts = []
    for y in range(0, h + 1, 4):
        x = ox + w / 2 + math.sin((y / h) * math.pi * 2 + rng.uniform(-0.2, 0.2)) * w * 0.12
        pts.append((x, oy + y))
    cv.line(pts, 1.4, (86, 66, 44))
    ivy_greens = [(38, 86, 44), (48, 104, 50), (30, 72, 40), (60, 112, 46)]
    for i in range(int(h / 7)):
        t = (i + 0.5) / (h / 7)
        y = oy + t * h
        px = ox + w / 2 + math.sin(t * math.pi * 2) * w * 0.12
        side = 1 if i % 2 else -1
        a = (0 if side > 0 else math.pi) + rng.uniform(-0.6, 0.6) - 0.5 * side
        L = rng.uniform(0.2, 0.3) * w
        cv.line([(px, y), (px + math.cos(a) * L * 0.3, y + math.sin(a) * L * 0.3)], 1, (86, 66, 44))
        col = ivy_greens[rng.randrange(len(ivy_greens))]
        cv.leaf(px + math.cos(a) * L * 0.3, y + math.sin(a) * L * 0.3, a, L, L * 0.55, col, rng.uniform(0.85, 1.05), kind='ivy', fold=side)


def fern(cv, ox, oy, size, rng):
    """A fern frond arching up out of the cell's bottom edge."""
    cv.clip = (ox, oy, ox + size, oy + size + 1)
    cx = ox + size * 0.5
    base = (cx, oy + size - 1)
    pts = []
    bend = rng.uniform(-0.25, 0.25)
    for i in range(16):
        t = i / 15
        pts.append((cx + math.sin(t * 1.6) * size * bend + t * t * size * 0.08, oy + size - 1 - t * size * 0.9))
    cv.line(pts, 1.4, (70, 96, 40))
    for i in range(2, 15):
        t = i / 15
        px, py = pts[i]
        L = size * 0.22 * math.sin(math.pi * (0.15 + t * 0.85)) + 2
        for side in (-1, 1):
            a = -math.pi / 2 + side * (1.2 - t * 0.4)
            col = (70 + int(t * 40), 128 + int(t * 30), 46)
            cv.leaf(px, py, a, L, L * 0.28, col, 0.8 + t * 0.25, kind='oak', lobes=2.0, rib=False)


def twig(cv, ox, oy, size, rng):
    """Bare twiglets with a few leaves (breaks up the crown's edge)."""
    cv.clip = (ox, oy, ox + size, oy + size)
    cx, cy = ox + size * 0.5, oy + size * 0.85
    for k in range(3):
        a = -math.pi / 2 + rng.uniform(-0.9, 0.9)
        L = size * rng.uniform(0.45, 0.7)
        ex, ey = cx + math.cos(a) * L, cy + math.sin(a) * L
        cv.line([(cx, cy), ((cx + ex) / 2 + rng.uniform(-3, 3), (cy + ey) / 2), (ex, ey)], 1.6 - k * 0.3, (96, 74, 52))
        for j in range(3):
            t = 0.45 + j * 0.25
            lx, ly = cx + (ex - cx) * t, cy + (ey - cy) * t
            col = GREENS[rng.randrange(len(GREENS))]
            cv.leaf(lx, ly, a + rng.uniform(-1.2, 1.2), size * 0.2, size * 0.07, col, rng.uniform(0.8, 1.05))


def bleed(rgb, alpha, it=12):
    """Spread colour into transparent texels so mipmaps don't fringe dark."""
    rgb = rgb.copy()
    known = alpha > 0
    for _ in range(it):
        acc = np.zeros_like(rgb)
        cnt = np.zeros(alpha.shape, np.float32)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            r = np.roll(np.roll(rgb, dy, 0), dx, 1)
            k = np.roll(np.roll(known, dy, 0), dx, 1)
            acc[k] += r[k]
            cnt[k] += 1
        new = (~known) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]
        known = known | new
    return rgb


def leaves():
    """1024 x 512 atlas of 128 px cells, 8 x 4:
    row 0: dense clusters (the body of the crown), row 1: open sprays (the crown's edge), row 2: four acorn sprigs and
    four hanging clusters, row 3: two ivy strands (each two cells tall... one cell, tiling), two ferns, two twiglets,
    two dense dark clusters (deep inside)."""
    C = 128
    cv = Canvas(8 * C, 4 * C)
    rng = random.Random(42)
    for i in range(8):
        oak_cluster(cv, i * C, 0, C, rng, rng.randint(17, 22), 1.0)
    for i in range(8):
        oak_cluster(cv, i * C, C, C, rng, rng.randint(9, 12), 0.55)
    for i in range(4):
        oak_cluster(cv, i * C, 2 * C, C, rng, rng.randint(8, 10), 0.6, sprig=True)
    for i in range(4, 8):
        oak_cluster(cv, i * C, 2 * C, C, rng, rng.randint(10, 13), 0.5, hang=True)
    for i in range(2):
        ivy_strand(cv, i * C, 3 * C, C, C, rng)
    for i in range(2, 4):
        fern(cv, i * C, 3 * C, C, rng)
    for i in range(4, 6):
        twig(cv, i * C, 3 * C, C, rng)
    for i in range(6, 8):
        oak_cluster(cv, i * C, 3 * C, C, rng, 24, 1.0)
    rgb, alpha = cv.image()
    # palette-limit the opaque texels
    im = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
    q = np.asarray(quantize_fast(im, 64)).astype(np.float32) / 255
    q = bleed(q, alpha)
    out = np.concatenate([q, alpha[..., None]], -1)
    img = Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8), 'RGBA')
    save(img, 'leaves.webp', lossless=True)
    img.resize((img.width, img.height), Image.NEAREST).save('/tmp/leaves_preview.png')


def quantize_fast(im, n):
    q = im.convert('RGB').quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return q.convert('RGB')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    want = sys.argv[1:] or ['bark', 'wood', 'moss', 'leaves']
    for k in want:
        globals()[k]()
