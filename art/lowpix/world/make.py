"""[world3] Hoot Hollow's forest kit as lowpix specs: trees (trunk, roots, limbs, twigs and low-poly leaf
masses), bushes, stumps, logs, rocks and mushrooms, all in the calm "Moss & Moonlight" palette with
dense painted bark, moss and lichen.

    python3 art/lowpix/world/make.py          # writes art/lowpix/world/specs/*.json + src/assets/nature/shapes.json
    bash art/lowpix/world/build.sh            # builds every spec and copies the GLBs to public/models/world/

Units: 16 model units = 1 world block (the game scales by 1/16). Leaf masses are parts named
`crown_*`: the game recolours them with the seasons and scatters its 2D pixel leaf cards over the
ellipsoids listed in shapes.json, so those must match the crown parts here (they come from the same
numbers). Parts named `glow_*` render unlit at night (moonglow caps).
"""
import json
import math
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SPECS = os.path.join(HERE, 'specs')

# ------------------------------------------------------------------ palette (src/gfx/palette.ts)
# ramps run darkest -> lightest; shadows lean slate, highlights lean lamp-gold
RAMPS = {
    'bark': ['#1d1b20', '#2a2527', '#372e2b', '#45392f', '#544436', '#66523f', '#7c654c', '#94795b', '#ad9473'],
    'barkcool': ['#1c1d22', '#28272b', '#353131', '#433b36', '#524840', '#63574b', '#776a5a', '#8e806c'],
    'birch': ['#26262a', '#3f3c38', '#6c665b', '#958e7e', '#b9b19e', '#d4ccb8', '#e6dfcd', '#f3eedf'],
    'heart': ['#4a3628', '#6f553d', '#8f6f4c', '#ad8a60', '#c4a379', '#d8bf98', '#e7d4b0'],
    'moss': ['#18221d', '#22302a', '#2c4030', '#3a5236', '#4b6640', '#5f7a4a', '#768f57', '#8fa66a', '#aab984'],
    'lichen': ['#5c6658', '#7b8673', '#9aa48e', '#b7bfa6', '#ced4bd', '#e0e4d0'],
    'leaf': ['#141d19', '#1b2a22', '#24372a', '#2f4631', '#3c5636', '#4b673c', '#5c7845', '#718a52', '#8ba066', '#a6b57f'],
    'leafbright': ['#1a2620', '#24362a', '#304831', '#3f5a37', '#50703f', '#638248', '#789455', '#91a865', '#acbd80'],
    'birchleaf': ['#1d2a20', '#2a3b28', '#3a4f30', '#4d6438', '#627a42', '#7a904e', '#94a660', '#afbb78', '#c8cf96'],
    'pine': ['#111b1a', '#172522', '#1f312b', '#283e33', '#334c3b', '#405b44', '#4f6b4d', '#627c5a', '#7a8f6b'],
    'copper': ['#1f1a1d', '#2f2226', '#43292b', '#5a3330', '#723f36', '#8c4f3f', '#a6644d', '#bd7d62', '#d29b7e'],
    'blossom': ['#3a2a30', '#5a3c44', '#7c5059', '#9c6870', '#ba8489', '#d1a0a2', '#e2bab8', '#efd2cd', '#f8e8e2'],
    'stone': ['#232428', '#2f3034', '#3d3d3e', '#4d4c4a', '#5e5c57', '#716d66', '#858076', '#9a9486', '#afa999', '#c6bfae'],
    'cap': ['#2a1d20', '#3f2628', '#58322f', '#704036', '#8a5140', '#a3654f', '#bb7c62', '#cf977b', '#e0b296'],
    'cream': ['#4b463a', '#77705f', '#a39a84', '#c4b99f', '#dccfb0', '#eae0c8', '#f4eedd'],
    'bolete': ['#22191a', '#33241f', '#493226', '#5e4130', '#75523b', '#8d6648', '#a57c59', '#bb946c'],
    'gills': ['#5e4f3c', '#86735a', '#a99577', '#c8b591', '#dfcfaa', '#eee2c4'],
    'chanter': ['#3b2a1c', '#5a3f24', '#7b5730', '#9b723d', '#b98d4d', '#cfa660', '#dfbe7b', '#ecd49b'],
    'moonglow': ['#2c3240', '#3e4659', '#56607a', '#727c99', '#929bb6', '#b3b9cf', '#d0d5e2', '#e8ebf2'],
    'twig': ['#1c1a1d', '#2b2526', '#3b3230', '#4c413a', '#5f5247', '#746656'],
}

LIGHT = {'dir': [-0.55, 1.0, 0.6], 'strength': 0.55, 'gradient': 0.35, 'ao': 0.75, 'ao_height': 3.0}
BRUSH = {'length': 2.4, 'rough': 0.65, 'width': 0.7, 'overshoot': 0.35, 'flow': 'vertical',
         'textures': {'bark': 'wood', 'barkcool': 'wood', 'birch': 'wood', 'moss': 'moss', 'lichen': 'moss', 'leaf': 'organic',
                      'leafbright': 'organic', 'birchleaf': 'organic', 'pine': 'fur', 'copper': 'organic', 'blossom': 'organic',
                      'stone': 'stone', 'cap': 'organic', 'bolete': 'organic', 'chanter': 'organic', 'heart': 'wood', 'twig': 'wood'}}

