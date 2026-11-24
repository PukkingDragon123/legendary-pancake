"""Hoot Hollow's owls (v4): realistic, hand-painted birds on parametric surfaces.

    ~/.cache/gg-bpy/bin/python art/blender/owls/owl.py <id ...> | all   [--size=2048] [--quick]
    ids: the species (tawny barn snowy burrowing sawwhet horned greatgrey eagle) and the skins (gingerbread snowman
    celestial meowl). (The queen's GLB is left as it is: she is being retired.)

Every part of the bird is a smooth parametric surface (a superellipsoid body and head with a dished facial disc and its
ruff, folded wings that hug the flanks and unfold to a full spread wing through a morph target, a fan tail, feathered
legs, scaled toes with hooked talons, a hooked beak, ear tufts where the species has them). Each surface's (a, b)
parameters are its UV island, laid out so the feather flow runs along the island: the painter (plume.py) lays every
feather of a tract (crown, facial disc, ruff, mantle, breast, belly fluff, coverts, secondaries, primaries, tail,
trousers) as an individual shingled feather with its own shaft, barbs, markings and tip shadow, over a 2048 px atlas;
the feathers' relief becomes a small normal map; the surfaces' ambient occlusion is ray traced per vertex (Blender's
BVH) and baked into the paint with the feathers' own shadows. No directional light is painted: the game lights it.

Export: a rigid-part hierarchy (root > body > head > tuft_l/r, jaw, brow_l/r, eye decals, anchors; body > wing_l/r,
tail, anchors; root > leg_l/r), each part's mesh in its joint's frame (toy millimetres, the game's frame: y up, +z the
owl's front), so the game turns joints directly (src/owl/actor.ts); the wings carry a 'spread' morph target. Writes
public/models/owls/<id>.glb and art/blender/_build/owls/<id>.rig.json (src/owl/rig.gen.ts: art/blender/owls/rigdata.py).
"""
import io
import json
import math
import os
import struct
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE]
import numpy as np  # noqa: E402

import specs  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT_GLB = os.path.join(ROOT, 'public', 'models', 'owls')
BUILD = os.path.join(ROOT, 'art', 'blender', '_build', 'owls')
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
FLAGS = {a.split('=')[0]: (a.split('=')[1] if '=' in a else True) for a in sys.argv[1:] if a.startswith('--')}
T0 = time.time()


def log(*a):
    print(f'[owl {time.time() - T0:6.1f}s]', *a, flush=True)


