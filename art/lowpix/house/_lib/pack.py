"""Pack a built lowpix model for the game: one small GLB per part of the house.

* Every static part is baked into world space (house px) and merged by material class into one mesh each:
  `solid` (lit, opaque), `card` (lit, double-sided, alpha-cut leaves and webs), `glow` (lamps: unlit, brightened
  at night by the game) and `pane` (window glass: the game tints it dark by day, warm at night).
* Parts under a bone listed in `nodes` stay separate nodes (named after the bone, at its pivot and rotation) so the
  game can animate them (boards popping off, the swinging sign, box flaps).
* Positions are int16 (1/32 px) and UVs uint16 (KHR_mesh_quantization); normals are left out (flat, computed by the
  game). The atlas is dilated into its empty texels (no dark seams in the mips) and stored as an indexed PNG.
"""
import io
import json
import math
import struct

import numpy as np
from PIL import Image

Q = 32.0  # int16 steps per px


def _quat(R):
    m = R
    tr = m[0, 0] + m[1, 1] + m[2, 2]
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2
        w, x, y, z = 0.25 * s, (m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        w, x, y, z = (m[2, 1] - m[1, 2]) / s, 0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s
    elif m[1, 1] > m[2, 2]:
        s = math.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        w, x, y, z = (m[0, 2] - m[2, 0]) / s, (m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s
    else:
        s = math.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        w, x, y, z = (m[1, 0] - m[0, 1]) / s, (m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s
    n = math.sqrt(w * w + x * x + y * y + z * z)
    return [x / n, y / n, z / n, w / n]


def dilate(atlas, passes=6):
    """Fill transparent texels from their opaque neighbours (keeps alpha)."""
    rgb = atlas[..., :3].copy()
    solid = atlas[..., 3] > 0
    for _ in range(passes):
        if solid.all():
            break
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            s = np.roll(solid, (dy, dx), (0, 1))
            c = np.roll(rgb, (dy, dx), (0, 1))
            grow = (~solid) & s
            rgb[grow] = c[grow]
            solid = solid | grow
    out = atlas.copy()
    out[..., :3] = rgb
    return out


def png_bytes(atlas, keep_alpha):
    """Indexed PNG with the atlas's exact colours when they fit in 256 (lowpix atlases are strict palettes)."""
    a = atlas.copy()
    if keep_alpha:
        a[..., 3] = np.where(a[..., 3] > 127, 255, 0)
    else:
        a[..., 3] = 255
    flat = a.reshape(-1, 4)
    key = flat.astype(np.uint32)
    key = (key[:, 0] << 24) | (key[:, 1] << 16) | (key[:, 2] << 8) | key[:, 3]
    uniq, inv = np.unique(key, return_inverse=True)
    buf = io.BytesIO()
    if len(uniq) <= 256:
        img = Image.fromarray(inv.reshape(a.shape[:2]).astype(np.uint8), 'P')
        pal = np.stack([(uniq >> 24) & 255, (uniq >> 16) & 255, (uniq >> 8) & 255], 1).astype(np.uint8)
        img.putpalette(pal.reshape(-1).tolist())
        if keep_alpha:
            img.info['transparency'] = bytes(((uniq & 255).astype(np.uint8)).tolist())
            img.save(buf, format='PNG', optimize=True, transparency=img.info['transparency'])
        else:
            img.save(buf, format='PNG', optimize=True)
    else:
        img = Image.fromarray(a if keep_alpha else a[..., :3].copy(), 'RGBA' if keep_alpha else 'RGB')
        if not keep_alpha:
            img = img.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        img.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def webp_bytes(atlas, keep_alpha, quality=88):
    """The atlas as a lossy WebP (painted textures compress far better than as PNG); alpha kept for cut-out cards."""
    img = Image.fromarray(atlas if keep_alpha else atlas[..., :3].copy(), 'RGBA' if keep_alpha else 'RGB')
    buf = io.BytesIO()
    img.save(buf, format='WEBP', quality=quality, method=6, alpha_quality=100)
    return buf.getvalue()


# parts painted with these styles are drawn by the game with a crisp tiling texture (public/models/house/tex/),
# modulated by their painted atlas
TILES = {'bark': 'bark', 'bark_limb': 'bark', 'root': 'bark', 'plank': 'wood', 'wood': 'wood', 'dark': 'wood', 'frame': 'wood',
         'joist': 'wood', 'slabedge': 'boards', 'stone': 'stone', 'chimney': 'stone', 'grey': 'grey'}


def tile_of(part):
    st = part.get('style')
    st = st[-1] if isinstance(st, list) and st else st
    if not isinstance(st, str) or st not in TILES:
        return None
    if (part.get('paint') or {}).get('ramp'):
        return None  # recoloured parts (a red door, sky-blue box) keep their own paint
    return 'tile_' + TILES[st]


def pack(model, meta, path):
    glow, pane, nodes = set(meta.get('glow', [])), set(meta.get('pane', [])), list(meta.get('nodes', []))
    insts = {i.id: i for i in model.instances}

    def node_of(inst):
        cur = inst
        while cur is not None:
            if cur.src_id in nodes:
                return cur.id
            cur = insts.get(cur.parent) if cur.parent else None
        return None

    # faces whose painted images are identical (the same leaf-cluster card, say) share one copy in a repacked atlas
    from lowpix.pack import shelf_pack
    src = model.atlas
    uniq, where = {}, {}
    for inst in model.instances:
        for f in inst.faces:
            x, y = f.rect
            img = src[y:y + f.H, x:x + f.W]
            key = (f.W, f.H, hash(img.tobytes()))
            if key not in uniq:
                uniq[key] = img
            where[id(f)] = key
    keys = list(uniq)
    AW, AH, pos = shelf_pack([(uniq[k].shape[1], uniq[k].shape[0]) for k in keys], gutter=1)
    atlas_new = np.zeros((AH, AW, 4), np.uint8)
    rect = {}
    for k, (x, y) in zip(keys, pos):
        im = uniq[k]
        h, w = im.shape[:2]
        atlas_new[y:y + h, x:x + w] = im
        atlas_new[y - 1, x:x + w] = im[0]
        atlas_new[y + h, x:x + w] = im[-1]
        atlas_new[y - 1:y + h + 1, x - 1] = atlas_new[y - 1:y + h + 1, x]
        atlas_new[y - 1:y + h + 1, x + w] = atlas_new[y - 1:y + h + 1, x + w - 1]
        rect[k] = (x, y)
    groups = {}  # (node, cls) -> lists
    for inst in model.instances:
        if not inst.faces:
            continue
        nid = node_of(inst)
        W = inst.world
        if nid is not None:
            W = np.linalg.inv(insts[nid].world) @ W
        for f in inst.faces:
            cls = 'glow' if inst.src_id in glow else 'pane' if inst.src_id in pane else 'card' if f.double_sided else tile_of(inst.part) or 'solid'
            g = groups.setdefault((nid, cls), {'P': [], 'UV': [], 'I': [], 'n': 0, 'col': []})
            if cls.startswith('tile_'):
                x0, y0 = rect[where[id(f)]]
                g['col'].append(atlas_new[y0:y0 + f.H, x0:x0 + f.W, :3].reshape(-1, 3))
            pts = f.pts @ W[:3, :3].T + W[:3, 3]
            x, y = rect[where[id(f)]]
            uv = np.c_[(x + f.uv[:, 0] * f.W) / AW, (y + f.uv[:, 1] * f.H) / AH]
            g['P'].append(pts)
            g['UV'].append(uv)
            for a, b, c in f.tris:
                g['I'].append((g['n'] + a, g['n'] + b, g['n'] + c))
            g['n'] += len(pts)

    bins, views, accs, meshes, gnodes = [], [], [], [], []
    off = [0]

    def view(data, target=None):
        pad = (-off[0]) % 4
        if pad:
            bins.append(b'\0' * pad)
            off[0] += pad
        v = {'buffer': 0, 'byteOffset': off[0], 'byteLength': len(data)}
        if target:
            v['target'] = target
        views.append(v)
        bins.append(data)
        off[0] += len(data)
        return len(views) - 1

    def acc(arr, kind, ctype, target, normalized=False, minmax=False, stride=None):
        data = arr.tobytes()
        vi = view(data, target)
        if stride:
            views[vi]['byteStride'] = stride
        a = {'bufferView': vi, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': kind}
        if normalized:
            a['normalized'] = True
        if minmax:
            a['min'] = [int(v) for v in arr.reshape(arr.shape[0], -1).min(axis=0)[:3]]
            a['max'] = [int(v) for v in arr.reshape(arr.shape[0], -1).max(axis=0)[:3]]
        accs.append(a)
        return len(accs) - 1

    mat_ix = {'solid': 0, 'card': 1, 'glow': 2, 'pane': 3}
    for k in TILES.values():
        mat_ix['tile_' + k] = 0
    bounds = [np.full(3, np.inf), np.full(3, -np.inf)]
    tris = 0
    by_node = {}
    for (nid, cls), g in sorted(groups.items(), key=lambda kv: (kv[0][0] or '', kv[0][1])):
        P = np.concatenate(g['P'])
        if nid is None:
            bounds[0] = np.minimum(bounds[0], P.min(axis=0))
            bounds[1] = np.maximum(bounds[1], P.max(axis=0))
        UV = np.concatenate(g['UV'])
        I = np.array(g['I'], dtype=np.uint32).reshape(-1)
        tris += len(I) // 3
        q = np.clip(np.round(P * Q), -32767, 32767).astype(np.int16)
        q4 = np.zeros((len(q), 4), np.int16)
        q4[:, :3] = q
        uv = np.clip(np.round(UV * 65535), 0, 65535).astype(np.uint16)
        pa = acc(q4, 'VEC3', 5122, 34962, minmax=True, stride=8)
        accs[pa]['min'] = [int(v) for v in q.min(axis=0)]
        accs[pa]['max'] = [int(v) for v in q.max(axis=0)]
        ta = acc(uv, 'VEC2', 5123, 34962, normalized=True)
        ia = acc(I.astype(np.uint16) if len(P) < 65536 else I, 'SCALAR', 5123 if len(P) < 65536 else 5125, 34963)
        mesh = {'name': cls, 'primitives': [{'attributes': {'POSITION': pa, 'TEXCOORD_0': ta}, 'indices': ia, 'material': mat_ix[cls]}]}
        if g.get('col'):
            # the painted atlas's mean colour under a tiling texture: the game divides by it, so the atlas only
            # carries the painted variation (moss, lichen, light, wear) over the crisp tiling scan
            c = np.concatenate(g['col']).astype(np.float64).mean(axis=0) / 255.0
            mesh['extras'] = {'base': [round(float(v), 4) for v in c]}
        meshes.append(mesh)
        by_node.setdefault(nid, []).append(len(meshes) - 1)

    scene_nodes = []
    for nid, ms in by_node.items():
        kids = []
        for mi in ms:
            gnodes.append({'name': meshes[mi]['name'], 'mesh': mi, 'scale': [1 / Q] * 3})
            kids.append(len(gnodes) - 1)
        if nid is None:
            gnodes.append({'name': 'static', 'children': kids})
        else:
            W = insts[nid].world
            nd = {'name': insts[nid].src_id, 'children': kids, 'translation': [float(v) for v in W[:3, 3]]}
            qq = _quat(W[:3, :3])
            if abs(qq[3] - 1) > 1e-9:
                nd['rotation'] = qq
            gnodes.append(nd)
        scene_nodes.append(len(gnodes) - 1)

    has_cards = ('card' in {c for _, c in groups})
    atlas = dilate(atlas_new)
    img = webp_bytes(atlas, keep_alpha=has_cards)
    iv = view(img)

    def mat(name, ds=False, blend='MASK'):
        m = {'name': name, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 1.0}, 'doubleSided': ds}
        if blend == 'MASK':
            m['alphaMode'] = 'MASK'
            m['alphaCutoff'] = 0.5
        return m

    gltf = {
        'asset': {'version': '2.0', 'generator': 'hoot-hollow house pack (lowpix)'},
        'extensionsUsed': ['KHR_mesh_quantization', 'EXT_texture_webp'], 'extensionsRequired': ['KHR_mesh_quantization', 'EXT_texture_webp'],
        'scene': 0, 'scenes': [{'name': model.name, 'nodes': scene_nodes}], 'nodes': gnodes, 'meshes': meshes,
        'materials': [mat('solid', blend='OPAQUE'), mat('card', True), mat('glow'), mat('pane', True)],
        'textures': [{'sampler': 0, 'extensions': {'EXT_texture_webp': {'source': 0}}}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': iv, 'mimeType': 'image/webp', 'name': 'atlas'}],
        'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': 0}],
    }
    binary = b''.join(bins)
    binary += b'\0' * ((-len(binary)) % 4)
    gltf['buffers'][0]['byteLength'] = len(binary)
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binary))
    glb += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binary), 0x004E4942) + binary
    with open(path, 'wb') as fh:
        fh.write(glb)
    lo, hi = bounds
    return {'bytes': len(glb), 'tris': tris, 'atlas': [int(AW), int(AH)], 'png': len(img), 'atlas_png': atlas,
            'min': [round(float(v), 1) for v in lo] if np.isfinite(lo).all() else None,
            'max': [round(float(v), 1) for v in hi] if np.isfinite(hi).all() else None}
