"""Bring borrowed models in as souvenirs: copy the GLB, wrap it in one root node named after the souvenir that
scales it to its size in the house (game px, 16 per block -> world units) and stands it bottom-centre on the floor.
Meshes, materials and textures are left exactly as their makers (and Gacha Garage's restyle) shipped them.

    ~/.cache/lowpix-venv/bin/python art/lowpix/souvenirs/_kit/borrow.py <gacha garage repo>

Sources and authors: docs/credits/globe.md.
"""
import json
import math
import os
import struct
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))

# souvenir id: (path inside the Gacha Garage repo, longest side in game px, extra yaw in degrees[, hangs on a wall])
BORROW = {
    "sv_kyotolantern": ("public/models/lowpix/world/chochin.glb", 15, 0),
    "sv_torii": ("public/models/lowpix/world/torii.glb", 26, 90),
    "sv_macarons": ("public/models/lowpix/world/macaron_tower.glb", 13, 0),
    "sv_bust": ("public/models/lowpix/world/bust_marble.glb", 14, 0),
    "sv_elephant": ("public/models/lowpix/world/elephant.glb", 14, 0),
    "sv_conch": ("public/models/lowpix/world/shell_giant.glb", 12, 0),
    "sv_cavaquinho": ("public/models/lowpix/world/ukulele.glb", 17, 0, True),
}


def read_glb(b):
    _, _, total = struct.unpack("<III", b[:12])
    jl, _ = struct.unpack("<II", b[12:20])
    js = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl, _ = struct.unpack("<II", b[off:off + 8])
    return js, b[off + 8:off + 8 + bl]


def write_glb(js, binary):
    jb = json.dumps(js, separators=(",", ":")).encode()
    jb += b" " * ((-len(jb)) % 4)
    binary += b"\x00" * ((-len(binary)) % 4)
    total = 12 + 8 + len(jb) + 8 + len(binary)
    return (struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(jb), 0x4E4F534A) + jb
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


def local_matrix(n):
    if "matrix" in n:
        return np.array(n["matrix"], float).reshape(4, 4).T
    t = np.array(n.get("translation", [0, 0, 0]), float)
    x, y, z, w = n.get("rotation", [0, 0, 0, 1])
    s = np.array(n.get("scale", [1, 1, 1]), float)
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4)
    M[:3, :3] = R * s
    M[:3, 3] = t
    return M


def bounds(js, P0=None):
    lo, hi = np.full(3, np.inf), np.full(3, -np.inf)

    def walk(i, P):
        nonlocal lo, hi
        n = js["nodes"][i]
        M = P @ local_matrix(n)
        if "mesh" in n:
            for prim in js["meshes"][n["mesh"]]["primitives"]:
                a = js["accessors"][prim["attributes"]["POSITION"]]
                mn, mx = np.array(a["min"], float), np.array(a["max"], float)
                if a.get("normalized"):  # quantised positions (KHR_mesh_quantization): the node scale dequantises
                    k = {5120: 127.0, 5121: 255.0, 5122: 32767.0, 5123: 65535.0}[a["componentType"]]
                    mn, mx = mn / k, mx / k
                for cx in (mn[0], mx[0]):
                    for cy in (mn[1], mx[1]):
                        for cz in (mn[2], mx[2]):
                            v = M @ np.array([cx, cy, cz, 1.0])
                            lo, hi = np.minimum(lo, v[:3]), np.maximum(hi, v[:3])
        for c in n.get("children", []):
            walk(c, M)
    for r in js["scenes"][js.get("scene", 0)]["nodes"]:
        walk(r, np.eye(4) if P0 is None else P0)
    return lo, hi


def borrow(gg, sid, rel, size_px, yaw, wall=False):
    js, binary = read_glb(open(os.path.join(gg, rel), "rb").read())
    lo, hi = bounds(js)
    ext = hi - lo
    s = (size_px / 16.0) / float(ext.max())
    a = math.radians(yaw)
    RS = np.eye(4)
    RS[:3, :3] = np.array([[math.cos(a), 0, math.sin(a)], [0, 1, 0], [-math.sin(a), 0, math.cos(a)]]) * s
    lo, hi = bounds(js, RS)            # in the souvenir's own frame: turned and scaled
    ext = (hi - lo) * 16
    c = (lo + hi) / 2
    t = [float(-c[0]), float(-lo[1]), float(-lo[2] if wall else -c[2])]
    roots = js["scenes"][js.get("scene", 0)]["nodes"]
    q = [0, math.sin(a / 2), 0, math.cos(a / 2)]
    js["nodes"].append({"name": sid, "rotation": q, "scale": [s, s, s], "translation": t, "children": roots})
    js["scenes"][js.get("scene", 0)]["nodes"] = [len(js["nodes"]) - 1]
    js.setdefault("asset", {})["extras"] = {"borrowed": rel, "by": "Hoot Hollow globe (see docs/credits/globe.md)"}
    dst = os.path.join(ROOT, "public", "models", "souvenirs", f"{sid}.glb")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, "wb").write(write_glb(js, binary))
    return {"id": sid, "kb": round(os.path.getsize(dst) / 1024), "size_px": [round(float(v), 1) for v in ext]}


if __name__ == "__main__":
    gg = sys.argv[1]
    for sid, spec in BORROW.items():
        print(json.dumps(borrow(gg, sid, *spec)))
