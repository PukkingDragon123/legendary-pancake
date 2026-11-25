// Detailed pixel-art particle sprites, drawn once in code the way a pixel artist would paint them: each object is a
// small 3D shape (a cupped leaf with its midrib and side veins, a notched blossom petal, a downy feather, a spinning
// acorn, a curled wood shaving, a torn paper scrap, a gold-leaf flake...) turned through its frames and lit from the
// upper left, then reduced to a hue-shifted colour ramp (violet-cool shadows, warm golden lights, calm mid-tones) with
// a selective outline: near-black on the shadow side, the ramp's darkest colour on the lit side. Lights (glints,
// motes, embers, fireflies, snow crystals) are unoutlined and meant to be drawn additively.
//   sprite(kind, frame)        a coloured canvas, 1 texel per art pixel (cached)
//   frameCount(kind)           how many frames a kind has
//   flatTone(kind, size)       the albedo of a flat object (no light) as a grey value raster, for the 3D world atlas
// Pure canvas code; no DOM except document.createElement('canvas').

export type V3 = [number, number, number];
/** a raster: shade 0..1 (lit), tone 0..1 (albedo only), alpha 0..1, material index, role (0 empty, 1 fill, 2 outline, 3 glint) */
export interface Raster { w: number; h: number; s: Float32Array; tone: Float32Array; a: Float32Array; mat: Uint8Array; role: Uint8Array }

const raster = (w: number, h: number): Raster => ({ w, h, s: new Float32Array(w * h), tone: new Float32Array(w * h), a: new Float32Array(w * h), mat: new Uint8Array(w * h), role: new Uint8Array(w * h) });
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const hash = (x: number, y: number, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
/** 4x4 ordered dither threshold (0..1) */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
/** the key light: from the upper left, a little toward the viewer (x right, y up, z out of the screen) */
export const LIGHT: V3 = (() => { const v: V3 = [-0.52, 0.62, 0.58]; const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; })();
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ------------------------------------------------------------------ colour

type RGB = [number, number, number];
export function hexRgb(h: string): RGB { const s = h.replace('#', ''); const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHsl([r, g, b]: RGB): RGB {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslRgb([h, s, l]: RGB): RGB {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
const towards = (h: number, target: number, deg: number) => { let d = ((target - h + 540) % 360) - 180; d = Math.max(-deg, Math.min(deg, d)); return (h + d + 360) % 360; };

/**
 * A hue-shifted colour ramp of `n` steps from `base` (the mid-tone): shadows darker, a touch more saturated and turned
 * toward violet-blue, lights brighter, a touch less saturated and turned toward warm gold.
 */
export function hueRamp(base: string, n = 6, o: { spread?: number; shift?: number; cool?: number; warm?: number } = {}): RGB[] {
  const [h, s, l] = rgbHsl(hexRgb(base)), spread = o.spread ?? 0.62, shift = o.shift ?? 26;
  const out: RGB[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), d = t - 0.5;
    const L = clamp(l + d * spread * (d < 0 ? 1.15 : 0.85), 0.05, 0.97);
    const H = d < 0 ? towards(h, o.cool ?? 252, -d * 2 * shift) : towards(h, o.warm ?? 52, d * 2 * shift * 0.8);
    const S = clamp(s * (d < 0 ? 1 + -d * 0.35 : 1 - d * 0.5), 0, 1);
    out.push(hslRgb([H, S, L]));
  }
  return out;
}
const rgbCss = (c: RGB, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// ------------------------------------------------------------------ rasterizers

/** 3x3 rotation from Euler angles: roll about the long axis (x), then pitch (y), then turn in the picture plane (z) */
function rot(ax: number, ay: number, az: number) {
  const [ca, sa, cb, sb, cc, sc] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay), Math.cos(az), Math.sin(az)];
  // Rz * Ry * Rx
  const m = [
    cc * cb, cc * sb * sa - sc * ca, cc * sb * ca + sc * sa,
    sc * cb, sc * sb * sa + cc * ca, sc * sb * ca - cc * sa,
    -sb, cb * sa, cb * ca,
  ];
  return (v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}

/** a thin curved surface, sampled over u, v in [-1, 1] */
interface Surf {
  inside(u: number, v: number): boolean;
  /** local point (art px) */
  at(u: number, v: number): V3;
  /** albedo 0..1, material, and an optional fixed role (3: a glint pixel) */
  paint(u: number, v: number, front: boolean): { tone: number; mat?: number; role?: number; alpha?: number };
  /** specular strength (metal flakes, glossy petals) */
  spec?: number;
  /** how much lighter the back reads (leaves are paler underneath) */
  back?: number;
}

/** Splat a surface through a rotation into a w x h raster, nearest-first, shaded by the key light. */
function splat(w: number, h: number, surf: Surf, R: (v: V3) => V3, samples = 7): Raster {
  const r = raster(w, h), zb = new Float32Array(w * h).fill(-1e9), cx = w / 2, cy = h / 2;
  const N = Math.max(w, h) * samples, eps = 1 / N;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const u = (i / N) * 2 - 1, v = (j / N) * 2 - 1;
    if (!surf.inside(u, v)) continue;
    const p = R(surf.at(u, v));
    const x = Math.floor(cx + p[0]), y = Math.floor(cy - p[1]);
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const k = y * w + x;
    if (p[2] <= zb[k]) continue;
    zb[k] = p[2];
    // the normal from the surface's partial derivatives
    const a = surf.at(u, v), du = surf.at(u + eps, v), dv = surf.at(u, v + eps);
    const tu: V3 = [du[0] - a[0], du[1] - a[1], du[2] - a[2]], tv: V3 = [dv[0] - a[0], dv[1] - a[1], dv[2] - a[2]];
    let n = norm(R([tu[1] * tv[2] - tu[2] * tv[1], tu[2] * tv[0] - tu[0] * tv[2], tu[0] * tv[1] - tu[1] * tv[0]]));
    const front = n[2] >= 0;
    if (!front) n = [-n[0], -n[1], -n[2]];
    const pt = surf.paint(u, v, front);
    const lam = Math.max(0, dot(n, LIGHT)), facing = Math.abs(n[2]);
    // half-Lambert wrap (soft light through thin leaves), the back a little paler, a specular glint on metal
    let s = (0.16 + 0.84 * (lam * 0.75 + 0.25 * facing)) * pt.tone + (front ? 0 : surf.back ?? 0);
    if (surf.spec) { const hv = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]); s += Math.pow(Math.max(0, dot(n, hv)), 18) * surf.spec; }
    r.s[k] = clamp(s); r.tone[k] = clamp(pt.tone); r.a[k] = pt.alpha ?? 1; r.mat[k] = pt.mat ?? 0; r.role[k] = pt.role ?? 1;
  }
  return r;
}

