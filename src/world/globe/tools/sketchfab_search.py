"""Search Sketchfab for downloadable CC BY / CC0 models; contact sheet of thumbnails per query.
python3 -I sfsearch.py <outdir> key=query [key=query ...]"""
import io, json, os, sys, time, urllib.parse, urllib.request
from PIL import Image, ImageDraw

out = sys.argv[1]
os.makedirs(out, exist_ok=True)


def get(url, raw=False):
    req = urllib.request.Request(url, headers={"User-Agent": "HootHollowAssetScript/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = r.read()
    return d if raw else json.loads(d)


for arg in sys.argv[2:]:
    key, q = arg.split("=", 1)
    res = []
    for lic in ("by", "cc0"):
        u = "https://api.sketchfab.com/v3/search?" + urllib.parse.urlencode({"type": "models", "q": q, "downloadable": "true", "license": lic, "count": 12, "max_face_count": 60000, "sort_by": "-likeCount"})
        try:
            d = get(u)
        except Exception as e:  # noqa: BLE001
            print(key, "search failed", e)
            continue
        for r in d.get("results", []):
            ims = sorted(r.get("thumbnails", {}).get("images", []), key=lambda i: abs(i["width"] - 256))
            res.append({"uid": r["uid"], "name": r["name"], "user": r["user"]["displayName"], "lic": r["license"]["label"] if r.get("license") else lic,
                        "faces": r.get("faceCount"), "likes": r.get("likeCount"), "thumb": ims[0]["url"] if ims else None, "url": r.get("viewerUrl")})
        time.sleep(1)
    res = res[:16]
    json.dump(res, open(os.path.join(out, f"{key}.json"), "w"), indent=1)
    TW, TH = 200, 150
    sheet = Image.new("RGB", (8 * TW, 2 * (TH + 28)), (24, 24, 28))
    dr = ImageDraw.Draw(sheet)
    for i, r in enumerate(res):
        x, y = (i % 8) * TW, (i // 8) * (TH + 28)
        try:
            im = Image.open(io.BytesIO(get(r["thumb"], raw=True))).convert("RGB")
            im.thumbnail((TW, TH))
            sheet.paste(im, (x, y + 28))
        except Exception:  # noqa: BLE001
            pass
        dr.text((x + 3, y + 2), f"{i} {r['name'][:24]}", fill=(255, 255, 170))
        dr.text((x + 3, y + 14), f"{r['faces']}f {r['lic'][:12]} {r['likes']}", fill=(170, 220, 255))
    sheet.save(os.path.join(out, f"{key}.jpg"), quality=80)
    print(key, len(res), flush=True)
