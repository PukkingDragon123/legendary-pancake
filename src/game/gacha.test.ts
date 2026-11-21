import { describe, expect, it } from 'vitest';
import { fiveChance, fourChance, freshPity, pull, pullOne, seeded, untilFive } from './gacha.ts';
import { FROSTLIGHT, ODDS, STARFALL } from './series.ts';

const never = () => 0.999; // a cursed player: no lucky roll ever lands

describe('pity', () => {
  it('ramps the 5-star chance from soft pity and caps at the hard pity', () => {
    expect(fiveChance(1)).toBe(ODDS.five);
    expect(fiveChance(ODDS.softFrom - 1)).toBe(ODDS.five);
    expect(fiveChance(ODDS.softFrom)).toBeGreaterThan(ODDS.five);
    expect(fiveChance(ODDS.softFrom + 5)).toBeGreaterThan(fiveChance(ODDS.softFrom));
    expect(fiveChance(ODDS.hard)).toBe(1);
    expect(fourChance(ODDS.fourHard)).toBe(1);
  });

  it('guarantees a 5-star on the 90th wish even with no luck at all', () => {
    const { results } = pull(FROSTLIGHT, 90, never);
    const fives = results.map((r, i) => [r.stars, i] as const).filter(([s]) => s === 5);
    expect(fives).toHaveLength(1);
    expect(fives[0][1]).toBe(ODDS.hard - 1);
  });

  it('guarantees a 4-star or better every 10 wishes', () => {
    const { results } = pull(FROSTLIGHT, 80, never);
    for (let i = 0; i < 80; i++) expect(results[i].stars).toBe((i + 1) % 10 === 0 ? 4 : 3);
  });

  it('a lost 50/50 makes the next 5-star the featured one', () => {
    const a = pull(FROSTLIGHT, 90, never, freshPity());
    const first = a.results[89];
    expect(first.stars).toBe(5);
    expect(first.featured).toBe(false); // the cursed roll loses the 50/50
    expect(first.lost).toBe(true);
    expect(a.pity.guaranteed).toBe(true);
    const b = pull(FROSTLIGHT, 90, never, a.pity);
    expect(b.results[89].stars).toBe(5);
    expect(b.results[89].featured).toBe(true);
    expect(b.results[89].entry.id).toBe('gingerbread');
    expect(b.pity.guaranteed).toBe(false);
  });

  it('keeps pity between sessions and does not mutate the input', () => {
    const p0 = freshPity();
    const a = pull(FROSTLIGHT, 50, never, p0);
    expect(p0.five).toBe(0);
    expect(a.pity.five).toBe(50);
    expect(untilFive(a.pity)).toBe(40);
    const b = pull(FROSTLIGHT, 40, never, a.pity);
    expect(b.results[39].stars).toBe(5);
    expect(b.pity.total).toBe(90);
  });

  it('a series with a single 5-star never loses the 50/50', () => {
    const { results, pity } = pull(STARFALL, 90, never);
    expect(results[89].entry.id).toBe('celestial');
    expect(results[89].featured).toBe(true);
    expect(pity.guaranteed).toBe(false);
  });
});

describe('odds over many wishes', () => {
  const N = 200_000;
  const rng = seeded(1234);
  const p = freshPity();
  let five = 0, four = 0, feat5 = 0, gap5 = 0, gap4 = 0, maxGap5 = 0, maxGap4 = 0;
  const ids = new Set<string>();
  for (let i = 0; i < N; i++) {
    const r = pullOne(FROSTLIGHT, p, rng);
    ids.add(r.entry.id);
    gap5++; gap4++;
    if (r.stars === 5) { five++; if (r.featured) feat5++; maxGap5 = Math.max(maxGap5, gap5); maxGap4 = Math.max(maxGap4, gap4); gap5 = 0; gap4 = 0; }
    else if (r.stars === 4) { four++; maxGap4 = Math.max(maxGap4, gap4); gap4 = 0; }
  }
  it('lands near the consolidated rates (about 1.6% and 13%)', () => {
    expect(five / N).toBeGreaterThan(0.014);
    expect(five / N).toBeLessThan(0.019);
    expect(four / N).toBeGreaterThan(0.11);
    expect(four / N).toBeLessThan(0.15);
  });
  it('never goes past the hard pity', () => {
    expect(maxGap5).toBeLessThanOrEqual(ODDS.hard);
    expect(maxGap4).toBeLessThanOrEqual(ODDS.fourHard);
  });
  it('gives the featured 5-star two times in three thanks to the guarantee', () => {
    expect(feat5 / five).toBeGreaterThan(0.62);
    expect(feat5 / five).toBeLessThan(0.71);
  });
  it('can hand out every prize in the pool', () => {
    for (const e of FROSTLIGHT.pool) expect(ids.has(e.id)).toBe(true);
  });
});