/** Per-pixel shape: `f(x, y)` with x, y in art px from the centre (y up) returns a sample or null. */
export function paintPx(w: number, h: number, f: (x: number, y: number, ix: number, iy: number) => { s: number; tone?: number; a?: number; mat?: number; role?: number } | null): Raster {
  const r = raster(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const q = f(x + 0.5 - w / 2, h / 2 - (y + 0.5), x, y);
    if (!q) continue;
    const k = y * w + x;
    r.s[k] = clamp(q.s); r.tone[k] = clamp(q.tone ?? q.s); r.a[k] = q.a ?? 1; r.mat[k] = q.mat ?? 0; r.role[k] = q.role ?? 1;
  }
  return r;
}

/** Ring the shape with an outline (role 2) in the empty pixels next to it (4-neighbours). */
export function outline(r: Raster): Raster {
  const { w, h } = r, add: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if (r.role[k]) continue;
    const on = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < w && yy < h && r.role[yy * w + xx] === 1;
    if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) add.push(k);
  }
  for (const k of add) {
    const x = k % r.w, y = (k / r.w) | 0;
    // lit side (the shape is below or to the right of this pixel): a softer outline
    const lit = (y + 1 < h && r.role[k + w] === 1) || (x + 1 < w && r.role[k + 1] === 1);
    r.role[k] = 2; r.a[k] = 1; r.s[k] = lit ? 1 : 0;
  }
  return r;
}

/** Remove lone pixels sticking out (single pixels with at most one filled neighbour): cleaner clusters. */
export function tidy(r: Raster, keepThin = false): Raster {
  if (keepThin) return r;
  const { w, h } = r, kill: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if (r.role[k] !== 1) continue;
    let n = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && r.role[yy * w + xx]) n++; }
    if (n === 0) kill.push(k);
  }
  for (const k of kill) r.role[k] = 0;
  return r;
}

// ------------------------------------------------------------------ the objects

