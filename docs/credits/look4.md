# look4 credits (the "Golden Diorama" look: post, sky, forest, vista)

| Asset | Source | Author | Licence |
|---|---|---|---|
| `public/textures/leaves.webp` (the leaf atlas: oak, maple, birch and their autumn colours, blossom, fir, pine, fern, elder, boxwood, holly, lilac) | painted leaf by leaf in code, `art/leaves/paint.ts` | Hoot Hollow (original) | project's own |
| Ground, bark and moss scans reused by the vista and the far trees (`forest_floor`, `bark_spruce`, `moss`) | already credited in `docs/credits/world3.md` (Poly Haven via BUSHED) | see world3.md | CC0 |

Pip's travel things in the departure / arrival cinematics (`public/models/world/props_*.glb`), replacing the old
blocky lowpix props:

| File | Model | Source | Author | Licence |
|---|---|---|---|---|
| `props_satchel.glb` | A Backpack For An Adventure (Gacha Garage `wear_satchel.glb`) | https://sketchfab.com/3d-models/a-backpack-for-an-adventure-2ad86321197a49feb54b7726743d7fd0 | Thomas Lean | CC BY 4.0 |
| `props_goggles.glb` | Steampunk Glasses (Gacha Garage `wear_goggles.glb`) | https://sketchfab.com/3d-models/steampunk-glasses-841202d9bbe440648184305d9680b108 | Loïc | CC BY 4.0 |
| `props_item1.glb` | Casual Jar of Raspberry Jam (Gacha Garage `jam_jar.glb`) | https://sketchfab.com/3d-models/casual-jar-of-raspberry-jam-61bc4a8ef3184b169ab368946fcf2135 | Incg5764 | CC BY 4.0 |
| `props_item3.glb` | Extra Chocolate Marshmallow Cupcake (Gacha Garage `cupcake.glb`) | https://sketchfab.com/3d-models/extra-chocolate-marshmallow-cupcake-43b8a378e7a74898855fe0075215aa48 | jtressle | CC BY 4.0 |
| `props_bundle.glb` | Cloth coin bag (Gacha Garage `coin_bag.glb`, lowpix) | Gacha Garage `art/lowpix/machines/_src/held.py` | Gacha Garage | owner's project |
| `props_item0.glb` | Sea Dog's Compass (BUSHED `seadogs_compass.glb`) | https://polyhaven.com/a/seadogs_compass | Benny Weimer | CC0 |
| `props_item2.glb` | Wooden Lantern 01 (BUSHED `wooden_lantern_01.glb`) | https://polyhaven.com/a/wooden_lantern_01 | James Ray Cock | CC0 |

The koi, dragonflies and butterflies (`src/world/critterkit.ts`) and Pip's leather strap are modelled in code. The trunks and limbs of the forest trees are still BUSHED's procedural
generator (`src/world/bushed`, the owner's own project); their crowns are now Hoot Hollow's leaf-card canopies.
Removed (no longer used): BUSHED's `foliage_{birch,cedar,fir,pine,spruce}.webp` and `bark_{cedar,pine}{,_n}.webp`.
