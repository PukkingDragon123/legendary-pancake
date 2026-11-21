"""Hoot Hollow's owls: hand-painted faceted gashapon toys (the Gacha Garage toy line's style, art/blender/lib).

    ~/.cache/gg-bpy/bin/python art/blender/owls/owl.py <id> [--preview] [--fast] [--repaint]
    ids: the species (tawny barn snowy burrowing sawwhet little horned longeared greatgrey eagle), the skins
    (gingerbread snowman celestial meowl) and queen.  'all' builds every one.

A chunky mascot owl modelled from lofts (a round egg of a body, a big bun of a head with a dished facial disc, folded
wings hugging the flanks with scalloped feather tips, a little fan tail, short feathered legs with toes and talons, ear
tufts where the species has them), faceted by lib/facet.py (~1500-1900 tris), baked and painted as brushwork on one
2048 px atlas (feather strokes that follow the form, species markings as strokes and dabs, lit facet rims, rubbed
wear, stippled blush). No eyes are painted: the game draws simple ink-dot eyes on two decal patches cut from the head
(eye_l / eye_r), so Pip can blink and smile.

Export: a rigid-part hierarchy (no skin): root > body > head > tuft_l/r, jaw, brow_l/r, eye decals, anchors ...; each
part's mesh sits in its joint's frame, so the game turns joints directly (src/owl/actor.ts). Writes
public/models/owls/<id>.glb (WebP atlas) and art/blender/_build/owls/<id>.rig.json (pivots, anchors, eyes: the game's
src/owl/rig.gen.ts is made from these by art/blender/owls/rigdata.py).
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, '..', 'lib'), HERE]
os.environ.setdefault('GG_FACET', '1')
import numpy as np  # noqa: E402

import tk  # noqa: E402  (imports bpy first)
import bpy  # noqa: E402
import facet  # noqa: E402
from fig import Fig  # noqa: E402
from _bz import Build, low, V3  # noqa: E402
import specs  # noqa: E402

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
FLAGS = [a for a in sys.argv[1:] if a.startswith('--')]
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT_GLB = os.path.join(ROOT, 'public', 'models', 'owls')

facet.TRIS = (1100, 1900, 1950)  # (owls are detailed figures: ~1500-1900 tris, art direction)


def sstep(e0, e1, x):
    return tk.smoothstep(e0, e1, x)


def lowx(cage, name, tris, lo=1, hi=3, sculpt=None, coarse=None, region=None):
    """_bz.low with a coarse sculpt also pressed into the game mesh before it is faceted (a dished facial disc, a
    raised ruff: forms the facets must show, not only the bake)."""
    if facet.ON:
        lo = min(lo + 1, hi)
    high = tk.copy(cage, name + '_hi')
    tk.subsurf(high, hi)
    if coarse:
        coarse(high)
    if sculpt:
        sculpt(high)
    if region:
        tk.set_region(high, region) if isinstance(region, str) else tk.regions(high, region[0], region[1])
    low_ = cage
    low_.name = low_.data.name = name
    tk.subsurf(low_, lo)
    if coarse:
        coarse(low_)
    tk.decimate(low_, tris)
    return low_, high


# ====================================================================== the figure
class Owl:
    def __init__(s, spec):
        s.S = spec
        s.id = spec['id']
        sh = dict(spec['shape'])
        g = lambda k, d: sh.get(k, d)  # noqa: E731
        s.k = k = g('k', 1.0)
        s.queen = g('queen', False)
        s.cat = g('cat', False)
        # ---- the body: an egg on short legs
        s.leg = g('leg', 1.6) * k
        s.bw = 24.0 * k * g('bw', 1.0)
        s.bh = 19.6 * k * g('bh', 1.0)
        s.bd = 21.6 * k * g('bd', 1.0)
        s.breast = g('breast', 1.4) * k
        s.bz0 = 2.4 * k + s.leg * 0.85
        s.bz1 = s.bz0 + s.bh
        # ---- the head: a big bun, wider than the body (a capsule toy's proportions)
        s.hw = 28.4 * k * g('hw', 1.0)
        s.hh = 21.4 * k * g('hh', 1.0)
        s.hd = 21.0 * k * g('hd', 1.0)
        s.flat = g('flat', 0.15)
        s.hz = s.bz1 + s.hh * 0.16       # the head's centre (it sinks into the shoulders: no neck)
        s.hy = -0.8 * k
        s.yF = s.hy - s.hd * 0.47       # the face's front plane
        s.disc = g('disc', 'lobes')
        s.discr = g('discr', 0.215)
        s.ex = g('ex', 0.222) * s.hw
        s.ez = s.hz + g('ez', 0.05) * s.hh
        s.er = g('er', 1.85) * k
        s.beak = g('beak', 1.0) * k
        s.tufts = g('tufts', None)
        s.toes = g('toes', 'feathered')
        s.legw = g('legw', 2.2) * k
        s.legx = g('legx', 5.0) * k
        s.tailk = g('tail', 1.0)
        s.wingk = g('wing', 1.0)
        s.B = Build()
        s.piv = {'root': (0, 0, 0)}
        s.par = {}
        s.anchors = {}

    # -------------------------------------------------------------- body cross-sections
    def body_rings(s):
        zs = [0.0, 0.1, 0.27, 0.45, 0.63, 0.8, 0.93, 1.0]
        wf = [0.5, 0.82, 0.97, 1.0, 0.98, 0.92, 0.8, 0.62]
        ff = [0.46, 0.8, 0.96, 1.0, 1.0, 0.9, 0.74, 0.56]
        bf = [0.46, 0.8, 0.95, 1.0, 0.98, 0.92, 0.8, 0.6]
        R = []
        for z, w, f, b in zip(zs, wf, ff, bf):
            br = s.breast * math.exp(-((z - 0.5) / 0.2) ** 2)
            R.append(dict(c=(0, -0.3 * s.k - br * 0.5, s.bz0 + z * s.bh), w=s.bw * w, ht=s.bd * 0.5 * f + br * 0.5, hb=s.bd * 0.47 * b, e=2.15))
        return R

    def body_at(s, z):
        """(half width, front depth, back depth, centre y) of the body at height z."""
        R = s.body_rings()
        zz = [r['c'][2] for r in R]
        return (np.interp(z, zz, [r['w'] / 2 for r in R]), np.interp(z, zz, [r['ht'] for r in R]),
                np.interp(z, zz, [r['hb'] for r in R]), np.interp(z, zz, [r['c'][1] for r in R]))

    def body_x(s, z, y, e=2.15):
        """The body's half width at height z and depth y (the superellipse section)."""
        hw, ft, bk, yc = s.body_at(z)
        dy = y - yc
        dep = np.where(dy < 0, ft, bk)
        r = np.clip(np.abs(dy) / dep, 0, 0.97)
        return hw * (1 - r ** e) ** (1 / e)

    # -------------------------------------------------------------- pieces
    def build_body(s):
        k = s.k
        R = s.body_rings()

        def sc(h):
            def f(V, N):
                # rows of soft overlapping feathers (each row's lower edge stands proud), all round
                row = np.floor((V[:, 2] - s.bz0) / (2.8 * k))
                a = np.arctan2(V[:, 0], -(V[:, 1] + 0.3 * k)) * s.bw * 0.5
                u = a / (3.2 * k) + 0.5 * np.mod(row, 2)
                fu = np.mod(u, 1.0) - 0.5
                fv = np.mod((V[:, 2] - s.bz0) / (2.8 * k), 1.0)
                sc_ = (1 - (2 * fu) ** 2) * (1 - fv) ** 2
                d = 0.16 * sc_ * (V[:, 2] < s.bz1 - 2) * (V[:, 2] > s.bz0 + 1.5)
                # the breast: a gentle bulge
                d += 0.3 * tk.smoothstep(-0.3, -0.8, N[:, 1]) * np.exp(-((V[:, 2] - (s.bz0 + s.bh * 0.5)) / (s.bh * 0.3)) ** 2)
                return d
            tk.push(h, f)

        bz0, bz1 = s.bz0, s.bz1

        def belly(C, N):
            zf = (C[:, 2] - bz0) / (bz1 - bz0)
            half = s.bw * (0.2 + 0.16 * np.sin(np.clip(zf, 0, 1) * math.pi))
            return (N[:, 1] < -0.15) & (np.abs(C[:, 0]) < half) & (zf < 0.97)

        o = tk.loft('body', R, n=18, up=(0, -1, 0), cap0='round', cap1='round', capd=1.6 * k)
        s.B.add('body', low(o, 'body', 420, lo=1, hi=3, sculpt=sc, region=('back', [('belly', belly)])))
        s.bone('body', (0, -0.3 * k, s.bz0 + 3.0 * k), 'root')

    def disc_d(s, X, Z):
        """Signed distance (mm, < 0 inside) to the facial disc's outline, in the face plane (x, z)."""
        ex, ez, hw = s.ex, s.ez, s.hw
        dx = np.abs(X)
        if s.disc == 'heart':
            # a barn owl's heart: two lobes over the eyes running down to a point under the beak
            r = s.discr * hw * 0.52
            d1 = np.hypot(dx - ex * 0.9, (Z - ez - r * 0.12) / 1.05) - r
            tip = ez - r * 2.05
            t = np.clip((Z - tip) / (ez - tip), 0, 1)
            half = t ** 0.75 * (ex * 0.9 + r * 0.98)
            d2 = (dx - half) * 0.9
            d = np.where((Z < ez) & (Z > tip), np.minimum(d1, d2), d1)
            return np.maximum(d, Z - (ez + r * 1.02))
        if s.disc == 'round':
            r = s.discr * hw
            return np.hypot(X, (Z - ez + r * 0.18) / 0.97) - r
        r = s.discr * hw
        d1 = np.hypot(dx - ex, (Z - ez) / 0.98) - r
        d2 = np.hypot(X / 0.9, Z - (ez - r * 0.75)) - r * 0.95
        return np.maximum(np.minimum(d1, d2), Z - (ez + r * 0.9))

    def head_rings(s):
        hw, hh, hd, hy, hz = s.hw, s.hh, s.hd, s.hy, s.hz
        e0 = 2.05 + s.flat * 1.2
        # (y along the head front to back, the sections' width along x, ht up / hb down)
        rows = [(-0.44, 0.84, 0.42, 0.38, e0 + 0.1, -0.03), (-0.33, 0.97, 0.5, 0.45, e0, -0.01), (-0.1, 1.0, 0.55, 0.48, e0 - 0.1, 0.0),
                (0.2, 0.92, 0.52, 0.46, e0 - 0.2, 0.0), (0.42, 0.56, 0.32, 0.3, e0 - 0.3, 0.01)]
        return [dict(c=(0, hy + yf * hd, hz + dz * hh), w=hw * wf, ht=hh * ht * (1 - 0.06 * s.flat), hb=hh * hb, e=e) for yf, wf, ht, hb, e, dz in rows]

    def build_head(s):
        k = s.k
        R = s.head_rings()
        yF = s.yF

        def sc(h):
            def f(V, N):
                front = tk.smoothstep(-0.2, -0.65, N[:, 1])
                dd = s.disc_d(V[:, 0], V[:, 2])
                inside = tk.smoothstep(0.3, -1.6, dd)
                # the dish: two shallow bowls round the eyes, the ruff standing proud round the rim
                bowl = sum(np.exp(-((V[:, 0] - sx * s.ex) ** 2 + (V[:, 2] - s.ez) ** 2) / (2 * (s.discr * s.hw * 0.6) ** 2)) for sx in (1, -1))
                d = front * (-1.3 * k * inside * np.clip(bowl, 0, 1))
                d += front * 0.85 * k * np.exp(-((dd - 0.4 * k) / (0.9 * k)) ** 2)
                # the ridge of feathers down between the eyes to the bill
                d += front * 0.45 * k * np.exp(-(V[:, 0] / (1.2 * k)) ** 2) * tk.smoothstep(s.ez - 4 * k, s.ez + 1 * k, V[:, 2]) * (V[:, 2] < s.ez + 4 * k)
                return d
            tk.push(h, f)

        def fine(h):
            def f(V, N):  # crown feathers: soft rows over the top and back
                front = tk.smoothstep(-0.2, -0.65, N[:, 1])
                row = np.mod((V[:, 1] * 0.6 - V[:, 2] * 0.8) / (2.2 * k), 1.0)
                return 0.14 * (1 - front) * (1 - row) ** 2
            tk.push(h, f)

        def disc(C, N):
            return (N[:, 1] < -0.3) & (s.disc_d(C[:, 0], C[:, 2]) < 0)

        def ruff(C, N):
            dd = s.disc_d(C[:, 0], C[:, 2])
            return (N[:, 1] < -0.05) & (dd >= 0) & (dd < 1.5 * k)

        def chin(C, N):
            return (N[:, 1] < -0.2) & (C[:, 2] < s.hz - s.hh * 0.3)

        rules = [('ruff', ruff), ('disc', disc)]
        if s.cat:
            rules = [('muzzle', lambda C, N: (N[:, 1] < -0.35) & (np.hypot(C[:, 0] / 1.25, C[:, 2] - (s.ez - 3.2 * k)) < 5.2 * k))]
        o = tk.loft('head', R, n=18, up=(0, 0, 1), cap0='round', cap1='round', capd=2.0 * k)
        s.B.add('head', lowx(o, 'head', 470, lo=1, hi=3, sculpt=fine, coarse=None if s.cat else sc, region=('crown', rules)))
        s.bone('head', (0, s.hy + s.hd * 0.05, s.bz1 - 2.5 * k), 'body')
        # ---- the beak: a little hooked bill, its waxy cere, the lower mandible on its own joint
        bk = s.beak
        if s.cat:
            nose = tk.lathe('nose', [(0, -0.9), (1.0, -0.7), (1.25, 0.0), (0.9, 0.6), (0, 0.8)], n=8)
            tk.scale(nose, (1.25, 0.7, 0.85))
            tk.move(nose, (0, yF - 0.25 * k, s.ez - 3.1 * k))
            s.B.add('head', low(nose, 'nose', 30, region='nose'))
            s.bone('jaw', (0, yF + 0.6 * k, s.ez - 5.2 * k), 'head')
            jw = tk.tube('jaw', [(0, yF + 0.6 * k, s.ez - 5.0 * k), (0, yF - 0.2 * k, s.ez - 5.6 * k)], [1.3 * k, 0.9 * k], n=8, squash=0.55)
            s.B.add('jaw', low(jw, 'jaw', 24, region='gape'))
        else:
            by = s.ez - 2.2 * k
            pts = [(0, yF + 1.6 * bk, by + 0.6 * bk), (0, yF - 0.6 * bk, by - 0.2 * bk), (0, yF - 1.3 * bk, by - 1.7 * bk), (0, yF - 0.9 * bk, by - 3.0 * bk)]
            o = tk.tube('beak', pts, [1.6 * bk, 1.2 * bk, 0.7 * bk, 0.1], n=8, cap1='point', squash=1.1)
            s.B.add('head', low(o, 'beak', 44, region='beak'))
            cere = tk.tube('cere', [(0, yF + 1.4 * bk, by + 1.0 * bk), (0, yF - 0.5 * bk, by + 0.45 * bk)], [1.9 * bk, 1.55 * bk], n=8, squash=0.7)
            s.B.add('head', low(cere, 'cere', 24, region='cere'))
            jp = (0, yF + 0.8 * bk, by - 1.6 * bk)
            jw = tk.tube('jaw', [jp, (0, yF - 0.9 * bk, by - 2.4 * bk)], [1.15 * bk, 0.35 * bk], n=7, cap1='point', squash=0.6)
            s.B.add('jaw', low(jw, 'jaw', 20, region='gape'))
            s.bone('jaw', jp, 'head')
        s.anchor('face', (0, yF - 0.6 * k, s.ez + 0.6 * k), 'head', s.hw / 27.5)
        s.anchor('head', (0, s.hy + 0.6 * k, s.hz + s.hh * 0.5 * (1 - 0.06 * s.flat) - 0.6 * k), 'head', s.hw / 27.5)
        for nm, sx in (('brow_l', -1), ('brow_r', 1)):
            s.bone(nm, (sx * s.ex, yF - 0.3 * k, s.ez + s.er * 1.6), 'head')

    def build_tufts(s):
        k = s.k
        if s.cat:  # a kitten's pointed ears on the tuft joints
            for nm, sx in (('tuft_l', -1), ('tuft_r', 1)):
                b0 = V3(sx * s.hw * 0.29, s.hy + 0.4 * k, s.hz + s.hh * 0.38)
                tip = b0 + V3(sx * 3.2 * k, 0.6 * k, 7.6 * k)
                m = b0 + (tip - b0) * 0.45
                o = tk.loft(nm, [{'c': tuple(b0), 'w': 9.0 * k, 'h': 1.9 * k}, {'c': tuple(m), 'w': 6.8 * k, 'h': 1.5 * k},
                                 {'c': tuple(tip), 'w': 0.9 * k, 'h': 0.5 * k}], n=8, up=(0, -1, 0), cap0='round', cap1='point')
                s.B.add(nm, low(o, nm, 44, region=('ear', [('earin', lambda C, N: N[:, 1] < -0.5)])))
                s.bone(nm, tuple(b0), 'head')
            return
        t = s.tufts
        if not t:
            return
        L, W = t['len'] * k, t['w'] * k
        for nm, sx in (('tuft_l', -1), ('tuft_r', 1)):
            b0 = V3(sx * s.hw * t['x'], s.hy + t.get('back', 0) * k, s.hz + s.hh * 0.36)
            ang = math.radians(t['lean'])
            tip = b0 + V3(sx * math.sin(ang) * L, 1.0 * k, math.cos(ang) * L)
            pieces = []
            for i, (f, wk, dy, da) in enumerate(((1.0, 1.0, 0.0, 0.0), (0.72, 0.7, 0.9, 12.0), (0.6, 0.62, -0.6, -10.0))):
                a2 = ang + math.radians(da) * sx
                tp = b0 + V3(sx * math.sin(a2) * L * f, (1.0 + dy) * k, math.cos(a2) * L * f)
                m = b0 + (tp - b0) * 0.45
                o = tk.loft(f'{nm}{i}', [{'c': tuple(b0 + V3(0, dy * k, 0)), 'w': W * wk, 'h': 1.2 * k}, {'c': tuple(m), 'w': W * wk * 0.72, 'h': 0.9 * k},
                                         {'c': tuple(tp), 'w': W * 0.08, 'h': 0.3 * k}], n=8, up=(0, -1, 0), cap0='round', cap1='point')
                pieces.append(low(o, nm, 30 if i == 0 else 18, region='tuft'))
            s.B.add(nm, *pieces)
            s.bone(nm, tuple(b0), 'head')

    def build_wings(s):
        k, wk = s.k, s.wingk
        z0, z1, bh = s.bz0, s.bz1, s.bh
        hw, ft, bk, yc = s.body_at(z0 + bh * 0.45)
        F, Bk = -ft * 0.74, bk * 1.05
        Z = lambda f: z0 + f * bh  # noqa: E731
        tipz = z0 - 1.6 * k * wk
        # the outline seen from the side (y, z): rounded shoulder, the wrist low at the front, scalloped tips behind
        pts = [(F * 0.35, Z(0.93)), (F * 0.85, Z(0.75)), (F * 1.0, Z(0.5)), (F * 0.85, Z(0.25)), (F * 0.35, Z(0.1)),
               (0.0, Z(0.04)), (Bk * 0.12, Z(0.1)), (Bk * 0.24, Z(0.0)), (Bk * 0.36, Z(0.07)), (Bk * 0.52, tipz + 0.9 * k),
               (Bk * 0.62, Z(0.03)), (Bk * 0.82, tipz), (Bk * 0.95 + 1.2 * k * wk, tipz + 0.4 * k), (Bk * 1.0 + 0.8 * k * wk, Z(0.2)),
               (Bk * 0.94, Z(0.45)), (Bk * 0.78, Z(0.72)), (Bk * 0.45, Z(0.9)), (0.0, Z(0.97))]
        for nm, sx in (('wing_l', -1), ('wing_r', 1)):
            w = tk.slab(nm, pts, 2.8 * k, plane='YZ', at=0.0, bevel=0.95 * k, segs=1)
            tk.subsurf(w, 1)

            def hug(V, sx=sx):
                V = V.copy()
                t = V[:, 0]
                xb = s.body_x(V[:, 2], V[:, 1])
                bulge = 1.5 * k * np.exp(-((V[:, 2] - Z(0.5)) / (bh * 0.32)) ** 2) * np.exp(-((V[:, 1] - Bk * 0.2) / (Bk * 0.9)) ** 2)
                fe = tk.smoothstep(F, F + 5.0 * k, V[:, 1]) * tk.smoothstep(Z(1.0), Z(0.8), V[:, 2])
                V[:, 0] = sx * (xb + (0.25 + 0.5 * fe) * k + bulge * fe + t * (0.35 + 0.5 * fe))
                V[:, 0] += sx * 0.7 * k * tk.smoothstep(Z(0.3), Z(0.0), V[:, 2])  # the tips stand off the belly a little
                return V
            tk.deform(w, hug)
            tk.fix_normals(w)

            def sc(h, sx=sx):
                def f(V, N):
                    out = np.abs(N[:, 0]) > 0.45
                    # long flight feathers: grooves running down and back; the covert line across the shoulder
                    u = V[:, 1] * 0.75 + V[:, 2] * 0.5
                    g = -0.24 * k * (np.abs(np.sin(u * math.pi / (2.3 * k))) ** 6) * (V[:, 2] < Z(0.55)) * out
                    cov = 0.3 * k * np.exp(-((V[:, 2] - (Z(0.62) - 0.22 * V[:, 1])) / (0.55 * k)) ** 2) * out
                    cov2 = 0.22 * k * np.exp(-((V[:, 2] - (Z(0.78) - 0.2 * V[:, 1])) / (0.5 * k)) ** 2) * out
                    return g + cov + cov2
                tk.push(h, f)

            def reg(C, N, sx=sx):
                return (np.abs(N[:, 0]) > 0.3) & (C[:, 2] > Z(0.6) - 0.22 * C[:, 1])

            s.B.add(nm, low(w, nm, 150, lo=1, hi=2, sculpt=sc, region=('wing', [('covert', reg)])))
            sh = (sx * (s.body_x(Z(0.86), 0.5 * k) + 0.4 * k), 0.5 * k, Z(0.86))
            s.bone(nm, sh, 'body')

    def build_tail(s):
        k = s.k
        L, W = 7.5 * k * s.tailk, 11.0 * k * (0.8 + 0.2 * s.tailk)
        pts = [(-W * 0.24, 0), (W * 0.24, 0), (W * 0.42, L * 0.62), (W * 0.5, L * 0.92), (W * 0.33, L * 0.86), (W * 0.2, L * 1.02),
               (0.0, L * 0.9), (-W * 0.2, L * 1.02), (-W * 0.33, L * 0.86), (-W * 0.5, L * 0.92), (-W * 0.42, L * 0.62)]
        o = tk.slab('tail', pts, 1.7 * k, plane='XY', at=0.0, bevel=0.6 * k, segs=1)
        tk.subsurf(o, 1)
        hw, ft, bk, yc = s.body_at(s.bz0 + 3.0 * k)
        root = (0, yc + bk * 0.86, s.bz0 + 4.2 * k)
        tk.rotate(o, -24, 'X')
        tk.move(o, root)

        def sc(h):
            def f(V, N):  # the tail feathers' shafts and edges
                return -0.16 * k * (np.abs(np.mod(V[:, 0] + W * 0.1, W * 0.2) - W * 0.1) < 0.2 * k)
            tk.push(h, f)
        s.B.add('tail', low(o, 'tail', 70, lo=1, hi=2, sculpt=sc, region='tail'))
        s.bone('tail', root, 'body')

    def build_legs(s):
        k = s.k
        for nm, sx in (('leg_l', -1), ('leg_r', 1)):
            x = sx * s.legx
            hip = V3(x, -1.0 * k, s.bz0 + 2.6 * k)
            ank = V3(x, -1.8 * k, 1.5 * k)
            P = []
            if s.toes == 'bare' or s.leg > 3:
                # a long bare tarsus under feathered 'trousers'
                P.append(low(tk.tube(nm, [tuple(hip + V3(0, 0, 0.6 * k)), tuple(V3(x, -1.4 * k, s.bz0 - 0.4 * k))], [s.legw * 2.2, s.legw * 1.6], n=10),
                             nm + 'k', 60, region='knicker'))
                P.append(low(tk.tube(nm + 's', [tuple(V3(x, -1.4 * k, s.bz0)), tuple(ank)], [s.legw, s.legw * 0.85], n=8), nm + 's', 30, region='leg'))
            else:
                P.append(low(tk.tube(nm, [tuple(hip), tuple(ank + V3(0, 0, 0.6 * k))], [s.legw * 1.25, s.legw], n=10, squash=1.0), nm, 50,
                             region='leg'))
            fluffy = s.toes == 'feathered'
            tr = (1.25 if fluffy else 0.95) * k
            for i, a in enumerate((-28, 0, 28)):
                d = V3(math.sin(math.radians(a * sx * -1)) * sx * -1, -math.cos(math.radians(a)), 0)
                d = V3(math.sin(math.radians(a)), -math.cos(math.radians(a)), 0)
                L = (4.4 if i == 1 else 3.8) * k
                t0 = ank + V3(0, -0.4 * k, -0.4 * k)
                t1 = t0 + d * L + V3(0, 0, -0.35 * k)
                toe = tk.tube(f'{nm}t{i}', [tuple(t0), tuple(t0 + d * L * 0.55 + V3(0, 0, 0.25 * k)), tuple(t1)], [tr, tr * 0.92, tr * 0.72], n=7, squash=0.8)
                tk.move(toe, (0, 0, 0.5))  # (built off the floor: the collapse's footprint guard would keep every vertex)
                a_, b_ = low(toe, f'{nm}t{i}', 28, region='toe')
                for o in (a_, b_):
                    tk.move(o, (0, 0, -0.5))
                    tk.flat_bottom(o, 0.25)
                P.append((a_, b_))
                cl = tk.tube(f'{nm}c{i}', [tuple(t1 + d * tr * 0.5 + V3(0, 0, 0.1 * k)), tuple(t1 + d * (tr * 0.5 + 1.0 * k) + V3(0, 0, -0.2 * k)),
                                           tuple(t1 + d * (tr * 0.5 + 1.5 * k) + V3(0, 0, -0.75 * k))], [0.5 * k, 0.34 * k, 0.05], n=6, cap1='point')
                P.append(low(cl, f'{nm}c{i}', 14, region='talon'))
            bt = tk.tube(f'{nm}b', [tuple(ank + V3(0, 0.2 * k, -0.6 * k)), tuple(ank + V3(0, 2.6 * k, -0.9 * k))], [tr * 0.85, tr * 0.6], n=6, squash=0.8)
            tk.move(bt, (0, 0, 0.5))
            a_, b_ = low(bt, f'{nm}b', 16, region='toe')
            for o in (a_, b_):
                tk.move(o, (0, 0, -0.5))
                tk.flat_bottom(o, 0.2)
            P.append((a_, b_))
            s.B.add(nm, *P)
            s.bone(nm, tuple(hip), 'root')

    # -------------------------------------------------------------- joints and anchors
    def bone(s, name, at, parent):
        s.piv[name] = tuple(float(v) for v in at)
        s.par[name] = parent

    def anchor(s, name, at, bone, scale=1.0):
        s.anchors['anchor_' + name] = (tuple(float(v) for v in at), bone, float(scale))

    def build(s):
        s.build_body()
        s.build_head()
        s.build_tufts()
        s.build_wings()
        s.build_tail()
        s.build_legs()
        if s.queen:
            s.build_regalia()
        if s.S.get('kind') == 'skin':
            s.build_skin_extras()
        k = s.k
        hw, ft, bk, yc = s.body_at(s.bz1 - 3.5 * k)
        s.anchor('neck', (0, yc - ft * 0.55, s.bz1 - 3.2 * k), 'body', s.bw / 24.0)
        hw2, ft2, bk2, yc2 = s.body_at(s.bz0 + s.bh * 0.5)
        s.anchor('chest', (0, yc2 - ft2 - 0.2 * k, s.bz0 + s.bh * 0.55), 'body', s.bw / 24.0)
        s.anchor('back', (0, yc2 + bk2 + 0.2 * k, s.bz0 + s.bh * 0.62), 'body', s.bw / 24.0)
        s.anchor('hold', (s.body_x(s.bz0 + s.bh * 0.35, -2.0) + 2.0 * k, -3.0 * k, s.bz0 + s.bh * 0.35), 'wing_r', 1.0)

    # -------------------------------------------------------------- the special skins' and the queen's extra pieces
    def build_skin_extras(s):
        k = s.k
        sid = s.id
        hw, ft, bk, yc = s.body_at(s.bz0 + s.bh * 0.5)
        front = lambda z: s.body_at(z)[3] - s.body_at(z)[1]  # noqa: E731
        if sid in ('gingerbread', 'snowman'):
            reg = 'gumdrop' if sid == 'gingerbread' else 'coal'
            for i, f in enumerate((0.72, 0.5, 0.28)):
                z = s.bz0 + s.bh * f
                c = (0, front(z) - 0.2 * k, z)
                o = tk.lathe(f'btn{i}', [(0, -0.9), (1.25, -0.8), (1.5, 0.0), (1.1, 0.7), (0, 1.0)], n=10)
                tk.scale(o, (k, k, k))
                tk.rotate(o, 90, 'X')
                tk.move(o, c)
                s.B.add('body', low(o, f'btn{i}', 30, region=f'{reg}{i}'))
        if sid == 'snowman':
            # a knitted scarf round the neck, one end hanging down the chest
            z = s.bz1 - 3.0 * k
            hw, ft, bk, yc = s.body_at(z)
            ring = [{'c': (0, yc, z), 'w': hw * 2 + 2.6 * k, 'ht': ft + 1.3 * k, 'hb': bk + 1.3 * k, 'e': 2.2}]
            pts = []
            for i in range(14):
                a = 2 * math.pi * i / 14
                pts.append((math.sin(a) * (hw + 1.0 * k), yc - math.cos(a) * ((ft if math.cos(a) > 0 else bk) + 1.0 * k), z + 0.4 * k * math.sin(a * 2)))
            o = tk.tube('scarf', pts, [2.0 * k] * 14, n=8, closed=True, squash=0.75)
            s.B.add('body', low(o, 'scarf', 90, region='scarf'))
            e0 = V3(hw * 0.45, yc - ft - 0.4 * k, z - 0.5 * k)
            o = tk.loft('scarf_end', [{'c': tuple(e0), 'w': 3.6 * k, 'h': 0.7 * k}, {'c': tuple(e0 + V3(0.6 * k, -0.9 * k, -4.0 * k)), 'w': 3.4 * k, 'h': 0.6 * k},
                                      {'c': tuple(e0 + V3(1.2 * k, -1.2 * k, -8.0 * k)), 'w': 3.6 * k, 'h': 0.6 * k}], n=8, up=(0, -1, 0), cap0='round', cap1='flat')
            s.B.add('body', low(o, 'scarf_end', 40, region='scarf'))
            # a carrot nose over the beak
            by = s.ez - 2.6 * k
            o = tk.tube('carrot', [(0, s.yF + 0.5 * k, by), (0, s.yF - 3.0 * k, by - 0.6 * k), (0, s.yF - 6.2 * k, by - 1.5 * k)], [1.6 * k, 1.05 * k, 0.12], n=8, cap1='point')
            s.B.add('head', low(o, 'carrot', 40, region='carrot'))
            # twig tufts
            for nm, sx in (('tuft_l', -1), ('tuft_r', 1)):
                b0 = V3(sx * s.hw * 0.28, s.hy, s.hz + s.hh * 0.4)
                t1 = b0 + V3(sx * 2.0 * k, 0.2 * k, 7.5 * k)
                P = [low(tk.tube(nm, [tuple(b0), tuple(b0 + (t1 - b0) * 0.5 + V3(sx * 0.4 * k, 0, 0)), tuple(t1)], [0.75 * k, 0.55 * k, 0.3 * k], n=6), nm, 24, region='twig')]
                m = b0 + (t1 - b0) * 0.55
                P.append(low(tk.tube(nm + 'b', [tuple(m), tuple(m + V3(sx * 3.0 * k, 0, 2.2 * k))], [0.45 * k, 0.2 * k], n=5), nm + 'b', 14, region='twig'))
                m2 = b0 + (t1 - b0) * 0.8
                P.append(low(tk.tube(nm + 'c', [tuple(m2), tuple(m2 + V3(-sx * 1.6 * k, 0, 1.8 * k))], [0.35 * k, 0.15 * k], n=5), nm + 'c', 12, region='twig'))
                s.B.add(nm, *P)
                s.bone(nm, tuple(b0), 'head')
        if sid == 'celestial':
            # a golden crescent moon brooch on the breast
            z = s.bz0 + s.bh * 0.72
            c = V3(0, front(z) - 0.4 * k, z)
            pts = []
            for i in range(13):
                a = math.radians(-120 + 240 * i / 12)
                pts.append((math.cos(a) * 2.6 * k, math.sin(a) * 2.6 * k))
            for i in range(13):
                a = math.radians(120 - 240 * i / 12)
                pts.append((math.cos(a) * 1.8 * k + 1.1 * k, math.sin(a) * 1.9 * k))
            o = tk.slab('moon', pts, 0.9 * k, plane='XZ', at=0.0, bevel=0.3 * k, segs=1)
            tk.rotate(o, 25, 'Y')
            tk.move(o, tuple(c))
            s.B.add('body', low(o, 'moon', 50, region='moon'))

    def build_regalia(s):
        """Queen Neve: an ice crown, a frost cape with a fur collar, a little ice scepter under her right wing."""
        k = s.k
        # ---- the crown: a band of ice with crystal spikes, on the head
        cz = s.hz + s.hh * 0.42
        cy = s.hy + 1.0 * k
        n = 7
        P = []
        band = tk.lathe('crownband', [(5.4 * k, -0.6 * k), (5.9 * k, 0.0), (5.7 * k, 1.6 * k), (5.3 * k, 1.9 * k)], n=14)
        tk.move(band, (0, cy, cz))
        P.append(low(band, 'crownband', 60, region='silver'))
        for i in range(n):
            a = math.radians(-90 + (i - (n - 1) / 2) * 26)
            r = 5.6 * k
            b0 = V3(math.cos(a) * r, cy + math.sin(a) * r, cz + 1.2 * k)
            h = (6.4 if i == (n - 1) // 2 else 4.6 if abs(i - (n - 1) / 2) == 1 else 3.4) * k
            out = V3(math.cos(a), math.sin(a), 0) * 0.35
            o = tk.lathe(f'spike{i}', [(0, 0), (1.05 * k, 0.2 * k), (0.95 * k, h * 0.55), (0, h)], n=5)
            tk.move(o, (0, 0, 0))
            from mathutils import Vector
            q = Vector((0, 0, 1)).rotation_difference(Vector(tuple(out + V3(0, 0, 1))))
            tk.transform(o, q.to_matrix().to_4x4())
            tk.move(o, tuple(b0))
            P.append(low(o, f'spike{i}', 14, region='ice'))
            if i == (n - 1) // 2:
                gem = tk.lathe('gem', [(0, -1.0 * k), (1.0 * k, 0), (0, 1.0 * k)], n=6)
                tk.rotate(gem, 90, 'X')
                tk.move(gem, tuple(b0 + V3(0, -1.0 * k, 1.6 * k)))
                P.append(low(gem, 'gem', 12, region='gem'))
        s.B.add('head', *P)
        # ---- the cape: a shell round the back from the shoulders, flaring to the hem, a fur collar
        rings = []
        for f, grow, op in ((0.97, 1.4, 0.5), (0.75, 1.8, 0.62), (0.45, 2.4, 0.72), (0.12, 3.2, 0.78), (-0.02, 3.6, 0.8)):
            z = s.bz0 + s.bh * f
            hw, ft, bk, yc = s.body_at(z)
            rings.append((z, hw + grow * k, ft + grow * k * 0.6, bk + grow * k, yc, op))
        V, Fc = [], []
        nA = 16
        for z, hw, ft, bk, yc, op in rings:
            for i in range(nA + 1):
                a = math.radians(-180 * op + 360 * op * i / nA)  # an open arc round the back (a = 0: straight behind)
                x = math.sin(a) * hw
                y = yc + math.cos(a) * (bk if math.cos(a) > 0 else ft)
                V.append((x, y, z))
        m = nA + 1
        for r in range(len(rings) - 1):
            for i in range(nA):
                a, b = r * m + i, r * m + i + 1
                Fc.append((a, b, b + m, a + m))
        cape = tk.from_pydata('cape', V, Fc)
        sol = cape.modifiers.new('sol', 'SOLIDIFY')
        sol.thickness = 1.1 * k
        sol.offset = 1.0
        tk.apply(cape)

        def sc(h):
            def f(V_, N):  # soft folds falling from the shoulders
                a = np.arctan2(V_[:, 0], V_[:, 1])
                fall = tk.smoothstep(s.bz1, s.bz0 + s.bh * 0.5, V_[:, 2])
                return 0.45 * k * fall * np.sin(a * 9)
            tk.push(h, f)
        s.B.add('body', low(cape, 'cape', 220, lo=1, hi=2, sculpt=sc, region=('cape', [('capein', lambda C, N: False)])))
        z = s.bz1 - 2.0 * k
        hw, ft, bk, yc = s.body_at(z)
        pts = []
        for i in range(16):
            a = 2 * math.pi * i / 16
            pts.append((math.sin(a) * (hw + 1.2 * k), yc - math.cos(a) * ((ft if math.cos(a) > 0 else bk) + 1.2 * k), z))
        col = tk.tube('collar', pts, [2.1 * k] * 16, n=8, closed=True, squash=0.8)
        s.B.add('body', low(col, 'collar', 110, region='furtrim'))
        # a clasp: a silver snowflake brooch at the collar's front
        c = V3(0, yc - ft - 2.6 * k, z - 0.6 * k)
        o = tk.lathe('clasp', [(0, -0.6 * k), (1.6 * k, -0.4 * k), (1.7 * k, 0.2 * k), (0, 0.6 * k)], n=6)
        tk.rotate(o, 90, 'X')
        tk.move(o, tuple(c))
        s.B.add('body', low(o, 'clasp', 18, region='gem'))
        # ---- the scepter: a silver rod topped with an ice crystal, held under the right wing
        x0 = s.body_x(s.bz0 + s.bh * 0.4, -3.0) + 2.2 * k
        bot = V3(x0, -6.0 * k, s.bz0 + 1.0 * k)
        top = V3(x0 + 0.8 * k, -7.5 * k, s.bz1 + 2.0 * k)
        rod = tk.tube('rod', [tuple(bot), tuple(top)], [0.55 * k, 0.6 * k], n=7)
        P = [low(rod, 'rod', 28, region='silver')]
        cr = tk.lathe('crystal', [(0, -2.6 * k), (1.4 * k, -0.6 * k), (1.5 * k, 0.6 * k), (0, 3.8 * k)], n=6)
        tk.move(cr, tuple(top + V3(0, 0, 2.6 * k)))
        P.append(low(cr, 'crystal', 24, region='ice'))
        orb = tk.lathe('knob', [(0, -0.8 * k), (1.0 * k, 0), (0, 0.8 * k)], n=8)
        tk.move(orb, tuple(top))
        P.append(low(orb, 'knob', 14, region='silver'))
        s.B.add('wing_r', *P)

    # -------------------------------------------------------------- commit
    def commit(s, F):
        # (each part's sculpts joined into one object: a selected-to-active bake from one high mesh is far quicker than
        # from a dozen little ones, the toes and claws of a foot)
        for nm, L in s.B.p.items():
            lows = [a for a, b in L]
            highs = [b for a, b in L]
            for h in highs:
                tk.clean_slots(h)
                if not h.data.materials:
                    tk.set_region(h, nm)
            hi = tk.join(highs, nm + '_hi') if len(highs) > 1 else highs[0]
            F.part(nm, tk.join(lows, nm), [hi], bone=nm, kind='matte', uvw=0.6 if nm == 'jaw' else 1.0)


# ====================================================================== the paint
def paint(P, pt, O):
    """Hand-painted plumage: feather brushwork over the whole bird, the species' markings laid as strokes and dabs."""
    import face
    S = O.S
    k = O.k
    X, Y, Z = P.X, P.Y, P.Z
    on = P.on
    sh = P.shade(light=0.0, ao=0.85, cav=1.1)
    # a gentle airbrush: paler on top, deeper toward the ground and under the chin
    air = 0.14 * sstep(O.bz0 + O.bh * 0.4, O.hz + O.hh * 0.5, Z) - 0.22 * sstep(O.bz0 + 4 * k, 0.0, Z) - 0.08 * sstep(-0.2, -0.8, on[:, :, 2])
    rng = np.random.default_rng(7)

    def R(c, n=7, **kw):
        kw.setdefault('shift', 0.06)
        return pt.ramp(c, n, **kw)

    FE = 'feather'
    soft = {'preset': 'feather', 'L': 2.0, 'W': 0.55, 'cover': 1.3, 'p': 0.22}

    def fill(reg, col, base=0.0, brush=FE, tex=None, n=7, levels=None, where=None, **kw):
        return P.fill(reg, R(col, n, **kw), tone=sh, base=air + base, brush=brush, tex=tex, levels=levels, where=where)

    def dabmask(m, size=1.0, spacing=2.0, keep=0.6, seed=1, cut=0.62, **kw):
        if not m.any():
            return m
        r = P.dabs(m, size=size, spacing=spacing, seed=seed, **kw)
        who, d = r[0], r[1]
        sel = rng.random(max(int(who.max()) + 1, 1)) < keep
        return m & (who >= 0) & sel[np.maximum(who, 0)] & (d < cut)

    def streaks(m, col, size=0.9, spacing=2.3, keep=0.6, stretch=3.4, seed=3, base=-0.05, flow='down'):
        mk = dabmask(m, size=size, spacing=spacing, keep=keep, seed=seed, flow=flow, stretch=stretch)
        fill(mk, col, base=base, brush={'preset': 'feather', 'L': 1.6, 'W': 0.4, 'cover': 1.2, 'p': 0.25}, tex=False)
        return mk

    def spots(m, col, size=1.1, spacing=2.4, keep=0.5, seed=5, base=0.1):
        mk = dabmask(m, size=size, spacing=spacing, keep=keep, seed=seed, cut=0.7)
        fill(mk, col, base=base, brush={'preset': 'feather', 'L': 1.0, 'W': 0.35, 'cover': 1.0, 'p': 0.2}, tex=False)
        return mk

    def bars(m, col, period=2.2, width=0.34, wob=0.5, seed=2, broken=0.75, base=-0.05, tilt=0.0):
        ph = rng.uniform(0, 6)
        u = (Z + wob * k * np.sin(X * 0.55 / k + ph) + tilt * np.abs(X)) / (period * k)
        band = np.abs(np.mod(u, 1.0) - 0.5) < width * 0.5
        mk = m & band
        if broken < 1:
            mk = mk & dabmask(m, size=1.6 * k, spacing=1.5 * k, keep=broken, seed=seed, cut=0.95)
        fill(mk, col, base=base, brush={'preset': 'feather', 'flow': 'around', 'L': 1.5, 'W': 0.4, 'cover': 1.2, 'p': 0.22}, tex=False)
        return mk

    C = S['col']
    kind = S.get('kind')
    reg = P.region
    disc_m = reg('disc')
    crown = reg('crown')
    back = reg('back')
    belly = reg('belly')
    wing = reg('wing') | reg('covert')

    if kind == 'species' or kind == 'queen':
        fill('crown', C['up'], base=0.05)
        fill('back', C['up'], base=0.0)
        fill('belly', C['under'], base=0.06 + 0.12 * sstep(O.bz0 + O.bh * 0.6, O.bz0, Z))
        fill('wing', C['wing'], base=0.0)
        fill('covert', C['wing'], base=0.08)
        fill('tail', C['tail'], base=-0.02)
        fill('tuft', C.get('tuft', C['up']), base=0.0)
        fill('disc', C['disc'], base=0.1, brush=soft, tex={'kind': 'feathers', 'size': 1.5, 'spacing': 0.95, 'stretch': 1.6, 'flow': _radial(O)})
        fill('ruff', C['ruff'], base=0.0, brush={'preset': 'feather', 'flow': _radial(O), 'L': 1.6, 'W': 0.45})
        leg_col = C['leg']
        fill('leg', leg_col, base=0.05, brush='feather' if O.toes != 'bare' else 'scale')
        fill('knicker', C['under'], base=0.05)
        fill('toe', leg_col if O.toes != 'bare' else C['leg'], base=0.0, brush='feather' if O.toes == 'feathered' else 'scale')
        fill('talon', C['talon'], base=0.25, brush='gloss', n=6)
        fill('beak', C['beak'], base=0.15, brush='gloss', n=6)
        fill('cere', C['cere'], base=0.05, brush='skin', n=6)
        fill('gape', '#7a4a48', base=0.0, brush='gloss', n=5)
        _markings(O, P, pt, S, C, fill, streaks, spots, bars, dabmask, k)
        if kind == 'queen':
            Q = S['skin']
            fill('cape', Q['cape'], base=0.05, brush='cloth', n=7)
            cape = reg('cape')
            # snowflakes embroidered in silver thread over the cape
            sn = cape & _snowflakes(P, O, k)
            P.flat(sn, Q['capeLight'])
            hem = cape & (Z < O.bz0 + 2.2 * k)
            fill(hem, Q['capeDark'], base=0.0, brush='cloth')
            fill('furtrim', Q['fur'], base=0.15, brush='fur', n=7)
            fill('ice', Q['ice'], base=0.2, brush={'preset': 'gloss', 'shine': 0.6}, n=7, light=0.6)
            fill('silver', Q['silver'], base=0.1, brush='metal', n=7)
            fill('gem', Q['gem'], base=0.25, brush={'preset': 'gloss', 'shine': 0.8}, n=7, light=0.6)
            P.lines(['cape'], ['furtrim'], step=1)
    elif O.id == 'gingerbread':
        Q = S['skin']
        dough = {'preset': 'pvc', 'L': 3.0, 'W': 0.9, 'cover': 1.2, 'p': 0.12}
        for r_ in ('crown', 'back', 'belly', 'wing', 'covert', 'tail', 'leg', 'toe', 'knicker'):
            fill(r_, Q['dough'], base=0.04, brush=dough, tex='skin')
        fill('disc', Q['dough'], base=0.22, brush=dough, tex='skin')
        fill('ruff', Q['dough'], base=0.12, brush=dough, tex='skin')
        # baked darker toward the edges of each piece (the facet maps' hard edges), flour dust in the hollows
        P.shift(P.mask & (P.m['hard'] < 3.0) & (P.idx >= 0), -1)
        # piped icing: a scalloped line across the chest, rings round the face, zigzags on the wings
        icing = np.zeros_like(P.mask)
        u = X / (3.6 * k)
        zz = (O.bz0 + O.bh * 0.82 - Z) / (2.4 * k)
        rowi = np.floor(zz)
        v = zz - rowi
        arc = 0.75 - 0.5 * np.sqrt(np.clip(1 - (2 * np.mod(u + 0.5 * np.mod(rowi, 2), 1.0) - 1) ** 2, 0, 1))
        icing |= belly & (rowi >= 0) & (rowi <= 2) & (np.abs(v - arc) < 0.11)
        dd = O.disc_d(X, Z)
        icing |= (reg('disc') | reg('ruff')) & (np.abs(dd + 0.2 * k) < 0.32 * k)
        wz = O.bz0 + O.bh * (0.62 + 0.05 * np.sin(Y * 1.1 / k))
        icing |= wing & ((np.abs(Z - wz) < 0.3 * k) | ((np.abs(Z - wz + 3.0 * k) < 0.26 * k) & (np.sin(Y * 1.6 / k) > 0)))
        icing |= back & (np.abs(Z - (O.bz0 + 1.6 * k)) < 0.3 * k)
        fill(icing, Q['icing'], base=0.2, brush={'preset': 'gloss', 'L': 1.2, 'W': 0.5}, n=6, light=0.5)
        fill('talon', Q['baked'], base=0.1, brush='pvc', n=6)
        fill('beak', Q['beak'], base=0.15, brush='gloss', n=6)
        fill('cere', Q['icing'], base=0.1, brush='gloss', n=6)
        fill('gape', '#7a4a48', base=0.0, brush='gloss', n=5)
        for i, c in enumerate((Q['candy'], Q['mint'], Q['gold'])):
            fill(f'gumdrop{i}', c, base=0.15, brush={'preset': 'lacquer', 'shine': 0.7}, n=7, light=0.55)
            g_ = reg(f'gumdrop{i}')
            P.flat(g_ & (_dots(P, 0.35 * k, 0.9 * k, seed=i) > 0), Q['icing'])  # sugar crystals
    elif O.id == 'snowman':
        Q = S['skin']
        snow = {'preset': 'pvc', 'L': 2.6, 'W': 0.9, 'cover': 1.4, 'p': 0.16}
        for r_ in ('crown', 'back', 'belly', 'wing', 'covert', 'tail', 'leg', 'toe', 'knicker', 'disc', 'ruff'):
            fill(r_, Q['snow'], base=0.1, brush=snow, tex='skin', n=7)
        # packed-snow clumps: a hand-dabbed cool blue in the hollows
        m = P.mask & (P.idx >= 0) & (P.ao < 0.8)
        P.recolour(dabmask(m, size=1.4, spacing=1.6, keep=0.7, seed=9), R(Q['shade'], 7))
        for i in range(3):
            fill(f'coal{i}', Q['coal'], base=0.1, brush={'preset': 'skin', 'shine': 0.4}, n=6)
        fill('carrot', Q['carrot'], base=0.1, brush={'preset': 'skin', 'flow': 'around', 'L': 1.0}, n=7)
        car = reg('carrot')
        P.shift(car & (np.abs(np.mod(Y / (1.1 * k), 1.0) - 0.5) < 0.08), -1)  # its growth rings
        fill('twig', Q['twig'], base=0.0, brush='wood', n=6)
        fill('scarf', Q['scarf'], base=0.05, brush='cloth', n=7)
        sc_ = reg('scarf')
        stripe = sc_ & (np.mod((X + Z * 0.4) / (2.4 * k), 1.0) < 0.38)
        fill(stripe, Q['scarf2'], base=0.05, brush='cloth', n=7)
        fill('talon', Q['coal'], base=0.1, brush='pvc', n=6)
        fill('beak', Q['carrot'], base=0.1, brush='skin', n=6)
        fill('cere', Q['carrot'], base=0.0, brush='skin', n=6)
        fill('gape', '#7a4a48', base=0.0, brush='gloss', n=5)
    elif O.id == 'celestial':
        Q = S['skin']
        for r_, b in (('crown', 0.05), ('back', 0.0), ('wing', -0.04), ('covert', 0.04), ('tail', -0.05), ('tuft', 0.0), ('leg', 0.05), ('knicker', 0.05),
                      ('toe', 0.0)):
            fill(r_, Q['night'], base=b, n=7, light=0.35)
        fill('belly', Q['dusk'], base=0.0, n=7)
        fill('disc', Q['dusk'], base=0.12, brush=soft, tex={'kind': 'feathers', 'size': 1.5, 'spacing': 0.95, 'stretch': 1.6, 'flow': _radial(O)})
        fill('ruff', Q['deep'], base=0.0, brush={'preset': 'feather', 'flow': _radial(O), 'L': 1.6, 'W': 0.45})
        # constellations: star dabs joined by fine gold lines, and a scatter of tiny stars
        _stars(P, O, Q, k, pt)
        fill('talon', Q['gold'], base=0.1, brush='metal', n=6)
        fill('beak', Q['gold'], base=0.1, brush='metal', n=6)
        fill('cere', Q['gold'], base=0.0, brush='metal', n=6)
        fill('gape', '#5a3a58', base=0.0, brush='gloss', n=5)
        fill('moon', Q['gold'], base=0.2, brush='metal', n=7)
        tt = reg('tuft') & (Z > O.hz + O.hh * 0.36 + 2.5 * k)
        fill(tt, Q['gold'], base=0.1, brush='metal', n=6)
    elif O.id == 'meowl':
        Q = S['skin']
        furb = {'preset': 'fur', 'L': 1.8, 'W': 0.5}
        fill('crown', Q['fur'], base=0.05, brush=furb, tex='fur')
        fill('ear', Q['fur'], base=0.0, brush=furb, tex='fur')
        fill('earin', Q['ear'], base=0.1, brush='fur', tex=False)
        fill('muzzle', Q['muzzle'], base=0.1, brush=furb, tex='fur')
        fill('nose', Q['nose'], base=0.1, brush='gloss', n=6)
        fill('gape', '#a85a5c', base=0.0, brush='gloss', n=5)
        fill('back', Q['fur'], base=0.0, brush='feather')
        fill('belly', Q['belly'], base=0.05, brush='feather')
        fill('wing', Q['wing'], base=0.0, brush='feather')
        fill('covert', Q['wing'], base=0.06, brush='feather')
        fill('tail', Q['wing'], base=-0.03, brush='feather')
        for r_ in ('leg', 'toe', 'knicker'):
            fill(r_, Q['paw'], base=0.05, brush='fur', tex='fur')
        fill('talon', Q['talon'], base=0.15, brush='gloss', n=6)
        # tabby stripes over the head, the back and the wings: brushed bands
        head = reg('crown')
        ang = np.arctan2(X, Y - O.hy)
        st = head & (np.abs(np.mod((Z - O.hz) * 0.0 + ang * 3.2 / math.pi + 0.15 * np.sin(Z * 0.7), 1.0) - 0.5) < 0.16) & (Z > O.ez + 2 * k)
        fill(st, Q['stripe'], base=0.0, brush=furb, tex=False)
        bars(back | wing, Q['stripe'], period=3.2, width=0.3, wob=0.8, broken=0.9)
        # the M on the forehead
        mm = head & (on[:, :, 1] < -0.4) & (np.abs(Z - (O.ez + 4.8 * k + 1.2 * k * np.abs(np.sin(X * 1.1 / k)))) < 0.55 * k) & (np.abs(X) < 3.8 * k)
        fill(mm, Q['stripe'], base=-0.05, brush=furb, tex=False)
        ears = reg('ear') & (Z > O.hz + O.hh * 0.38 + 5.5 * k)
        fill(ears, Q['stripe'], base=0.0, brush=furb, tex=False)
        fc = face.Face(P, c=(0, O.yF, O.ez - 3.0 * k), axis=(0, -1, 0.05), where=reg('muzzle') | head, seed=3, ink='#5a3a2c')
        fc.mouth('w', w=3.2 * k, dy=-1.7 * k, weight=0.3 * k)
        fc.whiskers(dy=-1.0 * k, spread=5.0 * k, length=4.6 * k, weight=0.22 * k)

    # ---- the blush: stippled cheeks under the eyes (no eyes painted: the game draws them)
    if O.id not in ('snowman',):
        where = disc_m | reg('ruff') | reg('crown') | reg('muzzle')
        fc = face.Face(P, c=(0, O.yF, O.ez), axis=(0, -1, 0.04), where=where, seed=11)
        bcol = '#e08e88' if O.id not in ('celestial',) else '#c8909a'
        if O.id == 'gingerbread':
            bcol = '#d06a5c'
        fc.blush(O.ex * 2.3, -O.er * 1.85, rx=2.3 * k, ry=1.25 * k, col=bcol)
    else:
        where = reg('disc') | reg('ruff') | reg('crown')
        fc = face.Face(P, c=(0, O.yF, O.ez), axis=(0, -1, 0.04), where=where, seed=11)
        fc.blush(O.ex * 2.25, -O.er * 1.9, rx=1.8 * k, ry=1.0 * k, col='#e8a2a0')
    # ---- paint lines where colours meet, clean clusters, then the facet rims and rubbed wear
    P.lines(['beak', 'cere', 'nose', 'carrot'], None, step=1)
    P.lines(['disc'], ['ruff'], step=1)
    P.lines(['wing', 'covert', 'tail'], ['back', 'belly'], step=1)
    P.lines(['talon'], None, step=1)
    P.clusters()
    return P.done()


def _radial(O):
    """A stroke flow radiating from each eye across the disc (the facial disc's feathers fan out from the eye)."""
    def f(Pp, N):
        sx = np.where(Pp[:, 0] >= 0, 1.0, -1.0)
        d = np.stack([Pp[:, 0] - sx * O.ex, np.zeros(len(Pp)), Pp[:, 2] - O.ez], 1)
        d = d - N * (np.einsum('ij,ij->i', d, N))[:, None]
        n = np.linalg.norm(d, axis=1)
        alt = np.cross(N, [0.0, 0.0, 1.0])
        return np.where((n < 1e-3)[:, None], alt, d)
    return f


def _dots(P, r, spacing, seed=0):
    rng = np.random.default_rng(seed)
    who, d = P.dabs(P.mask, size=r * 2, spacing=spacing, seed=seed)
    return (who >= 0) & (d < 0.6)


def _snowflakes(P, O, k):
    """Little six-armed snowflakes (embroidery) scattered over the cape: a mask."""
    X, Y, Z = P.X, P.Y, P.Z
    m = np.zeros_like(P.mask)
    rng = np.random.default_rng(4)
    for i in range(26):
        a = rng.uniform(-2.4, 2.4)
        z = rng.uniform(O.bz0 + 2.5 * k, O.bz1 - 4 * k)
        hw, ft, bk, yc = O.body_at(z)
        c = np.array([math.sin(a) * (hw + 3.0 * k), yc + math.cos(a) * (bk + 3.0 * k), z])
        dx, dy, dz = X - c[0], Y - c[1], Z - c[2]
        dd = np.sqrt(dx * dx + dy * dy + dz * dz)
        r = 1.5 * k * rng.uniform(0.7, 1.1)
        near = dd < r
        if not near.any():
            continue
        # arms: the angle round the flake's normal (the cape faces out from the body)
        nrm = np.array([math.sin(a), math.cos(a), 0.0])
        u = np.cross([0, 0, 1.0], nrm)
        u /= np.linalg.norm(u)
        uu = dx * u[0] + dy * u[1] + dz * u[2]
        vv = dz
        ang = np.arctan2(vv, uu)
        arm = np.abs(np.sin(ang * 3)) * dd < 0.22 * k
        tick = (np.abs(dd - r * 0.6) < 0.18 * k) & (np.abs(np.sin(ang * 3)) < 0.5)
        m |= near & (arm | tick)
    return m


def _stars(P, O, Q, k, pt):
    X, Y, Z = P.X, P.Y, P.Z
    rng = np.random.default_rng(21)
    m = P.mask & (P.idx >= 0)
    # tiny scattered stars (dabs), most a step lighter, a few gold
    who, d = P.dabs(m, size=0.45 * k, spacing=2.2 * k, seed=5)
    sel = rng.random(max(int(who.max()) + 1, 1))
    tiny = m & (who >= 0) & (d < 0.55) & (sel[np.maximum(who, 0)] < 0.35)
    P.flat(tiny & (sel[np.maximum(who, 0)] < 0.1), Q['star'])
    P.shift(tiny & (sel[np.maximum(who, 0)] >= 0.1), 2)
    # constellations on the back, the wings and the belly: a few stars joined by thin gold lines
    figs = [
        [(-5, 9, 0.55), (-2, 11, 0.62), (1, 10, 0.7), (4, 12, 0.75), (6, 9, 0.82)],   # a dipper over the back
        [(-3, -10, 0.35), (0, -11, 0.45), (3, -10, 0.38), (0, -11, 0.6)],             # a little cross on the breast
    ]
    for fig in figs:
        pts = []
        for x, y, f in fig:
            z = O.bz0 + O.bh * f
            hw, ft, bk, yc = O.body_at(z)
            yy = yc + (bk + 0.5 if y > 0 else -ft - 0.5)
            xx = x * k
            pts.append(np.array([xx, yy, z]))
        for a, b in zip(pts, pts[1:]):
            ab = b - a
            L2 = float(ab @ ab)
            t = np.clip(((X - a[0]) * ab[0] + (Y - a[1]) * ab[1] + (Z - a[2]) * ab[2]) / L2, 0, 1)
            dd = np.sqrt((X - a[0] - t * ab[0]) ** 2 + (Y - a[1] - t * ab[1]) ** 2 + (Z - a[2] - t * ab[2]) ** 2)
            P.flat(P.mask & (dd < 0.16 * k), Q['gold'])
        for p in pts:
            dd = np.sqrt((X - p[0]) ** 2 + (Y - p[1]) ** 2 + (Z - p[2]) ** 2)
            P.flat(P.mask & (dd < 0.75 * k), Q['star'])
            P.flat(P.mask & (dd < 0.38 * k), Q['glow'])


def _markings(O, P, pt, S, C, fill, streaks, spots, bars, dabmask, k):
    """Each species' own markings, painted as feather strokes and dabs over the ground colours."""
    X, Y, Z = P.X, P.Y, P.Z
    on = P.on
    reg = P.region
    back, belly, crown = reg('back'), reg('belly'), reg('crown')
    wing, covert = reg('wing'), reg('covert')
    disc, ruff = reg('disc'), reg('ruff')
    tail = reg('tail')
    up, und, dp = S['upper'], S['under'], S['discpat']
    head_top = crown & (Z > O.hz - O.hh * 0.1)
    face_dd = O.disc_d(X, Z)
    # ---------------------------------------------------------------- upperparts
    if up == 'tawny':
        streaks(back | head_top | covert, C['upDark'], size=0.8, spacing=2.4, keep=0.55)
        spots(covert | (back & (Z > O.bz1 - 6 * k)), C['upLight'], size=1.1, spacing=2.8, keep=0.45)
        bars(wing & (Z < O.bz0 + O.bh * 0.55), C['wingBar'], period=2.6, width=0.3, broken=0.8)
        bars(wing & (Z < O.bz0 + O.bh * 0.55), C['wingLight'], period=2.6, width=0.2, broken=0.6, base=0.1)
    elif up == 'barn':
        # golden buff upperparts washed with soft grey, fine white pearls
        m = back | covert | head_top | wing
        fill(dabmask(m, size=2.4, spacing=2.6, keep=0.5, seed=8, cut=0.8), C['upDark'], base=0.15,
             brush={'preset': 'feather', 'L': 2.4, 'W': 0.7, 'cover': 1.4, 'p': 0.2}, tex=False)
        spots(m, C['upLight'], size=0.55, spacing=1.7, keep=0.55, base=0.2)
        spots(m, '#3a302c', size=0.3, spacing=1.7, keep=0.35, seed=12, base=-0.1)
        bars(wing & (Z < O.bz0 + O.bh * 0.5), C['wingBar'], period=2.8, width=0.24, broken=0.7)
    elif up == 'snowy':
        bars(back | wing | covert | head_top, C['upDark'], period=2.5, width=0.18, wob=0.8, broken=0.42)
    elif up == 'spotted':
        spots(back | head_top | covert | wing, C['upLight'], size=1.0, spacing=2.3, keep=0.5, base=0.15)
        if O.id == 'little':
            spots(head_top, C['upLight'], size=0.7, spacing=1.6, keep=0.6, seed=9, base=0.2)
        bars(wing & (Z < O.bz0 + O.bh * 0.5), C['wingLight'], period=2.4, width=0.22, broken=0.7, base=0.15)
    elif up == 'mottled':
        streaks(back | head_top | covert, C['upDark'], size=1.0, spacing=2.0, keep=0.6, stretch=2.6)
        spots(back | covert | wing, C['upLight'], size=0.9, spacing=2.2, keep=0.4, base=0.1)
        bars(wing & (Z < O.bz0 + O.bh * 0.6), C['wingBar'], period=2.3, width=0.3, broken=0.85)
    elif up == 'grey':
        streaks(back | head_top | covert, C['upDark'], size=0.8, spacing=2.0, keep=0.55, stretch=2.8)
        spots(back | covert | wing, C['upLight'], size=0.9, spacing=2.4, keep=0.4, base=0.12)
        bars(wing & (Z < O.bz0 + O.bh * 0.6), C['wingBar'], period=2.4, width=0.26, broken=0.8)
    bars(tail, C['tailBar'], period=2.0, width=0.3, broken=0.9, tilt=0.0)
    # ---------------------------------------------------------------- underparts
    if und == 'tawny':
        streaks(belly, C['underMark'], size=0.85, spacing=2.4, keep=0.55, stretch=3.6)
        bars(belly & (Z < O.bz0 + O.bh * 0.6), C['underMark'], period=3.2, width=0.12, broken=0.4, base=0.05)
    elif und == 'dots':
        spots(belly, C['underMark'], size=0.45, spacing=2.2, keep=0.5, base=-0.1)
    elif und == 'snowy':
        bars(belly & (Z < O.bz0 + O.bh * 0.75), C['underMark'], period=2.6, width=0.16, wob=0.9, broken=0.35)
    elif und == 'barred':
        bars(belly, C['underMark'], period=2.1, width=0.36, wob=0.5, broken=0.85)
    elif und == 'chestnut':
        streaks(belly, C['underMark'], size=1.5, spacing=2.2, keep=0.75, stretch=3.0, base=0.0)
    elif und == 'streaked':
        streaks(belly, C['underMark'], size=1.0, spacing=2.0, keep=0.7, stretch=2.6)
    elif und == 'finebar':
        bars(belly, C['underMark'], period=1.5, width=0.24, wob=0.4, broken=0.9)
        streaks(belly & (Z > O.bz0 + O.bh * 0.55), C['underMark'], size=1.0, spacing=2.3, keep=0.5, stretch=2.4)
    elif und == 'longeared':
        streaks(belly, C['underMark'], size=0.9, spacing=2.0, keep=0.75, stretch=3.8)
        bars(belly & (Z < O.bz0 + O.bh * 0.6), C['underMark'], period=2.2, width=0.14, broken=0.6)
    elif und == 'greystreak':
        streaks(belly, C['underMark'], size=0.8, spacing=1.9, keep=0.7, stretch=3.2)
        bars(belly, C['underMark'], period=2.0, width=0.12, broken=0.6)
    elif und == 'eagle':
        streaks(belly & (Z > O.bz0 + O.bh * 0.45), C['underMark'], size=1.2, spacing=2.1, keep=0.8, stretch=3.4)
        bars(belly & (Z < O.bz0 + O.bh * 0.6), C['underMark'], period=1.6, width=0.18, broken=0.85)
    if C.get('bib'):  # a white throat bib under the face
        bib = (belly | back) & (on[:, :, 1] < -0.2) & (Z > O.bz1 - 5.5 * k) & (np.abs(X) < O.bw * 0.3)
        fill(bib, C['bib'], base=0.15, brush='feather', tex='feather')
    # ---------------------------------------------------------------- the face
    eyes = [np.hypot(X - sx * O.ex, Z - O.ez) for sx in (-1, 1)]
    de = np.minimum(*eyes)
    if dp in ('tawny', 'horned', 'eagle', 'longeared', 'burrowing', 'little', 'sawwhet'):
        # fine dark rings of feathers fanning round each eye (the disc's concentric texture)
        rad = dabmask(disc & (de > O.er * 1.7), size=0.75, spacing=1.5, keep=0.55, seed=31, cut=0.6, flow=_radial(O), stretch=3.2)
        fill(rad, C['discDark'], base=0.05, brush={'preset': 'feather', 'flow': _radial(O), 'L': 1.1, 'W': 0.35}, tex=False)
        ring = disc & (np.abs(de - O.er * 3.3) < 0.28 * k)
        fill(ring & dabmask(disc, size=1.4, spacing=1.3, keep=0.55, seed=33, cut=0.9), C['discDark'], base=0.1,
             brush={'preset': 'feather', 'flow': 'around', 'L': 1.0, 'W': 0.35}, tex=False)
    if dp == 'rings':  # the great grey's dish of concentric rings and its white bow tie
        ring = disc & (np.abs(np.mod(de / (1.7 * k), 1.0) - 0.5) < 0.16) & (de > O.er * 1.6)
        fill(ring, C['discDark'], base=0.0, brush={'preset': 'feather', 'flow': _radial(O), 'L': 1.2, 'W': 0.4}, tex=False)
        bow = (disc | ruff | crown) & (np.abs(Z - (O.ez - 7.2 * k)) < 1.2 * k + 0.25 * np.abs(X)) & (np.abs(X) < 4.4 * k) & (on[:, :, 1] < -0.3)
        fill(bow, C['bib'], base=0.2, brush='feather', tex=False)
        chin = (disc | ruff) & (np.abs(X) < 1.3 * k) & (np.abs(Z - (O.ez - 7.2 * k)) < 1.0 * k)
        fill(chin, C['chin'], base=0.0, brush='feather', tex=False)
    if dp == 'barn':  # the heart's fine brown edge and the soft blush of brown in front of each eye
        smear = disc & (np.hypot(np.abs(X) - O.ex * 0.65, (Z - O.ez - 0.2 * k) / 0.7) < 1.6 * k)
        fill(smear, C['discDark'], base=0.15, brush=_soft_brush(), tex=False)
    if dp in ('little', 'burrowing', 'tawny', 'horned', 'eagle', 'sawwhet', 'longeared', 'snowy'):
        # pale brows over the eyes, meeting at the ridge in a V
        for sx in (-1, 1):
            u = X - sx * O.ex
            bold = dp in ('little', 'burrowing', 'horned', 'eagle')
            arc = O.ez + O.er * 1.95 - 0.16 * u * u / k - (0.3 * sx * u if bold else 0.0)
            br = (disc | ruff | crown) & (on[:, :, 1] < -0.2) & (np.abs(Z - arc) < (0.55 if bold else 0.38) * k) & (np.abs(u) < O.er * (2.0 if bold else 1.5))
            fill(br, C['brow'], base=0.2, brush={'preset': 'feather', 'flow': 'around', 'L': 1.2, 'W': 0.4}, tex=False)
        # a pale V of whiskers down the ridge to the bill
        v = (disc | ruff) & (np.abs(X) < 1.2 * k) & (Z > O.ez - 2.0 * k) & (Z < O.ez + 2.4 * k) & (on[:, :, 1] < -0.3)
        fill(v, C['brow'], base=0.1, brush={'preset': 'feather', 'flow': 'down', 'L': 1.0, 'W': 0.3}, tex=False)
    if dp == 'sawwhet' or dp == 'little':  # white streaks fanning across the crown
        streaks(head_top, C['upLight'], size=0.6, spacing=1.7, keep=0.6, stretch=2.2, base=0.2, seed=17)
    if dp in ('longeared',):  # the orange face with a dark vertical bar through each eye
        bar = disc & (np.abs(np.abs(X) - O.ex) < 1.0 * k) & (np.abs(Z - O.ez) < 3.4 * k)
        fill(bar, C['discDark'], base=0.05, brush={'preset': 'feather', 'flow': 'down', 'L': 1.2, 'W': 0.4}, tex=False)
    # the ruff's pale fringe and dark outer line
    edge = ruff & (face_dd < 0.45 * k)
    fill(edge, C['ruffLight'], base=0.15, brush={'preset': 'feather', 'flow': _radial(O), 'L': 0.9, 'W': 0.3}, tex=False)
    if O.tufts:
        tt = reg('tuft')
        streaks(tt, C['upDark'], size=0.7, spacing=1.6, keep=0.6, stretch=3.0, flow='down')


def _soft_brush():
    return {'preset': 'feather', 'L': 1.4, 'W': 0.5, 'cover': 1.4, 'p': 0.2}


# ====================================================================== the eye decals and the export
def eye_decal(head_obj, piv_head, c, axis, r, name):
    """A patch of the head's own facets round an eye (planar UVs: the dot is drawn in the middle), lifted a hair off
    the surface. Its origin is the eye centre `c`, so the game knows where the eye is."""
    import bmesh
    me = head_obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    c = np.asarray(c, float)
    a = np.asarray(axis, float)
    a /= np.linalg.norm(a)
    up = np.array([0, 0, 1.0])
    u = np.cross(up, a)
    u /= np.linalg.norm(u)
    v = np.cross(a, u)
    off = np.asarray(piv_head, float)
    keep = []
    for f in bm.faces:
        cen = np.array(f.calc_center_median()) + off
        nrm = np.array(f.normal)
        if nrm @ a < 0.2:
            continue
        dd = cen - c
        if abs(dd @ u) < r * 1.35 and abs(dd @ v) < r * 1.35 and abs(dd @ a) < r * 1.5:
            keep.append(f)
    nb = bmesh.new()
    vmap = {}
    for f in keep:
        vs = []
        for vert in f.verts:
            if vert.index not in vmap:
                p = np.array(vert.co) + off + np.array(f.normal) * 0.0
                vmap[vert.index] = nb.verts.new(tuple(p))
            vs.append(vmap[vert.index])
        try:
            nb.faces.new(vs)
        except ValueError:
            pass
    nb.normal_update()
    # lift along the averaged normal so it never fights the head's own faces
    for vert in nb.verts:
        vert.co += vert.normal * 0.06
    uvl = nb.loops.layers.uv.new('UVMap')
    for f in nb.faces:
        for l in f.loops:
            p = np.array(l.vert.co) - c
            l[uvl].uv = (0.5 + (p @ u) / (2 * r), 0.5 + (p @ v) / (2 * r))
    for vert in nb.verts:
        vert.co = tuple(np.array(vert.co) - c)
    meh = bpy.data.meshes.new(name)
    nb.to_mesh(meh)
    nb.free()
    bm.free()
    ob = bpy.data.objects.new(name, meh)
    bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.get('eye_decal') or bpy.data.materials.new('eye_decal')
    mat.use_nodes = True
    meh.materials.append(mat)
    meh.shade_flat()
    return ob


def surface_point(objs, x, z, y0=-80.0):
    """Where a ray from the front (along +Y) at (x, z) first meets the given meshes (world coordinates)."""
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    best = None
    for o in objs:
        bvh = BVHTree.FromObject(o, bpy.context.evaluated_depsgraph_get())
        M = o.matrix_world
        Mi = M.inverted()
        org = Mi @ Vector((x, y0, z))
        d = (Mi.to_3x3() @ Vector((0, 1, 0))).normalized()
        hit = bvh.ray_cast(org, d)
        if hit[0] is not None:
            p = M @ hit[0]
            n = (M.to_3x3() @ hit[1]).normalized()
            if best is None or p.y < best[0].y:
                best = (p, n)
    return best


def export(O, F):
    """The rigid-part hierarchy GLB + its rig sheet (pivots, anchors, eyes)."""
    from mathutils import Vector
    lows = {p.bone: p.low for p in F.parts}
    for b, o in lows.items():
        o.name = b + '_mesh'
        o.data.name = b + '_mesh'
    # the eye centres: on the head's facets where the eye dots are drawn
    head = lows['head']
    eyes = {}
    for nm, sx in (('eye_l', -1), ('eye_r', 1)):
        hit = surface_point([head], sx * O.ex, O.ez)
        p, n = (hit[0], hit[1]) if hit else (Vector((sx * O.ex, O.yF, O.ez)), Vector((0, -1, 0)))
        ax = np.array([n.x * 0.5, -1.0, n.z * 0.35])
        eyes[nm] = (np.array(p), ax / np.linalg.norm(ax))
    E = {}
    allb = ['root'] + [b for b in O.piv if b != 'root']
    for b in allb:
        e = bpy.data.objects.new(b, None)
        bpy.context.scene.collection.objects.link(e)
        E[b] = e
    for b in allb:
        if b == 'root':
            continue
        par = O.par[b]
        E[b].parent = E[par]
        E[b].location = Vector(O.piv[b]) - Vector(O.piv[par])
    bpy.context.view_layer.update()
    # each part's mesh into its joint's frame
    for b, o in lows.items():
        pv = np.asarray(O.piv[b])
        tk.set_verts(o, tk.verts(o) - pv)
        o.parent = E[b]
        o.location = (0, 0, 0)
    # the eye decals (cut from the head after it moved into its frame)
    hp = np.asarray(O.piv['head'])
    decals = []
    for nm, (p, ax) in eyes.items():
        d = eye_decal(head, hp, p, ax, O.er * 2.1, nm)
        d.parent = E['head']
        d.location = Vector(tuple(p - hp))
        decals.append(d)
    # anchors (outfit pieces hang on these; their scale is the wearer's size)
    A = []
    for nm, (at, b, sc) in O.anchors.items():
        e = bpy.data.objects.new(nm, None)
        bpy.context.scene.collection.objects.link(e)
        e.parent = E[b]
        e.location = Vector(at) - Vector(O.piv[b])
        e.scale = (sc, sc, sc)
        A.append(e)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for o in list(E.values()) + list(lows.values()) + decals + A:
        o.select_set(True)
    for o in lows.values():
        facet.flat(o)
    os.makedirs(OUT_GLB, exist_ok=True)
    raw = os.path.join(F.out, O.id + '.raw.glb')
    bpy.context.view_layer.objects.active = head
    bpy.ops.export_scene.gltf(filepath=raw, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_tangents=False, export_normals=True, export_texcoords=True, export_materials='EXPORT',
                              export_image_format='AUTO', export_animations=False, export_skins=False, export_morph=False,
                              export_lights=False, export_cameras=False, export_extras=False)
    # the rig sheet, in the game's frame (glTF: x, z up, -y toward the viewer ... three.js: +z is the owl's front)
    G = lambda p: [round(float(p[0]), 3), round(float(p[2]), 3), round(float(-p[1]), 3)]  # noqa: E731
    V = np.concatenate([tk.verts(o) + np.asarray(O.piv[b]) for b, o in lows.items()])
    meta = {
        'id': O.id, 'tris': F.tris(),
        'pivots': {b: G(O.piv[b]) for b in allb},
        'parents': {b: O.par.get(b) for b in allb if b != 'root'},
        'anchors': {nm: {'at': G(at), 'bone': b, 'scale': sc} for nm, (at, b, sc) in O.anchors.items()},
        'eyes': {nm: {'at': G(p), 'axis': G(ax), 'r': round(O.er, 3), 'patch': round(O.er * 2.1, 3)} for nm, (p, ax) in eyes.items()},
        'min': G(V.min(0)), 'max': G(V.max(0)),
        'height': round(float(V[:, 2].max()), 3),
        'dims': {'bodyZ0': O.bz0, 'bodyZ1': O.bz1, 'bodyW': O.bw, 'bodyD': O.bd, 'headZ': O.hz, 'headW': O.hw, 'headH': O.hh, 'headD': O.hd,
                 'faceY': -O.yF, 'eyeX': O.ex, 'eyeZ': O.ez, 'tuftTop': float(V[:, 2].max())},
    }
    json.dump(meta, open(os.path.join(F.out, O.id + '.rig.json'), 'w'), indent=1)
    import pack
    pack.webp_glb(raw, os.path.join(OUT_GLB, O.id + '.glb'), lossless=True)
    F.log('exported', os.path.join(OUT_GLB, O.id + '.glb'), meta['tris'], 'tris')


def preview(O, F, path):
    lows = [p.low for p in F.parts]
    highs = [h for p in F.parts for h in p.highs]
    paths = []
    H = O.hz + O.hh
    cams = [((0, -88, H * 0.55), (0, 0, H * 0.5)), ((52, -70, H * 0.8), (0, 0, H * 0.5)), ((-58, 62, H * 0.7), (0, 0, H * 0.5)), ((84, 0, H * 0.5), (0, 0, H * 0.5))]
    from fig import montage
    for i, cam in enumerate(cams):
        paths.append(path + f'_h{i}.png')
        tk.preview(paths[-1], highs, cam=cam, res=(340, 340))
    for i, cam in enumerate(cams):
        paths.append(path + f'_l{i}.png')
        tk.preview(paths[-1], lows, cam=cam, res=(340, 340))
    montage(paths, path + '_prev.png', cols=4)


def main(mid):
    spec = specs.get(mid)
    facet.TRIS = (1100, 1950, 1950) if mid == 'queen' else (1100, 1900, 1950)  # (the queen carries her regalia)
    tk.reset()
    F = Fig('owls', mid)
    O = Owl(spec)
    O.build()
    O.commit(F)
    F.log('tris', F.tris(), {p.name: tk.tri_count(p.low) for p in F.parts})
    if '--tris' in FLAGS:
        F.facet_trim()
        F.log('trimmed', F.tris(), {p.name: tk.tri_count(p.low) for p in F.parts})
        return
    if '--preview' in FLAGS:
        F.facet_trim()
        preview(O, F, os.path.join(F.out, mid))
        return
    import paint as pt
    F.unwrap()
    F.bake(ao_samples=24 if '--fast' in FLAGS else 72, ao_dist=6.0, reuse='--repaint' in FLAGS, ao_by_bone=False)
    P = pt.Painter(F.maps, F.region_index, F.size)
    F.finish(paint(P, pt, O), roughness=0.62)
    F.drop_highs()
    export(O, F)


if __name__ == '__main__':
    ids = specs.ALL if ARGS and ARGS[0] == 'all' else ARGS
    for i in ids:
        main(i)
