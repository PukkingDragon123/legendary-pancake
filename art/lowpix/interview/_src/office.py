"""Pip's office inside the old oak: the furniture and everything on the desk, walls and shelves.

Every model is authored in world units in its own frame (front +Z, floor or mounting point at y = 0 unless noted)
and placed by src/onboard/room.ts. Part ids that the game animates are exact (hand_h, hand_m, pendulum, flame...).
"""
import math
import random

from _kit import Spec, wood, metal, cloth, flat, glaze, paper, leafy, glow, photo
from plants import KEYS, leaf_art

BOOK_RAMPS = ['berry', 'pine', 'dusk', 'ochre', 'plum', 'clay', 'slate', 'moss', 'walnut', 'lake', 'terracotta', 'sage']


def book_style(r, tone=3.0, upright=True):
    """A cloth-bound book: gold bands and a dark title block on the spine, page edges on the other sides."""
    if upright:
        spine, pages, ax, lines = ['front'], ['top'], 'y', 'x'
    else:
        spine, pages, ax, lines = ['left'], ['right', 'front', 'back'], 'x', 'y'
    lay = [photo('rough_linen', scale=0.5, amount=0.6, id='cloth'),
           dict(op='band', id='g1', axis=ax, **{'from': 0.62, 'to': 0.7}, ramp='brass', tone=4.6, faces=spine),
           dict(op='band', id='g2', axis=ax, **{'from': -0.74, 'to': -0.66}, ramp='brass', tone=4.4, faces=spine),
           dict(op='band', id='title', axis=ax, **{'from': 0.05, 'to': 0.38}, shift=-1.2, faces=spine, bevel=True),
           dict(op='wear', id='rub', width=1, density=0.25, shift=1.2),
           dict(op='fill', id='pages', ramp='paper', tone=3.2, faces=pages),
           dict(op='stripes', id='leaves', axis=lines, period=0.012, width=0.3, shift=-0.9, faces=pages)]
    return dict(ramp=r, tone=tone, brush={'flow': 'vertical'}, rim={'light_shift': 1.0, 'dark_shift': -1.1, 'outline': 'none'}, layers=lay)


def books_styles(S, upright=True, prefix='bk'):
    for r in BOOK_RAMPS:
        S.style(f'{prefix}_{r}', book_style(r, 2.8 if r in ('ochre', 'sage', 'lake', 'terracotta') else 3.2, upright))
    return [f'{prefix}_{r}' for r in BOOK_RAMPS]


def desk():
    """A partners' writing desk: two pedestals, a pine leather top with a tooled border, a pencil drawer, brass pulls.
    The right pedestal has an open slot for the sliding drawer (its own model, desk_drawer). 4 x 1.06 x 1.6 units."""
    S = Spec('desk', density=48, desc='Pip\'s writing desk')
    S.styles(
        oak=wood('oak', 3.3, scale=1.1),
        top=wood('oak', 3.4, scale=1.3, layers=[dict(op='stripes', id='planks', axis='z', period=0.52, width=0.035, shift=-1.6, faces=['top'])]),
        panel=wood('oak', 3.0, scale=0.9, layers=[dict(op='panel', id='groove', inset=3, shift=-1.4, highlight=1, shadow=1)]),
        walnut=wood('walnut', 3.2, ph='wood_table_001', scale=1.2),
        brass=metal('brass', 3.8),
        leather=dict(ramp='pine', tone=3.4, brush={'flow': 'horizontal'}, rim={'light_shift': 0.6, 'dark_shift': -0.6, 'outline': 'none'},
                     layers=[photo('brown_leather', scale=0.9, amount=1.0, id='hide'),
                             dict(op='rect', id='tool', rect=[0.03, 0.06, 0.97, 0.94], shift=1.2, faces=['top'], bevel=True),
                             dict(op='rect', id='tool2', rect=[0.05, 0.1, 0.95, 0.9], shift=-1.2, faces=['top']),
                             dict(op='patches', id='rub', scale=0.25, threshold=0.7, shift=0.7)]),
        slot=flat('deep', 0.8, light=0.2),
    )
    W, D, H = 4.0, 1.56, 1.06
    S.box('top', W, 0.1, D + 0.06, 0, H - 0.1, 0, style='top', chamfer=0.025)
    S.box('lip', W - 0.12, 0.06, D - 0.04, 0, H - 0.16, 0, style='walnut', chamfer=0.02)
    S.box('leather', 2.3, 0.014, 1.0, -0.2, H, 0.08, style='leather')
    for sx, name in ((-1, 'L'), (1, 'R')):
        S.box('plinth' + name, 1.0, 0.1, D + 0.02, sx * 1.45, 0, 0, style='walnut', chamfer=0.02)
    # left pedestal: a cupboard with a raised panel door, a brass knob and a keyhole
    S.box('pedL', 0.92, H - 0.26, D - 0.06, -1.45, 0.1, 0, style='oak', chamfer=0.02, hide=['top'])
    S.box('doorL', 0.76, 0.6, 0.04, -1.45, 0.16, D / 2 - 0.02, style='panel', chamfer=0.012)
    S.knob('knobL', 0.045, 0.06, -1.18, 0.5, D / 2 + 0.02, style='brass')
    S.box('keyL', 0.04, 0.07, 0.01, -1.18, 0.4, D / 2 + 0.02, style='slot')
    # right pedestal: a short cupboard, and above it the open slot the drawer slides out of
    S.box('pedR', 0.92, 0.36, D - 0.06, 1.45, 0.1, 0, style='oak', chamfer=0.02)
    S.box('doorR', 0.76, 0.26, 0.04, 1.45, 0.14, D / 2 - 0.02, style='panel', chamfer=0.012)
    S.box('pullR', 0.16, 0.04, 0.04, 1.45, 0.32, D / 2 + 0.02, style='brass', chamfer=0.01)
    for sx in (-1, 1):
        S.box('cheek', 0.08, H - 0.62, D - 0.06, 1.45 + sx * 0.42, 0.46, 0, style='oak')
    S.box('slot', 0.78, 0.44, 0.04, 1.45, 0.46, -D / 2 + 0.1, style='slot')
    S.box('slotfloor', 0.78, 0.02, D - 0.12, 1.45, 0.46, 0, style='slot')
    # the pencil drawer between the pedestals, and a back panel so the chair stays hidden
    S.box('apron', 1.98, 0.16, 0.05, 0, H - 0.32, D / 2 - 0.1, style='panel', chamfer=0.01)
    for px in (-0.45, 0.45):
        S.box('pull', 0.12, 0.035, 0.035, px, H - 0.26, D / 2 - 0.05, style='brass', chamfer=0.008)
    S.box('back', 2.0, 0.66, 0.05, 0, 0.12, -D / 2 + 0.12, style='panel')
    return S


