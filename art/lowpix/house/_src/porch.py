"""The front door and porch on the right of the trunk (DOOR_A): a round-topped plank door with iron straps, a brass
knob and knocker and a little round window, set in a stone arch of voussoirs that stands out of the flared foot of
the trunk; a plank deck on joists with a railing, stone steps, a lantern post, a welcome mat, flower pots, a stack
of firewood, a watering can, a pair of boots and a mailbox."""
import math
import random

from hx import DOOR_A, Spec, text_art
from trunk import R_of, lantern, styles as trunk_styles
from roots import grass_art, fern_art

DZ = 98          # front face of the door arch (local z)
DOOR_W, DOOR_SPR = 16, 20   # door width, springing line of its arch
DECK_Z1 = 126


def door(S, y0, zf, w, spring, leaf_ramp='red', knocker=True, depth=14, window=True, name='door'):
    """A round-topped door in a stone arch whose front face is at zf (local frame facing +z)."""
    r = w / 2
    rng = random.Random(int(y0) + 3)
    S.style(name + 'leaf', ramp=leaf_ramp, tone=3.4, rim={'light_shift': 0.9, 'dark_shift': -1.0}, brush={'flow': 'vertical', 'length': 4, 'rough': 0.5}, layers=[
        {'id': 'planks', 'op': 'stripes', 'axis': 'x', 'period': 4, 'width': 0.14, 'shift': -1.4, 'space': 'world'},
        {'id': 'grain', 'op': 'noise', 'scale': 2, 'amount': 0.4},
        {'id': 'wear', 'op': 'wear', 'width': 1, 'density': 0.3, 'ramp': 'wood', 'tone': 3.2},
        {'id': 'foot', 'op': 'band', 'axis': 'y', 'from': -1, 'to': -0.8, 'shift': -0.8, 'wobble': 0.2}])
    zl = zf - 3
    S.box(name + 'leaf', w, spring - y0, 1.6, 0, y0, zl, style=name + 'leaf', hide=['back'])
    S.part(name + 'top', 'prism', [w, w, 1.6], [0, spring, zl - 0.05], sides=14, style=name + 'leaf', hide=['back'])
    # iron strap hinges and studs
    for yy in (y0 + 4, spring - 3):
        S.box(name + 'strap', w * 0.8, 1.3, 0.6, -w * 0.08, yy, zl + 1.0, style='iron')
        S.part(name + 'strapend', 'prism', [2, 2, 0.6], [w * 0.32, yy + 0.65, zl + 1.0], sides=6, style='iron')
    S.part(name + 'knob', 'prism', [2.2, 2.2, 1.6], [r * 0.62, y0 + (spring - y0) * 0.55, zl + 1.4], sides=8, style='brass')
    if knocker:
        S.part(name + 'knock', 'prism', [3.6, 3.6, 0.7], [0, y0 + (spring - y0) * 0.72, zl + 1.2], sides=10, style='brass', hide=['back'])
    if window:
        wy = spring + r * 0.15
        S.part(name + 'winrim', 'prism', [5.6, 5.6, 0.8], [0, wy, zl + 0.9], sides=10, style='brass', hide=['back'])
        S.part(name + 'win', 'prism', [4, 4, 0.6], [0, wy, zl + 1.2], sides=10, style='glass', pane=True, hide=['back'])
        S.box(name + 'winbar', 0.6, 4, 0.4, 0, wy - 2, zl + 1.5, style='iron')
    # jambs: stacked dressed stones each side, deep enough to stand out of the trunk
    for sx in (-1, 1):
        y = y0
        k = 0
        while y < spring - 0.5:
            h = min(spring - y, rng.uniform(4.5, 6.5))
            S.box(name + 'jamb', 5, h - 0.4, depth, sx * (r + 2.5), y, zf - depth / 2, style='stone', chamfer=0.7, paint={'tone': 3.6 + rng.random() * 0.7})
            y += h
            k += 1
    # the arch: voussoirs round the half circle with a keystone
    n = 9
    for i in range(n):
        t0 = math.pi * i / n
        t1 = math.pi * (i + 1) / n
        tm = (t0 + t1) / 2
        rr = r + 2.6
        cx, cy = -math.cos(tm) * rr, spring + math.sin(tm) * rr
        wv = 2 * rr * math.sin((t1 - t0) / 2) - 0.4
        key = i == n // 2
        S.part(name + 'vous', 'box', [wv, 5.4 if not key else 7, depth + (1 if key else 0)], [cx, cy + (0.8 if key else 0), zf - depth / 2 + (0.5 if key else 0)],
               rot=[0, 0, math.degrees(tm) - 90], style='stone', chamfer=0.6, paint={'tone': 3.5 + rng.random() * 0.8})
    # the sill under the door
    S.box(name + 'sill', w + 10, 1.6, depth + 2, 0, y0 - 1.6, zf - depth / 2 + 1, style='stone', chamfer=0.4)


