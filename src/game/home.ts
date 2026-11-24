// Pip's home as data: which floors are open, what stands where in each room, the moving boxes still
// waiting to be unpacked, and every rule of the build grid (footprints, stacking, rugs, wall items).
// Pure functions take a Save and mutate it (call them inside `edit`); the `do*` actions wrap them
// with edit(), prices and quest progress for the UI.
import { ITEMS, FINISH } from '../assets/registry.ts';
import type { ItemDef } from '../assets/furniture.ts';
import type { BoxSpec } from '../gfx/box.ts';
import {
  CELL, cellKey, FLOOR_IDS, floorCells, GN, R_IN, ROOM_H, slotOf, UNLOCK, WALL_SLOTS, wallSlotFree, type FloorId,
} from '../world/house/plan.ts';
import { progress } from './quests.ts';
import { edit, level, save, type Placed, type RoomState, type Save } from './store.ts';

export type { FloorId, Placed, RoomState };

// ------------------------------------------------------------------ item metrics

export interface ItemKind {
  id: string;
  /** footprint in cells before rotation (wall items: w = slots along the wall) */
  w: number; d: number;
  /** model bounds in px */
  minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number;
  wall: boolean; rug: boolean; small: boolean;
  /** px above the item's base where small things can stand */
  surface?: number;
}

const RAD = Math.PI / 180;
/** Bounds of a box model in px, honouring box rotations. */
export function boundsOf(boxes: BoxSpec[]) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    const [ax, ay, az] = b.at, [sx, sy, sz] = b.size;
    const p = b.pivot ?? [ax + sx / 2, ay + sy / 2, az + sz / 2];
    const r = b.rot ?? [0, 0, 0];
    const cx = Math.cos(r[0] * RAD), snx = Math.sin(r[0] * RAD), cy = Math.cos(r[1] * RAD), sny = Math.sin(r[1] * RAD), cz = Math.cos(r[2] * RAD), snz = Math.sin(r[2] * RAD);
    for (let k = 0; k < 8; k++) {
      let x = ax + (k & 1 ? sx : 0) - p[0], y = ay + (k & 2 ? sy : 0) - p[1], z = az + (k & 4 ? sz : 0) - p[2];
      // ZYX euler: x first, then y, then z
      if (r[0] || r[1] || r[2]) {
        let t = y * cx - z * snx; z = y * snx + z * cx; y = t;
        t = x * cy + z * sny; z = -x * sny + z * cy; x = t;
        t = x * cz - y * snz; y = x * snz + y * cz; x = t;
      }
      x += p[0]; y += p[1]; z += p[2];
      mn[0] = Math.min(mn[0], x); mn[1] = Math.min(mn[1], y); mn[2] = Math.min(mn[2], z);
      mx[0] = Math.max(mx[0], x); mx[1] = Math.max(mx[1], y); mx[2] = Math.max(mx[2], z);
    }
  }
  if (!boxes.length) return { minX: -4, maxX: 4, minY: 0, maxY: 8, minZ: -4, maxZ: 4 };
  return { minX: mn[0], maxX: mx[0], minY: mn[1], maxY: mx[1], minZ: mn[2], maxZ: mx[2] };
}

const kinds = new Map<string, ItemKind>();
export type Bounds = ReturnType<typeof boundsOf>;
/** bounds of the hand-made GLB models (px, model space), registered by the renderer as they load */
const modelBounds = new Map<string, Bounds>();
/**
 * The renderer measured an item's GLB model (px, model space): from now on its build-grid metrics (centring on
 * the footprint, wall heights, the height things stack at) follow the model. Returns true if anything changed.
 */