type Leaf = 'oval' | 'oak' | 'willow';
function leafSurf(kind: Leaf, len: number, seed: number): Surf {
  const W = kind === 'willow' ? 0.2 : kind === 'oak' ? 0.5 : 0.44;
  const width = (u: number) => {
    const t = (u + 0.8) / 1.8; // 0 at the base, 1 at the tip (u -1..-0.8 is the stalk)
    if (t <= 0 || t >= 1) return 0;
    let wd = W * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.85);
    if (kind === 'oak') wd *= 0.66 + 0.34 * Math.abs(Math.sin(t * Math.PI * 3.6 + 0.4));
    if (kind === 'oval') wd *= 1 + 0.05 * Math.sin(t * 40); // fine teeth
    return wd;
  };
  const curl = 0.32 + hash(seed, 3) * 0.2, bend = (hash(seed, 5) - 0.4) * 0.5;
  return {
    inside: (u, v) => (u < -0.8 ? u > -1 && Math.abs(v) < 0.045 : Math.abs(v) < width(u)),
    at: (u, v) => [u * len, v * len, (v * v * curl + u * u * bend * 0.4) * len],
    paint: (u, v, front) => {
      const wd = width(u);
      if (u < -0.8) return { tone: 0.55, mat: 1 };
      const t = (u + 0.8) / 1.8;
      let tone = 0.84 + (hash(Math.floor(u * 9), Math.floor(v * 9), seed) - 0.5) * 0.12;
      if (Math.abs(v) < 0.03 + 0.02 * (1 - t)) return { tone: front ? 0.58 : 1, mat: 1 };
      // side veins, swept toward the tip
      const sv = (Math.abs(v) * 1.1 - (t - 0.12) * 0.42) * 7 % 1;
      if (wd > 0.12 && Math.abs(v) < wd - 0.05 && t > 0.12 && t < 0.86 && (sv < 0.07 || sv > 0.93)) tone = front ? tone * 0.8 : Math.min(1, tone + 0.12);
      if (wd - Math.abs(v) < 0.05) tone *= 0.88; // the margin
      // autumn leaves carry a darker blotch or two
      if (kind === 'oak' && hash(Math.floor((u + 1) * 4), Math.floor((v + 1) * 4), seed + 9) > 0.88) tone *= 0.8;
      return { tone };
    },
    back: 0.1,
  };
}
function petalSurf(len: number, seed: number): Surf {
  const width = (u: number) => { const t = (u + 1) / 2; return t <= 0 || t >= 1 ? 0 : 0.52 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(t, 0.7) * 1.04)), 0.6); };
  return {
    inside: (u, v) => { const t = (u + 1) / 2; if (t > 0.84 && Math.abs(v) < (t - 0.84) * 0.9) return false; return Math.abs(v) < width(u); },
    at: (u, v) => [u * len, v * len, (v * v * 0.9 - u * 0.12 + u * u * 0.18) * len],
    paint: (u, v) => { const t = (u + 1) / 2; return { tone: 0.78 + 0.22 * Math.min(1, t * 1.6) - (Math.abs(v) < 0.05 && t < 0.7 ? 0.06 : 0) + (hash(Math.floor(u * 7), Math.floor(v * 7), seed) - 0.5) * 0.05, mat: t < 0.22 ? 1 : 0 }; },
    back: 0.06, spec: 0.08,
  };
}
function featherSurf(len: number, seed: number): Surf {
  // a barred owl feather: a pale quill, broad soft vanes with darker bars, fluffy down at the base
  const wl = (t: number) => 0.24 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.55), wr = (t: number) => 0.34 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.5);
  return {
    inside: (u, v) => {
      const t = (u + 1) / 2;
      if (t < 0.08) return Math.abs(v) < 0.05; // the bare quill
      return v < 0 ? -v < wl(t) : v < wr(t);
    },
    at: (u, v) => [u * len, v * len, (u * u * 0.22 + v * v * 0.35) * len],
    paint: (u, v) => {
      const t = (u + 1) / 2;
      if (Math.abs(v) < 0.035 && t > 0.06) return { tone: 0.95, mat: 1 };
      const bar = ((t + Math.abs(v) * 0.7) * 5.2) % 1 < 0.34;
      const down = t < 0.28, edge = (v < 0 ? wl(t) + v : wr(t) - v) < 0.05;
      return { tone: (bar && !down ? 0.62 : 0.9) + (hash(Math.floor(u * 11), Math.floor(v * 11), seed) - 0.5) * 0.06 - (edge ? 0.06 : 0), mat: down ? 1 : 0, alpha: down && edge ? 0.6 : 1 };
    },
    back: 0.06,
  };
}
function flakeSurf(len: number, seed: number): Surf {
  // an irregular torn flake of gold leaf
  const pts = Array.from({ length: 7 }, (_, i) => 0.62 + hash(i, seed) * 0.38);
  const r = (a: number) => { const f = ((a / (Math.PI * 2)) * 7 + 7) % 7, i = Math.floor(f), k = f - i; return pts[i] * (1 - k) + pts[(i + 1) % 7] * k; };
  return {
    inside: (u, v) => Math.hypot(u, v) < r(Math.atan2(v, u)),
    at: (u, v) => [u * len, v * len, (u * v * 0.5 + v * v * 0.2) * len],
    paint: (u, v) => ({ tone: 0.8 + (hash(Math.floor(u * 5), Math.floor(v * 5), seed) - 0.5) * 0.2 }),
    spec: 0.9,
  };
}
function paperSurf(len: number, seed: number): Surf {
  const ed = (a: number) => 0.78 + hash(Math.floor(a * 3), seed) * 0.12;
  return {
    inside: (u, v) => Math.abs(u) < ed(v + 3) + (hash(Math.floor(v * 6), seed, 2) - 0.5) * 0.12 && Math.abs(v) < ed(u) * 0.86 + (hash(Math.floor(u * 6), seed, 3) - 0.5) * 0.12,
    at: (u, v) => [u * len, v * len, Math.abs(u + 0.15) * 0.45 * len],
    paint: (u, v, front) => {
      // a faint ruled line on the front
      if (front && Math.abs(v - 0.18) < 0.06) return { tone: 0.82, mat: 1 };
      return { tone: 0.86 + (hash(Math.floor(u * 9), Math.floor(v * 9), seed) - 0.5) * 0.1 };
    },
    back: -0.06,
  };
}
function shavingSurf(len: number, seed: number): Surf {
  // a curled ribbon: a loose helix along x, its width across x
  return {
    inside: (u, v) => Math.abs(v) < 0.95 && u > -1 && u < 1,
    at: (u, v) => { const th = (u + 1) * Math.PI * 1.15, r = (0.25 + (u + 1) * 0.2) * len; return [v * len * 0.32 + (u + 1) * len * 0.18 - len * 0.18, Math.cos(th) * r, Math.sin(th) * r]; },
    paint: (u, v, front) => ({ tone: (front ? 0.92 : 0.7) * (((v + 1) * 3.5 + hash(Math.floor(u * 4), seed)) % 1 < 0.22 ? 0.86 : 1) }),
    back: -0.08,
  };
}

