"""A small kit for writing the interview office's lowpix specs in Python.

Units are game world units (1 unit = 16 old voxel px; Pip is about 1.6 units tall), Y up, the model's front +Z
(towards the camera), the floor at y = 0. Every model is authored in its own frame and placed by src/onboard/room.ts.

    S = Spec('desk', density=44)
    S.box('top', w, h, d, x, y, z, style='oak', chamfer=0.03)     # y = bottom, x/z = centre
    S.cbox('knob', [w, h, d], [x, y, z], style='brass')            # centre-based
    S.prism('leg', w, h, length, [x, y, z], sides=8, rot=[-90, 0, 0])
    S.rod('stem', a, b, r)                                         # a prism from a to b
    S.write(path)

The palette is Hoot Hollow's "Moss & Moonlight" (src/gfx/palette.ts): calm sage, moss and pine, muted warm woods,
oat and linen paper, mist and dusk blues, lamp gold as a sparing accent.
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS = os.path.join(HERE, 'photos')


def ramp(base, steps=7, hue=12, sat=0.05, spread=0.8):
    return {'base': base, 'steps': steps, 'hue_shift': hue, 'sat_shift': sat, 'spread': spread}


# the calm palette as ramps (darkest first, generated with a warm-highlight / cool-shadow hue shift)
RAMPS = {
    'oak': ramp('#a8845c', spread=0.58), 'oakpale': ramp('#c9ab82', spread=0.5), 'walnut': ramp('#6f553d', spread=0.6), 'deep': ramp('#4a392b', spread=0.6),
    'heart': ramp('#b8946a', spread=0.55), 'wain': ramp('#7d5f44', spread=0.6), 'bark': ramp('#5b4a3c', spread=0.65), 'floor': ramp('#a07c58', spread=0.58),
    'brass': ramp('#c8a764', steps=8, hue=16, sat=0.08, spread=0.8), 'iron': ramp('#5c5a56', spread=0.85), 'steel': ramp('#9aa0a4', spread=0.9),
    'paper': ['#8a7a5e', '#b3a27f', '#d4c6a4', '#e8dfc6', '#f1ead6', '#f8f4e8'], 'oat': ['#7d6a4c', '#a89170', '#cbb893', '#e0d3b4', '#ebe2c9', '#f4efdf'], 'linen': ['#6e5e45', '#988563', '#bba985', '#d4c6a6', '#e2d8bf', '#eee8d8'],
    'cork': ramp('#b08a5a', spread=0.7), 'ink': ramp('#2e2b24', steps=5, spread=0.6), 'graphite': ramp('#5a5c62', steps=5, spread=0.6),
    'sage': ramp('#a7b788'), 'moss': ramp('#86a06a'), 'fern': ramp('#66844f'), 'leaf': ramp('#557343'), 'pine': ramp('#3f5a3b'),
    'terracotta': ramp('#c0866a'), 'clay': ramp('#a66c55'), 'rose': ['#5a3a3a', '#86595a', '#b38681', '#d9aca4', '#e6c6bf', '#f2e0da'], 'blush': ['#6a4040', '#97615e', '#c48d86', '#e8b4ae', '#f0cbc5', '#f7e2de'],
    'berry': ramp('#9e5f66'), 'plum': ramp('#6e5266'), 'dusk': ramp('#617f8c'), 'lake': ramp('#86a9b0'), 'slate': ramp('#46596a'),
    'night': ramp('#27313f'), 'honey': ['#4a3420', '#7a5833', '#a9804b', '#dcb072', '#e7c994', '#f1e0bd'], 'ochre': ramp('#c59a52'), 'straw': ramp('#c9b78d', spread=0.65),
    'lamp': ['#a8743a', '#c99a55', '#e3bd7a', '#f1d39a', '#f6e2b8', '#fbf0d8'], 'glow': ['#d9a25a', '#f0c477', '#f8dc9c', '#fdeec6', '#fff8e6'],
    'glass': ['#40606b', '#6a8f99', '#97b9bf', '#bcd6dc', '#d6e7ea', '#eef6f6'], 'cream': ['#8f7650', '#b89d70', '#d9c49b', '#ebdcbb', '#f3ead2', '#faf5e6'], 'snow': ['#5d6b6e', '#8e9c9a', '#bccac3', '#dfe6dc', '#eef2ea', '#f8faf5'],
    'soot': ramp('#3a3029', steps=5, spread=0.6), 'lilac': ramp('#b4a9c9'), 'mist': ['#4f6663', '#76908b', '#a3b9b3', '#c7d6d1', '#dde7e3', '#eef3f0'],
    'soil': ramp('#4e3b2c', steps=5, spread=0.6), 'screen': ['#2a3a4a', '#3d5a72', '#6f93ad', '#a9c8d8', '#e6f2f2'],
}

BRUSH = {
    'flow': 'long', 'length': 0.6, 'width': 0.08, 'rough': 0.4, 'overshoot': 0.25,
    'textures': {
        'oak': 'wood', 'oakpale': 'wood', 'walnut': 'wood', 'deep': 'wood', 'heart': 'wood', 'wain': 'wood', 'floor': 'wood',
        'bark': 'wood', 'cork': 'stone', 'brass': 'metal', 'iron': 'metal', 'steel': 'metal', 'linen': 'cloth', 'oat': 'cloth',
        'sage': 'cloth', 'rose': 'cloth', 'berry': 'cloth', 'dusk': 'cloth', 'plum': 'cloth', 'lake': 'cloth', 'blush': 'cloth',
        'moss': 'moss', 'fern': 'organic', 'leaf': 'organic', 'pine': 'organic', 'terracotta': 'stone', 'clay': 'stone',
        'snow': 'fur', 'cream': 'organic', 'soil': 'stone',
    },
}

LIGHT = {'dir': [-0.45, 1.0, 0.6], 'strength': 0.45, 'gradient': 0.3, 'ao': 0.55, 'ao_height': 0.6}


def photo(name, scale=1.2, amount=0.8, **kw):
    """A photo-bash layer from art/lowpix/interview/photos/<name> (CC0 Poly Haven, see photos/*/source.json)."""
    return dict(op='photo', src=os.path.join(PHOTOS, name), scale=scale, amount=amount, **kw)


# ---------------------------------------------------------------- paint recipes

def wood(r='oak', tone=3.4, ph='oak_veneer_01', scale=1.0, amount=0.55, flow='long', worn=True, rim=0.6, **kw):
    """Real wood: the photo's own grain and colour, tinted towards the ramp, shaded by the painted light."""
    layers = [dict(op='noise', id='blot', scale=0.6, amount=0.4)]
    if worn:
        layers.append(dict(op='wear', id='wear', width=1, density=0.1, shift=0.8))
    layers += kw.pop('layers', [])
    layers.append(dict(photo(ph, scale=scale * 1.6, amount=1.0, id='grain'), mode='colour', tint=f'{r}:3', tint_amount=0.55, relight=0.5, shade=0.14))
    return dict(ramp=r, tone=tone, brush={'flow': flow, 'length': 1.2, 'width': 0.06, 'rough': 0.35},
                rim={'light_shift': rim, 'dark_shift': -rim, 'outline': 'none'}, layers=layers, **kw)


def metal(r='brass', tone=3.3, **kw):
    layers = [dict(op='noise', id='tarnish', scale=0.25, amount=0.45), dict(op='gloss', id='gloss', dash=True, length=3, density=0.4, shift=0.8, post=True)]
    layers += kw.pop('layers', [])
    return dict(ramp=r, tone=tone, brush={'flow': 'long'}, rim={'light_shift': 0.9, 'dark_shift': -0.9, 'outline': 'none'}, layers=layers, **kw)


def cloth(r='linen', tone=3.4, ph='rough_linen', scale=0.8, amount=0.9, **kw):
    """Real cloth: the photo's weave, dyed to the ramp colour, with soft folds."""
    layers = [dict(op='noise', id='fold', scale=0.35, amount=0.5)]
    layers += kw.pop('layers', [])
    layers.append(dict(photo(ph, scale=scale, amount=1.0, id='weave'), mode='colour', tint=f'{r}:3', tint_amount=0.8, relight=0.4, shade=0.16))
    return dict(ramp=r, tone=tone, brush={'flow': 'vertical', 'rough': 0.35}, rim={'light_shift': 0.4, 'dark_shift': -0.5, 'outline': 'none'}, layers=layers, **kw)


def flat(r, tone=3.0, light=0.6, **kw):
    return dict(ramp=r, tone=tone, light=light, brush={'off': True}, rim={'light_shift': 0.5, 'dark_shift': -0.5, 'outline': 'none'}, **kw)


def glaze(r='cream', tone=3.6, **kw):
    layers = [dict(op='noise', id='glz', scale=0.3, amount=0.25), dict(op='gloss', id='gloss', dash=True, length=2, density=0.7, shift=1.6, post=True)]
    layers += kw.pop('layers', [])
    return dict(ramp=r, tone=tone, brush={'flow': 'vertical', 'rough': 0.3}, rim={'light_shift': 0.7, 'dark_shift': -0.7, 'outline': 'none'}, layers=layers, **kw)


def paper(r='paper', tone=3.6, **kw):
    layers = [dict(op='noise', id='fibre', scale=0.08, amount=0.3), dict(op='patches', id='foxing', scale=0.3, threshold=0.78, shift=-0.6)]
    layers += kw.pop('layers', [])
    return dict(ramp=r, tone=tone, brush={'flow': 'horizontal'}, rim={'light_shift': 0.4, 'dark_shift': -0.9, 'outline': 'none'}, layers=layers, **kw)


def leafy(r='leaf', tone=3.4, **kw):
    layers = [dict(op='stripes', id='vein', axis='x', period=0.12, width=0.18, wobble=0.4, shift=0.7), dict(op='noise', id='dap', scale=0.2, amount=0.5)]
    layers += kw.pop('layers', [])
    return dict(ramp=r, tone=tone, brush={'flow': 'long', 'rough': 0.4}, rim={'light_shift': 0.7, 'dark_shift': -0.7, 'outline': 'none'}, layers=layers, **kw)


def glow(r='glow', tone=3.2, **kw):
    return dict(ramp=r, tone=tone, light=0.15, brush={'off': True}, rim={'light_shift': 0.3, 'dark_shift': -0.3, 'outline': 'none'}, **kw)


def _r(v):
    return [round(float(a), 4) for a in v]


class Spec:
    def __init__(self, name, density=44, desc='', tris=6000, colors=600, light=None, ramps=None, lit=True, brush=None):
        self.d = {
            'name': name,
            'description': desc,
            'license': 'CC0-1.0',
            'density': density,
            'budget': {'tris': tris, 'colors': colors},
            'light': light or dict(LIGHT),
            'brush': brush or BRUSH,
            'render': {'background': '#27313f', 'hero': [-34, 20], 'shadow': 0.4},
            'palette': {'ramps': {k: RAMPS[k] for k in (ramps or RAMPS)}},
            'styles': {},
            'parts': [],
        }
        if lit:
            self.d['material'] = {'unlit': False, 'roughness': 0.92}
        self.ids = {}

    def ramps(self, **kw):
        self.d['palette']['ramps'].update(kw)

    def style(self, name, paint):
        self.d['styles'][name] = paint
        return name

    def styles(self, **kw):
        for k, v in kw.items():
            self.style(k, v)

    # ---------------------------------------------------------------- parts
    def _id(self, id):
        n = self.ids.get(id, 0)
        self.ids[id] = n + 1
        return id if n == 0 else f'{id}_{n}'

    def part(self, id, shape, size, at, style=None, paint=None, rot=None, chamfer=None, parent=None, hide=None, exact=False, **kw):
        p = {'id': id if exact else self._id(id), 'shape': shape, 'pivot': _r(at)}
        if size is not None:
            p['size'] = _r(size)
        if parent:
            p['parent'] = parent
        if rot and any(abs(a) > 1e-6 for a in rot):
            p['rotation'] = _r(rot)
        if chamfer:
            p['chamfer'] = round(chamfer, 4)
        if style:
            p['style'] = style
        if paint:
            p['paint'] = paint
        if hide:
            p['hide'] = hide
        p.update(kw)
        self.d['parts'].append(p)
        return p['id']

    def box(self, id, w, h, d, x, y, z, **kw):
        """A box with its bottom at y (before rotation), centred on x and z."""
        return self.part(id, 'box', [w, h, d], [x, y + h / 2, z], **kw)

    def cbox(self, id, size, at, **kw):
        return self.part(id, 'box', size, at, **kw)

    def taper(self, id, size, at, **kw):
        return self.part(id, 'taper', size, at, **kw)

    def prism(self, id, w, h, length, at, sides=8, **kw):
        """A prism along local z (rot turns it; [-90, 0, 0] stands it up)."""
        return self.part(id, 'prism', [w, h, length], at, sides=sides, **kw)

    def cyl(self, id, r, h, x, y, z, sides=10, **kw):
        """An upright cylinder, bottom at y."""
        rot = kw.pop('rot', [-90, 0, 0])
        return self.part(id, 'prism', [2 * r, 2 * r, h], [x, y + h / 2, z], sides=sides, rot=rot, **kw)

    def knob(self, id, r, l, x, y, z, sides=8, **kw):
        """A round knob sticking out of a front face at z (along +z)."""
        return self.part(id, 'prism', [2 * r, 2 * r, l], [x, y, z + l / 2], sides=sides, **kw)

    def rod(self, id, a, b, r, sides=8, **kw):
        """A round prism from point a to point b (radius r)."""
        ax, ay, az = a
        bx, by, bz = b
        dx, dy, dz = bx - ax, by - ay, bz - az
        L = math.sqrt(dx * dx + dy * dy + dz * dz)
        yaw = math.degrees(math.atan2(dx, dz))
        pitch = -math.degrees(math.atan2(dy, math.hypot(dx, dz)))
        return self.part(id, 'prism', [2 * r, 2 * r, L], [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2], sides=sides, rot=[pitch, yaw, 0], **kw)

    def slab(self, id, a, b, w, t, **kw):
        """A plank from a to b (centre line), width w across, thickness t."""
        ax, ay, az = a
        bx, by, bz = b
        dx, dy, dz = bx - ax, by - ay, bz - az
        L = math.sqrt(dx * dx + dy * dy + dz * dz)
        yaw = math.degrees(math.atan2(dx, dz))
        pitch = -math.degrees(math.atan2(dy, math.hypot(dx, dz)))
        return self.part(id, 'box', [w, t, L], [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2], rot=[pitch, yaw, 0], **kw)

    def loft(self, id, rings, at=(0, 0, 0), sides=8, round=2.4, subdiv=1, caps=(True, True), **kw):
        p = dict(rings=[{'at': _r(r[0]), 'size': (r[1] if isinstance(r[1], (int, float)) else _r(r[1]))} for r in rings],
                 profile={'sides': sides, 'round': round}, subdiv=subdiv, caps=list(caps))
        p.update(kw)
        return self.part(id, 'loft', [1, 1, 1], at, **p)

    def bone(self, id, at, **kw):
        return self.part(id, 'bone', [0, 0, 0], at, exact=True, **kw)

    def card(self, id, art, at, plane='xy', **kw):
        return self.part(id, 'card', None, at, art=art, plane=plane, **kw)

    def write(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            json.dump(self.d, f, indent=1)
        return path
