#!/usr/bin/env bash
# Build furnA items: art/lowpix/items/_furnA/b.sh [ids...]  (run from anywhere)
set -e
cd "$(dirname "$0")/../../../.."
export PYTHONPATH="${LOWPIX_SRC:-/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad/refs2/symmetrical-goggles}"
export FURNA_OUT="${FURNA_OUT:-/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad/agents/furnA/out}"
exec "${LOWPIX_PY:-$HOME/.cache/lowpix-venv/bin/python}" art/lowpix/items/_furnA/build.py "$@"