def desk_drawer():
    """The drawer that slides out of the right pedestal; origin at the middle of its front face, bottom edge."""
    S = Spec('desk_drawer', density=56)
    S.styles(oak=wood('oak', 3.0), front=wood('oak', 3.3, layers=[dict(op='panel', id='groove', inset=3, shift=-1.3, highlight=1, shadow=1)]),
             brass=metal('brass', 3.8), inside=wood('oakpale', 2.6, worn=False),
             pencil=dict(ramp='honey', tone=3.6, brush={'off': True}, rim={'light_shift': 0.8, 'dark_shift': -0.8, 'outline': 'none'}),
             letter=paper('oat', 3.6))
    S.box('front', 0.74, 0.36, 0.05, 0, 0, -0.025, style='front', chamfer=0.012)
    S.box('pull', 0.2, 0.045, 0.045, 0, 0.2, 0.02, style='brass', chamfer=0.01)
    S.box('floor', 0.66, 0.02, 1.2, 0, 0.02, -0.65, style='inside')
    for sx in (-1, 1):
        S.box('side', 0.03, 0.26, 1.2, sx * 0.33, 0.02, -0.65, style='oak')
    S.box('rear', 0.66, 0.26, 0.03, 0, 0.02, -1.24, style='oak')
    S.rod('pencil', [-0.22, 0.06, -0.3], [-0.2, 0.06, -0.9], 0.016, sides=6, style='pencil')
    S.rod('pencil', [-0.14, 0.06, -0.35], [-0.18, 0.06, -0.95], 0.016, sides=6, style='pencil')
    S.box('letter', 0.36, 0.02, 0.5, 0.1, 0.04, -0.7, style='letter', rot=[0, 8, 0])
    return S


def chair():
    """Pip's chair behind the desk: turned legs, a spindle back with a carved crest rail and a sage velvet cushion.
    The cushion top is at y = 0.96 (where Pip stands)."""
    S = Spec('chair', density=48)
    S.styles(oak=wood('walnut', 3.4, ph='wood_table_001'), seat=wood('oak', 3.3),
             cushion=cloth('sage', 3.2, ph='velour_velvet', scale=0.6, layers=[dict(op='panel', id='piping', inset=2, shift=1.2, highlight=1, shadow=1)]),
             button=flat('pine', 2.2),
             crest=wood('walnut', 3.2, ph='wood_table_001', layers=[
                 dict(op='spots', id='moon', centers=[[0, 0.0, 0.04, 0.07]], ramp='lamp', tone=3.6, faces=['front'], bevel=True),
                 dict(op='spots', id='bite', centers=[[0.035, 0.02, 0.04, 0.06]], ramp='walnut', tone=3.2, faces=['front'])]))
    S.box('seat', 1.0, 0.08, 0.9, 0, 0.8, 0, style='seat', chamfer=0.02)
    S.box('cushion', 0.92, 0.09, 0.82, 0, 0.87, 0.02, style='cushion', chamfer=0.03)
    S.box('tuft', 0.06, 0.012, 0.06, 0, 0.96, 0.02, style='button')
    for x, z in ((-0.42, -0.36), (0.42, -0.36), (-0.42, 0.36), (0.42, 0.36)):
        S.prism('leg', 0.09, 0.09, 0.8, [x, 0.4, z], sides=6, rot=[-90, 0, 0], style='oak', back_scale=[0.75, 0.75])
    for z in (-0.36, 0.36):
        S.box('stretcher', 0.8, 0.05, 0.05, 0, 0.26, z, style='oak')
    for x in (-0.44, 0.44):
        S.box('post', 0.09, 1.0, 0.09, x, 0.86, -0.4, style='oak', chamfer=0.015)
        S.cyl('finial', 0.06, 0.08, x, 1.86, -0.4, sides=6, style='oak')
    for i in range(5):
        S.box('spindle', 0.045, 0.62, 0.045, -0.3 + i * 0.15, 0.98, -0.4, style='oak')
    S.box('rail', 0.98, 0.07, 0.07, 0, 0.92, -0.4, style='oak')
    S.box('crest', 1.02, 0.22, 0.08, 0, 1.6, -0.4, style='crest', chamfer=0.03)
    return S


def lamp():
    """A banker's lamp: a stepped brass foot, a stem with a pull chain and a green glass shade glowing underneath."""
    S = Spec('lamp', density=72)
    S.styles(brass=metal('brass', 3.7), shade=glaze('pine', 3.6), under=glow('glow', 3.6), chain=metal('brass', 4.2))
    S.cyl('foot', 0.2, 0.05, 0, 0, 0, sides=12, style='brass', back_scale=[0.85, 0.85])
    S.cyl('foot2', 0.12, 0.05, 0, 0.05, 0, sides=10, style='brass')
    S.cyl('stem', 0.025, 0.5, 0, 0.1, 0, sides=6, style='brass')
    S.box('arm', 0.04, 0.04, 0.16, 0, 0.6, 0.06, style='brass')
    S.prism('shade', 0.3, 0.26, 0.7, [0, 0.64, 0.14], sides=12, rot=[0, 90, 0], style='shade', front_scale=[0.9, 0.9], back_scale=[0.9, 0.9])
    S.box('glow', 0.6, 0.02, 0.16, 0, 0.53, 0.14, style='under')
    S.rod('chain', [0.16, 0.52, 0.2], [0.16, 0.3, 0.2], 0.008, sides=4, style='chain')
    S.cyl('bead', 0.022, 0.04, 0.16, 0.26, 0.2, sides=6, style='brass')
    return S


