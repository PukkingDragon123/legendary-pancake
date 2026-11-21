// Forest kit: every plant is built from real boxes with painted pixel textures. Trees and bushes
// also describe their leaf masses so the world can dress them in 2D pixel leaf cards (see foliage.ts).
import { box, lean, type BoxSpec, type Painter, type Vec3 } from '../gfx/box.ts';
import { ramp, tone, type Ramp } from '../gfx/color.ts';
import { bark, flat, leaves, lvl, R, rock, smooth, solid, type Tint } from '../gfx/mats.ts';
import { hash, rng, type Rng } from '../gfx/noise.ts';

export const PAL = {
  grass: '#5cab3a', grassLight: '#8fd24e', grassDeep: '#3d8c3c',
  oak: '#4c9b3b', oakDeep: '#2f7a40', birchLeaf: '#9ccb3f', pine: '#2c7556', blossom: '#f5a3bd', maple: '#ee8a2e',
  barkOak: '#7b5235', barkBirch: '#ebe5d6', barkPine: '#5e3e2f', barkBlossom: '#5a4038',
  stone: '#8e93a2', moss: '#69a848', dirt: '#8a5b3d', path: '#c8a26a', sand: '#e2cf96',
  cream: '#f3e6cc', stem: '#5aa83f',
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
const leafMat = blade('#4c9f3c', -0.6, 1.2);

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

export function daisy(seed: number, petal: Tint = '#fbfaf2', centre: Tint = '#f5c12f'): BoxSpec[] {
  const p = petalMat(petal), c = solid(centre, { noise: 0.4 });
  // a plus of petals round a raised yellow eye (three boxes per bloom)
  return clump(seed, 7, 3.2, 4, 8, (x, h, z) => [
    box(x, h, z, 1, 1, 1, c, { sway: 1, skip: 'd' }),
    box(x, h - 0.2, z, 3, 0.6, 1, p, { sway: 1, skip: 'd' }), box(x, h - 0.2, z, 1, 0.6, 3, p, { sway: 1, skip: 'd' }),
  ]);
}

export function tulip(seed: number, c: Tint = '#e9463f'): BoxSpec[] {
  const rr = R(c);
  const cup: Painter = (t) => tone(rr, lvl(t, { noise: 0.3 }) + (t.by / t.sy - 0.4) * 1.6);
  const tip: Painter = (t) => tone(rr, 1.4 + (t.face === 2 ? 0.5 : 0));
  return clump(seed, 4, 2.6, 6, 9, (x, h, z) => [
    box(x, h, z, 2, 2, 2, cup, { sway: 1 }),
    box(x - 0.5, h + 2, z - 0.5, 1, 1, 1, tip, { sway: 1 }), box(x + 0.5, h + 2, z + 0.5, 1, 1, 1, tip, { sway: 1 }),
  ], 0.9);
}

export function bluebell(seed: number, c: Tint = '#7281ea'): BoxSpec[] {
  const rr = R(c);
  const bell: Painter = (t) => tone(rr, lvl(t, { noise: 0.2 }) + (t.by / t.sy - 0.5) * 1.4);
  return clump(seed, 4, 2.4, 6, 9, (x, h, z, _i, r) => {
    const out: BoxSpec[] = [{ ...box(x + 1, h - 1, z, 1, 3, 1, stemMat, { sway: 1 }), rot: [0, 0, -55], pivot: [x + 0.5, h - 1, z] }];
    for (let k = 0; k < 3; k++) out.push(box(x + 1.2 + k * 0.9, h - 2.2 - k * 1.1 + r.range(-0.2, 0.2), z, 1, 1.4, 1, bell, { sway: 1 }));
    return out;
  }, 0.4);
}

export function lavender(seed: number, c: Tint = '#a67ce2'): BoxSpec[] {
  const rr = R(c);
  const bud: Painter = (t) => tone(rr, lvl(t, { noise: 0.8, scale: 1.4 }) + (t.y > 8 ? 0.7 : 0));
  return clump(seed, 6, 2.6, 5, 8, (x, h, z) => {
    const out: BoxSpec[] = [];
    for (let k = 0; k < 4; k++) out.push(box(x + (k & 1 ? 0.35 : -0.35), h + k * 0.9, z, 1, 1, 1, bud, { sway: 1 }));
    return out;
  }, 0.2);
}

export function poppy(seed: number, c: Tint = '#f0683a'): BoxSpec[] {
  const rr = R(c);
  const petal: Painter = (t) => tone(rr, lvl(t, { noise: 0.3 }) + (t.face === 2 ? 0.5 : -0.3));
  const dark = flat('#2c2430');
  return clump(seed, 4, 2.8, 6, 9, (x, h, z) => [
    box(x, h, z, 3, 1, 3, petal, { sway: 1 }),
    box(x, h + 1, z, 1, 0.5, 1, dark, { sway: 1 }),
    lean(box(x + 1.6, h + 0.3, z, 1, 1, 2, petal, { sway: 1 }), 0, 0, -30), lean(box(x - 1.6, h + 0.3, z, 1, 1, 2, petal, { sway: 1 }), 0, 0, 30),
  ], 0.5);
}

/** Forget-me-nots: a froth of tiny blue flowers on short stems. */
export function forgetMeNot(seed: number, c: Tint = '#7fb4f2'): BoxSpec[] {
  const p = petalMat(c), eye = solid('#f6e27a', { noise: 0 });
  return clump(seed, 8, 3.4, 3, 5, (x, h, z, i) => i % 3 === 0
    ? [box(x, h, z, 2, 1, 2, p, { sway: 1 }), box(x, h + 0.2, z, 1, 1, 1, eye, { sway: 1, skip: 'd' })]
    : [box(x, h, z, 1, 1, 1, p, { sway: 1 }), box(x + 1, h - 1, z + 0.5, 1, 1, 1, p, { sway: 1 })], 0.3);
}

/** Buttercups: shiny yellow cups held high. */
export function buttercup(seed: number, c: Tint = '#f7d23a'): BoxSpec[] {
  const p = petalMat(c);
  return clump(seed, 6, 3, 5, 9, (x, h, z) => [box(x, h, z, 2, 1, 2, p, { sway: 1 }), box(x, h + 1, z, 1, 0.5, 1, solid('#f9e78a', { noise: 0 }), { sway: 1 })], 0.5);
}

export function sunflower(seed: number): BoxSpec[] {
  const r = rng(seed), out: BoxSpec[] = [];
  const h = r.int(14, 17);
  out.push(box(0, 0, 0, 1, h, 1, blade('#5a9e3a', -1.2, 0.6), { sway: 0.7, skip: 'd' }));
  for (const [y, s] of [[4, 1], [8, -1], [11, 1]] as const) out.push(lean(box(s * 2, y, 0, 3, 1, 2, leafMat, { sway: 0.7 }), 0, 0, s * 24));
  const pr = ramp(0xf7c531), cr = ramp(0x7a4a28);
  const disc: Painter = (t) => {
    const dx = t.bx - t.sx / 2, dy = t.by - t.sy / 2, d = Math.hypot(dx, dy);
    if (t.face === 4 || t.face === 5) {
      if (d < 2) return tone(cr, (hash(t.u, t.v, 0, seed) > 0.6 ? 1 : -0.4) + (d < 1 ? -0.8 : 0));
      const ang = Math.atan2(dy, dx), spoke = Math.cos(ang * 6);
      if (d > 3.6 || (d > 2.8 && spoke < -0.1)) return -1;
      return tone(pr, spoke > 0.5 ? 1.2 : spoke < 0 ? -1.2 : 0);
    }
    return d > 3 ? -1 : tone(pr, -1);
  };
  out.push({ ...box(0, h - 2, 0.6, 7, 7, 1, disc, { sway: 0.7, cut: true }), rot: [-22, r.range(-20, 20), 0], pivot: [0, h, 0] });
  return out;
}

/** Low ground cover: clover leaves with the odd tiny blossom. */
export function clover(seed: number, bloom: Tint = '#fff6d8'): BoxSpec[] {
  const r = rng(seed), out: BoxSpec[] = [];
  const leaf = solid('#57a83e', { noise: 0.6, scale: 1.5 }), b = solid(bloom, { noise: 0.2 });
  for (let i = 0; i < 6; i++) {
    const x = r.range(-4, 4), z = r.range(-4, 4), y = r.range(0.6, 2);
    out.push(box(x, 0, z, 1, y, 1, stemMat, { skip: 'd', sway: 1 }));
    out.push(box(x - 1, y, z, 2, 1, 1, leaf, { sway: 1 }), box(x + 0.5, y, z + 1, 1, 1, 2, leaf, { sway: 1 }), box(x + 0.6, y, z - 0.8, 2, 1, 1, leaf, { sway: 1 }));
    if (r.chance(0.3)) out.push(box(x + r.range(-2, 2), 0, z + r.range(-2, 2), 1, 3, 1, stemMat, { sway: 1 }), box(x, 3, z, 1, 1, 1, b, { sway: 1 }));
  }
  return out;
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
export function toadstool(seed: number, c: Tint = '#da4230', scale = 1): BoxSpec[] {
  const r = rng(seed), s = scale;
  const cap = capMat(c, { spots: '#fff8ea', seed });
  const h = Math.round(r.int(4, 6) * s), w = Math.round(7 * s);
  return [
    box(0, 0, 0, Math.max(2, Math.round(2 * s)), h, Math.max(2, Math.round(2 * s)), stalk(), { skip: 'd' }),
    box(0, Math.round(h * 0.55), 0, Math.round(3 * s) + 1, 1, Math.round(3 * s) + 1, solid(PAL.cream, { noise: 0.2 })),
    box(0, h, 0, w, Math.max(2, Math.round(2 * s)), w, cap),
    box(0, h + Math.max(2, Math.round(2 * s)), 0, w - 2, Math.max(1, Math.round(1.5 * s)), w - 2, cap, { skip: 'd' }),
    ...(s > 1.2 ? [box(0, h + Math.round(3.5 * s), 0, w - 5, 1, w - 5, cap, { skip: 'd' })] : []),
  ];
}

/** Plump brown bolete: thick stem, bun cap. */
export function bolete(seed: number, c: Tint = '#a96a3b'): BoxSpec[] {
  const r = rng(seed), cap = capMat(c, { gills: '#f1d9a0', seed });
  const h = r.int(3, 4);
  return [
    box(0, 0, 0, 4, h, 4, stalk('#f0dfc0'), { skip: 'd' }),
    box(0, 0, 0, 5, 2, 5, stalk('#ead2ab'), { skip: 'd' }),
    box(0, h, 0, 8, 2, 8, cap), box(0, h + 2, 0, 6, 2, 6, cap, { skip: 'd' }), box(0, h + 4, 0, 3, 1, 3, cap, { skip: 'd' }),
  ];
}

/** A cluster of thin-stemmed flat caps at different heights. */
export function chanterelles(seed: number, c: Tint = '#f08b2b'): BoxSpec[] {
  const r = rng(seed), out: BoxSpec[] = [];
  const cap = capMat(c, { gills: '#ffd58a', seed }), st = stalk('#fbe3a8');
  const spots: [number, number, number, number][] = [[0, 0, 7, 5], [4, 2, 4, 4], [-3, 3, 5, 3], [-4, -3, 3, 3], [3, -3, 2, 3]];
  for (const [x, z, h, w] of spots) {
    const hh = h + r.int(-1, 1), tilt = r.range(-10, 10);
    out.push(...turn([
      box(x, 0, z, 1, hh, 1, st, { skip: 'd' }),
      box(x, hh, z, w, 1, w, cap), box(x, hh + 1, z, Math.max(1, w - 2), 1, Math.max(1, w - 2), cap, { skip: 'd' }),
    ], [tilt, 0, tilt * 0.7], [x, 0, z]));
  }
  return out;
}

/** Small glowing caps for night-time. */
export function glowshroom(seed: number, c: Tint = '#69d7f3'): BoxSpec[] {
  const r = rng(seed), out: BoxSpec[] = [];
  const rr = R(c);
  const cap: Painter = (t) => (t.face === 3 ? tone(rr, -2) : tone(rr, 0.6 + (hash(Math.floor(t.x), Math.floor(t.y), Math.floor(t.z), seed) > 0.7 ? 1.6 : 0) + (t.face === 2 ? 0.8 : 0)));
  for (const [x, z, h] of [[0, 0, 5], [3, 1, 3], [-2, 2, 2], [-1, -3, 4]] as const) {
    const hh = h + r.int(0, 1);
    out.push(box(x, 0, z, 1, hh, 1, stalk('#d7e8f2'), { skip: 'd' }), box(x, hh, z, 3, 2, 3, cap, { glow: true }), box(x, hh + 2, z, 1, 1, 1, cap, { glow: true, skip: 'd' }));
  }
  return out;
}

/** Bracket fungi that grow out of a vertical surface facing +z. */
export function shelfFungus(seed: number, c: Tint = '#d99a52'): BoxSpec[] {
  const cap = capMat(c, { gills: '#f6e2b8', seed });
  return [box(0, 0, 1.5, 6, 1, 3, cap), box(0, 1, 1, 4, 1, 2, cap, { skip: 'd' }), box(2, 3, 1, 4, 1, 2, cap), box(-2, -3, 1.5, 5, 1, 3, cap)];
}

// ------------------------------------------------------------------ bushes, rocks, logs

/** Voxel volume: unions of rough ellipsoids on a grid, emitted as cubes with hidden faces dropped. */
class Vox {
  private set = new Set<number>();
  cells: [number, number, number][] = [];
  constructor(public cell: number, public ox = 0, public oy = 0, public oz = 0) {}
  private key(i: number, j: number, k: number) { return (i + 64) | ((j + 64) << 8) | ((k + 64) << 16); }
  has(i: number, j: number, k: number) { return this.set.has(this.key(i, j, k)); }
  add(i: number, j: number, k: number) {
    const key = this.key(i, j, k);
    if (!this.set.has(key)) { this.set.add(key); this.cells.push([i, j, k]); }
  }
  /** Fill an ellipsoid (px, relative to the origin). `cut` trims the underside: 0 keeps it whole, 1 slices at the centre. */
  blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, seed: number, rough = 0.4, cut = 0.5) {
    const c = this.cell;
    for (let i = Math.floor((cx - rx) / c); i <= Math.ceil((cx + rx) / c); i++)
      for (let j = Math.floor((cy - ry) / c); j <= Math.ceil((cy + ry) / c); j++)
        for (let k = Math.floor((cz - rz) / c); k <= Math.ceil((cz + rz) / c); k++) {
          const x = (i + 0.5) * c - cx, y = (j + 0.5) * c - cy, z = (k + 0.5) * c - cz;
          if (y < -ry * (1 - cut)) continue;
          const d = (x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2;
          if (d + (hash(i, j, k, seed) - 0.5) * rough * 2 < 1) this.add(i, j, k);
        }
    return this;
  }
  emit(mats: Painter[], sway: number, out: BoxSpec[], seed: number, tufts = 0.22, strands?: Painter) {
    const c = this.cell;
    const dirs: [number, number, number, string][] = [[1, 0, 0, 'e'], [-1, 0, 0, 'w'], [0, 1, 0, 'u'], [0, -1, 0, 'd'], [0, 0, 1, 's'], [0, 0, -1, 'n']];
    for (const [i, j, k] of this.cells) {
      let skip = '';
      for (const [dx, dy, dz, f] of dirs) if (this.has(i + dx, j + dy, k + dz)) skip += f;
      if (skip.length === 6) continue;
      const h = hash(i, j, k, seed + 11);
      const mat = mats[Math.floor(h * mats.length)];
      const x = this.ox + (i + 0.5) * c, y = this.oy + j * c, z = this.oz + (k + 0.5) * c;
      out.push(box(x, y, z, c, c, c, mat, { sway, skip }));
      // small cubes perched on exposed faces soften the silhouette
      const h2 = hash(i, j, k, seed + 12);
      if (h2 < tufts) {
        const open = dirs.filter((d) => d[3] !== 'd' && !skip.includes(d[3]));
        if (open.length) {
          const [dx, dy, dz] = open[Math.floor(hash(i, j, k, seed + 13) * open.length)];
          const s = Math.max(2, Math.round(c * (0.4 + hash(i, j, k, seed + 14) * 0.25)));
          const off = (c + s) / 2 - 0.5, jx = (hash(i, j, k, seed + 15) - 0.5) * (c - s), jz = (hash(i, j, k, seed + 16) - 0.5) * (c - s);
          out.push(box(x + dx * off + (dx ? 0 : jx), y + c / 2 - s / 2 + dy * off + (dy ? 0 : jx * 0.5), z + dz * off + (dz ? 0 : jz), s, s, s, mat, { sway: sway * 1.3 }));
        }
      }
      if (strands && !skip.includes('d') && hash(i, j, k, seed + 17) < 0.28) {
        const len = 3 + Math.floor(hash(i, j, k, seed + 18) * 8);
        out.push(box(x + (hash(i, j, k, seed + 19) - 0.5) * (c - 2), y - len, z + (hash(i, j, k, seed + 20) - 0.5) * (c - 2), 2, len + 1, 1, strands, { sway: sway * 2.5, skip: 'u' }));
      }
    }
  }
}

export function boulder(seed: number, c: Tint = PAL.stone, moss: Tint | undefined = PAL.moss): BoxSpec[] {
  const r = rng(seed);
  const mat = rock(c, { seed, moss });
  const out: BoxSpec[] = [
    { ...box(0, -1, 0, 11, 8, 9, mat), rot: [r.range(-6, 6), r.range(-25, 25), r.range(-6, 6)] },
    { ...box(5, -1, 3, 7, 5, 7, mat), rot: [0, r.range(10, 40), r.range(-8, 8)] },
    { ...box(-5, -1, 3, 5, 4, 6, mat), rot: [r.range(-8, 8), r.range(-40, -10), 0] },
    { ...box(1, 5, -1, 6, 4, 5, mat), rot: [r.range(-10, 10), r.range(-30, 30), r.range(-10, 10)] },
  ];
  if (r.chance(0.5)) out.push({ ...box(-6, -1, -4, 4, 3, 4, mat), rot: [0, r.range(0, 45), 0] });
  return out;
}

export function pebbles(seed: number, c: Tint = '#9a9eab'): BoxSpec[] {
  const r = rng(seed), mat = rock(c, { seed }), out: BoxSpec[] = [];
  for (let i = 0; i < 4; i++) {
    const s = r.int(2, 4);
    out.push({ ...box(r.range(-5, 5), -0.5, r.range(-5, 5), s, Math.max(1, s - 1), s, mat), rot: [0, r.range(0, 90), 0] });
  }
  return out;
}

const woodEnd = (c: Tint): Painter => {
  const r = R(c);
  return (t) => {
    const d = Math.max(Math.abs(t.u + 0.5 - t.w / 2), Math.abs(t.v + 0.5 - t.h / 2));
    return tone(r, (Math.floor(d) % 2 ? -0.8 : 0.5) + (d < 1 ? -1 : 0) + (d > Math.min(t.w, t.h) / 2 - 1 ? -1.6 : 0));
  };
};

export function fallenLog(seed: number): BoxSpec[] {
  const r = rng(seed);
  const b = bark(PAL.barkOak, { seed, moss: PAL.moss, axis: 'x', mossTo: 40 });
  const logMat: Painter = (t) => (t.face < 2 ? woodEnd('#d7a568')(t) : b(t));
  const hollow = flat('#2a1c18');
  const out: BoxSpec[] = [
    box(0, 0, 0, 26, 9, 9, logMat),
    box(13.1, 2, 0, 1, 5, 5, hollow, { skip: 'w' }),
    { ...box(-6, 6, 2, 3, 6, 3, bark(PAL.barkOak, { seed: seed + 1 })), rot: [20, 0, -25] },
    { ...box(6, 0, -5, 4, 4, 7, bark(PAL.barkOak, { seed: seed + 2, axis: 'z' })), rot: [0, 20, 0] },
  ];
  out.push(...toadstool(seed + 3, '#da4230', 0.8).map((x) => ({ ...x, at: [x.at[0] - 9, x.at[1] + 9, x.at[2] + 1] as Vec3 })));
  out.push(...chanterelles(seed + 4).map((x) => ({ ...x, at: [x.at[0] + 3, x.at[1] + 9, x.at[2] - 1] as Vec3, pivot: x.pivot ? ([x.pivot[0] + 3, x.pivot[1] + 9, x.pivot[2] - 1] as Vec3) : undefined })));
  if (r.chance(0.7)) out.push(...grassClump(seed + 5).map((x) => ({ ...x, at: [x.at[0] + 10, x.at[1], x.at[2] + 6] as Vec3, pivot: x.pivot ? ([x.pivot[0] + 10, x.pivot[1], x.pivot[2] + 6] as Vec3) : undefined })));
  return out;
}

export function stump(seed: number): BoxSpec[] {
  const r = rng(seed);
  const b = bark(PAL.barkOak, { seed, moss: PAL.moss, mossTo: 9 });
  const top = woodEnd('#d9a966');
  const mat: Painter = (t) => (t.face === 2 ? top(t) : b(t));
  const out: BoxSpec[] = [box(0, 0, 0, 11, 7, 11, mat, { skip: 'd' })];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r.range(-0.3, 0.3);
    out.push({ ...box(Math.cos(a) * 6, -1, Math.sin(a) * 6, 4, 4, 7, b), rot: [-28, (-a * 180) / Math.PI + 90, 0] });
  }
  return out;
}

// ------------------------------------------------------------------ trees
// [world] Every tree and bush comes in three parts: the wood (trunk, roots, limbs reaching into each
// leaf mass, twigs), the crown (irregular voxel leaf masses with gaps between them, which the
// seasons recolour or strip bare) and the canopy blobs over which the world scatters hand-painted
// 2D pixel leaf cards, so silhouettes come out fluffy and broken instead of boxy.

export type LeafKind = 'oak' | 'birch' | 'pine' | 'maple' | 'blossom' | 'bush' | 'berry' | 'flowerbush';
export interface Blob { x: number; y: number; z: number; rx: number; ry: number; rz: number }
export interface PlantModel {
  wood: BoxSpec[];
  crown: BoxSpec[];
  blobs: Blob[];
  leaf: LeafKind;
  /** px height that normalises wind sway (shared by wood, crown and leaf cards) */
  top: number;
  /** wind weight at the top of the crown */
  sway: number;
  /** the crown's painted colour (the seasons recolour from its brightness) */
  base: string;
}

interface TreeStyle { bark: Tint; leaf: string; bloom?: Tint; rate?: number; moss?: boolean }

function trunkAndRoots(r: Rng, seed: number, s: TreeStyle, h: number, w: number, out: BoxSpec[]): [number, number] {
  const b = bark(s.bark, { seed, moss: s.moss ? PAL.moss : undefined, mossTo: 16 });
  let x = 0, z = 0, y = 0, ww = w;
  const segs = Math.ceil(h / 11);
  for (let i = 0; i < segs; i++) {
    const sh = Math.min(11, h - y) + 1;
    out.push({ ...box(x, y, z, ww, sh, ww, b, { skip: 'd' }), rot: [r.range(-3, 3), r.range(-8, 8), r.range(-3, 3)] });
    y += sh - 1; x += r.range(-1.2, 1.2); z += r.range(-1.2, 1.2); ww = Math.max(5, ww - 1.5);
  }
  const n = r.int(4, 6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r.range(-0.35, 0.35), len = r.range(8, 12);
    out.push({ ...box(Math.cos(a) * (w * 0.45), -1.5, Math.sin(a) * (w * 0.45), 4, 5, len, b), rot: [-24, (-a * 180) / Math.PI + 90, 0], pivot: [Math.cos(a) * w * 0.2, 3, Math.sin(a) * w * 0.2] });
  }
  return [x, z];
}

const strand = (c: Tint): Painter => blade(c, 0.4, -1.5);

/** A limb growing from a point (azimuth in radians, pitch in degrees above level), bending upwards
 *  by `bend` degrees halfway and tapering; returns its tip. */
function limb(out: BoxSpec[], mat: Painter, x: number, y: number, z: number, az: number, pitch: number, len: number, w: number, bend = 10): [number, number, number] {
  const seg = (sx: number, sy: number, sz: number, l: number, ww: number, p: number): [number, number, number] => {
    out.push({ ...box(sx, sy - ww / 2, sz + l / 2, ww, ww, l + 1, mat), rot: [-p, (az * 180) / Math.PI, 0], pivot: [sx, sy, sz] });
    const k = (p * Math.PI) / 180;
    return [sx + Math.sin(az) * Math.cos(k) * l, sy + Math.sin(k) * l, sz + Math.cos(az) * Math.cos(k) * l];
  };
  if (w <= 2 || len < 7) return seg(x, y, z, len, w, pitch);
  const m = seg(x, y, z, len * 0.55, w, pitch);
  return seg(m[0], m[1], m[2], len * 0.45, Math.max(2, w - 1), Math.min(85, pitch + bend));
}

const leafSet = (c: Tint, seed: number, bloom?: Tint, rate?: number): Painter[] =>
  [-0.7, -0.25, 0.2, 0.65].map((lift) => leaves(c, { seed, bloom, rate, lift }));

interface Shape { h: [number, number]; limbs: [number, number]; reach: [number, number]; pitch: [number, number]; blob: [number, number]; cell: number; trunk: number; leaf: LeafKind; flat?: number }

/** Broadleaf trees: a trunk splitting into limbs, each ending in its own leaf mass. */
function broadleaf(seed: number, s: TreeStyle, o: Shape): PlantModel {
  const r = rng(seed), wood: BoxSpec[] = [], crown: BoxSpec[] = [], blobs: Blob[] = [];
  const h = r.int(o.h[0], o.h[1]);
  const [tx, tz] = trunkAndRoots(r, seed, s, h, o.trunk, wood);
  const b = bark(s.bark, { seed: seed + 1, moss: s.moss ? PAL.moss : undefined, mossTo: 4 });
  const n = r.int(o.limbs[0], o.limbs[1]), a0 = r.range(0, Math.PI * 2);
  const flat = o.flat ?? 0.7;
  for (let i = 0; i < n; i++) {
    const az = a0 + (i / n) * Math.PI * 2 + r.range(-0.35, 0.35);
    const y0 = h * r.range(0.55, 0.88), pitch = r.range(o.pitch[0], o.pitch[1]), len = r.range(o.reach[0], o.reach[1]);
    const tip = limb(wood, b, tx, y0, tz, az, pitch, len, Math.max(3, Math.round(o.trunk * 0.38)), r.range(4, 16));
    const rad = r.range(o.blob[0], o.blob[1]);
    blobs.push({ x: tip[0], y: tip[1] + rad * 0.2, z: tip[2], rx: rad, ry: rad * r.range(flat - 0.08, flat + 0.08), rz: rad * r.range(0.85, 1.1) });
    // twigs poke out of every leaf mass (and are all that is left in winter)
    for (let k = 0; k < 3; k++) limb(wood, b, tip[0], tip[1], tip[2], az + r.range(-1.3, 1.3), r.range(-5, 55), r.range(5, rad * 0.85), 2);
  }
  // the crown over the trunk top, a leader into it and a couple of inner masses for depth
  const topR = r.range(o.blob[0], o.blob[1]) * 1.12;
  limb(wood, b, tx, h - 3, tz, r.range(0, Math.PI * 2), 72, topR * 0.7, Math.max(3, Math.round(o.trunk * 0.4)), 6);
  blobs.push({ x: tx + r.range(-2, 2), y: h + topR * 0.5, z: tz + r.range(-2, 2), rx: topR, ry: topR * flat, rz: topR * r.range(0.9, 1.05) });
  for (let i = 0; i < 2; i++) {
    const a = r.range(0, Math.PI * 2), d = r.range(5, 11), rad = r.range(o.blob[0], o.blob[1]) * 0.75;
    blobs.push({ x: tx + Math.cos(a) * d, y: h * r.range(0.85, 1.05) + rad * 0.3, z: tz + Math.sin(a) * d, rx: rad, ry: rad * flat, rz: rad });
  }
  const v = new Vox(o.cell);
  blobs.forEach((bl, i) => v.blob(bl.x, bl.y, bl.z, bl.rx * 0.8, bl.ry * 0.8, bl.rz * 0.8, seed + 10 + i, 0.55, 0.4));
  v.emit(leafSet(s.leaf, seed, s.bloom, s.rate), 0.3, crown, seed, 0.3);
  const top = Math.max(...blobs.map((bl) => bl.y + bl.ry));
  return { wood, crown, blobs, leaf: o.leaf, top, sway: 0.3, base: s.leaf };
}

export function oak(seed: number, leaf = PAL.oak): PlantModel {
  return broadleaf(seed, { bark: PAL.barkOak, leaf, moss: true }, { h: [40, 48], limbs: [4, 5], reach: [20, 27], pitch: [22, 42], blob: [14, 18], cell: 5, trunk: 12, leaf: 'oak' });
}
export function maple(seed: number): PlantModel {
  return broadleaf(seed, { bark: '#6a4a3a', leaf: PAL.maple }, { h: [36, 42], limbs: [4, 5], reach: [16, 22], pitch: [32, 50], blob: [13, 17], cell: 5, trunk: 10, leaf: 'maple', flat: 0.82 });
}
export function blossomTree(seed: number): PlantModel {
  return broadleaf(seed, { bark: PAL.barkBlossom, leaf: PAL.blossom, bloom: '#fff3f8', rate: 0.1 }, { h: [26, 32], limbs: [4, 5], reach: [19, 25], pitch: [18, 34], blob: [11, 15], cell: 4, trunk: 9, leaf: 'blossom', flat: 0.62 });
}

export function birch(seed: number): PlantModel {
  const r = rng(seed), wood: BoxSpec[] = [], crown: BoxSpec[] = [], blobs: Blob[] = [];
  const bk = R(PAL.barkBirch), mark = R('#3a3532');
  const mat: Painter = (t) => {
    const L = lvl(t, { noise: 0.4, scale: 3 });
    const row = Math.floor(t.y / 3);
    const h = hash(row, t.face, 0, seed);
    if (h > 0.5 && Math.floor(t.y) % 3 === 0 && hash(Math.floor(t.face < 2 ? t.z : t.x), row, 1, seed) > 0.35) return tone(mark, L * 0.3);
    return tone(bk, L);
  };
  const h = r.int(54, 64);
  let x = 0, z = 0, y = 0, w = 7;
  while (y < h) {
    const sh = Math.min(13, h - y) + 1;
    wood.push({ ...box(x, y, z, w, sh, w, mat, { skip: 'd' }), rot: [r.range(-2, 2), 0, r.range(-2, 2)] });
    y += sh - 1; x += r.range(-1, 1); z += r.range(-1, 1); w = Math.max(4, w - 1);
  }
  const n = r.int(7, 9), a0 = r.range(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const az = a0 + i * 2.4 + r.range(-0.3, 0.3), y0 = h * (0.42 + (i / n) * 0.5), len = r.range(9, 16);
    const tip = limb(wood, mat, x * (y0 / h), y0, z * (y0 / h), az, r.range(40, 62), len, 3, 8);
    const rad = r.range(7, 11);
    blobs.push({ x: tip[0], y: tip[1] + 1, z: tip[2], rx: rad, ry: rad * r.range(0.8, 1.05), rz: rad });
    for (let k = 0; k < 2; k++) limb(wood, mat, tip[0], tip[1], tip[2], az + r.range(-1, 1), r.range(10, 60), r.range(4, 8), 1.5);
  }
  blobs.push({ x, y: h + 4, z, rx: 10, ry: 12, rz: 10 }, { x: x + r.range(-4, 4), y: h - 8, z: z + r.range(-4, 4), rx: 11, ry: 9, rz: 11 });
  const v = new Vox(4);
  blobs.forEach((bl, i) => v.blob(bl.x, bl.y, bl.z, bl.rx * 0.78, bl.ry * 0.78, bl.rz * 0.78, seed + 10 + i, 0.55, 0.45));
  v.emit(leafSet(PAL.birchLeaf, seed), 0.35, crown, seed, 0.26, strand('#b9c95a'));
  const top = Math.max(...blobs.map((bl) => bl.y + bl.ry));
  return { wood, crown, blobs, leaf: 'birch', top, sway: 0.35, base: PAL.birchLeaf };
}

export function pine(seed: number): PlantModel {
  const r = rng(seed), wood: BoxSpec[] = [], crown: BoxSpec[] = [], blobs: Blob[] = [];
  const b = bark(PAL.barkPine, { seed });
  const h = r.int(72, 86);
  wood.push(box(0, 0, 0, 9, 16, 9, b, { skip: 'd' }), box(0, 15, 0, 6, h - 22, 6, b), box(0, h - 8, 0, 4, 10, 4, b));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6;
    wood.push({ ...box(Math.cos(a) * 5, -1.5, Math.sin(a) * 5, 3, 4, 8, b), rot: [-24, (-a * 180) / Math.PI + 90, 0] });
  }
  const v = new Vox(6);
  const tiers = r.int(6, 7);
  let y = 15;
  for (let i = 0; i < tiers; i++) {
    const f = 1 - i / tiers, rad = 7 + f * 21;
    // a whorl of drooping branches carries each tier of needles; gaps between tiers show the trunk
    const nb = 5 + (f > 0.5 ? 2 : 0), a0 = r.range(0, Math.PI * 2);
    for (let k = 0; k < nb; k++) limb(wood, b, 0, y + 2, 0, a0 + (k / nb) * Math.PI * 2 + r.range(-0.2, 0.2), r.range(-12, 6), rad * 0.88, 2, -6);
    blobs.push({ x: r.range(-1, 1), y: y + 2.5, z: r.range(-1, 1), rx: rad, ry: 5.5, rz: rad });
    v.blob(0, y + 2, 0, rad * 0.8, 5, rad * 0.8, seed + i, 0.35, 0.55);
    v.blob(0, y + 6, 0, rad * 0.48, 4, rad * 0.48, seed + i + 40, 0.25, 0.9);
    y += 9 + f * 4;
  }
  blobs.push({ x: 0, y: y + 3, z: 0, rx: 5, ry: 8, rz: 5 });
  v.blob(0, y + 3, 0, 4, 8, 4, seed + 60, 0.1, 0.9);
  // (the needle cards fringe the tiers, so the voxels can stay simple)
  v.emit(leafSet(PAL.pine, seed), 0.22, crown, seed, 0.16);
  const top = y + 11;
  return { wood, crown, blobs, leaf: 'pine', top, sway: 0.22, base: PAL.pine };
}

