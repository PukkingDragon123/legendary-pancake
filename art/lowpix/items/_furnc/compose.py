"""Borrowed models (BUSHED, Gacha Garage, Poly Haven), restyled to fit Hoot Hollow and composed into one item GLB.

A recipe loads one or more source GLBs, places each piece (scale / turn / move, in px with the item's origin at the
bottom-centre facing +z), regrades its texture toward the calm palette (matte, a little desaturated, slate shadows,
lamp-warm lights; optional hue remaps such as a black typewriter turned sage), and writes a lit, matte GLB in world
units (root scale 1/16, like the lowpix items) that build.py then meshopt-compresses. Credits: docs/credits/furnC.md.
"""
from __future__ import annotations

import colorsys
import io
import json
import math
import os
import struct
import subprocess

import numpy as np
from PIL import Image

from lib import P, _local, _read_glb

HERE = os.path.dirname(os.path.abspath(__file__))
SCRATCH = os.environ.get("FURNC_SCRATCH", "/tmp/furnc_compose")
_CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
_NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
_NORM = {5120: 127.0, 5121: 255.0, 5122: 32767.0, 5123: 65535.0}


def _accessor(js, bn, i):
    a = js["accessors"][i]
    bv = js["bufferViews"][a["bufferView"]]
    dt = np.dtype(_CT[a["componentType"]])
    n = _NC[a["type"]]
    stride = bv.get("byteStride") or dt.itemsize * n
    base = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    cnt = a["count"]
    raw = np.frombuffer(bn, dtype=np.uint8, count=stride * (cnt - 1) + dt.itemsize * n, offset=base)
    rows = np.lib.stride_tricks.as_strided(raw, shape=(cnt, dt.itemsize * n), strides=(stride, 1)).copy()
    arr = rows.view(dt).reshape(cnt, n).astype(np.float64)
    if a.get("normalized") and a["componentType"] in _NORM:
        arr = np.maximum(arr / _NORM[a["componentType"]], -1.0)
    return arr if n > 1 else arr[:, 0]


