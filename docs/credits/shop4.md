# Credits: Barnaby's Lodge Store (shop builder, round 4)

## Made for the game

- **Barnaby Birchbark**, the beaver shopkeeper (`public/models/shop/beaver.glb`): modelled, rigged, painted and
  animated in code for Hoot Hollow (`art/shop/beaver.py` + `art/shop/paintkit.py`, Blender bpy, headless). The coat,
  muzzle, paws, tail scales and the canvas apron are painted per texel in numpy (no photo sources).
- The lodge itself (peeled-log walls, the stick ceiling, the counter, the deal stumps, the Lucky Barrel, acorn sacks
  and heaps, the gem chests and moon gems, the brass scales, the gift parcel, the chalk slate, the cloth banners,
  the carved signs, the rag rug and the wood shavings) is built in code in `src/world/stages/lodgekit.ts` and
  `src/world/stages/lodge.ts`, dressed in the textures below and in pixel canvases painted in code.
- The burlap weave (`public/models/shop/tex/burlap.webp`) is painted in code (`art/shop/textures.py`).
- The potted fir by the window is built from 2D pixel-art leaf cards (`src/world/stages/shopplants.ts`, round 3).

## Models in `public/models/shop/props.glb`

Merged into one GLB by `art/shop/merge.mjs` (each prop a named node; textures resized, WebP, meshopt). Upstream
attributions as the source projects list them.