def pot(S, x, y, z, r, h, bloom, seed):
    rng = random.Random(seed)
    S.part('pot', 'prism', [2 * r, 2 * r, h], [x, y + h / 2, z], sides=9, rot=[-90, 0, 0], back_scale=[0.78, 0.78], style='terra')
    S.disc('potlip', r + 0.5, y + h - 1.0, y + h + 0.2, x, z, sides=9, style='terra')
    S.disc('soil', r - 0.3, y + h - 0.6, y + h + 0.1, x, z, sides=9, paint={'ramp': 'dark', 'tone': 1.3})
    for k in range(5):
        a = k / 5 * 2 * math.pi + rng.random()
        lx, lz = x + math.sin(a) * r * 0.45, z + math.cos(a) * r * 0.45
        hh = rng.uniform(3, 6)
        S.rod('stalk', [lx, y + h, lz], [lx + math.sin(a) * 1.2, y + h + hh, lz + math.cos(a) * 1.2], 0.35, sides=4, paint={'ramp': 'fern', 'tone': 2.4})
        S.part('pleaf', 'prism', [2.6, 1.2, 2.6], [lx + math.sin(a) * 0.8, y + h + hh * 0.5, lz + math.cos(a) * 0.8], sides=5, rot=[-70, math.degrees(a), 0], style='leaf')
        if bloom:
            S.part('bloom', 'prism', [2.4, 2.4, 1.4], [lx + math.sin(a) * 1.2, y + h + hh + 0.6, lz + math.cos(a) * 1.2], sides=6, rot=[-90, 0, 0],
                   paint={'ramp': bloom, 'tone': 4.0, 'layers': [{'id': 'eye', 'op': 'spots', 'count': 1, 'radius': [0.5, 0.6], 'ramp': 'ochre', 'tone': 4.5}]})


