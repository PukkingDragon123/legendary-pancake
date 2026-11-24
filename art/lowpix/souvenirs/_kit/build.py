"""Build the souvenir specs into game models (adapted from the furniture builders' build.py).

    cd <repo>; ~/.cache/lowpix-venv/bin/python art/lowpix/souvenirs/_kit/build.py [ids...] [--out DIR] [--jobs N] [--specs-only]

1. Runs every item function in souvenirs*.py and writes art/lowpix/souvenirs/<id>.json.
2. Builds each spec with lowpix (GLB, sheet, hero) into --out (default: $SOUV_OUT or /tmp/souvenirs).
3. Renders a small pixel portrait with a clear background: public/models/souvenirs/<id>.png (the globe's postcard).
4. Post-processes the GLB for the game and writes public/models/souvenirs/<id>.glb:
   * a root node named <id>, scaled 1/16, so the model is in world units (16 px = 1 block) like the box props;
   * lit material (the house lights it) except parts whose id starts with "glow" (flames, lamp shades), which get
     an unlit copy of the material so they keep glowing at night;
   * the atlas re-encoded as an indexed PNG (the atlas is a strict limited palette, so this is lossless).
"""
from __future__ import annotations

import argparse
import importlib
import io
import json
import os
import struct
import sys
import time
from concurrent.futures import ProcessPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
sys.path.insert(0, HERE)
import kit  # noqa: E402

MODULES = ["souvenirs_a", "souvenirs_b", "souvenirs_c"]


def all_items():
    out = {}
    for m in MODULES:
        try:
            mod = importlib.import_module(m)
        except ModuleNotFoundError:
            continue
        for k, fn in mod.ITEMS.items():
            out[k] = fn
    return out


# ------------------------------------------------------------------------------------------------ GLB post-process
def read_glb(b):
    magic, ver, total = struct.unpack("<III", b[:12])
    jl, jt = struct.unpack("<II", b[12:20])
    js = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl, bt = struct.unpack("<II", b[off:off + 8])
    binary = b[off + 8:off + 8 + bl]
    return js, binary


def write_glb(js, binary):
    jb = json.dumps(js, separators=(",", ":")).encode()
    jb += b" " * ((-len(jb)) % 4)
    binary += b"\x00" * ((-len(binary)) % 4)
    total = 12 + 8 + len(jb) + 8 + len(binary)
    return (struct.pack("<III", 0x46546C67, 2, total) + struct.pack("<II", len(jb), 0x4E4F534A) + jb
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


def indexed_png(png_bytes):
    import numpy as np
    from PIL import Image
    im = Image.open(io.BytesIO(png_bytes)).convert("RGBA")
    a = np.asarray(im)
    flat = a.reshape(-1, 4).copy()
    flat[flat[:, 3] < 128] = 0          # alpha is a mask: every cut-out texel is the same clear colour
    flat[flat[:, 3] >= 128, 3] = 255
    cols, inv = np.unique(flat, axis=0, return_inverse=True)
    if len(cols) > 256:
        buf = io.BytesIO()
        Image.fromarray(flat.reshape(a.shape), "RGBA").save(buf, "PNG", optimize=True)
        return buf.getvalue()
    p = Image.fromarray(inv.reshape(a.shape[:2]).astype("uint8"), "P")
    pal = cols[:, :3].reshape(-1).tolist()
    p.putpalette(pal + [0] * (768 - len(pal)))
    buf = io.BytesIO()
    p.save(buf, "PNG", optimize=True, transparency=bytes(int(v) for v in cols[:, 3]))
    return buf.getvalue()


def postprocess(src, dst, item_id):
    js, binary = read_glb(open(src, "rb").read())
    views = js["bufferViews"]
    chunks = [binary[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]] for v in views]
    for img in js.get("images", []):
        bv = img["bufferView"]
        chunks[bv] = indexed_png(chunks[bv])
    # rebuild the binary chunk
    out, off = [], 0
    for v, c in zip(views, chunks):
        pad = (-off) % 4
        if pad:
            out.append(b"\x00" * pad)
            off += pad
        v["byteOffset"] = off
        v["byteLength"] = len(c)
        out.append(c)
        off += len(c)
    binary = b"".join(out)
    js["buffers"][0]["byteLength"] = len(binary) + ((-len(binary)) % 4)
    # materials: lit everywhere, an unlit twin for glowing parts
    mats = js["materials"]
    for m in mats:
        m.pop("extensions", None)
        m["pbrMetallicRoughness"]["roughnessFactor"] = 0.9
        m["pbrMetallicRoughness"]["metallicFactor"] = 0.0
    twin = {}
    for node in js["nodes"]:
        part = (node.get("extras") or {}).get("part", node.get("name", ""))
        if "mesh" not in node or not str(part).startswith("glow"):
            continue
        for prim in js["meshes"][node["mesh"]]["primitives"]:
            mi = prim["material"]
            if mi not in twin:
                t = json.loads(json.dumps(mats[mi]))
                t["name"] = mats[mi]["name"] + "_glow"
                t["extensions"] = {"KHR_materials_unlit": {}}
                mats.append(t)
                twin[mi] = len(mats) - 1
            prim["material"] = twin[mi]
    if twin:
        js["extensionsUsed"] = ["KHR_materials_unlit"]
    else:
        js.pop("extensionsUsed", None)
    # one root, scaled to world units
    roots = js["scenes"][0]["nodes"]
    js["nodes"].append({"name": item_id, "scale": [1 / 16] * 3, "children": roots})
    js["scenes"][0]["nodes"] = [len(js["nodes"]) - 1]
    js["asset"]["generator"] = "lowpix + Hoot Hollow souvenirs"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "wb") as fh:
        fh.write(write_glb(js, binary))
    return os.path.getsize(dst)


