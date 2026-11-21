"""[world3] Pip's travel things for the departure and arrival cinematics, as lowpix specs:
a saddle-leather satchel and its strap, brass flying goggles, a checked cloth bundle of presents,
and the four little things that hop into the satchel (a rolled map, an acorn, a lantern, a biscuit).
Sizes match the old voxel props (16 units = 1 block, origin at the bottom centre) so the cinematic
code attaches them the same way. Written by make.py into specs/props_*.json.
"""

RAMPS = {
    'leather': ['#2a201d', '#3d2d26', '#523b2f', '#694a39', '#7f5b45', '#956f55', '#ab8668', '#c09f7f'],
    'leatherd': ['#221a18', '#31241f', '#433128', '#563f31', '#6b4f3c', '#806249'],
    'brass': ['#3b3020', '#57482b', '#776139', '#977b48', '#b6975b', '#c8a764', '#dcc287', '#ece0b4'],
    'oat': ['#6f6856', '#8f8473', '#b5aa92', '#cfc3a6', '#dccfb0', '#eae0c8', '#f4eedd'],
    'berry': ['#3a2228', '#56303a', '#74424c', '#8e525c', '#a8606a', '#bf7c82'],
    'lake': ['#1f2c33', '#2f4048', '#46596a', '#617f8c', '#86a9b0', '#aec8cc', '#d3e0dc', '#eef3f0'],
    'terra': ['#3d2620', '#58362b', '#74473a', '#8f5a49', '#a66c55', '#c0866a', '#d4a184', '#e4bea2'],
    'nut': ['#3a2a1e', '#56402c', '#73573b', '#8f6f4c', '#a8875f', '#bf9d74', '#d4b68e'],
    'iron': ['#1d2026', '#2a2f37', '#3a414b', '#4c5560', '#5f6a75', '#76818a'],
    'lamp': ['#8e6a3a', '#b48a4c', '#d4ac66', '#e8c784', '#f1d39a', '#f8e6bf', '#fdf4dc'],
    'honey': ['#5a3f22', '#7a5830', '#9a7140', '#b98d52', '#d0a868', '#dcb072', '#e8c994', '#f2dcb4'],
    'wood': ['#2e231c', '#45352a', '#5b4a3c', '#6f553d', '#86694c', '#9c7a56', '#b4946c'],
}
LIGHT = {'dir': [-0.5, 1.0, 0.7], 'strength': 0.7, 'gradient': 0.35, 'ao': 0.6, 'ao_height': 1.5}
BRUSH = {'length': 1.6, 'rough': 0.5, 'width': 0.5, 'overshoot': 0.3, 'flow': 'long',
         'textures': {'leather': 'leather', 'leatherd': 'leather', 'brass': 'metal', 'iron': 'metal', 'oat': 'cloth', 'terra': 'cloth', 'nut': 'wood', 'wood': 'wood'}}
RIM = {'light': 1, 'dark': 1, 'outline': 'none', 'light_shift': 0.8, 'dark_shift': -0.8}

