"""Real wall art for the interview office: public-domain works from the Art Institute of Chicago, pixel-graded.

    ~/.cache/lowpix-venv/bin/python art/lowpix/interview/wallart.py

Each work is fetched from the AIC IIIF image server (public-domain images; the API data is CC0), cropped to the frame's
aspect, downsampled to a small texel grid (so it reads as crisp pixel art at the room's texel density), gently graded
towards the palette and saved as public/models/interview/art/<id>.webp. Credits: docs/credits/interview3.md.
"""
import io
import os
import urllib.request

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
DEST = os.path.join(ROOT, 'public', 'models', 'interview', 'art')

# id: (AIC artwork id, image_id, texel width, texel height, title / artist / date for the credits)
ART = {
    'mountain_brook': (146701, 'd55b0cfc-0716-d6cd-3b38-5742903ce046', 132, 98, 'Mountain Brook, Albert Bierstadt, 1863'),
    'nocturne': (56905, '50034c7f-ce51-00f1-430e-a6f7efc233fc', 90, 58, 'Nocturne: Blue and Gold, Southampton Water, James McNeill Whistler, 1872'),
    'cranes': (21720, 'cc5fce96-3635-35da-e7fd-a68f4b2a26c3', 56, 54, 'Cranes on snow-covered pine, Katsushika Hokusai, c. 1834'),
}

PAL = np.array([[(c >> 16) & 255, (c >> 8) & 255, c & 255] for c in (
    0x2e2b24, 0x4b463a, 0x6f6856, 0xf4eedd, 0xeae0c8, 0xdccfb0, 0xc9b78d, 0xd8bf98, 0xbf9d74, 0x9c7a56, 0x6f553d, 0x4a392b,
    0xc4cfa3, 0xa7b788, 0x86a06a, 0x66844f, 0x557343, 0x3f5a3b, 0x2c4030, 0xd3e0dc, 0xaec8cc, 0x86a9b0, 0x617f8c, 0x46596a,
    0x27313f, 0x1b222d, 0xf1d39a, 0xdcb072, 0xc59a52, 0xc0866a, 0xa66c55, 0xd9aca4, 0x9e5f66, 0x6e5266, 0xb4a9c9, 0xf5f7f2,
)], np.float32) / 255


def fetch(image_id):
    url = f'https://www.artic.edu/iiif/2/{image_id}/full/843,/0/default.jpg'
    req = urllib.request.Request(url, headers={'User-Agent': 'hoot-hollow-art-fetch/1.0', 'AIC-User-Agent': 'hoot-hollow-art-fetch'})
    return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=60).read())).convert('RGB')


def cover(im, w, h):
    """Crop to the frame's aspect around the middle, then downsample to w x h texels."""
    a = w / h
    W, H = im.size
    if W / H > a:
        nw = int(H * a)
        im = im.crop(((W - nw) // 2, 0, (W - nw) // 2 + nw, H))
    else:
        nh = int(W / a)
        im = im.crop((0, (H - nh) // 2, W, (H - nh) // 2 + nh))
    return im.resize((w, h), Image.LANCZOS)


def grade(im):
    a = np.asarray(im, np.float32) / 255
    flat = a.reshape(-1, 3)
    d = ((flat[:, None, :] - PAL[None]) ** 2).sum(-1)
    near = PAL[d.argmin(1)].reshape(a.shape)
    out = a * 0.8 + near * 0.2
    out = np.round(out * 255 / 6) * 6  # a limited print, like the rest of the pixel art
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')


if __name__ == '__main__':
    os.makedirs(DEST, exist_ok=True)
    for id, (aid, img, w, h, title) in ART.items():
        im = grade(cover(fetch(img), w, h))
        p = os.path.join(DEST, id + '.webp')
        im.save(p, 'WEBP', lossless=True)
        print(id, aid, title, os.path.getsize(p) // 1024, 'KB')
