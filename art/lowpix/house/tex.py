"""The oak's tiling textures: BUSHED's high-resolution pixel-art scans (the owner's game; made from CC0 Poly Haven
scans, see docs/credits/house3.md), calmed a little towards Hoot Hollow's palette (a touch less saturated, warmer
shadows) and written to public/models/house/tex/<kind>.png for the triplanar house material
(src/world/house/models.ts).

    BUSHED=<bushed checkout> python art/lowpix/house/tex.py
"""
import os
import sys

from PIL import Image, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', '..', '..', 'public', 'models', 'house', 'tex'))
B = os.environ.get('BUSHED') or sys.exit('set BUSHED to the bushed game folder')
T = os.path.join(B, 'public', 'assets', 'textures')

# kind: (source, saturation, brightness)
KINDS = {
    'bark': ('trees/bark_cedar.png', 0.82, 1.02),
    'wood': ('places/board_warm.png', 0.78, 1.0),
    'boards': ('building/floor_boards_albedo.png', 0.8, 0.98),
    'stone': ('building/fieldstone_albedo.png', 0.85, 1.0),
    'grey': ('building/rough_planks_albedo.png', 0.8, 1.12),
}

os.makedirs(OUT, exist_ok=True)
for kind, (src, sat, bri) in KINDS.items():
    im = Image.open(os.path.join(T, src)).convert('RGB')
    im = ImageEnhance.Color(im).enhance(sat)
    im = ImageEnhance.Brightness(im).enhance(bri)
    q = im.quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    q.save(os.path.join(OUT, kind + '.png'), optimize=True)
    print(kind, im.size, os.path.getsize(os.path.join(OUT, kind + '.png')) // 1024, 'KB')
