"""Contact sheet of the souvenir icons and hero renders: python contact.py <out.png> [--heroes <build out dir>]"""
import glob
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
out = sys.argv[1]
heroes = sys.argv[sys.argv.index("--heroes") + 1] if "--heroes" in sys.argv else None
icons = sorted(glob.glob(os.path.join(ROOT, "public", "models", "souvenirs", "*.png")))
cols = 6
cw, ch = (300, 260) if heroes else (200, 220)
rows = (len(icons) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cw, rows * ch), (39, 49, 63))
d = ImageDraw.Draw(sheet)
for i, p in enumerate(icons):
    sid = os.path.basename(p)[:-4]
    x, y = (i % cols) * cw, (i // cols) * ch
    if heroes and os.path.exists(os.path.join(heroes, sid, f"{sid}_hero.png")):
        h = Image.open(os.path.join(heroes, sid, f"{sid}_hero.png")).convert("RGB")
        h.thumbnail((cw - 8, ch - 70))
        sheet.paste(h, (x + 4, y + 4))
        ic = Image.open(p).convert("RGBA").resize((128, 128), Image.NEAREST)
        sheet.paste(ic, (x + cw - 132, y + ch - 150), ic)
    else:
        ic = Image.open(p).convert("RGBA").resize((192, 192), Image.NEAREST)
        sheet.paste(ic, (x + 4, y + 4), ic)
    d.text((x + 6, y + ch - 16), sid, fill=(234, 224, 200))
sheet.save(out)
print(out, len(icons))
