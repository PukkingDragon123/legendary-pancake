"""Borrowed furniture for furnA's items, restyled into Hoot Hollow's realistic pixel-art look (BUSHED's look: real
proportions, crisp high-resolution pixel textures, calm palette, lit by the game).

    cd <repo>; ~/.cache/lowpix-venv/bin/python art/lowpix/items/_furnA/borrow.py [ids...]

Sources, in order of preference:
  bushed  BUSHED's props (the owner's lumberjack game; Poly Haven CC0 models it converted to pixel-hd at 256 px/m),
  gg      Gacha Garage world props (the owner's game; lowpix-converted, meshopt + WebP, credits in its manifest),
  ph      Poly Haven (CC0) models converted here by convert_all.sh (lowpix `painted`), pixelised BUSHED-style,
  spec    lowpix parts built by build.py (flames, flowers) merged into the item.
Every item: parts are fitted (height in px, origin bottom-centre, facing +Z) and composed; every atlas is re-graded
(calmer chroma, slate-tinted shadows, lamp-warm highlights) and re-quantised onto a k-means palette (crisp texels,
BUSHED's pix.py), materials become lit and matte (glow parts keep an unlit twin), the root is scaled 1/16 to world
units. Writes public/models/items/<id>.glb and docs/credits/furnA.md.
"""
from __future__ import annotations

import io
import json
import math
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
sys.path.insert(0, HERE)
from build import read_glb, finish_glb  # noqa: E402
from kit import P  # noqa: E402
from pix import kmeans, quantize, despeckle  # noqa: E402

SCRATCH = "/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad"
CONV = os.environ.get("FURNA_CONV", SCRATCH + "/agents/furnA/conv")
OUT = os.environ.get("FURNA_OUT", SCRATCH + "/agents/furnA/out")
BUSHED = os.environ.get("BUSHED_MODELS", SCRATCH + "/refs4/lpx-bushed/games/bushed/public/assets/models")
GG = os.environ.get("GG_WORLD", SCRATCH + "/refs3/gg/public/models/lowpix/world")
CC0, CCBY = "CC0 1.0", "CC BY 4.0"

# Poly Haven sources (all CC0): id -> (title, authors). BUSHED's props are Poly Haven models too.
PH = {
    "wooden_stool_01": ("Wooden Stool 01", "Kuutti Siitonen"),
    "wooden_bookshelf_worn": ("Wooden Bookshelf Worn", "Ulan Cabanilla"),
    "wooden_candlestick": ("Wooden Candlestick", "Josh Dean"),
    "book_encyclopedia_set_01": ("Book Encyclopedia Set 01", "John Malcolm"),
    "painted_wooden_cabinet_02": ("Painted Wooden Cabinet 02", "Kirill Sannikov"),
    "round_wooden_table_01": ("Round Wooden Table 01", "Ulan Cabanilla"),
    "tea_set_01": ("Tea Set 01", "James Ray Cock, Rico Cilliers, Jurita Burger"),
    "chinese_tea_table": ("Chinese Tea Table", "Kirill Sannikov"),
    "wooden_table_02": ("Wooden Table 02", "Serhii Khromov"),
    "desk_lamp_arm_01": ("Desk Lamp Arm 01", "Yann Kervran, Kuutti Siitonen"),
    "treasure_chest": ("Treasure Chest", "Rico Cilliers"),
    "potted_plant_04": ("Potted Plant 04", "James Ray Cock"),
    "garden_gnome": ("Garden Gnome", "Bhargav Kubal"),
    "fern_02": ("Fern 02", "Rob Tuytel, Rico Cilliers"),
    "planter_pot_clay": ("Planter Pot Clay", "Amal Kumar"),
}

