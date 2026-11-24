"""Rebuild docs/AUDIO-CREDITS.md and the license evidence for the audio3 sprites and new sounds.
usage: python3 -I credits_doc.py <worktree>"""
import json, os, re, sys, glob, hashlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec import NEW, AMB, SCR, BUSHED

WT = sys.argv[1]
SFX = WT + '/public/sfx'
DOC = WT + '/docs/AUDIO-CREDITS.md'
TODAY = '2026-11-24'
man = json.load(open(SFX + '/manifest.json'))
cred = json.load(open(SFX + '/credits.json'))
ev = json.load(open(SCR + '/audio3/raw/evidence.json'))
old = open(DOC, encoding='utf-8').read()
if 'audio3' in old:  # rebuilding: start from the pre-audio3 doc
    old = open(SCR + '/audio3/work/AUDIO-CREDITS.v1.md', encoding='utf-8').read()
else:
    open(SCR + '/audio3/work/AUDIO-CREDITS.v1.md', 'w', encoding='utf-8').write(old)

mp3 = sorted(glob.glob(SFX + '/*.mp3'))
n_members = sum(len(p['clips']) for p in man.get('packs', {}).values())
mb = sum(os.path.getsize(f) for f in mp3) / 1048576
nids = len(man['sounds'])
new_ids = set(NEW) | set(AMB)
n_clips = sum(len(s['clips']) for s in man['sprites'].values())

# ------------------------------------------------------------------ old sources table: keep its evidence column
old_src = {}
sec = old[old.index('## Sources'):old.index('## File by file')]
for line in sec.splitlines():
    m = re.match(r'\| \[(.*?)\]\((.*?)\) \((.*?)\) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$', line)
    if m: old_src[m.group(2)] = dict(title=m.group(1), site=m.group(3), author=m.group(4), lic=m.group(5), evidence=m.group(6))


def lic_bucket(c):
    l = c['license']
    if c['title'].startswith('BUSHED'): return 'BUSHED'
    return l


def where(c):
    return f"`{c['file']}#{c['clip']}`" if c.get('clip') else f"`{c['file']}`"


# group rows by source
groups = {}
for c in cred:
    key = c['sourceUrl']
    g = groups.setdefault(key, {'c': c, 'rows': []})
    g['rows'].append(c)
    for x in c.get('alsoFrom', []):
        g2 = groups.setdefault(x['sourceUrl'], {'c': x, 'rows': []})
        g2['rows'].append({**c, '_layer': True})

src_lines = []
for key, g in sorted(groups.items(), key=lambda kv: kv[1]['c']['title'].lower()):
    c = g['c']
    outs = ', '.join(sorted({where(r) + (' (layer)' if r.get('_layer') else '') for r in g['rows']}))
    if key in old_src:
        o = old_src[key]
        src_lines.append(f"| [{o['title']}]({key}) ({o['site']}) | {o['author']} | {o['lic']} | {o['evidence']} | {outs} |")
    elif c['title'].startswith('BUSHED'):
        ups = c.get('upstream', [])
        up = '; '.join(f"[{u['title']}]({u['page']}) ({u['author']}, {u['license']})" for u in ups)
        src_lines.append(f"| {c['title']} (`{c['sourceUrl']}`) | {c['author']} | {c['license']} | ({TODAY}) BUSHED `CREDITS.md` (Sound) and `tools/sounds/recipes.json`: this event is built only from {up} | {outs} |")
    else:
        e = next((v for v in ev.values() if v.get('page') == key), None)
        evid = f"({TODAY}) " + (e['evidence'] + f"; page sha256 {e['pageSha256'][:12]}…, file sha256 {e['sha256'][:12]}…" if e else 'source page license field')
        lic = f"[{c['license']}]({c['licenseUrl']})" if c.get('licenseUrl') else c['license']
        site = c['source'].split(' (')[0] if c['source'].startswith('BigSoundBank') else c['source']
        src_lines.append(f"| [{c['title']}]({key}) ({site}) | {c['author']} | {lic} | {evid} | {outs} |")

# ------------------------------------------------------------------ file-by-file table
def cat_of(c):
    return man['sounds'].get(c['id'], {}).get('category', '')


