"""Room textures for Queen Neve's boutique (public/models/shop/tex/*.png).

Borrowed from BUSHED (the owner's lumberjack game: public/assets/textures/places, high-resolution palette-quantised
pixel-art PBR pairs made from CC0 Poly Haven scans, 256 px/m) and gently restyled to Hoot Hollow's calm
"Moss & Moonlight" palette: worn floorboards, sage-painted boards for the panelling, cream painted boards with
ticking-stripe paper for the walls, warm oak for beams and trim, a woven runner. No resampling (the texels stay
crisp pixel art); only colour is adjusted, so the normal maps still match.

    python3 src/world/stages/shoptex.py <bushed>/public/assets/textures/places public/models/shop/tex
"""
import sys

from PIL import Image

src, out = sys.argv[1], sys.argv[2]


def hexc(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def restyle(name, sat=1.0, tint=None, amt=0.0, gain=1.0, lift=0, rotate=False, out_name=None, normal=True):
    """desaturate, pull towards a tint, adjust value; keep every texel where it is"""
    im = Image.open(f"{src}/{name}.png").convert("RGB")
    px = im.load()
    t = hexc(tint) if tint else None
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b = px[x, y]
            l = 0.3 * r + 0.59 * g + 0.11 * b
            c = [l + (v - l) * sat for v in (r, g, b)]
            if t:
                c = [v * (1 - amt) + (l / 255 * tv * 1.15) * amt for v, tv in zip(c, t)]
            px[x, y] = tuple(max(0, min(255, round(v * gain + lift))) for v in c)
    if rotate:
        im = im.transpose(Image.ROTATE_90)
    im.save(f"{out}/{out_name or name}.png", optimize=True)
    if normal:
        try:
            n = Image.open(f"{src}/{name}_n.png").convert("RGB")
            if rotate:
                # rotate the normal map and swap its tangent axes to match
                n = n.transpose(Image.ROTATE_90)
                p = n.load()
                for y in range(n.size[1]):
                    for x in range(n.size[0]):
                        r, g, b = p[x, y]
                        p[x, y] = (255 - g, r, b)
            n.save(f"{out}/{out_name or name}_n.png", optimize=True)
        except FileNotFoundError:
            pass


restyle("floor", sat=0.85, tint="#a8865e", amt=0.18, gain=1.08, out_name="floor")
restyle("boards_green", sat=0.6, tint="#86a06a", amt=0.4, gain=1.4, lift=16, rotate=True, out_name="panels")
restyle("trim_cream", sat=0.8, tint="#e6dcc2", amt=0.2, gain=1.02, out_name="walls")
restyle("board_warm", sat=0.75, tint="#6f553d", amt=0.25, gain=0.92, out_name="beams")
restyle("ticking", sat=0.3, tint="#a7b788", amt=0.45, gain=0.9, lift=26, out_name="paper", normal=False)
restyle("rug", sat=0.5, tint="#a08a74", amt=0.3, gain=1.0, out_name="rug", normal=False)
print("ok")
