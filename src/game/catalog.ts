// Everything Pip can find, buy and unlock: the twenty real places on the globe (with their souvenirs),
// collectible trinkets (legacy), store products, and the level and reward curves.
import { PIECES } from '../owl/outfits.ts';
import { PALETTES } from '../owl/palette.ts';
import { ALL_ITEMS } from '../world/scene.ts';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export const RARITY_COLOR: Record<Rarity, string> = { common: '#9aa58a', uncommon: '#5fa86a', rare: '#5b8fe0', legendary: '#e6a93a' };
export const RARITY_NAME: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' };

/** The five old fictional areas; each real place inherits one's outfit and coat finds. */
export type Kin = 'woods' | 'grotto' | 'lake' | 'caverns' | 'peak';
export type Continent = 'Europe' | 'Asia' | 'Africa' | 'North America' | 'South America' | 'Oceania' | 'Antarctica';

/** [globe] A real place on the globe that Pip can fly to at night. */
export interface Area {
  id: string;
  /** as it reads in a sentence: "Pip flies to the Sahara" */
  name: string;
  /** as it reads on its own: "The Sahara" */
  title: string;
  /** passport stamp text */
  stamp: string;
  country: string;
  continent: Continent;
  blurb: string;
  level: number;
  /** nights in a row needed (best streak, in addition to level) */
  streak?: number;
  lat: number; lon: number;
  /** flat-map position 0..1 (equirectangular, derived from lat/lon) */
  x: number; y: number;
  /** ink colour for flags, stamps and postcards */
  color: string;
  /** the old area whose outfits and coats turn up here */
  kin: Kin;
  /** souvenir item ids (src/assets/souvenirs.ts) Pip can bring home from here */
  souvenirs: string[];
  /** IANA zone for the postcard's local clock */
  tz: string;
  /** a few lines the story generator weaves together */
  sights: string[];
  friends: string[];
  deeds: string[];
}

type PlaceSpec = Omit<Area, 'x' | 'y'>;
const place = (a: PlaceSpec): Area => ({ ...a, x: (a.lon + 180) / 360, y: (90 - a.lat) / 180 });

