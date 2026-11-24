"""Real paintings for Hollow & Co.'s office walls, packed into one atlas: public/models/interview/art.webp.

    python3 src/onboard/tools/officeart.py

Fetches public-domain works from the Art Institute of Chicago (API data CC0; these images are public domain),
downsamples them to a pixel grid (one texel ~ 3-4 mm of canvas), lifts the shadows a touch and packs them:
  catskill  (0, 0, 384, 255)    George Inness, Catskill Mountains, 1870           artic.edu/artworks/68388
  owl       (384, 0, 128, 352)  Utagawa Hiroshige, Small-horned owl, pine, and crescent moon, 1830s  artic.edu/artworks/47526
  chailly   (0, 256, 310, 250)  Frederic Bazille, Landscape at Chailly, 1865      artic.edu/artworks/44017
The rects are mirrored in src/onboard/office.ts (ART).
"""
import io
import os
import urllib.request

from PIL import Image, ImageEnhance

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'public', 'models', 'interview', 'art.webp')
WORKS = [
    ('catskill', '842d212c-c755-f372-d73f-7d0581051c46', (0, 0, 384, 255)),
    ('owl', '997dc4f5-3a37-5b64-3fa6-efce356ebe01', (384, 0, 128, 352)),
    ('chailly', 'c4648834-49dd-3589-6ac3-66d41fd574ef', (0, 256, 310, 250)),
]


def fetch(image_id: str) -> Image.Image:
    url = f'https://www.artic.edu/iiif/2/{image_id}/full/843,/0/default.jpg'
    req = urllib.request.Request(url, headers={'User-Agent': 'curl/8.5.0'})
    return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=60).read())).convert('RGB')


def main():
    atlas = Image.new('RGB', (512, 512), (40, 28, 20))
    for name, iid, (x, y, w, h) in WORKS:
        im = fetch(iid)
        # crop to the slot's aspect, then box-downsample to the pixel grid
        a, b = w / h, im.width / im.height
        if b > a:
            cw = round(im.height * a); im = im.crop(((im.width - cw) // 2, 0, (im.width - cw) // 2 + cw, im.height))
        else:
            ch = round(im.width / a); im = im.crop((0, (im.height - ch) // 2, im.width, (im.height - ch) // 2 + ch))
        im = im.resize((w, h), Image.BOX)
        im = ImageEnhance.Contrast(im).enhance(1.06)
        im = ImageEnhance.Color(im).enhance(1.08)
        # a limited print: quantise each channel a little so it reads as pixels
        im = im.point(lambda v: min(255, round(v / 6) * 6))
        atlas.paste(im, (x, y))
        print(name, im.size)
    atlas.save(OUT, 'WEBP', quality=92, method=6)
    print('wrote', OUT, os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
