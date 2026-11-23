"""furnC's lowpix kit for Hoot Hollow items: palette ramps, material styles, shape helpers and the GLB finish.

Every item is written in Python (one function per item in trinkets.py, fun.py, frost.py, starfall.py), which
emits a plain lowpix JSON spec to art/lowpix/items/<id>.json. build.py builds the specs with lowpix, then
`finish_glb` turns the raw lowpix GLB into the game asset in public/models/items/<id>.glb:

* units: the spec is modelled in px (16 px = 1 block, like the old box models); the GLB root is scaled by 1/16,
  so one GLB unit is one world unit (a block), origin bottom-centre, facing +z;
* materials: lit (scene light shades it) with painted AO and rims; parts named glow_* get an unlit material
  (bulbs, flames, stars), glass_* a see-through glass, water_* see-through water;
* static parts are merged into one mesh per material (few draw calls); animated parts keep their joints.
"""
from __future__ import annotations

import json
import math
import struct

import numpy as np

# ------------------------------------------------------------------ palette (mirror of src/gfx/palette.ts)
P = dict(
    ink=0x2e2b24, ink2=0x4b463a, ink3=0x6f6856,
    paper=0xf4eedd, oat=0xeae0c8, linen=0xdccfb0, straw=0xc9b78d,
    woodPale=0xd8bf98, woodLight=0xbf9d74, wood=0x9c7a56, woodDark=0x6f553d, woodDeep=0x4a392b, bark=0x5b4a3c,
    barkDark=0x3d3229,
    sageLight=0xc4cfa3, sage=0xa7b788, moss=0x86a06a, fern=0x66844f, leaf=0x557343, pine=0x3f5a3b, forest=0x2c4030,
    mist=0xd3e0dc, sky=0xaec8cc, lake=0x86a9b0, dusk=0x617f8c, slate=0x46596a, night=0x27313f, deepNight=0x1b222d,
    lamp=0xf1d39a, honey=0xdcb072, ochre=0xc59a52, terracotta=0xc0866a, clay=0xa66c55,
    rose=0xd9aca4, blush=0xe8b4ae, berry=0x9e5f66, plum=0x6e5266,
    lilac=0xb4a9c9, lavender=0xd3cce0, frost=0xdfe9ea, snow=0xf5f7f2, ice=0xbcd6dc,
    pebble=0xb9b2a4, stone=0x908a7e, stoneDark=0x6a655c, brass=0xc8a764, brassDark=0x8e7440, iron=0x5c5a56,
    cream=0xf1e6cc, buff=0xd9bf93, tawny=0xa87652, russet=0x8a5a3c, umber=0x5e4130, soot=0x3a3029,
    eye=0x231f1b,
)


def shade(c, f):
    r = min(255, round(((c >> 16) & 255) * f))
    g = min(255, round(((c >> 8) & 255) * f))
    b = min(255, round((c & 255) * f))
    return (r << 16) | (g << 8) | b


def mixc(a, b, t):
    ch = lambda h, s: (h >> s) & 255  # noqa: E731
    m = lambda s: round(ch(a, s) + (ch(b, s) - ch(a, s)) * t)  # noqa: E731
    return (m(16) << 16) | (m(8) << 8) | m(0)


def shadow(c, k=0.3):
    return mixc(shade(c, 1 - k * 0.6), P['slate'], k * 0.35)


def light(c, k=0.3):
    return mixc(shade(c, 1 + k * 0.35), P['lamp'], k * 0.3)


def col(c):
    if isinstance(c, str):
        return P[c] if c in P else int(c.lstrip('#'), 16)
    return c


def hx(c):
    return '#%06x' % col(c)


def ramp(base, dark=4, lite=3, deep=1.2, hi=0.95):
    """A hue-shifted ramp around a palette colour: shadows lean slate, highlights lean lamp. Index `dark` = base."""
    base = col(base)
    ds = [shadow(base, deep * (i + 1) / dark) for i in range(dark)][::-1]
    ls = [light(base, hi * (i + 1) / lite) for i in range(lite)]
    return [hx(c) for c in ds + [base] + ls]


def keys_ramp(keys, steps=8):
    """A ramp through several palette colours (dark to light), resampled to `steps` entries."""
    ks = [col(k) for k in keys]
    out = []
    for i in range(steps):
        t = i / (steps - 1) * (len(ks) - 1)
        j = min(int(t), len(ks) - 2)
        out.append(hx(mixc(ks[j], ks[j + 1], t - j)))
    return out