def bookshelf():
    """A tall bookcase crammed with books: four shelves, a leaning book, stacks, bookends, a jar and a tiny cactus.
    2.2 wide x 2.9 tall x 0.7 deep, back against z = -0.35."""
    S = Spec('bookshelf', density=40, tris=9000)
    S.styles(case=wood('walnut', 3.3, ph='wood_table_001'), shelf=wood('oak', 3.2),
             back=wood('deep', 3.4, worn=False, layers=[dict(op='stripes', id='boards', axis='x', period=0.36, width=0.05, shift=-1.4)]),
             brass=metal('brass', 3.6), jar=glaze('glass', 3.4), pot=glaze('terracotta', 3.0), cactus=leafy('fern', 3.2))
    spines = books_styles(S)
    W, H, D = 2.2, 2.9, 0.7
    S.box('sideL', 0.1, H, D, -W / 2 + 0.05, 0, 0, style='case', chamfer=0.015)
    S.box('sideR', 0.1, H, D, W / 2 - 0.05, 0, 0, style='case', chamfer=0.015)
    S.box('back', W - 0.2, H - 0.1, 0.04, 0, 0.05, -D / 2 + 0.04, style='back')
    S.box('crown', W + 0.16, 0.12, D + 0.1, 0, H, 0.02, style='case', chamfer=0.03)
    S.box('kick', W, 0.14, D, 0, 0, 0.0, style='case')
    shelves = [0.14, 0.82, 1.5, 2.18, 2.82]
    for y in shelves:
        S.box('shelf', W - 0.2, 0.05, D - 0.06, 0, y, 0.0, style='shelf', chamfer=0.01)
    rnd = random.Random(7)
    for si, y0 in enumerate(shelves[:-1]):
        y = y0 + 0.05
        top = shelves[si + 1] - 0.04
        x = -W / 2 + 0.12
        end = W / 2 - 0.12
        stop = end - (0.48 if si in (1, 3) else 0.0)
        lean_done = False
        while x < stop - 0.06:
            t = rnd.choice([0.07, 0.08, 0.1, 0.12, 0.14])
            h = min(top - y - 0.02, rnd.uniform(0.42, 0.6))
            d = rnd.uniform(0.38, 0.5)
            st = rnd.choice(spines)
            if not lean_done and x > -0.2 and rnd.random() < 0.25 and si != 0:
                S.box('lean', t, h, d, x + 0.12, y, 0.04, style=st, rot=[0, 0, 18])
                x += 0.3
                lean_done = True
                continue
            S.box('book', t, h, d, x + t / 2, y, 0.06 - (0.5 - d) / 2, style=st)
            x += t + 0.006
        if si in (1, 3):
            yy = y
            for k in range(3):
                h = rnd.choice([0.05, 0.06, 0.08])
                S.box('flat', 0.34 - k * 0.02, h, 0.4, end - 0.28 + rnd.uniform(-0.02, 0.02), yy, 0.05, style=rnd.choice(spines), rot=[0, rnd.uniform(-8, 8), 0])
                yy += h
            if si == 1:
                S.cyl('jar', 0.08, 0.2, end - 0.28, yy, 0.05, sides=8, style='jar')
                S.cyl('lid', 0.085, 0.03, end - 0.28, yy + 0.2, 0.05, sides=8, style='brass')
            else:
                S.cyl('pot', 0.08, 0.12, end - 0.28, yy, 0.05, sides=8, style='pot', back_scale=[0.85, 0.85])
                S.cyl('cactus', 0.05, 0.16, end - 0.28, yy + 0.12, 0.05, sides=6, style='cactus')
        else:
            S.box('bookend', 0.03, 0.26, 0.24, min(x + 0.03, end - 0.02), y, 0.06, style='brass')
    return S


DIGITS = {'I': ['#', '#', '#', '#', '#'], 'V': ['#.#', '#.#', '#.#', '#.#', '.#.'], 'X': ['#.#', '#.#', '.#.', '#.#', '#.#']}


def dial_art(n=56):
    """The clock dial as a stamp: hour batons, minute dots, roman XII, III, VI, IX and a little crescent."""
    g = [['.'] * n for _ in range(n)]
    c = (n - 1) / 2
    for k in range(60):
        a = k / 60 * math.tau
        big = k % 5 == 0
        for r in ([c - 2, c - 3, c - 4] if big else [c - 2]):
            x, y = round(c + math.sin(a) * r), round(c - math.cos(a) * r)
            g[y][x] = 'k' if big else 'g'

    def word(s, cx, cy):
        w = sum(len(DIGITS[ch][0]) for ch in s) + len(s) - 1
        x0 = int(cx - w / 2 + 0.5)
        for ch in s:
            d = DIGITS[ch]
            for yy, row in enumerate(d):
                for xx, v in enumerate(row):
                    if v == '#':
                        g[cy - 2 + yy][x0 + xx] = 'k'
            x0 += len(d[0]) + 1
    word('XII', c, 10)
    word('VI', c, n - 11)
    word('III', n - 11, int(c))
    word('IX', 11, int(c))
    for y in range(-3, 4):
        for x in range(-3, 4):
            if x * x + y * y <= 9 and (x - 1.6) ** 2 + (y + 0.6) ** 2 > 6:
                g[int(c + 10 + y)][int(c + x)] = 'm'
    return [''.join(r) for r in g]


def clock():
    """The wall clock: a round walnut case, brass bezel, cream dial, a carved crest and a pendulum box below.
    Hands (hand_h, hand_m) pivot at the dial centre; the pendulum pivots at (0, -0.74, 0.12). Origin: the dial centre."""
    S = Spec('clock', density=64)
    S.styles(case=wood('walnut', 3.3, ph='wood_table_001'), bezel=metal('brass', 3.8),
             dial=dict(ramp='cream', tone=3.6, brush={'off': True}, light=0.4, rim={'light_shift': 0.4, 'dark_shift': -0.6, 'outline': 'none'},
                       layers=[dict(op='noise', id='age', scale=0.15, amount=0.35)],
                       stamps=[{'face': 'front', 'at': 'center', 'art': dial_art(), 'key': {'k': 'ink:1', 'g': 'ink:3', 'm': 'ochre:3'}}]),
             hand=flat('ink', 1.2, light=0.3), glass=glaze('glass', 3.0), brass=metal('brass', 3.6), crest=wood('walnut', 3.5, ph='wood_table_001'))
    S.prism('case', 1.36, 1.36, 0.18, [0, 0, 0.09], sides=16, style='case')
    S.prism('bezel', 1.12, 1.12, 0.06, [0, 0, 0.21], sides=16, style='bezel')
    S.prism('dial', 0.98, 0.98, 0.03, [0, 0, 0.245], sides=16, style='dial')
    S.box('crestbase', 0.5, 0.12, 0.14, 0, 0.62, 0.08, style='crest', chamfer=0.03)
    S.prism('crestmoon', 0.26, 0.26, 0.08, [0, 0.86, 0.1], sides=8, style='bezel')
    for sx in (-1, 1):
        S.taper('leafc', [0.26, 0.08, 0.06], [sx * 0.24, 0.8, 0.1], rot=[0, 0, sx * 28], style='crest', front_scale=[1, 0.4], back_scale=[1, 0.4])
    S.box('pcase', 0.62, 0.96, 0.16, 0, -1.6, 0.06, style='case', chamfer=0.02)
    S.box('pglass', 0.42, 0.66, 0.02, 0, -1.48, 0.15, style='glass')
    S.box('ptop', 0.7, 0.06, 0.2, 0, -0.68, 0.08, style='case')
    S.box('pfoot', 0.7, 0.08, 0.2, 0, -1.68, 0.08, style='case')
    S.part('hand_h', 'box', [0.06, 0.3, 0.015], [0, 0, 0.27], offset=[0, 0.12, 0], style='hand', exact=True)
    S.part('hand_m', 'box', [0.04, 0.42, 0.015], [0, 0, 0.285], offset=[0, 0.18, 0], style='hand', exact=True)
    S.part('pin', 'prism', [0.06, 0.06, 0.03], [0, 0, 0.3], style='bezel', sides=6, exact=True)
    S.part('pendulum', 'box', [0.025, 0.56, 0.02], [0, -0.74, 0.12], offset=[0, -0.28, 0], style='brass', exact=True)
    S.part('bob', 'prism', [0.2, 0.2, 0.03], [0, -0.58, 0], parent='pendulum', style='bezel', sides=10, exact=True)
    return S


