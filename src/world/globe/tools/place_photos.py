"""Real photographs of the twenty places: find free-licence candidates, then pack the chosen ones into one WebP
sheet per place (with a NASA satellite close-up of the place for the globe's fly-in).

    python3 -I src/world/globe/tools/place_photos.py search <work dir> [place ...]
        Openverse (https://api.openverse.org) search per place and per kind of photo (landmark, landscape, life),
        licence filter CC0 / public domain / CC BY only, Flickr-hosted originals. Writes <work>/cand/<place>.json and
        a contact sheet <work>/cand/<place>.jpg (rows = kinds, numbered) to choose from.
    python3 -I src/world/globe/tools/place_photos.py build <work dir> [place ...]
        Reads the choices in PICKS below, downloads each chosen photo (1024 px), crops it to 3:2 round its FOCUS,
        downloads the NASA Blue Marble close-up from GIBS, and writes public/img/places/<place>.webp plus
        src/ui/globe/photos.ts (layout, captions, credits) and the photo table in docs/credits/globe4.md.

Sheet layout (2048 x 1366): photo 0 at (0,0), photo 1 at (1024,0), photo 2 at (0,683), satellite at (1024,683);
each cell 1024 x 683.
"""
import io
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
UA = "HootHollowAssetScript/1.1 (offline game build; keeps photo credits)"
CW, CH = 1024, 683

# place: (lat, lon, [(kind, query), ...])
PLACES = {
    "highlands": (57.1, -4.7, [("landmark", "Eilean Donan castle"), ("landscape", "Glencoe Scotland"), ("life", "Highland cow Scotland")]),
    "kyoto": (35.0, 135.8, [("landmark", "Fushimi Inari torii"), ("landscape", "Arashiyama bamboo"), ("life", "Kyoto Gion street")]),
    "paris": (48.86, 2.35, [("landmark", "Eiffel Tower"), ("landscape", "Seine Paris bridge"), ("life", "Paris cafe")]),
    "venice": (45.44, 12.33, [("landmark", "Grand Canal Venice"), ("landscape", "Venice gondola"), ("life", "Venice carnival mask")]),
    "santorini": (36.42, 25.43, [("landmark", "Oia Santorini"), ("landscape", "Santorini caldera"), ("life", "Santorini blue dome")]),
    "sahara": (31.1, -4.0, [("landmark", "Erg Chebbi"), ("landscape", "Sahara camel"), ("life", "Moroccan lanterns")]),
    "grandcanyon": (36.1, -112.1, [("landmark", "Grand Canyon"), ("landscape", "Colorado River Grand Canyon"), ("life", "Grand Canyon condor")]),
    "cappadocia": (38.64, 34.83, [("landmark", "Cappadocia balloons"), ("landscape", "Goreme fairy chimneys"), ("life", "Turkish tea")]),
    "tajmahal": (27.17, 78.04, [("landmark", "Taj Mahal"), ("landscape", "Agra Fort"), ("life", "Indian spices market")]),
    "iceland": (64.05, -16.2, [("landmark", "Kirkjufell"), ("landscape", "Jokulsarlon"), ("life", "Icelandic horses")]),
    "machupicchu": (-13.16, -72.55, [("landmark", "Machu Picchu"), ("landscape", "Andes Peru mountains"), ("life", "llama Peru")]),
    "amazon": (-3.4, -62.2, [("landmark", "Amazon river rainforest"), ("landscape", "Amazon rainforest canopy"), ("life", "toucan")]),
    "serengeti": (-2.33, 34.83, [("landmark", "Serengeti"), ("landscape", "wildebeest migration"), ("life", "elephants Serengeti")]),
    "banff": (51.42, -116.2, [("landmark", "Moraine Lake"), ("landscape", "Lake Louise Banff"), ("life", "elk Banff")]),
    "petra": (30.33, 35.44, [("landmark", "Petra Treasury"), ("landscape", "Wadi Rum"), ("life", "Petra Monastery")]),
    "angkor": (13.41, 103.87, [("landmark", "Angkor Wat"), ("landscape", "Ta Prohm"), ("life", "Bayon faces")]),
    "reef": (-18.3, 147.7, [("landmark", "Great Barrier Reef"), ("landscape", "Whitehaven Beach"), ("life", "clownfish anemone")]),
    "rio": (-22.91, -43.17, [("landmark", "Christ the Redeemer Rio"), ("landscape", "Sugarloaf Mountain Rio"), ("life", "Rio carnival")]),
    "milford": (-44.67, 167.93, [("landmark", "Milford Sound"), ("landscape", "Fiordland New Zealand"), ("life", "kea parrot")]),
    "antarctica": (-64.8, -62.9, [("landmark", "Antarctica iceberg"), ("landscape", "Antarctic Peninsula"), ("life", "gentoo penguins")]),
}

