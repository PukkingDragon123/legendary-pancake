"""The props that pop into the office while Pip acts out your answers: a bed and pillows, a sheep and its fence,
a phone, a microphone, mugs, milk and a teapot, a radio, a music box, a little stove, an open book, a sunflower."""
import math
import random

from _kit import Spec, wood, metal, cloth, flat, glaze, paper, leafy, glow, photo


def bed():
    """A cosy wooden bed: carved headboard with a moon cut-out, a patchwork quilt folded back over a linen sheet.
    2.0 wide x 2.8 long, headboard at -z; mattress top at y = 0.6. Origin: floor, centre."""
    S = Spec('bed', density=36)
    S.styles(frame=wood('walnut', 3.4, ph='wood_table_001'), slats=wood('oak', 3.2),
             mattress=cloth('linen', 3.6, ph='rough_linen', layers=[dict(op='stripes', id='tick', axis='x', period=0.2, width=0.12, shift=-0.6, faces=['sides'])]),
             quilt=cloth('sage', 3.0, ph='knitted_fleece', scale=0.5, layers=[
                 dict(op='stripes', id='p1', axis='x', period=0.5, width=0.5, ramp='rose', tone=3.0, faces=['top', 'sides']),
                 dict(op='stripes', id='p2', axis='z', period=0.5, width=0.5, shift=0.8, faces=['top']),
                 dict(op='stripes', id='seamx', axis='x', period=0.25, width=0.06, shift=-1.2),
                 dict(op='stripes', id='seamz', axis='z', period=0.25, width=0.06, shift=-1.2, faces=['top']),
                 dict(op='spots', id='knots', count=40, radius=[0.02, 0.03], ramp='ochre', tone=3.6, faces=['top'])]),
             sheet=cloth('cream', 3.8, ph='rough_linen', layers=[dict(op='band', id='hem', axis='z', **{'from': 0.7, 'to': 0.85}, ramp='dusk', tone=3.0, faces=['top'])]),
             brass=metal('brass', 3.7),
             crest=wood('walnut', 3.4, ph='wood_table_001', layers=[dict(op='spots', id='moon', centers=[[0, 0.0, 0.06, 0.18]], ramp='lamp', tone=3.4, faces=['front'], bevel=True),
                                                                   dict(op='spots', id='bite', centers=[[0.08, 0.05, 0.06, 0.15]], ramp='walnut', tone=3.4, faces=['front'])]))
    W, L = 2.0, 2.8
    # frame rails and mattress
    for sx in (-1, 1):
        S.box('rail', 0.1, 0.22, L, sx * (W / 2 - 0.05), 0.2, 0, style='frame', chamfer=0.02)
    S.box('mattress', W - 0.16, 0.26, L - 0.2, 0, 0.32, 0, style='mattress', chamfer=0.05)
    # headboard: two posts with brass knobs, a panel of slats and the moon crest
    for sx in (-1, 1):
        S.box('post', 0.16, 1.45, 0.16, sx * (W / 2 - 0.02), 0, -L / 2, style='frame', chamfer=0.03)
        S.cyl('knob', 0.1, 0.12, sx * (W / 2 - 0.02), 1.45, -L / 2, sides=8, style='brass')
        S.box('fpost', 0.14, 0.86, 0.14, sx * (W / 2 - 0.02), 0, L / 2, style='frame', chamfer=0.03)
        S.cyl('fknob', 0.08, 0.1, sx * (W / 2 - 0.02), 0.86, L / 2, sides=8, style='brass')
    for k in range(7):
        S.box('slat', 0.12, 0.7, 0.06, -0.72 + k * 0.24, 0.5, -L / 2, style='slats')
    S.box('hrail', W, 0.12, 0.1, 0, 1.2, -L / 2, style='frame', chamfer=0.02)
    S.box('hlow', W, 0.1, 0.1, 0, 0.42, -L / 2, style='frame')
    S.box('crest', 0.9, 0.36, 0.1, 0, 1.3, -L / 2, style='crest', chamfer=0.04)
    S.box('fboard', W, 0.42, 0.08, 0, 0.32, L / 2, style='slats', chamfer=0.02)
    # bedding: the sheet over the top of the mattress and the quilt folded back
    S.box('sheet', W - 0.1, 0.06, 1.0, 0, 0.56, -0.86, style='sheet', chamfer=0.02)
    S.box('quilt', W - 0.04, 0.1, 1.95, 0, 0.55, 0.38, style='quilt', chamfer=0.04)
    S.box('fold', W - 0.06, 0.08, 0.3, 0, 0.62, -0.5, style='sheet', chamfer=0.03)
    for sx in (-1, 1):
        S.box('drape', 0.06, 0.3, 1.95, sx * (W / 2 + 0.0), 0.32, 0.38, style='quilt')
    return S