export const AREAS: Area[] = ([
  place({
    id: 'highlands', name: 'the Scottish Highlands', title: 'The Scottish Highlands', stamp: 'HIGHLANDS', country: 'Scotland', continent: 'Europe',
    level: 1, lat: 57.1, lon: -4.7, color: '#7a6e9a', kin: 'woods', tz: 'Europe/London', souvenirs: ['sv_tartanrug', 'sv_highlandcow'],
    blurb: 'Misty lochs, purple heather and castles with one window still lit. Pip feels right at home.',
    sights: ['mist rolling over a silver loch', 'heather glowing purple in the moonlight', 'a ruined castle with one lit window', 'a waterfall tumbling into a peaty pool'],
    friends: ['a shaggy Highland cow called Morag', 'a red deer stag with very grand antlers', 'a pine marten who collects buttons', 'an otter fishing in the loch'],
    deeds: ['watched the ripples on Loch Ness (no monster, just a duck)', 'helped Morag find the sweetest patch of grass', 'hummed along to a far-off bagpipe', 'sheltered from the drizzle under a giant fern'],
  }),
  place({
    id: 'kyoto', name: 'Kyoto', title: 'Kyoto', stamp: 'KYOTO', country: 'Japan', continent: 'Asia',
    level: 1, lat: 35.0, lon: 135.8, color: '#b0645a', kin: 'grotto', tz: 'Asia/Tokyo', souvenirs: ['sv_kyotolantern', 'sv_torii'],
    blurb: 'Lantern-lit lanes, bamboo that creaks in the wind and a thousand orange gates up the mountain.',
    sights: ['a thousand orange torii gates climbing the mountain', 'paper lanterns glowing along a quiet lane', 'a bamboo grove creaking softly in the wind', 'koi drifting under a red bridge'],
    friends: ['a sika deer who bows very politely', 'a tanuki in a straw hat', 'an old temple cat who knows every shortcut', 'a family of fireflies by the canal'],
    deeds: ['rang a temple bell very, very gently', 'folded a paper crane with the tanuki', 'sipped warm tea under the maple trees', 'wrote a wish on a little wooden plaque'],
  }),
  place({
    id: 'paris', name: 'Paris', title: 'Paris', stamp: 'PARIS', country: 'France', continent: 'Europe',
    level: 1, lat: 48.86, lon: 2.35, color: '#5d7a96', kin: 'woods', tz: 'Europe/Paris', souvenirs: ['sv_eiffellamp', 'sv_macarons'],
    blurb: 'Rooftops shining after the rain, a tower that sparkles on the hour and bakeries that open before the birds.',
    sights: ['the Eiffel Tower sparkling on the hour', 'rooftops shining silver after the rain', 'a bookshop barge moored on the Seine', 'a café with its chairs stacked for the night'],
    friends: ['a pigeon in a beret (he insists)', 'a sleepy bakery cat', 'a street painter packing up her easel', 'two sparrows sharing a croissant crumb'],
    deeds: ['perched on a stone gargoyle and watched the moon', 'followed the smell of fresh bread at dawn', 'counted every bridge along the river', 'helped the painter catch a runaway sketch'],
  }),
  place({
    id: 'venice', name: 'Venice', title: 'Venice', stamp: 'VENEZIA', country: 'Italy', continent: 'Europe',
    level: 2, lat: 45.44, lon: 12.33, color: '#3f7f86', kin: 'lake', tz: 'Europe/Rome', souvenirs: ['sv_venicemask', 'sv_gondola'],
    blurb: 'A city that floats. Lanterns wobble in the green canals and the gondolas rock themselves to sleep.',
    sights: ['gondolas rocking gently at their posts', 'lanterns reflected in a green canal', 'a mask shop with a hundred painted faces', 'a great square empty under the stars'],
    friends: ['a gondolier who sings to his boat', 'a cat who rides the water bus', 'a glassblower’s apprentice', 'a gull with strong opinions about pasta'],
    deeds: ['drifted under a little stone bridge on a gondola', 'tried on a feathered mask (very dashing)', 'helped untangle a gondola rope', 'watched glass beads glow in the furnace'],
  }),
  place({
    id: 'santorini', name: 'Santorini', title: 'Santorini', stamp: 'SANTORINI', country: 'Greece', continent: 'Europe',
    level: 3, lat: 36.42, lon: 25.43, color: '#4f78a8', kin: 'lake', tz: 'Europe/Athens', souvenirs: ['sv_bluedome', 'sv_bust'],
    blurb: 'White houses tumbling down a cliff, blue domes and a sea that turns pink at sunset.',
    sights: ['white houses tumbling down the cliffs', 'blue domes shining under the moon', 'a sunset that turned the whole sea pink', 'windmills turning above the caldera'],
    friends: ['a donkey who climbs the steps at night', 'a fisherman mending his nets', 'a family of cats on a blue doorstep', 'a sleepy gecko on a warm wall'],
    deeds: ['counted the steps down to the old harbour', 'watched the moon rise over the caldera', 'shared olives with the doorstep cats', 'rang a little chapel bell at midnight'],
  }),
  place({
    id: 'sahara', name: 'the Sahara', title: 'The Sahara', stamp: 'SAHARA', country: 'Morocco', continent: 'Africa',
    level: 4, lat: 31.1, lon: -4.0, color: '#c08552', kin: 'caverns', tz: 'Africa/Casablanca', souvenirs: ['sv_camelrug', 'sv_brasslantern'],
    blurb: 'Dunes like a sea that stood still, a sky so full of stars it looks like spilled sugar.',
    sights: ['dunes rippling like a frozen sea', 'a sky so full of stars it looked like sugar', 'a caravan’s lanterns all in a row', 'an oasis ringed with tall date palms'],
    friends: ['a camel called Zara with very long eyelashes', 'a fennec fox with enormous ears', 'a storyteller by the campfire', 'a beetle who rolls things for a living'],
    deeds: ['slid all the way down the tallest dune', 'drank sweet mint tea by the fire', 'followed the north star across the sand', 'helped the fennec fox dig a cool burrow'],
  }),
  place({
    id: 'grandcanyon', name: 'the Grand Canyon', title: 'The Grand Canyon', stamp: 'GRAND CANYON', country: 'USA', continent: 'North America',
    level: 5, lat: 36.1, lon: -112.1, color: '#b0663e', kin: 'caverns', tz: 'America/Phoenix', souvenirs: ['sv_canyondiorama'],
    blurb: 'A canyon so deep the river at the bottom is a thread of silver. Every echo comes back nine times.',
    sights: ['canyon walls striped red and gold', 'the river glinting a mile below', 'a condor circling on the warm air', 'a sky full of shooting stars'],
    friends: ['a bighorn sheep on a narrow ledge', 'a raven who copies every sound', 'a park ranger with a thermos of cocoa', 'a ringtail with a very stripy tail'],
    deeds: ['said hello and heard it come back nine times', 'counted the rock layers (there are a lot)', 'rode a warm updraft without flapping once', 'watched the sunrise paint the canyon walls'],
  }),
  place({
    id: 'cappadocia', name: 'Cappadocia', title: 'Cappadocia', stamp: 'CAPPADOCIA', country: 'Türkiye', continent: 'Asia',
    level: 6, lat: 38.64, lon: 34.83, color: '#b4746a', kin: 'caverns', tz: 'Europe/Istanbul', souvenirs: ['sv_balloon'],
    blurb: 'Fairy chimneys with little cave windows, and at dawn a hundred hot-air balloons rise together.',
    sights: ['hot-air balloons rising at dawn', 'fairy chimneys with tiny cave windows', 'a valley of pink and cream stone', 'a cave hotel lit with candles'],
    friends: ['a balloon pilot with a magnificent moustache', 'a pigeon from the old dovecotes', 'a potter at her wheel', 'a shepherd dog called Kartal'],
    deeds: ['flew alongside a balloon all the way up', 'peeked into an underground city', 'spun a wobbly little clay pot', 'counted a hundred balloons in the sunrise'],
  }),
  place({
    id: 'tajmahal', name: 'the Taj Mahal', title: 'The Taj Mahal', stamp: 'AGRA', country: 'India', continent: 'Asia',
    level: 7, lat: 27.17, lon: 78.04, color: '#a8788c', kin: 'grotto', tz: 'Asia/Kolkata', souvenirs: ['sv_tajmodel'],
    blurb: 'White marble that turns silver under the moon and pink at dawn, mirrored in a long still pool.',
    sights: ['the Taj Mahal glowing white under the full moon', 'its reflection in the long pool', 'marigold garlands piled at the market', 'parakeets in the garden trees'],
    friends: ['a flock of green parakeets', 'a peacock showing off', 'a chai seller by the river', 'a monkey who borrows hats'],
    deeds: ['watched the marble turn from silver to pink', 'drank sweet chai by the river', 'helped the monkey return a hat (eventually)', 'traced the inlaid stone flowers on the walls'],
  }),
  place({
    id: 'iceland', name: 'Iceland', title: 'Iceland', stamp: 'ÍSLAND', country: 'Iceland', continent: 'Europe',
    level: 9, streak: 3, lat: 64.05, lon: -16.2, color: '#4f8f86', kin: 'peak', tz: 'Atlantic/Reykjavik', souvenirs: ['sv_puffin', 'sv_auroraglobe'],
    blurb: 'Northern lights over black sand, icebergs in a lagoon and hot springs steaming in the snow.',
    sights: ['the northern lights dancing green and violet', 'icebergs drifting in a black-sand lagoon', 'a geyser bursting into the cold air', 'a waterfall frozen into blue icicles'],
    friends: ['a puffin called Lundi', 'an Arctic fox in her winter coat', 'a woolly Icelandic horse', 'a seal popping up in the lagoon'],
    deeds: ['warmed up in a steaming hot spring', 'chased the aurora right across the sky', 'waited (and waited) for the geyser to whoosh', 'skated on a frozen pond (badly)'],
  }),
  place({
    id: 'machupicchu', name: 'Machu Picchu', title: 'Machu Picchu', stamp: 'MACHU PICCHU', country: 'Peru', continent: 'South America',
    level: 10, lat: -13.16, lon: -72.55, color: '#6f8a52', kin: 'peak', tz: 'America/Lima', souvenirs: ['sv_llama', 'sv_andeanweave'],
    blurb: 'A stone city in the clouds, terraces stepping down the mountain and llamas who think they own it.',
    sights: ['stone terraces climbing into the clouds', 'the old city appearing out of the mist', 'a green peak poking through the fog', 'the Milky Way above the Andes'],
    friends: ['a llama called Pacha', 'a fluffy alpaca who hums', 'a hummingbird with emerald wings', 'a chinchilla tucked in a crevice'],
    deeds: ['climbed the old stone trail step by step', 'watched the sun rise through the Sun Gate', 'helped Pacha count the terraces', 'listened to a pan flute echo across the valley'],
  }),
  place({
    id: 'amazon', name: 'the Amazon', title: 'The Amazon', stamp: 'AMAZÔNIA', country: 'Brazil', continent: 'South America',
    level: 8, lat: -3.4, lon: -62.2, color: '#4f7a4a', kin: 'grotto', tz: 'America/Manaus', souvenirs: ['sv_toucan'],
    blurb: 'A river as wide as a sea, lily pads you can sit on and a canopy humming all night long.',
    sights: ['a river as wide as a sea', 'giant water lilies big enough to sit on', 'fireflies blinking in the canopy', 'morning mist rising from the trees'],
    friends: ['a toucan with a sunset-coloured beak', 'a sleepy sloth called Lento', 'two pink river dolphins', 'a family of howler monkeys'],
    deeds: ['sat on a giant lily pad', 'raced the sloth (and lost, somehow)', 'sang along with the frogs at dusk', 'followed a big blue butterfly through the trees'],
  }),
  place({
    id: 'serengeti', name: 'the Serengeti', title: 'The Serengeti', stamp: 'SERENGETI', country: 'Tanzania', continent: 'Africa',
    level: 11, lat: -2.33, lon: 34.83, color: '#b08a4a', kin: 'woods', tz: 'Africa/Dar_es_Salaam', souvenirs: ['sv_elephant'],
    blurb: 'Endless golden grass, acacia trees against a huge orange moon and herds walking to the horizon.',
    sights: ['acacia trees against a huge orange moon', 'a herd of zebra stretching to the horizon', 'a snowy mountain top far, far away', 'a waterhole shining like a mirror'],
    friends: ['a giraffe who can see everything', 'an elephant family with a tiny calf', 'a lion cub who pounces on tails', 'a chatty weaver bird'],
    deeds: ['perched on the giraffe’s head to see the horizon', 'counted zebra stripes until dizzy', 'shared the waterhole with the elephants', 'watched the great migration go by'],
  }),
  place({
    id: 'banff', name: 'Banff', title: 'Banff', stamp: 'BANFF', country: 'Canada', continent: 'North America',
    level: 12, lat: 51.42, lon: -116.2, color: '#4f8a8f', kin: 'peak', tz: 'America/Edmonton', souvenirs: ['sv_canoe'],
    blurb: 'Turquoise lakes under snowy peaks, pine forests that go on forever and a red canoe waiting at the dock.',
    sights: ['a turquoise lake beneath snowy peaks', 'pine forests going on forever', 'a red canoe resting by the dock', 'stars reflected in a glassy lake'],
    friends: ['a moose with enormous antlers', 'a black bear cub learning to fish', 'a chattering chipmunk', 'a loon who calls across the water'],
    deeds: ['paddled across the lake at dawn', 'helped the bear cub catch his first fish', 'counted the snowy peaks', 'listened to the loon’s call echo'],
  }),
  place({
    id: 'petra', name: 'Petra', title: 'Petra', stamp: 'PETRA', country: 'Jordan', continent: 'Asia',
    level: 13, lat: 30.33, lon: 35.44, color: '#c07a66', kin: 'caverns', tz: 'Asia/Amman', souvenirs: ['sv_sandbottle'],
    blurb: 'A city carved into rose-red cliffs, reached through a narrow canyon lit with candles.',
    sights: ['the Treasury carved into rose-red stone', 'a narrow canyon lit by a thousand candles', 'caves glowing pink at sunset', 'the old monastery high above the valley'],
    friends: ['a musician playing a one-string fiddle', 'a sand-coloured cat', 'a donkey who knows all eight hundred steps', 'a little sandgrouse'],
    deeds: ['walked the long canyon by candlelight', 'listened to music under the stars', 'climbed the steps to the monastery', 'traced the old carvings with a wingtip'],
  }),
  place({
    id: 'angkor', name: 'Angkor Wat', title: 'Angkor Wat', stamp: 'ANGKOR', country: 'Cambodia', continent: 'Asia',
    level: 14, lat: 13.41, lon: 103.87, color: '#8a7a4a', kin: 'grotto', tz: 'Asia/Phnom_Penh', souvenirs: ['sv_lotuslamp'],
    blurb: 'Temple towers shaped like lotus buds, smiling stone faces and roots hugging the ancient walls.',
    sights: ['temple towers shaped like lotus buds', 'sunrise reflected in the temple moat', 'tree roots hugging ancient stones', 'stone faces smiling from every tower'],
    friends: ['a monk in saffron robes', 'a family of macaques', 'a water buffalo in the rice paddies', 'a kingfisher by the moat'],
    deeds: ['watched the sun rise behind the towers', 'played hide and seek among the roots', 'counted the smiling stone faces', 'floated a lotus candle on the moat'],
  }),
  place({
    id: 'reef', name: 'the Great Barrier Reef', title: 'The Great Barrier Reef', stamp: 'THE REEF', country: 'Australia', continent: 'Oceania',
    level: 15, lat: -18.3, lon: 147.7, color: '#4f9a9a', kin: 'lake', tz: 'Australia/Brisbane', souvenirs: ['sv_conch'],
    blurb: 'Coral gardens in every colour, sea turtles gliding by and sandy islands ringed with turquoise.',
    sights: ['coral gardens in every colour', 'a turtle gliding through blue water', 'a sandy island ringed with turquoise', 'the reef glowing softly under the moon'],
    friends: ['a green sea turtle called Shelly', 'a clownfish in a wavy anemone', 'a gentle manta ray', 'a dugong munching seagrass'],
    deeds: ['rode on the turtle’s shell (just for a bit)', 'helped a clownfish find its way home', 'watched the coral spawn like underwater snow', 'counted all the colours of the reef'],
  }),
  place({
    id: 'rio', name: 'Rio de Janeiro', title: 'Rio de Janeiro', stamp: 'RIO', country: 'Brazil', continent: 'South America',
    level: 16, lat: -22.91, lon: -43.17, color: '#a8705a', kin: 'lake', tz: 'America/Sao_Paulo', souvenirs: ['sv_sambadrum', 'sv_cavaquinho'],
    blurb: 'Green mountains dropping into the sea, a long moonlit beach and drums that never quite stop.',
    sights: ['Sugarloaf Mountain at sunrise', 'a statue with open arms above the clouds', 'samba drums echoing from the hills', 'a long beach glittering under the stars'],
    friends: ['a samba dancer with a feathered crown', 'a marmoset riding the cable car', 'a family of capybaras', 'a scarlet macaw'],
    deeds: ['rode the cable car to the top of Sugarloaf', 'danced a little samba on the beach', 'drummed along with the street band', 'watched the sun come up over the bay'],
  }),
  place({
    id: 'milford', name: 'Milford Sound', title: 'Milford Sound', stamp: 'MILFORD SOUND', country: 'New Zealand', continent: 'Oceania',
    level: 18, lat: -44.67, lon: 167.93, color: '#5a7a6a', kin: 'lake', tz: 'Pacific/Auckland', souvenirs: ['sv_kiwi'],
    blurb: 'Cliffs dropping straight into a dark fiord, waterfalls pouring out of the clouds, glow-worms in the caves.',
    sights: ['cliffs dropping straight into a dark fiord', 'waterfalls pouring out of the clouds', 'a pointed peak mirrored in still water', 'glow-worms twinkling in a cave'],
    friends: ['a kiwi who only comes out at night', 'a cheeky mountain parrot', 'a family of fur seals', 'a pod of playful dolphins'],
    deeds: ['flew right through a waterfall’s spray', 'followed the glow-worms deep into a cave', 'raced the dolphins down the fiord', 'helped the kiwi find a juicy worm'],
  }),
  place({
    id: 'antarctica', name: 'Antarctica', title: 'Antarctica', stamp: 'ANTARCTICA', country: 'The far south', continent: 'Antarctica',
    level: 20, streak: 7, lat: -64.8, lon: -62.9, color: '#5f86a8', kin: 'peak', tz: 'America/Punta_Arenas', souvenirs: ['sv_penguin'],
    blurb: 'Icebergs as tall as castles, the southern lights and a crowd of penguins who are always very busy.',
    sights: ['icebergs as tall as castles', 'a sky glowing with the southern lights', 'snow so white it almost hummed', 'a frozen sea creaking softly'],
    friends: ['an emperor penguin with a very fluffy chick', 'a leopard seal napping on the ice', 'a wandering albatross', 'a crew of scientists with hot cocoa'],
    deeds: ['slid down an ice slope on his tummy', 'huddled with the penguins to keep warm', 'watched the southern lights ripple', 'shared cocoa at the research station'],
  }),
] as Area[]).sort((a, b) => a.level - b.level);

