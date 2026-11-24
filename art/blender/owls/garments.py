"""Hoot Hollow's outfits, remodelled for the v4 owls: real garments shaped round the fluffy tawny (owl.py).

    ~/.cache/gg-bpy/bin/python art/blender/owls/garments.py <id ...> | all

Each piece is a few smooth parametric surfaces fitted to the tawny's own head and body (its surface plus the fluff
it sits on): hats hug the crown above the eyes and rise into their own shape (a flopping nightcap with a fur cuff and a
pompom, a Santa hat, a ribbed beanie, a wizard's cone over a wide brim, a slouched beret), crowns are thick bands
with points, scarves are knitted rings round the neck with hanging ends, capes drape from a collar round the shoulders
and folded wings and flare into folds, glasses are wire rims at the eyes. Every surface is painted in its own UV
island like the owls (hand-knit V stitches, felt, velvet, satin, fur strands, brushed metal with engraving, gems),
with a relief normal map, a roughness / metalness map and the cavity where it lies on the owl, and exported with its
origin at its anchor and divided by the tawny's anchor scale (the anchor convention the game uses: src/owl/outfits.ts),
so a piece fits every species exactly as the tawny wears it. Writes public/models/outfits/<id>.glb (replacing the old
toy piece) and art/blender/_build/outfits/<id>.piece.json.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [HERE]
import numpy as np  # noqa: E402

import owl as ow  # noqa: E402
import plume  # noqa: E402
import specs  # noqa: E402
from owl import Surf, V, bez, gauss, mesh_of, nrm, ss  # noqa: E402
from plume import hexrgb, hsh, tint, vnoise  # noqa: E402

ROOT = ow.ROOT
OUT = os.path.join(ROOT, 'public', 'models', 'outfits')
BUILD = os.path.join(ROOT, 'art', 'blender', '_build', 'outfits')
FUR = 0.22  # the fluff a piece sits on (the game shortens the shells under a worn piece: src/owl/model.ts)
PIECES = {}


def piece(pid, anchor, hides=False):
    def deco(fn):
        PIECES[pid] = (anchor, hides, fn)
        return fn
    return deco


# ====================================================================== the wearer
class Wearer:
    """The tawny, measured: its head and body surfaces and anchors."""

    def __init__(s):
        s.O = ow.Owl(specs.get('tawny'))
        s.O.build()
        s.head = next(sf for sf in s.O.surfs if sf.name == 'head')
        s.body = next(sf for sf in s.O.surfs if sf.name == 'body')
        s.k = s.O.k
        s.occ = [(sf, mesh_of(sf)) for sf in (s.head, s.body)]  # (also settles each surface's outward sense)

    def head_at(s, a, b, off=0.0):
        """A point on the head (a around: 0.5 the face; b from the crown 0 to the chin 1) pushed out by off mm."""
        a, b = np.asarray(a, float), np.asarray(b, float)
        a, b = np.broadcast_arrays(a, b)
        P = s.head.eval(a, b)
        N = s.head.normals(a, b)
        # (over the head's own feather clumps and the ruff's rim, never through them)
        rel = s.O.head_relief(s.head, np.atleast_1d(a), np.atleast_1d(b), np.atleast_1d(P).reshape(np.atleast_1d(a).shape + (3,)), None).reshape(a.shape)
        o = np.asarray(off, float) + FUR + rel
        return P + N * (o[..., None] if o.ndim else o)

    def body_ring(s, y, off=0.0, n=None):
        """(half width, front, back, centre z) of the body at height y, pushed out by off."""
        bs = np.linspace(0, 1, 400)
        bq = float(np.interp(y, s.O.body_sec(bs)[3][::-1], bs[::-1]))
        w, f, bk, _, zc = (float(v) for v in s.O.body_sec(np.array(bq)))
        rel = 0.55 * s.k  # (over the plumage's clumps)
        return w + off + FUR + rel, f + off + FUR + rel, bk + off + FUR + rel, zc


# ====================================================================== shapes
def loft(rings_fn, na, nb, w, h, name, mat, wrap=True, **kw):
    """A surface from a ring function rings_fn(a, t) -> points (a around, t along)."""
    sf = Surf(name, 'piece', rings_fn, na, nb, w, h, mat, wrap=wrap, **kw)
    return sf


def hat(W, name, mat, b_front, b_back, off, cut=0.12, rise=0.0, flop=(0, 0, 0), tip_r=0.4, n=48, m=36, puff=0.0, slouch=0.0, tilt=(0.0, 0.0)):
    """A hat: hugging the head from a band (polar b_front at the face, b_back behind) up to the polar `cut`, then a
    crown rising `rise` mm along a bending spine to a tip of radius tip_r (flop: where the tip falls, mm)."""
    k = W.k
    flop = np.asarray(flop, float)
    hug_t = 0.55 if rise > 0.5 else 1.0

    def band_b(a):
        return b_back + (b_front - b_back) * (0.5 + 0.5 * np.cos(2 * math.pi * (a - 0.5)))

    # the cut ring (the top of the hugging part) and its centre
    aa = np.linspace(0, 1, 97)
    cut_ring = W.head_at(aa, np.full_like(aa, cut), off + slouch)
    c0 = cut_ring.mean(0)
    top = W.head_at(0.5, 0.0, off + slouch)

    def fn(a, t):
        a = np.asarray(a, float)
        t = np.asarray(t, float)
        th = np.clip(t / hug_t, 0, 1)
        bb = band_b(a) + (cut - band_b(a)) * th
        sl = slouch * ss(0.0, 1.0, th) + puff * np.sin(math.pi * th)
        P = W.head_at(a, bb, off + sl)
        if rise <= 0.5:
            # a cap: past the cut it closes over the crown in a dome
            return P
        tc = np.clip((t - hug_t) / (1 - hug_t), 0, 1)
        ring = W.head_at(a, np.full_like(a, cut), off + slouch)
        spine = np.array([c0, c0 + np.array([0, rise * 0.55, 0]) + flop * 0.1, c0 + np.array([0, rise, 0]) + flop * 0.55, c0 + flop + np.array([0, rise * 0.82, 0])])
        c = bez(spine, tc)
        r0 = np.linalg.norm(ring - c0, axis=-1, keepdims=True)
        scale = ((1 - tc) ** 1.1 * (1 - tip_r / 9) + tip_r / max(float(np.mean(r0)), 0.5) * tc)[..., None]
        P2 = c + (ring - c0) * scale
        return np.where((t <= hug_t)[..., None], P, P2)
    hh = math.pi * 12 * k
    return Surf(name, 'piece', fn, n, m, 2 * math.pi * 12 * k, hh * (1 + rise / 12), mat, wrap=True)


def ring_tube(name, mat, pts_fn, radius, n=64, m=12, squash=(1.0, 1.0), up=(0, 1, 0), w=None):
    """A closed tube along a loop of points pts_fn(u) (u 0..1), its section a circle of `radius` (squashed)."""
    upv = np.asarray(up, float)

    def fn(a, b):
        u = np.asarray(b, float)
        c = pts_fn(u)
        tg = nrm(pts_fn(np.mod(u + 1e-3, 1.0)) - pts_fn(np.mod(u - 1e-3, 1.0)))
        side = nrm(np.cross(tg, upv))
        upn = np.cross(side, tg)
        r = radius(u) if callable(radius) else radius
        th = 2 * math.pi * np.asarray(a, float)
        r = np.asarray(r)[..., None] if np.ndim(r) else r
        return c + r * (np.cos(th)[..., None] * side * squash[0] + np.sin(th)[..., None] * upn * squash[1])
    L = float(np.linalg.norm(np.diff(pts_fn(np.linspace(0, 1, 200)), axis=0), axis=1).sum())
    rr = radius(np.array(0.5)) if callable(radius) else radius
    return Surf(name, 'piece', fn, m, n, 2 * math.pi * float(rr) * max(squash), w or L, mat, wrap=True)


def tube(name, mat, spine, radius, n=24, m=10, squash=(1.0, 1.0), up=(0, 1, 0)):
    spine = np.asarray(spine, float)
    upv = np.asarray(up, float)

    def fn(a, b):
        t = np.asarray(b, float)
        c = bez(spine, t)
        tg = nrm(bez(spine, np.clip(t + 1e-3, 0, 1)) - bez(spine, np.clip(t - 1e-3, 0, 1)))
        side = nrm(np.cross(tg, upv))
        upn = np.cross(side, tg)
        cap = np.sqrt(np.clip(t / 0.04, 0, 1)) * np.sqrt(np.clip((1 - t) / 0.04, 0, 1))
        r = (radius(t) if callable(radius) else radius) * cap
        th = 2 * math.pi * np.asarray(a, float)
        return c + r[..., None] * (np.cos(th)[..., None] * side * squash[0] + np.sin(th)[..., None] * upn * squash[1])
    L = float(np.linalg.norm(np.diff(spine, axis=0), axis=1).sum())
    rr = float(radius(np.array(0.5)) if callable(radius) else radius)
    return Surf(name, 'piece', fn, m, n, 2 * math.pi * rr * max(squash), L, mat, wrap=True)


def ball(name, mat, c, r, n=20, tufts=False, lid=1.0, tilt=0.0):
    c = np.asarray(c, float)

    def fn(a, b):
        th = 2 * math.pi * np.asarray(a, float)
        ph = math.pi * np.asarray(b, float) * lid  # (lid < 1: a cap, an eyelid)
        # (a pompom is a burst of yarn tufts, never a smooth ball: each tuft a lump with its own lift)
        d = np.stack([np.sin(ph) * np.cos(th), np.cos(ph), np.sin(ph) * np.sin(th)], -1)
        tuft = plume.vnoise3(d * 3.0, 0.45, 17) + 0.6 * plume.vnoise3(d * 3.0, 0.2, 23)
        rr = r * (0.82 + 0.32 * tuft) if tufts else r + 0 * tuft
        v = np.stack([np.sin(ph) * np.cos(th) * rr, np.cos(ph) * rr, np.sin(ph) * np.sin(th) * rr], -1)
        if tilt:
            ct_, st_ = math.cos(tilt), math.sin(tilt)
            v = np.stack([v[..., 0], v[..., 1] * ct_ - v[..., 2] * st_, v[..., 1] * st_ + v[..., 2] * ct_], -1)
        return c + v
    return Surf(name, 'piece', fn, n, n, 2 * math.pi * r, math.pi * r, mat, wrap=True)


def band(W, name, mat, b_front, b_back, height, th, off, points=None, flare=0.0, n=72):
    """A crown's band: a thick ring round the head (bottom at the polar band, `height` mm tall, flaring out), its top
    edge cut into points(a) -> extra height. The section loops round: outer face up, the top edge, inner face down."""
    k = W.k

    def bb(a):
        return b_back + (b_front - b_back) * (0.5 + 0.5 * np.cos(2 * math.pi * (a - 0.5)))
    aa = np.linspace(0, 1, 97)
    base = W.head_at(aa, bb(aa), off)
    c0 = base.mean(0)

    def fn(a, s):
        a = np.asarray(a, float)
        s = np.asarray(s, float)
        p0 = W.head_at(a, bb(a), off)
        out = nrm((p0 - c0) * np.array([1.0, 0.0, 1.0]))
        hgt = height + (points(a) if points else 0.0)
        ph = 2 * math.pi * s
        up = (1 - np.cos(ph)) / 2   # 0 bottom .. 1 top .. 0 bottom
        side = np.where(np.sin(ph) >= 0, 1.0, -1.0) * np.minimum(1, np.abs(np.sin(ph)) * 3)  # outer +, inner -
        rim = (0.5 + 0.5 * side) * th
        y = up * hgt
        return p0 + np.array([0, 1.0, 0]) * y[..., None] + out * (rim + flare * up)[..., None]
    return Surf(name, 'piece', fn, n, 16, 2 * math.pi * 12 * k, (height + 2 * th) * 1.6, mat, wrap=True)


def drape(W, name, mat, y_top, y_hem, arc, centre, off, folds=7, fold_amp=0.5, flare=2.0, n=56, m=30):
    """A cape: hangs from y_top to y_hem round the back (an open arc of `arc` degrees about `centre`: 180 behind),
    enclosing the body and the folded wings, flaring toward the hem, falling in soft folds."""
    k = W.k
    wing = 3.0 * k  # (the folded wings stand off the flanks)

    def fn(a, t):
        a = np.asarray(a, float)
        t = np.asarray(t, float)
        y = y_top + (y_hem - y_top) * t
        ang = np.radians(centre - arc / 2 + arc * a)
        # the body's section at this height, grown round the wings, the flare and the folds
        out = []
        ws, fs, bs, zs = [], [], [], []
        for yy in np.atleast_1d(y).reshape(-1)[:1]:
            pass
        bsv = np.linspace(0, 1, 300)
        ys = W.O.body_sec(bsv)[3]
        bq = np.interp(y, ys[::-1], bsv[::-1])
        w, f, bk, _, zc = W.O.body_sec(bq)
        grow = off + FUR + 0.6 * k + wing * (0.4 + 0.6 * np.abs(np.sin(ang))) + flare * t ** 1.4
        fold = fold_amp * k * np.sin(ang * folds + 0.4) * ss(0.05, 0.6, t)
        x = np.sin(ang) * (w + grow + fold)
        z = zc + np.cos(ang) * (np.where(np.cos(ang) > 0, f, bk) + grow + fold)
        return np.stack([x, y + 0 * x, z], -1)
    return Surf(name, 'piece', fn, n, m, math.radians(arc) * 16 * k, (y_top - y_hem) * 1.1, mat, wrap=False)


# ====================================================================== materials (painted in the island: U across, S along, mm)
MATS = {}


def mat(name):
    def deco(fn):
        MATS[name] = fn
        return fn
    return deco


def _rgb(c):
    return hexrgb(c) if isinstance(c, str) else np.asarray(c, np.float32)


@mat('knit')
def m_knit(T, c, c2=None, stripe=0.0, rib=False, motif=None):
    """Hand knitting: V stitches in columns down the flow, a soft fuzz, stripes of a second yarn."""
    U, S = T['U'], T['S']
    cw, rh = 0.62, 0.5
    col_ = np.floor(U / cw)
    row = np.floor(S / rh)
    fu, fv = np.mod(U / cw, 1.0), np.mod(S / rh, 1.0)
    if rib:  # ribbing: knit and purl columns
        vee = np.abs(np.abs(fu - 0.5) * 2 - (1 - fv) * 0.85)
        loop = (vee < 0.38) & (np.mod(col_, 2) == 0)
    else:
        vee = np.abs(np.abs(fu - 0.5) * 2 - (1 - fv) * 0.85)
        loop = vee < 0.38
    base = np.broadcast_to(_rgb(c), U.shape + (3,)).copy()
    if c2 is not None and stripe:
        st = np.mod(np.floor(S / (rh * stripe)), 2) == 1
        base = np.where(st[..., None], _rgb(c2), base)
    if motif is not None:
        mm = motif(col_, row)
        base = np.where(mm[..., 0:1] > 0, mm[..., 1:4], base)
    fz = hsh(np.floor(U * 9), np.floor(S * 9), 3) - 0.5
    col = tint(base, np.where(loop, 0.07, -0.24) + fz * 0.08 + (hsh(col_, row, 7) - 0.5) * 0.08)
    h = np.where(loop, 0.5 - np.abs(fu - 0.5), 0.0) + fz * 0.05
    return col, h, 0.95, 0.0


@mat('felt')
def m_felt(T, c, **kw):
    U, S = T['U'], T['S']
    n = plume.fbm(U * 1.6, S * 1.6, 3, 3) - 0.5
    fib = hsh(np.floor(U * 7), np.floor(S * 7), 5) - 0.5
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), n * 0.18 + fib * 0.08)
    return col, n * 0.3 + fib * 0.06, 0.92, 0.0


@mat('velvet')
def m_velvet(T, c, emb=None, emb_c='#e8ecff', **kw):
    """Velvet: deep pile catching a sheen on the folds, embroidered motifs (stars, snowflakes) in thread."""
    U, S, N = T['U'], T['S'], T['N']
    n = plume.fbm(U * 0.8, S * 0.8, 9, 3) - 0.5
    pile = hsh(np.floor(U * 10), np.floor(S * 10), 4) - 0.5
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), n * 0.2 + pile * 0.06)
    h = n * 0.3 + pile * 0.04
    if emb:
        m = emb(U, S)
        col = np.where(m[..., None], tint(np.broadcast_to(_rgb(emb_c), col.shape), pile[..., None][..., 0] * 0.1), col)
        h = np.where(m, h + 0.35, h)
    return col, h, 0.78, 0.0


@mat('satin')
def m_satin(T, c, **kw):
    U, S = T['U'], T['S']
    n = plume.fbm(U * 0.5, S * 2.0, 2, 3) - 0.5
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), n * 0.22)
    return col, n * 0.2, 0.42, 0.0


@mat('cloth')
def m_cloth(T, c, c2=None, pattern=None, **kw):
    """Woven cotton: a fine plain weave, a printed pattern (stars, polka, stripes) in a second colour."""
    U, S = T['U'], T['S']
    fu, fv = np.mod(U / 0.24, 1.0), np.mod(S / 0.24, 1.0)
    over = (np.floor(U / 0.24) + np.floor(S / 0.24)) % 2
    wv = np.where(over > 0, np.sin(fu * math.pi), np.sin(fv * math.pi))
    base = np.broadcast_to(_rgb(c), U.shape + (3,)).copy()
    if pattern is not None and c2 is not None:
        base = np.where(pattern(U, S)[..., None], _rgb(c2), base)
    col = tint(base, (wv - 0.5) * 0.12 + (plume.fbm(U * 0.7, S * 0.7, 6, 2) - 0.5) * 0.14)
    return col, wv * 0.25, 0.9, 0.0


@mat('fur')
def m_fur(T, c, **kw):
    """A fur trim: dense strands combed one way, lit tips, dark partings."""
    U, S = T['U'], T['S']
    cl = plume.fbm(U * 1.4, S * 0.9, 11, 3)
    strand = hsh(np.floor(U * 8), np.floor((S + 0.6 * np.sin(U * 2.1)) * 2.2), 13)
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), (cl - 0.5) * 0.35 + (strand - 0.5) * 0.18)
    return col, cl * 0.8 + strand * 0.25, 0.95, 0.0


@mat('metal')
def m_metal(T, c, engrave=None, **kw):
    """Worked metal: polished, brushed along the band, a little tarnish in the hollows, engraved scrolls."""
    U, S, N = T['U'], T['S'], T['N']
    br = hsh(np.floor(U * 1.5), np.floor(S * 24), 2) - 0.5
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), br * 0.08 + 0.1 * np.clip(N[..., 1], 0, 1) - 0.25 * (1 - np.clip(T['ao'], 0, 1)))
    h = br * 0.05
    if engrave:
        m = engrave(U, S)
        col = np.where(m[..., None], tint(col, -0.35), col)
        h = np.where(m, h - 0.3, h)
    return col, h, 0.32, 0.65


@mat('gem')
def m_gem(T, c, **kw):
    U, S = T['U'], T['S']
    f = np.abs(np.sin(U * 4) * np.sin(S * 4))
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), 0.35 * (f > 0.7) - 0.2 * (f < 0.15))
    return col, f * 0.2, 0.12, 0.0


@mat('ice')
def m_ice(T, c, **kw):
    U, S, N = T['U'], T['S'], T['N']
    f = plume.fbm(U * 1.2, S * 1.2, 21, 2)
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), (f - 0.5) * 0.3 + 0.25 * np.clip(N[..., 1], 0, 1))
    return col, f * 0.3, 0.14, 0.0


@mat('bone')
def m_bone(T, c, **kw):
    """Antler: ridged and pitted along its length, paler at the tips."""
    U, S = T['U'], T['S']
    ridge = np.sin(U * 9 + plume.fbm(U * 0.6, S * 0.4, 3, 2) * 6) * 0.5
    pit = hsh(np.floor(U * 6), np.floor(S * 6), 9) > 0.93
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), ridge * 0.14 - 0.3 * pit + 0.25 * ss(0.6, 1.0, T['b']))
    return col, ridge * 0.4 - 0.3 * pit, 0.7, 0.0


# ====================================================================== painting an island
def paint_island(sf, m, size, spec):
    g = 4
    pw, ph = sf.pw, sf.ph
    ii, jj = np.meshgrid(np.arange(-g, pw + g), np.arange(-g, ph + g), indexing='xy')
    a = (ii + 0.5) / pw
    b = (jj + 0.5) / ph
    a = np.mod(a, 1.0) if sf.wrap else np.clip(a, 0, 1)
    b = np.clip(b, 0, 1)
    P = sf.eval(a, b)
    N = sf.normals(a, b)
    bb = np.linspace(0, 1, 129)
    Pm = sf.eval(np.full_like(bb, 0.5), bb)
    Sb = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(Pm, axis=0), axis=1))])
    aa = np.linspace(0, 1, 97)
    Cb = np.array([max(np.linalg.norm(np.diff(sf.eval(aa, np.full_like(aa, v)), axis=0), axis=1).sum(), 0.05) for v in bb])
    S = np.interp(b, bb, Sb)
    C = np.interp(b, bb, Cb)
    ao = m['ao'].reshape(sf.nb, sf.na)
    fa_, fb_ = a * (sf.na - 1), b * (sf.nb - 1)
    i0 = np.clip(np.floor(fa_).astype(int), 0, sf.na - 2)
    j0 = np.clip(np.floor(fb_).astype(int), 0, sf.nb - 2)
    u, v = fa_ - i0, fb_ - j0
    AO = (ao[j0, i0] * (1 - u) + ao[j0, i0 + 1] * u) * (1 - v) + (ao[j0 + 1, i0] * (1 - u) + ao[j0 + 1, i0 + 1] * u) * v
    T = dict(a=a, b=b, P=P, N=N, U=a * C, S=S, ao=AO)
    kind, kw = spec
    col, h, rough, metal = MATS[kind](T, **kw)
    occ = 1 - 0.55 * (1 - np.clip(AO, 0, 1)) ** 1.2
    col = np.clip(col * occ[..., None], 0, 1)
    return dict(rgb=col, h=np.asarray(h, np.float32) * np.ones(a.shape), rough=np.full(a.shape, rough, np.float32), metal=np.full(a.shape, metal, np.float32),
                fur=np.full(a.shape, 1.0 if kind == 'fur' else 0.0, np.float32))  # (red channel: where the game grows real fluff)


# ====================================================================== the pieces
def _brim_pts(W, b_front, b_back, off):
    def pts(u):
        u = np.asarray(u, float)
        bb = b_back + (b_front - b_back) * (0.5 + 0.5 * np.cos(2 * math.pi * (u - 0.5)))
        return W.head_at(u, bb, off)
    return pts


def _stars(U, S, every=2.4, r=0.42, seed=3):
    gx, gy = np.round(U / every), np.round(S / every + 0.5 * (np.mod(np.round(U / every), 2)))
    ox, oy = U - gx * every, S - (gy - 0.5 * np.mod(gx, 2)) * every
    rr = np.hypot(ox, oy)
    ang = np.arctan2(oy, ox)
    star = rr < r * (0.55 + 0.45 * np.abs(np.cos(ang * 2.5)))
    return star & (hsh(gx, gy, seed) > 0.25)


def _flakes(U, S, every=3.2):
    gx = np.round(U / every)
    gy = np.round((S + 0.5 * every * np.mod(gx, 2)) / every)
    ox, oy = U - gx * every, S + 0.5 * every * np.mod(gx, 2) - gy * every
    r = np.hypot(ox, oy)
    a = np.arctan2(oy, ox)
    k6 = np.mod(a / (math.pi / 3), 1.0)
    arm = np.minimum(k6, 1 - k6) * r < 0.09
    return (r < 0.95) & (arm | (np.abs(r - 0.55) < 0.07)) & (hsh(gx, gy, 5) > 0.2)


@piece('nightcap', 'anchor_head', hides=True)
def nightcap(W):
    k = W.k
    S = [hat(W, 'cap', ('cloth', dict(c='#3f56a8', c2='#f3e6c4', pattern=lambda U, S: _stars(U, S, 2.0, 0.38))), 0.42, 0.62, 0.5, cut=0.14,
             rise=11 * k, flop=(9 * k, -3.5 * k, -4.5 * k), tip_r=0.9 * k, slouch=0.6 * k)]
    S.append(ring_tube('cuff', ('fur', dict(c='#f6f1e6')), _brim_pts(W, 0.42, 0.62, 0.9 * k), 1.45 * k, squash=(1.0, 1.25)))
    tip = S[0].fn(np.array(0.5), np.array(1.0))
    S.append(ball('pom', ('fur', dict(c='#f6f1e6')), tip + np.array([0, -0.6 * k, 0]), 1.9 * k, n=26, tufts=True))
    return S


@piece('santa_hat', 'anchor_head', hides=True)
def santa_hat(W):
    k = W.k
    S = [hat(W, 'cap', ('felt', dict(c='#c0362e')), 0.42, 0.62, 0.45, cut=0.14, rise=12.5 * k, flop=(7 * k, -5.0 * k, -6.0 * k), tip_r=0.8 * k,
             slouch=0.7 * k)]
    S.append(ring_tube('cuff', ('fur', dict(c='#fbf8f2')), _brim_pts(W, 0.42, 0.62, 1.1 * k), 1.8 * k, squash=(1.0, 1.3)))
    tip = S[0].fn(np.array(0.5), np.array(1.0))
    S.append(ball('pom', ('fur', dict(c='#fbf8f2')), tip + np.array([0, -0.7 * k, 0]), 2.1 * k, n=26, tufts=True))
    return S


@piece('beanie', 'anchor_head', hides=True)
def beanie(W):
    k = W.k
    S = [hat(W, 'cap', ('knit', dict(c='#5f9a52', c2='#e9d9b2', stripe=5.0)), 0.36, 0.56, 0.35, cut=0.02, slouch=0.9 * k, puff=0.5 * k)]
    S.append(ring_tube('rib', ('knit', dict(c='#e9d9b2', rib=True)), _brim_pts(W, 0.36, 0.56, 0.7 * k), 1.25 * k, squash=(1.0, 1.6)))
    top = W.head_at(0.5, 0.0, 1.3 * k)
    S.append(ball('pom', ('fur', dict(c='#f3e2bd')), top + np.array([0, 1.5 * k, 0]), 2.2 * k, n=26, tufts=True))
    return S


@piece('wizard', 'anchor_head', hides=True)
def wizard(W):
    k = W.k
    S = [hat(W, 'cone', ('velvet', dict(c='#3a3170', emb=lambda U, S: _stars(U, S, 2.6, 0.45), emb_c='#e8c25a')), 0.36, 0.5, 0.45, cut=0.16,
             rise=17 * k, flop=(-2.5 * k, -1.5 * k, -3.5 * k), tip_r=0.3 * k)]
    # the wide brim: a flat disc round the band, gently waved
    pts = _brim_pts(W, 0.38, 0.52, 0.5 * k)

    def brim(a, t):
        a = np.asarray(a, float)
        t = np.asarray(t, float)
        p = pts(a)
        c = pts(np.linspace(0, 1, 64)).mean(0)
        out = nrm((p - c) * np.array([1.0, 0, 1.0]))
        r = t * 6.5 * k
        wave = 0.5 * k * np.sin(a * 2 * math.pi * 5) * t
        return p + out * r[..., None] + np.array([0, -1.0, 0]) * (0.25 * k * t ** 2 - wave)[..., None]
    S.append(Surf('brim', 'piece', brim, 72, 8, 2 * math.pi * 14 * k, 6.5 * k, ('velvet', dict(c='#2e2860')), wrap=True))
    return S


@piece('beret', 'anchor_head')
def beret(W):
    k = W.k
    return [hat(W, 'cap', ('felt', dict(c='#8a3a52')), 0.3, 0.4, 0.4, cut=0.0, slouch=1.4 * k, puff=1.2 * k),
            tube('stalk', ('felt', dict(c='#7a3248')), [W.head_at(0.5, 0.0, 1.6 * k), W.head_at(0.5, 0.0, 1.6 * k) + np.array([0.2, 1.2, -0.3]) * k],
                 0.3 * k, n=6, m=6)]


def _points(n, h, sharp=0.6):
    return lambda a: h * np.abs(np.sin(np.asarray(a) * n * math.pi)) ** (1 / sharp) * 0 + h * (1 - np.abs(np.mod(np.asarray(a) * n, 1.0) - 0.5) * 2) ** 2.2


@piece('crown', 'anchor_head')
def crown(W):
    k = W.k
    eng = lambda U, S: (np.abs(np.sin(U * 2.2 + np.sin(S * 3) * 1.2)) < 0.12) & (S > 0.6) & (S < 3.0)  # noqa: E731
    S = [band(W, 'band', ('metal', dict(c='#e0b24a', engrave=eng)), 0.2, 0.3, 3.0 * k, 0.55 * k, 0.35 * k, points=_points(7, 3.2 * k), flare=0.8 * k)]
    # a gem at the front, little pearls on the points
    p = W.head_at(0.5, 0.25, 1.2 * k)
    S.append(ball('gem', ('gem', dict(c='#b8323e')), p + np.array([0, 1.4 * k, 0.4 * k]), 0.9 * k, n=12))
    return S


@piece('star_crown', 'anchor_head')
def star_crown(W):
    k = W.k
    S = [band(W, 'band', ('metal', dict(c='#e6c45c')), 0.22, 0.3, 1.8 * k, 0.45 * k, 0.35 * k, points=_points(5, 1.6 * k), flare=0.6 * k)]
    for i in range(5):
        a = 0.5 + (i - 2) * 0.1
        p0 = W.head_at(a, 0.2, 0.9 * k) + np.array([0, 1.6 * k, 0])
        p = p0 + np.array([0, 2.6 * k, 0.2 * k])
        sz = (1.35 if i == 2 else 1.0) * k
        out = nrm((p - W.head_at(0.5, 0.0, 0)) * np.array([1.0, 0.0, 1.0]))
        # a slender stem up from the band's point, a faceted five-pointed star on it (gold, its points bevelled)
        S.append(tube(f'stem{i}', ('metal', dict(c='#e6c45c')), [p0, (p0 + p) / 2, p], 0.22 * k, n=8, m=6))
        S.append(disc(f'star{i}', ('metal', dict(c='#f2d470')), p + out * 0.15 * k, sz * 1.5, out, n=60, m=5,
                      outline=lambda a_, sz=sz: sz * 1.5 * (0.45 + 0.55 * np.abs(np.cos(np.asarray(a_) * 5 * math.pi)) ** 2.6), wave=0.0, droop=-0.35 * k))
    return S


@piece('ice_crown', 'anchor_head')
def ice_crown(W):
    k = W.k
    S = [band(W, 'band', ('metal', dict(c='#cfd8e2')), 0.22, 0.3, 1.4 * k, 0.4 * k, 0.35 * k, flare=0.4 * k)]
    for i in range(7):
        a = 0.5 + (i - 3) * 0.075
        p0 = W.head_at(a, 0.2, 0.8 * k) + np.array([0, 1.0 * k, 0])
        h = (5.2 if i == 3 else 3.8 if abs(i - 3) == 1 else 2.8) * k
        out = nrm((p0 - W.head_at(0.5, 0.0, 0)) * np.array([1.0, 0, 1.0]))
        S.append(tube(f'spike{i}', ('ice', dict(c='#bfe4f2')), [p0, p0 + np.array([0, h, 0]) + out * 0.6 * k], lambda t: 0.6 * k * (1 - t) ** 0.8 + 0.03,
                      n=8, m=6))
    return S


def _neck_loop(W, y, off, wob=0.35):
    k = W.k
    w, f, bk, zc = W.body_ring(y, off)

    def pts(u):
        u = np.asarray(u, float)
        th = 2 * math.pi * u
        x = np.sin(th) * w
        z = zc + np.cos(th) * np.where(np.cos(th) > 0, f, bk)
        yy = y + wob * k * np.sin(th * 2) + 0.4 * k * np.cos(th)
        return np.stack([x, yy, z], -1)
    return pts


@piece('scarf', 'anchor_neck')
def scarf(W):
    k = W.k
    y = W.O.chin() - 0.4 * k
    S = [ring_tube('wrap', ('knit', dict(c='#b2504a', c2='#efe6d4', stripe=4.0)), _neck_loop(W, y, 0.2 * k, 0.25), lambda u: 1.6 * k * (1 + 0.12 * np.sin(np.asarray(u) * 2 * math.pi * 3)), squash=(0.55, 1.05))]
    w, f, bk, zc = W.body_ring(y - 1.5 * k, 1.6 * k)
    e0 = np.array([3.0 * k, y - 0.6 * k, zc + f])
    S.append(tube('end', ('knit', dict(c='#b2504a', c2='#efe6d4', stripe=4.0)), [e0, e0 + np.array([0.6, -4.0, 0.9]) * k, e0 + np.array([1.2, -8.0, 0.6]) * k],
                  lambda t: 1.7 * k * (1 + 0.1 * t), n=16, m=10, squash=(1.0, 0.3), up=(0, 0, 1)))
    return S


@piece('candy_scarf', 'anchor_neck')
def candy_scarf(W):
    S = scarf(W)
    stripes = ('knit', dict(c='#c8383a', c2='#f6f0e2', stripe=2.0))
    for sf in S:
        sf.tract = stripes
    return S


@piece('bandana', 'anchor_neck')
def bandana(W):
    k = W.k
    y = W.O.chin() - 0.3 * k
    dots = lambda U, S: (np.hypot(np.mod(U, 1.4) - 0.7, np.mod(S + 0.7 * np.mod(np.floor(U / 1.4), 2), 1.4) - 0.7) < 0.28)  # noqa: E731
    S = [ring_tube('knot', ('cloth', dict(c='#c45a4a', c2='#f6efe2', pattern=dots)), _neck_loop(W, y, 0.8 * k, 0.15), 0.9 * k, squash=(0.6, 1.0))]

    # the triangle over the chest: a cloth sheet hugging the breast, pointed below
    def tri(a, t):
        a = np.asarray(a, float)
        t = np.asarray(t, float)
        yy = y - 0.5 * k - t * 8.0 * k
        half = (1 - t) * 6.5 * k + 0.2
        x = (a - 0.5) * 2 * half
        bsv = np.linspace(0, 1, 300)
        bq = np.interp(yy, W.O.body_sec(bsv)[3][::-1], bsv[::-1])
        w, f, bk, _, zc = W.O.body_sec(bq)
        r = np.clip(np.abs(x) / np.maximum(w, 1e-3), 0, 0.98)
        z = zc + (f + FUR + 0.5 * k) * (1 - r ** 2) ** 0.5 + 0.3 * k * np.sin(a * 9 + t * 4) * t
        return np.stack([x, yy, z], -1)
    S.append(Surf('tri', 'piece', tri, 24, 16, 13 * k, 8 * k, ('cloth', dict(c='#c45a4a', c2='#f6efe2', pattern=dots)), wrap=False))
    return S


@piece('bowtie', 'anchor_neck')
def bowtie(W):
    k = W.k
    y = W.O.chin() - 0.8 * k
    w, f, bk, zc = W.body_ring(y, 0.6 * k)
    c = np.array([0, y, zc + f])
    S = []
    for sx, nm in ((-1, 'l'), (1, 'r')):
        def lobe(a, b, sx=sx):
            th = 2 * math.pi * np.asarray(a, float)
            t = np.asarray(b, float)
            L = 3.4 * k
            cx = sx * t * L
            r = 1.5 * k * (0.45 + 0.55 * np.sin(math.pi * np.clip(t, 0, 1)) ** 0.6 + 0.35 * t)
            return c + np.stack([cx + 0 * th, np.cos(th) * r * (0.6 + 0.4 * t), np.sin(th) * r * 0.35], -1)
        S.append(Surf('lobe' + nm, 'piece', lobe, 16, 12, 2 * math.pi * 1.5 * k, 3.4 * k, ('satin', dict(c='#3a4a8a')), wrap=True))
    S.append(ball('knot', ('satin', dict(c='#30407a')), c + np.array([0, 0, 0.2 * k]), 0.9 * k, n=12))
    return S


def _cape(W, name_mat, collar_mat, clasp_mat, fur_collar=False):
    k = W.k
    y_top = W.O.chin() - 1.4 * k
    y_hem = W.O.by0 + 0.3 * k
    S = [drape(W, 'cape', name_mat, y_top, y_hem, 250, 180, 0.4 * k, folds=9, fold_amp=0.6, flare=2.4 * k)]
    S.append(ring_tube('collar', collar_mat, _neck_loop(W, y_top + 0.4 * k, (1.6 if fur_collar else 0.9) * k, 0.1), (1.6 if fur_collar else 0.9) * k,
                       squash=(1.0, 1.2)))
    w, f, bk, zc = W.body_ring(y_top - 0.4 * k, 2.0 * k)
    S.append(ball('clasp', clasp_mat, np.array([0, y_top - 0.6 * k, zc + f + 0.6 * k]), 0.95 * k, n=12))
    return S


@piece('moon_cape', 'anchor_back')
def moon_cape(W):
    return _cape(W, ('velvet', dict(c='#232866', emb=lambda U, S: _stars(U, S, 2.2, 0.4), emb_c='#e8ecff')), ('velvet', dict(c='#1c2052')),
                 ('metal', dict(c='#e7c35a')))


@piece('frost_cape', 'anchor_back')
def frost_cape(W):
    return _cape(W, ('velvet', dict(c='#86b8e0', emb=_flakes, emb_c='#f4fbff')), ('fur', dict(c='#fbfbf8')), ('gem', dict(c='#d6f2ff')), fur_collar=True)


@piece('royalcape', 'anchor_back')
def royalcape(W):
    ermine = lambda U, S: (np.hypot(np.mod(U, 2.6) - 1.3, np.mod(S, 2.6) - 1.3) < 0.28)  # noqa: E731
    return _cape(W, ('velvet', dict(c='#8a2236')), ('fur', dict(c='#f8f6ee')), ('metal', dict(c='#e2b84e')), fur_collar=True) + []


@piece('glasses', 'anchor_face')
def glasses(W):
    k = W.k
    O = W.O
    S = []
    eyes = []
    for sx in (-1, 1):
        # the eye centre on the face, the rim a little in front of it
        a0 = 0.5 + sx * 0.08
        best = None
        for aa in np.linspace(a0 - 0.08, a0 + 0.08, 41):
            for bb in np.linspace(0.3, 0.6, 61):
                p = W.head.eval(np.array(aa), np.array(bb))
                d = (p[0] - sx * O.ex) ** 2 + (p[1] - O.ey) ** 2
                if best is None or d < best[0]:
                    best = (d, p)
        c = best[1] + np.array([0, 0, 1.6 * k])
        eyes.append(c)
        R = 2.6 * k
        S.append(ring_tube('rim' + 'lr'[sx > 0], ('metal', dict(c='#c8a04a')),
                           lambda u, c=c, R=R: c + np.stack([np.cos(2 * math.pi * np.asarray(u)) * R, np.sin(2 * math.pi * np.asarray(u)) * R * 0.9,
                                                             np.zeros_like(np.asarray(u, float))], -1), 0.22 * k, n=40, m=8, up=(0, 0, 1)))
        # the temple arm back over the cheek to the side of the head
        tp = W.head_at(0.5 + sx * 0.24, 0.42, 0.3 * k)
        S.append(tube('arm' + 'lr'[sx > 0], ('metal', dict(c='#c8a04a')), [c + np.array([sx * R, 0.3 * k, 0]), (c + tp) / 2 + np.array([sx * 0.8 * k, 0.4 * k, 0]), tp],
                      0.16 * k, n=12, m=6))
    mid = (eyes[0] + eyes[1]) / 2
    S.append(tube('bridge', ('metal', dict(c='#c8a04a')), [eyes[0] + np.array([2.6 * k, 0.4 * k, 0]), mid + np.array([0, 1.2 * k, 0.4 * k]),
                                                           eyes[1] + np.array([-2.6 * k, 0.4 * k, 0])], 0.2 * k, n=12, m=6))
    return S


@piece('monocle', 'anchor_face')
def monocle(W):
    S = glasses(W)
    keep = [sf for sf in S if sf.name in ('rimr', 'armr')]
    k = W.k
    rim = next(sf for sf in S if sf.name == 'rimr')
    p = rim.fn(np.array(0.0), np.array(0.75))
    keep.append(tube('chain', ('metal', dict(c='#c8a04a')), [p, p + np.array([1.0, -4.0, -0.5]) * k, p + np.array([2.4, -7.0, -2.5]) * k], 0.12 * k, n=16, m=5))
    return keep


@piece('holiday_sweater', 'anchor_chest')
def holiday_sweater(W):
    k = W.k
    y_top = W.O.chin() - 0.3 * k
    y_hem = W.O.by0 + W.O.bh * 0.26

    def motif(col_, row):
        # a Fair Isle band: zigzags and little trees in cream and green on red
        out = np.zeros(col_.shape + (4,), np.float32)
        r = np.mod(row, 14)
        zig = (r == 2) & (np.mod(col_ + row, 4) < 2)
        tree = (r >= 5) & (r <= 9) & (np.abs(np.mod(col_, 7) - 3) <= (r - 5) * 0.75)
        dots = (r == 12) & (np.mod(col_, 3) == 0)
        for m_, c in ((zig, '#f3ead6'), (tree, '#3e7a4a'), (dots, '#f3ead6')):
            out[m_, 0] = 1
            out[m_, 1:4] = hexrgb(c)
        return out
    S = [drape(W, 'body', ('knit', dict(c='#b8343a', motif=motif)), y_top, y_hem, 220, 0, 0.3 * k, folds=0, fold_amp=0, flare=0.6 * k)]
    S.append(ring_tube('collar', ('knit', dict(c='#2e6a40', rib=True)), _neck_loop(W, y_top + 0.2 * k, 1.0 * k, 0.1), 0.9 * k, squash=(1.0, 1.3)))
    return S


@piece('sweater', 'anchor_chest')
def sweater(W):
    k = W.k
    y_top = W.O.chin() - 0.3 * k
    y_hem = W.O.by0 + W.O.bh * 0.26
    S = [drape(W, 'body', ('knit', dict(c='#d9c39a')), y_top, y_hem, 220, 0, 0.3 * k, folds=0, fold_amp=0, flare=0.6 * k)]
    S.append(ring_tube('collar', ('knit', dict(c='#c8b086', rib=True)), _neck_loop(W, y_top + 0.2 * k, 1.0 * k, 0.1), 0.9 * k, squash=(1.0, 1.3)))
    return S


@piece('reindeer_antlers', 'anchor_head')
def antlers(W):
    k = W.k
    S = []
    # the headband over the crown from side to side
    def hb(u):
        u = np.asarray(u, float)
        a = 0.25 + 0.5 * u
        bq = 0.42 - 0.38 * np.sin(math.pi * u)
        return W.head_at(np.where(u < 0.5, 0.25 + 0.0 * u, 0.75), bq, 0.25 * k) * 0 + W.head_at(0.25 + 0.5 * u * 0 + (0.5 * (u >= 0.5)), bq, 0.25 * k)
    for sx in (-1, 1):
        base = W.head_at(0.5 + sx * 0.22, 0.12, 0.4 * k)
        tip = base + np.array([sx * 3.2 * k, 7.5 * k, -1.0 * k])
        S.append(tube('beam' + 'lr'[sx > 0], ('bone', dict(c='#9c7450')), [base, base + np.array([sx * 1.0, 3.5, 0.2]) * k, tip],
                      lambda t: 0.75 * k * (1 - 0.6 * t) + 0.05, n=14, m=8))
        for j, (f, d) in enumerate(((0.45, (sx * -1.6, 2.4, 0.6)), (0.75, (sx * 2.2, 1.8, -0.4)))):
            p = base + (tip - base) * f
            S.append(tube(f'tine{j}' + 'lr'[sx > 0], ('bone', dict(c='#9c7450')), [p, p + np.array(d) * k], lambda t: 0.45 * k * (1 - 0.6 * t) + 0.04, n=8, m=6))
    # a velvet band over the head joining them
    def band_pts(u):
        u = np.asarray(u, float)
        a = np.where(u < 0.5, 0.5 - 0.22, 0.5 + 0.22) * 0 + (0.28 + 0.44 * u)
        return W.head_at(a, 0.1 + 0.25 * np.abs(np.cos(math.pi * u)) * 0, 0.2 * k)
    S.append(tube('hb', ('felt', dict(c='#8a2a30')), [W.head_at(0.28, 0.2, 0.2 * k), W.head_at(0.38, 0.06, 0.25 * k), W.head_at(0.5, 0.02, 0.3 * k),
                                                      W.head_at(0.62, 0.06, 0.25 * k), W.head_at(0.72, 0.2, 0.2 * k)], 0.5 * k, n=24, m=6, squash=(1.0, 0.5)))
    del hb, band_pts
    return S


# ---------------------------------------------------------------------- more materials
@mat('canvas')
def m_canvas(T, c, **kw):
    col, h, r, m = m_cloth(T, c)
    U, S = T['U'], T['S']
    seam = np.abs(np.mod(U, 6.0) - 3.0) < 0.1  # (panel seams, stitched)
    col = np.where(seam[..., None], tint(col, -0.25), col)
    return col, h - 0.3 * seam, 0.88, 0.0


@mat('leather')
def m_leather(T, c, **kw):
    U, S = T['U'], T['S']
    peb = plume.fbm(U * 5, S * 5, 4, 2) - 0.5
    crease = np.abs(np.sin(U * 1.3 + plume.fbm(U * 0.4, S * 0.4, 8, 2) * 5)) < 0.06
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), peb * 0.16 - 0.2 * crease + (plume.fbm(U * 0.5, S * 0.5, 12, 2) - 0.5) * 0.2)
    return col, peb * 0.4 - 0.4 * crease, 0.6, 0.0


@mat('rubber')
def m_rubber(T, c, **kw):
    U, S = T['U'], T['S']
    n = plume.fbm(U * 0.6, S * 0.6, 14, 2) - 0.5
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), n * 0.12 + 0.12 * np.clip(T['N'][..., 1], 0, 1))
    return col, n * 0.2, 0.38, 0.0


@mat('glass')
def m_glass(T, c, **kw):
    U, S, N = T['U'], T['S'], T['N']
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), 0.3 * np.clip(N[..., 1], 0, 1) - 0.1)
    return col, np.zeros(U.shape), 0.08, 0.0


@mat('wood')
def m_wood(T, c, scales=False, **kw):
    """An acorn's cupule: overlapping little scales; or plain grain."""
    U, S = T['U'], T['S']
    if scales:
        row = np.floor(S / 0.7)
        fu = np.mod(U / 0.8 + 0.5 * np.mod(row, 2), 1.0)
        fv = np.mod(S / 0.7, 1.0)
        sc = (1 - (2 * fu - 1) ** 2) * (1 - fv)
        col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), (sc - 0.5) * 0.4 + (hsh(row, np.floor(U / 0.8), 3) - 0.5) * 0.15)
        return col, sc, 0.85, 0.0
    g = np.sin(S * 3.0 + plume.fbm(U * 0.8, S * 0.25, 3, 3) * 10) * 0.5
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), g * 0.18)
    return col, g * 0.3, 0.6, 0.0