export function sapling(seed: number, leaf: string = PAL.oak): PlantModel {
  const r = rng(seed), wood: BoxSpec[] = [], crown: BoxSpec[] = [];
  const h = r.int(14, 20);
  const b = bark(PAL.barkOak, { seed });
  wood.push(box(0, 0, 0, 3, h, 3, b, { skip: 'd' }));
  const t1 = limb(wood, b, 0, h * 0.7, 0, r.range(0, 6.28), 45, 7, 2);
  const blobs: Blob[] = [{ x: 0, y: h + 3, z: 0, rx: 9, ry: 8, rz: 9 }, { x: t1[0], y: t1[1] + 1, z: t1[2], rx: 6, ry: 5, rz: 6 }];
  const v = new Vox(4);
  blobs.forEach((bl, i) => v.blob(bl.x, bl.y, bl.z, bl.rx * 0.8, bl.ry * 0.8, bl.rz * 0.8, seed + i, 0.45, 0.4));
  v.emit(leafSet(leaf, seed), 0.4, crown, seed, 0.3);
  return { wood, crown, blobs, leaf: 'oak', top: h + 12, sway: 0.4, base: leaf };
}

/** Round shrubs; `bloom` paints berries or flowers into the voxel leaves. */
export function bush(seed: number, c: string = '#4a9a3c', bloom?: Tint, kind: LeafKind = 'bush'): PlantModel {
  const r = rng(seed), crown: BoxSpec[] = [], wood: BoxSpec[] = [];
  const blobs: Blob[] = [
    { x: 0, y: 2 + 8 * 0.4, z: 0, rx: r.range(9, 11), ry: r.range(8, 9.5), rz: r.range(9, 11) },
    { x: r.range(5, 7), y: 4, z: r.range(-3, 3), rx: 7, ry: 6.5, rz: 7 },
    { x: r.range(-7, -5), y: 4, z: r.range(-3, 3), rx: 7, ry: 6, rz: 7 },
  ];
  const v = new Vox(4);
  blobs.forEach((bl, i) => v.blob(bl.x, bl.y, bl.z, bl.rx * 0.85, bl.ry * 0.85, bl.rz * 0.85, seed + i, 0.45, 0.8));
  v.emit(leafSet(c, seed, bloom, bloom ? 0.07 : 0), 0.3, crown, seed, 0.3);
  const b = bark('#6a4a32', { seed });
  for (let i = 0; i < 5; i++) limb(wood, b, r.range(-3, 3), 0, r.range(-3, 3), r.range(0, 6.28), r.range(35, 70), r.range(7, 12), 2);
  return { wood, crown, blobs, leaf: kind, top: 16, sway: 0.3, base: c };
}

