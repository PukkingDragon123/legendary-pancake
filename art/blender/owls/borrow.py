"""Outfit pieces borrowed from the owner's Gacha Garage wearables (refs: gg public/models/lowpix/world/wear_*.glb,
hand-painted restyles of CC BY 4.0 models: see docs/credits/owl3.md), fitted onto the tawny's anchors and toned to
Hoot Hollow's calm palette, so the pieces the toy line has not remade yet are still real, textured accessories.

    ~/.cache/gg-bpy/bin/python art/blender/owls/borrow.py <gg_root> [id ...]
gg_root: the Gacha Garage checkout. Writes public/models/outfits/<id>.glb and art/blender/_build/outfits/<id>.piece.json.
"""
import json
import math
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path[:0] = [os.path.join(HERE, '..', 'lib'), HERE]
os.environ.setdefault('GG_FACET', '1')
import numpy as np  # noqa: E402

import tk  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import specs  # noqa: E402
import owl as owlmod  # noqa: E402
from outfits import head_section  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'public', 'models', 'outfits')
BUILD = os.path.join(ROOT, 'art', 'blender', '_build', 'outfits')

# id: (gg wearable, anchor, fit, hides tufts, tint)
#   fit: kind 'hat' (w: share of the head's width at its band, base: band height as a share of the head height above
#        its centre, sink: mm the brim sits into the crown), 'face' (w: mm across, dz / dy), 'back' (h: share of the
#        body height, dz), 'neck' (w: share of the body width at the neck, dz, dy); rot: [(deg, axis)] first
#   tint: (saturation, value, warmth) applied to the painted texture (calm palette)
PIECES = {
    'beanie': ('beanie_pom', 'anchor_head', dict(kind='hat', w=0.9, base=0.16, sink=1.6), True, (0.78, 0.98, 0.02)),
    'bow': ('bow', 'anchor_head', dict(kind='hat', w=0.82, base=0.4, sink=-0.4, dy=1.0, rot=[(-15, 'X')]), False, (0.75, 1.08, 0.0)),
    'crown': ('crown', 'anchor_head', dict(kind='hat', w=0.98, base=0.3, sink=0.2), False, (0.7, 1.02, 0.0)),
    'stargoggles': ('goggles', 'anchor_head', dict(kind='hat', w=1.02, base=0.1, sink=0.0, dy=-2.0, rot=[(-8, 'X')]), False, (0.75, 1.05, 0.0)),
    'satchel': ('satchel', 'anchor_back', dict(kind='back', h=0.72, dz=-1.0), False, (0.72, 0.98, 0.02)),
    'backpack': ('backpack', 'anchor_back', dict(kind='back', h=0.78, dz=0.0), False, (0.72, 0.98, 0.0)),
    'beret': ('beret', 'anchor_head', dict(kind='hat', w=0.92, base=0.3, sink=0.5, rot=[(8, 'Y')]), False, (0.75, 1.0, 0.0, '#8a5a6a')),
    'froghat': ('frog', 'anchor_head', dict(kind='hat', w=0.86, base=0.12, sink=2.4), True, (0.72, 1.0, 0.0)),
    'explorer': ('pith', 'anchor_head', dict(kind='hat', w=1.08, base=0.2, sink=1.6, rot=[(-90, 'X')]), True, (0.75, 1.0, 0.02)),
    'flowercrown': ('flowerclip', 'anchor_head', dict(kind='hat', w=0.55, base=0.3, sink=-0.4, dx=-6.0, dy=-2.0, rot=[(-25, 'Y')]), False, (0.68, 1.0, 0.0)),
}


def decode(gg, name, tmp):
    src = os.path.join(gg, 'public', 'models', 'lowpix', 'world', f'wear_{name}.glb')
    dst = os.path.join(tmp, f'{name}.plain.glb')
    subprocess.run(['node', os.path.join(HERE, 'unmeshopt.mjs'), src, dst], check=True, cwd=ROOT, stdout=subprocess.DEVNULL)
    return dst


