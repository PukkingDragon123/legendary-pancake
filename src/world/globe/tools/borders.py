"""Country borders and the outlines of the places' countries for the globe, from Natural Earth (public domain).

    python3 -I src/world/globe/tools/borders.py <download dir>

Needs ne_50m_admin_0_boundary_lines_land.geojson and ne_50m_admin_0_map_units.geojson (Natural Earth 5.1.2, via
https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.2/geojson/) saved as ne50_bl.geojson and
ne50_units.geojson. Writes public/models/globe/borders.json:
  { "b": [line, ...],                      every land border between countries
    "c": { place id: { "n": name, "l": [lon, lat], "r": [ring, ...] } } }   the country each place is in
where a line or ring is a flat list of integers, lon then lat in hundredths of a degree, each after the first pair
stored as the difference from the previous one.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))

UNIT = {
    "highlands": ("Scotland", "Scotland"), "kyoto": ("Japan", "Japan"), "paris": ("France", "France"), "venice": ("Italy", "Italy"),
    "santorini": ("Greece", "Greece"), "sahara": ("Morocco", "Morocco"), "grandcanyon": ("United States of America", "United States"),
    "cappadocia": ("Turkey", "Türkiye"), "tajmahal": ("India", "India"), "iceland": ("Iceland", "Iceland"), "machupicchu": ("Peru", "Peru"),
    "amazon": ("Brazil", "Brazil"), "serengeti": ("Tanzania", "Tanzania"), "banff": ("Canada", "Canada"), "petra": ("Jordan", "Jordan"),
    "angkor": ("Cambodia", "Cambodia"), "reef": ("Australia", "Australia"), "rio": ("Brazil", "Brazil"), "milford": ("New Zealand", "New Zealand"),
    "antarctica": ("Antarctica", "Antarctica"),
}


def dp(pts, tol):
    """Douglas-Peucker simplification (iterative)."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L = (dx * dx + dy * dy) ** 0.5 or 1e-9
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / L if (dx or dy) else ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
            if d > best:
                best, bi = d, i
        if best > tol and bi > 0:
            keep[bi] = True
            stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]


def enc(pts):
    out, px, py = [], 0, 0
    for i, (x, y) in enumerate(pts):
        qx, qy = round(x * 100), round(y * 100)
        if i == 0:
            out += [qx, qy]
        else:
            if qx == px and qy == py:
                continue
            out += [qx - px, qy - py]
        px, py = qx, qy
    return out


def area(r):
    return abs(sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r)))) / 2


def main():
    src = sys.argv[1]
    bl = json.load(open(os.path.join(src, "ne50_bl.geojson")))
    lines = []
    for f in bl["features"]:
        g = f["geometry"]
        parts = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for p in parts:
            s = dp([tuple(c[:2]) for c in p], 0.03)
            if len(s) >= 2:
                lines.append(enc(s))
    units = json.load(open(os.path.join(src, "ne50_units.geojson")))
    by = {f["properties"]["NAME_LONG"] if f["properties"]["NAME"] == "United States of America" else f["properties"]["NAME"]: f for f in units["features"]}
    by["United States of America"] = next(f for f in units["features"] if f["properties"]["NAME"] == "United States of America")
    cs = {}
    for pid, (unit, name) in UNIT.items():
        f = by[unit]
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        big = max(area(p[0]) for p in polys)
        tol = 0.02 if big < 60 else 0.04 if big < 600 else 0.07
        rings = []
        for p in polys:
            r = [tuple(c[:2]) for c in p[0]]
            if area(r) < max(0.02, big * 0.0004):
                continue
            s = dp(r, tol)
            if len(s) >= 4:
                rings.append(enc(s))
        pr = f["properties"]
        cs[pid] = {"n": name, "l": [round(pr["LABEL_X"], 2), round(pr["LABEL_Y"], 2)], "r": rings}
    out = os.path.join(ROOT, "public", "models", "globe", "borders.json")
    json.dump({"b": lines, "c": cs}, open(out, "w"), separators=(",", ":"))
    print("borders.json", os.path.getsize(out) // 1024, "KB", len(lines), "lines", sum(len(l) for l in lines) // 2, "points")


if __name__ == "__main__":
    main()
