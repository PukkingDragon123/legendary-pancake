// Souvenirs: one or two keepsakes from each of the twenty real places on the globe. Pip finds them on
// night trips to that place (never in the store). Each is a low-poly model with a hand-painted texture in
// public/models/souvenirs/<id>.glb: most are modelled in art/lowpix/souvenirs (lofts and lathes, painted
// style), a few are borrowed and restyled (art/lowpix/souvenirs/_kit/borrow.py; credits in
// docs/credits/globe.md). Every GLB has one root node in world units (16 game px = 1 block), standing
// bottom-centre on the floor and facing +Z; wall pieces hang with their back on z = 0.
// [globe] OWNED BY THE GLOBE BUILDER.
import { box, type BoxSpec } from '../gfx/box.ts';
import { solid } from '../gfx/mats.ts';
import type { ItemCat, ItemDef, ItemRarity } from './furniture.ts';

export interface SouvenirInfo {
  id: string;
  name: string;
  /** the place it comes from (AREAS id in src/game/catalog.ts) */
  place: string;
  cat: ItemCat;
  rarity: ItemRarity;
  blurb: string;
  /** footprint in blocks */
  size: [number, number];
  /** model height in px (for the parcel shown while the model loads) */
  h: number;
  small?: boolean;
  wall?: boolean;
  rug?: boolean;
  surface?: number;
  light?: ItemDef['light'];
}

