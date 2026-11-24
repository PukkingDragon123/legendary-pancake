"""Hoot Hollow's outfit pieces as little hand-painted faceted toy accessories (the owls' style: lib/facet.py, paint.py).

    ~/.cache/gg-bpy/bin/python art/blender/owls/outfits.py <id ...> | all  [--fast] [--repaint] [--preview]

Every piece is modelled on the tawny (art/blender/owls/owl.py's Owl, the same measurements) round the anchor it
hangs on (anchor_head / face / neck / chest / back), and exported with its origin at that anchor, so in the game it
drops onto any owl's anchor, which carries that owl's size. Writes public/models/outfits/<id>.glb (a 1024 px
brush-painted WebP atlas) and art/blender/_build/outfits/<id>.piece.json (its anchor, whether it hides ear tufts).
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, '..', 'lib'), HERE]
os.environ.setdefault('GG_FACET', '1')
import numpy as np  # noqa: E402

import tk  # noqa: E402
import bpy  # noqa: E402
import facet  # noqa: E402
import fig  # noqa: E402
from fig import Fig  # noqa: E402
from _bz import Build, low, V3  # noqa: E402
import specs  # noqa: E402
import owl as owlmod  # noqa: E402

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
FLAGS = [a for a in sys.argv[1:] if a.startswith('--')]
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'public', 'models', 'outfits')
facet.TRIS = (200, 900, 1000)

PIECES = {}


def piece(pid, anchor, hides=False):
    def deco(fn):
        PIECES[pid] = (anchor, hides, fn)
        return fn
    return deco


# ====================================================================== shared shapes
def head_section(O, z, grow=0.0):
    """The tawny's head at height z: (half width, front depth, back depth, centre y) plus `grow` mm."""
    t = np.clip((z - O.hz) / (O.hh * 0.55), -0.99, 0.99)
    k = math.sqrt(max(0.0, 1 - t ** 2.2)) if t > 0 else 1.0
    return O.hw * 0.5 * k + grow, O.hd * 0.47 * k + grow, O.hd * 0.44 * k + grow, O.hy


def ring_pts(hw, ft, bk, yc, z, n=16, wob=0.0, ph=0.0):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 1 + wob * math.sin(a * 3 + ph)
        pts.append((math.sin(a) * hw * r, yc - math.cos(a) * (ft if math.cos(a) > 0 else bk) * r, z))
    return pts


def shell(name, O, z0, z1, grow, arc=360.0, centre=0.0, n=20, rings=6, body=True, flare=0.0, th=0.9):
    """A garment shell round the body (or head) between heights z0..z1, `grow` mm off the surface, an open arc of
    `arc` degrees centred on `centre` (0 = the front, 180 = the back), flaring by `flare` mm toward z0."""
    V, F = [], []
    m = n + 1
    for r in range(rings):
        f = r / (rings - 1)
        z = z0 + (z1 - z0) * f
        hw, ft, bk, yc = O.body_at(z) if body else head_section(O, z)
        g = grow + flare * (1 - f) ** 1.5
        for i in range(m):
            a = math.radians(centre - arc / 2 + arc * i / n)
            x = math.sin(a) * (hw + g)
            y = yc - math.cos(a) * ((ft if math.cos(a) > 0 else bk) + g)
            V.append((x, y, z))
    closed = arc >= 359.9
    for r in range(rings - 1):
        for i in range(n if not closed else n):
            a, b = r * m + i, r * m + i + 1
            F.append((a, b, b + m, a + m))
    o = tk.from_pydata(name, V, F)
    if closed:
        bpy.context.view_layer.objects.active = o
        bm_merge(o)
    sol = o.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = th
    sol.offset = 1.0
    tk.apply(o)
    tk.fix_normals(o)
    return o


def bm_merge(o, d=0.01):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=d)
    bm.to_mesh(o.data)
    bm.free()


def cone_hat(O, B, name, base_z, grow, rise, tip, n_rings=7, flop=(10.0, 4.0, -4.0), reg='cap', brim=None, pom=None, tilt=(0.0, 0.0)):
    """A soft cone hat on the crown: its band round the head at base_z, rising `rise` mm, the top flopping toward
    `flop`; a rolled brim (region, thickness) and a pompom (region, radius) at the tip."""
    hw, ft, bk, yc = head_section(O, base_z, grow)
    c0 = V3(0, yc + (bk - ft) * 0.5, base_z)
    top = c0 + V3(0, 0, rise)
    tipp = top + V3(*flop)
    rings = []
    for i in range(n_rings):
        t = i / (n_rings - 1)
        # the spine: up from the band, then over toward the tip (a soft bezier)
        p = (1 - t) ** 2 * c0 + 2 * (1 - t) * t * top + t ** 2 * tipp
        w = (1 - t) ** 0.72 * (hw * 2) + t * tip
        d = (1 - t) ** 0.72 * (ft + bk) + t * tip
        rings.append(dict(c=tuple(p), w=max(w, 0.4), h=max(d * 0.5, 0.2), e=2.0))
    o = tk.loft(name, rings, n=14, up=(0, -1, 0), cap0=None, cap1='round')
    sol = o.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = 0.8
    tk.apply(o)

    def soft(h):
        tk.push(h, lambda V, N: 0.18 * np.sin(V[:, 2] * 1.3 + V[:, 0] * 0.6) * np.sin(V[:, 1] * 1.1))
    B.add('piece', low(o, name, 260, lo=1, hi=2, sculpt=soft, region=reg))
    if brim:
        breg, bth = brim
        pts = ring_pts(hw + bth * 0.35, ft + bth * 0.35, bk + bth * 0.35, yc, base_z + bth * 0.45, n=18, wob=0.015)
        b = tk.tube(name + '_brim', pts, [bth] * 18, n=8, closed=True, squash=1.25)

        def fluff(h):
            tk.push(h, lambda V, N: 0.22 * np.sin(V[:, 0] * 2.1) * np.sin(V[:, 1] * 2.3 + V[:, 2] * 1.7))
        B.add('piece', low(b, name + '_brim', 140, lo=1, hi=2, sculpt=fluff, region=breg))
    if pom:
        preg, pr = pom
        pm = tk.lathe(name + '_pom', [(0, -pr), (pr * 0.72, -pr * 0.7), (pr, 0), (pr * 0.72, pr * 0.7), (0, pr)], n=10)
        tk.move(pm, tuple(tipp + V3(0, 0, -pr * 0.3)))

        def puff(h):
            tk.push(h, lambda V, N: 0.25 * np.sin(V[:, 0] * 3.1 + 1) * np.sin(V[:, 1] * 2.7) * np.sin(V[:, 2] * 2.9 + 2))
        B.add('piece', low(pm, name + '_pom', 70, lo=1, hi=2, sculpt=puff, region=preg))
    return tipp


