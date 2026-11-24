"""Build the interview office's lowpix models.

    python3 art/lowpix/interview/make.py [id ...]        (no ids = all; --no-build writes the specs only; -j N workers)

1. each module in _src/ has `specs()` returning {id: Spec} (see _kit.py); they are written to art/lowpix/interview/<id>.json,
2. built with lowpix (`python -m lowpix build`) into $OUT (default: the session scratch dir or /tmp/lowpix-interview),
3. the .glb is copied to public/models/interview/<id>.glb; look at $OUT/<id>/<id>_sheet.png.
4. big atlases are then re-encoded as WebP: `python borrow.py --webp room window clock desk_drawer`.

Needs the lowpix checkout on LOWPIX (default: the shared refs copy) and its venv python on LOWPIX_PY.
"""
import concurrent.futures as cf
import importlib.util
import glob
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '_src'))
SCRATCH = '/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad'
LOWPIX = os.environ.get('LOWPIX', os.path.join(SCRATCH, 'refs2/symmetrical-goggles'))
PY = os.environ.get('LOWPIX_PY', os.path.expanduser('~/.cache/lowpix-venv/bin/python'))
OUT = os.environ.get('OUT', os.path.join(SCRATCH, 'agents/interview3/lowpix') if os.path.isdir(SCRATCH) else '/tmp/lowpix-interview')
DEST = os.path.join(ROOT, 'public', 'models', 'interview')


def load_all():
    out = {}
    for f in sorted(glob.glob(os.path.join(HERE, '_src', '*.py'))):
        name = os.path.splitext(os.path.basename(f))[0]
        spec = importlib.util.spec_from_file_location(name, f)
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        out.update(m.specs())
    return out


def build(id):
    out = os.path.join(OUT, id)
    shutil.rmtree(out, ignore_errors=True)
    env = dict(os.environ, PYTHONPATH=LOWPIX, PYTHONDONTWRITEBYTECODE='1')
    r = subprocess.run([PY, '-m', 'lowpix', 'build', os.path.join(HERE, id + '.json'), '-o', out], env=env, capture_output=True, text=True)
    if r.returncode != 0:
        return id, 'FAILED\n' + r.stderr[-1500:]
    glb = [f for f in os.listdir(out) if f.endswith('.glb')]
    if not glb:
        return id, 'no glb'
    os.makedirs(DEST, exist_ok=True)
    shutil.copy(os.path.join(out, glb[0]), os.path.join(DEST, id + '.glb'))
    size = os.path.getsize(os.path.join(DEST, id + '.glb')) // 1024
    warn = [l for l in r.stdout.splitlines() if 'warn' in l.lower()]
    return id, f'{size} KB ' + ' | '.join(warn[:4])


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    jobs = 2
    if '-j' in sys.argv:
        jobs = int(sys.argv[sys.argv.index('-j') + 1])
        args = [a for a in args if a != str(jobs)]
    specs = load_all()
    ids = args or sorted(specs)
    for id in ids:
        if id not in specs:
            sys.exit(f'unknown model {id}; have: {", ".join(sorted(specs))}')
        specs[id].write(os.path.join(HERE, id + '.json'))
    if '--no-build' in sys.argv:
        return
    with cf.ThreadPoolExecutor(jobs) as ex:
        for id, msg in ex.map(build, ids):
            print(f'{id}: {msg}', flush=True)


if __name__ == '__main__':
    main()
