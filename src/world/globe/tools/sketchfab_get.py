"""Download chosen Sketchfab models as GLB. python3 -I sfget.py <sf dir> <outdir> id=key:index ..."""
import json, os, sys, time, urllib.request

sf, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
meta = {}
mp = os.path.join(out, "meta.json")
if os.path.exists(mp):
    meta = json.load(open(mp))


def get(url, raw=False):
    req = urllib.request.Request(url, headers={"User-Agent": "HootHollowAssetScript/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        d = r.read()
    return d if raw else json.loads(d)


for arg in sys.argv[3:]:
    sid, spec = arg.split("=")
    key, idx = spec.split(":")
    c = json.load(open(os.path.join(sf, f"{key}.json")))[int(idx)]
    f = os.path.join(out, f"{sid}.glb")
    if not os.path.exists(f):
        d = get(f"https://api.sketchfab.com/v3/models/{c['uid']}/download")
        g = d.get("glb") or {}
        if not g:
            print(sid, "no glb", list(d))
            continue
        open(f, "wb").write(get(g["url"], raw=True))
        time.sleep(1)
    info = get(f"https://api.sketchfab.com/v3/models/{c['uid']}")
    meta[sid] = {"name": c["name"], "user": info["user"]["displayName"], "username": info["user"]["username"], "uid": c["uid"],
                 "url": info.get("viewerUrl"), "license": info.get("license", {}).get("label"), "faces": c["faces"]}
    json.dump(meta, open(mp, "w"), indent=1, ensure_ascii=False)
    print(sid, os.path.getsize(f) // 1024, "KB", meta[sid]["license"], meta[sid]["user"], flush=True)