MOSS_DRIP = {'id': 'moss', 'op': 'drip', 'ramp': 'moss', 'tone': 5.2, 'depth': 1.6, 'length': 4.5, 'width': 0.5, 'scale': 2.6,
             'bevel': {'shadow': 1, 'highlight': 1, 'shadow_shift': -1.6, 'highlight_shift': 1.0}}


def bark_style(ramp='bark', tone=4.4, furrow=2.6, moss=True, lichen=True, photo=True):
    layers = [
        {'id': 'furrows', 'op': 'stripes', 'axis': 'around', 'period': 0.09, 'width': 0.32, 'wobble': 0.55, 'shift': -1.6, 'faces': ['all']},
        {'id': 'ridges', 'op': 'noise', 'scale': furrow, 'amount': 0.55},
        {'id': 'cracks', 'op': 'cracks', 'scale': 4.0, 'width': 0.6, 'threshold': 0.7, 'shift': -1.5, 'bevel': True},
    ]
    if photo:
        layers.append({'id': 'photo', 'op': 'photo', 'src': 'assets/photos/bark_brown_02', 'scale': 22.0, 'amount': 0.9, 'ramps': [ramp]})
    if lichen:
        layers.append({'id': 'lichen', 'op': 'spots', 'ramp': 'lichen', 'tone': 1.8, 'count': 6, 'radius': [0.5, 1.1], 'roughness': 0.7,
                       'bevel': {'shadow': 1, 'highlight': 0, 'shadow_shift': -1.4}, 'min_gap': 2.0})
    if moss:
        layers.append({'id': 'mossp', 'op': 'patches', 'ramp': 'moss', 'tone': 4.4, 'scale': 2.4, 'threshold': 0.64, 'faces': ['up', 'level'],
                       'bevel': {'shadow': 1, 'highlight': 1, 'shadow_shift': -1.4, 'highlight_shift': 1.0}})
    return {'ramp': ramp, 'tone': tone, 'dither': 0.0, 'rim': {'light': 0, 'dark': 0, 'outline': 'none'},
            'brush': {'flow': 'path', 'rough': 0.7, 'length': 3.0}, 'layers': layers}


def crown_style(ramp, tone=5.0):
    return {'ramp': ramp, 'tone': tone, 'dither': 0.0, 'light': 1.15, 'rim': {'light': 0, 'dark': 0, 'outline': 'none'},
            'brush': {'flow': 'vertical', 'rough': 0.8, 'length': 2.0},
            'layers': [
                {'id': 'clumps', 'op': 'scales', 'along': 'x', 'size': [5.2, 3.6], 'gradient': 1.8, 'rim': 1.2, 'shadow': -2.2, 'jitter': 0.9,
                 'highlight': 1.1},
                {'id': 'leafy', 'op': 'photo', 'src': 'assets/photos/forest_leaves_02', 'scale': 10.0, 'amount': 0.45, 'ramps': [ramp]},
                {'id': 'deep', 'op': 'patches', 'scale': 2.2, 'threshold': 0.6, 'shift': -1.4},
                {'id': 'sun', 'op': 'patches', 'scale': 1.6, 'threshold': 0.7, 'shift': 1.2, 'min_light': 0.35, 'post': True},
            ]}


