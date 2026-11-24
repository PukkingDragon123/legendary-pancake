"""Helpers for the hollow-oak lowpix specs.

Units are house px (16 px = 1 block = 1 world unit in the game), Y up, the dollhouse cut faces +Z (the camera), the
origin is the centre of the trunk on the ground: exactly the frame of src/world/house/plan.ts, so every GLB drops into
the house group with a uniform 1/16 scale and nothing else. Angles round the trunk follow plan.ts: a = 0 is the front
(+Z), +pi/2 is +X, and a point at angle a and radius r is (sin a * r, y, cos a * r).

    S = Spec('trunk_f1', density=2)
    S.box('step', w, h, d, x, y, z, style='stone')          # bottom at y, centred on x/z
    S.rod('rail', a, b, r)                                   # a prism from point a to b
    with S.around(a): ...                                    # build facing +Z, swung round the trunk to angle a
    S.glow / S.pane / S.node: parts the game treats specially (lamps, window glass, animated nodes)
"""
import contextlib
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS = os.path.abspath(os.path.join(HERE, '..', 'photos'))

# --------------------------------------------------------------------------------------------------- the plan
RO, WALL_T = 84, 12
R_IN = RO - WALL_T
STORY, SLAB = 72, 10
ROOM_H = STORY - SLAB
FLOOR_Y = {'f1': 4, 'f2': 4 + STORY, 'f3': 4 + STORY * 2}
ROOF_Y = FLOOR_Y['f3'] + ROOM_H
NSIDES = 48
CUT_K = 7  # the cut spans CUT_K loft faces either side of the front
OPEN_A = CUT_K / NSIDES * 2 * math.pi
DOOR_A = 1.16
LADDER_A = {'f1': -1.32, 'f2': 2.05}
LIMB_A = 2.28
CHIMNEY_A = -2.02
# windows sit on the bark loft's face boundaries (FACE = one of its 48 faces) so their openings are whole faces
FACE = 2 * math.pi / 48
WINDOWS = {
    'f1': [(FACE * 19, 34, 9), (-FACE * 18, 34, 9)],
    'f2': [(-FACE * 18, 34, 9), (FACE * 23, 38, 7)],
    'f3': [(math.pi, 32, 15), (-FACE * 13, 32, 8), (FACE * 13, 32, 8)],
}
BANDS = {'f1': (0, FLOOR_Y['f2'] - SLAB), 'f2': (FLOOR_Y['f2'] - SLAB, FLOOR_Y['f3'] - SLAB), 'f3': (FLOOR_Y['f3'] - SLAB, ROOF_Y)}


def pol(a, r, y=0.0):
    return [math.sin(a) * r, y, math.cos(a) * r]


def swing(p, a):
    x, y, z = p
    c, s = math.cos(a), math.sin(a)
    return [x * c + z * s, y, -x * s + z * c]


def photo(name, scale=12, amount=0.6, **kw):
    """A photo layer from photos/<name>_s (CC0 scans, downscaled so they sample cleanly at our texel density).
    Paths are relative to art/lowpix/house (make.py builds from there)."""
    return dict(op='photo', src='photos/' + name + '_s', scale=scale, amount=amount, **kw)


def paint_photo(name, scale, ramps, tint, tint_amount=0.55, shade=0.13, relight=0.55, **kw):
    """Paint a surface with a real photo's colours, pulled towards a palette colour and shaded by the painted light."""
    return photo(name, scale=scale, mode='colour', ramps=ramps, tint=tint, tint_amount=tint_amount, shade=shade, relight=relight, **kw)


def ramp(base, steps=7, hue=12, sat=0.06, spread=0.8):
    return {'base': base, 'steps': steps, 'hue_shift': hue, 'sat_shift': sat, 'spread': spread}


def _r(v):
    return [round(float(a), 3) for a in v]


# --------------------------------------------------------------------------------------------------- palette
# src/gfx/palette.ts "Moss & Moonlight"
P = dict(
    ink='#2e2b24', paper='#f4eedd', oat='#eae0c8', linen='#dccfb0', straw='#c9b78d',
    woodPale='#d8bf98', woodLight='#bf9d74', wood='#9c7a56', woodDark='#6f553d', woodDeep='#4a392b', bark='#5b4a3c', barkDark='#3d3229',
    sageLight='#c4cfa3', sage='#a7b788', moss='#86a06a', fern='#66844f', leaf='#557343', pine='#3f5a3b', forest='#2c4030',
    mist='#d3e0dc', sky='#aec8cc', lake='#86a9b0', dusk='#617f8c', slate='#46596a', night='#27313f',
    lamp='#f1d39a', honey='#dcb072', ochre='#c59a52', terracotta='#c0866a', clay='#a66c55', rose='#d9aca4', blush='#e8b4ae', berry='#9e5f66', plum='#6e5266',
    lilac='#b4a9c9', frost='#dfe9ea', pebble='#b9b2a4', stone='#908a7e', stoneDark='#6a655c', brass='#c8a764', brassDark='#8e7440', iron='#5c5a56',
    cream='#f1e6cc',
)