# the shared ramp library: every item draws from these, so the whole set reads as one hand-painted world
RAMPS = {
    # woods
    'oak': keys_ramp([shadow(P['woodDeep'], 0.6), 'woodDeep', 'woodDark', 'wood', 'woodLight', 'woodPale', light(P['woodPale'], 0.5)], 8),
    'walnut': keys_ramp([shadow(P['barkDark'], 0.8), 'barkDark', 'woodDeep', 'umber', 'woodDark', 'wood', 'woodLight'], 8),
    'cherry': keys_ramp([shadow(P['umber'], 0.9), 'umber', 'russet', 'clay', 'tawny', 'terracotta', 'buff'], 8),
    'pale': keys_ramp(['woodDark', 'wood', 'woodLight', 'woodPale', 'straw', 'oat', 'paper'], 8),
    'bark': keys_ramp([shadow(P['barkDark'], 0.8), 'barkDark', 'bark', 'woodDark', 'stoneDark', 'stone'], 7),
    # metals
    'brass': keys_ramp([shadow(P['brassDark'], 0.9), 'umber', 'brassDark', 'ochre', 'brass', 'honey', 'lamp', 'paper'], 9),
    'gold': keys_ramp(['russet', 'brassDark', 'ochre', 'honey', 'brass', 'lamp', light(P['lamp'], 0.8)], 8),
    'verd': ramp(mixc(P['sage'], P['lake'], 0.5), 3, 2),
    'iron': keys_ramp(['deepNight', 'soot', 'night', 'iron', 'stoneDark', 'stone', 'pebble'], 8),
    'silver': keys_ramp(['slate', 'dusk', 'stoneDark', 'stone', 'pebble', 'mist', 'frost', 'snow'], 8),
    # paper, cloth and creams
    'paper': keys_ramp([shadow(P['straw'], 0.6), 'straw', 'linen', 'oat', 'paper', light(P['paper'], 0.6)], 7),
    'parch': keys_ramp(['russet', 'ochre', 'straw', 'buff', 'linen', 'oat', 'paper'], 8),
    'cream': ramp('cream', 4, 3),
    'linen': ramp('linen', 4, 3),
    'oat': ramp('oat', 4, 3),
    'straw': ramp('straw', 4, 3),
    'ink': keys_ramp(['deepNight', 'ink', 'ink2', 'ink3', 'stoneDark'], 5),
    # greens
    'sage': ramp('sage', 4, 3),
    'moss': ramp('moss', 4, 3),
    'fern': ramp('fern', 4, 3),
    'pine': keys_ramp([shadow(P['forest'], 0.6), 'forest', 'pine', 'leaf', 'fern', 'moss', 'sage'], 8),
    'leaf': keys_ramp(['forest', 'pine', 'leaf', 'fern', 'moss', 'sage', 'sageLight'], 8),
    # blues and dusk
    'mist': ramp('mist', 4, 3),
    'lake': ramp('lake', 4, 3),
    'dusk': ramp('dusk', 4, 3),
    'night': keys_ramp([shadow(P['deepNight'], 0.5), 'deepNight', 'night', 'slate', 'dusk', 'lake'], 7),
    'navy': keys_ramp(['deepNight', mixc(P['night'], P['plum'], 0.25), mixc(P['slate'], P['plum'], 0.2), 'dusk', 'lake'], 7),
    'ice': keys_ramp(['dusk', 'lake', 'sky', 'ice', 'mist', 'frost', 'snow'], 8),
    'snow': keys_ramp([mixc(P['dusk'], P['lilac'], 0.3), 'lake', 'ice', 'mist', 'frost', 'snow', '#fbfcf8'], 8),
    'glass': keys_ramp(['lake', 'sky', 'mist', 'frost', 'snow'], 6),
    'water': keys_ramp(['slate', 'dusk', 'lake', 'sky', 'mist', 'frost'], 7),
    # warm accents
    'honey': ramp('honey', 4, 3),
    'lamp': keys_ramp(['ochre', 'honey', 'lamp', '#f7e2b8', 'paper', '#fffaf0'], 6),
    'ochre': ramp('ochre', 4, 3),
    'terracotta': ramp('terracotta', 4, 3),
    'clay': ramp('clay', 4, 3),
    'rose': ramp('rose', 4, 3),
    'blush': ramp('blush', 4, 3),
    'berry': ramp('berry', 4, 3),
    'plum': ramp('plum', 4, 3),
    'lilac': ramp('lilac', 4, 3),
    'lavender': ramp('lavender', 4, 3),
    'russet': ramp('russet', 4, 3),
    'tawny': ramp('tawny', 4, 3),
    'buff': ramp('buff', 4, 3),
    'stone': keys_ramp(['soot', 'stoneDark', 'stone', 'pebble', 'linen', 'oat'], 7),
    'soot': keys_ramp(['eye', 'soot', 'ink', 'ink2', 'ink3'], 6),
    # festive (calm: berry red, not candy red)
    'holly': keys_ramp([shadow(P['berry'], 0.9), mixc(P['berry'], P['plum'], 0.3), 'berry', mixc(P['berry'], P['clay'], 0.5), 'clay', 'terracotta', 'blush'], 8),
    'ginger': keys_ramp(['umber', 'russet', 'tawny', 'ochre', 'honey', 'buff'], 7),
    'icing': keys_ramp(['lilac', 'lavender', 'frost', 'paper', 'snow', '#fdfdf8'], 6),
    # lights (used on glow_* parts, painted near-white at the core)
    'flame': keys_ramp(['clay', 'terracotta', 'ochre', 'honey', 'lamp', 'paper', '#fffaf0'], 7),
    'bulb': keys_ramp(['ochre', 'honey', 'lamp', '#f8e6bc', 'paper', '#fffcf2'], 6),
    'star': keys_ramp(['ochre', 'honey', 'lamp', '#f9e9c2', '#fff8e6'], 5),
    'cold': keys_ramp(['dusk', 'lake', 'sky', 'ice', 'frost', 'snow', '#ffffff'], 7),
    'moonglow': keys_ramp(['lilac', 'lavender', 'frost', 'paper', '#fffdf6'], 5),
    'ember': keys_ramp(['berry', 'clay', 'terracotta', 'blush', 'lamp', '#fff6e6'], 6),
    'fish': keys_ramp([mixc(P['russet'], P['clay'], 0.5), 'clay', 'terracotta', mixc(P['terracotta'], P['honey'], 0.5), 'honey', 'lamp', 'paper'], 7),
}

# ------------------------------------------------------------------ styles (paint blocks)
RIM = {"light_shift": 1.0, "dark_shift": -1.0}


def _merge(base, **kw):
    d = dict(base)
    for k, v in kw.items():
        if k == 'layers':
            d['layers'] = list(d.get('layers', [])) + list(v)
        elif k == 'rim':
            d['rim'] = dict(d.get('rim', {}), **v)
        else:
            d[k] = v
    return d


def wood(r='oak', tone=4.4, grain='y', polish=True, knots=True, **kw):
    """Wood: grain lines running along `grain`, figure, a few knots and polished dashes."""
    ax = {'y': [1, 0, 0.83], 'x': [0, 1, 0.71], 'z': [0.77, 1, 0]}[grain]
    L = [
        {"id": "grain", "op": "stripes", "axis": ax, "period": 0.7, "width": 0.32, "shift": -0.75, "wobble": 0.45,
         "wobble_scale": 2.5},
        {"id": "grain2", "op": "stripes", "axis": ax, "period": 1.9, "width": 0.18, "shift": -0.55, "wobble": 0.9,
         "wobble_scale": 4},
        {"id": "figure", "op": "noise", "scale": 2.4, "amount": 0.35},
    ]
    if knots:
        L.append({"id": "knots", "op": "spots", "count": 2, "radius": [0.35, 0.6], "stretch": [1.6, 1, 1.6] if grain == 'y' else [1, 1.6, 1],
                  "shift": -1.6, "bevel": {"shadow": 1, "highlight": 1, "shadow_shift": -0.6, "highlight_shift": 0.8}})
    if polish:
        L.append({"id": "polish", "op": "gloss", "dash": True, "length": 3, "shift": 1.0, "density": 0.35, "post": True})
    return _merge({"ramp": r, "tone": tone, "rim": dict(RIM), "brush": {"flow": "long"}, "layers": L}, **kw)


