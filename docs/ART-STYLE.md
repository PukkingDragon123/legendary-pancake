# Hoot Hollow art style (v3: "Moss & Moonlight", hand-painted toys in a pixel-textured world)

This follows the owner's latest direction from their game Gacha Garage (branch
`claude/fervent-johnson-r5vskq`, CLAUDE.md, docs/ART.md, docs/LOWPOLY.md, art/blender/toys/FACET.md) and their
modelling tool **lowpix** (`symmetrical-goggles`). The old voxel/box-built look is retired: no new art is built
from stacked boxes or voxels.

## Palette: calm and natural
`src/gfx/palette.ts` (`P`, `shade`, `mixc`, `shadow`, `light`, `CSS_TOKENS`). Sage, moss and pine greens; warm
muted woods; oat and linen paper; mist, lake and dusk blues; lamp-gold, honey, terracotta, rose and berry as
sparing accents; slate-tinted shadows (never pure black), warm highlights. No saturated candy colours, no neon.

## Pip and every owl: hand-painted faceted toys (Blender)
- Modelled in Blender headless (`~/.cache/gg-bpy/bin/python script.py`, bpy 5.3) with the Gacha Garage toy
  library (art/blender/toys/lib: tk, facet, paint, face, fig, rig) copied into `art/blender/lib/`.
- **Facet mode**: visible low poly, crisp flat-shaded planes, ~1500-1900 tris per owl, one 2048 px hand-painted
  brush-stroke atlas (strokes follow the form, lit facet-edge rims, rubbed wear, stippled blush), no normal map.
- Species-correct shape and markings (tawny, barn, snowy...) but a gashapon-mascot figure: chunky readable
  silhouette, soft and appealing. **Eyes are simple dots** (solid ink, slightly uneven, painted, no glossy eyeball).
- Exported to `public/models/owls/<id>.glb` with the bones the game animates (see src/owl/rig contract).

## House, furniture, props, rooms: lowpix (low poly + detailed pixel-art textures)
- Each model is a lowpix JSON spec in `art/lowpix/<area>/<id>.json`, built with
  `PYTHONPATH=<symmetrical-goggles> ~/.cache/lowpix-venv/bin/python -m lowpix build <spec> -o <out>` and the GLB
  copied to `public/models/<area>/<id>.glb`.
- Properly proportioned, real construction (not chibi, not stuck-together blocks). Spend triangles on the
  silhouette; paint the rest.
- **Very detailed pixel-art textures**: high texel density, brush-painted materials (wood grain, bark, cloth
  weave, stitching, plaster, brass, glaze), edge rims, AO in creases, wear on corners, dirt in recesses; hue-shifted
  ramps from the palette; clusters not noise; photo-bashing of CC0 material photos where it helps.
- Lit in the game (day/night): keep painted light subtle (AO, rims, gentle gradient), let the scene light shade.

## UI and 2D
- Detailed pixel-art UI that feels physical and interactive (wood, paper, brass, cloth), recoloured to the calm
  palette. Pixel fonts only. Particles are 2D pixel sprites (no soft glow blobs, no additive blobs).
- **No 2D drawings of the owl anywhere.** Where the owl must appear in the UI, use a render of the 3D model.
- Lots of transitions, all in pixel art.
