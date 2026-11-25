"""Bakes the UI's material textures (src/ui/real/tex/*.webp) from Poly Haven CC0 1k texture sets plus a few
procedural ones (parchment, kraft, cork, brushed metal). Each photo texture is lit by its own normal map from the
UI's light (top left) so grain, pebbles and weave catch the light, then shrunk to a seamless 512 px tile.
Colour tiles keep their colour; 'detail' tiles are grey (mean 128) and tinted at run time.

usage: python3 art/ui/textures.py <dir with Poly Haven d_<id>.jpg / n_<id>.jpg> <out dir>
"""
import sys
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
N = 512


def load(path):
    return np.asarray(Image.open(path).convert('RGB'), dtype=np.float32) / 255.0


def lit(alb, nor, k=0.9):
    """albedo x (1 + k (N.L - L.z)) with a top-left light, GL normal map (y up)."""
    n = nor * 2 - 1
    L = np.array([-0.5, 0.62, 0.6]); L /= np.linalg.norm(L)
    ndl = n[..., 0] * L[0] + n[..., 1] * L[1] + n[..., 2] * L[2]
    s = 1 + k * (ndl - L[2])
    return np.clip(alb * s[..., None], 0, 1)


def shrink(a, n=N):
    """seamless resize: tile 3x3, resize, keep the middle"""
    big = np.tile(a, (3, 3, 1))
    im = Image.fromarray((np.clip(big, 0, 1) * 255).astype(np.uint8)).resize((n * 3, n * 3), Image.LANCZOS)
    return np.asarray(im, dtype=np.float32)[n:2 * n, n:2 * n] / 255.0


def grade(a, sat=1.0, gain=1.0, gamma=1.0, tint=(1, 1, 1)):
    lum = a @ np.array([0.299, 0.587, 0.114])
    a = lum[..., None] + (a - lum[..., None]) * sat
    a = np.clip(a * gain * np.array(tint), 0, 1) ** gamma
    return np.clip(a, 0, 1)


def detail(a, contrast=1.0):
    """grey detail tile, mean 0.5"""
    lum = a @ np.array([0.299, 0.587, 0.114])
    lum = (lum - lum.mean()) / (lum.std() + 1e-6)
    return np.clip(0.5 + lum * 0.16 * contrast, 0, 1)


def save(name, a, q=82):
    if a.ndim == 2:
        a = np.repeat(a[..., None], 3, axis=2)
    Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8)).save(f'{OUT}/{name}.webp', 'WEBP', quality=q, method=6)


def fnoise(n, beta, seed):
    """periodic 1/f^beta noise in [0,1] (FFT, so it tiles)"""
    r = np.random.default_rng(seed)
    f = np.fft.fft2(r.standard_normal((n, n)))
    fy = np.fft.fftfreq(n)[:, None]; fx = np.fft.fftfreq(n)[None, :]
    rad = np.sqrt(fx ** 2 + fy ** 2); rad[0, 0] = 1
    g = np.real(np.fft.ifft2(f / rad ** beta))
    return (g - g.min()) / (g.max() - g.min())


def aniso(n, sx, sy, seed):
    """periodic stretched noise (fibres, brushing): sx, sy = feature size in px"""
    r = np.random.default_rng(seed)
    f = np.fft.fft2(r.standard_normal((n, n)))
    fy = np.fft.fftfreq(n)[:, None]; fx = np.fft.fftfreq(n)[None, :]
    g = np.exp(-((fx * sx) ** 2 + (fy * sy) ** 2) * 6)
    o = np.real(np.fft.ifft2(f * g))
    return (o - o.mean()) / (o.std() + 1e-6)


def fibres(n, count, seed, length=(10, 40)):
    """a sheet of thin paper fibres (wrapping), values -1..1"""
    r = np.random.default_rng(seed)
    out = np.zeros((n, n), np.float32)
    for _ in range(count):
        x, y = r.uniform(0, n, 2)
        a = r.uniform(0, np.pi)
        L = r.uniform(*length)
        v = r.choice([-1, 1]) * r.uniform(0.3, 1)
        curl = r.uniform(-0.04, 0.04)
        for _t in np.arange(0, L, 0.5):
            a += curl
            x += np.cos(a) * 0.5; y += np.sin(a) * 0.5
            out[int(y) % n, int(x) % n] += v
    return out


def blur(a, r=1.0):
    rr = max(1, int(round(2 * r)))
    k = np.exp(-np.arange(-rr, rr + 1) ** 2 / (2 * r * r)); k /= k.sum()
    for ax in (0, 1):
        a = sum(np.roll(a, i - rr, axis=ax) * k[i] for i in range(len(k)))
    return a


