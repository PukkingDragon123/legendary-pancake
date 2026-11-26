"""The cuckoo clock's wood figure: three real wood scans packed into one greyscale atlas, public/img/clock/wood.webp.

    python3 src/onboard/tools/clockwood.py [--src <dir with the Poly Haven 2k diffuse JPGs>]

Poly Haven textures (CC0, docs/credits/clock14.md), each tileable, turned so the grain runs down the image (v),
reduced to luminance, levelled (1st..99th percentile to 0..1, the midtones spread) and downsampled to 1024 px:
  x 0..1024     natural_walnut_veneer (1 m)    cathedral figure and pores: the case (walnut, cherry)
  x 1024..2048  oak_veneer_01         (1.83 m) straight grain with ray fleck: the carvings (honey oak, linden)
  x 2048..3072  rough_wood            (0.5 m)  weathered, split, checked grain: the roof's shingles
cuckookit.ts colours each one through a finish's ramp at runtime (one file, every finish) and uses it as a bump map.
"""
import argparse
import io
import os
import urllib.request

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'public', 'img', 'clock', 'wood.webp')
SRC = [('natural_walnut_veneer', True), ('oak_veneer_01', False), ('rough_wood', False)]
URL = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/{0}/{0}_diff_2k.jpg'


def load(name: str, src: str | None) -> Image.Image:
    p = os.path.join(src, f'{name}_diff_2k.jpg') if src else None
    if p and os.path.exists(p):
        return Image.open(p).convert('RGB')
    data = urllib.request.urlopen(urllib.request.Request(URL.format(name), headers={'User-Agent': 'curl/8.5.0'}), timeout=120).read()
    return Image.open(io.BytesIO(data)).convert('RGB')


def level(im: Image.Image) -> np.ndarray:
    a = np.asarray(im, dtype=np.float32) / 255.0
    lum = a[..., 0] * 0.2126 + a[..., 1] * 0.7152 + a[..., 2] * 0.0722
    lo, hi = np.percentile(lum, 0.8), np.percentile(lum, 99.4)
    t = np.clip((lum - lo) / max(1e-4, hi - lo), 0, 1)
    # spread the midtones (a gentle S) so the figure reads under the finish's ramp
    t = t * t * (3 - 2 * t) * 0.45 + t * 0.55
    return t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src')
    a = ap.parse_args()
    tiles = []
    for name, turn in SRC:
        im = load(name, a.src)
        if turn:
            im = im.transpose(Image.Transpose.ROTATE_90)
        im = im.resize((1024, 1024), Image.Resampling.LANCZOS)
        tiles.append(level(im))
    atlas = np.concatenate(tiles, axis=1)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    Image.fromarray((atlas * 255 + 0.5).astype(np.uint8), 'L').save(OUT, 'WEBP', quality=82, method=6)
    print(OUT, os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    main()
