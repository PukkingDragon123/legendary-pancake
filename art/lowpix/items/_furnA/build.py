"""Build furnA's item specs into game models.

    cd <repo>; ~/.cache/lowpix-venv/bin/python art/lowpix/items/_furnA/build.py [ids...] [--out DIR] [--jobs N] [--specs-only]

1. Runs every item function in items_*.py and writes art/lowpix/items/<id>.json (ids that borrow.py makes from
   borrowed models, borrow.BORROWED, are skipped; EXTRAS are parts it merges into those, written to _furnA/extras/).
2. Builds each spec with lowpix (GLB, sheet, hero) into --out (default: $FURNA_OUT or /tmp/furnA).
3. Post-processes the GLB for the game and writes public/models/items/<id>.glb:
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

MODULES = ["items_start", "items_home", "items_furn"]


def all_items():
    """Items built here (lowpix specs) and extras (parts merged into borrowed items), minus borrowed ids."""
    from borrow import BORROWED
    out, extras = {}, {}
    for m in MODULES:
        try:
            mod = importlib.import_module(m)
        except ModuleNotFoundError:
            continue
        for k, fn in mod.ITEMS.items():
            if k not in BORROWED:
                out[k] = fn
        extras.update(getattr(mod, "EXTRAS", {}))
    return out, extras


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
    return finish_glb(js, binary, dst, item_id)


def finish_glb(js, binary, dst, item_id, root_scale=True):
    """Lit materials with unlit twins for glow parts, one root node scaled to world units, write the file."""
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
                t["name"] = mats[mi].get("name", "mat") + "_glow"
                t["extensions"] = {"KHR_materials_unlit": {}}
                mats.append(t)
                twin[mi] = len(mats) - 1
            prim["material"] = twin[mi]
    used = [e for e in js.get("extensionsUsed", []) if e != "KHR_materials_unlit"]
    if twin:
        used.append("KHR_materials_unlit")
    if used:
        js["extensionsUsed"] = used
    else:
        js.pop("extensionsUsed", None)
    if root_scale:
        roots = js["scenes"][0]["nodes"]
        js["nodes"].append({"name": item_id, "scale": [1 / 16] * 3, "children": roots})
        js["scenes"][0]["nodes"] = [len(js["nodes"]) - 1]
    js["asset"]["generator"] = "lowpix + Hoot Hollow furnA"
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "wb") as fh:
        fh.write(write_glb(js, binary))
    return os.path.getsize(dst)


# ------------------------------------------------------------------------------------------------ build
def build_one(item_id, spec_path, out_dir, publish=True):
    try:
        return _build_one(item_id, spec_path, out_dir, publish)
    except Exception as e:  # report and carry on with the other items
        return {"id": item_id, "error": str(e)[:2000]}


def _build_one(item_id, spec_path, out_dir, publish=True):
    os.chdir(ROOT)
    from lowpix.build import export_all
    t0 = time.time()
    od = os.path.join(out_dir, item_id)
    rep = export_all(spec_path, od, gif=False, sheet=True, hero_size=(900, 700))
    glb = os.path.join(od, f"{item_id}.glb")
    if not publish:   # an extra part that borrow.py merges into a borrowed item
        return {"id": item_id, "extra": True, "s": round(time.time() - t0, 1), "warnings": rep.get("warnings")}
    size = postprocess(glb, os.path.join(ROOT, "public", "models", "items", f"{item_id}.glb"), item_id)
    return {"id": item_id, "s": round(time.time() - t0, 1), "kb": round(size / 1024), "tris": rep.get("tris"),
            "atlas": rep.get("atlas"), "colours": rep.get("colours"), "warnings": rep.get("warnings"), "bounds": rep.get("bounds")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--out", default=os.environ.get("FURNA_OUT", "/tmp/furnA"))
    ap.add_argument("--jobs", type=int, default=1)
    ap.add_argument("--specs-only", action="store_true")
    a = ap.parse_args()
    os.chdir(ROOT)
    items, extras = all_items()
    ids = a.ids or list(items) + list(extras)
    spec_dir = os.path.join(ROOT, "art", "lowpix", "items")
    paths = {}
    for i in ids:
        s = (items.get(i) or extras[i])()
        paths[i] = os.path.relpath(s.write(spec_dir if i in items else os.path.join(spec_dir, "_furnA", "extras")), ROOT)
    if a.specs_only:
        print("\n".join(paths.values()))
        return
    jobs = [(i, paths[i], a.out, i in items) for i in ids]
    if a.jobs > 1:
        with ProcessPoolExecutor(a.jobs) as ex:
            for r in ex.map(build_one, *zip(*jobs)):
                print(json.dumps(r))
    else:
        for j in jobs:
            print(json.dumps(build_one(*j)), flush=True)


if __name__ == "__main__":
    main()
