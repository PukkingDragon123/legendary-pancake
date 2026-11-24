"""Per-texel hand painting for the shop's Blender models (the beaver, the wishing barrel, the counter...).

    maps = raster(ob, size)          # per texel: surface position, normal, triangle, barycentrics, mask (UV space)
    ao = vertex_ao(ob)               # ambient occlusion per vertex (BVH rays), then texel_attr(maps, ob, ao)
    R = ramp('#7a4a2b')              # a hue-shifted ramp: cool saturated shadows, warm pale lights
    strokes(maps['pos'], flow, ...)  # short tapered brush strokes that follow a flow field (3D, so seams match)
    save(rgb, maps, path)            # dilated over the seams, written as an sRGB PNG

Everything is numpy; colours are sRGB 0..1. No directional light is painted in (the game lights the models): tone comes
from the ramp index, ambient occlusion, cavities and the strokes.
"""
import colorsys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


# ------------------------------------------------------------------ colour
def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def _hue_toward(h, target, k):
    d = ((target - h + 0.5) % 1.0) - 0.5
    return (h + d * k) % 1.0


def ramp(base, n=9, dark=0.62, light=0.5, shift=0.06, sat=0.25):
    """n tones around `base` (index n // 2 is the base): shadows turn toward blue-violet and saturate, lights turn
    toward yellow and pale (the lowpix / Gacha Garage hand-painting rule)."""
    r, g, b = hexrgb(base) if isinstance(base, str) else base
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    mid = (n - 1) / 2
    out = []
    for i in range(n):
        t = (i - mid) / mid
        if t < 0:
            hh = _hue_toward(h, 0.72, shift * -t)
            ss = min(1, s * (1 + sat * -t) + 0.03 * -t)
            vv = v * (1 - dark * -t)
        else:
            hh = _hue_toward(h, 0.12, shift * t)
            ss = max(0, s * (1 - sat * 1.3 * t))
            vv = min(1, v + (1 - v) * light * t + 0.05 * t)
        out.append(colorsys.hsv_to_rgb(hh, ss, vv))
    return np.array(out)


def pick(R, idx):
    """Ramp tones at (float) indices, rounded: clean bands."""
    i = np.clip(np.round(idx), 0, len(R) - 1).astype(np.int32)
    return R[i]


# ------------------------------------------------------------------ noise
def _hash3(ix, iy, iz, seed=0):
    h = (ix * 374761393 + iy * 668265263 + iz * 1440670441 + seed * 144269504) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFF) / 65535.0


def vnoise(p, seed=0):
    p = np.asarray(p, dtype=np.float64)
    i = np.floor(p).astype(np.int64)
    f = p - i
    u = f * f * (3 - 2 * f)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (u[..., 0] if dx else 1 - u[..., 0]) * (u[..., 1] if dy else 1 - u[..., 1]) * (u[..., 2] if dz else 1 - u[..., 2])
                out = out + w * _hash3(i[..., 0] + dx, i[..., 1] + dy, i[..., 2] + dz, seed)
    return out


def fbm(p, oct=4, seed=0):
    a, s, t = 0.5, 1.0, 0
    for k in range(oct):
        t = t + a * vnoise(p * s, seed + k * 17)
        a *= 0.5
        s *= 2.03
    return t / (1 - 0.5 ** oct)


