// [profile] Friends and the leaderboard, honestly local: there is no server, so a friend is a snapshot you paste in.
//
// A friend code is a short, copyable string (or a link carrying it as #friend=...) that encodes your name, your owl's
// look, your frame, level, streak, best streak, and your average sleep score and hours over your last two weeks of
// tracked nights. It is versioned and checksummed, so a code that was cut short or mistyped is refused with a friendly
// message instead of adding a garbled friend:
//
//     hoot1.<base64url of a compact JSON array>.<5-char FNV-1a checksum in base 36>
//
// Adding a friend stores the snapshot; pasting an updated code from the same owl (same id) refreshes it in place.
// The leaderboard ranks you, your friends and the Hollow's neighbours (Barnaby and friends: clearly characters, never
// people) by streak, average sleep or level, with standard competition ranking for ties (1, 2, 2, 4).
// Pure functions (tested in social.test.ts); the save actions are in friends.ts.
import type { OutfitSlot, OwlLook } from '../owl/model.ts';
import { levelOf } from './catalog.ts';
import type { Save } from './store.ts';

export const CODE_VERSION = 1;
const PREFIX = 'hoot';
const SLOTS: OutfitSlot[] = ['head', 'face', 'neck', 'body', 'back'];
const DAY = 86_400_000;

export interface SocialStats {
  level: number;
  streak: number;
  best: number;
  /** average sleep score 0..100 over the recent tracked nights (null: none tracked yet) */
  score: number | null;
  /** average hours asleep (one decimal; null: none tracked yet) */
  hours: number | null;
  /** how many nights the averages are over */
  nights: number;
}
/** What a friend code carries. */
export interface FriendCard {
  v: number;
  /** the owl's stable id (refreshes match on it) */
  id: string;
  name: string;
  look: OwlLook;
  frame: string;
  stats: SocialStats;
  /** when the code was made (ms, to the day) */
  at: number;
}
/** A friend as kept in the save. */
export interface FriendSnap extends FriendCard {
  added: number;
  updated: number;
}

// ------------------------------------------------------------------ bytes