def pillow():
    """A plump pillow (cream; the game tints it). 1.0 x 0.26 x 0.6, origin bottom centre."""
    S = Spec('pillow', density=56)
    S.style('pillow', cloth('snow', 3.6, ph='rough_linen', layers=[dict(op='stripes', id='seam', axis='z', period=0.6, width=0.04, shift=-1.4, phase=0.5),
                                                                   dict(op='stripes', id='seam2', axis='x', period=1.0, width=0.03, shift=-1.2, phase=0.5)]))
    S.loft('pillow', [([-0.5, 0.12, 0], [0.12, 0.48]), ([-0.4, 0.13, 0], [0.22, 0.58]), ([0, 0.14, 0], [0.27, 0.62]),
                      ([0.4, 0.13, 0], [0.22, 0.58]), ([0.5, 0.12, 0], [0.12, 0.48])], sides=10, round=2.2, style='pillow')
    return S


def sheep():
    """A woolly sheep: a curly cloud of a body, a soot face with sleepy eyes, floppy ears and little legs. Faces +z.
    ~0.85 long, 0.8 tall."""
    S = Spec('sheep', density=56)
    S.styles(wool=dict(ramp='snow', tone=3.6, brush={'flow': 'horizontal', 'rough': 0.8}, rim={'light_shift': 0.6, 'dark_shift': -0.9, 'outline': 'none'},
                       layers=[dict(op='spots', id='curls', count=120, radius=[0.03, 0.05], shift=-0.9, bevel=True), dict(op='noise', id='fluff', scale=0.08, amount=0.6),
                               photo('knitted_fleece', scale=0.4, amount=0.5, id='fleece')]),
             face=dict(ramp='soot', tone=2.6, brush={'flow': 'long'}, rim={'light_shift': 1.0, 'dark_shift': -0.6, 'outline': 'none'},
                       layers=[dict(op='noise', id='n', scale=0.1, amount=0.4)],
                       stamps=[{'face': 'front', 'at': [3, 5], 'art': ['kk..kk', '......', '..nn..'], 'key': {'k': 'ink:0', 'n': 'rose:2'}}]),
             ear=flat('soot', 2.4), leg=flat('soot', 2.2), hoof=flat('ink', 1.2), blush=flat('rose', 3.0))
    S.loft('body', [([0, 0.48, -0.42], [0.36, 0.34]), ([0, 0.52, -0.25], [0.6, 0.56]), ([0, 0.53, 0.05], [0.66, 0.6]),
                    ([0, 0.52, 0.28], [0.56, 0.54]), ([0, 0.5, 0.4], [0.3, 0.3])], sides=10, round=2.2, style='wool')
    S.loft('topknot', [([0, 0.78, 0.22], [0.2, 0.2]), ([0, 0.84, 0.3], [0.24, 0.22]), ([0, 0.8, 0.38], [0.16, 0.14])], sides=8, round=2.2, style='wool')
    S.taper('head', [0.24, 0.28, 0.3], [0, 0.62, 0.46], rot=[-15, 0, 0], style='face', front_scale=[0.8, 0.75], chamfer=0.04)
    for sx in (-1, 1):
        S.taper('ear', [0.16, 0.05, 0.08], [sx * 0.16, 0.7, 0.4], rot=[0, 0, sx * -25], style='ear', front_scale=[0.4, 0.6], offset=[sx * 0.06, 0, 0])
        for z in (-0.22, 0.22):
            S.box('leg', 0.08, 0.3, 0.08, sx * 0.16, 0.04, z, style='leg')
            S.box('hoof', 0.09, 0.05, 0.09, sx * 0.16, 0.0, z, style='hoof')
    S.loft('tail', [([0, 0.56, -0.44], [0.12, 0.12]), ([0, 0.58, -0.52], [0.1, 0.1])], sides=6, style='wool')
    return S


