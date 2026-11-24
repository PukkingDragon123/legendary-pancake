"""Downscaled copies of the vendored CC0 photos (photos/<id>_s/), so the painter samples them near 1:1 at the house's
texel density instead of speckling a 512 px scan down nearest-neighbour. Run from this folder."""
import os
import sys

from PIL import Image

SIZE = int(sys.argv[1]) if len(sys.argv) > 1 else 160
HERE = os.path.dirname(os.path.abspath(__file__))
for name in sorted(os.listdir(HERE)):
    src = os.path.join(HERE, name)
    if not os.path.isdir(src) or name.endswith('_s'):
        continue
    out = os.path.join(HERE, name + '_s')
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(src):
        if f.endswith('.jpg'):
            im = Image.open(os.path.join(src, f))
            im = im.resize((SIZE, SIZE), Image.LANCZOS)
            im.save(os.path.join(out, f), quality=92)
        elif f == 'source.json':
            with open(os.path.join(src, f)) as a, open(os.path.join(out, f), 'w') as b:
                b.write(a.read())
    print(name, '->', name + '_s', SIZE)