SPEC_STYLES = {
    'bark': bark_style(),
    'barkpine': bark_style('barkcool', 4.0, 3.2, moss=False),
    'birch': {'ramp': 'birch', 'tone': 5.2, 'dither': 0.0, 'rim': {'light': 0, 'dark': 0, 'outline': 'none'},
              'brush': {'flow': 'path', 'rough': 0.55, 'length': 2.0},
              'layers': [
                  {'id': 'grain', 'op': 'noise', 'scale': 3.0, 'amount': 0.35},
                  {'id': 'lenticels', 'op': 'spots', 'ramp': 'birch', 'tone': 1.2, 'count': 46, 'radius': [0.5, 1.0], 'stretch': [2.6, 0.35, 2.6],
                   'roughness': 0.4, 'min_gap': 1.2},
                  {'id': 'scars', 'op': 'spots', 'ramp': 'birch', 'tone': 0.6, 'count': 6, 'radius': [1.0, 1.8], 'stretch': [1.2, 0.7, 1.2],
                   'roughness': 0.7, 'bevel': {'shadow': 0, 'highlight': 1, 'highlight_shift': 1.2}},
                  {'id': 'base', 'op': 'band', 'axis': 'y', 'from': -1.0, 'to': -0.72, 'ramp': 'barkcool', 'tone': 3.0, 'wobble': 0.35},
                  {'id': 'lichen', 'op': 'spots', 'ramp': 'lichen', 'tone': 2.6, 'count': 4, 'radius': [0.8, 1.4], 'roughness': 0.6},
              ]},
    'twig': {'ramp': 'twig', 'tone': 3.2, 'dither': 0.0, 'rim': {'light': 0, 'dark': 0, 'outline': 'none'}, 'brush': {'flow': 'path'},
             'layers': [{'id': 'grain', 'op': 'noise', 'scale': 2.0, 'amount': 0.4}]},
    'heart': {'ramp': 'heart', 'tone': 3.6, 'rim': {'light': 1, 'dark': 1, 'outline': 'none'}, 'brush': {'flow': 'horizontal'},
              'layers': [{'id': 'grain', 'op': 'noise', 'scale': 2.0, 'amount': 0.4}]},
    'stone': {'ramp': 'stone', 'tone': 5.6, 'dither': 0.0, 'light': 1.2, 'rim': {'light': 1, 'dark': 1, 'outline': 'none', 'light_shift': 0.8, 'dark_shift': -0.8},
              'brush': {'flow': 'horizontal', 'rough': 0.6},
              'layers': [
                  {'id': 'photo', 'op': 'photo', 'src': 'assets/photos/rock_face_03', 'scale': 16.0, 'amount': 1.1, 'ramps': ['stone']},
                  {'id': 'mottle', 'op': 'noise', 'scale': 3.0, 'amount': 0.5},
                  {'id': 'cracks', 'op': 'cracks', 'scale': 3.0, 'width': 0.5, 'threshold': 0.72, 'shift': -1.8, 'bevel': True},
                  {'id': 'lichen', 'op': 'spots', 'ramp': 'lichen', 'tone': 3.0, 'count': 9, 'radius': [0.7, 1.8], 'roughness': 0.7,
                   'bevel': {'shadow': 1, 'highlight': 0, 'shadow_shift': -1.2}, 'min_gap': 1.5},
                  dict(MOSS_DRIP, depth=0.7, length=2.0, scale=3.2),
                  {'id': 'mossp', 'op': 'patches', 'ramp': 'moss', 'tone': 4.6, 'scale': 2.0, 'threshold': 0.66, 'faces': ['up'],
                   'bevel': {'shadow': 1, 'highlight': 1, 'shadow_shift': -1.4, 'highlight_shift': 1.0}},
              ]},
    'cap': {'ramp': 'cap', 'tone': 5.4, 'light': 1.2, 'rim': {'light': 1, 'dark': 1, 'outline': 'none'}, 'brush': {'flow': 'path', 'rough': 0.5},
            'layers': [
                {'id': 'mottle', 'op': 'noise', 'scale': 1.6, 'amount': 0.4},
                {'id': 'dots', 'op': 'spots', 'ramp': 'cream', 'tone': 5.0, 'count': 7, 'radius': [0.5, 0.9], 'roughness': 0.4, 'faces': ['-start'],
                 'bevel': {'shadow': 1, 'highlight': 0, 'shadow_shift': -1.6}, 'min_gap': 1.0},
                {'id': 'gills', 'op': 'stripes', 'axis': 'around', 'period': 0.06, 'width': 0.4, 'ramp': 'gills', 'tone': 2.0, 'faces': ['start']},
                {'id': 'gloss', 'op': 'gloss', 'post': True, 'dash': True, 'length': 2, 'density': 0.25, 'shift': 1.2, 'ramps': ['cap']},
            ]},
    'stem': {'ramp': 'cream', 'tone': 4.4, 'rim': {'light': 0, 'dark': 0, 'outline': 'none'}, 'brush': {'flow': 'path'},
             'layers': [{'id': 'fibres', 'op': 'stripes', 'axis': 'around', 'period': 0.2, 'width': 0.25, 'shift': -0.8},
                        {'id': 'base', 'op': 'band', 'axis': 'y', 'from': -1.0, 'to': -0.5, 'shift': -1.0, 'wobble': 0.2}]},
}