def fence():
    """A rustic split-rail stile for the sheep to hop, moss on the posts. 1.4 wide x 0.8 tall, along x."""
    S = Spec('fence', density=48)
    S.styles(post=wood('oakpale', 3.2, ph='weathered_planks', scale=0.8, layers=[dict(op='drip', id='moss', ramp='moss', tone=3.2, depth=0.08, length=0.15)]),
             rail=wood('oakpale', 3.4, ph='weathered_planks', scale=0.8), grass=leafy('moss', 3.2))
    for sx in (-1, 1):
        S.box('post', 0.14, 0.82, 0.14, sx * 0.62, 0, 0, style='post', chamfer=0.03)
        S.taper('cap', [0.14, 0.14, 0.08], [sx * 0.62, 0.86, 0], rot=[-90, 0, 0], style='post', front_scale=[0.3, 0.3])
    S.slab('rail', [-0.7, 0.62, 0.0], [0.7, 0.56, 0.0], 0.12, 0.08, style='rail')
    S.slab('rail', [-0.7, 0.3, 0.0], [0.7, 0.34, 0.0], 0.12, 0.08, style='rail')
    for k in range(10):
        a = k * 37 % 360
        S.taper('tuft', [0.05, 0.03, 0.18], [-0.66 + (k % 2) * 1.28 + (k % 5) * 0.03, 0.0, (k % 3 - 1) * 0.06], rot=[-70, a, 0], offset=[0, 0, 0.08], style='grass', front_scale=[0.1, 0.2])
    return S


def phone():
    """A smartphone lying flat: soft slate case, a glowing screen (part `screen`) with an app grid. 0.4 x 0.04 x 0.72."""
    S = Spec('phone', density=120)
    S.styles(case=dict(ramp='slate', tone=2.6, brush={'off': True}, rim={'light_shift': 1.2, 'dark_shift': -0.8, 'outline': 'none'},
                       layers=[dict(op='gloss', id='g', dash=True, length=4, density=0.5, shift=1.2, post=True)]),
             screen=dict(ramp='screen', tone=2.4, light=0.1, brush={'off': True}, rim={'light_shift': 0, 'dark_shift': 0, 'outline': 'none'},
                         layers=[dict(op='gradient', id='sky', axis='z', amount=-1.2),
                                 dict(op='rect', id='bar', rect=[0.05, 0.9, 0.95, 0.95], ramp='screen', tone=4.0, faces=['top']),
                                 dict(op='rect', id='a1', rect=[0.12, 0.62, 0.3, 0.72], ramp='honey', tone=3.4, faces=['top']),
                                 dict(op='rect', id='a2', rect=[0.41, 0.62, 0.59, 0.72], ramp='rose', tone=3.4, faces=['top']),
                                 dict(op='rect', id='a3', rect=[0.7, 0.62, 0.88, 0.72], ramp='sage', tone=3.4, faces=['top']),
                                 dict(op='rect', id='a4', rect=[0.12, 0.45, 0.3, 0.55], ramp='lake', tone=3.8, faces=['top']),
                                 dict(op='rect', id='a5', rect=[0.41, 0.45, 0.59, 0.55], ramp='lilac', tone=3.6, faces=['top']),
                                 dict(op='rect', id='a6', rect=[0.7, 0.45, 0.88, 0.55], ramp='berry', tone=3.4, faces=['top']),
                                 dict(op='rect', id='dock', rect=[0.08, 0.06, 0.92, 0.16], ramp='screen', tone=3.2, faces=['top'])]))
    S.box('case', 0.4, 0.04, 0.72, 0, 0, 0, style='case', chamfer=0.03)
    S.part('screen', 'box', [0.35, 0.005, 0.64], [0, 0.042, 0], style='screen', exact=True)
    return S


def microphone():
    """A vintage studio microphone on a weighted stand: brass ring, a striped grille capsule. ~1.0 tall."""
    S = Spec('microphone', density=72)
    S.styles(steel=metal('steel', 3.4), dark=metal('iron', 2.8), brass=metal('brass', 3.8),
             grille=dict(ramp='steel', tone=3.4, brush={'off': True}, rim={'light_shift': 1.2, 'dark_shift': -1.0, 'outline': 'none'},
                         layers=[dict(op='stripes', id='mesh', axis='y', period=0.03, width=0.4, shift=-1.4), dict(op='stripes', id='mesh2', axis='x', period=0.03, width=0.3, shift=-0.8)]),
             felt=flat('berry', 2.8))
    S.cyl('base', 0.26, 0.06, 0, 0, 0, sides=10, style='dark', back_scale=[0.9, 0.9])
    S.cyl('felt', 0.25, 0.01, 0, -0.005, 0, sides=10, style='felt')
    S.cyl('stem', 0.025, 0.5, 0, 0.06, 0, sides=6, style='steel')
    S.cbox('yoke', [0.36, 0.04, 0.05], [0, 0.58, 0], style='steel')
    for sx in (-1, 1):
        S.cbox('fork', [0.04, 0.2, 0.05], [sx * 0.18, 0.66, 0], style='steel')
    S.loft('capsule', [([0, 0.56, 0], [0.12, 0.12]), ([0, 0.6, 0], [0.26, 0.26]), ([0, 0.8, 0], [0.3, 0.3]), ([0, 0.98, 0], [0.24, 0.24]), ([0, 1.02, 0], [0.1, 0.1])],
           sides=10, round=2.0, style='grille', up=[0, 0, 1])
    S.cyl('ring', 0.16, 0.04, 0, 0.76, 0, sides=10, style='brass')
    return S


