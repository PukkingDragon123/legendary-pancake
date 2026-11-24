#!/bin/bash
# [world3] Build every forest-kit spec with lowpix and copy the GLBs into public/models/world/.
#   bash art/lowpix/world/build.sh [ids...]     (default: all specs)
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
LOWPIX="${LOWPIX:-/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad/refs2/symmetrical-goggles}"
PY="${LOWPIX_PY:-$HOME/.cache/lowpix-venv/bin/python}"
OUT="${LOWPIX_OUT:-$HERE/out}"
mkdir -p "$ROOT/public/models/world" "$OUT"
ids=("$@")
if [ ${#ids[@]} -eq 0 ]; then for f in "$HERE"/specs/*.json; do ids+=("$(basename "$f" .json)"); done; fi
for id in "${ids[@]}"; do
  PYTHONPATH="$LOWPIX" "$PY" -m lowpix build "$HERE/specs/$id.json" -o "$OUT/$id" > "$OUT/$id.log" 2>&1 || { cat "$OUT/$id.log"; exit 1; }
  grep -E "^built|warning: below" "$OUT/$id.log" | head -2
  cp "$(ls "$OUT/$id/"*.glb | head -1)" "$ROOT/public/models/world/$id.glb"
done
ls -la "$ROOT/public/models/world" | tail -n +2