def tone_image(img, sat, val, warm, mul=None):
    a = np.empty(img.size[0] * img.size[1] * 4, np.float32)
    img.pixels.foreach_get(a)
    a = a.reshape(-1, 4)
    rgb = a[:, :3]
    lum = (rgb @ np.array([0.299, 0.587, 0.114], np.float32))[:, None]
    rgb = lum + (rgb - lum) * sat
    rgb = rgb * val
    rgb[:, 0] += warm
    rgb[:, 2] -= warm * 0.6
    if mul:  # colourise a pale piece (a white beret dyed the palette's berry)
        c = np.array([int(mul[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32) ** 2.2
        rgb = rgb * c * 1.25
    a[:, :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(a.reshape(-1))
    img.update()


def build(pid, gg, O):
    name, anchor, fit, hides, tint = PIECES[pid]
    tk.reset()
    os.makedirs(BUILD, exist_ok=True)
    bpy.ops.import_scene.gltf(filepath=decode(gg, name, BUILD))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.context.view_layer.update()
    for o in meshes:  # bake every transform into the vertices (figure space, mm later)
        M = o.matrix_world.copy()
        o.parent = None
        o.data.transform(M)
        o.matrix_world = Matrix.Identity(4)
    for o in list(bpy.context.scene.objects):
        if o.type != 'MESH':
            bpy.data.objects.remove(o)
    ob = tk.join(meshes, pid + '_mesh')
    for deg, ax in fit.get('rot', []):
        tk.rotate(ob, deg, ax)
    V = tk.verts(ob)
    lo, hi = V.min(0), V.max(0)
    k = fit['kind']
    if k == 'hat':
        zb = O.hz + O.hh * fit['base']
        hw, ft, bk, yc = head_section(O, zb, 0.6)
        s = hw * 2 * fit['w'] / (hi[0] - lo[0])
        tk.scale(ob, s)
        V = tk.verts(ob)
        lo, hi = V.min(0), V.max(0)
        tk.move(ob, (-(lo[0] + hi[0]) / 2 + fit.get('dx', 0.0), yc + (bk - ft) * 0.5 - (lo[1] + hi[1]) / 2 + fit.get('dy', 0.0), zb - fit.get('sink', 0.0) - lo[2]))
    elif k == 'face':
        s = fit['w'] / (hi[0] - lo[0])
        tk.scale(ob, s)
        V = tk.verts(ob)
        lo, hi = V.min(0), V.max(0)
        tk.move(ob, (-(lo[0] + hi[0]) / 2 + fit.get('dx', 0.0), O.yF + fit.get('dy', 0.0) - lo[1], O.ez + fit.get('dz', 0.0) - (lo[2] + hi[2]) / 2))
    elif k == 'back':
        s = O.bh * fit['h'] / (hi[2] - lo[2])
        tk.scale(ob, s)
        V = tk.verts(ob)
        lo, hi = V.min(0), V.max(0)
        zc = O.bz0 + O.bh * 0.55 + fit.get('dz', 0.0)
        hw, ft, bk, yc = O.body_at(zc)
        tk.move(ob, (-(lo[0] + hi[0]) / 2, yc + bk - 1.2 - lo[1], zc - (lo[2] + hi[2]) / 2))
    elif k == 'neck':
        z = O.bz1 - 3.0 + fit.get('dz', 0.0)
        hw, ft, bk, yc = O.body_at(z)
        s = hw * 2 * fit['w'] / (hi[0] - lo[0])
        tk.scale(ob, s)
        V = tk.verts(ob)
        lo, hi = V.min(0), V.max(0)
        tk.move(ob, (-(lo[0] + hi[0]) / 2, yc + fit.get('dy', 0.0) - (lo[1] + hi[1]) / 2, z - hi[2] + 2.0))
    at = np.asarray(O.anchors[anchor][0])
    tk.set_verts(ob, tk.verts(ob) - at)
    # restyle: the calm palette, a matte handmade finish
    for m in ob.data.materials:
        if not m or not m.node_tree:
            continue
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                tone_image(n.image, *tint)
                n.interpolation = 'Closest'
            if n.type == 'BSDF_PRINCIPLED':
                n.inputs['Roughness'].default_value = 0.8
                n.inputs['Metallic'].default_value = 0.0
    root = bpy.data.objects.new('piece', None)
    bpy.context.scene.collection.objects.link(root)
    ob.parent = root
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    root.select_set(True)
    bpy.context.view_layer.objects.active = ob
    raw = os.path.join(BUILD, pid + '.raw.glb')
    bpy.ops.export_scene.gltf(filepath=raw, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_tangents=False, export_normals=True, export_texcoords=True, export_materials='EXPORT',
                              export_image_format='AUTO', export_animations=False, export_skins=False, export_morph=False,
                              export_lights=False, export_cameras=False, export_extras=False)
    os.makedirs(OUT, exist_ok=True)
    import pack
    pack.webp_glb(raw, os.path.join(OUT, pid + '.glb'), quality=88)
    json.dump({'id': pid, 'anchor': anchor, 'hides': hides, 'tris': tk.tri_count(ob), 'from': f'gg wear_{name}'}, open(os.path.join(BUILD, pid + '.piece.json'), 'w'))
    print(f'[borrow] {pid}: wear_{name} x{s:.3f} on {anchor}, {tk.tri_count(ob)} tris', flush=True)


if __name__ == '__main__':
    gg = sys.argv[1]
    ids = sys.argv[2:] or list(PIECES)
    tk.reset()
    O = owlmod.Owl(specs.get("tawny"))  # (built for its measurements and anchors; the scene is cleared per piece)
    O.build()
    for pid in ids:
        build(pid, gg, O)
