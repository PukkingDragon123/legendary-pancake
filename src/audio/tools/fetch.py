"""Download the audio3 sources (BigSoundBank pages + FLACs, NPS, archive.org) into scratchpad/audio3/raw
and record license evidence in raw/evidence.json. Usage: python3 -I fetch.py"""
import hashlib, html, json, os, re, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sources import BSB, OTHER

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'raw')
PAGES = os.path.join(ROOT, 'pages')
os.makedirs(RAW, exist_ok=True); os.makedirs(PAGES, exist_ok=True)
UA = 'Mozilla/5.0 (X11; Linux x86_64) sfx-build'
EVF = os.path.join(RAW, 'evidence.json')
ev = json.load(open(EVF)) if os.path.exists(EVF) else {}


def get(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return
    for k in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=120) as r, open(dest + '.tmp', 'wb') as fh:
                fh.write(r.read())
            os.replace(dest + '.tmp', dest)
            return
        except Exception as e:  # noqa
            print('retry', url, e)
            time.sleep(2 + k * 3)
    raise SystemExit('failed ' + url)


def sha(p):
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


def text_of(t):
    t = re.sub(r'<script.*?</script>|<style.*?</style>', '', t, flags=re.S)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t)))


for num, slug in BSB.items():
    sid = 'bsb_' + num
    page = f'https://bigsoundbank.com/{slug}-s{num}.html'
    pf = os.path.join(PAGES, sid + '.html')
    get(page, pf)
    t = open(pf, encoding='utf-8', errors='replace').read()
    tx = text_of(t)
    title = re.search(r'<h1[^>]*>(.*?)</h1>', t, re.S)
    title = text_of(title.group(1)).strip() if title else slug
    lic = re.search(r'License (CC0 \(public domain\)[^(]*)', tx)
    desc = ''
    m = re.search(r'Donations or merchandise purchases are appreciated\. Make a donation (.*?) Listen ', tx)
    if m: desc = m.group(1).strip()[:400]
    dur = re.search(r'0:00 / (\d+:\d+)', tx)
    if not lic:
        print('!! no CC0 line on', page); continue
    f = None
    for sub, ext in (('flac', 'flac'), ('bwf-en', 'wav'), ('mp3', 'mp3')):
        c = os.path.join(RAW, sid + '.' + ext)
        if os.path.exists(c): f = c; url = f'https://bigsoundbank.com/UPLOAD/{sub}/{num}.{ext}'; break
        if sub + '/' + ext in re.findall(r'UPLOAD/([a-z0-9-]+/)' + num + r'\.([a-z0-9]+)', t) or f'UPLOAD/{sub}/{num}.{ext}' in t:
            try:
                url = f'https://bigsoundbank.com/UPLOAD/{sub}/{num}.{ext}'; get(url, c); f = c; break
            except SystemExit as e:
                print('skip', e)
    if not f: print('!! no file for', sid); continue
    ev[sid] = {'site': 'bigsoundbank.com', 'title': title, 'author': 'Joseph Sardin', 'page': page,
               'url': url, 'license': 'CC0 1.0 Universal',
               'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
               'evidence': 'BigSoundBank page states: "License ' + lic.group(1).strip() + '"', 'desc': desc,
               'duration': dur.group(1) if dur else None, 'file': os.path.basename(f), 'sha256': sha(f), 'pageSha256': sha(pf)}
    print(sid, title, dur.group(1) if dur else '?')

for sid, o in OTHER.items():
    if o['kind'] == 'nps':
        f = os.path.join(RAW, sid + '.mp3'); get(o['url'], f)
        ev[sid] = {**{k: v for k, v in o.items() if k != 'kind'}, 'site': 'nps.gov', 'file': os.path.basename(f), 'sha256': sha(f),
                   'evidence': 'NPS media record ' + o['page'] + ' (credit "NPS Natural Sounds Program"); NPS website disclaimer: material created by the National Park Service is generally in the public domain'}
    elif o['kind'] == 'ia':
        meta = os.path.join(PAGES, sid + '.json')
        get('https://archive.org/metadata/' + o['ident'], meta)
        m = json.load(open(meta))
        mp3 = [x['name'] for x in m['files'] if x['name'].endswith('.mp3')][0]
        f = os.path.join(RAW, sid + '.mp3'); get(f"https://archive.org/download/{o['ident']}/{mp3}", f)
        ev[sid] = {**{k: v for k, v in o.items() if k not in ('kind', 'ident')}, 'site': 'archive.org', 'url': f"https://archive.org/download/{o['ident']}/{mp3}",
                   'file': os.path.basename(f), 'sha256': sha(f), 'evidence': 'archive.org item metadata licenseurl ' + m['metadata'].get('licenseurl', '')}
    print(sid, 'ok')

json.dump(ev, open(EVF, 'w'), indent=1)
print(len(ev), 'sources')
