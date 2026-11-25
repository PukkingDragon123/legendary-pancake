"""Barnaby Birchbark, the beaver who keeps the lodge store: a hand-painted, skinned and animated 3D beaver.

    ~/.cache/gg-bpy/bin/python art/shop/beaver.py [--preview] [--no-export] [--size=2048]

Built headless in Blender (bpy 5.x), in metres, standing on z = 0 and facing -Y (glTF +Z after export):

- the body is one smooth form: metaballs (haunches, belly, chest, a broad head with a blunt muzzle, puffy cheeks,
  little round ears, short arms with five-fingered hands, big webbed hind feet), voxel-remeshed, lightly smoothed and
  roughed with fur clumps along the flow of the coat, then decimated; the flat paddle tail is its own scaly sheet;
- props: two orange incisors (and the lower pair on the jaw), glossy dark eyes, a canvas shop apron with a bib, neck
  strap, waist ties and a split front pocket (a folding rule and a pencil stub peeking out), half-moon spectacles on
  the muzzle, a pencil tucked behind the right ear (and a second one in the right hand for the gnaw clip);
- the coat is painted per texel (numpy) from the surface position and normal: hue-shifted ramps, short tapered
  brush strokes that follow the fur's flow (dark partings, lit tips), a paler muzzle and cheeks, a leathery black
  nose, dark hands and feet, the tail's scales as a grid of rounded plates, baked ambient occlusion; no baked
  directional light (the game lights him);
- an armature (root, hips, spine, chest, neck, head, jaw, ears, eyes, arms, hands, legs, feet, four tail bones and two
  pencil bones), bone-heat weights, and clips: idle, talk, wave, present, hop, think, gnaw.

Writes public/models/shop/beaver.glb (meshopt + WebP packing happens in art/shop/pack.mjs).
"""
import json
import math
import os
import sys
import time

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Quaternion, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import paintkit as pk  # noqa: E402
import craft  # noqa: E402
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
BUILD = os.environ.get('SHOP_BUILD') or os.path.join(ROOT, 'art', 'shop', '_build')
os.makedirs(BUILD, exist_ok=True)
FLAGS = [a for a in sys.argv[1:] if a.startswith('--')]
SIZE = next((int(a.split('=')[1]) for a in FLAGS if a.startswith('--size=')), 2048)
T0 = time.time()


def log(*a):
    print(f'[beaver {time.time() - T0:6.1f}s]', *a, flush=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = 24
    return sc


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def activate(ob):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)


def apply_mods(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)


def mesh_ob(name, V, F):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in V], [], [tuple(f) for f in F])
    me.update()
    return link(bpy.data.objects.new(name, me))


def verts(ob):
    a = np.zeros(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('co', a)
    return a.reshape(-1, 3)


def set_verts(ob, V):
    ob.data.vertices.foreach_set('co', np.asarray(V, dtype=np.float64).ravel())
    ob.data.update()


def vnormals(ob):
    a = np.zeros(len(ob.data.vertices) * 3)
    ob.data.vertices.foreach_get('normal', a)
    return a.reshape(-1, 3)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def ell(p, c, r):
    """Normalised ellipsoid distance (1 on the surface)."""
    return np.sqrt((((p - np.array(c)) / np.array(r)) ** 2).sum(-1))


# ------------------------------------------------------------------ noise (value noise, vectorised)
def _hash3(ix, iy, iz, seed=0):
    h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 144269504) & 0xFFFFFFFF
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


# ------------------------------------------------------------------ the body: metaballs
# the visible radius of a lone metaball element is about 0.575 of its radius (stiffness 2, threshold 0.6)
K = 1 / 0.575
EAR_AT = (0.136, 0.032, 0.952)


def _q_from_x(d):
    d = Vector(d).normalized()
    return Vector((1, 0, 0)).rotation_difference(d)


def build_body():
    mb = bpy.data.metaballs.new('beaver_mb')
    mb.resolution = 0.007
    mb.render_resolution = 0.007
    mb.threshold = 0.6

    def E(c, r, stiff=2.0, neg=False):
        e = mb.elements.new(type='ELLIPSOID')
        e.co = Vector(c)
        e.radius = K
        e.size_x, e.size_y, e.size_z = r
        e.stiffness = stiff
        e.use_negative = neg
        return e

    def B(c, r, stiff=2.0):
        e = mb.elements.new(type='BALL')
        e.co = Vector(c)
        e.radius = r * K
        e.stiffness = stiff
        return e

    def C(a, b, r, stiff=2.0):
        a, b = Vector(a), Vector(b)
        e = mb.elements.new(type='CAPSULE')
        e.co = (a + b) / 2
        e.radius = r * K
        e.size_x = (b - a).length / 2
        e.rotation = _q_from_x(b - a)
        e.stiffness = stiff
        return e

    # trunk: big haunches and belly, a narrower chest, sloping shoulders, no neck to speak of
    E((0, 0.015, 0.30), (0.235, 0.215, 0.24))
    E((0, -0.005, 0.49), (0.2, 0.175, 0.17))
    E((0, -0.01, 0.63), (0.168, 0.148, 0.12))
    E((0, -0.02, 0.73), (0.145, 0.13, 0.09))
    E((0, 0.05, 0.40), (0.15, 0.13, 0.2), stiff=1.4)   # the rounded back
    # head: a broad, flat-topped skull, deep cheeks, a blunt square muzzle, the nose bulb on top, a soft chin
    E((0, -0.03, 0.895), (0.15, 0.142, 0.122))
    E((0, -0.01, 0.80), (0.135, 0.12, 0.075), stiff=1.6)
    for sx in (-1, 1):
        E((sx * 0.085, -0.12, 0.85), (0.078, 0.078, 0.068))       # cheeks
        E((sx * 0.058, -0.105, 0.948), (0.062, 0.066, 0.045), stiff=1.5)  # brows
    E((0, -0.175, 0.865), (0.088, 0.085, 0.064))     # muzzle
    E((0, -0.228, 0.882), (0.06, 0.044, 0.042))      # nose bulb
    E((0, -0.16, 0.806), (0.052, 0.058, 0.032), stiff=1.6)  # chin
    # ears: little round leathery cups, low on the sides and toward the back of the head
    for sx in (-1, 1):
        E((sx * EAR_AT[0], EAR_AT[1], EAR_AT[2]), (0.029, 0.017, 0.029), stiff=2.6)
    # arms (rest: A-pose, out and a little forward), stubby but clear of the body, with five-fingered hands
    for sx in (-1, 1):
        C((sx * 0.15, -0.03, 0.665), (sx * 0.255, -0.075, 0.53), 0.05)
        C((sx * 0.255, -0.075, 0.53), (sx * 0.295, -0.15, 0.44), 0.039)
        E((sx * 0.303, -0.178, 0.414), (0.033, 0.031, 0.026), stiff=2.2)  # palm
        for k in range(5):
            a = (k - 2) * 0.42
            d = Vector((sx * math.sin(a) * 0.4, -math.cos(a) * 0.55 - 0.25, -0.75)).normalized()
            base = Vector((sx * (0.303 + math.sin(a) * 0.019), -0.19 - math.cos(a) * 0.012, 0.401))
            ln = 0.03 if k in (1, 2, 3) else 0.022
            C(base, base + d * ln, 0.0088 if k != 0 else 0.0098, stiff=3.2)
            LM.setdefault('tips', []).append(np.array(base + d * (ln + 0.006)))
    # legs: big haunches, short shins, long flat webbed hind feet with five toes
    for sx in (-1, 1):
        E((sx * 0.135, -0.02, 0.19), (0.105, 0.125, 0.13))
        C((sx * 0.145, -0.05, 0.11), (sx * 0.15, -0.085, 0.04), 0.05)
        E((sx * 0.152, -0.155, 0.024), (0.068, 0.12, 0.024), stiff=2.6)
        for k in range(5):
            a = (k - 2) * 0.3
            base = Vector((sx * (0.152 + math.sin(a) * 0.062), -0.215, 0.021))
            d = Vector((sx * math.sin(a) * 0.85, -1, -0.06)).normalized()
            ln = 0.082 if k in (1, 2, 3) else 0.07
            C(base, base + d * ln, 0.0102, stiff=3.4)
            LM.setdefault('toes', []).append(np.array(base + d * (ln + 0.008)))
        E((sx * 0.152, -0.25, 0.012), (0.066, 0.046, 0.0055), stiff=3.0)  # the web between the toes
    # the furry root of the tail (the scaly paddle is its own sheet)
    C((0, 0.17, 0.16), (0, 0.27, 0.075), 0.06)

    ob = link(bpy.data.objects.new('beaver_mb', mb))
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    body = link(bpy.data.objects.new('body', me))
    bpy.data.objects.remove(ob)
    m = body.modifiers.new('re', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = 0.0055
    apply_mods(body)
    m = body.modifiers.new('sm', 'SMOOTH')
    m.factor = 0.5
    m.iterations = 6
    apply_mods(body)
    log('body', len(body.data.vertices), 'verts')
    return body


# ------------------------------------------------------------------ shaping: eye sockets, the lip cleft, fur clumps
def flow_dir(P):
    """The direction the coat lies at each point: down the body and back off the head, out along the limbs."""
    n = len(P)
    F = np.zeros((n, 3))
    F[:, 2] = -1.0
    F[:, 1] += 0.35
    head = P[:, 2] > 0.76
    # on the head the fur runs from the nose back over the skull and down the cheeks
    F[head] = np.stack([np.sign(P[head, 0]) * 0.35, np.ones(head.sum()), -0.35 + 0 * P[head, 0]], 1)
    # arms: towards the hands
    arm = (np.abs(P[:, 0]) > 0.15) & (P[:, 2] > 0.38) & (P[:, 2] < 0.7)
    F[arm] = np.stack([np.sign(P[arm, 0]) * 0.6, -0.5 + 0 * P[arm, 0], -1.0 + 0 * P[arm, 0]], 1)
    # haunches: down and forward to the feet
    leg = (P[:, 2] < 0.26) & (np.abs(P[:, 0]) > 0.06)
    F[leg] = np.stack([np.sign(P[leg, 0]) * 0.2, -0.6 + 0 * P[leg, 0], -1.0 + 0 * P[leg, 0]], 1)
    return F / np.linalg.norm(F, axis=1, keepdims=True)


LM = {}


def landmarks(body):
    """Key points on the actual surface (raycasts), used by the sculpt, the props, the paint and the rig."""
    bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())

    def hit(o, t):
        o, t = Vector(o), Vector(t)
        h = bvh.ray_cast(o, (t - o).normalized())
        return np.array(h[0]) if h[0] is not None else np.array(t), np.array(h[1]) if h[1] is not None else np.array((0, -1, 0))

    LM['nose'], _ = hit((0, -1, 0.884), (0, 0, 0.884))
    LM['top'], _ = hit((0, -0.03, 2), (0, -0.03, 0))
    LM['lip'], _ = hit((0.009, -1, 0.832), (0.009, 0, 0.832))
    LM['chin'], _ = hit((0, -0.15, 0.4), (0, -0.15, 1.2))
    LM['bridge'], _ = hit((0, -1, 0.916), (0, 0, 0.916))
    for sx, k in ((1, 'l'), (-1, 'r')):
        LM['spec_' + k], LM['specn_' + k] = hit((sx * 0.046, -1, 0.906), (sx * 0.046, 0, 0.906))
        LM['temple_' + k], _ = hit((sx * 0.5, -0.07, 0.94), (0, -0.07, 0.94))
        LM['eye_' + k], LM['eyen_' + k] = hit((sx * 0.4, -0.42, 0.95), (sx * 0.0, -0.08, 0.93))
        LM['ear_' + k] = np.array((sx * EAR_AT[0], EAR_AT[1], EAR_AT[2]))
        LM['palm_' + k] = np.array((sx * 0.303, -0.178, 0.414))
    for k, v in LM.items():
        log('lm', k, np.round(v, 3))