export function setModelBounds(id: string, b: Bounds): boolean {
  const old = modelBounds.get(id);
  if (old && (['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ'] as const).every((k) => Math.abs(old[k] - b[k]) < 0.05)) return false;
  modelBounds.set(id, b);
  kinds.delete(id);
  return true;
}
const FUN_CATS = new Set(['lights', 'plants', 'decor', 'fun', 'play', 'seasonal', 'tables', 'storage']);
/** Build-grid metrics for an item, from its ItemDef fields or, where missing, its model bounds. */
export function kindOf(id: string): ItemKind {
  let k = kinds.get(id);
  if (k) return k;
  const def: ItemDef | undefined = ITEMS[id];
  const fb = def ? boundsOf(def.build()) : boundsOf([]);
  const b = modelBounds.get(id) ?? fb;
  // the footprint always comes from the box model (or `size`), so saves stay valid when a GLB arrives
  const pw = fb.maxX - fb.minX, pd = fb.maxZ - fb.minZ, h = b.maxY;
  const wall = def ? def.wall ?? def.cat === 'wall' : false;
  const cells = (px: number) => Math.max(1, Math.round((px - 0.5) / CELL));
  // `size` is in blocks (16 px) like the content packs use; the build grid is CELL px
  const fromBlocks = (b: number) => Math.max(1, Math.round((b * 16) / CELL));
  const w = def?.size ? fromBlocks(def.size[0]) : cells(pw), d = wall ? 1 : def?.size ? fromBlocks(def.size[1]) : cells(pd);
  const rug = !wall && (def ? def.rug ?? (def.cat === 'rugs' || (!!def.flatItem && h <= 2.5)) : false);
  const small = !wall && !rug && (def ? def.small ?? (w * d <= 1 && h <= 20 && FUN_CATS.has(def.cat) && def.surface === undefined && def.cat !== 'tables') : false);
  // surface: 0 marks a cluttered top (a tea set, a desk) that nothing can stand on
  const surface = def?.surface !== undefined ? (def.surface > 0 ? def.surface : undefined) : def && def.cat === 'tables' && !small && !rug ? Math.round(h) : undefined;
  k = { id, w, d, ...b, wall, rug, small, surface };
  kinds.set(id, k);
  return k;
}

/** Footprint size after a quarter-turn rotation. */
export const rotSize = (k: ItemKind, rot: number): [number, number] => (rot % 2 ? [k.d, k.w] : [k.w, k.d]);
export interface Rect { x: number; z: number; w: number; d: number }
export function rectOf(p: Placed): Rect { const k = kindOf(p.id); const [w, d] = rotSize(k, p.rot); return { x: p.x, z: p.z, w, d }; }
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.z >= b.z && a.x + a.w <= b.x + b.w && a.z + a.d <= b.z + b.d;
/** wall items: slot range (wrapping) and height range */
const wallSpan = (p: Placed) => { const k = kindOf(p.id); return { s: p.x, w: k.w, v0: (p.wall ?? 0) + k.minY, v1: (p.wall ?? 0) + k.maxY }; };
const slotsOverlap = (a: number, aw: number, b: number, bw: number) => {
  for (let i = 0; i < aw; i++) for (let j = 0; j < bw; j++) if ((((a + i) % WALL_SLOTS) + WALL_SLOTS) % WALL_SLOTS === (((b + j) % WALL_SLOTS) + WALL_SLOTS) % WALL_SLOTS) return true;
  return false;
};
/** Default mounting height for a wall item: centred around eye level, clear of floor and ceiling. */
export function defaultWallY(id: string): number {
  const k = kindOf(id);
  const want = 36 - (k.minY + k.maxY) / 2;
  return Math.round(Math.max(6 - k.minY, Math.min(ROOM_H - 4 - k.maxY, want)));
}

// ------------------------------------------------------------------ moving boxes

