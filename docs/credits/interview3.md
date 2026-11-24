# Credits: the interview office (builder interview3)

Pip's office (`public/models/interview/`) mixes props borrowed from the owner's other games and restyled for Hoot
Hollow, with props hand-modelled for this game in lowpix (specs in `art/lowpix/interview/`).

## Borrowed and restyled props

`art/lowpix/interview/borrow.py` copies each source model and restyles it: the colour atlas is graded to the calm
palette (desaturated a touch, pulled towards the nearest palette colour, slate shadows, lamp-gold lights), the finish
made matte (no metal, rough), normal/roughness/occlusion maps dropped, the atlas downsized and re-encoded as WebP.
Changes were made to every model listed here.

### From BUSHED (the owner's lumberjack game), originally Poly Haven models (CC0 1.0)

BUSHED converted these Poly Haven models with lowpix (re-meshed, re-textured, rescaled).

| Game id | BUSHED file | Source | Author(s) | Licence |
|---|---|---|---|---|
| `b_desk` | `vintage_wooden_drawer_01.glb` | [vintage_wooden_drawer_01](https://polyhaven.com/a/vintage_wooden_drawer_01) | James Ray Cock | CC0 1.0 |
| `b_chair` | `WoodenChair_01.glb` | [WoodenChair_01](https://polyhaven.com/a/WoodenChair_01) | Jake Mobley | CC0 1.0 |
| `b_bookcase` | `wooden_bookshelf_worn.glb` | [wooden_bookshelf_worn](https://polyhaven.com/a/wooden_bookshelf_worn) | Ulan Cabanilla | CC0 1.0 |
| `b_oillamp` | `vintage_oil_lamp.glb` | [vintage_oil_lamp](https://polyhaven.com/a/vintage_oil_lamp) | Monsta3D | CC0 1.0 |
| `b_candlestick` | `wooden_candlestick.glb` | [wooden_candlestick](https://polyhaven.com/a/wooden_candlestick) | Josh Dean | CC0 1.0 |
| `b_lantern` | `Lantern_01.glb` | [Lantern_01](https://polyhaven.com/a/Lantern_01) | Rajil Jose Macatangay | CC0 1.0 |
| `b_mantelclock` | `mantel_clock_01.glb` | [mantel_clock_01](https://polyhaven.com/a/mantel_clock_01) | Yann Kervran, Rico Cilliers | CC0 1.0 |
| `b_daybed` | `vintage_day_bed.glb` | [vintage_day_bed](https://polyhaven.com/a/vintage_day_bed) | Aron Łyczek | CC0 1.0 |
| `b_sidetable` | `WoodenTable_02.glb` | [WoodenTable_02](https://polyhaven.com/a/WoodenTable_02) | Fran Calvente | CC0 1.0 |
| `b_cabinet` | `painted_wooden_cabinet.glb` | [painted_wooden_cabinet](https://polyhaven.com/a/painted_wooden_cabinet) | Kirill Sannikov | CC0 1.0 |
| `b_basket` | `wicker_basket_01.glb` | [wicker_basket_01](https://polyhaven.com/a/wicker_basket_01) | Kuutti Siitonen | CC0 1.0 |
| `b_suitcase` | `vintage_suitcase.glb` | [vintage_suitcase](https://polyhaven.com/a/vintage_suitcase) | Maximilian Schuster | CC0 1.0 |
| `b_jug` | `jug_01.glb` | [jug_01](https://polyhaven.com/a/jug_01) | Kuutti Siitonen | CC0 1.0 |
| `b_bowl` | `wooden_bowl_01.glb` | [wooden_bowl_01](https://polyhaven.com/a/wooden_bowl_01) | Oliver Harries | CC0 1.0 |

### From Gacha Garage (the owner's gashapon game), converted with lowpix

| Game id | Gacha Garage file | Source | Author | Licence |
|---|---|---|---|---|
| `g_plant` | `models/lowpix/world/plant_pot2.glb` | [Potted Plant 02](https://polyhaven.com/a/potted_plant_02) | Rico Cilliers | CC0 1.0 |
| `g_books` | `models/lowpix/world/books_old.glb` | ["Stack Of Old Books"](https://sketchfab.com/3d-models/stack-of-old-books-c6ca6667fd7d4381bd184874dcf44075) | Arjun Perayil | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `g_pothos` | `models/lowpix/world/plant_pothos.glb` | ["Pothos Plant"](https://sketchfab.com/3d-models/pothos-plant-175142c4942b42169455eb20c4033c9d) | Blizzy | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `g_aloe` | `models/lowpix/world/aloe_pot.glb` | ["Potted Aloe Vera"](https://sketchfab.com/3d-models/potted-aloe-vera-98b96bd41a1c4ab7af10c938e280c8c8) | Jubbies | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `g_teapot` | `models/lowpix/world/teapot_enamel.glb` | ["Old Soviet teapot"](https://sketchfab.com/3d-models/old-soviet-teapot-9b087673052446299e6decda222a42da) | Amagitsune | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `g_radio` | `models/lowpix/world/radio_old.glb` | ["Radio"](https://sketchfab.com/3d-models/radio-bb832f8973ad40af8321fb90854be3b6) | ion_omat | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `g_gramophone` | `models/lowpix/world/gramophone.glb` | ["Old Gramophone"](https://sketchfab.com/3d-models/old-gramophone-5e892fc786db4ca1b36738ab5e40e64d) | KIFIR | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

CC BY 4.0 attributions: each of the CC BY models above is "based on" the named work by the named author, licensed
under CC BY 4.0; modified (converted with lowpix by Gacha Garage, then recoloured, re-encoded and rescaled for Hoot
Hollow).

## Photo textures used to paint the hand-made props

The lowpix specs in `art/lowpix/interview/` photo-bash these Poly Haven textures (CC0 1.0; downscaled copies in
`art/lowpix/interview/photos/`, each with a `source.json`): oak_veneer_01, wood_table_001, weathered_planks,
painted_plaster_wall, rough_linen, hessian_230, velour_velvet, brown_leather, knitted_fleece, bark_brown_02.

## Made for Hoot Hollow

The room shell (heartwood walls, wainscot, floor, ceiling, bark rim), the wall clock with moving hands, the round
window, curtains, cork board, rug, ivy, teacup, papers, inkwell, books, candle, name block, wall shelf, painting,
globe, Pip's glasses and clipboard, and the vignette props (pillow, sheep, fence, phone, microphone, milk bottle,
coffee beans, mugs, stove, open book, sunflower) are modelled in lowpix by this project.
