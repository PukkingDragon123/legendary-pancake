"""[world3] Writes the lowpix specs for Pip's travel props (the departure / arrival cinematics):

    python3 art/lowpix/world/make.py      # writes art/lowpix/world/specs/*.json
    bash art/lowpix/world/build.sh        # builds every spec and copies the GLBs to public/models/world/

The forest itself (trees, shrubs, ground cover, rocks, stumps, the fallen trunk) is borrowed from BUSHED, the
owner's lumberjack game: see src/world/woods.ts, src/world/bushed/ and docs/credits/world3.md.
"""
import json
import os

import props

HERE = os.path.dirname(os.path.abspath(__file__))
SPECS = os.path.join(HERE, 'specs')

if __name__ == '__main__':
    os.makedirs(SPECS, exist_ok=True)
    out = props.all_props()
    for pid, sp in out.items():
        with open(os.path.join(SPECS, pid + '.json'), 'w') as fh:
            json.dump(sp, fh, indent=1)
    print('specs:', len(out), '->', SPECS)
