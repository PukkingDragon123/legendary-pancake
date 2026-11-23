#!/usr/bin/env bash
# Convert the borrowed Poly Haven sources (CC0) with lowpix into the painted style, two at a time.
#   art/lowpix/items/_furnA/convert_all.sh [asset ...]
# Output: $FURNA_CONV/<asset>/ (cached; delete a folder to redo it). Heights are in px (16 per block); the final
# size and placement are set per item in borrow.py, so one conversion can serve several items.
set -e
cd "$(dirname "$0")/../../../.."
export PYTHONPATH="${LOWPIX_SRC:-/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad/refs2/symmetrical-goggles}"
OUT="${FURNA_CONV:-/tmp/claude-0/-home-user-legendary-pancake/851d0ed8-3347-5091-8559-bf562820e20b/scratchpad/agents/furnA/conv}"
PY="${LOWPIX_PY:-$HOME/.cache/lowpix-venv/bin/python}"
# asset:height:tris:atlas
ALL="GreenChair_01:17:4500:1024 painted_wooden_nightstand:10:3000:1024 wooden_bookshelf_worn:26:4000:1024
book_encyclopedia_set_01:3:1500:512 painted_wooden_cabinet_02:26:4000:1024 round_wooden_table_01:9.2:3000:1024
tea_set_01:3:2500:512 chinese_tea_table:8:3000:1024 painted_wooden_chair_02:16:3500:1024 wooden_table_02:11:2500:1024
desk_lamp_arm_01:8:2000:512 standing_chalkboard_01:20:2500:1024 treasure_chest:9:3500:1024 potted_plant_04:14:3000:1024
planter_box_01:7.5:2500:1024 garden_gnome:18:3500:1024 fern_02:8:4500:1024 planter_pot_clay:4.5:1500:512"
want="$*"
jobs=()
for spec in $ALL; do
  IFS=: read -r id h tris atlas <<<"$spec"
  if [ -n "$want" ] && [[ " $want " != *" $id "* ]]; then continue; fi
  if [ -f "$OUT/$id/done" ]; then continue; fi
  jobs+=("$id:$h:$tris:$atlas")
done
run() {
  IFS=: read -r id h tris atlas <<<"$1"
  "$PY" -m lowpix convert "polyhaven:$id" --style painted --height "$h" --tris "$tris" --atlas "$atlas" --saturation 0.85 \
    -o "$OUT/$id" > "$OUT/$id.log" 2>&1 && touch "$OUT/$id/done" && echo "ok $id" || echo "FAIL $id"
}
export -f run
export PY OUT
mkdir -p "$OUT"
printf "%s\n" "${jobs[@]}" | xargs -P 2 -I{} bash -c 'run "$@"' _ {}
