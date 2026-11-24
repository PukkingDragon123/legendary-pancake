"""Wall art for Queen Neve's boutique (public/models/shop/art/*.png): real public-domain paintings and prints from the
Art Institute of Chicago (images CC0 / public domain, credits in docs/credits/shop3.md), pixel-graded to fit the
game: downsized to <= 256 px, gently calmed (a touch less saturation, warm lamplight in the highlights), then
quantised per channel with a 4x4 ordered dither so they read as crisp pixel art in the shop.

    python3 src/world/stages/shopart.py <folder with the downloaded jpgs> public/models/shop/art
"""
import sys

from PIL import Image

src, out = sys.argv[1], sys.argv[2]
BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
ART = {"monet_sandvika": 200, "hokusai_cranes": 240, "fantin_flowers": 200, "twachtman_icebound": 200}

for name, longest in ART.items():
    im = Image.open(f"{src}/{name}.jpg").convert("RGB")
    k = longest / max(im.size)
    im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
    px = im.load()
    levels = 14
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b = px[x, y]
            l = 0.3 * r + 0.59 * g + 0.11 * b
            c = [l + (v - l) * 0.86 for v in (r, g, b)]
            w = max(0.0, (l - 150) / 105)
            c = [c[0] + 10 * w, c[1] + 5 * w, c[2] - 6 * w]
            t = (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16 - 0.5
            px[x, y] = tuple(max(0, min(255, round(round(v / 255 * (levels - 1) + t * 0.85) / (levels - 1) * 255))) for v in c)
    im.save(f"{out}/{name}.png", optimize=True)
    print(name, im.size)
