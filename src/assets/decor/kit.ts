// Shared painters, shape helpers and moving-part plumbing for the decor and seasonal items.
// Everything is in px (16 px = 1 block) and paints one texel per pixel, like the rest of the hollow.
import * as THREE from 'three';
import { box, buildProp, place, propMesh, PX, type BoxSpec, type Painter, type Prop, type Texel, type Vec3 } from '../../gfx/box.ts';
import { col, mix, ramp, tone, type Ramp, type RGB } from '../../gfx/color.ts';
import { lvl, metal, R, wood, type Shade, type Tint } from '../../gfx/mats.ts';
import { fbm, hash, vnoise } from '../../gfx/noise.ts';
import type { ItemDef } from '../furniture.ts';

export const WD = {
  oak: '#b87a41', dark: '#7b4b2c', light: '#dcab68', walnut: '#5e3b24', pale: '#ead3a4',
  cherry: '#a3533a', birch: '#ecd6a6', ash: '#c9a878', ebony: '#3d2b26', drift: '#b8a68e',
};
export const MET = { gold: '#f2b632', brass: '#d9a441', iron: '#4b4f5c', silver: '#c9ced8', copper: '#c97a45', pewter: '#8f94a0' };
export const INK = 0x2a1d16;

export const wx = (c: Tint, plank = 3, seed = 0): Painter => wood(c, { axis: 'x', plank, seed });
export const wy = (c: Tint, plank = 0, seed = 0): Painter => wood(c, { axis: 'y', plank, seed });
export const wz = (c: Tint, plank = 3, seed = 0): Painter => wood(c, { axis: 'z', plank, seed });
export const brass = (c: Tint = MET.brass): Painter => metal(c);

const edgeOf = (t: Texel) => t.u === 0 || t.v === 0 || t.u === t.w - 1 || t.v === t.h - 1;
const ring1 = (t: Texel) => t.w >= 5 && t.h >= 5 && ((t.u === 1 || t.u === t.w - 2) && t.v >= 1 && t.v <= t.h - 2 || (t.v === 1 || t.v === t.h - 2) && t.u >= 1 && t.u <= t.w - 2);
const side = (t: Texel) => t.face !== 2 && t.face !== 3;

/** A wood painter with a bevelled frame on every face: lit top-left edges, dark lower-right. */
export function joinery(c: Tint, o: { axis?: 'x' | 'y' | 'z'; plank?: number; seed?: number; k?: number } = {}): Painter {
  const r = R(c), w = wood(r, { axis: o.axis ?? 'y', plank: o.plank ?? 0, seed: o.seed });
  const k = o.k ?? 1;
  const light = tone(r, 1.4), dark = tone(r, -1.6);
  return (t) => {
    if (t.w >= 4 && t.h >= 4) {
      if (t.v === t.h - 1 || t.u === 0) return t.face === 3 ? dark : k > 0 ? light : w(t);
      if (t.v === 0 || t.u === t.w - 1) return dark;
    }
    return w(t);
  };
}

/** A raised drawer front or door panel: inset groove, lit upper lip, pull in the middle. */
export function drawerFace(c: Tint, o: { pull?: Tint; pulls?: 1 | 2; keyhole?: boolean; axis?: 'x' | 'y' } = {}): Painter {
  const r = R(c), w = wood(r, { axis: o.axis ?? 'x', plank: 0 });
  const pr = o.pull ? ramp(typeof o.pull === "object" ? o.pull.c[o.pull.mid] : col(o.pull), { step: 0.085 }) : null;
  return (t) => {
    if (t.face !== 4) return w(t);
    const g = edgeOf(t);
    if (g) return tone(r, t.v === t.h - 1 ? 1.2 : t.u === 0 ? 0.6 : -1.5);
    if (t.w >= 6 && t.h >= 5 && ring1(t)) return tone(r, t.v === t.h - 2 || t.u === 1 ? -0.9 : 0.5);
    const cu = (t.w - 1) / 2, cv = (t.h - 1) / 2;
    if (pr) {
      const xs = o.pulls === 2 ? [Math.floor(t.w * 0.25), Math.ceil(t.w * 0.75) - 1] : [Math.floor(cu), Math.ceil(cu)];
      if (o.pulls === 2 ? xs.some((x) => Math.abs(t.u - x) < 1) && Math.abs(t.v - cv) < 1 : Math.abs(t.u - cu) < 1 && Math.abs(t.v - cv) < 0.6) return tone(pr, t.v >= cv ? 1.4 : -0.2);
    }
    if (o.keyhole && Math.abs(t.u - cu) < 0.6 && (Math.abs(t.v - (cv - 1.5)) < 0.6)) return 0x241712;
    return w(t);
  };
}

