"""Pack a Blender-exported GLB for the game: every PNG texture re-encoded as WebP (EXT_texture_webp), so a 2048 px
hand-painted atlas ships at a few hundred KB. Geometry is left exactly as exported (flat facet normals intact).

    python pack.py in.glb out.glb [quality]
"""
import io
import json
import struct
import sys

from PIL import Image

QUALITY = 90


def read_glb(path):
    b = open(path, 'rb').read()
    assert b[:4] == b'glTF'
    off = 12
    J, BIN = None, b''
    while off < len(b):
        ln, typ = struct.unpack('<II', b[off:off + 8])
        chunk = b[off + 8:off + 8 + ln]
        if typ == 0x4E4F534A:
            J = json.loads(chunk)
        elif typ == 0x004E4942:
            BIN = chunk
        off += 8 + ln
    return J, BIN


def write_glb(path, J, BIN):
    js = json.dumps(J, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    BIN += b'\0' * ((4 - len(BIN) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(BIN)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A))
        f.write(js)
        f.write(struct.pack('<II', len(BIN), 0x004E4942))
        f.write(BIN)


def webp_glb(src, dst, quality=QUALITY, lossless=False):
    J, BIN = read_glb(src)
    views = J.get('bufferViews', [])
    blobs = []  # rebuild the binary chunk view by view
    new_views = []
    img_view = {}
    for i, im in enumerate(J.get('images', [])):
        if 'bufferView' in im and im.get('mimeType') == 'image/png':
            img_view[im['bufferView']] = i
    off = 0
    out = bytearray()
    for vi, v in enumerate(views):
        data = BIN[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        if vi in img_view:
            pil = Image.open(io.BytesIO(data)).convert('RGB')
            buf = io.BytesIO()
            pil.save(buf, 'WEBP', quality=quality, method=6, lossless=lossless)
            data = buf.getvalue()
            J['images'][img_view[vi]]['mimeType'] = 'image/webp'
        pad = (4 - len(out) % 4) % 4
        out += b'\0' * pad
        nv = dict(v)
        nv['byteOffset'] = len(out)
        nv['byteLength'] = len(data)
        out += data
        new_views.append(nv)
    J['bufferViews'] = new_views
    J['buffers'][0]['byteLength'] = len(out)
    if img_view:
        for t in J.get('textures', []):
            if 'source' in t and J['images'][t['source']].get('mimeType') == 'image/webp':
                src_i = t.pop('source')
                t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': src_i}
        for key in ('extensionsUsed', 'extensionsRequired'):
            L = J.setdefault(key, [])
            if 'EXT_texture_webp' not in L:
                L.append('EXT_texture_webp')
    write_glb(dst, J, bytes(out))
    return dst


if __name__ == '__main__':
    webp_glb(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else QUALITY)