STYLES = {
    'leather': {'ramp': 'leather', 'tone': 4.4, 'rim': RIM, 'layers': [
        {'id': 'grain', 'op': 'noise', 'scale': 1.2, 'amount': 0.45},
        {'id': 'scuffs', 'op': 'spots', 'count': 6, 'radius': [0.3, 0.6], 'shift': 1.2, 'roughness': 0.6},
        {'id': 'wear', 'op': 'wear', 'width': 1, 'density': 0.25, 'shift': 1.0},
        {'id': 'stitch', 'op': 'panel', 'inset': 1, 'shift': -1.2, 'highlight': 0.6, 'shadow': -0.8, 'min_size': 5, 'faces': ['front', 'back', 'top']}]},
    'leatherd': {'ramp': 'leatherd', 'tone': 3.4, 'rim': RIM, 'layers': [{'id': 'grain', 'op': 'noise', 'scale': 1.2, 'amount': 0.4}]},
    'brass': {'ramp': 'brass', 'tone': 4.6, 'light': 1.2, 'rim': {'light': 1, 'dark': 1, 'outline': 'none', 'light_shift': 1.2, 'dark_shift': -1.2},
              'layers': [{'id': 'gloss', 'op': 'gloss', 'post': True, 'dash': True, 'length': 2, 'density': 0.5, 'shift': 1.5}]},
    'glass': {'ramp': 'lake', 'tone': 3.6, 'light': 0.6, 'rim': {'light': 1, 'dark': 0, 'outline': 'none'}, 'brush': {'off': True},
              'layers': [{'id': 'shine', 'op': 'band', 'axis': [1, 1, 0], 'from': 0.1, 'to': 0.35, 'shift': 2.4, 'faces': ['front']},
                         {'id': 'shine2', 'op': 'band', 'axis': [1, 1, 0], 'from': 0.45, 'to': 0.55, 'shift': 1.6, 'faces': ['front']}]},
    'oat': {'ramp': 'oat', 'tone': 4.4, 'rim': RIM, 'layers': [{'id': 'weave', 'op': 'noise', 'scale': 0.8, 'amount': 0.3}]},
    'berry': {'ramp': 'berry', 'tone': 3.4, 'rim': RIM},
    'check': {'ramp': 'terra', 'tone': 4.2, 'rim': {'light': 1, 'dark': 1, 'outline': 'none'}, 'layers': [
        {'id': 'checkx', 'op': 'stripes', 'axis': 'x', 'period': 2.4, 'width': 0.35, 'ramp': 'oat', 'tone': 4.4, 'space': 'world'},
        {'id': 'checkz', 'op': 'stripes', 'axis': 'z', 'period': 2.4, 'width': 0.35, 'ramp': 'oat', 'tone': 4.0, 'space': 'world'},
        {'id': 'weave', 'op': 'noise', 'scale': 0.7, 'amount': 0.35}]},
    'nut': {'ramp': 'nut', 'tone': 4.4, 'light': 1.1, 'rim': RIM, 'layers': [
        {'id': 'streaks', 'op': 'stripes', 'axis': 'path', 'period': 0.6, 'width': 0.2, 'shift': -0.8, 'wobble': 0.4},
        {'id': 'gloss', 'op': 'gloss', 'post': True, 'dash': True, 'length': 2, 'density': 0.4, 'shift': 1.4}]},
    'cupule': {'ramp': 'wood', 'tone': 3.2, 'rim': RIM, 'layers': [
        {'id': 'scales', 'op': 'scales', 'along': 'x', 'size': [1.0, 0.8], 'gradient': 1.0, 'rim': 1.0, 'shadow': -1.6, 'jitter': 0.5}]},
    'iron': {'ramp': 'iron', 'tone': 3.4, 'rim': RIM, 'layers': [{'id': 'wear', 'op': 'wear', 'width': 1, 'density': 0.2, 'ramp': 'brass', 'tone': 3.6}]},
    'lamp': {'ramp': 'lamp', 'tone': 5.0, 'light': 0.25, 'rim': {'light': 0, 'dark': 0, 'outline': 'none'}, 'brush': {'off': True},
             'layers': [{'id': 'core', 'op': 'band', 'axis': 'y', 'from': -0.4, 'to': 0.3, 'shift': 1.4}]},
    'biscuit': {'ramp': 'honey', 'tone': 4.6, 'light': 1.1, 'rim': {'light': 1, 'dark': 1, 'outline': 'none'}, 'layers': [
        {'id': 'bake', 'op': 'noise', 'scale': 0.8, 'amount': 0.5},
        {'id': 'sugar', 'op': 'spots', 'count': 14, 'radius': [0.15, 0.3], 'ramp': 'oat', 'tone': 6.0, 'roughness': 0.1, 'faces': ['up'], 'min_gap': 0.4},
        {'id': 'edge', 'op': 'band', 'axis': 'y', 'from': -1.0, 'to': -0.2, 'shift': -1.0}]},
}


def spec(name, parts, budget=600):
    return {'name': name, 'description': "Pip's travel things (art/lowpix/world/props.py).", 'license': 'CC0-1.0', 'density': 4,
            'budget': {'tris': budget, 'colors': 80}, 'light': LIGHT, 'brush': BRUSH, 'render': {'background': '#26303a', 'hero': [32, 22], 'shadow': 0.4},
            'material': {'unlit': False, 'roughness': 1.0}, 'palette': {'ramps': RAMPS}, 'styles': STYLES, 'parts': parts}