def star_pts(r_out, r_in, n=5, a0=90.0):
    pts = []
    for i in range(2 * n):
        a = math.radians(a0 + i * 180.0 / n)
        r = r_out if i % 2 == 0 else r_in
        pts.append((math.cos(a) * r, math.sin(a) * r))
    return pts


def head_band_ring(O, z, grow, n=18):
    hw, ft, bk, yc = head_section(O, z, grow)
    return ring_pts(hw, ft, bk, yc, z, n=n)


# ====================================================================== the pieces
@piece('nightcap', 'anchor_head', hides=True)
def nightcap(O, B, k):
    base = O.hz + O.hh * 0.2
    cone_hat(O, B, 'cap', base, 0.9, 14.0, 1.4, flop=(9.0, 4.0, -2.0), reg='cap', brim=('brim', 1.8), pom=('pom', 2.7))


@piece('santa_hat', 'anchor_head', hides=True)
def santa_hat(O, B, k):
    base = O.hz + O.hh * 0.27
    cone_hat(O, B, 'cap', base, 1.0, 14.5, 1.3, flop=(-7.0, 7.0, -3.0), reg='velvet', brim=('fur', 2.3), pom=('fur', 3.0))


@piece('beanie', 'anchor_head', hides=True)
def beanie(O, B, k):
    base = O.hz + O.hh * 0.22
    cone_hat(O, B, 'cap', base, 0.9, 6.0, 9.0, n_rings=6, flop=(0.0, 0.0, 1.0), reg='knit', brim=('rib', 1.6), pom=('pom', 2.4))


@piece('wizard', 'anchor_head', hides=True)
def wizard(O, B, k):
    base = O.hz + O.hh * 0.26
    hw, ft, bk, yc = head_section(O, base, 1.0)
    # a wide floppy brim, then the tall crooked cone
    pts = ring_pts(hw + 5.5, ft + 5.5, bk + 5.5, yc, base, n=20, wob=0.04)
    br = tk.loft('brim', [dict(c=(0, yc, base - 0.2), w=(hw + 5.5) * 2, h=(ft + bk + 11) * 0.5, e=2.0), dict(c=(0, yc, base + 0.4), w=(hw + 0.5) * 2, h=(ft + bk + 1) * 0.5, e=2.0)],
                 n=18, up=(0, -1, 0), cap0=None, cap1=None)
    sol = br.modifiers.new('s', 'SOLIDIFY')
    sol.thickness = 0.7
    tk.apply(br)
    B.add('piece', low(br, 'brim', 120, region='hat'))
    cone_hat(O, B, 'cone', base + 0.3, 0.6, 15.0, 0.6, flop=(4.0, 6.0, 3.0), reg='hat', brim=('band', 1.0))


@piece('star_crown', 'anchor_head')
def star_crown(O, B, k):
    z = O.hz + O.hh * 0.36
    hw, ft, bk, yc = head_section(O, z, 0.6)
    band = tk.loft('band', [dict(c=(0, yc, z - 0.4), w=hw * 2, h=(ft + bk) * 0.5, e=2.0), dict(c=(0, yc, z + 2.2), w=hw * 2 + 0.8, h=(ft + bk + 0.8) * 0.5, e=2.0)],
                   n=20, up=(0, -1, 0), cap0=None, cap1=None)
    sol = band.modifiers.new('s', 'SOLIDIFY')
    sol.thickness = 0.8
    tk.apply(band)
    B.add('piece', low(band, 'band', 120, region='gold'))
    for i in range(5):
        a = math.radians(-90 + (i - 2) * 34)
        x, y = math.cos(a) * (hw + 0.4), yc + math.sin(a) * (ft + 0.4)
        h = 4.6 if i == 2 else 3.6
        st = tk.slab(f'star{i}', star_pts(3.0 if i == 2 else 2.4, 1.3 if i == 2 else 1.05), 1.1, plane='XZ', at=0.0, bevel=0.25, segs=1)
        tk.rotate(st, math.degrees(math.atan2(x, -(y - yc))), 'Z')
        tk.move(st, (x, y, z + 2.2 + h))
        B.add('piece', low(st, f'star{i}', 40, region='star'))
        sp = tk.tube(f'spike{i}', [(x, y, z + 1.6), (x * 1.02, y, z + 2.2 + h - 1.6)], [0.9, 0.6], n=6)
        B.add('piece', low(sp, f'spike{i}', 20, region='gold'))


@piece('ice_crown', 'anchor_head')
def ice_crown(O, B, k):
    z = O.hz + O.hh * 0.36
    hw, ft, bk, yc = head_section(O, z, 0.6)
    band = tk.loft('band', [dict(c=(0, yc, z - 0.4), w=hw * 2, h=(ft + bk) * 0.5, e=2.0), dict(c=(0, yc, z + 1.8), w=hw * 2 + 0.6, h=(ft + bk + 0.6) * 0.5, e=2.0)],
                   n=20, up=(0, -1, 0), cap0=None, cap1=None)
    sol = band.modifiers.new('s', 'SOLIDIFY')
    sol.thickness = 0.8
    tk.apply(band)
    B.add('piece', low(band, 'band', 120, region='silver'))
    from mathutils import Vector
    for i in range(7):
        a = math.radians(-90 + (i - 3) * 24)
        b0 = V3(math.cos(a) * (hw + 0.2), yc + math.sin(a) * (ft + 0.2), z + 1.0)
        h = (6.6 if i == 3 else 4.8 if abs(i - 3) == 1 else 3.6 if abs(i - 3) == 2 else 2.8)
        o = tk.lathe(f'spike{i}', [(0, 0), (1.5, 0.3), (1.3, h * 0.55), (0, h * 1.15)], n=5)
        out = V3(math.cos(a), math.sin(a), 0) * 0.3
        q = Vector((0, 0, 1)).rotation_difference(Vector(tuple(out + V3(0, 0, 1))))
        tk.transform(o, q.to_matrix().to_4x4())
        tk.move(o, tuple(b0))
        B.add('piece', low(o, f'spike{i}', 14, region='ice'))
    gem = tk.lathe('gem', [(0, -1.1), (1.1, 0), (0, 1.1)], n=6)
    tk.rotate(gem, 90, 'X')
    tk.move(gem, (0, yc - ft - 1.0, z + 0.9))
    B.add('piece', low(gem, 'gem', 12, region='gem'))


