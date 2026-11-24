"""Repaint item textures in place: swap an image inside a GLB (any of them: plain, quantized or meshopt-compressed;
the binary chunk is rebuilt and every buffer view, meshopt's included, is re-pointed).

Used for the furniture quality pass (art direction v4): the gnome gets natural painted colours instead of lime
green, and every clock gets a real enamel dial (numerals, hands, bezel). Run from the repo root:

    python3 art/lowpix/items/retex.py            # all fixes
    python3 art/lowpix/items/retex.py gnome      # one
"""
import io
import json
import math
import os
import struct
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
ITEMS = os.path.join(ROOT, 'public', 'models', 'items')


# ------------------------------------------------------------------ GLB plumbing

def read_glb(path):
    b = open(path, 'rb').read()
    off, js, binc = 12, None, b''
    while off < len(b):
        clen, ctype = struct.unpack('<II', b[off:off + 8])
        d = b[off + 8:off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(d)
        elif ctype == 0x004E4942:
            binc = d
        off += 8 + clen
    return js, binc


def write_glb(path, js, binc):
    j = json.dumps(js, separators=(',', ':')).encode()
    j += b' ' * ((4 - len(j) % 4) % 4)
    binc += b'\0' * ((4 - len(binc) % 4) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(j) + 8 + len(binc))
    out += struct.pack('<II', len(j), 0x4E4F534A) + j + struct.pack('<II', len(binc), 0x004E4942) + binc
    open(path, 'wb').write(out)


def get_image(js, binc, i):
    im = js['images'][i]
    bv = js['bufferViews'][im['bufferView']]
    o = bv.get('byteOffset', 0)
    return Image.open(io.BytesIO(binc[o:o + bv['byteLength']])), im.get('mimeType', 'image/png')


def set_image(js, binc, i, img, mime=None):
    """Replace image i's bytes; rebuild buffer 0 and shift every view (and meshopt source ranges) after it."""
    im = js['images'][i]
    mime = mime or im.get('mimeType', 'image/png')
    buf = io.BytesIO()
    if 'webp' in mime:
        img.save(buf, 'WEBP', lossless=True)
    elif 'jpeg' in mime:
        img.convert('RGB').save(buf, 'JPEG', quality=94)
    else:
        a = np.array(img)
        if a.shape[-1] == 4 and (a[..., 3] == 255).all():
            img = img.convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        elif a.shape[-1] == 4:
            img = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        img.save(buf, 'PNG', optimize=True)
    new = buf.getvalue()
    im['mimeType'] = mime
    target = js['bufferViews'][im['bufferView']]
    t0, tl = target.get('byteOffset', 0), target['byteLength']
    # nothing else may share the old bytes: if the image is the last thing in the buffer, drop it; otherwise leave
    # them and append (meshopt and every other view keep their offsets)
    last = all(bv is target or bv.get('byteOffset', 0) + bv.get('byteLength', 0) <= t0 for bv in js['bufferViews'] if bv.get('buffer', 0) == 0) and \
        all((bv.get('extensions', {}).get('EXT_meshopt_compression') or {}).get('byteOffset', 0) < t0 for bv in js['bufferViews'])
    base = binc[:t0] if last else binc
    base += b'\0' * ((4 - len(base) % 4) % 4)
    target['byteOffset'] = len(base)
    target['byteLength'] = len(new)
    newbin = base + new
    newbin += b'\0' * ((4 - len(newbin) % 4) % 4)
    js['buffers'][0]['byteLength'] = len(newbin)
    return newbin


def retex(name, fn, index=0, scale=1, mime=None):
    path = os.path.join(ITEMS, name + '.glb')
    js, binc = read_glb(path)
    img, m = get_image(js, binc, index)
    img = img.convert('RGBA')
    if scale != 1:
        img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    img = fn(img)
    binc = set_image(js, binc, index, img, mime or m)
    write_glb(path, js, binc)
    print(name, img.size, os.path.getsize(path) // 1024, 'KB')


# ------------------------------------------------------------------ painting helpers

def rgb2hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a[..., :3].max(-1), a[..., :3].min(-1)
    d = mx - mn + 1e-6
    h = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, (mx - mn) / (mx + 1e-6), 0)
    return h, s, mx


def hsv2rgb(h, s, v):
    c = v * s
    x = c * (1 - np.abs((h / 60) % 2 - 1))
    m = v - c
    z = np.zeros_like(h)
    seg = (h // 60).astype(int) % 6
    r = np.choose(seg, [c, x, z, z, x, c]); g = np.choose(seg, [x, c, c, x, z, z]); b = np.choose(seg, [z, z, x, c, c, x])
    return np.stack([r + m, g + m, b + m], -1)


FONT = {  # 3 x 5 numerals
    '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'], '3': ['##.', '..#', '.#.', '..#', '##.'],
    '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'], '6': ['.##', '#..', '###', '#.#', '###'],
    '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '##.'],
    '0': ['###', '#.#', '#.#', '#.#', '###'], 'I': ['#', '#', '#', '#', '#'], 'V': ['#.#', '#.#', '#.#', '#.#', '.#.'], 'X': ['#.#', '#.#', '.#.', '#.#', '#.#'],
}


