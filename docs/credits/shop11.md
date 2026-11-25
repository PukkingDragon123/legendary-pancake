# Credits: Barnaby's workshop (shop builder, round 11)

Barnaby's Lodge Store became a working furniture shop: he stands at his workbench and makes furniture while you browse.

## Made for the game

- **Barnaby's craft** (`public/models/shop/beaver.glb`): seven new animation clips (marking out with a try square and the
  pencil from behind his ear, sawing the plank's end off, planing it, chopping a mortise with chisel and mallet,
  sanding, blowing the dust off, holding up the stool he finished) posed per frame by inverse kinematics against his
  workbench, and the tools he holds (a joiner's mallet, a bevel-edged chisel, a try square, a cork sanding block and a
  three-legged stool), modelled and grain-painted in code (`art/shop/craft.py`, with `art/shop/beaver.py` and
  `art/shop/paintkit.py`, Blender bpy, headless).
- **The workshop** (`src/world/stages/workshop.ts`): the workbench with its face vice, holdfast, dog holes and tool tote,
  the plank and everything that happens to it (pencil line, saw kerf, falling offcuts, curled shavings, mortises,
  sawdust), the tool board with its chisel rack, F-clamps, bow saw, try square, folding rule and mallet, the timber rack,
  the shaving horse and its drawknife, the finishing table (glue pot on its burner, varnish tins with painted labels, a
  jar of brushes), the chair taking shape over the day in its sash clamps, the cabinet carcass and its doors, the
  display plinths, the paper price tags and the sawdust: built in code and dressed in the shop's textures below and in
  canvases painted in code.
- The finished furniture on display (the rocking chair, the stool, the chairs and the wall shelf on the peg rail) is the
  game's own catalogue (`public/models/items`).

## Borrowed

| asset | where | author | licence | via |
|---|---|---|---|---|
| [handsaw_wood](https://polyhaven.com/a/handsaw_wood) | the saw in Barnaby's paw and its still copy on the bench (`beaver.glb`) | Konrad Szałankiewicz | CC0 1.0 | Poly Haven (1k glTF, decimated, colour map only) |
| [hand_plane_no4](https://polyhaven.com/a/hand_plane_no4) | the smoothing plane in his paw and on the bench (`beaver.glb`) | Satyaki Mandal | CC0 1.0 | Poly Haven (1k glTF, decimated, colour map only) |
| [vintage_hand_drill](https://polyhaven.com/a/vintage_hand_drill) | the hand drill on the tool board (`shop/workshop.glb`, node `drill`) | Benjamin McDonnell (modelling, texturing), Yann Kervran (rigging) | CC0 1.0 | Poly Haven |
| [wooden_hammer_01](https://polyhaven.com/a/wooden_hammer_01) | the claw hammer on the tool board (`shop/workshop.glb`, node `hammer`) | James Ray Cock | CC0 1.0 | Poly Haven |
| fresh-sawn wood texture (`places/wood_fresh`) | `public/models/shop/tex/plank.webp`: the planks, the bench top, the timber rack, the work in progress | Poly Haven scan, palette-quantised by BUSHED | CC0 1.0 | BUSHED (`public/assets/textures/places`), recoloured in `art/shop/textures.py` |

The handsaws, planes, axe and hatchet hanging on the tool board and by the chopping block are the Poly Haven models
already credited in `docs/credits/shop4.md` (`public/models/shop/props.glb`).