@mat('petal')
def m_petal(T, c, c2=None, **kw):
    U, S = T['U'], T['S']
    vein = np.abs(np.mod(U * 1.8, 1.0) - 0.5) < 0.06
    base = np.broadcast_to(_rgb(c), U.shape + (3,)).copy()
    if c2:
        base = plume.mix(base, np.broadcast_to(_rgb(c2), base.shape), np.clip(1 - T['b'] * 2.5, 0, 1))
    col = tint(base, -0.08 * vein + (plume.fbm(U * 2, S * 2, 6, 2) - 0.5) * 0.12)
    return col, -0.2 * vein, 0.55, 0.0


@mat('leaf')
def m_leaf(T, c, **kw):
    U, S = T['U'], T['S']
    mid = np.abs(np.cos(2 * math.pi * T['a'])) > 0.96
    side = np.abs(np.mod((S + np.abs(np.cos(2 * math.pi * T['a'])) * 1.5) / 0.9, 1.0) - 0.5) < 0.07
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), 0.18 * (mid | side) + (plume.fbm(U * 1.5, S * 1.5, 7, 2) - 0.5) * 0.18)
    return col, 0.2 * (mid | side), 0.6, 0.0


@mat('gauze')
def m_gauze(T, c, **kw):
    U, S = T['U'], T['S']
    vein = (np.abs(np.mod(U * 0.9 + S * 0.2, 1.0) - 0.5) < 0.04) | (np.abs(np.mod(S * 0.7, 1.0) - 0.5) < 0.03)
    sp = hsh(np.floor(U * 6), np.floor(S * 6), 4) > 0.97
    col = tint(np.broadcast_to(_rgb(c), U.shape + (3,)), 0.25 * vein + 0.4 * sp + 0.1 * np.sin(U * 0.8 + S * 0.6))
    return col, 0.2 * vein, 0.18, 0.0


