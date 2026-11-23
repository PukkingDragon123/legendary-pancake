"""Borrowed furniture: Poly Haven (CC0) models converted by lowpix (painted style), restyled to Hoot Hollow and
composed into game items.

    cd <repo>; ~/.cache/lowpix-venv/bin/python art/lowpix/items/_furnA/borrow.py [ids...]

Run convert_all.sh first (it converts the sources into $FURNA_CONV). For each item in RECIPES this script:
1. loads the converted parts (px units, origin bottom-centre, facing +Z), optionally crops one plant out of a set,
   scales them to the item's size and places them (several parts make one item: a table with its tea set);
2. merges them into one GLB (and any lowpix-made extras, e.g. the planter's flowers);
3. restyles every borrowed atlas: calmer chroma, slate-tinted shadows, lamp-warm highlights, a faint paper grain
   (the "matte, handmade" finish), encoded as WebP (EXT_texture_webp) to stay well under 400 KB;
4. post-processes like build.py (lit material, unlit twins for parts named glow*, root node scaled 1/16).
Credits go to docs/credits/furnA.md.
"""
from __future__ import annotations

import glob
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
from build import read_glb, write_glb, indexed_png, finish_glb  # noqa: E402

CONV = os.environ.get("FURNA_CONV", "/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad/agents/furnA/conv")
OUT = os.environ.get("FURNA_OUT", "/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad/agents/furnA/out")

# Poly Haven credits (all CC0 1.0): asset id -> (title, authors)
PH = {
    "GreenChair_01": ("Green Chair 01", "Kirill Sannikov"),
    "painted_wooden_nightstand": ("Painted Wooden Nightstand", "Kirill Sannikov"),
    "wooden_bookshelf_worn": ("Wooden Bookshelf Worn", "Ulan Cabanilla"),
    "book_encyclopedia_set_01": ("Book Encyclopedia Set 01", "John Malcolm"),
    "painted_wooden_cabinet_02": ("Painted Wooden Cabinet 02", "Kirill Sannikov"),
    "round_wooden_table_01": ("Round Wooden Table 01", "Ulan Cabanilla"),
    "tea_set_01": ("Tea Set 01", "James Ray Cock, Rico Cilliers, Jurita Burger"),
    "chinese_tea_table": ("Chinese Tea Table", "Kirill Sannikov"),
    "painted_wooden_chair_02": ("Painted Wooden Chair 02", "Kirill Sannikov"),
    "wooden_table_02": ("Wooden Table 02", "Serhii Khromov"),
    "desk_lamp_arm_01": ("Desk Lamp Arm 01", "Yann Kervran, Kuutti Siitonen"),
    "standing_chalkboard_01": ("Standing Chalkboard 01", "ParzivalCG"),
    "treasure_chest": ("Treasure Chest", "Rico Cilliers"),
    "potted_plant_04": ("Potted Plant 04", "James Ray Cock"),
    "planter_box_01": ("Planter Box 01", "James Ray Cock"),
    "garden_gnome": ("Garden Gnome", "Bhargav Kubal"),
    "fern_02": ("Fern 02", "Rob Tuytel, Rico Cilliers"),
    "planter_pot_clay": ("Planter Pot Clay", "Amal Kumar"),
}