# ====================================================================== small maths
def ss(e0, e1, x):
    t = np.clip((np.asarray(x, float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def sexp(v, e):
    return np.sign(v) * np.abs(v) ** e


def nrm(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-9)


def gauss(x, w):
    return np.exp(-(np.asarray(x, float) / w) ** 2)


def lerp(a, b, t):
    return a + (b - a) * t


def V(*a):
    return np.array(a, float)


def bez(P, t):
    """A point on a polyline-smoothed spine: Catmull-Rom through the points P (n, 3) at t in 0..1 (vectorised)."""
    P = np.asarray(P, float)
    n = len(P) - 1
    t = np.clip(np.asarray(t, float), 0, 1) * n
    i = np.minimum(np.floor(t).astype(int), n - 1)
    u = (t - i)[..., None]
    p0 = P[np.maximum(i - 1, 0)]
    p1 = P[i]
    p2 = P[i + 1]
    p3 = P[np.minimum(i + 2, n)]
    # (end tangents mirrored so the spine does not overshoot)
    p0 = np.where((i == 0)[..., None], 2 * p1 - p2, p0)
    p3 = np.where((i + 1 == n)[..., None], 2 * p2 - p1, p3)
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u ** 2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)


# ====================================================================== surfaces
class Surf:
    """A smooth part: fn(a, b) -> (..., 3) positions (mm, the game frame), sampled on an (na x nb) grid; its UV island is
    the (a, b) rectangle at `w x h` mm (the painter's metric). wrap: periodic in a. tract: what the painter lays on it.
    flip: reverse the winding (the normal must point out). share: the island of another surface (a mirrored pair)."""

    def __init__(s, name, joint, fn, na, nb, w, h, tract, wrap=False, flip=False, share=None, spread=None, dens=1.0, ao=None, **kw):
        s.name, s.joint, s.fn, s.na, s.nb, s.w, s.h, s.tract = name, joint, fn, na, nb, w, h, tract
        s.wrap, s.flip, s.share, s.spread, s.dens, s.ao_group = wrap, flip, share, spread, dens, ao
        s.kw = kw
        s.mirror = False

    # the grid
    def grid(s):
        a = np.linspace(0, 1, s.na)
        b = np.linspace(0, 1, s.nb)
        return np.meshgrid(a, b, indexing='xy')  # (nb, na)

    def eval(s, a, b, fn=None):
        P = (fn or s.fn)(a, b)
        if s.mirror:
            P = P * np.array([-1.0, 1.0, 1.0])
        return P

    def normals(s, a, b, fn=None):
        e = 1e-3
        aa0, aa1 = (a - e, a + e) if s.wrap else (np.clip(a - e, 0, 1), np.clip(a + e, 0, 1))
        bb = np.clip(b, 2e-3, 1 - 2e-3)  # (off the poles: a degenerate row has no tangent)
        bb0, bb1 = np.clip(bb - e, 0, 1), np.clip(bb + e, 0, 1)
        f = fn or s.fn
        da = s.eval(aa1, bb, f) - s.eval(aa0, bb, f)
        db = s.eval(a, bb1, f) - s.eval(a, bb0, f)
        n = np.cross(da, db)
        return nrm(n) * getattr(s, 'sgn', 1.0)


def mesh_of(s):
    """Vertices, normals, triangles and (a, b) of a surface's grid (+ the spread target when it has one)."""
    A, B = s.grid()
    P = s.eval(A, B)
    s.sgn = 1.0
    N = s.normals(A, B)
    # every surface's normals point out: away from its own centre on the whole
    if ((N.reshape(-1, 3) * (P.reshape(-1, 3) - P.reshape(-1, 3).mean(0))).sum()) < 0:
        s.sgn = -1.0
        N = -N
    nb, na = A.shape
    relief = getattr(s, 'relief', None)
    if relief is not None:
        # feathers in the silhouette: the mesh itself is pushed out into clumps of plumage (the paint stays on the
        # smooth surface's parameters, so nothing slides), and its normals are taken from the displaced grid
        d = relief(s, A, B, P, N)
        P = P + N * d[..., None]
        if s.wrap:
            Pe = np.concatenate([P[:, -2:-1], P, P[:, 1:2]], 1)
            dA = Pe[:, 2:] - Pe[:, :-2]
        else:
            dA = np.gradient(P, axis=1)
        dB = np.gradient(P, axis=0)
        N2 = np.cross(dA, dB)
        ln = np.linalg.norm(N2, axis=-1, keepdims=True)
        N2 = np.where(ln > 1e-9, N2 / np.maximum(ln, 1e-12), N)
        N2 = np.where(((N2 * N).sum(-1) < 0)[..., None], -N2, N2)
        N = N2
    idx = np.arange(na * nb).reshape(nb, na)
    q0, q1, q2, q3 = idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]
    T = np.concatenate([np.stack([q0, q1, q2], -1).reshape(-1, 3), np.stack([q0, q2, q3], -1).reshape(-1, 3)])
    Pf = P.reshape(-1, 3)
    Nf = N.reshape(-1, 3)
    # drop triangles that collapsed at a pole
    ar = np.linalg.norm(np.cross(Pf[T[:, 1]] - Pf[T[:, 0]], Pf[T[:, 2]] - Pf[T[:, 0]]), axis=1)
    T = T[ar > 1e-9]
    # wind every triangle so its face normal agrees with the surface normal there
    fn_ = np.cross(Pf[T[:, 1]] - Pf[T[:, 0]], Pf[T[:, 2]] - Pf[T[:, 0]])
    vn = Nf[T[:, 0]] + Nf[T[:, 1]] + Nf[T[:, 2]]
    bad = (fn_ * vn).sum(1) < 0
    T[bad] = T[bad][:, [0, 2, 1]]
    out = dict(P=Pf, N=Nf, T=T, A=A.reshape(-1), B=B.reshape(-1))
    if s.spread is not None:
        Ps = s.eval(A, B, s.spread).reshape(-1, 3)
        Ns = s.normals(A, B, s.spread).reshape(-1, 3)
        if ((Ns * (Ps - Ps.mean(0))).sum()) < 0:  # (the same outward sense on the opened wing)
            Ns = -Ns
        out['dP'] = Ps - Pf
        out['dN'] = Ns - Nf
    return out


# ====================================================================== the bird
class Owl:
    def __init__(s, spec):
        s.S = spec
        s.id = spec['id']
        sh = spec['shape']
        g = lambda k, d: sh.get(k, d)  # noqa: E731
        s.g = g
        s.k = k = g('k', 1.0)
        s.cat = g('cat', False)
        s.skin = spec.get('kind') == 'skin'
        # ---- the body: a pear of plumage on short feathered legs
        s.leg = g('leg', 2.6) * k               # visible tarsus between the belly fluff and the toes
        s.bw = 13.0 * k * g('bw', 1.0)          # half width
        s.bf = 11.6 * k * g('bd', 1.0) * g('bf', 1.0)   # front depth
        s.bb = 9.6 * k * g('bd', 1.0)           # back depth
        s.bh = 25.0 * k * g('bh', 1.0)          # height
        s.by0 = 1.5 * k + s.leg                 # the belly's lowest point
        s.by1 = s.by0 + s.bh
        s.byc = s.by0 + s.bh * 0.42             # the widest girth
        s.bzc = -0.6 * k
        s.pear = g('pear', 0.08)                 # narrower at the shoulders
        s.breast = g('breast', 1.0)
        s.fluff = g('fluff', 0.0)
        # ---- the head: big and round, its lower half sunk into the shoulders (no neck to see)
        s.hw = 11.6 * k * g('hw', 1.0)          # half width
        s.hht = 11.0 * k * g('hh', 1.0)         # top above its centre
        s.hhb = 10.8 * k * g('hh', 1.0)         # bottom below its centre (inside the body)
        s.hdf = 9.2 * k * g('hd', 1.0)          # face depth from the centre
        s.hdb = 9.8 * k * g('hd', 1.0)          # back depth
        s.hyc = s.by1 + 0.6 * k + g('hy', 0.0) * k
        s.hzc = 0.4 * k
        s.flat = g('flat', 0.25)                # a flat crown (the barn, the eagle-owl)
        s.disc = g('disc', 'lobes')
        s.discr = g('discr', 0.42)              # disc lobe radius as a share of the half width
        s.ex = g('ex', 0.43) * s.hw             # eye half spacing
        s.ey = s.hyc + g('ey', 0.06) * s.hht
        s.er = g('er', 1.3) * k                 # the ink dot's toy radius (the decal is 2.1x)
        s.dish = g('dish', 1.0)
        s.beak = g('beak', 1.0) * 0.6 * k
        s.tufts = g('tufts', None)
        s.toes = g('toes', 'feathered')
        s.legw = g('legw', 2.0) * k
        s.legx = g('legx', 4.6) * k
        s.tailk = g('tail', 1.0)
        s.wingk = g('wing', 1.0)
        s.piv = {'root': V(0, 0, 0)}
        s.par = {}
        s.anchors = {}
        s.surfs = []

    # -------------------------------------------------------------- body
    # the body's profile from the top of the shoulders (b = 0, inside the head) to the bottom of the belly (b = 1):
    # (height as a share of the body, half width, front depth, back depth as shares of their maxima)
    PROF = np.array([
        (1.0, 0.0, 0.0, 0.0), (0.965, 0.6, 0.55, 0.75), (0.87, 0.8, 0.76, 0.92), (0.75, 0.9, 0.9, 0.99), (0.62, 0.96, 0.98, 1.0),
        (0.49, 1.0, 1.0, 0.98), (0.36, 1.0, 0.99, 0.94), (0.24, 0.96, 0.93, 0.86), (0.13, 0.84, 0.8, 0.72), (0.045, 0.58, 0.54, 0.5),
        (0.0, 0.0, 0.0, 0.0)])

    def body_sec(s, b):
        """(half width, front depth, back depth, centre y, centre z) of the body at b (0 top .. 1 bottom)."""
        q = bez(s.PROF, np.clip(b, 0, 1))
        y = s.by0 + q[..., 0] * s.bh
        w = s.bw * q[..., 1] * (1 - s.pear * ss(0.45, 0.05, b))
        f = s.bf * q[..., 2] * (1 + 0.08 * s.breast * gauss(b - 0.38, 0.16))
        bk = s.bb * q[..., 3]
        zc = s.bzc + 0.5 * s.k * s.breast * gauss(b - 0.42, 0.22)
        return np.maximum(w, 0), np.maximum(f, 0), np.maximum(bk, 0), y, zc

    def body_fn(s, a, b):
        th = math.pi + 2 * math.pi * a  # a = 0: the back's centre line (the seam), 0.5: the breast
        w, f, bk, y, zc = s.body_sec(b)
        st, ct = np.sin(th), np.cos(th)
        x = w * sexp(st, 0.92)
        z = zc + np.where(ct > 0, f, bk) * sexp(ct, 0.92)
        P = np.stack([x, np.broadcast_to(y, x.shape), z], -1)
        # ragged belly fluff toward the hem, lumpy plumage on a fluffy bird
        if s.fluff or True:
            lo = ss(0.62, 0.96, b)
            rag = 0.5 * np.abs(np.sin(th * 9 + np.sin(th * 3) * 0.8)) + 0.25 * np.sin(th * 23)
            amp = (0.35 + 0.9 * s.fluff) * s.k * lo * (0.4 + 0.6 * (ct > -0.3))
            lump = s.fluff * 0.6 * s.k * np.sin(th * 5 + b * 7) * np.sin(b * 11 + 1.3) * ss(0.15, 0.4, b)
            d = amp * rag + lump
            n = nrm(np.stack([x / np.maximum(w, 1e-3), np.zeros_like(x), (z - zc) / 10.0], -1))
            P = P + n * d[..., None]
        return P

    def body_x(s, y, z):
        """The body's half width at height y and depth z (for hugging the wings and garments)."""
        # invert y -> b numerically
        bs = np.linspace(0, 1, 400)
        ys = s.body_sec(bs)[3]
        bq = np.interp(y, ys[::-1], bs[::-1])
        w, f, bk, yy, zc = s.body_sec(bq)
        dep = np.where(z > zc, f, bk)
        r = np.clip(np.abs(z - zc) / np.maximum(dep, 1e-3), 0, 0.999)
        return w * (1 - r ** (2 / 0.92)) ** (0.92 / 2)

    def clumps(s, sf, A, B, P, ds, du, L, W, amp, seed, fray=1.2):
        """A field of feather clumps over a surface's grid (the shingle at a coarse scale): each clump lifts toward its
        tip and drops at its edge onto the next, so the outline breaks into feathers. Returns the lift (0..1)."""
        import plume
        bb = np.linspace(0, 1, 257)
        Pm = sf.eval(np.full_like(bb, 0.5), bb)
        Sb = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(Pm, axis=0), axis=1))])
        aa = np.linspace(0, 1, 129)
        Cb = np.array([max(np.linalg.norm(np.diff(sf.eval(aa, np.full_like(aa, v)), axis=0), axis=1).sum(), 0.05) for v in bb])
        S = np.interp(B, bb, Sb)
        C = np.interp(B, bb, Cb)
        Smax = float(Sb[-1])
        f = lambda v: v if callable(v) else (lambda x, v=v: v)  # noqa: E731
        ds, du, L, W = f(ds), f(du), f(L), f(W)
        rows = plume.make_rows(-1.0, Smax + 1.0, lambda x: ds(x / Smax) * s.k, lambda x: max(5, round(float(np.interp(x, Sb, Cb)) / (du(x / Smax) * s.k))),
                               lambda x: L(x / Smax) * s.k, lambda x: W(x / Smax) * s.k)
        n1 = plume.vnoise3(P, 3.0 * s.k, seed + 1) - 0.5
        n2 = plume.vnoise3(P, 3.0 * s.k, seed + 2) - 0.5
        S2 = (S + n1 * 1.6 * s.k).reshape(-1)
        A2 = (A + n2 * 1.6 * s.k / np.maximum(C, 0.3)).reshape(-1)
        F = plume.shingle(S2, A2, C.reshape(-1), rows, wrap=True, seed=seed, fray=fray, sjit=2.2, extra=2)
        lift = ss(0.0, 0.8, F['fa']) * (1 - ss(0.78, 1.0, F['edge'])) * (0.55 + 0.9 * F['id'])
        return (lift * F['hit']).reshape(A.shape)

    def body_relief(s, sf, A, B, P, N):
        """The body's plumage in the silhouette: soft clumps on the breast and flanks, ragged fluff toward the belly."""
        k = s.k
        lift = s.clumps(sf, A, B, P, lambda t: 1.9 + 0.9 * ss(0.5, 0.95, t), lambda t: 2.3 + 0.9 * ss(0.5, 0.95, t),
                        lambda t: 4.6 + 1.6 * ss(0.5, 0.95, t), lambda t: 1.35 + 0.5 * ss(0.5, 0.95, t), 1.0, 61)
        th = math.pi + 2 * math.pi * A
        front = 0.5 + 0.5 * np.cos(th)
        amp = (0.28 + 0.32 * front + 0.45 * ss(0.45, 0.9, B)) * k * (1 + 0.8 * s.fluff) * s.g('plushgeo', 1.0)
        return lift * amp * ss(0.06, 0.2, B)

    def head_relief(s, sf, A, B, P, N):
        """The head's plumage in the silhouette: small crown clumps, the ruff's serrated rim standing off the disc."""
        k = s.k
        lift = s.clumps(sf, A, B, P, 1.3, 1.6, 3.4, 0.95, 1.0, 71)
        X, Y = P[..., 0], P[..., 1] - s.ey
        th = math.pi + 2 * math.pi * A
        front = ss(0.15, 0.6, np.cos(th))
        if s.cat:
            return lift * 0.18 * k * (1 - 0.7 * front)
        dd = s.disc_d(X, Y)
        disc = ss(0.2 * k, -0.8 * k, dd) * front
        ang = np.arctan2(Y + 0.25 * s.discr * s.hw, X)
        serr = 0.5 + 0.5 * np.sin(ang * 34 + 2.0 * np.sin(ang * 7))
        rim = gauss(dd - 0.9 * k, 1.1 * k) * front
        d = lift * 0.26 * k * (1 - disc) + rim * serr * 0.45 * k * s.g('ruffk', 1.0)
        return d * ss(0.02, 0.1, B)

    def build_body(s):
        k = s.k
        circ = 2 * math.pi * max(s.bw, (s.bf + s.bb) / 2)
        sf = Surf('body', 'body', s.body_fn, 100, 64, circ * 0.92, math.pi * s.bh * 0.52, 'body', wrap=True)
        sf.relief = s.body_relief
        s.surfs.append(sf)
        s.bone('body', (0, s.by0 + s.bh * 0.22, s.bzc), 'root')

    # -------------------------------------------------------------- head
    def disc_d(s, X, Y):
        """Signed distance (mm, < 0 inside) to the facial disc's outline in the face plane (X across, Y up from the eyes)."""
        ex, hw = s.ex, s.hw
        dx = np.abs(X)
        if s.disc == 'heart':
            r = s.discr * hw * 0.62
            d1 = np.hypot(dx - ex * 0.8, (Y - r * 0.15) / 1.08) - r
            tip = -r * 2.2
            t = np.clip((Y - tip) / (0 - tip), 0, 1)
            half = t ** 0.8 * (ex * 0.8 + r * 0.98)
            d2 = (dx - half) * 0.9
            d = np.where((Y < 0) & (Y > tip), np.minimum(d1, d2), d1)
            return d  # (the two lobes over the eyes meet in a notch above the bill: a true heart)
        if s.disc == 'round':
            r = s.discr * hw * 1.05
            return np.hypot(X, (Y + r * 0.16) / 0.98) - r
        r = s.discr * hw
        d1 = np.hypot(dx - ex, (Y - 0.0) / 0.95) - r
        d2 = np.hypot(X / 0.95, Y + r * 0.62) - r * 0.98
        return np.maximum(np.minimum(d1, d2), Y - r * 0.92)

    def head_base(s, th, phi):
        sp, cp = np.sin(phi), np.cos(phi)
        st, ct = np.sin(th), np.cos(th)
        eT = 0.9 - 0.25 * s.flat  # (a flatter crown: a squarer section on top)
        y = s.hyc + np.where(cp > 0, s.hht * sexp(cp, eT), s.hhb * sexp(cp, 0.95))
        spw = np.abs(sp) ** 0.86
        # the head is widest at the eyes, a little narrower at the jowls
        w = s.hw * (1 - 0.2 * ss(0.0, -0.9, cp))
        x = w * sexp(st, 0.88) * spw
        face = ct > 0
        dep = np.where(face, s.hdf, s.hdb)
        ez = np.where(face, 0.62, 0.9)  # (the face is flattened: a squarer section to the front)
        z = s.hzc + dep * sexp(ct, ez) * spw
        return np.stack([x, y, z], -1)

    def head_fn(s, a, b):
        th = math.pi + 2 * math.pi * a
        phi = math.pi * b
        P = s.head_base(th, phi)
        k = s.k
        if s.cat:
            return s.cat_face(P, th, phi)
        X, Y = P[..., 0], P[..., 1] - s.ey
        front = ss(0.2, 0.75, np.cos(th)) * ss(0.1, 0.35, np.sin(phi))
        dd = s.disc_d(X, Y)
        inside = ss(0.6, -2.4 * k, dd)
        # the dish: a bowl round each eye, the whole disc set back under its ruff
        bowl = sum(np.exp(-((X - sx * s.ex) ** 2 + (Y * 1.1) ** 2) / (2 * (s.discr * s.hw * 0.62) ** 2)) for sx in (1, -1))
        dz = -1.1 * k * s.dish * inside * (0.55 + 0.45 * np.clip(bowl, 0, 1))
        # the ruff: a rim of stiff feathers standing proud round the disc
        dz += 1.55 * k * s.g('ruffk', 1.0) * gauss(dd - 0.75 * k, 0.95 * k) * (1 - 0.35 * ss(-2, -6, Y))
        # the ridge of feathers between the eyes down to the bill, and the brows over the eyes
        dz += 1.25 * k * gauss(X, 1.4 * k) * ss(-3.0 * k, 0.0 * k, Y) * ss(4.5 * k, 1.0 * k, Y)  # (the bristled ridge: it hides the bill's base)
        dz += 0.45 * k * sum(gauss(X - sx * s.ex * 0.9, 2.6 * k) for sx in (1, -1)) * gauss(Y - 2.4 * k, 1.0 * k) * inside
        P = P.copy()
        P[..., 2] = P[..., 2] + dz * front
        # soft crown and nape feathers in the silhouette (a fluffy bird)
        if s.fluff:
            back = ss(0.2, -0.6, np.cos(th))
            P = P + (nrm(P - V(0, s.hyc, s.hzc)) * (s.fluff * 0.35 * k * np.sin(th * 7 + phi * 5) * np.sin(phi * 9) * back)[..., None])
        return P

    def cat_face(s, P, th, phi):
        """The Meowl: a kitten's round head (muzzle pads, a little nose bridge, cheeks)."""
        k = s.k
        X, Y = P[..., 0], P[..., 1] - s.ey
        front = ss(0.2, 0.7, np.cos(th)) * ss(0.1, 0.35, np.sin(phi))
        # the whisker pads: two plump puffs either side under the nose, a little chin below them
        dz = 1.35 * k * sum(np.exp(-(((X - sx * 1.55 * k) / (1.9 * k)) ** 2 + ((Y + 3.5 * k) / (1.45 * k)) ** 2)) for sx in (1, -1))
        dz += 0.55 * k * gauss(X, 1.2 * k) * gauss(Y + 5.3 * k, 0.9 * k)
        # the short nose bridge up to the brow, a soft stop between the eyes
        dz += 0.75 * k * gauss(X, 1.25 * k) * gauss(Y + 1.7 * k, 1.5 * k)
        dz -= 0.35 * k * sum(gauss(X - sx * s.ex, 2.0 * k) * gauss(Y, 1.6 * k) for sx in (1, -1))
        P = P.copy()
        P[..., 2] = P[..., 2] + dz * front
        # full kitten cheeks: the jowls puff out sideways below the eyes
        cheek = ss(0.1, 0.5, np.sin(phi)) * gauss(Y + 3.2 * k, 3.0 * k) * ss(-0.3, 0.4, np.cos(th))
        P[..., 0] = P[..., 0] * (1 + 0.09 * cheek)
        return P

    def build_head(s):
        k = s.k
        circ = 2 * math.pi * s.hw
        sf = Surf('head', 'head', s.head_fn, 104, 68, circ * 0.92, math.pi * (s.hht + s.hhb) * 0.55, 'head', wrap=True)
        sf.relief = s.head_relief
        s.surfs.append(sf)
        s.bone('head', (0, s.by1 - 1.5 * k, s.hzc - 0.5 * k), 'body')
        s.face_z = float(s.head_fn(np.array(0.5), np.array(0.5))[2])
        # ---- the beak: a little hooked bill half buried in bristles; the lower mandible on its own joint
        if s.id == 'snowman':  # a carrot for a beak
            yb = s.ey - 2.2 * k
            zb = float(s.head_fn(np.array(0.5), np.array(_b_at(s, yb)))[..., 2]) - 1.0 * k
            spine = np.array([(0, yb, zb), (0, yb - 0.5 * k, zb + 3.4 * k), (0, yb - 1.3 * k, zb + 6.6 * k)])
            s.tube('beak', 'head', spine, lambda t: 1.35 * k * (1 - t) ** 0.9 + 0.05, 12, 14, tract='carrot', close1=True)
            jp = (0, yb - 0.8 * k, zb + 0.2 * k)
            s.tube('jaw', 'jaw', [jp, (0, yb - 1.2 * k, zb + 1.2 * k)], lambda t: 0.5 * k * (1 - t) + 0.05, 8, 6, tract='gape', close1=True)
            s.bone('jaw', jp, 'head')
        elif not s.cat:
            bk = s.beak
            yb = s.ey - 1.6 * k
            zb = float(s.head_fn(np.array(0.5), np.array(_b_at(s, yb)))[..., 2]) - 0.9 * bk
            spine = np.array([(0, yb + 1.0 * bk, zb - 0.5 * bk), (0, yb + 0.4 * bk, zb + 1.1 * bk), (0, yb - 0.7 * bk, zb + 1.55 * bk),
                              (0, yb - 1.7 * bk, zb + 1.3 * bk), (0, yb - 2.2 * bk, zb + 0.7 * bk)])
            rad = lambda t: 1.75 * bk * (1 - t) ** 0.85 + 0.04  # noqa: E731
            s.tube('beak', 'head', spine, rad, 14, 18, squash=(0.86, 1.0), tract='beak', close1=True)
            s.beak_tip = spine[-1]
            jp = (0, yb - 0.4 * bk, zb + 0.4 * bk)
            jspine = np.array([jp, (0, yb - 1.1 * bk, zb + 1.2 * bk), (0, yb - 1.5 * bk, zb + 1.45 * bk)])
            s.tube('jaw', 'jaw', jspine, lambda t: 0.8 * bk * (1 - t) ** 0.7 + 0.05, 10, 8, squash=(0.85, 0.55), tract='gape', close1=True)
            s.bone('jaw', jp, 'head')
        else:
            # the nose: a small soft pink pad, wider on top (a rounded triangle), sitting on the bridge
            yb = s.ey - 2.4 * k
            zb = float(s.head_fn(np.array(0.5), np.array(_b_at(s, yb)))[..., 2]) - 0.3 * k
            spine = np.array([(0, yb + 0.45 * k, zb - 0.1 * k), (0, yb, zb + 0.42 * k), (0, yb - 0.45 * k, zb + 0.22 * k)])
            s.tube('beak', 'head', spine, lambda t: 0.85 * k * np.sin(math.pi * np.clip(t, 0.02, 0.98)) ** 0.45 * (1.15 - 0.45 * t) + 0.02, 12, 8,
                   squash=(1.25, 0.6), tract='nose')
            s.whiskers()
            jp = (0, yb - 2.2 * k, zb - 0.6 * k)
            jspine = np.array([jp, (0, yb - 2.6 * k, zb - 0.1 * k), (0, yb - 2.9 * k, zb - 0.4 * k)])
            s.tube('jaw', 'jaw', jspine, lambda t: 0.9 * k * (1 - t) ** 0.7 + 0.05, 10, 8, squash=(1.0, 0.55), tract='gape', close1=True)
            s.bone('jaw', jp, 'head')
        s.anchor_head = (0, s.hyc + s.hht - 0.9 * k, s.hzc - 0.2 * k)
        s.anchor_face = (0, s.ey + 0.2 * k, s.face_z + 0.4 * k)
        for nm, sx in (('brow_l', -1), ('brow_r', 1)):
            s.bone(nm, (sx * s.ex, s.ey + s.er * 1.8, s.face_z), 'head')

    # -------------------------------------------------------------- tubes (legs, toes, talons, beak)
    def tube(s, name, joint, spine, rad, na, nb, squash=(1.0, 1.0), tract=None, close0=True, close1=True, share=None, mirror=False, up=(0, 1, 0), **kw):
        """A tube along `spine` (points), radius rad(t), section squashed (side, up). Capped round at both ends."""
        spine = np.asarray(spine, float)
        upv = np.asarray(up, float)

        def fn(a, b, spine=spine):
            t = b
            c = bez(spine, t)
            dt = 1e-3
            tg = nrm(bez(spine, np.clip(t + dt, 0, 1)) - bez(spine, np.clip(t - dt, 0, 1)))
            side = nrm(np.cross(tg, upv))
            side = np.where(np.linalg.norm(np.cross(tg, upv), axis=-1, keepdims=True) < 1e-4, np.array([1.0, 0, 0]), side)
            upn = np.cross(side, tg)
            r = rad(t)
            # round caps: pull the end rings in
            cap = np.ones_like(t)
            if close0:
                cap = cap * np.sqrt(np.clip(t / 0.04, 0, 1))
            if close1:
                cap = cap * np.sqrt(np.clip((1 - t) / 0.04, 0, 1))
            th = 2 * math.pi * a
            r = (r * cap)[..., None]
            return c + r * (np.cos(th)[..., None] * side * squash[0] + np.sin(th)[..., None] * upn * squash[1])
        L = float(np.linalg.norm(np.diff(spine, axis=0), axis=1).sum())
        rmax = float(max(rad(np.array(x)) for x in np.linspace(0, 1, 9)))
        sf = Surf(name, joint, fn, na, nb, 2 * math.pi * rmax * max(squash), L, tract or name, wrap=True, share=share, **kw)
        sf.mirror = mirror
        s.surfs.append(sf)
        return sf

    # -------------------------------------------------------------- ear tufts
    def build_tufts(s):
        k = s.k
        t = s.tufts
        if s.cat:
            for nm, sx in (('tuft_l', -1), ('tuft_r', 1)):
                b0 = V(sx * s.hw * 0.52, s.hyc + s.hht * 0.62, s.hzc - 0.6 * k)
                s.bone(nm, b0, 'head')
                s.ear(nm, b0, sx)
            return
        if not t:
            return
        L, W = t['len'] * k, t['w'] * k
        for nm, sx in (('tuft_l', -1), ('tuft_r', 1)):
            b0 = V(sx * s.hw * t['x'], s.hyc + s.hht * 0.72 - 0.6 * k, s.hzc + t.get('fwd', -0.5) * k)
            s.bone(nm, b0, 'head')
            # a fan of narrow, pointed feathers (each its own blade, a little apart), the longest in the middle
            fan = ((1.0, 1.0, 0.0, 0.0), (0.84, 0.86, 13.0, -0.7), (0.72, 0.8, -12.0, 0.6), (0.6, 0.72, 25.0, -0.2))
            for i, (f, wk, da, dz) in enumerate(fan):
                ang = math.radians(t['lean'] + da)
                tip = b0 + V(sx * math.sin(ang) * L * f, math.cos(ang) * L * f, (dz - 1.6) * k)
                mid = b0 + (tip - b0) * 0.5 + V(sx * 0.3 * k, 0, -0.5 * k)
                ww = W * 0.36 * wk
                s.blade(f'{nm}{i}', nm, np.array([b0 + V(sx * (i - 1.5) * 0.5 * k, -1.2 * k, dz * k), mid, tip]),
                        lambda q, ww=ww: ww * (np.sin(math.pi * np.clip(q, 0, 1) ** 0.55)) * (1 - 0.35 * np.clip(q, 0, 1)) + 0.04,
                        0.55 * k, 'tuft', sx, share=None if sx < 0 else f'tuft_l{i}')

    def blade(s, name, joint, spine, half, thick, tract, sx, share=None):
        """A flat feather blade (tufts): a lens section along a spine, wide across x-ish, thin front to back."""
        spine = np.asarray(spine, float)

        def fn(a, b, spine=spine):
            c = bez(spine, b)
            tg = nrm(bez(spine, np.clip(b + 1e-3, 0, 1)) - bez(spine, np.clip(b - 1e-3, 0, 1)))
            fw = np.array([0.0, 0.0, 1.0])
            side = nrm(np.cross(fw, tg))
            th = 2 * math.pi * a
            w = half(b)[..., None]
            cap = np.sqrt(np.clip((1 - b) / 0.03, 0, 1))[..., None] * np.sqrt(np.clip(b / 0.03, 0, 1))[..., None]
            return c + cap * (np.cos(th)[..., None] * side * w + np.sin(th)[..., None] * fw * thick * 0.5 * (0.4 + 0.6 * (1 - b[..., None])))
        L = float(np.linalg.norm(np.diff(spine, axis=0), axis=1).sum())
        sf = Surf(name, joint, fn, 16, 14, 2.2 * float(half(np.array(0.4))) * 2, L, tract, wrap=True, share=share)
        sf.mirror = False
        s.surfs.append(sf)

    def whiskers(s):
        """A kitten's whiskers: three fine white strands from each pad, sweeping out and a little down."""
        k = s.k
        for sx in (-1, 1):
            for i, (dy, ang) in enumerate(((0.35, 8.0), (-0.15, -4.0), (-0.65, -16.0))):
                y0 = s.ey - 3.4 * k + dy * k
                z0 = float(s.head_fn(np.array(0.5 + sx * 0.05), np.array(_b_at(s, y0)))[..., 2]) - 0.3 * k
                p0 = V(sx * 2.0 * k, y0, z0)
                a = math.radians(ang)
                p2 = p0 + V(sx * math.cos(a) * 8.6 * k, math.sin(a) * 8.6 * k - 0.6 * k, -0.4 * k)
                p1 = p0 + (p2 - p0) * 0.5 + V(0, 0.5 * k, 0.9 * k)
                side = 'l' if sx < 0 else 'r'
                s.tube(f'whisk{i}{side}', 'head', [p0, p1, p2], lambda t: 0.1 * k * (1 - 0.6 * t) + 0.012, 5, 10, tract='whisker',
                       share=None if sx < 0 else f'whisk{i}l')

    def ear(s, nm, b0, sx):
        """A kitten's ear on the tuft joint: a rounded cone, cupped to the front."""
        k = s.k

        def fn(a, b, b0=b0, sx=sx):
            th = 2 * math.pi * a
            tip = b0 + V(sx * 2.9 * k, 7.6 * k, -0.6 * k)
            c = b0 + (tip - b0) * b[..., None]
            r = 4.2 * k * (1 - b) ** 0.9 * (1 - 0.15 * b) + 0.18 * k * (1 - b) + 0.04
            cup = 1 - 0.55 * np.clip(np.cos(th), 0, 1)  # (the front is cupped in)
            side = V(math.cos(math.radians(-sx * 20)), math.sin(math.radians(-sx * 20)) * 0, 0)
            side = nrm(np.cross(nrm(tip - b0), V(0, 0, 1)))
            fwd = V(0, 0, 1)
            return c + r[..., None] * (np.sin(th)[..., None] * side * 1.0 + np.cos(th)[..., None] * fwd * 0.55 * cup[..., None])
        sf = Surf(nm, nm, fn, 18, 12, 2 * math.pi * 3.6 * k, 7.0 * k, 'ear', wrap=True, share=None if sx < 0 else 'tuft_l')
        s.surfs.append(sf)

    # -------------------------------------------------------------- wings
    def wing_folded(s, sx):
        """The folded wing on the flank (in the wing joint's frame): (a, b) -> mm. b: 0 shoulder .. 1 the primaries'
        tips; a: 0..0.5 the outer face from the leading edge to the trailing edge, 0.5..1 the inner face back again."""
        k, wk = s.k, s.wingk
        sh = s.shoulder(sx)
        H = (s.by1 - 3.2 * k) - (s.by0 - 1.2 * k) * 1.0 + 1.5 * k * (wk - 1)

        def fn(a, b):
            ph = 2 * math.pi * a
            cf = (1 - np.cos(ph)) / 2  # 0 leading edge .. 1 trailing edge
            side = np.sin(ph)          # + outer face
            y = sh[1] - b * H
            # the outline seen from the side: the wrist bulges forward, the tips sweep back and cross toward the tail
            zf = sh[2] + 4.6 * k * np.sin(math.pi * np.clip(b / 0.85, 0, 1)) ** 0.8 - 2.5 * k * b ** 2
            zb = sh[2] - 6.2 * k - 4.0 * k * b ** 1.2 * wk + 1.2 * k * ss(0.8, 1.0, b)
            zb = np.minimum(zb, zf - 0.6 * k)
            tip = ss(0.82, 1.0, b)
            # the long primaries run on down and back past the body, crossing over the tail
            zb = zb - 2.6 * k * ss(0.7, 1.0, b) * wk
            z = lerp(zf, zb, cf)
            z = lerp(z, (zf + zb) / 2 - 2.6 * k, tip * 0.75)
            # the secondaries' tips stand out along the trailing edge, one notch per feather
            sec = np.abs(np.sin(b * 8.0 * math.pi + 0.4)) ** 0.55
            z = z - 0.85 * k * sec * ss(0.62, 1.0, cf) * ss(0.22, 0.4, b) * (1 - tip)
            # the primaries' tips: separate points along the bottom edge
            prim = np.abs(np.sin(cf * 3.6 * math.pi)) ** 0.6
            y = y - 0.9 * k * prim * ss(0.86, 1.0, b)
            # hug the flank (the body's surface + a standoff growing toward the tips)
            yw, zw = y + 0.0, z + 0.0
            xb = s.body_x(np.clip(yw, s.by0 + 0.3, s.by1 - 0.3), zw)
            thick = (1.3 * k * (1 - cf) ** 0.6 + 0.24 * k) * (1 - 0.6 * tip)
            off = 0.25 * k + 1.0 * k * ss(0.35, 1.0, b) + 0.5 * k * gauss(b - 0.45, 0.25) * (1 - cf)
            # only the shoulder tucks in under the scapulars; the wing's front edge lies over the flank
            off = off - 0.5 * k * (1 - ss(0.0, 0.2, cf)) * (1 - ss(0.5, 0.8, b)) - 1.2 * k * ss(0.16, 0.0, b)
            # layered: the coverts lie proud of the flight feathers, their scalloped tips stepping down onto them
            cl = 0.42 + 0.06 * cf - 0.025 * np.abs(np.sin(cf * 5.0 * math.pi))
            cov = ss(cl + 0.03, cl - 0.005, b)
            lesser = ss(0.24, 0.2, b)
            x = xb + off + thick * (0.5 + 0.5 * side) + (0.5 * cov + 0.25 * lesser) * k * (0.5 + 0.5 * side)
            # the tips cross behind the body, over the tail
            cross = ss(0.7, 1.0, b) * ss(0.3, 1.0, cf)
            x = x * (1 - 0.9 * cross) - (0.55 if sx < 0 else 0.25) * k * cross  # (the left tips lie just under the right)
            z = z - (0.35 * k if sx < 0 else 0.0) * cross
            P = np.stack([sx * x, y, z], -1)
            return P
        return fn, H

    def wing_spread(s, sx, H):
        """The same wing opened (the morph target): span down from the shoulder (the actor's roll lifts it out), broad
        rounded owl wing with fingered primaries, faced outward (x)."""
        k, wk = s.k, s.wingk
        span = 33.0 * k * (0.85 + 0.15 * wk)
        chord = 17.0 * k
        sh = s.shoulder(sx)

        def fn(a, b):
            ph = 2 * math.pi * a
            cf = (1 - np.cos(ph)) / 2
            side = np.sin(ph)
            y = -b * span
            zle = 3.2 * k + 2.0 * k * np.sin(math.pi * np.clip(b / 0.6, 0, 1)) - 6.5 * k * ss(0.55, 1.0, b) ** 1.4
            ch = chord * (0.82 + 0.18 * np.sin(math.pi * np.clip(b / 0.7, 0, 1))) * (1 - 0.82 * ss(0.65, 1.0, b) ** 1.6) + 1.2 * k
            z = zle - cf * ch
            # fingered primaries: the trailing edge notched toward the tip
            fing = ss(0.55, 0.9, b) * ss(0.55, 1.0, cf)
            y = y - fing * 2.6 * k * (0.5 + 0.5 * np.cos(b * 9 * math.pi))
            thick = (1.6 * k * (1 - cf) ** 0.6 + 0.2 * k) * (1 - 0.65 * ss(0.5, 1.0, b))
            camber = 1.2 * k * np.sin(math.pi * cf) * (1 - b)
            x = 0.6 * k + camber + thick * (0.5 * side)
            return np.stack([sx * x, y, z], -1) + sh
        return fn

    def shoulder(s, sx):
        k = s.k
        y = s.by1 - 3.4 * k
        z = s.bzc - 0.6 * k
        return V(sx * (float(s.body_x(np.array(y), np.array(z))) - 0.6 * k), y, z)

    def build_wings(s):
        k = s.k
        for nm, sx in (('wing_l', -1), ('wing_r', 1)):
            sh = s.shoulder(sx)
            fn, H = s.wing_folded(sx)
            sp = s.wing_spread(sx, H)
            # (two islands: the outer face a 0..0.5, the inner face 0.5..1; one Surf with a wrapped loop)
            sf = Surf(nm, nm, fn, 48, 40, 2 * 15.0 * k, H, 'wing', wrap=True, spread=sp, share=None if sx < 0 else 'wing_l')
            s.surfs.append(sf)
            s.bone(nm, sh, 'body')
        s.anchors_hold = (s.shoulder(1) + V(1.5 * k, -s.bh * 0.45, 3.0 * k))

    # -------------------------------------------------------------- tail
    def build_tail(s):
        k = s.k
        L, W = 8.6 * k * s.tailk, 9.0 * k * (0.8 + 0.2 * s.tailk)
        root = V(0, s.by0 + 3.6 * k, s.bzc - s.bb * 0.62)
        tip = root + V(0, -L * 0.68, -L * 0.73)

        def fn(a, b):
            ph = 2 * math.pi * a
            cf = (1 - np.cos(ph)) / 2  # 0 .. 1 across the fan (left to right)
            side = np.sin(ph)
            c = root + (tip - root) * b[..., None]
            w = W * (0.35 + 0.65 * b ** 0.7)
            x = (cf - 0.5) * w
            # the fan's end: each rectrix rounded
            endb = b - 0.06 * k * np.abs(np.sin((cf - 0.5) * 6 * math.pi)) * ss(0.85, 1.0, b)
            c = root + (tip - root) * endb[..., None]
            arch = 0.9 * k * (1 - (2 * cf - 1) ** 2)
            th = (0.55 * k * (1 - b) + 0.18 * k)
            up = nrm(np.cross(tip - root, V(1, 0, 0)))
            return c + x[..., None] * V(1, 0, 0) + (arch + th * side)[..., None] * up
        s.surfs.append(Surf('tail', 'tail', fn, 28, 14, 2 * W, L, 'tail', wrap=True))
        s.bone('tail', root, 'body')

    # -------------------------------------------------------------- legs and feet
    def build_legs(s):
        k = s.k
        for nm, sx in (('leg_l', -1), ('leg_r', 1)):
            x = sx * s.legx
            hip = V(x, s.by0 + 4.0 * k, 0.8 * k)
            ank = V(x * 1.02, 1.6 * k, 2.0 * k)
            s.bone(nm, hip, 'root')
            share = None if sx < 0 else None
            mir = sx > 0
            bare = s.toes == 'bare'
            fat = s.legw * (1.35 if s.toes == 'feathered' else 1.0)
            # the feathered trousers: fat under the belly, tapering to the ankle (a bare tarsus on the burrowing owl)
            if bare:
                s.tube(nm + 'k', nm, [hip + V(0, 1.2 * k, 0), hip + V(0, -1.6 * k, 0.4 * k), hip + V(0, -3.6 * k, 0.9 * k)],
                       lambda t: fat * 1.55 * (1 - 0.45 * t), 16, 10, tract='trousers', share=None if sx < 0 else 'leg_lk', mirror=False)
                s.tube(nm, nm, [hip + V(0, -2.8 * k, 0.8 * k), (hip + ank) / 2 + V(0, -1.4 * k, 0.4 * k), ank + V(0, 0.4 * k, 0)],
                       lambda t: s.legw * 0.62 * (1 - 0.2 * t), 10, 12, tract='tarsus', share=None if sx < 0 else 'leg_l', mirror=False)
            else:
                s.tube(nm, nm, [hip + V(0, 1.4 * k, -0.2 * k), (hip + ank) / 2 + V(0, 0, 0.3 * k), ank + V(0, 0.5 * k, 0)],
                       lambda t: fat * (1.5 - 0.62 * t ** 0.8), 16, 12, tract='trousers', share=None if sx < 0 else 'leg_l', mirror=False)
            # toes: owls stand with two toes forward, the outer one turned out, one back; each ends in a hooked talon
            tr = (0.78 if s.toes == 'feathered' else 0.6) * k * (s.legw / (2.0 * k)) ** 0.5
            toes = [(-18, 3.8), (8, 4.1), (52, 3.1), (180, 2.4)]
            for i, (ang, L) in enumerate(toes):
                a = math.radians(ang * -sx)
                d = V(math.sin(a), 0, math.cos(a))
                L = L * k * (s.legw / (2.0 * k)) ** 0.3
                t0 = ank + V(0, -0.35 * k, 0) + d * 0.6 * k
                t1 = t0 + d * L * 0.55 + V(0, -0.15 * k, 0)
                t2 = t0 + d * L + V(0, -0.6 * k + tr * 0.2, 0)
                t2[1] = max(t2[1], tr * 0.75)
                t1[1] = max(t1[1], tr * 0.9)
                s.tube(f'{nm}t{i}', nm, [t0, t1, t2], lambda t, tr=tr: tr * (1.0 - 0.28 * t), 10, 9, tract='toe', share=None if sx < 0 else f'leg_lt{i}')
                # the talon: a hooked claw curling down from the toe's end
                c0 = t2 + d * tr * 0.5 + V(0, 0.1 * k, 0)
                c1 = c0 + d * 0.9 * k + V(0, 0.05 * k, 0)
                c2 = c0 + d * 1.5 * k + V(0, -0.55 * k, 0)
                c3 = c0 + d * 1.6 * k + V(0, -1.05 * k, 0)
                tl = 0.42 * k * (1.1 if i != 3 else 1.2)
                s.tube(f'{nm}c{i}', nm, [c0, c1, c2, c3], lambda t, tl=tl: tl * (1 - t) ** 0.9 + 0.01, 8, 8, squash=(0.8, 1.0), tract='talon',
                       share=None if sx < 0 else f'leg_lc{i}', close1=True)

    # -------------------------------------------------------------- the special skins' own pieces
    def chin(s):
        """The height where the face meets the breast (the bottom of the facial disc, or the kitten's chin)."""
        k = s.k
        if s.cat:
            y_chin = s.ey - 5.4 * k
        else:
            ys = np.linspace(s.ey - 0.5 * k, s.ey - 3 * s.hw, 300)
            dd = s.disc_d(np.zeros_like(ys), ys - s.ey)
            y_chin = float(ys[np.argmax(dd > 0)]) if (dd > 0).any() else s.ey - 1.5 * s.discr * s.hw
        return min(y_chin - 0.4 * k, s.by1 - 2.6 * k)

    def front_at(s, y, x=0.0):
        """The body's front surface point at height y (and across x)."""
        bs = np.linspace(0, 1, 400)
        ys = s.body_sec(bs)[3]
        bq = float(np.interp(y, ys[::-1], bs[::-1]))
        w, f, bk, yy, zc = (float(v) for v in s.body_sec(np.array(bq)))
        r = min(abs(x) / max(w, 1e-3), 0.99)
        return V(x, y, zc + f * (1 - r ** (2 / 0.92)) ** (0.92 / 2))

    def button(s, name, at, r, tract, dome=0.55):
        """A round button sitting on the body's front (gumdrops, coal): a squashed sphere, its back sunk in."""
        k = s.k
        n = nrm(at - V(0, at[1], s.bzc))
        spine = np.array([at - n * r * 0.6, at + n * r * dome * 0.5, at + n * r * dome])
        s.tube(name, 'body', spine, lambda t, r=r: r * np.sin(math.pi * np.clip(t, 0.0, 1.0) * 0.5 + 0.25 * math.pi) ** 0.6 * (1 - t ** 3) + 0.02,
               14, 8, tract=tract, up=(0, 1, 0))
        del k

    def build_skin_extras(s):
        """The special skins' own pieces: the gingerbread owl's gumdrop buttons; the snowman's coal buttons, knitted
        scarf, carrot and twig tufts."""
        k = s.k
        sid = s.id
        if sid in ('gingerbread', 'snowman'):
            for i, f in enumerate((0.7, 0.5, 0.3)):
                y = s.by0 + s.bh * f
                at = s.front_at(y)
                s.button(f'btn{i}', at, (1.15 if sid == 'gingerbread' else 1.0) * k, ('gumdrop' if sid == 'gingerbread' else 'coal') + str(i),
                         dome=0.9 if sid == 'gingerbread' else 0.55)
        if sid == 'snowman':
            # the scarf: a knitted ring round the neck where the head meets the shoulders, one end hanging down the chest
            y0 = s.chin() - 0.2 * k

            def ring(a, b, y0=y0):
                th = 2 * math.pi * a
                bs = np.linspace(0, 1, 400)
                bq = np.interp(y0, s.body_sec(bs)[3][::-1], bs[::-1])
                w, f, bk, yy, zc = (float(v) for v in s.body_sec(np.array(bq)))
                rr = 1.7 * k
                ph = 2 * math.pi * b
                cx = np.sin(th) * (w + 0.4 * k)
                cz = zc + np.where(np.cos(th) > 0, f, bk) * np.cos(th) * 1.0 + np.cos(th) * 0.4 * k
                cy = y0 + 0.35 * k * np.sin(th * 2)
                out = np.stack([cx, cy, cz], -1)
                nx = nrm(np.stack([np.sin(th), np.zeros_like(th), np.cos(th)], -1))
                return out + (np.cos(ph)[..., None] * nx * rr * 0.75 + np.sin(ph)[..., None] * V(0, 1, 0) * rr)
            s.surfs.append(Surf('scarf', 'body', ring, 64, 10, 2 * math.pi * (s.bw + 1.5), 2 * math.pi * 1.7 * k, 'scarf', wrap=True))
            e0 = s.front_at(y0 - 0.8 * k, 3.4 * k) + V(0, 0, 1.2 * k)
            s.tube('scarf_end', 'body', [e0, e0 + V(0.5 * k, -3.6 * k, 0.6 * k), e0 + V(1.0 * k, -7.4 * k, 0.4 * k)],
                   lambda t: 1.6 * k * (1 + 0.15 * t), 12, 10, squash=(1.0, 0.32), tract='scarf', up=(0, 0, 1))
            # twig tufts
            for nm, sx in (('tuft_l', -1), ('tuft_r', 1)):
                b0 = V(sx * s.hw * 0.45, s.hyc + s.hht * 0.72, s.hzc - 0.4 * k)
                s.bone(nm, b0, 'head')
                t1 = b0 + V(sx * 2.4 * k, 7.6 * k, -0.6 * k)
                s.tube(nm + 'a', nm, [b0 - V(0, 1.2 * k, 0), b0 + (t1 - b0) * 0.5 + V(sx * 0.5 * k, 0, 0), t1], lambda t: 0.62 * k * (1 - 0.55 * t) + 0.04,
                       8, 10, tract='twig', share=None if sx < 0 else 'tuft_la')
                m = b0 + (t1 - b0) * 0.55
                s.tube(nm + 'b', nm, [m, m + V(sx * 2.8 * k, 2.2 * k, 0.2 * k)], lambda t: 0.38 * k * (1 - 0.6 * t) + 0.03, 6, 6, tract='twig',
                       share=None if sx < 0 else 'tuft_lb')
                m2 = b0 + (t1 - b0) * 0.82
                s.tube(nm + 'c', nm, [m2, m2 + V(-sx * 1.6 * k, 1.9 * k, 0)], lambda t: 0.3 * k * (1 - 0.6 * t) + 0.03, 6, 6, tract='twig',
                       share=None if sx < 0 else 'tuft_lc')

    # -------------------------------------------------------------- joints and anchors
    def bone(s, name, at, parent):
        s.piv[name] = np.asarray(at, float)
        s.par[name] = parent

    def anchor(s, name, at, bone, scale=(1.0, 1.0, 1.0)):
        s.anchors['anchor_' + name] = (np.asarray(at, float), bone, tuple(float(v) for v in scale))

    def build(s):
        s.build_body()
        s.build_head()
        s.build_tufts()
        s.build_wings()
        s.build_tail()
        s.build_legs()
        if s.skin:
            s.build_skin_extras()
        k = s.k
        # outfit anchors: the pieces were modelled on the v3 tawny toy (a 28.4 mm wide head, a 24 mm body); the
        # anchor's scale fits them to this bird (wider / deeper / taller where it is)
        OH = (28.4, 21.4, 21.0)
        hs = (2 * s.hw / OH[0], (s.hht + s.hhb) / OH[1], (s.hdf + s.hdb) / OH[2])
        s.anchor('head', s.anchor_head, 'head', (hs[0] * 1.03, hs[1] * 1.03, hs[2] * 1.06))
        fs = 2 * s.ex / (2 * 0.222 * 28.4)
        s.anchor('face', s.anchor_face, 'head', (fs * 1.03, fs * 1.03, fs * 1.03))
        # the garments (neck, chest, back) were modelled on the v3 toy's body between its belly (3.76 mm) and its neck
        # line (20.16 mm, where the head met the body): map that span onto this bird's, from its belly to its chin
        yt = s.chin()
        sy = (yt - s.by0) / (20.16 - 3.76)
        Y = lambda yo: s.by0 + (yo - 3.76) * sy  # noqa: E731

        def sec(y):
            bs = np.linspace(0, 1, 400)
            bq = float(np.interp(y, s.body_sec(bs)[3][::-1], bs[::-1]))
            return [float(v) for v in s.body_sec(np.array(bq))]
        w_n, f_n, b_n, _, zc_n = sec(yt)
        s.anchor('neck', (0, yt, zc_n + f_n * 0.55), 'body', (w_n / 10.6, sy, (f_n + b_n) / 18.1))
        yc_ = Y(14.54)
        w_c, f_c, b_c, _, zc_c = sec(yc_)
        bsx = s.bw / 12.0
        bsz = (s.bf + s.bb) / (21.6 * 0.97)
        s.anchor('chest', (0, yc_, zc_c + f_c + 0.2 * k), 'body', (bsx, sy, bsz))
        yb_ = Y(15.91)
        w_b, f_b, b_b, _, zc_b = sec(yb_)
        s.anchor('back', (0, yb_, zc_b - b_b - 0.2 * k), 'body', (bsx, sy, bsz))
        s.anchor('hold', s.anchors_hold, 'wing_r', (1.0, 1.0, 1.0))
        s.y_chin = yt