def house_ramps():
    return dict(
        bark=ramp('#5e4c3d', 9, hue=14, sat=0.05, spread=0.9),
        moss=ramp('#7d9a5e', 8, hue=16, sat=0.06, spread=0.85),
        lichen=ramp('#b3bf94', 6, hue=10, sat=0.04, spread=0.6),
        heart=ramp('#b08a62', 8, hue=14, sat=0.05, spread=0.85),
        sap=ramp('#d4bb93', 6, hue=10, sat=0.04, spread=0.6),
        wood=ramp('#9c7a56', 8, hue=14, sat=0.05, spread=0.85),
        plank=ramp('#b39370', 8, hue=12, sat=0.05, spread=0.85),
        dark=ramp('#5f4835', 7, hue=14, sat=0.05, spread=0.8),
        stone=ramp('#938d80', 8, hue=10, sat=0.03, spread=0.85),
        brass=ramp('#c8a764', 7, hue=16, sat=0.05, spread=0.85),
        iron=ramp('#56544f', 6, hue=10, sat=0.02, spread=0.7),
        lamp=['#a8743c', '#d6a35a', '#efc77e', '#f8e0a6', '#fff3d2', '#fffbea'],
        glass=['#3a4a56', '#4f6470', '#6a828a', '#8ea6a8', '#b7cbc8', '#e4eeea'],
        leaf=ramp('#5d7a47', 8, hue=18, sat=0.06, spread=0.9),
        fern=ramp('#6f8c55', 6, hue=14, sat=0.05, spread=0.7),
        cloth=ramp('#d8cbab', 6, hue=10, sat=0.04, spread=0.7),
        rope=ramp('#c2ad84', 6, hue=10, sat=0.04, spread=0.7),
        terra=ramp('#b8826a', 6, hue=14, sat=0.05, spread=0.7),
        red=ramp('#a86a5c', 6, hue=14, sat=0.05, spread=0.7),
        rose=ramp('#d4a8a0', 6, hue=10, sat=0.04, spread=0.6),
        ochre=ramp('#c59a52', 7, hue=14, sat=0.05, spread=0.8),
        cream=ramp('#efe4c8', 5, hue=8, sat=0.03, spread=0.5),
        slate=ramp('#58687a', 6, hue=12, sat=0.04, spread=0.7),
        sky=ramp('#8fb0b6', 6, hue=10, sat=0.04, spread=0.7),
        lilac=ramp('#a99ec2', 6, hue=10, sat=0.04, spread=0.6),
        soot=['#1c1a1d', '#26232a', '#302c33', '#3b363c'],
    )


RIM = {'light_shift': 0.5, 'dark_shift': -0.6}
SOFT = {'length': 3, 'width': 0.9, 'rough': 0.35}