/** Old save ids (the five fictional areas) and where they live now. */
export const AREA_ALIAS: Record<string, string> = { woods: 'highlands', grotto: 'kyoto', lake: 'venice', caverns: 'cappadocia', peak: 'iceland' };
/** The place id for any id an older save may hold. */
export const placeId = (id: string | undefined | null): string => (id && AREA_ALIAS[id]) || id || AREAS[0].id;
/** Places by id; the old area ids resolve to the place that replaced them. */
export const AREA: Record<string, Area> = Object.fromEntries([
  ...AREAS.map((a) => [a.id, a] as const),
  ...Object.entries(AREA_ALIAS).map(([old, id]) => [old, AREAS.find((a) => a.id === id)!] as const),
]);
/** The places where an old area's outfits and coats turn up (for "found on trips" hints). */
export const kinPlaces = (kin: string): Area[] => AREAS.filter((a) => a.kin === kin);

// ------------------------------------------------------------------ collectibles

export interface Trinket {
  id: string;
  name: string;
  blurb: string;
  area: string;
  rarity: Rarity;
  /** pixel art rows; characters index into `pal` */
  art: string[];
  pal: Record<string, string>;
}

const T: Trinket[] = [];
const tr = (id: string, name: string, area: string, rarity: Rarity, blurb: string, art: string[], pal: Record<string, string>) => T.push({ id, name, area, rarity, blurb, art, pal });

