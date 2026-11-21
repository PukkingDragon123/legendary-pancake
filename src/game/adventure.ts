// What Pip got up to while you slept. A night's report decides how far Pip wandered and how lucky
// the finds were: better sleep means more treasures and rarer ones. The story is woven from the
// area's sights, friends and deeds so every morning reads a little differently.
import type { SleepReport } from '../sleep/types.ts';
import { AREA, lootTable, type LootEntry, type Rarity } from './catalog.ts';

export interface Find extends LootEntry { dupe?: boolean }
export interface AdventureResult {
  area: string;
  story: string[];
  finds: Find[];
  coins: number;
  xp: number;
  gems: number;
  /** 0..1 how good the trip was */
  luck: number;
}

const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const WEIGHT: Record<Rarity, number> = { common: 10, uncommon: 4.5, rare: 1.6, legendary: 0.45 };

export function rollAdventure(o: { area: string; report: SleepReport; seed: number; owned: (e: LootEntry) => boolean; plus: boolean; name: string; streak: number }): AdventureResult {
  const r = mulberry(o.seed);
  const a = AREA[o.area] ?? AREA.woods;
  const rep = o.report;
  const hours = rep.asleep / 3.6e6;
  // luck: mostly the sleep score, a little for the streak
  const luck = Math.max(0.05, Math.min(1, rep.score / 100 * 0.85 + Math.min(o.streak, 7) * 0.02));
  // every real night brings at least one present home; good nights bring more
  const count = (hours < 1 ? 0 : hours < 5 ? 1 : luck > 0.82 ? 3 : 2) + (o.plus && hours >= 1 ? 1 : 0);

  const table = lootTable(a.id);
  const finds: Find[] = [];
  for (let i = 0; i < count; i++) {
    // good nights shift the odds towards rare things
    const boost = (k: Rarity) => WEIGHT[k] * (k === 'common' ? 1.4 - luck : k === 'uncommon' ? 1 : 0.4 + luck * 1.6);
    // furniture can turn up again (another chair is always welcome); outfits and coats only once
    const pool = table.filter((e) => !finds.some((f) => f.id === e.id) && (e.kind === 'item' || !o.owned(e)));
    if (!pool.length) break;
    let total = 0;
    for (const e of pool) total += boost(e.rarity);
    let pick = r() * total, chosen = pool[0];
    for (const e of pool) { pick -= boost(e.rarity); if (pick <= 0) { chosen = e; break; } }
    finds.push({ ...chosen, dupe: chosen.kind === 'item' && o.owned(chosen) });
  }

  const pickOf = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const name = o.name;
  const story: string[] = [];
  if (hours < 1) story.push(`${name} had barely packed the satchel before it was time to come home.`);
  else {
    story.push(pickOf([`${name} flew out over ${a.name} just after you closed your eyes.`, `With a soft hoot (and a tiny meow), ${name} set off for ${a.name}.`, `${name} slipped out of the window and glided towards ${a.name}.`]));
    story.push(`On the way, ${name} spotted ${pickOf(a.sights)}.`);
    if (hours >= 3) story.push(`Later, ${name} met ${pickOf(a.friends)} and ${pickOf(a.deeds)}.`);
    if (hours >= 6) story.push(pickOf([`By the time the sky turned pink, the satchel was heavy with treasure.`, `${name} flew home the long way round, just to look at the stars a little longer.`, `${name} hummed the whole way home.`]));
  }
  const coins = Math.round(30 + rep.score * 1.1 + Math.min(9, hours) * 8);
  const xp = Math.round(25 + rep.score * 0.9 + Math.min(9, hours) * 5);
  const gems = luck > 0.9 ? 5 : luck > 0.75 ? 2 : 0;
  return { area: a.id, story, finds, coins, xp, gems, luck };
}
