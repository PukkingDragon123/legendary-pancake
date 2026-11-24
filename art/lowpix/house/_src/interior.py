"""The fixed fittings inside each room (room_f1 / room_f2 / room_f3): ladders between the floors with rope coiled
on their rails, the hatches they arrive through (heavy frames, the trapdoor propped open on its iron ring), the
inside of the front and balcony doors in their wooden arches, candle sconces beside the windows, a peg rail with a
scarf and a straw hat, a bundle of drying herbs, the attic's ladder up into the observatory, and little toadstools
where the floor meets the wall. The wallpaper and flooring are painted by the game from the room's finish."""
import math
import random

from hx import DOOR_A, FLOOR_Y, LADDER_A, R_IN, ROOM_H, SLAB, WINDOWS, Spec, pol
from trunk import styles as trunk_styles

HOLES = {'f2': (*[pol(LADDER_A['f1'], 60)[k] for k in (0, 2)], 10), 'f3': (*[pol(LADDER_A['f2'], 60)[k] for k in (0, 2)], 10)}
DOME_HOLE = (30, -38, 8)
DOME_LADDER_A = math.atan2(30, -38)


def ladder(S, a, y0, y1, r0=58, r1=50, name='ladder', rope=True):
    with S.around(a, name=name):
        rng = random.Random(int(y0))
        for x in (-4.6, 4.6):
            S.rod(name + 'rail', [x, y0, r0], [x, y1, r1], 0.95, sides=6, style='wood')
        n = int((y1 - y0 - 6) / 7)
        for k in range(n):
            y = y0 + 6 + k * 7
            z = r0 + (r1 - r0) * (y - y0) / (y1 - y0)
            S.rod(name + 'rung', [-4.8, y, z], [4.8, y + rng.uniform(-0.3, 0.3), z], 0.75, sides=6, style='plank', paint={'tone': 4.0 + rng.uniform(-0.3, 0.3)})
        if rope:
            yy = y0 + 28
            z = r0 + (r1 - r0) * (yy - y0) / (y1 - y0)
            S.part(name + 'coil', 'prism', [6, 6, 2.2], [-5.8, yy - 3, z + 0.6], sides=10, rot=[0, 90, 0], style='rope')
            S.part(name + 'coil2', 'prism', [4.4, 4.4, 2.4], [-5.8, yy - 3, z + 0.6], sides=10, rot=[0, 90, 0], style='soot')


def hatch_floor(S, fid, x, z, h):
    y = FLOOR_Y[fid]
    for dx, dz, w, d in ((0, -h - 1, 2 * h + 4, 2), (0, h + 1, 2 * h + 4, 2), (-h - 1, 0, 2, 2 * h), (h + 1, 0, 2, 2 * h)):
        S.box('hframe', w, 1.6, d, x + dx, y - 0.4, z + dz, style='frame')
    # the trapdoor, propped open against its frame, with an iron ring
    toward = -1 if x > 0 else 1
    S.part('hlid', 'box', [1.6, 2 * h - 1, 2 * h - 1], [x + toward * (h + 2.6), y + h - 0.6, z], rot=[0, 0, toward * -16], style='plank',
           paint={'layers': [{'id': 'boards', 'op': 'stripes', 'axis': 'z', 'period': 4.6, 'width': 0.14, 'shift': -1.4}]})
    S.part('hring', 'prism', [3, 3, 0.6], [x + toward * (h + 3.7), y + h - 0.6, z], sides=8, rot=[0, 90, 0], style='iron', hide=['front', 'back'])


def inner_door(S, fid, a, w=16, spring=20, ramp='red'):
    y0 = FLOOR_Y[fid]
    zi = R_IN - 0.4
    with S.around(a, name='idoor'):
        S.box('idleaf', w, spring, 1.4, 0, y0, zi - 0.8, paint={'ramp': ramp, 'tone': 3.0, 'layers': [
            {'id': 'planks', 'op': 'stripes', 'axis': 'x', 'period': 4, 'width': 0.14, 'shift': -1.3, 'space': 'world'},
            {'id': 'grain', 'op': 'noise', 'scale': 2, 'amount': 0.35}]})
        S.part('idtop', 'prism', [w, w, 1.4], [0, y0 + spring, zi - 0.75], sides=14, rot=[0, 180, 0], hide=['back'], paint={'ramp': ramp, 'tone': 3.0})
        for yy in (y0 + 4, y0 + spring - 3):
            S.box('idstrap', w * 0.8, 1.2, 0.6, w * 0.08, yy, zi - 1.8, style='iron')
        S.part('idknob', 'prism', [2, 2, 1.4], [-w * 0.32, y0 + spring * 0.55, zi - 2], sides=8, style='brass')
        # the arch: jambs and a ring of shaped boards
        for sx in (-1, 1):
            S.box('idjamb', 3, spring, 3, sx * (w / 2 + 1.5), y0, zi - 1.2, style='frame')
        n = 9
        for i in range(n):
            t = math.pi * (i + 0.5) / n
            r = w / 2 + 1.5
            S.part('idarch', 'box', [2 * r * math.sin(math.pi / n / 2) * 2 + 0.3, 3, 3], [-math.cos(t) * r, y0 + spring + math.sin(t) * r, zi - 1.2],
                   rot=[0, 0, math.degrees(t) - 90], style='frame')
        S.box('idstep', w + 4, 1.2, 4, 0, y0 - 0.6, zi - 2, style='stone')


