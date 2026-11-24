# Credits: the loading clock and Hollow & Co.'s office (builder intro4)

The loading clock (`index.html` boot block, `public/models/interview/clock.png`) is painted in code by
`src/onboard/tools/bootart.mjs`. The interview's form layer (paper, leather folio, brass clip, ink boxes and ticks,
rubber-stamp impressions, sticky note, acorns) is painted in code by `src/onboard/panelart.ts`. The office (walls,
parquet, rug, coffered ceiling, desk, bookcases and books, credenza, filing cabinets, banker's lamp, nameplate,
carafe, fountain pen, rubber stamp and ink pad, client folder, sconces, fig trees, the bracket clock) is modelled
and textured in code for Hoot Hollow (`src/onboard/{furnish,desk,mats,tex,wallclock}.ts`).

## Borrowed models

Packed by `src/onboard/tools/packglb.mjs` into `public/models/interview/cards_a.glb` and `cards_b.glb` (the live
models in the answer cards) and `office.glb` (props in the office). Models marked *lowpix* were converted for Hoot
Hollow with the lowpix tool (pixel-HD style: decimated, one painted colour atlas, WebP); the others were already
converted by the project named in the Via column (BUSHED and Gacha Garage are the owner's other games, which
ship these models with the same credits). All were rescaled, re-encoded and packed for Hoot Hollow.