export interface FabOpts {
  /** dashed stitching one texel inside every face edge */
  stitch?: Tint;
  /** coloured piping on the face edges */
  pipe?: Tint;
  /** button tufting every n texels */
  tuft?: number;
  /** two-colour checks in model space (continues across boxes) */
  check?: Tint;
  checkSize?: number;
  /** stripes along a model axis */
  stripe?: Tint;
  stripeAxis?: 'x' | 'y' | 'z';
  stripeW?: number;
  stripeGap?: number;
  /** strength of the 1-texel weave */
  weave?: number;
  shade?: Shade;
  seed?: number;
}

/** Woven fabric: a fine over-under weave, soft folds, optional stitching, piping, checks, stripes and tufts. */
export function fab(c: Tint, o: FabOpts = {}): Painter {
  const r = R(c);
  const st = o.stitch ? R(o.stitch) : null, pp = o.pipe ? R(o.pipe) : null, ck = o.check ? R(o.check) : null, sr = o.stripe ? R(o.stripe) : null;
  const weave = o.weave ?? 0.22, tuft = o.tuft ?? 0, seed = o.seed ?? 0, cs = o.checkSize ?? 2;
  const sw = o.stripeW ?? 1, sg = o.stripeGap ?? 3, sa = o.stripeAxis ?? 'y';
  return (t) => {
    let L = lvl(t, { noise: 0.28, speck: 0.12, jitter: 0.12, rim: 0.7, seed, ...o.shade }) + ((t.u + t.v) & 1 ? weave : -weave);
    if (side(t)) {
      const colm = t.face < 2 ? t.bz : t.bx;
      const fold = hash(Math.floor(colm / 2), t.face, 9, seed);
      if (fold > 0.78) L -= 0.45;
    }
    if (pp && edgeOf(t) && t.w > 2 && t.h > 2) return tone(pp, L * 0.5 + (t.v === t.h - 1 ? 0.8 : 0));
    if (st && ring1(t) && (t.u + t.v) % 2 === 0) return tone(st, 0.9);
    let rr: Ramp = r;
    if (ck && (Math.floor((t.x + 256) / cs) + Math.floor((t.y + 256) / cs) + Math.floor((t.z + 256) / cs)) % 2 === 0) rr = ck;
    if (sr) {
      const a = sa === 'x' ? t.x : sa === 'y' ? t.y : t.z;
      if (((Math.floor(a + 256) % (sw + sg)) + sw + sg) % (sw + sg) < sw) rr = sr;
    }
    if (tuft && t.face !== 3 && t.w > tuft + 1 && t.h > tuft + 1) {
      const row = Math.floor((t.v + Math.floor(tuft / 2)) / tuft);
      const du = (t.u + (row & 1 ? Math.floor(tuft / 2) : 0)) % tuft - Math.floor(tuft / 2), dv = (t.v + Math.floor(tuft / 2)) % tuft - Math.floor(tuft / 2);
      if (du === 0 && dv === 0) return tone(rr, -2.2);
      if (Math.abs(du) + Math.abs(dv) === 1) L -= 0.7;
      else if (Math.abs(du) + Math.abs(dv) === 2) L += 0.25;
    }
    return tone(rr, L);
  };
}