const S: SouvenirInfo[] = [
  { id: 'sv_tartanrug', name: 'Highland Tartan Rug', place: 'highlands', cat: 'rugs', rarity: 'uncommon', size: [3, 2], h: 1, rug: true,
    blurb: 'Woven in moss, heather and loch blue, with a fringe at each end. Warm enough for a Highland winter.' },
  { id: 'sv_highlandcow', name: 'Highland Cow Plush', place: 'highlands', cat: 'fun', rarity: 'rare', size: [1, 1], h: 11, small: true,
    blurb: 'Morag’s little twin. The fringe is very long; she can still see you, apparently.' },
  { id: 'sv_kyotolantern', name: 'Kyoto Paper Lantern', place: 'kyoto', cat: 'lights', rarity: 'uncommon', size: [1, 1], h: 15, small: true,
    light: { x: 0, y: 8, z: 0, color: 0xf1c28a, power: 1.2 },
    blurb: 'A red paper chōchin with brushed letters that say “sleep well”. It glows the colour of a temple lane at night.' },
  { id: 'sv_torii', name: 'Little Torii Gate', place: 'kyoto', cat: 'decor', rarity: 'uncommon', size: [2, 0.5], h: 19,
    blurb: 'A vermilion gate on stone feet. Walk under it and the day gets a little calmer.' },
  { id: 'sv_eiffellamp', name: 'Eiffel Tower Lamp', place: 'paris', cat: 'lights', rarity: 'rare', size: [1, 1], h: 22, small: true,
    light: { x: 0, y: 12, z: 0, color: 0xf1d39a, power: 1.3 },
    blurb: 'Wrought iron in miniature with warm bulbs up its legs. It twinkles on the hour, like the real one.' },
  { id: 'sv_macarons', name: 'Macaron Tower', place: 'paris', cat: 'decor', rarity: 'common', size: [1, 1], h: 12, small: true,
    blurb: 'Pistachio, rose, violet and vanilla, stacked on a glass stand. Strictly decorative. Mostly.' },
  { id: 'sv_venicemask', name: 'Venetian Mask', place: 'venice', cat: 'wall', rarity: 'rare', size: [1, 0.5], h: 12, wall: true,
    blurb: 'Gold leaf, a sweep of feathers and a mysterious smile. For the wall, or very fancy dinners.' },
  { id: 'sv_gondola', name: 'Gondola Model', place: 'venice', cat: 'decor', rarity: 'uncommon', size: [2, 1], h: 9, small: true,
    blurb: 'Black lacquer, a silver prow and a gondolier’s oar, resting on a little wooden cradle.' },
  { id: 'sv_bluedome', name: 'Blue-Dome Chapel', place: 'santorini', cat: 'decor', rarity: 'uncommon', size: [1, 1], h: 14, small: true,
    blurb: 'A whitewashed chapel with a blue dome and a bell tower. The tiny bell really rings.' },
  { id: 'sv_bust', name: 'Marble Bust', place: 'santorini', cat: 'decor', rarity: 'rare', size: [1, 1], h: 14, small: true,
    blurb: 'A thoughtful philosopher in island marble. He has opinions about your bookshelf.' },
  { id: 'sv_camelrug', name: 'Camel Kilim Rug', place: 'sahara', cat: 'rugs', rarity: 'uncommon', size: [3, 2], h: 1, rug: true,
    blurb: 'Hand-knotted in desert reds and indigo, with a caravan of camels marching round the border.' },
  { id: 'sv_brasslantern', name: 'Moroccan Lantern', place: 'sahara', cat: 'lights', rarity: 'rare', size: [1, 1], h: 18, small: true,
    light: { x: 0, y: 8, z: 0, color: 0xf0c27a, power: 1.4 },
    blurb: 'Pierced brass and coloured glass that scatter little stars of light all over the walls.' },
  { id: 'sv_canyondiorama', name: 'Canyon Diorama', place: 'grandcanyon', cat: 'decor', rarity: 'uncommon', size: [1, 1], h: 10, small: true,
    blurb: 'Layer upon layer of painted rock on a wooden base, with a silver river right at the bottom.' },
  { id: 'sv_balloon', name: 'Hot-Air Balloon', place: 'cappadocia', cat: 'fun', rarity: 'rare', size: [1, 1], h: 24, small: true,
    blurb: 'A striped balloon tethered over its wicker basket. It bobs gently when nobody is looking.' },
  { id: 'sv_tajmodel', name: 'Marble Taj Mahal', place: 'tajmahal', cat: 'decor', rarity: 'epic', size: [1, 1], h: 14, small: true,
    blurb: 'Carved from milky marble, with inlaid flowers so small you need owl eyes to see them.' },
  { id: 'sv_puffin', name: 'Puffin Plush', place: 'iceland', cat: 'fun', rarity: 'rare', size: [1, 1], h: 11, small: true,
    blurb: 'Lundi’s cousin. Orange feet, a stripy beak and a look of mild surprise.' },
  { id: 'sv_auroraglobe', name: 'Aurora Snow Globe', place: 'iceland', cat: 'lights', rarity: 'epic', size: [1, 1], h: 12, small: true,
    light: { x: 0, y: 8, z: 0, color: 0xa8d8c0, power: 0.9 },
    blurb: 'Shake it and the northern lights swirl over a tiny black-sand beach and a turf cottage.' },
  { id: 'sv_llama', name: 'Llama Plush', place: 'machupicchu', cat: 'fun', rarity: 'rare', size: [1, 1], h: 16, small: true,
    blurb: 'Pacha insisted. Woven tassels, a pompom necklace and a very proud neck.' },
  { id: 'sv_andeanweave', name: 'Andean Weaving', place: 'machupicchu', cat: 'wall', rarity: 'uncommon', size: [2, 0.5], h: 18, wall: true,
    blurb: 'Bright stripes of alpaca wool with diamonds and little condors woven in, hung from a wooden rod.' },
  { id: 'sv_toucan', name: 'Toucan Perch', place: 'amazon', cat: 'decor', rarity: 'rare', size: [1, 1], h: 16, small: true,
    blurb: 'A carved toucan on a jungle branch, its big beak painted the colours of a sunset.' },
  { id: 'sv_elephant', name: 'Elephant Carving', place: 'serengeti', cat: 'decor', rarity: 'uncommon', size: [1, 1], h: 12, small: true,
    blurb: 'Carved from one piece of dark wood, trunk raised for luck. The calf in the herd looked just like it.' },
  { id: 'sv_canoe', name: 'Red Canoe', place: 'banff', cat: 'wall', rarity: 'rare', size: [3, 0.5], h: 8, wall: true,
    blurb: 'Cedar ribs, a red canvas skin and a paddle, mounted on the wall for dreaming of lakes.' },
  { id: 'sv_sandbottle', name: 'Sand Art Bottle', place: 'petra', cat: 'decor', rarity: 'uncommon', size: [1, 1], h: 12, small: true,
    blurb: 'Seven colours of desert sand poured into a camel and a sunset, grain by grain.' },
  { id: 'sv_lotuslamp', name: 'Lotus Lamp', place: 'angkor', cat: 'lights', rarity: 'uncommon', size: [1, 1], h: 8, small: true,
    light: { x: 0, y: 6, z: 0, color: 0xf1c08a, power: 1.0 },
    blurb: 'A pink stone lotus on a lily pad, with a little flame floating in the middle.' },
  { id: 'sv_conch', name: 'Spider Conch Shell', place: 'reef', cat: 'decor', rarity: 'rare', size: [1, 1], h: 4, small: true,
    blurb: 'A spiny pink-lipped shell washed up on a sandy cay. Hold it to your ear: the reef is still in there.' },
  { id: 'sv_sambadrum', name: 'Samba Drum', place: 'rio', cat: 'fun', rarity: 'uncommon', size: [1, 1], h: 13,
    blurb: 'A surdo drum with painted rims and a pair of mallets. One tap and the whole house wants to dance.' },
  { id: 'sv_cavaquinho', name: 'Cavaquinho', place: 'rio', cat: 'wall', rarity: 'rare', size: [1, 0.5], h: 17, wall: true,
    blurb: 'A little four-string guitar for the wall. It remembers every samba it was ever played in.' },
  { id: 'sv_kiwi', name: 'Kiwi Plush', place: 'milford', cat: 'fun', rarity: 'rare', size: [1, 1], h: 9, small: true,
    blurb: 'Round, brown, fluffy and nocturnal, with a long curious beak. Pip’s new best friend.' },
  { id: 'sv_penguin', name: 'Penguin Plush', place: 'antarctica', cat: 'fun', rarity: 'epic', size: [1, 1], h: 15, small: true,
    blurb: 'An emperor penguin with a fluffy grey chick tucked on its feet.' },
];

