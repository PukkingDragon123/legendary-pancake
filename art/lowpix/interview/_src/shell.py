"""The office itself: the hollow inside the old oak. Curved heartwood walls with a panelled wainscot and a chair rail,
a plank floor cut from the trunk, a planked ceiling on two beams, and the mossy bark rim framing the shot.
Origin: the centre of the floor; the room opens towards +z (the camera)."""
import math

from _kit import Spec, wood, flat, photo, RAMPS

R, H, A0, A1, N = 5.125, 5.75, -86.0, 86.0, 26


def room():
    S = Spec('room', density=28, tris=12000, light=dict(dir=[-0.3, 1.0, 0.8], strength=0.25, gradient=0.35, ao=0.6, ao_height=1.2))
    S.styles(
        wall=wood('heart', 3.4, ph='oak_veneer_01', scale=2.2, amount=0.6, flow='vertical', worn=False, rim=0.4, layers=[
            dict(op='stripes', id='grain', axis='x', period=0.11, width=0.12, wobble=0.9, shift=-0.5, space='world'),
            dict(op='patches', id='knots', scale=0.5, threshold=0.86, shift=-1.4, bevel=True, space='world'),
            dict(op='gradient', id='up', axis='y', amount=-0.9)]),
        wain=wood('wain', 3.2, ph='oak_veneer_01', scale=1.0, flow='vertical', rim=0.6, layers=[
            dict(op='panel', id='raised', inset=4, shift=1.0, highlight=1, shadow=1),
            dict(op='panel', id='groove', inset=7, shift=-0.9, highlight=1, shadow=1)]),
        rail=wood('walnut', 3.4, ph='wood_table_001', scale=1.0),
        skirt=wood('deep', 3.2, ph='wood_table_001'),
        floor=wood('floor', 3.3, ph='weathered_planks', scale=2.4, amount=0.7, flow='x', worn=False, rim=0.3, layers=[
            dict(op='stripes', id='seams', axis='z', period=0.42, width=0.05, shift=-1.8, space='world', faces=['top']),
            dict(op='stripes', id='ends', axis='x', period=2.7, width=0.012, shift=-1.6, space='world', faces=['top'], phase=0.3),
            dict(op='spots', id='nails', count=60, radius=[0.02, 0.03], ramp='iron', tone=2.6, faces=['top']),
            dict(op='patches', id='scuff', scale=0.8, threshold=0.7, shift=0.6, space='world')]),
        rings=wood('oakpale', 3.2, worn=False, layers=[dict(op='stripes', id='rings', axis='y', period=0.09, width=0.2, shift=-1.0)]),
        ceil=wood('walnut', 3.0, ph='weathered_planks', scale=2.0, worn=False, flow='x', layers=[
            dict(op='stripes', id='boards', axis='z', period=0.5, width=0.05, shift=-1.6, space='world')]),
        beam=wood('deep', 3.4, ph='wood_table_001', scale=1.5),
        bark=dict(ramp='bark', tone=3.2, brush={'flow': 'vertical', 'rough': 0.8}, rim={'light_shift': 0.8, 'dark_shift': -1.0, 'outline': 'none'},
                  layers=[photo('bark_brown_02', scale=1.4, amount=1.4, id='bark'), dict(op='stripes', id='ridges', axis='x', period=0.24, width=0.35, wobble=1.2, shift=-1.2),
                          dict(op='patches', id='moss', scale=0.6, threshold=0.55, ramp='moss', tone=3.0, bevel=True),
                          dict(op='drip', id='mossdrip', ramp='moss', tone=3.4, depth=0.2, length=0.6)]),
    )
    step = (A1 - A0) / N
    T = 0.5
    for i in range(N):
        a = A0 + step * (i + 0.5)
        r = math.radians(a)
        L = 2 * math.pi * R * step / 360 + 0.04
        cx, cz = math.sin(r) * (R + T / 2), -math.cos(r) * (R + T / 2)
        rot = [0, -a, 0]
        # a box whose front face looks into the room (+z of the box points at the centre)
        S.cbox('wall', [L, H - 1.22 + 0.3, T], [cx, 1.22 + (H - 1.22 + 0.3) / 2, cz], rot=rot, style='wall', hide=['back', 'top', 'bottom'])
        S.cbox('wain', [L, 1.08, T], [cx, 0.14 + 0.54, cz], rot=rot, style='wain', hide=['back', 'top', 'bottom'])
        ix, iz = math.sin(r) * (R + 0.03), -math.cos(r) * (R + 0.03)
        S.cbox('rail', [L, 0.1, 0.12], [ix - math.sin(r) * 0.06, 1.24, iz + math.cos(r) * 0.06], rot=rot, style='rail', hide=['back'])
        S.cbox('skirt', [L, 0.16, 0.08], [ix - math.sin(r) * 0.04, 0.08, iz + math.cos(r) * 0.04], rot=rot, style='skirt', hide=['back', 'bottom'])
    # the floor: a slice of the trunk, planks on top and growth rings on the cut edge (strips approximate the disc)
    z = -R - 0.4
    while z < R + 0.6:
        zc = z + 0.25
        half = math.sqrt(max(0.0, (R + 0.5) ** 2 - zc * zc))
        if half > 0.3:
            S.cbox('floor', [half * 2, 0.6, 0.5], [0, -0.3, zc], style='floor', hide=['bottom', 'back'] if zc < R - 0.5 else ['bottom'])
        z += 0.5
    # the ceiling, its beams and the cross-ties
    S.cbox('ceiling', [2 * R + 1.4, 0.3, 9.4], [0, H + 0.15, -1.6], style='ceil', hide=['top'])
    for x in (-2.1, 2.1):
        S.cbox('beam', [0.5, 0.4, 9.2], [x, H - 0.2, -1.6], style='beam', chamfer=0.04, hide=['top'])
    S.cbox('tie', [2 * R + 0.4, 0.36, 0.42], [0, H - 0.18, -3.2], style='beam', chamfer=0.04, hide=['top'])
    # the bark rim of the cut-open trunk: two great posts and the lintel
    for sx in (-1, 1):
        S.cbox('post', [1.1, H + 1.6, 1.1], [sx * (R + 0.3), (H + 1.6) / 2 - 0.6, 0.2], rot=[0, sx * 8, 0], style='bark', chamfer=0.25)
        S.cbox('root', [1.5, 0.7, 1.4], [sx * (R + 0.2), -0.25, 0.5], rot=[0, sx * 20, sx * -8], style='bark', chamfer=0.25)
        S.cbox('shoulder', [1.6, 0.9, 1.1], [sx * (R - 0.7), H + 0.3, 0.2], rot=[0, 0, sx * -24], style='bark', chamfer=0.25)
    S.cbox('lintel', [2 * R + 2.6, 1.1, 1.1], [0, H + 0.85, 0.2], style='bark', chamfer=0.25)
    return S


def specs():
    return {'room': room()}
