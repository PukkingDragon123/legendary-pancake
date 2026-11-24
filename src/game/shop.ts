// Barnaby's Lodge Store (the beaver's general store): three discounted daily deals rolled from the day's date, a free daily
// gift, acorn piles bought with moon gems, moon gem packs (a demo store here), and wishes on the
// weekly series. Rules that only read a save are pure; the actions change the save via `edit`.
import { ALL_ITEMS, FINISH, ITEMS } from '../assets/registry.ts';
import { rng as seededRng, strSeed } from '../gfx/noise.ts';
import { PIECE, PIECES } from '../owl/outfits.ts';
import { SPECIAL_SKIN } from '../owl/skins.ts';
import { SPECIES, SPECIES_BY_ID } from '../owl/species.ts';
import { FRAME_BY_ID, STORE_FRAMES, type FrameDef } from '../assets/frames.ts';
import { freshPity, pull, type Pity, type PullResult, type Rng } from './gacha.ts';
import { PULL_COST, SERIES, SERIES_BY_ID, type RewardKind, type Series, type SeriesEntry, type Stars } from './series.ts';
import { dayKey, edit, grant, ownsEntry, save, type Save } from './store.ts';

// ------------------------------------------------------------------ names and lookups

const titleCase = (id: string) => id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
/** Display name for anything the shop can sell or a wish can give (falls back to the id). */
export function nameOf(kind: RewardKind | 'species', id: string): string {
  if (kind === 'item') return ITEMS[id]?.name ?? titleCase(id);
  if (kind === 'piece') return PIECE[id]?.name ?? titleCase(id);
  if (kind === 'skin') return SPECIAL_SKIN[id]?.name ?? titleCase(id);
  if (kind === 'finish') return FINISH[id]?.name ?? titleCase(id);
  if (kind === 'species') return SPECIES_BY_ID[id]?.name ?? titleCase(id);
  if (kind === 'frame') return FRAME_BY_ID[id]?.name ?? titleCase(id);
  return titleCase(id);
}
export function blurbOf(kind: RewardKind | 'species', id: string): string {
  if (kind === 'item') return ITEMS[id]?.blurb ?? '';
  if (kind === 'piece') return PIECE[id]?.blurb ?? '';
  if (kind === 'skin') return SPECIAL_SKIN[id]?.blurb ?? '';
  if (kind === 'finish') return FINISH[id]?.blurb ?? '';
  if (kind === 'species') return SPECIES_BY_ID[id]?.blurb ?? '';
  if (kind === 'frame') return FRAME_BY_ID[id]?.blurb ?? '';
  return '';
}
/** Whether the registry already has this id (other content may still be on its way). */
export function exists(kind: RewardKind | 'species', id: string): boolean {
  if (kind === 'item') return !!ITEMS[id];
  if (kind === 'piece') return !!PIECE[id];
  if (kind === 'skin') return !!SPECIAL_SKIN[id];
  if (kind === 'finish') return !!FINISH[id];
  if (kind === 'species') return !!SPECIES_BY_ID[id];
  if (kind === 'frame') return !!FRAME_BY_ID[id];
  return false;
}
export const KIND_LABEL: Record<RewardKind, string> = { item: 'Furniture', piece: 'Outfit', skin: 'Owl skin', finish: 'Wall & floor', species: 'Plumage', frame: 'Portrait frame' };

// ------------------------------------------------------------------ time

