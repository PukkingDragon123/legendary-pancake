# furnC credits: decor, wall, fun, Frostlight and Starfall items

Models in `public/models/items/` for the item ids in `src/assets/decor/{trinkets,fun,frost,starfall}.ts`, built by
`art/lowpix/items/_furnc/build.py`.

## Borrowed models

Taken from the user's own games (Gacha Garage world props and BUSHED props, where each was made low-poly with a
hand-painted atlas from the source below), then restyled for Hoot Hollow by `art/lowpix/items/_furnc/compose.py`
(recipes in `borrow.py`): meshopt unpacked, texture re-graded to the calm palette (less saturation, slate shadows,
lamp-gold highlights, hue bands mapped onto palette ramps, the typewriter's black enamel repainted sage), lit matte
material, pieces re-laid (the tea set) and fitted to the item's footprint.

| item id | model | author | licence | source | taken from |
|---|---|---|---|---|---|
| `vase_trio` | Antique Ceramic Vase 01 | James Ray Cock | CC0 1.0 | https://polyhaven.com/a/antique_ceramic_vase_01 | Gacha Garage `models/lowpix/world/vase_ceramic.glb` |
| `vase_trio` | Brass Vase 01 | Rico Cilliers | CC0 1.0 | https://polyhaven.com/a/brass_vase_01 | Gacha Garage `models/lowpix/world/vase_brass.glb` |
| `vase_trio` | Jug 01 | Kuutti Siitonen | CC0 1.0 | https://polyhaven.com/a/jug_01 | BUSHED `public/assets/models/jug_01.glb` |
| `reading_pile` | Stack of Books | AJH2 | CC BY 4.0 | https://sketchfab.com/3d-models/stack-of-books-83d623341f164753b825d1050be009d9 | Gacha Garage `models/lowpix/world/books_stack.glb` |
| `reading_pile` | Black Glasses | nazarchi091 | CC BY 4.0 | https://sketchfab.com/3d-models/black-glasses-8425ebedb9334fc3a1e6d7a72f5612b4 | Gacha Garage `models/lowpix/world/wear_frames.glb` |
| `mantel_clock` | Mantel Clock 01 | Yann Kervran, Rico Cilliers | CC0 1.0 | https://polyhaven.com/a/mantel_clock_01 | BUSHED `public/assets/models/mantel_clock_01.glb` |
| `mint_typewriter` | 1930s style typewriter - w/o branding | Kuba "Volant" Wójcik | CC BY 4.0 | https://sketchfab.com/3d-models/1930s-style-typewriter-wo-branding-1d6009449fe84fd79454c4081eb743bf | Gacha Garage `models/lowpix/world/typewriter.glb` |
| `rose_tea_set` | Tea Set 01 | James Ray Cock, Rico Cilliers, Jurita Burger | CC0 1.0 | https://polyhaven.com/a/tea_set_01 | Gacha Garage `models/lowpix/world/tea_set.glb` |

## Photo textures (material relief under the painted ramps)

The lowpix-modelled items photo-bash real material relief (lowpix `photo` op, `detail` mode: the colours stay on our
palette ramps). Sources in `art/lowpix/items/_furnc/photos/` were copied from BUSHED's pixel-art texture set
(`public/assets/textures/`, made by BUSHED's `tools/make_textures.py` from Poly Haven scans); three more ship with
lowpix (`assets/photos/`).

| folder | BUSHED texture | Poly Haven scan | author | licence |
|---|---|---|---|---|
| `photos/wood` | `building/floor_boards` | https://polyhaven.com/a/wood_floor_worn | Dimitrios Savva | CC0 1.0 |
| `photos/planks` | `building/rough_planks` | https://polyhaven.com/a/weathered_planks | Dario Barresi, Dimitrios Savva | CC0 1.0 |
| `photos/stone` | `building/fieldstone` | https://polyhaven.com/a/stone_wall | Dario Barresi, Charlotte Baglioni | CC0 1.0 |
| `photos/granite` | `terrain/granite` | https://polyhaven.com/a/rock_08 | Poly Haven | CC0 1.0 |
| `photos/moss` | `terrain/moss` | https://polyhaven.com/a/sparse_grass | Poly Haven | CC0 1.0 |
| `photos/bark` | `trees/bark_pine` | Poly Haven bark scan (see BUSHED `CREDITS.md`) | Poly Haven | CC0 1.0 |
| lowpix `assets/photos/forest_leaves_02`, `rusty_metal_02`, `brown_leather` | (lowpix) | https://polyhaven.com | Poly Haven | CC0 1.0 |

## Our own models

Everything else (the Frostlight and Starfall prizes, the fun items, the wall pieces, the floor globe, record player,
ship in a bottle and the rest of the trinkets) is modelled from scratch as lowpix specs written by
`art/lowpix/items/_furnc/{trinkets,fun,frost,starfall}.py` (`art/lowpix/items/<id>.json`): low-poly lofts, turned
lathes and chamfered boxes with hand-painted texture layers, painted pixel-art cards (dials, maps, tapestry, rugs,
branches, leaves) and animation clips. CC0.

CC BY 4.0 licence text: https://creativecommons.org/licenses/by/4.0/ . CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
