import { describe, expect, it } from 'vitest';
import { demoNight } from '../../sleep/simulate.ts';
import type { Save } from '../../game/store.ts';
import { averages, bestRun, chunk, daysTogether, eveningMin, goalName, lastWeek, reported, seals, statNights } from './stats.ts';

const DAY = 86_400_000;
function nights(n: number, now: number) {
  return Array.from({ length: n }, (_, i) => {
    const s = demoNight({ now: now - (n - 1 - i) * DAY, seed: 11 + i, snorer: i % 3 === 0, restless: (i % 4) * 0.15 });
    return { ...s, id: 'n' + i, simulated: false };
  });
}
const base = (over: Partial<Save>): Save => ({
  nights: [], bestStreak: 0, streak: 0, xp: 0, profile: { interviewed: false } as Save['profile'], breath: { sessions: 0, minutes: 0 } as Save['breath'],
  home: { floors: {}, unlocked: ['f1'], boxes: ['a'], seeded: true }, shop: { day: '', bought: [], free: false, pity: {} },
  owned: { items: [], pieces: [], palettes: [], skins: [], species: [], finishes: [] }, seen: { zones: [], areas: ['woods'] }, ...over,
} as unknown as Save);

describe('book stats', () => {
  const now = new Date(2026, 10, 21, 9, 0).getTime();
  const ns = nights(12, now);

  it('averages a dozen nights sensibly', () => {
    const a = averages(reported({ nights: ns }));
    expect(a.count).toBe(12);
    expect(a.asleep / 3.6e6).toBeGreaterThan(5);
    expect(a.asleep / 3.6e6).toBeLessThan(9);
    expect(a.score).toBeGreaterThan(30);
    // bedtime near 23:00 = 300 minutes after 18:00
    expect(a.bedtime).toBeGreaterThan(240);
    expect(a.bedtime).toBeLessThan(420);
    expect(a.deep + a.light + a.rem + a.awake).toBeCloseTo(1, 1);
  });

  it('finds the last week of nights by day', () => {
    const w = lastWeek(reported({ nights: ns }), now);
    expect(w).toHaveLength(7);
    expect(w.every((d) => d.night)).toBe(true);
  });

  it('prefers real nights over demo nights', () => {
    const demo = ns.slice(0, 3).map((n) => ({ ...n, simulated: true }));
    expect(statNights({ nights: demo }).demo).toBe(true);
    expect(statNights({ nights: [...demo, ns[5]] }).nights).toHaveLength(1);
  });

  it('counts streak runs over calendar days', () => {
    expect(bestRun(reported({ nights: ns }), 1)).toBe(12);
    expect(bestRun(reported({ nights: [ns[0], ns[2], ns[3]] }), 1)).toBe(2);
  });

  it('awards seals from the save', () => {
    const none = seals(base({}));
    expect(none.find((s) => s.id === 'first')?.done).toBe(false);
    const some = seals(base({ nights: ns, bestStreak: 7, breath: { sessions: 3, minutes: 9 } as Save['breath'], home: { floors: {}, unlocked: ['f1'], boxes: [], seeded: true }, shop: { day: '', bought: [], free: false, pity: { frost: { five: 0, four: 0, total: 2 } } } }));
    const got = new Set(some.filter((s) => s.done).map((s) => s.id));
    for (const id of ['first', 'week', 'streak3', 'streak7', 'breath1', 'breath50', 'unpacked', 'wish']) expect(got.has(id)).toBe(true);
    expect(got.has('month')).toBe(false);
  });

  it('small helpers', () => {
    expect(eveningMin(new Date(2026, 0, 1, 23, 30).getTime())).toBe(330);
    expect(eveningMin(new Date(2026, 0, 2, 0, 30).getTime())).toBe(390);
    expect(goalName('fall_asleep')).toBe('Fall asleep');
    expect(goalName('earlier')).toBe('Go to bed earlier');
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 4)).toEqual([[]]);
    expect(daysTogether({ nights: ns }, now)).toBe(12);
    expect(daysTogether({ nights: [] }, now)).toBe(1);
  });
});