def load(path):
    """Source GLB -> list of pieces {P, N, UV, I, img} in the model's own space (node transforms baked)."""
    if path.endswith(".glb"):
        data = open(path, "rb").read()
        if b"EXT_meshopt_compression" in data[:200000]:
            os.makedirs(SCRATCH, exist_ok=True)
            plain = os.path.join(SCRATCH, os.path.basename(path))
            subprocess.run(["node", os.path.join(HERE, "unpack.cjs"), path, plain], check=True)
            data = open(plain, "rb").read()
        js, bn = _read_glb(data)
    else:
        raise ValueError(path)
    nodes = js["nodes"]
    parent = [-1] * len(nodes)
    for i, nd in enumerate(nodes):
        for c in nd.get("children", []):
            parent[c] = i
    world = {}

    def W(i):
        if i not in world:
            world[i] = (W(parent[i]) if parent[i] >= 0 else np.eye(4)) @ _local(nodes[i])
        return world[i]

    imgs = {}

    def image(mat_i):
        if mat_i in imgs:
            return imgs[mat_i]
        m = js["materials"][mat_i] if mat_i is not None else {}
        pbr = m.get("pbrMetallicRoughness", {})
        fac = pbr.get("baseColorFactor", [1, 1, 1, 1])
        tex = pbr.get("baseColorTexture")
        if tex is not None:
            t = js["textures"][tex["index"]]
            src = t.get("source")
            if src is None:
                src = (t.get("extensions") or {}).get("EXT_texture_webp", {}).get("source")
            im = js["images"][src]
            bv = js["bufferViews"][im["bufferView"]]
            b = bn[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
            img = Image.open(io.BytesIO(bytes(b))).convert("RGBA")
            if fac[:3] != [1, 1, 1]:
                a = np.array(img).astype(np.float32)
                a[..., :3] *= np.array(fac[:3], np.float32)
                img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")
        else:
            c = tuple(int(255 * min(1, max(0, v)) ** (1 / 2.2)) for v in fac[:3])
            img = Image.new("RGBA", (8, 8), c + (255,))
        imgs[mat_i] = img
        return img

    out = []
    for i, nd in enumerate(nodes):
        if "mesh" not in nd:
            continue
        M = W(i)
        for pr in js["meshes"][nd["mesh"]]["primitives"]:
            at = pr["attributes"]
            Pp = _accessor(js, bn, at["POSITION"])[:, :3]
            Nn = _accessor(js, bn, at["NORMAL"])[:, :3] if "NORMAL" in at else None
            UV = _accessor(js, bn, at["TEXCOORD_0"])[:, :2] if "TEXCOORD_0" in at else np.zeros((len(Pp), 2))
            I = _accessor(js, bn, pr["indices"]).astype(np.int64) if "indices" in pr else np.arange(len(Pp))
            Pw = Pp @ M[:3, :3].T + M[:3, 3]
            if Nn is None:
                Nn = np.zeros_like(Pp)
                T = Pw[I.reshape(-1, 3)]
                fn = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
                for k in range(3):
                    np.add.at(Nn, I.reshape(-1, 3)[:, k], fn)
            else:
                Nn = Nn @ np.linalg.inv(M[:3, :3]).T
            Nn /= np.maximum(np.linalg.norm(Nn, axis=1, keepdims=True), 1e-9)
            out.append({"P": Pw, "N": Nn, "UV": UV, "I": I.reshape(-1), "img": image(pr.get("material"))})
    return out


def bounds(pieces):
    allp = np.concatenate([p["P"] for p in pieces])
    return allp.min(axis=0), allp.max(axis=0)


def place(pieces, height=None, width=None, depth=None, yaw=0.0, at=(0, 0, 0), keep=None, tilt=(0, 0)):
    """Rotate (yaw about y, then tilt about x/z in degrees), scale to a size in px (height, width or depth), and put the
    bottom-centre of the bounds at `at`. Returns new pieces."""
    def R(deg, axis):
        a = math.radians(deg)
        c, s = math.cos(a), math.sin(a)
        if axis == "y":
            return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
        if axis == "x":
            return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
        return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    Rm = R(tilt[1], "z") @ R(tilt[0], "x") @ R(yaw, "y")
    ps = [dict(p, P=p["P"] @ Rm.T, N=p["N"] @ Rm.T) for p in pieces]
    lo, hi = bounds(ps)
    size = hi - lo
    if height:
        k = height / size[1]
    elif width:
        k = width / size[0]
    elif depth:
        k = depth / size[2]
    else:
        k = keep or 1.0
    c = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    return [dict(p, P=(p["P"] - c) * k + np.array(at, float)) for p in ps]


# ------------------------------------------------------------------ colour grading toward the calm palette

def _rgb(c):
    return np.array([(c >> 16) & 255, (c >> 8) & 255, c & 255], np.float32)


def grade(img, sat=0.82, warm=0.12, cool=0.18, gamma=1.0, lift=0.0, tint=None, tint_amt=0.0):
    """Matte, calm grade: desaturate a little, pull shadows toward slate and lights toward lamp."""
    a = np.array(img).astype(np.float32)
    rgb = a[..., :3] / 255.0
    lum = (rgb @ np.array([0.3, 0.55, 0.15], np.float32))[..., None]
    rgb = lum + (rgb - lum) * sat
    if gamma != 1.0:
        rgb = np.clip(rgb, 0, 1) ** gamma
    sl, lp = _rgb(P["slate"]) / 255.0, _rgb(P["lamp"]) / 255.0
    w_sh = np.clip(1 - lum * 1.8, 0, 1) * cool
    w_li = np.clip((lum - 0.45) * 1.8, 0, 1) * warm
    rgb = rgb * (1 - w_sh) + sl * w_sh
    rgb = rgb * (1 - w_li) + lp * w_li
    if tint is not None:
        rgb = rgb * (1 - tint_amt) + (_rgb(tint) / 255.0) * lum * 1.6 * tint_amt
    rgb = rgb + lift
    a[..., :3] = np.clip(rgb, 0, 1) * 255
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def remap(img, pick, ramp_keys, strength=1.0):
    """Recolour texels where pick(h, s, v) is true onto a palette ramp by their value (keeps the painted shading)."""
    a = np.array(img).astype(np.float32)
    rgb = a[..., :3] / 255.0
    mx, mn = rgb.max(-1), rgb.min(-1)
    v = mx
    s = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(v)
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, h)
    h = np.where(mx == g, (b - r) / d + 2, h)
    h = np.where(mx == b, (r - g) / d + 4, h)
    h = (h / 6.0) % 1.0
    m = pick(h, s, v) & (a[..., 3] > 0)
    ramp = np.array([_rgb(P[k] if isinstance(k, str) else k) for k in ramp_keys], np.float32) / 255.0
    lum = rgb @ np.array([0.3, 0.55, 0.15], np.float32)
    lo, hi = np.percentile(lum[m], 3) if m.any() else 0, np.percentile(lum[m], 97) if m.any() else 1
    t = np.clip((lum - lo) / max(hi - lo, 1e-3), 0, 1) * (len(ramp) - 1)
    i0 = np.clip(np.floor(t).astype(int), 0, len(ramp) - 2)
    f = (t - i0)[..., None]
    col = ramp[i0] * (1 - f) + ramp[i0 + 1] * f
    rgb = np.where(m[..., None], rgb * (1 - strength) + col * strength, rgb)
    a[..., :3] = np.clip(rgb, 0, 1) * 255
    return Image.fromarray(a.astype(np.uint8), "RGBA")


