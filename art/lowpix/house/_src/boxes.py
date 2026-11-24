"""Moving boxes (box_<id>): corrugated cardboard with scuffed corners, a strip of brown packing tape over the flaps
and down the front, a paper label hand-lettered in marker ("PIP'S STUFF", "FRAGILE" with red arrows...), a
stamped star and a scribbled tally. Flaps and tape are named nodes (flapF, flapB, flapL, flapR, tape) so
src/world/house/boxes.ts can burst them open. Sizes match BOX_W/H/D there (px)."""
import random

from hx import Spec, text_art

W, H, D = 18, 14, 16
BOXES = {
    'f1_pip': ("PIP'S STUFF", '#c4a27a'), 'f1_fragile': ('FRAGILE', '#bf9c74'), 'f1_cozy': ('COZY', '#c9a982'),
    'f1_books': ('BOOKS', '#b9966e'), 'f1_nook': ('NIGHT NOOK', '#c6a47c'), 'f2_bedroom': ('BEDROOM', '#c4a27a'),
    'f2_linen': ('SOFT THINGS', '#c9a982'), 'f3_stars': ('STARGAZING', '#bf9c74'), 'f3_maps': ('MAPS', '#c6a47c'),
}


def lines(s):
    if len(s) <= 7:
        return [s]
    sp = s.find(' ')
    return [s[:sp], s[sp + 1:]] if sp > 0 else [s]


def label_art(text, ink='t'):
    ls = lines(text)
    rows = []
    w = max(len(l) * 4 - 1 for l in ls)
    for i, l in enumerate(ls):
        art = text_art(l, ink)
        pad = (w - len(art[0])) // 2
        rows += ['.' * pad + r + '.' * (w - len(r) - pad) for r in art]
        if i < len(ls) - 1:
            rows.append('.' * w)
    return rows


