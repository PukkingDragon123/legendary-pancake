// Hand-painted owl plumage. Every surface is painted feather by feather: overlapping scale-feathers
// with a lit dome, a shaft, a fringe and the shadow of the feather above on the back and wings;
// long barred vanes on flight feathers and tail; soft streaked or barred down on the breast; radial
// lines and rings on the facial disc. Light is painted as if the stepped body and head were smooth
// (normals come from their profiles), so the blocks read as a soft round bird. Each species picks
// its own markings: tawny streaks and cross-bars, barn-owl grey veil and pearl dots, snowy bars,
// burrowing and little-owl spots, eagle-owl teardrops, great-grey rings...
import type { Painter, Texel } from '../gfx/box.ts';
import { col, mix, ramp, toLch, tone, type Ramp } from '../gfx/color.ts';
import { fbm, hash } from '../gfx/noise.ts';
import type { Geo, Profile } from './geo.ts';
import type { Plumage, SpeciesDef } from './species.ts';

/** Ramps with warm shadows for warm colours; whites can ask for cool, snowy shadows. */
export function fr(c: string | number, step = 0.045, cool = false): Ramp {
  const [, C, h] = toLch(col(c));
  const warm = !cool && ((h > 15 && h < 115) || C < 0.05);
  return ramp(col(c), warm ? { cool: 40, warm: 88, shift: 0.045, step } : { step, cool: 255, shift: 0.06 });
}

/** Baked light per face: east, west, up, down, front, back. Gentle, the scene lights do the rest. */
const FACE = [0.12, -0.28, 0.62, -1.15, 0.22, -0.38];

export function lit(t: Texel, top: number, span: number): number {
  let L = FACE[t.face] + ((t.y - top) / span) * 0.75 + 0.3;
  if (t.face !== 2 && t.face !== 3 && t.w >= 8 && (t.u === 0 || t.u === t.w - 1)) L -= 0.2;
  return L;
}

const fract = (v: number) => v - Math.floor(v);
const sq = (v: number) => v * v;
/** a 0..1 arc: 1 in the middle of a cell, 0 at its edges */
const arc = (u: number) => Math.sqrt(Math.max(0, 1 - sq(2 * u - 1)));
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Light direction for painted shading (upper front left). */
const LX = -0.38, LY = 0.74, LZ = 0.56;

/** Surface frame of a texel on a profiled volume: painted light and spherical feather coordinates. */
interface Frame { L: number; a: number; b: number; ny: number; az: number }
function frame(t: Texel, p: Profile, R: number, out: Frame): Frame {
  const k = clamp((t.y - p.y0) / p.h, 0, 1);
  const hw = p.hw(k), f = p.front(k), bk = p.back(k), zc = (f + bk) / 2, dz = Math.max(0.5, (f - bk) / 2);
  let nx = clamp(t.x / hw, -1.15, 1.15), nz = clamp((t.z - zc) / dz, -1.15, 1.15);
  const dk = 0.04, slope = (p.hw(clamp(k - dk, 0, 1)) - p.hw(clamp(k + dk, 0, 1))) / (2 * dk * p.h);
  let ny = slope * 1.3 + (t.face === 3 ? -0.7 : 0);
  const n = Math.hypot(nx, ny, nz) || 1;
  nx /= n; ny /= n; nz /= n;
  out.L = (nx * LX + ny * LY + nz * LZ) * 1.35 - 0.05 - (k < 0.12 ? (0.12 - k) * 4 : 0) - (t.face === 2 ? 0.45 : 0);
  const az = Math.atan2(nx, nz), polar = Math.acos(clamp(ny, -1, 1));
  out.az = az;
  out.ny = ny;
  out.a = az * R * Math.max(0.35, Math.sin(polar));
  out.b = polar * R;
  return out;
}

/** One overlapping feather in a field of scales (rows run down `b`, staggered every other row). */
interface Fe { i: number; j: number; u: number; s: number; edge: number; shadow: number; h: number; h2: number }
// painters run once per texel, so these scratch records are reused instead of allocated
const FE: Fe = { i: 0, j: 0, u: 0, s: 0, edge: 0, shadow: 0, h: 0, h2: 0 };
function scale(a: number, b: number, fw: number, fh: number, tip: number, seed: number): Fe {
  const j = Math.floor(b / fh), v = b / fh - j, f = FE;
  const off = (r: number) => (r & 1) * 0.5 + (hash(r, 7, 0, seed) - 0.5) * 0.2;
  const ua = a / fw + off(j - 1), ia = Math.floor(ua), fa = ua - ia;
  const hang = tip * arc(fa);
  if (v < hang) { f.i = ia; f.j = j - 1; f.u = fa; f.s = 1 + v; f.edge = (hang - v) * fh; f.shadow = 0; }
  else {
    const uu = a / fw + off(j), ii = Math.floor(uu);
    f.i = ii; f.j = j; f.u = uu - ii; f.s = v; f.edge = 99; f.shadow = Math.max(0, 1 - ((v - hang) * fh) / 0.4);
  }
  f.h = hash(f.i, f.j, 1, seed); f.h2 = hash(f.i, f.j, 2, seed);
  return f;
}