def ring(S, id, r, t, depth, cx, cy, z, n=16, style=None, **kw):
    """A polygonal ring of n slabs (frames for round windows, glasses) in the xy plane."""
    for k in range(n):
        a0, a1 = k / n * math.tau, (k + 1) / n * math.tau
        am = (a0 + a1) / 2
        L = 2 * (r + t / 2) * math.sin(math.pi / n) + t * 0.15
        S.cbox(id, [L, t, depth], [cx + math.sin(am) * r, cy + math.cos(am) * r, z], rot=[0, 0, -math.degrees(am)], style=style, **kw)


def window():
    """The round window: a chunky carved frame, a cross mullion with a brass latch, a deep sill with two little pots.
    Origin: the window centre, the wall plane at z = 0. Inner radius 0.94."""
    S = Spec('window', density=56)
    S.styles(frame=wood('walnut', 3.4, ph='wood_table_001'), inner=wood('oak', 3.1), sill=wood('oak', 3.4, scale=1.2),
             brass=metal('brass', 3.7), pot=glaze('terracotta', 3.2), pot2=glaze('lake', 3.0), soil=flat('soil', 2.0),
             succ=leafy('sage', 3.0), succ2=leafy('moss', 3.4))
    ring(S, 'frame', 1.06, 0.24, 0.26, 0, 0, 0.0, n=16, style='frame', chamfer=0.03)
    ring(S, 'inner', 0.95, 0.06, 0.3, 0, 0, -0.04, n=16, style='inner')
    S.cbox('mullV', [0.07, 1.9, 0.06], [0, 0, -0.02], style='frame')
    S.cbox('mullH', [1.9, 0.07, 0.06], [0, 0, -0.02], style='frame')
    S.cbox('latch', [0.12, 0.08, 0.04], [0.14, 0, 0.03], style='brass', chamfer=0.01)
    S.box('sill', 2.5, 0.1, 0.5, 0, -1.38, 0.16, style='sill', chamfer=0.02)
    for sx in (-1, 1):
        S.taper('bracket', [0.08, 0.28, 0.3], [sx * 0.9, -1.48, 0.08], style='frame', front_scale=[1, 0.2])
    S.cyl('pot', 0.13, 0.18, -0.85, -1.28, 0.2, sides=8, style='pot', back_scale=[0.8, 0.8])
    S.cyl('soil', 0.11, 0.02, -0.85, -1.11, 0.2, sides=8, style='soil')
    S.style('succ_leaf', dict(ramp='sage', brush={'off': True}, art_key=KEYS['succ']))
    for k in range(9):
        S.card('succ', leaf_art('succ', 9, 16, seed=70 + k), [-0.85, -1.1, 0.2], plane='xy', rot=[-(35 + (k % 3) * 15), k / 9 * 360, 0], offset=[0, 0.08, 0], style='succ_leaf', double_sided=True)
    S.cyl('pot2', 0.1, 0.14, 0.9, -1.28, 0.22, sides=8, style='pot2')
    S.cyl('cactus', 0.06, 0.2, 0.9, -1.14, 0.22, sides=6, style='succ2')
    S.cyl('cactus2', 0.035, 0.1, 0.97, -1.04, 0.22, sides=6, style='succ2', rot=[-90, 0, -30])
    return S


def curtains():
    """Velvet curtains either side of the window on a brass rod, gathered by tasselled tie-backs.
    Origin: the window centre at the wall."""
    S = Spec('curtains', density=40)
    S.styles(velvet=cloth('dusk', 3.2, ph='velour_velvet', scale=0.7, layers=[
        dict(op='stripes', id='folds', axis='x', period=0.16, width=0.45, wobble=0.3, shift=-1.0),
        dict(op='band', id='hem', axis='y', **{'from': -1.0, 'to': -0.93}, ramp='ochre', tone=3.2)]),
        rod=metal('brass', 3.7), tie=cloth('ochre', 3.4, ph='hessian_230'))
    S.rod('rod', [-1.75, 1.32, 0.3], [1.75, 1.32, 0.3], 0.035, sides=8, style='rod')
    for sx in (-1, 1):
        S.cyl('finial', 0.07, 0.12, sx * 1.8, 1.26, 0.3, sides=8, rot=[0, 0, 90], style='rod')
        x0 = sx * 1.32
        S.loft('panel', [([x0, 1.28, 0.3], [0.62, 0.12]), ([x0 + sx * 0.02, 0.6, 0.3], [0.56, 0.14]), ([x0 + sx * 0.18, -0.3, 0.32], [0.22, 0.16]),
                         ([x0 + sx * 0.12, -0.9, 0.3], [0.5, 0.12]), ([x0 + sx * 0.06, -1.45, 0.3], [0.62, 0.1])],
               sides=8, round=3.0, style='velvet', up=[0, 0, 1])
        S.cbox('tie', [0.3, 0.08, 0.22], [x0 + sx * 0.18, -0.3, 0.33], style='tie', chamfer=0.02)
        S.taper('tassel', [0.08, 0.08, 0.2], [x0 + sx * 0.3, -0.42, 0.42], style='tie', rot=[90, 0, 0], front_scale=[0.4, 0.4])
    return S