def mug(name, r, motif):
    S = Spec(name, density=96)
    deco = [dict(op='band', id='band', axis='z', **{'from': -0.25, 'to': 0.15}, ramp='cream', tone=3.6, faces=['sides'])]
    if motif == 'sun':
        deco.append(dict(op='spots', id='dots', count=10, radius=[0.025, 0.035], ramp='honey', tone=3.8, faces=['sides'], where={'z': [-0.2, 0.1]}))
    else:
        deco.append(dict(op='spots', id='stars', count=12, radius=[0.015, 0.025], ramp='lamp', tone=4.0, faces=['sides'], where={'z': [0.3, 0.9]}))
    S.styles(mug=glaze(r, 3.2, layers=deco), coffee=flat('soil', 2.6, layers=[dict(op='spots', id='crema', count=6, radius=[0.02, 0.04], ramp='ochre', tone=3.2)]))
    S.cyl('mug', 0.17, 0.34, 0, 0, 0, sides=12, style='mug')
    S.cyl('coffee', 0.15, 0.01, 0, 0.3, 0, sides=12, style='coffee')
    S.cbox('handle', [0.05, 0.2, 0.06], [0.2, 0.17, 0], style='mug', chamfer=0.015)
    S.cbox('handle2', [0.08, 0.04, 0.06], [0.17, 0.26, 0], style='mug')
    S.cbox('handle3', [0.08, 0.04, 0.06], [0.17, 0.08, 0], style='mug')
    return S


def milk():
    """A glass bottle of milk with a foil cap and a paper label."""
    S = Spec('milk', density=96)
    S.styles(glass=glaze('snow', 3.8, layers=[dict(op='band', id='label', axis='z', **{'from': -0.5, 'to': 0.1}, ramp='lake', tone=3.2, faces=['sides'])]),
             cap=metal('steel', 3.6))
    S.cyl('bottle', 0.12, 0.3, 0, 0, 0, sides=10, style='glass')
    S.cyl('shoulder', 0.12, 0.08, 0, 0.3, 0, sides=10, style='glass', front_scale=[0.6, 0.6])
    S.cyl('neck', 0.075, 0.06, 0, 0.38, 0, sides=10, style='glass')
    S.cyl('cap', 0.08, 0.025, 0, 0.44, 0, sides=10, style='cap')
    return S


def teapot():
    """A round celadon teapot: lid, knob, spout and a looped handle."""
    S = Spec('teapot', density=80)
    S.styles(china=glaze('sage', 3.4, layers=[dict(op='band', id='trim', axis='path', **{'from': 0.7, 'to': 0.8}, ramp='cream', tone=3.6)]), knob=glaze('honey', 3.6))
    S.loft('body', [([0, 0.0, 0], [0.34, 0.34]), ([0, 0.08, 0], [0.5, 0.5]), ([0, 0.2, 0], [0.56, 0.56]), ([0, 0.32, 0], [0.46, 0.46]), ([0, 0.36, 0], [0.3, 0.3])],
           sides=12, round=2.0, style='china', up=[0, 0, 1])
    S.cyl('lid', 0.14, 0.04, 0, 0.36, 0, sides=10, style='china')
    S.cyl('knob', 0.04, 0.05, 0, 0.4, 0, sides=8, style='knob')
    S.rod('spout', [0.22, 0.14, 0], [0.4, 0.32, 0], 0.035, sides=6, style='china')
    S.cbox('handle', [0.05, 0.22, 0.05], [-0.33, 0.2, 0], style='china')
    S.cbox('handle2', [0.1, 0.04, 0.05], [-0.29, 0.3, 0], style='china')
    S.cbox('handle3', [0.1, 0.04, 0.05], [-0.29, 0.1, 0], style='china')
    return S