def P(id_):
    return f'{SRC}/d_{id_}.jpg', f'{SRC}/n_{id_}.jpg'


# ---------------------------------------------------------------- woods (colour)
d, n = P('dark_wood')
save('walnut', grade(shrink(lit(load(d), load(n), 0.7)), sat=1.12, gain=1.08, tint=(1.04, 0.98, 0.92)))
d, n = P('oak_veneer_01')
save('oak', grade(shrink(lit(load(d), load(n), 0.7)), sat=1.15, gain=0.98, tint=(1.03, 0.97, 0.88)))

# ---------------------------------------------------------------- leather (colour + grey pebble detail)
lea = shrink(lit(load(f'{SRC}/d_leather_red_02_coll1.jpg'), load(f'{SRC}/n_leather_red_02.jpg'), 1.1))
save('leather', grade(lea, sat=1.05, gain=1.12, tint=(1.05, 0.95, 0.9)))
save('pebble', detail(lea, 1.15))

# ---------------------------------------------------------------- cloth details (grey, tinted at run time)
save('bookcloth', detail(shrink(lit(load(f'{SRC}/d_book_pattern_col1.jpg'), load(f'{SRC}/n_book_pattern.jpg'), 1.2)), 1.0))
d, n = P('rough_linen')
save('linen', detail(shrink(lit(load(d), load(n), 1.0)), 0.9))
d, n = P('velour_velvet')
save('velvet', detail(shrink(lit(load(d), load(n), 1.0)), 0.9))
d, n = P('knitted_fleece')
save('felt', detail(shrink(lit(load(d), load(n), 1.0)), 1.0))

# ---------------------------------------------------------------- parchment (procedural, colour, tiles)
base = np.array([0.93, 0.87, 0.74])
cloud = fnoise(N, 1.15, 11)
blot = fnoise(N, 1.6, 12)
fine = fnoise(N, 0.35, 13)
fib = blur(fibres(N, 2600, 14), 0.7) + blur(fibres(N, 900, 15, (30, 90)), 1.0) * 0.6
fib = fib / (np.abs(fib).max() + 1e-6)
v = 1 + (cloud - 0.5) * 0.10 + (fine - 0.5) * 0.05 + fib * 0.07
warm = (blot - 0.5)
pap = base[None, None, :] * v[..., None]
pap[..., 0] += warm * 0.03; pap[..., 2] -= warm * 0.05
# foxing: a few soft brown specks
r2 = np.random.default_rng(16)
yy, xx = np.mgrid[0:N, 0:N]
for _ in range(26):
    cx, cy, rad = r2.uniform(0, N), r2.uniform(0, N), r2.uniform(1.2, 4.5)
    dx = (xx - cx + N / 2) % N - N / 2; dy = (yy - cy + N / 2) % N - N / 2
    f = np.exp(-(dx * dx + dy * dy) / (2 * rad * rad)) * r2.uniform(0.05, 0.14)
    pap -= f[..., None] * np.array([0.25, 0.4, 0.6])
save('paper', np.clip(pap, 0, 1), 84)

# kraft: browner, more fibre
kb = np.array([0.72, 0.56, 0.38])
kv = 1 + (cloud - 0.5) * 0.12 + (fine - 0.5) * 0.08 + fib * 0.12
save('kraft', np.clip(kb[None, None, :] * kv[..., None], 0, 1), 82)

# ---------------------------------------------------------------- cork (procedural, colour)
c1 = fnoise(N, 0.2, 21); c2 = fnoise(N, 0.9, 22)
gran = blur(np.where(fnoise(N, 0.05, 23) > 0.62, -1.0, 0.0) + np.where(fnoise(N, 0.05, 24) > 0.66, 0.8, 0.0), 0.8)
cv = 1 + (c1 - 0.5) * 0.35 + (c2 - 0.5) * 0.15 + gran * 0.16
cork = np.array([0.74, 0.55, 0.36])[None, None, :] * cv[..., None]
save('cork', np.clip(cork, 0, 1), 80)

# ---------------------------------------------------------------- brushed metal detail (grey)
br = aniso(N, 260, 1.4, 31) * 0.6 + aniso(N, 40, 0.8, 32) * 0.4
save('brushed', np.clip(0.5 + br * 0.09 + (fnoise(N, 1.3, 33) - 0.5) * 0.12, 0, 1), 80)
print('ok')