tr('acorn', 'Lucky Acorn', 'woods', 'common', 'Smooth and warm, like it was held for a long time.',
  ['....kk....', '...kbbk...', '..kbbbbk..', '.kccccccK.', '.kcCCCCck.', '..kaaaak..', '..kaAaak..', '..kaaaak..', '...kaak...', '....kk....'],
  { k: '#3b2618', K: '#3b2618', b: '#7a4a24', c: '#9a6233', C: '#b47a42', a: '#c98a4a', A: '#e3b06a' });
tr('feather', 'Blue Jay Feather', 'woods', 'common', 'Pip says it is for a hat. It is not for a hat.',
  ['........k.', '.......kbk', '......kbBk', '.....kbBk.', '....kbwk..', '...kbBk...', '..kbBk....', '.kbbk.....', '.kk.......', 'k.........'],
  { k: '#1e2a4a', b: '#3f6fc4', B: '#7fb0f0', w: '#eaf3ff' });
tr('pinecone', 'Tiny Pinecone', 'woods', 'common', 'Opens when it is dry, closes when it rains.',
  ['....kk....', '...kbbk...', '..kbBbBk..', '..kBbBbk..', '.kbBbBbBk.', '.kBbBbBbk.', '..kbBbBk..', '..kBbBbk..', '...kbbk...', '....kk....'],
  { k: '#3a2414', b: '#7a4a2a', B: '#a8703f' });