class Kit:
    """Collects parts for one model."""

    def __init__(self, name, seed):
        self.name = name
        self.parts = []
        self.blobs = []
        self.r = random.Random(seed)
        self.n = 0

    def uid(self, base):
        self.n += 1
        return f'{base}_{self.n}'

    def loft(self, base, rings, style, sides=7, rnd=2.2, caps=(False, True), subdiv=1, paint=None, up=None, hard=False):
        p = {'id': self.uid(base), 'shape': 'loft', 'profile': {'sides': sides, 'round': rnd, 'angle': self.r.uniform(0, 40)}, 'subdiv': subdiv,
             'caps': list(caps), 'rings': [{'at': [round(v, 2) for v in a], 'size': round(s, 2) if not isinstance(s, (list, tuple)) else [round(x, 2) for x in s]} for a, s in rings],
             'style': style}
        if up:
            p['up'] = up
        if paint:
            p['paint'] = paint
        if hard:
            p['hard'] = True
        self.parts.append(p)
        return p

    # ---- tree anatomy
    def trunk(self, h, w, lean=1.5, flare=1.55, style='bark', segs=None, sides=8):
        r = self.r
        segs = segs or max(4, int(h / 9))
        rings = [((0, -3, 0), w * flare * 1.05)]
        x = z = 0.0
        pts = [(0.0, -3.0, 0.0)]
        for i in range(1, segs + 1):
            y = h * i / segs
            x += r.uniform(-lean, lean)
            z += r.uniform(-lean, lean)
            k = i / segs
            ww = w * (flare - (flare - 1) * min(1, k * 4)) * (1 - 0.32 * k)
            rings.append(((x, y, z), ww))
            pts.append((x, y, z))
        self.loft('trunk', rings, style, sides=sides, rnd=2.3, caps=(False, True))
        return pts

    def roots(self, w, n=5, reach=1.9, style='bark'):
        r = self.r
        a0 = r.uniform(0, math.tau)
        for i in range(n):
            a = a0 + i / n * math.tau + r.uniform(-0.3, 0.3)
            ca, sa = math.cos(a), math.sin(a)
            L = w * reach * r.uniform(0.85, 1.15)
            rw = w * r.uniform(0.42, 0.52)
            self.loft('root', [((ca * w * 0.15, 9.0, sa * w * 0.15), rw * 1.2), ((ca * w * 0.52, 3.6, sa * w * 0.52), (rw * 1.05, rw * 0.9)),
                               ((ca * L * 0.72, 0.9, sa * L * 0.72), (rw * 0.62, rw * 0.42)), ((ca * L, -0.9, sa * L), (rw * 0.22, rw * 0.16))],
                      style, sides=6, rnd=2.4, caps=(False, True))

    def limb(self, x, y, z, az, pitch, length, w, bend=12, style='bark', twigs=3, sides=6):
        """A branch from a point; returns its tip. pitch/bend in degrees above level."""
        r = self.r
        pts, cur = [(x, y, z)], [x, y, z]
        segs = 3
        for i in range(segs):
            p = math.radians(pitch + bend * i / max(1, segs - 1))
            step = length / segs
            cur = [cur[0] + math.sin(az) * math.cos(p) * step, cur[1] + math.sin(p) * step, cur[2] + math.cos(az) * math.cos(p) * step]
            cur[0] += r.uniform(-1, 1) * step * 0.12
            cur[2] += r.uniform(-1, 1) * step * 0.12
            pts.append(tuple(cur))
        rings = [(pts[i], max(0.9, w * (1 - 0.55 * i / segs))) for i in range(segs + 1)]
        self.loft('limb', rings, style, sides=sides, rnd=2.3, caps=(False, True))
        tip = pts[-1]
        for k in range(twigs):
            a = az + r.uniform(-1.3, 1.3)
            p = math.radians(r.uniform(-10, 55))
            L = r.uniform(5, 10)
            e = (tip[0] + math.sin(a) * math.cos(p) * L, tip[1] + math.sin(p) * L, tip[2] + math.cos(a) * math.cos(p) * L)
            m = ((tip[0] + e[0]) / 2 + r.uniform(-1, 1), (tip[1] + e[1]) / 2 + r.uniform(0, 1.2), (tip[2] + e[2]) / 2 + r.uniform(-1, 1))
            self.loft('twig', [(tip, max(0.9, w * 0.42)), (m, 0.9), (e, 0.45)], 'twig', sides=4, rnd=2.0, caps=(False, True), subdiv=0)
        return tip

    def crown(self, cx, cy, cz, rx, ry, rz, ramp, tone=5.0, lump=0.12, sides=9):
        """A low-poly leaf mass (ellipsoid with lumps) plus its leaf-card ellipsoid."""
        r = self.r
        fr = [(-0.98, 0.18), (-0.72, 0.72), (-0.3, 0.97), (0.15, 1.0), (0.55, 0.84), (0.86, 0.5), (1.0, 0.0)]
        rings = []
        # the solid core sits a little inside the leaf-card shell, so the cards make the silhouette
        core = 0.84
        for ky, ks in fr:
            j = 1 + r.uniform(-lump, lump)
            sx, sz = 2 * rx * ks * j * core, 2 * rz * ks * (1 + r.uniform(-lump, lump)) * core
            rings.append(((cx + r.uniform(-1, 1) * rx * lump * 0.6, cy + ky * ry * core, cz + r.uniform(-1, 1) * rz * lump * 0.6), [max(0.2, sx), max(0.2, sz)]))
        self.loft('crown', rings, f'crown_{ramp}', sides=sides, rnd=2.0, caps=(True, True), subdiv=0, up=[0, 0, 1])
        self.blobs.append({'x': round(cx, 2), 'y': round(cy, 2), 'z': round(cz, 2), 'rx': round(rx, 2), 'ry': round(ry, 2), 'rz': round(rz, 2)})

    def spec(self, extra_styles=None, ramps=None, budget=4000):
        styles = dict(SPEC_STYLES)
        for k in ('leaf', 'leafbright', 'birchleaf', 'pine', 'copper', 'blossom'):
            styles[f'crown_{k}'] = crown_style(k)
        styles['crown_pine']['layers'][0] = {'id': 'clumps', 'op': 'scales', 'along': 'x', 'size': [3.2, 2.0], 'gradient': 1.6, 'rim': 1.0,
                                             'shadow': -2.0, 'jitter': 0.8, 'highlight': 0.9, 'space': 'world'}
        styles['crown_pine']['brush'] = {'flow': 'vertical', 'rough': 0.85, 'length': 2.6}
        if extra_styles:
            styles.update(extra_styles)
        return {
            'name': self.name, 'description': 'Hoot Hollow forest kit (generated by art/lowpix/world/make.py).', 'license': 'CC0-1.0',
            'density': 2, 'budget': {'tris': budget, 'colors': 96}, 'light': LIGHT, 'brush': BRUSH,
            'render': {'background': '#2b3a33', 'hero': [35, 18], 'shadow': 0.4},
            'material': {'unlit': False, 'roughness': 1.0},
            'palette': {'ramps': RAMPS}, 'styles': styles, 'parts': self.parts,
        }


