// The floor plan of Pip's hollow oak, in house-local pixels (16 px = 1 block; origin at the trunk
// centre on the ground, +z towards the default camera, +x to the right). Pure data and maths with
// no three.js, so the game logic (src/game/home.ts) and its tests can share it with the renderer.
import type { FloorId } from '../../game/store.ts';

export type { FloorId };
export const FLOOR_IDS: FloorId[] = ['f1', 'f2', 'f3'];

/** trunk outer radius and wall thickness */
export const RO = 84;
export const WALL_T = 12;
/** the inner wall face; rooms are discs of this radius */
export const R_IN = RO - WALL_T;
/** one build-grid cell (half a block) */
export const CELL = 8;
/** grid cells run from -GN to GN-1 on both axes */
export const GN = 9;
/** floor-to-floor height, the floor slab and the clear height of a room */
export const STORY = 72;
export const SLAB = 10;
export const ROOM_H = STORY - SLAB;
/** top of each floor's walking surface */
export const FLOOR_Y: Record<FloorId, number> = { f1: 4, f2: 4 + STORY, f3: 4 + STORY * 2 };
/** underside of the roof over the attic */
export const ROOF_Y = FLOOR_Y.f3 + ROOM_H;
/** half-angle of the dollhouse cut in the front of the trunk (radians, 0 = facing the camera) */
export const OPEN_A = (7 / 48) * Math.PI * 2;
/** one of the bark's 48 faces (radians); windows sit on face boundaries so their openings are whole faces */
export const FACE = (Math.PI * 2) / 48;

export const FLOOR_NAME: Record<FloorId, string> = { f1: 'Living Room', f2: 'Bedroom', f3: 'Attic Observatory' };
export const FLOOR_SHORT: Record<FloorId, string> = { f1: '1F', f2: '2F', f3: '3F' };
/** what it takes to clear the boards off a floor */
export const UNLOCK: Record<FloorId, { level: number; coins: number }> = { f1: { level: 1, coins: 0 }, f2: { level: 3, coins: 400 }, f3: { level: 6, coins: 1200 } };

/** angle of a point around the trunk: 0 = front (+z), +pi/2 = right (+x), +-pi = back */
export const angleOf = (x: number, z: number) => Math.atan2(x, z);
export const wrapA = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a <= -Math.PI) a += Math.PI * 2; return a; };
export const polar = (a: number, r: number): [number, number] => [Math.sin(a) * r, Math.cos(a) * r];

/** Fixed fittings of a room: ladders, hatches and doorways keep their floor space clear. */
export interface Fixture { kind: 'ladder' | 'hatch' | 'door' | 'window'; a: number; r: number; size: number; y?: number }
/** Where walls are broken (windows, doors, ladders) so nothing hangs there: [angle, half-width in rad]. */
export interface WallGap { a: number; half: number; from: number; to: number }
/** A window: angle round the trunk, centre height above the floor, radius (px); arched (default) or round. */
export interface Win { a: number; v: number; r: number; kind?: 'arch' | 'round' }

export interface RoomPlan {
  id: FloorId;
  y: number;
  fixtures: Fixture[];
  gaps: WallGap[];
  windows: Win[];
}

// Ladders hug the wall near the cut so you can see Pip climb; each floor's hatch sits above the ladder
// below. The front door opens to the right onto the porch, the bedroom door onto the balcony.
export const LADDER_A: Record<'f1' | 'f2', number> = { f1: -1.32, f2: 2.05 };
export const DOOR_A = 1.16;
export const PLANS: Record<FloorId, RoomPlan> = {
  f1: {
    id: 'f1', y: FLOOR_Y.f1,
    fixtures: [
      { kind: 'ladder', a: LADDER_A.f1, r: 64, size: 9 },
      { kind: 'door', a: DOOR_A, r: 64, size: 12 },
    ],
    windows: [{ a: FACE * 19, v: 32, r: 9 }, { a: -FACE * 18, v: 32, r: 9 }, { a: -1.05, v: 30, r: 6, kind: 'round' }],
    gaps: [],
  },
  f2: {
    id: 'f2', y: FLOOR_Y.f2,
    fixtures: [
      { kind: 'hatch', a: LADDER_A.f1, r: 60, size: 13 },
      { kind: 'ladder', a: LADDER_A.f2, r: 64, size: 9 },
      { kind: 'door', a: DOOR_A, r: 64, size: 12 },
    ],
    windows: [{ a: -FACE * 18, v: 32, r: 9 }, { a: FACE * 23, v: 36, r: 7, kind: 'round' }, { a: -1.05, v: 34, r: 7, kind: 'round' }],
    gaps: [],
  },
  f3: {
    id: 'f3', y: FLOOR_Y.f3,
    fixtures: [{ kind: 'hatch', a: LADDER_A.f2, r: 60, size: 13 }, { kind: 'ladder', a: Math.atan2(30, -38), r: 54, size: 9 }],
    windows: [{ a: Math.PI, v: 30, r: 15, kind: 'round' }, { a: -FACE * 13, v: 30, r: 8 }, { a: FACE * 13, v: 30, r: 8 }],
    gaps: [],
  },
};
// wall gaps: the cut, every window, door and ladder
for (const p of Object.values(PLANS)) {
  // windows (with the candle sconce beside each, see art/lowpix/house/_src/interior.py)
  for (const w of p.windows) p.gaps.push({ a: w.a, half: (w.r + 13) / R_IN, from: w.v - w.r - 6, to: w.v + w.r + 4 });
  for (const f of p.fixtures) {
    if (f.kind === 'door') p.gaps.push({ a: f.a, half: 16 / R_IN, from: 0, to: 44 });
    if (f.kind === 'ladder') p.gaps.push({ a: f.a, half: 10 / R_IN, from: 0, to: ROOM_H });
    if (f.kind === 'hatch') p.gaps.push({ a: f.a, half: 9 / R_IN, from: 0, to: 30 });
  }
}
// the peg rails by the doors (art/lowpix/house/_src/interior.py)
PLANS.f1.gaps.push({ a: DOOR_A - 0.42, half: 10 / R_IN, from: 24, to: 44 });
PLANS.f2.gaps.push({ a: DOOR_A - 0.4, half: 10 / R_IN, from: 22, to: 40 });
PLANS.f3.gaps.push({ a: -2.4, half: 10 / R_IN, from: 26, to: 42 });

