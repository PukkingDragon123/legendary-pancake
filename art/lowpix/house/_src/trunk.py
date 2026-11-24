"""The hollow oak's trunk, one GLB per floor band (so build mode can hide everything above the floor it edits).

trunk_f1 / trunk_f2 / trunk_f3: the bark shell of the band (a 48-sided loft, swelling into a flared foot at the
ground, the faces in front of the dollhouse cut left out), the cut lips (the wall's cross-section: bark rim, pale
sapwood, ringed heartwood), the floor slab the band stands on (planked top edge, the joists' end grain at the cut,
the planked ceiling of the room below with its joists, a hatch and a hanging lantern), the round windows (stone sills,
wooden frames, glass, flower boxes, ivy), the stone chimney climbing the back-left of the trunk, shelf fungus, burls,
a knothole, ivy strands and moss. Doors, porch, balcony, roots, interior fittings and the roof are separate modules.
"""
import math
import random

from hx import paint_photo as pp
from hx import (BANDS, CHIMNEY_A, FLOOR_Y, LADDER_A, NSIDES, OPEN_A, R_IN, RO, ROOF_Y, SLAB, WINDOWS, Spec, pol, swing)

FIDS = ['f1', 'f2', 'f3']


def R_of(y):
    """Outer radius of the bark at height y: a flared foot, a swelling at the second floor, a waist under the crown."""
    pts = [(0, RO + 20), (8, RO + 12), (18, RO + 6.5), (30, RO + 3), (46, RO + 1.2), (66, RO + 0.6), (84, RO + 2.2), (102, RO + 1.5),
           (120, RO - 0.2), (138, RO - 0.6), (160, RO - 1.5), (180, RO - 0.8), (198, RO + 1.2), (210, RO + 3.0)]
    for (y0, r0), (y1, r1) in zip(pts, pts[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            t = t * t * (3 - 2 * t)
            return r0 + (r1 - r0) * t
    return pts[-1][1]


def _flutes():
    """The trunk's fluting: tall ridges of bark running up between the windows, and short buttresses swelling
    out of the foot where the roots join. (angle, width, thickness, top y)."""
    from hx import DOOR_A, LIMB_A
    rng = random.Random(77)
    keep_out = [(2.5, 0.24), (-2.36, 0.24), (-2.3, 0.24), (2.95, 0.2), (math.pi, 0.26), (-math.pi, 0.26), (1.75, 0.2), (-1.75, 0.2),
                (LIMB_A, 0.2), (DOOR_A, 0.32), (CHIMNEY_A, 0.2)]
    out = []
    for a in (-1.12, -1.32, -1.52, 1.5, 2.03, -2.62, -2.86, -1.97, 2.24, 2.72, -2.12):
        tall = all(abs(math.remainder(a - k, 2 * math.pi)) > w for k, w in keep_out)
        out.append((a + rng.uniform(-0.02, 0.02), rng.uniform(8, 13), rng.uniform(5, 8), rng.uniform(150, 215) if tall else rng.uniform(18, 26)))
    for k in range(14):
        a = -math.pi + (k + 0.5) / 14 * 2 * math.pi + rng.uniform(-0.06, 0.06)
        if abs(a) < OPEN_A + 0.18 or abs(a - DOOR_A) < 0.36 or min(abs(math.remainder(a - k, 2 * math.pi)) for k in (2.5, -2.36, CHIMNEY_A)) < 0.26:
            continue
        out.append((a, rng.uniform(10, 16), rng.uniform(6, 9), rng.uniform(16, 24)))
    return out


FLUTES = _flutes()


def flute_rt(f, y):
    """Thickness of a flute at height y (0 above its top): swollen at the foot, tapering out at the top."""
    a, w, t0, top = f
    if y >= top:
        return 0.0
    foot = 1 + 1.5 * max(0.0, (26 - y) / 26) ** 1.5
    fade = min(1.0, (top - y) / 30) ** 0.7
    return t0 * foot * fade


def flutes(S, y0, y1):
    ys = ring_ys(y0, y1, 8)
    for i, f in enumerate(FLUTES):
        a, w, t0, top = f
        if top <= y0:
            continue
        rings = []
        for y in ys:
            yy = min(y, top)
            t = flute_rt(f, yy)
            ww = w * (0.6 + 0.4 * t / (t0 * 2.5)) if t > 0 else 0.6
            c = R_of(yy) + t * 0.32 - 2.2
            rings.append({'at': pol(a, c, yy), 'size': [max(0.6, ww), max(0.4, t + 2.2)], 'roll': -math.degrees(a)})
            if y >= top:
                break
        if len(rings) < 2:
            continue
        S.loft('flute', rings, sides=8, rnd=2.2, style='bark', caps=(False, top < y1), subdiv=1)


def ring_ys(y0, y1, step=12):
    n = max(2, round((y1 - y0) / step))
    return [y0 + (y1 - y0) * i / n for i in range(n + 1)]


def cut_faces(nseg):
    """Loft face names in front of the dollhouse cut (around 0 +- CUT_K/48) for a 48-sided loft with angle 3.75."""
    hide = []
    for i in range(nseg):
        for k in range(17, 31):
            hide.append(f's{i}_{k}')
    return hide


def bark_shell(S, fid, y0, y1, moss_foot=False):
    ys = ring_ys(y0, y1)
    rings = [{'at': [0, y, 0], 'size': 2 * R_of(y)} for y in ys]
    paint = {'layers': []}
    if moss_foot:
        paint['layers'].append({'id': 'skirt', 'op': 'band', 'axis': 'y', 'from': -1, 'to': -0.62, 'wobble': 0.3, 'wobble_scale': 5,
                                'ramp': 'moss', 'tone': 3.0, 'bevel': {'shadow': 1, 'highlight': 1, 'shadow_ramp': 'bark', 'shadow_tone': 1.0}})
    # moss gathers on the shaded back of the trunk
    paint['layers'].append({'id': 'northmoss', 'op': 'spots', 'count': 7, 'radius': [2.5, 7], 'roughness': 0.8, 'rough_scale': 3,
                            'where': {'around': [0.35, 0.65]}, 'ramp': 'moss', 'tone': 3.2,
                            'bevel': {'shadow': 1, 'highlight': 1, 'shadow_ramp': 'bark', 'shadow_tone': 1.0}})
    # the window openings are whole faces of the shell left out (src/world/house/plan.ts windowHoles mirrors this)
    hide = cut_faces(len(ys) - 1)
    for h in window_holes(fid):
        for i in range(len(ys) - 1):
            if ys[i] < h['y0'] - 0.1 or ys[i + 1] > h['y1'] + 0.1:
                continue
            for k in range(NSIDES):
                mid = 2 * math.pi * (23.5 - k) / 48
                if abs(math.remainder(mid - h['a'], 2 * math.pi)) < h['half']:
                    hide.append(f's{i}_{k}')
    S.loft('bark', rings, sides=NSIDES, rnd=2.0, style='bark', caps=(False, False), subdiv=0, angle=3.75,
           hide=hide, paint=paint)
    return ys


def window_holes(fid):
    """Openings through the trunk for a floor's windows: whole bark faces round each window (angle a, half-angle,
    y0..y1 on the shell's ring heights)."""
    from hx import FACE
    y0, y1 = BANDS[fid]
    ys = ring_ys(y0, y1)
    out = []
    for a, v, r in WINDOWS[fid]:
        half = math.ceil((r + 2) / (RO * FACE)) * FACE
        y = FLOOR_Y[fid] + v
        hit = [i for i in range(len(ys) - 1) if ys[i + 1] > y - r - 1 + 0.5 and ys[i] < y + r + 1 - 0.5]
        out.append({'a': a, 'half': half, 'y0': ys[hit[0]], 'y1': ys[hit[-1] + 1], 'v': v, 'r': r})
    return out


def cut_lips(S, ys, deep=False):
    """The wall's cross-section either side of the cut: sapwood rim + heartwood rings, as thin vertical lofts."""
    for sgn in (-1, 1):
        a = sgn * OPEN_A
        rad = [math.sin(a), 0, math.cos(a)]
        tang = [math.cos(a) * sgn, 0, -math.sin(a) * sgn]  # into the wall
        roll = 90 - math.degrees(a)
        for layer, (t, style) in enumerate([(2.4, 'sapcut'), (2.0, 'heartcut')]):
            rings = []
            for y in ys:
                Ro = R_of(y) + 0.2
                lo = R_IN - 0.6 if layer == 1 else Ro - 4.0
                hi = Ro - 3.8 if layer == 1 else Ro
                c = (lo + hi) / 2
                at = [rad[0] * c + tang[0] * t / 2, y, rad[2] * c + tang[2] * t / 2]
                rings.append({'at': at, 'size': [hi - lo, t], 'roll': roll})
            S.loft('lip' + ('L' if sgn < 0 else 'R') + str(layer), rings, sides=4, rnd=8, style=style, caps=(False, False), subdiv=0,
                   paint={'layers': [{'id': 'rings', 'axis': rad}]} if style == 'heartcut' else {'layers': [{'id': 'rim', 'axis': rad}, {'id': 'barkrim', 'axis': rad}]})


def styles(S):
    S.style('heartcut', ramp='heart', tone=4.4, rim={'light_shift': 0.6, 'dark_shift': -0.7}, brush={'flow': 'vertical', 'length': 4, 'width': 0.6, 'rough': 0.45}, layers=[
        pp('oak_veneer_01', 36, ['heart'], 'heart:5', tint_amount=0.45),
        {'id': 'rings', 'op': 'stripes', 'axis': [1, 0, 0], 'period': 1.9, 'width': 0.3, 'shift': -1.0, 'wobble': 0.35, 'space': 'world'},
        {'id': 'rays', 'op': 'spots', 'count': 18, 'radius': [0.3, 0.6], 'stretch': [6, 0.4, 6], 'shift': 0.8},
        {'id': 'checks', 'op': 'cracks', 'scale': 5, 'width': 0.5, 'threshold': 0.7, 'shift': -1.6},
        {'id': 'mottle', 'op': 'noise', 'scale': 5, 'amount': 0.35}])
    S.style('sapcut', ramp='sap', tone=3.2, rim={'light_shift': 0.6, 'dark_shift': -0.7}, brush={'flow': 'vertical', 'length': 3, 'rough': 0.4}, layers=[
        {'id': 'rim', 'op': 'stripes', 'axis': [1, 0, 0], 'period': 1.6, 'width': 0.25, 'shift': -0.8, 'wobble': 0.3, 'space': 'world'},
        {'id': 'barkrim', 'op': 'band', 'axis': 'x', 'from': 0.2, 'to': 1.0, 'ramp': 'bark', 'tone': 2.4},
        {'id': 'mottle', 'op': 'noise', 'scale': 4, 'amount': 0.3}])
    S.style('fungus', ramp='ochre', tone=4.2, rim={'light_shift': 1.0, 'dark_shift': -1.2}, brush={'flow': 'horizontal', 'length': 2, 'rough': 0.5}, layers=[
        {'id': 'zones', 'op': 'stripes', 'axis': 'z', 'period': 1.6, 'width': 0.4, 'shift': -0.8, 'wobble': 0.3, 'faces': ['up', 'top']},
        {'id': 'under', 'op': 'fill', 'faces': ['down', 'bottom'], 'ramp': 'cream', 'tone': 2.6},
        {'id': 'rimlight', 'op': 'band', 'axis': 'z', 'from': 0.7, 'to': 1.0, 'ramp': 'cream', 'tone': 3.4}])
    S.style('ceiling', ramp='plank', tone=3.4, rim=RIM_SOFT, brush={'flow': 'x', 'length': 6, 'width': 0.8, 'rough': 0.5}, layers=[
        photo('weathered_planks', scale=40, amount=0.5),
        {'id': 'boards', 'op': 'stripes', 'axis': 'z', 'period': 7, 'width': 0.12, 'shift': -1.4, 'space': 'world'},
        {'id': 'butts', 'op': 'spots', 'count': 26, 'radius': [0.4, 0.6], 'stretch': [0.2, 1, 6], 'shift': -1.4},
        {'id': 'mottle', 'op': 'noise', 'scale': 6, 'amount': 0.4}])
    S.style('slabedge', ramp='plank', tone=3.6, rim=RIM_SOFT, brush={'flow': 'horizontal', 'length': 4, 'rough': 0.5}, layers=[
        {'id': 'boards', 'op': 'band', 'axis': 'y', 'from': 0.4, 'to': 1.0, 'ramp': 'plank', 'tone': 4.8, 'faces': ['sides'], 'bevel': {'shadow': 1, 'highlight': 1}},
        {'id': 'ends', 'op': 'stripes', 'axis': 'around', 'period': 0.0125, 'width': 0.14, 'shift': -1.4, 'faces': ['sides']},
        {'id': 'under', 'op': 'band', 'axis': 'y', 'from': -1, 'to': -0.3, 'ramp': 'dark', 'tone': 3.0, 'faces': ['sides']},
        # the planked ceiling of the room below (the loft's bottom cap)
        {'id': 'ceil', 'op': 'fill', 'faces': ['start'], 'ramp': 'plank', 'tone': 3.3},
        pp('weathered_planks', 44, ['plank'], 'plank:5', tint_amount=0.5, faces=['start']),
        {'id': 'cboards', 'op': 'stripes', 'axis': 'z', 'period': 7, 'width': 0.13, 'shift': -1.5, 'space': 'world', 'faces': ['start'], 'wobble': 0.05},
        {'id': 'cbutts', 'op': 'stripes', 'axis': 'x', 'period': 41, 'width': 0.03, 'shift': -1.3, 'space': 'world', 'faces': ['start']},
        {'id': 'nails', 'op': 'spots', 'count': 120, 'radius': [0.35, 0.5], 'shift': -1.8, 'faces': ['start']},
        {'id': 'stain', 'op': 'patches', 'scale': 14, 'threshold': 0.62, 'shift': -0.6, 'faces': ['start']},
        {'id': 'mottle', 'op': 'noise', 'scale': 4, 'amount': 0.35}])
    S.style('frame', ramp='dark', tone=3.6, rim={'light_shift': 1.0, 'dark_shift': -1.0}, brush={'flow': 'long', 'length': 3, 'rough': 0.4}, layers=[
        {'id': 'grain', 'op': 'noise', 'scale': 1.5, 'amount': 0.4},
        {'id': 'wear', 'op': 'wear', 'width': 1, 'density': 0.25, 'ramp': 'plank', 'tone': 4.6}])


RIM_SOFT = {'light_shift': 0.6, 'dark_shift': -0.7}


def photo_veneer():
    from hx import photo as ph
    return ph('oak_veneer_01', scale=36, amount=0.45)


def photo(*a, **k):
    from hx import photo as ph
    return ph(*a, **k)


# ------------------------------------------------------------------------------------------------ slabs
def slab(S, fid, holes=()):
    """The floor slab under `fid`: its edge at the cut (board ends over joist ends), its planked underside (the
    ceiling of the room below) with joists, a hatch frame and a hanging lantern on a chain."""
    y1 = FLOOR_Y[fid]
    y0 = y1 - SLAB if fid != 'f1' else 0
    r = R_of(y0 + 2) - 0.4
    hide = ['end'] + [f's0_{k}' for k in range(48) if not (17 <= k <= 30)]
    if fid == 'f1':
        hide.append('start')
    S.loft('slab', [{'at': [0, y0, 0], 'size': 2 * r}, {'at': [0, y1 - 0.15, 0], 'size': 2 * (R_of(y1) - 0.4)}], sides=NSIDES, rnd=2.0,
           style='slabedge' if fid != 'f1' else 'stone', caps=(True, True), subdiv=0, angle=3.75, hide=hide)
    if fid == 'f1':
        # the ground floor's threshold: a curved sill of split logs where the floor meets the clearing
        for k in range(-6, 7):
            a = (k / 6.6) * OPEN_A
            p = pol(a, R_of(2) - 1.5, 0)
            S.part('sill', 'prism', [6.5, 5, 2 * math.pi * R_of(2) / 48 * 0.98 + 0.6], [p[0], 2.2, p[2]], sides=7,
                   rot=[0, math.degrees(a) + 90, 0], style='wood', paint={'tone': 3.2 + (k % 3) * 0.3})
        return
    ceiling_fittings(S, y0, holes)


def ceiling_fittings(S, y0, holes=()):
    """Under a slab whose underside is at y0: joists running front to back (their end grain at the cut), iron
    straps, a crosswise beam with a boss, hatch frames and the room's hanging lantern."""
    S.style('joist', ramp='dark', tone=3.6, rim=RIM_SOFT, brush={'flow': 'z', 'length': 5, 'rough': 0.5}, layers=[
        pp('oak_veneer_01', 22, ['dark'], 'dark:4', tint_amount=0.55),
        {'id': 'endgrain', 'op': 'fill', 'faces': ['front'], 'ramp': 'heart', 'tone': 4.4},
        {'id': 'endrings', 'op': 'stripes', 'axis': [1, 1, 0], 'period': 1.2, 'width': 0.3, 'shift': -0.8, 'faces': ['front']},
        {'id': 'wear', 'op': 'wear', 'width': 1, 'density': 0.3, 'ramp': 'heart', 'tone': 5}])
    for x in (-40, -20, 0, 20, 40):
        zmax = math.sqrt(max(0, R_IN ** 2 - x * x))
        zf = math.sqrt(max(0, (R_of(y0) - 1) ** 2 - x * x))
        S.box('joist', 6, 5, zf + zmax, x, y0 - 5, (zf - zmax) / 2, style='joist', hide=['top'])
        # iron straps where the joists meet the wall
        S.box('strap', 6.6, 1.2, 2, x, y0 - 3.5, -zmax + 4, style='iron')
    # a crosswise beam with a boss in the middle, the lantern hangs from it
    S.box('beam', 2 * R_IN - 4, 6, 7, 0, y0 - 11, -6, style='joist', hide=['top'])
    S.part('boss', 'prism', [9, 9, 4], [0, y0 - 11.5, -6], sides=8, rot=[-90, 0, 0], style='dark')
    for hx_, hz_, hh in holes:
        hatch(S, hx_, y0, hz_, hh)
    lantern(S, 0, y0 - 12, -6, chain=8)


def hatch(S, x, y0, z, h):
    """A square hatch through the slab, seen from below: a dark opening in a heavy frame."""
    S.box('hatchhole', 2 * h, 0.6, 2 * h, x, y0 - 0.4, z, style='soot')
    for dx, dz, w, d in ((0, -h - 1, 2 * h + 4, 2), (0, h + 1, 2 * h + 4, 2), (-h - 1, 0, 2, 2 * h), (h + 1, 0, 2, 2 * h)):
        S.box('hatchframe', w, 2.6, d, x + dx, y0 - 2.6, z + dz, style='frame')


def lantern(S, x, ytop, z, chain=8, s=1.0, name='lamp'):
    """An iron lantern hanging from a chain: cap, four posts, a glowing glass body, a drip tray and a brass finial."""
    S.rod('chain', [x, ytop, z], [x, ytop - chain, z], 0.4 * s, sides=4, style='iron')
    y = ytop - chain
    S.part('lcap', 'taper', [7 * s, 7 * s, 3 * s], [x, y - 1.5 * s, z], rot=[-90, 0, 0], front_scale=[0.35, 0.35], style='iron')
    S.disc('lring', 1.2 * s, y - 0.2, y + 1.2 * s, x, z, sides=6, style='brass')
    S.disc(name, 2.4 * s, y - 9.5 * s, y - 3 * s, x, z, sides=6, style='lamp', glow=True)
    for dx, dz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        S.box('lpost', 0.8 * s, 7 * s, 0.8 * s, x + dx * 2.6 * s, y - 10 * s, z + dz * 2.6 * s, style='iron')
    S.disc('ltray', 3.6 * s, y - 11 * s, y - 9.6 * s, x, z, sides=6, style='iron')
    S.disc('lfin', 0.9 * s, y - 12.6 * s, y - 11 * s, x, z, sides=6, style='brass')


# ------------------------------------------------------------------------------------------------ windows
def window(S, fid, hole, flowers=True, idx=0):
    """A cottage window through the real opening in the trunk: a wooden casing lining the hole from the bark to the
    room (head, sill and jambs following the wall's wedge), clear glass in the middle of the wall with glazing bars
    (the game sees the world through it), trim round both faces, a stone sill and a flower box of pixel-leaf
    plants outside, a ledge for a candle inside."""
    from leafart import flower_sprig, FLOWER_KEY
    a, th = hole['a'], hole['half']
    yb, yt = hole['y0'], hole['y1']
    rng = random.Random(idx * 31 + int(a * 100))
    ro = max(R_of(yb), R_of(yt)) + 0.4
    ri = R_IN - 0.6
    depth = ro - ri
    zm = (ro + ri) / 2
    sn, cs = math.sin(th), math.cos(th)
    with S.around(a, name='win'):
        # the casing: head and sill are wedges (wider at the bark than at the room), the jambs lie along the radii
        for name, yy in (('whead', yt - 1.2), ('wsillin', yb)):
            S.part(name, 'taper', [2 * ro * sn + 2.6, 2.4, depth + 1], [0, yy + 1.2 - (0 if name == 'whead' else 0), zm], back_scale=[(ri / ro) * 0.98, 1], style='frame')
        for sx in (-1, 1):
            S.part('wjamb', 'box', [2.4, yt - yb, depth + 1], [sx * zm * sn - sx * 1.0, (yb + yt) / 2, zm * cs], rot=[0, sx * math.degrees(th), 0], style='frame')
        # glass in the middle of the wall, with glazing bars
        gw = 2 * zm * math.tan(th) - 3.2
        gh = yt - yb - 4.4
        gy = (yb + yt) / 2
        S.cbox('wglass', [gw, gh, 0.5], [0, gy, zm], style='glass', pane=True)
        nv = 2 if gw > 26 else 1
        for k in range(1, nv + 1):
            S.cbox('wmullion', [1.2, gh, 1.4], [-gw / 2 + gw * k / (nv + 1), gy, zm], style='frame')
        for k in (1, 2) if gh > 26 else (1,):
            S.cbox('wtransom', [gw, 1.2, 1.4], [0, gy - gh / 2 + gh * k / (3 if gh > 26 else 2), zm], style='frame')
        # trim round the opening on the bark and on the room side
        for z, w in ((ro + 0.5, 2 * ro * sn), (ri - 0.4, 2 * ri * sn)):
            S.cbox('wtrimT', [w + 5, 2.4, 1.2], [0, yt + 0.6, z], style='frame')
            S.cbox('wtrimB', [w + 5, 2.4, 1.2], [0, yb - 0.6, z], style='frame')
            for sx in (-1, 1):
                S.cbox('wtrimS', [2.4, yt - yb + 3.6, 1.2], [sx * (w / 2 + 1.2), (yb + yt) / 2, z], style='frame')
        # outside: a stone sill and a flower box on iron brackets
        w2 = 2 * ro * sn
        S.box('wsill', w2 + 8, 2.4, 6, 0, yb - 3.6, ro + 2, style='stone', chamfer=0.6)
        if flowers:
            S.box('wbox', w2 + 2, 4.4, 4.6, 0, yb - 8.4, ro + 3, style='wood', chamfer=0.4)
            S.box('wsoil', w2 + 1, 0.6, 3.6, 0, yb - 4.2, ro + 3, paint={'ramp': 'dark', 'tone': 1.4})
            for sx in (-1, 1):
                S.slab('wbracket', [sx * (w2 / 2 - 2), yb - 12.4, ro], [sx * (w2 / 2 - 2), yb - 8.6, ro + 3.6], 1.4, 1.4, style='iron')
            cols = ['rose', 'cream', 'lilac', 'ochre', 'rose']
            n = max(3, int(w2 / 4.5))
            for k in range(n):
                fx = -w2 / 2 + 2 + k * (w2 - 4) / max(1, n - 1)
                art = flower_sprig(idx * 11 + k, cols[(k + idx) % 5] != 'cream')
                for t in (0, 1):
                    S.card('wplant', art, [fx, yb - 3.8 + len(art) / 4, ro + 3 + (t - 0.5) * 0.6], plane='xy', key=FLOWER_KEY[cols[(k + idx) % 5]],
                           rot=[0, (t * 70 - 35) + rng.uniform(-10, 10), rng.uniform(-6, 6)])
        S.box('wiledge', 2 * ri * sn + 4, 1.4, 3.6, 0, yb - 1.4, ri - 1.6, style='wood', chamfer=0.4)
    return (yb + yt) / 2


# ------------------------------------------------------------------------------------------------ bark details
def fungus(S, a, y, s=1.0, n=3, seed=0):
    rng = random.Random(seed)
    with S.around(a, name='fung'):
        z = R_of(y)
        for k in range(n):
            w = (10 - k * 2.4) * s * rng.uniform(0.85, 1.15)
            S.part('shelf', 'prism', [w, w * 0.7, 2.2 * s], [rng.uniform(-3, 3) * s, y - k * 4.5 * s, z + w * 0.18], sides=9,
                   rot=[-90, 0, 0], style='fungus', paint={'tone': 4.0 + rng.random() * 0.5})


def knothole(S, a, y, r=6, acorns=True):
    with S.around(a, name='knot'):
        z = R_of(y)
        S.part('knotrim', 'prism', [2 * r + 4, 2 * r + 6, 4], [0, y, z], sides=10, style='bark_limb', hide=['back'])
        S.part('knotlip', 'prism', [2 * r + 1, 2 * r + 2.6, 2], [0, y, z + 1.6], sides=10, style='heartcut', hide=['back'])
        S.part('knothole', 'prism', [2 * r - 1, 2 * r, 1], [0, y, z + 2.3], sides=10, style='soot', hide=['back'])
        if acorns:
            for dx in (-1.6, 1.4):
                S.part('acorn', 'prism', [2.4, 2.4, 2.6], [dx, y - r + 2.4, z + 3.2], sides=6, rot=[-90, 0, 0], paint={'ramp': 'ochre', 'tone': 3.6})
                S.disc('acap', 1.4, y - r + 3.6, y - r + 4.6, dx, z + 3.2, sides=6, paint={'ramp': 'dark', 'tone': 2.6})


def burl(S, a, y, w, h, seed=0):
    """A swollen burl on the bark: a squat loft bulging out of the trunk."""
    with S.around(a, name='burl'):
        z = R_of(y) - 2
        S.loft('burl', [{'at': [0, y, z - 1], 'size': [w * 0.7, h * 0.7]}, {'at': [0, y, z + 2.5], 'size': [w, h]},
                        {'at': [0, y + 0.4, z + 5], 'size': [w * 0.7, h * 0.65]}, {'at': [0, y + 0.6, z + 6.2], 'size': [0.1, 0.1]}],
               sides=10, rnd=2.0, style='bark_limb', caps=(False, False), subdiv=1)


def ivy(S, a0, y0, length, seed, card_every=1):
    """A wandering ivy strand: a thin woody stem and pixel leaf cards."""
    rng = random.Random(seed)
    leaf = ['..gg..', '.gGGg.', 'gGGLGg', 'gGLLGg', '.gGGg.', '..gs..']
    leaf2 = ['.gg.', 'gGLg', 'gGGg', '.gs.']
    key = {'g': 'leaf:2', 'G': 'leaf:4', 'L': 'leaf:6', 's': 'dark:2'}
    a, y = a0, y0
    pts = []
    for k in range(length):
        r = R_of(y) + 0.8
        pts.append((a, y, r))
        y += 4.5
        a += (rng.random() - 0.5) * 0.06
        if abs(a) < OPEN_A + 0.1:
            a += math.copysign(0.05, a)
    for (a1, y1, r1), (a2, y2, r2) in zip(pts, pts[1:]):
        S.rod('ivystem', pol(a1, r1, y1), pol(a2, r2, y2), 0.45, sides=4, paint={'ramp': 'dark', 'tone': 2.4})
    for k, (a1, y1, r1) in enumerate(pts):
        if k % card_every:
            continue
        for side in (-1, 1):
            if rng.random() < 0.25:
                continue
            aa = a1 + side * rng.uniform(0.02, 0.05)
            p = pol(aa, r1 + 0.6, y1 + rng.uniform(-1, 1.5))
            S.card('ivyleaf', leaf if rng.random() < 0.6 else leaf2, p, plane='xy', key=key, rot=[rng.uniform(-20, 10), math.degrees(aa), rng.uniform(-35, 35)])


def chimney(S, y0, y1, top=False):
    """The stone chimney stack climbing the back-left of the trunk, coursed rubble with mossy ledges."""
    S.style('chimney', ramp='stone', tone=3.9, rim={'light_shift': 1.0, 'dark_shift': -1.1}, brush={'flow': 'horizontal', 'length': 3, 'rough': 0.6, 'textures': {'stone': 'stone'}}, layers=[
        pp('rock_face_03', 22, ['stone'], 'stone:5', tint_amount=0.45),
        {'id': 'blocks', 'op': 'scales', 'along': 'x', 'size': [7, 4.5], 'shape': 'square', 'gap': 0.22, 'gradient': 0.6, 'rim': 0.6, 'highlight': 0.8, 'shadow': -1.6, 'jitter': 0.9},
        {'id': 'soot', 'op': 'gradient', 'axis': 'y', 'amount': -0.4},
        {'id': 'moss', 'op': 'patches', 'scale': 8, 'threshold': 0.66, 'ramp': 'moss', 'tone': 3.4, 'bevel': {'shadow': 1, 'highlight': 1}}])
    with S.around(CHIMNEY_A, name='chim'):
        z = R_of((y0 + y1) / 2)
        S.box('stack', 20, y1 - y0, 14, 0, y0, z + 3, style='chimney', hide=['bottom', 'top', 'back'] if not top else ['bottom', 'back'])
        if y0 < 10:
            S.box('stackfoot', 26, 14, 18, 0, 0, z + 5, style='chimney', chamfer=1.5, hide=['bottom'])
        # iron ties binding the stack to the trunk
        for yy in range(int(y0) + 18, int(y1) - 6, 30):
            S.box('tie', 22, 1.6, 15, 0, yy, z + 3.4, style='iron')


# ------------------------------------------------------------------------------------------------ bands
def band(fid):
    y0, y1 = BANDS[fid]
    S = Spec('trunk_' + fid, density=2, desc=f'Hollow oak trunk band {fid}: bark shell, cut lips, slab, windows, chimney')
    styles(S)
    ys = bark_shell(S, fid, y0, y1, moss_foot=(fid == 'f1'))
    cut_lips(S, ys)
    holes = {'f1': [], 'f2': [(*[pol(LADDER_A['f1'], 60)[0], pol(LADDER_A['f1'], 60)[2]], 10)], 'f3': [(*[pol(LADDER_A['f2'], 60)[0], pol(LADDER_A['f2'], 60)[2]], 10)]}[fid]
    slab(S, fid, holes)
    for i, hole in enumerate(window_holes(fid)):
        window(S, fid, hole, flowers=(fid != 'f3'), idx=i + FIDS.index(fid) * 3)
    chimney(S, y0, y1)
    flutes(S, y0, y1)
    rng = random.Random(7 + FIDS.index(fid))
    if fid == 'f1':
        fungus(S, -1.9, 50, 1.1, 3, 1)
        fungus(S, 2.75, 40, 0.8, 2, 2)
        burl(S, -1.45, 24, 22, 18)
        burl(S, 2.78, 18, 18, 14)
        burl(S, -2.9, 36, 16, 20)
        ivy(S, -1.05, 4, 14, 1)
        ivy(S, 1.75, 6, 12, 2)
        ivy(S, -2.55, 4, 14, 3)
    if fid == 'f2':
        fungus(S, 2.32, 96, 1.0, 3, 3)
        fungus(S, -2.75, 118, 0.9, 2, 4)
        burl(S, -1.25, 100, 16, 22)
        burl(S, 3.05, 82, 20, 16)
        knothole(S, -1.62, 112, 5)
        ivy(S, -1.05, 66, 14, 4)
        ivy(S, -2.55, 66, 12, 5)
        ivy(S, 2.55, 70, 12, 6)
    if fid == 'f3':
        fungus(S, -1.4, 182, 0.9, 3, 5)
        fungus(S, 2.6, 166, 1.0, 2, 6)
        knothole(S, 2.2, 192, 7)
        burl(S, -2.4, 160, 18, 16)
        burl(S, 1.35, 150, 14, 20)
        ivy(S, -1.05, 138, 14, 7)
        ivy(S, 1.42, 140, 12, 8)
    return S


def specs():
    return {'trunk_' + f: band(f) for f in FIDS}
