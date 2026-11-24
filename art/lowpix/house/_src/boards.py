"""A boarded-up floor (boards_f2 / boards_f3): five weathered grey planks nailed across the dollhouse cut, the dark
room behind them full of dust-sheeted furniture, crates and a rolled rug, cobwebs in the corners, and a burnt-
lettered sign hanging on chains with a brass padlock showing the level the floor opens at. Named nodes p0..p4,
sign, webs and curtain are animated by src/world/house/locks.ts when the boards pop off."""
import math
import random

from hx import FLOOR_Y, OPEN_A, R_IN, RO, ROOM_H, Spec, paint_photo, text_art
from trunk import R_of, styles as trunk_styles

LEVEL = {'f2': 3, 'f3': 6}


def web_art(n, flip=False):
    """A corner cobweb: radial threads and a sagging spiral, as pixel art (corner at the top-left)."""
    rows = [['.'] * n for _ in range(n)]
    for k in range(6):
        a = (k + 0.5) / 6 * math.pi / 2
        for t in range(n * 2):
            x, y = int(math.cos(a) * t * 0.7), int(math.sin(a) * t * 0.7)
            if x < n and y < n:
                rows[y][x] = 'w'
    for ring in range(3, n, 4):
        for k in range(60):
            a = k / 60 * math.pi / 2
            sag = math.sin(a * 2) * 1.2
            x, y = int(math.cos(a) * ring + sag * 0.5), int(math.sin(a) * ring + sag)
            if 0 <= x < n and 0 <= y < n:
                rows[y][x] = 'w' if (k % 7) else 'd'
    out = [''.join(r) for r in rows]
    if flip:
        out = [r[::-1] for r in out]
    return out