def disc(name, mat_, c, r_out, normal, up_hint=(0, 1, 0), wave=0.0, droop=0.0, r_in=0.0, n=48, m=6, outline=None):
    """A flat round sheet (a brim, a lens, a petal cluster's base): radius r_out (or outline(a) -> radius), gently
    waved and drooping at its edge, with a thickness loop round it."""
    c = np.asarray(c, float)
    nn = nrm(np.asarray(normal, float))
    u = nrm(np.cross(np.asarray(up_hint, float), nn)) if abs(np.dot(up_hint, nn)) < 0.95 else nrm(np.cross([1.0, 0, 0], nn))
    v = np.cross(nn, u)

    def fn(a, t):
        a = np.asarray(a, float)
        t = np.asarray(t, float)
        th = 2 * math.pi * a
        R = outline(a) if outline else r_out
        r = r_in + (R - r_in) * t
        return c + (np.cos(th)[..., None] * u + np.sin(th)[..., None] * v) * r[..., None] + nn * (wave * np.sin(th * 5) * t - droop * t ** 2)[..., None]
    return Surf(name, 'piece', fn, n, m, 2 * math.pi * r_out, r_out, mat_, wrap=True)


def strap(W, name, mat_, a0, a1, b0, b1, off, width, n=24):
    """A flat strap lying on the body (or head) from (a0, b0) to (a1, b1) in its parameters, `width` mm wide."""
    sfb = W.body

    def fn(a, t):
        a = np.asarray(a, float)
        t = np.asarray(t, float)
        aa = a0 + (a1 - a0) * t
        bb = b0 + (b1 - b0) * t
        P = sfb.eval(aa, bb)
        N = sfb.normals(aa, bb)
        tg = nrm(sfb.eval(np.clip(aa + 1e-3 * (a1 - a0), 0, 1), np.clip(bb + 1e-3 * (b1 - b0), 0, 1)) - P + 1e-9)
        side = nrm(np.cross(N, tg))
        loop = 2 * math.pi * a
        return P + N * (off + FUR + 0.6 * W.k + 0.25 * W.k * (0.5 + 0.5 * np.sin(loop)))[..., None] + side * (np.cos(loop) * width / 2)[..., None]
    L = 30.0 * W.k
    return Surf(name, 'piece', fn, 8, n, width * 2.2, L, mat_, wrap=True)


