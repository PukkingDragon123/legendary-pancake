"""Borrow real props for the interview office and restyle them to Hoot Hollow's calm palette.

    ~/.cache/lowpix-venv/bin/python art/lowpix/interview/borrow.py [id ...]

Each entry in BORROW names a source GLB (the user's own games BUSHED and Gacha Garage, whose props are CC0 Poly Haven
models converted with lowpix; credits in docs/credits/interview3.md). The script copies it to
public/models/interview/<id>.glb and on the way:
  * grades its colour atlas to the palette (src/gfx/palette.ts): a little desaturated, pulled 30% towards the nearest
    palette colour, shadows leaning slate and lights leaning lamp-gold, so borrowed props sit with the hand-made ones;
  * makes the finish matte (no metal, rough), drops normal/roughness/occlusion maps and the unlit flag;
  * downsizes the atlas (512-1024 px) and re-encodes it as WebP to keep the GLB small.
Meshopt-compressed sources keep their compressed geometry (buffer ranges are repacked, offsets fixed).
"""
import io
import json
import os
import struct
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SCRATCH = '/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad'
BUSHED = os.environ.get('BUSHED', os.path.join(SCRATCH, 'refs4/lpx-bushed/games/bushed/public/assets/models'))
GG = os.environ.get('GG', os.path.join(SCRATCH, 'refs3/gg/public/models/lowpix/world'))
DEST = os.path.join(ROOT, 'public', 'models', 'interview')

# id: (source, file, max atlas px, warmth -1..1)
BORROW = {
    'b_desk': (BUSHED, 'vintage_wooden_drawer_01', 1024, 0.1),
    'b_chair': (BUSHED, 'WoodenChair_01', 512, 0.1),
    'b_bookcase': (BUSHED, 'wooden_bookshelf_worn', 1024, 0.1),
    'b_oillamp': (BUSHED, 'vintage_oil_lamp', 512, 0.2),
    'b_candlestick': (BUSHED, 'wooden_candlestick', 256, 0.1),
    'b_lantern': (BUSHED, 'Lantern_01', 256, 0.2),
    'b_mantelclock': (BUSHED, 'mantel_clock_01', 256, 0.1),
    'b_daybed': (BUSHED, 'vintage_day_bed', 1024, 0.0),
    'b_sidetable': (BUSHED, 'WoodenTable_02', 256, 0.1),
    'b_cabinet': (BUSHED, 'painted_wooden_cabinet', 1024, 0.0),
    'b_basket': (BUSHED, 'wicker_basket_01', 512, 0.1),
    'b_suitcase': (BUSHED, 'vintage_suitcase', 512, 0.0),
    'b_jug': (BUSHED, 'jug_01', 256, 0.0),
    'b_bowl': (BUSHED, 'wooden_bowl_01', 256, 0.1),
    'g_books': (GG, 'books_old', 512, 0.0),
    'g_pothos': (GG, 'plant_pothos', 512, -0.1),
    'g_plant': (GG, 'plant_pot2', 512, -0.1),
    'g_aloe': (GG, 'aloe_pot', 512, -0.1),
    'g_teapot': (GG, 'teapot_enamel', 512, 0.0),
    'g_radio': (GG, 'radio_old', 512, 0.1),
    'g_gramophone': (GG, 'gramophone', 512, 0.1),
}

PALETTE = [  # src/gfx/palette.ts P (sRGB)
    0x2e2b24, 0x4b463a, 0x6f6856, 0xf4eedd, 0xeae0c8, 0xdccfb0, 0xc9b78d, 0xd8bf98, 0xbf9d74, 0x9c7a56, 0x6f553d, 0x4a392b, 0x5b4a3c, 0x3d3229,
    0xc4cfa3, 0xa7b788, 0x86a06a, 0x66844f, 0x557343, 0x3f5a3b, 0x2c4030, 0xd3e0dc, 0xaec8cc, 0x86a9b0, 0x617f8c, 0x46596a, 0x27313f, 0x1b222d,
    0xf1d39a, 0xdcb072, 0xc59a52, 0xc0866a, 0xa66c55, 0xd9aca4, 0xe8b4ae, 0x9e5f66, 0x6e5266, 0xb4a9c9, 0xd3cce0, 0xdfe9ea, 0xf5f7f2, 0xbcd6dc,
    0xb9b2a4, 0x908a7e, 0x6a655c, 0xc8a764, 0x8e7440, 0x5c5a56, 0xf1e6cc, 0xd9bf93, 0xa87652, 0x8a5a3c, 0x5e4130, 0x3a3029,
]
PAL = np.array([[(c >> 16) & 255, (c >> 8) & 255, c & 255] for c in PALETTE], np.float32) / 255
SLATE = np.array([0x46, 0x59, 0x6a], np.float32) / 255
LAMP = np.array([0xf1, 0xd3, 0x9a], np.float32) / 255