/** n frames of an object tumbling: turns about its long axis while it slowly wheels in the picture plane */
function tumble(w: number, h: number, mk: (i: number) => Surf, n: number, o: { tilt?: number; wheel?: number; roll0?: number } = {}): Raster[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const R = rot(a + (o.roll0 ?? 0.4), o.tilt ?? 0.55, (o.wheel ?? 0.7) + Math.sin(a) * 0.35);
    return splat(w, h, mk(i), R);
  });
}

// ------------------------------------------------------------------ the catalogue

export type PixKind = 'leaf' | 'leafGold' | 'leafRed' | 'leafOak' | 'petal' | 'petalWhite' | 'feather' | 'acorn' | 'shaving' | 'paper' | 'ink' | 'inkSplat'
  | 'flake' | 'snow' | 'glint' | 'glintCool' | 'glintRose' | 'mote' | 'moteCool' | 'moteRose' | 'moteViolet' | 'ember' | 'firefly' | 'puff' | 'dust' | 'seed' | 'coin';

interface Spec { make: () => Raster[]; ramps: string[]; outline?: string; glow?: boolean; n?: number; spread?: number }

const LEAF_N = 12;
const SPECS: Record<PixKind, Spec> = {
  leaf: { make: () => tumble(15, 15, () => leafSurf('oval', 6.6, 11), LEAF_N).map((r) => outline(tidy(r))), ramps: ['#5e9a3a', '#7a5a2c'], outline: '#16141e' },
  leafGold: { make: () => tumble(15, 15, () => leafSurf('oval', 6.4, 23), LEAF_N, { roll0: 1.3 }).map((r) => outline(tidy(r))), ramps: ['#d6a032', '#7a4a22'], outline: '#1e1418' },
  leafRed: { make: () => tumble(15, 15, () => leafSurf('oak', 6.6, 37), LEAF_N, { roll0: 2.1, wheel: -0.6 }).map((r) => outline(tidy(r))), ramps: ['#c4542c', '#6a3418'], outline: '#1e1216' },
  leafOak: { make: () => tumble(15, 15, () => leafSurf('oak', 6.8, 41), LEAF_N, { roll0: 0.9 }).map((r) => outline(tidy(r))), ramps: ['#86a83c', '#6a4a20'], outline: '#16141a' },
  petal: { make: () => tumble(11, 11, () => petalSurf(4.6, 5), 10, { tilt: 0.7 }).map((r) => outline(tidy(r))), ramps: ['#f0a6b4', '#d86a86'], outline: '#3a1628', spread: 0.5 },
  petalWhite: { make: () => tumble(11, 11, () => petalSurf(4.4, 8), 10, { tilt: 0.5, roll0: 1.7 }).map((r) => outline(tidy(r))), ramps: ['#f4ece4', '#e8b8c0'], outline: '#3a2a34', spread: 0.42 },
  feather: { make: () => tumble(11, 15, () => featherSurf(6.6, 3), 8, { tilt: 0.25, wheel: 0.5 }).map((r) => outline(tidy(r))), ramps: ['#c09060', '#f2e6cc'], outline: '#2a1c18' },
  acorn: { make: acornFrames, ramps: ['#b0682a', '#7c6440', '#5a3a1c'], outline: '#170f10', n: 7 },
  coin: { make: coinFrames, ramps: ['#d8a838', '#a87024'], outline: '#1c120c', n: 7 },
  shaving: { make: shavingFrames, ramps: ['#e6c68e'], outline: '#3a2414', spread: 0.5 },
  paper: { make: () => tumble(10, 10, () => paperSurf(4.2, 6), 8, { tilt: 0.45 }).map((r) => outline(tidy(r))), ramps: ['#efe6d2', '#8ca8c8'], outline: '#4a4048', spread: 0.4 },
  ink: { make: inkFrames, ramps: ['#2c2c58'], spread: 0.5 },
  inkSplat: { make: inkSplatFrames, ramps: ['#2c2c58'], spread: 0.5 },
  flake: { make: () => tumble(7, 7, () => flakeSurf(2.9, 2), 8, { tilt: 0.6 }), ramps: ['#d8a030'], spread: 0.8 },
  snow: { make: snowFrames, ramps: ['#cfe2f6'], glow: true, spread: 0.5 },
  glint: { make: () => glintFrames(), ramps: ['#f2c050'], glow: true },
  glintCool: { make: () => glintFrames(), ramps: ['#a8c8f0'], glow: true },
  glintRose: { make: () => glintFrames(), ramps: ['#f0a0a8'], glow: true },
  mote: { make: moteFrames, ramps: ['#f0c868'], glow: true },
  moteCool: { make: moteFrames, ramps: ['#a8c4ec'], glow: true },
  moteRose: { make: moteFrames, ramps: ['#f2a49a'], glow: true },
  moteViolet: { make: moteFrames, ramps: ['#b89af0'], glow: true },
  ember: { make: emberFrames, ramps: ['#f08a2c'], glow: true },
  firefly: { make: fireflyFrames, ramps: ['#d8e86a'], glow: true },
  puff: { make: puffFrames, ramps: ['#e8dcc4'], spread: 0.36 },
  dust: { make: dustFrames, ramps: ['#d8c49c'], spread: 0.4 },
  seed: { make: seedFrames, ramps: ['#f4f0e6'], spread: 0.3 },
};