def satchel():
    return spec('Satchel', [
        {'id': 'body', 'shape': 'box', 'size': [7, 5, 3], 'pivot': [0, 0, 0], 'offset': [0, 2.5, 0], 'chamfer': 0.6, 'style': 'leather'},
        {'id': 'flap', 'shape': 'taper', 'size': [7.4, 2.8, 3.6], 'pivot': [0, 4.0, 0.15], 'chamfer': 0.4, 'style': 'leather', 'front_scale': [1, 0.92],
         'paint': {'ramp': 'leather', 'tone': 3.6, 'layers': [{'id': 'stitch', 'faces': ['front', 'top', 'back']}]}},
        {'id': 'gusset', 'shape': 'box', 'size': [0.5, 3.6, 2.4], 'pivot': [3.6, 2.3, 0], 'mirror': True, 'style': 'leatherd'},
        {'id': 'buckle', 'shape': 'box', 'size': [1.8, 1.8, 0.5], 'pivot': [0, 3.3, 2.0], 'chamfer': 0.3, 'style': 'brass'},
        {'id': 'tongue', 'shape': 'box', 'size': [0.8, 1.4, 0.3], 'pivot': [0, 3.4, 2.3], 'style': 'leatherd'},
        {'id': 'stud', 'shape': 'prism', 'sides': 6, 'size': [0.7, 0.7, 0.3], 'pivot': [2.6, 1.0, 1.55], 'mirror': True, 'style': 'brass'},
    ], 400)


def strap():
    return spec('Strap', [{'id': 'strap', 'shape': 'box', 'size': [1.2, 16, 0.6], 'pivot': [0, 0, 0], 'offset': [0, 8, 0], 'style': 'leatherd',
                           'paint': {'layers': [{'id': 'holes', 'op': 'stripes', 'axis': 'y', 'period': 3.0, 'width': 0.12, 'shift': -1.4, 'faces': ['front', 'back']}]}}], 60)


def goggles():
    lens = lambda x: [
        {'id': f'rim_{x}', 'shape': 'prism', 'sides': 10, 'size': [4.3, 4.3, 1.3], 'pivot': [x, 2.1, 0], 'style': 'brass'},
        {'id': f'lens_{x}', 'shape': 'prism', 'sides': 10, 'size': [3.1, 3.1, 0.4], 'pivot': [x, 2.1, 0.55], 'style': 'glass', 'hide': ['back']},
    ]
    return spec('Goggles', [
        {'id': 'band', 'shape': 'box', 'size': [17, 1.6, 0.8], 'pivot': [0, 1.2, -1.0], 'style': 'leatherd',
         'paint': {'layers': [{'id': 'stitch', 'op': 'stripes', 'axis': 'x', 'period': 1.0, 'width': 0.3, 'ramp': 'oat', 'tone': 3.0, 'faces': ['front'], 'range': [-0.2, 0.2]}]}},
        *lens(-2.6), *lens(2.6),
        {'id': 'bridge', 'shape': 'box', 'size': [1.4, 0.8, 0.8], 'pivot': [0, 2.6, 0.2], 'chamfer': 0.2, 'style': 'brass'},
    ], 500)


def bundle():
    rings = [{'at': [0, 0, 0], 'size': [7.2, 7.2]}, {'at': [0, 1.5, 0], 'size': [9.0, 9.0]}, {'at': [0, 4.0, 0], 'size': [8.6, 8.6]},
             {'at': [0, 6.0, 0], 'size': [5.0, 5.0]}, {'at': [0, 6.8, 0], 'size': [3.0, 3.0]}]
    return spec('Bundle', [
        {'id': 'sack', 'shape': 'loft', 'profile': {'sides': 8, 'round': 2.6}, 'subdiv': 1, 'caps': [True, False], 'up': [0, 0, 1], 'rings': rings, 'style': 'check'},
        {'id': 'knot', 'shape': 'loft', 'profile': {'sides': 6, 'round': 2.4}, 'subdiv': 0, 'caps': [True, True], 'up': [0, 0, 1],
         'rings': [{'at': [0, 6.4, 0], 'size': 2.6}, {'at': [0, 7.6, 0], 'size': 2.8}, {'at': [0, 8.4, 0], 'size': 1.6}], 'style': 'check'},
        {'id': 'ear', 'shape': 'loft', 'profile': {'sides': 5, 'round': 2.2}, 'subdiv': 0, 'caps': [False, True], 'mirror': True,
         'rings': [{'at': [0.6, 7.6, 0], 'size': [2.0, 1.0]}, {'at': [2.4, 8.6, 0.2], 'size': [2.4, 1.2]}, {'at': [3.4, 9.0, 0.3], 'size': [0.6, 0.4]}], 'style': 'check'},
        {'id': 'tag', 'shape': 'box', 'size': [2.4, 2.4, 0.3], 'pivot': [3.0, 3.2, 4.2], 'rotation': [0, 25, -8], 'chamfer': 0.4, 'style': 'brass'},
    ], 700)


