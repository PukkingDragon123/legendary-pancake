# Credits: the world (builder world3)

The woods, the ground and the look of the renderer are borrowed from **BUSHED**, the owner's lumberjack game
(`lpx-bushed/games/bushed`), and restyled for Hoot Hollow's calm "Moss & Moonlight" palette (textures
desaturated and nudged towards sage, re-encoded as WebP; tints per season in `src/world/flora.ts`).
BUSHED's own sources are **CC0 1.0** scans from [Poly Haven](https://polyhaven.com), re-made by BUSHED's
`tools/forest/*.py` as high-resolution pixel art; its models were converted with lowpix.

## Code (adapted)

| Hoot Hollow | From BUSHED | Notes |
|---|---|---|
| `src/world/bushed/build.ts`, `geom.ts`, `species.ts`, `rng.ts`, `noise.ts` | `src/trees/build.ts`, `src/trees/geom.ts`, `src/trees/species.ts`, `src/core/rng.ts`, `src/core/noise.ts` | procedural trees; an `oak` species added (broadleaf path, birch leaves, spruce bark) |
| `src/world/bushed/protos.ts`, `atlas.ts` | `src/world/veg/protos.ts`, `src/world/veg/atlas.ts` | ground-cover prototypes (ferns, shrubs, cattails, lily pads, mushrooms, moss, cones) |
| `src/world/bushed/materials.ts`, `textures.ts` | `src/trees/materials.ts`, `src/trees/textures.ts`, `src/gfx/tex.ts` | wind / translucency / moss patches re-wired to our wind and sky |
| `src/world/post.ts` | `src/gfx/renderer.ts` | low internal resolution, bloom, filmic grade, split toning, vignette, grain, ordered dither, nearest upscale (atmosphere, shafts, lake and motion blur passes left out for phones) |

## Textures (`public/textures/bushed/`)

| File | Source | Author | Licence |
|---|---|---|---|
| `bark_spruce` (+ `_n`; also the oak's bark) | [Bark Platanus](https://polyhaven.com/a/bark_platanus) | Dimitrios Savva | CC0 |
| `bark_fir` (+ `_n`) | [Chinese Hackberry Bark](https://polyhaven.com/a/chinese_hackberry_bark) | Charlotte Baglioni | CC0 |
| `bark_pine` (+ `_n`) | [Pine Bark](https://polyhaven.com/a/pine_bark) | Dimitrios Savva | CC0 |
| `bark_cedar` (+ `_n`) | [Metasequoia Bark](https://polyhaven.com/a/metasequoia_bark) | Charlotte Baglioni | CC0 |
| `bark_birch` (+ `_n`) | procedural, detail from [Japanese Sycamore](https://polyhaven.com/a/japanese_sycamore) | Charlotte Baglioni | CC0 |
| `foliage_spruce`, `foliage_fir`, juniper in `veg_atlas` | [Fir Tree 01](https://polyhaven.com/a/fir_tree_01) twig maps | Rob Tuytel, Rico Cilliers | CC0 |
| `foliage_pine` | [Pine Tree 01](https://polyhaven.com/a/pine_tree_01) twig maps | Rob Tuytel, Rico Cilliers | CC0 |
| `foliage_birch` (birches and oaks) | [Shrub 01](https://polyhaven.com/a/shrub_01) | Rico Cilliers | CC0 |
| `veg_atlas` (ferns) | [Fern 02](https://polyhaven.com/a/fern_02) | Rob Tuytel, Rico Cilliers | CC0 |
| `veg_atlas` (alder, blueberry, raspberry, sarsaparilla) | [Shrub 03](https://polyhaven.com/a/shrub_03), [Shrub 04](https://polyhaven.com/a/shrub_04) | Rico Cilliers | CC0 |
| `veg_atlas` (grasses, wildflowers, mushrooms, lily pads, litter) | BUSHED `tools/forest/veg.py`, `veg_flora.py` (procedural / hand-painted) | BUSHED | owner's project |
| `moss` | [Concrete Moss](https://polyhaven.com/a/concrete_moss) (+ procedural cushions) | Rob Tuytel | CC0 |
| `forest_floor` | [Forest Leaves 02](https://polyhaven.com/a/forest_leaves_02) | Rob Tuytel | CC0 |
| `mossy_rock` | [Mossy Rock](https://polyhaven.com/a/mossy_rock) | Rob Tuytel | CC0 |
| `earth` | [Forrest Ground 03](https://polyhaven.com/a/forrest_ground_03) | Rob Tuytel | CC0 |

## Models (`public/models/world/`)

| File | Source | Author | Licence |
|---|---|---|---|
| `tree_stump_01.glb`, `tree_stump_02.glb` | [Tree Stump 01](https://polyhaven.com/a/tree_stump_01), [02](https://polyhaven.com/a/tree_stump_02) via BUSHED | Rob Tuytel | CC0 |
| `dead_tree_trunk.glb` | [Dead Tree Trunk](https://polyhaven.com/a/dead_tree_trunk) via BUSHED | Rob Tuytel | CC0 |
| `bark_debris_01.glb` | [Bark Debris 01](https://polyhaven.com/a/bark_debris_01) via BUSHED | Greg Zaal, Jenelle van Heerden | CC0 |
| `boulder_01.glb` | [Boulder 01](https://polyhaven.com/a/boulder_01) via BUSHED | Rico Cilliers | CC0 |
| `rock_07.glb` | [Rock 07](https://polyhaven.com/a/rock_07) via BUSHED | Jenelle van Heerden | CC0 |
| `props_*.glb`, `bird_*.glb` | made for Hoot Hollow with lowpix (`art/lowpix/world/props.py`) | Hoot Hollow | project |

## Also kept

- `src/world/grassAtlas.js` (cell layout only now): Moleforge / Burrowsmith (`curly-enigma`), the owner's project.
