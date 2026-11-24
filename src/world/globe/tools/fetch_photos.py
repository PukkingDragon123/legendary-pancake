"""Find and download one free-licence photograph per place, with its credit.

    ~/.cache/lowpix-venv/bin/python src/world/globe/tools/fetch_photos.py <out_dir> [place ...]

For each place, takes the lead image of a few Wikipedia articles about it (Wikipedia's REST summary), checks the
image's Wikimedia Commons file page for its licence and author, keeps only public domain / CC0 / CC BY / CC BY-SA
landscape photos (skipping non-free local files), and downloads a 640 px thumbnail.
Writes <out_dir>/<place>.jpg and <out_dir>/credits.json. Slow on purpose (a couple of seconds per request).
"""
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.error
import urllib.request

UA = "HootHollowAssetScript/1.0 (offline game build; keeps photo credits)"
ARTICLES = {
    "highlands": ["Eilean_Donan", "Glen_Coe", "Buachaille_Etive_Mòr", "Scottish_Highlands"], "kyoto": ["Fushimi_Inari-taisha", "Kinkaku-ji"],
    "paris": ["Eiffel_Tower", "Champ_de_Mars", "Paris"], "venice": ["Grand_Canal_(Venice)", "Gondola", "Venice"], "santorini": ["Oia,_Greece", "Fira", "Santorini"],
    "sahara": ["Erg_Chebbi", "Sahara"], "grandcanyon": ["Grand_Canyon", "Grand_Canyon_National_Park"], "cappadocia": ["Göreme", "Cappadocia"],
    "tajmahal": ["Taj_Mahal"], "iceland": ["Kirkjufell", "Jökulsárlón"], "machupicchu": ["Machu_Picchu"],
    "amazon": ["Amazon_rainforest", "Amazon_River"], "serengeti": ["Serengeti_National_Park", "Serengeti"],
    "banff": ["Moraine_Lake", "Banff_National_Park"], "petra": ["Al-Khazneh", "Petra"], "angkor": ["Angkor_Wat"],
    "reef": ["Great_Barrier_Reef", "Heart_Reef"], "rio": ["Sugarloaf_Mountain", "Rio_de_Janeiro"],
    "milford": ["Milford_Sound", "Mitre_Peak_(New_Zealand)"], "antarctica": ["Antarctic_Peninsula", "Paradise_Harbor", "Emperor_penguin", "Neko_Harbour", "Iceberg"],
}


def get(url, raw=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    err = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                data = r.read()
            time.sleep(6.0)
            return data if raw else json.loads(data)
        except urllib.error.HTTPError as e:  # a missing page is final; a rate limit backs off
            if e.code == 404:
                raise
            err = e
            time.sleep(45 + attempt * 60)
        except Exception as e:  # a hiccup: back off
            err = e
            time.sleep(45 + attempt * 60)
    raise err


def strip(s):
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def commons_info(fname):
    page = get(f"https://commons.wikimedia.org/wiki/File:{urllib.parse.quote(fname)}", raw=True).decode("utf-8", "replace")
    shorts = [strip(m) for m in re.findall(r'licensetpl&#95;short"[^>]*>(.*?)</span>', page)]
    lic = None
    for s_ in shorts:
        if re.match(r"(CC0|Public domain|PD|CC BY(-SA)? [0-9.]+)", s_, re.I):
            lic = s_
            break
    if not lic:
        return None
    m = re.search(r'id="fileinfotpl&#95;aut"[^>]*>.*?</td>\s*<td[^>]*>(.*?)</td>', page, re.S)
    author = strip(m.group(1))[:120] if m else "unknown"
    author = re.sub(r"\s*\(talk\)|\s*Talk$", "", author)
    return {"licence": lic, "author": author}


def choose(place):
    for art in ARTICLES[place]:
        try:
            s = get(f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(art)}")
        except Exception:
            continue
        th, orig = s.get("thumbnail"), s.get("originalimage")
        if not th or not orig or "/commons/" not in orig["source"]:
            continue
        if th["width"] < th["height"] * 1.2:
            continue
        parts = orig["source"].split("?")[0].split("/")
        fname = urllib.parse.unquote(parts[-2] if "/thumb/" in orig["source"] else parts[-1])   # big originals come as a thumb path
        if not fname.lower().endswith((".jpg", ".jpeg")):   # photographs only (no maps or diagrams)
            continue
        try:
            info = commons_info(fname)
        except Exception:
            info = None
        if not info:
            continue
        thumb = re.sub(r"/\d+px-", "/500px-", th["source"].split("?")[0]) if orig.get("width", 0) > 500 else orig["source"].split("?")[0]   # a standard thumb width
        return {"title": "File:" + fname, "article": art, "thumb": thumb, "thumb0": th["source"].split("?")[0], "url": f"https://commons.wikimedia.org/wiki/File:{urllib.parse.quote(fname)}", **info}
    return None


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    cpath = os.path.join(out, "credits.json")
    credits = json.load(open(cpath)) if os.path.exists(cpath) else {}
    for p in sys.argv[2:] or list(ARTICLES):
        try:
            c = choose(p)
            if not c:
                print(p, "nothing suitable", flush=True)
                continue
            try:
                data = get(c["thumb"], raw=True)
            except Exception:
                data = get(c["thumb0"], raw=True)   # the summary's own thumbnail size always exists
            open(os.path.join(out, f"{p}.jpg"), "wb").write(data)
        except Exception as e:
            print(p, "failed", e, flush=True)
            continue
        credits[p] = c
        json.dump(credits, open(cpath, "w"), indent=1, ensure_ascii=False)
        print(p, c["title"], c["licence"], c["author"], flush=True)


if __name__ == "__main__":
    main()