def items():
    return {
        'item0': spec('Map', [
            {'id': 'scroll', 'shape': 'prism', 'sides': 8, 'size': [2, 2, 5], 'pivot': [0, 1, 0], 'rotation': [0, 90, 0], 'style': 'oat',
             'paint': {'layers': [{'id': 'ink', 'op': 'spots', 'count': 5, 'radius': [0.2, 0.4], 'ramp': 'wood', 'tone': 2.0, 'faces': ['sides']}]}},
            {'id': 'ribbon', 'shape': 'prism', 'sides': 8, 'size': [2.25, 2.25, 1.0], 'pivot': [0, 1, 0], 'rotation': [0, 90, 0], 'style': 'berry', 'hide': ['front', 'back']},
        ], 120),
        'item1': spec('Acorn', [
            {'id': 'nut', 'shape': 'loft', 'profile': {'sides': 8, 'round': 2.2}, 'subdiv': 1, 'caps': [True, False], 'up': [0, 0, 1],
             'rings': [{'at': [0, 0, 0], 'size': 0.6}, {'at': [0, 0.6, 0], 'size': 2.2}, {'at': [0, 1.8, 0], 'size': 3.0}, {'at': [0, 2.8, 0], 'size': 2.9}], 'style': 'nut'},
            {'id': 'cup', 'shape': 'loft', 'profile': {'sides': 8, 'round': 2.2}, 'subdiv': 0, 'caps': [True, True], 'up': [0, 0, 1],
             'rings': [{'at': [0, 2.3, 0], 'size': 3.3}, {'at': [0, 3.2, 0], 'size': 3.7}, {'at': [0, 3.8, 0], 'size': 2.6}], 'style': 'cupule'},
            {'id': 'stalk', 'shape': 'prism', 'sides': 5, 'size': [0.6, 0.6, 1.0], 'pivot': [0, 4.2, 0], 'rotation': [-80, 0, 0], 'style': 'cupule'},
        ], 200),
        'item2': spec('Lantern', [
            {'id': 'base', 'shape': 'box', 'size': [2.6, 0.6, 2.6], 'pivot': [0, 0.3, 0], 'chamfer': 0.2, 'style': 'iron'},
            {'id': 'glow_glass', 'shape': 'prism', 'sides': 6, 'size': [2.0, 2.0, 2.4], 'pivot': [0, 1.8, 0], 'rotation': [-90, 0, 0], 'style': 'lamp'},
            {'id': 'bar', 'shape': 'box', 'size': [0.3, 2.4, 0.3], 'pivot': [0.95, 1.8, 0.95], 'mirror': True, 'style': 'iron'},
            {'id': 'bar2', 'shape': 'box', 'size': [0.3, 2.4, 0.3], 'pivot': [0.95, 1.8, -0.95], 'mirror': True, 'style': 'iron'},
            {'id': 'cap', 'shape': 'taper', 'size': [2.6, 2.6, 0.7], 'pivot': [0, 3.3, 0], 'rotation': [-90, 0, 0], 'front_scale': [0.5, 0.5], 'style': 'iron'},
            {'id': 'ring', 'shape': 'box', 'size': [1.0, 0.8, 0.3], 'pivot': [0, 3.9, 0], 'style': 'brass'},
        ], 200),
        'item3': spec('Biscuit', [
            {'id': 'biscuit', 'shape': 'prism', 'sides': 10, 'size': [4, 4, 1], 'pivot': [0, 0.5, 0], 'rotation': [-90, 0, 0], 'chamfer': 0, 'style': 'biscuit'},
        ], 100),
    }


def all_props():
    out = {'props_satchel': satchel(), 'props_strap': strap(), 'props_goggles': goggles(), 'props_bundle': bundle()}
    for k, v in items().items():
        out['props_' + k] = v
    return out