file_rows = []
for c in cred:
    e = man['sounds'].get(c['id'], {})
    src = f"[{c['title']}]({c['sourceUrl']})" if c['sourceUrl'].startswith('http') else f"{c['title']} (`{c['sourceUrl']}`)"
    also = ''
    if c.get('alsoFrom'):
        also = '; also layered: ' + '; '.join(f"{x['title']} ({x['author']}, {x['license']}, `{x['originalFile']}`)" for x in c['alsoFrom'])
    file_rows.append(f"| `{c['file']}` | {('`' + c['clip'] + '`') if c.get('clip') else ''} | `{c['id']}` | {cat_of(c)} | {'yes' if e.get('loop') else 'no'} | {src} | {c['author']} | {c['license']} | `{c.get('originalFile', '')}` | {c['edits']}{also} |")

# ------------------------------------------------------------------ licence counts
from collections import Counter
cnt = Counter(lic_bucket(c) for c in cred)
lic_rows = []
for k, n in sorted(cnt.items(), key=lambda kv: -kv[1]):
    if k == 'BUSHED':
        lic_rows.append(f"| From BUSHED (the project owner's game): its files are made only from CC0 1.0, Public Domain Mark 1.0 and U.S. federal (NPS / USFWS) public-domain recordings | {n} | No. Upstream authors are listed per clip in `credits.json` (`upstream`) and in the Sources table |")
    elif k.startswith('CC0'):
        lic_rows.append(f"| {k} | {n} | No. CC0 waives it; several authors say a credit is appreciated |")
    elif 'National Park' in k:
        lic_rows.append(f"| {k} | {n} | Not a legal condition, but NPS asks: please credit the \"National Park Service\" where appropriate |")
    else:
        lic_rows.append(f"| {k} | {n} | No. The creator dedicated the recording to the public domain |")

# ------------------------------------------------------------------ assemble
head = old[:old.index('## Licenses at a glance')]
head = re.sub(r'Sound effects, ambience loops and music shipped in `public/sfx/` \(.*?\)\.',
              f'Sound effects, ambience loops and music shipped in `public/sfx/` ({len(mp3)} MP3 files: {len(man["sprites"])} audio sprites holding {n_clips} short clips and {len(man.get("packs", {}))} file packs holding {n_members} loops, music tracks and alarms; {nids} sound ids, {mb:.2f} MB).',
              head)
head = head.rstrip('\n') + f"\n\n**{TODAY} (audio3):** {len(new_ids)} new sound ids (owl calls per species, the moving boxes, furniture by material, the shop till and door bell, gacha shimmer and reveal chimes, book, globe, Pip's hops by surface, birds, frogs, thunder, wind gusts, particle pops, hand-made transition whooshes, wood/paper/brass UI ticks) and 6 new ambience beds (dawn/day forest, dusk thrushes, night peepers, rain on the roof, room tone with a wood stove, snow hush). Short sounds, old and new, are now packed into category **audio sprites** (`sfx_*.mp3`; clip offsets in `manifest.json` under `sprites`, a file entry `sfx_home.mp3#box_tape_2` names a clip), and the loops, music and alarms into three **file packs** (`pack_beds/sleep/music.mp3`: the original MP3 files stored back to back, byte for byte; byte ranges under `packs`, a file entry `pack_beds.mp3#amb_rain` names a member) so the artifact ships 11 files here instead of 140. The license evidence files moved to `docs/audio-licenses/`. Every new sound is cut from a recording by Joseph Sardin (BigSoundBank, CC0), from the project owner's game BUSHED (itself made from CC0 / public-domain recordings, credited below), or from packs already listed here (Kenney, rubberduck). Nothing was synthesised.\n\n"