/** Patchwork quilt: patches of mixed fabrics (plain, dotted, striped, crossed) with stitched seams, in model space. */
export function patchwork(cols: Tint[], o: { size?: number; seam?: Tint; seed?: number } = {}): Painter {
  const rs = cols.map((c) => R(c)), size = o.size ?? 4, seed = o.seed ?? 0, seam = o.seam ? R(o.seam) : null;
  return (t) => {
    const flatF = t.face === 2 || t.face === 3;
    const a = flatF ? t.x : t.face < 2 ? t.z : t.x, b = flatF ? t.z : t.y;
    const ca = Math.floor((a + 256) / size), cb = Math.floor((b + 256) / size);
    const ia = (a + 256) % size, ib = (b + 256) % size;
    const r = rs[Math.floor(hash(ca, cb, 1, seed) * rs.length)];
    let L = lvl(t, { noise: 0.2, speck: 0.1, jitter: 0.1, rim: 0.6 }) * 0.8 + ((t.u + t.v) & 1 ? 0.12 : -0.12);
    if (ia < 1 || ib < 1) return seam ? tone(seam, L * 0.4 + ((Math.floor(a + b) & 1) ? 0.7 : -0.3)) : tone(r, L - 1.1);
    const m = Math.floor(hash(ca, cb, 2, seed) * 4), fa = Math.floor(ia), fb = Math.floor(ib), mid = Math.floor(size / 2);
    if (m === 1 && (fa + fb) % 2 === 0) L += 0.9;
    else if (m === 2 && fb % 2 === 0) L -= 0.6;
    else if (m === 3 && (fa === mid || fb === mid)) L += 0.8;
    return tone(r, L);
  };
}

/** Tartan: crossing bands of two colours over a base, darker where they overlap. */
export function plaid(base: Tint, a: Tint, b: Tint, period = 8): Painter {
  const r0 = R(base), ra = R(a), rb = R(b);
  return (t) => {
    const L = lvl(t, { noise: 0.2, speck: 0.1, rim: 0.6 }) + ((t.u + t.v) & 1 ? 0.15 : -0.15);
    const p = (n: number) => ((Math.floor(n + 512) % period) + period) % period;
    const h = t.face === 2 || t.face === 3 ? p(t.x) : t.face < 2 ? p(t.z) : p(t.x);
    const v = t.face === 2 || t.face === 3 ? p(t.z) : p(t.y);
    const inA = (x: number) => x < 2, inB = (x: number) => x === 4;
    if (inA(h) && inA(v)) return tone(ra, L - 1);
    if (inA(h) || inA(v)) return tone(ra, L + ((t.u + t.v) & 1 ? 0.3 : -0.3));
    if (inB(h) || inB(v)) return tone(rb, L);
    return tone(r0, L);
  };
}

/** Knitted wool: columns of little chevrons, optional stripes. */
export function knit(c: Tint, o: { stripe?: Tint; every?: number; seed?: number } = {}): Painter {
  const r = R(c), s = o.stripe ? R(o.stripe) : null, every = o.every ?? 3;
  return (t) => {
    const grp = Math.floor(t.u / 2) & 1;
    const z = grp ? t.u + t.v : t.u - t.v + 64;
    let L = lvl(t, { noise: 0.2, speck: 0.05, jitter: 0.1, rim: 0.5, seed: o.seed }) + (z % 4 < 2 ? 0.45 : -0.3) + (t.u % 2 === 1 && grp ? -0.15 : 0);
    if (t.face === 3) L -= 0.5;
    const rr = s && Math.floor((t.y + 64) / every) % 2 === 0 ? s : r;
    return tone(rr, L);
  };
}

/** Fleece and fur: curly clumps with bright tips. */
export function fluff(c: Tint, o: { seed?: number; curl?: number } = {}): Painter {
  const r = R(c), seed = o.seed ?? 0, s = o.curl ?? 1.2;
  return (t) => {
    const n = fbm(t.x / s, t.y / s, t.z / s, seed);
    const up = fbm(t.x / s, t.y / s + 0.4, t.z / s + 0.3, seed) - fbm(t.x / s, t.y / s - 0.4, t.z / s - 0.3, seed);
    let L = (n - 0.5) * 2.6 + up * 3 + (t.face === 2 ? 0.6 : t.face === 3 ? -1.4 : (t.by / t.sy - 0.5) * 0.8);
    if (hash(Math.floor(t.x * 2), Math.floor(t.y * 2), Math.floor(t.z * 2), seed + 1) > 0.9) L += 0.9;
    return tone(r, L);
  };
}

