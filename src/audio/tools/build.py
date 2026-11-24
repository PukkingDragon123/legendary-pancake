"""audio3 build: render the new clips, pack every short sound into category sprites, cut the new
ambience beds, and write manifest.json + credits.json into public/sfx.
usage: python3 -I build.py <worktree>"""
import glob, hashlib, json, os, re, subprocess, sys, shutil
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec import NEW, AMB, ALIAS, OLD_SPRITE, OLD_FOLEY, SPRITE_FILE, SPRITE_KBPS, PACKS, PATHS, BUSHED, SCR

WT = sys.argv[1]
SFX = os.path.join(WT, 'public', 'sfx')
WORK = SCR + '/audio3/work'
os.makedirs(WORK, exist_ok=True)
SR = 44100
LEAD, GAP = 0.05, 0.3          # silence before the first clip / between clips in a sprite
EV = json.load(open(PATHS['raw'] + '/evidence.json'))
RECIPES = json.load(open(BUSHED + '/tools/sounds/recipes.json'))
OLD_MAN = json.load(open(SFX + '/manifest.json'))
OLD_CRED = json.load(open(SFX + '/credits.json'))
if OLD_MAN.get('version') == 2:
    # rebuilding: start again from the pre-audio3 state kept in the work folder
    OLD_MAN = json.load(open(WORK + '/manifest.v1.json')); OLD_CRED = json.load(open(WORK + '/credits.v1.json'))
else:
    json.dump(OLD_MAN, open(WORK + '/manifest.v1.json', 'w'), indent=1); json.dump(OLD_CRED, open(WORK + '/credits.v1.json', 'w'), indent=1)
    os.makedirs(WORK + '/v1', exist_ok=True)
    for f in glob.glob(SFX + '/*.mp3'): shutil.copy(f, WORK + '/v1/')
V1 = WORK + '/v1'


def path_of(src):
    kind, name = src.split(':', 1)
    if kind == 'bsb': return glob.glob(PATHS['raw'] + f'/bsb_{name}.*')[0]
    if kind == 'bu': return PATHS['bu'] + '/' + name + '.ogg'
    if kind == 'kenney': return PATHS['kenney'] + '/' + name + '.ogg'
    if kind == 'rd': return PATHS['rd'] + '/' + name + '.ogg'
    raise ValueError(src)


def decode(path, t=0.0, d=None, ch=1, af=''):
    cmd = ['ffmpeg', '-v', 'error', '-ss', f'{t:.4f}']
    if d: cmd += ['-t', f'{d:.4f}']
    cmd += ['-i', path]
    if af: cmd += ['-af', af]
    cmd += ['-ac', str(ch), '-ar', str(SR), '-f', 'f32le', '-']
    x = np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32).copy()
    return x.reshape(-1, ch) if ch > 1 else x


def db(x): return 20 * np.log10(max(1e-9, float(np.abs(x).max())))


def render(v, top=True):
    """One variant -> mono float32 at SR, plus a list of the edits made."""
    edits = []
    af = []
    p = v.get('pitch', 1.0)
    if p != 1.0:
        af += [f'asetrate={int(SR * p)}', f'aresample={SR}']
        edits.append(f'playback rate x{p:g} (pitch and speed)')
    if v.get('hp'): af.append(f"highpass=f={v['hp']}"); edits.append(f"high-pass {v['hp']} Hz")
    if v.get('lp'): af.append(f"lowpass=f={v['lp']}"); edits.append(f"low-pass {v['lp']} Hz")
    x = decode(path_of(v['src']), v.get('t', 0), v.get('d'), 1, ','.join([f'aresample={SR}'] + af))
    if v.get('t') or v.get('d'):
        edits.insert(0, f"cut {v.get('t', 0):.2f}-{(v.get('t', 0) + (v['d'] or 0)):.2f} s of the source" if v.get('d') else f"from {v.get('t', 0):.2f} s")
    for (w, gap) in v.get('concat', []):
        y, _ = render(w, False)
        x = np.concatenate([fade(x, 0, 0.04), np.zeros(int(gap * SR), np.float32), fade(y, 0.01, 0.04)])
        edits.append(f"joined with {w['src']} {w.get('t', 0):.2f}-{w.get('t', 0) + (w.get('d') or 0):.2f} s after a {gap:.1f} s pause (shortened gap between calls)")
    for (w, off, g) in v.get('layers', []):
        y, _ = render(w, False)
        y = y / max(1e-9, np.abs(y).max()) * np.abs(x).max() * 10 ** (g / 20)
        o = int(off * SR)
        n = max(len(x), o + len(y))
        z = np.zeros(n, np.float32); z[:len(x)] += x; z[o:o + len(y)] += y; x = z
        edits.append(f"layered with {w['src']} ({w.get('t', 0):.2f}-{w.get('t', 0) + (w.get('d') or 0):.2f} s, {g:+d} dB, +{off:.2f} s)")
    if top:
        # trim leading/trailing near-silence, fades, peak normalise
        a = np.abs(x)
        thr = a.max() * 10 ** (-45 / 20)
        idx = np.where(a > thr)[0]
        s0 = max(0, idx[0] - int(0.004 * SR)) if len(idx) else 0
        s1 = min(len(x), idx[-1] + int(0.03 * SR)) if len(idx) else len(x)
        if s0 > 0: edits.append(f'leading silence trimmed ({s0 / SR * 1000:.0f} ms)')
        x = x[s0:s1]
        fo = v.get('fo') or min(0.2, max(0.01, len(x) / SR * 0.25))
        x = fade(x, v.get('fi', 0.003), fo)
        edits.append(f'{fo * 1000:.0f} ms fade-out' + (f", {v['fi'] * 1000:.0f} ms fade-in" if v.get('fi', 0) > 0.01 else ''))
        pk = v.get('peak', -3)
        g = pk - db(x)
        x = (x * 10 ** (g / 20)).astype(np.float32)
        edits.append(f'peak-normalised to {pk} dBFS ({g:+.1f} dB)')
    return x.astype(np.float32), edits