lic = '## Licenses at a glance\n\nCounted per row of `credits.json` (one row per sprite clip or loop file).\n\n| License | Rows | Attribution required? |\n|---|---|---|\n' + '\n'.join(lic_rows) + '\n\nNo file uses CC-BY, CC-BY-SA, NC, ND, GPL or a custom "royalty-free" license.\n\n'
m = re.search(r'(### Suggested credits line.*?\n\n> .*?\n)', old, re.S)
line = m.group(1).rstrip('\n')
line = line.replace('; wind, owl,', '; foley, owls, bells, chimes and wind by Joseph Sardin (BigSoundBank.com, CC0); forest, rain, fire, thunder, bird and owl sounds from the BUSHED sound library (recordings by Joseph Sardin, Radio Aporee ::: Maps contributors (Matt Rogalsky, NAISA, Felix Blume, darren, James Bailey, alas23/sala), the National Park Service and the U.S. Fish and Wildlife Service); wind, owl,')
srcs = '## Sources\n\n| Source | Author | License | Evidence read | Output (file or sprite clip) |\n|---|---|---|---|---|\n' + '\n'.join(src_lines) + '\n\n'
files = '## File by file\n\nOne row per clip of an audio sprite (`file` + `clip`) or per loop file.\n\n| File | Clip | Id | Category | Loop | Source title | Author | License | Original file | Edits |\n|---|---|---|---|---|---|---|---|---|---|\n' + '\n'.join(file_rows) + '\n\n'
tail = old[old.index('## How licenses were verified'):]
add_verify = f"""### {TODAY} additions (audio3)

- **BigSoundBank** (`bigsoundbank.com`, Joseph Sardin): every sound page used was downloaded and read; each states "License CC0 (public domain): Free and royalty-free". The site's license page (`https://bigsoundbank.com/licenses.html`) says sounds marked "Free and royalty-free" are "Creative Commons CC0 1.0 Universal". The statement is quoted in `public/sfx/licenses/bigsoundbank-and-bushed.txt`; page and file sha256 hashes are in `source-license-evidence.json` (`audio3` block). Files were taken as FLAC (WAV/MP3 where no FLAC was offered).
- **BUSHED** (`lpx-bushed/games/bushed/public/assets/sfx`, the project owner's game): its `CREDITS.md` says every file there is made by its `tools/sounds/build_sounds.py` from CC0 and public-domain recordings, plus "a little procedural synthesis (numpy noise, tones, thumps)". Its `tools/sounds/recipes.json` shows which events use a synthesised layer (`axe_chop`, `foot_grass`, `foot_forest`, `foot_land`, `foot_porch`, `branch_swish`, `bottle_set`, `amb_store`, `amb_drone` and a few others): **none of those were used**. Only events built purely from recordings were taken; each clip's upstream recordings (title, author, licence, page) are copied into `credits.json` (`upstream`) from BUSHED's recipes, and BUSHED's sound credits are excerpted in `public/sfx/licenses/bigsoundbank-and-bushed.txt`.
- No owl recording in the public domain was found for the snowy owl, Eurasian eagle-owl, great grey owl, burrowing owl, saw-whet owl or little owl (NPS's eastern screech owl file is gone, 404). Those species call with a close relative's real recording, played a little slower or faster (`OWL_CALL` in `src/audio/sound.ts`): snowy -> long-eared owl, eagle-owl -> great horned owl, great grey -> barred/spotted owl (`owl_barred`, the NPS spotted owl), small owls -> the tawny owl's "ke-wick".
- Wikimedia Commons owl recordings were not used: the ones found are xeno-canto uploads under CC BY-SA, or of unclear origin.

"""
tail = tail.replace('### What could not be checked', add_verify + '### What could not be checked', 1)
tail = tail.rstrip('\n') + f"""
- {TODAY} (audio3): short sounds live in audio sprites, mono 44.1 kHz MP3 (80 kbps; `sfx_weather` 64 kbps), decoded whole (at 32 kHz). Loops, music and alarms live in file packs: each member is a complete MP3 (with its own LAME header), fetched with an HTTP range request (or sliced from the whole pack when the host ignores ranges) and decoded on its own. Clips are separated by 0.3 s of silence; the build decodes each sprite again and checks the clip offsets by cross-correlation (no shift: ffmpeg/LAME's encoder delay is trimmed by the Info header, as browsers do). `src/audio/sprites.test.ts` checks every clip against the encoded length, every id the code asks for, and that every clip has a credit row.
- {TODAY}: older one-shots were decoded from their MP3s and re-encoded into the sprites (one more generation of MP3; gains unchanged); older loops, music and alarms are unchanged, byte for byte, inside the packs. The new ambience beds are 40 s stereo MP3s at 64 kbps (rain on the roof 80 kbps), about -24 to -27 LUFS, 0.5 s fades; the app crossfades them. `bed_rain`, `bed_wind`, `bed_stream` and `bed_fire` are manifest aliases of `amb_rain/amb_wind/amb_stream/amb_fire` so the day ambience and the night soundscape keep separate loops of the same file.
- {TODAY}: new sounds were again chosen by measuring envelopes, pitch and spectrum, not by ear. Worth a listening pass: `owl_barn` (a real barn owl screech, low-passed at 3.8 kHz and kept quiet), `amb_snow` (quiet forest wind raised 18 dB and low-passed), `wind_gust_3` (raised 26 dB).
"""
doc = head + lic + old[old.index('### Suggested credits line'):old.index('## Sources')].replace(m.group(1).rstrip('\n'), line) + srcs + files + tail
doc = doc.replace('public/sfx/licenses/', 'docs/audio-licenses/').replace('`public/sfx/licenses`', '`docs/audio-licenses`')
open(DOC, 'w', encoding='utf-8').write(doc)
print('doc', len(doc.splitlines()), 'lines;', dict(cnt))

