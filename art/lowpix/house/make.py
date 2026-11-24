"""Make Pip's hollow oak: lowpix specs -> GLBs for the game.

    LOWPIX=<symmetrical-goggles checkout> <lowpix venv python> art/lowpix/house/make.py <module|module:id|all> [--no-build] [--no-sheet]

1. runs art/lowpix/house/_src/<module>.py: `specs()` returns {id: Spec} (see _lib/hx.py; house px, the frame of
   src/world/house/plan.ts), written to art/lowpix/house/<id>.json,
2. builds each with lowpix (the contact sheet and hero go to $HOUSE_OUT/<id>/ for review; default
   /tmp/house-lowpix),
3. packs it for the game (_lib/pack.py): public/models/house/<id>.glb, and records bounds, tris and sizes in
   public/models/house/manifest.json.
"""
import glob
import importlib.util
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(HERE, '_lib'))
sys.path.insert(0, os.path.join(HERE, '_src'))
LOWPIX = os.environ.get('LOWPIX')
if LOWPIX:
    sys.path.insert(0, LOWPIX)
OUT = os.path.join(ROOT, 'public', 'models', 'house')
REVIEW = os.environ.get('HOUSE_OUT', '/tmp/house-lowpix')

from pack import pack  # noqa: E402


def load(mod):
    spec = importlib.util.spec_from_file_location(mod, os.path.join(HERE, '_src', mod + '.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m.specs() if hasattr(m, 'specs') else {}


def _order_layers():
    """Photo-colour layers paint every texel still on their ramps, so layers that move texels to another ramp (moss,
    lichen, wear chips, fills) must run before them and plain tone shifts (furrows, grain) after: reorder each
    part's merged paint that way (stable within each group)."""
    import lowpix.model as M
    if getattr(M, '_hh_ordered', False):
        return
    orig = M.resolve_paint

    def resolve(spec, part):
        p = orig(spec, part)
        ls = p.get('layers') or []
        if any(l.get('op') == 'photo' and l.get('mode') == 'colour' for l in ls):
            first = [l for l in ls if 'ramp' in l and l.get('op') != 'photo']
            photo = [l for l in ls if l.get('op') == 'photo' and l.get('mode') == 'colour']
            rest = [l for l in ls if l not in first and l not in photo]
            p['layers'] = first + photo + rest
        return p
    M.resolve_paint = resolve
    M._hh_ordered = True


def build(id, S, sheet=True):
    from lowpix.model import build_model
    from lowpix.build import export_model
    _order_layers()
    os.chdir(HERE)
    t0 = time.time()
    path = os.path.join(HERE, id + '.json')
    model = build_model(path)
    t1 = time.time()
    info = pack(model, S.meta(), os.path.join(OUT, id + '.glb'))
    rep = model.report()
    info['warnings'] = [w for w in rep.get('warnings', []) if 'under 2px' not in w and 'no ramp set' not in w][:6]
    if sheet:
        export_model(model, os.path.join(REVIEW, id), sheet=True, hero_size=(900, 700))
    info['secs'] = round(time.time() - t1 + (t1 - t0), 1)
    return info


def main(args):
    no_build = '--no-build' in args
    sheet = '--no-sheet' not in args
    want = [a for a in args if not a.startswith('--')]
    mods = sorted(os.path.basename(p)[:-3] for p in glob.glob(os.path.join(HERE, '_src', '*.py')))
    os.makedirs(OUT, exist_ok=True)
    man_path = os.path.join(OUT, 'manifest.json')
    man = json.load(open(man_path)) if os.path.exists(man_path) else {}
    for mod in mods:
        if 'all' not in want and mod not in want and not any(a.startswith(mod + ':') for a in want):
            continue
        only = {a.split(':', 1)[1] for a in want if a.startswith(mod + ':')}
        for id, S in load(mod).items():
            if only and id not in only:
                continue
            S.write(os.path.join(HERE, id + '.json'))
            if no_build:
                print('spec', id)
                continue
            info = build(id, S, sheet)
            man[id] = {k: info[k] for k in ('bytes', 'tris', 'atlas', 'min', 'max')}
            print(f"{id}: {info['tris']} tris, atlas {info['atlas'][0]}x{info['atlas'][1]}, {info['bytes'] // 1024} KB (png {info['png'] // 1024} KB), {info['secs']} s",
                  ('| ' + ' | '.join(info['warnings'])) if info['warnings'] else '')
            with open(man_path, 'w') as f:
                json.dump(dict(sorted(man.items())), f, indent=1)


if __name__ == '__main__':
    main(sys.argv[1:])