def sconce(S, fid, a, v, r, side=1):
    y = FLOOR_Y[fid] + v
    with S.around(a, name='sconce'):
        x = side * (r + 9)
        z = R_IN - 0.6
        S.box('scplate', 3, 6, 1, x, y - 3, z - 0.5, style='iron')
        S.slab('scarm', [x, y - 1, z - 1], [x, y - 1, z - 5], 1, 1, style='iron')
        S.disc('scdish', 2.2, y - 1.6, y - 0.8, x, z - 5, sides=8, style='brass')
        S.disc('sccandle', 0.9, y - 0.8, y + 2.6, x, z - 5, sides=6, paint={'ramp': 'cream', 'tone': 3.6})
        S.part('scflame', 'prism', [1.2, 1.2, 1.8], [x, y + 3.6, z - 5], sides=4, rot=[-90, 45, 0], style='lamp', glow=True)


def pegs(S, fid, a, v, items=('scarf', 'hat')):
    y = FLOOR_Y[fid] + v
    with S.around(a, name='pegs'):
        z = R_IN - 0.6
        S.box('pegrail', 16, 2.4, 1.4, 0, y, z - 0.7, style='wood', chamfer=0.3)
        for k, x in enumerate((-5.4, 0, 5.4)):
            S.rod('peg', [x, y + 1.2, z - 1.4], [x, y + 2.2, z - 4], 0.5, sides=5, style='dark')
        if 'scarf' in items:
            S.box('scarf', 2.6, 11, 1.2, -5.4, y - 9.5, z - 3, paint={'ramp': 'red', 'tone': 3.4, 'layers': [
                {'id': 'stripes', 'op': 'stripes', 'axis': 'y', 'period': 2.4, 'width': 0.35, 'ramp': 'cream', 'tone': 3.6}]}, rot=[4, 0, 2])
            S.box('scarf2', 2.4, 8, 1.2, -3.6, y - 7, z - 3.2, paint={'ramp': 'red', 'tone': 3.0}, rot=[4, 0, -3])
        if 'hat' in items:
            S.part('hatbrim', 'prism', [9, 9, 0.8], [5.4, y - 2, z - 3.2], sides=12, style='cloth', paint={'ramp': 'ochre', 'tone': 4.4})
            S.part('hatcrown', 'prism', [5, 5, 3], [5.4, y - 2, z - 4.8], sides=10, paint={'ramp': 'ochre', 'tone': 4.0})
            S.part('hatband', 'prism', [5.3, 5.3, 0.8], [5.4, y - 2, z - 3.9], sides=10, paint={'ramp': 'sky', 'tone': 3.2})
        if 'satchel' in items:
            S.box('satchel', 6, 5, 2.4, 0, y - 7.5, z - 2.6, paint={'ramp': 'wood', 'tone': 3.4}, chamfer=0.5)
            S.box('satflap', 6.2, 2.6, 2.6, 0, y - 5.2, z - 2.6, paint={'ramp': 'dark', 'tone': 3.4})
            S.slab('satstrap', [-2.6, y - 3, z - 2.6], [0, y + 1.6, z - 3.4], 0.8, 0.5, paint={'ramp': 'dark', 'tone': 2.6})


def herbs(S, x, ytop, z):
    rng = random.Random(int(x * 10))
    S.rod('herbstring', [x, ytop, z], [x, ytop - 5, z], 0.3, sides=4, style='rope')
    S.box('herbtie', 2, 1.4, 2, x, ytop - 6.2, z, style='rope')
    for k in range(7):
        a = k / 7 * 2 * math.pi
        S.rod('herb', [x, ytop - 6, z], [x + math.sin(a) * 2.2, ytop - 13 - rng.random() * 3, z + math.cos(a) * 2.2], 0.6, sides=4,
              paint={'ramp': ['fern', 'leaf', 'lilac'][k % 3], 'tone': 3.4 + rng.random()})


def room(fid):
    S = Spec('room_' + fid, density=2, desc=f'Fixed fittings inside the {fid} room')
    trunk_styles(S)
    rng = random.Random(FLOOR_Y[fid])
    y0 = FLOOR_Y[fid]
    if fid == 'f1':
        ladder(S, LADDER_A['f1'], y0, FLOOR_Y['f2'] + 1)
        inner_door(S, fid, DOOR_A, ramp='red')
        pegs(S, fid, DOOR_A - 0.42, 38, ('scarf', 'hat'))
        herbs(S, -20, FLOOR_Y['f2'] - SLAB - 5, 30)
        herbs(S, 40, FLOOR_Y['f2'] - SLAB - 5, -44)
    if fid == 'f2':
        hatch_floor(S, fid, *HOLES['f2'])
        ladder(S, LADDER_A['f2'], y0, FLOOR_Y['f3'] + 1)
        inner_door(S, fid, DOOR_A, w=14, spring=17, ramp='slate')
        pegs(S, fid, DOOR_A - 0.4, 34, ('scarf', 'satchel'))
        herbs(S, 30, FLOOR_Y['f3'] - SLAB - 5, -30)
    if fid == 'f3':
        hatch_floor(S, fid, *HOLES['f3'])
        # a steep ladder up through the ceiling into the observatory dome
        hx, hz, hh = DOME_HOLE
        r = math.hypot(hx, hz)
        ladder(S, DOME_LADDER_A, y0, FLOOR_Y['f3'] + ROOM_H + 2, r0=r + 10, r1=r, name='domeladder', rope=False)
        pegs(S, fid, -2.4, 36, ('satchel',))
    for i, (a, v, r) in enumerate(WINDOWS[fid]):
        sconce(S, fid, a, v, r, side=1 if i % 2 == 0 else -1)
    return S


def specs():
    return {'room_' + f: room(f) for f in ('f1', 'f2', 'f3')}
