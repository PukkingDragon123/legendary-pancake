"""The second floor's way out: the bedroom door onto a balcony on braced brackets (plank deck, balustrade, a
flower box on the rail, a lantern by the door), a rope bridge from the balcony's side gate across to a platform
on the great limb that grows from the back of the trunk (moss and lichen on its bark, a leafy tip), the platform
itself (octagonal deck, posts, a perch post where Pip launches into the night, a pennant, a lantern) and a rope
swing hanging from the limb."""
import math
import random

from hx import DOOR_A, FLOOR_Y, LIMB_A, RO, Spec, pol, swing
from trunk import R_of, lantern, styles as trunk_styles
from porch import door, pot
from leafart import KEYS, cluster

FY2 = FLOOR_Y['f2']
BZ0, BZ1 = 84, 110       # balcony deck from the trunk to its rail (local z)
PLAT_Z = RO + 66         # platform centre on the limb (local z in the limb's frame)
PLAT_Y = FY2 + 6


def specs():
    S = Spec('balcony', density=2, desc='Bedroom door, balcony, rope bridge, the great limb with its platform and launch perch, a rope swing')
    trunk_styles(S)
    rng = random.Random(9)
    # ---------------------------------------------------------------- balcony
    with S.around(DOOR_A, name='balc'):
        door(S, FY2, R_of(FY2 + 10) + 7, 14, FY2 + 17, leaf_ramp='slate', knocker=False, depth=10, window=True, name='bdoor')
        y1 = FY2
        for i in range(8):
            x = -19 + (i + 0.5) * 38 / 8
            S.box('bboard', 38 / 8 - 0.35, 1.6, BZ1 - BZ0 + rng.uniform(-0.8, 0.8), x, y1 - 1.6, (BZ0 + BZ1) / 2, style='plank', paint={'tone': 4.0 + rng.uniform(-0.4, 0.4)})
        S.box('bframe', 40, 3, 2, 0, y1 - 4.6, BZ1 + 0.4, style='wood')
        for x in (-17, 17):
            S.box('bjoist', 3, 3, BZ1 - BZ0 + 2, x, y1 - 4.6, (BZ0 + BZ1) / 2, style='dark')
            # a diagonal brace down into the trunk
            S.slab('bbrace', [x, y1 - 30, R_of(y1 - 30) - 2], [x, y1 - 4, BZ1 - 3], 2.4, 2.4, style='dark')
            S.box('bshoe', 4, 5, 3, x, y1 - 32, R_of(y1 - 30) - 1, style='iron')
        # balustrade: front and left, the right side has a gate to the bridge
        for x in range(-18, 19, 4):
            S.box('bbal', 1, 10, 1, x, y1, BZ1 - 1, style='wood', paint={'tone': 3.4})
        for z in range(BZ0 + 3, BZ1, 4):
            S.box('bbalL', 1, 10, 1, -19, y1, z, style='wood', paint={'tone': 3.4})
        for z in range(BZ0 + 3, BZ0 + 12, 4):
            S.box('bbalR', 1, 10, 1, 19, y1, z, style='wood', paint={'tone': 3.4})
        for (x, z) in ((-19, BZ1 - 1), (19, BZ1 - 1), (-19, BZ0 + 1), (19, BZ0 + 1), (19, BZ0 + 13)):
            S.box('bpost', 2.4, 13, 2.4, x, y1, z, style='dark', chamfer=0.4)
            S.part('bfin', 'prism', [2.6, 2.6, 2.2], [x, y1 + 14, z], sides=6, rot=[-90, 0, 0], style='brass')
        S.box('brailF', 40, 1.6, 2, 0, y1 + 10.4, BZ1 - 1, style='wood')
        S.box('brailL', 2, 1.6, BZ1 - BZ0, -19, y1 + 10.4, (BZ0 + BZ1) / 2, style='wood')
        S.box('brailR', 2, 1.6, 12, 19, y1 + 10.4, BZ0 + 7, style='wood')
        # flower box on the front rail
        S.box('bfbox', 20, 4, 4.4, -6, y1 + 12, BZ1 - 0.6, style='wood', chamfer=0.4)
        cols = ['rose', 'cream', 'lilac', 'rose', 'ochre', 'cream']
        for k in range(6):
            fx = -14.5 + k * 3.4
            S.part('bfleaf', 'prism', [3, 2, 3], [fx, y1 + 16.4, BZ1 - 0.6], sides=5, rot=[-90, rng.random() * 60, 0], style='leaf')
            S.part('bfbloom', 'prism', [2.2, 1.8, 2.2], [fx + rng.uniform(-0.5, 0.5), y1 + 18 + rng.random(), BZ1 - 0.8], sides=5, rot=[-90, 0, 0],
                   paint={'ramp': cols[k], 'tone': 4.0})
        pot(S, 12, y1, BZ0 + 5, 2.8, 4.5, 'lilac', 7)
        # lantern on a bracket by the door
        S.box('blarm', 1.6, 1.6, 8, -13, y1 + 28, R_of(y1 + 28) + 3, style='iron')
        lantern(S, -13, y1 + 28, R_of(y1 + 28) + 6.5, chain=1.5, s=0.9, name='balclamp')
    S_gate = swing([22, FY2, RO + 17], DOOR_A)

    # ---------------------------------------------------------------- the great limb
    with S.around(LIMB_A, name='limb'):
        pts = [(R_of(56) - 12, 56, 30), (R_of(60) + 10, 60, 25), (RO + 40, 64, 19), (RO + 62, 66, 14), (RO + 84, 70, 11), (RO + 100, 78, 6), (RO + 112, 88, 2)]
        S.loft('limb', [{'at': [0, y, z], 'size': [s * 1.1, s]} for z, y, s in pts], sides=9, rnd=2.2, style='bark_limb', caps=(False, True), subdiv=1)
        # a side twig rising to a tuft of leaves
        S.loft('twig', [{'at': [-2, 66, RO + 46], 'size': 7}, {'at': [-10, 86, RO + 54], 'size': 4.4}, {'at': [-16, 104, RO + 56], 'size': 1.4}],
               sides=7, rnd=2.2, style='bark_limb', caps=(False, True), subdiv=1)
        tufts = [(-16, 106, RO + 56), (-12, 112, RO + 50), (-22, 102, RO + 60), (2, 98, RO + 112), (8, 104, RO + 106), (-4, 102, RO + 118)]
        for i, (x, y, z) in enumerate(tufts):
            for k in range(7):
                a = rng.uniform(-math.pi, math.pi)
                p = [x + math.sin(a) * 6, y + rng.uniform(-4, 5), z + math.cos(a) * 6]
                ny = (p[1] - y) / 6
                key = 'lit' if ny > 0.3 else 'mid' if ny > -0.4 else 'shade'
                S.card('limbleaves', cluster(i * 13 + k, 22, 18, 5), p, plane='xy', key=KEYS[key],
                       rot=[rng.uniform(-30, 10), math.degrees(a) + rng.uniform(-20, 20), rng.uniform(-30, 30)])
        # the platform: an octagonal deck on posts down to the limb
        S.part('plat', 'prism', [40, 40, 4], [0, PLAT_Y - 2, PLAT_Z], sides=8, rot=[-90, 22.5, 0], style='plank',
               paint={'layers': [{'id': 'boards', 'op': 'stripes', 'axis': 'x', 'period': 4.4, 'width': 0.14, 'shift': -1.4, 'space': 'world'}]})
        S.part('platrim', 'prism', [41.5, 41.5, 2.2], [0, PLAT_Y - 4.6, PLAT_Z], sides=8, rot=[-90, 22.5, 0], style='dark')
        for (x, z) in ((-9, PLAT_Z - 4), (9, PLAT_Z + 4), (0, PLAT_Z + 12)):
            S.box('platleg', 3, 12, 3, x, PLAT_Y - 17, z, style='dark', chamfer=0.4)
        rail = []
        for k in range(8):
            a = (k + 0.5) / 8 * 2 * math.pi
            px, pz = math.sin(a) * 18.5, PLAT_Z + math.cos(a) * 18.5
            if math.cos(a - math.pi) > 0.6:   # the bridge lands on the trunk side
                rail.append(None)
                continue
            S.box('platpost', 2, 11, 2, px, PLAT_Y, pz, style='dark', chamfer=0.3)
            rail.append((px, pz))
        for i in range(8):
            a, b = rail[i], rail[(i + 1) % 8]
            if a and b:
                S.rod('platrail', [a[0], PLAT_Y + 10.5, a[1]], [b[0], PLAT_Y + 10.5, b[1]], 0.8, sides=5, style='wood')
        # perch post at the far end: where Pip launches into the night
        S.box('perchpost', 2.8, 20, 2.8, 0, PLAT_Y, PLAT_Z + 15, style='dark', chamfer=0.5)
        S.box('perch', 12, 2, 2.6, 0, PLAT_Y + 20, PLAT_Z + 15, style='wood', chamfer=0.5)
        S.part('perchnub', 'prism', [2.6, 2.6, 1.4], [0, PLAT_Y + 21, PLAT_Z + 16.6], sides=8, style='brass')
        # flag pole and pennant
        S.disc('flagpole', 0.8, PLAT_Y, PLAT_Y + 36, -12, PLAT_Z + 8, sides=6, style='dark')
        S.part('flagtop', 'prism', [2.2, 2.2, 2.2], [-12, PLAT_Y + 37, PLAT_Z + 8], sides=8, rot=[-90, 0, 0], style='brass')
        pen = ['ffffffffffffffff', 'fsfffffffffffff.', 'ffffffffffffff..', 'fsffffffffff....', 'ffffffffff......', 'fsffffff........', 'ffffff..........', 'ffff............']
        S.card('pennant', pen, [-12 + 4, PLAT_Y + 32, PLAT_Z + 8], plane='xy', key={'f': 'red:3', 's': 'cream:3'}, rot=[0, 90, 0])
        # lantern post
        S.disc('plpost', 1.0, PLAT_Y, PLAT_Y + 18, 12, PLAT_Z + 6, sides=6, style='dark')
        S.box('plarm', 1.4, 1.4, 6, 12, PLAT_Y + 17, PLAT_Z + 9, style='iron')
        lantern(S, 12, PLAT_Y + 17, PLAT_Z + 11.5, chain=1.5, s=0.95, name='platlamp')
        # a rope swing under the limb
        sy, sz = 62, RO + 30
        for x in (-5, 5):
            S.rod('swingrope', [x, sy, sz], [x, 14, sz], 0.35, sides=4, style='rope')
        S.box('swingseat', 13, 1.6, 4, 0, 12.6, sz, style='plank')
    # ---------------------------------------------------------------- rope bridge from the balcony gate to the platform
    P = swing([0, PLAT_Y, PLAT_Z], LIMB_A)
    Sg = S_gate
    dx0, dz0 = P[0] - Sg[0], P[2] - Sg[2]
    dl = math.hypot(dx0, dz0)
    E = [P[0] - dx0 / dl * 18, PLAT_Y, P[2] - dz0 / dl * 18]
    dx, dz = E[0] - Sg[0], E[2] - Sg[2]
    L = math.hypot(dx, dz)
    yaw = math.atan2(dx, dz)
    N = max(8, round(L / 4.6))
    pts = []
    for k in range(N + 1):
        u = k / N
        pts.append([Sg[0] + dx * u, Sg[1] + (E[1] - Sg[1]) * u - math.sin(u * math.pi) * 7, Sg[2] + dz * u])
    side = (math.cos(yaw), -math.sin(yaw))
    for k in range(N):
        a, b = pts[k], pts[k + 1]
        m = [(a[i] + b[i]) / 2 for i in range(3)]
        S.slab('bplank', [m[0] - side[0] * 6, m[1] - 0.9, m[2] - side[1] * 6], [m[0] + side[0] * 6, m[1] - 0.9 + rng.uniform(-0.3, 0.3), m[2] + side[1] * 6],
               L / N - 1.0, 1.4, style='plank', paint={'tone': 3.6 + rng.uniform(-0.5, 0.4)})
    for o in (-6.6, 6.6):
        for k in range(N):
            a, b = pts[k], pts[k + 1]
            h0, h1 = 10 - math.sin(k / N * math.pi) * 2.5, 10 - math.sin((k + 1) / N * math.pi) * 2.5
            S.rod('bhand', [a[0] + side[0] * o, a[1] + h0, a[2] + side[1] * o], [b[0] + side[0] * o, b[1] + h1, b[2] + side[1] * o], 0.5, sides=4, style='rope')
            S.rod('bfoot', [a[0] + side[0] * o, a[1] - 0.2, a[2] + side[1] * o], [b[0] + side[0] * o, b[1] - 0.2, b[2] + side[1] * o], 0.45, sides=4, style='rope')
            if k % 2 == 0:
                S.rod('bvert', [a[0] + side[0] * o, a[1], a[2] + side[1] * o], [a[0] + side[0] * o, a[1] + h0, a[2] + side[1] * o], 0.3, sides=4, style='rope')
    for p in (Sg, E):
        for o in (-6.8, 6.8):
            S.box('bbpost', 2.4, 15, 2.4, p[0] + side[0] * o, p[1] - 2, p[2] + side[1] * o, style='dark', chamfer=0.4, rot=[0, math.degrees(yaw), 0])
    return {'balcony': S}