def metal(r='brass', tone=4.6, tarnish=True, **kw):
    L = [
        {"id": "under", "op": "gradient", "axis": "y", "amount": 0.6},
        {"id": "mottle", "op": "noise", "scale": 1.2, "amount": 0.5},
    ]
    if tarnish and r in ('brass', 'gold'):
        L.append({"id": "tarnish", "op": "patches", "scale": 1.1, "threshold": 0.78, "ramp": "verd", "tone": 2.2,
                  "faces": ["sides", "bottom", "-up"]})
    L.append({"id": "polish", "op": "gloss", "dash": True, "length": 2, "shift": 1.5, "density": 0.55, "post": True})
    return _merge({"ramp": r, "tone": tone, "rim": {"light_shift": 1.4, "dark_shift": -1.2}, "layers": L}, **kw)


def glaze(r='sage', tone=4.2, dip=None, dip_to=-0.55, crackle=True, **kw):
    """Glazed ceramic: smooth colour, a dipped foot of bare clay (dip ramp), runs at the dip line, wet gloss."""
    L = [{"id": "pool", "op": "noise", "scale": 2.4, "amount": 0.45},
         {"id": "under", "op": "gradient", "axis": "y", "amount": 0.5}]
    if dip:
        L.append({"id": "dip", "op": "band", "axis": "y", "from": -1.0, "to": dip_to, "ramp": dip, "tone": 3.6,
                  "wobble": 0.12, "wobble_scale": 1.2, "bevel": {"shadow": 1, "highlight": 0, "shadow_shift": -1.2}})
    if crackle:
        L.append({"id": "crackle", "op": "cracks", "scale": 1.6, "width": 0.05, "threshold": 0.9, "shift": -0.45})
    L.append({"id": "wet", "op": "gloss", "dash": True, "length": 3, "shift": 1.8, "density": 0.7, "post": True})
    return _merge({"ramp": r, "tone": tone, "rim": {"light_shift": 1.2, "dark_shift": -1.0},
                   "brush": {"flow": "path", "rough": 0.4}, "layers": L}, **kw)


def cloth(r='linen', tone=4.2, weave=0.6, **kw):
    L = [{"id": "weave", "op": "stripes", "axis": [1, 0.0, 1], "period": weave, "width": 0.5, "shift": -0.35},
         {"id": "weft", "op": "stripes", "axis": "y", "period": weave, "width": 0.5, "shift": -0.25},
         {"id": "folds", "op": "noise", "scale": 2.2, "amount": 0.7}]
    return _merge({"ramp": r, "tone": tone, "rim": {"light_shift": 0.7, "dark_shift": -0.9},
                   "brush": {"flow": "horizontal", "rough": 0.6}, "layers": L}, **kw)


def knit(r='holly', tone=4.0, **kw):
    """Hand-knitted: rows of little V stitches (scales) and a fuzzy halo."""
    L = [{"id": "stitch", "op": "scales", "shape": "round", "along": "x", "size": [0.9, 0.7], "gap": 0.6,
          "highlight": 0.7, "shadow": -0.9, "gradient": 0.2, "jitter": 0.3},
         {"id": "fuzz", "op": "noise", "scale": 0.8, "amount": 0.5}]
    return _merge({"ramp": r, "tone": tone, "rim": {"light_shift": 0.6, "dark_shift": -0.9}, "layers": L}, **kw)


def paper(r='paper', tone=4.0, **kw):
    L = [{"id": "fibre", "op": "noise", "scale": 1.0, "amount": 0.45},
         {"id": "foxing", "op": "patches", "scale": 2.4, "threshold": 0.78, "shift": -0.6}]
    return _merge({"ramp": r, "tone": tone, "rim": {"light_shift": 0.6, "dark_shift": -0.8}, "layers": L}, **kw)


def plain(r, tone=4.0, noise=0.4, gloss=False, rim=None, **kw):
    L = [{"id": "mottle", "op": "noise", "scale": 1.4, "amount": noise}] if noise else []
    if gloss:
        L.append({"id": "gloss", "op": "gloss", "dash": True, "length": 2, "shift": 1.4, "density": 0.6, "post": True})
    return _merge({"ramp": r, "tone": tone, "rim": rim or dict(RIM), "layers": L}, **kw)


def glow(r='bulb', tone=4.0, **kw):
    """For glow_* parts: flat, bright, a pale core; no brush, almost no painted light."""
    return _merge({"ramp": r, "tone": tone, "light": 0.25, "brush": {"off": True},
                   "rim": {"light_shift": 1.0, "dark": 0, "light": 1}, "layers": [
                       {"id": "core", "op": "gradient", "axis": "y", "amount": 0.5}]}, **kw)


def glass(r='glass', tone=3.0, **kw):
    return _merge({"ramp": r, "tone": tone, "light": 0.45, "brush": {"off": True},
                   "rim": {"light_shift": 1.6, "dark": 0}, "layers": [
                       {"id": "sheen", "op": "band", "axis": "x", "from": -0.75, "to": -0.55, "ramp": r, "tone": 5.2,
                        "faces": ["-down"]},
                       {"id": "sheen2", "op": "band", "axis": "x", "from": -0.45, "to": -0.38, "ramp": r, "tone": 4.6,
                        "faces": ["-down"]},
                       {"id": "glint", "op": "gloss", "dash": True, "length": 2, "shift": 2.0, "density": 0.6, "post": True}]}, **kw)


def leafy(r='leaf', tone=4.0, snow=False, **kw):
    L = [{"id": "needles", "op": "stripes", "axis": [1, 0, 0.7], "period": 0.55, "width": 0.4, "shift": -0.8, "wobble": 0.6},
         {"id": "clumps", "op": "patches", "scale": 1.3, "threshold": 0.55, "shift": 0.9,
          "bevel": {"shadow": 1, "highlight": 1, "shadow_shift": -1.2, "highlight_shift": 0.6}},
         {"id": "depth", "op": "noise", "scale": 0.9, "amount": 0.7}]
    if snow:
        L.append({"id": "snow", "op": "patches", "scale": 1.0, "threshold": 0.7, "ramp": "snow", "tone": 5.4,
                  "faces": ["up"], "bevel": {"shadow": 1, "highlight": 0, "shadow_ramp": r, "shadow_tone": 1.2}})
    return _merge({"ramp": r, "tone": tone, "rim": {"light_shift": 1.0, "dark_shift": -1.2},
                   "brush": {"flow": "vertical", "rough": 0.75}, "layers": L}, **kw)