def house_styles(S):
    """The shared material language of the oak, painted from real CC0 scans (bark, oak, planks, rock, leaves)
    pulled towards the calm palette: deep furrowed bark with moss and lichen, carved heartwood, worn planks with
    nail heads, stone, brass, iron, lamps, glass, leaves, rope and cloth. Soft rims, no pixel outlines."""
    S.style('bark', ramp='bark', tone=3.9, rim={'light_shift': 0.4, 'dark_shift': -0.7}, brush=dict(SOFT, flow='vertical', length=5), layers=[
        {'id': 'moss', 'op': 'patches', 'scale': 12, 'threshold': 0.74, 'ramp': 'moss', 'tone': 3.2, 'bevel': {'shadow': 1, 'highlight': 0, 'shadow_ramp': 'bark', 'shadow_tone': 1.2}},
        {'id': 'lichen', 'op': 'spots', 'count': 18, 'radius': [0.9, 2.6], 'roughness': 0.7, 'ramp': 'lichen', 'tone': 3.4},
        paint_photo('bark_brown_02', 34, ['bark'], 'bark:6', tint_amount=0.45, shade=0.12),
        {'id': 'furrows', 'op': 'spots', 'count': 220, 'radius': [0.6, 1.2], 'stretch': [0.35, 6, 0.35], 'roughness': 0.6, 'shift': -2.4},
        {'id': 'ridges', 'op': 'spots', 'count': 160, 'radius': [1.0, 2.0], 'stretch': [0.4, 4.5, 0.4], 'roughness': 0.5, 'shift': 1.2},
        {'id': 'mottle', 'op': 'noise', 'scale': 11, 'amount': 0.8},
        {'id': 'mossfoot', 'op': 'gradient', 'axis': 'y', 'amount': 0.8},
    ])
    S.style('bark_limb', ramp='bark', tone=3.8, rim={'light_shift': 0.5, 'dark_shift': -0.7}, brush=dict(SOFT, flow='path', length=4), layers=[
        {'id': 'moss', 'op': 'patches', 'scale': 5, 'threshold': 0.6, 'ramp': 'moss', 'tone': 3.2, 'faces': ['up'],
         'bevel': {'shadow': 1, 'highlight': 0, 'shadow_ramp': 'bark', 'shadow_tone': 1.2}},
        {'id': 'lichen', 'op': 'spots', 'count': 8, 'radius': [0.8, 2.2], 'ramp': 'lichen', 'tone': 3.4},
        paint_photo('bark_brown_02', 26, ['bark'], 'bark:6', tint_amount=0.45, shade=0.12),
        {'id': 'furrows', 'op': 'stripes', 'axis': 'around', 'period': 0.08, 'width': 0.22, 'shift': -1.8, 'wobble': 0.5},
        {'id': 'mottle', 'op': 'noise', 'scale': 7, 'amount': 0.6},
    ])
    S.style('heart', ramp='heart', tone=4.2, rim=RIM, brush=dict(SOFT, flow='vertical'), layers=[
        paint_photo('oak_veneer_01', 30, ['heart'], 'heart:5', tint_amount=0.5),
        {'id': 'rings', 'op': 'stripes', 'axis': 'x', 'period': 1.8, 'width': 0.3, 'shift': -1.4, 'wobble': 0.3},
        {'id': 'mottle', 'op': 'noise', 'scale': 6, 'amount': 0.5}])
    S.style('plank', ramp='plank', tone=4.2, rim=RIM, brush=dict(SOFT, flow='long', length=6), layers=[
        paint_photo('weathered_planks', 40, ['plank'], 'plank:5', tint_amount=0.5),
        {'id': 'grain', 'op': 'noise', 'scale': 2.5, 'amount': 0.5},
        {'id': 'wear', 'op': 'wear', 'width': 1, 'density': 0.25, 'shift': -1.5}])
    S.style('wood', ramp='wood', tone=3.8, rim=RIM, brush=dict(SOFT, flow='long', length=5), layers=[
        paint_photo('oak_veneer_01', 26, ['wood'], 'wood:5', tint_amount=0.5),
        {'id': 'grain', 'op': 'noise', 'scale': 2.2, 'amount': 0.5},
        {'id': 'wear', 'op': 'wear', 'width': 1, 'density': 0.2, 'shift': 1.4}])
    S.style('dark', ramp='dark', tone=3.4, rim=RIM, brush=dict(SOFT, flow='long', length=5), layers=[
        paint_photo('oak_veneer_01', 22, ['dark'], 'dark:4', tint_amount=0.6),
        {'id': 'grain', 'op': 'noise', 'scale': 2, 'amount': 0.45}])
    S.style('stone', ramp='stone', tone=4.0, rim={'light_shift': 0.7, 'dark_shift': -0.8}, brush=dict(SOFT, textures={'stone': 'stone'}), layers=[
        {'id': 'moss', 'op': 'patches', 'scale': 7, 'threshold': 0.7, 'ramp': 'moss', 'tone': 3.2},
        {'id': 'lichen', 'op': 'spots', 'count': 3, 'radius': [0.6, 1.4], 'ramp': 'lichen', 'tone': 3.8},
        paint_photo('rock_face_03', 26, ['stone'], 'stone:5', tint_amount=0.45),
        {'id': 'mottle', 'op': 'noise', 'scale': 4, 'amount': 0.5}])
    S.style('brass', ramp='brass', tone=3.8, rim={'light_shift': 1.2, 'dark_shift': -1.0}, brush={'off': True}, dither=0, layers=[
        {'id': 'patina', 'op': 'patches', 'scale': 3, 'threshold': 0.66, 'ramp': 'sky', 'tone': 2.6},
        {'id': 'mottle', 'op': 'noise', 'scale': 2, 'amount': 0.6},
        {'id': 'gloss', 'op': 'gloss', 'dash': True, 'shift': 1.8}])
    S.style('iron', ramp='iron', tone=2.8, rim={'light_shift': 1.0, 'dark_shift': -0.8}, brush={'off': True}, dither=0, layers=[
        {'id': 'mottle', 'op': 'noise', 'scale': 2, 'amount': 0.7},
        {'id': 'rust', 'op': 'patches', 'scale': 2.5, 'threshold': 0.72, 'ramp': 'terra', 'tone': 1.6}])
    S.style('lamp', ramp='lamp', tone=3.4, light=0.15, rim={'light_shift': 0.8, 'dark_shift': -0.5}, brush={'off': True}, dither=0, layers=[
        {'id': 'core', 'op': 'gradient', 'axis': 'y', 'amount': -0.8}])
    S.style('glass', ramp='glass', tone=2.4, light=0.3, rim={'light_shift': 1.6, 'dark_shift': -0.8}, brush={'off': True}, dither=0, layers=[
        {'id': 'sheen', 'op': 'gradient', 'axis': [1, 1, 0], 'amount': 1.2},
        {'id': 'gloss', 'op': 'gloss', 'dash': True, 'shift': 2.0}])
    S.style('leaf', ramp='leaf', tone=3.6, rim={'light_shift': 0.6, 'dark_shift': -0.8}, brush=dict(SOFT, flow='vertical', textures={'leaf': 'organic'}), layers=[
        paint_photo('forest_leaves_02', 22, ['leaf'], 'leaf:5', tint_amount=0.45),
        {'id': 'under', 'op': 'gradient', 'axis': 'y', 'amount': 1.1}])
    S.style('moss', ramp='moss', tone=4.0, rim={'light_shift': 0.5, 'dark_shift': -0.6}, brush=dict(SOFT, flow='vertical', textures={'moss': 'moss'}), layers=[
        {'id': 'mottle', 'op': 'noise', 'scale': 2, 'amount': 0.9},
        {'id': 'tufts', 'op': 'spots', 'count': 12, 'radius': [0.5, 1.2], 'shift': 1.4}])
    S.style('rope', ramp='rope', tone=3.4, rim=RIM, brush={'off': True}, dither=0, layers=[
        {'id': 'twist', 'op': 'stripes', 'axis': [1, 1, 1], 'period': 1.4, 'width': 0.35, 'shift': -1.4}])
    S.style('cloth', ramp='cloth', tone=3.6, rim=RIM, brush=dict(SOFT, flow='vertical', textures={'cloth': 'cloth'}), layers=[
        {'id': 'weave', 'op': 'noise', 'scale': 1, 'amount': 0.45}])
    S.style('terra', ramp='terra', tone=3.6, rim={'light_shift': 0.9, 'dark_shift': -0.9}, brush={'off': True}, dither=0, layers=[
        {'id': 'mottle', 'op': 'noise', 'scale': 2, 'amount': 0.6},
        {'id': 'lip', 'op': 'band', 'axis': 'y', 'from': 0.6, 'to': 1.0, 'shift': 0.8},
        {'id': 'moss', 'op': 'patches', 'scale': 3, 'threshold': 0.72, 'ramp': 'moss', 'tone': 3.2}])
    S.style('soot', ramp='soot', tone=1.5, light=0.2, brush={'off': True}, dither=0, rim={'light_shift': 0.3, 'dark_shift': 0})