def corkboard():
    """A cork board of sleep notes: a moon-phase chart, a ruled sleep log, a sticky note, a polaroid of a sheep,
    a recipe for warm milk, pins and a red thread. 2.3 x 1.6; origin bottom centre, back on the wall."""
    S = Spec('corkboard', density=56)
    S.styles(frame=wood('walnut', 3.3, ph='wood_table_001'),
             cork=dict(ramp='cork', tone=3.3, brush={'flow': 'horizontal'}, rim={'light_shift': 0.5, 'dark_shift': -0.6, 'outline': 'none'},
                       layers=[dict(op='noise', id='grain', scale=0.06, amount=0.9), dict(op='spots', id='pores', count=320, radius=[0.012, 0.028], shift=-1.2),
                               dict(op='spots', id='flecks', count=180, radius=[0.01, 0.02], shift=1.0)]),
             note=paper('paper', 3.6, layers=[dict(op='stripes', id='rule', axis='y', period=0.06, width=0.14, shift=-1.0, faces=['front'], range=[-0.8, 0.6]),
                                              dict(op='band', id='head', axis='y', **{'from': 0.7, 'to': 0.82}, ramp='berry', tone=3.0, faces=['front'])]),
             log=paper('mist', 3.5, layers=[dict(op='stripes', id='rows', axis='y', period=0.07, width=0.12, shift=-1.4, faces=['front']),
                                            dict(op='stripes', id='cols', axis='x', period=0.09, width=0.1, shift=-1.4, faces=['front']),
                                            dict(op='spots', id='ticks', count=14, radius=[0.016, 0.026], ramp='dusk', tone=2.2, faces=['front'])]),
             sticky=paper('honey', 3.8, layers=[dict(op='stripes', id='scrawl', axis='y', period=0.05, width=0.2, wobble=0.8, shift=-1.4, faces=['front'], range=[-0.6, 0.5])]),
             moons=paper('night', 2.6, layers=[dict(op='spots', id='phase', centers=[[-0.22, 0.08, 0, 0.04], [-0.075, 0.08, 0, 0.04], [0.075, 0.08, 0, 0.04], [0.22, 0.08, 0, 0.04],
                                                                                     [-0.22, -0.09, 0, 0.04], [-0.075, -0.09, 0, 0.04], [0.075, -0.09, 0, 0.04], [0.22, -0.09, 0, 0.04]],
                                                       ramp='lamp', tone=3.8, faces=['front'], bevel=True),
                                              dict(op='spots', id='stars', count=18, radius=[0.008, 0.012], ramp='cream', tone=4.0, faces=['front'])]),
             photo=paper('cream', 4.0, layers=[dict(op='rect', id='pic', rect=[0.1, 0.25, 0.9, 0.92], ramp='sage', tone=3.0, faces=['front']),
                                               dict(op='rect', id='sky', rect=[0.1, 0.6, 0.9, 0.92], ramp='mist', tone=3.4, faces=['front']),
                                               dict(op='spots', id='sheep', centers=[[0.0, -0.03, 0, 0.08]], ramp='snow', tone=3.8, faces=['front'], bevel=True),
                                               dict(op='spots', id='head', centers=[[0.09, -0.01, 0, 0.035]], ramp='soot', tone=2.0, faces=['front'])]),
             recipe=paper('rose', 3.6, layers=[dict(op='stripes', id='rule', axis='y', period=0.06, width=0.18, wobble=0.5, shift=-1.4, faces=['front'], range=[-0.8, 0.4])]),
             pinR=glaze('berry', 3.4), pinB=glaze('dusk', 3.6), pinG=glaze('moss', 3.6), pinY=glaze('honey', 3.8),
             thread=flat('berry', 2.8))
    W, H = 2.3, 1.6
    S.box('cork', W, H, 0.06, 0, 0, 0.03, style='cork')
    for y in (0, H):
        S.cbox('frameH', [W + 0.16, 0.1, 0.1], [0, y, 0.06], style='frame', chamfer=0.02)
    for x in (-W / 2, W / 2):
        S.cbox('frameV', [0.1, H + 0.06, 0.1], [x, H / 2, 0.06], style='frame', chamfer=0.02)
    notes = [('note', -0.66, 1.06, 0.5, 0.56, -5, 'pinR'), ('moons', 0.06, 1.1, 0.62, 0.42, 3, 'pinB'), ('log', 0.7, 0.98, 0.56, 0.62, -3, 'pinG'),
             ('sticky', -0.78, 0.44, 0.38, 0.38, 7, 'pinY'), ('photo', -0.16, 0.46, 0.42, 0.48, -7, 'pinR'), ('recipe', 0.54, 0.38, 0.5, 0.5, 4, 'pinB')]
    pins = []
    for i, (st, x, y, w, h, r, pin) in enumerate(notes):
        S.cbox('n_' + st, [w, h, 0.012], [x, y, 0.07 + i * 0.002], rot=[0, 0, r], style=st)
        px, py = x - math.sin(math.radians(r)) * h * 0.4, y + math.cos(math.radians(r)) * h * 0.4
        S.prism('pin', 0.05, 0.05, 0.05, [px, py, 0.1], sides=6, style=pin)
        pins.append((px, py))
    S.rod('thread', [pins[0][0], pins[0][1], 0.11], [pins[1][0], pins[1][1], 0.11], 0.006, sides=4, style='thread')
    S.rod('thread', [pins[1][0], pins[1][1], 0.11], [pins[4][0], pins[4][1], 0.11], 0.006, sides=4, style='thread')
    return S


def rug():
    """A hand-woven rug: an oat field with a sage lattice, a berry border, a dusk medallion and fringe. 3.8 x 2.8."""
    S = Spec('rug', density=40)
    weave = photo('hessian_230', scale=0.5, amount=0.8, id='weave')
    S.style('rug', dict(ramp='oat', tone=3.3, brush={'flow': 'horizontal'}, rim={'light_shift': 0.3, 'dark_shift': -0.8, 'outline': 'none'}, layers=[
        weave,
        dict(op='rect', id='b1', rect=[0.0, 0.0, 1.0, 1.0], ramp='berry', tone=3.0, faces=['top']),
        dict(op='rect', id='b2', rect=[0.05, 0.07, 0.95, 0.93], ramp='ochre', tone=3.4, faces=['top']),
        dict(op='rect', id='b3', rect=[0.07, 0.1, 0.93, 0.9], ramp='berry', tone=2.6, faces=['top']),
        dict(op='rect', id='field', rect=[0.1, 0.14, 0.9, 0.86], ramp='oat', tone=3.4, faces=['top']),
        dict(op='stripes', id='lat1', axis=[1, 0, 1], period=0.38, width=0.12, ramp='sage', tone=3.0, faces=['top']),
        dict(op='stripes', id='lat2', axis=[1, 0, -1], period=0.38, width=0.12, ramp='sage', tone=3.0, faces=['top']),
        dict(op='rect', id='m1', rect=[0.4, 0.36, 0.6, 0.64], ramp='dusk', tone=3.0, faces=['top'], bevel=True),
        dict(op='rect', id='m2', rect=[0.45, 0.43, 0.55, 0.57], ramp='ochre', tone=3.6, faces=['top']),
        dict(op='noise', id='wear', scale=0.4, amount=0.5),
        dict(weave, id='weave2'),
    ]))
    S.style('fringe', flat('oat', 3.6))
    S.box('rug', 3.8, 0.03, 2.8, 0, 0, 0, style='rug')
    for sx in (-1, 1):
        for k in range(17):
            S.cbox('tassel', [0.18, 0.01, 0.04], [sx * 1.98, 0.008, -1.3 + k * (2.6 / 16)], style='fringe', rot=[0, (k % 3 - 1) * 8, 0])
    return S


def frond_art(n=24, seed=1):
    rnd = random.Random(seed)
    g = [['.'] * 9 for _ in range(n)]
    for y in range(n):
        g[y][4] = 's'
        w = int(4 * math.sin(math.pi * (y + 2) / (n + 2)))
        if y % 2 == 0:
            for x in range(1, w + 1):
                g[y][4 - x] = 'L' if x < w else 'l'
                g[min(n - 1, y + (1 if x > 2 else 0))][4 + x] = 'L' if rnd.random() < 0.7 else 'l'
    return [''.join(r) for r in g][::-1]