# ------------------------------------------------------------------ maps
def raster(ob, size, uv_name=None):
    """Rasterise the mesh's triangles into its UV space: per texel position, normal (smooth), triangle id and
    barycentrics. The mesh must be triangulated and unwrapped."""
    me = ob.data
    me.calc_loop_triangles()
    uvl = me.uv_layers[uv_name] if uv_name else me.uv_layers.active
    nt = len(me.loop_triangles)
    tl = np.zeros(nt * 3, np.int64)
    me.loop_triangles.foreach_get('loops', tl)
    tl = tl.reshape(-1, 3)
    tv = np.zeros(nt * 3, np.int64)
    me.loop_triangles.foreach_get('vertices', tv)
    tv = tv.reshape(-1, 3)
    uv = np.zeros(len(me.loops) * 2)
    uvl.data.foreach_get('uv', uv)
    uv = uv.reshape(-1, 2)
    co = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    vn = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('normal', vn)
    vn = vn.reshape(-1, 3)
    pos = np.zeros((size, size, 3), np.float32)
    nor = np.zeros((size, size, 3), np.float32)
    tri = np.full((size, size), -1, np.int32)
    bary = np.zeros((size, size, 3), np.float32)
    T = uv[tl] * size - 0.5  # texel centres at integer coordinates
    for t in range(nt):
        a, b, c = T[t]
        x0, x1 = int(np.floor(min(a[0], b[0], c[0]))), int(np.ceil(max(a[0], b[0], c[0])))
        y0, y1 = int(np.floor(min(a[1], b[1], c[1]))), int(np.ceil(max(a[1], b[1], c[1])))
        x0, y0 = max(0, x0), max(0, y0)
        x1, y1 = min(size - 1, x1), min(size - 1, y1)
        if x1 < x0 or y1 < y0:
            continue
        X, Y = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-12:
            continue
        w0 = ((b[1] - c[1]) * (X - c[0]) + (c[0] - b[0]) * (Y - c[1])) / d
        w1 = ((c[1] - a[1]) * (X - c[0]) + (a[0] - c[0]) * (Y - c[1])) / d
        w2 = 1 - w0 - w1
        e = -0.02
        m = (w0 >= e) & (w1 >= e) & (w2 >= e)
        if not m.any():
            continue
        ys, xs = Y[m], X[m]
        W = np.stack([w0[m], w1[m], w2[m]], 1).clip(0, 1)
        W /= W.sum(1, keepdims=True)
        vi = tv[t]
        pos[ys, xs] = W @ co[vi]
        n = W @ vn[vi]
        nor[ys, xs] = n / np.maximum(1e-9, np.linalg.norm(n, axis=1, keepdims=True))
        tri[ys, xs] = t
        bary[ys, xs] = W
    mask = tri >= 0
    return {'pos': pos, 'nor': nor, 'tri': tri, 'bary': bary, 'mask': mask, 'tv': tv, 'size': size}


def texel_attr(maps, vals):
    """Interpolate a per-vertex attribute (n,) or (n, k) over the texels."""
    vals = np.asarray(vals, dtype=np.float32)
    tv, tri, bary = maps['tv'], maps['tri'], maps['bary']
    m = maps['mask']
    out = np.zeros(tri.shape + vals.shape[1:], np.float32)
    t = tri[m]
    v = vals[tv[t]]  # (k, 3, ...)
    w = bary[m]
    if v.ndim == 2:
        out[m] = (v * w).sum(1)
    else:
        out[m] = (v * w[:, :, None]).sum(1)
    return out


def vertex_ao(ob, others=(), rays=28, dist=0.12, seed=1):
    """Ambient occlusion per vertex: the share of a cosine hemisphere that reaches open air within `dist`."""
    dg = bpy.context.evaluated_depsgraph_get()
    bm_obs = [ob] + list(others)
    trees = [BVHTree.FromObject(o, dg) for o in bm_obs]
    me = ob.data
    co = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    vn = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('normal', vn)
    vn = vn.reshape(-1, 3)
    rng = np.random.default_rng(seed)
    dirs = rng.normal(size=(rays, 3))
    dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
    ao = np.zeros(len(co))
    for i in range(len(co)):
        n = Vector(vn[i])
        p = Vector(co[i]) + n * 0.0015
        hit = 0.0
        tot = 0.0
        for d in dirs:
            dv = Vector(d)
            c = dv.dot(n)
            if c < 0:
                dv = -dv
                c = -c
            tot += c
            for tr in trees:
                h = tr.ray_cast(p, dv, dist)
                if h[0] is not None:
                    hit += c * (1 - (h[3] / dist) ** 2)
                    break
        ao[i] = 1 - hit / max(1e-6, tot)
    return ao


def cavity(ob, iters=3):
    """Concavity per vertex (positive in creases): how far a vertex sits below the average of its neighbours."""
    me = ob.data
    co = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    vn = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get('normal', vn)
    vn = vn.reshape(-1, 3)
    ed = np.zeros(len(me.edges) * 2, np.int64)
    me.edges.foreach_get('vertices', ed)
    ed = ed.reshape(-1, 2)
    avg = co.copy()
    for _ in range(iters):
        acc = np.zeros_like(avg)
        cnt = np.zeros(len(avg))
        np.add.at(acc, ed[:, 0], avg[ed[:, 1]])
        np.add.at(acc, ed[:, 1], avg[ed[:, 0]])
        np.add.at(cnt, ed[:, 0], 1)
        np.add.at(cnt, ed[:, 1], 1)
        avg = acc / np.maximum(1, cnt)[:, None]
    return ((avg - co) * vn).sum(1)


