// [ui5] Portrait frames: a cosmetic round the live owl portrait (src/assets/frames.ts), owned in the save, sold on
// Barnaby's frame wall and given by the Lucky Barrel's series.
import { describe, expect, it } from 'vitest';
import { DEFAULT_FRAME, FRAME_BY_ID, FRAMES, STARTER_FRAMES, STORE_FRAMES } from '../assets/frames.ts';
import { SERIES } from './series.ts';
import { applyPrize, buyFrame, exists, frameWall, nameOf } from './shop.ts';
import { freshSave, grant, migrateFrames, ownsEntry, save, setFrame, type Save } from './store.ts';

// edit() schedules a save write on `window`
(globalThis as unknown as { window: unknown }).window ??= globalThis;

describe('the frames', () => {
  it('has between 8 and 16 frames with unique ids, two starters and a sensible price on the rest', () => {
    expect(FRAMES.length).toBeGreaterThanOrEqual(8);
    expect(FRAMES.length).toBeLessThanOrEqual(16); // [profile] 14 since the honeycomb, driftwood and rose window frames
    expect(new Set(FRAMES.map((f) => f.id)).size).toBe(FRAMES.length);
    expect(STARTER_FRAMES).toContain(DEFAULT_FRAME);
    for (const f of FRAMES) {
      if (f.starter || f.series) expect(f.price).toBe(0);
      else expect(f.price).toBeGreaterThan(0);
      expect(f.name.length).toBeGreaterThan(3);
      expect(f.blurb.length).toBeGreaterThan(10);
    }
    expect(STORE_FRAMES.some((f) => f.cur === 'coins')).toBe(true);
    expect(STORE_FRAMES.some((f) => f.cur === 'gems')).toBe(true);
  });
});

describe('frames in the save', () => {
  it('starts with the starter frames and the default frame on', () => {
    const s = freshSave();
    expect(s.frame).toBe(DEFAULT_FRAME);
    for (const id of STARTER_FRAMES) expect(ownsEntry(s, { kind: 'frame', id })).toBe(true);
    expect(ownsEntry(s, { kind: 'frame', id: 'celestial' })).toBe(false);
  });

  it('migrates an old save without frames to the default frame', () => {
    const old = freshSave() as Partial<Save> & Save;
    delete (old as Partial<Save>).frame;
    delete (old.owned as Partial<Save['owned']>).frames;
    const s = migrateFrames(old);
    expect(s.frame).toBe(DEFAULT_FRAME);
    expect([...s.owned.frames].sort()).toEqual([...STARTER_FRAMES].sort());
  });

  it('puts the default frame back when the chosen one is unknown or not owned, and drops unknown frames', () => {
    const a = freshSave();
    a.frame = 'no_such_frame';
    expect(migrateFrames(a).frame).toBe(DEFAULT_FRAME);
    const b = freshSave();
    b.frame = 'celestial';
    expect(migrateFrames(b).frame).toBe(DEFAULT_FRAME);
    const c = freshSave();
    c.owned.frames = ['moss', 'ghost'];
    c.frame = 'moss';
    const m = migrateFrames(c);
    expect(m.frame).toBe('moss');
    expect(m.owned.frames).toContain('moss');
    expect(m.owned.frames).not.toContain('ghost');
    for (const id of STARTER_FRAMES) expect(m.owned.frames).toContain(id);
  });

  it('starts on the carved wooden frame, and moves an old save from the brass porthole to it once', () => {
    expect(DEFAULT_FRAME).toBe('walnut');
    expect(FRAME_BY_ID[DEFAULT_FRAME].starter).toBe(true);
    const old = freshSave();
    old.frame = 'porthole';
    delete old.frameV;
    const m = migrateFrames(old);
    expect(m.frame).toBe('walnut');
    expect(m.owned.frames).toContain('porthole');
    // a porthole chosen after the move stays on
    m.frame = 'porthole';
    expect(migrateFrames(m).frame).toBe('porthole');
  });

  it('grants a frame once', () => {
    const s = freshSave();
    grant(s, { kind: 'frame', id: 'knit' });
    grant(s, { kind: 'frame', id: 'knit' });
    expect(s.owned.frames.filter((id) => id === 'knit')).toHaveLength(1);
    grant(s, { kind: 'frame', id: 'nope' });
    expect(s.owned.frames).not.toContain('nope');
  });

  it('only lets you put on a frame you own', () => {
    save.value = freshSave();
    expect(setFrame('celestial')).toBe(false);
    expect(save.value.frame).toBe(DEFAULT_FRAME);
    expect(setFrame('porthole')).toBe(true);
    expect(save.value.frame).toBe('porthole');
  });
});