/** UTF-8 safe base64url (no padding) */
export function b64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64url(s: string): string {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
/** FNV-1a (32 bit) of a string, as 5 base-36 digits */
export function checksum(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return ((h >>> 0) % 36 ** 5).toString(36).padStart(5, '0');
}

// ------------------------------------------------------------------ cleaning what comes in

const clampN = (v: unknown, a: number, b: number, d = a) => { const n = typeof v === 'number' && Number.isFinite(v) ? v : d; return Math.min(b, Math.max(a, n)); };
const ID_RE = /^[a-z0-9_-]{1,32}$/i;
const cleanId = (v: unknown): string | undefined => (typeof v === 'string' && ID_RE.test(v) ? v : undefined);
/** A display name: no control characters, at most 24 characters (by code point), never empty. */
export function cleanName(v: unknown, fallback = 'Owl'): string {
  const raw = typeof v === 'string' ? v : '';
  // eslint-disable-next-line no-control-regex
  const s = [...raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()].slice(0, 24).join('').trim();
  return s || fallback;
}
function cleanLook(v: Partial<OwlLook> | undefined): OwlLook {
  const outfit: OwlLook['outfit'] = {};
  for (const k of SLOTS) { const id = cleanId(v?.outfit?.[k]); if (id) outfit[k] = id; }
  return { skin: cleanId(v?.skin) ?? 'owl', species: cleanId(v?.species) ?? 'tawny', palette: cleanId(v?.palette) ?? 'tawny', outfit };
}
function cleanStats(v: Partial<SocialStats> | undefined): SocialStats {
  const nights = Math.round(clampN(v?.nights, 0, 9999));
  const has = nights > 0;
  return {
    level: Math.round(clampN(v?.level, 1, 999, 1)),
    streak: Math.round(clampN(v?.streak, 0, 99999)),
    best: Math.round(Math.max(clampN(v?.best, 0, 99999), clampN(v?.streak, 0, 99999))),
    score: has && typeof v?.score === 'number' ? Math.round(clampN(v.score, 0, 100)) : null,
    hours: has && typeof v?.hours === 'number' ? Math.round(clampN(v.hours, 0, 24) * 10) / 10 : null,
    nights,
  };
}
/** A friend snapshot from the save, checked (null when it is not one). */
export function cleanFriend(v: unknown): FriendSnap | null {
  if (!v || typeof v !== 'object') return null;
  const f = v as Partial<FriendSnap>;
  const id = cleanId(f.id);
  if (!id) return null;
  const now = Date.now();
  return {
    v: CODE_VERSION, id, name: cleanName(f.name), look: cleanLook(f.look), frame: cleanId(f.frame) ?? 'walnut', stats: cleanStats(f.stats),
    at: clampN(f.at, 0, 8.64e15, now), added: clampN(f.added, 0, 8.64e15, now), updated: clampN(f.updated, 0, 8.64e15, now),
  };
}

// ------------------------------------------------------------------ the code

/** Make a friend code from a card. */
export function encodeCode(c: FriendCard): string {
  const l = cleanLook(c.look), st = cleanStats(c.stats);
  const arr = [
    CODE_VERSION, c.id, cleanName(c.name), l.skin, l.species, l.palette, SLOTS.map((k) => l.outfit[k] ?? 0), cleanId(c.frame) ?? 'walnut',
    st.level, st.streak, st.best, st.score ?? -1, st.hours === null ? -1 : Math.round(st.hours * 10), st.nights, Math.floor(c.at / DAY),
  ];
  const body = b64url(JSON.stringify(arr));
  return `${PREFIX}${CODE_VERSION}.${body}.${checksum(body)}`;
}

export type DecodeResult = { ok: true; card: FriendCard } | { ok: false; error: string };
const CODE_RE = /hoot(\d+)\.([A-Za-z0-9_-]+)\.([0-9a-z]{5})/;
/** Pull a code out of whatever was pasted (the bare code, a link with #friend=..., a message with the code in it). */
export function findCode(text: string): string | null {
  const m = CODE_RE.exec((text ?? '').replace(/\s+/g, ''));
  return m ? m[0] : null;
}
/** Read a friend code (or a link or message that contains one). */
export function decodeCode(text: string): DecodeResult {
  const raw = (text ?? '').trim();
  if (!raw) return { ok: false, error: 'Paste a friend code first.' };
  const m = CODE_RE.exec(raw.replace(/\s+/g, ''));
  if (!m) return { ok: false, error: 'That doesn’t look like a friend code. They start with “hoot1.”' };
  const [, ver, body, sum] = m;
  if (+ver !== CODE_VERSION) return { ok: false, error: +ver > CODE_VERSION ? 'That code was made by a newer Hoot Hollow. Update the app to add this friend.' : 'That friend code is too old to read.' };
  if (checksum(body) !== sum) return { ok: false, error: 'Part of that code is missing or mistyped. Ask for it again and paste the whole thing.' };
  let arr: unknown;
  try { arr = JSON.parse(unb64url(body)); } catch { return { ok: false, error: 'That friend code is damaged.' }; }
  if (!Array.isArray(arr) || arr.length < 15 || arr[0] !== CODE_VERSION) return { ok: false, error: 'That friend code is damaged.' };
  const [, id, name, skin, species, palette, outfitArr, frame, level, streak, best, score, hours10, nights, day] = arr as unknown[];
  const cid = cleanId(id);
  if (!cid) return { ok: false, error: 'That friend code is damaged.' };
  const outfit: Partial<Record<OutfitSlot, string>> = {};
  if (Array.isArray(outfitArr)) SLOTS.forEach((k, i) => { const v = cleanId(outfitArr[i]); if (v) outfit[k] = v; });
  const n = clampN(nights, 0, 9999);
  const card: FriendCard = {
    v: CODE_VERSION, id: cid, name: cleanName(name), frame: cleanId(frame) ?? 'walnut',
    look: cleanLook({ skin: skin as string, species: species as string, palette: palette as string, outfit }),
    stats: cleanStats({ level: level as number, streak: streak as number, best: best as number, nights: n, score: typeof score === 'number' && score >= 0 ? score : undefined, hours: typeof hours10 === 'number' && hours10 >= 0 ? hours10 / 10 : undefined }),
    at: clampN(day, 0, 1e8) * DAY,
  };
  return { ok: true, card };
}

/** A link that opens Hoot Hollow on the friends page with the code ready to add. */
export function codeLink(code: string, base = typeof location !== 'undefined' ? location.origin + location.pathname : 'https://hoot-hollow.app/'): string {
  return `${base}#friend=${code}`;
}

// ------------------------------------------------------------------ you

type StatSave = Pick<Save, 'xp' | 'streak' | 'bestStreak' | 'nights'>;
/** Your numbers: level, streaks, and the averages of your last 14 tracked (real) nights. */
export function myStats(s: StatSave): SocialStats {
  const real = s.nights.filter((n) => n.report && !n.simulated).sort((a, b) => b.start - a.start).slice(0, 14);
  const k = real.length;
  const score = k ? Math.round(real.reduce((a, n) => a + n.report!.score, 0) / k) : null;
  const hours = k ? Math.round((real.reduce((a, n) => a + n.report!.asleep, 0) / k / 3_600_000) * 10) / 10 : null;
  return { level: levelOf(s.xp).level, streak: s.streak, best: Math.max(s.bestStreak, s.streak), score, hours, nights: k };
}
/** Your card (what your code shares). */
export function myCard(s: StatSave & Pick<Save, 'name' | 'look' | 'frame'> & { pid?: string }, now = Date.now()): FriendCard {
  return { v: CODE_VERSION, id: s.pid ?? 'me', name: cleanName(s.name, 'Pip'), look: s.look, frame: s.frame, stats: myStats(s), at: now };
}
export const myCode = (s: Save, now = Date.now()) => encodeCode(myCard(s, now));

// ------------------------------------------------------------------ the friends list

export type AddStatus = 'added' | 'updated' | 'same' | 'self' | 'older';
/**
 * Put a friend's card into the list: new ids are added (newest first), a known id is refreshed in place (keeping when
 * you added them), an older code than the one you have changes nothing, and your own code is refused.
 */
export function upsertFriend(list: FriendSnap[], card: FriendCard, myId: string | undefined, now = Date.now()): { list: FriendSnap[]; status: AddStatus; friend?: FriendSnap } {
  if (myId && card.id === myId) return { list, status: 'self' };
  const i = list.findIndex((f) => f.id === card.id);
  if (i < 0) {
    const friend: FriendSnap = { ...card, added: now, updated: now };
    return { list: [friend, ...list], status: 'added', friend };
  }
  const old = list[i];
  if (card.at < old.at) return { list, status: 'older', friend: old };
  const same = JSON.stringify([old.name, old.look, old.frame, old.stats]) === JSON.stringify([card.name, card.look, card.frame, card.stats]);
  if (same && card.at === old.at) return { list, status: 'same', friend: old };
  const friend: FriendSnap = { ...card, added: old.added, updated: now };
  const out = list.slice();
  out[i] = friend;
  return { list: out, status: same ? 'same' : 'updated', friend };
}

// ------------------------------------------------------------------ neighbours

export type Critter = 'beaver' | 'hedgehog' | 'fox' | 'badger' | 'hare';
export interface Neighbour { id: string; name: string; critter: Critter; blurb: string; level: number; period: number; offset: number; score: number; hours: number }
/**
 * The Hollow's neighbours: characters from the forest (never real people), on the board so it is lively before you add
 * anyone. Their streaks run up a day at a time and start again every so often, and their averages drift a little from
 * day to day, all worked out from the date (the same for everyone, the same all day).
 */
export const NEIGHBOURS: Neighbour[] = [
  { id: 'barnaby', name: 'Barnaby Birchbark', critter: 'beaver', blurb: 'Keeps the lodge store. Up with the sun, asleep by nine, pencil behind his ear.', level: 9, period: 47, offset: 31, score: 82, hours: 7.8 },
  { id: 'hazel', name: 'Hazel Quill', critter: 'hedgehog', blurb: 'Curls up in a leaf pile under the hawthorn. Sleeps like a pincushion.', level: 6, period: 23, offset: 4, score: 88, hours: 8.6 },
  { id: 'fen', name: 'Fennimore Russet', critter: 'fox', blurb: 'Swears he is a night owl. He is not an owl.', level: 7, period: 12, offset: 9, score: 64, hours: 6.4 },
  { id: 'mabel', name: 'Mabel Sett', critter: 'badger', blurb: 'Early to bed, early to dig. Snores like a kettle.', level: 11, period: 61, offset: 52, score: 79, hours: 8.1 },
  { id: 'juniper', name: 'Juniper Hare', critter: 'hare', blurb: 'Naps in the long grass with one ear up. Very fast at falling asleep.', level: 4, period: 9, offset: 2, score: 71, hours: 7.2 },
];
const dayIndex = (t: number) => Math.floor((t - new Date(t).getTimezoneOffset() * 60_000) / DAY);
const wobble = (seed: string, d: number) => { const h = checksum(seed + ':' + d); return (parseInt(h, 36) % 1000) / 1000 - 0.5; };
/** A neighbour's numbers on the day of `now`. */
export function neighbourStats(n: Neighbour, now = Date.now()): SocialStats {
  const d = dayIndex(now);
  const streak = (d + n.offset) % n.period;
  return {
    level: n.level + Math.floor(Math.max(0, d - 20_758) / 45), // a level every six weeks or so (from November 2026)
    streak,
    best: n.period - 1,
    score: Math.round(Math.min(99, Math.max(30, n.score + wobble(n.id, d) * 8))),
    hours: Math.round((n.hours + wobble(n.id + 'h', d) * 0.6) * 10) / 10,
    nights: 14,
  };
}

// ------------------------------------------------------------------ the leaderboard

export type Board = 'streak' | 'sleep' | 'level';
export interface Entry { key: string; name: string; kind: 'you' | 'friend' | 'neighbour'; stats: SocialStats }
export interface Ranked<E extends Entry = Entry> {
  entry: E;
  /** competition rank (1, 2, 2, 4); null when there is nothing to rank on (no tracked nights on the sleep board) */
  rank: number | null;
  /** someone else has the same value */
  tie: boolean;
  value: number | null;
}
/** The number a board ranks on. */
export function boardValue(b: Board, s: SocialStats): number | null {
  if (b === 'streak') return s.streak;
  if (b === 'level') return s.level;
  return s.nights > 0 && s.score !== null ? s.score : null;
}
/** What breaks a tie for the order shown (the rank stays shared). */
function second(b: Board, s: SocialStats): number[] {
  if (b === 'streak') return [s.best, s.level];
  if (b === 'level') return [s.streak, s.best];
  return [s.hours ?? 0, s.nights];
}
/**
 * Rank everyone on a board: highest first; equal values share a rank and the next rank skips (1, 2, 2, 4); within a
 * tie the order follows the board's second numbers, then you before others, then the name. Entries with no value (no
 * tracked nights, on the sleep board) come last, unranked.
 */
export function rankBoard<E extends Entry>(list: E[], b: Board): Ranked<E>[] {
  const withV = list.map((entry) => ({ entry, value: boardValue(b, entry.stats) }));
  const cmpTail = (x: E, y: E) => {
    const a = second(b, x.stats), c = second(b, y.stats);
    for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) return c[i] - a[i];
    if (x.kind !== y.kind && (x.kind === 'you' || y.kind === 'you')) return x.kind === 'you' ? -1 : 1;
    return x.name.localeCompare(y.name) || x.key.localeCompare(y.key);
  };
  withV.sort((x, y) => {
    if (x.value === null || y.value === null) return x.value === y.value ? cmpTail(x.entry, y.entry) : x.value === null ? 1 : -1;
    return y.value - x.value || cmpTail(x.entry, y.entry);
  });
  const counts = new Map<number, number>();
  for (const w of withV) if (w.value !== null) counts.set(w.value, (counts.get(w.value) ?? 0) + 1);
  let rank = 0;
  return withV.map((w, i) => {
    if (w.value === null) return { entry: w.entry, rank: null, tie: false, value: null };
    if (i === 0 || withV[i - 1].value !== w.value) rank = i + 1;
    return { entry: w.entry, rank, tie: (counts.get(w.value) ?? 0) > 1, value: w.value };
  });
}