# ------------------------------------------------------------------ trees

def broadleaf(name, seed, ramp, h, trunk_w, limbs, reach, pitch, blob, flat=0.72, style='bark', twigs=3):
    k = Kit(name, seed)
    r = k.r
    pts = k.trunk(h, trunk_w, style=style)
    k.roots(trunk_w, n=r.randint(4, 6), style=style)
    tx, _, tz = pts[-1]
    n = r.randint(*limbs)
    a0 = r.uniform(0, math.tau)
    for i in range(n):
        az = a0 + i / n * math.tau + r.uniform(-0.35, 0.35)
        f = r.uniform(0.52, 0.86)
        sp = pts[min(len(pts) - 1, int(f * (len(pts) - 1)))]
        L = r.uniform(*reach)
        tip = k.limb(sp[0], h * f, sp[2], az, r.uniform(*pitch), L, max(3.0, trunk_w * 0.42), bend=r.uniform(6, 20), style=style, twigs=twigs)
        rad = r.uniform(*blob)
        k.crown(tip[0], tip[1] + rad * 0.25, tip[2], rad, rad * r.uniform(flat - 0.08, flat + 0.06), rad * r.uniform(0.85, 1.08), ramp)
    top = r.uniform(*blob) * 1.15
    k.limb(tx, h - 4, tz, r.uniform(0, math.tau), 74, top * 0.6, max(3.0, trunk_w * 0.42), 4, style=style, twigs=2)
    k.crown(tx + r.uniform(-2, 2), h + top * 0.55, tz + r.uniform(-2, 2), top, top * flat, top * r.uniform(0.9, 1.05), ramp)
    for i in range(2):
        a = r.uniform(0, math.tau)
        d = r.uniform(5, 10)
        rad = r.uniform(*blob) * 0.72
        k.crown(tx + math.cos(a) * d, h * r.uniform(0.88, 1.02) + rad * 0.3, tz + math.sin(a) * d, rad, rad * flat, rad, ramp)
    return k


def birch(name, seed):
    k = Kit(name, seed)
    r = k.r
    h = r.uniform(56, 64)
    pts = k.trunk(h, 7.5, lean=1.0, flare=1.35, style='birch', sides=7)
    k.roots(7.5, n=4, reach=1.5, style='birch')
    n = r.randint(6, 8)
    a0 = r.uniform(0, math.tau)
    for i in range(n):
        az = a0 + i * 2.4 + r.uniform(-0.3, 0.3)
        f = 0.42 + i / n * 0.5
        sp = pts[min(len(pts) - 1, int(f * (len(pts) - 1)))]
        tip = k.limb(sp[0], h * f, sp[2], az, r.uniform(40, 62), r.uniform(9, 15), 2.6, 8, style='birch', twigs=2, sides=5)
        rad = r.uniform(7, 10.5)
        k.crown(tip[0], tip[1] + 1, tip[2], rad, rad * r.uniform(0.82, 1.0), rad, 'birchleaf', sides=8)
    tx, _, tz = pts[-1]
    k.crown(tx, h + 4, tz, 9.5, 11.5, 9.5, 'birchleaf', sides=8)
    k.crown(tx + r.uniform(-4, 4), h - 8, tz + r.uniform(-4, 4), 10.5, 8.5, 10.5, 'birchleaf', sides=8)
    return k


