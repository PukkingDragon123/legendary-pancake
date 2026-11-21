"""The crown of the oak above the attic: the planked attic ceiling with its joists and lantern, the trunk closing
over it, a round observation deck with a railing, the brass observatory dome on a wooden drum (seams, rivets, a
slit, a telescope poking out, porthole windows that glow at night, a lamp finial), the chimney's top with clay
pots, the great boughs reaching up into the leaf masses, lanterns and a string of fairy lights hanging from them,
and a birdhouse. The leaf masses themselves are canopy.py (BLOBS are shared)."""
import math
import random

from hx import CHIMNEY_A, NSIDES, ROOF_Y, Spec, pol, swing
from trunk import R_of, ceiling_fittings, lantern, styles as trunk_styles, chimney

TOP = ROOF_Y + 36          # the deck on top of the crown
DOME = (0, TOP, -8)        # dome centre on the deck
DOME_R = 30

# leaf masses of the crown: centre and radii (x, y, z) in house px
BLOBS = [
    ((0, 324, -48), (124, 56, 74)),     # back crown
    ((-100, 290, -8), (70, 50, 62)),    # left
    ((104, 294, -14), (70, 50, 62)),    # right
    ((0, 374, -26), (92, 46, 66)),      # top
    ((-62, 348, 26), (60, 38, 50)),     # upper left front
    ((66, 352, 22), (60, 38, 50)),      # upper right front
    ((-118, 256, 32), (44, 32, 40)),    # low left skirt
    ((122, 260, 26), (44, 32, 40)),     # low right skirt
    ((-72, 268, -74), (56, 36, 48)),    # low back left
    ((76, 272, -70), (56, 36, 48)),     # low back right
    ((-94, 340, -40), (58, 42, 52)),    # top left
    ((98, 344, -36), (58, 42, 52)),     # top right
]


def bough(S, pts, r0, r1, sides=7, name='bough'):
    n = len(pts)
    rings = [{'at': p, 'size': [2 * (r0 + (r1 - r0) * (i / (n - 1)) ** 0.8)] * 2} for i, p in enumerate(pts)]
    S.loft(name, rings, sides=sides, rnd=2.1, style='bark_limb', caps=(False, True), subdiv=1)


def bend(a, b, sag, n=4, wob=0.0, rng=None):
    out = []
    for i in range(n):
        t = i / (n - 1)
        p = [a[k] + (b[k] - a[k]) * t for k in range(3)]
        m = math.sin(t * math.pi)
        p[1] += sag * m
        if rng and 0 < i < n - 1:
            p[0] += (rng.random() - 0.5) * wob * m
            p[2] += (rng.random() - 0.5) * wob * m
        out.append(p)
    return out