def _b_at(O, y):
    """The head surface's b (polar) parameter at the front for height y."""
    bs = np.linspace(0.02, 0.98, 400)
    ys = O.head_fn(np.full_like(bs, 0.5), bs)[..., 1]
    return float(np.interp(y, ys[::-1], bs[::-1]))


# ====================================================================== UV atlas
def pack(O, size, dens):
    """Shelf-pack every surface's island (its w x h mm at `dens` texels per mm, a 4 px gutter) into one size x size atlas.
    Shared islands (a mirrored pair) are packed once. Returns the density that fit."""
    while True:
        isl = [sf for sf in O.surfs if not sf.share]
        for sf in isl:
            sf.pw = max(8, int(math.ceil(sf.w * dens * sf.dens)))
            sf.ph = max(8, int(math.ceil(sf.h * dens * sf.dens)))
        order = sorted(isl, key=lambda q: -q.ph)
        x = y = 0
        rowh = 0
        g = 6
        ok = True
        for sf in order:
            if x + sf.pw + g > size:
                x = 0
                y += rowh + g
                rowh = 0
            if y + sf.ph + g > size:
                ok = False
                break
            sf.px, sf.py = x + g // 2, y + g // 2
            x += sf.pw + g
            rowh = max(rowh, sf.ph)
        if ok:
            byname = {sf.name: sf for sf in isl}
            for sf in O.surfs:
                if sf.share:
                    src = byname[sf.share]
                    sf.pw, sf.ph, sf.px, sf.py = src.pw, src.ph, src.px, src.py
            log(f'atlas {size}: {dens:.2f} texels/mm, filled to row {y + rowh}')
            return dens
        dens *= 0.95