def pine(name, seed):
    k = Kit(name, seed)
    r = k.r
    h = r.uniform(74, 86)
    k.trunk(h + 6, 9.5, lean=0.4, flare=1.45, style='barkpine', segs=6, sides=7)
    k.roots(9.5, n=4, reach=1.4, style='barkpine')
    tiers = r.randint(6, 7)
    y = 15.0
    for i in range(tiers):
        f = 1 - i / tiers
        rad = 7 + f * 21
        nb = 3 + (1 if f > 0.5 else 0)
        a0 = r.uniform(0, math.tau)
        for b in range(nb):
            k.limb(0, y + 2, 0, a0 + b / nb * math.tau + r.uniform(-0.2, 0.2), r.uniform(-14, 4), rad * 0.86, 2.2, -8, style='barkpine', twigs=0, sides=3)
        # a drooping skirt of needles: a flattened cone, wider at the bottom edge
        jx, jz = r.uniform(-1, 1), r.uniform(-1, 1)
        w1, w2 = r.uniform(0.86, 1.0), r.uniform(0.86, 1.0)
        rings = [((jx, y - 2.6, jz), [rad * 1.75 * w1, rad * 1.75 * w2]), ((jx, y + 0.4, jz), [rad * 2.05, rad * 2.0]), ((jx * 0.6, y + 3.4, jz * 0.6), [rad * 1.45, rad * 1.4]),
                 ((0, y + 6.4, 0), [rad * 0.72, rad * 0.7]), ((0, y + 8.6, 0), [0.4, 0.4])]
        k.loft('crown', rings, 'crown_pine', sides=r.choice([9, 10, 11]), rnd=2.0, caps=(True, True), subdiv=0, up=[0, 0, 1])
        k.blobs.append({'x': round(jx, 2), 'y': round(y + 2.5, 2), 'z': round(jz, 2), 'rx': round(rad, 2), 'ry': 5.5, 'rz': round(rad, 2)})
        y += 9 + f * 4
    rings = [((0, y - 1, 0), [10, 10]), ((0, y + 3, 0), [8, 8]), ((0, y + 8, 0), [4, 4]), ((0, y + 12, 0), [0.3, 0.3])]
    k.loft('crown', rings, 'crown_pine', sides=8, rnd=2.0, caps=(True, True), subdiv=0, up=[0, 0, 1])
    k.blobs.append({'x': 0, 'y': round(y + 3, 2), 'z': 0, 'rx': 5, 'ry': 8, 'rz': 5})
    return k


def sapling(name, seed):
    k = Kit(name, seed)
    r = k.r
    h = r.uniform(15, 19)
    pts = k.trunk(h, 3.2, lean=0.6, flare=1.3, segs=3, sides=5)
    tip = k.limb(pts[1][0], h * 0.62, pts[1][2], r.uniform(0, math.tau), 45, 7, 1.8, 6, twigs=1, sides=4)
    k.crown(pts[-1][0], h + 3, pts[-1][2], 9, 8, 9, 'leafbright', sides=8)
    k.crown(tip[0], tip[1] + 1, tip[2], 6, 5, 6, 'leafbright', sides=7)
    return k


def bush(name, seed, ramp='leaf'):
    k = Kit(name, seed)
    r = k.r
    for i in range(5):
        k.limb(r.uniform(-3, 3), -1, r.uniform(-3, 3), r.uniform(0, math.tau), r.uniform(35, 70), r.uniform(7, 11), 1.8, 6, style='twig', twigs=1, sides=4)
    k.crown(0, 5.6, 0, r.uniform(9.5, 11), r.uniform(7.5, 8.5), r.uniform(9.5, 11), ramp, sides=9)
    k.crown(r.uniform(5, 7), 3.6, r.uniform(-3, 3), 7, 5.6, 7, ramp, sides=8)
    k.crown(r.uniform(-7, -5), 3.4, r.uniform(-3, 3), 7, 5.4, 7, ramp, sides=8)
    k.crown(r.uniform(-2, 2), 3.0, r.uniform(4, 6), 6, 4.6, 6, ramp, sides=7)
    return k


# ------------------------------------------------------------------ ground props

def stump(name, seed):
    k = Kit(name, seed)
    r = k.r
    w = 13
    rings = [((0, -2, 0), w * 1.3), ((0, 2, 0), w * 1.08), ((0.4, 6, 0.2), w), ((0.6, 9.5, 0.3), w * 0.97)]
    k.loft('stumpbody', rings, 'bark', sides=9, rnd=2.3, caps=(False, True),
           paint={'layers': [{'id': 'heart', 'op': 'fill', 'ramp': 'heart', 'tone': 3.8, 'faces': ['end']},
                             {'id': 'rings', 'op': 'stripes', 'axis': [1, 0, 1], 'period': 1.6, 'width': 0.3, 'ramp': 'heart', 'tone': 2.4, 'faces': ['end'], 'wobble': 0.4},
                             {'id': 'mossp', 'faces': ['sides']}, dict(MOSS_DRIP, faces=['sides'], depth=1.2, length=3.0)]})
    k.roots(w, n=5, reach=1.6)
    # bracket fungi stepping up one side
    for i, (y, a) in enumerate([(4.5, 0.6), (6.8, 0.9), (3.0, 1.25)]):
        x, z = math.cos(a) * w * 0.5, math.sin(a) * w * 0.5
        s = 5.5 - i
        k.loft('bracket', [((x * 0.85, y, z * 0.85), [s, 1.4]), ((x * 1.12, y + 0.3, z * 1.12), [s * 0.95, 1.6]), ((x * 1.3, y + 0.1, z * 1.3), [s * 0.5, 0.8])],
               'cap', sides=6, rnd=2.4, caps=(False, True), paint={'ramp': 'chanter', 'tone': 4.6, 'layers': [{'id': 'dots', 'off': True}, {'id': 'gills', 'off': True}]})
    return k