export interface BoxDef { id: string; floor: FloorId; x: number; z: number; rot: number; label: string; tint: string; items: string[] }
/** The goldfish bowl if the content pack has one, else a fern in a pot. */
export const fishbowlId = () => ['fishbowl', 'goldfish_bowl', 'goldfishbowl', 'fish_bowl', 'goldfish', 'fishtank'].find((id) => ITEMS[id]) ?? 'fernpot';
export const BOXES: BoxDef[] = [
  { id: 'f1_pip', floor: 'f1', x: -1, z: -5, rot: 0, label: "PIP'S STUFF", tint: '#c99a5e', items: ['nestbed', 'roundrug'] },
  { id: 'f1_fragile', floor: 'f1', x: -6, z: -2, rot: 1, label: 'FRAGILE', tint: '#c49058', items: ['moonlamp', '@fishbowl'] },
  { id: 'f1_cozy', floor: 'f1', x: 3, z: -3, rot: 3, label: 'COZY', tint: '#d2a468', items: ['armchair', 'cushion'] },
  { id: 'f1_books', floor: 'f1', x: -4, z: 3, rot: 0, label: 'BOOKS', tint: '#bf8e56', items: ['bookshelf', 'books'] },
  { id: 'f1_nook', floor: 'f1', x: 2, z: 3, rot: 2, label: 'NIGHT NOOK', tint: '#cfa062', items: ['nightstand', 'candles'] },
  { id: 'f2_bedroom', floor: 'f2', x: -1, z: -4, rot: 0, label: 'BEDROOM', tint: '#c99a5e', items: ['wardrobe', 'mushlamp'] },
  { id: 'f2_linen', floor: 'f2', x: 2, z: 1, rot: 1, label: 'SOFT THINGS', tint: '#d2a468', items: ['toybox', 'painting'] },
  { id: 'f3_stars', floor: 'f3', x: -1, z: -3, rot: 0, label: 'STARGAZING', tint: '#c49058', items: ['telescope', 'starmap'] },
  { id: 'f3_maps', floor: 'f3', x: 3, z: 1, rot: 2, label: 'MAPS', tint: '#cfa062', items: ['globe', 'record'] },
];
export const BOX: Record<string, BoxDef> = Object.fromEntries(BOXES.map((b) => [b.id, b]));
export const boxItems = (b: BoxDef) => b.items.map((i) => (i === '@fishbowl' ? fishbowlId() : i)).filter((i) => ITEMS[i]);
export const boxRect = (b: BoxDef): Rect => ({ x: b.x, z: b.z, w: 2, d: 2 });
export const boxesOn = (s: Save, fid: FloorId) => s.home.boxes.map((id) => BOX[id]).filter((b) => b && b.floor === fid);

/** Where each starter piece likes to land: [x, z, rot] (wall items: [slot, height, 0]). */
const SPOTS: Record<string, [number, number, number]> = {
  nestbed: [-2, -8, 0], roundrug: [-2, -2, 0], moonlamp: [3, -6, 0], fishbowl: [-6, 1, 1], goldfish_bowl: [-6, 1, 1], fernpot: [-6, 1, 1],
  armchair: [4, -3, 3], cushion: [-3, 2, 0], bookshelf: [-8, -3, 1], books: [-7, -5, 0], nightstand: [2, -7, 0], candles: [2, -7, 0],
  wardrobe: [-2, -8, 0], mushlamp: [3, -6, 0], toybox: [4, 0, 3], painting: [-1, 0, 0],
  telescope: [0, -5, 0], starmap: [-1, 0, 0], globe: [4, 1, 3], record: [-5, -1, 1],
};

// ------------------------------------------------------------------ rooms