def specs():
    S = Spec('roof', density=2, desc='The crown of the oak: attic ceiling, observation deck, brass observatory dome, chimney top, boughs, lanterns')
    trunk_styles(S)
    rng = random.Random(11)
    # ---------------------------------------------------------------- the attic ceiling and the crown closing over it
    r0 = R_of(ROOF_Y) - 0.4
    cut = [f's0_{k}' for k in range(48) if not (17 <= k <= 30)]
    S.loft('roofslab', [{'at': [0, ROOF_Y, 0], 'size': 2 * r0}, {'at': [0, ROOF_Y + 8, 0], 'size': 2 * r0}], sides=NSIDES, rnd=2.0,
           style='slabedge', caps=(True, False), subdiv=0, angle=3.75, hide=cut)
    S.loft('crown0', [{'at': [0, ROOF_Y, 0], 'size': 2 * R_of(ROOF_Y)}, {'at': [0, ROOF_Y + 8, 0], 'size': 2 * R_of(ROOF_Y) + 1}], sides=NSIDES, rnd=2.0,
           style='bark', caps=(False, False), subdiv=0, angle=3.75, hide=[f's0_{k}' for k in range(17, 31)])
    S.loft('crown', [{'at': [0, ROOF_Y + 8, 0], 'size': 2 * R_of(ROOF_Y) + 1}, {'at': [0, ROOF_Y + 18, 0], 'size': 2 * R_of(ROOF_Y) + 2},
                     {'at': [0, ROOF_Y + 28, 0], 'size': 2 * R_of(ROOF_Y) - 2}, {'at': [0, TOP, 0], 'size': 2 * R_of(ROOF_Y) - 8}],
           sides=NSIDES, rnd=2.0, style='bark', caps=(False, True), subdiv=0, angle=3.75,
           paint={'layers': [{'id': 'deck', 'op': 'fill', 'faces': ['end'], 'ramp': 'plank', 'tone': 4.0},
                             {'id': 'boards', 'op': 'stripes', 'axis': 'x', 'period': 6, 'width': 0.14, 'shift': -1.5, 'space': 'world', 'faces': ['end']},
                             {'id': 'nails', 'op': 'spots', 'count': 80, 'radius': [0.35, 0.5], 'shift': -1.6, 'faces': ['end']},
                             {'id': 'moss2', 'op': 'drip', 'ramp': 'moss', 'tone': 3.4, 'depth': 1.0, 'length': 4, 'width': 0.6, 'scale': 6, 'faces': ['sides'],
                              'bevel': {'shadow': 1, 'highlight': 0, 'shadow_ramp': 'bark', 'shadow_tone': 1.0}}]})
    ceiling_fittings(S, ROOF_Y, [(30, -38, 8)])
    # a rim of split logs round the deck and a railing of posts and rails
    rd = R_of(ROOF_Y) - 6
    for k in range(32):
        a = k / 32 * 2 * math.pi
        p = pol(a, rd + 1.5, TOP)
        S.part('rimlog', 'prism', [4.4, 3.6, 2 * math.pi * (rd + 1.5) / 32 + 0.4], [p[0], TOP + 1.2, p[2]], sides=7, rot=[0, math.degrees(a) + 90, 0],
               style='wood', paint={'tone': 3.2 + (k % 3) * 0.35})
    posts = []
    for k in range(20):
        a = k / 20 * 2 * math.pi + 0.08
        p = pol(a, rd - 1, TOP)
        S.disc('rpost', 1.1, TOP, TOP + 11, p[0], p[2], sides=6, style='dark')
        S.disc('rcap', 1.5, TOP + 11, TOP + 12.2, p[0], p[2], sides=6, style='brass')
        posts.append(p)
    for i in range(len(posts)):
        a, b = posts[i], posts[(i + 1) % len(posts)]
        S.rod('rail', [a[0], TOP + 10.5, a[2]], [b[0], TOP + 10.5, b[2]], 0.8, sides=5, style='wood')
        S.rod('rail2', [a[0], TOP + 5.5, a[2]], [b[0], TOP + 5.5, b[2]], 0.6, sides=5, style='wood')

    # ---------------------------------------------------------------- the observatory
    S.style('drum', ramp='wood', tone=3.6, rim={'light_shift': 0.9, 'dark_shift': -1.0}, brush={'flow': 'vertical', 'length': 4, 'rough': 0.5}, layers=[
        {'id': 'staves', 'op': 'stripes', 'axis': 'around', 'period': 1 / 32, 'width': 0.12, 'shift': -1.3},
        {'id': 'band', 'op': 'band', 'axis': 'y', 'from': 0.55, 'to': 0.85, 'ramp': 'brass', 'tone': 3.4},
        {'id': 'band2', 'op': 'band', 'axis': 'y', 'from': -0.9, 'to': -0.65, 'ramp': 'brass', 'tone': 3.0},
        {'id': 'grain', 'op': 'noise', 'scale': 2, 'amount': 0.35}])
    S.style('dome', ramp='brass', tone=3.7, rim={'light_shift': 1.2, 'dark_shift': -1.1}, brush={'flow': 'path', 'length': 3, 'rough': 0.4, 'textures': {'brass': 'metal'}}, layers=[
        {'id': 'seams', 'op': 'stripes', 'axis': 'around', 'period': 1 / 16, 'width': 0.07, 'shift': -1.6},
        {'id': 'rings', 'op': 'stripes', 'axis': 'y', 'period': 7, 'width': 0.08, 'shift': -1.2, 'space': 'world'},
        {'id': 'rivets', 'op': 'spots', 'count': 90, 'radius': [0.4, 0.5], 'shift': 1.6},
        {'id': 'verdigris', 'op': 'patches', 'scale': 5, 'threshold': 0.66, 'ramp': 'sky', 'tone': 2.6, 'bevel': {'shadow': 0, 'highlight': 1}},
        {'id': 'streak', 'op': 'spots', 'count': 14, 'radius': [0.5, 1.0], 'stretch': [0.3, 5, 0.3], 'ramp': 'sky', 'tone': 3.0},
        {'id': 'gloss', 'op': 'gloss', 'dash': True, 'shift': 1.6}])
    dx, dy, dz = DOME
    drum_h = 9
    S.loft('drum', [{'at': [dx, dy, dz], 'size': 2 * DOME_R + 2}, {'at': [dx, dy + drum_h, dz], 'size': 2 * DOME_R + 2}], sides=24, rnd=2.0,
           style='drum', caps=(False, False), subdiv=0)
    prof = [(0, 1.0), (0.3, 0.97), (0.55, 0.86), (0.75, 0.68), (0.9, 0.44), (0.98, 0.2), (1.0, 0.02)]
    H = DOME_R * 1.05
    S.loft('dome', [{'at': [dx, dy + drum_h + t * H, dz], 'size': 2 * DOME_R * k} for t, k in prof], sides=16, rnd=2.0, style='dome', caps=(False, False), subdiv=1)
    # the slit down the front of the dome, and its shutter folded back
    sl = []
    for t, k in prof[:-1]:
        r = DOME_R * k
        sl.append({'at': [dx, dy + drum_h + t * H, dz + r + 0.4], 'size': [7, 0.8]})
    S.loft('slit', sl, sides=4, rnd=8, style='soot', caps=(False, False), subdiv=1)
    S.box('slitL', 1.6, H * 0.8, 1.6, dx - 4.6, dy + drum_h, dz + DOME_R + 0.6, style='brass', rot=[-8, 0, 0])
    S.box('slitR', 1.6, H * 0.8, 1.6, dx + 4.6, dy + drum_h, dz + DOME_R + 0.6, style='brass', rot=[-8, 0, 0])
    # the telescope: a tapering brass tube poking out of the slit, a lens hood and a finder scope
    t0, t1 = [dx, dy + drum_h + 14, dz + 8], [dx + 2, dy + drum_h + 34, dz + DOME_R + 18]
    S.rod('scope', t0, t1, 3.2, sides=10, style='brass')
    S.rod('hood', [t1[0] - 0.3, t1[1] - 1.5, t1[2] - 1.3], [t1[0] + 0.4, t1[1] + 2.6, t1[2] + 2.4], 4.3, sides=10, style='dark')
    S.rod('lens', [t1[0] + 0.3, t1[1] + 2.4, t1[2] + 2.2], [t1[0] + 0.32, t1[1] + 2.6, t1[2] + 2.4], 3.4, sides=10, style='glass', pane=True)
    S.rod('finder', [t0[0] + 4, t0[1] + 4, t0[2] + 6], [t1[0] + 4, t1[1] - 4, t1[2] - 4], 1.1, sides=6, style='brass')
    S.rod('scopeband', [t0[0], t0[1] + 8, t0[2] + 6.5], [t0[0] + 0.3, t0[1] + 9.4, t0[2] + 7.6], 3.7, sides=10, style='dark')
    # finial with a lamp at the top
    top = dy + drum_h + H
    S.disc('finbase', 3.4, top - 1.5, top + 1.5, dx, dz, sides=10, style='brass')
    S.disc('finrod', 0.9, top + 1.5, top + 8, dx, dz, sides=6, style='brass')
    S.part('finlamp', 'prism', [5, 5, 5], [dx, top + 10.5, dz], sides=8, rot=[-90, 0, 0], style='lamp', glow=True)
    S.part('fincap', 'taper', [4.6, 4.6, 3], [dx, top + 14.2, dz], rot=[-90, 0, 0], front_scale=[0.2, 0.2], style='brass')
    # porthole windows round the drum
    for a in (0.9, -0.9, 2.3, -2.3):
        p = swing([0, dy + drum_h / 2, DOME_R + 1.2], a)
        with S.around(a, at=[dx, 0, dz], name='port'):
            S.part('portring', 'prism', [6.4, 6.4, 1.6], [0, dy + drum_h / 2, DOME_R + 1.4], sides=10, style='brass', hide=['back'])
            S.part('portglass', 'prism', [4.4, 4.4, 0.8], [0, dy + drum_h / 2, DOME_R + 2.0], sides=10, style='glass', pane=True, hide=['back'])
    # a little door into the dome at the back and a bench by it
    with S.around(math.pi, at=[dx, 0, dz], name='domedoor'):
        S.box('ddoor', 10, 15, 1.4, 0, dy, DOME_R + 1.2, style='wood', chamfer=0.4)
        S.box('dknob', 1.4, 1.4, 1.2, 3, dy + 7, DOME_R + 2.4, style='brass')

    # ---------------------------------------------------------------- the chimney's top
    chimney(S, ROOF_Y, ROOF_Y + 72, top=True)
    with S.around(CHIMNEY_A, name='chimtop'):
        z = R_of(ROOF_Y) + 3
        S.box('ccap', 25, 3, 18, 0, ROOF_Y + 72, z, style='stone', chamfer=0.8)
        for x, h in ((-5, 8), (5, 6)):
            S.disc('cpot', 3, ROOF_Y + 75, ROOF_Y + 75 + h, x, z, sides=8, style='terra')
            S.disc('cpotlip', 3.6, ROOF_Y + 74 + h, ROOF_Y + 76 + h, x, z, sides=8, style='terra')
            S.disc('csoot', 2.2, ROOF_Y + 75.5 + h, ROOF_Y + 76.2 + h, x, z, sides=8, style='soot')

    # ---------------------------------------------------------------- great arms leaving the trunk below the crown
    for a, y, (bx, by, bz) in ((1.72, 196, (-0.0, 0, 0)), (-1.7, 192, (0, 0, 0)), (2.62, 200, (0, 0, 0)), (-2.55, 198, (0, 0, 0))):
        tgt = min(BLOBS, key=lambda b: (math.atan2(b[0][0], b[0][2]) - a) ** 2 + 0.00002 * (b[0][1] - 280) ** 2)
        (cx, cy, cz), (rx, ry, rz) = tgt
        p0 = pol(a, R_of(y) - 10, y)
        p1 = pol(a, R_of(y) + 18, y + 14)
        end = [cx * 0.85, cy - ry * 0.3, cz * 0.85]
        mid = [(p1[0] + end[0]) / 2, (p1[1] + end[1]) / 2 + 6, (p1[2] + end[2]) / 2]
        S.loft('arm', [{'at': p0, 'size': 26}, {'at': p1, 'size': 20}, {'at': mid, 'size': 13}, {'at': end, 'size': 5}], sides=9, rnd=2.2,
               style='bark_limb', caps=(False, True), subdiv=1)
        for k in range(2):
            aa = rng.uniform(-math.pi, math.pi)
            tip = [cx + math.sin(aa) * rx * 0.7, cy - ry * 0.3, cz + math.cos(aa) * rz * 0.7]
            bough(S, bend(mid, tip, 5, 3), 4.5, 1.2, sides=6, name='armtwig')

    # ---------------------------------------------------------------- boughs up into the leaf masses
    bases = []
    for i, ((cx, cy, cz), (rx, ry, rz)) in enumerate(BLOBS):
        a = math.atan2(cx, cz) if (cx or cz) else 0.0
        if abs(cx) < 10:
            a = math.pi if cz < 0 else 0.0
        b0 = pol(a, R_of(ROOF_Y) - 14, TOP - 6)
        end = [cx * 0.82, cy - ry * 0.2, cz * 0.82]
        mid = [(b0[0] + end[0]) / 2 + (rng.random() - 0.5) * 18, (b0[1] + end[1]) / 2 + 8, (b0[2] + end[2]) / 2]
        th = 13 if ry > 40 else 9
        bough(S, [b0, mid, end], th, th * 0.35)
        bases.append((b0, mid, end))
        # side branches reaching the rim of the mass
        for k in range(2):
            aa = rng.uniform(-math.pi, math.pi)
            tip = [cx + math.sin(aa) * rx * 0.8, cy - ry * 0.35, cz + math.cos(aa) * rz * 0.8]
            bough(S, bend(mid, tip, 6, 3), th * 0.42, 1.2, sides=6, name='twig')
    # lanterns and a birdhouse hanging from the low skirts, fairy lights strung between them
    for (cx, cy, cz), (rx, ry, rz) in BLOBS[6:8]:
        hx, hz = cx * 0.9, cz + rz * 0.5
        ytop = cy - ry * 0.7
        S.rod('lrope', [hx, ytop + 4, hz], [hx, ytop - 10, hz], 0.35, sides=4, style='rope')
        lantern(S, hx, ytop - 10, hz, chain=3, s=1.05, name='skylamp')
    L, Rr = BLOBS[6], BLOBS[7]
    a = [L[0][0] + 14, L[0][1] - L[1][1] * 0.5, L[0][2] + 26]
    b = [Rr[0][0] - 14, Rr[0][1] - Rr[1][1] * 0.5, Rr[0][2] + 26]
    n = 18
    pts = []
    for i in range(n + 1):
        t = i / n
        p = [a[k] + (b[k] - a[k]) * t for k in range(3)]
        p[1] -= math.sin(t * math.pi) * 26
        p[2] += math.sin(t * math.pi) * 40
        pts.append(p)
    for i in range(n):
        S.rod('garland', pts[i], pts[i + 1], 0.35, sides=4, style='rope')
    cols = ['lamp', 'rose', 'lamp', 'sky', 'lamp', 'ochre']
    for i in range(1, n):
        p = pts[i]
        S.part('bulb', 'prism', [2.2, 2.2, 2.6], [p[0], p[1] - 1.8, p[2]], sides=6, rot=[-90, 0, 0],
               paint={'ramp': cols[i % len(cols)], 'tone': 4.4, 'light': 0.1, 'brush': {'off': True}}, glow=True)
    # a birdhouse on the right bough
    (bx, by, bz) = [BLOBS[2][0][0] * 0.62, BLOBS[2][0][1] - 52, BLOBS[2][0][2] * 0.6 + 26]
    S.rod('bhpole', [bx, by - 8, bz], [bx, by + 2, bz], 0.6, sides=4, style='iron')
    S.box('bhouse', 8, 8, 7, bx, by - 16, bz, style='wood', paint={'ramp': 'sky', 'tone': 3.4})
    S.prism('bhroof', 11, 5, 9.4, [bx, by - 5.8, bz], sides=3, style='terra')
    S.part('bhhole', 'prism', [2.6, 2.6, 0.6], [bx, by - 11.5, bz + 3.6], sides=8, style='soot')
    S.rod('bhperch', [bx, by - 14, bz + 3.4], [bx, by - 14, bz + 6], 0.4, sides=4, style='dark')
    return {'roof': S}
