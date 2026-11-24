// [globe] The twenty places, their souvenirs and the night's roll.
import { describe, expect, it } from 'vitest';
import { SOUVENIR_INFO, SOUVENIRS } from '../assets/souvenirs.ts';
import { rollAdventure } from './adventure.ts';
import { AREA, AREA_ALIAS, AREAS, ITEM_BY_ID, lootTable, placeId, SOUVENIR_PLACE, souvenirLoot } from './catalog.ts';
import type { SleepReport } from '../sleep/types.ts';

const report = (score: number, hours: number) => ({ score, asleep: hours * 3.6e6 }) as unknown as SleepReport;

describe('places', () => {
  it('has twenty real places on every continent', () => {
    expect(AREAS).toHaveLength(20);
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(20);
    expect(new Set(AREAS.map((a) => a.continent)).size).toBe(7);
    for (const a of AREAS) {
      expect(Math.abs(a.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(a.lon)).toBeLessThanOrEqual(180);
      expect(a.x).toBeGreaterThanOrEqual(0); expect(a.x).toBeLessThanOrEqual(1);
      expect(a.sights.length && a.friends.length && a.deeds.length).toBeTruthy();
    }
  });
  it('opens gradually: three at the start, sorted by level', () => {
    expect(AREAS.filter((a) => a.level <= 1 && !a.streak)).toHaveLength(3);
    for (let i = 1; i < AREAS.length; i++) expect(AREAS[i].level).toBeGreaterThanOrEqual(AREAS[i - 1].level);
  });
  it('maps the old area ids to places', () => {
    for (const [old, id] of Object.entries(AREA_ALIAS)) { expect(AREA[old].id).toBe(id); expect(placeId(old)).toBe(id); }
    expect(placeId('kyoto')).toBe('kyoto');
  });
  it('gives every place one or two souvenirs that exist and are not sold', () => {
    for (const a of AREAS) {
      expect(a.souvenirs.length).toBeGreaterThanOrEqual(1);
      expect(a.souvenirs.length).toBeLessThanOrEqual(2);
      for (const id of a.souvenirs) {
        expect(ITEM_BY_ID[id]?.noStore).toBe(true);
        expect(ITEM_BY_ID[id]?.series).toBeUndefined();
        expect(SOUVENIR_INFO[id].place).toBe(a.id);
        expect(SOUVENIR_PLACE[id]).toBe(a.id);
      }
    }
    expect(SOUVENIRS.length).toBe(Object.keys(SOUVENIR_PLACE).length);
  });
  it('keeps souvenirs out of the ordinary loot and gives every place some', () => {
    for (const a of AREAS) {
      const t = lootTable(a.id);
      expect(t.length).toBeGreaterThan(2);
      expect(t.some((e) => SOUVENIR_PLACE[e.id])).toBe(false);
      expect(souvenirLoot(a.id).every((e) => e.souvenir)).toBe(true);
    }
  });
});

describe('a night at a place', () => {
  const base = { owned: () => false, plus: false, name: 'Pip', streak: 0 };
  it('always brings a souvenir on the first trip', () => {
    for (const a of AREAS) {
      const r = rollAdventure({ ...base, area: a.id, report: report(80, 7.5), seed: 42 });
      expect(r.area).toBe(a.id);
      const sv = r.finds.filter((f) => f.souvenir);
      expect(sv).toHaveLength(1);
      expect(a.souvenirs).toContain(sv[0].id);
      expect(r.finds.length).toBeGreaterThan(1);
      expect(r.story.join(' ')).toContain(ITEM_BY_ID[sv[0].id].name);
    }
  });
  it('rolls old area ids as their new place', () => {
    const r = rollAdventure({ ...base, area: 'woods', report: report(70, 6), seed: 7 });
    expect(r.area).toBe('highlands');
  });
  it('brings nothing from a trip under an hour', () => {
    const r = rollAdventure({ ...base, area: 'paris', report: report(30, 0.5), seed: 3 });
    expect(r.finds).toHaveLength(0);
  });
});