export const room = (s: Save, fid: FloorId): RoomState | undefined => s.home.floors[fid];
export const isOpen = (s: Save, fid: FloorId) => s.home.unlocked.includes(fid);
const blankRoom = (): RoomState => ({ wall: 'wall_heartwood', floor: 'floor_planks', items: [] });
let uidN = 0;
export const newUid = (id: string) => `${id}-${Date.now().toString(36)}${(uidN++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

export interface Fit { ok: boolean; reason?: string; on?: string; /** px above the floor the item's base rests at */ base: number }

/** Can `cand` stand in this room? `ignore` lists uids that are moving with it. */
export function checkFit(s: Save, fid: FloorId, cand: Placed, ignore: Set<string> = new Set()): Fit {
  const r = room(s, fid);
  if (!r || !isOpen(s, fid)) return { ok: false, reason: 'This floor is still boarded up', base: 0 };
  const k = kindOf(cand.id);
  const others = r.items.filter((p) => p.uid !== cand.uid && !ignore.has(p.uid));
  if (k.wall) {
    const sp = { s: cand.x, w: k.w, v0: (cand.wall ?? 0) + k.minY, v1: (cand.wall ?? 0) + k.maxY };
    for (let i = 0; i < sp.w; i++) if (!wallSlotFree(fid, sp.s + i, sp.v0, sp.v1)) return { ok: false, reason: 'Needs a clear bit of wall', base: cand.wall ?? 0 };
    for (const o of others) {
      if (!kindOf(o.id).wall) continue;
      const os = wallSpan(o);
      if (slotsOverlap(sp.s, sp.w, os.s, os.w) && sp.v1 > os.v0 && sp.v0 < os.v1) return { ok: false, reason: 'Something already hangs there', base: cand.wall ?? 0 };
    }
    return { ok: true, base: cand.wall ?? 0 };
  }
  const rc = rectOf(cand);
  const cells = floorCells(fid);
  for (let x = rc.x; x < rc.x + rc.w; x++) for (let z = rc.z; z < rc.z + rc.d; z++) if (!cells.has(cellKey(x, z))) return { ok: false, reason: 'Doesn’t fit there', base: 0 };
  for (const b of boxesOn(s, fid)) if (overlap(rc, boxRect(b))) return { ok: false, reason: 'A moving box is in the way', base: 0 };
  if (k.rug) {
    for (const o of others) if (kindOf(o.id).rug && overlap(rc, rectOf(o))) return { ok: false, reason: 'Rugs can’t overlap', base: 0 };
    return { ok: true, base: 0 };
  }
  // small things stand on a surface when they fit on one
  if (k.small) {
    const host = others.find((o) => { const ok = kindOf(o.id); return !o.on && ok.surface !== undefined && !ok.rug && !ok.wall && inside(rc, rectOf(o)); });
    if (host) {
      for (const o of others) if (o.on === host.uid && overlap(rc, rectOf(o))) return { ok: false, reason: 'That spot on the top is taken', base: 0 };
      return { ok: true, on: host.uid, base: kindOf(host.id).surface! };
    }
  }
  for (const o of others) {
    const ok = kindOf(o.id);
    if (ok.rug || ok.wall || o.on) continue;
    if (overlap(rc, rectOf(o))) return { ok: false, reason: k.small && ok.surface === undefined ? 'Can’t stack on that' : 'Something is in the way', base: 0 };
  }
  return { ok: true, base: 0 };
}

/** Children standing on an item. */
export const childrenOf = (r: RoomState, uid: string) => r.items.filter((p) => p.on === uid);

/** Nearest free spot for an item around a preferred cell (spiral search, all rotations). */
export function findSpot(s: Save, fid: FloorId, id: string, pref?: [number, number, number], allowStack = true): Placed | null {
  const k = kindOf(id);
  const uid = '__probe';
  if (k.wall) {
    const start = pref ? pref[0] : 28, h = pref && pref[1] ? pref[1] : defaultWallY(id);
    for (let i = 0; i < WALL_SLOTS; i++) {
      for (const sgn of [1, -1]) {
        const sl = start + sgn * i;
        for (const dh of [0, 8, -8, 16, -16]) {
          const p: Placed = { uid, id, x: sl, z: 0, rot: 0, wall: h + dh };
          if (checkFit(s, fid, p).ok) return p;
        }
      }
    }
    return null;
  }
  const [px, pz, pr] = pref ?? [-1, -1, 0];
  for (let ring = 0; ring < GN * 2 + 2; ring++) {
    for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
      for (const rot of [pr, (pr + 1) % 4, (pr + 2) % 4, (pr + 3) % 4]) {
        const p: Placed = { uid, id, x: px + dx, z: pz + dz, rot };
        const f = checkFit(s, fid, p);
        if (f.ok && (allowStack || !f.on)) { if (f.on) p.on = f.on; return p; }
      }
    }
  }
  return null;
}

/** Put a new item in a room (no checks: the caller has found a fitting spot). */
export function putItem(s: Save, fid: FloorId, p: Omit<Placed, 'uid'> & { uid?: string }): Placed {
  const r = s.home.floors[fid] ?? (s.home.floors[fid] = blankRoom());
  const placed: Placed = { ...p, uid: p.uid && p.uid !== '__probe' ? p.uid : newUid(p.id) };
  if (!placed.on) delete placed.on;
  if (placed.wall === undefined) delete placed.wall;
  r.items.push(placed);
  return placed;
}

/** Recompute which surface each small item stands on (after moves). */
function restack(s: Save, fid: FloorId) {
  const r = room(s, fid);
  if (!r) return;
  for (const p of r.items) {
    const k = kindOf(p.id);
    if (!k.small) continue;
    const f = checkFit(s, fid, p, new Set([p.uid]));
    if (f.on) p.on = f.on; else delete p.on;
  }
}

/** Move an item (and whatever stands on it) to a new spot. Returns false if it doesn't fit. */
export function moveItem(s: Save, fid: FloorId, uid: string, to: { x: number; z: number; rot: number; wall?: number }): boolean {
  const r = room(s, fid);
  const p = r?.items.find((i) => i.uid === uid);
  if (!r || !p) return false;
  const kids = childrenOf(r, uid);
  const cand: Placed = { ...p, ...to };
  const fit = checkFit(s, fid, cand, new Set(kids.map((c) => c.uid)));
  if (!fit.ok) return false;
  // children keep their place on the top, turning with their host
  const old = rectOf(p), nw = rectOf(cand);
  const turns = (((to.rot - p.rot) % 4) + 4) % 4;
  for (const c of kids) {
    const cr = rectOf(c);
    // offset of the child's centre from its host's centre, turned with the host (+z -> +x per turn)
    let ox = cr.x + cr.w / 2 - (old.x + old.w / 2), oz = cr.z + cr.d / 2 - (old.z + old.d / 2);
    for (let i = 0; i < turns; i++) { const t = ox; ox = oz; oz = -t; }
    c.rot = (c.rot + turns) % 4;
    const [cw, cd] = rotSize(kindOf(c.id), c.rot);
    c.x = Math.max(nw.x, Math.min(nw.x + nw.w - cw, Math.round(nw.x + nw.w / 2 + ox - cw / 2)));
    c.z = Math.max(nw.z, Math.min(nw.z + nw.d - cd, Math.round(nw.z + nw.d / 2 + oz - cd / 2)));
  }
  Object.assign(p, to);
  if (fit.on) p.on = fit.on; else delete p.on;
  restack(s, fid);
  return true;
}

/** Put an item (and anything on it) into storage. */
export function storeItem(s: Save, fid: FloorId, uid: string): string[] {
  const r = room(s, fid);
  if (!r) return [];
  const gone = new Set([uid, ...childrenOf(r, uid).map((c) => c.uid)]);
  const ids: string[] = [];
  r.items = r.items.filter((p) => { if (!gone.has(p.uid)) return true; ids.push(p.id); s.inventory[p.id] = (s.inventory[p.id] ?? 0) + 1; return false; });
  return ids;
}

/** Take one from storage and place it. */
export function placeFromInventory(s: Save, fid: FloorId, p: Omit<Placed, 'uid'>): Placed | null {
  if ((s.inventory[p.id] ?? 0) <= 0) return null;
  s.inventory[p.id]--;
  if (s.inventory[p.id] <= 0) delete s.inventory[p.id];
  return putItem(s, fid, p);
}

export function priceOfItem(id: string): { coins: number; gems: number } {
  const d = ITEMS[id];
  return d?.gems ? { coins: 0, gems: d.gems } : { coins: d?.price ?? 0, gems: 0 };
}
export function canAfford(s: Save, pr: { coins: number; gems: number }) { return s.coins >= pr.coins && s.gems >= pr.gems; }
export function pay(s: Save, pr: { coins: number; gems: number }) { s.coins -= pr.coins; s.gems -= pr.gems; }
const own = (s: Save, id: string) => { if (!s.owned.items.includes(id)) s.owned.items.push(id); };

// ------------------------------------------------------------------ seeding

const LEGACY_SPOT: Record<string, { fid: FloorId; at: [number, number, number] }> = {
  g_back: { fid: 'f1', at: [-2, -8, 0] }, g_left: { fid: 'f1', at: [-7, -4, 1] }, g_right: { fid: 'f1', at: [5, -4, 3] },
  g_mid: { fid: 'f1', at: [-2, -2, 0] }, g_frontL: { fid: 'f1', at: [-6, 2, 1] }, g_frontR: { fid: 'f1', at: [5, 2, 3] },
  w_back: { fid: 'f1', at: [28, 0, 0] }, l_left: { fid: 'f2', at: [-5, -5, 1] }, l_right: { fid: 'f2', at: [3, -5, 3] }, l_wall: { fid: 'f2', at: [28, 0, 0] },
};

/** First run (or an old save from the slot days): build the rooms, the boxes and the storage. */
export function seedHome(s: Save) {
  if (s.home.seeded) return;
  const h = s.home;
  h.unlocked = h.unlocked?.length ? h.unlocked : ['f1'];
  if (!h.unlocked.includes('f1')) h.unlocked.unshift('f1');
  for (const f of h.unlocked) if (!h.floors[f]) h.floors[f] = blankRoom();
  const legacy = (s.nights?.length ?? 0) > 0 || s.xp > 0;
  const placed = new Set<string>();
  if (legacy) {
    for (const [slot, id] of Object.entries(s.furniture ?? {})) {
      if (!id || !ITEMS[id]) continue;
      const m = LEGACY_SPOT[slot];
      const fid = m && isOpen(s, m.fid) ? m.fid : 'f1';
      const p = findSpot(s, fid, id, m?.at);
      if (p) { putItem(s, fid, p); placed.add(id); } else s.inventory[id] = (s.inventory[id] ?? 0) + 1;
    }
  }
  s.furniture = {};
  // boxes: everything for a new player; returning players get the boxes with pieces they don't have yet
  const boxes = BOXES.filter((b) => b.floor === 'f1' && (!legacy || boxItems(b).some((i) => !s.owned.items.includes(i))));
  h.boxes = boxes.map((b) => b.id);
  const boxed = new Set(boxes.flatMap(boxItems));
  // anything owned but not placed or boxed goes into storage
  for (const id of s.owned.items) if (ITEMS[id] && !placed.has(id) && !boxed.has(id) && !(s.inventory[id] > 0)) s.inventory[id] = 1;
  h.seeded = true;
}

// ------------------------------------------------------------------ boxes & floors

export interface Opened { box: BoxDef; placed: Placed[]; floor: FloorId; lastOnFloor: boolean; reward: number }
export const FLOOR_REWARD: Record<FloorId, number> = { f1: 60, f2: 90, f3: 120 };

/** Unpack a moving box: its furniture is yours and lands in the room. */
export function openBox(s: Save, id: string): Opened | null {
  const b = BOX[id];
  if (!b || !s.home.boxes.includes(id)) return null;
  s.home.boxes = s.home.boxes.filter((x) => x !== id);
  const out: Placed[] = [];
  for (const item of boxItems(b)) {
    own(s, item);
    const pref = SPOTS[item] ?? [b.x, b.z, b.rot];
    const p = findSpot(s, b.floor, item, pref);
    if (p) out.push(putItem(s, b.floor, p));
    else s.inventory[item] = (s.inventory[item] ?? 0) + 1;
  }
  const lastOnFloor = boxesOn(s, b.floor).length === 0;
  const reward = lastOnFloor ? FLOOR_REWARD[b.floor] : 0;
  s.coins += reward;
  return { box: b, placed: out, floor: b.floor, lastOnFloor, reward };
}

export type UnlockCheck = { ok: true } | { ok: false; reason: 'level' | 'coins' | 'order' | 'open'; need: number };
export function canUnlock(s: Save, fid: FloorId, lv: number): UnlockCheck {
  if (isOpen(s, fid)) return { ok: false, reason: 'open', need: 0 };
  const i = FLOOR_IDS.indexOf(fid);
  if (i > 0 && !isOpen(s, FLOOR_IDS[i - 1])) return { ok: false, reason: 'order', need: 0 };
  const u = UNLOCK[fid];
  if (lv < u.level) return { ok: false, reason: 'level', need: u.level };
  if (s.coins < u.coins) return { ok: false, reason: 'coins', need: u.coins - s.coins };
  return { ok: true };
}

/** Clear the boards off a floor: pay, open it and drop its moving boxes in. */
export function unlockFloor(s: Save, fid: FloorId, lv: number): boolean {
  if (!canUnlock(s, fid, lv).ok) return false;
  s.coins -= UNLOCK[fid].coins;
  s.home.unlocked.push(fid);
  if (!s.home.floors[fid]) s.home.floors[fid] = blankRoom();
  for (const b of BOXES) if (b.floor === fid && !s.home.boxes.includes(b.id)) s.home.boxes.push(b.id);
  return true;
}

export function setFinish(s: Save, fid: FloorId, kind: 'wall' | 'floor', finish: string): boolean {
  const r = room(s, fid), f = FINISH[finish];
  if (!r || !f || (kind === 'wall') !== (f.kind === 'wallpaper')) return false;
  if (!s.owned.finishes.includes(finish)) return false;
  r[kind] = finish;
  return true;
}

// ------------------------------------------------------------------ actions (edit + rules + quests)

const decorated = () => { try { progress('decorate'); } catch { /* quests not ready */ } };
export const doMove = (fid: FloorId, uid: string, to: { x: number; z: number; rot: number; wall?: number }) => {
  let ok = false;
  edit((s) => { ok = moveItem(s, fid, uid, to); });
  if (ok) decorated();
  return ok;
};
export const doStore = (fid: FloorId, uid: string) => { let ids: string[] = []; edit((s) => { ids = storeItem(s, fid, uid); }); return ids; };
/** Place from storage, or buy and place when none are stored. Returns an error or the new uid. */
export function doPlace(fid: FloorId, p: Omit<Placed, 'uid'>, buy: boolean): { uid?: string; error?: string } {
  const s = save.value;
  const fit = checkFit(s, fid, { ...p, uid: '__new' });
  if (!fit.ok) return { error: fit.reason };
  if (buy) {
    const pr = priceOfItem(p.id), d = ITEMS[p.id];
    if (d?.level && level.value.level < d.level) return { error: `Unlocks at level ${d.level}` };
    if (!canAfford(s, pr)) return { error: pr.gems ? 'Not enough moon gems' : 'Not enough acorns' };
  } else if ((s.inventory[p.id] ?? 0) <= 0) return { error: 'None left in storage' };
  let uid = '';
  edit((x) => {
    if (buy) { pay(x, priceOfItem(p.id)); own(x, p.id); uid = putItem(x, fid, { ...p, on: fit.on }).uid; }
    else uid = placeFromInventory(x, fid, { ...p, on: fit.on })?.uid ?? '';
  });
  decorated();
  return { uid };
}
export function doFinish(fid: FloorId, kind: 'wall' | 'floor', finish: string): string | null {
  const s = save.value, f = FINISH[finish];
  if (!f) return 'Unknown finish';
  if (!s.owned.finishes.includes(finish)) {
    const pr = { coins: f.gems ? 0 : f.price, gems: f.gems ?? 0 };
    if (!canAfford(s, pr)) return pr.gems ? 'Not enough moon gems' : 'Not enough acorns';
    edit((x) => { pay(x, pr); x.owned.finishes.push(finish); setFinish(x, fid, kind, finish); });
  } else edit((x) => { setFinish(x, fid, kind, finish); });
  decorated();
  return null;
}
export function doOpenBox(id: string): Opened | null { let r: Opened | null = null; edit((s) => { r = openBox(s, id); }); return r; }
export function doUnlock(fid: FloorId): boolean { let ok = false; edit((s) => { ok = unlockFloor(s, fid, level.value.level); }); return ok; }

/** Every item placed anywhere, with its floor. */
export function allPlaced(s: Save): { fid: FloorId; p: Placed }[] {
  const out: { fid: FloorId; p: Placed }[] = [];
  for (const fid of FLOOR_IDS) for (const p of s.home.floors[fid]?.items ?? []) out.push({ fid, p });
  return out;
}

export { CELL, R_IN, slotOf };