def fern():
    """A big potted fern in a glazed terracotta pot. ~1.3 tall."""
    S = Spec('fern', density=48)
    S.styles(pot=glaze('terracotta', 3.2, layers=[dict(op='band', id='rim', axis='z', **{'from': 0.6, 'to': 1.0}, shift=0.8),
                                                   dict(op='band', id='glz', axis='z', **{'from': -0.2, 'to': 0.2}, ramp='lake', tone=3.0)]),
             soil=flat('soil', 2.2, layers=[dict(op='noise', id='lumps', scale=0.05, amount=1.0)]),
             frond=dict(ramp='fern', brush={'off': True}, art_key={'s': 'pine:2', 'L': 'fern:4', 'l': 'moss:4'}))
    S.cyl('pot', 0.34, 0.5, 0, 0, 0, sides=10, style='pot', back_scale=[0.78, 0.78])
    S.cyl('lip', 0.37, 0.08, 0, 0.46, 0, sides=10, style='pot')
    S.cyl('soil', 0.32, 0.02, 0, 0.5, 0, sides=10, style='soil')
    rnd = random.Random(3)
    for k in range(11):
        S.card('frond', frond_art(26, k), [0, 0.52, 0], plane='xy', rot=[-rnd.uniform(30, 62), k / 11 * 360 + rnd.uniform(-12, 12), 0], offset=[0, 0.28, 0],
               style='frond', double_sided=True)
    return S


def ivy():
    """Hanging ivy: strands of leaf cards dropping from the ceiling. Origin at the top."""
    S = Spec('ivy', density=48)
    leaves = [leaf_art('ivy', 13, 14, seed=k, bend=(k % 3 - 1) * 0.3) for k in range(8)]
    S.style('leaf', dict(ramp='leaf', brush={'off': True}, art_key=KEYS['ivy']))
    S.style('leaf2', dict(ramp='leaf', brush={'off': True}, art_key=KEYS['pothos']))
    S.style('vine', flat('pine', 2.4))
    rnd = random.Random(5)
    for s in range(6):
        x = (s - 2.5) * 0.18 + rnd.uniform(-0.05, 0.05)
        z = rnd.uniform(-0.12, 0.12)
        L = rnd.uniform(0.8, 1.9)
        S.rod('vine', [x, 0, z], [x + rnd.uniform(-0.1, 0.1), -L, z], 0.01, sides=4, style='vine')
        y = -0.08
        while y > -L:
            S.card('leaf', rnd.choice(leaves), [x + rnd.uniform(-0.04, 0.04), y, z], plane='xy', rot=[rnd.uniform(-30, 30), rnd.uniform(0, 360), rnd.uniform(150, 210)],
                   style=rnd.choice(['leaf', 'leaf', 'leaf2']), double_sided=True)
            y -= rnd.uniform(0.09, 0.15)
    return S


def teacup():
    """A teacup of chamomile on its saucer, with a teaspoon."""
    S = Spec('teacup', density=96)
    S.styles(china=glaze('cream', 3.8, layers=[dict(op='band', id='trim', axis='z', **{'from': 0.6, 'to': 0.85}, ramp='sage', tone=3.0)]),
             tea=flat('honey', 3.0), spoon=metal('steel', 3.6))
    S.cyl('saucer', 0.2, 0.03, 0, 0, 0, sides=12, style='china', back_scale=[0.8, 0.8])
    S.cyl('cup', 0.13, 0.15, 0, 0.03, 0, sides=12, style='china', back_scale=[0.72, 0.72])
    S.cyl('tea', 0.115, 0.01, 0, 0.165, 0, sides=12, style='tea')
    S.cbox('handle', [0.03, 0.09, 0.07], [0.15, 0.11, 0], style='china', chamfer=0.008)
    S.rod('spoon', [-0.05, 0.035, 0.12], [-0.2, 0.04, 0.02], 0.008, sides=4, style='spoon')
    return S


def papers():
    """A messy pile of paper: a stack, a sheet of notes on top and an envelope with a wax seal."""
    S = Spec('papers', density=72)
    S.styles(stack=paper('paper', 3.4, layers=[dict(op='stripes', id='edges', axis='y', period=0.012, width=0.35, shift=-1.0, faces=['sides'])]),
             top=paper('paper', 3.8, layers=[dict(op='stripes', id='hand', axis='z', period=0.05, width=0.22, wobble=0.9, ramp='graphite', tone=2.6, faces=['top'], range=[-0.7, 0.6]),
                                              dict(op='band', id='margin', axis='x', **{'from': -0.75, 'to': -0.72}, ramp='berry', tone=3.2, faces=['top'])]),
             env=paper('oat', 3.5, layers=[dict(op='stripes', id='flap', axis=[1, 0, 1], period=0.8, width=0.02, shift=-1.3, faces=['top'])]),
             seal=glaze('berry', 3.0))
    S.box('stack', 0.62, 0.08, 0.84, 0, 0, 0, style='stack', rot=[0, 4, 0])
    S.box('sheet', 0.6, 0.006, 0.82, 0.03, 0.08, 0.02, style='top', rot=[0, -7, 0])
    S.box('env', 0.5, 0.012, 0.34, -0.2, 0.09, 0.3, style='env', rot=[0, 22, 0])
    S.cyl('seal', 0.04, 0.01, -0.2, 0.1, 0.3, sides=8, style='seal')
    return S


def inkwell():
    """A faceted glass inkwell with a brass collar and a long quill."""
    S = Spec('inkwell', density=96)
    S.styles(glass=glaze('night', 3.0), brass=metal('brass', 3.7), shaft=flat('cream', 3.4),
             vane=dict(ramp='snow', tone=3.5, brush={'flow': 'long'}, rim={'light_shift': 0.6, 'dark_shift': -0.8, 'outline': 'none'},
                       layers=[dict(op='stripes', id='barbs', axis=[1, 1, 0], period=0.02, width=0.3, shift=-0.8),
                               dict(op='band', id='tip', axis='y', **{'from': -1, 'to': -0.7}, ramp='ink', tone=2.0)]))
    S.cyl('pot', 0.13, 0.12, 0, 0, 0, sides=8, style='glass')
    S.cyl('neck', 0.07, 0.04, 0, 0.12, 0, sides=8, style='glass')
    S.cyl('collar', 0.08, 0.025, 0, 0.16, 0, sides=8, style='brass')
    S.rod('shaft', [0.0, 0.1, 0.0], [0.2, 0.72, -0.06], 0.008, sides=4, style='shaft')
    S.taper('vane', [0.1, 0.46, 0.012], [0.13, 0.5, -0.04], rot=[0, 0, -18], style='vane', front_scale=[0.5, 1], back_scale=[0.5, 1])
    return S


def books_stack():
    """Four books lying in a slightly skewed stack."""
    S = Spec('books_stack', density=64)
    st = books_styles(S, upright=False, prefix='fb')
    rnd = random.Random(11)
    y = 0
    for k in range(4):
        h = rnd.choice([0.08, 0.1, 0.12])
        S.box('book', 0.7 - k * 0.04, h, 0.52 - k * 0.02, rnd.uniform(-0.03, 0.03), y, 0, style=st[(k * 5 + 2) % len(st)], rot=[0, rnd.uniform(-14, 14), 0])
        y += h
    return S


