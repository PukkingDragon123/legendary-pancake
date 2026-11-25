"""Barnaby at his workbench: the hand tools he works with and his craft clips (imported by beaver.py).

The game builds the workbench and the work on it (src/world/stages/lodgekit.ts, workbench()) in Barnaby's own frame,
from the numbers below (Blender: metres before his in-game scale, z up, he faces -Y; three.js: x, z, -y). A long pine
plank lies along the bench, overhanging its right end (his right): he marks a line with the try square and the
pencil from behind his ear, saws the end off, planes the plank (a shaving curls off every stroke), chops a mortise in
it with the chisel and mallet, sands it, blows the dust off, and now and then lifts the little stool he finished
earlier off the bench to admire it.

Every tool is a real, properly shaped model held rigidly in his paw: the handsaw and the No. 4 smoothing plane are Poly
Haven scans (CC0), the mallet, chisel, try square, sanding block and the stool are modelled here and painted into the
kit atlas (wood grain, steel, brass, glasspaper). Each tool rides its own bone under a hand and is shown (scale 1) only
while he holds it; a still copy of each lies on the bench where he picks it up and puts it down (`rest_<tool>` nodes,
not skinned) and the game swaps the two at the exact frames listed by `timeline()` (the swaps happen with the paw on
the tool, so nothing pops).

The clips are posed per frame (every 2 frames) by inverse kinematics: the body leans and steps, each tool's contact
point (saw teeth in the kerf, plane sole on the plank, chisel edge in the mortise, pencil point on the line, block on
the wood) is put exactly where the work is, the paw takes the tool's orientation, and the arm is solved to the wrist.
`check()` then poses the real skinned mesh at sampled frames and reports any vertex of his body or a tool that dips
into the bench, the plank or the stool (the build fails loudly on clipping).
"""
import json
import math
import os

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Quaternion, Vector

FPS = 24
# ------------------------------------------------------------------ the work, in Barnaby's frame
BENCH = {'top': 0.5, 'near': -0.237, 'far': -0.52, 'x0': -0.62, 'x1': 0.62}
BOARD = {'near': -0.25, 'far': -0.34, 'top': 0.526, 'bottom': 0.5, 'right': -0.88, 'left': 1.0}
BY = (BOARD['near'] + BOARD['far']) / 2
CUT_X = -0.73
MORTISE = (0.32, BY)
STOOL = {'x': 0.53, 'y': -0.381, 'h': 0.165, 'r': 0.07}
# the tool tote on the bench (the game builds it): the chisel and mallet stand in it, either side of its handle board
TOTE = {'x0': 0.065, 'x1': 0.36, 'y0': -0.344, 'y1': -0.432, 'rail': -0.42, 'floor': 0.008, 'wall': 0.035}
# where his paws rest on the plank when he isn't working (the stance of every clip): x = +-REST_X, on the near edge
REST_X = 0.19
REST_IN = 0.02
SLIDE = 0.15          # the plank slides this far right before each cut
STEP_R = 0.6          # he steps this far to his right to mark at the bench's end
STEP_SAW = float(os.environ.get('STEP_SAW', 0.48))  # ... and this far to saw
# where each tool lies on the bench when he isn't using it (model frame -> Barnaby's frame; set in place_rests())
REST = {}

PH_IDS = {'saw': 'handsaw_wood', 'plane': 'hand_plane_no4'}
HAND = {'saw': 'r', 'plane': 'r', 'mallet': 'r', 'chisel': 'l', 'square': 'l', 'block': 'r', 'stool': 'r'}
TOOLS = ['saw', 'plane', 'mallet', 'chisel', 'square', 'block', 'stool']
EV = {}   # clip -> list of (frame, kind, data)
SW = {}   # grain strips in the kit atlas: name -> (v0, v1)


def V(*a):
    return Vector(a if len(a) > 1 else a[0])


