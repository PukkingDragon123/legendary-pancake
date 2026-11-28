// [postcard] What a place can give you, and the postcard you earn there. The bedtime place picker
// (ui/globepick.tsx) shows a place's loot (its souvenirs, the outfit pieces and coats, and the furniture
// from its kin, each with whether you own it and whether it can still turn up) and its postcard: the first
// night Pip spends at a place (an hour asleep or more) mails it home, recorded in the save's `postcards`
// (place id -> when). Also the little bits of geography the card shows: how far away the place is, how long
// a plane would take, and how far its clock is from yours.
import { AREA, ITEM_BY_ID, lootTable, placeId, RARITY_NAME, souvenirLoot, type LootEntry, type Rarity } from './catalog.ts';
import { souvenirChance } from './adventure.ts';
import { ownsEntry, type Save } from './store.ts';

// ------------------------------------------------------------------ loot

export type LootGroup = 'souvenir' | 'wear' | 'home';
export interface LootLine extends LootEntry {
  group: LootGroup;
  /** already in your collection */
  owned: boolean;
  /** can still come home from a night here (outfits and coats come once; furniture and souvenirs can repeat) */
  canDrop: boolean;
}
export interface PlaceLoot {
  souvenirs: LootLine[];
  /** outfit pieces and coats */
  wear: LootLine[];
  /** furniture and decor for the house */
  home: LootLine[];
  /** every entry, and how many of them you own */
  total: number;
  owned: number;
  /** the chance of a souvenir on a night here at the given luck (0..1) */
  souvenirOdds: number;
}

const RANK: Record<Rarity, number> = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
/** rarest first, then what you still need, then by id (stable) */
const order = (a: LootLine, b: LootLine) => RANK[a.rarity] - RANK[b.rarity] || Number(a.owned) - Number(b.owned) || a.id.localeCompare(b.id);

/** Everything Pip can bring home from a place, for the save `s` (luck: how good a typical night is, 0..1). */
export function placeLoot(s: Save, area: string, luck = typicalLuck(s)): PlaceLoot {
  const id = placeId(area);
  const line = (e: LootEntry, group: LootGroup): LootLine => {
    const owned = ownsEntry(s, e);
    return { ...e, group, owned, canDrop: group === 'wear' ? !owned : true };
  };
  const souvenirs = souvenirLoot(id).map((e) => line(e, 'souvenir')).sort(order);
  const table = lootTable(id);
  const wear = table.filter((e) => e.kind !== 'item').map((e) => line(e, 'wear')).sort(order);
  const home = table.filter((e) => e.kind === 'item').map((e) => line(e, 'home')).sort(order);
  const all = [...souvenirs, ...wear, ...home];
  return {
    souvenirs, wear, home,
    total: all.length,
    owned: all.filter((e) => e.owned).length,
    souvenirOdds: souvenirChance(souvenirs.filter((e) => !e.owned).length, souvenirs.length, luck),
  };
}

/** How lucky a night usually is for this sleeper: the luck formula of adventure.ts on the last week's scores. */
export function typicalLuck(s: Save): number {
  const scores = s.nights.slice(-7).map((n) => n.report?.score).filter((v): v is number => typeof v === 'number');
  const score = scores.length ? scores.reduce((t, v) => t + v, 0) / scores.length : 75;
  return Math.max(0.05, Math.min(1, (score / 100) * 0.85 + Math.min(s.streak, 7) * 0.02));
}

/** A friendly line about the souvenir odds. */
export function souvenirNote(l: PlaceLoot): string {
  if (!l.souvenirs.length) return '';
  const missing = l.souvenirs.filter((e) => !e.owned).length;
  if (missing === l.souvenirs.length) return 'Certain on your first night here';
  const pct = Math.round(l.souvenirOdds * 100);
  return missing ? `About ${pct}% on a night like yours` : `All found · a spare now and then (${pct}%)`;
}

export const rarityName = (r: Rarity) => RARITY_NAME[r];
export const lootName = (e: Pick<LootEntry, 'kind' | 'id'>) => (e.kind === 'item' ? ITEM_BY_ID[e.id]?.name ?? e.id : e.id);

// ------------------------------------------------------------------ postcards

/** Nights shorter than this don't count: Pip barely got out of the window. */
export const POSTCARD_MIN_SLEEP = 3.6e6;

export const postcardsOf = (s: Pick<Save, 'postcards'>): Record<string, number> => s.postcards ?? {};
export const hasPostcard = (s: Pick<Save, 'postcards'>, area: string) => !!postcardsOf(s)[placeId(area)];
/** when the postcard from a place came (undefined: not yet) */
export const postcardDate = (s: Pick<Save, 'postcards'>, area: string): number | undefined => postcardsOf(s)[placeId(area)];

/**
 * Record the postcard for a finished night at `area` (mutates `s`; call it inside `edit`). Only the first night
 * at a place mails one, and only a real night (`asleepMs` of an hour or more) at a real place. Returns the place
 * id when a new postcard came, else null.
 */
export function awardPostcard(s: Save, area: string, when: number, asleepMs: number): string | null {
  const id = placeId(area);
  if (!AREA[id] || AREA[id].id !== id || asleepMs < POSTCARD_MIN_SLEEP) return null;
  if (s.postcards?.[id]) return null;
  s.postcards = { ...(s.postcards ?? {}), [id]: when };
  return id;
}

// ------------------------------------------------------------------ geography

const R_EARTH = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** Roughly how long a plane takes (cruising about 850 km/h, plus half an hour for take-off and landing); 0 next door. */
export function flightHours(km: number): number {
  if (km < 50) return 0;
  return km / 850 + 0.5;
}
/** "45 min", "2 h 10 min", "11 h" */
export function fmtHours(h: number): string {
  if (h <= 0) return 'no time at all';
  const m = Math.max(5, Math.round((h * 60) / 5) * 5);
  if (m < 60) return `${m} min`;
  if (h >= 8) return `${Math.round(h)} h`;
  const hh = Math.floor(m / 60), mm = m % 60;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

/** Minutes a time zone is ahead of UTC at time t (e.g. Asia/Tokyo: 540). */
export function tzOffsetMinutes(tz: string, t = Date.now()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t));
    const get = (k: string) => Number(parts.find((p) => p.type === k)?.value ?? 0);
    const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
    return Math.round((asUTC - Math.floor(t / 1000) * 1000) / 60000);
  } catch { return 0; }
}
/** How a place's clock compares with yours: "same time as you", "8 h ahead", "5 h 30 min behind". */
export function tzDiffText(diffMin: number): string {
  if (diffMin === 0) return 'same time as you';
  const a = Math.abs(diffMin), h = Math.floor(a / 60), m = a % 60;
  return `${h ? `${h} h` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''} ${diffMin > 0 ? 'ahead' : 'behind'}`;
}
/** The hour (0..24, fractional) on a place's clock at time t. */
export function localHour(tz: string, t = Date.now()): number {
  const d = new Date(t + tzOffsetMinutes(tz, t) * 60000);
  return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
}
