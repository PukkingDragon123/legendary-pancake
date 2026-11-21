// Nature colours and the small voxel plants other models still borrow (daisies, tulips and toadstools
// for planters, pots and the house). [world3] The forest itself is hand-made lowpix models now
// (art/lowpix/world -> public/models/world, loaded by world/forestkit.ts) and Moleforge pixel grass.
import { box, lean, type BoxSpec, type Painter, type Vec3 } from '../gfx/box.ts';
import { tone } from '../gfx/color.ts';
import { hash, rng, type Rng } from '../gfx/noise.ts';
import { lvl, R, solid, type Tint } from '../gfx/mats.ts';

/** [world3] Nature colours from the calm "Moss & Moonlight" palette (src/gfx/palette.ts). Keys are stable. */
export const PAL = {
  grass: '#7a9a5c', grassLight: '#a7b788', grassDeep: '#557343',
  oak: '#5c7845', oakDeep: '#3f5a3b', birchLeaf: '#8fa66a', pine: '#3f5a44', blossom: '#e2bab8', maple: '#a6644d',
  barkOak: '#5b4a3c', barkBirch: '#e6dfcd', barkPine: '#4b3f36', barkBlossom: '#56443d',
  stone: '#908a7e', moss: '#86a06a', dirt: '#7a5f45', path: '#bfa27a', sand: '#d8c9a3',
  cream: '#f1e6cc', stem: '#66844f',
};

/** Blade/stem painter: dark at the base, bright at the tip. */
const blade = (c: Tint, from = -1.6, to = 1.6): Painter => {
  const r = R(c);
  return (t) => tone(r, from + (to - from) * (t.by / t.sy) + (t.face === 2 ? 0.5 : t.face === 1 || t.face === 5 ? -0.5 : 0));
};

/** Rotate a set of boxes together about one pivot. */
const turn = (boxes: BoxSpec[], rot: Vec3, pivot: Vec3): BoxSpec[] => boxes.map((b) => ({ ...b, rot, pivot }));

// ------------------------------------------------------------------ grass

export function grassClump(seed: number, tall = false, c: Tint = PAL.grass): BoxSpec[] {
  const r = rng(seed), out: BoxSpec[] = [];
  const mat = blade(c), tip = blade(c, 0.2, 2.2);
  const n = r.int(6, 9);
  for (let i = 0; i < n; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(0.3, 3.4);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const h = Math.round(tall ? r.range(7, 12) : r.range(3, 7));
    const tilt = r.range(8, 24);
    const rx = Math.sin(a) * tilt, rz = -Math.cos(a) * tilt;
    const w = r.chance(0.35) ? 2 : 1;
    const lower = Math.max(2, Math.round(h * 0.6));
    out.push(lean(box(x, 0, z, w, lower, 1, mat, { sway: 1, skip: 'd' }), rx, 0, rz));
    if (h - lower >= 1) {
      // upper segment bends further out, giving each blade a curve
      const k = (tilt * Math.PI) / 180;
      const tx = x + Math.cos(a) * Math.sin(k) * lower, tz = z + Math.sin(a) * Math.sin(k) * lower, ty = Math.cos(k) * lower - 0.3;
      out.push(lean(box(tx, ty, tz, 1, h - lower + 1, 1, tip, { sway: 1, skip: 'd' }), rx * 2, 0, rz * 2));
    }
  }
  return out;
}

/** Fern: arcing fronds built from stepped segments. */
export function fern(seed: number, c: Tint = '#4f9e45'): BoxSpec[] {
  const r = rng(seed), out: BoxSpec[] = [];
  const mat = blade(c, -1.2, 1.4);
  const n = r.int(5, 7);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r.range(-0.3, 0.3);
    const cs = Math.cos(a), sn = Math.sin(a);
    let x = cs * 0.8, z = sn * 0.8, y = 0;
    const len = r.int(3, 4);
    for (let s = 0; s < len; s++) {
      const pitch = 62 - s * 26; // degrees above horizontal, arcing over
      const k = (pitch * Math.PI) / 180;
      const seg = 3.2;
      const w = s === len - 1 ? 2 : 3;
      out.push({
        ...box(x, y, z, w, 1, seg + 0.6, mat, { sway: 0.8 }),
        rot: [-pitch, (-a * 180) / Math.PI + 90, 0], pivot: [x, y, z],
      });
      x += cs * Math.cos(k) * seg; z += sn * Math.cos(k) * seg; y += Math.sin(k) * seg;
    }
  }
  return out;
}

// ------------------------------------------------------------------ flowers
// [world] Wildflowers are small and delicate: each patch is a little clump of thin one-pixel stems
// carrying many tiny blooms, instead of one big blocky flower.

const stemMat = blade(PAL.stem, -1.2, 0.8);
const leafMat = blade('#5c7845', -0.6, 1.2);

type Head = (x: number, h: number, z: number, i: number, r: Rng) => BoxSpec[];