def boards(fid):
    S = Spec('boards_' + fid, density=2, desc=f'Boarded-up {fid}: planks, sign with padlock, cobwebs, dust sheets')
    trunk_styles(S)
    S.style('grey', ramp='stone', tone=4.4, rim={'light_shift': 0.9, 'dark_shift': -1.1}, brush={'flow': 'x', 'length': 6, 'width': 0.6, 'rough': 0.55, 'textures': {'stone': 'wood'}}, layers=[
        dict(paint_photo('weathered_planks', 34, ['stone'], 'stone:5', tint_amount=0.6), id='ph'),
        {'id': 'streaks', 'op': 'spots', 'count': 10, 'radius': [0.6, 1.2], 'stretch': [8, 0.4, 0.4], 'shift': -1.2},
        {'id': 'knots', 'op': 'spots', 'count': 2, 'radius': [0.8, 1.1], 'ramp': 'dark', 'tone': 2.0, 'bevel': True},
        {'id': 'lichen', 'op': 'spots', 'count': 3, 'radius': [0.6, 1.4], 'ramp': 'lichen', 'tone': 3.4},
        {'id': 'wear', 'op': 'wear', 'width': 1, 'density': 0.5, 'ramp': 'dark', 'tone': 2.2}])
    rng = random.Random(LEVEL[fid] * 7)
    y0 = FLOOR_Y[fid]
    R = R_of(y0 + 30)
    zf = math.cos(OPEN_A) * R + 4
    half = math.sin(OPEN_A) * R + 10
    # five planks, each its own node so they can fly off
    for i in range(5):
        y = y0 + 8 + i * 11.6 + rng.uniform(-1.5, 1.5)
        L = 2 * half + rng.uniform(-6, 10)
        rz = rng.uniform(-7, 7)
        b = S.bone('p%d' % i, [rng.uniform(-3, 3), y, zf + i * 0.6], rot=[0, 0, rz], node=True)
        with S.under(b):
            S.box('plank', L, 9 - (i % 2) * 1.4, 2.4, 0, -4.5, 0, style='grey', chamfer=0.3, paint={'tone': 4.2 + rng.uniform(-0.4, 0.4)})
            for sx in (-1, 1):
                for dy in (-2, 1.5):
                    S.part('nail', 'prism', [1.1, 1.1, 0.6], [sx * (L / 2 - 4 - rng.random() * 3), dy - 0.2, 1.4], sides=6, style='iron')
    # the dark room behind: a back panel of boards and dust-sheeted lumps of furniture
    cur = S.bone('curtain', [0, y0, 20], node=True)
    with S.under(cur):
        S.style('dusk', ramp='dark', tone=1.6, light=0.2, rim={'light_shift': 0.3, 'dark_shift': -0.3}, brush={'flow': 'vertical', 'length': 4, 'rough': 0.5}, layers=[
            {'id': 'boards', 'op': 'stripes', 'axis': 'x', 'period': 7, 'width': 0.12, 'shift': -0.8},
            {'id': 'mottle', 'op': 'noise', 'scale': 6, 'amount': 0.4}])
        S.style('sheet', ramp='cloth', tone=1.9, light=0.6, rim={'light_shift': 0.6, 'dark_shift': -0.5}, brush={'flow': 'vertical', 'length': 3, 'rough': 0.5, 'textures': {'cloth': 'cloth'}}, layers=[
            {'id': 'folds', 'op': 'stripes', 'axis': 'x', 'period': 3.4, 'width': 0.25, 'shift': -0.6, 'wobble': 0.5},
            {'id': 'dust', 'op': 'noise', 'scale': 3, 'amount': 0.4}])
        W = 2 * (R_IN - 6)
        S.box('back', W, ROOM_H, 1, 0, -1, -2, style='dusk')
        for sx in (-1, 1):
            S.box('side', 1, ROOM_H, 30, sx * (R_IN - 8), -1, 12, style='dusk')
        S.box('floor', W, 0.6, 30, 0, -0.6, 12, style='dusk')
        lumps = [(-34, 9, 12, 30, 'chair'), (-6, 12, 8, 18, 'box'), (24, 7, 18, 40, 'tall'), (46, 14, 9, 14, 'box')]
        for x, z, w, h, kind in lumps:
            S.loft('lump', [{'at': [x, 0, z], 'size': [w * 2.1, 14]}, {'at': [x, h * 0.45, z], 'size': [w * 1.9, 12]},
                            {'at': [x, h * 0.85, z], 'size': [w * 1.5, 10]}, {'at': [x, h, z], 'size': [w * 0.6, 4]}],
                   sides=8, rnd=2.6, style='sheet', caps=(False, True), subdiv=1)
        S.box('crate', 12, 10, 10, 10, 0, 22, style='wood', chamfer=0.5, rot=[0, 12, 0])
        S.box('crate2', 9, 8, 8, 12, 10, 21, style='wood', chamfer=0.5, rot=[0, -8, 0])
        S.part('rug', 'prism', [5, 5, 26], [-18, 2.5, 24], sides=8, rot=[0, 80, 0], paint={'ramp': 'red', 'tone': 2.2})
    # cobwebs in the corners of the opening
    wb = S.bone('webs', [0, y0 + ROOM_H, zf + 4], node=True)
    with S.under(wb):
        S.card('web', web_art(36), [-half + 12, -9, 0], plane='xy', key={'w': 'cream:3', 'd': 'cream:1'})
        S.card('web', web_art(30, flip=True), [half - 12, -7.5, 0], plane='xy', key={'w': 'cream:3', 'd': 'cream:1'})
        S.card('web', web_art(22, flip=True), [-half + 9, -ROOM_H + 7, 0], plane='xy', key={'w': 'cream:3', 'd': 'cream:1'}, rot=[0, 0, 90])
    # the sign on chains with a padlock
    sy = y0 + ROOM_H - 30
    sz = zf + 7
    sg = S.bone('sign', [0, y0 + ROOM_H, sz], node=True)
    with S.under(sg):
        top = -(y0 + ROOM_H - sy) + 16
        lv = 'LV%d' % LEVEL[fid]
        S.box('board', 34, 16, 2, 0, top - 16, 0, style='wood', chamfer=0.6,
              paint={'stamps': [{'face': 'front', 'at': 'center', 'offset': [0, 2], 'art': text_art(lv, scale=3, shadow='s'), 'key': {'t': 'dark:0', 's': 'wood:5'}}],
                     'layers': [{'id': 'frame', 'op': 'panel', 'inset': 2, 'shift': -0.8, 'faces': ['front']}]})
        for x in (-12, 12):
            n = int((-top) / 3)
            for k in range(n):
                yy = top + k * 3
                S.part('link', 'prism', [1.6, 2.8, 0.5], [x, yy + 1.5, 0], sides=6, rot=[0, 90 if k % 2 else 0, 0], style='iron')
        S.box('lock', 7, 6, 2.6, 0, top - 4, 1.6, style='brass', chamfer=0.6)
        S.box('keyhole', 1, 2, 0.4, 0, top - 2.6, 3.0, style='soot')
        for sx in (-1, 1):
            S.rod('shackle', [sx * 2.2, top + 2, 1.6], [sx * 2.2, top + 4.2, 1.6], 0.6, sides=5, paint={'ramp': 'stone', 'tone': 5})
        S.rod('shacktop', [-2.4, top + 4.4, 1.6], [2.4, top + 4.4, 1.6], 0.6, sides=5, paint={'ramp': 'stone', 'tone': 5})
        S.box('nailhead', 1.2, 1.2, 0.5, -15, top - 3, 1.2, style='iron')
    return S


def specs():
    return {'boards_' + f: boards(f) for f in ('f2', 'f3')}