// ------------------------------------------------------------------ pond dressing

export function lilyPad(seed: number, flower = false): BoxSpec[] {
  const pr = R('#4fa84a');
  const pad: Painter = (t) => {
    const dx = t.bx - t.sx / 2, dz = t.bz - t.sz / 2, d = Math.hypot(dx, dz);
    if (d > 4.4 || (dx > 0 && Math.abs(dz) < 0.9 && d > 1)) return -1;
    return tone(pr, (d > 3.3 ? -1 : 0.4) + (Math.abs(Math.sin(Math.atan2(dz, dx) * 3)) < 0.25 ? -0.8 : 0) + (t.face === 2 ? 0.6 : -1));
  };
  const out: BoxSpec[] = [box(0, 0, 0, 9, 1, 9, pad, { cut: true })];
  if (flower) {
    const p = smooth('#fbe3ee'), c = smooth('#f6c531');
    out.push(box(0, 1, 0, 2, 2, 2, c));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      out.push({ ...box(Math.cos(a) * 2, 1, Math.sin(a) * 2, 2, 1, 3, p), rot: [-28, (-a * 180) / Math.PI + 90, 0], pivot: [Math.cos(a) * 1, 1, Math.sin(a) * 1] });
    }
  }
  return out;
}

export function reeds(seed: number): BoxSpec[] {
  const r = rng(seed), out: BoxSpec[] = [];
  const st = blade('#6aa34a', -1.4, 0.8), head = solid('#6b4428', { noise: 0.6, scale: 1.3 });
  for (let i = 0; i < 5; i++) {
    const x = r.range(-4, 4), z = r.range(-3, 3), h = r.int(12, 20), tilt = r.range(-8, 8);
    const stem: BoxSpec[] = [box(x, 0, z, 1, h, 1, st, { sway: 0.8, skip: 'd' })];
    if (r.chance(0.6)) stem.push(box(x, h - 5, z, 2, 4, 2, head, { sway: 0.8 }), box(x, h - 1, z, 1, 2, 1, st, { sway: 0.8 }));
    else stem.push(lean(box(x + 0.8, h * 0.4, z, 1, h * 0.5, 2, st, { sway: 0.8 }), 0, 0, -22));
    out.push(...turn(stem, [tilt, 0, tilt * 0.6], [x, 0, z]));
  }
  return out;
}