def text(px, s, cx, cy, col, scale=1):
    glyphs = [FONT[c] for c in s]
    w = sum(len(g[0]) for g in glyphs) + len(glyphs) - 1
    x0, y0 = int(round(cx - w * scale / 2)), int(round(cy - 5 * scale / 2))
    for g in glyphs:
        for j, row in enumerate(g):
            for i, ch in enumerate(row):
                if ch == '#':
                    px[y0 + j * scale:y0 + (j + 1) * scale, x0 + i * scale:x0 + (i + 1) * scale] = col
        x0 += (len(g[0]) + 1) * scale


def dial(img, cx, cy, R, roman=True, enamel=(242, 234, 212), ink=(34, 28, 30), bezel=(196, 150, 70), hands=True, rim=True, numerals=True):
    """Paint a clock face centred at (cx, cy), radius R texels: brass bezel, enamel with a soft vignette and craquelure,
    minute track, hour batons, numerals, blued steel hands at ten past ten and a brass boss."""
    a = np.array(img).astype(np.float32)
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.hypot(xx + 0.5 - cx, yy + 0.5 - cy)
    ang = np.arctan2(xx + 0.5 - cx, -(yy + 0.5 - cy))
    if rim:
        ring = (d < R) & (d >= R * 0.86)
        lite = 0.85 + 0.3 * np.cos(ang + 0.8)
        a[ring, :3] = np.array(bezel) * lite[ring][:, None]
        a[(d < R) & (d >= R - 1), :3] *= 0.6
    face = d < R * (0.86 if rim else 1.0)
    vign = 1 - 0.14 * (d / R) ** 2
    crack = ((np.sin(xx * 1.7 + yy * 0.6) * np.sin(yy * 1.3 - xx * 0.4)) > 0.96) * 0.06
    a[face, :3] = (np.array(enamel)[None, :] * (vign[face] - crack[face])[:, None])
    Rf = R * (0.86 if rim else 1.0)
    # minute track
    for k in range(60):
        t = k / 60 * math.tau
        big = k % 5 == 0
        r0 = Rf * (0.8 if big else 0.88)
        for rr in np.arange(r0, Rf * 0.95, 0.4):
            x, y = cx + math.sin(t) * rr, cy - math.cos(t) * rr
            if 0 <= int(x) < W and 0 <= int(y) < H:
                a[int(y), int(x), :3] = ink
            if big and R > 20:
                x2, y2 = cx + math.sin(t) * rr + math.cos(t) * 0.7, cy - math.cos(t) * rr + math.sin(t) * 0.7
                if 0 <= int(x2) < W and 0 <= int(y2) < H:
                    a[int(y2), int(x2), :3] = ink
    px = a[..., :3]
    if numerals:
        sc = 2 if R >= 44 else 1
        nr = Rf * (0.6 if R >= 22 else 0.62)
        labs = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'] if roman else ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']
        show = range(12) if R >= 30 else (0, 3, 6, 9)
        for k in show:
            t = k / 12 * math.tau
            s = labs[k]
            if not roman and R < 30:
                s = {0: '12', 3: '3', 6: '6', 9: '9'}[k]
            text(px, s, cx + math.sin(t) * nr, cy - math.cos(t) * nr, ink, sc)
    if hands:
        def hand(t, L, w, col):
            for s_ in np.arange(-L * 0.18, L, 0.3):
                for o in np.arange(-w / 2, w / 2 + 0.01, 0.4):
                    x = cx + math.sin(t) * s_ + math.cos(t) * o
                    y = cy - math.cos(t) * s_ + math.sin(t) * o
                    if 0 <= int(x) < W and 0 <= int(y) < H:
                        px[int(y), int(x)] = col
        hand(math.tau * (10 + 10 / 60) / 12, Rf * 0.5, max(1.2, R / 14), (30, 34, 60))
        hand(math.tau * 10 / 60, Rf * 0.76, max(1, R / 20), (30, 34, 60))
        hand(math.tau * 40 / 60, Rf * 0.84, 0.6, (150, 40, 30))
        boss = d < max(1.2, R * 0.07)
        a[boss, :3] = bezel
    a[..., :3] = np.clip(px, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


# ------------------------------------------------------------------ the fixes

def gnome(img):
    """The scan came out lime green (its grade washed the reds out and pushed the greens): repaint it with a
    garden gnome's natural glazed colours: a red cap, a forest-green jacket, warm skin, a cream beard."""
    a = np.array(img).astype(np.float32) / 255
    h, s, v = rgb2hsv(a[..., :3])
    lime = (h > 55) & (h < 105) & (s > 0.25)
    pink = ((h < 22) | (h > 340)) & (s > 0.2)
    h2, s2, v2 = h.copy(), s.copy(), v.copy()
    h2[lime] = 128 + (h[lime] - 80) * 0.2
    s2[lime] = np.clip(s[lime] * 0.95, 0, 0.62)
    v2[lime] = v[lime] * 0.6
    h2[pink] = np.where(h[pink] > 300, 356, 4)
    s2[pink] = np.clip(s[pink] * 1.55, 0, 0.78)
    v2[pink] = v[pink] * 0.82
    out = hsv2rgb(h2, s2, v2)
    a[..., :3] = np.where((lime | pink)[..., None], out, a[..., :3])
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), 'RGBA')