tr('clover', 'Four-Leaf Clover', 'woods', 'uncommon', 'One leaf for each good night of sleep this week.',
  ['..kk..kk..', '.kgGk.kgk.', '.kGgGkGgk.', '..kgGGgk..', '.kkgGgGkk.', 'kgGgGgGgGk', '.kgGk.kgk.', '..kk.ks...', '.....ks...', '......k...'],
  { k: '#1f4a22', g: '#4f9e45', G: '#7cc95e', s: '#3a7a34' });
tr('mothwing', 'Moth Wing Scale', 'woods', 'rare', 'Shimmers silver, gold, then silver again.',
  ['..kkkk....', '.kwWWwk...', 'kwWyyWwk..', 'kWyooyWk..', 'kWyooyWkkk', 'kwWyyWwkWk', '.kwWWwkWwk', '..kkkkWwk.', '.....kWk..', '......k...'],
  { k: '#4a4258', w: '#d8d2c8', W: '#f2ece2', y: '#e6c26a', o: '#a8743a' });
tr('glowcap', 'Glowcap Spore', 'grotto', 'common', 'Glows softly when someone nearby is dreaming.',
  ['...kkkk...', '..kcCCck..', '.kcCwCCck.', 'kcCCCCwCck', 'kkkkkkkkkk', '...kssk...', '...ksSk...', '...ksSk...', '..kkssk...', '..kkkkk...'],
  { k: '#1d3a4a', c: '#4fc4e0', C: '#9ff0ff', w: '#ffffff', s: '#e8e0cc', S: '#fff8ea' });