# --------------------------------------------------------------------------------------------------- the spec
class Spec:
    def __init__(self, name, density=2.0, desc='', light=None, brush=None, tris=60000, colors=255):
        self.d = {
            'name': name,
            'description': desc,
            'license': 'CC0-1.0',
            'density': density,
            'budget': {'tris': tris, 'colors': colors},
            'light': light or {'dir': [-0.45, 1.0, 0.65], 'strength': 0.7, 'gradient': 0.45, 'ao': 0.9, 'ao_height': 14},
            'render': {'background': '#1f2622', 'hero': [-30, 16], 'shadow': 0.35},
            'palette': {'ramps': house_ramps()},
            'styles': {},
            'parts': [],
        }
        self.d['brush'] = brush or {'length': 3, 'width': 0.9, 'rough': 0.35, 'overshoot': 0.2, 'flow': 'horizontal',
                                    'flows': {'moss': 'vertical', 'bark': 'vertical'},
                                    'textures': {'stone': 'stone', 'wood': 'wood', 'plank': 'wood', 'dark': 'wood', 'heart': 'wood',
                                                 'moss': 'moss', 'leaf': 'organic', 'bark': 'wood', 'cloth': 'cloth', 'iron': 'metal', 'brass': 'metal'}}
        house_styles(self)
        self.ids = {}
        self.glow, self.pane, self.nodes, self.parents = set(), set(), [], {}
        self._frame = []  # parent bone stack (around())
        self.notes = {}

    def ramps(self, **kw):
        self.d['palette']['ramps'].update(kw)

    def style(self, name, **paint):
        self.d['styles'][name] = paint

    def _id(self, id):
        n = self.ids.get(id, 0)
        self.ids[id] = n + 1
        return id if n == 0 else f'{id}_{n}'

    def part(self, id, shape, size, at, style=None, paint=None, rot=None, chamfer=None, parent=None, hide=None, glow=False, pane=False, **kw):
        p = {'id': self._id(id), 'shape': shape, 'size': _r(size), 'pivot': _r(at)}
        par = parent or (self._frame[-1] if self._frame else None)
        if par:
            p['parent'] = par
            self.parents[p['id']] = par
        if rot and any(abs(a) > 1e-6 for a in rot):
            p['rotation'] = _r(rot)
        if chamfer:
            p['chamfer'] = round(chamfer, 3)
        if style:
            p['style'] = style
        if paint:
            p['paint'] = paint
        if hide:
            p['hide'] = hide
        p.update(kw)
        self.d['parts'].append(p)
        if glow:
            self.glow.add(p['id'])
        if pane:
            self.pane.add(p['id'])
        return p['id']

    def bone(self, id, at, rot=None, parent=None, node=False):
        bid = self.part(id, 'bone', [0, 0, 0], at, rot=rot, parent=parent)
        if node:
            self.nodes.append(bid)
        return bid

    @contextlib.contextmanager
    def around(self, a, at=None, name='sw'):
        """Build facing +Z (as if at the front of the trunk), swung round the trunk axis to angle a."""
        b = self.bone(name, at or [0, 0, 0], rot=[0, math.degrees(a), 0])
        self._frame.append(b)
        try:
            yield b
        finally:
            self._frame.pop()

    @contextlib.contextmanager
    def under(self, bid):
        self._frame.append(bid)
        try:
            yield bid
        finally:
            self._frame.pop()

    def box(self, id, w, h, d, x, y, z, **kw):
        """A box with its bottom at y (before rotation), centred on x and z."""
        return self.part(id, 'box', [w, h, d], [x, y + h / 2, z], **kw)

    def cbox(self, id, size, at, **kw):
        return self.part(id, 'box', size, at, **kw)

    def taper(self, id, size, at, **kw):
        return self.part(id, 'taper', size, at, **kw)

    def prism(self, id, w, h, length, at, sides=8, **kw):
        return self.part(id, 'prism', [w, h, length], at, sides=sides, **kw)

    def disc(self, id, r, y0, y1, x=0.0, z=0.0, sides=12, **kw):
        """A vertical prism (round post, pot, puck) from y0 to y1."""
        return self.part(id, 'prism', [2 * r, 2 * r, y1 - y0], [x, (y0 + y1) / 2, z], sides=sides, rot=[-90, 0, 0], **kw)

    def rod(self, id, a, b, r, sides=8, roll=0.0, **kw):
        ax, ay, az = a
        bx, by, bz = b
        dx, dy, dz = bx - ax, by - ay, bz - az
        L = math.sqrt(dx * dx + dy * dy + dz * dz)
        yaw = math.degrees(math.atan2(dx, dz))
        pitch = -math.degrees(math.atan2(dy, math.hypot(dx, dz)))
        return self.part(id, 'prism', [2 * r, 2 * r, L], [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2], sides=sides,
                         rot=[pitch, yaw, roll], **kw)

    def slab(self, id, a, b, w, t, **kw):
        """A plank from a to b (centre line), width w across (horizontal), thickness t."""
        ax, ay, az = a
        bx, by, bz = b
        dx, dy, dz = bx - ax, by - ay, bz - az
        L = math.sqrt(dx * dx + dy * dy + dz * dz)
        yaw = math.degrees(math.atan2(dx, dz))
        pitch = -math.degrees(math.atan2(dy, math.hypot(dx, dz)))
        return self.part(id, 'box', [w, t, L], [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2], rot=[pitch, yaw, 0], **kw)

    def loft(self, id, rings, sides=8, rnd=2.0, style=None, caps=(True, True), subdiv=1, at=(0, 0, 0), **kw):
        rr = []
        for r in rings:
            q = {'at': _r(r['at']), 'size': (round(r['size'], 3) if isinstance(r['size'], (int, float)) else _r(r['size']))}
            if r.get('shift'):
                q['shift'] = _r(r['shift'])
            if r.get('roll'):
                q['roll'] = round(r['roll'], 3)
            rr.append(q)
        prof = {'sides': sides, 'round': rnd}
        if kw.get('angle') is not None:
            prof['angle'] = kw.pop('angle')
        return self.part(id, 'loft', [0, 0, 0], at, rings=rr, profile=prof, subdiv=subdiv, style=style, caps=list(caps), **kw)

    def card(self, id, art, at, plane='xy', key=None, rot=None, **kw):
        paint = dict(kw.pop('paint', {}) or {})
        paint.setdefault('ramp', 'leaf')
        if key:
            paint = dict(paint, art_key=key)
        dn = float(self.d['density'])
        size = [max(len(r) for r in art) / dn, len(art) / dn]
        return self.part(id, 'card', size, at, art=art, plane=plane, paint=paint, rot=rot, **kw)

    def write(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            json.dump(self.d, f, indent=1)
        return path

    def meta(self):
        return {'glow': sorted(self.glow), 'pane': sorted(self.pane), 'nodes': list(self.nodes), 'parents': self.parents}


# --------------------------------------------------------------------------------------------------- pixel text
FONT = {
    'A': ['.#.', '#.#', '###', '#.#', '#.#'], 'B': ['##.', '#.#', '##.', '#.#', '##.'], 'C': ['.##', '#..', '#..', '#..', '.##'], 'D': ['##.', '#.#', '#.#', '#.#', '##.'],
    'E': ['###', '#..', '##.', '#..', '###'], 'F': ['###', '#..', '##.', '#..', '#..'], 'G': ['.##', '#..', '#.#', '#.#', '.##'], 'H': ['#.#', '#.#', '###', '#.#', '#.#'],
    'I': ['###', '.#.', '.#.', '.#.', '###'], 'K': ['#.#', '#.#', '##.', '#.#', '#.#'], 'L': ['#..', '#..', '#..', '#..', '###'], 'M': ['#.#', '###', '###', '#.#', '#.#'],
    'N': ['##.', '#.#', '#.#', '#.#', '#.#'], 'O': ['.#.', '#.#', '#.#', '#.#', '.#.'], 'P': ['##.', '#.#', '##.', '#..', '#..'], 'R': ['##.', '#.#', '##.', '#.#', '#.#'],
    'S': ['.##', '#..', '.#.', '..#', '##.'], 'T': ['###', '.#.', '.#.', '.#.', '.#.'], 'U': ['#.#', '#.#', '#.#', '#.#', '###'], 'V': ['#.#', '#.#', '#.#', '#.#', '.#.'],
    'W': ['#.#', '#.#', '###', '###', '#.#'], 'Y': ['#.#', '#.#', '.#.', '.#.', '.#.'], 'Z': ['###', '..#', '.#.', '#..', '###'], "'": ['.#.', '.#.', '...', '...', '...'],
    ' ': ['...', '...', '...', '...', '...'], '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'],
    '3': ['##.', '..#', '.#.', '..#', '##.'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'], '6': ['.##', '#..', '###', '#.#', '###'],
    '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '##.'],
}


def text_art(s, ch='t', scale=1, shadow=None):
    """Rows of pixel art spelling s in the 3x5 font (1 px gap); optional drop shadow char below-right."""
    rows = [''] * 5
    for i, c in enumerate(s.upper()):
        g = FONT.get(c, FONT[' '])
        for y in range(5):
            rows[y] += g[y].replace('#', ch) + ('.' if i < len(s) - 1 else '')
    if scale > 1:
        rows = [''.join(c * scale for c in r) for r in rows for _ in range(scale)]
    if shadow:
        w = len(rows[0]) + 1
        out = [['.'] * w for _ in range(len(rows) + 1)]
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                if c != '.':
                    out[y + 1][x + 1] = shadow
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                if c != '.':
                    out[y][x] = c
        rows = [''.join(r) for r in out]
    return rows