| Node | Pack | Original | Author | Licence | Via |
|---|---|---|---|---|---|
| `daybed` | cards_a | [Vintage Day Bed](https://polyhaven.com/a/vintage_day_bed) (Poly Haven) | Aron Łyczek | CC0 1.0 | BUSHED |
| `sheep` | cards_a | ["Sheep"](https://sketchfab.com/3d-models/sheep-08b05ae799d947f1a68c49b2d661eb53) | kenchoo | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | lowpix |
| `phone` | cards_a | ["Low Poly Mobile Phone"](https://sketchfab.com/3d-models/low-poly-mobile-phone-4ff99cf17b164e7b9790638c5d2ef4ce) | kimmy.k | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | lowpix |
| `headphones` | cards_a | ["Headphones"](https://sketchfab.com/3d-models/headphones-2f54d1c5d3c943bfadc72ab656587c90) | ~Drift~ | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage |
| `candles` | cards_a | [Brass Candleholders](https://polyhaven.com/a/brass_candleholders) (Poly Haven) | Tina | CC0 1.0 | lowpix |
| `alarm` | cards_a | [Alarm Clock 01](https://polyhaven.com/a/alarm_clock_01) (Poly Haven) | Yann Kervran, James Ray Cock | CC0 1.0 | lowpix |
| `cabinet` | cards_a | [Vintage Cabinet 01](https://polyhaven.com/a/vintage_cabinet_01) (Poly Haven) | Rico Cilliers | CC0 1.0 | BUSHED, lowpix |
| `nightstand` | cards_a | [Classic Nightstand 01](https://polyhaven.com/a/ClassicNightstand_01) (Poly Haven) | Kirill Sannikov | CC0 1.0 | Gacha Garage |
| `watch` | cards_a | [Vintage Pocket Watch](https://polyhaven.com/a/vintage_pocket_watch) (Poly Haven) | Tal Swicegood | CC0 1.0 | Gacha Garage |
| `milk` | cards_a | milk carton, made for Gacha Garage | Gacha Garage | CC0 1.0 | Gacha Garage |
| `mug` | cards_a | ["Cup"](https://sketchfab.com/3d-models/cup-7d450bb714034fceaa7b59a0e564f46b) | Dmytro Nikonov | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | lowpix |
| `teapot` | cards_a | ["Old Soviet teapot"](https://sketchfab.com/3d-models/old-soviet-teapot-9b087673052446299e6decda222a42da) | Amagitsune | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage |
| `pillows` | cards_b | [Throw Pillows 01](https://polyhaven.com/a/throw_pillows_01) (Poly Haven) | Serhii Khromov | CC0 1.0 | lowpix |
| `umbrella` | cards_b | ["Elegant umbrella"](https://sketchfab.com/3d-models/elegant-umbrella-ca9bb8c8ffc640c6a9be8ad5f341c9c4) | Araon | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | lowpix (recoloured in code) |
| `shell` | cards_b | [Lambis Shell](https://polyhaven.com/a/lambis_shell) (Poly Haven) | Kuutti Siitonen | CC0 1.0 | Gacha Garage |
| `pine` | cards_b | garden pine, made for Gacha Garage (bark from [Pine Bark](https://polyhaven.com/a/pine_bark), Poly Haven) | Gacha Garage | CC0 1.0 | Gacha Garage |
| `firepit` | cards_b | [Stone Fire Pit](https://polyhaven.com/a/stone_fire_pit) (Poly Haven) | Sebastian Platen | CC0 1.0 | BUSHED, lowpix |
| `rocks` | cards_b | [Rock Moss Set 02](https://polyhaven.com/a/rock_moss_set_02) (Poly Haven) | Kless Gyzen | CC0 1.0 | BUSHED, lowpix |
| `paperlantern` | cards_b | ["Japanese paper lantern"](https://sketchfab.com/3d-models/japanese-paper-lantern-99a3c92192d04d088c9241d1cab3e765) | patrakeevasveta | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage |
| `radio` | cards_b | ["Radio"](https://sketchfab.com/3d-models/radio-bb832f8973ad40af8321fb90854be3b6) | ion_omat | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage |
| `gramophone` | cards_b | ["Old Gramophone"](https://sketchfab.com/3d-models/old-gramophone-5e892fc786db4ca1b36738ab5e40e64d) | KIFIR | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage |
| `lantern` | cards_b | [Lantern 01](https://polyhaven.com/a/Lantern_01) (Poly Haven) | Rajil Jose Macatangay | CC0 1.0 | BUSHED, lowpix |
| `books` | cards_b | [Book Encyclopedia Set 01](https://polyhaven.com/a/book_encyclopedia_set_01) (Poly Haven) | John Malcolm | CC0 1.0 | lowpix |
| `armchair` | office | [Arm Chair 01](https://polyhaven.com/a/ArmChair_01) (Poly Haven) | Kirill Sannikov | CC0 1.0 | lowpix |
| `phone` | office | ["Classic Telephone"](https://sketchfab.com/3d-models/classic-telephone-1b3929f627a141be92f0c8c16a3ba296) | irtizasb | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage |
| `typewriter` | office | ["1930s style typewriter - w/o branding"](https://sketchfab.com/3d-models/1930s-style-typewriter-wo-branding-1d6009449fe84fd79454c4081eb743bf) | Kuba "Volant" Wójcik | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Gacha Garage |

CC BY 4.0 attributions: each CC BY model above is based on the named work by the named author, licensed under
CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); modified (converted to a low-poly pixel-art model,
recoloured or recoloured in use, re-encoded, rescaled and packed for Hoot Hollow).

The owls in the species cards are the game's own owl models.

## Wall art (real artworks, public domain)

Fetched by `src/onboard/tools/officeart.py` from the Art Institute of Chicago (API data CC0; these images are public
domain), downsampled to a pixel grid and packed into `public/models/interview/art.webp`.

| In the office | Work | Artist | Date | Source |
|---|---|---|---|---|
| the big landscape (right wall) | Catskill Mountains | George Inness | 1870 | [artic.edu/artworks/68388](https://www.artic.edu/artworks/68388) |
| the owl print (over the filing cabinets) | Small-horned owl, pine, and crescent moon | Utagawa Hiroshige | 1830s | [artic.edu/artworks/47526](https://www.artic.edu/artworks/47526) |
| the landscape by the door (left wall) | Landscape at Chailly | Frédéric Bazille | 1865 | [artic.edu/artworks/44017](https://www.artic.edu/artworks/44017) |

## Fonts

The forms are printed in m6x11plus and m5x7 by Daniel Linssen ([managore.itch.io](https://managore.itch.io/)),
free to use (credit appreciated), with Galmuri11 (Lee Minseo, SIL Open Font License) and the game's own TBME face.