/** Glazed ceramic: glossy glint, optional painted bands, dots and a two-tone dipped rim. */
export function glaze(c: Tint, o: { band?: Tint; bands?: number[]; dots?: Tint; dotRate?: number; dip?: Tint; dipH?: number; seed?: number } = {}): Painter {
  const r = R(c), band = o.band ? R(o.band) : null, dots = o.dots ? R(o.dots) : null, dip = o.dip ? R(o.dip) : null;
  const seed = o.seed ?? 0, rate = o.dotRate ?? 0.14;
  return (t) => {
    const L = lvl(t, { noise: 0.12, speck: 0.12, jitter: 0.1, rim: 1.1, seed });
    if ((t.face === 4 || t.face === 0) && t.w >= 3 && t.h >= 4 && t.u === 1 && t.v >= t.h - 3 && t.v <= t.h - 2) return tone(r, 3);
    if (dip && t.face !== 3) {
      const lim = t.sy - (o.dipH ?? 2) - Math.floor(hash(Math.floor(t.x + 64), Math.floor(t.z + 64), 1, seed) * 2);
      if (t.face === 2 || t.by > lim) return tone(dip, L + (t.face !== 2 && Math.floor(t.by) === Math.floor(lim) + 1 ? -0.6 : 0));
    }
    if (band && side(t) && o.bands?.some((b) => Math.abs(t.by - b) < 0.5)) return tone(band, L + 0.2);
    if (dots && t.face !== 3 && hash(Math.floor(t.x + 64), Math.floor(t.y + 64), Math.floor(t.z + 64), seed + 4) < rate) return tone(dots, L * 0.6 + 0.4);
    return tone(r, L);
  };
}

/** For `glass` boxes: pale tint, bright rims and a couple of diagonal glints. */
export function glassP(c: Tint = '#cfeef7'): Painter {
  const r = R(c);
  return (t) => {
    if (edgeOf(t)) return tone(r, 1.6);
    const d = (t.u + t.v) % 11;
    if (d === 3 || (d === 4 && t.v > t.h / 2)) return 0xffffff;
    return tone(r, 0.4);
  };
}

/** Parchment and paper: warm fibres, a darker deckled border. */
export function paper(c: Tint = '#f1e2bd', o: { ruled?: Tint; seed?: number } = {}): Painter {
  const r = R(c), ru = o.ruled ? R(o.ruled) : null, seed = o.seed ?? 0;
  return (t) => {
    let L = lvl(t, { noise: 0.45, scale: 3.4, speck: 0.4, rim: 0, grad: 0.2, seed }) * 0.6;
    if (edgeOf(t)) L -= 0.7 + hash(t.u, t.v, 3, seed) * 0.6;
    if (ru && t.face === 4 && t.v % 3 === 1 && t.u > 1 && t.u < t.w - 2) return tone(ru, 0.5);
    return tone(r, L + (vnoise(t.u / 2.2, t.v * 3, t.face, seed) - 0.5) * 0.6);
  };
}

/** Candle wax: soft top, drips running down from the rim. */
export function waxP(c: Tint = '#fbf1dc', seed = 0): Painter {
  const r = R(c);
  return (t) => {
    let L = lvl(t, { noise: 0.12, speck: 0, jitter: 0.08, rim: 0.4 }) * 0.7 + 0.3;
    if (t.face === 2) return tone(r, Math.hypot(t.u - t.w / 2 + 0.5, t.v - t.h / 2 + 0.5) < 0.8 ? -1.2 : 0.9);
    if (side(t)) {
      const len = 1 + Math.floor(hash(t.u, t.face, 2, seed) * Math.min(5, t.h - 1));
      if (t.v >= t.h - len) L += 0.6;
      if (t.v === t.h - len) L += 0.4;
    }
    return tone(r, L);
  };
}

/** Self-lit flame: white core, yellow middle, orange edges. Use with `glow`. */
export function flameP(o: { hot?: number; mid?: number; edge?: number } = {}): Painter {
  const hot = o.hot ?? 0xfff6c8, mid = o.mid ?? 0xffc23f, edge = o.edge ?? 0xf2742a;
  return (t) => {
    const cu = Math.abs((t.u + 0.5) / t.w - 0.5) * 2, cv = (t.v + 0.5) / t.h;
    if (t.face === 3) return edge;
    if (cu < 0.5 && cv < 0.6) return hot;
    if (cu < 0.9 && cv < 0.85) return mid;
    return edge;
  };
}

