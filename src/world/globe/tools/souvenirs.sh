#!/bin/bash
# souvenir id, h px, foot x, foot z, yaw, wall, faces, tex
# G = a work dir holding dl/sv/<id>.glb (the downloads) and gt/ (an npm install of @gltf-transform/cli)
G=${G:?set G to the work dir}
R=$(cd "$(dirname "$0")/../../../.." && pwd)
ONLY="$1"
while read -r id h fx fz yaw wall faces tex opts; do
  [ -z "$id" ] && continue
  if [ -n "$ONLY" ] && [[ " $ONLY " != *" $id "* ]]; then continue; fi
  echo "== $id"
  nice ~/.cache/gg-bpy/bin/python "$R/src/world/globe/tools/souvenir_import.py" "$G/dl/sv/$id.glb" "$G/sv_out/$id.glb" "$id" "$h" "$fx" "$fz" "$yaw" "$wall" "$faces" "$tex" $opts 2>&1 | grep -E "^faces|^size|Error|error" | grep -v -i "draco\|meshoptimizer"
  (cd "$G/gt" && ./node_modules/.bin/gltf-transform meshopt "$G/sv_out/$id.glb" "$R/public/models/souvenirs/$id.glb" --level medium 2>&1 | tail -1)
done <<'EOF'
sv_highlandcow 11 1 1 0 0 8000 1024
sv_gondola 9 2 1 0 0 6000 1024
sv_puffin 11 1 1 0 0 4000 1024
sv_llama 16 1 1 0 0 8000 1024
sv_toucan 16 1 1 0 0 8000 1024
sv_canoe 8 3 1 0 0 6000 1024 largest=1
sv_kiwi 9 1 1 0 0 8000 1024
sv_penguin 15 1 1 0 0 9000 1024
sv_tajmodel 14 1 1 0 0 10000 1024
sv_canyondiorama 10 1 1 0 0 8192 1024 relief=3.5
sv_venicemask 12 1 0.5 0 1 8000 1024
sv_lotuslamp 8 1 1 0 0 6000 1024
sv_sambadrum 13 1 1 0 0 7700 1024
EOF