// ------------------------------------------------------------------ floor grid

export const cellKey = (x: number, z: number) => x + ',' + z;
const validCache = new Map<FloorId, Set<string>>();

/** Cells inside the room disc and clear of fixtures. */
export function floorCells(fid: FloorId): Set<string> {
  let s = validCache.get(fid);
  if (s) return s;
  s = new Set();
  const plan = PLANS[fid];
  for (let x = -GN; x < GN; x++) for (let z = -GN; z < GN; z++) {
    const x0 = x * CELL, z0 = z * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
    const far = Math.max(Math.hypot(x0, z0), Math.hypot(x1, z0), Math.hypot(x0, z1), Math.hypot(x1, z1));
    if (far > R_IN - 1) continue;
    const cx = x0 + CELL / 2, cz = z0 + CELL / 2;
    let clear = true;
    for (const f of plan.fixtures) {
      if (f.kind === 'window') continue;
      const [fx, fz] = polar(f.a, f.r);
      if (Math.hypot(cx - fx, cz - fz) < f.size + CELL * 0.45) { clear = false; break; }
    }
    if (clear) s.add(cellKey(x, z));
  }
  validCache.set(fid, s);
  return s;
}

/** Centre of a cell rectangle (corner x/z, size w/d in cells) in house px. */
export const rectCenter = (x: number, z: number, w: number, d: number): [number, number] => [(x + w / 2) * CELL, (z + d / 2) * CELL];

// ------------------------------------------------------------------ walls

/** Wall slots: the inner wall circle cut into CELL-wide strips, slot 0 centred on the front. */
export const WALL_SLOTS = 56;
export const SLOT_A = (Math.PI * 2) / WALL_SLOTS;
export const slotAngle = (s: number) => wrapA(s * SLOT_A);
/** angle at the centre of a wall item covering slots [s, s+w) */
export const wallCenterA = (s: number, w: number) => wrapA((s + w / 2) * SLOT_A);
export const slotOf = (a: number) => Math.round(wrapA(a) / SLOT_A);

/** Can something hang over [v0, v1] px above the floor at slot s on this floor's wall? */
export function wallSlotFree(fid: FloorId, s: number, v0: number, v1: number): boolean {
  const a = wrapA((s + 0.5) * SLOT_A);
  if (Math.abs(a) < OPEN_A + SLOT_A * 0.6) return false;
  for (const g of PLANS[fid].gaps) {
    if (Math.abs(wrapA(a - g.a)) < g.half + SLOT_A * 0.5 && v1 > g.from && v0 < g.to) return false;
  }
  return v0 >= 3 && v1 <= ROOM_H - 2;
}

/** Is there wall at this angle (not the cut)? */
export const hasWall = (a: number) => Math.abs(wrapA(a)) >= OPEN_A;

// ------------------------------------------------------------------ the oak's outline and anchors
// (mirrored in art/lowpix/house/_lib/hx.py and _src/*.py: keep the numbers in step)

/** Outer radius of the bark at height y (px): a flared foot, a swelling at the second floor, a waist under the crown. */
const TRUNK_R: [number, number][] = [[0, RO + 20], [8, RO + 12], [18, RO + 6.5], [30, RO + 3], [46, RO + 1.2], [66, RO + 0.6], [84, RO + 2.2], [102, RO + 1.5],
  [120, RO - 0.2], [138, RO - 0.6], [160, RO - 1.5], [180, RO - 0.8], [198, RO + 1.2], [210, RO + 3.0]];