# item -> list of parts. Part keys: kind (bushed|gg|ph|spec), src, h (height px; uniform scale), sx/sz (stretch),
# at [x, y|"TOP"|"SOIL", z] (bottom-centre), yaw (deg), crop [x0, x1] (fraction of width, ph only),
# grade {sat, tint: [hex, amount], recolour: [...]}, colours (palette size), down (atlas downscale for ph).
# The first part sets "TOP" (its height) for the parts that stand on it. A gg part must come first (meshopt).
RECIPES = {
    # BUSHED props
    "stool": [dict(kind="bushed", src="wooden_stool_01", h=6.6)],
    "bookshelf": [dict(kind="bushed", src="wooden_bookshelf_worn", h=26, down=0.32, colours=36), "BOOKS"],
    "candles": [dict(kind="bushed", src="wooden_candlestick", h=9.4, at=[1.1, 0, -0.9]),
                dict(kind="bushed", src="wooden_candlestick", h=7.4, at=[-2.4, 0, 0.8], yaw=40),
                dict(kind="bushed", src="wooden_candlestick", h=5.4, at=[2.4, 0, 2.2], yaw=-70),
                dict(kind="spec", src="candles_flames")],
    # Gacha Garage props
    "armchair": [dict(kind="gg", src="chair_green", h=17)],
    "nightstand": [dict(kind="gg", src="nightstand", h=10, grade=dict(sat=0.62))],
    "chair": [dict(kind="gg", src="chair_painted", h=16)],
    "record": [dict(kind="gg", src="gramophone", h=15, grade=dict(sat=0.6))],
    "paperlantern": [dict(kind="gg", src="lantern_paper", h=15)],
    "easel": [dict(kind="gg", src="chalkboard", h=19.5)],
    "cushion": [dict(kind="gg", src="mk_zabuton", h=4.6, grade=dict(sat=0.55, recolour=[dict(hue=[0.6, 0.95], sat=[0.15, 1], to=P["plum"], amount=0.7)]))],
    "books": [dict(kind="gg", src="books_stack", h=8.5, grade=dict(sat=0.6))],
    "planter": [dict(kind="gg", src="planter_box", h=7.5), dict(kind="spec", src="planter_flowers", at=[0, "SOIL", 0])],
    # Poly Haven conversions (pixelised here)
    "wardrobe": [dict(kind="ph", src="painted_wooden_cabinet_02", h=26)],
    "teaset": [dict(kind="ph", src="round_wooden_table_01", h=9.2), dict(kind="ph", src="tea_set_01", h=2.5, at=[0, "TOP", 0], yaw=20, down=1.0)],
    "teatable": [dict(kind="ph", src="chinese_tea_table", h=8), dict(kind="ph", src="tea_set_01", h=2.4, at=[0, "TOP", 0], yaw=-35, down=1.0)],
    "desk": [dict(kind="ph", src="wooden_table_02", h=11, sx=1.45, sz=0.82),
             dict(kind="ph", src="desk_lamp_arm_01", h=7.5, at=[7.4, "TOP", -1.2], yaw=-130, grade=dict(sat=0.5, tint=["#86a06a", 0.25]), down=1.0),
             dict(kind="ph", src="book_encyclopedia_set_01", h=2.6, at=[-6.0, "TOP", -1.6], yaw=8, down=1.0)],
    "chest": [dict(kind="ph", src="treasure_chest", h=9)],
    "cactus": [dict(kind="ph", src="potted_plant_04", h=14)],
    "gnome": [dict(kind="ph", src="garden_gnome", h=18, grade=dict(sat=0.62))],
}
BORROWED = set(RECIPES)

GG_MANIFEST = os.path.join(GG, "manifest.json")


# ------------------------------------------------------------------------------------------------ glTF helpers
COMP = {5120: 127.0, 5121: 255.0, 5122: 32767.0, 5123: 65535.0}