# ------------------------------------------------------------------ license evidence
LIC = WT + '/docs/audio-licenses'
pg = open(SCR + '/audio3/pages/bsb_licenses.html', encoding='utf-8', errors='replace').read()
bush = open(BUSHED + '/CREDITS.md', encoding='utf-8').read()
bsec = bush[bush.index('## Sound'):bush.index('## Creatures')]
txt = f"""Audio sources added on {TODAY} (audio3). See docs/AUDIO-CREDITS.md and public/sfx/credits.json.

1. BigSoundBank (https://bigsoundbank.com), recordings by Joseph Sardin
   Every sound page used states: "License CC0 (public domain): Free and royalty-free".
   License page https://bigsoundbank.com/licenses.html (retrieved {TODAY}, sha256 {hashlib.sha256(pg.encode('utf-8', 'replace')).hexdigest()}), verbatim:

     "You are allowed to: Share, copy, distribute and communicate the material by all means and in all formats.
      Adapt, remix, transform and create from material. Use, including for commercial purposes. Without any
      restrictions. Without asking permission. This is: Creative Commons CC0 1.0 Universal WTFPL license ...
      Public Domain Dedication."
     "All files whose download page mentions "Free and Royalty Free" are made available free of charge and freely
      for all your projects, whether commercial or not, and worldwide."

2. BUSHED (the project owner's game; lpx-bushed/games/bushed). The files used come from public/assets/sfx and are
   built by its tools/sounds/build_sounds.py. Only events made purely from recordings were used (no event with a
   synthesised layer). Its sound credits, verbatim:

{bsec}"""
open(LIC + '/bigsoundbank-and-bushed.txt', 'w', encoding='utf-8').write(txt)
E = json.load(open(LIC + '/source-license-evidence.json'))
E['audio3'] = {'checked': TODAY, 'note': 'BigSoundBank pages and files downloaded and read on ' + TODAY + '; the BUSHED clips carry their upstream sources in credits.json.',
               'sources': {k: {x: v[x] for x in ('title', 'author', 'page', 'url', 'license', 'evidence', 'desc', 'sha256', 'pageSha256') if x in v} for k, v in ev.items()}}
json.dump(E, open(LIC + '/source-license-evidence.json', 'w'), indent=1, ensure_ascii=False)
r = open(LIC + '/README.md', encoding='utf-8').read()
if 'bigsoundbank-and-bushed' not in r:
    r = r.replace('# License files for `public/sfx`', '# License files for `public/sfx` (kept here, out of the shipped app, since 2026-11-24)')
    r = r.replace("| `source-license-evidence.json` |", "| `bigsoundbank-and-bushed.txt` | (" + TODAY + ") the BigSoundBank license statement (CC0) and the sound credits of BUSHED, the project owner's game, whose recording-only sounds were borrowed |\n| `source-license-evidence.json` |")
    open(LIC + '/README.md', 'w', encoding='utf-8').write(r)
print('licenses ok')