def beans():
    """A little scatter of roasted coffee beans."""
    S = Spec('beans', density=160)
    S.style('bean', dict(ramp='soil', tone=3.0, brush={'off': True}, rim={'light_shift': 1.4, 'dark_shift': -0.8, 'outline': 'none'},
                         layers=[dict(op='band', id='crease', axis='x', **{'from': -0.12, 'to': 0.12}, shift=-1.6, faces=['top'])]))
    rnd = random.Random(8)
    for k in range(7):
        a = k * 2.1
        S.cbox('bean', [0.07, 0.035, 0.1], [math.cos(a) * 0.12 * (k % 3) / 2, 0.018, math.sin(a) * 0.12 * (k % 3) / 2], rot=[0, rnd.uniform(0, 180), 0], style='bean', chamfer=0.012)
    return S


def radio():
    """An arched wooden valve radio: a cloth speaker grille, a glowing tuning dial (part `dial`) and two knobs."""
    S = Spec('radio', density=64)
    S.styles(case=wood('walnut', 3.4, ph='wood_table_001'), trim=wood('oak', 3.4),
             cloth=cloth('oat', 3.0, ph='hessian_230', scale=0.4, layers=[dict(op='stripes', id='fret', axis='x', period=0.1, width=0.4, ramp='walnut', tone=3.0)]),
             dial=glow('glow', 3.4), brass=metal('brass', 3.6))
    S.box('case', 0.9, 0.5, 0.42, 0, 0, 0, style='case', chamfer=0.03)
    S.prism('arch', 0.9, 0.36, 0.42, [0, 0.5, 0], sides=12, style='case')
    S.box('grille', 0.6, 0.34, 0.02, 0, 0.26, 0.21, style='cloth')
    S.prism('grilletop', 0.6, 0.24, 0.02, [0, 0.6, 0.21], sides=12, style='cloth')
    S.part('dial', 'box', [0.34, 0.08, 0.02], [0, 0.13, 0.215], style='dial', exact=True)
    for sx in (-1, 1):
        S.knob('knob', 0.05, 0.05, sx * 0.32, 0.12, 0.21, style='brass')
    S.box('plinth', 0.96, 0.05, 0.46, 0, -0.02, 0, style='trim', chamfer=0.01)
    return S


def musicbox():
    """A music box with its lid open: a tiny silver star twirls on a spindle (part `star`) over the comb."""
    S = Spec('musicbox', density=80)
    S.styles(box=wood('clay', 3.2, ph='wood_table_001', layers=[dict(op='panel', id='inlay', inset=3, ramp='ochre', tone=3.6, highlight=1, shadow=1)]),
             lid=wood('clay', 3.4, ph='wood_table_001'), velvet=cloth('berry', 2.8, ph='velour_velvet', scale=0.4), comb=metal('brass', 3.8), star=metal('steel', 4.2),
             mirror=glaze('mist', 3.8))
    S.box('box', 0.74, 0.32, 0.54, 0, 0, 0, style='box', chamfer=0.02)
    S.box('velvet', 0.66, 0.02, 0.46, 0, 0.3, 0, style='velvet')
    S.cbox('comb', [0.36, 0.04, 0.12], [0.1, 0.34, 0.1], style='comb')
    S.cyl('drum', 0.05, 0.3, -0.05, 0.34, -0.04, sides=8, rot=[0, 0, 90], style='comb')
    S.cbox('lid', [0.74, 0.54, 0.04], [0, 0.6, -0.3], rot=[-15, 0, 0], style='lid', chamfer=0.015)
    S.cbox('mirror', [0.56, 0.38, 0.01], [0, 0.6, -0.27], rot=[-15, 0, 0], style='mirror')
    S.cyl('spindle', 0.012, 0.16, 0.0, 0.32, 0.08, sides=4, style='comb')
    S.part('star', 'prism', [0.16, 0.16, 0.03], [0, 0.56, 0.08], sides=5, style='star', exact=True)
    S.cbox('key', [0.04, 0.12, 0.12], [-0.4, 0.16, 0], style='comb')
    return S