/** Clear water with ripple glints on top. */
export function waterP(c: Tint = '#58bfe0'): Painter {
  const r = R(c);
  return (t) => {
    const d = (Math.floor(t.x) + Math.floor(t.z) * 2 + 200) % 7;
    return tone(r, (d === 0 ? 1.6 : d === 3 ? 0.6 : -0.2) + (t.face === 2 ? 0.3 : -0.8) + (hash(Math.floor(t.x), 0, Math.floor(t.z), 5) > 0.94 ? 2 : 0));
  };
}

/** Gravel and pebbles in mixed colours. */
export function gravel(cols: Tint[] = ['#d9c7a0', '#9aa6b5', '#c98a5a', '#7f8a99'], seed = 0): Painter {
  const rs = cols.map((c) => R(c));
  return (t) => {
    const cx = Math.floor((t.x + 64) / 1.5), cz = Math.floor((t.z + 64) / 1.5), cy = Math.floor((t.y + 64) / 1.5);
    const h = hash(cx, cy, cz, seed);
    return tone(rs[Math.floor(h * rs.length)], (hash(Math.floor(t.x * 2), Math.floor(t.y * 2), Math.floor(t.z * 2), seed + 2) - 0.5) * 1.6 + (t.face === 2 ? 0.5 : -0.6));
  };
}

/** Woven reeds and wicker: over-under strands with dark gaps. */
export function wickerP(c: Tint = '#c99a55', o: { scale?: number } = {}): Painter {
  const r = R(c), s = o.scale ?? 1;
  return (t) => {
    const u = Math.floor(t.u / s), v = Math.floor(t.v / s);
    const k = (u + Math.floor(v / 2) * 2) % 4 < 2;
    let L = lvl(t, { noise: 0.2, speck: 0.2 }) + (k ? 0.6 : -0.7) + (v % 2 ? 0 : -0.35);
    if (t.face === 2 && (t.u + t.v) % 3 === 0) L -= 0.4;
    return tone(r, L);
  };
}

/** A painted pixel-art picture on one face (rows top to bottom, '.' falls through to `rest`). */
export function pix(rows: string[], pal: Record<string, number>, rest: Painter, face = 4): Painter {
  const H = rows.length, W = rows[0].length;
  return (t) => {
    if (t.face !== face) return rest(t);
    const gx = Math.floor(((t.u + 0.5) / t.w) * W), gy = H - 1 - Math.floor(((t.v + 0.5) / t.h) * H);
    const ch = rows[gy]?.[gx];
    if (ch === undefined || ch === '.') return rest(t);
    const c = pal[ch];
    return c === undefined ? rest(t) : c;
  };
}

/** Choose a painter per face: [east, west, up, down, south, north]; missing ones fall back to the last given. */
export const faces = (ps: (Painter | undefined)[], fallback: Painter): Painter => (t) => (ps[t.face] ?? fallback)(t);

/** Shade-only painter that picks the colour from a function of the texel (stripes, patterns). */
export const pattern = (pick: (t: Texel) => Ramp, o: Shade = {}): Painter => (t) => tone(pick(t), lvl(t, { noise: 0.25, speck: 0.15, ...o }));

/** A flat-ish glowing painter that keeps a little shading at the edges (for paper shades, glowing glass). */
export function glowP(c: Tint, o: { edge?: number; pattern?: (t: Texel) => number } = {}): Painter {
  const r = R(c), e = o.edge ?? 1;
  return (t) => {
    const d = Math.max(Math.abs((t.u + 0.5) / t.w - 0.5), Math.abs((t.v + 0.5) / t.h - 0.5)) * 2;
    return tone(r, 1.1 - d * d * 1.6 * e + (o.pattern ? o.pattern(t) : 0));
  };
}

export const rgbMix = (a: RGB | string, b: RGB | string, k: number) => mix(a, b, k);