# ------------------------------------------------------------------ brush strokes
def strokes(P, F, N, cell=0.011, length=0.024, width=0.0026, seed=0, chunk=120000, density=1.0):
    """Short tapered brush strokes lying along the flow F (unit vectors), splatted in 3D around each texel position P
    (k, 3). Returns per texel: coverage (0/1), the stroke's random value (0..1, the painter's choice of tone) and how
    far along the stroke the texel is (-1 root .. 1 tip). Later (higher-ranked) strokes paint over earlier ones."""
    k = len(P)
    cov = np.zeros(k, np.float32)
    val = np.zeros(k, np.float32)
    along_o = np.zeros(k, np.float32)
    best = np.full(k, -1.0, np.float32)
    half = length / 2
    offs = np.array([(i, j, l) for i in (-1, 0, 1) for j in (-1, 0, 1) for l in (-1, 0, 1)], np.int64)
    for s in range(0, k, chunk):
        p = P[s:s + chunk].astype(np.float64)
        f = F[s:s + chunk].astype(np.float64)
        n = N[s:s + chunk].astype(np.float64)
        base = np.floor(p / cell).astype(np.int64)
        bcov = np.zeros(len(p), np.float32)
        bval = np.zeros(len(p), np.float32)
        bal = np.zeros(len(p), np.float32)
        brank = np.full(len(p), -1.0, np.float32)
        for o in offs:
            c = base + o
            hx = _hash3(c[:, 0], c[:, 1], c[:, 2], seed)
            hy = _hash3(c[:, 0], c[:, 1], c[:, 2], seed + 1)
            hz = _hash3(c[:, 0], c[:, 1], c[:, 2], seed + 2)
            rank = _hash3(c[:, 0], c[:, 1], c[:, 2], seed + 3)
            v = _hash3(c[:, 0], c[:, 1], c[:, 2], seed + 4)
            keep = rank < density
            ctr = (c + np.stack([hx, hy, hz], 1)) * cell
            d = p - ctr
            # project the stroke onto the surface at the texel: drop the normal component
            d = d - (d * n).sum(1, keepdims=True) * n
            L = half * (0.7 + 0.6 * v)
            a = (d * f).sum(1)
            perp = np.linalg.norm(d - a[:, None] * f, axis=1)
            t = a / L
            taper = np.clip(1 - np.abs(t), 0, 1) ** 0.55 * (0.75 + 0.5 * hx)
            hit = keep & (np.abs(t) <= 1) & (perp <= width * taper) & (rank > brank)
            brank = np.where(hit, rank, brank)
            bcov = np.where(hit, 1, bcov)
            bval = np.where(hit, v, bval)
            bal = np.where(hit, t, bal)
        cov[s:s + chunk] = bcov
        val[s:s + chunk] = bval
        along_o[s:s + chunk] = bal
    return cov, val, along_o


# ------------------------------------------------------------------ cleaning and saving
def dilate(rgb, mask, px=6):
    """Spread the painted texels over the empty ones around each island (so mipmaps and seams don't bleed)."""
    rgb = rgb.copy()
    m = mask.copy()
    for _ in range(px):
        acc = np.zeros_like(rgb)
        cnt = np.zeros(m.shape, np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            sm = np.roll(np.roll(m, dy, 0), dx, 1)
            sr = np.roll(np.roll(rgb, dy, 0), dx, 1)
            acc += sr * sm[..., None]
            cnt += sm
        new = (~m) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]
        m = m | new
    rgb[~m] = rgb[m].mean(0) if m.any() else 0
    return rgb


def despeckle(idx, mask, rounds=1):
    """Hand-painted clusters, not noise: a texel whose ramp index differs from all 4 neighbours takes their majority."""
    idx = idx.copy()
    for _ in range(rounds):
        nb = [np.roll(idx, 1, 0), np.roll(idx, -1, 0), np.roll(idx, 1, 1), np.roll(idx, -1, 1)]
        same = sum((n == idx).astype(np.int32) for n in nb)
        lone = (same == 0) & mask
        med = np.median(np.stack(nb, 0), 0)
        idx[lone] = np.round(med[lone])
    return idx


def save(rgb, mask, path, px=8):
    from PIL import Image
    out = dilate(rgb, mask, px)
    img = (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(img[::-1]).save(path)  # (row 0 is v = 0, the bottom of the image)
    return path


def image_from(path, name):
    img = bpy.data.images.load(path)
    img.name = name
    return img


def material(name, img_path=None, rough=0.85, metal=0.0, color=None, alpha=None, emit=None):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if color is not None:
        bsdf.inputs['Base Color'].default_value = (*color, 1)
    if img_path:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(img_path)
        tex.interpolation = 'Closest'
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha is not None:
        bsdf.inputs['Alpha'].default_value = alpha
        try:
            mat.surface_render_method = 'BLENDED'
        except Exception:
            mat.blend_method = 'BLEND'
    if emit is not None:
        bsdf.inputs['Emission Color'].default_value = (*emit[0], 1)
        bsdf.inputs['Emission Strength'].default_value = emit[1]
    return mat
