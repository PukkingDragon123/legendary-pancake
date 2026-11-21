// The grand hollow oak, built as static voxel geometry in house-local px: a massive gnarled trunk
// with deep bark, buttress roots, ivy and shelf fungus, cut open at the front like a dollhouse to
// show three floors; a round front door with a porch, a balcony with a rope bridge to a platform on
// a great low limb (where Pip launches into the night), a stone chimney, round windows, ladders and
// hatches between floors, beams and hanging lanterns, a brass observatory dome on top and a huge
// lumpy canopy. Everything is sorted into per-floor bands so build mode can hide what's above.
import { box, place, type BoxSpec, type Painter } from '../../gfx/box.ts';
import { ramp, tone } from '../../gfx/color.ts';
import { bark, cloth, flat, lamp, leaves, lvl, metal, R, rock, smooth, solid, wood } from '../../gfx/mats.ts';
import { fbm, hash } from '../../gfx/noise.ts';
import { daisy, toadstool, tulip } from '../../assets/nature.ts';
import { beam, Buckets, Crown, discStrips, oakBark, ringWood, ringXY, swing, swingPt, wallPainter, type Band, bandRange } from './kit.ts';
import { DOOR_A, FLOOR_Y, LADDER_A, OPEN_A, PLANS, polar, R_IN, RO, ROOF_Y, SLAB, WALL_T, wrapA, type FloorId } from './plan.ts';

export const NSEG = 44;
export const LIMB_A = 2.28;
export const CHIMNEY_A = -2.02;
const FY = FLOOR_Y;

export interface PaneDef { a: number; y: number; r: number; floor: FloorId | 'roof' }
export interface OakParts {
  bk: Buckets;
  canopy: BoxSpec[];
  panes: PaneDef[];
  /** points of interest in house px */
  at: { lamp: Record<FloorId, [number, number, number]>; chimneyTop: [number, number, number]; porch: [number, number, number]; launch: [number, number, number]; balcony: [number, number, number]; platform: [number, number, number] };
  /** hatch holes in floor slabs: [x, z, half] */
  holes: Record<FloorId, [number, number, number][]>;
}

const stone = (seed = 6) => rock('#8f8a84', { seed, moss: '#6aa04a' });
const darkWood = wood('#6a4428', { axis: 'y', plank: 0 });
const railWood = wood('#8a5a34', { axis: 'x', plank: 0, seed: 3 });
const deckWood = wood('#b07a44', { axis: 'x', plank: 4, seed: 5 });
const iron = metal('#4a4a52');
const brass = metal('#c9963a');
const glowLamp = lamp('#ffd27a');

/** hatch holes: each floor's hatch sits above the ladder from the floor below */
export const HOLES: Record<FloorId, [number, number, number][]> = {
  f1: [],
  f2: [[...polar(LADDER_A.f1, 60), 10] as [number, number, number]],
  f3: [[...polar(LADDER_A.f2, 60), 10] as [number, number, number]],
};

/** a paper/metal lantern hanging from y (its top) */
function lantern(x: number, y: number, z: number, glow: Painter = glowLamp, s = 1): BoxSpec[] {
  return [
    box(x, y - 1.4 * s, z, 6 * s, 1.4 * s, 6 * s, iron), box(x, y, z, 2 * s, 1.2 * s, 2 * s, iron),
    box(x, y - 8.2 * s, z, 4.6 * s, 6.8 * s, 4.6 * s, glow, { glow: true, tag: 'lamp' }),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(x + sx * 2.5 * s, y - 8.4 * s, z + sz * 2.5 * s, 0.8 * s, 7 * s, 0.8 * s, iron))),
    box(x, y - 9.6 * s, z, 6 * s, 1.4 * s, 6 * s, iron), box(x, y - 10.6 * s, z, 1.4 * s, 1 * s, 1.4 * s, brass),
  ];
}

/** a terracotta pot with a little clump of flowers (no rotations, safe to swing) */
function flowerPot(x: number, y: number, z: number, c: string, seed: number): BoxSpec[] {
  const pot = solid('#c0663c', { noise: 0.5 });
  const out: BoxSpec[] = [box(x, y, z, 5, 4, 5, pot), box(x, y + 3.4, z, 6, 1.4, 6, pot), box(x, y + 4.6, z, 4.4, 0.4, 4.4, flat('#4a3424'))];
  const lf = leaves('#4f9e45', { seed });
  for (let i = 0; i < 4; i++) {
    const dx = (hash(i, seed, 1) - 0.5) * 3.4, dz = (hash(i, seed, 2) - 0.5) * 3.4, h = 2 + hash(i, seed, 3) * 3;
    out.push(box(x + dx, y + 4.8, z + dz, 0.8, h, 0.8, lf), box(x + dx, y + 4.8 + h, z + dz, 2.2, 1.6, 2.2, smooth(c), { sway: 0.2 }));
  }
  out.push(box(x, y + 4.8, z, 4.6, 1.6, 4.6, lf, { sway: 0.1 }));
  return out;
}

const signPainter: Painter = (t) => {
  if (t.face !== 4) return wood('#7b4b2c', { axis: 'x' })(t);
  const u = t.bx, v = t.by;
  if (Math.hypot(u - 7, v - 4.5) < 2.6 && Math.hypot(u - 8, v - 5.2) > 2.1) return 0xfff0b0;
  if ([[16, 5.6], [22, 3.2], [28, 5.2], [34, 3.6]].some(([x, y]) => Math.abs(u - x) + Math.abs(v - y) < 1.1)) return 0xffe08a;
  if (u < 1 || u > t.sx - 1 || v < 0.8 || v > t.sy - 0.8) return tone(R('#5a3a22'), 0);
  return tone(R('#b07a44'), lvl(t, { noise: 0.3 }) * 0.6 + (Math.floor(v) % 3 === 0 ? -0.4 : 0));
};