def accessor_array(js, binary, ai):
    a = js["accessors"][ai]
    bv = js["bufferViews"][a["bufferView"]]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a["componentType"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride")
    if stride and stride != n * np.dtype(dt).itemsize:
        raw = np.frombuffer(binary, np.uint8, a["count"] * stride, off).reshape(a["count"], stride)
        arr = raw[:, :n * np.dtype(dt).itemsize].copy().view(dt)
    else:
        arr = np.frombuffer(binary, dt, a["count"] * n, off)
    return arr.reshape(a["count"], n) if n > 1 else arr


def quat_mat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def node_matrix(n):
    if "matrix" in n:
        return np.array(n["matrix"], float).reshape(4, 4).T
    M = np.eye(4)
    M[:3, :3] = quat_mat(n.get("rotation", [0, 0, 0, 1])) @ np.diag(n.get("scale", [1, 1, 1]))
    M[:3, 3] = n.get("translation", [0, 0, 0])
    return M


def bounds(js):
    """World bounds from accessor min/max through the node tree (works on meshopt / quantised GLBs too)."""
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
                    k = COMP[acc["componentType"]]
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


def view_bytes(js, binary, i):
    bv = js["bufferViews"][i]
    return binary[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]


class Composer:
    """Builds one GLB from a base GLB (any, incl. meshopt) plus plain GLBs appended under transformed nodes."""

    def __init__(self, js, binary):
        self.js = json.loads(json.dumps(js))
        self.views = {}           # replaced bufferView data (images)
        self.bin = bytearray(binary)
        self.kinds = {}           # image index -> (kind, grade)
        self.js.setdefault("animations", [])

    def put(self, data):
        while len(self.bin) % 4:
            self.bin += b"\x00"
        off = len(self.bin)
        self.bin += data
        return off

    def append(self, js2, bin2, node, kind, grade):
        J = self.js
        o = {k: len(J.get(k, [])) for k in ("nodes", "meshes", "materials", "textures", "images", "samplers", "accessors", "bufferViews")}
        for i, bv in enumerate(js2["bufferViews"]):
            off = self.put(bytes(view_bytes(js2, bin2, i)))
            nb = {"buffer": 0, "byteOffset": off, "byteLength": bv["byteLength"]}
            for k in ("byteStride", "target"):
                if k in bv:
                    nb[k] = bv[k]
            J.setdefault("bufferViews", []).append(nb)
        for a in js2["accessors"]:
            J.setdefault("accessors", []).append(dict(a, bufferView=a["bufferView"] + o["bufferViews"]))
        for ii, im in enumerate(js2.get("images", [])):
            J.setdefault("images", []).append(dict(im, bufferView=im["bufferView"] + o["bufferViews"]))
            self.kinds[o["images"] + ii] = (kind, grade)
        J.setdefault("samplers", []).extend(dict(s) for s in js2.get("samplers", []))
        for t in js2.get("textures", []):
            t = json.loads(json.dumps(t))
            if "sampler" in t:
                t["sampler"] += o["samplers"]
            if "source" in t:
                t["source"] += o["images"]
            for e in (t.get("extensions") or {}).values():
                if "source" in e:
                    e["source"] += o["images"]
            J.setdefault("textures", []).append(t)
        for m in js2.get("materials", []):
            m = json.loads(json.dumps(m))
            bct = m.get("pbrMetallicRoughness", {}).get("baseColorTexture")
            if bct:
                bct["index"] += o["textures"]
            J.setdefault("materials", []).append(m)
        for me in js2.get("meshes", []):
            me = json.loads(json.dumps(me))
            for p in me["primitives"]:
                p["attributes"] = {k: v + o["accessors"] for k, v in p["attributes"].items()}
                if "indices" in p:
                    p["indices"] += o["accessors"]
                if "material" in p:
                    p["material"] += o["materials"]
            J.setdefault("meshes", []).append(me)
        for n in js2["nodes"]:
            n = json.loads(json.dumps(n))
            if "mesh" in n:
                n["mesh"] += o["meshes"]
            if "children" in n:
                n["children"] = [c + o["nodes"] for c in n["children"]]
            J["nodes"].append(n)
        for an in js2.get("animations", []):
            an = json.loads(json.dumps(an))
            for s in an["samplers"]:
                s["input"] += o["accessors"]
                s["output"] += o["accessors"]
            for c in an["channels"]:
                c["target"]["node"] += o["nodes"]
            J["animations"].append(an)
        node = dict(node, children=[r + o["nodes"] for r in js2["scenes"][js2.get("scene", 0)]["nodes"]])
        J["nodes"].append(node)
        return len(J["nodes"]) - 1

    def finish(self):
        J = self.js
        if not J["animations"]:
            del J["animations"]
        else:  # merge clips of the same name
            by = {}
            for a in J["animations"]:
                if a["name"] in by:
                    b = by[a["name"]]
                    k = len(b["samplers"])
                    b["samplers"] += a["samplers"]
                    for c in a["channels"]:
                        b["channels"].append(dict(c, sampler=c["sampler"] + k))
                else:
                    by[a["name"]] = a
            J["animations"] = list(by.values())
        # repack buffer 0: replaced image views + everything else (meshopt streams follow their extension offsets)
        binary = bytes(self.bin)
        out = bytearray()

        def put(b):
            while len(out) % 4:
                out.append(0)
            o = len(out)
            out.extend(b)
            return o
        for i, bv in enumerate(J["bufferViews"]):
            ext = (bv.get("extensions") or {}).get("EXT_meshopt_compression")
            if ext is not None:
                if ext["buffer"] == 0:
                    ext["byteOffset"] = put(binary[ext.get("byteOffset", 0): ext.get("byteOffset", 0) + ext["byteLength"]])
                continue
            if bv.get("buffer", 0) != 0:
                continue
            data = self.views.get(i)
            if data is None:
                data = binary[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
            bv["byteOffset"] = put(data)
            bv["byteLength"] = len(data)
        while len(out) % 4:
            out.append(0)
        J["buffers"][0]["byteLength"] = len(out)
        return J, bytes(out)


# ------------------------------------------------------------------------------------------------ restyle
def hexrgb(c):
    return np.array([(c >> 16) & 255, (c >> 8) & 255, c & 255], float) / 255.0


def _hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    m = d > 1e-6
    dd = np.maximum(d, 1e-6)
    rc, gc, bc = (mx - r) / dd, (mx - g) / dd, (mx - b) / dd
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2.0 + rc - bc, 4.0 + gc - rc))
    h = np.where(m, (h / 6.0) % 1.0, 0)
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