@piece('reindeer_antlers', 'anchor_head')
def antlers(O, B, k):
    z = O.hz + O.hh * 0.3
    hw, ft, bk, yc = head_section(O, z, 0.5)
    # the headband: an arc over the crown from ear to ear
    pts = []
    for i in range(13):
        a = math.radians(-90 + 180 * i / 12)
        zz = O.hz + O.hh * 0.06 + (O.hh * 0.5 + 0.7 - O.hh * 0.06) * math.cos(a) ** 0.85
        hws = head_section(O, zz, 0.7)[0]
        pts.append((math.sin(a) * hws, yc + 0.8, zz))
    band = tk.tube('band', pts, [0.85] * 13, n=6, squash=0.6, up=(0, 1, 0))
    B.add('piece', low(band, 'band', 90, region='band'))
    for sx in (-1, 1):
        r0 = V3(sx * hw * 0.62, yc + 0.6, O.hz + O.hh * 0.46)
        beam = [r0, r0 + V3(sx * 2.2, 0.2, 3.0), r0 + V3(sx * 4.8, 0.6, 5.4), r0 + V3(sx * 6.0, 1.0, 8.6)]
        B.add('piece', low(tk.tube(f'beam{sx}', [tuple(p) for p in beam], [1.6, 1.35, 1.1, 0.65], n=7, cap1='round'), f'beam{sx}', 60, region='antler'))
        for j, (f, d, L) in enumerate(((0.35, V3(-sx * 0.6, -0.4, 1.0), 2.8), (0.62, V3(sx * 0.2, -0.6, 1.0), 2.6), (0.85, V3(sx * 1.0, 0.0, 0.5), 2.2))):
            i0 = int(f * (len(beam) - 1))
            t = f * (len(beam) - 1) - i0
            p0 = beam[i0] * (1 - t) + beam[min(i0 + 1, len(beam) - 1)] * t
            dd = d / np.linalg.norm(d)
            B.add('piece', low(tk.tube(f'tine{sx}{j}', [tuple(p0), tuple(p0 + dd * L * 0.6 + V3(0, 0, 0.3)), tuple(p0 + dd * L)], [0.95, 0.75, 0.45], n=6, cap1='round'),
                               f'tine{sx}{j}', 30, region='antler'))
    # a little jingle bell at the band's left end
    bl = tk.lathe('bell', [(0, -1.2), (1.1, -1.0), (1.3, 0.0), (0.9, 0.9), (0.2, 1.3), (0, 1.4)], n=8)
    tk.move(bl, (-hw * 0.9, yc + 0.4, O.hz + O.hh * 0.06 - 1.0))
    B.add('piece', low(bl, 'bell', 40, region='brass'))


@piece('candy_scarf', 'anchor_neck')
def candy_scarf(O, B, k):
    z = O.bz1 - 2.6
    hw, ft, bk, yc = O.body_at(z)
    pts = ring_pts(hw + 1.1, ft + 1.1, bk + 1.1, yc, z, n=16, wob=0.02)
    o = tk.tube('scarf', pts, [2.1] * 16, n=8, closed=True, squash=0.7)

    def knit(h):
        tk.push(h, lambda V, N: 0.16 * (np.abs(np.sin(V[:, 2] * 3.2 + V[:, 0] * 0.3)) > 0.8))
    B.add('piece', low(o, 'scarf', 120, lo=1, hi=2, sculpt=knit, region='scarf'))
    knot = tk.lathe('knot', [(0, -1.6), (1.7, -1.2), (2.0, 0), (1.6, 1.2), (0, 1.6)], n=10)
    tk.scale(knot, (1.0, 0.7, 0.9))
    tk.move(knot, (hw * 0.35, yc - ft - 1.8, z - 0.6))
    B.add('piece', low(knot, 'knot', 50, region='scarf'))
    for j, (dx, L) in enumerate(((0.6, 9.0), (2.6, 7.0))):
        e0 = V3(hw * 0.35 + dx * 0.6, yc - ft - 2.0, z - 1.6)
        o = tk.loft(f'end{j}', [{'c': tuple(e0), 'w': 3.4, 'h': 0.65}, {'c': tuple(e0 + V3(dx * 0.4, -0.9, -L * 0.5)), 'w': 3.2, 'h': 0.6},
                                {'c': tuple(e0 + V3(dx * 0.8, -1.3, -L)), 'w': 3.5, 'h': 0.6}], n=8, up=(0, -1, 0), cap0='round', cap1='flat')
        B.add('piece', low(o, f'end{j}', 50, region='scarf'))
        for t in range(4):
            fr = tk.tube(f'fr{j}{t}', [tuple(e0 + V3(dx * 0.8 - 1.2 + t * 0.8, -1.3, -L - 0.1)), tuple(e0 + V3(dx * 0.8 - 1.2 + t * 0.8, -1.4, -L - 1.3))], [0.32, 0.22], n=5)
            B.add('piece', low(fr, f'fr{j}{t}', 10, region='fringe'))


@piece('scarf', 'anchor_neck')
def scarf(O, B, k):
    candy_scarf(O, B, k)


@piece('holiday_sweater', 'anchor_chest')
def holiday_sweater(O, B, k):
    z0, z1 = O.bz0 + O.bh * 0.22, O.bz1 - 1.6
    o = shell('jumper', O, z0, z1, 0.5, arc=250, centre=0, n=22, rings=7, flare=0.4, th=0.8)

    def knit(h):
        tk.push(h, lambda V, N: 0.12 * (np.abs(np.sin(V[:, 2] * 2.6)) > 0.85) - 0.06 * (np.abs(np.sin(V[:, 0] * 2.2 + V[:, 1] * 1.5)) > 0.9))
    B.add('piece', low(o, 'jumper', 320, lo=1, hi=2, sculpt=knit, region='knit'))
    # the rolled ribbed hem
    hw, ft, bk, yc = O.body_at(z0)
    pts = []
    for i in range(17):
        a = math.radians(-125 + 250 * i / 16)
        pts.append((math.sin(a) * (hw + 1.1), yc - math.cos(a) * ((ft if math.cos(a) > 0 else bk) + 1.1), z0 + 0.3))
    hem = tk.tube('hem', pts, [0.9] * 17, n=6, squash=1.0)
    B.add('piece', low(hem, 'hem', 80, region='rib'))


@piece('moon_cape', 'anchor_back')
def moon_cape(O, B, k):
    z0, z1 = O.bz0 + 0.8, O.bz1 - 0.8
    o = shell('cape', O, z0, z1, 2.4, arc=200, centre=180, n=22, rings=7, flare=2.2, th=0.75)

    def folds(h):
        def f(V, N):
            a = np.arctan2(V[:, 0], V[:, 1])
            return 0.4 * tk.smoothstep(z1, z0 + O.bh * 0.4, V[:, 2]) * np.sin(a * 8)
        tk.push(h, f)
    B.add('piece', low(o, 'cape', 300, lo=1, hi=2, sculpt=folds, region='cape'))
    # the collar and a crescent-moon clasp at the throat
    z = O.bz1 - 1.6
    hw, ft, bk, yc = O.body_at(z)
    pts = ring_pts(hw + 2.0, ft + 1.8, bk + 2.2, yc, z, n=16)
    col = tk.tube('collar', pts, [1.0] * 16, n=6, closed=True, squash=0.9)
    B.add('piece', low(col, 'collar', 90, region='trim'))
    pts = []
    for i in range(13):
        a = math.radians(-120 + 240 * i / 12)
        pts.append((math.cos(a) * 2.0, math.sin(a) * 2.0))
    for i in range(13):
        a = math.radians(120 - 240 * i / 12)
        pts.append((math.cos(a) * 1.4 + 0.9, math.sin(a) * 1.5))
    m = tk.slab('moon', pts, 0.8, plane='XZ', at=0.0, bevel=0.25, segs=1)
    tk.rotate(m, 20, 'Y')
    tk.move(m, (0, yc - ft - 2.6, z - 0.8))
    B.add('piece', low(m, 'moon', 40, region='silver'))