export function buildOak(): OakParts {
  const bk = new Buckets();
  const panes: PaneDef[] = [];
  const step = (Math.PI * 2) / NSEG;
  const rMid = (R_IN + 0.5 + RO) / 2, depth = RO - R_IN - 0.5;
  const segW = (2 * Math.PI * RO) / NSEG + 0.8;
  const walls = [wallPainter(5, 50), wallPainter(7, 20), wallPainter(9, 10)];
  const windowsIn = (band: number) => (band < 3 ? PLANS[(['f1', 'f2', 'f3'] as FloorId[])[band]].windows.map((w) => ({ ...w, y: FY[(['f1', 'f2', 'f3'] as FloorId[])[band]] + w.v })) : []);

  // ---------------------------------------------------------------- walls, band by band
  for (let i = 0; i < NSEG; i++) {
    const a = -Math.PI + (i + 0.5) * step;
    const open = Math.abs(a) < OPEN_A;
    for (let band = 0; band < 4; band++) {
      const [y0, y1] = band < 3 ? bandRange(band as Band) : [ROOF_Y, ROOF_Y + 28];
      if (open && band < 3) continue;
      const wins = windowsIn(band).filter((w) => Math.abs(wrapA(a - w.a)) < step / 2 + (w.r + 1) / RO);
      let mat = band < 3 ? walls[band] : walls[2];
      if (wins.length) {
        const base = mat;
        mat = (t) => {
          if (t.face === 4 || t.face === 5) {
            const ta = Math.atan2(t.x, t.z), rr = Math.hypot(t.x, t.z);
            for (const w of wins) if (Math.hypot(wrapA(ta - w.a) * rr, t.y - w.y) < w.r) return -1;
          }
          return base(t);
        };
      }
      bk.add(band as Band, ...swing([box(0, y0, rMid, segW, y1 - y0, depth, mat, { cut: wins.length > 0, tag: 'wall' })], a));
      // deep bark: a ridge or two standing proud of the trunk
      const bp = oakBark(11 + band, band === 0 ? 60 : 12);
      for (let k = 0; k < 2; k++) {
        if (band === 3 && k) continue;
        const h0 = hash(i, band, k, 3), len = (y1 - y0) * (0.35 + hash(i, band, k, 4) * 0.6);
        const ys = y0 + h0 * (y1 - y0 - len);
        const jx = (hash(i, band, k, 5) - 0.5) * segW * 0.8, w = 3 + hash(i, band, k, 6) * 3;
        bk.add(band as Band, ...swing([box(jx, ys, RO + 1.2, w, len, 3 + hash(i, band, k, 7) * 1.6, bp)], a));
      }
    }
    // a stepped flare at the foot of the trunk
    if (!open) {
      bk.add(0, ...swing([box(0, 0, RO + 3, segW + 1.2, 22 + hash(i, 9, 9, 2) * 16, 6, walls[0]), box(0, 0, RO + 7, segW + 2, 8 + hash(i, 9, 8, 2) * 9, 6, walls[0])], a));
      // knotty bulges and burls break up the cylinder
      for (let band = 0; band < 3; band++) {
        if (hash(i, band, 1, 77) > 0.42) continue;
        const [y0, y1] = bandRange(band as Band);
        const h = 18 + hash(i, band, 2, 77) * 34, y = y0 + hash(i, band, 3, 77) * (y1 - y0 - h);
        const d = 3 + hash(i, band, 4, 77) * 4;
        bk.add(band as Band, ...swing([box(0, y, RO + d / 2, segW * (1.2 + hash(i, band, 5, 77)), h, d + 1, oakBark(17 + band, band ? 14 : 70)), box(0, y + h * 0.2, RO + d + 1, segW * 0.8, h * 0.6, 3, oakBark(19, 20))], a + (hash(i, band, 6, 77) - 0.5) * step));
      }
    }
  }

  // organic lips at the dollhouse cut: a low sill on the ground floor, overhangs under the slabs
  const rings = ringWood(4);
  for (const sgn of [-1, 1]) {
    const a = sgn * (OPEN_A - step * 0.5), a2 = sgn * (OPEN_A - step * 1.5);
    bk.add(0, ...swing([box(0, 0, rMid, segW, sgn > 0 ? 18 : 12, depth, walls[0])], a));
    bk.add(0, ...swing([box(0, 0, rMid + 1, segW, sgn > 0 ? 7 : 4, depth - 2, walls[0])], a2));
    bk.add(1, ...swing([box(0, FY.f2 - SLAB - (sgn > 0 ? 14 : 9), rMid, segW, sgn > 0 ? 14 : 9, depth, walls[1])], a));
    bk.add(1, ...swing([box(0, FY.f2 + 0, rMid, segW, sgn > 0 ? 6 : 12, depth, walls[1])], a));
    bk.add(2, ...swing([box(0, FY.f3 - SLAB - (sgn > 0 ? 8 : 15), rMid, segW, sgn > 0 ? 8 : 15, depth, walls[2])], a));
    bk.add(2, ...swing([box(0, ROOF_Y - (sgn > 0 ? 16 : 8), rMid, segW, sgn > 0 ? 16 : 8, depth, walls[2])], a));
    bk.add(2, ...swing([box(0, ROOF_Y - 6, rMid, segW, 6, depth, walls[2])], a2));
    // splinters of heartwood sticking out of the cut
    for (let k = 0; k < 5; k++) {
      const y = 10 + hash(k, sgn, 1, 2) * (ROOF_Y - 30);
      bk.auto(...swing([{ ...box(sgn * 3, y, rMid, 3, 6 + hash(k, sgn, 2, 2) * 8, 4, rings), rot: [0, 0, sgn * (10 + hash(k, sgn, 3, 2) * 25)] }], sgn * (OPEN_A - 0.04)));
    }
  }

  // ---------------------------------------------------------------- floors and ceilings
  const baseWood = wood('#9a6a40', { axis: 'x', plank: 4, seed: 1 });
  const slabP = (seed: number): Painter => {
    const ceil = wood('#a87444', { axis: 'x', plank: 4, seed }), edge = wood('#7a4a2a', { axis: 'x', plank: 3, seed: seed + 1 });
    return (t) => (t.face === 3 || t.face === 2 ? ceil(t) : edge(t));
  };
  bk.add(0, ...discStrips(RO - 3, 0, 2, baseWood, [], 6, { skip: 'd' }));
  bk.add(1, ...discStrips(RO - 1, FY.f2 - SLAB, FY.f2 - 2, slabP(2), HOLES.f2, 6));
  bk.add(2, ...discStrips(RO - 1, FY.f3 - SLAB, FY.f3 - 2, slabP(3), HOLES.f3, 6));
  bk.add(3, ...discStrips(RO - 1, ROOF_Y, ROOF_Y + 8, slabP(4), [], 6));
  // a curved log threshold where the ground floor meets the clearing
  for (let k = -5; k <= 5; k++) {
    const a = (k / 5.5) * OPEN_A;
    bk.add(0, ...swing([box(0, 0, RO - 3, 13.5, 3.6, 6, wood('#7b4b2c', { axis: 'x', plank: 0, seed: k + 9 }))], a));
  }
  // hatch frames and propped-open trapdoors
  for (const fid of ['f2', 'f3'] as FloorId[]) {
    const band: Band = fid === 'f2' ? 1 : 2, y = FY[fid];
    for (const [hx, hz, hh] of HOLES[fid]) {
      const fr = wood('#6a4428', { axis: 'x', plank: 0, seed: 4 });
      bk.add(band, box(hx, y - SLAB, hz - hh - 0.8, hh * 2 + 3.2, SLAB + 1.4, 1.6, fr), box(hx, y - SLAB, hz + hh + 0.8, hh * 2 + 3.2, SLAB + 1.4, 1.6, fr),
        box(hx - hh - 0.8, y - SLAB, hz, 1.6, SLAB + 1.4, hh * 2, fr), box(hx + hh + 0.8, y - SLAB, hz, 1.6, SLAB + 1.4, hh * 2, fr));
      const lid = wood('#8a5a34', { axis: 'z', plank: 4, seed: 6 });
      const towardCenter = hx > 0 ? -1 : 1;
      bk.add(band, { ...box(hx + towardCenter * (hh + 1.5), y + 1.4, hz, 1.6, hh * 2, hh * 2 - 1, lid), rot: [0, 0, towardCenter * -14], pivot: [hx + towardCenter * (hh + 0.8), y + 1.4, hz] });
      bk.add(band, box(hx + towardCenter * (hh + 2.6), y + hh + 1, hz, 0.8, 2.4, 3, iron));
    }
  }

  // ceiling beams, a boss and a hanging lantern for each room
  const lampAt = {} as Record<FloorId, [number, number, number]>;
  for (const fid of ['f1', 'f2', 'f3'] as FloorId[]) {
    const band: Band = fid === 'f1' ? 1 : fid === 'f2' ? 2 : 3;
    const top = fid === 'f3' ? ROOF_Y : FY[fid === 'f1' ? 'f2' : 'f3'] - SLAB;
    const bw = wood('#7a4a2a', { axis: 'z', plank: 0, seed: 7 });
    for (const a of [Math.PI, 2.35, -2.35, 1.45, -1.45]) {
      if (fid === 'f3') bk.add(band, beam(...swingPt(0, top - 18, R_IN - 1, a), R_IN - 6, 5, a + Math.PI, 0.23, bw));
      else bk.add(band, beam(0, top - 3, 0, R_IN + 1, 6, a, 0, bw));
    }
    bk.add(band, box(0, top - (fid === 'f3' ? 6 : 8), 0, 11, fid === 'f3' ? 6 : 8, 11, wood('#6a4428', { axis: 'y', rings: true })));
    const ly = top - (fid === 'f3' ? 6 : 8);
    bk.add(band, box(0, ly - 14, 0, 0.6, 14, 0.6, iron), ...lantern(0, ly - 13, 0));
    lampAt[fid] = [0, ly - 20, 0];
  }

  // ladders between floors
  for (const [fid, a] of [['f1', LADDER_A.f1], ['f2', LADDER_A.f2]] as const) {
    const y0 = FY[fid], y1 = FY[fid === 'f1' ? 'f2' : 'f3'] + 1, len = y1 - y0 + 1;
    const lean = Math.atan2(8, len) * (180 / Math.PI);
    const rail = wood('#8a5a34', { axis: 'y', plank: 0, seed: 2 }), rung = wood('#c08550', { axis: 'x', plank: 0, seed: 8 });
    const parts: BoxSpec[] = [];
    for (const x of [-4.6, 4.6]) parts.push({ ...box(x, y0, 58, 1.8, len, 1.8, rail), rot: [lean, 0, 0], pivot: [x, y0, 58] });
    for (let y = y0 + 6; y < y1 - 2; y += 7) parts.push(box(0, y, 58 + (y - y0) * Math.tan((lean * Math.PI) / 180), 8, 1.3, 1.5, rung));
    // a coil of rope hung on the rail
    parts.push(box(-5.6, y0 + 30, 59, 1.6, 6, 3, cloth('#d9c7a0')));
    bk.add(fid === 'f1' ? 0 : 1, ...swing(parts, a));
  }

  // ---------------------------------------------------------------- windows
  for (const fid of ['f1', 'f2', 'f3'] as FloorId[]) {
    const band: Band = fid === 'f1' ? 0 : fid === 'f2' ? 1 : 2;
    for (const w of PLANS[fid].windows) {
      const y = FY[fid] + w.v, fr = wood('#5e3b24', { axis: 'y', plank: 0, seed: 3 });
      const parts: BoxSpec[] = [
        ...ringXY(0, y, RO + 1.6, w.r + 2.6, w.r - 0.4, 3, fr, 2),
        ...ringXY(0, y, R_IN - 1.4, w.r + 2.2, w.r - 0.4, 2.2, fr, 2),
        box(0, y - w.r, R_IN + WALL_T / 2, 1.2, w.r * 2, 1.2, fr), box(0, y - 0.6, R_IN + WALL_T / 2, w.r * 2, 1.2, 1.2, fr),
        box(0, y - w.r - 3.4, RO + 2.6, w.r * 2 + 5, 2, 5, wood('#7b4b2c', { axis: 'x', plank: 0 })),
      ];
      if (w.r >= 12) parts.push(...ringXY(0, y, R_IN + WALL_T / 2, w.r * 0.45 + 0.8, w.r * 0.45 - 0.4, 1.2, fr, 1));
      if (fid !== 'f3') {
        parts.push(box(0, y - w.r - 8.4, RO + 4.2, w.r * 2, 4.4, 4, wood('#8a5a34', { axis: 'x', plank: 2 })));
        for (let k = 0; k < 4; k++) parts.push(...place(k % 2 ? daisy(40 + k) : tulip(50 + k, ['#e9463f', '#f9cf45'][k % 2]), -w.r + 3 + k * ((w.r * 2 - 6) / 3), y - w.r - 4, RO + 4.2));
      }
      bk.add(band, ...swing(parts, w.a));
      panes.push({ a: w.a, y, r: w.r, floor: fid });
    }
  }

  // ---------------------------------------------------------------- doors, porch and balcony
  const doorP = (c: string): Painter => {
    const pl = wood(c, { axis: 'y', plank: 4, seed: 4 });
    return (t) => (Math.abs(t.y - 18) < 1 || Math.abs(t.y - 26) < 1 ? tone(ramp(0x3a3a42), lvl(t, { noise: 0 }) * 0.4) : pl(t));
  };
  {
    const dp = doorP('#8a3f2e');
    const parts: BoxSpec[] = [
      ...ringXY(0, 4 + 14, RO + 1.4, 17, 13.2, 3.4, stone(3), 2),
      ...ringXY(0, 4 + 14, RO + 0.6, 13.4, 0, 2.4, dp, 2),
      box(4.6, 16.4, RO + 2, 2.4, 2.4, 1.6, brass), box(4.6, 17, RO + 3.2, 1.2, 1.2, 1, brass),
      ...ringXY(0, 25.5, RO + 1.9, 2.8, 0, 0.8, flat('#9fd0e8')),
      box(0, 0, RO + 4, 22, 4, 7, stone(5)),
      // inside face of the door
      ...ringXY(0, 4 + 14, R_IN - 2.2, 16, 13, 2, wood('#6a4428', { axis: 'y', plank: 0 }), 2),
      ...ringXY(0, 4 + 14, R_IN - 1.6, 13.2, 0, 1.4, dp, 2),
      box(-4.6, 16.4, R_IN - 3, 2.2, 2.2, 1.4, brass),
    ];
    // porch deck, railing, steps, lantern post, a welcome mat and pots
    parts.push(box(0, 0, RO + 14, 42, 4, 28, deckWood, { skip: 'd' }), box(0, 0.4, RO + 28.6, 44, 3.4, 2.2, wood('#7b4b2c', { axis: 'x', plank: 0 })));
    parts.push(box(0, 0, RO + 31.5, 24, 2.4, 5, stone(8)), box(0, 0, RO + 35.5, 18, 1.2, 4, stone(9)));
    for (const x of [-20, 20]) {
      for (const z of [RO + 3, RO + 11, RO + 19, RO + 27]) parts.push(box(x, 4, z, 2, 11, 2, darkWood));
      parts.push(box(x, 14.4, RO + 15, 1.6, 1.8, 25, wood('#8a5a34', { axis: 'z', plank: 0 })), box(x, 9, RO + 15, 1, 1.2, 24, wood('#8a5a34', { axis: 'z', plank: 0 })));
    }
    parts.push(box(-20, 15, RO + 27, 2.6, 14, 2.6, darkWood), box(-16.6, 28.4, RO + 27, 8, 1.6, 1.6, darkWood), ...lantern(-13.6, 27.6, RO + 27));
    const mat: Painter = (t) => tone(R('#c94f3f'), lvl(t, { noise: 0.3 }) * 0.6 + ((Math.floor(t.bx) + Math.floor(t.bz)) % 4 === 0 ? 0.8 : 0) + (t.bx < 1.4 || t.bx > t.sx - 1.4 || t.bz < 1 || t.bz > t.sz - 1 ? -1 : 0));
    parts.push(box(0, 4, RO + 9, 15, 0.5, 7, mat));
    parts.push(...flowerPot(14, 4, RO + 5, '#f2a7c0', 3), ...flowerPot(-14, 4, RO + 6, '#ffd36a', 5), ...flowerPot(15.5, 4, RO + 22, '#9ec3ff', 7));
    bk.add(0, ...swing(parts, DOOR_A));
  }
  {
    // the bedroom door and balcony above the porch
    const y = FY.f2;
    const dp = doorP('#3f6a80');
    const arch = (z: number, d: number, p: Painter): BoxSpec[] => [box(0, y, z, 16, 16, d, p), ...ringXY(0, y + 16, z, 8, 0, d, p, 2).filter((b) => b.at[1] >= y + 16)];
    const parts: BoxSpec[] = [
      box(0, y, RO + 0.9, 20, 18, 2.6, wood('#5e3b24', { axis: 'y', plank: 0 })), ...ringXY(0, y + 18, RO + 0.9, 10, 0, 2.6, wood('#5e3b24', { axis: 'y', plank: 0 })).filter((b) => b.at[1] >= y + 18),
      ...arch(RO + 1.6, 2, dp), box(4.4, y + 12, RO + 3, 2, 2, 1.4, brass),
      ...arch(R_IN - 1.8, 1.6, dp), box(-4.4, y + 12, R_IN - 2.8, 2, 2, 1.4, brass),
    ];
    parts.push(box(0, y - 4, RO + 12, 40, 4, 28, deckWood), box(0, y - 3.6, RO + 26.4, 42, 3.4, 2, wood('#7b4b2c', { axis: 'x', plank: 0 })));
    for (const x of [-13, 13]) parts.push(beam(x, y - 36, RO - 1, 40, 3.4, 0, 0.98, darkWood));
    for (let x = -18; x <= 18; x += 6) parts.push(box(x, y, RO + 25, 1.8, 11, 1.8, darkWood));
    for (const z of [RO + 3, RO + 9, RO + 15, RO + 21]) parts.push(box(-19, y, z, 1.8, 11, 1.8, darkWood));
    parts.push(box(19, y, RO + 3, 1.8, 11, 1.8, darkWood), box(19, y, RO + 9, 1.8, 11, 1.8, darkWood));
    parts.push(box(0, y + 11, RO + 25, 40, 1.8, 2, railWood), box(-19, y + 11, RO + 14, 2, 1.8, 24, wood('#8a5a34', { axis: 'z', plank: 0 })), box(19, y + 11, RO + 6, 2, 1.8, 8, wood('#8a5a34', { axis: 'z', plank: 0 })));
    // window box on the rail and a lantern by the door
    parts.push(box(-8, y + 12.8, RO + 25.6, 18, 4, 4.4, wood('#a8703f', { axis: 'x', plank: 2 })));
    for (let k = 0; k < 4; k++) parts.push(...place(k % 2 ? tulip(70 + k, '#f2a7c0') : daisy(80 + k), -15 + k * 4.6, y + 16.6, RO + 25.6));
    parts.push(box(-14, y + 30, RO + 3, 1.6, 1.6, 6, iron), ...lantern(-14, y + 29.6, RO + 6));
    bk.add(1, ...swing(parts, DOOR_A));
  }

  // ---------------------------------------------------------------- the great limb, platform and rope bridge
  const limbB = bark('#6b4a2e', { seed: 21, moss: '#5c9440', mossTo: 90, axis: 'z' });
  const L0 = swingPt(0, FY.f2 - 22, RO - 10, LIMB_A);
  const limb: BoxSpec[] = [];
  let lp: [number, number, number] = L0;
  for (const [len, th, tilt] of [[44, 26, 0.12], [44, 20, 0.04], [40, 14, 0.14], [26, 9, 0.3]] as const) {
    limb.push(beam(lp[0], lp[1], lp[2], len + 4, th, LIMB_A, tilt, limbB));
    lp = [lp[0] + Math.sin(LIMB_A) * Math.cos(tilt) * len, lp[1] + Math.sin(tilt) * len, lp[2] + Math.cos(LIMB_A) * Math.cos(tilt) * len];
  }
  const tip = lp;
  // a side twig rising to a tuft of leaves
  const twigBase = swingPt(0, FY.f2 - 10, RO + 50, LIMB_A);
  limb.push(beam(twigBase[0], twigBase[1], twigBase[2], 34, 7, LIMB_A - 0.7, 0.85, limbB));
  bk.add(1, ...limb);
  const P = swingPt(0, FY.f2 + 6, RO + 66, LIMB_A);
  {
    const pw = wood('#b07a44', { axis: 'x', plank: 4, seed: 12 }), pz = wood('#a8703f', { axis: 'z', plank: 4, seed: 13 });
    const out: BoxSpec[] = [box(P[0], P[1] - 4, P[2], 38, 4, 26, pw), box(P[0], P[1] - 4, P[2], 26, 4, 38, pz)];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.4;
      const [x, z] = [P[0] + Math.sin(a) * 17, P[2] + Math.cos(a) * 17];
      // leave a gap where the bridge lands (towards the trunk side)
      const toTrunk = Math.cos(a - (LIMB_A + Math.PI)) > 0.55;
      if (!toTrunk) out.push(box(x, P[1], z, 1.8, 10, 1.8, darkWood));
    }
    // perch post at the far end: Pip's launching spot
    const far = swingPt(0, P[1], RO + 66 + 15, LIMB_A);
    out.push(box(far[0], P[1], far[2], 2.6, 20, 2.6, darkWood), { ...box(far[0], P[1] + 20, far[2], 11, 1.8, 2.4, wood('#c08550', { axis: 'x', plank: 0 })), rot: [0, (LIMB_A * 180) / Math.PI + 90, 0] });
    // flag pole and pennant
    const fl = swingPt(-12, P[1], RO + 66 + 8, LIMB_A);
    out.push(box(fl[0], P[1], fl[2], 1.2, 34, 1.2, darkWood), box(fl[0], P[1] + 34, fl[2], 2, 2, 2, brass));
    out.push({ ...box(fl[0] + 5, P[1] + 26, fl[2], 10, 7, 0.6, cloth('#e2863a', { stripe: '#f3e2b8', stripeEvery: 3 }), { sway: 0.6, cut: true }), rot: [0, (LIMB_A * 180) / Math.PI - 90, 0], pivot: [fl[0], P[1] + 29, fl[2]] });
    const lt = swingPt(12, P[1], RO + 66 + 6, LIMB_A);
    out.push(box(lt[0], P[1], lt[2], 2, 18, 2, darkWood), box(lt[0], P[1] + 18, lt[2] + 2.4, 1.4, 1.4, 6, iron), ...lantern(lt[0], P[1] + 17.4, lt[2] + 5));
    // support posts down to the limb
    out.push(box(P[0] - 8, P[1] - 18, P[2], 3, 14, 3, darkWood), box(P[0] + 8, P[1] - 16, P[2], 3, 12, 3, darkWood));
    bk.add(1, ...out);
  }
  const launch = swingPt(0, FY.f2 + 6 + 22, RO + 66 + 15, LIMB_A);
  // rope bridge from the balcony's side gate to the platform, sagging between them
  {
    const S = swingPt(22, FY.f2, RO + 17, DOOR_A);
    const dx0 = P[0] - S[0], dz0 = P[2] - S[2], dl = Math.hypot(dx0, dz0);
    const E: [number, number, number] = [P[0] - (dx0 / dl) * 17, P[1], P[2] - (dz0 / dl) * 17];
    const dx = E[0] - S[0], dz = E[2] - S[2], len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz);
    const N = Math.max(6, Math.round(len / 5.4));
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      pts.push([S[0] + dx * u, S[1] + (E[1] - S[1]) * u - Math.sin(u * Math.PI) * 6, S[2] + dz * u]);
    }
    const plk = wood('#a8703f', { axis: 'z', plank: 0, seed: 15 }), rope = cloth('#d9c7a0', { shade: { noise: 0.2 } });
    const out: BoxSpec[] = [];
    const side = (o: number): [number, number] => [Math.cos(yaw) * o, -Math.sin(yaw) * o];
    for (let k = 0; k < N; k++) {
      const a = pts[k], b = pts[k + 1], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      const slope = Math.atan2(b[1] - a[1], len / N);
      out.push({ ...box(m[0], m[1] - 1.6, m[2], 12, 1.6, len / N - 0.9, plk), rot: [(-slope * 180) / Math.PI, (yaw * 180) / Math.PI, 0], pivot: [m[0], m[1], m[2]] });
      for (const o of [-6.4, 6.4]) {
        const [sx, sz] = side(o);
        const sl = Math.atan2(b[1] - a[1], len / N);
        out.push(beam(a[0] + sx, a[1] + 10 - Math.sin((k / N) * Math.PI) * 2, a[2] + sz, len / N + 0.4, 1, yaw, sl, rope));
        if (k % 2 === 0) out.push(box(a[0] + sx, a[1], a[2] + sz, 0.8, 10, 0.8, rope));
      }
    }
    for (const p of [S, E]) for (const o of [-6.6, 6.6]) { const [sx, sz] = side(o); out.push(box(p[0] + sx, p[1] - 2, p[2] + sz, 2.4, 15, 2.4, darkWood)); }
    bk.add(1, ...out);
  }

  // ---------------------------------------------------------------- chimney
  {
    const st = stone(6);
    const out: BoxSpec[] = [];
    const tops = [bandRange(0), bandRange(1), bandRange(2), [ROOF_Y, ROOF_Y + 58]] as [number, number][];
    tops.forEach(([y0, y1], b) => out.push(...swing([box(0, y0, RO + 4, 18, y1 - y0, 13, st), box(0, y0 + 2, RO + 9, 14, Math.max(4, y1 - y0 - 6), 4, stone(8 + b))], CHIMNEY_A)));
    out.push(...swing([box(0, ROOF_Y + 58, RO + 4, 23, 4, 17, stone(12)), box(0, ROOF_Y + 62, RO + 4, 13, 1, 9, flat('#2a2422')), box(-7, ROOF_Y + 62, RO + 4, 4, 3, 4, stone(13)), box(7, ROOF_Y + 62, RO + 4, 4, 3, 4, stone(14))], CHIMNEY_A));
    for (const b of out) bk.auto(b);
  }

  // ---------------------------------------------------------------- roots, fungus, ivy, mushrooms
  {
    const rb = bark('#5e4230', { seed: 31, moss: '#5c9440', mossTo: 26, axis: 'z' });
    const roots: [number, number][] = [[-1.0, 0.8], [0.98, 0.62], [-1.5, 1.15], [-2.0, 1.25], [-2.6, 1.1], [2.95, 1], [2.4, 1.2], [1.85, 1.1], [-2.95, 0.9]];
    for (const [a, s] of roots) {
      const parts: BoxSpec[] = [
        beam(0, 34 * s, RO - 8, 38 * s, 17 * s, 0, -0.72, rb), beam(0, 10 * s, RO + 18 * s, 24 * s, 12 * s, 0, -0.32, rb), beam(0, 3.4 * s, RO + 38 * s, 16 * s, 7 * s, 0, -0.16, rb),
        box(0, -2, RO + 8 * s, 8 * s, 18 * s, 22 * s, rb), box(0, -2, RO + 24 * s, 6 * s, 8 * s, 14 * s, rb),
      ];
      bk.add(0, ...swing(parts, a + (hash(Math.round(a * 10), 1, 2, 3) - 0.5) * 0.08));
    }
    const fungus: Painter = (t) => (t.face === 3 ? tone(R('#f6e2b8'), -0.2) : tone(R('#e0a65a'), lvl(t, { noise: 0.5 }) + (t.face === 2 && (t.u + t.v) % 3 === 0 ? 0.6 : 0)));
    for (const [a, y] of [[-1.9, 44], [-1.95, 50], [2.3, 92], [2.24, 98], [-2.7, 120], [2.7, 160], [-1.4, 182], [1.62, 140], [-2.3, 196]] as const) {
      bk.auto(...swing([box(0, y, RO + 4.5, 12, 2, 7, fungus), box(-1, y + 2, RO + 3.6, 8, 1.4, 4.6, fungus), box(3.5, y - 6, RO + 3.6, 7, 1.6, 5, fungus)], a));
    }
    // ivy climbing the bark in a few long wandering strands
    const ivy = [leaves('#3f8a36', { seed: 41, lift: 0.4 }), leaves('#4f9a3c', { seed: 42, lift: 0.1 }), leaves('#5fae44', { seed: 43, lift: 0.6 })];
    const stem = solid('#4a5a2a', { noise: 0.2 });
    for (const [a0, len, seed] of [[-1.05, 70, 1], [2.55, 58, 2], [-2.55, 64, 3], [1.62, 40, 4], [-1.6, 46, 5]] as const) {
      let a = a0, y = 2;
      for (let k = 0; k < len; k++) {
        y += 3; a += (fbm(k * 0.15, seed, 0, 7) - 0.5) * 0.08;
        if (Math.abs(a) < OPEN_A + 0.08) a += Math.sign(a) * 0.06;
        const side = k % 2 ? 1 : -1;
        const parts: BoxSpec[] = [box(0, y, RO + 2.2, 0.8, 3.2, 0.8, stem)];
        if (hash(k, seed, 1, 9) > 0.15) parts.push(box(side * 2, y + 0.6, RO + 2.6, 3.6, 3.2, 1.4, ivy[k % 3], { sway: 0.15 }));
        if (hash(k, seed, 2, 9) > 0.7) parts.push(box(-side * 1.6, y + 1.6, RO + 2.4, 2.6, 2.4, 1.2, ivy[(k + 1) % 3], { sway: 0.15 }));
        bk.auto(...swing(parts, a));
      }
    }
    // toadstools and chanterelle-coloured caps among the roots
    const shrooms: [number, number, number, string, number][] = [[-56, 0, 74, '#da4230', 1.3], [-62, 0, 80, '#da4230', 0.9], [92, 0, 30, '#e8963a', 1.1], [-100, 0, -10, '#da4230', 1.2], [-96, 0, -2, '#f2c94a', 0.8], [70, 0, -76, '#da4230', 1.4], [-30, 4, 50, '#f2c94a', 0.7], [-36, 4, 46, '#da4230', 0.9]];
    shrooms.forEach(([x, y, z, c, s], i) => bk.add(0, ...place(toadstool(60 + i, c, s), x, y, z)));
    // a knothole with an acorn stash high on the trunk
    bk.add(2, ...swing([...ringXY(0, 176, RO + 1.4, 8, 4.6, 3, ringWood(9), 1), ...ringXY(0, 176, RO + 0.6, 4.8, 0, 1, flat('#1e140e'), 1), box(1, 172.4, RO + 1.4, 3, 3, 2.4, smooth('#c28a4c')), box(1, 175.2, RO + 1.4, 3.4, 1.4, 2.6, wood('#6b4220', { axis: 'x', plank: 0 }))], 2.62));
  }

  // a carved name board over the ground floor
  bk.add(1, { ...box(0, FY.f2 - SLAB - 1.5, RO, 42, 10, 2.4, signPainter), rot: [-6, 0, 0] }, box(-18, FY.f2 - SLAB + 2, RO - 1.4, 2, 2, 2.4, iron), box(18, FY.f2 - SLAB + 2, RO - 1.4, 2, 2, 2.4, iron));

  // ---------------------------------------------------------------- above the attic: cap, dome, branches
  const capB = bark('#6b4a2e', { seed: 51, moss: '#5c9440', mossTo: 300 });
  const capTop: Painter = (t) => (t.face === 2 ? rings(t) : capB(t));
  bk.add(3, ...discStrips(RO + 4, ROOF_Y + 28, ROOF_Y + 36, capTop, [], 6), ...discStrips(RO - 6, ROOF_Y + 36, ROOF_Y + 42, capTop, [], 6));
  bk.add(3, ...discStrips(48, ROOF_Y + 40, ROOF_Y + 92, capB, [], 8));
  // the brass observatory dome with its slit and telescope
  const DOME: [number, number, number] = [0, ROOF_Y + 40, -26];
  {
    const br = metal('#c9963a'), dk = flat('#2a2030');
    const dome: Painter = (t) => (Math.abs(t.x - DOME[0]) < 3.2 && t.z > DOME[2] - 4 && t.face !== 3 ? dk(t) : (Math.floor((Math.atan2(t.x, t.z - DOME[2]) + 4) * 4) % 2 === 0 && t.face !== 2 ? tone(ramp(0xa87a2a), lvl(t, { noise: 0 }) * 0.5) : br(t)));
    for (let y = 0; y < 24; y += 3) {
      const r = 25 * Math.sqrt(Math.max(0, 1 - (y / 25) ** 2));
      if (r > 3) bk.add(3, ...discStrips(r, DOME[1] + y, DOME[1] + y + 3, dome, [], 4).map((b) => ({ ...b, at: [b.at[0] + DOME[0], b.at[1], b.at[2] + DOME[2]] as [number, number, number] })));
    }
    bk.add(3, ...discStrips(28, DOME[1] - 2, DOME[1], wood('#6a4428', { axis: 'x', plank: 3 }), [], 4).map((b) => ({ ...b, at: [b.at[0] + DOME[0], b.at[1], b.at[2] + DOME[2]] as [number, number, number] })));
    bk.add(3, beam(DOME[0], DOME[1] + 16, DOME[2] + 4, 34, 7, 0.32, 0.7, br), beam(DOME[0] + Math.sin(0.32) * 24 * Math.cos(0.7), DOME[1] + 16 + Math.sin(0.7) * 24, DOME[2] + 4 + Math.cos(0.32) * 24 * Math.cos(0.7), 12, 9, 0.32, 0.7, metal('#e0b860')));
    bk.add(3, box(DOME[0], DOME[1] + 24, DOME[2], 4, 3, 4, br), box(DOME[0], DOME[1] + 27, DOME[2], 1.4, 6, 1.4, br), box(DOME[0], DOME[1] + 33, DOME[2], 3, 3, 3, lamp('#fff2b0'), { glow: true }));
  }
  const brB = bark('#6b4a2e', { seed: 61, axis: 'z' });
  const branchTips: [number, number, number][] = [];
  for (const [a, tilt, len, th, y] of [[-1.7, 0.32, 128, 18, 236], [1.65, 0.3, 132, 18, 238], [-0.6, 0.62, 96, 15, 252], [0.7, 0.58, 98, 15, 252], [2.6, 0.5, 104, 16, 250], [-2.5, 0.52, 104, 16, 250], [3.1, 0.72, 80, 13, 270], [0.05, 0.9, 70, 13, 280]] as const) {
    const b0 = swingPt(0, y, 34, a);
    bk.add(3, beam(b0[0], b0[1], b0[2], len, th, a, tilt, brB), beam(...swingPt(0, y + Math.sin(tilt) * len * 0.55, 34 + Math.cos(tilt) * len * 0.55, a), len * 0.45, th * 0.55, a + 0.5, tilt + 0.35, brB));
    branchTips.push(swingPt(0, y + Math.sin(tilt) * len, 34 + Math.cos(tilt) * len, a));
  }
  // lanterns strung from the lowest boughs
  for (const [x, z, h] of [[-92, 34, 18], [96, 26, 22], [-40, 62, 14]] as const) bk.add(3, box(x, 250 - h, z, 0.5, h, 0.5, cloth('#d9c7a0')), ...lantern(x, 250 - h, z, lamp('#ff9a6a'), 1.1));

  // ---------------------------------------------------------------- the canopy
  const canopy: BoxSpec[] = [];
  {
    const crown = new Crown(10);
    const cy = ROOF_Y + 96;
    crown.blob(0, cy, -16, 150, 62, 118, 3, 0.5, 0.35);
    crown.blob(-128, cy - 22, -4, 76, 48, 66, 4, 0.5, 0.15);
    crown.blob(132, cy - 26, -10, 78, 50, 64, 5, 0.5, 0.15);
    crown.blob(-64, cy + 34, -30, 86, 44, 72, 6, 0.5, 0.5);
    crown.blob(72, cy + 38, -24, 90, 44, 72, 7, 0.5, 0.5);
    crown.blob(0, cy + 56, -44, 74, 36, 62, 8, 0.5, 0.5);
    crown.blob(-100, cy - 50, 28, 46, 30, 42, 9, 0.5, 0.4);
    crown.blob(104, cy - 48, 22, 48, 32, 42, 10, 0.5, 0.4);
    crown.blob(0, cy - 40, 66, 58, 26, 30, 11, 0.5, 0.4);
    for (const [x, y, z] of branchTips) crown.blob(x, y + 6, z, 34, 24, 34, 12 + Math.round(x), 0.5, 0.45);
    // leaves at the end of the great limb
    crown.blob(tip[0] + 6, tip[1] + 18, tip[2], 30, 20, 28, 13, 0.5, 0.4);
    crown.blob(twigBase[0] + 14, twigBase[1] + 40, twigBase[2] - 10, 20, 14, 20, 14, 0.5, 0.4);
    // keep the dome and its telescope in the open
    crown.carve((x, y, z) => Math.hypot(x - DOME[0], (y - DOME[1] - 10) * 1.1, z - DOME[2]) < 40 || (y < DOME[1] + 60 && y > DOME[1] && Math.abs(x - 8) < 22 && z > DOME[2] && z < DOME[2] + 70));
    const mats = [-0.7, -0.25, 0.2, 0.65].map((lift, i) => leaves(['#4f9a3c', '#57a43f', '#468f38', '#5fae44'][i], { seed: 3 + i, bloom: i === 1 ? '#f2f6b8' : undefined, rate: 0.025, lift }));
    const strand = leaves('#3f8a36', { seed: 19, lift: -0.4 });
    crown.emit(mats, 0.32, canopy, 7, 0.32, strand);
    // the limb's leaves go with its floor band, so they hide with it in build mode
  }
  const limbLeaves = canopy.filter((b) => b.at[1] < ROOF_Y - 20);
  const canopyTop = canopy.filter((b) => b.at[1] >= ROOF_Y - 20);
  bk.add(1, ...limbLeaves.map((b) => ({ ...b, sway: 0 })));

  return {
    bk, canopy: canopyTop, panes, holes: HOLES,
    at: {
      lamp: lampAt,
      chimneyTop: swingPt(0, ROOF_Y + 66, RO + 4, CHIMNEY_A),
      porch: swingPt(0, 4, RO + 14, DOOR_A),
      balcony: swingPt(0, FY.f2, RO + 14, DOOR_A),
      platform: [P[0], P[1], P[2]],
      launch,
    },
  };
}