# ------------------------------------------------------------------------------------------------ icon
def icon(spec_path, dst, size=64):
    """A crisp pixel portrait: rendered at icon size without supersampling, keyed onto a clear background,
    with a 1 px ink outline round the silhouette."""
    import numpy as np
    from PIL import Image
    from lowpix.build import build_model
    from lowpix.render import render
    m = build_model(spec_path)
    hy, hp = m.spec.get("render", {}).get("hero", (32, 24))
    key = (255, 0, 255)
    im = render(m, size, size, hy, hp, ssaa=1, background="#ff00ff", shadow=False, margin=0.9)
    a = np.asarray(im.convert("RGB")).copy()
    mask = ~((a[..., 0] == key[0]) & (a[..., 1] == key[1]) & (a[..., 2] == key[2]))
    rgba = np.zeros((size, size, 4), np.uint8)
    rgba[..., :3] = a
    rgba[..., 3] = mask * 255
    # outline: clear pixels touching the model become ink
    pad = np.pad(mask, 1)
    near = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    edge = near & ~mask
    rgba[edge] = (46, 43, 36, 255)
    Image.fromarray(rgba, "RGBA").save(dst, optimize=True)


# ------------------------------------------------------------------------------------------------ build
def build_one(item_id, spec_path, out_dir):
    try:
        return _build_one(item_id, spec_path, out_dir)
    except Exception as e:  # report and carry on with the other items
        return {"id": item_id, "error": str(e)[:2000]}


def _build_one(item_id, spec_path, out_dir):
    os.chdir(ROOT)
    from lowpix.build import export_all
    t0 = time.time()
    od = os.path.join(out_dir, item_id)
    rep = export_all(spec_path, od, gif=False, sheet=True, hero_size=(600, 460))
    glb = os.path.join(od, f"{item_id}.glb")
    size = postprocess(glb, os.path.join(ROOT, "public", "models", "souvenirs", f"{item_id}.glb"), item_id)
    # icons are rendered in the browser (dev-souvenirs.html) so borrowed and built models match
    return {"id": item_id, "s": round(time.time() - t0, 1), "kb": round(size / 1024), "tris": rep.get("tris"),
            "atlas": rep.get("atlas"), "colours": rep.get("colours"), "warnings": rep.get("warnings"), "bounds": rep.get("bounds")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--out", default=os.environ.get("SOUV_OUT", "/tmp/souvenirs"))
    ap.add_argument("--jobs", type=int, default=1)
    ap.add_argument("--specs-only", action="store_true")
    a = ap.parse_args()
    os.chdir(ROOT)
    items = all_items()
    ids = a.ids or list(items)
    spec_dir = os.path.join(ROOT, "art", "lowpix", "souvenirs")
    paths = {}
    for i in ids:
        s = items[i]()
        paths[i] = os.path.relpath(s.write(spec_dir), ROOT)
    if a.specs_only:
        print("\n".join(paths.values()))
        return
    jobs = [(i, paths[i], a.out) for i in ids]
    if a.jobs > 1:
        with ProcessPoolExecutor(a.jobs) as ex:
            for r in ex.map(build_one, *zip(*jobs)):
                print(json.dumps(r))
    else:
        for j in jobs:
            print(json.dumps(build_one(*j)), flush=True)


if __name__ == "__main__":
    main()