@piece('frost_cape', 'anchor_back')
def frost_cape(O, B, k):
    z0, z1 = O.bz0 + 0.6, O.bz1 - 0.8
    o = shell('cape', O, z0, z1, 2.4, arc=210, centre=180, n=22, rings=7, flare=2.4, th=0.75)

    def folds(h):
        def f(V, N):
            a = np.arctan2(V[:, 0], V[:, 1])
            return 0.4 * tk.smoothstep(z1, z0 + O.bh * 0.4, V[:, 2]) * np.sin(a * 9)
        tk.push(h, f)
    B.add('piece', low(o, 'cape', 300, lo=1, hi=2, sculpt=folds, region='cape'))
    z = O.bz1 - 1.8
    hw, ft, bk, yc = O.body_at(z)
    pts = ring_pts(hw + 2.2, ft + 1.9, bk + 2.4, yc, z, n=16, wob=0.03)
    col = tk.tube('collar', pts, [2.0] * 16, n=8, closed=True, squash=0.85)

    def fluff(h):
        tk.push(h, lambda V, N: 0.25 * np.sin(V[:, 0] * 2.3) * np.sin(V[:, 1] * 2.1 + V[:, 2] * 1.9))
    B.add('piece', low(col, 'collar', 140, lo=1, hi=2, sculpt=fluff, region='fur'))
    gem = tk.lathe('clasp', [(0, -0.6), (1.6, -0.4), (1.7, 0.2), (0, 0.6)], n=6)
    tk.rotate(gem, 90, 'X')
    tk.move(gem, (0, yc - ft - 3.6, z - 0.4))
    B.add('piece', low(gem, 'clasp', 16, region='gem'))


@piece('royalcape', 'anchor_back')
def royalcape(O, B, k):
    frost_cape(O, B, k)


@piece('glasses', 'anchor_face')
def glasses(O, B, k):
    # two round wire rims round the eyes and a bridge, resting on the beak
    y = O.yF - 1.4
    for sx in (-1, 1):
        cx, cz = sx * O.ex, O.ez
        pts = [(cx + math.cos(2 * math.pi * i / 14) * 3.6, y + 0.15 * abs(math.cos(2 * math.pi * i / 14)) * sx * sx, cz + math.sin(2 * math.pi * i / 14) * 3.3) for i in range(14)]
        B.add('piece', low(tk.tube(f'rim{sx}', pts, [0.42] * 14, n=5, closed=True), f'rim{sx}', 60, region='wire'))
        arm = tk.tube(f'arm{sx}', [(cx + sx * 3.6, y, cz + 0.4), (sx * O.hw * 0.48, y + 4.0, cz + 1.0)], [0.32, 0.3], n=5)
        B.add('piece', low(arm, f'arm{sx}', 16, region='wire'))
    br = tk.tube('bridge', [(-O.ex + 3.4, y, O.ez + 0.8), (0, y - 0.6, O.ez + 1.4), (O.ex - 3.4, y, O.ez + 0.8)], [0.36] * 3, n=5)
    B.add('piece', low(br, 'bridge', 20, region='wire'))


@piece('monocle', 'anchor_face')
def monocle(O, B, k):
    y, cx, cz = O.yF - 1.5, O.ex, O.ez
    pts = [(cx + math.cos(2 * math.pi * i / 16) * 3.9, y, cz + math.sin(2 * math.pi * i / 16) * 3.7) for i in range(16)]
    B.add('piece', low(tk.tube('rim', pts, [0.5] * 16, n=6, closed=True), 'rim', 70, region='gold'))
    ch = [(cx + 3.6, y + 0.2, cz - 1.6), (cx + 5.0, y + 1.4, cz - 5.0), (cx + 4.6, y + 2.6, cz - 9.0), (cx + 2.6, y + 2.4, cz - 12.0)]
    B.add('piece', low(tk.tube('chain', ch, [0.28] * 4, n=5), 'chain', 30, region='gold'))


def sweater_like(O, B, name, arc=250, z0f=0.22, grow=0.5, collar=True, buttons=0, hood=False):
    z0, z1 = O.bz0 + O.bh * z0f, O.bz1 - 1.6
    o = shell(name, O, z0, z1, grow, arc=arc, centre=0, n=22, rings=7, flare=0.4, th=0.8)

    def knit(h):
        tk.push(h, lambda V, N: 0.12 * (np.abs(np.sin(V[:, 2] * 2.6)) > 0.85) - 0.06 * (np.abs(np.sin(V[:, 0] * 2.2 + V[:, 1] * 1.5)) > 0.9))
    B.add('piece', low(o, name, 320, lo=1, hi=2, sculpt=knit, region='knit'))
    hw, ft, bk, yc = O.body_at(z0)
    pts = []
    for i in range(17):
        a = math.radians(-arc / 2 + arc * i / 16)
        pts.append((math.sin(a) * (hw + grow + 0.6), yc - math.cos(a) * ((ft if math.cos(a) > 0 else bk) + grow + 0.6), z0 + 0.3))
    B.add('piece', low(tk.tube('hem', pts, [0.9] * 17, n=6), 'hem', 80, region='rib'))
    for i in range(buttons):
        z = z1 - 2.5 - i * (z1 - z0 - 4) / max(1, buttons - 1)
        hw, ft, bk, yc = O.body_at(z)
        b = tk.lathe(f'btn{i}', [(0, -0.4), (0.9, -0.3), (1.0, 0.1), (0, 0.4)], n=8)
        tk.rotate(b, 90, 'X')
        tk.move(b, (0, yc - ft - grow - 1.0, z))
        B.add('piece', low(b, f'btn{i}', 16, region='button'))


@piece('sweater', 'anchor_chest')
def sweater(O, B, k):
    sweater_like(O, B, 'jumper')


@piece('pajamas', 'anchor_chest')
def pajamas(O, B, k):
    sweater_like(O, B, 'pj', arc=260, z0f=0.1, buttons=3)


@piece('cardigan', 'anchor_chest')
def cardigan(O, B, k):
    sweater_like(O, B, 'cardi', arc=230, buttons=3)


@piece('raincoat', 'anchor_chest')
def raincoat(O, B, k):
    sweater_like(O, B, 'coat', arc=270, z0f=0.05, grow=0.7, buttons=2)