const DAY = 86400_000;
/** ms until local midnight, when the deals and the gift refresh */
export const msToMidnight = (t = Date.now()) => { const d = new Date(t); d.setHours(24, 0, 0, 0); return d.getTime() - t; };
/** ISO 8601 week number */
export function isoWeek(t = Date.now()): number {
  const d = new Date(t);
  const u = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const day = new Date(u).getUTCDay() || 7;
  const th = u + (4 - day) * DAY;
  const y0 = Date.UTC(new Date(th).getUTCFullYear(), 0, 1);
  return Math.ceil(((th - y0) / DAY + 1) / 7);
}
/** ms until next Monday 00:00 local, when the weekly series swap */
export function msToWeek(t = Date.now()) {
  const d = new Date(t), dow = (d.getDay() + 6) % 7; // 0 = Monday
  const next = new Date(d); next.setHours(0, 0, 0, 0); next.setDate(next.getDate() + (7 - dow));
  return next.getTime() - t;
}
export const seriesActive = (s: Series, t = Date.now()) => s.week === 'always' || s.week === isoWeek(t) % 2;
export const activeSeries = (t = Date.now()) => SERIES.filter((s) => seriesActive(s, t));
export const fmtLeft = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m % 60}m ${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}s`;
};

// ------------------------------------------------------------------ daily deals

export type DealKind = 'piece' | 'item' | 'species';
export interface Deal {
  slot: number;
  kind: DealKind;
  id: string;
  name: string;
  blurb: string;
  cur: 'coins' | 'gems';
  /** the normal price and today's */
  base: number;
  price: number;
  /** percent off, 20..50 */
  off: number;
  key: string;
}

interface Cand { kind: DealKind; id: string; base: number; cur: 'coins' | 'gems' }
/** Everything the store may put on a stump: sold normally, not a starter, not series-only. */
export function candidates(): { pieces: Cand[]; items: Cand[]; species: Cand[] } {
  const pieces = PIECES.filter((p) => p.price > 0 && !p.area).map((p): Cand => ({ kind: 'piece', id: p.id, base: p.price, cur: p.premium ? 'gems' : 'coins' }));
  const items = ALL_ITEMS.filter((i) => !i.series && !i.noStore && (i.price > 0 || (i.gems ?? 0) > 0)).map((i): Cand => ({ kind: 'item', id: i.id, base: i.gems ?? i.price, cur: i.gems ? 'gems' : 'coins' }));
  const species = SPECIES.filter((s) => !s.starter && (s.price > 0 || (s.gems ?? 0) > 0)).map((s): Cand => ({ kind: 'species', id: s.id, base: s.gems ?? s.price, cur: s.gems ? 'gems' : 'coins' }));
  return { pieces, items, species };
}

const dealKey = (c: { kind: string; id: string }) => `deal:${c.kind}:${c.id}`;
const shuffled = <T,>(a: T[], r: () => number) => { const o = a.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };

/**
 * Today's three deals, one per stump: an outfit, a plumage or another outfit, and a piece of
 * furniture. Seeded by the day so they stay put until midnight; things
 * the player already owns are skipped unless they were bought here today.
 */
export function dailyDeals(s: Save, day = dayKey()): Deal[] {
  const r = seededRng(strSeed('neve:' + day)); // (the seed's old name keeps today's deals where they were)
  const { pieces, items, species } = candidates();
  const bought = s.shop.day === day ? s.shop.bought : [];
  const free = (c: Cand) => !ownsEntry(s, c) || bought.includes(dealKey(c));
  const used = new Set<string>();
  const take = (list: Cand[]) => { for (const c of shuffled(list, r)) { const k = dealKey(c); if (!used.has(k) && free(c)) { used.add(k); return c; } } return null; };
  // the middle stand: a plumage one day in three, otherwise a second outfit piece
  const mid = r() < 0.34 ? take(species) ?? take(pieces) : take(pieces) ?? take(species);
  const picks = [take(pieces) ?? take(items), mid ?? take(items), take(items) ?? take(pieces)];
  const out: Deal[] = [];
  picks.forEach((c, slot) => {
    if (!c) return;
    const off = 20 + Math.floor(r() * 7) * 5; // 20, 25 ... 50
    const raw = c.base * (1 - off / 100);
    const price = c.cur === 'gems' ? Math.max(1, Math.round(raw)) : Math.max(5, Math.round(raw / 5) * 5);
    out.push({ slot, kind: c.kind, id: c.id, name: nameOf(c.kind, c.id), blurb: blurbOf(c.kind, c.id), cur: c.cur, base: c.base, price, off, key: dealKey(c) });
  });
  return out;
}

/** Start a new shop day when the date has changed (deals, gift and SOLD stamps reset; pity stays). */
export function rollDay(s: Save, day = dayKey()) {
  if (s.shop.day !== day) s.shop = { ...s.shop, day, bought: [], free: false, pity: s.shop.pity ?? {} };
}
export function ensureDay() { if (save.value.shop.day !== dayKey()) edit((s) => rollDay(s)); }

export const isSold = (s: Save, key: string, day = dayKey()) => s.shop.day === day && s.shop.bought.includes(key);

/** Buy one of today's deals. Returns an error, or null when it went through. */
export function buyDeal(d: Deal): string | null {
  const s = save.value;
  if (isSold(s, d.key)) return 'Sold out until tomorrow';
  if (ownsEntry(s, d)) return 'You already have this';
  if (d.cur === 'gems' ? s.gems < d.price : s.coins < d.price) return d.cur === 'gems' ? 'Not enough moon gems' : 'Not enough acorns';
  edit((x) => {
    rollDay(x);
    if (d.cur === 'gems') x.gems -= d.price; else x.coins -= d.price;
    grant(x, d);
    x.shop.bought.push(d.key);
  });
  return null;
}

// ------------------------------------------------------------------ portrait frames [ui5]

/** A frame on the store's frame wall: its price today (one frame a day is marked down). */
export interface FrameOffer { frame: FrameDef; cur: 'coins' | 'gems'; base: number; price: number; off: number; key: string; locked: number }
const frameKey = (id: string) => `frame:${id}`;
/** The frame wall: every frame Barnaby stocks, the frame of the day marked down 25..40%, and those the player's level
 * hasn't reached yet (locked = the level needed). Stable for the day. */
export function frameWall(s: Save, day = dayKey(), lv = 99): FrameOffer[] {
  const r = seededRng(strSeed('frames:' + day));
  const open = STORE_FRAMES.filter((f) => !ownsEntry(s, { kind: 'frame', id: f.id }) && (f.level ?? 0) <= lv);
  const pick = open.length ? open[Math.floor(r() * open.length)].id : '';
  const off = 25 + Math.floor(r() * 4) * 5;
  return STORE_FRAMES.map((f) => {
    const sale = f.id === pick;
    const raw = f.price * (1 - (sale ? off : 0) / 100);
    const price = !sale ? f.price : f.cur === 'gems' ? Math.max(1, Math.round(raw)) : Math.max(5, Math.round(raw / 5) * 5);
    return { frame: f, cur: f.cur, base: f.price, price, off: sale ? off : 0, key: frameKey(f.id), locked: (f.level ?? 0) > lv ? f.level ?? 0 : 0 };
  });
}
/** Buy a frame from the wall (and put it on). Returns an error, or null when it went through. */
export function buyFrame(o: FrameOffer, wearIt = true): string | null {
  const s = save.value;
  if (ownsEntry(s, { kind: 'frame', id: o.frame.id })) return 'You already have this frame';
  if (o.locked) return `Reach level ${o.locked} first`;
  if (o.cur === 'gems' ? s.gems < o.price : s.coins < o.price) return o.cur === 'gems' ? 'Not enough moon gems' : 'Not enough acorns';
  edit((x) => {
    rollDay(x);
    if (o.cur === 'gems') x.gems -= o.price; else x.coins -= o.price;
    grant(x, { kind: 'frame', id: o.frame.id });
    if (wearIt) x.frame = o.frame.id;
    x.shop.bought.push(o.key);
  });
  return null;
}

// ------------------------------------------------------------------ the daily gift

export interface Gift { coins?: number; gems?: number; label: string }
const GIFTS: Gift[] = [
  { coins: 80, label: '80 Acorns' }, { coins: 120, label: '120 Acorns' }, { gems: 20, label: '20 Moon Gems' },
  { coins: 150, label: '150 Acorns' }, { coins: 100, label: '100 Acorns' }, { gems: 30, label: '30 Moon Gems' }, { coins: 200, label: '200 Acorns' },
];
export const dailyGift = (day = dayKey()): Gift => GIFTS[strSeed('gift:' + day) % GIFTS.length];
export const giftClaimed = (s: Save, day = dayKey()) => s.shop.day === day && s.shop.free;
export function claimGift(): Gift | null {
  if (giftClaimed(save.value)) return null;
  const g = dailyGift();
  edit((x) => { rollDay(x); x.shop.free = true; x.coins += g.coins ?? 0; x.gems += g.gems ?? 0; });
  return g;
}

// ------------------------------------------------------------------ acorn piles and gem packs

export interface AcornPack { id: string; sprite: string; name: string; blurb: string; gems: number; coins: number; bonus?: number; tag?: string }
/** Moon gems -> acorns, more generous the bigger the pile. */
export const ACORN_PACKS: AcornPack[] = [
  { id: 'handful', sprite: 'coin_pouch', name: 'Handful of Acorns', blurb: 'A pocketful, picked this morning.', gems: 60, coins: 600 },
  { id: 'sack', sprite: 'coin_sack', name: 'Sack of Acorns', blurb: 'Burlap, bulging, slightly leaky.', gems: 150, coins: 1650, bonus: 10 },
  { id: 'basket', sprite: 'coin_chest', name: 'Bucket of Acorns', blurb: 'An oak pail heaped high by the squirrels of the Hollow.', gems: 300, coins: 3600, bonus: 20, tag: 'Popular' },
  { id: 'mountain', sprite: 'coin_vault', name: 'Acorn Mountain', blurb: 'A whole autumn of golden acorns, and a few gems hiding inside.', gems: 640, coins: 8400, bonus: 30, tag: 'Best value' },
];
export function buyAcorns(p: AcornPack): string | null {
  if (save.value.gems < p.gems) return 'Not enough moon gems';
  edit((x) => { x.gems -= p.gems; x.coins += p.coins; });
  return null;
}

export interface GemPack { id: string; name: string; gems: number; bonus: number; price: string; tag?: string; size: 1 | 2 | 3 | 4 }
/** Real-money packs in a real app; this build only has a clearly labelled demo store. */
export const GEM_PACKS: GemPack[] = [
  { id: 'gems_80', name: 'Moon Gem Shard', gems: 80, bonus: 0, price: '$0.99', size: 1 },
  { id: 'gems_420', name: 'Moon Gem Cluster', gems: 400, bonus: 20, price: '$4.99', size: 2 },
  { id: 'gems_1300', name: 'Moon Gem Geode', gems: 1200, bonus: 100, price: '$14.99', tag: 'Popular', size: 3 },
  { id: 'gems_2800', name: 'Moon Gem Crown', gems: 2500, bonus: 300, price: '$29.99', tag: 'Best value', size: 4 },
];
export function grantGems(p: GemPack) { edit((x) => { x.gems += p.gems + p.bonus; }); }

// ------------------------------------------------------------------ wishes

/** Acorns given back for a duplicate cosmetic (furniture stacks instead). */
export const DUPE_COINS: Record<Stars, number> = { 3: 60, 4: 300, 5: 1500 };
export interface Prize extends PullResult { isNew: boolean; dupe: number }

export const pityOf = (s: Save, id: string): Pity => ({ ...freshPity(), ...(s.shop.pity?.[id] ?? {}) });

/** Give one wish's prize to the save: new things are granted, repeat cosmetics turn into acorns. */
export function applyPrize(x: Save, r: PullResult): Prize {
  const e: SeriesEntry = r.entry;
  const had = ownsEntry(x, e);
  if (had && e.kind !== 'item') { const dupe = DUPE_COINS[r.stars]; x.coins += dupe; return { ...r, isNew: false, dupe }; }
  grant(x, e);
  return { ...r, isNew: !had, dupe: 0 };
}

/** Make `n` wishes on a series, paying moon gems. */
export function wish(seriesId: string, n: 1 | 10, rng: Rng = Math.random, anyWeek = false): { error: string } | { prizes: Prize[] } {
  const s = SERIES_BY_ID[seriesId];
  if (!s) return { error: 'That series has left the shelf' };
  if (!seriesActive(s) && !anyWeek) return { error: 'This series returns next week' };
  const cost = PULL_COST * n;
  if (save.value.gems < cost) return { error: 'Not enough moon gems' };
  let prizes: Prize[] = [];
  edit((x) => {
    rollDay(x);
    x.gems -= cost;
    const r = pull(s, n, rng, pityOf(x, s.id));
    x.shop.pity = { ...x.shop.pity, [s.id]: r.pity };
    prizes = r.results.map((res) => applyPrize(x, res));
  });
  logWishes(s.id, prizes);
  return { prizes };
}

// The wish history lives beside the save (it is only for reading back), newest first.
export interface WishLog { t: number; series: string; kind: RewardKind; id: string; stars: Stars; dupe: number }
const LOG_KEY = 'hoot-hollow:wishes';
let memLog: WishLog[] = [];
export function wishLog(): WishLog[] {
  try { const raw = localStorage.getItem(LOG_KEY); if (raw) return JSON.parse(raw) as WishLog[]; } catch { /* storage blocked */ }
  return memLog;
}
function logWishes(series: string, prizes: Prize[]) {
  const t = Date.now();
  const add = prizes.map((p, i): WishLog => ({ t: t + i, series, kind: p.entry.kind, id: p.entry.id, stars: p.stars, dupe: p.dupe })).reverse();
  memLog = [...add, ...wishLog()].slice(0, 200);
  try { localStorage.setItem(LOG_KEY, JSON.stringify(memLog)); } catch { /* storage blocked */ }
}

export { PULL_COST, SERIES, SERIES_BY_ID };