@piece('explorer', 'anchor_head', hides=True)
def explorer(W):
    k = W.k
    S = [hat(W, 'dome', ('canvas', dict(c='#d6c08a')), 0.36, 0.56, 0.55, cut=0.0, slouch=1.8 * k, puff=0.6 * k)]
    S.append(ring_tube('band', ('leather', dict(c='#6e4a2e')), _brim_pts(W, 0.36, 0.56, 1.2 * k), 0.7 * k, squash=(0.5, 1.2)))
    pts = _brim_pts(W, 0.38, 0.58, 0.9 * k)

    def brim(a, t):
        a = np.asarray(a, float)
        t = np.asarray(t, float)
        p = pts(a)
        cc = pts(np.linspace(0, 1, 64)).mean(0)
        out = nrm((p - cc) * np.array([1.0, 0, 1.0]))
        front = 0.5 + 0.5 * np.cos(2 * math.pi * (a - 0.5))
        r = t * (4.0 + 1.2 * front) * k
        return p + out * r[..., None] + np.array([0, -1.0, 0]) * (0.9 * k * t ** 1.6)[..., None]
    S.append(Surf('brim', 'piece', brim, 72, 8, 2 * math.pi * 14 * k, 5 * k, ('canvas', dict(c='#cbb37e')), wrap=True))
    return S