@piece('cloudcloak', 'anchor_back')
def cloudcloak(O, B, k):
    z0, z1 = O.bz0 + 1.0, O.bz1 - 0.8
    o = shell('cloak', O, z0, z1, 2.6, arc=220, centre=180, n=22, rings=7, flare=2.0, th=0.9)

    def puff(h):
        tk.push(h, lambda V, N: 0.55 * np.abs(np.sin(V[:, 0] * 0.9 + 1.0) * np.sin(V[:, 2] * 0.8)) * (N[:, 1] > -0.2))
    B.add('piece', low(o, 'cloak', 300, lo=1, hi=2, sculpt=puff, region='cloud'))
    z = O.bz1 - 1.8
    hw, ft, bk, yc = O.body_at(z)
    col = tk.tube('collar', ring_pts(hw + 2.2, ft + 1.9, bk + 2.4, yc, z, n=16, wob=0.05), [1.9] * 16, n=8, closed=True, squash=0.85)
    B.add('piece', low(col, 'collar', 120, region='cloud'))


@piece('bowtie', 'anchor_neck')
def bowtie(O, B, k):
    z = O.bz1 - 3.2
    hw, ft, bk, yc = O.body_at(z)
    c = V3(0, yc - ft - 0.8, z)
    for sx in (-1, 1):
        o = tk.loft(f'wing{sx}', [{'c': tuple(c + V3(sx * 0.6, 0, 0)), 'w': 1.6, 'h': 0.6}, {'c': tuple(c + V3(sx * 3.0, -0.2, 0)), 'w': 3.8, 'h': 0.8},
                                  {'c': tuple(c + V3(sx * 4.2, -0.1, 0)), 'w': 3.4, 'h': 0.7}], n=8, up=(0, -1, 0), cap0='round', cap1='round')
        B.add('piece', low(o, f'wing{sx}', 50, region='velvet'))
    kn = tk.lathe('knot', [(0, -1.0), (1.1, -0.8), (1.3, 0), (1.1, 0.8), (0, 1.0)], n=8)
    tk.rotate(kn, 90, 'X')
    tk.move(kn, tuple(c + V3(0, -0.6, 0)))
    B.add('piece', low(kn, 'knot', 30, region='velvet'))


@piece('bandana', 'anchor_neck')
def bandana(O, B, k):
    z = O.bz1 - 2.4
    hw, ft, bk, yc = O.body_at(z)
    B.add('piece', low(tk.tube('band', ring_pts(hw + 0.9, ft + 0.9, bk + 0.9, yc, z, n=16), [1.1] * 16, n=6, closed=True, squash=0.8), 'band', 90, region='cloth'))
    # the triangle hanging down the breast
    zz = z - 1.0
    w = hw * 1.25
    pts = [(-w, zz), (w, zz), (0, zz - 8.5)]
    o = tk.slab('tri', pts, 0.8, plane='XZ', at=0.0, bevel=0.3, segs=1)
    tk.subsurf(o, 1)

    def hugf(V):
        V = V.copy()
        _, ftz, _, ycz = O.body_at(np.clip(V[:, 2], O.bz0, O.bz1))
        V[:, 1] = ycz - (ftz + 0.9) * np.sqrt(np.clip(1 - (V[:, 0] / (hw + 2.0)) ** 2, 0.05, 1)) + V[:, 1]
        return V
    tk.deform(o, hugf)
    tk.fix_normals(o)
    B.add('piece', low(o, 'tri', 80, region='cloth'))


@piece('bell', 'anchor_neck')
def bell(O, B, k):
    z = O.bz1 - 2.6
    hw, ft, bk, yc = O.body_at(z)
    B.add('piece', low(tk.tube('collar', ring_pts(hw + 0.8, ft + 0.8, bk + 0.8, yc, z, n=16), [0.8] * 16, n=6, closed=True, squash=1.4), 'collar', 90, region='leather'))
    bl = tk.lathe('bell', [(0, -2.0), (1.9, -1.6), (2.2, -0.6), (1.6, 0.8), (0.6, 1.5), (0, 1.7)], n=10)
    tk.move(bl, (0, yc - ft - 2.2, z - 2.4))
    B.add('piece', low(bl, 'bell', 60, region='silver'))


@piece('moonpendant', 'anchor_neck')
def moonpendant(O, B, k):
    z = O.bz1 - 2.4
    hw, ft, bk, yc = O.body_at(z)
    pts = []
    for i in range(16):
        a = 2 * math.pi * i / 16
        dz = -3.2 * max(0, math.cos(a)) ** 2
        pts.append((math.sin(a) * (hw + 0.7), yc - math.cos(a) * ((ft if math.cos(a) > 0 else bk) + 0.7), z + dz))
    B.add('piece', low(tk.tube('chain', pts, [0.3] * 16, n=5, closed=True), 'chain', 60, region='silver'))
    pts = []
    for i in range(13):
        a = math.radians(-120 + 240 * i / 12)
        pts.append((math.cos(a) * 2.2, math.sin(a) * 2.2))
    for i in range(13):
        a = math.radians(120 - 240 * i / 12)
        pts.append((math.cos(a) * 1.6 + 1.0, math.sin(a) * 1.7))
    m = tk.slab('moon', pts, 1.0, plane='XZ', at=0.0, bevel=0.3, segs=1)
    tk.move(m, (0, yc - ft - 1.6, z - 5.6))
    B.add('piece', low(m, 'moon', 40, region='moonstone'))


@piece('sleepmask', 'anchor_head')
def sleepmask(O, B, k):
    z = O.ez + O.er * 3.6
    hw, ft, bk, yc = head_section(O, z, 0.5)
    B.add('piece', low(tk.tube('band', ring_pts(hw, ft, bk, yc, z, n=18), [0.7] * 18, n=6, closed=True, squash=1.6), 'band', 90, region='band'))
    for sx in (-1, 1):
        o = tk.lathe(f'eye{sx}', [(0, -0.6), (3.3, -0.5), (3.6, 0.0), (3.2, 0.5), (0, 0.6)], n=12)
        tk.scale(o, (1.0, 1.0, 0.75))
        tk.rotate(o, 90, 'X')
        tk.rotate(o, -sx * 18, 'Z')
        tk.move(o, (sx * O.ex * 0.85, O.yF + 1.4, z + 0.3))
        B.add('piece', low(o, f'eye{sx}', 50, region='satin'))


