"""Build furnB's item models: write art/lowpix/items/<id>.json from the Python item recipes, build each with lowpix,
and install public/models/items/<id>.glb (scaled to world units: 16 px = 1, origin bottom centre, facing +z; parts
named glow_* get an emissive material so lamps and flames glow at night).

  PYTHONPATH=<symmetrical-goggles> ~/.cache/lowpix-venv/bin/python art/lowpix/items/_furnb/make.py [ids...] [--out DIR] [-j N]

Writes previews (<id>_sheet.png, <id>_hero.png) to --out (default: $LOWPIX_OUT or /tmp/furnb-out) and a contact
sheet of every hero render.
"""
from __future__ import annotations

import argparse
import json
import os
import struct
import sys
import time
from multiprocessing import Pool

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
SPECS = os.path.abspath(os.path.join(HERE, ".."))
MODELS = os.path.join(ROOT, "public", "models", "items")
sys.path.insert(0, HERE)


def recipes() -> dict:
    import beds, green, green_cards, lights, tables  # noqa: E401
    out = {}
    for mod in (beds, tables, lights, green, green_cards):
        out.update(mod.ITEMS)
    return out


# ------------------------------------------------------------------ GLB post-processing
def read_glb(path):
    with open(path, "rb") as fh:
        data = fh.read()
    magic, ver, total = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67
    off = 12
    js, binc = None, b""
    while off < total:
        ln, typ = struct.unpack_from("<II", data, off)
        chunk = data[off + 8: off + 8 + ln]
        if typ == 0x4E4F534A:
            js = json.loads(chunk.decode("utf8"))
        elif typ == 0x004E4942:
            binc = chunk
        off += 8 + ln
    return js, binc


def write_glb(path, js, binc):
    jb = json.dumps(js, separators=(",", ":")).encode("utf8")
    jb += b" " * ((-len(jb)) % 4)
    binc += b"\x00" * ((-len(binc)) % 4)
    total = 12 + 8 + len(jb) + 8 + len(binc)
    with open(path, "wb") as fh:
        fh.write(struct.pack("<III", 0x46546C67, 2, total))
        fh.write(struct.pack("<II", len(jb), 0x4E4F534A) + jb)
        fh.write(struct.pack("<II", len(binc), 0x004E4942) + binc)


def finish_glb(src, dst, iid):
    js, binc = read_glb(src)
    roots = js["scenes"][0]["nodes"]
    js["nodes"].append({"name": iid, "scale": [1 / 16] * 3, "children": roots})
    js["scenes"][0]["nodes"] = [len(js["nodes"]) - 1]
    js["scenes"][0]["name"] = iid
    # emissive copies of the materials for glow_* parts
    mats = js["materials"]
    glow_of = {}
    for n in js["nodes"]:
        part = (n.get("extras") or {}).get("part", "")
        n.pop("extras", None)
        if "mesh" not in n or not part.startswith("glow"):
            continue
        for prim in js["meshes"][n["mesh"]]["primitives"]:
            m = prim["material"]
            if m not in glow_of:
                g = json.loads(json.dumps(mats[m]))
                g["name"] = mats[m]["name"] + "_glow"
                g["emissiveTexture"] = {"index": 0}
                g["emissiveFactor"] = [1.0, 1.0, 1.0]
                mats.append(g)
                glow_of[m] = len(mats) - 1
            prim["material"] = glow_of[m]
    # translucent copies for glass_* parts (jars, domes, panes, bottles): tinted and see-through
    glass_of = {}
    for n in js["nodes"]:
        if "mesh" not in n or not n.get("name", "").startswith("glass"):
            continue
        for prim in js["meshes"][n["mesh"]]["primitives"]:
            m = prim["material"]
            if m not in glass_of:
                g = json.loads(json.dumps(mats[m]))
                g["name"] = mats[m]["name"] + "_glass"
                g["alphaMode"] = "BLEND"
                g.pop("alphaCutoff", None)
                g["doubleSided"] = True
                g["pbrMetallicRoughness"]["baseColorFactor"] = [1.0, 1.0, 1.0, 0.42]
                g["pbrMetallicRoughness"]["roughnessFactor"] = 0.35
                mats.append(g)
                glass_of[m] = len(mats) - 1
            prim["material"] = glass_of[m]
    js["asset"]["generator"] = "lowpix + Hoot Hollow furnB"
    write_glb(dst, js, binc)
    return os.path.getsize(dst)


# ------------------------------------------------------------------ build one
def build_one(args):
    iid, out_dir = args
    from lowpix.build import export_model
    from lowpix.model import build_model
    t0 = time.time()
    spec_path = os.path.join(SPECS, f"{iid}.json")
    model = build_model(spec_path)
    od = os.path.join(out_dir, iid)
    rep = export_model(model, od, gif=False, sheet=True, hero_size=(640, 480))
    glb = os.path.join(od, f"{iid}.glb")
    os.makedirs(MODELS, exist_ok=True)
    size = finish_glb(glb, os.path.join(MODELS, f"{iid}.glb"), iid)
    for ext in ("_sheet.png", "_hero.png"):
        s = os.path.join(od, iid + ext)
        if os.path.exists(s):
            os.replace(s, os.path.join(out_dir, iid + ext))
    return {"id": iid, "tris": rep["triangles"], "atlas": rep["atlas"], "colours": rep["colors_used"],
            "bounds": rep["bounds"], "warnings": rep["warnings"], "kb": round(size / 1024), "s": round(time.time() - t0, 1)}