def fade(x, fi, fo):
    x = x.copy()
    n_in, n_out = int(fi * SR), int(fo * SR)
    if n_in > 1: x[:n_in] *= np.linspace(0, 1, n_in) ** 2
    if n_out > 1 and n_out < len(x): x[-n_out:] *= np.linspace(1, 0, n_out) ** 1.5
    return x


def write_wav(path, x):
    ch = 1 if x.ndim == 1 else x.shape[1]
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', '-', path], input=x.astype(np.float32).tobytes(), check=True)


def encode(src, dst, kbps, ch):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', str(ch), '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', '-id3v2_version', '0', '-write_xing', '1', dst], check=True)


# ------------------------------------------------------------------ source credits
def bushed_event(name):
    base = os.path.basename(name)
    ev = re.sub(r'_\d+$', '', base)
    return ev


def credit_for(src):
    kind, name = src.split(':', 1)
    if kind == 'bsb':
        e = EV['bsb_' + name]
        return dict(title=e['title'], author='Joseph Sardin', source='BigSoundBank (bigsoundbank.com)', sourceUrl=e['page'], license='CC0 1.0 Universal',
                    licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/', originalFile=os.path.basename(e['url']))
    if kind == 'kenney':
        return dict(title='RPG Audio ("50 RPG sound effects")', author='Kenney (www.kenney.nl)', source='OpenGameArt.org', sourceUrl='https://opengameart.org/content/50-rpg-sound-effects',
                    license='CC0 1.0 Universal', licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/', originalFile=name + '.ogg')
    if kind == 'rd':
        return dict(title='100 CC0 metal and wood SFX', author='rubberduck', source='OpenGameArt.org', sourceUrl='https://opengameart.org/content/100-cc0-metal-and-wood-sfx',
                    license='CC0 1.0 Universal', licenseUrl='https://creativecommons.org/publicdomain/zero/1.0/', originalFile=name + '.ogg')
    if kind == 'bu':
        ev = bushed_event(name)
        rec = RECIPES['events'][ev]
        srcs = sorted(set(re.findall(r'"src": "([a-z0-9_]+)"', json.dumps(rec))))
        up = []
        for s in srcs:
            o = RECIPES['sources'][s]
            up.append(dict(title=o['title'], author=o.get('author', ''), site=o.get('site', ''), page=o.get('page', ''), license=o.get('license', '')))
        lic = sorted(set(u['license'] for u in up))
        authors = sorted(set(u['author'] for u in up if u['author']))
        return dict(title=f'BUSHED sound library: {os.path.basename(name)}.ogg (event "{ev}")', author='BUSHED (the project owner\'s game), from recordings by ' + ', '.join(authors),
                    source='BUSHED (games/bushed/public/assets/sfx, built by its tools/sounds/build_sounds.py from CC0 / public-domain recordings)',
                    sourceUrl='lpx-bushed/games/bushed/public/assets/sfx/' + name + '.ogg', license=' + '.join(lic),
                    licenseUrl='', originalFile=name + '.ogg', upstream=up)
    raise ValueError(src)


def all_srcs(v):
    out = [v['src']]
    for (w, _) in v.get('concat', []): out += all_srcs(w)
    for (w, _, _) in v.get('layers', []): out += all_srcs(w)
    return out


# ------------------------------------------------------------------ gather sprite contents
sprites = {k: [] for k in SPRITE_FILE}       # sprite -> [(clipname, array(mono or stereo), credit dict)]
manifest = {'version': 2, 'sprites': {}, 'sounds': {}}
credits = []

# 1. existing one-shots and alarms
old_files = {}
loose = {}   # loop id -> (mp3 path, manifest entry, credit rows)
for c in OLD_CRED: old_files.setdefault(c['id'], []).append(c)
for sid, e in OLD_MAN['sounds'].items():
    cat = e.get('category')
    if e.get('loop'):
        # loops, music and alarms go into the file packs unchanged (step 5)
        assert len(e['files']) == 1
        loose[sid] = (V1 + '/' + e['files'][0], e, [dict(c) for c in old_files.get(sid, [])])
        continue
    sp = OLD_FOLEY.get(sid) or OLD_SPRITE.get(cat)
    if not sp: raise SystemExit(f'no sprite for {sid} ({cat})')
    files = []
    for f in e['files']:
        ch = 2 if sp == 'alarms' else 1
        x = decode(V1 + '/' + f, ch=ch)
        a = np.abs(x if x.ndim == 1 else x.max(1))
        idx = np.where(a > 10 ** (-70 / 20))[0]
        if len(idx) and sp != 'alarms': x = x[: idx[-1] + int(0.01 * SR)]
        clip = f[:-4]
        cr = next(c for c in old_files[sid] if c['file'] == f)
        cr = dict(cr); cr['clip'] = clip; cr['file'] = SPRITE_FILE[sp]
        cr['edits'] = cr['edits'] + f'; packed into the audio sprite {SPRITE_FILE[sp]} as clip "{clip}" (decoded and re-encoded, {SPRITE_KBPS[sp]} kbps)'
        sprites[sp].append((clip, x, cr))
        files.append(f'{SPRITE_FILE[sp]}#{clip}')
    manifest['sounds'][sid] = {**e, 'files': files}

# 2. new one-shots
for sid, (sp, cat, gain, variants) in NEW.items():
    assert sid not in manifest['sounds'], sid
    files = []
    for i, v in enumerate(variants):
        x, edits = render(v)
        clip = f'{sid}_{i + 1}' if len(variants) > 1 else sid
        srcs = all_srcs(v)
        cr = credit_for(srcs[0])
        extra = [credit_for(s) for s in srcs[1:] if s != srcs[0]]
        entry = dict(file=SPRITE_FILE[sp], clip=clip, id=sid, **cr,
                     edits='mono, 44.1 kHz; ' + '; '.join(edits) + f'; packed into the audio sprite {SPRITE_FILE[sp]} (MP3 {SPRITE_KBPS[sp]} kbps mono)')
        if extra: entry['alsoFrom'] = extra
        sprites[sp].append((clip, x, entry))
        files.append(f'{SPRITE_FILE[sp]}#{clip}')
    manifest['sounds'][sid] = {'files': files, 'gain': gain, 'loop': False, 'category': cat}

# 3. write the sprites
for sp, clips in sprites.items():
    if not clips: continue
    stereo = sp == 'alarms'
    ch = 2 if stereo else 1
    parts, t, table = [np.zeros((int(LEAD * SR), ch) if stereo else int(LEAD * SR), np.float32)], LEAD, {}
    for clip, x, cr in clips:
        n = len(x)
        table[clip] = [round(t, 4), round(n / SR, 4)]
        parts.append(x.astype(np.float32))
        parts.append(np.zeros((int(GAP * SR), ch) if stereo else int(GAP * SR), np.float32))
        t += (n + int(GAP * SR)) / SR
        credits.append(cr)
    y = np.concatenate(parts)
    wav = f'{WORK}/{sp}.wav'
    write_wav(wav, y)
    out = SFX + '/' + SPRITE_FILE[sp]
    encode(wav, out, SPRITE_KBPS[sp], ch)
    # check the clip offsets against the decoded MP3 (encoder delay must be gone)
    dec = decode(out, ch=1)
    ref = y if not stereo else y.mean(1)
    shifts = []
    for clip, (s, d) in list(table.items())[:: max(1, len(table) // 6)]:
        a = int(s * SR); w = ref[a: a + int(min(d, 0.25) * SR)]
        best, bi = -1, 0
        for k in range(-2000, 2001, 4):
            if a + k < 0: continue
            seg = dec[a + k: a + k + len(w)]
            if len(seg) < len(w): continue
            c = float(np.dot(seg, w))
            if c > best: best, bi = c, k
        shifts.append(bi)
    manifest['sprites'][SPRITE_FILE[sp]] = {'dur': round(len(y) / SR, 4), 'clips': table}
    print(f'{SPRITE_FILE[sp]}: {len(clips)} clips, {len(y) / SR:.1f} s, {os.path.getsize(out) / 1024:.0f} KB, offset check (samples) {shifts}')

# 4. ambience beds
def lufs(path):
    r = subprocess.run(['ffmpeg', '-v', 'info', '-nostats', '-i', path, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', r)
    return float(m[-1])


for sid, a in AMB.items():
    x = decode(path_of(a['src']), a['t'], a['d'], 2, a.get('af', ''))
    edits = [f"cut {a['t']:.1f}-{a['t'] + a['d']:.1f} s of the source"] + ([f"filter: {a['af']}"] if a.get('af') else [])
    srcs = [a['src']]
    for (s, t, d, g, af) in a.get('layers', []):
        y = decode(path_of(s), t, d, 2, af)
        n = min(len(x), len(y))
        x = x[:n] + y[:n] * 10 ** (g / 20)
        edits.append(f'mixed with {s} {t:.1f}-{t + d:.1f} s at {g:+d} dB')
        srcs.append(s)
    tmp = f'{WORK}/{sid}.pre.wav'; write_wav(tmp, x)
    L = lufs(tmp)
    g = a['lufs'] - L
    x = x * 10 ** (g / 20)
    pk = np.abs(x).max()
    if pk > 10 ** (-3 / 20):
        x = x / pk * 10 ** (-3 / 20); edits.append('peaks capped at -3 dBFS')
    n = int(0.5 * SR)
    ramp = np.linspace(0, 1, n)[:, None]
    x[:n] *= ramp; x[-n:] *= ramp[::-1]
    edits.append(f'loudness-normalised from {L:.1f} to about {a["lufs"]} LUFS ({g:+.1f} dB); 0.5 s fade in/out (the app crossfades the loop)')
    wav = f'{WORK}/{sid}.wav'; write_wav(wav, x.astype(np.float32))
    out = f'{WORK}/{sid}.mp3'
    kb = a.get('kbps', 64)
    encode(wav, out, kb, 2)
    edits.append(f'encoded to MP3 ({kb} kbps stereo)')
    cr = credit_for(srcs[0])
    entry = dict(file=f'{sid}.mp3', id=sid, **cr, edits='stereo, 44.1 kHz; ' + '; '.join(edits))
    extra = [credit_for(s) for s in srcs[1:]]
    if extra: entry['alsoFrom'] = extra
    loose[sid] = (out, {'files': [f'{sid}.mp3'], 'gain': a['gain'], 'loop': True, 'category': a['cat']}, [entry])
    print(f'{sid}.mp3: {os.path.getsize(out) / 1024:.0f} KB  ({L:.1f} LUFS -> {a["lufs"]})')

# 5. file packs: whole MP3 files (loops, music, alarms) stored back to back, byte for byte. The app
#    fetches (or range-requests) one member and decodes it on its own, so nothing is re-encoded and
#    only the loop that plays is ever decoded.
manifest['packs'] = {}
for pack, ids in PACKS.items():
    blob, table = bytearray(), {}
    for sid in ids:
        path, e, rows = loose.pop(sid)
        b = open(path, 'rb').read()
        table[sid] = [len(blob), len(blob) + len(b)]
        blob += b
        manifest['sounds'][sid] = {**e, 'files': [f'{pack}#{sid}']}
        for r in rows:
            r['file'] = pack; r['clip'] = sid
            r['edits'] += f'; stored unchanged (byte for byte) in the file pack {pack} (bytes {table[sid][0]}-{table[sid][1]})'
            credits.append(r)
    open(SFX + '/' + pack, 'wb').write(blob)
    manifest['packs'][pack] = {'bytes': len(blob), 'clips': table}
    print(f'{pack}: {len(ids)} files, {len(blob) / 1048576:.2f} MB')
assert not loose, f'loops not in a pack: {list(loose)}'

for al, orig in ALIAS.items():
    manifest['sounds'][al] = {**manifest['sounds'][orig], 'category': 'bed', 'alias': orig}

# 6. remove the loose files that now live in sprites and packs
keep = {SPRITE_FILE[s] for s in sprites if sprites[s]} | set(PACKS)
for f in glob.glob(SFX + '/*.mp3'):
    if os.path.basename(f) not in keep: os.remove(f)

json.dump(manifest, open(SFX + '/manifest.json', 'w'), indent=1)
json.dump(credits, open(SFX + '/credits.json', 'w'), indent=1, ensure_ascii=False)
mp3s = glob.glob(SFX + '/*.mp3')
print(f'{len(mp3s)} audio files, {sum(os.path.getsize(f) for f in mp3s) / 1048576:.2f} MB, {len(manifest["sounds"])} ids, {len(credits)} credit rows')