@piece('acorn', 'anchor_head', hides=True)
def acorn(O, B, k):
    base = O.hz + O.hh * 0.22
    hw, ft, bk, yc = head_section(O, base, 1.0)
    cap = tk.loft('cap', [dict(c=(0, yc, base), w=hw * 2 + 1.2, h=(ft + bk + 1.2) * 0.5, e=2.0), dict(c=(0, yc, base + 4.0), w=hw * 1.8, h=(ft + bk) * 0.45, e=2.0),
                          dict(c=(0, yc, base + 7.5), w=hw * 1.1, h=(ft + bk) * 0.28, e=2.0)], n=16, up=(0, -1, 0), cap0=None, cap1='round')
    sol = cap.modifiers.new('s', 'SOLIDIFY')
    sol.thickness = 0.9
    tk.apply(cap)

    def scales(h):
        tk.push(h, lambda V, N: 0.3 * (np.abs(np.sin(V[:, 2] * 2.4 + np.arctan2(V[:, 0], V[:, 1]) * 6)) > 0.7))
    B.add('piece', low(cap, 'cap', 220, lo=1, hi=2, sculpt=scales, region='cupule'))
    st = tk.tube('stem', [(0, yc, base + 8.5), (0.6, yc, base + 10.5), (1.8, yc + 0.3, base + 11.4)], [0.9, 0.7, 0.5], n=6)
    B.add('piece', low(st, 'stem', 24, region='stem'))


@piece('toadstool', 'anchor_head', hides=True)
def toadstool(O, B, k):
    base = O.hz + O.hh * 0.26
    hw, ft, bk, yc = head_section(O, base, 1.0)
    cap = tk.lathe('cap', [(0, 6.5), (hw * 0.7, 5.6), (hw * 1.18, 2.6), (hw * 1.3, 0.2), (hw * 1.18, -0.4), (hw * 0.8, -0.2), (0, 0.2)], n=18)
    tk.scale(cap, (1.0, (ft + bk) / (2 * hw), 1.0))
    tk.move(cap, (0, yc, base))
    B.add('piece', low(cap, 'cap', 220, lo=1, hi=2, region=('cap', [('gills', lambda C, N: N[:, 2] < -0.3)])))


@piece('sprout', 'anchor_head')
def sprout(O, B, k):
    top = O.hz + O.hh * 0.5
    st = tk.tube('stem', [(0, O.hy, top - 1.0), (0.3, O.hy, top + 2.6), (0.2, O.hy + 0.2, top + 4.4)], [0.55, 0.45, 0.35], n=6)
    B.add('piece', low(st, 'stem', 24, region='stem'))
    for sx in (-1, 1):
        pts = [(0, 0), (sx * 2.2, 1.0), (sx * 4.2, 0.6), (sx * 5.0, -0.2), (sx * 3.0, -1.0), (sx * 1.2, -0.8)]
        if sx < 0:
            pts = pts[::-1]
        o = tk.slab(f'leaf{sx}', pts, 0.5, plane='XZ', at=0.0, bevel=0.2, segs=1)
        tk.subsurf(o, 1)
        tk.rotate(o, sx * 20, 'Y')
        tk.move(o, (0.2, O.hy + 0.2, top + 4.2))
        B.add('piece', low(o, f'leaf{sx}', 40, region='leaf'))


@piece('lantern', 'anchor_back')
def lantern(O, B, k):
    z = O.bz0 + O.bh * 0.5
    hw, ft, bk, yc = O.body_at(z)
    y = yc + bk + 3.0
    jar = tk.lathe('jar', [(0, -3.4), (2.4, -3.2), (2.8, -1.6), (2.8, 1.8), (2.2, 2.8), (1.6, 3.2), (0, 3.2)], n=12)
    tk.move(jar, (hw * 0.4, y, z - 1.0))
    B.add('piece', low(jar, 'jar', 90, region='glass'))
    lid = tk.lathe('lid', [(0, 3.0), (1.9, 3.0), (2.0, 3.8), (0, 4.0)], n=10)
    tk.move(lid, (hw * 0.4, y, z - 1.0))
    B.add('piece', low(lid, 'lid', 30, region='brass'))
    strap = tk.tube('strap', [(hw * 0.4, y, z + 3.2), (hw * 0.4, y - 1.6, z + 6.5), (0, yc + bk - 0.6, z + 8.0)], [0.4] * 3, n=5)
    B.add('piece', low(strap, 'strap', 24, region='leather'))
    for i in range(4):  # the fireflies inside
        f = tk.lathe(f'fly{i}', [(0, -0.4), (0.4, 0), (0, 0.4)], n=6)
        tk.move(f, (hw * 0.4 + math.cos(i * 1.7) * 1.2, y + math.sin(i * 2.3) * 1.0, z - 1.5 + i * 1.0))
        B.add('piece', low(f, f'fly{i}', 8, region='glow'))


@piece('fairywings', 'anchor_back')
def fairywings(O, B, k):
    z = O.bz0 + O.bh * 0.62
    hw, ft, bk, yc = O.body_at(z)
    y = yc + bk + 0.4
    for sx in (-1, 1):
        for j, (L, a, zz) in enumerate(((9.5, 38, 1.0), (6.5, -18, -2.4))):
            pts = [(0, 0), (L * 0.35, L * 0.35), (L * 0.9, L * 0.45), (L, L * 0.15), (L * 0.75, -L * 0.15), (L * 0.3, -L * 0.12)]
            if sx < 0:
                pts = [(-x, y_) for x, y_ in pts][::-1]
            o = tk.slab(f'w{sx}{j}', pts, 0.35, plane='XZ', at=0.0, bevel=0.12, segs=1)
            tk.subsurf(o, 1)
            tk.rotate(o, sx * a, 'Y')
            tk.rotate(o, -25, 'X')
            tk.move(o, (sx * 1.0, y + 1.0, z + zz))
            B.add('piece', low(o, f'w{sx}{j}', 50, region='gauze'))