/** a curled wood shaving: a ribbon wound into a loose spiral, its two faces catching the light as it turns over */
export function shavingFrames(): Raster[] {
  return Array.from({ length: 10 }, (_, f) => {
    const a = (f / 10) * Math.PI * 2, sq = 0.45 + 0.55 * Math.abs(Math.cos(a * 0.5)), ca = Math.cos(a), sa = Math.sin(a);
    return outline(tidy(paintPx(12, 12, (x, y) => {
      const lx = (ca * x + sa * y) / sq, ly = -sa * x + ca * y;
      // the spiral: radius shrinks as the angle grows; a point is on the ribbon if it lies near one of its turns
      const r = Math.hypot(lx, ly), th = (Math.atan2(ly, lx) + Math.PI * 2) % (Math.PI * 2);
      for (let k = 0; k < 2; k++) {
        const T = th + k * Math.PI * 2, R = 4.6 - T * 0.36, w = 0.95 - T * 0.05;
        if (T > Math.PI * 1.75 || R < 0.8) continue;
        if (Math.abs(r - R) < w) {
          const outer = r > R, face = Math.cos(T * 1.3 + a) > 0;
          const grain = Math.floor(T * 3.2) % 3 === 0 ? -0.08 : 0;
          return { s: (face ? 0.78 : 0.48) + (outer ? 0.12 : -0.08) + grain + (lx < 0 && ly > 0 ? 0.08 : 0) };
        }
      }
      return null;
    })));
  });
}
/** a spinning acorn: the in-picture tumble of a glossy nut under a scaly cap, always lit from the upper left */
function acornFrames(): Raster[] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    return outline(tidy(paintPx(11, 11, (x, y) => {
      const lx = c * x + s * y, ly = -s * x + c * y; // into the acorn's frame
      // the nut: an egg, pointed at the bottom
      const ny = ly + 1.2, ry = ny < 0 ? 3.7 : 3.1, nx = lx / 3.0, nyy = ny / ry;
      if (nx * nx + nyy * nyy < 1 && ly < 0.9) {
        const nz = Math.sqrt(1 - nx * nx - nyy * nyy), n = norm([c * nx - s * nyy, s * nx + c * nyy, nz]);
        const lam = Math.max(0, dot(n, LIGHT)), sp = Math.pow(Math.max(0, dot(n, norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]))), 24);
        if (sp > 0.6) return { s: 1, mat: 0, role: 3 };
        return { s: 0.12 + 0.82 * lam + (ly < -3.6 ? -0.1 : 0), mat: 0 };
      }
      // the cap, a scaly dome with a rim
      const cy = ly - 0.9, cx = lx / 3.5, cyy = cy / 2.3;
      if (cy > -0.6 && cx * cx + cyy * cyy < 1) {
        const nz = Math.sqrt(Math.max(0, 1 - cx * cx - cyy * cyy)), n = norm([c * cx - s * cyy, s * cx + c * cyy, nz]);
        const scale = ((Math.floor(lx + 8) + Math.floor(ly + 8)) % 2) ? 0.82 : 1;
        return { s: (0.1 + 0.78 * Math.max(0, dot(n, LIGHT))) * scale + (cy < -0.1 ? -0.12 : 0), mat: 1 };
      }
      // the stalk
      if (Math.abs(lx - 0.2) < 0.6 && ly > 3 && ly < 4.6) return { s: 0.45, mat: 2 };
      return null;
    })));
  });
}
/** a gold coin turning on edge: the disc narrows to a rim and widens again, its face embossed */
export function coinFrames(): Raster[] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI, sx = Math.cos(a);
    return outline(paintPx(11, 11, (x, y) => {
      const W = 4.3 * Math.max(0.16, Math.abs(sx)), u = x / W, v = y / 4.3, r = Math.hypot(u, v);
      if (r > 1) return null;
      const edge = r > 0.78, n = norm([u * (edge ? 1 : 0.25) * Math.sign(sx || 1), v * (edge ? 1 : 0.25), 1]);
      let s = 0.2 + 0.7 * Math.max(0, dot(n, LIGHT));
      if (!edge && Math.abs(r - 0.45) < 0.12) s *= 0.75; // the stamped ring
      if (Math.abs(sx) < 0.3) s = 0.5 + 0.3 * (y > 0 ? 1 : 0); // on edge: the milled rim
      if (r < 0.3 && u < 0 && v > 0) s += 0.25;
      return { s, mat: edge ? 1 : 0, role: s > 1 ? 3 : 1 };
    }));
  });
}
/** an ink drop in flight: a glossy bead with a tail */
function inkFrames(): Raster[] {
  return [0, 1].map((f) => paintPx(5, 7, (x, y) => {
    const t = y + 1.2, rx = t > 0 ? 1.9 * Math.max(0, 1 - t / (3.4 + f * 0.5)) : Math.sqrt(Math.max(0, 1 - (t / 2) * (t / 2))) * 2.1;
    if (Math.abs(x) > rx) return null;
    if (x < -0.2 && x > -1.4 && t < -0.2 && t > -1.2) return { s: 1, role: 3 };
    return { s: 0.18 + (x < 0 ? 0.25 : 0) + (t < -1.2 ? -0.1 : 0) };
  }));
}
/** an ink drop landing: a crown, then a flat splat ringed by satellite drops */
function inkSplatFrames(): Raster[] {
  return [0, 1, 2, 3].map((f) => paintPx(11, 7, (x, y, ix, iy) => {
    const r = Math.hypot(x / (1.6 + f * 0.9), y / (0.8 + f * 0.25));
    if (r < 1) return { s: x < 0 && y > 0 ? 0.45 : 0.2 };
    if (f >= 1 && hash(ix, iy, 77) > 0.86 && r < 1.9 && r > 1.3) return { s: 0.28 };
    if (f === 0 && Math.abs(x) < 3 && y > 0.5 && y < 2.6 && hash(ix, 3) > 0.5) return { s: 0.3 }; // the crown's spikes
    return null;
  }));
}
/** a six-armed snow crystal, turning */
export function snowFrames(): Raster[] {
  return Array.from({ length: 3 }, (_, f) => {
    const r = raster(9, 9), base = (f / 3) * (Math.PI / 3);
    const put = (x: number, y: number, v: number) => { const X = Math.round(4 + x), Y = Math.round(4 - y); if (X < 0 || Y < 0 || X > 8 || Y > 8) return; const k = Y * 9 + X; if (r.s[k] < v) { r.s[k] = v; r.a[k] = v > 0.6 ? 1 : 0.75; r.role[k] = 1; r.tone[k] = v; } };
    for (let k = 0; k < 6; k++) {
      const a = base + (k * Math.PI) / 3, ca = Math.cos(a), sa = Math.sin(a);
      for (let d = 1; d <= 3.4; d += 1) put(ca * d, sa * d, 0.95 - d * 0.12);
      if (k % 2 === 0) put(ca * 2.2 + Math.cos(a + 1) * 1, sa * 2.2 + Math.sin(a + 1) * 1, 0.45);
    }
    put(0, 0, 1);
    return r;
  });
}
/** a glint: a pixel cross whose arms grow and shrink, diagonal rays at its peak (light: drawn additively) */
function glintFrames(): Raster[] {
  const arms = [1, 2, 4, 6, 4, 2], diag = [0, 0, 1, 2, 1, 0];
  return arms.map((L, f) => paintPx(13, 13, (x, y) => {
    const ax = Math.abs(x - 0.5 + 0.5), ay = Math.abs(y + 0.5 - 0.5);
    const X = Math.round(x - 0.5), Y = Math.round(y - 0.5), AX = Math.abs(X), AY = Math.abs(Y);
    void ax; void ay;
    if (AX === 0 && AY === 0) return { s: 1 };
    if ((AX === 0 && AY <= L) || (AY === 0 && AX <= L)) { const d = AX + AY; return { s: 1 - d / (L + 1.2), a: d > L - 1 && L > 2 ? 0.7 : 1 }; }
    if (diag[f] && AX === AY && AX <= diag[f]) return { s: 0.7 - AX * 0.2, a: 0.8 };
    if (L >= 4 && AX + AY === 1) return { s: 0.85 };
    return null;
  }));
}
/** a mote: a bright core in a dithered halo that breathes */
function moteFrames(): Raster[] {
  // a bright point with a soft round falloff of light (brighter along the cross, as a lens sees it) that breathes
  return [0, 1, 2, 1].map((f) => paintPx(9, 9, (x, y) => {
    const X = Math.round(x - 0.5), Y = Math.round(y - 0.5), ax = Math.abs(X), ay = Math.abs(Y), d = Math.hypot(X, Y);
    if (d === 0) return { s: 1 };
    if (d === 1) return { s: 0.86 };
    if (ax === 1 && ay === 1) return { s: 0.6, a: 0.75 };
    if (d === 2) return { s: 0.55, a: 0.45 + f * 0.12 };
    if (d < 2.9 + f * 0.4) return { s: 0.4, a: 0.16 + f * 0.05 };
    return null;
  }));
}
function emberFrames(): Raster[] {
  return Array.from({ length: 6 }, (_, f) => paintPx(5, 5, (x, y, ix, iy) => {
    const d = Math.hypot(x, y + (f % 2) * 0.3), j = hash(ix, iy, f) * 0.6;
    if (d < 0.7) return { s: 1 };
    if (d < 1.4 + j * 0.5) return { s: 0.7 };
    if (d < 2.2 + j && bayer(ix, iy + f) < 0.45) return { s: 0.3, a: 0.75 };
    return null;
  }));
}
function fireflyFrames(): Raster[] {
  return [0.3, 0.6, 1, 0.8, 0.5, 0.2].map((k) => paintPx(9, 9, (x, y, ix, iy) => {
    const d = Math.hypot(x, y);
    if (d < 1) return { s: 0.85 + k * 0.15 };
    if (d < 1.8) return { s: 0.5 + k * 0.3, a: 0.9 };
    if (d < 1.8 + k * 2.6 && bayer(ix, iy) < 0.55 - d * 0.06) return { s: 0.35, a: 0.6 * k + 0.2 };
    return null;
  }));
}
/** a soft puff of dust or breath: lobes lit from the upper left that spread and dissolve on a dither */
export function puffFrames(): Raster[] {
  const lobes: [number, number, number][] = [[-1.6, 0.4, 2.4], [1.3, 0.9, 2.6], [0.2, -0.9, 2.5], [-0.4, 1.8, 2]];
  return Array.from({ length: 6 }, (_, f) => paintPx(13, 11, (x, y, ix, iy) => {
    const g = 1 + f * 0.12;
    let best = -1, nx = 0, ny = 0;
    for (const [cx, cy, r] of lobes) { const dx = (x - cx * g) / (r * g), dy = (y - cy * g) / (r * g), d = 1 - (dx * dx + dy * dy); if (d > best) { best = d; nx = dx; ny = dy; } }
    // it thins from the rim inward as it spreads
    const cut = f * 0.07;
    if (best <= cut) return null;
    const n = norm([nx, ny, Math.sqrt(Math.max(0, best))]);
    const rim = best - cut < 0.14, mid = best - cut < 0.32;
    return { s: 0.3 + 0.7 * Math.max(0, dot(n, LIGHT)) + (hash(ix, iy, 9) - 0.5) * 0.06, a: (rim ? 0.4 : mid ? 0.72 : 0.95) * (1 - f * 0.08) };
  }));
}
function dustFrames(): Raster[] {
  return [0, 1, 2].map((f) => paintPx(3, 3, (x, y) => {
    const X = Math.round(x - 0.5), Y = Math.round(y - 0.5);
    if (X === 0 && Y === 0) return { s: 0.8 };
    if (f === 1 && X === 1 && Y === 0) return { s: 0.55 };
    if (f === 2 && X === 0 && Y === -1) return { s: 0.5 };
    return null;
  }));
}
/** a dandelion seed riding the wind: a fine tuft on a stalk */
function seedFrames(): Raster[] {
  return [0, 1].map((f) => paintPx(7, 7, (x, y, ix) => {
    const X = Math.round(x - 0.5), Y = Math.round(y - 0.5);
    if (X === 0 && Y <= 0 && Y >= -3) return { s: 0.6 };
    if (Y === 1 && Math.abs(X) <= 2 + f) return { s: 0.95, a: Math.abs(X) > 1 ? 0.6 : 1 };
    if (Y === 2 && Math.abs(X) <= 1 + f && hash(ix, f) > 0.3) return { s: 1, a: 0.55 };
    return null;
  }));
}

