import { describe, expect, it } from 'vitest';
import { BOX, boxesOn, checkFit, childrenOf, findSpot, kindOf, moveItem, openBox, putItem, seedHome, storeItem, unlockFloor } from './home.ts';
import { freshSave, type Save } from './store.ts';
import { floorCells } from '../world/house/plan.ts';

const fresh = (): Save => { const s = freshSave(); seedHome(s); return s; };

describe('home seeding', () => {
  it('gives a new player an empty living room full of moving boxes', () => {
    const s = fresh();
    expect(s.home.seeded).toBe(true);
    expect(s.home.unlocked).toEqual(['f1']);
    expect(s.home.floors.f1?.items.length).toBe(0);
    expect(boxesOn(s, 'f1').length).toBe(5);
    expect(s.furniture).toEqual({});
    // owned but unboxed pieces wait in storage
    expect(s.inventory.stool).toBe(1);
  });
  it('moves an old save’s slot furniture into the living room', () => {
    const s = freshSave();
    s.xp = 500;
    s.owned.items.push('bookshelf', 'cuckoo');
    s.furniture = { g_back: 'nestbed', g_mid: 'roundrug', g_right: 'bookshelf', w_back: 'cuckoo' };
    seedHome(s);
    const ids = s.home.floors.f1!.items.map((p) => p.id).sort();
    expect(ids).toEqual(['bookshelf', 'cuckoo', 'nestbed', 'roundrug']);
    expect(s.home.floors.f1!.items.find((p) => p.id === 'cuckoo')!.wall).toBeGreaterThan(0);
    for (const b of boxesOn(s, 'f1')) expect(b.id).not.toBe('f1_pip');
  });
});

describe('boxes', () => {
  it('unpacks furniture into fitting spots and pays out when the floor is clear', () => {
    const s = fresh();
    const coins = s.coins;
    let last = null;
    for (const id of [...s.home.boxes]) {
      const r = openBox(s, id)!;
      expect(r.placed.length).toBeGreaterThan(0);
      for (const p of r.placed) expect(checkFit(s, 'f1', p).ok).toBe(true);
      last = r;
    }
    expect(last!.lastOnFloor).toBe(true);
    expect(s.coins).toBe(coins + 60);
    // the candles from the night nook stand on the bedside table
    const r = s.home.floors.f1!;
    const candles = r.items.find((p) => p.id === 'candles')!, stand = r.items.find((p) => p.id === 'nightstand')!;
    expect(candles.on).toBe(stand.uid);
  });
});

describe('placement rules', () => {
  it('keeps things inside the room and off each other', () => {
    const s = fresh();
    s.home.boxes = [];
    const a = putItem(s, 'f1', { id: 'armchair', x: 0, z: 0, rot: 0 });
    expect(checkFit(s, 'f1', { uid: 'x', id: 'armchair', x: 1, z: 1, rot: 0 }).ok).toBe(false);
    expect(checkFit(s, 'f1', { uid: 'x', id: 'armchair', x: 2, z: 0, rot: 0 }).ok).toBe(true);
    expect(checkFit(s, 'f1', { uid: 'x', id: 'armchair', x: 8, z: 8, rot: 0 }).ok).toBe(false);
    // rugs lie under furniture but not under other rugs
    expect(checkFit(s, 'f1', { uid: 'r', id: 'roundrug', x: -1, z: -1, rot: 0 }).ok).toBe(true);
    putItem(s, 'f1', { id: 'roundrug', x: -1, z: -1, rot: 0 });
    expect(checkFit(s, 'f1', { uid: 'r2', id: 'rug', x: 0, z: 0, rot: 0 }).ok).toBe(false);
    void a;
  });
  it('stacks small things on surfaces and moves and stores them with their host', () => {
    const s = fresh();
    s.home.boxes = [];
    const stand = putItem(s, 'f1', { id: 'nightstand', x: 0, z: 0, rot: 0 });
    const f = checkFit(s, 'f1', { uid: 'c', id: 'candles', x: 0, z: 0, rot: 0 });
    expect(f.ok).toBe(true);
    expect(f.on).toBe(stand.uid);
    expect(f.base).toBe(10);
    putItem(s, 'f1', { id: 'candles', x: 0, z: 0, rot: 0, on: f.on });
    // a big thing can't go on top
    expect(checkFit(s, 'f1', { uid: 'a', id: 'armchair', x: 0, z: 0, rot: 0 }).ok).toBe(false);
    expect(moveItem(s, 'f1', stand.uid, { x: 3, z: -2, rot: 1 })).toBe(true);
    const c = s.home.floors.f1!.items.find((p) => p.id === 'candles')!;
    expect([c.x, c.z, c.on]).toEqual([3, -2, stand.uid]);
    storeItem(s, 'f1', stand.uid);
    expect(childrenOf(s.home.floors.f1!, stand.uid).length).toBe(0);
    expect(s.home.floors.f1!.items.length).toBe(0);
    expect(s.inventory.candles).toBeGreaterThanOrEqual(1);
    expect(s.inventory.nightstand).toBe(1);
  });
  it('hangs wall items only on real wall', () => {
    const s = fresh();
    expect(kindOf('painting').wall).toBe(true);
    expect(checkFit(s, 'f1', { uid: 'p', id: 'painting', x: 28, z: 0, rot: 0, wall: 30 }).ok).toBe(true);
    // the front of the trunk is cut away
    expect(checkFit(s, 'f1', { uid: 'p', id: 'painting', x: 0, z: 0, rot: 0, wall: 30 }).ok).toBe(false);
    const p = findSpot(s, 'f1', 'cuckoo');
    expect(p).not.toBeNull();
  });
  it('unlocks floors in order with level and acorns', () => {
    const s = fresh();
    s.coins = 5000;
    expect(unlockFloor(s, 'f3', 9)).toBe(false);
    expect(unlockFloor(s, 'f2', 2)).toBe(false);
    expect(unlockFloor(s, 'f2', 3)).toBe(true);
    expect(s.home.unlocked).toContain('f2');
    expect(boxesOn(s, 'f2').length).toBe(2);
    expect(floorCells('f2').size).toBeGreaterThan(150);
    expect(BOX.f2_bedroom.floor).toBe('f2');
  });
});