def grade(rgb, g):
    """Hoot Hollow's calm grade (shared with furnB): recolour windows, lower chroma, slate shadows, lamp highlights."""
    h, s, v = _hsv(rgb)
    for rc in g.get("recolour", []):
        h0, h1 = rc.get("hue", [0, 1])
        inh = (h >= h0) & (h <= h1) if h0 <= h1 else ((h >= h0) | (h <= h1))
        m = inh & (s >= rc.get("sat", [0, 1])[0]) & (s <= rc.get("sat", [0, 1])[1]) & (v >= rc.get("val", [0, 1])[0]) & (v <= rc.get("val", [0, 1])[1])
        th, ts, _ = _hsv(hexrgb(rc["to"])[None, None])
        k = rc.get("amount", 1.0)
        h = np.where(m, (h + (((th[0, 0] - h + 0.5) % 1.0) - 0.5) * k) % 1.0, h)
        s = np.where(m, s * (1 - k) + ts[0, 0] * k, s)
    s = s * g.get("sat", 0.78)
    rgb = _rgb(h, np.clip(s, 0, 1), v)
    if g.get("tint"):
        t = hexrgb(int(g["tint"][0][1:], 16))
        rgb = rgb * (1 - g["tint"][1]) + rgb * t * g["tint"][1] * 1.6
    lum = (rgb @ np.array([0.3, 0.59, 0.11]))[..., None]
    sh = np.clip(1 - lum / 0.45, 0, 1) * g.get("shadow", 0.2)
    hl = np.clip((lum - 0.55) / 0.45, 0, 1) * g.get("light", 0.14)
    rgb = rgb * (1 - sh) + hexrgb(P["slate"]) * sh * (lum + 0.35)
    rgb = rgb * (1 - hl) + (hexrgb(P["lamp"]) * 0.6 + hexrgb(P["paper"]) * 0.4) * hl
    return np.clip(rgb * g.get("gain", 1.04) + g.get("lift", 0.015), 0, 1)


def restyle(raw: bytes, g: dict, colours=48, down=1.0, out_mime="image/png", seed=1):
    """Grade, optionally area-downscale, re-quantise onto a k-means palette (crisp pixel art, BUSHED's pix.py)."""
    im = Image.open(io.BytesIO(raw)).convert("RGBA")
    if down != 1.0:
        im = im.resize((max(16, int(im.width * down)), max(16, int(im.height * down))), Image.BOX)
    a = np.asarray(im).astype(np.float32) / 255.0
    rgb, alpha = a[..., :3], a[..., 3:]
    rgb = grade(rgb, g)
    opaque = alpha[..., 0] > 0.5
    px = rgb[opaque] if opaque.any() else rgb.reshape(-1, 3)
    uniq = np.unique(np.round(px.reshape(-1, 3) * 255).astype(np.int32), axis=0)
    if len(uniq) <= colours:   # already a small palette: keep it
        pal = uniq.astype(np.float32) / 255.0
    else:
        pal = kmeans(px.reshape(-1, 3), colours, seed=seed)
    q, idx = quantize(rgb, pal, dither=0.02)
    q, idx = despeckle(idx, pal)
    has_alpha = bool((alpha < 0.99).any())
    buf = io.BytesIO()
    if out_mime == "image/webp":
        img = Image.fromarray((np.concatenate([q, (alpha > 0.5).astype(np.float32)], -1) * 255 + 0.5).astype(np.uint8), "RGBA")
        img.save(buf, "WEBP", lossless=True, quality=100, method=6)
    else:   # indexed PNG with a 1-bit alpha
        pal8 = (np.clip(pal, 0, 1) * 255 + 0.5).astype(np.uint8)
        ix = idx.astype(np.uint8)
        if has_alpha:
            ix = np.where(alpha[..., 0] > 0.5, ix + 1, 0).astype(np.uint8)
            pal8 = np.vstack([[0, 0, 0], pal8])
        p = Image.fromarray(ix, "P")
        flat = pal8.reshape(-1).tolist()
        p.putpalette(flat + [0] * (768 - len(flat)))
        if has_alpha:
            p.save(buf, "PNG", optimize=True, transparency=bytes([0] + [255] * (len(pal8) - 1)))
        else:
            p.save(buf, "PNG", optimize=True)
    return buf.getvalue()


# ------------------------------------------------------------------------------------------------ parts
def src_path(part):
    k, s = part["kind"], part["src"]
    if k == "bushed":
        return os.path.join(BUSHED, f"{s}.glb")
    if k == "gg":
        return os.path.join(GG, f"{s}.glb")
    if k == "spec":
        return os.path.join(OUT, s, f"{s}.glb")
    fs = [f for f in os.listdir(os.path.join(CONV, s)) if f.endswith(".glb")]
    return os.path.join(CONV, s, fs[0])