tr('snailshell', 'Spiral Shell', 'grotto', 'common', 'The snail traded it for a story. A long one.',
  ['...kkkk...', '..kaAAak..', '.kaAkkAak.', '.kAkaaAAk.', '.kAkAkaAk.', '.kaAkkAak.', '..kaAAak..', 'kkkkkkkk..', 'kbBBBBbk..', '.kkkkkk...'],
  { k: '#4a2a1a', a: '#c98a4a', A: '#e8b46a', b: '#a8988a', B: '#d8ccbe' });
tr('cavepainting', 'Painted Pebble', 'grotto', 'uncommon', 'Someone drew a tiny owl on it. Or a cat. Or both.',
  ['..kkkkkk..', '.kssssssk.', 'kssrssrssk', 'ksssrrsssk', 'ksssrrsssk', 'kssrssrssk', 'ksssssSssk', '.kssssssk.', '..kkkkkk..', '..........'],
  { k: '#4a4038', s: '#b8aa98', S: '#d8ccb8', r: '#b0462e' });
tr('mushlantern', 'Pocket Glowshroom', 'grotto', 'rare', 'A mushroom that lights up when you whisper to it.',
  ['...kkkk...', '..kpPPpk..', '.kpPwwPpk.', 'kpPPPPPPpk', 'kkkkkkkkkk', '..kyYYyk..', '..kyYYyk..', '..kyYYyk..', '..kkkkkk..', '..........'],
  { k: '#3a1a3a', p: '#b05ad0', P: '#e09aff', w: '#ffffff', y: '#ffd860', Y: '#fff2b0' });
tr('riverglass', 'River Glass', 'lake', 'common', 'Smoothed for a hundred years by the lake.',
  ['..........', '...kkkk...', '..kgGGgk..', '.kgGwwGgk.', '.kgGGwGgk.', '.kggGGggk.', '..kggggk..', '...kkkk...', '..........', '..........'],
  { k: '#1f4a4a', g: '#5fb8a8', G: '#9fe0d0', w: '#eafff8' });
tr('lilyflower', 'Water Lily', 'lake', 'uncommon', 'It opens at night only for very good listeners.',
  ['....kk....', '...kwwk...', '.kkwPwwkk.', 'kwwPyyPwwk', '.kwwyywwk.', 'kgggkkgggk', '.kgGGGGgk.', '..kkkkkk..', '..........', '..........'],
  { k: '#2a3a2a', w: '#fff4f8', P: '#f2a7c0', y: '#ffd040', g: '#3f8a3a', G: '#6fbf54' });
tr('moonpebble', 'Moon Pebble', 'lake', 'rare', 'Found exactly where the moon touched the water.',
  ['...kkkk...', '..kwWWwk..', '.kwWWWWwk.', 'kwWWkWWWwk', 'kwWkkWWWwk', 'kwWWWWWWwk', '.kwWWWwwk.', '..kwwwwk..', '...kkkk...', '..........'],
  { k: '#3a4060', w: '#cfd8f0', W: '#f4f8ff' });
tr('heronfeather', 'Heron Plume', 'lake', 'uncommon', 'Long, grey and extremely dignified.',
  ['.........k', '........kw', '.......kwg', '......kwgk', '.....kwgk.', '....kwgk..', '...kwgk...', '..kwgk....', '.kkgk.....', 'kk........'],
  { k: '#2e3440', w: '#e8ecf2', g: '#9aa4b4' });
tr('crystal', 'Humming Crystal', 'caverns', 'uncommon', 'Hum to it and it hums back, a little sharp.',
  ['....kk....', '...kwPk...', '..kwPPpk..', '..kPPppk..', '.kwPPpppk.', '.kPPpppPk.', '.kPppPPpk.', '..kpPPpk..', '...kppk...', '....kk....'],
  { k: '#3a2a6a', w: '#ffffff', P: '#c8b0ff', p: '#8a6fd6' });
