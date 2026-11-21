// Wishes on a limited series: the rules only, no save or UI. A wish rolls a rarity with pity
// (soft pity ramps the 5-star chance up from pull 74, pull 90 always hits; every 10th pull is at
// least a 4-star), then a prize of that rarity, with a 50/50 between the featured prizes and the
// rest. Losing a 5-star 50/50 guarantees the featured one next time.
import { ODDS, type Series, type SeriesEntry, type Stars } from './series.ts';

export interface Pity {
  /** pulls since the last 5-star */
  five: number;
  /** pulls since the last 4-star or better */
  four: number;
  /** wishes made on this series, ever */
  total: number;
  /** the next 5-star is the featured one (the last 50/50 was lost) */
  guaranteed?: boolean;
}
export const freshPity = (): Pity => ({ five: 0, four: 0, total: 0, guaranteed: false });

export interface PullResult {
  entry: SeriesEntry;
  stars: Stars;
  featured: boolean;
  /** which wish since the previous 5-star this one was (for the history) */
  pityAt: number;
  /** a 5-star that lost its 50/50 */
  lost?: boolean;
}

export type Rng = () => number;

/** Chance of a 5-star on the `n`th pull since the last one (1-based). */
export function fiveChance(n: number): number {
  if (n >= ODDS.hard) return 1;
  if (n < ODDS.softFrom) return ODDS.five;
  // soft pity: +6% per pull from softFrom, which reaches certainty a little before the hard cap
  return Math.min(1, ODDS.five + (n - ODDS.softFrom + 1) * 0.06);
}
/** Chance of a 4-star on the `n`th pull since the last 4-star or better (1-based). */
export function fourChance(n: number): number {
  if (n >= ODDS.fourHard) return 1;
  if (n === ODDS.fourHard - 1) return Math.min(1, ODDS.four * 10); // a little soft pity on the 9th
  return ODDS.four;
}

const of = (s: Series, stars: Stars, featured: boolean | null) => s.pool.filter((e) => e.stars === stars && (featured === null || !!e.featured === featured));
const pick = <T,>(a: T[], rng: Rng): T => a[Math.min(a.length - 1, Math.floor(rng() * a.length))];

/** One wish. Mutates `p`. */
export function pullOne(s: Series, p: Pity, rng: Rng): PullResult {
  p.total++;
  const n5 = p.five + 1, n4 = p.four + 1;
  let stars: Stars = 3;
  if (rng() < fiveChance(n5)) stars = 5;
  else if (rng() < fourChance(n4)) stars = 4;
  // a series without prizes of that rarity falls back down the ladder
  if (stars === 5 && !of(s, 5, null).length) stars = 4;
  if (stars === 4 && !of(s, 4, null).length) stars = 3;

  let entry: SeriesEntry, featured = false, lost = false;
  if (stars === 5) {
    const feat = of(s, 5, true), rest = of(s, 5, false);
    if (p.guaranteed || !rest.length || !feat.length || rng() < ODDS.featuredChance) {
      entry = pick(feat.length ? feat : rest, rng);
      featured = !!entry.featured;
      p.guaranteed = false;
    } else {
      entry = pick(rest, rng);
      lost = true;
      p.guaranteed = true;
    }
    p.five = 0; p.four = 0;
  } else if (stars === 4) {
    const feat = of(s, 4, true), rest = of(s, 4, false);
    entry = feat.length && (!rest.length || rng() < ODDS.featuredChance) ? pick(feat, rng) : pick(rest, rng);
    featured = !!entry.featured;
    p.five++; p.four = 0;
  } else {
    const pool3 = of(s, 3, null);
    entry = pick(pool3.length ? pool3 : s.pool, rng);
    featured = !!entry.featured;
    p.five++; p.four++;
  }
  return { entry, stars: entry.stars, featured, pityAt: n5, ...(lost ? { lost } : {}) };
}

/** `n` wishes in a row. Returns the prizes and the new pity (the input is not changed). */
export function pull(s: Series, n: number, rng: Rng = Math.random, pity: Pity = freshPity()): { results: PullResult[]; pity: Pity } {
  const p: Pity = { ...freshPity(), ...pity };
  const results: PullResult[] = [];
  for (let i = 0; i < n; i++) results.push(pullOne(s, p, rng));
  return { results, pity: p };
}

/** Wishes left until the 5-star is certain. */
export const untilFive = (p: Pity | undefined) => ODDS.hard - (p?.five ?? 0);
/** Wishes left until a 4-star or better is certain. */
export const untilFour = (p: Pity | undefined) => ODDS.fourHard - (p?.four ?? 0);

/** Long-run rates a player can read on the banner's details page. */
export function displayRates(s: Series) {
  const f5 = of(s, 5, true), f4 = of(s, 4, true);
  return {
    five: ODDS.five, four: ODDS.four, three: 1 - ODDS.five - ODDS.four,
    // consolidated rates include pity: about 1.6% for 5-stars and 13% for 4-stars
    five_c: 0.016, four_c: 0.13,
    featured5: f5, featured4: f4,
    hard: ODDS.hard, softFrom: ODDS.softFrom, fourHard: ODDS.fourHard,
  };
}

/** A small seeded generator (mulberry32) for tests and replays. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