@piece('froghat', 'anchor_head', hides=True)
def froghat(W):
    k = W.k
    S = [hat(W, 'cap', ('knit', dict(c='#6fa65a')), 0.36, 0.56, 0.45, cut=0.0, slouch=1.2 * k, puff=0.9 * k)]
    S.append(ring_tube('rib', ('knit', dict(c='#5e9450', rib=True)), _brim_pts(W, 0.36, 0.56, 0.8 * k), 1.0 * k, squash=(1.0, 1.4)))
    for sx in (-1, 1):
        p = W.head_at(0.5 + sx * 0.07, 0.08, 2.2 * k)
        # a frog's eye: a knitted socket bulging from the cap, a felt eyeball set in it, a pupil, and a heavy knitted
        # lid drooping over the top (sleepy and soft)
        sock = p + np.array([0, 1.2 * k, 0.3 * k])
        S.append(ball('eye' + 'lr'[sx > 0], ('knit', dict(c='#6fa65a')), sock, 2.0 * k, n=18))
        eye = sock + np.array([0, 0.5 * k, 1.0 * k])
        S.append(ball('white' + 'lr'[sx > 0], ('felt', dict(c='#f6f2e6')), eye, 1.45 * k, n=16))
        S.append(ball('pupil' + 'lr'[sx > 0], ('felt', dict(c='#1e2420')), eye + np.array([0, -0.1 * k, 1.12 * k]), 0.55 * k, n=12))
        S.append(ball('lid' + 'lr'[sx > 0], ('knit', dict(c='#62994f')), eye, 1.7 * k, n=18, lid=0.42, tilt=0.55))
    return S