def crop(js, binary, x0f, x1f):
    """Keep the triangles whose centre lies in [x0f, x1f] of the width (one plant out of a set); compact; return a
    plain (js, binary) standing on y = 0, centred on x = z = 0."""
    lo, hi = bounds(js)
    x0, x1 = lo[0] + (hi[0] - lo[0]) * x0f, lo[0] + (hi[0] - lo[0]) * x1f
    out = json.loads(json.dumps(js))
    gbin = bytearray(binary)

    def put(arr):
        while len(gbin) % 4:
            gbin.extend(b"\x00")
        out["bufferViews"].append({"buffer": 0, "byteOffset": len(gbin), "byteLength": arr.nbytes})
        gbin.extend(arr.tobytes())
        return len(out["bufferViews"]) - 1
    glo, ghi = np.full(3, np.inf), np.full(3, -np.inf)
    for mi, me in enumerate(js["meshes"]):
        for pi, p in enumerate(me["primitives"]):
            Pp = accessor_array(js, binary, p["attributes"]["POSITION"])
            I = accessor_array(js, binary, p["indices"]).reshape(-1, 3)
            cx = Pp[I].mean(axis=1)[:, 0]
            keep = I[(cx >= x0) & (cx <= x1)]
            used = np.unique(keep)
            remap = np.full(len(Pp), -1, np.int64)
            remap[used] = np.arange(len(used))
            newp = out["meshes"][mi]["primitives"][pi]
            for k, ai in p["attributes"].items():
                arr = np.ascontiguousarray(accessor_array(js, binary, ai)[used].astype(np.float32))
                a = {kk: vv for kk, vv in js["accessors"][ai].items() if kk not in ("byteOffset", "min", "max")}
                a.update(bufferView=put(arr), count=int(len(used)), componentType=5126)
                if k == "POSITION":
                    a["min"], a["max"] = arr.min(0).tolist(), arr.max(0).tolist()
                    glo, ghi = np.minimum(glo, arr.min(0)), np.maximum(ghi, arr.max(0))
                out["accessors"].append(a)
                newp["attributes"][k] = len(out["accessors"]) - 1
            idx = np.ascontiguousarray(remap[keep].reshape(-1).astype(np.uint32))
            out["accessors"].append({"bufferView": put(idx), "componentType": 5125, "count": int(len(idx)), "type": "SCALAR"})
            newp["indices"] = len(out["accessors"]) - 1
    out["buffers"] = [{"byteLength": len(gbin)}]
    shift = [-(glo[0] + ghi[0]) / 2, -glo[1], -(glo[2] + ghi[2]) / 2]
    out["nodes"].append({"name": "crop", "translation": [float(v) for v in shift], "children": list(out["scenes"][0]["nodes"])})
    out["scenes"][0]["nodes"] = [len(out["nodes"]) - 1]
    return out, bytes(gbin)


def quat_y(deg):
    a = math.radians(deg) / 2
    return [0.0, math.sin(a), 0.0, math.cos(a)]


def load(part):
    js, b = read_glb(open(src_path(part), "rb").read())
    if part.get("crop"):
        js, b = crop(js, b, *part["crop"])
    return js, b


def fit_node(js, part, at):
    """A wrapper node that scales the part to its height in px and stands it bottom-centre at `at`."""
    lo, hi = bounds(js)
    if part["kind"] == "spec":
        s = np.array([1.0, 1.0, 1.0])
        c = np.array([0.0, 0.0, 0.0])
        c[1] = 0.0
        lo = np.array([0.0, 0.0, 0.0])
    else:
        k = part["h"] / max(hi[1] - lo[1], 1e-6)
        s = np.array([k * part.get("sx", 1.0), k, k * part.get("sz", 1.0)])
        c = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
    R = quat_mat(quat_y(part.get("yaw", 0)))
    t = np.array(at, float) - R @ (c * s)
    node = {"name": part["src"], "translation": [float(v) for v in t], "scale": [float(v) for v in s]}
    if part.get("yaw"):
        node["rotation"] = quat_y(part["yaw"])
    return node, (hi[1] - lo[1]) * s[1]


def shelf_levels(js, b):
    """Heights (source units) of the up-facing boards inside a bookshelf."""
    ys = []
    for n in js["nodes"]:
        if "mesh" not in n:
            continue
        M = node_matrix(n)
        for p in js["meshes"][n["mesh"]]["primitives"]:
            Pp = accessor_array(js, b, p["attributes"]["POSITION"])
            Pp = (np.c_[Pp, np.ones(len(Pp))] @ M.T)[:, :3]
            I = accessor_array(js, b, p["indices"]).reshape(-1, 3)
            T = Pp[I]
            nrm = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
            area = np.linalg.norm(nrm, axis=1) / 2
            up = (nrm[:, 1] / np.maximum(np.linalg.norm(nrm, axis=1), 1e-12)) > 0.95
            ys += [(float(T[i, :, 1].mean()), float(area[i])) for i in np.where(up)[0]]
    ys.sort()
    levels = []
    for y, a in ys:
        if levels and abs(levels[-1][0] - y) < 0.02:
            levels[-1][1] += a
        else:
            levels.append([y, a])
    tot = sum(a for _, a in levels)
    return [y for y, a in levels if a > tot * 0.04]