def box(id, label, tint):
    from hx import ramp
    S = Spec('box_' + id, density=4, desc=f'Moving box "{label}"')
    S.ramps(card=ramp(tint, 7, hue=12, sat=0.05, spread=0.7), tape=ramp('#c8a46a', 5, hue=10, sat=0.05, spread=0.6))
    rng = random.Random(len(id) * 7 + len(label))
    S.style('card', ramp='card', tone=3.6, rim={'light_shift': 0.8, 'dark_shift': -1.0}, brush={'flow': 'vertical', 'length': 2, 'rough': 0.35, 'textures': {'card': 'cloth'}}, layers=[
        {'id': 'corr', 'op': 'stripes', 'axis': 'x', 'period': 0.9, 'width': 0.3, 'shift': -0.35, 'faces': ['front', 'back']},
        {'id': 'corr2', 'op': 'stripes', 'axis': 'z', 'period': 0.9, 'width': 0.3, 'shift': -0.35, 'faces': ['left', 'right']},
        {'id': 'scuff', 'op': 'wear', 'width': 1, 'density': 0.45, 'ramp': 'card', 'tone': 1.8},
        {'id': 'stain', 'op': 'patches', 'scale': 3, 'threshold': 0.72, 'shift': -0.6},
        {'id': 'mottle', 'op': 'noise', 'scale': 1.6, 'amount': 0.3}])
    S.style('inside', ramp='card', tone=1.8, light=0.4, rim={'light_shift': 0.2, 'dark_shift': -0.3}, brush={'off': True})
    S.style('tape', ramp='tape', tone=3.0, rim={'light_shift': 0.8, 'dark_shift': -0.6}, brush={'off': True}, layers=[
        {'id': 'sheen', 'op': 'gloss', 'dash': True, 'shift': 1.2},
        {'id': 'wrinkle', 'op': 'stripes', 'axis': [1, 0, 1], 'period': 1.6, 'width': 0.2, 'shift': 0.6}])
    fragile = label == 'FRAGILE'
    # body: bottom, four walls, a dark inside
    S.box('bottom', W, 1, D, 0, 0, 0, style='card')
    S.box('front', W, H - 1, 1, 0, 1, D / 2 - 0.5, style='card')
    S.box('back', W, H - 1, 1, 0, 1, -D / 2 + 0.5, style='card')
    S.box('left', 1, H - 1, D - 2, -W / 2 + 0.5, 1, 0, style='card')
    S.box('right', 1, H - 1, D - 2, W / 2 - 0.5, 1, 0, style='card')
    S.box('inner', W - 2, H - 3, D - 2, 0, 1, 0, style='inside')
    # tape down the front and the back
    S.box('tapeF', 3, 5, 0.3, 0, H - 5, D / 2 + 0.05, style='tape')
    S.box('tapeB', 3, 5, 0.3, 0, H - 5, -D / 2 - 0.05, style='tape')
    # the label: paper with the words in marker
    ink = 'red:1' if fragile else 'slate:0'
    art = label_art(label)
    lw = max(len(art[0]) / 4 + 2, 9)
    lh = len(art) / 4 + 1.6
    S.box('label', lw, lh, 0.3, 0, 2.2, D / 2 + 0.1, paint={'ramp': 'cream', 'tone': 3.6, 'stamps': [
        {'face': 'front', 'at': 'center', 'art': art, 'key': {'t': ink}}], 'layers': [{'id': 'edge', 'op': 'panel', 'inset': 1, 'shift': -0.6, 'faces': ['front']}]},
          rot=[0, 0, rng.uniform(-4, 4)])
    if fragile:
        arrow = ['..r..', '.rrr.', 'rrrrr', '..r..', '..r..', '..r..']
        for x in (-6.5, 6.5):
            S.box('arrow', 2, 2.2, 0.2, x, H - 6.2, D / 2 + 0.05, paint={'ramp': 'card', 'stamps': [{'face': 'front', 'at': 'center', 'art': arrow, 'key': {'r': 'red:2'}}]})
        glass = ['..t..', '.ttt.', '.ttt.', '..t..', '..t..', '.ttt.']
        S.box('glass', 2.4, 2.4, 0.2, -W / 2 - 0.05, H - 7, 0, rot=[0, -90, 0], paint={'ramp': 'card', 'stamps': [{'face': 'front', 'at': 'center', 'art': glass, 'key': {'t': 'red:2'}}]})
    else:
        star = ['...t...', '..ttt..', 'ttttttt', '.ttttt.', '.tt.tt.', 't.....t']
        S.box('stamp', 2.6, 2.4, 0.2, W / 2 - 3, H - 4.6, D / 2 + 0.05, paint={'ramp': 'card', 'stamps': [{'face': 'front', 'at': 'center', 'art': star, 'key': {'t': 'slate:1'}}]})
    tally = ['t.t.t.t', 't.t.t.t', 'ttttttt', 't.t.t.t']
    S.box('tally', 2.2, 1.4, 0.2, W / 2 + 0.05, 3, -3, rot=[0, 90, 0], paint={'ramp': 'card', 'stamps': [{'face': 'front', 'at': 'center', 'art': tally, 'key': {'t': 'slate:1'}}]})
    # flaps on hinges, and the tape over them
    for name, piv, size, off in (('flapF', [0, H, D / 2], [W, 0.8, D / 2], [0, 0.4, -D / 4]), ('flapB', [0, H, -D / 2], [W, 0.8, D / 2], [0, 0.4, D / 4]),
                                 ('flapL', [-W / 2, H + 0.8, 0], [W / 2 - 0.2, 0.6, D - 1], [W / 4, 0.3, 0]), ('flapR', [W / 2, H + 0.8, 0], [W / 2 - 0.2, 0.6, D - 1], [-W / 4, 0.3, 0])):
        b = S.bone(name, piv, node=True)
        with S.under(b):
            S.cbox(name + 'p', size, off, style='card')
    t = S.bone('tape', [0, H + 1.4, 0], node=True)
    with S.under(t):
        S.cbox('tapetop', [3.2, 0.35, D + 0.4], [0, 0.18, 0], style='tape')
    S.d['render']['hero'] = [-30, 22]
    return S


def specs():
    return {'box_' + k: box(k, *v) for k, v in BOXES.items()}