@piece('flowercrown', 'anchor_head')
def flowercrown(W):
    k = W.k
    S = [ring_tube('vine', ('wood', dict(c='#5e7a3a')), _brim_pts(W, 0.24, 0.3, 0.6 * k), 0.35 * k, n=64, m=6)]
    cols = [('#f2c4cc', '#fff2b0'), ('#f6f0e6', '#f2d060'), ('#c8b8ec', '#fff2b0'), ('#f6d080', '#e08a3a')]
    pts = _brim_pts(W, 0.24, 0.3, 1.0 * k)
    cc = pts(np.linspace(0, 1, 64)).mean(0)
    for i in range(9):
        a = 0.5 + (i - 4) * 0.075
        p = pts(np.array(a))
        out = nrm((p - cc) * np.array([1.0, 0.6, 1.0]))
        c1, c2 = cols[i % 4]
        S.append(disc(f'fl{i}', ('petal', dict(c=c1, c2=c2)), p + out * 0.4 * k, 1.6 * k * (1.1 if i == 4 else 0.85), out,
                      outline=lambda a: (0.55 + 0.45 * np.abs(np.cos(np.asarray(a) * 5 * math.pi)) ** 0.7) * 1.6 * k, wave=0.25 * k, droop=0.3 * k, n=40))
        S.append(ball(f'ctr{i}', ('felt', dict(c=c2)), p + out * 0.7 * k, 0.45 * k, n=8))
        if i % 2 == 0:
            lp = pts(np.array(a + 0.035))
            S.append(tube(f'leaf{i}', ('leaf', dict(c='#6e9a4a')), [lp, lp + out * 0.6 * k + np.array([0, 0.4, 0]) * k, lp + out * 1.2 * k + np.array([0.6, 1.4, 0]) * k],
                          lambda t: 0.75 * k * np.sin(math.pi * np.clip(t, 0, 1)) ** 0.7 + 0.03, n=10, m=8, squash=(1.0, 0.18), up=tuple(out)))
    return S


@piece('stargoggles', 'anchor_head')
def stargoggles(W):
    k = W.k
    S = [ring_tube('strap', ('leather', dict(c='#7a5232')), _brim_pts(W, 0.24, 0.42, 0.3 * k), 0.8 * k, squash=(0.35, 1.0))]
    for sx in (-1, 1):
        p = W.head_at(0.5 + sx * 0.085, 0.2, 0.6 * k)
        nn = nrm(p - W.head_at(0.5 + sx * 0.085, 0.2, -3.0 * k))
        S.append(tube('cup' + 'lr'[sx > 0], ('metal', dict(c='#c8a04a')), [p, p + nn * 1.6 * k], lambda t: 2.3 * k * (1 - 0.08 * t), n=6, m=24, up=(0, 1, 0)))
        S.append(disc('lens' + 'lr'[sx > 0], ('glass', dict(c='#7fb2c0')), p + nn * 1.5 * k, 1.9 * k, nn, n=28, m=4))
        S.append(ring_tube('rim' + 'lr'[sx > 0], ('metal', dict(c='#d8b45a')),
                           lambda u, p=p, nn=nn: p + nn * 1.65 * k + 2.15 * k * (np.cos(2 * math.pi * np.asarray(u))[..., None] * nrm(np.cross([0, 1.0, 0], nn))
                                                                                  + np.sin(2 * math.pi * np.asarray(u))[..., None] * np.array([0, 1.0, 0])),
                           0.3 * k, n=40, m=8, up=tuple(nn)))
    return S


@piece('sleepmask', 'anchor_head')
def sleepmask(W):
    k = W.k

    def fn(a, t):
        a = np.asarray(a, float)
        t = np.asarray(t, float)
        aa = 0.5 + (a - 0.5) * 0.62
        bb = 0.2 + (t - 0.5) * (0.16 + 0.1 * np.cos(2 * math.pi * (a - 0.5) * 2) ** 2)
        return W.head_at(aa, bb, 0.5 * k + 0.2 * k * np.sin(math.pi * t))
    moons = lambda U, S: (np.hypot(np.mod(U, 4.0) - 2.0, np.mod(S, 4.0) - 2.0) < 0.9) & (np.hypot(np.mod(U, 4.0) - 1.6, np.mod(S, 4.0) - 1.7) > 0.8)  # noqa: E731
    S = [Surf('mask', 'piece', fn, 48, 12, 22 * k, 5 * k, ('velvet', dict(c='#46596a', emb=moons, emb_c='#f1d39a')), wrap=False)]
    S.append(ring_tube('elastic', ('satin', dict(c='#3a4a58')), _brim_pts(W, 0.2, 0.32, 0.4 * k), 0.4 * k, squash=(0.4, 1.0)))
    return S


@piece('bell', 'anchor_neck')
def bell(W):
    k = W.k
    y = W.O.chin() - 0.6 * k
    S = [ring_tube('ribbon', ('satin', dict(c='#b8343a')), _neck_loop(W, y, 0.1 * k, 0.15), 0.85 * k, squash=(0.45, 1.0))]
    w, f, bk, zc = W.body_ring(y - 1.5 * k, 0.3 * k)
    top = np.array([0, y - 1.0 * k, zc + f + 0.5 * k])
    prof = lambda t: (0.5 + 1.6 * np.asarray(t) ** 1.6 + 0.35 * ss(0.85, 1.0, t)) * k  # noqa: E731  (a bell's flare)
    S.append(tube('bell', ('metal', dict(c='#e2b84a', engrave=lambda U, S: np.abs(S - 2.2) < 0.15)), [top, top + np.array([0, -1.6, 0.3]) * k, top + np.array([0, -3.2, 0.5]) * k],
                  prof, n=16, m=20))
    S.append(ball('clapper', ('metal', dict(c='#a07a2a')), top + np.array([0, -3.4, 0.5]) * k, 0.55 * k, n=10))
    return S


@piece('moonpendant', 'anchor_neck')
def moonpendant(W):
    k = W.k
    y = W.O.chin() - 0.5 * k
    S = [ring_tube('chain', ('metal', dict(c='#c9ced6', engrave=lambda U, S: np.mod(S, 0.5) < 0.12)), _neck_loop(W, y, 0.0, 0.1), 0.22 * k, n=72, m=6)]
    w, f, bk, zc = W.body_ring(y - 3.0 * k, 0.4 * k)
    c = np.array([0, y - 3.4 * k, zc + f + 0.3 * k])
    arc = np.array([c + 2.4 * k * np.array([math.cos(math.radians(a_)), math.sin(math.radians(a_)), 0]) for a_ in np.linspace(60, 300, 7)])
    S.append(tube('moon', ('metal', dict(c='#d8dde4')), arc, lambda t: 0.95 * k * np.sin(math.pi * np.clip(t, 0, 1)) ** 0.8 + 0.06, n=24, m=10, squash=(1.0, 0.55),
                  up=(0, 0, 1)))
    S.append(ball('stone', ('gem', dict(c='#bcd6ea')), c + np.array([0.6 * k, 0, 0.3 * k]), 0.6 * k, n=10))
    return S


@piece('lantern', 'anchor_back')
def lantern(W):
    k = W.k
    y = W.O.by0 + W.O.bh * 0.55
    w, f, bk, zc = W.body_ring(y, 2.6 * k)
    c = np.array([0, y, zc - bk - 2.6 * k])
    S = [tube('glass', ('glass', dict(c='#ffe3a0')), [c + np.array([0, -2.0, 0]) * k, c + np.array([0, 2.0, 0]) * k], lambda t: 1.7 * k * (1 - 0.15 * (2 * t - 1) ** 2), n=10, m=16)]
    S.append(tube('cap', ('metal', dict(c='#b08a3a')), [c + np.array([0, 2.0, 0]) * k, c + np.array([0, 3.6, 0]) * k], lambda t: 2.0 * k * (1 - 0.85 * t) + 0.1, n=8, m=16))
    S.append(tube('base', ('metal', dict(c='#b08a3a')), [c + np.array([0, -2.6, 0]) * k, c + np.array([0, -1.9, 0]) * k], 2.0 * k, n=4, m=16))
    for i in range(4):
        a_ = i * math.pi / 2 + math.pi / 4
        o = np.array([math.cos(a_), 0, math.sin(a_)]) * 1.8 * k
        S.append(tube(f'bar{i}', ('metal', dict(c='#9a7630')), [c + o + np.array([0, -2.0, 0]) * k, c + o + np.array([0, 2.0, 0]) * k], 0.18 * k, n=6, m=6))
    S.append(ring_tube('handle', ('metal', dict(c='#9a7630')), lambda u: c + np.array([0, 4.4 * k, 0]) + 1.1 * k * np.stack([np.cos(2 * math.pi * np.asarray(u)),
                       np.sin(2 * math.pi * np.asarray(u)), 0 * np.asarray(u, float)], -1), 0.18 * k, n=32, m=6, up=(0, 0, 1)))
    S.append(strap(W, 'strap', ('leather', dict(c='#6e4a2e')), 0.45, 0.02, 0.12, 0.55, 0.0, 1.1 * k))
    return S


@piece('fairywings', 'anchor_back')
def fairywings(W):
    k = W.k
    y = W.O.by0 + W.O.bh * 0.6
    w, f, bk, zc = W.body_ring(y, 0.4 * k)
    root = np.array([0, y, zc - bk - 0.4 * k])
    S = []
    for sx in (-1, 1):
        for j, (ang, L, Wd) in enumerate(((40, 9.0, 4.4), (-25, 6.4, 3.2))):
            a_ = math.radians(ang)
            d = np.array([sx * math.cos(a_), math.sin(a_), -0.35])
            tip = root + d * L * k
            S.append(tube(f'w{j}' + 'lr'[sx > 0], ('gauze', dict(c='#d6d0ec')), [root, root + d * L * k * 0.5 + np.array([0, 0.3, 0]) * k, tip],
                          lambda t, Wd=Wd: Wd * k * 0.5 * np.sin(math.pi * np.clip(t, 0, 1)) ** 0.6 + 0.03, n=16, m=12, squash=(1.0, 0.08), up=(0, 0, 1)))
    return S