def log(name, seed):
    k = Kit(name, seed)
    r = k.r
    L, w = 30, 9.5
    rings = [((-L / 2, w / 2, 0), [w * 0.95, w * 0.92]), ((-L / 4, w / 2 + 0.2, 0.4), w), ((L / 6, w / 2, -0.2), w * 1.02), ((L / 2, w / 2 - 0.3, 0.2), [w * 0.98, w * 0.9])]
    k.loft('logbody', rings, 'bark', sides=8, rnd=2.3, caps=(True, True),
           paint={'layers': [{'id': 'heart', 'op': 'fill', 'ramp': 'heart', 'tone': 3.6, 'faces': ['start', 'end']},
                             {'id': 'rings', 'op': 'stripes', 'axis': [0, 1, 1], 'period': 1.5, 'width': 0.3, 'ramp': 'heart', 'tone': 2.2, 'faces': ['start', 'end'], 'wobble': 0.4},
                             {'id': 'hollow', 'op': 'spots', 'ramp': 'bark', 'tone': 0.4, 'count': 1, 'radius': [2.2, 2.6], 'faces': ['end'], 'roughness': 0.3},
                             dict(MOSS_DRIP, depth=1.1, length=2.6, scale=3.0)]})
    # a broken branch stub and a twig
    k.limb(-4, w * 0.8, 1, 0.4, 50, 7, 3.0, 10, twigs=1)
    k.limb(6, w * 0.7, -2, 3.6, 30, 5, 2.4, 10, twigs=1)
    # brackets along the side
    for i, x in enumerate([-8, -4.5, 9]):
        y = w * 0.42 + (i % 2) * 1.6
        k.loft('bracket', [((x, y, w * 0.38), [4.2, 1.2]), ((x, y + 0.3, w * 0.62), [4.0, 1.4]), ((x, y + 0.1, w * 0.78), [2.0, 0.7])],
               'cap', sides=6, rnd=2.4, caps=(False, True), paint={'ramp': 'chanter', 'tone': 4.4, 'layers': [{'id': 'dots', 'off': True}, {'id': 'gills', 'off': True}]})
    return k


def boulder(name, seed, lumps=3, big=1.0):
    k = Kit(name, seed)
    r = k.r
    spots = [(0, 0, 0, 1.0)] + [(r.uniform(-9, 9) * big, 0, r.uniform(-7, 7) * big, r.uniform(0.45, 0.7)) for _ in range(lumps - 1)]
    for (x, _, z, s) in spots:
        R = 9.5 * s * big
        hgt = R * r.uniform(0.75, 0.95)
        rings = [((x, -1.5, z), [R * 2.0, R * 1.8]), ((x + r.uniform(-1, 1), hgt * 0.45, z), [R * 2.05, R * 1.85]),
                 ((x + r.uniform(-1.5, 1.5), hgt * 0.85, z + r.uniform(-1, 1)), [R * 1.4, R * 1.3]), ((x + r.uniform(-1, 1), hgt * 1.05, z), [R * 0.5, R * 0.45])]
        k.loft('rock', rings, 'stone', sides=r.choice([6, 7]), rnd=1.9, caps=(False, True), subdiv=0, up=[0, 0, 1], hard=True)
    return k


