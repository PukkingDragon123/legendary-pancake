"""The owls' paint (owl.py): every feather of every tract laid as its own shingled stroke, the way a painter would.

A tract is a field of feathers flowing one way over a surface (the crown and nape, the facial disc radiating from each
eye, the ruff round it, mantle and breast, the belly's fluff, the coverts, the secondaries and primaries, the tail, the
trousers). shingle() lays the tract's feathers in rows across the flow (a jittered grid in the island's own (a, b)
parameters, with the true millimetre metric of the surface), and at every texel finds the feather on top: like roof
tiles, the one rooted furthest upstream covers the others, so only each feather's tip shows. The texel then knows its
feather (which one, where in it: along the shaft, across the vanes) and the feather above it (whose tip throws a little
shadow on it). paint functions colour the feathers in those coordinates: ground colour with a little per-feather
variation, the species' markings (shaft streaks, bars, spots, vermiculation, pale fringes, dark tips), barbs as fine
strokes, the rachis, frayed downy edges; the relief (each feather lifting toward its tip, the shaft's ridge, the barbs'
grooves) goes to a height field the normal map is made from. Then the surface's own ambient occlusion and the feather
shadows are laid in (cavity, no directional light).
"""
import math

import numpy as np

MARGIN = 4


# ====================================================================== helpers
def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def ss(e0, e1, x):
    t = np.clip((np.asarray(x, np.float32) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def hsh(*a):
    """A float hash in [0, 1) of integer arrays (vectorised)."""
    h = np.uint64(1469598103934665603)
    out = np.full(np.broadcast(*a).shape, h, np.uint64)
    for i, v in enumerate(a):
        v = np.asarray(v).astype(np.int64).astype(np.uint64)
        out = (out ^ (v + np.uint64(0x9E3779B97F4A7C15) + np.uint64(i * 7919))) * np.uint64(1099511628211)
        out ^= out >> np.uint64(29)
    return ((out >> np.uint64(11)) & np.uint64((1 << 53) - 1)).astype(np.float64) / float(1 << 53)


def vnoise(x, y, seed=0):
    """Smooth value noise in 2D (vectorised), about 0..1."""
    xi, yi = np.floor(x), np.floor(y)
    xf, yf = x - xi, y - yi
    u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    a = hsh(xi, yi, seed)
    b = hsh(xi + 1, yi, seed)
    c = hsh(xi, yi + 1, seed)
    d = hsh(xi + 1, yi + 1, seed)
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v


def fbm(x, y, seed=0, oct=3):
    s, a, t = 0.0, 0.5, 0.0
    for i in range(oct):
        s = s + a * vnoise(x * 2 ** i, y * 2 ** i, seed + i * 31)
        t += a
        a *= 0.5
    return s / t


def vnoise3(p, scale, seed=0):
    """Value noise of a 3D position (mm), sampled from three planar noises (cheap, seam free)."""
    q = p / scale
    return (vnoise(q[..., 0], q[..., 1], seed) + vnoise(q[..., 1], q[..., 2], seed + 7) + vnoise(q[..., 2], q[..., 0], seed + 13)) / 3


def mix(a, b, t):
    t = np.asarray(t, np.float32)
    nd = max(np.ndim(a), np.ndim(b))
    if t.ndim and t.ndim == nd - 1:
        t = t[..., None]
    return a + (b - a) * t


def tint(c, k):
    """Value shift of a colour (k < 0 darker and a touch cooler/saturated, k > 0 paler and warmer)."""
    c = np.asarray(c, np.float32)
    k = np.asarray(k, np.float32)
    if k.ndim and (k.ndim == c.ndim - 1 or (c.ndim == 1 and k.shape[-1:] != (1,))):
        k = k[..., None]
    dark = c * (1 + k) + np.array([-0.01, -0.005, 0.012], np.float32) * np.minimum(k, 0) * -1
    light = c + (1 - c) * k * 0.9 + np.array([0.01, 0.006, -0.012], np.float32) * k
    return np.where(k < 0, dark, light)


def downsample(a, f):
    h, w = a.shape[:2]
    return a.reshape(h // f, f, w // f, f, *a.shape[2:]).mean(axis=(1, 3))


def normal_map(h, strength=1.0):
    """Tangent-space normals (glTF: +x along u, +y toward the image top) from a height field (mm-ish relief)."""
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5
    k = 2.2 * strength
    n = np.stack([-gx * k, gy * k, np.ones_like(h)], -1)
    return n / np.linalg.norm(n, axis=-1, keepdims=True)


# ====================================================================== the shingle
def shingle(S, A, C, rows, wrap=True, seed=1, shape=2.3, fray=0.0, jit=0.46, sjit=0.6):
    """Lay a tract of feathers and find, per texel, the feather on top.
    S: (N,) mm along the flow (downstream +).  A: (N,) across: a fraction 0..1 of the row (wrap) or mm (no wrap).
    C: (N,) mm per unit of A at the texel (the row's circumference for wrap, 1 otherwise).
    rows: dict of arrays per row: S0 (root, ascending), n (feathers per unit of A), L (length), W (half width).
    Returns a dict of per-texel arrays: hit, fa (0 root .. 1 tip), fc (-1 .. 1 across), L, W, id (a hash), r (row),
    shade (0..1 the shadow of the tips above), edge (0 inside .. 1 at the outline)."""
    N = len(S)
    S0, nr, Lr, Wr = (np.asarray(rows[k], np.float64) for k in ('S0', 'n', 'L', 'W'))
    R = len(S0)
    r0 = np.clip(np.searchsorted(S0, S, 'right') - 1, 0, R - 1)
    best_root = np.full(N, np.inf)
    out = {k: np.zeros(N, np.float32) for k in ('fa', 'fc', 'L', 'W', 'id', 'edge')}
    out['r'] = np.zeros(N, np.int32)
    out['col'] = np.zeros(N, np.int32)
    hit = np.zeros(N, bool)
    cand = []
    K = int(np.ceil(np.max(Lr) / max(np.min(np.diff(S0)) if R > 1 else np.max(Lr), 1e-3))) + 1
    K = min(K, 6)
    p = shape
    dS = np.diff(S0, append=S0[-1] + (S0[-1] - S0[-2] if R > 1 else 1.0))
    for dr in range(-1, K):
        r = np.clip(r0 - dr, 0, R - 1)
        n = nr[r]
        off = 0.5 * (r % 2) + 0.31 * (r % 3 == 2)
        j0 = np.floor(A * n - off)
        for dj in (-1, 0, 1):
            j = j0 + dj
            jh = np.mod(j, n) if wrap else j  # (the same feather either side of a wrapped island's seam)
            h1 = hsh(r, jh, seed)
            h2 = hsh(r, jh, seed + 1)
            h3 = hsh(r, jh, seed + 2)
            ac = (j + off + 0.5 + (h1 - 0.5) * jit * 2) / n
            dA = A - ac
            if wrap:
                dA = dA - np.round(dA)
            c = dA * C
            L = Lr[r] * (0.86 + 0.28 * h2)
            W = Wr[r] * (0.86 + 0.28 * h3)
            root = S0[r] + (h2 - 0.5) * dS[r] * sjit
            a = S - root
            # a feather: a rounded blade from its root to its tip, widest past the middle
            u = (a - L * 0.52) / (L * 0.5)
            q = np.abs(u) ** p + np.abs(c / W) ** p
            if fray:
                barb = np.sin((a - np.abs(c) * 1.1) * (6.0 / max(np.mean(Wr), 0.2)) + h1 * 20)
                q = q - fray * 0.18 * barb * ss(0.4, 1.0, u)
            inside = q <= 1.0
            better = inside & (root < best_root)
            if better.any():
                best_root = np.where(better, root, best_root)
                hit |= better
                out['fa'] = np.where(better, np.clip(a / L, 0, 1), out['fa'])
                out['fc'] = np.where(better, np.clip(c / W, -1, 1), out['fc'])
                out['L'] = np.where(better, L, out['L'])
                out['W'] = np.where(better, W, out['W'])
                out['id'] = np.where(better, h1 * 0.5 + h3 * 0.5, out['id'])
                out['r'] = np.where(better, r, out['r'])
                out['col'] = np.where(better, j, out['col'])
                out['edge'] = np.where(better, np.clip(q, 0, 1), out['edge'])
            cand.append((root, q, u, W, L))
    # the shadow of the tips lying over this feather: a feather above (rooted upstream) whose outline passes just
    # upstream of this texel
    shade = np.zeros(N, np.float32)
    for root, q, u, W, L in cand:
        above = (root < best_root - 1e-6) & (q > 1.0) & (u > 0.1)
        if above.any():
            dist = (q ** (1 / p) - 1.0) * np.minimum(W, L * 0.5)
            sw = np.clip(0.11 * L + 0.06, 0.08, 0.5)
            sh = np.clip(1 - dist / sw, 0, 1) * above
            shade = np.maximum(shade, sh.astype(np.float32))
    out['hit'] = hit
    out['shade'] = shade
    return out


def make_rows(Sa, Sb, ds, n_of, L_of, W_of):
    """Rows from Sa to Sb (mm) spaced ds(S); n_of(S) feathers per unit across, L_of(S), W_of(S)."""
    S = [Sa - ds(Sa) * 0.5]
    while S[-1] < Sb + ds(S[-1]):
        S.append(S[-1] + ds(S[-1]))
    S = np.array(S)
    return {'S0': S, 'n': np.array([n_of(x) for x in S]), 'L': np.array([L_of(x) for x in S]), 'W': np.array([W_of(x) for x in S])}


# ====================================================================== feather looks
def barbs(F, spacing=0.17, slant=1.0, seed=0):
    """Fine barb strokes over the feather: (dark grooves 0..1, light ridges 0..1)."""
    a = F['fa'] * F['L']
    c = F['fc'] * F['W']
    ph = (a - np.abs(c) * slant) / spacing + F['id'] * 13.0
    # the barbs separate here and there (a split in the vane): a jolt in the phase
    split = (hsh(np.floor(a / (spacing * 6)), np.sign(c), (F['id'] * 1e4).astype(np.int64)) > 0.82) * 0.5
    fr = np.mod(ph + split, 1.0)
    return (fr < 0.28).astype(np.float32), ((fr > 0.5) & (fr < 0.72)).astype(np.float32)


def shaft(F, w=0.055, fade=0.85):
    """The rachis: a fine line down the middle (wider at the root), fading toward the tip."""
    c = np.abs(F['fc'] * F['W'])
    ww = w * (1.4 - F['fa'] * 0.7) + 0.02
    return ((c < ww) & (F['fa'] < fade)).astype(np.float32)


# ====================================================================== the painter
class Painter:
    def __init__(s, O, spec):
        s.O = O
        s.S = spec
        s.C = {k: hexrgb(v) if isinstance(v, str) and v.startswith('#') else v for k, v in spec['col'].items()}
        s.pat = spec.get('pat', {})
        s.k = O.k

    def col(s, name, fallback='up'):
        c = s.C.get(name)
        return c if c is not None else s.C[fallback]

    # -------------------------------------------------------------- island setup
    def island(s, sf, m):
        g = MARGIN
        pw, ph = sf.pw, sf.ph
        ii, jj = np.meshgrid(np.arange(-g, pw + g), np.arange(-g, ph + g), indexing='xy')
        a = (ii + 0.5) / pw
        b = (jj + 0.5) / ph
        if sf.wrap:
            a = np.mod(a, 1.0)
        else:
            a = np.clip(a, 0, 1)
        b = np.clip(b, 0, 1)
        P = sf.eval(a, b)
        N = sf.normals(a, b)
        # the vertex AO, bilinear over the grid
        ao = m['ao'].reshape(sf.nb, sf.na)
        fa_, fb_ = a * (sf.na - 1), b * (sf.nb - 1)
        i0 = np.clip(np.floor(fa_).astype(int), 0, sf.na - 2)
        j0 = np.clip(np.floor(fb_).astype(int), 0, sf.nb - 2)
        u, v = fa_ - i0, fb_ - j0
        AO = (ao[j0, i0] * (1 - u) + ao[j0, i0 + 1] * u) * (1 - v) + (ao[j0 + 1, i0] * (1 - u) + ao[j0 + 1, i0 + 1] * u) * v
        T = dict(a=a, b=b, P=P, N=N, ao=AO.astype(np.float32), sf=sf, shape=a.shape)
        # true metric: mm per unit of a (each row's length) and of b (along a middle line)
        bb = np.linspace(0, 1, 257)
        aa_ref = 0.5 if sf.tract not in ('wing',) else 0.25
        Pm = sf.eval(np.full_like(bb, aa_ref), bb)
        Sb = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(Pm, axis=0), axis=1))])
        T['S_of_b'] = (bb, Sb)
        T['S'] = np.interp(b, bb, Sb).astype(np.float64)
        aa = np.linspace(0, 1, 129)
        circ = []
        for bv in bb:
            Pr = sf.eval(aa, np.full_like(aa, bv))
            circ.append(np.linalg.norm(np.diff(Pr, axis=0), axis=1).sum())
        T['C_of_b'] = (bb, np.maximum(np.array(circ), 0.05))
        T['C'] = np.interp(b, bb, T['C_of_b'][1]).astype(np.float64)
        rgb = np.zeros(a.shape + (3,), np.float32)
        h = np.zeros(a.shape, np.float32)
        rough = np.full(a.shape, 0.86, np.float32)
        out = dict(rgb=rgb, h=h, rough=rough)
        if s.S.get('emissive'):
            out['emit'] = np.zeros(a.shape + (3,), np.float32)
        fn = getattr(s, 'paint_' + sf.tract, None) or s.paint_plain
        if not s.skin_dispatch(T, out, sf.tract):
            fn(T, out)
        # cavity: the surface's occlusion (never a directional light)
        k_ao = float(s.S.get('ao', 0.62))
        occ = 1 - k_ao * (1 - np.clip(T['ao'], 0, 1)) ** 1.3
        out['rgb'] = np.clip(out['rgb'] * occ[..., None], 0, 1)
        return out

    def rows_for(s, T, ds, du, L, W, S_from=None, S_to=None):
        """Rows over the whole island (b) with feathers ds mm apart along, du mm apart across (wrap: per row)."""
        bb, Sb = T['S_of_b']
        Cb = T['C_of_b'][1]
        S_from = Sb[0] if S_from is None else S_from
        S_to = Sb[-1] if S_to is None else S_to
        f = lambda v: v if callable(v) else (lambda x, v=v: v)  # noqa: E731
        ds, du, L, W = f(ds), f(du), f(L), f(W)
        circ = lambda x: float(np.interp(x, Sb, Cb))  # noqa: E731
        return make_rows(S_from, S_to, ds, lambda x: max(3, round(circ(x) / du(x))), L, W)

    # -------------------------------------------------------------- generic feather shading
    def feather_paint(s, F, base, T, sel, out, dark=None, light=None, marks=None, var=0.07, relief=1.0, barb_k=0.08, shaft_k=0.0,
                      fringe=0.0, fringe_col=None, soft=0.0):
        """Colour the texels `sel` from their feathers F (arrays over sel): base (n,3) ground per texel, then marks
        (a function returning (colour, alpha) per texel), barbs, shaft, fringe and tip shadows; relief to out['h']."""
        fa, fc, fid = F['fa'], F['fc'], F['id']
        col = base * (1 + (fid[:, None] - 0.5) * 2 * var * np.array([1.0, 0.96, 0.9], np.float32))
        # a soft lengthwise gradient: the visible tip a touch paler, the root (in the shadow of the feather above) deeper
        col = tint(col, (fa - 0.55) * 0.07)
        # a painter's broken colour: tiny texel-level variation inside every feather
        col = tint(col, (hsh(np.floor(fa * F['L'] * 9), np.floor(fc * F['W'] * 9), (fid * 997).astype(np.int64)) - 0.5) * 0.06)
        if marks is not None:
            mc, ma = marks(F, col)
            col = mix(col, mc, ma)
        dk, lt = barbs(F, spacing=max(0.12, 0.08 + 0.02 * F['W'].mean()))
        col = tint(col, -barb_k * dk * (1 - soft) + barb_k * 0.6 * lt * (1 - soft))
        if shaft_k:
            sh = shaft(F) * ss(2.5, 5.0, F['L'])
            col = tint(col, shaft_k * sh)
        if fringe:
            e = ss(0.55, 0.98, F['edge']) * ss(0.45, 0.8, fa)
            fcol = fringe_col if fringe_col is not None else tint(col, 0.35)
            col = mix(col, fcol, e * fringe)
        if 'shadow' in s.C:  # (white plumage: the shadows between feathers go a cool grey, not a darker white)
            col = mix(col, np.broadcast_to(s.C['shadow'], col.shape), np.clip(F['shade'] * 0.5 * (1 - 0.5 * soft), 0, 1))
        else:
            col = tint(col, -0.17 * F['shade'] * (1 - 0.5 * soft))
        idx = np.nonzero(sel)
        out['rgb'][idx] = col
        hh = relief * (0.3 * fa + 0.04 * (1 - dk) - 0.12 * F['shade'] + 0.05 * shaft(F)) * (1 - 0.6 * soft)
        out['h'][idx] = hh

    # -------------------------------------------------------------- the tracts
    def paint_plain(s, T, out):
        out['rgb'][:] = s.col('up')

    def warp(s, T, sel, S, A, C, amp, scale, seed=0, wrap=True):
        """Let the rows wander: S and A pushed about by a smooth noise of the 3D position (no feather grid shows)."""
        P = T['P'][sel]
        n1 = vnoise3(P, scale * s.k, seed + 101) - 0.5
        n2 = vnoise3(P, scale * s.k, seed + 202) - 0.5
        S2 = S + n1 * 2 * amp * s.k
        A2 = A + (n2 * 2 * amp * s.k) / (np.maximum(C, 0.3) if wrap else 1.0)
        return S2, A2

    # body: upperparts behind, underparts in front, the belly's fluff toward the hem
    def paint_body(s, T, out):
        O, k = s.O, s.k
        sel = np.ones(T['shape'], bool)
        S, A, Cc = T['S'][sel], T['a'][sel], T['C'][sel]
        P = T['P'][sel]
        Smax = T['S_of_b'][1][-1]
        fl = s.S.get('plush', 1.0)
        rows = s.rows_for(T, ds=lambda x: (0.72 + 0.45 * ss(0.55 * Smax, 0.95 * Smax, x)) * k * fl,
                          du=lambda x: (1.02 + 0.5 * ss(0.55 * Smax, 0.95 * Smax, x)) * k * fl,
                          L=lambda x: (2.3 + 1.5 * ss(0.5 * Smax, 0.95 * Smax, x)) * k * fl,
                          W=lambda x: (0.98 + 0.45 * ss(0.5 * Smax, 0.95 * Smax, x)) * k * fl)
        Sw, Aw = s.warp(T, sel, S, A, Cc, 0.75, 2.6, 1)
        Sw, Aw = s.warp(T, sel, Sw, Aw, Cc, 0.35, 1.1, 7)
        F = shingle(Sw, Aw, Cc, rows, wrap=True, seed=11, fray=0.6)
        # which tract each feather belongs to: decided at the texel, softened by a per-feather jitter
        front = np.cos(2 * math.pi * A + math.pi)  # +1 the breast, -1 the back
        thr = -0.3 + 0.75 * ss(0.32, 0.04, S / Smax)  # (the upperparts wrap further round the shoulders)
        under = ss(thr - 0.3 + (F['id'] - 0.5) * 0.5, thr + 0.3 + (F['id'] - 0.5) * 0.5, front).astype(np.float32)
        hem = ss(0.55, 0.85, S / Smax).astype(np.float32)
        s.body_colour(T, out, sel, F, P, under, hem, S / Smax)
        # the painter's markings over the plumage: long streaks, bars and vermiculation following the flow
        Sw2, Aw2 = s.warp(T, sel, S, A, Cc, 0.5, 2.0, 13)
        s.stroke_layers(T, out, sel, Sw2, Aw2, Cc, 'upper', 1 - under, wrap=True)
        s.stroke_layers(T, out, sel, Sw2, Aw2, Cc, 'under', under, wrap=True)

    def stroke_layers(s, T, out, sel, S, A, C, tract, weight, wrap=True):
        """Strokes laid along the flow over a tract (pat['strokes'][tract]: a list of layers): each layer a sparse field
        of tapering brush marks (streaks: long and thin; bars: short and wide; flecks), painted in its colour."""
        layers = s.pat.get('strokes', {}).get(tract, [])
        if not layers:
            return
        idx = np.nonzero(sel)
        rgb = out['rgb'][idx]
        hh = out['h'][idx]
        k = s.k
        for i, L in enumerate(layers):
            rows = make_rows(float(S.min()) - 3, float(S.max()) + 3, lambda x, v=L['ds'] * k: v,
                             (lambda x, v=L['du'] * k: max(3, round(float(np.median(C)) / v))) if wrap else (lambda x, v=L['du'] * k: 1.0 / v),
                             lambda x, v=L['L'] * k: v, lambda x, v=L['W'] * k: v)
            if wrap:  # (per-row feather counts from each row's own circumference)
                Sb, Cb = T['S_of_b'][1], T['C_of_b'][1]
                rows['n'] = np.array([max(3, round(float(np.interp(x, Sb, Cb)) / (L['du'] * k))) for x in rows['S0']])
            F = shingle(S, A, C, rows, wrap=wrap, seed=300 + i * 17, shape=L.get('shape', 2.0), jit=0.5, sjit=0.9)
            keep = F['hit'] & (((F['id'] * 7.77) % 1.0) < L.get('keep', 0.6))
            # a brush mark: full in the middle, tapering to both ends, a ragged edge
            taper = ss(0.0, 0.25, F['fa']) * ss(1.0, 0.7, F['fa'])
            rag = ss(1.0, 0.55, F['edge'] + 0.25 * (hsh(np.floor(S * 9 / k), np.floor(A * C * 9 / k), 5 + i) - 0.5))
            a = keep * taper * rag * L.get('a', 0.85) * weight
            if L.get('lo', 0) > 0 or L.get('hi', 1) < 1:  # (a layer over part of the tract only: streaks above, bars below)
                sn = S / max(float(T['S_of_b'][1][-1]), 1e-3)
                a = a * ss(L.get('lo', 0) - 0.08, L.get('lo', 0) + 0.08, sn) * ss(L.get('hi', 1) + 0.08, L.get('hi', 1) - 0.08, sn)
            c = s.C[L['c']] if L['c'] in s.C else hexrgb(L['c'])
            c = tint(np.broadcast_to(c, rgb.shape), (F['id'][:, None] - 0.5) * 0.15)
            rgb = mix(rgb, c, np.clip(a, 0, 1))
            if L.get('glow') and 'emit' in out:  # (stars that shine in the dark: the emissive map)
                em = out['emit'][idx]
                out['emit'][idx] = np.maximum(em, c * (np.clip(a, 0, 1) * L['glow'])[:, None])
            hh = hh - 0.03 * a
        out['rgb'][idx] = rgb
        out['h'][idx] = hh

    def body_colour(s, T, out, sel, F, P, under, hem, sn):
        C, pat = s.C, s.pat
        up = np.broadcast_to(s.col('up'), F['fa'].shape + (3,))
        und = mix(np.broadcast_to(s.col('under'), up.shape), np.broadcast_to(s.col('underLow', 'under'), up.shape), hem)
        base = mix(up, und, under)
        # broad tonal variation (a painter's wash): darker mantle, a warmer breast band
        wash = (vnoise3(P, 7.0 * s.k, 5) - 0.5) * 0.14 + (vnoise3(P, 2.2 * s.k, 6) - 0.5) * 0.06
        base = tint(base, wash)
        # the throat: the bib under the face runs a little way down the breast (the head and body meet in it)
        front = np.cos(2 * math.pi * T['a'][sel] + math.pi)
        bibw = ss(0.24, 0.07, sn) * ss(0.15, 0.7, front) * float(s.S.get('bib', 0.7))
        base = mix(base, np.broadcast_to(s.col('throat', 'under'), base.shape), bibw)
        marks_up = s.markfn(pat.get('upper', {}), 'up')
        marks_un = s.markfn(pat.get('under', {}), 'under')

        def marks(F2, col):
            c1, a1 = marks_up(F2, col)
            c2, a2 = marks_un(F2, col)
            w = under
            return mix(c1, c2, w), a1 * (1 - w) + a2 * w
        soft = 0.35 * hem * under + 0.25 * under
        s.feather_paint(F, base, T, sel, out, marks=marks, var=0.06, barb_k=0.06, shaft_k=-0.12, fringe=0.2, soft=soft)

    # ---- the markings vocabulary (feather-local): each returns (colour, alpha)
    def markfn(s, spec, ground):
        """spec: {kind: params} in the order they are laid: streak, bars, spots, tipdark, tiplight, verm, chevron."""
        C = s.C
        kinds = list(spec.items())

        def fn(F, col):
            fa, fc = F['fa'], F['fc']
            mc = col.copy()
            ma = np.zeros(fa.shape, np.float32)
            for kind, p in kinds:
                c = hexrgb(p['c']) if isinstance(p.get('c'), str) and p['c'].startswith('#') else C.get(p.get('c', 'upDark'), C['up'])
                keep = (F['id'] * 7.3 % 1.0) < p.get('keep', 1.0)
                if kind == 'streak':  # a dark streak along the shaft, widening toward the tip, never two alike
                    hv = (F['id'] * 3.7) % 1.0
                    w = p.get('w', 0.28) * (0.45 + 1.1 * hv) * ss(p.get('from', 0.25), 0.95, fa) * (1 - 0.7 * ss(0.9, 1.0, fa)) + 0.025
                    wob = 0.1 * np.sin(fa * 7.0 + F['id'] * 40) + 0.06 * np.sin(fa * 17.0 + F['id'] * 11)
                    m = (np.abs(fc + wob) < w) & keep
                elif kind == 'bars':  # cross bars over the vanes (wavy)
                    n = p.get('n', 3.0)
                    wob = 0.06 * np.sin(fc * 3.0 + F['id'] * 9)
                    ph = np.mod(fa * n + wob + ((F['id'] * 5.3) % 1.0) * p.get('jit', 1.0), 1.0)
                    m = (ph < p.get('w', 0.28)) & (fa > p.get('from', 0.3)) & (np.abs(fc) < p.get('across', 1.1) - 0.25 * ((F['id'] * 9.1) % 1.0)) & keep
                elif kind == 'spots':  # pale (or dark) spots on the vanes near the tip
                    d = np.minimum(np.hypot((fa - p.get('at', 0.72)) * 2.2, (np.abs(fc) - p.get('x', 0.45)) * 1.6),
                                   np.hypot((fa - p.get('at', 0.72) + 0.25) * 2.2, (np.abs(fc) - p.get('x', 0.45)) * 1.6) + (1 - p.get('two', 0)) * 9)
                    m = (d < p.get('r', 0.36)) & keep
                elif kind == 'dot':  # one round spot on the shaft near the tip (a barn owl's pearl, a snowy's)
                    d = np.hypot((fa - p.get('at', 0.8)) * 2.4, fc * 1.3)
                    m = (d < p.get('r', 0.3)) & keep
                    if p.get('ring'):
                        rc = hexrgb(p['ring']) if p['ring'].startswith('#') else C[p['ring']]
                        rim = (d >= p.get('r', 0.3)) & (d < p.get('r', 0.3) + 0.13) & keep
                        mc = np.where(rim[:, None], rc, mc)
                        ma = np.maximum(ma, rim * 0.9)
                elif kind == 'tipdark':
                    m = (fa > 1 - p.get('w', 0.18) - 0.05 * np.sin(fc * 4 + F['id'] * 7)) & keep
                elif kind == 'chevron':  # a dark V across the feather near its tip (a snowy owl's bar)
                    v = fa - p.get('at', 0.75) + np.abs(fc) * p.get('ang', 0.25)
                    m = (np.abs(v) < p.get('w', 0.09)) & keep
                elif kind == 'verm':  # fine vermiculation: wavy hair lines across the vanes
                    q = np.sin(fa * F['L'] * p.get('f', 9.0) + np.sin(fc * 5 + F['id'] * 30) * 1.6 + F['id'] * 40)
                    m = (q > 1 - p.get('w', 0.35)) & (fa > 0.25) & keep
                elif kind == 'edgepale':
                    m = (F['edge'] > p.get('at', 0.6)) & (fa > 0.5) & keep
                else:
                    continue
                a = p.get('a', 0.92)
                mc = np.where(m[:, None], c, mc)
                ma = np.maximum(ma, m * a)
            return mc, ma
        return fn

    # head: crown and nape flowing from the top, the facial disc radiating from each eye, the ruff round it
    def paint_head(s, T, out):
        O, k = s.O, s.k
        if O.cat:
            return s.paint_cathead(T, out)
        P = T['P']
        X, Y = P[..., 0], P[..., 1] - O.ey
        dd = O.disc_d(X, Y)
        frontish = (T['N'][..., 2] > -0.15) & (P[..., 2] > O.hzc)
        rw = s.S.get('ruffw', 1.5) * k
        disc = frontish & (dd < -0.15 * k)
        ruff = frontish & (dd >= -0.15 * k) & (dd < rw)
        crown = ~(disc | ruff)
        # ---- crown / nape: rows down from the top
        Smax = T['S_of_b'][1][-1]
        rows = s.rows_for(T, ds=0.72 * k, du=0.95 * k, L=2.0 * k, W=0.7 * k)
        sel = crown
        Sw, Aw = s.warp(T, sel, T['S'][sel], T['a'][sel], T['C'][sel], 0.4, 2.6, 2)
        F = shingle(Sw, Aw, T['C'][sel], rows, wrap=True, seed=21, fray=0.4)
        Pc = P[sel]
        base = np.broadcast_to(s.col('crown', 'up'), F['fa'].shape + (3,))
        # the throat and chin under the disc: the underparts' colour (a white bib on some)
        throat = ss(-2.0 * k, -5.0 * k, Pc[:, 1] - O.ey) * ss(0.0, 0.5, T['N'][sel][:, 2])
        base = mix(base, np.broadcast_to(s.col('throat', 'under'), base.shape), throat)
        base = tint(base, (vnoise3(Pc, 4.0 * k, 3) - 0.5) * 0.12)
        mk = s.markfn(s.pat.get('crown', {}), 'up')

        def marks(F2, col):
            c, a = mk(F2, col)
            return c, a * (1 - throat)
        s.feather_paint(F, base, T, sel, out, marks=marks, var=0.06, barb_k=0.05, fringe=0.12, soft=0.2)
        s.stroke_layers(T, out, sel, Sw, Aw, T['C'][sel], 'crown', 1 - throat, wrap=True)
        # ---- the disc: fine feathers radiating from each eye
        sel = disc
        Pd = P[sel]
        Xd, Yd = Pd[:, 0], Pd[:, 1] - O.ey
        sx = np.where(Xd >= 0, 1.0, -1.0)
        dx, dy = Xd - sx * O.ex, Yd
        rad = np.hypot(dx, dy)
        ang = (np.arctan2(dy, dx * sx) / (2 * math.pi)) % 1.0
        rmax = float(np.max(rad)) + 1.0
        rows = make_rows(O.er * 0.9, rmax, lambda r: 0.42 * k, lambda r: max(6, round(2 * math.pi * max(r, 0.6) / (0.5 * k))), lambda r: 1.6 * k, lambda r: 0.3 * k)
        F = shingle(rad, ang, 2 * math.pi * np.maximum(rad, 0.3), rows, wrap=True, seed=31, shape=2.0, fray=0.8)
        base = np.broadcast_to(s.col('disc'), F['fa'].shape + (3,)).copy()
        # the disc darkens (or pales) toward the eye and its rim; concentric rings on some
        eyek = float(s.S.get('eyering', -0.3))
        base = tint(base, eyek * ss(O.er * 2.8, O.er * 1.1, rad))
        base = tint(base, float(s.S.get('discedge', 0.0)) * ss(-2.5 * k, -0.2 * k, dd[sel]))
        rings = s.S.get('rings')
        if rings:
            rr = np.mod(rad / (rings['period'] * k), 1.0)
            ringm = (rr < rings['w']) & (rad > O.er * 2.2)
            base = np.where(ringm[:, None], mix(base, s.col('discDark'), rings.get('a', 0.6)), base)
        mk = s.markfn(s.pat.get('disc', {}), 'disc')
        s.feather_paint(F, base, T, sel, out, marks=mk, var=0.05, barb_k=0.05, soft=0.3, relief=0.6)
        s.face_details(T, out, disc, ruff, crown, dd)
        # ---- the ruff: short stiff feathers round the rim, a dark edge line
        sel = ruff
        Pr = P[sel]
        Xr, Yr = Pr[:, 0], Pr[:, 1] - O.ey
        yc = -0.25 * O.discr * O.hw
        ang = (np.arctan2(Yr - yc, Xr) / (2 * math.pi)) % 1.0
        perim = 2 * math.pi * O.discr * O.hw * 1.4
        dr = dd[sel] + 0.15 * k
        rows = make_rows(-0.2 * k, rw + 0.6 * k, lambda r: 0.38 * k, lambda r: max(12, round(perim / (0.55 * k))), lambda r: 1.1 * k, lambda r: 0.36 * k)
        F = shingle(dr, ang, np.full(dr.shape, perim), rows, wrap=True, seed=41, shape=2.2, fray=0.5)
        base = np.broadcast_to(s.col('ruff'), F['fa'].shape + (3,)).copy()
        edge = ss(0.55 * rw, 0.1 * k, dr)  # the inner edge: the ruff's dark (or pale) line
        base = mix(base, np.broadcast_to(s.col('ruffLine', 'ruff'), base.shape), edge * float(s.S.get('ruffline', 0.8)))
        base = mix(base, np.broadcast_to(s.col('ruffLight', 'ruff'), base.shape), ss(0.6 * rw, rw, dr) * 0.6)
        # the brows: the ruff above the eyes pales into the eyebrows on many owls
        s.feather_paint(F, base, T, sel, out, var=0.06, barb_k=0.05, relief=0.8)
        if s.S.get('bowtie'):  # the great grey's white 'bow tie' either side of a black chin spot under the disc
            O = s.O
            Yb = P[..., 1] - O.ey
            front = T['N'][..., 2] > 0.1
            yb = -O.discr * O.hw * 1.02
            for sx in (-1, 1):
                u = (P[..., 0] - sx * 2.6 * k) / (2.4 * k)
                v = (Yb - yb - 0.4 * k + 0.25 * k * u * u) / (0.75 * k)
                m = front & (u * u + v * v < 1) & (hsh(np.floor(P[..., 0] * 5), np.floor(P[..., 1] * 5), 4) > 0.12)
                out['rgb'][m] = mix(out['rgb'][m], s.col('brow'), 0.9)
            chin = front & (np.hypot(P[..., 0] / 1.3, (Yb - yb - 0.2 * k)) < 1.05 * k)
            out['rgb'][chin] = s.col('chin', 'upDark')

    def face_details(s, T, out, disc, ruff, crown, dd):
        """Brows, the ridge of bristles down to the bill, the eye's ring."""
        O, k = s.O, s.k
        P = T['P']
        X, Y = P[..., 0], P[..., 1] - O.ey
        front = T['N'][..., 2] > 0.2
        rgb = out['rgb']
        # pale brows arching over each eye toward the ridge (a V on many owls)
        bk = float(s.S.get('brows', 0.0))
        if bk:
            for sx in (-1, 1):
                u = X - sx * O.ex
                arc = O.er * 2.1 + 0.9 * k - 0.07 * u * u / k - 0.22 * sx * u
                wd = (0.5 * k) * (1 - ss(0.0, 3.4 * k, np.abs(u)) * 0.55) * (0.75 + 0.5 * vnoise(X * 3 / k, Y * 3 / k, 9))
                m = front & (np.abs(Y - arc) < wd) & (np.abs(u) < 3.4 * k)
                hair = np.mod((u * 4.2 / k) - (Y - arc) * 1.5 / k, 1.0) < 0.62
                rgb[m & hair] = mix(rgb[m & hair], s.col('brow'), bk)
                rgb[m & ~hair] = mix(rgb[m & ~hair], s.col('brow'), bk * 0.55)
        # the bristles between the eyes fanning down over the bill's base: a tapering wedge of hair strokes
        top = 1.8 * k
        wv = 0.3 * k + 0.32 * np.clip(top - Y, 0, 9)
        m = front & (np.abs(X) < wv) & (Y > -2.8 * k) & (Y < top)
        hair = np.mod(np.arctan2(np.abs(X), top + 0.6 * k - Y) * 26 / math.pi, 1.0) < 0.5
        rgb[m] = mix(rgb[m], s.col('bristle', 'brow'), ((0.5 + 0.3 * hair[m]) * ss(-2.8 * k, -1.6 * k, Y[m]) * (1 - 0.5 * ss(0.6, 1.0, np.abs(X[m]) / wv[m])))[:, None] * float(s.S.get('bristles', 0.8)))
        out['h'][m] += 0.06 * hair[m]
        # a soft ring of tiny feathers round each eye (darker on most, the dot sits in it)
        for sx in (-1, 1):
            d = np.hypot(X - sx * O.ex, Y)
            ring = disc & (d < O.er * 1.55)
            rgb[ring] = tint(rgb[ring], float(s.S.get('eyelid', -0.25)) * ss(O.er * 1.55, O.er * 0.9, d[ring])[:, None][:, 0])

    def paint_cathead(s, T, out):
        """The Meowl's kitten head: short fur in strokes flowing back from the nose, tabby stripes, a pale muzzle."""
        O, k = s.O, s.k
        P = T['P']
        sel = np.ones(T['shape'], bool)
        X, Y = P[..., 0], P[..., 1] - O.ey
        rows = s.rows_for(T, ds=0.34 * k, du=0.42 * k, L=1.5 * k, W=0.24 * k)
        F = shingle(T['S'][sel], T['a'][sel], T['C'][sel], rows, wrap=True, seed=71, shape=1.8, fray=1.0)
        base = np.broadcast_to(s.col('fur'), F['fa'].shape + (3,)).copy()
        Xs, Ys = X[sel], Y[sel]
        front = (T['N'][sel][:, 2] > 0.1)
        muzzle = front & (np.hypot(Xs / 1.35, Ys + 3.4 * k) < 3.9 * k)
        chin = front & (Ys < -4.5 * k)
        base = np.where((muzzle | chin)[:, None], s.col('muzzle'), base)
        # tabby: the M on the brow, stripes over the crown and down the cheeks
        ang = np.arctan2(Xs, P[sel][:, 2] - O.hzc)
        crown = (np.abs(np.mod(ang * 3.0 / math.pi + 0.12 * np.sin(Ys * 0.7), 1.0) - 0.5) < 0.15) & (Ys > 2.6 * k) & ~muzzle
        mmark = front & (np.abs(Ys - (2.9 * k + 1.0 * k * np.abs(np.sin(Xs * 1.2 / k)))) < 0.42 * k) & (np.abs(Xs) < 3.4 * k)
        cheek = front & ~muzzle & (np.abs(np.mod((Ys + np.abs(Xs) * 0.5) / (1.6 * k), 1.0) - 0.5) < 0.16) & (np.abs(Xs) > 4.6 * k) & (Ys < 0.5 * k)
        stripe = crown | mmark | cheek
        base = np.where(stripe[:, None], s.col('stripe'), base)
        base = tint(base, (vnoise3(P[sel], 3.0 * k, 9) - 0.5) * 0.12)
        s.feather_paint(F, base, T, sel, out, var=0.05, barb_k=0.04, soft=0.5, relief=0.5)
        rgb = out['rgb']
        # whiskers and the mouth: fine ink lines (whisker pads dotted)
        m = np.zeros(T['shape'], bool)
        for sx in (-1, 1):
            for i, dy in enumerate((-0.2, 0.5, 1.2)):
                x0 = sx * 2.4 * k
                t_ = (X - x0) * sx
                yl = -3.4 * k - dy * k * 0.7 + t_ * (0.12 * (i - 1)) - 0.015 * t_ ** 2 / k
                m |= (t_ > 0) & (t_ < 7.0 * k) & (np.abs(Y - yl) < 0.11 * k) & (T['N'][..., 2] > -0.2)
        rgb[m] = s.col('whisker')
        out['h'][m] += 0.1
        # the mouth: a little w under the nose
        u = np.abs(X)
        mouth = (T['N'][..., 2] > 0.3) & (np.abs(Y - (-4.7 * k + 0.35 * k * np.sin(np.clip(u / (1.4 * k), 0, 1) * math.pi))) < 0.14 * k) & (u < 1.5 * k)
        mouth |= (T['N'][..., 2] > 0.3) & (u < 0.12 * k) & (Y > -4.6 * k) & (Y < -3.7 * k)
        rgb[mouth] = s.col('mouth', 'stripe')
        dots = (T['N'][..., 2] > 0.3) & (hsh(np.floor(X / (0.6 * k)), np.floor(Y / (0.6 * k)), 5) > 0.55) & (np.abs(np.abs(X) - 2.0 * k) < 1.0 * k) & (np.abs(Y + 3.5 * k) < 0.9 * k)
        rgb[dots] = tint(rgb[dots], -0.25)

    def paint_ear(s, T, out):
        sel = np.ones(T['shape'], bool)
        k = s.k
        rows = s.rows_for(T, ds=0.3 * k, du=0.4 * k, L=1.3 * k, W=0.22 * k)
        F = shingle(T['S'][sel], T['a'][sel], T['C'][sel], rows, wrap=True, seed=77, shape=1.8, fray=1.0)
        inner = np.cos(2 * math.pi * T['a'][sel]) > 0.35
        base = np.where(inner[:, None], s.col('ear'), s.col('fur'))
        tip = T['b'][sel] > 0.72
        base = np.where((tip & ~inner)[:, None], s.col('stripe'), base)
        s.feather_paint(F, base, T, sel, out, var=0.05, barb_k=0.04, soft=0.6, relief=0.5)

    # wings: coverts at the shoulder, then the long flight feathers; the inner face pale and barred
    def paint_wing(s, T, out):
        O, k = s.O, s.k
        a, b = T['a'], T['b']
        outer = (a < 0.5)
        # the island's a runs round the loop: outer face 0..0.5 (leading edge -> trailing), inner face 0.5..1
        cf = (1 - np.cos(2 * math.pi * a)) / 2
        H = T['S_of_b'][1][-1]
        chord = 15.0 * k
        # (S along the wing, mm; across: chord fraction * chord, no wrap)
        S = T['S']
        Ac = cf * chord
        out_sel = outer
        # coverts: small feathers, flowing down, over the top third and the leading edge
        cov_line = 0.38 * H + cf * 0.1 * H
        rows = make_rows(-0.5, H + 2, lambda x: (0.8 + 1.6 * ss(0.25 * H, 0.75 * H, x)) * k,
                         lambda x: 1.0 / ((1.2 + 0.9 * ss(0.3 * H, 0.6 * H, x)) * k),
                         lambda x: (2.4 + 5.5 * ss(0.3 * H, 0.8 * H, x)) * k, lambda x: (0.9 + 0.6 * ss(0.3 * H, 0.7 * H, x)) * k)
        sel = out_sel
        F = shingle(S[sel], Ac[sel], np.ones(sel.sum()), rows, wrap=False, seed=51, shape=2.6, jit=0.12)
        flight = (S[sel] > cov_line[sel] - (F['id'] - 0.5) * 1.5 * k).astype(np.float32)
        prim = ss(0.6 * H, 0.75 * H, S[sel]) * ss(0.2, 0.5, cf[sel])
        base = mix(np.broadcast_to(s.col('covert', 'wing'), F['fa'].shape + (3,)), np.broadcast_to(s.col('wing'), F['fa'].shape + (3,)), flight)
        base = mix(base, np.broadcast_to(s.col('primary', 'wing'), base.shape), prim)
        base = tint(base, (vnoise3(T['P'][sel], 5.0 * k, 17) - 0.5) * 0.1)
        mc = s.markfn(s.pat.get('covert', {}), 'wing')
        mf = s.markfn(s.pat.get('flight', {}), 'wing')

        def marks(F2, col):
            c1, a1 = mc(F2, col)
            c2, a2 = mf(F2, col)
            return mix(c1, c2, flight), a1 * (1 - flight) + a2 * flight
        s.feather_paint(F, base, T, sel, out, marks=marks, var=0.06, barb_k=0.08, shaft_k=-0.12 - 0.12 * float(s.S.get('shaftpale', 0)) * -2,
                        fringe=0.2, relief=1.2)
        # the inner face (seen only in flight): pale coverts, barred flight feathers
        sel = ~outer
        rows = make_rows(-0.5, H + 2, lambda x: 1.4 * k, lambda x: 1.0 / (1.4 * k), lambda x: 4.0 * k, lambda x: 0.95 * k)
        F = shingle(S[sel], (1 - cf[sel]) * chord, np.ones(sel.sum()), rows, wrap=False, seed=53, shape=2.4, jit=0.15)
        base = np.broadcast_to(s.col('underwing', 'under'), F['fa'].shape + (3,)).copy()
        base = mix(base, tint(np.broadcast_to(s.col('primary', 'wing'), base.shape), 0.12), ss(0.5 * H, 0.75 * H, S[sel]) * 0.85)
        mk = s.markfn({'bars': {'c': 'wingBar', 'n': 3, 'w': 0.22, 'a': 0.55}} if s.pat.get('flight') else {}, 'under')
        s.feather_paint(F, base, T, sel, out, marks=mk, var=0.05, barb_k=0.06, relief=0.8)

    def paint_tail(s, T, out):
        k = s.k
        a = T['a']
        cf = (1 - np.cos(2 * math.pi * a)) / 2
        H = T['S_of_b'][1][-1]
        sel = np.ones(T['shape'], bool)
        W = float(np.max(T['C'])) * 0.5
        rows = make_rows(-0.5, H + 1, lambda x: 1.3 * k, lambda x: 1.0 / (1.3 * k), lambda x: (3.0 + 4.0 * ss(0.2 * H, 0.8 * H, x)) * k, lambda x: 0.85 * k)
        F = shingle(T['S'][sel], cf[sel] * W, np.ones(sel.sum()), rows, wrap=False, seed=61, shape=2.6, jit=0.1)
        base = np.broadcast_to(s.col('tail', 'wing'), F['fa'].shape + (3,)).copy()
        mk = s.markfn(s.pat.get('tail', {}), 'tail')
        s.feather_paint(F, base, T, sel, out, marks=mk, var=0.06, barb_k=0.08, shaft_k=-0.1, fringe=0.15)

    def paint_trousers(s, T, out):
        k = s.k
        sel = np.ones(T['shape'], bool)
        rows = s.rows_for(T, ds=0.42 * k, du=0.6 * k, L=1.5 * k, W=0.42 * k)
        F = shingle(T['S'][sel], T['a'][sel], T['C'][sel], rows, wrap=True, seed=81, shape=2.0, fray=1.0)
        base = np.broadcast_to(s.col('leg', 'under'), F['fa'].shape + (3,)).copy()
        mk = s.markfn(s.pat.get('leg', {}), 'leg')
        s.feather_paint(F, base, T, sel, out, marks=mk, var=0.05, barb_k=0.05, soft=0.6, relief=0.6)

    def paint_toe(s, T, out):
        O, k = s.O, s.k
        if O.toes == 'feathered':
            sel = np.ones(T['shape'], bool)
            rows = s.rows_for(T, ds=0.32 * k, du=0.45 * k, L=1.1 * k, W=0.3 * k)
            F = shingle(T['S'][sel], T['a'][sel], T['C'][sel], rows, wrap=True, seed=91, shape=2.0, fray=1.0)
            base = np.broadcast_to(s.col('leg', 'under'), F['fa'].shape + (3,)).copy()
            s.feather_paint(F, base, T, sel, out, var=0.05, barb_k=0.05, soft=0.6, relief=0.5)
            # the scaled pads underneath peek out
            under = T['N'][..., 1] < -0.55
            out['rgb'][under] = tint(np.broadcast_to(s.col('skin', 'toe'), (int(under.sum()), 3)), -0.1)
            return s.bristles(T, out, 0.0)
        s.paint_tarsus(T, out, scutes=True)

    def paint_tarsus(s, T, out, scutes=True):
        """Bare skin: overlapping scutes along the top, pebbled reticulate scales round the sides and the pads."""
        k = s.k
        S, A, Cc = T['S'], T['a'], T['C']
        c = s.col('toe', 'leg')
        sc = np.mod(S / (0.45 * k), 1.0)
        top = np.abs(np.sin(2 * math.pi * A)) > 0.0
        peb = hsh(np.floor(S / (0.28 * k)), np.floor(A * Cc / (0.28 * k)), 7)
        base = tint(np.broadcast_to(c, S.shape + (3,)), (peb - 0.5) * 0.16 - 0.18 * (sc > 0.82) + 0.06 * (sc < 0.3))
        out['rgb'][:] = base
        out['h'][:] = 0.15 * (1 - sc) * top + 0.04 * peb
        out['rough'][:] = 0.62
        s.bristles(T, out, float(s.S.get('toebristle', 0.0)))

    def bristles(s, T, out, amount):
        if amount <= 0:
            return
        k = s.k
        S, A, Cc = T['S'], T['a'], T['C']
        m = (hsh(np.floor(S / (0.22 * k)), np.floor(A * Cc / (0.2 * k)), 3) > 1 - amount) & (np.mod(A * Cc / (0.2 * k), 1) < 0.5)
        out['rgb'][m] = s.col('leg', 'under')

    def paint_talon(s, T, out):
        b = T['b']
        c = s.col('talon')
        out['rgb'][:] = tint(np.broadcast_to(c, b.shape + (3,)), 0.22 * ss(0.4, 0.0, b) + 0.12 * (np.cos(2 * math.pi * T['a']) > 0.6) * ss(0.2, 0.7, b))
        out['h'][:] = 0.0
        out['rough'][:] = 0.32

    def paint_beak(s, T, out):
        k = s.k
        b, a = T['b'], T['a']
        c = s.col('beak')
        top = np.sin(2 * math.pi * a)
        col = tint(np.broadcast_to(c, b.shape + (3,)), 0.12 * top - 0.28 * ss(0.55, 1.0, b) * float(s.S.get('beaktip', 1.0)))
        cere = b < 0.22
        col = np.where(cere[..., None], s.col('cere', 'beak'), col)
        # fine growth lines along the horn
        col = tint(col, -0.05 * (np.mod(b * 22, 1.0) < 0.2))
        out['rgb'][:] = col
        out['h'][:] = 0.02 * np.mod(b * 22, 1.0)
        out['rough'][:] = np.where(cere, 0.7, 0.38)
        # bristles overlying the base of the bill
        P = T['P']
        m = (b < 0.42) & (hsh(np.floor(a * 40), np.floor(b * 30), 2) > 0.45)
        out['rgb'][m] = mix(out['rgb'][m], s.col('bristle', 'brow'), 0.8)
        out['rough'][m] = 0.86
        del P

    def paint_gape(s, T, out):
        b = T['b']
        out['rgb'][:] = tint(np.broadcast_to(s.col('beak'), b.shape + (3,)), -0.15 - 0.2 * b)
        top = np.sin(2 * math.pi * T['a']) > 0.3
        out['rgb'][top] = s.col('gape', 'beak')
        out['rough'][:] = 0.45

    def paint_nose(s, T, out):
        b = T['b']
        out['rgb'][:] = tint(np.broadcast_to(s.col('nose'), b.shape + (3,)), 0.15 * np.sin(2 * math.pi * T['a']))
        out['rough'][:] = 0.4

    def paint_tuft(s, T, out):
        """An ear tuft: a few long feathers, dark centred with buff edges, barred on some."""
        k = s.k
        a, b = T['a'], T['b']
        across = np.abs(np.cos(2 * math.pi * a))  # 0 at the middle of each face .. 1 at the edges
        col = np.broadcast_to(s.col('tuft', 'up'), b.shape + (3,)).copy()
        edge = across > float(s.S.get('tuftedge', 0.55))
        col = np.where(edge[..., None], s.col('tuftLight', 'ruffLight'), col)
        bars = s.pat.get('tuftbars')
        if bars:
            col = np.where(((np.mod(b * bars, 1.0) < 0.3) & ~edge)[..., None], s.col('upDark'), col)
        # barbs: fine strokes slanting out from the shaft
        ph = np.mod((b * 9.0 * T['S_of_b'][1][-1] / (6 * k) - across * 1.8) * 3.0, 1.0)
        col = tint(col, -0.1 * (ph < 0.3) + 0.05 * (ph > 0.6))
        col = tint(col, -0.12 * (across < 0.08))
        out['rgb'][:] = col
        out['h'][:] = 0.1 * (1 - across) + 0.03 * (ph < 0.3)

    # ====================================================================== the special skins
    FEATHERED = ('body', 'head', 'wing', 'tail', 'trousers', 'toe', 'tuft', 'tarsus')

    def skin_dispatch(s, T, out, tract):
        """Gingerbread and the snowman are not feathered: their own material painters take every tract."""
        sid = s.S['id']
        if sid == 'gingerbread' and tract in s.FEATHERED:
            return s.paint_gingerbread(T, out, tract) or True
        if sid == 'snowman' and tract in s.FEATHERED:
            return s.paint_snow(T, out, tract) or True
        return False

    def surface_noise(s, T, scale, seed):
        return vnoise3(T['P'], scale * s.k, seed)

    # ---- gingerbread: golden baked dough, darker at the edges and underneath, pitted, sugar-dusted, piped icing
    def paint_gingerbread(s, T, out, tract):
        k = s.k
        P, N, a, b = T['P'], T['N'], T['a'], T['b']
        dough, baked = s.C['dough'], s.C['baked']
        n1 = s.surface_noise(T, 3.0, 1)
        n2 = s.surface_noise(T, 0.9, 2)
        bake = 0.5 * (1 - np.clip(T['ao'], 0, 1)) + 0.35 * ss(0.2, -0.8, N[..., 1]) + (n1 - 0.5) * 0.5
        if tract in ('wing', 'tail'):
            cf = (1 - np.cos(2 * math.pi * a)) / 2
            bake = bake + 0.6 * ss(0.8, 1.0, cf) + 0.4 * ss(0.85, 1.0, b)
        col = mix(np.broadcast_to(dough, a.shape + (3,)), np.broadcast_to(baked, a.shape + (3,)), np.clip(bake, 0, 1) * 0.75)
        col = tint(col, (n2 - 0.5) * 0.12)
        # pits and crumbs, a dust of sugar
        pit = hsh(np.floor(P[..., 0] * 3.2 / k), np.floor(P[..., 1] * 3.2 / k) + np.floor(P[..., 2] * 3.2 / k) * 57, 3)
        col = np.where((pit > 0.965)[..., None], tint(col, -0.3), col)
        col = np.where((pit < 0.012)[..., None], tint(col, 0.55), col)
        h = (n2 - 0.5) * 0.25 - 0.25 * (pit > 0.965)
        rough = np.full(a.shape, 0.88, np.float32)
        icing = np.zeros(a.shape, bool)
        O = s.O
        X, Y = P[..., 0], P[..., 1]
        if tract == 'body':
            front = np.cos(2 * math.pi * a + math.pi)
            Sn = T['S'] / T['S_of_b'][1][-1]
            # three rows of scallops piped across the chest, a piped hem round the belly
            u = X / (2.6 * k)
            for i, yy in enumerate((0.3, 0.42, 0.54)):
                ph = np.mod(u + 0.5 * (i % 2), 1.0)
                arc = yy + 0.045 * np.sqrt(np.clip(1 - (2 * ph - 1) ** 2, 0, 1))
                icing |= (front > 0.35) & (np.abs(Sn - arc) < 0.011)
            icing |= (np.abs(Sn - 0.86) < 0.012)
        elif tract == 'head':
            dd = O.disc_d(X, Y - O.ey)
            frontish = (N[..., 2] > -0.1) & (P[..., 2] > O.hzc)
            icing |= frontish & (np.abs(dd - 0.2 * k) < 0.26 * k)
            for sx in (-1, 1):
                u = X - sx * O.ex
                arc = O.er * 2.3 + 0.6 * k - 0.08 * u * u / k
                icing |= frontish & (np.abs(Y - O.ey - arc) < 0.22 * k) & (np.abs(u) < 2.6 * k)
        elif tract == 'wing':
            cf = (1 - np.cos(2 * math.pi * a)) / 2
            outer = a < 0.5
            H = T['S_of_b'][1][-1]
            S = T['S']
            for yy in (0.42, 0.62):
                zz = yy * H + 0.9 * k * np.abs(np.mod(cf * 4.0, 1.0) - 0.5) * 2
                icing |= outer & (np.abs(S - zz) < 0.2 * k)
            dots = outer & (np.hypot(np.mod(cf * 5, 1.0) - 0.5, (S - 0.82 * H) / (1.0 * k)) < 0.13)
            icing |= dots
        elif tract == 'tail':
            icing |= np.abs(T['S'] - 0.7 * T['S_of_b'][1][-1]) < 0.2 * k
        ic = s.C['icing']
        col = np.where(icing[..., None], tint(np.broadcast_to(ic, col.shape), (n2 - 0.5) * 0.08 - 0.08 * (1 - np.clip(T['ao'], 0, 1))), col)
        h = np.where(icing, 0.55, h)
        rough = np.where(icing, 0.42, rough)
        out['rgb'][:] = col
        out['h'][:] = h
        out['rough'][:] = rough

    def paint_gumdrop(s, T, out, which):
        c = s.C[('candy', 'mint', 'gold')[which]]
        n = s.surface_noise(T, 0.6, 9 + which)
        col = tint(np.broadcast_to(c, T['a'].shape + (3,)), (n - 0.5) * 0.2 + 0.25 * ss(0.3, 0.9, T['N'][..., 1]))
        sug = hsh(np.floor(T['P'][..., 0] * 7), np.floor(T['P'][..., 1] * 7) + np.floor(T['P'][..., 2] * 7) * 31, 2) > 0.9
        col = np.where(sug[..., None], tint(col, 0.6), col)
        out['rgb'][:] = col
        out['h'][:] = 0.3 * sug + (n - 0.5) * 0.2
        out['rough'][:] = np.where(sug, 0.55, 0.22)

    def paint_gumdrop0(s, T, out):
        s.paint_gumdrop(T, out, 0)

    def paint_gumdrop1(s, T, out):
        s.paint_gumdrop(T, out, 1)

    def paint_gumdrop2(s, T, out):
        s.paint_gumdrop(T, out, 2)

    # ---- the snowman: packed snow (lumpy, cool blue in the hollows, glinting), coal, a carrot, twigs, a knitted scarf
    def paint_snow(s, T, out, tract):
        k = s.k
        n1 = s.surface_noise(T, 2.2, 3)
        n2 = s.surface_noise(T, 0.7, 4)
        P = T['P']
        lump = n1 * 0.7 + n2 * 0.3
        sh = np.clip((1 - np.clip(T['ao'], 0, 1)) * 1.3 + (0.45 - lump) * 0.5, 0, 1)
        col = mix(np.broadcast_to(s.C['snow'], T['a'].shape + (3,)), np.broadcast_to(s.C['shade'], T['a'].shape + (3,)), sh)
        glint = hsh(np.floor(P[..., 0] * 6 / k), np.floor(P[..., 1] * 6 / k) + np.floor(P[..., 2] * 6 / k) * 41, 7) > 0.985
        col = np.where(glint[..., None], np.array([1.0, 1.0, 1.0], np.float32), col)
        out['rgb'][:] = col
        out['h'][:] = lump * 0.9
        out['rough'][:] = np.where(glint, 0.3, 0.8)

    def paint_coal(s, T, out):
        n = s.surface_noise(T, 0.5, 5)
        out['rgb'][:] = tint(np.broadcast_to(s.C['coal'], T['a'].shape + (3,)), (n - 0.5) * 0.4)
        out['h'][:] = n * 0.6
        out['rough'][:] = 0.55 - 0.25 * (n > 0.7)

    def paint_coal0(s, T, out):
        s.paint_coal(T, out)

    def paint_coal1(s, T, out):
        s.paint_coal(T, out)

    def paint_coal2(s, T, out):
        s.paint_coal(T, out)

    def paint_carrot(s, T, out):
        b = T['b']
        rings = np.mod(b * 14 + 0.3 * np.sin(T['a'] * 12.6), 1.0) < 0.16
        col = tint(np.broadcast_to(s.C['carrot'], b.shape + (3,)), -0.2 * rings + 0.12 * np.sin(2 * math.pi * T['a']) - 0.15 * ss(0.85, 1.0, b))
        out['rgb'][:] = col
        out['h'][:] = -0.2 * rings
        out['rough'][:] = 0.6

    def paint_twig(s, T, out):
        b, a = T['b'], T['a']
        n = vnoise(a * 6, b * 30, 3)
        col = tint(np.broadcast_to(s.C['twig'], b.shape + (3,)), (n - 0.5) * 0.4 + 0.1 * np.sin(2 * math.pi * a))
        out['rgb'][:] = col
        out['h'][:] = n * 0.4
        out['rough'][:] = 0.9

    def paint_scarf(s, T, out):
        """Hand knitting: rows of V stitches, stripes of red and cream, a soft fuzz."""
        k = s.k
        a, b = T['a'], T['b']
        U = a * T['C'] / (0.42 * k)
        Vv = T['S'] / (0.38 * k)
        row = np.floor(Vv)
        u = np.mod(U, 1.0)
        v = np.mod(Vv, 1.0)
        # a V stitch: two slanted loops per column
        vee = np.abs(u - 0.5) * 2 - (1 - v) * 0.9
        loop = np.abs(vee) < 0.35
        stripe = np.mod(np.floor(U / 6.0), 2) == 0
        base = np.where(stripe[..., None], s.C['scarf'], s.C['scarf2'])
        col = tint(base, np.where(loop, 0.06, -0.22) + (hsh(np.floor(U), row, 3) - 0.5) * 0.1)
        out['rgb'][:] = col
        out['h'][:] = np.where(loop, 0.4, 0.0)
        out['rough'][:] = 0.92