# ====================================================================== paint
def paint(P, pt, pid):
    import face  # noqa: F401
    sh = P.shade(light=0.0, ao=0.85, cav=1.1)
    X, Y, Z = P.X, P.Y, P.Z
    reg = P.region

    def fill(r, col, base=0.1, brush='cloth', n=7, tex=None, **kw):
        kw.setdefault('shift', 0.06)
        return P.fill(r, pt.ramp(col, n, **kw), tone=sh, base=base, brush=brush, tex=tex)

    def knit(m, col, col2=None, period=1.3):
        # V stitches in columns: alternating light / dark half-stitches
        u = np.arctan2(X, -Y) * 12.0 / period
        v = Z / (period * 0.9)
        st = (np.mod(u + 0.5 * np.sign(np.mod(u, 1.0) - 0.5) * np.mod(v, 1.0), 1.0) < 0.5)
        P.shift(m & st & (P.idx >= 0), 1)
        P.shift(m & (np.mod(v, 1.0) < 0.12) & (P.idx >= 0), -1)

    if pid in ('nightcap',):
        fill('cap', '#4a5a86', 0.05)
        cap = reg('cap')
        st = cap & owlmod._dots(P, 0.55, 2.6, seed=4)
        fill(st, '#f1d39a', 0.25, brush='pvc', n=6)
        fill('brim', '#efe6d0', 0.15, brush='cloth')
        fill('pom', '#f4eedd', 0.2, brush='fur')
    elif pid == 'santa_hat':
        fill('velvet', '#b2504a', 0.05, brush={'preset': 'cloth', 'L': 1.6, 'W': 0.4})
        fill('fur', '#f4f1e8', 0.2, brush='fur')
    elif pid == 'beanie':
        fill('knit', '#86a06a', 0.05)
        knit(reg('knit'), None)
        fill('rib', '#66844f', 0.05)
        P.shift(reg('rib') & (np.mod(np.arctan2(X, -Y) * 30 / math.pi, 1.0) < 0.4) & (P.idx >= 0), 1)
        fill('pom', '#dcb072', 0.2, brush='fur')
    elif pid == 'wizard':
        fill('hat', '#4e4a78', 0.05)
        hat = reg('hat')
        st = hat & owlmod._dots(P, 0.5, 2.8, seed=7)
        fill(st, '#f1d39a', 0.3, brush='pvc', n=6)
        fill('band', '#c8a764', 0.15, brush='metal')
    elif pid == 'star_crown':
        fill('gold', '#d8b45c', 0.15, brush='metal')
        fill('star', '#f1d39a', 0.25, brush={'preset': 'gloss', 'shine': 0.6})
    elif pid == 'ice_crown':
        fill('silver', '#c8ccd0', 0.1, brush='metal')
        fill('ice', '#bcd8e0', 0.25, brush={'preset': 'gloss', 'shine': 0.6}, light=0.6)
        fill('gem', '#9cc8d8', 0.3, brush={'preset': 'gloss', 'shine': 0.8}, light=0.6)
    elif pid == 'reindeer_antlers':
        fill('band', '#9e5f66', 0.05, brush='cloth')
        fill('antler', '#9c7a56', 0.1, brush={'preset': 'fur', 'L': 1.2, 'W': 0.4}, tex='fur')
        fill('brass', '#d8b45c', 0.2, brush='metal')
    elif pid in ('candy_scarf', 'scarf'):
        c1, c2 = ('#b2504a', '#f4eedd') if pid == 'candy_scarf' else ('#c0866a', '#dcb072')
        for r in ('scarf', 'fringe'):
            fill(r, c2, 0.1)
        m = reg('scarf') | reg('fringe')
        stripe = m & (np.mod((X * 0.8 + Z * 1.1 + Y * 0.3) / 3.0, 1.0) < 0.5)
        fill(stripe, c1, 0.05)
        knit(m, None)
    elif pid == 'holiday_sweater':
        fill('knit', '#b2504a', 0.05)
        m = reg('knit')
        zc = Z
        band1 = m & (np.abs(zc - (Z.max() - 3.0)) < 1.2) if m.any() else m
        top = float(Z[m].max()) if m.any() else 0
        bot = float(Z[m].min()) if m.any() else 0
        zig = m & (np.abs(Z - (top - 2.6) - 0.8 * np.abs(np.mod(X / 1.6, 2.0) - 1.0)) < 0.45)
        fill(zig, '#f4eedd', 0.15)
        zig2 = m & (np.abs(Z - (bot + 2.2) - 0.8 * np.abs(np.mod(X / 1.6 + 1.0, 2.0) - 1.0)) < 0.45)
        fill(zig2, '#f4eedd', 0.15)
        band = m & (np.abs(Z - (top - 4.6)) < 0.35)
        fill(band, '#557343', 0.05)
        # snowflakes across the middle, the proud reindeer's red nose at the centre front
        mid = (top + bot) / 2
        for i, xx in enumerate((-7.5, -3.8, 3.8, 7.5)):
            dd = np.hypot(X - xx, Z - mid - (0.8 if i % 2 else -0.4))
            ang = np.arctan2(Z - mid, X - xx)
            flake = m & (dd < 1.5) & ((np.abs(np.sin(ang * 3)) * dd < 0.28) | (dd < 0.4)) & (Y < 0)
            P.flat(flake, '#f4eedd')
        nose = m & (np.hypot(X, Z - mid) < 0.9) & (Y < 0)
        P.flat(nose, '#e0605a')
        for sx in (-1, 1):
            ant = m & (Y < 0) & (np.abs(X - sx * (0.9 + (Z - mid - 1.2) * 0.6)) < 0.3) & (Z > mid + 1.0) & (Z < mid + 3.0)
            P.flat(ant, '#9c7a56')
        knit(m, None)
        fill('rib', '#557343', 0.05)
    elif pid in ('moon_cape',):
        fill('cape', '#3a4a6a', 0.05, brush={'preset': 'cloth', 'L': 1.6})
        cape = reg('cape')
        st = cape & owlmod._dots(P, 0.45, 2.3, seed=9)
        P.flat(st, '#d8dee4')
        fill('trim', '#c8ccd0', 0.1, brush='metal')
        fill('silver', '#d8dee4', 0.2, brush='metal')
    elif pid in ('frost_cape', 'royalcape'):
        col = '#8fb0c4' if pid == 'frost_cape' else '#8a4a5a'
        fill('cape', col, 0.05, brush={'preset': 'cloth', 'L': 1.6})
        cape = reg('cape')
        P.flat(cape & owlmod._dots(P, 0.5, 2.6, seed=3), '#eef4f4' if pid == 'frost_cape' else '#d8b45c')
        fill('fur', '#f6f6f0', 0.15, brush='fur')
        fill('gem', '#9cc8d8' if pid == 'frost_cape' else '#d8b45c', 0.25, brush={'preset': 'gloss', 'shine': 0.7})
    elif pid == 'glasses':
        fill('wire', '#c8a764', 0.15, brush='metal')
    elif pid == 'monocle':
        fill('gold', '#c8a764', 0.15, brush='metal')
    elif pid in ('sweater', 'pajamas', 'cardigan', 'raincoat'):
        base, rib, accent = {'sweater': ('#617f8c', '#eae0c8', '#f1d39a'), 'pajamas': ('#d3e0dc', '#86a9b0', '#617f8c'),
                             'cardigan': ('#c0866a', '#a66c55', '#eae0c8'), 'raincoat': ('#dcb072', '#c59a52', '#f4eedd')}[pid]
        fill('knit', base, 0.05, brush='cloth' if pid != 'raincoat' else {'preset': 'lacquer', 'shine': 0.35})
        m = reg('knit')
        if pid == 'pajamas':
            fill(m & (np.mod(X / 2.4, 1.0) < 0.35), accent, 0.05)
        elif pid == 'sweater':
            top = float(Z[m].max()) if m.any() else 0
            mid = top - 6.5
            moon = m & (Y < 0) & (np.hypot(X - 0.3, Z - mid) < 2.6) & (np.hypot(X - 1.5, Z - mid - 0.8) > 2.2)
            P.flat(moon, accent)
            for i, (xx, zz) in enumerate(((-6, mid + 2), (5.5, mid + 3), (-4, mid - 3.5), (6.5, mid - 2.5))):
                P.flat(m & (Y < 0) & (np.abs(X - xx) + np.abs(Z - zz) < 0.7), '#f4eedd')
        elif pid == 'cardigan':
            fill(m & (np.abs(X) < 0.9) & (Y < 0), rib, 0.05)
        if pid != 'raincoat':
            knit(m, None)
        fill('rib', rib, 0.05)
        fill('button', '#9c7a56' if pid != 'raincoat' else '#6f553d', 0.15, brush={'preset': 'gloss', 'shine': 0.5}, n=6)
    elif pid == 'cloudcloak':
        fill('cloud', '#eef0ea', 0.15, brush={'preset': 'pvc', 'L': 2.2, 'W': 0.9}, tex='skin', light=0.5)
        P.recolour(reg('cloud') & (P.ao < 0.75) & (P.idx >= 0), pt.ramp('#c4d4dc', 7, shift=0.06))
    elif pid == 'bowtie':
        fill('velvet', '#6e5266', 0.05, brush={'preset': 'cloth', 'L': 1.4})
        m = reg('velvet')
        P.flat(m & (owlmod._dots(P, 0.35, 1.3, seed=2)), '#b4a9c9')
    elif pid == 'bandana':
        fill('cloth', '#b2504a', 0.05)
        m = reg('cloth')
        P.flat(m & owlmod._dots(P, 0.35, 1.6, seed=5), '#f4eedd')
    elif pid == 'bell':
        fill('leather', '#6f553d', 0.05, brush='wood')
        fill('silver', '#c8ccd0', 0.15, brush='metal')
    elif pid == 'moonpendant':
        fill('silver', '#c8ccd0', 0.15, brush='metal')
        fill('moonstone', '#dfe9ea', 0.25, brush={'preset': 'gloss', 'shine': 0.8}, light=0.6)
    elif pid == 'sleepmask':
        fill('band', '#46596a', 0.05)
        fill('satin', '#617f8c', 0.1, brush={'preset': 'lacquer', 'shine': 0.3})
        m = reg('satin')
        P.flat(m & (np.abs(np.abs(Z - (Z[m].mean() if m.any() else 0)) - 0.2) < 0.18) & (np.abs(np.abs(X) - 5.0) < 2.2), '#f1d39a')
    elif pid == 'acorn':
        fill('cupule', '#9c7a56', 0.05, brush={'preset': 'wood', 'flow': 'around'})
        P.shift(reg('cupule') & (P.cav > 0.55) & (P.idx >= 0), 1)
        fill('stem', '#6f553d', 0.05, brush='wood')
    elif pid == 'toadstool':
        fill('cap', '#b2504a', 0.1, brush={'preset': 'skin', 'shine': 0.3})
        fill('gills', '#eae0c8', 0.05, brush={'preset': 'wood', 'flow': 'around'})
        m = reg('cap')
        who, d = P.dabs(m & (Z > Z[m].min() + 1.5 if m.any() else m), size=2.4, spacing=4.2, seed=6)
        fill(m & (who >= 0) & (d < 0.6), '#f4eedd', 0.2, brush='pvc')
    elif pid == 'sprout':
        fill('stem', '#86a06a', 0.05, brush='wood')
        fill('leaf', '#86a06a', 0.1, brush={'preset': 'pvc', 'L': 1.6, 'flow': 'along', 'axis': (1, 0, 0)})
        m = reg('leaf')
        P.shift(m & (np.abs(Z - (Z[m].mean() if m.any() else 0)) < 0.18) & (P.idx >= 0), -1)
    elif pid == 'lantern':
        fill('glass', '#aec8cc', 0.25, brush={'preset': 'gloss', 'shine': 0.7}, light=0.6)
        fill('brass', '#c8a764', 0.15, brush='metal')
        fill('leather', '#6f553d', 0.05, brush='wood')
        fill('glow', '#f1d39a', 0.5, brush=False, light=0.8)
    elif pid == 'fairywings':
        fill('gauze', '#d3cce0', 0.2, brush={'preset': 'gloss', 'L': 1.8, 'flow': 'along', 'axis': (1, 0, 0.5)}, light=0.6)
        m = reg('gauze')
        P.shift(m & (np.abs(np.sin(np.arctan2(Z - Z.mean(), np.abs(X)) * 9)) < 0.12) & (P.idx >= 0), -1)
        P.flat(m & owlmod._dots(P, 0.3, 1.4, seed=8), '#f5f7f2')
    P.clusters()
    return P.done()