def mushrooms(name, seed, kind):
    k = Kit(name, seed)
    r = k.r
    if kind == 'toadstool':
        spec = [(0, 0, 9, 4.6, 1.4), (5, 3, 6, 3.4, 1.1), (-4, 3, 4.5, 2.8, 0.9), (2, -4, 3, 2.0, 0.8)]
        style, ramp = 'cap', None
    elif kind == 'bolete':
        spec = [(0, 0, 5.5, 5.4, 2.2), (5, 2, 3.8, 3.8, 1.8), (-3, 4, 2.6, 2.6, 1.4)]
        style, ramp = 'cap', 'bolete'
    elif kind == 'chanter':
        spec = [(0, 0, 6, 3.4, 0.9), (3.5, 2, 4.6, 2.8, 0.8), (-3, 3, 5, 3.0, 0.8), (-3.5, -3, 3.4, 2.2, 0.7), (3, -3, 2.6, 1.8, 0.6), (0.5, 4.5, 3.6, 2.4, 0.7)]
        style, ramp = 'cap', 'chanter'
    else:  # moonglow
        spec = [(0, 0, 7, 3.0, 1.0), (3, 2, 4.6, 2.2, 0.8), (-2.5, 2.5, 3.4, 1.8, 0.7), (-1, -3, 5.4, 2.4, 0.8), (2.5, -2.5, 2.4, 1.5, 0.6)]
        style, ramp = 'cap', 'moonglow'
    for (x, z, h, R, stem) in spec:
        lx, lz = r.uniform(-1, 1) * h * 0.15, r.uniform(-1, 1) * h * 0.15
        k.loft('stem', [((x, -0.5, z), stem * (2.6 if kind == 'bolete' else 1.6)), ((x + lx * 0.5, h * 0.5, z + lz * 0.5), stem * (2.3 if kind == 'bolete' else 1.3)),
                        ((x + lx, h, z + lz), stem * 1.2)], 'stem', sides=5, rnd=2.2, caps=(False, False), subdiv=0, up=[0, 0, 1])
        cy = h - 0.4
        if kind == 'chanter':
            rings = [((x + lx, cy - 0.6, z + lz), R * 0.5), ((x + lx, cy + 0.5, z + lz), R * 2.0), ((x + lx, cy + 1.1, z + lz), R * 2.1), ((x + lx, cy + 0.9, z + lz), R * 1.0)]
        elif kind == 'bolete':
            rings = [((x + lx, cy - 0.6, z + lz), R * 1.3), ((x + lx, cy + 0.4, z + lz), R * 2.0), ((x + lx, cy + R * 0.55, z + lz), R * 1.65), ((x + lx, cy + R * 0.85, z + lz), R * 0.7)]
        else:
            rings = [((x + lx, cy - 0.4, z + lz), R * 1.0), ((x + lx, cy + 0.6, z + lz), R * 2.0), ((x + lx, cy + R * 0.7, z + lz), R * 1.5), ((x + lx, cy + R * 1.05, z + lz), R * 0.5)]
        paint = {'ramp': ramp, 'layers': [{'id': 'dots', 'off': True}]} if ramp else None
        if kind == 'moonglow':
            paint = {'ramp': 'moonglow', 'tone': 5.4, 'light': 0.4, 'layers': [{'id': 'dots', 'ramp': 'moonglow', 'tone': 7.0, 'count': 4}, {'id': 'gills', 'ramp': 'moonglow', 'tone': 4.0}]}
        p = k.loft('glow' if kind == 'moonglow' else 'capm', rings, style, sides=7, rnd=2.1, caps=(True, True), subdiv=0, up=[0, 0, 1], paint=paint)
    return k


# ------------------------------------------------------------------ the set

def models():
    return {
        'oak_a': broadleaf('Oak A', 31, 'leaf', 44, 13, (4, 5), (20, 26), (22, 40), (14, 17.5)),
        'oak_b': broadleaf('Oak B', 41, 'leafbright', 40, 12, (4, 5), (18, 24), (24, 44), (13, 16.5)),
        'maple': broadleaf('Maple', 36, 'copper', 38, 10, (4, 5), (15, 21), (32, 50), (12, 16), flat=0.82),
        'blossom': broadleaf('Blossom', 35, 'blossom', 28, 9, (4, 5), (18, 23), (18, 34), (10.5, 14), flat=0.64),
        'birch': birch('Birch', 33),
        'pine_a': pine('Pine A', 34),
        'pine_b': pine('Pine B', 44),
        'sapling': sapling('Sapling', 30),
        'bush': bush('Bush', 20),
        'stump': stump('Stump', 27),
        'log': log('Log', 26),
        'rock_a': boulder('Rock A', 23, 3, 1.0),
        'rock_b': boulder('Rock B', 24, 2, 0.8),
        'toadstools': mushrooms('Toadstools', 14, 'toadstool'),
        'boletes': mushrooms('Boletes', 16, 'bolete'),
        'chanterelles': mushrooms('Chanterelles', 17, 'chanter'),
        'moonglow': mushrooms('Moonglow', 18, 'moonglow'),
    }


LEAF_KIND = {'oak_a': 'oak', 'oak_b': 'oak', 'maple': 'maple', 'blossom': 'blossom', 'birch': 'birch', 'pine_a': 'pine', 'pine_b': 'pine', 'sapling': 'oak', 'bush': 'bush'}
SWAY = {'oak_a': 0.3, 'oak_b': 0.3, 'maple': 0.3, 'blossom': 0.3, 'birch': 0.35, 'pine_a': 0.22, 'pine_b': 0.22, 'sapling': 0.4, 'bush': 0.3}

if __name__ == '__main__':
    os.makedirs(SPECS, exist_ok=True)
    shapes = {}
    for mid, k in models().items():
        with open(os.path.join(SPECS, mid + '.json'), 'w') as fh:
            json.dump(k.spec(), fh, indent=1)
        if k.blobs:
            top = max(b['y'] + b['ry'] for b in k.blobs)
            shapes[mid] = {'leaf': LEAF_KIND[mid], 'top': round(top, 2), 'sway': SWAY[mid], 'blobs': k.blobs}
    import props
    for pid, sp in props.all_props().items():
        with open(os.path.join(SPECS, pid + '.json'), 'w') as fh:
            json.dump(sp, fh, indent=1)
    out = os.path.join(ROOT, 'src', 'assets', 'nature', 'shapes.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w') as fh:
        json.dump(shapes, fh, separators=(',', ':'))
    print('specs:', len(models()), '-> ', SPECS, '; shapes ->', out)
