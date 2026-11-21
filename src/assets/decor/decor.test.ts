import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { assemble } from '../../gfx/box.ts';
import { DECOR_FINISHES, DECOR_ITEMS } from '../decor.ts';
import { SEASONAL_FINISHES, SEASONAL_ITEMS } from '../seasonal.ts';
import { ALL_ITEMS, FINISHES } from '../registry.ts';
import { SERIES } from '../../game/series.ts';
import type { ItemCat } from '../furniture.ts';

const NEW_ITEMS = [...DECOR_ITEMS, ...SEASONAL_ITEMS];
const NEW_FINISHES = [...DECOR_FINISHES, ...SEASONAL_FINISHES];
const STAR_RARITY = { 3: 'rare', 4: 'epic', 5: 'legendary' } as const;

describe('decor content', () => {
  it('has enough items and finishes, with unique ids across the whole registry', () => {
    expect(DECOR_ITEMS.length).toBeGreaterThanOrEqual(45);
    expect(DECOR_FINISHES.filter((f) => f.kind === 'wallpaper').length).toBeGreaterThanOrEqual(12);
    expect(DECOR_FINISHES.filter((f) => f.kind === 'flooring').length).toBeGreaterThanOrEqual(10);
    const ids = ALL_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const fids = FINISHES.map((f) => f.id);
    expect(new Set(fids).size).toBe(fids.length);
  });

  it('covers every build category', () => {
    const cats: ItemCat[] = ['beds', 'seating', 'tables', 'storage', 'lights', 'decor', 'plants', 'rugs', 'wall', 'fun'];
    for (const c of cats) expect(DECOR_ITEMS.some((i) => i.cat === c), c).toBe(true);
  });

  it('implements every series id with the right rarity, flagged as prizes', () => {
    for (const s of SERIES) for (const e of s.pool) {
      if (e.kind === 'item') {
        const it = SEASONAL_ITEMS.find((i) => i.id === e.id);
        expect(it, e.id).toBeTruthy();
        expect(it!.series).toBe(s.id);
        expect(it!.noStore).toBe(true);
        expect(it!.rarity).toBe(STAR_RARITY[e.stars]);
      }
      if (e.kind === 'finish') {
        const f = SEASONAL_FINISHES.find((x) => x.id === e.id);
        expect(f, e.id).toBeTruthy();
        expect(f!.series).toBe(s.id);
        expect(f!.noStore).toBe(true);
        expect(f!.rarity).toBe(STAR_RARITY[e.stars]);
      }
    }
  });

  it('gives every store item a price, blurb, rarity and size', () => {
    for (const d of NEW_ITEMS) {
      expect(d.blurb.length, d.id).toBeGreaterThan(10);
      expect(d.rarity, d.id).toBeTruthy();
      expect(d.size, d.id).toBeTruthy();
      if (!d.noStore) expect(d.price > 0 || (d.gems ?? 0) > 0, d.id).toBe(true);
    }
    for (const f of NEW_FINISHES) {
      expect(f.swatch.length).toBe(3);
      if (!f.noStore) expect(f.price > 0 || (f.gems ?? 0) > 0, f.id).toBe(true);
    }
  });

  it('builds every model with finite boxes that fit its footprint', () => {
    for (const d of NEW_ITEMS) {
      const boxes = d.build();
      expect(boxes.length, d.id).toBeGreaterThan(0);
      for (const b of boxes) for (const n of [...b.at, ...b.size]) expect(Number.isFinite(n), d.id).toBe(true);
      const asm = assemble([{ boxes }]);
      const w = (asm.max.x - asm.min.x) * 16, dz = (asm.max.z - asm.min.z) * 16, top = asm.max.y * 16;
      asm.geos.forEach((g) => g.dispose()); asm.tex.dispose();
      if (!d.wall) {
        expect(w, d.id + ' width').toBeLessThanOrEqual(d.size![0] * 16 + 6);
        expect(dz, d.id + ' depth').toBeLessThanOrEqual(d.size![1] * 16 + 6);
      }
      if (d.rug) expect(top, d.id + ' rug height').toBeLessThanOrEqual(2.2);
      if (d.surface !== undefined) expect(d.surface, d.id + ' surface').toBeLessThanOrEqual(top + 0.5);
    }
  });

  it('runs moving parts without errors', () => {
    for (const d of NEW_ITEMS.filter((i) => i.parts)) {
      const o = new THREE.Object3D();
      for (const c of d.parts!()) o.add(c);
      expect(o.children.length, d.id).toBeGreaterThan(0);
      for (let k = 0; k < 4; k++) d.animate?.(o, k * 0.7, 1 / 60);
      o.traverse((c) => { expect(Number.isFinite(c.position.x + c.position.y + c.position.z + c.rotation.y), d.id).toBe(true); });
    }
  });

  it('paints finishes with valid colours', () => {
    for (const f of NEW_FINISHES) for (let v = 0; v < 64; v += 3) for (let u = 0; u < 96; u += 5) {
      const c = f.paint(u + 0.5, v + 0.5);
      expect(Number.isInteger(c) && c >= 0 && c <= 0xffffff, f.id).toBe(true);
    }
  });
});
