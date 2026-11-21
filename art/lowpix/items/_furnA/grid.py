"""Contact grid of hero renders: python grid.py <out_dir> <png> id1 id2 ... [--cell 300]"""
import os
import sys

from PIL import Image, ImageDraw

args = sys.argv[1:]
cell = 300
if "--cell" in args:
    i = args.index("--cell")
    cell = int(args[i + 1])
    del args[i:i + 2]
out_dir, png, ids = args[0], args[1], args[2:]
cols = min(4, len(ids))
rows = (len(ids) + cols - 1) // cols
W = Image.new("RGB", (cols * cell, rows * cell), (39, 49, 63))
d = ImageDraw.Draw(W)
for k, i in enumerate(ids):
    p = os.path.join(out_dir, i, f"{i}_hero.png")
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert("RGB")
    im.thumbnail((cell, cell))
    x, y = (k % cols) * cell, (k // cols) * cell
    W.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2))
    d.text((x + 6, y + 4), i, fill=(240, 230, 200))
W.save(png)
