"""Borrow a finished model (Gacha Garage world props, Poly Haven / BUSHED conversions) for one of furnB's items:
re-grade its texture to Hoot Hollow's calm palette with a matte finish, switch it to a lit material, fit it to the
item's old footprint (origin bottom centre, facing +z, world units: 1 = 16 px) and optionally merge extra parts from a
lowpix-built GLB (flames, glow). Works on meshopt-compressed GLBs without decoding them: geometry is only wrapped in a
new root node; images are re-encoded and the binary chunk is repacked.

Used by make.py (see BORROW in the item modules).
"""
from __future__ import annotations

import io
import json
import math
import struct

import numpy as np
from PIL import Image

from kit import P

COMP = {5120: (1, 127.0), 5121: (1, 255.0), 5122: (2, 32767.0), 5123: (2, 65535.0), 5125: (4, None), 5126: (4, None)}


def read_glb(path):
    with open(path, "rb") as fh:
        data = fh.read()
    magic, _, total = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, path
    off, js, binc = 12, None, b""
    while off < total:
        ln, typ = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + ln]
        if typ == 0x4E4F534A:
            js = json.loads(chunk.decode("utf8"))
        elif typ == 0x004E4942:
            binc = bytes(chunk)
        off += 8 + ln
    return js, binc


def write_glb(path, js, binc):
    jb = json.dumps(js, separators=(",", ":")).encode("utf8")
    jb += b" " * ((-len(jb)) % 4)
    binc = binc + b"\x00" * ((-len(binc)) % 4)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(binc)))
        fh.write(struct.pack("<II", len(jb), 0x4E4F534A) + jb)
        fh.write(struct.pack("<II", len(binc), 0x004E4942) + binc)


# ------------------------------------------------------------------ transforms and bounds
def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def node_matrix(n):
    if "matrix" in n:
        return np.array(n["matrix"], float).reshape(4, 4).T
    M = np.eye(4)
    S = np.diag(n.get("scale", [1, 1, 1]))
    R = quat_mat(n.get("rotation", [0, 0, 0, 1]))
    M[:3, :3] = R @ S
    M[:3, 3] = n.get("translation", [0, 0, 0])
    return M


def bounds(js):
    lo, hi = np.full(3, np.inf), np.full(3, -np.inf)

    def visit(i, parent):
        nonlocal lo, hi
        n = js["nodes"][i]
        M = parent @ node_matrix(n)
        if "mesh" in n:
            for prim in js["meshes"][n["mesh"]]["primitives"]:
                acc = js["accessors"][prim["attributes"]["POSITION"]]
                mn, mx = np.array(acc["min"], float), np.array(acc["max"], float)
                if acc.get("normalized"):
                    k = COMP[acc["componentType"]][1]
                    mn, mx = np.maximum(mn / k, -1), mx / k
                for c in range(8):
                    p = np.array([mx[0] if c & 1 else mn[0], mx[1] if c & 2 else mn[1], mx[2] if c & 4 else mn[2], 1.0])
                    w = (M @ p)[:3]
                    lo, hi = np.minimum(lo, w), np.maximum(hi, w)
        for ch in n.get("children", []):
            visit(ch, M)
    for r in js["scenes"][js.get("scene", 0)]["nodes"]:
        visit(r, np.eye(4))
    return lo, hi


# ------------------------------------------------------------------ colour grade
def _hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.maximum(d, 1e-6), 0)
    gc = np.where(m, (mx - g) / np.maximum(d, 1e-6), 0)
    bc = np.where(m, (mx - b) / np.maximum(d, 1e-6), 0)
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2.0 + rc - bc, 4.0 + gc - rc))
    h = (h / 6.0) % 1.0
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return h, s, mx


def _rgb(h, s, v):
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.zeros(h.shape + (3,))
    for k, (a, b, c) in enumerate(((v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q))):
        m = i == k
        out[m] = np.stack([a[m], b[m], c[m]], -1)
    return out


def hexrgb(c):
    return np.array([(c >> 16) & 255, (c >> 8) & 255, c & 255], float) / 255.0