# ------------------------------------------------------------------ output


def write(pieces, path, max_tex=1024, roughness=0.92):
    """Pieces (px) -> GLB in world units: one lit matte material per distinct texture, everything in one mesh."""
    groups = {}
    for p in pieces:
        groups.setdefault(id(p["img"]), [p["img"], []])[1].append(p)
    out = {"asset": {"version": "2.0", "generator": "hoot hollow furnC compose"}, "scene": 0,
           "scenes": [{"name": os.path.basename(path), "nodes": [0]}],
           "nodes": [{"name": "item", "scale": [1 / 16] * 3, "children": [1]}, {"name": "static", "mesh": 0}],
           "meshes": [{"name": "static", "primitives": []}], "materials": [], "textures": [], "images": [],
           "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
           "accessors": [], "bufferViews": [],
           "extensionsUsed": ["KHR_mesh_quantization"], "extensionsRequired": ["KHR_mesh_quantization"]}
    blob = bytearray()

    def view(data, target=None, stride=None):
        while len(blob) % 4:
            blob.append(0)
        bv = {"buffer": 0, "byteOffset": len(blob), "byteLength": len(data)}
        if target:
            bv["target"] = target
        if stride:
            bv["byteStride"] = stride
        out["bufferViews"].append(bv)
        blob.extend(data)
        return len(out["bufferViews"]) - 1

    def acc(arr, kind, ctype, target=None, minmax=False, stride=None, normalized=False):
        v = view(np.ascontiguousarray(arr).tobytes(), target, stride)
        a = {"bufferView": v, "componentType": ctype, "count": int(arr.shape[0]), "type": kind}
        if normalized:
            a["normalized"] = True
        if minmax:
            a["min"] = [float(x) for x in arr.min(axis=0)]
            a["max"] = [float(x) for x in arr.max(axis=0)]
        out["accessors"].append(a)
        return len(out["accessors"]) - 1

    for img, ps in groups.values():
        im = img
        if max(im.size) > max_tex:
            k = max_tex / max(im.size)
            im = im.resize((max(1, int(im.size[0] * k)), max(1, int(im.size[1] * k))), Image.LANCZOS)
        buf = io.BytesIO()
        alpha = np.array(im)[..., 3].min() < 250
        if alpha:
            im.save(buf, "PNG", optimize=True)
            mime = "image/png"
        else:
            im.convert("RGB").save(buf, "JPEG", quality=86, optimize=True)
            mime = "image/jpeg"
        out["images"].append({"bufferView": view(buf.getvalue()), "mimeType": mime})
        out["textures"].append({"sampler": 0, "source": len(out["images"]) - 1})
        mat = {"name": f"borrowed{len(out['materials'])}", "pbrMetallicRoughness": {
            "baseColorTexture": {"index": len(out["textures"]) - 1}, "metallicFactor": 0.0, "roughnessFactor": roughness},
            "doubleSided": True}
        if alpha:
            mat["alphaMode"] = "MASK"
            mat["alphaCutoff"] = 0.5
        out["materials"].append(mat)
        Pp = np.concatenate([p["P"] for p in ps]).astype(np.float32)
        Nn = np.concatenate([p["N"] for p in ps])
        UV = np.concatenate([p["UV"] for p in ps]).astype(np.float32)
        offs = np.cumsum([0] + [len(p["P"]) for p in ps[:-1]])
        I = np.concatenate([p["I"] + o for p, o in zip(ps, offs)])
        n4 = np.zeros((len(Nn), 4), np.int8)
        n4[:, :3] = np.clip(np.round(Nn * 127), -127, 127).astype(np.int8)
        prim = {"attributes": {
            "POSITION": acc(Pp, "VEC3", 5126, 34962, True),
            "NORMAL": acc(n4, "VEC3", 5120, 34962, stride=4, normalized=True),
            "TEXCOORD_0": acc(UV, "VEC2", 5126, 34962)},
            "indices": acc(I.astype(np.uint16) if len(Pp) < 65536 else I.astype(np.uint32), "SCALAR",
                           5123 if len(Pp) < 65536 else 5125, 34963),
            "material": len(out["materials"]) - 1}
        out["meshes"][0]["primitives"].append(prim)
    while len(blob) % 4:
        blob.append(0)
    out["buffers"] = [{"byteLength": len(blob)}]
    jsb = json.dumps(out, separators=(",", ":")).encode()
    jsb += b" " * ((-len(jsb)) % 4)
    total = 12 + 8 + len(jsb) + 8 + len(blob)
    data = (struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(jsb), 0x4E4F534A) + jsb
            + struct.pack("<II", len(blob), 0x004E4942) + bytes(blob))
    with open(path, "wb") as fh:
        fh.write(data)
    lo, hi = bounds(pieces)
    tris = sum(len(p["I"]) // 3 for p in pieces)
    return {"tris": tris, "lo": lo, "hi": hi}


def split(pieces, gap=0.02):
    """Split pieces into separate objects: connected triangles (welded by position), then objects whose footprints
    overlap are kept together (a cup on its saucer). Returns a list of objects, each a list of pieces."""
    objs = []
    for p in pieces:
        P, I = p["P"], p["I"].reshape(-1, 3)
        key = np.round(P / max(gap, 1e-6)).astype(np.int64)
        _, weld = np.unique(key, axis=0, return_inverse=True)
        weld = weld.reshape(-1)
        parent = list(range(int(weld.max()) + 1))

        def f(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x
        for a, b, c in weld[I]:
            ra = f(a)
            parent[f(b)] = ra
            parent[f(c)] = ra
        comp = np.array([f(weld[t[0]]) for t in I])
        for cid in np.unique(comp):
            tris = I[comp == cid]
            used, inv = np.unique(tris.reshape(-1), return_inverse=True)
            objs.append([dict(p, P=P[used], N=p["N"][used], UV=p["UV"][used], I=inv.astype(np.int64))])
    boxes = [bounds(o) for o in objs]
    group = list(range(len(objs)))

    def g(x):
        while group[x] != x:
            x = group[x]
        return x
    for i in range(len(objs)):
        for j in range(i + 1, len(objs)):
            (l1, h1), (l2, h2) = boxes[i], boxes[j]
            if l1[0] < h2[0] and l2[0] < h1[0] and l1[2] < h2[2] and l2[2] < h1[2] and g(i) != g(j):
                group[g(j)] = g(i)
    out = {}
    for i, o in enumerate(objs):
        out.setdefault(g(i), []).extend(o)
    return list(out.values())