| node | model | author | licence | via |
|---|---|---|---|---|
| `register` | [CashRegister_01](https://polyhaven.com/a/CashRegister_01) | Joe Seabuhr | CC0 1.0 | BUSHED (`public/assets/models`) |
| `lantern` | [Lantern_01](https://polyhaven.com/a/Lantern_01) | Rajil Jose Macatangay | CC0 1.0 | BUSHED |
| `wlantern` | [wooden_lantern_01](https://polyhaven.com/a/wooden_lantern_01) | James Ray Cock | CC0 1.0 | BUSHED |
| `bucket` | [wooden_bucket_01](https://polyhaven.com/a/wooden_bucket_01) | James Ray Cock | CC0 1.0 | BUSHED |
| `wicker` | [wicker_basket_01](https://polyhaven.com/a/wicker_basket_01) | Kuutti Siitonen | CC0 1.0 | BUSHED |
| `plane` | [hand_plane_no4](https://polyhaven.com/a/hand_plane_no4) | Satyaki Mandal | CC0 1.0 | BUSHED |
| `saw` | [handsaw_wood](https://polyhaven.com/a/handsaw_wood) | Konrad Szałankiewicz | CC0 1.0 | BUSHED |
| `hatchet` | [hatchet](https://polyhaven.com/a/hatchet) | James Ray Cock, Ulan Cabanilla | CC0 1.0 | BUSHED |
| `axe` | [wooden_axe](https://polyhaven.com/a/wooden_axe) | Ulan Cabanilla | CC0 1.0 | BUSHED |
| `bookshelf` | [wooden_bookshelf_worn](https://polyhaven.com/a/wooden_bookshelf_worn) | Ulan Cabanilla | CC0 1.0 | BUSHED |
| `stool` | [wooden_stool_01](https://polyhaven.com/a/wooden_stool_01) | Kuutti Siitonen | CC0 1.0 | BUSHED |
| `pot` | [brass_pot_01](https://polyhaven.com/a/brass_pot_01) | Rico Cilliers | CC0 1.0 | BUSHED |
| `jug` | [jug_01](https://polyhaven.com/a/jug_01) | Kuutti Siitonen | CC0 1.0 | BUSHED |
| `cheese` | [CheeseBox_01](https://polyhaven.com/a/CheeseBox_01) | Gabriel Radić | CC0 1.0 | BUSHED |
| `bowl` | [wooden_bowl_01](https://polyhaven.com/a/wooden_bowl_01) | Oliver Harries | CC0 1.0 | BUSHED |
| `ladder` | [wooden_ladder](https://polyhaven.com/a/wooden_ladder) | Miroslav Turura | CC0 1.0 | BUSHED |
| `crate1` | [wooden_crate_01](https://polyhaven.com/a/wooden_crate_01) | James Ray Cock | CC0 1.0 | BUSHED |
| `crate2` | [wooden_crate_02](https://polyhaven.com/a/wooden_crate_02) | James Ray Cock, Jurita Burger | CC0 1.0 | BUSHED |
| `milcrate` | [wooden_military_crate](https://polyhaven.com/a/wooden_military_crate) | Prabhjinder Singh | CC0 1.0 | BUSHED |
| `mclock` | [mantel_clock_01](https://polyhaven.com/a/mantel_clock_01) | Yann Kervran, Rico Cilliers | CC0 1.0 | BUSHED (via round 3) |
| `candle` | [wooden_candlestick](https://polyhaven.com/a/wooden_candlestick) | Josh Dean | CC0 1.0 | BUSHED (via round 3) |
| `tea` | [Tea Set 01](https://polyhaven.com/a/tea_set_01) | James Ray Cock, Rico Cilliers, Jurita Burger | CC0 1.0 | Poly Haven (via round 3) |
| `vase` | [Antique Ceramic Vase 01](https://polyhaven.com/a/antique_ceramic_vase_01) | James Ray Cock | CC0 1.0 | Gacha Garage (via round 3) |
| `books` | [Stack of Books](https://sketchfab.com/3d-models/stack-of-books-83d623341f164753b825d1050be009d9) | AJH2 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage (via round 3) |
| `teddy` | [Teddy Bear](https://sketchfab.com/3d-models/teddy-bear-dae9249342744328ad6da4182e6010f7) | theacidrose | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage (via round 3) |
| `beanie` | [Beanie With Pom-Pom](https://sketchfab.com/3d-models/beanie-with-pom-pom-16569f9d12da457aa20884fb8ea97080) | lord cabal | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage (via round 3) |
| `beret` | [Headwear](https://sketchfab.com/3d-models/headwear-b174a13ed4b048828919006fe489440f) | noyou | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage (via round 3) |
| `boater` | [straw boater hat w/ black silk ribbon](https://sketchfab.com/3d-models/straw-boater-hat-w-black-silk-ribbon-cd78d72dca1748048c7badfbb2f4e06c) | clairenicole22 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage (via round 3) |
| `fedora` | [Fedora](https://sketchfab.com/3d-models/fedora-eb46b3407c67491f98a13df1b86950fa) | Marko Korbun | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage (via round 3) |

The goods on the bookshelf behind the counter are the game's own furniture models (`public/models/items`).

## Textures (`public/models/shop/tex/`)

From BUSHED's pixel-art PBR set (`public/assets/textures/places`, palette-quantised tiles at ~256 px/m made from CC0
Poly Haven scans by BUSHED's `tools/make_textures.py`), recoloured by `art/shop/textures.py`.

| file | BUSHED texture | source scan | author | licence |
|---|---|---|---|---|
| `log.webp`, `log_n.webp` | `log_int` | procedural log skin + [Wood Table Worn](https://polyhaven.com/a/wood_table_worn) | BUSHED; Dimitrios Savva, Rico Cilliers | CC0 1.0 |
| `end.webp` | `endgrain` | procedural rings + spruce bark | BUSHED | made for the owner's game |
| `bark.webp`, `bark_n.webp` | `bark_light` | bark (BUSHED trees, from Poly Haven bark scans) | BUSHED | CC0 1.0 |
| `chink.webp` | `chink` | [White Rough Plaster](https://polyhaven.com/a/white_rough_plaster) | Rob Tuytel | CC0 1.0 |
| `floor.webp`, `floor_n.webp` | `floor` | [Old Wood Floor](https://polyhaven.com/a/old_wood_floor) | Guillaume Monsergent | CC0 1.0 |
| `board.webp` | `board_warm` | [Wood Table Worn](https://polyhaven.com/a/wood_table_worn), [Fine Grained Wood](https://polyhaven.com/a/fine_grained_wood) | Dimitrios Savva, Rico Cilliers; Rob Tuytel | CC0 1.0 |

## Also borrowed

- The UI's pixel frames and patterns (`src/ui/shop/art.js`) follow the round-3 shop kit and The Bear Must Eat's
  pixel UI (the owner's game); the paper surface follows BUSHED's `src/ui/paper.ts`.
