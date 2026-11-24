"""The oak's crown of leaves: for every leaf mass (roof.BLOBS) a dark inner core (a lofted ellipsoid painted as
shaded leaves, so no sky shows through the gaps) wrapped in hand-pixelled oak-leaf cluster cards facing out,
lit on top and shaded underneath, with sage tips, acorn sprigs and ivy strands hanging from the undersides."""
import math
import random

from hx import Spec, paint_photo
from leafart import KEYS, acorn_sprig, cluster, strand
from roof import BLOBS


def core(S, c, r, k=0.72):
    x, y, z = c
    rx, ry, rz = (v * k for v in r)
    rings = [(-1.0, 0.0), (-0.62, 0.78), (-0.15, 1.0), (0.4, 0.88), (0.78, 0.55), (1.0, 0.0)]
    S.loft('core', [{'at': [x, y + ry * t, z], 'size': [max(0.05, 2 * rx * s), max(0.05, 2 * rz * s)]} for t, s in rings],
           sides=12, rnd=2.0, style='crown', caps=(False, False), subdiv=1)


def specs():
    C = Spec('canopy', density=1, desc='The leafy crown: the shaded inner leaf masses')
    S = Spec('leaves', density=4, desc='The leafy crown: pixel oak-leaf cluster cards over the leaf masses', tris=40000)
    C.style('crown', ramp='leaf', tone=2.0, rim={'light_shift': 0.4, 'dark_shift': -0.6},
            brush={'flow': 'vertical', 'length': 2.2, 'rough': 0.85, 'textures': {'leaf': 'organic'}}, layers=[
                dict(paint_photo('forest_leaves_02', 26, ['leaf'], 'leaf:1', tint_amount=0.85, shade=0.2), id='ph'),
                {'id': 'clumps', 'op': 'spots', 'count': 160, 'radius': [1.6, 3.4], 'shift': 1.0, 'roughness': 0.6, 'bevel': {'shadow': 1, 'highlight': 1}},
                {'id': 'holes', 'op': 'spots', 'count': 90, 'radius': [1.0, 2.2], 'shift': -1.2, 'roughness': 0.6},
                {'id': 'under', 'op': 'gradient', 'axis': 'y', 'amount': 1.4}])
    rng = random.Random(21)
    arts = [cluster(s, 60, 48, 7) for s in range(14)] + [cluster(s + 50, 48, 40, 5) for s in range(8)] + [cluster(s + 90, 68, 56, 9) for s in range(6)]
    sprigs = [acorn_sprig(s) for s in range(4)]
    golden = (math.sqrt(5) - 1) / 2
    for bi, ((cx, cy, cz), (rx, ry, rz)) in enumerate(BLOBS):
        area = 4 * math.pi * ((rx * ry) ** 1.6 + (rx * rz) ** 1.6 + (ry * rz) ** 1.6) ** (1 / 1.6) / 3
        # the inside of the mass: deeper shells of shaded leaf clusters (no solid core, it is leaves all the way)
        for shell, (k0, k1, dens) in enumerate(((0.32, 0.55, 260), (0.6, 0.86, 150))):
            m = int(area * (k0 + k1) / 2 / dens)
            for i in range(m):
                yy = 1 - 2 * (i + 0.5) / m
                rr = math.sqrt(max(0, 1 - yy * yy))
                th = 2 * math.pi * golden * i + bi * 1.7 + shell
                nx, ny, nz = math.cos(th) * rr, yy, math.sin(th) * rr
                push = rng.uniform(k0, k1)
                art = arts[22 + (i + bi) % 6] if shell == 0 else arts[(i * 5 + bi) % len(arts)]
                S.card('inner', art, [cx + nx * rx * push, cy + ny * ry * push, cz + nz * rz * push], plane='xy', key=KEYS['shade' if shell == 0 or ny < 0.3 else 'mid'],
                       rot=[rng.uniform(-60, 60), math.degrees(math.atan2(nx, nz)) + rng.uniform(-40, 40), rng.uniform(-90, 90)])
        # the outer leaves: count by area, fewer underneath
        n = int(area / 95)
        for i in range(n):
            yy = 1 - 2 * (i + 0.5) / n
            rr = math.sqrt(max(0, 1 - yy * yy))
            th = 2 * math.pi * golden * i + bi
            nx, ny, nz = math.cos(th) * rr, yy, math.sin(th) * rr
            if ny < -0.55 and rng.random() < 0.6:
                continue
            push = rng.uniform(0.98, 1.2)
            px, py, pz = cx + nx * rx * push, cy + ny * ry * push, cz + nz * rz * push
            yaw = math.degrees(math.atan2(nx, nz))
            pitch = -math.degrees(math.asin(max(-1, min(1, ny)))) * 0.75
            key = 'lit' if ny > 0.42 else 'mid' if ny > -0.25 else 'shade'
            if key != 'shade' and rng.random() < 0.18:
                key = 'sage'
            art = arts[(i * 7 + bi * 3) % len(arts)]
            S.card('leaves', art, [px, py, pz], plane='xy', key=KEYS[key], rot=[pitch + rng.uniform(-14, 14), yaw + rng.uniform(-20, 20), rng.uniform(-40, 40)])
        # ivy strands hanging from the underside
        for k in range(3 + bi % 3):
            a = rng.uniform(-math.pi, math.pi)
            d = rng.uniform(0.3, 0.75)
            h = rng.randint(44, 80)
            px, pz = cx + math.sin(a) * rx * d, cz + math.cos(a) * rz * d
            py = cy - ry * math.sqrt(max(0.05, 1 - d * d)) * 0.8 - h / 8
            S.card('strand', strand(bi * 10 + k, h), [px, py, pz], plane='xy', key=KEYS['mid'], rot=[0, rng.uniform(0, 180), 0])
    return {'leaves': S}