export function trunkR(y: number): number {
  for (let i = 0; i < TRUNK_R.length - 1; i++) {
    const [y0, r0] = TRUNK_R[i], [y1, r1] = TRUNK_R[i + 1];
    if (y >= y0 && y <= y1) { let t = (y - y0) / (y1 - y0); t = t * t * (3 - 2 * t); return r0 + (r1 - r0) * t; }
  }
  return y < 0 ? TRUNK_R[0][1] : TRUNK_R[TRUNK_R.length - 1][1];
}
/** A point built facing the front, swung round the trunk axis to angle a (house px). */
export const swingPt = (x: number, y: number, z: number, a: number): [number, number, number] => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
export const LIMB_A = 2.28;
export const CHIMNEY_A = -1.74;
/** the platform on the great limb (its deck centre) and the perch Pip launches from */
export const PLATFORM: [number, number, number] = swingPt(0, FLOOR_Y.f2 + 6, RO + 66, LIMB_A);
export const LAUNCH: [number, number, number] = swingPt(0, FLOOR_Y.f2 + 6 + 22, RO + 66 + 15, LIMB_A);
/** where each room's lantern hangs (the glowing body, house px) */
export const LAMP_AT: Record<FloorId, [number, number, number]> = { f1: [0, FLOOR_Y.f2 - SLAB - 26, -6], f2: [0, FLOOR_Y.f3 - SLAB - 26, -6], f3: [0, ROOF_Y - 26, -6] };
export const PORCH_AT: [number, number, number] = swingPt(0, FLOOR_Y.f1, RO + 26, DOOR_A);
export const BALCONY_AT: [number, number, number] = swingPt(0, FLOOR_Y.f2, RO + 15, DOOR_A);
export const CHIMNEY_TOP: [number, number, number] = swingPt(0, FLOOR_Y.f3 + 22, RO + 30, CHIMNEY_A);
/**
 * An opening through the trunk wall (a window or a door), in its own upright frame: x runs across it (px, 0 on the
 * centre line at angle a), y is world height (px). Arches have a semicircular head of radius hw; round ones are
 * circles of radius hw. The bark, the wallpaper and the frames all cut and trim the same shape.
 */
export interface Opening { a: number; hw: number; y0: number; y1: number; kind: 'arch' | 'round' | 'door' }
export function openings(fid: FloorId): Opening[] {
  const y = FLOOR_Y[fid];
  const out: Opening[] = PLANS[fid].windows.map((w) => w.kind === 'round'
    ? { a: w.a, hw: w.r, y0: y + w.v - w.r, y1: y + w.v + w.r, kind: 'round' as const }
    : { a: w.a, hw: w.r, y0: y + w.v - w.r * 1.15, y1: y + w.v + w.r, kind: 'arch' as const });
  if (PLANS[fid].fixtures.some((f) => f.kind === 'door')) out.push({ a: DOOR_A, hw: 11, y0: y, y1: y + 40, kind: 'door' });
  return out;
}
/** Is the point (x across, y up; px in the opening's frame) inside the opening grown by m px? */
export function inOpening(o: Opening, x: number, y: number, m = 0): boolean {
  if (o.kind === 'round') { const cy = (o.y0 + o.y1) / 2; return x * x + (y - cy) * (y - cy) < (o.hw + m) * (o.hw + m); }
  if (Math.abs(x) > o.hw + m || y < o.y0 - m || y > o.y1 + m) return false;
  const cy = o.y1 - o.hw;
  return y <= cy || x * x + (y - cy) * (y - cy) < (o.hw + m) * (o.hw + m);
}
/** The opening's outline (counter-clockwise seen from outside: x across, y up), about n points, grown by m px. */
export function openingOutline(o: Opening, n: number, m = 0): [number, number][] {
  const pts: [number, number][] = [];
  const hw = o.hw + m;
  if (o.kind === 'round') {
    const cy = (o.y0 + o.y1) / 2;
    for (let i = 0; i < n; i++) { const t = -Math.PI / 2 + (i / n) * Math.PI * 2; pts.push([Math.cos(t) * hw, cy + Math.sin(t) * hw]); }
    return pts;
  }
  const y0 = o.y0 - m, cy = o.y1 - o.hw;
  const arc = Math.max(8, Math.round(n * 0.5)), side = Math.max(2, Math.round((n - arc) / 4));
  for (let i = 0; i < side; i++) pts.push([-hw + (2 * hw * i) / side, y0]);
  for (let i = 0; i < side; i++) pts.push([hw, y0 + ((cy - y0) * i) / side]);
  for (let i = 0; i < arc; i++) { const t = (i / arc) * Math.PI; pts.push([Math.cos(t) * hw, cy + Math.sin(t) * hw]); }
  for (let i = 0; i < side; i++) pts.push([-hw, cy - ((cy - y0) * i) / side]);
  return pts;
}
/** hatch holes in the floors: each floor's hatch sits above the ladder from the floor below: [x, z, half] */
export const HOLES: Record<FloorId, [number, number, number][]> = {
  f1: [],
  f2: [[...polar(LADDER_A.f1, 60), 10] as [number, number, number]],
  f3: [[...polar(LADDER_A.f2, 60), 10] as [number, number, number]],
};