/** A soft, non-overlapping feather cell for downy underparts. */
interface Ce { i: number; j: number; u: number; v: number; h: number; h2: number }
const CE: Ce = { i: 0, j: 0, u: 0, v: 0, h: 0, h2: 0 };
function cell(a: number, b: number, fw: number, fh: number, seed: number): Ce {
  const j = Math.floor(b / fh), v = b / fh - j;
  const fa = a / fw + (j & 1) * 0.5 + (hash(j, 3, 0, seed) - 0.5) * 0.3, i = Math.floor(fa);
  CE.i = i; CE.j = j; CE.u = fa - i; CE.v = v; CE.h = hash(i, j, 1, seed); CE.h2 = hash(i, j, 2, seed);
  return CE;
}

/** Short downward brush strokes: the soft grain of body feathers. */
function down(a: number, b: number, seed: number, len = 1.1, wid = 0.25): number {
  const c = Math.floor(a / wid), r = Math.floor((b + hash(c, 0, 0, seed) * len) / len);
  const h = hash(c, r, 1, seed);
  return h > 0.8 ? 0.22 : h < 0.18 ? -0.2 : 0;
}

/** Per-texel pepper at texel resolution (fine vermiculation, flecks). */
const pep = (t: Texel, seed: number) => hash(Math.floor(t.x * 4 + 0.01), Math.floor(t.y * 4 + 0.01), Math.floor(t.z * 4 + 0.01), seed);

export interface Kit {
  body: Painter; breastTip: Painter;
  head: Painter; disc: Painter; ruff: Painter; ruffOut: Painter; ridge: Painter; brow: Painter; bristle: Painter; chin: Painter;
  beak: Painter; cere: Painter; gape: Painter; tongue: Painter;
  wing: Painter; cov: Painter; scap: Painter;
  prim: (i: number) => Painter; primTip: (i: number) => Painter; tail: (i: number) => Painter; tuft: (i: number) => Painter;
  leg: Painter; knicker: Painter; toe: Painter; talon: Painter;
}