def sculpt_body(body):
    V = verts(body)
    N = vnormals(body)
    d = np.zeros(len(V))
    # eye sockets: a soft dip where the eyes sit, a little brow ridge over them
    for sx in (-1, 1):
        c = LM['eye_l' if sx > 0 else 'eye_r']
        r = np.linalg.norm(V - c, axis=1)
        d -= 0.009 * np.exp(-(r / 0.022) ** 2)
        d += 0.004 * np.exp(-(np.linalg.norm(V - (c + [0, 0.01, 0.024]), axis=1) / 0.02) ** 2)
    # the split upper lip under the nose
    cl = np.exp(-((V[:, 0] / 0.006) ** 2)) * np.exp(-(((V[:, 2] - (LM['lip'][2] + 0.006)) / 0.018) ** 2)) * (V[:, 1] < LM['lip'][1] + 0.03)
    d -= 0.006 * cl
    # nostrils: two shallow dents on the nose bulb
    for sx in (-1, 1):
        d -= 0.005 * np.exp(-(np.linalg.norm(V - (LM['nose'] + [sx * 0.018, 0.004, -0.012]), axis=1) / 0.009) ** 2)
    # ear cups
    for sx in (-1, 1):
        c = LM['ear_l' if sx > 0 else 'ear_r'] + [0, -0.016, 0]
        d -= 0.008 * np.exp(-(np.linalg.norm(V - c, axis=1) / 0.016) ** 2)
    # fur clumps: tufts that lie along the coat (long noise along the flow, short across), stronger on the cheeks,
    # the back of the head and the haunches, none on the nose, hands, feet or ears
    F = flow_dir(V)
    up = np.cross(F, N)
    up /= np.maximum(1e-6, np.linalg.norm(up, axis=1, keepdims=True))
    s_along = (V * F).sum(1) * 28
    s_across = (V * up).sum(1) * 95
    clump = vnoise(np.stack([s_across, s_along, V[:, 2] * 40], 1), 3)
    clump2 = vnoise(np.stack([s_across * 2.1, s_along * 1.7, V[:, 0] * 60], 1), 9)
    fur = (clump - 0.5) * 0.006 + (clump2 - 0.5) * 0.0025
    bare = np.zeros(len(V))
    bare = np.maximum(bare, np.exp(-(ell(V, LM['nose'] + [0, 0.02, -0.004], (0.05, 0.04, 0.035)) ** 2) * 2))   # nose
    bare = np.maximum(bare, (V[:, 2] < 0.05).astype(float))                                       # soles, toes
    for sx in (-1, 1):
        bare = np.maximum(bare, np.exp(-(ell(V, LM['palm_l' if sx > 0 else 'palm_r'] + [0, -0.01, -0.01], (0.05, 0.05, 0.05)) ** 2) * 2))  # hands
        bare = np.maximum(bare, np.exp(-(ell(V, LM['ear_l' if sx > 0 else 'ear_r'], (0.035, 0.022, 0.035)) ** 2) * 2))   # ears
    cheek = sum(np.exp(-(ell(V, (sx * 0.11, -0.12, 0.845), (0.07, 0.07, 0.06)) ** 2)) for sx in (-1, 1))
    d += fur * (1 - np.clip(bare, 0, 1)) * (1 + cheek * 0.8)
    set_verts(body, V + N * d[:, None])


def decimate(ob, tris):
    tri = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tri > tris:
        m = ob.modifiers.new('dec', 'DECIMATE')
        m.ratio = tris / tri
        m.use_collapse_triangulate = True
        apply_mods(ob)
    m = ob.modifiers.new('tri', 'TRIANGULATE')
    apply_mods(ob)


# ------------------------------------------------------------------ the tail: a flat scaly paddle
def build_tail():
    L, W = 0.40, 0.205
    nu, nv = 18, 34
    V, F = [], []
    # a grid over the paddle (u across, v along), top and bottom sheets joined at the rim
    def outline(v):  # half width at v (0 at the root, 1 at the tip): an oval, narrower at the root
        return W / 2 * (np.sin(np.clip(v, 0, 1) * math.pi) ** 0.55) * (0.62 + 0.38 * smoothstep(0, 0.45, v))

    def thick(u, v):  # half thickness: thick at the root and along the midline, thin at the rim
        return (0.018 + 0.016 * (1 - v)) * (1 - u * u) ** 0.6 + 0.0025

    top, bot = {}, {}
    for j in range(nv + 1):
        v = j / nv
        for i in range(nu + 1):
            u = i / nu * 2 - 1
            x = u * max(0.004, outline(v))
            y = 0.255 + v * L
            z = 0.045 - v * 0.03 + 0.012 * u * u + 0.02 * (1 - v) ** 3
            t = thick(u, v)
            top[i, j] = len(V)
            V.append((x, y, z + t))
            bot[i, j] = len(V)
            V.append((x, y, z - t * 0.8))
    for j in range(nv):
        for i in range(nu):
            F.append((top[i, j], top[i + 1, j], top[i + 1, j + 1], top[i, j + 1]))
            F.append((bot[i, j], bot[i, j + 1], bot[i + 1, j + 1], bot[i + 1, j]))
    for j in range(nv):
        F.append((bot[0, j], bot[0, j + 1], top[0, j + 1], top[0, j]))
        F.append((top[nu, j], top[nu, j + 1], bot[nu, j + 1], bot[nu, j]))
    for i in range(nu):
        F.append((top[i, 0], bot[i, 0], bot[i + 1, 0], top[i + 1, 0]))
        F.append((top[i, nv], top[i + 1, nv], bot[i + 1, nv], bot[i, nv]))
    ob = mesh_ob('tail', V, F)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0008)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    m = ob.modifiers.new('tri', 'TRIANGULATE')
    apply_mods(ob)
    return ob