/** A book standing spine-out (+z): gold bands and a title plate on the spine, pages on top and at the back. */
export function spine(c: Tint, o: { band?: Tint; plate?: boolean } = {}): Painter {
  const r = R(c), band = R(o.band ?? '#f2c84a'), pg = R('#f4ead0');
  return (t) => {
    const L = lvl(t, { noise: 0.15, speck: 0.1, jitter: 0.1, rim: 0.5 });
    if (t.face === 2 || t.face === 5) {
      if (t.u > 0 && t.u < t.w - 1 && (t.face === 5 ? t.v > 0 && t.v < t.h - 1 : t.v > 0 && t.v < t.h - 1)) return tone(pg, (t.face === 2 ? t.u : t.v) % 2 ? 0.4 : -0.3);
      return tone(r, L);
    }
    if (t.face === 4) {
      if (t.h >= 5 && (t.v === t.h - 2 || t.v === 1)) return tone(band, 0.7);
      if (o.plate !== false && t.h >= 7 && t.w >= 2 && t.v >= Math.floor(t.h / 2) - 1 && t.v <= Math.floor(t.h / 2)) return tone(band, -0.4);
      return tone(r, L + (t.u === 0 ? 0.6 : 0));
    }
    return tone(r, L - 0.2);
  };
}

const BOOK_COLS = ['#b8433a', '#3f6fb4', '#d9a33a', '#4f8a4a', '#7a4fa8', '#d8708a', '#2f8a86', '#8a5a34', '#2f3f6a', '#c9653a'];

/** A shelf's worth of books between x0 and x1, standing on y with spines facing +z at `front`. */
export function shelfBooks(x0: number, x1: number, y: number, front: number, depth: number, hMax: number, seed: number, o: { cols?: string[]; gapAt?: number } = {}): BoxSpec[] {
  const out: BoxSpec[] = [];
  const cols = o.cols ?? BOOK_COLS;
  let x = x0, i = 0;
  while (x < x1 - 1) {
    const h0 = hash(i, 1, 3, seed);
    if (o.gapAt !== undefined && Math.abs(x - o.gapAt) < 1) { x += 4; i++; continue; }
    const w = 1.2 + Math.floor(hash(i, 2, 3, seed) * 3) * 0.5;
    const h = Math.round(hMax * (0.62 + h0 * 0.38) * 2) / 2;
    const d = depth - hash(i, 4, 3, seed) * 1.2;
    const c = cols[Math.floor(hash(i, 5, 3, seed) * cols.length)];
    const band = hash(i, 6, 3, seed) > 0.4 ? '#f2c84a' : '#f4ead0';
    if (x + w > x1) break;
    // now and then a book leans on its neighbour at the end of a run
    if (x1 - x - w < 3.2 && x1 - x - w > 1.2 && h0 > 0.3) {
      out.push({ ...box(x + w / 2 + 0.6, y, front - d / 2, w, h, d, spine(c, { band })), rot: [0, 0, -18] as Vec3, pivot: [x + w + 0.6, y, front - d / 2] as Vec3 });
      break;
    }
    out.push(box(x + w / 2, y, front - d / 2, w, h, d, spine(c, { band })));
    x += w + (hash(i, 7, 3, seed) > 0.85 ? 0.3 : 0);
    i++;
  }
  return out;
}

// ------------------------------------------------------------------ shapes

/** A stepped circle (or ellipse) of height h, built as a union of nested rectangles. */
export function disc(x: number, y: number, z: number, rx: number, h: number, p: Painter, o: Partial<BoxSpec> = {}, rz = rx): BoxSpec[] {
  const out: BoxSpec[] = [];
  const rows = Math.max(1, Math.round(rz));
  let last = -1;
  const hw = (k: number) => Math.round(rx * Math.sqrt(Math.max(0, 1 - ((k + 0.5) / rz) ** 2)) * 2) / 2;
  for (let k = rows - 1; k >= 0; k--) {
    const w = hw(k);
    if (w <= 0 || w === last) continue;
    last = w;
    out.push(box(x, y, z, w * 2, h, (k + 1) * 2, p, o));
  }
  return out;
}