# ====================================================================== ambient occlusion
def vertex_ao(O, meshes, rays=40, dist=None):
    """Per-vertex ambient occlusion (a fraction of the sky each vertex sees), ray traced against the parts that move
    with it (Blender's BVH), plus the ground for everything low."""
    import bpy  # noqa: F401  (mathutils)
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    k = O.k
    dist = dist or 7.0 * k
    groups = {
        'body': ('body', 'head', 'leg_l', 'leg_r', 'tail', 'wing_l', 'wing_r', 'ground'),
        'head': ('head', 'body'),
        'wing': ('wing_l', 'wing_r', 'body'),
        'tail': ('tail', 'body', 'ground'),
        'leg': ('leg_l', 'leg_r', 'body', 'ground'),
        'tuft': ('head', 'tuft_l', 'tuft_r'),
    }
    by_joint = {}
    for sf, m in meshes:
        by_joint.setdefault(sf.joint, []).append(m)
    trees = {}

    def tree(names):
        key = tuple(sorted(names))
        if key in trees:
            return trees[key]
        Vs, Fs, off = [], [], 0
        for j in names:
            if j == 'ground':
                g = 60.0
                Vs.append(np.array([(-g, -0.02, -g), (g, -0.02, -g), (g, -0.02, g), (-g, -0.02, g)]))
                Fs.append(np.array([(0, 1, 2), (0, 2, 3)]) + off)
                off += 4
                continue
            for m in by_joint.get(j, []):
                Vs.append(m['P'])
                Fs.append(m['T'] + off)
                off += len(m['P'])
        Vv = np.concatenate(Vs)
        Ff = np.concatenate(Fs)
        t = BVHTree.FromPolygons([tuple(v) for v in Vv], [tuple(int(i) for i in f) for f in Ff], all_triangles=True)
        trees[key] = t
        return t

    rng = np.random.default_rng(3)
    # a fixed set of cosine-weighted directions (rotated per vertex onto its normal)
    u1, u2 = rng.random(rays), rng.random(rays)
    r = np.sqrt(u1)
    th = 2 * math.pi * u2
    H = np.stack([r * np.cos(th), r * np.sin(th), np.sqrt(1 - u1)], 1)
    for sf, m in meshes:
        jn = sf.joint
        grp = 'wing' if jn.startswith('wing') else 'leg' if jn.startswith('leg') else 'tuft' if jn.startswith('tuft') else jn if jn in groups else 'head'
        t = tree(groups[grp])
        P, N = m['P'], m['N']
        ao = np.ones(len(P))
        for i in range(len(P)):
            n = N[i]
            a = np.array([1.0, 0, 0]) if abs(n[0]) < 0.9 else np.array([0, 1.0, 0])
            tu = np.cross(n, a)
            tu /= np.linalg.norm(tu)
            tv = np.cross(n, tu)
            D = H[:, :1] * tu + H[:, 1:2] * tv + H[:, 2:3] * n
            o = Vector(tuple(P[i] + n * 0.06))
            hit = 0
            for d in D:
                if t.ray_cast(o, Vector(tuple(d)), dist)[0] is not None:
                    hit += 1
            ao[i] = 1 - hit / rays
        m['ao'] = ao
    log('vertex ao done')


