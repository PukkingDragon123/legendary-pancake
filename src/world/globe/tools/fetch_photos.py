"""Find and download one free-licence photograph per place from Wikimedia Commons, with its credit.

    ~/.cache/lowpix-venv/bin/python src/world/globe/tools/fetch_photos.py <out_dir> [place ...]

Searches Commons (REST search), reads each candidate's wikitext for its licence and author, keeps only
public domain / CC0 / CC BY / CC BY-SA files that are landscape, and downloads a 640 px thumbnail.
Writes <out_dir>/<place>.jpg and <out_dir>/credits.json. Slow on purpose (about one request a second).
A pinned file name in PICK skips the search for that place.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

UA = "HootHollowAssetScript/1.0 (offline game build; keeps photo credits)"
BASE = "https://commons.wikimedia.org"

QUERIES = {
    "highlands": "Glen Coe Scotland valley", "kyoto": "Fushimi Inari Taisha torii", "paris": "Eiffel Tower Champ de Mars",
    "venice": "Venice Grand Canal gondolas", "santorini": "Oia Santorini blue domes", "sahara": "Erg Chebbi dunes Morocco",
    "grandcanyon": "Grand Canyon South Rim view", "cappadocia": "Cappadocia hot air balloons Goreme", "tajmahal": "Taj Mahal Agra",
    "iceland": "aurora borealis Iceland", "machupicchu": "Machu Picchu Huayna Picchu", "amazon": "Amazon rainforest river",
    "serengeti": "Serengeti National Park acacia", "banff": "Moraine Lake Banff", "petra": "Petra Al-Khazneh Treasury",
    "angkor": "Angkor Wat sunrise", "reef": "Great Barrier Reef aerial", "rio": "Sugarloaf Mountain Rio de Janeiro",
    "milford": "Milford Sound Mitre Peak", "antarctica": "Antarctica penguins iceberg",
}
PICK = {}   # place -> "File:..." to pin a choice
OK_LICENCE = re.compile(r"\{\{\s*(self\s*\|[^}]*)?(cc-zero|cc0|pd-[a-z0-9-]+|public domain|cc-by-sa-[0-9.]+[a-z,-]*|cc-by-[0-9.]+[a-z,-]*)", re.I)


def get(url, raw=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
            time.sleep(3.0)
            return data if raw else json.loads(data)
        except Exception as e:  # rate limit or a hiccup: back off
            time.sleep(30 + attempt * 45)
            err = e
    raise err


def licence_of(wikitext):
    lic = []
    for m in re.finditer(r"\{\{\s*(?:self\s*\|)?([^{}|]+)", wikitext, re.I):
        t = m.group(1).strip().lower()
        if t.startswith(("cc-zero", "cc0")):
            lic.append("CC0 1.0")
        elif t.startswith("pd-"):
            lic.append("Public domain")
        elif re.match(r"cc-by-sa-[0-9.]+", t):
            lic.append("CC BY-SA " + re.match(r"cc-by-sa-([0-9.]+)", t).group(1))
        elif re.match(r"cc-by-[0-9.]+", t):
            lic.append("CC BY " + re.match(r"cc-by-([0-9.]+)", t).group(1))
    # {{self|cc-by-sa-4.0|GFDL}} style: the licences sit in the self template's arguments
    for m in re.finditer(r"\{\{\s*self\s*\|([^}]*)\}\}", wikitext, re.I):
        for a in m.group(1).split("|"):
            a = a.strip().lower()
            if re.match(r"cc-by-sa-[0-9.]+", a):
                lic.append("CC BY-SA " + re.match(r"cc-by-sa-([0-9.]+)", a).group(1))
            elif re.match(r"cc-by-[0-9.]+", a):
                lic.append("CC BY " + re.match(r"cc-by-([0-9.]+)", a).group(1))
            elif a.startswith(("cc-zero", "cc0")):
                lic.append("CC0 1.0")
    order = ["CC0 1.0", "Public domain"]
    lic = sorted(set(lic), key=lambda x: (0 if x in order else 1 if x.startswith("CC BY ") else 2, x))
    return lic[0] if lic else None


def clean(s):
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"\[https?://\S+\s+([^\]]*)\]", r"\1", s)
    s = re.sub(r"\{\{[^{}]*\|([^{}|]*)\}\}", r"\1", s)
    s = re.sub(r"<[^>]+>|\{\{|\}\}|'''|''", "", s)
    return re.sub(r"\s+", " ", s).strip()[:120]


def author_of(wt):
    m = re.search(r"\|\s*[Aa]uthor\s*=\s*(.+)", wt)
    return clean(m.group(1)) if m else "unknown"


def choose(place):
    titles = [PICK[place]] if place in PICK else []
    if not titles:
        q = urllib.parse.quote(QUERIES[place] + " filetype:bitmap")
        res = get(f"{BASE}/w/rest.php/v1/search/page?q={q}&limit=12")
        # landscape only, judged from the search thumbnail (saves a request per candidate)
        titles = [p["title"] for p in res.get("pages", []) if p["title"].lower().endswith((".jpg", ".jpeg"))
                  and (p.get("thumbnail") or {}).get("width", 0) >= 1.2 * (p.get("thumbnail") or {}).get("height", 1)]
    for t in titles:
        page = get(f"{BASE}/w/rest.php/v1/page/{urllib.parse.quote(t.replace(' ', '_'))}")
        wt = page.get("source", "")
        lic = licence_of(wt)
        if not lic or re.search(r"\{\{\s*(nopermission|copyvio|delete|no license)", wt, re.I):
            continue
        return {"title": t, "licence": lic, "author": author_of(wt), "url": f"{BASE}/wiki/{urllib.parse.quote(t.replace(' ', '_'))}"}
    return None


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    cpath = os.path.join(out, "credits.json")
    credits = json.load(open(cpath)) if os.path.exists(cpath) else {}
    places = sys.argv[2:] or list(QUERIES)
    for p in places:
        try:
            c = choose(p)
        except Exception as e:
            print(p, "failed", e, flush=True)
            continue
        if not c:
            print(p, "nothing suitable", flush=True)
            continue
        img = get(f"{BASE}/wiki/Special:FilePath/{urllib.parse.quote(c['title'][5:].replace(' ', '_'))}?width=640", raw=True)
        open(os.path.join(out, f"{p}.jpg"), "wb").write(img)
        credits[p] = c
        json.dump(credits, open(cpath, "w"), indent=1, ensure_ascii=False)
        print(p, c["title"], c["licence"], c["author"], flush=True)


if __name__ == "__main__":
    main()