def stove():
    """A little pot-bellied iron stove with a glowing door (part `fire`) and a stovepipe."""
    S = Spec('stove', density=56)
    S.styles(iron=metal('iron', 3.0, layers=[dict(op='patches', id='soot', scale=0.2, threshold=0.6, shift=-0.8)]), brass=metal('brass', 3.6), fire=glow('glow', 3.0))
    S.loft('belly', [([0, 0.18, 0], [0.5, 0.5]), ([0, 0.36, 0], [0.74, 0.74]), ([0, 0.62, 0], [0.7, 0.7]), ([0, 0.8, 0], [0.48, 0.48])],
           sides=10, round=2.0, style='iron', up=[0, 0, 1])
    S.cyl('top', 0.3, 0.06, 0, 0.8, 0, sides=10, style='iron')
    S.cyl('pipe', 0.09, 1.2, 0, 0.86, -0.05, sides=8, style='iron')
    S.cyl('collar', 0.12, 0.05, 0, 1.4, -0.05, sides=8, style='brass')
    S.part('fire', 'box', [0.28, 0.2, 0.02], [0, 0.46, 0.37], style='fire', exact=True)
    S.cbox('doorframe', [0.36, 0.28, 0.02], [0, 0.46, 0.355], style='brass')
    for k in range(4):
        a = k / 4 * math.tau + math.pi / 4
        S.rod('leg', [math.sin(a) * 0.2, 0.2, math.cos(a) * 0.2], [math.sin(a) * 0.3, 0.0, math.cos(a) * 0.3], 0.03, sides=6, style='iron')
    return S


def book_open():
    """An open storybook lying on the desk, pages fanned, a ribbon bookmark."""
    S = Spec('book_open', density=80)
    S.styles(cover=cloth('berry', 3.0, ph='brown_leather', scale=0.5),
             page=paper('paper', 3.8, layers=[dict(op='stripes', id='text', axis='z', period=0.04, width=0.25, ramp='graphite', tone=3.0, faces=['top'], range=[-0.75, 0.7])]),
             ribbon=flat('ochre', 3.2))
    S.box('cover', 1.04, 0.03, 0.72, 0, 0, 0, style='cover')
    for sx in (-1, 1):
        S.box('pages', 0.48, 0.06, 0.66, sx * 0.25, 0.03, 0, style='page', rot=[0, 0, -sx * 5])
    S.box('ribbon', 0.03, 0.005, 0.5, 0.06, 0.09, 0.3, style='ribbon')
    return S


def sunflower():
    """A sunflower in a clay pot: a tall stem, two leaves and a big honey-gold head."""
    S = Spec('sunflower', density=64)
    S.styles(pot=glaze('terracotta', 3.2), stem=leafy('fern', 3.0), leaf=leafy('moss', 3.0),
             petals=dict(ramp='honey', tone=3.6, brush={'flow': 'long'}, rim={'light_shift': 1.0, 'dark_shift': -0.8, 'outline': 'none'}),
             seeds=dict(ramp='soil', tone=2.6, brush={'off': True}, rim={'light_shift': 0.6, 'dark_shift': -0.6, 'outline': 'none'},
                        layers=[dict(op='spots', id='seed', count=30, radius=[0.012, 0.02], shift=1.2)]))
    S.cyl('pot', 0.18, 0.28, 0, 0, 0, sides=8, style='pot', back_scale=[0.8, 0.8])
    S.cyl('stem', 0.025, 0.8, 0, 0.26, 0, sides=6, style='stem')
    for sx in (-1, 1):
        S.taper('leaf', [0.2, 0.03, 0.3], [sx * 0.02, 0.6 + sx * 0.1, 0], rot=[0, sx * 90, -sx * 20], offset=[0, 0, 0.14], style='leaf', front_scale=[0.1, 1])
    for k in range(14):
        S.cbox('petal', [0.08, 0.17, 0.02], [0, 1.1, 0.05 + (k % 2) * 0.01], rot=[0, 0, k / 14 * 360], offset=[0, 0.16, 0], style='petals', chamfer=0.02)
    S.prism('head', 0.26, 0.26, 0.06, [0, 1.1, 0.07], sides=10, style='seeds')
    return S


def specs():
    # the bed, teapot, radio and music box are borrowed now (borrow.py); their specs stay as references
    out = {f.__name__: f() for f in (pillow, sheep, fence, phone, microphone, milk, beans, stove, book_open, sunflower)}
    out['mug_sun'] = mug('mug_sun', 'terracotta', 'sun')
    out['mug_moon'] = mug('mug_moon', 'dusk', 'moon')
    return out
