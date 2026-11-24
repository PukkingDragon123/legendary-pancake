# Credits: Pip's hollow oak, round 4 (house, rooms, furniture pass)

The oak is now built in code (`src/world/house/oak.ts`, `geo.ts`, `kit.ts`, `crown.ts`, `locks.ts`, `boxes.ts`); its
crown uses the forest's shared leaf-card canopy and leaf atlas (`src/world/foliage.ts`, credited by the world
builder). Its textures are crisp, palette-limited pixel-art versions of CC0 scans, made by `art/lowpix/house/tex.py`
from the vendored copies in `art/lowpix/house/photos/`, plus generated pixel art (moss cushions; the ivy, fern and
sprig leaf cards; the painted signs, plaques, labels and the dusty window, drawn at runtime with our own 5 x 7 pixel
font). The moving boxes, their cardboard, tape and labels are drawn in code.

## Textures (Poly Haven, CC0 1.0) in `public/models/house/tex/`

| File | Source | Author | Licence |
|---|---|---|---|
| `bark.webp`, `bark_n.webp` | [Bark Brown 02](https://polyhaven.com/a/bark_brown_02) (diffuse, normal, AO) | Rob Tuytel | CC0 1.0 |
| `deck.webp` | [Wood Floor Deck](https://polyhaven.com/a/wood_floor_deck) | Dimitrios Savva | CC0 1.0 |
| `door.webp` | [Rough Pine Door](https://polyhaven.com/a/rough_pine_door) | Dimitrios Savva | CC0 1.0 |
| `planks.webp` | [Wood Shutter](https://polyhaven.com/a/wood_shutter) | Dimitrios Savva | CC0 1.0 |
| `moss.webp`, `leaves.webp` | generated for Hoot Hollow (`art/lowpix/house/tex.py`) | - | - |

## Models added for items that had none (`public/models/items/`)

| File (item) | Source | Author | Licence |
|---|---|---|---|
| `picnic_table.glb` (Picnic Table) | [Wooden Picnic Table](https://polyhaven.com/a/wooden_picnic_table), as converted for BUSHED (`games/bushed/public/assets/models/wooden_picnic_table.glb`) | Ulan Cabanilla | CC0 1.0 |
| `painted_bench.glb` (Wooden Bench) | [Painted Wooden Bench](https://polyhaven.com/a/painted_wooden_bench), via BUSHED | Kirill Sannikov | CC0 1.0 |
| `fire_pit.glb` (Campfire) | [Stone Fire Pit](https://polyhaven.com/a/stone_fire_pit), via BUSHED | Sebastian Platen | CC0 1.0 |
| `lantern_post.glb` (Lantern Post) | [Wooden Lantern 01](https://polyhaven.com/a/wooden_lantern_01), via BUSHED | James Ray Cock | CC0 1.0 |
| `stone_lantern.glb` (Stone Lantern) | [Japanese Stone Lantern](https://sketchfab.com/3d-models/japanese-stone-lantern-e0417d1e05984727a50f9ab1451d162d), as restyled for Gacha Garage (`models/lowpix/world/stone_lantern.glb`) | Sahir Virmani | CC BY 4.0 |
| `picnic_blanket.glb` (Picnic Blanket) | [Blanket and Pillows - Low Poly](https://sketchfab.com/3d-models/blanket-and-pillows-low-poly-65d0993e7b1741e9ab061d5f97504c31), via Gacha Garage | Antipov Alexsander | CC BY 4.0 |
| `wishing_well.glb` (Wishing Well) | [Old Stone Well](https://sketchfab.com/3d-models/old-stone-well-a2b8df0058254881b75a791bc4f9ae4a), via Gacha Garage | Theory.OAD | CC BY 4.0 |
| `post_box.glb` (Mailbox) | [Old Japanese Post Box](https://sketchfab.com/3d-models/old-japanese-post-box-5e0f504bb5d144809390dac8c66a6dd5), via Gacha Garage | Rusty-exe | CC BY 4.0 |

The Birdhouse now uses the existing Bluebird Feeder model.

## Artwork

| Where | Work | Artist | Date | Source | Licence |
|---|---|---|---|---|---|
| `items/painting.glb` (Moonlit Painting) canvas | Moonrise | George Inness | 1891 | [Art Institute of Chicago 64754](https://www.artic.edu/artworks/64754) | public domain (CC0 data) |

## Repainted item textures (`art/lowpix/items/retex.py`)

The gnome (natural glazed colours), the mantel, cuckoo and chalet cuckoo clocks (enamel dials with numerals; live 3D
hands in `src/assets/clocks.ts`), the moonlit painting, the painted wardrobe, the floor cushion, the quest board and
the cubby shelf were repainted in place; their original sources and authors are credited in `furnA.md`,
`furnB.md` and `furnC.md`.