/** A stepped sphere of radius r with its bottom at y. */
export function ball(x: number, y: number, z: number, r: number, p: Painter, o: Partial<BoxSpec> = {}, step = 1, squash = 1): BoxSpec[] {
  const out: BoxSpec[] = [];
  const n = Math.max(1, Math.round((2 * r) / step));
  for (let j = 0; j < n; j++) {
    const yc = -r + (j + 0.5) * step;
    const rr = Math.sqrt(Math.max(0, r * r - yc * yc));
    if (rr < 0.5) continue;
    out.push(...disc(x, y + (r + yc - step / 2) * squash, z, rr, step * squash, p, o));
  }
  return out;
}

/** Eight thin panels around a vertical axis (glass bowls, drums, lamp shades). */
export function ring8(x: number, y: number, z: number, r: number, h: number, th: number, p: Painter, o: Partial<BoxSpec> = {}, n = 8): BoxSpec[] {
  const sideW = 2 * r * Math.tan(Math.PI / n) + 0.15;
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 360) / n, rad = (a * Math.PI) / 180, d = r - th / 2;
    return { ...box(x + Math.sin(rad) * d, y, z + Math.cos(rad) * d, sideW, h, th, p, o), rot: [0, a, 0] as Vec3 };
  });
}

/**
 * A flat pixel-art shape made of real boxes (one box per horizontal run), standing in the x-y plane
 * and facing +z. Unlike a `cut` painter it can glow. Rows run top to bottom; '.' is empty.
 */
export function pixBoxes(rows: string[], cx: number, y0: number, z: number, d: number, paint: (ch: string) => Painter, o: Partial<BoxSpec> | ((ch: string) => Partial<BoxSpec>) = {}, px = 1): BoxSpec[] {
  const out: BoxSpec[] = [];
  const H = rows.length, W = Math.max(...rows.map((r) => r.length));
  rows.forEach((row, r) => {
    let i = 0;
    while (i < row.length) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') { i++; continue; }
      let j = i;
      while (j < row.length && row[j] === ch) j++;
      const x = cx + ((i + j) / 2 - W / 2) * px, y = y0 + (H - 1 - r) * px;
      out.push(box(x, y, z, (j - i) * px, px, d, paint(ch), typeof o === 'function' ? o(ch) : o));
      i = j;
    }
  });
  return out;
}

/** Eight thin panels around a horizontal axis along x (bottles and rolls lying on their side). */
export function ring8x(x: number, y: number, z: number, r: number, len: number, th: number, p: Painter, o: Partial<BoxSpec> = {}, n = 8): BoxSpec[] {
  const sideW = 2 * r * Math.tan(Math.PI / n) + 0.15;
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 360) / n, rad = (a * Math.PI) / 180, d = r - th / 2;
    const cy = y + Math.sin(rad) * d, cz = z + Math.cos(rad) * d;
    return { ...box(x, cy - sideW / 2, cz, len, sideW, th, p, o), rot: [-a, 0, 0] as Vec3, pivot: [x, cy, cz] as Vec3 };
  });
}

/** A chain of short boxes following points (ropes, garlands, vines, track rails). */
export function chain(pts: Vec3[], th: number, p: Painter, o: Partial<BoxSpec> = {}): BoxSpec[] {
  const out: BoxSpec[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1];
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz);
    if (len < 0.01) continue;
    // a vertical segment tipped over about x, then swung about y (the engine applies x, then y, then z)
    const tip = (Math.atan2(Math.hypot(dx, dz), dy) * 180) / Math.PI, swing = (Math.atan2(dx, dz) * 180) / Math.PI;
    const cx = (ax + bx) / 2, cy = (ay + by) / 2, cz = (az + bz) / 2, L = len + th * 0.6;
    out.push({ ...box(cx, cy - L / 2, cz, th, L, th, p, o), rot: [tip, swing, 0] as Vec3, pivot: [cx, cy, cz] as Vec3 });
  }
  return out;
}

/** A hanging curve between two points (catenary-ish), as a list of points. */
export function sag(a: Vec3, b: Vec3, drop: number, n = 8): Vec3[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const k = i / n;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k - drop * 4 * k * (1 - k), a[2] + (b[2] - a[2]) * k] as Vec3;
  });
}

