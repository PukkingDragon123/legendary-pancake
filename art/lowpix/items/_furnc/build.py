"""Build furnC's item models: Python item recipes -> lowpix JSON specs -> game GLBs (+ contact sheets to look at).

    PYTHONPATH=<symmetrical-goggles> ~/.cache/lowpix-venv/bin/python art/lowpix/items/_furnc/build.py [ids...] [--sheets DIR]

Writes art/lowpix/items/<id>.json and public/models/items/<id>.glb. With no ids it builds every item.
"""
from __future__ import annotations

import io
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
sys.path.insert(0, HERE)

from PIL import Image  # noqa: E402

import lib  # noqa: E402

RECIPES = {}
for mod in ("trinkets", "fun", "frost", "starfall"):
    try:
        m = __import__(mod)
    except ModuleNotFoundError as e:
        if e.name == mod:
            continue
        raise
    RECIPES.update(m.ITEMS)


def small_png(png: bytes) -> bytes:
    """Pixel art atlases have few colours: store them as an indexed PNG with per-index alpha (much smaller)."""
    import numpy as np
    im = np.array(Image.open(io.BytesIO(png)).convert("RGBA"))
    flat = im.reshape(-1, 4)
    flat = np.where(flat[:, 3:4] == 0, 0, flat)  # every fully clear texel is the same colour
    cols, inv = np.unique(flat, axis=0, return_inverse=True)
    if len(cols) > 256:
        buf = io.BytesIO()
        Image.fromarray(im, "RGBA").save(buf, "PNG", optimize=True)
        return buf.getvalue()
    out = Image.fromarray(inv.reshape(im.shape[:2]).astype(np.uint8), "P")
    out.putpalette([int(v) for v in cols[:, :3].reshape(-1)])
    buf = io.BytesIO()
    out.save(buf, "PNG", optimize=True, transparency=bytes(int(a) for a in cols[:, 3]))
    return buf.getvalue()


def build(item_id: str, sheets: str | None):
    from lowpix.export import glb_bytes
    from lowpix.model import build_model
    from lowpix.render import contact_sheet

    t0 = time.time()
    spec = RECIPES[item_id]()
    jpath = os.path.join(ROOT, "art", "lowpix", "items", f"{item_id}.json")
    spec.save(jpath)
    model = build_model(jpath)
    rep = model.report()
    raw = glb_bytes(model)
    glb = lib.finish_glb(raw, png=small_png)
    gpath = os.path.join(ROOT, "public", "models", "items", f"{item_id}.glb")
    os.makedirs(os.path.dirname(gpath), exist_ok=True)
    with open(gpath, "wb") as fh:
        fh.write(glb)
    import subprocess
    subprocess.run(["node", os.path.join(HERE, "meshopt.cjs"), gpath, gpath], check=True, capture_output=True)
    glb = open(gpath, "rb").read()
    if sheets:
        os.makedirs(sheets, exist_ok=True)
        # the preview renderer is opaque-only: look through the glass by leaving glass_/water_ parts out
        sp = spec.spec()
        see = [p for p in sp["parts"] if p["id"].startswith(("glass_", "water_"))]
        if see:
            gone = {p["id"] for p in see}
            keep = []
            for p in sp["parts"]:
                if p["id"] in gone or p.get("parent") in gone:
                    gone.add(p["id"])
                    continue
                keep.append(p)
            sp["parts"] = keep
            if sp.get("animations"):
                for a in sp["animations"].values():
                    a["tracks"] = [t for t in a["tracks"] if t.get("part") not in gone]
            pm = build_model(sp)
        else:
            pm = model
        contact_sheet(pm, pm.report()).save(os.path.join(sheets, f"{item_id}_sheet.png"))
        from lowpix.render import render
        render(pm, 520, 420, 34, 24).save(os.path.join(sheets, f"{item_id}_hero.png"))
    lo, hi = model.bounds()
    print(f"{item_id:20s} tris {rep['triangles']:5d} atlas {rep['atlas'][0]}x{rep['atlas'][1]} fill {rep['atlas_fill']:.2f} "
          f"cols {rep['colors_used']} glb {len(glb) / 1024:.0f}KB "
          f"bounds x[{lo[0]:.1f},{hi[0]:.1f}] y[{lo[1]:.1f},{hi[1]:.1f}] z[{lo[2]:.1f},{hi[2]:.1f}] "
          f"{time.time() - t0:.1f}s", flush=True)
    for w in rep.get("warnings", []):
        if "no ramp set" in w or (spec.wall and ("below ground" in w or "sinks below" in w or "floats" in w)):
            continue
        print("   warn:", w)


def montage(ids, sheets, out):
    ims = [Image.open(os.path.join(sheets, f"{i}_hero.png")).convert("RGB") for i in ids
           if os.path.exists(os.path.join(sheets, f"{i}_hero.png"))]
    if not ims:
        return
    cols = 3
    w, h = ims[0].size
    M = Image.new("RGB", (w * cols, h * ((len(ims) + cols - 1) // cols)), (39, 49, 63))
    from PIL import ImageDraw
    d = ImageDraw.Draw(M)
    for k, im in enumerate(ims):
        M.paste(im, ((k % cols) * w, (k // cols) * h))
        d.text(((k % cols) * w + 8, (k // cols) * h + 6), ids[k], fill=(241, 211, 154))
    M.save(out)


if __name__ == "__main__":
    args = sys.argv[1:]
    sheets = None
    if "--sheets" in args:
        i = args.index("--sheets")
        sheets = args[i + 1]
        del args[i:i + 2]
    ids = args or sorted(RECIPES)
    for i in ids:
        if i not in RECIPES:
            print("unknown item", i)
            continue
        try:
            build(i, sheets)
        except Exception as e:  # keep going; report at the end
            import traceback
            traceback.print_exc()
            print("FAILED", i, e)
    if sheets:
        montage(ids, sheets, os.path.join(sheets, "_montage.png"))
