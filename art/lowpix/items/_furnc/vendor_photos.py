"""Copy a few of BUSHED's photo-derived pixel textures (CC0 Poly Haven scans, see docs/credits/furnC.md) into
photos/<name>/{diff,nor}.jpg, the folder format lowpix's photo-bash op reads. Run once:

    ~/.cache/lowpix-venv/bin/python art/lowpix/items/_furnc/vendor_photos.py <bushed>/public/assets/textures
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PAIRS = {
    "wood": ("building/floor_boards_albedo.png", "building/floor_boards_normal.png"),
    "planks": ("building/rough_planks_albedo.png", "building/rough_planks_normal.png"),
    "stone": ("building/fieldstone_albedo.png", "building/fieldstone_normal.png"),
    "granite": ("terrain/granite_albedo.png", "terrain/granite_normal.png"),
    "moss": ("terrain/moss_albedo.png", "terrain/moss_normal.png"),
    "bark": ("trees/bark_pine.png", "trees/bark_pine_n.png"),
}

if __name__ == "__main__":
    src = sys.argv[1]
    for name, (a, n) in PAIRS.items():
        out = os.path.join(HERE, "photos", name)
        os.makedirs(out, exist_ok=True)
        for s, d in ((a, "diff.jpg"), (n, "nor.jpg")):
            im = Image.open(os.path.join(src, s)).convert("RGB")
            if max(im.size) > 512:
                im = im.resize((512, 512), Image.LANCZOS)
            im.save(os.path.join(out, d), quality=90)
        print(name)