# The chosen photos: place -> [(kind, candidate index, caption, focus x, focus y)] (filled in after looking at the
# contact sheets). Focus is where the 3:2 crop centres, as fractions of the photo.
PICKS: dict = {}


def get(url, raw=False, tries=3):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    err = None
    for a in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            return data if raw else json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                raise
            err = e
            time.sleep(20 + a * 30)
        except Exception as e:  # noqa: BLE001 - a hiccup: back off
            err = e
            time.sleep(10 + a * 20)
    raise err


def search(work, places):
    os.makedirs(os.path.join(work, "cand"), exist_ok=True)
    for p in places:
        out = os.path.join(work, "cand", f"{p}.json")
        if os.path.exists(out):
            continue
        cands = {}
        for kind, q in PLACES[p][2]:
            cands[kind] = query(q)
            time.sleep(4)
        json.dump(cands, open(out, "w"), indent=1, ensure_ascii=False)
        contact(work, p, cands, [k for k, _ in PLACES[p][2]])
        print(p, {k: len(v) for k, v in cands.items()}, flush=True)


def query(q):
    url = ("https://api.openverse.org/v1/images/?" + urllib.parse.urlencode({
        "q": q, "license": "by,cc0,pdm", "page_size": 20, "mature": "false", "source": "flickr"}))
    keep = []
    for r in get(url).get("results", []):
        w, h = r.get("width") or 0, r.get("height") or 0
        if w < 1000 or w < h * 1.3 or "staticflickr.com" not in r.get("url", ""):
            continue
        keep.append({k: r.get(k) for k in ("id", "title", "creator", "creator_url", "license", "license_version",
                                            "license_url", "url", "foreign_landing_url", "width", "height")})
        if len(keep) >= 8:
            break
    return keep


def extra(work, p, kind, q):
    """Another query for a place: candidates under `kind` (e.g. x1), contact sheet <place>_<kind>.jpg."""
    f = os.path.join(work, "cand", f"{p}.json")
    cands = json.load(open(f))
    cands[kind] = query(q)
    json.dump(cands, open(f, "w"), indent=1, ensure_ascii=False)
    contact(work, p, cands, [kind], f"{p}_{kind}")
    print(p, kind, len(cands[kind]), flush=True)


def contact(work, p, cands, kinds, name=None):
    TW, TH = 240, 160
    sheet = Image.new("RGB", (8 * TW, len(kinds) * (TH + 18)), (20, 20, 24))
    dr = ImageDraw.Draw(sheet)
    for row, kind in enumerate(kinds):
        for i, c in enumerate(cands.get(kind, [])):
            try:
                b = get(c["url"].replace("_b.jpg", "_n.jpg"), raw=True)
                im = Image.open(io.BytesIO(b)).convert("RGB")
            except Exception:  # noqa: BLE001
                continue
            im.thumbnail((TW, TH))
            sheet.paste(im, (i * TW, row * (TH + 18) + 18))
            dr.text((i * TW + 4, row * (TH + 18) + 3), f"{kind[:4]} {i} {c['license']}{c['license_version'] or ''}", fill=(255, 255, 160))
            time.sleep(0.3)
    sheet.save(os.path.join(work, "cand", f"{name or p}.jpg"), quality=82)


def crop32(im, fx, fy):
    w, h = im.size
    if w / h > CW / CH:
        cw, ch = round(h * CW / CH), h
    else:
        cw, ch = w, round(w * CH / CW)
    x0 = int(max(0, min(w - cw, fx * w - cw / 2)))
    y0 = int(max(0, min(h - ch, fy * h - ch / 2)))
    return im.crop((x0, y0, x0 + cw, y0 + ch)).resize((CW, CH), Image.LANCZOS)