# ====================================================================== GLB
def glb_write(path, J, BIN):
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


class GLB:
    def __init__(s):
        s.J = {'asset': {'version': '2.0', 'generator': 'hoot-hollow owl.py'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [], 'meshes': [],
               'accessors': [], 'bufferViews': [], 'buffers': [{'byteLength': 0}], 'materials': [], 'textures': [], 'images': [],
               'samplers': [{'magFilter': 9728, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}]}
        s.bin = bytearray()

    def view(s, data, target=None):
        pad = (4 - len(s.bin) % 4) % 4
        s.bin += b'\0' * pad
        v = {'buffer': 0, 'byteOffset': len(s.bin), 'byteLength': len(data)}
        if target:
            v['target'] = target
        s.bin += data
        s.J['bufferViews'].append(v)
        return len(s.J['bufferViews']) - 1

    def acc(s, arr, kind, target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        ct = {np.dtype('float32'): 5126, np.dtype('uint16'): 5123, np.dtype('uint32'): 5125}[arr.dtype]
        a = {'bufferView': s.view(arr.tobytes(), target), 'componentType': ct, 'count': int(arr.shape[0]), 'type': kind}
        if minmax:
            a['min'] = [float(v) for v in arr.min(0)]
            a['max'] = [float(v) for v in arr.max(0)]
        s.J['accessors'].append(a)
        return len(s.J['accessors']) - 1

    def image(s, png_or_webp_bytes, mime='image/webp'):
        s.J['images'].append({'bufferView': s.view(png_or_webp_bytes), 'mimeType': mime})
        i = len(s.J['images']) - 1
        s.J['textures'].append({'sampler': 0, 'extensions': {'EXT_texture_webp': {'source': i}}})
        return len(s.J['textures']) - 1

    def mesh(s, name, P, N, UV, T, mat, dP=None, dN=None):
        idx = T.astype(np.uint16 if len(P) < 65535 else np.uint32).reshape(-1)
        prim = {'attributes': {'POSITION': s.acc(P.astype(np.float32), 'VEC3', 34962, True), 'NORMAL': s.acc(N.astype(np.float32), 'VEC3', 34962),
                               'TEXCOORD_0': s.acc(UV.astype(np.float32), 'VEC2', 34962)},
                'indices': s.acc(idx, 'SCALAR', 34963), 'material': mat}
        m = {'name': name, 'primitives': [prim]}
        if dP is not None:
            prim['targets'] = [{'POSITION': s.acc(dP.astype(np.float32), 'VEC3', 34962, True), 'NORMAL': s.acc(dN.astype(np.float32), 'VEC3', 34962)}]
            m['weights'] = [0.0]
            m['extras'] = {'targetNames': ['spread']}
        s.J['meshes'].append(m)
        return len(s.J['meshes']) - 1

    def node(s, name, t=(0, 0, 0), scale=None, mesh=None):
        n = {'name': name}
        if any(abs(float(v)) > 1e-7 for v in t):
            n['translation'] = [float(v) for v in t]
        if scale is not None and any(abs(float(v) - 1) > 1e-6 for v in scale):
            n['scale'] = [float(v) for v in scale]
        if mesh is not None:
            n['mesh'] = mesh
        s.J['nodes'].append(n)
        return len(s.J['nodes']) - 1

    def child(s, p, c):
        s.J['nodes'][p].setdefault('children', []).append(c)

    def save(s, path):
        s.J['buffers'][0]['byteLength'] = len(s.bin)
        if s.J['images']:
            s.J['extensionsUsed'] = ['EXT_texture_webp']
            s.J['extensionsRequired'] = ['EXT_texture_webp']
        glb_write(path, s.J, bytes(s.bin))


def webp(arr, lossless=False, q=90):
    from PIL import Image
    im = Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8))
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=6, lossless=lossless)
    return b.getvalue()