def contact(out_dir, ids, cols=7, cell=260):
    from PIL import Image, ImageDraw
    ims = []
    for i in ids:
        p = os.path.join(out_dir, f"{i}_hero.png")
        if os.path.exists(p):
            ims.append((i, Image.open(p).convert("RGB")))
    if not ims:
        return
    rows_ = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows_ * (cell * 3 // 4 + 18)), (30, 36, 34))
    d = ImageDraw.Draw(sheet)
    for k, (i, im) in enumerate(ims):
        im.thumbnail((cell, cell * 3 // 4))
        x, y = (k % cols) * cell, (k // cols) * (cell * 3 // 4 + 18)
        sheet.paste(im, (x, y))
        d.text((x + 4, y + cell * 3 // 4 + 2), i, fill=(240, 230, 200))
    sheet.save(os.path.join(out_dir, "contact.png"))


SOURCES = os.environ.get("FURNB_SOURCES", "/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad")


def borrow_one(args):
    """A borrowed model (borrowed.py): re-grade, re-root and fit it; merge its '<id>_extra' lowpix parts if any."""
    iid, out_dir = args
    from borrowed import BORROW
    import borrow
    t0 = time.time()
    cfg = BORROW[iid]
    fb = json.load(open(os.path.join(HERE, "fallback_bounds.json")))[iid]["b"]
    extra = None
    xs = os.path.join(SPECS, "_extra", f"{iid}.json")
    if os.path.exists(xs):
        from lowpix.build import export_model
        from lowpix.model import build_model
        od = os.path.join(out_dir, iid + "_extra")
        export_model(build_model(xs), od, gif=False, sheet=False, hero_size=(320, 240))
        extra = os.path.join(od, "extra.glb")
        finish_glb(os.path.join(od, f"{iid}_extra.glb"), extra, iid + "_extra")
    dst = os.path.join(MODELS, f"{iid}.glb")
    os.makedirs(MODELS, exist_ok=True)
    r = borrow.borrow(os.path.join(SOURCES, cfg["src"]), dst, iid, cfg.get("target", fb), g=cfg.get("grade"), yaw=cfg.get("yaw", 0.0),
                      fit=cfg.get("fit", "contain"), extra=extra, extra_px=False, nudge=cfg.get("nudge", (0, 0, 0)), squash=cfg.get("squash", (1, 1, 1)))
    b = r["bounds_px"]
    return {"id": iid, "tris": 0, "atlas": [0, 0], "colours": 0, "bounds": {"min": [b[0], b[2], b[4]], "max": [b[1], b[3], b[5]]},
            "warnings": [], "kb": round(os.path.getsize(dst) / 1024), "s": round(time.time() - t0, 1), "borrowed": cfg["src"]}


def run(job):
    from borrowed import BORROW
    return borrow_one(job) if job[0] in BORROW else build_one(job)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--out", default=os.environ.get("LOWPIX_OUT", "/tmp/furnb-out"))
    ap.add_argument("-j", "--jobs", type=int, default=2)
    ap.add_argument("--specs-only", action="store_true")
    a = ap.parse_args()
    from borrowed import BORROW
    R = recipes()
    own = [k for k in R if not k.endswith("_extra") and k not in BORROW]
    ids = a.ids or own + list(BORROW)
    bad = [i for i in ids if i not in R and i not in BORROW]
    if bad:
        sys.exit(f"unknown ids: {bad}")
    os.makedirs(os.path.join(SPECS, "_extra"), exist_ok=True)
    for i in ids:
        if i in BORROW:
            stale = os.path.join(SPECS, f"{i}.json")
            if os.path.exists(stale):
                os.remove(stale)  # the model is borrowed now; borrowed.py is its recipe
            if i + "_extra" in R:
                with open(os.path.join(SPECS, "_extra", f"{i}.json"), "w") as fh:
                    json.dump(R[i + "_extra"](), fh, indent=1)
            continue
        spec = R[i]()
        with open(os.path.join(SPECS, f"{i}.json"), "w") as fh:
            json.dump(spec, fh, indent=1)
    if a.specs_only:
        return
    os.makedirs(a.out, exist_ok=True)
    jobs = [(i, a.out) for i in ids]
    if a.jobs > 1 and len(jobs) > 1:
        with Pool(a.jobs) as pool:
            res = pool.map(run, jobs, chunksize=1)
    else:
        res = [run(j) for j in jobs]
    for r in res:
        b = r["bounds"]
        print(f"{r['id']:18s} tris {r['tris']:5d}  atlas {r['atlas'][0]}x{r['atlas'][1]}  {r['kb']:4d} KB  {r['s']:5.1f}s  "
              f"x[{b['min'][0]:.1f},{b['max'][0]:.1f}] y[{b['min'][1]:.1f},{b['max'][1]:.1f}] z[{b['min'][2]:.1f},{b['max'][2]:.1f}]" + (f"  <- {r['borrowed']}" if r.get("borrowed") else ""))
        for w in r["warnings"]:
            print("    !", w)
    with open(os.path.join(a.out, "report.json"), "w") as fh:
        json.dump(res, fh, indent=1)
    contact(a.out, ids)


if __name__ == "__main__":
    main()
