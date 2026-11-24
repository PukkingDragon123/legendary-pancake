# Credits: interface (builder ui3)

Everything below was borrowed from the owner's own games and restyled for Hoot Hollow (graded into the calm,
quiet palette by `src/ui/px/calm.js`, re-sampled to pixel art). Upstream credits are kept.

## Material textures (`src/ui/px/textiles.js`, made by `art/ui/make_textiles.py`)

Small tiles cut from BUSHED's photo-derived, palette-quantised pixel textures
(`refs4/lpx-bushed/games/bushed/public/assets/textures`, see BUSHED's `CREDITS.md`):

| Tile | BUSHED texture | Source scan | Author | Licence |
|---|---|---|---|---|
| `boards` | `building/floor_boards` | [Wood Floor Worn](https://polyhaven.com/a/wood_floor_worn) | Dimitrios Savva | CC0 1.0 |
| `leather` | `places/leather` | [Brown Leather](https://polyhaven.com/a/brown_leather) | Rob Tuytel | CC0 1.0 |
| `wool` | `places/wool_grey` | [Poly Wool Herringbone](https://polyhaven.com/a/poly_wool_herringbone) | colormass, Rico Cilliers | CC0 1.0 |
| `canvas` | `places/canvas` | BUSHED's procedural duck canvas | BUSHED (the owner) | own work |

Paper and brass are painted procedurally in the manner of BUSHED's `src/ui/paper.ts` and the Book of Cryptids
textures (`src/ui/bookofcryptids/textures.ts`).

## Icons baked from 3D props (`public/ui/icons/*.png`, `src/ui/px/baked.js`, made by `src/dev/iconbake.ts`)

| Icon(s) | Model | Source | Author | Licence |
|---|---|---|---|---|
| `nav_sleep` | `items/canopy_bed.glb` | Hoot Hollow decor | Hoot Hollow | own work |
| `nest`, `jar` | `items/basket_nest.glb`, `items/firefly_jar.glb` | Hoot Hollow decor | Hoot Hollow | own work |
| `nav_clock`, `clock` | BUSHED `wall_clock.glb` | Poly Haven (via BUSHED `CREDITS.md`) | see BUSHED credits | CC0 1.0 |
| `nav_alarm`, `alarm` | Gacha Garage `lowpix/world/clock_alarm.glb` | [Alarm Clock 01](https://polyhaven.com/a/alarm_clock_01) | Yann Kervran, James Ray Cock | CC0 1.0 |
| `nav_book`, `book` | Gacha Garage `lowpix/world/books_stack.glb` | [Stack of Books](https://sketchfab.com/3d-models/stack-of-books-83d623341f164753b825d1050be009d9) | AJH2 | CC BY 4.0 |
| `tool_build` | BUSHED `hand_plane_no4.glb` | Poly Haven (via BUSHED `CREDITS.md`) | see BUSHED credits | CC0 1.0 |
| `tool_toolbox` | Gacha Garage `lowpix/world/toolbox.glb` | [Metal Toolbox](https://polyhaven.com/a/metal_toolbox) | Mateusz Sadek | CC0 1.0 |
| `tool_shop`, `shop` | Gacha Garage `lowpix/world/cash_register.glb` | [Cash Register 01](https://polyhaven.com/a/CashRegister_01) | Joe Seabuhr | CC0 1.0 |
| `tool_dress` | `items/vanity.glb` | Hoot Hollow decor | Hoot Hollow | own work |
| `tool_quests`, `clipboard` | Gacha Garage `lowpix/world/chalkboard.glb` | [Standing Chalkboard 01](https://polyhaven.com/a/standing_chalkboard_01) | ParzivalCG | CC0 1.0 |
| `tool_map` | BUSHED `seadogs_compass.glb` | Poly Haven (via BUSHED `CREDITS.md`) | see BUSHED credits | CC0 1.0 |
| `bell` | Gacha Garage `lowpix/world/call_bell_p.glb` | [Reception Bell](https://sketchfab.com/3d-models/reception-bell-wood-shiny-copper-5d754602e590417b889e500a06b67146) | Rylae Shylna | CC BY 4.0 |
| `lantern` | BUSHED `wooden_lantern_01.glb` | Poly Haven (via BUSHED `CREDITS.md`) | see BUSHED credits | CC0 1.0 |
| `camera` | Gacha Garage `lowpix/world/camera_vintage.glb` | [Vintage Camera](https://sketchfab.com/3d-models/vintage-camera-dd2608dcbd3e4944b4614b2f2de4c73b) | EricKos | CC BY 4.0 |
| `bench` | BUSHED `painted_wooden_bench.glb` | Poly Haven (via BUSHED `CREDITS.md`) | see BUSHED credits | CC0 1.0 |

To re-bake: copy the models above into `public/models/uibake/` (they are not committed), open
`/dev-iconbake.html` (main icons) or `/dev-iconbake.html?sprites=1` (sprite replacements) and save
`window.__icons` / `window.__sprites`.

## Frame kit

The 9-slice frames, sprites and fonts come from the owner's game The Bear Must Eat (as before); this round
repainted them in Hoot Hollow's palette with BUSHED-style materials.