tr('geode', 'Tiny Geode', 'caverns', 'rare', 'Plain on the outside, a galaxy inside.',
  ['..kkkkkk..', '.kbbbbbbk.', 'kbbpPPpbbk', 'kbpPwwPpbk', 'kbpPwwPpbk', 'kbbpPPpbbk', '.kbbbbbbk.', '..kkkkkk..', '..........', '..........'],
  { k: '#3a3030', b: '#8a7a6a', p: '#7a5ad0', P: '#b89aff', w: '#f4eaff' });
tr('dragonscale', 'Dragon Scale', 'caverns', 'legendary', 'A gift from a very small, very retired dragon.',
  ['....kk....', '...krrk...', '..krRRrk..', '.krRwwRrk.', '.krRRRRrk.', 'krRrRRrRrk', 'kkrRrrRrkk', '..kkrrkk..', '....kk....', '..........'],
  { k: '#3a1010', r: '#c03a2a', R: '#f06a4a', w: '#ffd0a0' });
tr('fallenstar', 'Fallen Star', 'peak', 'rare', 'Still warm. Still twinkling. Very pleased to meet you.',
  ['....kk....', '....kyk...', '...kyYk...', 'kkkyYYykkk', 'kyYYwwYYyk', '.kyYYYYyk.', '..kyYYyk..', '.kyYkkYyk.', '.kyk..kyk.', '.kk....kk.'],
  { k: '#5a3a0a', y: '#f2b632', Y: '#ffe27a', w: '#ffffff' });
tr('cloudtuft', 'Cloud Tuft', 'peak', 'uncommon', 'Weighs nothing. Has to be kept in a jar.',
  ['..........', '...kkk....', '..kwWwk.k.', '.kwWWWwkwk', 'kwWWWWWwWk', 'kwWWWWWWwk', '.kwwwwwwk.', '..kkkkkk..', '..........', '..........'],
  { k: '#7a86a8', w: '#e6ecf8', W: '#ffffff' });
tr('auroraribbon', 'Aurora Ribbon', 'peak', 'legendary', 'A thread pulled loose from the northern lights.',
  ['k.........', 'kgk.......', '.kgGk.....', '..kgGck...', '...kGcCk..', '....kcCpk.', '.....kCpPk', '......kpPk', '.......kPk', '........k.'],
  { k: '#1a2a3a', g: '#4fd8a0', G: '#9fffd0', c: '#4fb8e0', C: '#9fe8ff', p: '#c06ae0', P: '#f0a8ff' });
tr('snowflake', 'Unmelting Snowflake', 'peak', 'rare', 'Perfectly symmetrical. Pip checked.',
  ['....k.....', '.k..w..k..', '..kwWwk...', '..wWwWw...', 'kwWwkwWwk.', '..wWwWw...', '..kwWwk...', '.k..w..k..', '....k.....', '..........'],
  { k: '#6a8ab8', w: '#cfe4ff', W: '#ffffff' });

export const TRINKETS: Trinket[] = T;
export const TRINKET: Record<string, Trinket> = Object.fromEntries(T.map((t) => [t.id, t]));

/** Paint a trinket into a data URL at `scale` CSS px per art pixel (crisp, device-pixel aware). */
const trinketCache = new Map<string, string>();
export function trinketUrl(id: string, scale = 4, silhouette = false): string {
  const key = id + ':' + scale + ':' + silhouette;
  if (trinketCache.has(key)) return trinketCache.get(key)!;
  const t = TRINKET[id];
  if (!t) return '';
  const k = Math.max(1, Math.round(scale * Math.min(3, devicePixelRatio || 1)));
  const n = t.art.length, c = document.createElement('canvas');
  c.width = c.height = n * k;
  const g = c.getContext('2d')!;
  t.art.forEach((row, y) => row.split('').forEach((ch, x) => {
    if (ch === '.' || !t.pal[ch]) return;
    g.fillStyle = silhouette ? (ch === 'k' || ch === 'K' ? '#5a4a3c' : '#8a7a68') : t.pal[ch];
    g.fillRect(x * k, y * k, k, k);
  }));
  const url = c.toDataURL();
  trinketCache.set(key, url);
  return url;
}

// ------------------------------------------------------------------ loot tables

export type LootKind = 'item' | 'piece' | 'palette' | 'trinket' | 'finish' | 'skin' | 'species';
export interface LootEntry { kind: LootKind; id: string; rarity: Rarity; area: string; /** [globe] a souvenir of that place */ souvenir?: boolean }

