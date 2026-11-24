# Credits: the globe (The Wide World), postcards and souvenirs

Everything not listed here (the globe stage and stand, the painted planet texture, postcards, stamps, pins,
the 22 modelled souvenirs) was made for Hoot Hollow.

## Map data

- **Natural Earth 1:50m land** (public domain, https://www.naturalearthdata.com), via the `world-atlas` npm
  package 2.0.2 by Mike Bostock (ISC). Used only at build time to paint the coastlines of
  `public/models/globe/earth_*.png` (`src/world/globe/tools/paint_earth.py`). The biomes, mountains, rivers and
  town lights are hand-placed (`src/world/globe/tools/geo.py`).

## Photographs of the places

One photograph per place from **Wikimedia Commons** (found through each place's Wikipedia article, licence and
author read from the Commons file page; only public domain, CC0, CC BY and CC BY-SA files). Shrunk to 180 x 108,
graded and posterised into pixel art, and packed into `public/img/places/places.webp` by
`src/world/globe/tools/photo_atlas.py` (fetched by `fetch_photos.py`). They are shown on the postcards and as the
passport's postage stamps, each with an in-app credit line. CC BY-SA images: the adapted versions are shared under
the same licence. Licences: https://creativecommons.org/licenses/by/3.0/, https://creativecommons.org/licenses/by-sa/3.0/,
https://creativecommons.org/licenses/by-sa/4.0/ (and the other versions named below).

<!-- photos -->
| place | photograph | author | licence |
|---|---|---|---|
| highlands | [Eilean_Donan_Castle,_Scotland_-_Jan_2011.jpg](https://commons.wikimedia.org/wiki/File:Eilean_Donan_Castle%2C_Scotland_-_Jan_2011.jpg) | Diliff | CC BY-SA 3.0 |
| kyoto | [Torii path with lantern at Fushimi Inari Taisha Shrine, Kyoto, Japan.jpg](https://commons.wikimedia.org/wiki/File%3ATorii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg) | Basile Morin | CC BY-SA 4.0 |
| paris | [La_Tour_Eiffel_vue_de_la_Tour_Saint-Jacques,_Paris_août_2014_(2).jpg](https://commons.wikimedia.org/wiki/File:La_Tour_Eiffel_vue_de_la_Tour_Saint-Jacques%2C_Paris_ao%C3%BBt_2014_%282%29.jpg) | Yann Caradec from Paris, France | CC BY-SA 2.0 |
| venice | [Gondola_Ride.jpg](https://commons.wikimedia.org/wiki/File:Gondola_Ride.jpg) | Njsmith3 | CC BY-SA 4.0 |
| santorini | [Oia_sunset_-_panoramio_(2).jpg](https://commons.wikimedia.org/wiki/File:Oia_sunset_-_panoramio_%282%29.jpg) | TomasEE | CC BY 3.0 |
| sahara | [Merzouga_Dunes_2011.jpg](https://commons.wikimedia.org/wiki/File:Merzouga_Dunes_2011.jpg) | Bjørn Christian Tørrissen | CC BY-SA 3.0 |
| grandcanyon | [Canyon_River_Tree_(165872763).jpeg](https://commons.wikimedia.org/wiki/File:Canyon_River_Tree_%28165872763%29.jpeg) | Lennart Sikkema | CC BY 3.0 |
| cappadocia | [Cappadocia_balloon_trip,_Ortahisar_Castle_(11893715185).jpg](https://commons.wikimedia.org/wiki/File:Cappadocia_balloon_trip%2C_Ortahisar_Castle_%2811893715185%29.jpg) | Arian Zwegers from Brussels, Belgium | CC BY 2.0 |
| tajmahal | [Taj_Mahal_(Edited).jpeg](https://commons.wikimedia.org/wiki/File:Taj_Mahal_%28Edited%29.jpeg) | Yann ; edited by Jim Carter | CC BY-SA 4.0 |
| amazon | [Amazon17_(5641020319).jpg](https://commons.wikimedia.org/wiki/File:Amazon17_%285641020319%29.jpg) | CIAT | CC BY-SA 2.0 |
| iceland | [Kirkjufell_in_Iceland.jpg](https://commons.wikimedia.org/wiki/File:Kirkjufell_in_Iceland.jpg) | Anjali Kiggal | CC BY-SA 4.0 |
| machupicchu | [Machu_Picchu,_2023_(012).jpg](https://commons.wikimedia.org/wiki/File:Machu_Picchu%2C_2023_%28012%29.jpg) | Draceane | CC BY-SA 4.0 |
| serengeti | [Serengeti-Landscape-2012.JPG](https://commons.wikimedia.org/wiki/File:Serengeti-Landscape-2012.JPG) | Bjørn Christian Tørrissen | CC BY-SA 3.0 |
| banff | [Moraine_Lake_17092005.jpg](https://commons.wikimedia.org/wiki/File:Moraine_Lake_17092005.jpg) | Gorgo | Public domain |
| petra | [Al_khazneh.jpg](https://commons.wikimedia.org/wiki/File:Al_khazneh.jpg) | Susanahajer | CC BY-SA 3.0 |
| angkor | [Angkor_Wat.jpg](https://commons.wikimedia.org/wiki/File:Angkor_Wat.jpg) | Bjørn Christian Tørrissen | CC BY-SA 4.0 |
| reef | [ISS-45_StoryOfWater,_Great_Barrier_Reef,_Australia.jpg](https://commons.wikimedia.org/wiki/File:ISS-45_StoryOfWater%2C_Great_Barrier_Reef%2C_Australia.jpg) | NASA/Kjell Lindgren | Public domain |
| rio | [Cidade_Maravilhosa.jpg](https://commons.wikimedia.org/wiki/File:Cidade_Maravilhosa.jpg) | Rafael Rabello de Barros | CC BY-SA 3.0 |
| milford | [Milford_Sound_(New_Zealand).JPG](https://commons.wikimedia.org/wiki/File:Milford_Sound_%28New_Zealand%29.JPG) | Maros M r a z ( Maros ) | CC BY-SA 3.0 |
| antarctica | [Paradise_Harbour,_Antarctica_(6087257019).jpg](https://commons.wikimedia.org/wiki/File:Paradise_Harbour%2C_Antarctica_%286087257019%29.jpg) | Liam Quinn from Canada | CC BY-SA 2.0 |
<!-- /photos -->

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
| `sv_elephant` Elephant Carving | `elephant.glb` | Carved Wooden Elephant, https://polyhaven.com/a/carved_wooden_elephant | Greg Zaal | CC0 1.0 |
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