def png(arr, path):
    from PIL import Image
    Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8)).save(path)


# ====================================================================== eye decals
def eye_decal(O, m_head, sf_head, sx):
    """A patch of the head's own surface round an eye (planar UVs: the game draws the dot in the middle), lifted a hair
    off it, in the eye's frame."""
    k = O.k
    # the eye centre: the head surface at (sx * ex, ey) seen from the front
    a0 = 0.5 + sx * 0.08
    best = None
    for _ in range(3):
        aa, bb = np.meshgrid(np.linspace(a0 - 0.08, a0 + 0.08, 81), np.linspace(0.25, 0.75, 161))
        P = sf_head.eval(aa, bb)
        d = (P[..., 0] - sx * O.ex) ** 2 + (P[..., 1] - O.ey) ** 2
        i = np.unravel_index(np.argmin(d), d.shape)
        best = (aa[i], bb[i])
        a0 = best[0]
    c = sf_head.eval(np.array(best[0]), np.array(best[1]))
    n = sf_head.normals(np.array(best[0]), np.array(best[1]))
    ax = nrm(np.array([n[0] * 0.6, n[1] * 0.4, max(n[2], 0.5)]))
    r = O.er * 2.1
    # a fine grid patch evaluated straight from the surface (smooth, follows the dish)
    up = np.array([0, 1.0, 0])
    u = nrm(np.cross(up, ax))
    v = np.cross(ax, u)
    na = 9
    gu, gv = np.meshgrid(np.linspace(-1, 1, na), np.linspace(-1, 1, na))
    # find (a, b) for each patch point by projecting onto the head (Newton-free: a local linear map from a few probes)
    da = 1e-3
    Pa = sf_head.eval(np.array(best[0] + da), np.array(best[1]))
    Pb = sf_head.eval(np.array(best[0]), np.array(best[1] + da))
    Ja = (Pa - c) / da
    Jb = (Pb - c) / da
    M = np.array([[Ja @ u, Jb @ u], [Ja @ v, Jb @ v]])
    Mi = np.linalg.inv(M)
    pts = []
    for iu, iv in zip(gu.reshape(-1), gv.reshape(-1)):
        target = np.array([iu * r, iv * r])
        dab = Mi @ target
        aa, bb = best[0] + dab[0], best[1] + dab[1]
        for _ in range(3):  # refine
            p = sf_head.eval(np.array(aa), np.array(bb))
            e = np.array([(p - c) @ u, (p - c) @ v]) - target
            dab = Mi @ e
            aa, bb = aa - dab[0], bb - dab[1]
        p = sf_head.eval(np.array(aa), np.array(bb))
        nn = sf_head.normals(np.array(aa), np.array(bb))
        pts.append(p + nn * 0.05 * k)
    P = np.array(pts)
    UV = np.stack([(gu.reshape(-1) + 1) / 2, 1 - (gv.reshape(-1) + 1) / 2], 1)  # (v runs down the patch: the canvas is drawn flipY=false)
    idx = np.arange(na * na).reshape(na, na)
    q0, q1, q2, q3 = idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]
    T = np.concatenate([np.stack([q0, q1, q2], -1).reshape(-1, 3), np.stack([q0, q2, q3], -1).reshape(-1, 3)])
    fn_ = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
    bad = (fn_ @ ax) < 0
    T[bad] = T[bad][:, [0, 2, 1]]
    N = np.tile(ax, (len(P), 1))
    return c, ax, P - c, N, UV, T


