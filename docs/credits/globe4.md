# Credits: the Earth and the places (globe, round 4)

Everything listed here is public domain, CC0 or CC BY. The globe stage, its shaders, the place view and the
tools in `src/world/globe/tools/` were made for Hoot Hollow.

## The Earth (`public/models/globe/`, built by `src/world/globe/tools/earth_textures.py` and `borders.py`)

- **Day map**: NASA Blue Marble Next Generation (land) and Blue Marble with shaded bathymetry (seas), NASA Earth
  Observatory / NASA Goddard (Reto Stöckli), public domain, fetched from NASA GIBS
  (https://gibs.earthdata.nasa.gov, layers `BlueMarble_NextGeneration`, `BlueMarble_ShadedRelief_Bathymetry`).
- **Land / water mask**: NASA MODIS land-water mask 2015 (GIBS `MODIS_Terra_L3_Land_Water_Mask`), public domain.
- **City lights**: NASA Earth Observatory / NOAA NGDC, VIIRS city lights 2012 (Black Marble), public domain
  (GIBS `VIIRS_CityLights_2012`).
- **Relief (bump and sea mask)**: NOAA NCEI ETOPO1 global relief, ice surface (Amante and Eakins 2009), public
  domain, via NOAA CoastWatch ERDDAP (https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo180.html).
- **Clouds**: Solar System Scope, "8k Earth Clouds" (https://www.solarsystemscope.com/textures/), based on NASA
  imagery, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Shrunk to 4096 x 2048 and levelled.
- **The Milky Way**: ESO / S. Brunier, "The Milky Way panorama" (https://www.eso.org/public/images/eso0932a/),
  CC BY 4.0. Shrunk to 2048 x 1024.
- **Borders and country outlines**: Natural Earth 1:50m admin-0 boundary lines and map units, v5.1.2
  (https://www.naturalearthdata.com), public domain, via https://github.com/nvkelso/natural-earth-vector.
- **Close-ups of each place** (the satellite tile in each place's sheet): NASA Blue Marble Next Generation and its
  bathymetry version with the MODIS land-water mask, from NASA GIBS, public domain.

## Photographs of the places (`public/img/places/<place>.webp`, `places.webp`)

Three photographs per place, found through Openverse (https://openverse.org, licence filter CC0 / public domain /
CC BY) and downloaded from Flickr at 1024 px; cropped to 3:2 (`src/world/globe/tools/place_photos.py`, choices in
`photo_picks.py`). Shown in the place view with their captions and an in-app credit line. CC BY 2.0:
https://creativecommons.org/licenses/by/2.0/ (the photos were cropped and resized). CC0:
https://creativecommons.org/publicdomain/zero/1.0/.

<!-- photos -->
| place | photo | title | author | licence |
|---|---|---|---|---|
| highlands | Eilean Donan Castle | [Eilean Donan castle at dusk](https://www.flickr.com/photos/35854555@N04/3819489715) | Eusebius@Commons | CC BY 2.0 |
| highlands | A waterfall in Glen Coe | [Glencoe, Scotland, Sept. 2010](https://www.flickr.com/photos/42033648@N00/5020265568) | In Memoriam: PhillipC | CC BY 2.0 |
| highlands | A Highland cow | [Highland Cow](https://www.flickr.com/photos/94821490@N07/38857345521) | ashley98lee | CC BY 2.0 |
| kyoto | The torii gates of Fushimi Inari | [Fushimi Inari torii](https://www.flickr.com/photos/128275472@N07/51471915702) | 雷太 | CC BY 2.0 |
| kyoto | The bamboo grove of Arashiyama | [Arashiyama Bamboo Forest Kyoto](https://www.flickr.com/photos/147881710@N02/32663187511) | roan.retera | CC0 |
| kyoto | Gion’s lanes after the rain | [gion district](https://www.flickr.com/photos/67162482@N07/6122839290) | David Offf | CC BY 2.0 |
| paris | The Eiffel Tower | [Tour Eiffel - HDR - Eiffel Tower Paris](https://www.flickr.com/photos/90325628@N00/869942883) | www.alfieianni.com | CC BY 2.0 |
| paris | Pont Alexandre III over the Seine | [Pont Alexandre III, Paris](https://www.flickr.com/photos/63234672@N04/12334157545) | Mustang Joe | CC0 |
| paris | A café on a Paris corner | [Paris Cafe](https://www.flickr.com/photos/17375134@N00/2294848759) | Pat Guiney | CC BY 2.0 |
| venice | The Grand Canal | [Hotel Ca' Sagredo - Grand Canal - Venice Italy Venezia - photo by gnuckx and HDR processing by Mike G. K.](https://www.flickr.com/photos/34409164@N06/4734093444) | gnuckx | CC0 |
| venice | A gondola in a quiet canal | [Venice - Gondola ride - Rio di Palazzo - EU, Italian and Veneto flags](https://www.flickr.com/photos/39415781@N06/4832353308) | ell brown | CC BY 2.0 |
| venice | A carnival mask | [Venice carnival mask](https://www.flickr.com/photos/59367690@N00/5536311011) | neiljs | CC BY 2.0 |
| santorini | Sunset over Oia | [Sunset in Oia - Santorini, Greece - Travel photography](https://www.flickr.com/photos/87690240@N03/40744353083) | Giuseppe Milo (www.pixael.com) | CC BY 2.0 |
| santorini | The cliffs of the caldera | [Santorini Caldera hiking trail](https://www.flickr.com/photos/8721758@N06/40683384163) | Jorge Lascar | CC BY 2.0 |
| santorini | A blue-domed chapel | [Blue Dome in Santorini](https://www.flickr.com/photos/31176607@N05/51922219490) | kuhnmi | CC BY 2.0 |
| sahara | The dunes of Erg Chebbi | [Erg Chebbi Dunes](https://www.flickr.com/photos/14736601@N00/7963972876) | scott.presly | CC BY 2.0 |
| sahara | A camel caravan | [Erg Chebbi](https://www.flickr.com/photos/37949912@N00/1117031588) | fulito | CC BY 2.0 |
| sahara | Lanterns in a Marrakech souk | [11historic_marrakesh](https://www.flickr.com/photos/142508741@N02/29835827210) | thegoldenraven | CC BY 2.0 |
| grandcanyon | Evening light on the canyon | [Grand Canyon](https://www.flickr.com/photos/47824692@N00/2614575323) | Paul Fundenburg | CC BY 2.0 |
| grandcanyon | Rafts on the Colorado River | [13 Mile Camp (Supai Ledges) on the Colorado River. Grand Canyon National Park, Arizona](https://www.flickr.com/photos/59306007@N08/25780794483) | Paxson Woelber | CC BY 2.0 |
| grandcanyon | A log cabin on the North Rim | [Grand Canyon Lodge North Rim 0498](https://www.flickr.com/photos/50693818@N08/5572269398) | Grand Canyon NPS | CC BY 2.0 |
| cappadocia | Balloons at sunrise | [Cappadocia Balloon Valley, A Must see if u ever Visit Turkie.. Pictures do it no Justice when Between 200-400 Ballons headed for the Sky.](https://www.flickr.com/photos/58739232@N07/49123677277) | Rab . | CC BY 2.0 |
| cappadocia | Fairy chimneys | [CAPPADOCIA Göreme National Park and the Rock Sites. World Heritage List. Pasabag (Monks Valley)](https://www.flickr.com/photos/11773439@N03/44548772264) | Feridun F. Alkaya | CC0 |
| cappadocia | Turkish tea in a tulip glass | [turkish tea](https://www.flickr.com/photos/25921232@N02/3468694332) | TURCOLIVE | CC BY 2.0 |
| tajmahal | The Taj Mahal | [Taj Mahal](https://www.flickr.com/photos/23503766@N02/2466310898) | particlem | CC BY 2.0 |
| tajmahal | The red gates of Agra Fort | [Agra Fort](https://www.flickr.com/photos/91418149@N03/8362157809) | M1key.me | CC BY 2.0 |
| tajmahal | Spices in the market | [Indian Spices](https://www.flickr.com/photos/8237601@N06/8170948596) | sara marlowe | CC BY 2.0 |
| iceland | Kirkjufell and its waterfall | [Kirkjufell](https://www.flickr.com/photos/120486077@N08/29652330972) | Marco Nürnberger | CC BY 2.0 |
| iceland | A seal among the icebergs of Jökulsárlón | [jokulsarlon](https://www.flickr.com/photos/45623007@N00/2825860068) | David Barrena | CC BY 2.0 |
| iceland | An Icelandic horse | [Iceland Horse](https://www.flickr.com/photos/37996646802@N01/3005411570) | cogdogblog | CC0 |
| machupicchu | Machu Picchu | [Machu Picchu](https://www.flickr.com/photos/79721788@N00/7914096100) | D-Stanley | CC BY 2.0 |
| machupicchu | The Sacred Valley and the Andes | [Snows of the Andes](https://www.flickr.com/photos/79721788@N00/7914098320) | D-Stanley | CC BY 2.0 |
| machupicchu | Llamas above the valley | [llama_1](https://www.flickr.com/photos/86507374@N00/608564416) | jnissa | CC BY 2.0 |
| amazon | Mist over the rainforest river | [Ecuadorian Amazon](https://www.flickr.com/photos/31867959@N04/7429245768) | Dallas Krentzel | CC BY 2.0 |
| amazon | A squirrel monkey in the palms | [Squirrel Monkeys](https://www.flickr.com/photos/145873402@N07/29799831553) | soleqtravel | Public domain |
| amazon | A toucan | [Toucan](https://www.flickr.com/photos/22317744@N00/474300954) | rougenair | CC BY 2.0 |
| serengeti | Elephants under an acacia | [Elephants - Serengeti National Park safari - Tanzania, Africa](https://www.flickr.com/photos/25897810@N00/5699832418) | David Berkowitz | CC BY 2.0 |
| serengeti | The Great Migration | [Wildebeest migration](https://www.flickr.com/photos/30957160@N04/2908281814) | daretothink | CC BY 2.0 |
| serengeti | Lions having a nap | [Afternoon Nap / Serengeti / Tanzania](https://www.flickr.com/photos/126011817@N06/24259107931) | fotopamas | CC BY 2.0 |
| banff | Moraine Lake | [Moraine Lake,Canada](https://www.flickr.com/photos/151415985@N06/36922523205) | Wallboat | CC0 |
| banff | Red canoes on Lake Louise | [Lake Louise, Banff National Park](https://www.flickr.com/photos/47096398@N08/6151699478) | eleephotography | CC BY 2.0 |
| banff | An elk in the meadow | [Elk, Banff NP Alberta Canada](https://www.flickr.com/photos/45939540@N05/5991565284) | JonoMueller | CC BY 2.0 |
| petra | Al-Khazneh, the Treasury | [The Treasury at Petra](https://www.flickr.com/photos/79721788@N00/34920138613) | D-Stanley | CC BY 2.0 |
| petra | The red sands of Wadi Rum | [Wadi Rum, the valley where T. E. Lawrence (Lawrence of Arabia) passed by during the Arab Revolt, and a group of camels](https://www.flickr.com/photos/8721758@N06/12464804945) | Jorge Lascar | CC BY 2.0 |
| petra | The Monastery, high in the hills | [Petra Monastery, Jordan](https://www.flickr.com/photos/187995964@N02/49786724847) | likemytravel | CC BY 2.0 |
| angkor | Angkor Wat | [Angkor Wat](https://www.flickr.com/photos/67769030@N07/6198305217) | Arian Zwegers | CC BY 2.0 |
| angkor | Tree roots over Ta Prohm | [Angkor, Ta Prohm](https://www.flickr.com/photos/67769030@N07/6217471257) | Arian Zwegers | CC BY 2.0 |
| angkor | The smiling faces of the Bayon | [Bayon Faces](https://www.flickr.com/photos/19843152@N00/2727104879) | AdmlCrunch | CC BY 2.0 |
| reef | The reef from the air | [Amazing Great Barrier Reef](https://www.flickr.com/photos/86665756@N00/4251357083) | Studio Sarah Lou | CC BY 2.0 |
| reef | The white sands of Whitehaven | [Whitehaven Beach](https://www.flickr.com/photos/63906808@N00/2410446648) | yarra64 | CC BY 2.0 |
| reef | A green sea turtle | [Sea Turtle on the Great Barrier Reef](https://www.flickr.com/photos/94820671@N06/8634011239) | gjhamley | CC BY 2.0 |
| rio | Christ the Redeemer | [Mike Vondran at Christ the Redeemer, Corcovado, Rio de Janeiro, Brazil, December 30 2008.](https://www.flickr.com/photos/99646599@N00/3184871233) | over_kind_man | CC BY 2.0 |
| rio | Sugarloaf Mountain over the bay | [Sugarloaf Mountain, Rio](https://www.flickr.com/photos/43175472@N03/8082560161) | Sam Beddoes | CC BY 2.0 |
| rio | The tiled Selarón Steps | [rio de janeiro, escadaria selaron](https://www.flickr.com/photos/42873375@N08/28818187741) | armingruber | CC BY 2.0 |
| milford | Mitre Peak | [milford sound](https://www.flickr.com/photos/99771506@N00/8237971913) | paul bica | CC BY 2.0 |
| milford | Lupins by a Fiordland lake | [Lupins at sunset beside Hollyford River, Fiordland, New Zealand](https://www.flickr.com/photos/126110866@N08/45340054155) | larrywkoester | CC BY 2.0 |
| milford | A kea, the mountain parrot | [The Kea New Zealand.](https://www.flickr.com/photos/88123769@N02/11876479235) | Bernard Spragg | CC0 |
| antarctica | Peaks of the Antarctic Peninsula | [Antarctica sky and ice](https://www.flickr.com/photos/10978010@N07/12434752073) | londoncyclist | CC BY 2.0 |
| antarctica | A blue iceberg | [Blue Ice](https://www.flickr.com/photos/79721788@N00/52049204965) | D-Stanley | CC BY 2.0 |
| antarctica | Gentoo penguins | [Gentoo Penguins](https://www.flickr.com/photos/79721788@N00/16054445089) | D-Stanley | CC BY 2.0 |
<!-- /photos -->

## Souvenir models (`public/models/souvenirs/`)

Brought in with Blender (`src/world/globe/tools/souvenir_import.py`: joined, simplified, textures shrunk to WebP,
rescaled and stood on the floor) and compressed with glTF-Transform (meshopt). CC BY 4.0:
https://creativecommons.org/licenses/by/4.0/ (the models were simplified, rescaled and recompressed).

| souvenir | model | author | licence |
|---|---|---|---|
| `sv_highlandcow` Highland Cow Plush | [Highland Cow](https://sketchfab.com/3d-models/highland-cow-63b31445ac7249d3a02e1242d0a9be15) | JessSwynn | CC BY 4.0 |
| `sv_gondola` Gondola Model | [Gondola](https://sketchfab.com/3d-models/gondola-9f2a7e32570641269d2550bfc7421181) | mrTorch | CC BY 4.0 |
| `sv_puffin` Puffin Figurine | [Atlantic Puffin - Low poly](https://sketchfab.com/3d-models/atlantic-puffin-low-poly-00c3f6de0c5b494bbf2885ff99ee6b96) | Troels BP | CC BY 4.0 |
| `sv_llama` Ceramic Llama | [Llama peruana en cerámica low poly](https://sketchfab.com/3d-models/llama-peruana-en-ceramica-low-poly-1b53690dc6aa4941bcdcc3a0225efb28) | José Somolinos | CC BY 4.0 |
| `sv_toucan` Toucan Perch | [TAUCAN](https://sketchfab.com/3d-models/taucan-8addf94744fe40ba9b3d635996c1ecfd) | wasis007 | CC BY 4.0 |
| `sv_canoe` Cedar Canoe | [Canoe](https://sketchfab.com/3d-models/canoe-3a695cf8eb1948debddd803ec25f869e) | Little._.Ting | CC BY 4.0 |
| `sv_kiwi` Kiwi Figurine | [Low Poly Kiwi Run](https://sketchfab.com/3d-models/low-poly-kiwi-run-c76188eb5b954ef3b88293ab21b9093d) | naomimoore | CC BY 4.0 |
| `sv_penguin` Emperor Penguin | [Emperor penguin (Пингвин императорский)](https://sketchfab.com/3d-models/emperor-penguin-c698d3e3f4564103a7bbf1ce4b9fdf3e) | darwinmuseum.ru | CC BY 4.0 |
| `sv_tajmodel` Marble Taj Mahal | [taj mahal](https://sketchfab.com/3d-models/taj-mahal-f72ea2449b6d4564b0f2615e65b57444) | yongtun | CC BY 4.0 |
| `sv_canyondiorama` Canyon Diorama | [Grand Canyon & Little Colorado River Confluence](https://sketchfab.com/3d-models/grand-canyon-little-colorado-river-confluence-87a2367f943a497983e1395da52d660a) | Nate Loper  🗺️ ⛏🏺 | CC BY 4.0 |
| `sv_venicemask` Venetian Mask | [Carnival mask - Venice](https://sketchfab.com/3d-models/carnival-mask-venice-beff6e12e86e4842999a955ca233f0cf) | alexander.ros | CC BY 4.0 |
| `sv_lotuslamp` Lotus Lamp | [Prop Modelling: Candleholder](https://sketchfab.com/3d-models/prop-modelling-candleholder-f0b55af43c8b48e5b9f3e0fae392dcc3) | ZoeChuiYan | CC BY 4.0 |
| `sv_sambadrum` Samba Drum | [East Kent Local Militia Bass Drum](https://sketchfab.com/3d-models/east-kent-local-militia-bass-drum-acc19a79473b4e15a4875f583fb12762) | artfletch | CC BY 4.0 |
| `sv_elephant` Elephant Carving | [Carved Wooden Elephant](https://polyhaven.com/a/carved_wooden_elephant) | Greg Zaal (Poly Haven) | CC0 1.0 |

The other souvenirs are as credited in `docs/credits/globe.md`.

## Tools

- glTF-Transform (MIT, Don McCurdy) for meshopt compression, at build time only.
