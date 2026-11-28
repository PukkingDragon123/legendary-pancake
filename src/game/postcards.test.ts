// [postcard] A place's loot, its postcard and the bits of geography on the place card.
import { describe, expect, it } from 'vitest';
import { rollAdventure, souvenirChance } from './adventure.ts';
import { AREA, AREAS, lootTable, souvenirLoot } from './catalog.ts';
import { awardPostcard, distanceKm, flightHours, fmtHours, hasPostcard, placeLoot, postcardDate, souvenirNote, typicalLuck, tzDiffText, tzOffsetMinutes } from './postcards.ts';
import { PLACE_INFO } from './places.ts';
import { cleanPostcards, freshSave, ownsEntry } from './store.ts';
import type { SleepReport } from '../sleep/types.ts';

(globalThis as unknown as { window: unknown }).window ??= globalThis;
const report = (score: number, hours: number) => ({ score, asleep: hours * 3.6e6 }) as unknown as SleepReport;

describe('a place’s loot', () => {
  it('lists exactly what a night there can roll: its souvenirs, and its kin’s furniture, outfits and coats', () => {
    const s = freshSave();
    for (const a of AREAS) {
      const l = placeLoot(s, a.id);
      expect(l.souvenirs.map((e) => e.id).sort()).toEqual(souvenirLoot(a.id).map((e) => e.id).sort());
      const table = lootTable(a.id);
      expect([...l.wear, ...l.home].map((e) => `${e.kind}:${e.id}`).sort()).toEqual(table.map((e) => `${e.kind}:${e.id}`).sort());
      expect(l.home.every((e) => e.kind === 'item')).toBe(true);
      expect(l.wear.every((e) => e.kind === 'piece' || e.kind === 'palette')).toBe(true);
      expect(l.total).toBe(l.souvenirs.length + l.wear.length + l.home.length);
    }
  });
  it('marks what you own, and that outfits and coats you own will not come again (furniture and souvenirs can)', () => {
    const s = freshSave();
    const l0 = placeLoot(s, 'highlands');
    const piece = l0.wear.find((e) => e.kind === 'piece');
    const item = l0.home[0];
    const sv = l0.souvenirs[0];
    expect(piece && item && sv).toBeTruthy();
    s.owned.pieces.push(piece!.id);
    s.owned.items.push(item.id, sv.id);
    const l = placeLoot(s, 'highlands');
    const p2 = l.wear.find((e) => e.id === piece!.id)!, i2 = l.home.find((e) => e.id === item.id)!, s2 = l.souvenirs.find((e) => e.id === sv.id)!;
    expect(p2.owned && !p2.canDrop).toBe(true);
    expect(i2.owned && i2.canDrop).toBe(true);
    expect(s2.owned && s2.canDrop).toBe(true);
    for (const e of [...l.souvenirs, ...l.wear, ...l.home]) expect(e.owned).toBe(ownsEntry(s, e));
    expect(l.owned).toBe([...l.souvenirs, ...l.wear, ...l.home].filter((e) => e.owned).length);
  });
  it('sorts the rarest first', () => {
    const rank = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
    for (const a of AREAS) for (const g of Object.values(placeLoot(freshSave(), a.id)).filter(Array.isArray)) {
      for (let i = 1; i < g.length; i++) expect(rank[g[i].rarity as keyof typeof rank]).toBeGreaterThanOrEqual(rank[g[i - 1].rarity as keyof typeof rank]);
    }
  });
  it('quotes the same souvenir odds the night roll uses', () => {
    expect(souvenirChance(2, 2, 0.5)).toBe(1);
    expect(souvenirChance(1, 2, 0.5)).toBeCloseTo(0.625);
    expect(souvenirChance(0, 2, 0.5)).toBeCloseTo(0.17);
    expect(souvenirChance(0, 0, 0.5)).toBe(0);
    const s = freshSave();
    const l = placeLoot(s, 'paris', 0.7);
    expect(l.souvenirOdds).toBe(1);
    expect(souvenirNote(l)).toMatch(/certain/i);
    s.owned.items.push(...AREA.paris.souvenirs);
    const done = placeLoot(s, 'paris', 0.7);
    expect(done.souvenirOdds).toBeCloseTo(0.19);
    expect(souvenirNote(done)).toMatch(/all found/i);
    // what the card promises is what the roll does: a first night always brings one
    const r = rollAdventure({ area: 'paris', report: report(80, 7), seed: 9, owned: (e) => ownsEntry(freshSave(), e), plus: false, name: 'Pip', streak: 0 });
    expect(r.finds.some((f) => f.souvenir)).toBe(true);
  });
  it('guesses a typical night’s luck from the last week (a fair default for new sleepers)', () => {
    const s = freshSave();
    expect(typicalLuck(s)).toBeCloseTo(0.75 * 0.85);
    s.nights = [{ report: { score: 100 } }, { report: { score: 60 } }] as unknown as typeof s.nights;
    s.streak = 3;
    expect(typicalLuck(s)).toBeCloseTo(0.8 * 0.85 + 0.06);
  });
});