def _bag(name, mat_, c, size, forward):
    """A soft bag: a rounded block (a superellipsoid), its front panel bulging a little."""
    c = np.asarray(c, float)
    sx_, sy_, sz_ = size
    fw = nrm(np.asarray(forward, float))

    def fn(a, b):
        th = 2 * math.pi * np.asarray(a, float)
        ph = math.pi * np.asarray(b, float)
        e = 0.45
        x = np.sign(np.sin(ph) * np.cos(th)) * np.abs(np.sin(ph) * np.cos(th)) ** e * sx_
        y = np.sign(np.cos(ph)) * np.abs(np.cos(ph)) ** e * sy_
        z = np.sign(np.sin(ph) * np.sin(th)) * np.abs(np.sin(ph) * np.sin(th)) ** e * sz_
        return c + np.stack([x, y, z], -1)
    return Surf(name, 'piece', fn, 32, 24, 2 * (sx_ + sz_) * 2, 2 * sy_ * 1.5, mat_, wrap=True)


def strap_path(W, name, mat_, path, width, lift=0.0, n=40):
    """A flat leather strap lying over the plumage along a path of body parameters [(a, b), ...] (a: 0 the back's
    centre, 0.5 the breast; b: 0 the shoulders' top .. 1 the belly), `width` mm wide, with thickness."""
    sfb = W.body
    path = np.asarray([(a, b, 0.0) for a, b in path], float)
    k = W.k

    def fn(a, t):
        a = np.asarray(a, float)
        t = np.asarray(t, float)
        ab = bez(path, t)
        aa, bb = ab[..., 0], ab[..., 1]
        P = sfb.eval(aa, bb)
        N = sfb.normals(aa, bb)
        ab2 = bez(path, np.clip(t + 2e-3, 0, 1))
        tg = nrm(sfb.eval(ab2[..., 0], ab2[..., 1]) - P + 1e-7)
        side = nrm(np.cross(N, tg))
        loop = 2 * math.pi * a
        off = FUR + 0.75 * k + lift + 0.22 * k * (0.5 + 0.5 * np.sin(loop))
        return P + N * off[..., None] + side * (np.sign(np.cos(loop)) * np.minimum(1, np.abs(np.cos(loop)) * 1.6) * width / 2)[..., None]
    L = 30.0 * k
    return Surf(name, 'piece', fn, 10, n, width * 2.4, L, mat_, wrap=True)


def _sheet(name, mat_, corners, bulge, n=16, m=12):
    """A soft panel (a flap, a pocket front): a bilinear patch between four corners, bulging out by `bulge` (a vector)
    in the middle, its corners rounded."""
    p00, p10, p11, p01 = (np.asarray(c, float) for c in corners)
    bulge = np.asarray(bulge, float)

    def fn(a, t):
        a = np.asarray(a, float)
        t = np.asarray(t, float)
        loop = 2 * math.pi * a
        u = 0.5 + 0.5 * np.cos(loop)  # (a thin loop across: the front face and the back face of the panel)
        side = np.sin(loop)
        P = ((1 - u) * (1 - t))[..., None] * p00 + (u * (1 - t))[..., None] * p10 + (u * t)[..., None] * p11 + ((1 - u) * t)[..., None] * p01
        b = np.sin(math.pi * u) * np.sin(math.pi * np.clip(t, 0, 1) * 0.5 + 0.5 * math.pi * 0)
        # round the bottom corners in
        rc = ss(0.75, 1.0, t) * (1 - np.sin(math.pi * u)) ** 2
        P = P + (p00 + p10) * 0 + ((p00 + p10 + p11 + p01) / 4 - P) * (0.25 * rc)[..., None]
        return P + bulge * (b * 1.0)[..., None] + bulge / max(np.linalg.norm(bulge), 1e-6) * (0.12 * side)[..., None]
    w = float(np.linalg.norm(p10 - p00))
    h = float(np.linalg.norm(p01 - p00))
    return Surf(name, 'piece', fn, n, m, w * 2.1, h, mat_, wrap=True)


def _buckle(name, c, normal, w, h, k):
    """A brass buckle: a rectangular frame with rounded corners and a centre bar."""
    c = np.asarray(c, float)
    nn = nrm(np.asarray(normal, float))
    u = nrm(np.cross([0, 1.0, 0], nn))
    v = np.cross(nn, u)

    def pts(t):
        t = np.asarray(t, float)
        th = 2 * math.pi * t
        x = np.sign(np.cos(th)) * np.abs(np.cos(th)) ** 0.35 * w / 2
        y = np.sign(np.sin(th)) * np.abs(np.sin(th)) ** 0.35 * h / 2
        return c + x[..., None] * u + y[..., None] * v
    return ring_tube(name, ('metal', dict(c='#d8b45a')), pts, 0.18 * k, n=40, m=6, up=tuple(nn))


@piece('backpack', 'anchor_back')
def backpack(W):
    """A canvas rucksack: a soft body with gussets, a leather flap with two buckled straps, a front pocket, and two
    padded straps over the shoulders and down the breast."""
    k = W.k
    y = W.O.by0 + W.O.bh * 0.55
    w, f, bk, zc = W.body_ring(y, 3.0 * k)
    c = np.array([0, y, zc - bk - 2.4 * k])
    S = [_bag('pack', ('canvas', dict(c='#8a6a44')), c, (5.4 * k, 6.2 * k, 2.4 * k), (0, 0, -1))]
    back = c[2] - 2.4 * k  # (the outward face, away from the owl)
    S.append(_sheet('pocket', ('canvas', dict(c='#7a5c3a')), [(-3.4 * k, y - 4.6 * k, back), (3.4 * k, y - 4.6 * k, back), (3.4 * k, y - 0.6 * k, back),
                                                               (-3.4 * k, y - 0.6 * k, back)], (0, 0, -1.3 * k)))
    # the flap: from over the top of the pack down the outer face
    S.append(_sheet('flap', ('leather', dict(c='#6e4a2e')), [(-5.2 * k, y + 5.6 * k, c[2] + 1.6 * k), (5.2 * k, y + 5.6 * k, c[2] + 1.6 * k),
                                                              (4.8 * k, y + 1.2 * k, back - 0.4 * k), (-4.8 * k, y + 1.2 * k, back - 0.4 * k)], (0, 1.4 * k, -1.4 * k)))
    for sx in (-1, 1):
        x = sx * 2.4 * k
        S.append(tube('tab' + 'lr'[sx > 0], ('leather', dict(c='#5e3e24')), [(x, y + 3.0 * k, back - 1.2 * k), (x, y + 0.4 * k, back - 0.8 * k), (x, y - 1.4 * k, back - 1.5 * k)],
                      0.55 * k, n=10, m=8, squash=(1.0, 0.25), up=(0, 0, 1)))
        S.append(_buckle('buckle' + 'lr'[sx > 0], (x, y + 1.0 * k, back - 1.25 * k), (0, 0, -1), 1.4 * k, 1.1 * k, k))
        # the shoulder strap: from the pack's top over the shoulder, down the breast, round under the wing to its foot
        # (body parameters: a 0 the back's centre, 0.25 the left flank, 0.5 the breast, 0.75 the right flank)
        path = [(0.06, 0.3), (0.2, 0.06), (0.36, 0.16), (0.35, 0.5), (0.3, 0.7)]
        if sx > 0:
            path = [(1 - a, b) for a, b in path]
        S.append(strap_path(W, 'strap' + 'lr'[sx > 0], ('leather', dict(c='#6e4a2e')), path, 1.5 * k))
    return S


@piece('satchel', 'anchor_back')
def satchel(W):
    """A leather satchel at the hip: a stiff body with a rounded flap, a brass buckle on its strap, and a broad strap
    from the far shoulder across the breast."""
    k = W.k
    y = W.O.by0 + W.O.bh * 0.32
    w, f, bk, zc = W.body_ring(y, 2.2 * k)
    c = np.array([w * 0.72, y, zc + f * 0.35])
    out = nrm(np.array([1.0, 0, 0.45]))
    S = [_bag('bag', ('leather', dict(c='#7a5232')), c, (2.0 * k, 3.6 * k, 4.4 * k), out)]
    o = c + out * 2.0 * k
    tg = nrm(np.cross([0, 1.0, 0], out))
    S.append(_sheet('flap', ('leather', dict(c='#6a4428')), [o + tg * 4.2 * k + np.array([0, 3.7 * k, 0]) - out * 1.8 * k, o - tg * 4.2 * k + np.array([0, 3.7 * k, 0]) - out * 1.8 * k,
                                                              o - tg * 3.9 * k + np.array([0, 0.2 * k, 0]) + out * 0.3 * k, o + tg * 3.9 * k + np.array([0, 0.2 * k, 0]) + out * 0.3 * k],
                    out * 0.9 * k + np.array([0, 0.8 * k, 0])))
    S.append(tube('tab', ('leather', dict(c='#5a3a20')), [o + np.array([0, 1.6 * k, 0]) + out * 0.4 * k, o + np.array([0, -0.6 * k, 0]) + out * 0.5 * k,
                                                          o + np.array([0, -1.8 * k, 0]) + out * 0.2 * k], 0.6 * k, n=10, m=8, squash=(1.0, 0.25), up=tuple(out)))
    S.append(_buckle('buckle', o + np.array([0, -0.2 * k, 0]) + out * 0.75 * k, out, 1.4 * k, 1.1 * k, k))
    S.append(strap_path(W, 'strap', ('leather', dict(c='#5e3c22')), [(0.12, 0.35), (0.22, 0.06), (0.38, 0.15), (0.5, 0.3), (0.62, 0.5), (0.7, 0.6)], 1.7 * k))
    return S


@piece('bow', 'anchor_head')
def bow(W):
    k = W.k
    p = W.head_at(0.5 + 0.12, 0.12, 0.8 * k)
    S = []
    for sx in (-1, 1):
        loop = [p, p + np.array([sx * 2.0, 1.6, 0.2]) * k, p + np.array([sx * 3.6, 0.4, 0.0]) * k, p + np.array([sx * 2.2, -1.0, 0.2]) * k, p]
        S.append(tube('loop' + 'lr'[sx > 0], ('satin', dict(c='#d0687a')), loop, lambda t: 1.1 * k * (0.5 + 0.5 * np.sin(math.pi * np.clip(t, 0, 1))), n=24, m=10,
                      squash=(1.0, 0.3), up=(0, 0, 1)))
        S.append(tube('tail' + 'lr'[sx > 0], ('satin', dict(c='#c45c70')), [p, p + np.array([sx * 0.8, -2.2, 0.3]) * k, p + np.array([sx * 1.4, -4.0, 0.2]) * k],
                      lambda t: 0.8 * k * (1 + 0.3 * t), n=12, m=8, squash=(1.0, 0.25), up=(0, 0, 1)))
    S.append(ball('knot', ('satin', dict(c='#b85466')), p + np.array([0, 0, 0.4 * k]), 0.9 * k, n=10))
    return S