# item id -> parts. A part: src (Poly Haven id, converted) or spec (a lowpix extra built by build.py), and
#   h: height in px (uniform scale), sx/sz: extra x/z stretch, at: [x, y, z] of its bottom-centre, yaw (deg),
#   crop: [x0, x1] keep triangles whose centre lies in this x range (fraction of the source width, 0..1),
#   grade: per-part restyle tweaks (sat, tint=[hex, amount]), shelves: True to also report shelf levels.
RECIPES = {
    "armchair": [dict(src="GreenChair_01", h=17)],
    "nightstand": [dict(src="painted_wooden_nightstand", h=10)],
    "wardrobe": [dict(src="painted_wooden_cabinet_02", h=26)],
    "chair": [dict(src="painted_wooden_chair_02", h=16)],
    "chest": [dict(src="treasure_chest", h=9)],
    "cactus": [dict(src="potted_plant_04", h=14)],
    "gnome": [dict(src="garden_gnome", h=18, grade=dict(sat=0.72))],
    "easel": [dict(src="standing_chalkboard_01", h=20)],
    "bookshelf": [dict(src="wooden_bookshelf_worn", h=26), "BOOKS"],
    "teaset": [dict(src="round_wooden_table_01", h=9.2), dict(src="tea_set_01", h=3.4, at=[0, "TOP", 0], yaw=20)],
    "teatable": [dict(src="chinese_tea_table", h=8), dict(src="tea_set_01", h=3.0, at=[0, "TOP", 0], yaw=-35)],
    "desk": [dict(src="wooden_table_02", h=11, sx=1.45, sz=0.82),
             dict(src="desk_lamp_arm_01", h=7.5, at=[7.4, "TOP", -1.2], yaw=-130, grade=dict(sat=0.55, tint=["#86a06a", 0.25])),
             dict(src="book_encyclopedia_set_01", h=2.6, at=[-6.0, "TOP", -1.6], yaw=8)],
    "planter": [dict(src="planter_box_01", h=7.5, sx=1.1), dict(spec="planter_flowers", at=[0, "SOIL", 0])],
    "fernpot": [dict(src="planter_pot_clay", h=4.6), dict(src="fern_02", h=8.5, crop=[0.36, 0.64], at=[0, 3.6, 0])],
}
BORROWED = set(RECIPES)


# ------------------------------------------------------------------------------------------------ glb helpers
def glb_path(src):
    fs = [f for f in glob.glob(os.path.join(CONV, src, "*.glb"))]
    if not fs:
        raise FileNotFoundError(f"{src}: run convert_all.sh first")
    return fs[0]