# ------------------------------------------------------------------ small parts
def uv_sphere(name, c, r, seg=16, ring=10, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * r * scale[0] + c[0], v.co.y * r * scale[1] + c[1], v.co.z * r * scale[2] + c[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def box(name, size, at, rot=None, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    if bevel:
        bm.transform(Matrix.Diagonal((*size, 1)))
        bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=bevel, segments=2, affect='EDGES', profile=0.5)
        size = (1, 1, 1)
    M = Matrix.Translation(at) @ (rot.to_matrix().to_4x4() if rot else Matrix.Identity(4)) @ Matrix.Diagonal((*size, 1))
    bm.transform(M)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def tube(name, pts, r, n=8, closed=False, cap=True):
    """A tube through `pts` (rings of n), radius r (scalar or per point)."""
    pts = [Vector(p) for p in pts]
    rs = r if isinstance(r, (list, tuple, np.ndarray)) else [r] * len(pts)
    V, F = [], []
    up0 = Vector((0, 0, 1))
    for k, p in enumerate(pts):
        a = pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]
        if closed:
            a = pts[(k + 1) % len(pts)] - pts[k - 1]
        a.normalize()
        u = up0 if abs(a.dot(up0)) < 0.9 else Vector((1, 0, 0))
        x = a.cross(u).normalized()
        y = a.cross(x).normalized()
        for i in range(n):
            t = i / n * math.tau
            V.append(p + (x * math.cos(t) + y * math.sin(t)) * rs[k])
    m = len(pts)
    for k in range(m if closed else m - 1):
        k2 = (k + 1) % m
        for i in range(n):
            F.append((k * n + i, k * n + (i + 1) % n, k2 * n + (i + 1) % n, k2 * n + i))
    if cap and not closed:
        F.append(tuple(range(n))[::-1])
        F.append(tuple((m - 1) * n + i for i in range(n)))
    return mesh_ob(name, V, F)


def pencil(name, base, d, length=0.105, r=0.0052):
    """A yellow hexagonal pencil: a pink eraser in a brass ferrule, a sharpened cedar tip with graphite."""
    d = Vector(d).normalized()
    u = d.cross(Vector((0, 0, 1)))
    if u.length < 0.1:
        u = d.cross(Vector((1, 0, 0)))
    u.normalize()
    w = d.cross(u).normalized()
    base = Vector(base)
    V, F, C = [], [], []
    stations = [(0.0, 0.82, 'eraser'), (0.012, 0.82, 'eraser'), (0.012, 1.04, 'brass'), (0.024, 1.04, 'brass'),
                (0.024, 1.0, 'yellow'), (length - 0.02, 1.0, 'yellow'), (length - 0.02, 0.98, 'cedar'),
                (length - 0.005, 0.32, 'cedar'), (length - 0.005, 0.32, 'lead'), (length, 0.02, 'lead')]
    n = 6
    for s, (t, k, mat) in enumerate(stations):
        for i in range(n):
            a = i / n * math.tau + math.pi / 6
            V.append(base + d * t + (u * math.cos(a) + w * math.sin(a)) * r * k)
    for s in range(len(stations) - 1):
        for i in range(n):
            F.append((s * n + i, s * n + (i + 1) % n, (s + 1) * n + (i + 1) % n, (s + 1) * n + i))
            C.append(stations[s + 1][2] if stations[s][2] != stations[s + 1][2] and s + 1 < len(stations) else stations[s][2])
    F.append(tuple(range(n))[::-1])
    C.append('eraser')
    ob = mesh_ob(name, V, F)
    ob['cols'] = C
    return ob


PROP_COL = {
    'yellow': (0.86, 0.66, 0.2), 'eraser': (0.84, 0.52, 0.5), 'brass': (0.78, 0.62, 0.3), 'cedar': (0.83, 0.64, 0.45),
    'lead': (0.18, 0.18, 0.2), 'tooth': (0.9, 0.5, 0.16), 'wire': (0.72, 0.56, 0.28), 'rule': (0.86, 0.72, 0.36),
    'book': (0.45, 0.28, 0.24), 'paper': (0.92, 0.88, 0.78), 'eye': (0.05, 0.04, 0.04),
}


def props():
    obs = {}
    # eyes: small, dark, glossy, set high on the sides of the head
    for sx, nm in ((1, 'eye_l'), (-1, 'eye_r')):
        p, n = LM[nm], LM['eyen_' + nm[-1]]
        e = uv_sphere(nm, p - n * 0.0075, 0.0145, 14, 10, (0.95, 1, 1.05))
        obs[nm] = e
    # the incisors: two broad orange teeth under the split lip, and the lower pair on the jaw
    teeth = []
    for sx in (-1, 1):
        teeth.append(box('tooth_u', (0.0165, 0.009, 0.043), Vector((sx * 0.0088, LM['lip'][1] + 0.004, LM['lip'][2] - 0.0135)), Quaternion((1, 0, 0), math.radians(-6)), bevel=0.003))
    obs['teeth_u'] = join(teeth, 'teeth_u')
    teeth = []
    for sx in (-1, 1):
        teeth.append(box('tooth_d', (0.011, 0.007, 0.018), Vector((sx * 0.0065, LM['lip'][1] + 0.014, LM['lip'][2] - 0.03)), Quaternion((1, 0, 0), math.radians(12))))
    obs['teeth_d'] = join(teeth, 'teeth_d')
    # a pencil tucked behind the right ear, and its twin for the hand (shown only while he gnaws)
    obs['pencil_ear'] = pencil('pencil_ear', Vector(PENCIL['ear'][0]), Vector(PENCIL['ear'][1]))
    obs['pencil_hand'] = pencil('pencil_hand', Vector(PENCIL['hand'][0]), Vector(PENCIL['hand'][1]), length=0.1)
    # half-moon spectacles riding low on the muzzle: two half-round brass rims, a bridge, arms back to the ears
    parts = []
    for sx in (-1, 1):
        k = 'l' if sx > 0 else 'r'
        sp = Vector(LM['spec_' + k])
        c = sp + Vector((sx * 0.006, -0.013, 0.002))
        yaw = math.radians(sx * 26)
        R = Matrix.Rotation(yaw, 3, 'Z')
        pts = []
        for i in range(13):
            a = math.pi + i / 12 * math.pi
            pts.append(c + R @ Vector((math.cos(a) * 0.025, 0, math.sin(a) * 0.017 + 0.005)))
        parts.append(tube('rim', pts + [pts[0]], 0.0031, n=6, closed=False))
        lens = []
        for i in range(13):
            a = math.pi + i / 12 * math.pi
            lens.append(c + R @ Vector((math.cos(a) * 0.023, 0.0005, math.sin(a) * 0.015 + 0.005)))
        # (the glass itself goes in its own object so it can be see-through)
        obs.setdefault('glass', []).append((c + R @ Vector((0, 0.0005, 0.005)), lens))
        # the arm: from the outer end of the rim along the side of the head to the ear
        e = c + R @ Vector((sx * 0.025, 0, 0.005))
        tp = Vector(LM['temple_' + k]) + Vector((sx * 0.006, 0, 0.004))
        ear = Vector(LM['ear_' + k]) + Vector((-sx * 0.012, -0.012, -0.03))
        parts.append(tube('arm', [e, (e + tp) / 2 + Vector((sx * 0.012, 0, 0)), tp, ear], 0.0022, n=4))
    br = Vector(LM['bridge']) + Vector((0, -0.006, 0))
    l0 = Vector(LM['spec_r']) + Vector((-0.006 + 0.02, -0.014, 0.01))
    l1 = Vector(LM['spec_l']) + Vector((0.006 - 0.02, -0.014, 0.01))
    parts.append(tube('bridge', [l0, br, l1], 0.0022, n=4))
    obs['specs'] = join(parts, 'specs')
    V, F = [], []
    for c, ring in obs.pop('glass'):
        k0 = len(V)
        V.append(tuple(c))
        V += [tuple(p) for p in ring]
        for i in range(len(ring) - 1):
            F.append((k0, k0 + 1 + i, k0 + 2 + i))
    obs['glass'] = mesh_ob('glass', V, F)
    return obs


def join(obs, name):
    activate(obs[0])
    for o in obs[1:]:
        o.select_set(True)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


# ------------------------------------------------------------------ the apron
def build_apron(body, tail):
    """Canvas bib apron draped over the front: cast onto the body from in front, then hung straight below the belly."""
    bvh = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())
    nx, nz = 30, 46
    z0, z1 = 0.2, 0.745

    def half_w(z):  # the apron's outline: a bib on top, flaring to the skirt at the waist
        bib = 0.088 + 0.012 * (z1 - z) / 0.2
        skirt = 0.215 - 0.03 * smoothstep(0.2, 0.45, z)
        return np.where(z > 0.52, bib, np.where(z > 0.42, bib + (skirt - bib) * smoothstep(0.52, 0.42, z), skirt))

    V = np.zeros((nz + 1, nx + 1, 3))
    hit_y = np.zeros((nz + 1, nx + 1))
    for j in range(nz + 1):
        z = z1 - (z1 - z0) * j / nz
        hw = float(half_w(np.array(z)))
        for i in range(nx + 1):
            x = (i / nx * 2 - 1) * hw
            h = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
            hit_y[j, i] = h[0].y if h[0] is not None else 0.0
            V[j, i] = (x, hit_y[j, i], z)
    # hang: going down, the cloth can't tuck back in under the belly faster than a gentle drape
    off = 0.015
    for i in range(nx + 1):
        prev = None
        for j in range(nz + 1):
            y = hit_y[j, i] - off
            if prev is not None:
                y = min(y, prev + 0.008 * (z1 - z0) / nz * 6)
            V[j, i, 1] = y
            prev = y
    # wrap the skirt's sides back around the haunches a little
    for j in range(nz + 1):
        for i in range(nx + 1):
            u = i / nx * 2 - 1
            z = V[j, i, 2]
            if z < 0.5:
                V[j, i, 1] += 0.06 * max(0, abs(u) - 0.75) ** 1.5 * 8 * smoothstep(0.5, 0.4, z)
    # soft folds in the skirt
    for j in range(nz + 1):
        for i in range(nx + 1):
            z = V[j, i, 2]
            V[j, i, 1] -= 0.004 * math.sin(V[j, i, 0] * 70 + 1.3) * smoothstep(0.42, 0.22, z)
    idx = np.arange((nz + 1) * (nx + 1)).reshape(nz + 1, nx + 1)
    F = []
    for j in range(nz):
        for i in range(nx):
            F.append((idx[j, i], idx[j + 1, i], idx[j + 1, i + 1], idx[j, i + 1]))
    ap = mesh_ob('apron', V.reshape(-1, 3), F)
    # UVs: the cloth's own flat layout (u across, v down) for the canvas texture
    me = ap.data
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            j, i = divmod(vi, nx + 1)
            uv.data[li].uv = (i / nx * 0.5, 1 - j / nz)  # left half of the apron atlas: the cloth
    m = ap.modifiers.new('sol', 'SOLIDIFY')
    m.thickness = 0.005
    m.offset = 1
    apply_mods(ap)
    # straps: round the back of the neck and round the waist, with a bow at the back
    neck = []
    for k in range(17):
        a = -math.pi * 0.5 + k / 16 * math.pi * 2
        r = 0.122
        neck.append(Vector((math.cos(a) * r * 0.92, math.sin(a) * r * 0.95 - 0.03, 0.758 + 0.03 * max(0, math.sin(a)))))
    # (open at the front: the strap meets the bib corners)
    pts = [Vector((-0.085, V[0, 2, 1] + 0.004, z1))] + [p for p in neck if p.y > -0.05] + [Vector((0.085, V[0, nx - 2, 1] + 0.004, z1))]
    pts.sort(key=lambda p: math.atan2(p.x, -(p.y + 0.03)))
    straps = [tube('neck_strap', [p for p in pts], 0.0055, n=6)]
    waist = []
    zw = 0.5
    for k in range(25):
        a = k / 24 * math.tau
        d = Vector((math.cos(a), math.sin(a), 0))
        h = bvh.ray_cast(Vector((0, 0.01, zw)) + d * 0.6, -d)
        p = h[0] + d * 0.009 if h[0] is not None else Vector((0, 0, zw)) + d * 0.2
        waist.append(p)
    waist = [p for p in waist if p.y > -0.02]
    waist.sort(key=lambda p: math.atan2(p.x, p.y))
    straps.append(tube('waist_tie', waist, 0.006, n=6))
    # a bow at the back
    bc = Vector((0, max(p.y for p in waist) + 0.004, zw))
    for sx in (-1, 1):
        loop = [bc + Vector((sx * 0.04 * math.sin(t) ** 1, 0.004, 0.022 * math.sin(2 * t))) for t in np.linspace(0, math.pi, 10)]
        straps.append(tube('bow', loop, 0.0055, n=5))
        straps.append(tube('tie', [bc, bc + Vector((sx * 0.02, 0.01, -0.05)), bc + Vector((sx * 0.03, 0.012, -0.09))], 0.006, n=5))
    for s in straps:  # straps sample the cloth's edge texels (a hemmed band)
        me = s.data
        uv = me.uv_layers.new(name='UVMap')
        for li in range(len(me.loops)):
            uv.data[li].uv = (0.505, 0.5)
    # the pocket: a patch sewn on the skirt, split down the middle
    jz = [int(nz * (z1 - 0.435) / (z1 - z0)), int(nz * (z1 - 0.3) / (z1 - z0))]
    pv, pf = [], []
    i0, i1 = int(nx * 0.18), int(nx * 0.82)
    pidx = {}
    for j in range(jz[0], jz[1] + 1):
        for i in range(i0, i1 + 1):
            pidx[j, i] = len(pv)
            p = V[j, i].copy()
            p[1] -= 0.0085
            pv.append(p)
    for j in range(jz[0], jz[1]):
        for i in range(i0, i1):
            pf.append((pidx[j, i], pidx[j + 1, i], pidx[j + 1, i + 1], pidx[j, i + 1]))
    pocket = mesh_ob('pocket', pv, pf)
    me = pocket.data
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            jj = vi // (i1 - i0 + 1)
            ii = vi % (i1 - i0 + 1)
            uv.data[li].uv = (0.5 + ii / (i1 - i0) * 0.5, 0.5 + (1 - jj / (jz[1] - jz[0])) * 0.25)
    m = pocket.modifiers.new('sol', 'SOLIDIFY')
    m.thickness = 0.003
    m.offset = 1
    apply_mods(pocket)
    # things in the pocket: a folding rule on the left, a pencil stub and a notebook on the right
    pz = V[jz[0], (i0 + i1) // 2, 2]
    py = V[jz[0], (i0 + i1) // 2, 1]
    # two pencil stubs poking out of the pocket (sharpened, eraser ends up)
    stuff = [pencil('stub_a', Vector((0.075, py - 0.004, pz + 0.035)), Vector((-0.12, 0.0, -1.0)), length=0.065, r=0.0048),
             pencil('stub_b', Vector((-0.055, py - 0.004, pz + 0.028)), Vector((0.2, 0.0, -1.0)), length=0.055, r=0.0048)]
    return ap, straps, pocket, stuff


# ------------------------------------------------------------------ UVs
def unwrap(ob, margin=0.004, angle=66):
    activate(ob)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    try:
        bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, margin=margin, shape_method='CONCAVE')
    except TypeError:
        bpy.ops.uv.pack_islands(rotate=True, margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')


def set_attr(ob, name, val):
    a = ob.data.attributes.new(name, 'FLOAT', 'POINT')
    a.data.foreach_set('value', np.full(len(ob.data.vertices), val, np.float32))


def get_attr(ob, name):
    a = ob.data.attributes[name]
    out = np.zeros(len(ob.data.vertices), np.float32)
    a.data.foreach_get('value', out)
    return out


# ------------------------------------------------------------------ the coat
COAT = '#7d4b2a'      # chestnut
BACK = '#62391f'      # darker along the back and crown
MUZZLE = '#ab8664'    # pale, a little grey
NOSE = '#2c2322'
PAW = '#36271f'       # leathery hands and feet
CLAW = '#8a735a'      # horn
EAR = '#4b3229'
TAIL = '#3f3a37'      # slate-brown scales


def fur_flow(P, N):
    """The coat's flow (unit vectors in the surface): down and back over the body, from the nose back over the skull and
    down the cheeks, out along the limbs to the paws, down the haunches to the feet."""
    F = np.zeros_like(P)
    F[:, 2] = -1.0
    F[:, 1] = 0.3
    head = smoothstep(0.76, 0.8, P[:, 2])
    hf = np.stack([np.sign(P[:, 0]) * 0.45 * smoothstep(0.0, 0.05, np.abs(P[:, 0])), np.ones(len(P)), -0.45 + 0 * P[:, 0]], 1)
    # cheeks and jowls flow down and back
    hf[:, 2] -= 0.8 * smoothstep(0.9, 0.82, P[:, 2]) * smoothstep(0.03, 0.08, np.abs(P[:, 0]))
    F = F * (1 - head[:, None]) + hf * head[:, None]
    arm = smoothstep(0.17, 0.21, np.abs(P[:, 0])) * smoothstep(0.36, 0.42, P[:, 2]) * smoothstep(0.72, 0.66, P[:, 2])
    af = np.stack([np.sign(P[:, 0]) * 0.55, -0.55 + 0 * P[:, 0], -1.0 + 0 * P[:, 0]], 1)
    F = F * (1 - arm[:, None]) + af * arm[:, None]
    leg = smoothstep(0.28, 0.2, P[:, 2]) * smoothstep(0.05, 0.1, np.abs(P[:, 0]))
    lf = np.stack([np.sign(P[:, 0]) * 0.15, -0.8 + 0 * P[:, 0], -1.0 + 0 * P[:, 0]], 1)
    F = F * (1 - leg[:, None]) + lf * leg[:, None]
    F = F - (F * N).sum(1, keepdims=True) * N
    return F / np.maximum(1e-6, np.linalg.norm(F, axis=1, keepdims=True))


def paint_fur(fur, occluders):
    maps = pk.raster(fur, SIZE)
    m = maps['mask']
    log('fur raster', int(m.sum()), 'texels')
    P = maps['pos'][m].astype(np.float64)
    N = maps['nor'][m].astype(np.float64)
    ao = pk.texel_attr(maps, pk.vertex_ao(fur, occluders, rays=22, dist=0.09))[m]
    cav = pk.texel_attr(maps, pk.cavity(fur))[m]
    reg = pk.texel_attr(maps, get_attr(fur, 'reg'))[m]
    log('fur maps')
    n = len(P)
    jit = pk.fbm(P * 140, 2, seed=5) - 0.5  # breaks region borders into painted, ragged edges
    lo = pk.fbm(P * 9, 3, seed=2) - 0.5
    # regions (soft 0..1, then cut with the jitter)
    eyeL, eyeR = LM['eye_l'], LM['eye_r']
    nose = (ell(P, LM['nose'] + [0, 0.02, 0.002], (0.047, 0.036, 0.03)) < 1 + jit * 0.4) & (P[:, 1] < LM['nose'][1] + 0.05)
    muz = 1 - smoothstep(0.8, 1.05, ell(P, (0, LM['lip'][1] + 0.045, LM['lip'][2] + 0.012), (0.085, 0.07, 0.058)) + jit * 0.25)
    muz = np.maximum(muz, 1 - smoothstep(0.8, 1.05, ell(P, (0, LM['lip'][1] + 0.06, LM['lip'][2] - 0.02), (0.06, 0.06, 0.04)) + jit * 0.25))
    # paws: only past the wrist along the forearm (so the hands' paint never lands on the body beside them)
    paws = np.zeros(n)
    hand_t = {}
    for k, sx in (('l', 1), ('r', -1)):
        E = np.array((sx * 0.255, -0.075, 0.53))
        c = LM['palm_' + k]
        dvec = (c - E) / np.linalg.norm(c - E)
        t = (P - E) @ dvec
        lat = np.linalg.norm((P - E) - t[:, None] * dvec, axis=1)
        hand_t[k] = (t, lat, np.linalg.norm(c - E))
        on = smoothstep(0.112, 0.128, t + jit * 0.02) * (lat < 0.062)
        paws = np.maximum(paws, on)
    feet = 1 - smoothstep(0.045, 0.07, P[:, 2] + jit * 0.03)
    paws = np.maximum(paws, feet)
    ear = np.zeros(n, bool)
    for k in ('l', 'r'):
        ear |= ell(P, LM['ear_' + k] + [0, -0.012, 0], (0.03, 0.02, 0.03)) < 1 + jit * 0.3
    claw = np.zeros(n, bool)
    for tip in LM['tips']:
        claw |= np.linalg.norm(P - tip, axis=1) < 0.0085 + jit * 0.002
    for tip in LM['toes']:
        claw |= np.linalg.norm(P - tip, axis=1) < 0.011 + jit * 0.002
    tail = reg > 0.5
    scaly = tail & (P[:, 1] > 0.3 + jit * 0.03)

    # the coat: ramp index from the base, darker back and crown, mottling, occlusion and creases
    R_coat, R_back, R_muz = pk.ramp(COAT, 9), pk.ramp(BACK, 9), pk.ramp(MUZZLE, 9)
    F = fur_flow(P, N)
    cov, val, al = pk.strokes(P, F, N, cell=0.011, length=0.03, width=0.0026, seed=11)
    cov2, val2, al2 = pk.strokes(P, F, N, cell=0.0065, length=0.016, width=0.0017, seed=23, density=0.8)
    log('fur strokes')
    idx = 4.0 + lo * 2.2 - (1 - ao) * 5.0 - np.clip(cav * 900, 0, 1.6) + np.clip(-cav * 500, 0, 0.6)
    # strokes: dark partings, mid strands, lit tips; the fine pass paints over the coarse one
    st = np.where(val < 0.3, -1.6, np.where(val > 0.72, 1.2 + 0.6 * (al > 0.1), 0.35))
    st2 = np.where(val2 < 0.35, -1.1, np.where(val2 > 0.75, 1.3, 0.2))
    idx += np.where(cov2 > 0, st2, np.where(cov > 0, st, -0.45))
    backness = smoothstep(-0.02, 0.12, P[:, 1]) * (1 - smoothstep(0.82, 0.9, P[:, 2]) * 0) * (P[:, 2] > 0.1)
    crown = smoothstep(0.93, 1.0, P[:, 2])
    dark = np.clip(backness * 0.8 + crown * 0.7, 0, 1)
    eye_ring = np.minimum(np.linalg.norm(P - eyeL, axis=1), np.linalg.norm(P - eyeR, axis=1))
    idx -= 1.6 * (1 - smoothstep(0.016, 0.026, eye_ring))
    col = pk.pick(R_coat, idx)
    use_back = dark > 0.5 + jit
    col[use_back] = pk.pick(R_back, idx[use_back] + 0.4)
    um = muz > 0.5
    col[um] = pk.pick(R_muz, np.clip(idx[um], 2.2, 7) + 0.3)
    # the mouth: a dark line under the split lip, curving out to the corners
    lip = LM['lip']
    mx = np.abs(P[:, 0])
    mouth_z = lip[2] - 0.003 - (mx / 0.05) ** 2 * 0.018
    mouth = (np.abs(P[:, 2] - mouth_z) < 0.0028) & (mx < 0.045) & (P[:, 1] < lip[1] + 0.04)
    cleft = (mx < 0.0022) & (P[:, 2] > lip[2] - 0.004) & (P[:, 2] < LM['nose'][2] - 0.018) & (P[:, 1] < lip[1] + 0.02)
    col[mouth | cleft] = pk.hexrgb('#2a1b17')
    # the nose pad: leathery, a soft highlight on top, dark nostrils
    R_nose = pk.ramp(NOSE, 7, light=0.35)
    nidx = 3 + (N[:, 2] > 0.55) * 1.2 + (pk.fbm(P * 400, 2, 7) - 0.5) * 1.5 - (1 - ao) * 3
    col[nose] = pk.pick(R_nose, nidx[nose])
    for sx in (-1, 1):
        nost = ell(P, LM['nose'] + [sx * 0.018, 0.004, -0.012], (0.009, 0.007, 0.006)) < 1
        col[nost & nose] = pk.hexrgb('#120d0c')
    # paws: leathery skin with creases, pale claws
    R_paw = pk.ramp(PAW, 7, light=0.24)
    pidx = 3 + (pk.fbm(P * 260, 3, 9) - 0.5) * 2.4 - (1 - ao) * 4 - np.clip(cav * 1200, 0, 1.5)
    pm = paws > 0.5 + jit * 0.6
    col[pm] = pk.pick(R_paw, pidx[pm])
    R_claw = pk.ramp(CLAW, 5, light=0.3)
    cm = claw & pm
    col[cm] = pk.pick(R_claw, 2 + (P[cm, 2] > np.median(P[cm, 2]) if cm.any() else 0))
    # inner ears
    R_ear = pk.ramp(EAR, 7)
    em = ear & (N[:, 1] < -0.1)
    col[em] = pk.pick(R_ear, 3 - (1 - ao[em]) * 4)
    # the tail: rows of rounded scales (a hex grid on the paddle), grooves dark, a soft sheen on the plates
    R_tail = pk.ramp(TAIL, 9, light=0.45)
    if scaly.any():
        q = P[scaly]
        sz = 0.0105
        u, v = q[:, 0] / sz, (q[:, 1] - 0.255) / (sz * 0.87)
        row = np.floor(v)
        u2 = u - 0.5 * (row % 2)
        cu, cv = np.floor(u2) + 0.5, row + 0.5
        du, dv = (u2 - cu) * 2, (v - cv) * 2
        edge = np.maximum(np.abs(du) * 0.9 + np.abs(dv) * 0.35, np.abs(dv))
        cid = (cu * 7919 + cv * 104729).astype(np.int64)
        rnd = pk._hash3(cid, cid * 3 + 1, cid * 7 + 2, 4)
        tid = 4.6 + (rnd - 0.5) * 1.6 - (edge > 0.78) * 2.6 - (edge > 0.9) * 1.0 + (1 - edge) * 0.9 - (1 - ao[scaly]) * 3
        col[scaly] = pk.pick(R_tail, tid)
    # clean lone texels into clusters (on the ramp index of the coat)
    rgb = np.zeros((SIZE, SIZE, 3), np.float32)
    rgb[m] = col
    path = os.path.join(BUILD, 'beaver_fur.png')
    pk.save(rgb, m, path)
    log('fur painted', path)
    return path


# ------------------------------------------------------------------ the kit atlas (apron, straps, pocket, props)
KIT = 512
SW = {}  # swatch name -> uv centre


def paint_kit():
    n = KIT
    img = np.zeros((n, n, 3), np.float32)
    yy, xx = np.mgrid[0:n, 0:n]
    # cloth (left half): a moss-green canvas with a fine weave, a cream stitched hem, stains and sawdust
    canvas = pk.ramp('#5f7d46', 9, light=0.45)
    P3 = np.stack([xx * 0.05, yy * 0.05, np.zeros_like(xx, dtype=float)], -1)
    weave = ((xx + yy) % 2) * 0.6 + ((xx // 2 + yy) % 3 == 0) * -0.5
    mottle = (pk.fbm(P3 * 0.6, 3, 1) - 0.5) * 2.4
    stain = (pk.fbm(P3 * 0.25 + 3, 3, 4) > 0.7) * -0.8
    idx = 4 + weave + mottle + stain
    cloth = (xx < n // 2)
    u = xx / (n / 2)            # 0..1 across the apron
    v = 1 - yy / n             # 0 bottom .. 1 top? (row 0 is v = 0 in our save)
    v = yy / n
    hem = (np.minimum(u, 1 - u) * (n / 2) < 5) | (v < 0.012) | (v > 0.988)
    idx = np.where(cloth & hem, idx - 1.2, idx)
    out = pk.pick(canvas, idx)
    stitch = cloth & (((np.minimum(u, 1 - u) * (n / 2)).round() == 7) | ((v * n).round() == 8) | (((1 - v) * n).round() == 9)) & ((xx + yy) % 6 < 3)
    out[stitch] = pk.hexrgb('#e9dcb8')
    dust = cloth & (pk.fbm(P3 * 2.2, 2, 8) > 0.8) & (v < 0.3) & ((xx * 3 + yy * 5) % 7 < 2)
    out[dust] = pk.hexrgb('#d9c29a')
    img[cloth] = out[cloth]
    # pocket (right half, rows 0.5..0.75): the same canvas, darker, stitched round and down the middle, rivets
    pk_ = (xx >= n // 2) & (yy >= n // 2) & (yy < n * 3 // 4)
    pu = (xx - n // 2) / (n / 2)
    pv = (yy - n // 2) / (n / 4)
    pidx = idx - 0.8
    pout = pk.pick(canvas, pidx)
    pst = pk_ & (((np.minimum(pu, 1 - pu) * (n / 2)).round() == 4) | ((np.minimum(pv, 1 - pv) * (n / 4)).round() == 4) | (np.abs(pu - 0.5) * (n / 2) < 0.6)) & ((xx + yy) % 6 < 3)
    pout[pst] = pk.hexrgb('#e9dcb8')
    for cu in (0.04, 0.96, 0.5):
        r = np.hypot((pu - cu) * (n / 2), (pv - 0.9) * (n / 4))
        pout[pk_ & (r < 3.2)] = pk.hexrgb('#c8a764')
        pout[pk_ & (r < 1.6)] = pk.hexrgb('#f1d39a')
    img[pk_] = pout[pk_]
    # swatches (right half, rows 0..0.25 and 0.75..1): flat-ish props colours with a little ramp texture
    names = ['yellow', 'eraser', 'brass', 'cedar', 'lead', 'tooth', 'wire', 'rule', 'book', 'paper', 'strap', 'tooth2']
    cols = {'yellow': '#e0a83a', 'eraser': '#d98679', 'brass': '#c9a35a', 'cedar': '#d8a878', 'lead': '#35353b', 'tooth': '#e5862e',
            'tooth2': '#f0a24a', 'wire': '#b98e45', 'rule': '#e4c35c', 'book': '#7a3f35', 'paper': '#efe5cf', 'strap': '#55703f'}
    cs = 32
    for k, nm in enumerate(names):
        cx0 = n // 2 + (k % 8) * cs
        cy0 = (k // 8) * cs
        R = pk.ramp(cols[nm], 7, light=0.4)
        for y in range(cs):
            for x in range(cs):
                t = 3 + (y / cs - 0.5) * 1.6 + ((x * 7 + y * 3) % 5 == 0) * 0.6
                img[cy0 + y, cx0 + x] = R[int(np.clip(round(t), 0, 6))]
        SW[nm] = ((cx0 + cs / 2) / n, (cy0 + cs / 2) / n, cs / n)
    path = os.path.join(BUILD, 'beaver_kit.png')
    craft.paint_strips(img, pk)  # wood grain, steel, glasspaper, cork and brass for the tools
    pk.save(img, np.ones((n, n), bool), path, px=0)
    return path


def swatch(ob, nm, grad=None):
    """Point every face of `ob` at a swatch (grad: an axis to spread along the swatch, for a little shading)."""
    me = ob.data
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active
    cu, cv, w = SW[nm]
    co = verts(ob)
    lo_, hi_ = (co[:, grad].min(), co[:, grad].max()) if grad is not None else (0, 1)
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            t = (co[vi, grad] - lo_) / max(1e-6, hi_ - lo_) if grad is not None else 0.5
            uv.data[li].uv = (cu, cv + (t - 0.5) * w * 0.8)


def kit_uvs(P_, straps, stuff):
    for s in straps:
        swatch(s, 'strap')
    for o in stuff:
        me = o.data
        if not me.uv_layers:
            me.uv_layers.new(name='UVMap')
        uv = me.uv_layers.active
        cols = o['cols']
        for pi, poly in enumerate(me.polygons):
            cu, cv, w = SW[cols[pi] if pi < len(cols) else 'yellow']
            for k, li in enumerate(poly.loop_indices):
                uv.data[li].uv = (cu + (k % 2 - 0.5) * w * 0.5, cv + ((pi % 6) / 6 - 0.5) * w * 0.7)
    swatch(P_['teeth_u'], 'tooth', 2)
    swatch(P_['teeth_d'], 'tooth2', 2)
    swatch(P_['specs'], 'wire')
    for nm in ('pencil_ear', 'pencil_hand'):
        ob = P_[nm]
        me = ob.data
        if not me.uv_layers:
            me.uv_layers.new(name='UVMap')
        uv = me.uv_layers.active
        cols = ob['cols']
        for pi, poly in enumerate(me.polygons):
            cu, cv, w = SW[cols[pi] if pi < len(cols) else 'yellow']
            for k, li in enumerate(poly.loop_indices):
                uv.data[li].uv = (cu + (k % 2 - 0.5) * w * 0.5, cv + ((pi % 6) / 6 - 0.5) * w * 0.7)


# ------------------------------------------------------------------ the rig
BONES = {}


def build_rig():
    arm = bpy.data.armatures.new('rig')
    ob = link(bpy.data.objects.new('rig', arm))
    activate(ob)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones

    def B(name, h, t, parent=None, deform=True):
        b = eb.new(name)
        b.head, b.tail = Vector(h), Vector(t)
        b.roll = 0
        if parent:
            b.parent = eb[parent]
        b.use_deform = deform
        BONES[name] = (Vector(h), Vector(t))
        return b

    B('root', (0, 0, 0), (0, 0, 0.08), deform=False)
    B('hips', (0, 0.02, 0.24), (0, 0.0, 0.42), 'root')
    B('spine', (0, 0.0, 0.42), (0, -0.01, 0.6), 'hips')
    B('chest', (0, -0.01, 0.6), (0, -0.02, 0.74), 'spine')
    B('neck', (0, -0.02, 0.74), (0, -0.03, 0.81), 'chest')
    B('head', (0, -0.03, 0.81), (0, -0.04, 1.0), 'neck')
    B('jaw', (0, LM['lip'][1] + 0.1, LM['lip'][2] + 0.01), (0, LM['lip'][1] + 0.01, LM['lip'][2] - 0.025), 'head')
    for sx, k in ((1, 'l'), (-1, 'r')):
        e = LM['ear_' + k]
        B('ear_' + k, e - [sx * 0.012, -0.004, 0.02], e + [sx * 0.012, 0, 0.03], 'head')
        c = LM['eye_' + k]
        B('eye_' + k, c - LM['eyen_' + k] * 0.0075, c + LM['eyen_' + k] * 0.02, 'head')
        B('upper_arm_' + k, (sx * 0.15, -0.03, 0.665), (sx * 0.255, -0.075, 0.53), 'chest')
        B('forearm_' + k, (sx * 0.255, -0.075, 0.53), (sx * 0.295, -0.15, 0.44), 'upper_arm_' + k)
        B('hand_' + k, (sx * 0.295, -0.15, 0.44), (sx * 0.312, -0.215, 0.39), 'forearm_' + k)
        B('thigh_' + k, (sx * 0.13, 0.0, 0.25), (sx * 0.148, -0.06, 0.085), 'hips')
        B('foot_' + k, (sx * 0.148, -0.06, 0.085), (sx * 0.152, -0.27, 0.02), 'thigh_' + k)
    B('tail1', (0, 0.15, 0.17), (0, 0.26, 0.085), 'hips')
    B('tail2', (0, 0.26, 0.085), (0, 0.37, 0.055), 'tail1')
    B('tail3', (0, 0.37, 0.055), (0, 0.5, 0.04), 'tail2')
    B('tail4', (0, 0.5, 0.04), (0, 0.66, 0.035), 'tail3')
    pe = PENCIL['ear']
    B('pencil_ear', pe[0], pe[0] + pe[1] * 0.1, 'head')
    ph = PENCIL['hand']
    B('pencil_hand', ph[0], ph[0] + ph[1] * 0.1, 'hand_r')
    craft.add_bones(B)
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in ob.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return ob


PENCIL = {}


def weights_matrix(ob, names):
    W = np.zeros((len(ob.data.vertices), len(names)), np.float32)
    gi = {g.index: names.index(g.name) for g in ob.vertex_groups if g.name in names}
    for v in ob.data.vertices:
        for g in v.groups:
            if g.group in gi:
                W[v.index, gi[g.group]] = g.weight
    return W


def write_weights(ob, names, W, limit=4):
    ob.vertex_groups.clear()
    groups = [ob.vertex_groups.new(name=nm) for nm in names]
    # keep the strongest `limit` influences, normalised
    order = np.argsort(-W, axis=1)[:, :limit]
    for vi in range(len(W)):
        ws = W[vi, order[vi]]
        s = ws.sum()
        if s <= 1e-6:
            continue
        for k, bi in enumerate(order[vi]):
            if ws[k] > 0.002:
                groups[bi].add([vi], float(ws[k] / s), 'REPLACE')


def skin_fur(fur, rig, names):
    """Bone-heat weights for the coat, then the jaw, ears and the tail's scaly paddle by hand."""
    rest = {}
    for b in rig.data.bones:
        rest[b.name] = b.use_deform
        if b.name in ('root', 'jaw', 'ear_l', 'ear_r', 'eye_l', 'eye_r', 'pencil_ear', 'pencil_hand', 'tail2', 'tail3', 'tail4'):
            b.use_deform = False
    activate(fur)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    try:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    except Exception as e:  # noqa: BLE001
        log('bone heat failed', e)
    for b in rig.data.bones:
        b.use_deform = rest[b.name]
    W = weights_matrix(fur, names)
    V = verts(fur)
    if W.sum(1).min() <= 1e-6:
        log('unweighted verts', int((W.sum(1) <= 1e-6).sum()), '-> nearest bone')
        bad = W.sum(1) <= 1e-6
        segs = [(names.index(nm), np.array(BONES[nm][0]), np.array(BONES[nm][1])) for nm in names if nm in ('hips', 'spine', 'chest', 'neck', 'head', 'upper_arm_l', 'upper_arm_r', 'forearm_l', 'forearm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'foot_l', 'foot_r', 'tail1')]
        D = np.stack([seg_dist(V[bad], a, b) for _, a, b in segs], 1)
        W[np.where(bad)[0], np.array([segs[i][0] for i in D.argmin(1)])] = 1
    W /= np.maximum(1e-6, W.sum(1, keepdims=True))
    ji, hi = names.index('jaw'), names.index('head')
    lip = LM['lip']
    jw = (1 - smoothstep(0.75, 1.0, ell(V, (0, lip[1] + 0.04, lip[2] - 0.028), (0.06, 0.07, 0.03)))) * smoothstep(lip[2] - 0.002, lip[2] - 0.012, V[:, 2])
    W[:, ji] = jw
    W[:, hi] *= (1 - jw)
    for k in ('l', 'r'):
        ei = names.index('ear_' + k)
        ew = 1 - smoothstep(0.7, 1.0, ell(V, LM['ear_' + k] + [0, 0, 0.004], (0.038, 0.026, 0.036)))
        W[:, :] *= (1 - ew[:, None])
        W[:, ei] += ew
    reg = get_attr(fur, 'reg')
    tl = reg > 0.5
    if tl.any():
        y = V[tl, 1]
        knots = [0.15, 0.26, 0.37, 0.5, 0.66]
        tb = [names.index(nm) for nm in ('tail1', 'tail2', 'tail3', 'tail4')]
        Wt = np.zeros((tl.sum(), len(names)), np.float32)
        mids = [(knots[i] + knots[i + 1]) / 2 for i in range(4)]
        for i in range(4):
            lo_ = mids[i - 1] if i else -1
            hi_ = mids[i + 1] if i < 3 else 9
            w = np.where(y < mids[i], smoothstep(lo_, mids[i], y), 1 - smoothstep(mids[i], hi_, y)) if 0 < i < 3 else None
            if i == 0:
                w = 1 - smoothstep(mids[0], mids[1], y)
            elif i == 3:
                w = smoothstep(mids[2], mids[3], y)
            Wt[:, tb[i]] = w
        W[tl] = Wt
    W /= np.maximum(1e-6, W.sum(1, keepdims=True))
    write_weights(fur, names, W)
    return W


def seg_dist(P, a, b):
    ab = b - a
    t = np.clip(((P - a) @ ab) / max(1e-9, ab @ ab), 0, 1)
    return np.linalg.norm(P - (a + t[:, None] * ab), axis=1)


def transfer_weights(src, Wsrc, dst, names):
    """Each vertex of `dst` takes the weights of the nearest point on `src` (barycentric over its triangle)."""
    bvh = BVHTree.FromObject(src, bpy.context.evaluated_depsgraph_get())
    me = src.data
    tris = np.array([list(p.vertices) for p in me.polygons])
    co = verts(src)
    W = np.zeros((len(dst.data.vertices), len(names)), np.float32)
    for i, v in enumerate(dst.data.vertices):
        loc, nor, fi, d = bvh.find_nearest(v.co)
        if fi is None:
            continue
        a, b, c = co[tris[fi]]
        p = np.array(loc)
        v0, v1, v2 = b - a, c - a, p - a
        d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
        den = d00 * d11 - d01 * d01
        if abs(den) < 1e-14:
            bw = np.array([1 / 3, 1 / 3, 1 / 3])
        else:
            vv = (d11 * d20 - d01 * d21) / den
            ww = (d00 * d21 - d01 * d20) / den
            bw = np.clip(np.array([1 - vv - ww, vv, ww]), 0, 1)
            bw /= bw.sum()
        W[i] = bw @ Wsrc[tris[fi]]
    return W


def rigid(ob, names, bone):
    W = np.zeros((len(ob.data.vertices), len(names)), np.float32)
    W[:, names.index(bone)] = 1
    return W


def bind(ob, rig):
    ob.parent = rig
    m = ob.modifiers.new('rig', 'ARMATURE')
    m.object = rig


# ------------------------------------------------------------------ animation
class Anim:
    """Keys bone rotations about armature-space axes through each bone's head (child keys are relative to the parent,
    as on a real puppet), moves in armature space, all bones keyed on every keyed frame so clips never leak."""

    def __init__(s, rig):
        s.rig = rig
        s.actions = []

    def begin(s, name, length):
        s.rig.animation_data_create()
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        s.rig.animation_data.action = act
        s.act, s.len, s.poses = act, length, {}

    def pose(s, frame, **bones):
        """bones: name=dict(rot=[(axis, deg)...] | (axis, deg), move=(x,y,z), scale=k)."""
        s.poses.setdefault(frame, {}).update(bones)

    def end(s, loop=True):
        frames = sorted(s.poses)
        if loop and s.len not in s.poses:
            s.poses[s.len] = dict(s.poses[frames[0]])
            frames.append(s.len)
        for f in frames:
            full = f in (frames[0], frames[-1])
            for pb in s.rig.pose.bones:
                if pb.name in s.poses[f]:
                    s._key(pb, f, s.poses[f][pb.name])
                elif full:
                    s._key(pb, f, {})
        s.actions.append(s.act.name)
        s.rig.animation_data.action = None
        for pb in s.rig.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)

    def _key(s, pb, f, spec):
        R = pb.bone.matrix_local.to_3x3()
        q = Quaternion()
        rot = spec.get('rot')
        if rot:
            rots = [rot] if isinstance(rot[0], str) else rot
            for ax, deg in rots:
                a = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}[ax]
                q = Quaternion(a, math.radians(deg)) @ q
        if spec.get('quat') is not None:
            q = spec['quat'] @ q
        ql = R.inverted().to_quaternion() @ q @ R.to_quaternion()
        pb.rotation_quaternion = ql
        mv = spec.get('move')
        pb.location = (R.inverted() @ Vector(mv)) if mv else Vector((0, 0, 0))
        sc = spec.get('scale', 1.0)
        pb.scale = (sc, sc, sc) if isinstance(sc, (int, float)) else sc
        for path in ('rotation_quaternion', 'location', 'scale'):
            pb.keyframe_insert(path, frame=f)


def aim(rest_dir, want):
    """The rotation turning `rest_dir` to `want` (armature space)."""
    return Vector(rest_dir).normalized().rotation_difference(Vector(want).normalized())


def arm_ik(k, target, pole=(0, -1, -0.4), parent_q=Quaternion()):
    """Two-bone IK for an arm (chest frame, rest coordinates): rotations (armature space, relative to the parent) for
    upper_arm_k and forearm_k that put the wrist on `target`, the elbow bending toward `pole`."""
    S, E0 = Vector(BONES['upper_arm_' + k][0]), Vector(BONES['upper_arm_' + k][1])
    W0 = Vector(BONES['forearm_' + k][1])
    a, b = (E0 - S).length, (W0 - E0).length
    T = Vector(target)
    d = T - S
    L = min(d.length, a + b - 1e-4)
    d = d.normalized()
    cos_a = (a * a + L * L - b * b) / (2 * a * L)
    ang = math.acos(max(-1, min(1, cos_a)))
    pl = Vector(pole)
    side = (pl - d * pl.dot(d)).normalized()
    E = S + (d * math.cos(ang) + side * math.sin(ang)) * a
    Wp = S + d * L
    q_up = aim(E0 - S, E - S)
    q_fore_total = aim(W0 - E0, Wp - E)
    q_fore = q_up.inverted() @ q_fore_total
    return q_up, q_fore


def animate(rig):
    A = Anim(rig)
    # the stance: he stands at his workbench, both paws resting on the plank in front of him (palm down, fingers
    # forward), solved once by IK [shop11]
    rest = {}
    for sx, k in ((1, 'l'), (-1, 'r')):
        wr = Vector(BONES['hand_' + k][0])
        d_rest = (Vector(BONES['hand_' + k][1]) - wr).normalized()
        Rh = d_rest.rotation_difference(Vector((sx * 0.15, -1, 0)).normalized())
        at = Vector((sx * craft.REST_X, craft.BOARD['near'] - craft.REST_IN, craft.BOARD['top']))
        W = at + Vector((0, 0, 0.046)) - Rh @ (Vector(LM['palm_' + k]) - wr)
        q_up, q_fore = arm_ik(k, tuple(W), pole=(sx * 1.0, 0.5, 0.0))
        rest[k] = (q_up, q_fore, (q_up @ q_fore).inverted() @ Rh)

    def stance(extra=None, breath=0.0, sway=0.0, tail=0.0, head=None):
        p = {
            'spine': {'rot': ('X', -1.0 * breath)}, 'chest': {'rot': ('X', -1.6 * breath), 'move': (0, 0, 0.003 * breath)},
            'neck': {'rot': ('X', 1.0 * breath)},
            'upper_arm_l': {'quat': rest['l'][0]}, 'upper_arm_r': {'quat': rest['r'][0]},
            'forearm_l': {'quat': rest['l'][1]}, 'forearm_r': {'quat': rest['r'][1]},
            'hand_l': {'quat': rest['l'][2]}, 'hand_r': {'quat': rest['r'][2]},
            'tail1': {'rot': [('Z', 5 * tail), ('X', 2 * sway)]}, 'tail2': {'rot': ('Z', 7 * tail)}, 'tail3': {'rot': ('Z', 8 * tail)}, 'tail4': {'rot': ('Z', 9 * tail)},
            'hips': {'rot': ('Y', 1.6 * sway)}, 'root': {'move': (0.006 * sway, 0, 0)},
            'pencil_hand': {'scale': 0.001},
            **{'tool_' + t: {'scale': 0.001} for t in craft.TOOLS},
        }
        if head:
            p['head'] = head
        for kk, vv in (extra or {}).items():
            p[kk] = vv
        return p

    # idle: breathing, a slow look about, the tail swaying, an ear flick
    A.begin('idle', 96)
    for f, br, tl, hd in ((0, 0, 0, ('Z', 0)), (24, 1, 1, ('Z', 4)), (48, 0, 0, ('Z', 0)), (72, 1, -1, ('Z', -4))):
        A.pose(f, **stance(breath=br, tail=tl, sway=tl, head={'rot': [hd, ('Y', 3 * tl)]}))
    A.pose(60, ear_l={'rot': ('Y', -18)})
    A.pose(63, ear_l={'rot': ('Y', 0)})
    A.end()

    # talk: the jaw chatters, the head bobs, the right paw gestures
    A.begin('talk', 48)
    for f, jw, hd, g in ((0, 0, 0, 0), (6, 13, 3, 1), (11, 3, 0, 1), (17, 10, -2, 0.5), (23, 1, 1, 0), (29, 14, 4, 1), (35, 4, -1, 1), (41, 9, 1, 0.4)):
        q_up, q_f = arm_ik('r', (-0.25 - 0.03 * g, -0.2 - 0.06 * g, 0.6 + 0.06 * g), pole=(-0.6, 0.4, -0.6))  # [shop11] up over the workbench
        A.pose(f, **stance(breath=0.5, tail=0.3 * math.sin(f), extra={
            'jaw': {'rot': ('X', jw)}, 'head': {'rot': [('X', hd), ('Z', -3 + g * 2)]},
            'upper_arm_r': {'quat': q_up}, 'forearm_r': {'quat': q_f}, 'hand_r': {'rot': [('X', -40 * g), ('Y', -20 * g)]}}))
    A.end()

    # wave: up goes the right paw, waggling at the wrist
    A.begin('wave', 48)
    A.pose(0, **stance())
    for f, w in ((8, 0), (14, 1), (20, -1), (26, 1), (32, -1), (38, 0.5)):
        q_up, q_f = arm_ik('r', (-0.3, -0.12, 0.88), pole=(-1, 0.3, -0.5))
        A.pose(f, **stance(breath=0.5, extra={
            'upper_arm_r': {'quat': q_up}, 'forearm_r': {'quat': Quaternion(Vector((0, 1, 0)), math.radians(22 * w)) @ q_f},
            'hand_r': {'rot': [('Y', 18 * w), ('X', 10)]}, 'head': {'rot': [('Y', -6), ('Z', -6)]}, 'jaw': {'rot': ('X', 6 if f in (14, 26) else 0)},
            'chest': {'rot': ('Y', -3)}, 'tail1': {'rot': ('Z', 6 * w)}, 'tail2': {'rot': ('Z', 8 * w)}}))
    A.pose(48, **stance())
    A.end()

    # present: a sweep of the right paw out to the display, palm up, a little bow and a nod toward it
    A.begin('present', 48)
    A.pose(0, **stance())
    # [shop11] the paw rises close to the body first, then sweeps out over the workbench (never through it)
    q_up0, q_f0 = arm_ik('r', (-0.3, -0.16, 0.62), pole=(-0.6, 0.5, -0.6))
    A.pose(6, **stance(breath=0.3, extra={'upper_arm_r': {'quat': q_up0}, 'forearm_r': {'quat': q_f0}, 'hand_r': {'rot': [('Y', -40), ('X', -10)]}}))
    A.pose(42, **stance(breath=0.3, extra={'upper_arm_r': {'quat': q_up0}, 'forearm_r': {'quat': q_f0}, 'hand_r': {'rot': [('Y', -40), ('X', -10)]}}))
    q_up, q_f = arm_ik('r', (-0.42, -0.27, 0.68), pole=(-0.3, 0.6, -0.8))
    for f in (14, 34):
        A.pose(f, **stance(breath=0.6, extra={
            'upper_arm_r': {'quat': q_up}, 'forearm_r': {'quat': q_f}, 'hand_r': {'rot': [('Y', -70), ('X', -20)]},
            'spine': {'rot': [('Z', -8), ('X', -4)]}, 'chest': {'rot': [('Z', -6), ('Y', 4)]}, 'head': {'rot': [('Z', -18), ('X', 8), ('Y', 6)]},
            'jaw': {'rot': ('X', 8 if f == 14 else 2)}}))
    A.pose(48, **stance())
    A.end(loop=False)

    # hop: a crouch, a happy jump with paws up and the tail flipping, a squashy landing
    A.begin('hop', 36)
    A.pose(0, **stance())
    A.pose(6, **stance(extra={'root': {'move': (0, 0, -0.035)}, 'thigh_l': {'rot': ('X', -18)}, 'thigh_r': {'rot': ('X', -18)}, 'foot_l': {'rot': ('X', 18)}, 'foot_r': {'rot': ('X', 18)},
                              'spine': {'rot': ('X', -8)}, 'head': {'rot': ('X', 8)}, 'tail1': {'rot': ('X', -8)}}))
    up_l = arm_ik('l', (0.3, -0.16, 0.78), pole=(1, 0.3, -0.5))
    up_r = arm_ik('r', (-0.3, -0.16, 0.78), pole=(-1, 0.3, -0.5))
    A.pose(13, **stance(extra={'root': {'move': (0, 0, 0.17)}, 'thigh_l': {'rot': ('X', 10)}, 'thigh_r': {'rot': ('X', 10)}, 'foot_l': {'rot': ('X', 20)}, 'foot_r': {'rot': ('X', 20)},
                               'upper_arm_l': {'quat': up_l[0]}, 'forearm_l': {'quat': up_l[1]}, 'upper_arm_r': {'quat': up_r[0]}, 'forearm_r': {'quat': up_r[1]},
                               'tail1': {'rot': ('X', 25)}, 'tail2': {'rot': ('X', 15)}, 'tail3': {'rot': ('X', 10)}, 'jaw': {'rot': ('X', 14)}, 'head': {'rot': ('X', -10)},
                               'ear_l': {'rot': ('Y', -15)}, 'ear_r': {'rot': ('Y', 15)}}))
    A.pose(20, **stance(extra={'root': {'move': (0, 0, 0.06)}, 'upper_arm_l': {'quat': up_l[0]}, 'forearm_l': {'quat': up_l[1]}, 'upper_arm_r': {'quat': up_r[0]}, 'forearm_r': {'quat': up_r[1]},
                               'tail1': {'rot': ('X', 12)}, 'jaw': {'rot': ('X', 10)}}))
    A.pose(25, **stance(extra={'root': {'move': (0, 0, -0.03)}, 'thigh_l': {'rot': ('X', -14)}, 'thigh_r': {'rot': ('X', -14)}, 'foot_l': {'rot': ('X', 14)}, 'foot_r': {'rot': ('X', 14)},
                               'spine': {'rot': ('X', -5)}, 'tail1': {'rot': ('X', -10)}, 'tail2': {'rot': ('X', -6)}}))
    A.pose(36, **stance())
    A.end(loop=False)

    # think: a paw up to scratch the side of the head, the head tipped, a thoughtful "hmm"
    A.begin('think', 72)
    A.pose(0, **stance())
    tgt = np.array(LM['ear_r']) + [-0.03, -0.05, -0.06]
    for f, sc in ((14, 0), (20, 1), (26, 0), (32, 1), (38, 0), (44, 1), (50, 0), (58, 0)):
        q_up, q_f = arm_ik('r', tuple(tgt + [0, 0, 0.012 * sc]), pole=(-1, 0.6, -0.4))
        A.pose(f, **stance(breath=0.4, extra={
            'upper_arm_r': {'quat': q_up}, 'forearm_r': {'quat': q_f}, 'hand_r': {'rot': [('X', -60 + 14 * sc), ('Y', 30)]},
            'head': {'rot': [('Y', 10), ('Z', 6), ('X', -4)]}, 'neck': {'rot': ('Y', 4)}, 'jaw': {'rot': ('X', 3)},
            'ear_r': {'rot': ('Y', 12 * sc)}}))
    A.pose(72, **stance())
    A.end(loop=False)

    # gnaw: he takes the pencil from behind his ear and nibbles the end (shavings!), then tucks it back
    A.begin('gnaw', 84)
    A.pose(0, **stance())
    pe = PENCIL['ear'][0]
    reach = arm_ik('r', tuple(np.array(pe) + [-0.01, -0.03, -0.05]), pole=(-1, 0.4, -0.3))
    mouth = arm_ik('r', (-0.06, LM['lip'][1] - 0.05, LM['lip'][2] - 0.07), pole=(-1, 0.2, -0.6))
    hold = {'upper_arm_r': {'quat': reach[0]}, 'forearm_r': {'quat': reach[1]}, 'hand_r': {'rot': [('X', -70), ('Y', 40)]}}
    A.pose(12, **stance(extra={**hold, 'head': {'rot': ('Y', 8)}}))
    A.pose(13, **stance(extra={**hold, 'head': {'rot': ('Y', 8)}, 'pencil_ear': {'scale': 0.001}, 'pencil_hand': {'scale': 1.0}}))
    held = {'pencil_ear': {'scale': 0.001}, 'pencil_hand': {'scale': 1.0}}
    for f, jw in ((24, 4), (27, 12), (30, 2), (33, 13), (36, 2), (39, 12), (42, 3), (45, 13), (48, 2), (51, 12), (54, 2), (57, 11), (60, 2)):
        A.pose(f, **stance(extra={**held, 'upper_arm_r': {'quat': mouth[0]}, 'forearm_r': {'quat': mouth[1]}, 'hand_r': {'rot': [('Z', -80), ('X', -30)]},
                                  'jaw': {'rot': ('X', jw)}, 'head': {'rot': [('X', 6 + (jw > 5) * 2), ('Z', -4)]}, 'ear_l': {'rot': ('Y', -6)}, 'ear_r': {'rot': ('Y', 6)}}))
    A.pose(70, **stance(extra={**held, **hold, 'head': {'rot': ('Y', 8)}}))
    A.pose(71, **stance(extra={**hold, 'head': {'rot': ('Y', 8)}}))
    A.pose(84, **stance())
    A.end(loop=False)
    # the craft at the workbench: measure, saw, plane, chisel, sand, blow, proud (art/shop/craft.py)
    CRAFT['worst'] = craft.build_clips(A, stance, rig, globals(), LM, PENCIL, CRAFT['info'])
    return A


# ------------------------------------------------------------------ export
def export(objs, rig, path):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs + [rig]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=False,
                              export_yup=True, export_texcoords=True, export_normals=True, export_tangents=False,
                              export_materials='EXPORT', export_image_format='AUTO', export_animations=True,
                              export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_step=2,
                              export_anim_slide_to_zero=True, export_reset_pose_bones=True, export_def_bones=False,
                              export_leaf_bone=False, export_skins=True, export_morph=False, export_lights=False,
                              export_cameras=False, export_extras=False, export_optimize_animation_size=True,
                              export_rest_position_armature=True, export_all_influences=False)
    log('exported', path, os.path.getsize(path) // 1024, 'KB')


def main():
    reset()
    body = build_body()
    landmarks(body)
    if '--probe' in FLAGS:
        return
    sculpt_body(body)
    decimate(body, 14000)
    tail = build_tail()
    set_attr(body, 'reg', 0.0)
    set_attr(tail, 'reg', 1.0)
    # behind his right ear, eraser forward (he takes it by that end), the sharpened end tucked back over the ear
    PENCIL['ear'] = (np.array((-0.13, -0.035, 0.961)), np.array(Vector((0.16, 1.0, 0.22)).normalized()))
    PENCIL['hand'] = (np.array((-0.3, -0.165, 0.425)), np.array(Vector((0.25, -1.0, 0.3)).normalized()))
    P_ = props()
    ap, straps, pocket, stuff = build_apron(body, tail)
    fur = join([body, tail], 'fur')
    bpy.ops.object.shade_smooth() if False else None
    for p in fur.data.polygons:
        p.use_smooth = True
    unwrap(fur)
    log('fur', len(fur.data.polygons), 'tris')
    kit_path = paint_kit()
    kit_uvs(P_, straps, stuff)
    occl = [ap, pocket] + straps
    fur_path = paint_fur(fur, occl) if '--fast' not in FLAGS or not os.path.exists(os.path.join(BUILD, 'beaver_fur.png')) else os.path.join(BUILD, 'beaver_fur.png')
    m_fur = pk.material('fur', fur_path, rough=0.88)
    m_kit = pk.material('kit', kit_path, rough=0.78)
    m_eye = pk.material('eye', None, rough=0.18, color=(0.03, 0.025, 0.022))
    m_glass = pk.material('glass', None, rough=0.08, color=(0.85, 0.92, 0.95), alpha=0.22)
    fur.data.materials.append(m_fur)
    kit_objs = [ap, pocket] + straps + stuff + [P_['teeth_u'], P_['teeth_d'], P_['specs'], P_['pencil_ear'], P_['pencil_hand']]
    for o in kit_objs:
        o.data.materials.clear()
        o.data.materials.append(m_kit)
        for p in o.data.polygons:
            p.use_smooth = o in (ap, pocket) or o in straps
    for nm in ('eye_l', 'eye_r'):
        P_[nm].data.materials.append(m_eye)
        for p in P_[nm].data.polygons:
            p.use_smooth = True
    P_['glass'].data.materials.append(m_glass)
    # the craft: his tools, each built in its own frame, then set in his paw (rest pose), and a still copy on the bench
    INFO = build_tools(m_kit)
    CRAFT['info'] = INFO
    proc = [INFO[t]['ob'] for t in ('mallet', 'chisel', 'square', 'block', 'stool')]
    ph = [INFO[t]['ob'] for t in ('saw', 'plane')]
    stills = craft.still_copies(INFO)
    # the rig and the weights
    rig = build_rig()
    names = [b.name for b in rig.data.bones]
    Wf = skin_fur(fur, rig, names)
    # the apron follows the trunk and legs, never the arms (or a raised paw would drag its hem up with it)
    arms = [names.index(n) for n in names if n.startswith(('upper_arm', 'forearm', 'hand'))]
    ci = names.index('chest')
    for o in [ap, pocket] + straps + stuff:
        W = transfer_weights(fur, Wf, o, names)
        W[:, ci] += W[:, arms].sum(1)
        W[:, arms] = 0
        write_weights(o, names, W)
    write_weights(P_['teeth_u'], names, rigid(P_['teeth_u'], names, 'head'))
    write_weights(P_['teeth_d'], names, rigid(P_['teeth_d'], names, 'jaw'))
    write_weights(P_['specs'], names, rigid(P_['specs'], names, 'head'))
    write_weights(P_['glass'], names, rigid(P_['glass'], names, 'head'))
    write_weights(P_['pencil_ear'], names, rigid(P_['pencil_ear'], names, 'pencil_ear'))
    write_weights(P_['pencil_hand'], names, rigid(P_['pencil_hand'], names, 'pencil_hand'))
    for nm in ('eye_l', 'eye_r'):
        write_weights(P_[nm], names, rigid(P_[nm], names, nm))
    for t in craft.TOOLS:
        ob = INFO[t]['ob']
        write_weights(ob, names, rigid(ob, names, 'tool_' + t))
    eyes = join([P_['eye_l'], P_['eye_r']], 'eyes')
    glass = P_['glass']
    for o in [fur, eyes, glass] + kit_objs + proc + ph:
        if o.parent != rig:
            o.parent = rig
        if not any(md.type == 'ARMATURE' for md in o.modifiers):
            md = o.modifiers.new('rig', 'ARMATURE')
            md.object = rig
    log('rigged')
    A = animate(rig)
    log('clips', A.actions)
    work = ['measure', 'saw', 'plane', 'chisel', 'sand', 'blow', 'proud', 'idle', 'talk', 'wave', 'present', 'hop', 'think', 'gnaw']
    if '--no-check' not in FLAGS:
        bad = craft.check(rig, [fur, ap, pocket] + proc + ph, {o.name: t for t in craft.TOOLS for o in [INFO[t]['ob']]}, work, step=3)
        for b in bad:
            log('CLIP', *b)
        log('clipping check:', len(bad), 'contacts', 'worst', max((b[4] for b in bad), default=0), 'mm')
    tl = craft.timeline()
    with open(os.path.join(BUILD, 'craft_timeline.json'), 'w') as fh:
        json.dump({'events': tl, 'bench': craft.BENCH, 'board': craft.BOARD, 'cut': craft.CUT_X, 'mortise': craft.MORTISE,
                   'stool': craft.STOOL, 'slide': craft.SLIDE, 'worst_ik_mm': {k: round(v[0] * 1000, 1) for k, v in CRAFT['worst'].items()}}, fh, indent=1)
    log('timeline', os.path.join(BUILD, 'craft_timeline.json'))
    if '--preview' in FLAGS:
        preview_poses(rig, A.actions)
    if '--craft-preview' in FLAGS:
        preview_craft(rig, stills)
    kit = join(kit_objs + proc, 'kit')
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BUILD, 'beaver.blend'))
    if '--no-export' not in FLAGS:
        export([fur, kit, eyes, glass] + ph + stills, rig, os.path.join(BUILD, 'beaver_raw.glb'))


CRAFT = {}


def build_tools(m_kit):
    """Every tool in its model frame, set into his paw (rest pose); their places on the bench."""
    craft.INFO_GRIP.update({k: tuple(craft.grip_point(k, LM)) for k in ('l', 'r')})
    INFO = {}
    for t, mk in (('mallet', craft.make_mallet), ('chisel', craft.make_chisel), ('square', craft.make_square),
                  ('block', craft.make_block), ('stool', craft.make_stool)):
        ob, info = mk()
        ob.data.materials.clear()
        ob.data.materials.append(m_kit)
        for p in ob.data.polygons:
            p.use_smooth = t != 'block'
        info['ob'] = ob
        INFO[t] = info
    for t, mk in (('saw', craft.make_saw), ('plane', craft.make_plane)):
        ob, info = mk(BUILD)
        ob.name = 'tool_' + t
        info['ob'] = ob
        INFO[t] = info
    for t in craft.TOOLS:
        craft.place_in_hand(INFO[t]['ob'], INFO[t], craft.HAND[t], LM)
    # the pencil (already built and placed in his paw by props()): its frames, in the hand and behind the ear
    def frame(base, d):
        d = Vector(d).normalized()
        u = d.cross(Vector((0, 0, 1)))
        if u.length < 0.1:
            u = d.cross(Vector((1, 0, 0)))
        u.normalize()
        w = d.cross(u).normalized()
        return Matrix((u, d, w)).transposed(), Vector(base)
    Fh, bh = frame(*PENCIL['hand'])
    Fe, be = frame(*PENCIL['ear'])
    INFO['pencil'] = {'F': Fh, 'M_rest': Matrix.Translation(bh) @ Fh.to_4x4(), 'F_ear': Fe, 'grip': Vector((0, 0.05, 0))}
    craft.place_rests(INFO, LM)
    return INFO


def preview_craft(rig, stills):
    """Contact sheets of the work clips on a stand-in bench, close on his paws (a 3/4 view like the game's); the still
    copy of each tool hides while he holds it, as in the game. CRAFT_SHOTS=clip:frame,... picks other frames."""
    sc = bpy.context.scene
    bench = craft.preview_bench()
    cam = [float(x) for x in os.environ.get('CRAFT_CAM', '0.55,-1.55,1.05,-0.05,-0.3,0.6,38').split(',')]
    res = [int(x) for x in os.environ.get('CRAFT_RES', '400,340').split(',')]
    setup_preview_scene(res=tuple(res), cam=(tuple(cam[:3]), tuple(cam[3:6])), lens=cam[6])
    rig.animation_data_create()
    shots = {'measure': (30, 60), 'saw': (70, 100), 'plane': (44, 76), 'chisel': (70, 76), 'sand': (40,), 'blow': (30,), 'proud': (24, 70)}
    if os.environ.get('CRAFT_SHOTS'):
        shots = {}
        for it in os.environ['CRAFT_SHOTS'].split(','):
            nm, f = it.split(':')
            shots.setdefault(nm, []).append(int(f))
    held = {}
    for nm, evs in craft.EV.items():
        for f, k, d in evs:
            if k in ('take', 'put'):
                held.setdefault((nm, d['tool']), [None, None])[0 if k == 'take' else 1] = f
    outs = []
    for nm, frames in shots.items():
        rig.animation_data.action = bpy.data.actions[nm]
        for f in frames:
            for st in stills:
                t = st.name[5:]
                w = held.get((nm, t))
                st.hide_render = bool(w and w[0] <= f < w[1])
            sc.frame_set(f)
            sc.render.filepath = os.path.join(BUILD, f'craft_{nm}_{f}.png')
            bpy.ops.render.render(write_still=True)
            outs.append(sc.render.filepath)
    for st in stills:
        st.hide_render = False
    rig.animation_data.action = None
    sc.frame_set(0)
    from PIL import Image
    ims = [Image.open(p) for p in outs]
    cols = 4
    W, H = ims[0].size
    out = Image.new('RGB', (W * cols, H * ((len(ims) + cols - 1) // cols)))
    for i, im in enumerate(ims):
        out.paste(im, ((i % cols) * W, (i // cols) * H))
    out.save(os.path.join(BUILD, 'craft.png'))
    for o in bench:
        bpy.data.objects.remove(o)
    log('craft sheet', os.path.join(BUILD, 'craft.png'))


def preview_poses(rig, actions):
    """A contact sheet: each clip at its most telling frame."""
    sc = bpy.context.scene
    show = {'idle': 0, 'talk': 6, 'wave': 14, 'present': 20, 'hop': 13, 'think': 20, 'gnaw': 27}
    rig.animation_data_create()
    outs = []
    setup_preview_scene()
    for nm in actions:
        rig.animation_data.action = bpy.data.actions[nm]
        sc.frame_set(show.get(nm, 0))
        sc.render.filepath = os.path.join(BUILD, f'pose_{nm}.png')
        bpy.ops.render.render(write_still=True)
        outs.append(sc.render.filepath)
    rig.animation_data.action = None
    sc.frame_set(0)
    from PIL import Image
    ims = [Image.open(p) for p in outs]
    W = sum(i.size[0] for i in ims)
    out = Image.new('RGB', (W, ims[0].size[1]))
    x = 0
    for i in ims:
        out.paste(i, (x, 0))
        x += i.size[0]
    out.save(os.path.join(BUILD, 'poses.png'))
    log('poses', os.path.join(BUILD, 'poses.png'))


def setup_preview_scene(res=(360, 420), cam=((0.75, -2.3, 0.95), (0, 0, 0.55)), lens=55):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 12
    sc.render.resolution_x, sc.render.resolution_y = res
    if not sc.world:
        sc.world = bpy.data.worlds.new('w')
    sc.world.use_nodes = True
    sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.5, 0.45, 1)
    sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.8
    ld = bpy.data.lights.new('key', 'SUN')
    ld.energy = 3.0
    lo = link(bpy.data.objects.new('key', ld))
    lo.rotation_euler = (math.radians(50), math.radians(-20), math.radians(-35))
    cd = bpy.data.cameras.new('pcam')
    cd.lens = lens
    co = link(bpy.data.objects.new('pcam', cd))
    co.location = Vector(cam[0])
    co.rotation_euler = (Vector(cam[1]) - Vector(cam[0])).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co



def preview(path, res=(560, 560)):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 10
    sc.render.resolution_x, sc.render.resolution_y = res
    if not sc.world:
        sc.world = bpy.data.worlds.new('w')
    sc.world.use_nodes = True
    sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.5, 0.48, 0.45, 1)
    cams = [((0.9, -2.2, 1.0), (0, 0, 0.55)), ((-1.9, -1.2, 0.9), (0, 0, 0.55)), ((1.6, 1.9, 1.1), (0, 0, 0.45)), ((0.25, -0.75, 0.95), (0, -0.1, 0.88))]
    ld = bpy.data.lights.new('key', 'SUN')
    ld.energy = 3.5
    lo = link(bpy.data.objects.new('key', ld))
    lo.rotation_euler = (math.radians(50), math.radians(-20), math.radians(-35))
    cd = bpy.data.cameras.new('pcam')
    cd.lens = 50
    co = link(bpy.data.objects.new('pcam', cd))
    sc.camera = co
    outs = []
    for k, (p, t) in enumerate(cams):
        co.location = Vector(p)
        co.rotation_euler = (Vector(t) - Vector(p)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = path.replace('.png', f'_{k}.png')
        bpy.ops.render.render(write_still=True)
        outs.append(sc.render.filepath)
    log('preview', outs)


if __name__ == '__main__':
    main()
