# Credits: the globe (The Wide World), postcards and souvenirs

Everything not listed here (stamps, pins, the souvenirs modelled in lowpix) was made for Hoot Hollow. Twelve souvenirs
were replaced in round 4 by detailed borrowed models (see `docs/credits/globe4.md`).

## Earlier globe pieces

The round-3 painted planet texture and the round-3 place photographs are no longer used (the globe and the
photos of round 4 are credited in `docs/credits/globe4.md`).


## Borrowed souvenir models

Copied from the user's game **Gacha Garage** (`public/models/lowpix/world/*.glb`, restyled there with lowpix
pixel-hd), rescaled and re-rooted for the house by `art/lowpix/souvenirs/_kit/borrow.py`. Upstream authors as
listed in Gacha Garage's `CREDITS.md`:

| souvenir | Gacha Garage file | original | author | licence |
|---|---|---|---|---|
| `sv_kyotolantern` Kyoto Paper Lantern | `chochin.glb` | Japanese Lamp / Chōchin, https://sketchfab.com/3d-models/japanese-lamp-chochin-6fd5dcdb4702409a8be04e5f0fb2c316 | i bull your wife | CC BY 4.0 |
| `sv_torii` Little Torii Gate | `torii.glb` | Japanese Torii Gate, https://sketchfab.com/3d-models/japanese-torii-gate-2027a248de1b4b70985ff97e708fb50d | Sahir Virmani | CC BY 4.0 |
| `sv_macarons` Macaron Tower | `macaron_tower.glb` | Macaron tower, https://sketchfab.com/3d-models/macaron-tower-6511ba02a0df442aa734644dbcb4b27a | sion0211 | CC BY 4.0 |
| `sv_bust` Marble Bust | `bust_marble.glb` | Marble Bust 01, https://polyhaven.com/a/marble_bust_01 | Rico Cilliers | CC0 1.0 |
| `sv_conch` Spider Conch Shell | `shell_giant.glb` | Lambis Shell, https://polyhaven.com/a/lambis_shell | Kuutti Siitonen | CC0 1.0 |
| `sv_cavaquinho` Cavaquinho | `ukulele.glb` | Ukulele 01, https://polyhaven.com/a/Ukulele_01 | Joseph Burgan | CC0 1.0 |

CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ (attribution above; the models were converted and
rescaled).

## Photo textures (build time only)

Poly Haven textures, CC0 1.0, used as relief in the lowpix specs of the modelled souvenirs
(`art/lowpix/souvenirs/_kit/photos`, downscaled copies from the furniture builders' kit):
bark_brown_02, brown_leather, clay_floor_001, hessian_230, jersey_melange, knitted_fleece, metal_plate_02,
oak_veneer_01, rock_face_03, rough_linen, velour_velvet, wood_table_001 (https://polyhaven.com/a/<name>).

## Code

- `art/lowpix/souvenirs/_kit/kit.py` and `build.py` are adapted from the furniture builders' lowpix kit
  (`art/lowpix/items/_furnA`), same project.
- lowpix (the user's modelling tool) builds the souvenir GLBs.