# ground shown across the globe's close view of each place (km; the same numbers as src/game/places.ts)
SPAN = {"highlands": 560, "kyoto": 700, "paris": 720, "venice": 620, "santorini": 520, "sahara": 1000, "grandcanyon": 760,
        "cappadocia": 760, "tajmahal": 900, "iceland": 720, "machupicchu": 820, "amazon": 1300, "serengeti": 900, "banff": 640,
        "petra": 760, "angkor": 800, "reef": 1000, "rio": 640, "milford": 640, "antarctica": 1100}


def satellite(lat, lon, work, p):
    """The Blue Marble close-up of a place: land from Blue Marble Next Generation, sea from the bathymetry version
    (NASA GIBS, public domain), 1024 x 683 px round the place, about 1.7 times as wide as the close view and a
    little further north (the camera looks north, over the place, towards the horizon)."""
    km = SPAN[p] * 1.7
    span_lon = km / 111.32 / max(0.3, np.cos(np.radians(lat)))
    span_lat = km * CH / CW / 110.57
    s, n = lat - span_lat * 0.42, lat + span_lat * 0.58
    w, e = lon - span_lon / 2, lon + span_lon / 2
    cache = os.path.join(work, "sat2")
    os.makedirs(cache, exist_ok=True)
    W, H = CW * 2, CH * 2
    layers = {}
    for name, fmt in (("BlueMarble_NextGeneration", "image/jpeg"), ("BlueMarble_ShadedRelief_Bathymetry", "image/jpeg"), ("MODIS_Terra_L3_Land_Water_Mask", "image/png")):
        f = os.path.join(cache, f"{p}_{name}.{fmt.split('/')[1]}")
        if not os.path.exists(f):
            q = {"SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.3.0", "LAYERS": name, "CRS": "EPSG:4326",
                 "BBOX": f"{s},{w},{n},{e}", "WIDTH": W, "HEIGHT": H, "FORMAT": fmt}
            if "Water" in name:
                q["TIME"] = "2015-01-01"
            open(f, "wb").write(get("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?" + urllib.parse.urlencode(q), raw=True))
        layers[name] = Image.open(f)
    land = np.asarray(layers["BlueMarble_NextGeneration"].convert("RGB"), np.float32)
    sea = np.asarray(layers["BlueMarble_ShadedRelief_Bathymetry"].convert("RGB"), np.float32)
    wm = np.asarray(layers["MODIS_Terra_L3_Land_Water_Mask"].convert("RGBA"))
    water = (wm[..., 3] > 0) & (wm[..., 2] > 128)
    if lat < -55:
        water &= land.mean(-1) < 150   # the MODIS mask has no Antarctica: ice is land
    m = Image.fromarray((water * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
    m = np.asarray(m, np.float32)[..., None] / 255
    out = land * (1 - m) + sea * m
    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((CW, CH), Image.LANCZOS)
    return img, {"s": round(s, 4), "n": round(n, 4), "w": round(w, 4), "e": round(e, 4)}


def build(work, places):
    from photo_picks import PICKS as picks  # noqa: E402 - kept next to this file
    out_dir = os.path.join(ROOT, "public", "img", "places")
    os.makedirs(out_dir, exist_ok=True)
    meta = {}
    mpath = os.path.join(work, "meta.json")
    if os.path.exists(mpath):
        meta = json.load(open(mpath))
    for p in places:
        if p not in picks:
            print("no picks", p)
            continue
        cands = json.load(open(os.path.join(work, "cand", f"{p}.json")))
        sheet = Image.new("RGB", (2 * CW, 2 * CH), (0, 0, 0))
        photos = []
        for i, (kind, idx, caption, fx, fy) in enumerate(picks[p]):
            c = cands[kind][idx]
            f = os.path.join(work, "full", f"{p}_{kind}_{idx}.jpg")
            os.makedirs(os.path.dirname(f), exist_ok=True)
            if not os.path.exists(f):
                open(f, "wb").write(get(c["url"], raw=True))
                time.sleep(1)
            im = crop32(Image.open(f).convert("RGB"), fx, fy)
            sheet.paste(im, ((i % 2) * CW, (i // 2) * CH))
            lic = {"by": "CC BY", "cc0": "CC0", "pdm": "Public domain"}[c["license"]]
            if c["license"] == "by" and c.get("license_version"):
                lic += " " + c["license_version"]
            photos.append({"caption": caption, "title": (c["title"] or "").strip(), "author": (c["creator"] or "unknown").strip(),
                           "licence": lic, "url": c["foreign_landing_url"]})
        lat, lon = PLACES[p][0], PLACES[p][1]
        sat, box = satellite(lat, lon, work, p)
        sheet.paste(sat, (CW, CH))
        sheet.save(os.path.join(out_dir, f"{p}.webp"), quality=74, method=6)
        meta[p] = {"photos": photos, "sat": box}
        json.dump(meta, open(mpath, "w"), indent=1, ensure_ascii=False)
        print(p, os.path.getsize(os.path.join(out_dir, f"{p}.webp")) // 1024, "KB", flush=True)
    thumbs(out_dir)
    write_ts(meta)
    write_credits(meta)


TW_, TH_ = 192, 128


def thumbs(out_dir):
    """public/img/places/places.webp: the first photo of every place, small (passport stamps, lists), 5 x 4."""
    at = Image.new("RGB", (5 * TW_, 4 * TH_), (0, 0, 0))
    for i, p in enumerate(PLACES):
        f = os.path.join(out_dir, f"{p}.webp")
        if os.path.exists(f):
            im = Image.open(f).convert("RGB").crop((0, 0, CW, CH)).resize((TW_, TH_), Image.LANCZOS)
            at.paste(im, ((i % 5) * TW_, (i // 5) * TH_))
    at.save(os.path.join(out_dir, "places.webp"), quality=82, method=6)


def write_ts(meta):
    order = list(PLACES)
    lines = [
        "// Generated by src/world/globe/tools/place_photos.py: the real photographs of each place (three per place,",
        "// CC0 / public domain / CC BY, credits below) and its NASA Blue Marble close-up, one WebP sheet per place in",
        "// public/img/places/<id>.webp (2048 x 1366: photos at (0,0) (1024,0) (0,683), the satellite tile at (1024,683)).",
        "// [globe] OWNED BY THE GLOBE BUILDER.",
        "export interface PlacePhoto { caption: string; title: string; author: string; licence: string; url: string }",
        "/** the satellite tile's bounds in degrees */",
        "export interface SatBox { s: number; n: number; w: number; e: number }",
        "export const SHEET = { w: 2048, h: 1366, cw: 1024, ch: 683 };",
        "export const sheetUrl = (id: string) => `${import.meta.env.BASE_URL}img/places/${id}.webp`;",
        "/** the first photo of every place, small, in PLACES order (5 x 4 cells of 192 x 128) */",
        "export const THUMBS = { src: 'img/places/places.webp', tw: %d, th: %d, cols: 5, order: %s };" % (TW_, TH_, json.dumps(list(PLACES))),
        "export const PLACE_PHOTOS: Record<string, PlacePhoto[]> = {",
    ]
    for p in order:
        if p in meta:
            lines.append(f"  {p}: {json.dumps(meta[p]['photos'], ensure_ascii=False)},")
    lines += ["};", "export const PLACE_SAT: Record<string, SatBox> = {"]
    for p in order:
        if p in meta:
            lines.append(f"  {p}: {json.dumps(meta[p]['sat'])},")
    lines.append("};")
    open(os.path.join(ROOT, "src", "ui", "globe", "photos.ts"), "w").write("\n".join(lines) + "\n")


def write_credits(meta):
    path = os.path.join(ROOT, "docs", "credits", "globe4.md")
    txt = open(path).read() if os.path.exists(path) else "# Credits: the Earth and the places (globe, round 4)\n\n<!-- photos -->\n<!-- /photos -->\n"
    rows = ["| place | photo | title | author | licence |", "|---|---|---|---|---|"]
    for p in PLACES:
        for ph in meta.get(p, {}).get("photos", []):
            t = ph["title"].replace("|", "/")
            rows.append(f"| {p} | {ph['caption']} | [{t}]({ph['url']}) | {ph['author'].replace('|', '/')} | {ph['licence']} |")
    block = "<!-- photos -->\n" + "\n".join(rows) + "\n<!-- /photos -->"
    txt = re.sub(r"<!-- photos -->.*<!-- /photos -->", lambda _: block, txt, flags=re.S)
    open(path, "w").write(txt)


if __name__ == "__main__":
    sys.path.insert(0, HERE)
    mode, work = sys.argv[1], sys.argv[2]
    if mode == "extra":
        extra(work, sys.argv[3], sys.argv[4], " ".join(sys.argv[5:]))
    else:
        pl = sys.argv[3:] or list(PLACES)
        (search if mode == "search" else build)(work, pl)