def build_item(item_id):
    parts = RECIPES[item_id]
    base = parts[0]
    js0, b0 = load(base)
    if base["kind"] == "gg":
        comp = Composer(js0, b0)
        node, top = fit_node(js0, base, [0, 0, 0])
        roots = comp.js["scenes"][comp.js.get("scene", 0)]["nodes"]
        comp.js["nodes"].append(dict(node, children=roots))
        top_nodes = [len(comp.js["nodes"]) - 1]
        for ii in range(len(comp.js.get("images", []))):
            comp.kinds[ii] = ("gg", base.get("grade", {}), base)
    else:
        comp = Composer({"asset": {"version": "2.0"}, "scene": 0, "scenes": [{"nodes": []}], "nodes": [], "buffers": [{"byteLength": 0}],
                         "bufferViews": [], "accessors": []}, b"")
        node, top = fit_node(js0, base, [0, 0, 0])
        top_nodes = [comp.append(js0, b0, node, base["kind"], base)]
    for part in parts[1:]:
        if part == "BOOKS":
            top_nodes += books_on_shelves(comp, js0, b0, base)
            continue
        js, b = load(part)
        at = list(part.get("at", [0, 0, 0]))
        if at[1] == "TOP":
            at[1] = top
        elif at[1] == "SOIL":
            at[1] = top * 0.84
        node, _ = fit_node(js, part, at)
        if part["kind"] == "spec":
            node["scale"] = [1.0, 1.0, 1.0]
        top_nodes.append(comp.append(js, b, node, part["kind"], part))
    comp.js["scenes"][comp.js.get("scene", 0)]["nodes"] = top_nodes
    # restyle every image once
    J = comp.js
    done = {}
    for ii, im in enumerate(J.get("images", [])):
        kind, part = comp.kinds.get(ii, ("spec", {}))[0], comp.kinds.get(ii, ("spec", {}))[-1]
        bvi = im["bufferView"]
        if bvi in done:
            continue
        raw = view_bytes(J, bytes(comp.bin), bvi)
        if kind == "spec":
            from build import indexed_png
            comp.views[bvi] = indexed_png(raw)
        elif kind == "gg":
            comp.views[bvi] = restyle(raw, part.get("grade", {}), colours=part.get("colours", 48), out_mime="image/webp", seed=ii)
            im["mimeType"] = "image/webp"
        else:
            down = part.get("down", 0.5 if kind == "ph" else 1.0)
            comp.views[bvi] = restyle(raw, part.get("grade", {}), colours=part.get("colours", 48), down=down, seed=ii)
            im["mimeType"] = "image/png"
        done[bvi] = True
    # materials: lit, matte; nearest magnification, mipmapped minification (BUSHED's sampler)
    for m in J.get("materials", []):
        for k in ("normalTexture", "occlusionTexture", "emissiveTexture"):
            m.pop(k, None)
        m.pop("emissiveFactor", None)
        m.setdefault("pbrMetallicRoughness", {}).pop("metallicRoughnessTexture", None)
    for s in J.get("samplers", []):
        s["magFilter"], s["minFilter"] = 9728, 9987
    for n in J["nodes"]:
        n.pop("extras", None) if not str(n.get("name", "")).startswith("glow") else None
    js, binary = comp.finish()
    js, binary = quantise_meshes(js, binary)
    dst = os.path.join(ROOT, "public", "models", "items", f"{item_id}.glb")
    size = finish_glb(js, binary, dst, item_id, root_scale=True)
    lo, hi = bounds(js)
    print(json.dumps({"id": item_id, "kb": round(size / 1024), "bounds_px": [round(float(v) * 16, 1) for v in (lo[0], hi[0], lo[1], hi[1], lo[2], hi[2])]}), flush=True)