describe('postcards', () => {
  it('mails one on the first real night at a place, and only once', () => {
    const s = freshSave();
    expect(hasPostcard(s, 'kyoto')).toBe(false);
    expect(awardPostcard(s, 'kyoto', 1000, 7 * 3.6e6)).toBe('kyoto');
    expect(hasPostcard(s, 'kyoto')).toBe(true);
    expect(postcardDate(s, 'kyoto')).toBe(1000);
    expect(awardPostcard(s, 'kyoto', 2000, 7 * 3.6e6)).toBeNull();
    expect(postcardDate(s, 'kyoto')).toBe(1000);
  });
  it('needs an hour asleep and a real place; old area ids count as their place', () => {
    const s = freshSave();
    expect(awardPostcard(s, 'paris', 1, 20 * 60_000)).toBeNull();
    expect(awardPostcard(s, 'atlantis', 1, 8 * 3.6e6)).toBeNull();
    expect(awardPostcard(s, 'woods', 5, 8 * 3.6e6)).toBe('highlands');
    expect(Object.keys(s.postcards ?? {})).toEqual(['highlands']);
  });
  it('loads safely: junk is dropped, places already slept at get theirs', () => {
    expect(cleanPostcards(undefined)).toEqual({});
    expect(cleanPostcards('nope')).toEqual({});
    expect(cleanPostcards({ paris: 5, 'bad id!': 3, kyoto: 'x', venice: -1, rio: Infinity, __proto__x: 2 })).toEqual({ paris: 5 });
    expect(cleanPostcards({ paris: 5 }, { nights: { paris: { n: 2, first: 3, last: 9 }, iceland: { n: 1, first: 7, last: 7 }, nowhere: { n: 1 } } })).toEqual({ paris: 5, iceland: 7 });
    expect(cleanPostcards(null, { nights: 'broken' })).toEqual({});
  });
});

describe('the place card’s geography', () => {
  it('measures great-circle distances', () => {
    expect(distanceKm({ lat: 51.5, lon: -0.13 }, { lat: 48.86, lon: 2.35 })).toBeGreaterThan(330);
    expect(distanceKm({ lat: 51.5, lon: -0.13 }, { lat: 48.86, lon: 2.35 })).toBeLessThan(360);
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeCloseTo(Math.PI * 6371, 0);
    expect(distanceKm({ lat: 0, lon: 179 }, { lat: 0, lon: -179 })).toBeLessThan(250);
  });
  it('turns distances into a plane’s time', () => {
    expect(flightHours(10)).toBe(0);
    expect(fmtHours(flightHours(345))).toBe('55 min');
    expect(fmtHours(flightHours(9600))).toBe('12 h');
    expect(fmtHours(2.25)).toBe('2 h 15 min');
    expect(fmtHours(3)).toBe('3 h');
  });
  it('knows how far a place’s clock is from UTC and from yours', () => {
    const jan = Date.UTC(2026, 0, 15, 12), jul = Date.UTC(2026, 6, 15, 12);
    expect(tzOffsetMinutes('Asia/Tokyo', jan)).toBe(540);
    expect(tzOffsetMinutes('Asia/Kolkata', jan)).toBe(330);
    expect(tzOffsetMinutes('Europe/London', jan)).toBe(0);
    expect(tzOffsetMinutes('Europe/London', jul)).toBe(60);
    expect(tzOffsetMinutes('America/Phoenix', jul)).toBe(-420);
    expect(tzDiffText(0)).toBe('same time as you');
    expect(tzDiffText(480)).toBe('8 h ahead');
    expect(tzDiffText(-330)).toBe('5 h 30 min behind');
    expect(tzDiffText(45)).toBe('45 min ahead');
  });
  it('has a valid time zone and five facts for every place', () => {
    for (const a of AREAS) {
      expect(() => new Intl.DateTimeFormat('en', { timeZone: a.tz })).not.toThrow();
      expect(PLACE_INFO[a.id].facts.length, a.id).toBe(5);
      expect(new Set(PLACE_INFO[a.id].facts).size).toBe(5);
    }
  });
});
