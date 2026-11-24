"""Bring a borrowed model (CC BY / CC0, e.g. from Sketchfab) in as a souvenir, in Blender (headless):

    ~/.cache/gg-bpy/bin/python src/world/globe/tools/souvenir_import.py <src.glb> <out.glb> <id> <h px> <foot x> <foot z> <yaw deg> <wall 0|1> <max faces> <max texture px>

Imports the GLB, poses any skinned mesh, joins every mesh into one object named after the souvenir, simplifies it to
the face budget, shrinks its textures, turns it by `yaw` (so it faces +Z), scales it to `h` game px tall (16 px = 1
block) within its footprint (blocks), stands it bottom-centre on the floor (a wall piece: its back on z = 0) and
exports a GLB with WebP textures. Then compress with gltf-transform meshopt (see docs/credits/globe4.md).
"""
import math
import sys

import bpy
from mathutils import Matrix, Vector

a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
src, dst, sid = a[0], a[1], a[2]
H, FX, FZ, YAW, WALL, FACES, TEX = float(a[3]), float(a[4]), float(a[5]), float(a[6]), a[7] == "1", int(a[8]), int(a[9])
# optional: "relief=<k>" stretches the height k times and closes a terrain sheet into a block (a diorama);
# "tilt=<deg>" stands the model up about x before the yaw (a wall piece lying flat)
OPT = dict(x.split("=") for x in a[10:])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene

# pose skinned meshes and drop the rigs
for o in list(scene.objects):
    if o.type == "MESH":
        for m in list(o.modifiers):
            if m.type == "ARMATURE":
                bpy.context.view_layer.objects.active = o
                bpy.ops.object.modifier_apply(modifier=m.name)
        o.shape_key_clear() if o.data.shape_keys else None
meshes = [o for o in scene.objects if o.type == "MESH" and o.visible_get()]
if OPT.get("largest"):
    # only the main piece (drop loose props lying round it)
    meshes = [max(meshes, key=lambda o: len(o.data.polygons))]
for o in meshes:
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
for o in list(scene.objects):
    if o.type != "MESH" or o not in meshes:
        bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
ob.name = sid
ob.data.name = sid

# simplify
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.object.mode_set(mode="OBJECT")
faces = sum(len(p.vertices) - 2 for p in ob.data.polygons)
if faces > FACES:
    d = ob.modifiers.new("dec", "DECIMATE")
    d.ratio = FACES / faces
    d.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="dec")
print("faces", faces, "->", sum(len(p.vertices) - 2 for p in ob.data.polygons))

# lit materials only: an unlit (shadeless) material becomes a plain Principled BSDF with the same colour texture
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    nt = mat.node_tree
    if any(n.type == "BSDF_PRINCIPLED" for n in nt.nodes):
        continue
    tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None)
    out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None) or nt.nodes.new("ShaderNodeOutputMaterial")
    for n in list(nt.nodes):
        if n not in (tex, out):
            nt.nodes.remove(n)
    bs = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bs.inputs["Roughness"].default_value = 0.65
    if tex:
        nt.links.new(tex.outputs["Color"], bs.inputs["Base Color"])
    nt.links.new(bs.outputs["BSDF"], out.inputs["Surface"])

# textures
for img in bpy.data.images:
    w, h = img.size
    if max(w, h) > TEX:
        k = TEX / max(w, h)
        img.scale(max(1, int(w * k)), max(1, int(h * k)))

# turn (Blender is z-up; the game's +Z forward is Blender's -Y), scale, stand on the floor
ob.matrix_world = Matrix.Rotation(math.radians(YAW), 4, "Z") @ Matrix.Rotation(math.radians(float(OPT.get("tilt", 0))), 4, "X") @ ob.matrix_world
bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
if "relief" in OPT:
    # a diorama: exaggerate the relief, then pull the sheet's open edge down into straight sides and a flat base
    k = float(OPT["relief"])
    ob.matrix_world = Matrix.Diagonal((1, 1, k, 1)) @ ob.matrix_world
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    zs = [v.co.z for v in ob.data.vertices]
    depth = (max(zs) - min(zs)) * 0.6 + 1e-4
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.mesh.select_mode(type="EDGE")
    bpy.ops.mesh.select_non_manifold(extend=False, use_wire=False, use_boundary=True, use_multi_face=False, use_non_contiguous=False, use_verts=False)
    bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, -depth)})
    bpy.ops.object.mode_set(mode="OBJECT")
    low = min(zs) - depth
    for v in ob.data.vertices:
        if v.select:
            v.co.z = low
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.fill()
    bpy.ops.object.mode_set(mode="OBJECT")
vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
ext = hi - lo
s = min((H / 16.0) / max(ext.z, 1e-6), FX * 0.95 / max(ext.x, 1e-6), FZ * 0.95 / max(ext.y, 1e-6))
cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
ty = -hi.y if WALL else -cy   # a wall piece: its back (Blender +y = game -z) on the wall
ob.matrix_world = Matrix.Scale(s, 4) @ Matrix.Translation((-cx, ty, -lo.z)) @ ob.matrix_world
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
print("size px", [round(e * s * 16, 1) for e in ext])

bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_image_format="WEBP", export_image_quality=82,
                          export_apply=True, export_animations=False, export_skins=False, export_morph=False,
                          export_yup=True, export_extras=False, export_cameras=False, export_lights=False)