# ====================================================================== build
def build(pid):
    anchor, hides, fn = PIECES[pid]
    tk.reset()
    F = Fig('outfits', pid, size=1024)
    O = owlmod.Owl(specs.get('tawny'))
    O.build()  # (the measurements and anchors only: the owl's own pieces are dropped)
    for p in list(O.B.p.values()):
        for a, b in p:
            tk.delete(a)
            tk.delete(b)
    B = Build()
    fn(O, B, O.k)
    B.commit(F, bones={'piece': 'piece'})
    F.log('tris', F.tris())
    at = np.asarray(O.anchors[anchor][0])
    if '--preview' in FLAGS:
        F.facet_trim()
        lows = [p.low for p in F.parts]
        tk.preview(os.path.join(F.out, pid + '_prev.png'), lows, cam=(tuple(at + np.array([36, -64, 22])), tuple(at)), res=(300, 300), samples=6)
        return
    import paint as pt
    F.unwrap()
    F.bake(ao_samples=16 if '--fast' in FLAGS else 48, ao_dist=4.0, reuse='--repaint' in FLAGS, ao_by_bone=False)
    P = pt.Painter(F.maps, F.region_index, F.size)
    F.finish(paint(P, pt, pid), roughness=0.62)
    F.drop_highs()
    lows = [p.low for p in F.parts]
    root = bpy.data.objects.new('piece', None)
    bpy.context.scene.collection.objects.link(root)
    for o in lows:
        tk.set_verts(o, tk.verts(o) - at)
        o.name = pid + '_mesh'
        o.parent = root
        facet.flat(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in lows + [root]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = lows[0]
    raw = os.path.join(F.out, pid + '.raw.glb')
    bpy.ops.export_scene.gltf(filepath=raw, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_tangents=False, export_normals=True, export_texcoords=True, export_materials='EXPORT',
                              export_image_format='AUTO', export_animations=False, export_skins=False, export_morph=False,
                              export_lights=False, export_cameras=False, export_extras=False)
    os.makedirs(OUT, exist_ok=True)
    import pack
    pack.webp_glb(raw, os.path.join(OUT, pid + '.glb'), lossless=True, normals=False)
    json.dump({'id': pid, 'anchor': anchor, 'hides': hides, 'tris': F.tris()}, open(os.path.join(F.out, pid + '.piece.json'), 'w'))
    F.log('exported', pid, F.tris(), 'tris')


if __name__ == '__main__':
    ids = list(PIECES) if ARGS and ARGS[0] == 'all' else ARGS
    for i in ids:
        build(i)