def quantise_meshes(js, binary):
    """KHR_mesh_quantization for plain float meshes: positions -> normalised int16 (the mesh moves into a child node
    that scales it back), normals -> normalised int8. About 40% less geometry; meshopt meshes are left alone."""
    views = [binary[v.get("byteOffset", 0): v.get("byteOffset", 0) + v["byteLength"]] for v in js["bufferViews"]]
    meshopt = {i for i, v in enumerate(js["bufferViews"]) if (v.get("extensions") or {}).get("EXT_meshopt_compression")}
    newviews = {}
    done_mesh = {}
    changed = False
    for ni in range(len(js["nodes"])):
        n = js["nodes"][ni]
        if "mesh" not in n:
            continue
        mi = n["mesh"]
        prims = js["meshes"][mi]["primitives"]
        accs = [js["accessors"][p["attributes"]["POSITION"]] for p in prims]
        if any(a["componentType"] != 5126 or a["bufferView"] in meshopt for a in accs):
            continue
        if mi not in done_mesh:
            lo = np.min([a["min"] for a in accs], 0)
            hi = np.max([a["max"] for a in accs], 0)
            c, half = (lo + hi) / 2, np.maximum((hi - lo) / 2, 1e-6)
            for p in prims:
                for key, comp_t, stride in (("POSITION", 5122, 8), ("NORMAL", 5120, 4)):
                    ai = p["attributes"].get(key)
                    if ai is None or js["accessors"][ai]["componentType"] != 5126:
                        continue
                    arr = accessor_array(js, binary, ai).astype(np.float64)
                    if key == "POSITION":
                        q = np.round((arr - c) / half * 32767).clip(-32767, 32767).astype(np.int16)
                        buf = np.zeros((len(q), 4), np.int16)
                        buf[:, :3] = q
                    else:
                        q = np.round(arr * 127).clip(-127, 127).astype(np.int8)
                        buf = np.zeros((len(q), 4), np.int8)
                        buf[:, :3] = q
                    vi = len(js["bufferViews"]) + len(newviews)
                    newviews[vi] = buf.tobytes()
                    a = js["accessors"][ai]
                    a.update(bufferView=vi, componentType=comp_t, normalized=True, byteOffset=0)
                    if key == "POSITION":
                        a["min"], a["max"] = [-32767] * 3, [32767] * 3
                        a["min"] = q.min(0).astype(int).tolist()
                        a["max"] = q.max(0).astype(int).tolist()
                    js_stride = stride
                    newviews[vi] = (newviews[vi], js_stride)
            done_mesh[mi] = (c, half)
            changed = True
        c, half = done_mesh[mi]
        # move the mesh into a child that maps the normalised range back to the original units
        js["nodes"].append({"name": n.get("name", "mesh") + "_q", "mesh": mi, "translation": c.tolist(), "scale": half.tolist()})
        del n["mesh"]
        n.setdefault("children", []).append(len(js["nodes"]) - 1)
    if not changed:
        return js, binary
    for vi in sorted(newviews):
        data, stride = newviews[vi]
        js["bufferViews"].append({"buffer": 0, "byteOffset": 0, "byteLength": len(data), "byteStride": stride, "target": 34962})
        views.append(data)
    # drop views no accessor/image/meshopt stream uses any more, then repack
    used = {a["bufferView"] for a in js["accessors"]} | {im["bufferView"] for im in js.get("images", [])} | meshopt
    keep = [i for i in range(len(js["bufferViews"])) if i in used]
    remap = {o: k for k, o in enumerate(keep)}
    out = bytearray()
    bvs = []
    for i in keep:
        bv = dict(js["bufferViews"][i])
        ext = (bv.get("extensions") or {}).get("EXT_meshopt_compression")
        while len(out) % 4:
            out.append(0)
        if ext is not None:
            src = binary[ext.get("byteOffset", 0): ext.get("byteOffset", 0) + ext["byteLength"]]
            ext["byteOffset"] = len(out)
            out.extend(src)
        else:
            bv["byteOffset"] = len(out)
            out.extend(views[i])
            bv["byteLength"] = len(views[i])
        bvs.append(bv)
    js["bufferViews"] = bvs
    for a in js["accessors"]:
        a["bufferView"] = remap[a["bufferView"]]
    for im in js.get("images", []):
        im["bufferView"] = remap[im["bufferView"]]
    while len(out) % 4:
        out.append(0)
    js["buffers"][0]["byteLength"] = len(out)
    ext = set(js.get("extensionsUsed", [])) | {"KHR_mesh_quantization"}
    js["extensionsUsed"] = sorted(ext)
    js["extensionsRequired"] = sorted(set(js.get("extensionsRequired", [])) | {"KHR_mesh_quantization"})
    return js, bytes(out)