describe('the frame wall in the lodge store', () => {
  it('stocks every store frame, marks one down a day and keeps the same prices all day', () => {
    const s = freshSave();
    const a = frameWall(s, '2026-11-24'), b = frameWall(s, '2026-11-24');
    expect(a).toEqual(b);
    expect(a.map((o) => o.frame.id).sort()).toEqual(STORE_FRAMES.map((f) => f.id).sort());
    const sale = a.filter((o) => o.off > 0);
    expect(sale).toHaveLength(1);
    expect(sale[0].off).toBeGreaterThanOrEqual(25);
    expect(sale[0].off).toBeLessThanOrEqual(40);
    expect(sale[0].price).toBeLessThan(sale[0].base);
    for (const o of a) if (!o.off) expect(o.price).toBe(o.base);
    // across a month, the sale moves around
    const picks = new Set<string>();
    for (let d = 1; d <= 28; d++) picks.add(frameWall(s, `2026-02-${String(d).padStart(2, '0')}`).find((o) => o.off)!.frame.id);
    expect(picks.size).toBeGreaterThan(2);
  });

  it('never stocks series frames or starters, and locks frames above your level', () => {
    const wall = frameWall(freshSave(), '2026-11-24', 1);
    for (const o of wall) {
      expect(FRAME_BY_ID[o.frame.id].series).toBeUndefined();
      expect(FRAME_BY_ID[o.frame.id].starter).toBeUndefined();
      expect(o.locked).toBe((o.frame.level ?? 0) > 1 ? o.frame.level : 0);
      if (o.locked) expect(o.off).toBe(0);
    }
  });

  it('sells a frame: pays, grants, puts it on, and refuses a second time', () => {
    const s = freshSave();
    s.coins = 5000; s.gems = 1000;
    save.value = s;
    const o = frameWall(save.value, undefined, 99).find((x) => x.frame.id === 'moss')!;
    expect(buyFrame(o)).toBeNull();
    expect(save.value.coins).toBe(5000 - o.price);
    expect(ownsEntry(save.value, { kind: 'frame', id: 'moss' })).toBe(true);
    expect(save.value.frame).toBe('moss');
    expect(buyFrame(o)).toMatch(/already/i);
  });

  it('refuses when you are short or below its level', () => {
    const s = freshSave();
    s.coins = 10; s.gems = 0;
    save.value = s;
    const wall = frameWall(save.value, undefined, 1);
    expect(buyFrame(wall.find((x) => x.frame.id === 'knit')!)).toMatch(/acorns/);
    expect(buyFrame(wall.find((x) => x.frame.id === 'laurel')!)).toMatch(/moon gems/);
    expect(buyFrame(wall.find((x) => x.frame.id === 'celestial')!)).toMatch(/level/);
    expect(save.value.owned.frames.sort()).toEqual([...STARTER_FRAMES].sort());
  });
});

describe('frames in the Lucky Barrel series', () => {
  it('every frame in a pool exists, has a name and is series-only', () => {
    const inPools = SERIES.flatMap((s) => s.pool.filter((e) => e.kind === 'frame').map((e) => ({ e, s })));
    expect(inPools.length).toBeGreaterThanOrEqual(2);
    for (const { e, s } of inPools) {
      expect(exists('frame', e.id)).toBe(true);
      expect(nameOf('frame', e.id)).toBe(FRAME_BY_ID[e.id].name);
      expect(FRAME_BY_ID[e.id].series).toBe(s.id);
    }
  });

  it('a frame from a wish is granted, and a repeat turns into acorns', () => {
    const s = freshSave();
    const entry = SERIES[0].pool.find((e) => e.kind === 'frame')!;
    const r = { entry, stars: entry.stars, featured: false, pityAt: 1 } as Parameters<typeof applyPrize>[1];
    const a = applyPrize(s, r);
    expect(a.isNew).toBe(true);
    expect(ownsEntry(s, entry)).toBe(true);
    const before = s.coins;
    const b = applyPrize(s, r);
    expect(b.isNew).toBe(false);
    expect(s.coins).toBeGreaterThan(before);
  });
});
