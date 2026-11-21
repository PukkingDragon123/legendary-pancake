// Everything Pip can find, buy and unlock: adventure areas, collectible trinkets (with their own
// hand-pixelled art), store products, and the level and reward curves.
import { PIECES } from '../owl/outfits.ts';
import { PALETTES } from '../owl/palette.ts';
import { ALL_ITEMS } from '../world/scene.ts';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export const RARITY_COLOR: Record<Rarity, string> = { common: '#9aa58a', uncommon: '#5fa86a', rare: '#5b8fe0', legendary: '#e6a93a' };
export const RARITY_NAME: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', legendary: 'Legendary' };

export interface Area {
  id: string;
  name: string;
  blurb: string;
  level: number;
  /** nights in a row needed (in addition to level) */
  streak?: number;
  /** map position 0..1 and colour */
  x: number; y: number;
  color: string;
  /** a few lines the story generator weaves together */
  sights: string[];
  friends: string[];
  deeds: string[];
}

export const AREAS: Area[] = [
  {
    id: 'woods', name: 'Whispering Woods', level: 1, x: 0.3, y: 0.66, color: '#5f9a52',
    blurb: 'The friendly forest right outside the tree house. Pip knows every root here.',
    sights: ['a ring of toadstools glowing faintly', 'a fox curled up asleep under a fern', 'an old oak that hums when the wind blows', 'a trail of moonlit dewdrops'],
    friends: ['a sleepy hedgehog named Burr', 'a very polite moth', 'two squabbling squirrels', 'an old toad who knows riddles'],
    deeds: ['helped a lost beetle find its way home', 'traded riddles until the toad yawned', 'tucked a fallen baby bird back into its nest', 'counted every star between the branches'],
  },
  {
    id: 'grotto', name: 'Mushroom Grotto', level: 2, x: 0.62, y: 0.74, color: '#b0628a',
    blurb: 'A cave of glowing mushrooms where the moss is soft as a pillow.',
    sights: ['mushrooms glowing blue, then pink, then gold', 'a waterfall that sounds like a lullaby', 'spores drifting like tiny snowflakes', 'a cavern painted with ancient owl drawings'],
    friends: ['a snail who runs the spore market', 'a glowworm choir', 'a shy cave bat called Dot', 'a mole who mapped every tunnel'],
    deeds: ['joined the glowworm choir for one song', 'helped Dot practice hanging upside down', 'carried spores to the snail market', 'followed a trail of glowcaps to a secret room'],
  },
  {
    id: 'lake', name: 'Moonlit Lake', level: 4, x: 0.78, y: 0.44, color: '#4f8fc4',
    blurb: 'Still water that holds the whole sky. Fish here dream out loud.',
    sights: ['the moon doubled in the still water', 'lily pads drifting like little boats', 'mist curling over the reeds', 'a heron standing perfectly still'],
    friends: ['a frog orchestra', 'a heron who never blinks', 'an otter with a collection of pebbles', 'a family of ducklings'],
    deeds: ['skipped a stone eleven times', 'listened to the frogs rehearse their lullaby', 'helped the otter sort her pebbles by shininess', 'floated on a lily pad until midnight'],
  },
  {
    id: 'caverns', name: 'Crystal Caverns', level: 6, x: 0.45, y: 0.3, color: '#8a6fd6',
    blurb: 'Deep tunnels where crystals ring like bells when you hum.',
    sights: ['crystals humming in a hundred colours', 'a lake underground as clear as glass', 'a staircase carved by ancient moles', 'a geode as big as a house'],
    friends: ['a crystal spider who weaves light', 'a retired dragon (very small)', 'a lantern-carrying newt', 'echoes that answer back'],
    deeds: ['hummed a note that made every crystal sing', 'helped the newt refill her lantern', 'traded stories with the tiny dragon', 'found the way out by following a draught'],
  },
  {
    id: 'peak', name: 'Starfall Peak', level: 9, streak: 3, x: 0.2, y: 0.18, color: '#e0a93a',
    blurb: 'The highest hill in the land. On clear nights, stars fall here.',
    sights: ['a shooting star landing softly in the snow', 'clouds you can walk on', 'the whole forest asleep far below', 'an aurora rippling like a curtain'],
    friends: ['a mountain goat stargazer', 'a cloud that follows you around', 'the night wind herself', 'a snowy owl cousin (very formal)'],
    deeds: ['caught a falling star in a jar', 'raced a cloud to the summit', 'named a new constellation after the tree house', 'watched the sunrise from above the clouds'],
  },
];
export const AREA: Record<string, Area> = Object.fromEntries(AREAS.map((a) => [a.id, a]));

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

export type LootKind = 'trinket' | 'item' | 'piece' | 'palette';
export interface LootEntry { kind: LootKind; id: string; rarity: Rarity; area: string }

/** Every area offers its own trinkets plus a few themed furniture pieces, outfits and coats. */
const AREA_ITEMS: Record<string, string[]> = {
  woods: ['fernpot', 'candles', 'stool', 'birdhouse', 'mushpot', 'lanternpost'],
  grotto: ['mushlamp', 'mushroomlamp', 'toybox', 'teaset', 'stonelantern'],
  lake: ['painting', 'fountain', 'birdbath', 'record', 'hammock'],
  caverns: ['starmap', 'globe', 'chest', 'fireplace'],
  peak: ['telescope', 'wardrobe', 'armchair', 'trophy'],
};
const RARITY_BY_PRICE = (p: number): Rarity => (p >= 450 ? 'rare' : p >= 220 ? 'uncommon' : 'common');

const AREA_IDS = ['woods', 'grotto', 'lake', 'caverns', 'peak'];
const hashId = (id: string) => { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return Math.abs(h); };
/** Which area an item turns up in when no hand-picked list mentions it. */
const homeArea = (id: string) => { for (const [a, list] of Object.entries(AREA_ITEMS)) if (list.includes(id)) return a; return AREA_IDS[hashId(id) % AREA_IDS.length]; };

/** What Pip can bring home from an area: furniture and decor for the house, and outfits. */
export function lootTable(area: string): LootEntry[] {
  const out: LootEntry[] = [];
  for (const it of ALL_ITEMS) {
    if (it.series || it.gems) continue;
    if (homeArea(it.id) !== area) continue;
    out.push({ kind: 'item', id: it.id, rarity: RARITY_BY_PRICE(it.price), area });
  }
  for (const p of PIECES) if (p.area === area && !p.premium) out.push({ kind: 'piece', id: p.id, rarity: p.price >= 300 ? 'rare' : 'uncommon', area });
  for (const p of PALETTES) if (p.unlock === area) out.push({ kind: 'palette', id: p.id, rarity: 'legendary', area });
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