def accessor_array(js, binary, ai):
    a = js["accessors"][ai]
    bv = js["bufferViews"][a["bufferView"]]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a["componentType"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    arr = np.frombuffer(binary, dt, a["count"] * n, off)
    return arr.reshape(a["count"], n) if n > 1 else arr


class Glb:
    """A tiny glTF builder: append accessors/views, merge other GLBs under transformed wrapper nodes."""

    def __init__(self):
        self.js = {"asset": {"version": "2.0", "generator": "lowpix + Hoot Hollow furnA"}, "scene": 0,
                   "scenes": [{"nodes": []}], "nodes": [], "meshes": [], "materials": [], "textures": [], "images": [],
                   "samplers": [], "accessors": [], "bufferViews": [], "buffers": [{"byteLength": 0}], "animations": []}
        self.bin = bytearray()
        self.image_kind = []     # per image: "borrowed" or "lowpix", plus grade options

    def view(self, data):
        while len(self.bin) % 4:
            self.bin += b"\x00"
        self.js["bufferViews"].append({"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(data)})
        self.bin += data
        return len(self.js["bufferViews"]) - 1

    def add(self, js, binary, node, kind, grade=None):
        """Merge a whole GLB; its scene roots go under `node` (a dict with name/translation/rotation/scale)."""
        J = self.js
        o = {k: len(J[k]) for k in ("nodes", "meshes", "materials", "textures", "images", "samplers", "accessors", "bufferViews")}
        for bv in js["bufferViews"]:
            s = bv.get("byteOffset", 0)
            nb = self.view(bytes(binary[s:s + bv["byteLength"]]))
            if "byteStride" in bv:
                J["bufferViews"][nb]["byteStride"] = bv["byteStride"]
        for a in js["accessors"]:
            a = dict(a)
            a["bufferView"] += o["bufferViews"]
            J["accessors"].append(a)
        for im in js.get("images", []):
            im = dict(im)
            im["bufferView"] += o["bufferViews"]
            J["images"].append(im)
            self.image_kind.append((kind, grade or {}))
        J["samplers"] += [dict(s) for s in js.get("samplers", [])]
        for t in js.get("textures", []):
            t = json.loads(json.dumps(t))
            if "sampler" in t:
                t["sampler"] += o["samplers"]
            if "source" in t:
                t["source"] += o["images"]
            J["textures"].append(t)
        for m in js.get("materials", []):
            m = json.loads(json.dumps(m))
            bct = m.get("pbrMetallicRoughness", {}).get("baseColorTexture")
            if bct:
                bct["index"] += o["textures"]
            J["materials"].append(m)
        for me in js.get("meshes", []):
            me = json.loads(json.dumps(me))
            for p in me["primitives"]:
                p["attributes"] = {k: v + o["accessors"] for k, v in p["attributes"].items()}
                if "indices" in p:
                    p["indices"] += o["accessors"]
                if "material" in p:
                    p["material"] += o["materials"]
            J["meshes"].append(me)
        for n in js["nodes"]:
            n = json.loads(json.dumps(n))
            if "mesh" in n:
                n["mesh"] += o["meshes"]
            if "children" in n:
                n["children"] = [c + o["nodes"] for c in n["children"]]
            J["nodes"].append(n)
        for an in js.get("animations", []):
            an = json.loads(json.dumps(an))
            for s in an["samplers"]:
                s["input"] += o["accessors"]
                s["output"] += o["accessors"]
            for c in an["channels"]:
                c["target"]["node"] += o["nodes"]
            J["animations"].append(an)
        node = dict(node)
        node["children"] = [r + o["nodes"] for r in js["scenes"][js.get("scene", 0)]["nodes"]]
        J["nodes"].append(node)
        J["scenes"][0]["nodes"].append(len(J["nodes"]) - 1)

    def finish(self):
        if not self.js["animations"]:
            del self.js["animations"]
        anims = self.js.get("animations")
        if anims:   # one 'idle' clip: merge clips of the same name from different parts
            byname = {}
            for a in anims:
                if a["name"] in byname:
                    b = byname[a["name"]]
                    k = len(b["samplers"])
                    b["samplers"] += a["samplers"]
                    for c in a["channels"]:
                        c["sampler"] += k
                        b["channels"].append(c)
                else:
                    byname[a["name"]] = a
            self.js["animations"] = list(byname.values())
        self.js["buffers"][0]["byteLength"] = len(self.bin)
        return self.js, bytes(self.bin)


def bounds(js, binary):
    """World-space bounds of a GLB (node TRS honoured for translation/scale/rotation-free trees: lowpix output)."""
    lo, hi = np.full(3, np.inf), np.full(3, -np.inf)
    for n in js["nodes"]:
        if "mesh" not in n:
            continue
        for p in js["meshes"][n["mesh"]]["primitives"]:
            P = accessor_array(js, binary, p["attributes"]["POSITION"]) + np.array(n.get("translation", [0, 0, 0]))
            lo, hi = np.minimum(lo, P.min(0)), np.maximum(hi, P.max(0))
    return lo, hi


def crop(js, binary, x0f, x1f):
    """Keep the triangles whose centre lies in [x0f, x1f] of the model's width; compact the vertices; return a new
    (js, binary) standing on y = 0 and centred on x = z = 0."""
    lo, hi = bounds(js, binary)
    x0, x1 = lo[0] + (hi[0] - lo[0]) * x0f, lo[0] + (hi[0] - lo[0]) * x1f
    g = Glb()
    out_js = json.loads(json.dumps(js))
    gbin = bytearray(binary)
    for mi, me in enumerate(js["meshes"]):
        for pi, p in enumerate(me["primitives"]):
            P = accessor_array(js, binary, p["attributes"]["POSITION"])
            I = accessor_array(js, binary, p["indices"]).reshape(-1, 3)
            cx = P[I].mean(axis=1)[:, 0]
            keep = I[(cx >= x0) & (cx <= x1)]
            used = np.unique(keep)
            remap = np.full(len(P), -1, np.int64)
            remap[used] = np.arange(len(used))
            newp = out_js["meshes"][mi]["primitives"][pi]
            for k, ai in p["attributes"].items():
                arr = accessor_array(js, binary, ai)[used].astype(np.float32)
                a = dict(js["accessors"][ai])
                while len(gbin) % 4:
                    gbin += b"\x00"
                out_js["bufferViews"].append({"buffer": 0, "byteOffset": len(gbin), "byteLength": arr.nbytes})
                gbin += arr.tobytes()
                a.update(bufferView=len(out_js["bufferViews"]) - 1, count=int(len(used)), byteOffset=0)
                if k == "POSITION":
                    a["min"], a["max"] = arr.min(0).tolist(), arr.max(0).tolist()
                out_js["accessors"].append(a)
                newp["attributes"][k] = len(out_js["accessors"]) - 1
            idx = remap[keep].reshape(-1).astype(np.uint32)
            while len(gbin) % 4:
                gbin += b"\x00"
            out_js["bufferViews"].append({"buffer": 0, "byteOffset": len(gbin), "byteLength": idx.nbytes})
            gbin += idx.tobytes()
            out_js["accessors"].append({"bufferView": len(out_js["bufferViews"]) - 1, "componentType": 5125, "count": int(len(idx)), "type": "SCALAR"})
            newp["indices"] = len(out_js["accessors"]) - 1
    out_js["buffers"][0]["byteLength"] = len(gbin)
    lo2, hi2 = bounds(out_js, bytes(gbin))
    shift = [-(lo2[0] + hi2[0]) / 2, -lo2[1], -(lo2[2] + hi2[2]) / 2]
    root = {"name": "crop", "translation": shift, "children": list(out_js["scenes"][0]["nodes"])}
    out_js["nodes"].append(root)
    out_js["scenes"][0]["nodes"] = [len(out_js["nodes"]) - 1]
    return out_js, bytes(gbin), (hi2 - lo2)


def quat_y(deg):
    a = math.radians(deg) / 2
    return [0.0, math.sin(a), 0.0, math.cos(a)]


# ------------------------------------------------------------------------------------------------ restyle
SLATE = np.array([0x46, 0x59, 0x6a]) / 255
LAMP = np.array([0xf1, 0xd3, 0x9a]) / 255


def grade(png_bytes, sat=0.82, tint=None, seed=0):
    """Hoot Hollow finish: calmer chroma, shadows leaning slate, highlights leaning lamp-warm, a faint clustered
    paper grain so flat areas feel hand-painted; WebP-encoded with its alpha mask."""
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    a = np.asarray(im).astype(np.float32) / 255
    rgb, al = a[..., :3], a[..., 3:]
    L = (rgb @ np.array([0.299, 0.587, 0.114]))[..., None]
    rgb = L + (rgb - L) * sat
    if tint:
        t = np.array([int(tint[0][i:i + 2], 16) for i in (1, 3, 5)]) / 255
        tl = t @ np.array([0.299, 0.587, 0.114])
        rgb = rgb * (1 - tint[1]) + (t * (L / max(tl, 1e-3))) * tint[1]
    sh = np.clip(1 - L / 0.38, 0, 1) * 0.16
    hl = np.clip((L - 0.62) / 0.38, 0, 1) * 0.10
    rgb = rgb * (1 - sh) + SLATE * sh * 0.9 + rgb * sh * 0.1
    rgb = rgb * (1 - hl) + LAMP * hl
    H, W = L.shape[:2]
    rng = np.random.default_rng(seed)
    g = rng.random((H // 2 + 1, W // 2 + 1)).repeat(2, 0).repeat(2, 1)[:H, :W, None]
    rgb = rgb * (0.985 + 0.03 * g)
    out = np.concatenate([np.clip(rgb, 0, 1), al], -1)
    img = Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA")
    if img.width > 1024:
        img = img.resize((1024, 1024 * img.height // img.width), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=84, method=6)
    return buf.getvalue()


# ------------------------------------------------------------------------------------------------ items
def load_part(part):
    if "spec" in part:
        p = os.path.join(OUT, part["spec"], f"{part['spec']}.glb")
        js, b = read_glb(open(p, "rb").read())
        return js, b, "lowpix", (np.zeros(3), np.zeros(3))
    js, b = read_glb(open(glb_path(part["src"]), "rb").read())
    size = None
    if part.get("crop"):
        js, b, size = crop(js, b, *part["crop"])
    return js, b, "borrowed", bounds(js, b) if size is None else (np.zeros(3), size)


def shelf_levels(js, b):
    """Heights of the up-facing boards inside a bookshelf (clusters of up-facing triangles)."""
    ys = []
    for me in js["meshes"]:
        for p in me["primitives"]:
            P = accessor_array(js, b, p["attributes"]["POSITION"])
            I = accessor_array(js, b, p["indices"]).reshape(-1, 3)
            T = P[I]
            n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
            area = np.linalg.norm(n, axis=1) / 2
            up = (n[:, 1] / np.maximum(np.linalg.norm(n, axis=1), 1e-9)) > 0.95
            ys += [(float(T[i, :, 1].mean()), float(area[i])) for i in np.where(up)[0]]
    ys.sort()
    levels = []
    for y, a in ys:
        if levels and abs(levels[-1][0] - y) < 0.5:
            levels[-1][1] += a
        else:
            levels.append([y, a])
    return [round(y, 2) for y, a in levels if a > 6]


def build_item(item_id):
    recipe = RECIPES[item_id]
    g = Glb()
    tops = {}
    base = None
    for k, part in enumerate(recipe):
        if part == "BOOKS":
            js0, b0 = base
            lv = shelf_levels(js0, b0)
            lo, hi = bounds(js0, b0)
            js, b, kind, (blo, bhi) = load_part(dict(src="book_encyclopedia_set_01"))
            bw = bhi[0] - blo[0]
            inner = (hi[0] - lo[0]) * 0.78
            rows = [y for y in lv if 1.0 < y < hi[1] - 2.0]
            for r, y in enumerate(rows):
                n = 2
                for j in range(n):
                    s = min(1.0, inner / n / bw * 0.96)
                    x = (j - (n - 1) / 2) * inner / n
                    yaw = 0 if (r + j) % 2 == 0 else 180
                    g.add(js, b, {"name": f"books{r}_{j}", "translation": [x, y, 0.2], "rotation": quat_y(yaw), "scale": [s, 1.0, 1.0]},
                          "borrowed", {})
            print(f"  {item_id}: shelves at {rows}")
            continue
        js, b, kind, (lo, hi) = load_part(part)
        h = part.get("h")
        s = 1.0 if not h or kind == "lowpix" else h / max(hi[1] - lo[1], 1e-6)
        sc = [s * part.get("sx", 1.0), s, s * part.get("sz", 1.0)]
        at = list(part.get("at", [0, 0, 0]))
        if at[1] == "TOP":
            at[1] = tops["top"]
        if at[1] == "SOIL":
            at[1] = tops["top"] * 0.86
        node = {"name": part.get("src", part.get("spec")), "translation": [float(v) for v in at], "scale": sc}
        if part.get("yaw"):
            node["rotation"] = quat_y(part["yaw"])
        g.add(js, b, node, kind, part.get("grade"))
        if k == 0:
            tops["top"] = (hi[1] - lo[1]) * s
            base = (js, b)
    js, binary = g.finish()
    # restyle the atlases
    views = js["bufferViews"]
    chunks = [binary[v["byteOffset"]:v["byteOffset"] + v["byteLength"]] for v in views]
    webp = False
    for ii, img in enumerate(js["images"]):
        kind, gr = g.image_kind[ii]
        if kind == "borrowed":
            chunks[img["bufferView"]] = grade(chunks[img["bufferView"]], seed=ii, **gr)
            img["mimeType"] = "image/webp"
            webp = True
        else:
            chunks[img["bufferView"]] = indexed_png(chunks[img["bufferView"]])
            img["mimeType"] = "image/png"
    # share identical images (the same source used twice) to save space
    seen = {}
    for img in js["images"]:
        key = chunks[img["bufferView"]]
        if key in seen:
            img["bufferView"] = seen[key]
        else:
            seen[key] = img["bufferView"]
    if webp:
        for t in js["textures"]:
            src = t.pop("source")
            if js["images"][src]["mimeType"] == "image/webp":
                t["extensions"] = {"EXT_texture_webp": {"source": src}}
            else:
                t["source"] = src
    out, off = [], 0
    for v, c in zip(views, chunks):
        pad = (-off) % 4
        out.append(b"\x00" * pad)
        off += pad
        v["byteOffset"] = off
        v["byteLength"] = len(c)
        out.append(c)
        off += len(c)
    binary = b"".join(out)
    js["buffers"][0]["byteLength"] = len(binary)
    # drop views nobody uses any more (duplicate images)
    js, binary = prune_views(js, binary)
    if webp:
        js["extensionsUsed"] = sorted(set(js.get("extensionsUsed", [])) | {"EXT_texture_webp"})
        js["extensionsRequired"] = ["EXT_texture_webp"]
    dst = os.path.join(ROOT, "public", "models", "items", f"{item_id}.glb")
    size = finish_glb(js, binary, dst, item_id, root_scale=True)
    lo, hi = glb_bounds_px(dst)
    print(json.dumps({"id": item_id, "kb": round(size / 1024), "bounds_px": [np.round(lo, 1).tolist(), np.round(hi, 1).tolist()],
                      "tris": count_tris(js)}))


def prune_views(js, binary):
    used = set()
    for a in js["accessors"]:
        used.add(a["bufferView"])
    for im in js.get("images", []):
        used.add(im["bufferView"])
    keep = [i for i in range(len(js["bufferViews"])) if i in used]
    remap = {o: n for n, o in enumerate(keep)}
    views, out, off = [], [], 0
    for i in keep:
        v = dict(js["bufferViews"][i])
        c = binary[v["byteOffset"]:v["byteOffset"] + v["byteLength"]]
        pad = (-off) % 4
        out.append(b"\x00" * pad)
        off += pad
        v["byteOffset"] = off
        out.append(c)
        off += len(c)
        views.append(v)
    js["bufferViews"] = views
    for a in js["accessors"]:
        a["bufferView"] = remap[a["bufferView"]]
    for im in js.get("images", []):
        im["bufferView"] = remap[im["bufferView"]]
    binary = b"".join(out)
    js["buffers"][0]["byteLength"] = len(binary)
    return js, binary


def count_tris(js):
    return sum(js["accessors"][p["indices"]]["count"] // 3 for m in js["meshes"] for p in m["primitives"])


def glb_bounds_px(path):
    """Bounds in px of a finished GLB (walks the node tree with translation + scale + y-rotation)."""
    js, b = read_glb(open(path, "rb").read())
    lo, hi = np.full(3, np.inf), np.full(3, -np.inf)

    def mat(n):
        M = np.eye(4)
        s = np.array(n.get("scale", [1, 1, 1]))
        q = n.get("rotation", [0, 0, 0, 1])
        x, y, z, w = q
        R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                      [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                      [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
        M[:3, :3] = R * s
        M[:3, 3] = n.get("translation", [0, 0, 0])
        return M

    def walk(i, M):
        nonlocal lo, hi
        n = js["nodes"][i]
        M = M @ mat(n)
        if "mesh" in n:
            for p in js["meshes"][n["mesh"]]["primitives"]:
                P = accessor_array(js, b, p["attributes"]["POSITION"])
                W = (np.c_[P, np.ones(len(P))] @ M.T)[:, :3]
                lo, hi = np.minimum(lo, W.min(0)), np.maximum(hi, W.max(0))
        for c in n.get("children", []):
            walk(c, M)
    for r in js["scenes"][0]["nodes"]:
        walk(r, np.eye(4))
    return lo * 16, hi * 16


def credits():
    lines = ["# furnA credits", "",
             "Furniture models in `public/models/items/` made or restyled by the furnA builder.", "",
             "## Borrowed from Poly Haven (CC0 1.0, public domain)", "",
             "Converted with lowpix (`painted` style: decimated, re-unwrapped, re-painted atlas), then restyled for Hoot Hollow",
             "(calmer colour, slate shadows, warm highlights, paper grain) and composed into items by",
             "`art/lowpix/items/_furnA/borrow.py`. Thank you, Poly Haven and its artists.", "",
             "| Item(s) | Source | Author(s) | Licence |", "|---|---|---|---|"]
    users = {}
    for item, parts in RECIPES.items():
        for p in parts:
            src = "book_encyclopedia_set_01" if p == "BOOKS" else p.get("src") if isinstance(p, dict) else None
            if src:
                users.setdefault(src, []).append(item)
    for src, items in users.items():
        title, authors = PH[src]
        lines.append(f"| {', '.join(f'`{i}`' for i in sorted(set(items)))} | [{title}](https://polyhaven.com/a/{src}) | {authors} | CC0 1.0 |")
    lines += ["", "## Made for Hoot Hollow (lowpix specs, CC0)", "",
              "Every other item model in `public/models/items/` from `art/lowpix/items/<id>.json` (furnA's ids) was modelled",
              "and hand-painted from scratch with lowpix (`art/lowpix/items/_furnA/items_*.py`). Photo detail in their",
              "textures comes from these CC0 Poly Haven textures (`art/lowpix/items/_furnA/photos/`): oak_veneer_01,",
              "wood_table_001, rough_linen, hessian_230, velour_velvet, knitted_fleece, brown_leather, clay_floor_001,",
              "metal_plate_02, jersey_melange, bark_brown_02, rock_face_03, forest_leaves_02.", ""]
    path = os.path.join(ROOT, "docs", "credits", "furnA.md")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").write("\n".join(lines))


def main():
    os.chdir(ROOT)
    ids = sys.argv[1:] or list(RECIPES)
    for i in ids:
        try:
            build_item(i)
        except FileNotFoundError as e:
            print(json.dumps({"id": i, "missing": str(e)}))
    credits()


if __name__ == "__main__":
    main()