/** A clump of `n` thin stems with heads, each leaning its own way. */
function clump(seed: number, n: number, spread: number, hMin: number, hMax: number, head: Head, leafy = 0.6): BoxSpec[] {
  const r = rng(seed), out: BoxSpec[] = [];
  for (let i = 0; i < n; i++) {
    const a = r.range(0, Math.PI * 2), d = Math.sqrt(r()) * spread;
    const x = Math.round(Math.cos(a) * d * 2) / 2, z = Math.round(Math.sin(a) * d * 2) / 2;
    const h = r.int(hMin, hMax), tilt = r.range(-14, 14);
    const stalk: BoxSpec[] = [box(x, 0, z, 1, h, 1, stemMat, { sway: 1, skip: 'd' })];
    if (r() < leafy) {
      const s = r.chance(0.5) ? 1 : -1, y = Math.max(1, Math.round(h * r.range(0.2, 0.45)));
      stalk.push(lean(box(x + s * 1.2, y, z, 2, 1, 1, leafMat, { sway: 1 }), 0, 0, s * 30));
    }
    stalk.push(...head(x, h, z, i, r));
    out.push(...turn(stalk, [tilt, r.range(-20, 20), tilt * 0.6], [x, 0, z]));
  }
  // a few low leaves at the base
  for (let i = 0; i < 3; i++) {
    const a = r.range(0, Math.PI * 2);
    out.push({ ...box(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4, 1, 1, 3, leafMat, { sway: 0.6 }), rot: [-35, (-a * 180) / Math.PI + 90, 0], pivot: [0, 0, 0] });
  }
  return out;
}

const petalMat = (c: Tint) => solid(c, { noise: 0.25, rim: 0.4, speck: 0.3 });

export function daisy(seed: number, petal: Tint = '#f4eedd', centre: Tint = '#dcb072'): BoxSpec[] {
  const p = petalMat(petal), c = solid(centre, { noise: 0.4 });
  // a plus of petals round a raised yellow eye (three boxes per bloom)
  return clump(seed, 7, 3.2, 4, 8, (x, h, z) => [
    box(x, h, z, 1, 1, 1, c, { sway: 1, skip: 'd' }),
    box(x, h - 0.2, z, 3, 0.6, 1, p, { sway: 1, skip: 'd' }), box(x, h - 0.2, z, 1, 0.6, 3, p, { sway: 1, skip: 'd' }),
  ]);
}

export function tulip(seed: number, c: Tint = '#c0866a'): BoxSpec[] {
  const rr = R(c);
  const cup: Painter = (t) => tone(rr, lvl(t, { noise: 0.3 }) + (t.by / t.sy - 0.4) * 1.6);
  const tip: Painter = (t) => tone(rr, 1.4 + (t.face === 2 ? 0.5 : 0));
  return clump(seed, 4, 2.6, 6, 9, (x, h, z) => [
    box(x, h, z, 2, 2, 2, cup, { sway: 1 }),
    box(x - 0.5, h + 2, z - 0.5, 1, 1, 1, tip, { sway: 1 }), box(x + 0.5, h + 2, z + 0.5, 1, 1, 1, tip, { sway: 1 }),
  ], 0.9);
}


// ------------------------------------------------------------------ mushrooms

function capMat(c: Tint, o: { spots?: Tint; seed?: number; gills?: Tint } = {}): Painter {
  const r = R(c), sp = o.spots ? R(o.spots) : null, g = R(o.gills ?? PAL.cream), seed = o.seed ?? 0;
  return (t) => {
    if (t.face === 3) return tone(g, (Math.floor(t.u) % 2 ? -1.4 : 0) - 0.4);
    const L = lvl(t, { noise: 0.5, scale: 3 });
    if (sp && t.face !== 3) {
      const cx = Math.floor(t.x / 2.5), cz = Math.floor(t.z / 2.5), cy = Math.floor(t.y / 2.5);
      const h = hash(cx, cy, cz, seed);
      if (h > 0.62 && hash(Math.floor(t.x), Math.floor(t.y), Math.floor(t.z), seed + 1) > 0.42) return tone(sp, L * 0.4 + 0.5);
    }
    return tone(r, L);
  };
}
const stalk = (c: Tint = PAL.cream): Painter => {
  const r = R(c);
  return (t) => tone(r, lvl(t, { noise: 0.4 }) + (Math.floor(t.bx + t.bz) % 3 === 0 ? -0.5 : 0));
};

/** Classic spotted toadstool with a ringed stem and a two-tier domed cap. */
export function toadstool(seed: number, c: Tint = '#b0644f', scale = 1): BoxSpec[] {
  const r = rng(seed), s = scale;
  const cap = capMat(c, { spots: '#f1e6cc', seed });
  const h = Math.round(r.int(4, 6) * s), w = Math.round(7 * s);
  return [
    box(0, 0, 0, Math.max(2, Math.round(2 * s)), h, Math.max(2, Math.round(2 * s)), stalk(), { skip: 'd' }),
    box(0, Math.round(h * 0.55), 0, Math.round(3 * s) + 1, 1, Math.round(3 * s) + 1, solid(PAL.cream, { noise: 0.2 })),
    box(0, h, 0, w, Math.max(2, Math.round(2 * s)), w, cap),
    box(0, h + Math.max(2, Math.round(2 * s)), 0, w - 2, Math.max(1, Math.round(1.5 * s)), w - 2, cap, { skip: 'd' }),
    ...(s > 1.2 ? [box(0, h + Math.round(3.5 * s), 0, w - 5, 1, w - 5, cap, { skip: 'd' })] : []),
  ];
}


// ------------------------------------------------------------------ leaf kinds
// [world3] The forest trees, bushes, rocks, logs and mushroom clusters are lowpix models now
// (art/lowpix/world, loaded by world/forestkit.ts); their leaf masses live in nature/shapes.json.

export type LeafKind = 'oak' | 'birch' | 'pine' | 'maple' | 'blossom' | 'bush' | 'berry' | 'flowerbush';
export interface Blob { x: number; y: number; z: number; rx: number; ry: number; rz: number }