def grade(im: Image.Image, warm: float) -> Image.Image:
    a = np.asarray(im.convert('RGBA'), np.float32) / 255
    rgb, al = a[..., :3], a[..., 3:]
    lum = (rgb @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    rgb = lum + (rgb - lum) * 0.78                       # quieter colour
    flat = rgb.reshape(-1, 3)
    near = np.empty_like(flat)
    for i in range(0, len(flat), 65536):                  # nearest palette colour, in chunks
        ch = flat[i:i + 65536]
        d = ((ch[:, None, :] - PAL[None, :, :]) ** 2).sum(-1)
        near[i:i + 65536] = PAL[d.argmin(1)]
    rgb = rgb * 0.7 + near.reshape(rgb.shape) * 0.3       # pulled towards the palette
    sh = np.clip(0.35 - lum, 0, 0.35) / 0.35
    hi = np.clip(lum - 0.6, 0, 0.4) / 0.4
    rgb = rgb * (1 - sh * 0.22) + SLATE * sh * 0.22       # shadows lean slate
    rgb = rgb * (1 - hi * (0.12 + warm * 0.1)) + LAMP * hi * (0.12 + warm * 0.1)  # lights lean lamp-gold
    out = np.concatenate([np.clip(rgb, 0, 1), al], -1)
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), 'RGBA')


def read_glb(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'glTF'
    off, js, bin_ = 12, None, b''
    while off < len(b):
        ln, typ = struct.unpack('<II', b[off:off + 8])
        chunk = b[off + 8:off + 8 + ln]
        if typ == 0x4E4F534A:
            js = json.loads(chunk)
        elif typ == 0x004E4942:
            bin_ = chunk
        off += 8 + ln
    return js, bin_


def write_glb(path, js, bin_):
    j = json.dumps(js, separators=(',', ':')).encode()
    j += b' ' * ((4 - len(j) % 4) % 4)
    bin_ += b'\0' * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(j) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(j), 0x4E4F534A) + j)
        f.write(struct.pack('<II', len(bin_), 0x004E4942) + bin_)


def borrow(id):
    src_dir, name, size, warm = BORROW[id]
    js, bin_ = read_glb(os.path.join(src_dir, name + '.glb'))
    views = js['bufferViews']
    # new image bytes per bufferView
    repl = {}
    keep_images = set()
    for m in js.get('materials', []):
        pbr = m.setdefault('pbrMetallicRoughness', {})
        bct = pbr.get('baseColorTexture')
        if bct is not None:
            tex = js['textures'][bct['index']]
            src = tex.get('source')
            if src is None:
                src = tex.get('extensions', {}).get('EXT_texture_webp', {}).get('source')
            keep_images.add(src)
        for k in ('metallicRoughnessTexture',):
            pbr.pop(k, None)
        for k in ('normalTexture', 'occlusionTexture', 'emissiveTexture'):
            m.pop(k, None)
        pbr['metallicFactor'] = 0.0
        pbr['roughnessFactor'] = 1.0
        m.pop('emissiveFactor', None)
        ext = m.get('extensions', {})
        ext.pop('KHR_materials_unlit', None)
        if not ext:
            m.pop('extensions', None)
    for i, im in enumerate(js.get('images', [])):
        v = views[im['bufferView']]
        data = bin_[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        if i not in keep_images:
            repl[im['bufferView']] = b'\0' * 4  # unused map: shrink to nothing (kept so indices stay valid)
            continue
        img = Image.open(io.BytesIO(data))
        if max(img.size) > size:
            k = size / max(img.size)
            img = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.LANCZOS)
        img = grade(img, warm)
        buf = io.BytesIO()
        img.save(buf, 'WEBP', quality=88, method=6)
        repl[im['bufferView']] = buf.getvalue()
        im['mimeType'] = 'image/webp'
    # textures point at WebP images now
    for t in js.get('textures', []):
        src = t.get('source')
        if src is None:
            src = t.get('extensions', {}).get('EXT_texture_webp', {}).get('source')
        t.pop('source', None)
        t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': src}
    used = set(js.get('extensionsUsed', [])) | {'EXT_texture_webp'}
    used.discard('KHR_materials_unlit')
    js['extensionsUsed'] = sorted(used)
    req = set(js.get('extensionsRequired', [])) | {'EXT_texture_webp'}
    js['extensionsRequired'] = sorted(req)
    # repack buffer 0: every range that points into it (bufferViews and meshopt payloads), in order
    ranges = []
    for i, v in enumerate(views):
        if v.get('buffer', 0) == 0:
            ranges.append((v, 'byteOffset', 'byteLength', i))
        mo = v.get('extensions', {}).get('EXT_meshopt_compression')
        if mo and mo.get('buffer', 0) == 0:
            ranges.append((mo, 'byteOffset', 'byteLength', None))
    out = bytearray()
    for obj, ko, kl, vi in ranges:
        data = repl[vi] if vi is not None and vi in repl else bin_[obj.get(ko, 0):obj.get(ko, 0) + obj[kl]]
        while len(out) % 4:
            out.append(0)
        obj[ko] = len(out)
        obj[kl] = len(data)
        out += data
    js['buffers'][0]['byteLength'] = len(out)
    os.makedirs(DEST, exist_ok=True)
    dst = os.path.join(DEST, id + '.glb')
    write_glb(dst, js, bytes(out))
    return os.path.getsize(dst) // 1024


if __name__ == '__main__':
    ids = sys.argv[1:] or list(BORROW)
    for id in ids:
        print(id, borrow(id), 'KB', flush=True)