// ------------------------------------------------------------------ colouring and cache

const frames = new Map<PixKind, Raster[]>();
function raw(kind: PixKind): Raster[] {
  let f = frames.get(kind);
  if (!f) { f = SPECS[kind].make(); frames.set(kind, f); }
  return f;
}
export const frameCount = (kind: PixKind) => raw(kind).length;
export const isGlow = (kind: PixKind) => !!SPECS[kind].glow;

const cache = new Map<string, HTMLCanvasElement>();
/** One frame of a kind as a crisp, coloured canvas (1 texel per art pixel). `tint` replaces the first ramp's base. */
export function sprite(kind: PixKind, frame = 0, tint?: string): HTMLCanvasElement {
  const list = raw(kind), f = ((frame % list.length) + list.length) % list.length, key = `${kind}|${f}|${tint ?? ''}`;
  let c = cache.get(key);
  if (c) return c;
  const sp = SPECS[kind], r = list[f], steps = sp.glow ? 5 : 6;
  const ramps = (tint ? [tint, ...sp.ramps.slice(1)] : sp.ramps).map((b) => hueRamp(b, steps, { spread: sp.spread ?? 0.62 }));
  c = document.createElement('canvas');
  c.width = r.w; c.height = r.h;
  const g = c.getContext('2d')!, img = g.createImageData(r.w, r.h), d = img.data;
  const ol = sp.outline ? hexRgb(sp.outline) : null;
  for (let k = 0; k < r.w * r.h; k++) {
    if (!r.role[k]) continue;
    let col: RGB;
    const ramp = ramps[Math.min(ramps.length - 1, r.mat[k])];
    if (r.role[k] === 2) col = r.s[k] > 0.5 ? mix(ramp[0], ol ?? ramp[0], 0.45) : (ol ?? ramp[0]);
    else if (r.role[k] === 3) col = sp.glow ? [255, 255, 255] : mix(ramp[steps - 1], [255, 252, 236], 0.7);
    else if (sp.glow) {
      // lights: the core burns to white, the falloff keeps the hue
      const s = r.s[k];
      col = s > 0.92 ? [255, 255, 246] : ramp[Math.round(clamp(s) * (steps - 1))];
    } else col = ramp[Math.round(clamp(r.s[k]) * (steps - 1))];
    d[k * 4] = col[0]; d[k * 4 + 1] = col[1]; d[k * 4 + 2] = col[2]; d[k * 4 + 3] = Math.round(r.a[k] * 255);
  }
  g.putImageData(img, 0, 0);
  cache.set(key, c);
  if (cache.size > 600) cache.delete(cache.keys().next().value!);
  return c;
}
const mix = (a: RGB, b: RGB, k: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];

