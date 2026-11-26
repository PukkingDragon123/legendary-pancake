# Credits: the loading clock and Hollow & Co.'s office (builder intro4)

The loading clock (`index.html` boot block, `public/models/interview/clock.png`) is painted in code by
`src/onboard/tools/bootart.mjs`. The interview's form layer (paper, leather folio, brass clip, ink boxes and ticks,
rubber-stamp impressions, sticky note, acorns) is painted in code by `src/onboard/panelart.ts`. The office (walls,
parquet, rug, coffered ceiling, desk, bookcases and books, credenza, filing cabinets, banker's lamp, nameplate,
carafe, fountain pen, rubber stamp and ink pad, client folder, sconces, fig trees, the bracket clock) is modelled
and textured in code for Hoot Hollow (`src/onboard/{furnish,desk,mats,tex,wallclock}.ts`).

## Borrowed models

Packed by `src/onboard/tools/packglb.mjs` into `public/models/interview/cards.glb` (answer objects in the interview:
the day bed, the sheep, the alarm clock, the pocket watch, the nightstand) and `office.glb` (props in the office).
Models marked *lowpix* were converted for Hoot Hollow with the lowpix tool (pixel-HD style: decimated, one painted
colour atlas, WebP); the others were already converted by the project named in the Via column (BUSHED and Gacha
Garage are the owner's other games, which ship these models with the same credits). All were rescaled, re-encoded
and packed for Hoot Hollow. (The interview's other answer objects are modelled and painted in code: see intro5.md.)

| Node | Pack | Original | Author | Licence | Via |
|---|---|---|---|---|---|
| `daybed` | cards | [Vintage Day Bed](https://polyhaven.com/a/vintage_day_bed) (Poly Haven) | Aron Łyczek | CC0 1.0 | BUSHED |
| `sheep` | cards | ["Sheep"](https://sketchfab.com/3d-models/sheep-08b05ae799d947f1a68c49b2d661eb53) | kenchoo | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | lowpix |
| `alarm` | cards | [Alarm Clock 01](https://polyhaven.com/a/alarm_clock_01) (Poly Haven) | Yann Kervran, James Ray Cock | CC0 1.0 | lowpix |
| `nightstand` | cards | [Classic Nightstand 01](https://polyhaven.com/a/ClassicNightstand_01) (Poly Haven) | Kirill Sannikov | CC0 1.0 | Gacha Garage |
| `watch` | cards | [Vintage Pocket Watch](https://polyhaven.com/a/vintage_pocket_watch) (Poly Haven) | Tal Swicegood | CC0 1.0 | Gacha Garage |
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

The forms are printed in the game's own typefaces, Alegreya and Alegreya SC (SIL Open Font License, credited in
`font12.md`).