export function paintKit(sp: SpeciesDef, g: Geo, opts: { fem?: boolean } = {}): Kit {
  const fem = !!opts.fem;
  const P: Plumage = sp.plumage, id = sp.id;
  const snowy = id === 'snowy';
  const R = (c: string | number, step = 0.045) => fr(c, step, snowy);
  const up = R(P.up), upD = R(P.upDark, 0.05), upL = R(P.upLight, 0.035);
  const un = R(P.under, 0.04), unM = R(P.underMark, 0.05), unLow = R(P.underLow, 0.035);
  const disc = R(P.disc, 0.04), discD = R(P.discDark, 0.05), rim = R(P.rim, 0.05), rimL = R(P.rimLight, 0.04);
  const brow = R(P.brow, 0.035), chin = R(P.chin, 0.04), bib = R(P.bib ?? P.chin, 0.035);
  const wing = R(P.wing), wingB = R(P.wingBar, 0.05), wingL = R(P.wingLight, 0.035);
  const tail = R(P.tail), tailB = R(P.tailBar, 0.05);
  const leg = R(P.leg, 0.04), toe = R(P.toe, 0.05), talon = ramp(col(P.talon), { step: 0.07 });
  const beak = ramp(col(P.beak), { step: 0.06 }), cere = ramp(col(P.cere), { step: 0.05 });
  const tuftR = P.tuft ? R(P.tuft, 0.05) : upD;
  const tuftEdge = id === 'longeared' ? R('#d99a52') : id === 'eagle' ? R('#c48a4c') : id === 'horned' ? R('#b9a07c') : upL;
  const barnRimOut = R('#8a5a2a'), bowKnot = R('#1e1c1c');
  const mouth = ramp(0xc9566a, { step: 0.06 }), tongue = ramp(0xe88a96, { step: 0.05 });
  const veilR = R(mix(P.upDark, P.up, 0.55)), upMid = R(mix(P.up, P.upDark, 0.35)), wash = R(mix(P.up, P.under, 0.5)), ink = R('#2a2224'), dark = R(P.upDark);
  const unMid = R(mix(P.under, P.underMark, 0.4));
  const softBrow = R(mix(P.brow, P.disc, 0.45));
  const lowMix = (L: number, k: number) => (k > 0 ? tone(unLow, L) : tone(un, L));

  const bodyTop = g.bodyTop, bodyY = g.bodyY, bH = g.bodyH;
  const Rb = (g.bodyW + g.bodyD) / 4, Rh = (g.headW + g.headD) / 4;
  const F: Frame = { L: 0, a: 0, b: 0, ny: 0, az: 0 };

  // ---------------------------------------------------------------- upperparts (scale feathers)

  /** Colour of one upperparts feather texel. `zone` tunes marks: crown, back, scap, cov. */
  function upper(f: Fe, L: number, t: Texel, zone: 'crown' | 'back' | 'scap' | 'cov'): number {
    const u = f.u, s = f.s, cu = Math.abs(u - 0.5);
    // the lit dome of the feather, darker where it tucks under its neighbour
    L += 0.22 - cu * 0.5 - (s < 0.25 ? (0.25 - s) * 1.2 : 0) + (f.h - 0.5) * 0.25;
    if (f.shadow > 0) L -= f.shadow * 0.75;
    const fringe = f.edge < 0.22;
    switch (P.upper) {
      case 'tawny': {
        // russet with fine dark shaft streaks, faint cross-bars, pale spots on the scapulars and coverts
        if (zone === 'scap' && f.h2 > 0.3 && u > 0.5) {
          const d = Math.hypot((u - 0.73) / 0.2, (s - 0.82) / 0.28);
          if (d < 1) return d > 0.7 ? tone(upD, L * 0.5 + 0.4) : tone(upL, L * 0.5 + 0.6);
        }
        if (zone === 'cov' && f.h2 > 0.55 && u > 0.45 && Math.hypot((u - 0.7) / 0.17, (s - 0.95) / 0.2) < 1) return tone(upL, L * 0.5 + 0.5);
        const sw = zone === 'crown' ? 0.07 : 0.05;
        if (cu < sw + 0.04 * Math.sin(Math.min(1, s) * Math.PI) && s > 0.12 && f.h > 0.12) return tone(upD, L * 0.5 + 0.5);
        if (zone !== 'crown' && f.h > 0.45 && cu < 0.34 && (Math.abs(s - 0.45) < 0.05 || Math.abs(s - 0.78) < 0.05)) return tone(upMid, L);
        if (fringe && zone !== 'crown' && f.h2 > 0.5) return tone(up, L + 0.6);
        return tone(up, L - (f.h < 0.2 ? 0.4 : 0));
      }
      case 'barn': {
        // golden ground, a soft grey veil over the middle, a pearl dot edged in black at the tip
        const dot = Math.hypot((u - 0.5) / 0.14, (s - (zone === 'crown' ? 0.84 : 0.9)) / 0.16);
        if (dot < 1 && f.h > (zone === 'crown' ? 0.4 : 0.25)) return tone(upL, L * 0.3 + 0.9);
        if (dot < 1.6 && s < 0.9 && f.h > 0.25) return tone(ink, L * 0.4);
        const veil = cu < 0.36 - Math.max(0, s - 0.8) * 0.9 && s > 0.2 && s < 1.0;
        if (veil) {
          const w = Math.sin(t.y * 9 + t.x * 3.1 + t.z * 3.1 + Math.sin(t.x * 2.3 + t.z * 2.3) * 1.6);
          return w > 0.55 ? tone(upD, L * 0.5 + 1.2) : tone(veilR, L + 0.2);
        }
        if (fringe && f.h2 > 0.5) return tone(up, L + 0.5);
        return tone(up, L + 0.1);
      }
      case 'snowy': {
        const curve = s - 0.22 * (1 - arc(u));
        if (zone === 'crown') {
          if (!fem && f.h > 0.4 && Math.hypot((u - 0.5) / 0.15, (s - 0.72) / 0.18) < 1) return tone(upD, L * 0.4 + 0.5);
          if (fem && f.h > 0.9 && Math.hypot((u - 0.5) / 0.1, (s - 0.72) / 0.12) < 1) return tone(upD, L * 0.4 + 1.4);
          return tone(up, L + 0.15);
        }
        const heavy = fem ? (zone === 'cov' ? 0.72 : 0.92) : 0.06;
        if (f.h > heavy && curve > 0.55 && curve < 0.82 && cu < 0.44) return tone(upD, L * 0.4 + (fem ? 1.6 : 0.2) + (cu > 0.36 ? 0.7 : 0));
        if (!fem && f.h2 > 0.55 && curve > 0.26 && curve < 0.38 && cu < 0.3) return tone(upD, L * 0.4 + 0.9);
        return tone(up, L + 0.15);
      }
      case 'spotted': {
        const rate = id === 'sawwhet' ? { crown: 0.7, back: 0.25, scap: 0.85, cov: 0.45 }[zone] : id === 'little' ? { crown: 0.85, back: 0.6, scap: 0.85, cov: 0.65 }[zone] : { crown: 0.75, back: 0.75, scap: 0.85, cov: 0.75 }[zone];
        if (zone === 'crown' && id === 'sawwhet') {
          if (f.h < rate && cu < 0.08 && s > 0.2 && s < 0.95) return tone(upL, L * 0.4 + 0.5);
        } else {
          const r = zone === 'crown' ? 0.16 : zone === 'scap' ? 0.25 : 0.2;
          const d = Math.hypot((u - 0.5) / (r * 1.1), (s - 0.72) / (r * 1.25));
          if (f.h < rate && d < 1) return tone(upL, L * 0.35 + 0.6 - (d > 0.75 ? 0.4 : 0));
          if (f.h < rate && d < 1.45 && s > 0.72) return tone(upD, L * 0.5 + 0.2);
        }
        if (cu < 0.045 && s > 0.15 && s < 0.9) L -= 0.4;
        if (fringe) L += 0.3;
        return tone(up, L);
      }
      case 'mottled': {
        // dark central streaks, soft mottles and paler edges (eagle-owl, great horned, long-eared)
        const bold = id === 'eagle' ? (zone === 'crown' ? 0.16 : 0.12) : id === 'longeared' ? 0.1 : 0.07;
        if (cu < bold * (0.55 + 0.6 * Math.sin(Math.min(1, s) * Math.PI)) && s > 0.08) return tone(upD, L * 0.5 + 0.3);
        const m = fbm(t.x * 0.75, t.y * 0.75, t.z * 0.75, 11);
        if (m < 0.34 && zone !== 'crown') return tone(upD, L * 0.5 + 1.0);
        if (id !== 'eagle' && cu < 0.4 && Math.sin(s * 18 + u * 5 + f.h * 9) > 0.7) return tone(upMid, L);
        if (u > 0.64 && s > 0.35 && f.h2 > 0.45) return tone(upL, L * 0.6 + 0.1);
        if (fringe) return tone(upL, L * 0.5 - 0.2);
        return tone(up, L);
      }
      case 'grey':
      default: {
        // great grey: fine wavy dusky bars and pale freckles, a dusky shaft streak
        if (cu < 0.05 + 0.03 * Math.sin(Math.min(1, s) * Math.PI) && s > 0.15) return tone(upD, L * 0.5 + 0.5);
        if (Math.sin(s * 14 + Math.sin(u * 8 + f.h * 5) * 1.1) > 0.68) return tone(upD, L * 0.5 + 1.3);
        if (pep(t, 9) > 0.9) return tone(upL, L * 0.5);
        if (fringe && f.h2 > 0.4) return tone(upL, L * 0.5 - 0.3);
        return tone(up, L);
      }
    }
  }

  // ---------------------------------------------------------------- underparts (soft down)

  function under(t: Texel, a: number, b: number, L: number): number {
    const hgt = (t.y - bodyY) / bH; // 0 bottom .. 1 shoulders
    const c = cell(a, b, 1.6, 2.2, 21);
    const cu = Math.abs(c.u - 0.5), v = c.v;
    L += down(a, b, 4) + (c.h - 0.5) * 0.18 + (0.2 - cu * 0.4) * 0.5;
    const pale = hgt < 0.28 ? 1 : 0;
    switch (P.underPat) {
      case 'tawny':
      case 'longeared': {
        const le = P.underPat === 'longeared';
        const p = hgt < 0.22 ? 0.45 : 0.95;
        if (c.h < p) {
          const sw = (le ? 0.09 : 0.07) + 0.04 * Math.sin(v * Math.PI);
          if (cu < sw && v > 0.04 && v < 0.96) return tone(unM, L * 0.5 + (cu > sw - 0.03 ? 0.7 : 0.2));
          if (cu < (le ? 0.34 : 0.28) && (Math.abs(v - 0.36) < 0.04 || (Math.abs(v - 0.68) < 0.035 && c.h2 > 0.35))) return tone(le ? unM : unMid, L * 0.5 + (le ? 0.7 : 0.3));
        }
        if (le && hgt > 0.55 && fbm(t.x * 0.6, t.y * 0.6, t.z * 0.6, 3) > 0.62) return tone(wash, L);
        return lowMix(L, pale);
      }
      case 'dots': {
        // white with a few fine dark dots, a golden wash creeping onto the breast sides
        if (c.h > 0.6 && hgt > 0.25 && Math.hypot((c.u - 0.5) * 1.85, (v - 0.5) * 2.3) < 0.2) return tone(unM, 0.4);
        const side = Math.abs(Math.atan2(t.x, t.z));
        if (hgt > 0.5 && side > 0.7 && fbm(t.x * 0.5, t.y * 0.5, t.z * 0.5, 3) + (side - 0.7) * 0.5 > 0.72) return tone(wash, L + 0.2);
        return tone(un, L + 0.25);
      }
      case 'snowy': {
        const curve = v + 0.16 * (1 - arc(c.u));
        const dens = fem ? 0.97 : hgt > 0.86 ? 0.75 : hgt > 0.22 ? 0.12 : 0.7;
        if (c.h > dens && curve > 0.42 && curve < 0.62 && cu < 0.42) return tone(unM, L * 0.4 + (cu > 0.32 ? 0.9 : 0.3));
        if (!fem && c.h2 > 0.55 && hgt > 0.3 && hgt < 0.8 && curve > 0.12 && curve < 0.24 && cu < 0.3) return tone(unM, L * 0.4 + 1.0);
        return tone(un, L + 0.25);
      }
      case 'barred': {
        // burrowing owl: a spotted brown breast band, then wavy brown bars on cream
        if (hgt > 0.7) {
          if (Math.hypot((c.u - 0.5) / 0.2, (v - 0.55) / 0.2) < 1 && c.h > 0.3) return tone(un, L * 0.5 + 0.4);
          return tone(unM, L * 0.6 + (fbm(t.x, t.y, t.z, 2) - 0.5) * 0.8);
        }
        if (hgt > 0.2) {
          const w = Math.sin((b / 1.3) * Math.PI * 2 + Math.sin(a * 0.8) * 0.8 + fbm(a, b, 0, 5) * 1.2);
          if (w > 0.5) return tone(unM, L * 0.5 + (w < 0.65 ? 0.7 : 0.3));
        }
        return lowMix(L, pale);
      }
      case 'chestnut': {
        // saw-whet: broad blotchy chestnut streaks on white
        if (c.h < (hgt < 0.25 ? 0.3 : 0.85)) {
          const wid = 0.19 + 0.08 * Math.sin(v * Math.PI) + (fbm(t.x * 1.3, t.y * 1.3, t.z, 6) - 0.5) * 0.14;
          if (cu < wid) return tone(unM, L * 0.6 + (cu > wid - 0.05 ? 0.5 : 0) + (c.h2 - 0.5) * 0.5);
        }
        return lowMix(L, pale);
      }
      case 'streaked': {
        // little owl: drop-shaped brown streaks, densest on the breast
        if (c.h < (hgt < 0.25 ? 0.3 : hgt > 0.7 ? 0.95 : 0.72)) {
          const wid = 0.2 * Math.pow(Math.sin(v * Math.PI), 0.7);
          if (cu < wid) return tone(unM, L * 0.6 + (cu > wid - 0.05 ? 0.5 : 0));
        }
        return lowMix(L, pale);
      }
      case 'finebar': {
        // great horned: a mottled dusky upper breast below the white bib, then fine bars on buff
        if (hgt > 0.8) {
          if (Math.abs(t.x) < g.bodyW * 0.2 && t.z > 0 && hgt > 0.9) return tone(bib, L * 0.5 + 0.4);
          const m = fbm(t.x * 0.8, t.y * 0.8, t.z * 0.8, 8);
          if (m < 0.42 || (cu < 0.07 && c.h > 0.3)) return tone(unM, L * 0.5 + 0.5);
          return tone(un, L - 0.2);
        }
        const w = fract(b / 0.7 + Math.sin(a * 1.2 + c.h * 3) * 0.1);
        if (w < 0.26 && hgt > 0.1) return tone(unM, L * 0.5 + (w > 0.18 ? 0.9 : 0.5));
        if (cu < 0.045 && c.h > 0.45 && hgt > 0.25) return tone(unM, L * 0.5 + 0.6);
        return lowMix(L, pale);
      }
      case 'greystreak': {
        if (c.h < (hgt < 0.22 ? 0.4 : 0.85)) {
          const sw = 0.08 + 0.055 * Math.sin(v * Math.PI);
          if (cu < sw) return tone(unM, L * 0.5 + 0.3);
        }
        if (fract(b / 0.75 + Math.sin(a * 1.1) * 0.12) < 0.15) return tone(unMid, L);
        return lowMix(L, pale);
      }
      case 'eagle':
      default: {
        if (hgt > 0.55) {
          // bold black teardrop streaks on the tawny breast
          const wid = 0.19 * Math.pow(Math.max(0, Math.sin(v * Math.PI)), 0.6) * (c.h > 0.12 ? 1 : 0);
          if (cu < wid) return tone(unM, L * 0.5 + (cu > wid - 0.04 ? 0.6 : 0.1));
          return tone(un, L);
        }
        if (cu < 0.045 && c.h > 0.2) return tone(unM, L * 0.5 + 0.3);
        if (cu < 0.3 && (Math.abs(v - 0.3) < 0.035 || Math.abs(v - 0.66) < 0.035)) return tone(unM, L * 0.5 + 0.8);
        return lowMix(L, pale);
      }
    }
  }

  // ---------------------------------------------------------------- the facial disc

  const ex = g.eyeX, ey = g.eyeY, es = g.eyeS;

  function discP(t: Texel): number {
    if (t.face !== 4) return tone(disc, FACE[t.face] - 0.4);
    const dl = Math.hypot(t.x + ex, t.y - ey), dr = Math.hypot(t.x - ex, t.y - ey);
    const right = dr < dl, d = right ? dr : dl, side = right ? 1 : -1;
    const ang = Math.atan2(t.y - ey, right ? t.x - ex : t.x + ex);
    const ax = Math.abs(t.x), inward = side * t.x < ex;
    const rr = d - es / 2;
    // a gentle dish: lighter in the middle of each lobe, shading toward the rim
    let L = 0.5 - Math.max(0, rr - 1.2) * 0.14 + (t.y - ey) * 0.03;
    // fine feather lines radiating out of each eye
    if (Math.sin(ang * 20 + Math.sin(d * 1.5) * 0.5) > 0.72 && rr > 0.5) L -= 0.3;
    if (rr < 0.4 && rr > -0.2) L -= 0.45; // the feathered eyelid socket
    const below = t.y < g.beakY - 1.4;
    switch (P.discPat) {
      case 'tawny':
        if (fract(rr / 1.2) < 0.2 && rr > 0.7) L -= 0.35;
        return tone(disc, L);
      case 'barn':
        // a russet smudge in front of each eye, otherwise silky white
        if (inward && rr < 1.4 && rr > 0.1 && t.y < ey + 0.5 && t.y > ey - es * 0.55) return tone(discD, L * 0.6 + 0.4);
        return tone(disc, L * 0.6 + 0.25);
      case 'snowy':
        if (!fem && t.y > ey + es * 0.45 && hash(Math.floor(t.x * 2), Math.floor(t.y * 2), 3, 5) > 0.94) return tone(dark, 0.6);
        return tone(disc, L * 0.5 + 0.3);
      case 'burrowing':
      case 'little': {
        if (below && ax < 3.2) return tone(chin, L * 0.5 + 0.4);
        if (P.discPat === 'little' && fract(rr / 1.05) < 0.22 && rr > 0.7) L -= 0.4;
        return tone(disc, L);
      }
      case 'sawwhet': {
        if (ax < 0.8 && t.y > g.beakY) return tone(brow, L * 0.5 + 0.4);
        if (Math.sin(ang * 10 + d * 0.2) > 0.4 && rr > 0.6) return tone(discD, L * 0.5 + 0.5 - Math.min(0.8, rr * 0.15));
        return tone(disc, L * 0.6 + 0.3);
      }
      case 'horned':
        if (ax < 1.0 && t.y > g.beakY - 0.4) return tone(brow, L * 0.5 + 0.3);
        if (rr > 2.4) L -= 0.4;
        return tone(disc, L);
      case 'longeared': {
        // dark vertical patches through the eyes, a white X between them, white whiskers at the bill
        const xLine = Math.abs(ax - (t.y - g.beakY + 1.0) * 0.4);
        if (t.y > g.beakY - 0.3 && t.y < ey + es * 0.7 && xLine < 0.42 && ax < ex - es * 0.32) return tone(brow, L * 0.4 + 0.6);
        if (Math.abs(ax - ex) < es * 0.55 && t.y > ey - es * 1.0 && t.y < ey + es * 0.9) return tone(discD, L * 0.5 + 0.4);
        if (below && ax < 2.2) return tone(brow, L * 0.5 + 0.3);
        return tone(disc, L);
      }
      case 'rings': {
        // concentric dark rings, a pale halo and a dark crescent round each small eye
        if (rr < 1.0 && rr > 0.25) return tone(brow, L * 0.4 + 0.5);
        if (rr < 1.5 && t.y < ey) return tone(discD, L * 0.5 + 0.3);
        const ringD = Math.hypot(t.x * 0.55, t.y - ey + 0.6) * 0.5 + d * 0.5;
        if (fract((ringD - 1.2) / 1.2) < 0.28) return tone(discD, L * 0.5 + 0.7);
        return tone(disc, L);
      }
      case 'eagle':
      default:
        if (Math.sin(ang * 26 + d) > 0.5 && rr > 0.4) L -= 0.3;
        return tone(disc, L);
    }
  }

  function ruffP(t: Texel, outer: boolean): number {
    let L = lit(t, g.eyeY + 4, 10) * 0.6 + (pep(t, 41) - 0.5) * 0.4;
    if (t.face === 3) L -= 0.4;
    const fleck = hash(Math.floor(t.x * 2), Math.floor(t.y * 2), Math.floor(t.z * 2), 12);
    if (id === 'barn') return outer ? tone(barnRimOut, L * 0.5 + (fleck > 0.85 ? -1 : 0)) : tone(rim, L * 0.6 + 0.4 + (fleck > 0.88 ? -1.5 : 0));
    if (id === 'longeared' && outer) return tone(rimL, L * 0.5);
    if (snowy) return tone(rim, L * 0.5 + 0.3 + (!fem && fleck > 0.94 ? -2.5 : 0));
    if (outer) return tone(fleck > 0.65 ? rimL : rim, L * 0.6 + 0.2);
    return tone(rim, L * 0.6 + (fleck > 0.86 ? 1.4 : 0.1));
  }

  // ---------------------------------------------------------------- body & head wraps

  const bodyP: Painter = (t) => {
    if (t.face === 3) return tone(un, -1.1);
    frame(t, g.body, Rb, F);
    const L = F.L;
    // underparts wrap round the front; the back is upperparts; a soft ragged seam (under the wings)
    const seam = 1.7 + (fbm(t.x * 0.5, t.y * 0.5, t.z * 0.5, 9) - 0.5) * 0.5;
    if (Math.abs(F.az) < seam) return under(t, F.a + 40, F.b, L);
    const f = scale(F.a + 60, F.b, 2.4, 1.7, 0.5, 13);
    return upper(f, L, t, t.y > bodyTop - 3.5 ? 'scap' : 'back');
  };

  const headP: Painter = (t) => {
    if (t.face === 3) return tone(chin, -0.9);
    frame(t, g.head, Rh, F);
    let L = F.L * 0.95 + 0.05;
    // throat below the disc: soft down (white bib on the big eared owls)
    if (Math.abs(F.az) < 0.9 && t.y < g.beakTip - 0.2 && F.ny < 0.3) {
      L += down(t.x * 2, -t.y, 6);
      if (P.bib) return tone(bib, L * 0.6 + 0.4);
      return tone(chin, L * 0.7);
    }
    const f = scale(F.a + 30, F.b, 1.75, 1.25, 0.5, 5);
    return upper(f, L, t, 'crown');
  };

  // ---------------------------------------------------------------- wings

  /** Bars and spots across a flight feather for this species. */
  function flight(t: Texel, along: number, u: number, i: number, L: number, base: Ramp, bar: Ramp, light: Ramp): number {
    const h = hash(i, 0, 5, 31);
    switch (id) {
      case 'barn': {
        const k = fract(along / 2.4 + h * 0.3);
        if (k < 0.14) return tone(bar, L * 0.5 + 1.0);
        if (Math.sin(t.y * 9 + t.z * 4) > 0.8) return tone(bar, L * 0.4 + 1.6);
        return tone(base, L + 0.2);
      }
      case 'snowy': {
        const k = fract(along / 1.9 + h * 0.2);
        if (k < (fem ? 0.1 : 0.34) && Math.abs(u - 0.5) < 0.44) return tone(bar, L * 0.5 + (fem ? 1.6 : 0.2));
        return tone(base, L + 0.2);
      }
      case 'burrowing': case 'little': case 'sawwhet': {
        // rows of pale spots along the vanes
        const k = fract(along / 1.6 + h * 0.15);
        if (Math.hypot((k - 0.5) / 0.22, (u - 0.62) / 0.24) < 1) return tone(light, L * 0.5 + 0.4);
        return tone(base, L);
      }
      case 'greatgrey': {
        const k = fract(along / 1.3 + Math.sin(u * 4) * 0.08);
        if (k < 0.32) return tone(bar, L * 0.5 + 0.9);
        return tone(base, L);
      }
      default: {
        const k = fract(along / 1.45 + h * 0.25);
        if (k < 0.34) return tone(bar, L * 0.5 + 0.4 + (k > 0.27 ? 0.5 : 0));
        if (k > 0.86 && (id === 'tawny' || id === 'eagle')) return tone(light, L * 0.5);
        return tone(base, L);
      }
    }
  }

  /** The folded wing: covert rows near the shoulder, barred secondaries below. */
  const wingP: Painter = (t) => {
    const outer = (t.face === 0 && t.x > 0) || (t.face === 1 && t.x < 0);
    const top = g.shoulderY + 0.8, b = top - t.y, a = -t.z;
    let L = FACE[t.face] * 0.7 + ((t.y - top) / bH) * 0.6 + 0.35;
    if (!outer && t.face !== 2 && t.face !== 4 && t.face !== 5) return tone(wing, L - 1.2);
    if (t.face === 3) return tone(wing, L - 0.6);
    // on the back the feathers run across x; on the flank across z
    const across = t.face === 5 || t.face === 2 ? Math.abs(t.x) * 1.1 + g.bodyD : a;
    const cutoff = bH * 0.36 + Math.sin(across * 1.1) * 0.3;
    if (b < cutoff) return upper(scale(across + 20, b, 2.1, 1.5, 0.55, 31), L, t, b < 1.8 && (a > g.bodyD * 0.12 || t.face === 5) ? 'scap' : 'cov');
    // secondaries: long vertical vanes with rounded tips, barred across
    const fw = 1.7, fa = (across + 40) / fw, i = Math.floor(fa), u = fa - i;
    L += 0.2 - Math.abs(u - 0.5) * 0.6;
    if (u < 0.07) L -= 0.7;
    else if (u > 0.9) L += 0.25;
    return flight(t, b, u, i, L, wing, wingB, wingL);
  };

  const covP: Painter = (t) => {
    const top = g.shoulderY + 0.8;
    const L = FACE[t.face] * 0.7 + ((t.y - top) / bH) * 0.6 + 0.45;
    if (t.face === 3) return tone(wing, L - 1);
    const a = t.face === 0 || t.face === 1 ? -t.z : t.x * 2;
    return upper(scale(a + 20, top - t.y + (t.face === 2 ? 0.3 : 0), 2.1, 1.5, 0.55, 31), L, t, 'cov');
  };

  const scapP: Painter = (t) => {
    const L = FACE[t.face] * 0.7 + ((t.y - bodyTop) / bH) * 0.6 + 0.45;
    if (t.face === 3) return tone(up, L - 1);
    const a = t.face === 4 || t.face === 5 ? t.x * 1.3 : -t.z;
    return upper(scale(a + 9, bodyTop + 1 - t.y + (t.face === 2 ? 0.4 : 0), 2.2, 1.6, 0.55, 47), L, t, 'scap');
  };

  const primP = (n: number): Painter => (t) => {
    // the inner half of a primary along the flank: flat against the side, a dark shaft, a lit edge
    const along = t.bz;
    const outer = (t.face === 0 && t.x > 0) || (t.face === 1 && t.x < 0);
    let L = 0.25 + (outer ? 0.15 : t.face === 2 ? 0.5 : t.face === 3 ? -0.6 : -0.5);
    const across = t.by / Math.max(0.1, t.sy);
    if (outer && Math.abs(across - 0.55) < 0.07) L -= 0.45;
    if (across > 0.85) L += 0.3;
    if (across < 0.15) L -= 0.5;
    return flight(t, along + n * 0.6, across, n, L, wing, wingB, wingL);
  };

  const primTipP = (n: number): Painter => (t) => {
    // the outer half of a primary, lying across the back: it runs along y (tip at by = 0)
    const along = t.by;
    let L = 0.2 + (t.face === 5 ? 0.25 : t.face === 4 ? -0.8 : -0.25);
    const across = t.bx / Math.max(0.1, t.sx);
    if (t.face === 5 && Math.abs(across - 0.45) < 0.06) L -= 0.45;
    if (along < 0.8 && Math.abs(across - 0.5) > along * 0.6 + 0.05) L -= 0.9;
    return flight(t, along + 3 + n * 0.6, across, n, L, wing, wingB, wingL);
  };

  const tailP = (n: number): Painter => (t) => {
    const along = t.bz;
    let L = FACE[t.face] * 0.8 + 0.1;
    if (t.face === 3) L -= 0.4;
    const k = fract(along / 1.3 + n * 0.11);
    const spotty = id === 'little' || id === 'sawwhet' || id === 'burrowing';
    const barred = spotty ? Math.hypot((k - 0.5) / 0.25, ((t.face === 2 ? t.bx / t.sx : 0.5) - 0.5) / 0.35) < 1 : k < 0.36;
    if (barred) return tone(tailB, L * 0.5 + (snowy && fem ? 1.6 : 0.4));
    return tone(tail, L);
  };

  const tuftP = (n: number): Painter => (t) => {
    let L = FACE[t.face] * 0.8 + 0.15 + (t.by / Math.max(0.5, t.sy)) * 0.5;
    if (t.face === 3) L -= 0.6;
    const across = t.face === 0 || t.face === 1 ? t.bz / t.sz : t.bx / t.sx;
    const edge = Math.abs(across - 0.5) > 0.3;
    if (snowy) return tone(up, L + (!fem && pep(t, 3) > 0.88 ? -2 : 0));
    if (edge) return tone(tuftEdge, L * 0.6);
    if (t.by < 0.6 && n % 2 === 0) return tone(up, L);
    return tone(tuftR, L * 0.6 + (Math.abs(across - 0.5) < 0.08 ? -0.5 : 0.25));
  };

  // ---------------------------------------------------------------- legs, feet, beak

  const legP: Painter = (t) => {
    let L = lit(t, g.legTop + 1, 4) * 0.7 + 0.3 + down(t.x * 2 + t.z * 2, -t.y, 41, 0.8, 0.25) * 0.8;
    if (t.face === 3) L -= 0.5;
    if (sp.shape.toes === 'bare' && t.y < g.legTop - 1.2) {
      // bare-looking, sparsely feathered shanks with scaly rings
      if (Math.floor(t.y * 2.2) % 2 === 0) L -= 0.35;
      return tone(leg, L * 0.6);
    }
    if ((id === 'eagle' || id === 'horned') && fract(t.y * 1.3) < 0.18) return tone(unM, L * 0.4 + 1.8);
    return tone(leg, L);
  };

  const toeP: Painter = (t) => {
    let L = FACE[t.face] * 0.7 + 0.3;
    if (t.face === 3) L -= 0.8;
    if (sp.shape.toes === 'feathered') return tone(leg, L + down(t.x * 3, t.z * 3, 7, 0.6, 0.25));
    // scaly toes with a few bristles
    if (Math.floor((t.x + t.z) * 3) % 3 === 0) L -= 0.4;
    if (sp.shape.toes === 'bristled' && pep(t, 61) > 0.85) return tone(leg, L + 0.4);
    return tone(toe, L);
  };

  const talonP: Painter = (t) => tone(talon, FACE[t.face] * 1.3 + (t.face === 2 ? 1.2 : 0) + (t.by > t.sy * 0.6 && t.face === 4 ? 0.8 : 0));

  const beakP: Painter = (t) => {
    let L = FACE[t.face] * 1.2 + 0.2;
    if (t.face === 2 || (t.face === 4 && t.by > t.sy * 0.55)) L += 0.5;
    if (t.face === 4 && t.bx > t.sx * 0.3 && t.bx < t.sx * 0.6 && t.by > t.sy * 0.35) L += 0.7;
    if (t.by < 0.3 && t.face !== 2) L -= 0.6;
    return tone(beak, L);
  };
  const cereP: Painter = (t) => tone(cere, FACE[t.face] + 0.2 + (pep(t, 71) - 0.5) * 0.5);
  const gapeP: Painter = (t) => tone(mouth, t.face === 4 ? -0.4 : -1.4);
  const tongueP: Painter = (t) => tone(tongue, t.face === 2 ? 0.6 : -0.4);

  const breastTip: Painter = (t) => {
    // flank feathers: underparts plumage, lit as part of the body
    if (t.face === 3) return tone(un, -1);
    frame(t, g.body, Rb, F);
    return under(t, F.a + 40, F.b, F.L + 0.1);
  };

  const ridgeP: Painter = (t) => {
    // feathers between the eyes running down to the bill
    let L = lit(t, g.eyeY + 3, 6) * 0.5 + 0.3 + down(t.x * 3, -t.y, 9, 0.6, 0.2);
    if (t.face === 3) L -= 0.6;
    // white X / Y between the eyes on some species; just a soft parting on the rest
    const white = ['little', 'burrowing', 'sawwhet', 'longeared', 'greatgrey'].includes(id);
    if (t.face === 4 && Math.abs(t.x) < 0.18) return tone(white ? brow : softBrow, L * 0.6 + 0.2);
    return white ? tone(brow, L * 0.7) : tone(disc, L + 0.1);
  };

  const browP: Painter = (t) => {
    let L = lit(t, g.eyeY + es, 3) * 0.5 + 0.3 + down(t.x * 3, -t.y * 2, 13, 0.5, 0.2);
    if (t.face === 3) L -= 0.7;
    const white = ['little', 'burrowing', 'sawwhet', 'longeared', 'greatgrey'].includes(id);
    const soft = id === 'tawny' || id === 'horned' || id === 'eagle';
    return white ? tone(brow, L * 0.7 + 0.2) : soft ? tone(softBrow, L * 0.7 + 0.1) : tone(disc, L + 0.1);
  };

  const bristleP: Painter = (t) => {
    // rictal bristles: stiff feathers fanning over the base of the bill
    const L = lit(t, g.beakY + 1, 3) * 0.5 + 0.35;
    const line = Math.floor((t.x * 2 + t.y) * 4) % 3 === 0;
    const c = id === 'longeared' || id === 'burrowing' || id === 'little' || id === 'greatgrey' || id === 'sawwhet' ? brow : disc;
    return tone(c, L + (line ? -0.5 : 0.15));
  };

  const chinP: Painter = (t) => {
    // the great grey's white bow tie with a black knot; others: soft chin feathers
    const L = lit(t, g.beakTip, 3) * 0.6 + 0.3 + down(t.x * 3, -t.y, 17, 0.6, 0.2);
    if (id === 'greatgrey') return Math.abs(t.x) < 0.55 ? tone(bowKnot, L * 0.5) : tone(bib, L * 0.5 + 0.4 - (t.face === 4 ? 0 : 0.6));
    if (P.bib) return tone(bib, L * 0.5 + 0.3);
    return tone(chin, L);
  };

  const knicker: Painter = (t) => {
    const L = lit(t, g.legTop + 2, 4) * 0.7 + 0.35 + down(t.x * 2 + t.z * 2, -t.y, 43, 0.9, 0.3) * 0.8;
    return tone(id === 'barn' || id === 'burrowing' || id === 'little' ? unLow : leg, L - (t.face === 3 ? 0.6 : 0));
  };

  return {
    body: bodyP, breastTip, head: headP, disc: discP, ruff: (t) => ruffP(t, false), ruffOut: (t) => ruffP(t, true),
    ridge: ridgeP, brow: browP, bristle: bristleP, chin: chinP,
    beak: beakP, cere: cereP, gape: gapeP, tongue: tongueP,
    wing: wingP, cov: covP, scap: scapP, prim: primP, primTip: primTipP, tail: tailP, tuft: tuftP,
    leg: legP, knicker, toe: toeP, talon: talonP,
  };
}