/** Furniture that turns up on trips, by the old area kin (each place shares its kin's list). */
const KIN_ITEMS: Record<Kin, string[]> = {
  woods: ['fernpot', 'candles', 'stool', 'birdhouse', 'mushpot', 'lanternpost'],
  grotto: ['mushlamp', 'mushroomlamp', 'toybox', 'teaset', 'stonelantern'],
  lake: ['painting', 'fountain', 'birdbath', 'record', 'hammock'],
  caverns: ['starmap', 'globe', 'chest', 'fireplace'],
  peak: ['telescope', 'wardrobe', 'armchair', 'trophy'],
};
const KINS: Kin[] = ['woods', 'grotto', 'lake', 'caverns', 'peak'];
const RARITY_BY_PRICE = (p: number): Rarity => (p >= 450 ? 'rare' : p >= 220 ? 'uncommon' : 'common');
const LOOT_RARITY = (r: string | undefined, price: number): Rarity => (r === 'epic' ? 'legendary' : r === 'common' || r === 'uncommon' || r === 'rare' || r === 'legendary' ? r : RARITY_BY_PRICE(price));

const hashId = (id: string) => { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h); };
/** Which kin an item turns up with when no hand-picked list mentions it. */
const homeKin = (id: string): Kin => { for (const k of KINS) if (KIN_ITEMS[k].includes(id)) return k; return KINS[hashId(id) % KINS.length]; };
/** Which place each souvenir comes from (souvenirs only turn up there). */
export const SOUVENIR_PLACE: Record<string, string> = Object.fromEntries(AREAS.flatMap((a) => a.souvenirs.map((id) => [id, a.id] as const)));

/** A place's souvenirs as loot entries. */
export function souvenirLoot(area: string): LootEntry[] {
  const a = AREA[area];
  if (!a) return [];
  return a.souvenirs.filter((id) => ITEM_BY_ID[id]).map((id) => ({ kind: 'item' as const, id, rarity: LOOT_RARITY(ITEM_BY_ID[id].rarity, ITEM_BY_ID[id].price), area: a.id, souvenir: true }));
}

/** What Pip can bring home from a place: furniture and decor for the house, and outfits and coats from the place's
 * kin (souvenirs are separate, see `souvenirLoot`). */
export function lootTable(area: string): LootEntry[] {
  const a = AREA[area];
  if (!a) return [];
  const out: LootEntry[] = [];
  for (const it of ALL_ITEMS) {
    if (it.series || it.gems || SOUVENIR_PLACE[it.id]) continue;
    if (homeKin(it.id) !== a.kin) continue;
    out.push({ kind: 'item', id: it.id, rarity: RARITY_BY_PRICE(it.price), area: a.id });
  }
  for (const p of PIECES) if (p.area && AREA[p.area]?.kin === a.kin && !p.premium) out.push({ kind: 'piece', id: p.id, rarity: p.price >= 300 ? 'rare' : 'uncommon', area: a.id });
  for (const p of PALETTES) if (p.unlock && AREA[p.unlock]?.kin === a.kin) out.push({ kind: 'palette', id: p.id, rarity: 'legendary', area: a.id });
  return out;
}

// ------------------------------------------------------------------ levels & rewards

/** Total XP needed to reach `level`. */
export const xpFor = (level: number) => Math.round(120 * ((level - 1) ** 1.45) + 60 * (level - 1));
export function levelOf(xp: number): { level: number; into: number; need: number } {
  let L = 1;
  while (xpFor(L + 1) <= xp) L++;
  return { level: L, into: xp - xpFor(L), need: xpFor(L + 1) - xpFor(L) };
}

/** House zones open with levels. */
export const ZONE_LEVEL = { loft: 3, garden: 5, deck: 8 } as const;
export const ZONE_NAME = { loft: 'The Loft', garden: 'The Garden', deck: 'Stargazing Deck' } as const;

export const ITEM_BY_ID = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));

// ------------------------------------------------------------------ store

export interface Product { id: string; name: string; blurb: string; price: string; gems?: number; plan?: 'monthly' | 'yearly'; badge?: string }
export const STONE_PACKS: Product[] = [
  { id: 'stones_s', name: 'Pouch of Moonstones', blurb: '120 moonstones', price: '$1.99', gems: 120 },
  { id: 'stones_m', name: 'Jar of Moonstones', blurb: '400 moonstones + 40 bonus', price: '$4.99', gems: 440, badge: 'Popular' },
  { id: 'stones_l', name: 'Chest of Moonstones', blurb: '1,000 moonstones + 200 bonus', price: '$9.99', gems: 1200, badge: 'Best value' },
];
export const PLUS_PLANS: Product[] = [
  { id: 'plus_monthly', name: 'Hoot Hollow Plus', blurb: 'Monthly', price: '$4.99 / month', plan: 'monthly' },
  { id: 'plus_yearly', name: 'Hoot Hollow Plus', blurb: 'Yearly: 2 months free', price: '$39.99 / year', plan: 'yearly', badge: 'Save 33%' },
];
export const PLUS_PERKS = [
  'Pip brings back one extra treasure every night',
  'A new exclusive coat or outfit every month',
  '30-day sleep trends and snore & sleep-talk recordings',
  'Every soundscape and alarm melody',
  '50 moonstones every week',
];