def grade(img: Image.Image, g: dict) -> Image.Image:
    """Calm the colours: less saturation, cool slate shadows, warm lamp-gold highlights, a slight lift; then the
    item's own recolours: hue windows remapped toward palette colours (e.g. green foliage to ember maple)."""
    a = np.asarray(img.convert("RGBA")).astype(float) / 255.0
    rgb, alpha = a[..., :3], a[..., 3:]
    h, s, v = _hsv(rgb)
    for rc in g.get("recolour", []):  # {"hue": [h0, h1], "sat": [s0, s1], "val": [v0, v1], "to": 0xrrggbb, "amount": 0..1}
        h0, h1 = rc.get("hue", [0, 1])
        inh = (h >= h0) & (h <= h1) if h0 <= h1 else ((h >= h0) | (h <= h1))
        m = inh & (s >= rc.get("sat", [0, 1])[0]) & (s <= rc.get("sat", [0, 1])[1]) & (v >= rc.get("val", [0, 1])[0]) & (v <= rc.get("val", [0, 1])[1])
        th, ts, tv = _hsv(hexrgb(rc["to"])[None, None])
        k = rc.get("amount", 1.0)
        h = np.where(m, th[0, 0], h) if k >= 1 else np.where(m, (h + (th[0, 0] - h) * k) % 1.0, h)
        s = np.where(m, s * (1 - k) + ts[0, 0] * k * rc.get("keep_sat", 1.0) + s * k * (1 - rc.get("keep_sat", 1.0)), s)
        if "val_mul" in rc:
            v = np.where(m, np.clip(v * rc["val_mul"], 0, 1), v)
    s = s * g.get("sat", 0.78)
    rgb = _rgb(h, np.clip(s, 0, 1), v)
    lum = (rgb @ np.array([0.3, 0.59, 0.11]))[..., None]
    slate, lamp, paper = hexrgb(P["slate"]), hexrgb(P["lamp"]), hexrgb(P["paper"])
    sh = np.clip(1 - lum / 0.45, 0, 1) * g.get("shadow", 0.22)
    hl = np.clip((lum - 0.55) / 0.45, 0, 1) * g.get("light", 0.16)
    rgb = rgb * (1 - sh) + slate * sh * (lum + 0.35)
    rgb = rgb * (1 - hl) + (lamp * 0.6 + paper * 0.4) * hl
    tint = g.get("tint")
    if tint is not None:
        rgb = rgb * (1 - tint[1]) + rgb * hexrgb(tint[0]) * tint[1] * 1.6
    rgb = np.clip(rgb * g.get("gain", 1.04) + g.get("lift", 0.02), 0, 1)
    out = np.concatenate([rgb, alpha], -1)
    return Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA" if img.mode in ("RGBA", "LA", "P") else "RGBA")


def encode(img: Image.Image, mime: str, has_alpha: bool) -> bytes:
    buf = io.BytesIO()
    if not has_alpha:
        img = img.convert("RGB")
    if mime == "image/webp":
        img.save(buf, format="WEBP", quality=88, method=6)
    elif mime == "image/jpeg":
        img.convert("RGB").save(buf, format="JPEG", quality=88)
    else:
        img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ------------------------------------------------------------------ repack