def _coat(W, name_mat, collar_mat, buttons_mat=None, open_front=0.0, hood=False):
    k = W.k
    y_top = W.O.chin() - 0.3 * k
    y_hem = W.O.by0 + W.O.bh * 0.18
    arc = 300 - open_front
    S = [drape(W, 'coat', name_mat, y_top, y_hem, arc, 180, 0.35 * k, folds=5, fold_amp=0.25, flare=0.9 * k)]
    S.append(ring_tube('collar', collar_mat, _neck_loop(W, y_top + 0.2 * k, 1.0 * k, 0.1), 1.0 * k, squash=(1.0, 1.4)))
    if buttons_mat:
        for i in range(3):
            yy = y_top - (2.0 + i * 3.4) * k
            w, f, bk, zc = W.body_ring(yy, 0.6 * k)
            S.append(ball(f'btn{i}', buttons_mat, np.array([0, yy, zc + f + 0.2 * k]), 0.55 * k, n=10))
    return S


@piece('cardigan', 'anchor_chest')
def cardigan(W):
    return _coat(W, ('knit', dict(c='#a8865a')), ('knit', dict(c='#96764e', rib=True)), ('wood', dict(c='#6a4a2c')))


@piece('pajamas', 'anchor_chest')
def pajamas(W):
    stripes = lambda U, S: np.mod(np.floor(U / 1.2), 2) == 0  # noqa: E731
    return _coat(W, ('cloth', dict(c='#a9c4dc', c2='#eef2f4', pattern=stripes)), ('cloth', dict(c='#7f9cb8')), ('satin', dict(c='#f2ecdc')))


@piece('raincoat', 'anchor_chest')
def raincoat(W):
    return _coat(W, ('rubber', dict(c='#e8c24a')), ('rubber', dict(c='#d8b03a')), ('metal', dict(c='#cfd4da')))


@piece('cloudcloak', 'anchor_back')
def cloudcloak(W):
    k = W.k
    S = _cape(W, ('fur', dict(c='#eef2f6')), ('fur', dict(c='#f6f8fa')), ('gem', dict(c='#bcd8ee')), fur_collar=True)
    # cloud puffs billowing along the hem
    y = W.O.by0 + 1.2 * k
    for i in range(9):
        ang = math.radians(180 - 120 + 240 * i / 8)
        w, f, bk, zc = W.body_ring(y, 3.6 * k)
        p = np.array([math.sin(ang) * w, y + (0.8 if i % 2 else 0) * k, zc + math.cos(ang) * (f if math.cos(ang) > 0 else bk)])
        S.append(ball(f'puff{i}', ('fur', dict(c='#f2f5f8')), p, (1.9 if i % 2 else 1.5) * k, n=16, tufts=True))
    return S


@piece('acorn', 'anchor_head', hides=True)
def acorn(W):
    k = W.k
    S = [hat(W, 'cup', ('wood', dict(c='#8a6a46', scales=True)), 0.32, 0.5, 0.6, cut=0.0, slouch=1.5 * k, puff=0.7 * k)]
    S.append(ring_tube('rim', ('wood', dict(c='#7a5a3a', scales=True)), _brim_pts(W, 0.32, 0.5, 1.4 * k), 0.8 * k, squash=(1.0, 1.0)))
    top = W.head_at(0.5, 0.0, 2.2 * k)
    S.append(tube('stem', ('wood', dict(c='#5e4630')), [top, top + np.array([0.4, 1.5, 0]) * k, top + np.array([1.4, 2.4, -0.3]) * k], lambda t: 0.55 * k * (1 - 0.3 * t), n=10, m=8))
    return S


@piece('toadstool', 'anchor_head', hides=True)
def toadstool(W):
    k = W.k
    spots = lambda U, S: (np.hypot(np.mod(U, 3.0) - 1.5, np.mod(S + 1.5 * np.mod(np.floor(U / 3.0), 2), 3.0) - 1.5) < 0.6)  # noqa: E731
    S = [hat(W, 'cap', ('cloth', dict(c='#c0453c', c2='#f6efe0', pattern=spots)), 0.3, 0.42, 1.0, cut=0.0, slouch=2.6 * k, puff=2.2 * k)]
    # the gills under the brim: a waved ring
    pts = _brim_pts(W, 0.3, 0.42, 1.4 * k)

    def gills(a, t):
        a = np.asarray(a, float)
        t = np.asarray(t, float)
        p = pts(a)
        cc = pts(np.linspace(0, 1, 64)).mean(0)
        out = nrm((p - cc) * np.array([1.0, 0, 1.0]))
        return p + out * (t * 3.2 * k)[..., None] + np.array([0, 1.0, 0]) * (0.6 * k * t + 0.15 * k * np.sin(a * 2 * math.pi * 40) * t)[..., None]
    S.append(Surf('gills', 'piece', gills, 96, 6, 2 * math.pi * 14 * k, 3.2 * k, ('felt', dict(c='#efe2c8')), wrap=True))
    return S


@piece('sprout', 'anchor_head')
def sprout(W):
    k = W.k
    base = W.head_at(0.5, 0.02, 0.2 * k)
    top = base + np.array([0.2, 3.4, 0.2]) * k
    S = [tube('stem', ('leaf', dict(c='#7aa050')), [base, base + np.array([0, 1.8, 0.3]) * k, top], lambda t: 0.4 * k * (1 - 0.3 * t), n=12, m=8)]
    for sx in (-1, 1):
        S.append(tube('leaf' + 'lr'[sx > 0], ('leaf', dict(c='#86b05a')), [top, top + np.array([sx * 2.0, 1.2, 0.2]) * k, top + np.array([sx * 3.8, 0.8, 0.0]) * k],
                      lambda t: 1.4 * k * np.sin(math.pi * np.clip(t, 0, 1)) ** 0.75 + 0.03, n=14, m=10, squash=(1.0, 0.15), up=(0, 0, 1)))
    return S


# ====================================================================== build and export
def build(pid, W):
    anchor, hides, fn = PIECES[pid]
    surfs = fn(W)
    k = W.k
    size = 1024
    # pack islands (no sharing)
    dens = 22.0 * size / 1024
    while True:
        for sf in surfs:
            sf.pw = max(8, int(math.ceil(sf.w * dens)))
            sf.ph = max(8, int(math.ceil(sf.h * dens)))
        order = sorted(surfs, key=lambda q: -q.ph)
        x = y = rowh = 0
        ok = True
        for sf in order:
            if x + sf.pw + 8 > size:
                x, y, rowh = 0, y + rowh + 8, 0
            if y + sf.ph + 8 > size:
                ok = False
                break
            sf.px, sf.py = x + 4, y + 4
            x += sf.pw + 8
            rowh = max(rowh, sf.ph)
        if ok:
            break
        dens *= 0.93
    meshes = [(sf, mesh_of(sf)) for sf in surfs]
    # cavity: the piece and the tawny's head and body it lies on
    import bpy  # noqa: F401
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    occ = W.occ
    Vs, Fs, off = [], [], 0
    for _, m in meshes + occ:
        Vs.append(m['P'])
        Fs.append(m['T'] + off)
        off += len(m['P'])
    bvh = BVHTree.FromPolygons([tuple(v) for v in np.concatenate(Vs)], [tuple(int(i) for i in f) for f in np.concatenate(Fs)], all_triangles=True)
    rng = np.random.default_rng(3)
    u1, u2 = rng.random(24), rng.random(24)
    H = np.stack([np.sqrt(u1) * np.cos(2 * math.pi * u2), np.sqrt(u1) * np.sin(2 * math.pi * u2), np.sqrt(1 - u1)], 1)
    for sf, m in meshes:
        ao = np.ones(len(m['P']))
        for i, (p, n) in enumerate(zip(m['P'], m['N'])):
            a = np.array([1.0, 0, 0]) if abs(n[0]) < 0.9 else np.array([0, 1.0, 0])
            tu = nrm(np.cross(n, a))
            tv = np.cross(n, tu)
            o = Vector(tuple(p + n * 0.05))
            hit = sum(bvh.ray_cast(o, Vector(tuple(H[j, 0] * tu + H[j, 1] * tv + H[j, 2] * n)), 4.0 * k)[0] is not None for j in range(24))
            ao[i] = 1 - hit / 24
        m['ao'] = ao
    rgb = np.zeros((size, size, 3), np.float32)
    hgt = np.zeros((size, size), np.float32)
    rough = np.full((size, size), 0.9, np.float32)
    metal = np.zeros((size, size), np.float32)
    fur = np.zeros((size, size), np.float32)
    for sf, m in meshes:
        out = paint_island(sf, m, size, sf.tract)
        g = 4
        y0, x0 = sf.py - g, sf.px - g
        hh, ww = out['rgb'].shape[:2]
        ys, xs = slice(max(0, y0), min(size, y0 + hh)), slice(max(0, x0), min(size, x0 + ww))
        oy, ox = ys.start - y0, xs.start - x0
        sl = (slice(oy, oy + ys.stop - ys.start), slice(ox, ox + xs.stop - xs.start))
        rgb[ys, xs] = out['rgb'][sl]
        hgt[ys, xs] = out['h'][sl]
        rough[ys, xs] = out['rough'][sl]
        metal[ys, xs] = out['metal'][sl]
        fur[ys, xs] = out['fur'][sl]
    nmap = plume.normal_map(hgt, strength=1.1)
    G = ow.GLB()
    G.J['materials'].append({'name': 'piece_' + pid, 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 1.0,
                             'roughnessFactor': 1.0, 'metallicRoughnessTexture': {'index': 2}}, 'normalTexture': {'index': 1, 'scale': 1.0}})
    G.image(ow.webp(rgb, q=90))
    G.image(ow.webp(plume.downsample(nmap, 2) * 0.5 + 0.5, q=92))
    mr = np.zeros((size // 4, size // 4, 3), np.float32)
    mr[..., 1] = plume.downsample(rough[..., None], 4)[..., 0]
    mr[..., 2] = plume.downsample(metal[..., None], 4)[..., 0]
    mr[..., 0] = plume.downsample(fur[..., None], 4)[..., 0]
    G.image(ow.webp(mr, q=92))
    at, bone, sc = W.O.anchors[anchor]
    sc = np.asarray(sc, float)
    root = G.node('piece')
    tris = 0
    for sf, m in meshes:
        P = (m['P'] - at) / sc
        Nn = nrm(m['N'] / sc)
        uv = np.stack([(sf.px + m['A'] * sf.pw) / size, (sf.py + m['B'] * sf.ph) / size], 1)
        mi = G.mesh(pid + '_' + sf.name, P, Nn, uv, m['T'], 0)
        G.child(root, G.node(pid + '_' + sf.name, mesh=mi))
        tris += len(m['T'])
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(BUILD, exist_ok=True)
    dst = os.path.join(OUT, pid + '.glb')
    G.save(dst)
    ow.png(rgb, os.path.join(BUILD, pid + '_v4.png'))
    json.dump({'id': pid, 'anchor': anchor, 'hides': hides, 'tris': tris}, open(os.path.join(BUILD, pid + '.piece.json'), 'w'))
    print(f'[garment] {pid}: {tris} tris, {os.path.getsize(dst) // 1024} KB', flush=True)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ids = list(PIECES) if args and args[0] == 'all' else args
    W = Wearer()
    for i in ids:
        build(i, W)
