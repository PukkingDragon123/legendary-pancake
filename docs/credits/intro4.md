# Credits: the loading clock and Hollow & Co.'s office (builder intro4)

The loading clock (`index.html` boot block, `public/models/interview/clock.png`) is painted in code by
`src/onboard/tools/bootart.mjs`. The office (walls, parquet, rug, coffered ceiling, desk, wingback, bookcases and
books, credenza, filing cabinets, writing slope, banker's lamp, desk phone, nameplate, trays, carafe, fountain pen,
rubber stamp, folder, carriage clock, sconces, leaf-card fig trees, the diorama vitrine and most of its little
scenes) is modelled and textured in code for Hoot Hollow (`src/onboard/{furnish,desk,mats,tex,wallclock,dioramas}.ts`).

## Borrowed props (packed into `public/models/interview/props.glb` by `src/onboard/tools/packglb.mjs`)

Restyled earlier for Hoot Hollow (colour atlas graded, matte finish, WebP) by the interview3 builder; used here at
diorama scale under the glass cloche.

| Node | Source | Original | Author | Licence |
|---|---|---|---|---|
| `daybed` | BUSHED (the owner's lumberjack game) `vintage_day_bed.glb` | [vintage_day_bed](https://polyhaven.com/a/vintage_day_bed) (Poly Haven) | Aron Łyczek | CC0 1.0 |
| `radio` | Gacha Garage `models/lowpix/world/radio_old.glb` | ["Radio"](https://sketchfab.com/3d-models/radio-bb832f8973ad40af8321fb90854be3b6) | ion_omat | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `gramophone` | Gacha Garage `models/lowpix/world/gramophone.glb` | ["Old Gramophone"](https://sketchfab.com/3d-models/old-gramophone-5e892fc786db4ca1b36738ab5e40e64d) | KIFIR | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `teapot` | Gacha Garage `models/lowpix/world/teapot_enamel.glb` | ["Old Soviet teapot"](https://sketchfab.com/3d-models/old-soviet-teapot-9b087673052446299e6decda222a42da) | Amagitsune | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

CC BY 4.0 attributions: each CC BY model above is based on the named work by the named author, licensed under
CC BY 4.0; modified (converted with lowpix by Gacha Garage, recoloured, re-encoded, rescaled and packed for Hoot
Hollow).

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