def sm(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def seg(f, f0, f1):
    """0..1 eased progress of frame f through [f0, f1]."""
    return sm((f - f0) / max(1e-6, f1 - f0))


def basis(y, z):
    """A rotation whose Y axis points along y and Z axis along z (orthogonalised), X = Y x Z."""
    y = Vector(y).normalized()
    z = Vector(z)
    z = (z - y * z.dot(y)).normalized()
    x = y.cross(z).normalized()
    return Matrix((x, y, z)).transposed()


def rot_q(axis, deg):
    return Quaternion(Vector(axis).normalized(), math.radians(deg))


# ------------------------------------------------------------------ Poly Haven sources (CC0), fetched once
def fetch(asset, build):
    """Download a Poly Haven model's 1k glTF (with its .bin and textures) into the build folder once (curl, which
    goes through the machine's proxy settings)."""
    import subprocess
    d = os.path.join(build, 'ph', asset)
    path = os.path.join(d, f'{asset}_1k.gltf')
    if os.path.exists(path):
        return path
    os.makedirs(os.path.join(d, 'textures'), exist_ok=True)
    get = lambda url, out: subprocess.run(['curl', '-sfL', '--max-time', '90', '-o', out, url], check=True)
    get(f'https://api.polyhaven.com/files/{asset}', os.path.join(d, 'files.json'))
    info = json.load(open(os.path.join(d, 'files.json')))['gltf']['1k']['gltf']
    for rel, v in info['include'].items():
        get(v['url'], os.path.join(d, rel))
    get(info['url'], path)
    return path


def import_ph(asset, build, tris=1600, tex=512, scale=1.0):
    """One Poly Haven model as a single mesh object (transforms applied, scaled to Barnaby's paws), decimated, its
    colour map downsized; the normal and roughness maps are dropped (the cel light and the outline carry the form at
    this size)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=fetch(asset, build))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    for o in meshes:
        o.data = o.data.copy()
        o.data.transform(Matrix.Scale(scale, 4) @ o.matrix_world)
        o.parent = None
        o.matrix_world = Matrix.Identity(4)
    for o in new:
        if o.type != 'MESH':
            bpy.data.objects.remove(o)
    ob = meshes[0]
    if len(meshes) > 1:
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.join()
    n = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if n > tris:
        m = ob.modifiers.new('dec', 'DECIMATE')
        m.ratio = tris / n
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        ob.modifiers.clear()
        ob.data = me
    for mat in ob.data.materials:
        nt = mat.node_tree
        bsdf = next(nd for nd in nt.nodes if nd.type == 'BSDF_PRINCIPLED')
        for nd in list(nt.nodes):
            if nd.type == 'TEX_IMAGE' and not any(l.to_socket == bsdf.inputs['Base Color'] for l in nd.outputs['Color'].links):
                nt.nodes.remove(nd)
            elif nd.type == 'NORMAL_MAP' or nd.type == 'SEPARATE_COLOR' or nd.type == 'SEPRGB':
                nt.nodes.remove(nd)
        for nd in nt.nodes:
            if nd.type == 'TEX_IMAGE' and nd.image and max(nd.image.size) > tex:
                nd.image.scale(tex, tex)
                nd.interpolation = 'Linear'
        bsdf.inputs['Roughness'].default_value = 0.55
        bsdf.inputs['Metallic'].default_value = 0.0
        mat.name = 'tool_' + asset
    ob.name = asset
    return ob


# ------------------------------------------------------------------ procedural parts (in a tool's model frame)
def _obj(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def lathe(name, prof, axis_from, axis_to, n=12, grain='beech', flat=None):
    """A turned part: profile [(r, t)] with t 0..1 along axis_from -> axis_to. flat: (k, dir) squashes the section."""
    a, b = Vector(axis_from), Vector(axis_to)
    ax = (b - a)
    L = ax.length
    ax.normalize()
    u = ax.cross(Vector((0, 0, 1)) if abs(ax.z) < 0.9 else Vector((1, 0, 0))).normalized()
    w = ax.cross(u).normalized()
    bm = bmesh.new()
    rings = []
    for r, t in prof:
        ring = []
        for i in range(n):
            th = i / n * math.tau
            cu, cw = math.cos(th) * r, math.sin(th) * r
            if flat:
                cw *= flat
            ring.append(bm.verts.new(a + ax * (t * L) + u * cu + w * cw))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(n):
            bm.faces.new((rings[k][i], rings[k][(i + 1) % n], rings[k + 1][(i + 1) % n], rings[k + 1][i]))
    if prof[0][0] > 1e-4:
        bm.faces.new(list(reversed(rings[0])))
    if prof[-1][0] > 1e-4:
        bm.faces.new(rings[-1])
    ob = _obj(name, bm)
    ob['grain'] = grain
    ob['gaxis'] = tuple(ax)
    return ob


def block(name, lo, hi, grain='beech', bevel=0.002, gaxis=(1, 0, 0), taper=None):
    """A bevelled box from corner lo to corner hi (taper: (axis, k) narrows the far end along that axis)."""
    lo, hi = Vector(lo), Vector(hi)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    s = hi - lo
    bm.transform(Matrix.Diagonal((max(s.x, 1e-4), max(s.y, 1e-4), max(s.z, 1e-4), 1)))
    if taper:
        ax, k = taper
        for v in bm.verts:
            t = v.co[ax] / s[ax] + 0.5
            for j in range(3):
                if j != ax:
                    v.co[j] *= 1 - (1 - k) * t
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect='EDGES', profile=0.5)
    bm.transform(Matrix.Translation((lo + hi) / 2))
    ob = _obj(name, bm)
    ob['grain'] = grain
    ob['gaxis'] = tuple(gaxis)
    return ob


def join(obs, name):
    for o in obs:
        if 'grain' in o:
            grain_uvs(o)
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob


def grain_uvs(ob):
    """Map each part onto its grain strip in the kit atlas: u along the grain (wrapping), v across it."""
    me = ob.data
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active
    gname = ob.get('grain', 'beech')
    v0, v1 = SW[gname]
    ax = Vector(ob.get('gaxis', (1, 0, 0))).normalized()
    side = ax.cross(Vector((0, 0, 1)) if abs(ax.z) < 0.9 else Vector((1, 0, 0))).normalized()
    up = ax.cross(side)
    for poly in me.polygons:
        n = poly.normal
        across = side if abs(n.dot(up)) > abs(n.dot(side)) else up
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            u = 0.5 + 0.5 * ((co.dot(ax) * 3.1) % 1.0)
            v = v0 + (v1 - v0) * (0.08 + 0.84 * ((co.dot(across) * 9.0 + 0.5) % 1.0))
            uv.data[li].uv = (u, v)


# ------------------------------------------------------------------ the kit atlas: grain strips
STRIPS = ['beech', 'ash', 'rosewood', 'boxwood', 'steel', 'paper', 'honey', 'cork', 'brass2', 'iron']


def paint_strips(img, pk):
    """Wood grain, steel, glasspaper, cork and brass, as 32-row strips across the right half of the kit atlas
    (rows 64..256 and 384..512: free of the apron, the pocket and the swatches)."""
    n = img.shape[0]
    rows = list(range(64, 256, 32))[:6] + list(range(384, 512, 32))[:4]
    cols = {'beech': '#d9ab78', 'ash': '#e2c79c', 'rosewood': '#6e3a2a', 'boxwood': '#e8c27a', 'steel': '#9aa3ad',
            'paper': '#c9a46a', 'honey': '#cf8f45', 'cork': '#b98b5e', 'brass2': '#c9a35a', 'iron': '#3a3836'}
    x0 = n // 2
    w = n - x0
    yy, xx = np.mgrid[0:32, 0:w]
    for nm, r0 in zip(STRIPS, rows):
        R = pk.ramp(cols[nm], 9, light=0.42)
        P3 = np.stack([xx * 0.02, yy * 0.11, np.zeros_like(xx, dtype=float)], -1)
        if nm in ('beech', 'ash', 'rosewood', 'boxwood', 'honey'):
            # long grain: wavy lines along u, rays and a few darker latewood bands
            wav = yy + np.sin(xx * 0.045 + yy * 0.3) * 2.2 + (pk.fbm(P3 * 1.4, 3, 7) - 0.5) * 6
            band = (np.sin(wav * (0.9 if nm != 'rosewood' else 1.4)) > 0.55) * -1.1
            fleck = ((pk.fbm(P3 * 6, 2, 11) > 0.78) & ((xx + yy * 3) % 5 == 0)) * 0.7
            idx = 4.3 + band + fleck + (pk.fbm(P3 * 0.6, 3, 3) - 0.5) * 1.6
            if nm == 'honey':
                idx = idx + (((xx * 5 + yy * 2) % 37) == 0) * 1.8  # varnish glints
        elif nm == 'steel':
            idx = 5.0 + (yy / 31 - 0.5) * 2.4 + ((xx * 3 + yy) % 7 == 0) * 0.6 - (pk.fbm(P3 * 2, 2, 5) > 0.75) * 1.2
        elif nm == 'paper':
            idx = 4 + ((xx * 7 + yy * 13) % 5 == 0) * 1.4 - ((xx * 11 + yy * 3) % 7 == 0) * 1.2
        elif nm == 'cork':
            idx = 4 + (pk.fbm(P3 * 5, 2, 9) - 0.5) * 5
        elif nm == 'brass2':
            idx = 4.6 + (yy / 31 - 0.5) * 2.8 + ((xx + yy) % 9 == 0) * 0.8
        else:
            idx = 3.6 + (pk.fbm(P3 * 3, 2, 2) - 0.5) * 2.2
        img[r0:r0 + 32, x0:] = pk.pick(R, idx)
        SW[nm] = ((r0 + 1.5) / n, (r0 + 30.5) / n)


# ------------------------------------------------------------------ the tools (model frames; origin = grip)
def make_mallet():
    """A joiner's mallet: a beech head with tapered faces, an ash handle wedged through it (head along X at +Y)."""
    parts = [lathe('m_handle', [(0.0001, 0), (0.0105, 0.02), (0.0118, 0.3), (0.0105, 0.68), (0.0098, 0.975), (0.0001, 1.0)],
                   (0, -0.06, 0), (0, 0.145, 0), n=10, grain='ash'),
             block('m_head', (-0.05, 0.096, -0.027), (0.05, 0.15, 0.027), grain='beech', bevel=0.004, gaxis=(1, 0, 0))]
    # the faces lean in toward the handle side (a real mallet's tapered faces)
    head = parts[1]
    for v in head.data.vertices:
        if v.co.y < 0.12:
            v.co.x *= 0.92
    ob = join(parts, 'tool_mallet')
    return ob, {'grip': V(0, 0, 0), 'A': (V(0, 1, 0), V(0, 0, 1)), 'face': V(-0.05, 0.123, 0)}


def make_chisel():
    """A bevel-edged firmer chisel: boxwood handle, brass ferrule, steel blade with its bevel (edge at -Y)."""
    parts = [lathe('c_handle', [(0.0001, 0), (0.0098, 0.01), (0.0112, 0.35), (0.0104, 0.8), (0.0088, 0.97), (0.0001, 1.0)],
                   (0, -0.024, 0), (0, 0.058, 0), n=10, grain='boxwood'),
             lathe('c_ferrule', [(0.0082, 0), (0.0086, 0.5), (0.0082, 1.0)], (0, -0.034, 0), (0, -0.022, 0), n=10, grain='brass2'),
             lathe('c_neck', [(0.0001, 0), (0.0045, 0.05), (0.0035, 1.0)], (0, -0.043, 0), (0, -0.032, 0), n=6, grain='steel')]
    bl = block('c_blade', (-0.008, -0.105, -0.0022), (0.008, -0.041, 0.0022), grain='steel', bevel=0.0006, gaxis=(0, 1, 0))
    for v in bl.data.vertices:       # the bevel: the back of the blade ground off toward the edge
        if v.co.y < -0.088 and v.co.z > 0:
            v.co.z = -0.0022 + 0.0044 * max(0.0, (v.co.y + 0.105) / 0.017)
    parts.append(bl)
    ob = join(parts, 'tool_chisel')
    return ob, {'grip': V(0, 0, 0), 'A': (V(0, 1, 0), V(0, 0, 1)), 'tip': V(0, -0.105, -0.0015), 'top': V(0, 0.058, 0)}


def make_square():
    """A try square: a rosewood stock along Y (held), a steel blade along +X from its -Y end, three brass rivets."""
    parts = [block('s_stock', (-0.009, -0.05, -0.013), (0.009, 0.05, 0.004), grain='rosewood', bevel=0.0015, gaxis=(0, 1, 0)),
             block('s_blade', (0.009, -0.05, -0.0008), (0.15, -0.034, 0.0008), grain='steel', bevel=0.0, gaxis=(1, 0, 0))]
    for k in range(3):
        parts.append(lathe('s_rivet', [(0.0028, 0), (0.0028, 1)], (0, -0.04 + k * 0.035, 0.0062), (0, -0.04 + k * 0.035, 0.0068), n=8, grain='brass2'))
    ob = join(parts, 'tool_square')
    # the pencil runs along the blade's edge nearest the stock's middle (y = -0.034)
    return ob, {'grip': V(0, 0.03, 0.03), 'A': (V(0, 1, 0), V(0, 0, -1)), 'edge': V(0.009, -0.034, 0)}


def make_block():
    """A cork sanding block wrapped in glasspaper (sanding face at -Z, the paw on top)."""
    parts = [block('b_cork', (-0.02, -0.036, -0.004), (0.02, 0.036, 0.022), grain='cork', bevel=0.003, gaxis=(0, 1, 0)),
             block('b_paper', (-0.0205, -0.0365, -0.0072), (0.0205, 0.0365, -0.0038), grain='paper', bevel=0.0, gaxis=(0, 1, 0))]
    ob = join(parts, 'tool_block')
    return ob, {'grip': V(0, 0, 0.05), 'A': (V(-1, 0, 0), V(0, -1, 0)), 'face': V(0, 0, -0.0072)}


def make_stool():
    """The little milking stool he finished: a round dished seat on three splayed turned legs, honey varnish."""
    h, r = STOOL['h'], STOOL['r']
    parts = [lathe('st_seat', [(0.0001, 0), (r * 0.96, 0.0), (r, 0.25), (r, 0.75), (r * 0.95, 1.0), (0.0001, 1.0)],
                   (0, 0, h - 0.018), (0, 0, h), n=20, grain='honey')]
    for k in range(3):
        a = k / 3 * math.tau + math.pi / 2
        top = V(math.cos(a) * r * 0.5, math.sin(a) * r * 0.5, h - 0.016)
        foot = V(math.cos(a) * r * 1.05, math.sin(a) * r * 1.05, 0.0)
        parts.append(lathe('st_leg', [(0.0001, 0), (0.0062, 0.02), (0.0075, 0.3), (0.0085, 0.55), (0.0068, 0.85), (0.0075, 0.97), (0.0001, 1.0)],
                           foot, top, n=8, grain='honey'))
    ob = join(parts, 'tool_stool')
    # held by the seat's rim: the right paw on its -X side, the left on its +X side
    a = math.radians(-31.6)
    gr = V(math.cos(a) * (r + 0.004), math.sin(a) * (r + 0.004), h - 0.012)
    return ob, {'grip': gr, 'A': (V(-math.sin(a), math.cos(a), 0), V(-math.cos(a), -math.sin(a), -0.3)), 'gripL': V(-gr.x, gr.y, gr.z)}


def make_saw(build):
    """Poly Haven's handsaw (CC0), sized to his paw: blade in the model's YZ plane, the handle at +Y, teeth at -Z."""
    ob = import_ph(PH_IDS['saw'], build, tris=1400, scale=0.56)
    co = np.array([v.co for v in ob.data.vertices])
    hd = co[np.abs(co[:, 0]) > 0.0038]
    hy0, hy1 = hd[:, 1].min(), hd[:, 1].max()
    hz0, hz1 = hd[:, 2].min(), hd[:, 2].max()
    blade = co[(np.abs(co[:, 0]) <= 0.0021) & (co[:, 1] < hy0)]
    teeth_z = blade[:, 2].min()
    toe_y = co[:, 1].min()
    tip = blade[blade[:, 1] < toe_y + 0.015]
    grip = V(0, hy0 + (hy1 - hy0) * 0.6, hz0 + (hz1 - hz0) * 0.5)
    heel = V(0, hy0 - 0.004, blade[blade[:, 1] > hy0 - 0.03][:, 2].min() if (blade[:, 1] > hy0 - 0.03).any() else teeth_z)
    toe = V(0, toe_y + 0.006, tip[:, 2].min() if len(tip) else teeth_z)
    print('[craft] saw handle y', round(hy0, 3), round(hy1, 3), 'z', round(hz0, 3), round(hz1, 3), 'heel', tuple(round(x, 3) for x in heel), 'toe', tuple(round(x, 3) for x in toe))
    return ob, {'grip': grip, 'A': (V(0, 0.45, 1), V(0, -1, -0.2)), 'heel': heel, 'toe': toe}


def make_plane(build):
    """Poly Haven's No. 4 smoothing plane (CC0), sized to his paw: sole on z = 0, length along X, the tote the tall end."""
    ob = import_ph(PH_IDS['plane'], build, tris=1800, scale=0.62)
    co = np.array([v.co for v in ob.data.vertices])
    zt = co[:, 2].max()
    top = co[co[:, 2] > zt - 0.02]
    xmid = (co[:, 0].min() + co[:, 0].max()) / 2
    rear = 1 if top[:, 0].mean() > xmid else -1
    tote = co[(co[:, 0] * rear > np.percentile(co[:, 0] * rear, 60)) & (co[:, 2] > zt * 0.35)]
    knob = co[(co[:, 0] * rear < np.percentile(co[:, 0] * rear, 25)) & (co[:, 2] > zt * 0.2)]
    tc = Vector(tote.mean(0))
    kc = Vector(knob.mean(0))
    kt = Vector((kc.x, kc.y, knob[:, 2].max()))
    print('[craft] plane rear', rear, 'tote', tuple(round(x, 3) for x in tc), 'knob top', tuple(round(x, 3) for x in kt), 'x', round(co[:, 0].min(), 3), round(co[:, 0].max(), 3), 'z top', round(zt, 3))
    return ob, {'grip': tc, 'A': (V(-rear * 0.5, 0, 0.87), V(0, 1, 0)), 'knob': kt, 'rear': rear,
                'ymid': float((co[:, 1].min() + co[:, 1].max()) / 2), 'zmin': float(co[:, 2].min()),
                'front': float(-xmid if rear > 0 else xmid)}


# ------------------------------------------------------------------ bones and rest placement
def grip_frame(k):
    sx = 1 if k == 'l' else -1
    h0, h1 = V(sx * 0.295, -0.15, 0.44), V(sx * 0.312, -0.215, 0.39)
    d = (h1 - h0).normalized()
    across = d.cross(V(0, 0, 1)).normalized() * sx     # across the paw, toward the thumb (the body's midline)
    return basis(across, d), h0


def tool_F(info, k):
    """Model -> armature rotation of a tool resting in paw k (rest pose)."""
    if 'F' in info:
        return info['F']
    G, _ = grip_frame(k)
    a_y, a_z = info['A']
    A = basis(a_y, a_z)                # grip axes expressed in model coordinates
    return G @ A.transposed()


def grip_point(k, LM):
    sx = 1 if k == 'l' else -1
    G, h0 = grip_frame(k)
    return Vector(LM['palm_' + k]) + G.col[2] * 0.012 + G.col[1] * 0.0 + V(0, 0, -0.004)


def place_in_hand(ob, info, k, LM):
    F = tool_F(info, k)
    g = grip_point(k, LM)
    M = Matrix.Translation(g) @ F.to_4x4() @ Matrix.Translation(-info['grip'])
    ob.data.transform(M)
    info['M_rest'] = M


def add_bones(B):
    """Tool bones under the hands (head at the grip), called inside the rig's edit mode."""
    for t in TOOLS:
        k = HAND[t]
        G, _ = grip_frame(k)
        h = V(*INFO_GRIP[k])
        B('tool_' + t, tuple(h), tuple(h + G.col[1] * 0.04), 'hand_' + k)


INFO_GRIP = {}


# ------------------------------------------------------------------ posing: deform matrices and IK
class Poser:
    """Computes armature-space deform matrices for a pose spec (the convention of beaver.Anim: each bone's rotation is
    about armature axes through its head, applied in its parent's posed frame) and solves the arms."""

    def __init__(s, rig, ns):
        s.rig, s.ns = rig, ns
        s.BONES = ns['BONES']
        s.parent = {b.name: (b.parent.name if b.parent else None) for b in rig.data.bones}

    def q(s, spec):
        q = Quaternion()
        rot = spec.get('rot') if spec else None
        if rot:
            rots = [rot] if isinstance(rot[0], str) else rot
            for ax, deg in rots:
                a = {'X': V(1, 0, 0), 'Y': V(0, 1, 0), 'Z': V(0, 0, 1)}[ax]
                q = Quaternion(a, math.radians(deg)) @ q
        if spec and spec.get('quat') is not None:
            q = spec['quat'] @ q
        return q

    def D(s, pose, name, cache=None):
        cache = {} if cache is None else cache
        if name in cache:
            return cache[name]
        par = s.parent[name]
        Dp = s.D(pose, par, cache) if par else Matrix.Identity(4)
        h = Vector(s.BONES[name][0])
        spec = pose.get(name, {})
        mv = Vector(spec.get('move', (0, 0, 0)))
        M = Dp @ Matrix.Translation(h + mv) @ s.q(spec).to_matrix().to_4x4() @ Matrix.Translation(-h)
        cache[name] = M
        return M

    def arm(s, pose, k, wrist, R_hand, pole):
        """Solve arm k so its wrist reaches `wrist` (armature space) with the paw's world rotation R_hand; writes
        upper_arm/forearm/hand into pose; returns the residual (m)."""
        cache = {}
        Dc = s.D(pose, 'chest', cache)
        Rc = Dc.to_quaternion()
        w_rest = Dc.inverted() @ Vector(wrist)
        pole_rest = Rc.inverted() @ Vector(pole)
        # the shoulder comes forward (and a little in) when he reaches far, as a real one does
        S = Vector(s.BONES['upper_arm_' + k][0])
        far = max(0.0, min(1.0, ((w_rest - S).length - 0.24) / 0.07))
        sx = 1 if k == 'l' else -1
        mv = Vector((-sx * 0.008, -0.045, -0.006)) * far
        q_up, q_fore = s.ns['arm_ik'](k, tuple(w_rest - mv), pole=tuple(pole_rest))
        pose['upper_arm_' + k] = {'quat': q_up, 'move': tuple(mv)}
        pose['forearm_' + k] = {'quat': q_fore}
        R_fore = Rc @ q_up @ q_fore
        pose['hand_' + k] = {'quat': R_fore.inverted() @ R_hand}
        got = s.D(pose, 'hand_' + k) @ Vector(s.BONES['hand_' + k][0])
        return (got - Vector(wrist)).length


# ------------------------------------------------------------------ the clips
def build_clips(A, stance, rig, ns, LM, PENCIL, INFO):
    P = Poser(rig, ns)
    BONES = ns['BONES']
    worst = {}
    TOP, BT = BENCH['top'], BOARD['top']
    poleR, poleL = V(-1.0, 0.5, 0.0), V(1.0, 0.5, 0.0)   # elbows out to the side and back, clear of the bench

    def wrist_of(k):
        return Vector(BONES['hand_' + k][0])

    def arm_base(p, k):
        return {b: P.q(p.get(b + '_' + k, {})) for b in ('upper_arm', 'forearm', 'hand')}

    def blend(p, k, base, w):
        if w >= 0.999:
            return
        for b in ('upper_arm', 'forearm', 'hand'):
            spec = p[b + '_' + k]
            qi = P.q(spec)
            out = {'quat': base[b].slerp(qi, max(0.0, w))}
            if 'move' in spec:
                out['move'] = tuple(Vector(spec['move']) * max(0.0, w))
            p[b + '_' + k] = out

    def rest_target(p, k):
        """The paw's rest on the plank in front of its shoulder (follows his step), palm down, fingers forward."""
        sx = 1 if k == 'l' else -1
        x = p.get('root', {}).get('move', (0, 0, 0))[0]
        d_rest = (Vector(BONES['hand_' + k][1]) - wrist_of(k)).normalized()
        Rh = d_rest.rotation_difference(V(sx * 0.15, -1, 0).normalized())
        at = V(x + sx * REST_X, BOARD['near'] - REST_IN, BOARD['top'])
        W = at + V(0, 0, 0.046) - Rh @ (Vector(LM['palm_' + k]) - wrist_of(k))
        return W, Rh

    def reach(p, k, W, Rh, pole, w):
        """Paw k to wrist W with rotation Rh; below w = 1 it travels from its rest on the plank over a little arc."""
        p.setdefault('_arms', set()).add(k)
        if w >= 0.999:
            return P.arm(p, k, W, Rh, pole)
        W0, R0 = rest_target(p, k)
        t = sm(w)
        P.arm(p, k, W0.lerp(Vector(W), t) + V(0, 0, 0.05 * math.sin(t * math.pi)), R0.slerp(Rh, t), pole)
        return 0.0

    def free_paws(p):
        for k in ('l', 'r'):
            if k not in p.get('_arms', ()):
                W, Rh = rest_target(p, k)
                P.arm(p, k, W, Rh, poleL if k == 'l' else poleR)
        p.pop('_arms', None)

    def hold(p, k, tool, B, at_model, at_world, pole=None, w=1.0):
        """Tool (rigid in paw k) with model->world rotation B and its model point at_model at at_world."""
        if w <= 0:
            return 0.0
        info = INFO[tool]
        F = info['F'] if 'F' in info else tool_F(info, k)
        Rh = (B @ F.inverted()).to_quaternion()
        p_rest = info['M_rest'] @ Vector(at_model)
        W = Vector(at_world) - Rh @ (p_rest - wrist_of(k))
        return reach(p, k, W, Rh, pole or (poleL if k == 'l' else poleR), w)

    def hold_rest(p, k, tool, w=1.0, lift=0.0):
        B, O = REST[tool]
        g = INFO[tool]['grip']
        return hold(p, k, tool, B, g, O + B @ g + V(0, 0, lift), w=w)

    def carry(p, k, tool, t, B0, O0, B1, O1, arc=0.05):
        """Carry a tool from pose (B0, O0) to (B1, O1) (model origin), eased, over an arc that lifts it clear first and
        sets it down straight at the end; it turns only while it is up in the air."""
        g = INFO[tool]['grip']
        e = sm(t)
        Bc = B0.to_quaternion().slerp(B1.to_quaternion(), sm((t - 0.25) / 0.5)).to_matrix()
        lift = arc * math.sin(min(1.0, t * 1.5) * math.pi * 0.5) * math.sin(min(1.0, (1 - t) * 1.5) * math.pi * 0.5)
        G0, G1 = O0 + B0 @ g, O1 + B1 @ g
        return hold(p, k, tool, Bc, g, G0.lerp(G1, e) + V(0, 0, lift))

    def palm(p, k, at, fdir=(0, -1, 0.0), pole=None, w=1.0):
        """A paw pressing flat (palm down) on a surface at `at`, fingers along fdir (kept level: no drooping fingers)."""
        if w <= 0:
            return 0.0
        sx = 1 if k == 'l' else -1
        fd = Vector(fdir)
        fd.z = max(fd.z, -0.05)
        d_rest = (Vector(BONES['hand_' + k][1]) - wrist_of(k)).normalized()
        Rh = d_rest.rotation_difference(fd.normalized())
        pr = Vector(LM['palm_' + k])
        W = Vector(at) + V(0, 0, 0.046) - Rh @ (pr - wrist_of(k))
        return reach(p, k, W, Rh, pole or V(sx * 1.0, 0.5, 0.0), w)

    def body(f, x=0.0, xmax=0.0, lean=0.0, turn=0.0, look=(0.0, 0.0), breath=0.5, hips=0.0018):
        """Stance plus a step to x (a little bob while stepping), a forward lean (deg), a turn (deg, + to his left), a look
        (yaw, pitch deg; + pitch looks down)."""
        p = stance(breath=breath * math.sin(f / FPS * 2.4), tail=0.35 * math.sin(f / FPS * 1.3), sway=0.2 * math.sin(f / FPS * 1.1))
        hop = 0.014 * math.sin(math.pi * min(1.0, abs(x) / xmax)) if xmax else 0.0
        p['root'] = {'move': (x, hips * max(0.0, lean), hop), 'rot': ('Z', turn)}
        p['spine'] = {'rot': ('X', lean * 0.5)}
        p['chest'] = {'rot': ('X', lean * 0.42)}
        p['neck'] = {'rot': ('X', -lean * 0.15)}
        p['head'] = {'rot': [('X', look[1] - lean * 0.12), ('Z', look[0])]}
        # the feet shuffle while he steps
        if xmax:
            ph = math.sin(math.pi * min(1.0, abs(x) / xmax))
            p['thigh_l'] = {'rot': ('X', -8 * ph)}
            p['foot_l'] = {'rot': ('X', 8 * ph)}
        for t in TOOLS:
            p['tool_' + t] = {'scale': 0.001}
        return p

    def show(p, *tools):
        for t in tools:
            if t == 'pencil':
                p['pencil_ear'] = {'scale': 0.001}
                p['pencil_hand'] = {'scale': 1.0}
            else:
                p['tool_' + t] = {'scale': 1.0}

    def clip(name, length, fn, step=2):
        A.begin(name, length)
        EV.setdefault(name, [])
        frames = list(range(0, length + 1, step))
        if frames[-1] != length:
            frames.append(length)
        res, wf = 0.0, 0
        bad = []
        for f in frames:
            p = fn(f)
            free_paws(p)
            r = p.pop('_res', 0.0)
            if r > 0.006:
                bad.append(f'{f}:{r * 1000:.0f}')
            if r > res:
                res, wf = r, f
            A.pose(f, **p)
        A.end(loop=False)
        worst[name] = (res, wf)
        print(f'[craft] clip {name}: {length} frames, worst IK residual {res * 1000:.1f} mm at frame {wf}')
        if bad:
            print('[craft]   reach short (frame:mm)', ' '.join(bad))

    def ev(name, f, kind, **data):
        EV.setdefault(name, []).append((f, kind, data))

    def ramp(f, a, b, c, d):
        """0 before a, up to 1 at b, 1 until c, down to 0 at d."""
        return seg(f, a, b) * (1 - seg(f, c, d))

    # ---------------------------------------------------------------- measure: square and pencil
    sq, pen = INFO['square'], INFO['pencil']
    Bsq_rest, Osq_rest = REST['square']
    Bsq_put = Matrix(((0, 1, 0), (-1, 0, 0), (0, 0, 1)))
    Osq_put = V(CUT_X, BOARD['near'] + 0.009, BT + 0.0008) - Bsq_put @ V(0.009, -0.034, 0) + V(0, 0, 0)
    pe_base = Vector(PENCIL['ear'][0])
    tipm, midm = V(0, 0.1, 0), V(0, 0.02, 0)      # (he takes it by the eraser end, which sticks out in front of his ear)
    line0 = V(CUT_X, BOARD['near'] - 0.004, BT + 0.0004)
    line1 = V(CUT_X, BOARD['far'] + 0.004, BT + 0.0004)
    Bp_draw = (pen['F'].col[1].rotation_difference(V(0.12, -0.25, -1).normalized())).to_matrix() @ pen['F']

    def ear_pencil(p):
        Dh = P.D(p, 'head')
        return Dh.to_quaternion().to_matrix() @ pen['F_ear'], Dh @ pe_base

    def measure(f):
        X = -STEP_R * seg(f, 0, 12) + STEP_R * seg(f, 104, 116)
        lean = 30 * seg(f, 4, 16) - 30 * seg(f, 104, 114)
        p = body(f, x=X, xmax=STEP_R, lean=lean, turn=-10 * seg(f, 4, 14) + 10 * seg(f, 104, 116), look=(-8, 16 * seg(f, 8, 18) - 16 * seg(f, 100, 110)))
        res = 0.0
        # left paw: slide the plank along to the next cut (the game moves it only if the last offcut has dropped)
        if 2 <= f < 18:
            x = lerp(-0.42, -0.42 - SLIDE, seg(f, 9, 16))
            res = max(res, palm(p, 'l', V(x, BY, BT), fdir=(-0.4, -1, -0.2), w=seg(f, 2, 9)))
        # ... then take the square, lay it across the plank at the cut, hold it, put it back
        elif 18 <= f <= 108:
            if f < 24:
                res = max(res, hold_rest(p, 'l', 'square'))
            elif f < 34:
                res = max(res, carry(p, 'l', 'square', seg(f, 24, 34), Bsq_rest, Osq_rest, Bsq_put, Osq_put, arc=0.06))
                show(p, 'square')
            elif f < 92:
                res = max(res, hold(p, 'l', 'square', Bsq_put, sq['grip'], Osq_put + Bsq_put @ sq['grip']))
                show(p, 'square')
            elif f < 102:
                res = max(res, carry(p, 'l', 'square', seg(f, 92, 102), Bsq_put, Osq_put, Bsq_rest, Osq_rest, arc=0.06))
                show(p, 'square')
            else:
                res = max(res, hold_rest(p, 'l', 'square', w=1 - seg(f, 102, 108)))
        # right paw: the pencil from behind the ear, a line along the square's blade, back behind the ear
        if 24 <= f <= 98:
            Be, Pe = ear_pencil(p)
            ear_mid = Pe + Be @ midm
            if f < 38:
                res = max(res, hold(p, 'r', 'pencil', Be, midm, ear_mid, w=seg(f, 24, 36)))
            elif f < 52:
                t = seg(f, 38, 52)
                Bc = Be.to_quaternion().slerp(Bp_draw.to_quaternion(), t).to_matrix()
                start = ear_mid
                end = line0 - Bp_draw @ tipm + Bp_draw @ midm
                res = max(res, hold(p, 'r', 'pencil', Bc, midm, start.lerp(end, t) + V(0, 0, 0.05 * math.sin(t * math.pi))))
                show(p, 'pencil')
            elif f < 72:
                res = max(res, hold(p, 'r', 'pencil', Bp_draw, tipm, line0.lerp(line1, seg(f, 52, 70))))
                show(p, 'pencil')
            elif f < 86:
                t = seg(f, 72, 86)
                Bc = Bp_draw.to_quaternion().slerp(Be.to_quaternion(), t).to_matrix()
                start = line1 - Bp_draw @ tipm + Bp_draw @ midm
                res = max(res, hold(p, 'r', 'pencil', Bc, midm, start.lerp(ear_mid, t) + V(0, 0, 0.05 * math.sin(t * math.pi))))
                show(p, 'pencil')
            else:
                res = max(res, hold(p, 'r', 'pencil', Be, midm, ear_mid, w=1 - seg(f, 86, 98)))
            hk = seg(f, 26, 36) * (1 - seg(f, 40, 48)) + seg(f, 76, 84) * (1 - seg(f, 88, 96))
            p['head']['rot'] = p['head']['rot'] + [('X', 10 * hk), ('Y', -22 * hk)]
            p['neck'] = {'rot': [('X', -30 * 0.15 + 6 * hk), ('Y', -8 * hk)]}
        p['_res'] = res
        return p

    clip('measure', 116, measure)
    ev('measure', 9, 'slide', f1=16)
    ev('measure', 24, 'take', tool='square')
    ev('measure', 102, 'put', tool='square')
    ev('measure', 52, 'line', f1=70, x=CUT_X, y0=BOARD['near'], y1=BOARD['far'])

    # ---------------------------------------------------------------- saw: crosscut the overhang
    sw = INFO['saw']
    Bsw_rest, Osw_rest = REST['saw']
    heel, toe = sw['heel'], sw['toe']
    m_u = (toe - heel).normalized()
    m_n = V(0, 0, -1) - m_u * V(0, 0, -1).dot(m_u)
    m_n.normalize()
    teeth = (toe - heel).length
    S0, S1, NS = 34, 142, 9

    def saw_B(theta):
        u = V(0, -math.cos(theta), -math.sin(theta))
        n = V(0, math.sin(theta), -math.cos(theta))
        Mm = Matrix((m_u, m_n, m_u.cross(m_n))).transposed()
        Mw = Matrix((u, n, u.cross(n))).transposed()
        return Mw @ Mm.transposed()

    def saw_state(f):
        t = max(0.0, min(1.0, (f - S0) / (S1 - S0)))
        depth = sm(t) * (BOARD['top'] - BOARD['bottom'] + 0.006)
        theta = math.radians(lerp(34, 24, sm(t)))
        K = V(CUT_X, BY + 0.012, BT - depth)
        s = 0.03 * math.sin((f - S0) / ((S1 - S0) / NS) * math.tau) if S0 <= f <= S1 else 0.0
        return saw_B(theta), K, s

    def saw_origin(f):
        B, K, s = saw_state(f)
        return B, K - B @ (heel + m_u * (teeth * 0.64 - s))

    def saw(f):
        X = -STEP_SAW * seg(f, 0, 12) + STEP_SAW * seg(f, 156, 168)
        lean = 46 * seg(f, 4, 16) - 12 * seg(f, 24, 34) + 12 * seg(f, 138, 146) - 46 * seg(f, 154, 166)
        p = body(f, x=X, xmax=STEP_SAW, lean=lean, turn=-12 * seg(f, 4, 14) + 12 * seg(f, 156, 168), look=(-12, 14 * seg(f, 8, 20) - 14 * seg(f, 150, 162)), hips=0.0012)
        res = 0.0
        res = max(res, palm(p, 'l', V(CUT_X + 0.39, BY, BT), fdir=(-0.1, -1, 0), w=ramp(f, 8, 18, 146, 156)))
        if 6 <= f <= 160:
            if f < 20:
                res = max(res, hold_rest(p, 'r', 'saw', w=seg(f, 6, 18)))
            elif f < S0:
                B1, O1 = saw_origin(S0)
                res = max(res, carry(p, 'r', 'saw', seg(f, 20, S0), Bsw_rest, Osw_rest, B1, O1 + V(0, 0, 0.0), arc=0.2))
                show(p, 'saw')
            elif f <= S1:
                B, K, s = saw_state(f)
                res = max(res, hold(p, 'r', 'saw', B, heel + m_u * (teeth * 0.64 - s), K))
                show(p, 'saw')
            elif f < 150:
                B0, O0 = saw_origin(S1)
                res = max(res, carry(p, 'r', 'saw', seg(f, S1, 150), B0, O0, Bsw_rest, Osw_rest, arc=0.2))
                show(p, 'saw')
            else:
                res = max(res, hold_rest(p, 'r', 'saw', w=1 - seg(f, 150, 160)))
        p['_res'] = res
        return p

    clip('saw', 168, saw)
    ev('saw', 20, 'take', tool='saw')
    ev('saw', 150, 'put', tool='saw')
    ev('saw', S0, 'kerf', f1=S1, x=CUT_X)
    ev('saw', S1, 'offcut', x=CUT_X)
    for i in range(NS):
        ev('saw', S0 + int((i + 0.2) * (S1 - S0) / NS), 'sawdust', x=CUT_X, y=BY, z=BT)

    # ---------------------------------------------------------------- plane: five strokes along the plank
    pl = INFO['plane']
    Bpl_rest, Opl_rest = REST['plane']
    Bpl = Matrix.Identity(3) if pl['rear'] < 0 else Matrix.Rotation(math.pi, 3, 'Z')   # the tote behind (-x), front toward +x
    ymid = (Bpl @ V(0, pl['ymid'], 0)).y
    P0, NP_, SL = 30, 5, 20
    XA, XB = -0.14, 0.2

    def plane_O(x, lift=0.0):
        return V(x, BY - ymid, BT + 0.0006 + lift - pl['zmin'])

    def plane_x(f):
        if f < P0 or f >= P0 + NP_ * SL:
            return XA, 0.0
        u = ((f - P0) % SL) / SL
        if u < 0.7:
            return lerp(XA, XB, sm(u / 0.7)), 0.0
        v = (u - 0.7) / 0.3
        return lerp(XB, XA, sm(v)), 0.014 * math.sin(v * math.pi)

    def plane(f):
        sway = (plane_x(f)[0] - XA) / (XB - XA) * 0.12 if P0 <= f < P0 + NP_ * SL else 0.0
        lean = 30 * seg(f, 4, 14) - 30 * seg(f, 140, 150)
        p = body(f, x=sway - 0.05 * seg(f, 4, 14) + 0.05 * seg(f, 136, 148), lean=lean, look=(2, 15 * seg(f, 6, 16) - 15 * seg(f, 136, 148)))
        res = 0.0
        knob = lambda O: O + Bpl @ pl['knob'] + V(0, 0, 0.004)
        if 4 <= f <= 148:
            if f < 16:
                res = max(res, hold_rest(p, 'r', 'plane', w=seg(f, 4, 14)))
            elif f < P0:
                res = max(res, carry(p, 'r', 'plane', seg(f, 16, P0), Bpl_rest, Opl_rest, Bpl, plane_O(XA), arc=0.06))
                show(p, 'plane')
            elif f < P0 + NP_ * SL:
                x, lift = plane_x(f)
                res = max(res, hold(p, 'r', 'plane', Bpl, pl['grip'], plane_O(x, lift) + Bpl @ pl['grip']))
                show(p, 'plane')
            elif f < 140:
                res = max(res, carry(p, 'r', 'plane', seg(f, P0 + NP_ * SL, 140), Bpl, plane_O(XA), Bpl_rest, Opl_rest, arc=0.06))
                show(p, 'plane')
            else:
                res = max(res, hold_rest(p, 'r', 'plane', w=1 - seg(f, 140, 148)))
        if 18 <= f <= P0 + NP_ * SL + 8:
            x, lift = plane_x(f)
            res = max(res, palm(p, 'l', knob(plane_O(x, lift)), fdir=(0.55, -0.8, -0.35), w=ramp(f, 18, P0, P0 + NP_ * SL, P0 + NP_ * SL + 8)))
        p['_res'] = res
        return p

    clip('plane', 150, plane)
    ev('plane', 16, 'take', tool='plane')
    ev('plane', 140, 'put', tool='plane')
    for i in range(NP_):
        f0 = P0 + i * SL
        ev('plane', f0, 'stroke', f1=f0 + int(SL * 0.7), x0=XA + pl['front'], x1=XB + pl['front'], y=BY, z=BT)

    # ---------------------------------------------------------------- chisel and mallet: chop a mortise
    ch, ma = INFO['chisel'], INFO['mallet']
    C0, NC, CL, HIT = 34, 7, 14, 5
    mx, my = MORTISE
    Bch = basis(V(0.05, 0.12, 1), V(0, -1, 0.1))       # upright, leaning a touch toward him, its flat back away
    Bhit = basis(V(0.92, -0.38, 0.0), V(0.38, 0.92, 0))    # striking: handle level from his right, face down on the chisel
    Bup = Matrix.Rotation(math.radians(-58), 3, Bhit.col[2]) @ Bhit   # cocked: swung up about the same axis (beside his face, not into it)

    def depth(f):
        n = 0 if f < C0 + HIT else min(NC, (f - C0 - HIT) // CL + 1)
        return 0.0024 * n

    def chisel_O(f):
        tip = V(mx, my, BT - depth(f))
        return tip - Bch @ ch['tip']

    def mallet_u(f):
        """0 raised .. 1 on the chisel."""
        if f < C0 or f >= C0 + NC * CL:
            return 0.0
        u = (f - C0) % CL
        if u <= HIT:
            return (u / HIT) ** 2.0
        return 1 - sm((u - HIT) / (CL - HIT))

    def chisel(f):
        lean = 18 * seg(f, 4, 14) - 10 * seg(f, 26, 34) + 10 * seg(f, 136, 144) - 18 * seg(f, 148, 158)
        p = body(f, x=0.2 * seg(f, 0, 12) - 0.2 * seg(f, 148, 160), xmax=0.2, lean=lean, look=(6, 16 * seg(f, 6, 16) - 16 * seg(f, 146, 156)))
        res = 0.0
        Bch_rest, Och_rest = REST['chisel']
        Bma_rest, Oma_rest = REST['mallet']
        Ow = chisel_O(f)
        top = Ow + Bch @ ch['top']
        if 4 <= f <= 152:
            if f < 14:
                res = max(res, hold_rest(p, 'l', 'chisel', w=seg(f, 4, 13)))
            elif f < C0 - 2:
                res = max(res, carry(p, 'l', 'chisel', seg(f, 14, C0 - 2), Bch_rest, Och_rest, Bch, chisel_O(C0) + V(0, 0, 0.004), arc=0.07))
                show(p, 'chisel')
            elif f < C0 + NC * CL + 2:
                res = max(res, hold(p, 'l', 'chisel', Bch, ch['grip'], Ow + Bch @ ch['grip']))
                show(p, 'chisel')
            elif f < 144:
                res = max(res, carry(p, 'l', 'chisel', seg(f, C0 + NC * CL + 2, 144), Bch, Ow, Bch_rest, Och_rest, arc=0.07))
                show(p, 'chisel')
            else:
                res = max(res, hold_rest(p, 'l', 'chisel', w=1 - seg(f, 144, 152)))
        # the mallet: its face meets the chisel's top at each strike
        hitO = top - Bhit @ ma['face']
        gh = hitO + Bhit @ ma['grip']
        gu = gh + V(0.01, -0.03, 0.055)
        upO = gu - Bup @ ma['grip']
        if 10 <= f <= 156:
            if f < 22:
                res = max(res, hold_rest(p, 'r', 'mallet', w=seg(f, 10, 20)))
            elif f < C0:
                res = max(res, carry(p, 'r', 'mallet', seg(f, 22, C0), Bma_rest, Oma_rest, Bup, upO, arc=0.04))
                show(p, 'mallet')
            elif f < C0 + NC * CL:
                u = mallet_u(f)
                Bc = Bup.to_quaternion().slerp(Bhit.to_quaternion(), u).to_matrix()
                res = max(res, hold(p, 'r', 'mallet', Bc, ma['grip'], gu.lerp(gh, u)))
                show(p, 'mallet')
            elif f < 148:
                res = max(res, carry(p, 'r', 'mallet', seg(f, C0 + NC * CL, 148), Bup, upO, Bma_rest, Oma_rest, arc=0.03))
                show(p, 'mallet')
            else:
                res = max(res, hold_rest(p, 'r', 'mallet', w=1 - seg(f, 148, 156)))
        p['_res'] = res
        return p

    clip('chisel', 160, chisel, step=1)
    ev('chisel', 14, 'take', tool='chisel')
    ev('chisel', 144, 'put', tool='chisel')
    ev('chisel', 22, 'take', tool='mallet')
    ev('chisel', 148, 'put', tool='mallet')
    for i in range(NC):
        ev('chisel', C0 + i * CL + HIT, 'chop', x=mx, y=my, z=BT, depth=0.0024 * (i + 1))

    # ---------------------------------------------------------------- sand: rub the plank smooth
    bk = INFO['block']
    D0, ND, DL = 26, 8, 10
    Bbk = Matrix.Identity(3)

    def block_O(f):
        x = 0.1 + (0.075 * math.sin((f - D0) / DL * math.tau) if D0 <= f < D0 + ND * DL else 0.0)
        return V(x, BY, BT + 0.0006) - Bbk @ bk['face']

    def sand(f):
        lean = 30 * seg(f, 4, 12) - 30 * seg(f, 114, 124)
        rub = 0.02 * math.sin((f - D0) / DL * math.tau) if D0 <= f < D0 + ND * DL else 0.0
        p = body(f, x=0.15 * seg(f, 0, 10) - 0.15 * seg(f, 112, 124) + rub, xmax=0.15, lean=lean, look=(-4, 14 * seg(f, 6, 16) - 14 * seg(f, 110, 120)))
        res = 0.0
        Bbk_rest, Obk_rest = REST['block']
        if 4 <= f <= 120:
            if f < 14:
                res = max(res, hold_rest(p, 'r', 'block', w=seg(f, 4, 13)))
            elif f < D0:
                res = max(res, carry(p, 'r', 'block', seg(f, 14, D0), Bbk_rest, Obk_rest, Bbk, block_O(D0), arc=0.05))
                show(p, 'block')
            elif f < D0 + ND * DL:
                res = max(res, hold(p, 'r', 'block', Bbk, bk['grip'], block_O(f) + Bbk @ bk['grip']))
                show(p, 'block')
            elif f < 114:
                res = max(res, carry(p, 'r', 'block', seg(f, D0 + ND * DL, 114), Bbk, block_O(D0), Bbk_rest, Obk_rest, arc=0.05))
                show(p, 'block')
            else:
                res = max(res, hold_rest(p, 'r', 'block', w=1 - seg(f, 114, 120)))
        res = max(res, palm(p, 'l', V(0.33, BY, BT), fdir=(0.2, -1, 0), w=ramp(f, 12, 22, 104, 114)))
        p['_res'] = res
        return p

    clip('sand', 124, sand)
    ev('sand', 14, 'take', tool='block')
    ev('sand', 114, 'put', tool='block')
    for i in range(ND):
        ev('sand', D0 + i * DL + 3, 'dust', x=0.1, y=BY, z=BT)

    # ---------------------------------------------------------------- blow: the dust off the plank
    def blow(f):
        lean = 36 * seg(f, 4, 18) - 36 * seg(f, 48, 64)
        p = body(f, lean=lean, look=(0, 10 * seg(f, 6, 18) - 10 * seg(f, 48, 62)))
        res = 0.0
        w = ramp(f, 6, 16, 50, 60)
        for k, x in (('r', -0.17), ('l', 0.17)):
            sx = 1 if k == 'l' else -1
            res = max(res, palm(p, k, V(x, BY, BT), fdir=(sx * 0.2, -1, -0.12), w=w))
        p['jaw'] = {'rot': ('X', 12 * seg(f, 18, 23) - 12 * seg(f, 38, 46))}
        p['ear_l'] = {'rot': ('Y', -12 * seg(f, 18, 23) + 12 * seg(f, 40, 48))}
        p['ear_r'] = {'rot': ('Y', 12 * seg(f, 18, 23) - 12 * seg(f, 40, 48))}
        p['_res'] = res
        return p

    clip('blow', 64, blow)
    ev('blow', 22, 'blow', x=0.0, y=BY, z=BT)

    # ---------------------------------------------------------------- proud: lift the finished stool to admire it
    st = INFO['stool']
    Bst_rest, Ost_rest = REST['stool']
    c_model = V(0, 0, STOOL['h'] * 0.75)

    def stool_pose(f):
        k = sm(seg(f, 24, 44) * (1 - seg(f, 96, 116)))
        spin = math.radians(20 * math.sin(max(0.0, f - 44) / 52 * math.tau)) * seg(f, 44, 54) * (1 - seg(f, 86, 96))
        R = Matrix.Rotation(spin, 3, 'Z') @ Matrix.Rotation(math.radians(-24) * k, 3, 'X') @ Bst_rest
        c_rest = Ost_rest + Bst_rest @ c_model
        c_up = V(STOOL['x'], -0.25, 0.72) + V(0, 0, 0.01 * math.sin(f / FPS * 5) * k)
        kz = sm(seg(f, 24, 36) * (1 - seg(f, 106, 116)))
        kxy = sm(seg(f, 30, 44) * (1 - seg(f, 96, 110)))
        c = V(lerp(c_rest.x, c_up.x, kxy), lerp(c_rest.y, c_up.y, kxy), lerp(c_rest.z, c_up.z, kz))
        return R, c - R @ c_model

    def proud(f):
        X = 0.53 * seg(f, 0, 12) - 0.53 * seg(f, 128, 140)
        lean = 24 * seg(f, 8, 20) - 32 * seg(f, 28, 46) + 32 * seg(f, 94, 110) - 24 * seg(f, 118, 130)
        p = body(f, x=X, xmax=0.53, lean=lean, hips=0.002, turn=8 * seg(f, 4, 14) - 8 * seg(f, 128, 140),
                 look=(10, 16 * seg(f, 8, 20) - 26 * seg(f, 30, 46) + 26 * seg(f, 94, 110) - 16 * seg(f, 118, 130)))
        res = 0.0
        R, O = stool_pose(f)
        w = ramp(f, 10, 22, 116, 128)
        if w > 0:
            res = max(res, hold(p, 'r', 'stool', R, st['grip'], O + R @ st['grip'], w=w))
            res = max(res, palm(p, 'l', O + R @ st['gripL'] + R @ V(0.006, 0.004, -0.03), fdir=tuple(R @ V(0.85, 0.53, 0)), w=w))
            if 22 <= f < 116:
                show(p, 'stool')
        if 44 <= f <= 96:
            p['jaw'] = {'rot': ('X', 8 * seg(f, 46, 52) * (1 - seg(f, 86, 94)))}
        p['_res'] = res
        return p

    clip('proud', 140, proud)
    ev('proud', 22, 'take', tool='stool')
    ev('proud', 116, 'put', tool='stool')
    return worst


# ------------------------------------------------------------------ the still copies on the bench
def place_rests(INFO, LM):
    """Each tool's place when he isn't using it (model -> Barnaby's frame): the square, plane and sanding block lie on
    the bench's far strip, the chisel and mallet stand in the tool tote, the saw hangs on a nail at the bench's right
    end, the stool stands at the left end."""
    TOP = BENCH['top']

    def model_pts(tool):
        Mi = INFO[tool]['M_rest'].inverted()     # the object is in its rest-in-paw placement: back to model coords
        return np.array([Mi @ v.co for v in INFO[tool]['ob'].data.vertices])

    def put(tool, R, x, y, z_on=TOP):
        """footprint centred on (x, y), lowest point on z_on"""
        w = model_pts(tool) @ np.array(R).T
        c = (w.min(0) + w.max(0)) / 2
        REST[tool] = (R, V(x - c[0], y - c[1], z_on + 0.0006 - w[:, 2].min()))

    put('square', Matrix.Identity(3), -0.285, -0.395)
    pl = INFO['plane']
    flip = Matrix.Identity(3) if pl['rear'] < 0 else Matrix.Rotation(math.pi, 3, 'Z')
    put('plane', flip, -0.1, -0.39)
    put('block', Matrix.Rotation(math.radians(90), 3, 'Z'), 0.032, -0.384)
    # in the tote: the mallet head-down (head along x, fingers' side forward), the chisel edge-down
    put('mallet', Matrix(((-1, 0, 0), (0, 0, -1), (0, -1, 0))), 0.135, -0.374, TOP + TOTE['floor'])
    put('chisel', basis(V(0, 0, 1), V(0, -1, 0)), 0.29, -0.376, TOP + TOTE['floor'])
    put('stool', Matrix.Rotation(math.pi, 3, 'Z'), STOOL['x'], STOOL['y'])   # two feet toward him, the third away
    # the saw lies flat on the bench's right end, its handle out over the end
    sw = INFO['saw']
    m_u = (sw['toe'] - sw['heel']).normalized()
    R = basis(V(1, 0, 0), V(0, 0, 1)) @ basis(m_u, V(1, 0, 0)).transposed()
    w = model_pts('saw') @ np.array(R).T
    REST['saw'] = (R, V(BENCH['x0'] - 0.1 - w[:, 0].min(), -0.4 - (w[:, 1].min() + w[:, 1].max()) / 2, TOP + 0.0006 - w[:, 2].min()))


def still_copies(INFO):
    """`rest_<tool>` meshes at their places on the bench (not skinned, not parented): the game shows them while the
    tool isn't in his paw."""
    outs = []
    for t in TOOLS:
        info = INFO[t]
        R, O = REST[t]
        ob = info['ob']
        me = ob.data.copy()
        M = Matrix.Translation(O) @ R.to_4x4() @ info['M_rest'].inverted()
        me.transform(M)
        c = bpy.data.objects.new('rest_' + t, me)
        bpy.context.scene.collection.objects.link(c)
        outs.append(c)
    return outs


# ------------------------------------------------------------------ the bench, for previews and the clipping check
def bench_boxes():
    """Axis-aligned solids of the work (Barnaby's frame): the bench top and the plank."""
    B, P = BENCH, BOARD
    return {
        'bench': (V(B['x0'], B['far'], B['top'] - 0.07), V(B['x1'], B['near'], B['top'])),
        'plank': (V(P['right'], P['far'], P['bottom']), V(P['left'], P['near'], P['top'])),
    }


def preview_bench():
    obs = []
    boxes = dict(bench_boxes())
    T = TOTE
    boxes['tote'] = (V(T['x0'], T['y1'], BENCH['top']), V(T['x1'], T['y0'], BENCH['top'] + T['floor']))
    boxes['rail'] = (V(T['x0'], T['rail'] - 0.006, BENCH['top'] + 0.1), V(T['x1'], T['rail'] + 0.006, BENCH['top'] + 0.112))
    for nm, (lo, hi) in boxes.items():
        ob = block('pv_' + nm, lo, hi, bevel=0.0)
        mat = bpy.data.materials.new('pv_' + nm)
        mat.use_nodes = True
        bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        bsdf.inputs['Base Color'].default_value = (0.5, 0.34, 0.2, 1) if nm != 'plank' else (0.85, 0.7, 0.48, 1)
        ob.data.materials.append(mat)
        obs.append(ob)
    for x in (BENCH['x0'] + 0.05, BENCH['x1'] - 0.05):
        for y in (BENCH['near'] - 0.15, BENCH['far'] + 0.04):
            ob = block('pv_leg', V(x - 0.03, y - 0.03, 0), V(x + 0.03, y + 0.03, BENCH['top'] - 0.07), bevel=0.0)
            ob.data.materials.append(obs[0].data.materials[0])
            obs.append(ob)
    return obs


def check(rig, skinned, tools_by_bone, clips, step=4):
    """Pose the real mesh through the work clips and report vertices inside the bench top or the plank (tools only
    while held, and not where they cut). Returns (clip, frame, part, solid, depth_mm, nearest bone)."""
    sc = bpy.context.scene
    boxes = bench_boxes()
    out = []
    rig.animation_data_create()
    names = [b.name for b in rig.data.bones if b.use_deform and not b.name.startswith('tool_')]
    for nm in clips:
        act = bpy.data.actions[nm]
        rig.animation_data.action = act
        f0, f1 = act.frame_range
        for f in range(int(f0), int(f1) + 1, step):
            sc.frame_set(f)
            dg = bpy.context.evaluated_depsgraph_get()
            heads = np.array([rig.pose.bones[n].head for n in names])
            for ob in skinned:
                tool = tools_by_bone.get(ob.name)
                if tool and rig.pose.bones['tool_' + tool].scale[0] < 0.5:
                    continue
                ev = ob.evaluated_get(dg)
                me = ev.to_mesh()
                co = np.zeros(len(me.vertices) * 3)
                me.vertices.foreach_get('co', co)
                co = co.reshape(-1, 3)
                ev.to_mesh_clear()
                co = co @ np.array(ob.matrix_world)[:3, :3].T + np.array(ob.matrix_world)[:3, 3]
                for bn, (lo, hi) in boxes.items():
                    lo_, hi_ = np.array(lo), np.array(hi)
                    inside = np.all((co > lo_ + 0.002) & (co < hi_ - 0.002), axis=1)
                    if tool == 'saw':
                        inside &= np.abs(co[:, 0] - CUT_X) > 0.016
                    if tool == 'chisel':
                        inside &= (np.abs(co[:, 0] - MORTISE[0]) > 0.014) | (co[:, 2] < BOARD['top'] - 0.03)
                    if inside.any():
                        pts = co[inside]
                        d = np.minimum(pts - lo_, hi_ - pts).min(1).max()
                        c = pts.mean(0)
                        near = names[int(np.argmin(np.linalg.norm(heads - c, axis=1)))]
                        out.append((nm, f, ob.name, bn, round(float(d) * 1000, 1), near))
    rig.animation_data.action = None
    sc.frame_set(0)
    return out


def timeline():
    """The clip events in seconds for the game (pasted into src/world/stages/beaver.ts as CRAFT)."""
    out = {}
    for nm, evs in EV.items():
        out[nm] = [[round(f / FPS, 3), k, {kk: (round(v, 4) if isinstance(v, float) else v) for kk, v in d.items()}] for f, k, d in sorted(evs, key=lambda e: e[0])]
    return out
