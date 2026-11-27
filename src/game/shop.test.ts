import { describe, expect, it } from 'vitest';
import { ITEMS } from '../assets/registry.ts';
import { PIECE } from '../owl/outfits.ts';
import {
  applyBundle, applyPrize, BENCH_MADE, BENCH_OFF, BUNDLE_OFF, bundleOffer, BUNDLES, candidates, dailyDeals, dailyGift, DUPE_COINS, handmadeShelf, isoWeek, isSold,
  LODGE_ONLY, msToWeek, rollDay, weekKey, weeklyBundles,
} from './shop.ts';
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

describe('the handmade shelf', () => {
  it('stocks four lodge-only pieces and two bench-made ones, the same all week', () => {
    const a = handmadeShelf('2026-W48'), b = handmadeShelf('2026-W48');
    expect(a).toEqual(b);
    expect(a).toHaveLength(6);
    expect(new Set(a.map((o) => o.id)).size).toBe(6);
    expect(a.slice(0, 4).every((o) => o.lodgeOnly && LODGE_ONLY.includes(o.id))).toBe(true);
    expect(a.slice(4).every((o) => !o.lodgeOnly && BENCH_MADE.includes(o.id))).toBe(true);
    const weeks = new Set(Array.from({ length: 8 }, (_, w) => handmadeShelf(`2026-W${String(10 + w)}`).map((o) => o.id).join()));
    expect(weeks.size).toBeGreaterThan(1);
  });

  it('prices lodge-only pieces at the catalogue price and bench-made ones a little under it', () => {
    for (let w = 1; w <= 30; w++) for (const o of handmadeShelf(`2026-W${String(w).padStart(2, '0')}`)) {
      const def = ITEMS[o.id];
      expect(def, o.id).toBeTruthy();
      expect(def.series).toBeFalsy();
      expect(o.base).toBe(def.price);
      if (o.lodgeOnly) expect(o.price).toBe(def.price);
      else { expect(o.off).toBe(BENCH_OFF); expect(o.price).toBeLessThan(def.price); expect(o.price % 5).toBe(0); }
    }
  });

  it('sells lodge-only pieces nowhere else', () => {
    for (const id of LODGE_ONLY) expect(ITEMS[id]?.noStore, id).toBe(true);
    for (const id of BENCH_MADE) expect(ITEMS[id]?.noStore ?? false, id).toBe(false);
  });

  it('locks pieces above the player\'s level', () => {
    const all = Array.from({ length: 40 }, (_, w) => handmadeShelf(`2027-W${String(w + 1).padStart(2, '0')}`, 1)).flat();
    for (const o of all) expect(o.locked).toBe((ITEMS[o.id].level ?? 0) > 1 ? ITEMS[o.id].level : 0);
  });

  it('numbers weeks the ISO way', () => {
    expect(weekKey(new Date(2026, 10, 27).getTime())).toBe('2026-W48');
    expect(weekKey(new Date(2027, 0, 1).getTime())).toBe('2026-W53');
  });
});

describe('bundles', () => {
  it('are made of things that exist and are sold for acorns', () => {
    for (const b of BUNDLES) {
      expect(b.parts.length, b.id).toBeGreaterThanOrEqual(3);
      expect(b.parts.some((p) => p.kind === 'item'), b.id).toBe(true);
      for (const p of b.parts) {
        if (p.kind === 'item') { expect(ITEMS[p.id], p.id).toBeTruthy(); expect(ITEMS[p.id].series).toBeFalsy(); expect(ITEMS[p.id].gems ?? 0).toBe(0); expect(ITEMS[p.id].price).toBeGreaterThan(0); }
        else { expect(PIECE[p.id], p.id).toBeTruthy(); expect(PIECE[p.id].premium).toBeFalsy(); expect(PIECE[p.id].series).toBeFalsy(); expect(PIECE[p.id].price).toBeGreaterThan(0); }
      }
    }
  });

  it('offers two different bundles a week, a quarter off the parts', () => {
    const s = freshSave();
    const a = weeklyBundles(s, '2026-W48');
    expect(a).toHaveLength(2);
    expect(a[0].def.id).not.toBe(a[1].def.id);
    expect(weeklyBundles(s, '2026-W48')).toEqual(a);
    for (const o of a) {
      const sum = o.def.parts.reduce((n, p) => n + (p.kind === 'item' ? ITEMS[p.id].price : PIECE[p.id].price), 0);
      expect(o.base).toBe(sum);
      expect(Math.abs(o.price - sum * (1 - BUNDLE_OFF / 100))).toBeLessThanOrEqual(2.5);
      expect(o.price % 5).toBe(0);
    }
  });

  it('leaves out outfit pieces the player already has, and gives the rest', () => {
    const s = freshSave();
    const def = BUNDLES.find((b) => b.id === 'reading')!;
    const full = bundleOffer(s, def);
    s.owned.pieces.push('glasses');
    const less = bundleOffer(s, def);
    expect(less.base).toBe(full.base - PIECE.glasses.price);
    expect(less.price).toBeLessThan(full.price);
    s.coins = 10000;
    rollDay(s, '2026-11-27');
    applyBundle(s, less);
    expect(s.coins).toBe(10000 - less.price);
    for (const p of def.parts) if (p.kind === 'item') expect(s.inventory[p.id]).toBe(1);
    expect(s.owned.pieces.filter((x) => x === 'glasses')).toHaveLength(1);
    expect(isSold(s, less.key, s.shop.day)).toBe(true);
  });

  it('locks a bundle until the player reaches its highest part\'s level', () => {
    const def = BUNDLES.find((b) => b.id === 'stargazer')!;
    expect(bundleOffer(freshSave(), def, 0, 1).locked).toBe(ITEMS.telescope.level);
    expect(bundleOffer(freshSave(), def, 0, 9).locked).toBe(0);
  });
});