def books_row():
    """Six books standing against a brass bookend, the last one leaning."""
    S = Spec('books_row', density=64)
    st = books_styles(S)
    S.style('brass', metal('brass', 3.7))
    rnd = random.Random(4)
    x = 0
    S.box('end', 0.04, 0.34, 0.3, -0.03, 0, 0, style='brass')
    S.box('endfoot', 0.18, 0.02, 0.3, 0.06, 0, 0, style='brass')
    for k in range(6):
        t = rnd.choice([0.08, 0.1, 0.12, 0.14])
        h = rnd.uniform(0.44, 0.58)
        if k == 5:
            S.box('book', t, h, 0.4, x + 0.1, 0, 0, style=st[(k * 3) % len(st)], rot=[0, 0, -20])
        else:
            S.box('book', t, h, 0.4, x + t / 2, 0, 0, style=st[(k * 3) % len(st)])
        x += t + 0.008
    return S


def candle():
    """A beeswax candle in a brass chamberstick, wax drips and a flame (part `flame`)."""
    S = Spec('candle', density=96)
    S.styles(brass=metal('brass', 3.7), wax=glaze('cream', 3.6, layers=[dict(op='spots', id='drip', count=6, radius=[0.01, 0.02], stretch=[1, 1, 3], shift=0.8)]),
             flame=glow('glow', 3.8), wick=flat('ink', 1.0))
    S.cyl('dish', 0.15, 0.025, 0, 0, 0, sides=10, style='brass', back_scale=[0.9, 0.9])
    S.cyl('cup', 0.06, 0.05, 0, 0.025, 0, sides=8, style='brass')
    S.cbox('handle', [0.03, 0.06, 0.1], [0.16, 0.05, 0], style='brass')
    S.cyl('wax', 0.045, 0.26, 0, 0.07, 0, sides=8, style='wax')
    S.cyl('wick', 0.006, 0.03, 0, 0.33, 0, sides=4, style='wick')
    S.part('flame', 'taper', [0.05, 0.05, 0.1], [0, 0.36, 0], offset=[0, 0, 0.04], rot=[-90, 0, 0], style='flame', front_scale=[0.1, 0.1], exact=True)
    return S


def nameplate():
    """A walnut name block with a brass plate (the game paints the name on a plane over the plate)."""
    S = Spec('nameplate', density=80)
    S.styles(wood=wood('walnut', 3.3, ph='wood_table_001'), brass=metal('brass', 3.4, layers=[dict(op='panel', id='edge', inset=2, shift=1.2, highlight=1, shadow=1)]))
    S.box('base', 1.38, 0.08, 0.32, 0, 0, 0, style='wood', chamfer=0.015)
    S.cbox('face', [1.32, 0.22, 0.06], [0, 0.17, 0.04], rot=[-20, 0, 0], style='brass')
    S.cbox('back', [1.32, 0.2, 0.08], [0, 0.15, -0.04], rot=[-20, 0, 0], style='wood')
    return S


def lantern():
    """A hanging lantern: a brass cage, warm glass (part `glass`) and a ring. Origin at the hook (top)."""
    S = Spec('lantern', density=72)
    S.styles(brass=metal('brass', 3.4), glass=glow('glow', 3.4), iron=metal('iron', 3.2))
    S.rod('chain', [0, 0, 0], [0, -0.5, 0], 0.012, sides=4, style='iron')
    S.prism('ring', 0.12, 0.12, 0.03, [0, -0.52, 0], sides=8, style='brass')
    S.cyl('cap', 0.2, 0.08, 0, -0.68, 0, sides=8, style='brass', front_scale=[0.5, 0.5])
    S.cyl('top', 0.22, 0.04, 0, -0.72, 0, sides=8, style='brass')
    S.part('glass', 'prism', [0.32, 0.32, 0.34], [0, -0.9, 0], sides=8, rot=[-90, 0, 0], style='glass', exact=True)
    for k in range(4):
        a = k / 4 * math.tau + math.pi / 4
        S.cbox('bar', [0.03, 0.36, 0.03], [math.sin(a) * 0.17, -0.9, math.cos(a) * 0.17], style='brass')
    S.cyl('base', 0.2, 0.05, 0, -1.11, 0, sides=8, style='brass')
    S.cyl('foot', 0.08, 0.04, 0, -1.15, 0, sides=8, style='brass')
    return S


def wallshelf():
    """A small wall shelf on carved brackets: herb jars, a honey pot and a trailing pothos. Origin: back, bottom centre."""
    S = Spec('wallshelf', density=64)
    S.styles(plank=wood('oak', 3.4), bracket=wood('walnut', 3.2, ph='wood_table_001'), jar=glaze('glass', 3.6), jar2=glaze('mist', 3.4),
             herb=leafy('sage', 3.0), herb2=leafy('moss', 3.2), cork=flat('cork', 3.4), honey=glaze('honey', 3.4), pot=glaze('clay', 3.0),
             leaf=dict(ramp='leaf', brush={'off': True}, art_key=KEYS['pothos']))
    S.box('plank', 1.5, 0.06, 0.36, 0, 0, 0.18, style='plank', chamfer=0.012)
    for sx in (-1, 1):
        S.taper('bracket', [0.06, 0.26, 0.3], [sx * 0.56, -0.14, 0.15], style='bracket', front_scale=[1, 0.25])
    for x, st, h, herb in ((-0.5, 'jar', 0.26, 'herb'), (-0.24, 'jar2', 0.2, 'herb2')):
        S.cyl('jar', 0.09, h, x, 0.06, 0.18, sides=8, style=st)
        S.cyl('fill', 0.075, h * 0.6, x, 0.07, 0.18, sides=8, style=herb)
        S.cyl('cork', 0.07, 0.05, x, 0.06 + h, 0.18, sides=8, style='cork')
    S.cyl('honey', 0.1, 0.16, 0.06, 0.06, 0.18, sides=8, style='honey', back_scale=[0.85, 0.85])
    S.cyl('honeylid', 0.08, 0.04, 0.06, 0.22, 0.18, sides=8, style='cork')
    S.cyl('pot', 0.11, 0.14, 0.46, 0.06, 0.18, sides=8, style='pot', back_scale=[0.85, 0.85])
    leaves = [leaf_art('pothos', 11, 12, seed=40 + k) for k in range(6)]
    rnd = random.Random(2)
    for k in range(14):
        y = 0.24 - k * 0.07 if k > 4 else 0.24 + rnd.uniform(-0.02, 0.06)
        x = 0.46 + rnd.uniform(-0.12, 0.14) + (0.1 if k > 4 else 0)
        S.card('leaf', rnd.choice(leaves), [x, y, 0.3], rot=[rnd.uniform(-20, 20), rnd.uniform(0, 360), 180 if k > 4 else 0], style='leaf', double_sided=True)
    return S


