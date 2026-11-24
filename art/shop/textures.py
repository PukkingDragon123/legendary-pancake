"""The lodge store's tiling textures (public/models/shop/tex/*.webp), from BUSHED's pixel-art PBR set (CC0 Poly Haven
scans, palette-quantised at ~256 px/m by BUSHED's tools/make_textures.py) recoloured for Barnaby's lodge, plus a
burlap weave painted here. Lossless WebP, so the pixels stay exactly as painted.

    python3 art/shop/textures.py <bushed>/public/assets/textures
"""
import os
import sys

import numpy as np
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'models', 'shop', 'tex')
os.makedirs(OUT, exist_ok=True)


def load(rel):
    return np.asarray(Image.open(os.path.join(SRC, rel)).convert('RGB')).astype(np.float32) / 255


def save(a, name, size=None):
    im = Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
    if size:
        im = im.resize(size, Image.NEAREST)
    im.save(os.path.join(OUT, name + '.webp'), lossless=True, quality=100, method=6)
    print(name, im.size, os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024, 'KB')


def grade(a, mul=(1, 1, 1), sat=1.0, gamma=1.0, add=(0, 0, 0)):
    a = a ** gamma
    l = (a * [0.3, 0.59, 0.11]).sum(-1, keepdims=True)
    a = l + (a - l) * sat
    return a * np.array(mul) + np.array(add)


# peeled logs (the beaver strips the bark), honey and warm
save(grade(load('places/log_int.png'), mul=(1.04, 0.98, 0.9), sat=1.12), 'log')
save(load('places/log_int_n.png'), 'log_n')
# end grain caps (four per tile: two fresh, two weathered)
save(grade(load('places/endgrain.png'), mul=(1.03, 0.99, 0.92), sat=1.08), 'end')
# bark on the ceiling sticks and the stumps: warmed from grey to a rich brown
b = load('places/bark_light.png')
save(grade(b, mul=(0.92, 0.72, 0.52), sat=0.6, gamma=1.15), 'bark')
save(load('places/bark_light_n.png'), 'bark_n')
# mud chinking between the logs: the plaster turned to river mud with a few stalks of straw in it
c = grade(load('places/chink.png'), mul=(0.62, 0.5, 0.38), sat=0.4, gamma=1.25)
rng = np.random.default_rng(3)
H, W = c.shape[:2]
for _ in range(140):
    x, y, ln = rng.integers(0, W), rng.integers(0, H), rng.integers(4, 12)
    dx = rng.choice([-1, 1])
    for k in range(ln):
        c[(y + k // 3) % H, (x + k * dx) % W] = (0.78, 0.66, 0.42) if k % 3 else (0.64, 0.52, 0.32)
save(c, 'chink')
# floorboards and warm boards (counter top, shelves, barrel staves)
save(grade(load('places/floor.png'), mul=(1.08, 0.98, 0.86), sat=1.15, gamma=0.92), 'floor')
save(load('places/floor_n.png'), 'floor_n')
save(grade(load('places/board_warm.png'), mul=(1.04, 0.98, 0.9), sat=1.1), 'board')

# burlap for the acorn sacks: an open basket weave of hairy jute threads, painted per pixel
N = 96
yy, xx = np.mgrid[0:N, 0:N]
cell = 6
u, v = xx % cell, yy % cell
over = ((xx // cell + yy // cell) % 2) == 0
warp = (u >= 1) & (u <= 4)
weft = (v >= 1) & (v <= 4)
ramp = np.array([[0.36, 0.26, 0.16], [0.5, 0.37, 0.22], [0.62, 0.47, 0.29], [0.72, 0.57, 0.36], [0.82, 0.68, 0.46]])
idx = np.full((N, N), 0.0)
idx = np.where(warp & (~weft | over), 2.6 + (u == 1) * 0.7 - (u == 4) * 0.8, idx)
idx = np.where(weft & (~warp | ~over), 2.4 + (v == 1) * 0.7 - (v == 4) * 0.8, idx)
idx = np.where(~warp & ~weft, 0.4, idx)
noise = rng.random((N, N))
idx += (noise - 0.5) * 0.9
# slubs and stray hairs
for _ in range(90):
    x, y = rng.integers(0, N), rng.integers(0, N)
    for k in range(rng.integers(2, 6)):
        idx[(y + k) % N, (x + k * rng.choice([-1, 0, 1])) % N] = 3.6
burlap = ramp[np.clip(np.round(idx), 0, 4).astype(int)]
save(burlap, 'burlap')