def books_on_shelves(comp, js0, b0, base):
    """Fill a borrowed bookshelf: rows of the encyclopedia set (Poly Haven, pixelised) on every inner board."""
    lo, hi = bounds(js0)
    k = base["h"] / (hi[1] - lo[1])
    lv = [y for y in shelf_levels(js0, b0) if lo[1] + 0.02 < y < hi[1] - 0.15]
    bk = dict(kind="ph", src="book_encyclopedia_set_01", down=1.0, grade=dict(sat=0.7))
    js, b = load(bk)
    blo, bhi = bounds(js)
    inner = (hi[0] - lo[0]) * k * 0.8
    keep = []
    for y in lv:                       # boards closer than 1.5 px are one board (top and bottom faces)
        if keep and (y - keep[-1]) * k < 1.5:
            keep[-1] = y
        else:
            keep.append(y)
    lv = keep
    gaps = [lv[i + 1] - lv[i] for i in range(len(lv) - 1)] + [hi[1] - lv[-1]]
    nodes = []
    first = None
    for r, (y, gap) in enumerate(zip(lv, gaps)):
        h = min(gap * k * 0.78, 4.2)
        if h < 1.5:
            continue
        sc = h / (bhi[1] - blo[1])
        w = (bhi[0] - blo[0]) * sc
        n = max(1, int(inner // w))
        for j in range(n):
            x = (j - (n - 1) / 2) * w * 1.02
            part = dict(bk, h=h, yaw=0 if (r + j) % 2 == 0 else 180)
            node, _ = fit_node(js, part, [x, (y - lo[1]) * k, 0.3])
            if first is None:     # the book row's geometry and atlas go in once; the other rows are instances
                first = comp.append(js, b, node, "ph", part)
                nodes.append(first)
            else:
                J = comp.js
                kids = []
                for c in J["nodes"][first]["children"]:
                    J["nodes"].append({kk: vv for kk, vv in J["nodes"][c].items()})
                    kids.append(len(J["nodes"]) - 1)
                J["nodes"].append(dict(node, children=kids))
                nodes.append(len(J["nodes"]) - 1)
    print(f"  {base['src']}: {len(nodes)} book rows on shelves at {[round((y - lo[1]) * k, 1) for y in lv]} px")
    return nodes


# ------------------------------------------------------------------------------------------------ credits
def credits():
    gg = json.load(open(GG_MANIFEST))
    rows = []
    users = {}
    for item, parts in RECIPES.items():
        for p in parts:
            if p == "BOOKS":
                p = dict(kind="ph", src="book_encyclopedia_set_01")
            if p["kind"] == "spec":
                continue
            users.setdefault((p["kind"], p["src"]), set()).add(item)
    for (kind, src), items in sorted(users.items()):
        it = ", ".join(f"`{i}`" for i in sorted(items))
        if kind == "gg":
            e = gg[src]
            rows.append(f"| {it} | Gacha Garage `public/models/lowpix/world/{src}.glb` ← [{e['title']}]({e['url']}) | {e['author']} | {e['license']} |")
        elif kind == "bushed":
            t, a = PH[src]
            rows.append(f"| {it} | BUSHED `public/assets/models/{src}.glb` ← [{t}](https://polyhaven.com/a/{src}) | {a} | CC0 1.0 |")
        else:
            t, a = PH[src]
            rows.append(f"| {it} | [{t}](https://polyhaven.com/a/{src}) (converted here) | {a} | CC0 1.0 |")
    lines = ["# furnA credits", "",
             "Furniture models in `public/models/items/` for furnA's ids (`src/assets/home.ts` and the indoor pieces of",
             "`src/assets/furniture.ts`).", "",
             "## Borrowed models", "",
             "Taken from the owner's games BUSHED and Gacha Garage (which keep their own upstream credits, repeated here) or",
             "converted from Poly Haven with lowpix, then restyled for Hoot Hollow by `art/lowpix/items/_furnA/borrow.py`:",
             "calm re-grade, k-means pixel palette (BUSHED's `tools/forest/pix.py`, copied as `_furnA/pix.py`), lit matte",
             "material, fitted to the item's size and composed with other parts.", "",
             "| Item(s) | Source | Author(s) | Licence |", "|---|---|---|---|"] + rows + [
             "", "Sketchfab models are CC BY 4.0: credit the author as listed when the game is shared.", "",
             "## Real artworks on the walls (public domain, Art Institute of Chicago)", "",
             "Pixel-graded (calm grade, k-means palette) onto the canvas card of the item; source copies (<= 256 px) in",
             "`art/lowpix/items/_furnA/art/`. Image data via the Art Institute of Chicago API (CC0 metadata, public-domain images).", "",
             "| Item | Artwork | Artist | Date | Source |", "|---|---|---|---|---|",
             "| `painting` | Nocturne: Blue and Gold—Southampton Water | James McNeill Whistler (American, 1834–1903) | 1872 | [artic.edu/artworks/56905](https://www.artic.edu/artworks/56905) |",
             "| `starmap` | Celestial Map of the Northern Sky with the Twelve Zodiac Signs | Albrecht Dürer | 1515 | [artic.edu/artworks/106550](https://www.artic.edu/artworks/106550) |",
             "",
             "## 2D pixel-art leaves (borrowed from BUSHED)", "",
             "The foliage of furnA's plants is made of 2D pixel-art leaf cards cut from BUSHED's vegetation atlas",
             "(`public/assets/textures/veg/veg_atlas.png`, crops in `art/lowpix/items/_furnA/leaves/`), which BUSHED made from",
             "Poly Haven CC0 sources: sword fern fronds and bracken from [Fern 02](https://polyhaven.com/a/fern_02) (Rob Tuytel,",
             "Rico Cilliers); juniper sprigs from [Fir Tree 01](https://polyhaven.com/a/fir_tree_01) twig maps (Rob Tuytel, Rico",
             "Cilliers); grass blades procedural (BUSHED). Used in `fernpot`, `bonsai`, `nestbed`, `mushpot`, `mushroomlamp` and",
             "the flowers of `planter`.", "",
             "## Made for Hoot Hollow (lowpix specs, CC0)", "",
             "Every other furnA item (`art/lowpix/items/<id>.json`, generated by `art/lowpix/items/_furnA/items_*.py`) was",
             "modelled and hand-painted from scratch with lowpix, as were the parts merged into borrowed items (candle",
             "flames, the planter's flowers). Photo detail in their textures comes from CC0 Poly Haven textures",
             "(`art/lowpix/items/_furnA/photos/`: oak_veneer_01, wood_table_001, rough_linen, hessian_230, velour_velvet,",
             "knitted_fleece, brown_leather, clay_floor_001, metal_plate_02, jersey_melange, bark_brown_02, rock_face_03,",
             "forest_leaves_02).", ""]
    path = os.path.join(ROOT, "docs", "credits", "furnA.md")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").write("\n".join(lines))


def main():
    os.chdir(ROOT)
    ids = sys.argv[1:] or list(RECIPES)
    for i in ids:
        try:
            build_item(i)
        except Exception as e:  # keep going; report
            import traceback
            traceback.print_exc()
            print(json.dumps({"id": i, "error": str(e)[:300]}), flush=True)
    credits()


if __name__ == "__main__":
    main()