/** Rotate boxes as one rigid group about a pivot. */
export const turn = (boxes: BoxSpec[], rot: Vec3, pivot: Vec3): BoxSpec[] => boxes.map((b) => ({ ...b, rot, pivot }));

// ------------------------------------------------------------------ moving parts

const PART_CACHE = new Map<string, Prop>();

/**
 * A moving part for `ItemDef.parts()`: the boxes are modelled in item space (px) and the mesh is
 * re-centred on `pivot`, so rotating it turns it about that point. Geometry is cached per key and
 * shared between every placed copy.
 */
export function part(name: string, key: string, pivot: Vec3, make: () => BoxSpec[]): THREE.Mesh {
  let p = PART_CACHE.get(key);
  if (!p) {
    p = buildProp(place(make(), -pivot[0], -pivot[1], -pivot[2]), { wind: false });
    PART_CACHE.set(key, p);
  }
  const m = propMesh(p);
  m.name = name;
  m.position.set(pivot[0] * PX, pivot[1] * PX, pivot[2] * PX);
  m.userData.home = m.position.clone();
  return m;
}

/** An empty group at a point in item space (px), for orbits and hinges. */
export function pivotGroup(name: string, at: Vec3, ...kids: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(at[0] * PX, at[1] * PX, at[2] * PX);
  for (const k of kids) g.add(k);
  return g;
}

/** Give a part its own copy of the materials so it can be dimmed or tinted on its own. */
export function ownMats(m: THREE.Mesh): THREE.Mesh {
  m.material = (m.material as THREE.Material[]).map((x) => x.clone());
  return m;
}

/** Multiply a part's colour (glowing parts dim, twinkle and pulse with this). */
export function setBright(m: THREE.Object3D | undefined, k: number) {
  if (!m) return;
  const mats = (m as THREE.Mesh).material;
  if (!mats) return;
  for (const x of Array.isArray(mats) ? mats : [mats]) (x as THREE.MeshBasicMaterial).color?.setScalar(k);
}

/** A stable per-object phase so copies of the same item do not move in lockstep. */
export const phase = (o: THREE.Object3D) => {
  if (o.userData.phase === undefined) o.userData.phase = hash(o.id, 3, 7) * 100;
  return o.userData.phase as number;
};

/** A candle flame as a moving part: its pivot is the wick, so scaling it makes it flicker. */
export function flamePart(name: string, at: Vec3, s = 1): THREE.Mesh {
  return part(name, 'flame:' + s, at, () => [
    box(at[0], at[1], at[2], 1.2 * s, 2.2 * s, 1.2 * s, flameP(), { glow: true }),
    box(at[0], at[1] + 2.2 * s, at[2], 0.6 * s, 0.9 * s, 0.6 * s, flameP({ hot: 0xffe08a, mid: 0xffb23a }), { glow: true }),
    box(at[0], at[1] - 0.2, at[2], 0.4, 0.6, 0.4, () => 0x2a1d16),
  ]);
}

/** Flicker every child whose name starts with `prefix`. */
export function flicker(obj: THREE.Object3D, t: number, prefix = 'flame') {
  const ph = phase(obj);
  obj.children.forEach((c, i) => {
    if (!c.name.startsWith(prefix)) return;
    const k = t * 11 + ph + i * 1.7;
    c.scale.set(1 + Math.sin(k * 1.3) * 0.08, 1 + Math.sin(k) * 0.12 + Math.sin(k * 2.7) * 0.07, 1 + Math.cos(k * 1.1) * 0.08);
    c.rotation.z = Math.sin(k * 0.7) * 0.08;
  });
}

/** A placed item with its moving parts attached, ready to add to a scene (store icons, previews). */
export function itemObject(def: ItemDef): { obj: THREE.Mesh; prop: Prop } {
  const prop = buildProp(def.build());
  const obj = propMesh(prop);
  obj.name = 'item:' + def.id;
  for (const c of def.parts?.() ?? []) obj.add(c);
  return { obj, prop };
}

export { box, place, PX, tone, R, col, ramp, hash, fbm, vnoise };
export type { BoxSpec, Painter, Texel, Vec3, Tint, Ramp, RGB };
