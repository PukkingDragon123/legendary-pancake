import { describe, expect, it } from 'vitest';
import { applyPrize, candidates, dailyDeals, dailyGift, DUPE_COINS, isoWeek, msToWeek, rollDay } from './shop.ts';
import { FROSTLIGHT } from './series.ts';
import { freshSave, ownsEntry } from './store.ts';

describe('daily deals', () => {
  it('rolls three deals per day, stable for the day and different across days', () => {
    const s = freshSave();
    const a = dailyDeals(s, '2026-11-21'), b = dailyDeals(s, '2026-11-21'), c = dailyDeals(s, '2026-11-22');
    expect(a).toHaveLength(3);
    expect(a).toEqual(b);
    expect(a.map((d) => d.key)).not.toEqual(c.map((d) => d.key));
    expect(new Set(a.map((d) => d.key)).size).toBe(3);
  });

  it('discounts 20 to 50 percent and only offers things sold normally', () => {
    const s = freshSave();
    const { pieces, items, species } = candidates();
    const ok = new Set([...pieces, ...items, ...species].map((c) => c.kind + ':' + c.id));
    for (let d = 1; d <= 28; d++) {
      for (const deal of dailyDeals(s, `2026-02-${String(d).padStart(2, '0')}`)) {
        expect(deal.off).toBeGreaterThanOrEqual(20);
        expect(deal.off).toBeLessThanOrEqual(50);
        expect(deal.price).toBeLessThan(deal.base);
        expect(ok.has(deal.kind + ':' + deal.id)).toBe(true);
        expect(ownsEntry(s, deal)).toBe(false);
      }
    }
  });

  it('keeps a deal bought today on the stand (as SOLD) instead of rolling a new one', () => {
    const s = freshSave();
    rollDay(s, '2026-11-21');
    const before = dailyDeals(s, '2026-11-21');
    const d = before[0];
    if (d.kind === 'piece') s.owned.pieces.push(d.id); else if (d.kind === 'item') s.owned.items.push(d.id); else s.owned.species.push(d.id);
    s.shop.bought.push(d.key);
    expect(dailyDeals(s, '2026-11-21')[0].key).toBe(d.key);
  });

  it('has a gift every day', () => {
    for (let d = 1; d < 10; d++) { const g = dailyGift(`2026-12-0${d}`); expect((g.coins ?? 0) + (g.gems ?? 0)).toBeGreaterThan(0); }
  });
});

describe('weeks', () => {
  it('numbers ISO weeks and counts down to Monday', () => {
    expect(isoWeek(new Date(2026, 0, 1).getTime())).toBe(1);
    expect(isoWeek(new Date(2026, 10, 21).getTime())).toBe(47);
    const sat = new Date(2026, 10, 21, 12).getTime();
    expect(Math.round(msToWeek(sat) / 3.6e6)).toBe(36);
  });
});

describe('prizes', () => {
  it('turns duplicate cosmetics into acorns but stacks furniture', () => {
    const s = freshSave();
    const piece = FROSTLIGHT.pool.find((e) => e.kind === 'piece')!;
    const item = FROSTLIGHT.pool.find((e) => e.kind === 'item')!;
    const r = (entry: typeof piece) => ({ entry, stars: entry.stars, featured: !!entry.featured, pityAt: 1 });
    const c0 = s.coins;
    expect(applyPrize(s, r(piece)).isNew).toBe(true);
    const again = applyPrize(s, r(piece));
    expect(again.isNew).toBe(false);
    expect(again.dupe).toBe(DUPE_COINS[piece.stars]);
    expect(s.coins).toBe(c0 + DUPE_COINS[piece.stars]);
    applyPrize(s, r(item)); applyPrize(s, r(item));
    expect(s.inventory[item.id]).toBe(2);
  });
});