def repack(js, views_data: dict[int, bytes], binc: bytes):
    """Rebuild buffer 0 from every bufferView (replacing the ones in views_data), keeping meshopt streams intact."""
    out = bytearray()

    def put(b):
        nonlocal out
        out += b"\x00" * ((-len(out)) % 4)
        o = len(out)
        out += b
        return o
    for i, bv in enumerate(js["bufferViews"]):
        ext = (bv.get("extensions") or {}).get("EXT_meshopt_compression")
        if ext is not None:
            src = binc[ext.get("byteOffset", 0): ext.get("byteOffset", 0) + ext["byteLength"]] if ext["buffer"] == 0 else None
            if src is not None:
                ext["byteOffset"] = put(src)
            continue
        if bv["buffer"] != 0:
            continue
        data = views_data.get(i)
        if data is None:
            data = binc[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
        bv["byteOffset"] = put(data)
        bv["byteLength"] = len(data)
    out += b"\x00" * ((-len(out)) % 4)
    js["buffers"][0]["byteLength"] = len(out)
    return bytes(out)


def merge(js, binc, js2, bin2, parent_name=None):
    """Append every node/mesh/material/texture of a plain (uncompressed, single-buffer) GLB js2 into js."""
    base = len(binc) + ((-len(binc)) % 4)
    binc = binc + b"\x00" * ((-len(binc)) % 4) + bin2
    nbv, nacc, nmat, ntex, nimg, nsam, nmesh, nnode = (len(js.get(k, [])) for k in ("bufferViews", "accessors", "materials", "textures", "images", "samplers", "meshes", "nodes"))
    for bv in js2.get("bufferViews", []):
        bv = dict(bv, buffer=0, byteOffset=bv.get("byteOffset", 0) + base)
        js.setdefault("bufferViews", []).append(bv)
    for a in js2.get("accessors", []):
        js.setdefault("accessors", []).append(dict(a, bufferView=a["bufferView"] + nbv))
    for im in js2.get("images", []):
        js.setdefault("images", []).append(dict(im, bufferView=im["bufferView"] + nbv))
    for s in js2.get("samplers", []):
        js.setdefault("samplers", []).append(s)
    for t in js2.get("textures", []):
        js.setdefault("textures", []).append(dict(t, source=t["source"] + nimg, sampler=t.get("sampler", 0) + nsam))
    for m in js2.get("materials", []):
        m = json.loads(json.dumps(m))
        for key in ("baseColorTexture",):
            if key in m.get("pbrMetallicRoughness", {}):
                m["pbrMetallicRoughness"][key]["index"] += ntex
        if "emissiveTexture" in m:
            m["emissiveTexture"]["index"] += ntex
        js.setdefault("materials", []).append(m)
    for me in js2.get("meshes", []):
        me = json.loads(json.dumps(me))
        for p in me["primitives"]:
            p["attributes"] = {k: v + nacc for k, v in p["attributes"].items()}
            if "indices" in p:
                p["indices"] += nacc
            if "material" in p:
                p["material"] += nmat
        js.setdefault("meshes", []).append(me)
    for n in js2.get("nodes", []):
        n = json.loads(json.dumps(n))
        if "mesh" in n:
            n["mesh"] += nmesh
        if "children" in n:
            n["children"] = [c + nnode for c in n["children"]]
        js["nodes"].append(n)
    roots = [r + nnode for r in js2["scenes"][js2.get("scene", 0)]["nodes"]]
    if js2.get("animations"):
        for an in js2["animations"]:
            an = json.loads(json.dumps(an))
            for ch in an["channels"]:
                ch["target"]["node"] += nnode
            for sm in an["samplers"]:
                sm["input"] += nacc
                sm["output"] += nacc
            js.setdefault("animations", []).append(an)
    for e in js2.get("extensionsUsed", []):
        if e not in js.setdefault("extensionsUsed", []):
            js["extensionsUsed"].append(e)
    js["buffers"][0]["byteLength"] = len(binc)
    return binc, roots


def borrow(src: str, dst: str, iid: str, target: list, g: dict | None = None, yaw: float = 0.0, fit: str = "contain", extra: str | None = None,
           extra_px: bool = True, nudge=(0.0, 0.0, 0.0), squash=(1.0, 1.0, 1.0)):
    """target: the old build() bounds in px [minX, maxX, minY, maxY, minZ, maxZ]."""
    js, binc = read_glb(src)
    g = g or {}
    # 1. images: re-grade (once per image)
    views = {}
    for im in js.get("images", []):
        bvi = im["bufferView"]
        bv = js["bufferViews"][bvi]
        raw = binc[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
        pil = Image.open(io.BytesIO(raw))
        has_alpha = pil.mode in ("RGBA", "LA") or (pil.mode == "P" and "transparency" in pil.info)
        views[bvi] = encode(grade(pil, g), im.get("mimeType", "image/png"), has_alpha)
    # 2. materials: lit, matte, no extra maps
    for m in js.get("materials", []):
        (m.get("extensions") or {}).pop("KHR_materials_unlit", None)
        if not m.get("extensions"):
            m.pop("extensions", None)
        pbr = m.setdefault("pbrMetallicRoughness", {})
        pbr["metallicFactor"] = 0.0
        pbr["roughnessFactor"] = 0.9
        for k in ("normalTexture", "occlusionTexture"):
            m.pop(k, None)
        pbr.pop("metallicRoughnessTexture", None)
    for key in ("extensionsUsed", "extensionsRequired"):
        if key in js:
            js[key] = [e for e in js[key] if e != "KHR_materials_unlit"]
    for n in js["nodes"]:
        n.pop("extras", None)
    binc = repack(js, views, binc)
    # 3. fit: yaw to face +z, uniform scale into the old bounds, bottom centre on the old footprint centre
    roots = js["scenes"][js.get("scene", 0)]["nodes"]
    q = [0.0, math.sin(math.radians(yaw) / 2), 0.0, math.cos(math.radians(yaw) / 2)]
    js["nodes"].append({"name": iid + "_src", "rotation": q, "scale": list(squash), "children": roots})
    inner = len(js["nodes"]) - 1
    js["scenes"][js.get("scene", 0)]["nodes"] = [inner]
    lo, hi = bounds(js)
    size = hi - lo
    tx0, tx1, ty0, ty1, tz0, tz1 = [v / 16.0 for v in target]
    tsz = np.array([tx1 - tx0, ty1 - ty0, tz1 - tz0])
    ratios = tsz / np.maximum(size, 1e-6)
    s = float(ratios.min()) if fit == "contain" else float(ratios[1]) if fit == "height" else float(min(ratios[0], ratios[2]))
    cx, cz = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2
    t = [((tx0 + tx1) / 2 - cx * s) + nudge[0] / 16, ty0 - lo[1] * s + nudge[1] / 16, ((tz0 + tz1) / 2 - cz * s) + nudge[2] / 16]
    js["nodes"].append({"name": iid, "translation": t, "scale": [s, s, s], "children": [inner]})
    root = len(js["nodes"]) - 1
    js["scenes"][js.get("scene", 0)]["nodes"] = [root]
    # 4. extra lowpix parts (already in px units: wrap them in a 1/16 node next to the model)
    if extra:
        j2, b2 = read_glb(extra)
        binc, roots2 = merge(js, binc, j2, b2)
        js["nodes"].append({"name": iid + "_extra", "scale": [1 / 16] * 3 if extra_px else [1, 1, 1], "children": roots2})
        js["scenes"][js.get("scene", 0)]["nodes"] = [root, len(js["nodes"]) - 1]
    js["asset"]["generator"] = "Hoot Hollow furnB borrow (source: " + js["asset"].get("generator", "?") + ")"
    write_glb(dst, js, binc)
    lo2, hi2 = bounds(js)
    return {"bounds_px": [round(float(v) * 16, 1) for v in (lo2[0], hi2[0], lo2[1], hi2[1], lo2[2], hi2[2])], "scale": s}