const PRICE: Record<ItemRarity, number> = { common: 180, uncommon: 320, rare: 520, epic: 760, legendary: 980 };

/** A brown-paper parcel tied with twine: shown for a moment while the souvenir's model loads. */
function parcel(s: SouvenirInfo): BoxSpec[] {
  const paper = solid('#b89a72', { noise: 0.6, scale: 1.5 }), twine = solid('#e6dcc4', { noise: 0.2 });
  if (s.rug) return [box(0, 0, 0, s.size[0] * 14, 0.6, s.size[1] * 14, solid('#a88a68', { noise: 0.8, scale: 2 }))];
  const w = Math.min(10, s.size[0] * 8), d = s.wall ? 2 : Math.min(8, s.size[1] * 8), h = Math.max(4, Math.min(9, s.h * 0.5));
  const y = s.wall ? 4 : 0, z = s.wall ? 1 : 0;
  return [box(0, y, z, w, h, d, paper), box(0, y - 0.05, z, 1, h + 0.2, d + 0.2, twine), box(0, y - 0.05, z, w + 0.2, h + 0.2, 1, twine), box(0, y + h, z, 2.4, 1, 1.4, twine)];
}

export const SOUVENIR_INFO: Record<string, SouvenirInfo> = Object.fromEntries(S.map((s) => [s.id, s]));

export const SOUVENIRS: ItemDef[] = S.map((s) => ({
  id: s.id, name: s.name, cat: s.cat, price: PRICE[s.rarity], rarity: s.rarity, blurb: s.blurb,
  size: s.size, small: s.small, wall: s.wall, rug: s.rug, flatItem: s.rug || undefined, surface: s.surface, light: s.light,
  noStore: true, series: undefined,
  model: `souvenirs/${s.id}.glb`,
  build: () => parcel(s),
}));

/** The pixel portraits of every souvenir, one 64 px cell each in SOUVENIRS order, 8 per row (rendered from the
 * GLBs, clear background, ink outline; dev-souvenirs.html). */
export const SOUVENIR_ICONS = `${import.meta.env.BASE_URL}models/souvenirs/icons.png`;
/** CSS for a souvenir portrait shown `size` CSS px square (a sprite from the atlas; nearest-neighbour). */
export function souvenirIconStyle(id: string, size = 64): Record<string, string> {
  const i = Math.max(0, SOUVENIRS.findIndex((s) => s.id === id)), k = size / 64, rows = Math.ceil(SOUVENIRS.length / 8);
  return { backgroundImage: `url(${SOUVENIR_ICONS})`, backgroundSize: `${8 * size}px ${rows * size}px`, backgroundPosition: `${-(i % 8) * 64 * k}px ${-Math.floor(i / 8) * 64 * k}px`, width: `${size}px`, height: `${size}px`, imageRendering: 'pixelated', display: 'inline-block' };
}