# ====================================================================== build one owl
def build(mid):
    import plume
    spec = specs.get(mid)
    O = Owl(spec)
    O.build()
    size = int(FLAGS.get('--size', 2048))
    dens = pack(O, size, float(spec['shape'].get('dens', 17.0)) * (size / 2048))
    meshes = [(sf, mesh_of(sf)) for sf in O.surfs]
    log(mid, 'surfaces', len(meshes), 'verts', sum(len(m['P']) for _, m in meshes), 'tris', sum(len(m['T']) for _, m in meshes))
    if '--quick' in FLAGS:
        for _, m in meshes:
            m['ao'] = np.ones(len(m['P']))
    else:
        vertex_ao(O, meshes)
    # ---- paint every island
    rgb = np.zeros((size, size, 3), np.float32)
    hgt = np.zeros((size, size), np.float32)
    rough = np.full((size, size), 0.86, np.float32)
    fur = np.zeros((size, size), np.float32)
    emit = np.zeros((size, size, 3), np.float32) if spec.get('emissive') else None
    done = set()
    P = plume.Painter(O, spec)
    for sf, m in meshes:
        if sf.share or sf.name in done:
            continue
        done.add(sf.name)
        out = P.island(sf, m)
        g = plume.MARGIN
        y0, x0 = sf.py - g, sf.px - g
        hh, ww = out['rgb'].shape[:2]
        ys, xs = slice(max(0, y0), min(size, y0 + hh)), slice(max(0, x0), min(size, x0 + ww))
        oy, ox = ys.start - y0, xs.start - x0
        sl = (slice(oy, oy + ys.stop - ys.start), slice(ox, ox + xs.stop - xs.start))
        rgb[ys, xs] = out['rgb'][sl]
        hgt[ys, xs] = out['h'][sl]
        rough[ys, xs] = out['rough'][sl]
        fur[ys, xs] = out['fur'][sl]
        if emit is not None and 'emit' in out:
            emit[ys, xs] = out['emit'][sl]
    log('painted')
    # ---- the normal map from the feathers' relief (glTF: +x along u, +y toward the image top)
    nmap = plume.normal_map(hgt, strength=float(spec.get('relief', 1.0)))
    # ---- the GLB
    G = GLB()
    G.J['materials'].append({'name': 'owl_' + mid, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0,
                             'roughnessFactor': 1.0, 'metallicRoughnessTexture': {'index': 2}},
                             'normalTexture': {'index': 1, 'scale': 1.0}})
    if emit is not None:
        G.J['materials'][0]['emissiveTexture'] = {'index': 3}
        G.J['materials'][0]['emissiveFactor'] = [1.0, 1.0, 1.0]
    G.J['materials'].append({'name': 'eye_decal', 'pbrMetallicRoughness': {'baseColorFactor': [0.1, 0.08, 0.07, 1], 'metallicFactor': 0.0, 'roughnessFactor': 0.3}})
    q = int(FLAGS.get('--q', 88))
    G.image(webp(rgb, q=q))
    nm_small = plume.downsample(nmap, 2)
    G.image(webp(nm_small * 0.5 + 0.5, q=92))
    mr = np.zeros((size // 4, size // 4, 3), np.float32)
    mr[..., 1] = plume.downsample(rough[..., None], 4)[..., 0]
    mr[..., 0] = plume.downsample(fur[..., None], 4)[..., 0]  # (red: the fur shells' length, src/owl/fur.ts)
    G.image(webp(mr, q=90))
    if emit is not None:
        G.image(webp(plume.downsample(emit, 2), q=90))
    os.makedirs(BUILD, exist_ok=True)
    png(rgb, os.path.join(BUILD, mid + '_col.png'))
    png(nmap * 0.5 + 0.5, os.path.join(BUILD, mid + '_nrm.png'))
    # nodes: the joints in their parents' frames, each part's mesh in its joint's frame
    joints = ['root'] + [b for b in O.piv if b != 'root']
    nid = {}
    for b in joints:
        par = O.par.get(b)
        t = O.piv[b] - (O.piv[par] if par else 0)
        nid[b] = G.node(b, t)
    for b in joints:
        if b != 'root':
            G.child(nid[O.par[b]], nid[b])
    allP = []
    tris = 0
    for sf, m in meshes:
        piv = O.piv[sf.joint]
        uv = np.stack([(sf.px + m['A'] * sf.pw) / size, (sf.py + m['B'] * sf.ph) / size], 1)
        mi = G.mesh(sf.name, m['P'] - piv, m['N'], uv, m['T'], 0, m.get('dP'), m.get('dN'))
        G.child(nid[sf.joint], G.node(sf.name + '_mesh', (0, 0, 0), mesh=mi))
        allP.append(m['P'])
        tris += len(m['T'])
    # the eye decals
    sfh, mh = next((sf, m) for sf, m in meshes if sf.name == 'head')
    eyes = {}
    for nm, sx in (('eye_l', -1), ('eye_r', 1)):
        c, ax, Pp, Nn, UV, T = eye_decal(O, mh, sfh, sx)
        mi = G.mesh(nm, Pp, Nn, UV, T, 1)
        G.child(nid['head'], G.node(nm, c - O.piv['head'], mesh=mi))
        eyes[nm] = (c, ax)
    # anchors
    for nm, (at, b, sc) in O.anchors.items():
        G.child(nid[b], G.node(nm, at - O.piv[b], scale=sc))
    os.makedirs(OUT_GLB, exist_ok=True)
    dst = os.path.join(OUT_GLB, mid + '.glb')
    G.save(dst)
    log('exported', dst, f'{os.path.getsize(dst) / 1e6:.2f} MB', tris, 'tris')
    # ---- the rig sheet (game frame already)
    Pall = np.concatenate(allP)
    R = lambda p: [round(float(v), 3) for v in p]  # noqa: E731
    meta = {
        'id': mid, 'tris': int(tris),
        'pivots': {b: R(O.piv[b]) for b in joints},
        'parents': {b: O.par[b] for b in joints if b != 'root'},
        'anchors': {nm: {'at': R(at), 'bone': b, 'scale': round(sc[0], 4)} for nm, (at, b, sc) in O.anchors.items()},
        'eyes': {nm: {'at': R(c), 'axis': R(ax), 'r': round(O.er, 3), 'patch': round(O.er * 2.1, 3)} for nm, (c, ax) in eyes.items()},
        'min': R(Pall.min(0)), 'max': R(Pall.max(0)),
        'height': round(float(Pall[:, 1].max()), 3),
        'dims': {'bodyZ0': round(O.by0, 3), 'bodyZ1': round(O.by1, 3), 'bodyW': round(2 * O.bw, 3), 'bodyD': round(O.bf + O.bb, 3),
                 'headZ': round(O.hyc, 3), 'headW': round(2 * O.hw, 3), 'headH': round(O.hht + O.hhb, 3), 'headD': round(O.hdf + O.hdb, 3),
                 'faceY': round(O.face_z, 3), 'eyeX': round(O.ex, 3), 'eyeZ': round(O.ey, 3), 'tuftTop': round(float(Pall[:, 1].max()), 3),
                 'chin': round(O.chin(), 3)},
    }
    json.dump(meta, open(os.path.join(BUILD, mid + '.rig.json'), 'w'), indent=1)
    return dst


if __name__ == '__main__':
    ids = specs.ALL if ARGS and ARGS[0] == 'all' else ARGS
    for i in ids:
        build(i)