def painting():
    """A framed painting of the Hollow at night: moon, stars, rolling hills and the old oak. Origin: bottom centre."""
    S = Spec('painting', density=80)
    S.styles(frame=metal('brass', 3.2, layers=[dict(op='panel', id='bead', inset=2, shift=1.2, highlight=1, shadow=1)]),
             canvas=dict(ramp='night', tone=3.0, brush={'flow': 'horizontal', 'rough': 0.8}, light=0.3, rim={'light_shift': 0, 'dark_shift': 0, 'outline': 'none'},
                         layers=[dict(op='gradient', id='sky', axis='y', amount=1.6),
                                 dict(op='spots', id='stars', count=40, radius=[0.008, 0.016], ramp='lamp', tone=4.2, faces=['front'], where={'y': [0.0, 1.0]}),
                                 dict(op='spots', id='moon', centers=[[0.28, 0.2, 0.02, 0.08]], ramp='lamp', tone=3.8, faces=['front'], bevel=True),
                                 dict(op='band', id='hill', axis='y', **{'from': -1, 'to': -0.25}, wobble=0.6, wobble_scale=0.8, ramp='pine', tone=2.6),
                                 dict(op='band', id='hill2', axis='y', **{'from': -1, 'to': -0.55}, wobble=0.5, wobble_scale=0.5, ramp='leaf', tone=2.8),
                                 dict(op='spots', id='tree', centers=[[-0.24, -0.04, 0.02, 0.12]], ramp='pine', tone=2.2, faces=['front']),
                                 dict(op='rect', id='trunk', rect=[0.24, 0.2, 0.31, 0.5], ramp='bark', tone=2.4, faces=['front']),
                                 dict(op='spots', id='window', centers=[[-0.22, -0.13, 0.02, 0.018]], ramp='glow', tone=3.6, faces=['front'])]))
    S.box('canvas', 1.05, 0.78, 0.04, 0, 0.08, 0.02, style='canvas')
    for y in (0.04, 0.9):
        S.cbox('fh', [1.3, 0.12, 0.08], [0, y, 0.05], style='frame', chamfer=0.02)
    for x in (-0.59, 0.59):
        S.cbox('fv', [0.12, 0.98, 0.08], [x, 0.47, 0.05], style='frame', chamfer=0.02)
    return S


def globe():
    """A floor-standing globe: tripod legs, a brass meridian and a painted world (calm seas, mossy lands)."""
    S = Spec('globe', density=56)
    S.styles(wood=wood('walnut', 3.3, ph='wood_table_001'), brass=metal('brass', 3.7),
             world=dict(ramp='lake', tone=3.4, brush={'flow': 'horizontal'}, rim={'light_shift': 0.4, 'dark_shift': -0.6, 'outline': 'none'},
                        layers=[dict(op='stripes', id='lat', axis='y', period=0.12, width=0.05, shift=-0.7),
                                dict(op='patches', id='land', scale=0.32, threshold=0.55, ramp='sage', tone=3.2, bevel=True),
                                dict(op='patches', id='hills', scale=0.16, threshold=0.75, ramp='ochre', tone=3.2),
                                dict(op='band', id='ice', axis='y', **{'from': 0.82, 'to': 1.0}, ramp='snow', tone=3.6)]))
    R, cy = 0.36, 1.15
    rings = []
    for k in range(9):
        a = -math.pi / 2 + k / 8 * math.pi
        rings.append(([0, cy + math.sin(a) * R, 0], max(0.002, math.cos(a) * 2 * R)))
    S.loft('world', rings, sides=12, round=2.0, style='world', caps=[False, False], up=[0, 0, 1])
    for k in range(10):
        a0, a1 = -0.4 + k / 10 * (math.pi + 0.8), -0.4 + (k + 1) / 10 * (math.pi + 0.8)
        S.rod('meridian', [math.cos(a0) * (R + 0.05), cy + math.sin(a0) * (R + 0.05), 0], [math.cos(a1) * (R + 0.05), cy + math.sin(a1) * (R + 0.05), 0], 0.018, sides=4, style='brass')
    S.cyl('collar', 0.07, 0.08, 0, 0.7, 0, sides=8, style='brass')
    S.cyl('post', 0.05, 0.6, 0, 0.12, 0, sides=8, style='wood')
    for k in range(3):
        a = k / 3 * math.tau
        S.rod('leg', [0, 0.3, 0], [math.sin(a) * 0.42, 0.0, math.cos(a) * 0.42], 0.035, sides=6, style='wood')
        S.cyl('toe', 0.05, 0.04, math.sin(a) * 0.42, 0, math.cos(a) * 0.42, sides=6, style='brass')
    return S


def glasses():
    """Pip's round reading glasses (thin brass wire). Lens centres at x = +-0.2, radius 0.15; origin between the
    lenses, the arms run back along -z."""
    S = Spec('glasses', density=160, light=dict(dir=[-0.45, 1, 0.6], strength=0.3, gradient=0.1, ao=0.0, ao_height=0.1))
    S.styles(wire=metal('brass', 4.0))
    for sx in (-1, 1):
        ring(S, 'rim', 0.15, 0.022, 0.022, sx * 0.2, 0, 0.0, n=12, style='wire')
        S.cbox('arm', [0.018, 0.018, 0.34], [sx * 0.36, 0.03, -0.17], style='wire')
    S.cbox('bridge', [0.12, 0.02, 0.02], [0, 0.04, 0], style='wire')
    return S


def clipboard_small():
    """Pip's own little clipboard (held against his chest)."""
    S = Spec('clipboard_small', density=120)
    S.styles(board=wood('oak', 3.0, scale=0.5),
             paper=paper('paper', 3.8, layers=[dict(op='stripes', id='rule', axis='y', period=0.05, width=0.15, ramp='dusk', tone=3.2, faces=['front'], range=[-0.8, 0.6]),
                                               dict(op='stripes', id='tick', axis='y', period=0.1, width=0.4, wobble=0.9, ramp='graphite', tone=2.4, faces=['front'], range=[-0.6, 0.5])]),
             clip=metal('steel', 3.6))
    S.cbox('board', [0.56, 0.74, 0.04], [0, 0, 0], style='board', chamfer=0.01)
    S.cbox('paper', [0.48, 0.62, 0.01], [0, -0.03, 0.025], style='paper')
    S.cbox('clip', [0.24, 0.08, 0.04], [0, 0.33, 0.04], style='clip', chamfer=0.01)
    return S


def specs():
    # desk, chair, lamp, bookshelf, fern and lantern are borrowed now (borrow.py); their specs stay as references
    return {f.__name__: f() for f in (desk_drawer, clock, window, curtains, corkboard, rug, ivy, teacup, papers, inkwell, books_stack, books_row,
                                      candle, nameplate, wallshelf, painting, globe, glasses, clipboard_small)}