def snowy(tone=5.0, **kw):
    L = [{"id": "drifts", "op": "noise", "scale": 1.4, "amount": 0.7},
         {"id": "hollows", "op": "patches", "scale": 1.8, "threshold": 0.66, "shift": -0.8},
         {"id": "glint", "op": "gloss", "length": 1, "shift": 1.5, "density": 0.25, "post": True}]
    return _merge({"ramp": "snow", "tone": tone, "rim": {"light_shift": 0.8, "dark_shift": -0.9},
                   "brush": {"flow": "horizontal", "rough": 0.45}, "layers": L}, **kw)


# ------------------------------------------------------------------ geometry helpers


def _rot(deg):
    rx, ry, rz = (math.radians(float(a)) for a in deg)
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


def _r(v, n=4):
    return [round(float(x), n) for x in v]


# texel density multiplier: fine hand-painted texels instead of chunky pixels (set FURNC_HD=1 for the old look)
HD = float(__import__("os").environ.get("FURNC_HD", "2"))


def smooth_sides(n):
    return int(min(24, max(n, round(n * 1.4))))


class Spec:
    """One item. Coordinates are world px (origin bottom-centre, front +z); parts can hang under bones."""

    def __init__(self, id, name, density=2.5, tris=2600, light=None, brush=None, desc='', wall=False):
        self.id, self.name, self.density, self.wall = id, name, density, wall
        self.parts, self.frames, self.styles, self.anims = [], {}, {}, {}
        self.tris = tris
        self.light = light or {"dir": [-0.5, 1.0, 0.65], "strength": 0.6, "gradient": 0.3, "ao": 0.55, "ao_height": 3.0}
        self.brush = brush or {"flow": "long", "length": 1.6, "width": 0.45, "rough": 0.55, "overshoot": 0.3,
                               "textures": {"oak": "wood", "walnut": "wood", "cherry": "wood", "pale": "wood",
                                            "bark": "wood", "brass": "metal", "gold": "metal", "iron": "metal",
                                            "silver": "metal", "linen": "cloth", "cream": "cloth", "stone": "stone",
                                            "pine": "fur", "leaf": "organic", "moss": "moss", "ginger": "organic"}}
        self.desc = desc
        self._n = 0

    # styles ---------------------------------------------------------------
    def style(self, name, s):
        self.styles[name] = s
        return name

    def _st(self, style):
        """Accept a style name or an inline style dict (registered under a generated name)."""
        if isinstance(style, dict):
            self._n += 1
            name = f"s{self._n}"
            self.styles[name] = style
            return name
        return style

    # parts ----------------------------------------------------------------
    def _add(self, id, parent, shape, at, rot=None, centre=None, **kw):
        assert id not in self.frames, f"duplicate part {id}"
        Rp, tp = self.frames[parent] if parent else (np.eye(3), np.zeros(3))
        at = np.array(at, float)
        Rw = Rp @ _rot(rot or (0, 0, 0))
        d = {"id": id, "shape": shape}
        if parent:
            d["parent"] = parent
        d["pivot"] = _r(Rp.T @ (at - tp))
        if centre is not None:
            off = Rw.T @ (np.array(centre, float) - at)
            if np.abs(off).max() > 1e-9:
                d["offset"] = _r(off)
        if rot and any(rot):
            d["rotation"] = _r(rot, 3)
        for k, v in kw.items():
            if v is not None:
                d[k] = v
        if 'style' in d:
            d['style'] = self._st(d['style'])
        self.parts.append(d)
        self.frames[id] = (Rw, at)
        return d

    def at(self, parent, p):
        """World position of a point given in a part's own (rotated) frame, relative to its pivot."""
        R, t = self.frames[parent]
        return tuple(float(v) for v in t + R @ np.array(p, float))

    def bone(self, id, at, parent=None, rot=None):
        return self._add(id, parent, "bone", at, rot)

    def box(self, id, size, centre, style, parent=None, rot=None, pivot=None, chamfer=None, hide=None, **kw):
        """A box of `size` whose centre is `centre` (world px); it turns about `pivot` (default: its centre)."""
        at = pivot if pivot is not None else centre
        return self._add(id, parent, "box", at, rot, centre=centre, size=_r(size), style=style, chamfer=chamfer,
                         hide=hide, **kw)

    def taper(self, id, size, centre, style, parent=None, rot=None, pivot=None, front_scale=None, back_scale=None,
              chamfer=None, hide=None, **kw):
        at = pivot if pivot is not None else centre
        return self._add(id, parent, "taper", at, rot, centre=centre, size=_r(size), style=style,
                         front_scale=front_scale, back_scale=back_scale, chamfer=chamfer, hide=hide, **kw)

    def lathe(self, id, profile, at, style, parent=None, sides=12, rot=None, caps=(False, True), subdiv=1, squash=1.0,
              round=2.0, angle=0.0, smooth=True, **kw):
        """A turned form round the local y axis: profile = [(radius, y), ...] bottom to top (y from `at`)."""
        rings = [{"at": [0, y, 0], "size": _r([max(r, 0) * 2, max(r, 0) * 2 * squash])} for r, y in profile]
        sides = smooth_sides(sides)
        return self._add(id, parent, "loft", at, rot, rings=rings, profile={"sides": sides, "round": round, "angle": angle},
                         subdiv=subdiv, caps=list(caps), style=style, up=[0, 0, 1], smooth=smooth, **kw)

    def tube(self, id, pts, radius, style, parent=None, sides=6, caps=(True, True), subdiv=1, at=None, round=2.0,
             up=None, **kw):
        """A tube through world points (handles, rails, rockers, cane hooks); radius may be a list per point."""
        at = np.array(at if at is not None else pts[0], float)
        Rp, tp = self.frames[parent] if parent else (np.eye(3), np.zeros(3))
        rs = radius if isinstance(radius, (list, tuple)) else [radius] * len(pts)
        rings = []
        for p, r in zip(pts, rs):
            rr = r if isinstance(r, (list, tuple)) else (r, r)
            rings.append({"at": _r(Rp.T @ (np.array(p, float) - at)), "size": _r([rr[0] * 2, rr[1] * 2])})
        sides = smooth_sides(sides) if round <= 2.5 else sides
        d = self._add(id, parent, "loft", at, None, rings=rings, profile={"sides": sides, "round": round},
                      subdiv=subdiv, caps=list(caps), style=style, **kw)
        if up is not None:
            d["up"] = up
        return d

    def ball(self, id, r, centre, style, parent=None, sides=10, rings=6, squash=(1, 1, 1), rot=None, **kw):
        """A low-poly sphere (a lathe with a circular profile); squash = (sx, sy, sz)."""
        sx, sy, sz = squash
        prof = []
        sides, rings = smooth_sides(sides), max(rings, int(round(rings * 1.35)))
        for i in range(rings + 1):
            a = -math.pi / 2 + math.pi * i / rings
            prof.append((math.cos(a) * r, (math.sin(a) + 1) * r * sy))
        Rp = self.frames[parent][0] if parent else np.eye(3)
        Rw = Rp @ _rot(rot or (0, 0, 0))
        at = np.array(centre, float) - Rw @ np.array([0, r * sy, 0])
        ringsd = [{"at": [0, y, 0], "size": _r([max(rr, 0) * 2 * sx, max(rr, 0) * 2 * sz])} for rr, y in prof]
        return self._add(id, parent, "loft", at, rot, rings=ringsd, profile={"sides": sides, "round": 2.0},
                         subdiv=0, caps=[False, False], style=style, up=[0, 0, 1], **kw)

    def cyl(self, id, r, h, base, style, parent=None, sides=10, rot=None, caps=(False, True), r2=None, **kw):
        """A straight (or tapered, r2) cylinder standing on `base` (rotate it with rot about the base)."""
        return self.lathe(id, [(r, 0), (r2 if r2 is not None else r, h)], base, style, parent=parent, sides=sides,
                          rot=rot, caps=caps, subdiv=0, **kw)

    def card(self, id, art, centre, style, parent=None, rot=None, plane="xy", pivot=None, key=None, native=False, **kw):
        """A cut-out card. Art drawn at the item's base density is scaled up by HD (same size, painted edges kept);
        native=True means the art was drawn at the final (HD) density already."""
        if not native and HD != 1:
            k = HD
            rows, cols = len(art), len(art[0])
            R, Cc = max(1, round(rows * k)), max(1, round(cols * k))
            art = ["".join(art[min(rows - 1, int(y / k))][min(cols - 1, int(x / k))] for x in range(Cc)) for y in range(R)]
        at = pivot if pivot is not None else centre
        d = self._add(id, parent, "card", at, rot, centre=centre, art=art, plane=plane, style=style, **kw)
        if key:
            d.setdefault("paint", {})["art_key"] = key
        return d

    def pcard(self, id, w, h, fn, key, centre, style=None, parent=None, rot=None, plane="xy", pivot=None, dens=None, **kw):
        """A card of w x h px whose pixel art comes from fn(x, y, cols, rows) -> char ('.' clear), y = 0 top row."""
        d = dens or self.density * HD
        cols, rows = max(2, round(w * d)), max(2, round(h * d))
        a = [''.join(fn(x, y, cols, rows) for x in range(cols)) for y in range(rows)]
        st = style or {"ramp": next(iter(key.values())).split(':')[0], "tone": 4, "light": 0.6, "brush": {"off": True},
                       "rim": {"light": 0, "dark": 0}}
        return self.card(id, a, centre, st, parent=parent, rot=rot, plane=plane, pivot=pivot, key=key, native=True, **kw)

    def paint(self, id, **kw):
        """Per-part paint overrides (layers append, stamps append)."""
        for p in self.parts:
            if p["id"] == id:
                pp = p.setdefault("paint", {})
                for k, v in kw.items():
                    if k in ("layers", "stamps"):
                        pp[k] = pp.get(k, []) + list(v)
                    else:
                        pp[k] = v
                return p
        raise KeyError(id)

    # animation ------------------------------------------------------------
    def anim(self, name, length, tracks, loop=True):
        self.anims[name] = {"length": length, "loop": loop, "tracks": tracks}

    # output ---------------------------------------------------------------
    def spec(self):
        used = set()

        def scan(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k in ("ramp", "dip") and isinstance(v, str):
                        used.add(v)
                    elif k == "shadow_ramp" and isinstance(v, str):
                        used.add(v)
                    elif k == "ramps" and isinstance(v, list):
                        used.update(v)
                    elif k in ("key", "art_key") and isinstance(v, dict):
                        for c in v.values():
                            if isinstance(c, str) and ':' in c:
                                used.add(c.split(':')[0])
                    else:
                        scan(v)
            elif isinstance(o, list):
                for v in o:
                    scan(v)
        scan(self.styles)
        scan(self.parts)
        ramps = {k: RAMPS[k] for k in sorted(used) if k in RAMPS}
        missing = [k for k in used if k not in RAMPS]
        assert not missing, f"{self.id}: unknown ramps {missing}"
        sp = {
            "name": self.id,
            "description": self.desc or self.name,
            "author": "Hoot Hollow (furnC lowpix kit)", "license": "CC0-1.0",
            "density": round(self.density * HD, 3),
            "budget": {"tris": self.tris, "colors": 220},
            "light": self.light,
            "brush": self.brush,
            "material": {"unlit": False, "roughness": 0.9},
            "grounded": not self.wall,
            "render": {"background": "#27313f", "hero": [34, 24], "shadow": 0.4},
            "palette": {"ramps": ramps},
            "styles": self.styles,
            "parts": self.parts,
        }
        if self.anims:
            sp["animations"] = self.anims
        return sp

    def save(self, path):
        with open(path, "w") as fh:
            json.dump(self.spec(), fh, indent=1)


# ------------------------------------------------------------------ GLB finish (units, materials, merging)


def _read_glb(data):
    magic, ver, total = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67
    off = 12
    js = bn = None
    while off < total:
        ln, typ = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + ln]
        if typ == 0x4E4F534A:
            js = json.loads(chunk)
        elif typ == 0x004E4942:
            bn = chunk
        off += 8 + ln
    return js, bn


_CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
_NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def _acc(js, bn, i):
    a = js["accessors"][i]
    bv = js["bufferViews"][a["bufferView"]]
    dt = _CT[a["componentType"]]
    n = _NC[a["type"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    arr = np.frombuffer(bn, dtype=dt, count=a["count"] * n, offset=start)
    return arr.reshape(a["count"], n) if n > 1 else arr.copy()


def _q2m(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def _m2q(M):
    t = np.trace(M)
    if t > 0:
        s = math.sqrt(t + 1.0) * 2
        w, x, y, z = 0.25 * s, (M[2, 1] - M[1, 2]) / s, (M[0, 2] - M[2, 0]) / s, (M[1, 0] - M[0, 1]) / s
    elif M[0, 0] > M[1, 1] and M[0, 0] > M[2, 2]:
        s = math.sqrt(1.0 + M[0, 0] - M[1, 1] - M[2, 2]) * 2
        w, x, y, z = (M[2, 1] - M[1, 2]) / s, 0.25 * s, (M[0, 1] + M[1, 0]) / s, (M[0, 2] + M[2, 0]) / s
    elif M[1, 1] > M[2, 2]:
        s = math.sqrt(1.0 + M[1, 1] - M[0, 0] - M[2, 2]) * 2
        w, x, y, z = (M[0, 2] - M[2, 0]) / s, (M[0, 1] + M[1, 0]) / s, 0.25 * s, (M[1, 2] + M[2, 1]) / s
    else:
        s = math.sqrt(1.0 + M[2, 2] - M[0, 0] - M[1, 1]) * 2
        w, x, y, z = (M[1, 0] - M[0, 1]) / s, (M[0, 2] + M[2, 0]) / s, (M[1, 2] + M[2, 1]) / s, 0.25 * s
    q = np.array([x, y, z, w])
    return q / np.linalg.norm(q)


def _local(node):
    M = np.eye(4)
    if "matrix" in node:
        return np.array(node["matrix"]).reshape(4, 4).T
    S = np.diag(list(node.get("scale", [1, 1, 1])) + [1])
    R = np.eye(4)
    R[:3, :3] = _q2m(node.get("rotation", [0, 0, 0, 1]))
    T = np.eye(4)
    T[:3, 3] = node.get("translation", [0, 0, 0])
    M = T @ R @ S
    return M


MATS = {
    # prefix: (name, overrides)
    "glow_": ("glow", {"extensions": {"KHR_materials_unlit": {}}}),
    "glass_": ("glass", {"alphaMode": "BLEND"}),
    "water_": ("water", {"alphaMode": "BLEND"}),
}


def finish_glb(src_bytes, scale=1 / 16, png=None):
    """lowpix GLB -> game GLB (see module doc). Returns bytes."""
    js, bn = _read_glb(src_bytes)
    nodes = js["nodes"]
    n = len(nodes)
    parent = [-1] * n
    for i, nd in enumerate(nodes):
        for c in nd.get("children", []):
            parent[c] = i
    world = [None] * n

    def W(i):
        if world[i] is None:
            world[i] = (W(parent[i]) if parent[i] >= 0 else np.eye(4)) @ _local(nodes[i])
        return world[i]

    targeted = set()
    for an in js.get("animations", []):
        for ch in an["channels"]:
            targeted.add(ch["target"]["node"])
    animated = set()
    for i in range(n):
        j = i
        while j >= 0:
            if j in targeted:
                animated.add(i)
                break
            j = parent[j]

    # material classes
    base_mats = js["materials"]
    solid_mat = next((m for m in base_mats if m["name"] == "pixel_solid"), base_mats[0])
    card_mat = next((m for m in base_mats if m["name"] == "pixel_card"), solid_mat)

    def mat_key(node_name, src_mat_idx):
        double = base_mats[src_mat_idx].get("doubleSided", False)
        for pre, (nm, _) in MATS.items():
            if node_name.startswith(pre) or ("_" + pre) in node_name:
                return nm + ("_ds" if double else "")
        return "card" if double else "solid"

    def make_mat(key):
        ds = key.endswith("_ds") or key == "card"
        basek = key[:-3] if key.endswith("_ds") else key
        m = json.loads(json.dumps(card_mat if ds else solid_mat))
        m.pop("extensions", None)
        m["name"] = key
        m["doubleSided"] = ds
        m["pbrMetallicRoughness"]["roughnessFactor"] = 0.9
        for pre, (nm, ov) in MATS.items():
            if nm == basek:
                for k, v in ov.items():
                    if k == "baseColorFactor":
                        m["pbrMetallicRoughness"]["baseColorFactor"] = v
                    else:
                        m[k] = v
                if nm in ("glass", "water"):
                    m.pop("alphaCutoff", None)
        return m

    # gather geometry
    static = {}   # key -> lists
    anim_prims = {}  # node -> [(key, P, N, UV, I)]
    see_through = []  # (kind, UV, I) for glass / water texels
    for i, nd in enumerate(nodes):
        if "mesh" not in nd:
            continue
        for pr in js["meshes"][nd["mesh"]]["primitives"]:
            Pp = _acc(js, bn, pr["attributes"]["POSITION"]).astype(np.float64)
            Nn = _acc(js, bn, pr["attributes"]["NORMAL"]).astype(np.float64)
            UV = _acc(js, bn, pr["attributes"]["TEXCOORD_0"]).astype(np.float32)
            I = _acc(js, bn, pr["indices"]).astype(np.uint32)
            key = mat_key(nd.get("name", ""), pr.get("material", 0))
            if key.startswith(("glass", "water")):
                see_through.append((key.split("_")[0], UV, I))
            if i in animated:
                anim_prims.setdefault(i, []).append((key, Pp, Nn, UV, I))
            else:
                M = W(i)
                Pw = Pp @ M[:3, :3].T + M[:3, 3]
                Nw = Nn @ M[:3, :3].T
                Nw /= np.maximum(np.linalg.norm(Nw, axis=1, keepdims=True), 1e-9)
                s = static.setdefault(key, [[], [], [], [], 0])
                s[0].append(Pw)
                s[1].append(Nw)
                s[2].append(UV)
                s[3].append(I + s[4])
                s[4] += len(Pw)

    # ---- write a fresh glTF
    out = {"asset": {"version": "2.0", "generator": "lowpix + hoot hollow furnC finish"}, "scene": 0,
           "scenes": [{"name": js["scenes"][0].get("name", "item"), "nodes": [0]}],
           "nodes": [], "meshes": [], "materials": [], "accessors": [], "bufferViews": [],
           "textures": [{"sampler": 0, "extensions": {"EXT_texture_webp": {"source": 0}}}],
           "samplers": js["samplers"], "images": []}
    blob = bytearray()

    def view(data, target=None):
        while len(blob) % 4:
            blob.append(0)
        bv = {"buffer": 0, "byteOffset": len(blob), "byteLength": len(data)}
        if target:
            bv["target"] = target
        out["bufferViews"].append(bv)
        blob.extend(data)
        return len(out["bufferViews"]) - 1

    def acc(arr, kind, ctype, target=None, minmax=False):
        v = view(np.ascontiguousarray(arr).tobytes(), target)
        a = {"bufferView": v, "componentType": ctype, "count": int(arr.shape[0]), "type": kind}
        if minmax:
            a["min"] = [float(x) for x in arr.min(axis=0)]
            a["max"] = [float(x) for x in arr.max(axis=0)]
        out["accessors"].append(a)
        return len(out["accessors"]) - 1

    mat_ids = {}

    def mid(key):
        if key not in mat_ids:
            out["materials"].append(make_mat(key))
            mat_ids[key] = len(out["materials"]) - 1
        return mat_ids[key]

    def qacc(arr, kind, ctype, stride):
        """A quantized, normalized vertex attribute (KHR_mesh_quantization)."""
        v = view(np.ascontiguousarray(arr).tobytes(), 34962)
        out["bufferViews"][v]["byteStride"] = stride
        a = {"bufferView": v, "componentType": ctype, "count": int(arr.shape[0]), "type": kind, "normalized": True}
        out["accessors"].append(a)
        return len(out["accessors"]) - 1

    def prim(key, Pp, Nn, UV, I):
        pa = acc(Pp.astype(np.float32), "VEC3", 5126, 34962, True)
        n4 = np.zeros((len(Nn), 4), np.int8)
        n4[:, :3] = np.clip(np.round(Nn * 127), -127, 127).astype(np.int8)
        na = qacc(n4, "VEC3", 5120, 4)
        ta = qacc(np.clip(np.round(UV * 65535), 0, 65535).astype(np.uint16), "VEC2", 5123, 4)
        idx = I.reshape(-1)
        ia = acc(idx.astype(np.uint16) if Pp.shape[0] < 65536 else idx.astype(np.uint32), "SCALAR",
                 5123 if Pp.shape[0] < 65536 else 5125, 34963)
        return {"attributes": {"POSITION": pa, "NORMAL": na, "TEXCOORD_0": ta}, "indices": ia, "material": mid(key)}

    root = {"name": "item", "scale": [scale] * 3, "children": []}
    out["nodes"].append(root)
    order = ["solid", "card", "glow", "glow_ds", "water", "water_ds", "glass", "glass_ds"]
    keys = sorted(static, key=lambda k: order.index(k) if k in order else 99)
    if static:
        prims = [prim(k, np.concatenate(static[k][0]), np.concatenate(static[k][1]), np.concatenate(static[k][2]),
                      np.concatenate(static[k][3])) for k in keys]
        out["meshes"].append({"name": "static", "primitives": prims})
        out["nodes"].append({"name": "static", "mesh": len(out["meshes"]) - 1})
        root["children"].append(len(out["nodes"]) - 1)

    # animated subtrees: keep joints; a wrapper carries the (static) parent's world transform
    remap = {}
    # rest pose = the first frame of the idle clip, so a still (unanimated) copy looks like the moving one
    first = {}
    anl = js.get("animations", [])
    idle = next((a for a in anl if a.get("name") == "idle"), anl[0] if anl else None)
    if idle:
        for ch in idle["channels"]:
            smp = idle["samplers"][ch["sampler"]]
            v = _acc(js, bn, smp["output"])
            first.setdefault(ch["target"]["node"], {})[ch["target"]["path"]] = [float(x) for x in np.atleast_2d(v)[0]]

    def copy_node(i):
        nd = nodes[i]
        new = {"name": nd.get("name", f"n{i}")}
        for k in ("translation", "rotation", "scale"):
            if k in nd:
                new[k] = nd[k]
        for k, v in first.get(i, {}).items():
            new[k] = v
        out["nodes"].append(new)
        ni = len(out["nodes"]) - 1
        remap[i] = ni
        if i in anim_prims:
            prs = [prim(*p) for p in anim_prims[i]]
            out["meshes"].append({"name": new["name"], "primitives": prs})
            new["mesh"] = len(out["meshes"]) - 1
        kids = [copy_node(c) for c in nd.get("children", []) if c in animated]
        if kids:
            new["children"] = kids
        return ni

    for i in range(n):
        if i in animated and (parent[i] < 0 or parent[i] not in animated):
            ni = copy_node(i)
            if parent[i] >= 0:
                M = W(parent[i])
                wrap = {"name": nodes[i].get("name", "") + "_frame", "children": [ni]}
                if np.abs(M[:3, 3]).max() > 1e-9:
                    wrap["translation"] = [float(x) for x in M[:3, 3]]
                q = _m2q(M[:3, :3])
                if abs(q[3] - 1) > 1e-9:
                    wrap["rotation"] = [float(x) for x in q]
                out["nodes"].append(wrap)
                root["children"].append(len(out["nodes"]) - 1)
            else:
                root["children"].append(ni)

    # animations (copy samplers, retarget nodes)
    anims = []
    for an in js.get("animations", []):
        samplers, chans = [], []
        cache = {}
        for ch in an["channels"]:
            s = an["samplers"][ch["sampler"]]
            if ch["target"]["node"] not in remap:
                continue
            ti = s["input"]
            if ti not in cache:
                tarr = _acc(js, bn, ti).astype(np.float32).reshape(-1, 1)
                cache[ti] = acc(tarr, "SCALAR", 5126, None, True)
            o = _acc(js, bn, s["output"]).astype(np.float32)
            kind = js["accessors"][s["output"]]["type"]
            oa = acc(o, kind, 5126)
            samplers.append({"input": cache[ti], "output": oa, "interpolation": s.get("interpolation", "LINEAR")})
            chans.append({"sampler": len(samplers) - 1, "target": {"node": remap[ch["target"]["node"]],
                                                                    "path": ch["target"]["path"]}})
        if chans:
            anims.append({"name": an["name"], "samplers": samplers, "channels": chans})
    if anims:
        out["animations"] = anims

    # the atlas
    img = js["images"][0]
    bvi = js["bufferViews"][img["bufferView"]]
    img_bytes = bytes(bn[bvi.get("byteOffset", 0): bvi.get("byteOffset", 0) + bvi["byteLength"]])
    if see_through:
        img_bytes = _see_through_alpha(img_bytes, see_through)
    if png:
        img_bytes = png(img_bytes)
    out["images"] = [{"bufferView": view(img_bytes), "mimeType": "image/webp", "name": "atlas"}]
    out["extensionsUsed"] = ["KHR_mesh_quantization", "EXT_texture_webp"]
    out["extensionsRequired"] = ["KHR_mesh_quantization", "EXT_texture_webp"]
    if any("KHR_materials_unlit" in (m.get("extensions") or {}) for m in out["materials"]):
        out["extensionsUsed"].append("KHR_materials_unlit")
    while len(blob) % 4:
        blob.append(0)
    out["buffers"] = [{"byteLength": len(blob)}]
    jsb = json.dumps(out, separators=(",", ":")).encode()
    jsb += b" " * ((-len(jsb)) % 4)
    total = 12 + 8 + len(jsb) + 8 + len(blob)
    return (struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(jsb), 0x4E4F534A) + jsb
            + struct.pack("<II", len(blob), 0x004E4942) + bytes(blob))


def _see_through_alpha(png_bytes, regions):
    """Glass and water are painted into the atlas opaque; give their texels real alpha: clear glass with
    opaque painted glints (the brightest tones), translucent water."""
    import io
    from PIL import Image
    im = np.array(Image.open(io.BytesIO(png_bytes)).convert("RGBA"))
    H, W = im.shape[:2]
    for kind, UV, I in regions:
        mask = np.zeros((H, W), bool)
        uv = UV * [W, H]
        for tri in I.reshape(-1, 3):
            a, b, c = uv[tri]
            x0, x1 = int(max(0, math.floor(min(a[0], b[0], c[0])))), int(min(W - 1, math.ceil(max(a[0], b[0], c[0]))))
            y0, y1 = int(max(0, math.floor(min(a[1], b[1], c[1])))), int(min(H - 1, math.ceil(max(a[1], b[1], c[1]))))
            if x1 < x0 or y1 < y0:
                continue
            ys, xs = np.mgrid[y0:y1 + 1, x0:x1 + 1]
            px, py = xs + 0.5, ys + 0.5
            d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(d) < 1e-12:
                continue
            l1 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / d
            l2 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / d
            l3 = 1 - l1 - l2
            e = -0.02
            inside = (l1 >= e) & (l2 >= e) & (l3 >= e)
            mask[ys[inside], xs[inside]] = True
        mask &= im[..., 3] > 127
        if not mask.any():
            continue
        lum = im[..., :3].astype(np.float32) @ np.array([0.3, 0.55, 0.15], np.float32)
        if kind == "glass":
            hi = np.percentile(lum[mask], 93)
            alpha = np.where(lum >= hi, 225, 34)
        else:
            alpha = np.where(lum >= np.percentile(lum[mask], 96), 200, 135)
        im[..., 3] = np.where(mask, alpha, im[..., 3]).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(im, "RGBA").save(buf, "PNG")
    return buf.getvalue()


# ------------------------------------------------------------------ small geometry helpers

def circle(c, r, n=12, plane="xy", a0=0.0, a1=360.0, closed=True):
    """Points on a circle (or arc) round centre c in a plane: xy (faces +z), xz (lies flat) or yz."""
    out = []
    m = n + (0 if closed and abs(a1 - a0 - 360) < 1e-6 else 1)
    for i in range(m):
        a = math.radians(a0 + (a1 - a0) * i / n)
        u, v = math.cos(a) * r, math.sin(a) * r
        if plane == "xy":
            out.append((c[0] + u, c[1] + v, c[2]))
        elif plane == "xz":
            out.append((c[0] + u, c[1], c[2] + v))
        else:
            out.append((c[0], c[1] + v, c[2] + u))
    if closed and abs(a1 - a0 - 360) < 1e-6:
        out.append(out[0])
        out.append(out[1])
    return out


def bezier(p0, p1, p2, n=8, p3=None):
    """Quadratic (or cubic with p3) curve points."""
    out = []
    for i in range(n + 1):
        t = i / n
        if p3 is None:
            q = [(1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * c for a, b, c in zip(p0, p1, p2)]
        else:
            q = [(1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t * t * c + t ** 3 * d
                 for a, b, c, d in zip(p0, p1, p2, p3)]
        out.append(tuple(q))
    return out


def rotz(p, about, deg):
    """Rotate a point about the z axis through `about` (for tilted assemblies given in world coordinates)."""
    a = math.radians(deg)
    x, y = p[0] - about[0], p[1] - about[1]
    return (about[0] + x * math.cos(a) - y * math.sin(a), about[1] + x * math.sin(a) + y * math.cos(a), p[2])


def cycle_keys(life, T, o):
    """Keys for a looping life cycle [(u, value), ...] over 0..T (first and last value equal), started at offset o."""
    o = o % T

    def lerp(a, b, t):
        if isinstance(a, (list, tuple)):
            return [x + (y - x) * t for x, y in zip(a, b)]
        return a + (b - a) * t

    def at(u):
        for (u0, v0), (u1, v1) in zip(life, life[1:]):
            if u0 <= u <= u1:
                return lerp(v0, v1, 0 if u1 == u0 else (u - u0) / (u1 - u0))
        return life[-1][1]
    if o == 0:
        return [[round(u, 4), v] for u, v in life]
    seam = at(T - o)
    inner = sorted(((u + o) % T, v) for u, v in life[:-1] if 0 < (u + o) % T < T)
    keys = [[0.0, seam]]
    for t, v in inner:
        if t - keys[-1][0] > 1e-3:
            keys.append([round(t, 4), v])
    keys.append([float(T), seam])
    return keys


def hsh(*a):
    """Stable hash of ints/floats to [0, 1)."""
    h = 2166136261
    for v in a:
        h ^= int(v * 7919) & 0xffffffff
        h = (h * 16777619) & 0xffffffff
    h ^= h >> 13
    h = (h * 1274126177) & 0xffffffff
    return (h & 0xffffff) / float(0x1000000)