/** A contact sheet of every kind's frames (dev page). */
export function sheet(scale = 4, kinds = Object.keys(SPECS) as PixKind[], bg = '#3a4a3c'): HTMLCanvasElement {
  const rows = kinds.map((k) => raw(k)), cw = 16, W = Math.max(...rows.map((r) => r.length)) * cw, H = kinds.length * cw;
  const c = document.createElement('canvas');
  c.width = W * scale; c.height = H * scale;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  kinds.forEach((k, j) => rows[j].forEach((r, i) => {
    g.globalCompositeOperation = SPECS[k].glow ? 'lighter' : 'source-over';
    g.drawImage(sprite(k, i), (i * cw + (cw - r.w) / 2) * scale, (j * cw + (cw - r.h) / 2) * scale, r.w * scale, r.h * scale);
  }));
  return c;
}

/**
 * The albedo of a flat object for the 3D world (it gets its light there): a w x h raster of grey values, the outline
 * at 0. Kinds: 'leaf' | 'leafOak' | 'leafWillow' | 'petal' | 'feather' | 'flake' | 'paper' | 'shaving'.
 */
export function flatTone(kind: 'leaf' | 'leafOak' | 'leafWillow' | 'petal' | 'feather' | 'flake' | 'paper' | 'shaving', size = 16): Raster {
  const L = size * 0.44, R = rot(0, 0, Math.PI / 2 - 0.02);
  const surf = kind === 'leaf' ? leafSurf('oval', L, 11) : kind === 'leafOak' ? leafSurf('oak', L, 41) : kind === 'leafWillow' ? leafSurf('willow', L, 13)
    : kind === 'petal' ? petalSurf(L * 0.85, 5) : kind === 'feather' ? featherSurf(L, 3) : kind === 'flake' ? flakeSurf(L * 0.7, 2) : kind === 'paper' ? paperSurf(L * 0.8, 6) : shavingSurf(L * 0.8, 4);
  // flat: no curl for the albedo, read straight on
  const flat: Surf = { ...surf, at: (u, v) => { const p = surf.at(u, v); return kind === 'shaving' ? p : [p[0], p[1], 0]; } };
  const r = splat(size, size, flat, kind === 'shaving' ? rot(0.4, 0.5, 0.6) : R, 5);
  return outline(tidy(r));
}
export { rgbCss };