def specs():
    S = Spec('porch', density=2, desc='Front door in a stone arch, plank porch with railing, steps, lantern post and porch clutter')
    trunk_styles(S)
    rng = random.Random(5)
    with S.around(DOOR_A, name='porch'):
        door(S, 4, DZ, DOOR_W, DOOR_SPR + 4, leaf_ramp='red', depth=14)
        # a lintel board with carved name plaque over the arch
        S.box('plaque', 14, 4.4, 1.2, 0, DOOR_SPR + 4 + 12, DZ + 0.4, style='wood', chamfer=0.4,
              paint={'stamps': [{'face': 'front', 'at': 'center', 'art': text_art('PIP', shadow='s'), 'key': {'t': 'dark:1', 's': 'plank:5'}}]})
        # deck: joists, eight boards, a fascia, and posts at the corners
        y1 = 4
        for x in (-18, -6, 6, 18):
            S.box('pjoist', 3, 2.6, DECK_Z1 - 88, x, y1 - 4.2, (DECK_Z1 + 88) / 2, style='dark')
        nb = 9
        for i in range(nb):
            x = -21 + (i + 0.5) * 42 / nb
            S.box('board', 42 / nb - 0.35, 1.6, DECK_Z1 - 88 + rng.uniform(-1, 1), x, y1 - 1.6, (DECK_Z1 + 88) / 2 + rng.uniform(-0.6, 0.6), style='plank',
                  paint={'tone': 4.0 + rng.uniform(-0.4, 0.4)})
        S.box('fascia', 44, 3.2, 1.6, 0, y1 - 4.4, DECK_Z1 + 0.6, style='wood')
        S.box('mat', 13, 0.5, 7, 0, y1, DZ + 6, paint={'ramp': 'red', 'tone': 3.2, 'layers': [
            {'id': 'weave', 'op': 'stripes', 'axis': 'x', 'period': 1.4, 'width': 0.4, 'shift': -0.7},
            {'id': 'border', 'op': 'panel', 'inset': 2, 'shift': 0.8, 'faces': ['top']}]})
        # railing: posts, rails and balusters down both sides, open at the front for the steps
        for sx in (-1, 1):
            for z in (100, 113, DECK_Z1 - 1):
                S.box('ppost', 2.4, 13, 2.4, sx * 20.5, y1, z, style='dark', chamfer=0.4)
                S.part('pfin', 'prism', [2.6, 2.6, 2.2], [sx * 20.5, y1 + 14, z], sides=6, rot=[-90, 0, 0], style='brass')
            S.box('prail', 1.8, 1.6, DECK_Z1 - 99, sx * 20.5, y1 + 11, (DECK_Z1 + 99) / 2, style='wood')
            for z in range(102, DECK_Z1 - 2, 4):
                S.box('pbal', 1, 10, 1, sx * 20.5, y1 + 1, z, style='wood', paint={'tone': 3.4})
            S.box('prail2', 1.2, 1.2, DECK_Z1 - 99, sx * 20.5, y1 + 1.2, (DECK_Z1 + 99) / 2, style='wood')
        for x in (-14, 14):
            S.box('frail', 13, 1.6, 1.8, x * 1.08, y1 + 11, DECK_Z1 - 1, style='wood')
        # stone steps down to the path
        S.box('step1', 22, 2.4, 6, 0, 0, DECK_Z1 + 4, style='stone', chamfer=0.6)
        S.box('step2', 18, 1.2, 5, 0, 0, DECK_Z1 + 9, style='stone', chamfer=0.5, rot=[0, 4, 0])
        # lantern post at the front-left corner
        S.box('lpost', 2.8, 30, 2.8, -24, 0, DECK_Z1 - 1, style='dark', chamfer=0.5)
        S.box('larm', 9, 1.6, 1.6, -20, 28.4, DECK_Z1 - 1, style='dark')
        S.slab('lbrace', [-23, 22, DECK_Z1 - 1], [-17.5, 28.4, DECK_Z1 - 1], 1.2, 1.2, style='dark')
        lantern(S, -16.5, 28.2, DECK_Z1 - 1, chain=2, s=1.0, name='porchlamp')
        # flower pots, firewood, boots, a watering can and a mailbox
        pot(S, 14, y1, 101, 3.2, 5, 'rose', 1)
        pot(S, -14, y1, 102, 2.8, 4.5, 'cream', 2)
        pot(S, 15.5, y1, 118, 2.4, 4, 'lilac', 3)
        for i, (lx, ly) in enumerate([(-15, 0), (-9.5, 0), (-12.2, 4.3), (-17.8, 4.3), (-6.8, 4.3), (-15, 8.6), (-9.5, 8.6)]):
            S.part('log', 'prism', [5.2, 5.2, 9], [lx, y1 + 2.6 + ly, 92 + (i % 2) * 0.6], sides=8, style='wood',
                   paint={'layers': [{'id': 'ends', 'op': 'fill', 'faces': ['front', 'back'], 'ramp': 'heart', 'tone': 4.6},
                                     {'id': 'rings', 'op': 'stripes', 'axis': [1, 1, 0], 'period': 1.0, 'width': 0.3, 'shift': -0.8, 'faces': ['front', 'back']},
                                     {'id': 'barkside', 'op': 'fill', 'faces': ['sides'], 'ramp': 'bark', 'tone': 3.4}]})
        S.part('can', 'prism', [4.6, 4.6, 5], [8, y1 + 2.5, 121], sides=10, rot=[-90, 0, 0], paint={'ramp': 'sky', 'tone': 3.2, 'rim': {'light_shift': 1.2, 'dark_shift': -1.0}})
        S.rod('spout', [10, y1 + 2, 121], [14, y1 + 5.6, 121], 0.6, sides=5, paint={'ramp': 'sky', 'tone': 3.0})
        S.slab('handle', [6.4, y1 + 5.4, 121], [9.6, y1 + 5.4, 121], 0.8, 0.8, paint={'ramp': 'sky', 'tone': 2.6})
        for bx in (3.4, 6.2):
            S.box('boot', 2.4, 4.6, 3, bx, y1, 104, paint={'ramp': 'red', 'tone': 2.4})
            S.box('toe', 2.4, 1.8, 2.4, bx, y1, 106.4, paint={'ramp': 'red', 'tone': 2.4})
        # mailbox on a post beside the steps
        S.box('mpost', 1.8, 15, 1.8, 18, 0, DECK_Z1 + 7, style='dark')
        S.box('mbox', 6, 4.6, 8, 18, 15, DECK_Z1 + 7, paint={'ramp': 'slate', 'tone': 3.2, 'rim': {'light_shift': 1.0, 'dark_shift': -1.0}})
        S.part('mtop', 'prism', [6, 6, 8], [18, 19.6, DECK_Z1 + 7], sides=12, paint={'ramp': 'slate', 'tone': 3.4}, hide=[])
        S.box('mflag', 0.6, 5, 1.4, 21.3, 16, DECK_Z1 + 6, paint={'ramp': 'red', 'tone': 3.6})
        # grass and ferns tucked round the steps
        fkey = {'s': 'fern:1', 'd': 'fern:2', 'm': 'fern:3', 'l': 'fern:4'}
        for k in range(8):
            x = rng.choice([-1, 1]) * rng.uniform(12, 26)
            z = DECK_Z1 + rng.uniform(1, 12)
            art = grass_art(rng) if k % 3 else fern_art(rng, 16)
            S.card('pgrass', art, [x, len(art) / 4 - 0.3, z], plane='xy', key=fkey, rot=[0, rng.uniform(-50, 50), 0])
    return {'porch': S}