def mantel(img):
    # atlas scaled 2x (512): the dial sits at (117, 58) r 16 in the 256 atlas
    return dial(img, 117 * 2 + 1, 59 * 2, 33, roman=True)


def cuckoo(img):
    # atlas scaled 2x: the cream dial is centred at (26.5, 111.75) of the 256 x 512 atlas, face radius ~23 px; the
    # hands are their own meshes
    return dial(img, 53, 223.5, 45, roman=False, rim=False, hands=False, enamel=(244, 234, 206))


def chalet(img):
    # atlas scaled 2x: the dial inside its brass ring at (22, 95.25), face radius ~17 px; the hands are modelled
    return dial(img, 44.5, 190.5, 33, roman=False, rim=False, hands=False, enamel=(246, 238, 214))


ARTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_furnA', 'art')


def painting(img):
    """The moonlit painting's canvas (it came out a murky green): George Inness, Moonrise (1891, Art Institute of
    Chicago, public domain), cropped to the canvas, painted in at twice the old texel density with a gentle pixel
    grade. Atlas scaled 2x: the canvas card spans (0..133, 196..287) of the 256 x 512 atlas."""
    x0, y0, x1, y1 = 0, 196 * 2, 133 * 2, 287 * 2
    art = Image.open(os.path.join(ARTS, 'inness_moonrise.jpg')).convert('RGB')
    w, h = art.size
    ch = int(w * (y1 - y0) / (x1 - x0))
    top = int((h - ch) * 0.42)
    art = art.crop((0, top, w, top + ch)).resize((x1 - x0, y1 - y0), Image.LANCZOS)
    art = art.quantize(colors=56, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    a = np.array(img)
    a[y0:y1, x0:x1, :3] = np.array(art)
    return Image.fromarray(a, 'RGBA')


def colorize(img, mask, ramp, lo=0.0, hi=1.0, gain=1.0):
    """Repaint the masked texels with a colour ramp (dark..light sRGB stops) by their luminance (stretched lo..hi)."""
    a = np.array(img).astype(np.float32)
    lum = (a[..., :3] * [0.3, 0.59, 0.11]).sum(-1) / 255
    t = np.clip((lum - lo) / max(1e-3, hi - lo) * gain, 0, 1)
    stops = np.array(ramp, np.float32)
    k = t * (len(stops) - 1)
    i0 = np.clip(np.floor(k).astype(int), 0, len(stops) - 2)
    f = (k - i0)[..., None]
    col = stops[i0] * (1 - f) + stops[i0 + 1] * f
    a[..., :3] = np.where(mask[..., None], col, a[..., :3])
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA')


def cushion(img):
    """A dull purple-black lump becomes a rose velvet floor cushion with a sheen."""
    a = np.array(img).astype(np.float32) / 255
    m = a[..., 3] > 0
    return colorize(img, m, [(70, 30, 34), (128, 52, 54), (176, 82, 74), (214, 122, 104), (236, 170, 146)], 0.05, 0.45)


def wardrobe(img):
    """The painted wardrobe's slate panels become a soft duck-egg paint; the dark boards warm to walnut."""
    a = np.array(img).astype(np.float32) / 255
    h, s_, v = rgb2hsv(a[..., :3])
    blue = (h > 180) & (h < 250) & (s_ > 0.1)
    out = colorize(img, blue, [(52, 78, 74), (92, 128, 118), (140, 172, 156), (188, 210, 192), (222, 232, 214)], 0.12, 0.6)
    a2 = np.array(out).astype(np.float32) / 255
    h2, s2, v2 = rgb2hsv(a2[..., :3])
    dark = (~blue) & (v2 < 0.42) & (s2 < 0.5)
    a2[..., :3] = np.where(dark[..., None], a2[..., :3] * np.array([1.35, 1.18, 1.0]) + np.array([0.04, 0.02, 0]), a2[..., :3])
    return Image.fromarray((np.clip(a2, 0, 1) * 255).astype(np.uint8), 'RGBA')


def easel(img):
    """The quest board's blank slate becomes a cork board with paper quests pinned on it."""
    a = np.array(img).astype(np.float32) / 255
    h, s_, v = rgb2hsv(a[..., :3])
    grey = (s_ < 0.12) & (v > 0.12) & (v < 0.62)
    rng = np.random.default_rng(7)
    out = colorize(img, grey, [(96, 62, 34), (142, 96, 56), (176, 126, 76), (204, 156, 100)], 0.1, 0.5)
    b = np.array(out)
    speck = grey & (rng.random(grey.shape) > 0.82)
    b[speck, :3] = (b[speck, :3] * 0.72).astype(np.uint8)
    # paper notes with scribbled lines and a red pin, inside the board's big face
    for (x, y, w, hh, col) in ((80, 236, 34, 40, (240, 232, 210)), (128, 250, 30, 30, (236, 222, 160)), (172, 232, 40, 46, (232, 236, 240)), (100, 286, 46, 28, (226, 238, 212))):
        if y + hh >= b.shape[0] or x + w >= b.shape[1] or not grey[y:y + hh, x:x + w].mean() > 0.8:
            continue
        b[y + 2:y + hh + 2, x + 2:x + w + 2, :3] = (b[y + 2:y + hh + 2, x + 2:x + w + 2, :3] * 0.7).astype(np.uint8)
        b[y:y + hh, x:x + w, :3] = col
        for ly in range(y + 8, y + hh - 4, 5):
            b[ly, x + 4:x + w - 4 - (ly * 7 % 9), :3] = (60, 58, 70)
        b[y + 1:y + 4, x + w // 2 - 1:x + w // 2 + 2, :3] = (190, 40, 30)
    return Image.fromarray(b, 'RGBA')


def cubby(img):
    """The plain cream cubbies become honey birch."""
    a = np.array(img).astype(np.float32) / 255
    h, s_, v = rgb2hsv(a[..., :3])
    m = (v > 0.45) & (s_ < 0.35)
    return colorize(img, m, [(120, 76, 40), (170, 116, 66), (206, 156, 96), (230, 192, 132)], 0.45, 1.0)


def glass(name, mat_index, alpha=0.2):
    """Turn a material back into clear glass (a borrowed model's dial glass came through opaque)."""
    path = os.path.join(ITEMS, name + '.glb')
    js, binc = read_glb(path)
    m = js['materials'][mat_index]
    m['alphaMode'] = 'BLEND'
    pbr = m.setdefault('pbrMetallicRoughness', {})
    pbr['baseColorFactor'] = [0.9, 0.95, 1.0, alpha]
    pbr['roughnessFactor'] = 0.08
    pbr['metallicFactor'] = 0.0
    write_glb(path, js, binc)
    print(name, 'glass', mat_index)


FIXES = {
    'gnome': lambda: retex('gnome', gnome),
    'mantel_clock': lambda: (retex('mantel_clock', mantel, scale=2, mime='image/png'), glass('mantel_clock', 1)),
    'cuckoo': lambda: retex('cuckoo', cuckoo, scale=2),
    'painting': lambda: retex('painting', painting, scale=2),
    'cushion': lambda: retex('cushion', cushion),
    'wardrobe': lambda: retex('wardrobe', wardrobe),
    'easel': lambda: retex('easel', easel),
    'cubby_shelf': lambda: retex('cubby_shelf', cubby),
    'chalet_cuckoo': lambda: retex('chalet_cuckoo', chalet, scale=2),
}

if __name__ == '__main__':
    want = sys.argv[1:] or list(FIXES)
    for k in want:
        FIXES[k]()
